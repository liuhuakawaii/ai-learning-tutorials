# 03 Function Calling 实战

> Function Calling 是让 LLM "会用工具"的桥梁。

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

## 本节要点

- Function Calling 是 Agent 的核心机制
- 工具调用可能多轮，需要循环处理
- 前端要展示工具调用过程，提升用户信任
- 工具失败要有降级策略，不能让整个 Agent 挂掉

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| LLM 不调用工具 | 工具描述不清楚 | 优化 description |
| 参数格式错误 | JSON Schema 不严格 | 用 strict 模式 |
| 无限循环 | LLM 反复调用同一工具 | 设置 max_tool_rounds |
| 工具超时 | 外部 API 响应慢 | 设置超时和降级 |
