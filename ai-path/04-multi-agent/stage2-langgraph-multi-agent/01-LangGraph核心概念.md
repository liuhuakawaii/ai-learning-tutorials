# LangGraph 核心概念：State、Node、Edge

> 前置知识：stage1 的纯 Python 多 Agent 编排经验
> 预计时长：50 分钟

## 为什么需要 LangGraph

你在 stage1 用纯 Python 实现了三种编排器，遇到了这些问题：
- 状态传递全靠手动管理 Context 对象
- 条件路由全靠 if-else，路由逻辑和业务逻辑混在一起
- 图的结构只存在于你脑子里，代码里看不到
- 没有内置的中断、恢复、持久化机制

LangGraph 就是把这些抽象标准化了。它的核心思想：把 Agent 系统建模为一张有向图，State 在图中流转，Node 做实际工作，Edge 决定下一步去哪里。

## State：流转在图中的数据

State 是一个 TypedDict，定义了图中所有节点共享的数据结构。

```python
from typing import TypedDict, Annotated
from operator import add


class ResearchState(TypedDict):
    query: str
    research: str
    analysis: str
    report: str
    current_step: str
    errors: Annotated[list[str], add]
```

关键设计点：

**Annotated[list[str], add] 的作用**

普通字段的更新是"覆盖"——节点 A 返回 `{"errors": ["err1"]}`，节点 B 返回 `{"errors": ["err2"]}`，最终 errors 只有 `["err2"]`。

加了 `Annotated[list[str], add]` 后，更新变成"追加"——最终 errors 是 `["err1", "err2"]`。

这在多 Agent 场景中很重要：多个 Agent 可能各自产生错误，你需要收集所有错误而不是只保留最后一个。

**State 设计的三种常见模式**

扁平模式——适合简单流水线：
```python
class SimpleState(TypedDict):
    input: str
    output: str
```

分阶段模式——适合多步骤 pipeline，每个步骤有明确的输入输出：
```python
class PipelineState(TypedDict):
    query: str
    search_results: str
    analysis: str
    report: str
    review_feedback: str
```

消息累加模式——适合对话场景：
```python
class ChatState(TypedDict):
    messages: Annotated[list[dict], add]
    current_agent: str
```

选哪种？看数据流的形态。如果每个节点只写一个字段、读前一个节点的输出，用分阶段模式。如果多个节点都要往同一个列表里追加内容，用消息累加模式。

## Node：做实际工作的函数

Node 就是一个函数，接收 State，返回 State 的更新：

```python
def researcher(state: ResearchState) -> dict:
    """只需要返回要更新的字段，不用返回完整 State。"""
    query = state["query"]
    # 实际项目中这里调用搜索 API
    result = f"关于 '{query}' 的研究结果..."
    return {
        "research": result,
        "current_step": "analysis",
    }
```

Node 可以是任何东西：
- LLM 调用（最常见）
- 工具调用（搜索、数据库查询）
- 纯逻辑判断（校验、格式转换）
- 人工审批节点（暂停等待外部输入）

一个容易犯的错误：在 Node 里做太多事。每个 Node 应该只做一件事。如果你发现一个 Node 超过了 50 行代码，考虑拆分。

## Edge：定义执行顺序

### 普通边

无条件跳转，从 A 到 B：

```python
from langgraph.graph import StateGraph, END

graph = StateGraph(ResearchState)
graph.add_node("researcher", researcher)
graph.add_node("analyst", analyst)

# researcher 执行完直接到 analyst
graph.add_edge("researcher", "analyst")
# analyst 执行完结束
graph.add_edge("analyst", END)
```

### 条件边

根据当前 State 决定下一步：

```python
def route_after_research(state: ResearchState) -> str:
    if state.get("errors"):
        return "error_handler"
    if not state.get("research"):
        return END  # 搜索没有结果，直接结束
    return "analyst"

graph.add_conditional_edges(
    "researcher",          # 从哪个节点出发
    route_after_research,  # 路由函数
    {
        "analyst": "analyst",
        "error_handler": "error_handler",
        END: END,
    }
)
```

路由函数的返回值必须是 `add_conditional_edges` 第三个参数的 key 之一。返回值是字符串，不是节点函数——它只是告诉图"下一步去哪里"。

## 完整示例：一个带错误处理的三节点图

```python
from typing import TypedDict, Annotated
from operator import add
from langgraph.graph import StateGraph, END


class PipelineState(TypedDict):
    query: str
    research: str
    analysis: str
    report: str
    current_step: str
    errors: Annotated[list[str], add]


def researcher(state: PipelineState) -> dict:
    query = state["query"]
    if not query.strip():
        return {"errors": ["查询为空"], "current_step": "error"}
    return {
        "research": f"研究结果：关于 '{query}' 的 5 篇核心文献",
        "current_step": "analysis",
    }


def analyst(state: PipelineState) -> dict:
    research = state["research"]
    if "无结果" in research:
        return {"errors": ["研究结果为空"], "current_step": "error"}
    return {
        "analysis": f"分析结论：识别出 3 个核心趋势",
        "current_step": "report",
    }


def reporter(state: PipelineState) -> dict:
    analysis = state["analysis"]
    return {
        "report": f"# 报告\n\n{analysis}\n\n结论：建议采取行动。",
        "current_step": "done",
    }


def error_handler(state: PipelineState) -> dict:
    return {"report": f"处理失败：{'; '.join(state['errors'])}"}


def route_from_researcher(state: PipelineState) -> str:
    if state.get("current_step") == "error":
        return "error_handler"
    return "analyst"


def route_from_analyst(state: PipelineState) -> str:
    if state.get("current_step") == "error":
        return "error_handler"
    return "reporter"


# 构建图
graph = StateGraph(PipelineState)
graph.add_node("researcher", researcher)
graph.add_node("analyst", analyst)
graph.add_node("reporter", reporter)
graph.add_node("error_handler", error_handler)

graph.set_entry_point("researcher")

graph.add_conditional_edges("researcher", route_from_researcher, {
    "analyst": "analyst",
    "error_handler": "error_handler",
})
graph.add_conditional_edges("analyst", route_from_analyst, {
    "reporter": "reporter",
    "error_handler": "error_handler",
})
graph.add_edge("reporter", END)
graph.add_edge("error_handler", END)

app = graph.compile()

# 正常流程
result = app.invoke({
    "query": "2025 年 AI Agent 发展趋势",
    "research": "", "analysis": "", "report": "",
    "current_step": "", "errors": [],
})
print(result["report"])

# 错误流程
result = app.invoke({
    "query": "",
    "research": "", "analysis": "", "report": "",
    "current_step": "", "errors": [],
})
print(result["report"])
```

## State 设计的常见坑

**坑 1：State 字段太多**

超过 10 个字段时，考虑用嵌套 TypedDict 拆分：

```python
class AgentOutputs(TypedDict):
    research: str
    analysis: str
    report: str

class SystemState(TypedDict):
    query: str
    outputs: AgentOutputs
    current_step: str
    errors: Annotated[list[str], add]
```

但嵌套不要太深，2 层就够了。太深说明你的图结构需要重新设计。

**坑 2：忘记给 Annotated 字段初始化**

```python
# 错误：errors 没有初始值
result = app.invoke({"query": "xxx", "research": ""})
# KeyError: 'errors'

# 正确：所有字段都要初始化
result = app.invoke({
    "query": "xxx", "research": "", "analysis": "", "report": "",
    "current_step": "", "errors": [],
})
```

**坑 3：Node 返回了 State 中没有的字段**

LangGraph 会忽略未在 State 中定义的字段，不会报错。如果你发现数据"丢了"，检查是否拼错了字段名。

## 练习

### 练习一：添加可视化节点

在上面的完整示例中，添加一个 `visualizer` 节点，根据 analysis 的内容推荐图表类型：

```python
def visualizer(state: PipelineState) -> dict:
    analysis = state["analysis"]
    # 根据分析内容推荐图表类型
    # 如果包含"趋势"→ 折线图
    # 如果包含"对比"→ 柱状图
    # 如果包含"占比"→ 饼图
    # 默认 → 表格
    ...
```

### 练习二：实现循环图

当前的图是单向的。实现一个"审核→修改→再审核"的循环：

- `reviewer` 节点审核报告，返回 `approved: True/False`
- 如果不通过，回到 `reporter` 节点修改
- 最多循环 3 次

提示：在 State 里加一个 `review_count: int` 字段。

---

## 参考答案

### 练习一

```python
def visualizer(state: PipelineState) -> dict:
    analysis = state.get("analysis", "")
    if "趋势" in analysis:
        chart_type = "折线图"
    elif "对比" in analysis:
        chart_type = "柱状图"
    elif "占比" in analysis:
        chart_type = "饼图"
    else:
        chart_type = "表格"
    return {"report": f"{state.get('report', '')}\n\n推荐使用: {chart_type}"}
```

### 练习二

```python
class ReviewState(TypedDict):
    report: str
    review_approved: bool
    review_count: int
    errors: Annotated[list[str], add]

def reviewer(state: ReviewState) -> dict:
    report = state["report"]
    # 模拟审核逻辑
    approved = len(report) > 100  # 简单的长度检查
    return {
        "review_approved": approved,
        "review_count": state.get("review_count", 0) + 1,
    }

def should_continue(state: ReviewState) -> str:
    if state["review_approved"]:
        return END
    if state["review_count"] >= 3:
        return END  # 最多 3 次
    return "reporter"

graph = StateGraph(ReviewState)
graph.add_node("reporter", reporter)
graph.add_node("reviewer", reviewer)
graph.set_entry_point("reporter")
graph.add_edge("reporter", "reviewer")
graph.add_conditional_edges("reviewer", should_continue, {
    "reporter": "reporter",
    END: END,
})
```
