# NoSQL 选型：MongoDB、Redis、Elasticsearch 与混合架构

## 场景引入

你在设计一个内容平台，需要处理三种不同类型的数据：用户发布的文章（结构不固定，有的有视频、有的有投票）、用户会话和排行榜（需要毫秒级响应）、全文搜索（用户要能搜索文章内容）。这三种需求用一个关系型数据库勉强能做，但每种都做不好。

这就是 NoSQL 存在的意义——不同的数据模型适合不同的访问模式。选对了，开发效率和性能都会大幅提升；选错了，你会花大量时间在"把方形的钉子塞进圆形的孔"。

## 学习目标

- 理解 MongoDB、Redis、Elasticsearch 三大 NoSQL 的核心数据模型和适用场景
- 掌握 NoSQL 选型的决策框架
- 理解 CAP 定理在实际选型中的应用
- 能够设计多数据库混合架构

## MongoDB：文档数据库

### 数据模型

MongoDB 以 BSON（Binary JSON）文档为基本存储单元，每个文档可以有不同的字段结构，非常适合 schema 频繁变化的业务。

```javascript
// MongoDB 文档示例 - 内容平台文章
{
  _id: ObjectId("64a1b2c3d4e5f6a7b8c9d0e1"),
  title: "如何设计高并发系统",
  author: { name: "张三", avatar: "https://cdn.example.com/avatar.jpg" },
  content: "这是一篇关于...",
  tags: ["架构", "高并发", "系统设计"],
  media: [
    { type: "image", url: "https://cdn.example.com/img1.jpg" },
    { type: "video", url: "https://cdn.example.com/video1.mp4" }
  ],
  stats: { views: 1500, likes: 230, comments: 45 },
  createdAt: ISODate("2024-06-15T10:30:00Z")
}
```

### 聚合管道

MongoDB 的聚合管道类似于 SQL 的 GROUP BY + JOIN，但更灵活。数据在管道中逐阶段流转：

```javascript
// 统计每个作者的文章数和总阅读量
db.articles.aggregate([
  { $match: { createdAt: { $gte: ISODate("2024-01-01") } } },
  { $group: {
      _id: "$author.name",
      articleCount: { $sum: 1 },
      totalViews: { $sum: "$stats.views" }
  }},
  { $sort: { totalViews: -1 } },
  { $limit: 10 }
]);
```

### 分片

当单机存储或性能不够时，MongoDB 通过分片（Sharding）实现水平扩展。分片键的选择直接影响数据分布和查询效率。

```
MongoDB 分片架构：

┌──────────────┐
│ mongos 路由   │  ← 应用连接这里，路由查询到正确分片
└──────┬───────┘
       │
┌──────┼──────────────────────────┐
│      │      Config Server       │
│      │   (存储分片元数据和映射)   │
│      └──────────────────────────│
│                                 │
│  ┌──────────┐  ┌──────────┐  ┌─┴────────┐
│  │ Shard 1  │  │ Shard 2  │  │ Shard 3  │
│  │ RS1(副本集)│ │ RS2(副本集)│ │ RS3(副本集)│
│  └──────────┘  └──────────┘  └──────────┘
```

分片键选择原则：
- **哈希分片**：数据均匀分布，适合等值查询，范围查询效率低
- **范围分片**：保留数据顺序，适合范围查询，可能产生热点
- **复合分片键**：兼顾分布均匀性和查询效率

### 事务支持

MongoDB 4.0+ 支持多文档 ACID 事务，4.2+ 支持分片集群的分布式事务：

```javascript
// MongoDB 多文档事务示例
const session = client.startSession();
session.withTransaction(async () => {
  // 扣减库存
  await db.collection('inventory').updateOne(
    { productId: 'P001', stock: { $gte: 1 } },
    { $inc: { stock: -1 } },
    { session }
  );
  // 创建订单
  await db.collection('orders').insertOne(
    { orderId: 'ORD001', productId: 'P001', amount: 99 },
    { session }
  );
});
```

需要注意：事务会带来性能开销，MongoDB 官方建议优先通过嵌入文档设计避免跨文档事务。

## Redis：内存数据结构

Redis 不仅仅是缓存，它是一个支持多种数据结构的内存数据库。每种数据结构都有独特的使用场景。

### 核心数据结构

```
String  → 缓存、计数器、分布式锁
Hash    → 对象存储（用户信息、配置项）
List    → 消息队列、最新动态
Set     → 标签、共同好友、去重
ZSet    → 排行榜、延迟队列、滑动窗口
```

```python
# 排行榜实现
redis.zadd("leaderboard", {"player:1": 1500, "player:2": 2300, "player:3": 1800})
top_players = redis.zrevrange("leaderboard", 0, 9, withscores=True)

# 分布式锁
redis.set("lock:order:123", "owner_id", nx=True, ex=30)
```

### 持久化

Redis 提供两种持久化方式：RDB（定期快照）和 AOF（追加写日志）。生产环境建议同时开启两者。

```
RDB: 定时生成数据快照，恢复快但可能丢失最近几分钟数据
AOF: 每次写操作都记录日志，数据更安全但文件更大
混合: RDB + AOF，兼顾恢复速度和数据安全
```

### 集群模式

```
单机 → 主从 → Sentinel 哨兵 → Cluster 集群

单机: 开发测试用，无高可用
主从: 数据冗余，但需手动切换
Sentinel: 自动故障转移，但数据仍存在单个节点
Cluster: 数据分片 + 高可用，生产环境推荐
```

Redis Cluster 详细架构：

```
┌─────────────────────────────────────────────────┐
│              Redis Cluster 架构                   │
│                                                  │
│  客户端 ──→ 任意节点 ──→ MOVED 重定向 ──→ 目标节点 │
│                                                  │
│  数据分片：16384 个哈希槽（hash slot）              │
│  Node A: 槽 0-5460      (主) ──→ (从)             │
│  Node B: 槽 5461-10922  (主) ──→ (从)             │
│  Node C: 槽 10923-16383 (主) ──→ (从)             │
│                                                  │
│  故障转移：                                        │
│  1. 节点 A 故障                                    │
│  2. 集群检测到 A 不可达                             │
│  3. A 的从节点提升为主节点                          │
│  4. 整个过程约 15-30 秒                            │
└─────────────────────────────────────────────────┘
```

### 内存优化策略

Redis 内存成本高，需要精细化管理：

```
1. 选择合适的数据结构
   - 存储用户信息：Hash 比 String 节省 3-5 倍内存
   - 存储小对象：Hash 的 ziplist 编码更紧凑
   - 存储计数器：String + INCR 比 Hash 简单高效

2. 设置过期时间
   - 所有缓存数据必须设置 TTL
   - EXPIRE key seconds 或 SET key value EX seconds

3. 内存淘汰策略（maxmemory-policy）
   - allkeys-lru: 所有 key 按 LRU 淘汰（最常用）
   - volatile-lru: 仅淘汰有过期时间的 key
   - allkeys-random: 随机淘汰
   - noeviction: 不淘汰，写入报错（适合不能丢数据的场景）

4. 大 key 检测
   - 使用 redis-cli --bigkeys 扫描大 key
   - 大 key 会阻塞其他操作，应该拆分
```

## Elasticsearch：搜索引擎

### 倒排索引

Elasticsearch 的核心是倒排索引。与关系型数据库的 B+ 树索引不同，倒排索引是"词项 → 文档"的映射，天然适合全文搜索。

```
正排索引：文档 → 包含哪些词
文档1: ["如何", "设计", "高并发", "系统"]
文档2: ["高并发", "场景", "下的", "缓存", "策略"]

倒排索引：词项 → 出现在哪些文档
"高并发" → [文档1, 文档2]
"设计"   → [文档1]
"缓存"   → [文档2]
```

### 分词

中文分词是 Elasticsearch 处理中文搜索的关键。常用插件是 IK Analyzer，支持两种模式：

- `ik_smart`：粗粒度分词，"中华人民共和国" → "中华人民共和国"
- `ik_max_word`：细粒度分词，"中华人民共和国" → "中华人民/华人/人民共和国/共和国"

```json
// 创建索引时指定分词器
{
  "settings": {
    "analysis": {
      "analyzer": { "my_analyzer": { "type": "custom", "tokenizer": "ik_max_word" } }
    }
  },
  "mappings": {
    "properties": {
      "title": { "type": "text", "analyzer": "my_analyzer" },
      "content": { "type": "text", "analyzer": "my_analyzer" }
    }
  }
}
```

### 聚合

Elasticsearch 的聚合功能可以做数据分析，类似 SQL 的 GROUP BY，但支持更复杂的嵌套聚合。

```json
// 聚合示例：按商品类别统计平均价格和销量
{
  "size": 0,
  "aggs": {
    "by_category": {
      "terms": { "field": "category", "size": 20 },
      "aggs": {
        "avg_price": { "avg": { "field": "price" } },
        "total_sales": { "sum": { "field": "sales_count" } },
        "price_ranges": {
          "range": {
            "field": "price",
            "ranges": [
              { "to": 100 },
              { "from": 100, "to": 500 },
              { "from": 500 }
            ]
          }
        }
      }
    }
  }
}
```

### 集群架构

```
Elasticsearch 集群架构：

┌───────────────────────────────────────────────────┐
│  ES Cluster                                       │
│                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │  Master Node │  │ Master Node │  │Master Node│ │
│  │  (候选)      │  │  (活跃)     │  │ (候选)    │ │
│  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │
│         │                │               │       │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼─────┐ │
│  │ Data Node 1 │  │ Data Node 2 │  │Data Node 3│ │
│  │             │  │             │  │           │ │
│  │ Shard 0 (P) │  │ Shard 0 (R) │  │ Shard 1(P)│ │
│  │ Shard 1 (R) │  │ Shard 2 (P) │  │ Shard 2(R)│ │
│  └─────────────┘  └─────────────┘  └───────────┘ │
│                                                   │
│  P = Primary Shard   R = Replica Shard            │
└───────────────────────────────────────────────────┘
```

### 索引生命周期管理（ILM）

时序数据（日志、事件）应该使用 ILM 自动管理索引生命周期：

```json
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": { "max_size": "50gb", "max_age": "1d" },
          "set_priority": { "priority": 100 }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "shrink": { "number_of_shards": 1 },
          "forcemerge": { "max_num_segments": 1 },
          "set_priority": { "priority": 50 }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "freeze": {},
          "set_priority": { "priority": 0 }
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": { "delete": {} }
      }
    }
  }
}
```

## NoSQL 选型决策树

```
                    ┌──────────────────┐
                    │   你的数据需求是什么？│
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
     ┌──────▼──────┐ ┌──────▼──────┐ ┌───────▼──────┐
     │ 结构灵活/    │ │ 高性能读写/  │ │ 全文搜索/     │
     │ 文档型数据   │ │ 缓存/计数    │ │ 日志分析      │
     └──────┬──────┘ └──────┬──────┘ └───────┬──────┘
            │                │                │
     ┌──────▼──────┐ ┌──────▼──────┐ ┌───────▼──────┐
     │  MongoDB    │ │   Redis     │ │ Elasticsearch│
     │             │ │             │ │              │
     │ 适合：      │ │ 适合：      │ │ 适合：       │
     │ - 内容管理  │ │ - 会话缓存  │ │ - 全文搜索   │
     │ - 用户画像  │ │ - 排行榜    │ │ - 日志聚合   │
     │ - 事件日志  │ │ - 分布式锁  │ │ - 实时分析   │
     │ - 配置中心  │ │ - 消息队列  │ │ - 地理搜索   │
     └─────────────┘ └─────────────┘ └──────────────┘
```

## CAP 定理与选型

CAP 定理指出，分布式系统最多只能同时满足以下三项中的两项：

- **C（一致性）**：所有节点看到相同的数据
- **A（可用性）**：每个请求都能得到响应
- **P（分区容忍）**：网络分区时系统仍能运行

```
数据库        优先保证    牺牲
----------------------------------
PostgreSQL    CP         A（主库不可用时从库可能数据旧）
MongoDB       CP         A（默认配置，可调整为 AP）
Redis Cluster CP         A（少数节点故障时可能不可用）
Elasticsearch AP         C（近实时，有短暂不一致窗口）
Cassandra     AP         C（最终一致）
```

## 多数据库混合架构

实际项目中，通常需要组合多种数据库，每种负责最擅长的场景：

```
┌─────────────────────────────────────────────────┐
│                    应用服务层                      │
└─────────┬───────┬───────┬───────┬───────────────┘
          │       │       │       │
    ┌─────▼──┐ ┌──▼───┐ ┌▼────┐ ┌▼──────────┐
    │PostgreSQL│ │Redis │ │Mongo│ │Elasticsearch│
    │         │ │      │ │DB   │ │            │
    │核心业务 │ │缓存/ │ │内容 │ │搜索/日志   │
    │订单/用户│ │会话  │ │存储 │ │分析        │
    └─────────┘ └──────┘ └─────┘ └────────────┘
```

数据同步策略：
- **双写**：应用同时写入两个数据库，简单但有一致性风险
- **CDC（变更数据捕获）**：通过 Debezium 等工具监听数据库 binlog，异步同步到目标数据库
- **定时批量同步**：适合对实时性要求不高的场景

## 常见误区

1. **"Redis 只是缓存"**：Redis 是一个完整的内存数据库，支持多种数据结构和持久化。把它只当缓存用是大材小用，但也要注意不要把不适合放内存的数据硬塞进 Redis。

2. **"MongoDB 不支持事务"**：MongoDB 从 4.0 开始支持多文档事务，4.2 开始支持分片集群的分布式事务。但事务会带来性能开销，应该优先通过合理的文档结构避免跨文档事务。

3. **"Elasticsearch 可以替代数据库"**：ES 的写入有近实时延迟（默认 1 秒），不支持精确的事务操作，不适合作为 primary 数据存储。它应该作为搜索引擎和分析引擎使用。

4. **"NoSQL 不需要设计 schema"**：虽然 NoSQL 的 schema 灵活，但不意味着不需要设计。糟糕的文档结构会导致查询效率低下、数据冗余严重。schema 设计应该基于查询模式来规划。

5. **"CAP 定理意味着三选二"**：实际上网络分区（P）是不可避免的，所以真实的选择是在 CP 和 AP 之间权衡。而且很多数据库提供了可配置的一致性级别，不是非黑即白。

6. **"Redis Cluster 可以无限扩展"**：Redis Cluster 最多支持 1000 个节点（16384 个槽限制），且扩缩容需要数据迁移，迁移期间性能会受影响。单个 Redis 实例的内存不建议超过 20GB。

7. **"MongoDB 的嵌入文档越多越好"**：嵌入文档有 16MB 的大小限制。如果一个文档会无限增长（如用户评论），应该引用而非嵌入。嵌入适合读多写少、数据量可控的场景。

8. **"ES 的分片越多搜索越快"**：每个分片都是一个独立的 Lucene 索引，分片过多会增加协调开销和内存占用。单个分片建议 10-50GB，分片数 = 节点数 × 1.5 是经验公式。

9. **"NoSQL 可以完全替代关系型数据库"**：NoSQL 和 RDBMS 是互补关系，不是替代关系。强关系型数据（如订单、财务）用 RDBMS 更安全，灵活数据用 NoSQL 更高效。

10. **"Redis 持久化不会影响性能"**：RDB 快照会 fork 子进程，大内存实例 fork 可能导致瞬间卡顿；AOF 的 fsync 策略会影响写入延迟。生产环境需要在数据安全和性能之间权衡。

## 工程建议

1. **从查询模式出发设计 schema**：先确定应用有哪些查询需求，再决定数据怎么存储。这和关系型数据库的"先设计表结构再写查询"思路相反，但对 NoSQL 至关重要。

2. **不要为了用 NoSQL 而用 NoSQL**：如果数据是强关系型的（如订单-商品-用户），用关系型数据库更合适。NoSQL 适合 schema 灵活、读写模式特殊、需要水平扩展的场景。

3. **Redis 要设置过期时间**：内存资源有限，所有缓存数据都应该设置 TTL。避免把 Redis 当成持久化存储使用（除非你明确知道内存成本）。

4. **Elasticsearch 的索引要定期维护**：时序数据（如日志）应该按时间创建索引并设置生命周期策略（ILM），定期归档或删除过期索引，避免集群资源耗尽。

5. **用 CDC 替代双写**：双写很难保证一致性，变更数据捕获（CDC）通过监听数据库的变更日志来同步数据，更可靠也更解耦。

6. **MongoDB 的读偏好（Read Preference）要合理配置**：默认 primary 模式保证强一致性，但 secondary 模式可以分担读压力。注意 secondary 可能读到旧数据，适合对一致性要求不高的查询。

7. **Redis 使用 Pipeline 批量操作**：多条 Redis 命令逐条发送会产生大量网络往返。Pipeline 将多条命令打包发送，批量获取响应，吞吐量可提升 5-10 倍。

8. **ES 的写入要使用 Bulk API**：单条写入效率低，Bulk API 支持批量索引/更新/删除。建议每批 5-15MB，过大容易超时。

9. **监控各数据库的核心指标**：Redis 关注内存使用率、命中率、连接数；MongoDB 关注 oplog 长度、复制延迟、锁等待；ES 关注集群状态、分片分配、JVM 堆使用率。

10. **数据备份策略要覆盖所有数据库**：Redis 做 RDB + AOF 备份；MongoDB 做 mongodump 或文件系统快照；ES 做 Snapshot 到 S3。备份文件要定期做恢复验证。

## 小结

NoSQL 不是关系型数据库的替代品，而是互补品。MongoDB 适合文档型和 schema 灵活的数据，Redis 适合需要毫秒级响应的缓存和计数场景，Elasticsearch 适合全文搜索和日志分析。实际项目中，通常需要将多种数据库组合使用，每种负责最擅长的场景。选型的核心原则是：从数据模型和访问模式出发，而不是从技术热度出发。

## 练习

### 练习一：选型决策

你要为一个在线教育平台选择数据库，需要支持：课程内容存储（包含富文本、视频、测验等多种格式）、课程搜索（支持按关键词、分类、难度搜索）、实时弹幕和评论点赞。请给出数据库选型方案。

### 练习二：Redis 数据结构选择

需要实现一个"最近浏览"功能，记录用户最近浏览的 50 个商品，支持按时间顺序展示，且需要去重（同一商品多次浏览只保留最新一条）。应该用 Redis 的哪种数据结构？请给出实现方案。

### 练习三：混合架构数据一致性

系统使用 PostgreSQL 存储订单数据，Elasticsearch 提供订单搜索。用户反映"刚下的订单搜不到"。请分析原因并给出解决方案。

### 练习四：Redis 大 Key 治理

监控发现 Redis 中有一个 key 存储了 500 万个成员的 Set，导致该节点内存不均、阻塞其他操作。请设计拆分方案。

---

## 参考答案

### 练习一

**思路**：三种需求分别对应不同的数据模型，需要组合使用。

**答案**：
- 课程内容存储 → MongoDB：课程结构灵活（视频课程和文字课程字段不同），文档模型天然适合这种半结构化数据。MongoDB 的 GridFS 还可以存储大文件。
- 课程搜索 → Elasticsearch：关键词搜索、分类过滤、难度筛选、排序，这些是 ES 的核心能力。需要配置中文分词器处理课程标题和简介。
- 实时弹幕 → Redis：弹幕是高频写、实时读的场景，用 Redis 的 List 或 Stream 结构。评论点赞用 Redis 的 Set（去重）和 ZSet（排行榜）。
- 用户信息、订单等核心业务数据 → PostgreSQL：需要强一致性和事务支持。

**要点**：
- 不要试图用一个数据库解决所有问题
- 每种数据选择最适合的存储引擎

### 练习二

**思路**：需要按时间排序、去重、限制数量。ZSet 的 score 可以用时间戳，member 用商品 ID 自动去重。

**答案**：
使用 ZSet（有序集合），score 为浏览时间戳，member 为商品 ID。

```python
def add_recent_view(user_id, product_id):
    key = f"recent_view:{user_id}"
    now = time.time()
    redis.zadd(key, {product_id: now})
    # 只保留最近 50 条
    redis.zremrangebyrank(key, 0, -51)
    # 设置过期时间 30 天
    redis.expire(key, 30 * 86400)

def get_recent_views(user_id, page=1, size=20):
    key = f"recent_view:{user_id}"
    start = (page - 1) * size
    # 按时间倒序返回
    return redis.zrevrange(key, start, start + size - 1)
```

**要点**：
- ZSet 的 member 自动去重，同一商品多次浏览只会更新 score
- zremrangebyrank 控制集合大小，避免内存无限增长

### 练习三

**思路**：PostgreSQL 到 Elasticsearch 的数据同步存在延迟。

**答案**：
原因：订单写入 PostgreSQL 后，同步到 Elasticsearch 有延迟（取决于同步机制，可能是秒级甚至分钟级）。用户在同步完成前搜索，自然搜不到。

解决方案：
方案一：写入后标记搜索可见性。订单写入成功后，将订单 ID 和关键信息存入 Redis，搜索接口先查 Redis 补充结果，ES 同步完成后删除 Redis 标记。

方案二：同步写入 ES。在同一个事务中写入 PostgreSQL 和 ES，但这会增加写入延迟，且 ES 的写入不是实时可见的（默认 1 秒 refresh interval）。

方案三：用户感知优化。下单成功页面直接展示订单信息，不依赖搜索。搜索入口加提示"订单同步可能有 1-2 秒延迟"。

推荐方案一，兼顾用户体验和系统解耦。

**要点**：
- ES 的 near-real-time 特性决定了它不适合做实时一致性要求高的查询
- 补偿机制比强一致更实用

### 练习四

**思路**：大 Key 拆分的核心是将一个大集合分散到多个小 Key 中。

**答案**：

```
拆分策略：按哈希分桶

原始 Key：user:tags → Set(500万成员)
拆分为 100 个子 Key：user:tags:{0..99}

路由规则：member 的 CRC32 哈希值 % 100 → 子 Key 编号

写入：SADD user:tags:{hash(member) % 100} member
查询全部：遍历 100 个子 Key，SUNION 合并结果
判断存在：SISMEMBER user:tags:{hash(member) % 100} member
```

迁移步骤：
1. 双写期间同时写入旧 Key 和新子 Key
2. 后台任务将旧 Key 数据逐批迁移到子 Key
3. 迁移完成后，读请求切换到新子 Key
4. 确认无误后删除旧 Key

关键代码：
```python
def get_shard_key(user_id, member):
    shard = crc32(member.encode()) % 100
    return f"user:tags:{shard}"

def add_tag(user_id, tag):
    # 双写过渡期
    redis.sadd(f"user:tags", tag)  # 旧 Key
    redis.sadd(get_shard_key(user_id, tag), tag)  # 新子 Key

def has_tag(user_id, tag):
    return redis.sismember(get_shard_key(user_id, tag), tag)
```

**要点**：
- 拆分数量需要根据预期数据量规划，避免单个子 Key 仍然过大
- 迁移期间要保证数据一致性，双写是最安全的方案
- 拆分后查询全部数据需要聚合多个子 Key，评估性能影响
