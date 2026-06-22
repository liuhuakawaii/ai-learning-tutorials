# Prompt 模板设计模式

> **课程定位**：Stage 2 - 结构化 Prompt 工程 · 第 1 课
> **前置要求**：完成 Stage 1，了解 Prompt 编写基础
> **预计用时**：45-60 分钟

---

## 场景引入

你的团队有 5 个开发者，每个人写 Prompt 的风格完全不同——有人用 f-string 拼接，有人用字符串 format，有人直接硬编码。当产品需要支持 20 种分析场景时，Prompt 散落在 30 多个文件里，改一个角色描述要全局搜索替换，稍有不慎就漏改。你需要的不是"更好的 Prompt"，而是一套模板系统——把 Prompt 当代码来管理，用模板继承、变量注入和版本控制来解决工程化问题。

---

## 学习目标

1. 理解模板化 Prompt 与硬编码 Prompt 的本质区别
2. 掌握基于槽位（Slot）的模板设计模式
3. 学会 Prompt 的 MVC 架构思想
4. 能用 Jinja2 构建可复用、可组合的 Prompt 模板系统

---

## 1. 为什么需要 Prompt 模板？

硬编码 Prompt 的典型问题：

```python
# ❌ 硬编码方式
prompt = f"你是一位资深的{role}，请用{style}的风格，分析以下关于{topic}的内容：{content}"
```

这种方式存在：
- **难以维护**：模板散落在代码各处
- **无法复用**：相似场景需要重复编写
- **缺乏验证**：变量注入无类型检查
- **版本混乱**：无法追踪 Prompt 的变更历史

---

## 2. 模板 vs 硬编码 Prompt

| 维度 | 硬编码 Prompt | 模板化 Prompt |
|------|--------------|--------------|
| 可维护性 | 低，修改需改代码 | 高，模板独立管理 |
| 可复用性 | 差，大量重复 | 强，一次定义多处使用 |
| 可测试性 | 困难 | 容易，可单独测试模板 |
| 版本控制 | 混在代码里 | 独立文件，清晰 diff |
| 动态性 | 需手动拼接 | 声明式变量注入 |
| 团队协作 | 难以共享 | 模板可跨团队复用 |

---

## 3. 模板架构总览

```
┌─────────────────────────────────────────────────────┐
│                  Prompt 模板系统架构                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │  模板层   │───▶│  渲染层   │───▶│  输出层   │      │
│  │ Template │    │ Renderer │    │  Output  │      │
│  └──────────┘    └──────────┘    └──────────┘      │
│       │               │               │             │
│       ▼               ▼               ▼             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │ 模板文件  │    │ 变量上下文 │    │ 最终Prompt│      │
│  │ (.j2/.md)│    │ (Context) │    │ (String) │      │
│  └──────────┘    └──────────┘    └──────────┘      │
│                                                     │
│  ┌──────────────────────────────────────────┐      │
│  │              模板继承体系                    │      │
│  │                                          │      │
│  │    ┌─────────────────────┐               │      │
│  │    │    base_prompt.j2   │  (基础模板)     │      │
│  │    └─────────┬───────────┘               │      │
│  │              │                           │      │
│  │      ┌───────┼───────┐                   │      │
│  │      ▼       ▼       ▼                   │      │
│  │  ┌──────┐┌──────┐┌──────┐               │      │
│  │  │分析型││生成型││对话型│  (子模板)       │      │
│  │  └──────┘└──────┘└──────┘               │      │
│  └──────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

---

## 4. 槽位（Slot）模板设计模式

槽位模板将 Prompt 分解为多个可替换的区域：

```
┌─────────────────────────────────────────┐
│            槽位模板结构                    │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  System Slot (系统角色定义)       │    │
│  │  [ROLE] [EXPERTISE] [TONE]      │    │
│  └─────────────────────────────────┘    │
│              │                          │
│              ▼                          │
│  ┌─────────────────────────────────┐    │
│  │  Context Slot (上下文信息)        │    │
│  │  [BACKGROUND] [CONSTRAINTS]     │    │
│  └─────────────────────────────────┘    │
│              │                          │
│              ▼                          │
│  ┌─────────────────────────────────┐    │
│  │  Task Slot (任务指令)            │    │
│  │  [INSTRUCTION] [EXAMPLES]       │    │
│  └─────────────────────────────────┘    │
│              │                          │
│              ▼                          │
│  ┌─────────────────────────────────┐    │
│  │  Output Slot (输出格式)          │    │
│  │  [FORMAT] [LENGTH] [STYLE]      │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## 5. MVC 模式在 Prompt 中的应用

```
┌───────────────────────────────────────────────────────┐
│                Prompt 的 MVC 架构                       │
├───────────────────────────────────────────────────────┤
│                                                       │
│   Model (数据模型)                                     │
│   ┌─────────────────────────────────────┐             │
│   │  - PromptSchema: 模板结构定义         │             │
│   │  - VariableType: 变量类型约束         │             │
│   │  - TemplateMetadata: 版本/作者/描述   │             │
│   └─────────────────────────────────────┘             │
│                     │                                  │
│                     ▼                                  │
│   View (模板视图)                                       │
│   ┌─────────────────────────────────────┐             │
│   │  - base.j2: 基础布局                  │             │
│   │  - analysis.j2: 分析类模板            │             │
│   │  - generation.j2: 生成类模板           │             │
│   └─────────────────────────────────────┘             │
│                     │                                  │
│                     ▼                                  │
│   Controller (渲染控制器)                               │
│   ┌─────────────────────────────────────┐             │
│   │  - PromptRenderer: 渲染引擎           │             │
│   │  - VariableInjector: 变量注入器        │             │
│   │  - OutputValidator: 输出校验器         │             │
│   └─────────────────────────────────────┘             │
└───────────────────────────────────────────────────────┘
```

---

## 6. 代码实战：Jinja2 模板系统

### 6.1 环境准备

```python
# requirements.txt
# jinja2>=3.1.0
# openai>=1.0.0
# pydantic>=2.0.0

import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from jinja2 import Environment, FileSystemLoader, select_autoescape
from openai import OpenAI
```

### 6.2 定义模板 Schema

```python
@dataclass
class PromptSlot:
    """Prompt 槽位定义"""
    name: str
    description: str
    required: bool = True
    default: Optional[str] = None
    slot_type: str = "text"  # text | choice | number

@dataclass
class PromptTemplate:
    """Prompt 模板元数据"""
    name: str
    version: str
    description: str
    author: str
    slots: list[PromptSlot] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    template_path: str = ""
```

### 6.3 构建模板渲染引擎

```python
class PromptRenderer:
    """Prompt 模板渲染引擎"""

    def __init__(self, template_dir: str = "templates"):
        self.template_dir = Path(template_dir)
        self.template_dir.mkdir(parents=True, exist_ok=True)

        self.env = Environment(
            loader=FileSystemLoader(str(self.template_dir)),
            autoescape=select_autoescape([]),
            trim_blocks=True,
            lstrip_blocks=True,
        )

        self._templates: dict[str, PromptTemplate] = {}

    def register(self, template: PromptTemplate) -> None:
        """注册模板元数据"""
        self._templates[template.name] = template

    def render(self, template_name: str, **kwargs) -> str:
        """渲染模板"""
        meta = self._templates.get(template_name)
        if not meta:
            raise ValueError(f"Template '{template_name}' not registered")

        # 填充默认值
        for slot in meta.slots:
            if slot.name not in kwargs and slot.default:
                kwargs[slot.name] = slot.default
            elif slot.name not in kwargs and slot.required:
                raise ValueError(f"Missing required slot: {slot.name}")

        template = self.env.get_template(meta.template_path)
        return template.render(**kwargs)
```

### 6.4 创建基础模板文件

```python
def create_base_templates(template_dir: str = "templates"):
    """创建基础模板文件"""
    base_path = Path(template_dir)

    # --- base.j2: 所有 Prompt 的基础模板 ---
    base_content = '''{# 基础 Prompt 模板 - 所有子模板继承此模板 #}
{% block system %}
你是一位{{ role | default("专业的助手") }}。
{% if expertise %}
你的专业领域包括：{{ expertise | join("、") }}。
{% endif %}
{% if tone %}
请使用{{ tone }}的语调进行回复。
{% endif %}
{% endblock system %}

{% block context %}
{% if background %}
## 背景信息
{{ background }}
{% endif %}
{% if constraints %}
## 约束条件
{% for constraint in constraints %}
- {{ constraint }}
{% endfor %}
{% endif %}
{% endblock context %}

{% block task %}
{% endblock task %}

{% block output %}
{% if output_format %}
## 输出格式要求
请严格按照以下格式输出：
{{ output_format }}
{% endif %}
{% if max_length %}
请将回复控制在 {{ max_length }} 字以内。
{% endif %}
{% endblock output %}
'''
    (base_path / "base.j2").write_text(base_content, encoding="utf-8")

    # --- analysis.j2: 分析类 Prompt 模板 ---
    analysis_content = '''{% extends "base.j2" %}

{% block task %}
## 分析任务

请对以下内容进行{{ analysis_type | default("全面") }}分析：

{{ content }}

分析维度：
{% for dimension in dimensions %}
{{ loop.index }}. {{ dimension }}
{% endfor %}
{% endblock task %}
'''
    (base_path / "analysis.j2").write_text(analysis_content, encoding="utf-8")

    # --- generation.j2: 内容生成类模板 ---
    generation_content = '''{% extends "base.j2" %}

{% block task %}
## 生成任务

请根据以下要求生成{{ content_type | default("文本") }}内容：

主题：{{ topic }}
{% if key_points %}
关键要点：
{% for point in key_points %}
- {{ point }}
{% endfor %}
{% endif %}
{% if reference_style %}
参考风格：
{{ reference_style }}
{% endif %}
{% endblock task %}
'''
    (base_path / "generation.j2").write_text(generation_content, encoding="utf-8")

    print(f"Base templates created in {base_path}/")
```

### 6.5 完整使用示例

```python
def main():
    # 1. 创建模板文件
    create_base_templates("templates")

    # 2. 初始化渲染引擎
    renderer = PromptRenderer("templates")

    # 3. 注册模板元数据
    analysis_template = PromptTemplate(
        name="content_analysis",
        version="1.0.0",
        description="通用内容分析模板",
        author="Prompt Engineering Course",
        slots=[
            PromptSlot("role", "AI 角色"),
            PromptSlot("content", "待分析内容"),
            PromptSlot("dimensions", "分析维度列表"),
            PromptSlot("output_format", "输出格式", required=False),
        ],
        tags=["analysis", "content"],
        template_path="analysis.j2",
    )
    renderer.register(analysis_template)

    # 4. 渲染 Prompt
    prompt = renderer.render(
        "content_analysis",
        role="资深产品分析师",
        expertise=["用户体验", "市场分析", "竞品研究"],
        tone="专业且通俗易懂",
        content="我们计划推出一款 AI 写作助手产品，目标用户是自媒体创作者。",
        dimensions=[
            "市场需求分析",
            "目标用户画像",
            "竞品对比分析",
            "商业模式评估",
        ],
        output_format="使用 Markdown 格式，每个维度用二级标题分隔",
        max_length=2000,
    )

    print("=== 生成的 Prompt ===")
    print(prompt)

    # 5. 调用 LLM
    client = OpenAI()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    print("\n=== AI 回复 ===")
    print(response.choices[0].message.content)


if __name__ == "__main__":
    main()
```

### 6.6 模板继承示例：带 Few-shot 的分析模板

```python
# --- fewshot_analysis.j2 ---
FEWSHOT_TEMPLATE = '''{% extends "analysis.j2" %}

{% block context %}
{{ super() }}

## 参考示例

{% for example in examples %}
### 示例 {{ loop.index }}
输入：{{ example.input }}
输出：{{ example.output }}

{% endfor %}
请参考以上示例的格式和思路完成分析。
{% endblock context %}
'''

# 注册并使用
def demo_fewshot():
    renderer = PromptRenderer("templates")

    # 动态创建 few-shot 模板文件
    Path("templates/fewshot_analysis.j2").write_text(FEWSHOT_TEMPLATE, encoding="utf-8")

    fewshot_meta = PromptTemplate(
        name="fewshot_analysis",
        version="1.0.0",
        description="带示例的分析模板",
        author="course",
        template_path="fewshot_analysis.j2",
    )
    renderer.register(fewshot_meta)

    prompt = renderer.render(
        "fewshot_analysis",
        role="数据分析师",
        content="Q3 营收数据：120万，环比增长15%，同比增长32%。",
        dimensions=["趋势分析", "异常检测", "建议"],
        examples=[
            {
                "input": "Q2 营收 104 万，环比增长 8%",
                "output": "趋势：稳步增长。环比增速放缓，需关注市场饱和度。",
            },
            {
                "input": "Q1 营收 96 万，环比下降 3%",
                "output": "趋势：短期回调。季节性因素为主，无需过度担忧。",
            },
        ],
    )
    print(prompt)
```

---

## 7. 对比表：模板设计模式选择

| 模式 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| 槽位模板 | 表单式 Prompt，变量固定 | 简单直观，易维护 | 灵活性有限 |
| 继承模板 | 同类 Prompt 共享基础结构 | DRY 原则，结构清晰 | 继承层级不宜过深 |
| 组合模板 | 复杂任务，需拼接多个模块 | 高度灵活，可插拔 | 模块间耦合需管理 |
| 条件模板 | 根据场景动态变化的 Prompt | 适应性强 | 模板复杂度上升 |

---

## 8. 常见误区

### ❌ 错误 1：模板中硬编码业务逻辑

```python
# 错误：在模板里写 if/else 判断具体业务
template = """
{% if product_type == "phone" %}
请从屏幕、性能、拍照三个维度分析
{% elif product_type == "laptop" %}
请从性能、便携、续航三个维度分析
{% endif %}
"""

# 正确：业务逻辑放在数据层，模板只负责渲染
template = """
请从以下维度分析：
{% for dimension in dimensions %}
- {{ dimension }}
{% endfor %}
"""
```

### ❌ 错误 2：模板变量无默认值

```python
# 错误：必填变量缺失时直接崩溃
template = "你是{{ role }}，请分析{{ content }}"

# 正确：合理设置默认值
template = "你是{{ role | default('通用助手') }}，请分析{{ content }}"
```

### ❌ 错误 3：过度嵌套继承

```python
# 错误：base -> category -> subcategory -> specific -> variant
# 继承层级超过 3 层难以追踪

# 正确：最多 2 层继承，复杂逻辑用组合替代
# base.j2 -> analysis.j2 （用组合方式引入其他模块）
```

---

## 9. 工程建议

1. **模板文件用 `.j2` 后缀独立管理**：将 Prompt 模板从 Python 代码中抽离到独立的 `.j2` 文件，配合 Git 做版本控制，方便 diff 和 code review。
2. **继承层级不超过 2 层**：模板继承超过 2 层后追踪渲染结果变得困难，复杂的模块化需求改用组合（include/macro）而非深层继承。
3. **为每个模板注册元数据**：记录模板的名称、版本、作者、描述和变量槽位，方便团队协作和自动化测试。
4. **用单元测试验证模板渲染**：为关键模板编写渲染测试，确保变量注入后的 Prompt 字符串符合预期结构。

---

## 10. 总结

- Prompt 模板化是**生产级 Prompt 工程**的基础
- Jinja2 提供了强大的模板引擎，支持继承、条件、循环
- 槽位设计模式让 Prompt 结构清晰、易于维护
- MVC 思想帮助我们分离模板、数据和渲染逻辑

---

## 练习

### 练习 1：翻译模板
创建一个翻译类 Prompt 模板 `translation.j2`，支持以下槽位：
- `source_lang`：源语言
- `target_lang`：目标语言
- `content`：待翻译内容
- `style`：翻译风格（直译/意译/文学翻译）
- `terminology`：专业术语对照表（可选）

### 练习 2：模板组合器
实现一个 `TemplateComposer` 类，能够将多个小模板（角色模板、任务模板、格式模板）组合成一个完整的 Prompt，支持链式调用：

```python
composer = TemplateComposer()
prompt = (composer
    .add_role(role="资深翻译", expertise=["中英互译"])
    .add_task("翻译以下内容")
    .add_format("保持原文段落结构")
    .render())
```

### 练习 3：模板版本管理
设计一个 `TemplateVersionManager`，支持：
- 模板的版本号管理（major.minor.patch）
- 版本间 diff 对比
- 回滚到指定版本
- 记录每次修改的 changelog

---

## 参考答案

### 练习 1：翻译模板

**思路**：翻译模板需要继承 `base.j2`，在 task 块中定义翻译任务的核心指令，包括源语言、目标语言、翻译风格等槽位。对于可选的术语表，使用条件块渲染，并用 Jinja2 的 `join` 过滤器将术语对照表格式化为易读的列表。

**答案**：

```jinja2
{# translation.j2 - 翻译类 Prompt 模板 #}
{% extends "base.j2" %}

{% block system %}
你是一位资深的{{ role | default("翻译专家") }}，精通{{ source_lang }}和{{ target_lang }}的互译工作。
{% if expertise %}
你的专业领域包括：{{ expertise | join("、") }}。
{% endif %}
请使用严谨、准确的语调进行翻译。
{% endblock system %}

{% block task %}
## 翻译任务

请将以下{{ source_lang }}内容翻译为{{ target_lang }}：

### 翻译风格
{% if style == "直译" %}
请采用直译方式，尽量保持原文的句式结构和用词准确，逐句对应翻译。
{% elif style == "意译" %}
请采用意译方式，在忠实原文含义的基础上，根据{{ target_lang }}的表达习惯调整句式和措辞。
{% elif style == "文学翻译" %}
请采用文学翻译方式，注重译文的文学性和可读性，在保留原文意境的同时使译文流畅优美。
{% else %}
请采用{{ style | default("意译") }}的方式进行翻译。
{% endif %}

{% if terminology %}
### 专业术语对照表
翻译时请严格遵循以下术语对照：
{% for source_term, target_term in terminology.items() %}
- {{ source_lang }}：{{ source_term }} → {{ target_lang }}：{{ target_term }}
{% endfor %}
{% endif %}

### 待翻译内容
{{ content }}
{% endblock task %}

{% block output %}
## 输出要求
1. 只输出翻译结果，不要添加解释或注释
2. 保持原文的段落结构
3. 专业术语严格按照对照表翻译
{% if output_format %}
{{ output_format }}
{% endif %}
{% endblock output %}
```

使用示例：

```python
from pathlib import Path

# 创建模板文件
Path("templates/translation.j2").write_text(TEMPLATE_CONTENT, encoding="utf-8")

renderer = PromptRenderer("templates")

translation_meta = PromptTemplate(
    name="translation",
    version="1.0.0",
    description="翻译类 Prompt 模板",
    author="course",
    slots=[
        PromptSlot("source_lang", "源语言"),
        PromptSlot("target_lang", "目标语言"),
        PromptSlot("content", "待翻译内容"),
        PromptSlot("style", "翻译风格", required=False, default="意译"),
        PromptSlot("terminology", "术语对照表", required=False),
    ],
    tags=["translation"],
    template_path="translation.j2",
)
renderer.register(translation_meta)

prompt = renderer.render(
    "translation",
    source_lang="英语",
    target_lang="中文",
    content="Transformer architectures have revolutionized NLP by enabling parallel processing of sequential data.",
    style="意译",
    terminology={
        "Transformer": "Transformer 架构",
        "NLP": "自然语言处理",
        "parallel processing": "并行处理",
    },
)
print(prompt)
```

**要点**：
- 翻译模板的关键槽位是源语言、目标语言、翻译风格和术语表，术语表用字典结构便于渲染对照关系
- 风格控制应通过条件块给出具体指令，而不是简单传入一个词
- 术语表是可选的，使用 `{% if terminology %}` 条件块避免缺失时报错

---

### 练习 2：模板组合器

**思路**：`TemplateComposer` 的核心思想是将 Prompt 拆分为独立的模块（角色、任务、格式等），每个模块对应一个 Jinja2 子模板或宏，通过链式调用逐步构建上下文，最后调用 `render()` 将所有模块拼接为完整 Prompt。关键设计点是每个方法返回 `self` 以支持链式调用。

**答案**：

```python
from jinja2 import Environment
from dataclasses import dataclass, field


@dataclass
class PromptSection:
    """Prompt 模块"""
    name: str
    content: str
    order: int = 0


class TemplateComposer:
    """模板组合器：将多个小模块组合成完整 Prompt"""

    def __init__(self):
        self.env = Environment(
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self._sections: list[PromptSection] = []
        self._context: dict = {}
        self._order_counter = 0

    def _next_order(self) -> int:
        self._order_counter += 1
        return self._order_counter

    def add_role(self, role: str, expertise: list[str] | None = None,
                 tone: str | None = None) -> "TemplateComposer":
        """添加角色模块"""
        template_str = "你是一位{{ role }}。"
        if expertise:
            template_str += "\n你的专业领域包括：{% for exp in expertise %}{{ exp }}{% if not loop.last %}、{% endif %}{% endfor %}。"
        if tone:
            template_str += "\n请使用{{ tone }}的语调进行回复。"

        template = self.env.from_string(template_str)
        content = template.render(role=role, expertise=expertise, tone=tone)

        self._sections.append(PromptSection(
            name="role",
            content=content,
            order=self._next_order(),
        ))
        return self

    def add_context(self, background: str | None = None,
                    constraints: list[str] | None = None) -> "TemplateComposer":
        """添加上下文模块"""
        parts = []
        if background:
            parts.append(f"## 背景信息\n{background}")
        if constraints:
            constraint_lines = "\n".join(f"- {c}" for c in constraints)
            parts.append(f"## 约束条件\n{constraint_lines}")

        if parts:
            self._sections.append(PromptSection(
                name="context",
                content="\n\n".join(parts),
                order=self._next_order(),
            ))
        return self

    def add_task(self, task_description: str,
                 examples: list[dict] | None = None) -> "TemplateComposer":
        """添加任务模块"""
        content = f"## 任务\n{task_description}"
        if examples:
            content += "\n\n## 参考示例\n"
            for i, ex in enumerate(examples, 1):
                content += f"\n### 示例 {i}\n"
                content += f"输入：{ex.get('input', '')}\n"
                content += f"输出：{ex.get('output', '')}\n"

        self._sections.append(PromptSection(
            name="task",
            content=content,
            order=self._next_order(),
        ))
        return self

    def add_format(self, format_description: str,
                   max_length: int | None = None) -> "TemplateComposer":
        """添加输出格式模块"""
        content = f"## 输出格式要求\n{format_description}"
        if max_length:
            content += f"\n请将回复控制在 {max_length} 字以内。"

        self._sections.append(PromptSection(
            name="format",
            content=content,
            order=self._next_order(),
        ))
        return self

    def add_section(self, name: str, content: str) -> "TemplateComposer":
        """添加自定义模块"""
        self._sections.append(PromptSection(
            name=name,
            content=content,
            order=self._next_order(),
        ))
        return self

    def render(self) -> str:
        """渲染所有模块为完整 Prompt"""
        sorted_sections = sorted(self._sections, key=lambda s: s.order)
        return "\n\n".join(section.content for section in sorted_sections)

    def clear(self) -> "TemplateComposer":
        """清空所有模块"""
        self._sections.clear()
        self._order_counter = 0
        return self
```

使用示例：

```python
composer = TemplateComposer()

# 链式调用
prompt = (composer
    .add_role(role="资深翻译", expertise=["中英互译", "技术文档翻译"])
    .add_context(
        background="这是一份 AI 论文的技术摘要",
        constraints=["保持学术用语的准确性", "专业术语首次出现时附英文原文"]
    )
    .add_task("翻译以下英文段落为中文")
    .add_format("保持原文段落结构，术语用括号附英文", max_length=1000)
    .render())

print(prompt)
```

**要点**：
- 链式调用的核心是每个方法返回 `self`，这是 Python 中构建流式 API 的标准模式
- 每个模块独立管理自己的内容，通过 `order` 字段控制最终拼接顺序
- `add_section` 方法提供扩展点，允许用户添加自定义模块而不修改组合器代码

---

### 练习 3：模板版本管理

**思路**：版本管理的核心是为每次模板变更存储一个快照，用语义化版本号（major.minor.patch）标识版本演进。关键数据结构是一个按版本号索引的模板历史记录，支持 diff 对比时逐行比较两个版本的内容差异，回滚时将指定版本的内容重新设为当前版本。

**答案**：

```python
import difflib
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class VersionRecord:
    """版本记录"""
    version: str
    content: str
    timestamp: str
    changelog: str
    author: str = ""


class TemplateVersionManager:
    """模板版本管理器"""

    def __init__(self, name: str, initial_content: str, author: str = "system"):
        self.name = name
        self._history: list[VersionRecord] = []
        self._current_content = initial_content
        self._current_version = "0.0.0"
        # 记录初始版本
        self._history.append(VersionRecord(
            version="0.0.0",
            content=initial_content,
            timestamp=datetime.now().isoformat(),
            changelog="初始版本",
            author=author,
        ))

    @property
    def current_version(self) -> str:
        return self._current_version

    @property
    def current_content(self) -> str:
        return self._current_content

    def _bump_version(self, level: str) -> str:
        """递增版本号"""
        major, minor, patch = map(int, self._current_version.split("."))
        if level == "major":
            return f"{major + 1}.0.0"
        elif level == "minor":
            return f"{major}.{minor + 1}.0"
        elif level == "patch":
            return f"{major}.{minor}.{patch + 1}"
        else:
            raise ValueError(f"无效的版本级别: {level}，必须是 major/minor/patch")

    def update(self, new_content: str, changelog: str, level: str = "patch",
               author: str = "") -> str:
        """更新模板并创建新版本

        Args:
            new_content: 新的模板内容
            changelog: 变更说明
            level: 版本级别 (major/minor/patch)
            author: 修改作者

        Returns:
            新版本号
        """
        if new_content == self._current_content:
            raise ValueError("内容无变化，无需创建新版本")

        new_version = self._bump_version(level)
        record = VersionRecord(
            version=new_version,
            content=new_content,
            timestamp=datetime.now().isoformat(),
            changelog=changelog,
            author=author,
        )
        self._history.append(record)
        self._current_version = new_version
        self._current_content = new_content
        return new_version

    def get_version(self, version: str) -> Optional[VersionRecord]:
        """获取指定版本的记录"""
        for record in self._history:
            if record.version == version:
                return record
        return None

    def rollback(self, target_version: str, author: str = "system") -> str:
        """回滚到指定版本

        Args:
            target_version: 目标版本号
            author: 操作作者

        Returns:
            新版本号（回滚会创建新版本记录）
        """
        target = self.get_version(target_version)
        if not target:
            raise ValueError(f"版本 {target_version} 不存在")

        return self.update(
            new_content=target.content,
            changelog=f"回滚到版本 {target_version}",
            level="patch",
            author=author,
        )

    def diff(self, version_a: str, version_b: str) -> str:
        """对比两个版本的差异

        Args:
            version_a: 版本 A
            version_b: 版本 B

        Returns:
            统一格式的 diff 字符串
        """
        record_a = self.get_version(version_a)
        record_b = self.get_version(version_b)

        if not record_a:
            raise ValueError(f"版本 {version_a} 不存在")
        if not record_b:
            raise ValueError(f"版本 {version_b} 不存在")

        diff_lines = difflib.unified_diff(
            record_a.content.splitlines(keepends=True),
            record_b.content.splitlines(keepends=True),
            fromfile=f"{self.name} v{version_a}",
            tofile=f"{self.name} v{version_b}",
            lineterm="",
        )
        return "\n".join(diff_lines)

    def history(self) -> list[dict]:
        """获取版本历史摘要"""
        return [
            {
                "version": r.version,
                "timestamp": r.timestamp,
                "changelog": r.changelog,
                "author": r.author,
            }
            for r in self._history
        ]

    def changelog(self) -> str:
        """生成完整的 changelog"""
        lines = [f"# {self.name} Changelog\n"]
        for record in reversed(self._history):
            lines.append(f"## v{record.version} ({record.timestamp})")
            lines.append(f"- {record.changelog}")
            if record.author:
                lines.append(f"- 作者: {record.author}")
            lines.append("")
        return "\n".join(lines)
```

使用示例：

```python
# 初始化
manager = TemplateVersionManager(
    name="analysis_template",
    initial_content="你是{{ role }}，请分析{{ content }}。",
    author="张三",
)

# 更新模板（patch 级别）
manager.update(
    new_content="你是{{ role }}。\n\n请对以下内容进行分析：\n{{ content }}",
    changelog="改善模板结构，增加换行",
    level="patch",
    author="张三",
)

# 更大的改动（minor 级别）
manager.update(
    new_content='{% extends "base.j2" %}\n{% block task %}\n你是{{ role }}。\n请分析：{{ content }}\n{% endblock %}',
    changelog="重构为 Jinja2 继承模板",
    level="minor",
    author="李四",
)

# 查看版本历史
for record in manager.history():
    print(f"v{record['version']} - {record['changelog']}")

# diff 对比
print(manager.diff("0.0.0", "0.1.0"))

# 回滚到初始版本
manager.rollback("0.0.0", author="王五")

# 生成 changelog
print(manager.changelog())
```

**要点**：
- 语义化版本号（major.minor.patch）对应不同粒度的变更：major 是不兼容的重构，minor 是新增功能，patch 是小修复
- 回滚不是删除历史，而是创建一个内容与目标版本相同的新版本，保留完整的变更轨迹
- diff 使用 `difflib.unified_diff` 生成标准的统一差异格式，便于 code review

---

**下一课**: [变量注入与动态 Prompt](./02-变量注入与动态Prompt.md)
