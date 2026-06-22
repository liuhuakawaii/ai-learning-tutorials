# Elasticsearch 架构

## 场景引入

你在一家电商公司负责搜索服务。随着商品数量增长到数千万条，单台服务器已经无法承载这么大的索引——磁盘空间不够，查询延迟从 50ms 飙升到 2 秒以上。你需要把搜索服务扩展到多台机器上，但又不想手动把查询分发到不同服务器再合并结果。

Elasticsearch 就是为解决这个问题而设计的。它是一个天然分布式的搜索引擎，内置了数据分片、副本容错、自动故障转移等能力。理解它的架构，是用好它的第一步。

回到 2010 年，Shay Banon 在开发 Compass（一个 Java 搜索引擎封装库）时遇到了分布式扩展的瓶颈。他决定从零开始构建一个分布式的搜索和分析引擎，这就是 Elasticsearch 的起源。2010 年 2 月发布第一个版本，2012 年成立 Elasticsearch 公司（后更名为 Elastic），到 2024 年 Elastic 已在纽交所上市，全球超过 50% 的开发者在使用它。Elasticsearch 的成功不仅在于搜索能力，更在于它将 Lucene 这个单机搜索引擎库包装成了一个开箱即用的分布式系统。

## 学习目标

完成本课学习后，你将能够：

1. 理解 Elasticsearch 集群的核心组件：集群、节点、索引、分片、副本
2. 区分不同节点角色的职责：master、data、coordinating
3. 使用 REST API 查看和管理集群状态
4. 根据业务规模规划分片和副本策略
5. 理解文档路由机制及其对查询性能的影响
6. 掌握集群故障转移和数据恢复的基本原理

---

## 集群与节点

一个 Elasticsearch 集群（cluster）由多个节点（node）组成。每个节点是一个运行中的 Elasticsearch 进程。集群通过集群名称（cluster.name）来标识，只有相同集群名称的节点才能加入同一个集群。

```
┌─────────────────────────────────────────────────────────┐
│                    ES Cluster: my-search                 │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Node 1     │  │   Node 2     │  │   Node 3     │  │
│  │  (master)    │  │  (data)      │  │  (data)      │  │
│  │              │  │              │  │              │  │
│  │ 管理集群状态  │  │ 存储数据分片  │  │ 存储数据分片  │  │
│  │ 不存储数据    │  │ 执行搜索     │  │ 执行搜索     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

查看集群健康状态：

```bash
GET _cluster/health
```

返回结果：

```json
{
  "cluster_name": "my-search",
  "status": "green",
  "number_of_nodes": 3,
  "active_primary_shards": 5,
  "active_shards": 10,
  "relocating_shards": 0,
  "initializing_shards": 0,
  "unassigned_shards": 0
}
```

集群状态有三种：`green`（所有分片正常）、`yellow`（主分片正常但副本未分配）、`red`（有主分片丢失）。

用 Python 查询集群健康状态：

```python
from elasticsearch import Elasticsearch

es = Elasticsearch("http://localhost:9200")

health = es.cluster.health()
print(f"集群名称: {health['cluster_name']}")
print(f"状态: {health['status']}")
print(f"节点数: {health['number_of_nodes']}")
print(f"活跃主分片: {health['active_primary_shards']}")
print(f"活跃分片总数: {health['active_shards']}")
print(f"未分配分片: {health['unassigned_shards']}")

if health['status'] == 'red':
    print("警告: 集群处于 RED 状态，有数据丢失风险！")
elif health['status'] == 'yellow':
    print("注意: 集群处于 YELLOW 状态，副本未完全分配。")
```

### 节点发现机制

Elasticsearch 使用 Zen Discovery 机制让节点互相发现并加入集群。在 Elasticsearch 7.x 之后，内置了基于 seed hosts 的发现机制：

```yaml
# elasticsearch.yml
cluster.name: my-search
discovery.seed_hosts:
  - 192.168.1.10
  - 192.168.1.11
  - 192.168.1.12
cluster.initial_master_nodes:
  - node-1
  - node-2
  - node-3
```

在生产环境中，`cluster.initial_master_nodes` 只在首次启动集群时需要，集群形成后应从配置中移除，避免后续扩容时产生脑裂问题。

---

## 节点角色

Elasticsearch 支持为节点分配不同角色，让每种节点专注于特定职责。这种角色分离的设计源于大规模集群的运维经验——当集群有上百个节点时，把所有职责放在一个进程里会导致资源竞争和管理复杂度爆炸。

### Master 节点

负责集群级别的管理操作：创建/删除索引、分配分片、处理节点加入/离开。Master 节点不存储数据，资源消耗低。

```yaml
# elasticsearch.yml
node.roles: [master]
```

Master 节点通过选举产生。在 7.x 之前使用 Bully 算法的变体，7.x 之后改用基于 Raft 协议的选举机制，选举过程更可靠。生产环境中应部署奇数个 master 节点（通常 3 个），通过 `discovery.zen.minimum_master_nodes`（7.x 之前）或内置的仲裁机制避免脑裂。

### Data 节点

存储数据分片，执行 CRUD 操作和搜索聚合。Data 节点是资源消耗最大的节点，需要大磁盘和充足内存。

```yaml
node.roles: [data]
```

Data 节点还可以细分为：
- `data_hot`：存放热数据，需要 SSD 存储
- `data_warm`：存放温数据，可以使用普通磁盘
- `data_cold`：存放冷数据，可以使用廉价对象存储
- `data_content`：存放非时序数据

```yaml
# 冷热分离架构示例
# 热节点
node.roles: [data_hot, data_content]
# 冷节点
node.roles: [data_cold]
```

### Coordinating 节点

既不存储数据也不管理集群，只负责接收客户端请求并将请求路由到正确的节点，然后汇总结果返回给客户端。大型集群中通常部署专门的协调节点。

```yaml
node.roles: []
# 不指定任何角色即为 coordinating-only 节点
```

### Ingest 节点

负责在文档写入前执行预处理管道（pipeline），如字段转换、数据清洗、地理位置解析等。

```yaml
node.roles: [ingest]
```

```python
# 使用 pipeline 预处理文档
from elasticsearch import Elasticsearch

es = Elasticsearch("http://localhost:9200")

# 创建一个 ingest pipeline
es.ingest.put_pipeline(id="enrich_logs", body={
    "description": "日志预处理管道",
    "processors": [
        {"grok": {"field": "message", "patterns": ["%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:msg}"]}},
        {"date": {"field": "timestamp", "formats": ["ISO8601"]}},
        {"set": {"field": "processed", "value": True}}
    ]
})

# 写入文档时使用 pipeline
es.index(index="logs", document={
    "message": "2024-01-15T10:30:00Z ERROR Connection refused"
}, pipeline="enrich_logs")
```

### 混合角色

小型集群中，一个节点可以承担多种角色：

```yaml
node.roles: [master, data, ingest]
```

这种配置适合开发环境和小型集群（少于 10 个节点）。当集群规模增长后，应逐步拆分为专用节点。

```
┌─────────────────────────────────────────────────────────────┐
│                      请求处理流程                            │
│                                                             │
│  Client ──→ Coordinating Node ──→ Data Node (分片1)         │
│                 │                    Data Node (分片2)       │
│                 │                    Data Node (分片3)       │
│                 │                                           │
│                 ←── 汇聚结果 ←─────────────────────────────  │
└─────────────────────────────────────────────────────────────┘
```

---

## 索引与分片

### 索引（Index）

索引是 Elasticsearch 中最大的逻辑单元，类似于关系数据库中的"数据库"。一个索引包含一组具有相似结构的文档。

```bash
# 创建索引
PUT /products
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "name": { "type": "text", "analyzer": "ik_max_word" },
      "price": { "type": "float" },
      "category": { "type": "keyword" }
    }
  }
}
```

用 Python 创建索引：

```python
from elasticsearch import Elasticsearch

es = Elasticsearch("http://localhost:9200")

index_body = {
    "settings": {
        "number_of_shards": 3,
        "number_of_replicas": 1,
        "refresh_interval": "1s",
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
            "created_at": {"type": "date", "format": "yyyy-MM-dd HH:mm:ss||yyyy-MM-dd||epoch_millis"}
        }
    }
}

if not es.indices.exists(index="products"):
    es.indices.create(index="products", body=index_body)
    print("索引 products 创建成功")
else:
    print("索引 products 已存在")
```

### 分片（Shard）

索引的数据被水平拆分到多个分片中。每个分片是一个独立的 Lucene 索引，可以分布在集群的任意节点上。

```
┌────────────────────────────────────────────────────────┐
│                  Index: products                        │
│                                                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │  Shard 0   │  │  Shard 1   │  │  Shard 2   │       │
│  │  (Node 1)  │  │  (Node 2)  │  │  (Node 3)  │       │
│  │  doc_1     │  │  doc_2     │  │  doc_3     │       │
│  │  doc_4     │  │  doc_5     │  │  doc_6     │       │
│  └────────────┘  └────────────┘  └────────────┘       │
│                                                        │
│  每个分片是独立的 Lucene 实例，存储约 1/N 的数据         │
└────────────────────────────────────────────────────────┘
```

主分片数量在索引创建时确定，之后**不能修改**。这是最关键的架构决策之一。为什么不能修改？因为文档的路由公式 `shard = hash(_routing) % number_of_primary_shards` 依赖于分片数量，修改分片数会导致所有已存储文档的路由失效。

### 分片数量规划

分片数量需要综合考虑以下因素：

| 因素 | 建议 |
|------|------|
| 单个分片大小 | 10-50GB（推荐 30GB） |
| 分片数量上限 | 单节点不超过 20 个分片 |
| 内存开销 | 每个分片约消耗 1MB 堆内存 |
| 写入吞吐量 | 分片越多，并行写入能力越强 |
| 查询延迟 | 分片越多，汇聚开销越大 |

```python
def estimate_shard_count(estimated_size_gb, growth_rate=1.5):
    """估算分片数量

    Args:
        estimated_size_gb: 预估数据量（GB）
        growth_rate: 增长倍数，预留空间

    Returns:
        推荐的主分片数
    """
    target_size_gb = 30  # 单个分片目标大小
    total_size = estimated_size_gb * growth_rate
    shard_count = max(1, int(total_size / target_size_gb) + 1)
    return shard_count

# 电商场景：预计 200GB 数据，预留 1.5 倍空间
shards = estimate_shard_count(200)
print(f"推荐分片数: {shards}")  # 输出: 推荐分片数: 11
```

### 副本（Replica）

每个主分片可以有零个或多个副本分片。副本分片是主分片的完整拷贝，提供两个作用：

1. **高可用**：主分片所在节点宕机时，副本自动提升为主分片
2. **提升查询吞吐量**：搜索请求可以并行发送到主分片和副本分片

```
┌─────────────────────────────────────────────────────────────┐
│                   分片与副本分布                              │
│                                                             │
│            Node 1        Node 2        Node 3               │
│           ┌──────┐      ┌──────┐      ┌──────┐             │
│  Shard 0  │  P0  │      │  R0  │      │      │             │
│           ├──────┤      ├──────┤      ├──────┤             │
│  Shard 1  │  R1  │      │  P1  │      │      │             │
│           ├──────┤      ├──────┤      ├──────┤             │
│  Shard 2  │      │      │  R2  │      │  P2  │             │
│           └──────┘      └──────┘      └──────┘             │
│                                                             │
│  P = Primary (主分片)    R = Replica (副本分片)              │
└─────────────────────────────────────────────────────────────┘
```

查看分片分配情况：

```bash
GET _cat/shards/products?v
```

输出示例：

```
index    shard prirep state   docs  store node
products 0     p      STARTED  500 2.1gb node-1
products 0     r      STARTED  500 2.1gb node-2
products 1     p      STARTED  480 2.0gb node-2
products 1     r      STARTED  480 2.0gb node-3
products 2     p      STARTED  520 2.2gb node-3
products 2     r      STARTED  520 2.2gb node-1
```

用 Python 查看分片分配：

```python
from elasticsearch import Elasticsearch

es = Elasticsearch("http://localhost:9200")

# 查看分片分配
shards = es.cat.shards(index="products", v=True)
print(shards)

# 解析分片信息
for line in shards.strip().split('\n')[1:]:
    parts = line.split()
    index, shard_id, shard_type, state, docs, store, node = parts[:7]
    print(f"索引: {index}, 分片: {shard_id}, 类型: {shard_type}, "
          f"状态: {state}, 文档数: {docs}, 存储: {store}, 节点: {node}")
```

---

## 文档路由

当写入一条文档时，Elasticsearch 如何决定它应该存到哪个分片？

```
shard_num = hash(_routing) % number_of_primary_shards
```

默认情况下 `_routing` 就是文档的 `_id`。这意味着同一个文档始终路由到同一个分片，确保查询时不需要扫描所有分片。

```bash
# 写入文档时查看路由信息
POST /products/_doc?routing=electronics
{
  "name": "机械键盘",
  "price": 399,
  "category": "electronics"
}
```

自定义路由可以让相关文档集中在同一分片，提升查询效率。例如按用户 ID 路由，让同一用户的订单都在一个分片上。

```python
from elasticsearch import Elasticsearch

es = Elasticsearch("http://localhost:9200")

# 使用自定义路由写入订单
def create_order(es, user_id, order_data):
    """按用户ID路由订单，同一用户的订单集中在同一分片"""
    return es.index(
        index="orders",
        document={
            "user_id": user_id,
            "product": order_data["product"],
            "amount": order_data["amount"],
            "created_at": order_data["created_at"]
        },
        routing=user_id
    )

# 查询时使用相同路由，只扫描一个分片
def get_user_orders(es, user_id, page=1, page_size=20):
    """查询指定用户的订单，使用路由优化"""
    response = es.search(
        index="orders",
        body={
            "query": {"term": {"user_id": user_id}},
            "sort": [{"created_at": "desc"}],
            "from": (page - 1) * page_size,
            "size": page_size
        },
        routing=user_id  # 只查询路由到的分片
    )
    return {
        "total": response["hits"]["total"]["value"],
        "orders": [hit["_source"] for hit in response["hits"]["hits"]]
    }
```

### 路由的代价

自定义路由虽然能提升查询性能，但也带来了一些问题：

1. **数据分布不均**：如果某个用户有大量订单，会导致分片数据倾斜
2. **跨分片查询受限**：使用路由后，必须在查询时指定相同的路由值，否则会遗漏数据
3. **聚合受限**：全局聚合需要扫描所有分片，路由无法优化

```python
def check_shard_distribution(es, index):
    """检查分片数据分布是否均匀"""
    shards = es.cat.shards(index=index, format="json")
    doc_counts = [int(s["docs"]) for s in shards if s["prirep"] == "p"]
    if not doc_counts:
        return
    avg = sum(doc_counts) / len(doc_counts)
    max_deviation = max(abs(d - avg) for d in doc_counts) / avg * 100
    print(f"分片文档数: {doc_counts}")
    print(f"平均: {avg:.0f}, 最大偏差: {max_deviation:.1f}%")
    if max_deviation > 50:
        print("警告: 数据分布严重不均，考虑调整路由策略")
```

---

## 集群健康检查 API

```bash
# 查看集群整体健康状态
GET _cluster/health

# 查看指定索引的健康状态
GET _cluster/health/products

# 查看节点信息
GET _cat/nodes?v

# 查看所有索引
GET _cat/indices?v

# 查看分片分配
GET _cat/allocation?v
```

用 Python 实现集群监控：

```python
from elasticsearch import Elasticsearch
import time

def cluster_monitor(es_host):
    """集群健康监控"""
    es = Elasticsearch(es_host)
    health = es.cluster.health()
    nodes = es.cat.nodes(format="json")
    indices = es.cat.indices(format="json")

    report = {
        "cluster_status": health["status"],
        "nodes_count": health["number_of_nodes"],
        "active_shards": health["active_shards"],
        "unassigned_shards": health["unassigned_shards"],
        "nodes": []
    }

    for node in nodes:
        report["nodes"].append({
            "name": node.get("name", "unknown"),
            "ip": node.get("ip", "unknown"),
            "heap_used": node.get("heap.percent", "N/A"),
            "ram_used": node.get("ram.percent", "N/A"),
            "cpu": node.get("cpu", "N/A"),
            "load_1m": node.get("load_1m", "N/A")
        })

    if health["unassigned_shards"] > 0:
        allocation = es.cluster.allocation_explain()
        print(f"分片分配问题: {allocation}")

    return report

report = cluster_monitor("http://localhost:9200")
print(f"集群状态: {report['cluster_status']}")
print(f"节点数: {report['nodes_count']}")
print(f"未分配分片: {report['unassigned_shards']}")
```

---

## 故障转移机制

Elasticsearch 的故障转移是自动的，理解其工作原理对运维至关重要。

### 主节点故障

当主节点宕机时：

1. 其他 master-eligible 节点检测到心跳超时（默认 30 秒）
2. 发起主节点选举，获得多数票的节点成为新主节点
3. 新主节点从集群状态中恢复元数据
4. 如果有分片的主副本丢失，将副本提升为主分片

```python
from elasticsearch import Elasticsearch

es = Elasticsearch("http://localhost:9200")

def check_master_status(es):
    """检查主节点状态"""
    master = es.cat.master(format="json")
    print(f"当前主节点: {master[0].get('name', 'unknown')} ({master[0].get('node', 'unknown')})")

    health = es.cluster.health()
    if health["status"] == "red":
        print("严重: 集群 RED，有数据丢失风险")
        # 查看哪些分片未分配
        shards = es.cat.shards(format="json")
        for s in shards:
            if s.get("state") == "UNASSIGNED":
                print(f"  未分配分片: {s.get('index')} shard {s.get('shard')} ({s.get('prirep')})")

check_master_status(es)
```

### 数据节点故障

当数据节点宕机时：

1. Master 检测到节点离线
2. 将该节点上丢失的副本分片提升为主分片（如果有的话）
3. 在其他节点上重新分配新的副本分片
4. 集群状态经历 green → yellow → green 的过程

```python
def simulate_node_failure_recovery(es, index):
    """模拟节点故障恢复过程的监控"""
    import time

    initial_health = es.cluster.health(index=index)
    print(f"初始状态: {initial_health['status']}")
    print(f"活跃分片: {initial_health['active_shards']}")

    # 关闭一个节点后观察状态变化
    # 注意: 这只是监控代码，实际关闭节点需要运维操作
    while True:
        health = es.cluster.health(index=index)
        print(f"状态: {health['status']}, "
              f"活跃: {health['active_shards']}, "
              f"初始化中: {health['initializing_shards']}, "
              f"未分配: {health['unassigned_shards']}")

        if health["status"] == "green":
            print("恢复完成!")
            break
        time.sleep(5)
```

---

## 常见误区

1. **分片越多越好**：每个分片都有内存和文件句柄开销。过多分片会导致堆内存耗尽和搜索变慢。一般建议单个分片大小在 10-50GB 之间。一个节点上分片数不应超过 20 个。

2. **副本越多越安全**：副本写入是同步的，过多副本会降低写入速度。通常 1-2 个副本足够。写入密集型场景可以考虑 0 副本，通过其他方式保障数据安全。

3. **主分片数可以随时修改**：主分片数在索引创建后**不可更改**。必须提前规划好数据量增长。如果需要修改，只能创建新索引并用 Reindex API 迁移数据。

4. **master 节点需要高配置**：master 节点只管理集群元数据，不需要大磁盘和高 CPU。3 个专用的轻量级 master 节点足够管理大型集群。

5. **节点越多性能越好**：节点间通信有网络开销。如果单个查询需要跨过多节点汇聚结果，网络延迟可能抵消分布式带来的收益。

6. **忽略分片分配策略**：默认分片分配不考虑节点负载。应配置 `cluster.routing.allocation.balance.shard` 等参数控制分片分布。

7. **混合角色节点资源竞争**：在大型集群中，master 和 data 混合部署可能导致 GC 暂停影响集群管理。

---

## 工程建议

1. **生产环境至少 3 个 master 节点**：避免脑裂（split-brain）问题。discovery.zen.minimum_master_nodes 应设为 (master_count/2 + 1)。

2. **分片数按数据量规划**：假设每个分片 30GB，如果预计数据量 300GB，则需要 10 个主分片。留出 20% 余量。

3. **冷热分离架构**：热数据放 SSD 节点，冷数据放 HDD 节点，用 ILM（Index Lifecycle Management）自动管理数据迁移。

```python
# ILM 策略示例
es.ilm.put_lifecycle(name="log_policy", body={
    "policy": {
        "phases": {
            "hot": {
                "actions": {
                    "rollover": {"max_size": "50gb", "max_age": "1d"}
                }
            },
            "warm": {
                "min_age": "7d",
                "actions": {
                    "shrink": {"number_of_shards": 1},
                    "forcemerge": {"max_num_segments": 1}
                }
            },
            "delete": {
                "min_age": "30d",
                "actions": {"delete": {}}
            }
        }
    }
})
```

4. **监控集群状态**：定期检查 `_cluster/health` 和 `_cat/allocation`，关注 unassigned_shards 和 initializing_shards。

5. **使用专用协调节点**：当集群规模超过 10 个节点时，部署 2-3 个 coordinating-only 节点来分担聚合汇总工作。

6. **配置分片分配感知**：跨机架/可用区部署时，使用 `cluster.routing.allocation.awareness.attributes` 确保主副本分片分布在不同故障域。

```yaml
# elasticsearch.yml - 跨可用区部署
node.attr.zone: zone-a
cluster.routing.allocation.awareness.attributes: zone
```

---

## 小结

Elasticsearch 的分布式架构围绕几个核心概念展开：集群包含节点，节点承载分片，分片存储文档。Master 节点管理集群状态，Data 节点存储和处理数据，Coordinating 节点负责请求路由和结果汇聚。主分片数在索引创建时确定不可更改，副本数可以动态调整。文档路由决定了数据如何分布在分片上，理解路由机制对查询优化至关重要。故障转移是自动的，但需要合理规划节点角色和分片策略来确保高可用。理解这些基础架构概念，是后续学习查询执行、索引策略和性能优化的前提。

---

## 练习

### 练习一：集群规划

假设你要为一个日志系统设计 ES 集群。预计每天新增 50GB 日志数据，保留 30 天，总数据量约 1.5TB。请规划：主分片数、副本数、节点数量和角色分配。

### 练习二：分片验证

使用 REST API 完成以下操作：创建一个名为 `test_index` 的索引，设置 2 个主分片和 1 个副本。写入 5 条测试文档，然后查看每条文档被分配到了哪个分片。

### 练习三：故障模拟

解释以下场景会发生什么：一个 3 节点集群中，存储主分片的节点突然宕机，集群有 1 个副本。描述集群状态的变化过程。

### 练习四：分片数据分布检测

编写 Python 函数，接收索引名，检测各主分片的文档数分布，如果最大分片与最小分片的文档数比值超过 2:1 则发出警告。

### 练习五：集群容量评估

给定以下参数：每条文档平均 2KB，每天写入 100 万条，保留 90 天，副本数 1。计算需要的总存储空间、推荐的分片数和节点数。

---

## 参考答案

### 练习一

**思路**：按照单个分片 30-50GB 的最佳实践来规划。1.5TB 数据，按 40GB/分片计算约需 40 个主分片。考虑查询性能和写入吞吐量的平衡。

**答案**：
- 主分片数：40（每个约 37.5GB，留有一定余量）
- 副本数：1（日志数据对可用性要求不算极高，1 个副本够用）
- 节点规划：
  - 3 个 master 节点（轻量级，保障集群管理高可用）
  - 6 个 data 节点（每个节点承载约 13 个分片，考虑 SSD 存储）
  - 2 个 coordinating 节点（处理客户端查询请求）

**要点**：
- 日志场景是写入密集型，需关注 data 节点的磁盘 I/O
- 可使用 ILM 策略自动删除 30 天前的旧索引
- 副本数可根据 SLA 要求调整为 0 来降低存储成本

### 练习二

**思路**：通过 PUT 创建索引，POST 写入文档，用 `_search_shards` 或 `_cat/shards` 查看分片分配。

**答案**：

```bash
# 创建索引
PUT /test_index
{
  "settings": {
    "number_of_shards": 2,
    "number_of_replicas": 1
  }
}

# 写入文档
POST /test_index/_doc/1 {"content": "文档1"}
POST /test_index/_doc/2 {"content": "文档2"}
POST /test_index/_doc/3 {"content": "文档3"}
POST /test_index/_doc/4 {"content": "文档4"}
POST /test_index/_doc/5 {"content": "文档5"}

# 查看分片分配
GET _cat/shards/test_index?v
```

**要点**：
- 文档的路由公式：`hash(_routing) % number_of_primary_shards`
- 不指定 `_routing` 时默认使用文档 `_id`
- 5 个文档会被分配到 2 个分片中，分配由哈希决定

### 练习三

**思路**：分析主分片丢失后副本提升的过程以及集群状态变化。

**答案**：

1. 节点宕机瞬间，集群状态从 `green` 变为 `yellow`
2. ES 等待短暂时间（默认 1 分钟）确认节点确实不可用
3. 存活节点上的副本分片被提升为主分片
4. 集群重新变为 `green`（因为所有主分片都已恢复）
5. 新的副本会被分配到剩余节点上以重建冗余

**要点**：
- 副本分片不能与主分片在同一节点，否则节点宕机会同时丢失主分片和副本
- 如果只剩 2 个节点，部分分片可能无法分配副本，状态保持 `yellow`
- 数据不会丢失，因为副本是完整的数据拷贝

### 练习四

**思路**：使用 `_cat/shards` API 获取分片信息，解析文档数并计算分布。

**答案**：

```python
from elasticsearch import Elasticsearch

def check_shard_balance(es_host, index):
    es = Elasticsearch(es_host)
    shards = es.cat.shards(index=index, format="json")
    primary_shards = [s for s in shards if s.get("prirep") == "p" and s.get("state") == "STARTED"]

    if not primary_shards:
        print("没有找到已启动的主分片")
        return

    doc_counts = []
    for s in primary_shards:
        count = int(s.get("docs", 0))
        doc_counts.append((s["shard"], count))
        print(f"  分片 {s['shard']}: {count} 文档, 存储: {s.get('store', 'N/A')}")

    counts = [c for _, c in doc_counts]
    max_count = max(counts)
    min_count = min(counts) if min(counts) > 0 else 1
    ratio = max_count / min_count

    print(f"\n最大/最小比值: {ratio:.2f}")
    if ratio > 2.0:
        print(f"警告: 数据分布不均（比值 > 2:1），建议检查路由策略或重建索引")
    else:
        print("数据分布正常")

check_shard_balance("http://localhost:9200", "products")
```

**要点**：
- 数据分布不均可能是自定义路由导致的
- 可以使用 `_cluster/reroute` API 手动迁移分片
- 长期解决方案是调整路由策略或增加分片数

### 练习五

**思路**：计算总数据量，考虑副本倍增，规划分片和节点。

**答案**：

```
每日数据量: 1,000,000 × 2KB = 2GB/天
90 天总量: 2GB × 90 = 180GB（原始数据）
考虑 _source + 倒排索引开销（约 1.5 倍）: 180GB × 1.5 = 270GB
加上副本: 270GB × 2 = 540GB（总存储需求）

推荐分片数: 270GB / 30GB = 9 个主分片（向上取整为 10）
节点数: 10 个分片 × 2（主+副本）= 20 个分片
       每个节点承载 10-15 个分片，需要 2-3 个 data 节点
       加上 3 个 master 节点，共 5-6 个节点
```

**要点**：
- 倒排索引的大小取决于词项数量和文档数量
- 日志场景可以用 ILM 自动清理旧数据，减少存储需求
- 如果写入量大，可以适当增加分片数以提升并行写入能力
