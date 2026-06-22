# 04 - Prompt 缓存与复用

> **课程定位**：Stage 4 生产级 Prompt 工程 · 第 4 课
> **前置要求**：完成 Stage 1-3，了解基础缓存概念和 Embedding
> **预计时长**：90 分钟

---

## 场景引入

你的 AI 客服系统上线三个月后，分析日志发现一个惊人的事实：40% 的用户问题几乎一模一样——"怎么退款""物流单号查一下""密码忘了怎么办"。每次都要花真金白银调用 LLM API，等 2 秒才返回。更糟的是，有些问题措辞不同但意思相同（"退货流程"和"怎么退东西"），精确匹配缓存根本命中不了。你需要一套多层次的缓存体系，让常见问题秒回、相似问题也能命中。

---

## 学习目标

1. 理解精确匹配缓存与语义缓存的区别
2. 掌握前缀缓存（Prefix Caching）的原理与应用
3. 实现基于 Embedding 的语义缓存系统
4. 设计响应记忆化（Response Memoization）策略
5. 构建多级缓存架构降低 API 成本和延迟

---

## 1. 缓存架构全景

```
┌──────────────────────────────────────────────────────────────────┐
│                    Prompt 缓存架构                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  用户请求                                                         │
│     │                                                            │
│     ▼                                                            │
│  ┌──────────────────────────────────────────┐                   │
│  │            L1: 精确匹配缓存               │                   │
│  │   Key = hash(messages + model + params)  │                   │
│  │   命中率: ~15-25%  延迟: < 1ms           │                   │
│  └─────────┬────────────────────────────────┘                   │
│            │ miss                                                │
│            ▼                                                     │
│  ┌──────────────────────────────────────────┐                   │
│  │            L2: 语义相似缓存               │                   │
│  │   Key = embedding_similarity(query)      │                   │
│  │   命中率: ~10-20%  延迟: < 50ms          │                   │
│  └─────────┬────────────────────────────────┘                   │
│            │ miss                                                │
│            ▼                                                     │
│  ┌──────────────────────────────────────────┐                   │
│  │            L3: 前缀缓存                   │                   │
│  │   共享 System Prompt / Context 前缀      │                   │
│  │   节省: ~20-30% Token  延迟: 无额外      │                   │
│  └─────────┬────────────────────────────────┘                   │
│            │ miss                                                │
│            ▼                                                     │
│  ┌──────────────────────────────────────────┐                   │
│  │            API 调用 → 存入各级缓存        │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                  │
│  总缓存命中率目标: 30-50%                                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. 精确匹配缓存

```python
"""
exact_cache.py
精确匹配缓存 - L1 缓存层
"""

import hashlib
import json
import time
import threading
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from collections import OrderedDict


@dataclass
class CacheStats:
    """缓存统计"""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    total_saved_tokens: int = 0
    total_saved_cost: float = 0.0

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0


class ExactMatchCache:
    """精确匹配缓存"""

    def __init__(self, max_size: int = 5000, ttl_seconds: int = 7200):
        self.max_size = max_size
        self.ttl = ttl_seconds
        self._cache: OrderedDict[str, Dict] = OrderedDict()
        self._lock = threading.Lock()
        self.stats = CacheStats()

    def _make_key(self, messages: List[Dict], model: str,
                  temperature: float = 0.7, max_tokens: int = 2000) -> str:
        """生成精确匹配键"""
        key_data = {
            "messages": [(m["role"], m["content"]) for m in messages],
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        key_str = json.dumps(key_data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(key_str.encode()).hexdigest()

    def get(self, messages: List[Dict], model: str,
            temperature: float = 0.7, max_tokens: int = 2000) -> Optional[Dict]:
        """查询缓存"""
        key = self._make_key(messages, model, temperature, max_tokens)

        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                self.stats.misses += 1
                return None

            if time.time() - entry["created_at"] > self.ttl:
                del self._cache[key]
                self.stats.misses += 1
                return None

            self._cache.move_to_end(key)
            entry["hit_count"] += 1
            self.stats.hits += 1
            self.stats.total_saved_tokens += entry.get("tokens", 0)
            self.stats.total_saved_cost += entry.get("cost", 0.0)

            return {
                "content": entry["content"],
                "from_cache": True,
                "cache_age": time.time() - entry["created_at"],
            }

    def put(self, messages: List[Dict], model: str, content: str,
            temperature: float = 0.7, max_tokens: int = 2000,
            tokens: int = 0, cost: float = 0.0):
        """存入缓存"""
        key = self._make_key(messages, model, temperature, max_tokens)

        with self._lock:
            if len(self._cache) >= self.max_size:
                self._cache.popitem(last=False)
                self.stats.evictions += 1

            self._cache[key] = {
                "content": content,
                "created_at": time.time(),
                "hit_count": 0,
                "tokens": tokens,
                "cost": cost,
            }

    def invalidate(self, messages: List[Dict], model: str,
                   temperature: float = 0.7, max_tokens: int = 2000) -> bool:
        """手动失效缓存条目"""
        key = self._make_key(messages, model, temperature, max_tokens)
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def clear(self):
        """清空缓存"""
        with self._lock:
            self._cache.clear()


# 使用示例
if __name__ == "__main__":
    cache = ExactMatchCache(max_size=1000, ttl_seconds=3600)

    messages = [
        {"role": "system", "content": "你是一个助手"},
        {"role": "user", "content": "什么是机器学习？"},
    ]

    # 首次调用 - miss
    result = cache.get(messages, "gpt-4o-mini")
    print(f"首次: {result}")  # None

    # 存入缓存
    cache.put(messages, "gpt-4o-mini",
              "机器学习是人工智能的一个分支...",
              tokens=150, cost=0.002)

    # 再次调用 - hit
    result = cache.get(messages, "gpt-4o-mini")
    print(f"缓存命中: {result['from_cache']}")
    print(f"命中率: {cache.stats.hit_rate:.1%}")
```

---

## 3. 语义缓存

```python
"""
semantic_cache.py
语义缓存 - 基于 Embedding 相似度的缓存
"""

import hashlib
import json
import time
import numpy as np
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass


class EmbeddingProvider:
    """Embedding 提供者（可替换为不同实现）"""

    def __init__(self, provider: str = "openai", model: str = "text-embedding-3-small"):
        self.provider = provider
        self.model = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            if self.provider == "openai":
                from openai import OpenAI
                self._client = OpenAI()
        return self._client

    def embed(self, text: str) -> List[float]:
        """获取文本的 Embedding 向量"""
        client = self._get_client()
        response = client.embeddings.create(
            model=self.model,
            input=text,
        )
        return response.data[0].embedding

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """批量获取 Embedding"""
        client = self._get_client()
        response = client.embeddings.create(
            model=self.model,
            input=texts,
        )
        return [item.embedding for item in response.data]


@dataclass
class SemanticCacheEntry:
    """语义缓存条目"""
    query: str
    embedding: List[float]
    response: str
    created_at: float
    hit_count: int = 0
    tokens: int = 0
    cost: float = 0.0


class SemanticCache:
    """语义缓存 - 基于向量相似度"""

    def __init__(self, similarity_threshold: float = 0.92,
                 max_size: int = 2000,
                 ttl_seconds: int = 86400):
        self.threshold = similarity_threshold
        self.max_size = max_size
        self.ttl = ttl_seconds
        self._entries: List[SemanticCacheEntry] = []
        self.embedding_provider = EmbeddingProvider()

        self.hits = 0
        self.misses = 0

    @staticmethod
    def cosine_similarity(a: List[float], b: List[float]) -> float:
        """计算余弦相似度"""
        a_arr = np.array(a)
        b_arr = np.array(b)
        dot = np.dot(a_arr, b_arr)
        norm = np.linalg.norm(a_arr) * np.linalg.norm(b_arr)
        return float(dot / norm) if norm > 0 else 0.0

    def _extract_query_text(self, messages: List[Dict]) -> str:
        """从消息列表提取查询文本"""
        for msg in reversed(messages):
            if msg["role"] == "user":
                return msg["content"]
        return messages[-1]["content"] if messages else ""

    def get(self, messages: List[Dict], model: str = "") -> Optional[Dict]:
        """语义匹配查询"""
        query_text = self._extract_query_text(messages)
        query_embedding = self.embedding_provider.embed(query_text)

        best_match = None
        best_similarity = 0.0

        for entry in self._entries:
            if time.time() - entry.created_at > self.ttl:
                continue

            similarity = self.cosine_similarity(query_embedding, entry.embedding)
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = entry

        if best_match and best_similarity >= self.threshold:
            best_match.hit_count += 1
            self.hits += 1
            return {
                "content": best_match.response,
                "from_cache": True,
                "similarity": best_similarity,
                "original_query": best_match.query,
            }

        self.misses += 1
        return None

    def put(self, messages: List[Dict], response: str,
            model: str = "", tokens: int = 0, cost: float = 0.0):
        """存入语义缓存"""
        query_text = self._extract_query_text(messages)
        query_embedding = self.embedding_provider.embed(query_text)

        if len(self._entries) >= self.max_size:
            self._entries.sort(key=lambda e: e.hit_count)
            self._entries.pop(0)

        self._entries.append(SemanticCacheEntry(
            query=query_text,
            embedding=query_embedding,
            response=response,
            created_at=time.time(),
            tokens=tokens,
            cost=cost,
        ))

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

    def stats(self) -> Dict:
        return {
            "size": len(self._entries),
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": f"{self.hit_rate:.1%}",
            "threshold": self.threshold,
        }


# 使用示例
if __name__ == "__main__":
    cache = SemanticCache(similarity_threshold=0.90)

    messages = [{"role": "user", "content": "什么是深度学习？"}]

    # 首次 - miss
    result = cache.get(messages)
    print(f"首次: {result}")

    # 存入
    cache.put(messages, "深度学习是机器学习的一个子领域...")

    # 语义相似查询 - 应该命中
    similar_messages = [{"role": "user", "content": "深度学习是什么意思？"}]
    result = cache.get(similar_messages)
    if result:
        print(f"语义命中: 相似度 {result['similarity']:.3f}")
        print(f"原始查询: {result['original_query']}")

    print(f"统计: {cache.stats()}")
```

---

## 4. 前缀缓存

```python
"""
prefix_cache.py
前缀缓存 - 共享系统提示词降低 Token 成本
"""

import hashlib
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class PrefixConfig:
    """前缀配置"""
    name: str
    content: str
    version: str = "1.0"
    model_preferences: Dict[str, str] = field(default_factory=dict)


class PrefixCacheManager:
    """前缀缓存管理器"""

    def __init__(self):
        self._prefixes: Dict[str, PrefixConfig] = {}
        self._usage_stats: Dict[str, int] = {}

    def register(self, config: PrefixConfig):
        """注册可复用前缀"""
        self._prefixes[config.name] = config

    def get_prefix(self, name: str, model: str = "default") -> Optional[str]:
        """获取前缀内容"""
        config = self._prefixes.get(name)
        if not config:
            return None

        self._usage_stats[name] = self._usage_stats.get(name, 0) + 1

        # 检查是否有模型特定版本
        if model in config.model_preferences:
            return config.model_preferences[model]
        return config.content

    def build_messages(self, prefix_name: str, user_message: str,
                       context: Optional[str] = None,
                       model: str = "default") -> List[Dict]:
        """使用前缀构建消息"""
        prefix = self.get_prefix(prefix_name, model)
        messages = [{"role": "system", "content": prefix or ""}]

        if context:
            messages.append({"role": "system", "content": f"参考上下文：\n{context}"})

        messages.append({"role": "user", "content": user_message})
        return messages

    def estimate_savings(self, prefix_name: str,
                         call_count: int) -> Dict:
        """估算前缀缓存节省"""
        config = self._prefixes.get(prefix_name)
        if not config:
            return {"error": "prefix not found"}

        prefix_tokens = len(config.content) // 4
        total_tokens_without = prefix_tokens * call_count
        total_tokens_with = prefix_tokens  # 只发送一次

        return {
            "prefix_tokens": prefix_tokens,
            "calls": call_count,
            "tokens_without_cache": total_tokens_without,
            "tokens_with_cache": total_tokens_with,
            "saved_tokens": total_tokens_without - total_tokens_with,
            "savings_ratio": f"{(1 - total_tokens_with / total_tokens_without):.1%}"
            if total_tokens_without > 0 else "0%",
        }

    def list_prefixes(self) -> List[Dict]:
        """列出所有已注册前缀"""
        return [
            {
                "name": config.name,
                "version": config.version,
                "tokens": len(config.content) // 4,
                "usage": self._usage_stats.get(config.name, 0),
            }
            for config in self._prefixes.values()
        ]


# 使用示例
if __name__ == "__main__":
    manager = PrefixCacheManager()

    # 注册常用前缀
    manager.register(PrefixConfig(
        name="customer_service",
        content="""你是一个专业的客服助手。
规则：
1. 始终保持礼貌和专业
2. 如果不确定答案，告知用户需要转接人工
3. 不要泄露内部系统信息
4. 优先推荐自助解决方案""",
        version="2.1",
    ))

    manager.register(PrefixConfig(
        name="code_review",
        content="""你是一个代码审查专家。
审查要点：
1. 代码质量和可读性
2. 潜在的安全漏洞
3. 性能问题
4. 最佳实践建议""",
    ))

    # 使用前缀
    messages = manager.build_messages(
        "customer_service",
        "我的订单什么时候发货？"
    )
    print(f"消息数: {len(messages)}")
    print(f"系统提示: {messages[0]['content'][:50]}...")

    # 估算节省
    savings = manager.estimate_savings("customer_service", 10000)
    print(f"\n节省分析 (10000次调用):")
    print(f"  节省 Token: {savings['saved_tokens']}")
    print(f"  节省比例: {savings['savings_ratio']}")

    print(f"\n已注册前缀: {manager.list_prefixes()}")
```

---

## 5. 多级缓存管理器

```python
"""
multi_level_cache.py
多级缓存管理器 - 整合 L1/L2/L3 缓存
"""

import time
from typing import Optional, Dict, List
from dataclasses import dataclass


@dataclass
class CacheLayerResult:
    """缓存层查询结果"""
    content: Optional[str]
    layer: str
    hit: bool
    latency_ms: float
    metadata: Dict = None


class MultiLevelCache:
    """多级缓存管理器"""

    def __init__(self, exact_cache=None, semantic_cache=None,
                 prefix_cache=None):
        self.l1_exact = exact_cache
        self.l2_semantic = semantic_cache
        self.l3_prefix = prefix_cache
        self._layer_stats = {
            "l1": {"hits": 0, "misses": 0},
            "l2": {"hits": 0, "misses": 0},
            "l3": {"hits": 0, "misses": 0},
        }

    def get(self, messages: List[Dict], model: str,
            temperature: float = 0.7, max_tokens: int = 2000) -> Optional[Dict]:
        """逐级查询缓存"""

        # L1: 精确匹配
        start = time.perf_counter()
        if self.l1_exact:
            result = self.l1_exact.get(messages, model, temperature, max_tokens)
            latency = (time.perf_counter() - start) * 1000
            if result:
                self._layer_stats["l1"]["hits"] += 1
                result["cache_layer"] = "L1-exact"
                result["latency_ms"] = latency
                return result
            self._layer_stats["l1"]["misses"] += 1

        # L2: 语义匹配
        start = time.perf_counter()
        if self.l2_semantic:
            result = self.l2_semantic.get(messages, model)
            latency = (time.perf_counter() - start) * 1000
            if result:
                self._layer_stats["l2"]["hits"] += 1
                result["cache_layer"] = "L2-semantic"
                result["latency_ms"] = latency
                return result
            self._layer_stats["l2"]["misses"] += 1

        return None

    def put(self, messages: List[Dict], model: str, content: str,
            temperature: float = 0.7, max_tokens: int = 2000,
            tokens: int = 0, cost: float = 0.0):
        """存入所有适用的缓存层"""
        if self.l1_exact:
            self.l1_exact.put(messages, model, content,
                              temperature, max_tokens, tokens, cost)
        if self.l2_semantic:
            self.l2_semantic.put(messages, content, model, tokens, cost)

    def stats(self) -> Dict:
        """获取各层统计"""
        result = {"layers": {}}

        for layer, stats in self._layer_stats.items():
            total = stats["hits"] + stats["misses"]
            result["layers"][layer] = {
                "hits": stats["hits"],
                "misses": stats["misses"],
                "hit_rate": f"{stats['hits'] / total:.1%}" if total > 0 else "N/A",
            }

        total_hits = sum(s["hits"] for s in self._layer_stats.values())
        total_misses = sum(s["misses"] for s in self._layer_stats.values())
        total = total_hits + total_misses
        result["overall"] = {
            "total_hits": total_hits,
            "total_misses": total_misses,
            "hit_rate": f"{total_hits / total:.1%}" if total > 0 else "N/A",
        }

        return result


class CachedLLMClient:
    """带缓存的 LLM 客户端"""

    def __init__(self, llm_client, cache: MultiLevelCache):
        self.client = llm_client
        self.cache = cache

    def chat(self, messages: List[Dict], model: str = "gpt-4o-mini",
             temperature: float = 0.7, max_tokens: int = 2000,
             force_refresh: bool = False) -> Dict:
        """带缓存的聊天调用"""

        # 查缓存
        if not force_refresh:
            cached = self.cache.get(messages, model, temperature, max_tokens)
            if cached:
                return {
                    "content": cached["content"],
                    "from_cache": True,
                    "cache_layer": cached.get("cache_layer", "unknown"),
                    "latency_ms": cached.get("latency_ms", 0),
                }

        # 调用 API
        start = time.perf_counter()
        # response = self.client.chat.completions.create(
        #     model=model, messages=messages,
        #     temperature=temperature, max_tokens=max_tokens,
        # )
        latency = (time.perf_counter() - start) * 1000

        # 模拟响应
        content = "API 响应内容"
        tokens = 100
        cost = 0.001

        # 存入缓存
        self.cache.put(messages, model, content,
                       temperature, max_tokens, tokens, cost)

        return {
            "content": content,
            "from_cache": False,
            "latency_ms": latency,
            "tokens": tokens,
            "cost": cost,
        }


# 使用示例
if __name__ == "__main__":
    from exact_cache import ExactMatchCache
    from semantic_cache import SemanticCache

    cache = MultiLevelCache(
        exact_cache=ExactMatchCache(max_size=1000),
        # semantic_cache=SemanticCache(similarity_threshold=0.90),
    )

    messages = [{"role": "user", "content": "什么是 Python？"}]

    # 模拟调用
    cache.put(messages, "gpt-4o-mini", "Python 是一种编程语言...", tokens=50)

    result = cache.get(messages, "gpt-4o-mini")
    print(f"缓存结果: {result}")
    print(f"统计: {cache.stats()}")
```

---

## 6. 缓存策略对照表

| 缓存类型 | 原理 | 命中率 | 延迟 | 适用场景 |
|---------|------|--------|------|---------|
| 精确匹配 | Hash(key) = value | 15-25% | <1ms | 完全相同的查询 |
| 语义相似 | Embedding 余弦相似度 | 10-20% | <50ms | 意思相近的查询 |
| 前缀缓存 | 共享 System Prompt | N/A | 0ms | 固定系统提示词 |
| 响应记忆 | 预计算常见回答 | 5-10% | <1ms | FAQ 类场景 |

---

## 7. 常见误区

### ❌ 错误 1：缓存键包含温度参数但语义缓存不考虑

```python
# 错误：语义缓存返回了 temperature=0 的结果，但请求 temperature=0.9
# 语义缓存应只用于确定性回答（temperature=0）

# 正确：语义缓存仅在 temperature=0 时启用
if temperature == 0:
    cached = semantic_cache.get(messages)
```

### ❌ 错误 2：缓存过期策略不当

```python
# 错误：TTL 设置太短，缓存几乎没有命中
cache = ExactMatchCache(ttl_seconds=60)  # 1 分钟

# 正确：根据内容稳定性设置 TTL
cache = ExactMatchCache(ttl_seconds=86400)  # 24 小时
```

### ❌ 错误 3：忽略缓存一致性

```python
# 错误：System Prompt 更新后旧缓存仍然生效
# 正确：更新 System Prompt 时清空相关缓存
def update_system_prompt(new_prompt):
    global system_prompt
    system_prompt = new_prompt
    cache.invalidate_by_prefix(old_prefix)
```

---

## 8. 工程建议

1. **缓存键只包含确定性内容**：消息内容、模型名、temperature、max_tokens 可以作为键，但时间戳、请求 ID、随机数等变量绝不能参与缓存键计算。

2. **TTL 设置要匹配内容稳定性**：FAQ 类回答用 24 小时甚至更长，实时数据查询用 5 分钟甚至不缓存。可以按 prompt_name 分别配置 TTL，而不是全局统一。

3. **System Prompt 更新时必须同步清理缓存**：Prompt 改了一个字，旧缓存返回的就是过时结果。建议给每个 Prompt 版本加 hash，版本变更时自动失效关联缓存。

4. **持续监控各层缓存命中率**：L1 精确匹配命中率低于 15% 说明查询多样性高，L2 语义缓存命中率低于 5% 说明相似度阈值需要调低。命中率是缓存系统最重要的健康指标。

---

## 总结

缓存是降低 LLM API 成本和延迟的最有效手段。核心策略是**多级缓存**：精确匹配解决完全相同查询，语义缓存覆盖相似查询，前缀缓存减少重复 Token 传输。关键在于根据业务场景设置合理的 TTL 和相似度阈值。

---

## 练习

### 练习 1：缓存预热器
实现一个 `CacheWarmer`，从历史日志中提取高频查询，批量预填充缓存。

### 练习 2：缓存分析仪表盘
实现一个 `CacheDashboard`，统计并可视化各缓存层的命中率、节省成本、热门查询等指标。

### 练习 3：自适应 TTL
实现一个 `AdaptiveTTLCache`，根据查询的历史更新频率自动调整 TTL——频繁变化的查询短 TTL，稳定的查询长 TTL。


---

**下一课**: [Prompt 监控与告警](./05-Prompt监控与告警.md)
