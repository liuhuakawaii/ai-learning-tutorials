# 阶段实战：博客 API 基础版

前 8 课你分别学了 Node.js 基础、npm、模块系统、内置模块、Express、路由中间件、RESTful API 设计、请求验证与错误处理。现在要把它们拼成一个能跑的项目。

这节课不讲新概念。直接从零搭一个博客 API，包含用户、文章、评论三个模块的 CRUD。做完就能拿去当第一个后端作品。

## 项目结构

```
blog-api/
├── package.json
├── src/
│   ├── app.js              # Express 应用配置
│   ├── server.js           # 启动入口
│   ├── routes/
│   │   ├── users.js
│   │   ├── posts.js
│   │   └── comments.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── validate.js
│   └── data/
│       └── store.js        # 内存数据存储（后面阶段会换成数据库）
└── tests/
    └── api.http            # 用 VS Code REST Client 测试
```

先初始化项目：

```bash
mkdir blog-api && cd blog-api
npm init -y
npm install express zod
npm install -D nodemon
```

在 `package.json` 里加 scripts：

```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js"
  }
}
```

## 内存数据存储

先用数组模拟数据库，后面阶段再换成真正的数据库。关键是数据结构要设计对。

```js
// src/data/store.js
const store = {
  users: [
    { id: 1, name: '张三', email: 'zhangsan@example.com', createdAt: new Date().toISOString() },
    { id: 2, name: '李四', email: 'lisi@example.com', createdAt: new Date().toISOString() },
  ],
  posts: [
    { id: 1, title: '第一篇博客', content: 'Hello World', authorId: 1, status: 'published', createdAt: new Date().toISOString() },
  ],
  comments: [
    { id: 1, postId: 1, authorId: 2, content: '写得不错！', createdAt: new Date().toISOString() },
  ],
  nextId: { users: 3, posts: 2, comments: 2 },
}

module.exports = store
```

注意 `nextId` 的设计——每张表维护一个自增 ID，创建新记录时用它，用完加一。这和数据库的自增主键是同一个思路。

## 统一错误处理

所有路由里的错误都通过 `next(err)` 抛出，由一个中间件统一处理。不要在每个路由里单独写 `res.status(500).json(...)`。

```js
// src/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500
  const message = err.message || '服务器内部错误'

  console.error(`[${req.method}] ${req.url} - ${statusCode}: ${message}`)

  res.status(statusCode).json({
    success: false,
    error: message,
  })
}

module.exports = errorHandler
```

自定义错误可以这样抛：

```js
const err = new Error('用户不存在')
err.statusCode = 404
next(err)
```

## Zod 验证中间件

写一个通用的验证中间件，接收 schema，验证请求体：

```js
// src/middleware/validate.js
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const err = new Error(result.error.issues.map(i => i.message).join('; '))
      err.statusCode = 400
      return next(err)
    }
    req.body = result.data
    next()
  }
}

module.exports = validate
```

这个中间件可以复用在任何路由上，传不同的 Zod schema 就行。

## 路由实现：以文章模块为例

```js
// src/routes/posts.js
const { Router } = require('express')
const { z } = require('zod')
const store = require('../data/store')
const validate = require('../middleware/validate')

const router = Router()

const createPostSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  content: z.string().min(1, '内容不能为空'),
  authorId: z.number().int().positive(),
  status: z.enum(['draft', 'published']).default('draft'),
})

// 获取文章列表，支持按状态筛选
router.get('/', (req, res) => {
  let posts = store.posts
  if (req.query.status) {
    posts = posts.filter(p => p.status === req.query.status)
  }
  res.json({ success: true, data: posts })
})

// 获取单篇文章
router.get('/:id', (req, res, next) => {
  const post = store.posts.find(p => p.id === Number(req.params.id))
  if (!post) {
    const err = new Error('文章不存在')
    err.statusCode = 404
    return next(err)
  }
  res.json({ success: true, data: post })
})

// 创建文章
router.post('/', validate(createPostSchema), (req, res) => {
  const post = {
    id: store.nextId.posts++,
    ...req.body,
    createdAt: new Date().toISOString(),
  }
  store.posts.push(post)
  res.status(201).json({ success: true, data: post })
})

// 更新文章
router.put('/:id', validate(createPostSchema.partial()), (req, res, next) => {
  const index = store.posts.findIndex(p => p.id === Number(req.params.id))
  if (index === -1) {
    const err = new Error('文章不存在')
    err.statusCode = 404
    return next(err)
  }
  store.posts[index] = { ...store.posts[index], ...req.body }
  res.json({ success: true, data: store.posts[index] })
})

// 删除文章
router.delete('/:id', (req, res, next) => {
  const index = store.posts.findIndex(p => p.id === Number(req.params.id))
  if (index === -1) {
    const err = new Error('文章不存在')
    err.statusCode = 404
    return next(err)
  }
  const deleted = store.posts.splice(index, 1)[0]
  res.json({ success: true, data: deleted })
})

module.exports = router
```

用户模块和评论模块的写法类似，都是 `find`/`push`/`splice` 操作数组。评论模块有一个特殊逻辑：删除文章时应该同时删除该文章下的所有评论。

## 应用入口

```js
// src/app.js
const express = require('express')
const errorHandler = require('./middleware/errorHandler')
const usersRouter = require('./routes/users')
const postsRouter = require('./routes/posts')
const commentsRouter = require('./routes/comments')

const app = express()

app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/users', usersRouter)
app.use('/api/posts', postsRouter)
app.use('/api/comments', commentsRouter)

app.use(errorHandler)

module.exports = app
```

```js
// src/server.js
const app = require('./app')
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`博客 API 运行在 http://localhost:${PORT}`)
})
```

## 测试你的 API

用 curl 或者 VS Code REST Client 都行。这里用 curl：

```bash
# 健康检查
curl http://localhost:3000/health

# 获取文章列表
curl http://localhost:3000/api/posts

# 按状态筛选
curl "http://localhost:3000/api/posts?status=published"

# 创建文章
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"新文章","content":"内容","authorId":1}'

# 更新文章
curl -X PUT http://localhost:3000/api/posts/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"修改后的标题"}'

# 删除文章
curl -X DELETE http://localhost:3000/api/posts/1

# 测试验证失败
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"","content":""}'
```

## 你可能会踩的坑

**路由顺序问题**：`router.get('/:id')` 要放在 `router.get('/')` 后面。否则 `/` 会被当成 `:id` 参数匹配。

**JSON 解析忘记加**：`app.use(express.json())` 必须在路由之前。否则 `req.body` 是 `undefined`。

**数据是内存的**：重启服务器，所有数据回到初始状态。这是有意为之——先跑通流程，后面再接数据库。

## 练习

### 练习一：补全用户和评论模块

把 `src/routes/users.js` 和 `src/routes/comments.js` 写出来。要求：
- 用户模块：CRUD 五个接口
- 评论模块：创建评论、获取某篇文章的评论列表、删除评论
- 评论创建时要验证 postId 对应的文章存在

### 练习二：添加关联查询

`GET /api/posts/:id` 返回文章时，同时返回该文章的作者信息和评论列表。提示：在内存数据里做 join，用 `authorId` 查用户，用 `postId` 查评论。

### 练习三：统一响应格式

所有接口的响应都遵循这个格式：

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

错误时：

```json
{
  "success": false,
  "error": "错误信息"
}
```

封装一个 `respond(res, data, message)` 工具函数，在所有路由里使用。

## 参考答案

### 练习一要点

用户路由和文章路由结构一样，只是字段不同。评论模块的核心逻辑：

```js
// 创建评论时验证文章存在
router.post('/', validate(commentSchema), (req, res, next) => {
  const post = store.posts.find(p => p.id === req.body.postId)
  if (!post) {
    const err = new Error('文章不存在')
    err.statusCode = 404
    return next(err)
  }
  const comment = {
    id: store.nextId.comments++,
    ...req.body,
    createdAt: new Date().toISOString(),
  }
  store.comments.push(comment)
  res.status(201).json({ success: true, data: comment })
})
```

### 练习二要点

```js
router.get('/:id', (req, res, next) => {
  const post = store.posts.find(p => p.id === Number(req.params.id))
  if (!post) { /* 404 */ }

  const author = store.users.find(u => u.id === post.authorId)
  const comments = store.comments.filter(c => c.postId === post.id)

  res.json({
    success: true,
    data: { ...post, author, comments },
  })
})
```

### 练习三要点

```js
// src/utils/respond.js
function respond(res, data, message = '操作成功', statusCode = 200) {
  res.status(statusCode).json({ success: true, data, message })
}
```
