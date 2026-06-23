# 01 - 代码 Prompt 核心原则

> **前置要求**：完成 Stage 1，了解 AI 编程工具的基本使用
>
> **预计时长**：45 分钟

---

## 从一个失败的 Prompt 开始

你刚接手一个新项目，让 AI 写一个用户注册接口。你输入"写一个注册功能"，AI 返回了一段代码——用的是 Express，但你的项目是 Next.js；密码没有哈希，直接明文存储；没有输入验证，没有错误处理。你花了两个小时修改，最后发现还不如自己从头写。

问题不在 AI，在你的 Prompt。你说得太模糊了。

---

## 四个核心原则

写代码 Prompt 就像写函数签名：输入越精确，输出越可靠。

### 原则一：具体性

不说"写一个函数"，要说"写一个接受 `string[]`、返回去重后按字母排序的 `string[]` 的函数"。

```typescript
// 模糊 Prompt 得到的
function sort(arr: any[]) {
  return arr.sort();
}

// 具体 Prompt 得到的
function sortUsersByAge(users: readonly User[]): User[] {
  return [...users].sort((a, b) => a.age - b.age);
}
```

具体性自检清单：
- 是否指定了编程语言/框架？
- 是否明确了输入参数和返回值的类型？
- 是否描述了核心行为逻辑？
- 是否有边界条件说明？

### 原则二：上下文

AI 不知道你项目的结构、已有代码、技术选型。你需要主动提供：

| 层次 | 你需要说的 | 示例 |
|------|----------|------|
| 技术栈 | 用什么框架、什么版本 | "Next.js 14 App Router + Prisma" |
| 项目结构 | 文件在哪、模块怎么组织 | "src/app/api/users/route.ts 是用户模块入口" |
| 相关代码 | 现有的类型、模型、服务 | "这是现有的 User model" |
| 团队约定 | 错误处理方式、日志方案 | "错误用 AppError 类，日志用 pino" |

```typescript
// 无上下文：AI 可能用任何框架
"写个用户增删改查"

// 有上下文：AI 精准生成
"在 Next.js 14 App Router 中，基于现有 prisma/schema.prisma 的 User model，
写一个完整的 CRUD API（route.ts），使用 next/server 的 NextResponse"
```

### 原则三：约束

约束告诉 AI **什么不能做**和**必须遵守什么**：

| 约束类型 | Prompt 示例 |
|---------|------------|
| 类型安全 | "不使用 any，所有参数和返回值必须有明确类型" |
| 错误处理 | "错误向上传播，不用 try-catch 吞错误" |
| 性能 | "时间复杂度不超过 O(n log n)" |
| 安全 | "所有用户输入必须验证，SQL 查询使用参数化" |
| 代码风格 | "函数不超过 30 行，使用 early return 模式" |

```typescript
// 无约束：AI 可能生成这种代码
function getUser(id: any) {
  try {
    const user = db.query(`SELECT * FROM users WHERE id = ${id}`);
    return user;
  } catch (e) { return null; }
}

// 有约束（"不用 any，参数化查询，错误向上传播"）
async function getUserById(id: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new UserNotFoundError(id);
  return user;
}
```

### 原则四：示例

一次展示胜过十次描述。通过输入→输出示例，AI 能精确理解你的期望格式：

```
写一个 parseCSVLine 函数，示例：
输入: "John,30,engineer" → 输出: { name: "John", age: 30, role: "engineer" }
输入: "Jane,25,"          → 输出: { name: "Jane", age: 25, role: null }
输入: ""                  → 抛出 ValidationError("Empty CSV line")
```

示例的三种用法：
- **输入→输出**：数据转换、解析函数
- **边界用例**：错误处理、边界条件
- **调用方式**：API 设计、库接口

---

## 综合运用

把四个原则组合起来，一个高质量 Prompt 长这样：

```
【上下文】Next.js 14 App Router + Prisma + Zod

【任务】实现 /api/users/search 路由

【约束】
- 不使用 any
- 必须用 Zod 验证查询参数
- 搜索支持 name 和 email 的模糊匹配
- 分页参数有默认值（page=1, pageSize=20）

【示例】
GET /api/users/search?q=john&page=1&pageSize=10
→ { data: [...], pagination: { page: 1, pageSize: 10, total: 42 } }
```

这比"写个用户搜索接口"好 10 倍。多花 2 分钟写 Prompt，省 20 分钟改代码。

---

## 常见错误

**过度简略**："写个登录" → AI 不知道用什么框架、什么认证方式、什么存储。至少提供技术栈和核心行为描述。

**信息过载**：把 50 个依赖全列出来，只为了写个按钮组件。只提供与当前任务相关的上下文。

**假设 AI 知道你的约定**："按我们的规范写" → AI 不知道你的规范是什么。明确说明规范内容，或提供规范文件路径。

**一次性描述过于复杂的需求**："写一个完整的电商系统" → 拆解为多个小任务，逐步迭代。

**忽略边界情况**："写个函数把字符串转数字" → 没说空字符串、非数字字符串怎么处理。至少提供 2-3 个边界用例的期望行为。

---

## 工程建议

1. **写 Prompt 前先写注释**：在让 AI 生成代码之前，先用注释写下你期望的输入、输出、边界条件和错误处理方式。这些注释本身就是高质量 Prompt 的骨架。

2. **小步验证，逐步信任**：先从一个小函数开始，验证 AI 是否理解了你的风格和约束，再逐步扩大任务范围。

3. **建立团队 Prompt 库**：好的 Prompt 和好的代码一样值得版本管理。将验证过的高质量 Prompt 模板化，存放在团队共享文档中。

---

## 练习

### 练习一：改写模糊 Prompt（15 分钟）

将 `"写一个处理用户注册的函数"` 改写为符合四大原则的高质量 Prompt。要求：
- 指定技术栈（自选）
- 明确输入/输出类型
- 添加至少 2 个约束
- 提供 1 个输入→输出示例

### 练习二：对比生成效果（20 分钟）

用以下两个 Prompt 分别让 AI 生成代码，对比差异：

```
Prompt A："写个 API"

Prompt B："在 Express + TypeScript 项目中，写一个 GET /api/products 路由，
接受 query 参数 category（string，可选）和 minPrice（number，可选），
返回 Product[] 按价格升序排序，用 Prisma 查询，不使用 any 类型。"
```

记录：生成代码的行数、类型安全性、错误处理、是否符合预期。

### 练习三：诊断低质量 Prompt（10 分钟）

这个 Prompt 有什么问题？逐一列出并改写：

```
"写一个很厉害的函数，可以处理各种数据，要快，要安全，
代码要好看，用最新的技术，兼容所有浏览器。"
```

---

## 参考答案

### 练习一

改写后的 Prompt：

```
在 Express + TypeScript + Prisma 项目中，实现用户注册函数。

上下文：
- 数据库：PostgreSQL，使用 Prisma ORM
- 密码加密：bcrypt，salt rounds = 12
- 输入验证：Zod

任务：
函数名：registerUser
输入参数：{ email: string; name: string; password: string }
返回值：Promise<{ user: Omit<User, 'passwordHash'>; token: string }>

约束：
- 邮箱必须唯一，重复注册返回 409 Conflict
- 密码至少 8 位，必须包含大写、小写、数字
- 不使用 any 类型
- 错误处理使用自定义 AppError 类

示例：
输入：{ email: "alice@example.com", name: "Alice", password: "Pass123!" }
成功输出：{ user: { id: "cuid...", email: "alice@example.com", name: "Alice" }, token: "eyJ..." }
失败输出（邮箱已存在）：AppError("该邮箱已被注册", "EMAIL_EXISTS", 409)
```

### 练习二

Prompt A 的典型输出：5-15 行，可能是 Express、Koa、Fastify 之一，可能使用 any，无错误处理，无分页。

Prompt B 的典型输出：40-80 行，确定是 Express + TypeScript，完整的类型定义，Zod 验证，Prisma 查询，包含分页。

Prompt A 的输出需要 4-6 轮修改才能用于实际项目。Prompt B 只需要 1-2 轮微调。

### 练习三

| 问题 | 对应原则 |
|------|---------|
| "很厉害" | 具体性——主观描述，AI 无法理解 |
| "各种数据" | 具体性——没有指定数据类型 |
| "要快" | 约束——没有量化标准 |
| "要安全" | 约束——没有指定安全要求 |
| "最新的技术" | 上下文——没有指定技术栈 |
| "兼容所有浏览器" | 约束——范围过大 |
| 无示例 | 示例——没有输入→输出示例 |

---

**下一课**：[02 - 需求描述的结构化模板](./02-需求描述的结构化模板.md) — 用 WHAT/WHY/HOW 模式系统化描述开发需求。
