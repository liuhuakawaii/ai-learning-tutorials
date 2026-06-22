# 05 Context 数据闭环

> AI 的能力来自数据——Context 数据闭环让 AI 越用越聪明。

## 场景引入

你的 AI 客服上线三个月了，用户反馈"回答越来越不准"。分析发现，用户的负面反馈被收集后就堆在数据库里，没有人去分析失败原因，也没有人优化 Prompt 或检索策略。AI 的表现不会自动变好——没有数据闭环，它只会原地踏步甚至退化。你需要一套从反馈到优化的自动化流水线。

## 学习目标

- 设计 Context 数据采集体系
- 实现用户反馈和标注系统
- 构建数据回流和自动优化机制

## 数据采集

```python
class ContextCollector:
    """Context 数据采集器"""
    
    async def collect(self, event_type: str, data: dict):
        """采集 AI 调用数据"""
        record = {
            "id": str(uuid.uuid4()),
            "event_type": event_type,  # llm_call / user_feedback / tool_call / error
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        # 写入数据库
        await self._save_to_db(record)
        
        # 异步写入分析队列
        await self._enqueue_for_analysis(record)
```

## 用户反馈

```python
@router.post("/messages/{message_id}/feedback")
async def submit_feedback(
    message_id: str,
    feedback: FeedbackRequest,
    user: User = Depends(get_current_user),
):
    """提交用户反馈"""
    await db.execute(
        text("""
            UPDATE messages SET 
                user_feedback = :feedback,
                feedback_comment = :comment,
                feedback_at = now()
            WHERE id = :id
        """),
        {
            "id": message_id,
            "feedback": feedback.rating,  # thumbs_up / thumbs_down
            "comment": feedback.comment,
        },
    )
    
    # 如果是负面反馈，触发优化流程
    if feedback.rating == "thumbs_down":
        await optimization_pipeline.schedule(message_id)
```

## 数据回流优化

```python
class OptimizationPipeline:
    """数据优化 Pipeline"""
    
    async def schedule(self, message_id: str):
        """调度优化任务"""
        # 获取消息和上下文
        message = await self._get_message(message_id)
        context = await self._get_context(message["session_id"])
        
        # 分析失败原因
        analysis = await self._analyze_failure(message, context)
        
        # 根据分析结果采取行动
        if analysis["reason"] == "retrieval_failure":
            # 检索失败：优化 Embedding 或切分策略
            await self._optimize_retrieval(message, analysis)
        elif analysis["reason"] == "prompt_issue":
            # Prompt 问题：优化 Prompt
            await self._optimize_prompt(message, analysis)
        elif analysis["reason"] == "hallucination":
            # 幻觉：加强引用约束
            await self._add_to_negative_examples(message)
    
    async def _analyze_failure(self, message, context) -> dict:
        """分析失败原因"""
        prompt = f"""分析以下 AI 回答失败的原因：

用户问题：{context['question']}
AI 回答：{message['content']}
用户反馈：负面
检索到的文档：{json.dumps(context['retrieved_docs'], ensure_ascii=False)}

请分析失败原因并给出优化建议。"""
        
        response = await self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o",
            response_format={"type": "json_object"},
        )
        
        return json.loads(response.content)
```

## 练习

### 练习 1：数据采集

实现 Context 数据采集：

1. 采集 LLM 调用数据
2. 采集用户反馈
3. 采集工具调用数据

### 练习 2：反馈闭环

实现反馈到优化的闭环：

1. 收集负面反馈
2. 分析失败原因
3. 自动优化 Prompt 或检索策略

---

## 参考答案

### 练习 1

**思路**：数据采集的核心是设计统一的事件模型，覆盖 LLM 调用、用户反馈、工具调用三类事件。用事件总线解耦采集和消费——采集器只负责写入事件队列，下游的分析、告警、优化等消费者各自订阅。关键是事件要包含足够的上下文（session_id、user_id、trace_id），否则后续分析无法关联。

**答案**：

```python
import uuid
import json
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from dataclasses import dataclass, field, asdict

class EventType(str, Enum):
    LLM_CALL = "llm_call"
    USER_FEEDBACK = "user_feedback"
    TOOL_CALL = "tool_call"
    ERROR = "error"
    RETRIEVAL = "retrieval"

@dataclass
class ContextEvent:
    id: str
    event_type: EventType
    session_id: str
    user_id: str
    data: dict
    metadata: dict = field(default_factory=dict)
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()

class ContextCollector:
    """Context 数据采集器——统一采集入口"""

    def __init__(self, db, event_queue):
        self.db = db
        self.queue = event_queue

    async def collect(self, event_type: EventType, session_id: str, user_id: str, data: dict, metadata: dict = None):
        event = ContextEvent(
            id=str(uuid.uuid4()),
            event_type=event_type,
            session_id=session_id,
            user_id=user_id,
            data=data,
            metadata=metadata or {},
        )

        # 1. 写入数据库（持久化）
        await self.db.insert("context_events", {
            "id": event.id,
            "event_type": event.event_type.value,
            "session_id": event.session_id,
            "user_id": event.user_id,
            "data": event.data,
            "metadata": event.metadata,
            "created_at": event.timestamp,
        })

        # 2. 推入事件队列（异步消费）
        await self.queue.publish("context_events", json.dumps(asdict(event), ensure_ascii=False, default=str))

        return event.id

    async def collect_llm_call(self, session_id: str, user_id: str, call_data: dict):
        """采集 LLM 调用数据"""
        return await self.collect(
            event_type=EventType.LLM_CALL,
            session_id=session_id,
            user_id=user_id,
            data={
                "model": call_data["model"],
                "messages": call_data["messages"][:5],  # 只保留前 5 条
                "response": call_data["response"][:2000],
                "input_tokens": call_data.get("input_tokens", 0),
                "output_tokens": call_data.get("output_tokens", 0),
                "cost": call_data.get("cost", 0),
                "latency_ms": call_data.get("latency_ms", 0),
            },
        )

    async def collect_user_feedback(self, session_id: str, user_id: str, message_id: str, rating: str, comment: str = ""):
        """采集用户反馈"""
        return await self.collect(
            event_type=EventType.USER_FEEDBACK,
            session_id=session_id,
            user_id=user_id,
            data={
                "message_id": message_id,
                "rating": rating,  # thumbs_up / thumbs_down
                "comment": comment,
            },
        )

    async def collect_tool_call(self, session_id: str, user_id: str, tool_data: dict):
        """采集工具调用数据"""
        return await self.collect(
            event_type=EventType.TOOL_CALL,
            session_id=session_id,
            user_id=user_id,
            data={
                "tool_name": tool_data["tool_name"],
                "params": tool_data.get("params", {}),
                "result": str(tool_data.get("result", ""))[:500],
                "success": tool_data.get("success", True),
                "latency_ms": tool_data.get("latency_ms", 0),
            },
        )

    async def collect_error(self, session_id: str, user_id: str, error: Exception, context: dict = None):
        """采集错误事件"""
        return await self.collect(
            event_type=EventType.ERROR,
            session_id=session_id,
            user_id=user_id,
            data={
                "error_type": type(error).__name__,
                "error_message": str(error)[:500],
                "context": context or {},
            },
        )


# 反馈 API
from fastapi import APIRouter, Depends

router = APIRouter(prefix="/api/v1")

@router.post("/messages/{message_id}/feedback")
async def submit_feedback(
    message_id: str,
    body: FeedbackRequest,
    user=Depends(get_current_user),
    collector: ContextCollector = Depends(get_collector),
):
    """提交用户反馈"""
    # 更新消息记录
    await db.update("messages", message_id, {
        "user_feedback": body.rating,
        "feedback_comment": body.comment,
        "feedback_at": datetime.now(timezone.utc),
    })

    # 采集反馈事件
    message = await db.get("messages", message_id)
    await collector.collect_user_feedback(
        session_id=message["session_id"],
        user_id=user["id"],
        message_id=message_id,
        rating=body.rating,
        comment=body.comment,
    )

    # 负面反馈触发优化流程
    if body.rating == "thumbs_down":
        await optimization_pipeline.schedule(message_id)

    return {"ok": True}
```

**要点**：
- 事件数据要包含完整的上下文链（session_id → message_id → trace_id），否则后续无法关联分析
- 采集和消费解耦——采集器只写数据库和事件队列，分析/优化等下游逻辑在消费者中异步处理
- 常见错误：在用户请求链路中同步执行分析任务——会严重拖慢响应速度，必须异步化

### 练习 2

**思路**：反馈闭环的核心是"负面反馈 → 原因分析 → 自动优化 → 效果验证"四步。用 LLM 分析失败原因（检索失败、Prompt 问题、幻觉），根据原因类型触发不同的优化策略。关键是优化后要通过 A/B 测试验证效果，不能盲目全量上线。

**答案**：

```python
import json
from datetime import datetime, timezone
from enum import Enum

class FailureReason(str, Enum):
    RETRIEVAL_FAILURE = "retrieval_failure"   # 检索不到相关文档
    PROMPT_ISSUE = "prompt_issue"              # Prompt 不够好
    HALLUCINATION = "hallucination"            # 幻觉
    IRRELEVANT = "irrelevant"                  # 回答不相关
    OUTDATED = "outdated"                      # 信息过时

class OptimizationPipeline:
    """反馈优化 Pipeline"""

    def __init__(self, db, llm, embedding_service):
        self.db = db
        self.llm = llm
        self.embedding = embedding_service

    async def schedule(self, message_id: str):
        """调度优化任务"""
        message = await self.db.get("messages", message_id)
        session = await self.db.get("sessions", message["session_id"])

        # 获取完整上下文
        context = await self._build_context(message, session)

        # 分析失败原因
        analysis = await self._analyze_failure(context)

        # 记录分析结果
        await self.db.insert("optimization_logs", {
            "message_id": message_id,
            "reason": analysis["reason"],
            "confidence": analysis["confidence"],
            "suggestion": analysis["suggestion"],
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
        })

        # 根据原因执行优化
        if analysis["reason"] == FailureReason.RETRIEVAL_FAILURE:
            await self._optimize_retrieval(context, analysis)
        elif analysis["reason"] == FailureReason.PROMPT_ISSUE:
            await self._optimize_prompt(context, analysis)
        elif analysis["reason"] == FailureReason.HALLUCINATION:
            await self._handle_hallucination(context, analysis)
        elif analysis["reason"] == FailureReason.OUTDATED:
            await self._flag_outdated_content(context, analysis)

    async def _build_context(self, message: dict, session: dict) -> dict:
        """构建分析上下文"""
        # 获取同 session 的历史消息
        history = await self.db.query_list(
            "messages",
            session_id=message["session_id"],
            order_by="created_at",
            limit=20,
        )
        # 获取检索到的文档
        retrieved_docs = await self.db.query_list(
            "retrieval_logs",
            session_id=message["session_id"],
            order_by="created_at",
            limit=10,
        )
        return {
            "question": history[-2]["content"] if len(history) >= 2 else "",
            "answer": message["content"],
            "feedback": message.get("user_feedback"),
            "feedback_comment": message.get("feedback_comment", ""),
            "history": [{"role": m["role"], "content": m["content"]} for m in history[-10:]],
            "retrieved_docs": [{"content": d["content"], "score": d["score"]} for d in retrieved_docs],
            "agent_config": {"system_prompt": session.get("system_prompt", "")},
        }

    async def _analyze_failure(self, context: dict) -> dict:
        """用 LLM 分析失败原因"""
        prompt = f"""分析以下 AI 回答的失败原因。

用户问题：{context['question']}
AI 回答：{context['answer']}
用户反馈：{context['feedback']} - {context['feedback_comment']}
检索到的文档（前3条）：
{json.dumps(context['retrieved_docs'][:3], ensure_ascii=False, indent=2)}

请判断失败原因并输出 JSON：
{{
  "reason": "retrieval_failure | prompt_issue | hallucination | irrelevant | outdated",
  "confidence": 0.0-1.0,
  "evidence": "判断依据",
  "suggestion": "具体优化建议"
}}"""

        response = await self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o",
            response_format={"type": "json_object"},
        )
        return json.loads(response.content)

    async def _optimize_retrieval(self, context: dict, analysis: dict):
        """优化检索策略"""
        # 1. 将用户问题作为新的训练样本加入 Embedding 索引
        question = context["question"]
        question_embedding = await self.embedding.encode(question)

        # 2. 检查是否有语义相似但检索不到的文档
        similar_docs = await self.embedding.search(question_embedding, top_k=10)
        if not similar_docs:
            # 知识库中没有相关内容，标记为需要补充
            await self.db.insert("knowledge_gaps", {
                "question": question,
                "reason": analysis["suggestion"],
                "status": "pending",
            })

        # 3. 记录优化动作
        await self.db.insert("optimization_actions", {
            "type": "retrieval_optimization",
            "detail": {"question": question, "suggestion": analysis["suggestion"]},
            "status": "applied",
        })

    async def _optimize_prompt(self, context: dict, analysis: dict):
        """优化 Prompt"""
        current_prompt = context["agent_config"]["system_prompt"]

        # 用 LLM 生成优化后的 Prompt
        optimize_prompt = f"""优化以下 system prompt，使其能更好地处理类似问题。

当前 system prompt：
{current_prompt}

失败的用户问题：{context['question']}
失败的 AI 回答：{context['answer']}
失败原因：{analysis['suggestion']}

请输出优化后的 system prompt（只输出 prompt 内容，不要其他说明）："""

        response = await self.llm.chat(
            messages=[{"role": "user", "content": optimize_prompt}],
            model="gpt-4o",
        )

        new_prompt = response.content

        # 存为候选版本，不直接上线
        await self.db.insert("prompt_candidates", {
            "original_prompt": current_prompt,
            "optimized_prompt": new_prompt,
            "trigger_message": context["question"],
            "reason": analysis["suggestion"],
            "status": "pending_review",  # 需要人工审核或 A/B 测试
        })

    async def _handle_hallucination(self, context: dict, analysis: dict):
        """处理幻觉——加入反例库"""
        await self.db.insert("negative_examples", {
            "question": context["question"],
            "bad_answer": context["answer"],
            "reason": analysis["evidence"],
            "correct_answer": analysis["suggestion"],
        })

    async def _flag_outdated_content(self, context: dict, analysis: dict):
        """标记过时内容"""
        for doc in context["retrieved_docs"]:
            await self.db.insert("content_review_queue", {
                "content": doc["content"][:500],
                "reason": "outdated",
                "triggered_by": analysis["suggestion"],
            })
```

**要点**：
- 优化结果不能直接上线——必须存为候选版本，通过 A/B 测试验证效果后再全量发布
- 幻觉处理的最佳策略是加入反例库，在 Prompt 中增加"如果不确定请说不知道"的约束
- 常见错误：优化后不验证效果——没有 A/B 测试对比，不知道优化是否真的改善了指标，甚至可能越改越差

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| 反馈太少 | 入口太深 | 在回答旁边直接放反馈按钮 |
| 优化不生效 | 没验证优化效果 | A/B 测试对比 |
| 数据泄露 | 反馈内容含敏感信息 | 脱敏处理 |

## 工程建议

负面反馈的处理流程要异步化，不要在用户请求链路中触发优化任务，避免拖慢响应速度。A/B 测试是验证优化效果的唯一可靠方式——上线新 Prompt 或新检索策略时，先对 10% 流量灰度，对比指标后再全量发布。数据采集要考虑采样策略，高并发场景下不必记录每一条 LLM 调用，按比例采样即可。反馈数据中的敏感信息要在入库前脱敏，避免合规风险。

## 本节要点

- Context 数据闭环 = 采集 → 标注 → 分析 → 优化 → 采集
- 用户反馈是最直接的质量信号
- 自动优化让 AI 越用越好
- 数据闭环是 AI 应用长期竞争力的来源
