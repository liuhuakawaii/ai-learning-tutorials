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
