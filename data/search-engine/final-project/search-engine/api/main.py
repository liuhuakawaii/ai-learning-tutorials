"""FastAPI 应用入口

搜索引擎的 Web API 服务入口，负责：
- 创建 FastAPI 应用实例
- 配置 CORS 中间件
- 注册路由
- 应用生命周期管理（启动时初始化 ES 连接等）
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """创建并配置 FastAPI 应用

    Returns:
        配置完成的 FastAPI 实例
    """
    app = FastAPI(
        title="搜索引擎 API",
        description="基于 Elasticsearch 和 FAISS 的混合搜索引擎，支持中文分词、BM25/向量检索、LTR 排序",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # 配置 CORS（允许前端跨域调用）
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由
    app.include_router(router, prefix="/api/v1")

    @app.on_event("startup")
    async def startup():
        """应用启动时的初始化操作"""
        logger.info("搜索引擎服务启动中...")
        # 这里可以初始化 ES 连接、加载模型等
        logger.info("搜索引擎服务已就绪")

    @app.on_event("shutdown")
    async def shutdown():
        """应用关闭时的清理操作"""
        logger.info("搜索引擎服务关闭")

    @app.get("/")
    async def root():
        """健康检查端点"""
        return {"status": "ok", "service": "搜索引擎 API", "version": "1.0.0"}

    return app


# 创建应用实例（uvicorn 直接引用）
app = create_app()
