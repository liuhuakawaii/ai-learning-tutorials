from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models import Agent
from pydantic import BaseModel
import uuid

router = APIRouter()


class AgentCreateRequest(BaseModel):
    name: str
    description: str = ""
    system_prompt: str = "你是一个有帮助的 AI 助手。"
    model: str = "gpt-4o-mini"
    temperature: float = 0.7
    max_tokens: int = 4096
    tools: list | None = None


class AgentUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    tools: list | None = None
    is_published: bool | None = None


class AgentResponse(BaseModel):
    id: str
    name: str
    description: str
    system_prompt: str
    model: str
    temperature: float
    max_tokens: int
    tools: list | None
    is_published: bool
    version: int
    created_by: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.get("/")
async def list_agents(
    page: int = 1,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    offset = (page - 1) * size
    count_result = await db.execute(select(func.count()).select_from(Agent))
    total = count_result.scalar()

    result = await db.execute(
        select(Agent).order_by(Agent.created_at.desc()).offset(offset).limit(size)
    )
    agents = result.scalars().all()

    return {
        "items": [AgentResponse.model_validate(a) for a in agents],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/", status_code=201)
async def create_agent(
    request: AgentCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agent = Agent(
        id=str(uuid.uuid4()),
        name=request.name,
        description=request.description,
        system_prompt=request.system_prompt,
        model=request.model,
        temperature=request.temperature,
        max_tokens=request.max_tokens,
        tools=request.tools,
        created_by=user.id,
    )
    db.add(agent)
    await db.flush()
    return AgentResponse.model_validate(agent)


@router.get("/{agent_id}")
async def get_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent 不存在")
    return AgentResponse.model_validate(agent)


@router.put("/{agent_id}")
async def update_agent(
    agent_id: str,
    request: AgentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent 不存在")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(agent, field, value)

    if request.is_published is not None and request.is_published and not agent.is_published:
        agent.version += 1

    await db.flush()
    return AgentResponse.model_validate(agent)


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent 不存在")
    await db.delete(agent)


@router.post("/{agent_id}/publish")
async def publish_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent 不存在")

    agent.is_published = True
    agent.version += 1
    await db.flush()
    return AgentResponse.model_validate(agent)
