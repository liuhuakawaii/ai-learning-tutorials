# 第4课：Agent 工作流集成

> **课程定位**：在产品中集成 Agent 工作流，让 AI 能自主执行多步骤任务
> **前置知识**：了解 Agent 基本概念和工具调用
> **预计时长**：40 分钟

---

## 场景引入

你做了一个数据分析产品，用户上传一份 Excel 表格，问"帮我分析一下上个季度的销售趋势"。如果用普通 LLM，它只能根据你手动粘贴的数据片段给建议。但用户期望的是：AI 能自己读取数据、计算指标、生成图表、写出分析报告。这就是 Agent 工作流的价值——让 AI 不只是"回答问题"，而是"完成任务"。

---

## 学习目标

完成本课学习后，你将能够：

1. 在产品中设计和实现 Agent 工作流
2. 设计安全的工具（Tool）和权限控制
3. 实现 Agent 的状态管理和执行追踪
4. 处理 Agent 执行过程中的错误和超时

---

## 一、Agent 工作流的产品形态

### 1.1 Agent vs 普通 LLM 调用

```
普通 LLM 调用：
  用户输入 → Prompt → 模型回答 → 展示
  （一问一答，模型只能"说"，不能"做"）

Agent 工作流：
  用户输入 → 模型规划 → 调用工具 → 观察结果 → 继续规划 → ... → 最终回答
  （多步骤执行，模型可以"说"也可以"做"）
```

### 1.2 Agent 在产品中的典型场景

| 场景 | 用户输入 | Agent 执行步骤 |
|------|---------|---------------|
| 数据分析 | "分析销售趋势" | 读取文件 → 清洗数据 → 计算指标 → 生成图表 → 撰写报告 |
| 内容创作 | "写一篇竞品分析" | 搜索竞品 → 提取信息 → 对比分析 → 撰写文章 |
| 客户服务 | "帮我退货" | 查询订单 → 验证资格 → 创建工单 → 发送确认 |
| 代码审查 | "审查这个 PR" | 读取代码 → 分析变更 → 检查问题 → 写评论 |

---

## 二、Agent 工作流实现

### 2.1 工具定义

```typescript
// tools/definitions.ts
export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
    }>
    required: string[]
  }
  execute: (params: Record<string, unknown>, context: ExecutionContext) => Promise<ToolResult>
}

export interface ExecutionContext {
  userId: string
  sessionId: string
  abortSignal: AbortSignal
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

// 具体工具实现：文件读取
export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: '读取用户上传的文件内容，支持 CSV、JSON、TXT 格式',
  parameters: {
    type: 'object',
    properties: {
      fileId: { type: 'string', description: '文件 ID' },
      encoding: { type: 'string', description: '文件编码', enum: ['utf-8', 'gbk'] },
    },
    required: ['fileId'],
  },
  execute: async (params, context) => {
    const file = await db.file.findFirst({
      where: { id: params.fileId as string, userId: context.userId },
    })

    if (!file) {
      return { success: false, error: '文件不存在或无权限访问' }
    }

    const content = await storage.readFile(file.path)
    return {
      success: true,
      data: { content: content.toString(params.encoding as string ?? 'utf-8'), filename: file.name },
    }
  },
}

// 数据分析工具
export const analyzeDataTool: ToolDefinition = {
  name: 'analyze_data',
  description: '对数据进行统计分析，支持求和、平均、分组等操作',
  parameters: {
    type: 'object',
    properties: {
      data: { type: 'string', description: 'JSON 格式的数据' },
      operation: { type: 'string', description: '分析类型', enum: ['summary', 'group_by', 'trend'] },
      column: { type: 'string', description: '目标列名' },
    },
    required: ['data', 'operation'],
  },
  execute: async (params) => {
    try {
      const data = JSON.parse(params.data as string)
      const result = performAnalysis(data, params.operation as string, params.column as string)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: `分析失败: ${error.message}` }
    }
  },
}

// 图表生成工具
export const generateChartTool: ToolDefinition = {
  name: 'generate_chart',
  description: '根据数据生成图表，返回图表图片的 URL',
  parameters: {
    type: 'object',
    properties: {
      data: { type: 'string', description: 'JSON 格式的数据' },
      chartType: { type: 'string', description: '图表类型', enum: ['line', 'bar', 'pie', 'scatter'] },
      title: { type: 'string', description: '图表标题' },
      xLabel: { type: 'string', description: 'X 轴标签' },
      yLabel: { type: 'string', description: 'Y 轴标签' },
    },
    required: ['data', 'chartType', 'title'],
  },
  execute: async (params) => {
    const imageUrl = await chartService.generate({
      data: JSON.parse(params.data as string),
      type: params.chartType as string,
      title: params.title as string,
      xLabel: params.xLabel as string,
      yLabel: params.yLabel as string,
    })
    return { success: true, data: { imageUrl } }
  },
}
```

### 2.2 Agent 执行引擎

```typescript
// agent/executor.ts
export interface AgentStep {
  id: string
  type: 'thinking' | 'tool_call' | 'response'
  content: string
  toolName?: string
  toolParams?: Record<string, unknown>
  toolResult?: ToolResult
  status: 'pending' | 'running' | 'completed' | 'failed'
  timestamp: string
}

export class AgentExecutor {
  private tools: Map<string, ToolDefinition>
  private maxSteps = 10
  private stepTimeout = 30_000  // 每步 30 秒超时

  constructor(tools: ToolDefinition[]) {
    this.tools = new Map(tools.map(t => [t.name, t]))
  }

  async execute(
    task: string,
    context: ExecutionContext,
    options: { onStep?: (step: AgentStep) => void } = {}
  ): Promise<{ steps: AgentStep[]; result: string }> {
    const steps: AgentStep[] = []
    const messages: ChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user', content: task },
    ]

    for (let i = 0; i < this.maxSteps; i++) {
      if (context.abortSignal.aborted) {
        throw new Error('用户取消了任务')
      }

      // 调用模型，决定下一步
      const response = await modelRouter.chat(messages, { tier: 'default' })

      // 解析模型响应
      const parsed = this.parseResponse(response.content)

      if (parsed.type === 'response') {
        // 模型认为任务完成
        const step: AgentStep = {
          id: `step-${i}`,
          type: 'response',
          content: parsed.content,
          status: 'completed',
          timestamp: new Date().toISOString(),
        }
        steps.push(step)
        options.onStep?.(step)
        return { steps, result: parsed.content }
      }

      if (parsed.type === 'tool_call') {
        // 模型要调用工具
        const step: AgentStep = {
          id: `step-${i}`,
          type: 'tool_call',
          content: `调用工具: ${parsed.toolName}`,
          toolName: parsed.toolName,
          toolParams: parsed.toolParams,
          status: 'running',
          timestamp: new Date().toISOString(),
        }
        steps.push(step)
        options.onStep?.(step)

        // 执行工具
        const tool = this.tools.get(parsed.toolName)
        if (!tool) {
          step.status = 'failed'
          step.toolResult = { success: false, error: `工具 ${parsed.toolName} 不存在` }
        } else {
          try {
            const result = await Promise.race([
              tool.execute(parsed.toolParams, context),
              this.timeout(this.stepTimeout),
            ])
            step.toolResult = result
            step.status = 'completed'
          } catch (error) {
            step.toolResult = { success: false, error: String(error) }
            step.status = 'failed'
          }
        }

        options.onStep?.(step)

        // 将工具结果加入对话历史
        messages.push(
          { role: 'assistant', content: `我需要调用 ${parsed.toolName}` },
          { role: 'user', content: `工具返回结果: ${JSON.stringify(step.toolResult)}` }
        )
      }
    }

    throw new Error('Agent 达到最大步骤数限制')
  }

  private buildSystemPrompt(): string {
    const toolDescriptions = Array.from(this.tools.values())
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n')

    return `你是一个任务执行助手。你可以通过调用工具来完成用户的任务。

可用工具：
${toolDescriptions}

执行规则：
1. 先分析任务需要哪些步骤
2. 每次只调用一个工具，等待结果后再决定下一步
3. 如果工具返回错误，尝试修复或换一种方式
4. 任务完成后，用自然语言总结结果
5. 如果任务无法完成，明确告知原因

响应格式：
- 调用工具时：{"tool": "工具名", "params": {...}}
- 任务完成时：直接用自然语言回答`
  }

  private parseResponse(content: string): { type: 'tool_call' | 'response'; content: string; toolName?: string; toolParams?: Record<string, unknown> } {
    try {
      const parsed = JSON.parse(content)
      if (parsed.tool) {
        return { type: 'tool_call', content, toolName: parsed.tool, toolParams: parsed.params }
      }
    } catch {
      // 不是 JSON，视为自然语言回答
    }
    return { type: 'response', content }
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(`工具执行超时 (${ms}ms)`)), ms))
  }
}
```

### 2.3 前端状态展示

```typescript
// components/AgentRunner.tsx
'use client'

import { useState } from 'react'

interface AgentStep {
  id: string
  type: 'thinking' | 'tool_call' | 'response'
  content: string
  toolName?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  timestamp: string
}

export function AgentRunner({ task }: { task: string }) {
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [result, setResult] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const startExecution = async () => {
    setIsRunning(true)
    setSteps([])
    setResult(null)

    const response = await fetch('/api/agent/execute', {
      method: 'POST',
      body: JSON.stringify({ task }),
    })

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    while (reader) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const events = chunk.split('\n').filter(Boolean)

      for (const event of events) {
        const data = JSON.parse(event)
        if (data.type === 'step') {
          setSteps(prev => {
            const existing = prev.findIndex(s => s.id === data.step.id)
            if (existing >= 0) {
              const updated = [...prev]
              updated[existing] = data.step
              return updated
            }
            return [...prev, data.step]
          })
        } else if (data.type === 'result') {
          setResult(data.result)
        }
      }
    }

    setIsRunning(false)
  }

  return (
    <div className="agent-runner">
      <div className="agent-header">
        <h3>Agent 执行</h3>
        {!isRunning && !result && (
          <button onClick={startExecution}>开始执行</button>
        )}
        {isRunning && <span className="status">执行中...</span>}
      </div>

      <div className="agent-steps">
        {steps.map(step => (
          <div key={step.id} className={`step ${step.status}`}>
            <StepIcon type={step.type} status={step.status} />
            <div className="step-content">
              {step.type === 'tool_call' && (
                <div className="tool-info">
                  <span className="tool-name">{step.toolName}</span>
                  <span className={`tool-status ${step.status}`}>
                    {step.status === 'running' ? '执行中...' :
                     step.status === 'completed' ? '完成' : '失败'}
                  </span>
                </div>
              )}
              <p>{step.content}</p>
            </div>
          </div>
        ))}
      </div>

      {result && (
        <div className="agent-result">
          <h4>执行结果</h4>
          <div className="result-content">{result}</div>
        </div>
      )}
    </div>
  )
}
```

---

## 三、Agent 安全设计

### 3.1 权限控制

```typescript
// agent/permissions.ts
export interface AgentPermission {
  toolName: string
  allowed: boolean
  requiresApproval: boolean
  maxCallsPerSession: number
}

// 默认权限配置
const defaultPermissions: AgentPermission[] = [
  // 只读操作：自动执行
  { toolName: 'read_file', allowed: true, requiresApproval: false, maxCallsPerSession: 50 },
  { toolName: 'analyze_data', allowed: true, requiresApproval: false, maxCallsPerSession: 20 },
  { toolName: 'generate_chart', allowed: true, requiresApproval: false, maxCallsPerSession: 10 },

  // 写操作：需要确认
  { toolName: 'write_file', allowed: true, requiresApproval: true, maxCallsPerSession: 5 },
  { toolName: 'send_email', allowed: true, requiresApproval: true, maxCallsPerSession: 3 },

  // 危险操作：禁止
  { toolName: 'delete_file', allowed: false, requiresApproval: false, maxCallsPerSession: 0 },
]

export function checkPermission(
  toolName: string,
  callCount: number,
  permissions: AgentPermission[] = defaultPermissions
): { allowed: boolean; requiresApproval: boolean; reason?: string } {
  const perm = permissions.find(p => p.toolName === toolName)

  if (!perm) {
    return { allowed: false, requiresApproval: false, reason: `未知工具: ${toolName}` }
  }

  if (!perm.allowed) {
    return { allowed: false, requiresApproval: false, reason: `工具 ${toolName} 已被禁用` }
  }

  if (callCount >= perm.maxCallsPerSession) {
    return { allowed: false, requiresApproval: false, reason: `工具 ${toolName} 已达到调用上限` }
  }

  return { allowed: true, requiresApproval: perm.requiresApproval }
}
```

### 3.2 人工确认流程

```typescript
// agent/approval.ts
export class ApprovalManager {
  private pendingApprovals: Map<string, {
    resolve: (approved: boolean) => void
    toolName: string
    params: Record<string, unknown>
    timeout: NodeJS.Timeout
  }> = new Map()

  // 请求用户确认
  async requestApproval(
    sessionId: string,
    toolName: string,
    params: Record<string, unknown>,
    timeoutMs = 60_000
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const approvalId = `${sessionId}-${Date.now()}`

      const timeout = setTimeout(() => {
        this.pendingApprovals.delete(approvalId)
        resolve(false)  // 超时默认拒绝
      }, timeoutMs)

      this.pendingApprovals.set(approvalId, { resolve, toolName, params, timeout })

      // 通过 WebSocket 或 SSE 通知前端
      notifyClient(sessionId, {
        type: 'approval_required',
        approvalId,
        toolName,
        params,
      })
    })
  }

  // 用户响应确认
  respondToApproval(approvalId: string, approved: boolean) {
    const pending = this.pendingApprovals.get(approvalId)
    if (pending) {
      clearTimeout(pending.timeout)
      pending.resolve(approved)
      this.pendingApprovals.delete(approvalId)
    }
  }
}
```

---

## 四、错误处理与超时

```typescript
// agent/error-handling.ts
export class AgentErrorHandler {
  // 工具执行失败时的处理策略
  static handleToolError(error: ToolResult, step: AgentStep): {
    action: 'retry' | 'skip' | 'abort' | 'fallback'
    message: string
  } {
    const errorType = this.classifyError(error.error ?? '')

    switch (errorType) {
      case 'timeout':
        return { action: 'retry', message: '工具执行超时，正在重试...' }

      case 'permission':
        return { action: 'abort', message: '权限不足，无法继续执行' }

      case 'not_found':
        return { action: 'skip', message: '资源不存在，跳过此步骤' }

      case 'rate_limit':
        return { action: 'fallback', message: '请求过于频繁，切换到备用方案' }

      default:
        return { action: 'skip', message: `工具执行失败: ${error.error}，继续下一步` }
    }
  }

  private static classifyError(error: string): string {
    if (error.includes('超时') || error.includes('timeout')) return 'timeout'
    if (error.includes('权限') || error.includes('permission')) return 'permission'
    if (error.includes('不存在') || error.includes('not found')) return 'not_found'
    if (error.includes('限流') || error.includes('rate limit')) return 'rate_limit'
    return 'unknown'
  }
}
```

---

## 常见误区

### 误区一：Agent 可以完全自主执行

Agent 需要人工确认点。涉及外部操作（发邮件、写文件、花钱）的步骤必须让用户确认。没有确认机制的 Agent 等于把方向盘交给了一个你无法控制的司机。

### 误区二：工具越多越好

工具太多会让模型"选择困难"，增加出错概率。一个 Agent 的工具集应该控制在 5-10 个以内，每个工具的职责要单一明确。

### 误区三：不需要限制执行步骤

没有步骤限制的 Agent 可能陷入死循环：调用工具 → 结果不对 → 再调用 → 还不对 → 无限循环。必须设置最大步骤数和单步超时。

### 误区四：Agent 的错误处理和普通 API 一样

Agent 的错误处理更复杂——工具调用失败时，需要让模型知道失败了并决定下一步，而不是直接中断整个流程。

---

## 工程建议

### 1. 工具设计遵循"最小权限"原则

每个工具只暴露完成任务所需的最小能力。文件读取工具不应该同时支持删除，数据分析工具不应该支持修改原始数据。

### 2. 实现 Agent 执行日志

记录每一步的输入、输出、耗时。这是调试 Agent 行为和优化 Prompt 的关键数据。

### 3. 为 Agent 设计"安全词"

允许用户随时中断 Agent 执行。在 UI 上提供"停止"按钮，后端通过 AbortSignal 传递取消信号。

### 4. 从简单场景开始

先在低风险场景（数据分析、内容生成）验证 Agent 工作流，再扩展到高风险场景（客户沟通、自动操作）。

---

## 小结

Agent 工作流让 AI 从"回答问题"进化为"完成任务"。核心组件是：工具定义、执行引擎、状态管理、权限控制。产品设计上需要关注人工确认流程、错误处理和执行超时。先从简单场景开始，逐步扩展 Agent 的能力边界。

---

## 练习

1. **工具定义**：为你的产品定义 3-5 个工具，包含参数 schema、描述和执行函数。
2. **Agent 执行引擎**：实现一个基础的 Agent 执行引擎，支持循环调用工具直到任务完成。
3. **权限系统**：为工具实现权限控制，区分"自动执行"和"需要确认"两种级别。
4. **前端展示**：实现 Agent 执行过程的前端展示组件，包含步骤列表和状态指示器。

---

## 参考答案

### 练习一

**思路**：为产品定义 3-5 个工具，每个工具需要包含：名称、描述、参数 schema（JSON Schema 格式）、执行函数。工具设计的核心原则是：描述要让 LLM 能正确理解何时使用，参数要明确类型和必填项。

**答案**：

以"数据分析产品"为例：

```typescript
// tools/definitions.ts
import { z } from 'zod'

export interface ToolDefinition {
  name: string
  description: string
  parameters: z.ZodSchema
  requiresConfirmation: boolean
  execute: (params: any, context: { userId: string; sessionId: string }) => Promise<any>
}

export const tools: ToolDefinition[] = [
  {
    name: 'read_spreadsheet',
    description: '读取用户上传的 Excel/CSV 文件，返回表格数据。用于分析前的数据加载步骤。',
    parameters: z.object({
      fileId: z.string().describe('文件 ID'),
      sheetName: z.string().optional().describe('工作表名称，默认读第一个'),
      maxRows: z.number().optional().describe('最多读取的行数，默认 1000'),
    }),
    requiresConfirmation: false,
    execute: async (params, context) => {
      const file = await db.file.findFirst({
        where: { id: params.fileId, userId: context.userId },
      })
      if (!file) return { error: '文件不存在' }

      const data = await parseSpreadsheet(file.path, {
        sheet: params.sheetName,
        maxRows: params.maxRows ?? 1000,
      })
      return { columns: data.headers, rows: data.rows, totalRows: data.rows.length }
    },
  },

  {
    name: 'analyze_column',
    description: '对指定列进行统计分析，支持求和、平均值、最大最小值、分布等。',
    parameters: z.object({
      data: z.string().describe('JSON 格式的数据数组'),
      column: z.string().describe('要分析的列名'),
      operation: z.enum(['sum', 'avg', 'min', 'max', 'distribution', 'count_nulls']).describe('分析类型'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      const rows = JSON.parse(params.data)
      const values = rows.map((r: any) => r[params.column]).filter(v => v != null)

      switch (params.operation) {
        case 'sum': return { result: values.reduce((a: number, b: number) => a + b, 0) }
        case 'avg': return { result: values.reduce((a: number, b: number) => a + b, 0) / values.length }
        case 'min': return { result: Math.min(...values) }
        case 'max': return { result: Math.max(...values) }
        case 'distribution': {
          const counts: Record<string, number> = {}
          values.forEach((v: any) => { counts[String(v)] = (counts[String(v)] || 0) + 1 })
          return { result: counts }
        }
        case 'count_nulls': return { result: rows.length - values.length }
      }
    },
  },

  {
    name: 'generate_chart',
    description: '根据数据生成可视化图表，返回图表图片 URL。',
    parameters: z.object({
      data: z.string().describe('JSON 格式的数据'),
      chartType: z.enum(['line', 'bar', 'pie', 'scatter']).describe('图表类型'),
      title: z.string().describe('图表标题'),
      xColumn: z.string().describe('X 轴对应的列名'),
      yColumn: z.string().describe('Y 轴对应的列名'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      const imageUrl = await chartService.generate({
        data: JSON.parse(params.data),
        type: params.chartType,
        title: params.title,
        x: params.xColumn,
        y: params.yColumn,
      })
      return { imageUrl }
    },
  },

  {
    name: 'export_report',
    description: '将分析结果导出为 PDF 或 Excel 报告。需要用户确认后执行。',
    parameters: z.object({
      title: z.string().describe('报告标题'),
      content: z.string().describe('报告内容（Markdown 格式）'),
      format: z.enum(['pdf', 'xlsx']).describe('导出格式'),
    }),
    requiresConfirmation: true,
    execute: async (params) => {
      const fileUrl = await reportService.generate({
        title: params.title,
        content: params.content,
        format: params.format,
      })
      return { downloadUrl: fileUrl }
    },
  },
]
```

**要点**：
- 工具描述要具体——"读取 Excel 文件"比"读取文件"好，LLM 能更准确地选择工具
- 区分 `requiresConfirmation`：读数据、计算等安全操作自动执行，导出文件等有副作用的操作需要确认
- 参数用 zod schema 定义，既能在开发时做类型检查，又能生成 JSON Schema 给 LLM

### 练习二

**思路**：实现一个循环调用工具的执行引擎。核心逻辑：调用 LLM → 解析是否要调工具 → 执行工具 → 把结果反馈给 LLM → 继续循环，直到 LLM 返回最终回答或达到步数上限。

**答案**：

```typescript
// lib/agent/executor.ts
import { modelRouter } from '../ai/model-router'

interface ToolDefinition {
  name: string
  description: string
  parameters: any
  execute: (params: any, context: any) => Promise<any>
}

interface AgentStep {
  stepNumber: number
  type: 'thinking' | 'tool_call' | 'final_answer'
  content: string
  toolName?: string
  toolParams?: any
  toolResult?: any
  status: 'success' | 'error'
}

export class AgentExecutor {
  private tools: Map<string, ToolDefinition>
  private maxSteps: number

  constructor(tools: ToolDefinition[], maxSteps = 10) {
    this.tools = new Map(tools.map(t => [t.name, t]))
    this.maxSteps = maxSteps
  }

  async execute(
    task: string,
    context: { userId: string; sessionId: string; abortSignal?: AbortSignal },
    onStep?: (step: AgentStep) => void
  ): Promise<{ steps: AgentStep[]; answer: string }> {
    const steps: AgentStep[] = []
    const messages: Array<{ role: string; content: string }> = [
      {
        role: 'system',
        content: `你是一个数据分析助手。你可以使用工具来完成用户的分析任务。

可用工具：
${Array.from(this.tools.values()).map(t =>
  `- ${t.name}: ${t.description}\n  参数: ${JSON.stringify(t.parameters)}`
).join('\n')}

当需要使用工具时，返回 JSON 格式：
{"tool": "工具名", "params": {...}}

当任务完成时，直接用自然语言回答用户。

重要：不要编造数据，所有数据必须来自工具调用结果。`,
      },
      { role: 'user', content: task },
    ]

    for (let i = 0; i < this.maxSteps; i++) {
      if (context.abortSignal?.aborted) {
        throw new Error('用户取消了任务')
      }

      // 调用 LLM
      const response = await modelRouter.chat(
        messages.map(m => ({ role: m.role as any, content: m.content })),
        'default'
      )
      const content = response.content

      // 尝试解析工具调用
      const toolCall = this.parseToolCall(content)

      if (!toolCall) {
        // 没有工具调用，视为最终回答
        const step: AgentStep = {
          stepNumber: i + 1,
          type: 'final_answer',
          content,
          status: 'success',
        }
        steps.push(step)
        onStep?.(step)
        return { steps, answer: content }
      }

      // 执行工具调用
      const tool = this.tools.get(toolCall.tool)
      const step: AgentStep = {
        stepNumber: i + 1,
        type: 'tool_call',
        content: `调用 ${toolCall.tool}`,
        toolName: toolCall.tool,
        toolParams: toolCall.params,
        status: 'success',
      }

      if (!tool) {
        step.status = 'error'
        step.toolResult = { error: `工具 ${toolCall.tool} 不存在` }
      } else {
        try {
          step.toolResult = await tool.execute(toolCall.params, context)
        } catch (error: any) {
          step.status = 'error'
          step.toolResult = { error: error.message }
        }
      }

      steps.push(step)
      onStep?.(step)

      // 把工具结果反馈给 LLM
      messages.push({ role: 'assistant', content })
      messages.push({
        role: 'user',
        content: `工具执行结果：\n${JSON.stringify(step.toolResult, null, 2)}`,
      })
    }

    // 达到步数上限
    return { steps, answer: '任务执行步骤过多，请尝试简化问题。' }
  }

  private parseToolCall(content: string): { tool: string; params: any } | null {
    // 尝试从 LLM 回复中提取 JSON 工具调用
    const jsonMatch = content.match(/\{[\s\S]*"tool"[\s\S]*"params"[\s\S]*\}/)
    if (!jsonMatch) return null
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.tool && parsed.params) return parsed
    } catch {}
    return null
  }
}
```

**要点**：
- Agent 执行引擎的核心是"LLM 决策 → 工具执行 → 结果反馈"的循环
- 必须有 `maxSteps` 限制，防止 LLM 陷入无限循环调用工具
- 工具执行失败时要把错误信息反馈给 LLM，让它决定下一步（而不是直接中断）

### 练习三

**思路**：为工具实现两级权限——"自动执行"（读数据、计算等安全操作）和"需要确认"（导出、发送等有副作用的操作）。确认流程通过前端弹窗实现。

**答案**：

```typescript
// lib/agent/permission.ts
export type PermissionLevel = 'auto' | 'confirm'

export interface ToolPermission {
  toolName: string
  level: PermissionLevel
  confirmMessage?: string
}

// 权限配置表
export const permissionConfig: ToolPermission[] = [
  { toolName: 'read_spreadsheet', level: 'auto' },
  { toolName: 'analyze_column', level: 'auto' },
  { toolName: 'generate_chart', level: 'auto' },
  { toolName: 'export_report', level: 'confirm', confirmMessage: '即将生成并下载报告文件，是否继续？' },
  { toolName: 'send_email', level: 'confirm', confirmMessage: '即将发送邮件给客户，是否确认？' },
]

export class PermissionChecker {
  private config: Map<string, ToolPermission>

  constructor(config: ToolPermission[]) {
    this.config = new Map(config.map(c => [c.toolName, c]))
  }

  check(toolName: string): { allowed: boolean; needsConfirmation: boolean; message?: string } {
    const permission = this.config.get(toolName)

    if (!permission) {
      return { allowed: false, needsConfirmation: false, message: `未配置的工具: ${toolName}` }
    }

    if (permission.level === 'auto') {
      return { allowed: true, needsConfirmation: false }
    }

    return {
      allowed: true,
      needsConfirmation: true,
      message: permission.confirmMessage ?? `确认执行 ${toolName}？`,
    }
  }
}

// 在 AgentExecutor 中集成权限检查：
// 执行工具前调用 permissionChecker.check(toolName)
// 如果 needsConfirmation，通过 WebSocket 通知前端弹窗
// 前端用户点击确认后，通过 WebSocket 返回确认信号
// AgentExecutor 收到确认后继续执行工具
```

**前端确认弹窗组件**：

```tsx
// components/ConfirmDialog.tsx
interface ConfirmDialogProps {
  message: string
  toolName: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ message, toolName, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-2">操作确认</h3>
        <p className="text-gray-600 mb-4">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 border rounded hover:bg-gray-50">
            取消
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            确认执行
          </button>
        </div>
      </div>
    </div>
  )
}
```

**要点**：
- 权限控制的核心是"安全操作自动执行，有副作用的操作人工确认"
- 确认流程不能阻塞 Agent 执行引擎——应该用异步机制（WebSocket/Promise）
- 权限配置应该可动态调整，而不是硬编码在代码中

### 练习四

**思路**：实现一个展示 Agent 执行过程的前端组件，包含步骤列表、状态指示器（pending/running/completed/failed）和最终结果展示。

**答案**：

```tsx
// components/AgentSteps.tsx
import { useState, useEffect } from 'react'

interface AgentStep {
  stepNumber: number
  type: 'thinking' | 'tool_call' | 'final_answer'
  content: string
  toolName?: string
  toolParams?: any
  toolResult?: any
  status: 'success' | 'error'
}

interface AgentStepsProps {
  steps: AgentStep[]
  isRunning: boolean
  onStop: () => void
}

export function AgentSteps({ steps, isRunning, onStop }: AgentStepsProps) {
  return (
    <div className="border rounded-lg p-4 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Agent 执行过程</h3>
        {isRunning && (
          <button onClick={onStop} className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">
            停止执行
          </button>
        )}
      </div>

      <div className="space-y-3">
        {steps.map((step) => (
          <StepItem key={step.stepNumber} step={step} />
        ))}

        {isRunning && (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>正在思考...</span>
          </div>
        )}
      </div>
    </div>
  )
}

function StepItem({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = useState(false)

  const statusIcon = {
    success: '✅',
    error: '❌',
  }[step.status]

  const typeLabel = {
    thinking: '思考',
    tool_call: '工具调用',
    final_answer: '最终回答',
  }[step.type]

  return (
    <div className="border rounded p-3">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span>{statusIcon}</span>
        <span className="text-sm text-gray-500">步骤 {step.stepNumber}</span>
        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{typeLabel}</span>
        <span className="flex-1 truncate">{step.content}</span>
        {step.type === 'tool_call' && (
          <span className="text-xs text-blue-600">{step.toolName}</span>
        )}
      </div>

      {expanded && step.type === 'tool_call' && (
        <div className="mt-2 text-sm">
          <div className="bg-gray-50 rounded p-2 mb-2">
            <div className="text-xs text-gray-500 mb-1">参数：</div>
            <pre className="whitespace-pre-wrap">{JSON.stringify(step.toolParams, null, 2)}</pre>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-500 mb-1">结果：</div>
            <pre className="whitespace-pre-wrap">{JSON.stringify(step.toolResult, null, 2)}</pre>
          </div>
        </div>
      )}

      {expanded && step.type === 'final_answer' && (
        <div className="mt-2 text-sm bg-green-50 rounded p-2">
          {step.content}
        </div>
      )}
    </div>
  )
}
```

**要点**：
- 步骤状态要有实时更新——通过 WebSocket 或 SSE 推送步骤变化
- 默认折叠详情（参数和结果），点击展开——避免信息过载
- 运行中要有明确的加载状态和停止按钮——用户需要知道 Agent 在做什么、能随时中断
