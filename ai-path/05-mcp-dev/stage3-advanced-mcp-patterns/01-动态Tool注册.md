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

---

## 参考答案

### 练习一：动态 Tool 注册表

**思路**：动态注册表的核心是维护 Tool 与可见性规则的映射，`tools/list` 请求时根据用户角色过滤返回结果。关键是把"注册"和"过滤"分离，注册时绑定规则，查询时按规则筛选。

**答案**：
```python
import json
from mcp.server import Server
from mcp.types import Tool, TextContent

class DynamicToolRegistry:
    def __init__(self):
        self.tools: dict[str, Tool] = {}
        self.visibility_rules: dict[str, str] = {}

    def register(self, tool: Tool, visibility: str = "public"):
        self.tools[tool.name] = tool
        self.visibility_rules[tool.name] = visibility

    def unregister(self, name: str):
        self.tools.pop(name, None)
        self.visibility_rules.pop(name, None)

    def get_visible_tools(self, user_role: str) -> list[Tool]:
        visible = []
        for name, tool in self.tools.items():
            rule = self.visibility_rules[name]
            if rule == "public" or rule == user_role:
                visible.append(tool)
        return visible

    def update_visibility(self, name: str, visibility: str):
        if name in self.tools:
            self.visibility_rules[name] = visibility

registry = DynamicToolRegistry()

registry.register(
    Tool(name="query_users", description="查询用户列表", inputSchema={"type": "object", "properties": {}}),
    visibility="public"
)
registry.register(
    Tool(name="delete_user", description="删除用户", inputSchema={"type": "object", "properties": {"user_id": {"type": "string"}}}),
    visibility="admin"
)

server = Server("dynamic-server")

@server.list_tools()
async def handle_list_tools():
    user_role = get_current_user_role()
    visible = registry.get_visible_tools(user_role)
    return visible

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict):
    user_role = get_current_user_role()
    visible_names = {t.name for t in registry.get_visible_tools(user_role)}
    if name not in visible_names:
        raise ValueError(f"无权访问工具：{name}")
    return [TextContent(type="text", text=f"执行 {name}")]

def get_current_user_role() -> str:
    return "admin"
```

**要点**：
- 注册和过滤必须分离，不能在注册时就决定可见性，因为可见性取决于请求时的用户上下文
- `tools/list` 过滤只是第一层防护，`call_tool` 时仍需二次校验权限，防止用户绕过 list 直接构造请求
- 常见错误：只在 `list_tools` 过滤而不校验 `call_tool`，导致权限形同虚设

### 练习二：基于权限的 Tool 访问控制

**思路**：权限控制需要三个要素：用户权限集合、Tool 所需权限、校验逻辑。用字符串表示权限粒度（如 `read`、`write`、`admin`），注册 Tool 时绑定所需权限，调用时检查用户是否拥有该权限。

**答案**：
```python
from mcp.server import Server
from mcp.types import Tool, TextContent

class PermissionBasedRegistry:
    def __init__(self):
        self.tools: dict[str, callable] = {}
        self.tool_schemas: dict[str, Tool] = {}
        self.required_permissions: dict[str, str] = {}

    def register(self, name: str, tool_func, schema: Tool, required_permission: str):
        self.tools[name] = tool_func
        self.tool_schemas[name] = schema
        self.required_permissions[name] = required_permission

    def check_access(self, name: str, user_permissions: list[str]) -> bool:
        required = self.required_permissions.get(name)
        if required is None:
            return False
        return required in user_permissions

    def get_accessible_tools(self, user_permissions: list[str]) -> list[Tool]:
        accessible = []
        for name, schema in self.tool_schemas.items():
            if self.check_access(name, user_permissions):
                accessible.append(schema)
        return accessible

registry = PermissionBasedRegistry()

async def query_data(sql: str) -> str:
    return f"查询结果：{sql}"

async def delete_record(table: str, id: str) -> str:
    return f"已删除 {table} 中 id={id} 的记录"

registry.register(
    "query_data", query_data,
    Tool(name="query_data", description="查询数据", inputSchema={"type": "object", "properties": {"sql": {"type": "string"}}}),
    required_permission="read"
)
registry.register(
    "delete_record", delete_record,
    Tool(name="delete_record", description="删除记录", inputSchema={"type": "object", "properties": {"table": {"type": "string"}, "id": {"type": "string"}}}),
    required_permission="admin"
)

server = Server("permission-server")

@server.list_tools()
async def handle_list_tools():
    user_perms = get_current_user_permissions()
    return registry.get_accessible_tools(user_perms)

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict):
    user_perms = get_current_user_permissions()
    if not registry.check_access(name, user_perms):
        raise PermissionError(f"缺少权限：{registry.required_permissions.get(name)}")
    result = await registry.tools[name](**arguments)
    return [TextContent(type="text", text=result)]

def get_current_user_permissions() -> list[str]:
    return ["read"]
```

**要点**：
- 权限校验必须在 `call_tool` 中独立执行，不能只依赖 `list_tools` 的过滤
- 权限字符串建议用分层命名（如 `db:read`、`db:write`），避免扁平命名冲突
- 常见错误：把权限校验放在 Tool 函数内部，导致每个 Tool 都要重复写校验逻辑；正确做法是在调用层统一拦截

### 练习三：上下文感知的 Tool 暴露

**思路**：上下文感知的核心是为每个 Tool 注册一个过滤函数，该函数接收当前上下文（如任务类型、环境信息）并返回布尔值。`tools/list` 时遍历所有 Tool，用过滤函数筛选出与当前上下文匹配的 Tool。

**答案**：
```python
from mcp.server import Server
from mcp.types import Tool, TextContent

class ContextAwareRegistry:
    def __init__(self):
        self.tools: dict[str, callable] = {}
        self.tool_schemas: dict[str, Tool] = {}
        self.context_filters: dict[str, callable] = {}

    def register(self, name: str, tool_func, schema: Tool, context_filter: callable):
        self.tools[name] = tool_func
        self.tool_schemas[name] = schema
        self.context_filters[name] = context_filter

    def get_context_tools(self, context: dict) -> list[Tool]:
        relevant = []
        for name, filter_func in self.context_filters.items():
            if filter_func(context):
                relevant.append(self.tool_schemas[name])
        return relevant

registry = ContextAwareRegistry()

async def query_database(sql: str) -> str:
    return f"查询结果：{sql}"

async def read_file(path: str) -> str:
    return f"文件内容：{path}"

async def send_notification(message: str) -> str:
    return f"已发送：{message}"

registry.register(
    "query_database", query_database,
    Tool(name="query_database", description="查询数据库", inputSchema={"type": "object", "properties": {"sql": {"type": "string"}}}),
    context_filter=lambda ctx: ctx.get("task_type") in ("data_analysis", "reporting")
)
registry.register(
    "read_file", read_file,
    Tool(name="read_file", description="读取文件", inputSchema={"type": "object", "properties": {"path": {"type": "string"}}}),
    context_filter=lambda ctx: ctx.get("task_type") in ("file_processing", "data_analysis")
)
registry.register(
    "send_notification", send_notification,
    Tool(name="send_notification", description="发送通知", inputSchema={"type": "object", "properties": {"message": {"type": "string"}}}),
    context_filter=lambda ctx: ctx.get("has_notification_permission", False)
)

server = Server("context-server")

@server.list_tools()
async def handle_list_tools():
    context = get_current_context()
    return registry.get_context_tools(context)

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict):
    context = get_current_context()
    available_names = {t.name for t in registry.get_context_tools(context)}
    if name not in available_names:
        raise ValueError(f"当前上下文不可用工具：{name}")
    result = await registry.tools[name](**arguments)
    return [TextContent(type="text", text=result)]

def get_current_context() -> dict:
    return {"task_type": "data_analysis", "has_notification_permission": True}
```

**要点**：
- 过滤函数必须是纯函数，只依赖传入的 context 参数，不能访问外部状态，否则测试困难且行为不可预测
- 上下文信息应由 Host 层传入，不要在 Server 内部维护全局上下文状态
- 常见错误：把上下文过滤逻辑写成 if-elif 硬编码，新增上下文类型时需要修改核心代码；用过滤函数注册的方式更易扩展
