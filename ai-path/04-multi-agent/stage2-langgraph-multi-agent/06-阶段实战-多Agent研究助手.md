# 06 阶段实战——用 LangGraph 构建一个多 Agent 研究助手

> 把前 5 课学到的 LangGraph 知识整合成一个完整的研究助手。

## 场景引入

你已经掌握了 LangGraph 的 State、Node、Edge、子图、状态管理和错误处理。现在需要把这些知识整合成一个完整的产品：一个能搜索资料、分析数据、撰写报告、自我审核的多 Agent 研究助手。这个实战项目会让你真正理解如何用 LangGraph 构建生产级多 Agent 系统。

---

## 学习目标

- 用 LangGraph 构建完整的研究助手
- 集成搜索、分析、写作、审核四个 Agent
- 输出一个可运行的多 Agent 系统

---

## 一、系统架构

```
研究助手架构：

用户输入
    │
    ▼
Supervisor ──→ 搜索 Agent ──→ 分析 Agent ──→ 写作 Agent ──→ 审核 Agent
    │                                                           │
    └───────────────────── 最终输出 ←──────────────────────────┘
```

---

## 二、完整实现

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
from langchain_openai import ChatOpenAI

class ResearchState(TypedDict):
    messages: list
    task: str
    research: str
    analysis: str
    report: str
    review: str
    next_agent: str

def supervisor(state: ResearchState) -> ResearchState:
    """Supervisor 决策"""
    llm = ChatOpenAI(model="gpt-4o")
    
    prompt = f"""决定下一步应该由哪个 Agent 执行。

任务：{state['task']}
当前状态：research={bool(state.get('research'))}, analysis={bool(state.get('analysis'))}, report={bool(state.get('report'))}

可用 Agent：searcher, analyst, writer, reviewer, FINISH
只输出 Agent 名称。"""
    
    response = llm.invoke(prompt)
    return {**state, "next_agent": response.content.strip()}

def searcher(state: ResearchState) -> ResearchState:
    """搜索 Agent"""
    llm = ChatOpenAI(model="gpt-4o")
    response = llm.invoke(f"搜索以下主题的相关信息：{state['task']}")
    return {**state, "research": response.content, "next_agent": "supervisor"}

def analyst(state: ResearchState) -> ResearchState:
    """分析 Agent"""
    llm = ChatOpenAI(model="gpt-4o")
    response = llm.invoke(f"分析以下研究结果：{state['research']}")
    return {**state, "analysis": response.content, "next_agent": "supervisor"}

def writer(state: ResearchState) -> ResearchState:
    """写作 Agent"""
    llm = ChatOpenAI(model="gpt-4o")
    response = llm.invoke(f"根据以下分析撰写报告：{state['analysis']}")
    return {**state, "report": response.content, "next_agent": "supervisor"}

def reviewer(state: ResearchState) -> ResearchState:
    """审核 Agent"""
    llm = ChatOpenAI(model="gpt-4o")
    response = llm.invoke(f"审核以下报告的质量：{state['report']}")
    return {**state, "review": response.content, "next_agent": "supervisor"}

def route(state: ResearchState) -> str:
    """路由函数"""
    next_agent = state.get("next_agent", "FINISH")
    if next_agent == "FINISH":
        return END
    return next_agent

# 构建图
graph = StateGraph(ResearchState)
graph.add_node("supervisor", supervisor)
graph.add_node("searcher", searcher)
graph.add_node("analyst", analyst)
graph.add_node("writer", writer)
graph.add_node("reviewer", reviewer)

graph.set_entry_point("supervisor")
graph.add_conditional_edges("supervisor", route)
graph.add_edge("searcher", "supervisor")
graph.add_edge("analyst", "supervisor")
graph.add_edge("writer", "supervisor")
graph.add_edge("reviewer", "supervisor")

app = graph.compile()

# 运行
result = app.invoke({
    "messages": [],
    "task": "分析 2024 年 AI 行业的发展趋势",
    "research": "",
    "analysis": "",
    "report": "",
    "review": "",
    "next_agent": "supervisor"
})

print(result["report"])
```

---

## 三、运行效果

```
[Supervisor] 决定：searcher
[searcher] 搜索中...
[Supervisor] 决定：analyst
[analyst] 分析中...
[Supervisor] 决定：writer
[writer] 撰写中...
[Supervisor] 决定：reviewer
[reviewer] 审核中...
[Supervisor] 决定：FINISH

最终报告：
2024 年 AI 行业呈现以下主要趋势：
1. 多模态 AI 快速发展...
2. Agent 技术逐渐成熟...
3. 开源模型持续进步...
```

---


---

## 常见误区

1. **Supervisor 决策逻辑过于简单**：如果 Supervisor 只是按固定顺序调用 Agent，那和 Sequential Pipeline 没有区别。Supervisor 应该根据当前状态（哪些 Agent 已完成、结果质量如何）动态决策。
2. **没有中间结果验证**：Agent 之间只传递结果，不验证结果质量。搜索 Agent 返回了空结果，分析 Agent 还是照常分析，最终输出一堆废话。应该在每个 Agent 之后添加结果验证逻辑。
3. **忽略 Token 成本控制**：每个 Agent 都调用 GPT-4o，一轮下来可能消耗几万个 Token。对于简单任务，某些 Agent 可以用更便宜的模型。根据任务复杂度选择合适的模型。

---

## 工程建议

1. **从单 Agent 开始，按需演进**：先用单 Agent 验证核心逻辑，当遇到上下文瓶颈、能力稀释或需要并行处理时，再拆分为多 Agent。不要为了"看起来高级"而引入多 Agent 架构。
2. **为每个 Agent 定义清晰的职责边界**：每个 Agent 应该有单一、明确的职责（如"只负责搜索""只负责分析"），输入输出格式在设计阶段就确定下来，避免职责重叠和数据格式混乱。
3. **建立可观测性基础设施**：从第一版开始就为每个 Agent 添加结构化日志和追踪机制，记录输入、输出、耗时、错误。多 Agent 系统的调试难度远高于单 Agent，没有日志就是在"盲人摸象"。
4. **在关键决策节点加入人工审批**：涉及高风险操作（删除数据、发送消息、支付）和不可逆操作时，使用 Human-in-the-loop 机制暂停执行，等待人类确认后再继续。

---

## 小结

```
本课核心要点：

1. 用 LangGraph 构建完整的研究助手
2. Supervisor 负责路由，Agent 负责执行
3. 状态在节点间流转，累积结果
4. 从简单开始，逐步增加复杂度

阶段总结：
  你已经掌握了用 LangGraph 构建多 Agent 系统。
  下一阶段，我们将学习 Agent 间的通信与记忆。
```

---

## 作业

1. **完成实战**：运行本课的研究助手。

2. **扩展题**：添加一个总结 Agent，在最后生成执行摘要。

3. **优化题**：改进 Supervisor 的决策逻辑，提高执行效率。
