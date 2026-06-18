from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models import KnowledgeBase, Document
from pydantic import BaseModel
import uuid
import os

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class KBCreateRequest(BaseModel):
    name: str
    description: str = ""


class KBResponse(BaseModel):
    id: str
    name: str
    description: str
    document_count: int
    chunk_count: int
    status: str
    created_by: str
    created_at: str

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: str
    knowledge_base_id: str
    filename: str
    file_type: str
    file_size: int
    chunk_count: int
    status: str
    created_at: str

    class Config:
        from_attributes = True


@router.get("/")
async def list_knowledge_bases(
    page: int = 1,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    offset = (page - 1) * size
    count_result = await db.execute(select(func.count()).select_from(KnowledgeBase))
    total = count_result.scalar()

    result = await db.execute(
        select(KnowledgeBase).order_by(KnowledgeBase.created_at.desc()).offset(offset).limit(size)
    )
    kbs = result.scalars().all()

    return {
        "items": [KBResponse.model_validate(kb) for kb in kbs],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/", status_code=201)
async def create_knowledge_base(
    request: KBCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    kb = KnowledgeBase(
        id=str(uuid.uuid4()),
        name=request.name,
        description=request.description,
        created_by=user.id,
    )
    db.add(kb)
    await db.flush()
    return KBResponse.model_validate(kb)


@router.get("/{kb_id}")
async def get_knowledge_base(
    kb_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(404, "知识库不存在")
    return KBResponse.model_validate(kb)


@router.delete("/{kb_id}", status_code=204)
async def delete_knowledge_base(
    kb_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(404, "知识库不存在")
    await db.delete(kb)


@router.post("/{kb_id}/documents", status_code=201)
async def upload_document(
    kb_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(404, "知识库不存在")

    file_ext = os.path.splitext(file.filename or "unknown")[1].lower()
    file_type_map = {".pdf": "pdf", ".docx": "word", ".doc": "word", ".md": "markdown", ".txt": "text", ".html": "html"}
    file_type = file_type_map.get(file_ext, "unknown")

    content = await file.read()
    file_size = len(content)

    save_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}{file_ext}")
    with open(save_path, "wb") as f:
        f.write(content)

    doc = Document(
        id=str(uuid.uuid4()),
        knowledge_base_id=kb_id,
        filename=file.filename or "unknown",
        file_type=file_type,
        file_size=file_size,
        chunk_count=0,
        status="uploaded",
    )
    db.add(doc)

    kb.document_count += 1
    await db.flush()

    return DocumentResponse.model_validate(doc)


@router.get("/{kb_id}/documents")
async def list_documents(
    kb_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document)
        .where(Document.knowledge_base_id == kb_id)
        .order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()
    return [DocumentResponse.model_validate(d) for d in docs]


@router.delete("/{kb_id}/documents/{doc_id}", status_code=204)
async def delete_document(
    kb_id: str,
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.knowledge_base_id == kb_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "文档不存在")

    kb_result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
    kb = kb_result.scalar_one_or_none()
    if kb:
        kb.document_count = max(0, kb.document_count - 1)

    await db.delete(doc)


@router.post("/{kb_id}/query")
async def query_knowledge_base(
    kb_id: str,
    request: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = request.get("query", "")
    if not query:
        raise HTTPException(400, "查询内容不能为空")

    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(404, "知识库不存在")

    return {
        "answer": f"知识库「{kb.name}」的 RAG 功能正在开发中。你的问题是：{query}",
        "sources": [],
        "confidence": 0.0,
    }
