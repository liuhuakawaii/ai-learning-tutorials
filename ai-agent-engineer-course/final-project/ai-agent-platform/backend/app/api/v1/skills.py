from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models import Skill
from pydantic import BaseModel
import uuid

router = APIRouter()


class SkillCreateRequest(BaseModel):
    name: str
    description: str = ""
    type: str = "api"
    parameters: dict = {}
    config: dict = {}
    requires_approval: bool = False


class SkillUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    type: str | None = None
    parameters: dict | None = None
    config: dict | None = None
    is_enabled: bool | None = None
    requires_approval: bool | None = None


class SkillResponse(BaseModel):
    id: str
    name: str
    description: str
    type: str
    parameters: dict
    config: dict
    is_enabled: bool
    requires_approval: bool
    created_at: str

    class Config:
        from_attributes = True


@router.get("/")
async def list_skills(
    page: int = 1,
    size: int = 20,
    type: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    offset = (page - 1) * size
    query = select(Skill)
    count_query = select(func.count()).select_from(Skill)

    if type:
        query = query.where(Skill.type == type)
        count_query = count_query.where(Skill.type == type)

    count_result = await db.execute(count_query)
    total = count_result.scalar()

    result = await db.execute(
        query.order_by(Skill.created_at.desc()).offset(offset).limit(size)
    )
    skills = result.scalars().all()

    return {
        "items": [SkillResponse.model_validate(s) for s in skills],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/", status_code=201)
async def create_skill(
    request: SkillCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if request.type not in ("api", "script", "workflow", "mcp"):
        raise HTTPException(400, "Skill 类型必须是 api/script/workflow/mcp 之一")

    skill = Skill(
        id=str(uuid.uuid4()),
        name=request.name,
        description=request.description,
        type=request.type,
        parameters=request.parameters,
        config=request.config,
        requires_approval=request.requires_approval,
    )
    db.add(skill)
    await db.flush()
    return SkillResponse.model_validate(skill)


@router.get("/{skill_id}")
async def get_skill(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(404, "Skill 不存在")
    return SkillResponse.model_validate(skill)


@router.put("/{skill_id}")
async def update_skill(
    skill_id: str,
    request: SkillUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(404, "Skill 不存在")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(skill, field, value)

    await db.flush()
    return SkillResponse.model_validate(skill)


@router.delete("/{skill_id}", status_code=204)
async def delete_skill(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(404, "Skill 不存在")
    await db.delete(skill)


@router.post("/{skill_id}/test")
async def test_skill(
    skill_id: str,
    request: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(404, "Skill 不存在")

    return {
        "skill_id": skill.id,
        "skill_name": skill.name,
        "skill_type": skill.type,
        "status": "test_ok",
        "message": "Skill 测试功能正在开发中，当前返回模拟结果",
        "input": request,
    }
