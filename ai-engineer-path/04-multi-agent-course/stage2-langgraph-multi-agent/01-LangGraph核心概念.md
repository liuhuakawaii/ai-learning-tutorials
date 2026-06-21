# 第 1 课：LangGraph 核心概念——State / Node / Edge / Conditional Edge

> **课程定位**：掌握 LangGraph 的核心抽象，为多 Agent 编排打下基础
> **前置知识**：02-ai-agent-engineer-course 的 Agent 开发经验
> **预计时长**：50 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 画出 LangGraph 的 State → Node → Edge 执行流程
2. 用 TypedDict 定义 State 并理解 Annotated 的作用
3. 实现一个带条件边的多 Agent 图
4. 说出 State 设计的三种常见模式

---

## 一、LangGraph 是什么

```
LangGraph = LangChain 团队开发的图编排框架

核心思想：
  把 Agent 系统抽象成一个"有向图"
  - Node = 做事情的函数
  - Edge = 事情之间的连接
  - State = 在图中流转的数据

  ┌─────────────────────────────────────────────────────────┐
  │                    LangGraph 执行模型                    │
  │                                                         │
  │  State ──→ Node A ──→ Edge ──→ Node B ──→ Edge ──→ END  │
  │    │         │                    │                     │
  │    │         ▼                    ▼                     │
  │    │      修改 State           修改 State               │
  │    │         │                    │                     │
  │    └─────────┴────────────────────┘                     │
  │              State 在节点间传递                           │
  └─────────────────────────────────────────────────────────┘

类比：
  State = 流水线上的产品
  Node  = 流水线上的工位
  Edge  = 工位之间的传送带
  Conditional Edge = 质检站（根据质量决定去哪个工位）
```

---

## 二、State（状态）

### 2.1 定义 State

```python
from typing import TypedDict, Annotated
from operator import add

class AgentState(TypedDict):
    """Agent 图的状态定义。"""
    messages: Annotated[list[dict], add]  # 消息列表，自动累加
    query: str                             # 用户查询
    sql: str                               # 生成的 SQL
    result: str                            # 查询结果
    analysis: str                          # 分析结论
    current_agent: str                     # 当前所在节点
    error: str                             # 错误信息
```

### 2.2 Annotated 的作用

```
Annotated[list, add] 的含义：

  普通 list：
    节点 A 返回 {"messages": [msg1]}
    节点 B 返回 {"messages": [msg2]}
    最终 State["messages"] = [msg2]  ← 被覆盖了！

  Annotated[list, add]：
    节点 A 返回 {"messages": [msg1]}
    节点 B 返回 {"messages": [msg2]}
    最终 State["messages"] = [msg1, msg2]  ← 自动累加！

  ┌─────────────────────────────────────────────────────────┐
  │  reducer 函数决定了多个节点返回同名字段时如何合并          │
  │                                                         │
  │  add        → 列表拼接                                   │
  │  无 reducer → 后者覆盖前者                                │
  │  自定义     → 任何合并逻辑                                │
  └─────────────────────────────────────────────────────────┘
```

### 2.3 State 设计模式

```
模式 1：扁平 State（简单场景）

  class SimpleState(TypedDict):
      input: str
      output: str
      step: str

  适用：2-3 个节点的简单流水线

模式 2：消息累加 State（对话场景）

  class ChatState(TypedDict):
      messages: Annotated[list, add]
      current_agent: str

  适用：多 Agent 对话系统

模式 3：分阶段 State（复杂 pipeline）

  class PipelineState(TypedDict):
      query: str
      sql: str
      query_result: str
      analysis: str
      visualization: str
      report: str
      current_agent: str
      error: str

  适用：多阶段数据分析 pipeline
```

---

## 三、Node（节点）

### 3.1 节点函数签名

```python
def my_node(state: AgentState) -> AgentState:
    """
    节点函数的规则：
    1. 输入：当前 State
    2. 输出：State 的更新（可以只返回修改的字段）
    3. 可以是同步或异步
    """
    # 读取 State
    query = state["query"]

    # 执行操作
    result = do_something(query)

    # 返回更新（只需返回要修改的字段）
    return {"result": result, "current_agent": "my_node"}
```

### 3.2 节点类型

```
节点可以是任何函数：

1. LLM 调用节点
   async def llm_node(state):
       response = await llm.ainvoke(state["messages"])
       return {"messages": [response]}

2. 工具调用节点
   def tool_node(state):
       result = execute_tool(state["tool_name"], state["tool_input"])
       return {"tool_result": result}

3. 纯逻辑节点
   def validate_node(state):
       if not state["sql"].strip().upper().startswith("SELECT"):
           return {"error": "仅允许 SELECT 查询"}
       return {}

4. 人工审批节点
   async def human_approval_node(state):
       approved = await ask_human(state["report"])
       return {"approved": approved}
```

---

## 四、Edge（边）

### 4.1 普通边

```python
# 从 researcher 到 analyst（无条件）
graph.add_edge("researcher", "analyst")

# 从 report 到结束
graph.add_edge("report", END)
```

### 4.2 条件边

```python
def should_continue(state: AgentState) -> str:
    """根据状态决定下一个节点。"""
    if state.get("error"):
        return END
    if state["current_agent"] == "query":
        return "analysis"
    elif state["current_agent"] == "analysis":
        return "visualization"
    elif state["current_agent"] == "visualization":
        return "report"
    else:
        return END

# 添加条件边
graph.add_conditional_edges(
    "query",           # 源节点
    should_continue,   # 路由函数
    {
        "analysis": "analysis",
        "visualization": "visualization",
        END: END,
    }
)
```

### 4.3 条件边的路由逻辑

```
┌─────────────────────────────────────────────────────────┐
│                    条件边执行流程                         │
│                                                         │
│  Node A 执行完毕                                         │
│       │                                                 │
│       ▼                                                 │
│  调用 should_continue(state)                             │
│       │                                                 │
│       ├── 返回 "B" ──→ 执行 Node B                      │
│       ├── 返回 "C" ──→ 执行 Node C                      │
│       └── 返回 END ──→ 图执行结束                        │
│                                                         │
│  关键：路由函数只返回字符串（节点名），不执行节点           │
└─────────────────────────────────────────────────────────┘
```

---

## 五、完整示例

```python
"""
完整的 LangGraph 多 Agent 示例。
包含 State 定义、4 个节点、条件边、错误处理。
"""
from typing import TypedDict, Annotated
from operator import add
from langgraph.graph import StateGraph, END


class AgentState(TypedDict):
    messages: Annotated[list[str], add]
    query: str
    sql: str
    result: str
    analysis: str
    current_agent: str
    error: str


def query_node(state: AgentState) -> dict:
    """查询节点：生成 SQL 并执行。"""
    query = state["query"]

    if "部门" in query:
        sql = "SELECT * FROM departments"
    elif "员工" in query:
        sql = "SELECT * FROM employees"
    else:
        return {"error": f"无法理解查询: {query}", "current_agent": "error"}

    result = f"[Mock] 执行 {sql}，返回 5 条记录"
    return {
        "sql": sql,
        "result": result,
        "current_agent": "analysis",
        "messages": [f"[查询] {sql}"],
    }


def analysis_node(state: AgentState) -> dict:
    """分析节点：分析查询结果。"""
    analysis = f"基于 {state['result']} 的分析：数据趋势良好"
    return {
        "analysis": analysis,
        "current_agent": "report",
        "messages": [f"[分析] {analysis}"],
    }


def report_node(state: AgentState) -> dict:
    """报告节点：生成最终报告。"""
    report = f"# 分析报告\n\n查询: {state['sql']}\n分析: {state['analysis']}"
    return {
        "messages": [f"[报告] {report}"],
        "current_agent": "done",
    }


def error_node(state: AgentState) -> dict:
    """错误处理节点。"""
    return {
        "messages": [f"[错误] {state.get('error', '未知错误')}"],
        "current_agent": "done",
    }


def route_after_query(state: AgentState) -> str:
    """查询后的路由。"""
    if state.get("error"):
        return "error"
    return "analysis"


def route_after_analysis(state: AgentState) -> str:
    """分析后的路由。"""
    if state.get("error"):
        return "error"
    return "report"


# 构建图
graph = StateGraph(AgentState)

graph.add_node("query", query_node)
graph.add_node("analysis", analysis_node)
graph.add_node("report", report_node)
graph.add_node("error", error_node)

graph.set_entry_point("query")

graph.add_conditional_edges("query", route_after_query, {
    "analysis": "analysis",
    "error": "error",
})
graph.add_conditional_edges("analysis", route_after_analysis, {
    "report": "report",
    "error": "error",
})
graph.add_edge("report", END)
graph.add_edge("error", END)

app = graph.compile()

# 运行
result = app.invoke({
    "messages": [],
    "query": "各部门的预算和人数",
    "sql": "", "result": "", "analysis": "",
    "current_agent": "", "error": "",
})

print("最终消息:")
for msg in result["messages"]:
    print(f"  {msg}")
```

---

## 六、常见错误

```
错误 1：State 字段类型不匹配
  症状：运行时报 TypeError
  原因：TypedDict 定义了 str，但节点返回了 int
  解决：确保返回值类型与 State 定义一致

错误 2：忘记处理 error 字段
  症状：错误发生后图继续执行后续节点
  原因：条件边没有检查 error
  解决：每个条件边都先检查 error

错误 3：Annotated 误用
  症状：消息列表被覆盖而不是累加
  原因：忘记加 Annotated[list, add]
  解决：需要累加的字段必须用 Annotated

错误 4：条件边返回不存在的节点名
  症状：运行时报 KeyError
  原因：路由函数返回了未注册的节点名
  解决：确保返回值在 add_conditional_edges 的映射中

错误 5：忘记 set_entry_point
  症状：图不知道从哪里开始执行
  原因：没有设置入口节点
  解决：必须调用 graph.set_entry_point("node_name")
```

---

## 小结

```
本课核心要点：

1. LangGraph = State + Node + Edge 的有向图
2. State 用 TypedDict 定义，Annotated 控制字段合并行为
3. Node 是接收 State、返回更新的函数
4. Edge 定义执行顺序，Conditional Edge 实现动态路由
5. 设计 State 时考虑：扁平 vs 消息累加 vs 分阶段

---

**下一课**: [构建第一个多 Agent 图——用 LangGraph 实现 Supervisor 模式](./02-构建第一个多Agent图.md)
```

---

## 练习

1. **概念题**：画出一个 4 节点 LangGraph 图，标注 State 流转方向和 Conditional Edge 的路由逻辑。

2. **实现题**：扩展上面的完整示例，添加一个"可视化节点"，根据 analysis 的内容推荐图表类型（柱状图/折线图/饼图）。

3. **调试题**：故意在条件边中返回一个不存在的节点名，观察报错信息，理解错误处理的重要性。
