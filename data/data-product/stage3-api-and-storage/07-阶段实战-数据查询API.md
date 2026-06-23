# 阶段实战：数据查询 API

> 产品经理的需求：一个招聘数据查询 API，支持按城市、薪资、技能筛选，提供城市统计和技能排行，还要支持数据导出。

---

## 项目结构

```
jobs-api/
├── main.py              # 应用入口
├── config.py            # 配置
├── database.py          # 数据库连接
├── cache.py             # 缓存层
├── models/              # 数据模型
├── routers/             # 路由（jobs / metrics / export）
├── services/            # 业务逻辑
└── middleware/           # 限流
```

router 只负责接收参数和返回响应，service 负责业务逻辑。这样 service 可以被定时任务、CLI 工具复用。
## 应用入口

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import jobs, metrics, export
from middleware.rate_limit import RateLimitMiddleware

app = FastAPI(title="招聘数据 API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)
app.include_router(jobs.router, prefix="/api/jobs", tags=["岗位"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["指标"])
app.include_router(export.router, prefix="/api/export", tags=["导出"])

@app.get("/health")
async def health(): return {"status": "ok"}
```

## 岗位查询接口

```python
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from services.job_service import JobService
from cache import cached

router = APIRouter()
service = JobService()

@router.get("/")
@cached(ttl=300, prefix="jobs:list")
async def list_jobs(city: Optional[str] = Query(None), salary_min: Optional[float] = Query(None, ge=0),
                    salary_max: Optional[float] = Query(None, ge=0), experience: Optional[str] = None,
                    skills: Optional[str] = None, page: int = Query(1, ge=1),
                    page_size: int = Query(20, ge=1, le=100), sort_by: str = "publish_date",
                    sort_order: str = Query("desc", regex="^(asc|desc)$")):
    return await service.list_jobs(city=city, salary_min=salary_min, salary_max=salary_max,
                                   experience=experience, skills=skills, page=page,
                                   page_size=page_size, sort_by=sort_by, sort_order=sort_order)

@router.get("/{job_id}")
async def get_job(job_id: str):
    job = await service.get_job(job_id)
    if not job: raise HTTPException(404, f"岗位 {job_id} 不存在")
    return job
```

### Service 层

```python
from sqlalchemy import text
from database import get_engine

class JobService:
    async def list_jobs(self, city=None, salary_min=None, salary_max=None,
                        experience=None, skills=None, page=1, page_size=20,
                        sort_by="publish_date", sort_order="desc"):
        conditions, params = [], {}
        if city: conditions.append("city = :city"); params["city"] = city
        if salary_min is not None: conditions.append("salary_max >= :salary_min"); params["salary_min"] = salary_min
        if salary_max is not None: conditions.append("salary_min <= :salary_max"); params["salary_max"] = salary_max
        if experience: conditions.append("experience = :experience"); params["experience"] = experience
        if skills: conditions.append("skills && :skills"); params["skills"] = [s.strip() for s in skills.split(",")]
        where = " AND ".join(conditions) if conditions else "1=1"
        if sort_by not in {"publish_date", "salary_avg", "crawl_time"}: sort_by = "publish_date"
        direction = "DESC" if sort_order == "desc" else "ASC"
        params["limit"] = page_size; params["offset"] = (page - 1) * page_size
        with get_engine().connect() as conn:
            total = conn.execute(text(f"SELECT COUNT(*) FROM clean_jobs WHERE {where}"), params).scalar()
            rows = conn.execute(text(f"SELECT * FROM clean_jobs WHERE {where} ORDER BY {sort_by} {direction} LIMIT :limit OFFSET :offset"), params).mappings().all()
        return {"data": [dict(r) for r in rows],
                "pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": (total + page_size - 1) // page_size}}

    async def get_job(self, job_id: str):
        with get_engine().connect() as conn:
            row = conn.execute(text("SELECT * FROM clean_jobs WHERE job_id = :jid"), {"jid": job_id}).mappings().first()
        return dict(row) if row else None
```

**`sort_by` 白名单**：如果直接把前端传的字符串拼到 `ORDER BY` 子句里，攻击者可以注入任意 SQL。白名单是最简单的防御。

## 聚合接口

```python
from fastapi import APIRouter, Query
from typing import Optional
from datetime import date
from services.metric_service import MetricService
from cache import cached

router = APIRouter()
service = MetricService()

@router.get("/cities")
@cached(ttl=600, prefix="metrics:cities")
async def city_stats(date_from: Optional[date] = None, date_to: Optional[date] = None):
    return await service.get_city_stats(date_from, date_to)

@router.get("/skills")
@cached(ttl=600, prefix="metrics:skills")
async def skill_stats(city: Optional[str] = None, limit: int = Query(20, ge=1, le=100)):
    return await service.get_skill_stats(city, limit)

@router.get("/trends")
@cached(ttl=300, prefix="metrics:trends")
async def trends(city: Optional[str] = None, days: int = Query(30, ge=1, le=365)):
    return await service.get_trends(city, days)
```

```python
from sqlalchemy import text
from database import get_engine

class MetricService:
    async def get_city_stats(self, date_from=None, date_to=None):
        sql = "SELECT city, COUNT(*) as job_count, ROUND(AVG(salary_avg)) as avg_salary FROM clean_jobs WHERE 1=1"
        params = {}
        if date_from: sql += " AND publish_date >= :date_from"; params["date_from"] = date_from
        if date_to: sql += " AND publish_date <= :date_to"; params["date_to"] = date_to
        sql += " GROUP BY city ORDER BY job_count DESC"
        with get_engine().connect() as conn:
            return [dict(r) for r in conn.execute(text(sql), params).mappings().all()]

    async def get_skill_stats(self, city=None, limit=20):
        sql = "SELECT skill, COUNT(*) as demand FROM clean_jobs, unnest(skills) AS skill"
        params = {"limit": limit}
        if city: sql += " WHERE city = :city"; params["city"] = city
        sql += " GROUP BY skill ORDER BY demand DESC LIMIT :limit"
        with get_engine().connect() as conn:
            return [dict(r) for r in conn.execute(text(sql), params).mappings().all()]
```

## 缓存与限流

```python
# cache.py
import time, functools
_cache: dict[str, tuple[float, Any]] = {}

def cached(ttl: int = 300, prefix: str = ""):
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"{prefix}:{':'.join(str(v) for v in kwargs.values())}"
            if key in _cache:
                expire_at, data = _cache[key]
                if time.time() < expire_at: return data
            result = await func(*args, **kwargs)
            _cache[key] = (time.time() + ttl, result)
            return result
        return wrapper
    return decorator
```

```python
# middleware/rate_limit.py
import time
from collections import defaultdict
from starlette.responses import JSONResponse

class RateLimitMiddleware:
    def __init__(self, app, max_requests=100, window_seconds=60):
        self.app = app; self.max_requests = max_requests; self.window = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http": await self.app(scope, receive, send); return
        client_ip = scope.get("client", ("unknown",))[0]
        now = time.time()
        self.requests[client_ip] = [t for t in self.requests[client_ip] if now - t < self.window]
        if len(self.requests[client_ip]) >= self.max_requests:
            response = JSONResponse({"error": "请求过于频繁"}, status_code=429)
            await response(scope, receive, send); return
        self.requests[client_ip].append(now)
        await self.app(scope, receive, send)
```

缓存 TTL：岗位列表 5 分钟，聚合指标 10 分钟。按 IP 限流是最简单的起步方案，后面有认证了再改成按 API Key。
## 验收清单

- 列表接口支持 city / salary / experience / skills 筛选
- 分页参数校验（page >= 1, 1 <= page_size <= 100）
- 排序字段白名单（防 SQL 注入）
- 聚合接口查询 < 100ms（需要索引支撑）
- 热点数据有缓存，TTL 合理
- 同一 IP 60 秒内不超过 100 次请求
- 错误响应包含 error 和 detail 字段
- /health 正常返回

## 练习与参考答案

### 练习一：导出接口

实现 `GET /api/export/jobs`：支持与列表相同的筛选参数，返回 CSV，文件名含导出日期，单次最多 10000 条。

```python
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime
import csv, io
from database import get_engine
from sqlalchemy import text

router = APIRouter()

@router.get("/jobs")
async def export_jobs(city: Optional[str] = None, salary_min: Optional[float] = None,
                      salary_max: Optional[float] = None, experience: Optional[str] = None):
    conditions, params = [], {}
    if city: conditions.append("city = :city"); params["city"] = city
    if salary_min is not None: conditions.append("salary_max >= :salary_min"); params["salary_min"] = salary_min
    if salary_max is not None: conditions.append("salary_min <= :salary_max"); params["salary_max"] = salary_max
    if experience: conditions.append("experience = :experience"); params["experience"] = experience
    where = " AND ".join(conditions) if conditions else "1=1"
    params["limit"] = 10000
    with get_engine().connect() as conn:
        rows = conn.execute(text(f"SELECT * FROM clean_jobs WHERE {where} LIMIT :limit"), params).mappings().all()
    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader(); writer.writerows([dict(r) for r in rows])
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=jobs_{datetime.now():%Y%m%d}.csv"})
```

用 `StreamingResponse` 而不是一次性生成——数据量大时避免内存问题。

### 练习二：缓存失效

实现 `POST /api/cache/invalidate` 接口，支持按前缀清除缓存。

```python
from fastapi import APIRouter, Query
from cache import _cache

router = APIRouter()

@router.post("/invalidate")
async def invalidate_cache(prefix: str = Query(...)):
    keys = [k for k in _cache if k.startswith(prefix)]
    for k in keys: del _cache[k]
    return {"cleared": len(keys), "prefix": prefix}
```

生产环境用 Redis 时变成 `redis.delete` 按 pattern 匹配删除。接口设计不变，底层实现换。
