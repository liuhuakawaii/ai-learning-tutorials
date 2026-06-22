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

---

## 参考答案

### 练习 1

**思路**：基于课程中的 SupervisorAgent 类，实现监督者模式。核心是 Supervisor 的规划能力——正确理解任务并分配给合适的 Worker。

**答案**：

```python
import json
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()

class WorkerAgent:
    def __init__(self, name: str, description: str, llm):
        self.name = name
        self.description = description
        self.llm = llm

    async def run(self, task: str) -> str:
        response = await self.llm.chat(
            messages=[
                {"role": "system", "content": f"你是{self.description}。请完成以下任务，输出简洁的结果。"},
                {"role": "user", "content": task},
            ],
            model="gpt-4o-mini",
        )
        return response.content


class SupervisorAgent:
    def __init__(self, llm, workers: dict[str, WorkerAgent]):
        self.llm = llm
        self.workers = workers

    async def run(self, task: str) -> str:
        plan = await self._plan(task)
        results = {}
        for step in plan["steps"]:
            worker_name = step["worker"]
            worker = self.workers.get(worker_name)
            if not worker:
                results[step["id"]] = f"错误：找不到 Worker '{worker_name}'"
                continue

            worker_task = self._build_task(step, results)
            print(f"  分配给 {worker_name}: {worker_task[:50]}...")
            result = await worker.run(worker_task)
            results[step["id"]] = result
            print(f"  {worker_name} 完成: {result[:80]}...")

        return await self._synthesize(task, results)

    async def _plan(self, task: str) -> dict:
        worker_list = "\n".join(f"- {name}: {w.description}" for name, w in self.workers.items())
        prompt = f"""请为以下任务制定执行计划。

任务：{task}

可用 Worker：
{worker_list}

输出 JSON 计划：
{{"steps": [{{"id": "step1", "worker": "worker_name", "task": "具体任务"}}]}}"""

        response = await self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o",
            response_format={"type": "json_object"},
        )
        return json.loads(response.content)

    def _build_task(self, step: dict, prev_results: dict) -> str:
        context = ""
        if prev_results:
            context = "\n前序步骤结果：\n" + "\n".join(f"- {k}: {v[:200]}" for k, v in prev_results.items())
        return f"{step['task']}{context}"

    async def _synthesize(self, task: str, results: dict) -> str:
        context = "\n".join(f"[{k}] {v[:300]}" for k, v in results.items())
        prompt = f"任务：{task}\n\n各步骤结果：\n{context}\n\n请整合以上结果，输出最终报告。"
        response = await self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o",
        )
        return response.content


# 测试
async def test_supervisor():
    workers = {
        "researcher": WorkerAgent("researcher", "研究员，负责收集和整理资料", client),
        "analyst": WorkerAgent("analyst", "分析师，负责分析数据和提炼洞察", client),
        "writer": WorkerAgent("writer", "写手，负责撰写文档和报告", client),
    }
    supervisor = SupervisorAgent(client, workers)
    result = await supervisor.run("分析 AI Agent 市场现状，写一份简短报告")
    print(f"\n最终报告：\n{result[:500]}")

asyncio.run(test_supervisor())
```

**要点**：
- Supervisor 的规划质量直接决定最终结果，Worker 描述越精确分配越准确
- 每个 Worker 的任务要包含前序步骤的结果，避免信息断裂
- 常见错误：Worker 描述太模糊（如"助手1"），Supervisor 无法判断该分配给谁；没有综合步骤，各 Worker 结果直接拼接

### 练习 2

**思路**：实现完整的四角色研究团队（研究员→分析师→写手→审核员），流水线式协作，审核员可以触发修改循环。

**答案**：

```python
class ResearcherAgent:
    def __init__(self, llm):
        self.llm = llm
        self.description = "负责收集和整理资料"

    async def collect(self, topic: str) -> list[dict]:
        prompt = f"请为以下主题生成 5 个搜索关键词：{topic}"
        response = await self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o-mini",
        )
        queries = [q.strip() for q in response.content.strip().split("\n") if q.strip()]

        results = []
        for query in queries[:5]:
            search_result = f"关于'{query}'的搜索结果（模拟）"  # 实际调用搜索工具
            results.append({"query": query, "content": search_result})
        return results


class AnalystAgent:
    def __init__(self, llm):
        self.llm = llm
        self.description = "负责分析数据和提炼洞察"

    async def analyze(self, data: list[dict]) -> dict:
        content = "\n".join(f"- {d['query']}: {d['content']}" for d in data)
        prompt = f"请分析以下资料，提炼 3-5 个关键洞察：\n\n{content}"
        response = await self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o",
            response_format={"type": "json_object"},
        )
        return json.loads(response.content)


class WriterAgent:
    def __init__(self, llm):
        self.llm = llm
        self.description = "负责撰写报告"

    async def write(self, topic: str, analysis: dict) -> str:
        prompt = f"主题：{topic}\n\n分析结果：{json.dumps(analysis, ensure_ascii=False)}\n\n请撰写一份结构清晰的报告。"
        response = await self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o",
        )
        return response.content

    async def revise(self, draft: str, feedback: str) -> str:
        prompt = f"请根据以下反馈修改报告：\n\n原稿：\n{draft}\n\n反馈：\n{feedback}"
        response = await self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o",
        )
        return response.content


class ReviewerAgent:
    def __init__(self, llm):
        self.llm = llm
        self.description = "负责审核报告质量"

    async def review(self, draft: str) -> dict:
        prompt = f"""请审核以下报告，输出 JSON：
{{"needs_revision": true/false, "score": 1-10, "comments": "修改建议"}}

报告：
{draft}"""
        response = await self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o",
            response_format={"type": "json_object"},
        )
        return json.loads(response.content)


class ResearchTeam:
    def __init__(self, llm):
        self.researcher = ResearcherAgent(llm)
        self.analyst = AnalystAgent(llm)
        self.writer = WriterAgent(llm)
        self.reviewer = ReviewerAgent(llm)

    async def research(self, topic: str, max_revisions: int = 2) -> str:
        data = await self.researcher.collect(topic)
        analysis = await self.analyst.analyze(data)
        draft = await self.writer.write(topic, analysis)

        for _ in range(max_revisions):
            feedback = await self.reviewer.review(draft)
            if not feedback["needs_revision"]:
                break
            draft = await self.writer.revise(draft, feedback["comments"])

        return draft


async def test_research_team():
    team = ResearchTeam(client)
    report = await team.research("AI Agent 市场现状")
    print(report[:500])

asyncio.run(test_research_team())
```

**要点**：
- 流水线式协作：研究员→分析师→写手→审核员，每步的输出是下一步的输入
- 审核员可以触发修改循环，但必须设置最大修订次数（max_revisions）防止无限循环
- 每个角色用不同模型：研究用弱模型（省钱），分析和写作用强模型（保质量）
- 常见错误：没有审核环节，写手直接输出最终报告，质量不可控；审核没有终止条件，Agent 互相推诿

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
