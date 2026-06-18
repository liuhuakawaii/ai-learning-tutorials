# 01 动态 Tool 注册——运行时根据上下文动态暴露 Tool

> 有时候你需要根据用户权限或上下文动态决定暴露哪些 Tool。

## 学习目标

- 掌握动态 Tool 注册的方法
- 理解权限和上下文驱动的 Tool 暴露
- 学会实现可配置的 Tool 管理

---

## 一、动态注册概念

```
动态 Tool 注册的价值：

1. 权限控制
   - 不同用户看到不同的 Tool
   - 敏感 Tool 只对授权用户可见

2. 上下文适配
   - 根据任务类型暴露相关 Tool
   - 减少无关 Tool 的干扰

3. 运行时配置
   - 不重启服务更新 Tool
   - 支持 A/B 测试
```

---

## 二、实现

```python
from mcp.server import Server
from mcp.types import Tool, TextContent

class DynamicToolRegistry:
    """动态 Tool 注册表"""
    
    def __init__(self):
        self.tools = {}
        self.visibility_rules = {}
    
    def register(self, tool: Tool, visibility: str = "public"):
        """注册 Tool"""
        self.tools[tool.name] = tool
        self.visibility_rules[tool.name] = visibility
    
    def get_visible_tools(self, user_role: str) -> list[Tool]:
        """获取用户可见的 Tool"""
        visible = []
        for name, tool in self.tools.items():
            rule = self.visibility_rules[name]
            if rule == "public" or rule == user_role:
                visible.append(tool)
        return visible

class DynamicMCPServer:
    """动态 MCP Server"""
    
    def __init__(self):
        self.server = Server("dynamic-server")
        self.registry = DynamicToolRegistry()
        self._setup_dynamic_tools()
    
    def _setup_dynamic_tools(self):
        """设置动态工具"""
        
        @self.server.tool()
        async def list_available_tools(user_role: str) -> list[TextContent]:
            """列出当前用户可用的工具"""
            tools = self.registry.get_visible_tools(user_role)
            return [TextContent(
                type="text",
                text=json.dumps([t.name for t in tools])
            )]
```

---

## 三、权限驱动

```python
class PermissionBasedRegistry:
    """基于权限的注册表"""
    
    def __init__(self):
        self.tools = {}
        self.permissions = {}
    
    def register(self, name: str, tool_func, required_permission: str):
        """注册需要权限的 Tool"""
        self.tools[name] = tool_func
        self.permissions[name] = required_permission
    
    def check_access(self, name: str, user_permissions: list) -> bool:
        """检查访问权限"""
        required = self.permissions.get(name)
        return required in user_permissions
```

---

## 四、上下文适配

```python
class ContextAwareRegistry:
    """上下文感知注册表"""
    
    def __init__(self):
        self.tools = {}
        self.context_rules = {}
    
    def register(self, name: str, tool_func, context_filter: callable):
        """注册上下文相关的 Tool"""
        self.tools[name] = tool_func
        self.context_rules[name] = context_filter
    
    def get_context_tools(self, context: dict) -> list:
        """获取上下文相关的 Tool"""
        relevant = []
        for name, filter_func in self.context_rules.items():
            if filter_func(context):
                relevant.append(name)
        return relevant
```

---

## 小结

```
本课核心要点：

1. 动态 Tool 注册支持权限控制和上下文适配
2. 根据用户角色决定 Tool 可见性
3. 根据任务上下文暴露相关 Tool
4. 支持运行时配置更新

下一课：流式响应——长时间运行 Tool 的进度通知与流式输出。
```

---

## 练习

1. **动态题**：实现一个动态 Tool 注册表。

2. **权限题**：实现基于权限的 Tool 访问控制。

3. **上下文题**：实现上下文感知的 Tool 暴露。
