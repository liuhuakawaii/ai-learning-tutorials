# 变量注入与动态 Prompt

> **课程定位**：Stage 2 - 结构化 Prompt 工程 · 第 2 课
> **前置要求**：完成 01-Prompt模板设计，了解 Jinja2 基础语法
> **预计用时**：50-60 分钟

---

## 场景引入

你写了一个 Prompt 模板，里面有 `{role}`、`{content}`、`{dimensions}` 三个变量。某天同事传入 `role=123`、`content=""`、`dimensions=None`，结果渲染出来的 Prompt 语义完全错误，API 返回了无意义的回答，但系统没有任何报错。你意识到：变量注入不是简单的字符串替换——没有类型校验和默认值管理的模板系统，就是一颗定时炸弹。

---

## 学习目标

1. 掌握 `{{variable}}` 语法及其高级用法
2. 理解类型安全注入的必要性与实现方式
3. 学会在 Prompt 中使用条件块和循环
4. 构建一个带验证功能的动态 Prompt Builder

---

## 1. 变量注入基础

变量注入是将外部数据动态填充到 Prompt 模板中的过程。

```
┌──────────────────────────────────────────────────────────┐
│               变量解析流水线 (Variable Resolution)         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  输入数据          模板定义           最终 Prompt          │
│  ┌─────┐         ┌─────────┐        ┌──────────┐        │
│  │ data │────┐    │ template│        │ rendered │        │
│  └─────┘    │    └────┬────┘        └──────────┘        │
│             │         │                                  │
│             ▼         ▼                                  │
│     ┌──────────────────────┐                             │
│     │   变量解析引擎         │                             │
│     │                      │                             │
│     │  1. 词法分析           │  识别 {{ }} 中的变量名       │
│     │  2. 类型检查           │  验证变量类型是否匹配        │
│     │  3. 默认值填充          │  缺失变量使用默认值         │
│     │  4. 过滤器应用          │  应用 |default 等过滤器     │
│     │  5. 上下文绑定          │  将变量映射到模板作用域      │
│     │  6. 渲染输出           │  生成最终字符串             │
│     └──────────────────────┘                             │
│             │                                            │
│             ▼                                            │
│     ┌──────────────────────┐                             │
│     │   输出验证器           │                             │
│     │  - 空值检测            │                             │
│     │  - 长度校验            │                             │
│     │  - 格式合规            │                             │
│     └──────────────────────┘                             │
└──────────────────────────────────────────────────────────┘
```

---

## 2. `{{variable}}` 语法详解

### 2.1 基础变量替换

```python
from jinja2 import Environment

env = Environment()

# 简单变量
template = env.from_string("你好，{{ name }}！你今年 {{ age }} 岁。")
result = template.render(name="小明", age=25)
# => "你好，小明！你今年 25 岁。"

# 属性访问
template = env.from_string("用户 {{ user.name }} 的邮箱是 {{ user.email }}")
result = template.render(user={"name": "小明", "email": "xm@example.com"})
# => "用户 小明 的邮箱是 xm@example.com"
```

### 2.2 过滤器（Filters）

```python
# 内置过滤器
template = env.from_string("""
标题：{{ title | upper }}
摘要：{{ content | truncate(100) }}
标签：{{ tags | join(", ") }}
默认值：{{ missing_var | default("未提供") }}
""".strip())

result = template.render(
    title="prompt engineering",
    content="这是一篇关于 Prompt 工程的长文，内容非常丰富..." * 5,
    tags=["AI", "LLM", "Prompt"],
)
print(result)
```

### 2.3 自定义过滤器

```python
import json

def register_custom_filters(env: Environment):
    """注册自定义过滤器"""

    @env.filter("to_json")
    def to_json(value, indent=2):
        return json.dumps(value, ensure_ascii=False, indent=indent)

    @env.filter("mask_email")
    def mask_email(email: str) -> str:
        user, domain = email.split("@")
        masked = user[0] + "***" + user[-1] if len(user) > 2 else "***"
        return f"{masked}@{domain}"

    @env.filter("word_count")
    def word_count(text: str) -> int:
        return len(text.split())

    @env.filter("chinese_list")
    def chinese_list(items: list) -> str:
        return "、".join(str(i) for i in items)

register_custom_filters(env)

template = env.from_string("""
用户邮箱：{{ email | mask_email }}
用户数据：{{ user_data | to_json }}
内容字数：{{ content | word_count }}
技能：{{ skills | chinese_list }}
""")
```

---

## 3. 类型安全注入

### 3.1 为什么需要类型安全？

```python
# 问题场景：无类型检查时的隐患
prompt = f"请将温度设置为 {temperature}，模型选择 {model}"
# 如果 temperature="abc" 或 model=123，Prompt 语义被破坏
```

### 3.2 Pydantic 类型校验方案

```python
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal

class PromptVariables(BaseModel):
    """Prompt 变量的类型定义"""
    role: str = Field(..., min_length=1, max_length=100, description="AI 角色")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="温度参数")
    model: Literal["gpt-4o", "gpt-4o-mini", "claude-sonnet-4-20250514"] = Field(
        default="gpt-4o", description="模型选择"
    )
    max_tokens: int = Field(default=1000, ge=1, le=128000, description="最大 token 数")
    content: str = Field(..., min_length=1, description="输入内容")
    language: Optional[str] = Field(default="zh-CN", description="输出语言")

    @field_validator("content")
    @classmethod
    def validate_content(cls, v):
        if len(v.strip()) == 0:
            raise ValueError("内容不能为空或仅含空白字符")
        return v.strip()

# 使用
try:
    variables = PromptVariables(
        role="数据分析师",
        content="分析 Q3 营收数据",
        temperature=0.3,
    )
    print(f"校验通过：{variables.model_dump()}")
except Exception as e:
    print(f"校验失败：{e}")
```

---

## 4. 条件块与循环

### 4.1 条件渲染

```python
CONDITIONAL_TEMPLATE = '''你是一位 {{ role }}。

{% if expertise %}
你的专业领域包括：
{% for exp in expertise %}
- {{ exp }}
{% endfor %}
{% endif %}

{% if strict_mode %}
⚠️ 严格模式已开启：
- 不确定的内容请明确标注"不确定"
- 引用数据请注明来源
{% else %}
请基于你的知识提供最佳回答。
{% endif %}

{% if language == "en" %}
Please respond in English.
{% elif language == "ja" %}
日本語で回答してください。
{% else %}
请使用中文回答。
{% endif %}

---
{{ content }}
'''

def demo_conditional():
    env = Environment()
    template = env.from_string(CONDITIONAL_TEMPLATE)

    result = template.render(
        role="AI 研究员",
        expertise=["大语言模型", "Prompt 工程", "RAG 系统"],
        strict_mode=True,
        language="zh-CN",
        content="请解释 Transformer 的注意力机制",
    )
    print(result)
```

### 4.2 循环与迭代

```python
LOOP_TEMPLATE = '''# 任务列表

{% for task in tasks %}
## 任务 {{ loop.index }}: {{ task.title }}

优先级：{{ task.priority | default("中") }}
{% if task.dependencies %}
前置依赖：{{ task.dependencies | join(", ") }}
{% endif %}

{{ task.description }}

{% if not loop.last %}
---
{% endif %}
{% endfor %}

## 汇总
- 总任务数：{{ tasks | length }}
- 高优先级：{{ tasks | selectattr("priority", "equalto", "高") | list | length }}

请按照优先级从高到低的顺序执行以上任务。
'''

def demo_loop():
    env = Environment()
    template = env.from_string(LOOP_TEMPLATE)

    tasks = [
        {"title": "数据清洗", "priority": "高", "description": "去除重复数据和异常值"},
        {"title": "特征工程", "priority": "中", "description": "提取关键特征", "dependencies": ["数据清洗"]},
        {"title": "模型训练", "priority": "高", "description": "训练基线模型", "dependencies": ["特征工程"]},
    ]

    result = template.render(tasks=tasks)
    print(result)
```

### 4.3 宏（Macro）复用

```python
MACRO_TEMPLATE = '''{# 定义可复用的宏 #}
{% macro format_item(item, index) %}
{{ index }}. **{{ item.name }}**
   - 类型：{{ item.type | default("未知") }}
   - 描述：{{ item.description | default("无") }}
{% if item.tags %}
   - 标签：{{ item.tags | join(" | ") }}
{% endif %}
{% endmacro %}

# 项目清单

{% for item in items %}
{{ format_item(item, loop.index) }}
{% endfor %}
'''
```

---

## 5. 变量注入的层次模型

```
┌───────────────────────────────────────────────────┐
│            变量作用域层次                            │
├───────────────────────────────────────────────────┤
│                                                   │
│  Layer 4: 运行时变量 (Runtime)                     │
│  ┌───────────────────────────────────────────┐    │
│  │ 用户输入、API 返回值、计算中间结果            │    │
│  └───────────────────────────────────────────┘    │
│              ▲ 覆盖                               │
│  Layer 3: 场景变量 (Scenario)                     │
│  ┌───────────────────────────────────────────┐    │
│  │ 场景特定配置：temperature、model、language   │    │
│  └───────────────────────────────────────────┘    │
│              ▲ 覆盖                               │
│  Layer 2: 模板默认值 (Template Defaults)           │
│  ┌───────────────────────────────────────────┐    │
│  │ default("值") 中定义的默认值                 │    │
│  └───────────────────────────────────────────┘    │
│              ▲ 覆盖                               │
│  Layer 1: 全局配置 (Global Config)                │
│  ┌───────────────────────────────────────────┐    │
│  │ 系统级默认值：角色、语调、格式偏好             │    │
│  └───────────────────────────────────────────┘    │
└───────────────────────────────────────────────────┘
```

---

## 6. 代码实战：动态 Prompt Builder

### 6.1 完整实现

```python
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Callable
from enum import Enum
import re


class VariableType(Enum):
    TEXT = "text"
    NUMBER = "number"
    BOOLEAN = "boolean"
    LIST = "list"
    CHOICE = "choice"


@dataclass
class VariableSpec:
    """变量规格定义"""
    name: str
    var_type: VariableType
    description: str
    required: bool = True
    default: Any = None
    choices: list[str] | None = None
    min_value: float | None = None
    max_value: float | None = None
    min_length: int | None = None
    max_length: int | None = None
    pattern: str | None = None


class VariableValidator:
    """变量验证器"""

    @staticmethod
    def validate(spec: VariableSpec, value: Any) -> tuple[bool, str]:
        if value is None:
            if spec.required:
                return False, f"变量 '{spec.name}' 是必填项"
            return True, ""

        # 类型检查
        if spec.var_type == VariableType.NUMBER:
            if not isinstance(value, (int, float)):
                return False, f"变量 '{spec.name}' 需要数字类型，收到 {type(value).__name__}"
            if spec.min_value is not None and value < spec.min_value:
                return False, f"变量 '{spec.name}' 不能小于 {spec.min_value}"
            if spec.max_value is not None and value > spec.max_value:
                return False, f"变量 '{spec.name}' 不能大于 {spec.max_value}"

        elif spec.var_type == VariableType.TEXT:
            if not isinstance(value, str):
                value = str(value)
            if spec.min_length is not None and len(value) < spec.min_length:
                return False, f"变量 '{spec.name}' 长度不能少于 {spec.min_length}"
            if spec.max_length is not None and len(value) > spec.max_length:
                return False, f"变量 '{spec.name}' 长度不能超过 {spec.max_length}"
            if spec.pattern and not re.match(spec.pattern, value):
                return False, f"变量 '{spec.name}' 格式不匹配: {spec.pattern}"

        elif spec.var_type == VariableType.BOOLEAN:
            if not isinstance(value, bool):
                return False, f"变量 '{spec.name}' 需要布尔类型"

        elif spec.var_type == VariableType.LIST:
            if not isinstance(value, (list, tuple)):
                return False, f"变量 '{spec.name}' 需要列表类型"

        elif spec.var_type == VariableType.CHOICE:
            if spec.choices and value not in spec.choices:
                return False, f"变量 '{spec.name}' 必须是 {spec.choices} 之一"

        return True, ""


class DynamicPromptBuilder:
    """动态 Prompt 构建器"""

    def __init__(self):
        self.env = Environment()
        self._variables: dict[str, VariableSpec] = {}
        self._template_str: str = ""
        self._pre_processors: list[Callable] = []
        self._post_processors: list[Callable] = []

    def template(self, template_str: str) -> DynamicPromptBuilder:
        """设置模板字符串"""
        self._template_str = template_str
        return self

    def variable(self, spec: VariableSpec) -> DynamicPromptBuilder:
        """注册变量规格"""
        self._variables[spec.name] = spec
        return self

    def pre_process(self, fn: Callable) -> DynamicPromptBuilder:
        """添加预处理器"""
        self._pre_processors.append(fn)
        return self

    def post_process(self, fn: Callable) -> DynamicPromptBuilder:
        """添加后处理器"""
        self._post_processors.append(fn)
        return self

    def _extract_template_vars(self) -> list[str]:
        """从模板中提取变量名"""
        pattern = r'\{\{\s*(\w+)(?:\s*\|.*)?\s*\}\}'
        return list(set(re.findall(pattern, self._template_str)))

    def _apply_defaults(self, data: dict[str, Any]) -> dict[str, Any]:
        """应用默认值"""
        result = dict(data)
        for name, spec in self._variables.items():
            if name not in result:
                if spec.default is not None:
                    result[name] = spec.default
        return result

    def build(self, **kwargs) -> str:
        """构建最终 Prompt"""
        # 预处理
        for processor in self._pre_processors:
            kwargs = processor(kwargs)

        # 应用默认值
        kwargs = self._apply_defaults(kwargs)

        # 验证所有变量
        errors = []
        for name, spec in self._variables.items():
            value = kwargs.get(name)
            valid, msg = VariableValidator.validate(spec, value)
            if not valid:
                errors.append(msg)

        if errors:
            raise ValueError("变量验证失败:\n" + "\n".join(f"  - {e}" for e in errors))

        # 检查模板中的未注册变量
        template_vars = self._extract_template_vars()
        undefined = [v for v in template_vars if v not in self._variables and v not in kwargs]
        if undefined:
            print(f"⚠️ 模板中存在未注册的变量: {undefined}")

        # 渲染
        template = self.env.from_string(self._template_str)
        result = template.render(**kwargs)

        # 后处理器
        for processor in self._post_processors:
            result = processor(result)

        return result
```

### 6.2 使用示例

```python
def demo_builder():
    builder = DynamicPromptBuilder()

    # 定义变量规格
    builder.variable(VariableSpec(
        name="role",
        var_type=VariableType.TEXT,
        description="AI 角色",
        required=True,
        min_length=2,
        max_length=50,
    ))

    builder.variable(VariableSpec(
        name="analysis_type",
        var_type=VariableType.CHOICE,
        description="分析类型",
        required=True,
        choices=["SWOT", "PEST", "五力模型", "价值链"],
    ))

    builder.variable(VariableSpec(
        name="content",
        var_type=VariableType.TEXT,
        description="待分析内容",
        required=True,
        min_length=10,
    ))

    builder.variable(VariableSpec(
        name="dimensions",
        var_type=VariableType.LIST,
        description="分析维度",
        required=True,
    ))

    builder.variable(VariableSpec(
        name="max_points",
        var_type=VariableType.NUMBER,
        description="每维度最大要点数",
        required=False,
        default=5,
        min_value=1,
        max_value=10,
    ))

    # 设置模板
    builder.template("""
你是一位{{ role }}。

## 分析类型
{{ analysis_type }}

## 分析任务
请对以下内容进行{{ analysis_type }}分析：

{{ content }}

## 分析维度
{% for dim in dimensions %}
### {{ dim }}
- 列出不超过 {{ max_points }} 个要点
{% endfor %}

## 输出要求
- 使用 Markdown 格式
- 每个要点附带简要说明
""".strip())

    # 添加后处理器：去除多余空行
    builder.post_process(lambda s: re.sub(r'\n{3,}', '\n\n', s))

    # 构建 Prompt
    try:
        prompt = builder.build(
            role="战略分析师",
            analysis_type="SWOT",
            content="我们是一家中小型 SaaS 公司，主要产品是项目管理工具。",
            dimensions=["优势", "劣势", "机会", "威胁"],
        )
        print(prompt)
    except ValueError as e:
        print(f"构建失败：{e}")


def demo_validation_error():
    """演示验证失败场景"""
    builder = DynamicPromptBuilder()
    builder.variable(VariableSpec(
        name="age",
        var_type=VariableType.NUMBER,
        description="年龄",
        required=True,
        min_value=0,
        max_value=150,
    ))
    builder.template("用户年龄：{{ age }}")

    try:
        builder.build(age=-5)
    except ValueError as e:
        print(f"预期错误：{e}")
```

### 6.3 预处理器示例：自动截断长文本

```python
def auto_truncate_processor(max_chars: int = 5000):
    """创建自动截断处理器"""
    def processor(data: dict) -> dict:
        for key, value in data.items():
            if isinstance(value, str) and len(value) > max_chars:
                data[key] = value[:max_chars] + f"\n\n[... 内容过长，已截断至 {max_chars} 字符]"
                print(f"⚠️ 变量 '{key}' 已自动截断: {len(value)} → {max_chars} 字符")
        return data
    return processor

# 注册
builder.pre_process(auto_truncate_processor(max_chars=3000))
```

---

## 7. 常见误区

### ❌ 错误 1：未转义用户输入

```python
# 危险：用户输入可能包含模板语法
user_input = "请分析 {{config.password}}"
template = env.from_string(f"分析内容：{user_input}")  # Jinja2 会尝试渲染！

# 安全：使用 Jinja2 的 SandboxEnvironment 或预转义
from jinja2 import SandboxedEnvironment
safe_env = SandboxedEnvironment()
```

### ❌ 错误 2：变量作用域污染

```python
# 错误：在循环中修改外部变量
template = """
{% set count = 0 %}
{% for item in items %}
{% set count = count + 1 %}  {# 这不会影响外部的 count! #}
{{ item }}
{% endfor %}
总计：{{ count }}  {# 始终为 0 #}
"""

# 正确：使用 namespace 或在渲染前计算
template = """
{% for item in items %}
{{ loop.index }}. {{ item }}
{% endfor %}
总计：{{ items | length }}
"""
```

### ❌ 错误 3：忽略 None 值的处理

```python
# 错误：假设变量一定存在
template = "分析维度：{{ dimensions | join(', ') }}"

# 如果 dimensions 为 None，join 会报错
# 正确：始终用 default 兜底
template = "分析维度：{{ dimensions | default([]) | join(', ') }}"
```

---

## 8. 工程建议

1. **用 Pydantic 做变量校验**：为每个 Prompt 模板定义配套的 Pydantic Model，在渲染前自动校验类型、范围和必填项，把错误拦截在 API 调用之前。
2. **所有模板变量必须有默认值或明确标记必填**：可选变量用 `default()` 过滤器兜底，必填变量在校验阶段强制检查，避免渲染出语义残缺的 Prompt。
3. **对用户输入做沙箱转义**：如果用户输入会注入到 Jinja2 模板中，使用 `SandboxedEnvironment` 防止模板注入攻击。
4. **用预处理器统一清洗数据**：将截断长文本、去除特殊字符、标准化格式等逻辑封装为预处理器，避免在每个模板中重复处理。

---

## 9. 对比表

| 注入方式 | 类型安全 | 灵活性 | 复杂度 | 适用场景 |
|---------|---------|--------|--------|---------|
| f-string 拼接 | 无 | 低 | 低 | 简单脚本 |
| Jinja2 模板 | 中 | 高 | 中 | 生产环境 |
| Pydantic + Jinja2 | 高 | 高 | 高 | 企业级系统 |
| DSL 自定义 | 最高 | 最高 | 最高 | 专用 Prompt 平台 |

---

## 10. 总结

- 变量注入是连接数据与 Prompt 的桥梁
- 类型安全注入能在渲染前捕获错误，避免无效 API 调用
- 条件块和循环让 Prompt 能根据数据动态调整结构
- 预/后处理器提供了灵活的数据处理管道

---

## 练习

### 练习 1：类型安全注入器
实现一个 `TypeSafeInjector`，支持：
- 根据 Pydantic Model 自动提取变量规格
- 渲染前自动校验所有变量
- 生成变量文档（名称、类型、描述、是否必填）

### 练习 2：多语言 Prompt 生成器
创建一个 Prompt 模板，根据 `language` 变量自动切换 Prompt 的语言（中/英/日），同时保持核心指令语义不变。

### 练习 3：变量约束 DSL
设计一套 DSL（领域特定语言），允许用声明式语法定义变量约束：

```yaml
variables:
  role:
    type: text
    required: true
    min_length: 2
  temperature:
    type: number
    default: 0.7
    range: [0, 2]
```

将此 YAML 解析为 `VariableSpec` 列表，用于动态 Prompt Builder。

---

## 参考答案

### 练习 1：类型安全注入器

**思路**：核心思路是利用 Pydantic Model 的 `model_fields` 元数据自动提取变量规格（类型、默认值、描述、约束），然后在渲染前遍历所有字段执行校验。这比手动定义 `VariableSpec` 更简洁，因为 Pydantic Model 本身已经包含了完整的类型信息和验证规则。

**答案**：

```python
from pydantic import BaseModel, Field
from typing import get_type_hints, get_origin, get_args, Optional, Literal
from jinja2 import Environment
import re


class TypeSafeInjector:
    """基于 Pydantic Model 的类型安全注入器"""

    def __init__(self, model_class: type[BaseModel]):
        self.model_class = model_class
        self.env = Environment()

    def extract_specs(self) -> list[dict]:
        """从 Pydantic Model 自动提取变量规格"""
        specs = []
        for name, field_info in self.model_class.model_fields.items():
            spec = {
                "name": name,
                "type": self._get_type_name(field_info.annotation),
                "description": field_info.description or "",
                "required": field_info.is_required(),
                "default": field_info.default if not field_info.is_required() else None,
            }
            # 提取约束
            if field_info.metadata:
                for meta in field_info.metadata:
                    if hasattr(meta, "ge"):
                        spec["min_value"] = meta.ge
                    if hasattr(meta, "le"):
                        spec["max_value"] = meta.le
                    if hasattr(meta, "min_length"):
                        spec["min_length"] = meta.min_length
                    if hasattr(meta, "max_length"):
                        spec["max_length"] = meta.max_length
            specs.append(spec)
        return specs

    def _get_type_name(self, annotation) -> str:
        """将 Python 类型注解转换为可读的类型名"""
        origin = get_origin(annotation)
        if origin is Literal:
            return f"choice({', '.join(repr(a) for a in get_args(annotation))})"
        if origin is list:
            return f"list[{self._get_type_name(get_args(annotation)[0])}]"
        if origin is Optional or (hasattr(annotation, "__name__") and annotation.__name__ == "Optional"):
            inner = get_args(annotation)[0] if get_args(annotation) else str
            return f"optional[{self._get_type_name(inner)}]"
        type_map = {str: "text", int: "integer", float: "number", bool: "boolean"}
        return type_map.get(annotation, getattr(annotation, "__name__", "unknown"))

    def generate_docs(self) -> str:
        """生成变量文档"""
        specs = self.extract_specs()
        lines = [f"# {self.model_class.__name__} 变量文档\n"]
        lines.append(f"| 变量名 | 类型 | 描述 | 必填 | 默认值 |")
        lines.append(f"|--------|------|------|------|--------|")
        for spec in specs:
            required = "是" if spec["required"] else "否"
            default = str(spec.get("default", "-")) if not spec["required"] else "-"
            lines.append(f"| {spec['name']} | {spec['type']} | {spec['description']} | {required} | {default} |")
        return "\n".join(lines)

    def validate_and_render(self, template_str: str, **kwargs) -> str:
        """校验变量并渲染模板"""
        # 使用 Pydantic 校验
        try:
            validated = self.model_class(**kwargs)
        except Exception as e:
            raise ValueError(f"变量校验失败: {e}")

        # 渲染模板
        template = self.env.from_string(template_str)
        return template.render(**validated.model_dump())

    def extract_template_vars(self, template_str: str) -> list[str]:
        """从模板中提取使用的变量名"""
        pattern = r'\{\{\s*(\w+)(?:\s*\|.*)?\s*\}\}'
        return list(set(re.findall(pattern, template_str)))

    def check_unused_vars(self, template_str: str) -> list[str]:
        """检查 Model 中定义了但模板未使用的变量"""
        template_vars = set(self.extract_template_vars(template_str))
        model_vars = set(self.model_class.model_fields.keys())
        return list(model_vars - template_vars)

    def check_undefined_vars(self, template_str: str) -> list[str]:
        """检查模板中使用了但 Model 未定义的变量"""
        template_vars = set(self.extract_template_vars(template_str))
        model_vars = set(self.model_class.model_fields.keys())
        return list(template_vars - model_vars)
```

使用示例：

```python
class AnalysisPromptVars(BaseModel):
    role: str = Field(..., min_length=2, max_length=50, description="AI 角色")
    content: str = Field(..., min_length=1, description="待分析内容")
    dimensions: list[str] = Field(..., min_length=1, description="分析维度")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="温度参数")
    language: Optional[str] = Field(default="zh-CN", description="输出语言")


injector = TypeSafeInjector(AnalysisPromptVars)

# 生成变量文档
print(injector.generate_docs())

# 校验并渲染
template = "你是一位{{ role }}，请分析：{{ content }}，维度：{{ dimensions | join('、') }}"
result = injector.validate_and_render(
    template,
    role="数据分析师",
    content="Q3 营收 120 万",
    dimensions=["趋势", "异常"],
)
print(result)

# 检查未定义变量
print(injector.check_undefined_vars("分析 {{ role }} 和 {{ unknown_var }}"))
# => ['unknown_var']
```

**要点**：
- 利用 `model_fields` 自动提取元数据，避免手动同步 Pydantic Model 和 VariableSpec 两套定义
- 校验失败时 Pydantic 会抛出详细的 ValidationError，包含字段名、期望类型和实际值
- `check_unused_vars` 和 `check_undefined_vars` 能在开发阶段发现模板与 Model 的不一致

---

### 练习 2：多语言 Prompt 生成器

**思路**：多语言 Prompt 的核心挑战是指令语义不变但表达语言切换。最佳实践是用 Jinja2 的条件块根据 `language` 变量选择对应语言的指令文本，同时将语言无关的核心逻辑（任务描述、输出要求）通过变量注入保持一致。为了避免模板过于臃肿，可以将各语言的指令片段抽取为字典映射。

**答案**：

```python
from jinja2 import Environment
from pydantic import BaseModel, Field
from typing import Literal, Optional


# 语言指令映射
INSTRUCTION_MAP = {
    "zh": {
        "analyze": "请对以下内容进行分析：",
        "output_format": "请使用 Markdown 格式输出。",
        "sections": {
            "summary": "## 总结",
            "details": "## 详细分析",
            "suggestions": "## 建议",
        },
        "closing": "请确保分析逻辑清晰，语言专业且通俗易懂。",
    },
    "en": {
        "analyze": "Please analyze the following content:",
        "output_format": "Please output in Markdown format.",
        "sections": {
            "summary": "## Summary",
            "details": "## Detailed Analysis",
            "suggestions": "## Recommendations",
        },
        "closing": "Ensure the analysis is logically clear, professional, and easy to understand.",
    },
    "ja": {
        "analyze": "以下の内容を分析してください：",
        "output_format": "Markdown 形式で出力してください。",
        "sections": {
            "summary": "## まとめ",
            "details": "## 詳細分析",
            "suggestions": "## 提言",
        },
        "closing": "分析の論理が明確で、専門的かつ分かりやすい表現であることを確認してください。",
    },
}


MULTILINGUAL_TEMPLATE = '''{% set lang = instructions[language] %}
{% if language == "zh" %}
你是一位{{ role }}。
{% elif language == "en" %}
You are a/an {{ role }}.
{% elif language == "ja" %}
あなたは{{ role }}です。
{% endif %}

{% if expertise %}
{% if language == "zh" %}
你的专业领域：{{ expertise | join("、") }}
{% elif language == "en" %}
Your areas of expertise: {{ expertise | join(", ") }}
{% elif language == "ja" %}
専門分野：{{ expertise | join("、") }}
{% endif %}
{% endif %}

{{ lang.analyze }}

{{ content }}

{{ lang.output_format }}

{{ lang.sections.summary }}
{{ lang.sections.details }}
{{ lang.sections.suggestions }}

{{ lang.closing }}
'''


class MultilingualPromptVars(BaseModel):
    role: str = Field(..., description="AI 角色")
    content: str = Field(..., min_length=1, description="待分析内容")
    language: Literal["zh", "en", "ja"] = Field(default="zh", description="输出语言")
    expertise: Optional[list[str]] = Field(default=None, description="专业领域")


def render_multilingual_prompt(vars: MultilingualPromptVars) -> str:
    """渲染多语言 Prompt"""
    env = Environment()
    template = env.from_string(MULTILINGUAL_TEMPLATE)
    return template.render(
        role=vars.role,
        content=vars.content,
        language=vars.language,
        expertise=vars.expertise,
        instructions=INSTRUCTION_MAP,
    )
```

使用示例：

```python
# 中文 Prompt
zh_vars = MultilingualPromptVars(
    role="数据分析师",
    content="Q3 营收 120 万，环比增长 15%",
    language="zh",
    expertise=["财务分析", "趋势预测"],
)
print(render_multilingual_prompt(zh_vars))

# 英文 Prompt
en_vars = MultilingualPromptVars(
    role="data analyst",
    content="Q3 revenue is 1.2M, 15% increase QoQ",
    language="en",
    expertise=["financial analysis", "trend forecasting"],
)
print(render_multilingual_prompt(en_vars))

# 日文 Prompt
ja_vars = MultilingualPromptVars(
    role="データアナリスト",
    content="Q3 売上 120 万、前期比 15% 増",
    language="ja",
)
print(render_multilingual_prompt(ja_vars))
```

**要点**：
- 将各语言的指令文本抽取到 `INSTRUCTION_MAP` 字典中，避免在模板里写大量嵌套 if/elif
- 角色和专业领域等变量是语言无关的，通过 Jinja2 条件块只切换语言相关部分（如"你的"vs"You are"）
- 使用 Pydantic 的 `Literal` 类型约束语言选项，防止传入不支持的语言代码

---

### 练习 3：变量约束 DSL

**思路**：设计一个 YAML DSL 来声明变量约束，核心是建立 YAML 字段与 `VariableSpec` 属性之间的映射关系。解析器读取 YAML 后遍历每个变量定义，根据 `type` 字段确定变量类型，将 `range`、`min_length` 等约束字段映射到 `VariableSpec` 的对应属性。需要处理一些 DSL 简化写法，如 `range: [0, 2]` 展开为 `min_value` 和 `max_value`。

**答案**：

```python
import yaml
from dataclasses import dataclass
from typing import Any, Optional


# DSL 类型映射
TYPE_MAP = {
    "text": "text",
    "string": "text",
    "number": "number",
    "float": "number",
    "int": "number",
    "integer": "number",
    "boolean": "boolean",
    "bool": "boolean",
    "list": "list",
    "choice": "choice",
}


@dataclass
class ParsedVariable:
    """解析后的变量定义"""
    name: str
    var_type: str
    description: str = ""
    required: bool = True
    default: Any = None
    choices: Optional[list[str]] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    pattern: Optional[str] = None


def parse_variable_dsl(yaml_content: str) -> list[ParsedVariable]:
    """解析 YAML 变量约束 DSL 为 ParsedVariable 列表

    支持的 DSL 语法：
    ```yaml
    variables:
      role:
        type: text
        description: AI 角色
        required: true
        min_length: 2
        max_length: 50
      temperature:
        type: number
        description: 温度参数
        default: 0.7
        range: [0, 2]
      language:
        type: choice
        choices: [zh, en, ja]
        default: zh
      tags:
        type: list
        description: 标签列表
        required: false
      enable_strict:
        type: boolean
        default: false
    ```
    """
    config = yaml.safe_load(yaml_content)
    if not config or "variables" not in config:
        raise ValueError("YAML 中缺少 'variables' 顶层键")

    variables = []
    for name, definition in config["variables"].items():
        if not isinstance(definition, dict):
            raise ValueError(f"变量 '{name}' 的定义必须是字典格式")

        # 类型解析
        raw_type = definition.get("type", "text")
        var_type = TYPE_MAP.get(raw_type.lower())
        if not var_type:
            raise ValueError(f"变量 '{name}' 的类型 '{raw_type}' 不支持，可用类型: {list(TYPE_MAP.keys())}")

        # 基础字段
        parsed = ParsedVariable(
            name=name,
            var_type=var_type,
            description=definition.get("description", ""),
            required=definition.get("required", True),
            default=definition.get("default"),
        )

        # 约束字段
        if "range" in definition:
            range_val = definition["range"]
            if isinstance(range_val, list) and len(range_val) == 2:
                parsed.min_value = range_val[0]
                parsed.max_value = range_val[1]

        if "min_value" in definition:
            parsed.min_value = definition["min_value"]
        if "max_value" in definition:
            parsed.max_value = definition["max_value"]
        if "min_length" in definition:
            parsed.min_length = definition["min_length"]
        if "max_length" in definition:
            parsed.max_length = definition["max_length"]
        if "pattern" in definition:
            parsed.pattern = definition["pattern"]
        if "choices" in definition:
            parsed.choices = definition["choices"]
            parsed.var_type = "choice"  # 有 choices 时自动设为 choice 类型

        # 默认值处理：有默认值的变量自动标记为非必填
        if parsed.default is not None:
            parsed.required = False

        variables.append(parsed)

    return variables


def to_variable_spec(parsed: ParsedVariable):
    """将 ParsedVariable 转换为 VariableSpec（用于 DynamicPromptBuilder）"""
    from enum import Enum

    class VariableType(Enum):
        TEXT = "text"
        NUMBER = "number"
        BOOLEAN = "boolean"
        LIST = "list"
        CHOICE = "choice"

    return {
        "name": parsed.name,
        "var_type": VariableType(parsed.var_type),
        "description": parsed.description,
        "required": parsed.required,
        "default": parsed.default,
        "choices": parsed.choices,
        "min_value": parsed.min_value,
        "max_value": parsed.max_value,
        "min_length": parsed.min_length,
        "max_length": parsed.max_length,
        "pattern": parsed.pattern,
    }


def generate_yaml_template(variables: list[ParsedVariable]) -> str:
    """从 ParsedVariable 列表反向生成 YAML DSL"""
    lines = ["variables:"]
    for var in variables:
        lines.append(f"  {var.name}:")
        lines.append(f"    type: {var.var_type}")
        if var.description:
            lines.append(f"    description: {var.description}")
        lines.append(f"    required: {str(var.required).lower()}")
        if var.default is not None:
            lines.append(f"    default: {var.default}")
        if var.min_value is not None and var.max_value is not None:
            lines.append(f"    range: [{var.min_value}, {var.max_value}]")
        elif var.min_value is not None:
            lines.append(f"    min_value: {var.min_value}")
        elif var.max_value is not None:
            lines.append(f"    max_value: {var.max_value}")
        if var.min_length is not None:
            lines.append(f"    min_length: {var.min_length}")
        if var.max_length is not None:
            lines.append(f"    max_length: {var.max_length}")
        if var.choices:
            lines.append(f"    choices: {var.choices}")
        if var.pattern:
            lines.append(f"    pattern: {var.pattern}")
    return "\n".join(lines)
```

使用示例：

```python
yaml_dsl = """
variables:
  role:
    type: text
    description: AI 角色
    required: true
    min_length: 2
    max_length: 50
  temperature:
    type: number
    description: 温度参数
    default: 0.7
    range: [0, 2]
  analysis_type:
    type: choice
    description: 分析类型
    choices: [SWOT, PEST, 五力模型]
    default: SWOT
  content:
    type: text
    description: 待分析内容
    required: true
    min_length: 10
  strict_mode:
    type: boolean
    description: 是否开启严格模式
    default: false
  tags:
    type: list
    description: 标签
    required: false
"""

# 解析 DSL
variables = parse_variable_dsl(yaml_dsl)
for var in variables:
    print(f"  {var.name}: {var.var_type} | required={var.required} | default={var.default}")

# 反向生成 YAML
print("\n--- 生成的 YAML ---")
print(generate_yaml_template(variables))
```

**要点**：
- `range: [0, 2]` 是 DSL 的语法糖，解析时展开为 `min_value` 和 `max_value` 两个独立约束
- 有 `choices` 字段时自动将类型设为 `choice`，因为声明了可选值就意味着这是一个枚举类型
- `to_variable_spec` 函数提供与课中 `DynamicPromptBuilder` 的 `VariableSpec` 的桥接，使 DSL 解析结果能直接注入 Builder

---

**下一课**: [输出格式控制](./03-输出格式控制.md)
