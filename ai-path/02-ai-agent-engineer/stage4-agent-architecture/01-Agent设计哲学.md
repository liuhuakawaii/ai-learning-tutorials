# 01 Agent 设计哲学

> Agent 不是"会调工具的 ChatBot"——是能自主规划、执行、反思的智能体。

老板说："我要一个 AI 助手，用户说'帮我查一下最近三个月的销售数据，分析趋势，生成报告发给张总'，它就能自动完成。"你发现这远不是一个 ChatBot 能做到的——它需要拆解任务、调用多个系统、处理中间结果、在关键步骤请求人工确认。这就是 Agent。

## ChatBot 和 Agent 的区别

```
ChatBot：用户提问 → LLM 回答 → 结束
Agent：  用户提问 → LLM 思考 → 选择工具 → 执行 → 观察结果 → 继续思考 → ... → 最终回答
```

ChatBot 只能回答问题，Agent 能完成任务。区别在于三个能力：

- **规划**：把复杂任务拆解成步骤
- **工具使用**：调用外部工具获取信息或执行操作
- **反思**：根据执行结果调整策略

## ReAct 范式

ReAct（Reasoning + Acting）是最经典的 Agent 范式。核心是 Thought → Action → Observation 循环：

```
用户：星辰科技专业版多少钱？

Thought: 我需要查找产品价格信息
Action: search_knowledge_base("星辰科技专业版 价格")
Observation: 星辰科技专业版定价为 299 元/月，支持最多 50 个用户
Thought: 我已经找到了价格信息，可以回答了
Answer: 星辰科技专业版定价为 299 元/月，支持最多 50 个用户。
```

实现一个 ReAct Agent：

```python
class ReActAgent:
    def __init__(self, llm, tools: list):
        self.llm = llm
        self.tools = {t.name: t for t in tools}
    
    async def run(self, task: str, max_steps: int = 10) -> str:
        messages = [
            {"role": "system", "content": self._build_system_prompt()},
            {"role": "user", "content": task},
        ]
        
        for step in range(max_steps):
            response = await self.llm.chat(messages, model="gpt-4o")
            content = response.content
            
            # 解析是否有工具调用
            action = self._parse_action(content)
            if action is None:
                return content  # 没有 Action，是最终答案
            
            # 执行工具
            tool = self.tools.get(action["tool"])
            observation = await tool.execute(action["input"]) if tool else f"Tool '{action['tool']}' not found"
            
            # 把结果加入上下文，继续思考
            messages.append({"role": "assistant", "content": content})
            messages.append({"role": "user", "content": f"Observation: {observation}"})
        
        return "达到最大步骤数，任务未完成"
```

ReAct 的关键：每一步 LLM 先思考（Thought），再决定调什么工具（Action），看到工具返回后继续思考。这个循环让 Agent 能处理多步骤任务。

## Plan-and-Execute 范式

ReAct 是"边想边做"，Plan-and-Execute 是"先想后做"：

```python
class PlanAndExecuteAgent:
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
请输出 JSON 格式的计划：{{"steps": [{{"action": "工具名", "input": "参数", "purpose": "目的"}}]}}"""
        
        response = await self.llm.chat([{"role": "user", "content": prompt}], model="gpt-4o")
        return json.loads(response.content)
```

## 选哪个范式

**ReAct** 适合工具调用少于 5 步的简单任务。边想边做，灵活，成本低。但复杂任务可能遗漏步骤——比如只搜了 1 个产品就开始写报告。

**Plan-and-Execute** 适合需要全局规划的复杂任务。先制定计划再执行，质量更高。但前期规划消耗额外 token，计划可能需要修正。

毕业项目里的 AI 研究助手会用 Plan-and-Execute——"调研 AI Agent 市场现状，对比 3 个产品，写报告"这种任务需要先规划再执行。而简单的客服对话用 ReAct 就够了。

## 工具设计

Agent 的能力上限取决于工具设计。工具描述越精确，LLM 选得越准：

```python
# 好的工具描述
Tool(
    name="search_knowledge_base",
    description="搜索企业知识库，返回与查询相关的文档片段。用于回答产品功能、价格、流程等问题。不适用于实时数据查询。",
    parameters={
        "query": {"type": "string", "description": "搜索关键词"},
        "knowledge_base_id": {"type": "string", "description": "知识库 ID"},
    }
)

# 差的工具描述
Tool(name="search", description="搜索")
```

模糊的描述是 LLM 调错工具的首要原因。阶段 2 的工具设计规范会详细展开这个问题。

## 练习

### 练习 1：实现 ReAct Agent

注册 3 个工具（搜索、计算器、获取当前时间），实现 ReAct 循环，测试：

```python
tools = [
    Tool("calculator", "执行数学计算，输入数学表达式", lambda input: str(eval(input))),
    Tool("current_time", "获取当前日期和时间", lambda input: datetime.now().strftime("%Y-%m-%d %H:%M")),
]

agent = ReActAgent(llm=client, tools=tools)
result = await agent.run("现在几点了？123乘以456等于多少？")
```

观察 Agent 的思考链路：它应该先调 current_time，再调 calculator，最后综合回答。

### 练习 2：对比两种范式

用同一个复杂任务（"调研 AI Agent 市场，对比 3 个产品，写简短报告"）分别测试 ReAct 和 Plan-and-Execute，对比：
1. 完成质量
2. 总耗时
3. Token 用量
4. 中间步骤是否合理

### 练习 3：工具注册表

实现一个 `ToolRegistry`，支持：
1. 注册工具（名称、描述、参数 schema、执行函数）
2. 按名称查找工具
3. 转换为 OpenAI function calling 格式

这个注册表会在毕业项目的 Agent 系统中使用。

## 关键判断

- **Agent 的 System Prompt 要明确列出可用工具和调用格式。** 格式不清导致 LLM 乱调工具。
- **必须设置最大步骤数（建议 10）。** Agent 可能陷入循环——反复调同一个工具却得不到有用结果。
- **记录完整的 Thought → Action → Observation 链路。** 这是调试 Agent 的唯一方式——出了问题要看它"想了什么"。
