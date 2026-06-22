from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import sqlite3
from pathlib import Path

from backend.config import DB_PATH, DATA_DIR
from backend.api.chat import router as chat_router
from backend.api.data import router as data_router
from backend.api.eval import router as eval_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DB_PATH.exists():
        from backend.data.seed import init_database
        init_database()
    yield


app = FastAPI(
    title="AI 数据分析平台",
    description="多 Agent 驱动的智能数据分析平台",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
app.include_router(data_router, prefix="/api/data", tags=["data"])
app.include_router(eval_router, prefix="/api/eval", tags=["eval"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
