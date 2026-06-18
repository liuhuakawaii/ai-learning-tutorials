from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.session import ChatSession, Message
from app.models import Agent, Skill, KnowledgeBase, Workflow

router = APIRouter()


@router.get("/overview")
async def get_overview(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session_count = (await db.execute(select(func.count()).select_from(ChatSession))).scalar() or 0
    message_count = (await db.execute(select(func.count()).select_from(Message))).scalar() or 0
    agent_count = (await db.execute(select(func.count()).select_from(Agent))).scalar() or 0
    skill_count = (await db.execute(select(func.count()).select_from(Skill))).scalar() or 0
    kb_count = (await db.execute(select(func.count()).select_from(KnowledgeBase))).scalar() or 0
    workflow_count = (await db.execute(select(func.count()).select_from(Workflow))).scalar() or 0

    total_tokens_result = await db.execute(
        select(
            func.coalesce(func.sum(Message.input_tokens), 0),
            func.coalesce(func.sum(Message.output_tokens), 0),
            func.coalesce(func.sum(Message.cost), 0.0),
        )
    )
    row = total_tokens_result.one()
    total_input_tokens = row[0]
    total_output_tokens = row[1]
    total_cost = float(row[2])

    return {
        "sessions": session_count,
        "messages": message_count,
        "agents": agent_count,
        "skills": skill_count,
        "knowledge_bases": kb_count,
        "workflows": workflow_count,
        "total_input_tokens": total_input_tokens,
        "total_output_tokens": total_output_tokens,
        "total_cost": round(total_cost, 4),
    }


@router.get("/usage")
async def get_usage_stats(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from datetime import datetime, timedelta, timezone

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    daily_result = await db.execute(
        select(
            func.date(Message.created_at).label("date"),
            func.count().label("count"),
            func.coalesce(func.sum(Message.input_tokens + Message.output_tokens), 0).label("tokens"),
        )
        .where(Message.created_at >= cutoff)
        .group_by(func.date(Message.created_at))
        .order_by(func.date(Message.created_at))
    )
    daily = [
        {"date": str(row.date), "messages": row.count, "tokens": row.tokens}
        for row in daily_result.all()
    ]

    return {
        "period_days": days,
        "daily": daily,
    }


@router.get("/models")
async def get_model_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(
            Message.model,
            func.count().label("count"),
            func.coalesce(func.sum(Message.input_tokens), 0).label("input_tokens"),
            func.coalesce(func.sum(Message.output_tokens), 0).label("output_tokens"),
            func.coalesce(func.sum(Message.cost), 0.0).label("cost"),
        )
        .where(Message.model.isnot(None))
        .group_by(Message.model)
        .order_by(func.count().desc())
    )

    return [
        {
            "model": row.model,
            "count": row.count,
            "input_tokens": row.input_tokens,
            "output_tokens": row.output_tokens,
            "cost": round(float(row.cost), 4),
        }
        for row in result.all()
    ]
