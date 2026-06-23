# SQL 选型：PostgreSQL vs MySQL 与高可用架构

## 一个选型失误的代价

你的团队开发电商系统，技术选型阶段确定关系型数据库。有人说"MySQL 足够了，公司所有项目都用的 MySQL"，有人说"PostgreSQL 功能更强"。选错数据库不会让项目立刻死亡，但会在业务增长到一定规模后变成技术债。

本课不是告诉你"PostgreSQL 更好"或"MySQL 更好"，而是帮你在具体场景下做出有理有据的选型决策。

## 核心差异：不是谁更好，而是谁更适合

```
场景              PostgreSQL    MySQL
──────────────────────────────────────
简单 OLTP 读写     ★★★★        ★★★★★
复杂查询/分析      ★★★★★       ★★★
高并发写入         ★★★★★       ★★★★
JSON 操作          ★★★★★       ★★★
地理信息           ★★★★★       ★★
```

**PostgreSQL 的优势**：jsonb 原生支持（可替代简单场景的 MongoDB）、PostGIS 地理信息、pg_vector 向量搜索、扩展生态丰富。单一存储引擎，所有功能开箱即用。

**MySQL 的优势**：简单读写场景略快（架构更轻量）、第三方工具链成熟、运维经验丰富。可插拔存储引擎架构（但选错引擎是常见事故原因）。

**MVCC 差异**：PostgreSQL 每行有 xmin/xmax 隐藏字段，UPDATE 是 INSERT 新版本 + 标记旧版本删除，需要定期 VACUUM。MySQL/InnoDB 用 undo log 存旧版本，通过 purge 线程清理。PostgreSQL 长事务阻止 VACUUM 导致表膨胀，MySQL 长事务导致 undo log 持续增长。

## 主从复制：三种模式的取舍

```
异步复制：主库提交后立即返回，不等从库确认
  → 延迟最低，但主库崩溃可能丢数据

半同步复制：主库等至少一个从库确认后返回
  → 兼顾性能和安全，生产环境最常用

同步复制：主库等所有从库确认后返回
  → 数据零丢失，但延迟高，可用性差
```

读写分离架构：

```
应用服务 → 代理/中间件（ProxySQL / PgBouncer）
              │
     ┌────────┼────────┐
     ▼        ▼        ▼
  Master    Slave1    Slave2
  (写库)    (读库)    (读库)
     └──异步/半同步复制──┘
```

## 连接池：不是越大越好

经验公式：

```
连接数 = (CPU 核心数 × 2) + 有效磁盘数
```

8 核 CPU、1 块 SSD → 推荐连接数约 17。过多连接导致上下文切换增加，反而降低性能。

```yaml
# HikariCP 配置示例
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
```

## 慢查询优化

用 `EXPLAIN ANALYZE`（PostgreSQL）或 `EXPLAIN`（MySQL）查看执行计划，关注：

- **Seq Scan vs Index Scan**：全表扫描通常意味着缺少索引
- **Rows Removed by Filter**：过滤掉的行越多，索引选择性越差

常见优化手段：

```sql
-- 复合索引：选择性高的列放前面
CREATE INDEX idx_orders_status_date ON orders(status, created_at);

-- 覆盖索引：避免回表
CREATE INDEX idx_orders_covering ON orders(status, created_at) INCLUDE (total);

-- 避免深分页
-- 慢：OFFSET 100000
-- 快：WHERE id > 上次最后一条的 id

-- 避免索引失效
-- 错：WHERE YEAR(created_at) = 2024
-- 正：WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'

-- MySQL utf8 vs utf8mb4
-- utf8 实际是 utf8mb3，不支持 emoji。必须用 utf8mb4
```

## 10 个常见误区

1. "MySQL 比 PostgreSQL 快"——简单读场景 MySQL 略快，复杂查询和高并发写入 PostgreSQL 更优
2. "主从复制解决所有高可用"——还需要 failover 机制配合
3. "连接池越大越好"——过多连接导致上下文切换
4. "读写分离后延迟不重要"——写后立刻读从库可能读到旧数据
5. "慢查询加索引就行"——写密集场景过多索引拖慢写入
6. "PostgreSQL 不适合高并发"——从 v10 开始已大幅改善
7. "外键约束应该在数据库层"——分库分表后无法跨库使用
8. "字符集选 utf8 就够了"——MySQL 的 utf8 不支持 4 字节字符
9. "DDL 可以随时执行"——大表 ALTER 可能锁表数小时
10. "备份等于可以恢复"——不做恢复验证等于没有备份

## 练习

### 练习一：选型决策

社交平台，核心功能：用户动态、评论、点赞、地理位置（附近的人）。千万级用户，日活百万。给出数据库选型方案。

### 练习二：主从延迟处理

一主两从架构，用户下单后跳转订单详情页，偶尔看到"订单不存在"。分析原因，给出两种解决方案。

### 练习三：慢查询优化

500 万行的表上执行 3 秒，优化：

```sql
SELECT * FROM products
WHERE category = 'electronics'
  AND price BETWEEN 100 AND 5000
  AND created_at > '2024-01-01'
ORDER BY sales_count DESC
LIMIT 50;
```

### 练习四：实现连接池计算器

编写一个 TypeScript 函数，输入 CPU 核心数和磁盘数，输出推荐连接数范围（最小值和最大值）。

---

## 参考答案

### 练习一

选 PostgreSQL。理由：jsonb 存储动态字段；PostGIS 原生支持地理位置查询，空间索引高效实现"附近的人"；百万日活并发量完全胜任。Redis 做缓存层。不需要分库分表。

### 练习二

原因：写入主库后立刻读从库，主从延迟导致从库还没同步。

方案一：写后读走主库。请求上下文设置标记，代理层根据标记路由。最简单直接。

方案二：写后订单信息写 Redis，详情页优先读 Redis，缓存过期后自然走从库（此时数据已同步）。适合高并发。

### 练习三

```sql
-- 创建复合索引
CREATE INDEX idx_products_category_price_created
ON products(category, price, created_at);

-- 避免 SELECT *，只查需要的列
SELECT name, image_url, sales_count FROM products
WHERE category = 'electronics'
  AND price BETWEEN 100 AND 5000
  AND created_at > '2024-01-01'
ORDER BY sales_count DESC
LIMIT 50;
```

`category` 等值过滤 + `price` 范围 + `created_at` 范围，复合索引按此顺序。`sales_count` 不在索引中，排序需要 filesort，但 LIMIT 50 只排序 50 行，可以接受。

### 练习四

```typescript
function recommendPoolSize(cpuCores: number, diskCount: number): { min: number; max: number } {
  if (cpuCores < 1 || diskCount < 1) throw new Error('参数必须 >= 1')
  const base = cpuCores * 2 + diskCount
  return { min: Math.max(base, 5), max: base * 2 }
}

describe('recommendPoolSize', () => {
  test('8 核 1 盘', () => {
    expect(recommendPoolSize(8, 1)).toEqual({ min: 17, max: 34 })
  })
  test('1 核 1 盘（最小值保护）', () => {
    expect(recommendPoolSize(1, 1)).toEqual({ min: 5, max: 6 })
  })
  test('参数为 0 抛异常', () => {
    expect(() => recommendPoolSize(0, 1)).toThrow()
  })
})
```
