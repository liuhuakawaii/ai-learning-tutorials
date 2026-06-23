# 动态 Tool 注册——运行时根据上下文动态暴露 Tool

> 前置：第 2 阶段的 Server 开发基础
> 课型：项目推进课

## 当前卡点

你的 MCP Server 有 20 个 Tool，但普通用户只能用 5 个查询类 Tool，管理员才能用修改和删除类 Tool。

现在的做法是把所有 Tool 都暴露出去，然后在 `call_tool` 里检查权限。问题很明显：AI 看到了用户无权使用的 Tool，推荐给用户，用户点了之后被告知"没权限"。体验很差，而且浪费了 AI 的决策 token。

你想要的是：`tools/list` 返回的 Tool 列表本身就根据用户角色过滤过。AI 只看到用户能用的 Tool。

## 方案选择

### 方案 A：多个 Server 实例

为每种角色建一个 Server——普通用户连 `server-readonly`，管理员连 `server-full`。

**问题**：角色多了之后要维护很多 Server 实例，代码重复。新增一个 Tool 要改多个 Server。

### 方案 B：运行时动态过滤

一个 Server，`tools/list` 请求时根据用户角色过滤返回结果。

**好处**：一份代码，一个实例。新增 Tool 只改一处。

选择方案 B。

## 代码落地

### 核心：注册表 + 可见性规则

```python
from mcp.server import Server
from mcp.types import Tool, TextContent

class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, Tool] = {}
        self._handlers: dict[str, callable] = {}
        self._visibility: dict[str, str] = {}  # "public" / "admin" / "manager"

    def register(self, tool: Tool, handler: callable, visibility: str = "public"):
        self._tools[tool.name] = tool
        self._handlers[tool.name] = handler
        self._visibility[tool.name] = visibility

    def get_visible_tools(self, user_role: str) -> list[Tool]:
        return [
            tool for name, tool in self._tools.items()
            if self._visibility[name] == "public" or self._visibility[name] == user_role
        ]

    async def call(self, name: str, arguments: dict, user_role: str) -> list[TextContent]:
        if name not in self._handlers:
            raise ValueError(f"未知工具: {name}")
        if self._visibility[name] != "public" and self._visibility[name] != user_role:
            raise PermissionError(f"无权访问: {name}")
        return await self._handlers[name](arguments)
```

### 接入 MCP Server

```python
server = Server("dynamic-server")
registry = ToolRegistry()

# 注册 Tool
registry.register(
    Tool(name="query_users", description="查询用户列表", inputSchema={"type": "object", "properties": {}}),
    handler=lambda args: [TextContent(type="text", text="用户列表: Alice, Bob")],
    visibility="public"
)

registry.register(
    Tool(name="delete_user", description="删除用户", inputSchema={"type": "object", "properties": {"user_id": {"type": "string"}}}),
    handler=lambda args: [TextContent(type="text", text=f"已删除: {args.get('user_id')}")],
    visibility="admin"
)

# 覆盖 tools/list
@server.list_tools()
async def handle_list_tools():
    user_role = get_current_user_role()  # 从 Host 层获取
    return registry.get_visible_tools(user_role)

# 覆盖 call_tool
@server.call_tool()
async def handle_call_tool(name: str, arguments: dict):
    user_role = get_current_user_role()
    return await registry.call(name, arguments, user_role)

def get_current_user_role() -> str:
    # 实际项目中从 Host 层传入，这里简化为硬编码
    return "admin"
```

### 角色变化时通知 Client

```python
# 用户登录或角色变化时，通知 Client 刷新工具列表
await server.send_notification("notifications/tools/listChanged")
```

Client 收到这个通知后会重新调用 `tools/list`，拿到最新的工具列表。

## 验证

```bash
# 启动 Server
mcp dev server.py

# 在 Inspector 中：
# 1. 以 public 角色调用 tools/list → 只看到 query_users
# 2. 以 admin 角色调用 tools/list → 看到 query_users + delete_user
# 3. 以 public 角色调用 delete_user → 返回权限错误
```

## 下一步：扩展点

1. **权限分层**：把简单的字符串角色换成权限集合（`["read", "write", "admin"]`），支持更细粒度的控制
2. **上下文感知**：除了角色，还可以根据任务类型（数据分析、文件处理）过滤 Tool
3. **运行时配置**：权限规则从配置文件读取，修改配置后自动生效

## 练习

### 练习一：添加权限分层

把 visibility 从简单的字符串改成权限集合。一个 Tool 可以要求多个权限：

```python
# Tool 要求 ["db", "write"] 权限
registry.register(tool, handler, required_permissions={"db", "write"})

# 用户只有 ["db", "read"] 权限 → 无法调用
# 用户有 ["db", "write", "admin"] 权限 → 可以调用
```

实现 `get_visible_tools` 和 `call` 方法，支持权限集合匹配。

### 练习二：添加上下文过滤

除了权限，还支持根据任务上下文过滤 Tool。为每个 Tool 注册一个过滤函数：

```python
registry.register(
    tool,
    handler,
    context_filter=lambda ctx: ctx.get("task_type") == "data_analysis"
)
```

`tools/list` 时同时考虑权限和上下文，两者都满足才暴露。

### 练习三：测试动态行为

用 MCP Inspector 测试：
1. 初始状态（public 角色）看到哪些 Tool
2. 切换到 admin 角色后看到哪些 Tool
3. 切换回 public 角色后 Tool 列表是否恢复
4. 以 public 角色直接构造 `tools/call` 请求调用 admin Tool，验证是否被拒绝

---

## 参考答案

### 练习一

```python
class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, Tool] = {}
        self._handlers: dict[str, callable] = {}
        self._required_perms: dict[str, set[str]] = {}

    def register(self, tool: Tool, handler: callable, required_permissions: set[str] = None):
        self._tools[tool.name] = tool
        self._handlers[tool.name] = handler
        self._required_perms[tool.name] = required_permissions or set()

    def get_visible_tools(self, user_permissions: set[str]) -> list[Tool]:
        return [
            tool for name, tool in self._tools.items()
            if self._required_perms[name].issubset(user_permissions)
        ]

    async def call(self, name: str, arguments: dict, user_permissions: set[str]) -> list[TextContent]:
        if name not in self._handlers:
            raise ValueError(f"未知工具: {name}")
        if not self._required_perms[name].issubset(user_permissions):
            raise PermissionError(f"缺少权限: {self._required_perms[name] - user_permissions}")
        return await self._handlers[name](arguments)
```

### 练习二

```python
class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, Tool] = {}
        self._handlers: dict[str, callable] = {}
        self._required_perms: dict[str, set[str]] = {}
        self._context_filters: dict[str, callable] = {}

    def register(self, tool: Tool, handler: callable,
                 required_permissions: set[str] = None,
                 context_filter: callable = None):
        self._tools[tool.name] = tool
        self._handlers[tool.name] = handler
        self._required_perms[tool.name] = required_permissions or set()
        self._context_filters[tool.name] = context_filter

    def get_visible_tools(self, user_permissions: set[str], context: dict) -> list[Tool]:
        result = []
        for name, tool in self._tools.items():
            if not self._required_perms[name].issubset(user_permissions):
                continue
            filter_fn = self._context_filters.get(name)
            if filter_fn and not filter_fn(context):
                continue
            result.append(tool)
        return result
```

### 练习三

| 测试 | 预期 | 原因 |
|------|------|------|
| public 角色 tools/list | 只看到 query_users | delete_user visibility=admin |
| admin 角色 tools/list | 看到 query_users + delete_user | admin 可见所有 Tool |
| 切回 public | 只看到 query_users | 可见性随角色变化 |
| public 直接 call delete_user | 返回 PermissionError | call_tool 独立校验权限 |
