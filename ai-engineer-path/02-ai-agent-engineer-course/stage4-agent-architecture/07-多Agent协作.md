# 07 多 Agent 协作

> 单个 Agent 能力有限——多个 Agent 协作，才能完成复杂任务。

## 场景引入

你让一个 Agent 完成"调研 AI Agent 市场现状，写一份分析报告"的任务。它一边搜索资料一边写报告，结果搜索不充分就草草下笔，报告质量很差。一个 Agent 同时扮演研究员、分析师和写手，角色混乱导致每个环节都不够专业。多 Agent 协作让每个 Agent 专注一个角色，协作完成复杂任务。

## 学习目标

- 理解多 Agent 协作的设计模式
- 实现监督者模式和对等协作模式
- 掌握 Agent 之间的消息传递和冲突解决

## 协作模式

| 模式 | 描述 | 适用场景 |
|------|------|----------|
| 监督者模式 | 一个 Supervisor 分配任务给 Worker | 任务分工明确 |
| 对等模式 | Agent 之间平等对话、协商 | 需要讨论和辩论 |
| 流水线模式 | Agent 按顺序处理 | 固定流程 |

## 监督者模式

```python
class SupervisorAgent:
    """监督者——负责任务分配和结果整合"""
    
    def __init__(self, llm: LLMService, workers: dict[str, AgentService]):
        self.llm = llm
        self.workers = workers
    
    async def run(self, task: str) -> str:
        # 1. 分析任务，制定计划
        plan = await self._plan(task)
        
        # 2. 分配任务给 Worker
        results = {}
        for step in plan["steps"]:
            worker_name = step["worker"]
            worker = self.workers[worker_name]
            
            # 构建 Worker 任务（包含前面步骤的结果）
            worker_task = self._build_worker_task(step, results)
            
            # 执行
            result = await worker.run(worker_task)
            results[step["id"]] = result
        
        # 3. 整合结果
        return await self._synthesize(task, results)
    
    async def _plan(self, task: str) -> dict:
        worker_list = "\n".join(
            f"- {name}: {w.description}" for name, w in self.workers.items()
        )
        
        prompt = f"""请为以下任务制定执行计划。

任务：{task}

可用的 Worker：
{worker_list}

请输出 JSON 计划：
{{
    "steps": [
        {{"id": "step1", "worker": "worker_name", "task": "具体任务描述"}},
        ...
    ]
}}"""
        
        response = await self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o",
            response_format={"type": "json_object"},
        )
        
        return json.loads(response.content)
```

## 研究团队示例

```python
class ResearchTeam:
    """研究团队——多 Agent 协作完成研究任务"""
    
    def __init__(self, llm: LLMService):
        self.researcher = ResearcherAgent(llm)
        self.analyst = AnalystAgent(llm)
        self.writer = WriterAgent(llm)
        self.reviewer = ReviewerAgent(llm)
    
    async def research(self, topic: str) -> str:
        # 1. 研究员收集资料
        research_data = await self.researcher.collect(topic)
        
        # 2. 分析师分析资料
        analysis = await self.analyst.analyze(research_data)
        
        # 3. 写手撰写报告
        draft = await self.writer.write(topic, analysis)
        
        # 4. 审核员审核
        feedback = await self.reviewer.review(draft)
        
        # 5. 如果需要修改，写手修改
        if feedback["needs_revision"]:
            draft = await self.writer.revise(draft, feedback["comments"])
        
        return draft

class ResearcherAgent:
    def __init__(self, llm: LLMService):
        self.llm = llm
        self.description = "负责收集和整理资料"
    
    async def collect(self, topic: str) -> list[dict]:
        # 搜索多个来源
        results = []
        for query in await self._generate_queries(topic):
            search_results = await search_tool.execute(query=query)
            results.extend(search_results.data)
        return results

class AnalystAgent:
    def __init__(self, llm: LLMService):
        self.llm = llm
        self.description = "负责分析数据和提炼洞察"
    
    async def analyze(self, data: list[dict]) -> dict:
        prompt = f"请分析以下资料，提炼关键洞察：\n\n{json.dumps(data, ensure_ascii=False)}"
        response = await self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o",
            response_format={"type": "json_object"},
        )
        return json.loads(response.content)
```

## 对等协作模式

```python
class PeerDiscussion:
    """对等讨论——Agent 之间辩论"""
    
    async def discuss(self, topic: str, rounds: int = 3) -> str:
        messages_a = []
        messages_b = []
        
        for round_num in range(rounds):
            # Agent A 发言
            a_response = await self.agent_a.respond(
                topic, messages_a, messages_b
            )
            messages_a.append({"role": "assistant", "content": a_response})
            
            # Agent B 回应
            b_response = await self.agent_b.respond(
                topic, messages_b, messages_a
            )
            messages_b.append({"role": "assistant", "content": b_response})
        
        # 总结讨论结果
        return await self.moderator.summarize(topic, messages_a, messages_b)
```

## 练习

### 练习 1：监督者模式

实现一个监督者 Agent：

1. 分析任务并制定计划
2. 分配子任务给 Worker Agent
3. 整合结果并输出

### 练习 2：研究团队

实现研究团队协作：

1. 研究员收集资料
2. 分析师分析资料
3. 写手撰写报告
4. 审核员审核并反馈

## 工程建议

- 监督者模式中 Worker 的描述要精确，模糊的描述会导致 Supervisor 分配错误的任务
- 多 Agent 协作的总 token 消耗是单 Agent 的数倍，简单任务不要滥用多 Agent 模式
- Agent 之间传递消息时要保留完整上下文，不要只传结论——下游 Agent 需要原始信息来做判断
- 建议为每个 Agent 设置独立的模型配置，研究用强模型、格式化用弱模型，平衡成本和质量

## 本节要点

- 多 Agent 协作能完成单个 Agent 无法完成的复杂任务
- 监督者模式适合任务分工明确的场景
- 对等模式适合需要讨论和辩论的场景
- Agent 之间的消息传递要清晰、可追溯

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| 任务分配不合理 | Supervisor 理解不准确 | 提供详细的 Worker 描述 |
| 结果整合质量差 | 没有审核环节 | 加入 Reviewer Agent |
| 成本过高 | 每个 Agent 都用最强模型 | 简单任务用便宜模型 |
| 无限循环 | Agent 互相推诿 | 设置最大轮数 |
