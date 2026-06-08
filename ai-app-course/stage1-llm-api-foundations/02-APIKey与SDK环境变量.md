# 第2课：API Key、SDK 与环境变量

> **课程定位**：从零配置到第一次成功的 API 请求
> **前置知识**：第 1 课的内容、基本的终端操作
> **预计时长**：40 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 理解 API Key 的本质和安全风险
2. 正确配置环境变量，确保密钥不出现在前端代码
3. 使用 OpenAI SDK 发起第一个 API 请求
4. 理解请求的完整生命周期
5. 区分服务端调用和客户端调用的差异

---

## 一、API Key 是什么

### 1.1 一句话理解

API Key 就是你的"通行证"——告诉大模型服务提供商"我是谁，我有权使用这个服务"。

```
类比：

  去健身房 → 刷会员卡 → 健身房知道你是会员 → 允许你使用器材
  调用 API  → 带上 API Key → 服务商知道你是付费用户 → 允许你调用模型
```

### 1.2 API Key 长什么样

```
OpenAI API Key：
  sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  │ │                                                   │
  │ └── 项目标识                                        │
  └── 固定前缀 "sk-"                                    │
                                                      实际密钥（很长的随机字符串）

特点：
  - 以 sk- 开头
  - 长度通常在 50 个字符以上
  - 每个账户可以创建多个 Key
  - 可以设置权限范围（只读、读写等）
```

### 1.3 为什么 API Key 必须保密

```
┌─────────────────────────────────────────────────────────────────┐
│                  API Key 泄露的后果                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  场景：你不小心把 API Key 提交到了 GitHub 公开仓库               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  5 分钟内：                                              │   │
│  │    自动扫描机器人发现你的 Key                             │   │
│  │                                                         │   │
│  │  10 分钟内：                                             │   │
│  │    有人用你的 Key 大量调用 API                            │   │
│  │                                                         │   │
│  │  1 小时后：                                              │   │
│  │    你的账单已经几百甚至几千美元                            │   │
│  │                                                         │   │
│  │  你收到的：                                              │   │
│  │    一张巨额账单 + 一封"请立即轮换密钥"的邮件               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  这不是假设，这是真实发生过的事情。                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、环境变量：保护密钥的标准方式

### 2.1 为什么用环境变量

```
❌ 错误做法：把 Key 写在代码里

  const apiKey = "sk-proj-xxxxxxxxxxxx"  // 直接写死在代码
  // 一旦代码提交到 Git，Key 就泄露了

✅ 正确做法：用环境变量

  const apiKey = process.env.OPENAI_API_KEY  // 从环境变量读取
  // 代码里没有真实的 Key，安全
```

### 2.2 环境变量的工作原理

```
┌─────────────────────────────────────────────────────────────────┐
│                    环境变量的工作方式                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐                                          │
│  │  .env 文件        │  ← 本地存放密钥的文件                     │
│  │  （不提交到 Git）  │                                          │
│  │                   │                                          │
│  │  OPENAI_KEY=sk-xx │                                          │
│  └────────┬─────────┘                                          │
│           │                                                     │
│           │ 读取                                                │
│           ▼                                                     │
│  ┌──────────────────┐                                          │
│  │  Node.js 进程     │  ← process.env.OPENAI_KEY               │
│  │                   │                                          │
│  │  你的代码运行时   │                                          │
│  │  可以访问这些值   │                                          │
│  └──────────────────┘                                          │
│                                                                 │
│  .gitignore 中必须包含 .env                                      │
│  确保 .env 永远不会被提交到 Git                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 配置 .env 文件

在项目根目录创建 `.env` 文件：

```bash
# .env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

同时确保 `.gitignore` 包含：

```bash
# .gitignore
.env
.env.local
.env.*.local
```

### 2.4 不同环境的管理

```
┌─────────────────────────────────────────────────────────────────┐
│                    不同环境的密钥管理                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  本地开发：                                                      │
│    .env.local           ← 你的本地密钥，不提交                   │
│                                                                 │
│  测试环境：                                                      │
│    .env.test            ← 测试用的密钥（可能额度较小）            │
│                                                                 │
│  生产环境：                                                      │
│    Vercel / Docker 环境变量  ← 在部署平台配置，不写在代码里      │
│                                                                 │
│  规则：                                                          │
│    - 每个环境用不同的 Key                                        │
│    - 生产环境的 Key 权限最小化                                   │
│    - 定期轮换 Key                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、安装与配置 SDK

### 3.1 什么是 SDK

```
SDK（Software Development Kit）= 封装好的工具包

你直接调 API：
  - 自己构造 HTTP 请求
  - 自己处理认证头
  - 自己解析响应
  - 自己处理错误

用 SDK：
  - import openai
  - 调一个函数就行
  - SDK 帮你处理了所有细节
```

### 3.2 安装 OpenAI SDK

```bash
# 创建项目（如果还没有）
mkdir ai-app && cd ai-app
npm init -y

# 安装 OpenAI SDK
npm install openai

# 安装 dotenv（用于加载 .env 文件）
npm install dotenv

# 安装 TypeScript 相关（推荐）
npm install -D typescript @types/node tsx
```

### 3.3 项目结构

```
ai-app/
├── .env                  ← 密钥（不提交到 Git）
├── .gitignore            ← 忽略 .env
├── package.json
├── tsconfig.json
├── src/
│   ├── lib/
│   │   └── openai.ts     ← OpenAI 客户端初始化
│   └── examples/
│       └── first-call.ts ← 第一次 API 调用
```

### 3.4 初始化 OpenAI 客户端

```typescript
// src/lib/openai.ts
import OpenAI from 'openai'

// 从环境变量读取 API Key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default openai
```

---

## 四、第一次 API 调用

### 4.1 最简单的调用

```typescript
// src/examples/first-call.ts
import 'dotenv/config'  // 加载 .env 文件
import openai from '../lib/openai'

async function main() {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: '用一句话解释什么是 API' }
    ]
  })

  console.log(response.choices[0].message.content)
}

main()
```

运行：

```bash
npx tsx src/examples/first-call.ts
```

输出（每次可能不同）：

```
API 是软件之间通信的接口，让一个程序可以请求另一个程序的功能。
```

### 4.2 理解请求的生命周期

```
你的代码                        OpenAI 服务器
  │                                │
  │  1. 构造请求                    │
  │  { model, messages }           │
  │                                │
  │  2. SDK 自动添加               │
  │  Authorization: Bearer sk-xx   │
  │  Content-Type: application/json│
  │                                │
  │  3. 发送 HTTP POST             │
  │  POST /v1/chat/completions  ──→│
  │                                │
  │                                │  4. 验证 API Key
  │                                │  5. 检查配额
  │                                │  6. 调用模型
  │                                │  7. 生成回答
  │                                │
  │  8. 接收响应                 ←──│
  │  { choices, usage }            │
  │                                │
  │  9. SDK 解析 JSON              │
  │  10. 返回 TypeScript 对象      │
```

### 4.3 响应的结构

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: '你好' }]
})

// response 的结构：
{
  id: 'chatcmpl-xxxx',           // 请求 ID，用于排查问题
  object: 'chat.completion',
  created: 1234567890,
  model: 'gpt-4o-mini-2024-07-18',
  choices: [                       // 模型生成的回答（通常 1 个）
    {
      index: 0,
      message: {
        role: 'assistant',
        content: '你好！有什么我可以帮你的吗？'
      },
      finish_reason: 'stop'        // 生成结束的原因
    }
  ],
  usage: {                         // token 使用量
    prompt_tokens: 10,             // 输入的 token 数
    completion_tokens: 12,         // 输出的 token 数
    total_tokens: 22               // 总共消耗的 token 数
  }
}
```

---

## 五、密钥安全的三条铁律

### 5.1 铁律一：密钥不进前端

```
┌─────────────────────────────────────────────────────────────────┐
│                    前端 vs 后端                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ❌ 绝对错误：                                                  │
│                                                                 │
│    // React 组件                                                │
│    const apiKey = "sk-proj-xxxxx"  // 写在前端代码               │
│    // 用户打开 DevTools → Network → 看到请求头 → 拿到 Key        │
│                                                                 │
│  ✅ 正确做法：                                                  │
│                                                                 │
│    前端（React）              后端（Next.js API Route）          │
│    ┌──────────────┐          ┌──────────────────┐              │
│    │              │  HTTP    │                  │              │
│    │  用户界面    │─────────→│  /api/chat       │              │
│    │              │          │  有 API Key      │              │
│    │  没有 Key    │←─────────│  调用 OpenAI     │              │
│    │              │  回答    │                  │              │
│    └──────────────┘          └──────────────────┘              │
│                                                                 │
│    用户只能看到前端代码，看不到后端的 Key                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 铁律二：.env 不进 Git

```bash
# .gitignore 必须包含
.env
.env.local
.env.*.local

# 检查是否已经提交过
git log --all --full-history -- .env

# 如果已经提交了，立即：
# 1. 轮换 Key（去 OpenAI 后台重新生成）
# 2. 从 Git 历史中移除
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty -- --all
```

### 5.3 铁律三：生产环境用平台的密钥管理

```
┌─────────────────────────────────────────────────────────────────┐
│                 不同部署平台的密钥配置                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Vercel：                                                       │
│    Settings → Environment Variables → 添加 OPENAI_API_KEY       │
│                                                                 │
│  Docker：                                                       │
│    docker run -e OPENAI_API_KEY=sk-xx my-app                    │
│    或使用 docker-compose 的 env_file                             │
│                                                                 │
│  云服务器：                                                      │
│    在系统环境变量中配置，不写在代码或配置文件里                    │
│                                                                 │
│  原则：                                                          │
│    - 密钥通过环境变量注入                                        │
│    - 不同环境用不同的 Key                                        │
│    - 生产 Key 设置用量上限                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 六、请求生命周期详解

### 6.1 一个请求从发出到响应经历了什么

```typescript
// 完整的请求流程示例
import 'dotenv/config'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30 * 1000,        // 30 秒超时
  maxRetries: 2,              // 失败重试 2 次
})

async function chat(userMessage: string) {
  console.time('total')

  // 1. 构造请求（本地，瞬间完成）
  console.log('构造请求...')

  // 2. 发送网络请求（网络延迟）
  console.time('network')
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: '你是一个友好的助手。' },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.7,
    max_tokens: 500,
  })
  console.timeEnd('network')

  // 3. 解析响应（本地，瞬间完成）
  const answer = response.choices[0].message.content
  const tokens = response.usage

  console.log('回答:', answer)
  console.log('Token 使用:', tokens)
  console.timeEnd('total')

  return answer
}

chat('什么是 API？')
```

### 6.2 耗时分析

```
一个 API 请求的时间分布：

  构造请求      ~1ms      本地操作
  DNS 解析      ~50ms     第一次慢，后续有缓存
  TCP 连接      ~100ms    建立连接
  TLS 握手      ~150ms    HTTPS 加密
  发送请求      ~10ms     数据传输
  ──────────────────────
  模型推理      500-5000ms  ← 主要耗时！
  ──────────────────────
  接收响应      ~50ms     数据传输
  解析 JSON     ~1ms      本地操作

总耗时：700-5500ms

关键认知：模型推理是最慢的部分，而且时间不固定。
```

---

## 七、常见错误与处理

### 7.1 错误类型

```typescript
import OpenAI from 'openai'

try {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: '你好' }]
  })
} catch (error) {
  if (error instanceof OpenAI.AuthenticationError) {
    // 401: API Key 无效或已过期
    console.error('API Key 无效，请检查你的密钥')
  } else if (error instanceof OpenAI.RateLimitError) {
    // 429: 请求太频繁，被限流了
    console.error('请求太频繁，请稍后再试')
  } else if (error instanceof OpenAI.APIError) {
    // 其他 API 错误
    console.error('API 错误:', error.status, error.message)
  } else {
    // 网络错误等
    console.error('未知错误:', error)
  }
}
```

### 7.2 错误处理的最佳实践

```
┌─────────────────────────────────────────────────────────────────┐
│                    错误处理策略                                   │
├──────────────┬──────────────────────────────────────────────────┤
│  错误类型     │  处理方式                                        │
├──────────────┼──────────────────────────────────────────────────┤
│  401 无效 Key │  提示用户检查配置，不重试                         │
│  429 限流     │  等待后重试（指数退避）                           │
│  500 服务错误 │  重试 1-2 次                                     │
│  超时         │  重试，或提示用户网络问题                         │
│  网络断开     │  提示用户检查网络                                │
└──────────────┴──────────────────────────────────────────────────┘
```

---

## 动手练习

### 练习一：配置你的环境

1. 去 [OpenAI Platform](https://platform.openai.com) 注册账号
2. 创建一个 API Key
3. 在项目根目录创建 `.env` 文件，写入你的 Key
4. 确认 `.gitignore` 包含 `.env`
5. 运行第一次 API 调用

### 练习二：观察请求响应

修改代码，打印完整的响应对象：

```typescript
const response = await openai.chat.completions.create({...})
console.log(JSON.stringify(response, null, 2))
```

回答以下问题：
1. `finish_reason` 有哪些可能的值？
2. `prompt_tokens` 和 `completion_tokens` 分别代表什么？
3. 请求的 `id` 有什么用？

### 练习三：错误处理

故意触发以下错误，观察错误信息：
1. 把 API Key 改成一个无效的值
2. 把模型名改成一个不存在的模型
3. 发送一个超长的消息（超过 token 限制）

---

## 小结

本课的核心要点：

1. **API Key 是通行证**：必须保密，泄露会导致账单爆炸
2. **环境变量是标准做法**：密钥不写在代码里，通过 `process.env` 读取
3. **密钥不进前端**：前端调后端，后端调 API，这是唯一正确的方式
4. **.env 不进 Git**：`.gitignore` 必须包含 `.env`
5. **SDK 简化了调用**：封装了认证、重试、错误处理等细节

---

## 下一课预告

下一课我们将深入文本生成的细节：如何控制输出长度、如何设置温度、如何处理空输出和超时。你会学会让模型"听话"地生成你想要的内容。
