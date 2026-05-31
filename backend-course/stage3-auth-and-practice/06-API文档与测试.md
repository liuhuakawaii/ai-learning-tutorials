# 第六课：API 文档与测试

## 学习目标

完成本课学习后，你将能够：

1. 理解为什么需要 API 文档
2. 使用 Swagger/OpenAPI 规范编写 API 文档
3. 集成 swagger-jsdoc 和 swagger-ui-express
4. 编写完整的接口文档（用户、文章、评论）
5. 了解 API 测试的方法（手动测试、自动化测试）
6. 使用 Vitest + supertest 编写集成测试

---

## 一、为什么需要 API 文档

### 1.1 API 文档的作用

```
场景1：前后端协作
  前端："这个接口怎么调用？参数是什么？"
  后端："看文档。"  ← 如果没有文档呢？

场景2：新人入职
  新人："这个项目的 API 有哪些？"
  老员工："看代码。"  ← 代码那么多，怎么看？

场景3：第三方对接
  第三方："你们的 API 怎么用？"
  你："看文档。"  ← 没有文档就失去了合作机会

场景4：自己维护
  你（三个月后）："这个接口当时是怎么设计的？"
  你："看...我忘了。"
```

### 1.2 好的 API 文档应该包含什么

```
一个好的 API 文档应该包含：

  1. 接口地址（URL）
  2. 请求方法（GET / POST / PUT / DELETE）
  3. 请求参数（路径参数、查询参数、请求体）
  4. 请求头（Authorization、Content-Type）
  5. 响应格式（成功响应、错误响应）
  6. 状态码说明
  7. 示例（请求示例、响应示例）
  8. 认证要求（是否需要 Token）
```

---

## 二、Swagger/OpenAPI 简介

### 2.1 什么是 Swagger

```
Swagger = API 文档规范 + 工具集

Swagger 规范（现在叫 OpenAPI 规范）：
  - 一种描述 REST API 的标准格式
  - 使用 YAML 或 JSON 编写
  - 可以被各种工具解析和使用

Swagger 工具集：
  - Swagger UI：可视化的 API 文档界面
  - Swagger Editor：在线编辑 API 文档
  - Swagger Codegen：根据文档自动生成代码
```

### 2.2 OpenAPI 规范示例

```yaml
openapi: 3.0.0
info:
  title: 博客 API
  version: 1.0.0
  description: 博客平台 API 文档

paths:
  /api/auth/register:
    post:
      summary: 用户注册
      tags: [认证]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, username, password, confirmPassword]
              properties:
                email:
                  type: string
                  format: email
                  example: test@example.com
                username:
                  type: string
                  example: testuser
                password:
                  type: string
                  minLength: 8
                  example: TestPassword123
                confirmPassword:
                  type: string
                  example: TestPassword123
      responses:
        '201':
          description: 注册成功
        '409':
          description: 邮箱或用户名已存在
        '422':
          description: 输入验证失败
```

---

## 三、集成 Swagger UI

### 3.1 安装依赖

```bash
npm install swagger-jsdoc swagger-ui-express
npm install -D @types/swagger-jsdoc @types/swagger-ui-express
```

### 3.2 Swagger 配置

```typescript
// src/config/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc'
import { env } from './env'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '博客平台 API',
      version: '1.0.0',
      description: '一个完整的博客平台 REST API，支持用户认证、文章管理、评论系统等功能。',
      contact: {
        name: 'API 支持',
        email: 'support@blog.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: '开发服务器'
      },
      {
        url: 'https://api.blog.com',
        description: '生产服务器'
      }
    ],
    components: {
      // 定义安全方案
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: '输入你的 Access Token'
        }
      },
      // 定义通用 Schema
      schemas: {
        // 用户 Schema
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            email: { type: 'string', format: 'email', example: 'test@example.com' },
            username: { type: 'string', example: 'testuser' },
            role: { type: 'string', enum: ['ADMIN', 'USER'], example: 'USER' },
            avatar: { type: 'string', nullable: true, example: '/uploads/avatars/xxx.webp' },
            bio: { type: 'string', nullable: true, example: '前端开发者' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        // 文章 Schema
        Article: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            title: { type: 'string', example: '我的第一篇文章' },
            content: { type: 'string', example: '文章内容...' },
            summary: { type: 'string', nullable: true, example: '文章摘要' },
            coverImage: { type: 'string', nullable: true },
            published: { type: 'boolean', example: false },
            viewCount: { type: 'integer', example: 0 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            author: { $ref: '#/components/schemas/User' },
            category: { $ref: '#/components/schemas/Category' },
            tags: {
              type: 'array',
              items: { $ref: '#/components/schemas/Tag' }
            }
          }
        },
        // 分类 Schema
        Category: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: '技术' }
          }
        },
        // 标签 Schema
        Tag: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'JavaScript' }
          }
        },
        // 评论 Schema
        Comment: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            content: { type: 'string', example: '写得很好！' },
            createdAt: { type: 'string', format: 'date-time' },
            author: { $ref: '#/components/schemas/User' },
            replies: {
              type: 'array',
              items: { $ref: '#/components/schemas/Comment' }
            }
          }
        },
        // 成功响应 Schema
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: '操作成功' },
            data: { type: 'object' }
          }
        },
        // 错误响应 Schema
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: '操作失败' },
            errors: { type: 'object', nullable: true }
          }
        },
        // 分页响应 Schema
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: '查询成功' },
            data: {
              type: 'object',
              properties: {
                items: { type: 'array', items: {} },
                pagination: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer', example: 100 },
                    page: { type: 'integer', example: 1 },
                    pageSize: { type: 'integer', example: 10 },
                    totalPages: { type: 'integer', example: 10 }
                  }
                }
              }
            }
          }
        }
      }
    },
    // 全局安全设置（所有接口默认需要认证）
    security: []
  },
  // 扫描这些文件中的注释
  apis: ['./src/routes/*.ts', './src/controllers/*.ts']
}

export const swaggerSpec = swaggerJsdoc(options)
```

### 3.3 在 app.ts 中集成

```typescript
// src/app.ts
import express from 'express'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './config/swagger'
import { env } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import authRoutes from './routes/auth.routes'
import articleRoutes from './routes/article.routes'
import commentRoutes from './routes/comment.routes'
import uploadRoutes from './routes/upload.routes'
import adminRoutes from './routes/admin.routes'
import { authenticate } from './middleware/authenticate'
import { requireAdmin } from './middleware/requireRole'

const app = express()

// ==================== 中间件 ====================
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', env.CORS_ORIGIN)
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// 静态文件
app.use('/uploads', express.static('uploads'))

// ==================== Swagger UI ====================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: '博客 API 文档'
}))

// 提供 OpenAPI JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})

// ==================== 路由 ====================
app.use('/api/auth', authRoutes)
app.use('/api/articles', articleRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/upload', authenticate, uploadRoutes)
app.use('/api/admin', authenticate, requireAdmin, adminRoutes)

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ==================== 错误处理 ====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `路由 ${req.method} ${req.path} 不存在`
  })
})
app.use(errorHandler)

export default app
```

---

## 四、JSDoc 注释编写 Swagger 文档

### 4.1 注释语法

```typescript
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 用户注册
 *     description: 创建新用户账号，返回用户信息和 Token
 *     tags: [认证]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, username, password, confirmPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 用户邮箱
 *                 example: test@example.com
 *               username:
 *                 type: string
 *                 description: 用户名（2-50个字符）
 *                 example: testuser
 *               password:
 *                 type: string
 *                 format: password
 *                 description: 密码（至少8位，包含大小写字母和数字）
 *                 example: TestPassword123
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 description: 确认密码
 *                 example: TestPassword123
 *     responses:
 *       201:
 *         description: 注册成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *                         accessToken:
 *                           type: string
 *                           description: Access Token
 *                         refreshToken:
 *                           type: string
 *                           description: Refresh Token
 *       409:
 *         description: 邮箱或用户名已存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         description: 输入验证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
```

### 4.2 完整的认证接口文档

```typescript
// src/routes/auth.routes.ts
import { Router } from 'express'
import { authController } from '../controllers/auth.controller'
import { validate } from '../middleware/validate'
import { registerSchema, loginSchema } from '../validators/auth.validator'
import { authenticate } from '../middleware/authenticate'

const router = Router()

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 用户注册
 *     description: 创建新用户账号
 *     tags: [认证]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, username, password, confirmPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: test@example.com
 *               username:
 *                 type: string
 *                 example: testuser
 *               password:
 *                 type: string
 *                 format: password
 *                 example: TestPassword123
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 example: TestPassword123
 *     responses:
 *       201:
 *         description: 注册成功
 *       409:
 *         description: 邮箱或用户名已存在
 *       422:
 *         description: 输入验证失败
 */
router.post('/register', validate(registerSchema), authController.register.bind(authController))

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 用户登录
 *     description: 使用邮箱和密码登录
 *     tags: [认证]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: test@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: TestPassword123
 *     responses:
 *       200:
 *         description: 登录成功
 *       401:
 *         description: 邮箱或密码不正确
 */
router.post('/login', validate(loginSchema), authController.login.bind(authController))

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: 获取当前用户信息
 *     description: 获取当前登录用户的详细信息
 *     tags: [认证]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 查询成功
 *       401:
 *         description: 未认证或 Token 已过期
 */
router.get('/me', authenticate, authController.getMe.bind(authController))

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: 刷新 Token
 *     description: 使用 Refresh Token 获取新的 Token 对
 *     tags: [认证]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh Token
 *     responses:
 *       200:
 *         description: Token 刷新成功
 *       401:
 *         description: Refresh Token 无效或已过期
 */
router.post('/refresh', authController.refresh.bind(authController))

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: 修改密码
 *     description: 修改当前用户的密码
 *     tags: [认证]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: 密码修改成功
 *       401:
 *         description: 旧密码不正确
 */
router.put('/change-password', authenticate, authController.changePassword.bind(authController))

export default router
```

### 4.3 文章接口文档

```typescript
// src/routes/article.routes.ts
import { Router } from 'express'
import { authenticate, optionalAuth } from '../middleware/authenticate'
import { requireOwnership } from '../middleware/requireOwnership'
import { validate } from '../middleware/validate'
import { createArticleSchema, updateArticleSchema } from '../validators/article.validator'
import { articleController } from '../controllers/article.controller'

const router = Router()

/**
 * @swagger
 * /api/articles:
 *   get:
 *     summary: 获取文章列表
 *     description: 获取已发布的文章列表，支持分页、分类、标签、搜索筛选
 *     tags: [文章]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 每页数量
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: 分类名称
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: 标签名称
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜索关键词（搜索标题和内容）
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Article'
 */
router.get('/', optionalAuth, articleController.list.bind(articleController))

/**
 * @swagger
 * /api/articles/{id}:
 *   get:
 *     summary: 获取文章详情
 *     description: 根据 ID 获取文章详细信息
 *     tags: [文章]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 文章 ID
 *     responses:
 *       200:
 *         description: 查询成功
 *       404:
 *         description: 文章不存在
 */
router.get('/:id', optionalAuth, articleController.getById.bind(articleController))

/**
 * @swagger
 * /api/articles:
 *   post:
 *     summary: 创建文章
 *     description: 创建新文章（需要登录）
 *     tags: [文章]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *                 example: 我的第一篇文章
 *               content:
 *                 type: string
 *                 example: 这是文章内容...
 *               summary:
 *                 type: string
 *                 example: 这是文章摘要
 *               categoryId:
 *                 type: integer
 *                 example: 1
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["JavaScript", "TypeScript"]
 *               published:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: 创建成功
 *       401:
 *         description: 未认证
 */
router.post(
  '/',
  authenticate,
  validate(createArticleSchema),
  articleController.create.bind(articleController)
)

/**
 * @swagger
 * /api/articles/{id}:
 *   put:
 *     summary: 更新文章
 *     description: 更新文章内容（需要登录且是文章作者或管理员）
 *     tags: [文章]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               summary:
 *                 type: string
 *               categoryId:
 *                 type: integer
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               published:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 更新成功
 *       401:
 *         description: 未认证
 *       403:
 *         description: 无权限
 *       404:
 *         description: 文章不存在
 */
router.put(
  '/:id',
  authenticate,
  requireOwnership({ model: 'article' }),
  validate(updateArticleSchema),
  articleController.update.bind(articleController)
)

/**
 * @swagger
 * /api/articles/{id}:
 *   delete:
 *     summary: 删除文章
 *     description: 删除文章（需要登录且是文章作者或管理员）
 *     tags: [文章]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功
 *       401:
 *         description: 未认证
 *       403:
 *         description: 无权限
 *       404:
 *         description: 文章不存在
 */
router.delete(
  '/:id',
  authenticate,
  requireOwnership({ model: 'article' }),
  articleController.delete.bind(articleController)
)

export default router
```

---

## 五、API 测试

### 5.1 手动测试（curl）

```bash
# 1. 注册用户
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "TestPassword123",
    "confirmPassword": "TestPassword123"
  }'

# 2. 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }'

# 3. 获取当前用户（替换 YOUR_TOKEN）
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 4. 创建文章
curl -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "我的第一篇文章",
    "content": "这是文章内容...",
    "summary": "这是摘要",
    "tags": ["JavaScript", "TypeScript"],
    "published": true
  }'

# 5. 获取文章列表
curl -X GET "http://localhost:3000/api/articles?page=1&pageSize=10"

# 6. 获取单篇文章
curl -X GET http://localhost:3000/api/articles/1
```

### 5.2 使用 Postman 测试

```
Postman 集合结构：

  博客 API
  ├── 认证
  │   ├── POST /api/auth/register
  │   ├── POST /api/auth/login
  │   ├── GET  /api/auth/me
  │   ├── POST /api/auth/refresh
  │   └── PUT  /api/auth/change-password
  ├── 文章
  │   ├── GET    /api/articles
  │   ├── GET    /api/articles/:id
  │   ├── POST   /api/articles
  │   ├── PUT    /api/articles/:id
  │   └── DELETE /api/articles/:id
  ├── 评论
  │   ├── GET    /api/comments
  │   ├── POST   /api/comments
  │   ├── PUT    /api/comments/:id
  │   └── DELETE /api/comments/:id
  └── 管理员
      ├── GET    /api/admin/users
      ├── PUT    /api/admin/users/:id/role
      └── GET    /api/admin/stats

Postman 环境变量：
  base_url: http://localhost:3000
  access_token: (从登录响应中自动设置)
  refresh_token: (从登录响应中自动设置)
```

---

## 六、自动化测试

### 6.1 测试金字塔

```
                    /\
                   /  \
                  / E2E \        少量，慢，贵
                 / 测试   \
                /──────────\
               /  集成测试   \     适量，中等速度
              /──────────────\
             /    单元测试      \   大量，快，便宜
            /──────────────────\

单元测试（Unit Tests）：
  - 测试单个函数或模块
  - 不依赖外部系统（数据库、文件系统）
  - 速度快，数量多
  - 例如：测试 hashPassword 函数

集成测试（Integration Tests）：
  - 测试多个模块协作
  - 可能依赖数据库、文件系统
  - 速度中等
  - 例如：测试注册接口的完整流程

E2E 测试（End-to-End Tests）：
  - 测试整个系统
  - 模拟真实用户操作
  - 速度慢，成本高
  - 例如：测试用户从注册到发布文章的完整流程
```

### 6.2 安装测试依赖

```bash
npm install -D vitest supertest @types/supertest
```

### 6.3 Vitest 配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts']
    }
  }
})
```

```json
// package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 6.4 测试 Setup

```typescript
// tests/setup.ts
import { prisma } from '../src/config/database'

// 测试前清理数据库
beforeEach(async () => {
  // 按照外键依赖顺序删除
  await prisma.comment.deleteMany()
  await prisma.article.deleteMany()
  await prisma.user.deleteMany()
  await prisma.category.deleteMany()
  await prisma.tag.deleteMany()
})

// 所有测试结束后断开数据库连接
afterAll(async () => {
  await prisma.$disconnect()
})
```

### 6.5 测试辅助工具

```typescript
// tests/helpers.ts
import request from 'supertest'
import app from '../src/app'
import { prisma } from '../src/config/database'
import { hashPassword } from '../src/utils/auth'

/**
 * 创建测试用户并返回 Token
 */
export async function createTestUser(overrides: Partial<{
  email: string
  username: string
  password: string
  role: 'ADMIN' | 'USER'
}> = {}) {
  const {
    email = 'test@example.com',
    username = 'testuser',
    password = 'TestPassword123',
    role = 'USER'
  } = overrides

  const hashedPassword = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      role
    }
  })

  // 登录获取 Token
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ email, password })

  return {
    user,
    accessToken: loginResponse.body.data.accessToken,
    refreshToken: loginResponse.body.data.refreshToken
  }
}

/**
 * 创建测试文章
 */
export async function createTestArticle(authorId: number, overrides: Partial<{
  title: string
  content: string
  published: boolean
}> = {}) {
  const {
    title = '测试文章',
    content = '测试内容',
    published = true
  } = overrides

  return prisma.article.create({
    data: {
      title,
      content,
      published,
      authorId
    }
  })
}
```

### 6.6 认证接口测试

```typescript
// tests/auth.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { createTestUser } from './helpers'

describe('认证接口', () => {
  // ==================== 注册测试 ====================
  describe('POST /api/auth/register', () => {
    it('应该成功注册新用户', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'new@example.com',
          username: 'newuser',
          password: 'TestPassword123',
          confirmPassword: 'TestPassword123'
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.user.email).toBe('new@example.com')
      expect(response.body.data.user.username).toBe('newuser')
      expect(response.body.data.accessToken).toBeDefined()
      expect(response.body.data.refreshToken).toBeDefined()
      // 不应该返回密码
      expect(response.body.data.user.password).toBeUndefined()
    })

    it('应该拒绝重复的邮箱', async () => {
      // 先注册一个用户
      await createTestUser({ email: 'duplicate@example.com' })

      // 尝试用相同邮箱注册
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          username: 'another',
          password: 'TestPassword123',
          confirmPassword: 'TestPassword123'
        })

      expect(response.status).toBe(409)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('邮箱')
    })

    it('应该拒绝弱密码', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weak@example.com',
          username: 'weakuser',
          password: '123',
          confirmPassword: '123'
        })

      expect(response.status).toBe(422)
      expect(response.body.success).toBe(false)
    })

    it('应该拒绝不匹配的确认密码', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'mismatch@example.com',
          username: 'mismatch',
          password: 'TestPassword123',
          confirmPassword: 'DifferentPassword123'
        })

      expect(response.status).toBe(422)
    })
  })

  // ==================== 登录测试 ====================
  describe('POST /api/auth/login', () => {
    it('应该成功登录', async () => {
      // 先注册
      await createTestUser({
        email: 'login@example.com',
        password: 'TestPassword123'
      })

      // 登录
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'TestPassword123'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.accessToken).toBeDefined()
      expect(response.body.data.refreshToken).toBeDefined()
    })

    it('应该拒绝错误的密码', async () => {
      await createTestUser({
        email: 'wrong@example.com',
        password: 'TestPassword123'
      })

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'WrongPassword123'
        })

      expect(response.status).toBe(401)
      expect(response.body.message).toContain('邮箱或密码不正确')
    })

    it('应该拒绝不存在的用户', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123'
        })

      // 安全考虑：返回与"密码错误"相同的消息
      expect(response.status).toBe(401)
      expect(response.body.message).toContain('邮箱或密码不正确')
    })
  })

  // ==================== 获取当前用户测试 ====================
  describe('GET /api/auth/me', () => {
    it('应该返回当前用户信息', async () => {
      const { accessToken } = await createTestUser()

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.user.email).toBe('test@example.com')
    })

    it('应该拒绝无 Token 的请求', async () => {
      const response = await request(app)
        .get('/api/auth/me')

      expect(response.status).toBe(401)
    })

    it('应该拒绝无效的 Token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(401)
    })
  })
})
```

### 6.7 文章接口测试

```typescript
// tests/article.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { createTestUser, createTestArticle } from './helpers'

describe('文章接口', () => {
  // ==================== 创建文章测试 ====================
  describe('POST /api/articles', () => {
    it('应该成功创建文章', async () => {
      const { accessToken } = await createTestUser()

      const response = await request(app)
        .post('/api/articles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: '测试文章',
          content: '这是测试内容',
          summary: '这是摘要',
          tags: ['JavaScript', 'TypeScript'],
          published: true
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.article.title).toBe('测试文章')
    })

    it('应该拒绝未认证的请求', async () => {
      const response = await request(app)
        .post('/api/articles')
        .send({
          title: '测试文章',
          content: '测试内容'
        })

      expect(response.status).toBe(401)
    })

    it('应该拒绝缺少必填字段', async () => {
      const { accessToken } = await createTestUser()

      const response = await request(app)
        .post('/api/articles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: '只有标题'
          // 缺少 content
        })

      expect(response.status).toBe(422)
    })
  })

  // ==================== 获取文章列表测试 ====================
  describe('GET /api/articles', () => {
    it('应该返回文章列表', async () => {
      const { user, accessToken } = await createTestUser()

      // 创建几篇文章
      await createTestArticle(user.id, { title: '文章1' })
      await createTestArticle(user.id, { title: '文章2' })
      await createTestArticle(user.id, { title: '文章3' })

      const response = await request(app)
        .get('/api/articles')

      expect(response.status).toBe(200)
      expect(response.body.data.items).toHaveLength(3)
      expect(response.body.data.pagination.total).toBe(3)
    })

    it('应该支持分页', async () => {
      const { user } = await createTestUser()

      // 创建 15 篇文章
      for (let i = 1; i <= 15; i++) {
        await createTestArticle(user.id, { title: `文章${i}` })
      }

      // 获取第 2 页，每页 10 条
      const response = await request(app)
        .get('/api/articles?page=2&pageSize=10')

      expect(response.status).toBe(200)
      expect(response.body.data.items).toHaveLength(5)
      expect(response.body.data.pagination.page).toBe(2)
    })

    it('应该只返回已发布的文章', async () => {
      const { user } = await createTestUser()

      await createTestArticle(user.id, { title: '已发布', published: true })
      await createTestArticle(user.id, { title: '草稿', published: false })

      const response = await request(app)
        .get('/api/articles')

      expect(response.body.data.items).toHaveLength(1)
      expect(response.body.data.items[0].title).toBe('已发布')
    })
  })

  // ==================== 更新文章测试 ====================
  describe('PUT /api/articles/:id', () => {
    it('作者应该能更新自己的文章', async () => {
      const { user, accessToken } = await createTestUser()
      const article = await createTestArticle(user.id)

      const response = await request(app)
        .put(`/api/articles/${article.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: '更新后的标题' })

      expect(response.status).toBe(200)
      expect(response.body.data.article.title).toBe('更新后的标题')
    })

    it('不应该能更新别人的文章', async () => {
      const { user: author } = await createTestUser({ email: 'author@example.com' })
      const { accessToken: otherToken } = await createTestUser({ email: 'other@example.com' })
      const article = await createTestArticle(author.id)

      const response = await request(app)
        .put(`/api/articles/${article.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: '恶意修改' })

      expect(response.status).toBe(403)
    })
  })

  // ==================== 删除文章测试 ====================
  describe('DELETE /api/articles/:id', () => {
    it('作者应该能删除自己的文章', async () => {
      const { user, accessToken } = await createTestUser()
      const article = await createTestArticle(user.id)

      const response = await request(app)
        .delete(`/api/articles/${article.id}`)
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toBe(200)
    })

    it('管理员应该能删除任何文章', async () => {
      const { user: author } = await createTestUser({ email: 'author@example.com' })
      const { accessToken: adminToken } = await createTestUser({
        email: 'admin@example.com',
        role: 'ADMIN'
      })
      const article = await createTestArticle(author.id)

      const response = await request(app)
        .delete(`/api/articles/${article.id}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
    })
  })
})
```

---

## 动手练习

### 练习 1：为评论接口编写 Swagger 文档

```typescript
// 任务：为以下接口编写完整的 Swagger 文档
// GET    /api/comments          - 获取评论列表
// POST   /api/comments          - 创建评论
// PUT    /api/comments/:id      - 更新评论
// DELETE /api/comments/:id      - 删除评论
```

### 练习 2：编写认证接口的集成测试

```typescript
// 任务：补充以下测试用例
// 1. Token 刷新测试
// 2. 修改密码测试
// 3. 更新个人资料测试
// 4. 边界情况测试（空字符串、超长输入等）
```

### 练习 3：编写完整的评论测试

```typescript
// 任务：为评论模块编写完整的测试
// 1. 创建评论
// 2. 获取评论列表（包含嵌套评论）
// 3. 更新评论（只能更新自己的）
// 4. 删除评论（只能删除自己的，管理员可以删除任何）
// 5. 嵌套评论测试
```

---

## 小结

本课我们学习了 API 文档和测试：

| 主题 | 要点 |
|------|------|
| **API 文档** | 前后端协作的桥梁，记录接口的所有细节 |
| **OpenAPI/Swagger** | REST API 的标准文档规范 |
| **swagger-jsdoc** | 通过 JSDoc 注释生成 OpenAPI 文档 |
| **swagger-ui-express** | 在 Express 中集成 Swagger UI |
| **测试金字塔** | 单元测试 > 集成测试 > E2E 测试 |
| **Vitest** | 快速的测试框架 |
| **supertest** | HTTP 接口测试库 |
| **测试策略** | 测试正常流程 + 错误流程 + 边界情况 |

下一课我们将学习 **日志与监控**，为生产环境添加完整的日志系统。
