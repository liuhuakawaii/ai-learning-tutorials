# 02 FastAPI 后端从零开始

> 好的 API 设计，是前后端协作的第一道防线。

## 学习目标

- 掌握 FastAPI 的路由、请求体、响应模型设计
- 理解依赖注入系统并灵活运用
- 实现中间件（CORS、日志、错误处理）
- 写出有生产质量的 API 代码

## 前置要求

- 已完成第 1 课环境搭建
- Python 基础（函数、类、装饰器）
- HTTP 协议基础（GET/POST/PUT/DELETE、状态码、Header）

## 从一个最小 API 开始

```python
# backend/app/main.py
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(
    title="AI Agent Platform",
    description="企业级 AI Agent 平台后端 API",
    version="0.1.0",
)

# ---- Schema 定义 ----

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000, description="用户消息")
    session_id: str | None = Field(None, description="会话 ID，为空则创建新会话")

class ChatResponse(BaseModel):
    reply: str
    session_id: str
    token_usage: int = 0

# ---- 路由 ----

@app.post("/api/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    session_id = request.session_id or "new-session-123"
    return ChatResponse(
        reply=f"收到：{request.message}",
        session_id=session_id,
        token_usage=len(request.message),
    )
```

跑起来看看：

```bash
cd backend
pip install fastapi uvicorn pydantic
uvicorn app.main:app --reload --port 8000
```

访问 http://localhost:8000/docs，你会看到自动生成的 Swagger 文档。这就是 FastAPI 的威力——你写代码，它帮你写文档。

## 路由设计：RESTful 不是教条

AI 应用的 API 和传统 CRUD 有些不同。对话是流式的，Agent 是异步的，知识库是批量操作的。设计 API 时要面向业务，不是面向数据库表。

```python
# backend/app/api/v1/chat.py
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.chat import ChatRequest, ChatResponse, SessionListResponse
from app.services.chat_service import ChatService

router = APIRouter(prefix="/api/v1/chat", tags=["对话"])

# ---- 会话管理 ----

@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    page: int = 1,
    size: int = 20,
    chat_service: ChatService = Depends(),
):
    """获取会话列表"""
    return await chat_service.list_sessions(page=page, size=size)

@router.post("/sessions", response_model=ChatResponse, status_code=201)
async def create_session(
    request: ChatRequest,
    chat_service: ChatService = Depends(),
):
    """创建新会话并发送第一条消息"""
    return await chat_service.create_session(request)

# ---- 消息 ----

@router.post("/sessions/{session_id}/messages", response_model=ChatResponse)
async def send_message(
    session_id: str,
    request: ChatRequest,
    chat_service: ChatService = Depends(),
):
    """在已有会话中发送消息"""
    return await chat_service.send_message(session_id, request)

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    chat_service: ChatService = Depends(),
):
    """删除会话"""
    await chat_service.delete_session(session_id)
    return {"ok": True}
```

### API 设计原则

1. **资源用名词，动作用 HTTP 方法**：`POST /chat/sessions` 而不是 `POST /createSession`
2. **版本号放 URL**：`/api/v1/...` 方便未来升级
3. **列表接口必须分页**：永远不要返回无限长度的数组
4. **错误用标准 HTTP 状态码**：400 参数错误、401 未认证、403 无权限、404 不存在、500 服务器错误

## Pydantic Schema：你的 API 合约

Pydantic 不只是"数据校验"——它是前后端之间的合约。前端看到 Schema，就知道该传什么、会收到什么。

```python
# backend/app/schemas/chat.py
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class ChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="用户消息内容",
        examples=["帮我总结一下上周的销售数据"],
    )
    session_id: str | None = Field(None, description="会话 ID")

class MessageResponse(BaseModel):
    id: str
    role: MessageRole
    content: str
    created_at: datetime
    token_usage: int = 0

class ChatResponse(BaseModel):
    session_id: str
    message: MessageResponse

class SessionInfo(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int

class SessionListResponse(BaseModel):
    items: list[SessionInfo]
    total: int
    page: int
    size: int
```

### Schema 设计技巧

- **用 `Field` 加描述和示例**：Swagger 文档会自动显示，前端开发看文档就够了
- **用 `Enum` 限定可选值**：比字符串 `"user" | "assistant"` 更安全
- **响应模型和请求模型分开**：请求里有 `password`，响应里不该有
- **列表接口返回分页信息**：`items` + `total` + `page` + `size`

## 依赖注入：FastAPI 的灵魂

FastAPI 的依赖注入系统是它最强大的特性之一。用好它，代码会非常干净。

```python
# backend/app/api/deps.py
from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_token

async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    """从 JWT token 获取当前用户"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    
    token = authorization.removeprefix("Bearer ")
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user = await db.get(User, payload["sub"])
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

async def get_chat_service(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatService:
    """获取对话服务实例"""
    return ChatService(db=db, user=current_user)
```

在路由中使用：

```python
@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: str,
    request: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),  # 自动注入
):
    return await chat_service.send_message(session_id, request)
```

依赖注入的好处：

- **路由函数只关心业务逻辑**，不需要手动创建数据库连接、验证用户身份
- **依赖可以嵌套**：`get_chat_service` 依赖 `get_db` 和 `get_current_user`
- **测试时容易 mock**：替换依赖就行，不用改业务代码

## 中间件：请求的拦截器

```python
# backend/app/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
import logging

logger = logging.getLogger(__name__)

app = FastAPI()

# CORS：前端跨域请求必须配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # 前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 请求日志中间件
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start
    
    logger.info(
        f"{request.method} {request.url.path} "
        f"→ {response.status_code} ({duration:.3f}s)"
    )
    
    # 响应头加上处理时间
    response.headers["X-Process-Time"] = f"{duration:.3f}"
    return response

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
```

## 错误处理：不要让前端猜

```python
# backend/app/core/exceptions.py
from fastapi import HTTPException

class AppException(HTTPException):
    """应用级异常基类"""
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(status_code=status_code, detail=message)
        self.code = code

class NotFoundError(AppException):
    def __init__(self, resource: str, id: str):
        super().__init__(404, "NOT_FOUND", f"{resource} {id} not found")

class PermissionError(AppException):
    def __init__(self, action: str):
        super().__init__(403, "FORBIDDEN", f"No permission to {action}")

class RateLimitError(AppException):
    def __init__(self):
        super().__init__(429, "RATE_LIMITED", "Too many requests")
```

使用：

```python
@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    chat_service: ChatService = Depends(get_chat_service),
):
    session = await chat_service.get_session(session_id)
    if not session:
        raise NotFoundError("Session", session_id)
    return session
```

## 练习

### 练习 1：API 设计

为以下业务场景设计 API：

1. 用户注册和登录
2. 创建、查询、删除对话会话
3. 发送消息并获取回复

要求：
- 用 Pydantic 定义请求和响应 Schema
- 用 `Field` 添加描述和示例
- 用标准 HTTP 状态码
- 用 `tags` 分组路由

### 练习 2：中间件

实现以下中间件：

1. 请求日志（记录方法、路径、状态码、耗时）
2. 错误处理（统一返回格式）
3. CORS 配置

### 练习 3：依赖注入

实现一个 `get_pagination` 依赖：

```python
async def get_pagination(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> dict:
    return {"page": page, "size": size, "offset": (page - 1) * size}
```

在列表接口中使用它。

## 本节要点

- FastAPI 的 Pydantic 校验 + 自动文档 = 前后端协作效率翻倍
- 依赖注入让代码干净、可测试、可复用
- 中间件是横切关注点（日志、CORS、错误处理）的最佳载体
- 错误处理要统一格式，让前端能可靠地解析

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `422 Unprocessable Entity` | 请求参数不符合 Schema 定义 | 检查请求体字段名和类型 |
| CORS 错误 | 前端和后端不在同一域名 | 配置 CORSMiddleware |
| `Depends()` 不生效 | 忘记导入或函数签名错误 | 检查 `Depends(get_xxx)` 的函数是否正确 |
| 中间件顺序错误 | 中间件注册顺序影响执行顺序 | 日志中间件放最前面 |
