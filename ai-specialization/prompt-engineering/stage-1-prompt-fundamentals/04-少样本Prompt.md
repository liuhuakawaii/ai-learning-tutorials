# Lesson 4: 少样本 Prompt

> **课程定位**：Prompt Engineering 入门课程 · Stage 1 第 4 课
> **前置要求**：完成 Lesson 1-3，理解指令型和角色型 Prompt
> **预计时长**：55 分钟

---

## 场景引入

你在做一个电商评论情感分类器，写了一条 Prompt 说"将评论分类为正面、负面、中性"，结果模型把"还行吧"判为正面，把"一般般"判为负面——分类边界完全混乱。你试着在 Prompt 里加了一句"参考以下示例"并贴了三条评论，准确率立刻从 60% 跳到 90%。这就是 Few-shot 的威力：有时候"教"模型比"告诉"模型更有效。但示例怎么选、选几个、按什么顺序排列，这些细节直接决定了效果的上限。

---

## 学习目标

完成本课后，你将能够：

1. 理解 Zero-shot、One-shot、Few-shot 的区别和适用场景
2. 掌握示例选择的关键策略：多样性、代表性、相关性
3. 了解示例顺序对模型输出的影响
4. 学会使用负面示例来约束输出边界
5. 实现动态示例选择的 Few-shot 系统

---

## 一、什么是 Few-shot Prompting

Few-shot Prompting 是通过在 Prompt 中提供少量示例来引导模型行为的技术。它是"以例教学"的方式，让模型从示例中学习你期望的输出模式。

```
Shot 数量与模型表现:

准确率
  ▲
  │                          ┌─────────────
  │                    ┌─────┘   Few-shot (3-5)
  │              ┌─────┘
  │        ┌─────┘             One-shot (1)
  │  ┌─────┘
  │──┘                       Zero-shot (0)
  │
  └──────────────────────────────────────────→ 任务复杂度

关键观察:
- Zero-shot: 对简单任务足够，复杂任务可能格式混乱
- One-shot:   显著提升格式一致性
- Few-shot:   进一步提升准确率，但边际收益递减
- 通常 3-5 个示例是最佳平衡点
```

---

## 二、三种 Shot 模式对比

```
┌─────────────────────────────────────────────────────────────┐
│                      Zero-shot                               │
│                                                              │
│  System: "将文本分类为正面/负面/中性"                          │
│  User:   "这部电影太棒了！"                                   │
│                                                              │
│  → 模型完全依赖预训练知识，无示例引导                          │
│  → 优点: Prompt 短，Token 消耗少                             │
│  → 缺点: 输出格式不稳定                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      One-shot                                │
│                                                              │
│  System: "将文本分类为正面/负面/中性"                          │
│  User:   "分类: '服务很好，但等了太久' → 混合/中性"            │
│  User:   "分类: '这部电影太棒了！' →"                        │
│                                                              │
│  → 一个示例建立了输出格式的"锚点"                             │
│  → 优点: 格式一致性显著提升                                  │
│  → 缺点: 示例可能不具代表性                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      Few-shot                                │
│                                                              │
│  System: "将文本分类为正面/负面/中性"                          │
│  User:   "示例1: '服务很好' → 正面"                          │
│  User:   "示例2: '等了两小时' → 负面"                        │
│  User:   "示例3: '还行吧' → 中性"                           │
│  User:   "分类: '这部电影太棒了！' →"                        │
│                                                              │
│  → 多个示例覆盖不同情况                                      │
│  → 优点: 准确率高，输出稳定                                  │
│  → 缺点: Token 消耗增加                                     │
└─────────────────────────────────────────────────────────────┘
```

**选择指南**：

| 场景 | 推荐模式 | 原因 |
|------|---------|------|
| 简单分类 | Zero-shot | 模型已有足够先验知识 |
| 格式要求严格 | One-shot | 一个示例即可锚定格式 |
| 复杂任务 | Few-shot | 多示例覆盖边界情况 |
| 领域专业任务 | Few-shot | 需要领域特定的示例 |
| Token 预算有限 | Zero/One-shot | 成本控制 |

---

## 三、示例选择策略

### 3.1 多样性原则

```
好的示例集应该覆盖不同情况:

情感分类示例选择:

❌ 差的示例 (全是正面):
   "这个产品太好了" → 正面
   "非常满意" → 正面
   "强烈推荐" → 正面
   → 模型可能偏向输出"正面"

✅ 好的示例 (覆盖不同类别):
   "这个产品太好了" → 正面
   "质量很差，很失望" → 负面
   "一般般，没什么特别的" → 中性
   → 模型学会了区分不同类别
```

### 3.2 代表性原则

```
示例应该代表真实场景的分布:

代码审查示例:

❌ 差的示例 (全是极端情况):
   示例1: 严重的安全漏洞
   示例2: 系统崩溃级 bug
   → 模型对普通代码也会过度警告

✅ 好的示例 (覆盖典型情况):
   示例1: 命名不规范 (建议级)
   示例2: 缺少错误处理 (警告级)
   示例3: SQL 注入风险 (严重级)
   → 模型学会了分级反馈
```

### 3.3 相关性原则

```
示例应与目标任务尽量相似:

任务: 分析电商用户评论

❌ 差的示例 (领域不匹配):
   示例: 新闻文章的情感分析
   → 语言风格和关注点不同

✅ 好的示例 (领域匹配):
   示例: 其他电商评论的分析
   → 语言风格和分析维度一致
```

---

## 四、示例顺序的影响

研究表明，示例的排列顺序会影响模型的输出：

```
顺序效应:

位置    示例内容        影响权重
─────────────────────────────
第1个   正面评论示例     ████████████  高 (首因效应)
第2个   负面评论示例     ████████      中
第3个   中性评论示例     ████████████  高 (近因效应)

推荐策略:
1. 最相关的示例放在第一个位置
2. 多样化的示例穿插排列
3. 最后一个示例的格式作为输出模板
```

**顺序实验代码**：

```python
from openai import OpenAI

client = OpenAI()

def test_example_ordering(text: str, examples: list[dict]) -> str:
    """测试示例顺序对输出的影响"""
    messages = [
        {"role": "system", "content": "将文本分类为: 正面、负面、中性。只输出分类结果。"}
    ]

    for ex in examples:
        messages.append({
            "role": "user",
            "content": f"分类: '{ex['text']}'"
        })
        messages.append({
            "role": "assistant",
            "content": ex["label"]
        })

    messages.append({"role": "user", "content": f"分类: '{text}'"})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.0,
        max_tokens=10
    )
    return response.choices[0].message.content

# 相同示例，不同顺序
examples_order_1 = [
    {"text": "太棒了！", "label": "正面"},
    {"text": "很差劲", "label": "负面"},
    {"text": "还行吧", "label": "中性"},
]

examples_order_2 = [
    {"text": "很差劲", "label": "负面"},
    {"text": "太棒了！", "label": "正面"},
    {"text": "还行吧", "label": "中性"},
]

test_text = "感觉一般"

result1 = test_example_ordering(test_text, examples_order_1)
result2 = test_example_ordering(test_text, examples_order_2)
print(f"顺序1结果: {result1}")
print(f"顺序2结果: {result2}")
```

---

## 五、负面示例的使用

负面示例告诉模型"什么是错误的"，帮助定义输出边界。

```
正面示例 vs 负面示例:

正面示例 (告诉模型做什么):
  "输入: 苹果 → 输出: 水果"

负面示例 (告诉模型不做什么):
  "输入: 苹果 → 错误输出: 公司 (这是错误的，应该输出水果类别)"

组合使用:
┌────────────────────────────────────────┐
│  正面示例: 定义正确的行为模式            │
│  负面示例: 定义错误的边界                │
│  组合效果: 模型更清楚"该做什么"和        │
│           "不该做什么"                   │
└────────────────────────────────────────┘
```

**负面示例的格式**：

```python
# 负面示例的常见写法
negative_example_formats = [
    # 格式1: 明确标注错误
    "错误示例: 输入'苹果' → '科技公司' ✗ (应该输出: 水果)",

    # 格式2: 对比正确和错误
    "✗ 错误: '苹果是科技公司' | ✓ 正确: '苹果是水果'",

    # 格式3: 纠正错误
    "用户说: '苹果是公司' → 这是错误的分类，正确答案是: 水果",
]
```

---

## 六、代码实战

### 6.1 Few-shot Prompt 实现

```python
from openai import OpenAI
from dataclasses import dataclass

client = OpenAI()

@dataclass
class Example:
    input_text: str
    output_text: str
    explanation: str = ""

class FewShotPrompter:
    """Few-shot Prompt 构建器"""

    def __init__(
        self,
        task_description: str,
        model: str = "gpt-4o-mini",
        temperature: float = 0.0
    ):
        self.task_description = task_description
        self.model = model
        self.temperature = temperature
        self.examples: list[Example] = []
        self.negative_examples: list[Example] = []

    def add_example(self, input_text: str, output_text: str, explanation: str = ""):
        """添加正面示例"""
        self.examples.append(Example(input_text, output_text, explanation))

    def add_negative_example(self, input_text: str, wrong_output: str, correct_output: str):
        """添加负面示例（错误示范）"""
        self.negative_examples.append(
            Example(input_text, f"错误: {wrong_output} → 正确: {correct_output}")
        )

    def build_messages(self, query: str) -> list[dict]:
        """构建完整的消息列表"""
        messages = [
            {"role": "system", "content": self.task_description}
        ]

        # 添加正面示例
        for ex in self.examples:
            user_content = ex.input_text
            assistant_content = ex.output_text
            if ex.explanation:
                assistant_content += f"\n({ex.explanation})"
            messages.append({"role": "user", "content": user_content})
            messages.append({"role": "assistant", "content": assistant_content})

        # 添加负面示例
        for neg in self.negative_examples:
            messages.append({"role": "user", "content": neg.input_text})
            messages.append({"role": "assistant", "content": neg.output_text})

        # 添加实际查询
        messages.append({"role": "user", "content": query})
        return messages

    def predict(self, query: str) -> str:
        """执行预测"""
        messages = self.build_messages(query)
        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=self.temperature,
            max_tokens=200
        )
        return response.choices[0].message.content

    def get_token_count(self) -> int:
        """估算 Token 消耗 (近似)"""
        messages = self.build_messages("placeholder")
        total_chars = sum(len(m["content"]) for m in messages)
        return total_chars // 4  # 粗略估算


# 使用示例: 代码语言分类器
classifier = FewShotPrompter(
    task_description="判断代码片段使用的编程语言。只输出语言名称。"
)

# 正面示例
classifier.add_example(
    input_text="def hello(): print('Hello World')",
    output_text="Python",
    explanation="def 关键字和 print 函数是 Python 特征"
)

classifier.add_example(
    input_text="function hello() { console.log('Hello'); }",
    output_text="JavaScript",
    explanation="function 关键字和 console.log 是 JavaScript 特征"
)

classifier.add_example(
    input_text="fn main() { println!(\"Hello\"); }",
    output_text="Rust",
    explanation="fn 关键字和 println! 宏是 Rust 特征"
)

# 负面示例
classifier.add_negative_example(
    input_text="print('hello')",
    wrong_output="JavaScript",
    correct_output="Python (没有分号，使用 print 而非 console.log)"
)

# 测试
test_cases = [
    "public static void main(String[] args) { System.out.println(\"Hi\"); }",
    "fmt.Println(\"Hello, World!\")",
    "SELECT * FROM users WHERE id = 1;",
]

print("=== 代码语言分类器 (Few-shot) ===\n")
for case in test_cases:
    result = classifier.predict(case)
    print(f"输入: {case[:50]}...")
    print(f"输出: {result}\n")

print(f"示例数量: {len(classifier.examples)} 正面 + {len(classifier.negative_examples)} 负面")
print(f"估算 Token: ~{classifier.get_token_count()}")
```

### 6.2 动态示例选择

```python
from openai import OpenAI
import numpy as np
from dataclasses import dataclass

client = OpenAI()

@dataclass
class LabeledExample:
    text: str
    label: str
    embedding: list[float] = None

class DynamicFewShotSelector:
    """基于相似度的动态示例选择器"""

    def __init__(
        self,
        examples: list[LabeledExample],
        model: str = "gpt-4o-mini",
        embedding_model: str = "text-embedding-3-small"
    ):
        self.examples = examples
        self.model = model
        self.embedding_model = embedding_model
        self._build_embeddings()

    def _get_embedding(self, text: str) -> list[float]:
        """获取文本的嵌入向量"""
        response = client.embeddings.create(
            model=self.embedding_model,
            input=text
        )
        return response.data[0].embedding

    def _build_embeddings(self):
        """为所有示例构建嵌入向量"""
        for ex in self.examples:
            if ex.embedding is None:
                ex.embedding = self._get_embedding(ex.text)

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        """计算余弦相似度"""
        a_np = np.array(a)
        b_np = np.array(b)
        return np.dot(a_np, b_np) / (np.linalg.norm(a_np) * np.linalg.norm(b_np))

    def select(self, query: str, k: int = 3) -> list[LabeledExample]:
        """选择与查询最相似的 k 个示例"""
        query_embedding = self._get_embedding(query)

        similarities = []
        for ex in self.examples:
            sim = self._cosine_similarity(query_embedding, ex.embedding)
            similarities.append((sim, ex))

        # 按相似度降序排序
        similarities.sort(key=lambda x: x[0], reverse=True)

        # 选择 top-k，但确保类别多样性
        selected = []
        selected_labels = set()

        for sim, ex in similarities:
            if len(selected) >= k:
                break
            # 优先选择不同类别的示例
            if ex.label not in selected_labels or len(selected) < k:
                selected.append(ex)
                selected_labels.add(ex.label)

        return selected

    def predict(self, query: str, k: int = 3) -> str:
        """使用动态选择的示例进行预测"""
        selected_examples = self.select(query, k)

        messages = [
            {"role": "system", "content": "将文本分类为: 正面、负面、中性。只输出分类结果。"}
        ]

        for ex in selected_examples:
            messages.append({"role": "user", "content": f"文本: '{ex.text}'"})
            messages.append({"role": "assistant", "content": ex.label})

        messages.append({"role": "user", "content": f"文本: '{query}'"})

        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.0,
            max_tokens=10
        )
        return response.choices[0].message.content


# 使用示例
examples = [
    LabeledExample("这个产品太棒了，强烈推荐！", "正面"),
    LabeledExample("质量很好，物超所值", "正面"),
    LabeledExample("非常满意这次购物体验", "正面"),
    LabeledExample("服务态度差，再也不来了", "负面"),
    LabeledExample("收到货发现是坏的，很失望", "负面"),
    LabeledExample("等了一个月才收到，差评", "负面"),
    LabeledExample("还行吧，没什么特别的", "中性"),
    LabeledExample("一般般，可以接受", "中性"),
    LabeledExample("不好不坏，中规中矩", "中性"),
]

selector = DynamicFewShotSelector(examples)

# 测试
test_texts = [
    "快递速度很快，包装也很好",
    "东西坏了，客服态度还很差",
    "凑合用吧，价格便宜"
]

print("=== 动态示例选择 Few-shot ===\n")
for text in test_texts:
    selected = selector.select(text, k=3)
    result = selector.predict(text, k=3)

    print(f"输入: '{text}'")
    print(f"选择的示例:")
    for ex in selected:
        print(f"  - [{ex.label}] {ex.text}")
    print(f"预测结果: {result}\n")
```

### 6.3 测量准确率 vs 示例数量

```python
from openai import OpenAI
from dataclasses import dataclass
import random

client = OpenAI()

@dataclass
class TestCase:
    input_text: str
    expected_label: str

def measure_accuracy(
    examples: list[dict],
    test_cases: list[TestCase],
    num_examples_list: list[int],
    model: str = "gpt-4o-mini"
) -> dict[int, float]:
    """测量不同示例数量下的准确率"""
    results = {}

    for num_examples in num_examples_list:
        if num_examples > len(examples):
            continue

        # 随机选择指定数量的示例
        selected = random.sample(examples, num_examples)

        correct = 0
        total = len(test_cases)

        for test in test_cases:
            messages = [
                {"role": "system", "content": "将文本分类为: 正面、负面、中性。只输出分类结果。"}
            ]

            for ex in selected:
                messages.append({"role": "user", "content": f"文本: '{ex['text']}'"})
                messages.append({"role": "assistant", "content": ex["label"]})

            messages.append({"role": "user", "content": f"文本: '{test.input_text}'"})

            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.0,
                max_tokens=10
            )

            prediction = response.choices[0].message.content.strip()
            if prediction == test.expected_label:
                correct += 1

        accuracy = correct / total
        results[num_examples] = accuracy
        print(f"示例数: {num_examples}, 准确率: {accuracy:.2%}")

    return results

# 准备数据
examples = [
    {"text": "太棒了，五星好评！", "label": "正面"},
    {"text": "质量很好，推荐购买", "label": "正面"},
    {"text": "非常满意，会回购", "label": "正面"},
    {"text": "超出预期，物超所值", "label": "正面"},
    {"text": "很差劲，浪费钱", "label": "负面"},
    {"text": "收到就是坏的，差评", "label": "负面"},
    {"text": "服务态度恶劣", "label": "负面"},
    {"text": "等了两个月才收到", "label": "负面"},
    {"text": "一般般，没什么感觉", "label": "中性"},
    {"text": "还行吧，凑合用", "label": "中性"},
    {"text": "不好不坏", "label": "中性"},
    {"text": "中规中矩", "label": "中性"},
]

test_cases = [
    TestCase("包装精美，快递很快", "正面"),
    TestCase("用了一天就坏了", "负面"),
    TestCase("马马虎虎，过得去", "中性"),
    TestCase("强烈推荐给朋友", "正面"),
    TestCase("客服态度太差了", "负面"),
]

# 运行实验
print("=== 示例数量 vs 准确率 ===\n")
results = measure_accuracy(
    examples=examples,
    test_cases=test_cases,
    num_examples_list=[0, 1, 2, 3, 5, 8]
)

# 可视化结果 (ASCII)
print("\n=== 准确率趋势图 ===\n")
for num, acc in sorted(results.items()):
    bar = "█" * int(acc * 40)
    print(f"  {num} 个示例: {bar} {acc:.0%}")
```

### 6.4 完整的 Few-shot 管道

```python
from openai import OpenAI
from dataclasses import dataclass, field
import json

client = OpenAI()

@dataclass
class FewShotConfig:
    task_description: str
    input_format: str
    output_format: str
    examples: list[dict] = field(default_factory=list)
    negative_examples: list[dict] = field(default_factory=list)
    max_examples: int = 5
    model: str = "gpt-4o-mini"
    temperature: float = 0.0

class FewShotPipeline:
    """完整的 Few-shot 处理管道"""

    def __init__(self, config: FewShotConfig):
        self.config = config

    def build_prompt(self, query: str) -> list[dict]:
        """构建完整的 Prompt"""
        messages = [
            {"role": "system", "content": self._build_system_prompt()}
        ]

        # 添加正面示例
        for ex in self.config.examples[:self.config.max_examples]:
            messages.append({
                "role": "user",
                "content": self.config.input_format.format(**ex["input"])
            })
            messages.append({
                "role": "assistant",
                "content": self.config.output_format.format(**ex["output"])
            })

        # 添加负面示例
        for neg in self.config.negative_examples:
            messages.append({
                "role": "user",
                "content": self.config.input_format.format(**neg["input"])
            })
            messages.append({
                "role": "assistant",
                "content": f"错误示范: {self.config.output_format.format(**neg['wrong_output'])}\n"
                          f"正确输出: {self.config.output_format.format(**neg['correct_output'])}"
            })

        # 添加查询
        messages.append({
            "role": "user",
            "content": self.config.input_format.format(text=query)
        })

        return messages

    def _build_system_prompt(self) -> str:
        """构建系统提示"""
        example_count = len(self.config.examples)
        return f"""{self.config.task_description}

输入格式: {self.config.input_format}
输出格式: {self.config.output_format}
已提供 {example_count} 个示例供参考。"""

    def predict(self, query: str) -> dict:
        """执行预测"""
        messages = self.build_prompt(query)

        response = client.chat.completions.create(
            model=self.config.model,
            messages=messages,
            temperature=self.config.temperature,
            max_tokens=200
        )

        raw_output = response.choices[0].message.content

        # 尝试解析 JSON 输出
        try:
            parsed = json.loads(raw_output)
        except json.JSONDecodeError:
            parsed = {"raw_output": raw_output}

        return {
            "prediction": parsed,
            "raw_output": raw_output,
            "tokens_used": response.usage.total_tokens,
            "num_examples_used": len(self.config.examples[:self.config.max_examples])
        }


# 使用示例: 产品评论分析器
config = FewShotConfig(
    task_description="分析产品评论，提取情感、主题和建议。",
    input_format="评论: '{text}'",
    output_format='{{"sentiment": "{sentiment}", "topic": "{topic}", "suggestion": "{suggestion}"}}',
    examples=[
        {
            "input": {"text": "这个手机电池续航太差了，一天要充三次"},
            "output": {"sentiment": "负面", "topic": "电池续航", "suggestion": "优化电池容量或省电模式"}
        },
        {
            "input": {"text": "拍照效果非常好，夜景也很清晰"},
            "output": {"sentiment": "正面", "topic": "拍照功能", "suggestion": "继续保持拍照优势"}
        },
        {
            "input": {"text": "外观设计一般，没什么特色"},
            "output": {"sentiment": "中性", "topic": "外观设计", "suggestion": "考虑更独特的设计语言"}
        }
    ],
    negative_examples=[
        {
            "input": {"text": "手机很好"},
            "wrong_output": {"sentiment": "正面", "topic": "整体", "suggestion": "无"},
            "correct_output": {"sentiment": "正面", "topic": "整体体验", "suggestion": "保持整体品质"}
        }
    ],
    max_examples=5
)

pipeline = FewShotPipeline(config)

# 测试
test_reviews = [
    "屏幕显示效果很细腻，看视频很舒服",
    "系统经常卡顿，用着很烦躁",
    "价格有点贵，但品质还不错"
]

print("=== 产品评论分析器 (Few-shot) ===\n")
for review in test_reviews:
    result = pipeline.predict(review)
    print(f"评论: '{review}'")
    print(f"分析: {json.dumps(result['prediction'], ensure_ascii=False, indent=2)}")
    print(f"消耗: {result['tokens_used']} tokens, 使用 {result['num_examples_used']} 个示例\n")
```

---

## 七、常见误区

### 错误 1：示例数量过多
```
❌ 提供 20 个示例
   → Token 消耗过高，且可能过拟合示例模式

✅ 3-5 个高质量示例通常足够
```

### 错误 2：示例缺乏多样性
```
❌ 所有示例都是同一类别/风格
   → 模型学到的模式有偏差

✅ 示例应覆盖不同类别、不同难度、不同情况
```

### 错误 3：示例格式不一致
```
❌ 示例1: "输入: xxx → 输出: yyy"
   示例2: "文本: xxx 分类: yyy"
   示例3: "xxx => yyy"
   → 模型困惑于不同的格式

✅ 所有示例使用统一的输入/输出格式
```

### 错误 4：忽略负面示例
```
❌ 只提供正面示例
   → 模型不知道什么是"错误的"

✅ 适当添加 1-2 个负面示例，明确边界
```

---

## 八、工程建议

1. **从 3 个示例起步**：3 个高质量、多样化的示例通常就能覆盖主要场景，先验证效果再考虑增加数量。
2. **用 Embedding 做动态示例选择**：当示例库较大时，用向量相似度为每个输入选择最相关的示例，比固定示例集效果更好。
3. **统一示例的输入输出格式**：所有示例使用完全一致的格式模板，格式混乱会让模型"学到"不一致的输出模式。
4. **记录示例的 Token 成本**：Few-shot 的主要代价是 Token 消耗，在示例数量和准确率之间找到成本最优的平衡点。

---

## 九、总结

```
Few-shot Prompt 设计清单:

□ 确定 Shot 数量 (0/1/3/5)
□ 选择代表性示例
□ 确保示例多样性
□ 统一示例格式
□ 考虑示例顺序
□ 添加负面示例 (可选)
□ 测试不同数量的效果
□ 评估 Token 成本
```

**核心要点**：
1. Few-shot 通过示例"教会"模型期望的输出模式
2. 3-5 个示例通常是最优数量，过多反而可能过拟合
3. 示例选择应遵循多样性、代表性、相关性原则
4. 示例顺序会影响输出，最相关的示例放在首位
5. 负面示例帮助定义输出边界，提高准确性

---

## 练习

### 练习 1：Shot 数量实验
选择一个分类任务（如垃圾邮件检测），分别测试：
- Zero-shot（无示例）
- One-shot（1 个示例）
- Few-shot-3（3 个示例）
- Few-shot-5（5 个示例）

记录每种方式的准确率和 Token 消耗，绘制准确率-成本曲线。

### 练习 2：示例选择策略
针对"代码风格检测"任务，设计 3 种不同的示例选择策略：
1. 随机选择
2. 基于相似度选择
3. 基于多样性选择

比较三种策略的准确率差异。

### 练习 3：构建 Few-shot 模板
设计一个可复用的 Few-shot 模板系统，要求：
- 支持动态添加示例
- 支持正面和负面示例
- 自动计算 Token 消耗
- 支持示例的随机采样

用至少 2 个不同任务测试你的模板系统。


---

## 参考答案

### 练习 1：Shot 数量实验

**思路**：用垃圾邮件检测任务对比 Zero-shot 到 Few-shot-5 的准确率和 Token 消耗。关键是准备一组有代表性的测试集和示例库，确保每种 Shot 数量的示例选择方式一致（随机抽样多次取平均）。

**答案**：

```python
from openai import OpenAI
import random

client = OpenAI()

examples_pool = [
    {"text": "恭喜您中奖 100 万，点击链接领取！", "label": "垃圾邮件"},
    {"text": "限时优惠！买一送一，仅剩最后 3 天！", "label": "垃圾邮件"},
    {"text": "您的账户存在异常，请立即验证密码", "label": "垃圾邮件"},
    {"text": "免费领取 iPhone，只需转发此消息", "label": "垃圾邮件"},
    {"text": "低价出售各种发票，联系 QQ: 123456", "label": "垃圾邮件"},
    {"text": "明天上午 10 点开会，请准时参加", "label": "正常邮件"},
    {"text": "附件是本周的项目进度报告", "label": "正常邮件"},
    {"text": "您的快递已到驿站，请及时取件", "label": "正常邮件"},
    {"text": "季度考核结果已出，请登录系统查看", "label": "正常邮件"},
    {"text": "会议纪要已发送，请查收确认", "label": "正常邮件"},
]

test_cases = [
    {"text": "日赚万元不是梦，加微信了解详情", "expected": "垃圾邮件"},
    {"text": "明天下午的团建活动改到周三", "expected": "正常邮件"},
    {"text": "恭喜发财！转发此消息领取红包", "expected": "垃圾邮件"},
    {"text": "请在周五前提交报销申请", "expected": "正常邮件"},
    {"text": "0 元购课，限时免费，名额有限", "expected": "垃圾邮件"},
]

def test_shot_count(num_shots: int, trials: int = 3) -> dict:
    total_correct = 0
    total_tokens = 0
    total_tests = 0

    for _ in range(trials):
        selected = random.sample(examples_pool, min(num_shots, len(examples_pool)))
        for test in test_cases:
            messages = [
                {"role": "system", "content": "将邮件分类为：垃圾邮件、正常邮件。只输出分类结果。"}
            ]
            for ex in selected:
                messages.append({"role": "user", "content": f"邮件: '{ex['text']}'"})
                messages.append({"role": "assistant", "content": ex["label"]})
            messages.append({"role": "user", "content": f"邮件: '{test['text']}'"})

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.0,
                max_tokens=10
            )
            prediction = response.choices[0].message.content.strip()
            total_tokens += response.usage.total_tokens
            total_tests += 1
            if prediction == test["expected"]:
                total_correct += 1

    return {
        "accuracy": total_correct / total_tests,
        "avg_tokens": total_tokens / total_tests,
        "shots": num_shots
    }

print("=== Shot 数量 vs 准确率 ===\n")
print(f"{'Shot数':<8} {'准确率':<10} {'平均Token':<12}")
print("-" * 30)

for n in [0, 1, 2, 3, 5]:
    result = test_shot_count(n)
    bar = "█" * int(result["accuracy"] * 20)
    print(f"{result['shots']:<8} {result['accuracy']:<10.0%} {result['avg_tokens']:<12.0f} {bar}")
```

**要点**：
- 通常 3 个示例就能达到接近最优的准确率，继续增加的边际收益递减
- Token 消耗与示例数量线性增长，需要在准确率和成本间找平衡点
- Zero-shot 对简单分类任务已经足够好，Few-shot 的优势在复杂或边界模糊的任务上更明显
- 多次随机抽样取平均能消除单次实验的随机性

---

### 练习 2：示例选择策略

**思路**：针对"代码风格检测"任务，设计三种示例选择策略并对比效果。关键差异在于：随机选择无策略、相似度选择依赖 Embedding、多样性选择确保覆盖不同风格问题。

**答案**：

```python
from openai import OpenAI
import random
import numpy as np

client = OpenAI()

# 示例库：代码风格问题
style_examples = [
    {"code": "def calc(x,y):return x+y", "issue": "缺少空格和类型注解", "severity": "轻微"},
    {"code": "def get_user(id):\n    user = db.query('SELECT * FROM users WHERE id=' + id)\n    return user", "issue": "SQL 注入风险", "severity": "严重"},
    {"code": "x = 1\nif x == 1:\n    print('one')\nelif x == 2:\n    print('two')\nelif x == 3:\n    print('three')\nelif x == 4:\n    print('four')", "issue": "应使用字典映射替代多重 if-elif", "severity": "建议"},
    {"code": "class data():\n    def __init__(self):\n        self.items = []\n    def Process(self):\n        for Item in self.items:\n            Item.Process()", "issue": "命名不符合 PEP 8（驼峰命名）", "severity": "轻微"},
    {"code": "try:\n    result = 1 / 0\nexcept:\n    pass", "issue": "空 except 吞掉所有异常", "severity": "严重"},
    {"code": "def func(a, b, c, d, e, f, g, h):\n    return a + b + c + d + e + f + g + h", "issue": "参数过多，应使用数据类或字典", "severity": "建议"},
    {"code": "import os\nimport sys\nimport json\nimport os\nimport re", "issue": "重复导入 os", "severity": "轻微"},
    {"code": "data = [i**2 for i in range(1000000)]\nresult = [x for x in data if x > 500000]", "issue": "列表推导式内存占用过高，应使用生成器", "severity": "严重"},
]

test_code = "def find_user(name):\n    conn = mysql.connect()\n    cursor = conn.cursor()\n    cursor.execute('SELECT * FROM users WHERE name=\"' + name + '\"')\n    result = cursor.fetchone()\n    conn.close()\n    return result"

def get_embedding(text: str) -> list[float]:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

def cosine_similarity(a, b) -> float:
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def random_selection(examples, k=3):
    return random.sample(examples, k)

def similarity_selection(examples, query_code, k=3):
    query_emb = get_embedding(query_code)
    scored = []
    for ex in examples:
        ex_emb = get_embedding(ex["code"])
        sim = cosine_similarity(query_emb, ex_emb)
        scored.append((sim, ex))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [ex for _, ex in scored[:k]]

def diversity_selection(examples, k=3):
    # 确保覆盖不同严重程度
    selected = []
    seen_severities = set()
    for severity in ["严重", "轻微", "建议"]:
        candidates = [ex for ex in examples if ex["severity"] == severity and ex not in selected]
        if candidates:
            selected.append(random.choice(candidates))
            seen_severities.add(severity)
    # 如果不够 k 个，随机补充
    remaining = [ex for ex in examples if ex not in selected]
    while len(selected) < k and remaining:
        selected.append(remaining.pop(random.randint(0, len(remaining)-1)))
    return selected

strategies = [
    ("随机选择", random_selection),
    ("相似度选择", lambda exs, k=3: similarity_selection(exs, test_code, k)),
    ("多样性选择", diversity_selection),
]

for name, strategy in strategies:
    selected = strategy(style_examples, k=3)
    messages = [
        {"role": "system", "content": "你是一位代码审查专家。分析代码风格问题，指出问题和严重程度（严重/轻微/建议）。"}
    ]
    for ex in selected:
        messages.append({"role": "user", "content": f"代码:\n{ex['code']}"})
        messages.append({"role": "assistant", "content": f"问题: {ex['issue']}\n严重程度: {ex['severity']}"})
    messages.append({"role": "user", "content": f"代码:\n{test_code}"})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.0,
        max_tokens=200
    )
    print(f"\n{'='*50}")
    print(f"[{name}] 选择的示例:")
    for ex in selected:
        print(f"  - [{ex['severity']}] {ex['issue']}")
    print(f"\n输出:\n{response.choices[0].message.content}")
```

**要点**：
- 相似度选择在输入与示例分布接近时效果最好，但依赖 Embedding 模型
- 多样性选择确保覆盖不同类型的风格问题，避免模型偏向某一类
- 随机选择是最简单的基线，通常不如前两种策略稳定

---

### 练习 3：构建 Few-shot 模板

**思路**：设计一个通用的 Few-shot 模板系统，支持动态示例管理、正负面示例、Token 估算和随机采样。关键是抽象出通用接口，使其能适配不同任务。

**答案**：

```python
from openai import OpenAI
from dataclasses import dataclass, field
import random

client = OpenAI()

@dataclass
class Example:
    input_text: str
    output_text: str
    is_negative: bool = False
    correct_output: str = ""

@dataclass
class FewShotTemplate:
    name: str
    task_description: str
    input_format: str
    output_format: str
    examples: list[Example] = field(default_factory=list)
    max_examples: int = 5
    model: str = "gpt-4o-mini"

class FewShotSystem:
    def __init__(self):
        self.templates: dict[str, FewShotTemplate] = {}

    def register(self, template: FewShotTemplate):
        self.templates[template.name] = template

    def add_example(self, template_name: str, input_text: str, output_text: str, is_negative: bool = False, correct_output: str = ""):
        self.templates[template_name].examples.append(
            Example(input_text, output_text, is_negative, correct_output)
        )

    def estimate_tokens(self, template_name: str, query: str) -> int:
        template = self.templates[template_name]
        total = len(template.task_description) + len(query)
        for ex in template.examples[:template.max_examples]:
            total += len(ex.input_text) + len(ex.output_text)
        return total // 4

    def predict(self, template_name: str, query: str, sample: bool = False) -> dict:
        template = self.templates[template_name]
        examples = template.examples[:]

        if sample and len(examples) > template.max_examples:
            examples = random.sample(examples, template.max_examples)
        else:
            examples = examples[:template.max_examples]

        messages = [{"role": "system", "content": template.task_description}]
        for ex in examples:
            if ex.is_negative:
                messages.append({"role": "user", "content": ex.input_text})
                messages.append({"role": "assistant", "content": f"错误示范: {ex.output_text}\n正确输出: {ex.correct_output}"})
            else:
                messages.append({"role": "user", "content": ex.input_text})
                messages.append({"role": "assistant", "content": ex.output_text})

        messages.append({"role": "user", "content": query})

        response = client.chat.completions.create(
            model=template.model,
            messages=messages,
            temperature=0.0,
            max_tokens=200
        )
        return {
            "result": response.choices[0].message.content,
            "tokens": response.usage.total_tokens,
            "examples_used": len(examples)
        }


# 任务 1: 情感分类
system = FewShotSystem()
system.register(FewShotTemplate(
    name="sentiment",
    task_description="将文本分类为：正面、负面、中性。只输出分类结果。",
    input_format="文本: '{text}'",
    output_format="{label}"
))
system.add_example("sentiment", "这个产品太棒了！", "正面")
system.add_example("sentiment", "质量很差，很失望", "负面")
system.add_example("sentiment", "还行吧，没什么特别的", "中性")
system.add_example("sentiment", "手机很好", "糟糕的分类：正面 → 正确：中性（信息不足）", is_negative=True, correct_output="中性")

# 任务 2: 代码语言识别
system.register(FewShotTemplate(
    name="lang_detect",
    task_description="判断代码片段使用的编程语言。只输出语言名称。",
    input_format="代码: {code}",
    output_format="{lang}"
))
system.add_example("lang_detect", "def hello(): print('Hi')", "Python")
system.add_example("lang_detect", "function hello() { console.log('Hi'); }", "JavaScript")
system.add_example("lang_detect", "fn main() { println!(\"Hi\"); }", "Rust")

# 测试
print("=== 任务 1: 情感分类 ===")
result1 = system.predict("sentiment", "快递很快，包装也很好")
print(f"结果: {result1['result']}, Token: {result1['tokens']}")

print(f"\n估算 Token: {system.estimate_tokens('sentiment', '测试文本')}")

print("\n=== 任务 2: 语言识别 ===")
result2 = system.predict("lang_detect", "fmt.Println(\"Hello\")", sample=True)
print(f"结果: {result2['result']}, Token: {result2['tokens']}")
```

**要点**：
- 模板系统的核心价值是"一次定义，多次复用"，不同任务只需注册不同模板
- Token 估算虽是近似值，但足以帮助在示例数量和成本间做决策
- 随机采样在示例库较大时特别有用，避免 Token 消耗失控
- 正负面示例的组合使用能显著提升边界情况的准确率

---

**下一课**: [思维链 Prompt](./05-思维链Prompt.md)
