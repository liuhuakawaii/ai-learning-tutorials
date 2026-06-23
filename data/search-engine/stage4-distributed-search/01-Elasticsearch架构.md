# Elasticsearch 架构

你在一家电商公司负责搜索服务。随着商品数量增长到数千万条，单台服务器已经无法承载——磁盘空间不够，查询延迟从 50ms 飙升到 2 秒以上。你需要把搜索服务扩展到多台机器上，但又不想手动把查询分发到不同服务器再合并结果。

Elasticsearch 就是为解决这个问题而设计的：天然分布式，内置数据分片、副本容错、自动故障转移。

## 集群与节点

一个 ES 集群由多个节点组成。每个节点是一个运行中的 ES 进程。集群通过集群名称标识，只有相同集群名称的节点才能加入同一个集群。

```
┌───────────────────────────────────────────────────┐
│              ES Cluster: my-search                 │
│                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │  Node 1    │  │  Node 2    │  │  Node 3    │  │
│  │ (master)   │  │ (data)     │  │ (data)     │  │
│  │ 管理集群状态 │  │ 存储数据分片 │  │ 存储数据分片 │  │
│  └────────────┘  └────────────┘  └────────────┘  │
└───────────────────────────────────────────────────┘
```

集群状态有三种：`green`（所有分片正常）、`yellow`（主分片正常但副本未分配）、`red`（有主分片丢失）。

```python
from elasticsearch import Elasticsearch

es = Elasticsearch("http://localhost:9200")
health = es.cluster.health()
print(f"状态: {health['status']}, 节点数: {health['number_of_nodes']}")
print(f"活跃分片: {health['active_shards']}, 未分配: {health['unassigned_shards']}")
```

## 节点角色

ES 支持为节点分配不同角色，让每种节点专注于特定职责。这种设计源于大规模集群的运维经验——当集群有上百个节点时，把所有职责放在一个进程里会导致资源竞争。

| 角色 | 职责 | 配置 |
|------|------|------|
| master | 管理集群状态、分配分片 | `node.roles: [master]` |
| data | 存储数据、执行搜索聚合 | `node.roles: [data]` |
| coordinating | 接收请求、路由、汇聚结果 | `node.roles: []` |
| ingest | 文档写入前的预处理 | `node.roles: [ingest]` |

Data 节点还可以细分冷热分离：

```yaml
# 热节点：SSD 存储
node.roles: [data_hot, data_content]
# 冷节点：普通磁盘
node.roles: [data_cold]
```

小型集群中一个节点可以承担多种角色 `[master, data, ingest]`，适合开发环境和少于 10 个节点的集群。

## 实验：索引与分片

索引的数据被水平拆分到多个分片中。每个分片是一个独立的 Lucene 索引。

```python
from elasticsearch import Elasticsearch

es = Elasticsearch("http://localhost:9200")

index_body = {
    "settings": {
        "number_of_shards": 3,
        "number_of_replicas": 1,
        "analysis": {
            "analyzer": {
                "product_analyzer": {
                    "type": "custom",
                    "tokenizer": "ik_max_word",
                    "filter": ["lowercase"]
                }
            }
        }
    },
    "mappings": {
        "properties": {
            "name": {
                "type": "text",
                "analyzer": "product_analyzer",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 256}}
            },
            "price": {"type": "float"},
            "category": {"type": "keyword"},
            "brand": {"type": "keyword"},
            "description": {"type": "text", "analyzer": "product_analyzer"},
        }
    }
}

if not es.indices.exists(index="products"):
    es.indices.create(index="products", body=index_body)
```

主分片数量在索引创建时确定，之后**不能修改**。因为文档路由公式 `shard = hash(_routing) % number_of_primary_shards` 依赖于分片数量，修改分片数会导致所有已存储文档的路由失效。

### 分片数量规划

| 因素 | 建议 |
|------|------|
| 单个分片大小 | 10-50GB（推荐 30GB） |
| 单节点分片数 | 不超过 20 个 |
| 每个分片内存开销 | 约 1MB 堆内存 |

```python
def estimate_shard_count(estimated_size_gb, growth_rate=1.5):
    target_size_gb = 30
    total_size = estimated_size_gb * growth_rate
    return max(1, int(total_size / target_size_gb) + 1)

print(estimate_shard_count(200))  # 11
```

### 副本

每个主分片可以有零个或多个副本分片。副本提供两个作用：高可用（主分片丢失时副本自动提升）和提升查询吞吐量（搜索请求可以并行发送到主分片和副本）。

```
         Node 1        Node 2        Node 3
        ┌──────┐      ┌──────┐      ┌──────┐
Shard 0 │  P0  │      │  R0  │      │      │
        ├──────┤      ├──────┤      ├──────┤
Shard 1 │  R1  │      │  P1  │      │      │
        ├──────┤      ├──────┤      ├──────┤
Shard 2 │      │      │  R2  │      │  P2  │
        └──────┘      └──────┘      └──────┘
```

副本分片不能与主分片在同一节点，否则节点宕机会同时丢失两者。

## 文档路由

写入文档时，ES 用 `shard = hash(_routing) % number_of_primary_shards` 决定存到哪个分片。默认 `_routing` 是文档的 `_id`。

自定义路由可以让相关文档集中在同一分片，提升查询效率：

```python
def create_order(es, user_id, order_data):
    return es.index(
        index="orders",
        document={"user_id": user_id, "product": order_data["product"]},
        routing=user_id  # 同一用户的订单在同一分片
    )

def get_user_orders(es, user_id):
    return es.search(
        index="orders",
        body={"query": {"term": {"user_id": user_id}}},
        routing=user_id  # 只查询一个分片
    )
```

路由的代价：数据分布不均（某个用户大量订单导致分片倾斜）、跨分片查询受限。

## 故障转移

### 主节点故障

1. 其他 master-eligible 节点检测到心跳超时（默认 30 秒）
2. 发起主节点选举，获得多数票的节点成为新主节点
3. 新主节点从集群状态中恢复元数据

### 数据节点故障

1. Master 检测到节点离线
2. 将该节点上丢失的副本分片提升为主分片
3. 在其他节点上重新分配新的副本分片
4. 集群状态经历 green → yellow → green

## 实验：集群监控

```python
def cluster_monitor(es):
    health = es.cluster.health()
    report = {
        "status": health["status"],
        "nodes": health["number_of_nodes"],
        "active_shards": health["active_shards"],
        "unassigned_shards": health["unassigned_shards"],
    }
    if health["unassigned_shards"] > 0:
        print(f"警告: {health['unassigned_shards']} 个分片未分配")
    return report


def check_shard_balance(es, index):
    shards = es.cat.shards(index=index, format="json")
    primary_shards = [s for s in shards
                      if s.get("prirep") == "p" and s.get("state") == "STARTED"]
    doc_counts = [int(s.get("docs", 0)) for s in primary_shards]
    if not doc_counts:
        return
    avg = sum(doc_counts) / len(doc_counts)
    max_dev = max(abs(d - avg) for d in doc_counts) / avg * 100
    print(f"分片文档数: {doc_counts}, 最大偏差: {max_dev:.1f}%")
    if max_dev > 50:
        print("警告: 数据分布严重不均")
```

## 常见误区

**分片越多越好。** 每个分片都有内存和文件句柄开销。过多分片会导致堆内存耗尽和搜索变慢。

**副本越多越安全。** 副本写入是同步的，过多副本会降低写入速度。通常 1-2 个副本足够。

**主分片数可以随时修改。** 主分片数在索引创建后**不可更改**。必须提前规划好数据量增长。

**master 节点需要高配置。** master 节点只管理集群元数据，3 个轻量级 master 节点足够管理大型集群。

## 工程建议

- 生产环境至少 3 个 master 节点，避免脑裂
- 分片数按数据量规划：假设每个分片 30GB，300GB 数据需要 10 个主分片
- 冷热分离：热数据放 SSD，冷数据放 HDD，用 ILM 自动管理数据迁移
- 使用专用协调节点：集群超过 10 个节点时，部署 2-3 个 coordinating-only 节点

## 练习

### 练习一：集群规划

为日志系统设计 ES 集群：每天新增 50GB 日志，保留 30 天，总数据量约 1.5TB。规划主分片数、副本数、节点数量和角色分配。

### 练习二：分片验证

使用 REST API 创建 `test_index` 索引（2 个主分片、1 个副本），写入 5 条文档，查看每条文档被分配到了哪个分片。

```bash
PUT /test_index { "settings": { "number_of_shards": 2, "number_of_replicas": 1 } }
POST /test_index/_doc/1 {"content": "文档1"}
# ... 写入 5 条
GET _cat/shards/test_index?v
```

### 练习三：分片数据分布检测

编写 Python 函数，检测各主分片的文档数分布，如果最大/最小比值超过 2:1 则发出警告。

```python
def check_shard_balance(es_host, index):
    es = Elasticsearch(es_host)
    shards = es.cat.shards(index=index, format="json")
    primary = [s for s in shards if s.get("prirep") == "p" and s.get("state") == "STARTED"]
    counts = [int(s.get("docs", 0)) for s in primary]
    if not counts:
        return
    max_c, min_c = max(counts), max(min(counts), 1)
    ratio = max_c / min_c
    print(f"文档数: {counts}, 比值: {ratio:.2f}")
    if ratio > 2.0:
        print("警告: 数据分布不均")
```

## 参考答案

### 练习一

- 主分片数：40（每个约 37.5GB）
- 副本数：1
- 3 个 master 节点 + 6 个 data 节点 + 2 个 coordinating 节点

日志场景是写入密集型，需关注 data 节点的磁盘 I/O。可用 ILM 策略自动删除 30 天前的旧索引。

### 练习三

完整实现见上方代码。数据分布不均可能是自定义路由导致的，可以用 `_cluster/reroute` API 手动迁移分片。
