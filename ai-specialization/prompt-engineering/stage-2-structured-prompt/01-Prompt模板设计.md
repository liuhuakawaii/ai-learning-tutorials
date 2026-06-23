# Prompt 模板设计

> Stage 2 · 第 1 课 | 前置：完成 Stage 1 | 预计 30 分钟

---

你的团队有 5 个人，每人写 Prompt 的风格不同。产品要支持 20 种分析场景，Prompt 散落在 30 多个文件里。改一个角色描述，全局搜索替换，漏改一个就出线上问题。

这不是 Prompt 写得不好的问题，是 Prompt 管理方式的问题。解决方案是：把 Prompt 当代码来管理——用模板。

## 硬编码 vs 模板

```python
# 硬编码：变量散落在代码里，改一个地方要找所有引用
prompt = f"你是一位资深的{role}，请用{style}的风格分析{topic}"

# 模板：变量声明式管理，模板独立于代码
template = """
你是一位资深的{{ role }}，请用{{ style }}的风格分析{{ topic }}。
"""
from jinja2 import Template
prompt = Template(template).render(role="数据分析师", style="简洁", topic="用户留存")
```

模板的核心收益不是"写起来方便"，而是：
- **改一个变量名，所有用到的地方自动更新**
- **模板可以单独测试，不需要跑完整业务逻辑**
- **模板文件可以进 Git，有 diff，有 review**

## Jinja2 模板基础

Prompt 模板用 Jinja2 是因为它支持条件、循环、继承，比 f-string 强得多。

```python
from jinja2 import Template

# 变量注入
t = Template("你是{{ role }}，分析以下{{ content_type }}：\n{{ content }}")
print(t.render(role="安全专家", content_type="代码", content="query = f'SELECT * WHERE id={id}'"))

# 条件分支：根据场景调整 Prompt
template = Template("""
你是一个{{ role }}。
{% if strict %}
严格遵循以下规则：
1. 只输出 JSON 格式
2. 不要添加任何解释
{% else %}
请以 Markdown 格式输出分析结果。
{% endif %}
""")

print(template.render(role="数据分析师", strict=True))
print(template.render(role="数据分析师", strict=False))

# 循环：动态生成 Few-shot 示例
template = Template("""
{% for example in examples %}
输入: {{ example.input }}
输出: {{ example.output }}
---
{% endfor %}
现在请处理: {{ user_input }}
""")

examples = [
    {"input": "苹果好吃", "output": "正面"},
    {"input": "太难吃了", "output": "负面"},
]
print(template.render(examples=examples, user_input="还行吧"))
```

## 模板继承：减少重复

当多个 Prompt 共享相同的角色定义或格式约束时，用继承避免重复：

```python
from jinja2 import Environment, FileSystemLoader

# base_prompt.j2
"""
你是一个{{ role }}。
你的回答必须：
- 使用{{ language }}
- 格式为{{ format }}
{% block task %}{% endblock %}
{% block examples %}{% endblock %}
"""

# analysis_prompt.j2
"""
{% extends "base_prompt.j2" %}
{% block task %}
分析以下内容，提取关键信息：
{{ content }}
{% endblock %}
"""
```

```python
env = Environment(loader=FileSystemLoader("templates/"))
t = env.get_template("analysis_prompt.j2")
prompt = t.render(role="数据分析师", language="中文", format="JSON", content="...")
```

这样 base_prompt 定义一次，analysis、generation、dialogue 等子模板各自继承，改基础规则只改一个文件。

## 设计模板的分层结构

一个 Prompt 模板通常由四层组成：

```
┌─────────────────────────────────┐
│  角色层：模型是谁               │  ← "你是资深安全工程师"
├─────────────────────────────────┤
│  任务层：要做什么               │  ← "审查以下代码"
├─────────────────────────────────┤
│  约束层：怎么输出               │  ← "按 JSON 格式，分三级"
├─────────────────────────────────┤
│  示例层：参考什么样的输入输出    │  ← Few-shot examples
└─────────────────────────────────┘
```

分层的好处是：改任务不需要动角色，改格式不需要动示例。耦合越低，维护成本越低。

```python
from jinja2 import Template

PROMPT_TEMPLATE = Template("""
{{ role }}

## 任务
{{ task }}

## 输出格式
{{ format }}

{% if examples %}
## 示例
{% for ex in examples %}
输入: {{ ex.input }}
输出: {{ ex.output }}
---
{% endfor %}
{% endif %}

## 约束
{{ constraints }}

## 用户输入
{{ user_input }}
""")

# 不同场景只换参数，不换模板
code_review = PROMPT_TEMPLATE.render(
    role="你是资深安全工程师，有 10 年代码审计经验。",
    task="审查以下代码，找出安全漏洞和性能问题。",
    format='输出 JSON: [{"issue": "...", "severity": "high/medium/low", "fix": "..."}]',
    constraints="只输出 JSON，不要额外解释。",
    examples=[{"input": "query = f'SELECT * WHERE id={id}'", "output": '[{"issue": "SQL注入", "severity": "high", "fix": "使用参数化查询"}]'}],
    user_input="请审查这段代码...",
)
```

## 动手：构建你的第一个模板

创建 `prompt_templates/` 目录，写一个分析模板：

```
prompt_templates/
├── base.j2           # 基础模板（角色 + 格式约束）
└── analysis.j2       # 分析模板（继承 base，加分析任务）
```

`base.j2`：
```jinja2
你是一个{{ role }}。
{% if language %}使用{{ language }}回答。{% endif %}
{% block task %}{% endblock %}
{% block format %}
输出格式：{{ format | default("Markdown") }}
{% endblock %}
```

`analysis.j2`：
```jinja2
{% extends "base.j2" %}
{% block task %}
## 任务
分析以下内容，提取关键信息：
{{ content }}
{% endblock %}
```

渲染并调用 API：

```python
from jinja2 import Environment, FileSystemLoader

env = Environment(loader=FileSystemLoader("prompt_templates/"))
t = env.get_template("analysis.j2")
prompt = t.render(role="数据分析师", language="中文", format="JSON", content="你的测试内容")

import openai
client = openai.OpenAI()
resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": prompt}],
    temperature=0,
)
print(resp.choices[0].message.content)
```

## 常见错误

**错误 1：模板里嵌太多业务逻辑。**
模板负责 Prompt 结构，不负责业务判断。if/else 用来控制格式，不用来写业务分支。

**错误 2：继承层级太深。**
base → category → subcategory → instance，四层以上改起来比硬编码还痛苦。两层通常够用。

**错误 3：变量名不语义化。**
`{{ v1 }}`、`{{ data }}`、`{{ text }}` 这种命名三个月后没人看得懂。用 `{{ user_query }}`、`{{ analysis_dimensions }}`。

## 小结

- 模板的核心收益是可维护性，不是写起来方便
- Jinja2 支持变量注入、条件、循环、继承，适合 Prompt 管理
- 分层设计：角色、任务、约束、示例分开管理
- 继承减少重复，但层级别太深
- 变量名要语义化，模板要进版本控制

下一课学习变量注入与动态 Prompt 的进阶用法。
