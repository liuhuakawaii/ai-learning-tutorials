# Lesson 03: 上下文 Prompt

> **课程定位**：上下文是 Prompt 质量的最大杠杆——同样的需求，有上下文和没上下文，生成质量天差地别。
>
> **前置要求**：Lesson 01（核心原则）、Lesson 02（结构化模板）。
>
> **预计时长**：45 分钟

---

## 场景引入

你的项目用 Next.js 14 App Router + Prisma + TypeScript，团队有一套自己的错误处理体系和响应格式。你让 AI 写一个新 API，AI 生成的代码用了 Express 风格，错误处理用 try-catch 吞掉返回 500，响应格式也不对。你补了一句"参考现有的用户 API 写"，但 AI 没看到你的代码，只能凭空猜测。根本原因是你没有把项目上下文传递给 AI——它不知道你的项目长什么样。

---

## 学习目标

完成本课后，你将能够：

1. 识别并提供**四层上下文信息**（技术栈、项目结构、相关代码、约定规范）
2. 学会**选择性提供上下文**——只给相关的，不给无关的
3. 使用 **@file / @folder** 等工具引用项目中的实际文件
4. 掌握**上下文窗口管理**——在有限的 token 预算内最大化信息密度
5. 处理大型项目中的**上下文碎片化**问题

---

## 1. 为什么上下文如此重要？

```
┌──────────────────────────────────────────────────────────┐
│              AI 的"视野" vs 你的"视野"                    │
│                                                          │
│  你的视野（完整项目）：                                    │
│  ┌────────────────────────────────────────────────┐      │
│  │ 项目结构 │ 技术选型 │ 团队约定 │ 历史决策 │ ... │      │
│  │ 相关代码 │ 依赖关系 │ 设计模式 │ 已知坑   │ ... │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
│  AI 的视野（只有你告诉它的）：                             │
│  ┌──────────────┐                                        │
│  │ 当前 Prompt   │                                        │
│  └──────────────┘                                        │
│                                                          │
│  上下文 Prompt 的作用 = 把你的视野"投影"给 AI              │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │         你的完整视野                            │      │
│  │    ┌──────────────────────────┐                │      │
│  │    │  你选择传递的上下文      │                │      │
│  │    │  ┌──────────────────┐   │                │      │
│  │    │  │ AI 实际接收到的  │   │                │      │
│  │    │  └──────────────────┘   │                │      │
│  │    └──────────────────────────┘                │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

核心观点：**AI 生成的代码质量上限，取决于你提供的上下文质量。**

---

## 2. 四层上下文模型

```
┌──────────────────────────────────────────────────────────┐
│                   四层上下文模型                           │
│                                                          │
│  Layer 1: 技术栈层 (Tech Stack Layer)                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ "Next.js 14 + TypeScript + Prisma + PostgreSQL"    │  │
│  │ "状态管理用 Zustand，样式用 Tailwind CSS"           │  │
│  │ "包管理器用 pnpm，构建工具用 Turborepo"             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Layer 2: 项目结构层 (Project Structure Layer)             │
│  ┌────────────────────────────────────────────────────┐  │
│  │ "src/app/api/ — API 路由"                          │  │
│  │ "src/lib/ — 工具函数和共享逻辑"                     │  │
│  │ "prisma/schema.prisma — 数据模型"                  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Layer 3: 相关代码层 (Related Code Layer)                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ "这是现有的 UserService（@file: src/lib/user.ts）" │  │
│  │ "这是现有的错误处理中间件"                          │  │
│  │ "这是 Prisma Schema 中的 User model"               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Layer 4: 约定规范层 (Conventions Layer)                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ "API 响应统一用 { data, error } 格式"              │  │
│  │ "错误处理用 src/lib/errors.ts 中的 AppError 类"    │  │
│  │ "日志用 pino，格式为 JSON"                         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 各层的传递方式

| 层级 | 传递方式 | 更新频率 | 示例 |
|------|---------|---------|------|
| 技术栈 | 文字描述 / 项目配置文件 | 很少变化 | "Next.js 14 App Router" |
| 项目结构 | 目录树 / 文件路径列表 | 偶尔变化 | `src/app/api/users/route.ts` |
| 相关代码 | @file 引用 / 粘贴代码片段 | 每次任务不同 | 现有的 Service / Model |
| 约定规范 | 规范文档 / @file 引用 | 很少变化 | CLAUDE.md / .cursorrules |

---

## 3. 上下文提供的最佳实践

### 3.1 技术栈层：项目级配置

最高效的方式是在项目根目录创建规范文件：

```markdown
# CLAUDE.md（项目根目录）

## Tech Stack
- Runtime: Node.js 20 LTS
- Framework: Next.js 14 App Router
- Language: TypeScript 5.3 (strict mode)
- ORM: Prisma 5.x + PostgreSQL 16
- Validation: Zod
- State: Zustand (client) / React Query (server)
- Styling: Tailwind CSS 3.4
- Testing: Vitest + Testing Library
- Linting: ESLint + Prettier

## Project Structure
src/
  app/           # Next.js App Router pages
    api/         # API route handlers
    (dashboard)/ # Dashboard layout group
  components/    # Shared React components
  lib/           # Utility functions and shared logic
  hooks/         # Custom React hooks
  types/         # Shared TypeScript types
prisma/
  schema.prisma  # Database schema
  migrations/    # Migration files
```

这样在每次对话中，AI 自动获得技术栈和项目结构信息。

### 3.2 相关代码层：精准引用

**TypeScript 示例：引用现有代码**

```
# Prompt 中引用相关文件

请参考以下文件来理解现有代码结构：

@file: src/lib/errors.ts — 错误处理类定义
@file: src/lib/prisma.ts — Prisma 客户端单例
@file: src/app/api/users/route.ts — 现有的用户 API（参考风格）
@file: prisma/schema.prisma — User 和 Post model 定义

基于以上代码，实现 src/app/api/posts/route.ts 的文章 CRUD API。
```

**不引用 vs 引用的代码差异：**

```typescript
// ❌ 不引用现有代码：AI 猜测错误处理方式
try {
  const user = await db.user.findUnique({ where: { id } });
} catch (error) {
  console.log(error);
  return res.status(500).json({ error: 'Internal server error' });
}

// ✅ 引用现有代码：AI 使用项目的 AppError 体系
import { AppError, NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

const user = await prisma.user.findUnique({ where: { id } });
if (!user) {
  throw new NotFoundError('User', id);
}
```

### 3.3 约定规范层：隐式规则显式化

```markdown
# 项目编码约定（在 Prompt 中或 CLAUDE.md 中说明）

## API 约定
- 所有 API 响应用 { data?, error? } 包装
- 成功响应：{ data: T }
- 错误响应：{ error: { code: string; message: string; details?: unknown } }
- 分页参数：page (默认 1) + pageSize (默认 20, 最大 100)
- 分页响应：data 数组 + pagination { page, pageSize, total, totalPages }

## 错误处理约定
- 使用 src/lib/errors.ts 中的 AppError 子类
- 不使用 try-catch 吞错误
- API 层捕获 AppError，返回对应 HTTP 状态码
- 未知错误由全局错误中间件处理

## 命名约定
- 文件名：kebab-case (user-service.ts)
- 组件名：PascalCase (UserProfile)
- 函数名：camelCase (getUserById)
- 数据库表名：snake_case (user_profiles)
- API 路径：kebab-case (/api/user-profiles)
```

---

## 4. 上下文窗口管理

### 4.1 Token 预算意识

```
┌──────────────────────────────────────────────────────────┐
│              上下文窗口 Token 预算分配                     │
│                                                          │
│  总窗口：~128K tokens（以 GPT-4 为例）                    │
│                                                          │
│  ┌──────────────────────────────────────────────┐        │
│  │ 系统 Prompt + 历史对话    ~20-40%            │        │
│  ├──────────────────────────────────────────────┤        │
│  │ 你提供的上下文            ~30-50%            │        │
│  ├──────────────────────────────────────────────┤        │
│  │ AI 生成的代码             ~20-30%            │        │
│  └──────────────────────────────────────────────┘        │
│                                                          │
│  关键：上下文不是越多越好，而是越精准越好                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.2 上下文精简策略

| 策略 | 说明 | 示例 |
|------|------|------|
| 只给相关代码 | 不要整个文件，只给相关的函数/类型 | "这是 User 类型定义和 getUserById 函数" |
| 使用摘要 | 长文件用文字描述结构而非全文粘贴 | "prisma/schema.prisma 有 15 个 model，当前任务只涉及 User 和 Post" |
| 分层引用 | 先给概览，需要时再深入 | 先给目录树，AI 需要时再 @file |
| 去除重复 | 技术栈在 CLAUDE.md 中写一次 | 不要在每个 Prompt 中重复 |

### 4.3 实际示例：精简前后对比

**❌ 精简前（信息过载）：**

```
我们的项目是一个电商平台，使用 Next.js 14，TypeScript，Prisma，PostgreSQL，
Tailwind CSS，Zustand，React Query，还有 Zod 做验证，Vitest 做测试，
ESLint 和 Prettier 做代码格式化，用 pnpm 做包管理，Turborepo 做 monorepo...
（省略 500 字技术栈描述）

然后这是我们的 30 个 Prisma model（粘贴 2000 行 schema）...
这是所有的 API 路由文件（粘贴 5000 行代码）...

现在帮我写一个商品搜索 API。
```

**✅ 精简后（精准上下文）：**

```
# 项目：电商平台（Next.js 14 + Prisma + PostgreSQL）

# 相关文件：
@file: prisma/schema.prisma — 看 Product model（第 45-78 行）
@file: src/app/api/users/route.ts — 参考这个 API 的风格

# 任务：实现 GET /api/products/search
# 参数：q (string), category (string, optional), minPrice/maxPrice (number, optional)
# 返回：Product[] 分页结果

# 约定：
# - 用 Zod 验证查询参数
# - 响应用 { data, pagination } 格式
# - 错误用 AppError（参考 @file: src/lib/errors.ts）
```

---

## 5. 大型项目的上下文策略

### 5.1 Monorepo 上下文

```
大型 Monorepo 项目结构：

packages/
  shared/          ← 共享类型和工具
  api/             ← 后端 API
  web/             ← 前端 Web
  mobile/          ← 移动端

上下文策略：
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. 在根目录放置全局 CLAUDE.md                           │
│     → 技术栈、全局约定、monorepo 结构                    │
│                                                         │
│  2. 在每个 package 放置局部 CLAUDE.md                    │
│     → 该 package 的特定约定、入口文件                    │
│                                                         │
│  3. Prompt 中指定工作范围                                │
│     → "在 packages/api 中实现..."                       │
│     → "参考 packages/shared 中的类型..."                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.2 渐进式上下文提供

```
第一次 Prompt（基础上下文）：
"在 Next.js 14 项目中，实现用户注册 API"

AI 回复后，检查是否符合项目风格。
如果风格不对，补充上下文：

第二次 Prompt（补充上下文）：
"参考 @file: src/app/api/posts/route.ts 的风格，
使用项目的 AppError 类和 { data, error } 响应格式，
重新生成上面的注册 API"

继续迭代直到风格统一。
```

---

## 6. 常见误区

### ❌ 错误 1：上下文缺失导致风格不一致

```
Prompt："写一个商品列表 API"
→ AI 用了 Express 风格，但你的项目是 Next.js App Router
→ AI 用了 Mongoose，但你的项目是 Prisma
```

**修复**：至少在 CLAUDE.md 或 Prompt 中说明框架和 ORM。

### ❌ 错误 2：粘贴整个文件

```
"这是我们的代码" → 粘贴 500 行文件
→ 大部分内容与当前任务无关，浪费 token
```

**修复**：只粘贴相关的函数/类型定义，或用 @file 引用让工具自动处理。

### ❌ 错误 3：假设 AI 记住之前的对话

```
第一轮："我们用 Next.js 14"
第十轮："写个 API" → AI 可能忘了之前说的是 Next.js
```

**修复**：关键上下文放在 CLAUDE.md 中，或在当前 Prompt 中重复关键信息。

### ❌ 错误 4：上下文相互矛盾

```
CLAUDE.md 写 "使用 ESLint strict"
但粘贴的参考代码中有 @ts-ignore 和 console.log
→ AI 不知道该遵循哪个
```

**修复**：保持规范文件和实际代码一致，不一致时在 Prompt 中说明。

### ❌ 错误 5：忽略隐式依赖

```
"写一个支付服务"
→ 没提到项目中已有的订单服务、用户服务、通知服务
→ AI 生成的代码无法与现有服务集成
```

**修复**：列出当前任务依赖的其他模块/服务。

---

## 7. 工程建议

1. **项目第一天就写 CLAUDE.md**：在项目初始化时就创建 CLAUDE.md，记录技术栈、项目结构和编码约定。这比事后补写更高效，也能确保规范从一开始就生效。

2. **用 @file 引用替代粘贴代码**：当需要让 AI 参考现有代码时，优先使用工具的文件引用功能（如 @file），而非手动粘贴。这样既节省 token，又能确保 AI 看到的是最新版本。

3. **上下文按需分层提供**：先给基础上下文（技术栈 + 任务描述），如果 AI 输出不符合项目风格，再补充参考代码和约定。避免一次性倾倒所有信息导致 token 浪费。

4. **定期清理过时上下文**：当项目技术栈或约定发生变化时，及时更新 CLAUDE.md 和规范文件。过时的上下文比没有上下文更危险——AI 会自信地生成错误的代码。

---

## 8. 总结

```
上下文提供的核心原则：

  精准 > 完整
  相关 > 全量
  结构化 > 原始代码

四层上下文模型：
  Layer 1: 技术栈 → CLAUDE.md / Prompt 开头
  Layer 2: 项目结构 → 目录树 / 文件路径
  Layer 3: 相关代码 → @file 引用 / 粘贴片段
  Layer 4: 约定规范 → CLAUDE.md / 规范文件

上下文管理公式：
  有效上下文 = 相关性 × 信息密度 / token 消耗
```

| 策略 | 效果 | 适用场景 |
|------|------|---------|
| CLAUDE.md | 一次性设置，长期受益 | 所有项目 |
| @file 引用 | 精准、不浪费 token | 引用现有代码 |
| 参考代码片段 | 快速对齐风格 | 没有 CLAUDE.md 时 |
| 渐进式补充 | 避免信息过载 | 不确定需要多少上下文时 |

---

## 9. 动手练习

### 练习 1：为你的项目编写 CLAUDE.md

选择你当前正在开发的一个项目（或创建一个新项目），编写一个 CLAUDE.md 文件，包含：

- 技术栈描述（Layer 1）
- 项目结构说明（Layer 2）
- 编码约定（Layer 4）

然后用这个 CLAUDE.md 让 AI 生成一段代码，观察是否符合项目风格。

### 练习 2：上下文精简练习

以下是一个信息过载的 Prompt，请精简它，保留与任务最相关的上下文：

```
原始 Prompt：
"我们的项目用了 React 18.2、TypeScript 5.3、Vite 5、Zustand 4.5、
React Query 5.17、Tailwind 3.4、Framer Motion 10、Axios 1.6、
date-fns 3、lodash 4、clsx 2、react-hook-form 7、zod 3.5、
react-router-dom 6、lucide-react 0.300...（还有 20 个依赖）...
项目结构是 src/ 下有 components、hooks、pages、services、utils、
types、assets、styles、config、constants...（还有 10 个目录）...
现在帮我写一个用户登录表单组件。"
```

要求：精简到 10 行以内，只保留与"登录表单"相关的上下文。

### 练习 3：上下文对比实验

用同一个需求，分别用"无上下文"和"有上下文"两种方式让 AI 生成代码，记录：

- 无上下文：生成了什么框架/风格的代码？
- 有上下文（指定框架、参考代码）：生成了什么框架/风格的代码？
- 两者需要几轮修改才能用于你的项目？

---

**下一课**：[Lesson 04: 迭代式 Prompt](./04-迭代式Prompt.md) —— 学习从简单到复杂，通过 5 轮迭代逐步构建一个完整的数据验证库。
