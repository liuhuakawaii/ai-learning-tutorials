from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models import Workflow
from pydantic import BaseModel
import uuid

router = APIRouter()


class WorkflowCreateRequest(BaseModel):
    name: str
    description: str = ""
    nodes: list = []
    edges: list = []
    variables: dict = {}


class WorkflowUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    nodes: list | None = None
    edges: list | None = None
    variables: dict | None = None
    is_active: bool | None = None


class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: str
    nodes: list
    edges: list
    variables: dict
    version: int
    is_active: bool
    created_by: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.get("/")
async def list_workflows(
    page: int = 1,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    offset = (page - 1) * size
    count_result = await db.execute(select(func.count()).select_from(Workflow))
    total = count_result.scalar()

    result = await db.execute(
        select(Workflow).order_by(Workflow.created_at.desc()).offset(offset).limit(size)
    )
    workflows = result.scalars().all()

    return {
        "items": [WorkflowResponse.model_validate(w) for w in workflows],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/", status_code=201)
async def create_workflow(
    request: WorkflowCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    workflow = Workflow(
        id=str(uuid.uuid4()),
        name=request.name,
        description=request.description,
        nodes=request.nodes,
        edges=request.edges,
        variables=request.variables,
        created_by=user.id,
    )
    db.add(workflow)
    await db.flush()
    return WorkflowResponse.model_validate(workflow)


@router.get("/{workflow_id}")
async def get_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "工作流不存在")
    return WorkflowResponse.model_validate(workflow)


@router.put("/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    request: WorkflowUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "工作流不存在")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(workflow, field, value)

    workflow.version += 1
    await db.flush()
    return WorkflowResponse.model_validate(workflow)


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "工作流不存在")
    await db.delete(workflow)


@router.post("/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "工作流不存在")

    if not workflow.nodes:
        raise HTTPException(400, "工作流没有节点，无法执行")

    return {
        "execution_id": str(uuid.uuid4()),
        "workflow_id": workflow.id,
        "status": "started",
        "message": "工作流执行引擎正在开发中，当前返回模拟结果",
    }
