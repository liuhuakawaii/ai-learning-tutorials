# 第6课：API 缓存与限流

> **课程定位**：优化 API 性能和保护服务安全
> **前置知识**：第5课（筛选、排序、聚合接口）
> **预计时长**：45 分钟

---

## 场景引入

你的数据查询 API 功能完善，上线后收到了大量请求。但很快你发现两个问题：一是 Dashboard 页面每次刷新都要查询数据库，数据库 CPU 飙升到 90%；二是有人用脚本高频调用你的接口，1 分钟内发了 5000 次请求，直接把服务打挂了。你需要缓存来减轻数据库压力，需要限流来保护服务安全。

---

## 学习目标

完成本课学习后，你将能够：

1. 实现 API 响应缓存
2. 设计缓存失效策略
3. 实现请求限流
4. 处理高并发场景

---

## 一、缓存策略

### 1.1 缓存层次

```
┌──────────────────────────────────────────────────────────────┐
│                    缓存层次                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 客户端缓存                                                │
│     └── HTTP Cache-Control 头                                │
│                                                              │
│  2. CDN 缓存                                                  │
│     └── 静态资源、API 响应                                   │
│                                                              │
│  3. 应用缓存                                                  │
│     └── Redis / 内存缓存                                     │
│                                                              │
│  4. 数据库缓存                                                │
│     └── 查询缓存、结果缓存                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Redis 缓存实现

```python
import redis
import json
from typing import Optional, Any
from datetime import timedelta
from functools import wraps

class RedisCache:
    """Redis 缓存"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url)
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        data = self.redis.get(key)
        if data:
            return json.loads(data)
        return None
    
    def set(self, key: str, value: Any, ttl: int = 300):
        """设置缓存（默认 5 分钟）"""
        self.redis.setex(key, ttl, json.dumps(value, ensure_ascii=False))
    
    def delete(self, key: str):
        """删除缓存"""
        self.redis.delete(key)
    
    def delete_pattern(self, pattern: str):
        """删除匹配的缓存"""
        keys = self.redis.keys(pattern)
        if keys:
            self.redis.delete(*keys)

# 缓存装饰器
cache = RedisCache()

def cached(prefix: str, ttl: int = 300):
    """缓存装饰器"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = f"{prefix}:{hash(str(args) + str(kwargs))}"
            
            # 尝试获取缓存
            result = cache.get(cache_key)
            if result is not None:
                return result
            
            # 执行函数
            result = await func(*args, **kwargs)
            
            # 写入缓存
            cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator

# 使用示例
@cached(prefix="jobs_list", ttl=300)
async def list_jobs(city: str = None, page: int = 1):
    # 查询数据库...
    pass
```

---

## 二、限流策略

### 2.1 限流算法

```
┌──────────────────────────────────────────────────────────────┐
│                    限流算法                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 固定窗口                                                  │
│     ├── 实现简单                                             │
│     ├── 有突发流量问题                                       │
│     └── 示例：每分钟最多 60 次请求                           │
│                                                              │
│  2. 滑动窗口                                                  │
│     ├── 更平滑                                               │
│     ├── 实现复杂                                             │
│     └── 示例：任意 60 秒内最多 60 次请求                     │
│                                                              │
│  3. 令牌桶                                                    │
│     ├── 允许突发流量                                         │
│     ├── 适合 API 限流                                        │
│     └── 示例：每秒 10 个令牌，桶容量 100                     │
│                                                              │
│  4. 漏桶                                                      │
│     ├── 流量完全平滑                                         │
│     ├── 不允许突发                                           │
│     └── 示例：固定速率处理请求                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 限流实现

```python
import time
from typing import Optional
from fastapi import HTTPException, Request

class RateLimiter:
    """限流器"""
    
    def __init__(self, redis_client, max_requests: int = 60, window: int = 60):
        self.redis = redis_client
        self.max_requests = max_requests
        self.window = window  # 秒
    
    def is_allowed(self, key: str) -> bool:
        """检查是否允许请求"""
        current = int(time.time())
        window_start = current - self.window
        
        # 使用 Redis 记录请求时间
        pipe = self.redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {str(current): current})
        pipe.zcard(key)
        pipe.expire(key, self.window)
        results = pipe.execute()
        
        request_count = results[2]
        
        return request_count <= self.max_requests
    
    def get_remaining(self, key: str) -> int:
        """获取剩余请求数"""
        current = int(time.time())
        window_start = current - self.window
        
        self.redis.zremrangebyscore(key, 0, window_start)
        count = self.redis.zcard(key)
        
        return max(0, self.max_requests - count)

# FastAPI 中间件
from fastapi import Request, Response

rate_limiter = RateLimiter(redis_client, max_requests=60, window=60)

async def rate_limit_middleware(request: Request, call_next):
    """限流中间件"""
    
    # 获取客户端标识
    client_id = request.client.host
    
    # 检查限流
    if not rate_limiter.is_allowed(f"rate:{client_id}"):
        return Response(
            content=json.dumps({"error": "请求过于频繁"}),
            status_code=429,
            media_type="application/json"
        )
    
    # 添加限流头
    response = await call_next(request)
    remaining = rate_limiter.get_remaining(f"rate:{client_id}")
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    
    return response
```

---

## 三、缓存失效策略

### 3.1 失效策略

```
┌──────────────────────────────────────────────────────────────┐
│                    缓存失效策略                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. TTL（过期时间）                                           │
│     ├── 设置固定过期时间                                     │
│     ├── 简单有效                                             │
│     └── 适合变化不频繁的数据                                 │
│                                                              │
│  2. 主动失效                                                  │
│     ├── 数据更新时主动删除缓存                               │
│     ├── 保证数据一致性                                       │
│     └── 适合写操作频繁的场景                                 │
│                                                              │
│  3. 缓存穿透保护                                              │
│     ├── 缓存空值                                             │
│     ├── 布隆过滤器                                           │
│     └── 防止恶意请求                                         │
│                                                              │
│  4. 缓存雪崩保护                                              │
│     ├── 随机过期时间                                         │
│     ├── 多级缓存                                             │
│     └── 防止同时失效                                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 主动失效实现

```python
class CacheManager:
    """缓存管理器"""
    
    def __init__(self, redis_client):
        self.redis = redis_client
    
    def invalidate_job_cache(self, job_id: str = None):
        """失效岗位缓存"""
        if job_id:
            # 删除特定岗位缓存
            self.redis.delete(f"job:{job_id}")
        
        # 删除列表缓存（使用模式匹配）
        self.delete_pattern("jobs_list:*")
    
    def invalidate_city_cache(self, city: str):
        """失效城市缓存"""
        self.delete_pattern(f"jobs_list:*city={city}*")
        self.delete_pattern(f"city_stats:{city}")
    
    def delete_pattern(self, pattern: str):
        """删除匹配的缓存"""
        keys = self.redis.keys(pattern)
        if keys:
            self.redis.delete(*keys)

# 在数据更新时调用
async def update_job(job_id: str, data: dict):
    # 更新数据库...
    
    # 失效缓存
    cache_manager.invalidate_job_cache(job_id)
```

---

## 四、完整示例

```python
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import redis
import json
import time

app = FastAPI()

# Redis 连接
redis_client = redis.from_url("redis://localhost:6379")
cache = RedisCache(redis_client)
rate_limiter = RateLimiter(redis_client)

# 限流中间件
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # 跳过健康检查
    if request.url.path == "/health":
        return await call_next(request)
    
    client_id = request.client.host
    
    if not rate_limiter.is_allowed(f"rate:{client_id}"):
        return Response(
            content=json.dumps({"error": "请求过于频繁，请稍后再试"}),
            status_code=429,
            media_type="application/json"
        )
    
    response = await call_next(request)
    remaining = rate_limiter.get_remaining(f"rate:{client_id}")
    response.headers["X-RateLimit-Limit"] = str(rate_limiter.max_requests)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    
    return response

# 带缓存的查询
@router.get("/")
async def list_jobs(city: str = None, page: int = 1, page_size: int = 20):
    # 生成缓存键
    cache_key = f"jobs_list:city={city}:page={page}:size={page_size}"
    
    # 尝试从缓存获取
    cached_result = cache.get(cache_key)
    if cached_result:
        return cached_result
    
    # 查询数据库
    result = await job_service.list_jobs(city=city, page=page, page_size=page_size)
    
    # 写入缓存（5 分钟）
    cache.set(cache_key, result, ttl=300)
    
    return result

# 健康检查
@router.get("/health")
async def health_check():
    return {"status": "ok"}
```

---

## 常见误区

- **缓存 TTL 设置过长**：数据更新后用户看到的还是旧数据，应该根据数据更新频率设置合理的 TTL，必要时主动失效缓存
- **只做缓存不做限流**：缓存能提升性能，但无法防止恶意请求，限流是保护服务的最后防线，两者缺一不可
- **限流粒度太粗**：只按 IP 限流可能误伤共享 IP 的正常用户，应该结合 API Key、用户 ID 等多维度限流
- **缓存键设计不合理**：缓存键没有包含所有查询参数，可能导致返回错误的缓存结果

---

## 工程建议

- 缓存键应包含所有影响查询结果的参数（城市、页码、排序等），确保不同查询不会命中同一个缓存
- 使用 Redis 的有序集合（Sorted Set）实现滑动窗口限流，比固定窗口更平滑，避免窗口边界处的突发流量
- 为缓存添加随机偏移的 TTL（如 300±30 秒），防止大量缓存同时过期导致的缓存雪崩
- 在响应头中返回 X-RateLimit-Limit 和 X-RateLimit-Remaining，让客户端知道当前的限流状态

---

## 动手练习

### 练习一：实现缓存

实现一个缓存机制：

1. 使用 Redis 缓存查询结果
2. 设置合理的过期时间
3. 数据更新时失效缓存

### 练习二：实现限流

实现一个限流机制：

1. 每个 IP 每分钟最多 60 次请求
2. 超出限制返回 429 状态码
3. 在响应头中添加限流信息

### 练习三：优化性能

优化 API 性能：

1. 添加查询缓存
2. 优化慢查询
3. 添加压缩

---

## 参考答案

### 练习一

**思路**：用 Redis 缓存查询结果，缓存键包含所有查询参数确保唯一性，数据更新时主动删除相关缓存。

**答案**：

```python
import redis
import json
import hashlib
from typing import Optional, Any
from datetime import timedelta
from functools import wraps

class RedisCache:
    """Redis 缓存封装"""

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url)

    def _generate_key(self, prefix: str, params: dict) -> str:
        """根据前缀和参数生成唯一缓存键"""
        param_str = json.dumps(params, sort_keys=True, default=str)
        param_hash = hashlib.md5(param_str.encode()).hexdigest()[:12]
        return f"{prefix}:{param_hash}"

    def get(self, key: str) -> Optional[Any]:
        data = self.redis.get(key)
        return json.loads(data) if data else None

    def set(self, key: str, value: Any, ttl: int = 300):
        self.redis.setex(key, ttl, json.dumps(value, ensure_ascii=False, default=str))

    def delete(self, key: str):
        self.redis.delete(key)

    def delete_pattern(self, pattern: str):
        """批量删除匹配模式的缓存键"""
        keys = self.redis.keys(pattern)
        if keys:
            self.redis.delete(*keys)


cache = RedisCache()

# 使用示例：带缓存的岗位列表查询
async def list_jobs_with_cache(
    city: str = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """带缓存的查询"""
    cache_key = cache._generate_key("jobs_list", {
        "city": city, "page": page, "page_size": page_size
    })

    # 1. 尝试从缓存获取
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # 2. 缓存未命中，查询数据库
    result = await job_service.list_jobs(city=city, page=page, page_size=page_size)

    # 3. 写入缓存，TTL 5 分钟
    cache.set(cache_key, result, ttl=300)

    return result

# 数据更新时主动失效缓存
async def update_job(job_id: str, data: dict):
    """更新岗位数据并失效相关缓存"""
    # 更新数据库
    await job_service.update_job(job_id, data)

    # 失效该岗位的详情缓存
    cache.delete(f"job_detail:{job_id}")

    # 失效所有列表缓存（因为列表数据可能变化）
    cache.delete_pattern("jobs_list:*")
```

**要点**：
- 缓存键用 MD5 哈希参数，保证唯一且长度可控
- 数据更新时必须主动删除相关缓存，否则用户看到旧数据
- `delete_pattern` 用通配符批量删除，避免逐个删除

---

### 练习二

**思路**：使用 Redis 有序集合（Sorted Set）实现滑动窗口限流，比固定窗口更平滑。

**答案**：

```python
import time
import json
import redis
from fastapi import FastAPI, Request, Response

class SlidingWindowRateLimiter:
    """基于 Redis Sorted Set 的滑动窗口限流器"""

    def __init__(self, redis_client, max_requests: int = 60, window_seconds: int = 60):
        self.redis = redis_client
        self.max_requests = max_requests
        self.window = window_seconds

    def is_allowed(self, key: str) -> tuple[bool, int]:
        """检查是否允许请求，返回 (是否允许, 剩余次数)"""
        now = time.time()
        window_start = now - self.window

        pipe = self.redis.pipeline()
        # 移除窗口外的旧记录
        pipe.zremrangebyscore(key, 0, window_start)
        # 添加当前请求的时间戳
        pipe.zadd(key, {f"{now}:{id(now)}": now})
        # 统计窗口内的请求数
        pipe.zcard(key)
        # 设置键过期时间（自动清理）
        pipe.expire(key, self.window)
        results = pipe.execute()

        request_count = results[2]
        remaining = max(0, self.max_requests - request_count)

        return request_count <= self.max_requests, remaining


# 初始化
redis_client = redis.from_url("redis://localhost:6379")
rate_limiter = SlidingWindowRateLimiter(redis_client, max_requests=60, window_seconds=60)

app = FastAPI()

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """限流中间件"""
    # 跳过健康检查等无需限流的路径
    if request.url.path in ("/health", "/docs", "/openapi.json"):
        return await call_next(request)

    client_ip = request.client.host
    rate_key = f"rate_limit:{client_ip}"

    allowed, remaining = rate_limiter.is_allowed(rate_key)

    if not allowed:
        return Response(
            content=json.dumps({
                "error": "请求过于频繁，请稍后再试",
                "retry_after": rate_limiter.window,
            }),
            status_code=429,
            media_type="application/json",
            headers={
                "Retry-After": str(rate_limiter.window),
                "X-RateLimit-Limit": str(rate_limiter.max_requests),
                "X-RateLimit-Remaining": "0",
            },
        )

    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(rate_limiter.max_requests)
    response.headers["X-RateLimit-Remaining"] = str(remaining)

    return response
```

**要点**：
- 滑动窗口用 Sorted Set 存储请求时间戳，每次清理窗口外的记录
- 响应头包含 `X-RateLimit-Limit` 和 `X-RateLimit-Remaining`，客户端可据此控制请求频率
- 429 响应附带 `Retry-After` 头，告知客户端何时可以重试

---

### 练习三

**思路**：综合运用缓存、索引优化和响应压缩，从多个层面提升 API 性能。

**答案**：

```python
import gzip
import json
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import redis

app = FastAPI()

# 1. 查询缓存：对热点查询结果缓存 5 分钟
redis_client = redis.from_url("redis://localhost:6379")

def get_cached_or_query(cache_key: str, query_func, ttl: int = 300):
    """通用缓存包装函数"""
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    result = query_func()
    redis_client.setex(cache_key, ttl, json.dumps(result, ensure_ascii=False, default=str))
    return result

# 2. 响应压缩中间件
@app.middleware("http")
async def compress_response(request: Request, call_next):
    """对 JSON 响应启用 gzip 压缩"""
    response = await call_next(request)

    # 只压缩 JSON 响应
    content_type = response.headers.get("content-type", "")
    if "application/json" not in content_type:
        return response

    # 检查客户端是否支持 gzip
    accept_encoding = request.headers.get("accept-encoding", "")
    if "gzip" not in accept_encoding:
        return response

    # 读取响应体
    body = b""
    async for chunk in response.body_iterator:
        body += chunk if isinstance(chunk, bytes) else chunk.encode()

    # 压缩
    compressed = gzip.compress(body)

    # 如果压缩后更小，返回压缩版本
    if len(compressed) < len(body):
        return Response(
            content=compressed,
            status_code=response.status_code,
            headers={
                **dict(response.headers),
                "content-encoding": "gzip",
                "content-length": str(len(compressed)),
            },
            media_type="application/json",
        )

    return Response(
        content=body,
        status_code=response.status_code,
        headers=dict(response.headers),
        media_type="application/json",
    )

# 3. 慢查询优化示例：确保索引存在
# CREATE INDEX idx_clean_jobs_city_salary ON clean_jobs(city, salary_avg);
# CREATE INDEX idx_clean_jobs_publish_date ON clean_jobs(publish_date);

# 使用示例
@app.get("/api/jobs")
async def list_jobs(city: str = None, page: int = 1, page_size: int = 20):
    cache_key = f"jobs:city={city}:page={page}:size={page_size}"

    def query():
        # 实际数据库查询逻辑
        return job_service.list_jobs_sync(city=city, page=page, page_size=page_size)

    return get_cached_or_query(cache_key, query, ttl=300)
```

**要点**：
- 缓存减少数据库查询次数，限流保护服务不被打垮，压缩减少网络传输量
- gzip 压缩对 JSON 响应通常能减少 60%-80% 的体积
- 缓存键包含所有查询参数，确保不同查询不会互相覆盖
