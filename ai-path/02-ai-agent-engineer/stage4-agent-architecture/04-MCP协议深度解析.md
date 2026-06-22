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

---

## 参考答案

### 练习 1

**思路**：基于课程中的 MCP Server 模板，实现两个工具（get_weather 和 calculate）。关键是定义清晰的 inputSchema 和正确的 call_tool 分发逻辑。

**答案**：

```python
# backend/app/mcp/weather_server.py
from mcp.server import Server
from mcp.types import Tool, TextContent
import mcp.server.stdio
import json
import math

server = Server("weather-calc-tools")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_weather",
            description="查询指定城市的天气信息。适用于用户询问天气、气温、是否下雨等场景。",
            inputSchema={
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称，如'北京'、'上海'",
                    },
                    "date": {
                        "type": "string",
                        "description": "日期，格式 YYYY-MM-DD，默认今天",
                        "default": "today",
                    },
                },
                "required": ["city"],
            },
        ),
        Tool(
            name="calculate",
            description="执行数学计算。支持加减乘除、幂运算、三角函数等。适用于数学问题、数据计算。",
            inputSchema={
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "数学表达式，如 '2 + 3 * 4' 或 'math.sqrt(16)'",
                    },
                },
                "required": ["expression"],
            },
        ),
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "get_weather":
        city = arguments["city"]
        date = arguments.get("date", "today")
        # 模拟天气数据
        weather_data = {
            "city": city,
            "date": date,
            "temperature": "22°C",
            "condition": "晴",
            "humidity": "45%",
        }
        result = json.dumps(weather_data, ensure_ascii=False)
    elif name == "calculate":
        expression = arguments["expression"]
        try:
            allowed = {"__builtins__": {}, "math": math}
            result_value = eval(expression, allowed)
            result = json.dumps({"expression": expression, "result": result_value}, ensure_ascii=False)
        except Exception as e:
            result = json.dumps({"error": str(e)}, ensure_ascii=False)
    else:
        result = json.dumps({"error": f"Unknown tool: {name}"}, ensure_ascii=False)

    return [TextContent(type="text", text=result)]

async def main():
    async with mcp.server.stdio.stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

**要点**：
- `list_tools` 和 `call_tool` 两个接口缺一不可，只实现一个会导致 Client 端报错
- inputSchema 必须用 JSON Schema 标准定义，包含 `required` 和类型约束
- 工具描述要说明"适用于什么场景"，帮助 Agent 判断何时调用
- 常见错误：inputSchema 随手写个空对象 `{}`，导致 LLM 传错参数无法校验

### 练习 2

**思路**：实现 MCP Client，连接到练习 1 的 Server，列出工具并调用。核心是理解 stdio 传输方式和会话管理。

**答案**：

```python
# backend/app/mcp/client_demo.py
import asyncio
from mcp.client import ClientSession
from mcp.client.stdio import stdio_client

async def main():
    # 1. 连接到 MCP Server
    transport = await stdio_client("python", ["backend/app/mcp/weather_server.py"])
    session = ClientSession(transport[0], transport[1])
    await session.initialize()
    print("已连接到 MCP Server")

    # 2. 列出可用工具
    tools_result = await session.list_tools()
    print(f"\n可用工具 ({len(tools_result.tools)} 个):")
    for tool in tools_result.tools:
        print(f"  - {tool.name}: {tool.description}")

    # 3. 调用工具
    # 调用 get_weather
    weather_result = await session.call_tool("get_weather", {"city": "北京"})
    print(f"\n查询北京天气: {weather_result.content[0].text}")

    # 调用 calculate
    calc_result = await session.call_tool("calculate", {"expression": "math.sqrt(144) + 3 * 5"})
    print(f"计算结果: {calc_result.content[0].text}")

if __name__ == "__main__":
    asyncio.run(main())
```

**要点**：
- stdio 方式通过子进程通信，Client 启动 Server 进程并建立 stdin/stdout 管道
- `session.initialize()` 是必须的握手步骤，不调用会报协议错误
- 工具调用返回的 `content[0].text` 是 JSON 字符串，需要按需解析
- 常见错误：连接后不处理断线，生产环境需要实现心跳检测和自动重连

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
