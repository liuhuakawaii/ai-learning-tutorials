# Human-in-the-loop 设计哲学：什么环节需要人类介入

> 前置知识：stage1-3 的多 Agent 编排和通信经验
> 预计时长：40 分钟

## 一个真实的事故

2024 年，某公司的客服 Agent 系统在没有人工审批的情况下，自动给 2000 多个用户发送了"您的账户将被永久关闭"的邮件。原因是：一个用户提交了"请关闭我的账户"的请求，Agent 的搜索环节把"关闭"关联到了所有用户账户，写作 Agent 生成了群发邮件，系统直接执行了。

事后复盘，问题不在于 AI 犯了错，而在于系统没有在"发送邮件"这个不可逆操作前停下来让人确认。

Human-in-the-loop 不是"不信任 AI"，而是"在正确的地方信任人类"。

## 哪些环节需要人类介入

不是所有环节都需要。介入太多，系统变成人工审批流水线，效率还不如不用 AI。介入太少，风险不可控。

用两个维度判断：**可逆性**和**影响范围**。

```
                    影响范围大
                        │
         ┌──────────────┼──────────────┐
         │   必须审批    │   需要审批    │
         │   (不可逆+大) │   (可逆+大)  │
         │              │              │
  不可逆 ─┼──────────────┼──────────────┼─ 可逆
         │   建议审批    │   通常不需要  │
         │   (不可逆+小) │   (可逆+小)  │
         │              │              │
         └──────────────┼──────────────┘
                        │
                    影响范围小
```

具体场景：

**必须审批**：删除数据、发送外部邮件/消息、支付操作、权限变更、发布内容到生产环境

**建议审批**：修改用户数据、生成法律/财务文档、Agent 置信度低于阈值的输出

**通常不需要**：搜索信息、内部数据分析、生成草稿、格式转换

## 五种介入模式

### 1. 审批模式（Approval）

Agent 提出方案 → 人类审批 → 执行。最常见，适合高风险操作。

```
Agent: "建议删除以下 50 条过期记录..."
人类: "批准" / "拒绝" / "只删除前 10 条"
```

### 2. 确认模式（Confirmation）

Agent 准备执行 → 人类确认 → 执行。比审批轻量，适合"我知道你要做什么，确认一下"。

```
Agent: "即将向用户发送通知邮件"
人类: "确认" / "等等，先别发"
```

### 3. 选择模式（Selection）

Agent 提供多个选项 → 人类选择 → 执行。适合有多个合理方案时。

```
Agent: "分析出 3 种定价策略：
  A. 低价渗透（适合新市场）
  B. 高价差异化（适合高端定位）
  C. 动态定价（适合竞争激烈场景）"
人类: "选 B"
```

### 4. 修改模式（Modification）

Agent 生成结果 → 人类修改 → 使用。适合输出需要人工润色的场景。

```
Agent: "生成了新闻稿草稿..."
人类: "第二段改成..."
```

### 5. 监督模式（Oversight）

Agent 持续执行 → 人类监督 → 必要时介入。适合长时间运行的任务。

```
Agent: [正在处理 1000 条数据，已完成 300 条]
人类: "暂停，第 150 条的处理结果有问题"
```

## 什么时候用哪种模式

选择标准不是"这个操作有多重要"，而是"人类介入能带来多少增量价值"。

- 如果 Agent 的输出 99% 是对的，1% 是错的，但那 1% 的后果很严重 → 审批模式
- 如果 Agent 的输出经常需要微调 → 修改模式
- 如果有多个合理方案，选哪个取决于业务判断 → 选择模式
- 如果任务执行时间很长，中间可能需要调整 → 监督模式

## 在 LangGraph 中实现中断

LangGraph 提供了 `interrupt_before` 和 `interrupt_after` 机制，可以在指定节点前/后暂停图的执行，等待外部输入。

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver


class ApprovalState(TypedDict):
    task: str
    result: str
    approved: bool
    feedback: str


def execute_task(state: ApprovalState) -> dict:
    return {"result": f"执行结果: {state['task']}"}


def approval_gate(state: ApprovalState) -> dict:
    """这个节点本身什么都不做——它是一个暂停点。"""
    return {}


def finalize(state: ApprovalState) -> dict:
    return {"result": f"已发布: {state['result']}"}


graph = StateGraph(ApprovalState)
graph.add_node("execute", execute_task)
graph.add_node("approval", approval_gate)
graph.add_node("finalize", finalize)

graph.set_entry_point("execute")
graph.add_edge("execute", "approval")
graph.add_conditional_edges("approval", lambda s:
    "finalize" if s.get("approved") else END
)
graph.add_edge("finalize", END)

# 关键：interrupt_before 让图在执行 approval 节点前暂停
checkpointer = MemorySaver()
app = graph.compile(
    checkpointer=checkpointer,
    interrupt_before=["approval"],
)
```

运行时：

```python
config = {"configurable": {"thread_id": "task-1"}}

# 第一次调用：执行到 approval 前暂停
result = app.invoke(
    {"task": "发布新产品公告", "result": "", "approved": False, "feedback": ""},
    config,
)
print(result["result"])  # "执行结果: 发布新产品公告"

# 此时系统等待人类输入
# 人类审核后，更新状态并继续执行
app.update_state(config, {"approved": True, "feedback": "内容OK"})

# 第二次调用：从暂停点继续
result = app.invoke(None, config)
print(result["result"])  # "已发布: 执行结果: 发布新产品公告"
```

`interrupt_before` 的本质是：图在到达指定节点时暂停，把当前状态持久化到 checkpointer。外部系统可以通过 `update_state` 修改状态，然后用 `invoke(None, config)` 从暂停点继续执行。

## 设计原则

**最小介入**：只在真正需要的地方设置审批。审批过多会导致"审批疲劳"——审批者开始不看内容就点"批准"。

**清晰上下文**：审批界面要提供足够的决策信息。不要只显示"Agent 建议执行操作 X"，要显示操作的上下文、风险评估、替代方案。

**超时降级**：人类不响应时要有降级策略。超时后可以：跳过该步骤、通知其他审批者、执行默认操作。不能让系统永远停在那里。

**可追溯**：记录所有审批历史——谁审批的、什么时候、审批了什么、修改了什么。这是审计和复盘的基础。

## 练习

### 练习一：实现审批超时

在上面的 LangGraph 审批示例中，添加超时机制：如果审批等待超过 60 秒，自动拒绝并记录超时原因。

```python
import asyncio
from datetime import datetime

async def approval_with_timeout(app, config, timeout_seconds=60):
    """带超时的审批等待。"""
    # 提示：用 asyncio.wait_for 或 threading.Timer
    ...
```

### 练习二：实现修改模式

修改审批流程，让审批者不仅能批准/拒绝，还能修改 Agent 的输出后再批准：

```python
def approval_with_edit(state: ApprovalState) -> dict:
    """审批者可以修改 result 后再批准。"""
    # 审批者的输入格式：
    # {"action": "approve"}
    # {"action": "reject", "reason": "..."}
    # {"action": "edit", "new_result": "...", "approve": True}
    ...
```

---

## 参考答案

### 练习一

```python
import asyncio

async def approval_with_timeout(app, config, timeout_seconds=60):
    start = datetime.now()
    while (datetime.now() - start).total_seconds() < timeout_seconds:
        state = app.get_state(config)
        # 检查是否已经被审批
        if state.values.get("approved"):
            return "approved"
        await asyncio.sleep(1)

    # 超时：自动拒绝
    app.update_state(config, {
        "approved": False,
        "feedback": "审批超时，自动拒绝",
    })
    return "timeout"
```

为什么用轮询而不是回调？因为 LangGraph 的 checkpointer 是基于文件/内存的，没有内置的事件通知机制。在生产环境中，可以用 Redis Pub/Sub 或 WebSocket 替代轮询。
