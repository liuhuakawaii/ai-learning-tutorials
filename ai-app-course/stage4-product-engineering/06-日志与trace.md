# 第6课：日志与 trace——请求、检索、工具、输出

> **课程定位**：实现可观测性
> **前置知识**：阶段一到三的基础
> **预计时长**：40 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 设计日志结构
2. 实现请求追踪（trace）
3. 记录关键事件
4. 分析失败样本

---

## 一、为什么需要日志

### 1.1 AI 应用的特殊性

```
传统应用的日志：
  请求 → 处理 → 响应
  每一步都是确定的

AI 应用的日志：
  请求 → 检索 → Prompt 组装 → 模型调用 → 工具调用 → 后处理 → 响应
          ↑           ↑            ↑           ↑
        可能出错    可能出错     输出不确定   可能出错

  需要记录更多细节，才能排查问题。
```

### 1.2 日志的价值

```
┌─────────────────────────────────────────────────────────────────┐
│                    日志的价值                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  排查问题                                                        │
│  ├── 回答不准确 → 检查检索结果                                   │
│  ├── 响应慢 → 检查各阶段耗时                                    │
│  └── 报错 → 检查错误详情                                        │
│                                                                 │
│  优化质量                                                        │
│  ├── 分析高频问题                                                │
│  ├── 收集失败样本                                                │
│  └── 改进 Prompt                                                 │
│                                                                 │
│  成本控制                                                        │
│  ├── 统计 token 使用量                                           │
│  ├── 分析模型调用成本                                            │
│  └── 优化调用策略                                                │
│                                                                 │
│  安全审计                                                        │
│  ├── 记录敏感操作                                                │
│  ├── 检测异常行为                                                │
│  └── 合规要求                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、日志结构设计

### 2.1 Trace 结构

```typescript
// lib/logger/types.ts
interface Trace {
  id: string                    // 追踪 ID
  userId: string
  conversationId: string
  startTime: Date
  endTime?: Date
  duration?: number
  status: 'success' | 'error' | 'timeout'
  
  // 各阶段日志
  stages: Stage[]
  
  // 元数据
  metadata: {
    model: string
    tokenUsage: TokenUsage
    cost: number
  }
}

interface Stage {
  name: string                  // 阶段名称
  startTime: Date
  endTime?: Date
  duration?: number
  status: 'success' | 'error' | 'skipped'
  input?: any
  output?: any
  error?: string
}

interface TokenUsage {
  prompt: number
  completion: number
  total: number
}
```

### 2.2 数据库模型

```typescript
// prisma/schema.prisma
model Trace {
  id             String    @id @default(cuid())
  userId         String
  conversationId String
  startTime      DateTime  @default(now())
  endTime        DateTime?
  duration       Int?
  status         String    @default("pending")
  model          String
  promptTokens   Int       @default(0)
  completionTokens Int     @default(0)
  totalTokens    Int       @default(0)
  cost           Float     @default(0)
  
  stages         Stage[]
  
  @@index([userId, startTime])
  @@index([conversationId])
}

model Stage {
  id        String   @id @default(cuid())
  traceId   String
  name      String
  startTime DateTime @default(now())
  endTime   DateTime?
  duration  Int?
  status    String   @default("pending")
  input     Json?
  output    Json?
  error     String?
  
  trace     Trace    @relation(fields: [traceId], references: [id])
  
  @@index([traceId])
}
```

---

## 三、日志记录器实现

### 3.1 Trace 记录器

```typescript
// lib/logger/tracer.ts
import { prisma } from '../prisma'

export class Tracer {
  private traceId: string
  private stages: Map<string, { startTime: Date }> = new Map()

  constructor(
    private userId: string,
    private conversationId: string
  ) {
    this.traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  async start(model: string): Promise<void> {
    await prisma.trace.create({
      data: {
        id: this.traceId,
        userId: this.userId,
        conversationId: this.conversationId,
        model,
        status: 'pending',
      },
    })
  }

  async startStage(name: string, input?: any): Promise<void> {
    const startTime = new Date()
    this.stages.set(name, { startTime })

    await prisma.stage.create({
      data: {
        traceId: this.traceId,
        name,
        startTime,
        status: 'running',
        input: input ? JSON.stringify(input) : null,
      },
    })
  }

  async endStage(name: string, output?: any, error?: string): Promise<void> {
    const stage = this.stages.get(name)
    if (!stage) return

    const endTime = new Date()
    const duration = endTime.getTime() - stage.startTime.getTime()

    await prisma.stage.updateMany({
      where: {
        traceId: this.traceId,
        name,
      },
      data: {
        endTime,
        duration,
        status: error ? 'error' : 'success',
        output: output ? JSON.stringify(output) : null,
        error,
      },
    })

    this.stages.delete(name)
  }

  async end(
    status: 'success' | 'error' | 'timeout',
    tokenUsage?: TokenUsage,
    cost?: number
  ): Promise<void> {
    const endTime = new Date()

    await prisma.trace.update({
      where: { id: this.traceId },
      data: {
        endTime,
        duration: endTime.getTime() - new Date().getTime(),
        status,
        promptTokens: tokenUsage?.prompt || 0,
        completionTokens: tokenUsage?.completion || 0,
        totalTokens: tokenUsage?.total || 0,
        cost: cost || 0,
      },
    })
  }

  getTraceId(): string {
    return this.traceId
  }
}
```

### 3.2 在聊天流程中使用

```typescript
// lib/chat-with-trace.ts
export async function chatWithTrace(
  userId: string,
  conversationId: string,
  message: string
) {
  const tracer = new Tracer(userId, conversationId)
  await tracer.start('gpt-4o-mini')

  try {
    // 1. 检索阶段
    await tracer.startStage('retrieval', { query: message })
    const searchResults = await retrieve(message, userId)
    await tracer.endStage('retrieval', { results: searchResults })

    // 2. Prompt 组装阶段
    await tracer.startStage('prompt_assembly')
    const messages = buildPrompt(message, searchResults)
    await tracer.endStage('prompt_assembly', { messages })

    // 3. 模型调用阶段
    await tracer.startStage('model_call', { messages })
    const startTime = Date.now()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
    })
    const duration = Date.now() - startTime
    await tracer.endStage('model_call', { response: response.choices[0] })

    // 4. 后处理阶段
    await tracer.startStage('post_processing')
    const answer = response.choices[0].message.content
    await tracer.endStage('post_processing', { answer })

    // 记录完成
    const tokenUsage = {
      prompt: response.usage?.prompt_tokens || 0,
      completion: response.usage?.completion_tokens || 0,
      total: response.usage?.total_tokens || 0,
    }
    const cost = calculateCost('gpt-4o-mini', tokenUsage.prompt, tokenUsage.completion)

    await tracer.end('success', tokenUsage, cost)

    return answer

  } catch (error) {
    await tracer.end('error')
    throw error
  }
}
```

---

## 四、查询和分析

### 4.1 查询 Trace

```typescript
// lib/logger/queries.ts
export async function getTrace(traceId: string) {
  return prisma.trace.findUnique({
    where: { id: traceId },
    include: {
      stages: {
        orderBy: { startTime: 'asc' },
      },
    },
  })
}

export async function getUserTraces(
  userId: string,
  options: {
    status?: string
    startDate?: Date
    endDate?: Date
    limit?: number
  } = {}
) {
  const { status, startDate, endDate, limit = 50 } = options

  const where: any = { userId }
  if (status) where.status = status
  if (startDate || endDate) {
    where.startTime = {}
    if (startDate) where.startTime.gte = startDate
    if (endDate) where.startTime.lte = endDate
  }

  return prisma.trace.findMany({
    where,
    orderBy: { startTime: 'desc' },
    take: limit,
  })
}

// 获取失败样本
export async function getFailedTraces(userId: string, limit: number = 20) {
  return prisma.trace.findMany({
    where: {
      userId,
      status: 'error',
    },
    orderBy: { startTime: 'desc' },
    take: limit,
    include: { stages: true },
  })
}
```

### 4.2 统计分析

```typescript
export async function getTraceStats(userId: string, period: string = 'month') {
  const startDate = getStartDate(period)

  const stats = await prisma.trace.aggregate({
    where: {
      userId,
      startTime: { gte: startDate },
    },
    _count: true,
    _avg: {
      duration: true,
      totalTokens: true,
      cost: true,
    },
    _sum: {
      totalTokens: true,
      cost: true,
    },
  })

  // 按状态分组
  const byStatus = await prisma.trace.groupBy({
    by: ['status'],
    where: {
      userId,
      startTime: { gte: startDate },
    },
    _count: true,
  })

  // 按模型分组
  const byModel = await prisma.trace.groupBy({
    by: ['model'],
    where: {
      userId,
      startTime: { gte: startDate },
    },
    _count: true,
    _sum: { totalTokens: true, cost: true },
  })

  return {
    total: stats._count,
    avgDuration: stats._avg.duration,
    avgTokens: stats._avg.totalTokens,
    totalTokens: stats._sum.totalTokens,
    totalCost: stats._sum.cost,
    byStatus,
    byModel,
  }
}
```

---

## 五、前端 Trace 展示

```typescript
// components/TraceViewer.tsx
'use client'

interface Stage {
  name: string
  status: string
  duration?: number
  error?: string
}

interface Trace {
  id: string
  status: string
  duration?: number
  model: string
  totalTokens: number
  cost: number
  stages: Stage[]
}

export function TraceViewer({ trace }: { trace: Trace }) {
  return (
    <div className="trace-viewer">
      <div className="trace-header">
        <h3>Trace {trace.id}</h3>
        <span className={`status ${trace.status}`}>{trace.status}</span>
      </div>

      <div className="trace-meta">
        <span>模型: {trace.model}</span>
        <span>耗时: {trace.duration}ms</span>
        <span>Token: {trace.totalTokens}</span>
        <span>费用: ${trace.cost.toFixed(4)}</span>
      </div>

      <div className="stages">
        {trace.stages.map((stage, i) => (
          <div key={i} className={`stage ${stage.status}`}>
            <div className="stage-header">
              <span className="stage-name">{stage.name}</span>
              <span className="stage-duration">{stage.duration}ms</span>
            </div>
            {stage.error && (
              <div className="stage-error">{stage.error}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 动手练习

### 练习一：实现 Trace 记录

1. 创建 Tracer 类
2. 在聊天流程中记录各阶段
3. 查询 Trace 数据

### 练习二：分析失败样本

1. 查询失败的 Trace
2. 分析失败原因
3. 改进 Prompt 或检索策略

### 练习三：统计分析

1. 统计成功率
2. 统计平均耗时
3. 统计 token 使用量

---

## 小结

本课的核心要点：

1. **Trace 结构**：请求 → 各阶段 → 响应的完整链路
2. **阶段记录**：检索、Prompt 组装、模型调用、后处理
3. **失败分析**：收集失败样本，分析原因
4. **统计分析**：成功率、耗时、token、成本
5. **前端展示**：可视化 Trace，便于排查问题

---

## 下一课预告

下一课是阶段实战：我们将综合运用阶段四的所有知识，构建一个完整的 AI 知识工作台 MVP。
