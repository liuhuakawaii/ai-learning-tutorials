# 阶段实战：Prompt 设计练习

> Stage 1 · 第 6 课（综合实战）| 前置：完成 01-05 | 预计 45 分钟

---

前 5 课你分别学了指令型、角色型、Few-shot 和 CoT 四种技巧。但面对真实需求时，问题不是"该用哪种"，而是"怎么组合"。这节课通过三个递进的练习，把这些技巧串成一个完整的设计流程。

## 练习一：代码审查助手

**目标**：设计一个能审查 Python 代码的 Prompt，按严重程度分类输出问题。

**要求**：
1. 能识别安全漏洞、性能问题、代码风格三类问题
2. 每个问题标注严重程度：🔴 严重 / 🟡 警告 / 🟢 建议
3. 给出修复建议

**步骤**：

```python
import openai

client = openai.OpenAI()

# 第一步：写出你的 Prompt
system_prompt = """在这里写你的 Prompt"""

# 第二步：用这段测试代码验证
test_code = '''
def get_user(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    result = db.execute(query)
    password = "admin123"
    return result
'''

resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请审查以下代码：\n```python\n{test_code}\n```"},
    ],
    temperature=0,
)
print(resp.choices[0].message.content)
```

**设计提示**：
- 先想清楚角色：你希望模型扮演什么样的审查者？
- 再定义输出格式：不约束格式，每次输出都不一样
- 最后加 Few-shot：给一个审查示例，让模型知道你期望的格式

**验证标准**：
- 是否能发现 SQL 注入（f-string 拼接）
- 是否能发现硬编码密码
- 输出格式是否每次一致

---

## 练习二：Prompt 对比工具

**目标**：写一个 Python 函数，能对比两个 Prompt 对同一输入的输出差异。

这不只是练习——这是你后续优化 Prompt 的核心工具。

```python
import openai
from dataclasses import dataclass

client = openai.OpenAI()

@dataclass
class CompareResult:
    prompt_a_output: str
    prompt_b_output: str
    input_text: str

def compare_prompts(
    system_a: str,
    system_b: str,
    user_input: str,
    model: str = "gpt-4o-mini",
) -> CompareResult:
    """对比两个 system prompt 对同一输入的输出"""
    def run(system: str) -> str:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_input},
            ],
            temperature=0,
        )
        return resp.choices[0].message.content

    return CompareResult(
        prompt_a_output=run(system_a),
        prompt_b_output=run(system_b),
        input_text=user_input,
    )

# 测试
result = compare_prompts(
    system_a="你是一个技术翻译，将英文翻译成中文。",
    system_b="你是资深技术文档翻译，翻译要求：1)术语保持英文原文 2)保留代码格式 3)意译而非直译",
    user_input="Use memoization to cache the result of expensive computations.",
)

print("=== Prompt A ===")
print(result.prompt_a_output)
print("\n=== Prompt B ===")
print(result.prompt_b_output)
```

**扩展**：给 `CompareResult` 加一个评分方法，让模型自己判断哪个输出更好（第 3 课会深入讲评估）。

---

## 练习三：综合设计——日志分析器

**目标**：设计一个 Prompt，能从杂乱的应用日志中提取结构化信息。

这是前两个练习的综合：你需要选择合适的技巧组合，并用对比工具验证效果。

**输入**（粘贴到你的代码里）：

```
2024-01-15 08:23:45 ERROR [auth-service] Login failed for user@test.com: invalid token, ip=192.168.1.100
2024-01-15 08:23:46 WARN  [auth-service] Rate limit approaching: 85/100 requests from 192.168.1.100
2024-01-15 08:24:01 ERROR [payment-service] Transaction txn_20240115_001 failed: insufficient balance, user=user@test.com, amount=299.00
2024-01-15 08:24:02 INFO  [payment-service] Retry scheduled for txn_20240115_001 in 30s
2024-01-15 08:24:15 ERROR [auth-service] Login failed for admin@company.com: account locked after 5 attempts, ip=10.0.0.55
2024-01-15 08:24:32 WARN  [payment-service] Retry 1/3 for txn_20240115_001 still failing
```

**期望输出格式**（这是你要通过 Prompt 约束的）：

```json
{
  "errors": [
    {
      "time": "2024-01-15 08:23:45",
      "service": "auth-service",
      "issue": "Login failed: invalid token",
      "user": "user@test.com",
      "severity": "high"
    }
  ],
  "warnings": [...],
  "summary": "2 个错误，2 个警告，涉及 auth-service 和 payment-service"
}
```

**设计流程**：
1. 先不写 Prompt，直接用自然语言告诉模型你要什么，看它输出什么格式
2. 根据实际输出，加上格式约束
3. 用 Few-shot 给一个输入输出示例
4. 用练习二的对比工具，测试你的 v1 和 v2 哪个好

---

## 自查清单

完成三个练习后，检查：

- [ ] 练习一：你的 Prompt 是否同时用了角色型 + 指令型 + Few-shot？
- [ ] 练习一：输出格式是否稳定（运行三次，格式是否一致）？
- [ ] 练习二：对比工具能否正常运行？
- [ ] 练习三：你迭代了几个版本？每版改了什么，效果有什么变化？
- [ ] 你是否理解了"组合技巧"而不是"堆叠技巧"的区别？

如果你发现练习三很难一次写好——恭喜，这正是 Prompt 工程的常态。下一阶段学习模板化管理，就是为了让这种迭代过程更可控。
