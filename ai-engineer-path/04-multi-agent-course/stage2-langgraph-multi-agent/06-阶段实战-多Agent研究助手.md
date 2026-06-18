# 06 阶段实战——用 LangGraph 构建一个多 Agent 研究助手

> 把前 5 课学到的 LangGraph 知识整合成一个完整的研究助手。

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
