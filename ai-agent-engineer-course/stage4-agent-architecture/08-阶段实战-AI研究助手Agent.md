# 08 阶段实战：AI 研究助手 Agent

> 构建一个能自主完成研究任务的 Agent——从搜索到分析到报告，全程自动化。

## 学习目标

- 整合阶段 4 所有技能，构建完整的 AI 研究助手
- 实现多工具调用、状态管理、记忆系统、多 Agent 协作
- 体验 Agent 从设计到实现的完整过程

## 实战任务

构建 **AI 研究助手 Agent**：

### 功能清单

1. **工具调用**
   - 搜索知识库和互联网
   - 查询数据库
   - 文件操作（读写）
   - API 调用

2. **状态管理**
   - Agent 执行状态追踪
   - 断点恢复
   - 人工确认

3. **记忆系统**
   - 短期记忆（会话内）
   - 长期记忆（跨会话）
   - 用户画像

4. **多 Agent 协作**
   - 研究员 Agent（收集资料）
   - 分析师 Agent（分析数据）
   - 写手 Agent（撰写报告）

## 核心实现

### 1. Agent 配置

```python
RESEARCH_AGENT_PROMPT = """你是一个专业的研究助手 Agent。

## 能力
1. 搜索知识库和互联网获取信息
2. 分析数据并提炼洞察
3. 撰写结构化的研究报告
4. 引用来源并标注置信度

## 工作流程
1. 理解研究主题
2. 制定研究计划
3. 搜索和收集资料
4. 分析和整理信息
5. 撰写研究报告
6. 审核和完善

## 输出规范
- 所有结论必须有数据支持
- 引用来源必须标注
- 区分事实和推测
- 报告结构：摘要、背景、分析、结论、建议"""
```

### 2. 完整 Agent 服务

```python
class ResearchAgentService:
    """研究助手 Agent"""
    
    def __init__(self, llm: LLMService, tools: ToolRegistry, memory: MemorySystem):
        self.llm = llm
        self.tools = tools
        self.memory = memory
        self.state_manager = AgentStateManager()
    
    async def research(
        self,
        task: str,
        user_id: str,
        session_id: str,
    ) -> AsyncGenerator[dict, None]:
        # 1. 加载用户记忆
        user_profile = await self.memory.long_term.recall(user_id, "用户画像")
        short_term = await self.memory.short_term.get_recent(session_id, 10)
        
        # 2. 构建上下文
        context = self._build_context(task, user_profile, short_term)
        
        # 3. 运行 Agent
        execution = AgentExecution(agent_id="research", task=task)
        
        messages = [
            {"role": "system", "content": RESEARCH_AGENT_PROMPT},
            {"role": "user", "content": context},
        ]
        
        for step in range(10):  # 最多 10 步
            # 调用 LLM
            response = await self.llm.chat(
                messages, model="gpt-4o",
                tools=self.tools.to_openai_tools(),
            )
            
            if response.tool_calls:
                # 工具调用
                for tc in response.tool_calls:
                    yield {"type": "tool_call", "tool": tc.function.name, "args": json.loads(tc.function.arguments)}
                    
                    tool = self.tools.get(tc.function.name)
                    result = await tool.execute(**json.loads(tc.function.arguments))
                    
                    yield {"type": "tool_result", "tool": tc.function.name, "result": result.to_observation()}
                    
                    messages.append({"role": "tool", "tool_call_id": tc.id, "content": result.to_observation()})
            else:
                # 最终回答
                yield {"type": "final_answer", "content": response.content}
                
                # 保存到记忆
                await self.memory.short_term.add(session_id, {"role": "assistant", "content": response.content})
                await self.memory.long_term.store(user_id, f"研究主题：{task}\n研究结论：{response.content[:500]}", "fact")
                
                break
```

### 3. 前端展示

```vue
<template>
  <div class="research-agent">
    <div class="task-input">
      <n-input v-model:value="task" type="textarea" placeholder="输入研究主题..." />
      <n-button type="primary" @click="startResearch" :loading="isRunning">
        开始研究
      </n-button>
    </div>

    <div class="execution-log">
      <div v-for="event in events" :key="event.id" :class="['event', event.type]">
        <div v-if="event.type === 'tool_call'" class="tool-call">
          <n-tag type="info">调用工具</n-tag>
          <span>{{ event.tool }}</span>
          <n-code :code="JSON.stringify(event.args, null, 2)" language="json" />
        </div>
        <div v-else-if="event.type === 'tool_result'" class="tool-result">
          <n-tag type="success">工具结果</n-tag>
          <pre>{{ event.result }}</pre>
        </div>
        <div v-else-if="event.type === 'final_answer'" class="final-answer">
          <n-tag type="warning">研究结论</n-tag>
          <div v-html="renderMarkdown(event.content)" />
        </div>
      </div>
    </div>
  </div>
</template>
```

## 验收标准

### 功能验收

- [ ] Agent 能根据任务自动选择和调用工具
- [ ] 支持多轮工具调用（搜索 → 分析 → 报告）
- [ ] Agent 状态可追踪（运行中、等待确认、完成、失败）
- [ ] 用户画像和记忆正常工作
- [ ] 前端展示工具调用过程

### 质量验收

- [ ] 研究报告有引用来源
- [ ] Agent 不会陷入无限循环
- [ ] 工具调用失败有降级策略
- [ ] 代码结构清晰，职责分离

## 本阶段总结

通过阶段 4，你已经掌握了：

- Agent 的设计范式（ReAct、Plan-and-Execute）
- 工具设计规范和 Function Calling
- MCP 协议和工具生态
- Agent 状态管理和断点恢复
- 短期记忆和长期记忆
- 多 Agent 协作模式

阶段 5 将构建可视化工作流引擎——让非开发人员也能编排复杂的 AI 任务。
