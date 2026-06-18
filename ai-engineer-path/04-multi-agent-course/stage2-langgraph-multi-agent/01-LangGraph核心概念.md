# 01 LangGraph 核心概念——State / Node / Edge / Conditional Edge

> LangGraph 是 LangChain 团队开发的多 Agent 编排框架。理解它的核心概念，是掌握多 Agent 开发的关键。

## 学习目标

- 理解 LangGraph 的核心概念
- 掌握 State、Node、Edge 的设计方法
- 学会用 LangGraph 构建第一个多 Agent 图

---

## 一、LangGraph 核心概念

```
LangGraph 的核心概念：

1. State（状态）
   - 图中流转的数据
   - 可以是任意 Python 对象
   - 每个节点可以读取和修改状态

2. Node（节点）
   - 执行具体操作的函数
   - 接收状态，返回更新后的状态
   - 可以是 LLM 调用、工具调用、或任意逻辑

3. Edge（边）
   - 连接节点的路径
   - 定义执行顺序
   - 可以是条件分支

4. Conditional Edge（条件边）
   - 根据状态决定下一个节点
   - 实现动态路由
   - 支持复杂的分支逻辑
```

---

## 二、基础示例

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated

# 定义状态
class AgentState(TypedDict):
    messages: list
    current_agent: str
    task: str

# 定义节点
def researcher_node(state: AgentState) -> AgentState:
    """研究节点"""
    task = state["task"]
    # 执行研究
    result = f"研究结果：{task}的相关信息..."
    return {
        **state,
        "messages": state["messages"] + [{"role": "researcher", "content": result}]
    }

def analyst_node(state: AgentState) -> AgentState:
    """分析节点"""
    research = state["messages"][-1]["content"]
    result = f"分析结论：基于{research}的分析..."
    return {
        **state,
        "messages": state["messages"] + [{"role": "analyst", "content": result}]
    }

def writer_node(state: AgentState) -> AgentState:
    """写作节点"""
    analysis = state["messages"][-1]["content"]
    result = f"最终报告：基于{analysis}的报告..."
    return {
        **state,
        "messages": state["messages"] + [{"role": "writer", "content": result}]
    }

# 构建图
graph = StateGraph(AgentState)

# 添加节点
graph.add_node("researcher", researcher_node)
graph.add_node("analyst", analyst_node)
graph.add_node("writer", writer_node)

# 添加边
graph.set_entry_point("researcher")
graph.add_edge("researcher", "analyst")
graph.add_edge("analyst", "writer")
graph.add_edge("writer", END)

# 编译
app = graph.compile()

# 运行
result = app.invoke({
    "messages": [],
    "current_agent": "researcher",
    "task": "分析 AI 行业趋势"
})
```

---

## 三、条件边

```python
def should_continue(state: AgentState) -> str:
    """条件路由"""
    last_message = state["messages"][-1]["content"]
    
    if "需要更多信息" in last_message:
        return "researcher"  # 回到研究节点
    elif "分析完成" in last_message:
        return "writer"  # 去写作节点
    else:
        return END  # 结束

# 添加条件边
graph.add_conditional_edges(
    "analyst",
    should_continue,
    {
        "researcher": "researcher",
        "writer": "writer",
        END: END
    }
)
```

---

## 四、状态管理

```python
from operator import add

class AgentState(TypedDict):
    messages: Annotated[list, add]  # 消息列表，自动累加
    current_agent: str
    task: str
    iteration: int  # 迭代次数

def increment_iteration(state: AgentState) -> AgentState:
    """增加迭代次数"""
    return {**state, "iteration": state["iteration"] + 1}
```

---

## 小结

```
本课核心要点：

1. LangGraph 核心概念：State、Node、Edge、Conditional Edge
2. State 是图中流转的数据，Node 是执行操作的函数
3. Edge 定义执行顺序，Conditional Edge 实现动态路由
4. 用 TypedDict 定义状态，用 add_edge/add_conditional_edges 连接节点

下一课：构建第一个多 Agent 图——用 LangGraph 实现 Supervisor 模式。
```

---

## 练习

1. **概念题**：解释 LangGraph 中 State、Node、Edge 的作用。

2. **实现题**：用 LangGraph 构建一个 3 节点的顺序图。

3. **条件题**：添加一个条件边，根据状态决定路由。
