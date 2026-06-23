# 01 Agent 评估的特殊性

> Agent 是非确定性的、多步骤的、有状态的——传统测试方法在这里全部失效。

## 一个翻车现场

你的团队上线了一个客服 Agent。测试阶段用 10 个标准问题验证都没问题。上线第一天，用户问了 200 个真实问题，Agent 的回答准确率骤降到 60%。

排查发现三种典型失败：

1. **调错工具**：用户问"查一下订单物流"，Agent 调了"搜索商品"工具
2. **多步推理跑偏**：Agent 先查了用户信息，再查订单，再查物流——第三步推理时把前两步的结果搞混了
3. **工具失败后编造**：物流 API 超时，Agent 回答"您的订单已发货"——用的是缓存里的旧数据

你回头检查发现，传统软件测试里"输入→断言输出"的模式完全无法覆盖这些情况。同一个问题，Agent 可能走完全不同的执行路径，两条路径都可能对，也都可能错。

## Agent 评估的三大挑战

### 非确定性

同一个问题，Agent 的执行路径可能完全不同：

```
用户："帮我查一下星辰科技的最新报价"

路径 1：
  Thought: 需要调用搜索工具
  Action: search("星辰科技 报价")
  Answer: 最新报价为...

路径 2：
  Thought: 需要先确认公司全称
  Action: search("星辰科技 公司信息")
  Thought: 找到公司，现在查报价
  Action: search("星辰科技 产品价格")
  Answer: 最新报价为...
```

两条路径都得到了正确答案，但步骤不同。怎么评估？哪个更好？

### 多步骤

Agent 的执行是一个过程，不只是结果。每个步骤都可能出错，错误会累积：

```
步骤 1：理解用户意图 → 可能理解错
步骤 2：规划执行计划 → 可能规划不合理
步骤 3：选择工具 → 可能选错工具
步骤 4：调用工具 → 可能参数错误
步骤 5：解读结果 → 可能误读
步骤 N：生成回答 → 可能答非所问
```

### 工具调用

Agent 的能力取决于它调用的工具。评估要回答：选了正确的工具吗？参数格式正确吗？参数值合理吗？调用时机合适吗？结果解读正确吗？

## 实验：观察 Agent 的执行 Trace

```python
import json
from dataclasses import dataclass, asdict
import time

@dataclass
class AgentStep:
    step_number: int
    thought: str
    action: str
    action_input: dict
    observation: str
    status: str  # "success" / "error"
    duration: float

class AgentTracer:
    def __init__(self):
        self.steps: list[AgentStep] = []
        self.start_time = time.time()

    def add_step(self, thought, action, action_input, observation, status, duration):
        self.steps.append(AgentStep(
            step_number=len(self.steps) + 1,
            thought=thought, action=action, action_input=action_input,
            observation=observation, status=status, duration=duration
        ))

    def get_summary(self) -> dict:
        errors = [s for s in self.steps if s.status == "error"]
        return {
            "total_steps": len(self.steps),
            "total_duration": round(time.time() - self.start_time, 2),
            "error_count": len(errors),
            "steps": [asdict(s) for s in self.steps],
        }

# 模拟一个 Agent 执行过程
tracer = AgentTracer()

tracer.add_step(
    thought="用户想查物流状态",
    action="parse_intent", action_input={},
    observation="意图：查询物流", status="success", duration=0.1
)
tracer.add_step(
    thought="调用订单查询工具",
    action="tool:order_query", action_input={"order_id": "12345"},
    observation="找到订单记录", status="success", duration=0.5
)
tracer.add_step(
    thought="获取物流信息",
    action="tool:logistics_query", action_input={"order_id": "12345"},
    observation="TimeoutError", status="error", duration=3.0
)
tracer.add_step(
    thought="物流查询失败，用缓存回答",
    action="generate_answer", action_input={},
    observation="您的订单已发货", status="success", duration=0.3
)

summary = tracer.get_summary()
print(json.dumps(summary, indent=2, ensure_ascii=False))
```

运行这段代码，观察 Trace。注意第三步：工具调用失败了，但 Agent 用缓存数据回答了"已发货"——如果实际订单还在仓库，这就是一个严重错误。

## Agent 评估指标框架

### 结果指标

| 指标 | 衡量什么 | 计算方式 |
|------|----------|----------|
| 任务完成度 | Agent 是否完成了用户任务 | LLM-as-Judge 打分 0-1 |
| 回答质量 | 最终回答的准确性、完整性 | 复用阶段 1 的评估方法 |

### 过程指标

| 指标 | 衡量什么 | 计算方式 |
|------|----------|----------|
| 工具选择准确率 | 是否选对了工具 | 正确选择数 / 应选总数 |
| 步骤效率 | 是否绕了弯路 | 最优步骤数 / 实际步骤数 |
| 错误恢复率 | 出错后能否自救 | 恢复成功的错误 / 总错误数 |

### 效率指标

| 指标 | 衡量什么 | 计算方式 |
|------|----------|----------|
| Token 效率 | 是否消耗了过多 Token | 预期 Token / 实际 Token |
| 时间效率 | 延迟是否可接受 | 预期时间 / 实际时间 |

```python
class AgentMetrics:
    @staticmethod
    def tool_selection_accuracy(selected_tools: list[str], correct_tools: list[str]) -> float:
        if not correct_tools:
            return 1.0 if not selected_tools else 0.0
        selected_set = set(selected_tools)
        correct_set = set(correct_tools)
        return len(selected_set & correct_set) / len(correct_set)

    @staticmethod
    def step_efficiency(steps_taken: int, optimal_steps: int) -> float:
        if steps_taken <= optimal_steps:
            return 1.0
        return optimal_steps / steps_taken

    @staticmethod
    def token_efficiency(total_tokens: int, task_complexity: str) -> float:
        thresholds = {"simple": 2000, "medium": 5000, "complex": 10000}
        expected = thresholds.get(task_complexity, 5000)
        return min(1.0, expected / total_tokens) if total_tokens > 0 else 1.0
```

## 评估决策树

```
1. 任务完成了吗？
   ├── 没完成 → 检查 Trace，找到失败点
   └── 完成了 → 继续

2. 完成质量如何？
   ├── 结果正确 → 检查效率
   └── 结果有问题 → 检查哪个步骤出错

3. 工具调用正确吗？
   ├── 选错工具 → 工具选择策略问题
   ├── 参数错误 → 参数生成问题
   └── 工具正确 → 检查结果解读

4. 效率如何？
   ├── Token 过多 → 优化 Prompt
   ├── 步骤过多 → 优化规划能力
   └── 延迟过高 → 优化工具调用
```

## 实验：分析一个失败 Trace

```python
def analyze_failure(trace: dict) -> dict:
    """分析 Agent 执行失败的根因"""
    errors = [s for s in trace["steps"] if s["status"] == "error"]
    if not errors:
        return {"failure": False}

    failure_step = errors[0]
    step_idx = trace["steps"].index(failure_step)
    subsequent = trace["steps"][step_idx + 1:]

    analysis = {
        "failure": True,
        "failure_step": failure_step["step_number"],
        "failure_action": failure_step["action"],
        "error": failure_step["observation"],
    }

    # 检查是否有恢复尝试
    recovery = [s for s in subsequent if s["status"] == "success"]
    if recovery:
        analysis["recovery_attempted"] = True
        analysis["recovery_quality"] = "需要人工判断恢复策略是否合理"

    return analysis

# 用上面 tracer 的数据测试
summary = tracer.get_summary()
result = analyze_failure(summary)
print(json.dumps(result, indent=2, ensure_ascii=False))
```

## 与 RAG 评估的关键区别

| 维度 | RAG 评估 | Agent 评估 |
|------|----------|------------|
| 输入输出 | 一问一答 | 多步推理链 |
| 确定性 | 检索结果相对稳定 | 执行路径不确定 |
| 评估对象 | 检索+生成 | 规划+工具调用+推理+生成 |
| 核心指标 | Faithfulness, Precision | 任务完成率, 工具准确率, 步骤效率 |
| 失败模式 | 检索差或生成差 | 工具调错、推理跑偏、错误恢复失败 |

## 常见误判

**用单一输出判定 Agent 好坏**：只看最终回答是否正确，忽略执行过程。同一个正确答案可能来自合理的推理链，也可能来自"歪打正着"。

**用确定性测试覆盖非确定性系统**：写一组固定测试用例跑一遍就宣布通过。Agent 的行为随输入措辞、上下文长度、模型温度变化，单次测试结果不具备统计意义。

**把 Trace 当日志看**：Trace 不只是"以备查"的记录，它是评估的基础数据。每条 Trace 都应该被分析。

## 练习

### 练习一：设计评估场景

为你的 Agent 设计 5 个评估场景，覆盖以下类型：

```python
eval_scenarios = [
    {
        "id": "agent_001",
        "type": "tool_selection",  # 工具选择
        "query": "用户问题",
        "expected_tools": ["tool_a", "tool_b"],
        "expected_output": "期望回答",
        "optimal_steps": 3,
    },
    {
        "id": "agent_002",
        "type": "error_recovery",  # 错误恢复
        "query": "会触发工具失败的问题",
        "tool_failure": {"tool": "xxx", "error": "TimeoutError"},
        "expected_behavior": "应告知用户无法获取，而非编造",
    },
    # ... 至少 5 个
]
```

### 练习二：Trace 分析

从你的 Agent 系统中获取 3 条真实执行 Trace（成功的和失败的都要），用本课的分析框架逐条分析：

- 每步的 status 是什么？
- 有没有不必要的步骤？
- 失败的步骤是怎么处理的？
- 错误恢复策略合理吗？

### 练习三：实现 AgentTracer

扩展本课的 `AgentTracer`，增加以下功能：
- `mark_recovered(step_number)`：标记某个错误步骤被后续步骤恢复
- `get_failure_analysis()`：返回所有失败步骤的分析
- `get_efficiency_report()`：返回步骤效率和 Token 效率报告

## 下一步

这一课建立了 Agent 评估的整体框架。下一课会深入工具调用评估——怎么判断 Agent 是否选对了工具、用对了参数。

---

**下一课**: [02 工具调用评估](./02-工具调用评估.md)
