# 02 Agent 集成——将 MCP Tool 接入 LangGraph / OpenAI Agents SDK

> 将 MCP Tool 集成到你的 Agent 系统中，让 Agent 能够使用任何 MCP 工具。

## 学习目标

- 掌握将 MCP Tool 集成到 Agent 的方法
- 理解 LangGraph 和 OpenAI Agents SDK 的集成方式
- 学会实现 MCP-Aware Agent

---

## 一、LangGraph 集成

```python
from langgraph.graph import StateGraph
from mcp import MCPClient

class MCPAgentState(TypedDict):
    messages: list
    mcp_tools: list
    task: str

def create_mcp_agent(mcp_client: MCPClient):
    """创建 MCP Agent"""
    
    async def mcp_tool_node(state: MCPAgentState) -> MCPAgentState:
        """MCP 工具节点"""
        # 获取工具列表
        tools = await mcp_client.list_tools()
        
        # 根据任务选择工具
        selected_tool = select_tool(state["task"], tools)
        
        # 调用工具
        result = await mcp_client.call_tool(
            selected_tool["name"],
            selected_tool["arguments"]
        )
        
        return {
            **state,
            "messages": state["messages"] + [{"role": "tool", "content": result}]
        }
    
    return mcp_tool_node
```

---

## 二、OpenAI Agents SDK 集成

```python
from openai import OpenAI

class MCPToolAdapter:
    """MCP 工具适配器"""
    
    def __init__(self, mcp_client: MCPClient):
        self.mcp_client = mcp_client
    
    async def get_openai_tools(self) -> list:
        """获取 OpenAI 格式的工具"""
        mcp_tools = await self.mcp_client.list_tools()
        
        openai_tools = []
        for tool in mcp_tools:
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool.get("inputSchema", {})
                }
            })
        
        return openai_tools
    
    async def execute_tool(self, name: str, arguments: dict) -> str:
        """执行工具"""
        return await self.mcp_client.call_tool(name, arguments)
```

---

## 三、自动工具发现

```python
class AutoMCPAgent:
    """自动发现 MCP 工具的 Agent"""
    
    def __init__(self, llm, mcp_clients: list[MCPClient]):
        self.llm = llm
        self.mcp_clients = mcp_clients
        self.tools = []
    
    async def initialize(self):
        """初始化，发现所有工具"""
        for client in self.mcp_clients:
            tools = await client.list_tools()
            self.tools.extend(tools)
    
    async def run(self, task: str) -> str:
        """执行任务"""
        # 选择工具
        tool = self._select_tool(task)
        
        # 调用工具
        result = await self._call_tool(tool)
        
        return result
```

---

## 四、多 Server 管理

```python
class MultiServerAgent:
    """多 Server Agent"""
    
    def __init__(self):
        self.servers = {}
    
    async def add_server(self, name: str, client: MCPClient):
        """添加 Server"""
        await client.initialize()
        tools = await client.list_tools()
        self.servers[name] = {"client": client, "tools": tools}
    
    async def call_tool(self, tool_name: str, arguments: dict) -> str:
        """调用工具（自动选择 Server）"""
        for server_name, server in self.servers.items():
            for tool in server["tools"]:
                if tool["name"] == tool_name:
                    return await server["client"].call_tool(tool_name, arguments)
        
        raise ToolNotFoundError(f"工具 {tool_name} 未找到")
```

---

## 小结

```
本课核心要点：

1. MCP Tool 可以集成到 LangGraph 和 OpenAI Agents SDK
2. 适配器模式将 MCP 工具转换为框架格式
3. 自动工具发现简化配置
4. 多 Server 管理支持分布式工具

---

**下一课**: [03 安全模型——认证（OAuth 2.1）、授权、速率限制、输入校验](./03-安全模型.md)
```

---

## 练习

1. **集成题**：将 MCP Tool 集成到 LangGraph Agent。

2. **适配题**：实现 MCP 到 OpenAI 格式的适配器。

3. **多主题**：实现多 Server 管理。
