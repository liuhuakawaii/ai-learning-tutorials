# 第5课：结构化输出——用 Zod 校验大纲生成

> **前置知识**：第 3 课的问答调用、基本的 TypeScript 类型
> **预计时长**：30 分钟

## 自由文本的问题

你让模型"总结一下这份产品文档的核心要点"，它回答：

> "这个产品主要面向企业用户，提供了登录、权限管理和数据导出等功能。登录支持 OAuth 和密码两种方式，权限管理基于角色……"

这段回答对人来说没问题。但你的程序需要把它展示成卡片、存进数据库、或者和其他数据拼接。你怎么提取"功能列表"？用正则？用 `split`？模型每次措辞都不同，你的解析代码迟早会崩。

这就是结构化输出要解决的问题：让模型返回程序可以直接使用的数据格式。

## JSON Mode：最简单的一步

OpenAI 提供了 JSON Mode，开启后模型保证返回合法的 JSON：

```typescript
const response = await openai.responses.create({
  model: 'gpt-5.5',
  input: [
    {
      role: 'system',
      content: '分析以下文档，返回 JSON 格式，包含 title、summary、keyFeatures 字段。'
    },
    { role: 'user', content: documentText }
  ],
  text: { format: { type: 'json_object' } },
})

const result = JSON.parse(response.output_text)
```

但 JSON Mode 只保证输出是合法 JSON，不保证结构符合你的预期。模型可能返回 `{ "result": "..." }` 而你期望的是 `{ "title": "...", "summary": "...", "keyFeatures": [...] }`。字段名、类型、是否可选——这些它都不保证。

光靠 prompt 描述"请包含这些字段"不够可靠。你需要一个运行时的校验层。

## Zod：TypeScript 的运行时校验

TypeScript 的类型只在编译时存在，运行时就没了。Zod 让你在运行时也能检查数据是否符合类型：

```typescript
import { z } from 'zod'

// 定义 schema
const OutlineSchema = z.object({
  title: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    keyPoints: z.array(z.string()).min(1).max(5),
    importance: z.enum(['high', 'medium', 'low']),
  })).min(2).max(8),
})

// 推导 TypeScript 类型
type Outline = z.infer<typeof OutlineSchema>

// 运行时校验
const result = OutlineSchema.safeParse(someData)
if (result.success) {
  // result.data 类型安全
  console.log(result.data.title)
} else {
  console.error(result.error.issues)
}
```

一份 schema，同时得到 TypeScript 类型和运行时校验。不需要手动写 interface 再单独写校验函数——两份定义迟早会不同步。

## 用 Structured Outputs 约束模型

OpenAI 的 `responses.parse` + `zodTextFormat` 把 Zod schema 直接传给模型，模型的输出保证符合 schema：

```typescript
import { zodTextFormat } from 'openai/helpers/zod'

const response = await openai.responses.parse({
  model: 'gpt-5.5',
  input: [
    { role: 'user', content: '为"React 状态管理"生成一个学习大纲' }
  ],
  text: { format: zodTextFormat(OutlineSchema, 'outline') },
})

// response.output_parsed 一定符合 OutlineSchema
const outline = response.output_parsed
```

模型从 schema 知道每个字段的名字、类型和约束，输出时严格遵守。不需要在 prompt 里写"请返回包含 heading、keyPoints、importance 的 JSON"——schema 已经描述了。

## 在知识工作台里生成大纲

知识工作台的一个典型需求：用户上传了几份文档，让 AI 生成一份结构化的大纲，把文档内容按主题组织起来。

```typescript
// src/lib/outline.ts
import { z } from 'zod'
import { zodTextFormat } from 'openai/helpers/zod'
import openai from './openai'

export const OutlineSchema = z.object({
  title: z.string(),
  topics: z.array(z.object({
    heading: z.string(),
    keyPoints: z.array(z.string()).min(1).max(5),
    sourceRef: z.string(),
  })).min(1).max(10),
  summary: z.string().max(500),
})

export type Outline = z.infer<typeof OutlineSchema>

export async function generateOutline(
  documentText: string,
  documentName: string
): Promise<Outline> {
  const response = await openai.responses.parse({
    model: 'gpt-5.5',
    input: [
      {
        role: 'system',
        content: `你是一个文档分析助手。分析用户提供的文档，生成结构化大纲。

要求：
- 提取文档的核心主题
- 每个主题列出 1-5 个关键点
- sourceRef 填写文档名称
- summary 在 200 字以内概括全文`
      },
      {
        role: 'user',
        content: `文档名称：${documentName}\n\n文档内容：\n${documentText}`
      }
    ],
    text: { format: zodTextFormat(OutlineSchema, 'outline') },
    temperature: 0.3,
  })

  const outline = response.output_parsed
  if (!outline) {
    throw new Error('大纲生成失败：模型返回空内容')
  }
  return outline
}
```

三个保障层叠在一起：prompt 描述了语义（"提取核心主题"），schema 约束了结构（字段名、类型、数量），`responses.parse` 保证输出符合 schema。单独用任何一个都不够可靠。

## 校验失败了怎么办

即使用了 Structured Outputs，也可能遇到问题：模型返回的内容语义上不合理（比如 `keyPoints` 是空数组），或者 API 本身出错。加上一层防御：

```typescript
export async function safeGenerateOutline(
  documentText: string,
  documentName: string
): Promise<{ success: boolean; data?: Outline; error?: string }> {
  try {
    const outline = await generateOutline(documentText, documentName)
    return { success: true, data: outline }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `输出格式错误：${error.issues.map(i => i.message).join(', ')}`,
      }
    }
    return {
      success: false,
      error: `生成失败：${error instanceof Error ? error.message : error}`,
    }
  }
}
```

对于非关键字段（比如 `summary`），可以用默认值降级。对于关键字段（比如 `topics`），重试一次再报错。区分"必须正确"和"大致正确就行"的字段。

## Zod 常用类型速查

```typescript
z.string()                      // 字符串
z.string().min(1).max(200)      // 长度约束
z.string().email()              // 邮箱格式
z.number()                      // 数字
z.number().int().min(0).max(5)  // 整数 + 范围
z.boolean()                     // 布尔
z.enum(['a', 'b', 'c'])        // 枚举
z.array(z.string())             // 数组
z.array(z.string()).min(1)      // 至少 1 个元素
z.object({ ... })               // 对象
z.object({ name: z.string(), nickname: z.string().optional() })  // 可选字段
```

和 TypeScript 类型的对应关系：`z.string()` → `string`，`z.number()` → `number`，`z.enum([...])` → 联合类型，`z.array(...)` → 数组类型，`z.object({...})` → 接口。

## 练习

### 练习一：定义文档元数据 schema

为知识工作台的文档定义一个 Zod schema，包含：文件名、创建时间、标签数组、分类（tech/business/other）、字数。要求：

- 文件名不能为空
- 标签至少 1 个
- 字数必须是正整数

用 `z.infer` 推导类型，再写几个测试数据验证校验逻辑。

### 练习二：对比三种输出方式

用同一个 prompt（"分析这段文档的核心功能"），分别用：

1. 普通文本输出
2. JSON Mode（`text: { format: { type: 'json_object' } }`）
3. Structured Outputs（`responses.parse` + Zod schema）

对比输出的一致性和可解析性。哪种最适合在代码里使用？

---

## 参考答案

### 练习一

```typescript
import { z } from 'zod'

const DocMetadataSchema = z.object({
  filename: z.string().min(1),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  tags: z.array(z.string()).min(1),
  category: z.enum(['tech', 'business', 'other']),
  wordCount: z.number().int().positive(),
})

type DocMetadata = z.infer<typeof DocMetadataSchema>

// 测试
DocMetadataSchema.parse({
  filename: 'product-spec.md',
  createdAt: '2024-01-15',
  tags: ['产品', '登录'],
  category: 'tech',
  wordCount: 3500,
}) // ✅ 通过

DocMetadataSchema.safeParse({
  filename: '',
  createdAt: '2024-01-15',
  tags: [],
  category: 'unknown',
  wordCount: -1,
}) // ❌ 失败：filename 为空, tags 为空, category 不在枚举中, wordCount 为负
```

### 练习二

普通文本输出每次措辞不同，程序无法可靠解析。JSON Mode 保证合法 JSON 但字段名和结构不一致——有时叫 `title`，有时叫 `name`，有时多个 `features` 字段，有时只有一个 `summary`。Structured Outputs 保证字段名、类型和结构完全符合 schema 定义，程序可以直接使用 `response.output_parsed`，不需要任何解析或校验逻辑。

---

**下一课**: [第6课：流式响应——把问答改成流式](./06-流式响应前端体验与取消请求.md)
