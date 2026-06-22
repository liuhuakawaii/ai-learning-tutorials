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
