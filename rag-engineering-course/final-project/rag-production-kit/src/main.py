"""RAG Production Kit - FastAPI 应用

生产级 RAG API 服务，支持：
- 文档查询
- 流式输出
- 健康检查
- 指标暴露
"""

import logging
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("RAG 服务启动中...")
    # Initialize resources (vector DB connection, models, etc.)
    yield
    logger.info("RAG 服务关闭中...")
    # Cleanup resources


app = FastAPI(
    title="RAG Production Kit",
    description="生产级 RAG 系统 API",
    version="0.1.0",
    lifespan=lifespan,
)


class QueryRequest(BaseModel):
    """查询请求"""
    question: str
    top_k: int = 5
    stream: bool = False
    use_rerank: bool = True


class QueryResponse(BaseModel):
    """查询响应"""
    answer: str
    sources: list[dict]
    latency_ms: float


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    version: str
    components: dict


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """健康检查接口"""
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        components={
            "vector_db": "ok",
            "llm": "ok",
            "cache": "ok",
        },
    )


@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """查询接口（非流式）"""
    start_time = time.time()

    try:
        # Placeholder: in production, use actual retrieval and generation
        # from retrieve import HybridRetriever
        # from generate import RAGGenerator

        # retriever = HybridRetriever()
        # generator = RAGGenerator()

        # results = retriever.search(request.question, top_k=request.top_k)
        # answer = generator.generate(request.question, results)

        answer = f"这是关于 '{request.question}' 的示例答案。请配置实际的 RAG 管道。"
        sources = [{"source": "placeholder", "score": 0.0}]

        latency_ms = (time.time() - start_time) * 1000

        return QueryResponse(
            answer=answer,
            sources=sources,
            latency_ms=latency_ms,
        )

    except Exception as e:
        logger.error(f"查询失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query/stream")
async def query_stream(request: QueryRequest):
    """流式查询接口"""
    start_time = time.time()

    async def generate_stream():
        # Placeholder: in production, use actual streaming generation
        tokens = ["这是", "流式", "输出", "的", "示例。", "请配置", "实际的", "RAG 管道。"]
        for token in tokens:
            yield f"data: {token}\n\n"
        yield f"data: [DONE]\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
    )


@app.get("/metrics")
async def metrics():
    """Prometheus 格式指标"""
    metrics_text = """# HELP rag_query_total Total number of queries
# TYPE rag_query_total counter
rag_query_total 0

# HELP rag_query_latency_seconds Query latency in seconds
# TYPE rag_query_latency_seconds histogram
rag_query_latency_seconds_bucket{{le="0.5"}} 0
rag_query_latency_seconds_bucket{{le="1.0"}} 0
rag_query_latency_seconds_bucket{{le="2.0"}} 0
rag_query_latency_seconds_bucket{{le="5.0"}} 0
rag_query_latency_seconds_bucket{{le="+Inf"}} 0

# HELP rag_retrieval_hits_total Retrieval hits
# TYPE rag_retrieval_hits_total counter
rag_retrieval_hits_total 0
"""
    return metrics_text


def main():
    """启动服务"""
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()
