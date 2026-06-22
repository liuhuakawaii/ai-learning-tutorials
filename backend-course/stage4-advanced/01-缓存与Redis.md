# 第四阶段 · 第1课：缓存与 Redis

## 场景引入

你的博客平台有一篇热门文章被推荐到了首页，瞬间涌入 10000 个并发请求。每个请求都要查数据库获取文章内容，数据库连接池瞬间被打满，响应时间从 50ms 飙升到 5 秒，大量请求超时返回 500 错误。你发现，这 10000 个请求查的都是同一篇文章——数据库返回的内容完全一样，却被重复查询了 10000 次。这就是缓存要解决的核心问题：把频繁访问的数据放在更快的存储中，避免重复查询数据库。Redis 作为最流行的内存数据库，能在 1-5ms 内返回数据，是后端性能优化的必备武器。本课将教你用 Redis 实现缓存、限流和 Session 存储。

## 学习目标

完成本课学习后，你将能够：

1. 理解缓存的核心概念和常见策略
2. 掌握 Redis 的基本数据类型和使用场景
3. 使用 ioredis 在 Node.js 中操作 Redis
4. 为博客 API 实现文章缓存和 API 限流
5. 了解缓存穿透、雪崩、击穿问题及其解决方案

---

## 一、什么是缓存？

### 1.1 生活类比：图书馆的热门书架 vs 书库

想象你走进图书馆，想借一本畅销书。

```
┌─────────────────────────────────────────────────────┐
│                    图书馆布局                         │
│                                                      │
│  ┌──────────────┐          ┌──────────────────────┐  │
│  │  热门书架     │          │      书库             │  │
│  │  (缓存)       │          │      (数据库)         │  │
│  │              │          │                      │  │
│  │  · 最近热门   │  找不到   │  · 所有书籍           │  │
│  │  · 快速取阅   │ ───────► │  · 需要检索           │  │
│  │  · 空间有限   │          │  · 速度较慢           │  │
│  └──────────────┘          └──────────────────────┘  │
│                                                      │
│  速度快 ✓    空间小 ✗        速度慢 ✗    空间大 ✓     │
└─────────────────────────────────────────────────────┘
```

**缓存（Cache）** 就是把**频繁访问的数据**存放在**快速但昂贵的存储**中，避免每次都去访问**慢速但廉价的存储**。

在 Web 后端中：
- **书库** = 数据库（MySQL/PostgreSQL），容量大但查询慢
- **热门书架** = 缓存（Redis），速度快但容量小且成本高

### 1.2 为什么需要缓存？

```
没有缓存时：
浏览器 ──► 服务器 ──► 数据库（查询 50ms）──► 服务器 ──► 浏览器
                                    总耗时：~60ms

有缓存时：
浏览器 ──► 服务器 ──► Redis（查询 1ms）──► 服务器 ──► 浏览器
                                总耗时：~10ms
```

**核心原因：**

| 问题 | 说明 |
|------|------|
| 数据库查询慢 | 复杂查询可能需要 50-500ms，Redis 只需 1-5ms |
| 重复查询浪费资源 | 同一篇文章被 1000 人访问，不需要查 1000 次数据库 |
| 高并发压力 | 热门文章瞬间 1 万个请求，数据库扛不住 |

### 1.3 哪些数据适合缓存？

```
适合缓存：                    不适合缓存：
┌─────────────────────┐      ┌─────────────────────┐
│ · 读多写少的数据       │      │ · 频繁修改的数据       │
│ · 热门文章列表         │      │ · 用户的实时位置       │
│ · 用户信息             │      │ · 库存数量（需精确）    │
│ · 配置数据             │      │ · 涉及金钱的数据       │
│ · 计算结果             │      │ · 一次性数据           │
└─────────────────────┘      └─────────────────────┘
```

---

## 二、缓存策略

### 2.1 Cache-Aside（旁路缓存）—— 最常用

```
读取流程：
┌──────────┐    1.查缓存     ┌─────────┐
│ 应用程序  │ ──────────────►│  Redis   │
│          │                │  (缓存)  │
│          │◄────────────── │         │
│          │  2a.有数据直接返回│         │
│          │                └─────────┘
│          │    3.查数据库     ┌─────────┐
│          │ ──────────────►│  数据库   │
│          │                │         │
│          │◄────────────── │         │
│          │  4.返回数据      └─────────┘
│          │
│          │    5.写入缓存     ┌─────────┐
│          │ ──────────────►│  Redis   │
└──────────┘                └─────────┘

写入流程：
┌──────────┐    1.更新数据库   ┌─────────┐
│ 应用程序  │ ──────────────►│  数据库   │
│          │                └─────────┘
│          │    2.删除缓存     ┌─────────┐
│          │ ──────────────►│  Redis   │
└──────────┘                └─────────┘
```

**生活类比：** 你去图书馆找书，先看热门书架（缓存），找到了直接拿走；没找到再去书库（数据库），找到后顺便在热门书架放一本副本。还书时（写入），把热门书架上的副本拿掉。

**代码示例：**

```typescript
// Cache-Aside 模式示例
async function getPostById(id: number): Promise<Post | null> {
  // 1. 先查缓存
  const cached = await redis.get(`post:${id}`);
  if (cached) {
    console.log('命中缓存');
    return JSON.parse(cached);
  }

  // 2. 缓存未命中，查数据库
  console.log('缓存未命中，查询数据库');
  const post = await prisma.post.findUnique({ where: { id } });

  // 3. 查询结果写入缓存，设置过期时间
  if (post) {
    await redis.set(`post:${id}`, JSON.stringify(post), 'EX', 3600); // 1小时过期
  }

  return post;
}
```

### 2.2 Write-Through（写穿透）

```
写入流程：
┌──────────┐    1.写入缓存     ┌─────────┐
│ 应用程序  │ ──────────────►│  Redis   │
│          │                └─────────┘
│          │    2.同步写入数据库 ┌─────────┐
│          │ ──────────────►│  数据库   │
└──────────┘                └─────────┘
```

**生活类比：** 你在热门书架放了一本新书，同时也会更新书库的目录，两边保持同步。

**优点：** 数据一致性好，缓存和数据库始终同步。
**缺点：** 写入延迟增加（每次写操作要做两件事）。

### 2.3 Write-Behind（写回/异步写穿透）

```
写入流程：
┌──────────┐    1.写入缓存     ┌─────────┐
│ 应用程序  │ ──────────────►│  Redis   │
└──────────┘                └────┬────┘
                                 │
                           2.异步批量写入（稍后）
                                 │
                                 ▼
                           ┌─────────┐
                           │  数据库   │
                           └─────────┘
```

**生活类比：** 你先在热门书架更新了书，然后安排图书管理员"有空的时候"去更新书库目录。

**优点：** 写入速度极快，可批量写入减少数据库压力。
**缺点：** 数据可能丢失（缓存故障时还没写入数据库的数据会丢失）。

### 2.4 三种策略对比

| 策略 | 一致性 | 写入速度 | 复杂度 | 适用场景 |
|------|--------|---------|--------|---------|
| Cache-Aside | 一般 | 中等 | 低 | 最通用，读多写少 |
| Write-Through | 高 | 较慢 | 中等 | 要求强一致性 |
| Write-Behind | 低 | 极快 | 高 | 写入量大、可容忍少量丢失 |

---

## 三、Redis 简介

### 3.1 什么是 Redis？

**Redis（Remote Dictionary Server）** 是一个开源的**内存数据库**，常用作**缓存、消息队列、会话存储**。

```
为什么 Redis 是缓存首选？

┌──────────────────────────────────────────────────┐
│                    Redis 特性                      │
│                                                   │
│  ⚡ 极速    ──  数据存在内存中，读写 < 1ms          │
│  📦 多类型  ──  不只是 Key-Value，支持丰富数据结构   │
│  💾 持久化  ──  可以把内存数据保存到磁盘             │
│  🔀 高可用  ──  支持主从复制、集群模式               │
│  📊 原子性  ──  操作是原子的，天然支持并发            │
└──────────────────────────────────────────────────┘
```

### 3.2 安装 Redis

**Windows（使用 Docker）：**

```bash
# 拉取并运行 Redis 容器
docker run -d --name redis -p 6379:6379 redis:latest

# 验证是否运行
docker exec -it redis redis-cli ping
# 输出 PONG 表示成功
```

**Mac（使用 Homebrew）：**

```bash
# 安装
brew install redis

# 启动服务
brew services start redis

# 验证
redis-cli ping
# 输出 PONG
```

**Linux（Ubuntu）：**

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
redis-cli ping
```

### 3.3 Redis 数据类型

Redis 支持 5 种核心数据类型，就像 JavaScript 有不同的数据结构：

```
Redis 数据类型              类比 JavaScript
┌──────────────────┐      ┌──────────────────┐
│ String (字符串)    │  ◄──►│ string / number   │
│ Hash   (哈希)     │  ◄──►│ object {}         │
│ List   (列表)     │  ◄──►│ array []          │
│ Set    (集合)     │  ◄──►│ Set (无序、不重复)  │
│ Sorted Set(有序集)│  ◄──►│ 按分数排序的 Set    │
└──────────────────┘      └──────────────────┘
```

#### String（字符串）—— 最基础的类型

```redis
# 存储文章阅读量
SET post:1:views 1000

# 自增（原子操作，天然支持并发！）
INCR post:1:views          # 1001
INCRBY post:1:views 5      # 1006

# 设置过期时间（秒）
SET session:abc123 "user_data" EX 1800  # 30分钟后过期

# 获取值
GET post:1:views
```

**使用场景：** 缓存字符串/JSON、计数器、Session 存储、分布式锁

#### Hash（哈希）—— 存储对象

```redis
# 存储用户信息（类似 JavaScript 对象）
HSET user:1 name "张三" email "zhangsan@example.com" avatar "/img/1.jpg"

# 获取单个字段
HGET user:1 name          # "张三"

# 获取所有字段
HGETALL user:1

# 更新单个字段
HSET user:1 name "李四"

# 删除字段
HDEL user:1 email
```

**使用场景：** 缓存用户信息、文章详情、配置对象

#### List（列表）—— 有序队列

```redis
# 最新文章列表（从左边推入）
LPUSH posts:latest "文章1" "文章2" "文章3"

# 获取列表（0 到 4 表示前5条）
LRANGE posts:latest 0 4

# 从右边弹出（FIFO 队列）
RPOP posts:latest

# 限制列表长度（只保留最新100条）
LTRIM posts:latest 0 99
```

**使用场景：** 最新消息列表、任务队列、最新动态

#### Set（集合）—— 无序不重复

```redis
# 文章标签
SADD post:1:tags "JavaScript" "TypeScript" "Node.js"

# 获取所有标签
SMEMBERS post:1:tags

# 判断是否包含某标签
SISMEMBER post:1:tags "JavaScript"   # 1 (存在)

# 集合运算（交集、并集、差集）
SINTER user:1:likes user:2:likes     # 两人都点赞的文章
```

**使用场景：** 标签、点赞用户列表、共同好友

#### Sorted Set（有序集合）—— 带分数排序

```redis
# 热门文章排行（分数 = 阅读量）
ZADD posts:ranking 15000 "文章1" 12000 "文章2" 8000 "文章3"

# 获取前3名（从高到低）
ZREVRANGE posts:ranking 0 2 WITHSCORES

# 增加分数
ZINCRBY posts:ranking 100 "文章2"

# 获取排名
ZRANK posts:ranking "文章2"
```

**使用场景：** 排行榜、延时队列、带权重的优先级队列

---

## 四、ioredis 库使用

### 4.1 安装

```bash
npm install ioredis
npm install -D @types/ioredis  # TypeScript 类型定义
```

### 4.2 基础连接

```typescript
// src/lib/redis.ts
import Redis from 'ioredis';

// 创建 Redis 客户端
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  // 如果设置了密码
  // password: 'your-password',
  db: 0,  // 使用第 0 个数据库（Redis 默认有 16 个数据库）

  // 连接超时
  connectTimeout: 10000,

  // 重试策略
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000); // 指数退避，最大2秒
    return delay;
  },
});

// 连接事件
redis.on('connect', () => {
  console.log('✅ Redis 连接成功');
});

redis.on('error', (err) => {
  console.error('❌ Redis 连接错误:', err.message);
});

export default redis;
```

### 4.3 基本操作封装

```typescript
// src/lib/cache.ts
import redis from './redis';

/**
 * 缓存工具类
 * 封装常用的缓存操作，方便复用
 */
export const cache = {
  /**
   * 获取缓存
   * @param key 缓存键
   * @returns 解析后的数据，未命中返回 null
   */
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    if (!data) return null;

    try {
      return JSON.parse(data) as T;
    } catch {
      // 如果不是 JSON 格式，直接返回字符串
      return data as unknown as T;
    }
  },

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值（会自动序列化为 JSON）
   * @param ttl 过期时间（秒），不传则永不过期
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (ttl) {
      await redis.set(key, serialized, 'EX', ttl);
    } else {
      await redis.set(key, serialized);
    }
  },

  /**
   * 删除缓存
   * @param key 缓存键（支持多个）
   */
  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },

  /**
   * 删除匹配模式的缓存
   * ⚠️ 生产环境慎用，SCAN 在大量 key 时可能影响性能
   * @param pattern 匹配模式，如 "post:*"
   */
  async delPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor, 'MATCH', pattern, 'COUNT', 100
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  },

  /**
   * 检查 key 是否存在
   */
  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key);
    return result === 1;
  },

  /**
   * 设置过期时间
   */
  async expire(key: string, ttl: number): Promise<void> {
    await redis.expire(key, ttl);
  },
};
```

---

## 五、缓存实现

### 5.1 文章列表缓存

```typescript
// src/services/post.service.ts
import { PrismaClient } from '@prisma/client';
import { cache } from '../lib/cache';

const prisma = new PrismaClient();

// 缓存键常量（集中管理，避免拼写错误）
const CACHE_KEYS = {
  POST_LIST: (page: number, limit: number) => `posts:list:${page}:${limit}`,
  POST_DETAIL: (id: number) => `post:${id}`,
  POSTS_HOT: 'posts:hot',
  POST_COUNT: 'posts:count',
} as const;

// 缓存过期时间（秒）
const CACHE_TTL = {
  POST_LIST: 300,    // 文章列表缓存 5 分钟
  POST_DETAIL: 600,  // 文章详情缓存 10 分钟
  POSTS_HOT: 120,    // 热门文章缓存 2 分钟
} as const;

interface PostListParams {
  page: number;
  limit: number;
  tag?: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 获取文章列表（带缓存）
 *
 * 缓存策略：Cache-Aside
 * 1. 先查缓存
 * 2. 缓存未命中则查数据库
 * 3. 将结果写入缓存
 */
export async function getPostList(params: PostListParams): Promise<{
  posts: Post[];
  total: number;
}> {
  const { page, limit, tag } = params;
  const cacheKey = tag
    ? `${CACHE_KEYS.POST_LIST(page, limit)}:tag:${tag}`
    : CACHE_KEYS.POST_LIST(page, limit);

  // 1. 先查缓存
  const cached = await cache.get<{ posts: Post[]; total: number }>(cacheKey);
  if (cached) {
    console.log(`✅ 缓存命中: ${cacheKey}`);
    return cached;
  }

  // 2. 缓存未命中，查询数据库
  console.log(`❌ 缓存未命中: ${cacheKey}，查询数据库`);
  const skip = (page - 1) * limit;

  const where = tag ? { tags: { some: { name: tag } } } : {};

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, name: true, avatar: true } } },
    }),
    prisma.post.count({ where }),
  ]);

  const result = { posts, total };

  // 3. 写入缓存
  await cache.set(cacheKey, result, CACHE_TTL.POST_LIST);

  return result;
}
```

### 5.2 文章详情缓存

```typescript
/**
 * 获取文章详情（带缓存 + 阅读量计数）
 */
export async function getPostDetail(id: number): Promise<Post | null> {
  const cacheKey = CACHE_KEYS.POST_DETAIL(id);

  // 1. 查缓存
  const cached = await cache.get<Post>(cacheKey);
  if (cached) {
    console.log(`✅ 文章详情缓存命中: ${cacheKey}`);

    // 阅读量用 Redis INCR（原子操作，高并发安全）
    await redis.incr(`post:${id}:views`);

    return cached;
  }

  // 2. 查数据库
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      tags: true,
      _count: { select: { comments: true } },
    },
  });

  if (!post) return null;

  // 3. 写入缓存
  await cache.set(cacheKey, post, CACHE_TTL.POST_DETAIL);

  return post;
}
```

### 5.3 缓存失效策略

```typescript
/**
 * 更新文章时清除相关缓存
 *
 * 关键点：更新数据库后，要清除对应的缓存
 * 否则用户会看到旧数据
 */
export async function updatePost(
  id: number,
  data: Partial<{ title: string; content: string }>
): Promise<Post> {
  // 1. 更新数据库
  const updatedPost = await prisma.post.update({
    where: { id },
    data,
  });

  // 2. 清除该文章的缓存
  await cache.del(CACHE_KEYS.POST_DETAIL(id));

  // 3. 清除文章列表缓存（因为列表中的摘要也可能变了）
  await cache.delPattern('posts:list:*');

  // 4. 清除热门文章缓存（如果排序字段变了）
  await cache.del(CACHE_KEYS.POSTS_HOT);

  console.log(`🗑️ 已清除文章 ${id} 相关缓存`);

  return updatedPost;
}

/**
 * 删除文章时清除缓存
 */
export async function deletePost(id: number): Promise<void> {
  // 1. 删除数据库记录
  await prisma.post.delete({ where: { id } });

  // 2. 清除所有相关缓存
  await Promise.all([
    cache.del(CACHE_KEYS.POST_DETAIL(id)),
    cache.del(CACHE_KEYS.POST_COUNT),
    cache.delPattern('posts:list:*'),
    cache.delPattern('posts:hot'),
  ]);

  console.log(`🗑️ 已删除文章 ${id} 并清除所有相关缓存`);
}
```

### 5.4 缓存三大问题

#### 缓存穿透（Cache Penetration）

```
问题描述：
客户端故意请求不存在的数据，缓存永远未命中，每次都打到数据库

┌──────────┐  请求 id=-1 的文章  ┌─────────┐
│ 恶意请求  │ ─────────────────►│  Redis   │
│          │                    │  未命中   │
│          │◄───────────────────│         │
│          │                    └─────────┘
│          │  继续查询           ┌─────────┐
│          │ ─────────────────►│  数据库   │
│          │                    │  也不存在  │  ← 每次都打到数据库！
└──────────┘                    └─────────┘
```

**解决方案：**

```typescript
/**
 * 方案1：缓存空值
 * 如果数据库中没有这个数据，也在缓存中存一个 null
 */
export async function getPostWithNullCache(id: number): Promise<Post | null> {
  const cacheKey = CACHE_KEYS.POST_DETAIL(id);

  // 先查缓存（注意：null 也是有效缓存）
  const cached = await redis.get(cacheKey);
  if (cached !== null) {
    return cached === 'NULL' ? null : JSON.parse(cached);
  }

  // 查数据库
  const post = await prisma.post.findUnique({ where: { id } });

  if (post) {
    await cache.set(cacheKey, post, CACHE_TTL.POST_DETAIL);
  } else {
    // 关键：缓存空值，设置较短的过期时间
    await redis.set(cacheKey, 'NULL', 'EX', 60); // 60秒后过期
  }

  return post;
}

/**
 * 方案2：布隆过滤器（Bloom Filter）
 * 预先判断 key 是否可能存在，不存在则直接返回
 *
 * 需要安装：npm install bloom-filters
 * 简单示意，生产环境可用 Redis Bloom 模块
 */
```

#### 缓存雪崩（Cache Avalanche）

```
问题描述：
大量缓存同时过期，瞬间所有请求涌向数据库

时间线：
t=0s    所有缓存同时设置 TTL=3600s
t=3600s 所有缓存同时过期！
        ↓
        10000个请求同时打到数据库 → 数据库崩溃
```

**解决方案：**

```typescript
/**
 * 雪崩解决方案：给 TTL 加上随机偏移量
 * 让缓存不在同一时刻全部过期
 */
function getRandomTTL(baseTTL: number): number {
  // 在基础 TTL 上加 0~10% 的随机时间
  const randomOffset = Math.floor(baseTTL * 0.1 * Math.random());
  return baseTTL + randomOffset;
}

// 使用示例
await cache.set(key, data, getRandomTTL(3600));
// 实际 TTL 可能是 3600~3960 秒，错开过期时间
```

#### 缓存击穿（Cache Breakdown / Hotspot Invalidaton）

```
问题描述：
某个热点 key 过期瞬间，大量并发请求同时去查数据库

t=0s    热门文章缓存过期
t=0.001s  请求1 → 缓存未命中 → 查数据库
t=0.001s  请求2 → 缓存未命中 → 查数据库  ← 同时来了100个请求！
t=0.001s  请求3 → 缓存未命中 → 查数据库
        ...
        数据库瞬间承受 100 次相同查询
```

**解决方案：分布式锁**

```typescript
import Redis from 'ioredis';

const redis = new Redis();

/**
 * 使用分布式锁防止缓存击穿
 * 同一时刻只有一个请求去查数据库，其他请求等待
 */
export async function getPostWithLock(id: number): Promise<Post | null> {
  const cacheKey = CACHE_KEYS.POST_DETAIL(id);
  const lockKey = `lock:${cacheKey}`;

  // 1. 先查缓存
  const cached = await cache.get<Post>(cacheKey);
  if (cached) return cached;

  // 2. 尝试获取锁
  const locked = await redis.set(lockKey, '1', 'EX', 10, 'NX');
  // NX = 仅当 key 不存在时设置（原子操作）

  if (!locked) {
    // 没拿到锁，说明其他请求正在查数据库，等待后重试
    console.log('⏳ 等待其他请求完成...');
    await new Promise(resolve => setTimeout(resolve, 100));
    return getPostWithLock(id); // 递归重试
  }

  try {
    // 3. 拿到锁，再次检查缓存（可能别的请求已经写入了）
    const cachedAgain = await cache.get<Post>(cacheKey);
    if (cachedAgain) return cachedAgain;

    // 4. 查数据库
    const post = await prisma.post.findUnique({ where: { id } });

    // 5. 写入缓存
    if (post) {
      await cache.set(cacheKey, post, getRandomTTL(CACHE_TTL.POST_DETAIL));
    }

    return post;
  } finally {
    // 6. 释放锁（一定要在 finally 中，确保异常时也能释放）
    await redis.del(lockKey);
  }
}
```

---

## 六、限流器（Rate Limiter）

### 6.1 为什么需要限流？

```
无限流时：
恶意脚本每秒发送 1000 个请求
┌──────┐  ┌──────┐  ┌──────┐
│ 请求1 │  │ 请求2 │  │ ...  │  × 1000/秒
└──┬───┘  └──┬───┘  └──┬───┘
   └─────────┼─────────┘
             ▼
        ┌─────────┐
        │  服务器   │  ← 被打崩
        └─────────┘

有限流时：
恶意脚本第 101 个请求被拒绝
┌──────┐
│ 请求101│
└──┬───┘
   ▼
┌─────────────┐
│  限流器       │  "你已经请求太多次了，请稍后再试"
│  (429 Too    │
│   Many Req)  │
└─────────────┘
```

### 6.2 用 Redis 实现滑动窗口限流器

```typescript
// src/middleware/rate-limiter.ts
import { Request, Response, NextFunction } from 'express';
import redis from '../lib/redis';

interface RateLimiterOptions {
  windowMs: number;     // 时间窗口（毫秒）
  maxRequests: number;  // 窗口内最大请求数
  keyGenerator?: (req: Request) => string; // 自定义限流键
  message?: string;     // 超限提示信息
}

/**
 * 滑动窗口限流器
 *
 * 原理：用 Redis 的 Sorted Set 存储请求时间戳
 * - score = 时间戳
 * - member = 唯一标识（时间戳 + 随机数）
 * - 每次请求时移除窗口外的旧记录，计算窗口内的请求数
 *
 * 类比：电影院售票窗口
 * - 每小时只卖 100 张票
 * - 每卖出一张，记录时间
 * - 新顾客来时，检查过去一小时卖了多少张
 * - 超过 100 张就让顾客等下一个小时
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req: Request) => req.ip || 'unknown',
    message = '请求过于频繁，请稍后再试',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `ratelimit:${keyGenerator(req)}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // 使用 Redis 事务（MULTI/EXEC）保证原子性
    const pipeline = redis.pipeline();

    // 1. 移除窗口之外的旧记录
    pipeline.zremrangebyscore(key, 0, windowStart);

    // 2. 添加当前请求
    pipeline.zadd(key, now, `${now}:${Math.random()}`);

    // 3. 统计窗口内的请求数
    pipeline.zcard(key);

    // 4. 设置 key 的过期时间（自动清理）
    pipeline.expire(key, Math.ceil(windowMs / 1000));

    const results = await pipeline.exec();

    // 获取请求数（第3个命令的结果）
    const requestCount = results?.[2]?.[1] as number;

    // 设置响应头（告知客户端限流状态）
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - requestCount).toString(),
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString(),
    });

    if (requestCount > maxRequests) {
      // 超过限制，返回 429
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
      return;
    }

    next();
  };
}

// 预定义的限流策略
export const rateLimiters = {
  // 通用 API：每分钟 60 次
  api: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 60,
    message: 'API 请求过于频繁，请稍后再试',
  }),

  // 登录接口：每分钟 5 次（防暴力破解）
  login: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 5,
    keyGenerator: (req: Request) => `login:${req.body.email || req.ip}`,
    message: '登录尝试次数过多，请 1 分钟后再试',
  }),

  // 注册接口：每小时 3 次
  register: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    message: '注册过于频繁，请稍后再试',
  }),

  // 发文章：每小时 10 篇
  createPost: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    message: '发文过于频繁，请稍后再试',
  }),
};
```

### 6.3 在 Express 中使用限流器

```typescript
// src/app.ts
import express from 'express';
import { rateLimiters } from './middleware/rate-limiter';

const app = express();

// 全局 API 限流
app.use('/api', rateLimiters.api);

// 特定路由的限流
app.post('/api/auth/login', rateLimiters.login, authController.login);
app.post('/api/auth/register', rateLimiters.register, authController.register);
app.post('/api/posts', rateLimiters.createPost, postController.create);
```

---

## 七、Session 存储

### 7.1 为什么用 Redis 存 Session？

```
默认 Session 存储（内存）的问题：

┌─────────────────────────────────────────────────┐
│  服务器 A          服务器 B          服务器 C     │
│  Session: user1   Session: user2   Session: user3│
│                                                  │
│  用户第一次请求 → 服务器 A → 存了 Session         │
│  用户第二次请求 → 服务器 B → 找不到 Session!       │
│                                                  │
│  原因：Session 存在各服务器自己的内存中，不共享    │
└─────────────────────────────────────────────────┘

解决方案：把 Session 存到 Redis

┌─────────────────────────────────────────────────┐
│  服务器 A ──┐                                    │
│  服务器 B ──┼──► Redis（Session 共享存储）        │
│  服务器 C ──┘                                    │
│                                                  │
│  无论请求到哪台服务器，Session 都能找到！          │
└─────────────────────────────────────────────────┘
```

### 7.2 实现 Redis Session 存储

```bash
npm install express-session connect-redis
```

```typescript
// src/lib/session.ts
import session from 'express-session';
import RedisStore from 'connect-redis';
import redis from './redis';

// 创建 Redis Session Store
const redisStore = new RedisStore({
  client: redis,
  prefix: 'sess:',           // Session key 前缀
  ttl: 86400,                // Session 过期时间（秒），24小时
});

export const sessionMiddleware = session({
  store: redisStore,          // 使用 Redis 存储
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,              // 即使 Session 没变化也不重新保存
  saveUninitialized: false,   // 不保存未初始化的 Session
  cookie: {
    secure: process.env.NODE_ENV === 'production',    // 生产环境强制 HTTPS
    httpOnly: true,          // 禁止 JS 读取 Cookie
    maxAge: 24 * 60 * 60 * 1000, // Cookie 过期时间：24小时
    sameSite: 'lax',         // 防 CSRF
  },
  name: 'blog.sid',          // Cookie 名称（不要用默认的 connect.sid）
});

// 在 app 中使用
// app.use(sessionMiddleware);
```

---

## 八、完整实战示例

### 8.1 项目结构

```
blog-api/
├── src/
│   ├── lib/
│   │   ├── redis.ts          # Redis 连接
│   │   └── cache.ts          # 缓存工具类
│   ├── middleware/
│   │   ├── rate-limiter.ts   # 限流器
│   │   └── session.ts        # Session 中间件
│   ├── services/
│   │   └── post.service.ts   # 文章服务（带缓存）
│   ├── routes/
│   │   ├── post.routes.ts    # 文章路由
│   │   └── auth.routes.ts    # 认证路由
│   └── app.ts                # 应用入口
├── package.json
└── tsconfig.json
```

### 8.2 文章路由（完整示例）

```typescript
// src/routes/post.routes.ts
import { Router, Request, Response } from 'express';
import { cache } from '../lib/cache';
import redis from '../lib/redis';
import { PrismaClient } from '@prisma/client';
import { rateLimiters } from '../middleware/rate-limiter';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// 缓存键和 TTL 常量
const CACHE_KEYS = {
  POST_LIST: (page: number, limit: number) => `posts:list:${page}:${limit}`,
  POST_DETAIL: (id: number) => `post:${id}`,
  POSTS_HOT: 'posts:hot',
} as const;

const CACHE_TTL = {
  POST_LIST: 300,
  POST_DETAIL: 600,
  HOT_POSTS: 120,
};

/**
 * GET /api/posts
 * 获取文章列表（带缓存 + 分页）
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const cacheKey = CACHE_KEYS.POST_LIST(page, limit);

    // 1. 查缓存
    const cached = await cache.get<{ posts: any[]; total: number; page: number; limit: number }>(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    // 2. 查数据库
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          tags: true,
          _count: { select: { comments: true, likes: true } },
        },
      }),
      prisma.post.count(),
    ]);

    const result = { posts, total, page, limit };

    // 3. 写入缓存
    await cache.set(cacheKey, result, CACHE_TTL.POST_LIST);

    res.set('X-Cache', 'MISS');
    res.json(result);
  } catch (error) {
    console.error('获取文章列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * GET /api/posts/:id
 * 获取文章详情（带缓存 + 阅读量计数）
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const cacheKey = CACHE_KEYS.POST_DETAIL(id);

    // 查缓存
    const cached = await cache.get(cacheKey);
    if (cached) {
      // 阅读量用 Redis 原子递增（高并发安全）
      await redis.incr(`post:${id}:views`);
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    // 查数据库
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        tags: true,
        comments: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
        _count: { select: { comments: true, likes: true } },
      },
    });

    if (!post) {
      return res.status(404).json({ error: '文章不存在' });
    }

    // 写入缓存
    await cache.set(cacheKey, post, CACHE_TTL.POST_DETAIL);
    await redis.incr(`post:${id}:views`);

    res.set('X-Cache', 'MISS');
    res.json(post);
  } catch (error) {
    console.error('获取文章详情失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * PUT /api/posts/:id
 * 更新文章（更新后清除缓存）
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { title, content, tags } = req.body;

    // 更新数据库
    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        title,
        content,
        tags: tags ? { set: tags.map((name: string) => ({ name })) } : undefined,
      },
      include: { author: { select: { id: true, name: true } }, tags: true },
    });

    // 清除相关缓存
    await Promise.all([
      cache.del(CACHE_KEYS.POST_DETAIL(id)),
      cache.delPattern('posts:list:*'),
    ]);

    res.json(updatedPost);
  } catch (error) {
    console.error('更新文章失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * GET /api/posts/hot/ranking
 * 热门文章排行（使用 Redis Sorted Set）
 */
router.get('/hot/ranking', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const cacheKey = CACHE_KEYS.POSTS_HOT;

    // 查缓存
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // 从 Redis Sorted Set 获取阅读量前 N 的文章 ID
    const hotPostIds = await redis.zrevrange('posts:ranking', 0, limit - 1);

    if (hotPostIds.length === 0) {
      return res.json([]);
    }

    // 根据 ID 查询文章详情
    const hotPosts = await prisma.post.findMany({
      where: { id: { in: hotPostIds.map(Number) } },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        _count: { select: { comments: true, likes: true } },
      },
    });

    // 按阅读量排序
    const sortedPosts = hotPostIds
      .map(id => hotPosts.find(p => p.id === Number(id)))
      .filter(Boolean);

    await cache.set(cacheKey, sortedPosts, CACHE_TTL.HOT_POSTS);

    res.json(sortedPosts);
  } catch (error) {
    console.error('获取热门文章失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
```

### 8.3 应用入口（完整）

```typescript
// src/app.ts
import express from 'express';
import cors from 'cors';
import { sessionMiddleware } from './lib/session';
import { rateLimiters } from './middleware/rate-limiter';
import postRoutes from './routes/post.routes';
import authRoutes from './routes/auth.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// 基础中间件
app.use(cors());
app.use(express.json());

// Session 中间件
app.use(sessionMiddleware);

// 全局限流
app.use('/api', rateLimiters.api);

// 路由
app.use('/api/posts', postRoutes);
app.use('/api/auth', authRoutes);

// 健康检查（不需要缓存和限流）
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`🚀 博客 API 已启动: http://localhost:${PORT}`);
  console.log(`📝 文章接口: http://localhost:${PORT}/api/posts`);
});

export default app;
```

---

## 九、动手练习

### 练习 1：基础缓存

为博客 API 的用户信息接口添加缓存：

```typescript
// TODO: 实现以下功能
// 1. GET /api/users/:id - 获取用户信息（带缓存，TTL 10分钟）
// 2. PUT /api/users/:id - 更新用户信息（更新后清除缓存）
// 3. GET /api/users/:id/posts - 获取用户文章列表（带缓存，TTL 5分钟）

// 提示：
// - 使用前面封装的 cache 工具类
// - 缓存键格式：user:{id}, user:{id}:posts
// - 更新用户信息后要清除所有相关缓存
```

### 练习 2：API 限流

为不同的接口配置不同的限流策略：

```typescript
// TODO: 实现以下限流规则
// 1. GET /api/posts - 每分钟 100 次
// 2. POST /api/posts/:id/comments - 每分钟 10 次（防刷评论）
// 3. POST /api/auth/forgot-password - 每小时 3 次（防滥用密码重置）
// 4. 全局 - 每个 IP 每小时 1000 次

// 提示：
// - 使用 createRateLimiter 函数
// - 注意 keyGenerator 的设计
// - 考虑是否需要区分登录用户和匿名用户
```

### 练习 3：阅读量统计

实现一个异步的阅读量统计系统：

```typescript
// TODO: 实现以下功能
// 1. 用户访问文章时，用 Redis INCR 增加阅读量
// 2. 每 5 分钟将 Redis 中的阅读量同步到数据库
// 3. 同步后重置 Redis 计数器
// 4. 提供 GET /api/posts/:id/views 接口返回总阅读量

// 提示：
// - 使用 setInterval 实现定时同步
// - Redis 计数键：post:{id}:views:delta（增量）
// - GETDECR 或 GETSET 命令获取并重置
```

---

## 常见误区

1. **缓存所有数据**：把数据库里的每条记录都塞进缓存，导致 Redis 内存爆满。缓存只适合"读多写少"的热点数据，频繁修改的数据（如库存、实时位置）不适合缓存。

2. **更新数据后忘记清除缓存**：数据库改了但缓存还是旧的，用户看到的永远是过期数据。这是缓存开发中最常见的 bug，必须养成"更新数据库 → 清除缓存"的习惯。

3. **缓存穿透不处理**：故意请求不存在的数据（如 id=-1），缓存永远未命中，每次都打到数据库。攻击者可以用这个手段轻松打崩数据库。必须用缓存空值或布隆过滤器防御。

4. **所有缓存同时设置相同的 TTL**：导致大量缓存同时过期，瞬间所有请求涌向数据库（缓存雪崩）。应该给 TTL 加上随机偏移量，错开过期时间。

---

## 工程建议

1. **缓存键命名要有规范**：`post:{id}`、`posts:list:{page}:{limit}`、`posts:hot`。集中管理缓存键常量，避免拼写错误导致缓存未命中。

2. **TTL 要根据数据更新频率设置**：文章详情可以缓存 10 分钟，热门文章列表缓存 2 分钟，用户信息缓存 5 分钟。不要一刀切全部设为 1 小时。

3. **用 Redis 做阅读量计数而非直接写数据库**：`INCR post:{id}:views` 是原子操作，天然支持高并发。定时（如每 5 分钟）将增量同步到数据库，避免每次阅读都写数据库。

4. **限流器用滑动窗口而非固定窗口**：固定窗口在窗口交界处可能允许 2 倍的请求量。Redis Sorted Set 实现的滑动窗口限流更精确，且支持按 IP、用户、接口等维度分别限流。

---

## 小结

本课我们学习了：

1. **缓存的本质**：用快速存储（Redis）缓存慢速存储（数据库）的热点数据
2. **三种缓存策略**：Cache-Aside（最常用）、Write-Through（强一致）、Write-Behind（高性能）
3. **Redis 数据类型**：String（计数器）、Hash（对象）、List（队列）、Set（标签）、Sorted Set（排行）
4. **缓存三大问题**：穿透（缓存空值/布隆过滤器）、雪崩（随机 TTL）、击穿（分布式锁）
5. **限流器**：用 Redis Sorted Set 实现滑动窗口限流，保护 API 不被滥用
6. **Session 存储**：用 Redis 实现分布式 Session，支持多服务器部署

**核心原则：**
- 缓存读写要快，所以只缓存热点数据
- 更新数据时一定要同步清除缓存
- TTL 是你的安全网，即使忘记清除缓存也会自动过期
- 限流是保护服务器的第一道防线

下一课我们将学习 **WebSocket 实时通信**，让博客平台支持实时通知和即时评论。
