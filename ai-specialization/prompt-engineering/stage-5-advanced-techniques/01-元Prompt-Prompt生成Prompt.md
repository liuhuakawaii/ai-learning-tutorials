# 元 Prompt：Prompt 生成 Prompt

> Stage 5 · 第 1 课 | 前置：完成 Stage 1-4 | 预计 30 分钟

---

你的团队有 50 个业务场景需要 Prompt，每个都要精心设计角色、格式、约束和示例。手动写不仅慢，风格还不统一。当业务变了，要逐个改。

能不能让模型帮你写 Prompt？这就是 Meta-Prompting——用 Prompt 生成 Prompt。

## 核心思路

Meta-Prompting 不是什么魔法，就是把"写 Prompt"这个任务本身交给模型。

```
用户目标 → Meta-Prompt → LLM → 生成的 Prompt → 用生成的 Prompt 执行任务
```

为什么这比直接写 Prompt 好？

| 场景 | 直接写 | Meta-Prompting |
|------|--------|----------------|
| 50 个场景 | 写 50 个 Prompt | 写 1 个生成模板 |
| 质量一致性 | 靠人的水平 | 模板保证结构一致 |
| 需求变化 | 逐个修改 | 改模板，重新生成 |

## 基础：生成模板

最简单的 Meta-Prompt 是一个结构化的生成请求：

```python
import openai
import json

client = openai.OpenAI()

META_PROMPT = """你是 Prompt 工程师。根据用户提供的任务描述，生成一个高质量的 System Prompt。

## 输出格式（严格 JSON）
{
  "system_prompt": "生成的系统提示词",
  "user_template": "用户输入模板，用 {{input}} 表示变量",
  "examples": [{"input": "示例输入", "output": "示例输出"}]
}

只输出 JSON，不要其他内容。"""

def generate_prompt(task_description: str) -> dict:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": META_PROMPT},
            {"role": "user", "content": f"任务描述：{task_description}"},
        ],
        temperature=0.3,  # 生成需要一点创造性
    )
    return json.loads(resp.choices[0].message.content)

# 使用
result = generate_prompt("将英文技术文档翻译成中文，保持术语准确，代码不翻译")
print(json.dumps(result, ensure_ascii=False, indent=2))
```

生成的 Prompt 可能比你自己写的更好——因为模型见过大量 Prompt，知道什么结构效果好。

## 进阶：带评估的迭代生成

生成一次不一定好。加一个评估-迭代循环：

```python
def generate_and_evaluate(task_description: str, test_input: str, iterations: int = 3) -> dict:
    """生成 Prompt → 测试 → 评估 → 改进，迭代 N 次"""
    current_prompt = None
    best_result = None

    for i in range(iterations):
        # 生成或改进 Prompt
        if current_prompt is None:
            generated = generate_prompt(task_description)
        else:
            generated = improve_prompt(current_prompt, test_input, last_output, feedback)

        system_prompt = generated["system_prompt"]

        # 用生成的 Prompt 执行任务
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": test_input},
            ],
            temperature=0,
        )
        last_output = resp.choices[0].message.content

        # 评估输出质量
        score = evaluate_output(task_description, test_input, last_output)

        if best_result is None or score > best_result["score"]:
            best_result = {"prompt": generated, "output": last_output, "score": score}

        current_prompt = generated
        feedback = f"当前得分: {score}/10。输出: {last_output[:200]}"

    return best_result

def improve_prompt(current_prompt: dict, test_input: str, last_output: str, feedback: str) -> dict:
    """根据反馈改进 Prompt"""
    improve_meta = """你是 Prompt 工程师。根据上一版 Prompt 的执行结果和反馈，改进 Prompt。
输出格式同上（JSON）。"""

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": improve_meta},
            {"role": "user", "content": f"""
当前 Prompt: {json.dumps(current_prompt, ensure_ascii=False)}
测试输入: {test_input}
执行结果: {last_output}
反馈: {feedback}
请改进 Prompt。"""},
        ],
        temperature=0.3,
    )
    return json.loads(resp.choices[0].message.content)

def evaluate_output(task_description: str, input_text: str, output: str) -> float:
    """让模型评估输出质量，返回 1-10 分"""
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "你是 Prompt 质量评估专家。根据任务描述、输入和输出，评分 1-10。只输出数字。"},
            {"role": "user", "content": f"任务: {task_description}\n输入: {input_text}\n输出: {output}"},
        ],
        temperature=0,
    )
    try:
        return float(resp.choices[0].message.content.strip())
    except ValueError:
        return 5.0
```

## 实际应用：批量生成 Prompt

当你有多个类似场景时，用一个 Meta-Prompt 批量生成：

```python
def batch_generate_prompts(tasks: list[str]) -> list[dict]:
    results = []
    for task in tasks:
        result = generate_prompt(task)
        results.append({"task": task, **result})
    return results

tasks = [
    "将英文技术文档翻译成中文，术语保持英文",
    "从简历中提取姓名、技能、工作经历，输出JSON",
    "分析用户评论的情感倾向（正面/负面/中性）",
    "检查 Python 代码的安全漏洞",
    "根据产品描述生成营销文案",
]

prompts = batch_generate_prompts(tasks)
for p in prompts:
    print(f"任务: {p['task'][:30]}...")
    print(f"生成的 Prompt: {p['system_prompt'][:100]}...")
    print("---")
```

## Meta-Prompting 的边界

**适合的场景**：
- 任务描述清晰，但写 Prompt 没头绪
- 需要批量生成结构一致的 Prompt
- 作为 Prompt 设计的起点，后续人工微调

**不适合的场景**：
- 任务本身模糊——"帮我做个好用的 AI" 没法生成好 Prompt
- 需要深度领域知识——法律、医疗等专业 Prompt 需要专家参与
- 追求极致性能——Meta-Prompting 生成的是"80 分"的 Prompt，最后 20 分靠人工

**关键认知**：Meta-Prompting 是加速器，不是替代品。它帮你快速生成一个合理的起点，但最终的质量取决于你对任务的理解和对输出的评估。

## 动手

1. 用 `generate_prompt` 为一个你实际工作中的场景生成 Prompt
2. 把生成的 Prompt 直接调用 API，看输出质量
3. 用 `generate_and_evaluate` 迭代 3 次，对比第一版和最终版的差异
4. 思考：生成的 Prompt 哪些部分好，哪些需要你手动改？

## 小结

- Meta-Prompting 的本质是把"写 Prompt"的任务交给模型
- 适合批量生成、快速起步、保证结构一致性
- 加评估-迭代循环能显著提升生成质量
- 是加速器不是替代品，最终质量靠人工把关

下一课学习 Self-Consistency——用多次采样和投票提升输出可靠性。
