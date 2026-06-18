# 06 Redis 缓存与会话管理

> Redis 不只是缓存——它是 AI 应用的"短期记忆"。

## 学习目标

- 理解 Redis 在 AI 应用中的多种用途
- 实现会话缓存、API 限流、消息队列
- 掌握 Redis 数据结构和最佳实践
- 解决缓存一致性、过期策略等常见问题

## 前置要求

- 已通过 Docker Compose 启动 Redis
- 了解 HTTP 缓存的基本概念
- Python 基础

## 为什么 AI 应用需要 Redis

| 场景 | 用 Redis 做什么 | 为什么不用数据库 |
|------|----------------|-----------------|
| 对话上下文 | 缓存最近 N 条消息 | 每次对话都查数据库太慢 |
| API 限流 | 记录请求次数 | 数据库写入太慢，限流要求毫秒级响应 |
| Agent 状态 | 存储执行中的状态 | 异步任务需要快速读写 |
| 流式输出 | 暂存未完成的回复 | SSE 需要快速读取最新内容 |
| 任务队列 | 分发异步任务 | Redis List 天然支持队列语义 |

## Redis 连接配置

```python
# backend/app/core/redis.py
import redis.asyncio as redis
from app.core.config import settings

# 创建连接池
redis_pool = redis.ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=20,
    decode_responses=True,  # 自动解码为字符串
)

async def get_redis() -> redis.Redis:
    """获取 Redis 连接"""
    client = redis.Redis(connection_pool=redis_pool)
    try:
        yield client
    finally:
        await client.close()
```

配置：

```python
# backend/app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://agent:agent123@localhost:5432/agent_platform"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "your-secret-key-change-in-production"
    DEBUG: bool = True
    
    class Config:
        env_file = ".env"

settings = Settings()
```

## 场景 1：对话上下文缓存

LLM API 调用需要传入对话历史。每次都从数据库查？太慢了。用 Redis 缓存最近的对话历史。

```python
# backend/app/services/cache_service.py
import json
import redis.asyncio as redis
from app.schemas.chat import Message

class SessionCache:
    """对话会话缓存"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.prefix = "session:"
        self.max_messages = 50  # 最多缓存 50 条消息
        self.ttl = 3600 * 24   # 24 小时过期
    
    def _key(self, session_id: str) -> str:
        return f"{self.prefix}{session_id}:messages"
    
    async def add_message(self, session_id: str, message: Message):
        """添加消息到缓存"""
        key = self._key(session_id)
        data = json.dumps(message.model_dump(), ensure_ascii=False, default=str)
        
        # 用 List 存储，RPUSH 添加到末尾
        await self.redis.rpush(key, data)
        
        # 只保留最近 N 条
        await self.redis.ltrim(key, -self.max_messages, -1)
        
        # 设置过期时间
        await self.redis.expire(key, self.ttl)
    
    async def get_messages(self, session_id: str) -> list[Message]:
        """获取缓存的消息"""
        key = self._key(session_id)
        data_list = await self.redis.lrange(key, 0, -1)
        
        messages = []
        for data in data_list:
            parsed = json.loads(data)
            messages.append(Message(**parsed))
        
        return messages
    
    async def get_recent_messages(
        self, session_id: str, limit: int = 10
    ) -> list[Message]:
        """获取最近 N 条消息"""
        key = self._key(session_id)
        data_list = await self.redis.lrange(key, -limit, -1)
        
        return [Message(**json.loads(d)) for d in data_list]
    
    async def clear_session(self, session_id: str):
        """清除会话缓存"""
        key = self._key(session_id)
        await self.redis.delete(key)
```

在对话服务中使用：

```python
# backend/app/services/chat_service.py
class ChatService:
    def __init__(self, db: AsyncSession, cache: SessionCache):
        self.db = db
        self.cache = cache
    
    async def send_message(self, session_id: str, content: str) -> Message:
        # 1. 从缓存获取历史（快）
        history = await self.cache.get_recent_messages(session_id, limit=20)
        
        # 2. 如果缓存为空，从数据库加载（慢，但只发生一次）
        if not history:
            history = await self._load_from_db(session_id)
            # 回填缓存
            for msg in history:
                await self.cache.add_message(session_id, msg)
        
        # 3. 调用 LLM API
        ai_response = await self._call_llm(history, content)
        
        # 4. 保存到缓存（快）
        await self.cache.add_message(session_id, user_message)
        await self.cache.add_message(session_id, ai_response)
        
        # 5. 异步保存到数据库（不阻塞响应）
        await self._save_to_db_async(session_id, user_message, ai_response)
        
        return ai_response
```

## 场景 2：API 限流

AI API 调用很贵，必须限流。Redis 的 INCR 命令天然支持计数器限流。

```python
# backend/app/core/ratelimit.py
import time
import redis.asyncio as redis
from fastapi import Request, HTTPException

class RateLimiter:
    """滑动窗口限流器"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
    
    async def check(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
    ) -> bool:
        """
        检查是否超出限流
        
        Args:
            key: 限流键（如 user_id 或 IP）
            max_requests: 窗口内最大请求数
            window_seconds: 窗口大小（秒）
        
        Returns:
            True: 允许请求, False: 超出限制
        """
        now = time.time()
        window_start = now - window_seconds
        
        # 用 Sorted Set 实现滑动窗口
        pipe = self.redis.pipeline()
        
        # 清除窗口外的旧记录
        pipe.zremrangebyscore(key, 0, window_start)
        # 添加当前请求
        pipe.zadd(key, {str(now): now})
        # 统计窗口内的请求数
        pipe.zcard(key)
        # 设置键过期
        pipe.expire(key, window_seconds)
        
        results = await pipe.execute()
        request_count = results[2]
        
        return request_count <= max_requests

# FastAPI 依赖
async def rate_limit(
    request: Request,
    redis_client: redis.Redis = Depends(get_redis),
):
    """限流依赖"""
    limiter = RateLimiter(redis_client)
    
    # 获取用户 ID（从 JWT token 中提取）
    user_id = request.state.user_id if hasattr(request.state, 'user_id') else request.client.host
    
    # 每用户每分钟最多 30 次对话请求
    allowed = await limiter.check(
        key=f"rate:chat:{user_id}",
        max_requests=30,
        window_seconds=60,
    )
    
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="请求过于频繁，请稍后再试",
        )
```

在路由中使用：

```python
@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: str,
    request: ChatRequest,
    _: None = Depends(rate_limit),  # 限流检查
    chat_service: ChatService = Depends(get_chat_service),
):
    return await chat_service.send_message(session_id, request.message)
```

## 场景 3：异步任务队列

Agent 执行、工作流调度等耗时任务，不能让用户等着。用 Redis List 实现简单的任务队列。

```python
# backend/app/core/task_queue.py
import json
import redis.asyncio as redis
from typing import Callable, Any
import asyncio
import logging

logger = logging.getLogger(__name__)

class TaskQueue:
    """基于 Redis List 的简单任务队列"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.queue_key = "task_queue:pending"
        self.processing_key = "task_queue:processing"
        self.handlers: dict[str, Callable] = {}
    
    def register_handler(self, task_type: str, handler: Callable):
        """注册任务处理器"""
        self.handlers[task_type] = handler
    
    async def enqueue(self, task_type: str, payload: dict) -> str:
        """添加任务到队列"""
        import uuid
        task_id = str(uuid.uuid4())
        
        task = {
            "id": task_id,
            "type": task_type,
            "payload": payload,
        }
        
        await self.redis.rpush(self.queue_key, json.dumps(task, ensure_ascii=False))
        return task_id
    
    async def dequeue(self) -> dict | None:
        """从队列取出任务"""
        # BRPOP：阻塞式弹出，没有任务时会等待
        result = await self.redis.brpop(self.queue_key, timeout=1)
        if result is None:
            return None
        
        _, data = result
        task = json.loads(data)
        
        # 标记为处理中
        await self.redis.hset(
            self.processing_key,
            task["id"],
            json.dumps(task, ensure_ascii=False),
        )
        
        return task
    
    async def complete(self, task_id: str):
        """标记任务完成"""
        await self.redis.hdel(self.processing_key, task_id)
    
    async def run_worker(self):
        """启动 worker 循环"""
        logger.info("Task worker started")
        while True:
            try:
                task = await self.dequeue()
                if task is None:
                    continue
                
                task_type = task["type"]
                handler = self.handlers.get(task_type)
                
                if handler is None:
                    logger.error(f"No handler for task type: {task_type}")
                    await self.complete(task["id"])
                    continue
                
                logger.info(f"Processing task {task['id']} ({task_type})")
                await handler(task["payload"])
                await self.complete(task["id"])
                
            except Exception as e:
                logger.error(f"Task processing error: {e}", exc_info=True)
                await asyncio.sleep(1)  # 出错后等一下再重试
```

使用示例：

```python
# 注册任务处理器
async def handle_agent_execution(payload: dict):
    """处理 Agent 执行任务"""
    session_id = payload["session_id"]
    message = payload["message"]
    # ... 执行 Agent 逻辑 ...

task_queue.register_handler("agent_execute", handle_agent_execution)

# 添加任务
await task_queue.enqueue("agent_execute", {
    "session_id": "xxx",
    "message": "帮我分析销售数据",
})
```

## 场景 4：分布式锁

多个后端实例同时运行时，某些操作（如知识库索引重建）需要互斥执行。

```python
# backend/app/core/lock.py
import redis.asyncio as redis
import uuid
import asyncio

class DistributedLock:
    """基于 Redis 的分布式锁"""
    
    def __init__(self, redis_client: redis.Redis, key: str, timeout: int = 30):
        self.redis = redis_client
        self.key = f"lock:{key}"
        self.timeout = timeout
        self.token = str(uuid.uuid4())
    
    async def acquire(self) -> bool:
        """获取锁"""
        return await self.redis.set(
            self.key, self.token, nx=True, ex=self.timeout
        )
    
    async def release(self):
        """释放锁"""
        # Lua 脚本保证原子性：只有持有者才能释放
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        await self.redis.eval(lua_script, 1, self.key, self.token)
    
    async def __aenter__(self):
        for _ in range(10):  # 最多重试 10 次
            if await self.acquire():
                return self
            await asyncio.sleep(0.5)
        raise TimeoutError(f"Failed to acquire lock: {self.key}")
    
    async def __aexit__(self, *args):
        await self.release()

# 使用
async def rebuild_knowledge_base_index(kb_id: str, redis: redis.Redis):
    lock = DistributedLock(redis, f"kb_index:{kb_id}", timeout=300)
    async with lock:
        # 这里是重建索引的逻辑
        # 同一时间只有一个实例能执行
        ...
```

## Redis 数据结构速查

| 数据类型 | 用途 | 示例 |
|----------|------|------|
| String | 缓存单个值、计数器 | `SET user:1:name "张三"` |
| List | 任务队列、消息历史 | `RPUSH session:1:messages "{...}"` |
| Hash | 对象缓存、配置存储 | `HSET agent:1 name "助手" model "gpt-4o"` |
| Set | 标签、去重 | `SADD user:1:skills "search" "write"` |
| Sorted Set | 排行榜、限流窗口 | `ZADD rate:user:1 1700000000 "req1"` |
| Stream | 消息流、事件日志 | `XADD events * type "chat" data "{...}"` |

## 练习

### 练习 1：会话缓存

实现 `SessionCache` 类的完整功能：

1. 添加消息到缓存
2. 获取缓存消息
3. 只保留最近 N 条
4. 缓存过期自动清除

### 练习 2：API 限流

实现两种限流策略：

1. 固定窗口：每分钟最多 30 次请求
2. 滑动窗口：每分钟最多 30 次请求（更平滑）

测试：快速发送 50 个请求，验证限流生效。

### 练习 3：任务队列

实现一个简单的异步任务队列：

1. 生产者：发送任务到队列
2. Worker：从队列取任务并执行
3. 支持任务重试（失败后重新入队，最多 3 次）

## 本节要点

- Redis 是 AI 应用的"瑞士军刀"：缓存、限流、队列、锁都能做
- 对话上下文缓存是最常见的场景，能显著降低数据库压力
- 限流是 AI 应用的必须——LLM API 调用太贵了
- 异步任务队列让用户体验更流畅（不用等 Agent 执行完）

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `redis.ConnectionError` | Redis 没启动 | `docker compose up redis` |
| 缓存和数据库数据不一致 | 改了数据库没更新缓存 | 先更新数据库，再删除缓存 |
| 限流不生效 | key 设计不对 | 确保 key 包含用户标识 |
| 任务丢失 | Worker 执行中崩溃 | 用 `processing` 集合追踪，重启后恢复 |
