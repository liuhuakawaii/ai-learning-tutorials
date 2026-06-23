# 阶段实战：构建 Prompt 模板库

> Stage 2 · 第 6 课（综合实战）| 前置：完成 01-05 | 预计 60 分钟

---

你的团队已经积累了 50 多个 Prompt，散落在各人的代码里。新人来了找不到模板，只能重写；老模板改了变量名但示例没更新，渲染报错。你需要一个模板库——像管理 npm 包一样管理 Prompt。

## 你要构建的东西

一个 Python 包，能：
1. 注册和存储模板（带元数据）
2. 按名称、标签搜索模板
3. 渲染模板并调用 API
4. 导入/导出模板

总代码量约 150 行，不需要数据库，用文件系统就够了。

## 第一步：定义模板目录结构

```
prompt_templates/
├── _meta.yaml              # 模板库元数据
├── code_review.yaml        # 代码审查模板
├── content_analysis.yaml   # 内容分析模板
└── translation.yaml        # 翻译模板
```

每个模板是一个 YAML 文件，包含元数据和模板内容：

```yaml
# code_review.yaml
name: code_review
display_name: "代码审查助手"
version: "1.0.0"
category: "code"
tags: ["安全", "性能", "代码质量"]
description: "审查代码并按严重程度分类输出问题"
author: "your-name"
created_at: "2024-01-15"

variables:
  - name: role
    type: text
    default: "资深安全工程师"
  - name: language
    type: text
    default: "Python"

template: |
  你是{{ role }}，擅长代码安全审查。
  请审查以下{{ language }}代码，找出：
  1. 安全漏洞（SQL 注入、XSS、硬编码密钥等）
  2. 性能问题（N+1 查询、不必要的循环等）
  3. 代码风格问题

  输出格式：
  [{"issue": "问题描述", "severity": "high/medium/low", "line": 行号, "fix": "修复建议"}]

  代码：
  ```
  {{ code }}
  ```

examples:
  - input: "query = f'SELECT * WHERE id={id}'"
    output: '[{"issue": "SQL 注入", "severity": "high", "line": 1, "fix": "使用参数化查询"}]'
```

## 第二步：实现模板管理器

创建 `template_manager.py`：

```python
import yaml
from pathlib import Path
from dataclasses import dataclass, field
from jinja2 import Template

@dataclass
class PromptTemplate:
    name: str
    display_name: str
    version: str
    category: str
    tags: list[str]
    description: str
    template: str
    variables: list[dict] = field(default_factory=list)
    examples: list[dict] = field(default_factory=list)
    author: str = ""
    created_at: str = ""

    def render(self, **kwargs) -> str:
        t = Template(self.template)
        return t.render(**kwargs)

class TemplateLibrary:
    def __init__(self, directory: str = "prompt_templates"):
        self.dir = Path(directory)
        self.templates: dict[str, PromptTemplate] = {}
        self._load_all()

    def _load_all(self):
        for f in self.dir.glob("*.yaml"):
            if f.name.startswith("_"):
                continue
            data = yaml.safe_load(f.read_text(encoding="utf-8"))
            self.templates[data["name"]] = PromptTemplate(**data)

    def get(self, name: str) -> PromptTemplate | None:
        return self.templates.get(name)

    def search(self, keyword: str) -> list[PromptTemplate]:
        keyword = keyword.lower()
        return [
            t for t in self.templates.values()
            if keyword in t.name.lower()
            or keyword in t.display_name.lower()
            or keyword in t.description.lower()
            or any(keyword in tag for tag in t.tags)
        ]

    def list_all(self) -> list[dict]:
        return [
            {"name": t.name, "display_name": t.display_name,
             "category": t.category, "version": t.version}
            for t in self.templates.values()
        ]
```

## 第三步：添加 API 调用集成

```python
import openai

def run_template(
    library: TemplateLibrary,
    template_name: str,
    model: str = "gpt-4o-mini",
    **kwargs,
) -> str:
    tmpl = library.get(template_name)
    if not tmpl:
        raise ValueError(f"模板 {template_name} 不存在")

    prompt = tmpl.render(**kwargs)

    client = openai.OpenAI()
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    return resp.choices[0].message.content
```

## 第四步：导入导出

```python
import json

def export_template(library: TemplateLibrary, name: str, output_path: str):
    tmpl = library.get(name)
    if not tmpl:
        raise ValueError(f"模板 {name} 不存在")
    data = {
        "name": tmpl.name,
        "display_name": tmpl.display_name,
        "version": tmpl.version,
        "category": tmpl.category,
        "tags": tmpl.tags,
        "description": tmpl.description,
        "template": tmpl.template,
        "variables": tmpl.variables,
        "examples": tmpl.examples,
    }
    Path(output_path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def import_template(library: TemplateLibrary, json_path: str):
    data = json.loads(Path(json_path).read_text(encoding="utf-8"))
    out_path = library.dir / f"{data['name']}.yaml"
    out_path.write_text(yaml.dump(data, allow_unicode=True), encoding="utf-8")
    library.templates[data["name"]] = PromptTemplate(**data)
```

## 验证

创建模板文件后，运行测试：

```python
# test_library.py
from template_manager import TemplateLibrary, run_template

lib = TemplateLibrary("prompt_templates")

# 列出所有模板
for t in lib.list_all():
    print(t)

# 搜索
results = lib.search("安全")
print(f"搜索 '安全' 找到 {len(results)} 个模板")

# 渲染
tmpl = lib.get("code_review")
if tmpl:
    print(tmpl.render(code="query = f'SELECT * WHERE id={user_id}'"))

# 调用 API
result = run_template(lib, "code_review", code="password = 'admin123'")
print(result)
```

## 自查清单

- [ ] 模板目录下至少有 3 个 YAML 模板文件
- [ ] `TemplateLibrary` 能正确加载、搜索、获取模板
- [ ] 模板渲染结果不含 Jinja2 语法残余（`{{ }}` 全部被替换）
- [ ] API 调用能正常返回结果
- [ ] 导入导出功能正常工作

## 扩展方向

如果你提前完成了：
1. 给模板加版本号校验——导入时检查版本是否冲突
2. 加一个 `diff` 命令——对比两个版本模板的差异
3. 用 Jinja2 的 `extends` 实现模板继承——base template + 子模板

这些能力在 Stage 3 的测试和 Stage 4 的生产部署中会直接用到。
