# 第 28 课：阶段实战 — 电商图像自动化平台 MVP

## 场景引入

你在前面 7 课中学了批量生产架构、质量控制、图像资产管理、API 服务化、产品图自动化、营销素材自动化、设计系统集成。现在是把这些知识整合起来的时候了。

你所在的电商创业公司有一个明确的需求：运营团队每周要处理 200 个新品的图像，包括白底主图、场景图和营销 Banner。目前的流程是：运营把产品照片发给外包设计师，设计师用 Photoshop 手动处理，3-5 天后交付。每张图 50-100 元，一个月下来图像处理费用 4-8 万。

CTO 给你两周时间，要求你交付一个 MVP（最小可行产品）：运营人员上传产品照片，系统自动生成白底图、场景图和 Banner，支持批量处理，有简单的管理后台。不需要完美，但要能跑起来、能交付第一批图像。

本课是 Part 4 的阶段实战，我们将从零构建这个 MVP。这不是一个 demo——它有真实的任务队列、真实的图像存储、真实的 API 接口、真实的 Docker 部署。但 MVP 意味着我们要做取舍：先跑通核心流程，把"锦上添花"的功能留到 v2。

## 学习目标

完成本课后，你将能够：
1. 从需求分析到架构设计，完成一个图像自动化平台的 MVP
2. 实现 FastAPI + Celery + PostgreSQL + MinIO 的后端架构
3. 集成 ComfyUI 作为图像生成执行引擎
4. 构建任务队列和批量处理系统
5. 用 Docker Compose 实现一键部署
6. 理解 MVP 的取舍原则：先跑通再优化

## 一、需求分析与架构设计

### 1.1 核心功能规划

MVP 的核心原则是"够用就好"。我们不做大而全的平台，只做运营团队最需要的功能：

```
MVP 功能清单（按优先级排序）：

  P0 - 必须有：
  ├─ 产品图上传（支持批量）
  ├─ 白底图自动生成
  ├─ 场景图自动生成（3-4 种场景）
  ├─ 营销 Banner 自动生成
  ├─ 任务状态追踪
  └─ 生成结果下载

  P1 - 应该有：
  ├─ 质量自动检查
  ├─ 批量任务管理（暂停/重试）
  └─ API Key 认证

  P2 - 可以没有（v2 再做）：
  ├─ 用户注册/登录
  ├─ 在线预览和编辑
  ├─ 设计系统集成
  ├─ A/B 测试变体
  └─ 用量统计和计费
```

### 1.2 系统架构

```
系统架构图：

  ┌─────────────────────────────────────────────────────────┐
  │                      前端 (Vue3)                         │
  │                                                         │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
  │  │ 上传页面  │  │ 任务列表  │  │ 结果预览  │  │ 设置   │ │
  │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
  └────────────────────────┬────────────────────────────────┘
                           │ HTTP / WebSocket
                           ▼
  ┌─────────────────────────────────────────────────────────┐
  │                   后端 (FastAPI)                         │
  │                                                         │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
  │  │ 认证中间件    │  │ 任务 API     │  │ 资产 API     │  │
  │  │ API Key 验证  │  │ 创建/查询    │  │ 下载/搜索    │  │
  │  └──────────────┘  └──────────────┘  └──────────────┘  │
  │                                                         │
  │  ┌──────────────────────────────────────────────────┐   │
  │  │              Celery Worker                        │   │
  │  │                                                   │   │
  │  │  ┌───────────┐  ┌───────────┐  ┌──────────────┐  │   │
  │  │  │ 去背景     │  │ 场景生成   │  │ Banner 生成   │  │   │
  │  │  │ Worker    │  │ Worker    │  │ Worker       │  │   │
  │  │  └───────────┘  └───────────┘  └──────────────┘  │   │
  │  └──────────────────────────────────────────────────┘   │
  └──────────┬────────────┬────────────┬────────────────────┘
             │            │            │
             ▼            ▼            ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
  │  PostgreSQL   │ │    MinIO     │ │    ComfyUI       │
  │  任务/元数据   │ │  图像存储     │ │  图像生成引擎     │
  └──────────────┘ └──────────────┘ └──────────────────┘
```

### 1.3 数据模型设计

```python
"""
数据库模型定义
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Text,
    ForeignKey, JSON, Enum as SAEnum, create_engine,
)
from sqlalchemy.orm import DeclarativeBase, relationship, Session


class Base(DeclarativeBase):
    pass


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ImageType(str, Enum):
    WHITE_BG = "white_bg"
    SCENE_STUDIO = "scene_studio"
    SCENE_LIFESTYLE = "scene_lifestyle"
    SCENE_OUTDOOR = "scene_outdoor"
    SCENE_MINIMAL = "scene_minimal"
    BANNER_INSTAGRAM = "banner_instagram"
    BANNER_FACEBOOK = "banner_facebook"
    BANNER_XIAOHONGSHU = "banner_xiaohongshu"


class Job(Base):
    """批量任务"""
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(64), unique=True, nullable=False, index=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"))
    status = Column(SAEnum(TaskStatus), default=TaskStatus.PENDING)
    total_tasks = Column(Integer, default=0)
    completed_tasks = Column(Integer, default=0)
    failed_tasks = Column(Integer, default=0)
    config = Column(JSON)  # 任务配置（场景类型、尺寸等）
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tasks = relationship("Task", back_populates="job")
    api_key = relationship("ApiKey")


class Task(Base):
    """单个图像处理任务"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(64), unique=True, nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    image_type = Column(SAEnum(ImageType), nullable=False)
    status = Column(SAEnum(TaskStatus), default=TaskStatus.PENDING)
    input_image_url = Column(String(512))
    output_image_url = Column(String(512))
    quality_score = Column(Float, default=0.0)
    processing_time_ms = Column(Integer, default=0)
    error_message = Column(Text)
    metadata = Column(JSON)  # prompt、seed 等生成参数
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

    job = relationship("Job", back_populates="tasks")


class ApiKey(Base):
    """API Key 管理"""
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(128))
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime)
```

## 二、后端核心实现

### 2.1 FastAPI 应用与 API

```python
"""
FastAPI 主应用
"""

import uuid
import csv
import io
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

app = FastAPI(title="电商图像自动化平台", version="0.1.0")


# ─── Pydantic 模型 ──────────────────────────────────────

class JobCreateRequest(BaseModel):
    image_types: list[str] = [
        "white_bg", "scene_studio", "scene_lifestyle"
    ]
    scene_prompts: Optional[dict[str, str]] = None
    banner_config: Optional[dict] = None


class JobResponse(BaseModel):
    job_id: str
    status: str
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    created_at: str


class TaskResponse(BaseModel):
    task_id: str
    image_type: str
    status: str
    input_image_url: Optional[str]
    output_image_url: Optional[str]
    quality_score: float
    error_message: Optional[str]


# ─── 认证 ────────────────────────────────────────────────

async def verify_api_key(
    x_api_key: str = Header(...),
) -> "ApiKey":
    from database import get_db_session
    db = get_db_session()
    api_key = db.query(ApiKey).filter(
        ApiKey.key == x_api_key,
        ApiKey.is_active == 1,
    ).first()
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    api_key.last_used_at = datetime.utcnow()
    db.commit()
    return api_key


# ─── 任务 API ────────────────────────────────────────────

@app.post("/api/v1/jobs", response_model=JobResponse)
async def create_job(
    request: JobCreateRequest,
    api_key: ApiKey = Depends(verify_api_key),
):
    """创建批量任务（不含图像上传，图像通过单独接口上传）"""
    from database import get_db_session
    db = get_db_session()

    job = Job(
        job_id=f"job_{uuid.uuid4().hex[:12]}",
        api_key_id=api_key.id,
        status=TaskStatus.PENDING,
        config={
            "image_types": request.image_types,
            "scene_prompts": request.scene_prompts,
            "banner_config": request.banner_config,
        },
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return JobResponse(
        job_id=job.job_id,
        status=job.status.value,
        total_tasks=0,
        completed_tasks=0,
        failed_tasks=0,
        created_at=job.created_at.isoformat(),
    )


@app.post("/api/v1/jobs/{job_id}/images")
async def upload_images(
    job_id: str,
    files: list[UploadFile] = File(...),
    api_key: ApiKey = Depends(verify_api_key),
):
    """上传产品图像并创建处理任务"""
    from database import get_db_session
    from storage import upload_to_minio
    from worker import process_task

    db = get_db_session()
    job = db.query(Job).filter(Job.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    config = job.config or {}
    image_types = config.get("image_types", ["white_bg"])

    created_tasks = []
    for file in files:
        # 上传原图到 MinIO
        image_data = await file.read()
        input_url = upload_to_minio(
            bucket="inputs",
            filename=f"{job_id}/{file.filename}",
            data=image_data,
        )

        # 为每种图像类型创建一个任务
        for img_type in image_types:
            task = Task(
                task_id=f"task_{uuid.uuid4().hex[:12]}",
                job_id=job.id,
                image_type=ImageType(img_type),
                status=TaskStatus.PENDING,
                input_image_url=input_url,
                metadata={
                    "original_filename": file.filename,
                    "scene_prompts": config.get("scene_prompts"),
                    "banner_config": config.get("banner_config"),
                },
            )
            db.add(task)
            created_tasks.append(task)

    job.total_tasks = len(created_tasks)
    db.commit()

    # 异步提交任务到 Celery
    for task in created_tasks:
        process_task.delay(task.task_id)

    return {
        "job_id": job_id,
        "tasks_created": len(created_tasks),
        "total_images": len(files),
        "image_types": image_types,
    }


@app.get("/api/v1/jobs/{job_id}", response_model=JobResponse)
async def get_job_status(
    job_id: str,
    api_key: ApiKey = Depends(verify_api_key),
):
    from database import get_db_session
    db = get_db_session()

    job = db.query(Job).filter(Job.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobResponse(
        job_id=job.job_id,
        status=job.status.value,
        total_tasks=job.total_tasks,
        completed_tasks=job.completed_tasks,
        failed_tasks=job.failed_tasks,
        created_at=job.created_at.isoformat(),
    )


@app.get("/api/v1/jobs/{job_id}/tasks")
async def list_job_tasks(
    job_id: str,
    api_key: ApiKey = Depends(verify_api_key),
):
    from database import get_db_session
    db = get_db_session()

    job = db.query(Job).filter(Job.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    tasks = db.query(Task).filter(Task.job_id == job.id).all()
    return [
        TaskResponse(
            task_id=t.task_id,
            image_type=t.image_type.value,
            status=t.status.value,
            input_image_url=t.input_image_url,
            output_image_url=t.output_image_url,
            quality_score=t.quality_score,
            error_message=t.error_message,
        )
        for t in tasks
    ]


@app.get("/api/v1/tasks/{task_id}/download")
async def download_result(
    task_id: str,
    api_key: ApiKey = Depends(verify_api_key),
):
    from database import get_db_session
    from storage import download_from_minio

    db = get_db_session()
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Task not completed")
    if not task.output_image_url:
        raise HTTPException(status_code=404, detail="Output not found")

    image_data = download_from_minio(task.output_image_url)
    return StreamingResponse(
        io.BytesIO(image_data),
        media_type="image/jpeg",
        headers={
            "Content-Disposition": f"attachment; filename={task_id}.jpg"
        },
    )
```

### 2.2 Celery Worker 与任务执行

```python
"""
Celery Worker：执行图像处理任务
"""

import time
import traceback
from celery import Celery
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Celery 配置
celery_app = Celery(
    "image_pipeline",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/1",
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Shanghai",
    task_routes={
        "worker.process_task": {"queue": "default"},
    },
    worker_concurrency=2,  # GPU 限制，不能开太多并发
    worker_prefetch_multiplier=1,
)

# 数据库连接
DB_URL = "postgresql://postgres:postgres@postgres:5432/image_pipeline"
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise


@celery_app.task(bind=True, name="worker.process_task", max_retries=2)
def process_task(self, task_id: str):
    """执行单个图像处理任务"""
    db = get_db()
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        return {"error": "Task not found"}

    task.status = TaskStatus.PROCESSING
    db.commit()

    start_time = time.time()

    try:
        image_type = task.image_type
        input_url = task.input_image_url
        metadata = task.metadata or {}

        # 下载输入图像
        input_data = download_from_minio(input_url)
        input_path = f"/tmp/{task_id}_input.jpg"
        with open(input_path, "wb") as f:
            f.write(input_data)

        # 根据图像类型选择处理流程
        if image_type == ImageType.WHITE_BG:
            output_path = _process_white_bg(input_path, task_id)
        elif image_type.value.startswith("scene_"):
            scene_type = image_type.value.replace("scene_", "")
            output_path = _process_scene(
                input_path, task_id, scene_type, metadata
            )
        elif image_type.value.startswith("banner_"):
            platform = image_type.value.replace("banner_", "")
            output_path = _process_banner(
                input_path, task_id, platform, metadata
            )
        else:
            raise ValueError(f"Unknown image type: {image_type}")

        # 质量检查
        quality_score = _check_quality(output_path, image_type)

        # 上传结果
        with open(output_path, "rb") as f:
            output_data = f.read()
        output_url = upload_to_minio(
            bucket="outputs",
            filename=f"{task.job_id}/{task_id}.jpg",
            data=output_data,
        )

        # 更新任务状态
        processing_time = int((time.time() - start_time) * 1000)
        task.status = TaskStatus.COMPLETED
        task.output_image_url = output_url
        task.quality_score = quality_score
        task.processing_time_ms = processing_time
        task.completed_at = datetime.utcnow()
        db.commit()

        # 更新 Job 进度
        _update_job_progress(db, task.job_id)

        return {
            "task_id": task_id,
            "status": "completed",
            "quality_score": quality_score,
            "processing_time_ms": processing_time,
        }

    except Exception as e:
        task.status = TaskStatus.FAILED
        task.error_message = f"{str(e)}\n{traceback.format_exc()}"
        db.commit()
        _update_job_progress(db, task.job_id)

        # 重试逻辑
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=30)

        return {"task_id": task_id, "status": "failed", "error": str(e)}

    finally:
        db.close()


def _process_white_bg(input_path: str, task_id: str) -> str:
    """白底图处理流程"""
    # 使用 rembg 去背景
    from rembg import remove
    from PIL import Image

    input_img = Image.open(input_path).convert("RGBA")
    output_img = remove(input_img)

    # 合成白底
    bg = Image.new("RGB", output_img.size, (255, 255, 255))
    bg.paste(output_img, mask=output_img.split()[3])

    # 裁剪居中
    bg = _auto_crop(bg, target_size=(1600, 1600))

    output_path = f"/tmp/{task_id}_white_bg.jpg"
    bg.save(output_path, "JPEG", quality=95)
    return output_path


def _process_scene(
    input_path: str, task_id: str, scene_type: str, metadata: dict
) -> str:
    """场景图处理流程：通过 ComfyUI API 生成"""
    import requests
    from PIL import Image

    scene_prompts = metadata.get("scene_prompts") or {}
    default_prompts = {
        "studio": "professional product photography, studio lighting, "
                  "clean background, commercial, 8k",
        "lifestyle": "product in modern lifestyle setting, warm natural "
                     "lighting, wooden table, cozy, instagram style, 8k",
        "outdoor": "product in outdoor natural setting, golden hour, "
                   "bokeh background, fresh, 8k",
        "minimal": "product on minimal geometric background, soft "
                   "gradient, clean lines, modern, 8k",
    }

    prompt = scene_prompts.get(scene_type, default_prompts.get(scene_type, default_prompts["studio"]))

    # 调用 ComfyUI API
    workflow = _build_scene_workflow(input_path, prompt)
    resp = requests.post(
        "http://comfyui:8188/prompt",
        json={"prompt": workflow},
        timeout=300,
    )
    resp.raise_for_status()
    prompt_id = resp.json()["prompt_id"]

    # 等待结果
    output_filename = _wait_comfyui_result(prompt_id)
    output_path = f"/tmp/{task_id}_scene_{scene_type}.jpg"

    # 下载结果
    img_resp = requests.get(
        f"http://comfyui:8188/view?filename={output_filename}"
    )
    with open(output_path, "wb") as f:
        f.write(img_resp.content)

    return output_path


def _process_banner(
    input_path: str, task_id: str, platform: str, metadata: dict
) -> str:
    """Banner 生成流程"""
    from PIL import Image, ImageDraw, ImageFont

    config = metadata.get("banner_config") or {}
    headline = config.get("headline", "限时特惠")
    cta_text = config.get("cta_text", "立即抢购")

    # 平台尺寸
    sizes = {
        "instagram": (1080, 1080),
        "facebook": (1200, 628),
        "xiaohongshu": (1080, 1440),
    }
    w, h = sizes.get(platform, (1080, 1080))

    # 创建 Banner
    canvas = Image.new("RGB", (w, h), (30, 30, 60))
    draw = ImageDraw.Draw(canvas)

    # 渐变背景
    for y in range(h):
        r = int(30 + (60 - 30) * y / h)
        g = int(30 + (20 - 30) * y / h)
        b = int(60 + (90 - 60) * y / h)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # 放置产品图
    product = Image.open(input_path).convert("RGBA")
    product.thumbnail((w // 2, h // 2), Image.Resampling.LANCZOS)
    px = (w - product.size[0]) // 2
    py = h // 4 - product.size[1] // 2
    canvas.paste(product, (px, py), product if product.mode == "RGBA" else None)

    # 文字
    try:
        font_title = ImageFont.truetype("msyh.ttc", 48)
        font_cta = ImageFont.truetype("msyh.ttc", 28)
    except OSError:
        font_title = ImageFont.load_default()
        font_cta = ImageFont.load_default()

    # 标题居中
    bbox = draw.textbbox((0, 0), headline, font=font_title)
    tw = bbox[2] - bbox[0]
    draw.text(((w - tw) // 2, int(h * 0.65)), headline,
              fill=(255, 255, 255), font=font_title)

    # CTA 按钮
    cta_bbox = draw.textbbox((0, 0), cta_text, font=font_cta)
    cta_w = cta_bbox[2] - cta_bbox[0] + 40
    cta_h = cta_bbox[3] - cta_bbox[1] + 20
    cta_x = (w - cta_w) // 2
    cta_y = int(h * 0.8)
    draw.rounded_rectangle(
        (cta_x, cta_y, cta_x + cta_w, cta_y + cta_h),
        radius=25, fill=(255, 69, 0),
    )
    draw.text(
        (cta_x + 20, cta_y + 8), cta_text,
        fill=(255, 255, 255), font=font_cta,
    )

    output_path = f"/tmp/{task_id}_banner_{platform}.jpg"
    canvas.save(output_path, "JPEG", quality=95)
    return output_path


def _auto_crop(image, target_size=(1600, 1600)):
    """自动裁剪并居中"""
    img_array = __import__("numpy").array(image)
    gray = img_array.mean(axis=2)
    mask = gray < 250
    rows = __import__("numpy").any(mask, axis=1)
    cols = __import__("numpy").any(mask, axis=0)
    if not rows.any():
        return image.resize(target_size)

    np = __import__("numpy")
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    margin = 50
    rmin = max(0, rmin - margin)
    rmax = min(img_array.shape[0], rmax + margin)
    cmin = max(0, cmin - margin)
    cmax = min(img_array.shape[1], cmax + margin)

    cropped = image.crop((cmin, rmin, cmax, rmax))
    cropped.thumbnail(target_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", target_size, (255, 255, 255))
    offset_x = (target_size[0] - cropped.size[0]) // 2
    offset_y = (target_size[1] - cropped.size[1]) // 2
    canvas.paste(cropped, (offset_x, offset_y))
    return canvas


def _check_quality(output_path: str, image_type) -> float:
    """简单的质量评分"""
    from PIL import Image
    import numpy as np

    img = Image.open(output_path).convert("RGB")
    img_array = np.array(img)

    scores = []

    # 分辨率
    w, h = img.size
    scores.append(1.0 if w >= 800 and h >= 800 else 0.5)

    # 亮度
    brightness = img_array.mean()
    scores.append(1.0 if 80 < brightness < 200 else 0.6)

    # 对比度
    contrast = img_array.std()
    scores.append(min(contrast / 50, 1.0))

    # 白底图额外检查背景纯白度
    if image_type == ImageType.WHITE_BG:
        corners = [
            img_array[:10, :10].mean(),
            img_array[:10, -10:].mean(),
            img_array[-10:, :10].mean(),
            img_array[-10:, -10:].mean(),
        ]
        bg_score = min(np.mean(corners) / 255, 1.0)
        scores.append(bg_score)

    return round(float(np.mean(scores)), 3)


def _build_scene_workflow(image_path: str, prompt: str) -> dict:
    """构建 ComfyUI 工作流"""
    return {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": int(time.time()) % (2**32),
                "steps": 20,
                "cfg": 7.0,
                "sampler_name": "dpmpp_2m_sde",
                "scheduler": "karras",
                "denoise": 0.7,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0],
            },
        },
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "juggernautXL_v9.safetensors"},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 1024, "height": 1024, "batch_size": 1},
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["4", 1]},
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "blurry, distorted, low quality, text",
                "clip": ["4", 1],
            },
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["3", 0], "vae": ["4", 2]},
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": "scene", "images": ["8", 0]},
        },
    }


def _wait_comfyui_result(prompt_id: str, timeout: int = 300) -> str:
    """等待 ComfyUI 执行完成"""
    import requests as req
    start = time.time()
    while time.time() - start < timeout:
        resp = req.get(f"http://comfyui:8188/history/{prompt_id}")
        history = resp.json()
        if prompt_id in history:
            outputs = history[prompt_id]["outputs"]
            for node_id, output in outputs.items():
                if "images" in output:
                    return output["images"][0]["filename"]
        time.sleep(3)
    raise TimeoutError("ComfyUI 执行超时")


def _update_job_progress(db, job_id: int):
    """更新 Job 进度"""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return

    completed = db.query(Task).filter(
        Task.job_id == job_id,
        Task.status == TaskStatus.COMPLETED,
    ).count()
    failed = db.query(Task).filter(
        Task.job_id == job_id,
        Task.status == TaskStatus.FAILED,
    ).count()

    job.completed_tasks = completed
    job.failed_tasks = failed

    if completed + failed >= job.total_tasks:
        job.status = (
            TaskStatus.COMPLETED if failed == 0
            else TaskStatus.COMPLETED  # 部分失败也算完成
        )

    db.commit()
```

### 2.3 存储层

```python
"""
MinIO 存储层
"""

import os
from minio import Minio
from urllib.parse import urlparse

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")

minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False,
)

BUCKETS = ["inputs", "outputs", "temp"]


def ensure_buckets():
    for bucket in BUCKETS:
        if not minio_client.bucket_exists(bucket):
            minio_client.make_bucket(bucket)


def upload_to_minio(bucket: str, filename: str, data: bytes) -> str:
    """上传文件到 MinIO，返回访问 URL"""
    import io
    minio_client.put_object(
        bucket_name=bucket,
        object_name=filename,
        data=io.BytesIO(data),
        length=len(data),
        content_type="image/jpeg",
    )
    return f"http://{MINIO_ENDPOINT}/{bucket}/{filename}"


def download_from_minio(url: str) -> bytes:
    """从 MinIO 下载文件"""
    parsed = urlparse(url)
    path_parts = parsed.path.strip("/").split("/", 1)
    bucket = path_parts[0]
    object_name = path_parts[1] if len(path_parts) > 1 else ""

    response = minio_client.get_object(bucket, object_name)
    data = response.read()
    response.close()
    return data
```

## 三、前端管理界面

### 3.1 Vue3 管理后台核心页面

```vue
<!-- frontend/src/views/JobList.vue -->
<template>
  <div class="job-list">
    <div class="header">
      <h2>任务管理</h2>
      <button class="btn-primary" @click="showCreateDialog = true">
        新建任务
      </button>
    </div>

    <div class="job-cards">
      <div
        v-for="job in jobs"
        :key="job.job_id"
        class="job-card"
        :class="job.status"
      >
        <div class="job-header">
          <span class="job-id">{{ job.job_id }}</span>
          <span class="status-badge" :class="job.status">
            {{ statusLabels[job.status] }}
          </span>
        </div>

        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: progressPercent(job) + '%' }"
          ></div>
        </div>
        <div class="progress-text">
          {{ job.completed_tasks }} / {{ job.total_tasks }} 完成
          <span v-if="job.failed_tasks > 0" class="failed">
            ({{ job.failed_tasks }} 失败)
          </span>
        </div>

        <div class="job-actions">
          <button @click="viewTasks(job.job_id)">查看详情</button>
          <button @click="downloadAll(job.job_id)">打包下载</button>
        </div>
      </div>
    </div>

    <!-- 新建任务对话框 -->
    <div v-if="showCreateDialog" class="dialog-overlay">
      <div class="dialog">
        <h3>新建图像生成任务</h3>

        <div class="form-group">
          <label>上传产品图</label>
          <input
            type="file"
            multiple
            accept="image/*"
            @change="onFileSelect"
          />
          <div v-if="selectedFiles.length" class="file-list">
            已选择 {{ selectedFiles.length }} 个文件
          </div>
        </div>

        <div class="form-group">
          <label>生成类型</label>
          <div class="checkbox-group">
            <label v-for="t in imageTypes" :key="t.value">
              <input
                type="checkbox"
                v-model="t.checked"
              />
              {{ t.label }}
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>Banner 标题</label>
          <input v-model="bannerHeadline" placeholder="限时特惠" />
        </div>

        <div class="form-group">
          <label>CTA 文案</label>
          <input v-model="ctaText" placeholder="立即抢购" />
        </div>

        <div class="dialog-actions">
          <button @click="showCreateDialog = false">取消</button>
          <button class="btn-primary" @click="createJob">
            提交任务
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const API_BASE = import.meta.env.VITE_API_BASE || "/api/v1";
const apiKey = import.meta.env.VITE_API_KEY || "";

const jobs = ref([]);
const showCreateDialog = ref(false);
const selectedFiles = ref([]);
const bannerHeadline = ref("限时特惠");
const ctaText = ref("立即抢购");

const imageTypes = ref([
  { value: "white_bg", label: "白底图", checked: true },
  { value: "scene_studio", label: "工作室场景", checked: true },
  { value: "scene_lifestyle", label: "生活场景", checked: false },
  { value: "scene_minimal", label: "极简场景", checked: false },
  { value: "banner_instagram", label: "Instagram Banner", checked: false },
  { value: "banner_facebook", label: "Facebook Banner", checked: false },
]);

const statusLabels = {
  pending: "等待中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

function progressPercent(job) {
  if (job.total_tasks === 0) return 0;
  return Math.round(
    ((job.completed_tasks + job.failed_tasks) / job.total_tasks) * 100
  );
}

async function fetchJobs() {
  const resp = await fetch(`${API_BASE}/jobs`, {
    headers: { "X-API-Key": apiKey },
  });
  jobs.value = await resp.json();
}

function onFileSelect(event) {
  selectedFiles.value = Array.from(event.target.files);
}

async function createJob() {
  const types = imageTypes.value
    .filter((t) => t.checked)
    .map((t) => t.value);

  // 创建 Job
  const resp = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      image_types: types,
      banner_config: {
        headline: bannerHeadline.value,
        cta_text: ctaText.value,
      },
    }),
  });
  const job = await resp.json();

  // 上传图像
  const formData = new FormData();
  for (const file of selectedFiles.value) {
    formData.append("files", file);
  }

  await fetch(`${API_BASE}/jobs/${job.job_id}/images`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: formData,
  });

  showCreateDialog.value = false;
  await fetchJobs();
}

async function viewTasks(jobId) {
  window.location.href = `/jobs/${jobId}`;
}

async function downloadAll(jobId) {
  window.open(`${API_BASE}/jobs/${jobId}/download-all`, "_blank");
}

// 自动刷新
let refreshTimer;
onMounted(() => {
  fetchJobs();
  refreshTimer = setInterval(fetchJobs, 5000);
});
onUnmounted(() => clearInterval(refreshTimer));
</script>

<style scoped>
.job-list { padding: 24px; max-width: 1200px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.btn-primary { background: #18a0fb; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
.job-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
.job-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.job-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
.status-badge { padding: 4px 10px; border-radius: 12px; font-size: 12px; }
.status-badge.pending { background: #fff3cd; color: #856404; }
.status-badge.processing { background: #cce5ff; color: #004085; }
.status-badge.completed { background: #d4edda; color: #155724; }
.status-badge.failed { background: #f8d7da; color: #721c24; }
.progress-bar { height: 6px; background: #e9ecef; border-radius: 3px; margin-bottom: 8px; }
.progress-fill { height: 100%; background: #18a0fb; border-radius: 3px; transition: width 0.3s; }
.progress-text { font-size: 13px; color: #666; margin-bottom: 12px; }
.failed { color: #dc3545; }
.job-actions { display: flex; gap: 8px; }
.job-actions button { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer; }
.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: white; border-radius: 16px; padding: 32px; width: 480px; max-height: 80vh; overflow-y: auto; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-weight: 600; margin-bottom: 6px; }
.form-group input[type="text"], .form-group input[type="file"] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; }
.checkbox-group { display: flex; flex-wrap: wrap; gap: 12px; }
.checkbox-group label { font-weight: 400; display: flex; align-items: center; gap: 4px; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
</style>
```

## 四、Docker Compose 部署

### 4.1 一键部署配置

```yaml
# docker-compose.yml
version: "3.8"

services:
  # ─── 数据库 ────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: image_pipeline
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ─── Redis (Celery Broker) ────────────────────
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # ─── MinIO (对象存储) ─────────────────────────
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - miniodata:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  # ─── FastAPI 后端 ─────────────────────────────
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: >
      sh -c "
        python -c 'from database import init_db; init_db()' &&
        uvicorn main:app --host 0.0.0.0 --port 8000 --reload
      "
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/image_pipeline
      REDIS_URL: redis://redis:6379/0
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
      minio:
        condition: service_started
    volumes:
      - ./backend:/app

  # ─── Celery Worker ────────────────────────────
  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A worker.celery_app worker --loglevel=info --concurrency=2
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/image_pipeline
      REDIS_URL: redis://redis:6379/0
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    depends_on:
      - backend
      - redis
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  # ─── ComfyUI (图像生成引擎) ──────────────────
  comfyui:
    image: ghcr.io/comfyanonymous/comfyui:latest
    ports:
      - "8188:8188"
    volumes:
      - comfyui_models:/app/models
      - comfyui_output:/app/output
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  # ─── Vue3 前端 ────────────────────────────────
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  pgdata:
  miniodata:
  comfyui_models:
  comfyui_output:
```

### 4.2 后端 Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```
# backend/requirements.txt
fastapi==0.115.0
uvicorn==0.30.0
sqlalchemy==2.0.35
psycopg2-binary==2.9.9
celery==5.4.0
redis==5.0.0
minio==7.2.0
pillow==10.4.0
rembg==2.0.57
onnxruntime==1.18.0
numpy==1.26.0
python-multipart==0.0.9
```

## 五、测试与演示

### 5.1 端到端测试脚本

```python
"""
端到端测试：验证 MVP 完整流程
"""

import requests
import time
import os

API_BASE = "http://localhost:8000/api/v1"
API_KEY = "test-key-001"


def test_full_pipeline():
    """测试完整流程：创建任务 → 上传图像 → 等待处理 → 下载结果"""

    # 1. 创建任务
    print("Step 1: 创建任务...")
    resp = requests.post(
        f"{API_BASE}/jobs",
        headers={"X-API-Key": API_KEY},
        json={
            "image_types": ["white_bg", "scene_studio"],
            "banner_config": {
                "headline": "新品上市",
                "cta_text": "立即抢购",
            },
        },
    )
    assert resp.status_code == 200
    job = resp.json()
    job_id = job["job_id"]
    print(f"  Job 创建成功: {job_id}")

    # 2. 上传测试图像
    print("Step 2: 上传产品图...")
    test_images = []
    for img_path in ["test_product_1.jpg", "test_product_2.jpg"]:
        if os.path.exists(img_path):
            test_images.append(("files", (img_path, open(img_path, "rb"))))

    if not test_images:
        print("  ⚠️  没有测试图像，跳过上传")
        return

    resp = requests.post(
        f"{API_BASE}/jobs/{job_id}/images",
        headers={"X-API-Key": API_KEY},
        files=test_images,
    )
    assert resp.status_code == 200
    result = resp.json()
    print(f"  上传成功: {result['tasks_created']} 个任务已创建")

    # 3. 轮询任务状态
    print("Step 3: 等待处理完成...")
    max_wait = 300  # 5 分钟
    start = time.time()
    while time.time() - start < max_wait:
        resp = requests.get(
            f"{API_BASE}/jobs/{job_id}",
            headers={"X-API-Key": API_KEY},
        )
        job_status = resp.json()
        completed = job_status["completed_tasks"]
        total = job_status["total_tasks"]
        failed = job_status["failed_tasks"]

        print(f"  进度: {completed}/{total} 完成, {failed} 失败")

        if completed + failed >= total:
            break
        time.sleep(5)

    # 4. 查看任务详情
    print("Step 4: 查看任务详情...")
    resp = requests.get(
        f"{API_BASE}/jobs/{job_id}/tasks",
        headers={"X-API-Key": API_KEY},
    )
    tasks = resp.json()
    for t in tasks:
        print(
            f"  {t['task_id']}: {t['image_type']} → {t['status']} "
            f"(质量: {t['quality_score']})"
        )

    # 5. 下载结果
    print("Step 5: 下载结果...")
    for t in tasks:
        if t["status"] == "completed" and t["output_image_url"]:
            resp = requests.get(
                f"{API_BASE}/tasks/{t['task_id']}/download",
                headers={"X-API-Key": API_KEY},
            )
            output_path = f"output_{t['task_id']}.jpg"
            with open(output_path, "wb") as f:
                f.write(resp.content)
            print(f"  下载: {output_path} ({len(resp.content) // 1024}KB)")

    print("\n✅ 端到端测试完成！")


if __name__ == "__main__":
    test_full_pipeline()
```

### 5.2 MVP 的取舍与后续迭代

```
MVP 取舍总结：

  做了（v0.1）：
  ✅ 白底图自动生成
  ✅ 场景图生成（通过 ComfyUI）
  ✅ Banner 自动生成
  ✅ 批量任务队列
  ✅ 简单质量检查
  ✅ MinIO 对象存储
  ✅ Vue3 管理后台
  ✅ Docker Compose 部署
  ✅ API Key 认证

  没做（v2 计划）：
  ❌ 用户注册/登录系统
  ❌ 在线图像编辑器
  ❌ 高级质量控制（美学评分、人脸检测）
  ❌ IP-Adapter 产品一致性
  ❌ 虚拟试穿
  ❌ 设计系统集成（Figma Plugin）
  ❌ A/B 测试变体
  ❌ 用量计费
  ❌ WebSocket 实时进度
  ❌ 图像资产搜索

  迭代优先级建议：
  v0.2: WebSocket 实时进度 + 高级质量控制
  v0.3: IP-Adapter 产品一致性 + 虚拟试穿
  v0.4: 用户系统 + 用量计费
  v1.0: Figma Plugin + 设计系统集成
```

## 常见误区

### 误区一：功能贪多求全

MVP 最大的敌人是"再加一个功能"。你永远可以找到"还需要"的东西，但两周时间只够做核心流程。先把白底图 + 场景图 + Banner 三件事做好，其他都留到 v2。

### 误区二：不做错误处理

AI 生成不是 100% 成功的。ComfyUI 可能超时、GPU 可能 OOM、MinIO 可能断连。每个环节都要有 try/catch、重试机制和失败状态记录。没有错误处理的系统在生产环境中会变成"出了问题不知道哪里出了问题"。

### 误区三：忽略用户体验

运营人员不是工程师，他们不会看 API 文档。管理后台必须直观：上传图片 → 选类型 → 点按钮 → 等结果 → 下载。每一步都要有明确的状态反馈（loading、成功、失败、进度百分比）。

### 误区四：不同步 README.md

根据 AGENTS.md 规范，新增课程后必须更新 README.md 中对应的状态表。这是最容易忘记但最重要的事。

## 小结

本课从零构建了电商图像自动化平台的 MVP：

1. **架构**：FastAPI + Celery + PostgreSQL + MinIO + ComfyUI，Docker Compose 一键部署
2. **后端**：RESTful API、任务队列、质量检查、存储管理
3. **前端**：Vue3 管理后台，任务创建、状态追踪、结果下载
4. **取舍**：先跑通核心流程（白底图 + 场景图 + Banner），高级功能留到 v2

MVP 的核心价值不是"完美"，而是"跑通"。一旦系统能跑起来、能交付第一批图像，你就有了真实的用户反馈、真实的性能数据、真实的 bug 列表——这些才是驱动 v2 迭代的燃料。

## 练习

### 练习一：部署并运行 MVP

使用本课提供的 Docker Compose 配置，在本地部署整个 MVP 系统。准备 3 张产品照片，通过管理后台创建任务，生成白底图和场景图，下载结果并检查质量。

### 练习二：添加 WebSocket 实时进度

为 MVP 添加 WebSocket 支持，让前端能实时接收任务进度更新。提示：在 FastAPI 中用 `WebSocket` 端点，Worker 完成任务后通过 Redis Pub/Sub 通知 WebSocket 端点。

### 练习三：集成质量过滤器

为 Worker 添加质量过滤逻辑：白底图质量分数低于 0.7 的自动标记为"待审核"而不是"已完成"。在管理后台添加"待审核"标签页，让运营人员手动确认或拒绝。

---

## 参考答案

### 练习一

**思路**：按步骤执行 Docker Compose 启动 → 初始化 API Key → 上传图像 → 等待结果。关键是确保 GPU 驱动和 Docker NVIDIA runtime 已安装。

**答案**：

```bash
# 1. 克隆项目并进入目录
cd ai-image-pipeline-mvp

# 2. 启动所有服务
docker compose up -d

# 3. 等待服务就绪
sleep 10

# 4. 初始化数据库和 API Key
docker compose exec backend python -c "
from database import init_db, get_db_session
from models import ApiKey
init_db()
db = get_db_session()
key = ApiKey(key='test-key-001', name='测试密钥')
db.add(key)
db.commit()
print('API Key 创建成功: test-key-001')
"

# 5. 创建测试图像（如果没有现成的）
docker compose exec backend python -c "
from PIL import Image
img = Image.new('RGB', (800, 800), (200, 150, 100))
img.save('test_product.jpg')
print('测试图像已创建')
"

# 6. 运行端到端测试
python test_e2e.py

# 7. 查看结果
# 打开浏览器访问 http://localhost:3000 查看管理后台
# 打开 http://localhost:9001 查看 MinIO 存储
```

**要点**：
- Docker Compose 中 ComfyUI 和 Worker 都需要 GPU，确保 `nvidia-smi` 正常
- 首次启动 ComfyUI 会下载模型，可能需要较长时间
- 如果没有 GPU，可以将 Worker 的并发设为 0，只测试 Banner 生成（纯 CPU）

### 练习二

**思路**：FastAPI 原生支持 WebSocket。Worker 完成任务后将消息发布到 Redis channel，WebSocket 端点订阅该 channel 并转发给前端。

**答案**：

```python
# backend/websocket.py
import asyncio
import json
import redis.asyncio as aioredis
from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, job_id: str):
        await websocket.accept()
        self.active_connections.setdefault(job_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, job_id: str):
        if job_id in self.active_connections:
            self.active_connections[job_id].remove(websocket)

    async def broadcast(self, job_id: str, message: dict):
        for conn in self.active_connections.get(job_id, []):
            try:
                await conn.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await manager.connect(websocket, job_id)
    redis = aioredis.from_url("redis://redis:6379/0")
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"job_progress:{job_id}")

    try:
        # 同时监听 Redis 消息和客户端消息
        async def listen_redis():
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    await websocket.send_json(data)

        async def listen_client():
            while True:
                try:
                    await websocket.receive_text()
                except WebSocketDisconnect:
                    break

        await asyncio.gather(listen_redis(), listen_client())
    finally:
        manager.disconnect(websocket, job_id)
        await pubsub.unsubscribe()
        await redis.close()


# 在 worker.py 中添加 Redis 发布
def _notify_progress(task_id: str, job_id: int, status: str, progress: dict):
    import redis
    r = redis.Redis.from_url("redis://redis:6379/0")
    r.publish(
        f"job_progress:job_{job_id}",
        json.dumps({
            "task_id": task_id,
            "status": status,
            **progress,
        }),
    )


# 在 main.py 中注册 WebSocket 路由
# app.add_api_websocket_route("/ws/jobs/{job_id}", websocket_endpoint)
```

**要点**：
- 用 Redis Pub/Sub 解耦 Worker 和 WebSocket，Worker 不需要知道有多少客户端连接
- `asyncio.gather` 同时监听 Redis 消息和客户端消息，任何一方断开都能正确清理
- 前端用 `new WebSocket("ws://localhost:8000/ws/jobs/{job_id}")` 连接

### 练习三

**思路**：在 Worker 的 `_check_quality` 返回值基础上，增加一个"待审核"状态。质量分数低于阈值但不是明显失败的图，标记为 `pending_review`，在前端显示在单独的标签页中。

**答案**：

```python
# 在 models.py 中扩展 TaskStatus
class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PENDING_REVIEW = "pending_review"  # 新增


# 在 worker.py 的 process_task 中修改逻辑
def _should_review(quality_score: float, image_type) -> bool:
    """判断是否需要人工审核"""
    thresholds = {
        ImageType.WHITE_BG: 0.7,
        ImageType.SCENE_STUDIO: 0.65,
        ImageType.SCENE_LIFESTYLE: 0.65,
        ImageType.SCENE_OUTDOOR: 0.6,
        ImageType.SCENE_MINIMAL: 0.6,
    }
    threshold = thresholds.get(image_type, 0.65)
    return quality_score < threshold


# 在 process_task 的成功分支中
if _should_review(quality_score, image_type):
    task.status = TaskStatus.PENDING_REVIEW
else:
    task.status = TaskStatus.COMPLETED


# 在 API 中添加审核端点
@app.post("/api/v1/tasks/{task_id}/review")
async def review_task(
    task_id: str,
    action: str,  # "approve" or "reject"
    api_key: ApiKey = Depends(verify_api_key),
):
    db = get_db_session()
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    if task.status != TaskStatus.PENDING_REVIEW:
        raise HTTPException(400, "Task is not pending review")

    if action == "approve":
        task.status = TaskStatus.COMPLETED
    elif action == "reject":
        task.status = TaskStatus.FAILED
        task.error_message = "人工审核拒绝"
    else:
        raise HTTPException(400, "Invalid action")

    db.commit()
    _update_job_progress(db, task.job_id)
    return {"task_id": task_id, "new_status": task.status.value}
```

**要点**：
- 不是所有低质量图都是"失败"，有些可能只是"不够好但可以用"
- 人工审核是 AI 自动化的安全网，不能省略
- 审核结果要反馈到 Job 进度中，让运营知道整个批次的状态

**Files touched**: D:\CODE\personal-project\ai-learning-tutorials\ai-specialization\ai-image-workflow\part4-enterprise-image-pipeline\08-阶段实战-电商图像自动化平台MVP.md
**Findings worth promoting**: (none)
