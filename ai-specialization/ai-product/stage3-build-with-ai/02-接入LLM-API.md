# 第2课：接入 LLM API

> **课程定位**：掌握多模型接入、降级策略和成本控制的工程实践
> **前置知识**：了解基本的 LLM API 调用方式
> **预计时长**：40 分钟

---

## 场景引入

你的 AI 产品上线了，用户量从 100 增长到 10000。某天凌晨 3 点，OpenAI API 宕机了，你的产品完全不可用。用户在社交媒体上抱怨："这破产品又挂了。"你翻看账单，发现上个月 API 费用比收入还高。这时候你才意识到，只接一个模型、没有降级策略、没有成本控制，产品根本无法持续运营。

---

## 学习目标

完成本课学习后，你将能够：

1. 设计统一的模型接入层，支持多模型切换
2. 实现 API 降级和容错策略
3. 建立 Token 计量和成本控制机制
4. 选择合适的模型组合来平衡质量和成本

---

## 一、为什么不能只接一个模型

### 1.1 单一供应商的风险

```
只用 OpenAI 的风险：

1. 可用性风险
   OpenAI API 偶尔会宕机或限流
   你的产品 = 你的产品 + OpenAI 的可靠性

2. 成本风险
   OpenAI 涨价你没有任何谈判筹码
   你的命运掌握在别人手里

3. 锁定风险
   所有 Prompt 都针对 GPT 优化
   迁移成本随时间越来越高

4. 合规风险
   某些场景可能需要数据不出境
   OpenAI 不一定满足所有地区的合规要求
```

### 1.2 多模型架构的价值

```
┌─────────────────────────────────────────────────────────────┐
│                    统一模型接入层                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  业务代码                                                   │
│     │                                                       │
│     ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ModelRouter（模型路由器）                 │   │
│  │                                                      │   │
│  │  - 统一接口：业务代码不关心具体用哪个模型              │   │
│  │  - 降级策略：主模型不可用时自动切换备用模型            │   │
│  │  - 成本控制：根据任务类型选择性价比最优的模型          │   │
│  │  - 质量监控：追踪每个模型的输出质量                    │   │
│  └─────────────────────────────────────────────────────┘   │
│     │           │            │            │                 │
│     ▼           ▼            ▼            ▼                 │
│  OpenAI    Anthropic    本地模型     国内模型               │
│  GPT-4o    Claude       Ollama       通义/文心             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、统一模型接入层设计

### 2.1 定义统一接口

```typescript
// types/model.ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom'
  model: string
  temperature?: number
  maxTokens?: number
  apiKey?: string
  baseUrl?: string
}

export interface ChatResponse {
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string        // 实际使用的模型
  latencyMs: number    // 响应耗时
}

export interface ModelProvider {
  chat(messages: ChatMessage[], config: ModelConfig): Promise<ChatResponse>
  streamChat(messages: ChatMessage[], config: ModelConfig): AsyncIterable<string>
}
```

### 2.2 实现多 Provider

```typescript
// providers/openai.ts
import OpenAI from 'openai'

export class OpenAIProvider implements ModelProvider {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async chat(messages: ChatMessage[], config: ModelConfig): Promise<ChatResponse> {
    const start = Date.now()
    const response = await this.client.chat.completions.create({
      model: config.model,
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 2000,
    })

    const choice = response.choices[0]
    return {
      content: choice.message.content ?? '',
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      model: response.model,
      latencyMs: Date.now() - start,
    }
  }

  async *streamChat(messages: ChatMessage[], config: ModelConfig) {
    const stream = await this.client.chat.completions.create({
      model: config.model,
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 2000,
      stream: true,
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) yield content
    }
  }
}

// providers/anthropic.ts
import Anthropic from '@anthropic-ai/sdk'

export class AnthropicProvider implements ModelProvider {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async chat(messages: ChatMessage[], config: ModelConfig): Promise<ChatResponse> {
    const start = Date.now()

    // Anthropic 的 system message 需要单独传
    const systemMsg = messages.find(m => m.role === 'system')
    const chatMsgs = messages.filter(m => m.role !== 'system')

    const response = await this.client.messages.create({
      model: config.model,
      system: systemMsg?.content,
      messages: chatMsgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      max_tokens: config.maxTokens ?? 2000,
      temperature: config.temperature ?? 0.7,
    })

    const textBlock = response.content.find(b => b.type === 'text')
    return {
      content: textBlock?.text ?? '',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: response.model,
      latencyMs: Date.now() - start,
    }
  }

  async *streamChat(messages: ChatMessage[], config: ModelConfig) {
    const systemMsg = messages.find(m => m.role === 'system')
    const chatMsgs = messages.filter(m => m.role !== 'system')

    const stream = this.client.messages.stream({
      model: config.model,
      system: systemMsg?.content,
      messages: chatMsgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      max_tokens: config.maxTokens ?? 2000,
      temperature: config.temperature ?? 0.7,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }
}
```

### 2.3 模型路由器

```typescript
// router/model-router.ts
export class ModelRouter {
  private providers: Map<string, ModelProvider> = new Map()
  private configs: Map<string, ModelConfig> = new Map()

  constructor() {
    // 注册 Provider
    this.providers.set('openai', new OpenAIProvider(process.env.OPENAI_API_KEY!))
    this.providers.set('anthropic', new AnthropicProvider(process.env.ANTHROPIC_API_KEY!))

    // 注册模型配置
    this.configs.set('default', {
      provider: 'openai',
      model: 'gpt-4o',
    })
    this.configs.set('fast', {
      provider: 'openai',
      model: 'gpt-4o-mini',
    })
    this.configs.set('fallback', {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
    })
  }

  async chat(
    messages: ChatMessage[],
    options: { tier?: 'default' | 'fast' | 'fallback'; maxRetries?: number } = {}
  ): Promise<ChatResponse> {
    const { tier = 'default', maxRetries = 2 } = options
    const config = this.configs.get(tier)!
    const provider = this.providers.get(config.provider)!

    try {
      return await provider.chat(messages, config)
    } catch (error) {
      if (maxRetries > 0) {
        console.warn(`模型 ${config.model} 调用失败，尝试降级`)
        // 降级到下一个 tier
        const nextTier = tier === 'default' ? 'fast' : 'fallback'
        return this.chat(messages, { tier: nextTier, maxRetries: maxRetries - 1 })
      }
      throw error
    }
  }
}
```

---

## 三、降级策略

### 3.1 降级层级

```typescript
// 降级策略配置
const degradationStrategy = {
  // 第一层：重试当前模型
  level1: {
    action: 'retry',
    maxRetries: 2,
    backoffMs: [1000, 3000], // 指数退避
  },

  // 第二层：切换到同供应商的轻量模型
  level2: {
    action: 'switch_model',
    mapping: {
      'gpt-4o': 'gpt-4o-mini',
      'claude-3-5-sonnet': 'claude-3-5-haiku',
    },
  },

  // 第三层：切换到备用供应商
  level3: {
    action: 'switch_provider',
    mapping: {
      'openai': 'anthropic',
      'anthropic': 'openai',
    },
  },

  // 第四层：返回缓存结果或降级响应
  level4: {
    action: 'degrade_response',
    strategies: ['cached_result', 'simplified_prompt', 'error_message'],
  },
}
```

### 3.2 实现带降级的调用

```typescript
// services/chat-with-fallback.ts
export async function chatWithFallback(
  messages: ChatMessage[],
  options: { useCase: string }
): Promise<ChatResponse> {
  const strategies = getStrategiesForUseCase(options.useCase)

  for (const strategy of strategies) {
    try {
      return await strategy.execute(messages)
    } catch (error) {
      console.error(`策略 ${strategy.name} 失败:`, error)
      continue
    }
  }

  // 所有策略都失败
  return {
    content: '抱歉，AI 服务暂时不可用，请稍后重试。',
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    model: 'fallback-message',
    latencyMs: 0,
  }
}

function getStrategiesForUseCase(useCase: string): Strategy[] {
  // 根据用例返回不同的降级策略链
  switch (useCase) {
    case 'chat':
      return [
        { name: 'gpt-4o', execute: (msgs) => callModel('gpt-4o', msgs) },
        { name: 'gpt-4o-mini', execute: (msgs) => callModel('gpt-4o-mini', msgs) },
        { name: 'claude-sonnet', execute: (msgs) => callModel('claude-sonnet', msgs) },
      ]

    case 'summarize':
      // 摘要任务可以用更便宜的模型
      return [
        { name: 'gpt-4o-mini', execute: (msgs) => callModel('gpt-4o-mini', msgs) },
        { name: 'claude-haiku', execute: (msgs) => callModel('claude-haiku', msgs) },
      ]

    default:
      return [{ name: 'gpt-4o', execute: (msgs) => callModel('gpt-4o', msgs) }]
  }
}
```

---

## 四、成本控制

### 4.1 Token 计量

```typescript
// services/token-tracker.ts
export class TokenTracker {
  private redis: Redis

  constructor(redis: Redis) {
    this.redis = redis
  }

  // 记录一次 API 调用的 Token 消耗
  async recordUsage(params: {
    userId: string
    model: string
    promptTokens: number
    completionTokens: number
    feature: string  // 功能标识，如 'chat', 'summarize', 'rag'
  }) {
    const cost = this.calculateCost(params.model, params.promptTokens, params.completionTokens)
    const date = new Date().toISOString().split('T')[0]

    // 按用户按天累计
    await this.redis.hincrby(`usage:${params.userId}:${date}`, 'totalTokens', params.promptTokens + params.completionTokens)
    await this.redis.hincrbyfloat(`usage:${params.userId}:${date}`, 'totalCost', cost)
    await this.redis.hincrby(`usage:${params.userId}:${date}:${params.feature}`, 'count', 1)

    // 按功能累计（用于成本分析）
    await this.redis.hincrby(`feature-usage:${params.feature}:${date}`, 'tokens', params.promptTokens + params.completionTokens)
    await this.redis.hincrbyfloat(`feature-usage:${params.feature}:${date}`, 'cost', cost)
  }

  // 检查用户是否超出配额
  async checkQuota(userId: string, limit: { dailyTokens?: number; dailyCost?: number }): Promise<boolean> {
    const date = new Date().toISOString().split('T')[0]
    const usage = await this.redis.hgetall(`usage:${userId}:${date}`)

    if (limit.dailyTokens && Number(usage.totalTokens || 0) > limit.dailyTokens) {
      return false
    }
    if (limit.dailyCost && Number(usage.totalCost || 0) > limit.dailyCost) {
      return false
    }
    return true
  }

  // 计算成本（每 1M token 的价格）
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const prices: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.5, output: 10 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'claude-3-5-sonnet': { input: 3, output: 15 },
      'claude-3-5-haiku': { input: 0.8, output: 4 },
    }

    const price = prices[model] ?? prices['gpt-4o-mini']
    return (promptTokens * price.input + completionTokens * price.output) / 1_000_000
  }
}
```

### 4.2 用户配额管理

```typescript
// middleware/quota-check.ts
export function withQuotaCheck(handler: NextApiHandler, feature: string): NextApiHandler {
  return async (req, res) => {
    const userId = req.session?.userId
    if (!userId) {
      return res.status(401).json({ error: '未登录' })
    }

    const userPlan = await getUserPlan(userId)
    const limits = getPlanLimits(userPlan)

    const hasQuota = await tokenTracker.checkQuota(userId, {
      dailyTokens: limits.dailyTokens,
      dailyCost: limits.dailyCost,
    })

    if (!hasQuota) {
      return res.status(429).json({
        error: '已达到今日使用上限',
        upgradeUrl: '/pricing',
      })
    }

    return handler(req, res)
  }
}

// 套餐配额定义
function getPlanLimits(plan: string) {
  const limits: Record<string, { dailyTokens: number; dailyCost: number }> = {
    free: { dailyTokens: 50_000, dailyCost: 0.1 },
    pro: { dailyTokens: 500_000, dailyCost: 1.0 },
    team: { dailyTokens: 2_000_000, dailyCost: 5.0 },
  }
  return limits[plan] ?? limits.free
}
```

### 4.3 成本优化技巧

```typescript
// 优化 1：Prompt 缓存（对于重复的 system prompt）
const cachedSystemPrompt = '你是一个专业的...'  // 长 system prompt
// 使用 prompt caching（OpenAI/Anthropic 都支持），重复的前缀只需计算一次

// 优化 2：根据任务选择模型
function selectModelForTask(task: string): ModelConfig {
  const taskModelMap: Record<string, ModelConfig> = {
    // 简单任务用便宜模型
    'classify': { provider: 'openai', model: 'gpt-4o-mini' },
    'extract': { provider: 'openai', model: 'gpt-4o-mini' },
    'summarize': { provider: 'openai', model: 'gpt-4o-mini' },

    // 复杂任务用强模型
    'reason': { provider: 'openai', model: 'gpt-4o' },
    'write': { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    'code': { provider: 'openai', model: 'gpt-4o' },
  }
  return taskModelMap[task] ?? { provider: 'openai', model: 'gpt-4o-mini' }
}

// 优化 3：减少不必要的 Token 消耗
function optimizeMessages(messages: ChatMessage[]): ChatMessage[] {
  // 1. 截断过长的历史记录
  const maxHistory = 10
  if (messages.length > maxHistory) {
    return [messages[0], ...messages.slice(-maxHistory)]  // 保留 system + 最近 N 条
  }

  // 2. 压缩历史摘要
  // 对于超长对话，将早期对话压缩为摘要

  return messages
}
```

---

## 五、模型选型指南

### 5.1 任务-模型匹配

```typescript
// 不同任务推荐的模型选择
const modelSelectionGuide = {
  // 需要高质量推理的任务
  complexReasoning: {
    primary: 'gpt-4o',
    fallback: 'claude-3-5-sonnet',
    cost: 'high',
    quality: 'high',
  },

  // 简单分类/提取任务
  simpleExtraction: {
    primary: 'gpt-4o-mini',
    fallback: 'claude-3-5-haiku',
    cost: 'low',
    quality: 'good',
  },

  // 长文写作
  longFormWriting: {
    primary: 'claude-3-5-sonnet',
    fallback: 'gpt-4o',
    cost: 'high',
    quality: 'high',
  },

  // 代码生成
  codeGeneration: {
    primary: 'gpt-4o',
    fallback: 'claude-3-5-sonnet',
    cost: 'high',
    quality: 'high',
  },

  // 中文场景
  chineseContent: {
    primary: 'gpt-4o',
    fallback: 'qwen-max',  // 通义千问
    cost: 'medium',
    quality: 'good',
  },
}
```

---

## 常见误区

### 误区一：只接一个模型就够了

单一模型意味着单一故障点。至少要有两个不同供应商的模型作为备选，确保一个挂了另一个能顶上。

### 误区二：所有任务都用最强模型

GPT-4o 做分类任务是浪费钱。简单任务用 GPT-4o-mini 就够了，成本差 10 倍以上，质量差距在简单任务上几乎不可感知。

### 误区三：不做 Token 计量

不计量就不知道钱花在哪了。上线前必须有 Token 记录和成本看板，否则月底账单会让你大吃一惊。

### 误区四：降级策略 = 随便换一个模型

降级不是随机切换，而是有策略的：先重试 → 同供应商轻量模型 → 不同供应商 → 降级响应。每一步都要有日志和监控。

---

## 工程建议

### 1. 抽象统一接口，不直接调 SDK

业务代码不应该直接 `import OpenAI`。通过统一的 ModelRouter 调用，切换模型时只改配置不改业务代码。

### 2. 建立成本看板

上线前就搭建 Token 使用量和成本的看板，按功能、按用户、按天维度统计。这是后续定价和优化的数据基础。

### 3. 设置预算告警

当每日 API 成本超过预期的 80% 时触发告警。不要等到月底才发现成本超支。

### 4. 定期评估模型性价比

模型市场变化很快，新模型不断发布。每个季度评估一次当前模型组合的性价比，及时调整。

---

## 小结

接入 LLM API 不是"调一个接口"的事。生产环境需要统一的模型接入层、多级降级策略、Token 计量和成本控制。核心原则是：业务代码不感知具体模型，系统能自动降级，成本可追踪可控制。

---

## 练习

1. **统一接口实现**：为你的项目实现一个 ModelRouter，至少支持 OpenAI 和另一个 Provider，包含降级逻辑。
2. **Token 追踪**：实现一个简单的 Token 使用量记录中间件，记录每次调用的 Token 消耗和成本。
3. **成本分析**：估算你产品的核心功能（假设 1000 DAU）的月度 API 成本，分析哪些功能最费钱。
4. **降级测试**：模拟主模型不可用的场景，验证你的降级策略是否正常工作。

---

## 参考答案

### 练习一

**思路**：基于课程中的 ModelRouter 和 ModelProvider 接口，实现一个支持 OpenAI 和 Anthropic 的路由器，包含主备降级逻辑。关键设计点：统一接口、错误捕获、自动切换备用模型。

**答案**：

```typescript
// lib/ai/model-router.ts
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatResponse {
  content: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  model: string
  latencyMs: number
}

interface ModelProvider {
  chat(messages: ChatMessage[], model: string, options?: { temperature?: number; maxTokens?: number }): Promise<ChatResponse>
}

class OpenAIProvider implements ModelProvider {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  async chat(messages: ChatMessage[], model: string, options = {}): Promise<ChatResponse> {
    const start = Date.now()
    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
    })
    return {
      content: response.choices[0].message.content ?? '',
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      model: response.model,
      latencyMs: Date.now() - start,
    }
  }
}

class AnthropicProvider implements ModelProvider {
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  async chat(messages: ChatMessage[], model: string, options = {}): Promise<ChatResponse> {
    const start = Date.now()
    const systemMsg = messages.find(m => m.role === 'system')
    const chatMsgs = messages.filter(m => m.role !== 'system')

    const response = await this.client.messages.create({
      model,
      system: systemMsg?.content,
      messages: chatMsgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      max_tokens: options.maxTokens ?? 2000,
      temperature: options.temperature ?? 0.7,
    })

    const textBlock = response.content.find(b => b.type === 'text')
    return {
      content: textBlock?.text ?? '',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: response.model,
      latencyMs: Date.now() - start,
    }
  }
}

export class ModelRouter {
  private providers: Record<string, ModelProvider> = {
    openai: new OpenAIProvider(),
    anthropic: new AnthropicProvider(),
  }

  private routeTable = {
    default: { provider: 'openai', model: 'gpt-4o' },
    fallback: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    fast: { provider: 'openai', model: 'gpt-4o-mini' },
  }

  async chat(
    messages: ChatMessage[],
    tier: 'default' | 'fallback' | 'fast' = 'default',
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<ChatResponse> {
    const primary = this.routeTable[tier] ?? this.routeTable.default
    try {
      return await this.providers[primary.provider].chat(messages, primary.model, options)
    } catch (error) {
      console.error(`[ModelRouter] 主模型 ${primary.provider}/${primary.model} 失败:`, error)

      if (tier === 'fallback') {
        throw new Error('所有模型均不可用')
      }

      console.log('[ModelRouter] 切换到备用模型...')
      const fallback = this.routeTable.fallback
      return await this.providers[fallback.provider].chat(messages, fallback.model, options)
    }
  }
}

export const modelRouter = new ModelRouter()
```

**要点**：
- 业务代码只调 `modelRouter.chat()`，不感知具体模型——这是统一接口的核心价值
- 降级逻辑在 Router 内部，业务代码不需要 try-catch 降级
- 主模型失败时先记录日志再切换，方便事后分析失败原因

### 练习二

**思路**：在 ModelRouter 的 chat 方法中加入 Token 使用量记录，每次调用后将消耗写入存储。设计一个中间件结构，不侵入核心调用逻辑。

**答案**：

```typescript
// lib/ai/token-tracker.ts
interface TokenUsageLog {
  id: string
  timestamp: string
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
  latencyMs: number
  tier: string
}

// 模型价格表（美元/百万 Token）
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
}

export class TokenTracker {
  private logs: TokenUsageLog[] = []

  calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = MODEL_PRICING[model]
    if (!pricing) return 0
    return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000
  }

  track(params: {
    provider: string
    model: string
    usage: { promptTokens: number; completionTokens: number; totalTokens: number }
    latencyMs: number
    tier: string
  }): void {
    const cost = this.calculateCost(params.model, params.usage.promptTokens, params.usage.completionTokens)
    const log: TokenUsageLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      provider: params.provider,
      model: params.model,
      promptTokens: params.usage.promptTokens,
      completionTokens: params.usage.completionTokens,
      totalTokens: params.usage.totalTokens,
      estimatedCost: cost,
      latencyMs: params.latencyMs,
      tier: params.tier,
    }
    this.logs.push(log)
    console.log(`[TokenTracker] ${params.model}: ${params.usage.totalTokens} tokens, $${cost.toFixed(4)}, ${params.latencyMs}ms`)
  }

  getSummary() {
    const totalTokens = this.logs.reduce((sum, l) => sum + l.totalTokens, 0)
    const totalCost = this.logs.reduce((sum, l) => sum + l.estimatedCost, 0)
    const avgLatency = this.logs.length > 0
      ? this.logs.reduce((sum, l) => sum + l.latencyMs, 0) / this.logs.length
      : 0
    return { totalRequests: this.logs.length, totalTokens, totalCost, avgLatency }
  }

  getLogs(): TokenUsageLog[] {
    return [...this.logs]
  }
}

export const tokenTracker = new TokenTracker()

// 在 ModelRouter 中集成：
// chat 方法返回前调用：
// tokenTracker.track({ provider, model, usage: response.usage, latencyMs: response.latencyMs, tier })
```

**要点**：
- Token 追踪要在每次 API 调用后立即记录，不能依赖用户上报
- 计算成本时区分 input/output token 的价格，两者差异很大
- 生产环境中 logs 应持久化到数据库，而不是内存数组

### 练习三

**思路**：先估算各功能的调用频率和平均 Token 消耗，再乘以模型单价得到月度成本。关键是区分"核心功能"和"辅助功能"，核心功能用高质量模型，辅助功能用低成本模型。

**答案**：

假设产品是一个"AI 文档助手"，1000 DAU，核心功能及成本估算：

| 功能 | 日均调用次数 | 平均 Token/次 | 使用模型 | 月 Token 消耗 | 月成本 |
|------|------------|-------------|---------|-------------|--------|
| 文档问答（RAG） | 3000 | 2000 (800 in + 1200 out) | gpt-4o | 1.8 亿 | $45 输入 + $360 输出 = $405 |
| 内容续写 | 2000 | 1500 (500 in + 1000 out) | gpt-4o | 9000 万 | $11.25 + $90 = $101.25 |
| 文档摘要 | 1000 | 3000 (2500 in + 500 out) | gpt-4o | 9000 万 | $56.25 + $45 = $101.25 |
| 意图识别（路由） | 5000 | 200 (150 in + 50 out) | gpt-4o-mini | 3000 万 | $0.675 + $0.9 = $1.575 |
| 合计 | 11000 | - | - | 3.9 亿 | **$609/月** |

**分析**：
- 文档问答是最费钱的功能（占总成本 66%），因为调用频率高且每次 Token 消耗大
- 意图识别可以用低成本模型（gpt-4o-mini），成本降低 90%+
- **优化建议**：文档问答的 topK 从 5 降到 3（减少 prompt 长度），可省约 30% 成本；缓存高频问题的回答，可再省 20%

**要点**：
- 成本大头通常是"调用频率 × 单次 Token 消耗"都高的功能
- 不同功能用不同模型是成本控制的核心策略
- 1000 DAU 的产品月 API 成本在 $500-$1000 量级是正常的，低于 $200 说明可能过度优化了质量

### 练习四

**思路**：模拟主模型抛出异常的场景，验证降级逻辑是否正确执行。关键是测试三个场景：主模型超时、主模型返回错误、主备都失败。

**答案**：

```typescript
// tests/model-router.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ModelRouter } from '../lib/ai/model-router'

describe('ModelRouter 降级策略', () => {
  it('主模型正常时使用主模型', async () => {
    const router = new ModelRouter()
    const response = await router.chat(
      [{ role: 'user', content: '你好' }],
      'default'
    )
    expect(response.content).toBeTruthy()
    expect(response.model).toBe('gpt-4o')
  })

  it('主模型超时时自动降级到备用模型', async () => {
    const router = new ModelRouter()
    // mock OpenAI provider 让它抛超时错误
    vi.spyOn(router['providers']['openai'], 'chat').mockRejectedValueOnce(
      new Error('Request timeout')
    )

    const response = await router.chat(
      [{ role: 'user', content: '你好' }],
      'default'
    )
    // 应该降级到 Anthropic
    expect(response.model).toContain('claude')
    expect(response.content).toBeTruthy()
  })

  it('主备都失败时抛出错误', async () => {
    const router = new ModelRouter()
    vi.spyOn(router['providers']['openai'], 'chat').mockRejectedValue(
      new Error('OpenAI down')
    )
    vi.spyOn(router['providers']['anthropic'], 'chat').mockRejectedValue(
      new Error('Anthropic down')
    )

    await expect(
      router.chat([{ role: 'user', content: '你好' }], 'default')
    ).rejects.toThrow('所有模型均不可用')
  })

  it('降级时记录日志', async () => {
    const consoleSpy = vi.spyOn(console, 'error')
    const router = new ModelRouter()
    vi.spyOn(router['providers']['openai'], 'chat').mockRejectedValueOnce(
      new Error('Service unavailable')
    )

    await router.chat([{ role: 'user', content: '你好' }], 'default')

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('主模型'),
      expect.any(Error)
    )
  })
})
```

**要点**：
- 降级测试至少覆盖三个场景：主模型失败降级成功、主备都失败、降级时有日志
- 用 mock 模拟模型失败，不要真的调 API（耗时且不稳定）
- 生产环境还需要测试"部分失败"场景（如主模型返回空内容、返回格式错误）
