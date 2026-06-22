# 第6课：日志与 trace——请求、检索、工具、输出

> **课程定位**：实现可观测性
> **前置知识**：阶段一到三的基础
> **预计时长**：40 分钟

## 场景引入

用户反馈："AI 给我的回答完全不对，它说我上传的文档里没有相关内容，但我明明上传了。"你打开日志想排查问题，却发现日志里只记录了"请求成功，返回 200"。检索阶段返回了什么结果？prompt 里塞了哪些上下文？模型的原始输出是什么？后处理有没有改过回答？一概不知。传统应用的日志只需要记录请求和响应，但 AI 应用的链路长得多——检索、prompt 组装、模型调用、工具执行、后处理，任何一个环节都可能出问题。没有 trace，你就是在盲人摸象。

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
  await tracer.start('gpt-5.5')

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
    const response = await openai.responses.create({
      model: 'gpt-5.5',
      input: messages,
    })
    const duration = Date.now() - startTime
    await tracer.endStage('model_call', { response: response.output[0] })

    // 4. 后处理阶段
    await tracer.startStage('post_processing')
    const answer = response.output_text
    await tracer.endStage('post_processing', { answer })

    // 记录完成
    const tokenUsage = {
      prompt: response.usage?.input_tokens || 0,
      completion: response.usage?.output_tokens || 0,
      total: response.usage?.total_tokens || 0,
    }
    const cost = calculateCost('gpt-5.5', tokenUsage.prompt, tokenUsage.completion)

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

## 参考答案

### 练习一

**思路**：Tracer 类负责记录一次请求的完整链路。核心是生成唯一 traceId，在请求入口创建 trace 记录，每个阶段（检索、Prompt 组装、模型调用、后处理）通过 startStage/endStage 记录输入输出和耗时。

**答案**：

```typescript
// lib/logger/tracer.ts
import { prisma } from '../prisma'

interface TokenUsage {
  prompt: number
  completion: number
  total: number
}

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
      where: { traceId: this.traceId, name },
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

// 在聊天流程中使用
export async function chatWithTrace(
  userId: string,
  conversationId: string,
  message: string
) {
  const tracer = new Tracer(userId, conversationId)
  await tracer.start('gpt-5.5')

  try {
    await tracer.startStage('retrieval', { query: message })
    const searchResults = await retrieve(message, userId)
    await tracer.endStage('retrieval', { results: searchResults })

    await tracer.startStage('prompt_assembly')
    const messages = buildPrompt(message, searchResults)
    await tracer.endStage('prompt_assembly', { messages })

    await tracer.startStage('model_call', { messages })
    const response = await openai.responses.create({ model: 'gpt-5.5', input: messages })
    await tracer.endStage('model_call', { response: response.output[0] })

    await tracer.startStage('post_processing')
    const answer = response.output_text
    await tracer.endStage('post_processing', { answer })

    const tokenUsage = {
      prompt: response.usage?.input_tokens || 0,
      completion: response.usage?.output_tokens || 0,
      total: response.usage?.total_tokens || 0,
    }
    await tracer.end('success', tokenUsage)

    return answer
  } catch (error) {
    await tracer.end('error')
    throw error
  }
}
```

**要点**：
- traceId 必须贯穿全链路，通过闭包或 context 传递到每个阶段
- 每个 stage 记录 input 和 output，方便排查问题
- 常见错误：trace 写入放在请求关键路径上同步执行，拖慢对话响应——应该用异步写入或内存缓冲

### 练习二

**思路**：失败样本是最有价值的日志。通过查询 status='error' 的 trace，分析失败发生在哪个 stage（检索失败、模型超时、后处理错误），然后针对性改进。

**答案**：

```typescript
// lib/logger/queries.ts
import { prisma } from '../prisma'

export async function getTrace(traceId: string) {
  return prisma.trace.findUnique({
    where: { id: traceId },
    include: {
      stages: { orderBy: { startTime: 'asc' } },
    },
  })
}

export async function getFailedTraces(userId: string, limit: number = 20) {
  return prisma.trace.findMany({
    where: { userId, status: 'error' },
    orderBy: { startTime: 'desc' },
    take: limit,
    include: { stages: true },
  })
}

// 分析失败原因
export async function analyzeFailures(userId: string) {
  const failedTraces = await getFailedTraces(userId, 100)

  const failureReasons: Record<string, number> = {}

  for (const trace of failedTraces) {
    const failedStage = trace.stages.find(s => s.status === 'error')
    if (failedStage) {
      const reason = failedStage.name
      failureReasons[reason] = (failureReasons[reason] || 0) + 1
    }
  }

  return {
    total: failedTraces.length,
    byStage: failureReasons,
    samples: failedTraces.slice(0, 5),
  }
}
```

**要点**：
- 失败 trace 才是最有价值的——它们暴露了系统薄弱环节
- 分析时关注失败发生在哪个 stage：检索失败说明向量数据库有问题，模型超时说明 API 不稳定
- 常见错误：只记录成功请求，忽略失败请求——失败样本是 prompt 优化和检索策略改进的依据

### 练习三

**思路**：统计分析关注三个核心指标：成功率（质量）、P95 延迟（性能）、平均成本（预算）。通过 Prisma 的 aggregate 和 groupBy 按时间段和模型分组统计。

**答案**：

```typescript
// lib/logger/stats.ts
import { prisma } from '../prisma'

export async function getTraceStats(userId: string, period: string = 'month') {
  const now = new Date()
  let startDate: Date

  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  // 总体统计
  const stats = await prisma.trace.aggregate({
    where: { userId, startTime: { gte: startDate } },
    _count: true,
    _avg: { duration: true, totalTokens: true, cost: true },
    _sum: { totalTokens: true, cost: true },
  })

  // 按状态分组（计算成功率）
  const byStatus = await prisma.trace.groupBy({
    by: ['status'],
    where: { userId, startTime: { gte: startDate } },
    _count: true,
  })

  // 按模型分组
  const byModel = await prisma.trace.groupBy({
    by: ['model'],
    where: { userId, startTime: { gte: startDate } },
    _count: true,
    _sum: { totalTokens: true, cost: true },
  })

  const successCount = byStatus.find(s => s.status === 'success')?._count || 0
  const totalCount = stats._count || 1
  const successRate = successCount / totalCount

  return {
    total: stats._count,
    successRate,
    avgDuration: stats._avg.duration,
    avgTokens: stats._avg.totalTokens,
    totalTokens: stats._sum.totalTokens,
    totalCost: stats._sum.cost,
    byStatus,
    byModel,
  }
}
```

**要点**：
- 三个核心指标：成功率（目标 > 99%）、P95 延迟（目标 < 5 秒）、平均成本（用于预算预警）
- 按模型分组统计可以发现哪个模型的成本最高、失败率最高
- 常见错误：统计了数据但从不做趋势分析——需要定期查看错误率是否在上升、成本是否在合理范围内

---

## 常见误区

1. **把所有日志都写进数据库**：每条日志都 INSERT 到 PostgreSQL，高频场景下数据库会成为瓶颈。结构化的 trace 数据适合存数据库，但原始日志应该写文件或发到日志服务（如 Loki、CloudWatch），用采样策略控制写入量。
2. **记录了日志但不分析**：日志写了一堆，但没有查询入口和分析面板，等于白记。必须配套建设查询 API 和前端 Trace Viewer，让开发者能快速定位问题。
3. **Trace 记录阻塞主流程**：在请求的关键路径上同步写 trace 到数据库，拖慢了对话响应速度。trace 写入应该是异步的，用内存缓冲 + 批量写入的方式。
4. **只记录成功请求，忽略失败请求**：失败的 trace 才是最有价值的——它们暴露了系统的薄弱环节。必须确保失败样本被完整记录，包括错误信息、输入数据和各阶段状态。

---

## 工程建议

1. **Trace ID 贯穿全链路**：在请求入口生成 traceId，通过闭包或 context 传递到每个阶段。所有日志都带上这个 traceId，排查问题时可以一键拉出完整链路。
2. **按阶段记录 input/output**：每个 stage 记录输入和输出（检索阶段记录 query 和 results，模型阶段记录 messages 和 response）。输出可能很大，用截断策略（如只保留前 1000 字符）控制存储量。
3. **失败样本自动收集**：设置一个失败样本池，当 trace status 为 error 时自动入库。定期（如每周）review 失败样本，分类标注原因（检索失败、模型幻觉、超时等），作为 prompt 优化和检索策略改进的依据。
4. **统计面板关注三个核心指标**：成功率（目标 > 99%）、P95 延迟（目标 < 5 秒）、平均成本（用于预算预警）。这三个指标覆盖了质量、性能、成本三个维度，是 AI 应用健康度的核心度量。

---

## 小结

本课的核心要点：

1. **Trace 结构**：请求 → 各阶段 → 响应的完整链路
2. **阶段记录**：检索、Prompt 组装、模型调用、后处理
3. **失败分析**：收集失败样本，分析原因
4. **统计分析**：成功率、耗时、token、成本
5. **前端展示**：可视化 Trace，便于排查问题

---

**下一课**: [第7课：阶段实战——AI 知识工作台 MVP](./07-阶段实战-AI知识工作台MVP.md)
