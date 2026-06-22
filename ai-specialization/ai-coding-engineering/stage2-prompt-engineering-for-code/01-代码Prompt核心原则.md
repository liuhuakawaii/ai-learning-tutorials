# Lesson 01: 代码 Prompt 核心原则

> **课程定位**：Stage 2 开篇——掌握与 AI 编程助手沟通的四大核心原则，建立正确的 Prompt 思维模式。
>
> **前置要求**：完成 Stage 1，了解 AI 编程工具的基本使用。
>
> **预计时长**：45 分钟

---

## 场景引入

你刚接手一个新项目，让 AI 帮你写一个用户注册接口。你输入"写一个注册功能"，AI 返回了一段代码——用的是 Express，但你的项目是 Next.js；密码没有哈希，直接明文存储；没有输入验证，没有错误处理。你花了两个小时修改 AI 的代码，最后发现还不如自己从头写。问题不在 AI，而在你的 Prompt——你说得太模糊了。

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

## 7. 常见误区

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

## 8. 工程建议

1. **建立团队 Prompt 库**：将经过验证的高质量 Prompt 模板化，存放在团队共享文档中，避免每个人重复摸索。好的 Prompt 和好的代码一样值得版本管理。

2. **写 Prompt 前先写注释**：在让 AI 生成代码之前，先用注释写下你期望的输入、输出、边界条件和错误处理方式。这些注释本身就是高质量的 Prompt 骨架。

3. **用 safeParse 替代 try-catch**：当 Prompt 涉及数据验证时，明确要求 AI 使用 safeParse 模式而非 try-catch 吞错误，这能让错误处理更可控、更易测试。

4. **小步验证，逐步信任**：不要一开始就让 AI 生成整个模块。先从一个小函数开始，验证 AI 是否理解了你的风格和约束，再逐步扩大任务范围。

---

## 9. 总结

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

## 10. 动手练习

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

## 参考答案

### 练习 1：改写模糊 Prompt

**思路**：将"写一个处理用户注册的函数"按照四大原则（具体性、上下文、约束、示例）逐步补充。核心是把 AI 需要知道但你没说的信息都明确下来。

**答案**：

改写后的高质量 Prompt：

```
在 Express + TypeScript + Prisma 项目中，实现用户注册函数。

【上下文】
- 数据库：PostgreSQL，使用 Prisma ORM
- 密码加密：bcrypt，salt rounds = 12
- 输入验证：Zod

【具体任务】
函数名：registerUser
输入参数：{ email: string; name: string; password: string }
返回值：Promise<{ user: Omit<User, 'passwordHash'>; token: string }>

【约束】
- 邮箱必须唯一，重复注册返回 409 Conflict
- 密码至少 8 位，必须包含大写、小写、数字
- 不使用 any 类型
- 错误处理使用自定义 AppError 类，不用 try-catch 吞错误
- token 有效期 24 小时

【示例】
输入：{ email: "alice@example.com", name: "Alice", password: "Pass123!" }
成功输出：{ user: { id: "cuid...", email: "alice@example.com", name: "Alice" }, token: "eyJ..." }

输入：{ email: "alice@example.com", name: "Alice", password: "Pass123!" }（邮箱已存在）
失败输出：AppError("该邮箱已被注册", "EMAIL_EXISTS", 409)
```

**要点**：
- 改写后的 Prompt 包含了四大原则的全部要素
- 具体性：明确了函数名、参数类型、返回类型
- 上下文：说明了技术栈和使用的库
- 约束：4 条明确的技术限制
- 示例：给出了成功和失败两种场景的输入→输出映射

---

### 练习 2：对比生成效果

**思路**：用两个 Prompt 分别生成代码，然后从行数、类型安全性、错误处理、是否符合预期四个维度对比。核心发现：Prompt B 因为包含了具体性、上下文和约束，生成质量显著高于 Prompt A。

**答案**：

| 维度 | Prompt A："写个 API" | Prompt B：结构化 Prompt |
|------|---------------------|----------------------|
| 生成代码行数 | 5-15 行（极简版） | 40-80 行（完整版） |
| 框架选择 | 可能是 Express、Koa、Fastify 之一 | 确定是 Express + TypeScript |
| 类型安全 | 可能使用 any 或无类型 | 完整的 TypeScript 类型定义 |
| 错误处理 | 无或简单 try-catch | Zod 验证 + 自定义错误类 |
| 输入验证 | 无 | Zod schema 验证查询参数 |
| 分页 | 无 | 包含分页逻辑 |
| 数据库查询 | 可能是原生 SQL 或内存 filter | Prisma ORM 查询 |

Prompt A 的典型输出：
```javascript
app.get('/api/products', (req, res) => {
  const products = db.query('SELECT * FROM products');
  res.json(products);
});
```

Prompt B 的典型输出：
```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const querySchema = z.object({
  category: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
});

router.get('/api/products', async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { category, minPrice } = parsed.data;

  const where: any = {};
  if (category) where.category = category;
  if (minPrice) where.price = { gte: minPrice };

  const products = await prisma.product.findMany({
    where,
    orderBy: { price: 'asc' },
  });

  return res.json(products);
});

export default router;
```

**要点**：
- Prompt A 的输出需要 4-6 轮修改才能用于实际项目
- Prompt B 的输出只需要 1-2 轮微调（如调整错误格式、添加分页）
- 结构化 Prompt 的核心价值是"减少返工"——花 2 分钟写 Prompt，省 20 分钟改代码
- 对比实验应该实际操作一次，亲身感受差异比看表格更有说服力

---

### 练习 3：诊断低质量 Prompt

**思路**：逐一分析"写一个很厉害的函数，可以处理各种数据，要快，要安全，代码要好看，用最新的技术，兼容所有浏览器"中的每个问题，然后给出改写版本。

**答案**：

| 问题 | 对应原则 | 具体问题 |
|------|---------|---------|
| "很厉害" | 具体性 | 主观描述，AI 无法理解什么叫"厉害" |
| "各种数据" | 具体性 | 没有指定数据类型、格式、来源 |
| "要快" | 约束 | 没有量化标准——快是指 < 100ms？还是 < 1s？ |
| "要安全" | 约束 | 没有指定安全要求——防注入？防 XSS？加密？ |
| "代码要好看" | 约束 | 没有指定风格规范——ESLint？Prettier？命名规范？ |
| "最新的技术" | 上下文 | 没有指定技术栈——什么框架？什么语言？ |
| "兼容所有浏览器" | 约束 | 范围过大——包括 IE11 吗？移动端浏览器？ |
| 无示例 | 示例 | 没有输入→输出示例，AI 只能猜 |
| 无上下文 | 上下文 | 不知道项目结构、已有代码、团队规范 |

改写后的 Prompt：

```
在 React 18 + TypeScript + Vite 项目中，实现一个通用的数据格式化函数。

【上下文】
- 前端项目，用于将后端返回的原始数据格式化为表格可展示的格式
- 使用 date-fns 处理日期，使用 Intl.NumberFormat 处理数字

【具体任务】
函数名：formatCellValue
输入：value: unknown, columnType: 'text' | 'number' | 'date' | 'boolean'
输出：string（格式化后的展示文本）

【约束】
- 不使用 any 类型
- number 类型使用千分位分隔符（如 1,234,567）
- date 类型使用 YYYY-MM-DD 格式
- boolean 类型显示为"是"/"否"
- null/undefined 显示为"—"
- 兼容 Chrome 90+、Firefox 90+、Safari 14+（不要求 IE）

【示例】
formatCellValue(1234567, 'number') → "1,234,567"
formatCellValue("2024-01-15T10:30:00Z", 'date') → "2024-01-15"
formatCellValue(true, 'boolean') → "是"
formatCellValue(null, 'text') → "—"
```

**要点**：
- 原始 Prompt 的每个"形容词"（厉害、快、好看）都需要转化为可度量的约束
- "兼容所有浏览器"改为具体版本号，范围从无限变为有限
- 添加输入→输出示例后，AI 能精确理解你的期望格式
- 改写后的 Prompt 长度是原来的 5 倍，但生成代码的返工率降低了 80%

---

**下一课**：[Lesson 02: 需求描述的结构化模板](./02-需求描述的结构化模板.md) —— 学习用 WHAT/WHY/HOW 模式系统化描述开发需求。
