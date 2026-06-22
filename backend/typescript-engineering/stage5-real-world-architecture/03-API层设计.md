# 03 API 层设计

## 场景引入

你的团队同时维护着三个前端项目：Web 端用 React、移动端用 React Native、管理后台用 Vue。三个端调用同一套后端 API，但需求各不相同——Web 端需要嵌套的用户关系数据，移动端只需要精简字段，管理后台要批量操作。REST API 的 over-fetching 和 under-fetching 问题越来越严重，前后端的联调成本越来越高。你需要找到一种 API 方案，既能满足不同端的需求，又能保证类型安全。

## 学习目标

- 对比 REST、GraphQL、tRPC 三种 API 范式的适用场景与取舍
- 掌握 tRPC 的核心概念：Router、Procedure、Middleware
- 实现端到端类型安全的 API 层，前端调用自动获得类型推导
- 设计 API 层的错误处理与输入校验策略
- 理解 tRPC 的适用边界，知道何时该选择其他方案

## 一、REST vs GraphQL vs tRPC

三种方案没有绝对优劣，关键是理解它们各自解决什么问题：

```typescript
// REST：资源导向，简单直接
// GET  /api/orders/:id
// POST /api/orders
// 优势：缓存友好、工具链成熟、无状态
// 劣势：over-fetching、多端适配需要 BFF 层

// GraphQL：查询导向，客户端决定要什么
// query { order(id: "123") { id, items { name, price } } }
// 优势：精确获取、强类型 Schema、内省
// 劣势：缓存复杂、N+1 问题、学习成本高

// tRPC：函数导向，端到端类型安全
// const order = await trpc.order.getById.query({ id: "123" })
// 优势：零代码生成、TypeScript 原生、调用方自动获得类型
// 劣势：仅限 TypeScript 生态、不适合公开 API
```

### 选型决策树

```typescript
// 场景判断
function chooseAPI(stack: {
  isTypeScript: boolean
  isPublicAPI: boolean
  multipleClients: boolean
  needsPreciseData: boolean
}): 'REST' | 'GraphQL' | 'tRPC' {
  // 公开 API 给第三方用 → REST
  if (stack.isPublicAPI) return 'REST'
  
  // 全栈 TypeScript + 内部消费 → tRPC
  if (stack.isTypeScript && !stack.isPublicAPI) return 'tRPC'
  
  // 多端 + 需要精确数据 → GraphQL
  if (stack.multipleClients && stack.needsPreciseData) return 'GraphQL'
  
  return 'REST'
}
```

## 二、tRPC 基础架构

tRPC 的核心是 **Procedure**（过程）——一个带输入校验和输出类型的函数：

```typescript
import { initTRPC } from '@trpc/server'
import { z } from 'zod'

// 初始化 tRPC 上下文
interface Context {
  userId: string | null
  logger: Logger
}

const t = initTRPC.context<Context>().create()

// 基础构建块
const router = t.router
const publicProcedure = t.procedure
const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Login required' })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})

// 定义 Router
const orderRouter = router({
  // 查询单个订单
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const order = await db.orders.findById(input.id)
      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' })
      }
      return order
    }),

  // 创建订单（需要登录）
  create: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })).min(1),
      shippingAddress: z.string().min(10),
    }))
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info({ userId: ctx.userId, itemCount: input.items.length }, 'Creating order')
      return db.orders.create({ ...input, userId: ctx.userId })
    }),

  // 分页列表
  list: publicProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      status: z.enum(['pending', 'paid', 'shipped']).optional(),
    }))
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.pageSize
      const [orders, total] = await Promise.all([
        db.orders.findMany({
          where: input.status ? { status: input.status } : {},
          skip: offset,
          take: input.pageSize,
        }),
        db.orders.count({
          where: input.status ? { status: input.status } : {},
        }),
      ])
      return { orders, total, page: input.page, pageSize: input.pageSize }
    }),
})
```

## 三、中间件：横切关注点

tRPC 的中间件可以拦截请求，实现认证、日志、限流等横切关注点：

```typescript
import { TRPCError } from '@trpc/server'

// 日志中间件：记录每个请求的耗时
const loggingMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const start = performance.now()
  ctx.logger.info({ path, type }, 'tRPC request started')
  
  const result = await next()
  
  const duration = performance.now() - start
  ctx.logger.info({ path, type, duration: `${duration.toFixed(2)}ms` }, 'tRPC request completed')
  
  return result
})

// 限流中间件
const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  const key = ctx.userId || 'anonymous'
  const allowed = await rateLimiter.check(key, { limit: 100, window: '1m' })
  
  if (!allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded',
    })
  }
  
  return next()
})

// 错误处理中间件
const errorHandlingMiddleware = t.middleware(async ({ next, ctx }) => {
  try {
    return await next()
  } catch (error) {
    if (error instanceof AppError) {
      throw new TRPCError({
        code: mapAppErrorToTRPCCode(error),
        message: error.message,
        cause: error,
      })
    }
    throw error
  }
})

// 组合中间件
const baseProcedure = t.procedure
  .use(loggingMiddleware)
  .use(rateLimitMiddleware)
  .use(errorHandlingMiddleware)

function mapAppErrorToTRPCCode(error: AppError): TRPCError['code'] {
  switch (error.constructor) {
    case ValidationError: return 'BAD_REQUEST'
    case NotFoundError: return 'NOT_FOUND'
    case ForbiddenError: return 'FORBIDDEN'
    case TransientError: return 'SERVICE_UNAVAILABLE'
    default: return 'INTERNAL_SERVER_ERROR'
  }
}
```

## 四、前端调用：端到端类型安全

tRPC 最大的优势是前端调用时自动获得完整类型推导：

```typescript
// 前端：创建 tRPC 客户端
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '../server/router'

// 这个类型是从后端 Router 定义自动推导的
const trpc = createTRPCReact<AppRouter>()

// 使用示例
function OrderList() {
  const { data, isLoading, error } = trpc.order.list.useQuery({
    page: 1,
    pageSize: 20,
    status: 'pending',
  })
  // data 的类型自动推导为 { orders: Order[], total: number, page: number, pageSize: number }
  
  if (isLoading) return <Spinner />
  if (error) return <ErrorMessage error={error} />
  
  return (
    <ul>
      {data.orders.map(order => (
        <li key={order.id}>{order.id} - {order.status}</li>
        // order 的类型自动推导，IDE 会提示所有可用字段
      ))}
    </ul>
  )
}

// 创建订单
function CreateOrderForm() {
  const createOrder = trpc.order.create.useMutation({
    onSuccess: (order) => {
      // order 的类型自动推导为 Order
      router.push(`/orders/${order.id}`)
    },
  })
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      createOrder.mutate({
        items: [{ productId: 'p1', quantity: 2 }],
        shippingAddress: '123 Main St, City, Country',
      })
      // 如果传入了错误的字段名或类型，TypeScript 会立即报错
    }}>
      {/* ... */}
    </form>
  )
}
```

## 五、API 层的输入校验

tRPC 使用 Zod 进行输入校验，校验规则同时作用于运行时和类型推导：

```typescript
import { z } from 'zod'

// 定义校验 Schema
const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid('Invalid product ID'),
    quantity: z.number().int().positive('Quantity must be positive'),
    variantId: z.string().optional(),
  })).min(1, 'At least one item required').max(50, 'Maximum 50 items per order'),
  
  shippingAddress: z.object({
    street: z.string().min(5).max(200),
    city: z.string().min(2).max(100),
    zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid zip code'),
    country: z.string().length(2, 'Use ISO 3166-1 alpha-2'),
  }),
  
  couponCode: z.string().optional(),
  
  paymentMethod: z.discriminatedUnion('type', [
    z.object({ type: z.literal('card'), last4: z.string().length(4) }),
    z.object({ type: z.literal('paypal'), email: z.string().email() }),
  ]),
})

// 类型自动从 Schema 推导
type CreateOrderInput = z.infer<typeof createOrderSchema>
// 编译器知道所有字段的精确类型

const orderRouter = router({
  create: protectedProcedure
    .input(createOrderSchema)
    .mutation(async ({ input, ctx }) => {
      // input 已经过校验，类型安全
      return db.orders.create({
        userId: ctx.userId,
        items: input.items,
        shippingAddress: input.shippingAddress,
      })
    }),
})
```

## 常见误区

1. **把 tRPC 用作公开 API**：tRPC 依赖 TypeScript 类型信息，不适合给非 TS 客户端使用，公开 API 应选 REST 或 GraphQL
2. **Procedure 写太多业务逻辑**：Procedure 应该是薄薄的一层，业务逻辑放在 Service 层，便于复用和测试
3. **忽略错误映射**：直接把数据库错误抛给前端，暴露内部实现细节，应该在中间件中统一映射为 TRPCError
4. **过度嵌套 Router**：Router 层级超过三层会让路径变得难以维护，建议扁平化组织

## 工程建议

1. **Procedure 命名用动词**：`getById`、`create`、`list`、`cancel`，不要用名词如 `order`（语义不清）
2. **输入校验用 Zod 的 transform**：在 Schema 层面完成数据转换（如 `z.string().transform(s => s.trim())`），避免在业务代码中重复处理
3. **为常用查询建立预设**：用 `z.default()` 为分页、排序等参数提供合理默认值，减少前端传参负担
4. **tRPC + React Query 结合**：利用 React Query 的缓存、乐观更新、后台刷新能力，不要自己管理请求状态

## 小结

本课对比了 REST、GraphQL、tRPC 三种 API 范式的适用场景，重点介绍了 tRPC 如何通过 TypeScript 类型推导实现端到端类型安全。从 Router 定义、中间件设计到前端调用，展示了一个完整的 tRPC API 层架构。核心价值：**改后端接口，前端立即知道哪里需要适配**。

## 练习

### 练习一：设计 tRPC Router

为一个博客系统设计 tRPC Router，包含：获取文章列表（分页+标签筛选）、获取单篇文章、创建文章（需要认证）、更新文章（需要是作者）。

### 练习二：实现认证中间件

实现一个 `protectedProcedure`，从 Context 中提取 JWT Token，校验过期时间，并将用户信息注入到后续 Procedure 中。

### 练习三：Zod Schema 设计

为一个用户注册接口设计 Zod Schema，要求：邮箱格式校验、密码强度校验（至少 8 位，包含大小写和数字）、两次密码必须一致、用户名只能包含字母数字下划线。

---

## 参考答案

### 练习一

**思路**：按功能模块拆分 Router，每个 Procedure 用 Zod 定义输入，查询类用 query，写入类用 mutation。

**答案**：
```typescript
import { z } from 'zod'

const postRouter = router({
  list: publicProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().min(1).max(50).default(10),
      tag: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.pageSize
      const where = input.tag ? { tags: { has: input.tag } } : {}
      const [posts, total] = await Promise.all([
        db.posts.findMany({ where, skip: offset, take: input.pageSize, orderBy: { createdAt: 'desc' } }),
        db.posts.count({ where }),
      ])
      return { posts, total, page: input.page }
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const post = await db.posts.findById(input.id)
      if (!post) throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' })
      return post
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      content: z.string().min(10),
      tags: z.array(z.string()).max(10),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.posts.create({ ...input, authorId: ctx.userId })
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      content: z.string().min(10).optional(),
      tags: z.array(z.string()).max(10).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const post = await db.posts.findById(input.id)
      if (!post) throw new TRPCError({ code: 'NOT_FOUND' })
      if (post.authorId !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not the author' })
      }
      return db.posts.update(input.id, {
        title: input.title ?? post.title,
        content: input.content ?? post.content,
        tags: input.tags ?? post.tags,
      })
    }),
})
```

**要点**：
- 分页参数用 `.default()` 提供默认值
- `update` 先检查资源存在，再检查权限，顺序不能反
- 用 `??` 实现可选字段的局部更新

### 练习二

**思路**：用 tRPC middleware 从 header 提取 token，用 JWT 库校验，将用户信息传递给下游。

**答案**：
```typescript
import jwt from 'jsonwebtoken'
import { TRPCError } from '@trpc/server'

interface JWTPayload {
  sub: string
  email: string
  role: string
  exp: number
}

const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const authHeader = ctx.req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing token' })
  }

  const token = authHeader.slice(7)
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
    
    return next({
      ctx: {
        ...ctx,
        userId: payload.sub,
        userEmail: payload.email,
        userRole: payload.role,
      },
    })
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token expired' })
    }
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
  }
})
```

**要点**：
- 先检查 header 存在，再解析 token，避免无意义的验证操作
- 区分 Token 过期和无效两种情况，方便前端处理刷新逻辑
- `jwt.verify` 失败直接抛 TRPCError，不暴露 JWT 库的具体错误

### 练习三

**思路**：用 Zod 的 `.refine()` 实现跨字段校验（密码一致），用 `.regex()` 实现密码强度。

**答案**：
```typescript
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a digit'),
  
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type RegisterInput = z.infer<typeof registerSchema>
```

**要点**：
- `.refine()` 的 `path` 指定错误关联到哪个字段，前端可以精确显示错误位置
- `email` 用 `.toLowerCase()` transform 统一为小写，避免大小写导致的重复注册
- 密码强度规则用多个 `.regex()` 叠加，每条规则有独立的错误消息
