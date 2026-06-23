# 设计 Twitter 信息流系统

## 核心挑战

一个大 V 有 500 万粉丝，他每发一条帖子，信息流系统需要在几秒内让 500 万人都能看到。读写比 500:1——读远多于写。这是信息流系统的核心矛盾。

## 容量估算

```
DAU：1 亿
每用户每天发 2 条推文 → 日写入 2 亿条
每用户每天刷 10 次 → 日读请求 10 亿次
读写比 = 500:1

推文存储：每条 500 字节 → 100GB/天 → 约 36TB/年
```

## 推模式 vs 拉模式

**推模式（Fan-out on Write）**：用户发推时，立刻将推文写入所有粉丝的 Timeline 缓存。

```
用户 A 发推 → 查询粉丝列表 → 并行写入每个粉丝的 Redis 缓存

优点：读信息流极快，直接从缓存取，O(1)
缺点：写入放大严重。500 万粉丝 = 写 500 万次
```

**拉模式（Fan-out on Read）**：用户刷信息流时，实时查询关注的所有人，合并最近推文。

```
用户 B 刷信息流 → 查询关注列表 → 并行查询每人最近推文 → 合并排序

优点：写入零放大，发推只写一条
缺点：读取延迟高，关注 500 人 = 查 500 次
```

## 混合模式：工业界的最优解

对普通用户用推模式，对大 V 用拉模式。

```
用户 A 发推
    │
    ▼
判断粉丝数量
    │
    ├── 粉丝数 < 阈值（如 1000）→ 推模式：写入所有粉丝缓存
    │
    └── 粉丝数 >= 阈值 → 仅存储推文，不做 Fan-out

用户 B 刷信息流时：
  1. 读取自己的 Timeline 缓存（推模式的结果）
  2. 实时拉取关注的大 V 最新推文（拉模式）
  3. 合并排序后返回
```

阈值的选择是关键工程决策，需要根据实际写入负载动态调整。

## 时间线排序：合并 K 个有序列表

```
用户关注了 A, B, C：
A: [101, 95, 88]
B: [100, 92, 85]
C: [99, 96, 80]

用最大堆合并：
1. 每个列表头部入堆 → {101(A), 100(B), 99(C)}
2. 弹出 101 → A 的下一个 95 入堆
3. 弹出 100 → B 的下一个 92 入堆
4. 重复直到结果足够...

时间复杂度 O(N log K)，N 是总推文数，K 是关注人数
实际只需取 Top 200 条
```

## 缓存策略

Redis Sorted Set 存储每个用户的时间线：

```
Key:    timeline:{user_id}
Value:  Sorted Set
Score:  tweet 发布时间戳（毫秒）
Member: tweet_id

操作：
ZADD   timeline:user_123 1699000000000 "tweet_101"   # 写入
ZREVRANGE timeline:user_123 0 199                     # 读取 Top 200
ZREMRANGEBYRANK timeline:user_123 0 -1001             # 保留最新 1000 条
```

容量：每用户 1000 条推文 ID × 20 字节 ≈ 20KB。1 亿用户约 2TB Redis 内存。

## 练习

### 练习一：推模式延迟估算

大 V 有 1000 万粉丝，每秒写入 Redis 10 万次。计算推送到所有粉丝缓存需要多长时间？这个延迟对用户体验有什么影响？

### 练习二：缓存容量规划

2 亿注册用户，日活 5000 万，每用户缓存 500 条推文 ID（每条 20 字节），Redis 每 GB 约 30 美元/月。计算全量缓存内存需求和月成本。预算有限时如何优化？

### 练习三：实现动态阈值

编写一个 TypeScript 类 `DynamicThreshold`，当系统写入 QPS 超过目标值时自动降低大 V 粉丝数阈值（让更多用户走拉模式）。写入压力小时提高阈值。用 Vitest 测试。

---

## 参考答案

### 练习一

```
延迟 = 10,000,000 / 100,000 = 100 秒
```

100 秒意味着粉丝最快 1 分 40 秒后才能看到推文。社交产品不可接受。这就是大 V 必须走拉模式的原因。

### 练习二

```
5000 万 × 500 × 20B ≈ 46.5 GB
月成本：46.5 × 30 ≈ 1,395 美元
```

优化：只缓存活跃用户（LRU 淘汰不活跃）；推文 ID 用雪花算法 8 字节即可；非活跃用户缓存从 DB 实时构建。

### 练习三

```typescript
class DynamicThreshold {
  private current: number
  constructor(
    private base = 10000,
    private min = 1000,
    private targetWriteQPS = 500000
  ) { this.current = base }

  adjust(currentWriteQPS: number): void {
    if (currentWriteQPS > this.targetWriteQPS * 1.2) {
      this.current = Math.max(this.min, this.current * 0.8)
    } else if (currentWriteQPS < this.targetWriteQPS * 0.5) {
      this.current = Math.min(this.base, this.current * 1.1)
    }
  }

  shouldFanOut(followerCount: number): boolean {
    return followerCount < this.current
  }

  getThreshold(): number { return this.current }
}

describe('DynamicThreshold', () => {
  test('初始阈值', () => {
    const dt = new DynamicThreshold(10000, 1000, 500000)
    expect(dt.getThreshold()).toBe(10000)
  })
  test('写入压力大时降低阈值', () => {
    const dt = new DynamicThreshold(10000, 1000, 500000)
    dt.adjust(700000) // 超过目标 1.2 倍
    expect(dt.getThreshold()).toBe(8000)
  })
  test('写入压力小时提高阈值', () => {
    const dt = new DynamicThreshold(10000, 1000, 500000)
    dt.adjust(200000) // 低于目标 0.5 倍
    expect(dt.getThreshold()).toBe(11000)
  })
  test('阈值不低于最小值', () => {
    const dt = new DynamicThreshold(1000, 1000, 500000)
    dt.adjust(700000)
    expect(dt.getThreshold()).toBe(1000)
  })
})
```
