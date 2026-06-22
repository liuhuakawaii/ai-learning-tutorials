# 02 Agent 集成——将 MCP Tool 接入 LangGraph / OpenAI Agents SDK

> 将 MCP Tool 集成到你的 Agent 系统中，让 Agent 能够使用任何 MCP 工具。

## 场景引入

你用 LangGraph 搭建了一个 AI Agent，它能推理、规划、执行任务。现在你想让它能调用 MCP Server 提供的工具——数据库查询、文件操作、API 调用。但 LangGraph 的 Tool 格式和 MCP 的 Tool 格式不一样，你需要一个适配层把 MCP Tool 转换成 LangGraph 能理解的格式。更复杂的是，Agent 需要同时连接多个 MCP Server，工具列表可能有几百个，怎么让 AI 从几百个工具中选对？

---

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

## 常见误区

```
误区 1：直接把 MCP Tool 原样传给 LLM
  不同框架的 Tool 格式不同（LangGraph 用 @tool 装饰器，OpenAI 用 function 格式）。
  必须做格式转换，不能直接传递。

误区 2：工具越多 Agent 越强大
  工具太多反而会降低 Agent 的选择准确率。
  按任务类型动态加载相关工具，比一次性加载所有工具效果更好。

误区 3：Agent 集成只需要转换 Tool 格式
  还要考虑：工具调用的权限控制、调用结果的缓存、失败时的降级策略。
  格式转换只是最表层的工作。

误区 4：一个 Agent 只需要一个 MCP Client
  实际项目中，Agent 通常连接多个 MCP Server（数据库、文件、API 各一个）。
  每个 Server 用独立的 Client，由统一的 Manager 协调。
```

---

## 工程建议

```
1. 适配器模式隔离框架依赖
  写一个 MCPToolAdapter，把 MCP Tool 转换为目标框架的格式。
  框架升级或切换时，只需要改适配器，不影响 MCP Client。

2. 工具列表按任务类型过滤
  Agent 执行"数据分析"任务时，只加载数据库相关的 Tool。
  执行"文件处理"任务时，只加载文件系统的 Tool。

3. 工具调用结果要缓存
  相同参数的查询 Tool 调用，结果应该缓存一段时间。
  避免 Agent 在推理过程中重复调用同一个 Tool。

4. 失败时给 Agent 有用的错误信息
  "数据库连接超时，建议稍后重试"比"Error"有用得多。
  Agent 可以根据错误信息决定重试、换工具还是告知用户。
```

---

## 小结

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

---

## 参考答案

### 练习一：将 MCP Tool 集成到 LangGraph Agent

**思路**：LangGraph 的 Tool 使用 `@tool` 装饰器或 `StructuredTool` 定义，需要把 MCP Tool 的 JSON Schema 转换为 LangGraph 能理解的格式。关键是写一个适配器，自动发现 MCP Tool 并注册为 LangGraph Tool，Agent 调用时自动路由到对应的 MCP Server。

**答案**：
```python
import json
from typing import Any
from langchain_core.tools import StructuredTool
from langchain_core.pydantic_v1 import BaseModel, Field, create_model

class MCPToLangGraphAdapter:
    def __init__(self, mcp_client):
        self.mcp_client = mcp_client
        self._tools_cache: list[dict] = []

    async def discover_tools(self) -> list[StructuredTool]:
        self._tools_cache = await self.mcp_client.list_tools()
        langchain_tools = []
        for tool in self._tools_cache:
            langchain_tool = self._convert_tool(tool)
            langchain_tools.append(langchain_tool)
        return langchain_tools

    def _convert_tool(self, mcp_tool: dict) -> StructuredTool:
        schema = mcp_tool.get("inputSchema", {"type": "object", "properties": {}})
        pydantic_model = self._schema_to_pydantic(mcp_tool["name"], schema)

        async def tool_func(**kwargs) -> str:
            result = await self.mcp_client.call_tool(mcp_tool["name"], kwargs)
            texts = [item.get("text", "") for item in result if item.get("type") == "text"]
            return "\n".join(texts)

        return StructuredTool(
            name=mcp_tool["name"],
            description=mcp_tool.get("description", ""),
            func=None,
            coroutine=tool_func,
            args_schema=pydantic_model
        )

    def _schema_to_pydantic(self, model_name: str, schema: dict) -> type[BaseModel]:
        fields = {}
        properties = schema.get("properties", {})
        required = schema.get("required", [])

        for field_name, field_schema in properties.items():
            field_type = self._json_type_to_python(field_schema.get("type", "string"))
            description = field_schema.get("description", "")
            default = ... if field_name in required else None
            fields[field_name] = (field_type, Field(default=default, description=description))

        return create_model(model_name, **fields)

    def _json_type_to_python(self, json_type: str):
        mapping = {"string": str, "integer": int, "number": float, "boolean": bool, "array": list, "object": dict}
        return mapping.get(json_type, Any)

async def create_mcp_langgraph_agent(mcp_client):
    adapter = MCPToLangGraphAdapter(mcp_client)
    tools = await adapter.discover_tools()
    print(f"已加载 {len(tools)} 个 MCP 工具：{[t.name for t in tools]}")
    return tools
```

**要点**：
- JSON Schema 到 Pydantic 的转换是核心难点，必须正确处理类型映射（string→str, integer→int）和必填/可选字段
- 工具列表可能在运行时变化（Server 发送 listChanged），需要支持刷新缓存
- 常见错误：把 MCP Tool 的 description 原样传给 LLM 不做任何处理，导致 LLM 无法正确理解工具用途

### 练习二：MCP 到 OpenAI 格式的适配器

**思路**：OpenAI 的 function calling 格式要求 `type: "function"` + `function.name` + `function.parameters`。适配器需要把 MCP Tool 的 `inputSchema` 映射到 OpenAI 的 `parameters` 字段，同时处理调用结果的反向转换。

**答案**：
```python
import json

class MCPToOpenAIAdapter:
    def __init__(self, mcp_client):
        self.mcp_client = mcp_client

    async def get_openai_tools(self) -> list[dict]:
        mcp_tools = await self.mcp_client.list_tools()
        openai_tools = []
        for tool in mcp_tools:
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool.get("description", ""),
                    "parameters": tool.get("inputSchema", {
                        "type": "object",
                        "properties": {}
                    })
                }
            })
        return openai_tools

    async def execute_tool_call(self, tool_call: dict) -> dict:
        name = tool_call["function"]["name"]
        args = json.loads(tool_call["function"]["arguments"])

        result = await self.mcp_client.call_tool(name, args)

        texts = [item.get("text", "") for item in result if item.get("type") == "text"]
        return {
            "role": "tool",
            "tool_call_id": tool_call.get("id", ""),
            "content": "\n".join(texts)
        }

    def handle_tool_calls(self, message) -> list[dict]:
        results = []
        for tool_call in message.tool_calls:
            result = self.execute_tool_call(tool_call)
            results.append(result)
        return results
```

**要点**：
- OpenAI 的 `parameters` 就是 JSON Schema，与 MCP 的 `inputSchema` 格式一致，大部分情况可直接映射
- 调用结果必须包含 `tool_call_id`，OpenAI 需要它来匹配请求和响应
- 常见错误：不处理 `tool_call_id` 的关联，导致 OpenAI 无法把工具结果关联到正确的调用请求

### 练习三：多 Server 管理

**思路**：多 Server 管理的核心是维护 Server 到工具的索引，调用时自动路由到正确的 Server。需要处理：工具名冲突（用命名空间）、Server 故障转移（主备切换）、健康检查（定期探测）。

**答案**：
```python
import asyncio
import json

class MultiServerManager:
    def __init__(self):
        self.servers: dict[str, dict] = {}
        self.tool_index: dict[str, str] = {}
        self.healthy: dict[str, bool] = {}

    async def add_server(self, name: str, client, prefix: str = None):
        await client.initialize()
        tools = await client.list_tools()
        self.servers[name] = {"client": client, "tools": tools, "prefix": prefix or name}
        self.healthy[name] = True

        for tool in tools:
            prefixed_name = f"{prefix or name}:{tool['name']}"
            self.tool_index[prefixed_name] = name

    async def call_tool(self, tool_name: str, arguments: dict) -> str:
        server_name = self.tool_index.get(tool_name)
        if not server_name:
            raise ToolNotFoundError(f"工具 {tool_name} 未找到")

        if not self.healthy.get(server_name, False):
            raise ServerUnavailableError(f"Server {server_name} 不可用")

        server = self.servers[server_name]
        result = await server["client"].call_tool(
            tool_name.split(":", 1)[1], arguments
        )
        texts = [item.get("text", "") for item in result if item.get("type") == "text"]
        return "\n".join(texts)

    def list_all_tools(self) -> list[dict]:
        all_tools = []
        for server_name, server in self.servers.items():
            for tool in server["tools"]:
                prefixed = f"{server['prefix']}:{tool['name']}"
                all_tools.append({**tool, "name": prefixed, "server": server_name})
        return all_tools

    async def health_check(self):
        for name, server in self.servers.items():
            try:
                await asyncio.wait_for(server["client"].list_tools(), timeout=5.0)
                self.healthy[name] = True
            except Exception:
                self.healthy[name] = False

    def get_healthy_servers(self) -> list[str]:
        return [name for name, ok in self.healthy.items() if ok]

class ToolNotFoundError(Exception):
    pass

class ServerUnavailableError(Exception):
    pass
```

**要点**：
- 工具名用 `server:tool` 格式做命名空间，避免两个 Server 都有 `read_file` 时冲突
- 健康检查应异步执行，超时 5 秒标记为不健康，避免检查本身阻塞主流程
- 常见错误：直接用原始工具名做索引，两个 Server 有同名工具时后注册的会覆盖先注册的
