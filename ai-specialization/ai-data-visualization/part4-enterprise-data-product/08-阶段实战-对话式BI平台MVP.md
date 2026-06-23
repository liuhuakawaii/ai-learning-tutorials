# 08 - 阶段实战：对话式 BI 平台 MVP

> 把 Part 4 所有知识整合成一个可演示的对话式 BI 平台 MVP——从架构设计到代码实现，完成一个端到端的产品原型。

## 课程信息

| 项目 | 内容 |
|------|------|
| 所属阶段 | Part 4: 企业级数据产品 |
| 前置课程 | 07-嵌入式分析 |
| 预计时长 | 3 小时 |
| 难度等级 | ⭐⭐⭐⭐ |

---

## 场景引入

经过 Part 4 前七课的学习，你已经掌握了构建企业级数据产品的所有核心模块：对话式 BI 架构（01）、数据探索 Agent（02）、可视化 Dashboard（03）、数据权限体系（04）、多数据源接入（05）、性能优化（06）、嵌入式分析（07）。

现在是把这些模块组装起来的时候了。

产品经理给你的需求很明确：**两周内交付一个对话式 BI 平台的 MVP**。这个 MVP 需要让用户通过自然语言提问，系统自动理解意图、生成 SQL、查询数据库、返回可视化图表。同时要支持多租户、权限控制、缓存优化和嵌入式部署。

这不是一个 demo，而是一个**可以拿给客户试用的产品原型**。它不需要支持所有边界情况，但核心链路必须跑通，用户体验必须流畅。

本节课会从系统架构设计开始，逐模块实现，最终组装成一个完整的 MVP。每个模块都会引用前面课程的概念，但实现会做必要的简化——MVP 的核心是**验证产品价值**，而不是追求工程完美。

## 学习目标

完成本课后，你将能够：

1. 设计对话式 BI 平台的整体系统架构
2. 综合运用对话引擎、数据探索、可视化、权限、多数据源、性能优化和嵌入式分析
3. 构建一个端到端的 MVP 原型
4. 理解 MVP 阶段的技术取舍和优先级判断
5. 为后续迭代规划技术路线

## 核心概念

### 一、系统架构总览

对话式 BI 平台的 MVP 架构需要平衡**功能完整性**和**实现复杂度**。以下是推荐的分层架构：

```
对话式 BI 平台 MVP 架构
┌─────────────────────────────────────────────────────────┐
│                    客户端层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Web 对话界面 │  │  Dashboard   │  │  嵌入式组件   │  │
│  │  (引用 01)   │  │  (引用 03)   │  │  (引用 07)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         └──────────────────┼──────────────────┘          │
│                            ▼                             │
├──────────────────────────────────────────────────────────┤
│                    API 网关层                              │
│  ┌──────────────────────────────────────────────────┐    │
│  │  认证 → 租户识别 → 权限校验 → 请求路由             │    │
│  │  (引用 04)                                        │    │
│  └──────────────────────┬───────────────────────────┘    │
│                         ▼                                │
├──────────────────────────────────────────────────────────┤
│                    业务逻辑层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  对话引擎    │  │  数据探索    │  │  查询优化    │      │
│  │  NL2SQL     │  │  Agent      │  │  缓存/聚合   │      │
│  │  (引用 01)  │  │  (引用 02)  │  │  (引用 06)   │      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │
│         └────────────────┼────────────────┘              │
│                          ▼                               │
├──────────────────────────────────────────────────────────┤
│                    数据访问层                              │
│  ┌──────────────────────────────────────────────────┐    │
│  │  统一数据源适配器 (引用 05)                         │    │
│  │  PostgreSQL | MySQL | ClickHouse | REST API       │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

**MVP 的关键取舍**：

- **保留**：NL2SQL 对话引擎、基础可视化、单数据源查询、基本权限、Redis 缓存
- **简化**：数据探索 Agent 用简单的规则引擎替代完整 ReAct、多数据源只支持 PostgreSQL
- **延后**：Web Worker 渲染优化、SSE 增量推送、完整的白标系统

### 二、对话引擎设计（引用 01 课）

对话引擎是 MVP 的核心。它负责把用户的自然语言问题转换为可执行的 SQL 查询。MVP 阶段采用简化版的三步流程：

```
对话引擎处理流程
┌───────────────────────────────────────────────────────┐
│  用户输入: "上个月华东区的销售额是多少?"                 │
│     │                                                  │
│     ▼                                                  │
│  ┌─────────────────────────────────────────────┐       │
│  │  Step 1: 意图分类                             │       │
│  │  LLM 判断: 数据查询类 (非闲聊、非探索)         │       │
│  └─────────────────────┬───────────────────────┘       │
│                        ▼                               │
│  ┌─────────────────────────────────────────────┐       │
│  │  Step 2: Schema Linking                      │       │
│  │  从元数据中匹配:                              │       │
│  │  - "销售额" → orders.total_amount             │       │
│  │  - "华东区" → orders.region = 'east'          │       │
│  │  - "上个月" → order_date BETWEEN ...          │       │
│  └─────────────────────┬───────────────────────┘       │
│                        ▼                               │
│  ┌─────────────────────────────────────────────┐       │
│  │  Step 3: SQL 生成                             │       │
│  │  SELECT SUM(total_amount)                     │       │
│  │  FROM orders                                  │       │
│  │  WHERE region = 'east'                        │       │
│  │    AND order_date >= '2025-02-01'             │       │
│  │    AND order_date < '2025-03-01'              │       │
│  └─────────────────────┬───────────────────────┘       │
│                        ▼                               │
│  ┌─────────────────────────────────────────────┐       │
│  │  Step 4: 执行 + 可视化推荐                     │       │
│  │  查询结果: ¥1,234,567                         │       │
│  │  推荐图表: KPI 卡片 (单值结果)                  │       │
│  └─────────────────────────────────────────────┘       │
└───────────────────────────────────────────────────────┘
```

### 三、可视化与 Dashboard（引用 03 课）

MVP 的可视化层需要支持两种场景：

1. **对话结果展示**：用户提问后，系统根据查询结果自动选择图表类型（单值用 KPI 卡片，趋势用折线图，分布用柱状图，占比用饼图）
2. **Dashboard 拼接**：用户可以把对话中的图表"钉"到 Dashboard 上，形成固定看板

图表类型推荐逻辑：

| 数据特征 | 推荐图表 | 判断条件 |
|---------|---------|---------|
| 单行单列 | KPI 卡片 | 结果只有 1 个数值 |
| 时间序列 | 折线图 | 包含日期列 + 数值列 |
| 分类对比 | 柱状图 | 包含分类列 + 数值列，行数 < 20 |
| 占比关系 | 饼图 | 分类列 + 数值列，行数 < 8 |
| 多维数据 | 表格 | 超过 3 列或行数 > 50 |

### 四、权限与多租户（引用 04、07 课）

MVP 的权限模型采用简化的 RBAC：

```
权限模型
┌───────────────────────────────────────────────────────┐
│  租户 (Tenant)                                        │
│  ├── 角色: admin / analyst / viewer                   │
│  │   ├── admin: 所有权限, 可管理用户                    │
│  │   ├── analyst: 可查询, 可创建看板                    │
│  │   └── viewer: 只能查看已分享的看板                   │
│  │                                                    │
│  └── 数据范围:                                        │
│      ├── admin: 全量数据                               │
│      ├── analyst: 本部门数据                           │
│      └── viewer: 已授权数据                            │
└───────────────────────────────────────────────────────┘
```

权限控制在两个层面实施：
- **API 层**：JWT 令牌校验 + 租户隔离
- **查询层**：SQL 自动注入数据范围过滤条件

### 五、性能优化策略（引用 06 课）

MVP 阶段的性能优化聚焦在**投入产出比最高**的三个点：

1. **查询缓存**：Redis 缓存查询结果，相同问题不重复查数据库。TTL 设为 5 分钟
2. **Schema 缓存**：数据库表结构变化频率极低，缓存元数据避免每次都查 information_schema
3. **LLM 结果缓存**：相同问题的 NL2SQL 结果缓存 1 小时，避免重复调用 LLM

这三层缓存能覆盖 80% 的性能问题，且实现成本低。更高级的优化（物化视图、SSE 增量推送、Canvas 渲染）留给后续迭代。

## 代码实战：对话式 BI 平台 MVP

### 项目结构

```
conversational-bi-mvp/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置管理
│   ├── auth/
│   │   ├── jwt_auth.py      # JWT 认证
│   │   └── permissions.py   # 权限控制
│   ├── dialogue/
│   │   ├── engine.py        # 对话引擎
│   │   ├── schema_linker.py # Schema Linking
│   │   └── sql_generator.py # SQL 生成
│   ├── data/
│   │   ├── datasource.py    # 数据源适配器
│   │   └── query_cache.py   # 查询缓存
│   ├── viz/
│   │   ├── chart_router.py  # 图表类型推荐
│   │   └── dashboard.py     # Dashboard 管理
│   └── models.py            # 数据模型
├── frontend/
│   └── index.html           # 前端对话界面
├── requirements.txt
└── seed_data.py             # 示例数据
```

### requirements.txt

```
fastapi==0.115.0
uvicorn==0.30.0
pyjwt==2.9.0
redis==5.0.0
psycopg2-binary==2.9.9
httpx==0.27.0
```

### app/config.py

```python
"""配置管理：集中管理所有配置项。"""

from dataclasses import dataclass


@dataclass
class AppConfig:
    database_url: str = "postgresql://localhost:5432/bi_platform"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "mvp-secret-key-change-in-production"
    llm_api_url: str = "https://api.openai.com/v1/chat/completions"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    cache_ttl_seconds: int = 300
    llm_cache_ttl_seconds: int = 3600

    @classmethod
    def from_env(cls) -> "AppConfig":
        import os
        return cls(
            database_url=os.getenv("DATABASE_URL", cls.database_url),
            redis_url=os.getenv("REDIS_URL", cls.redis_url),
            jwt_secret=os.getenv("JWT_SECRET", cls.jwt_secret),
            llm_api_key=os.getenv("LLM_API_KEY", cls.llm_api_key),
            llm_model=os.getenv("LLM_MODEL", cls.llm_model),
        )
```

### app/models.py

```python
"""数据模型：请求/响应结构定义。"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ChatRequest:
    message: str
    conversation_id: Optional[str] = None
    dashboard_id: Optional[str] = None


@dataclass
class ChatResponse:
    reply: str
    sql: Optional[str] = None
    data: Optional[list[dict]] = None
    chart_type: str = "text"
    conversation_id: str = ""
    pinned: bool = False


@dataclass
class DashboardWidget:
    widget_id: str
    title: str
    sql: str
    chart_type: str
    data: list[dict] = field(default_factory=list)
    position: dict = field(default_factory=lambda: {"x": 0, "y": 0, "w": 6, "h": 4})


@dataclass
class Dashboard:
    dashboard_id: str
    title: str
    tenant_id: str
    widgets: list[DashboardWidget] = field(default_factory=list)
```

### app/auth/jwt_auth.py

```python
"""JWT 认证：令牌生成与验证。"""

import time
import jwt
from dataclasses import dataclass
from typing import Optional


@dataclass
class UserContext:
    user_id: str
    tenant_id: str
    role: str
    department: str = ""


class JWTAuth:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key

    def create_token(self, user: UserContext, expires_in: int = 86400) -> str:
        payload = {
            "sub": user.user_id,
            "tenant_id": user.tenant_id,
            "role": user.role,
            "department": user.department,
            "iat": int(time.time()),
            "exp": int(time.time()) + expires_in,
        }
        return jwt.encode(payload, self.secret_key, algorithm="HS256")

    def verify_token(self, token: str) -> UserContext:
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=["HS256"])
            return UserContext(
                user_id=payload["sub"],
                tenant_id=payload["tenant_id"],
                role=payload["role"],
                department=payload.get("department", ""),
            )
        except jwt.ExpiredSignatureError:
            raise ValueError("令牌已过期")
        except jwt.InvalidTokenError:
            raise ValueError("令牌无效")
```

### app/auth/permissions.py

```python
"""权限控制：RBAC + 数据范围过滤。"""

from functools import wraps
from typing import Callable

from jwt_auth import UserContext


ROLE_PERMISSIONS = {
    "admin": {"query", "create_dashboard", "manage_users", "view_all_data"},
    "analyst": {"query", "create_dashboard", "view_department_data"},
    "viewer": {"view_shared_dashboard"},
}

DATA_SCOPE = {
    "admin": lambda ctx: "1=1",
    "analyst": lambda ctx: f"department = '{ctx.department}'",
    "viewer": lambda ctx: f"user_id = '{ctx.user_id}'",
}


def check_permission(user: UserContext, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(user.role, set())


def get_data_filter(user: UserContext) -> str:
    scope_fn = DATA_SCOPE.get(user.role, DATA_SCOPE["viewer"])
    return scope_fn(user)


def require_permission(permission: str):
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user = kwargs.get("user") or (args[0] if args else None)
            if not isinstance(user, UserContext):
                raise ValueError("缺少用户上下文")
            if not check_permission(user, permission):
                raise PermissionError(f"无权限: {permission}")
            return await func(*args, **kwargs)
        return wrapper
    return decorator
```

### app/data/datasource.py

```python
"""数据源适配器：统一的数据库查询接口。"""

import time
from dataclasses import dataclass
from typing import Optional

import psycopg2
import psycopg2.extras


@dataclass
class QueryResult:
    columns: list[str]
    rows: list[dict]
    row_count: int
    query_ms: float
    truncated: bool = False


class DataSource:
    def __init__(self, dsn: str):
        self.dsn = dsn
        self._conn = None

    def _get_conn(self):
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(self.dsn)
        return self._conn

    def execute(self, sql: str, params: Optional[tuple] = None, max_rows: int = 1000) -> QueryResult:
        conn = self._get_conn()
        t0 = time.perf_counter()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            raw_rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]
        elapsed_ms = (time.perf_counter() - t0) * 1000

        truncated = len(raw_rows) > max_rows
        rows = [dict(row) for row in raw_rows[:max_rows]]

        return QueryResult(
            columns=columns, rows=rows, row_count=len(raw_rows),
            query_ms=round(elapsed_ms, 1), truncated=truncated,
        )

    def get_table_schema(self) -> list[dict]:
        sql = """
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        """
        result = self.execute(sql, max_rows=500)
        return result.rows

    def get_schema_prompt(self, tables: Optional[list[str]] = None) -> str:
        schema_rows = self.get_table_schema()
        table_schemas: dict[str, list[str]] = {}
        for row in schema_rows:
            tname = row["table_name"]
            if tables and tname not in tables:
                continue
            if tname not in table_schemas:
                table_schemas[tname] = []
            table_schemas[tname].append(f"  {row['column_name']} {row['data_type']}")

        parts = []
        for tname, cols in table_schemas.items():
            parts.append(f"CREATE TABLE {tname} (\n" + ",\n".join(cols) + "\n)")
        return "\n\n".join(parts)
```

### app/data/query_cache.py

```python
"""查询缓存：Redis 缓存层，支持查询结果和 LLM 结果缓存。"""

import hashlib
import json
from typing import Any, Optional

import redis


class QueryCache:
    def __init__(self, redis_url: str, default_ttl: int = 300):
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        self.default_ttl = default_ttl

    def _make_key(self, prefix: str, content: str, tenant_id: str) -> str:
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
        return f"{prefix}:{tenant_id}:{content_hash}"

    def get_query_result(self, sql: str, tenant_id: str) -> Optional[dict]:
        key = self._make_key("qr", sql, tenant_id)
        cached = self.redis_client.get(key)
        return json.loads(cached) if cached else None

    def set_query_result(self, sql: str, tenant_id: str, result: dict, ttl: Optional[int] = None) -> None:
        key = self._make_key("qr", sql, tenant_id)
        self.redis_client.setex(key, ttl or self.default_ttl, json.dumps(result, default=str))

    def get_llm_result(self, prompt: str, tenant_id: str) -> Optional[str]:
        key = self._make_key("llm", prompt, tenant_id)
        return self.redis_client.get(key)

    def set_llm_result(self, prompt: str, tenant_id: str, result: str, ttl: int = 3600) -> None:
        key = self._make_key("llm", prompt, tenant_id)
        self.redis_client.setex(key, ttl, result)

    def invalidate_tenant(self, tenant_id: str) -> int:
        pattern = f"*:{tenant_id}:*"
        keys = self.redis_client.keys(pattern)
        if keys:
            return self.redis_client.delete(*keys)
        return 0
```

### app/dialogue/schema_linker.py

```python
"""Schema Linking：将用户自然语言映射到数据库表和字段。"""

from typing import Optional


class SchemaLinker:
    def __init__(self, schema_prompt: str):
        self.schema_prompt = schema_prompt
        self._table_aliases: dict[str, str] = {}
        self._column_aliases: dict[str, str] = {}
        self._build_aliases()

    def _build_aliases(self) -> None:
        alias_map = {
            "销售": ("orders", "total_amount"),
            "订单": ("orders", "id"),
            "客户": ("customers", "name"),
            "产品": ("products", "name"),
            "区域": ("orders", "region"),
            "日期": ("orders", "order_date"),
            "数量": ("orders", "quantity"),
            "金额": ("orders", "total_amount"),
        }
        for alias, (table, column) in alias_map.items():
            self._table_aliases[alias] = table
            self._column_aliases[alias] = column

    def find_relevant_tables(self, question: str) -> list[str]:
        tables = set()
        for alias, table in self._table_aliases.items():
            if alias in question:
                tables.add(table)
        return list(tables) if tables else ["orders"]

    def get_schema_for_question(self, question: str) -> str:
        relevant_tables = self.find_relevant_tables(question)
        lines = []
        for line in self.schema_prompt.split("\n"):
            for table in relevant_tables:
                if table in line:
                    lines.append(line)
                    break
        return "\n".join(lines) if lines else self.schema_prompt
```

### app/dialogue/sql_generator.py

```python
"""SQL 生成：调用 LLM 生成 SQL。"""

import json
import re
from typing import Optional

import httpx

from schema_linker import SchemaLinker


class SQLGenerator:
    def __init__(self, api_url: str, api_key: str, model: str):
        self.api_url = api_url
        self.api_key = api_key
        self.model = model
        self.linker: Optional[SchemaLinker] = None

    def set_schema(self, schema_prompt: str) -> None:
        self.linker = SchemaLinker(schema_prompt)

    async def generate(self, question: str, data_filter: str = "1=1", history: list[dict] = None) -> dict:
        if not self.linker:
            raise RuntimeError("未设置 Schema，请先调用 set_schema")

        relevant_schema = self.linker.get_schema_for_question(question)

        system_prompt = f"""你是一个 SQL 专家。根据用户的问题生成 PostgreSQL 查询语句。

数据库 Schema:
{relevant_schema}

数据范围过滤条件: {data_filter}

规则:
1. 只返回 SQL 语句，不要解释
2. 必须在 WHERE 子句中包含数据范围过滤条件
3. 使用标准 PostgreSQL 语法
4. 日期用 'YYYY-MM-DD' 格式
5. 别名用中文
6. 如果问题无法用 SQL 回答，返回 "UNSUPPORTED"

返回 JSON 格式: {{"sql": "...", "chart_type": "kpi|line|bar|pie|table", "explanation": "..."}}
"""

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history[-4:])
        messages.append({"role": "user", "content": question})

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.api_url,
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={"model": self.model, "messages": messages, "temperature": 0},
                timeout=30,
            )
            response.raise_for_status()
            result = response.json()

        content = result["choices"][0]["message"]["content"]
        try:
            parsed = json.loads(content)
            sql = parsed.get("sql", "")
            sql = re.sub(r"```sql\s*", "", sql)
            sql = re.sub(r"```", "", sql)
            sql = sql.strip()
            return {"sql": sql, "chart_type": parsed.get("chart_type", "table"), "explanation": parsed.get("explanation", "")}
        except json.JSONDecodeError:
            sql = re.sub(r"```sql\s*", "", content)
            sql = re.sub(r"```", "", sql).strip()
            return {"sql": sql, "chart_type": "table", "explanation": ""}
```

### app/dialogue/engine.py

```python
"""对话引擎：串联 Schema Linking → SQL 生成 → 查询执行 → 可视化推荐。"""

import uuid
from typing import Optional

from jwt_auth import UserContext
from datasource import DataSource, QueryResult
from query_cache import QueryCache
from sql_generator import SQLGenerator
from permissions import get_data_filter


class DialogueEngine:
    def __init__(self, datasource: DataSource, sql_generator: SQLGenerator, cache: QueryCache):
        self.datasource = datasource
        self.sql_generator = sql_generator
        self.cache = cache
        self._conversations: dict[str, list[dict]] = {}

    def initialize(self) -> None:
        schema_prompt = self.datasource.get_schema_prompt()
        self.sql_generator.set_schema(schema_prompt)

    async def handle_message(self, message: str, user: UserContext, conversation_id: Optional[str] = None) -> dict:
        if not conversation_id:
            conversation_id = str(uuid.uuid4())

        if conversation_id not in self._conversations:
            self._conversations[conversation_id] = []

        history = self._conversations[conversation_id]

        cached_llm = self.cache.get_llm_result(message, user.tenant_id)
        if cached_llm:
            import json
            generated = json.loads(cached_llm)
        else:
            data_filter = get_data_filter(user)
            generated = await self.sql_generator.generate(message, data_filter, history)
            import json
            self.cache.set_llm_result(message, user.tenant_id, json.dumps(generated, ensure_ascii=False))

        sql = generated["sql"]

        if sql == "UNSUPPORTED":
            return {
                "reply": "抱歉，这个问题我暂时无法用数据查询来回答。请尝试换个方式描述您的问题。",
                "conversation_id": conversation_id,
                "chart_type": "text",
            }

        cached_result = self.cache.get_query_result(sql, user.tenant_id)
        if cached_result:
            query_result = cached_result
        else:
            try:
                result = self.datasource.execute(sql)
                query_result = {
                    "columns": result.columns,
                    "rows": [self._serialize_row(row) for row in result.rows],
                    "row_count": result.row_count,
                    "query_ms": result.query_ms,
                }
                self.cache.set_query_result(sql, user.tenant_id, query_result)
            except Exception as e:
                return {
                    "reply": f"查询执行出错: {str(e)}",
                    "sql": sql,
                    "conversation_id": conversation_id,
                    "chart_type": "error",
                }

        history.append({"role": "user", "content": message})
        history.append({"role": "assistant", "content": f"SQL: {sql}\n结果: {query_result['row_count']} 行"})

        return {
            "reply": generated.get("explanation", "查询完成"),
            "sql": sql,
            "data": query_result["rows"][:100],
            "columns": query_result["columns"],
            "row_count": query_result["row_count"],
            "query_ms": query_result.get("query_ms", 0),
            "chart_type": generated["chart_type"],
            "conversation_id": conversation_id,
        }

    def _serialize_row(self, row: dict) -> dict:
        serialized = {}
        for k, v in row.items():
            if hasattr(v, "isoformat"):
                serialized[k] = v.isoformat()
            elif isinstance(v, (int, float, str, bool, type(None))):
                serialized[k] = v
            else:
                serialized[k] = str(v)
        return serialized
```

### app/viz/chart_router.py

```python
"""图表类型推荐：根据数据特征自动选择最合适的图表类型。"""

from typing import Optional


CHART_RULES = [
    {"condition": lambda cols, rows: len(rows) == 1 and len(cols) <= 2, "type": "kpi", "label": "KPI 卡片"},
    {"condition": lambda cols, rows: any("date" in c.lower() or "time" in c.lower() for c in cols), "type": "line", "label": "折线图"},
    {"condition": lambda cols, rows: len(rows) <= 20 and len(cols) == 2, "type": "bar", "label": "柱状图"},
    {"condition": lambda cols, rows: len(rows) <= 8 and len(cols) == 2, "type": "pie", "label": "饼图"},
]


class ChartRouter:
    @staticmethod
    def recommend(columns: list[str], rows: list[dict], hint: Optional[str] = None) -> str:
        if hint and hint in ("kpi", "line", "bar", "pie", "table"):
            return hint

        for rule in CHART_RULES:
            if rule["condition"](columns, rows):
                return rule["type"]

        return "table"

    @staticmethod
    def get_chart_config(chart_type: str, columns: list[str], rows: list[dict]) -> dict:
        if chart_type == "kpi" and rows:
            value = list(rows[0].values())[0]
            label = columns[0] if columns else ""
            return {"type": "kpi", "value": value, "label": label}

        if chart_type == "line" and len(columns) >= 2:
            x_col = next((c for c in columns if "date" in c.lower() or "time" in c.lower()), columns[0])
            y_cols = [c for c in columns if c != x_col]
            return {
                "type": "line",
                "x": {"column": x_col, "data": [str(r.get(x_col, "")) for r in rows]},
                "series": [{"name": y, "data": [float(r.get(y, 0) or 0) for r in rows]} for y in y_cols[:3]],
            }

        if chart_type == "bar" and len(columns) >= 2:
            return {
                "type": "bar",
                "categories": [str(r.get(columns[0], "")) for r in rows],
                "series": [{"name": columns[1], "data": [float(r.get(columns[1], 0) or 0) for r in rows]}],
            }

        if chart_type == "pie" and len(columns) >= 2:
            return {
                "type": "pie",
                "data": [{"name": str(r.get(columns[0], "")), "value": float(r.get(columns[1], 0) or 0)} for r in rows],
            }

        return {"type": "table", "columns": columns, "rows": rows}
```

### app/viz/dashboard.py

```python
"""Dashboard 管理：看板的创建、更新和 Widget 管理。"""

import uuid
from typing import Optional

from models import Dashboard, DashboardWidget


class DashboardManager:
    def __init__(self):
        self._dashboards: dict[str, Dashboard] = {}

    def create(self, title: str, tenant_id: str) -> Dashboard:
        dashboard_id = str(uuid.uuid4())[:8]
        dashboard = Dashboard(dashboard_id=dashboard_id, title=title, tenant_id=tenant_id)
        self._dashboards[dashboard_id] = dashboard
        return dashboard

    def get(self, dashboard_id: str, tenant_id: str) -> Optional[Dashboard]:
        dashboard = self._dashboards.get(dashboard_id)
        if dashboard and dashboard.tenant_id == tenant_id:
            return dashboard
        return None

    def list_by_tenant(self, tenant_id: str) -> list[Dashboard]:
        return [d for d in self._dashboards.values() if d.tenant_id == tenant_id]

    def add_widget(self, dashboard_id: str, tenant_id: str, widget: DashboardWidget) -> Optional[Dashboard]:
        dashboard = self.get(dashboard_id, tenant_id)
        if not dashboard:
            return None
        widget.widget_id = str(uuid.uuid4())[:8]
        dashboard.widgets.append(widget)
        return dashboard

    def remove_widget(self, dashboard_id: str, tenant_id: str, widget_id: str) -> Optional[Dashboard]:
        dashboard = self.get(dashboard_id, tenant_id)
        if not dashboard:
            return None
        dashboard.widgets = [w for w in dashboard.widgets if w.widget_id != widget_id]
        return dashboard
```

### app/main.py

```python
"""FastAPI 应用入口：对话式 BI 平台 MVP。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import AppConfig
from auth.jwt_auth import JWTAuth, UserContext
from auth.permissions import check_permission
from data.datasource import DataSource
from data.query_cache import QueryCache
from dialogue.engine import DialogueEngine
from dialogue.sql_generator import SQLGenerator
from viz.chart_router import ChartRouter
from viz.dashboard import DashboardManager
from models import ChatRequest, ChatResponse, DashboardWidget


config = AppConfig.from_env()
auth = JWTAuth(config.jwt_secret)
datasource = DataSource(config.database_url)
cache = QueryCache(config.redis_url, config.cache_ttl_seconds)
sql_gen = SQLGenerator(config.llm_api_url, config.llm_api_key, config.llm_model)
engine = DialogueEngine(datasource, sql_gen, cache)
dashboard_mgr = DashboardManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine.initialize()
    yield


app = FastAPI(title="对话式 BI 平台 MVP", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def get_current_user(authorization: str = Header(...)) -> UserContext:
    token = authorization.replace("Bearer ", "")
    try:
        return auth.verify_token(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.post("/api/chat")
async def chat(request: ChatRequest, user: UserContext = Depends(get_current_user)):
    if not check_permission(user, "query"):
        raise HTTPException(status_code=403, detail="无查询权限")

    result = await engine.handle_message(request.message, user, request.conversation_id)

    chart_type = result.get("chart_type", "text")
    chart_config = {}
    if result.get("data") and result.get("columns"):
        chart_type = ChartRouter.recommend(result["columns"], result["data"], hint=chart_type)
        chart_config = ChartRouter.get_chart_config(chart_type, result["columns"], result["data"])

    return {
        "reply": result.get("reply", ""),
        "sql": result.get("sql"),
        "chart_type": chart_type,
        "chart_config": chart_config,
        "data": result.get("data"),
        "row_count": result.get("row_count", 0),
        "query_ms": result.get("query_ms", 0),
        "conversation_id": result.get("conversation_id", ""),
    }


@app.post("/api/dashboards")
async def create_dashboard(title: str, user: UserContext = Depends(get_current_user)):
    if not check_permission(user, "create_dashboard"):
        raise HTTPException(status_code=403, detail="无创建看板权限")
    dashboard = dashboard_mgr.create(title, user.tenant_id)
    return {"dashboard_id": dashboard.dashboard_id, "title": dashboard.title}


@app.get("/api/dashboards")
async def list_dashboards(user: UserContext = Depends(get_current_user)):
    dashboards = dashboard_mgr.list_by_tenant(user.tenant_id)
    return [{"dashboard_id": d.dashboard_id, "title": d.title, "widget_count": len(d.widgets)} for d in dashboards]


@app.post("/api/dashboards/{dashboard_id}/pin")
async def pin_to_dashboard(dashboard_id: str, widget: DashboardWidget, user: UserContext = Depends(get_current_user)):
    result = dashboard_mgr.add_widget(dashboard_id, user.tenant_id, widget)
    if not result:
        raise HTTPException(status_code=404, detail="看板不存在")
    return {"dashboard_id": result.dashboard_id, "widget_count": len(result.widgets)}


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "mvp-1.0"}


app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### frontend/index.html

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <title>对话式 BI 平台</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui; background: #f3f4f6; height: 100vh; display: flex; flex-direction: column; }
    .header { background: #1f2937; color: white; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 18px; }
    .main { flex: 1; display: flex; max-width: 1200px; margin: 24px auto; width: 100%; padding: 0 24px; gap: 24px; }
    .chat-panel { flex: 1; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
    .chat-messages { flex: 1; overflow-y: auto; padding: 20px; }
    .message { margin-bottom: 16px; max-width: 85%; }
    .message.user { margin-left: auto; background: #4f46e5; color: white; padding: 12px 16px; border-radius: 12px 12px 4px 12px; }
    .message.bot { background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px 16px; border-radius: 12px 12px 12px 4px; }
    .message .sql { background: #1f2937; color: #a5f3fc; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; margin: 8px 0; white-space: pre-wrap; }
    .message .meta { font-size: 11px; color: #9ca3af; margin-top: 4px; }
    .chart-container { margin: 12px 0; }
    .chart-container canvas { max-width: 100%; }
    .input-area { padding: 16px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; }
    .input-area input { flex: 1; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
    .input-area button { padding: 12px 24px; background: #4f46e5; color: white; border: none; border-radius: 8px; cursor: pointer; }
    .sidebar { width: 300px; }
    .sidebar .card { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .sidebar h3 { font-size: 14px; margin-bottom: 12px; }
    .quick-query { display: block; width: 100%; text-align: left; padding: 8px 12px; margin-bottom: 6px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .quick-query:hover { background: #eef2ff; border-color: #c7d2fe; }
  </style>
</head>
<body>
  <nav class="header">
    <h1>对话式 BI 平台</h1>
    <span id="user-info" style="font-size:14px;color:#9ca3af"></span>
  </nav>

  <div class="main">
    <div class="chat-panel">
      <div class="chat-messages" id="messages">
        <div class="message bot">
          <div>你好！我是你的数据助手。你可以用自然语言问我任何关于业务数据的问题，比如"上个月的销售额是多少"。</div>
        </div>
      </div>
      <div class="input-area">
        <input type="text" id="query-input" placeholder="输入你的问题..." onkeydown="if(event.key==='Enter')sendMessage()">
        <button onclick="sendMessage()">发送</button>
      </div>
    </div>

    <div class="sidebar">
      <div class="card">
        <h3>快速提问</h3>
        <button class="quick-query" onclick="askQuestion('本月销售额是多少')">本月销售额</button>
        <button class="quick-query" onclick="askQuestion('各区域销售额排名')">区域销售排名</button>
        <button class="quick-query" onclick="askQuestion('最近7天的订单趋势')">近7天订单趋势</button>
        <button class="quick-query" onclick="askQuestion('销售额最高的前10个产品')">Top 10 产品</button>
      </div>
      <div class="card">
        <h3>查询信息</h3>
        <div id="query-info" style="font-size:13px;color:#6b7280">等待查询...</div>
      </div>
    </div>
  </div>

  <script>
    const API_BASE = 'http://localhost:8000';
    let conversationId = null;
    let authToken = localStorage.getItem('bi_token') || '';

    async function ensureAuth() {
      if (!authToken) {
        const resp = await fetch(`${API_BASE}/api/auth/demo-token`, { method: 'POST' });
        const data = await resp.json();
        authToken = data.token;
        localStorage.setItem('bi_token', authToken);
      }
      document.getElementById('user-info').textContent = '演示用户';
    }

    function addMessage(content, isUser = false, meta = '') {
      const container = document.getElementById('messages');
      const div = document.createElement('div');
      div.className = `message ${isUser ? 'user' : 'bot'}`;
      div.innerHTML = content;
      if (meta) {
        const metaDiv = document.createElement('div');
        metaDiv.className = 'meta';
        metaDiv.textContent = meta;
        div.appendChild(metaDiv);
      }
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function renderChart(chartConfig) {
      if (!chartConfig || chartConfig.type === 'table') return '';
      const canvasId = 'chart-' + Date.now();
      setTimeout(() => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (chartConfig.type === 'bar' && chartConfig.series) {
          const data = chartConfig.series[0].data;
          const max = Math.max(...data) || 1;
          const barW = w / data.length * 0.7;
          ctx.fillStyle = '#4f46e5';
          data.forEach((v, i) => {
            const x = (i / data.length) * w + barW * 0.15;
            const barH = (v / max) * (h - 30);
            ctx.fillRect(x, h - barH - 10, barW, barH);
          });
        }
        if (chartConfig.type === 'line' && chartConfig.series) {
          const data = chartConfig.series[0].data;
          const max = Math.max(...data) || 1;
          const min = Math.min(...data);
          const range = max - min || 1;
          ctx.strokeStyle = '#4f46e5';
          ctx.lineWidth = 2;
          ctx.beginPath();
          data.forEach((v, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = h - ((v - min) / range) * (h - 30) - 15;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          });
          ctx.stroke();
        }
      }, 100);
      return `<div class="chart-container"><canvas id="${canvasId}" width="500" height="200"></canvas></div>`;
    }

    async function sendMessage() {
      const input = document.getElementById('query-input');
      const message = input.value.trim();
      if (!message) return;
      input.value = '';
      addMessage(message, true);

      try {
        const resp = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ message, conversation_id: conversationId }),
        });
        const data = await resp.json();
        conversationId = data.conversation_id;

        let html = `<div>${data.reply}</div>`;
        if (data.sql) html += `<div class="sql">${data.sql}</div>`;
        html += renderChart(data.chart_config);

        addMessage(html, false, `${data.row_count} 行 | ${data.query_ms}ms | ${data.chart_type}`);
        document.getElementById('query-info').textContent = `行数: ${data.row_count} | 耗时: ${data.query_ms}ms | 图表: ${data.chart_type}`;
      } catch (e) {
        addMessage(`<div>请求失败: ${e.message}</div>`);
      }
    }

    function askQuestion(q) {
      document.getElementById('query-input').value = q;
      sendMessage();
    }

    ensureAuth();
  </script>
</body>
</html>
```

### seed_data.py

```python
"""生成示例数据：用于 MVP 演示。"""

import random
from datetime import datetime, timedelta

import psycopg2


def seed_database(dsn: str):
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            order_date DATE NOT NULL,
            region VARCHAR(20) NOT NULL,
            product_name VARCHAR(100) NOT NULL,
            customer_name VARCHAR(100) NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            total_amount DECIMAL(12,2) NOT NULL,
            department VARCHAR(50) NOT NULL
        )
    """)

    regions = ["east", "south", "north", "central", "west"]
    region_names = {"east": "华东", "south": "华南", "north": "华北", "central": "华中", "west": "西部"}
    products = ["笔记本电脑", "智能手机", "平板电脑", "智能手表", "无线耳机", "机械键盘", "显示器", "鼠标"]
    customers = ["阿里巴巴", "腾讯科技", "字节跳动", "美团", "京东", "拼多多", "网易", "小米科技"]
    departments = ["销售一部", "销售二部", "销售三部"]

    records = []
    for i in range(1000):
        days_ago = random.randint(0, 90)
        order_date = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        region = random.choice(regions)
        product = random.choice(products)
        customer = random.choice(customers)
        dept = random.choice(departments)
        quantity = random.randint(1, 50)
        unit_price = round(random.uniform(50, 8000), 2)
        total_amount = round(quantity * unit_price, 2)
        records.append((order_date, region, product, customer, quantity, unit_price, total_amount, dept))

    cur.executemany(
        "INSERT INTO orders (order_date, region, product_name, customer_name, quantity, unit_price, total_amount, department) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        records,
    )
    conn.commit()
    print(f"已插入 {len(records)} 条示例订单数据")
    cur.close()
    conn.close()


if __name__ == "__main__":
    import sys
    dsn = sys.argv[1] if len(sys.argv) > 1 else "postgresql://localhost:5432/bi_platform"
    seed_database(dsn)
```

## 常见误区

### 误区一：MVP 就是砍功能

很多团队把 MVP 理解为"功能砍一半"，结果做出来的东西既不完整也不好用。真正的 MVP 是**用最小的技术投入验证核心产品价值**。对于对话式 BI，核心价值是"用户用自然语言能得到准确的数据回答"。围绕这个核心，NL2SQL 的准确率和查询结果的正确性是必须保证的，而 Dashboard 编辑、导出 PDF、多语言支持等可以延后。

### 误区二：先做后端再做前端

很多工程师习惯先写完后端 API，再开始做前端界面。但在对话式 BI 这种产品中，**前端交互体验决定了产品价值**。用户感知到的价值是"我问了一个问题，系统给出了图表"——后端的 NL2SQL 引擎再好，如果前端展示不直观，用户也感受不到。

正确的做法是前后端并行开发，甚至先用 mock 数据把前端交互做通，再接入真实的后端逻辑。这样能更早发现交互问题。

### 误区三：NL2SQL 准确率要达到 95% 才能上线

NL2SQL 的准确率受 Schema 复杂度、用户表达习惯、业务术语等多种因素影响。MVP 阶段追求 95% 的准确率既不现实也不必要。

更务实的策略是：先覆盖 80% 的常见查询模式（单表查询、聚合统计、时间过滤），对于系统无法处理的查询，给用户一个友好的提示和手动编辑 SQL 的入口。随着用户反馈的积累，逐步提升准确率。

### 误区四：MVP 不需要考虑安全

MVP 是要给真实客户试用的，安全问题不能留到"正式版再处理"。至少需要保证：JWT 令牌认证、SQL 注入防护（LLM 生成的 SQL 必须经过校验）、租户数据隔离。这三个是底线，其他安全措施可以逐步加强。

## 小结与练习

### 小结

1. **系统架构**：四层架构（客户端 → API 网关 → 业务逻辑 → 数据访问），每层职责清晰
2. **对话引擎**：NL2SQL 是核心，Schema Linking 缩小 LLM 的搜索范围，提高准确率
3. **可视化推荐**：根据数据特征自动选择图表类型，降低用户的使用门槛
4. **权限与安全**：RBAC + 数据范围过滤 + JWT 令牌，三层防护确保多租户安全
5. **缓存策略**：查询缓存 + LLM 缓存 + Schema 缓存，三层缓存覆盖 80% 的性能问题
6. **MVP 哲学**：围绕核心价值做减法，而不是砍功能

### 练习

#### 练习一：实现 SQL 安全校验器

LLM 生成的 SQL 可能包含危险操作（DROP、DELETE、UPDATE 等）。请实现一个 SQL 安全校验器，在执行前检查 SQL 是否只包含 SELECT 语句，且不访问非授权表。

#### 练习二：实现对话上下文管理

当前的对话引擎没有处理多轮对话中的指代。请实现一个上下文管理模块，能够处理"那按区域拆分呢"这类追问——将"那"指代为上一个问题的查询结果。

#### 练习三：设计 NL2SQL 评估系统

如何评估 NL2SQL 的准确率？请设计一个评估系统：准备一组标准问题-SQL 对，定期运行评估，输出准确率报告。

---

## 参考答案

### 练习一

**思路**：用 SQL 解析库（sqlparse）将 SQL 拆解为语句列表，检查每条语句的类型。再用正则提取表名，与授权表列表对比。

**答案**：

```python
import re
from typing import Optional


class SQLSafetyChecker:
    FORBIDDEN_KEYWORDS = {"DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE", "CREATE", "GRANT", "REVOKE"}

    def __init__(self, allowed_tables: Optional[set[str]] = None):
        self.allowed_tables = allowed_tables or set()

    def check(self, sql: str) -> tuple[bool, str]:
        sql_upper = sql.upper().strip()

        for keyword in self.FORBIDDEN_KEYWORDS:
            pattern = rf'\b{keyword}\b'
            if re.search(pattern, sql_upper):
                return False, f"禁止使用 {keyword} 语句"

        if not sql_upper.startswith("SELECT") and not sql_upper.startswith("WITH"):
            return False, "只允许 SELECT 查询"

        if ";" in sql.rstrip(";"):
            return False, "不允许多条语句"

        if self.allowed_tables:
            tables = self._extract_tables(sql)
            unauthorized = tables - self.allowed_tables
            if unauthorized:
                return False, f"无权访问表: {', '.join(unauthorized)}"

        return True, "通过"

    def _extract_tables(self, sql: str) -> set[str]:
        patterns = [
            r'FROM\s+(\w+)',
            r'JOIN\s+(\w+)',
            r'INTO\s+(\w+)',
            r'UPDATE\s+(\w+)',
        ]
        tables = set()
        for pattern in patterns:
            matches = re.findall(pattern, sql, re.IGNORECASE)
            tables.update(m.lower() for m in matches)
        return tables


checker = SQLSafetyChecker(allowed_tables={"orders", "customers", "products"})

tests = [
    "SELECT * FROM orders WHERE region = 'east'",
    "SELECT * FROM orders; DROP TABLE orders;",
    "DELETE FROM orders WHERE id = 1",
    "SELECT * FROM secret_data",
    "WITH cte AS (SELECT * FROM orders) SELECT * FROM cte",
]
for sql in tests:
    ok, msg = checker.check(sql)
    print(f"{'✓' if ok else '✗'} {msg:20s} | {sql[:50]}")
```

**要点**：
- 关键字检查用词边界匹配，避免误匹配（如 `UPDATED_AT` 不应被拦截为 `UPDATE`）
- 多条语句检查是防 SQL 注入的关键——攻击者常在正常 SQL 后追加分号和恶意语句
- 表名白名单比黑名单更安全——默认拒绝所有未明确授权的表

### 练习二

**思路**：维护一个对话上下文栈，记录每轮的查询意图和 SQL。当检测到追问类表述时，将上一轮的 SQL 和数据特征注入到当前问题的 Prompt 中。

**答案**：

```python
from dataclasses import dataclass, field
from typing import Optional
import re


@dataclass
class ConversationTurn:
    user_message: str
    sql: str
    columns: list[str]
    row_count: int
    chart_type: str


@dataclass
class DialogueContext:
    turns: list[ConversationTurn] = field(default_factory=list)

    def add_turn(self, turn: ConversationTurn) -> None:
        self.turns.append(turn)
        if len(self.turns) > 10:
            self.turns = self.turns[-10:]

    def get_last_turn(self) -> Optional[ConversationTurn]:
        return self.turns[-1] if self.turns else None

    def is_followup(self, message: str) -> bool:
        followup_patterns = [
            r"^那",
            r"按.{1,4}拆分",
            r"换成",
            r"再加上",
            r"去掉",
            r"按.{1,4}分组",
            r"看看.{0,2}的趋势",
        ]
        return any(re.search(p, message) for p in followup_patterns)

    def build_context_prompt(self, current_message: str) -> str:
        if not self.is_followup(current_message) or not self.turns:
            return current_message

        last = self.get_last_turn()
        context = (
            f"用户上一轮的问题生成了如下 SQL:\n{last.sql}\n"
            f"返回了 {last.row_count} 行数据，列为: {', '.join(last.columns)}\n"
            f"图表类型: {last.chart_type}\n\n"
            f"用户的新问题: {current_message}\n\n"
            f"请基于上一轮的查询结果，生成新的 SQL。"
        )
        return context


ctx = DialogueContext()
ctx.add_turn(ConversationTurn(
    user_message="本月销售额是多少",
    sql="SELECT SUM(total_amount) FROM orders WHERE order_date >= '2025-03-01'",
    columns=["sum"], row_count=1, chart_type="kpi",
))

new_msg = "那按区域拆分呢"
prompt = ctx.build_context_prompt(new_msg)
print(prompt)
```

**要点**：
- 追问检测用正则匹配常见追问模式，而不是依赖 LLM 判断（更快、更可控）
- 上下文只保留最近 10 轮，避免 Prompt 过长
- 将上一轮的 SQL 和列信息注入 Prompt，让 LLM 能理解"拆分"是在上一个查询基础上加 GROUP BY

### 练习三

**思路**：维护一个标注数据集（golden set），包含自然语言问题和对应的正确 SQL。定期运行评估：对每个问题生成 SQL，与标准 SQL 对比执行结果是否一致。

**答案**：

```python
import json
from dataclasses import dataclass
from typing import Callable


@dataclass
class EvalCase:
    question: str
    expected_sql: str
    category: str
    difficulty: str


class NL2SQLEvaluator:
    def __init__(self, sql_generator: Callable, sql_executor: Callable):
        self.generate = sql_generator
        self.execute = sql_executor
        self.cases: list[EvalCase] = []

    def load_cases(self, path: str) -> None:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for item in data:
            self.cases.append(EvalCase(**item))

    def evaluate(self, sample_size: int = 0) -> dict:
        cases = self.cases
        if sample_size > 0:
            import random
            cases = random.sample(self.cases, min(sample_size, len(self.cases)))

        results = {"total": len(cases), "correct": 0, "errors": [], "by_category": {}, "by_difficulty": {}}

        for case in cases:
            try:
                generated = self.generate(case.question)
                generated_result = self.execute(generated)
                expected_result = self.execute(case.expected_sql)
                match = self._compare_results(generated_result, expected_result)
            except Exception as e:
                match = False
                results["errors"].append({"question": case.question, "error": str(e)})

            cat = case.category
            if cat not in results["by_category"]:
                results["by_category"][cat] = {"total": 0, "correct": 0}
            results["by_category"][cat]["total"] += 1
            if match:
                results["by_category"][cat]["correct"] += 1
                results["correct"] += 1

            diff = case.difficulty
            if diff not in results["by_difficulty"]:
                results["by_difficulty"][diff] = {"total": 0, "correct": 0}
            results["by_difficulty"][diff]["total"] += 1
            if match:
                results["by_difficulty"][diff]["correct"] += 1

        results["accuracy"] = results["correct"] / results["total"] if results["total"] > 0 else 0
        return results

    def _compare_results(self, generated: list[dict], expected: list[dict]) -> bool:
        if len(generated) != len(expected):
            return False
        if not generated:
            return True
        gen_values = [list(row.values()) for row in generated]
        exp_values = [list(row.values()) for row in expected]
        return sorted(str(r) for r in gen_values) == sorted(str(r) for r in exp_values)

    def report(self, results: dict) -> str:
        lines = [
            f"NL2SQL 评估报告",
            f"{'=' * 40}",
            f"总用例: {results['total']}  正确: {results['correct']}  准确率: {results['accuracy']:.1%}",
            f"",
            f"按类别:",
        ]
        for cat, stats in results["by_category"].items():
            acc = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
            lines.append(f"  {cat}: {acc:.1%} ({stats['correct']}/{stats['total']})")
        lines.append(f"\n按难度:")
        for diff, stats in results["by_difficulty"].items():
            acc = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
            lines.append(f"  {diff}: {acc:.1%} ({stats['correct']}/{stats['total']})")
        if results["errors"]:
            lines.append(f"\n错误用例 ({len(results['errors'])}):")
            for err in results["errors"][:5]:
                lines.append(f"  - {err['question']}: {err['error']}")
        return "\n".join(lines)
```

**要点**：
- 评估用**执行结果对比**而非 SQL 字符串对比——功能等价的 SQL 可能写法不同
- 按类别和难度两个维度统计准确率，找出薄弱环节
- 错误用例单独记录，用于后续的 Prompt 优化和 few-shot 补充
