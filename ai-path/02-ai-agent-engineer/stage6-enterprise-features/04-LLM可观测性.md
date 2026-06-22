# 04 LLM 可观测性

> 看不见就管不了——LLM 可观测性是 AI 应用运维的基础。

## 场景引入

上线一周后，你发现 LLM API 的账单突然翻了三倍，但完全不知道是哪个用户、哪个 Agent 在疯狂调用。排查了半天才发现是一个 Prompt 写得不好，导致模型反复重试。没有可观测性，你甚至不知道钱花在了哪里、延迟为什么飙高、哪些回答被用户打了差评。

## 学习目标

- 集成 LangSmith / Langfuse 实现 LLM 调用追踪
- 设计 Trace 数据模型
- 实现成本统计和异常监控

## Trace 数据模型

```python
class LLMTrace(Base):
    __tablename__ = "llm_traces"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    
    # 调用信息
    model: Mapped[str] = mapped_column(String(100))
    provider: Mapped[str] = mapped_column(String(50))
    messages: Mapped[list] = mapped_column(JSON)
    response: Mapped[str] = mapped_column(Text)
    
    # 用量
    input_tokens: Mapped[int] = mapped_column(Integer)
    output_tokens: Mapped[int] = mapped_column(Integer)
    cost: Mapped[float] = mapped_column(Float)
    latency_ms: Mapped[int] = mapped_column(Integer)
    
    # 质量
    user_feedback: Mapped[str | None] = mapped_column(String(20), nullable=True)  # thumbs_up/thumbs_down
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

## Langfuse 集成

```python
from langfuse import Langfuse

class ObservabilityService:
    def __init__(self):
        self.langfuse = Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_HOST,
        )
    
    async def trace_llm_call(
        self,
        session_id: str,
        user_id: str,
        messages: list[dict],
        response: dict,
        metadata: dict,
    ):
        """记录 LLM 调用"""
        trace = self.langfuse.trace(
            session_id=session_id,
            user_id=user_id,
            metadata=metadata,
        )
        
        generation = trace.generation(
            name="llm_call",
            model=response["model"],
            input=messages,
            output=response["content"],
            usage={
                "input": response["input_tokens"],
                "output": response["output_tokens"],
                "totalCost": response["cost"],
            },
            metadata={"latency_ms": response["latency_ms"]},
        )
        
        return trace
```

## 成本统计看板

```python
@router.get("/stats/cost")
async def get_cost_stats(
    start_date: str,
    end_date: str,
    group_by: str = "day",  # day / model / user
):
    """获取成本统计"""
    if group_by == "day":
        result = await db.execute(text("""
            SELECT date(created_at) as date,
                   SUM(cost) as total_cost,
                   SUM(input_tokens) as total_input_tokens,
                   SUM(output_tokens) as total_output_tokens,
                   COUNT(*) as call_count
            FROM llm_traces
            WHERE created_at BETWEEN :start AND :end
            GROUP BY date(created_at)
            ORDER BY date
        """), {"start": start_date, "end": end_date})
    
    elif group_by == "model":
        result = await db.execute(text("""
            SELECT model,
                   SUM(cost) as total_cost,
                   COUNT(*) as call_count,
                   AVG(latency_ms) as avg_latency
            FROM llm_traces
            WHERE created_at BETWEEN :start AND :end
            GROUP BY model
            ORDER BY total_cost DESC
        """), {"start": start_date, "end": end_date})
    
    return [dict(row) for row in result]
```

## 练习

### 练习 1：Trace 记录

实现 LLM 调用追踪：

1. 记录每次调用的输入输出
2. 记录 token 用量和成本
3. 记录延迟和错误

### 练习 2：成本看板

实现成本统计看板：

1. 按天/模型/用户统计成本
2. 成本趋势图表
3. 超预算告警

---

## 参考答案

### 练习 1

**思路**：LLM 调用追踪的核心是在每次 LLM 调用前后记录完整的输入输出、token 用量、延迟和成本。用装饰器或中间件自动包装 LLM 调用，避免在业务代码中手动插入追踪逻辑。关键是要精确计时（端到端，包含网络），成本计算依赖模型定价表。

**答案**：

```python
import uuid
import time
import json
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Any

# 模型定价表（每 1M tokens，单位：美元）
MODEL_PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "claude-3.5-sonnet": {"input": 3.00, "output": 15.00},
    "claude-3-haiku": {"input": 0.25, "output": 1.25},
}

@dataclass
class LLMTraceRecord:
    id: str
    session_id: str
    user_id: str
    model: str
    provider: str
    messages: list[dict]
    response: str
    input_tokens: int
    output_tokens: int
    cost: float
    latency_ms: int
    error: str | None = None
    created_at: str = ""

class ObservabilityService:
    """LLM 可观测性服务"""

    def __init__(self, db, langfuse_client=None):
        self.db = db
        self.langfuse = langfuse_client

    def calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """根据模型定价表计算成本"""
        pricing = MODEL_PRICING.get(model)
        if not pricing:
            return 0.0
        return (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000

    async def trace_llm_call(
        self,
        session_id: str,
        user_id: str,
        model: str,
        messages: list[dict],
        response_content: str,
        input_tokens: int,
        output_tokens: int,
        latency_ms: int,
        error: str | None = None,
    ) -> LLMTraceRecord:
        """记录一次 LLM 调用"""
        cost = self.calculate_cost(model, input_tokens, output_tokens)

        trace = LLMTraceRecord(
            id=str(uuid.uuid4()),
            session_id=session_id,
            user_id=user_id,
            model=model,
            provider=self._get_provider(model),
            messages=self._truncate_messages(messages, max_chars=2000),
            response=response_content[:5000],  # 截断长响应
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost=cost,
            latency_ms=latency_ms,
            error=error,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

        # 写入数据库
        await self.db.insert("llm_traces", {
            "id": trace.id,
            "session_id": trace.session_id,
            "user_id": trace.user_id,
            "model": trace.model,
            "provider": trace.provider,
            "messages": trace.messages,
            "response": trace.response,
            "input_tokens": trace.input_tokens,
            "output_tokens": trace.output_tokens,
            "cost": trace.cost,
            "latency_ms": trace.latency_ms,
            "error": trace.error,
        })

        # 同步到 Langfuse（异步）
        if self.langfuse:
            await self._sync_to_langfuse(trace)

        # 检查是否超预算
        await self._check_budget_alert(trace)

        return trace

    def _get_provider(self, model: str) -> str:
        if model.startswith("gpt"):
            return "openai"
        if model.startswith("claude"):
            return "anthropic"
        return "unknown"

    def _truncate_messages(self, messages: list[dict], max_chars: int) -> list[dict]:
        """截断过长的消息，避免存储浪费"""
        truncated = []
        for msg in messages:
            content = msg.get("content", "")
            if len(content) > max_chars:
                content = content[:max_chars] + "...(truncated)"
            truncated.append({**msg, "content": content})
        return truncated

    async def _sync_to_langfuse(self, trace: LLMTraceRecord):
        """同步到 Langfuse"""
        try:
            lf_trace = self.langfuse.trace(
                session_id=trace.session_id,
                user_id=trace.user_id,
            )
            lf_trace.generation(
                name="llm_call",
                model=trace.model,
                input=trace.messages,
                output=trace.response,
                usage={
                    "input": trace.input_tokens,
                    "output": trace.output_tokens,
                    "totalCost": trace.cost,
                },
                metadata={"latency_ms": trace.latency_ms, "trace_id": trace.id},
            )
        except Exception:
            pass  # Langfuse 同步失败不影响主流程

    async def _check_budget_alert(self, trace: LLMTraceRecord):
        """检查预算告警"""
        # 查询该用户今日总成本
        today_cost = await self.db.scalar("""
            SELECT SUM(cost) FROM llm_traces
            WHERE user_id = :uid AND created_at >= CURRENT_DATE
        """, uid=trace.user_id)

        user_budget = await self._get_user_budget(trace.user_id)
        if user_budget and today_cost > user_budget:
            await self._send_budget_alert(trace.user_id, today_cost, user_budget)

    async def _get_user_budget(self, user_id: str) -> float | None:
        user = await self.db.get("users", user_id)
        return user.get("daily_cost_budget")

    async def _send_budget_alert(self, user_id: str, current: float, budget: float):
        print(f"[告警] 用户 {user_id} 今日成本 ${current:.4f} 超出预算 ${budget:.4f}")


# LLM 调用装饰器——自动追踪
def traced_llm_call(observability: ObservabilityService):
    """装饰器：自动追踪 LLM 调用"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            start = time.monotonic()
            error = None
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                error = str(e)
                raise
            finally:
                latency_ms = int((time.monotonic() - start) * 1000)
                await observability.trace_llm_call(
                    session_id=kwargs.get("session_id", "unknown"),
                    user_id=kwargs.get("user_id", "unknown"),
                    model=kwargs.get("model", "unknown"),
                    messages=kwargs.get("messages", []),
                    response_content=result.content if not error and result else "",
                    input_tokens=getattr(result, "input_tokens", 0) if not error else 0,
                    output_tokens=getattr(result, "output_tokens", 0) if not error else 0,
                    latency_ms=latency_ms,
                    error=error,
                )
        return wrapper
    return decorator
```

**要点**：
- 成本计算依赖模型定价表，必须定期同步官方最新价格——价格变动频繁，过时的定价表会导致成本统计不准
- Trace 中的消息要截断存储（2000 字符），完整消息只存摘要和元数据，否则数据库会快速膨胀
- 常见错误：只追踪成功调用不追踪失败调用——失败调用的 Trace 更重要，它是排查问题的关键线索

### 练习 2

**思路**：成本看板的核心是多维度聚合查询（按天/模型/用户）和超预算告警。前端用 ECharts 渲染趋势图，后端用 SQL GROUP BY 实现聚合。告警用阈值检测，超过预算百分比时发送通知。

**答案**：

```python
from fastapi import APIRouter, Query, Depends
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/v1/stats")

@router.get("/cost")
async def get_cost_stats(
    start_date: str = Query(...),
    end_date: str = Query(...),
    group_by: str = Query("day", regex="^(day|model|user)$"),
    user=Depends(require_permission("admin:stats")),
):
    """成本统计——按天/模型/用户聚合"""
    if group_by == "day":
        rows = await db.execute("""
            SELECT DATE(created_at) AS date,
                   model,
                   SUM(cost) AS total_cost,
                   SUM(input_tokens) AS total_input_tokens,
                   SUM(output_tokens) AS total_output_tokens,
                   COUNT(*) AS call_count,
                   AVG(latency_ms) AS avg_latency_ms
            FROM llm_traces
            WHERE created_at BETWEEN :start AND :end
            GROUP BY DATE(created_at), model
            ORDER BY date
        """, start=start_date, end=end_date)

    elif group_by == "model":
        rows = await db.execute("""
            SELECT model,
                   SUM(cost) AS total_cost,
                   COUNT(*) AS call_count,
                   AVG(latency_ms) AS avg_latency_ms,
                   AVG(input_tokens) AS avg_input_tokens,
                   AVG(output_tokens) AS avg_output_tokens,
                   SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) AS error_count
            FROM llm_traces
            WHERE created_at BETWEEN :start AND :end
            GROUP BY model
            ORDER BY total_cost DESC
        """, start=start_date, end=end_date)

    elif group_by == "user":
        rows = await db.execute("""
            SELECT user_id,
                   SUM(cost) AS total_cost,
                   COUNT(*) AS call_count,
                   COUNT(DISTINCT session_id) AS session_count,
                   AVG(latency_ms) AS avg_latency_ms
            FROM llm_traces
            WHERE created_at BETWEEN :start AND :end
            GROUP BY user_id
            ORDER BY total_cost DESC
            LIMIT 50
        """, start=start_date, end=end_date)

    return [dict(row) for row in rows]


@router.get("/cost/trend")
async def get_cost_trend(
    days: int = Query(30, ge=1, le=365),
    user=Depends(require_permission("admin:stats")),
):
    """成本趋势（最近 N 天）"""
    rows = await db.execute("""
        SELECT DATE(created_at) AS date,
               SUM(cost) AS daily_cost,
               COUNT(*) AS daily_calls,
               SUM(input_tokens) AS daily_input_tokens,
               SUM(output_tokens) AS daily_output_tokens
        FROM llm_traces
        WHERE created_at >= CURRENT_DATE - INTERVAL ':days days'
        GROUP BY DATE(created_at)
        ORDER BY date
    """, days=days)
    return [dict(row) for row in rows]


# --- 超预算告警 ---
class BudgetAlertService:
    """预算告警服务"""

    def __init__(self, db, notification_service):
        self.db = db
        self.notifier = notification_service
        self.alert_thresholds = [0.8, 0.9, 1.0]  # 80%, 90%, 100%

    async def check_and_alert(self):
        """检查所有用户的预算使用情况"""
        users = await self.db.query_list("users", daily_cost_budget__isnotnull=True)
        today = datetime.utcnow().date()

        for user in users:
            today_cost = await self.db.scalar("""
                SELECT COALESCE(SUM(cost), 0) FROM llm_traces
                WHERE user_id = :uid AND DATE(created_at) = :today
            """, uid=user["id"], today=today)

            budget = user["daily_cost_budget"]
            if budget <= 0:
                continue

            usage_ratio = today_cost / budget

            for threshold in self.alert_thresholds:
                if usage_ratio >= threshold:
                    alert_key = f"budget_alert:{user['id']}:{today}:{threshold}"
                    already_sent = await self.db.get("alert_log", key=alert_key)
                    if not already_sent:
                        await self._send_alert(user, today_cost, budget, threshold)
                        await self.db.insert("alert_log", {"key": alert_key, "sent_at": datetime.utcnow()})

    async def _send_alert(self, user: dict, current: float, budget: float, threshold: float):
        percent = int(threshold * 100)
        message = f"用户 {user['name']} 今日 LLM 成本已达 ${current:.4f}，占预算 ${budget:.4f} 的 {percent}%"
        await self.notifier.send(
            channel="admin_alerts",
            title=f"LLM 成本告警（{percent}%）",
            message=message,
        )
```

**要点**：
- 成本趋势图要同时展示成本和调用次数——成本上升可能是因为调用次数增加（正常增长），也可能是单次成本变高（模型切换或 Prompt 变长）
- 预算告警要防重复发送——同一天同一阈值只发一次，用 `alert_log` 表记录已发送的告警
- 常见错误：成本统计只查 `SUM(cost)` 不加 `DATE(created_at)` 分组——跨天查询时会把多天数据合并成一条，看不到趋势

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| Trace 数据太大 | 记录了完整消息 | 只记录摘要和元数据 |
| 成本不准 | 没更新定价表 | 定期同步模型定价 |
| 延迟统计不准 | 没算网络时间 | 用端到端计时 |

## 工程建议

Trace 数据存储要注意生命周期管理，超过 30 天的详细 Trace 可以归档到冷存储，只保留聚合统计数据在热库中。模型定价表要定期同步更新，建议每周从官方 API 拉取最新价格，避免成本统计出现偏差。监控告警要设置合理的阈值——单次调用成本超过预期值、错误率突增、延迟 P95 超标时自动通知。用户反馈数据要和 Trace 关联存储，方便后续分析"差评回答"的共同特征。

## 本节要点

- LLM 可观测性 = Trace + Metrics + Logging
- Trace 记录每次调用的完整链路
- 成本统计是 AI 应用运营的核心指标
- 用户反馈是评估 AI 质量的最直接信号
