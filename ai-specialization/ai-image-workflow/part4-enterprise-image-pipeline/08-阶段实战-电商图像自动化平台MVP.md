# 第 28 课：阶段实战 — 电商图像自动化平台 MVP

运营团队每周处理 200 个新品图像：白底主图、场景图、营销 Banner。目前流程是运营发照片给外包设计师，3-5 天后交付，每张 50-100 元，月费 4-8 万。

CTO 给你两周，要求交付 MVP：运营上传产品照片，系统自动生成白底图、场景图和 Banner，支持批量处理，有管理后台。不需要完美，但要能跑起来、能交付第一批图像。

## 功能规划

```
P0 必须有：
├─ 产品图上传（批量）
├─ 白底图自动生成
├─ 场景图自动生成（3-4 种场景）
├─ Banner 自动生成
├─ 任务状态追踪
└─ 结果下载

P1 应该有：
├─ 质量自动检查
├─ 批量任务管理（暂停/重试）
└─ API Key 认证

P2 v2 再做：
├─ 用户注册/登录
├─ 在线编辑
├─ A/B 测试
└─ 用量计费
```

## 系统架构

```
┌─────────────────────────────────────────┐
│            前端 (Vue3)                   │
│  上传页面 | 任务列表 | 结果预览 | 设置    │
└────────────────┬────────────────────────┘
                 │ HTTP
                 ▼
┌─────────────────────────────────────────┐
│           后端 (FastAPI)                 │
│  认证 | 任务 API | 资产 API              │
│  ┌─────────────────────────────────┐    │
│  │        Celery Worker            │    │
│  │  去背景 | 场景生成 | Banner 生成  │    │
│  └─────────────────────────────────┘    │
└──────┬──────────┬──────────┬────────────┘
       ▼          ▼          ▼
  PostgreSQL    MinIO      ComfyUI
  任务/元数据   图像存储    生成引擎
```

## 数据模型

```python
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.orm import DeclarativeBase, relationship

class Base(DeclarativeBase): pass

class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ImageType(str, Enum):
    WHITE_BG = "white_bg"
    SCENE_STUDIO = "scene_studio"
    SCENE_LIFESTYLE = "scene_lifestyle"
    BANNER_INSTAGRAM = "banner_instagram"

class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True)
    job_id = Column(String(64), unique=True, index=True)
    status = Column(SAEnum(TaskStatus), default=TaskStatus.PENDING)
    total_tasks = Column(Integer, default=0)
    completed_tasks = Column(Integer, default=0)
    failed_tasks = Column(Integer, default=0)
    config = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    tasks = relationship("Task", back_populates="job")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True)
    task_id = Column(String(64), unique=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    image_type = Column(SAEnum(ImageType))
    status = Column(SAEnum(TaskStatus), default=TaskStatus.PENDING)
    input_image_url = Column(String(512))
    output_image_url = Column(String(512))
    quality_score = Column(Float, default=0.0)
    processing_time_ms = Column(Integer, default=0)
    error_message = Column(Text)
    metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    job = relationship("Job", back_populates="tasks")
```

## FastAPI 后端

```python
import uuid
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Header
from pydantic import BaseModel

app = FastAPI(title="电商图像自动化平台", version="0.1.0")

class JobCreateRequest(BaseModel):
    image_types: list[str] = ["white_bg", "scene_studio"]
    banner_config: dict | None = None

async def verify_api_key(x_api_key: str = Header(...)):
    from database import get_db
    db = get_db()
    key = db.query(ApiKey).filter(ApiKey.key == x_api_key, ApiKey.is_active == 1).first()
    if not key:
        raise HTTPException(401, "Invalid API Key")
    return key

@app.post("/api/v1/jobs")
async def create_job(req: JobCreateRequest, api_key=Depends(verify_api_key)):
    from database import get_db
    db = get_db()
    job = Job(
        job_id=f"job_{uuid.uuid4().hex[:12]}",
        status=TaskStatus.PENDING,
        config={"image_types": req.image_types, "banner_config": req.banner_config},
    )
    db.add(job)
    db.commit()
    return {"job_id": job.job_id, "status": "pending"}

@app.post("/api/v1/jobs/{job_id}/images")
async def upload_images(job_id: str, files: list[UploadFile] = File(...),
                        api_key=Depends(verify_api_key)):
    from database import get_db
    from storage import upload_to_minio
    from worker import process_task

    db = get_db()
    job = db.query(Job).filter(Job.job_id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    types = (job.config or {}).get("image_types", ["white_bg"])
    created = []

    for f in files:
        data = await f.read()
        url = upload_to_minio("inputs", f"{job_id}/{f.filename}", data)
        for img_type in types:
            task = Task(
                task_id=f"task_{uuid.uuid4().hex[:12]}",
                job_id=job.id, image_type=ImageType(img_type),
                input_image_url=url,
                metadata={"original_filename": f.filename},
            )
            db.add(task)
            created.append(task)

    job.total_tasks = len(created)
    db.commit()

    for t in created:
        process_task.delay(t.task_id)

    return {"tasks_created": len(created)}

@app.get("/api/v1/jobs/{job_id}")
async def get_job(job_id: str, api_key=Depends(verify_api_key)):
    from database import get_db
    db = get_db()
    job = db.query(Job).filter(Job.job_id == job_id).first()
    if not job:
        raise HTTPException(404)
    return {"job_id": job.job_id, "status": job.status.value,
            "total": job.total_tasks, "completed": job.completed_tasks,
            "failed": job.failed_tasks}

@app.get("/api/v1/tasks/{task_id}/download")
async def download(task_id: str, api_key=Depends(verify_api_key)):
    from database import get_db
    from storage import download_from_minio
    from fastapi.responses import StreamingResponse
    import io

    db = get_db()
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task or task.status != TaskStatus.COMPLETED:
        raise HTTPException(404)
    data = download_from_minio(task.output_image_url)
    return StreamingResponse(io.BytesIO(data), media_type="image/jpeg")
```

## Celery Worker

```python
from celery import Celery
import time, traceback

celery_app = Celery("image_pipeline", broker="redis://redis:6379/0")
celery_app.conf.update(worker_concurrency=2, worker_prefetch_multiplier=1)

@celery_app.task(bind=True, max_retries=2)
def process_task(self, task_id):
    from database import get_db
    db = get_db()
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        return

    task.status = TaskStatus.PROCESSING
    db.commit()
    start = time.time()

    try:
        input_data = download_from_minio(task.input_image_url)
        input_path = f"/tmp/{task_id}_input.jpg"
        with open(input_path, "wb") as f:
            f.write(input_data)

        if task.image_type == ImageType.WHITE_BG:
            output_path = process_white_bg(input_path, task_id)
        elif task.image_type.value.startswith("scene_"):
            output_path = process_scene(input_path, task_id, task.metadata)
        elif task.image_type.value.startswith("banner_"):
            output_path = process_banner(input_path, task_id, task.metadata)
        else:
            raise ValueError(f"Unknown type: {task.image_type}")

        quality = check_quality(output_path)
        output_url = upload_to_minio("outputs", f"{task.job_id}/{task_id}.jpg",
                                     open(output_path, "rb").read())

        task.status = TaskStatus.COMPLETED
        task.output_image_url = output_url
        task.quality_score = quality
        task.processing_time_ms = int((time.time() - start) * 1000)
        db.commit()
        update_job_progress(db, task.job_id)

    except Exception as e:
        task.status = TaskStatus.FAILED
        task.error_message = str(e)
        db.commit()
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=30)


def process_white_bg(input_path, task_id):
    from rembg import remove
    from PIL import Image

    img = Image.open(input_path).convert("RGBA")
    result = remove(img)
    bg = Image.new("RGB", result.size, (255, 255, 255))
    bg.paste(result, mask=result.split()[3])

    # 自动裁剪居中
    bg = auto_crop(bg, (1600, 1600))
    out = f"/tmp/{task_id}_white_bg.jpg"
    bg.save(out, "JPEG", quality=95)
    return out


def process_scene(input_path, task_id, metadata):
    """通过 ComfyUI API 生成场景图"""
    import requests

    prompts = {
        "studio": "professional product photography, studio lighting, 8k",
        "lifestyle": "product in modern setting, warm lighting, cozy, 8k",
        "outdoor": "product in outdoor setting, golden hour, bokeh, 8k",
        "minimal": "product on minimal background, soft gradient, modern, 8k",
    }
    scene_type = metadata.get("scene_type", "studio")
    prompt = prompts.get(scene_type, prompts["studio"])

    workflow = build_scene_workflow(input_path, prompt)
    resp = requests.post("http://comfyui:8188/prompt",
                        json={"prompt": workflow}, timeout=300)
    prompt_id = resp.json()["prompt_id"]

    filename = wait_comfyui(prompt_id)
    out = f"/tmp/{task_id}_scene.jpg"
    img = requests.get(f"http://comfyui:8188/view?filename={filename}")
    with open(out, "wb") as f:
        f.write(img.content)
    return out


def process_banner(input_path, task_id, metadata):
    from PIL import Image, ImageDraw, ImageFont

    config = metadata.get("banner_config") or {}
    headline = config.get("headline", "限时特惠")
    cta = config.get("cta_text", "立即抢购")

    w, h = 1080, 1080
    canvas = Image.new("RGB", (w, h), (30, 30, 60))
    draw = ImageDraw.Draw(canvas)

    # 渐变背景
    for y in range(h):
        r = int(30 + 30 * y / h)
        b = int(60 + 30 * y / h)
        draw.line([(0, y), (w, y)], fill=(r, 30, b))

    # 产品图
    product = Image.open(input_path).convert("RGBA")
    product.thumbnail((w // 2, h // 2), Image.LANCZOS)
    px = (w - product.size[0]) // 2
    canvas.paste(product, (px, h // 4 - product.size[1] // 2),
                 product if product.mode == "RGBA" else None)

    # 文字
    try:
        font = ImageFont.truetype("msyh.ttc", 48)
    except OSError:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), headline, font=font)
    draw.text(((w - bbox[2] + bbox[0]) // 2, int(h * 0.65)),
              headline, fill=(255, 255, 255), font=font)

    # CTA 按钮
    cta_w, cta_h = 200, 50
    cta_x, cta_y = (w - cta_w) // 2, int(h * 0.8)
    draw.rounded_rectangle((cta_x, cta_y, cta_x + cta_w, cta_y + cta_h),
                          radius=25, fill=(255, 69, 0))
    draw.text((cta_x + 40, cta_y + 10), cta, fill=(255, 255, 255), font=font)

    out = f"/tmp/{task_id}_banner.jpg"
    canvas.save(out, "JPEG", quality=95)
    return out


def check_quality(path):
    import numpy as np
    from PIL import Image
    img = np.array(Image.open(path).convert("RGB"))
    scores = [1.0 if min(img.shape[:2]) >= 800 else 0.5]
    brightness = img.mean()
    scores.append(1.0 if 80 < brightness < 200 else 0.6)
    scores.append(min(img.std() / 50, 1.0))
    return round(float(np.mean(scores)), 3)


def build_scene_workflow(image_path, prompt):
    return {
        "3": {"class_type": "KSampler", "inputs": {
            "seed": int(time.time()) % (2**32), "steps": 20, "cfg": 7.0,
            "sampler_name": "dpmpp_2m_sde", "denoise": 0.7,
            "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0],
            "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple",
              "inputs": {"ckpt_name": "juggernautXL_v9.safetensors"}},
        "5": {"class_type": "EmptyLatentImage",
              "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode",
              "inputs": {"text": prompt, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode",
              "inputs": {"text": "blurry, low quality", "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode",
              "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage",
              "inputs": {"filename_prefix": "scene", "images": ["8", 0]}},
    }


def wait_comfyui(prompt_id, timeout=300):
    import requests as req
    start = time.time()
    while time.time() - start < timeout:
        resp = req.get(f"http://comfyui:8188/history/{prompt_id}")
        history = resp.json()
        if prompt_id in history:
            for out in history[prompt_id]["outputs"].values():
                if "images" in out:
                    return out["images"][0]["filename"]
        time.sleep(3)
    raise TimeoutError("ComfyUI 超时")


def update_job_progress(db, job_id):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return
    completed = db.query(Task).filter(Task.job_id == job_id, Task.status == TaskStatus.COMPLETED).count()
    failed = db.query(Task).filter(Task.job_id == job_id, Task.status == TaskStatus.FAILED).count()
    job.completed_tasks = completed
    job.failed_tasks = failed
    if completed + failed >= job.total_tasks:
        job.status = TaskStatus.COMPLETED
    db.commit()
```

## Docker Compose 部署

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: image_pipeline
      POSTGRES_PASSWORD: postgres
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes: [miniodata:/data]
    ports: ["9000:9000", "9001:9001"]

  backend:
    build: ./backend
    command: uvicorn main:app --host 0.0.0.0 --port 8000
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/image_pipeline
      REDIS_URL: redis://redis:6379/0
      MINIO_ENDPOINT: minio:9000
    ports: ["8000:8000"]
    depends_on: [postgres, redis, minio]

  worker:
    build: ./backend
    command: celery -A worker.celery_app worker --concurrency=2
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/image_pipeline
      REDIS_URL: redis://redis:6379/0
    depends_on: [backend, redis]
    deploy:
      resources:
        reservations:
          devices: [{driver: nvidia, count: 1, capabilities: [gpu]}]

  comfyui:
    image: ghcr.io/comfyanonymous/comfyui:latest
    ports: ["8188:8188"]
    volumes: [comfyui_models:/app/models]
    deploy:
      resources:
        reservations:
          devices: [{driver: nvidia, count: 1, capabilities: [gpu]}]

  frontend:
    build: ./frontend
    ports: ["3000:80"]
    depends_on: [backend]

volumes:
  pgdata:
  miniodata:
  comfyui_models:
```

## 端到端测试

```python
import requests, time, os

API = "http://localhost:8000/api/v1"
KEY = "test-key-001"

def test_pipeline():
    # 创建任务
    r = requests.post(f"{API}/jobs", headers={"X-API-Key": KEY},
                     json={"image_types": ["white_bg", "scene_studio"]})
    job_id = r.json()["job_id"]
    print(f"Job: {job_id}")

    # 上传图像
    files = [("files", ("test.jpg", open("test_product.jpg", "rb")))]
    r = requests.post(f"{API}/jobs/{job_id}/images",
                     headers={"X-API-Key": KEY}, files=files)
    print(f"任务数: {r.json()['tasks_created']}")

    # 等待完成
    for _ in range(60):
        r = requests.get(f"{API}/jobs/{job_id}", headers={"X-API-Key": KEY})
        s = r.json()
        print(f"进度: {s['completed']}/{s['total']}")
        if s["completed"] + s["failed"] >= s["total"]:
            break
        time.sleep(5)

    # 下载结果
    r = requests.get(f"{API}/jobs/{job_id}/tasks", headers={"X-API-Key": KEY})
    for t in r.json():
        if t["status"] == "completed":
            img = requests.get(f"{API}/tasks/{t['task_id']}/download",
                             headers={"X-API-Key": KEY})
            with open(f"out_{t['task_id']}.jpg", "wb") as f:
                f.write(img.content)
            print(f"下载: out_{t['task_id']}.jpg ({len(img.content)//1024}KB)")

    print("✓ 端到端测试完成")
```

## MVP 取舍

```
做了：白底图 | 场景图 | Banner | 批量队列 | 质量检查 | MinIO | Vue3 后台 | Docker 部署

没做（v2）：用户系统 | 在线编辑 | 高级质量控制 | IP-Adapter | 虚拟试穿 | Figma 插件 | 计费

迭代路线：
v0.2: WebSocket 实时进度 + 高级质量控制
v0.3: IP-Adapter 产品一致性
v0.4: 用户系统 + 计费
v1.0: Figma Plugin + 设计系统集成
```

MVP 的核心价值不是"完美"，而是"跑通"。系统能跑起来、能交付第一批图像，你就有了真实的用户反馈、性能数据和 bug 列表——这些才是驱动 v2 迭代的燃料。

## 练习

### 练习一：部署并运行

用 Docker Compose 部署 MVP，准备 3 张产品照片，通过管理后台生成白底图和场景图。

### 练习二：WebSocket 实时进度

添加 WebSocket 支持：FastAPI WebSocket 端点 + Redis Pub/Sub，Worker 完成任务后通知前端实时更新进度。

---

## 参考答案

### 练习一

```bash
docker compose up -d
sleep 10
# 初始化 API Key
docker compose exec backend python -c "
from database import init_db, get_db; from models import ApiKey
init_db(); db = get_db()
db.add(ApiKey(key='test-key-001', name='test')); db.commit()
"
# 运行测试
python test_e2e.py
# 浏览器访问 http://localhost:3000
```

确保 `nvidia-smi` 正常，Docker NVIDIA runtime 已安装。首次启动 ComfyUI 会下载模型。

### 练习二

```python
from fastapi import WebSocket, WebSocketDisconnect
import asyncio, json
import redis.asyncio as aioredis

@app.websocket("/ws/jobs/{job_id}")
async def ws_progress(websocket: WebSocket, job_id: str):
    await websocket.accept()
    r = aioredis.from_url("redis://redis:6379/0")
    pubsub = r.pubsub()
    await pubsub.subscribe(f"job_progress:{job_id}")
    try:
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                await websocket.send_json(json.loads(msg["data"]))
    except WebSocketDisconnect:
        pass
```

Worker 完成任务后 `r.publish(f"job_progress:{job_id}", json.dumps(progress))`。
