# 03 - Chat 模式入门

> **课程定位**：从代码补全升级到 Chat 对话模式，学会用自然语言驱动复杂编码任务。
>
> **前置要求**：掌握代码补全的基本技巧（02 课）
>
> **预计时长**：1.5 小时

---

## 场景引入

你正在开发一个支付模块，代码补全能帮你快速写出函数体，但当你遇到一个复杂的架构问题——"支付回调和订单状态更新之间的事务应该怎么设计？"——补全模式完全派不上用场。你需要的是一个能理解上下文、参与讨论、给出方案的"对话伙伴"。Chat 模式正是为此而生：它让你用自然语言和 AI 讨论设计、排查 bug、生成完整模块，而不只是补全几行代码。

---

## 学习目标

1. 理解 Chat 模式与代码补全模式的核心差异和互补关系
2. 掌握 4 类 Chat 模式的典型用法（生成、解释、调试、重构）
3. 学会编写结构化的 Chat 提问以获得更好的回答
4. 能用 Chat 模式完成真实项目中的编码任务
5. 了解 Chat 模式的局限性并知道何时切换工具

---

## 1. Chat 模式 vs 代码补全

```
┌──────────────────────────────────────────────────────────────────┐
│              代码补全 vs Chat 模式对比                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  代码补全                          Chat 模式                      │
│  ┌──────────────────┐            ┌──────────────────┐            │
│  │ • 行级/块级建议    │            │ • 自然语言交互     │            │
│  │ • 即时、无延迟     │            │ • 多轮对话         │            │
│  │ • 被动接收        │            │ • 主动描述需求     │            │
│  │ • 适合简单代码    │            │ • 适合复杂逻辑     │            │
│  │ • 上下文有限      │            │ • 上下文更丰富     │            │
│  └──────────────────┘            └──────────────────┘            │
│                                                                  │
│  使用场景：                          使用场景：                    │
│  • 写一个新函数的实现                • "帮我设计数据库 Schema"       │
│  • 补全重复模式                      • "解释这段正则表达式"          │
│  • 快速写 boilerplate               • "这个 bug 是什么原因"        │
│                                    • "重构这个类的架构"            │
│                                                                  │
│  最佳实践：两者配合使用                                            │
│  补全自动完成简单部分 → Chat 解决复杂问题 → 补全继续填充细节        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Chat 模式的四大用法

### 2.1 代码生成

用自然语言描述需求，让 AI 生成完整代码。

**示例：生成 REST API 端点**

```
你：用 Express + TypeScript 写一个 REST API 端点 POST /api/orders，
    包含以下功能：
    1. 验证请求体（使用 Zod）
    2. 检查用户是否已登录（从 req.user 获取）
    3. 计算订单总价（从 items 数组中 sum）
    4. 保存到数据库（用 Prisma）
    5. 返回 201 和创建的订单

    请使用 async/await，包含完整的错误处理。
```

**AI 生成**：

```typescript
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
});

const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).nonempty(),
  shippingAddress: z.string().min(1),
  note: z.string().optional(),
});

export async function createOrder(req: Request, res: Response) {
  try {
    // 1. 验证请求体
    const input = CreateOrderSchema.parse(req.body);

    // 2. 检查用户登录状态
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 3. 计算订单总价
    const total = input.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // 4. 保存到数据库
    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        total,
        shippingAddress: input.shippingAddress,
        note: input.note,
        items: {
          create: input.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: { items: true },
    });

    // 5. 返回 201
    return res.status(201).json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Failed to create order:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 2.2 代码解释

让 AI 解释你不理解的代码。

**示例：解释复杂的正则表达式**

```
你：解释这个正则表达式的每一部分：
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
```

**AI 解释**：

```
这个正则表达式用于验证密码强度，要求：
^                    — 字符串开头
(?=.*[a-z])         — 至少包含一个小写字母（前瞻断言）
(?=.*[A-Z])         — 至少包含一个大写字母
(?=.*\d)            — 至少包含一个数字
(?=.*[@$!%*?&])     — 至少包含一个特殊字符
[A-Za-z\d@$!%*?&]  — 只允许这些字符
{8,}                — 长度至少 8 个字符
$                    — 字符串结尾

示例匹配：
✅ "MyPass1!"    ✅ "Str0ng@Pwd"
❌ "mypassword"  （无大写、数字、特殊字符）
❌ "Short1!"     （长度不足 8）
```

**示例：解释复杂的泛型**

```typescript
// 你：解释这个 TypeScript 泛型工具类型的作用

type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

// AI 解释：
// DeepPartial 递归地将对象所有属性变为可选
//
// 例如：
// interface Config {
//   db: { host: string; port: number };
//   cache: { ttl: number };
// }
//
// DeepPartial<Config> 等价于：
// {
//   db?: { host?: string; port?: number };
//   cache?: { ttl?: number };
// }
//
// 用途：用于 update 函数，允许部分更新嵌套对象
```

### 2.3 调试帮助

把错误信息和相关代码发给 AI，让它帮你诊断。

**示例：调试 TypeScript 类型错误**

```
你：我有这个类型错误，帮我修复：

Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.

const user = getUser(id); // 返回 User | undefined
const name: string = user.name; // 报错
```

**AI 回答**：

```
问题是 user 可能是 undefined，直接访问 .name 会报错。

三种解决方案：

方案 1：可选链 + 空值合并（推荐）
const name: string = user?.name ?? 'Unknown';

方案 2：提前检查
if (!user) throw new Error('User not found');
const name: string = user.name;

方案 3：类型断言（不推荐，有风险）
const name: string = user!.name;

推荐方案 1，它既安全又简洁。
```

**示例：调试运行时错误**

```
你：Node.js 报这个错误，代码在读取 JSON 文件时出错：

SyntaxError: Unexpected token < in JSON at position 0

相关代码：
const data = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

可能是什么原因？

AI：错误信息 "Unexpected token <" 通常意味着文件内容不是 JSON，而是 HTML。
可能原因：
1. 文件不存在，服务器返回了 HTML 格式的 404 页面
2. 文件路径错误，指向了一个 HTML 文件
3. 代理/中间件重定向到了登录页面（HTML）

排查步骤：
1. 确认 config.json 文件确实存在
2. 检查文件内容：cat config.json
3. 确认路径是相对于 process.cwd() 的
```

### 2.4 重构建议

让 AI 分析代码并给出重构方案。

```
你：这个函数太长了（80 行），帮我拆分成更小的函数：

AI：建议拆分为 4 个职责单一的函数：

1. validateUserInput(input) — 验证用户输入
2. hashPassword(password) — 加密密码
3. saveUserToDatabase(userData) — 保存用户
4. sendWelcomeEmail(user) — 发送欢迎邮件

主函数变为：
async function createUser(input: CreateUserInput): Promise<User> {
  const validated = validateUserInput(input);
  const hashedPassword = await hashPassword(validated.password);
  const user = await saveUserToDatabase({ ...validated, password: hashedPassword });
  await sendWelcomeEmail(user);
  return user;
}
```

---

## 3. 结构化提问技巧

### 3.1 提问公式

```
┌──────────────────────────────────────────────────────────────┐
│                结构化提问公式                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ① 角色 + 上下文                                             │
│     "我是一个后端开发者，正在用 Express + Prisma 构建 API"      │
│                                                              │
│  ② 具体任务                                                  │
│     "帮我实现一个用户注册端点"                                  │
│                                                              │
│  ③ 技术约束                                                  │
│     "使用 bcrypt 加密密码，Zod 验证输入"                       │
│                                                              │
│  ④ 期望输出                                                  │
│     "给出完整的 TypeScript 代码，包含错误处理"                  │
│                                                              │
│  ⑤ 补充信息（可选）                                           │
│     "数据库 Schema 如下：..."                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 好问题 vs 差问题对比

| 差的问题 | 好的问题 |
|----------|----------|
| "帮我写个 API" | "用 Express + TypeScript 写一个 POST /api/users 注册端点，使用 Zod 验证、bcrypt 加密密码、Prisma ORM" |
| "这个代码有 bug" | "第 15 行报 TypeError: Cannot read property 'id' of undefined，user 来自 getUser(id)，这个函数可能返回 undefined" |
| "怎么优化？" | "这个函数在处理 10K+ 订单时耗时 5 秒，主要瓶颈可能在 N+1 查询，有什么优化方案？" |
| "解释这段代码" | "这段代码实现了什么业务逻辑？第 8 行的三元表达式在什么情况下会走到 false 分支？" |

### 3.3 迭代式对话

```
第一轮：
你：用 Express + TypeScript 实现用户注册端点
AI：[生成基础代码]

第二轮：
你：很好，但需要加上邮箱格式验证和密码强度检查
AI：[添加 Zod 验证规则]

第三轮：
你：密码强度规则要求：至少 8 位，包含大写、小写、数字、特殊字符
AI：[更新密码验证正则]

第四轮：
你：再加一个 rate limiting，防止暴力注册
AI：[添加 express-rate-limit 中间件]
```

**关键**：不要一次把所有需求堆在一起。分步迭代，每轮关注一个改进点。

---

## 4. 实战示例

### 4.1 实战一：用 Chat 构建完整 API

```
提示词：

我需要一个博客文章的 CRUD API，技术栈：
- Express + TypeScript
- Prisma ORM + PostgreSQL
- Zod 验证
- JWT 认证中间件

需要以下端点：
1. GET /api/posts — 列表（支持分页和标签过滤）
2. GET /api/posts/:id — 详情
3. POST /api/posts — 创建（需要登录）
4. PUT /api/posts/:id — 更新（只能更新自己的文章）
5. DELETE /api/posts/:id — 删除（只能删除自己的文章）

请先给出 Prisma Schema，再给出每个端点的实现。
```

### 4.2 实战二：用 Chat 调试生产问题

```
提示词：

生产环境的 API 偶尔返回 500 错误，日志显示：

Error: Connection pool exhausted
    at Pool.acquire (/app/node_modules/pg-pool/index.js:312:23)

代码：
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  const result = await client.query(text, params);
  client.release();
  return result;
}

问题：
1. 为什么会连接池耗尽？
2. 如何修复？
3. 如何防止再次发生？

AI 分析：
1. 原因：client.release() 在 query 抛异常时不会被调用，导致连接泄漏
2. 修复：用 try/finally 确保释放连接
3. 预防：添加 pool 监控 + 连接超时设置
```

### 4.3 实战三：用 Chat 学习新概念

```
你：用简单的例子解释 React 中的 useEffect cleanup 函数，
    我之前只写过 class component，不熟悉 hooks。

AI：
useEffect 的 cleanup 函数相当于 class component 的 componentWillUnmount。

Class Component 版本：
class Timer extends React.Component {
  componentDidMount() {
    this.interval = setInterval(() => console.log('tick'), 1000);
  }
  componentWillUnmount() {
    clearInterval(this.interval);
  }
}

Hook 版本：
function Timer() {
  useEffect(() => {
    const interval = setInterval(() => console.log('tick'), 1000);
    return () => clearInterval(interval); // cleanup
  }, []);
}

cleanup 在以下时机执行：
1. 组件卸载时
2. 依赖项变化，重新执行 effect 前
```

---

## 5. Chat 模式的局限

```
┌──────────────────────────────────────────────────────────────┐
│                Chat 模式不适合的场景                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ❌ 需要精确行级代码修改                                      │
│     → 用代码补全或 Cursor 的 Cmd+K 内联编辑                  │
│                                                              │
│  ❌ 实时编码节奏中的小修改                                     │
│     → 用补全的 Tab 接受，不要打断编码流                       │
│                                                              │
│  ❌ 需要访问项目中的多个文件                                   │
│     → 用 Agent 模式或 @file 引用                             │
│                                                              │
│  ❌ 需要运行命令验证结果                                       │
│     → 用 Agent 模式（可执行终端命令）                         │
│                                                              │
│  ✅ 适合的场景：                                              │
│     • 设计讨论和方案探索                                      │
│     • 复杂逻辑的解释和讨论                                    │
│     • 生成完整的代码模块                                      │
│     • 调试错误和分析日志                                      │
│     • 学习新概念和 API                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. 不同工具的 Chat 体验对比

| 特性 | Copilot Chat | Cursor Chat | ChatGPT | Claude |
|------|-------------|-------------|---------|--------|
| IDE 内嵌 | ✅ | ✅ | ❌ 浏览器 | ❌ 浏览器 |
| 文件引用 | @file | @file @web | 上传文件 | 上传文件 |
| 代码应用 | 一键插入 | 一键应用 | 手动复制 | 手动复制 |
| 上下文感知 | 当前文件 | 整个项目 | 无 | 无 |
| 多轮对话 | ✅ | ✅ | ✅ | ✅ |
| 最佳场景 | 快速问答 | 深度项目对话 | 通用编程问题 | 复杂逻辑讨论 |

---

## 7. 常见误区

| 错误 | 为什么有问题 | 正确做法 |
|------|-------------|----------|
| 一次提问包含所有需求 | AI 可能遗漏或混淆部分需求 | 分步迭代，每轮聚焦一个改进点 |
| 不提供技术栈信息 | AI 可能用你不想用的库 | 明确说明：Express + TypeScript + Prisma |
| 复制整段代码不加说明 | AI 不知道你的问题是什么 | 指出具体行号、具体错误信息 |
| 不验证 AI 生成的代码 | 可能有 bug、安全问题 | 复制到 IDE 运行测试，不要直接用 |
| 只问"怎么做"不问"为什么" | 学不到东西，下次还不会 | 要求 AI 解释原理和设计决策 |
| 用 Chat 处理实时编码 | 打断编码节奏，效率低 | 小修改用补全，复杂问题才用 Chat |
| 不利用多轮对话 | 每次新对话丢失上下文 | 在同一对话中迭代改进 |

---

## 8. 工程建议

1. **复杂任务用 Chat，简单修改用补全**：不要用 Chat 来改一个变量名，也不要用补全来设计数据库 Schema。根据任务复杂度选择正确的模式，避免在不合适的工具上浪费时间。
2. **每次提问带上技术栈**：养成习惯在提问开头说明技术栈（如"Express + TypeScript + Prisma"），这能让 AI 生成与你项目一致的代码，减少大量适配工作。
3. **分步迭代优于一次到位**：与其一次性列出 10 个需求，不如每轮聚焦一个改进点。分步迭代不仅让 AI 更准确，也让你在每一步都有机会审查和调整方向。
4. **善用"解释为什么"的追问**：当 AI 给出方案后，追问"为什么这样设计？有没有其他方案？各自的 tradeoff 是什么？"——这能让你真正学到东西，而不只是复制代码。

---

## 9. 总结

本课要点：

1. **Chat vs 补全**：Chat 适合复杂任务，补全适合实时编码，两者互补
2. **四大用法**：代码生成、代码解释、调试帮助、重构建议
3. **结构化提问**：角色 + 上下文 + 任务 + 约束 + 期望输出
4. **迭代式对话**：分步改进比一次到位更高效
5. **局限性**：Chat 不适合实时小修改、需要执行命令的场景

### 下一课预告

**04 - 上下文管理**：学习如何给 AI 提供正确的上下文——理解上下文窗口、使用文件引用、管理项目级上下文，让 AI 的回答更精准。

---

## 动手练习

### 练习 1：生成 vs 补全对比（20 分钟）

选择一个中等复杂度的任务（如实现一个 todo list 的增删改查），分别用以下两种方式完成：
- **方式 A**：只用代码补全，一行一行写
- **方式 B**：用 Chat 生成完整代码

记录两种方式的耗时、代码质量、需要手动修改的部分。

### 练习 2：结构化提问练习（20 分钟）

用以下差的提问和好的提问分别向 AI 提问，对比回答质量：
- **差**："帮我写个登录功能"
- **好**："用 Express + TypeScript + JWT 实现登录端点 POST /api/auth/login，包含邮箱/密码验证、bcrypt 比较、token 生成，使用 Zod 验证输入"

记录两次回答的质量差异（完整性、安全性、代码风格）。

### 练习 3：调试实战（25 分钟）

故意在你的项目中引入一个 bug（如错误的异步处理、类型不匹配），然后用 Chat 模式调试：
1. 描述错误现象
2. 提供相关代码
3. 记录 AI 的诊断过程
4. 验证 AI 建议的修复方案

评估 AI 的调试能力：诊断是否准确？修复方案是否最优？
