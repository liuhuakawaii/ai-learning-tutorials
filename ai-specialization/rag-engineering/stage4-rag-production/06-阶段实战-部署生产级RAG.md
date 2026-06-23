# 阶段实战：部署一个生产级 RAG 系统

> Stage 4 · Capstone | 前置：Lesson 1-5 完成 | 时长：90 分钟

本地跑得好，现在要上线。上线需要容器化、健康检查、优雅降级、监控告警。

## 你要完成的事

- 把 RAG 系统打包成 Docker 镜像
- 实现健康检查和优雅降级
- 集成监控和日志

## 1. FastAPI 服务

```python
# app/main.py
import time, hashlib, json
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager
from .rag_engine import RAGEngine
from .cache import RedisCache
from .metrics import MetricsCollector

engine = None
cache = None
metrics = MetricsCollector()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine, cache
    engine = RAGEngine()
    cache = RedisCache()
    engine.warmup()
    yield
    await cache.close()

app = FastAPI(title="RAG Service", lifespan=lifespan)

class QueryRequest(BaseModel):
    question: str
    stream: bool = False
    top_k: int = 5

@app.post("/query")
async def query(request: QueryRequest):
    start = time.time()
    cache_key = hashlib.md5(request.question.encode()).hexdigest()
    cached = await cache.get(cache_key)
    if cached:
        metrics.record_cache_hit()
        result = json.loads(cached)
        result["cached"] = True
        result["latency_ms"] = (time.time() - start) * 1000
        return result

    try:
        result = await engine.query(request.question, top_k=request.top_k)
    except Exception as e:
        metrics.record_error()
        raise HTTPException(status_code=500, detail=str(e))

    await cache.set(cache_key, json.dumps(result), ttl=3600)
    result["cached"] = False
    result["latency_ms"] = (time.time() - start) * 1000
    metrics.record_query(result["latency_ms"])
    return result

@app.get("/health")
async def health():
    checks = {
        "milvus": await engine.check_milvus(),
        "redis": await cache.ping(),
        "openai": await engine.check_openai()
    }
    return {"status": "healthy" if all(checks.values()) else "degraded", "checks": checks}
```

## 2. 优雅降级

```python
# app/rag_engine.py
class RAGEngine:
    async def query(self, question, top_k=5):
        try:
            contexts = await self.retrieve(question, top_k)
            answer = await self.generate(question, contexts)
            return {"answer": answer, "sources": [c["source"] for c in contexts]}
        except MilvusConnectionError:
            answer = await self.generate(question, [])
            return {"answer": answer, "sources": [], "fallback": "no_retrieval"}
        except OpenAIRateLimitError:
            contexts = await self.retrieve(question, top_k)
            return {"answer": "系统繁忙，请稍后重试",
                    "sources": [c["source"] for c in contexts], "fallback": "no_generation"}
```

## 3. Docker 部署

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
RUN useradd -m raguser && USER raguser
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

```yaml
# docker-compose.yml
version: "3.8"
services:
  rag-api:
    build: .
    ports: ["8000:8000"]
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - MILVUS_URI=http://milvus:19530
      - REDIS_URI=redis://redis:6379
    depends_on:
      milvus: {condition: service_healthy}
      redis: {condition: service_healthy}
  milvus:
    image: milvusdb/milvus:latest
    ports: ["19530:19530"]
    volumes: [milvus_data:/var/lib/milvus]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redis_data:/data]
volumes:
  milvus_data:
  redis_data:
```

## 4. 监控指标

```python
# app/metrics.py
from collections import deque
import time

class MetricsCollector:
    def __init__(self):
        self.query_latencies = deque(maxlen=1000)
        self.cache_hits = 0
        self.errors = 0
        self.start_time = time.time()

    def record_query(self, latency_ms):
        self.query_latencies.append(latency_ms)

    def record_cache_hit(self):
        self.cache_hits += 1

    def record_error(self):
        self.errors += 1

    def summary(self):
        latencies = list(self.query_latencies)
        total = self.cache_hits + len(latencies)
        return {
            "total_requests": total,
            "cache_hit_rate": self.cache_hits / total if total else 0,
            "error_rate": self.errors / total if total else 0,
            "latency_p50": sorted(latencies)[len(latencies)//2] if latencies else 0,
            "latency_p95": sorted(latencies)[int(len(latencies)*0.95)] if latencies else 0,
        }
```

## 5. 部署检查清单

```text
功能  □ /query 返回正确答案  □ 流式输出正常  □ 缓存命中返回 cached=true
可靠  □ Milvus 不可用时降级  □ /health 正确报告状态  □ Docker 健康检查配置
性能  □ P50 < 3s  □ P95 < 5s  □ 内存无泄漏
安全  □ API Key 用环境变量  □ 输入长度限制  □ 基本速率限制
```

## 练习

### 练习一：用 Docker Compose 启动完整服务

测试：正常查询 → 停 Milvus 验证降级 → 停 Redis 验证无缓存仍工作 → 访问 /health。

### 练习二：添加结构化日志

在 /query 中记录 JSON 格式的请求日志（request_id、question、sources、latency、cached、fallback）。

### 练习三：用 Redis 实现速率限制

每 IP 每分钟最多 10 次，超限返回 429。

---

## 参考答案

### 练习二

```python
import logging, uuid
logger = logging.getLogger("rag_service")

@app.post("/query")
async def query(request: QueryRequest):
    request_id = str(uuid.uuid4())[:8]
    # ... 执行 RAG ...
    logger.info(json.dumps({
        "request_id": request_id,
        "question": request.question[:100],
        "latency_ms": result["latency_ms"],
        "cached": result.get("cached", False),
        "fallback": result.get("fallback"),
    }))
```

### 练习三

```python
async def rate_limit(request: Request):
    ip = request.client.host
    key = f"rate:{ip}"
    count = await cache.redis.incr(key)
    if count == 1:
        await cache.redis.expire(key, 60)
    if count > 10:
        raise HTTPException(status_code=429, detail="请求过于频繁")
```
