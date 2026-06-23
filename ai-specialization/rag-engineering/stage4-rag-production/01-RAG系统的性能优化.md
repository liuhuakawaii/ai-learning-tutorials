# RAG 性能优化：从一次延迟排查说起

> Stage 4 · Lesson 1 | 前置：Stage 3 完成 | 时长：50 分钟

你的 RAG 系统上线了，功能没问题，但用户反馈"太慢了"。抓了一下日志：单次请求平均 4.2 秒。老板要求降到 2 秒以内。

性能优化不是凭感觉猜哪里慢，而是先测量、再定位、最后针对性优化。

## 你要解决的问题

- 如何定位 RAG 系统的延迟瓶颈
- 哪些优化手段收益最高
- 优化后如何验证效果

## 1. 先测量：时间花在哪了

```python
import time
from contextlib import contextmanager
from dataclasses import dataclass, field

@dataclass
class TimingProfile:
    stages: dict = field(default_factory=dict)

    @contextmanager
    def measure(self, name: str):
        start = time.time()
        yield
        self.stages[name] = (time.time() - start) * 1000

    def report(self):
        total = sum(self.stages.values())
        print(f"\n{'阶段':<25} {'耗时(ms)':<10} {'占比':<6}")
        print("=" * 45)
        for name, ms in self.stages.items():
            print(f"{name:<25} {ms:<10.0f} {ms/total*100:.1f}%")
        print(f"{'总计':<25} {total:<10.0f}")
```

在 RAG 流程中埋点：

```python
def profiled_rag(query: str) -> dict:
    profile = TimingProfile()

    with profile.measure("1. Query Embedding"):
        query_vector = client.embeddings.create(
            model="text-embedding-3-small", input=query
        ).data[0].embedding

    with profile.measure("2. Vector Search"):
        results = milvus.search(
            collection_name="knowledge_base",
            data=[query_vector], limit=5, output_fields=["text"]
        )
        texts = [r["entity"]["text"] for r in results[0]]

    with profile.measure("3. Reranker"):
        reranker.predict([(query, t) for t in texts])

    with profile.measure("4. LLM Generation"):
        context = "\n\n".join(texts[:3])
        answer = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": f"基于文档回答：\n\n{context}\n\n问题：{query}"}],
            temperature=0.0
        )

    profile.report()
    return {"answer": answer.choices[0].message.content}
```

典型结果：

```text
阶段                       耗时(ms)   占比
=============================================
1. Query Embedding          150        3.6%
2. Vector Search            380        9.0%
3. Reranker                 650       15.5%
4. LLM Generation          3000       71.4%
=============================================
总计                       4200
```

LLM 生成占 71%。但 Embedding + 检索 + Reranker 串行加起来 1180ms，如果能并行化可以压到 650ms。

## 2. 优化一：并行化

```python
import asyncio
from openai import AsyncOpenAI

async_client = AsyncOpenAI()

async def rag_async(query: str) -> dict:
    # Embedding
    response = await async_client.embeddings.create(
        model="text-embedding-3-small", input=query
    )
    query_vector = response.data[0].embedding

    # 向量检索（异步化）
    results = await asyncio.to_thread(
        milvus.search, collection_name="knowledge_base",
        data=[query_vector], limit=5, output_fields=["text"]
    )
    texts = [r["entity"]["text"] for r in results[0]]

    # 如果有多路检索，可以并行
    # vector_task = asyncio.to_thread(vector_search, query)
    # bm25_task = asyncio.to_thread(bm25_search, query)
    # vector_results, bm25_results = await asyncio.gather(vector_task, bm25_task)

    # Reranker
    ranked = await asyncio.to_thread(
        reranker.predict, [(query, t) for t in texts]
    )

    # 生成（流式）
    context = "\n\n".join(texts[:3])
    stream = await async_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": f"基于文档回答：\n\n{context}\n\n问题：{query}"}],
        temperature=0.0, stream=True
    )
    answer = ""
    async for chunk in stream:
        if chunk.choices[0].delta.content:
            answer += chunk.choices[0].delta.content

    return {"answer": answer}
```

## 3. 优化二：Embedding 批处理

单条调用约 150ms，批量调用 100 条约 200ms（平均 2ms/条）。在摄入阶段一定要批量。

```python
# 不好：每条单独调用
for text in texts:
    client.embeddings.create(model="text-embedding-3-small", input=text)

# 好：批量调用
response = client.embeddings.create(model="text-embedding-3-small", input=texts)
```

## 4. 优化三：流式输出

流式不减少总延迟，但减少用户感知延迟。

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

@app.post("/query/stream")
async def query_stream(request: QueryRequest):
    async def generate():
        contexts = await retrieve(request.question)
        stream = await async_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": build_prompt(request.question, contexts)}],
            temperature=0.0, stream=True
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    return StreamingResponse(generate(), media_type="text/plain")
```

## 5. 优化四：连接池与预热

```python
# 全局复用客户端实例，不要每次请求创建
client = OpenAI()         # 自带连接池
milvus = MilvusClient(uri="http://localhost:19530")

# 启动时预热
def warmup():
    client.embeddings.create(model="text-embedding-3-small", input="warmup")
    milvus.search(collection_name="knowledge_base", data=[[0.0]*1536], limit=1)
```

## 6. 优化五：用规则替代不必要的 LLM 调用

```python
# 用规则判断是否需要检索，省一次 LLM 调用
def should_retrieve(query: str) -> bool:
    if len(query) < 5:
        return False
    greetings = ["你好", "hi", "hello", "谢谢", "thanks"]
    if query.lower().strip() in greetings:
        return False
    return True
```

## 7. 验证优化效果

```python
import statistics

def benchmark(rag_fn, queries: list[str]) -> dict:
    latencies = []
    for q in queries:
        start = time.time()
        rag_fn(q)
        latencies.append((time.time() - start) * 1000)
    return {
        "p50": statistics.median(latencies),
        "p95": sorted(latencies)[int(len(latencies) * 0.95)],
        "mean": statistics.mean(latencies)
    }
```

优化前后对比模式：

```text
指标     优化前     优化后     改善
P50      4200ms     2800ms    -33%
P95      6500ms     4100ms    -37%
```

## 练习

### 练习一：Profile 你自己的系统

用 `TimingProfile` 给你的 RAG 系统埋点，跑 20 个查询，找到占比最大的阶段。

### 练习二：实现流式 RAG

把系统改成流式输出，测量 TTFB（首字时间）和总完成时间。

### 练习三：并行化多路检索

如果用了混合检索，把向量检索和 BM25 改成并行执行，测量延迟改善。

---

## 参考答案

### 练习一

典型瓶颈分布：LLM 生成 60-75%，Reranker 10-20%，向量检索 5-15%，Embedding 3-5%。如果 LLM 占比 >70%，优化其他阶段收益有限，考虑换更快模型或用流式改善体验。
