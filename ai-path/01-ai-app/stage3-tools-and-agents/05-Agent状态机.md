# 第5课：Agent 状态机——pending、running、blocked、done、failed

> **课程定位**：设计可靠的 Agent 任务状态
> **前置知识**：第 4 课的多步骤任务
> **预计时长**：40 分钟

---

## 场景引入

你上线了一个 AI 研究助手，用户提交了一个研究任务，Agent 正在调用搜索工具获取资料。这时候用户关闭了浏览器，十分钟后重新打开页面——他看到的是什么？如果没有任何状态管理，他只能看到一片空白，之前的搜索结果全丢了。更糟糕的情况是：Agent 正在执行一个发送邮件的工具，用户想取消但系统没有"取消中"这个状态，Agent 继续执行了用户不想要的操作。Agent 状态机要解决的就是这个问题：让 Agent 的每一步都可追踪、可暂停、可恢复、可取消。

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
  messages: ResponseInputMessage[]
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
      messages: [
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
    messages: JSON.parse(row.messages),
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

## 参考答案

### 练习一：实现状态机

**思路**：状态机的核心是用转换表定义合法路径，所有状态变更都通过校验函数。非法转换必须抛错或返回失败，防止状态混乱。

**答案**：

```typescript
// 1. 定义五种状态和转换规则
enum AgentStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  BLOCKED = 'blocked',
  DONE = 'done',
  FAILED = 'failed',
}

const VALID_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  [AgentStatus.PENDING]: [AgentStatus.RUNNING, AgentStatus.FAILED],
  [AgentStatus.RUNNING]: [AgentStatus.BLOCKED, AgentStatus.DONE, AgentStatus.FAILED],
  [AgentStatus.BLOCKED]: [AgentStatus.RUNNING, AgentStatus.FAILED],
  [AgentStatus.DONE]: [],     // 终态，不可转换
  [AgentStatus.FAILED]: [],   // 终态，不可转换
}

// 2. 实现状态转换函数
function canTransition(from: AgentStatus, to: AgentStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

class AgentStateMachine {
  private status: AgentStatus = AgentStatus.PENDING
  private history: { from: AgentStatus; to: AgentStatus; at: Date }[] = []

  getStatus(): AgentStatus {
    return this.status
  }

  transition(to: AgentStatus): void {
    if (!canTransition(this.status, to)) {
      throw new Error(`非法状态转换: ${this.status} → ${to}`)
    }
    this.history.push({ from: this.status, to, at: new Date() })
    this.status = to
  }

  getHistory() {
    return [...this.history]
  }
}

// 3. 测试非法转换
function testTransitions() {
  const agent = new AgentStateMachine()
  console.log('初始状态:', agent.getStatus()) // pending

  // 合法转换
  agent.transition(AgentStatus.RUNNING)
  console.log('启动后:', agent.getStatus()) // running

  agent.transition(AgentStatus.BLOCKED)
  console.log('阻塞后:', agent.getStatus()) // blocked

  agent.transition(AgentStatus.RUNNING)
  console.log('恢复后:', agent.getStatus()) // running

  agent.transition(AgentStatus.DONE)
  console.log('完成后:', agent.getStatus()) // done

  // 测试非法转换
  try {
    agent.transition(AgentStatus.RUNNING) // DONE → RUNNING 非法
  } catch (e) {
    console.log('捕获非法转换:', (e as Error).message)
    // 输出: 非法状态转换: done → running
  }

  // 测试终态不可转换
  const agent2 = new AgentStateMachine()
  agent2.transition(AgentStatus.RUNNING)
  agent2.transition(AgentStatus.FAILED)
  console.log('失败后:', agent2.getStatus()) // failed

  try {
    agent2.transition(AgentStatus.PENDING) // FAILED → PENDING 非法
  } catch (e) {
    console.log('捕获非法转换:', (e as Error).message)
  }

  // 查看转换历史
  console.log('转换历史:', agent.getHistory())
}

testTransitions()
```

**要点**：
- `VALID_TRANSITIONS` 映射表是状态机的核心——所有校验逻辑都基于这张表，新增状态只需改表
- DONE 和 FAILED 是终态，没有出边，这意味着一旦完成或失败就不能再改变状态
- 转换历史（history）是调试利器，可以追溯 Agent 经历了哪些状态变化
- 常见错误：直接 `this.status = newStatus` 而不校验——从 DONE 直接跳到 RUNNING 会导致已完成的任务被重复执行

### 练习二：实现阻塞和恢复

**思路**：阻塞的本质是 Agent 进入等待状态，暂停执行循环。恢复时需要把用户的新输入加入消息历史，然后重新启动执行循环。

**答案**：

```typescript
import OpenAI from 'openai'
import { toolRegistry } from './tool-registry'

const openai = new OpenAI()

// 1. 创建需要确认的工具
const DeleteRecordSchema = z.object({
  table: z.string().describe('表名'),
  record_id: z.string().describe('记录 ID'),
  reason: z.string().optional().describe('删除原因'),
})

toolRegistry.register({
  name: 'delete_record',
  description: '删除数据库记录。这是一个高风险操作，删除后无法恢复。',
  schema: DeleteRecordSchema,
  requiresConfirmation: true,
  handler: async (args) => {
    // 实际删除逻辑
    return {
      success: true,
      data: { deleted_id: args.record_id, table: args.table },
    }
  },
})

// 2. 实现支持阻塞和恢复的 Agent
class AgentWithBlocking {
  private state = {
    id: `agent-${Date.now()}`,
    status: AgentStatus.PENDING,
    messages: [] as any[],
    steps: [] as any[],
    blockedReason: '',
    result: '',
    error: '',
  }

  private maxSteps = 10

  constructor(private task: string) {
    this.state.messages = [
      { role: 'system', content: '你是一个能使用工具完成任务的助手。' },
      { role: 'user', content: task },
    ]
  }

  getStatus() { return this.state.status }

  async run(): Promise<void> {
    if (this.state.status !== AgentStatus.PENDING && this.state.status !== AgentStatus.RUNNING) {
      throw new Error(`无法从 ${this.state.status} 状态启动`)
    }

    this.state.status = AgentStatus.RUNNING

    for (let i = 0; i < this.maxSteps; i++) {
      if (this.state.status !== AgentStatus.RUNNING) break

      const response = await openai.responses.create({
        model: 'gpt-5.5',
        input: this.state.messages,
        tools: toolRegistry.getToolSchemas(),
        tool_choice: 'auto',
      })

      const toolCalls = response.output.filter((item) => item.type === 'function_call')

      if (toolCalls.length === 0) {
        this.state.result = response.output_text || ''
        this.state.status = AgentStatus.DONE
        return
      }

      this.state.messages.push(...response.output)

      for (const toolCall of toolCalls) {
        const tool = toolRegistry.get(toolCall.name)
        const args = JSON.parse(toolCall.arguments)

        // 检查是否需要确认
        if (tool?.requiresConfirmation) {
          this.state.status = AgentStatus.BLOCKED
          this.state.blockedReason = `需要确认：${tool.confirmationMessage?.(args) || `确定要执行 ${toolCall.name} 吗？`}`

          // 保存待执行的工具调用信息
          this.state.pendingToolCall = { callId: toolCall.call_id, name: toolCall.name, args }
          return // 暂停执行，等待用户确认
        }

        const result = await toolRegistry.execute(toolCall.name, args)
        this.state.messages.push({
          type: 'function_call_output',
          call_id: toolCall.call_id,
          output: JSON.stringify(result),
        })
      }
    }

    this.state.error = '达到最大执行步数'
    this.state.status = AgentStatus.FAILED
  }

  // 3. 用户确认后恢复执行
  async resume(confirmed: boolean, modifiedArgs?: any): Promise<void> {
    if (this.state.status !== AgentStatus.BLOCKED) {
      throw new Error('Agent 未处于阻塞状态')
    }

    const pending = this.state.pendingToolCall
    if (!pending) throw new Error('没有待确认的工具调用')

    if (!confirmed) {
      // 用户取消
      this.state.messages.push({
        type: 'function_call_output',
        call_id: pending.callId,
        output: JSON.stringify({ success: false, error: '用户取消了此操作' }),
      })
    } else {
      // 用户确认，执行工具
      const args = modifiedArgs || pending.args
      const result = await toolRegistry.execute(pending.name, args)
      this.state.messages.push({
        type: 'function_call_output',
        call_id: pending.callId,
        output: JSON.stringify(result),
      })
    }

    this.state.pendingToolCall = undefined
    this.state.status = AgentStatus.RUNNING
    await this.run() // 继续执行循环
  }
}

// 使用示例
const agent = new AgentWithBlocking('删除 ID 为 123 的过期订单记录')
await agent.run()

if (agent.getStatus() === AgentStatus.BLOCKED) {
  console.log('Agent 被阻塞:', agent.state.blockedReason)
  // "需要确认：确定要删除记录吗？"

  // 用户确认后恢复
  await agent.resume(true)
  console.log('最终状态:', agent.getStatus()) // done
}
```

**要点**：
- 阻塞时要保存待执行的工具调用信息（callId、name、args），恢复时才能继续执行
- 用户取消时也要把结果（error）返回给模型，模型才知道操作被取消了
- resume() 恢复后重新调用 run()，执行循环从上次中断处继续
- 常见错误：阻塞状态没有超时机制——用户如果一直不操作，Agent 永远停在 BLOCKED 状态。生产环境必须加超时自动转 FAILED

### 练习三：状态持久化

**思路**：持久化的关键是把 Agent 的完整状态（status、messages、steps、result）序列化到数据库。恢复时反序列化重建 Agent 对象，使其能从中断处继续执行。

**答案**：

```typescript
import { pool } from './db'

// 1. 实现 Agent 状态存储
async function saveAgentState(agent: AgentWithBlocking): Promise<void> {
  const state = agent.getState()

  await pool.query(
    `INSERT INTO agents (id, status, task, messages, steps, blocked_reason, pending_tool_call, result, error, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       status = $2, messages = $4, steps = $5, blocked_reason = $6,
       pending_tool_call = $7, result = $8, error = $9, updated_at = $11`,
    [
      state.id,
      state.status,
      state.task,
      JSON.stringify(state.messages),
      JSON.stringify(state.steps),
      state.blockedReason,
      state.pendingToolCall ? JSON.stringify(state.pendingToolCall) : null,
      state.result,
      state.error,
      state.createdAt,
      new Date(),
    ],
  )
}

// 2. 实现状态恢复
async function loadAgentState(agentId: string): Promise<AgentWithBlocking | null> {
  const result = await pool.query('SELECT * FROM agents WHERE id = $1', [agentId])

  if (result.rows.length === 0) return null

  const row = result.rows[0]
  const agent = new AgentWithBlocking(row.task)

  // 恢复内部状态
  agent.restoreState({
    id: row.id,
    status: row.status,
    task: row.task,
    messages: JSON.parse(row.messages),
    steps: JSON.parse(row.steps),
    blockedReason: row.blocked_reason || '',
    pendingToolCall: row.pending_tool_call ? JSON.parse(row.pending_tool_call) : undefined,
    result: row.result || '',
    error: row.error || '',
  })

  return agent
}

// 3. 测试崩溃恢复
async function testCrashRecovery() {
  // 创建并启动 Agent
  const agent = new AgentWithBlocking('帮我查询明天的会议安排并发送提醒邮件')
  await agent.run()

  // 模拟：Agent 在 BLOCKED 状态时进程崩溃
  console.log('崩溃前状态:', agent.getStatus()) // blocked
  await saveAgentState(agent)
  console.log('状态已持久化')

  // 模拟：进程重启后恢复 Agent
  const restored = await loadAgentState(agent.id)
  if (!restored) {
    console.log('未找到 Agent 状态')
    return
  }

  console.log('恢复后状态:', restored.getStatus()) // blocked
  console.log('阻塞原因:', restored.state.blockedReason)

  // 继续执行
  if (restored.getStatus() === AgentStatus.BLOCKED) {
    await restored.resume(true) // 用户确认
    console.log('恢复执行后状态:', restored.getStatus()) // done
    console.log('最终结果:', restored.state.result)
  }
}

testCrashRecovery()
```

**要点**：
- 用 `ON CONFLICT DO UPDATE`（upsert）模式，每个 Agent 只保留最新状态，避免数据膨胀
- 必须持久化 messages 和 steps 的完整数组，不能只存最终结果——否则恢复后无法继续执行
- BLOCKED 状态要额外保存 pendingToolCall（待确认的工具调用信息），否则恢复后不知道要执行什么
- 常见错误：只存 status 和 result——崩溃恢复后 Agent 状态是 DONE，但用户看不到之前的执行步骤，也无法在 BLOCKED 状态继续

---

## 常见误区

1. **状态转换不加校验**：直接 `state.status = newStatus` 而不检查当前状态是否允许转到目标状态。比如从 DONE 直接转到 RUNNING，或者从 FAILED 转到 PENDING，这些非法转换会导致状态混乱。必须用 `canTransition()` 校验。
2. **DONE 和 FAILED 之后没有清理逻辑**：终态不是终点。Agent 完成后需要释放资源（关闭数据库连接、清理临时文件）、通知用户、记录日志。在 `updateStatus` 中为终态注册回调。
3. **阻塞状态没有超时机制**：Agent 进入 BLOCKED 等待用户确认，但用户一直不操作，Agent 就永远停在那里。必须设置超时（如 60 秒），超时后自动转为 FAILED 或执行默认操作。
4. **持久化时只存最终结果**：如果只存 status 和 result，崩溃恢复后用户看不到之前执行到哪一步。要持久化完整的 messages 和 steps 数组，才能恢复到中断前的状态继续执行。

---

## 工程建议

1. **用状态转换表驱动逻辑**：把所有合法转换定义在一个 `VALID_TRANSITIONS` 映射表中，校验和执行都基于这张表。新增状态时只需修改表，不用改散落在各处的 if-else。
2. **给每个终态注册 onEnter 回调**：DONE 时发送通知、清理资源、更新统计数据；FAILED 时记录错误详情、发送告警、尝试自动恢复。回调集中管理，避免遗漏。
3. **持久化用 upsert 模式**：Agent 状态频繁更新，每次状态变化都 insert 一条记录会导致数据膨胀。用 `ON CONFLICT DO UPDATE` 的 upsert 模式，每个 Agent 只保留最新状态。
4. **状态变化要发事件**：通过 EventEmitter 或消息队列广播状态变化事件，让前端、日志系统、监控系统都能实时感知。不要让状态变化静默发生。

---

## 小结

本课的核心要点：

1. **五种状态**：pending、running、blocked、done、failed
2. **状态转换**：明确定义合法的转换路径
3. **阻塞与恢复**：高风险操作需要用户确认
4. **状态持久化**：支持崩溃恢复
5. **前端展示**：让用户知道 Agent 在做什么

---

**下一课**: [第6课：人工确认——高风险工具的确认流程](./06-人工确认流程.md)
