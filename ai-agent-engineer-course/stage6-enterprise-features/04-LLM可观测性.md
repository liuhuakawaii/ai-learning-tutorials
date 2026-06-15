# 04 LLM 可观测性

> 看不见就管不了——LLM 可观测性是 AI 应用运维的基础。

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

## 本节要点

- LLM 可观测性 = Trace + Metrics + Logging
- Trace 记录每次调用的完整链路
- 成本统计是 AI 应用运营的核心指标
- 用户反馈是评估 AI 质量的最直接信号

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| Trace 数据太大 | 记录了完整消息 | 只记录摘要和元数据 |
| 成本不准 | 没更新定价表 | 定期同步模型定价 |
| 延迟统计不准 | 没算网络时间 | 用端到端计时 |
