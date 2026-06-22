# 04 - Prompt 版本管理

> **课程定位**：阶段三 · 测试与优化 · 第4课  
> **前置知识**：01-Prompt 测试方法论、02-评估指标设计  
> **预计用时**：90 分钟

---

## 场景引入

你的 Prompt 经过 A/B 测试验证了新版本更优，于是上线了 v2。但上线后发现某个边界场景处理不如 v1。你想回滚到 v1，却发现 v1 的 Prompt 早就被覆盖了——它只存在于 Git 的 commit 历史里，你还得翻半天才能找到。更糟的是，你发现团队里三个人各自维护着不同版本的 Prompt 文件，命名规则五花八门，没人知道线上跑的到底是哪个版本。Prompt 需要像代码一样被系统化地管理起来。

---

## 学习目标

完成本课后，你将能够：

1. 理解 Prompt 版本管理的重要性和核心原则
2. 掌握 Prompt 语义化版本号的规范
3. 学会将 Prompt 集成到 Git 工作流中
4. 实现 Prompt 的 diff 可视化和 changelog 自动生成
5. 构建一个完整的 Prompt 版本管理系统

---

## 1. 为什么需要版本管理？

### 1.1 没有版本管理的困境

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   prompt_v1.txt                                         │
│   prompt_v2.txt                                         │
│   prompt_v2_fixed.txt                                   │
│   prompt_v2_fixed_final.txt                             │
│   prompt_v2_fixed_final_REAL.txt                        │
│   prompt_v2_fixed_final_REAL_真的最终版.txt               │
│   prompt_v3_张伟改的.txt                                  │
│   prompt_v3_李娜说要改回v2.txt                            │
│                                                         │
│   ← 请问：线上用的是哪个版本？                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 1.2 版本管理的核心价值

| 价值 | 说明 |
|------|------|
| 可追溯 | 知道每次修改的作者、时间、原因 |
| 可回滚 | 出问题时快速回到上一个稳定版本 |
| 可协作 | 多人协作时避免覆盖彼此的工作 |
| 可审计 | 满足合规要求，记录完整的变更历史 |
| 可实验 | 支持 A/B 测试，同时维护多个版本 |

### 1.3 Prompt 版本管理 vs 代码版本管理

| 维度 | 代码版本管理 | Prompt 版本管理 |
|------|-------------|----------------|
| 内容形式 | 纯文本代码 | 文本 + 元数据 |
| 变更粒度 | 行级差异 | 语义级差异 |
| 依赖关系 | import/require | 模型版本、上下文 |
| 测试方式 | 单元测试 | 质量评估 + A/B 测试 |
| 部署方式 | 编译部署 | 配置/模板加载 |

---

## 2. 语义化版本号

### 2.1 Prompt 版本号规范

```
版本号格式：MAJOR.MINOR.PATCH

┌─────────┬─────────────────────────────────────────────┐
│  MAJOR  │  Prompt 的核心逻辑发生重大变化                │
│  (主版本) │  例：改变任务类型、切换目标模型               │
├─────────┼─────────────────────────────────────────────┤
│  MINOR  │  添加新功能或显著改进，但核心逻辑不变          │
│  (次版本) │  例：增加输出格式约束、添加示例               │
├─────────┼─────────────────────────────────────────────┤
│  PATCH  │  小幅修正，不影响整体行为                     │
│  (补丁)  │  例：修正错别字、调整措辞                     │
└─────────┴─────────────────────────────────────────────┘

示例：
1.0.0 → 1.0.1  修正了一个错别字
1.0.1 → 1.1.0  增加了输出格式的 JSON 约束
1.1.0 → 2.0.0  从分类任务改为生成任务
```

### 2.2 预发布标签

```
版本号还可以包含预发布标签：

1.2.0-alpha.1    内部测试版
1.2.0-beta.1     公开测试版
1.2.0-rc.1       候选发布版
1.2.0            正式发布版

在 Prompt 开发中的应用：
- alpha: 刚写完的 Prompt，还在调试
- beta: 通过了基础测试，邀请内部用户试用
- rc: 通过了 A/B 测试，准备上线
- stable: 已在线上稳定运行
```

### 2.3 版本号管理代码

```python
from dataclasses import dataclass
from enum import Enum
from datetime import datetime
import re

class ReleaseStage(Enum):
    ALPHA = "alpha"
    BETA = "beta"
    RC = "rc"
    STABLE = "stable"

@dataclass
class SemanticVersion:
    """语义化版本号"""
    major: int
    minor: int
    patch: int
    stage: ReleaseStage = ReleaseStage.STABLE
    stage_number: int = 0
    
    def __str__(self):
        base = f"{self.major}.{self.minor}.{self.patch}"
        if self.stage == ReleaseStage.STABLE:
            return base
        return f"{base}-{self.stage.value}.{self.stage_number}"
    
    @classmethod
    def parse(cls, version_str: str) -> "SemanticVersion":
        """解析版本号字符串"""
        pattern = r"^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$"
        match = re.match(pattern, version_str)
        if not match:
            raise ValueError(f"Invalid version: {version_str}")
        
        major, minor, patch = int(match.group(1)), int(match.group(2)), int(match.group(3))
        stage = ReleaseStage(match.group(4)) if match.group(4) else ReleaseStage.STABLE
        stage_number = int(match.group(5)) if match.group(5) else 0
        
        return cls(major, minor, patch, stage, stage_number)
    
    def bump_major(self) -> "SemanticVersion":
        return SemanticVersion(self.major + 1, 0, 0)
    
    def bump_minor(self) -> "SemanticVersion":
        return SemanticVersion(self.major, self.minor + 1, 0)
    
    def bump_patch(self) -> "SemanticVersion":
        return SemanticVersion(self.major, self.minor, self.patch + 1)
    
    def __gt__(self, other):
        return (self.major, self.minor, self.patch) > (other.major, other.minor, other.patch)
    
    def __eq__(self, other):
        return (self.major, self.minor, self.patch) == (other.major, other.minor, other.patch)


# 使用示例
v1 = SemanticVersion.parse("1.0.0")
v2 = v1.bump_minor()
print(v1)  # 1.0.0
print(v2)  # 1.1.0

v3 = SemanticVersion(1, 2, 0, ReleaseStage.BETA, 1)
print(v3)  # 1.2.0-beta.1
```

---

## 3. Prompt 版本生命周期

```
┌─────────────────────────────────────────────────────────┐
│                Prompt 版本生命周期                        │
│                                                         │
│  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐         │
│  │ 草稿  │───→│ 测试  │───→│ 评审  │───→│ 发布  │         │
│  │ Draft │    │ Test  │    │Review│    │Release│         │
│  └──────┘    └──────┘    └──────┘    └──────┘         │
│     │           │           │           │              │
│     │           │           │           ▼              │
│     │           │           │       ┌──────┐          │
│     │           │           │       │ 运行  │          │
│     │           │           │       │ Active│          │
│     │           │           │       └──┬───┘          │
│     │           │           │          │              │
│     │           │           │          ▼              │
│     │           │           │      ┌──────┐          │
│     │           │           │      │ 废弃  │          │
│     │           │           │      │ EOL   │          │
│     │           │           │      └──────┘          │
│     │           │           │                         │
│     └───────────┴───────────┴── 任何阶段都可能回退      │
└─────────────────────────────────────────────────────────┘
```

### 3.1 状态转换规则

```python
from enum import Enum

class PromptStatus(Enum):
    DRAFT = "draft"           # 草稿：刚创建或正在编辑
    TESTING = "testing"       # 测试中：正在运行自动化测试
    REVIEW = "review"         # 评审中：等待人工审核
    ACTIVE = "active"         # 活跃：在线上使用
    DEPRECATED = "deprecated" # 废弃：不再推荐使用
    EOL = "eol"              # 生命周期结束

# 允许的状态转换
VALID_TRANSITIONS = {
    PromptStatus.DRAFT: [PromptStatus.TESTING],
    PromptStatus.TESTING: [PromptStatus.REVIEW, PromptStatus.DRAFT],
    PromptStatus.REVIEW: [PromptStatus.ACTIVE, PromptStatus.DRAFT],
    PromptStatus.ACTIVE: [PromptStatus.DEPRECATED],
    PromptStatus.DEPRECATED: [PromptStatus.EOL],
}

def validate_transition(current: PromptStatus, 
                        target: PromptStatus) -> bool:
    """验证状态转换是否合法"""
    return target in VALID_TRANSITIONS.get(current, [])
```

---

## 4. Git 集成策略

### 4.1 Prompt 存储方式

```
方式一：单文件存储（简单场景）

project/
├── prompts/
│   ├── classifier/
│   │   └── prompt.md        # 当前版本
│   ├── generator/
│   │   └── prompt.md
│   └── summarizer/
│       └── prompt.md


方式二：结构化存储（推荐）

project/
├── prompts/
│   ├── classifier/
│   │   ├── prompt.md         # Prompt 内容
│   │   ├── metadata.yaml     # 版本元数据
│   │   ├── changelog.md      # 变更日志
│   │   └── tests/            # 相关测试
│   │       └── test_cases.json
│   └── generator/
│       ├── prompt.md
│       ├── metadata.yaml
│       └── changelog.md


方式三：模板 + 配置分离（复杂场景）

project/
├── prompts/
│   ├── templates/
│   │   ├── classifier.j2     # Jinja2 模板
│   │   └── generator.j2
│   └── configs/
│       ├── v1.0.0.yaml       # 特定版本的配置
│       └── v1.1.0.yaml
```

### 4.2 元数据文件格式

```yaml
# prompts/classifier/metadata.yaml
name: sentiment-classifier
description: 情感分类 Prompt
version: 1.2.0
status: active
author: zhangwei@example.com
created_at: 2024-01-15T10:00:00Z
updated_at: 2024-03-20T15:30:00Z

model:
  name: gpt-4o-mini
  temperature: 0.0
  max_tokens: 500

tags:
  - sentiment
  - classification
  - chinese

metrics:
  accuracy: 0.92
  relevance: 0.88
  test_coverage: 0.85

history:
  - version: 1.0.0
    date: 2024-01-15
    change: "初始版本"
  - version: 1.1.0
    date: 2024-02-10
    change: "添加 JSON 输出格式约束"
  - version: 1.2.0
    date: 2024-03-20
    change: "优化中文情感识别准确率"
```

### 4.3 Git Hook 自动化

```python
"""
.git/hooks/pre-commit - Prompt 版本检查
"""
import sys
import yaml
from pathlib import Path

def check_prompt_metadata():
    """检查 Prompt 元数据文件的格式"""
    prompts_dir = Path("prompts")
    
    for metadata_path in prompts_dir.glob("*/metadata.yaml"):
        try:
            with open(metadata_path) as f:
                metadata = yaml.safe_load(f)
            
            # 检查必需字段
            required_fields = ["name", "version", "status", "author"]
            for field in required_fields:
                if field not in metadata:
                    print(f"错误: {metadata_path} 缺少必需字段 '{field}'")
                    return False
            
            # 检查版本号格式
            version = metadata["version"]
            parts = version.split(".")
            if len(parts) != 3 or not all(p.isdigit() for p in parts):
                print(f"错误: {metadata_path} 版本号格式不正确: {version}")
                return False
            
            print(f"✓ {metadata_path} 检查通过")
            
        except Exception as e:
            print(f"错误: 解析 {metadata_path} 失败: {e}")
            return False
    
    return True

if __name__ == "__main__":
    if not check_prompt_metadata():
        sys.exit(1)
```

---

## 5. Diff 可视化

### 5.1 Prompt Diff 算法

```python
from difflib import SequenceMatcher
from dataclasses import dataclass
from typing import Optional

@dataclass
class DiffLine:
    """Diff 行"""
    line_num_old: Optional[int]
    line_num_new: Optional[int]
    content: str
    type: str  # 'equal', 'insert', 'delete', 'replace'

@dataclass
class DiffResult:
    """Diff 结果"""
    old_version: str
    new_version: str
    lines: list[DiffLine]
    stats: dict

class PromptDiffer:
    """Prompt 差异比较器"""
    
    def diff(self, old_text: str, new_text: str) -> DiffResult:
        """计算两个 Prompt 版本的差异"""
        old_lines = old_text.splitlines(keepends=True)
        new_lines = new_text.splitlines(keepends=True)
        
        matcher = SequenceMatcher(None, old_lines, new_lines)
        
        diff_lines = []
        stats = {"equal": 0, "insert": 0, "delete": 0, "replace": 0}
        
        old_num = 1
        new_num = 1
        
        for op, i1, i2, j1, j2 in matcher.get_opcodes():
            if op == 'equal':
                for k in range(i2 - i1):
                    diff_lines.append(DiffLine(
                        old_num + k, new_num + k, 
                        old_lines[i1 + k].rstrip(), 'equal'
                    ))
                stats['equal'] += i2 - i1
                old_num += i2 - i1
                new_num += j2 - j1
            
            elif op == 'insert':
                for k in range(j2 - j1):
                    diff_lines.append(DiffLine(
                        None, new_num + k,
                        new_lines[j1 + k].rstrip(), 'insert'
                    ))
                stats['insert'] += j2 - j1
                new_num += j2 - j1
            
            elif op == 'delete':
                for k in range(i2 - i1):
                    diff_lines.append(DiffLine(
                        old_num + k, None,
                        old_lines[i1 + k].rstrip(), 'delete'
                    ))
                stats['delete'] += i2 - i1
                old_num += i2 - i1
            
            elif op == 'replace':
                max_len = max(i2 - i1, j2 - j1)
                for k in range(max_len):
                    old_content = old_lines[i1 + k].rstrip() if k < (i2 - i1) else ""
                    new_content = new_lines[j1 + k].rstrip() if k < (j2 - j1) else ""
                    
                    diff_lines.append(DiffLine(
                        old_num + k if k < (i2 - i1) else None,
                        new_num + k if k < (j2 - j1) else None,
                        f"{old_content} → {new_content}" if old_content and new_content 
                        else new_content or old_content,
                        'replace'
                    ))
                stats['replace'] += max_len
                old_num += i2 - i1
                new_num += j2 - j1
        
        return DiffResult(
            old_version="",
            new_version="",
            lines=diff_lines,
            stats=stats
        )
    
    def format_terminal(self, diff_result: DiffResult) -> str:
        """终端格式化输出"""
        output = []
        output.append(f"--- {diff_result.old_version}")
        output.append(f"+++ {diff_result.new_version}")
        output.append("")
        
        for line in diff_result.lines:
            if line.type == 'equal':
                output.append(f"  {line.content}")
            elif line.type == 'insert':
                output.append(f"\033[32m+ {line.content}\033[0m")
            elif line.type == 'delete':
                output.append(f"\033[31m- {line.content}\033[0m")
            elif line.type == 'replace':
                output.append(f"\033[33m~ {line.content}\033[0m")
        
        output.append("")
        output.append(f"统计: {diff_result.stats['equal']} 未变, "
                     f"{diff_result.stats['insert']} 新增, "
                     f"{diff_result.stats['delete']} 删除, "
                     f"{diff_result.stats['replace']} 修改")
        
        return "\n".join(output)
    
    def format_markdown(self, diff_result: DiffResult) -> str:
        """Markdown 格式化输出"""
        output = []
        output.append(f"## Prompt Diff: {diff_result.old_version} → {diff_result.new_version}")
        output.append("")
        output.append("```diff")
        
        for line in diff_result.lines:
            if line.type == 'equal':
                output.append(f"  {line.content}")
            elif line.type == 'insert':
                output.append(f"+ {line.content}")
            elif line.type == 'delete':
                output.append(f"- {line.content}")
            elif line.type == 'replace':
                output.append(f"- {line.content.split(' → ')[0]}")
                if ' → ' in line.content:
                    output.append(f"+ {line.content.split(' → ')[1]}")
        
        output.append("```")
        output.append("")
        output.append(f"| 变更类型 | 数量 |")
        output.append(f"|---------|------|")
        output.append(f"| 未变 | {diff_result.stats['equal']} |")
        output.append(f"| 新增 | {diff_result.stats['insert']} |")
        output.append(f"| 删除 | {diff_result.stats['delete']} |")
        output.append(f"| 修改 | {diff_result.stats['replace']} |")
        
        return "\n".join(output)
```

---

## 6. Changelog 自动生成

### 6.1 Changelog 结构

```markdown
# Changelog

## [1.2.0] - 2024-03-20

### Added
- 添加了对多语言情感分析的支持
- 增加了 JSON 输出格式约束

### Changed
- 优化了中文情感识别的准确率 (85% → 92%)
- 更新了系统提示词的措辞

### Fixed
- 修复了混合情感文本分类不准确的问题

### Deprecated
- 旧版纯文本输出格式将在 2.0.0 移除

## [1.1.0] - 2024-02-10

### Added
- 添加了置信度输出
```

### 6.2 Changelog 生成器

```python
import json
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass

@dataclass
class ChangeEntry:
    """变更条目"""
    type: str  # Added, Changed, Fixed, Deprecated
    description: str
    author: str
    date: str
    related_version: str

class ChangelogGenerator:
    """Changelog 自动生成器"""
    
    def __init__(self, changelog_path: str):
        self.changelog_path = Path(changelog_path)
        self.entries: list[ChangeEntry] = []
    
    def add_entry(self, change_type: str, description: str,
                  author: str, version: str):
        """添加变更条目"""
        entry = ChangeEntry(
            type=change_type,
            description=description,
            author=author,
            date=datetime.now().strftime("%Y-%m-%d"),
            related_version=version
        )
        self.entries.append(entry)
    
    def detect_changes(self, old_prompt: str, new_prompt: str,
                       old_metadata: dict, new_metadata: dict) -> list[ChangeEntry]:
        """自动检测变更类型"""
        entries = []
        
        # 检测版本号变化
        old_ver = old_metadata.get("version", "0.0.0")
        new_ver = new_metadata.get("version", "0.0.0")
        
        if old_ver != new_ver:
            # 检测内容变化
            old_lines = set(old_prompt.splitlines())
            new_lines = set(new_prompt.splitlines())
            
            added = new_lines - old_lines
            removed = old_lines - new_lines
            
            if added:
                entries.append(ChangeEntry(
                    type="Added",
                    description=f"新增内容: {len(added)} 行",
                    author=new_metadata.get("author", "unknown"),
                    date=datetime.now().strftime("%Y-%m-%d"),
                    related_version=new_ver
                ))
            
            if removed:
                entries.append(ChangeEntry(
                    type="Changed",
                    description=f"修改/删除内容: {len(removed)} 行",
                    author=new_metadata.get("author", "unknown"),
                    date=datetime.now().strftime("%Y-%m-%d"),
                    related_version=new_ver
                ))
        
        return entries
    
    def generate(self) -> str:
        """生成 Changelog 文本"""
        # 按版本分组
        by_version: dict[str, list[ChangeEntry]] = {}
        for entry in self.entries:
            ver = entry.related_version
            if ver not in by_version:
                by_version[ver] = []
            by_version[ver].append(entry)
        
        # 按版本号降序排列
        sorted_versions = sorted(by_version.keys(), reverse=True)
        
        output = ["# Changelog", ""]
        
        for version in sorted_versions:
            entries = by_version[version]
            date = entries[0].date
            output.append(f"## [{version}] - {date}")
            output.append("")
            
            # 按类型分组
            by_type: dict[str, list[ChangeEntry]] = {}
            for entry in entries:
                if entry.type not in by_type:
                    by_type[entry.type] = []
                by_type[entry.type].append(entry)
            
            for change_type in ["Added", "Changed", "Fixed", "Deprecated"]:
                if change_type in by_type:
                    output.append(f"### {change_type}")
                    for entry in by_type[change_type]:
                        output.append(f"- {entry.description}")
                    output.append("")
        
        return "\n".join(output)
    
    def save(self):
        """保存 Changelog"""
        content = self.generate()
        
        # 如果已有 Changelog，追加到顶部
        if self.changelog_path.exists():
            existing = self.changelog_path.read_text(encoding="utf-8")
            # 移除旧的标题
            if existing.startswith("# Changelog"):
                existing = existing[len("# Changelog"):].lstrip()
            content = f"# Changelog\n\n{content}\n{existing}"
        
        self.changelog_path.write_text(content, encoding="utf-8")


# 使用示例
generator = ChangelogGenerator("./prompts/classifier/changelog.md")

generator.add_entry(
    "Added",
    "添加了对多语言情感分析的支持",
    "zhangwei@example.com",
    "1.2.0"
)

generator.add_entry(
    "Changed",
    "优化了中文情感识别的准确率",
    "zhangwei@example.com",
    "1.2.0"
)

generator.add_entry(
    "Fixed",
    "修复了混合情感文本分类不准确的问题",
    "lina@example.com",
    "1.2.0"
)

print(generator.generate())
```

---

## 7. 完整的 Prompt 版本管理器

```python
"""
Prompt 版本管理系统 - 完整实现
"""
import json
import yaml
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field, asdict

@dataclass
class PromptVersion:
    """Prompt 版本"""
    version: str
    content: str
    metadata: dict
    created_at: str
    author: str
    status: str = "draft"
    hash: str = ""
    
    def __post_init__(self):
        if not self.hash:
            self.hash = hashlib.sha256(self.content.encode()).hexdigest()[:12]

class PromptVersionManager:
    """Prompt 版本管理器"""
    
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.versions: dict[str, list[PromptVersion]] = {}
        self._load_versions()
    
    def _load_versions(self):
        """从磁盘加载版本历史"""
        for prompt_dir in self.base_dir.iterdir():
            if prompt_dir.is_dir():
                history_file = prompt_dir / "history.json"
                if history_file.exists():
                    with open(history_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self.versions[prompt_dir.name] = [
                        PromptVersion(**v) for v in data
                    ]
    
    def _save_versions(self, prompt_name: str):
        """保存版本历史到磁盘"""
        prompt_dir = self.base_dir / prompt_name
        prompt_dir.mkdir(parents=True, exist_ok=True)
        
        history_file = prompt_dir / "history.json"
        versions = self.versions.get(prompt_name, [])
        
        with open(history_file, "w", encoding="utf-8") as f:
            json.dump(
                [asdict(v) for v in versions],
                f, ensure_ascii=False, indent=2
            )
    
    def create(self, prompt_name: str, content: str,
               author: str, metadata: Optional[dict] = None) -> PromptVersion:
        """创建新 Prompt 的第一个版本"""
        version = PromptVersion(
            version="1.0.0",
            content=content,
            metadata=metadata or {},
            created_at=datetime.now().isoformat(),
            author=author,
            status="draft"
        )
        
        self.versions[prompt_name] = [version]
        self._save_versions(prompt_name)
        
        # 同时保存当前版本的 Prompt 文件
        self._save_current(prompt_name, content)
        
        return version
    
    def update(self, prompt_name: str, content: str,
               author: str, version_type: str = "patch",
               change_description: str = "",
               metadata: Optional[dict] = None) -> PromptVersion:
        """更新 Prompt（创建新版本）"""
        if prompt_name not in self.versions:
            raise ValueError(f"Prompt '{prompt_name}' 不存在")
        
        versions = self.versions[prompt_name]
        latest = versions[-1]
        
        # 计算新版本号
        old_ver = SemanticVersion.parse(latest.version)
        if version_type == "major":
            new_ver = old_ver.bump_major()
        elif version_type == "minor":
            new_ver = old_ver.bump_minor()
        else:
            new_ver = old_ver.bump_patch()
        
        # 合并元数据
        new_metadata = {**latest.metadata, **(metadata or {})}
        if change_description:
            new_metadata["last_change"] = change_description
        
        version = PromptVersion(
            version=str(new_ver),
            content=content,
            metadata=new_metadata,
            created_at=datetime.now().isoformat(),
            author=author,
            status="draft"
        )
        
        versions.append(version)
        self._save_versions(prompt_name)
        self._save_current(prompt_name, content)
        
        return version
    
    def get_latest(self, prompt_name: str) -> Optional[PromptVersion]:
        """获取最新版本"""
        versions = self.versions.get(prompt_name, [])
        return versions[-1] if versions else None
    
    def get_version(self, prompt_name: str, 
                    version: str) -> Optional[PromptVersion]:
        """获取指定版本"""
        for v in self.versions.get(prompt_name, []):
            if v.version == version:
                return v
        return None
    
    def diff(self, prompt_name: str, 
             version_a: str, version_b: str) -> dict:
        """比较两个版本的差异"""
        va = self.get_version(prompt_name, version_a)
        vb = self.get_version(prompt_name, version_b)
        
        if not va or not vb:
            raise ValueError("版本不存在")
        
        differ = PromptDiffer()
        result = differ.diff(va.content, vb.content)
        result.old_version = version_a
        result.new_version = version_b
        
        return {
            "diff": result,
            "markdown": differ.format_markdown(result)
        }
    
    def changelog(self, prompt_name: str) -> str:
        """生成 Changelog"""
        versions = self.versions.get(prompt_name, [])
        if not versions:
            return "无版本历史"
        
        generator = ChangelogGenerator("")
        for i in range(1, len(versions)):
            old = versions[i - 1]
            new = versions[i]
            
            # 简单的内容差异描述
            old_lines = set(old.content.splitlines())
            new_lines = set(new.content.splitlines())
            added = len(new_lines - old_lines)
            removed = len(old_lines - new_lines)
            
            if added > 0:
                generator.add_entry(
                    "Added",
                    f"新增 {added} 行内容",
                    new.author,
                    new.version
                )
            if removed > 0:
                generator.add_entry(
                    "Changed",
                    f"修改/删除 {removed} 行内容",
                    new.author,
                    new.version
                )
        
        return generator.generate()
    
    def list_versions(self, prompt_name: str) -> list[dict]:
        """列出所有版本"""
        versions = self.versions.get(prompt_name, [])
        return [
            {
                "version": v.version,
                "author": v.author,
                "created_at": v.created_at,
                "status": v.status,
                "hash": v.hash
            }
            for v in versions
        ]
    
    def _save_current(self, prompt_name: str, content: str):
        """保存当前版本的 Prompt 文件"""
        prompt_dir = self.base_dir / prompt_name
        prompt_dir.mkdir(parents=True, exist_ok=True)
        
        prompt_file = prompt_dir / "prompt.md"
        prompt_file.write_text(content, encoding="utf-8")


# ============================================================
# 使用示例
# ============================================================

if __name__ == "__main__":
    manager = PromptVersionManager("./prompts")
    
    # 创建新 Prompt
    v1 = manager.create(
        "sentiment-classifier",
        content="""你是一个情感分析专家。
请判断以下文本的情感倾向：正面、负面或中性。

文本：{text}

输出格式：
{{
    "sentiment": "positive/negative/neutral",
    "confidence": 0.0-1.0
}}""",
        author="zhangwei@example.com",
        metadata={"model": "gpt-4o-mini", "task": "classification"}
    )
    print(f"创建版本: {v1.version}")
    
    # 更新 Prompt
    v2 = manager.update(
        "sentiment-classifier",
        content="""你是一个专业的情感分析专家。
请根据以下文本判断其情感倾向。

规则：
1. 只输出 JSON 格式
2. confidence 表示判断的确信程度
3. 混合情感选择主导情感

文本：{text}

输出格式：
{{
    "sentiment": "positive/negative/neutral",
    "confidence": 0.0-1.0,
    "reason": "判断理由"
}}""",
        author="zhangwei@example.com",
        version_type="minor",
        change_description="添加了判断理由字段，优化了系统提示"
    )
    print(f"更新版本: {v2.version}")
    
    # 查看版本历史
    print("\n版本历史:")
    for v in manager.list_versions("sentiment-classifier"):
        print(f"  {v['version']} ({v['status']}) by {v['author']}")
    
    # 生成 Changelog
    print("\nChangelog:")
    print(manager.changelog("sentiment-classifier"))
```

---

## 8. 常见误区

### ❌ 错误1：Prompt 和代码混在一起管理

```python
# 错误：Prompt 嵌入在 Python 代码中
def classify(text):
    prompt = "请判断以下文本的情感..."  # 修改需要改代码
    return call_llm(prompt, text)

# 正确：Prompt 独立管理
def classify(text):
    prompt = load_prompt("sentiment-classifier", version="1.2.0")
    return call_llm(prompt.format(text=text), text)
```

### ❌ 错误2：不记录变更原因

```yaml
# 错误：只记录版本号
history:
  - version: 1.1.0
  - version: 1.2.0

# 正确：记录变更原因和影响
history:
  - version: 1.1.0
    change: "添加 JSON 输出约束"
    reason: "下游系统需要结构化输入"
    impact: "输出格式变化"
```

### ❌ 错误3：大版本号跳跃

```python
# 错误：小改动也升级大版本号
v1.0.0 → v2.0.0  # 只是改了错别字

# 正确：遵循语义化版本
v1.0.0 → v1.0.1  # 改了错别字（PATCH）
```

### ❌ 错误4：不保存 Prompt 的运行环境信息

```yaml
# 错误：只保存 Prompt 文本
content: "..."

# 正确：保存完整的运行上下文
content: "..."
model: gpt-4o-mini
temperature: 0.0
max_tokens: 500
context_window: 128000
```

### ❌ 锌误5：版本回滚没有记录

```python
# 错误：直接覆盖回旧版本
save_prompt("classifier", old_content)

# 正确：创建一个恢复版本
manager.update(
    "classifier",
    old_content,
    author="system",
    version_type="patch",
    change_description="回滚到 v1.1.0，原因：v1.2.0 引入了回归问题"
)
```

---

---

## 9. 工程建议

1. **Prompt 和代码必须分离存储**：将 Prompt 独立存放在 `prompts/` 目录下，通过版本管理器加载，而不是嵌入在 Python 代码中——这样修改 Prompt 不需要重新部署代码。
2. **每次修改必须记录变更原因**：版本号、作者、时间是最基本的元数据，更重要的是记录"为什么改"和"影响范围"，这在排查线上问题时能节省大量时间。
3. **回滚时创建新版本而不是覆盖**：即使回滚到旧版本，也要创建一个带说明的新版本记录（如 v1.2.1 标注"回滚到 v1.1.0"），保持版本历史的完整性。
4. **元数据文件纳入 Git Hook 校验**：在 pre-commit 阶段自动检查 metadata.yaml 的必需字段和版本号格式，防止不规范的元数据进入仓库。

---

## 10. 总结

1. **版本管理**让 Prompt 从"一次性文本"变成"可维护的资产"
2. **语义化版本号**清晰传达变更的性质和影响
3. **Git 集成**利用现有工具链管理 Prompt 变更
4. **Diff 可视化**让 Prompt 的变更一目了然
5. **Changelog 自动生成**减少手动维护成本
6. **完整生命周期管理**从草稿到废弃的全流程覆盖

---

## 练习

### 练习1：版本号设计（⭐）

为以下变更场景设计正确的版本号变更：
1. 修正了 Prompt 中的一个错别字
2. 添加了输出格式的 JSON 约束
3. 完全重写了 Prompt 的任务定义
4. 从支持中文改为支持多语言

### 练习2：Diff 分析（⭐⭐）

使用本课的 `PromptDiffer` 类，比较你项目中两个 Prompt 版本的差异：
- 识别新增、删除、修改的内容
- 分析变更的语义影响
- 生成 Markdown 格式的 diff 报告

### 练习3：版本管理系统（⭐⭐⭐）

为你自己的 Prompt 项目实现版本管理系统，要求：
- 支持创建、更新、回滚操作
- 自动生成元数据文件
- 集成 Git 提交信息
- 生成 Changelog

---

> **下一课**：[05-回归测试与CI集成](./05-回归测试与CI集成.md) - 学习如何将 Prompt 测试集成到 CI/CD 流程中
