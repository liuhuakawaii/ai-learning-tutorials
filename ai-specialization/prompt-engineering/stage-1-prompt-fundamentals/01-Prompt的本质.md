# Prompt 的本质

> Stage 1 · 第 1 课 | 前置：Python 基础 | 预计 30 分钟

---

你写了 "请帮我分析这段代码"，模型返回了一段废话。你改成 "你是资深工程师，请分析以下代码的安全漏洞"，结果好了很多。为什么多加几个字，输出质量就差这么多？

要回答这个问题，得先搞清楚 Prompt 到底是什么——不是"指令"，不是"代码"，而是一段**概率性输入**。

## Prompt 不是命令，是概率引导

传统编程：输入 → 编译器 → 确定性输出。同一个函数调用一百次，结果完全一样。

Prompt：输入 → LLM → 概率性输出。同一个 Prompt 调用两次，结果可能不同。

这不是 bug，是 LLM 的工作方式。模型在每一步都在预测"下一个最可能的 Token 是什么"，而"最可能"是一个分布，不是唯一答案。

```python
import openai

client = openai.OpenAI()

# 同一个 Prompt，temperature=1.0 时两次调用结果不同
for i in range(2):
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "用一句话解释量子纠缠"}],
        temperature=1.0,
    )
    print(f"第{i+1}次: {resp.choices[0].message.content}")
```

理解这一点，后面所有 Prompt 技巧才有根基——你不是在写命令，而是在**调整概率分布**，让模型更可能输出你想要的结果。

## Token：模型的"阅读"单位

LLM 不认字，认 Token。一段文本在送进模型之前，会被分词器切成 Token 序列。

```
"Prompt Engineering"  →  ["Prompt", " Engineering"]     # 2 个 Token
"人工智能改变世界"    →  ["人工", "智能", "改变", "世界"]  # 4 个 Token
```

Token 数量决定两件事：
- **成本**：API 按 Token 计费，Prompt 越长越贵
- **窗口**：上下文窗口以 Token 计算，超了就丢信息

```python
import tiktoken

encoder = tiktoken.encoding_for_model("gpt-4o")
text = "Prompt Engineering 是一门关于如何与大语言模型有效沟通的技艺"
tokens = encoder.encode(text)
print(f"Token 数: {len(tokens)}")          # 通常 15-20 个
print(f"Token 列表: {[encoder.decode([t]) for t in tokens]}")
```

设计 Prompt 时，精简不只是为了省 Token，更是为了减少噪声——无关的 Token 会稀释注意力。

## Temperature：控制"大胆程度"

Temperature 是最常用的采样参数，控制输出的随机性：

- **0**：几乎确定性输出，每次选概率最高的 Token。适合分类、提取、代码生成。
- **1.0**：标准随机性，输出多样但可控。适合对话、创作。
- **>1.0**：高度随机，输出不可预测。一般不推荐。

```python
# 同一个 Prompt，不同 temperature 的效果差异
prompt = "写一个 Python 函数名，用于计算两个日期之间的工作日天数"

for temp in [0.0, 0.7, 1.2]:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=temp,
        max_tokens=20,
    )
    print(f"temp={temp}: {resp.choices[0].message.content}")
# temp=0.0:  几乎每次都输出同一个名字
# temp=0.7:  几个合理的名字之间切换
# temp=1.2:  可能输出完全不相关的东西
```

实际项目中，大多数场景用 `temperature=0` 就够了。需要多样性时（比如头脑风暴），再调高。

## System Prompt vs User Prompt

Chat 模型的消息结构分三种角色：

- **system**：定义模型的行为边界、角色、输出格式。用户通常看不到。
- **user**：用户的实际输入。
- **assistant**：模型的回复。

```python
resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": "你是一个代码审查助手，只回答与代码安全相关的问题，其他问题拒绝回答。"},
        {"role": "user", "content": "帮我看看这段代码有没有 SQL 注入风险：\nquery = f'SELECT * FROM users WHERE id={user_id}'"},
    ],
)
```

System Prompt 是你控制模型行为的主要手段。后面几课会反复用到它。

## 动手：体验 Token 和 Temperature 的影响

创建 `demo_token_temp.py`，运行并观察：

```python
import openai
import tiktoken

client = openai.OpenAI()
encoder = tiktoken.encoding_for_model("gpt-4o-mini")

system_prompt = "你是一个技术文档翻译助手，将英文翻译成中文，保持术语准确。"
user_input = "Transformer architecture uses self-attention mechanism to process sequences in parallel."

# 1. 查看 Token 数量
full_text = system_prompt + user_input
tokens = encoder.encode(full_text)
print(f"总 Token 数: {len(tokens)}")
print(f"  System: {len(encoder.encode(system_prompt))}")
print(f"  User:   {len(encoder.encode(user_input))}")

# 2. 对比不同 temperature
for temp in [0.0, 0.5, 1.0]:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ],
        temperature=temp,
    )
    print(f"\ntemp={temp}: {resp.choices[0].message.content}")
```

观察：
- Token 数是否和你预估的一致？
- temperature=0 时，多次运行结果是否完全相同？
- temperature=1.0 时，翻译用词有什么变化？

## 常见误解

**误解 1：Prompt 越长越好。**
不一定。无关信息会占用上下文窗口，分散注意力。精炼的 Prompt 往往比冗长的效果好。

**误解 2：Temperature=0 就是"正确答案"。**
Temperature=0 是确定性最高，不是质量最高。创意任务需要一定随机性。

**误解 3：Prompt 是一次性写好的。**
Prompt 是需要迭代的。第一版通常是方向性的，后续根据输出质量逐步调整。这门课的后续内容就是教你迭代的方法。

## 小结

- Prompt 是概率引导，不是确定性命令
- Token 是模型的处理单位，影响成本和窗口
- Temperature 控制输出的随机程度
- System Prompt 定义行为边界，User Prompt 提供具体输入
- Prompt 设计是一个迭代过程，不是一次写好

下一课开始学习具体的 Prompt 技巧——从最直接的指令型 Prompt 开始。
