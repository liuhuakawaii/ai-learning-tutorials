from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import engine, Base
from app.core.redis import close_redis
from app.api.v1 import auth, chat, agents, knowledge, workflows, skills, stats
from app.core.metrics import setup_metrics

from app.models.user import User
from app.models.session import ChatSession, Message
from app.models import Agent, Skill, KnowledgeBase, Document, Workflow


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title="AI Agent Platform",
    description="企业级 AI Agent 平台",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_metrics(app)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["对话"])
app.include_router(agents.router, prefix="/api/v1/agents", tags=["Agent"])
app.include_router(knowledge.router, prefix="/api/v1/knowledge", tags=["知识库"])
app.include_router(workflows.router, prefix="/api/v1/workflows", tags=["工作流"])
app.include_router(skills.router, prefix="/api/v1/skills", tags=["Skill"])
app.include_router(stats.router, prefix="/api/v1/stats", tags=["统计"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-agent-platform"}
