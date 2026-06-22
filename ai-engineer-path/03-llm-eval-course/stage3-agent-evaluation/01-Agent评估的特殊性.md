# 01 Agent 评估的特殊性——为什么传统测试方法不够用

> Agent 是非确定性的、多步骤的、有状态的——传统软件测试方法在这里全部失效。

## 场景引入

你的团队上线了一个客服 Agent，测试阶段用 10 个标准问题验证都没问题。上线第一天，用户问了 200 个真实问题，Agent 的回答准确率骤降到 60%——有的答非所问，有的调错了工具，有的在三步推理后彻底跑偏。你回头检查发现，传统软件测试里"输入→断言输出"的模式完全无法覆盖 Agent 的非确定性行为。同一个问题，Agent 可能走完全不同的执行路径，两条路径都可能对，也都可能错。你需要一套全新的评估方法论。

## 学习目标

- 理解 Agent 系统评估的特殊挑战
- 掌握 Agent 评估的核心指标框架
- 建立"行为追踪+结果评估"的评估思维

---

## 一、Agent 评估的挑战

### 1.1 非确定性

```
同一个问题，Agent 的执行路径可能完全不同：

用户："帮我查一下星辰科技的最新报价"

执行路径 1：
  Thought: 需要调用搜索工具
  Action: search("星辰科技 报价")
  Observation: 找到 3 条结果
  Answer: 最新报价为...

执行路径 2：
  Thought: 需要先确认公司全称
  Action: search("星辰科技 公司信息")
  Thought: 找到公司，现在查报价
  Action: search("星辰科技 产品价格")
  Answer: 最新报价为...

两条路径都得到了正确答案，但步骤不同。
怎么评估？哪个更好？
```

### 1.2 多步骤

```
Agent 的执行是一个过程，不只是一个结果：

步骤 1：理解用户意图
步骤 2：规划执行计划
步骤 3：选择工具
步骤 4：调用工具
步骤 5：观察结果
步骤 6：决定下一步
...
步骤 N：生成最终回答

每个步骤都可能出错，错误会累积。
```

### 1.3 工具调用

```
Agent 的能力取决于它调用的工具：

问题：工具调用是否正确？
  - 选择了正确的工具吗？
  - 参数格式正确吗？
  - 参数值合理吗？
  - 调用时机合适吗？

问题：工具结果如何使用？
  - 是否正确解读了工具返回？
  - 是否遗漏了关键信息？
  - 是否做了合理的推断？
```

---

## 二、Agent 评估指标框架

### 2.1 结果指标

```python
class AgentResultMetrics:
    """Agent 结果评估指标"""
    
    @staticmethod
    def task_completion(agent_output: str, expected_output: str, client) -> float:
        """任务完成度"""
        prompt = f"""评估 Agent 是否完成了用户任务。

期望结果：{expected_output}
实际结果：{agent_output}

评分（0-1）：
0 = 完全没有完成
0.5 = 部分完成
1 = 完全完成

请只输出数字。"""
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        return float(response.choices[0].message.content.strip())
    
    @staticmethod
    def answer_quality(question: str, answer: str, client) -> float:
        """回答质量"""
        # 使用之前学过的评估方法
        pass
```

### 2.2 过程指标

```python
class AgentProcessMetrics:
    """Agent 过程评估指标"""
    
    @staticmethod
    def tool_selection_accuracy(
        available_tools: list[str],
        selected_tools: list[str],
        correct_tools: list[str]
    ) -> float:
        """工具选择准确率"""
        selected_set = set(selected_tools)
        correct_set = set(correct_tools)
        
        if not correct_set:
            return 1.0 if not selected_set else 0.0
        
        correct_selections = len(selected_set & correct_set)
        return correct_selections / len(correct_set)
    
    @staticmethod
    def step_efficiency(steps_taken: int, optimal_steps: int) -> float:
        """步骤效率"""
        if steps_taken <= optimal_steps:
            return 1.0
        return optimal_steps / steps_taken
    
    @staticmethod
    def error_recovery(execution_trace: list[dict]) -> float:
        """错误恢复能力"""
        errors = [s for s in execution_trace if s.get("status") == "error"]
        recovered = [s for s in errors if s.get("recovered")]
        
        if not errors:
            return 1.0
        return len(recovered) / len(errors)
```

### 2.3 效率指标

```python
class AgentEfficiencyMetrics:
    """Agent 效率评估指标"""
    
    @staticmethod
    def token_efficiency(total_tokens: int, task_complexity: str) -> float:
        """Token 效率"""
        thresholds = {
            "simple": 2000,
            "medium": 5000,
            "complex": 10000
        }
        expected = thresholds.get(task_complexity, 5000)
        
        if total_tokens <= expected:
            return 1.0
        return expected / total_tokens
    
    @staticmethod
    def time_efficiency(actual_time: float, expected_time: float) -> float:
        """时间效率"""
        if actual_time <= expected_time:
            return 1.0
        return expected_time / actual_time
```

---

## 三、执行追踪

### 3.1 Trace 记录

```python
@dataclass
class AgentStep:
    step_number: int
    thought: str
    action: str
    action_input: dict
    observation: str
    status: str  # "success" / "error"
    duration: float
    tokens_used: int

class AgentTracer:
    """Agent 执行追踪器"""
    
    def __init__(self):
        self.steps: list[AgentStep] = []
        self.start_time: float = None
    
    def start(self):
        self.start_time = time.time()
    
    def add_step(self, step: AgentStep):
        self.steps.append(step)
    
    def get_trace(self) -> dict:
        return {
            "total_steps": len(self.steps),
            "total_duration": time.time() - self.start_time,
            "total_tokens": sum(s.tokens_used for s in self.steps),
            "error_count": sum(1 for s in self.steps if s.status == "error"),
            "steps": [asdict(s) for s in self.steps]
        }
```

---

## 四、评估决策树

```
Agent 评估流程：

1. 任务完成了吗？
   ├── 没完成 → 检查执行追踪，找到失败点
   └── 完成了 → 继续评估

2. 完成质量如何？
   ├── 结果正确 → 检查效率
   └── 结果有问题 → 检查哪个步骤出错

3. 工具调用正确吗？
   ├── 选择了错误的工具 → 工具选择策略问题
   ├── 参数错误 → 参数生成问题
   └── 工具正确 → 检查结果解读

4. 效率如何？
   ├── Token 消耗过多 → 优化 Prompt
   ├── 步骤过多 → 优化规划能力
   └── 延迟过高 → 优化工具调用
```

---

## 常见误区

1. **用单一输出判定 Agent 好坏**：只看最终回答是否正确，忽略执行过程。同一个正确答案可能来自合理的推理链，也可能来自"歪打正着"，两者的鲁棒性完全不同。
2. **用确定性测试覆盖非确定性系统**：写一组固定测试用例跑一遍就宣布通过。Agent 的行为随输入措辞、上下文长度、模型温度变化，单次测试结果不具备统计意义。
3. **把 Trace 当日志看**：执行追踪记录了每一步的 thought/action/observation，但很多人只是存下来"以备查"，没有基于 Trace 做系统性的失败模式分析。
4. **忽略效率指标**：任务完成了就认为 Agent 好用，但可能多绕了 5 步、多花了 10 倍 Token。效率差意味着成本高、延迟大，线上根本撑不住。

## 工程建议

1. **每个 Agent 请求都生成 Trace**：Trace 是评估的基础数据，上线后也必须采集。用结构化格式记录每一步的 thought/action/observation/status/duration/tokens，存到可观测性平台以便回溯分析。
2. **建立"黄金测试集"并定期扩充**：从真实用户 query 中筛选代表性用例，覆盖不同难度、不同工具组合、不同失败模式。每次发现新的失败模式就加入测试集，让评估覆盖面随时间增长。
3. **评估结果要可对比、可追踪**：每次评估输出结构化 JSON，记录分数、Trace、成本。这样才能做版本间对比——"v2.1 比 v2.0 工具选择准确率提升了 8%，但 Token 消耗增加了 15%"。
4. **先定"不可上线"红线，再定"优秀"标准**：安全检查不通过不能上线、任务完成率低于 60% 不能上线——这些红线必须在评估体系搭建之初就明确，而不是跑完评估再讨论。

## 小结

```
本课核心要点：

1. Agent 评估的三大挑战：非确定性、多步骤、工具调用
2. 评估要分结果指标和过程指标
3. 执行追踪（Trace）是 Agent 评估的基础
4. 从结果回溯到过程，定位问题根源

---

**下一课**: [02 工具调用评估——准确率、参数正确性、调用效率](./02-工具调用评估.md)
```

---

## 练习

1. **设计题**：为你的 Agent 系统设计一套评估指标体系。

2. **追踪题**：实现一个 AgentTracer，记录 Agent 的执行过程。

3. **分析题**：分析一个 Agent 执行失败的案例，定位问题出在哪个步骤。
