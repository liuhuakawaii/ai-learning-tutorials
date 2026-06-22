# 01 - RAG 系统的性能优化

```
╔══════════════════════════════════════════════════════════╗
║  Stage 4 · Lesson 1                                     ║
║  RAG 系统的性能优化                                      ║
║  时长: 50 分钟                                          ║
╚══════════════════════════════════════════════════════════╝
```

## 前置要求

- 完成 Stage 3 全部课程
- 熟悉 Python asyncio 编程模型
- 了解 RAG 基本架构（检索 → 增强 → 生成）

## 场景引入

你的 RAG 系统在功能测试中表现完美，但上线后用户抱怨"每次提问要等 5 秒以上才有回复"。性能分析发现，Embedding 调用耗时 200ms，向量检索耗时 150ms，Reranker 耗时 300ms，LLM 生成耗时 3 秒——这些环节串行执行，总延迟轻松突破 4 秒。在生产环境中，用户对响应速度的容忍度远比你想象的低。性能优化不是"锦上添花"，而是决定系统能否上线的关键因素。

## 学习目标

完成本课后，你将能够：

1. **识别 RAG 系统中的性能瓶颈** — 使用 profiling 工具定位延迟来源
2. **优化 Embedding 延迟** — 通过批处理和异步调用减少编码时间
3. **实现并行检索** — 同时查询多个数据源，减少检索阶段总耗时
4. **降低生成延迟** — 使用连接池和流式输出优化 LLM 调用

## 1. RAG 延迟分析

### 1.1 典型 RAG 请求的延迟分布

在优化之前，我们必须先理解时间花在了哪里。以下是一个典型 RAG 请求的延迟分解：

```
RAG 请求延迟分解 (总计 ~3200ms)
═══════════════════════════════════════════════════════════════════

用户查询
  │
  ├─ 1. Query Embedding          ████░░░░░░░░░░░░░░░░░░░░  150ms  (5%)
  │     将用户问题转换为向量
  │
  ├─ 2. Vector Search            ████████░░░░░░░░░░░░░░░░  400ms  (12%)
  │     在向量数据库中检索 Top-K
  │
  ├─ 3. Metadata Filtering       ██░░░░░░░░░░░░░░░░░░░░░░  100ms  (3%)
  │     后过滤和重排序
  │
  ├─ 4. Context Assembly         █░░░░░░░░░░░░░░░░░░░░░░░   50ms  (2%)
  │     拼接检索结果为 Prompt
  │
  ├─ 5. LLM Generation           ██████████████████░░░░░░ 2200ms  (69%)
  │     GPT-4 生成回答
  │     ├── Time to First Token   ████░░░░░░░░░░░░░░░░░░░  500ms
  │     ├── Token Generation      ██████████████░░░░░░░░░ 1500ms
  │     └── Post-processing       ██░░░░░░░░░░░░░░░░░░░░░  200ms
  │
  └─ 6. Response Serialization   █░░░░░░░░░░░░░░░░░░░░░░   30ms  (1%)
        序列化 JSON 响应

═══════════════════════════════════════════════════════════════════
```

### 1.2 优化机会总览

```
优化优先级矩阵 (影响力 vs 实现难度)
═══════════════════════════════════════════════════════════════════

高  │  ┌─────────────┐    ┌─────────────┐
影  │  │ 并行检索     │    │ 连接池      │
响  │  │ ★★★★★       │    │ ★★★★        │
力  │  │ 难度: 中      │    │ 难度: 低     │
    │  └─────────────┘    └─────────────┘
    │
    │  ┌─────────────┐    ┌─────────────┐
    │  │ 批量Embedding│    │ 流式生成     │
    │  │ ★★★★        │    │ ★★★★★       │
    │  │ 难度: 低      │    │ 难度: 中     │
    │  └─────────────┘    └─────────────┘
低  │
影  │  ┌─────────────┐
响  │  │ 硬件升级     │
力  │  │ ★★          │
    │  │ 难度: 低     │
    │  └─────────────┘
    └──────────────────────────────────────
      低实现难度              高实现难度
```

## 2. Profiling RAG 系统

### 2.1 使用 cProfile 定位瓶颈

```python
import cProfile
import pstats
from io import StringIO
from typing import Any

class RAGProfiler:
    """RAG 系统性能分析器"""

    def __init__(self):
        self.profiler = cProfile.Profile()
        self.timings: dict[str, float] = {}

    def profile_query(self, rag_pipeline, query: str) -> dict[str, float]:
        """对单次 RAG 查询进行性能分析"""
        self.profiler.enable()
        result = rag_pipeline.query(query)
        self.profiler.disable()

        stats = pstats.Stats(self.profiler, stream=StringIO())
        stats.sort_stats("cumulative")

        return self._extract_timings(stats)

    def _extract_timings(self, stats: pstats.Stats) -> dict[str, float]:
        """提取各函数的累计耗时"""
        timings = {}
        for key, value in stats.stats.items():
            func_name = f"{key[0]}:{key[1]}({key[2]})"
            cumtime = value[3]  # cumulative time
            if cumtime > 0.001:  # 只保留 > 1ms 的
                timings[func_name] = round(cumtime * 1000, 2)
        return timings
```

### 2.2 手动计时装饰器

```python
import time
import functools
from typing import Callable, Any
from contextlib import contextmanager

@contextmanager
def timer(label: str):
    """上下文管理器式计时"""
    start = time.perf_counter()
    yield lambda: (time.perf_counter() - start) * 1000
    elapsed = (time.perf_counter() - start) * 1000
    print(f"[{label}] {elapsed:.1f}ms")

def timed(func: Callable) -> Callable:
    """装饰器式计时，自动记录到日志"""
    @functools.wraps(func)
    async def async_wrapper(*args, **kwargs) -> Any:
        start = time.perf_counter()
        result = await func(*args, **kwargs)
        elapsed = (time.perf_counter() - start) * 1000
        print(f"[{func.__name__}] {elapsed:.1f}ms")
        return result

    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs) -> Any:
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = (time.perf_counter() - start) * 1000
        print(f"[{func.__name__}] {elapsed:.1f}ms")
        return result

    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    return sync_wrapper

# 使用示例
import asyncio

class TimedRAGPipeline:
    """带计时的 RAG Pipeline"""

    @timed
    async def embed_query(self, query: str) -> list[float]:
        # ... embedding 逻辑
        pass

    @timed
    async def search_vectors(self, embedding: list[float], top_k: int) -> list[dict]:
        # ... 检索逻辑
        pass

    @timed
    async def generate_answer(self, query: str, context: str) -> str:
        # ... LLM 调用
        pass

    async def query(self, question: str) -> dict:
        with timer("total_query"):
            embedding = await self.embed_query(question)
            results = await self.search_vectors(embedding, top_k=5)
            context = "\n".join(r["text"] for r in results)
            answer = await self.generate_answer(question, context)

        return {"answer": answer, "sources": results}
```

## 3. Embedding 优化

### 3.1 批量 Embedding

单条调用 embedding API 的开销主要在网络往返。批量处理可以显著摊薄这个开销。

```python
import asyncio
from typing import Sequence

class BatchEmbedder:
    """批量 Embedding 处理器"""

    def __init__(self, client, model: str = "text-embedding-3-small",
                 batch_size: int = 100, max_concurrent: int = 5):
        self.client = client
        self.model = model
        self.batch_size = batch_size
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """批量编码文本列表"""
        batches = [
            texts[i:i + self.batch_size]
            for i in range(0, len(texts), self.batch_size)
        ]

        tasks = [self._embed_batch(batch) for batch in batches]
        results = await asyncio.gather(*tasks)

        # 展平结果
        return [embedding for batch_result in results for embedding in batch_result]

    async def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        """编码单个批次（带并发控制）"""
        async with self.semaphore:
            response = await self.client.embeddings.create(
                model=self.model,
                input=batch
            )
            return [item.embedding for item in response.data]

    async def embed_with_cache(self, texts: list[str],
                                cache) -> list[list[float]]:
        """带缓存的批量编码"""
        # 1. 先查缓存
        cached = {}
        uncached = []
        uncached_indices = []

        for i, text in enumerate(texts):
            result = await cache.get(text)
            if result is not None:
                cached[i] = result
            else:
                uncached.append(text)
                uncached_indices.append(i)

        # 2. 批量编码未缓存的
        if uncached:
            new_embeddings = await self.embed_texts(uncached)
            for idx, embedding in zip(uncached_indices, new_embeddings):
                cached[idx] = embedding
                await cache.set(texts[idx], embedding)

        # 3. 按原始顺序返回
        return [cached[i] for i in range(len(texts))]
```

### 3.2 异步 Embedding 调用

```python
import asyncio
import aiohttp
from dataclasses import dataclass

@dataclass
class EmbeddingConfig:
    api_key: str
    model: str = "text-embedding-3-small"
    base_url: str = "https://api.openai.com/v1"
    max_retries: int = 3
    timeout: float = 30.0

class AsyncEmbeddingClient:
    """异步 Embedding 客户端，使用连接池"""

    def __init__(self, config: EmbeddingConfig):
        self.config = config
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=100,          # 最大连接数
                limit_per_host=20,  # 每个 host 最大连接数
                ttl_dns_cache=300,  # DNS 缓存 TTL
            )
            timeout = aiohttp.ClientTimeout(total=self.config.timeout)
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout,
                headers={"Authorization": f"Bearer {self.config.api_key}"}
            )
        return self._session

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """异步调用 Embedding API"""
        session = await self._get_session()
        payload = {
            "model": self.config.model,
            "input": texts
        }

        for attempt in range(self.config.max_retries):
            try:
                async with session.post(
                    f"{self.config.base_url}/embeddings",
                    json=payload
                ) as resp:
                    resp.raise_for_status()
                    data = await resp.json()
                    return [item["embedding"] for item in data["data"]]
            except aiohttp.ClientError as e:
                if attempt == self.config.max_retries - 1:
                    raise
                await asyncio.sleep(2 ** attempt)

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
```

## 4. 并行检索优化

### 4.1 多数据源并行检索

```
串行检索 (总耗时 = 150 + 200 + 100 = 450ms)
═══════════════════════════════════════════════

Timeline: 0ms                    450ms
          │                        │
VectorDB: ████████████████░░░░░░░░░ 150ms
          │                        │
Keyword:  ░░░░░░░░░░░░░░░████████████████████░░ 200ms
          │                        │
Metadata: ░░░░░░░░░░░░░░░░░░░░░░░░██████████░░ 100ms
          │                        │

并行检索 (总耗时 = max(150, 200, 100) = 200ms)
═══════════════════════════════════════════════

Timeline: 0ms              200ms
          │                  │
VectorDB: ████████████████░░░ 150ms
          │                  │
Keyword:  ████████████████████ 200ms
          │                  │
Metadata: ██████████░░░░░░░░░ 100ms
          │                  │

加速比: 450 / 200 = 2.25x
```

### 4.2 并行检索实现

```python
import asyncio
from dataclasses import dataclass, field
from typing import Protocol

class RetrievalResult:
    def __init__(self, source: str, documents: list[dict], latency_ms: float):
        self.source = source
        self.documents = documents
        self.latency_ms = latency_ms

class Retriever(Protocol):
    async def retrieve(self, query: str, top_k: int) -> list[dict]: ...

class VectorRetriever:
    def __init__(self, vector_store, embedder):
        self.store = vector_store
        self.embedder = embedder

    async def retrieve(self, query: str, top_k: int = 10) -> list[dict]:
        embedding = await self.embedder.embed([query])
        results = await self.store.search(embedding[0], top_k=top_k)
        return [{"text": r.text, "score": r.score, "source": "vector"} for r in results]

class KeywordRetriever:
    def __init__(self, search_engine):
        self.engine = search_engine

    async def retrieve(self, query: str, top_k: int = 10) -> list[dict]:
        results = await self.engine.search(query, top_k=top_k)
        return [{"text": r.text, "score": r.score, "source": "keyword"} for r in results]

class ParallelRetriever:
    """并行多路检索器"""

    def __init__(self, retrievers: list[Retriever], merger: "ResultMerger"):
        self.retrievers = retrievers
        self.merger = merger

    async def retrieve(self, query: str, top_k: int = 10) -> list[dict]:
        start = asyncio.get_event_loop().time()

        # 并行执行所有检索器
        tasks = [
            self._retrieve_with_timing(retriever, query, top_k)
            for retriever in self.retrievers
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 收集成功结果
        valid_results = []
        for result in results:
            if isinstance(result, RetrievalResult):
                valid_results.append(result)
            elif isinstance(result, Exception):
                print(f"Retrieval failed: {result}")

        # 合并结果
        merged = self.merger.merge(valid_results, top_k=top_k)

        elapsed = (asyncio.get_event_loop().time() - start) * 1000
        print(f"Parallel retrieval: {elapsed:.0f}ms, "
              f"{len(valid_results)} sources, {len(merged)} results")

        return merged

    async def _retrieve_with_timing(self, retriever, query, top_k) -> RetrievalResult:
        start = asyncio.get_event_loop().time()
        docs = await retriever.retrieve(query, top_k)
        elapsed = (asyncio.get_event_loop().time() - start) * 1000
        source_name = type(retriever).__name__
        return RetrievalResult(source_name, docs, elapsed)


class ResultMerger:
    """多路检索结果合并器"""

    def merge(self, results: list[RetrievalResult], top_k: int = 10) -> list[dict]:
        # RRF (Reciprocal Rank Fusion) 合并
        doc_scores: dict[str, float] = {}
        doc_data: dict[str, dict] = {}

        for result in results:
            for rank, doc in enumerate(result.documents):
                doc_id = self._get_doc_id(doc)
                rrf_score = 1.0 / (60 + rank)  # k=60 是常用参数
                doc_scores[doc_id] = doc_scores.get(doc_id, 0) + rrf_score
                doc_data[doc_id] = doc

        # 按融合分数排序
        sorted_ids = sorted(doc_scores, key=doc_scores.get, reverse=True)
        return [doc_data[doc_id] for doc_id in sorted_ids[:top_k]]

    def _get_doc_id(self, doc: dict) -> str:
        return doc.get("id", hash(doc["text"]))
```

## 5. 生成延迟优化

### 5.1 连接池

```python
import openai
from contextlib import asynccontextmanager

class LLMConnectionPool:
    """LLM 连接池管理器"""

    def __init__(self, api_key: str, pool_size: int = 10):
        self.pool_size = pool_size
        self._clients: list[openai.AsyncOpenAI] = []
        self._semaphore = asyncio.Semaphore(pool_size)

        for _ in range(pool_size):
            client = openai.AsyncOpenAI(
                api_key=api_key,
                timeout=60.0,
                max_retries=2,
                http_client=openai.http_client.AsyncHTTPClient(
                    limits=openai.http_client.Limits(
                        max_connections=pool_size * 2,
                        max_keepalive_connections=pool_size,
                    )
                )
            )
            self._clients.append(client)
        self._index = 0

    @asynccontextmanager
    async def acquire(self):
        async with self._semaphore:
            client = self._clients[self._index % self.pool_size]
            self._index += 1
            yield client

    async def generate(self, messages: list[dict], **kwargs) -> str:
        async with self.acquire() as client:
            response = await client.chat.completions.create(
                model=kwargs.get("model", "gpt-4"),
                messages=messages,
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 1024),
            )
            return response.choices[0].message.content
```

### 5.2 流式生成（减少 TTFT）

```python
from typing import AsyncGenerator

class StreamingRAGGenerator:
    """流式 RAG 生成器"""

    def __init__(self, llm_pool: LLMConnectionPool):
        self.llm_pool = llm_pool

    async def generate_stream(
        self,
        query: str,
        context: str,
        system_prompt: str = None,
    ) -> AsyncGenerator[str, None]:
        """流式生成回答"""
        messages = self._build_messages(query, context, system_prompt)

        async with self.llm_pool.acquire() as client:
            stream = await client.chat.completions.create(
                model="gpt-4",
                messages=messages,
                temperature=0.7,
                max_tokens=1024,
                stream=True,  # 启用流式
            )

            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

    def _build_messages(self, query: str, context: str,
                         system_prompt: str = None) -> list[dict]:
        system = system_prompt or (
            "You are a helpful assistant. Answer based on the provided context. "
            "If the context doesn't contain the answer, say so."
        )
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
        ]
```

## 6. 优化技术对比

| 优化技术 | 目标阶段 | 预期提升 | 实现难度 | 适用场景 |
|----------|----------|----------|----------|----------|
| 批量 Embedding | Embedding | 60-80% | 低 | 批量索引、多查询 |
| 异步 Embedding | Embedding | 30-50% | 低 | 高并发查询 |
| 连接池 | LLM 调用 | 20-40% | 低 | 高并发场景 |
| 并行检索 | 检索 | 50-70% | 中 | 多数据源场景 |
| 流式生成 | 生成 | TTFT 降低 70% | 中 | 对话式界面 |
| 查询缓存 | 全链路 | 90%+ (命中时) | 中 | 重复查询多的场景 |
| 结果重排序 | 检索 | 质量提升 15-25% | 中 | 精度要求高的场景 |
| Prompt 压缩 | 生成 | 20-30% | 高 | 上下文窗口受限 |

## 7. 常见误区

### ❌ 错误 1: 过早优化

```python
# 错误：在没有 profiling 的情况下盲目优化
async def bad_optimize(pipeline):
    # "我听说缓存很快" — 但你的瓶颈可能不在这里
    pipeline.enable_cache()
    pipeline.enable_batch()
    pipeline.enable_pool()
    # 可能浪费了时间优化了不需要优化的部分
```

### ❌ 错误 2: 忽略连接池的生命周期管理

```python
# 错误：每次请求都创建新连接
async def bad_connection_handling():
    client = openai.AsyncOpenAI(api_key="...")  # 每次新建！
    response = await client.chat.completions.create(...)
    # 没有关闭连接，可能导致连接泄漏
```

### ❌ 错误 3: 并行检索没有错误处理

```python
# 错误：一个检索器失败导致整个查询失败
async def bad_parallel_retrieval(query):
    results = await asyncio.gather(
        vector_retriever.retrieve(query),
        keyword_retriever.retrieve(query),
        # 如果 keyword_retriever 抛异常，整个查询就失败了
    )
```

## 8. 工程建议

1. **先 Profile 再优化**：不要凭直觉猜测瓶颈在哪里。用实际的请求 Trace 数据找出耗时最长的环节，然后针对性优化。通常 LLM 生成占总延迟的 60-80%。
2. **并行化是最低成本的优化**：Embedding 和 BM25 检索可以并行执行，多路召回也可以并行。用 asyncio.gather 或线程池实现并行，通常能将检索阶段延迟降低 50%。
3. **流式输出改善感知延迟**：即使端到端延迟无法大幅降低，流式输出让用户在 200ms 内就开始看到内容，感知等待时间大幅缩短。
4. **性能优化要有监控闭环**：每次优化上线后，持续监控 p50、p95、p99 延迟。性能优化容易引入新的 Bug，监控能帮你及时发现问题。

---

## 9. 本课总结

```
RAG 性能优化关键要点
═══════════════════════════════════════════════

  1. 先 Profiling，再优化
     └─ 不要猜，要测

  2. Embedding: 批量 + 异步 + 缓存
     └─ 网络往返是最昂贵的操作

  3. 检索: 并行多路 + RRF 融合
     └─ max(latency) < sum(latency)

  4. 生成: 连接池 + 流式 + 压缩 Prompt
     └─ TTFT 比总延迟更影响用户体验

  5. 缓存: 最强大的优化手段
     └─ 详见下一课
```

## 10. 练习

### 练习 1: 实现 RAG Profiler

构建一个 RAG 性能分析工具，要求：
- 自动记录每个阶段的耗时
- 生成可视化的延迟分布报告
- 识别最慢的 3 个阶段并给出优化建议

```python
class RAGPerformanceProfiler:
    """你的实现"""

    def instrument(self, pipeline):
        """为 pipeline 添加性能监控"""
        pass

    def generate_report(self) -> dict:
        """生成性能报告"""
        pass

    def get_optimization_suggestions(self) -> list[str]:
        """给出优化建议"""
        pass
```

### 练习 2: 实现并行检索器

基于本课的 `ParallelRetriever`，添加以下功能：
- 超时控制：单个检索器超过 500ms 自动放弃
- 降级策略：当某个检索器连续失败 3 次后，自动跳过
- 结果去重：基于文本相似度去重

```python
class RobustParallelRetriever(ParallelRetriever):
    """带容错的并行检索器"""

    async def retrieve(self, query: str, top_k: int = 10) -> list[dict]:
        # 你的实现
        pass
```

### 练习 3: 端到端优化

给定一个 baseline RAG pipeline，完成以下优化：
1. 添加批量 Embedding（减少 50%+ embedding 延迟）
2. 实现并行检索（减少 40%+ 检索延迟）
3. 添加流式生成（TTFT < 500ms）
4. 记录优化前后的对比数据

```python
class OptimizedRAGPipeline:
    """你的优化实现"""

    def __init__(self, baseline_pipeline):
        self.baseline = baseline_pipeline

    async def optimized_query(self, question: str) -> AsyncGenerator[str, None]:
        # 你的实现
        pass

    def compare_performance(self) -> dict:
        """对比优化前后的性能"""
        pass
```

---

**下一步**: [02 - 缓存策略](./02-缓存策略.md)
