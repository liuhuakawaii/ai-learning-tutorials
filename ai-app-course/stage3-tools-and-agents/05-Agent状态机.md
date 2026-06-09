# 第5课：Agent 状态机——pending、running、blocked、done、failed

> **课程定位**：设计可靠的 Agent 任务状态
> **前置知识**：第 4 课的多步骤任务
> **预计时长**：40 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 设计 Agent 的状态机
2. 实现状态转换逻辑
3. 处理阻塞和等待状态
4. 持久化 Agent 状态

---

## 一、为什么需要状态机

### 1.1 Agent 任务的复杂性

```
一个 Agent 任务可能的状态：

  刚创建 → 等待执行
  执行中 → 正在调用工具
  等待确认 → 需要用户批准
  完成 → 任务成功
  失败 → 任务出错
  取消 → 用户取消

  如果不用状态机，状态会混乱。
```

### 1.2 状态机的价值

```
┌─────────────────────────────────────────────────────────────────┐
│                    状态机的价值                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ 状态清晰                                                     │
│     每个时刻，Agent 处于且仅处于一个状态                          │
│                                                                 │
│  ✅ 转换明确                                                     │
│     什么条件下从 A 状态转到 B 状态，完全定义                      │
│                                                                 │
│  ✅ 可恢复                                                       │
│     状态可以持久化，崩溃后可以恢复                                │
│                                                                 │
│  ✅ 可观测                                                       │
│     前端可以展示当前状态，用户知道 Agent 在做什么                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、状态定义

### 2.1 五种核心状态

```typescript
enum AgentStatus {
  // 等待执行
  PENDING = 'pending',

  // 正在执行
  RUNNING = 'running',

  // 等待外部输入（用户确认、工具返回等）
  BLOCKED = 'blocked',

  // 任务完成
  DONE = 'done',

  // 任务失败
  FAILED = 'failed',
}
```

### 2.2 状态转换图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent 状态转换                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐     start      ┌─────────┐                        │
│  │ PENDING │ ──────────────→ │ RUNNING │                        │
│  └─────────┘                 └────┬────┘                        │
│                                   │                             │
│                      ┌────────────┼────────────┐                │
│                      │            │            │                │
│                      ▼            ▼            ▼                │
│                ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│                │ BLOCKED │  │  DONE   │  │ FAILED  │           │
│                └────┬────┘  └─────────┘  └─────────┘           │
│                     │                                           │
│                     │ resume                                    │
│                     ▼                                           │
│                ┌─────────┐                                      │
│                │ RUNNING │                                      │
│                └─────────┘                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 状态转换规则

```typescript
const VALID_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  [AgentStatus.PENDING]: [AgentStatus.RUNNING, AgentStatus.FAILED],
  [AgentStatus.RUNNING]: [AgentStatus.BLOCKED, AgentStatus.DONE, AgentStatus.FAILED],
  [AgentStatus.BLOCKED]: [AgentStatus.RUNNING, AgentStatus.FAILED],
  [AgentStatus.DONE]: [],  // 终态
  [AgentStatus.FAILED]: [],  // 终态
}

function canTransition(from: AgentStatus, to: AgentStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}
```

---

## 三、Agent 实现

### 3.1 Agent 类

```typescript
// lib/agent.ts
import OpenAI from 'openai'
import { toolRegistry } from './tool-registry'

const openai = new OpenAI()

interface AgentStep {
  id: string
  thought?: string
  toolCall?: { name: string; args: any }
  toolResult?: any
  status: 'pending' | 'running' | 'done' | 'failed'
}

interface AgentState {
  id: string
  status: AgentStatus
  task: string
  input: ResponseInputMessage[]
  steps: AgentStep[]
  result?: string
  error?: string
  createdAt: Date
  updatedAt: Date
}

export class Agent {
  private state: AgentState
  private maxSteps = 10

  constructor(task: string) {
    this.state = {
      id: `agent-${Date.now()}`,
      status: AgentStatus.PENDING,
      task,
      input: [
        {
          role: 'system',
          content: '你是一个能使用工具完成任务的助手。',
        },
        { role: 'user', content: task },
      ],
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  getStatus(): AgentStatus {
    return this.state.status
  }

  getState(): AgentState {
    return { ...this.state }
  }

  async run(): Promise<void> {
    if (this.state.status !== AgentStatus.PENDING) {
      throw new Error('Agent is not in PENDING state')
    }

    this.updateStatus(AgentStatus.RUNNING)

    try {
      for (let i = 0; i < this.maxSteps; i++) {
        // 检查是否被中断
        if (this.state.status !== AgentStatus.RUNNING) {
          break
        }

        // 调用模型
        const response = await openai.responses.create({
          model: 'gpt-5.5',
          input: this.state.messages,
          tools: toolRegistry.getToolSchemas(),
          tool_choice: 'auto',
        })

        const toolCalls = response.output.filter((item) => item.type === 'function_call')

        // 如果没有工具调用，任务完成
        if (toolCalls.length === 0) {
          this.state.result = response.output_text || ''
          this.updateStatus(AgentStatus.DONE)
          return
        }

        // 执行工具调用
        this.state.messages.push(...response.output)

        for (const toolCall of toolCalls) {
          const step: AgentStep = {
            id: `step-${this.state.steps.length}`,
            toolCall: {
              name: toolCall.name,
              args: JSON.parse(toolCall.arguments),
            },
            status: 'running',
          }
          this.state.steps.push(step)

          // 执行工具
          const result = await toolRegistry.execute(
            toolCall.name,
            step.toolCall.args
          )

          step.toolResult = result
          step.status = result.success ? 'done' : 'failed'

          // 把结果加入消息
          this.state.messages.push({
            type: 'function_call_output',
            call_id: toolCall.call_id,
            output: JSON.stringify(result),
          })
        }

        this.state.updatedAt = new Date()
      }

      // 达到最大步数
      this.state.error = '达到最大执行步数'
      this.updateStatus(AgentStatus.FAILED)

    } catch (error) {
      this.state.error = String(error)
      this.updateStatus(AgentStatus.FAILED)
    }
  }

  private updateStatus(status: AgentStatus) {
    if (!canTransition(this.state.status, status)) {
      throw new Error(`Invalid transition: ${this.state.status} -> ${status}`)
    }
    this.state.status = status
    this.state.updatedAt = new Date()
  }
}
```

---

## 四、阻塞与恢复

### 4.1 需要阻塞的场景

```
需要阻塞等待用户确认：

  1. 高风险操作
     - 发送邮件
     - 删除数据
     - 支付操作

  2. 需要额外信息
     - 用户的密码
     - 选择哪个选项
     - 确认操作

  3. 等待外部事件
     - 等待用户上传文件
     - 等待审批通过
     - 等待定时任务
```

### 4.2 实现阻塞

```typescript
// 在 Agent 类中添加
async block(reason: string): Promise<void> {
  if (this.state.status !== AgentStatus.RUNNING) {
    throw new Error('Agent is not running')
  }

  this.state.blockedReason = reason
  this.updateStatus(AgentStatus.BLOCKED)
}

async resume(userInput?: string): Promise<void> {
  if (this.state.status !== AgentStatus.BLOCKED) {
    throw new Error('Agent is not blocked')
  }

  if (userInput) {
    this.state.messages.push({
      role: 'user',
      content: userInput,
    })
  }

  this.updateStatus(AgentStatus.RUNNING)
  await this.run()
}
```

### 4.3 需要确认的工具

```typescript
// 注册需要确认的工具
toolRegistry.register({
  name: 'send_email',
  description: '发送邮件',
  schema: EmailSchema,
  requiresConfirmation: true,  // 标记需要确认
  handler: async (args) => {
    // 实际发送逻辑
  },
})

// 在执行工具前检查
async function executeToolWithConfirmation(
  agent: Agent,
  toolName: string,
  args: any
) {
  const tool = toolRegistry.get(toolName)

  if (tool.requiresConfirmation) {
    await agent.block(`需要确认：调用 ${toolName}`)
    // 等待用户确认后继续
    return
  }

  return await toolRegistry.execute(toolName, args)
}
```

---

## 五、状态持久化

### 5.1 数据库存储

```typescript
// lib/agent-store.ts
import { pool } from './db'

interface StoredAgent {
  id: string
  status: AgentStatus
  task: string
  input: string  // JSON
  steps: string     // JSON
  result?: string
  error?: string
  created_at: Date
  updated_at: Date
}

export async function saveAgentState(agent: Agent): Promise<void> {
  const state = agent.getState()

  await pool.query(
    `INSERT INTO agents (id, status, task, messages, steps, result, error, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       status = $2, messages = $4, steps = $5, result = $6, error = $7, updated_at = $9`,
    [
      state.id,
      state.status,
      state.task,
      JSON.stringify(state.messages),
      JSON.stringify(state.steps),
      state.result,
      state.error,
      state.createdAt,
      state.updatedAt,
    ]
  )
}

export async function loadAgentState(id: string): Promise<Agent | null> {
  const result = await pool.query(
    'SELECT * FROM agents WHERE id = $1',
    [id]
  )

  if (result.rows.length === 0) return null

  const row = result.rows[0]
  const agent = new Agent(row.task)

  // 恢复状态
  agent.restoreState({
    id: row.id,
    status: row.status,
    task: row.task,
    input: JSON.parse(row.messages),
    steps: JSON.parse(row.steps),
    result: row.result,
    error: row.error,
  })

  return agent
}
```

---

## 六、前端状态展示

```typescript
// components/AgentStatus.tsx
'use client'

interface AgentStep {
  id: string
  thought?: string
  toolCall?: { name: string; args: any }
  toolResult?: any
  status: string
}

interface Props {
  status: string
  steps: AgentStep[]
  result?: string
  error?: string
}

export function AgentStatus({ status, steps, result, error }: Props) {
  const statusLabels: Record<string, string> = {
    pending: '等待中',
    running: '执行中',
    blocked: '等待确认',
    done: '已完成',
    failed: '失败',
  }

  return (
    <div className="agent-status">
      <div className={`status-badge ${status}`}>
        {statusLabels[status] || status}
      </div>

      <div className="steps">
        {steps.map((step, i) => (
          <div key={step.id} className={`step ${step.status}`}>
            <span className="step-number">{i + 1}</span>
            {step.toolCall && (
              <span className="tool-name">{step.toolCall.name}</span>
            )}
            <span className="step-status">{step.status}</span>
          </div>
        ))}
      </div>

      {result && (
        <div className="result">
          <h4>结果</h4>
          <p>{result}</p>
        </div>
      )}

      {error && (
        <div className="error">
          <h4>错误</h4>
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}
```

---

## 动手练习

### 练习一：实现状态机

1. 定义五种状态和转换规则
2. 实现状态转换函数
3. 测试非法转换

### 练习二：实现阻塞和恢复

1. 创建一个需要确认的工具
2. 实现 Agent 阻塞
3. 用户确认后恢复执行

### 练习三：状态持久化

1. 实现 Agent 状态存储
2. 实现状态恢复
3. 测试崩溃恢复

---

## 小结

本课的核心要点：

1. **五种状态**：pending、running、blocked、done、failed
2. **状态转换**：明确定义合法的转换路径
3. **阻塞与恢复**：高风险操作需要用户确认
4. **状态持久化**：支持崩溃恢复
5. **前端展示**：让用户知道 Agent 在做什么

---

## 下一课预告

下一课我们将学习人工确认：如何设计高风险操作的确认流程。
