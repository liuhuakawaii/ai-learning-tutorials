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
