# 04 MCP 协议深度解析

> MCP 是工具生态的未来——一次实现，到处可用。

## 场景引入

你的团队为 Agent 框架 A 开发了一套搜索工具，后来换到框架 B 时发现所有工具适配代码都要重写。另一个团队想复用你们的工具，却因为框架不同无法直接集成。每个工具都要为每个框架单独适配，这种 N×M 的复杂度让工具生态难以繁荣。MCP 协议正是为了解决这个问题而生。

## 学习目标

- 理解 MCP（Model Context Protocol）的设计思想
- 实现 MCP Server 和 Client
- 掌握 MCP 工具的注册、发现和调用

## 什么是 MCP

MCP 是 Anthropic 提出的开放协议，目标是标准化 LLM 和外部工具之间的通信。就像 USB 让不同设备即插即用，MCP 让不同工具即插即用。

```
传统方式：每个工具需要单独适配每个 Agent 框架
MCP 方式：工具实现一次 MCP Server，所有支持 MCP 的 Agent 都能用
```

## MCP Server 实现

```python
# backend/app/mcp/server.py
from mcp.server import Server
from mcp.types import Tool, TextContent
import mcp.server.stdio

server = Server("star-tools")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="search_knowledge_base",
            description="搜索企业知识库",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"},
                    "top_k": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="query_order",
            description="查询订单状态",
            inputSchema={
                "type": "object",
                "properties": {
                    "order_id": {"type": "string", "description": "订单号"},
                },
                "required": ["order_id"],
            },
        ),
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "search_knowledge_base":
        result = await search_kb(arguments["query"], arguments.get("top_k", 5))
    elif name == "query_order":
        result = await query_order(arguments["order_id"])
    else:
        result = {"error": f"Unknown tool: {name}"}
    
    return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False))]

async def main():
    async with mcp.server.stdio.stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())
```

## MCP Client 集成

```python
# backend/app/mcp/client.py
from mcp.client import ClientSession
from mcp.client.stdio import stdio_client

class MCPClient:
    """MCP Client——连接 MCP Server 并使用工具"""
    
    def __init__(self):
        self.sessions: dict[str, ClientSession] = {}
    
    async def connect(self, server_name: str, command: str, args: list[str]):
        """连接到 MCP Server"""
        transport = await stdio_client(command, args)
        session = ClientSession(transport[0], transport[1])
        await session.initialize()
        self.sessions[server_name] = session
    
    async def list_tools(self, server_name: str) -> list[dict]:
        """列出 Server 提供的工具"""
        session = self.sessions[server_name]
        result = await session.list_tools()
        return [
            {
                "name": t.name,
                "description": t.description,
                "parameters": t.inputSchema,
            }
            for t in result.tools
        ]
    
    async def call_tool(
        self, server_name: str, tool_name: str, arguments: dict
    ) -> str:
        """调用 MCP Server 的工具"""
        session = self.sessions[server_name]
        result = await session.call_tool(tool_name, arguments)
        return result.content[0].text
```

## MCP 工具转 Agent 工具

```python
class MCPToolAdapter(BaseTool):
    """将 MCP 工具适配为 Agent 工具"""
    
    def __init__(self, mcp_client: MCPClient, server_name: str, tool_info: dict):
        self.client = mcp_client
        self.server_name = server_name
        self._name = tool_info["name"]
        self._description = tool_info["description"]
        self._parameters = tool_info["parameters"]
    
    @property
    def name(self) -> str:
        return f"mcp_{self._name}"
    
    @property
    def description(self) -> str:
        return f"[MCP] {self._description}"
    
    @property
    def parameters(self) -> dict:
        return self._parameters
    
    async def execute(self, **kwargs) -> ToolResult:
        try:
            result = await self.client.call_tool(
                self.server_name, self._name, kwargs
            )
            return ToolResult(success=True, data=result)
        except Exception as e:
            return ToolResult(success=False, error=str(e))
```

## 练习

### 练习 1：MCP Server

实现一个 MCP Server，提供以下工具：

1. `get_weather`：查询天气
2. `calculate`：数学计算

### 练习 2：MCP Client

实现 MCP Client：

1. 连接到 MCP Server
2. 列出可用工具
3. 调用工具并获取结果

## 常见误区

| 误区 | 原因 | 解决 |
|------|------|------|
| MCP Server 只实现了 list_tools | 忘了实现 call_tool | 两个接口都要实现，缺一不可 |
| 工具的 inputSchema 不严格 | 随手写了 JSON 没校验 | 用 JSON Schema 标准定义，包含 required 和类型约束 |
| 认为 MCP 能替代所有工具集成 | 过度依赖标准化 | MCP 适合通用工具，高性能场景仍需原生集成 |
| Client 连接后不处理断线 | 没有重连机制 | 实现心跳检测和自动重连 |

## 工程建议

- MCP Server 的工具描述要和直接注册的工具一样精确，Agent 通过描述选择工具的原则不变
- 建议为 MCP Server 添加健康检查接口，Client 连接前先确认 Server 可用
- MCP 工具的调用延迟可能高于本地工具（涉及进程间通信），对延迟敏感的场景要做性能测试
- 多个 MCP Server 的工具可能同名，建议用 `{server_name}_{tool_name}` 的命名规范避免冲突

## 本节要点

- MCP 是工具生态的标准化协议
- MCP Server 实现一次，所有支持 MCP 的 Agent 都能用
- MCP 工具可以通过适配器集成到现有 Agent 系统
- MCP 支持工具发现、调用、资源访问等完整能力
