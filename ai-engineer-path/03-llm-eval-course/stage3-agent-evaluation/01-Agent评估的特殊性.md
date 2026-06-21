# 01 Agent 评估的特殊性——为什么传统测试方法不够用

> Agent 是非确定性的、多步骤的、有状态的——传统软件测试方法在这里全部失效。

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
