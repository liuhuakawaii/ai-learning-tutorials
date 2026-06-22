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

**下一课**: [变量注入与动态 Prompt](./02-变量注入与动态Prompt.md)
