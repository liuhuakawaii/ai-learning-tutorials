# 02 构建第一个多 Agent 图——用 LangGraph 实现 Supervisor 模式

> 用 LangGraph 实现 Supervisor 模式，让理论变成代码。

## 场景引入

你已经了解了 LangGraph 的核心概念：State 定义数据结构，Node 执行逻辑，Edge 定义流转。但"知道概念"和"能写代码"之间还有很大距离。这一课会带你用 LangGraph 从零实现一个 Supervisor 模式的多 Agent 系统，把抽象概念变成可运行的代码。

---

## 学习目标

- 用 LangGraph 实现 Supervisor 模式
- 掌握动态路由的实现方法
- 完成一个可运行的多 Agent 系统

---

## 一、Supervisor 图设计

```
Supervisor 图结构：

START
  │
  ▼
Supervisor ──→ Researcher ──→ END
  │
  ├──→ Analyst ──→ END
  │
  └──→ Writer ──→ END
```

---

## 二、完整实现

```python
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import create_react_agent
from typing import TypedDict, Literal, Annotated
from langchain_openai import ChatOpenAI

# 状态定义
class SupervisorState(TypedDict):
    messages: list
    next_agent: str
    task: str
    results: dict

# Supervisor 节点
def supervisor_node(state: SupervisorState) -> SupervisorState:
    """Supervisor 决策节点"""
    llm = ChatOpenAI(model="gpt-4o")
    
    prompt = f"""你是一个任务 Supervisor。根据当前状态决定下一步应该由哪个 Agent 执行。

当前任务：{state['task']}
已有结果：{json.dumps(state.get('results', {}), ensure_ascii=False)}

可用 Agent：
- researcher: 研究和收集信息
- analyst: 分析数据
- writer: 撰写报告
- FINISH: 任务完成

请决定下一步，只输出 Agent 名称。"""
    
    response = llm.invoke(prompt)
    next_agent = response.content.strip()
    
    return {**state, "next_agent": next_agent}

# Researcher 节点
def researcher_node(state: SupervisorState) -> SupervisorState:
    """研究节点"""
    llm = ChatOpenAI(model="gpt-4o")
    
    prompt = f"""你是研究专家。请收集以下任务的相关信息。

任务：{state['task']}

请提供详细的研究结果。"""
    
    response = llm.invoke(prompt)
    
    results = state.get("results", {})
    results["research"] = response.content
    
    return {**state, "results": results, "next_agent": "supervisor"}

# Analyst 节点
def analyst_node(state: SupervisorState) -> SupervisorState:
    """分析节点"""
    llm = ChatOpenAI(model="gpt-4o")
    
    research = state["results"].get("research", "")
    
    prompt = f"""你是数据分析师。请分析以下研究结果。

研究结果：{research}

请提供深入的分析结论。"""
    
    response = llm.invoke(prompt)
    
    results = state.get("results", {})
    results["analysis"] = response.content
    
    return {**state, "results": results, "next_agent": "supervisor"}

# Writer 节点
def writer_node(state: SupervisorState) -> SupervisorState:
    """写作节点"""
    llm = ChatOpenAI(model="gpt-4o")
    
    analysis = state["results"].get("analysis", "")
    
    prompt = f"""你是写作专家。请根据以下分析撰写报告。

分析：{analysis}

请撰写一份结构清晰的报告。"""
    
    response = llm.invoke(prompt)
    
    results = state.get("results", {})
    results["report"] = response.content
    
    return {**state, "results": results, "next_agent": "supervisor"}

# 路由函数
def route_agent(state: SupervisorState) -> str:
    """路由到下一个 Agent"""
    next_agent = state.get("next_agent", "FINISH")
    
    if next_agent == "FINISH":
        return END
    elif next_agent == "researcher":
        return "researcher"
    elif next_agent == "analyst":
        return "analyst"
    elif next_agent == "writer":
        return "writer"
    else:
        return END

# 构建图
graph = StateGraph(SupervisorState)

graph.add_node("supervisor", supervisor_node)
graph.add_node("researcher", researcher_node)
graph.add_node("analyst", analyst_node)
graph.add_node("writer", writer_node)

graph.set_entry_point("supervisor")

graph.add_conditional_edges("supervisor", route_agent)
graph.add_edge("researcher", "supervisor")
graph.add_edge("analyst", "supervisor")
graph.add_edge("writer", "supervisor")

app = graph.compile()

# 运行
result = app.invoke({
    "messages": [],
    "task": "分析 2024 年 AI 行业的发展趋势",
    "results": {},
    "next_agent": "supervisor"
})

print(result["results"].get("report", "无结果"))
```

---

## 三、执行流程

```
执行流程：

1. Supervisor 分析任务 → 决定使用 researcher
2. Researcher 收集信息 → 返回 supervisor
3. Supervisor 评估结果 → 决定使用 analyst
4. Analyst 分析数据 → 返回 supervisor
5. Supervisor 评估结果 → 决定使用 writer
6. Writer 撰写报告 → 返回 supervisor
7. Supervisor 评估结果 → 决定 FINISH
8. 输出最终报告
```

---


---

## 常见误区

1. **Supervisor 决策返回无效 Agent 名**：路由函数返回了未注册的节点名，导致 KeyError。应该在路由函数中添加兜底逻辑，遇到无效 Agent 名时返回 END 或默认 Agent。
2. **Agent 执行后没有返回 Supervisor**：每个 Agent 执行完毕后需要把 next_agent 设为 "supervisor"，否则 Supervisor 无法继续调度。这是一个常见的流程断裂问题。
3. **状态更新方式不正确**：LangGraph 要求节点返回 State 的更新（字典），而不是修改原始 State。直接修改 state 对象不会触发状态更新。

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

1. 用 LangGraph 实现 Supervisor 模式
2. Supervisor 负责路由决策，Agent 负责具体执行
3. 用条件边实现动态路由
4. 状态在节点间流转，累积结果

---

**下一课**: [子图与嵌套——让 Agent 自身也是一个 LangGraph 图](./03-子图与嵌套.md)
```

---

## 练习

1. **实现题**：运行本课的 Supervisor 示例。

2. **扩展题**：添加一个新的 Agent（如审核 Agent）。

3. **优化题**：改进 Supervisor 的决策逻辑。
