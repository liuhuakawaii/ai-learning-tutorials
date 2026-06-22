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

---

## 参考答案

### 练习 1

**思路**：基于课程中的 ReActAgent 类，注册三个工具（搜索、计算器、当前时间），用自然语言测试 Agent 的工具选择和思考链路。

**答案**：

```python
import asyncio
from datetime import datetime
import math

class Tool:
    def __init__(self, name, description, func):
        self.name = name
        self.description = description
        self.func = func

    async def execute(self, input: str) -> str:
        return self.func(input)


def search_tool(input: str) -> str:
    return f"搜索结果：关于'{input}'的信息暂时无法获取（demo 模式）"


def calculator_tool(input: str) -> str:
    try:
        result = eval(input, {"__builtins__": {}}, {"math": math})
        return f"计算结果：{result}"
    except Exception as e:
        return f"计算错误：{e}"


def current_time_tool(input: str) -> str:
    now = datetime.now()
    weekdays = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
    return f"当前时间：{now.strftime('%Y-%m-%d %H:%M:%S')}，{weekdays[now.weekday()]}"


tools = [
    Tool("search", "搜索互联网获取信息", search_tool),
    Tool("calculator", "执行数学计算，输入数学表达式如 123 * 456", calculator_tool),
    Tool("current_time", "获取当前日期和时间", current_time_tool),
]


async def test_react_agent():
    from openai import AsyncOpenAI
    client = AsyncOpenAI()
    agent = ReActAgent(llm=client, tools=tools)

    test_queries = [
        "今天星期几？",
        "帮我算 123 * 456",
        "现在几点了？",
    ]

    for query in test_queries:
        print(f"\n问题：{query}")
        result = await agent.run(query)
        print(f"回答：{result[:200]}")


asyncio.run(test_react_agent())
```

**要点**：
- ReAct Agent 的核心是 Thought → Action → Observation 循环，每步只调一个工具
- Agent 能自动选择正确的工具：时间问题调 current_time，计算问题调 calculator
- System Prompt 中工具描述越精确，Agent 选得越准
- 常见错误：工具描述太模糊（如"工具1"），Agent 无法判断该用哪个

### 练习 2

**思路**：用同一个复杂任务分别测试 ReAct 和 Plan-and-Execute，从完成质量、耗时、token 用量三个维度对比。

**答案**：

```python
import asyncio
import time
from openai import AsyncOpenAI

client = AsyncOpenAI()

COMPLEX_TASK = "帮我调研 AI Agent 的市场现状，对比 3 个主要产品，写一份简短报告"


async def test_react(task: str):
    print("=" * 50)
    print("ReAct 范式测试")
    start = time.time()

    agent = ReActAgent(llm=client, tools=tools)
    result = await agent.run(task, max_steps=15)

    elapsed = time.time() - start
    print(f"耗时：{elapsed:.1f}s")
    print(f"结果：{result[:300]}...")
    return {"approach": "ReAct", "time": elapsed, "result_length": len(result)}


async def test_plan_and_execute(task: str):
    print("=" * 50)
    print("Plan-and-Execute 范式测试")
    start = time.time()

    agent = PlanAndExecuteAgent(llm=client, tools=tools)
    result = await agent.run(task)

    elapsed = time.time() - start
    print(f"耗时：{elapsed:.1f}s")
    print(f"结果：{result[:300]}...")
    return {"approach": "Plan-and-Execute", "time": elapsed, "result_length": len(result)}


async def compare():
    react_result = await test_react(COMPLEX_TASK)
    plan_result = await test_plan_and_execute(COMPLEX_TASK)

    print("\n" + "=" * 50)
    print("对比结果：")
    print(f"  ReAct:             耗时 {react_result['time']:.1f}s, 长度 {react_result['result_length']}")
    print(f"  Plan-and-Execute:  耗时 {plan_result['time']:.1f}s, 长度 {plan_result['result_length']}")


asyncio.run(compare())
```

**要点**：
- ReAct 边想边做，适合简单任务，但复杂任务可能遗漏步骤（如只搜了 1 个产品就开始写报告）
- Plan-and-Execute 先全局规划再执行，复杂任务质量更高，但前期规划消耗额外 token
- 常见错误：简单任务也用 Plan-and-Execute，浪费 token 和时间；应该根据任务复杂度选择范式
- 对比时不仅看最终质量，还要看中间步骤是否合理、是否有冗余调用

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
