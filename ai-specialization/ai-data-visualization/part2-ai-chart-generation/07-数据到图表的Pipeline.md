# 07 - 数据到图表的 Pipeline：从数据库到可视化图表的完整链路

> 单个模块做得再好，串不起来就是一堆零件。Pipeline 的价值在于把 NL2SQL、图表推荐、代码生成这些独立模块编织成一条可靠的生产线。

## 课程信息

| 项目 | 内容 |
|------|------|
| 所属阶段 | Part 2: AI 驱动的图表生成 |
| 前置课程 | 01-06 全部 |
| 预计时长 | 2.5 小时 |
| 难度等级 | ⭐⭐⭐⭐ |

## 场景引入

前六节课我们分别掌握了 NL2SQL、Schema Linking、图表推荐、代码生成、VL 模型等独立技术。现在想象一个真实需求：

用户在对话框里输入："帮我看看上个月各区域的销售额趋势"。

系统需要做的事情远不止一步：

1. 理解用户意图——"上个月"是时间范围，"各区域"是分组维度，"销售额趋势"暗示折线图
2. 把自然语言翻译成 SQL
3. 执行 SQL 并拿到结果
4. 判断数据特征——有几个区域？时间粒度是天还是周？
5. 推荐合适的图表类型
6. 生成 ECharts 配置代码
7. 渲染图表返回给用户

这七个步骤中任何一步出错，用户体验就会断裂。更关键的是，每一步都有失败的可能：SQL 语法错误、查询超时、数据为空、推荐的图表类型不合适、生成的代码有 bug……

**Pipeline 要解决的核心问题是：如何把这些不可靠的模块串联成一个可靠的系统？**

## 学习目标

完成本节课后，你将能够：

1. 理解数据到图表 Pipeline 的完整架构与各模块职责
2. 设计模块间的接口规范与数据流协议
3. 实现多层级错误处理与优雅降级策略
4. 运用缓存与异步机制优化 Pipeline 性能
5. 用状态机或 DAG 编排 Pipeline 的执行流程
6. 动手实现一个端到端的 Pipeline 原型

---

## 一、Pipeline 整体架构

### 1.1 为什么需要 Pipeline？

把独立模块直接调用不行吗？比如先调 NL2SQL，拿到 SQL 后调数据库，再调图表推荐，最后调代码生成。用一个简单的顺序调用串起来就够了。

这种"面条式调用"在原型阶段确实够用，但到了生产环境会暴露三个致命问题：

**错误传播失控**——NL2SQL 生成了错误的 SQL，数据库执行失败，但错误信息是 PostgreSQL 的报错文本，前端完全无法理解。你需要在每一层做错误转换和用户友好的提示。

**模块间耦合过紧**——NL2SQL 模块的输出格式变了，图表推荐模块就要跟着改。没有标准化的中间表示，改一个模块就要改一串。

**性能无法优化**——有些步骤可以并行（比如数据特征分析和 Schema Linking），有些步骤的结果可以缓存（相同查询的 SQL），面条式调用无法利用这些优化空间。

Pipeline 的本质是**用标准化的接口和编排逻辑，把不可靠的模块组装成可靠的系统**。

### 1.2 整体架构图

```
用户输入: "上个月各区域销售额趋势"
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Pipeline Orchestrator                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ 意图解析 │─▶│NL2SQL   │─▶│ 查询执行 │─▶│ 数据处理 │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│       │            │            │             │              │
│       ▼            ▼            ▼             ▼              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ 图表推荐 │─▶│ 代码生成 │─▶│ 验证修复 │─▶│ 渲染输出 │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           错误处理 & 降级策略 & 缓存层                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
渲染后的可视化图表 + 数据摘要
```

### 1.3 各模块职责与接口

每个模块都有明确的输入、输出和错误边界：

```
┌──────────────────────────────────────────────────────────────┐
│ 模块           │ 输入                  │ 输出                  │
├──────────────────────────────────────────────────────────────┤
│ 意图解析       │ 用户自然语言          │ 结构化意图对象         │
│ NL2SQL        │ 意图对象 + Schema     │ SQL 字符串             │
│ 查询执行       │ SQL + 数据源配置      │ 原始查询结果           │
│ 数据处理       │ 原始结果 + 处理规则   │ 清洗后的数据集         │
│ 图表推荐       │ 数据集 + 用户偏好     │ 图表类型 + 配置建议    │
│ 代码生成       │ 数据集 + 图表建议     │ ECharts/D3 配置代码    │
│ 验证修复       │ 生成的代码            │ 验证通过的代码         │
│ 渲染输出       │ 验证后的代码 + 数据   │ 可渲染的图表描述       │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、数据流与中间表示设计

### 2.1 为什么要标准化中间表示？

Pipeline 中最脆弱的地方是模块间的衔接。NL2SQL 输出的 SQL 格式稍有变化，下游的查询执行模块就可能出错。图表推荐返回的配置结构变了，代码生成模块的 Prompt 就对不上。

解决方案是定义一套**Pipeline 中间表示（Intermediate Representation）**——每个模块的输出都转换为标准格式，下游模块只消费标准格式。

### 2.2 核心数据结构

```python
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum
from datetime import datetime


class IntentType(Enum):
    QUERY = "query"
    COMPARE = "compare"
    TREND = "trend"
    DISTRIBUTION = "distribution"
    ANOMALY = "anomaly"


class ChartType(Enum):
    BAR = "bar"
    LINE = "line"
    PIE = "pie"
    SCATTER = "scatter"
    TABLE = "table"
    HEATMAP = "heatmap"
    MIXED = "mixed"


@dataclass
class UserIntent:
    raw_query: str
    intent_type: IntentType
    dimensions: list[str]
    metrics: list[str]
    time_range: Optional[tuple[str, str]] = None
    filters: dict[str, str] = field(default_factory=dict)
    limit: Optional[int] = None


@dataclass
class SQLResult:
    sql: str
    columns: list[str]
    rows: list[list]
    row_count: int
    execution_time_ms: int
    from_cache: bool = False


@dataclass
class ProcessedData:
    columns: list[dict]
    rows: list[list]
    statistics: dict
    data_profile: dict


@dataclass
class ChartRecommendation:
    chart_type: ChartType
    confidence: float
    reason: str
    alternatives: list[ChartType]
    config_hints: dict = field(default_factory=dict)


@dataclass
class GeneratedCode:
    library: str
    code: str
    is_valid: bool
    validation_errors: list[str] = field(default_factory=list)


@dataclass
class PipelineResult:
    success: bool
    intent: Optional[UserIntent] = None
    sql: Optional[str] = None
    data: Optional[ProcessedData] = None
    chart: Optional[GeneratedCode] = None
    recommendation: Optional[ChartRecommendation] = None
    error: Optional[str] = None
    error_stage: Optional[str] = None
    fallback_used: bool = False
    total_time_ms: int = 0
```

这套数据结构是 Pipeline 的"通用语言"。每个模块接收上游的标准格式，输出自己的标准格式。模块内部的实现可以随意替换，只要输出格式不变，Pipeline 就不会断裂。

### 2.3 数据流示意

```
UserIntent ──────▶ SQLResult ──────▶ ProcessedData ──────▶ GeneratedCode
   │                  │                  │                      │
   │  intent_type     │  sql             │  columns/rows        │  library
   │  dimensions      │  columns         │  statistics          │  code
   │  metrics         │  rows            │  data_profile        │  is_valid
   │  time_range      │  execution_time  │                      │  validation_errors
   │                  │                  │                      │
   ▼                  ▼                  ▼                      ▼
 NL2SQL           QueryExec          DataProcess          CodeGen
```

---

## 三、错误处理与降级策略

### 3.1 Pipeline 中的错误分类

Pipeline 中的错误不是一视同仁的。有些错误可以自动修复，有些需要降级处理，有些只能报错退出。分类处理是关键。

```
┌─────────────────────────────────────────────────────────────┐
│ 错误等级     │ 处理策略          │ 示例                       │
├─────────────────────────────────────────────────────────────┤
│ 可自愈       │ 自动重试/修复     │ SQL 语法小错→LLM 自修正    │
│ 可降级       │ 切换备选方案      │ 折线图生成失败→降级为表格   │
│ 需用户介入   │ 返回友好提示      │ 查询无结果→建议调整时间范围 │
│ 系统错误     │ 报错+日志+兜底    │ 数据库连接失败→显示错误页   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 自动修复机制

NL2SQL 生成的 SQL 第一次执行失败是常见情况。研究表明，LLM 生成的 SQL 在 Spider 基准上的首次通过率约 70-85%，但经过一轮错误反馈修正后可以提升到 90% 以上。

自动修复的核心思路是：把数据库报错信息反馈给 LLM，让它修正 SQL。

```python
import asyncio
from typing import Optional


class SQLAutoFixer:
    MAX_RETRIES = 2

    def __init__(self, llm_client, db_executor):
        self.llm = llm_client
        self.db = db_executor

    async def execute_with_fix(
        self, sql: str, schema_context: str, user_query: str
    ) -> SQLResult:
        current_sql = sql
        last_error = ""

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                result = await self.db.execute(current_sql)
                return result
            except Exception as e:
                last_error = str(e)
                if attempt < self.MAX_RETRIES:
                    current_sql = await self._fix_sql(
                        current_sql, last_error, schema_context, user_query
                    )
                else:
                    raise PipelineError(
                        stage="query_execution",
                        message=f"SQL 执行失败，已重试 {self.MAX_RETRIES} 次",
                        detail=last_error,
                        recoverable=False,
                    )

    async def _fix_sql(
        self, sql: str, error: str, schema: str, user_query: str
    ) -> str:
        prompt = f"""你是一个 SQL 修复专家。以下 SQL 执行时出错，请修复。

用户原始问题: {user_query}

数据库 Schema:
{schema}

错误的 SQL:
{sql}

数据库报错信息:
{error}

请返回修复后的 SQL，只返回 SQL 语句，不要解释。"""

        response = await self.llm.chat(prompt)
        return self._extract_sql(response)
```

这个修复器做的事情很直接：执行 SQL → 如果失败就把错误信息和原始 SQL 一起发给 LLM → LLM 修正后重试。最多重试 2 次，超过就放弃并报错。

### 3.3 优雅降级

当某个模块完全失败时，Pipeline 不应该整体崩溃，而是降级到一个"次优但可用"的状态。

```python
class DegradationStrategy:
    CHART_FALLBACK_CHAIN = [
        ChartType.LINE,
        ChartType.BAR,
        ChartType.TABLE,
    ]

    @staticmethod
    def degrade_chart(recommendation: ChartRecommendation) -> ChartRecommendation:
        current = recommendation.chart_type
        fallback_chain = DegradationStrategy.CHART_FALLBACK_CHAIN

        if current not in fallback_chain:
            return ChartRecommendation(
                chart_type=ChartType.TABLE,
                confidence=0.5,
                reason="降级为表格展示",
                alternatives=[],
            )

        idx = fallback_chain.index(current)
        if idx < len(fallback_chain) - 1:
            next_type = fallback_chain[idx + 1]
            return ChartRecommendation(
                chart_type=next_type,
                confidence=0.5,
                reason=f"原推荐 {current.value} 生成失败，降级为 {next_type.value}",
                alternatives=[],
            )

        return ChartRecommendation(
            chart_type=ChartType.TABLE,
            confidence=0.3,
            reason="所有图表类型均失败，降级为表格",
            alternatives=[],
        )
```

降级链的设计原则是：**渐进式退化，始终有兜底**。折线图不行就试柱状图，柱状图不行就用表格。表格是最安全的兜底——任何数据都能用表格展示，虽然不够直观，但至少信息完整。

---

## 四、缓存与性能优化

### 4.1 哪些东西值得缓存？

Pipeline 中有多个环节的输出可以缓存，但缓存的粒度和过期策略各不相同：

```
┌─────────────────────────────────────────────────────────────┐
│ 缓存对象          │ 缓存键                    │ 过期策略     │
├─────────────────────────────────────────────────────────────┤
│ SQL 查询结果      │ SQL 语句的 hash           │ 5-30 分钟    │
│ Schema Linking    │ 用户查询 + 数据库 ID      │ Schema 变更时│
│ 图表推荐          │ 数据特征 hash             │ 不过期       │
│ ECharts 配置      │ 数据集 hash + 图表类型    │ 不过期       │
└─────────────────────────────────────────────────────────────┘
```

SQL 查询结果的缓存最有价值——同一个查询在短时间内反复执行是常见场景（用户刷新页面、多人查看同一报表）。但过期时间不能太长，否则数据会过时。

### 4.2 基于 Redis 的缓存实现

```python
import hashlib
import json
from typing import Optional
import redis.asyncio as redis


class PipelineCache:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url)
        self.default_ttl = 300

    def _make_key(self, prefix: str, content: str) -> str:
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
        return f"pipeline:{prefix}:{content_hash}"

    async def get_sql_result(self, sql: str) -> Optional[dict]:
        key = self._make_key("sql_result", sql.strip().lower())
        cached = await self.redis.get(key)
        if cached:
            data = json.loads(cached)
            data["from_cache"] = True
            return data
        return None

    async def set_sql_result(self, sql: str, result: dict, ttl: int = 300):
        key = self._make_key("sql_result", sql.strip().lower())
        await self.redis.setex(key, ttl, json.dumps(result))

    async def get_chart_config(self, data_hash: str, chart_type: str) -> Optional[str]:
        key = self._make_key("chart_config", f"{data_hash}:{chart_type}")
        cached = await self.redis.get(key)
        return cached.decode() if cached else None

    async def set_chart_config(
        self, data_hash: str, chart_type: str, config: str
    ):
        key = self._make_key("chart_config", f"{data_hash}:{chart_type}")
        await self.redis.setex(key, 86400, config)
```

### 4.3 并行执行优化

Pipeline 中有些步骤可以并行。当 SQL 查询结果返回后，数据特征分析和数据清洗可以同时进行，不需要串行等待。

```python
async def process_query_result(data: SQLResult, user_intent: UserIntent):
    profile_task = asyncio.create_task(analyze_data_profile(data))
    clean_task = asyncio.create_task(clean_data(data))
    schema_link_task = asyncio.create_task(
        resolve_schema_links(user_intent, data.columns)
    )

    profile, cleaned_data, schema_links = await asyncio.gather(
        profile_task, clean_task, schema_link_task
    )

    return ProcessedData(
        columns=cleaned_data.columns,
        rows=cleaned_data.rows,
        statistics=profile,
        data_profile=schema_links,
    )
```

`asyncio.gather` 让三个任务并发执行，总耗时等于最慢的那个，而不是三者之和。在数据量较大时，这种并行可以节省 30-50% 的处理时间。

---

## 五、Pipeline 编排：状态机 vs DAG

### 5.1 两种编排范式

Pipeline 的执行流程需要一个"编排器"来管理。主流有两种范式：

**状态机**——Pipeline 有明确的状态转移路径，每个状态处理完后转移到下一个状态。适合线性流程，实现简单，但分支和并行不好处理。

**DAG（有向无环图）**——把每个步骤定义为一个节点，节点之间用有向边表示依赖关系。适合复杂流程，天然支持并行和条件分支，但实现复杂度更高。

```
状态机方式（线性）：
  INIT → PARSE → NL2SQL → EXECUTE → PROCESS → RECOMMEND → GENERATE → RENDER → DONE

DAG 方式（支持并行）：
  INIT → PARSE → NL2SQL → EXECUTE → ┬─ PROCESS ──┐
                                      ├─ PROFILE ──┤
                                      └─ VALIDATE ─┤
                                                    ▼
                                              RECOMMEND → GENERATE → RENDER → DONE
```

对于数据到图表的 Pipeline，我们推荐**状态机为主，关键节点内部用并行**的混合方案。原因是 Pipeline 的主流程天然是线性的（NL2SQL 必须在查询执行之前），但某些步骤内部可以并行。

### 5.2 状态机实现

```python
from enum import Enum
from dataclasses import dataclass, field
from typing import Callable, Optional
import time


class Stage(Enum):
    INIT = "init"
    PARSE_INTENT = "parse_intent"
    NL2SQL = "nl2sql"
    EXECUTE_QUERY = "execute_query"
    PROCESS_DATA = "process_data"
    RECOMMEND_CHART = "recommend_chart"
    GENERATE_CODE = "generate_code"
    VALIDATE_CODE = "validate_code"
    RENDER = "render"
    DONE = "done"
    FAILED = "failed"


@dataclass
class PipelineState:
    stage: Stage = Stage.INIT
    intent: Optional[UserIntent] = None
    sql: Optional[str] = None
    query_result: Optional[SQLResult] = None
    processed_data: Optional[ProcessedData] = None
    recommendation: Optional[ChartRecommendation] = None
    generated_code: Optional[GeneratedCode] = None
    error: Optional[str] = None
    error_stage: Optional[Stage] = None
    fallback_used: bool = False
    start_time: float = field(default_factory=time.time)
    stage_times: dict = field(default_factory=dict)

    def record_stage_time(self, stage: Stage):
        self.stage_times[stage.value] = round(
            (time.time() - self.start_time) * 1000
        )


class PipelineOrchestrator:
    def __init__(self, modules: dict, cache: PipelineCache):
        self.modules = modules
        self.cache = cache
        self.handlers: dict[Stage, Callable] = {
            Stage.INIT: self._handle_init,
            Stage.PARSE_INTENT: self._handle_parse_intent,
            Stage.NL2SQL: self._handle_nl2sql,
            Stage.EXECUTE_QUERY: self._handle_execute_query,
            Stage.PROCESS_DATA: self._handle_process_data,
            Stage.RECOMMEND_CHART: self._handle_recommend_chart,
            Stage.GENERATE_CODE: self._handle_generate_code,
            Stage.VALIDATE_CODE: self._handle_validate_code,
            Stage.RENDER: self._handle_render,
        }

    async def run(self, user_query: str, data_source_id: str) -> PipelineResult:
        state = PipelineState()
        state.intent = UserIntent(
            raw_query=user_query,
            intent_type=IntentType.QUERY,
            dimensions=[],
            metrics=[],
        )

        transition_map = {
            Stage.INIT: Stage.PARSE_INTENT,
            Stage.PARSE_INTENT: Stage.NL2SQL,
            Stage.NL2SQL: Stage.EXECUTE_QUERY,
            Stage.EXECUTE_QUERY: Stage.PROCESS_DATA,
            Stage.PROCESS_DATA: Stage.RECOMMEND_CHART,
            Stage.RECOMMEND_CHART: Stage.GENERATE_CODE,
            Stage.GENERATE_CODE: Stage.VALIDATE_CODE,
            Stage.VALIDATE_CODE: Stage.RENDER,
            Stage.RENDER: Stage.DONE,
        }

        while state.stage not in (Stage.DONE, Stage.FAILED):
            handler = self.handlers.get(state.stage)
            if not handler:
                state.stage = Stage.FAILED
                state.error = f"未知阶段: {state.stage}"
                break

            try:
                await handler(state, data_source_id)
                state.record_stage_time(state.stage)
                state.stage = transition_map.get(state.stage, Stage.FAILED)
            except PipelineError as e:
                if e.recoverable:
                    state = self._apply_fallback(state, e)
                else:
                    state.stage = Stage.FAILED
                    state.error = e.message
                    state.error_stage = state.stage

        total_ms = round((time.time() - state.start_time) * 1000)

        return PipelineResult(
            success=state.stage == Stage.DONE,
            intent=state.intent,
            sql=state.sql,
            data=state.processed_data,
            chart=state.generated_code,
            recommendation=state.recommendation,
            error=state.error,
            error_stage=state.error_stage.value if state.error_stage else None,
            fallback_used=state.fallback_used,
            total_time_ms=total_ms,
        )

    def _apply_fallback(self, state: PipelineState, error: PipelineError) -> PipelineState:
        state.fallback_used = True
        if state.stage == Stage.GENERATE_CODE and state.recommendation:
            state.recommendation = DegradationStrategy.degrade_chart(
                state.recommendation
            )
            state.stage = Stage.GENERATE_CODE
        elif state.stage == Stage.EXECUTE_QUERY:
            state.stage = Stage.FAILED
            state.error = "查询执行失败且无法降级"
        return state
```

---

## 六、完整示例：端到端 Pipeline

下面把所有模块组装起来，实现一个可以实际运行的 Pipeline。为了保持代码可运行，我们用 Mock 模块替代真实的 LLM 和数据库调用——你在实际项目中替换为真实实现即可。

```python
import asyncio
import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


# ── 数据结构定义（同上文，此处精简） ──

class IntentType(Enum):
    QUERY = "query"
    TREND = "trend"
    COMPARE = "compare"

class ChartType(Enum):
    BAR = "bar"
    LINE = "line"
    PIE = "pie"
    TABLE = "table"


@dataclass
class UserIntent:
    raw_query: str
    intent_type: IntentType
    dimensions: list[str]
    metrics: list[str]
    time_range: Optional[tuple[str, str]] = None

@dataclass
class SQLResult:
    sql: str
    columns: list[str]
    rows: list[list]
    row_count: int
    execution_time_ms: int

@dataclass
class ProcessedData:
    columns: list[str]
    rows: list[list]
    statistics: dict

@dataclass
class ChartRecommendation:
    chart_type: ChartType
    confidence: float
    reason: str

@dataclass
class GeneratedCode:
    library: str
    code: str
    is_valid: bool

@dataclass
class PipelineResult:
    success: bool
    sql: Optional[str] = None
    data: Optional[ProcessedData] = None
    chart: Optional[GeneratedCode] = None
    recommendation: Optional[ChartRecommendation] = None
    error: Optional[str] = None
    total_time_ms: int = 0


# ── Mock 模块 ──

class MockIntentParser:
    async def parse(self, query: str) -> UserIntent:
        if "趋势" in query or "变化" in query:
            intent_type = IntentType.TREND
        elif "对比" in query or "比较" in query:
            intent_type = IntentType.COMPARE
        else:
            intent_type = IntentType.QUERY

        return UserIntent(
            raw_query=query,
            intent_type=intent_type,
            dimensions=["region"],
            metrics=["sales_amount"],
            time_range=("2025-05-01", "2025-05-31"),
        )


class MockNL2SQL:
    async def generate(self, intent: UserIntent, schema: str) -> str:
        if intent.intent_type == IntentType.TREND:
            return """
            SELECT DATE_TRUNC('day', order_date) AS date,
                   region,
                   SUM(amount) AS sales_amount
            FROM orders
            WHERE order_date BETWEEN '2025-05-01' AND '2025-05-31'
            GROUP BY date, region
            ORDER BY date
            """
        return """
        SELECT region, SUM(amount) AS sales_amount
        FROM orders
        WHERE order_date BETWEEN '2025-05-01' AND '2025-05-31'
        GROUP BY region
        ORDER BY sales_amount DESC
        """


class MockDatabase:
    async def execute(self, sql: str) -> SQLResult:
        start = time.time()
        if "DATE_TRUNC" in sql.upper():
            columns = ["date", "region", "sales_amount"]
            rows = [
                ["2025-05-01", "华东", 125000],
                ["2025-05-01", "华南", 98000],
                ["2025-05-02", "华东", 132000],
                ["2025-05-02", "华南", 105000],
                ["2025-05-03", "华东", 118000],
                ["2025-05-03", "华南", 112000],
            ]
        else:
            columns = ["region", "sales_amount"]
            rows = [
                ["华东", 2850000],
                ["华南", 2150000],
                ["华北", 1980000],
                ["西南", 1200000],
            ]
        elapsed = int((time.time() - start) * 1000)
        return SQLResult(
            sql=sql.strip(), columns=columns, rows=rows,
            row_count=len(rows), execution_time_ms=max(elapsed, 15),
        )


class MockChartRecommender:
    async def recommend(
        self, data: ProcessedData, intent: UserIntent
    ) -> ChartRecommendation:
        if intent.intent_type == IntentType.TREND:
            return ChartRecommendation(
                chart_type=ChartType.LINE, confidence=0.92,
                reason="时间序列数据适合折线图展示趋势",
            )
        if len(data.rows) <= 6:
            return ChartRecommendation(
                chart_type=ChartType.BAR, confidence=0.88,
                reason="分类数据且类别较少，适合柱状图对比",
            )
        return ChartRecommendation(
            chart_type=ChartType.TABLE, confidence=0.6,
            reason="数据行数较多，降级为表格展示",
        )


class MockCodeGenerator:
    async def generate(
        self, data: ProcessedData, recommendation: ChartRecommendation
    ) -> GeneratedCode:
        if recommendation.chart_type == ChartType.LINE:
            code = json.dumps({
                "xAxis": {"type": "category", "data": list({r[0] for r in data.rows})},
                "yAxis": {"type": "value"},
                "series": self._build_line_series(data),
            }, ensure_ascii=False, indent=2)
        elif recommendation.chart_type == ChartType.BAR:
            code = json.dumps({
                "xAxis": {"type": "category", "data": [r[0] for r in data.rows]},
                "yAxis": {"type": "value"},
                "series": [{"type": "bar", "data": [r[1] for r in data.rows]}],
            }, ensure_ascii=False, indent=2)
        else:
            code = json.dumps({
                "columns": [{"title": c, "dataIndex": c} for c in data.columns],
                "dataSource": data.rows,
            }, ensure_ascii=False, indent=2)

        return GeneratedCode(library="echarts", code=code, is_valid=True)

    def _build_line_series(self, data: ProcessedData) -> list[dict]:
        region_data: dict[str, list] = {}
        for row in data.rows:
            date, region, amount = row
            region_data.setdefault(region, []).append({"date": date, "amount": amount})
        series = []
        for region, points in region_data.items():
            series.append({
                "name": region,
                "type": "line",
                "data": [p["amount"] for p in points],
            })
        return series


# ── Pipeline 编排器 ──

class ChartPipeline:
    def __init__(
        self,
        intent_parser: MockIntentParser,
        nl2sql: MockNL2SQL,
        database: MockDatabase,
        recommender: MockChartRecommender,
        code_gen: MockCodeGenerator,
    ):
        self.intent_parser = intent_parser
        self.nl2sql = nl2sql
        self.database = database
        self.recommender = recommender
        self.code_gen = code_gen

    async def run(self, user_query: str) -> PipelineResult:
        start = time.time()
        schema = "orders(id, order_date, region, amount, product_id)"

        try:
            intent = await self.intent_parser.parse(user_query)

            sql = await self.nl2sql.generate(intent, schema)

            query_result = await self.database.execute(sql)

            processed = ProcessedData(
                columns=query_result.columns,
                rows=query_result.rows,
                statistics={"row_count": query_result.row_count},
            )

            recommendation = await self.recommender.recommend(processed, intent)

            chart = await self.code_gen.generate(processed, recommendation)

            total_ms = int((time.time() - start) * 1000)
            return PipelineResult(
                success=True,
                sql=sql.strip(),
                data=processed,
                chart=chart,
                recommendation=recommendation,
                total_time_ms=total_ms,
            )

        except Exception as e:
            total_ms = int((time.time() - start) * 1000)
            return PipelineResult(
                success=False, error=str(e), total_time_ms=total_ms,
            )


# ── 运行演示 ──

async def main():
    pipeline = ChartPipeline(
        intent_parser=MockIntentParser(),
        nl2sql=MockNL2SQL(),
        database=MockDatabase(),
        recommender=MockChartRecommender(),
        code_gen=MockCodeGenerator(),
    )

    queries = [
        "帮我看看上个月各区域的销售额趋势",
        "各区域销售额对比",
    ]

    for query in queries:
        print(f"\n{'='*60}")
        print(f"用户查询: {query}")
        print(f"{'='*60}")

        result = await pipeline.run(query)

        if result.success:
            print(f"生成的 SQL:\n{result.sql}")
            print(f"\n推荐图表: {result.recommendation.chart_type.value}")
            print(f"推荐理由: {result.recommendation.reason}")
            print(f"\n图表配置:\n{result.chart.code}")
            print(f"\n耗时: {result.total_time_ms}ms")
        else:
            print(f"Pipeline 失败: {result.error}")


if __name__ == "__main__":
    asyncio.run(main())
```

运行这段代码会输出两个查询的完整处理结果，包括生成的 SQL、推荐的图表类型、以及 ECharts 配置代码。

---

## 七、生产环境的关键考量

### 7.1 可观测性

Pipeline 在生产环境中必须有完善的日志和监控。每个阶段的输入、输出、耗时、错误都应该被记录。

```python
import logging
from contextlib import asynccontextmanager

logger = logging.getLogger("pipeline")


@asynccontextmanager
async def stage_span(stage_name: str, state: PipelineState):
    start = time.time()
    logger.info(f"[Pipeline] 进入阶段: {stage_name}")
    try:
        yield
        elapsed = int((time.time() - start) * 1000)
        logger.info(f"[Pipeline] 完成阶段: {stage_name} ({elapsed}ms)")
    except Exception as e:
        elapsed = int((time.time() - start) * 1000)
        logger.error(f"[Pipeline] 阶段失败: {stage_name} ({elapsed}ms) - {e}")
        raise
```

### 7.2 超时控制

每个阶段都应该有独立的超时限制。NL2SQL 调用 LLM 可能耗时较长，但不能无限等待。

```python
async def run_with_timeout(coro, timeout_seconds: int, stage_name: str):
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        raise PipelineError(
            stage=stage_name,
            message=f"阶段 {stage_name} 超时 ({timeout_seconds}s)",
            recoverable=True,
        )


# 使用示例
sql = await run_with_timeout(
    self.nl2sql.generate(intent, schema),
    timeout_seconds=10,
    stage_name="nl2sql",
)
```

### 7.3 幂等性与重试安全

Pipeline 的某些步骤是天然幂等的（相同 SQL 查询相同结果），某些不是（代码生成可能每次不同）。在设计重试策略时，只有幂等步骤才能安全重试。

---

## 常见误区

**误区一：把所有错误都当致命错误处理。** SQL 执行失败可能是暂时的网络问题，重试一次就好了。图表推荐失败可以降级为表格。只有数据库完全不可用才是真正的致命错误。

**误区二：缓存一切。** SQL 查询结果值得缓存，但意图解析的结果不值得——同一个自然语言表述可能在不同上下文中含义不同。缓存要分层、分粒度。

**误区三：忽略中间状态的序列化。** Pipeline 可能需要暂停等待人工确认（比如高风险查询），或者在服务重启后恢复。中间状态必须可序列化。

**误区四：用同步调用阻塞整个 Pipeline。** LLM 调用和数据库查询都是 I/O 密集操作，必须用异步。一个同步调用就会让 Pipeline 的吞吐量断崖式下降。

---

## 小结

本节课的核心要点：

1. **Pipeline 的价值**是把不可靠的模块组装成可靠的系统，而不是简单地顺序调用
2. **标准化中间表示**是模块解耦的关键——每个模块只关心输入格式和输出格式
3. **错误分级处理**：可自愈的自动修复，可降级的切换方案，不可恢复的友好报错
4. **缓存要分层**：SQL 结果缓存价值最高，意图解析缓存价值最低
5. **编排选型**：状态机适合线性流程，DAG 适合复杂并行，混合方案最实用
6. **可观测性**是生产环境的生命线——每一步的输入、输出、耗时、错误都要可追踪

---

## 练习

### 练习一：扩展 Pipeline 支持多轮对话

当前 Pipeline 只处理单轮查询。请设计一个方案，让 Pipeline 支持多轮对话中的上下文继承。例如：

- 第一轮："各区域销售额"
- 第二轮："换成折线图"（引用上一轮的数据和 SQL）
- 第三步："只看华东和华南"（在上一轮 SQL 基础上加过滤条件）

### 练习二：实现 Pipeline 的 DAG 编排版本

将本节课的状态机 Pipeline 改写为 DAG 编排版本。要求：
- 支持数据处理和图表推荐并行执行
- 支持条件分支（根据数据行数决定是否走聚合路径）
- 每个节点有独立的超时和重试配置

---

## 参考答案

### 练习一

**思路**：在 Pipeline 中增加一个 `ConversationContext` 对象，保存前几轮的意图、SQL、数据和图表配置。每轮对话开始时，先判断是否为"修改请求"（引用上一轮结果），如果是则继承上下文并只更新变更部分。

**答案**：

```python
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ConversationTurn:
    turn_id: int
    user_query: str
    intent: Optional[UserIntent] = None
    sql: Optional[str] = None
    data: Optional[ProcessedData] = None
    chart_type: Optional[ChartType] = None
    chart_code: Optional[str] = None


@dataclass
class ConversationContext:
    turns: list[ConversationTurn] = field(default_factory=list)
    current_schema: str = ""

    def get_last_turn(self) -> Optional[ConversationTurn]:
        return self.turns[-1] if self.turns else None

    def is_modification_request(self, query: str) -> bool:
        modification_keywords = ["换成", "改成", "只看", "加上", "去掉", "不要"]
        return any(kw in query for kw in modification_keywords)


class ContextAwarePipeline(ChartPipeline):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.contexts: dict[str, ConversationContext] = {}

    async def run_conversation(
        self, session_id: str, user_query: str
    ) -> PipelineResult:
        ctx = self.contexts.setdefault(session_id, ConversationContext())
        last_turn = ctx.get_last_turn()

        if ctx.is_modification_request(user_query) and last_turn:
            merged_query = self._merge_context(user_query, last_turn)
            result = await self.run(merged_query)
        else:
            result = await self.run(user_query)

        turn = ConversationTurn(
            turn_id=len(ctx.turns) + 1,
            user_query=user_query,
            sql=result.sql,
            data=result.data,
            chart_type=result.recommendation.chart_type if result.recommendation else None,
            chart_code=result.chart.code if result.chart else None,
        )
        ctx.turns.append(turn)
        return result

    def _merge_context(self, query: str, last: ConversationTurn) -> str:
        if "换成折线图" in query and last.chart_type:
            return f"{last.user_query}，用折线图展示"
        if "只看" in query:
            region = query.replace("只看", "").strip()
            return f"{last.user_query}，只看{region}"
        return query
```

**要点**：
- `ConversationContext` 维护对话历史
- `is_modification_request` 通过关键词判断是否为修改请求
- `_merge_context` 把当前修改和上一轮上下文合并为新的查询
- 实际生产中需要用 LLM 做更智能的上下文理解，关键词匹配只是起点

### 练习二

**思路**：用一个 DAG 图结构定义节点和依赖关系，用拓扑排序确定执行顺序，同一层级的节点并行执行。

**答案**：

```python
import asyncio
from dataclasses import dataclass
from typing import Callable, Any


@dataclass
class DAGNode:
    name: str
    handler: Callable
    dependencies: list[str]
    timeout: int = 30
    retries: int = 0


class DAGExecutor:
    def __init__(self):
        self.nodes: dict[str, DAGNode] = {}
        self.results: dict[str, Any] = {}

    def add_node(self, node: DAGNode):
        self.nodes[node.name] = node

    async def execute(self, initial_data: dict) -> dict:
        self.results = dict(initial_data)
        executed = set()

        while len(executed) < len(self.nodes):
            ready = [
                name for name, node in self.nodes.items()
                if name not in executed
                and all(dep in executed for dep in node.dependencies)
            ]

            if not ready:
                remaining = set(self.nodes.keys()) - executed
                raise RuntimeError(f"死锁或循环依赖: {remaining}")

            tasks = []
            for name in ready:
                node = self.nodes[name]
                dep_results = {
                    dep: self.results[dep] for dep in node.dependencies
                }
                tasks.append(self._run_node(node, dep_results))

            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for name, result in zip(ready, batch_results):
                if isinstance(result, Exception):
                    raise RuntimeError(f"节点 {name} 执行失败: {result}")
                self.results[name] = result
                executed.add(name)

        return self.results

    async def _run_node(self, node: DAGNode, deps: dict) -> Any:
        for attempt in range(node.retries + 1):
            try:
                return await asyncio.wait_for(
                    node.handler(deps), timeout=node.timeout
                )
            except asyncio.TimeoutError:
                if attempt == node.retries:
                    raise
            except Exception:
                if attempt == node.retries:
                    raise
```

**要点**：
- `DAGNode` 用 `dependencies` 声明前置依赖
- `execute` 用拓扑排序找出可并行执行的节点批次
- 每个节点有独立的 `timeout` 和 `retries` 配置
- 死锁检测：如果一轮迭代没有新的可执行节点，说明存在循环依赖
