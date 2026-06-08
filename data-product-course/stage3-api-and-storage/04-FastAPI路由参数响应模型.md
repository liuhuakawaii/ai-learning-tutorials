# 第4课：FastAPI 路由、参数、响应模型

> **课程定位**：使用 FastAPI 构建数据查询 API
> **前置知识**：第3课（索引、分页、查询性能）
> **预计时长**：60 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 搭建 FastAPI 项目结构
2. 设计 RESTful API 路由
3. 定义请求参数和验证
4. 设计响应模型
5. 处理错误和异常

---

## 一、FastAPI 基础

### 1.1 项目结构

```
api/
├── main.py              # 入口文件
├── config.py            # 配置
├── database.py          # 数据库连接
├── models/              # 数据模型
│   ├── __init__.py
│   ├── job.py
│   └── metric.py
├── routers/             # 路由
│   ├── __init__.py
│   ├── jobs.py
│   └── metrics.py
├── services/            # 业务逻辑
│   ├── __init__.py
│   ├── job_service.py
│   └── metric_service.py
└── utils/               # 工具函数
    ├── __init__.py
    └── pagination.py
```

### 1.2 基本示例

```python
# main.py
from fastapi import FastAPI
from routers import jobs, metrics

app = FastAPI(
    title="招聘数据 API",
    description="提供招聘数据查询接口",
    version="1.0.0"
)

# 注册路由
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"])

@app.get("/")
async def root():
    return {"message": "招聘数据 API"}
```

---

## 二、路由设计

### 2.1 RESTful 设计

```
┌──────────────────────────────────────────────────────────────┐
│                    RESTful API 设计                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  GET    /api/jobs              - 获取岗位列表                │
│  GET    /api/jobs/{id}         - 获取单个岗位                │
│  GET    /api/jobs/search       - 搜索岗位                    │
│  GET    /api/jobs/export       - 导出数据                    │
│                                                              │
│  GET    /api/metrics/cities    - 城市统计                    │
│  GET    /api/metrics/skills    - 技能统计                    │
│  GET    /api/metrics/trends    - 趋势数据                    │
│                                                              │
│  GET    /api/health            - 健康检查                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 路由实现

```python
# routers/jobs.py
from fastapi import APIRouter, Query, Path, HTTPException
from typing import List, Optional
from models.job import JobResponse, JobListResponse

router = APIRouter()

@router.get("/", response_model=JobListResponse)
async def list_jobs(
    city: Optional[str] = Query(None, description="城市筛选"),
    salary_min: Optional[float] = Query(None, ge=0, description="最低薪资"),
    salary_max: Optional[float] = Query(None, ge=0, description="最高薪资"),
    experience: Optional[str] = Query(None, description="经验要求"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: str = Query("publish_date", description="排序字段"),
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="排序方向")
):
    """获取岗位列表"""
    # 实现逻辑
    pass

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str = Path(..., description="岗位ID")
):
    """获取单个岗位"""
    # 实现逻辑
    pass

@router.get("/search")
async def search_jobs(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    city: Optional[str] = Query(None, description="城市筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """搜索岗位"""
    # 实现逻辑
    pass
```

---

## 三、请求参数

### 3.1 查询参数

```python
from fastapi import Query
from typing import Optional

# 基本类型
city: str = Query(..., description="城市")
page: int = Query(1, ge=1, description="页码")

# 可选参数
salary_min: Optional[float] = Query(None, ge=0, description="最低薪资")

# 枚举值
sort_by: str = Query(
    "publish_date",
    enum=["publish_date", "salary_avg", "city"],
    description="排序字段"
)

# 正则验证
sort_order: str = Query("desc", regex="^(asc|desc)$")

# 列表参数
cities: List[str] = Query([], description="城市列表")
```

### 3.2 路径参数

```python
from fastapi import Path

@router.get("/{job_id}")
async def get_job(
    job_id: str = Path(..., min_length=1, description="岗位ID")
):
    pass

@router.get("/cities/{city}/jobs")
async def get_city_jobs(
    city: str = Path(..., description="城市名称")
):
    pass
```

### 3.3 请求体

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date

class JobFilter(BaseModel):
    """岗位筛选条件"""
    cities: List[str] = Field(default=[], description="城市列表")
    salary_min: Optional[float] = Field(None, ge=0, description="最低薪资")
    salary_max: Optional[float] = Field(None, ge=0, description="最高薪资")
    experience: Optional[str] = Field(None, description="经验要求")
    education: Optional[str] = Field(None, description="学历要求")
    skills: List[str] = Field(default=[], description="技能要求")
    date_from: Optional[date] = Field(None, description="开始日期")
    date_to: Optional[date] = Field(None, description="结束日期")

@router.post("/filter")
async def filter_jobs(filter: JobFilter):
    """按条件筛选岗位"""
    pass
```

---

## 四、响应模型

### 4.1 定义响应模型

```python
# models/job.py
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime

class JobResponse(BaseModel):
    """单个岗位响应"""
    job_id: str = Field(..., description="岗位ID")
    title: str = Field(..., description="岗位名称")
    company: str = Field(..., description="公司名称")
    city: str = Field(..., description="城市")
    district: Optional[str] = Field(None, description="区域")
    salary_min: Optional[float] = Field(None, description="最低薪资", unit="元/月")
    salary_max: Optional[float] = Field(None, description="最高薪资", unit="元/月")
    salary_avg: Optional[float] = Field(None, description="平均薪资", unit="元/月")
    experience: Optional[str] = Field(None, description="经验要求")
    education: Optional[str] = Field(None, description="学历要求")
    skills: Optional[str] = Field(None, description="技能要求")
    publish_date: Optional[date] = Field(None, description="发布日期")
    source: str = Field(..., description="数据来源")
    
    class Config:
        schema_extra = {
            "example": {
                "job_id": "bj_10001",
                "title": "高级前端工程师",
                "company": "某科技有限公司",
                "city": "北京",
                "salary_avg": 27500
            }
        }

class PaginationInfo(BaseModel):
    """分页信息"""
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")
    total: int = Field(..., description="总记录数")
    total_pages: int = Field(..., description="总页数")

class JobListResponse(BaseModel):
    """岗位列表响应"""
    data: List[JobResponse] = Field(..., description="岗位列表")
    pagination: PaginationInfo = Field(..., description="分页信息")
    update_time: datetime = Field(..., description="数据更新时间")

class ErrorResponse(BaseModel):
    """错误响应"""
    error: str = Field(..., description="错误信息")
    detail: Optional[str] = Field(None, description="错误详情")
```

### 4.2 使用响应模型

```python
from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """获取单个岗位"""
    job = await job_service.get_job(job_id)
    
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"岗位 {job_id} 不存在"
        )
    
    return job

@router.get("/", response_model=JobListResponse)
async def list_jobs(
    city: str = None,
    page: int = 1,
    page_size: int = 20
):
    """获取岗位列表"""
    result = await job_service.list_jobs(
        city=city,
        page=page,
        page_size=page_size
    )
    
    return JobListResponse(
        data=result["data"],
        pagination=PaginationInfo(
            page=page,
            page_size=page_size,
            total=result["total"],
            total_pages=(result["total"] + page_size - 1) // page_size
        ),
        update_time=datetime.now()
    )
```

---

## 五、错误处理

### 5.1 异常处理器

```python
# utils/exceptions.py
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

class APIException(HTTPException):
    """API 异常基类"""
    def __init__(self, status_code: int, message: str, detail: str = None):
        super().__init__(status_code=status_code, detail=message)
        self.message = message
        self.detail = detail

class NotFoundException(APIException):
    """资源不存在"""
    def __init__(self, resource: str, id: str):
        super().__init__(
            status_code=404,
            message=f"{resource} 不存在",
            detail=f"找不到 {resource}: {id}"
        )

class ValidationException(APIException):
    """参数验证失败"""
    def __init__(self, message: str):
        super().__init__(
            status_code=422,
            message="参数验证失败",
            detail=message
        )

# 异常处理器
async def api_exception_handler(request: Request, exc: APIException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.message,
            "detail": exc.detail
        }
    )

# 注册到 app
app.add_exception_handler(APIException, api_exception_handler)
```

---

## 六、完整示例

```python
# services/job_service.py
from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, text

class JobService:
    """岗位服务"""
    
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string)
    
    async def list_jobs(
        self,
        city: Optional[str] = None,
        salary_min: Optional[float] = None,
        salary_max: Optional[float] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "publish_date",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """获取岗位列表"""
        
        # 构建查询条件
        conditions = []
        params = {"limit": page_size, "offset": (page - 1) * page_size}
        
        if city:
            conditions.append("city = :city")
            params["city"] = city
        
        if salary_min is not None:
            conditions.append("salary_avg >= :salary_min")
            params["salary_min"] = salary_min
        
        if salary_max is not None:
            conditions.append("salary_avg <= :salary_max")
            params["salary_max"] = salary_max
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        # 查询总数
        count_sql = f"SELECT COUNT(*) FROM clean_jobs WHERE {where_clause}"
        
        # 查询数据
        data_sql = f"""
            SELECT job_id, title, company, city, district,
                   salary_min, salary_max, salary_avg,
                   experience, education, skills,
                   publish_date, source
            FROM clean_jobs
            WHERE {where_clause}
            ORDER BY {sort_by} {sort_order}
            LIMIT :limit OFFSET :offset
        """
        
        with self.engine.connect() as conn:
            total = conn.execute(text(count_sql), params).scalar()
            result = conn.execute(text(data_sql), params)
            data = [dict(row._mapping) for row in result.fetchall()]
        
        return {
            "data": data,
            "total": total
        }
    
    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """获取单个岗位"""
        
        sql = "SELECT * FROM clean_jobs WHERE job_id = :job_id"
        
        with self.engine.connect() as conn:
            result = conn.execute(text(sql), {"job_id": job_id})
            row = result.fetchone()
            
            if row:
                return dict(row._mapping)
            return None

# routers/jobs.py
from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from models.job import JobResponse, JobListResponse, PaginationInfo
from services.job_service import JobService
from datetime import datetime

router = APIRouter()
job_service = JobService("postgresql://user:pass@localhost/jobs_db")

@router.get("/", response_model=JobListResponse)
async def list_jobs(
    city: Optional[str] = Query(None, description="城市筛选"),
    salary_min: Optional[float] = Query(None, ge=0, description="最低薪资"),
    salary_max: Optional[float] = Query(None, ge=0, description="最高薪资"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: str = Query("publish_date", description="排序字段"),
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="排序方向")
):
    """获取岗位列表"""
    
    result = await job_service.list_jobs(
        city=city,
        salary_min=salary_min,
        salary_max=salary_max,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order
    )
    
    return JobListResponse(
        data=result["data"],
        pagination=PaginationInfo(
            page=page,
            page_size=page_size,
            total=result["total"],
            total_pages=(result["total"] + page_size - 1) // page_size
        ),
        update_time=datetime.now()
    )

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """获取单个岗位"""
    
    job = await job_service.get_job(job_id)
    
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"岗位 {job_id} 不存在"
        )
    
    return job
```

---

## 动手练习

### 练习一：设计 API 路由

为"商品价格监控"设计 API 路由：

```
GET /api/products          - 商品列表
GET /api/products/{id}     - 商品详情
GET /api/products/search   - 商品搜索
GET /api/prices/trends     - 价格趋势
GET /api/prices/compare    - 价格对比
```

### 练习二：定义响应模型

定义以下响应模型：

1. ProductResponse - 商品响应
2. PriceTrendResponse - 价格趋势响应
3. PaginationInfo - 分页信息

### 练习三：实现查询服务

实现一个查询服务，支持：

1. 按条件筛选
2. 分页查询
3. 排序
4. 错误处理

---

## 小结

本课的核心要点：

1. **FastAPI 项目结构**：路由、模型、服务分离
2. **RESTful 设计**：GET/POST/PUT/DELETE，资源导向
3. **请求参数**：Query、Path、Body，支持验证
4. **响应模型**：Pydantic 模型，自动文档
5. **错误处理**：统一异常处理器

---

## 下一课预告

下一课我们将学习**筛选、排序、聚合接口**，实现更复杂的数据查询功能。
