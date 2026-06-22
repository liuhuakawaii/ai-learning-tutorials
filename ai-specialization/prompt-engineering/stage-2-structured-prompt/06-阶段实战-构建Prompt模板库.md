# 阶段实战：构建 Prompt 模板库

> **课程定位**：Stage 2 - 结构化 Prompt 工程 · 第 6 课（阶段实战）
> **前置要求**：完成 Stage 2 前 5 课
> **预计用时**：60-90 分钟

---

## 场景引入

你的团队已经积累了 50 多个 Prompt 模板，散落在各人的代码文件、Notion 页面和 Slack 消息里。新人入职找不到合适的模板，只能重新写；老模板改了变量名但示例没更新，渲染出来全是报错；某个模板上周效果很好但今天突然变差，却没人记得改了什么。你需要的不是一个更好的 Prompt，而是一套模板管理系统——让 Prompt 像代码一样可搜索、可版本控制、可团队共享。

---

## 学习目标

1. 设计一个可扩展的 Prompt 模板目录结构
2. 实现模板的元数据管理与版本控制
3. 构建模板搜索、分类和导入导出功能
4. 完成一个可团队共享的 Prompt 模板库系统

---

## 1. 模板库架构设计

```
┌──────────────────────────────────────────────────────────────┐
│              Prompt 模板库架构                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐      │
│  │                 用户界面层 (CLI)                      │      │
│  │  list | search | create | edit | export | import    │      │
│  └──────────────────────┬─────────────────────────────┘      │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────┐      │
│  │                 业务逻辑层                            │      │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────────┐       │      │
│  │  │ Template │ │  Version  │ │   Search     │       │      │
│  │  │ Manager  │ │  Control  │ │   Engine     │       │      │
│  │  └──────────┘ └───────────┘ └──────────────┘       │      │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────────┐       │      │
│  │  │ Category │ │  Import   │ │   Export     │       │      │
│  │  │ System   │ │  Handler  │ │   Handler    │       │      │
│  │  └──────────┘ └───────────┘ └──────────────┘       │      │
│  └──────────────────────┬─────────────────────────────┘      │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────┐      │
│  │                 存储层                                │      │
│  │  ┌──────────────────────────────────────────────┐  │      │
│  │  │  templates/                                   │  │      │
│  │  │  ├── analysis/                                │  │      │
│  │  │  │   ├── content_analysis.yaml               │  │      │
│  │  │  │   └── sentiment_analysis.yaml             │  │      │
│  │  │  ├── generation/                              │  │      │
│  │  │  │   ├── blog_post.yaml                      │  │      │
│  │  │  │   └── email_draft.yaml                    │  │      │
│  │  │  ├── code/                                    │  │      │
│  │  │  │   ├── code_review.yaml                    │  │      │
│  │  │  │   └── bug_diagnosis.yaml                  │  │      │
│  │  │  └── _meta/                                   │  │      │
│  │  │      ├── categories.yaml                     │  │      │
│  │  │      ├── tags.yaml                           │  │      │
│  │  │      └── index.yaml                          │  │      │
│  │  └──────────────────────────────────────────────┘  │      │
│  └────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 模板文件格式设计

### 2.1 YAML 模板定义

```yaml
# templates/analysis/content_analysis.yaml
metadata:
  name: content_analysis
  display_name: "内容分析模板"
  version: "1.2.0"
  author: "Prompt Engineering Team"
  created_at: "2024-01-15"
  updated_at: "2024-03-20"
  category: "analysis"
  tags: ["内容分析", "文本处理", "通用"]
  description: "对文本内容进行多维度分析，支持自定义分析维度"
  license: "MIT"

variables:
  - name: role
    type: text
    required: true
    description: "AI 扮演的角色"
    default: "内容分析师"

  - name: content
    type: text
    required: true
    description: "待分析的内容"
    min_length: 10
    max_length: 10000

  - name: dimensions
    type: list
    required: true
    description: "分析维度列表"
    min_items: 1
    max_items: 8

  - name: output_format
    type: choice
    required: false
    description: "输出格式"
    choices: ["markdown", "json", "plain"]
    default: "markdown"

template: |
  你是一位{{ role | default("内容分析师") }}。

  ## 分析任务
  请对以下内容进行多维度分析：

  {{ content }}

  ## 分析维度
  {% for dim in dimensions %}
  {{ loop.index }}. {{ dim }}
  {% endfor %}

  {% if output_format == "json" %}
  ## 输出格式
  请以 JSON 格式输出，结构如下：
  {
    "analysis": {
      "维度1": "分析结果",
      "维度2": "分析结果"
    },
    "summary": "总结"
  }
  {% elif output_format == "markdown" %}
  ## 输出格式
  使用 Markdown 格式，每个维度用二级标题分隔。
  {% endif %}

examples:
  - title: "产品评论分析"
    variables:
      role: "产品分析师"
      content: "这款手机拍照效果很好，但电池续航太差了。"
      dimensions: ["优点", "缺点", "改进建议"]
    expected_output_prefix: "## 优点"

changelog:
  - version: "1.2.0"
    date: "2024-03-20"
    changes: "新增 output_format 变量支持 JSON 输出"
  - version: "1.1.0"
    date: "2024-02-10"
    changes: "增加分析维度数量限制"
  - version: "1.0.0"
    date: "2024-01-15"
    changes: "初始版本"
```

---

## 3. 核心类实现

### 3.1 模板数据模型

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
import yaml
import hashlib


@dataclass
class VariableDef:
    """变量定义"""
    name: str
    type: str
    required: bool = True
    description: str = ""
    default: Any = None
    choices: Optional[list[str]] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    min_items: Optional[int] = None
    max_items: Optional[int] = None


@dataclass
class Example:
    """模板示例"""
    title: str
    variables: dict[str, Any]
    expected_output_prefix: str = ""


@dataclass
class ChangelogEntry:
    """变更日志"""
    version: str
    date: str
    changes: str


@dataclass
class TemplateMeta:
    """模板元数据"""
    name: str
    display_name: str
    version: str
    author: str
    created_at: str
    updated_at: str
    category: str
    tags: list[str]
    description: str
    license: str = "MIT"


@dataclass
class PromptTemplate:
    """完整的 Prompt 模板"""
    metadata: TemplateMeta
    variables: list[VariableDef]
    template: str
    examples: list[Example] = field(default_factory=list)
    changelog: list[ChangelogEntry] = field(default_factory=list)
    checksum: str = ""

    def compute_checksum(self) -> str:
        """计算模板内容的校验和"""
        content = self.template + "".join(
            v.name for v in self.variables
        )
        self.checksum = hashlib.md5(content.encode()).hexdigest()[:8]
        return self.checksum
```

### 3.2 模板管理器

```python
from pathlib import Path
from jinja2 import Environment
import json


class TemplateManager:
    """Prompt 模板管理器"""

    def __init__(self, base_dir: str = "prompt_templates"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self._meta_dir = self.base_dir / "_meta"
        self._meta_dir.mkdir(exist_ok=True)
        self._templates: dict[str, PromptTemplate] = {}
        self._index: dict[str, dict] = {}
        self._load_all()

    def _load_all(self):
        """加载所有模板"""
        for yaml_file in self.base_dir.rglob("*.yaml"):
            if yaml_file.parent == self._meta_dir:
                continue
            try:
                template = self._load_template_file(yaml_file)
                self._templates[template.metadata.name] = template
            except Exception as e:
                print(f"⚠️ 加载失败 {yaml_file}: {e}")

        self._rebuild_index()

    def _load_template_file(self, path: Path) -> PromptTemplate:
        """从 YAML 文件加载模板"""
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        meta_data = data.get("metadata", {})
        metadata = TemplateMeta(**meta_data)

        variables = [VariableDef(**v) for v in data.get("variables", [])]

        examples = []
        for ex in data.get("examples", []):
            examples.append(Example(**ex))

        changelog = []
        for cl in data.get("changelog", []):
            changelog.append(ChangelogEntry(**cl))

        template = PromptTemplate(
            metadata=metadata,
            variables=variables,
            template=data.get("template", ""),
            examples=examples,
            changelog=changelog,
        )
        template.compute_checksum()
        return template

    def _rebuild_index(self):
        """重建索引"""
        self._index = {}
        for name, tmpl in self._templates.items():
            self._index[name] = {
                "name": name,
                "display_name": tmpl.metadata.display_name,
                "category": tmpl.metadata.category,
                "tags": tmpl.metadata.tags,
                "version": tmpl.metadata.version,
                "description": tmpl.metadata.description,
                "variables_count": len(tmpl.variables),
            }

        # 保存索引
        index_path = self._meta_dir / "index.yaml"
        with open(index_path, "w", encoding="utf-8") as f:
            yaml.dump(self._index, f, allow_unicode=True, default_flow_style=False)

    def get(self, name: str) -> Optional[PromptTemplate]:
        """获取模板"""
        return self._templates.get(name)

    def list_all(self) -> list[dict]:
        """列出所有模板摘要"""
        return list(self._index.values())

    def list_by_category(self, category: str) -> list[dict]:
        """按分类列出模板"""
        return [t for t in self._index.values() if t["category"] == category]

    def render(self, name: str, **kwargs) -> str:
        """渲染模板"""
        template = self._templates.get(name)
        if not template:
            raise ValueError(f"模板 '{name}' 不存在")

        # 填充默认值
        for var in template.variables:
            if var.name not in kwargs and var.default is not None:
                kwargs[var.name] = var.default

        # 校验必填
        missing = [
            var.name for var in template.variables
            if var.required and var.name not in kwargs
        ]
        if missing:
            raise ValueError(f"缺少必填变量: {', '.join(missing)}")

        env = Environment(trim_blocks=True, lstrip_blocks=True)
        jinja_template = env.from_string(template.template)
        return jinja_template.render(**kwargs)

    def save(self, template: PromptTemplate, overwrite: bool = False):
        """保存模板到文件"""
        category_dir = self.base_dir / template.metadata.category
        category_dir.mkdir(exist_ok=True)

        file_path = category_dir / f"{template.metadata.name}.yaml"
        if file_path.exists() and not overwrite:
            raise FileExistsError(f"模板文件已存在: {file_path}")

        # 更新时间
        template.metadata.updated_at = datetime.now().strftime("%Y-%m-%d")
        template.compute_checksum()

        # 序列化
        data = {
            "metadata": {
                "name": template.metadata.name,
                "display_name": template.metadata.display_name,
                "version": template.metadata.version,
                "author": template.metadata.author,
                "created_at": template.metadata.created_at,
                "updated_at": template.metadata.updated_at,
                "category": template.metadata.category,
                "tags": template.metadata.tags,
                "description": template.metadata.description,
                "license": template.metadata.license,
            },
            "variables": [
                {k: v for k, v in vars(var).items() if v is not None}
                for var in template.variables
            ],
            "template": template.template,
            "examples": [
                {"title": ex.title, "variables": ex.variables,
                 "expected_output_prefix": ex.expected_output_prefix}
                for ex in template.examples
            ],
            "changelog": [
                {"version": cl.version, "date": cl.date, "changes": cl.changes}
                for cl in template.changelog
            ],
        }

        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

        # 更新内存
        self._templates[template.metadata.name] = template
        self._rebuild_index()
        print(f"✅ 模板已保存: {file_path}")
```

### 3.3 搜索引擎

```python
import re
from collections import Counter


class TemplateSearchEngine:
    """模板搜索引擎"""

    def __init__(self, manager: TemplateManager):
        self.manager = manager

    def search(self, query: str, limit: int = 10) -> list[dict]:
        """全文搜索模板"""
        query_lower = query.lower()
        query_tokens = set(re.findall(r'\w+', query_lower))
        results = []

        for name, index_info in self.manager._index.items():
            score = 0

            # 名称匹配 (权重最高)
            if query_lower in name.lower():
                score += 10

            # 显示名匹配
            if query_lower in index_info["display_name"].lower():
                score += 8

            # 描述匹配
            if query_lower in index_info["description"].lower():
                score += 5

            # 标签匹配
            for tag in index_info["tags"]:
                tag_lower = tag.lower()
                if query_lower in tag_lower or tag_lower in query_lower:
                    score += 6

            # Token 级匹配
            desc_tokens = set(re.findall(r'\w+', index_info["description"].lower()))
            overlap = query_tokens & desc_tokens
            score += len(overlap) * 2

            # 分类匹配
            if query_lower in index_info["category"].lower():
                score += 3

            if score > 0:
                results.append({
                    **index_info,
                    "score": score,
                })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    def suggest_tags(self, partial: str, limit: int = 5) -> list[str]:
        """标签自动补全"""
        all_tags = set()
        for tmpl in self.manager._templates.values():
            all_tags.update(tmpl.metadata.tags)

        matching = [t for t in all_tags if partial.lower() in t.lower()]
        return sorted(matching)[:limit]

    def get_categories(self) -> dict[str, int]:
        """获取所有分类及其模板数量"""
        categories: Counter = Counter()
        for info in self.manager._index.values():
            categories[info["category"]] += 1
        return dict(categories)
```

---

## 4. 版本管理

```python
class TemplateVersionManager:
    """模板版本管理器"""

    def __init__(self, manager: TemplateManager):
        self.manager = manager

    def bump_version(self, name: str, bump_type: str = "patch") -> str:
        """升级版本号"""
        template = self.manager.get(name)
        if not template:
            raise ValueError(f"模板 '{name}' 不存在")

        major, minor, patch = [int(x) for x in template.metadata.version.split(".")]

        if bump_type == "major":
            major, minor, patch = major + 1, 0, 0
        elif bump_type == "minor":
            minor, patch = minor + 1, 0
        elif bump_type == "patch":
            patch += 1
        else:
            raise ValueError(f"无效的 bump_type: {bump_type}")

        new_version = f"{major}.{minor}.{patch}"
        template.metadata.version = new_version
        return new_version

    def add_changelog(self, name: str, changes: str, bump_type: str = "patch"):
        """添加变更记录"""
        template = self.manager.get(name)
        if not template:
            raise ValueError(f"模板 '{name}' 不存在")

        new_version = self.bump_version(name, bump_type)
        template.changelog.append(ChangelogEntry(
            version=new_version,
            date=datetime.now().strftime("%Y-%m-%d"),
            changes=changes,
        ))
        self.manager.save(template, overwrite=True)
        return new_version

    def get_changelog(self, name: str) -> list[dict]:
        """获取变更历史"""
        template = self.manager.get(name)
        if not template:
            return []
        return [
            {"version": cl.version, "date": cl.date, "changes": cl.changes}
            for cl in reversed(template.changelog)
        ]

    def diff_versions(self, name: str, v1: str, v2: str) -> dict:
        """比较两个版本的差异（基于 changelog）"""
        template = self.manager.get(name)
        if not template:
            raise ValueError(f"模板 '{name}' 不存在")

        v1_entry = next((cl for cl in template.changelog if cl.version == v1), None)
        v2_entry = next((cl for cl in template.changelog if cl.version == v2), None)

        return {
            "template": name,
            "v1": {"version": v1, "found": v1_entry is not None},
            "v2": {"version": v2, "found": v2_entry is not None},
            "v1_changes": v1_entry.changes if v1_entry else "未找到",
            "v2_changes": v2_entry.changes if v2_entry else "未找到",
        }
```

---

## 5. 导入导出

```python
import zipfile
import json
from io import BytesIO


class TemplateExporter:
    """模板导出器"""

    def __init__(self, manager: TemplateManager):
        self.manager = manager

    def export_single(self, name: str) -> dict:
        """导出单个模板为字典"""
        template = self.manager.get(name)
        if not template:
            raise ValueError(f"模板 '{name}' 不存在")

        return {
            "format": "prompt_template_v1",
            "exported_at": datetime.now().isoformat(),
            "template": {
                "metadata": vars(template.metadata),
                "variables": [vars(v) for v in template.variables],
                "template": template.template,
                "examples": [vars(ex) for ex in template.examples],
                "changelog": [vars(cl) for cl in template.changelog],
            },
        }

    def export_json(self, names: list[str]) -> str:
        """导出为 JSON 字符串"""
        data = {
            "format": "prompt_template_bundle_v1",
            "exported_at": datetime.now().isoformat(),
            "templates": [self.export_single(name)["template"] for name in names],
        }
        return json.dumps(data, ensure_ascii=False, indent=2)

    def export_zip(self, names: list[str], output_path: str):
        """导出为 ZIP 文件"""
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for name in names:
                template_data = self.export_single(name)
                json_content = json.dumps(template_data, ensure_ascii=False, indent=2)
                zf.writestr(f"{name}.json", json_content)

            # 添加清单文件
            manifest = {
                "templates": names,
                "count": len(names),
                "exported_at": datetime.now().isoformat(),
            }
            zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

        print(f"✅ 已导出 {len(names)} 个模板到 {output_path}")


class TemplateImporter:
    """模板导入器"""

    def __init__(self, manager: TemplateManager):
        self.manager = manager

    def import_json(self, json_str: str, overwrite: bool = False) -> list[str]:
        """从 JSON 字符串导入"""
        data = json.loads(json_str)
        imported = []

        templates_data = data.get("templates", [])
        for tmpl_data in templates_data:
            meta = TemplateMeta(**tmpl_data["metadata"])
            variables = [VariableDef(**v) for v in tmpl_data["variables"]]
            examples = [Example(**ex) for ex in tmpl_data.get("examples", [])]
            changelog = [ChangelogEntry(**cl) for cl in tmpl_data.get("changelog", [])]

            template = PromptTemplate(
                metadata=meta,
                variables=variables,
                template=tmpl_data["template"],
                examples=examples,
                changelog=changelog,
            )

            try:
                self.manager.save(template, overwrite=overwrite)
                imported.append(meta.name)
            except FileExistsError:
                print(f"⚠️ 跳过已存在的模板: {meta.name}")

        return imported

    def import_zip(self, zip_path: str, overwrite: bool = False) -> list[str]:
        """从 ZIP 文件导入"""
        imported = []
        with zipfile.ZipFile(zip_path, 'r') as zf:
            for filename in zf.namelist():
                if filename.endswith('.json') and filename != 'manifest.json':
                    content = zf.read(filename).decode('utf-8')
                    try:
                        names = self.import_json(
                            json.dumps({"templates": [json.loads(content)["template"]]}),
                            overwrite=overwrite,
                        )
                        imported.extend(names)
                    except Exception as e:
                        print(f"⚠️ 导入 {filename} 失败: {e}")

        print(f"✅ 已导入 {len(imported)} 个模板")
        return imported
```

---

## 6. CLI 接口

```python
def cli_main():
    """CLI 入口"""
    import argparse

    parser = argparse.ArgumentParser(description="Prompt 模板库管理工具")
    subparsers = parser.add_subparsers(dest="command")

    # list 命令
    list_parser = subparsers.add_parser("list", help="列出所有模板")
    list_parser.add_argument("--category", help="按分类过滤")
    list_parser.add_argument("--tag", help="按标签过滤")

    # search 命令
    search_parser = subparsers.add_parser("search", help="搜索模板")
    search_parser.add_argument("query", help="搜索关键词")
    search_parser.add_argument("--limit", type=int, default=10, help="返回数量")

    # show 命令
    show_parser = subparsers.add_parser("show", help="查看模板详情")
    show_parser.add_argument("name", help="模板名称")

    # render 命令
    render_parser = subparsers.add_parser("render", help="渲染模板")
    render_parser.add_argument("name", help="模板名称")
    render_parser.add_argument("--vars", help="变量 JSON 字符串")

    # export 命令
    export_parser = subparsers.add_parser("export", help="导出模板")
    export_parser.add_argument("names", nargs="+", help="模板名称列表")
    export_parser.add_argument("--format", choices=["json", "zip"], default="json")
    export_parser.add_argument("--output", help="输出文件路径")

    # import 命令
    import_parser = subparsers.add_parser("import", help="导入模板")
    import_parser.add_argument("file", help="导入文件路径")
    import_parser.add_argument("--overwrite", action="store_true")

    args = parser.parse_args()

    manager = TemplateManager()

    if args.command == "list":
        if args.category:
            templates = manager.list_by_category(args.category)
        else:
            templates = manager.list_all()

        for t in templates:
            tags = ", ".join(t["tags"])
            print(f"  [{t['category']}] {t['name']} v{t['version']} - {t['description']}")
            print(f"           标签: {tags}")

    elif args.command == "search":
        engine = TemplateSearchEngine(manager)
        results = engine.search(args.query, args.limit)
        for r in results:
            print(f"  [{r['score']}] {r['name']} - {r['description']}")

    elif args.command == "show":
        tmpl = manager.get(args.name)
        if tmpl:
            print(f"名称: {tmpl.metadata.display_name}")
            print(f"版本: {tmpl.metadata.version}")
            print(f"作者: {tmpl.metadata.author}")
            print(f"分类: {tmpl.metadata.category}")
            print(f"标签: {', '.join(tmpl.metadata.tags)}")
            print(f"描述: {tmpl.metadata.description}")
            print(f"\n变量 ({len(tmpl.variables)}):")
            for v in tmpl.variables:
                req = "必填" if v.required else "可选"
                print(f"  - {v.name} ({v.type}, {req}): {v.description}")
        else:
            print(f"模板 '{args.name}' 不存在")

    elif args.command == "render":
        variables = json.loads(args.vars) if args.vars else {}
        try:
            result = manager.render(args.name, **variables)
            print(result)
        except Exception as e:
            print(f"渲染失败: {e}")

    elif args.command == "export":
        exporter = TemplateExporter(manager)
        if args.format == "json":
            output = exporter.export_json(args.names)
            if args.output:
                Path(args.output).write_text(output, encoding="utf-8")
                print(f"已导出到 {args.output}")
            else:
                print(output)
        elif args.format == "zip":
            output = args.output or "templates.zip"
            exporter.export_zip(args.names, output)

    elif args.command == "import":
        importer = TemplateImporter(manager)
        if args.file.endswith(".zip"):
            imported = importer.import_zip(args.file, args.overwrite)
        else:
            content = Path(args.file).read_text(encoding="utf-8")
            imported = importer.import_json(content, args.overwrite)
        print(f"已导入: {', '.join(imported)}")

    else:
        parser.print_help()
```

---

## 7. 完整使用示例

```python
def demo_complete_workflow():
    """完整工作流演示"""

    # 1. 初始化模板库
    manager = TemplateManager("my_templates")

    # 2. 创建新模板
    code_review = PromptTemplate(
        metadata=TemplateMeta(
            name="code_review",
            display_name="代码审查模板",
            version="1.0.0",
            author="DevOps Team",
            created_at="2024-06-01",
            updated_at="2024-06-01",
            category="code",
            tags=["代码审查", "质量", "安全"],
            description="对代码片段进行多维度审查",
            license="MIT",
        ),
        variables=[
            VariableDef(name="language", type="text", required=True, description="编程语言"),
            VariableDef(name="code", type="text", required=True, description="待审查代码"),
            VariableDef(name="focus", type="list", required=False, description="审查重点",
                       default=["代码质量", "安全性", "性能"]),
        ],
        template='''你是一位资深的{{ language }}代码审查专家。

## 审查代码
```{{ language }}
{{ code }}
```

## 审查维度
{% for dim in focus %}
{{ loop.index }}. {{ dim }}
{% endfor %}

## 输出格式
对每个维度给出：
- 评分（1-10）
- 问题列表（如有）
- 改进建议

最后给出总体评分和总结。''',
        examples=[
            Example(
                title="Python 函数审查",
                variables={
                    "language": "python",
                    "code": "def add(a, b): return a + b",
                    "focus": ["代码质量", "可读性"],
                },
            ),
        ],
    )

    # 3. 保存模板
    manager.save(code_review)

    # 4. 搜索模板
    engine = TemplateSearchEngine(manager)
    results = engine.search("代码")
    print("搜索结果:")
    for r in results:
        print(f"  {r['name']}: {r['description']} (score: {r['score']})")

    # 5. 渲染模板
    try:
        prompt = manager.render(
            "code_review",
            language="python",
            code="def process(data):\n    return [d for d in data if d > 0]",
        )
        print("\n渲染结果:")
        print(prompt)
    except ValueError as e:
        print(f"渲染错误: {e}")

    # 6. 版本管理
    vm = TemplateVersionManager(manager)
    new_ver = vm.add_changelog(
        "code_review",
        "新增复杂度分析维度",
        bump_type="minor",
    )
    print(f"\n版本已升级到: {new_ver}")

    # 7. 导出
    exporter = TemplateExporter(manager)
    json_output = exporter.export_json(["code_review"])
    print(f"\n导出大小: {len(json_output)} 字符")


if __name__ == "__main__":
    demo_complete_workflow()
```

---

## 8. 对比表：模板存储方案

| 方案 | 可读性 | 可编辑性 | 版本控制 | 适合场景 |
|------|--------|---------|---------|---------|
| YAML 文件 | 高 | 高 | Git 友好 | 团队协作 |
| JSON 文件 | 中 | 中 | Git 友好 | 程序化管理 |
| 数据库 | 低 | 低 | 需自建 | 大规模系统 |
| Markdown+Frontmatter | 最高 | 最高 | Git 友好 | 文档驱动 |

---

## 9. 常见误区

### ❌ 错误 1：模板和数据混在一起

```python
# 错误：把具体的 Prompt 当模板存
template = "请分析苹果公司的财报"  # 这不是模板，是实例

# 正确：模板应包含变量占位符
template = "请分析{{ company }}的{{ report_type }}"
```

### ❌ 错误 2：没有版本变更记录

```python
# 错误：直接覆盖模板文件
save(template, overwrite=True)  # 旧版本丢失

# 正确：先记录变更再更新
version_manager.add_changelog("新增XX功能", bump_type="minor")
save(template, overwrite=True)
```

### ❌ 错误 3：模板示例不更新

```python
# 错误：模板改了变量但示例还是旧的
template = "请用{{ style }}风格写{{ content }}"  # 新增了 style 变量
examples = [{"content": "hello"}]  # 缺少 style

# 正确：示例应覆盖所有变量
examples = [{"content": "hello", "style": "formal"}]
```

---

## 10. 工程建议

1. **模板文件用 YAML 格式，纳入 Git 管理**：YAML 兼具可读性和结构化，配合 Git 做版本控制，每次修改都有清晰的 diff 记录。
2. **每次模板修改必须同步更新示例**：变量变了但示例没更新是模板库最常见的 bug，建议在 CI 中加校验：示例渲染不出错才能合并。
3. **为模板计算校验和**：用 MD5 或 SHA 对模板内容计算 checksum，快速检测模板是否被修改，防止缓存的渲染结果与实际模板不一致。
4. **搜索引擎是模板库的灵魂**：没有搜索的模板库就是文件堆，投入精力做好全文搜索、标签自动补全和分类过滤，让团队真正用起来。

---

## 11. 总结

- 模板库是 Prompt 工程的基础设施，让 Prompt 从散落的字符串变成可管理的资产
- YAML 格式兼具可读性和结构化，是模板定义的理想选择
- 版本管理和变更是团队协作的必备能力
- 搜索引擎让模板库真正可用，而非只是文件堆

---

## 练习

### 练习 1：扩展模板库
为模板库添加以下模板（每个至少包含 3 个变量、1 个示例）：
- 翻译模板（translation）
- 邮件撰写模板（email_writer）
- 数据分析报告模板（data_report）

### 练习 2：模板评分系统
实现一个 `TemplateScorer`，根据以下维度给模板打分：
- 完整性：是否有描述、示例、变更记录
- 质量：变量是否有类型约束和默认值
- 复用性：变量是否通用（非硬编码业务信息）

### 练习 3：团队协作功能
为模板库添加以下协作功能：
- 模板评论（记录使用反馈）
- 使用统计（记录调用次数、成功率）
- 收藏夹（用户可收藏常用模板）

---

## 参考答案

### 练习 1：扩展模板库

**思路**：每个模板需要包含完整的 metadata、至少 3 个带类型约束的变量、Jinja2 模板主体和 1 个使用示例。翻译模板重点在语言对和风格变量，邮件模板重点在收件人/主题/语气，数据分析模板重点在数据描述和分析维度。

**答案**：

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
from pathlib import Path
from jinja2 import Environment
import yaml
import hashlib


@dataclass
class VariableDef:
    name: str
    type: str
    required: bool = True
    description: str = ""
    default: Any = None
    choices: Optional[list[str]] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None


@dataclass
class Example:
    title: str
    variables: dict[str, Any]
    expected_output_prefix: str = ""


@dataclass
class ChangelogEntry:
    version: str
    date: str
    changes: str


@dataclass
class TemplateMeta:
    name: str
    display_name: str
    version: str
    author: str
    created_at: str
    updated_at: str
    category: str
    tags: list[str]
    description: str
    license: str = "MIT"


@dataclass
class PromptTemplate:
    metadata: TemplateMeta
    variables: list[VariableDef]
    template: str
    examples: list[Example] = field(default_factory=list)
    changelog: list[ChangelogEntry] = field(default_factory=list)
    checksum: str = ""

    def compute_checksum(self) -> str:
        content = self.template + "".join(v.name for v in self.variables)
        self.checksum = hashlib.md5(content.encode()).hexdigest()[:8]
        return self.checksum


def create_translation_template() -> PromptTemplate:
    """翻译模板"""
    return PromptTemplate(
        metadata=TemplateMeta(
            name="translation",
            display_name="翻译模板",
            version="1.0.0",
            author="Prompt Engineering Team",
            created_at="2024-06-01",
            updated_at="2024-06-01",
            category="generation",
            tags=["翻译", "多语言", "文本处理"],
            description="将文本从源语言翻译为目标语言，支持风格控制",
        ),
        variables=[
            VariableDef(
                name="source_lang", type="text", required=True,
                description="源语言", default="中文",
            ),
            VariableDef(
                name="target_lang", type="text", required=True,
                description="目标语言", default="英文",
            ),
            VariableDef(
                name="text", type="text", required=True,
                description="待翻译文本", min_length=1, max_length=5000,
            ),
            VariableDef(
                name="style", type="choice", required=False,
                description="翻译风格",
                choices=["formal", "casual", "technical", "literary"],
                default="formal",
            ),
        ],
        template='''你是一位专业的{{ source_lang }}→{{ target_lang }}翻译专家。

## 翻译任务
请将以下{{ source_lang }}文本翻译为{{ target_lang }}：

{{ text }}

## 翻译要求
{% if style == "formal" %}
- 使用正式、专业的表达
- 保持原文的严谨性
{% elif style == "casual" %}
- 使用口语化、自然的表达
- 适当意译使目标语言更地道
{% elif style == "technical" %}
- 保留专业术语，必要时附原文
- 保持技术文档的精确性
{% elif style == "literary" %}
- 注重文采和修辞
- 在忠实原文的基础上追求文学美感
{% endif %}

只输出翻译结果，不要解释。''',
        examples=[
            Example(
                title="技术文档翻译",
                variables={
                    "source_lang": "中文",
                    "target_lang": "英文",
                    "text": "Prompt Engineering 是设计和优化提示词的技术。",
                    "style": "technical",
                },
                expected_output_prefix="Prompt Engineering",
            ),
        ],
        changelog=[
            ChangelogEntry(version="1.0.0", date="2024-06-01", changes="初始版本"),
        ],
    )


def create_email_writer_template() -> PromptTemplate:
    """邮件撰写模板"""
    return PromptTemplate(
        metadata=TemplateMeta(
            name="email_writer",
            display_name="邮件撰写模板",
            version="1.0.0",
            author="Prompt Engineering Team",
            created_at="2024-06-01",
            updated_at="2024-06-01",
            category="generation",
            tags=["邮件", "商务写作", "沟通"],
            description="根据场景和语气生成专业邮件",
        ),
        variables=[
            VariableDef(
                name="recipient", type="text", required=True,
                description="收件人身份描述",
            ),
            VariableDef(
                name="purpose", type="text", required=True,
                description="邮件目的",
            ),
            VariableDef(
                name="key_points", type="list", required=True,
                description="邮件要点列表", min_items=1, max_items=8,
            ),
            VariableDef(
                name="tone", type="choice", required=False,
                description="语气",
                choices=["formal", "friendly", "urgent", "apologetic"],
                default="formal",
            ),
            VariableDef(
                name="language", type="text", required=False,
                description="输出语言", default="中文",
            ),
        ],
        template='''请撰写一封{{ language }}邮件。

## 邮件信息
- 收件人：{{ recipient }}
- 目的：{{ purpose }}

## 要点
{% for point in key_points %}
{{ loop.index }}. {{ point }}
{% endfor %}

## 语气要求
{% if tone == "formal" %}
使用正式商务语气，措辞严谨得体。
{% elif tone == "friendly" %}
使用友好亲切的语气，适当表达关心。
{% elif tone == "urgent" %}
强调紧迫性，但保持礼貌，明确期望的响应时间。
{% elif tone == "apologetic" %}
真诚致歉，说明原因，提出补救方案。
{% endif %}

## 输出格式
包含：主题行、称呼、正文、结尾敬语、署名。''',
        examples=[
            Example(
                title="项目延期通知",
                variables={
                    "recipient": "项目经理",
                    "purpose": "通知项目延期一周",
                    "key_points": ["延期原因", "新的交付时间", "补偿措施"],
                    "tone": "apologetic",
                    "language": "中文",
                },
                expected_output_prefix="主题",
            ),
        ],
        changelog=[
            ChangelogEntry(version="1.0.0", date="2024-06-01", changes="初始版本"),
        ],
    )


def create_data_report_template() -> PromptTemplate:
    """数据分析报告模板"""
    return PromptTemplate(
        metadata=TemplateMeta(
            name="data_report",
            display_name="数据分析报告模板",
            version="1.0.0",
            author="Prompt Engineering Team",
            created_at="2024-06-01",
            updated_at="2024-06-01",
            category="analysis",
            tags=["数据分析", "报告", "可视化"],
            description="根据数据描述生成结构化分析报告",
        ),
        variables=[
            VariableDef(
                name="dataset_description", type="text", required=True,
                description="数据集描述（字段、规模、来源）",
            ),
            VariableDef(
                name="analysis_goal", type="text", required=True,
                description="分析目标",
            ),
            VariableDef(
                name="dimensions", type="list", required=True,
                description="分析维度", min_items=1, max_items=6,
            ),
            VariableDef(
                name="audience", type="choice", required=False,
                description="报告受众",
                choices=["executive", "technical", "mixed"],
                default="mixed",
            ),
            VariableDef(
                name="output_format", type="choice", required=False,
                description="输出格式",
                choices=["markdown", "json"],
                default="markdown",
            ),
        ],
        template='''你是一位资深数据分析师，请根据以下信息撰写数据分析报告。

## 数据集
{{ dataset_description }}

## 分析目标
{{ analysis_goal }}

## 分析维度
{% for dim in dimensions %}
{{ loop.index }}. {{ dim }}
{% endfor %}

## 受众
{% if audience == "executive" %}
面向高管：重点结论和业务建议，少用技术术语。
{% elif audience == "technical" %}
面向技术团队：包含方法论、统计指标和实现细节。
{% elif audience == "mixed" %}
面向混合团队：兼顾结论可读性和技术严谨性。
{% endif %}

{% if output_format == "markdown" %}
## 输出格式
使用 Markdown，包含以下章节：
1. 摘要（3-5 句话总结核心发现）
2. 数据概览
3. 各维度分析结果
4. 关键发现与建议
{% elif output_format == "json" %}
## 输出格式
以 JSON 格式输出，包含 summary、overview、dimensions、recommendations 字段。
{% endif %}''',
        examples=[
            Example(
                title="电商销售分析",
                variables={
                    "dataset_description": "2024年Q1电商平台销售数据，含订单ID、商品类目、金额、地区、时间等字段，共10万条记录",
                    "analysis_goal": "找出销售增长的驱动因素和下滑品类的原因",
                    "dimensions": ["品类趋势", "地区分布", "客单价变化", "复购率"],
                    "audience": "executive",
                    "output_format": "markdown",
                },
                expected_output_prefix="# 数据分析报告",
            ),
        ],
        changelog=[
            ChangelogEntry(version="1.0.0", date="2024-06-01", changes="初始版本"),
        ],
    )


def demo_templates():
    """演示三个新模板"""
    templates = [
        create_translation_template(),
        create_email_writer_template(),
        create_data_report_template(),
    ]

    env = Environment(trim_blocks=True, lstrip_blocks=True)

    for tmpl in templates:
        print(f"\n{'='*50}")
        print(f"模板: {tmpl.metadata.display_name}")
        print(f"变量数: {len(tmpl.variables)}")
        print(f"标签: {', '.join(tmpl.metadata.tags)}")

        # 渲染示例
        if tmpl.examples:
            example = tmpl.examples[0]
            jinja_tmpl = env.from_string(tmpl.template)
            rendered = jinja_tmpl.render(**example.variables)
            print(f"\n示例渲染（{example.title}）:")
            print(rendered[:300] + "..." if len(rendered) > 300 else rendered)


if __name__ == "__main__":
    demo_templates()
```

**要点**：
- 每个模板至少 3 个变量且包含类型约束（choice 类型限定选项、text 类型限定长度），确保渲染时输入可控
- 变量的 default 值要合理——用户不传也能生成有意义的 Prompt，降低使用门槛
- 示例应覆盖典型用法，且 expected_output_prefix 可用于自动化校验模板是否正常工作

---

### 练习 2：模板评分系统

**思路**：从完整性、质量、复用性三个维度设计评分规则，每个维度下有若干检查项，满足则加分。最终输出总分和各维度明细，帮助团队识别需要改进的模板。

**答案**：

```python
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class VariableDef:
    name: str
    type: str
    required: bool = True
    description: str = ""
    default: Any = None
    choices: Optional[list[str]] = None


@dataclass
class Example:
    title: str
    variables: dict[str, Any]
    expected_output_prefix: str = ""


@dataclass
class ChangelogEntry:
    version: str
    date: str
    changes: str


@dataclass
class TemplateMeta:
    name: str
    display_name: str
    version: str
    author: str
    created_at: str
    updated_at: str
    category: str
    tags: list[str]
    description: str


@dataclass
class PromptTemplate:
    metadata: TemplateMeta
    variables: list[VariableDef]
    template: str
    examples: list[Example] = field(default_factory=list)
    changelog: list[ChangelogEntry] = field(default_factory=list)


@dataclass
class ScoreDetail:
    dimension: str
    score: float
    max_score: float
    checks: list[str]


class TemplateScorer:
    """模板评分系统"""

    # 硬编码的业务相关变量名（降低复用性）
    BUSINESS_KEYWORDS = [
        "company", "brand", "product_name", "org_id",
        "内部", "公司", "品牌名",
    ]

    def score(self, template: PromptTemplate) -> dict:
        completeness = self._score_completeness(template)
        quality = self._score_quality(template)
        reusability = self._score_reusability(template)

        total = completeness.score + quality.score + reusability.score
        max_total = completeness.max_score + quality.max_score + reusability.max_score

        return {
            "template": template.metadata.name,
            "total_score": round(total, 1),
            "max_score": max_total,
            "percentage": round(total / max_total * 100, 1),
            "dimensions": {
                "completeness": completeness,
                "quality": quality,
                "reusability": reusability,
            },
        }

    def _score_completeness(self, t: PromptTemplate) -> ScoreDetail:
        """完整性评分（满分 40）"""
        score = 0.0
        checks = []

        # 有描述（10分）
        if t.metadata.description and len(t.metadata.description) > 10:
            score += 10
            checks.append("✅ 有详细描述 (+10)")
        else:
            checks.append("❌ 缺少或过短的描述 (+0)")

        # 有示例（15分）
        if t.examples:
            score += 15
            checks.append(f"✅ 有 {len(t.examples)} 个示例 (+15)")
        else:
            checks.append("❌ 无示例 (+0)")

        # 有变更记录（10分）
        if t.changelog:
            score += 10
            checks.append(f"✅ 有 {len(t.changelog)} 条变更记录 (+10)")
        else:
            checks.append("❌ 无变更记录 (+0)")

        # 有标签（5分）
        if t.metadata.tags and len(t.metadata.tags) >= 2:
            score += 5
            checks.append("✅ 标签充分 (+5)")
        else:
            checks.append("❌ 标签不足 (+0)")

        return ScoreDetail("完整性", score, 40, checks)

    def _score_quality(self, t: PromptTemplate) -> ScoreDetail:
        """质量评分（满分 35）"""
        score = 0.0
        checks = []

        typed_vars = [v for v in t.variables if v.type]
        if typed_vars:
            ratio = len(typed_vars) / len(t.variables) if t.variables else 0
            pts = round(ratio * 15, 1)
            score += pts
            checks.append(f"✅ 变量类型约束覆盖 {ratio:.0%} (+{pts})")
        else:
            checks.append("❌ 变量无类型约束 (+0)")

        vars_with_desc = [v for v in t.variables if v.description]
        if vars_with_desc:
            ratio = len(vars_with_desc) / len(t.variables) if t.variables else 0
            pts = round(ratio * 10, 1)
            score += pts
            checks.append(f"✅ 变量描述覆盖 {ratio:.0%} (+{pts})")
        else:
            checks.append("❌ 变量无描述 (+0)")

        vars_with_default = [v for v in t.variables if not v.required and v.default is not None]
        optional_vars = [v for v in t.variables if not v.required]
        if optional_vars:
            ratio = len(vars_with_default) / len(optional_vars)
            pts = round(ratio * 10, 1)
            score += pts
            checks.append(f"✅ 可选变量默认值覆盖 {ratio:.0%} (+{pts})")
        elif not optional_vars:
            score += 5
            checks.append("✅ 所有变量均为必填，无需默认值 (+5)")
        else:
            checks.append("❌ 可选变量缺少默认值 (+0)")

        return ScoreDetail("质量", score, 35, checks)

    def _score_reusability(self, t: PromptTemplate) -> ScoreDetail:
        """复用性评分（满分 25）"""
        score = 0.0
        checks = []

        # 变量名是否包含业务硬编码关键词
        all_names = [v.name.lower() for v in t.variables]
        all_descs = [v.description.lower() for v in t.variables]
        combined = " ".join(all_names + all_descs)

        has_business = any(kw in combined for kw in self.BUSINESS_KEYWORDS)
        if not has_business:
            score += 15
            checks.append("✅ 变量通用，无业务硬编码 (+15)")
        else:
            checks.append("❌ 变量含业务硬编码信息，降低复用性 (+0)")

        # 模板中是否有硬编码的业务内容
        template_lower = t.template.lower()
        has_template_biz = any(kw in template_lower for kw in self.BUSINESS_KEYWORDS)
        if not has_template_biz:
            score += 10
            checks.append("✅ 模板内容通用 (+10)")
        else:
            checks.append("❌ 模板内容含业务硬编码 (+0)")

        return ScoreDetail("复用性", score, 25, checks)

    def report(self, result: dict) -> str:
        lines = [
            f"模板评分报告: {result['template']}",
            f"总分: {result['total_score']}/{result['max_score']} ({result['percentage']}%)",
            "",
        ]

        grade = "A" if result["percentage"] >= 90 else "B" if result["percentage"] >= 70 else "C" if result["percentage"] >= 50 else "D"
        lines.append(f"等级: {grade}")
        lines.append("")

        for dim_name, detail in result["dimensions"].items():
            lines.append(f"## {detail.dimension} ({detail.score}/{detail.max_score})")
            for check in detail.checks:
                lines.append(f"  {check}")
            lines.append("")

        return "\n".join(lines)


# 测试
from datetime import datetime

good_template = PromptTemplate(
    metadata=TemplateMeta(
        name="content_analysis",
        display_name="内容分析模板",
        version="1.2.0",
        author="Team",
        created_at="2024-01-15",
        updated_at="2024-03-20",
        category="analysis",
        tags=["内容分析", "文本处理", "通用"],
        description="对文本内容进行多维度分析，支持自定义分析维度",
    ),
    variables=[
        VariableDef(name="role", type="text", required=True, description="AI 扮演的角色"),
        VariableDef(name="content", type="text", required=True, description="待分析内容"),
        VariableDef(name="dimensions", type="list", required=True, description="分析维度"),
        VariableDef(name="output_format", type="choice", required=False,
                    description="输出格式", choices=["markdown", "json"], default="markdown"),
    ],
    template="你是一位{{ role }}。\n\n请分析：{{ content }}",
    examples=[Example(title="评论分析", variables={"role": "分析师", "content": "好评", "dimensions": ["情感"]})],
    changelog=[ChangelogEntry(version="1.2.0", date="2024-03-20", changes="新增 JSON 输出")],
)

scorer = TemplateScorer()
result = scorer.score(good_template)
print(scorer.report(result))
```

**要点**：
- 三个维度的权重分配（40/35/25）反映了模板管理的优先级：完整性 > 质量 > 复用性
- 业务硬编码检测用关键词匹配，实际项目中可扩展为更复杂的模式匹配
- 评分结果可用于 CI 流水线：低于 B 级的模板不允许合并到主分支

---

### 练习 3：团队协作功能

**思路**：评论用 JSON 文件按模板名分组存储，统计在每次 render 调用时累加计数，收藏夹按用户 ID 维护一个模板名集合。三个功能都挂载到 TemplateManager 上，通过装饰器或方法扩展实现。

**答案**：

```python
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from collections import Counter
import json
import os


@dataclass
class Comment:
    user: str
    content: str
    rating: int  # 1-5
    created_at: str = ""

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().strftime("%Y-%m-%d %H:%M")


@dataclass
class UsageStats:
    template_name: str
    total_calls: int = 0
    success_calls: int = 0
    fail_calls: int = 0
    last_used_at: str = ""

    @property
    def success_rate(self) -> float:
        if self.total_calls == 0:
            return 0.0
        return round(self.success_calls / self.total_calls * 100, 1)


class CollaborationManager:
    """团队协作管理器"""

    def __init__(self, base_dir: str = "prompt_templates"):
        self.base_dir = Path(base_dir)
        self._meta_dir = self.base_dir / "_meta"
        self._meta_dir.mkdir(parents=True, exist_ok=True)

        self._comments_file = self._meta_dir / "comments.json"
        self._stats_file = self._meta_dir / "usage_stats.json"
        self._favorites_file = self._meta_dir / "favorites.json"

        self._comments: dict[str, list[dict]] = self._load_json(self._comments_file, {})
        self._stats: dict[str, dict] = self._load_json(self._stats_file, {})
        self._favorites: dict[str, list[str]] = self._load_json(self._favorites_file, {})

    def _load_json(self, path: Path, default: Any) -> Any:
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return default

    def _save_json(self, path: Path, data: Any):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    # --- 评论功能 ---

    def add_comment(self, template_name: str, user: str, content: str, rating: int):
        """添加模板评论"""
        if not 1 <= rating <= 5:
            raise ValueError("评分必须在 1-5 之间")

        comment = Comment(user=user, content=content, rating=rating)

        if template_name not in self._comments:
            self._comments[template_name] = []

        self._comments[template_name].append({
            "user": comment.user,
            "content": comment.content,
            "rating": comment.rating,
            "created_at": comment.created_at,
        })
        self._save_json(self._comments_file, self._comments)
        print(f"✅ 已添加评论: {template_name} ({user}, {rating}⭐)")

    def get_comments(self, template_name: str) -> list[dict]:
        """获取模板的所有评论"""
        return self._comments.get(template_name, [])

    def get_average_rating(self, template_name: str) -> float:
        """获取模板平均评分"""
        comments = self.get_comments(template_name)
        if not comments:
            return 0.0
        return round(sum(c["rating"] for c in comments) / len(comments), 1)

    # --- 使用统计 ---

    def record_usage(self, template_name: str, success: bool = True):
        """记录模板使用"""
        if template_name not in self._stats:
            self._stats[template_name] = {
                "total_calls": 0,
                "success_calls": 0,
                "fail_calls": 0,
                "last_used_at": "",
            }

        stats = self._stats[template_name]
        stats["total_calls"] += 1
        if success:
            stats["success_calls"] += 1
        else:
            stats["fail_calls"] += 1
        stats["last_used_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")

        self._save_json(self._stats_file, self._stats)

    def get_usage_stats(self, template_name: str) -> UsageStats:
        """获取模板使用统计"""
        data = self._stats.get(template_name, {})
        return UsageStats(
            template_name=template_name,
            total_calls=data.get("total_calls", 0),
            success_calls=data.get("success_calls", 0),
            fail_calls=data.get("fail_calls", 0),
            last_used_at=data.get("last_used_at", ""),
        )

    def get_popular_templates(self, limit: int = 10) -> list[dict]:
        """获取最受欢迎的模板"""
        ranking = []
        for name, data in self._stats.items():
            ranking.append({
                "name": name,
                "total_calls": data.get("total_calls", 0),
                "success_rate": round(
                    data.get("success_calls", 0) / max(data.get("total_calls", 1), 1) * 100, 1
                ),
            })
        ranking.sort(key=lambda x: x["total_calls"], reverse=True)
        return ranking[:limit]

    # --- 收藏夹 ---

    def add_favorite(self, user: str, template_name: str):
        """收藏模板"""
        if user not in self._favorites:
            self._favorites[user] = []
        if template_name not in self._favorites[user]:
            self._favorites[user].append(template_name)
            self._save_json(self._favorites_file, self._favorites)
            print(f"⭐ {user} 收藏了 {template_name}")
        else:
            print(f"已收藏过 {template_name}")

    def remove_favorite(self, user: str, template_name: str):
        """取消收藏"""
        if user in self._favorites and template_name in self._favorites[user]:
            self._favorites[user].remove(template_name)
            self._save_json(self._favorites_file, self._favorites)
            print(f"取消收藏: {template_name}")

    def get_favorites(self, user: str) -> list[str]:
        """获取用户的收藏列表"""
        return self._favorites.get(user, [])

    def get_most_favorited(self, limit: int = 10) -> list[dict]:
        """获取被收藏最多的模板"""
        counter: Counter = Counter()
        for user_favs in self._favorites.values():
            counter.update(user_favs)
        return [{"name": name, "favorites": count} for name, count in counter.most_common(limit)]

    # --- 综合报告 ---

    def template_report(self, template_name: str) -> str:
        """生成模板综合报告"""
        comments = self.get_comments(template_name)
        stats = self.get_usage_stats(template_name)
        avg_rating = self.get_average_rating(template_name)

        lines = [
            f"模板报告: {template_name}",
            f"使用次数: {stats.total_calls} (成功率: {stats.success_rate}%)",
            f"评论数: {len(comments)} (平均评分: {avg_rating}⭐)",
            f"最后使用: {stats.last_used_at or '从未使用'}",
        ]
        return "\n".join(lines)


# 测试
collab = CollaborationManager("my_templates")

# 模拟使用
collab.record_usage("code_review", success=True)
collab.record_usage("code_review", success=True)
collab.record_usage("code_review", success=False)
collab.record_usage("translation", success=True)

# 添加评论
collab.add_comment("code_review", "张三", "非常好用，代码审查效率提升很多", 5)
collab.add_comment("code_review", "李四", "希望能支持更多语言", 4)

# 收藏
collab.add_favorite("张三", "code_review")
collab.add_favorite("张三", "translation")
collab.add_favorite("李四", "code_review")

# 查看报告
print("\n" + collab.template_report("code_review"))

# 热门模板
print("\n热门模板:")
for t in collab.get_popular_templates():
    print(f"  {t['name']}: {t['total_calls']} 次调用, 成功率 {t['success_rate']}%")

# 张三的收藏
print(f"\n张三的收藏: {collab.get_favorites('张三')}")
```

**要点**：
- 评论、统计、收藏夹三个功能独立存储（三个 JSON 文件），互不影响，便于单独扩展
- 使用统计应在实际 render 调用时自动记录，而非手动调用——可在 TemplateManager.render 外包一层装饰器
- 收藏夹按用户维度存储，方便后续扩展为"团队共享收藏"或"推荐模板"功能
