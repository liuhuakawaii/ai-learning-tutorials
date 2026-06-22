# 第4课：Prompt 版本管理——变更记录、回滚、灰度

> **课程定位**：像管理代码一样管理 Prompt
> **前置知识**：第 2-3 课的评估
> **预计时长**：40 分钟

## 场景引入

周五下午，你优化了 RAG 系统的 System Prompt，加了一句"如果不确定就拒答"。上线后发现效果不错，幻觉率降低了。但到了下周一，用户投诉"它什么都不回答了"。你检查发现，另一位同事周末改了 Prompt，把你的拒答逻辑改得过于保守了。你问他改了什么，他说"就改了一小句"，但你们谁也说不清原来是什么样。Prompt 没有版本管理，出了问题连回滚都做不到。

---

## 学习目标

完成本课学习后，你将能够：

1. 设计 Prompt 版本管理结构
2. 记录 Prompt 变更历史
3. 实现版本回滚
4. 设计灰度发布策略

---

## 一、为什么需要 Prompt 版本管理

### 1.1 Prompt 是代码

```
Prompt 和代码一样重要：

  代码变更 → 需要版本控制、测试、回滚
  Prompt 变更 → 同样需要版本控制、评估、回滚

  如果 Prompt 出问题：
  - 不知道改了什么
  - 不知道什么时候改的
  - 无法快速回滚
  - 影响所有用户
```

### 1.2 版本管理的价值

```
┌─────────────────────────────────────────────────────────────────┐
│                    Prompt 版本管理的价值                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  可追溯                                                          │
│  ├── 知道每次改了什么                                            │
│  ├── 知道谁改的                                                  │
│  └── 知道为什么改                                                │
│                                                                 │
│  可回滚                                                          │
│  ├── 发现问题可以快速回滚                                        │
│  ├── 不影响用户                                                  │
│  └── 减少损失                                                    │
│                                                                 │
│  可实验                                                          │
│  ├── A/B 测试不同版本                                            │
│  ├── 灰度发布新版本                                              │
│  └── 数据驱动决策                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、Prompt 版本数据结构

### 2.1 数据库模型

```typescript
// prisma/schema.prisma
model PromptVersion {
  id          String    @id @default(cuid())
  name        String    // Prompt 名称，如 "chat-system", "rag-system"
  version     Int       // 版本号
  content     String    // Prompt 内容
  description String?   // 变更说明
  isActive    Boolean   @default(false)  // 是否为当前使用的版本
  
  // 评估结果
  evalScore   Float?
  evalPassed  Boolean?
  
  // 灰度
  trafficPercentage Int @default(0)  // 流量百分比
  
  createdAt   DateTime  @default(now())
  createdBy   String?
  
  @@unique([name, version])
  @@index([name, isActive])
}
```

### 2.2 Prompt 管理器

```typescript
// lib/prompt-manager.ts
import { prisma } from './prisma'

export class PromptManager {
  // 获取当前活跃的 Prompt
  async getActive(name: string): Promise<string> {
    const version = await prisma.promptVersion.findFirst({
      where: {
        name,
        isActive: true,
      },
      orderBy: { version: 'desc' },
    })

    if (!version) {
      throw new Error(`No active prompt found for ${name}`)
    }

    return version.content
  }

  // 创建新版本
  async createVersion(
    name: string,
    content: string,
    description?: string,
    createdBy?: string
  ) {
    // 获取当前最大版本号
    const latest = await prisma.promptVersion.findFirst({
      where: { name },
      orderBy: { version: 'desc' },
    })

    const version = (latest?.version || 0) + 1

    return prisma.promptVersion.create({
      data: {
        name,
        version,
        content,
        description,
        createdBy,
      },
    })
  }

  // 激活某个版本
  async activate(name: string, version: number) {
    // 先停用所有版本
    await prisma.promptVersion.updateMany({
      where: { name },
      data: { isActive: false },
    })

    // 激活指定版本
    await prisma.promptVersion.update({
      where: { name_version: { name, version } },
      data: { isActive: true },
    })
  }

  // 回滚到上一个版本
  async rollback(name: string) {
    const current = await prisma.promptVersion.findFirst({
      where: { name, isActive: true },
    })

    if (!current) throw new Error('No active version to rollback from')

    const previous = await prisma.promptVersion.findFirst({
      where: {
        name,
        version: { lt: current.version },
      },
      orderBy: { version: 'desc' },
    })

    if (!previous) throw new Error('No previous version to rollback to')

    await this.activate(name, previous.version)

    return previous
  }

  // 获取版本历史
  async getHistory(name: string) {
    return prisma.promptVersion.findMany({
      where: { name },
      orderBy: { version: 'desc' },
    })
  }

  // 获取灰度流量
  async getTrafficSplit(name: string): Promise<Map<string, number>> {
    const versions = await prisma.promptVersion.findMany({
      where: {
        name,
        trafficPercentage: { gt: 0 },
      },
    })

    const split = new Map<string, number>()
    for (const v of versions) {
      split.set(`${v.version}`, v.trafficPercentage)
    }

    return split
  }
}

export const promptManager = new PromptManager()
```

---

## 三、灰度发布

### 3.1 灰度策略

```
┌─────────────────────────────────────────────────────────────────┐
│                    灰度发布策略                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  阶段 1：小流量测试（5%）                                        │
│  ├── 新版本接收 5% 的流量                                        │
│  ├── 观察评估指标                                                │
│  └── 如果有问题，立即回滚                                        │
│                                                                 │
│  阶段 2：扩大流量（20%）                                         │
│  ├── 指标正常，扩大到 20%                                        │
│  ├── 继续观察                                                    │
│  └── 收集更多数据                                                │
│                                                                 │
│  阶段 3：半量（50%）                                             │
│  ├── 指标稳定，扩大到 50%                                        │
│  ├── A/B 对比                                                    │
│  └── 确认效果                                                    │
│                                                                 │
│  阶段 4：全量（100%）                                            │
│  ├── 效果确认，全量切换                                          │
│  └── 旧版本保留，可回滚                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 灰度路由

```typescript
// lib/traffic-router.ts
export class TrafficRouter {
  private counters = new Map<string, number>()

  async getVersion(name: string, userId: string): Promise<string> {
    // 获取流量分配
    const split = await promptManager.getTrafficSplit(name)

    if (split.size === 0) {
      // 没有灰度，使用活跃版本
      return 'active'
    }

    // 基于用户 ID 的确定性路由
    // 同一个用户总是路由到同一个版本
    const hash = this.hashCode(userId)
    const bucket = Math.abs(hash) % 100

    let cumulative = 0
    for (const [version, percentage] of split) {
      cumulative += percentage
      if (bucket < cumulative) {
        return version
      }
    }

    return 'active'
  }

  private hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash |= 0
    }
    return hash
  }
}

export const trafficRouter = new TrafficRouter()
```

### 3.3 在聊天中使用灰度

```typescript
// lib/chat.ts
export async function chat(
  userId: string,
  input: any[]
) {
  // 获取应该使用的 Prompt 版本
  const version = await trafficRouter.getVersion('chat-system', userId)

  let systemPrompt: string
  if (version === 'active') {
    systemPrompt = await promptManager.getActive('chat-system')
  } else {
    const promptVersion = await prisma.promptVersion.findUnique({
      where: { name_version: { name: 'chat-system', version: parseInt(version) } },
    })
    systemPrompt = promptVersion!.content
  }

  // 使用对应的 Prompt 调用模型
  const response = await openai.responses.create({
    model: 'gpt-5.5',
    input: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  })

  // 记录使用的版本（用于后续分析）
  await logChatVersion(userId, version)

  return response
}
```

---

## 四、版本对比

```typescript
// lib/prompt-diff.ts
export function diffPrompts(oldVersion: string, newVersion: string): string[] {
  const oldLines = oldVersion.split('\n')
  const newLines = newVersion.split('\n')

  const changes: string[] = []

  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    if (oldLines[i] !== newLines[i]) {
      if (oldLines[i]) changes.push(`- ${oldLines[i]}`)
      if (newLines[i]) changes.push(`+ ${newLines[i]}`)
    }
  }

  return changes
}
```

---

## 动手练习

### 练习一：实现版本管理

1. 创建 Prompt 版本表
2. 实现创建、查询、激活功能
3. 测试版本切换

### 练习二：实现回滚

1. 创建多个版本
2. 实现回滚功能
3. 验证回滚后的行为

### 练习三：实现灰度

1. 设置流量分配
2. 实现灰度路由
3. 验证不同用户看到不同版本

## 常见误区

1. **把 Prompt 写死在代码里**：System Prompt 直接硬编码在代码文件中，改 Prompt 就要改代码、发版、部署。Prompt 应该像配置一样独立管理，支持热更新。

2. **只存最新版本，不存历史**：每次修改 Prompt 直接覆盖旧版本。出了问题想回滚，发现旧版本已经丢了。版本管理的核心价值就是"可追溯、可回滚"。

3. **灰度发布不基于用户 ID 路由**：用随机数分配流量，同一个用户这次用新版本、下次用旧版本，体验不一致。灰度路由必须基于用户 ID 做哈希，保证同一用户始终使用同一版本。

4. **灰度期间不看数据就全量**：灰度了 5% 流量，但没有对比新旧版本的评估指标，灰度了一周感觉"没什么问题"就全量了。灰度必须有数据支撑决策。

## 工程建议

1. **用数据库存储 Prompt 版本**：每个版本记录内容、变更说明、创建人、创建时间、评估分数。支持按名称查询历史、按版本号激活、快速回滚。

2. **每次 Prompt 变更必须关联评估结果**：新版本创建后，先运行评估集，评估通过才能激活。评估分数应该记录在版本元数据中。

3. **灰度发布遵循 5% → 20% → 50% → 100% 的节奏**：每个阶段观察至少 24 小时，监控核心指标（通过率、用户满意度、拒答率）。任何指标异常立即回滚。

4. **保留旧版本至少 7 天**：全量上线后不要立即删除旧版本。如果新版本在某些边缘场景下有问题，保留旧版本可以快速回滚。

---

## 小结

本课的核心要点：

1. **Prompt 是代码**：需要版本控制、测试、回滚
2. **版本管理**：记录每次变更，可追溯
3. **回滚机制**：发现问题快速回滚
4. **灰度发布**：小流量测试，逐步扩大
5. **确定性路由**：同一用户总是同一版本

---

**下一课**: [第5课：线上监控——延迟、成本、失败率、用户满意度](./05-线上监控.md)
