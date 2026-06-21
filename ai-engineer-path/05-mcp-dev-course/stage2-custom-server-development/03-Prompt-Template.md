# 03 Prompt Template——在 Server 端管理可复用的 Prompt 模板

> MCP Prompt Template 让你可以在 Server 端管理 Prompt，实现集中化管理。

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

---

## 小结

```
本课核心要点：

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
