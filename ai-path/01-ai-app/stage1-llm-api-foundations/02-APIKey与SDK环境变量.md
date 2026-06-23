# 第2课：API Key、SDK 与环境变量

> **前置知识**：第 1 课的内容、基本的终端操作
> **预计时长**：30 分钟（含注册和配置时间）

## 这节课要做什么

到这节课结束时，你会有一个能运行的项目目录，配置好了 OpenAI SDK 和环境变量，并成功跑通第一次 API 调用。这个项目骨架就是 AI Knowledge Workspace 的起点，后续所有课程都在它上面添砖加瓦。

## 创建项目

```bash
mkdir ai-knowledge-workspace && cd ai-knowledge-workspace
npm init -y
npm install openai dotenv
npm install -D typescript @types/node tsx
```

创建 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

项目结构：

```
ai-knowledge-workspace/
├── .env              ← 密钥（不提交到 Git）
├── .gitignore
├── package.json
├── tsconfig.json
└── src/
    └── lib/
        └── openai.ts ← OpenAI 客户端初始化
```

## 配置 API Key

### 获取 Key

去 [OpenAI Platform](https://platform.openai.com) 注册账号，进入 API Keys 页面，创建一个新 Key。创建后立即给它设置月度用量上限——这是防止泄露后账单爆炸的唯一保险。

### 配置环境变量

在项目根目录创建 `.env`：

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`.gitignore` 必须包含：

```
.env
.env.local
.env.*.local
```

这里有一个容易犯的错：如果你先创建了 `.env`，后来才加 `.gitignore`，那 `.env` 可能已经在 Git 历史里了。光加 `.gitignore` 只能防止未来的提交，已经泄露的 Key 需要去后台轮换。

### 初始化 OpenAI 客户端

```typescript
// src/lib/openai.ts
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30_000,
  maxRetries: 2,
})

export default openai
```

整个项目只初始化一次客户端，放在 `src/lib/openai.ts` 里。不要在每个文件里都 `new OpenAI()`。

## 密钥安全：三条铁律

**铁律一：密钥不进前端。** 前端代码是完全暴露给用户的。打开 DevTools → Network → 请求头 → 就能看到 Key。正确做法是前端调后端 API Route，后端持有 Key 并调用 OpenAI。后面阶段四会搭建完整的前后端架构，但这个原则从第一天就要遵守。

**铁律二：.env 不进 Git。** 如果已经在 Git 历史里了，去后台轮换 Key，然后清理历史。

**铁律三：生产环境用平台的密钥管理。** Vercel 用 Settings → Environment Variables，Docker 用 `-e` 或 `env_file`，云服务器用系统环境变量。不要把生产 Key 写在代码仓库或 Docker 镜像里。

## 跑通第一次调用

```typescript
// src/examples/first-call.ts
import 'dotenv/config'
import openai from '../lib/openai'

async function main() {
  const response = await openai.responses.create({
    model: 'gpt-5.5',
    input: [{ role: 'user', content: '用一句话解释什么是 RAG' }],
  })

  console.log('回答:', response.output_text)
  console.log('Token 使用:', response.usage)
}

main()
```

运行：

```bash
npx tsx src/examples/first-call.ts
```

如果看到模型的输出，说明环境配置成功。

### 理解请求的生命周期

刚才这个调用经历了什么：

```
你的代码                     OpenAI 服务器
  │                             │
  │ 构造请求 { model, input }   │
  │ SDK 添加 Authorization 头   │
  │ HTTP POST /v1/responses  ──→│
  │                             │ 验证 Key → 检查配额 → 调用模型
  │                          ←──│ 返回响应
  │ SDK 解析 JSON               │
  │ 返回 TypeScript 对象        │
```

模型推理是整个过程中最慢的部分（500ms-5s），构造请求和解析响应都是毫秒级。这个认知很重要——后面做流式响应和超时处理时会用到。

### 响应里有什么

```typescript
const response = await openai.responses.create({...})

// 关键字段：
response.id           // 请求 ID，排查问题时用
response.status       // 'completed' | 'incomplete' | 'failed'
response.output_text  // 模型的回答文本
response.usage        // { input_tokens, output_tokens, total_tokens }
```

`usage` 字段是成本控制的基础。输出 token 的价格通常是输入的 4 倍，所以控制输出长度比控制输入长度更重要。

## 错误处理：第一次就要做

不要等"上线再处理错误"。至少先处理这几种：

```typescript
import OpenAI from 'openai'

try {
  const response = await openai.responses.create({...})
} catch (error) {
  if (error instanceof OpenAI.AuthenticationError) {
    // 401: Key 无效 → 检查配置，不重试
  } else if (error instanceof OpenAI.RateLimitError) {
    // 429: 限流 → 等待后重试
  } else if (error instanceof OpenAI.BadRequestError) {
    // 400: 输入过长 → 缩短输入
  } else {
    // 网络错误、服务端错误等
  }
}
```

**故意触发这些错误**是学习错误处理的最快方式：把 Key 改成无效值试试 401，把模型名改成不存在的试试 404，发一个超长消息试试 400。

## 不同环境的密钥管理

| 环境 | Key 存放位置 | 说明 |
|------|------------|------|
| 本地开发 | `.env.local` | 不提交到 Git |
| 测试环境 | `.env.test` | 额度较小的 Key |
| 生产环境 | Vercel/Docker 环境变量 | 不写在代码里 |

每个环境用不同的 Key，这样某个环境泄露只需要轮换那一个。在 OpenAI 后台给 Key 加标签（如 `dev-xxx`、`prod-xxx`）方便管理。

## 练习

### 练习一：配置环境并跑通调用

按本课步骤完成：创建项目、配置 `.env`、初始化 SDK、运行 `first-call.ts`。确认看到模型输出和 token 使用量。

### 练习二：观察完整响应

修改代码，`console.log(JSON.stringify(response, null, 2))` 打印完整响应。找到 `status`、`usage`、`id` 字段，理解它们的作用。

### 练习三：故意触发错误

分别用无效 Key、不存在的模型名、超长输入触发错误，观察错误类型和信息。记录每种错误的处理策略。

---

## 参考答案

### 练习一

按步骤执行即可。关键是从第一天就养成安全习惯——创建 Key 后立即设置用量上限、配置 `.env`、确认 `.gitignore`。不要先把 Key 写在代码里"方便调试"。

### 练习二

`status` 的可能值：`completed`（正常完成）、`incomplete`（输出被截断，通常因为达到 max_output_tokens）、`failed`（请求失败）。

`usage.input_tokens` 是你发送给模型的所有内容的 token 数，`output_tokens` 是模型生成的回答的 token 数。成本 = input × 输入价格 + output × 输出价格。

`id` 用于排查问题——请求出错时把 `id` 提供给 OpenAI 支持团队，他们能定位到具体日志。在应用中记录每个请求的 `id` 也是审计的基础。

### 练习三

| 错误 | 类型 | 状态码 | 处理策略 |
|------|------|--------|---------|
| 无效 Key | `AuthenticationError` | 401 | 提示检查配置，不重试 |
| 不存在的模型 | `NotFoundError` | 404 | 检查模型名拼写 |
| 超长输入 | `BadRequestError` | 400 | 缩短输入或分段处理 |
| 限流 | `RateLimitError` | 429 | 等待后重试（指数退避） |

关键判断：401 不重试（Key 无效重试也没用），429 等待后重试（限流是临时的），400 检查输入（参数问题），500 重试 1-2 次（服务端临时问题）。用一个笼统的 `catch (error) { console.log(error) }` 处理所有错误是最常见的错误——无法针对性处理，用户看到"未知错误"完全不知道该怎么办。

---

**下一课**: [第3课：文本生成——输入、输出、温度、长度、错误处理](./03-文本生成输入输出与错误处理.md)
