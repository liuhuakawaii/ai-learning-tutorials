# 03 Function Calling 实战

> Function Calling 是让 LLM "会用工具"的桥梁。

## 场景引入

你已经设计好了工具接口，但 LLM 只会"说"不会"做"——用户问"帮我查一下订单 A001 的物流状态"，模型回答了一大段解释却从未真正调用查询接口。Function Calling 就是让 LLM 从"纸上谈兵"变成"真枪实干"的桥梁，它让模型知道何时调用工具、调用哪个工具、传什么参数。

## 学习目标

- 掌握 OpenAI Function Calling 的完整流程
- 实现工具调用的前后端完整链路
- 处理多轮工具调用和错误恢复

## 前置要求

- 已完成工具设计规范
- 理解 OpenAI API

## Function Calling 流程

```
用户消息 + 工具定义 → LLM → 返回要调用的工具和参数 → 执行工具 → 把结果返回 LLM → LLM 生成最终回答
```

```python
# backend/app/services/agent_service.py
class AgentService:
    def __init__(self, llm: LLMService, tool_registry: ToolRegistry):
        self.llm = llm
        self.registry = tool_registry
    
    async def run(
        self,
        messages: list[dict],
        max_tool_rounds: int = 5,
    ) -> AsyncGenerator[dict, None]:
        """运行 Agent，支持多轮工具调用"""
        
        tools = self.registry.to_openai_tools()
        
        for round_num in range(max_tool_rounds):
            # 1. 调用 LLM
            response = await self.llm.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                tools=tools,
                tool_choice="auto",
            )
            
            message = response.choices[0].message
            
            # 2. 检查是否有工具调用
            if not message.tool_calls:
                # 没有工具调用，返回最终回答
                yield {"type": "final_answer", "content": message.content}
                return
            
            # 3. 有工具调用，逐个执行
            messages.append(message.model_dump())
            
            for tool_call in message.tool_calls:
                func = tool_call.function
                tool_name = func.name
                tool_args = json.loads(func.arguments)
                
                # 通知前端正在调用工具
                yield {
                    "type": "tool_call",
                    "tool": tool_name,
                    "args": tool_args,
                }
                
                # 执行工具
                tool = self.registry.get(tool_name)
                if tool:
                    result = await tool.execute(**tool_args)
                    observation = result.to_observation()
                else:
                    observation = f"Error: Tool '{tool_name}' not found"
                
                # 把工具结果加入消息
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": observation,
                })
                
                # 通知前端工具执行结果
                yield {
                    "type": "tool_result",
                    "tool": tool_name,
                    "result": observation,
                }
        
        yield {"type": "final_answer", "content": "达到最大工具调用轮数"}
```

## 前端工具调用展示

```vue
<!-- 工具调用展示组件 -->
<template>
  <div class="tool-call">
    <n-collapse>
      <n-collapse-item :title="`🔧 调用工具: ${toolCall.tool}`">
        <div class="tool-args">
          <div class="label">参数：</div>
          <n-code :code="JSON.stringify(toolCall.args, null, 2)" language="json" />
        </div>
        <div v-if="toolResult" class="tool-result">
          <div class="label">结果：</div>
          <n-code :code="toolResult.result" language="json" />
        </div>
        <div v-else class="tool-loading">
          <n-spin size="small" /> 执行中...
        </div>
      </n-collapse-item>
    </n-collapse>
  </div>
</template>
```

## 流式工具调用

```python
async def stream_with_tools(self, session_id: str, message: str):
    """流式输出，支持工具调用"""
    messages = await self._build_messages(session_id, message)
    tools = self.registry.to_openai_tools()
    
    while True:
        stream = await self.llm.client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
            tool_choice="auto",
            stream=True,
        )
        
        # 收集流式响应
        full_message = None
        async for chunk in stream:
            delta = chunk.choices[0].delta
            
            if delta.content:
                yield {"type": "chunk", "content": delta.content}
            
            if delta.tool_calls:
                # 收集工具调用信息
                if full_message is None:
                    full_message = {"role": "assistant", "content": "", "tool_calls": []}
                # ... 收集完整的工具调用
        
        if full_message and full_message.get("tool_calls"):
            # 执行工具调用
            messages.append(full_message)
            for tc in full_message["tool_calls"]:
                result = await self._execute_tool(tc)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                })
                yield {"type": "tool_call", "tool": tc["function"]["name"], "result": result}
            # 继续循环，让 LLM 处理工具结果
        else:
            # 没有工具调用，结束
            break
```

## 练习

### 练习 1：基础 Function Calling

1. 注册 2 个工具（搜索 + 计算器）
2. 实现 Agent 循环
3. 测试多轮工具调用

### 练习 2：流式工具调用

1. 实现流式输出 + 工具调用
2. 前端展示工具调用过程
3. 处理工具调用失败

---

## 参考答案

### 练习 1

**思路**：先定义工具的 JSON Schema 注册到 Registry，然后实现 Agent 循环——调用 LLM、检查 tool_calls、执行工具、把结果追加到 messages、再次调用 LLM，直到没有工具调用或达到最大轮数。

**答案**：

```python
import json
import math
from openai import AsyncOpenAI

client = AsyncOpenAI()

# --- 工具定义 ---
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "搜索互联网获取实时信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculator",
            "description": "执行数学计算，支持基本运算和 math 库函数",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {"type": "string", "description": "数学表达式，如 '2**10' 或 'math.sqrt(144)'"}
                },
                "required": ["expression"],
            },
        },
    },
]

# --- 工具执行 ---
async def execute_tool(name: str, args: dict) -> str:
    if name == "web_search":
        query = args["query"]
        return json.dumps({"results": [f"搜索结果：{query} 的最新信息..."]}, ensure_ascii=False)
    elif name == "calculator":
        try:
            result = eval(args["expression"], {"math": math, "__builtins__": {}})
            return json.dumps({"result": result})
        except Exception as e:
            return json.dumps({"error": str(e)})
    else:
        return json.dumps({"error": f"未知工具: {name}"})

# --- Agent 循环 ---
async def agent_loop(user_message: str, max_rounds: int = 5):
    messages = [{"role": "user", "content": user_message}]

    for round_num in range(max_rounds):
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )
        message = response.choices[0].message

        if not message.tool_calls:
            print(f"最终回答：{message.content}")
            return message.content

        messages.append(message.model_dump())

        for tool_call in message.tool_calls:
            func = tool_call.function
            args = json.loads(func.arguments)
            print(f"[轮次 {round_num + 1}] 调用工具: {func.name}({args})")

            result = await execute_tool(func.name, args)
            print(f"  结果: {result}")

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })

    print("达到最大轮数，停止")

# 测试：需要同时搜索和计算
import asyncio
asyncio.run(agent_loop("帮我查一下比特币今天的价格，然后计算买 3.5 个需要多少钱"))
```

**要点**：
- 工具的 `description` 要写清楚用途和参数含义，LLM 靠描述决定何时调用哪个工具
- 每轮工具调用后要把 assistant message 和所有 tool message 都追加到 messages，否则 LLM 丢失上下文
- 常见错误：只追加最后一条 tool message 而漏掉 assistant message，导致 OpenAI API 报错 "messages must contain tool_call_id"

### 练习 2

**思路**：流式场景下工具调用的难点在于——stream 返回的 tool_calls 是分片的（delta），需要先拼接完整的 tool_call 对象，再统一执行。前端需要在收到 tool_call 事件时展示加载状态，收到 tool_result 后更新为结果。

**答案**：

```python
import json
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def stream_agent(user_message: str, tools: list, execute_fn, max_rounds: int = 5):
    messages = [{"role": "user", "content": user_message}]

    for _ in range(max_rounds):
        stream = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
            tool_choice="auto",
            stream=True,
        )

        collected_tool_calls = {}
        content_chunks = []
        has_tool_calls = False

        async for chunk in stream:
            delta = chunk.choices[0].delta

            if delta.content:
                content_chunks.append(delta.content)
                yield {"type": "chunk", "content": delta.content}

            if delta.tool_calls:
                has_tool_calls = True
                for tc_delta in delta.tool_calls:
                    idx = tc_delta.index
                    if idx not in collected_tool_calls:
                        collected_tool_calls[idx] = {
                            "id": tc_delta.id or "",
                            "function": {"name": "", "arguments": ""},
                        }
                    if tc_delta.id:
                        collected_tool_calls[idx]["id"] = tc_delta.id
                    if tc_delta.function:
                        if tc_delta.function.name:
                            collected_tool_calls[idx]["function"]["name"] = tc_delta.function.name
                        if tc_delta.function.arguments:
                            collected_tool_calls[idx]["function"]["arguments"] += tc_delta.function.arguments

        if not has_tool_calls:
            return

        assistant_msg = {
            "role": "assistant",
            "content": "".join(content_chunks) or None,
            "tool_calls": [collected_tool_calls[i] for i in sorted(collected_tool_calls)],
        }
        messages.append(assistant_msg)

        for tc in assistant_msg["tool_calls"]:
            tool_name = tc["function"]["name"]
            tool_args = json.loads(tc["function"]["arguments"])

            yield {"type": "tool_call", "tool": tool_name, "args": tool_args, "status": "running"}

            try:
                result = await asyncio.wait_for(execute_fn(tool_name, tool_args), timeout=30)
            except asyncio.TimeoutError:
                result = json.dumps({"error": "工具执行超时"})
            except Exception as e:
                result = json.dumps({"error": str(e)})

            yield {"type": "tool_result", "tool": tool_name, "result": result, "status": "done"}

            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": result if isinstance(result, str) else json.dumps(result),
            })
```

**要点**：
- 流式 tool_calls 是按 index 分片到达的，必须用 `tc_delta.index` 做拼接，不能直接用列表 append——同一个 tool_call 可能分 5-6 个 chunk 到达
- 常见错误：在 `delta.tool_calls` 回调里直接 `append`，导致一个工具调用被拆成多条记录，执行时报 JSON 解析错误
- 工具执行必须设超时（`asyncio.wait_for`），外部 API 挂掉时不能让整个 Agent 卡死

## 工程建议

- 工具调用必须设置超时（建议 30 秒），外部 API 不响应时要有降级策略，不能让 Agent 无限等待
- 多轮工具调用要设置最大轮数上限（建议 5-10 轮），防止 LLM 陷入工具调用死循环
- 工具返回结果要做长度截断，超长结果会撑爆上下文窗口，建议单次工具结果不超过 2000 token
- 前端要实时展示工具调用过程（参数、结果），这是用户信任 Agent 的关键

## 本节要点

- Function Calling 是 Agent 的核心机制
- 工具调用可能多轮，需要循环处理
- 前端要展示工具调用过程，提升用户信任
- 工具失败要有降级策略，不能让整个 Agent 挂掉

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| LLM 不调用工具 | 工具描述不清楚 | 优化 description |
| 参数格式错误 | JSON Schema 不严格 | 用 strict 模式 |
| 无限循环 | LLM 反复调用同一工具 | 设置 max_tool_rounds |
| 工具超时 | 外部 API 响应慢 | 设置超时和降级 |
