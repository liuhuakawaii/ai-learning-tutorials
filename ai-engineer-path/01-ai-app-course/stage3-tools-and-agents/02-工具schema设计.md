# 第2课：工具 Schema——输入、输出、错误协议

> **课程定位**：设计可靠的工具接口
> **前置知识**：第 1 课的工具调用原理
> **预计时长**：40 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 设计清晰的工具输入 schema
2. 定义标准化的工具输出格式
3. 处理工具执行中的错误
4. 用 Zod 校验工具参数

---

## 一、工具输入 Schema

### 1.1 Schema 的作用

```
Schema = 工具的"说明书"

  告诉模型：
  - 这个工具做什么（description）
  - 需要哪些参数（parameters）
  - 每个参数的类型和含义（properties）
  - 哪些参数是必须的（required）

  告诉系统：
  - 如何校验输入
  - 如何调用工具
  - 如何处理错误
```

### 1.2 Schema 结构

```typescript
interface ToolSchema {
  type: 'function'
  function: {
    name: string           // 工具名，模型用它来引用工具
    description: string    // 工具描述，模型用它来判断何时使用
    parameters: {
      type: 'object'
      properties: Record<string, ParameterSchema>
      required: string[]
    }
  }
}

interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  enum?: string[]          // 可选：限定取值范围
  items?: ParameterSchema  // 数组元素的类型
  properties?: Record<string, ParameterSchema>  // 对象的属性
}
```

### 1.3 设计好的描述

```typescript
// ❌ 不好的描述
{
  name: 'search',
  description: '搜索',
  parameters: {
    properties: {
      q: { type: 'string', description: '查询' }
    }
  }
}

// ✅ 好的描述
{
  name: 'search_knowledge_base',
  description: '在知识库中搜索与查询相关的文档片段。当用户询问基于已上传文档的问题时使用此工具。',
  parameters: {
    properties: {
      query: {
        type: 'string',
        description: '搜索查询，应包含用户问题的关键词'
      },
      max_results: {
        type: 'number',
        description: '返回的最大结果数，默认为 5'
      }
    },
    required: ['query']
  }
}
```

### 1.4 用 Zod 定义 Schema

```typescript
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

// 定义 Zod schema
const SearchToolSchema = z.object({
  query: z.string().min(1).describe('搜索查询，应包含用户问题的关键词'),
  max_results: z.number().int().min(1).max(20).default(5).describe('返回的最大结果数'),
  category: z.enum(['all', 'technical', 'business']).optional().describe('搜索类别'),
})

// 转换为 OpenAI 的 tool schema
function createToolFromZod(
  name: string,
  description: string,
  schema: z.ZodType
) {
  return {
    type: 'function' as const,
    function: {
      name,
      description,
      parameters: zodToJsonSchema(schema),
    },
  }
}

const searchTool = createToolFromZod(
  'search_knowledge_base',
  '在知识库中搜索与查询相关的文档片段',
  SearchToolSchema
)
```

---

## 二、工具输出格式

### 2.1 标准化输出

```typescript
// 工具执行结果的标准格式
interface ToolResult {
  success: boolean
  data?: any              // 成功时的数据
  error?: string          // 失败时的错误信息
  metadata?: {
    executionTime: number  // 执行耗时
    source?: string        // 数据来源
  }
}

// 示例：搜索工具的输出
{
  success: true,
  data: {
    results: [
      { content: '...', source: 'doc1.md', score: 0.95 },
      { content: '...', source: 'doc2.md', score: 0.87 },
    ],
    total: 2
  },
  metadata: {
    executionTime: 150,
    source: 'knowledge_base'
  }
}
```

### 2.2 为什么需要标准化

```
标准化输出的好处：

  1. 模型能理解
     - 成功/失败状态清晰
     - 数据格式一致
     - 错误信息有意义

  2. 系统能处理
     - 可以统一记录日志
     - 可以统计成功率
     - 可以重试失败的调用

  3. 前端能展示
     - 加载状态
     - 错误提示
     - 数据展示
```

---

## 三、错误处理

### 3.1 工具可能的错误

```typescript
enum ToolErrorType {
  // 输入错误
  INVALID_INPUT = 'INVALID_INPUT',      // 参数格式错误
  MISSING_PARAM = 'MISSING_PARAM',      // 缺少必要参数

  // 执行错误
  NOT_FOUND = 'NOT_FOUND',              // 资源不存在
  PERMISSION_DENIED = 'PERMISSION_DENIED', // 权限不足
  TIMEOUT = 'TIMEOUT',                  // 执行超时
  EXTERNAL_ERROR = 'EXTERNAL_ERROR',    // 外部服务错误

  // 业务错误
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',    // 配额用完
  RATE_LIMITED = 'RATE_LIMITED',        // 请求太频繁
}
```

### 3.2 错误处理函数

```typescript
function handleToolError(error: unknown): ToolResult {
  if (error instanceof z.ZodError) {
    return {
      success: false,
      error: `参数错误: ${error.issues.map(i => i.message).join(', ')}`,
    }
  }

  if (error instanceof Error) {
    // 根据错误类型返回不同的错误信息
    if (error.message.includes('not found')) {
      return {
        success: false,
        error: '请求的资源不存在',
      }
    }

    if (error.message.includes('timeout')) {
      return {
        success: false,
        error: '操作超时，请稍后重试',
      }
    }

    return {
      success: false,
      error: `执行失败: ${error.message}`,
    }
  }

  return {
    success: false,
    error: '未知错误',
  }
}
```

---

## 四、完整的工具实现

### 4.1 工具注册表

```typescript
// lib/tool-registry.ts
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

interface ToolDefinition {
  name: string
  description: string
  schema: z.ZodType
  handler: (args: any) => Promise<ToolResult>
}

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool)
  }

  // 获取所有工具的 OpenAI schema 格式
  getToolSchemas() {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.schema),
      },
    }))
  }

  // 执行工具
  async execute(name: string, args: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { success: false, error: `工具 ${name} 不存在` }
    }

    try {
      // 校验参数
      const validatedArgs = tool.schema.parse(args)

      // 执行工具
      const result = await tool.handler(validatedArgs)
      return result

    } catch (error) {
      return handleToolError(error)
    }
  }

  // 列出所有工具
  list() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
    }))
  }
}

export const toolRegistry = new ToolRegistry()
```

### 4.2 注册工具

```typescript
// lib/tools/search.ts
import { z } from 'zod'
import { toolRegistry } from '../tool-registry'

const SearchSchema = z.object({
  query: z.string().min(1).describe('搜索查询'),
  max_results: z.number().int().min(1).max(20).default(5),
})

toolRegistry.register({
  name: 'search_knowledge_base',
  description: '在知识库中搜索相关文档',
  schema: SearchSchema,
  handler: async (args) => {
    const { query, max_results } = args

    // 实际的搜索逻辑
    const results = await searchKnowledgeBase(query, max_results)

    return {
      success: true,
      data: { results, total: results.length },
      metadata: { executionTime: 100 },
    }
  },
})
```

---

## 五、工具调用的完整流程

```typescript
// lib/tool-calling.ts
import OpenAI from 'openai'
import { toolRegistry } from './tool-registry'

const openai = new OpenAI()

export async function chatWithTools(
  input: ResponseInputMessage[]
): Promise<string> {
  // 获取工具 schema
  const tools = toolRegistry.getToolSchemas()

  // 第一步：发送给模型
  const response = await openai.responses.create({
    model: 'gpt-5.5',
    input,
    tools,
    tool_choice: 'auto',
  })

  const toolCalls = response.output.filter((item) => item.type === 'function_call')

  // 如果模型要求调用工具
  if (toolCalls.length > 0) {
    const toolResults = []
    // 执行所有工具调用
    for (const toolCall of toolCalls) {
      const args = JSON.parse(toolCall.arguments)
      const result = await toolRegistry.execute(toolCall.name, args)

      toolResults.push({
        type: 'function_call_output' as const,
        call_id: toolCall.call_id,
        output: JSON.stringify(result),
      })
    }

    // 第二步：把工具结果发回模型
    const finalResponse = await openai.responses.create({
      model: 'gpt-5.5',
      input: [...input, ...response.output, ...toolResults],
    })

    return finalResponse.output_text || ''
  }

  return response.output_text || ''
}
```

---

## 动手练习

### 练习一：设计工具 Schema

为以下场景设计工具 schema：
1. 查询用户订单状态
2. 发送邮件
3. 创建日历事件

### 练习二：实现错误处理

1. 模拟工具执行失败
2. 实现标准化的错误返回
3. 让模型理解错误并生成友好的回答

### 练习三：用 Zod 校验

1. 定义一个复杂的 Zod schema
2. 测试参数校验
3. 处理校验失败的情况

---

## 小结

本课的核心要点：

1. **Schema 是工具的说明书**：告诉模型何时使用、如何调用
2. **用 Zod 定义 schema**：类型安全、可校验、可转换
3. **标准化输出**：成功/失败状态、数据、错误信息
4. **错误处理**：输入错误、执行错误、业务错误
5. **工具注册表**：统一管理所有工具

---

## 下一课预告

下一课我们将实现常见工具：搜索、数据库查询、文件读写、保存笔记。
