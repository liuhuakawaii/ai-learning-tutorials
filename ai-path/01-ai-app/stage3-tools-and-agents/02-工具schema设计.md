# 第2课：工具 Schema——输入、输出、错误协议

> **课程定位**：设计可靠的工具接口
> **前置知识**：第 1 课的工具调用原理
> **预计时长**：40 分钟

---

## 场景引入

你给模型注册了一个搜索工具，描述写的是"搜索"。用户问"帮我查一下上个月的销售数据"，模型调用了这个工具，但它传入的参数是 `q: "上个月销售数据"`——而你的搜索工具其实是全文检索，只能搜文档标题和正文，根本查不了数据库里的结构化数据。问题出在哪？工具的 description 没有说清楚它的能力边界，参数 schema 也没有约束输入格式。模型只能猜，猜错了就调用失败。工具 Schema 就是工具和模型之间的"合同"，写得好模型就能正确使用，写得差模型就会误用。

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

## 参考答案

### 练习一：设计工具 Schema

**思路**：每个工具的 schema 需要包含：语义化的工具名、说明使用场景的 description、明确类型和语义的参数、合理的 required 设置。参考课程中的 Zod 定义方式。

**答案**：

**1. 查询用户订单状态**
```typescript
import { z } from 'zod'

const QueryOrderStatusSchema = z.object({
  order_id: z.string().min(1).describe('订单编号，如 "ORD-2024-001"'),
  include_tracking: z.boolean().default(false).describe('是否包含物流追踪信息'),
})

// 对应的 OpenAI tool schema
{
  type: 'function',
  function: {
    name: 'query_order_status',
    description: '查询订单的当前状态。当用户询问订单发货情况、物流进度、订单详情时使用。',
    parameters: zodToJsonSchema(QueryOrderStatusSchema),
  },
}
```

**2. 发送邮件**
```typescript
const SendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1).describe('收件人邮箱列表'),
  cc: z.array(z.string().email()).optional().describe('抄送邮箱列表'),
  subject: z.string().min(1).max(200).describe('邮件主题'),
  body: z.string().min(1).describe('邮件正文内容'),
  format: z.enum(['text', 'html']).default('text').describe('邮件格式'),
})

{
  type: 'function',
  function: {
    name: 'send_email',
    description: '发送邮件。这是一个高风险操作，发送后无法撤回。',
    parameters: zodToJsonSchema(SendEmailSchema),
  },
}
```

**3. 创建日历事件**
```typescript
const CreateCalendarEventSchema = z.object({
  title: z.string().min(1).describe('事件标题'),
  start_time: z.string().describe('开始时间，ISO 8601 格式，如 "2024-03-15T14:00:00"'),
  end_time: z.string().describe('结束时间，ISO 8601 格式'),
  attendees: z.array(z.string().email()).optional().describe('参与者邮箱列表'),
  location: z.string().optional().describe('会议地点'),
  description: z.string().optional().describe('事件描述'),
  reminder_minutes: z.number().int().min(0).max(1440).default(15).describe('提前提醒分钟数'),
})

{
  type: 'function',
  function: {
    name: 'create_calendar_event',
    description: '创建日历事件或会议。当用户要求安排会议、设置日程、创建提醒时使用。',
    parameters: zodToJsonSchema(CreateCalendarEventSchema),
  },
}
```

**要点**：
- 参数描述要写语义（"收件人邮箱列表"），不能只写类型（"string array"）
- 时间参数统一用 ISO 8601 格式，避免"明天下午"这种模糊描述
- 用 enum 约束有限取值（如邮件格式只有 text 和 html）
- 常见错误：把所有参数都设为 required——`cc`、`location` 这类可选参数不应阻塞工具调用

### 练习二：实现错误处理

**思路**：错误处理需要覆盖三类错误——输入校验错误（ZodError）、执行时错误（网络超时、资源不存在）、未知错误。每类错误返回标准化的 ToolResult 格式。

**答案**：

```typescript
import { z } from 'zod'

interface ToolResult {
  success: boolean
  data?: any
  error?: string
  metadata?: { executionTime: number }
}

// 1. 模拟工具执行失败
async function simulateToolExecution(args: { city: string }): Promise<ToolResult> {
  const start = Date.now()

  // 模拟各种失败场景
  if (!args.city || args.city.trim() === '') {
    return {
      success: false,
      error: '参数错误: 城市名称不能为空',
      metadata: { executionTime: Date.now() - start },
    }
  }

  if (args.city === '不存在的城市') {
    return {
      success: false,
      error: '未找到该城市的天气数据，请检查城市名称是否正确',
      metadata: { executionTime: Date.now() - start },
    }
  }

  // 模拟超时
  if (args.city === '超时城市') {
    await new Promise(r => setTimeout(r, 5000))
    return {
      success: false,
      error: '请求超时，请稍后重试',
      metadata: { executionTime: Date.now() - start },
    }
  }

  return {
    success: true,
    data: { city: args.city, temp: 25, condition: '晴' },
    metadata: { executionTime: Date.now() - start },
  }
}

// 2. 标准化错误返回
function handleToolError(error: unknown): ToolResult {
  if (error instanceof z.ZodError) {
    return {
      success: false,
      error: `参数校验失败: ${error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    }
  }

  if (error instanceof Error) {
    if (error.message.includes('timeout') || error.message.includes('超时')) {
      return { success: false, error: '操作超时，请稍后重试' }
    }
    if (error.message.includes('not found') || error.message.includes('不存在')) {
      return { success: false, error: '请求的资源不存在' }
    }
    if (error.message.includes('permission') || error.message.includes('权限')) {
      return { success: false, error: '权限不足，无法执行此操作' }
    }
    return { success: false, error: `执行失败: ${error.message}` }
  }

  return { success: false, error: '发生未知错误' }
}

// 3. 让模型理解错误并生成友好回答
async function chatWithErrorHandling(userMessage: string, tools: any[]) {
  const response = await openai.responses.create({
    model: 'gpt-5.5',
    input: [
      {
        role: 'system',
        content: `你是一个助手。当工具返回错误时，你需要：
1. 理解错误原因
2. 用友好的语言告诉用户发生了什么
3. 如果可能，给出解决建议（如"请检查城市名称"或"请稍后重试"）
不要暴露技术细节给用户。`,
      },
      { role: 'user', content: userMessage },
    ],
    tools,
    tool_choice: 'auto',
  })

  // 工具调用后的错误会被模型看到，模型会基于错误信息生成友好回答
  return response.output_text
}
```

**要点**：
- Zod 校验错误要返回具体的字段名和错误原因，方便模型定位问题
- 面向用户的错误信息要通俗易懂，不能暴露内部架构（如数据库连接字符串）
- 模型看到错误信息后会自动调整回答策略——这是 Function Calling 的天然优势
- 常见错误：把 `Connection refused to postgres://10.0.0.1:5432` 这样的原始错误返回给模型，模型可能会在回答中泄露内部架构

### 练习三：用 Zod 校验

**思路**：Zod 可以在运行时验证模型传入的参数，支持嵌套对象、数组、枚举、默认值等复杂约束。校验失败时抛出 ZodError，包含详细的错误路径和原因。

**答案**：

```typescript
import { z } from 'zod'

// 1. 定义复杂 Zod schema
const CreateProductSchema = z.object({
  name: z.string().min(2).max(100).describe('商品名称'),
  price: z.number().positive().describe('商品价格，必须大于 0'),
  category: z.enum(['electronics', 'clothing', 'food', 'books']).describe('商品分类'),
  tags: z.array(z.string().min(1)).min(1).max(10).describe('商品标签，1-10 个'),
  specs: z.record(z.string()).optional().describe('商品规格，键值对形式'),
  variants: z.array(z.object({
    size: z.enum(['S', 'M', 'L', 'XL']),
    color: z.string().min(1),
    stock: z.number().int().min(0),
  })).optional().describe('商品变体列表'),
})

// 2. 测试参数校验
function testValidation() {
  // 正常数据
  const validData = {
    name: '无线蓝牙耳机',
    price: 299.9,
    category: 'electronics',
    tags: ['蓝牙', '无线', '降噪'],
    specs: { '续航': '8小时', '重量': '200g' },
    variants: [
      { size: 'M', color: '黑色', stock: 50 },
      { size: 'L', color: '白色', stock: 30 },
    ],
  }
  const result1 = CreateProductSchema.safeParse(validData)
  console.log('正常数据:', result1.success) // true

  // 异常数据：价格为负数
  const invalidPrice = { ...validData, price: -10 }
  const result2 = CreateProductSchema.safeParse(invalidPrice)
  console.log('负价格:', result2.success) // false

  // 异常数据：缺少必填字段
  const missingName = { price: 100, category: 'books', tags: ['test'] }
  const result3 = CreateProductSchema.safeParse(missingName)
  console.log('缺少名称:', result3.success) // false

  // 异常数据：枚举值不合法
  const invalidCategory = { ...validData, category: 'toys' }
  const result4 = CreateProductSchema.safeParse(invalidCategory)
  console.log('非法分类:', result4.success) // false
}

// 3. 处理校验失败
function validateToolArgs(schema: z.ZodType, args: unknown) {
  const result = schema.safeParse(args)

  if (result.success) {
    return { valid: true, data: result.data }
  }

  // 格式化错误信息
  const errors = result.error.issues.map(issue => {
    const path = issue.path.length > 0 ? `字段 "${issue.path.join('.')}"` : '根对象'
    return `${path}: ${issue.message}`
  })

  return {
    valid: false,
    errors,
    formattedMessage: `参数校验失败:\n${errors.map(e => `  - ${e}`).join('\n')}`,
  }
}

// 使用示例
const badArgs = { name: '', price: -5, category: 'unknown', tags: [] }
const validation = validateToolArgs(CreateProductSchema, badArgs)
console.log(validation.formattedMessage)
// 输出:
// 参数校验失败:
//   - 字段 "name": String must contain at least 2 character(s)
//   - 字段 "price": Number must be greater than 0
//   - 字段 "category": Invalid enum value
//   - 字段 "tags": Array must contain at least 1 item(s)
```

**要点**：
- Zod 的 `.safeParse()` 不会抛异常，返回 `{ success, data/error }`，适合在工具执行前做前置校验
- `.describe()` 的描述会通过 `zodToJsonSchema` 转换到 OpenAI tool schema 中，模型会看到这些描述
- 常见错误：只用 TypeScript 类型定义做编译时检查，但模型传入的是运行时 JSON，必须用 Zod 做运行时校验
- 常见错误：校验失败后把 ZodError 原始对象返回给模型——应该格式化成人类可读的错误列表

---

## 常见误区

1. **参数描述只写类型不写语义**：`age: { type: 'number' }` 告诉模型这是一个数字，但没告诉它是年龄、数量还是金额。描述要写清楚"这个参数代表什么"以及"常见取值是什么"。
2. **required 字段设置不当**：把所有参数都设为 required 会导致模型在信息不足时编造数据；把关键参数设为 optional 会导致工具收到不完整的输入。只把工具正常工作必需的参数设为 required。
3. **忽略枚举约束**：如果参数只有几个合法值（如排序方式只有 `asc` 和 `desc`），一定要用 enum 约束，否则模型可能传入 `"ascending"` 这样的非预期值。
4. **错误信息直接暴露技术细节**：把 `"Connection refused to postgres://10.0.0.1:5432"` 返回给模型，模型可能会在回答中暴露内部架构信息。错误信息要面向用户可理解。

---

## 工程建议

1. **用 Zod 做运行时校验**：类型定义只能在编译时检查，但模型传入的参数是运行时的 JSON 字符串。Zod 可以在执行前验证参数格式、范围、必填项，拦截非法输入。
2. **输出格式保持一致性**：所有工具的返回都用 `{ success, data, error, metadata }` 的统一结构。这样前端可以统一处理加载状态和错误提示，不用为每个工具写特殊逻辑。
3. **给每个工具写"使用示例"**：在 description 中加入一两句使用场景，比如"当用户询问基于已上传文档的问题时使用"。这比纯功能描述更能帮助模型判断何时调用。
4. **版本化你的 Schema**：工具参数可能随业务变化。用 `v1/search` 这样的命名或在 schema 中加版本字段，避免新旧参数混用导致线上问题。

---

## 小结

本课的核心要点：

1. **Schema 是工具的说明书**：告诉模型何时使用、如何调用
2. **用 Zod 定义 schema**：类型安全、可校验、可转换
3. **标准化输出**：成功/失败状态、数据、错误信息
4. **错误处理**：输入错误、执行错误、业务错误
5. **工具注册表**：统一管理所有工具

---

**下一课**: [第3课：常见工具——搜索、数据库查询、文件读写、保存笔记](./03-常见工具实现.md)
