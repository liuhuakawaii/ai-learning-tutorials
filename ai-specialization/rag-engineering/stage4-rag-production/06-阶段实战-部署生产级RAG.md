# 06 - 阶段实战：部署生产级 RAG 系统

```
╔══════════════════════════════════════════════════════════╗
║  Stage 4 · Lesson 6 (Capstone)                          ║
║  部署生产级 RAG 系统                                     ║
║  时长: 90 分钟                                          ║
╚══════════════════════════════════════════════════════════╝
```

## 前置要求

- 完成 Stage 4 前 5 课
- 熟悉 FastAPI 和 Docker 基础
- 了解 Redis、Prometheus 基本概念

## 场景引入

经过前面五节课的学习，你已经掌握了 RAG 系统的性能优化、缓存策略、流式输出、安全防御和可观测性。现在老板说"下周要上线"，你需要把所有这些技术整合成一个可部署的生产级系统。但部署不只是把代码丢到服务器上——你需要容器化、健康检查、优雅降级、监控告警、日志采集，以及一份完整的部署检查清单。这一课就是你的上线指南。

## 学习目标

完成本课后，你将能够：

1. **打包 RAG 系统用于生产部署** — 使用 Docker 容器化完整 RAG 应用
2. **集成缓存和流式输出** — 结合 Redis 缓存与 SSE 流式响应
3. **实施安全防护措施** — 输入验证、速率限制、Prompt 注入检测
4. **搭建监控体系** — Prometheus 指标 + Grafana 看板 + 告警规则

## 1. 生产部署架构总览

```
生产级 RAG 系统架构
══════════════════════════════════════════════════════════════════════

                    ┌─────────────────────────────────────┐
                    │            用户 / 客户端              │
                    └──────────────┬──────────────────────┘
                                   │ HTTPS
                    ┌──────────────▼──────────────────────┐
                    │         Nginx / Traefik              │
                    │    (反向代理 + TLS 终止 + 限流)       │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼─────────┐ ┌───────▼───────┐ ┌─────────▼─────────┐
    │   RAG API Pod 1   │ │ RAG API Pod 2 │ │   RAG API Pod 3   │
    │   (FastAPI)       │ │  (FastAPI)    │ │   (FastAPI)       │
    │                   │ │               │ │                   │
    │ ┌───────────────┐ │ │               │ │                   │
    │ │ Security Layer│ │ │               │ │                   │
    │ │ - 输入验证    │ │ │               │ │                   │
    │ │ - 注入检测    │ │ │               │ │                   │
    │ │ - 速率限制    │ │ │               │ │                   │
    │ └───────┬───────┘ │ │               │ │                   │
    │ ┌───────▼───────┐ │ │               │ │                   │
    │ │  RAG Engine   │ │ │               │ │                   │
    │ │ - 缓存层     │ │ │               │ │                   │
    │ │ - 检索+生成   │ │ │               │ │                   │
    │ │ - 流式输出    │ │ │               │ │                   │
    │ └───────┬───────┘ │ │               │ │                   │
    │ ┌───────▼───────┐ │ │               │ │                   │
    │ │ Observability │ │ │               │ │                   │
    │ │ - Metrics     │ │ │               │ │                   │
    │ │ - Tracing     │ │ │               │ │                   │
    │ │ - Logging     │ │ │               │ │                   │
    │ └───────────────┘ │ │               │ │                   │
    └─────────┬─────────┘ └───────┬───────┘ └─────────┬─────────┘
              │                    │                    │
    ┌─────────▼────────────────────▼────────────────────▼─────────┐
    │                      共享服务层                               │
    │  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
    │  │  Redis   │  │  向量数据库   │  │   PostgreSQL / MySQL   │ │
    │  │  (缓存)  │  │  (Qdrant)    │  │   (元数据存储)         │ │
    │  └──────────┘  └──────────────┘  └────────────────────────┘ │
    └─────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │         监控与告警层                  │
                    │  ┌──────────┐  ┌──────────────────┐ │
                    │  │Prometheus│  │     Grafana      │ │
                    │  │ (指标)   │  │   (可视化看板)    │ │
                    │  └──────────┘  └──────────────────┘ │
                    │  ┌──────────┐  ┌──────────────────┐ │
                    │  │  Loki    │  │   AlertManager   │ │
                    │  │ (日志)   │  │   (告警路由)      │ │
                    │  └──────────┘  └──────────────────┘ │
                    └─────────────────────────────────────┘
```

## 2. 完整 FastAPI 应用

### 2.1 项目结构

```
rag-production/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置管理
│   ├── security/
│   │   ├── __init__.py
│   │   ├── input_validator.py
│   │   ├── injection_detector.py
│   │   └── rate_limiter.py
│   ├── rag/
│   │   ├── __init__.py
│   │   ├── engine.py        # RAG 核心引擎
│   │   ├── cache.py         # Redis 缓存层
│   │   └── streaming.py     # SSE 流式输出
│   ├── observability/
│   │   ├── __init__.py
│   │   ├── metrics.py       # Prometheus 指标
│   │   ├── tracing.py       # OpenTelemetry 追踪
│   │   └── logging.py       # 结构化日志
│   └── models.py            # Pydantic 数据模型
├── Dockerfile
├── docker-compose.yml
├── prometheus.yml
├── grafana/
│   └── dashboards/
│       └── rag-overview.json
├── requirements.txt
└── .env.example
```

### 2.2 配置管理

```python
# app/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # 应用
    app_name: str = "RAG Production API"
    debug: bool = False
    workers: int = 4

    # OpenAI
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"

    # Redis
    redis_url: str = "redis://redis:6379/0"
    cache_ttl: int = 3600

    # Qdrant
    qdrant_url: str = "http://qdrant:6333"
    qdrant_collection: str = "documents"
    top_k: int = 5

    # 安全
    max_query_length: int = 1000
    rate_limit_per_minute: int = 60
    enable_injection_detection: bool = True

    # 可观测性
    otel_exporter_endpoint: str = "http://otel-collector:4317"
    prometheus_port: int = 9090
    log_level: str = "INFO"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

### 2.3 数据模型

```python
# app/models.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    use_cache: bool = True
    stream: bool = False
    filters: Optional[dict] = None


class RetrievedChunk(BaseModel):
    content: str
    source: str
    score: float
    metadata: dict = {}


class QueryResponse(BaseModel):
    answer: str
    sources: list[RetrievedChunk]
    cached: bool = False
    latency_ms: float
    request_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class HealthResponse(BaseModel):
    status: str
    version: str
    uptime_seconds: float
    components: dict
```

### 2.4 安全层

```python
# app/security/input_validator.py
import re
from app.config import get_settings


class InputValidator:
    def __init__(self):
        self.settings = get_settings()
        self.injection_patterns = [
            r"ignore\s+(all\s+)?previous\s+instructions",
            r"you\s+are\s+now\s+(a|an)\s+",
            r"system\s*:\s*",
            r"<\|im_start\|>",
            r"ignore\s+above",
            r"disregard\s+(all\s+)?prior",
            r"new\s+instructions\s*:",
            r"forget\s+(everything|all)",
        ]
        self.compiled_patterns = [
            re.compile(p, re.IGNORECASE) for p in self.injection_patterns
        ]

    def validate(self, query: str) -> tuple[bool, str]:
        if not query or not query.strip():
            return False, "查询不能为空"

        if len(query) > self.settings.max_query_length:
            return False, f"查询超过最大长度 {self.settings.max_query_length}"

        if self.settings.enable_injection_detection:
            for pattern in self.compiled_patterns:
                if pattern.search(query):
                    return False, "检测到潜在的 Prompt 注入"

        return True, ""


# app/security/rate_limiter.py
import time
import redis.asyncio as redis
from app.config import get_settings


class RateLimiter:
    def __init__(self):
        self.settings = get_settings()
        self.redis = None

    async def connect(self):
        self.redis = redis.from_url(self.settings.redis_url)

    async def check(self, client_id: str) -> tuple[bool, dict]:
        now = int(time.time())
        window_key = f"rate:{client_id}:{now // 60}"

        pipe = self.redis.pipeline()
        pipe.incr(window_key)
        pipe.expire(window_key, 120)
        results = await pipe.execute()

        count = results[0]
        limit = self.settings.rate_limit_per_minute
        remaining = max(0, limit - count)

        headers = {
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str((now // 60 + 1) * 60),
        }

        return count <= limit, headers
```

### 2.5 RAG 引擎（含缓存和流式）

```python
# app/rag/engine.py
import hashlib
import json
import time
import uuid
from typing import AsyncGenerator

import redis.asyncio as redis
from openai import AsyncOpenAI
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue

from app.config import get_settings
from app.models import QueryRequest, QueryResponse, RetrievedChunk
from app.observability.metrics import (
    RETRIEVAL_LATENCY,
    GENERATION_LATENCY,
    CACHE_HIT,
    REQUEST_COUNT,
)


class RAGEngine:
    def __init__(self):
        self.settings = get_settings()
        self.openai = AsyncOpenAI(api_key=self.settings.openai_api_key)
        self.qdrant = AsyncQdrantClient(url=self.settings.qdrant_url)
        self.redis = redis.from_url(self.settings.redis_url)
        self._ready = False

    async def initialize(self):
        collections = await self.qdrant.get_collections()
        names = [c.name for c in collections.collections]
        if self.settings.qdrant_collection not in names:
            raise RuntimeError(
                f"集合 {self.settings.qdrant_collection} 不存在"
            )
        self._ready = True

    def _cache_key(self, query: str, filters: dict | None) -> str:
        raw = json.dumps({"q": query, "f": filters or {}}, sort_keys=True)
        return f"rag:cache:{hashlib.sha256(raw.encode()).hexdigest()}"

    async def retrieve(
        self, query: str, filters: dict | None = None
    ) -> list[RetrievedChunk]:
        t0 = time.perf_counter()

        embedding = await self.openai.embeddings.create(
            model=self.settings.embedding_model, input=query
        )
        query_vector = embedding.data[0].embedding

        must_conditions = []
        if filters:
            for key, value in filters.items():
                must_conditions.append(
                    FieldCondition(
                        key=f"metadata.{key}",
                        match=MatchValue(value=value),
                    )
                )

        search_filter = Filter(must=must_conditions) if must_conditions else None

        results = await self.qdrant.search(
            collection_name=self.settings.qdrant_collection,
            query_vector=query_vector,
            limit=self.settings.top_k,
            query_filter=search_filter,
        )

        RETRIEVAL_LATENCY.observe(time.perf_counter() - t0)

        return [
            RetrievedChunk(
                content=hit.payload.get("content", ""),
                source=hit.payload.get("source", "unknown"),
                score=hit.score,
                metadata=hit.payload.get("metadata", {}),
            )
            for hit in results
        ]

    async def generate(
        self, query: str, chunks: list[RetrievedChunk]
    ) -> str:
        t0 = time.perf_counter()

        context = "\n\n---\n\n".join(
            f"[来源: {c.source}]\n{c.content}" for c in chunks
        )

        response = await self.openai.chat.completions.create(
            model=self.settings.openai_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是 RAG 助手。仅基于提供的上下文回答。"
                        "如果上下文不相关，说明无法回答。引用来源。"
                    ),
                },
                {
                    "role": "user",
                    "content": f"上下文:\n{context}\n\n问题: {query}",
                },
            ],
            temperature=0.1,
        )

        GENERATION_LATENCY.observe(time.perf_counter() - t0)
        return response.choices[0].message.content

    async def query(self, request: QueryRequest) -> QueryResponse:
        request_id = str(uuid.uuid4())
        REQUEST_COUNT.inc()

        # 检查缓存
        if request.use_cache:
            cache_key = self._cache_key(request.question, request.filters)
            cached = await self.redis.get(cache_key)
            if cached:
                CACHE_HIT.inc()
                data = json.loads(cached)
                data["cached"] = True
                data["request_id"] = request_id
                return QueryResponse(**data)

        # 检索 + 生成
        t0 = time.perf_counter()
        chunks = await self.retrieve(request.question, request.filters)
        answer = await self.generate(request.question, chunks)
        latency_ms = (time.perf_counter() - t0) * 1000

        response = QueryResponse(
            answer=answer,
            sources=chunks,
            cached=False,
            latency_ms=latency_ms,
            request_id=request_id,
        )

        # 写入缓存
        if request.use_cache:
            await self.redis.setex(
                cache_key,
                self.settings.cache_ttl,
                response.model_dump_json(),
            )

        return response

    async def stream_query(
        self, request: QueryRequest
    ) -> AsyncGenerator[str, None]:
        request_id = str(uuid.uuid4())
        REQUEST_COUNT.inc()

        chunks = await self.retrieve(request.question, request.filters)
        context = "\n\n---\n\n".join(
            f"[来源: {c.source}]\n{c.content}" for c in chunks
        )

        stream = await self.openai.chat.completions.create(
            model=self.settings.openai_model,
            messages=[
                {
                    "role": "system",
                    "content": "你是 RAG 助手。仅基于上下文回答。引用来源。",
                },
                {
                    "role": "user",
                    "content": f"上下文:\n{context}\n\n问题: {request.question}",
                },
            ],
            temperature=0.1,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield f"data: {json.dumps({'token': delta.content, 'request_id': request_id})}\n\n"

        meta = {
            "sources": [s.model_dump() for s in chunks],
            "request_id": request_id,
        }
        yield f"data: {json.dumps({'meta': meta})}\n\n"
        yield "data: [DONE]\n\n"
```

### 2.6 可观测性层

```python
# app/observability/metrics.py
from prometheus_client import Counter, Histogram, Gauge, Info

REQUEST_COUNT = Counter(
    "rag_requests_total", "RAG 请求总数"
)
REQUEST_LATENCY = Histogram(
    "rag_request_duration_seconds",
    "请求延迟分布",
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)
RETRIEVAL_LATENCY = Histogram(
    "rag_retrieval_duration_seconds",
    "检索延迟分布",
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0],
)
GENERATION_LATENCY = Histogram(
    "rag_generation_duration_seconds",
    "生成延迟分布",
    buckets=[0.5, 1.0, 2.0, 3.0, 5.0, 10.0],
)
CACHE_HIT = Counter(
    "rag_cache_hits_total", "缓存命中次数"
)
CACHE_MISS = Counter(
    "rag_cache_misses_total", "缓存未命中次数"
)
ACTIVE_REQUESTS = Gauge(
    "rag_active_requests", "当前活跃请求数"
)
INJECTION_BLOCKED = Counter(
    "rag_injection_blocked_total", "注入攻击拦截次数"
)
APP_INFO = Info("rag_app", "应用信息")


# app/observability/tracing.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
    OTLPSpanExporter,
)
from opentelemetry.sdk.resources import Resource
from app.config import get_settings


def setup_tracing():
    settings = get_settings()
    resource = Resource.create({"service.name": settings.app_name})
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(
        endpoint=settings.otel_exporter_endpoint, insecure=True
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return trace.get_tracer(settings.app_name)
```

### 2.7 FastAPI 主入口

```python
# app/main.py
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app

from app.config import get_settings
from app.models import QueryRequest, HealthResponse
from app.rag.engine import RAGEngine
from app.security.input_validator import InputValidator
from app.security.rate_limiter import RateLimiter
from app.observability.metrics import (
    REQUEST_LATENCY,
    ACTIVE_REQUESTS,
    INJECTION_BLOCKED,
    APP_INFO,
)
from app.observability.tracing import setup_tracing
from app.observability.logging import setup_logging

import structlog

logger = structlog.get_logger()
settings = get_settings()
engine = RAGEngine()
validator = InputValidator()
rate_limiter = RateLimiter()
tracer = setup_tracing()
start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await engine.initialize()
    await rate_limiter.connect()
    APP_INFO.info({"version": "1.0.0", "model": settings.openai_model})
    logger.info("应用启动完成")
    yield
    logger.info("应用关闭")


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    ACTIVE_REQUESTS.inc()
    t0 = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - t0
    REQUEST_LATENCY.observe(elapsed)
    ACTIVE_REQUESTS.dec()
    response.headers["X-Request-Time"] = f"{elapsed:.4f}"
    return response


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        uptime_seconds=time.time() - start_time,
        components={
            "rag_engine": engine._ready,
            "redis": await _check_redis(),
            "qdrant": await _check_qdrant(),
        },
    )


@app.post("/query", response_model=None)
async def query(request: QueryRequest, req: Request):
    request_id = str(uuid.uuid4())
    client_ip = req.client.host

    # 速率限制
    allowed, headers = await rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(status_code=429, detail="请求过于频繁")

    # 输入验证
    valid, reason = validator.validate(request.question)
    if not valid:
        INJECTION_BLOCKED.inc()
        logger.warning("输入验证失败", reason=reason, request_id=request_id)
        raise HTTPException(status_code=400, detail=reason)

    with tracer.start_as_current_span("rag.query") as span:
        span.set_attribute("request_id", request_id)
        span.set_attribute("query_length", len(request.question))

        if request.stream:
            return StreamingResponse(
                engine.stream_query(request),
                media_type="text/event-stream",
                headers=headers,
            )

        response = await engine.query(request)
        return JSONResponse(
            content=response.model_dump(mode="json"),
            headers=headers,
        )


async def _check_redis() -> bool:
    try:
        await engine.redis.ping()
        return True
    except Exception:
        return False


async def _check_qdrant() -> bool:
    try:
        await engine.qdrant.get_collections()
        return True
    except Exception:
        return False
```

### 2.8 结构化日志

```python
# app/observability/logging.py
import structlog
import logging
from app.config import get_settings


def setup_logging():
    settings = get_settings()

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.log_level)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
```

## 3. Docker 部署

### 3.1 Dockerfile

```dockerfile
FROM python:3.11-slim AS base

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

FROM base AS production

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 3.2 docker-compose.yml

```yaml
version: "3.9"

services:
  rag-api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_URL=redis://redis:6379/0
      - QDRANT_URL=http://qdrant:6333
      - OTEL_EXPORTER_ENDPOINT=http://otel-collector:4317
    depends_on:
      redis:
        condition: service_healthy
      qdrant:
        condition: service_started
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2.0"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    restart: unless-stopped

  otel-collector:
    image: otel/opentelemetry-collector:latest
    ports:
      - "4317:4317"
    restart: unless-stopped

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    restart: unless-stopped

volumes:
  redis_data:
  qdrant_data:
  prometheus_data:
  grafana_data:
```

### 3.3 Prometheus 配置

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

scrape_configs:
  - job_name: "rag-api"
    static_configs:
      - targets: ["rag-api:8000"]
    metrics_path: "/metrics"

  - job_name: "redis"
    static_configs:
      - targets: ["redis-exporter:9121"]

  - job_name: "qdrant"
    static_configs:
      - targets: ["qdrant:6333"]
    metrics_path: "/metrics"
```

### 3.4 告警规则

```yaml
# alert_rules.yml
groups:
  - name: rag_alerts
    rules:
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(rag_request_duration_seconds_bucket[5m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "RAG 请求 P95 延迟超过 5 秒"

      - alert: LowCacheHitRate
        expr: rate(rag_cache_hits_total[10m]) / (rate(rag_cache_hits_total[10m]) + rate(rag_cache_misses_total[10m])) < 0.2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "缓存命中率低于 20%"

      - alert: InjectionAttack
        expr: rate(rag_injection_blocked_total[5m]) > 0.1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "检测到频繁的注入攻击尝试"

      - alert: HighErrorRate
        expr: rate(rag_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "5xx 错误率超过 5%"

      - alert: ServiceDown
        expr: up{job="rag-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "RAG API 服务不可用"
```

## 4. requirements.txt

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
openai==1.50.0
qdrant-client==1.12.0
redis[hiredis]==5.1.0
pydantic-settings==2.5.0
structlog==24.4.0
opentelemetry-api==1.27.0
opentelemetry-sdk==1.27.0
opentelemetry-exporter-otlp-proto-grpc==1.27.0
prometheus-client==0.21.0
httpx==0.27.0
python-dotenv==1.0.0
```

## 5. 部署检查清单

```
部署前检查清单
══════════════════════════════════════════════════════════════

环境变量
  □ OPENAI_API_KEY 已设置且有效
  □ REDIS_URL 指向正确实例
  □ QDRANT_URL 指向正确实例
  □ DEBUG 设为 false

安全
  □ 速率限制已配置合理阈值
  □ 注入检测已开启
  □ CORS 限制为已知域名（非 *）
  □ HTTPS 已在反向代理层启用
  □ API Key 未硬编码在代码中

性能
  □ uvicorn workers 设为 CPU 核心数 × 2 + 1
  □ Redis 缓存 TTL 根据数据更新频率调整
  □ 连接池大小匹配并发量

监控
  □ Prometheus 能抓取 /metrics
  □ Grafana 看板已导入
  □ 告警规则已配置
  □ 日志收集链路已验证

健康检查
  □ /health 端点正常返回
  □ Docker HEALTHCHECK 已配置
  □ 负载均衡器健康检查已指向 /health
```

## 常见误区

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| 容器启动后立即退出 | 环境变量缺失 | 检查 `.env` 文件和 docker-compose 环境变量 |
| Redis 连接超时 | 服务依赖顺序问题 | 使用 `depends_on` + `healthcheck` 确保 Redis 先启动 |
| 向量检索返回空结果 | Qdrant 集合未初始化 | 部署前运行数据导入脚本 |
| 流式响应被缓冲 | Nginx 默认缓冲 | 在 Nginx 配置中添加 `proxy_buffering off` |
| Prometheus 无法抓取 | 端口未暴露或防火墙 | 确认容器网络和端口映射 |
| 内存溢出 OOM | Embedding 批量过大 | 设置请求体大小限制和批处理大小 |
| 告警风暴 | 阈值设置过低 | 逐步调整阈值，使用 `for` 持续时间过滤瞬时抖动 |

## 工程建议

1. **用 Docker Compose 做本地开发环境**：不要在本地直接安装 Milvus、Redis 等依赖。用 Docker Compose 一键启动所有服务，确保开发环境和生产环境一致。
2. **健康检查要覆盖依赖服务**：API 的 /health 端点不仅要检查自身状态，还要检查向量数据库、缓存、LLM API 的连通性。一个"healthy"但无法检索的系统比明确"unhealthy"的系统更危险。
3. **灰度发布是必须的**：不要一次性把新版本推给所有用户。用 Nginx 的权重路由或 Feature Flag 控制流量比例，先让 5% 的用户使用新版本，确认没有问题后再逐步扩大。
4. **回滚方案要在部署前就准备好**：每次部署前都要确认能快速回滚到上一个版本。Docker 的版本标签、数据库的迁移脚本、向量索引的备份——这些都要提前准备。

---

## 本课总结

```
关键收获
══════════════════════════════════════════════════════════════

1. 生产级 RAG 需要四层保障：
   安全 → 缓存 → 流式 → 可观测

2. Docker Compose 一键部署：
   API + Redis + Qdrant + Prometheus + Grafana + Loki

3. 安全防护三道关：
   输入验证 → 速率限制 → 注入检测

4. 监控三大支柱：
   指标 (Prometheus) + 日志 (Loki) + 追踪 (OTel)

5. 告警要分级：
   warning（性能下降）vs critical（服务不可用/安全事件）
```

## 练习

### 练习 1：添加 API Key 认证

为 `/query` 端点添加 Bearer Token 认证：
- 实现一个中间件验证 `Authorization: Bearer <token>` 头
- Token 存储在 Redis 中，支持多租户
- 未认证请求返回 401

### 练习 2：实现灰度发布

在 docker-compose 中实现灰度发布：
- 部署两个版本的 RAG API（v1 和 v2）
- 使用 Nginx 按权重路由流量（90/10）
- 配合 Grafana 对比两个版本的延迟和错误率

### 练习 3：构建端到端健康检查

实现深度健康检查端点 `/health/deep`：
- 验证 OpenAI API 可用性（发送最小 embedding 请求）
- 验证 Redis 读写（写入并读取一个测试键）
- 验证 Qdrant 查询（执行一次测试搜索）
- 返回每个组件的延迟和状态
- 当任何组件失败时返回 503

---

## 参考答案

### 练习 1：添加 API Key 认证

**思路**：实现一个 FastAPI 依赖项（Dependency）验证 `Authorization: Bearer <token>` 头，用 Redis 存储有效 token 及其关联的租户信息，未认证请求返回 401。

**答案**：

```python
# app/security/auth.py
import redis.asyncio as redis
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import get_settings

security = HTTPBearer()

class APIKeyAuth:
    """基于 Redis 的 API Key 认证"""

    def __init__(self):
        self.settings = get_settings()
        self.redis = None

    async def connect(self):
        self.redis = redis.from_url(self.settings.redis_url)

    async def validate_token(
        self, credentials: HTTPAuthorizationCredentials = Depends(security)
    ) -> dict:
        token = credentials.credentials
        tenant_data = await self.redis.hgetall(f"api_key:{token}")

        if not tenant_data:
            raise HTTPException(
                status_code=401,
                detail="无效的 API Key",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return {
            "tenant_id": tenant_data.get("tenant_id", "default"),
            "rate_limit": int(tenant_data.get("rate_limit", 60)),
            "permissions": tenant_data.get("permissions", "read").split(","),
        }

    async def register_key(self, token: str, tenant_id: str,
                           rate_limit: int = 60, permissions: str = "read"):
        """注册新的 API Key"""
        await self.redis.hset(f"api_key:{token}", mapping={
            "tenant_id": tenant_id,
            "rate_limit": str(rate_limit),
            "permissions": permissions,
        })

auth = APIKeyAuth()
```

在 `app/main.py` 中使用：

```python
from app.security.auth import auth

@app.post("/query", response_model=None)
async def query(
    request: QueryRequest,
    req: Request,
    tenant: dict = Depends(auth.validate_token),
):
    request_id = str(uuid.uuid4())
    client_ip = req.client.host

    # 使用租户级别的速率限制
    allowed, headers = await rate_limiter.check(
        f"{tenant['tenant_id']}:{client_ip}",
        limit=tenant["rate_limit"],
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="请求过于频繁")

    valid, reason = validator.validate(request.question)
    if not valid:
        INJECTION_BLOCKED.inc()
        raise HTTPException(status_code=400, detail=reason)

    if request.stream:
        return StreamingResponse(
            engine.stream_query(request),
            media_type="text/event-stream",
            headers=headers,
        )

    response = await engine.query(request)
    return JSONResponse(content=response.model_dump(mode="json"), headers=headers)
```

注册 API Key 的示例脚本：

```python
# scripts/register_key.py
import asyncio
import secrets
import redis.asyncio as redis

async def main():
    r = redis.from_url("redis://localhost:6379")
    token = secrets.token_urlsafe(32)
    await r.hset(f"api_key:{token}", mapping={
        "tenant_id": "acme-corp",
        "rate_limit": "120",
        "permissions": "read,write",
    })
    print(f"已注册 API Key: {token}")

asyncio.run(main())
```

**要点**：
- `HTTPBearer` 是 FastAPI 内置的安全方案，自动解析 `Authorization: Bearer <token>` 头，缺失时返回 401
- Redis Hash 存储每个 token 的租户信息和权限，支持多租户隔离和差异化限流
- `Depends(auth.validate_token)` 让认证逻辑可复用于所有需要保护的端点，无需在每个路由中重复代码

---

### 练习 2：实现灰度发布

**思路**：在 docker-compose 中部署两个版本的 RAG API 容器，用 Nginx 的 `upstream` 配置权重路由（90% 流量到 v1，10% 到 v2），通过 Grafana 对比两个版本的延迟和错误率指标。

**答案**：

docker-compose 片段：

```yaml
services:
  rag-api-v1:
    build: .
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_URL=redis://redis:6379/0
      - QDRANT_URL=http://qdrant:6333
      - APP_VERSION=1.0.0
    depends_on:
      - redis
      - qdrant
    restart: unless-stopped

  rag-api-v2:
    build:
      context: .
      dockerfile: Dockerfile.v2
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_URL=redis://redis:6379/0
      - QDRANT_URL=http://qdrant:6333
      - APP_VERSION=2.0.0
    depends_on:
      - redis
      - qdrant
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - rag-api-v1
      - rag-api-v2
    restart: unless-stopped
```

`nginx.conf`：

```nginx
events {
    worker_connections 1024;
}

http {
    upstream rag_backend {
        server rag-api-v1:8000 weight=9;
        server rag-api-v2:8000 weight=1;
    }

    server {
        listen 80;

        location / {
            proxy_pass http://rag_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_buffering off;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
        }

        location /health {
            proxy_pass http://rag_backend/health;
        }
    }
}
```

Grafana 查询对比两个版本：

```promql
# v1 延迟 P95
histogram_quantile(0.95, rate(rag_request_duration_seconds_bucket{version="1.0.0"}[5m]))

# v2 延迟 P95
histogram_quantile(0.95, rate(rag_request_duration_seconds_bucket{version="2.0.0"}[5m]))

# v1 错误率
rate(rag_requests_total{status=~"5..",version="1.0.0"}[5m])

# v2 错误率
rate(rag_requests_total{status=~"5..",version="2.0.0"}[5m])
```

在 RAG API 的 metrics 中添加版本标签：

```python
# app/observability/metrics.py
from app.config import get_settings
APP_INFO.info({"version": get_settings().app_version})
```

**要点**：
- Nginx 的 `weight` 参数实现简单的按比例分流，weight=9:1 表示约 90% 流量到 v1、10% 到 v2
- `proxy_buffering off` 对 SSE 流式响应至关重要，否则 Nginx 会缓冲整个响应再发送，破坏流式体验
- 通过 Prometheus 的 version 标签区分两个版本的指标，在 Grafana 中用不同颜色的曲线对比延迟和错误率

---

### 练习 3：构建端到端健康检查

**思路**：实现 `/health/deep` 端点，并行检查 OpenAI API、Redis 和 Qdrant 三个依赖服务的连通性，记录每个组件的响应延迟，任一组件失败则返回 503。

**答案**：

```python
# app/health.py
import time
import asyncio
from fastapi import APIRouter, Response
from app.config import get_settings
from app.rag.engine import RAGEngine

router = APIRouter()

async def check_openai(engine: RAGEngine) -> dict:
    t0 = time.perf_counter()
    try:
        await engine.openai.embeddings.create(
            model="text-embedding-3-small", input="health check"
        )
        latency = (time.perf_counter() - t0) * 1000
        return {"status": "healthy", "latency_ms": round(latency, 1)}
    except Exception as e:
        latency = (time.perf_counter() - t0) * 1000
        return {"status": "unhealthy", "latency_ms": round(latency, 1), "error": str(e)}

async def check_redis(engine: RAGEngine) -> dict:
    t0 = time.perf_counter()
    try:
        test_key = "health:check:test"
        await engine.redis.set(test_key, "ok", ex=10)
        value = await engine.redis.get(test_key)
        await engine.redis.delete(test_key)
        assert value == "ok", f"Redis 读写不一致: expected 'ok', got '{value}'"
        latency = (time.perf_counter() - t0) * 1000
        return {"status": "healthy", "latency_ms": round(latency, 1)}
    except Exception as e:
        latency = (time.perf_counter() - t0) * 1000
        return {"status": "unhealthy", "latency_ms": round(latency, 1), "error": str(e)}

async def check_qdrant(engine: RAGEngine) -> dict:
    t0 = time.perf_counter()
    try:
        collections = await engine.qdrant.get_collections()
        names = [c.name for c in collections.collections]
        settings = get_settings()
        if settings.qdrant_collection not in names:
            raise RuntimeError(f"集合 {settings.qdrant_collection} 不存在")
        latency = (time.perf_counter() - t0) * 1000
        return {"status": "healthy", "latency_ms": round(latency, 1)}
    except Exception as e:
        latency = (time.perf_counter() - t0) * 1000
        return {"status": "unhealthy", "latency_ms": round(latency, 1), "error": str(e)}
```

在 `app/main.py` 中注册端点：

```python
from app.health import check_openai, check_redis, check_qdrant

@app.get("/health/deep")
async def deep_health(response: Response):
    results = await asyncio.gather(
        check_openai(engine),
        check_redis(engine),
        check_qdrant(engine),
        return_exceptions=False,
    )

    openai_status, redis_status, qdrant_status = results
    all_healthy = all(r["status"] == "healthy" for r in results)

    if not all_healthy:
        response.status_code = 503

    return {
        "status": "healthy" if all_healthy else "degraded",
        "components": {
            "openai": openai_status,
            "redis": redis_status,
            "qdrant": qdrant_status,
        },
        "total_latency_ms": round(
            max(r["latency_ms"] for r in results), 1
        ),
    }
```

**要点**：
- `asyncio.gather` 并行检查三个依赖服务，总延迟等于最慢的那个而非三者之和，健康检查本身不能成为性能瓶颈
- Redis 检测用"写入-读取-删除"三步验证，比单纯的 `ping` 更能发现实际的读写问题
- 任一组件失败时返回 503（Service Unavailable），负载均衡器收到 503 会自动将流量切到其他健康实例
