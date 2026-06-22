# 01 Agent 设计哲学

> Agent 不是"会调工具的 ChatBot"——是能自主规划、执行、反思的智能体。

## 场景引入

老板说："我要一个 AI 助手，用户说'帮我查一下最近三个月的销售数据，分析趋势，生成报告发给张总'，它就能自动完成。"你发现这远不是一个 ChatBot 能做到的——它需要拆解任务、调用多个系统、处理中间结果、在关键步骤请求人工确认。这就是 Agent 要解决的问题。

## 学习目标

- 理解 Agent 的核心设计范式（ReAct、Plan-and-Execute）
- 掌握 Agent 与普通对话的本质区别
- 了解主流 Agent 框架的设计思想

## 前置要求

- 已完成阶段 1-3，理解对话系统和 RAG

## 什么是 Agent

```
普通 LLM：用户提问 → LLM 回答 → 结束
Agent：   用户提问 → LLM 思考 → 选择工具 → 执行 → 观察结果 → 继续思考 → ... → 最终回答
```

Agent 的核心能力：

1. **规划**：把复杂任务拆解成步骤
2. **工具使用**：调用外部工具获取信息或执行操作
3. **记忆**：保持对话历史和长期记忆
4. **反思**：根据执行结果调整策略

## ReAct 范式

ReAct（Reasoning + Acting）是最经典的 Agent 范式：

```
Thought: 我需要查找星辰科技的产品价格
Action: search_knowledge_base("产品价格")
Observation: 基础版 99元/月，专业版 299元/月...
Thought: 我已经找到了价格信息，可以回答用户了
Answer: 我们有三个版本...
```

```python
# ReAct Agent 实现
class ReActAgent:
    def __init__(self, llm: LLMService, tools: list[Tool]):
        self.llm = llm
        self.tools = {t.name: t for t in tools}
    
    async def run(self, task: str, max_steps: int = 10) -> str:
        messages = [
            {"role": "system", "content": self._build_system_prompt()},
            {"role": "user", "content": task},
        ]
        
        for step in range(max_steps):
            # 1. LLM 思考
            response = await self.llm.chat(messages, model="gpt-4o")
            content = response.content
            
            # 2. 检查是否要调用工具
            action = self._parse_action(content)
            
            if action is None:
                # 没有 Action，说明已经得出最终答案
                return content
            
            # 3. 执行工具
            tool = self.tools.get(action["tool"])
            if not tool:
                observation = f"Error: Tool '{action['tool']}' not found"
            else:
                observation = await tool.execute(action["input"])
            
            # 4. 把结果加入上下文，继续思考
            messages.append({"role": "assistant", "content": content})
            messages.append({"role": "user", "content": f"Observation: {observation}"})
        
        return "达到最大步骤数，任务未完成"
    
    def _build_system_prompt(self) -> str:
        tools_desc = "\n".join(
            f"- {t.name}: {t.description}" for t in self.tools.values()
        )
        return f"""你是一个 AI Agent，可以使用以下工具：

{tools_desc}

使用格式：
Thought: <你的思考>
Action: <工具名称>(<参数>)
Observation: <工具返回的结果>
... (可以多次 Thought/Action/Observation)
Thought: <最终思考>
Answer: <最终回答>

重要：每次只能调用一个工具。"""
```

## Plan-and-Execute 范式

先制定计划，再逐步执行：

```python
class PlanAndExecuteAgent:
    def __init__(self, llm: LLMService, tools: list[Tool]):
        self.llm = llm
        self.tools = {t.name: t for t in tools}
    
    async def run(self, task: str) -> str:
        # 1. 制定计划
        plan = await self._create_plan(task)
        
        # 2. 逐步执行
        results = []
        for step in plan["steps"]:
            result = await self._execute_step(step, results)
            results.append({"step": step, "result": result})
        
        # 3. 综合结果
        return await self._synthesize(task, results)
    
    async def _create_plan(self, task: str) -> dict:
        prompt = f"""请为以下任务制定执行计划：

任务：{task}

可用工具：{', '.join(self.tools.keys())}

请输出 JSON 格式的计划：
{{
    "steps": [
        {{"action": "工具名", "input": "参数", "purpose": "目的"}},
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

## 两种范式对比

| 维度 | ReAct | Plan-and-Execute |
|------|-------|------------------|
| 思考方式 | 边想边做 | 先想后做 |
| 灵活性 | 高（随时调整） | 中（计划可能需要修正） |
| 适合场景 | 简单任务、单轮工具调用 | 复杂任务、多步骤协作 |
| 成本 | 较低 | 较高（需要规划步骤） |
| 可靠性 | 中 | 较高（有全局规划） |

## 练习

### 练习 1：ReAct Agent

实现一个简单的 ReAct Agent：

1. 注册 3 个工具：搜索、计算器、获取当前时间
2. 用自然语言测试：今天星期几？帮我算 123 * 456
3. 观察 Agent 的思考过程

### 练习 2：对比两种范式

用同一个复杂任务测试两种范式：

任务："帮我调研 AI Agent 的市场现状，对比 3 个主要产品，写一份简短报告"

1. ReAct 范式：边搜索边写
2. Plan-and-Execute：先制定计划再执行
3. 对比：完成质量、耗时、token 用量

## 常见误区

| 误区 | 原因 | 解决 |
|------|------|------|
| 把 ChatBot 包装成 Agent | 只加了工具调用没有规划能力 | 实现真正的 ReAct 或 Plan-and-Execute 循环 |
| Agent 每次都用最强模型 | 没有按任务复杂度选模型 | 简单任务用轻量模型，复杂任务用强模型 |
| 忽略 Agent 的失败处理 | 假设 LLM 总能正确推理 | 设置最大步骤数、超时机制和降级策略 |
| 工具注册过多导致选择困难 | 没有按场景筛选可用工具 | 根据任务类型动态加载相关工具 |

## 工程建议

- ReAct 适合工具调用少于 5 步的简单任务，Plan-and-Execute 适合需要全局规划的复杂任务，选错范式会导致效率或质量问题
- Agent 的 System Prompt 要明确列出可用工具和调用格式，模糊的描述是 LLM 调错工具的首要原因
- 生产环境必须设置最大步骤数（建议 10 步）和单步超时（建议 30 秒），防止 Agent 失控
- 建议记录 Agent 的完整思考链路（Thought → Action → Observation），便于调试和优化

## 本节要点

- Agent = Reasoning + Acting + Memory
- ReAct 适合简单任务，Plan-and-Execute 适合复杂任务
- Agent 的核心是"自主决策"，不是"按脚本执行"
- 工具设计的质量直接决定 Agent 的能力上限
