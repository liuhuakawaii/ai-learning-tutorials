# 04 多 Server 管理——一个 Agent 连接多个 MCP Server 的架构

> 实际项目中，一个 Agent 通常需要连接多个 MCP Server。

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

---

## 小结

```
本课核心要点：

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
