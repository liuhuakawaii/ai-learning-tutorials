# 06 Redis 缓存与会话管理

> Redis 不只是缓存——它是 AI 应用的"短期记忆"。

## 场景引入

你的 AI 应用上线了，用户量增长后问题来了：每次对话都要从数据库查历史消息，响应越来越慢；LLM API 调用太贵，但用户疯狂发请求没有限制；Agent 执行耗时任务时用户只能干等。你需要一个能快速读写的缓存层来存对话上下文，一个限流机制来控制 API 调用频率，一个异步队列来处理耗时任务——Redis 就是这把"瑞士军刀"。

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
        user_message = {"role": "user", "content": content}
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

---

## 参考答案

### 练习 1

**思路**：用 Redis List 存储消息，RPUSH 添加、LRANGE 读取、LTRIM 保留最近 N 条、EXPIRE 设置过期时间。

**答案**：

```python
# backend/app/services/cache_service.py
import json
import redis.asyncio as redis

class SessionCache:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.prefix = "session:"
        self.max_messages = 50
        self.ttl = 3600 * 24  # 24 小时

    def _key(self, session_id: str) -> str:
        return f"{self.prefix}{session_id}:messages"

    async def add_message(self, session_id: str, message: dict):
        key = self._key(session_id)
        data = json.dumps(message, ensure_ascii=False, default=str)
        await self.redis.rpush(key, data)
        await self.redis.ltrim(key, -self.max_messages, -1)
        await self.redis.expire(key, self.ttl)

    async def get_messages(self, session_id: str) -> list[dict]:
        key = self._key(session_id)
        data_list = await self.redis.lrange(key, 0, -1)
        return [json.loads(d) for d in data_list]

    async def get_recent_messages(self, session_id: str, limit: int = 10) -> list[dict]:
        key = self._key(session_id)
        data_list = await self.redis.lrange(key, -limit, -1)
        return [json.loads(d) for d in data_list]

    async def clear_session(self, session_id: str):
        key = self._key(session_id)
        await self.redis.delete(key)

    async def get_message_count(self, session_id: str) -> int:
        key = self._key(session_id)
        return await self.redis.llen(key)
```

```python
# 测试代码
import asyncio
import redis.asyncio as redis

async def test_session_cache():
    client = redis.Redis(host="localhost", port=6379, decode_responses=True)
    cache = SessionCache(client)

    session_id = "test-session-1"

    # 添加消息
    await cache.add_message(session_id, {"role": "user", "content": "你好"})
    await cache.add_message(session_id, {"role": "assistant", "content": "你好！有什么可以帮你的？"})

    # 获取消息
    messages = await cache.get_messages(session_id)
    print(f"消息数量: {len(messages)}")
    print(f"消息内容: {messages}")

    # 获取最近 1 条
    recent = await cache.get_recent_messages(session_id, limit=1)
    print(f"最近 1 条: {recent}")

    # 清除
    await cache.clear_session(session_id)
    await client.aclose()

asyncio.run(test_session_cache())
```

**要点**：
- `RPUSH` + `LTRIM` 组合保证 List 长度不超过 `max_messages`，超出部分从头部丢弃（最旧的消息）
- `EXPIRE` 在每次写入时刷新，保证不活跃的会话自动过期释放内存
- 常见错误：用 `JSON.stringify` 时不指定 `default=str`，遇到 `datetime` 类型会报序列化错误

### 练习 2

**思路**：固定窗口用 Redis INCR + EXPIRE 实现，滑动窗口用 Sorted Set + ZREMRANGEBYSCORE 实现。

**答案**：

```python
# backend/app/core/ratelimit.py
import time
import redis.asyncio as redis

class FixedWindowRateLimiter:
    """固定窗口限流器"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def check(self, key: str, max_requests: int, window_seconds: int) -> bool:
        current = await self.redis.incr(key)
        if current == 1:
            await self.redis.expire(key, window_seconds)
        return current <= max_requests


class SlidingWindowRateLimiter:
    """滑动窗口限流器"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def check(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        window_start = now - window_seconds

        pipe = self.redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, window_seconds)

        results = await pipe.execute()
        request_count = results[2]
        return request_count <= max_requests
```

```python
# 测试代码
async def test_rate_limiter():
    client = redis.Redis(host="localhost", port=6379, decode_responses=True)
    limiter = SlidingWindowRateLimiter(client)

    allowed = 0
    blocked = 0
    for i in range(50):
        result = await limiter.check("rate:test:user1", max_requests=30, window_seconds=60)
        if result:
            allowed += 1
        else:
            blocked += 1

    print(f"允许: {allowed}, 拒绝: {blocked}")
    # 预期: 允许 30, 拒绝 20

    await client.aclose()

asyncio.run(test_rate_limiter())
```

**要点**：
- 固定窗口实现简单，但在窗口边界（如 59 秒和下一分钟的 1 秒）可能允许两倍的请求量
- 滑动窗口用 Sorted Set 精确记录每个请求的时间戳，没有边界突发问题，但内存消耗更大
- 常见错误：`INCR` 后忘记 `EXPIRE`，导致 key 永不过期，限流永远生效

### 练习 3

**思路**：用 Redis List 做任务队列（RPUSH 入队、BRPOP 出队），在任务数据中记录重试次数，失败时重新入队直到达到最大重试次数。

**答案**：

```python
# backend/app/core/task_queue.py
import json
import uuid
import asyncio
import redis.asyncio as redis
import logging
from typing import Callable

logger = logging.getLogger(__name__)

class TaskQueue:
    def __init__(self, redis_client: redis.Redis, max_retries: int = 3):
        self.redis = redis_client
        self.queue_key = "task_queue:pending"
        self.processing_key = "task_queue:processing"
        self.dead_letter_key = "task_queue:dead_letter"
        self.max_retries = max_retries
        self.handlers: dict[str, Callable] = {}

    def register_handler(self, task_type: str, handler: Callable):
        self.handlers[task_type] = handler

    async def enqueue(self, task_type: str, payload: dict) -> str:
        task_id = str(uuid.uuid4())
        task = {
            "id": task_id,
            "type": task_type,
            "payload": payload,
            "retry_count": 0,
        }
        await self.redis.rpush(self.queue_key, json.dumps(task, ensure_ascii=False))
        return task_id

    async def dequeue(self) -> dict | None:
        result = await self.redis.brpop(self.queue_key, timeout=1)
        if result is None:
            return None
        _, data = result
        task = json.loads(data)
        await self.redis.hset(self.processing_key, task["id"], data)
        return task

    async def complete(self, task_id: str):
        await self.redis.hdel(self.processing_key, task_id)

    async def requeue(self, task: dict):
        task["retry_count"] += 1
        if task["retry_count"] > self.max_retries:
            logger.error(f"Task {task['id']} exceeded max retries, moving to dead letter queue")
            await self.redis.rpush(self.dead_letter_key, json.dumps(task, ensure_ascii=False))
            await self.redis.hdel(self.processing_key, task["id"])
            return
        logger.info(f"Requeuing task {task['id']}, retry {task['retry_count']}/{self.max_retries}")
        await self.redis.hdel(self.processing_key, task["id"])
        await self.redis.rpush(self.queue_key, json.dumps(task, ensure_ascii=False))

    async def run_worker(self):
        logger.info("Task worker started")
        while True:
            try:
                task = await self.dequeue()
                if task is None:
                    continue
                handler = self.handlers.get(task["type"])
                if handler is None:
                    logger.error(f"No handler for task type: {task['type']}")
                    await self.complete(task["id"])
                    continue
                try:
                    await handler(task["payload"])
                    await self.complete(task["id"])
                except Exception as e:
                    logger.error(f"Task {task['id']} failed: {e}")
                    await self.requeue(task)
            except Exception as e:
                logger.error(f"Worker error: {e}", exc_info=True)
                await asyncio.sleep(1)
```

```python
# 测试代码
async def test_task_queue():
    client = redis.Redis(host="localhost", port=6379, decode_responses=True)
    queue = TaskQueue(client, max_retries=3)

    call_count = 0

    async def flaky_handler(payload: dict):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise RuntimeError("模拟临时错误")
        print(f"任务成功: {payload}")

    queue.register_handler("test_task", flaky_handler)
    task_id = await queue.enqueue("test_task", {"message": "hello"})
    print(f"任务入队: {task_id}")

    # 模拟 worker 处理
    for _ in range(5):
        task = await queue.dequeue()
        if task:
            handler = queue.handlers.get(task["type"])
            try:
                await handler(task["payload"])
                await queue.complete(task["id"])
            except Exception as e:
                print(f"任务失败: {e}, 重试次数: {task['retry_count']}")
                await queue.requeue(task)

    print(f"总调用次数: {call_count}")
    await client.aclose()

asyncio.run(test_task_queue())
```

**要点**：
- `BRPOP` 是阻塞式弹出，没有任务时会等待指定秒数，避免 Worker 空转浪费 CPU
- 失败任务进入死信队列而不是直接丢弃，方便后续排查和手动重试
- 常见错误：Worker 执行中崩溃导致任务丢失——`processing` 集合记录了正在处理的任务，重启后可以恢复

## 本节要点

- Redis 是 AI 应用的"瑞士军刀"：缓存、限流、队列、锁都能做
- 对话上下文缓存是最常见的场景，能显著降低数据库压力
- 限流是 AI 应用的必须——LLM API 调用太贵了
- 异步任务队列让用户体验更流畅（不用等 Agent 执行完）

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| `redis.ConnectionError` | Redis 没启动 | `docker compose up redis` |
| 缓存和数据库数据不一致 | 改了数据库没更新缓存 | 先更新数据库，再删除缓存 |
| 限流不生效 | key 设计不对 | 确保 key 包含用户标识 |
| 任务丢失 | Worker 执行中崩溃 | 用 `processing` 集合追踪，重启后恢复 |

## 工程建议

- 缓存和数据库的一致性是永恒难题，推荐"先更新数据库，再删除缓存"的策略，而不是试图保持双写同步
- 限流算法要根据业务场景选择：固定窗口简单但有边界突发问题，滑动窗口更平滑但实现复杂度高
- 任务队列要有重试机制和死信队列，避免任务因偶发错误永久丢失
- Redis 连接池要配置合理的 `max_connections`，生产环境建议监控连接使用率
- 生产环境 Redis 要开启持久化（AOF + RDB），避免数据丢失；同时配置哨兵或集群保证高可用
