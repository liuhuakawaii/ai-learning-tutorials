# 01 动态 Tool 注册——运行时根据上下文动态暴露 Tool

> 有时候你需要根据用户权限或上下文动态决定暴露哪些 Tool。

## 场景引入

你的 MCP Server 有 20 个 Tool，但普通用户只能用 5 个查询类 Tool，管理员才能用修改和删除类 Tool。目前的做法是把所有 Tool 都暴露给 AI，然后在执行时检查权限——但这会导致 AI 推荐用户无权使用的 Tool，用户体验很差。你希望能根据用户角色动态决定 tools/list 返回哪些 Tool，让 AI 只看到用户真正能用的工具。

---

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

## 常见误区

```
误区 1：动态注册就是运行时添加 Tool
  动态注册的核心是"根据上下文决定暴露哪些 Tool"，不只是"运行时能添加 Tool"。
  要考虑权限、场景、用户角色等多个维度。

误区 2：隐藏 Tool 就不需要执行时校验
  隐藏只是第一层防护，执行时仍然要校验权限。
  用户可能通过直接构造 JSON-RPC 请求绕过 tools/list 的过滤。

误区 3：上下文过滤会让 tools/list 变慢
  如果过滤逻辑是纯内存操作（查表、比较），性能影响可以忽略。
  真正的性能瓶颈是 Tool 的执行，不是列表过滤。

误区 4：所有 Server 都需要动态 Tool 注册
  如果你的 Tool 列表是固定的、不涉及权限控制，静态注册就够了。
  动态注册增加了复杂度，只在真正需要时才引入。
```

---

## 工程建议

```
1. 权限信息从 Host 层传入
  不要在 Server 内部做用户认证。Host 负责认证，把用户角色通过参数传给 Server。
  Server 只负责根据角色过滤 Tool。

2. 用 tool/listChanged 通知 Client 更新
  用户角色变化时（如登录、切换权限），Server 发送 listChanged 通知。
  Client 重新调用 tools/list 获取最新的工具列表。

3. 过滤逻辑要可测试
  把过滤规则抽成独立的函数，写单元测试。
  覆盖：管理员看到所有 Tool、普通用户只看到查询 Tool、未登录用户看到最少 Tool。

4. 日志记录 Tool 可见性变化
  记录每次 tools/list 的过滤结果，用于安全审计。
  如果一个用户频繁请求他无权使用的 Tool，可能是攻击行为。
```

---

## 小结

1. 动态 Tool 注册支持权限控制和上下文适配
2. 根据用户角色决定 Tool 可见性
3. 根据任务上下文暴露相关 Tool
4. 支持运行时配置更新

---

**下一课**: [02 流式响应——长时间运行 Tool 的进度通知与流式输出](./02-流式响应.md)
```

---

## 练习

1. **动态题**：实现一个动态 Tool 注册表。

2. **权限题**：实现基于权限的 Tool 访问控制。

3. **上下文题**：实现上下文感知的 Tool 暴露。
