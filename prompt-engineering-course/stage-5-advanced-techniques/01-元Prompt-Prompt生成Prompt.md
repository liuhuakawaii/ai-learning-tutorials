# 01 - 元 Prompt：Prompt 生成 Prompt

> **课程定位**：Stage 5 高级技巧 · 第 1 课
> **前置要求**：完成 Stage 1-4，熟悉 System/User/Assistant 消息结构与 Few-shot 技巧
> **预计时间**：90 分钟

---

## 学习目标

1. 理解 Meta-Prompting 的核心思想：用 Prompt 来生成 Prompt
2. 掌握 Prompt 生成模板的设计方法
3. 实现 Self-Improving Prompt 自动迭代优化系统
4. 学习 DSPy 风格的自动 Prompt 调优流程
5. 构建完整的 Meta-Prompt Pipeline 并评估效果

---

## 1. 什么是 Meta-Prompting？

Meta-Prompting 是一种"用 Prompt 生成 Prompt"的技术。它的核心思想是：

> **不直接写 Prompt 解决问题，而是写一个 Prompt 让 AI 帮你生成最优的 Prompt。**

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    Meta-Prompting 工作流程                                   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║   用户目标 ──────► Meta-Prompt ──────► LLM ──────► 生成的 Prompt            ║
║       │               │                              │                     ║
║       │               │                              ▼                     ║
║       │               │                        用生成的 Prompt              ║
║       │               │                        执行实际任务                  ║
║       │               │                              │                     ║
║       │               ▼                              ▼                     ║
║       │         评估生成的 Prompt ◄────── 获取执行结果                       ║
║       │               │                                                     ║
║       │               ▼                                                     ║
║       │         优化 Meta-Prompt                                            ║
║       │               │                                                     ║
║       ▼               ▼                                                     ║
║   最终输出 ◄──── 迭代完成                                                    ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 1.1 为什么需要 Meta-Prompting？

| 场景 | 传统方式 | Meta-Prompting |
|------|----------|----------------|
| 复杂任务 | 手动反复调试 Prompt | 自动生成 + 评估 |
| 多变输入 | 一个 Prompt 打天下 | 动态生成适配 Prompt |
| 团队协作 | 每人风格不同 | 统一的生成模板 |
| 持续优化 | 人工经验驱动 | 数据驱动自动优化 |

---

## 2. Prompt 生成模板

### 2.1 基础生成模板

最简单的 Meta-Prompt 是一个结构化的生成模板：

```python
import openai

client = openai.OpenAI()

META_PROMPT_TEMPLATE = """
你是一位世界级的 Prompt 工程师。根据用户提供的任务描述，
生成一个高质量的 Prompt 来完成该任务。

## 任务描述
{task_description}

## 要求
1. 生成的 Prompt 必须清晰、具体、可执行
2. 包含明确的角色定义
3. 包含具体的输出格式要求
4. 包含必要的约束条件
5. 提供 1-2 个示例（Few-shot）

## 输出格式
请按以下结构输出生成的 Prompt：
---
### System Prompt
[生成的系统提示词]

### User Prompt Template
[用户提示词模板，用 {input} 表示输入变量]

### 示例
[1-2 个输入输出示例]
---
"""

def generate_prompt(task_description: str) -> str:
    """使用 Meta-Prompt 生成任务 Prompt"""
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "你是一位世界级的 Prompt 工程师。"},
            {"role": "user", "content": META_PROMPT_TEMPLATE.format(
                task_description=task_description
            )}
        ],
        temperature=0.7
    )
    return response.choices[0].message.content

# 使用示例
task = "将用户评论分类为正面、负面、中性三类，并提取关键情感词"
generated_prompt = generate_prompt(task)
print(generated_prompt)
```

### 2.2 带约束的生成模板

```python
CONSTRAINED_META_PROMPT = """
你是一位 Prompt 工程专家。请根据以下规范生成 Prompt：

## 任务信息
- 任务类型：{task_type}
- 目标模型：{target_model}
- 输入格式：{input_format}
- 输出格式：{output_format}

## 约束条件
- 最大 Token 限制：{max_tokens}
- 必须包含 Chain-of-Thought：{require_cot}
- 必须包含 Few-shot 示例：{require_fewshot}
- 示例数量：{example_count}

## 质量标准
1. 明确性：指令无歧义
2. 完整性：覆盖所有边界情况
3. 鲁棒性：对输入变化有容错能力
4. 效率：Token 使用精简

请生成符合上述所有要求的完整 Prompt。
"""

def generate_constrained_prompt(
    task_type: str,
    target_model: str = "gpt-4",
    input_format: str = "文本",
    output_format: str = "JSON",
    max_tokens: int = 2000,
    require_cot: bool = True,
    require_fewshot: bool = True,
    example_count: int = 2
) -> str:
    """生成带约束的 Prompt"""
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "user", "content": CONSTRAINED_META_PROMPT.format(
                task_type=task_type,
                target_model=target_model,
                input_format=input_format,
                output_format=output_format,
                max_tokens=max_tokens,
                require_cot=require_cot,
                require_fewshot=require_fewshot,
                example_count=example_count
            )}
        ],
        temperature=0.5
    )
    return response.choices[0].message.content
```

---

## 3. Self-Improving Prompt 自动迭代优化

### 3.1 优化循环架构

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    Self-Improving Prompt 循环                                ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  ║
║   │  初始 Prompt │────►│  执行任务   │────►│  评估结果   │                  ║
║   └─────────────┘     └─────────────┘     └─────────────┘                  ║
║         ▲                                       │                          ║
║         │                                       ▼                          ║
║         │              ┌─────────────┐     ┌─────────────┐                 ║
║         └──────────────│  优化 Prompt │◄────│  分析失败   │                 ║
║                        └─────────────┘     └─────────────┘                 ║
║                                                                            ║
║   迭代条件：                                                                ║
║   - 最大迭代次数：max_iterations                                           ║
║   - 目标准确率：target_accuracy                                             ║
║   - 改进阈值：improvement_threshold                                        ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 3.2 完整实现

```python
import json
from typing import List, Dict, Tuple
from dataclasses import dataclass, field

@dataclass
class Example:
    """训练/测试样本"""
    input_text: str
    expected_output: str

@dataclass
class OptimizationResult:
    """优化结果"""
    prompt: str
    accuracy: float
    iteration: int
    improvements: List[str] = field(default_factory=list)

class SelfImprovingPrompt:
    """自优化 Prompt 系统"""

    def __init__(
        self,
        model: str = "gpt-4",
        max_iterations: int = 5,
        target_accuracy: float = 0.95,
        improvement_threshold: float = 0.05
    ):
        self.model = model
        self.max_iterations = max_iterations
        self.target_accuracy = target_accuracy
        self.improvement_threshold = improvement_threshold
        self.client = openai.OpenAI()
        self.history: List[OptimizationResult] = []

    def generate_initial_prompt(self, task_description: str) -> str:
        """生成初始 Prompt"""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是 Prompt 工程专家。"},
                {"role": "user", "content": f"""
根据以下任务描述，生成一个初始 Prompt：

任务：{task_description}

要求：
1. 包含清晰的角色定义
2. 包含具体的处理步骤
3. 包含输出格式要求
4. 包含 2 个 Few-shot 示例

直接输出 Prompt 内容，不要解释。
"""}
            ],
            temperature=0.7
        )
        return response.choices[0].message.content

    def evaluate_prompt(
        self,
        prompt: str,
        test_cases: List[Example]
    ) -> Tuple[float, List[Dict]]:
        """评估 Prompt 在测试集上的表现"""
        results = []
        correct = 0

        for case in test_cases:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": case.input_text}
                ],
                temperature=0
            )
            predicted = response.choices[0].message.content.strip()
            is_correct = self._compare_outputs(predicted, case.expected_output)

            if is_correct:
                correct += 1

            results.append({
                "input": case.input_text,
                "expected": case.expected_output,
                "predicted": predicted,
                "correct": is_correct
            })

        accuracy = correct / len(test_cases) if test_cases else 0
        return accuracy, results

    def _compare_outputs(self, predicted: str, expected: str) -> bool:
        """比较输出结果（可自定义匹配逻辑）"""
        # 简化：检查预期输出是否包含在预测中
        return expected.strip().lower() in predicted.strip().lower()

    def analyze_failures(self, results: List[Dict]) -> str:
        """分析失败案例，生成改进建议"""
        failures = [r for r in results if not r["correct"]]

        if not failures:
            return "所有测试用例通过，无需改进。"

        failure_analysis = "## 失败案例分析\n\n"
        for i, f in enumerate(failures[:5], 1):  # 最多分析 5 个
            failure_analysis += f"""
### 失败案例 {i}
- 输入：{f['input']}
- 期望输出：{f['expected']}
- 实际输出：{f['predicted']}
- 差异：{self._identify_difference(f['predicted'], f['expected'])}
"""
        return failure_analysis

    def _identify_difference(self, predicted: str, expected: str) -> str:
        """识别预测与期望的差异"""
        if len(predicted) > len(expected) * 2:
            return "输出过长，可能包含多余信息"
        elif len(predicted) < len(expected) * 0.5:
            return "输出过短，可能遗漏关键信息"
        else:
            return "内容不匹配，需要调整处理逻辑"

    def improve_prompt(
        self,
        current_prompt: str,
        failure_analysis: str,
        task_description: str
    ) -> str:
        """基于失败分析改进 Prompt"""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是 Prompt 优化专家。"},
                {"role": "user", "content": f"""
## 当前 Prompt
{current_prompt}

## 任务描述
{task_description}

## 失败分析
{failure_analysis}

请根据失败分析改进 Prompt。要求：
1. 保留有效的部分
2. 针对失败原因进行修改
3. 确保改进后的 Prompt 更加精确
4. 直接输出改进后的完整 Prompt
"""}
            ],
            temperature=0.5
        )
        return response.choices[0].message.content

    def optimize(
        self,
        task_description: str,
        test_cases: List[Example]
    ) -> OptimizationResult:
        """执行完整的优化流程"""
        # 生成初始 Prompt
        current_prompt = self.generate_initial_prompt(task_description)
        best_accuracy = 0
        best_prompt = current_prompt

        for iteration in range(self.max_iterations):
            print(f"\n{'='*60}")
            print(f"迭代 {iteration + 1}/{self.max_iterations}")
            print(f"{'='*60}")

            # 评估当前 Prompt
            accuracy, results = self.evaluate_prompt(current_prompt, test_cases)
            print(f"当前准确率: {accuracy:.2%}")

            # 记录历史
            self.history.append(OptimizationResult(
                prompt=current_prompt,
                accuracy=accuracy,
                iteration=iteration
            ))

            # 更新最佳结果
            if accuracy > best_accuracy:
                best_accuracy = accuracy
                best_prompt = current_prompt

            # 检查是否达到目标
            if accuracy >= self.target_accuracy:
                print(f"✓ 达到目标准确率 {self.target_accuracy:.2%}")
                break

            # 分析失败案例
            failure_analysis = self.analyze_failures(results)
            print(f"失败案例数: {len([r for r in results if not r['correct']])}")

            # 改进 Prompt
            current_prompt = self.improve_prompt(
                current_prompt,
                failure_analysis,
                task_description
            )

        return OptimizationResult(
            prompt=best_prompt,
            accuracy=best_accuracy,
            iteration=len(self.history),
            improvements=[h.accuracy for h in self.history]
        )


# 使用示例
if __name__ == "__main__":
    # 定义任务
    task = "将用户评论分类为：正面(positive)、负面(negative)、中性(neutral)"

    # 准备测试集
    test_cases = [
        Example("这个产品太棒了，非常满意！", "positive"),
        Example("质量很差，不推荐购买", "negative"),
        Example("一般般，没什么特别的", "neutral"),
        Example("超级喜欢，已经推荐给朋友了", "positive"),
        Example("退货了，完全不能用", "negative"),
        Example("还行吧，凑合能用", "neutral"),
    ]

    # 创建优化器
    optimizer = SelfImprovingPrompt(
        model="gpt-4",
        max_iterations=3,
        target_accuracy=0.9
    )

    # 执行优化
    result = optimizer.optimize(task, test_cases)

    print("\n" + "="*60)
    print("优化完成！")
    print(f"最佳准确率: {result.accuracy:.2%}")
    print(f"迭代次数: {result.iteration}")
    print(f"\n最佳 Prompt:\n{result.prompt}")
```

---

## 4. DSPy 风格的自动 Prompt 调优

### 4.1 DSPy 核心思想

DSPy 是斯坦福提出的框架，核心思想是将 Prompt 工程转化为**可优化的编程范式**：

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        DSPy 编程范式                                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║   传统方式：                                                                ║
║   手写 Prompt ──► 测试 ──► 人工调整 ──► 重复                                ║
║                                                                            ║
║   DSPy 方式：                                                               ║
║   定义签名(Signature) ──► 编写模块(Module) ──► 自动优化(Optimizer)           ║
║                                                                            ║
║   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  ║
║   │  Signature  │────►│   Module    │────►│  Optimizer  │                  ║
║   │  (输入输出) │     │  (处理逻辑) │     │  (自动调优) │                  ║
║   └─────────────┘     └─────────────┘     └─────────────┘                  ║
║                                                                            ║
║   Signature 示例：                                                          ║
║   "comment -> sentiment: str"                                              ║
║                                                                            ║
║   Module 示例：                                                             ║
║   class SentimentClassifier(dspy.Module):                                  ║
║       def forward(self, comment):                                          ║
║           return dspy.Predict("comment -> sentiment")(comment=comment)     ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 4.2 模拟 DSPy 的简化实现

```python
from typing import Callable, Any
from abc import ABC, abstractmethod

class Signature:
    """DSPy 风格的签名定义"""

    def __init__(self, input_fields: List[str], output_fields: List[str]):
        self.input_fields = input_fields
        self.output_fields = output_fields

    def to_prompt_prefix(self) -> str:
        """将签名转换为 Prompt 前缀"""
        inputs = ", ".join(self.input_fields)
        outputs = ", ".join(self.output_fields)
        return f"Given {inputs}, produce {outputs}."

class Module(ABC):
    """DSPy 风格的模块基类"""

    def __init__(self, signature: Signature):
        self.signature = signature

    @abstractmethod
    def forward(self, **kwargs) -> str:
        pass

class Predict(Module):
    """基础预测模块"""

    def __init__(self, signature: Signature, demos: List[Dict] = None):
        super().__init__(signature)
        self.demos = demos or []
        self.optimized_instructions = ""

    def forward(self, **kwargs) -> str:
        # 构建 Prompt
        prompt = self.signature.to_prompt_prefix()

        if self.optimized_instructions:
            prompt += f"\n\nInstructions: {self.optimized_instructions}"

        # 添加示例
        if self.demos:
            prompt += "\n\nExamples:"
            for demo in self.demos:
                prompt += f"\nInput: {demo.get('input', '')}"
                prompt += f"\nOutput: {demo.get('output', '')}\n"

        # 添加当前输入
        prompt += f"\n\nNow process: {kwargs}"

        # 调用 LLM
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0
        )
        return response.choices[0].message.content

class BootstrapFewShot:
    """DSPy 风格的 Few-shot 自动优化器"""

    def __init__(
        self,
        metric: Callable[[str, str], bool],
        max_demos: int = 4
    ):
        self.metric = metric
        self.max_demos = max_demos

    def compile(
        self,
        module: Module,
        trainset: List[Example]
    ) -> Module:
        """优化模块"""
        best_demos = []
        best_accuracy = 0

        # 尝试不同的示例组合
        for i in range(min(len(trainset), self.max_demos)):
            candidate_demos = []
            correct_count = 0

            for case in trainset[:i+1]:
                output = module.forward(input_text=case.input_text)
                if self.metric(output, case.expected_output):
                    correct_count += 1
                    candidate_demos.append({
                        "input": case.input_text,
                        "output": case.expected_output
                    })

            accuracy = correct_count / len(trainset)
            if accuracy > best_accuracy:
                best_accuracy = accuracy
                best_demos = candidate_demos

        # 更新模块的示例
        module.demos = best_demos
        print(f"优化完成: 准确率 {best_accuracy:.2%}, 使用 {len(best_demos)} 个示例")
        return module


# 使用示例
def sentiment_metric(predicted: str, expected: str) -> bool:
    """情感分类评估函数"""
    return expected.lower() in predicted.lower()

# 创建模块
signature = Signature(
    input_fields=["comment"],
    output_fields=["sentiment"]
)
classifier = Predict(signature)

# 创建优化器
optimizer = BootstrapFewShot(
    metric=sentiment_metric,
    max_demos=3
)

# 编译（优化）
optimized_classifier = optimizer.compile(classifier, test_cases)

# 使用优化后的模块
result = optimized_classifier.forward(comment_text="这个产品真的很棒！")
print(result)
```

---

## 5. Prompt 优化循环的进阶技巧

### 5.1 多维度评估

```python
class MultiDimensionalEvaluator:
    """多维度 Prompt 评估器"""

    def __init__(self):
        self.dimensions = {
            "accuracy": self._evaluate_accuracy,
            "consistency": self._evaluate_consistency,
            "completeness": self._evaluate_completeness,
            "conciseness": self._evaluate_conciseness
        }

    def evaluate(
        self,
        prompt: str,
        test_cases: List[Example]
    ) -> Dict[str, float]:
        """多维度评估"""
        scores = {}
        for dim_name, eval_func in self.dimensions.items():
            scores[dim_name] = eval_func(prompt, test_cases)
        return scores

    def _evaluate_accuracy(
        self,
        prompt: str,
        test_cases: List[Example]
    ) -> float:
        """准确率评估"""
        correct = 0
        for case in test_cases:
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": case.input_text}
                ],
                temperature=0
            )
            if case.expected_output.lower() in response.choices[0].message.content.lower():
                correct += 1
        return correct / len(test_cases)

    def _evaluate_consistency(
        self,
        prompt: str,
        test_cases: List[Example]
    ) -> float:
        """一致性评估：多次运行同一输入，结果是否一致"""
        if not test_cases:
            return 1.0

        test_input = test_cases[0].input_text
        results = []

        for _ in range(3):
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": test_input}
                ],
                temperature=0
            )
            results.append(response.choices[0].message.content.strip())

        # 计算一致性
        unique_results = set(results)
        return 1.0 / len(unique_results) if unique_results else 1.0

    def _evaluate_completeness(
        self,
        prompt: str,
        test_cases: List[Example]
    ) -> float:
        """完整性评估：输出是否包含所有必要信息"""
        # 简化实现：检查输出长度是否合理
        total_score = 0
        for case in test_cases:
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": case.input_text}
                ],
                temperature=0
            )
            output_len = len(response.choices[0].message.content)
            expected_len = len(case.expected_output)
            # 长度在合理范围内
            if 0.5 * expected_len <= output_len <= 2 * expected_len:
                total_score += 1
        return total_score / len(test_cases)

    def _evaluate_conciseness(
        self,
        prompt: str,
        test_cases: List[Example]
    ) -> float:
        """简洁性评估：输出是否精简"""
        total_score = 0
        for case in test_cases:
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": case.input_text}
                ],
                temperature=0
            )
            output_len = len(response.choices[0].message.content)
            # 越短越好（但不能太短）
            if output_len < len(case.expected_output) * 1.5:
                total_score += 1
        return total_score / len(test_cases)
```

### 5.2 A/B 测试框架

```python
class PromptABTest:
    """Prompt A/B 测试框架"""

    def __init__(self, model: str = "gpt-4"):
        self.model = model
        self.client = openai.OpenAI()

    def run_test(
        self,
        prompt_a: str,
        prompt_b: str,
        test_cases: List[Example],
        metric: Callable[[str, str], float]
    ) -> Dict[str, Any]:
        """运行 A/B 测试"""
        results_a = []
        results_b = []

        for case in test_cases:
            # 测试 Prompt A
            response_a = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": prompt_a},
                    {"role": "user", "content": case.input_text}
                ],
                temperature=0
            )
            score_a = metric(
                response_a.choices[0].message.content,
                case.expected_output
            )
            results_a.append(score_a)

            # 测试 Prompt B
            response_b = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": prompt_b},
                    {"role": "user", "content": case.input_text}
                ],
                temperature=0
            )
            score_b = metric(
                response_b.choices[0].message.content,
                case.expected_output
            )
            results_b.append(score_b)

        avg_a = sum(results_a) / len(results_a)
        avg_b = sum(results_b) / len(results_b)

        return {
            "prompt_a_score": avg_a,
            "prompt_b_score": avg_b,
            "winner": "A" if avg_a > avg_b else "B",
            "improvement": abs(avg_a - avg_b) / max(avg_a, avg_b) * 100
        }
```

---

## 6. 常见错误

| 错误 | 正确做法 |
|------|----------|
| Meta-Prompt 过于复杂 | 保持 Meta-Prompt 本身简洁明了 |
| 没有评估就迭代 | 每次迭代必须量化评估 |
| 过度优化一个测试集 | 使用独立的验证集防止过拟合 |
| 忽略成本控制 | 设置最大迭代次数和 Token 限制 |
| 生成的 Prompt 缺少约束 | 在 Meta-Prompt 中明确约束条件 |

---

## 7. 本节小结

Meta-Prompting 是 Prompt 工程的高阶技巧，核心要点：

1. **生成模板**：结构化的 Meta-Prompt 能生成高质量的任务 Prompt
2. **自动迭代**：Self-Improving 循环让 Prompt 在数据驱动下持续优化
3. **DSPy 思想**：将 Prompt 工程转化为可优化的编程范式
4. **多维评估**：从准确率、一致性、完整性、简洁性多角度评估
5. **A/B 测试**：科学对比不同 Prompt 的效果

---

## 练习

### 练习 1：基础 Meta-Prompt
实现一个 Meta-Prompt，能够根据任务描述自动生成包含 Chain-of-Thought 的 Prompt。

### 练习 2：Self-Improving 系统
构建一个 Self-Improving Prompt 系统，针对"文本摘要"任务进行自动优化，至少完成 3 轮迭代。

### 练习 3：DSPy 风格优化器
实现一个简化的 BootstrapFewShot 优化器，能够自动选择最佳的 Few-shot 示例组合。

---

> **下一课**：[02 - 自洽性与多数投票](./02-自洽性与多数投票.md)
