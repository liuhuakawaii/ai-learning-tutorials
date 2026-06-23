# 阶段实战——构建一个多 MCP Server 的 Agent 系统并完成安全审计

> 课型：项目推进课
> 目标：连接多个 MCP Server，集成认证、授权、审计，完成安全审计

## 当前卡点

前 4 个阶段你学了协议、Server 开发、高级模式、Client 开发。现在要把它们整合：一个 Agent 同时连接文件系统 Server、数据库 Server、API Gateway Server，统一管理工具发现、调用路由、权限控制和审计日志。

这不是 demo——这是你实际项目中会遇到的架构。

## 方案设计

```
Agent
  ├── Client Manager（管理多个 Client 连接）
  │   ├── Client → 文件系统 Server（stdio）
  │   ├── Client → 数据库 Server（stdio）
  │   └── Client → API Gateway Server（HTTP）
  │
  ├── Tool Router（根据工具名路由到对应 Server）
  │
  ├── Security Layer（认证 + 授权 + 审计）
  │
  └── Unified Tool List（聚合所有 Server 的 Tool）
```

核心问题：3 个 Server 各自有自己的 Tool 列表，Agent 需要把它们聚合成一个统一的列表，调用时路由到正确的 Server。

## 代码落地

### Multi-Server Client Manager

```python
import asyncio
import json
import logging
from datetime import datetime
from dataclasses import dataclass, field

logger = logging.getLogger("multi-server-agent")

@dataclass
class ServerConnection:
    name: str
    client: "MCPClient"
    tools: list[dict] = field(default_factory=list)
    healthy: bool = True

class MultiServerManager:
    def __init__(self):
        self.connections: dict[str, ServerConnection] = {}
        self.tool_to_server: dict[str, str] = {}  # tool_name -> server_name

    async def add_server(self, name: str, transport) -> None:
        client = MCPClient(transport)
        await transport.start()
        await client.initialize()
        tools = await client.list_tools()
        self.connections[name] = ServerConnection(name=name, client=client, tools=tools)
        for tool in tools:
            self.tool_to_server[tool["name"]] = name
        logger.info(f"已连接 {name}，{len(tools)} 个工具")

    def list_all_tools(self) -> list[dict]:
        result = []
        for conn in self.connections.values():
            result.extend(conn.tools)
        return result

    async def call_tool(self, name: str, arguments: dict) -> list[dict]:
        server_name = self.tool_to_server.get(name)
        if not server_name:
            raise ValueError(f"未知工具: {name}")
        conn = self.connections[server_name]
        if not conn.healthy:
            raise RuntimeError(f"Server {server_name} 不可用")
        return await conn.client.call_tool(name, arguments)
```

### Security Layer

```python
class SecurityManager:
    def __init__(self):
        self.user_permissions: dict[str, set[str]] = {}
        self.tool_permissions: dict[str, set[str]] = {}

    def set_user_permissions(self, user_id: str, permissions: set[str]):
        self.user_permissions[user_id] = permissions

    def set_tool_permissions(self, tool_name: str, required: set[str]):
        self.tool_permissions[tool_name] = required

    def check_access(self, user_id: str, tool_name: str) -> bool:
        user_perms = self.user_permissions.get(user_id, set())
        required = self.tool_permissions.get(tool_name, set())
        return required.issubset(user_perms)

class AuditLogger:
    def __init__(self):
        self.entries: list[dict] = []

    def log(self, user_id: str, tool_name: str, arguments: dict, result=None, error=None):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
            "tool_name": tool_name,
            "arguments": arguments,
            "result_summary": str(result)[:200] if result else None,
            "error": str(error) if error else None,
        }
        self.entries.append(entry)
        logger.info(f"审计: {user_id} 调用 {tool_name}")

    def get_recent(self, n: int = 20) -> list[dict]:
        return self.entries[-n:]
```

### Agent 主循环

```python
class Agent:
    def __init__(self):
        self.server_manager = MultiServerManager()
        self.security = SecurityManager()
        self.audit = AuditLogger()

    async def initialize(self, server_configs: list[dict]):
        for config in server_configs:
            if config["transport"] == "stdio":
                transport = StdioTransport(config["command"], config.get("args", []))
            else:
                transport = HTTPTransport(config["url"])
            await self.server_manager.add_server(config["name"], transport)

    def get_tools_for_user(self, user_id: str) -> list[dict]:
        all_tools = self.server_manager.list_all_tools()
        return [t for t in all_tools if self.security.check_access(user_id, t["name"])]

    async def execute(self, user_id: str, tool_name: str, arguments: dict) -> list[dict]:
        # 权限检查
        if not self.security.check_access(user_id, tool_name):
            self.audit.log(user_id, tool_name, arguments, error="权限不足")
            raise PermissionError(f"无权调用: {tool_name}")

        # 调用
        try:
            result = await self.server_manager.call_tool(tool_name, arguments)
            self.audit.log(user_id, tool_name, arguments, result=result)
            return result
        except Exception as e:
            self.audit.log(user_id, tool_name, arguments, error=e)
            raise
```

### 启动

```python
async def main():
    agent = Agent()
    await agent.initialize([
        {"name": "filesystem", "transport": "stdio", "command": "python", "args": ["fs_server.py"]},
        {"name": "database", "transport": "stdio", "command": "python", "args": ["db_server.py"]},
        {"name": "api-gateway", "transport": "http", "url": "http://localhost:8080/mcp"},
    ])

    # 配置权限
    agent.security.set_user_permissions("user_1", {"read", "query"})
    agent.security.set_tool_permissions("read_file", {"read"})
    agent.security.set_tool_permissions("query_database", {"query"})
    agent.security.set_tool_permissions("delete_user", {"admin"})

    # 列出用户可用工具
    tools = agent.get_tools_for_user("user_1")
    print(f"可用工具: {[t['name'] for t in tools]}")

    # 调用
    result = await agent.execute("user_1", "read_file", {"path": "/tmp/test.txt"})
    print(f"结果: {result}")

asyncio.run(main())
```

## 复盘：关键判断

### 1. 工具名冲突怎么办

三个 Server 可能都有叫 `search` 的 Tool。解决方案：
- 加前缀：`fs_search`、`db_search`、`api_search`
- 或者在 `add_server` 时自动加前缀

```python
for tool in tools:
    prefixed_name = f"{name}_{tool['name']}"
    self.tool_to_server[prefixed_name] = name
```

### 2. 某个 Server 挂了怎么办

不要让一个 Server 的故障拖垮整个 Agent。在 `call_tool` 里捕获连接异常，标记 Server 为 unhealthy，返回友好提示。

### 3. 安全层和业务层要分离

权限检查在 Agent 层做，不在 Tool 里做。这样新增 Tool 时自动继承安全层的能力，不需要每个 Tool 重复写校验逻辑。

### 4. 审计日志是生产环境的底线

没有审计日志，出了安全问题你根本不知道发生了什么。记录：谁、什么时间、调了什么、传了什么参数、返回了什么结果。

## 安全审计检查清单

完成实现后，用这个清单自查：

```
认证：
  ☑ 用户身份如何验证？（Token / API Key / OAuth）
  ☑ 未认证用户能否调用 Tool？
  ☑ Token 过期后如何处理？

授权：
  ☑ 每个 Tool 是否都有权限要求？
  ☑ 权限检查是否在调用层统一执行？
  ☑ 权限不足时是否返回明确提示？
  ☑ 是否存在 Tool 绕过权限检查的路径？

输入校验：
  ☑ SQL Tool 是否只允许 SELECT？
  ☑ 文件 Tool 是否限制路径范围？
  ☑ API Tool 是否限制请求方法？
  ☑ 所有输入是否经过 Schema 验证？

审计：
  ☑ 每次 Tool 调用是否记录日志？
  ☑ 日志是否包含用户 ID、Tool 名、参数、结果？
  ☑ 异常调用是否有告警？
  ☑ 日志是否可以追溯到具体用户？

故障处理：
  ☑ 单个 Server 故障是否影响其他 Server？
  ☑ 网络超时是否有重试机制？
  ☑ 错误信息是否暴露内部细节？
```

## 练习

### 练习一：实现 Tool 名冲突处理

在 `MultiServerManager.add_server` 中自动为 Tool 名添加 Server 前缀，避免冲突。同时提供 `get_tool_full_name(server, tool)` 和 `parse_tool_name(full_name)` 辅助方法。

### 练习二：实现故障转移

当某个 Server 连接失败时：
- 标记为 unhealthy
- 返回该 Server 的 Tool 列表为空
- 每 30 秒尝试重新连接
- 恢复后自动加入 Tool 列表

### 练习三：完成安全审计

用上面的安全审计检查清单，对你实现的系统逐项检查。对每一项：
- 如果已满足，说明在哪里满足
- 如果未满足，说明风险和修复方案

---

## 参考答案

### 练习一

```python
class MultiServerManager:
    def __init__(self):
        self.connections: dict[str, ServerConnection] = {}
        self.tool_to_server: dict[str, str] = {}
        self.tool_original_names: dict[str, str] = {}  # full_name -> original_name

    async def add_server(self, name: str, transport) -> None:
        client = MCPClient(transport)
        await transport.start()
        await client.initialize()
        tools = await client.list_tools()
        self.connections[name] = ServerConnection(name=name, client=client, tools=tools)
        for tool in tools:
            full_name = f"{name}__{tool['name']}"
            self.tool_to_server[full_name] = name
            self.tool_original_names[full_name] = tool["name"]
        logger.info(f"已连接 {name}，{len(tools)} 个工具")

    def list_all_tools(self) -> list[dict]:
        result = []
        for conn in self.connections.values():
            for tool in conn.tools:
                full_name = f"{conn.name}__{tool['name']}"
                result.append({**tool, "name": full_name, "original_name": tool["name"]})
        return result

    async def call_tool(self, full_name: str, arguments: dict) -> list[dict]:
        server_name = self.tool_to_server.get(full_name)
        if not server_name:
            raise ValueError(f"未知工具: {full_name}")
        original_name = self.tool_original_names[full_name]
        conn = self.connections[server_name]
        return await conn.client.call_tool(original_name, arguments)
```

### 练习二

```python
@dataclass
class ServerConnection:
    name: str
    client: "MCPClient"
    transport: object
    tools: list[dict] = field(default_factory=list)
    healthy: bool = True

class MultiServerManager:
    def __init__(self):
        self.connections: dict[str, ServerConnection] = {}
        self.tool_to_server: dict[str, str] = {}
        self.tool_original_names: dict[str, str] = {}

    async def add_server(self, name: str, transport) -> None:
        try:
            client = MCPClient(transport)
            await transport.start()
            await client.initialize()
            tools = await client.list_tools()
            self.connections[name] = ServerConnection(name=name, client=client, transport=transport, tools=tools, healthy=True)
            for tool in tools:
                full_name = f"{name}__{tool['name']}"
                self.tool_to_server[full_name] = name
                self.tool_original_names[full_name] = tool["name"]
            logger.info(f"已连接 {name}，{len(tools)} 个工具")
        except Exception as e:
            logger.error(f"连接 {name} 失败: {e}")
            self.connections[name] = ServerConnection(name=name, client=None, transport=transport, tools=[], healthy=False)
            asyncio.create_task(self._reconnect(name))

    async def _reconnect(self, name: str):
        while name in self.connections and not self.connections[name].healthy:
            await asyncio.sleep(30)
            try:
                conn = self.connections[name]
                client = MCPClient(conn.transport)
                await conn.transport.start()
                await client.initialize()
                tools = await client.list_tools()
                conn.client = client
                conn.tools = tools
                conn.healthy = True
                for tool in tools:
                    full_name = f"{name}__{tool['name']}"
                    self.tool_to_server[full_name] = name
                    self.tool_original_names[full_name] = tool["name"]
                logger.info(f"{name} 已恢复，{len(tools)} 个工具")
            except Exception:
                logger.warning(f"{name} 重连失败，30 秒后重试")

    def list_all_tools(self) -> list[dict]:
        result = []
        for conn in self.connections.values():
            if not conn.healthy:
                continue
            for tool in conn.tools:
                full_name = f"{conn.name}__{tool['name']}"
                result.append({**tool, "name": full_name})
        return result
```

### 练习三

示例回答（部分项）：

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 用户身份验证 | ☑ 已满足 | `SecurityManager.check_access` 在调用前校验 |
| 未认证用户 | ☑ 已满足 | `get_tools_for_user` 只返回有权限的 Tool |
| Token 过期 | ☐ 未满足 | 当前无 Token 机制，风险：用户 Session 过期后仍可调用。修复：添加 Token TTL 检查 |
| SQL 只允许 SELECT | ☑ 已满足 | db_server 中 `query_database` 检查 SQL 前缀 |
| 文件路径限制 | ☐ 未满足 | 当前可读任意路径。修复：限制 `allowed_paths` 白名单 |
| 审计日志 | ☑ 已满足 | `AuditLogger.log` 记录每次调用 |
| 错误信息 | ☑ 已满足 | Tool 层捕获异常返回友好提示，不暴露堆栈 |
