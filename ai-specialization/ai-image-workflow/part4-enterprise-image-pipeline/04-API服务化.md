# 第四课：图像生成 API 服务化

## 场景引入

你已经能用 Stable Diffusion 生成高质量图像，也在本地跑通了 ControlNet 和 LoRA 的推理流程。但当产品经理说"我们要把这个能力开放给第三方开发者"时，你突然意识到：本地跑脚本和对外提供服务是完全不同的两件事。

一个真实的图像生成服务需要回答这些问题：

- 生成一张图可能要 5-30 秒，用户愿意同步等待吗？
- 100 个用户同时请求生成，GPU 只有一张卡，怎么排队？
- 用户付了钱但生成结果不满意，怎么计费？怎么退款？
- 模型加载要 30 秒，服务重启时所有请求都会超时，怎么办？
- 怎么防止某个用户疯狂调用把服务打崩？

这些问题不是模型层面的，而是**工程层面**的。本课会带你从零构建一个生产级的图像生成 API 服务，解决上述所有问题。

## 学习目标

完成本课后，你将能够：

1. 设计一套完整的图像生成 RESTful API，包含同步和异步两种调用模式
2. 使用任务队列处理耗时的图像生成任务，避免阻塞 API 响应
3. 通过 WebSocket 向客户端实时推送生成进度
4. 实现模型预热和结果缓存策略，降低首次请求延迟
5. 设计限流和计费系统，保障服务稳定性和商业可行性
6. 用 Docker 和 Kubernetes 部署可弹性伸缩的图像生成服务

## 核心概念

### 一、整体架构

一个生产级图像生成 API 的架构如下：

```
                    ┌─────────────────────────────────────────────────┐
                    │                  客户端 (Client)                │
                    │   Web App / Mobile App / 第三方开发者           │
                    └──────────────┬──────────────────┬──────────────┘
                                   │ HTTP/REST        │ WebSocket
                                   ▼                  ▼
                    ┌──────────────────────────────────────────────────┐
                    │              API Gateway (Nginx)                 │
                    │         限流 · 认证 · 路由 · SSL                 │
                    └──────────────┬──────────────────┬───────────────┘
                                   │                  │
                                   ▼                  ▼
                    ┌──────────────────┐  ┌───────────────────────────┐
                    │   FastAPI 主服务  │  │   WebSocket 进度服务      │
                    │   接收请求        │  │   推送生成状态            │
                    │   参数校验        │  │                           │
                    │   任务分发        │  │                           │
                    └────────┬─────────┘  └─────────────┬─────────────┘
                             │                          │
                             ▼                          │
                    ┌──────────────────┐                │
                    │   Redis          │◄───────────────┘
                    │   消息队列        │   进度订阅 (Pub/Sub)
                    │   结果缓存        │
                    │   限流计数器      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────────────────────────────────────┐
                    │            Celery Worker 集群                    │
                    │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
                    │  │ Worker 1 │ │ Worker 2 │ │ Worker 3 │ ...    │
                    │  │ GPU:0    │ │ GPU:1    │ │ GPU:0    │        │
                    │  └──────────┘ └──────────┘ └──────────┘        │
                    │         模型推理 · 图像后处理 · 存储上传          │
                    └──────────────────────────────────────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   对象存储 (S3)   │   生成结果持久化
                    │   PostgreSQL     │   任务记录 · 用户计费
                    └──────────────────┘
```

这个架构的核心思想是**请求与执行分离**：API 服务只负责接收请求和返回结果，真正的图像生成由后台 Worker 完成。这样做的好处是：

- API 响应时间从 30 秒降到 50 毫秒（只做任务入队）
- Worker 可以独立扩缩容，不受 API 层影响
- 任务失败可以自动重试，不影响用户体验

### 二、RESTful API 设计

图像生成 API 的资源模型围绕"任务 (Task)"展开。用户提交一个生成任务，系统返回任务 ID，用户可以轮询或通过 WebSocket 获取结果。

```
POST   /api/v1/generate              提交图像生成任务
GET    /api/v1/tasks/{task_id}       查询任务状态和结果
GET    /api/v1/tasks                 查询用户的任务列表
DELETE /api/v1/tasks/{task_id}       取消正在排队的任务
GET    /api/v1/models                获取可用模型列表
GET    /api/v1/styles                获取可用风格列表
GET    /api/v1/usage                 查询用量和计费信息
```

设计要点：

**1) 异步优先**：图像生成耗时长，API 不应该同步等待。提交任务后立即返回 `202 Accepted` 和任务 ID。

**2) 幂等性**：相同的 prompt + 参数应该返回缓存结果，避免重复计算浪费 GPU 资源。

**3) 版本化**：API 路径带版本号 `/v1/`，方便未来做不兼容升级。

### 三、异步任务处理

同步调用的问题很直观：用户发一个请求，服务端要等 30 秒才能返回结果。这 30 秒里 HTTP 连接一直占着，如果并发 100 个请求，就需要 100 个并发连接，而且大部分时间都在空等。

解决方案是引入任务队列：

```
用户请求 → API 入队 → 立即返回任务 ID
                        ↓
              Worker 从队列取任务 → 执行推理 → 结果写入存储
                        ↓
              用户轮询任务状态 / WebSocket 推送
```

我们使用 Celery + Redis 作为任务队列方案。Celery 是 Python 生态中最成熟的分布式任务队列，Redis 作为 Broker（消息代理）和 Backend（结果存储）。

### 四、WebSocket 实时进度推送

轮询（Polling）虽然简单，但有两个问题：浪费带宽（大部分请求返回"还在处理"）和延迟不实时（轮询间隔决定了最坏延迟）。

WebSocket 是更好的选择：

```
客户端                          服务端
  │                               │
  │──── WebSocket 连接 ──────────►│
  │                               │
  │──── subscribe(task_id) ──────►│
  │                               │
  │◄─── progress: 10% ───────────│  Worker 更新进度到 Redis
  │◄─── progress: 35% ───────────│  WebSocket 服务订阅 Redis
  │◄─── progress: 72% ───────────│  推送给对应客户端
  │◄─── progress: 100% ──────────│
  │◄─── result: { image_url } ───│
  │                               │
  │──── disconnect ──────────────►│
```

### 五、模型预热和缓存策略

Stable Diffusion 模型加载到 GPU 显存需要 20-40 秒。如果每次请求都冷启动加载模型，用户体验极差。

**模型预热**：服务启动时主动加载模型到 GPU，而不是等到第一个请求来才加载。

**结果缓存**：对相同 prompt + 参数 + seed 的请求，直接返回缓存结果。图像生成的计算成本很高，一次缓存可以节省数十秒 GPU 时间。

缓存键设计：

```python
import hashlib
import json

def build_cache_key(model_name: str, prompt: str, negative_prompt: str,
                    width: int, height: int, steps: int, seed: int,
                    guidance_scale: float) -> str:
    """构建缓存键，相同参数生成相同的 key"""
    params = {
        "model": model_name,
        "prompt": prompt.strip().lower(),
        "negative_prompt": negative_prompt.strip().lower(),
        "width": width,
        "height": height,
        "steps": steps,
        "seed": seed,
        "guidance_scale": guidance_scale,
    }
    param_string = json.dumps(params, sort_keys=True)
    return f"img_cache:{hashlib.sha256(param_string.encode()).hexdigest()}"
```

### 六、限流和计费

**限流**是为了保护服务不被打崩，**计费**是为了商业模式可持续。

限流策略采用令牌桶算法：每个用户有一个"桶"，以固定速率填充令牌，每次请求消耗一个令牌。桶满了就丢弃多余的令牌（突发流量上限），桶空了就拒绝请求。

```
用户 A 的令牌桶 (容量: 10, 速率: 1个/秒)

  时间 0s:  [■■■■■■■■■■]  满桶
  时间 0s:  请求1 → [■■■■■■■■■□]  消耗1个
  时间 0s:  请求2 → [■■■■■■■■□□]  消耗1个
  时间 1s:  自动填充 → [■■■■■■■■■□]  恢复1个
  ...
  时间 0s:  连续请求10次 → [□□□□□□□□□□]  桶空
  时间 0s:  请求11 → 拒绝！(429 Too Many Requests)
```

计费模型采用预付费积分制：用户充值获得积分，每次生成消耗积分，积分不足时拒绝服务。

## 完整代码示例

### 项目结构

```
image-gen-api/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 应用入口
│   ├── config.py            # 配置管理
│   ├── models.py            # Pydantic 数据模型
│   ├── tasks.py             # Celery 任务定义
│   ├── worker.py            # Celery Worker 启动
│   ├── generator.py         # 图像生成核心逻辑
│   ├── cache.py             # 缓存层
│   ├── rate_limiter.py      # 限流实现
│   ├── billing.py           # 计费系统
│   ├── ws_manager.py        # WebSocket 连接管理
│   └── storage.py           # 对象存储封装
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.worker
├── requirements.txt
└── k8s/
    ├── api-deployment.yaml
    ├── worker-deployment.yaml
    └── redis-deployment.yaml
```

### 1. 配置管理

```python
# app/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Image Generation API"
    debug: bool = False

    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    database_url: str = "postgresql://user:pass@localhost:5432/imagegen"

    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "generated-images"

    model_name: str = "stabilityai/stable-diffusion-xl-base-1.0"
    model_cache_dir: str = "/models"
    device: str = "cuda"
    default_steps: int = 30
    max_steps: int = 100
    default_width: int = 1024
    default_height: int = 1024
    max_width: int = 2048
    max_height: int = 2048

    rate_limit_capacity: int = 10
    rate_limit_refill_per_second: float = 1.0
    cost_per_image: int = 10

    api_key_header: str = "X-API-Key"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

### 2. Pydantic 数据模型

```python
# app/models.py
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime
from typing import Optional


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000,
                        description="图像生成提示词")
    negative_prompt: str = Field(default="", max_length=1000,
                                 description="反向提示词")
    width: int = Field(default=1024, ge=256, le=2048, description="图像宽度")
    height: int = Field(default=1024, ge=256, le=2048, description="图像高度")
    steps: int = Field(default=30, ge=1, le=100, description="推理步数")
    seed: int = Field(default=-1, description="随机种子，-1 为随机")
    guidance_scale: float = Field(default=7.5, ge=1.0, le=20.0,
                                  description="引导强度")
    style_preset: Optional[str] = Field(default=None, description="风格预设名称")


class GenerateResponse(BaseModel):
    task_id: str
    status: TaskStatus
    message: str
    estimated_seconds: int


class TaskProgress(BaseModel):
    task_id: str
    status: TaskStatus
    progress: int = Field(ge=0, le=100)
    message: str = ""
    image_url: Optional[str] = None
    error: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class UsageInfo(BaseModel):
    user_id: str
    credits_remaining: int
    images_generated_today: int
    rate_limit_remaining: int
    rate_limit_capacity: int
```

### 3. 限流实现（令牌桶算法）

```python
# app/rate_limiter.py
import time
import redis.asyncio as redis
from app.config import get_settings


class TokenBucketRateLimiter:
    """基于 Redis 的分布式令牌桶限流器"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.settings = get_settings()

    async def check_rate_limit(self, user_id: str) -> tuple[bool, int]:
        """
        检查用户是否超过限流。

        返回: (是否允许, 剩余令牌数)
        """
        key = f"rate_limit:{user_id}"
        capacity = self.settings.rate_limit_capacity
        refill_rate = self.settings.rate_limit_refill_per_second
        now = time.time()

        # 使用 Lua 脚本保证原子性
        lua_script = """
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local requested = 1

        local data = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(data[1]) or capacity
        local last_refill = tonumber(data[2]) or now

        -- 计算应该补充的令牌数
        local elapsed = now - last_refill
        local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)

        if new_tokens >= requested then
            new_tokens = new_tokens - requested
            redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
            redis.call('EXPIRE', key, 3600)
            return {1, math.floor(new_tokens)}
        else
            redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
            redis.call('EXPIRE', key, 3600)
            return {0, math.floor(new_tokens)}
        end
        """

        result = await self.redis.eval(
            lua_script, 1, key, capacity, refill_rate, now
        )
        allowed = bool(result[0])
        remaining = int(result[1])
        return allowed, remaining
```

### 4. 计费系统

```python
# app/billing.py
import redis.asyncio as redis
from app.config import get_settings


class BillingService:
    """基于 Redis 的积分计费系统"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.settings = get_settings()

    async def get_balance(self, user_id: str) -> int:
        """查询用户积分余额"""
        balance = await self.redis.get(f"credits:{user_id}")
        return int(balance) if balance else 0

    async def charge(self, user_id: str, amount: int) -> bool:
        """
        扣除积分。使用 Lua 脚本保证原子性，避免余额变负。

        返回: 是否扣费成功
        """
        lua_script = """
        local key = KEYS[1]
        local cost = tonumber(ARGV[1])
        local balance = tonumber(redis.call('GET', key) or '0')

        if balance >= cost then
            redis.call('DECRBY', key, cost)
            return 1
        else
            return 0
        end
        """

        result = await self.redis.eval(lua_script, 1, f"credits:{user_id}", amount)
        return bool(result)

    async def refund(self, user_id: str, amount: int) -> None:
        """退还积分（任务失败时调用）"""
        await self.redis.incrby(f"credits:{user_id}", amount)

    async def add_credits(self, user_id: str, amount: int) -> int:
        """充值积分"""
        return await self.redis.incrby(f"credits:{user_id}", amount)
```

### 5. 缓存层

```python
# app/cache.py
import hashlib
import json
import redis.asyncio as redis
from typing import Optional


class ImageResultCache:
    """图像生成结果缓存"""

    def __init__(self, redis_client: redis.Redis, ttl: int = 86400 * 7):
        self.redis = redis_client
        self.ttl = ttl  # 默认缓存 7 天

    def _build_key(self, model_name: str, prompt: str,
                   negative_prompt: str, width: int, height: int,
                   steps: int, seed: int,
                   guidance_scale: float) -> str:
        params = {
            "model": model_name,
            "prompt": prompt.strip().lower(),
            "negative_prompt": negative_prompt.strip().lower(),
            "width": width,
            "height": height,
            "steps": steps,
            "seed": seed,
            "guidance_scale": guidance_scale,
        }
        param_string = json.dumps(params, sort_keys=True)
        digest = hashlib.sha256(param_string.encode()).hexdigest()
        return f"img_cache:{digest}"

    async def get(self, model_name: str, prompt: str,
                  negative_prompt: str, width: int, height: int,
                  steps: int, seed: int,
                  guidance_scale: float) -> Optional[str]:
        """查询缓存，返回图像 URL 或 None"""
        key = self._build_key(
            model_name, prompt, negative_prompt, width, height,
            steps, seed, guidance_scale
        )
        cached_url = await self.redis.get(key)
        return cached_url.decode() if cached_url else None

    async def set(self, model_name: str, prompt: str,
                  negative_prompt: str, width: int, height: int,
                  steps: int, seed: int,
                  guidance_scale: float, image_url: str) -> None:
        """写入缓存"""
        key = self._build_key(
            model_name, prompt, negative_prompt, width, height,
            steps, seed, guidance_scale
        )
        await self.redis.setex(key, self.ttl, image_url)
```

### 6. WebSocket 连接管理

```python
# app/ws_manager.py
import asyncio
import json
import redis.asyncio as redis
from fastapi import WebSocket
from typing import Dict, Set


class WebSocketManager:
    """管理 WebSocket 连接和进度推送"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        # task_id -> set of websocket connections
        self.connections: Dict[str, Set[WebSocket]] = {}
        self._subscriber_task: asyncio.Task | None = None

    async def connect(self, websocket: WebSocket, task_id: str) -> None:
        """客户端订阅某个任务的进度"""
        await websocket.accept()
        if task_id not in self.connections:
            self.connections[task_id] = set()
        self.connections[task_id].add(websocket)

    async def disconnect(self, websocket: WebSocket, task_id: str) -> None:
        """客户端断开连接"""
        if task_id in self.connections:
            self.connections[task_id].discard(websocket)
            if not self.connections[task_id]:
                del self.connections[task_id]

    async def publish_progress(self, task_id: str, progress: int,
                               status: str, message: str = "",
                               image_url: str | None = None) -> None:
        """Worker 调用：发布进度到 Redis Pub/Sub"""
        payload = json.dumps({
            "task_id": task_id,
            "progress": progress,
            "status": status,
            "message": message,
            "image_url": image_url,
        })
        await self.redis.publish(f"task_progress:{task_id}", payload)

    async def start_listening(self) -> None:
        """启动 Redis 订阅监听，将消息转发给 WebSocket 客户端"""
        pubsub = self.redis.pubsub()
        await pubsub.psubscribe("task_progress:*")

        async for message in pubsub.listen():
            if message["type"] == "pmessage":
                channel = message["channel"].decode()
                task_id = channel.split(":", 1)[1]
                data = json.loads(message["data"].decode())

                if task_id in self.connections:
                    dead_connections = set()
                    for ws in self.connections[task_id]:
                        try:
                            await ws.send_json(data)
                        except Exception:
                            dead_connections.add(ws)
                    # 清理断开的连接
                    for ws in dead_connections:
                        self.connections[task_id].discard(ws)
```

### 7. 图像生成核心逻辑

```python
# app/generator.py
import torch
from diffusers import StableDiffusionXLPipeline, DPMSolverMultistepScheduler
from PIL import Image
from typing import Optional
from app.config import Settings


class ImageGenerator:
    """图像生成器，封装 Stable Diffusion 推理逻辑"""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.pipeline: Optional[StableDiffusionXLPipeline] = None

    def warmup(self) -> None:
        """
        模型预热：加载模型到 GPU 并执行一次空推理。
        预热后首次真实请求的延迟会大幅降低。
        """
        print(f"[预热] 加载模型: {self.settings.model_name}")
        self.pipeline = StableDiffusionXLPipeline.from_pretrained(
            self.settings.model_name,
            torch_dtype=torch.float16,
            variant="fp16",
            cache_dir=self.settings.model_cache_dir,
        ).to(self.settings.device)

        # 使用 DPM-Solver 调度器加速推理
        self.pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
            self.pipeline.scheduler.config
        )

        # 启用内存优化
        self.pipeline.enable_attention_slicing()

        # 空推理预热，让 CUDA 完成编译和显存分配
        print("[预热] 执行空推理...")
        self.pipeline(
            prompt="warmup",
            num_inference_steps=1,
            width=512,
            height=512,
        )
        print("[预热] 完成")

    def generate(self, prompt: str, negative_prompt: str = "",
                 width: int = 1024, height: int = 1024,
                 steps: int = 30, seed: int = -1,
                 guidance_scale: float = 7.5,
                 progress_callback=None) -> Image.Image:
        """
        生成图像。

        Args:
            prompt: 正向提示词
            negative_prompt: 反向提示词
            width: 图像宽度
            height: 图像高度
            steps: 推理步数
            seed: 随机种子，-1 为随机
            guidance_scale: 引导强度
            progress_callback: 进度回调函数 (step, total_steps) -> None

        Returns:
            生成的 PIL Image
        """
        if self.pipeline is None:
            raise RuntimeError("模型未预热，请先调用 warmup()")

        # 设置随机种子
        if seed == -1:
            generator = torch.Generator(device=self.settings.device)
            generator.seed()
        else:
            generator = torch.Generator(device=self.settings.device).manual_seed(seed)

        # 构建进度回调
        def step_callback(pipe, step_index, timestep, callback_kwargs):
            if progress_callback:
                progress_callback(step_index + 1, steps)
            return callback_kwargs

        result = self.pipeline(
            prompt=prompt,
            negative_prompt=negative_prompt if negative_prompt else None,
            width=width,
            height=height,
            num_inference_steps=steps,
            guidance_scale=guidance_scale,
            generator=generator,
            callback_on_step_end=step_callback,
        )

        return result.images[0]
```

### 8. 对象存储封装

```python
# app/storage.py
import boto3
import uuid
from PIL import Image
from io import BytesIO
from app.config import Settings


class ImageStorage:
    """图像存储服务，兼容 S3 协议（MinIO / AWS S3）"""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
        )
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        """确保存储桶存在"""
        try:
            self.client.head_bucket(Bucket=self.settings.s3_bucket)
        except Exception:
            self.client.create_bucket(Bucket=self.settings.s3_bucket)

    def upload_image(self, image: Image.Image, user_id: str,
                     task_id: str) -> str:
        """
        上传图像到对象存储，返回访问 URL。

        Args:
            image: PIL Image 对象
            user_id: 用户 ID
            task_id: 任务 ID

        Returns:
            图像访问 URL
        """
        key = f"images/{user_id}/{task_id}/{uuid.uuid4().hex}.png"

        buffer = BytesIO()
        image.save(buffer, format="PNG", quality=95)
        buffer.seek(0)

        self.client.upload_fileobj(
            buffer,
            self.settings.s3_bucket,
            key,
            ExtraArgs={"ContentType": "image/png"},
        )

        url = f"{self.settings.s3_endpoint}/{self.settings.s3_bucket}/{key}"
        return url
```

### 9. Celery 任务定义

```python
# app/tasks.py
from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "image_gen",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600,
    task_track_started=True,
    worker_prefetch_multiplier=1,  # GPU 任务一次只处理一个
    task_acks_late=True,           # 任务完成后才确认，防止 Worker 崩溃丢任务
)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=10)
def generate_image_task(self, task_id: str, user_id: str,
                        prompt: str, negative_prompt: str,
                        width: int, height: int, steps: int,
                        seed: int, guidance_scale: float):
    """
    图像生成 Celery 任务。

    每个 Worker 进程独立加载模型，通过 Redis Pub/Sub 推送进度。
    """
    import redis
    import json
    from app.generator import ImageGenerator
    from app.storage import ImageStorage

    redis_client = redis.Redis.from_url(settings.redis_url)
    storage = ImageStorage(settings)

    def publish_progress(step: int, total: int):
        """推送推理进度"""
        progress = int((step / total) * 100)
        payload = json.dumps({
            "task_id": task_id,
            "progress": progress,
            "status": "processing",
            "message": f"推理进度: {step}/{total}",
        })
        redis_client.publish(f"task_progress:{task_id}", payload)

    try:
        # 更新任务状态为处理中
        redis_client.set(f"task_status:{task_id}", "processing")
        payload = json.dumps({
            "task_id": task_id,
            "progress": 0,
            "status": "processing",
            "message": "开始生成...",
        })
        redis_client.publish(f"task_progress:{task_id}", payload)

        # 初始化生成器（Worker 启动时已预热，此处复用）
        generator = _get_or_create_generator()

        # 执行图像生成
        image = generator.generate(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            steps=steps,
            seed=seed,
            guidance_scale=guidance_scale,
            progress_callback=publish_progress,
        )

        # 上传结果
        image_url = storage.upload_image(image, user_id, task_id)

        # 缓存结果
        redis_client.setex(
            f"task_result:{task_id}",
            86400 * 7,
            json.dumps({"image_url": image_url}),
        )
        redis_client.set(f"task_status:{task_id}", "completed")

        # 推送完成通知
        payload = json.dumps({
            "task_id": task_id,
            "progress": 100,
            "status": "completed",
            "message": "生成完成",
            "image_url": image_url,
        })
        redis_client.publish(f"task_progress:{task_id}", payload)

        return {"image_url": image_url, "status": "completed"}

    except Exception as exc:
        redis_client.set(f"task_status:{task_id}", "failed")
        payload = json.dumps({
            "task_id": task_id,
            "progress": 0,
            "status": "failed",
            "message": str(exc),
        })
        redis_client.publish(f"task_progress:{task_id}", payload)

        # 重试逻辑
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)

        return {"status": "failed", "error": str(exc)}


# Worker 级别的生成器单例，避免重复加载模型
_generator_instance = None


def _get_or_create_generator() -> "ImageGenerator":
    global _generator_instance
    if _generator_instance is None:
        from app.generator import ImageGenerator
        _generator_instance = ImageGenerator(settings)
        _generator_instance.warmup()
    return _generator_instance
```

### 10. FastAPI 主服务

```python
# app/main.py
import uuid
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import get_settings, Settings
from app.models import (
    GenerateRequest, GenerateResponse, TaskProgress,
    TaskStatus, UsageInfo,
)
from app.rate_limiter import TokenBucketRateLimiter
from app.billing import BillingService
from app.cache import ImageResultCache
from app.ws_manager import WebSocketManager
from app.tasks import generate_image_task


redis_client: redis.Redis = None
ws_manager: WebSocketManager = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client, ws_manager
    settings = get_settings()
    redis_client = redis.from_url(settings.redis_url, decode_responses=False)
    ws_manager = WebSocketManager(redis_client)

    # 启动 WebSocket 监听
    import asyncio
    listener_task = asyncio.create_task(ws_manager.start_listening())

    yield

    listener_task.cancel()
    await redis_client.close()


app = FastAPI(
    title="Image Generation API",
    description="生产级图像生成 API 服务",
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


async def get_current_user_id(api_key: str = "X-API-Key") -> str:
    """简化版认证：从 API Key 解析用户 ID"""
    # 生产环境中应查询数据库验证 API Key
    return f"user_{hash(api_key) % 10000}"


@app.post("/api/v1/generate", response_model=GenerateResponse)
async def submit_generation(
    request: GenerateRequest,
    settings: Settings = Depends(get_settings),
):
    """
    提交图像生成任务。

    返回任务 ID，客户端可通过 WebSocket 或轮询获取进度和结果。
    """
    user_id = "demo_user"  # 实际应从认证中间件获取

    # 1. 限流检查
    rate_limiter = TokenBucketRateLimiter(redis_client)
    allowed, remaining = await rate_limiter.check_rate_limit(user_id)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="请求过于频繁，请稍后再试",
        )

    # 2. 余额检查和扣费
    billing = BillingService(redis_client)
    has_balance = await billing.charge(user_id, settings.cost_per_image)
    if not has_balance:
        raise HTTPException(
            status_code=402,
            detail="积分不足，请充值",
        )

    # 3. 缓存检查
    cache = ImageResultCache(redis_client)
    cached_url = await cache.get(
        settings.model_name, request.prompt, request.negative_prompt,
        request.width, request.height, request.steps, request.seed,
        request.guidance_scale,
    )
    if cached_url:
        return GenerateResponse(
            task_id=f"cached_{uuid.uuid4().hex[:8]}",
            status=TaskStatus.COMPLETED,
            message="命中缓存，直接返回结果",
            estimated_seconds=0,
        )

    # 4. 创建任务并入队
    task_id = uuid.uuid4().hex
    generate_image_task.delay(
        task_id=task_id,
        user_id=user_id,
        prompt=request.prompt,
        negative_prompt=request.negative_prompt,
        width=request.width,
        height=request.height,
        steps=request.steps,
        seed=request.seed,
        guidance_scale=request.guidance_scale,
    )

    # 5. 记录任务状态
    await redis_client.set(f"task_status:{task_id}", "pending")
    await redis_client.expire(f"task_status:{task_id}", 86400)

    # 估算生成时间（基于步数和分辨率的简单模型）
    pixel_count = request.width * request.height
    estimated_seconds = int(request.steps * (pixel_count / (1024 * 1024)) * 0.8)

    return GenerateResponse(
        task_id=task_id,
        status=TaskStatus.PENDING,
        message="任务已提交，请通过 WebSocket 或轮询获取进度",
        estimated_seconds=estimated_seconds,
    )


@app.get("/api/v1/tasks/{task_id}", response_model=TaskProgress)
async def get_task_status(task_id: str):
    """查询任务状态和结果"""
    status = await redis_client.get(f"task_status:{task_id}")
    if not status:
        raise HTTPException(status_code=404, detail="任务不存在")

    status = status.decode() if isinstance(status, bytes) else status
    result_data = await redis_client.get(f"task_result:{task_id}")

    image_url = None
    if result_data:
        import json
        result = json.loads(result_data)
        image_url = result.get("image_url")

    return TaskProgress(
        task_id=task_id,
        status=TaskStatus(status),
        progress=100 if status == "completed" else 0,
        image_url=image_url,
    )


@app.websocket("/ws/tasks/{task_id}")
async def websocket_task_progress(websocket: WebSocket, task_id: str):
    """
    WebSocket 实时进度推送。

    客户端连接后自动接收该任务的进度更新，直到任务完成或连接断开。
    """
    await ws_manager.connect(websocket, task_id)
    try:
        while True:
            # 保持连接，等待客户端消息或服务端推送
            data = await websocket.receive_text()
            # 客户端可以发送 ping 保持连接
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, task_id)


@app.get("/api/v1/usage", response_model=UsageInfo)
async def get_usage():
    """查询当前用户的用量和计费信息"""
    user_id = "demo_user"
    billing = BillingService(redis_client)
    rate_limiter = TokenBucketRateLimiter(redis_client)

    balance = await billing.get_balance(user_id)
    _, remaining = await rate_limiter.check_rate_limit(user_id)

    return UsageInfo(
        user_id=user_id,
        credits_remaining=balance,
        images_generated_today=0,
        rate_limit_remaining=remaining,
        rate_limit_capacity=get_settings().rate_limit_capacity,
    )
```

### 11. Docker 部署

```dockerfile
# Dockerfile (API 服务)
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```dockerfile
# Dockerfile.worker (Celery Worker，包含 GPU 支持)
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

# 预下载模型到镜像中，避免运行时下载
RUN python -c "
from diffusers import StableDiffusionXLPipeline;
StableDiffusionXLPipeline.from_pretrained(
    'stabilityai/stable-diffusion-xl-base-1.0',
    cache_dir='/models'
)
"

CMD ["celery", "-A", "app.tasks.celery_app", "worker",
     "--loglevel=info", "--concurrency=1",
     "-Q", "image_generation"]
```

```yaml
# docker-compose.yml
version: "3.8"

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"

  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/1
      - CELERY_RESULT_BACKEND=redis://redis:6379/2
      - S3_ENDPOINT=http://minio:9000
    depends_on:
      - redis
      - minio

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/1
      - CELERY_RESULT_BACKEND=redis://redis:6379/2
      - S3_ENDPOINT=http://minio:9000
      - CUDA_VISIBLE_DEVICES=0
    depends_on:
      - redis
      - minio
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]

volumes:
  redis_data:
  minio_data:
```

### 12. Kubernetes 部署

```yaml
# k8s/worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: image-gen-worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: image-gen-worker
  template:
    metadata:
      labels:
        app: image-gen-worker
    spec:
      containers:
        - name: worker
          image: your-registry/image-gen-worker:latest
          resources:
            requests:
              nvidia.com/gpu: 1
              memory: "8Gi"
              cpu: "2"
            limits:
              nvidia.com/gpu: 1
              memory: "16Gi"
              cpu: "4"
          env:
            - name: CELERY_BROKER_URL
              value: "redis://redis:6379/1"
            - name: CELERY_RESULT_BACKEND
              value: "redis://redis:6379/2"
      tolerations:
        - key: nvidia.com/gpu
          operator: Exists
          effect: NoSchedule
```

```yaml
# k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: image-gen-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: image-gen-api
  template:
    metadata:
      labels:
        app: image-gen-api
    spec:
      containers:
        - name: api
          image: your-registry/image-gen-api:latest
          ports:
            - containerPort: 8000
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1"
          readinessProbe:
            httpGet:
              path: /docs
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /docs
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 30
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: image-gen-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: image-gen-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

## 常见误区

### 误区一：同步处理图像生成

很多初学者直接在 FastAPI 路由里调用模型推理：

```python
# ❌ 错误做法
@app.post("/generate")
async def generate(request: GenerateRequest):
    image = model.generate(request.prompt)  # 阻塞 30 秒
    return {"image": encode(image)}
```

这会导致：API 响应极慢、并发能力为 1、服务重启丢失所有进行中的任务。正确做法是用任务队列分离请求和执行。

### 误区二：忽略模型预热

不在启动时预热模型，第一个请求会等待 30 秒以上的模型加载时间。用户会认为服务挂了而放弃。应该在 Worker 启动时就完成模型加载和空推理。

### 误区三：用 HTTP 轮询替代 WebSocket

虽然轮询实现简单，但高频轮询浪费带宽（大部分返回"还在处理"），低频轮询又导致延迟高。对于需要实时进度的场景，WebSocket 是更优解。

### 误区四：不做限流就上线

不限流意味着一个恶意用户可以瞬间发送 1000 个请求，把 GPU 队列塞满，其他用户全部排队等待。限流是服务稳定性的第一道防线。

### 误区五：缓存键设计不合理

有的开发者把时间戳也放进缓存键，导致每个请求都是缓存未命中。图像生成的缓存键应该只包含影响生成结果的参数：模型、prompt、尺寸、步数、种子等。

### 误区六：忽略任务失败的积分回退

用户付了积分但任务失败（GPU OOM、模型错误），如果不退还积分，用户会投诉。任务失败时必须自动退还积分，并记录失败原因供后续排查。

## 小结

本课构建了一个生产级图像生成 API 服务的核心组件：

1. **API 设计**：异步优先，任务 ID 模式解耦请求和执行
2. **任务队列**：Celery + Redis 处理耗时推理任务，支持重试和并发控制
3. **实时推送**：WebSocket + Redis Pub/Sub 实现毫秒级进度通知
4. **缓存策略**：基于参数哈希的结果缓存，避免重复计算
5. **限流计费**：令牌桶限流保护服务，积分制计费支撑商业模式
6. **容器部署**：Docker 打包，Kubernetes 弹性伸缩，GPU 资源调度

关键设计原则：

- **请求与执行分离**：API 层只做入队和查询，Worker 层做推理
- **防御性设计**：限流、认证、缓存、重试，每层都有保护
- **成本意识**：缓存相同请求、按需扩缩 Worker、及时释放 GPU 显存

## 练习

### 练习一：设计批量生成接口

当前 API 只支持单张图像生成。请设计一个批量生成接口 `POST /api/v1/generate/batch`，支持一次提交多个 prompt（最多 10 个），每个 prompt 独立生成，客户端可以一次性获取所有结果。

要求：
- 定义请求和响应的 Pydantic 模型
- 说明任务拆分策略（一个大任务 vs 多个小任务）
- 说明如何通过 WebSocket 推送批量进度

### 练习二：实现请求去重

当两个用户提交完全相同的 prompt + 参数时，不应该创建两个推理任务。请实现一个请求去重机制：第一个请求创建任务，后续相同请求直接关联到同一个任务。

要求：
- 使用 Redis 实现去重锁
- 处理并发竞争条件
- 考虑去重窗口时间

### 练习三：Worker 自动扩缩容方案

当前 Kubernetes 配置中 Worker 副本数是固定的。请设计一个基于队列深度的 Worker 自动扩缩容方案：队列中待处理任务多时增加 Worker，队列空闲时减少 Worker。

---

## 参考答案

### 练习一

**思路**：批量接口有两种策略——"一个大任务"把多个 prompt 打包给一个 Worker 处理，"多个小任务"拆成独立任务分发给不同 Worker。考虑到 GPU 推理本身是串行的（一张卡同时只能处理一张图），拆成多个小任务更好：可以利用多 Worker 并行，单个失败不影响其他，进度也能独立推送。

**答案**：

```python
from pydantic import BaseModel, Field
from typing import List
import uuid


class BatchGenerateRequest(BaseModel):
    items: List[GenerateRequest] = Field(..., max_length=10,
                                         description="批量生成请求，最多 10 个")
    webhook_url: Optional[str] = Field(
        default=None,
        description="全部完成后回调通知的 URL（可选）"
    )


class BatchTaskItem(BaseModel):
    index: int
    task_id: str
    prompt: str
    status: TaskStatus


class BatchGenerateResponse(BaseModel):
    batch_id: str
    total: int
    tasks: List[BatchTaskItem]
    estimated_seconds: int


@app.post("/api/v1/generate/batch", response_model=BatchGenerateResponse)
async def submit_batch_generation(request: BatchGenerateRequest):
    batch_id = uuid.uuid4().hex
    tasks = []

    for index, item in enumerate(request.items):
        task_id = uuid.uuid4().hex
        generate_image_task.delay(
            task_id=task_id,
            user_id="demo_user",
            prompt=item.prompt,
            negative_prompt=item.negative_prompt,
            width=item.width,
            height=item.height,
            steps=item.steps,
            seed=item.seed,
            guidance_scale=item.guidance_scale,
        )
        await redis_client.set(f"task_status:{task_id}", "pending")
        await redis_client.set(f"batch:{batch_id}:{task_id}", index)
        tasks.append(BatchTaskItem(
            index=index,
            task_id=task_id,
            prompt=item.prompt,
            status=TaskStatus.PENDING,
        ))

    # 记录批次元数据
    await redis_client.hset(f"batch_meta:{batch_id}", mapping={
        "total": len(request.items),
        "completed": 0,
    })

    max_steps = max(item.steps for item in request.items)
    estimated = int(max_steps * 0.8 * len(request.items) / 2)  # 假设 2 个 Worker 并行

    return BatchGenerateResponse(
        batch_id=batch_id,
        total=len(request.items),
        tasks=tasks,
        estimated_seconds=estimated,
    )
```

WebSocket 批量进度推送：客户端连接 `/ws/batch/{batch_id}`，服务端监听该批次下所有子任务的 Redis Pub/Sub 频道，汇总后推送：

```json
{
    "batch_id": "abc123",
    "completed": 3,
    "total": 5,
    "tasks": [
        {"index": 0, "status": "completed", "image_url": "..."},
        {"index": 1, "status": "completed", "image_url": "..."},
        {"index": 2, "status": "completed", "image_url": "..."},
        {"index": 3, "status": "processing", "progress": 60},
        {"index": 4, "status": "pending"}
    ]
}
```

**要点**：
- 批量拆成独立任务，利用多 Worker 并行
- 用 batch_id 关联所有子任务，支持批量查询
- WebSocket 汇总推送避免客户端维护多个连接

### 练习二

**思路**：用 Redis 的 SETNX（SET if Not eXists）实现分布式锁。当请求进入时，用参数哈希作为锁的 key，如果 SETNX 成功说明是第一个请求，创建任务；如果失败说明已有相同请求在处理，查询对应的任务 ID 返回。去重窗口设置为任务最大执行时间（比如 5 分钟），超时后锁自动释放。

**答案**：

```python
import hashlib
import json
import redis.asyncio as redis


class RequestDeduplicator:
    """请求去重器：相同参数的请求复用同一个任务"""

    def __init__(self, redis_client: redis.Redis, window_seconds: int = 300):
        self.redis = redis_client
        self.window = window_seconds

    def _build_dedup_key(self, prompt: str, negative_prompt: str,
                         width: int, height: int, steps: int,
                         seed: int, guidance_scale: float) -> str:
        """构建去重键（注意：seed=-1 时不参与去重，因为每次结果不同）"""
        if seed == -1:
            # 随机种子的请求不去重，每次都不同
            return None

        params = {
            "prompt": prompt.strip(),
            "negative_prompt": negative_prompt.strip(),
            "width": width,
            "height": height,
            "steps": steps,
            "seed": seed,
            "guidance_scale": guidance_scale,
        }
        digest = hashlib.sha256(
            json.dumps(params, sort_keys=True).encode()
        ).hexdigest()
        return f"dedup:{digest}"

    async def try_acquire_or_get_existing(
        self, prompt: str, negative_prompt: str,
        width: int, height: int, steps: int,
        seed: int, guidance_scale: float
    ) -> tuple[bool, str | None]:
        """
        尝试获取去重锁。

        返回: (is_new_task, task_id)
        - (True, None): 新请求，需要创建任务
        - (False, task_id): 重复请求，直接返回已有任务 ID
        """
        dedup_key = self._build_dedup_key(
            prompt, negative_prompt, width, height, steps, seed, guidance_scale
        )

        # seed=-1 不去重
        if dedup_key is None:
            return True, None

        # 尝试 SETNX：如果 key 不存在则设置，返回 True
        task_id = str(uuid.uuid4().hex)
        acquired = await self.redis.set(
            dedup_key, task_id, nx=True, ex=self.window
        )

        if acquired:
            # 成功获取锁，这是新任务
            return True, None
        else:
            # 锁已存在，返回已有的 task_id
            existing_task_id = await self.redis.get(dedup_key)
            return False, existing_task_id.decode() if existing_task_id else None


# 在 main.py 中使用：
@app.post("/api/v1/generate")
async def submit_generation(request: GenerateRequest):
    deduplicator = RequestDeduplicator(redis_client)

    is_new, existing_task_id = await deduplicator.try_acquire_or_get_existing(
        request.prompt, request.negative_prompt,
        request.width, request.height, request.steps,
        request.seed, request.guidance_scale,
    )

    if not is_new:
        return GenerateResponse(
            task_id=existing_task_id,
            status=TaskStatus.PENDING,
            message="相同请求已在处理中，复用已有任务",
            estimated_seconds=0,
        )

    # 正常创建新任务流程...
```

**要点**：
- `SETNX` + 过期时间保证原子性和自动释放
- `seed=-1` 的请求不去重，因为每次结果都不同
- 去重窗口应略大于最大任务执行时间
- 注意竞态条件：任务完成后应保持锁直到窗口过期，防止完成后立刻有相同请求重复创建

### 练习三

**思路**：用一个独立的 Autoscaler 组件定期检查 Redis 队列深度，与当前 Worker 副本数对比，按比例调整。队列深度通过 Celery 的 `inspect` API 或 Redis 的 `LLEN` 命令获取。为避免频繁抖动，设置冷却时间和缩容延迟。

**答案**：

```python
# autoscaler.py
import asyncio
import redis
import subprocess
import time
from dataclasses import dataclass


@dataclass
class AutoscalerConfig:
    min_replicas: int = 1
    max_replicas: int = 8
    queue_name: str = "image_generation"
    scale_up_threshold: int = 5      # 队列超过 5 个任务就扩容
    scale_down_threshold: int = 0    # 队列为空就缩容
    check_interval_seconds: int = 30
    cooldown_seconds: int = 180      # 扩缩容后冷却 3 分钟
    scale_down_delay_seconds: int = 300  # 缩容前等待 5 分钟


class WorkerAutoscaler:
    """基于队列深度的 Worker 自动扩缩容"""

    def __init__(self, redis_url: str, config: AutoscalerConfig):
        self.redis = redis.Redis.from_url(redis_url)
        self.config = config
        self.last_scale_time = 0
        self.consecutive_idle_checks = 0

    def get_queue_depth(self) -> int:
        """获取 Celery 队列中待处理的任务数"""
        # Celery 使用 list 存储任务，key 为队列名
        return self.redis.llen(self.config.queue_name)

    def get_current_replicas(self) -> int:
        """获取当前 Worker 副本数"""
        result = subprocess.run(
            ["kubectl", "get", "deployment", "image-gen-worker",
             "-o", "jsonpath={.spec.replicas}"],
            capture_output=True, text=True,
        )
        return int(result.stdout.strip())

    def scale_to(self, target_replicas: int) -> None:
        """调整 Worker 副本数"""
        subprocess.run(
            ["kubectl", "scale", "deployment", "image-gen-worker",
             f"--replicas={target_replicas}"],
            check=True,
        )
        self.last_scale_time = time.time()
        print(f"[Autoscaler] 缩放至 {target_replicas} 个副本")

    def run(self) -> None:
        """主循环：定期检查并调整"""
        print("[Autoscaler] 启动")
        while True:
            try:
                queue_depth = self.get_queue_depth()
                current = self.get_current_replicas()
                now = time.time()
                cooldown_remaining = self.last_scale_time + self.config.cooldown_seconds - now

                if cooldown_remaining > 0:
                    print(f"[Autoscaler] 队列深度={queue_depth}, "
                          f"副本={current}, 冷却中({int(cooldown_remaining)}s)")
                    time.sleep(self.config.check_interval_seconds)
                    continue

                # 扩容逻辑：队列任务数超过阈值
                if queue_depth >= self.config.scale_up_threshold:
                    # 每 5 个待处理任务增加 1 个 Worker
                    desired = min(
                        self.config.max_replicas,
                        current + max(1, queue_depth // 5),
                    )
                    if desired > current:
                        self.scale_to(desired)
                        self.consecutive_idle_checks = 0

                # 缩容逻辑：队列为空
                elif queue_depth <= self.config.scale_down_threshold:
                    self.consecutive_idle_checks += 1
                    # 连续空闲检查次数达到阈值才缩容
                    required_idle_checks = int(
                        self.config.scale_down_delay_seconds / self.config.check_interval_seconds
                    )
                    if self.consecutive_idle_checks >= required_idle_checks:
                        desired = max(self.config.min_replicas, current - 1)
                        if desired < current:
                            self.scale_to(desired)
                        self.consecutive_idle_checks = 0

                else:
                    self.consecutive_idle_checks = 0

                print(f"[Autoscaler] 队列深度={queue_depth}, 副本={current}")

            except Exception as e:
                print(f"[Autoscaler] 错误: {e}")

            time.sleep(self.config.check_interval_seconds)


if __name__ == "__main__":
    config = AutoscalerConfig()
    scaler = WorkerAutoscaler("redis://localhost:6379/1", config)
    scaler.run()
```

对应的 Kubernetes RBAC 配置（允许 Autoscaler 修改 Deployment 副本数）：

```yaml
# k8s/autoscaler-rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: worker-autoscaler
rules:
  - apiGroups: ["apps"]
    resources: ["deployments/scale"]
    resourceNames: ["image-gen-worker"]
    verbs: ["get", "patch", "update"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: worker-autoscaler-binding
subjects:
  - kind: ServiceAccount
    name: autoscaler-sa
roleRef:
  kind: Role
  name: worker-autoscaler
  apiGroup: rbac.authorization.k8s.io
```

**要点**：
- 扩容激进（队列满就加）、缩容保守（空闲 5 分钟才减），避免抖动
- 冷却时间防止短时间内反复扩缩
- 缩容逐个减少，而不是一步到位，给正在进行的任务完成时间
- 生产环境中可用 KEDA 替代手动 Autoscaler，原生支持 Redis 队列深度触发
