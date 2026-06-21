# 第5课：结构化输出——JSON Schema、类型校验、Zod 对接

> **课程定位**：让模型输出可靠、可解析的数据
> **前置知识**：第 3 课的文本生成基础、基本的 TypeScript 类型
> **预计时长**：50 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 理解为什么需要结构化输出
2. 使用 JSON Schema 约束模型输出格式
3. 使用 Zod 定义和校验输出类型
4. 处理模型输出不符合 schema 的情况
5. 在实际场景中应用结构化输出

---

## 一、为什么需要结构化输出

### 1.1 自由文本的问题

```
场景：让 AI 分析用户评论的情感

自由文本输出：
  "这段评论是正面的，用户对产品很满意。"

问题：
  - 怎么判断是"正面"还是"负面"？
  - 程序无法直接解析这个句子
  - 每次输出的措辞可能不同
  - 你得用正则去提取，非常脆弱
```

### 1.2 结构化输出的好处

```
结构化输出：
  {
    "sentiment": "positive",
    "confidence": 0.92,
    "keywords": ["满意", "推荐"]
  }

好处：
  - 程序可以直接使用
  - 类型安全（TypeScript 友好）
  - 一致性：每次输出格式相同
  - 可校验：可以检查是否符合预期
```

### 1.3 适用场景

```
┌─────────────────────────────────────────────────────────────────┐
│                    结构化输出的典型场景                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  数据提取                                                        │
│  ├── 从文本中提取实体（人名、地点、日期）                         │
│  ├── 从评论中提取情感和关键词                                    │
│  └── 从简历中提取技能和经验                                      │
│                                                                 │
│  分类任务                                                        │
│  ├── 邮件分类（垃圾/重要/普通）                                  │
│  ├── 工单分类（bug/feature/咨询）                                │
│  └── 内容分类（技术/商业/娱乐）                                  │
│                                                                 │
│  生成任务                                                        │
│  ├── 生成大纲（标题 + 要点列表）                                 │
│  ├── 生成摘要（标题 + 摘要 + 关键词）                            │
│  └── 生成代码（语言 + 代码 + 说明）                              │
│                                                                 │
│  决策任务                                                        │
│  ├── 评估风险等级（低/中/高）                                    │
│  ├── 推荐下一步操作                                              │
│  └── 判断是否需要人工审核                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、使用 JSON Mode

### 2.1 开启 JSON 输出

```typescript
import OpenAI from 'openai'

const openai = new OpenAI()

// 方式一：text.format 参数
const response = await openai.responses.create({
  model: 'gpt-5.5',
  input: [
    {
      role: 'system',
      content: '分析用户评论的情感，返回 JSON 格式。'
    },
    { role: 'user', content: '这个产品太棒了！' }
  ],
  text: { format: { type: 'json_object' } },
})

// 输出一定是合法的 JSON
const result = JSON.parse(response.output_text)
console.log(result)
// { "sentiment": "positive", "confidence": 0.95 }
```

### 2.2 JSON Mode 的限制

```
┌─────────────────────────────────────────────────────────────────┐
│                    JSON Mode 的注意事项                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ 保证输出是合法的 JSON                                        │
│  ✅ 不会返回纯文本                                               │
│                                                                 │
│  ❌ 不保证 JSON 的结构符合你的预期                                │
│  ❌ 可能缺少字段、多出字段、类型不对                              │
│  ❌ 需要在 prompt 中明确描述期望的格式                            │
│                                                                 │
│  所以：JSON Mode + Zod 校验 = 可靠的结构化输出                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、JSON Schema 约束

### 3.1 使用 Structured Outputs

OpenAI 提供了更严格的结构化输出方式：

```typescript
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'

const openai = new OpenAI()

// 定义输出的 schema
const SentimentSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()),
})

// 使用 responses.parse + zodTextFormat
const response = await openai.responses.parse({
  model: 'gpt-5.5',
  input: [
    { role: 'user', content: '分析情感：这个产品太棒了！' }
  ],
  text: { format: zodTextFormat(SentimentSchema, 'sentiment') },
})

// 输出保证符合 schema
const result = response.output_parsed
console.log(result)
// { sentiment: 'positive', confidence: 0.95, keywords: ['棒'] }
```

### 3.2 Schema 的作用

```
┌─────────────────────────────────────────────────────────────────┐
│                    Schema 的三层保障                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  第 1 层：Prompt（软约束）                                       │
│    "返回 JSON，包含 sentiment、confidence、keywords 字段"        │
│    → 模型通常会遵守，但不保证                                     │
│                                                                 │
│  第 2 层：JSON Mode（格式约束）                                  │
│    text: { format: { type: 'json_object' } }                    │
│    → 保证是合法 JSON，但不保证结构                                │
│                                                                 │
│  第 3 层：Schema 校验（类型约束）                                 │
│    Zod schema + parse                                           │
│    → 保证结构和类型完全符合预期                                   │
│                                                                 │
│  三层结合 = 既灵活又可靠                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 四、Zod：TypeScript 的运行时校验

### 4.1 什么是 Zod

```
Zod = 运行时类型校验库

TypeScript 的类型只在编译时存在，运行时就没了。
Zod 让你在运行时也能检查数据是否符合类型。

  TypeScript 类型：
    type User = { name: string; age: number }
    → 编译时检查，运行时不存在

  Zod schema：
    const UserSchema = z.object({ name: z.string(), age: z.number() })
    → 运行时可以校验数据
```

### 4.2 基础用法

```typescript
import { z } from 'zod'

// 定义 schema
const UserSchema = z.object({
  name: z.string(),
  age: z.number().int().min(0).max(150),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']),
})

// 从 schema 推导 TypeScript 类型
type User = z.infer<typeof UserSchema>
// { name: string; age: number; email: string; role: 'admin' | 'user' | 'guest' }

// 校验数据
const result = UserSchema.safeParse({
  name: '小明',
  age: 25,
  email: 'xiaoming@example.com',
  role: 'admin',
})

if (result.success) {
  console.log('校验通过:', result.data)
} else {
  console.error('校验失败:', result.error.issues)
}
```

### 4.3 常用的 Zod 类型

```typescript
import { z } from 'zod'

// 基础类型
z.string()                    // 字符串
z.number()                    // 数字
z.boolean()                   // 布尔
z.null()                      // null

// 字符串校验
z.string().min(1)             // 至少 1 个字符
z.string().max(1000)          // 最多 1000 个字符
z.string().email()            // 邮箱格式
z.string().url()              // URL 格式
z.string().regex(/xxx/)       // 正则匹配

// 数字校验
z.number().int()              // 整数
z.number().min(0)             // 最小值
z.number().max(1)             // 最大值

// 枚举
z.enum(['a', 'b', 'c'])      // 枚举值

// 数组
z.array(z.string())           // 字符串数组
z.array(z.string()).min(1)    // 至少 1 个元素

// 对象
z.object({                    // 对象结构
  name: z.string(),
  age: z.number(),
})

// 可选字段
z.object({
  name: z.string(),
  nickname: z.string().optional(),  // 可选
})

// 联合类型
z.union([z.string(), z.number()])  // 字符串或数字
```

---

## 五、完整的结构化输出实现

### 5.1 定义输出 Schema

```typescript
// src/schemas/analysis.ts
import { z } from 'zod'

// 评论分析的输出 schema
export const CommentAnalysisSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()).min(1).max(10),
  summary: z.string().min(1).max(200),
  actionRequired: z.boolean(),
})

// 从 schema 推导类型
export type CommentAnalysis = z.infer<typeof CommentAnalysisSchema>
```

### 5.2 封装调用函数

```typescript
// src/lib/structured-output.ts
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'

const openai = new OpenAI()

interface StructuredOutputResult<T> {
  success: boolean
  data?: T
  error?: string
}

export async function structuredOutput<T extends z.ZodType>(
  schema: T,
  prompt: string,
  systemPrompt?: string
): Promise<StructuredOutputResult<z.infer<T>>> {
  try {
    const input: Array<{ role: 'system' | 'user'; content: string }> = []

    if (systemPrompt) {
      input.push({ role: 'system', content: systemPrompt })
    }
    input.push({ role: 'user', content: prompt })

    const response = await openai.responses.parse({
      model: 'gpt-5.5',
      input,
      text: { format: zodTextFormat(schema, 'output') },
    })

    const content = response.output_parsed

    if (!content) {
      return { success: false, error: '模型返回空内容' }
    }

    return { success: true, data: content }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `输出格式错误: ${error.issues.map(i => i.message).join(', ')}`
      }
    }
    return { success: false, error: `请求失败: ${error}` }
  }
}
```

### 5.3 使用示例

```typescript
// src/examples/structured-demo.ts
import 'dotenv/config'
import { structuredOutput } from '../lib/structured-output'
import { CommentAnalysisSchema } from '../schemas/analysis'

async function main() {
  const result = await structuredOutput(
    CommentAnalysisSchema,
    '分析以下评论：这个产品用了一周，真的很失望，功能不全还经常崩溃。',
    '你是一个产品评论分析师。分析用户评论的情感、关键词和是否需要跟进。'
  )

  if (result.success) {
    console.log('分析结果:')
    console.log('  情感:', result.data.sentiment)
    console.log('  置信度:', result.data.confidence)
    console.log('  关键词:', result.data.keywords.join(', '))
    console.log('  摘要:', result.data.summary)
    console.log('  需要跟进:', result.data.actionRequired)
  } else {
    console.error('分析失败:', result.error)
  }
}

main()
```

输出：

```
分析结果:
  情感: negative
  置信度: 0.92
  关键词: 失望, 功能不全, 崩溃
  摘要: 用户对产品质量不满意，认为功能不完善且稳定性差
  需要跟进: true
```

---

## 六、实际应用场景

### 6.1 从文本中提取信息

```typescript
const ExtractedInfoSchema = z.object({
  people: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
  })),
  dates: z.array(z.string()),
  locations: z.array(z.string()),
  actions: z.array(z.string()),
})

const result = await structuredOutput(
  ExtractedInfoSchema,
  '提取以下文本中的实体：\n\n' +
  '张三（项目经理）和李四（前端开发）将于下周三在北京开会，讨论新版本发布计划。'
)
```

### 6.2 生成结构化大纲

```typescript
const OutlineSchema = z.object({
  title: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    points: z.array(z.string()).min(1).max(5),
    estimatedMinutes: z.number(),
  })),
  totalEstimatedMinutes: z.number(),
})

const result = await structuredOutput(
  OutlineSchema,
  '为"React 状态管理"这个主题生成一个 30 分钟的演讲大纲。'
)
```

### 6.3 分类任务

```typescript
const TicketClassificationSchema = z.object({
  category: z.enum(['bug', 'feature', 'question', 'complaint']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  suggestedAssignee: z.string(),
  tags: z.array(z.string()),
  requiresFollowUp: z.boolean(),
})

const result = await structuredOutput(
  TicketClassificationSchema,
  '分类以下工单：\n\n用户反馈：登录页面在 Safari 浏览器上显示异常，按钮点击无响应。'
)
```

---

## 七、错误处理与重试

### 7.1 校验失败的处理

```typescript
async function robustStructuredOutput<T extends z.ZodType>(
  schema: T,
  prompt: string,
  maxRetries: number = 2
): Promise<z.infer<T>> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await structuredOutput(schema, prompt)

    if (result.success) {
      return result.data!
    }

    lastError = new Error(result.error)

    // 如果是格式错误，在 prompt 中加入修正提示
    if (attempt < maxRetries) {
      prompt = `${prompt}\n\n注意：上次输出格式不正确（${result.error}），请严格按照 schema 输出。`
    }
  }

  throw lastError
}
```

### 7.2 降级策略

```typescript
async function safeStructuredOutput<T extends z.ZodType>(
  schema: T,
  prompt: string
): Promise<z.infer<T> | null> {
  try {
    const result = await structuredOutput(schema, prompt)
    if (result.success) return result.data!

    // 降级：返回默认值
    console.warn('结构化输出失败，使用默认值')
    return null

  } catch (error) {
    console.error('请求失败:', error)
    return null
  }
}
```

---

## 动手练习

### 练习一：定义你的 Schema

为以下场景定义 Zod Schema：
1. 一篇文章的元数据（标题、作者、发布日期、标签、阅读时间）
2. 一个待办事项（标题、描述、优先级、截止日期、标签）
3. 一个产品评价（评分、标题、内容、推荐与否）

### 练习二：实现信息提取

写一个函数，从任意文本中提取：
- 人名
- 组织名
- 日期
- 地点
- 关键事件

用 3 个不同的文本测试。

### 练习三：对比自由输出和结构化输出

同一个 prompt，分别用：
1. 普通文本输出
2. JSON Mode
3. Structured Outputs (Zod)

对比输出的一致性和可解析性。

---

## 小结

本课的核心要点：

1. **结构化输出让程序可用**：自由文本无法直接程序化处理
2. **三层保障**：Prompt 描述 + JSON Mode + Schema 校验
3. **Zod 是 TypeScript 的运行时校验**：定义 schema，推导类型，校验数据
4. **类型安全**：`z.infer<typeof Schema>` 让你获得完整的 TypeScript 类型
5. **错误处理**：校验失败时重试或降级

---

**下一课**: [第6课：流式响应——前端体验、取消请求、错误恢复](./06-流式响应前端体验与取消请求.md)
