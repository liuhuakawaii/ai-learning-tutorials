# Lesson 01: 代码 Prompt 核心原则

> **课程定位**：Stage 2 开篇——掌握与 AI 编程助手沟通的四大核心原则，建立正确的 Prompt 思维模式。
>
> **前置要求**：完成 Stage 1，了解 AI 编程工具的基本使用。
>
> **预计时长**：45 分钟

---

## 学习目标

完成本课后，你将能够：

1. 理解并运用**具体性原则**——消除歧义，让 AI 精准生成
2. 理解并运用**上下文原则**——提供充足背景信息
3. 理解并运用**约束原则**——设定边界条件和技术限制
4. 理解并运用**示例原则**——通过输入/输出示例引导 AI
5. 对比不同 Prompt 的效果差异，诊断并改进低质量 Prompt

---

## 1. 为什么 Prompt 质量决定代码质量？

```
┌─────────────────────────────────────────────────────────┐
│                   Prompt 质量 vs 代码质量                 │
│                                                         │
│  代码质量                                               │
│  ▲                                                      │
│  │                          ╭──── 高质量 Prompt          │
│  │                     ╭────╯    (具体+上下文+约束+示例)  │
│  │                ╭────╯                                 │
│  │           ╭────╯                                      │
│  │      ╭────╯         ╭──── 中等 Prompt                 │
│  │ ╭────╯         ╭────╯    (只有部分原则)               │
│  │╯          ╭────╯                                      │
│  │      ╭────╯                                           │
│  │ ╭────╯          ╭──── 低质量 Prompt                   │
│  │╯           ╭────╯    (模糊、无上下文)                  │
│  │       ╭────╯                                          │
│  │ ╭────╯                                                │
│  │╯                                                      │
│  └──────────────────────────────────────────────▶       │
│                     Prompt 质量                          │
└─────────────────────────────────────────────────────────┘
```

核心观点：**AI 不是读心术——你说什么，它就生成什么。** Prompt 是你和 AI 之间的"接口定义"，接口越精确，输出越可靠。

---

## 2. 原则一：具体性（Specificity）

### 2.1 什么是具体性？

> 不要说"写一个函数"，要说"写一个接受 `string[]` 参数、返回去重后按字母排序的 `string[]` 的函数"。

具体性意味着你的 Prompt 中包含：
- **明确的数据类型**（输入/输出）
- **明确的行为描述**（做什么、怎么做）
- **明确的命名要求**（函数名、变量名）

### 2.2 对比示例

| 维度 | ❌ 模糊 Prompt | ✅ 具体 Prompt |
|------|---------------|---------------|
| 函数 | 写个排序函数 | 写一个函数 `sortUsersByAge`，接受 `User[]`，按 `age` 升序排序，返回新的 `User[]` |
| API | 写个接口 | 写一个 POST `/api/users` 接口，接受 `{ name: string; email: string }`，返回 `{ id: string; createdAt: string }`，用 Express + TypeScript |
| 组件 | 写个按钮组件 | 写一个 React `Button` 组件，props 包含 `variant: 'primary' \| 'secondary'`、`size: 'sm' \| 'md' \| 'lg'`、`onClick: () => void`、`children: ReactNode` |

### 2.3 具体性检查清单

```
Prompt 具体性自检：
┌─────────────────────────────────────────┐
│ □ 是否指定了编程语言/框架？              │
│ □ 是否明确了输入参数的类型？              │
│ □ 是否明确了返回值的类型？                │
│ □ 是否描述了核心行为逻辑？                │
│ □ 是否指定了命名规范？                    │
│ □ 是否有边界条件说明？                    │
└─────────────────────────────────────────┘
```

### 2.4 代码示例：从模糊到具体

**TypeScript 示例**

```typescript
// ❌ 模糊 Prompt 得到的代码（可能不符合预期）
function sort(arr: any[]) {
  return arr.sort();
}

// ✅ 具体 Prompt 得到的代码（精准匹配需求）
interface User {
  id: string;
  name: string;
  age: number;
  email: string;
}

/**
 * Sorts users by age in ascending order.
 * Returns a new array without mutating the input.
 */
function sortUsersByAge(users: readonly User[]): User[] {
  return [...users].sort((a, b) => a.age - b.age);
}
```

**Python 示例**

```python
# ❌ 模糊 Prompt 得到的代码
def sort(data):
    return sorted(data)

# ✅ 具体 Prompt 得到的代码
from dataclasses import dataclass

@dataclass(frozen=True)
class User:
    id: str
    name: str
    age: int
    email: str

def sort_users_by_age(users: list[User]) -> list[User]:
    """Sort users by age in ascending order. Returns a new list."""
    return sorted(users, key=lambda u: u.age)
```

---

## 3. 原则二：上下文（Context）

### 3.1 什么是上下文？

AI 不知道你项目的结构、已有代码、技术选型。你需要主动提供：

```
┌──────────────────────────────────────────────────────┐
│                  上下文信息层次                        │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  Level 1: 技术栈                              │    │
│  │  "我们使用 Next.js 14 + Prisma + PostgreSQL"  │    │
│  └──────────────────────────────────────────────┘    │
│                      ▼                               │
│  ┌──────────────────────────────────────────────┐    │
│  │  Level 2: 项目结构                            │    │
│  │  "src/app/api/users/route.ts 是用户模块入口"  │    │
│  └──────────────────────────────────────────────┘    │
│                      ▼                               │
│  ┌──────────────────────────────────────────────┐    │
│  │  Level 3: 相关代码                            │    │
│  │  "这是现有的 User model 和 UserService"        │    │
│  └──────────────────────────────────────────────┘    │
│                      ▼                               │
│  ┌──────────────────────────────────────────────┐    │
│  │  Level 4: 约定与规范                          │    │
│  │  "错误处理用 AppError 类，日志用 pino"        │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 3.2 对比示例

| 维度 | ❌ 无上下文 | ✅ 有上下文 |
|------|-----------|-----------|
| 增删改查 | 写个用户增删改查 | 在 Next.js 14 App Router 中，基于现有 `prisma/schema.prisma` 的 User model，写一个完整的 CRUD API（route.ts），使用 `next/server` 的 `NextResponse` |
| 认证 | 加个登录功能 | 在现有 Express + TypeScript 项目中，使用 `passport-local` 策略添加登录功能，密码用 `bcrypt` 哈希，session 存在 Redis 中 |

### 3.3 代码示例

**TypeScript：提供上下文后的精准生成**

```typescript
// ===== 你提供给 AI 的上下文 =====
// 项目：Next.js 14 App Router
// 数据库：Prisma + PostgreSQL
// 现有 Prisma Schema：
// model User {
//   id        String   @id @default(cuid())
//   name      String
//   email     String   @unique
//   createdAt DateTime @default(now())
// }

// ===== Prompt =====
// 基于上面的 Prisma User model，写一个 src/app/api/users/route.ts
// 实现 GET（列表，支持分页）和 POST（创建，需要验证 email 格式）

// ===== AI 生成的代码 =====
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count(),
  ]);

  return NextResponse.json({
    data: users,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.create({ data: parsed.data });
  return NextResponse.json(user, { status: 201 });
}
```

---

## 4. 原则三：约束（Constraints）

### 4.1 什么是约束？

约束告诉 AI **什么不能做**和**必须遵守什么**：

```
约束类型：
┌────────────────────────────────────────────────────┐
│                                                    │
│  技术约束          行为约束          质量约束       │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐   │
│  │ 不能用   │     │ 失败时   │     │ 函数不超 │   │
│  │ any 类型 │     │ 抛异常   │     │ 过 30 行 │   │
│  ├──────────┤     ├──────────┤     ├──────────┤   │
│  │ 必须用   │     │ 空数组   │     │ 必须有   │   │
│  │ ESM 导入 │     │ 返回空   │     │ 单元测试 │   │
│  ├──────────┤     ├──────────┤     ├──────────┤   │
│  │ 兼容     │     │ 并发安全 │     │ 100%     │   │
│  │ Node 18+ │     │ 幂等操作 │     │ 类型覆盖 │   │
│  └──────────┘     └──────────┘     └──────────┘   │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 4.2 常见约束维度

| 约束维度 | 示例 Prompt 片段 |
|---------|-----------------|
| 类型安全 | "不要使用 `any`，所有参数和返回值必须有明确类型" |
| 错误处理 | "不要用 try-catch 吞错误，所有错误必须向上传播" |
| 性能 | "时间复杂度不超过 O(n log n)，不使用嵌套循环" |
| 兼容性 | "兼容 Node.js 18+，不使用 Node 20 独有 API" |
| 安全性 | "所有用户输入必须验证，SQL 查询使用参数化" |
| 代码风格 | "函数不超过 30 行，使用 early return 模式" |

### 4.3 代码示例：约束如何影响输出

**无约束 vs 有约束**

```typescript
// ❌ 无约束：AI 可能生成这样的代码
function getUser(id: any) {
  try {
    const user = db.query(`SELECT * FROM users WHERE id = ${id}`);
    return user;
  } catch (e) {
    return null;
  }
}

// ✅ 有约束（"不要用 any，必须参数化查询，错误向上传播"）：
class UserNotFoundError extends AppError {
  constructor(userId: string) {
    super(`User ${userId} not found`, 'USER_NOT_FOUND', 404);
  }
}

async function getUserById(id: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new UserNotFoundError(id);
  }
  return user;
}
```

**Python 示例**

```python
# ❌ 无约束
def get_user(id):
    return db.execute(f"SELECT * FROM users WHERE id = {id}")

# ✅ 有约束
from dataclasses import dataclass

class UserNotFoundError(AppError):
    def __init__(self, user_id: str) -> None:
        super().__init__(f"User {user_id} not found", code="USER_NOT_FOUND", status=404)

async def get_user_by_id(user_id: str) -> User:
    user = await prisma.user.find_unique(where={"id": user_id})
    if user is None:
        raise UserNotFoundError(user_id)
    return user
```

---

## 5. 原则四：示例（Examples）

### 5.1 为什么示例有效？

> 一次展示胜过十次描述。通过提供输入→输出示例，AI 能精确理解你的期望格式和行为。

```
示例驱动的 Prompt 工作流：

  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │  提供输入    │────▶│  展示期望    │────▶│  AI 生成     │
  │  示例        │     │  输出示例    │     │  匹配代码    │
  └──────────────┘     └──────────────┘     └──────────────┘
        │                    │                     │
        ▼                    ▼                     ▼
  parseUser(              {                     代码自动
  "John|30|a@b.com"       name: "John",         匹配示例
  )                       age: 30,              格式
                          email: "a@b.com"
                          }
```

### 5.2 示例的三种模式

| 模式 | 适用场景 | Prompt 模板 |
|------|---------|------------|
| 输入→输出 | 数据转换、解析函数 | "输入: `'John\|30'` → 输出: `{ name: 'John', age: 30 }`" |
| 边界用例 | 错误处理、边界条件 | "输入: `''` → 抛出 `ValidationError`" |
| 调用方式 | API 设计、库接口 | "使用方式: `const user = parseUser(raw)`" |

### 5.3 代码示例

```typescript
// ===== Prompt 中的示例 =====
// 写一个 parseCSVLine 函数，示例：
// 输入: "John,30,engineer"
// 输出: { name: "John", age: 30, role: "engineer" }
//
// 输入: "Jane,25,"
// 输出: { name: "Jane", age: 25, role: null }
//
// 输入: ""
// 输出: 抛出 ValidationError("Empty CSV line")

// ===== AI 生成的代码 =====
interface CSVParsedRow {
  name: string;
  age: number;
  role: string | null;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function parseCSVLine(line: string): CSVParsedRow {
  if (!line.trim()) {
    throw new ValidationError('Empty CSV line');
  }

  const parts = line.split(',');

  if (parts.length < 2) {
    throw new ValidationError(`Invalid CSV line: expected at least 2 fields, got ${parts.length}`);
  }

  const name = parts[0].trim();
  const age = parseInt(parts[1].trim(), 10);
  const role = parts[2]?.trim() || null;

  if (!name) {
    throw new ValidationError('Name field is empty');
  }

  if (isNaN(age)) {
    throw new ValidationError(`Invalid age: ${parts[1]}`);
  }

  return { name, age, role };
}
```

---

## 6. 四大原则综合运用

### 6.1 综合 Prompt 模板

```
┌──────────────────────────────────────────────────────────┐
│                综合 Prompt 结构                            │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 1. 上下文 (Context)                                │  │
│  │    "在 Next.js 14 + Prisma 项目中..."              │  │
│  └────────────────────────────────────────────────────┘  │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 2. 具体任务 (Specific Task)                        │  │
│  │    "实现一个分页查询用户列表的 API..."              │  │
│  └────────────────────────────────────────────────────┘  │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 3. 约束 (Constraints)                              │  │
│  │    "不要用 any，错误用 AppError..."                 │  │
│  └────────────────────────────────────────────────────┘  │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 4. 示例 (Examples)                                 │  │
│  │    "GET /api/users?page=1&size=20 → { data: [...] }│  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 6.2 完整示例

**TypeScript 综合 Prompt 与生成**

```typescript
// ===== 你的 Prompt =====
// 上下文：Next.js 14 App Router + Prisma + Zod
// 任务：实现 /api/users/search 路由
// 约束：
//   - 不使用 any
//   - 必须用 Zod 验证查询参数
//   - 搜索支持 name 和 email 的模糊匹配
//   - 分页参数有默认值（page=1, pageSize=20）
//   - 返回格式：{ data: User[], pagination: PaginationMeta }
// 示例：
//   GET /api/users/search?q=john&page=1&pageSize=10
//   → { data: [...], pagination: { page: 1, pageSize: 10, total: 42 } }

// ===== AI 生成 =====
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const searchParamsSchema = z.object({
  q: z.string().min(1),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export async function GET(request: NextRequest) {
  const parsed = searchParamsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { q, page, pageSize } = parsed.data;

  const where = {
    OR: [
      { name: { contains: q, mode: 'insensitive' as const } },
      { email: { contains: q, mode: 'insensitive' as const } },
    ],
  };

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
```

---

## 7. 常见错误

### ❌ 错误 1：过度简略

```
"写个登录"
→ AI 不知道用什么框架、什么认证方式、什么存储
```

**修复**：至少提供技术栈和核心行为描述。

### ❌ 错误 2：信息过载

```
"我们的项目用了 React 18.2.0、TypeScript 5.3.3、Vite 5.0.12、
Zustand 4.5.0、React Query 5.17.0、Tailwind CSS 3.4.1、
Framer Motion 10.18.0...（省略 50 个依赖）...写个按钮组件"
```

**修复**：只提供与当前任务相关的上下文。

### ❌ 错误 3：假设 AI 知道你的约定

```
"按我们的规范写"
→ AI 不知道你的规范是什么
```

**修复**：明确说明规范内容，或提供规范文件路径。

### ❌ 错误 4：一次性描述过于复杂的需求

```
"写一个完整的电商系统，包括用户管理、商品管理、购物车、
订单、支付、物流、评价、推荐、搜索、统计..."
```

**修复**：拆解为多个小任务，逐步迭代。

### ❌ 错误 5：忽略边界情况

```
"写个函数把字符串转数字"
→ 没说空字符串、非数字字符串、超大数怎么处理
```

**修复**：至少提供 2-3 个边界用例的期望行为。

---

## 8. 总结

```
四大核心原则回顾：

  具体性 ──▶ 精确描述输入/输出/行为
    │
    ▼
  上下文 ──▶ 提供技术栈/项目结构/相关代码
    │
    ▼
  约束   ──▶ 设定不能做/必须做/质量标准
    │
    ▼
  示例   ──▶ 给出输入→输出的期望映射

  四者结合 = 高质量代码输出
```

| 原则 | 核心问题 | 一句话总结 |
|------|---------|-----------|
| 具体性 | "你要什么？" | 越精确越好，消除一切歧义 |
| 上下文 | "在什么环境下？" | AI 不知道你的项目，主动告诉它 |
| 约束 | "不能做什么？" | 设定边界，防止 AI 跑偏 |
| 示例 | "长什么样？" | 一次展示胜过十次描述 |

---

## 9. 动手练习

### 练习 1：改写模糊 Prompt

将以下模糊 Prompt 改写为符合四大原则的高质量 Prompt：

```
原 Prompt："写一个处理用户注册的函数"
```

要求：
- 指定技术栈（自选）
- 明确输入/输出类型
- 添加至少 2 个约束
- 提供 1 个输入→输出示例

### 练习 2：对比生成效果

用以下两个 Prompt 分别让 AI 生成代码，对比差异并记录：

```
Prompt A："写个 API"
Prompt B："在 Express + TypeScript 项目中，写一个 GET /api/products 路由，
接受 query 参数 category（string，可选）和 minPrice（number，可选），
返回 Product[] 按价格升序排序，用 Prisma 查询，不使用 any 类型。"
```

记录：生成代码的行数、类型安全性、错误处理、是否符合预期。

### 练习 3：诊断低质量 Prompt

以下 Prompt 有哪些问题？逐一列出并改写：

```
"写一个很厉害的函数，可以处理各种数据，要快，要安全，
代码要好看，用最新的技术，兼容所有浏览器。"
```

---

**下一课**：[Lesson 02: 需求描述的结构化模板](./02-需求描述的结构化模板.md) —— 学习用 WHAT/WHY/HOW 模式系统化描述开发需求。
