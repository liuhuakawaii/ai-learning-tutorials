# 05 - RAG 可观测性

```
╔══════════════════════════════════════════════════════════╗
║  Stage 4 · Lesson 5                                     ║
║  RAG 可观测性 (Observability)                            ║
║  时长: 50 分钟                                          ║
╚══════════════════════════════════════════════════════════╝
```

## 前置要求

- 完成 Stage 4 Lesson 1-4
- 了解日志、指标、追踪三大支柱概念
- 基本的 Docker 操作能力

## 场景引入

凌晨三点你被报警电话叫醒，用户反馈 RAG 系统"回答质量突然变差了"。你打开日志，发现都是普通的 INFO 级别日志——"检索完成""生成完成"——完全看不出问题在哪里。是检索返回了错误的文档？还是 LLM 幻觉加重了？还是某个上游服务超时导致降级？没有可观测性，排查故障就像大海捞针。你需要结构化的日志、分布式追踪和实时指标，让系统的每一个环节都"透明可见"。

## 学习目标

1. **结构化日志** — 实现可查询、可聚合的结构化日志系统
2. **分布式追踪** — 追踪 RAG 请求的完整生命周期
3. **监控面板** — 构建 Grafana 可视化面板
4. **告警系统** — 设置智能告警规则

## 1. 可观测性三大支柱

```
RAG 可观测性架构
═══════════════════════════════════════════════════════════════

                    ┌─────────────────────────────────────┐
                    │          RAG Application            │
                    │                                     │
                    │  ┌──────────┐ ┌──────────┐ ┌──────┐│
                    │  │ Logs     │ │ Metrics  │ │Traces││
                    │  │ 结构化   │ │ 指标     │ │ 追踪  ││
                    │  │ 日志     │ │ 采集     │ │ 链路  ││
                    │  └────┬─────┘ └────┬─────┘ └───┬──┘│
                    └───────┼────────────┼───────────┼───┘
                            │            │           │
                ┌───────────┼────────────┼───────────┼────────┐
                │           ▼            ▼           ▼        │
                │  ┌─────────────┐ ┌──────────┐ ┌──────────┐ │
                │  │   Loki      │ │Prometheus│ │  Jaeger  │ │
                │  │   日志存储   │ │ 指标存储  │ │  追踪存储 │ │
                │  └──────┬──────┘ └─────┬────┘ └─────┬────┘ │
                │         │              │            │       │
                │         └──────────────┼────────────┘       │
                │                        ▼                    │
                │               ┌──────────────┐              │
                │               │   Grafana    │              │
                │               │   可视化面板  │              │
                │               └──────────────┘              │
                │                   │       │                 │
                │                   ▼       ▼                 │
                │            ┌──────┐  ┌────────┐             │
                │            │ 告警 │  │ 仪表盘  │             │
                │            └──────┘  └────────┘             │
                └─────────────────────────────────────────────┘
```

## 2. 结构化日志

### 2.1 日志设计

```python
import logging
import json
import time
import uuid
from typing import Optional
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="")

class StructuredFormatter(logging.Formatter):
    """结构化日志格式化器"""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get(""),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # 添加额外字段
        if hasattr(record, "extra_data"):
            log_entry.update(record.extra_data)

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, ensure_ascii=False)


class RAGLogger:
    """RAG 专用结构化日志器"""

    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)

        handler = logging.StreamHandler()
        handler.setFormatter(StructuredFormatter())
        self.logger.addHandler(handler)

    def _log(self, level: int, msg: str, **kwargs):
        extra = {"extra_data": kwargs}
        self.logger.log(level, msg, extra=extra)

    def query_start(self, query: str, user_id: str = None):
        self._log(logging.INFO, "Query started",
                  query=query, user_id=user_id, stage="start")

    def query_end(self, query: str, duration_ms: float,
                  result_count: int, from_cache: bool):
        self._log(logging.INFO, "Query completed",
                  query=query, duration_ms=duration_ms,
                  result_count=result_count, from_cache=from_cache,
                  stage="end")

    def retrieval(self, source: str, count: int, latency_ms: float):
        self._log(logging.DEBUG, "Retrieval completed",
                  source=source, count=count, latency_ms=latency_ms,
                  stage="retrieval")

    def embedding(self, text_count: int, latency_ms: float, model: str):
        self._log(logging.DEBUG, "Embedding completed",
                  text_count=text_count, latency_ms=latency_ms,
                  model=model, stage="embedding")

    def llm_call(self, model: str, prompt_tokens: int,
                 completion_tokens: int, latency_ms: float):
        self._log(logging.DEBUG, "LLM call completed",
                  model=model, prompt_tokens=prompt_tokens,
                  completion_tokens=completion_tokens,
                  latency_ms=latency_ms, stage="generation")

    def cache_hit(self, level: str, query: str):
        self._log(logging.INFO, "Cache hit",
                  cache_level=level, query=query, stage="cache")

    def cache_miss(self, query: str):
        self._log(logging.DEBUG, "Cache miss",
                  query=query, stage="cache")

    def security_threat(self, threat_type: str, query: str,
                         risk_score: float):
        self._log(logging.WARNING, "Security threat detected",
                  threat_type=threat_type, query=query,
                  risk_score=risk_score, stage="security")

    def error(self, msg: str, error: Exception, **kwargs):
        self._log(logging.ERROR, msg,
                  error_type=type(error).__name__,
                  error_message=str(error), **kwargs)
```

### 2.2 请求上下文追踪

```python
import contextvars
from functools import wraps
from typing import Callable, Any

class RequestContext:
    """请求上下文管理"""
    _request_id: contextvars.ContextVar[str] = contextvars.ContextVar("request_id")
    _user_id: contextvars.ContextVar[str] = contextvars.ContextVar("user_id")
    _start_time: contextvars.ContextVar[float] = contextvars.ContextVar("start_time")

    @classmethod
    def initialize(cls, request_id: str = None, user_id: str = None):
        cls._request_id.set(request_id or str(uuid.uuid4()))
        if user_id:
            cls._user_id.set(user_id)
        cls._start_time.set(time.time())

    @classmethod
    def get_request_id(cls) -> str:
        return cls._request_id.get("unknown")

    @classmethod
    def get_elapsed_ms(cls) -> float:
        start = cls._start_time.get(time.time())
        return (time.time() - start) * 1000


def with_request_context(func: Callable) -> Callable:
    """装饰器：自动设置请求上下文"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        RequestContext.initialize()
        try:
            return await func(*args, **kwargs)
        finally:
            pass  # 清理在 contextvars 生命周期内自动完成
    return wrapper
```

## 3. 分布式追踪

### 3.1 OpenTelemetry 集成

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.trace import Status, StatusCode
from typing import Optional

def setup_tracing(service_name: str = "rag-service",
                   otlp_endpoint: str = None) -> TracerProvider:
    """配置 OpenTelemetry 追踪"""
    resource = Resource.create({
        "service.name": service_name,
        "service.version": "1.0.0",
    })

    provider = TracerProvider(resource=resource)

    # 控制台输出（开发环境）
    provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    # OTLP 导出（生产环境）
    if otlp_endpoint:
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
        provider.add_span_processor(BatchSpanProcessor(exporter))

    trace.set_tracer_provider(provider)
    return provider


class RAGTracer:
    """RAG 专用追踪器"""

    def __init__(self, service_name: str = "rag-service"):
        self.tracer = trace.get_tracer(service_name)

    async def trace_query(self, query: str, func: Callable) -> Any:
        """追踪完整 RAG 查询"""
        with self.tracer.start_as_current_span(
            "rag.query",
            attributes={"query.text": query[:200]},
        ) as span:
            try:
                result = await func(query)
                span.set_status(Status(StatusCode.OK))
                return result
            except Exception as e:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
                raise

    async def trace_retrieval(self, query: str, source: str,
                               func: Callable) -> Any:
        """追踪检索阶段"""
        with self.tracer.start_as_current_span(
            f"rag.retrieval.{source}",
            attributes={
                "retrieval.source": source,
                "retrieval.query": query[:200],
            },
        ) as span:
            start = time.time()
            try:
                results = await func(query)
                latency = (time.time() - start) * 1000
                span.set_attribute("retrieval.result_count", len(results))
                span.set_attribute("retrieval.latency_ms", latency)
                span.set_status(Status(StatusCode.OK))
                return results
            except Exception as e:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
                raise

    async def trace_embedding(self, texts: list[str], model: str,
                               func: Callable) -> Any:
        """追踪 Embedding 阶段"""
        with self.tracer.start_as_current_span(
            "rag.embedding",
            attributes={
                "embedding.model": model,
                "embedding.input_count": len(texts),
            },
        ) as span:
            start = time.time()
            try:
                embeddings = await func(texts)
                latency = (time.time() - start) * 1000
                span.set_attribute("embedding.latency_ms", latency)
                span.set_attribute("embedding.output_dim", len(embeddings[0]))
                span.set_status(Status(StatusCode.OK))
                return embeddings
            except Exception as e:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
                raise

    async def trace_generation(self, model: str, prompt_tokens: int,
                                func: Callable) -> Any:
        """追踪生成阶段"""
        with self.tracer.start_as_current_span(
            "rag.generation",
            attributes={
                "generation.model": model,
                "generation.prompt_tokens": prompt_tokens,
            },
        ) as span:
            start = time.time()
            try:
                result = await func()
                latency = (time.time() - start) * 1000
                span.set_attribute("generation.latency_ms", latency)
                span.set_status(Status(StatusCode.OK))
                return result
            except Exception as e:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
                raise
```

## 4. 自定义指标

### 4.1 Prometheus 指标

```python
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import time

class RAGMetrics:
    """RAG 系统指标"""

    def __init__(self, port: int = 8001):
        # 查询指标
        self.query_total = Counter(
            "rag_query_total",
            "Total number of RAG queries",
            ["status", "from_cache"]
        )
        self.query_duration = Histogram(
            "rag_query_duration_seconds",
            "RAG query duration in seconds",
            buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
        )

        # 检索指标
        self.retrieval_duration = Histogram(
            "rag_retrieval_duration_seconds",
            "Retrieval duration in seconds",
            ["source"],
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0]
        )
        self.retrieval_results = Histogram(
            "rag_retrieval_results_count",
            "Number of retrieval results",
            ["source"],
            buckets=[1, 2, 5, 10, 20, 50]
        )

        # LLM 指标
        self.llm_tokens = Counter(
            "rag_llm_tokens_total",
            "Total LLM tokens used",
            ["type"]  # prompt, completion
        )
        self.llm_duration = Histogram(
            "rag_llm_duration_seconds",
            "LLM call duration in seconds",
            buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
        )
        self.llm_ttft = Histogram(
            "rag_llm_ttft_seconds",
            "Time to first token",
            buckets=[0.1, 0.25, 0.5, 1.0, 2.0]
        )

        # 缓存指标
        self.cache_operations = Counter(
            "rag_cache_operations_total",
            "Cache operations",
            ["level", "result"]  # level: l1/l2/l3, result: hit/miss
        )

        # 安全指标
        self.security_threats = Counter(
            "rag_security_threats_total",
            "Security threats detected",
            ["type"]
        )

        # 系统指标
        self.active_requests = Gauge(
            "rag_active_requests",
            "Number of active requests"
        )

        # 启动 metrics server
        start_http_server(port)

    def track_query(self, duration: float, status: str, from_cache: bool):
        self.query_total.labels(status=status, from_cache=str(from_cache)).inc()
        self.query_duration.observe(duration)

    def track_retrieval(self, source: str, duration: float, count: int):
        self.retrieval_duration.labels(source=source).observe(duration)
        self.retrieval_results.labels(source=source).observe(count)

    def track_llm(self, prompt_tokens: int, completion_tokens: int,
                   duration: float, ttft: float = None):
        self.llm_tokens.labels(type="prompt").inc(prompt_tokens)
        self.llm_tokens.labels(type="completion").inc(completion_tokens)
        self.llm_duration.observe(duration)
        if ttft is not None:
            self.llm_ttft.observe(ttft)

    def track_cache(self, level: str, hit: bool):
        self.cache_operations.labels(
            level=level, result="hit" if hit else "miss"
        ).inc()
```

### 4.2 带指标的 RAG Pipeline

```python
class InstrumentedRAGPipeline:
    """带完整可观测性的 RAG Pipeline"""

    def __init__(self, base_pipeline, metrics: RAGMetrics,
                 logger: RAGLogger, tracer: RAGTracer):
        self.pipeline = base_pipeline
        self.metrics = metrics
        self.logger = logger
        self.tracer = tracer

    async def query(self, question: str, user_id: str = None) -> dict:
        """带可观测性的 RAG 查询"""
        RequestContext.initialize(user_id=user_id)
        self.metrics.active_requests.inc()
        start = time.time()

        try:
            self.logger.query_start(question, user_id)

            result = await self.tracer.trace_query(
                question,
                lambda q: self.pipeline.query(q)
            )

            duration = time.time() - start
            self.metrics.track_query(duration, "success", result.get("from_cache", False))
            self.logger.query_end(question, duration * 1000,
                                  len(result.get("sources", [])),
                                  result.get("from_cache", False))
            return result

        except Exception as e:
            duration = time.time() - start
            self.metrics.track_query(duration, "error", False)
            self.logger.error("Query failed", e, query=question)
            raise
        finally:
            self.metrics.active_requests.dec()
```

## 5. Grafana 面板

### 5.1 RAG 仪表盘配置

```json
{
  "dashboard": {
    "title": "RAG System Dashboard",
    "panels": [
      {
        "title": "Query Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(rag_query_total[5m])",
            "legendFormat": "{{status}}"
          }
        ]
      },
      {
        "title": "Query Latency P95",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(rag_query_duration_seconds_bucket[5m]))",
            "legendFormat": "P95"
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "type": "gauge",
        "targets": [
          {
            "expr": "rate(rag_cache_operations_total{result='hit'}[5m]) / rate(rag_cache_operations_total[5m])",
            "legendFormat": "Hit Rate"
          }
        ]
      },
      {
        "title": "LLM TTFT",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(rag_llm_ttft_seconds_bucket[5m]))",
            "legendFormat": "P95 TTFT"
          }
        ]
      },
      {
        "title": "Security Threats",
        "type": "stat",
        "targets": [
          {
            "expr": "increase(rag_security_threats_total[1h])",
            "legendFormat": "Threats (1h)"
          }
        ]
      }
    ]
  }
}
```

## 6. 工具对比

| 特性 | LangSmith | Phoenix | 自定义方案 |
|------|-----------|---------|------------|
| **部署方式** | SaaS | 自托管 | 自托管 |
| **追踪深度** | LLM 层面 | 全链路 | 全链路 |
| **成本** | 按量付费 | 免费 | 基础设施成本 |
| **集成难度** | 低 | 中 | 高 |
| **可视化** | 内置 | 内置 | 需自建 Grafana |
| **数据所有权** | 第三方 | 自有 | 自有 |
| **适用场景** | 快速原型 | 生产环境 | 定制需求 |

## 7. 常见误区

### ❌ 错误 1: 日志没有结构化

```python
# 错误：纯文本日志，无法查询和聚合
logger.info(f"Query {query} took {duration}ms, got {count} results")

# 正确：结构化 JSON 日志
logger.info("Query completed", extra={
    "extra_data": {"query": query, "duration_ms": duration, "count": count}
})
```

### ❌ 错误 2: 追踪粒度太粗

```python
# 错误：只追踪整个查询，看不到内部瓶颈
with tracer.start_span("query"):
    result = await rag.query(question)

# 正确：细粒度追踪每个阶段
with tracer.start_span("query"):
    with tracer.start_span("embedding"):
        embedding = await embed(question)
    with tracer.start_span("retrieval"):
        results = await retrieve(embedding)
    with tracer.start_span("generation"):
        answer = await generate(results)
```

### ❌ 错误 3: 告警阈值不合理

```python
# 错误：阈值太低，频繁误报
alert("High latency", when="p95_latency > 0.5s")  # 正常波动就会触发

# 正确：基于历史数据设置合理阈值
alert("High latency", when="p95_latency > 3s for 5m")  # 持续高延迟才告警
```

## 8. 工程建议

1. **日志要包含检索上下文**：每条 RAG 请求的日志必须包含：查询文本、检索到的 Top-K 文档 ID 和相似度分数、最终生成的答案。没有这些信息，排查问题时根本无法复现。
2. **追踪要覆盖全链路**：从用户查询到最终回答，中间经过的 Embedding、检索、Reranker、LLM 生成每个环节都要有独立的 Span，耗时和状态清晰可见。
3. **设置关键指标的告警阈值**：检索延迟 p99 超过 500ms、LLM 调用失败率超过 1%、缓存命中率突降 20% 以上——这些都应该触发告警，而不是等用户投诉才发现。
4. **可观测性本身也有成本**：全量 Trace 和详细日志会增加存储开销和性能开销。建议生产环境只对 10-20% 的请求采样全量 Trace，对错误请求 100% 采样。

---

## 9. 本课总结

```
RAG 可观测性要点
═══════════════════════════════════════════════

  1. 三大支柱缺一不可
     └─ 日志 + 指标 + 追踪

  2. 结构化日志是基础
     └─ JSON 格式，可查询可聚合

  3. 追踪覆盖完整链路
     └─ 从用户查询到 LLM 响应

  4. 指标聚焦关键 SLI
     └─ 延迟、吞吐、错误率、TTFT

  5. 告警基于 SLO
     └─ 不是"出问题就告警"，而是"违反 SLO 才告警"
```

## 10. 练习

### 练习 1: 实现结构化日志

基于本课的 `RAGLogger`，实现：
- 支持多种输出格式（JSON、文本）
- 添加日志采样（高频日志降采样）
- 实现日志聚合查询接口

### 练习 2: 构建 Grafana 仪表盘

使用 Docker 运行 Grafana + Prometheus，创建 RAG 监控面板：
- 查询速率和延迟图表
- 缓存命中率仪表盘
- LLM token 使用统计
- 安全威胁计数器

### 练习 3: 端到端追踪

为你的 RAG Pipeline 添加完整的 OpenTelemetry 追踪：
- 每个阶段独立 span
- 错误自动记录
- 导出到 Jaeger UI 查看追踪详情

---

**下一步**: [06 - 阶段实战：部署生产级 RAG](./06-阶段实战-部署生产级RAG.md)
