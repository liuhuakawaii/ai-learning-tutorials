# Client 开发——实现自己的 MCP Client SDK

> 前置：第 3 阶段的高级 MCP 模式
> 课型：项目推进课

## 当前卡点

你用 Claude Desktop 测试了自己写的 MCP Server，效果很好。现在产品经理说要在公司的 Web 应用里集成这个 Server——但 Web 应用不能用 Claude Desktop，你需要自己实现 MCP Client。

Client 要能：初始化连接、发现工具、调用工具、处理错误，还要支持 stdio 和 HTTP 两种传输方式。

## 方案选择

### 方案 A：直接用官方 SDK 的 Client

Python MCP SDK 和 TypeScript MCP SDK 都提供了 Client 实现。

**问题**：SDK 的 Client 是为 Claude Desktop 这种桌面应用设计的，对 Web 应用的适配不够好（比如没有连接池、没有请求超时配置）。

### 方案 B：自己实现 Client

用 SDK 的传输层，自己写 Client 逻辑。

**好处**：完全控制初始化流程、错误处理、重试策略。可以针对 Web 场景做优化。

选择方案 B——先理解协议，再用 SDK 简化。

## 代码落地

### Client 核心：三个方法 + 传输层抽象

```python
import json
import asyncio

class MCPClient:
    def __init__(self, transport):
        self.transport = transport
        self.request_id = 0
        self.server_capabilities: dict = {}
        self.tools: list[dict] = []
        self._initialized = False

    async def initialize(self) -> dict:
        """初始化连接，交换能力信息"""
        result = await self._send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {"listChanged": True}},
            "clientInfo": {"name": "my-client", "version": "1.0.0"}
        })
        self.server_capabilities = result.get("capabilities", {})
        self._initialized = True
        await self._send_notification("notifications/initialized")
        return result

    async def list_tools(self) -> list[dict]:
        """获取 Server 暴露的工具列表"""
        self._ensure_initialized()
        result = await self._send_request("tools/list")
        self.tools = result.get("tools", [])
        return self.tools

    async def call_tool(self, name: str, arguments: dict) -> list[dict]:
        """调用指定工具"""
        self._ensure_initialized()
        result = await self._send_request("tools/call", {
            "name": name,
            "arguments": arguments
        })
        return result.get("content", [])

    def _ensure_initialized(self):
        if not self._initialized:
            raise RuntimeError("Client 未初始化，请先调用 initialize()")

    async def _send_request(self, method: str, params: dict = None) -> dict:
        self.request_id += 1
        message = {"jsonrpc": "2.0", "id": self.request_id, "method": method}
        if params:
            message["params"] = params
        response = await self.transport.send_and_receive(message)
        if "error" in response:
            err = response["error"]
            raise MCPError(err.get("code", -1), err.get("message", "未知错误"))
        return response.get("result", {})

    async def _send_notification(self, method: str, params: dict = None):
        message = {"jsonrpc": "2.0", "method": method}
        if params:
            message["params"] = params
        await self.transport.send(message)

class MCPError(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        super().__init__(message)
```

### 传输层：策略模式

```python
import aiohttp

class StdioTransport:
    """通过子进程的 stdin/stdout 通信"""
    def __init__(self, command: str, args: list[str] = None):
        self.command = command
        self.args = args or []
        self._process = None

    async def start(self):
        self._process = await asyncio.create_subprocess_exec(
            self.command, *self.args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE
        )

    async def send_and_receive(self, message: dict) -> dict:
        line = json.dumps(message) + "\n"
        self._process.stdin.write(line.encode())
        await self._process.stdin.drain()
        response_line = await self._process.stdout.readline()
        return json.loads(response_line)

    async def send(self, message: dict):
        line = json.dumps(message) + "\n"
        self._process.stdin.write(line.encode())
        await self._process.stdin.drain()

class HTTPTransport:
    """通过 HTTP POST 通信"""
    def __init__(self, url: str, timeout: float = 30.0):
        self.url = url
        self.timeout = timeout
        self._session = None

    async def start(self):
        self._session = aiohttp.ClientSession()

    async def send_and_receive(self, message: dict) -> dict:
        async with self._session.post(
            self.url, json=message,
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        ) as resp:
            return await resp.json()

    async def send(self, message: dict):
        await self._session.post(self.url, json=message)
```

### 使用示例

```python
async def main():
    # 方式 1：连接本地 Server（stdio）
    transport = StdioTransport("python", ["server.py"])
    await transport.start()
    client = MCPClient(transport)

    # 方式 2：连接远程 Server（HTTP）
    # transport = HTTPTransport("http://localhost:8080/mcp")
    # await transport.start()
    # client = MCPClient(transport)

    # 初始化
    info = await client.initialize()
    print(f"连接到: {info.get('serverInfo', {}).get('name')}")

    # 发现工具
    tools = await client.list_tools()
    for t in tools:
        print(f"  {t['name']}: {t['description']}")

    # 调用工具
    result = await client.call_tool("calculator", {"expression": "2 + 3"})
    print(f"结果: {result[0]['text']}")

asyncio.run(main())
```

## 验证

```bash
# 1. 启动 MCP Server
python server.py &

# 2. 运行 Client
python client.py

# 预期输出：
# 连接到: my-server
#   calculator: 执行数学计算
# 结果: 5
```

## 复盘：关键判断

### 1. initialize 之后必须发 notifications/initialized

MCP 协议规定：Client 发送 `initialize` 请求，收到 Server 响应后，必须发送 `notifications/initialized` 通知。这个通知告诉 Server："我已经准备好了，可以开始处理请求了。"

有些 Server 会在收到这个通知之前拒绝处理 `tools/list` 和 `tools/call`。

### 2. 传输层要抽象

`StdioTransport` 和 `HTTPTransport` 实现同一个接口（`send_and_receive` + `send`）。Client 不关心底层是哪种传输方式——换传输方式只需要替换 transport 对象。

这就是策略模式。不是为了设计模式而设计模式，是因为 stdio 和 HTTP 的通信方式确实不同：
- stdio：子进程的 stdin/stdout，持续连接
- HTTP：每次请求一个 POST，无状态

### 3. 错误要分层

```
传输层错误：网络断连、超时
  → Client 应该重试

协议层错误：JSON-RPC error（-32601 Method not found）
  → Client 应该抛出 MCPError

工具层错误：Tool 执行失败（result.isError = true）
  → Client 应该把错误信息传给 Host
```

不要把所有错误都当成一种处理。网络超时可以重试，参数错误重试没有意义。

### 4. 并发调用要匹配 id

如果 Host 同时发起多个 `call_tool` 请求，Client 要能正确匹配每个响应和请求。JSON-RPC 的 `id` 字段就是干这个的。

```
Client 发送: {"id": 1, "method": "tools/call", ...}
Client 发送: {"id": 2, "method": "tools/call", ...}
Server 返回: {"id": 2, "result": ...}  ← 先返回 id 2
Server 返回: {"id": 1, "result": ...}  ← 后返回 id 1
```

Client 不能假设响应顺序和请求顺序一致。用 `id` 匹配，或者用 `asyncio.Future` 做异步等待。

## 练习

### 练习一：添加超时和重试

为 `send_request` 添加：
- 请求超时（默认 30 秒）
- 失败重试（最多 3 次，指数退避）
- 区分可重试错误（网络超时）和不可重试错误（参数错误）

### 练习二：添加工具列表缓存

Client 初始化时获取工具列表并缓存。当 Server 发送 `notifications/tools/listChanged` 通知时刷新缓存。

```python
# 提示：在传输层监听通知
# 通知没有 id，可以通过这个特征区分请求和通知
```

### 练习三：用 MockTransport 测试

不用真实 Server，写一个 `MockTransport` 类来测试 Client 的完整流程：

```python
class MockTransport:
    async def send_and_receive(self, message):
        # 根据 method 返回预设的响应
        ...
    async def send(self, message):
        pass
```

验证：initialize → list_tools → call_tool 的完整流程能跑通。

---

## 参考答案

### 练习一

```python
async def _send_request(self, method: str, params: dict = None,
                        timeout: float = 30.0, max_retries: int = 3) -> dict:
    last_error = None
    for attempt in range(max_retries):
        try:
            self.request_id += 1
            message = {"jsonrpc": "2.0", "id": self.request_id, "method": method}
            if params:
                message["params"] = params

            response = await asyncio.wait_for(
                self.transport.send_and_receive(message),
                timeout=timeout
            )

            if "error" in response:
                err = response["error"]
                code = err.get("code", -1)
                # -32600 Invalid Request, -32601 Method Not Found, -32602 Invalid Params → 不重试
                if code in (-32600, -32601, -32602):
                    raise MCPError(code, err.get("message", ""))
                # 其他错误可以重试
                last_error = MCPError(code, err.get("message", ""))
                continue

            return response.get("result", {})

        except asyncio.TimeoutError:
            last_error = MCPError(-1, f"请求超时（{timeout}秒）")
        except ConnectionError as e:
            last_error = MCPError(-1, f"连接断开: {e}")

        if attempt < max_retries - 1:
            await asyncio.sleep(2 ** attempt)

    raise last_error
```

### 练习二

```python
class MCPClient:
    def __init__(self, transport):
        # ... 原有属性 ...
        self._notification_handlers = {
            "notifications/tools/listChanged": self._handle_tools_changed
        }

    async def _handle_tools_changed(self):
        """Server 通知工具列表变化，刷新缓存"""
        if self._initialized:
            await self.list_tools()

    async def _listen_for_notifications(self):
        """监听 Server 推送的通知"""
        while True:
            try:
                message = await self.transport.receive()
                if "id" not in message:  # 通知没有 id
                    method = message.get("method")
                    handler = self._notification_handlers.get(method)
                    if handler:
                        await handler()
            except Exception:
                break
```

### 练习三

```python
class MockTransport:
    def __init__(self):
        self.sent_messages = []

    async def send_and_receive(self, message: dict) -> dict:
        self.sent_messages.append(message)
        method = message["method"]
        req_id = message.get("id")

        if method == "initialize":
            return {"jsonrpc": "2.0", "id": req_id, "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "mock-server", "version": "1.0.0"}
            }}
        elif method == "tools/list":
            return {"jsonrpc": "2.0", "id": req_id, "result": {
                "tools": [{"name": "echo", "description": "回显输入", "inputSchema": {"type": "object", "properties": {"text": {"type": "string"}}}}]
            }}
        elif method == "tools/call":
            args = message["params"]["arguments"]
            return {"jsonrpc": "2.0", "id": req_id, "result": {
                "content": [{"type": "text", "text": args.get("text", "")}]
            }}
        return {"jsonrpc": "2.0", "id": req_id, "result": {}}

    async def send(self, message: dict):
        self.sent_messages.append(message)

async def test_client():
    transport = MockTransport()
    client = MCPClient(transport)

    info = await client.initialize()
    assert info["serverInfo"]["name"] == "mock-server"
    assert client._initialized is True

    tools = await client.list_tools()
    assert len(tools) == 1
    assert tools[0]["name"] == "echo"

    result = await client.call_tool("echo", {"text": "hello"})
    assert result[0]["text"] == "hello"

    # 验证 notifications/initialized 被发送
    assert any(m.get("method") == "notifications/initialized" for m in transport.sent_messages)

    print("所有测试通过")

asyncio.run(test_client())
```
