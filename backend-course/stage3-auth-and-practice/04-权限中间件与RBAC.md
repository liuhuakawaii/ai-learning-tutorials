# 第四课：权限中间件与 RBAC

## 场景引入

你的博客平台上线了，用户可以注册登录、发布文章。但很快问题来了：普通用户通过修改请求中的文章 ID，成功编辑了别人的文章；一个恶意用户通过 API 直接调用了管理员才能使用的删除用户接口。根本原因是你只做了"认证"（确认用户是谁），却没有做"授权"（确认用户能做什么）。在真实项目中，不同角色拥有不同权限是基本需求——管理员能管理所有内容，普通用户只能操作自己的资源。本课将实现完整的权限中间件体系，包括角色检查（RBAC）和资源所有权验证，确保每个 API 端点都有正确的访问控制。

## 学习目标

完成本课学习后，你将能够：

1. 深入理解 Express 中间件的工作机制
2. 实现完整的认证中间件（authMiddleware）
3. 掌握 RBAC（Role-Based Access Control）基于角色的权限控制
4. 实现角色中间件（requireRole）和资源所有权验证（requireOwnership）
5. 设计博客系统的完整权限体系

---

## 一、中间件回顾：请求处理流水线

### 1.1 什么是中间件

```
想象一条工厂流水线：

  原材料 ──→ [质检] ──→ [清洗] ──→ [加工] ──→ [包装] ──→ 成品

  HTTP 请求 ──→ [中间件1] ──→ [中间件2] ──→ [路由处理] ──→ 响应

每个中间件可以：
  ✅ 执行代码（记录日志、验证身份）
  ✅ 修改请求对象（req.user = ...）
  ✅ 修改响应对象
  ✅ 结束请求-响应循环（直接返回响应）
  ✅ 调用下一个中间件（next()）
```

### 1.2 中间件执行流程

```typescript
import express from 'express'

const app = express()

// 中间件 1：记录请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()  // 调用下一个中间件
})

// 中间件 2：解析 JSON
app.use(express.json())

// 中间件 3：CORS
app.use(cors())

// 中间件 4：认证检查
app.use('/api', authenticate)

// 路由处理
app.get('/api/articles', (req, res) => {
  // 到这里时，已经经过了上面所有中间件的处理
  res.json({ articles: [...] })
})
```

```
请求流向图：

  GET /api/articles
       │
       ▼
  ┌─────────────┐
  │  请求日志     │  console.log(...)
  │  next()     │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  JSON 解析    │  express.json()
  │  next()     │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  CORS       │  cors()
  │  next()     │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  认证检查     │  authenticate
  │  next()     │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  路由处理     │  最终的业务逻辑
  │  res.json() │
  └─────────────┘
```

### 1.3 中间件的三种结局

```typescript
// 结局1：放行（调用 next()）
function myMiddleware(req, res, next) {
  // 做一些事情...
  next()  // 继续下一个中间件
}

// 结局2：拦截（直接返回响应，不调用 next()）
function authMiddleware(req, res, next) {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: '未登录' })
    // 不调用 next()，请求到此结束
  }
  next()
}

// 结局3：出错（调用 next(error)）
function riskyMiddleware(req, res, next) {
  try {
    // 可能出错的操作...
    next()
  } catch (error) {
    next(error)  // 传递给错误处理中间件
  }
}
```

---

## 二、认证中间件（authenticate）

### 2.1 完整实现

```typescript
// src/middleware/authenticate.ts
import { Request, Response, NextFunction } from 'express'
import { extractToken, verifyAccessToken, TokenPayload } from '../utils/auth'

// 扩展 Express 的 Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload
    }
  }
}

/**
 * 认证中间件
 * 
 * 功能：
 * 1. 从 Authorization header 提取 Bearer Token
 * 2. 验证 Token 的有效性和过期时间
 * 3. 将解码后的用户信息挂载到 req.user
 * 4. 验证失败返回 401
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // 步骤1：提取 Token
    const token = extractToken(req.headers.authorization)

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证 Token，请先登录',
        code: 'NO_TOKEN'
      })
    }

    // 步骤2：验证 Token
    const payload = verifyAccessToken(token)

    // 步骤3：挂载用户信息到 req
    req.user = payload

    // 步骤4：放行
    next()
  } catch (error) {
    // 处理各种 Token 错误
    if (error instanceof Error) {
      switch (error.message) {
        case 'ACCESS_TOKEN_EXPIRED':
          return res.status(401).json({
            success: false,
            message: 'Token 已过期，请刷新或重新登录',
            code: 'TOKEN_EXPIRED'
          })
        case 'ACCESS_TOKEN_INVALID':
          return res.status(401).json({
            success: false,
            message: 'Token 无效，请重新登录',
            code: 'TOKEN_INVALID'
          })
      }
    }

    return res.status(401).json({
      success: false,
      message: '认证失败',
      code: 'AUTH_FAILED'
    })
  }
}

/**
 * 可选认证中间件
 * 
 * 有 Token 则验证并挂载用户信息
 * 没有 Token 也放行（req.user 为 undefined）
 * 
 * 适用场景：某些接口登录不登录都能访问，但登录用户有额外功能
 * 例如：文章列表，登录用户可以看到自己的草稿
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization)

  if (!token) {
    // 没有 Token，直接放行
    return next()
  }

  try {
    const payload = verifyAccessToken(token)
    req.user = payload
  } catch {
    // Token 无效也放行，只是 req.user 为 undefined
  }

  next()
}
```

### 2.2 使用 authenticate 中间件

```typescript
// src/routes/article.routes.ts
import { Router } from 'express'
import { authenticate } from '../middleware/authenticate'
import { articleController } from '../controllers/article.controller'

const router = Router()

// 公开路由：任何人可以浏览文章
router.get('/', articleController.list)
router.get('/:id', articleController.getById)

// 需要认证的路由：必须登录才能发布文章
router.post('/', authenticate, articleController.create)
router.put('/:id', authenticate, articleController.update)
router.delete('/:id', authenticate, articleController.delete)

export default router
```

---

## 三、RBAC：基于角色的权限控制

### 3.1 什么是 RBAC

```
RBAC（Role-Based Access Control）= 基于角色的访问控制

核心思想：
  不直接给每个用户分配权限
  而是定义"角色"，给角色分配权限
  然后把用户分配到某个角色

类比公司管理：
  ┌─────────────────────────────────────────────┐
  │  员工 ──→ 角色 ──→ 权限                       │
  │                                             │
  │  张三 ──→ 开发工程师 ──→ 写代码、提交代码       │
  │  李四 ──→ 测试工程师 ──→ 写测试、提交 Bug      │
  │  王五 ──→ 产品经理   ──→ 写需求、审批需求       │
  │  赵六 ──→ 管理员     ──→ 所有权限              │
  └─────────────────────────────────────────────┘
```

### 3.2 博客系统的角色设计

```
博客系统角色：

  ┌─────────────────────────────────────────────────────┐
  │                    ADMIN（管理员）                    │
  │                                                     │
  │  权限：                                              │
  │  ✅ 所有 USER 权限                                   │
  │  ✅ 管理用户（查看、禁用、删除）                       │
  │  ✅ 管理所有文章（审核、删除任意文章）                  │
  │  ✅ 管理分类和标签                                    │
  │  ✅ 查看系统统计数据                                  │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │                    USER（普通用户）                   │
  │                                                     │
  │  权限：                                              │
  │  ✅ 查看公开文章                                     │
  │  ✅ 发表评论                                         │
  │  ✅ 发布文章（需要审核）                              │
  │  ✅ 编辑/删除自己的文章                               │
  │  ✅ 编辑个人资料                                     │
  │  ✅ 上传头像                                         │
  │  ❌ 不能管理其他用户                                  │
  │  ❌ 不能删除其他人的文章                              │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │                    GUEST（访客）                      │
  │                                                     │
  │  权限：                                              │
  │  ✅ 查看已发布的文章                                  │
  │  ❌ 不能发表评论                                     │
  │  ❌ 不能发布文章                                     │
  │  ❌ 不能编辑任何内容                                  │
  └─────────────────────────────────────────────────────┘
```

### 3.3 权限矩阵

```
┌──────────────────────┬───────┬──────┬───────┐
│ 操作                  │ GUEST │ USER │ ADMIN │
├──────────────────────┼───────┼──────┼───────┤
│ 浏览已发布文章         │  ✅   │  ✅  │  ✅   │
│ 发表评论              │  ❌   │  ✅  │  ✅   │
│ 发布文章              │  ❌   │  ✅  │  ✅   │
│ 编辑自己的文章         │  ❌   │  ✅  │  ✅   │
│ 删除自己的文章         │  ❌   │  ✅  │  ✅   │
│ 编辑别人的文章         │  ❌   │  ❌  │  ✅   │
│ 删除别人的文章         │  ❌   │  ❌  │  ✅   │
│ 审核文章              │  ❌   │  ❌  │  ✅   │
│ 管理用户              │  ❌   │  ❌  │  ✅   │
│ 管理分类/标签          │  ❌   │  ❌  │  ✅   │
│ 查看统计数据           │  ❌   │  ❌  │  ✅   │
│ 上传文件              │  ❌   │  ✅  │  ✅   │
│ 编辑个人资料           │  ❌   │  ✅  │  ✅   │
└──────────────────────┴───────┴──────┴───────┘
```

---

## 四、角色中间件（requireRole）

### 4.1 实现

```typescript
// src/middleware/requireRole.ts
import { Request, Response, NextFunction } from 'express'

type Role = 'ADMIN' | 'USER'

/**
 * 角色检查中间件工厂函数
 * 
 * @param allowedRoles - 允许的角色列表
 * @returns Express 中间件
 * 
 * 使用示例：
 *   router.delete('/users/:id', authenticate, requireRole('ADMIN'), deleteHandler)
 *   router.get('/admin/dashboard', authenticate, requireRole('ADMIN'), dashboardHandler)
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 检查是否经过认证中间件
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '请先登录'
      })
    }

    // 检查用户角色是否在允许列表中
    if (!allowedRoles.includes(req.user.role as Role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足，需要以下角色之一：' + allowedRoles.join(', ')
      })
    }

    // 角色匹配，放行
    next()
  }
}

// 常用的角色中间件预设
export const requireAdmin = requireRole('ADMIN')
export const requireUser = requireRole('USER', 'ADMIN')
```

### 4.2 使用示例

```typescript
// src/routes/admin.routes.ts
import { Router } from 'express'
import { authenticate } from '../middleware/authenticate'
import { requireAdmin, requireRole } from '../middleware/requireRole'
import { adminController } from '../controllers/admin.controller'

const router = Router()

// 所有管理员路由都需要认证 + ADMIN 角色
router.use(authenticate, requireAdmin)

// 用户管理
router.get('/users', adminController.listUsers)
router.put('/users/:id/role', adminController.updateUserRole)
router.put('/users/:id/status', adminController.toggleUserStatus)
router.delete('/users/:id', adminController.deleteUser)

// 文章审核
router.get('/articles/pending', adminController.listPendingArticles)
router.put('/articles/:id/review', adminController.reviewArticle)

// 统计数据
router.get('/stats', adminController.getStats)

export default router
```

### 4.3 组合多个角色

```typescript
// 场景：允许 ADMIN 和 MODERATOR 角色
router.delete(
  '/articles/:id',
  authenticate,
  requireRole('ADMIN', 'MODERATOR'),
  articleController.delete
)

// 场景：只允许 ADMIN
router.delete(
  '/users/:id',
  authenticate,
  requireRole('ADMIN'),
  userController.delete
)
```

---

## 五、资源所有权验证（requireOwnership）

### 5.1 为什么需要所有权验证

```
场景：用户 A 想编辑用户 B 的文章

  用户 A 的 Token：{ userId: 1, role: 'USER' }
  文章的 authorId：2（属于用户 B）

  如果只检查角色（requireRole('USER')）：
    ❌ 用户 A 有 USER 角色 → 通过
    ❌ 但文章不是 A 的 → 不应该通过！

  所以需要额外检查：这篇文章是不是当前用户的？
```

### 5.2 实现

```typescript
// src/middleware/requireOwnership.ts
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database'

/**
 * 资源所有权验证中间件工厂函数
 * 
 * @param getResourceOwnerId - 获取资源所有者 ID 的函数
 * @param options - 配置选项
 * @returns Express 中间件
 * 
 * 使用示例：
 *   router.put(
 *     '/articles/:id',
 *     authenticate,
 *     requireOwnership(
 *       async (req) => {
 *         const article = await prisma.article.findUnique({
 *           where: { id: parseInt(req.params.id) }
 *         })
 *         return article?.authorId
 *       },
 *       { allowAdmin: true }  // 管理员可以编辑任何文章
 *     ),
 *     articleController.update
 *   )
 */
export function requireOwnership(
  getResourceOwnerId: (req: Request) => Promise<number | null | undefined>,
  options: { allowAdmin?: boolean } = {}
) {
  const { allowAdmin = true } = options

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '请先登录'
        })
      }

      // 管理员可以跳过所有权检查
      if (allowAdmin && req.user.role === 'ADMIN') {
        return next()
      }

      // 获取资源所有者 ID
      const ownerId = await getResourceOwnerId(req)

      // 资源不存在
      if (ownerId === null || ownerId === undefined) {
        return res.status(404).json({
          success: false,
          message: '资源不存在'
        })
      }

      // 检查当前用户是否是资源所有者
      if (req.user.userId !== ownerId) {
        return res.status(403).json({
          success: false,
          message: '你没有权限操作此资源'
        })
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
```

### 5.3 便捷版本：直接用资源模型

```typescript
// src/middleware/requireOwnership.ts（便捷版本）

interface OwnershipConfig {
  model: 'article' | 'comment'  // 支持的模型
  paramName?: string             // 路由参数名，默认 'id'
  ownerField?: string            // 所有者字段名，默认 'authorId'
  allowAdmin?: boolean           // 是否允许管理员跳过，默认 true
}

/**
 * 通用资源所有权验证中间件
 */
export function requireOwnership(config: OwnershipConfig) {
  const {
    model,
    paramName = 'id',
    ownerField = 'authorId',
    allowAdmin = true
  } = config

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '请先登录'
        })
      }

      // 管理员跳过检查
      if (allowAdmin && req.user.role === 'ADMIN') {
        return next()
      }

      const resourceId = parseInt(req.params[paramName])

      if (isNaN(resourceId)) {
        return res.status(400).json({
          success: false,
          message: '无效的资源 ID'
        })
      }

      // 根据模型类型查询资源
      let resource: any

      switch (model) {
        case 'article':
          resource = await prisma.article.findUnique({
            where: { id: resourceId }
          })
          break
        case 'comment':
          resource = await prisma.comment.findUnique({
            where: { id: resourceId }
          })
          break
        default:
          return res.status(500).json({
            success: false,
            message: '不支持的资源类型'
          })
      }

      // 资源不存在
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: '资源不存在'
        })
      }

      // 检查所有权
      if (resource[ownerField] !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: '你没有权限操作此资源'
        })
      }

      // 将资源挂载到 req，方便后续使用（避免重复查询）
      req.resource = resource

      next()
    } catch (error) {
      next(error)
    }
  }
}

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      resource?: any
    }
  }
}
```

### 5.4 使用示例

```typescript
// src/routes/article.routes.ts
import { Router } from 'express'
import { authenticate } from '../middleware/authenticate'
import { requireOwnership } from '../middleware/requireOwnership'
import { articleController } from '../controllers/article.controller'

const router = Router()

// 创建文章：需要登录
router.post('/', authenticate, articleController.create)

// 编辑文章：需要登录 + 是文章作者（或管理员）
router.put(
  '/:id',
  authenticate,
  requireOwnership({ model: 'article' }),
  articleController.update
)

// 删除文章：需要登录 + 是文章作者（或管理员）
router.delete(
  '/:id',
  authenticate,
  requireOwnership({ model: 'article' }),
  articleController.delete
)

export default router
```

---

## 六、完整的权限系统整合

### 6.1 权限检查流程图

```
用户请求 PUT /api/articles/123
    │
    ▼
┌──────────────────────┐
│ 1. authenticate      │  从 Token 中获取用户身份
│    req.user = {      │
│      userId: 1,      │
│      email: '...',   │
│      role: 'USER'    │
│    }                 │
└──────────┬───────────┘
           │ ✅ 认证通过
           ▼
┌──────────────────────┐
│ 2. requireOwnership  │  检查资源所有权
│    article.authorId  │
│    == req.user.userId│
│    123 的作者是 user 1│
│    ✅ 是自己的文章     │
└──────────┬───────────┘
           │ ✅ 授权通过
           ▼
┌──────────────────────┐
│ 3. articleController │  执行业务逻辑
│    .update()         │
│    更新文章...        │
└──────────┬───────────┘
           │
           ▼
       返回成功响应
```

### 6.2 完整的路由权限配置

```typescript
// src/routes/index.ts
import { Router } from 'express'
import { authenticate } from '../middleware/authenticate'
import { requireAdmin, requireRole } from '../middleware/requireRole'
import { requireOwnership } from '../middleware/requireOwnership'

import authRoutes from './auth.routes'
import articleRoutes from './article.routes'
import commentRoutes from './comment.routes'
import adminRoutes from './admin.routes'
import uploadRoutes from './upload.routes'

const router = Router()

// ==================== 公开路由（无需认证）====================
router.use('/auth', authRoutes)

// ==================== 文章路由 ====================
// GET /api/articles          → 公开
// GET /api/articles/:id      → 公开
// POST /api/articles         → 需要登录
// PUT /api/articles/:id      → 需要登录 + 是作者或管理员
// DELETE /api/articles/:id   → 需要登录 + 是作者或管理员
router.use('/articles', articleRoutes)

// ==================== 评论路由 ====================
// GET /api/comments          → 公开
// POST /api/comments         → 需要登录
// PUT /api/comments/:id      → 需要登录 + 是作者或管理员
// DELETE /api/comments/:id   → 需要登录 + 是作者或管理员
router.use('/comments', commentRoutes)

// ==================== 上传路由 ====================
// POST /api/upload/avatar    → 需要登录
// POST /api/upload/image     → 需要登录
router.use('/upload', authenticate, uploadRoutes)

// ==================== 管理员路由 ====================
// 所有 /api/admin/* 路由都需要认证 + ADMIN 角色
router.use('/admin', authenticate, requireAdmin, adminRoutes)

export default router
```

### 6.3 文章路由完整实现

```typescript
// src/routes/article.routes.ts
import { Router } from 'express'
import { authenticate, optionalAuth } from '../middleware/authenticate'
import { requireOwnership } from '../middleware/requireOwnership'
import { validate } from '../middleware/validate'
import { createArticleSchema, updateArticleSchema } from '../validators/article.validator'
import { articleController } from '../controllers/article.controller'

const router = Router()

// 公开路由（可选认证：登录用户可以看到自己的草稿）
router.get('/', optionalAuth, articleController.list)
router.get('/:id', optionalAuth, articleController.getById)

// 需要认证的路由
router.post(
  '/',
  authenticate,
  validate(createArticleSchema),
  articleController.create
)

router.put(
  '/:id',
  authenticate,
  requireOwnership({ model: 'article' }),
  validate(updateArticleSchema),
  articleController.update
)

router.delete(
  '/:id',
  authenticate,
  requireOwnership({ model: 'article' }),
  articleController.delete
)

export default router
```

### 6.4 文章控制器中的权限逻辑

```typescript
// src/controllers/article.controller.ts
import { Request, Response, NextFunction } from 'express'
import { articleService } from '../services/article.service'
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response'

export class ArticleController {
  /**
   * 获取文章列表
   * - 未登录：只能看到已发布的文章
   * - 已登录：可以看到自己的草稿
   * - 管理员：可以看到所有文章
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, pageSize = 10, category, tag, search } = req.query
      const user = req.user  // 可能是 undefined（未登录）

      const result = await articleService.list({
        page: Number(page),
        pageSize: Number(pageSize),
        category: category as string,
        tag: tag as string,
        search: search as string,
        currentUserId: user?.userId,
        currentUserRole: user?.role
      })

      return sendPaginated(res, result.items, result.total, Number(page), Number(pageSize))
    } catch (error) {
      next(error)
    }
  }

  /**
   * 获取单篇文章
   * - 未登录：只能看已发布的
   * - 已登录：可以看自己的草稿
   * - 管理员：可以看任何文章
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const articleId = parseInt(req.params.id)
      const user = req.user

      const article = await articleService.getById(
        articleId,
        user?.userId,
        user?.role
      )

      return sendSuccess(res, { article })
    } catch (error) {
      next(error)
    }
  }

  /**
   * 创建文章（需要登录）
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId  // authenticate 中间件保证了 req.user 存在
      const article = await articleService.create(userId, req.body)

      return sendCreated(res, { article }, '文章创建成功')
    } catch (error) {
      next(error)
    }
  }

  /**
   * 更新文章（需要登录 + 是作者或管理员）
   * requireOwnership 中间件已经检查了权限
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const articleId = parseInt(req.params.id)
      const article = await articleService.update(articleId, req.body)

      return sendSuccess(res, { article }, '文章更新成功')
    } catch (error) {
      next(error)
    }
  }

  /**
   * 删除文章（需要登录 + 是作者或管理员）
   * requireOwnership 中间件已经检查了权限
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const articleId = parseInt(req.params.id)
      await articleService.delete(articleId)

      return sendSuccess(res, null, '文章删除成功')
    } catch (error) {
      next(error)
    }
  }
}

export const articleController = new ArticleController()
```

---

## 七、管理员功能实现

### 7.1 管理员控制器

```typescript
// src/controllers/admin.controller.ts
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database'
import { sendSuccess, sendPaginated } from '../utils/response'
import { NotFoundError } from '../utils/errors'

export class AdminController {
  /**
   * 获取用户列表
   */
  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, pageSize = 20, search, role } = req.query

      const where: any = {}

      if (search) {
        where.OR = [
          { email: { contains: search as string, mode: 'insensitive' } },
          { username: { contains: search as string, mode: 'insensitive' } }
        ]
      }

      if (role) {
        where.role = role
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            avatar: true,
            createdAt: true,
            _count: {
              select: { articles: true, comments: true }
            }
          },
          skip: (Number(page) - 1) * Number(pageSize),
          take: Number(pageSize),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.count({ where })
      ])

      return sendPaginated(res, users, total, Number(page), Number(pageSize))
    } catch (error) {
      next(error)
    }
  }

  /**
   * 更新用户角色
   */
  async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.id)
      const { role } = req.body

      // 不能修改自己的角色
      if (userId === req.user!.userId) {
        return res.status(400).json({
          success: false,
          message: '不能修改自己的角色'
        })
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          email: true,
          username: true,
          role: true
        }
      })

      return sendSuccess(res, { user }, '用户角色更新成功')
    } catch (error) {
      next(error)
    }
  }

  /**
   * 切换用户状态（启用/禁用）
   */
  async toggleUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.id)
      const { isActive } = req.body

      // 不能禁用自己
      if (userId === req.user!.userId) {
        return res.status(400).json({
          success: false,
          message: '不能禁用自己的账号'
        })
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { isActive },
        select: {
          id: true,
          email: true,
          username: true,
          isActive: true
        }
      })

      return sendSuccess(res, { user }, isActive ? '用户已启用' : '用户已禁用')
    } catch (error) {
      next(error)
    }
  }

  /**
   * 删除用户
   */
  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.id)

      // 不能删除自己
      if (userId === req.user!.userId) {
        return res.status(400).json({
          success: false,
          message: '不能删除自己的账号'
        })
      }

      await prisma.user.delete({
        where: { id: userId }
      })

      return sendSuccess(res, null, '用户删除成功')
    } catch (error) {
      next(error)
    }
  }

  /**
   * 获取待审核文章列表
   */
  async listPendingArticles(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, pageSize = 20 } = req.query

      const [articles, total] = await Promise.all([
        prisma.article.findMany({
          where: { status: 'PENDING' },
          include: {
            author: {
              select: { id: true, username: true, avatar: true }
            },
            category: true,
            tags: true
          },
          skip: (Number(page) - 1) * Number(pageSize),
          take: Number(pageSize),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.article.count({ where: { status: 'PENDING' } })
      ])

      return sendPaginated(res, articles, total, Number(page), Number(pageSize))
    } catch (error) {
      next(error)
    }
  }

  /**
   * 审核文章
   */
  async reviewArticle(req: Request, res: Response, next: NextFunction) {
    try {
      const articleId = parseInt(req.params.id)
      const { status, reason } = req.body  // status: 'APPROVED' | 'REJECTED'

      const article = await prisma.article.findUnique({
        where: { id: articleId }
      })

      if (!article) {
        throw new NotFoundError('文章不存在')
      }

      const updatedArticle = await prisma.article.update({
        where: { id: articleId },
        data: {
          status,
          published: status === 'APPROVED',
          reviewNote: reason || null
        }
      })

      return sendSuccess(res, { article: updatedArticle }, '文章审核完成')
    } catch (error) {
      next(error)
    }
  }

  /**
   * 获取统计数据
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const [
        totalUsers,
        totalArticles,
        publishedArticles,
        totalComments,
        todayUsers,
        todayArticles
      ] = await Promise.all([
        prisma.user.count(),
        prisma.article.count(),
        prisma.article.count({ where: { published: true } }),
        prisma.comment.count(),
        prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        }),
        prisma.article.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        })
      ])

      return sendSuccess(res, {
        stats: {
          totalUsers,
          totalArticles,
          publishedArticles,
          totalComments,
          todayUsers,
          todayArticles
        }
      })
    } catch (error) {
      next(error)
    }
  }
}

export const adminController = new AdminController()
```

### 7.2 管理员路由

```typescript
// src/routes/admin.routes.ts
import { Router } from 'express'
import { adminController } from '../controllers/admin.controller'

const router = Router()

// 用户管理
router.get('/users', adminController.listUsers.bind(adminController))
router.put('/users/:id/role', adminController.updateUserRole.bind(adminController))
router.put('/users/:id/status', adminController.toggleUserStatus.bind(adminController))
router.delete('/users/:id', adminController.deleteUser.bind(adminController))

// 文章审核
router.get('/articles/pending', adminController.listPendingArticles.bind(adminController))
router.put('/articles/:id/review', adminController.reviewArticle.bind(adminController))

// 统计数据
router.get('/stats', adminController.getStats.bind(adminController))

export default router
```

---

## 八、权限系统总结图

```
请求进入
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                     路由匹配                                 │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│  authenticate 中间件                                         │
│                                                             │
│  1. 提取 Authorization: Bearer <token>                      │
│  2. 验证 Token 签名和有效期                                   │
│  3. 解码出 { userId, email, role }                          │
│  4. 挂载到 req.user                                         │
│                                                             │
│  ❌ 无 Token / Token 无效 → 401 Unauthorized                │
└──────────┬──────────────────────────────────────────────────┘
           │ ✅ 认证通过
           ▼
┌─────────────────────────────────────────────────────────────┐
│  requireRole 中间件（如果需要）                               │
│                                                             │
│  检查 req.user.role 是否在允许列表中                          │
│                                                             │
│  ❌ 角色不匹配 → 403 Forbidden                              │
└──────────┬──────────────────────────────────────────────────┘
           │ ✅ 角色匹配
           ▼
┌─────────────────────────────────────────────────────────────┐
│  requireOwnership 中间件（如果需要）                          │
│                                                             │
│  1. 管理员直接放行（如果 allowAdmin = true）                   │
│  2. 查询资源，获取 authorId                                  │
│  3. 检查 req.user.userId == authorId                        │
│                                                             │
│  ❌ 不是资源所有者 → 403 Forbidden                           │
└──────────┬──────────────────────────────────────────────────┘
           │ ✅ 所有权验证通过
           ▼
┌─────────────────────────────────────────────────────────────┐
│  Controller 业务逻辑                                         │
│                                                             │
│  处理请求，返回响应                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 动手练习

### 练习 1：实现 authenticate 中间件

```typescript
// 从零实现认证中间件，要求：
// 1. 从 Authorization header 提取 Bearer Token
// 2. 验证 Token 有效性
// 3. 将用户信息挂载到 req.user
// 4. 处理各种错误情况（无 Token、Token 过期、Token 无效）
```

### 练习 2：实现 requireRole 中间件

```typescript
// 实现角色检查中间件，要求：
// 1. 接收允许的角色列表作为参数
// 2. 检查 req.user 的角色是否在列表中
// 3. 返回 403 如果角色不匹配
// 4. 创建 requireAdmin 预设
```

### 练习 3：实现评论的权限系统

```typescript
// 为评论模块实现完整的权限系统：
// 1. GET /api/comments          → 公开
// 2. POST /api/comments         → 需要登录
// 3. PUT /api/comments/:id      → 需要登录 + 是评论作者
// 4. DELETE /api/comments/:id   → 需要登录 + 是评论作者或管理员

// 要求：
// - 使用 authenticate、requireOwnership 中间件
// - 编写完整的路由、控制器、服务代码
```

### 练习 4：设计一个更复杂的权限系统

```typescript
// 场景：博客系统需要增加以下角色：
// - EDITOR（编辑）：可以编辑和发布任何人的文章，但不能管理用户
// - MODERATOR（版主）：可以审核评论和文章，但不能编辑文章内容

// 任务：
// 1. 更新 Role 枚举
// 2. 设计新的权限矩阵
// 3. 实现对应的中间件
// 4. 更新路由配置
```

---

## 常见误区

1. **只做认证不做授权**：很多初学者在路由上加了 `authenticate` 中间件就以为安全了，但没有检查用户角色或资源所有权。结果普通用户通过修改 URL 中的 ID 就能编辑别人的文章。

2. **在 Controller 中手动检查权限**：每个 Controller 方法里都写 `if (user.role !== 'ADMIN') return 403`，导致权限逻辑分散在几十个文件中。应该用中间件统一处理，Controller 只关注业务逻辑。

3. **管理员跳过所有权检查时忘记确认**：`allowAdmin: true` 让管理员可以操作任何资源，但要确保管理员角色是经过严格验证的，而不是从客户端传来的 `role=admin` 参数。

4. **权限中间件顺序错误**：把 `requireRole` 放在 `authenticate` 前面，导致 `req.user` 还没被设置就去检查角色，直接报错。中间件的执行顺序是 `authenticate → requireRole → requireOwnership → Controller`。

---

## 工程建议

1. **权限检查用中间件链**：`router.put('/:id', authenticate, requireOwnership({ model: 'article' }), controller.update)`。这样每个路由的权限要求一目了然，不需要打开 Controller 代码。

2. **将资源挂载到 `req.resource`**：在 `requireOwnership` 中间件里查询资源并挂载到 `req` 对象，Controller 可以直接使用，避免重复查询数据库。

3. **权限矩阵用表格管理**：把角色和权限的对应关系画成表格（本课的权限矩阵），作为项目文档的一部分。新人入职看表格就能理解权限体系，不需要翻代码。

4. **新增 API 时默认加认证**：养成习惯，每个新接口都先加 `authenticate` 中间件，确认是公开接口再去掉。这比"先不加，以后再补"安全得多。

---

## 小结

本课我们学习了权限中间件和 RBAC 权限系统：

| 概念 | 要点 |
|------|------|
| **中间件** | 请求处理流水线，可以执行代码、修改请求、拦截请求 |
| **authenticate** | 认证中间件，从 Token 中提取用户身份 |
| **optionalAuth** | 可选认证，有 Token 就验证，没有也放行 |
| **RBAC** | 基于角色的访问控制，通过角色间接分配权限 |
| **requireRole** | 角色检查中间件，验证用户角色是否在允许列表 |
| **requireOwnership** | 资源所有权验证，确保用户只能操作自己的资源 |
| **allowAdmin** | 管理员可以跳过所有权检查 |
| **401 vs 403** | 401 = 未认证（不知道你是谁），403 = 未授权（知道你是谁但没权限） |

权限检查顺序：authenticate → requireRole → requireOwnership → Controller

下一课我们将学习 **文件上传**，实现用户头像和文章封面图的上传功能。
