# 缓存与 Redis

你的博客有一篇文章上了首页推荐，瞬间 1 万个请求涌进来，每个都查数据库拿同一篇文章。数据库连接池打满，响应时间从 50ms 飙到 5 秒。

问题很明确：同样的数据被查了 1 万次，数据库白干了 9999 次。缓存就是把第一次查到的结果存到更快的地方，后面 9999 次直接从那里取。

## 为什么是 Redis

```
存储速度对比：

  内存（Redis）  ~1ms     贵，容量小
  SSD 硬盘       ~0.1ms   中等
  数据库查询     ~10-50ms  便宜，容量大

  等等，SSD 比内存快？
  单次读取确实快，但数据库查询不只是读磁盘——
  还有连接开销、SQL 解析、查询优化、结果组装...
  实际延迟远高于纯磁盘读取
```

Redis 是一个内存数据库，数据存在内存里，读写极快。它不是用来替代 PostgreSQL 的，而是作为数据库前面的一层"热数据缓存"。

## 安装和连接

```bash
# Docker 启动 Redis（最简单）
docker run -d --name redis -p 6379:6379 redis:7

# 安装 Node.js 客户端
npm install ioredis
```

```js
// src/lib/redis.js
const Redis = require('ioredis')

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: 3,
})

redis.on('error', (err) => {
  console.error('Redis 连接错误:', err.message)
})

module.exports = redis
```

## 基本操作

Redis 存的是键值对，值有几种类型：

```js
const redis = require('./lib/redis')

// 字符串
await redis.set('user:1:name', '张三')
await redis.get('user:1:name')  // → '张三'

// 带过期时间（秒）
await redis.set('captcha:13800138000', '123456', 'EX', 300)  // 5 分钟后自动删除

// 哈希（适合存对象）
await redis.hset('user:1', { name: '张三', email: 'zhangsan@test.com' })
await redis.hget('user:1', 'name')  // → '张三'
await redis.hgetall('user:1')        // → { name: '张三', email: '...' }

// 删除
await redis.del('user:1:name')

// 检查是否存在
await redis.exists('user:1')  // → 1（存在）
```

## 为博客 API 加缓存

最常见的缓存模式：查数据前先查缓存，缓存没有再查数据库，查到后写入缓存。

```js
// src/repositories/postRepository.js
const prisma = require('../lib/prisma')
const redis = require('../lib/redis')

const CACHE_TTL = 3600  // 缓存 1 小时

const postRepository = {
  async findById(id) {
    const cacheKey = `post:${id}`

    // 先查缓存
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    // 缓存没有，查数据库
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
        comments: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    // 查到了，写入缓存
    if (post) {
      await redis.set(cacheKey, JSON.stringify(post), 'EX', CACHE_TTL)
    }

    return post
  },

  async update(id, data) {
    const post = await prisma.post.update({ where: { id }, data })
    // 数据变了，删掉缓存
    await redis.del(`post:${id}`)
    return post
  },

  async delete(id) {
    await prisma.post.delete({ where: { id } })
    await redis.del(`post:${id}`)
  },
}
```

注意：`update` 和 `delete` 操作后要**删缓存**，否则下次读到的还是旧数据。这叫"缓存失效"策略。

## API 限流

Redis 的另一个常见用途是限流——限制某个 IP 或用户在一段时间内的请求次数。

```js
// src/middleware/rateLimiter.js
const redis = require('../lib/redis')

function createRateLimiter({ windowSec = 60, maxRequests = 100 } = {}) {
  return async (req, res, next) => {
    const key = `ratelimit:${req.ip}`
    const current = await redis.incr(key)

    if (current === 1) {
      await redis.expire(key, windowSec)
    }

    if (current > maxRequests) {
      return res.status(429).json({
        success: false,
        error: `请求过于频繁，${windowSec} 秒后重试`,
      })
    }

    res.set('X-RateLimit-Remaining', maxRequests - current)
    next()
  }
}

module.exports = { createRateLimiter }
```

`redis.incr` 是原子操作——即使 1 万个请求同时到达，计数也不会出错。这比在内存里用变量计数可靠得多。

## 缓存的三个经典问题

### 缓存穿透

请求的数据在数据库里也不存在，缓存永远 miss，每次都打到数据库。

```
攻击者故意请求 id=-1 的文章
  → 缓存没有 → 查数据库 → 数据库也没有
  → 下次还是没有 → 无限循环打数据库
```

解决：缓存空值。

```js
const post = await prisma.post.findUnique({ where: { id } })
if (!post) {
  // 数据库没有，缓存一个空值，60 秒后过期
  await redis.set(cacheKey, 'null', 'EX', 60)
  return null
}
```

### 缓存雪崩

大量缓存同时过期，所有请求一瞬间全打到数据库。

```
1000 个热门文章的缓存都在同一时间设置
  → 1 小时后同时过期
  → 1000 个请求同时查数据库
  → 数据库 CPU 100%
```

解决：过期时间加随机值。

```js
const jitter = Math.floor(Math.random() * 600)  // 0-10 分钟随机
await redis.set(cacheKey, JSON.stringify(post), 'EX', CACHE_TTL + jitter)
```

### 缓存击穿

某个热点 key（比如首页推荐文章）突然过期，大量请求同时查数据库。

解决：用分布式锁，只让一个请求去查数据库，其他请求等待。

```js
async function getWithLock(key, fetchFn, ttl = 3600) {
  const cached = await redis.get(key)
  if (cached && cached !== 'null') return JSON.parse(cached)
  if (cached === 'null') return null

  const lockKey = `lock:${key}`
  const locked = await redis.set(lockKey, '1', 'EX', 10, 'NX')

  if (!locked) {
    // 别人在查了，等一下再重试
    await new Promise(r => setTimeout(r, 100))
    return getWithLock(key, fetchFn, ttl)
  }

  try {
    const data = await fetchFn()
    if (data) {
      await redis.set(key, JSON.stringify(data), 'EX', ttl)
    } else {
      await redis.set(key, 'null', 'EX', 60)
    }
    return data
  } finally {
    await redis.del(lockKey)
  }
}
```

## 练习

### 练习一：给文章列表加缓存

给 `postRepository.findAll` 加缓存支持。要求：
- 缓存 key 包含筛选参数（`posts:list:published:page1`）
- 创建/更新/删除文章后，清除所有文章列表缓存
- 用 `redis.keys('posts:list:*')` 找到相关缓存并删除

### 练习二：实现访问计数

给文章加浏览量统计：
1. `GET /api/posts/:id` 每次被访问，用 `redis.incr('post:views:{id}')` 计数
2. 不要每次访问都更新数据库——每 100 次或每 5 分钟才同步一次到数据库
3. 返回文章时，返回当前的浏览量（数据库值 + Redis 增量）

### 练习三：实现简单的 Session 存储

用 Redis 替代 JWT，实现 Session 认证：
1. 登录成功后，生成一个随机 session ID，存到 Redis（`session:{id} → {userId, role}`）
2. 返回 session ID 给客户端（放在 Cookie 或自定义 header）
3. 认证中间件从 Redis 查询 session
4. 设置 session 过期时间（2 小时）

## 参考答案

### 练习一要点

```js
async findAll(filters = {}) {
  const cacheKey = `posts:list:${filters.status || 'all'}:${filters.page || 1}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  const result = await prisma.post.findMany({ /* ... */ })
  await redis.set(cacheKey, JSON.stringify(result), 'EX', 300)
  return result
}

async clearListCache() {
  const keys = await redis.keys('posts:list:*')
  if (keys.length > 0) await redis.del(...keys)
}
```

### 练习二要点

```js
// 每次访问 +1
const views = await redis.incr(`post:views:${id}`)

// 每 100 次同步到数据库
if (views % 100 === 0) {
  await prisma.post.update({
    where: { id },
    data: { viewCount: { increment: 100 } },
  })
  await redis.set(`post:views:${id}`, '0')
}
```

### 练习三要点

```js
const { randomUUID } = require('crypto')

// 登录
const sessionId = randomUUID()
await redis.set(`session:${sessionId}`, JSON.stringify({ userId: user.id, role: user.role }), 'EX', 7200)
res.json({ sessionId })

// 认证中间件
const sessionId = req.headers['x-session-id']
const session = await redis.get(`session:${sessionId}`)
if (!session) return res.status(401).json({ error: '会话过期' })
req.user = JSON.parse(session)
```
