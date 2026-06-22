# Lesson 1: Prompt 的本质

> **课程定位**：Prompt Engineering 入门课程 · Stage 1 第 1 课
> **前置要求**：Python 基础，了解 API 调用概念
> **预计时长**：45 分钟

---

## 场景引入

你刚接手一个聊天机器人项目，写了一段 Prompt 发给 GPT-4，结果返回的格式每次都不一样——有时是 JSON，有时是 Markdown 表格，有时甚至是一段散文。你尝试加了更多描述，Token 消耗飙升但效果依然不稳定。问题出在哪？答案是：你还没有理解 Prompt 的本质——它不是代码指令，而是一段概率性输入，模型的分词方式、上下文窗口大小和采样温度都会深刻影响最终输出。

---

## 学习目标

完成本课后，你将能够：

1. 理解 Prompt 在大语言模型中的本质作用
2. 掌握 Tokenization（分词）的基本原理及其对 Prompt 设计的影响
3. 理解 Context Window（上下文窗口）的运作机制
4. 掌握 Temperature 和采样策略对输出的控制
5. 区分 Prompt Engineering 与传统编程的核心差异

---

## 一、什么是 Prompt？

Prompt 是你与大语言模型（LLM）沟通的**唯一界面**。它不是代码，不是命令，而是一段自然语言文本，引导模型生成你期望的输出。

```
┌─────────────────────────────────────────────────────┐
│                   传统编程模型                        │
│                                                      │
│   程序员 ──→ 精确语法 ──→ 编译器 ──→ 确定性输出       │
│                                                      │
├─────────────────────────────────────────────────────┤
│                 Prompt Engineering                   │
│                                                      │
│   用户 ──→ 自然语言 ──→ LLM ──→ 概率性输出           │
│              ↑                    ↑                   │
│          模糊可接受            有随机性                │
└─────────────────────────────────────────────────────┘
```

**核心区别**：传统编程要求你告诉计算机**怎么做**，Prompt Engineering 要求你告诉模型**做什么**。

---

## 二、LLM 如何理解 Prompt

### 2.1 Tokenization：模型的"阅读"方式

LLM 不直接阅读文本，而是先将文本切分成 **Token**（词元）。Token 是模型处理的最小单位。

```
原文: "Prompt Engineering is fascinating"

可能的分词结果:
┌──────────┬───────────────┬────────────┬──────────────┐
│ "Prompt" │ "Engineering" │    "is"    │ "fascinating"│
│  Token 1 │   Token 2     │  Token 3   │   Token 4    │
└──────────┴───────────────┴────────────┴──────────────┘

中文示例: "人工智能改变世界"
┌──────────┬────────┬────────┬────────┐
│  "人工"  │ "智能" │ "改变" │ "世界" │
│ Token 1  │Token 2 │Token 3 │Token 4 │
└──────────┴────────┴────────┴────────┘

注意: 不同模型的分词器不同，同一文本可能产生不同分词结果
```

**为什么分词很重要？**

- Token 数量直接影响 API 调用成本
- 上下文窗口以 Token 数量计算，而非字符数
- 某些词汇被拆分后可能丢失语义

### 2.2 Attention 机制简述

Transformer 架构的核心是 **Self-Attention**（自注意力）机制，它让模型能够理解 Token 之间的关系。

```
简化版 Self-Attention 流程:

输入: "The cat sat on the mat"

Step 1: 每个 Token 生成三个向量
        Query (Q)  - "我在找什么？"
        Key (K)    - "我能提供什么？"
        Value (V)  - "我的实际内容"

Step 2: 计算注意力分数
                    Q·K 相似度矩阵
         The  cat  sat  on  the  mat
  The  [ 1.0  0.2  0.1 0.0  0.8  0.1 ]
  cat  [ 0.2  1.0  0.7 0.1  0.1  0.3 ]  ← "cat" 和 "sat" 关联度高
  sat  [ 0.1  0.7  1.0 0.3  0.1  0.5 ]  ← "sat" 和 "mat" 关联度高
  on   [ 0.0  0.1  0.3 1.0  0.1  0.4 ]
  the  [ 0.8  0.1  0.1 0.0  1.0  0.2 ]
  mat  [ 0.1  0.3  0.5 0.4  0.2  1.0 ]

Step 3: 加权求和得到上下文表示

关键洞察: 注意力让模型知道哪些词相互关联
         → Prompt 的结构和用词直接影响模型的理解
```

### 2.3 Context Window（上下文窗口）

上下文窗口是模型一次能处理的最大 Token 数量。

```
┌──────────────── Context Window ─────────────────┐
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ System   │  │  User    │  │   Assistant    │  │
│  │ Message  │  │  Message │  │   Response     │  │
│  │ (指令)    │  │  (输入)   │  │   (生成中...)   │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│                                                  │
│  ◄────────── 总 Token 数 ≤ 上下文限制 ──────────► │
│                                                  │
│  模型 gpt-4o:     128,000 tokens                 │
│  模型 claude-3.5:  200,000 tokens                │
│  模型 gpt-4o-mini: 128,000 tokens                │
└──────────────────────────────────────────────────┘

当输入超过上下文窗口:
┌──────────┐  ┌──────────┐  ┌─────┐  ┌──────────┐
│ System   │  │  User    │  │ ... │  │ 被截断!  │
│ Message  │  │  Message │  │     │  │ 丢失信息  │
└──────────┘  └──────────┘  └─────┘  └──────────┘
```

**上下文窗口的设计启示**：
- 重要信息放在开头或结尾（Primacy / Recency 效应）
- 控制 Prompt 长度，为输出留出空间
- 超长 Prompt 可能导致关键信息被"淹没"

---

## 三、Temperature 与采样策略

### 3.1 Temperature（温度）

Temperature 控制输出的随机性，是最常用的生成参数。

```
Temperature 对概率分布的影响:

原始 logits: [2.0, 1.0, 0.5, 0.1, -1.0]

Temperature = 0.0 (近乎确定):
概率分布:   [0.95, 0.04, 0.01, 0.00, 0.00]
            ████████████████████ ▎ ▎
            → 几乎总是选择概率最高的词

Temperature = 0.7 (平衡):
概率分布:   [0.55, 0.25, 0.12, 0.06, 0.02]
            ███████████ ▊▊▊▊▊ ▎▎▎ ▎
            → 多样但仍倾向高概率词

Temperature = 1.5 (高随机性):
概率分布:   [0.35, 0.25, 0.18, 0.13, 0.09]
            ███████ ▊▊▊▊▊ ▎▎▎▎ ▎▎▎ ▎▎
            → 各词概率更均匀，输出更随机
```

**Temperature 选择指南**：

| 场景 | 推荐 Temperature | 原因 |
|------|-----------------|------|
| 代码生成 | 0.0 - 0.2 | 需要确定性和准确性 |
| 数据提取 | 0.0 - 0.1 | 输出格式必须精确 |
| 创意写作 | 0.7 - 1.0 | 需要多样性和创造力 |
| 头脑风暴 | 1.0 - 1.5 | 最大化创意发散 |
| 数学推理 | 0.0 - 0.2 | 逻辑推理需要确定性 |

### 3.2 Top-p（核采样）

Top-p 是另一种控制输出多样性的参数，与 Temperature 互补。

```
Top-p 采样过程示例:

候选词概率: [("the", 0.4), ("a", 0.3), ("one", 0.15), ("my", 0.1), ("this", 0.05)]

Top-p = 0.8:
  累积概率: "the"(0.4) → "a"(0.7) → "one"(0.85) ✓ 截止
  采样范围: ["the", "a", "one"]  ← 只从这三个词中选择

Top-p = 0.5:
  累积概率: "the"(0.4) → "a"(0.7) ✓ 截止
  采样范围: ["the", "a"]  ← 只从这两个词中选择
```

**最佳实践**：通常只调整 Temperature 或 Top-p 其中一个，不要同时使用。

---

## 四、Prompt Engineering vs 传统编程

| 维度 | 传统编程 | Prompt Engineering |
|------|---------|-------------------|
| 语言 | 形式化语言（Python, Java） | 自然语言（中文, 英文） |
| 确定性 | 相同输入 → 相同输出 | 相同 Prompt → 可能不同输出 |
| 调试 | 断点、日志、堆栈跟踪 | 迭代修改 Prompt、对比输出 |
| 错误处理 | try-catch、边界检查 | 添加约束、示例、兜底指令 |
| 复用性 | 函数、类、模块 | Prompt 模板、变量插值 |
| 版本控制 | Git diff 清晰可读 | 需要专门的 Prompt 管理工具 |
| 评估 | 单元测试、集成测试 | 人工评估、自动评估指标 |

```
思维模型对比:

传统编程:
  输入 → [确定性逻辑] → 输出
        if/else/loop

Prompt Engineering:
  输入 + Prompt → [概率性推理] → 输出
                   ↑
              模型内部状态
              (数十亿参数)
```

---

## 五、代码实战

### 5.1 使用 tiktoken 进行 Token 计数

```python
import tiktoken

# OpenAI 模型的分词器
def count_tokens(text: str, model: str = "gpt-4o") -> int:
    """计算文本的 Token 数量"""
    encoding = tiktoken.encoding_for_model(model)
    tokens = encoding.encode(text)
    return len(tokens)

def show_tokens(text: str, model: str = "gpt-4o") -> list[str]:
    """展示文本的分词结果"""
    encoding = tiktoken.encoding_for_model(model)
    tokens = encoding.encode(text)
    return [encoding.decode([t]) for t in tokens]

# 实验: 不同表达方式的 Token 效率
expressions = [
    "Please provide a summary of the article.",
    "Summarize the article.",
    "TL;DR:",
    "请总结这篇文章。",
    "帮我概括一下这篇文章的内容。",
]

print("=== Token 效率对比 ===")
for expr in expressions:
    tokens = count_tokens(expr)
    token_strs = show_tokens(expr)
    print(f"\n文本: {expr}")
    print(f"Token 数: {tokens}")
    print(f"分词结果: {token_strs}")

# 输出示例:
# 文本: Please provide a summary of the article.
# Token 数: 9
# 分词结果: ['Please', ' provide', ' a', ' summary', ' of', ' the', ' article', '.']
#
# 文本: Summarize the article.
# Token 数: 4
# 分词结果: ['Sum', 'mar', 'ize', ' the', ' article', '.']
```

### 5.2 不同 Prompt 产生不同输出

```python
from openai import OpenAI

client = OpenAI()

def compare_prompts(prompt_a: str, prompt_b: str, task: str) -> None:
    """对比两个不同 Prompt 的输出效果"""
    for label, prompt in [("Prompt A", prompt_a), ("Prompt B", prompt_b)]:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": task}
            ],
            temperature=0.7,
            max_tokens=200
        )
        result = response.choices[0].message.content
        tokens_used = response.usage.total_tokens
        print(f"\n{'='*50}")
        print(f"{label} (消耗 {tokens_used} tokens):")
        print(f"{'='*50}")
        print(result)

# 对比: 模糊指令 vs 具体指令
vague_prompt = "回答用户的问题。"
specific_prompt = """你是一位资深技术文档作者。请用以下格式回答:
1. 一句话概括
2. 2-3 个要点
3. 一个实际例子
使用简洁专业的语言，控制在 100 字以内。"""

task = "什么是 RESTful API？"

compare_prompts(vague_prompt, specific_prompt, task)
```

### 5.3 Temperature 实验

```python
from openai import OpenAI

client = OpenAI()

def temperature_experiment(prompt: str, temperatures: list[float]) -> None:
    """对比不同 Temperature 下的输出差异"""
    print(f"Prompt: {prompt}\n")

    for temp in temperatures:
        responses = []
        for i in range(3):  # 每个温度跑 3 次
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=temp,
                max_tokens=50
            )
            responses.append(response.choices[0].message.content)

        print(f"\nTemperature = {temp}:")
        for i, resp in enumerate(responses):
            # 截短显示
            display = resp[:80] + "..." if len(resp) > 80 else resp
            print(f"  第 {i+1} 次: {display}")

# 运行实验
temperature_experiment(
    "用一句话描述人工智能的未来。",
    temperatures=[0.0, 0.7, 1.5]
)

# 预期观察:
# Temperature 0.0: 三次输出几乎相同
# Temperature 0.7: 三次输出主题一致但措辞不同
# Temperature 1.5: 三次输出差异显著
```

### 5.4 上下文窗口管理

```python
import tiktoken

def estimate_context_usage(
    system_prompt: str,
    user_messages: list[str],
    max_tokens: int = 128000,
    reserve_for_output: int = 4000
) -> dict:
    """估算上下文窗口使用情况"""
    encoding = tiktoken.encoding_for_model("gpt-4o")

    system_tokens = len(encoding.encode(system_prompt))
    message_tokens = sum(len(encoding.encode(msg)) for msg in user_messages)

    total_input = system_tokens + message_tokens
    available = max_tokens - reserve_for_output
    usage_pct = (total_input / available) * 100

    return {
        "system_tokens": system_tokens,
        "message_tokens": message_tokens,
        "total_input_tokens": total_input,
        "max_tokens": max_tokens,
        "reserved_output": reserve_for_output,
        "available_tokens": available,
        "usage_percentage": round(usage_pct, 2),
        "remaining_tokens": available - total_input
    }

# 使用示例
system = "你是一位专业的 Python 代码审查员。"
messages = [
    "请审查以下代码...",
    "def add(a, b): return a + b" * 100,  # 模拟长代码
]

usage = estimate_context_usage(system, messages)
print(f"系统提示占用: {usage['system_tokens']} tokens")
print(f"用户消息占用: {usage['message_tokens']} tokens")
print(f"上下文使用率: {usage['usage_percentage']}%")
print(f"剩余可用: {usage['remaining_tokens']} tokens")
```

---

## 六、常见误区

### 错误 1：忽视 Token 成本
```
❌ 错误做法:
   "请你详细地、全面地、从各个角度分析这个问题，
    包括但不限于历史背景、当前现状、未来趋势、
    国内外对比、技术层面、商业层面、社会层面..."

✅ 正确做法:
   "请从技术、商业两个维度分析这个问题，
    每个维度 3 个要点，共 200 字以内。"
```

### 错误 2：混淆角色分工
```
❌ 错误做法:
   在 System Message 中放具体问题
   → System: "Python 的 GIL 是什么？请详细解释"
   → User: ""

✅ 正确做法:
   → System: "你是 Python 技术专家，用简洁语言回答技术问题。"
   → User: "Python 的 GIL 是什么？"
```

### 错误 3：Temperature 选择不当
```
❌ 错误做法:
   代码生成时使用 temperature=1.5
   → 输出可能包含语法错误

✅ 正确做法:
   代码生成时使用 temperature=0.0 或 0.1
```

---

## 七、工程建议

1. **上线前固定 Temperature**：生产环境的 Prompt 应明确设置 Temperature 和 Top-p，不要依赖默认值。代码生成和数据提取场景建议 Temperature=0.0。
2. **监控 Token 消耗**：为每次 API 调用记录 Token 使用量，设置预算告警。长 Prompt 优先考虑信息密度而非信息量。
3. **利用位置效应排列信息**：核心指令放在 Prompt 开头，输出格式要求放在末尾，中间放约束和示例。
4. **为上下文窗口预留余量**：不要把 Prompt 塞满整个上下文窗口，至少预留 20% 给模型的输出空间。

---

## 八、总结

```
本课知识图谱:

                    Prompt 的本质
                         │
          ┌──────────────┼──────────────┐
          │              │              │
     Tokenization   Context Window   Generation
     (分词机制)      (上下文窗口)     (生成控制)
          │              │              │
     ┌────┴────┐    ┌───┴───┐    ┌────┴────┐
     │ Token   │    │ 信息   │    │Temperature│
     │ 计数    │    │ 排列   │    │ Top-p   │
     │ 成本    │    │ 截断   │    │ 采样策略  │
     └─────────┘    └───────┘    └─────────┘
```

**核心要点**：
1. Prompt 是概率性输入，不是确定性指令
2. Token 是模型的最小处理单元，影响成本和上下文管理
3. Temperature 和 Top-p 控制输出的随机程度
4. 重要信息应放在 Prompt 的开头或结尾
5. Prompt Engineering 需要迭代优化，而非一次写对

---

## 练习

### 练习 1：Token 效率优化
使用 tiktoken 分析以下场景，找出 Token 效率最高的表达方式：
- 场景：要求模型将一段英文翻译成中文
- 尝试至少 5 种不同的 Prompt 表述
- 记录每种表述的 Token 数量和翻译质量

### 练习 2：Temperature 选型实验
针对以下三个任务，分别测试 temperature=0.0, 0.5, 1.0 的效果：
1. 生成一个 Python 函数来计算斐波那契数列
2. 写一首关于秋天的五言绝句
3. 列举 5 个创业点子

记录你的观察，并总结最佳 Temperature 选择策略。

### 练习 3：上下文窗口规划
假设你要构建一个代码审查助手，System Prompt 占 500 tokens，每次用户提交的代码平均 2000 tokens，模型需要输出 1500 tokens 的审查意见。模型上下文窗口为 128,000 tokens。
- 计算在不超出上下文限制的情况下，最多能支持多少轮对话？
- 设计一个策略来管理长对话的上下文


---

## 参考答案

### 练习 1：Token 效率优化

**思路**：用 tiktoken 对比不同翻译指令的 Token 消耗，找到表达相同意图时最精简的写法。关键在于区分"必要信息"和"冗余修饰"。

**答案**：

```python
import tiktoken

def count_tokens(text: str, model: str = "gpt-4o") -> int:
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(text))

prompts = [
    "Translate the following English text to Chinese.",
    "翻译成中文。",
    "英译中：",
    "Please translate this English passage into Chinese. Keep the original meaning accurate.",
    "EN→ZH:",
]

text = "Artificial intelligence is transforming the way we work and live."

print("=== 翻译指令 Token 效率对比 ===\n")
for prompt in prompts:
    full = f"{prompt}\n{text}"
    tokens = count_tokens(full)
    print(f"指令: {prompt}")
    print(f"Token 数: {tokens}\n")

# 最优: "英译中：" 或 "EN→ZH:" 仅需极少 Token 即可传达意图
# 但需注意过于简短可能降低翻译质量，需在效率和效果间平衡
```

**要点**：
- Token 数量与表达的信息量正相关，但存在优化空间
- 去掉"Please""the following""Keep the original meaning accurate"等冗余词可显著减少 Token
- 过于简短的指令（如"EN→ZH:"）可能牺牲翻译质量，需在成本和效果间权衡
- 中文指令通常比同等语义的英文指令消耗更多 Token

---

### 练习 2：Temperature 选型实验

**思路**：不同任务对确定性的需求不同。代码生成需要精确，创意写作需要多样性，创业点子需要发散。通过对比不同 Temperature 下的输出差异来验证。

**答案**：

```python
from openai import OpenAI

client = OpenAI()

tasks = [
    ("代码生成", "写一个 Python 函数，计算斐波那契数列第 n 项"),
    ("创意写作", "写一首关于秋天的五言绝句"),
    ("头脑风暴", "列举 5 个 AI 领域的创业点子"),
]

temperatures = [0.0, 0.5, 1.0]

for task_name, task_prompt in tasks:
    print(f"\n{'='*60}")
    print(f"任务: {task_name}")
    print(f"{'='*60}")
    for temp in temperatures:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": task_prompt}],
            temperature=temp,
            max_tokens=200
        )
        result = response.choices[0].message.content
        print(f"\n[Temperature={temp}]")
        print(result)
```

**观察总结**：
- **代码生成**：Temperature=0.0 输出最稳定，几乎每次相同；Temperature=1.0 可能引入语法差异
- **创意写作**：Temperature=0.0 输出单调重复；Temperature=0.7-1.0 措辞和意象更丰富
- **创业点子**：Temperature=0.0 点子雷同；Temperature=1.0 点子更多样、更有创意

**要点**：
- 代码和数据提取场景应使用低 Temperature（0.0-0.2）
- 创意和头脑风暴场景应使用高 Temperature（0.7-1.5）
- 同一任务在不同 Temperature 下的输出差异程度取决于任务本身的开放性
- 生产环境应固定 Temperature 值，避免依赖默认参数

---

### 练习 3：上下文窗口规划

**思路**：先计算每轮对话的 Token 消耗，再用总窗口减去系统提示和预留输出空间，最后除以单轮消耗得到最大轮数。长对话需要设计上下文压缩策略。

**答案**：

```python
import tiktoken

def calculate_max_turns(
    system_tokens: int = 500,
    per_turn_tokens: int = 2000,
    output_tokens: int = 1500,
    context_window: int = 128000
) -> dict:
    available = context_window - system_tokens - output_tokens
    max_turns = available // per_turn_tokens
    return {
        "context_window": context_window,
        "system_tokens": system_tokens,
        "output_reserve": output_tokens,
        "available_for_dialogue": available,
        "per_turn_tokens": per_turn_tokens,
        "max_turns": max_turns
    }

result = calculate_max_turns()
print(f"上下文窗口: {result['context_window']} tokens")
print(f"系统提示占用: {result['system_tokens']} tokens")
print(f"预留输出: {result['output_reserve']} tokens")
print(f"对话可用空间: {result['available_for_dialogue']} tokens")
print(f"每轮对话消耗: {result['per_turn_tokens']} tokens")
print(f"最大对话轮数: {result['max_turns']} 轮")

# 长对话上下文管理策略:
# 1. 滑动窗口: 只保留最近 N 轮对话，丢弃早期内容
# 2. 摘要压缩: 每隔 M 轮将历史对话压缩为摘要
# 3. 关键信息提取: 始终保留 System Prompt + 最近的代码上下文
# 4. 分层存储: 将完整历史存外部数据库，按需加载相关片段
```

**要点**：
- 最大对话轮数 = (上下文窗口 - 系统提示 - 输出预留) ÷ 每轮 Token 消耗
- 本例中约 63 轮对话，但实际应预留更多余量应对输入长度波动
- 长对话必须设计上下文管理策略，否则后期对话会丢失早期关键信息
- 滑动窗口 + 摘要压缩的组合策略在生产环境中最常用

---

**下一课**: [指令型 Prompt](./02-指令型Prompt.md)
