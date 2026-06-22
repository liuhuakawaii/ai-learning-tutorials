# 04 多 Server 管理——一个 Agent 连接多个 MCP Server 的架构

> 实际项目中，一个 Agent 通常需要连接多个 MCP Server。

## 场景引入

你的 AI Agent 需要同时使用数据库查询、文件读取、Slack 消息发送三个 MCP Server。每个 Server 有自己的 Client，工具名称可能冲突（两个 Server 都有 read_file），调用时要自动路由到正确的 Server。更复杂的是，某个 Server 偶尔会挂掉，你需要故障转移到备用实例。一个 Agent 管理多个 Server，架构该怎么设计？

---

## 学习目标

- 掌握多 Server 管理的架构设计
- 理解 Server 发现和路由机制
- 学会实现分布式工具管理

---

## 一、多 Server 架构

```
多 Server 架构：

Agent
  │
  ├── MCP Client → Server A (数据库)
  ├── MCP Client → Server B (文件系统)
  ├── MCP Client → Server C (API Gateway)
  └── MCP Client → Server D (其他服务)
```

---

## 二、Server 管理器

```python
class MultiServerManager:
    """多 Server 管理器"""
    
    def __init__(self):
        self.servers = {}
        self.tool_index = {}
    
    async def add_server(self, name: str, client: MCPClient):
        """添加 Server"""
        await client.initialize()
        tools = await client.list_tools()
        
        self.servers[name] = {
            "client": client,
            "tools": tools
        }
        
        # 建立工具索引
        for tool in tools:
            self.tool_index[tool["name"]] = name
    
    async def call_tool(self, tool_name: str, arguments: dict) -> str:
        """调用工具"""
        # 查找工具所在的 Server
        server_name = self.tool_index.get(tool_name)
        if not server_name:
            raise ToolNotFoundError(f"工具 {tool_name} 未找到")
        
        server = self.servers[server_name]
        return await server["client"].call_tool(tool_name, arguments)
    
    def list_all_tools(self) -> list:
        """列出所有工具"""
        all_tools = []
        for server_name, server in self.servers.items():
            for tool in server["tools"]:
                all_tools.append({
                    **tool,
                    "server": server_name
                })
        return all_tools
```

---

## 三、负载均衡

```python
class LoadBalancedServerManager:
    """负载均衡 Server 管理器"""
    
    def __init__(self):
        self.server_groups = {}
    
    def add_server_group(self, tool_name: str, clients: list[MCPClient]):
        """添加 Server 组"""
        self.server_groups[tool_name] = {
            "clients": clients,
            "current": 0
        }
    
    async def call_tool(self, tool_name: str, arguments: dict) -> str:
        """调用工具（负载均衡）"""
        group = self.server_groups.get(tool_name)
        if not group:
            raise ToolNotFoundError(f"工具 {tool_name} 未找到")
        
        # 轮询选择 Server
        client = group["clients"][group["current"]]
        group["current"] = (group["current"] + 1) % len(group["clients"])
        
        return await client.call_tool(tool_name, arguments)
```

---

## 四、故障转移

```python
class FailoverServerManager:
    """故障转移 Server 管理器"""
    
    async def call_tool_with_failover(self, tool_name: str, arguments: dict, clients: list) -> str:
        """带故障转移的工具调用"""
        last_error = None
        
        for client in clients:
            try:
                return await client.call_tool(tool_name, arguments)
            except Exception as e:
                last_error = e
                continue
        
        raise last_error
```

---

## 五、工具路由

```python
class ToolRouter:
    """工具路由器"""
    
    def __init__(self):
        self.routes = {}
    
    def add_route(self, pattern: str, server_name: str):
        """添加路由"""
        self.routes[pattern] = server_name
    
    def route(self, tool_name: str) -> str:
        """路由工具"""
        for pattern, server in self.routes.items():
            if tool_name.startswith(pattern):
                return server
        return None
```

## 常见误区

```
误区 1：工具名冲突就改 Server 代码
  工具名冲突应该在 Manager 层用命名空间解决（如 db:read_file、fs:read_file）。
  不要为了兼容而改已有 Server 的工具名。

误区 2：故障转移就是自动重试
  故障转移是切换到不同的 Server 实例，不是重试同一个实例。
  重试同一个挂掉的实例只会浪费时间。

误区 3：所有 Server 都需要负载均衡
  只有无状态的 Server 才适合负载均衡。有状态 Server（如数据库连接）要用会话粘滞。
  不要盲目对所有 Server 做负载均衡。

误区 4：Server 管理器不需要健康检查
  没有健康检查，Manager 不知道 Server 已经挂了，会继续路由请求到不可用的 Server。
  定期探测 Server 状态，标记不健康的 Server。
```

---

## 工程建议

```
1. 工具索引用 Server 名称做前缀
  server_name:tool_name 格式，避免工具名冲突。
  在 list_all_tools 中返回带前缀的工具名，让 AI 知道工具属于哪个 Server。

2. 健康检查间隔要合理
  太频繁（每秒）会给 Server 带来压力，太稀疏（每小时）发现不了问题。
  建议每 30 秒检查一次，连续 3 次失败标记为不健康。

3. 故障转移要有降级方案
  主 Server 不可用时，先尝试备用 Server。
  所有 Server 都不可用时，返回缓存数据或友好提示。

4. 优雅下线比强制断开好
  Server 维护前，先通知 Manager 停止路由新请求。
  等待进行中的请求完成后再断开连接。
```

---

## 小结

1. 多 Server 管理支持分布式工具
2. 工具索引快速定位工具所在 Server
3. 负载均衡提高可用性
4. 故障转移保证服务连续性

---

**下一课**: [05 社区生态——使用和贡献开源 MCP Server](./05-社区生态.md)
```

---

## 练习

1. **管理题**：实现一个多 Server 管理器。

2. **负载题**：实现负载均衡功能。

3. **故障题**：实现故障转移机制。

---

## 参考答案

### 练习一：多 Server 管理器

**思路**：多 Server 管理器的核心是维护"工具名→Server"的索引，调用时自动路由。工具名冲突用命名空间（`server:tool`）解决。管理器还需要支持 Server 的动态添加和移除、工具列表的聚合查询。

**答案**：
```python
import json

class MultiServerManager:
    def __init__(self):
        self.servers: dict[str, dict] = {}
        self.tool_index: dict[str, str] = {}

    async def add_server(self, name: str, client):
        await client.initialize()
        tools = await client.list_tools()
        self.servers[name] = {"client": client, "tools": tools}
        for tool in tools:
            prefixed = f"{name}:{tool['name']}"
            self.tool_index[prefixed] = name
        return tools

    async def remove_server(self, name: str):
        if name not in self.servers:
            return
        keys_to_remove = [k for k, v in self.tool_index.items() if v == name]
        for key in keys_to_remove:
            del self.tool_index[key]
        del self.servers[name]

    async def call_tool(self, prefixed_name: str, arguments: dict) -> str:
        server_name = self.tool_index.get(prefixed_name)
        if not server_name:
            raise ToolNotFoundError(f"工具 {prefixed_name} 未找到")
        server = self.servers[server_name]
        tool_name = prefixed_name.split(":", 1)[1]
        result = await server["client"].call_tool(tool_name, arguments)
        texts = [item.get("text", "") for item in result if item.get("type") == "text"]
        return "\n".join(texts)

    def list_all_tools(self) -> list[dict]:
        all_tools = []
        for name, server in self.servers.items():
            for tool in server["tools"]:
                all_tools.append({**tool, "name": f"{name}:{tool['name']}", "server": name})
        return all_tools

    def find_server_for_tool(self, tool_name: str) -> str | None:
        return self.tool_index.get(tool_name)

class ToolNotFoundError(Exception):
    pass

class MockMCPClient:
    def __init__(self, tools: list[dict]):
        self._tools = tools

    async def initialize(self):
        pass

    async def list_tools(self) -> list[dict]:
        return self._tools

    async def call_tool(self, name: str, arguments: dict) -> list[dict]:
        return [{"type": "text", "text": f"{name} 执行结果"}]

async def demo():
    mgr = MultiServerManager()
    db_client = MockMCPClient([
        {"name": "query", "description": "执行 SQL 查询"},
        {"name": "insert", "description": "插入数据"}
    ])
    fs_client = MockMCPClient([
        {"name": "read_file", "description": "读取文件"},
        {"name": "write_file", "description": "写入文件"}
    ])
    await mgr.add_server("db", db_client)
    await mgr.add_server("fs", fs_client)
    print(f"所有工具：{[t['name'] for t in mgr.list_all_tools()]}")
    result = await mgr.call_tool("db:query", {"sql": "SELECT 1"})
    print(f"结果：{result}")

import asyncio
asyncio.run(demo())
```

**要点**：
- 命名空间必须在添加 Server 时就建立索引，不要每次调用时遍历所有 Server 查找
- `remove_server` 时必须同步清理 `tool_index` 中的映射，否则会路由到已移除的 Server
- 常见错误：用原始工具名做索引，两个 Server 都有 `read_file` 时后注册的会覆盖先注册的

### 练习二：负载均衡

**思路**：负载均衡适用于多个 Server 实例提供相同工具的场景。策略有：轮询（Round Robin）、最少连接、随机。关键是区分有状态和无状态 Server——有状态 Server（如数据库连接）需要会话粘滞，不能盲目负载均衡。

**答案**：
```python
import random
import asyncio

class LoadBalancedServerManager:
    def __init__(self, strategy: str = "round_robin"):
        self.server_groups: dict[str, dict] = {}
        self.strategy = strategy
        self._counters: dict[str, int] = {}

    def add_server_group(self, tool_name: str, clients: list):
        self.server_groups[tool_name] = {
            "clients": clients,
            "healthy": [True] * len(clients)
        }
        self._counters[tool_name] = 0

    def mark_unhealthy(self, tool_name: str, index: int):
        if tool_name in self.server_groups:
            self.server_groups[tool_name]["healthy"][index] = False

    def mark_healthy(self, tool_name: str, index: int):
        if tool_name in self.server_groups:
            self.server_groups[tool_name]["healthy"][index] = True

    def _select_client(self, tool_name: str):
        group = self.server_groups[tool_name]
        healthy_clients = [(i, c) for i, (c, h) in enumerate(zip(group["clients"], group["healthy"])) if h]
        if not healthy_clients:
            raise NoHealthyServerError(f"工具 {tool_name} 没有健康的 Server")

        if self.strategy == "round_robin":
            idx = self._counters[tool_name] % len(healthy_clients)
            self._counters[tool_name] += 1
            return healthy_clients[idx]
        elif self.strategy == "random":
            return random.choice(healthy_clients)
        else:
            return healthy_clients[0]

    async def call_tool(self, tool_name: str, arguments: dict) -> str:
        index, client = self._select_client(tool_name)
        try:
            result = await client.call_tool(tool_name, arguments)
            self.mark_healthy(tool_name, index)
            return result
        except Exception as e:
            self.mark_unhealthy(tool_name, index)
            raise

class NoHealthyServerError(Exception):
    pass

class SimpleClient:
    def __init__(self, name: str, fail: bool = False):
        self.name = name
        self.fail = fail

    async def call_tool(self, name: str, arguments: dict) -> str:
        if self.fail:
            raise ConnectionError(f"{self.name} 不可用")
        return f"{self.name} 执行 {name}"

async def demo():
    mgr = LoadBalancedServerManager(strategy="round_robin")
    mgr.add_server_group("query", [
        SimpleClient("server-1"),
        SimpleClient("server-2"),
        SimpleClient("server-3", fail=True)
    ])
    for i in range(6):
        result = await mgr.call_tool("query", {"sql": "SELECT 1"})
        print(f"第 {i+1} 次：{result}")

asyncio.run(demo())
```

**要点**：
- 只从健康的 Server 中选择，调用失败后立即标记为不健康，避免继续路由到故障实例
- 有状态 Server（如数据库连接池）不能用负载均衡，需要用会话粘滞（同一 session 始终路由到同一实例）
- 常见错误：对所有 Server 盲目做负载均衡，有状态 Server 的事务可能被打断

### 练习三：故障转移机制

**思路**：故障转移是当主 Server 不可用时，自动切换到备用 Server。关键是：快速检测故障（健康检查 + 调用失败标记）、有序尝试（主→备→降级）、返回最后的错误让调用方知道所有尝试都失败了。

**答案**：
```python
import asyncio
import time

class FailoverServerManager:
    def __init__(self):
        self.server_groups: dict[str, list[dict]] = {}
        self.health_status: dict[str, dict[str, bool]] = {}

    def add_server_group(self, tool_name: str, clients: list, names: list[str] = None):
        if names is None:
            names = [f"server-{i}" for i in range(len(clients))]
        self.server_groups[tool_name] = [
            {"client": c, "name": n} for c, n in zip(clients, names)
        ]
        self.health_status[tool_name] = {n: True for n in names}

    async def call_tool(self, tool_name: str, arguments: dict) -> str:
        if tool_name not in self.server_groups:
            raise ToolNotFoundError(f"工具 {tool_name} 未找到")

        last_error = None
        for server_info in self.server_groups[tool_name]:
            name = server_info["name"]
            if not self.health_status[tool_name].get(name, False):
                continue
            try:
                result = await server_info["client"].call_tool(tool_name, arguments)
                self.health_status[tool_name][name] = True
                return result
            except Exception as e:
                self.health_status[tool_name][name] = False
                last_error = e

        raise AllServersFailedError(f"所有 Server 都不可用：{last_error}")

    async def health_check_loop(self, interval: float = 30.0):
        while True:
            for tool_name, servers in self.server_groups.items():
                for server_info in servers:
                    name = server_info["name"]
                    try:
                        await asyncio.wait_for(
                            server_info["client"].call_tool("ping", {}),
                            timeout=5.0
                        )
                        self.health_status[tool_name][name] = True
                    except Exception:
                        self.health_status[tool_name][name] = False
            await asyncio.sleep(interval)

    def get_status(self) -> dict:
        return {tool: dict(status) for tool, status in self.health_status.items()}

class ToolNotFoundError(Exception):
    pass

class AllServersFailedError(Exception):
    pass

class FailableClient:
    def __init__(self, name: str, fail: bool = False):
        self.name = name
        self.fail = fail

    async def call_tool(self, name: str, arguments: dict) -> str:
        if self.fail:
            raise ConnectionError(f"{self.name} 连接失败")
        return f"{self.name} 执行成功"

async def demo():
    mgr = FailoverServerManager()
    mgr.add_server_group("query",
        [FailableClient("primary", fail=True), FailableClient("backup"), FailableClient("fallback")],
        names=["primary", "backup", "fallback"]
    )
    try:
        result = await mgr.call_tool("query", {"sql": "SELECT 1"})
        print(f"结果：{result}")
    except AllServersFailedError as e:
        print(f"失败：{e}")
    print(f"状态：{mgr.get_status()}")

asyncio.run(demo())
```

**要点**：
- 故障转移是切换到不同的 Server 实例，不是重试同一个实例——重试挂掉的实例只浪费时间
- 健康检查间隔建议 30 秒，连续 3 次失败标记为不健康，避免频繁检查给 Server 带来压力
- 常见错误：只做故障转移不做健康恢复检查，Server 恢复后永远不被重新加入可用列表
