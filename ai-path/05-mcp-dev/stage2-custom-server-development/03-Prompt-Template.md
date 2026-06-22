# 03 Prompt Template——在 Server 端管理可复用的 Prompt 模板

> MCP Prompt Template 让你可以在 Server 端管理 Prompt，实现集中化管理。

## 场景引入

团队里有 5 个开发者，每个人都在自己的代码里硬编码了"代码审查"的 Prompt。某天产品经理说要给审查增加"安全检查"维度，你发现要改 5 个地方。更麻烦的是，每个人的 Prompt 格式不统一，AI 的审查质量参差不齐。你希望能把 Prompt 集中管理在 Server 端，统一更新、统一版本、统一格式——这就是 MCP Prompt Template 要解决的问题。

---

## 学习目标

- 掌握 MCP Prompt Template 的设计和实现
- 理解 Prompt 的管理和复用机制
- 学会实现可配置的 Prompt 模板

---

## 一、Prompt Template 概念

```
Prompt Template 的价值：

1. 集中管理
   - Prompt 存储在 Server 端
   - 统一更新和维护
   - 版本控制

2. 复用
   - 多个 Client 共享 Prompt
   - 减少重复定义
   - 保证一致性

3. 动态配置
   - 根据上下文动态生成
   - 支持参数化
   - 适应不同场景
```

---

## 二、Prompt Template 实现

```python
from mcp.server import Server
from mcp.types import Prompt, PromptMessage, TextContent

server = Server("my-server")

@server.prompt()
async def code_review(code: str, language: str = "python") -> list[PromptMessage]:
    """代码审查 Prompt"""
    return [
        PromptMessage(
            role="user",
            content=TextContent(
                type="text",
                text=f"""请审查以下 {language} 代码：

```{language}
{code}
```

请从以下方面进行审查：
1. 代码质量
2. 性能问题
3. 安全风险
4. 改进建议"""
            )
        )
    ]

@server.prompt()
async def data_analysis(data: str, question: str) -> list[PromptMessage]:
    """数据分析 Prompt"""
    return [
        PromptMessage(
            role="user",
            content=TextContent(
                type="text",
                text=f"""请分析以下数据：

{data}

回答问题：{question}

请提供：
1. 数据概览
2. 关键发现
3. 结论和建议"""
            )
        )
    ]
```

---

## 三、Prompt 管理

```python
class PromptManager:
    """Prompt 管理器"""
    
    def __init__(self):
        self.prompts = {}
    
    def register(self, name: str, template: str, parameters: list):
        """注册 Prompt"""
        self.prompts[name] = {
            "template": template,
            "parameters": parameters
        }
    
    def render(self, name: str, **kwargs) -> str:
        """渲染 Prompt"""
        prompt = self.prompts[name]
        return prompt["template"].format(**kwargs)
    
    def list_prompts(self) -> list:
        """列出所有 Prompt"""
        return list(self.prompts.keys())
```

---

## 四、版本控制

```python
class PromptVersionManager:
    """Prompt 版本管理"""
    
    def __init__(self):
        self.versions = {}
    
    def save_version(self, name: str, template: str, version: str):
        """保存版本"""
        if name not in self.versions:
            self.versions[name] = {}
        self.versions[name][version] = {
            "template": template,
            "created_at": datetime.now().isoformat()
        }
    
    def get_version(self, name: str, version: str) -> str:
        """获取指定版本"""
        return self.versions[name][version]["template"]
    
    def get_latest(self, name: str) -> str:
        """获取最新版本"""
        versions = self.versions[name]
        latest = max(versions.keys())
        return versions[latest]["template"]
```

## 常见误区

```
误区 1：Prompt Template 就是字符串模板
  MCP Prompt Template 不只是字符串替换，它是一个完整的 Prompt 管理系统。
  包括版本控制、参数校验、动态生成等能力。

误区 2：所有 Prompt 都应该放 Server 端
  只有需要跨 Client 复用、需要统一管理的 Prompt 才放 Server 端。
  一次性、场景特定的 Prompt 直接在 Client 端构造更简单。

误区 3：Prompt Template 不需要版本控制
  Prompt 是会演进的。今天的代码审查 Prompt 和三个月后的可能完全不同。
  没有版本控制，你无法回滚到之前效果更好的版本。

误区 4：参数化就是简单的字符串替换
  参数化要考虑输入校验、默认值、可选参数。
  用户传入恶意内容时，Prompt Template 要能安全处理。
```

---

## 工程建议

```
1. Prompt Template 命名要有业务语义
  code_review、data_analysis、bug_diagnosis——
  名字要让 AI 一看就知道这个 Prompt 是干什么的。

2. 用 description 说明 Prompt 的用途和参数
  和 Tool 一样，Prompt 的 description 是 AI 选择使用它的依据。
  说明每个参数的含义、类型、默认值。

3. 版本号用语义化版本
  major.minor.patch 格式，breaking change 升 major。
  Client 可以指定版本范围，Server 返回兼容的最新版本。

4. 测试 Prompt 的渲染结果
  用不同的参数组合测试 Prompt Template，确保渲染结果符合预期。
  特别关注：参数为空、参数超长、特殊字符。
```

---

## 小结

1. Prompt Template 在 Server 端管理 Prompt
2. 支持参数化和动态配置
3. 集中管理、复用、版本控制
4. 用 @server.prompt() 装饰器注册

---

**下一课**: [04 多原语组合——一个 Server 同时提供 Tool + Resource + Prompt](./04-多原语组合.md)
```

---

## 练习

1. **实现题**：实现一个代码审查 Prompt Template。

2. **管理题**：实现一个 Prompt 管理器。

3. **版本题**：实现 Prompt 版本控制。

---

## 参考答案

### 练习一：实现代码审查 Prompt Template

**思路**：设计一个参数化的代码审查模板，支持指定语言、审查维度、严格程度等参数，让 AI 能根据不同场景生成不同的审查 Prompt。

**答案**：

```python
from mcp.server import Server
from mcp.types import Prompt, PromptMessage, TextContent

server = Server("code-review-server")


@server.prompt()
async def code_review(
    code: str,
    language: str = "python",
    focus: str = "all",
    strictness: str = "normal"
) -> list[PromptMessage]:
    """代码审查 Prompt Template。

    Args:
        code: 需要审查的代码
        language: 编程语言（python, typescript, java, go）
        focus: 审查维度（all, security, performance, style, bugs）
        strictness: 严格程度（normal, strict）
    """
    # 审查维度配置
    focus_configs = {
        "all": ["代码质量", "性能问题", "安全风险", "可维护性", "改进建议"],
        "security": ["安全漏洞", "权限控制", "输入验证", "敏感信息泄露"],
        "performance": ["时间复杂度", "空间复杂度", "数据库查询优化", "缓存策略"],
        "style": ["命名规范", "代码结构", "注释质量", "错误处理"],
        "bugs": ["逻辑错误", "边界条件", "空值处理", "并发安全"],
    }

    # 严格程度配置
    strictness_configs = {
        "normal": "请指出明显的问题和改进建议。",
        "strict": "请严格审查每一行代码，包括潜在的边界问题、极端情况和最佳实践偏差。对于每个问题，请说明严重程度（高/中/低）。",
    }

    review_aspects = focus_configs.get(focus, focus_configs["all"])
    review_instruction = strictness_configs.get(strictness, strictness_configs["normal"])

    aspects_text = "\n".join(f"{i+1}. {aspect}" for i, aspect in enumerate(review_aspects))

    return [
        PromptMessage(
            role="user",
            content=TextContent(
                type="text",
                text=f"""请审查以下 {language} 代码：

```{language}
{code}
```

请从以下方面进行审查：
{aspects_text}

{review_instruction}

输出格式：
- 每个问题用 "【严重程度】问题描述" 的格式
- 最后给出总结和优先修复建议"""
            )
        )
    ]
```

**要点**：
- 参数要有合理的默认值，用户不传参也能用
- description 要说明每个参数的含义和可选值
- Prompt 的输出格式要明确，让 AI 生成结构化的审查结果
- 常见错误：Prompt 没有指定输出格式，AI 的回复格式不一致

### 练习二：实现 Prompt 管理器

**思路**：实现一个通用的 Prompt 管理器，支持注册、渲染、列表查询，用模板变量实现参数化。

**答案**：

```python
import re
from typing import Any


class PromptManager:
    """Prompt 管理器"""

    def __init__(self):
        self._prompts: dict[str, dict] = {}

    def register(
        self,
        name: str,
        template: str,
        description: str = "",
        parameters: list[dict] = None,
        required_parameters: list[str] = None,
    ):
        """注册 Prompt Template

        Args:
            name: Prompt 名称（唯一标识）
            template: 模板内容，用 {param_name} 表示参数
            description: Prompt 描述
            parameters: 参数定义列表 [{"name": "x", "type": "string", "description": "..."}]
            required_parameters: 必填参数列表
        """
        # 从模板中自动提取参数名
        auto_params = set(re.findall(r'\{(\w+)\}', template))

        self._prompts[name] = {
            "template": template,
            "description": description,
            "parameters": parameters or [],
            "required_parameters": required_parameters or [],
            "auto_detected_params": auto_params,
        }

    def render(self, name: str, **kwargs) -> str:
        """渲染 Prompt Template

        Args:
            name: Prompt 名称
            **kwargs: 参数值

        Returns:
            渲染后的 Prompt 文本

        Raises:
            KeyError: Prompt 不存在
            ValueError: 缺少必填参数
        """
        if name not in self._prompts:
            raise KeyError(f"Prompt '{name}' 不存在。可用 Prompt：{list(self._prompts.keys())}")

        prompt = self._prompts[name]

        # 检查必填参数
        missing = [p for p in prompt["required_parameters"] if p not in kwargs]
        if missing:
            raise ValueError(f"缺少必填参数：{', '.join(missing)}")

        # 填充默认值（未传的可选参数用空字符串替换）
        template = prompt["template"]
        all_params = prompt["auto_detected_params"]
        for param in all_params:
            if param not in kwargs:
                kwargs[param] = ""

        try:
            return template.format(**kwargs)
        except KeyError as e:
            raise ValueError(f"模板渲染失败：未知参数 {e}")

    def list_prompts(self) -> list[dict]:
        """列出所有已注册的 Prompt"""
        return [
            {
                "name": name,
                "description": prompt["description"],
                "parameters": prompt["parameters"],
                "required_parameters": prompt["required_parameters"],
            }
            for name, prompt in self._prompts.items()
        ]

    def get_prompt(self, name: str) -> dict | None:
        """获取 Prompt 详情"""
        return self._prompts.get(name)


# 使用示例
manager = PromptManager()

manager.register(
    name="code_review",
    template="请审查以下 {language} 代码：\n\n```{language}\n{code}\n```\n\n审查重点：{focus}",
    description="代码审查助手",
    parameters=[
        {"name": "language", "type": "string", "description": "编程语言"},
        {"name": "code", "type": "string", "description": "待审查代码"},
        {"name": "focus", "type": "string", "description": "审查重点"},
    ],
    required_parameters=["code"]
)

manager.register(
    name="sql_generator",
    template="根据以下需求生成 SQL：\n\n表结构：{schema}\n\n需求：{requirement}\n\n数据库：{database}",
    description="SQL 生成助手",
    required_parameters=["schema", "requirement"]
)

# 渲染
result = manager.render(
    "code_review",
    language="python",
    code="def add(a, b): return a + b",
    focus="类型安全"
)
print(result)

# 列出所有 Prompt
for p in manager.list_prompts():
    print(f"- {p['name']}: {p['description']}")
```

**要点**：
- 用 re.findall 自动从模板中提取参数名，避免手动维护参数列表
- 渲染前检查必填参数，返回明确的错误信息
- 模板用 {param} 格式，和 Python 的 str.format() 兼容
- 常见错误：不检查必填参数就渲染，导致模板中出现空占位符

### 练习三：实现 Prompt 版本控制

**思路**：用语义化版本号管理 Prompt 的不同版本，支持保存版本、获取指定版本、获取最新版本、版本回滚。

**答案**：

```python
from datetime import datetime
from typing import Optional
from packaging import version as pkg_version


class PromptVersionManager:
    """Prompt 版本管理器"""

    def __init__(self):
        # {name: {version_str: {template, created_at, changelog}}}
        self._versions: dict[str, dict[str, dict]] = {}
        self._current_version: dict[str, str] = {}  # name → 当前使用的版本

    def save_version(
        self,
        name: str,
        template: str,
        version: str,
        changelog: str = "",
    ):
        """保存一个新版本

        Args:
            name: Prompt 名称
            version: 版本号（语义化版本：major.minor.patch）
            template: 模板内容
            changelog: 变更说明
        """
        if name not in self._versions:
            self._versions[name] = {}

        self._versions[name][version] = {
            "template": template,
            "created_at": datetime.now().isoformat(),
            "changelog": changelog,
        }

        # 自动更新当前版本为最新
        self._current_version[name] = self._get_latest_version(name)

    def get_version(self, name: str, version: str) -> Optional[str]:
        """获取指定版本的模板"""
        if name not in self._versions:
            return None
        entry = self._versions[name].get(version)
        return entry["template"] if entry else None

    def get_latest(self, name: str) -> Optional[str]:
        """获取最新版本的模板"""
        latest = self._get_latest_version(name)
        if latest:
            return self.get_version(name, latest)
        return None

    def get_current(self, name: str) -> Optional[str]:
        """获取当前使用的版本"""
        current = self._current_version.get(name)
        if current:
            return self.get_version(name, current)
        return self.get_latest(name)

    def set_current(self, name: str, version: str) -> bool:
        """设置当前使用的版本（回滚）"""
        if name in self._versions and version in self._versions[name]:
            self._current_version[name] = version
            return True
        return False

    def list_versions(self, name: str) -> list[dict]:
        """列出所有版本（按版本号排序）"""
        if name not in self._versions:
            return []
        versions = []
        for ver, entry in sorted(
            self._versions[name].items(),
            key=lambda x: pkg_version.parse(x[0]),
            reverse=True
        ):
            versions.append({
                "version": ver,
                "created_at": entry["created_at"],
                "changelog": entry["changelog"],
                "is_current": ver == self._current_version.get(name),
            })
        return versions

    def rollback(self, name: str, target_version: str) -> bool:
        """回滚到指定版本"""
        return self.set_current(name, target_version)

    def _get_latest_version(self, name: str) -> Optional[str]:
        """获取最新版本号"""
        if name not in self._versions or not self._versions[name]:
            return None
        return max(self._versions[name].keys(), key=lambda v: pkg_version.parse(v))


# 使用示例
vm = PromptVersionManager()

# 保存 v1.0.0
vm.save_version(
    "code_review",
    template="请审查以下代码：\n{code}\n\n审查重点：代码质量",
    version="1.0.0",
    changelog="初始版本"
)

# 保存 v1.1.0（新增语言参数）
vm.save_version(
    "code_review",
    template="请审查以下 {language} 代码：\n{code}\n\n审查重点：代码质量、安全性",
    version="1.1.0",
    changelog="新增 language 参数，增加安全性审查"
)

# 保存 v2.0.0（重大重构）
vm.save_version(
    "code_review",
    template="请审查以下 {language} 代码：\n{code}\n\n审查维度：{focus}\n严格程度：{strictness}",
    version="2.0.0",
    changelog="重构模板，支持多维度和严格程度配置"
)

# 获取最新版本
print("最新版本：")
print(vm.get_latest("code_review"))

# 列出所有版本
print("\n版本历史：")
for v in vm.list_versions("code_review"):
    marker = " ← 当前" if v["is_current"] else ""
    print(f"  v{v['version']} ({v['created_at']}){marker}")
    print(f"    {v['changelog']}")

# 回滚到 v1.1.0
vm.rollback("code_review", "1.1.0")
print("\n回滚后当前版本：")
print(vm.get_current("code_review"))
```

**要点**：
- 版本号用语义化版本（major.minor.patch），breaking change 升 major
- 每个版本要记录 changelog，方便追溯变更原因
- rollback 本质是 set_current，不删除历史版本
- 常见错误：用时间戳当版本号，无法表达版本间的兼容关系
