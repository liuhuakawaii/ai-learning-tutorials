# 阶段实战：完整博客 API

前三个阶段学的东西——Express 路由、Prisma 数据层、JWT 认证、RBAC 权限、文件上传、API 文档、日志监控——现在全部接进一个项目里。

这节课不讲新东西，只做一件事：把博客 API 从一个"能跑的 demo"变成一个"能部署的服务"。

## 最终项目结构

```
blog-api/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── lib/
│   │   └── prisma.js
│   ├── middleware/
│   │   ├── auth.js              # JWT 验证
│   │   ├── authorize.js         # RBAC 权限
│   │   ├── errorHandler.js      # 全局错误处理
│   │   ├── logger.js            # 请求日志
│   │   ├── rateLimiter.js       # 限流
│   │   ├── upload.js            # 文件上传
│   │   └── validate.js          # Zod 验证
│   ├── repositories/
│   │   ├── userRepository.js
│   │   ├── postRepository.js
│   │   └── commentRepository.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── posts.js
│   │   └── comments.js
│   ├── app.js
│   └── server.js
├── uploads/                     # 上传文件存储
├── .env
└── package.json
```

## 认证中间件

```js
// src/middleware/auth.js
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未提供认证 token' })
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = { id: payload.userId, role: payload.role }
    next()
  } catch (err) {
    return res.status(401).json({ success: false, error: 'token 无效或已过期' })
  }
}

module.exports = authenticate
```

## RBAC 权限中间件

```js
// src/middleware/authorize.js
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未认证' })
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: '权限不足' })
    }
    next()
  }
}

module.exports = authorize
```

用法：`router.delete('/:id', authenticate, authorize('admin'), handler)` 表示只有管理员能删。

## 认证路由

```js
// src/routes/auth.js
const { Router } = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { z } = require('zod')
const prisma = require('../lib/prisma')
const validate = require('../middleware/validate')

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const JWT_EXPIRES_IN = '7d'

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const existing = await prisma.user.findUnique({ where: { email: req.body.email } })
    if (existing) {
      return res.status(409).json({ success: false, error: '邮箱已注册' })
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    const user = await prisma.user.create({
      data: { name: req.body.name, email: req.body.email, password: hashedPassword },
      select: { id: true, name: true, email: true, role: true },
    })

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

    res.status(201).json({ success: true, data: { user, token } })
  } catch (err) {
    next(err)
  }
})

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } })
    if (!user) {
      return res.status(401).json({ success: false, error: '邮箱或密码错误' })
    }

    const valid = await bcrypt.compare(req.body.password, user.password)
    if (!valid) {
      return res.status(401).json({ success: false, error: '邮箱或密码错误' })
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

    res.json({ success: true, data: { user: { id: user.id, name: user.name, email: user.email, role: user.role }, token } })
  } catch (err) {
    next(err)
  }
})

module.exports = router
```

注意注册时密码错误和登录时密码错误返回的是同一个消息"邮箱或密码错误"——这防止攻击者通过不同错误信息判断某个邮箱是否已注册。

## 文章路由：权限控制

```js
// src/routes/posts.js（关键部分）
const authenticate = require('../middleware/auth')
const authorize = require('../middleware/authorize')

// 公开接口：任何人可以看已发布文章
router.get('/', async (req, res, next) => {
  const posts = await postRepository.findAll({ status: 'published' })
  res.json({ success: true, data: posts })
})

// 需要登录：创建文章
router.post('/', authenticate, validate(createPostSchema), async (req, res, next) => {
  const post = await postRepository.create({ ...req.body, authorId: req.user.id })
  res.status(201).json({ success: true, data: post })
})

// 需要登录 + 是作者或管理员：修改文章
router.put('/:id', authenticate, async (req, res, next) => {
  const post = await postRepository.findById(Number(req.params.id))
  if (!post) return res.status(404).json({ success: false, error: '文章不存在' })
  if (post.authorId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: '只能修改自己的文章' })
  }
  const updated = await postRepository.update(post.id, req.body)
  res.json({ success: true, data: updated })
})

// 管理员可以删任何文章，普通用户只能删自己的
router.delete('/:id', authenticate, async (req, res, next) => {
  const post = await postRepository.findById(Number(req.params.id))
  if (!post) return res.status(404).json({ success: false, error: '文章不存在' })
  if (post.authorId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: '只能删除自己的文章' })
  }
  await postRepository.delete(post.id)
  res.json({ success: true, message: '已删除' })
})
```

## 请求日志中间件

```js
// src/middleware/logger.js
function requestLogger(req, res, next) {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`)
  })
  next()
}

module.exports = requestLogger
```

## 限流中间件

```bash
npm install express-rate-limit
```

```js
// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit')

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: '请求过于频繁，请稍后再试' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: '登录尝试过多，请稍后再试' },
})

module.exports = { apiLimiter, authLimiter }
```

认证路由用更严格的限流——防止暴力破解密码。

## 应用入口组装

```js
// src/app.js
const express = require('express')
const cors = require('cors')
const path = require('path')
const requestLogger = require('./middleware/logger')
const errorHandler = require('./middleware/errorHandler')
const { apiLimiter } = require('./middleware/rateLimiter')
const authRouter = require('./routes/auth')
const usersRouter = require('./routes/users')
const postsRouter = require('./routes/posts')
const commentsRouter = require('./routes/comments')

const app = express()

app.use(cors())
app.use(express.json())
app.use(requestLogger)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRouter)
app.use('/api/users', apiLimiter, usersRouter)
app.use('/api/posts', apiLimiter, postsRouter)
app.use('/api/comments', apiLimiter, commentsRouter)

app.use(errorHandler)

module.exports = app
```

## 测试完整的认证流程

```bash
# 启动服务
npm run dev

# 注册
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"张三","email":"zhangsan@test.com","password":"123456"}'
# 返回 { user, token }

# 用返回的 token 访问受保护接口
TOKEN="上面返回的token"
curl http://localhost:3000/api/posts/mine \
  -H "Authorization: Bearer $TOKEN"

# 未带 token 访问受保护接口
curl http://localhost:3000/api/posts/mine
# → 401

# 创建文章
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"认证测试","content":"测试内容"}'

# 登录（获取新 token）
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"zhangsan@test.com","password":"123456"}'
```

## 这个项目还缺什么

做到这里，博客 API 已经能用了。但离"生产级"还有距离：

- 没有 Swagger 文档（下一阶段补）
- 没有日志持久化（用 Winston 写文件）
- 没有 Docker 打包
- 没有 CI/CD
- 没有文件上传的图片处理（压缩、裁剪）

这些在第三阶段的其他课时里已经有讲，按需接入即可。

## 练习

### 练习一：实现文件上传

用 Multer 实现头像上传接口：
1. `POST /api/users/avatar` 接收图片文件
2. 限制文件大小（2MB）和类型（jpg/png）
3. 把文件存到 `uploads/avatars/` 目录
4. 更新用户的 `avatarUrl` 字段

### 练习二：实现文章草稿箱

添加一个接口 `GET /api/posts/drafts`，返回当前用户的所有草稿文章。要求：
- 必须登录
- 只返回 status 为 'draft' 的文章
- 只返回当前用户自己的

### 练习三：管理员接口

实现 `PATCH /api/users/:id/role`，要求：
- 只有 admin 角色可以调用
- 可以修改用户的角色（user ↔ admin）
- 不能修改自己的角色（防止 admin 把自己降级后没人能改回来）

## 参考答案

### 练习一要点

```js
const multer = require('multer')
const path = require('path')

const storage = multer.diskStorage({
  destination: 'uploads/avatars/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('只支持 jpg 和 png'))
  },
})

router.post('/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  const avatarUrl = `/uploads/avatars/${req.file.filename}`
  await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl } })
  res.json({ success: true, data: { avatarUrl } })
})
```

### 练习二要点

```js
router.get('/drafts', authenticate, async (req, res) => {
  const drafts = await prisma.post.findMany({
    where: { authorId: req.user.id, status: 'draft' },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ success: true, data: drafts })
})
```

### 练习三要点

```js
router.patch('/:id/role', authenticate, authorize('admin'), async (req, res, next) => {
  const userId = Number(req.params.id)
  if (userId === req.user.id) {
    return res.status(400).json({ success: false, error: '不能修改自己的角色' })
  }
  const { role } = req.body
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, error: '无效的角色' })
  }
  const user = await prisma.user.update({ where: { id: userId }, data: { role } })
  res.json({ success: true, data: { id: user.id, name: user.name, role: user.role } })
})
```
