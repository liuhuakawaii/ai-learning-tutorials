# 05 Context 数据闭环

> AI 的能力来自数据——Context 数据闭环让 AI 越用越聪明。

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

## 本节要点

- Context 数据闭环 = 采集 → 标注 → 分析 → 优化 → 采集
- 用户反馈是最直接的质量信号
- 自动优化让 AI 越用越好
- 数据闭环是 AI 应用长期竞争力的来源

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| 反馈太少 | 入口太深 | 在回答旁边直接放反馈按钮 |
| 优化不生效 | 没验证优化效果 | A/B 测试对比 |
| 数据泄露 | 反馈内容含敏感信息 | 脱敏处理 |
