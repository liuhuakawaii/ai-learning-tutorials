# 01 - 元 Prompt：Prompt 生成 Prompt

> **课程定位**：Stage 5 高级技巧 · 第 1 课
> **前置要求**：完成 Stage 1-4，熟悉 System/User/Assistant 消息结构与 Few-shot 技巧
> **预计时间**：90 分钟

---

## 场景引入

你的团队有 50 个不同的业务场景需要 Prompt，每个 Prompt 都需要精心设计角色、格式、约束和示例。手动编写不仅耗时，还因为每个人的风格不同导致质量参差不齐。更糟糕的是，当业务需求变化时，你需要逐个修改所有 Prompt。有没有一种方法，能让 AI 自动帮你生成高质量的 Prompt，并且在数据驱动下持续优化？

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

## 6. 常见误区

| 错误 | 正确做法 |
|------|----------|
| Meta-Prompt 过于复杂 | 保持 Meta-Prompt 本身简洁明了 |
| 没有评估就迭代 | 每次迭代必须量化评估 |
| 过度优化一个测试集 | 使用独立的验证集防止过拟合 |
| 忽略成本控制 | 设置最大迭代次数和 Token 限制 |
| 生成的 Prompt 缺少约束 | 在 Meta-Prompt 中明确约束条件 |

---

## 7. 工程建议

1. Meta-Prompt 本身也需要迭代优化，建议先用小规模测试集验证生成效果，再扩大规模
2. 在生产环境中，务必设置最大迭代次数和 Token 限制，防止优化循环失控导致成本爆炸
3. 使用独立的验证集评估优化后的 Prompt，避免在训练集上过拟合
4. 将优化后的 Prompt 版本化管理，方便回滚和 A/B 测试

---

## 8. 本节小结

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

## 参考答案

### 练习 1

**思路**：核心是在 Meta-Prompt 中强制要求生成的 Prompt 包含 Chain-of-Thought 结构。Meta-Prompt 需要明确指定输出格式，包括角色定义、CoT 推理步骤引导和输出格式约束。通过 `generate_cot_prompt` 函数接收任务描述，返回一个完整的带 CoT 的 System Prompt。

**答案**：

```python
import openai

client = openai.OpenAI()

COT_META_PROMPT = """
你是一位世界级的 Prompt 工程师。根据用户提供的任务描述，
生成一个包含 Chain-of-Thought（链式推理）的高质量 Prompt。

## 任务描述
{task_description}

## 要求
1. 生成的 Prompt 必须引导模型"一步一步思考"
2. 包含明确的角色定义
3. 包含具体的推理步骤引导（Step 1, Step 2, ...）
4. 包含最终答案的格式要求
5. 提供 1 个 CoT 示例（展示完整推理过程）

## 输出格式
请按以下结构输出生成的 Prompt：
---
### System Prompt
[生成的系统提示词，必须包含 CoT 推理引导]

### User Prompt Template
[用户提示词模板，用 {input} 表示输入变量]

### 示例
[1 个包含完整推理过程的输入输出示例]
---
"""

def generate_cot_prompt(task_description: str) -> str:
    """使用 Meta-Prompt 生成带 CoT 的任务 Prompt"""
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "你是一位世界级的 Prompt 工程师。"},
            {"role": "user", "content": COT_META_PROMPT.format(
                task_description=task_description
            )}
        ],
        temperature=0.7
    )
    return response.choices[0].message.content


if __name__ == "__main__":
    task = "判断一条用户评论是否包含讽刺意味，并解释判断依据"
    result = generate_cot_prompt(task)
    print(result)
```

**要点**：
- Meta-Prompt 中必须明确要求"一步一步思考"，否则生成的 Prompt 可能缺少 CoT 结构
- 示例（Few-shot）中应展示完整的推理链条，而非直接给答案
- 温度设为 0.7 可在创造性和稳定性之间取得平衡

---

### 练习 2

**思路**：构建 Self-Improving 系统的关键是设计好三个环节：初始 Prompt 生成、评估打分、基于失败分析的改进。针对"文本摘要"任务，需要准备一组带参考摘要的测试样本，通过比较生成摘要与参考摘要的重叠度来量化准确率，然后将失败案例的差异反馈给优化器进行迭代。

**答案**：

```python
import openai
from typing import List, Dict, Tuple
from dataclasses import dataclass, field

client = openai.OpenAI()

@dataclass
class SummaryExample:
    """摘要测试样本"""
    article: str
    reference_summary: str

@dataclass
class IterationRecord:
    """迭代记录"""
    iteration: int
    prompt: str
    accuracy: float
    failure_count: int

class SummarySelfImprover:
    """文本摘要 Self-Improving 系统"""

    def __init__(self, model: str = "gpt-4", max_iterations: int = 3):
        self.model = model
        self.max_iterations = max_iterations
        self.history: List[IterationRecord] = []

    def generate_initial_prompt(self) -> str:
        """生成初始摘要 Prompt"""
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是 Prompt 工程专家。"},
                {"role": "user", "content": """
请为"文本摘要"任务生成一个初始 System Prompt。

要求：
1. 指定角色：专业的文本摘要助手
2. 明确输出格式：100 字以内的中文摘要
3. 包含摘要要点提取规则
4. 提供 1 个示例

直接输出 Prompt 内容，不要解释。"""}
            ],
            temperature=0.7
        )
        return response.choices[0].message.content

    def evaluate(self, prompt: str, test_cases: List[SummaryExample]) -> Tuple[float, List[Dict]]:
        """评估 Prompt 在测试集上的摘要质量"""
        results = []
        total_score = 0

        for i, case in enumerate(test_cases):
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": f"请为以下文本生成摘要：\n{case.article}"}
                ],
                temperature=0
            )
            generated = response.choices[0].message.content.strip()

            # 简单评估：检查关键信息覆盖率
            ref_keywords = set(case.reference_summary.replace("，", " ").replace("。", " ").split())
            gen_keywords = set(generated.replace("，", " ").replace("。", " ").split())
            overlap = len(ref_keywords & gen_keywords) / len(ref_keywords) if ref_keywords else 0

            score = min(1.0, overlap * 1.2)  # 略微放宽评分
            total_score += score

            results.append({
                "article": case.article[:50] + "...",
                "reference": case.reference_summary,
                "generated": generated,
                "score": score,
                "passed": score >= 0.5
            })

            print(f"  样本 {i+1}: 得分 {score:.2f}")

        accuracy = total_score / len(test_cases) if test_cases else 0
        return accuracy, results

    def analyze_failures(self, results: List[Dict]) -> str:
        """分析失败案例"""
        failures = [r for r in results if not r["passed"]]
        if not failures:
            return "所有样本通过，无需改进。"

        analysis = "## 失败案例分析\n\n"
        for i, f in enumerate(failures[:3], 1):
            analysis += f"""### 失败案例 {i}
- 参考摘要：{f['reference']}
- 生成摘要：{f['generated']}
- 问题：关键信息覆盖不足（得分 {f['score']:.2f}）

"""
        return analysis

    def improve_prompt(self, current_prompt: str, failure_analysis: str) -> str:
        """基于失败分析改进 Prompt"""
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是 Prompt 优化专家。"},
                {"role": "user", "content": f"""
## 当前 Prompt
{current_prompt}

## 失败分析
{failure_analysis}

请改进 Prompt 以解决上述问题。要求：
1. 保留有效的部分
2. 针对失败原因强化关键信息提取的指令
3. 直接输出改进后的完整 Prompt"""}
            ],
            temperature=0.5
        )
        return response.choices[0].message.content

    def optimize(self, test_cases: List[SummaryExample]) -> str:
        """执行完整优化流程"""
        current_prompt = self.generate_initial_prompt()
        best_prompt = current_prompt
        best_accuracy = 0

        for iteration in range(self.max_iterations):
            print(f"\n{'='*50}")
            print(f"迭代 {iteration + 1}/{self.max_iterations}")
            print(f"{'='*50}")

            accuracy, results = self.evaluate(current_prompt, test_cases)
            print(f"准确率: {accuracy:.2%}")

            self.history.append(IterationRecord(
                iteration=iteration + 1,
                prompt=current_prompt,
                accuracy=accuracy,
                failure_count=len([r for r in results if not r["passed"]])
            ))

            if accuracy > best_accuracy:
                best_accuracy = accuracy
                best_prompt = current_prompt

            if accuracy >= 0.9:
                print("达到目标准确率，停止优化。")
                break

            failure_analysis = self.analyze_failures(results)
            current_prompt = self.improve_prompt(current_prompt, failure_analysis)

        print(f"\n最佳准确率: {best_accuracy:.2%}")
        return best_prompt


if __name__ == "__main__":
    test_cases = [
        SummaryExample(
            article="OpenAI 今日发布了 GPT-5 模型，在多项基准测试中超越了前代产品。新模型支持 100 万 Token 上下文窗口，推理速度提升了 3 倍。CEO Sam Altman 表示这是迈向 AGI 的关键一步。",
            reference_summary="OpenAI 发布 GPT-5，支持百万 Token 上下文，推理速度提升 3 倍。"
        ),
        SummaryExample(
            article="北京市气象台发布暴雨蓝色预警，预计今天夜间到明天白天，北京大部分地区将出现大到暴雨，局地大暴雨。建议市民减少外出，注意交通安全。",
            reference_summary="北京发布暴雨蓝色预警，今夜至明天有大到暴雨，建议减少外出。"
        ),
        SummaryExample(
            article="特斯拉 CEO 马斯克在社交媒体上宣布，公司将于明年推出一款售价低于 2.5 万美元的电动汽车。这款车型将在墨西哥工厂生产，目标是让更多人买得起电动车。",
            reference_summary="特斯拉计划明年推出 2.5 万美元以下电动车，将在墨西哥工厂生产。"
        ),
    ]

    improver = SummarySelfImprover(max_iterations=3)
    best_prompt = improver.optimize(test_cases)
    print(f"\n最终优化后的 Prompt:\n{best_prompt}")
```

**要点**：
- 评估函数的质量决定了优化上限——简单的关键词重叠只是基线，生产环境应使用语义相似度（如 embedding 余弦距离）
- 每轮迭代必须记录历史，以便回溯分析优化趋势
- `improve_prompt` 时保留有效部分比从头生成更稳定

---

### 练习 3

**思路**：BootstrapFewShot 的核心逻辑是在训练集上跑一遍模型，筛选出模型答对的样本作为 Few-shot 示例，然后尝试不同数量的示例组合，找到准确率最高的配置。关键是评估函数要准确匹配输出，以及贪心策略选择最佳示例子集。

**答案**：

```python
import openai
from typing import List, Dict, Callable
from dataclasses import dataclass

client = openai.OpenAI()

@dataclass
class Example:
    input_text: str
    expected_output: str

class SimplePredictor:
    """简化的预测模块"""

    def __init__(self, task_description: str, model: str = "gpt-4"):
        self.task_description = task_description
        self.model = model
        self.demos: List[Dict] = []

    def forward(self, input_text: str) -> str:
        """执行预测"""
        prompt = f"{self.task_description}\n\n"

        if self.demos:
            prompt += "请参考以下示例：\n\n"
            for i, demo in enumerate(self.demos, 1):
                prompt += f"示例 {i}:\n输入：{demo['input']}\n输出：{demo['output']}\n\n"

        prompt += f"现在请处理以下输入：\n输入：{input_text}\n输出："

        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0
        )
        return response.choices[0].message.content.strip()


class BootstrapFewShot:
    """简化的 BootstrapFewShot 优化器"""

    def __init__(
        self,
        metric: Callable[[str, str], bool],
        max_demos: int = 4
    ):
        self.metric = metric
        self.max_demos = max_demos

    def compile(
        self,
        module: SimplePredictor,
        trainset: List[Example]
    ) -> SimplePredictor:
        """优化模块：自动选择最佳 Few-shot 示例"""
        # 第一步：在训练集上跑模型，收集正确回答的样本
        correct_demos = []
        for case in trainset:
            output = module.forward(case.input_text)
            if self.metric(output, case.expected_output):
                correct_demos.append({
                    "input": case.input_text,
                    "output": case.expected_output
                })
            print(f"  样本: {case.input_text[:30]}... -> "
                  f"{'正确' if self.metric(output, case.expected_output) else '错误'}")

        print(f"\n收集到 {len(correct_demos)} 个正确示例")

        if not correct_demos:
            print("没有正确示例，无法优化。返回原始模块。")
            return module

        # 第二步：尝试不同数量的示例，找到最佳组合
        best_demos = []
        best_accuracy = 0

        for n in range(1, min(len(correct_demos), self.max_demos) + 1):
            # 使用前 n 个示例
            candidate_demos = correct_demos[:n]
            module.demos = candidate_demos

            # 评估
            correct_count = 0
            for case in trainset:
                output = module.forward(case.input_text)
                if self.metric(output, case.expected_output):
                    correct_count += 1

            accuracy = correct_count / len(trainset)
            print(f"  使用 {n} 个示例: 准确率 {accuracy:.2%}")

            if accuracy > best_accuracy:
                best_accuracy = accuracy
                best_demos = candidate_demos

        # 应用最佳配置
        module.demos = best_demos
        print(f"\n优化完成: 使用 {len(best_demos)} 个示例，准确率 {best_accuracy:.2%}")
        return module


def sentiment_metric(predicted: str, expected: str) -> bool:
    """情感分类评估函数"""
    return expected.lower() in predicted.lower()


if __name__ == "__main__":
    task = "将用户评论分类为：正面(positive)、负面(negative)、中性(neutral)"

    trainset = [
        Example("这个产品太棒了，非常满意！", "positive"),
        Example("质量很差，不推荐购买", "negative"),
        Example("一般般，没什么特别的", "neutral"),
        Example("超级喜欢，已经推荐给朋友了", "positive"),
        Example("退货了，完全不能用", "negative"),
        Example("还行吧，凑合能用", "neutral"),
    ]

    module = SimplePredictor(task_description=task)
    optimizer = BootstrapFewShot(metric=sentiment_metric, max_demos=4)
    optimized_module = optimizer.compile(module, trainset)

    # 测试优化后的模块
    print("\n测试优化后的模块:")
    test_input = "这个手机壳质量不错，价格也合理"
    result = optimized_module.forward(test_input)
    print(f"输入: {test_input}")
    print(f"输出: {result}")
```

**要点**：
- Bootstrap 的核心思想是"让模型自己选择自己擅长的示例"——答对的样本才是好的 Few-shot 示例
- 示例数量不是越多越好，过多示例可能引入噪声，通常 2-4 个效果最佳
- 评估函数必须与实际任务指标一致，否则选出的示例组合不一定是生产最优

---

> **下一课**：[02 - 自洽性与多数投票](./02-自洽性与多数投票.md)
