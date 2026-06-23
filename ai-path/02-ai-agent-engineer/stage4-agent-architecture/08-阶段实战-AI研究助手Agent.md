# 08 阶段实战：AI 研究助手 Agent

> 构建一个能自主完成研究任务的 Agent——从搜索到分析到报告，全程自动化。

前面七节课学了 Agent 设计哲学、工具设计、Function Calling、MCP 协议、状态机、记忆系统和多 Agent 协作。现在要整合成一个完整产品：用户输入研究主题，Agent 自主搜索资料、分析数据、撰写报告。

这个研究助手是毕业项目 Agent 系统的原型——后面的工具调用、状态管理、记忆系统都会复用这里的实现。

## 架构设计

研究助手采用 Plan-and-Execute 范式，由三个 Agent 协作完成：

```
用户输入研究主题
    ↓
规划 Agent：制定研究计划（搜索什么、分析什么、怎么写报告）
    ↓
研究员 Agent：执行搜索，收集资料
    ↓
写手 Agent：基于资料撰写报告
    ↓
返回研究报告（带引用来源）
```

Supervisor Agent 负责协调三个 Agent 的执行顺序和上下文传递。

## 工具体系

研究助手需要这些工具：

```python
tools = [
    Tool("search_knowledge_base", "搜索企业知识库", search_kb),
    Tool("search_web", "搜索互联网", search_web),
    Tool("query_database", "查询数据库", query_db),
    Tool("read_file", "读取文件内容", read_file),
    Tool("write_file", "写入文件", write_file),
]
```

工具注册表在阶段 2 已经实现，这里直接用。每个工具返回结果时必须附带来源元数据（URL、文档名、页码），这是引用溯源的基础。

## Agent 服务

```python
class ResearchAgentService:
    def __init__(self, llm, tools, memory):
        self.llm = llm
        self.tools = tools
        self.memory = memory
    
    async def research(self, task: str, user_id: str, session_id: str):
        # 1. 加载用户记忆（偏好、历史研究）
        user_profile = await self.memory.long_term.recall(user_id, "用户画像")
        
        # 2. 制定研究计划
        plan = await self._create_plan(task, user_profile)
        yield {"type": "plan", "steps": plan["steps"]}
        
        # 3. 逐步执行
        results = []
        for i, step in enumerate(plan["steps"]):
            yield {"type": "step_start", "step": step, "index": i}
            
            # 调用工具
            tool = self.tools.get(step["action"])
            result = await tool.execute(**step["input"])
            results.append({"step": step, "result": result})
            
            yield {"type": "step_result", "result": result}
        
        # 4. 综合结果生成报告
        report = await self._generate_report(task, results)
        yield {"type": "report", "content": report}
        
        # 5. 保存到记忆
        await self.memory.short_term.add(session_id, {"role": "assistant", "content": report})
        await self.memory.long_term.store(user_id, f"研究主题：{task}\n结论：{report[:500]}", "fact")
```

注意每一步都 yield 事件——前端可以实时展示 Agent 的思考和执行过程，而不是等到最后才看到结果。

## 前端：Agent 执行可视化

用户需要看到 Agent 在做什么。不是黑盒，而是透明的执行过程：

```vue
<template>
  <div class="research-agent">
    <n-input v-model="task" type="textarea" placeholder="输入研究主题..." />
    <n-button @click="startResearch" :loading="isRunning">开始研究</n-button>

    <div class="execution-log">
      <div v-for="event in events" :key="event.id" :class="['event', event.type]">
        <div v-if="event.type === 'plan'">
          <n-tag type="info">研究计划</n-tag>
          <n-steps :current="currentStep">
            <n-step v-for="(step, i) in event.steps" :key="i" :title="step.purpose" />
          </n-steps>
        </div>
        <div v-else-if="event.type === 'step_start'">
          <n-tag type="warning">执行中</n-tag>
          <span>{{ event.step.purpose }}</span>
        </div>
        <div v-else-if="event.type === 'step_result'">
          <n-tag type="success">完成</n-tag>
          <pre>{{ event.result }}</pre>
        </div>
        <div v-else-if="event.type === 'report'">
          <n-tag type="error">研究报告</n-tag>
          <div v-html="renderMarkdown(event.content)" />
        </div>
      </div>
    </div>
  </div>
</template>
```

前端通过 SSE 接收事件流，实时渲染每个步骤。用户看到的不是"正在加载..."，而是"正在搜索资料 → 正在分析数据 → 正在撰写报告"。

## 状态管理

Agent 执行可能需要几分钟。如果用户关闭页面再回来，需要能恢复执行状态：

```python
class AgentStateManager:
    async def save_state(self, execution_id: str, state: dict):
        await redis.set(f"agent:{execution_id}", json.dumps(state), ex=3600)
    
    async def load_state(self, execution_id: str) -> dict | None:
        data = await redis.get(f"agent:{execution_id}")
        return json.loads(data) if data else None
    
    async def pause(self, execution_id: str):
        state = await self.load_state(execution_id)
        state["status"] = "paused"
        await self.save_state(execution_id, state)
    
    async def resume(self, execution_id: str):
        state = await self.load_state(execution_id)
        state["status"] = "running"
        # 从上次暂停的步骤继续执行
```

状态存在 Redis 里，1 小时过期。复杂任务可能需要持久化到数据库。

## 练习

### 练习 1：实现研究助手

1. 注册 3 个工具（搜索、数据库查询、文件操作）
2. 实现 Plan-and-Execute 流程
3. 前端展示执行过程

### 练习 2：多 Agent 协作

1. 实现 Supervisor Agent，协调研究员和写手
2. 研究员搜索资料，写手基于资料写报告
3. Supervisor 在关键步骤插入人工确认

### 练习 3：记忆系统

1. 实现短期记忆（会话内上下文）
2. 实现长期记忆（跨会话用户偏好）
3. 研究助手根据用户画像调整研究方向

## 验收标准

- Agent 能根据任务自动选择和调用工具
- 支持多轮工具调用（搜索 → 分析 → 报告）
- 前端实时展示 Agent 执行过程
- 研究报告有引用来源
- Agent 不会陷入无限循环（最大步骤数限制）
- 记忆系统能跨会话保持用户偏好

## 这个阶段结束后

你的 AI 应用有了"自主行动"的能力——不只是回答问题，而是规划任务、调用工具、完成工作。阶段 5 会构建可视化工作流引擎，让非开发人员也能编排复杂的 AI 任务。
