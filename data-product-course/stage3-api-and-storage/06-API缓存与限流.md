# 第6课：API 缓存与限流

> **课程定位**：优化 API 性能和保护服务安全
> **前置知识**：第5课（筛选、排序、聚合接口）
> **预计时长**：45 分钟

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

## 小结

本课的核心要点：

1. **缓存策略**：Redis 缓存、TTL、主动失效
2. **限流算法**：固定窗口、滑动窗口、令牌桶
3. **缓存失效**：TTL、主动失效、穿透保护
4. **性能优化**：缓存 + 限流 = 高性能 + 高可用

---

## 下一课预告

下一课是阶段实战，我们将实现一个完整的**数据查询 API**，综合运用本阶段学习的所有技术。
