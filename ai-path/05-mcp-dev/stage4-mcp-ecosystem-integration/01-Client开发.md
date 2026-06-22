# 01 Client 开发——实现自己的 MCP Client SDK

> 开发自己的 MCP Client，让你的应用能够调用任何 MCP Server。

## 场景引入

你用 Claude Desktop 测试了自己写的 MCP Server，效果很好。现在产品经理说要在公司的 Web 应用里集成这个 Server——但 Web 应用不能用 Claude Desktop，你需要自己实现 MCP Client。Client 要能初始化连接、发现工具、调用工具、处理错误，还要支持 stdio 和 HTTP 两种传输方式。从零写一个 Client SDK，该从哪里开始？

---

## 学习目标

- 掌握 MCP Client 的开发方法
- 理解 Client 的初始化和工具调用流程
- 学会实现一个完整的 Client SDK

---

## 一、Client 架构

```python
class MCPClient:
    """MCP Client"""
    
    def __init__(self, transport):
        self.transport = transport
        self.request_id = 0
        self.tools = []
    
    async def initialize(self):
        """初始化连接"""
        response = await self._send_request("initialize", {
            "capabilities": {"tools": {}}
        })
        return response
    
    async def list_tools(self) -> list:
        """获取工具列表"""
        response = await self._send_request("tools/list")
        self.tools = response.get("result", {}).get("tools", [])
        return self.tools
    
    async def call_tool(self, name: str, arguments: dict) -> str:
        """调用工具"""
        response = await self._send_request("tools/call", {
            "name": name,
            "arguments": arguments
        })
        content = response.get("result", {}).get("content", [])
        return content[0].get("text", "") if content else ""
    
    async def _send_request(self, method: str, params: dict = None) -> dict:
        """发送请求"""
        self.request_id += 1
        message = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method
        }
        if params:
            message["params"] = params
        
        return await self.transport.send_and_receive(message)
```

---

## 二、传输层适配

```python
class StdioTransport:
    """stdio 传输"""
    
    def __init__(self, process):
        self.process = process
    
    async def send_and_receive(self, message: dict) -> dict:
        """发送并接收"""
        # 发送
        json_str = json.dumps(message) + "\n"
        self.process.stdin.write(json_str.encode())
        await self.process.stdin.drain()
        
        # 接收
        line = await self.process.stdout.readline()
        return json.loads(line)

class HTTPTransport:
    """HTTP 传输"""
    
    def __init__(self, url: str):
        self.url = url
    
    async def send_and_receive(self, message: dict) -> dict:
        """发送并接收"""
        async with aiohttp.ClientSession() as session:
            async with session.post(self.url, json=message) as response:
                return await response.json()
```

---

## 三、使用示例

```python
async def main():
    # 创建传输层
    process = await asyncio.create_subprocess_exec(
        "python", "server.py",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE
    )
    transport = StdioTransport(process)
    
    # 创建 Client
    client = MCPClient(transport)
    
    # 初始化
    await client.initialize()
    
    # 获取工具列表
    tools = await client.list_tools()
    print(f"可用工具：{tools}")
    
    # 调用工具
    result = await client.call_tool("calculator", {"expression": "2+3"})
    print(f"结果：{result}")
```

---

## 四、错误处理

```python
class MCPClientError(Exception):
    """MCP Client 错误"""
    pass

class MCPClient:
    async def call_tool(self, name: str, arguments: dict) -> str:
        """调用工具（带错误处理）"""
        response = await self._send_request("tools/call", {
            "name": name,
            "arguments": arguments
        })
        
        if "error" in response:
            error = response["error"]
            raise MCPClientError(f"工具调用失败：{error['message']}")
        
        content = response.get("result", {}).get("content", [])
        return content[0].get("text", "") if content else ""
```

## 常见误区

```
误区 1：Client 就是发 HTTP 请求
  Client 不只是发请求，还要处理能力协商、工具发现、错误转换、连接管理。
  只发 HTTP 请求只是传输层，不等于完整的 Client。

误区 2：list_tools 只需要调一次
  Tool 列表可能在运行时变化（Server 发送 listChanged 通知）。
  Client 应该监听通知，及时更新本地缓存的工具列表。

误区 3：错误处理是 Server 的事
  Client 也要做错误处理：网络断连要重连、超时要重试、协议错误要转换。
  Server 返回的 JSON-RPC 错误码要转换为对 Host 友好的异常。

误区 4：Client 不需要处理并发
  如果 Host 同时发起多个工具调用，Client 要能正确匹配请求和响应。
  用 request_id 匹配，不能假设响应顺序和请求顺序一致。
```

---

## 工程建议

```
1. 传输层用策略模式
  把 stdio、HTTP、SSE 封装为不同的传输策略，Client 通过接口调用。
  这样切换传输方式只需要替换策略，不需要改 Client 代码。

2. 超时和重试是 Client 的责任
  Client 发送请求时设置超时（如 30 秒），超时后自动重试（最多 3 次）。
  Server 不需要知道 Client 在重试。

3. 工具列表要缓存和刷新
  初始化时获取工具列表并缓存。收到 listChanged 通知时刷新缓存。
  缓存避免每次调用前都请求工具列表。

4. 提供同步和异步两种 API
  某些 Host（如命令行工具）需要同步调用，Web 应用需要异步调用。
  底层用异步实现，同步 API 用事件循环包装。
```

---

## 小结

1. MCP Client 负责与 Server 通信
2. 支持多种传输层：stdio、HTTP
3. 核心功能：初始化、工具列表、工具调用
4. 要处理连接错误和调用错误

---

**下一课**: [02 Agent 集成——将 MCP Tool 接入 LangGraph / OpenAI Agents SDK](./02-Agent集成.md)
```

---

## 练习

1. **实现题**：实现一个基础的 MCP Client。

2. **传输题**：实现 HTTP 传输层。

3. **错误题**：完善错误处理机制。

---

## 参考答案

### 练习一：基础 MCP Client

**思路**：MCP Client 的核心是通过传输层与 Server 通信，维护请求 ID 自增，实现 initialize → list_tools → call_tool 的标准流程。关键是用抽象传输层隔离底层协议（stdio/HTTP），Client 本身只关心 JSON-RPC 消息的构造和解析。

**答案**：
```python
import json
import asyncio
import uuid

class MCPClient:
    def __init__(self, transport):
        self.transport = transport
        self.request_id = 0
        self.tools: list[dict] = []
        self.server_capabilities: dict = {}
        self._initialized = False

    async def initialize(self) -> dict:
        response = await self._send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {"listChanged": True}},
            "clientInfo": {"name": "my-mcp-client", "version": "1.0.0"}
        })
        self.server_capabilities = response.get("result", {}).get("capabilities", {})
        self._initialized = True
        await self._send_notification("notifications/initialized", {})
        return response.get("result", {})

    async def list_tools(self) -> list[dict]:
        self._ensure_initialized()
        response = await self._send_request("tools/list")
        self.tools = response.get("result", {}).get("tools", [])
        return self.tools

    async def call_tool(self, name: str, arguments: dict) -> list[dict]:
        self._ensure_initialized()
        response = await self._send_request("tools/call", {
            "name": name,
            "arguments": arguments
        })
        if "error" in response:
            raise MCPClientError(response["error"]["message"])
        return response.get("result", {}).get("content", [])

    def _ensure_initialized(self):
        if not self._initialized:
            raise MCPClientError("Client 未初始化，请先调用 initialize()")

    async def _send_request(self, method: str, params: dict = None) -> dict:
        self.request_id += 1
        message = {"jsonrpc": "2.0", "id": self.request_id, "method": method}
        if params:
            message["params"] = params
        return await self.transport.send_and_receive(message)

    async def _send_notification(self, method: str, params: dict = None):
        message = {"jsonrpc": "2.0", "method": method}
        if params:
            message["params"] = params
        await self.transport.send(message)

class MCPClientError(Exception):
    pass

class MockTransport:
    async def send_and_receive(self, message: dict) -> dict:
        if message["method"] == "initialize":
            return {"jsonrpc": "2.0", "id": message["id"], "result": {"capabilities": {"tools": {}}}}
        elif message["method"] == "tools/list":
            return {"jsonrpc": "2.0", "id": message["id"], "result": {"tools": [
                {"name": "calculator", "description": "计算数学表达式", "inputSchema": {"type": "object", "properties": {"expression": {"type": "string"}}}}
            ]}}
        elif message["method"] == "tools/call":
            return {"jsonrpc": "2.0", "id": message["id"], "result": {"content": [{"type": "text", "text": "5"}]}}
        return {"jsonrpc": "2.0", "id": message["id"], "result": {}}

    async def send(self, message: dict):
        pass

async def main():
    transport = MockTransport()
    client = MCPClient(transport)
    await client.initialize()
    tools = await client.list_tools()
    print(f"可用工具：{[t['name'] for t in tools]}")
    result = await client.call_tool("calculator", {"expression": "2+3"})
    print(f"结果：{result[0]['text']}")

asyncio.run(main())
```

**要点**：
- Client 必须在 `initialize` 成功后才能调用 `list_tools` 和 `call_tool`，否则协议状态不确定
- `initialize` 后必须发送 `notifications/initialized` 通知，告知 Server 客户端已就绪
- 常见错误：省略 `notifications/initialized` 步骤，某些 Server 会拒绝在收到该通知前处理请求

### 练习二：HTTP 传输层

**思路**：HTTP 传输层把 JSON-RPC 消息通过 POST 请求发送到 Server 的 endpoint。关键是处理：请求超时、连接错误、非 200 响应、JSON 解析失败。传输层应该对 Client 透明，Client 不需要知道底层是 HTTP 还是 stdio。

**答案**：
```python
import json
import asyncio

class HTTPTransport:
    def __init__(self, url: str, timeout: float = 30.0, max_retries: int = 3):
        self.url = url
        self.timeout = timeout
        self.max_retries = max_retries

    async def send_and_receive(self, message: dict) -> dict:
        import aiohttp
        last_error = None

        for attempt in range(self.max_retries):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        self.url,
                        json=message,
                        timeout=aiohttp.ClientTimeout(total=self.timeout),
                        headers={"Content-Type": "application/json"}
                    ) as response:
                        if response.status != 200:
                            raise TransportError(f"HTTP {response.status}: {await response.text()}")
                        return await response.json()
            except aiohttp.ClientError as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
            except json.JSONDecodeError as e:
                raise TransportError(f"响应不是有效 JSON：{e}")

        raise TransportError(f"请求失败（已重试 {self.max_retries} 次）：{last_error}")

    async def send(self, message: dict):
        import aiohttp
        async with aiohttp.ClientSession() as session:
            await session.post(self.url, json=message)

class TransportError(Exception):
    pass
```

**要点**：
- 传输层必须实现超时机制，否则 Server 无响应时 Client 会永久挂起
- 指数退避重试（`2 ** attempt`）避免重试风暴压垮已过载的 Server
- 常见错误：把 HTTP 状态码和 JSON-RPC 错误码混为一谈；HTTP 200 可能包含 JSON-RPC error，需要分别处理

### 练习三：完善错误处理机制

**思路**：Client 端的错误处理分为四层：传输层错误（网络断连、超时）、协议层错误（JSON-RPC 错误码）、工具层错误（Tool 执行失败）、业务层错误（参数校验）。每层错误都应转换为对 Host 友好的异常，附带可重试标志。

**答案**：
```python
import json
import asyncio
from enum import Enum

class ErrorCode(Enum):
    PARSE_ERROR = -32700
    INVALID_REQUEST = -32600
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    INTERNAL_ERROR = -32603
    TOOL_NOT_FOUND = -32000
    TOOL_EXECUTION_ERROR = -32001

class MCPClientError(Exception):
    def __init__(self, message: str, code: int = None, retryable: bool = False):
        self.code = code
        self.retryable = retryable
        super().__init__(message)

class RobustMCPClient:
    def __init__(self, transport, timeout: float = 30.0, max_retries: int = 3):
        self.transport = transport
        self.timeout = timeout
        self.max_retries = max_retries
        self.request_id = 0

    async def call_tool(self, name: str, arguments: dict) -> list[dict]:
        response = await self._send_with_retry("tools/call", {
            "name": name, "arguments": arguments
        })
        if "error" in response:
            error = response["error"]
            code = error.get("code", 0)
            message = error.get("message", "未知错误")
            retryable = code in (ErrorCode.INTERNAL_ERROR.value, -32002)
            raise MCPClientError(message, code=code, retryable=retryable)
        return response.get("result", {}).get("content", [])

    async def _send_with_retry(self, method: str, params: dict = None) -> dict:
        last_error = None
        for attempt in range(self.max_retries):
            try:
                return await asyncio.wait_for(
                    self._send_request(method, params),
                    timeout=self.timeout
                )
            except asyncio.TimeoutError:
                last_error = MCPClientError(f"请求超时（{self.timeout}秒）", retryable=True)
            except ConnectionError as e:
                last_error = MCPClientError(f"连接断开：{e}", retryable=True)
            except MCPClientError as e:
                if e.retryable and attempt < self.max_retries - 1:
                    last_error = e
                    await asyncio.sleep(2 ** attempt)
                    continue
                raise

            if attempt < self.max_retries - 1:
                await asyncio.sleep(2 ** attempt)

        raise last_error

    async def _send_request(self, method: str, params: dict = None) -> dict:
        self.request_id += 1
        message = {"jsonrpc": "2.0", "id": self.request_id, "method": method}
        if params:
            message["params"] = params
        return await self.transport.send_and_receive(message)
```

**要点**：
- 错误码 `-32603`（INTERNAL_ERROR）通常可重试，`-32602`（INVALID_PARAMS）不可重试；区分可重试和不可重试错误避免无意义重试
- 超时和连接错误默认可重试，但要限制最大重试次数，否则会无限循环
- 常见错误：所有错误都重试或都不重试；参数校验错误重试毫无意义，网络超时重试可能恢复
