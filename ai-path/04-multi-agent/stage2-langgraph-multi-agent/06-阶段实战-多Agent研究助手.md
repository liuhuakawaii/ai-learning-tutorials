# 阶段实战：用 LangGraph 构建多 Agent 研究助手

> 预计时长：4 小时
> 目标：用 LangGraph 构建一个 Supervisor 模式的研究助手，包含搜索、分析、写作、审核四个 Agent

## 架构决策

为什么选 Supervisor 模式而不是 Sequential？

研究助手的任务是：用户输入一个主题 → 搜索相关信息 → 分析信息 → 撰写报告 → 审核质量。看起来是 Sequential，但实际情况更复杂：
- 搜索结果可能不理想，需要重新搜索（循环）
- 审核可能不通过，需要重写（回退）
- 有些主题只需要搜索+分析，不需要写报告（分支）

这些动态路由需求，Sequential 做不到，Supervisor 可以。

```
用户输入 → Supervisor → 搜索 Agent ─┐
                ↑                    ├→ Supervisor → 分析 Agent ─┐
                │                    │                          ├→ Supervisor → 写作 Agent ─┐
                │                    │                          │                          ├→ Supervisor → 审核 Agent
                │                    │                          │                          │
                └────────────────────┴──────────────────────────┴──────────────────────────┘
                                       Supervisor 根据状态决定下一步
```

## 实现

```python
from typing import TypedDict, Annotated
from operator import add
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI


# ── State 定义 ──

class ResearchState(TypedDict):
    topic: str
    search_results: str
    analysis: str
    draft: str
    review_result: str
    approved: bool
    current_step: str
    step_count: int
    errors: Annotated[list[str], add]


# ── LLM 初始化 ──

llm = ChatOpenAI(model="gpt-4o-mini")  # 用 mini 降低成本


# ── Agent 节点 ──

def search_agent(state: ResearchState) -> dict:
    """搜索 Agent：收集主题相关信息。"""
    topic = state["topic"]
    prompt = f"""你是一个研究搜索专家。针对以下主题，列出 5 个关键搜索方向和每个方向应该找到的核心信息。

主题：{topic}

输出格式：
1. [搜索方向] 需要找到的核心信息
2. ..."""

    response = llm.invoke(prompt)
    return {
        "search_results": response.content,
        "current_step": "supervisor",
        "step_count": state.get("step_count", 0) + 1,
    }


def analysis_agent(state: ResearchState) -> dict:
    """分析 Agent：从搜索结果中提取洞察。"""
    prompt = f"""你是一个数据分析专家。基于以下搜索结果，提取核心洞察。

搜索结果：
{state['search_results']}

输出要求：
1. 列出 3-5 个核心发现
2. 每个发现附带支撑数据
3. 标注信息的可信度（高/中/低）"""

    response = llm.invoke(prompt)
    return {
        "analysis": response.content,
        "current_step": "supervisor",
        "step_count": state.get("step_count", 0) + 1,
    }


def writing_agent(state: ResearchState) -> dict:
    """写作 Agent：基于分析结果撰写报告。"""
    prompt = f"""你是一个技术写作专家。基于以下分析结果撰写一份研究报告。

分析结果：
{state['analysis']}

报告要求：
1. 标题
2. 执行摘要（100 字以内）
3. 核心发现（每个发现一段）
4. 结论与建议
5. 总字数 500-800 字"""

    response = llm.invoke(prompt)
    return {
        "draft": response.content,
        "current_step": "supervisor",
        "step_count": state.get("step_count", 0) + 1,
    }


def review_agent(state: ResearchState) -> dict:
    """审核 Agent：评估报告质量。"""
    prompt = f"""你是一个内容审核专家。评估以下研究报告的质量。

报告：
{state['draft']}

评估维度：
1. 信息准确性（搜索结果是否有支撑）
2. 逻辑连贯性（结论是否从分析中合理推导）
3. 完整性（是否覆盖了搜索结果中的关键信息）
4. 可读性（结构是否清晰，语言是否简洁）

输出：
- 通过/不通过
- 不通过的原因和修改建议"""

    response = llm.invoke(prompt)
    approved = "通过" in response.content and "不通过" not in response.content
    return {
        "review_result": response.content,
        "approved": approved,
        "current_step": "supervisor",
        "step_count": state.get("step_count", 0) + 1,
    }


# ── Supervisor 节点 ──

def supervisor(state: ResearchState) -> dict:
    """Supervisor：决定下一步由谁执行。"""
    step_count = state.get("step_count", 0)

    # 安全阀：防止无限循环
    if step_count >= 10:
        return {"current_step": "FINISH"}

    # 基于状态的规则路由
    if not state.get("search_results"):
        return {"current_step": "searcher"}
    if not state.get("analysis"):
        return {"current_step": "analyst"}
    if not state.get("draft"):
        return {"current_step": "writer"}
    if not state.get("review_result"):
        return {"current_step": "reviewer"}
    if state.get("approved"):
        return {"current_step": "FINISH"}
    # 审核不通过，重写
    return {"current_step": "writer"}


# ── 路由函数 ──

def route_from_supervisor(state: ResearchState) -> str:
    step = state.get("current_step", "FINISH")
    if step == "FINISH":
        return END
    return step


# ── 构建图 ──

graph = StateGraph(ResearchState)

graph.add_node("supervisor", supervisor)
graph.add_node("searcher", search_agent)
graph.add_node("analyst", analysis_agent)
graph.add_node("writer", writing_agent)
graph.add_node("reviewer", review_agent)

graph.set_entry_point("supervisor")

graph.add_conditional_edges("supervisor", route_from_supervisor, {
    "searcher": "searcher",
    "analyst": "analyst",
    "writer": "writer",
    "reviewer": "reviewer",
    END: END,
})

# 所有 Agent 执行完回到 Supervisor
graph.add_edge("searcher", "supervisor")
graph.add_edge("analyst", "supervisor")
graph.add_edge("writer", "supervisor")
graph.add_edge("reviewer", "supervisor")

app = graph.compile()


# ── 运行 ──

if __name__ == "__main__":
    result = app.invoke({
        "topic": "2025 年多 Agent 系统的发展趋势",
        "search_results": "",
        "analysis": "",
        "draft": "",
        "review_result": "",
        "approved": False,
        "current_step": "",
        "step_count": 0,
        "errors": [],
    })

    print("=" * 60)
    print("最终报告：")
    print(result["draft"])
    print("=" * 60)
    print(f"审核结果：{'通过' if result['approved'] else '未通过'}")
    print(f"总步数：{result['step_count']}")
```

## 为什么这样设计

**Supervisor 用规则引擎而不是 LLM**

很多教程让 Supervisor 用 LLM 决策下一步。这在生产环境中通常不值得：
- 增加了一次 LLM 调用的延迟和成本
- LLM 的路由决策不稳定，同样的状态可能路由到不同节点
- 规则引擎可预测、可测试、可调试

什么时候用 LLM 做 Supervisor？当路由逻辑本身很复杂、难以用规则表达时。比如"根据搜索结果的质量决定是重新搜索还是继续分析"——"质量"的判断可能需要 LLM。

**审核不通过时回到 writer 而不是重新开始**

这是一个关键的架构决策。如果审核不通过就回到 searcher 重新搜索，会浪费已经搜索到的信息。回到 writer 意味着：
- 搜索结果保留
- 分析结果保留
- 只重写报告部分

但要注意：如果 writer 反复不通过，可能是分析结果本身有问题。当前的简单规则路由处理不了这种情况，需要更复杂的回退逻辑。

**step_count 安全阀**

多 Agent 系统最容易出现的问题就是死循环。Supervisor 可能因为状态判断逻辑的 bug，反复调度同一个 Agent。step_count 是一个简单但有效的安全措施。

## 验收标准

1. 能完整运行：搜索 → 分析 → 写作 → 审核 → 输出
2. 审核不通过时能自动重写（最多 3 次）
3. step_count 超过限制时能正常终止
4. 输出包含完整的执行轨迹（经过了哪些 Agent、每步的输出）

## 扩展挑战

1. **并行搜索**：让搜索 Agent 同时搜索多个方向，分析 Agent 等所有搜索完成后再执行
2. **用 LLM Supervisor**：把规则引擎换成 LLM 调用，对比两种方式的路由质量
3. **添加人工审批**：在审核 Agent 之后加一个中断点，等待人类确认
