# Lesson 05: 系统级 Prompt

> **课程定位**：从单次对话到全局规范——编写系统级 Prompt，让 AI 在整个项目生命周期中遵循统一的编码标准。
>
> **前置要求**：Lesson 01-04（核心原则、结构化模板、上下文、迭代式）。
>
> **预计时长**：50 分钟

---

## 学习目标

完成本课后，你将能够：

1. 理解**系统级 Prompt**与单次 Prompt 的区别和互补关系
2. 掌握 **CLAUDE.md / .cursorrules** 等规范文件的编写方法
3. 学会定义项目的**编码标准、架构约定、错误处理策略**
4. 理解规范文件的**层次结构**（全局 → 项目 → 模块）
5. 为你的项目编写一份完整的 AI 编程规范

---

## 1. 什么是系统级 Prompt？

```
┌──────────────────────────────────────────────────────────┐
│            单次 Prompt vs 系统级 Prompt                    │
│                                                          │
│  单次 Prompt：                                            │
│  ┌──────────────────────────────────────┐                │
│  │ "写一个用户注册 API"                  │                │
│  │                                      │                │
│  │ 有效范围：当前这一次对话              │                │
│  │ 下次对话：AI 忘了一切                 │                │
│  └──────────────────────────────────────┘                │
│                                                          │
│  系统级 Prompt（CLAUDE.md / .cursorrules）：              │
│  ┌──────────────────────────────────────┐                │
│  │ # 项目规范                           │                │
│  │ - 使用 Next.js 14 App Router         │                │
│  │ - 错误处理用 AppError 类             │                │
│  │ - API 响应用 { data, error } 格式    │                │
│  │ - ...                                │                │
│  │                                      │                │
│  │ 有效范围：整个项目的所有对话          │                │
│  │ 每次对话：AI 自动加载这些规范         │                │
│  └──────────────────────────────────────┘                │
│                                                          │
│  二者关系：                                               │
│  系统级 Prompt = 项目的"全局配置"                         │
│  单次 Prompt = 具体的"任务指令"                           │
│  系统级 Prompt 让每次单次 Prompt 都不需要重复说规范        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 2. 规范文件类型与工具对比

| 文件名 | 工具 | 作用域 | 加载方式 |
|--------|------|--------|---------|
| `CLAUDE.md` | Claude Code | 项目根目录 + 子目录 | 自动加载，子目录覆盖父目录 |
| `.cursorrules` | Cursor | 项目根目录 | 自动加载 |
| `.github/copilot-instructions.md` | GitHub Copilot | 项目根目录 | 自动加载 |
| `AGENTS.md` | 通用 | 项目根目录 | 手动引用 |

### 文件优先级

```
优先级从高到低：

  当前目录的 CLAUDE.md
       │
       ▼
  父目录的 CLAUDE.md（向上查找）
       │
       ▼
  项目根目录的 CLAUDE.md
       │
       ▼
  全局配置 (~/.claude/CLAUDE.md)

子目录的规范会覆盖父目录的同名配置，
但不冲突的配置会合并。
```

---

## 3. CLAUDE.md 编写指南

### 3.1 推荐结构

```markdown
# CLAUDE.md 结构模板

## 1. 项目概述
- 一句话描述项目
- 核心功能列表
- 目标用户

## 2. 技术栈
- 运行时、框架、语言版本
- ORM、数据库
- 状态管理、样式方案
- 测试框架、Lint 工具
- 包管理器、构建工具

## 3. 项目结构
- 目录树及各目录用途
- 关键文件说明

## 4. 编码约定
- 命名规范
- 文件组织
- 导入顺序
- 注释规范

## 5. 错误处理
- 错误类层次
- 错误传播策略
- 日志规范

## 6. API 约定
- 响应格式
- 分页规范
- 验证策略

## 7. 测试约定
- 测试文件位置
- 命名规范
- Mock 策略

## 8. 常用命令
- 开发、构建、测试、Lint 命令

## 9. 已知限制/注意事项
- 不要做的事情
- 已知的坑
```

### 3.2 完整示例

```markdown
# CLAUDE.md — 示例项目

## 项目概述
任务管理系统（类 Trello），支持看板、列表、卡片的拖拽管理。

## 技术栈
- Runtime: Node.js 20 LTS
- Framework: Next.js 14 App Router
- Language: TypeScript 5.3 (strict: true)
- ORM: Prisma 5.x + PostgreSQL 16
- Validation: Zod
- State: Zustand (client) / React Query 5 (server)
- Styling: Tailwind CSS 3.4 + Radix UI
- Testing: Vitest + Testing Library + Playwright
- Lint: ESLint (flat config) + Prettier
- Package: pnpm 9 + Turborepo

## 项目结构
src/
  app/              # Next.js App Router
    api/            # API route handlers
    (auth)/         # Auth-related pages
    (dashboard)/    # Main app pages
  components/
    ui/             # Primitive UI components (Button, Input, etc.)
    features/       # Feature-specific components
  lib/              # Shared utilities
    errors.ts       # AppError hierarchy
    prisma.ts       # Prisma client singleton
    auth.ts         # Auth helpers
  hooks/            # Custom React hooks
  types/            # Shared TypeScript types
prisma/
  schema.prisma     # Database schema
  migrations/       # Migration files

## 编码约定

### 命名规范
- 文件名: kebab-case (user-service.ts, board-card.tsx)
- 组件名: PascalCase (BoardCard, UserAvatar)
- 函数名: camelCase (getUserById, createBoard)
- 常量: UPPER_SNAKE_CASE (MAX_BOARD_COUNT)
- 数据库表: snake_case (board_members, card_labels)
- API 路径: kebab-case (/api/boards/:id/members)

### 导入顺序
1. React / Next.js 内置模块
2. 第三方库
3. 项目内部模块 (@/lib, @/components, @/types)
4. 相对路径导入
5. 样式导入

### TypeScript 规则
- 禁止使用 any（使用 unknown + 类型守卫）
- 优先使用 interface 而非 type（除了联合类型和工具类型）
- 函数参数和返回值必须显式标注类型
- 使用 satisfies 操作符进行类型检查

## 错误处理

### 错误类层次
src/lib/errors.ts 定义了以下错误类：
- AppError (base) — code, statusCode, message
  - NotFoundError (404)
  - ValidationError (400)
  - UnauthorizedError (401)
  - ForbiddenError (403)
  - ConflictError (409)

### 错误传播规则
- 业务逻辑层：抛出具体的 AppError 子类
- API 层：捕获 AppError，返回对应 HTTP 状态码
- 未知错误：由全局 error.tsx 处理
- 禁止使用 try-catch 吞错误而不处理

### 日志规范
- 使用 pino 日志库
- 日志格式：JSON
- 日志级别：error > warn > info > debug
- API 请求日志在中间件中自动记录

## API 约定

### 响应格式
成功: { data: T }
错误: { error: { code: string; message: string; details?: unknown } }

### 分页格式
请求: ?page=1&pageSize=20
响应: { data: T[], pagination: { page, pageSize, total, totalPages } }

### 验证
- 请求体用 Zod schema 验证
- 验证失败返回 400 + ValidationError details
- 查询参数用 z.coerce 转换类型

## 测试约定
- 单元测试: __tests__/ 目录，文件名 .test.ts
- E2E 测试: e2e/ 目录，文件名 .spec.ts
- 测试描述用中文
- Mock 外部依赖，不 Mock 内部模块

## 常用命令
pnpm dev          # 启动开发服务器
pnpm build        # 构建生产版本
pnpm test         # 运行单元测试
pnpm test:e2e     # 运行 E2E 测试
pnpm lint         # ESLint 检查
pnpm typecheck    # TypeScript 类型检查
pnpm db:migrate   # 运行数据库迁移
pnpm db:seed      # 填充测试数据

## 已知限制
- 不要使用 next/router（用 next/navigation）
- 不要使用 getServerSideProps（用 App Router 的 Server Components）
- 不要在 Client Components 中直接调用 Prisma
- 不要在组件中写内联样式（用 Tailwind classes）
```

---

## 4. .cursorrules 编写指南

### 4.1 与 CLAUDE.md 的区别

```
┌──────────────────────────────────────────────────────────┐
│         CLAUDE.md vs .cursorrules 对比                    │
│                                                          │
│  CLAUDE.md：                                              │
│  ├── 面向 Claude Code 工具                                │
│  ├── 支持多层目录继承                                     │
│  ├── 内容可以更详细（无大小限制）                          │
│  └── 支持 Markdown 格式                                   │
│                                                          │
│  .cursorrules：                                          │
│  ├── 面向 Cursor 编辑器                                   │
│  ├── 只在项目根目录生效                                   │
│  ├── 建议简洁（影响上下文窗口）                            │
│  └── 纯文本格式                                          │
│                                                          │
│  如果你同时使用两个工具：                                  │
│  → 核心规范放 CLAUDE.md（主源）                            │
│  → .cursorrules 从 CLAUDE.md 精简而来                     │
│  → 保持两者一致                                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.2 .cursorrules 示例

```markdown
# .cursorrules

## Tech Stack
Next.js 14 App Router, TypeScript 5.3 (strict), Prisma 5 + PostgreSQL,
Zod validation, Tailwind CSS 3.4, Vitest testing.

## Code Style
- Use kebab-case for files, PascalCase for components, camelCase for functions
- No `any` type — use `unknown` with type guards
- Explicit return types on exported functions
- Use `interface` for object shapes, `type` for unions/utilities
- Import order: React → third-party → @/lib → @/components → relative

## Error Handling
- Use AppError classes from src/lib/errors.ts
- Never swallow errors with empty catch
- API routes: catch AppError, return corresponding HTTP status
- Use Zod for request validation

## API Conventions
- Response: { data: T } for success, { error: { code, message } } for errors
- Pagination: ?page=1&pageSize=20 → { data: T[], pagination: { page, pageSize, total, totalPages } }

## Don'ts
- Don't use next/router (use next/navigation)
- Don't use getServerSideProps (use Server Components)
- Don't call Prisma from Client Components
- Don't use inline styles (use Tailwind)

## Commands
pnpm dev | pnpm build | pnpm test | pnpm lint | pnpm typecheck
```

---

## 5. 分层规范架构

### 5.1 多层规范设计

```
┌──────────────────────────────────────────────────────────┐
│               分层规范架构                                 │
│                                                          │
│  Layer 0: 全局规范                                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ~/.claude/CLAUDE.md                                │  │
│  │ "我是 TypeScript 开发者，偏好函数式风格"            │  │
│  │ "所有项目使用 pnpm"                                │  │
│  └────────────────────────────────────────────────────┘  │
│                          ▼                               │
│  Layer 1: 项目根目录规范                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ /project/CLAUDE.md                                 │  │
│  │ "Next.js 14 + Prisma + PostgreSQL"                 │  │
│  │ "错误处理用 AppError 类"                           │  │
│  └────────────────────────────────────────────────────┘  │
│                          ▼                               │
│  Layer 2: 模块/子目录规范                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │ /project/src/app/api/CLAUDE.md                     │  │
│  │ "API 路由使用 Route Handlers"                      │  │
│  │ "响应格式：{ data } 或 { error }"                  │  │
│  │                                                      │  │
│  │ /project/src/components/CLAUDE.md                  │  │
│  │ "组件使用 React.FC 类型"                           │  │
│  │ "样式只用 Tailwind classes"                        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 5.2 各层职责

| 层级 | 文件 | 内容 | 变更频率 |
|------|------|------|---------|
| 全局 | `~/.claude/CLAUDE.md` | 个人偏好、通用规范 | 很少 |
| 项目 | `项目根/CLAUDE.md` | 技术栈、架构、项目约定 | 偶尔 |
| 模块 | `子目录/CLAUDE.md` | 模块特定规范 | 按需 |

---

## 6. 规范的实际效果

### 6.1 无规范 vs 有规范

```typescript
// ❌ 无规范：每次对话生成不同风格的代码

// 对话 1：AI 用 Express 风格
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 对话 2：AI 用 Next.js 但风格不同
export async function GET() {
  const users = await prisma.user.findMany();
  return Response.json(users);
}

// 对话 3：又是另一种风格
export default async function handler(req, res) {
  const users = await db.query('SELECT * FROM users');
  res.status(200).json({ data: users });
}

// ✅ 有规范：每次对话都生成一致风格的代码

// 对话 1：
export async function GET(request: NextRequest) {
  const users = await prisma.user.findMany();
  return NextResponse.json({ data: users });
}

// 对话 2：
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } },
      { status: 400 }
    );
  }
  const user = await prisma.user.create({ data: parsed.data });
  return NextResponse.json({ data: user }, { status: 201 });
}
```

### 6.2 规范覆盖的决策点

```
┌──────────────────────────────────────────────────────────┐
│          规范消除的"决策疲劳"                              │
│                                                          │
│  无规范时，每个 Prompt 都要决定：                          │
│                                                          │
│  □ 用什么框架？         → 规范：Next.js 14 App Router     │
│  □ 怎么处理错误？       → 规范：AppError 类               │
│  □ 响应格式是什么？     → 规范：{ data } / { error }      │
│  □ 怎么做验证？         → 规范：Zod                       │
│  □ 命名用什么风格？     → 规范：camelCase + kebab-case    │
│  □ 测试怎么写？         → 规范：Vitest + describe/it      │
│  □ 日志用什么？         → 规范：pino JSON                 │
│  □ 类型怎么定义？       → 规范：interface > type          │
│                                                          │
│  有规范后，这些决策自动应用——                             │
│  你只需要描述"做什么"，不需要重复说"怎么做"               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 7. 常见错误

### ❌ 错误 1：规范过于庞大

```
CLAUDE.md 写了 500+ 行，包含了所有细节
→ 每次对话消耗大量 token 在规范上
→ AI 可能忽略部分内容
```

**修复**：核心规范 50-100 行即可，细节放在子目录规范中。

### ❌ 错误 2：规范与实际代码不一致

```
CLAUDE.md 写"使用 Zod 验证"
但项目中大量代码用手动 if 判断
→ AI 不知道该遵循哪个
```

**修复**：规范要与实际代码保持一致，不一致时说明过渡计划。

### ❌ 错误 3：规范太模糊

```
"写高质量的代码"
"遵循最佳实践"
→ 对 AI 没有实际指导意义
```

**修复**：具体化——"函数不超过 30 行"、"使用 early return 模式"。

### ❌ 错误 4：忽略规范的维护

```
项目从 Express 迁移到 Next.js，但 CLAUDE.md 还写着 Express 规范
→ AI 生成过时的代码
```

**修复**：技术栈变更时同步更新规范文件。

### ❌ 错误 5：规范文件放在错误位置

```
CLAUDE.md 放在 src/ 目录下而非项目根目录
→ 工具找不到规范文件
```

**修复**：确认工具的规范文件查找规则，放在正确位置。

---

## 8. 总结

```
系统级 Prompt 的价值：

  单次 Prompt：解决"这次做什么"
  系统级 Prompt：解决"每次都怎么做"

  系统级 Prompt = 项目的"AI 编程宪法"

规范文件层次：
  全局 (~/.claude/) → 个人偏好
  项目根 (/) → 技术栈 + 架构约定
  子目录 (/src/app/api/) → 模块特定规范

编写原则：
  ✓ 具体（不用模糊描述）
  ✓ 简洁（核心规范 50-100 行）
  ✓ 一致（与实际代码保持同步）
  ✓ 分层（全局 → 项目 → 模块）
```

---

## 9. 动手练习

### 练习 1：为你的项目编写 CLAUDE.md

选择你当前正在开发的项目（或创建一个新项目），编写一个完整的 CLAUDE.md，包含：

- 项目概述
- 技术栈
- 项目结构
- 编码约定（命名、导入、类型）
- 错误处理策略
- API 约定
- 常用命令

然后用这个 CLAUDE.md 让 AI 生成 2-3 个不同的功能，观察风格一致性。

### 练习 2：规范迁移练习

假设你的项目从 Express 迁移到了 Next.js App Router：

1. 写一份 Express 版本的 CLAUDE.md
2. 写一份 Next.js 版本的 CLAUDE.md
3. 用两份规范分别让 AI 生成同一个 API，对比差异

### 练习 3：团队规范协作

模拟团队场景：

1. 你写一份 CLAUDE.md（你是前端负责人）
2. 让 AI 基于你的规范生成代码
3. 发现 AI 生成的代码有 3 处不符合你的预期
4. 修改 CLAUDE.md 使这些预期被明确覆盖
5. 再次生成，验证是否修复

记录：哪些预期需要显式写入规范，哪些 AI 能自动推断。

---

**下一课**：[Lesson 06: 多语言 Prompt](./06-多语言Prompt.md) —— 学习在 TypeScript + Python 全栈、SQL + ORM、React + CSS + TypeScript 等多语言场景下编写 Prompt。
