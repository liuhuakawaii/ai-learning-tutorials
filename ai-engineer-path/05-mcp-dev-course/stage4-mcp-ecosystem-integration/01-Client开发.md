# 01 Client 开发——实现自己的 MCP Client SDK

> 开发自己的 MCP Client，让你的应用能够调用任何 MCP Server。

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

---

## 小结

```
本课核心要点：

1. MCP Client 负责与 Server 通信
2. 支持多种传输层：stdio、HTTP
3. 核心功能：初始化、工具列表、工具调用
4. 要处理连接错误和调用错误

下一课：Agent 集成——将 MCP Tool 接入 LangGraph / OpenAI Agents SDK。
```

---

## 练习

1. **实现题**：实现一个基础的 MCP Client。

2. **传输题**：实现 HTTP 传输层。

3. **错误题**：完善错误处理机制。
