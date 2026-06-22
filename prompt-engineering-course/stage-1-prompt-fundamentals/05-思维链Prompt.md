# Lesson 5: 思维链 Prompt

> **课程定位**：Prompt Engineering 入门课程 · Stage 1 第 5 课
> **前置要求**：完成 Lesson 1-4，理解 Few-shot Prompting
> **预计时长**：55 分钟

---

## 场景引入

你在做一个数学辅导机器人，用户问"鸡兔同笼，35 个头 94 只脚，鸡多少只？"模型直接回答"23"——答案对了，但用户（一个学生）完全不知道怎么算出来的。你追问模型"怎么算的？"它才补了一段推理。更糟糕的是，换一道稍微复杂的行程问题，直接回答就错了。这说明：对于需要多步推理的任务，让模型"展示思考过程"不是锦上添花，而是提升准确率的必要手段。

---

## 学习目标

完成本课后，你将能够：

1. 理解 Chain-of-Thought（CoT）的核心原理和价值
2. 掌握 Zero-shot CoT 和 Manual CoT 的使用方法
3. 了解 Auto-CoT 的自动化思路
4. 识别 CoT 适用和不适用的任务类型
5. 实现完整的 CoT 系统并评估效果

---

## 一、什么是 Chain-of-Thought

Chain-of-Thought（思维链）是一种引导模型**逐步推理**的技术。与其让模型直接给出答案，不如让它展示推理过程。

```
传统方式 vs CoT:

┌─────────────────────────────────────────────────────┐
│  传统方式 (直接回答)                                   │
│                                                      │
│  问题: "小明有 5 个苹果，给了小红 2 个，又买了 3 个，   │
│         最后有几个？"                                  │
│                                                      │
│  输出: "6 个"                                         │
│                                                      │
│  → 模型直接跳到答案，中间推理过程不可见                  │
│  → 复杂问题容易出错                                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  CoT 方式 (逐步推理)                                  │
│                                                      │
│  问题: 同上                                           │
│                                                      │
│  输出: "让我一步步思考:                                │
│         1. 小明开始有 5 个苹果                         │
│         2. 给了小红 2 个: 5 - 2 = 3 个                │
│         3. 又买了 3 个: 3 + 3 = 6 个                  │
│         所以最后有 6 个苹果。"                          │
│                                                      │
│  → 推理过程透明，可验证                                │
│  → 每一步都可检查，错误可定位                           │
└─────────────────────────────────────────────────────┘
```

**CoT 为什么有效？**

```
CoT 的工作原理:

传统方式:
  问题 → [单次前向传播] → 答案
          ↑
     模型试图一次性"猜"出答案

CoT 方式:
  问题 → [步骤1] → [步骤2] → [步骤3] → 答案
              ↑         ↑         ↑
         中间结果作为下一步的输入

类比:
  传统方式 = 心算 (一次性算出结果)
  CoT 方式 = 竖式计算 (逐步得出结果)
```

---

## 二、CoT 的三种形式

### 2.1 Zero-shot CoT

最简单的 CoT 形式——只需在 Prompt 末尾添加"让我们一步步思考"。

```
Zero-shot CoT:

Prompt: "问题: {question}\n\n让我们一步步思考:"

示例:
  问题: "一个商店打 8 折，原价 200 元的商品现在多少钱？"

  Zero-shot: "160 元"
  Zero-shot CoT: "让我们一步步思考:
    1. 原价是 200 元
    2. 打 8 折意味着支付原价的 80%
    3. 200 × 0.8 = 160 元
    所以现在价格是 160 元。"

触发词变体:
  - "Let's think step by step" (英文)
  - "让我们一步步思考" (中文)
  - "请逐步推理" (中文)
  - "Take a deep breath and work on this step-by-step" (更强版本)
```

### 2.2 Manual CoT（手动思维链）

在 Prompt 中手动提供推理示例，让模型学习推理模式。

```
Manual CoT 结构:

┌──────────────────────────────────────────┐
│  示例 (包含推理过程):                      │
│                                          │
│  问题: "甲比乙大 5 岁，乙 10 岁，甲几岁？"  │
│  推理:                                    │
│    - 乙的年龄: 10 岁                      │
│    - 甲比乙大 5 岁: 10 + 5 = 15 岁       │
│  答案: 甲 15 岁                           │
│                                          │
│  新问题:                                  │
│  "丙比甲小 3 岁，丙几岁？"                 │
│  推理: (模型生成)                          │
└──────────────────────────────────────────┘
```

### 2.3 Auto-CoT（自动思维链）

使用 Zero-shot CoT 自动生成多个推理链，然后选择最佳的。

```
Auto-CoT 流程:

┌──────────┐    ┌──────────────┐    ┌──────────┐
│  输入问题  │───→│ Zero-shot CoT │───→│ 生成多个  │
│          │    │ (多次采样)     │    │ 推理链    │
└──────────┘    └──────────────┘    └────┬─────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │ 选择/聚合     │
                                  │ 最佳推理链    │
                                  └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │   最终答案    │
                                  └──────────────┘
```

---

## 三、CoT 适用场景分析

```
CoT 效果矩阵:

任务类型              │ CoT 效果 │ 原因
─────────────────────┼──────────┼──────────────────────
多步数学推理          │ ★★★★★   │ 必须逐步计算
逻辑推理              │ ★★★★★   │ 需要因果链条
代码调试              │ ★★★★☆   │ 需要追踪执行流
常识推理              │ ★★★☆☆   │ 有时需要，有时不需要
文本摘要              │ ★☆☆☆☆   │ 不需要逐步推理
翻译                  │ ★☆☆☆☆   │ 直接映射即可
创意写作              │ ★☆☆☆☆   │ 可能限制创意
简单分类              │ ★☆☆☆☆   │ 过度复杂化
```

**什么时候使用 CoT**：

```
使用 CoT 的判断流程:

                    这个任务需要推理吗？
                           │
                    ┌──────┴──────┐
                    │             │
                   是             否
                    │             │
                    ▼             ▼
            步骤多吗？        直接回答即可
                    │         (不需要 CoT)
             ┌──────┴──────┐
             │             │
            是             否
             │             │
             ▼             ▼
      使用 CoT        可选 CoT
      效果显著        效果一般
```

---

## 四、CoT 的变体与进阶

### 4.1 Self-Consistency（自一致性）

多次运行 CoT，取多数票作为最终答案。

```
Self-Consistency 流程:

问题 → CoT 采样 1 → 答案 A ─┐
问题 → CoT 采样 2 → 答案 B ─┼→ 多数票 → 最终答案
问题 → CoT 采样 3 → 答案 A ─┤
问题 → CoT 采样 4 → 答案 A ─┤
问题 → CoT 采样 5 → 答案 B ─┘

答案 A 出现 3 次，答案 B 出现 2 次
→ 最终答案: A
```

### 4.2 Tree-of-Thought（思维树）

将思维链扩展为树状结构，每个节点可以有多个分支。

```
Tree-of-Thought:

                    问题
                   / | \
                  /  |  \
              思路1 思路2 思路3
              / \   |   / \
             /   \  |  /   \
           步骤  步骤 步骤 步骤 步骤
            │     │   │    │    │
            ▼     ▼   ▼    ▼    ▼
           评估  评估 评估 评估  评估
             \    |   |   /    /
              \   |   |  /   /
               选择最佳路径
                   │
                   ▼
                最终答案
```

---

## 五、代码实战

### 5.1 基础 CoT 实现

```python
from openai import OpenAI

client = OpenAI()

def zero_shot_cot(question: str, model: str = "gpt-4o-mini") -> dict:
    """Zero-shot Chain-of-Thought"""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "user", "content": f"{question}\n\n让我们一步步思考:"}
        ],
        temperature=0.0,
        max_tokens=500
    )

    reasoning = response.choices[0].message.content

    # 提取最终答案 (假设答案在最后一行)
    lines = reasoning.strip().split("\n")
    answer = lines[-1] if lines else reasoning

    return {
        "reasoning": reasoning,
        "answer": answer,
        "tokens": response.usage.total_tokens
    }

def direct_answer(question: str, model: str = "gpt-4o-mini") -> dict:
    """直接回答 (无 CoT)"""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "user", "content": question}
        ],
        temperature=0.0,
        max_tokens=100
    )

    return {
        "answer": response.choices[0].message.content,
        "tokens": response.usage.total_tokens
    }

# 测试对比
questions = [
    "一个水池有两个水管，A 管每小时注水 3 吨，B 管每小时排水 1 吨。水池容量 20 吨，从空开始多久能注满？",
    "小明买了 3 本书和 2 支笔，共花了 55 元。已知一本书比一支笔贵 10 元，请问书和笔各多少钱？",
    "一列火车长 200 米，以 72km/h 的速度通过一座 800 米长的桥，需要多少秒？",
]

print("=== CoT vs 直接回答 对比 ===\n")

for q in questions:
    print(f"问题: {q}\n")

    direct = direct_answer(q)
    cot = zero_shot_cot(q)

    print(f"直接回答 ({direct['tokens']} tokens):")
    print(f"  {direct['answer']}\n")

    print(f"CoT 回答 ({cot['tokens']} tokens):")
    print(f"  {cot['reasoning']}\n")

    print("-" * 60)
```

### 5.2 Manual CoT 实现

```python
from openai import OpenAI

client = OpenAI()

class ManualCoTPrompter:
    """手动思维链 Prompt 系统"""

    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model
        self.examples: list[dict] = []

    def add_example(
        self,
        question: str,
        reasoning_steps: list[str],
        answer: str
    ):
        """添加带推理过程的示例"""
        self.examples.append({
            "question": question,
            "reasoning_steps": reasoning_steps,
            "answer": answer
        })

    def solve(self, question: str) -> dict:
        """使用 CoT 解决问题"""
        messages = [
            {"role": "system", "content": 
             "你是一个善于逐步推理的助手。对于每个问题，先展示详细的推理步骤，再给出最终答案。"
             "推理步骤用编号列表，每步一个结论。最终答案用"最终答案:"开头。"}
        ]

        # 添加示例
        for ex in self.examples:
            reasoning = "\n".join(f"  {i+1}. {step}" for i, step in enumerate(ex["reasoning_steps"]))
            example_text = f"""问题: {ex['question']}
推理过程:
{reasoning}
最终答案: {ex['answer']}"""

            messages.append({"role": "user", "content": f"问题: {ex['question']}"})
            messages.append({"role": "assistant", "content": example_text})

        # 添加新问题
        messages.append({"role": "user", "content": f"问题: {question}"})

        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.0,
            max_tokens=500
        )

        output = response.choices[0].message.content

        # 解析输出
        answer = ""
        if "最终答案:" in output:
            answer = output.split("最终答案:")[-1].strip()
        elif "最终答案：" in output:
            answer = output.split("最终答案：")[-1].strip()

        return {
            "reasoning": output,
            "answer": answer,
            "tokens": response.usage.total_tokens
        }


# 使用示例: 数学应用题 CoT
cot = ManualCoTPrompter()

# 添加推理示例
cot.add_example(
    question="一个长方形的周长是 36 厘米，长是宽的 2 倍，求面积。",
    reasoning_steps=[
        "设宽为 w，则长为 2w",
        "周长 = 2×(长+宽) = 2×(2w+w) = 6w",
        "已知周长 36 厘米: 6w = 36",
        "解得: w = 6 厘米",
        "长 = 2w = 12 厘米",
        "面积 = 长 × 宽 = 12 × 6 = 72 平方厘米"
    ],
    answer="72 平方厘米"
)

cot.add_example(
    question="甲乙两人从相距 100 公里的两地同时出发相向而行，甲每小时走 6 公里，乙每小时走 4 公里，几小时后相遇？",
    reasoning_steps=[
        "甲乙相向而行，速度相加: 6 + 4 = 10 公里/小时",
        "总距离: 100 公里",
        "相遇时间 = 总距离 ÷ 速度和 = 100 ÷ 10 = 10 小时"
    ],
    answer="10 小时"
)

# 测试新问题
new_questions = [
    "一个三角形的底是 10 厘米，高是 8 厘米，求面积。",
    "小明骑自行车从家到学校需要 15 分钟，速度是 200 米/分钟，家到学校有多远？",
    "一个工程队修一条路，第一天修了全长的 1/4，第二天修了全长的 1/3，还剩 500 米没修，这条路全长多少米？",
]

print("=== Manual CoT 数学解题 ===\n")
for q in new_questions:
    result = cot.solve(q)
    print(f"问题: {q}")
    print(f"推理过程:\n{result['reasoning']}")
    print(f"\n消耗: {result['tokens']} tokens")
    print("=" * 60)
```

### 5.3 Self-Consistency 实现

```python
from openai import OpenAI
from collections import Counter

client = OpenAI()

class SelfConsistencyCoT:
    """自一致性思维链 - 多次采样取多数票"""

    def __init__(self, model: str = "gpt-4o-mini", n_samples: int = 5):
        self.model = model
        self.n_samples = n_samples

    def solve(self, question: str) -> dict:
        """多次 CoT 采样，取多数票"""
        answers = []
        reasoning_chains = []

        for i in range(self.n_samples):
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": 
                     "你是一个善于推理的助手。请逐步推理，最后用"答案: XXX"给出最终答案。"},
                    {"role": "user", "content": f"{question}\n\n让我们一步步推理:"}
                ],
                temperature=0.7,  # 使用较高温度增加多样性
                max_tokens=300
            )

            output = response.choices[0].message.content
            reasoning_chains.append(output)

            # 提取答案
            answer = self._extract_answer(output)
            if answer:
                answers.append(answer)

        # 多数票投票
        if answers:
            answer_counts = Counter(answers)
            most_common = answer_counts.most_common(1)[0]
            final_answer = most_common[0]
            confidence = most_common[1] / len(answers)
        else:
            final_answer = "无法确定"
            confidence = 0.0

        return {
            "final_answer": final_answer,
            "confidence": confidence,
            "all_answers": answers,
            "answer_distribution": dict(Counter(answers)),
            "sample_chains": reasoning_chains[:2],  # 返回前两个推理链
            "total_tokens": sum(100 for _ in range(self.n_samples))  # 简化估算
        }

    def _extract_answer(self, text: str) -> str:
        """从推理文本中提取答案"""
        markers = ["答案:", "答案：", "Answer:", "结果是:", "结果是："]
        for marker in markers:
            if marker in text:
                answer = text.split(marker)[-1].strip()
                # 取第一行作为答案
                return answer.split("\n")[0].strip()
        return text.strip().split("\n")[-1].strip()


# 使用示例
sc = SelfConsistencyCoT(n_samples=5)

question = "一个班级有 45 人，男生比女生多 5 人，男生有多少人？"

print("=== Self-Consistency CoT ===\n")
print(f"问题: {question}\n")

result = sc.solve(question)

print(f"最终答案: {result['final_answer']}")
print(f"置信度: {result['confidence']:.0%}")
print(f"答案分布: {result['answer_distribution']}")
print(f"\n推理链示例 1:")
print(result['sample_chains'][0][:200] + "...")
print(f"\n推理链示例 2:")
print(result['sample_chains'][1][:200] + "...")
```

### 5.4 CoT 效果对比实验

```python
from openai import OpenAI
from dataclasses import dataclass
import time

client = OpenAI()

@dataclass
class Problem:
    question: str
    expected_answer: str
    category: str

def compare_cot_methods(
    problems: list[Problem],
    model: str = "gpt-4o-mini"
) -> dict:
    """对比不同 CoT 方法的效果"""
    results = {
        "direct": {"correct": 0, "total": 0, "tokens": 0},
        "zero_shot_cot": {"correct": 0, "total": 0, "tokens": 0},
        "manual_cot": {"correct": 0, "total": 0, "tokens": 0},
    }

    for problem in problems:
        # 1. 直接回答
        resp1 = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": problem.question}],
            temperature=0.0, max_tokens=100
        )
        answer1 = resp1.choices[0].message.content.strip()
        results["direct"]["tokens"] += resp1.usage.total_tokens
        results["direct"]["total"] += 1
        if problem.expected_answer.lower() in answer1.lower():
            results["direct"]["correct"] += 1

        # 2. Zero-shot CoT
        resp2 = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": f"{problem.question}\n\n让我们一步步思考:"}],
            temperature=0.0, max_tokens=300
        )
        answer2 = resp2.choices[0].message.content.strip()
        results["zero_shot_cot"]["tokens"] += resp2.usage.total_tokens
        results["zero_shot_cot"]["total"] += 1
        if problem.expected_answer.lower() in answer2.lower():
            results["zero_shot_cot"]["correct"] += 1

        # 3. Manual CoT (带示例)
        resp3 = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "你是一个善于推理的助手。逐步推理后用"答案: XXX"给出结果。"},
                {"role": "user", "content": "问题: 小明有 10 元，买了 3 个 2 元的苹果，还剩多少？"},
                {"role": "assistant", "content": 
                 "推理:\n1. 小明有 10 元\n2. 3 个苹果花费: 3 × 2 = 6 元\n3. 剩余: 10 - 6 = 4 元\n答案: 4 元"},
                {"role": "user", "content": problem.question}
            ],
            temperature=0.0, max_tokens=300
        )
        answer3 = resp3.choices[0].message.content.strip()
        results["manual_cot"]["tokens"] += resp3.usage.total_tokens
        results["manual_cot"]["total"] += 1
        if problem.expected_answer.lower() in answer3.lower():
            results["manual_cot"]["correct"] += 1

    return results

# 测试问题集
problems = [
    Problem("一个水池有两个水管，A 管每小时注水 3 吨，B 管每小时排水 1 吨。水池容量 20 吨，从空开始多久能注满？", "10", "数学"),
    Problem("小明买了 3 本书和 2 支笔，共花了 55 元。已知一本书比一支笔贵 10 元，请问书多少钱一本？", "15", "数学"),
    Problem("一列火车长 200 米，以 72km/h 的速度通过一座 800 米长的桥，需要多少秒？", "50", "物理"),
    Problem("鸡兔同笼，共有 35 个头，94 只脚，鸡有多少只？", "23", "数学"),
]

print("=== CoT 方法对比实验 ===\n")
results = compare_cot_methods(problems)

print(f"{'方法':<20} {'正确率':<10} {'Token 消耗':<15}")
print("-" * 45)
for method, stats in results.items():
    accuracy = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
    print(f"{method:<20} {accuracy:<10.0%} {stats['tokens']:<15}")
```

---

## 六、CoT 效果对比表

| 任务类型 | 直接回答 | Zero-shot CoT | Manual CoT | 推荐 |
|---------|---------|---------------|------------|------|
| 简单算术 | ✅ 通常正确 | ✅ 正确 | ✅ 正确 | 直接回答 |
| 多步数学 | ❌ 容易出错 | ⚠️ 部分正确 | ✅ 通常正确 | Manual CoT |
| 逻辑推理 | ⚠️ 不稳定 | ⚠️ 部分正确 | ✅ 通常正确 | Manual CoT |
| 代码调试 | ❌ 经常遗漏 | ✅ 有效 | ✅ 有效 | CoT |
| 文本摘要 | ✅ 足够 | ⚠️ 过度复杂 | ❌ 不适用 | 直接回答 |
| 创意写作 | ✅ 足够 | ❌ 限制创意 | ❌ 不适用 | 直接回答 |
| 常识问答 | ✅ 通常正确 | ⚠️ 看情况 | ⚠️ 看情况 | 视难度而定 |

---

## 七、常见误区

### 错误 1：对简单任务使用 CoT
```
❌ "1 + 1 = ? 让我们一步步思考:"
   → 过度复杂化，浪费 Token

✅ 简单任务直接回答，复杂任务才用 CoT
```

### 错误 2：CoT 推理链过长
```
❌ 推理链超过 20 步
   → 模型可能在后面的步骤中出错或跑题

✅ 将复杂问题分解为子问题，每个子问题用独立的 CoT
```

### 错误 3：忽视 CoT 的验证
```
❌ 只看最终答案，不检查推理过程
   → 可能存在"正确答案+错误推理"的情况

✅ 定期检查推理链的逻辑一致性
```

### 错误 4：CoT 触发词选择不当
```
❌ "直接回答" (与 CoT 目标矛盾)
✅ "让我们一步步思考" / "请展示你的推理过程"
```

---

## 八、工程建议

1. **按任务复杂度选择 CoT 形式**：简单推理用 Zero-shot CoT（加一句"让我们一步步思考"），复杂推理用 Manual CoT（带推理示例），高置信度场景用 Self-Consistency（多次采样投票）。
2. **控制推理链长度**：单条推理链建议不超过 10 步，超过时将问题拆分为子问题，每个子问题独立推理。
3. **始终验证推理过程**：不要只看最终答案，定期抽查推理链的逻辑一致性，防止"正确答案+错误推理"的假阳性。
4. **CoT 会增加 Token 成本**：Self-Consistency 采样 5 次意味着 5 倍 API 调用，生产环境需在准确率和成本之间权衡。

---

## 九、总结

```
CoT 技术选择流程:

                任务需要推理吗？
                     │
              ┌──────┴──────┐
              │             │
             是             否
              │             │
              ▼             ▼
        推理复杂吗？    直接回答
              │
       ┌──────┴──────┐
       │             │
      是             否
       │             │
       ▼             ▼
  Manual CoT    Zero-shot CoT
  (带示例)      ("一步步思考")
       │
       ▼
  需要高置信度？
       │
  ┌────┴────┐
  │         │
  是        否
  │         │
  ▼         ▼
Self-      单次
Consistency CoT
```

**核心要点**：
1. CoT 通过展示推理过程提升复杂任务的准确率
2. Zero-shot CoT 简单有效，Manual CoT 更加精确
3. Self-Consistency 通过多次采样提高置信度
4. CoT 最适合数学、逻辑、代码调试等推理密集型任务
5. 简单任务不需要 CoT，反而会增加成本和复杂度

---

## 练习

### 练习 1：CoT vs 直接回答
选择 5 道数学应用题，分别用直接回答和 Zero-shot CoT 测试，记录：
- 答案正确率
- Token 消耗差异
- 推理过程是否可验证

### 练习 2：Manual CoT 示例设计
为"逻辑推理"任务设计 3 个高质量的 CoT 示例，要求：
- 推理步骤清晰，每步一个结论
- 包含不同类型的逻辑问题
- 示例难度递进

### 练习 3：Self-Consistency 实验
实现一个 Self-Consistency 系统，测试以下参数对准确率的影响：
- 采样次数: 1, 3, 5, 7
- Temperature: 0.3, 0.5, 0.7, 1.0

绘制准确率随参数变化的曲线，找出最优配置。


---

**下一课**: [阶段实战 - Prompt 设计练习](./06-阶段实战-Prompt设计练习.md)
