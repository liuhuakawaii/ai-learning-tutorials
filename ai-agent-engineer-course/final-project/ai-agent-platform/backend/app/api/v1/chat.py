from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.session import ChatSession, Message
from app.services.llm_service import LLMService
from pydantic import BaseModel
import json
import uuid

router = APIRouter()
llm_service = LLMService()


class CreateSessionRequest(BaseModel):
    message: str
    agent_id: str | None = None


class SendMessageRequest(BaseModel):
    message: str
    model: str | None = None


class SessionResponse(BaseModel):
    id: str
    title: str
    agent_id: str | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    model: str | None
    input_tokens: int
    output_tokens: int
    cost: float
    latency_ms: int
    user_feedback: str | None
    created_at: str

    class Config:
        from_attributes = True


@router.get("/sessions")
async def list_sessions(
    page: int = 1,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    offset = (page - 1) * size
    count_result = await db.execute(
        select(func.count()).select_from(ChatSession).where(ChatSession.user_id == user.id)
    )
    total = count_result.scalar()

    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
        .offset(offset)
        .limit(size)
    )
    sessions = result.scalars().all()

    return {
        "items": [SessionResponse.model_validate(s) for s in sessions],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/sessions", status_code=201)
async def create_session(
    request: CreateSessionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = ChatSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title=request.message[:50],
        agent_id=request.agent_id,
    )
    db.add(session)

    user_msg = Message(
        id=str(uuid.uuid4()),
        session_id=session.id,
        role="user",
        content=request.message,
    )
    db.add(user_msg)

    ai_response = await llm_service.chat(
        messages=[
            {"role": "system", "content": "你是一个有帮助的 AI 助手。"},
            {"role": "user", "content": request.message},
        ]
    )

    ai_msg = Message(
        id=str(uuid.uuid4()),
        session_id=session.id,
        role="assistant",
        content=ai_response["content"],
        model=ai_response.get("model"),
        input_tokens=ai_response["input_tokens"],
        output_tokens=ai_response["output_tokens"],
        cost=ai_response["cost"],
        latency_ms=ai_response["latency_ms"],
    )
    db.add(ai_msg)
    await db.flush()

    return {
        "session_id": session.id,
        "message": MessageResponse.model_validate(ai_msg),
    }


@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: str,
    request: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "会话不存在")

    user_msg = Message(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role="user",
        content=request.message,
    )
    db.add(user_msg)

    history_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
        .limit(20)
    )
    history = history_result.scalars().all()

    messages = [{"role": "system", "content": "你是一个有帮助的 AI 助手。"}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.message})

    ai_response = await llm_service.chat(messages=messages, model=request.model)

    ai_msg = Message(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role="assistant",
        content=ai_response["content"],
        model=ai_response.get("model"),
        input_tokens=ai_response["input_tokens"],
        output_tokens=ai_response["output_tokens"],
        cost=ai_response["cost"],
        latency_ms=ai_response["latency_ms"],
    )
    db.add(ai_msg)
    await db.flush()

    return {
        "session_id": session_id,
        "message": MessageResponse.model_validate(ai_msg),
    }


@router.post("/sessions/{session_id}/messages/stream")
async def stream_message(
    session_id: str,
    request: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "会话不存在")

    user_msg = Message(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role="user",
        content=request.message,
    )
    db.add(user_msg)

    history_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
        .limit(20)
    )
    history = history_result.scalars().all()

    messages = [{"role": "system", "content": "你是一个有帮助的 AI 助手。"}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.message})

    async def event_generator():
        full_content = ""
        async for chunk in llm_service.stream_chat(messages=messages, model=request.model):
            full_content += chunk
            yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

        ai_msg = Message(
            id=str(uuid.uuid4()),
            session_id=session_id,
            role="assistant",
            content=full_content,
            model=request.model,
            input_tokens=0,
            output_tokens=0,
            cost=0.0,
            latency_ms=0,
        )
        db.add(ai_msg)
        await db.flush()

        yield f"data: {json.dumps({'done': True, 'message_id': ai_msg.id}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/sessions/{session_id}/messages")
async def list_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "会话不存在")

    msg_result = await db.execute(
        select(Message).where(Message.session_id == session_id).order_by(Message.created_at)
    )
    messages = msg_result.scalars().all()

    return [MessageResponse.model_validate(m) for m in messages]


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "会话不存在")

    await db.delete(session)


@router.get("/models")
async def list_models():
    return llm_service.get_available_models()
