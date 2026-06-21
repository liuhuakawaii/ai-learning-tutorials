# 03 - 流式 RAG

```
╔══════════════════════════════════════════════════════════╗
║  Stage 4 · Lesson 3                                     ║
║  流式 RAG (Streaming RAG)                                ║
║  时长: 45 分钟                                          ║
╚══════════════════════════════════════════════════════════╝
```

## 前置要求

- 完成 Stage 4 Lesson 1 (性能优化)
- 熟悉 Python async generator
- 了解 SSE (Server-Sent Events) 协议

## 学习目标

1. **流式检索** — 在检索过程中就开始传递结果
2. **带来源引用的流式生成** — 流式输出同时附带参考来源
3. **背压控制** — 处理生产者和消费者速度不匹配的问题
4. **TTFT 优化** — 将首 token 时间控制在 500ms 以内

## 1. 流式 RAG 概述

### 1.1 为什么需要流式

```
批量模式 vs 流式模式
═══════════════════════════════════════════════════════════════

批量模式 (用户等待完整响应):
  │                                                      │
  │ 检索     LLM 生成所有 tokens     后处理    返回      │
  │ 300ms    ████████████████████████  50ms     │        │
  │          2000ms                             │        │
  │                                             │        │
  0ms ──────────────────────────────────── 2350ms ──→ 用户看到

流式模式 (用户几乎立即看到输出):
  │                                                      │
  │ 检索    首 token  后续 tokens 持续输出                │
  │ 300ms   200ms    ████████████████████████████████████ │
  │                  持续 1800ms                          │
  │                                                      │
  0ms ── 500ms ──→ 用户开始看到输出 ──────────────── 完成

TTFT (Time to First Token):
  批量: 2350ms (用户必须等全部完成)
  流式: 500ms  (用户体验大幅提升)
```

### 1.2 流式 RAG 时间线

```
流式 RAG 完整时间线
═══════════════════════════════════════════════════════════════

T=0ms     用户发送查询
          │
T=10ms    ┌─ 开始流式响应 (SSE connection established)
          │
T=150ms   ├─ Query Embedding 完成
          │
T=350ms   ├─ 向量检索完成，获得 Top-K 结果
          │
T=360ms   ├─ 发送 sources 事件 (引用来源)
          │  data: {"type": "sources", "sources": [...]}
          │
T=380ms   ├─ 组装 Prompt，调用 LLM
          │
T=500ms   ├─ 首个 token 到达 ★ TTFT = 500ms
          │  data: {"type": "token", "content": "根据"}
          │
T=600ms   ├─ token 流持续
          │  data: {"type": "token", "content": "文档"}
          │
T=700ms   ├─ token 流持续
          │  data: {"type": "token", "content": "记载"}
          │
  ...     ├─ 持续输出...
          │
T=2200ms  ├─ 生成完成
          │  data: {"type": "done", "total_tokens": 256}
          │
T=2210ms  └─ 连接关闭

用户感知:
  500ms 时开始看到文字  (vs 批量的 2350ms)
  看到文字"正在生成"的错觉，体感更快
```

## 2. FastAPI SSE 流式端点

### 2.1 基础 SSE 实现

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
import json
import asyncio

app = FastAPI()

async def sse_generator(
    query: str,
    rag_pipeline,
) -> AsyncGenerator[str, None]:
    """SSE 事件生成器"""
    try:
        # 阶段 1: 检索
        yield format_sse_event("status", {"stage": "retrieving"})

        results = await rag_pipeline.retrieve(query)
        sources = [{"title": r["title"], "url": r.get("url")} for r in results]
        yield format_sse_event("sources", {"sources": sources})

        # 阶段 2: 流式生成
        yield format_sse_event("status", {"stage": "generating"})

        context = "\n".join(r["text"] for r in results)
        async for token in rag_pipeline.generate_stream(query, context):
            yield format_sse_event("token", {"content": token})

        # 阶段 3: 完成
        yield format_sse_event("done", {"status": "complete"})

    except Exception as e:
        yield format_sse_event("error", {"message": str(e)})

def format_sse_event(event_type: str, data: dict) -> str:
    """格式化 SSE 事件"""
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

@app.post("/api/chat/stream")
async def stream_chat(request: Request):
    body = await request.json()
    query = body["query"]

    return StreamingResponse(
        sse_generator(query, rag_pipeline),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲
        }
    )
```

### 2.2 带引用来源的流式生成

```python
from dataclasses import dataclass
from typing import AsyncGenerator

@dataclass
class StreamChunk:
    type: str       # "sources", "token", "metadata", "done"
    content: any

class StreamingRAGWithSources:
    """带来源引用的流式 RAG"""

    def __init__(self, retriever, llm_client, embedder):
        self.retriever = retriever
        self.llm = llm_client
        self.embedder = embedder

    async def stream_query(
        self, query: str, top_k: int = 5
    ) -> AsyncGenerator[StreamChunk, None]:
        """流式 RAG 查询，同时返回来源"""

        # 1. 检索
        embedding = await self.embedder.embed([query])
        sources = await self.retriever.search(embedding[0], top_k=top_k)

        # 2. 先发送来源信息
        yield StreamChunk(
            type="sources",
            content=[{
                "index": i,
                "title": s.get("title", f"Source {i+1}"),
                "snippet": s["text"][:200],
                "score": s.get("score", 0),
                "url": s.get("url"),
            } for i, s in enumerate(sources)]
        )

        # 3. 组装 prompt，标记来源编号
        context_parts = []
        for i, s in enumerate(sources):
            context_parts.append(f"[{i+1}] {s['text']}")
        context = "\n\n".join(context_parts)

        system_prompt = (
            "Answer based on the provided sources. "
            "Cite sources using [number] notation. "
            "If the sources don't contain the answer, say so."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Sources:\n{context}\n\nQuestion: {query}"},
        ]

        # 4. 流式生成，token 里可能包含 [1], [2] 等引用
        async for token in self._stream_llm(messages):
            yield StreamChunk(type="token", content=token)

        # 5. 发送元数据
        yield StreamChunk(type="metadata", content={
            "sources_count": len(sources),
            "model": "gpt-4",
        })

        yield StreamChunk(type="done", content=None)

    async def _stream_llm(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        """流式调用 LLM"""
        stream = await self.llm.chat.completions.create(
            model="gpt-4",
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
```

## 3. 背压控制

### 3.1 什么是背压

```
背压问题示意
═══════════════════════════════════════════════════════════════

场景: LLM 生成速度快于网络发送速度

  LLM 生成速度: ~100 tokens/sec
  网络发送速度: ~50 tokens/sec (慢速客户端)

  时间轴:
  T=0s    LLM 生成了 100 tokens
          但只能发送 50 tokens
          剩余 50 tokens 缓存在内存中

  T=1s    LLM 又生成了 100 tokens
          累计积压: 100 tokens
          内存使用持续增长...

  T=10s   积压: 500 tokens (~2KB)
          如果每个 response 2KB，积压 10MB

  问题:
  - 内存持续增长 → OOM 风险
  - 延迟不断增加 → 用户体验差
  - 服务端资源被占用 → 影响其他请求

解决方案: 使用 asyncio.Queue + 背压阈值
═══════════════════════════════════════════════════════════════

  ┌──────────┐    Queue(maxsize=50)    ┌──────────┐
  │ LLM      │ ──────────────────────→ │ 网络发送  │
  │ 生产者    │     如果队列满          │ 消费者    │
  └──────────┘     生产者等待           └──────────┘
                   (背压生效)
```

### 3.2 带背压的流式处理

```python
import asyncio
from typing import AsyncGenerator

class BackpressureStreamHandler:
    """带背压控制的流式处理器"""

    def __init__(self, max_queue_size: int = 50):
        self.max_queue_size = max_queue_size

    async def stream_with_backpressure(
        self,
        generator: AsyncGenerator[str, None],
    ) -> AsyncGenerator[str, None]:
        """带背压的流式传递"""
        queue = asyncio.Queue(maxsize=self.max_queue_size)
        sentinel = object()  # 结束标记

        async def producer():
            try:
                async for item in generator:
                    await queue.put(item)  # 队列满时自动等待 (背压)
            finally:
                await queue.put(sentinel)

        # 启动生产者
        producer_task = asyncio.create_task(producer())

        try:
            while True:
                item = await queue.get()
                if item is sentinel:
                    break
                yield item
        finally:
            producer_task.cancel()


class AdaptiveBackpressureHandler:
    """自适应背压处理"""

    def __init__(self, initial_rate: int = 50):
        self.current_rate = initial_rate
        self.min_rate = 10
        self.max_rate = 200

    async def adapt(self, latency_ms: float):
        """根据延迟自适应调整发送速率"""
        if latency_ms > 100:
            # 延迟过高，降低速率
            self.current_rate = max(self.min_rate, self.current_rate - 5)
        elif latency_ms < 20:
            # 延迟很低，提高速率
            self.current_rate = min(self.max_rate, self.current_rate + 5)

    async def stream_with_adaptive_rate(
        self,
        generator: AsyncGenerator[str, None],
    ) -> AsyncGenerator[str, None]:
        """自适应速率的流式传递"""
        buffer = []
        last_send = asyncio.get_event_loop().time()

        async for chunk in generator:
            buffer.append(chunk)

            now = asyncio.get_event_loop().time()
            elapsed = (now - last_send) * 1000

            # 按当前速率批量发送
            if len(buffer) >= self.current_rate / 10 or elapsed > 50:
                for item in buffer:
                    yield item
                buffer.clear()

                await self.adapt(elapsed)
                last_send = now

        # 发送剩余
        for item in buffer:
            yield item
```

## 4. TTFT 优化

### 4.1 TTFT 分解与优化

```
TTFT (Time to First Token) 分解
═══════════════════════════════════════════════════════════════

目标: TTFT < 500ms

  ┌─────────────────────────────────────────────────────────┐
  │ 组成部分              耗时      优化策略                  │
  ├─────────────────────────────────────────────────────────┤
  │ 网络延迟              20ms     CDN/就近部署              │
  │ Query Embedding       80ms     模型选择、缓存             │
  │ 向量检索              100ms     索引优化、并行检索         │
  │ Prompt 组装           10ms     模板预编译                 │
  │ LLM 首 token          280ms    模型选择、连接预热         │
  ├─────────────────────────────────────────────────────────┤
  │ 总计                  490ms    < 500ms ✓                │
  └─────────────────────────────────────────────────────────┘
```

### 4.2 TTFT 优化实现

```python
import asyncio
from typing import Optional

class TTFTOptimizer:
    """首 token 时间优化器"""

    def __init__(self, embedder, retriever, llm_client):
        self.embedder = embedder
        self.retriever = retriever
        self.llm = llm_client
        self._warmup_done = False

    async def warmup(self):
        """预热连接，减少首次请求延迟"""
        if self._warmup_done:
            return

        # 并行预热所有组件
        await asyncio.gather(
            self._warmup_embedding(),
            self._warmup_retrieval(),
            self._warmup_llm(),
        )
        self._warmup_done = True

    async def _warmup_embedding(self):
        try:
            await self.embedder.embed(["warmup"])
        except Exception:
            pass

    async def _warmup_retrieval(self):
        try:
            await self.retriever.search([0.0] * 1536, top_k=1)
        except Exception:
            pass

    async def _warmup_llm(self):
        try:
            await self.llm.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": "hi"}],
                max_tokens=1,
            )
        except Exception:
            pass

    async def optimized_stream(
        self, query: str
    ) -> AsyncGenerator[str, None]:
        """优化 TTFT 的流式 RAG"""
        # 预热（如果还没有）
        await self.warmup()

        # Embedding 和检索可以与 LLM 连接预热并行
        embedding_task = asyncio.create_task(self.embedder.embed([query]))

        # 等待 embedding 完成
        embedding = await embedding_task

        # 检索
        results = await self.retriever.search(embedding[0], top_k=5)
        context = "\n".join(r["text"] for r in results)

        # 流式调用 LLM（已预热，连接复用）
        stream = await self.llm.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "Answer concisely based on context."},
                {"role": "user", "content": f"Context:\n{context}\n\nQ: {query}"},
            ],
            stream=True,
            max_tokens=512,
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
```

## 5. 批量 vs 流式对比

| 维度 | 批量模式 | 流式模式 |
|------|----------|----------|
| **TTFT** | 等待全部完成 (2-3s) | 首 token 500ms |
| **用户体验** | 加载等待 | 渐进展示 |
| **服务器内存** | 低（一次性发送） | 中（需维护流状态） |
| **实现复杂度** | 低 | 中 |
| **错误处理** | 简单 | 需处理中断 |
| **客户端兼容性** | 通用 | 需要 SSE/WebSocket |
| **适用场景** | API 调用 | 对话界面 |

## 6. 常见错误

### ❌ 错误 1: 忘记禁用缓冲

```python
# 错误：Nginx/反向代理缓冲了 SSE 响应
# 用户看到的是批量结果，不是流式的

# 正确：设置正确的 headers
headers = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",  # Nginx 专用
    "Connection": "keep-alive",
}
```

### ❌ 错误 2: 没有处理客户端断开

```python
# 错误：客户端断开后服务器还在生成
async def bad_stream(query):
    async for token in generate(query):
        yield token  # 客户端已断开，继续生成浪费资源

# 正确：检测客户端断开
async def good_stream(query, request: Request):
    async for token in generate(query):
        if await request.is_disconnected():
            break
        yield token
```

### ❌ 错误 3: 没有背压控制

```python
# 错误：LLM 生成太快，内存积压
async def bad_stream_no_backpressure():
    async for token in llm_stream():
        yield token  # 如果网络慢，队列无限增长

# 正确：使用队列控制背压
async def good_stream_with_backpressure():
    queue = asyncio.Queue(maxsize=50)
    # ... 使用队列控制生产者速率
```

## 7. 本课总结

```
流式 RAG 关键要点
═══════════════════════════════════════════════

  1. 流式大幅改善 TTFT
     └─ 用户 500ms 看到首字 vs 2350ms 等待

  2. SSE 是最简单的流式协议
     └─ 无需 WebSocket，HTTP 即可

  3. 先发 sources，再流式生成
     └─ 用户立即知道答案来自哪里

  4. 背压控制必不可少
     └─ 防止内存积压和 OOM

  5. 预热连接减少冷启动延迟
     └─ embedding/检索/LLM 并行预热
```

## 8. 练习

### 练习 1: 实现 SSE 流式端点

构建一个 FastAPI SSE 端点，要求：
- 支持 `POST /api/chat/stream`
- 流式返回 token 和 sources
- 处理客户端断开连接
- 添加请求超时（30s）

### 练习 2: 带来源标注的流式生成

扩展流式 RAG，实现：
- 在生成的文本中自动标注来源 `[1]`, `[2]`
- 每个 token 追踪它来自哪个 source
- 生成完成后发送完整的引用列表

### 练习 3: 背压感知的流式管道

实现一个生产级的流式管道：
- 使用 `asyncio.Queue` 实现背压
- 支持自适应速率调整
- 处理异常情况（LLM 超时、检索失败）
- 记录 TTFT 和吞吐量指标

---

**下一步**: [04 - RAG 安全：注入防御](./04-RAG安全-注入防御.md)
