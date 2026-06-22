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
