# SQL 选型：PostgreSQL vs MySQL 与高可用架构

## 场景引入

你的团队要开发一个新的电商系统，技术选型阶段需要确定关系型数据库。团队里有人说"MySQL 足够了，公司所有项目都用的 MySQL"，也有人说"PostgreSQL 功能更强，JSON 支持更好"。你作为架构师，需要给出一个有理有据的选型决策，并且设计好数据库的高可用和读写分离方案。

这个场景在实际项目中非常常见。选错数据库不会让项目立刻死亡，但会在业务增长到一定规模后变成技术债，让你不得不花大量精力做迁移。

## 学习目标

- 理解 PostgreSQL 和 MySQL 的核心差异，能根据业务场景做出合理选型
- 掌握主从复制的三种模式及其适用场景
- 了解读写分离中间件的原理和配置方式
- 能够设计连接池配置策略
- 掌握慢查询优化和执行计划分析的基本方法

## PostgreSQL vs MySQL 核心对比

### ACID 支持

两者都支持 ACID 事务，但实现细节有差异。MySQL 的 InnoDB 引擎支持完整的 ACID，但 MyISAM 引擎不支持事务——这是很多初学者忽略的点。PostgreSQL 从设计之初就以事务安全为核心，所有存储引擎都支持 ACID。

```
PostgreSQL: 所有操作默认 ACID，无需额外配置
MySQL/InnoDB: 支持 ACID，需要确保使用 InnoDB 引擎
MySQL/MyISAM: 不支持事务，仅适合读密集的简单场景
```

### JSON 支持

PostgreSQL 提供 `jsonb` 类型，支持索引、查询、更新操作，性能接近原生文档数据库。MySQL 从 5.7 开始支持 JSON 类型，但功能和性能都不如 PostgreSQL 的 jsonb。

```sql
-- PostgreSQL jsonb 查询示例
SELECT * FROM orders WHERE info->>'status' = 'shipped';
CREATE INDEX idx_orders_info ON orders USING GIN (info);

-- MySQL JSON 查询示例
SELECT * FROM orders WHERE JSON_EXTRACT(info, '$.status') = 'shipped';
```

如果你的应用有大量半结构化数据，PostgreSQL 的 jsonb 可以让你省掉一个 MongoDB。

### 扩展性

PostgreSQL 的扩展生态更丰富：PostGIS（地理信息）、TimescaleDB（时序数据）、pg_vector（向量搜索）等。MySQL 的扩展相对有限，但生态成熟，第三方工具链完善。

### 性能特征

MySQL 在简单读写场景下略快，因为它的架构更轻量。PostgreSQL 在复杂查询、并发写入、大数据量分析场景下表现更好。两者的性能差距在大多数业务场景下不会成为瓶颈，真正影响性能的是索引设计和查询优化。

```
场景              PostgreSQL    MySQL
-----------------------------------------
简单 OLTP 读写     ★★★★        ★★★★★
复杂查询/分析      ★★★★★       ★★★
高并发写入         ★★★★★       ★★★★
JSON 操作          ★★★★★       ★★★
地理信息           ★★★★★       ★★
```

### MVCC 实现差异

两者都使用 MVCC（多版本并发控制）实现读写不阻塞，但实现机制不同：

```
PostgreSQL:
  - 每行数据有 xmin/xmax 隐藏字段记录事务 ID
  - UPDATE 实际是 INSERT 新版本 + 标记旧版本删除
  - 需要定期 VACUUM 清理死元组
  - 事务 ID 为 32 位，约 20 亿后需要 wraparound 处理

MySQL/InnoDB:
  - 使用 undo log 存储数据的旧版本
  - UPDATE 在原地修改，旧版本链在 undo log 中
  - 通过 purge 线程清理不再需要的 undo log
  - 回滚段管理，不需要 VACUUM 但 undo log 膨胀是常见问题
```

这个差异直接影响长事务的处理：PostgreSQL 长事务会阻止 VACUUM 导致表膨胀，MySQL 长事务会导致 undo log 持续增长。

### 存储引擎层

```
PostgreSQL: 单一存储引擎，所有功能内置
  ✓ 无需选择引擎，减少决策成本
  ✓ 所有特性（事务、全文索引、JSON）开箱即用
  ✗ 无法针对特殊场景定制存储引擎

MySQL: 可插拔存储引擎架构
  InnoDB: 事务型，B+ 树索引，行锁，外键（生产必选）
  MyISAM: 非事务型，表锁，全文索引（已过时）
  Memory: 内存表，重启丢失（仅临时场景）
  Archive: 只支持 INSERT 和 SELECT，高压缩比（日志归档）
  ✓ 灵活性高，可针对场景选择引擎
  ✗ 不同引擎特性差异大，选错引擎是常见事故原因
```

## 主从复制架构

主从复制是实现高可用和读写分离的基础。核心思想是：主库处理写操作，从库复制主库的数据变更，处理读请求。

### 三种复制模式

**异步复制**：主库提交事务后立即返回客户端，不等待从库确认。延迟最低，但主库崩溃时可能丢失未同步的数据。

**半同步复制**：主库等待至少一个从库确认收到数据后才返回客户端。兼顾性能和安全，是生产环境最常用的模式。

**同步复制**：主库等待所有从库确认后才返回客户端。数据零丢失，但延迟高，可用性差（任一从库故障都会阻塞主库）。

```
                    ┌─────────────────────────────────────┐
                    │          读写分离架构                 │
                    └─────────────────────────────────────┘

                          ┌──────────┐
                          │  应用服务  │
                          └─────┬────┘
                                │
                          ┌─────▼────┐
                          │ 代理/中间件│  ← ProxySQL / PgBouncer
                          └─────┬────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
              ┌─────▼─────┐ ┌──▼────┐ ┌────▼────┐
              │  Master    │ │Slave 1│ │Slave 2  │
              │  (写库)    │ │(读库) │ │(读库)   │
              └─────┬──────┘ └──▲────┘ └────▲────┘
                    │           │           │
                    │    异步/半同步复制       │
                    └───────────┴───────────┘
```

### 复制延迟监控

主从复制延迟是读写分离架构的核心风险。监控手段包括：

```sql
-- MySQL 查看从库延迟
SHOW SLAVE STATUS;
-- 关注 Seconds_Behind_Master 字段
-- NULL 表示复制中断，非零表示延迟秒数

-- PostgreSQL 查看流复制延迟
SELECT
  client_addr,
  state,
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replay_lag_bytes
FROM pg_stat_replication;
```

延迟产生的常见原因：
- 从库硬件配置低于主库
- 从库承担了大量复杂查询
- 大事务（如批量更新、DDL）导致从库回放慢
- 网络带宽不足

## 读写分离中间件

### ProxySQL

ProxySQL 是 MySQL 生态最流行的读写分离代理，支持查询路由、连接复用、查询缓存、故障自动切换。

```sql
-- ProxySQL 核心配置示例
-- 定义后端 MySQL 服务器
INSERT INTO mysql_servers (hostgroup_id, hostname, port, weight)
VALUES (1, '10.0.0.1', 3306, 1000),  -- 写组
       (2, '10.0.0.2', 3306, 1000),  -- 读组
       (2, '10.0.0.3', 3306, 1000);  -- 读组

-- 定义读写分离规则
INSERT INTO mysql_query_rules (rule_id, match_pattern, destination_hostgroup)
VALUES (1, '^SELECT.*FOR UPDATE', 1),  -- SELECT FOR UPDATE 走写库
       (2, '^SELECT', 2);               -- 普通 SELECT 走读库
```

### PgBouncer

PgBouncer 是 PostgreSQL 的连接池代理，主要解决连接数过多的问题。它本身不做查询路由，需要配合应用层或 HAProxy 实现读写分离。

```
连接模式：
- session 模式：连接生命周期与客户端会话绑定，兼容性最好
- transaction 模式：每个事务结束后连接归还池中，连接复用率最高
- statement 模式：每条 SQL 后连接归还，只能用在自动提交场景
```

## 连接池配置

连接池大小不是越大越好。一个经验公式：

```
连接数 = (CPU 核心数 × 2) + 有效磁盘数
```

例如 8 核 CPU、1 块 SSD 的数据库服务器，推荐连接数约 17。过多的连接会导致上下文切换增加，反而降低性能。

```yaml
# HikariCP 连接池配置示例（Java 应用）
spring:
  datasource:
    hikari:
      maximum-pool-size: 20      # 最大连接数
      minimum-idle: 5            # 最小空闲连接
      connection-timeout: 30000  # 获取连接超时 30s
      idle-timeout: 600000       # 空闲连接超时 10min
      max-lifetime: 1800000      # 连接最大生命周期 30min
```

## 慢查询优化

### 执行计划分析

使用 `EXPLAIN ANALYZE`（PostgreSQL）或 `EXPLAIN`（MySQL）查看查询执行计划，关注以下指标：

```sql
-- PostgreSQL 执行计划分析
EXPLAIN ANALYZE
SELECT o.id, o.total, u.name
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.created_at > '2024-01-01'
  AND o.status = 'completed'
ORDER BY o.total DESC
LIMIT 20;
```

关键关注点：
- **Seq Scan vs Index Scan**：全表扫描通常意味着缺少合适的索引
- **Nested Loop vs Hash Join**：小表关联用 Nested Loop，大表关联用 Hash Join
- **Rows Removed by Filter**：过滤掉的行数越多，说明索引选择性越差

### 常见优化手段

```
1. 复合索引：将选择性高的列放在前面
   CREATE INDEX idx_orders_status_date ON orders(status, created_at);

2. 覆盖索引：索引包含查询所需的所有列，避免回表
   CREATE INDEX idx_orders_covering ON orders(status, created_at) INCLUDE (total);

3. 分页优化：避免深分页
   -- 慢：OFFSET 100000
   -- 快：WHERE id > 上次最后一条的 id

4. 避免索引失效的写法：
   -- 错误：对索引列使用函数
   WHERE YEAR(created_at) = 2024
   -- 正确：范围查询
   WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'

   -- 错误：隐式类型转换
   WHERE phone = 13800138000  -- phone 是 varchar 类型
   -- 正确：类型匹配
   WHERE phone = '13800138000'

   -- 错误：前导模糊查询
   WHERE name LIKE '%张'
   -- 正确：后缀模糊查询可以走索引
   WHERE name LIKE '张%'
```

### 连接数监控与调优

```sql
-- PostgreSQL 查看当前连接数
SELECT count(*) FROM pg_stat_activity;
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;

-- MySQL 查看连接数
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Threads_running';
```

连接数异常排查流程：
```
连接数突增
  │
  ├── 应用层连接泄漏？
  │     → 检查连接池配置，是否有未归还的连接
  │
  ├── 慢查询导致连接堆积？
  │     → 检查 SHOW PROCESSLIST / pg_stat_activity
  │
  ├── 外部攻击（连接耗尽攻击）？
  │     → 检查连接来源 IP，配置连接限制
  │
  └── 应用发布导致连接池重建？
        → 确认发布策略，使用连接池预热
```

## 常见误区

1. **"MySQL 比 PostgreSQL 快"**：这个说法过于笼统。简单读场景 MySQL 略快，但复杂查询和高并发写入场景 PostgreSQL 更优。性能取决于具体场景和优化水平。

2. **"主从复制可以解决所有高可用问题"**：主从复制解决的是读扩展和数据冗余，但主库单点写入仍然是瓶颈。真正的高可用需要主从切换（failover）机制配合。

3. **"连接池越大性能越好"**：连接数过多会导致数据库服务器上下文切换频繁，反而降低吞吐量。应该根据数据库服务器的硬件配置合理设置连接池大小。

4. **"读写分离后延迟不重要"**：半同步和异步复制都存在主从延迟，如果应用在写入后立刻读取从库，可能读到旧数据。关键业务的读操作应该走主库。

5. **"慢查询加索引就行"**：索引不是万能的。写密集场景下过多索引会拖慢写入速度，需要在读写性能之间找平衡。

6. **"PostgreSQL 不适合高并发"**：早期版本确实有并发扩展性问题，但从 PostgreSQL 10 开始，其并发性能已大幅改善，vacuum 机制也持续优化。百万级日活的场景完全胜任。

7. **"外键约束应该在数据库层实现"**：分库分表后外键约束无法跨库使用，且高并发场景下外键检查会增加锁竞争。很多团队选择在应用层维护引用完整性。

8. **"字符集选 utf8 就够了"**：MySQL 的 utf8 实际是 utf8mb3，不支持 4 字节字符（如 emoji）。应该使用 utf8mb4 字符集，否则存入 emoji 字符会静默截断或报错。

9. **"DDL 操作可以随时执行"**：ALTER TABLE 在大表上执行可能锁表数小时。MySQL 5.6+ 支持 Online DDL，但仍需评估磁盘空间和复制延迟影响。推荐使用 pt-online-schema-change 或 gh-ost 工具。

10. **"数据库备份等于可以恢复"**：备份如果不做恢复验证，等于没有备份。定期做恢复演练，确认备份文件可用、恢复时间满足 RTO 要求。

## 工程建议

1. **新项目优先考虑 PostgreSQL**：除非团队有深厚的 MySQL 运维经验且项目需求简单，PostgreSQL 的功能丰富度和扩展性更适合长期发展。

2. **半同步复制是生产环境的底线**：异步复制有数据丢失风险，同步复制性能太差。半同步复制在两者之间取得了合理平衡。

3. **读写分离要在应用层做好兜底**：主从延迟是客观存在的，关键读操作要能降级到主库查询。不要把所有读都无脑甩给从库。

4. **监控慢查询比优化慢查询更重要**：设置慢查询阈值（如 200ms），通过日志或 APM 工具持续监控，发现一个优化一个，而不是等到性能问题爆发才处理。

5. **连接池配置要配合压测调整**：公式只是起点，最终配置需要通过压测验证。关注数据库服务器的 CPU 使用率、连接数、QPS 三个指标。

6. **DDL 操作使用 Online 工具**：生产环境大表变更必须使用 pt-online-schema-change（MySQL）或 pg_repack（PostgreSQL），避免锁表影响业务。

7. **数据库账号遵循最小权限原则**：应用账号只授予 SELECT/INSERT/UPDATE/DELETE，DDL 操作使用独立的 DBA 账号。禁止使用 root 账号连接数据库。

8. **备份策略要覆盖全链路**：全量备份（每天）+ 增量备份（每小时）+ binlog/WAL 归档（连续）。备份文件异地存储，定期做恢复演练。

9. **数据库参数不要用默认值**：关键参数（shared_buffers、work_mem、innodb_buffer_pool_size 等）必须根据硬件配置调整。默认值是为最低配置设计的，直接用默认值等于浪费硬件资源。

10. **读写分离中间件要做好健康检查**：从库故障时中间件要能自动摘除，恢复后自动加回。避免将请求路由到不可用的从库导致超时。

## 小结

SQL 选型不是简单的"PostgreSQL vs MySQL 哪个更好"，而是要根据团队经验、业务特点、扩展需求综合判断。主从复制和读写分离是关系型数据库水平扩展的基本手段，但需要注意主从延迟和故障切换。连接池和慢查询优化是数据库性能调优的日常工作，需要持续监控和迭代。

## 练习

### 练习一：选型决策

你的团队要开发一个社交平台，核心功能包括用户动态、评论、点赞，同时需要存储用户的地理位置信息用于附近的人功能。数据量预计千万级用户，日活百万。请给出数据库选型方案并说明理由。

### 练习二：主从延迟处理

系统采用一主两从的读写分离架构，用户下单后立即跳转到订单详情页，但偶尔会看到"订单不存在"的提示。请分析原因并给出至少两种解决方案。

### 练习三：慢查询优化

以下 SQL 在数据量 500 万的表上执行需要 3 秒，请分析问题并给出优化方案：

```sql
SELECT * FROM products
WHERE category = 'electronics'
  AND price BETWEEN 100 AND 5000
  AND created_at > '2024-01-01'
ORDER BY sales_count DESC
LIMIT 50;
```

### 练习四：高可用架构设计

你的系统需要设计一套数据库高可用方案，要求：主库故障后 30 秒内自动切换，数据零丢失（RPO=0），切换过程中写入短暂不可用但读请求可以降级。请给出技术方案。

---

## 参考答案

### 练习一

**思路**：社交平台是典型的读多写少场景，需要处理地理位置查询，数据量中等偏大。

**答案**：
- 主数据库选择 PostgreSQL，原因：jsonb 适合存储动态字段（用户资料扩展信息）；PostGIS 扩展原生支持地理位置查询，"附近的人"功能可以用空间索引高效实现；百万日活对应的并发量 PostgreSQL 完全可以胜任。
- Redis 作为缓存层，缓存用户信息和热点动态。
- 不需要分库分表，千万级用户量对 PostgreSQL 来说不是问题。

**要点**：
- 地理位置查询是关键决策点，PostGIS 比 MySQL 的空间函数更成熟
- 不要过度设计，千万级数据量不需要 NoSQL

### 练习二

**思路**：写入主库后立刻读从库，主从延迟导致从库还没有同步到最新数据。

**答案**：
方案一：写后读走主库。用户下单后，订单详情页的查询强制路由到主库。可以在请求上下文中设置标记，代理层根据标记决定路由。

方案二：引入短暂缓存。下单成功后将订单信息写入 Redis，详情页优先从 Redis 读取，缓存过期后自然走从库（此时数据已同步）。

方案三：使用半同步复制减少延迟窗口，但不能完全消除。

**要点**：
- 根本原因是主从延迟，这是异步复制的固有特征
- 方案一最简单直接，方案二更适合高并发场景

### 练习三

**思路**：分析查询条件和排序，判断是否缺少合适的索引。

**答案**：
问题分析：`category` 和 `price` 范围查询选择性一般，`created_at` 进一步筛选，最后按 `sales_count` 排序。如果没有合适索引，数据库需要全表扫描后排序。

优化方案：
```sql
-- 创建复合索引
CREATE INDEX idx_products_category_price_created
ON products(category, price, created_at);

-- 如果仍然慢，考虑覆盖索引
CREATE INDEX idx_products_covering
ON products(category, price, created_at)
INCLUDE (sales_count, name, image_url);
```

如果 `category = 'electronics'` 筛选后数据量仍然很大，可以改为基于游标的分页：
```sql
WHERE (category, price, created_at) > (上一页最后的值)
ORDER BY category, price, created_at
LIMIT 50;
```

**要点**：
- `SELECT *` 会阻止覆盖索引生效，应该只查询需要的列
- 范域查询后的列无法使用索引排序，这是 B+ 树索引的特性

### 练习四

**思路**：RPO=0 要求同步复制，自动切换需要哨兵或集群方案。

**答案**：

```
推荐架构：PostgreSQL + Patroni + etcd

┌──────────┐     ┌──────────┐     ┌──────────┐
│ PG Master│     │ PG Slave1│     │ PG Slave2│
│          │────→│          │     │          │
└─────┬────┘     └─────┬────┘     └─────┬────┘
      │                │                │
      └────────────────┼────────────────┘
                       │
                 ┌─────▼─────┐
                 │  etcd 集群  │  ← 选举 leader、存储集群状态
                 └───────────┘
                       │
                 ┌─────▼─────┐
                 │  Patroni   │  ← 每个节点运行，监控+自动故障转移
                 └───────────┘
```

方案要点：
- 使用同步复制保证 RPO=0：主库等待至少一个从库确认收到 WAL
- Patroni 监控主库健康，故障时通过 etcd 选举新主库
- 应用通过 HAProxy 连接数据库，Patroni 更新 HAProxy 的后端状态
- 切换过程中写入不可用约 10-30 秒，读请求可降级到从库
- 从库提升为主库前需要确认所有已确认的 WAL 都已回放

**要点**：
- RPO=0 必须用同步复制，但同步复制会影响写入性能
- 可以配置为"同步到最近的从库"，避免所有从库都同步导致延迟叠加
- 定期做故障切换演练，验证自动切换流程
