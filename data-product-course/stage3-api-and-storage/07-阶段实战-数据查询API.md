# 第7课：阶段实战 - 数据查询 API

> **课程定位**：综合运用存储和 API 技术，构建完整的数据查询服务
> **前置知识**：第1-6课
> **预计时长**：120 分钟

---

## 场景引入

经过前 6 课的学习，你已经掌握了数据库设计、索引优化、API 构建、查询功能和性能优化的全部知识。现在是时候把它们整合起来了。产品经理给了你一个真实需求：构建一个招聘数据查询 API，支持按城市、薪资、技能筛选岗位，提供城市统计和技能排行的聚合接口，还要支持数据导出。这是一个完整的工程任务，需要你综合运用所有学到的技术。

---

## 学习目标

完成本课学习后，你将能够：

1. 设计完整的 API 项目结构
2. 实现数据查询、筛选、排序、聚合接口
3. 集成缓存和限流
4. 编写 API 文档
5. 部署 API 服务

---

## 一、项目结构

```
jobs-api/
├── main.py
├── config.py
├── database.py
├── cache.py
├── models/
│   ├── __init__.py
│   ├── job.py
│   └── metric.py
├── routers/
│   ├── __init__.py
│   ├── jobs.py
│   ├── metrics.py
│   └── export.py
├── services/
│   ├── __init__.py
│   ├── job_service.py
│   └── metric_service.py
├── middleware/
│   ├── __init__.py
│   └── rate_limit.py
└── utils/
    ├── __init__.py
    └── pagination.py
```

---

## 二、核心实现

### 2.1 完整的 API 示例

```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import jobs, metrics, export
from middleware.rate_limit import rate_limit_middleware

app = FastAPI(
    title="招聘数据 API",
    description="提供招聘数据查询、筛选、聚合和导出接口",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 限流中间件
app.middleware("http")(rate_limit_middleware)

# 注册路由
app.include_router(jobs.router, prefix="/api/jobs", tags=["岗位"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["指标"])
app.include_router(export.router, prefix="/api/export", tags=["导出"])

@app.get("/")
async def root():
    return {"message": "招聘数据 API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### 2.2 岗位查询接口

```python
# routers/jobs.py
from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from models.job import JobResponse, JobListResponse
from services.job_service import JobService
from cache import cache

router = APIRouter()
job_service = JobService()

@router.get("/", response_model=JobListResponse)
async def list_jobs(
    city: Optional[str] = Query(None, description="城市筛选"),
    salary_min: Optional[float] = Query(None, ge=0, description="最低薪资"),
    salary_max: Optional[float] = Query(None, ge=0, description="最高薪资"),
    experience: Optional[str] = Query(None, description="经验要求"),
    skills: Optional[str] = Query(None, description="技能（逗号分隔）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: str = Query("publish_date", description="排序字段"),
    sort_order: str = Query("desc", regex="^(asc|desc)$")
):
    """获取岗位列表"""
    cache_key = f"jobs:{city}:{salary_min}:{salary_max}:{experience}:{skills}:{page}:{page_size}:{sort_by}:{sort_order}"
    
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    result = await job_service.list_jobs(
        city=city, salary_min=salary_min, salary_max=salary_max,
        experience=experience, skills=skills,
        page=page, page_size=page_size,
        sort_by=sort_by, sort_order=sort_order
    )
    
    cache.set(cache_key, result, ttl=300)
    return result

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """获取单个岗位"""
    cache_key = f"job:{job_id}"
    
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    job = await job_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"岗位 {job_id} 不存在")
    
    cache.set(cache_key, job, ttl=600)
    return job

@router.get("/search")
async def search_jobs(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    city: Optional[str] = None,
    page: int = 1,
    page_size: int = 20
):
    """搜索岗位"""
    return await job_service.search_jobs(q, city, page, page_size)
```

### 2.3 聚合接口

```python
# routers/metrics.py
from fastapi import APIRouter, Query
from typing import Optional
from datetime import date
from services.metric_service import MetricService
from cache import cache

router = APIRouter()
metric_service = MetricService()

@router.get("/cities")
async def get_city_stats(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None
):
    """获取城市统计"""
    cache_key = f"metrics:cities:{date_from}:{date_to}"
    
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    result = await metric_service.get_city_stats(date_from, date_to)
    cache.set(cache_key, result, ttl=600)
    return result

@router.get("/skills")
async def get_skill_stats(
    city: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100)
):
    """获取技能统计"""
    cache_key = f"metrics:skills:{city}:{limit}"
    
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    result = await metric_service.get_skill_stats(city, limit)
    cache.set(cache_key, result, ttl=600)
    return result

@router.get("/trends")
async def get_trends(
    city: Optional[str] = None,
    days: int = Query(30, ge=1, le=365)
):
    """获取趋势数据"""
    cache_key = f"metrics:trends:{city}:{days}"
    
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    result = await metric_service.get_trends(city, days)
    cache.set(cache_key, result, ttl=300)
    return result
```

---

## 三、验收标准

```
┌──────────────────────────────────────────────────────────────┐
│                    验收标准                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  □ API 响应结构稳定                                          │
│    └── 统一的响应格式，包含 data、pagination、update_time    │
│                                                              │
│  □ 列表接口支持分页                                          │
│    └── page、page_size、total、total_pages                   │
│                                                              │
│  □ 聚合接口有合理索引                                        │
│    └── 查询响应时间 < 100ms                                  │
│                                                              │
│  □ 错误响应可理解                                            │
│    └── 包含 error 和 detail 字段                             │
│                                                              │
│  □ 有缓存机制                                                │
│    └── 热点数据缓存，减少数据库压力                          │
│                                                              │
│  □ 有限流机制                                                │
│    └── 每个 IP 有请求限制                                    │
│                                                              │
│  □ 有 API 文档                                                │
│    └── 自动生成的 Swagger 文档                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 常见误区

- **跳过表设计直接写 API**：没有合理的表结构和索引，API 写得再好也会因为慢查询而性能低下，表设计是 API 的基础
- **不做缓存直接上线**：生产环境的查询压力远超开发环境，没有缓存的 API 在高并发下会迅速崩溃
- **忽略错误处理和输入验证**：只关注正常流程，不处理异常情况，会导致服务不稳定且难以排查问题
- **不写 API 文档就交付**：FastAPI 虽然自动生成 Swagger 文档，但仍需要为每个接口添加清晰的描述和示例

---

## 工程建议

- 按照"先设计表结构，再实现查询，最后加缓存和限流"的顺序开发，每一步都验证性能再进入下一步
- 为所有接口编写集成测试，覆盖正常路径和边界情况（空结果、大数据量、非法参数），确保 API 的健壮性
- 使用 Docker Compose 编排 API 服务、PostgreSQL 和 Redis，一键启动完整的开发环境，降低环境配置成本
- 上线前使用压测工具（如 locust）模拟真实流量，验证 API 在高并发下的响应时间和错误率

---

## 小结

本课综合运用了：

1. **表设计**：raw、clean、metrics 三层架构
2. **索引优化**：针对查询场景设计索引
3. **FastAPI**：路由、参数、响应模型
4. **查询功能**：筛选、排序、聚合
5. **性能优化**：缓存、限流

---

## 阶段总结

恭喜你完成第三阶段的学习！你已经掌握了：

1. 数据库迁移：SQLite → PostgreSQL
2. 表设计：raw、clean、metrics 三层架构
3. 索引和分页：优化查询性能
4. FastAPI：构建 RESTful API
5. 查询功能：筛选、排序、聚合、导出
6. 性能优化：缓存、限流

下一阶段我们将进入 **Dashboard 与可视化**，学习如何构建数据分析看板。
