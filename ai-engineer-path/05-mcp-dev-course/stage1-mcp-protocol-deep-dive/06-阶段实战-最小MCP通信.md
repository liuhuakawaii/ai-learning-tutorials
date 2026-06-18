# 06 阶段实战——用原始 HTTP 请求实现一个最小 MCP 通信

> 动手实现一个最小的 MCP 通信，深入理解协议细节。

## 学习目标

- 用原始 HTTP 实现 MCP 通信
- 掌握 MCP 消息的构造和解析
- 完成一个可运行的 MCP 原型

---

## 一、Server 实现

```python
from flask import Flask, request, jsonify

app = Flask(__name__)

# 工具注册
tools = [
    {
        "name": "calculator",
        "description": "执行数学计算",
        "inputSchema": {
            "type": "object",
            "properties": {
                "expression": {"type": "string", "description": "数学表达式"}
            },
            "required": ["expression"]
        }
    }
]

@app.route("/mcp", methods=["POST"])
def handle_mcp():
    """处理 MCP 请求"""
    message = request.json
    
    method = message.get("method")
    params = message.get("params", {})
    request_id = message.get("id")
    
    if method == "initialize":
        return jsonify({
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "capabilities": {"tools": {"listChanged": True}},
                "serverInfo": {"name": "minimal-mcp-server", "version": "1.0.0"}
            }
        })
    
    elif method == "tools/list":
        return jsonify({
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {"tools": tools}
        })
    
    elif method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        
        if tool_name == "calculator":
            result = eval(arguments.get("expression", "0"))
            return jsonify({
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "content": [{"type": "text", "text": str(result)}]
                }
            })
    
    return jsonify({
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": -32601, "message": "Method not found"}
    })

if __name__ == "__main__":
    app.run(port=8080)
```

---

## 二、Client 实现

```python
import requests
import json

class MinimalMCPClient:
    """最小 MCP 客户端"""
    
    def __init__(self, server_url: str):
        self.server_url = server_url
        self.request_id = 0
    
    def _send_request(self, method: str, params: dict = None) -> dict:
        """发送请求"""
        self.request_id += 1
        
        message = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method
        }
        if params:
            message["params"] = params
        
        response = requests.post(self.server_url, json=message)
        return response.json()
    
    def initialize(self) -> dict:
        """初始化"""
        return self._send_request("initialize", {
            "capabilities": {"tools": {}}
        })
    
    def list_tools(self) -> list:
        """获取工具列表"""
        result = self._send_request("tools/list")
        return result.get("result", {}).get("tools", [])
    
    def call_tool(self, name: str, arguments: dict) -> str:
        """调用工具"""
        result = self._send_request("tools/call", {
            "name": name,
            "arguments": arguments
        })
        content = result.get("result", {}).get("content", [])
        return content[0].get("text", "") if content else ""

# 使用示例
client = MinimalMCPClient("http://localhost:8080/mcp")

# 初始化
client.initialize()

# 获取工具列表
tools = client.list_tools()
print(f"可用工具：{tools}")

# 调用工具
result = client.call_tool("calculator", {"expression": "2 + 3 * 4"})
print(f"计算结果：{result}")
```

---

## 三、运行测试

```bash
# 启动 Server
python server.py

# 运行 Client
python client.py

# 输出：
# 可用工具：[{'name': 'calculator', 'description': '执行数学计算', ...}]
# 计算结果：14
```

---

## 四、协议分析

```
完整的消息流：

1. 初始化
   Client → Server:
   {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {...}}
   
   Server → Client:
   {"jsonrpc": "2.0", "id": 1, "result": {"capabilities": {...}}}

2. 工具列表
   Client → Server:
   {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}
   
   Server → Client:
   {"jsonrpc": "2.0", "id": 2, "result": {"tools": [...]}}

3. 工具调用
   Client → Server:
   {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {...}}
   
   Server → Client:
   {"jsonrpc": "2.0", "id": 3, "result": {"content": [...]}}
```

---

## 小结

```
本课核心要点：

1. 用原始 HTTP 实现 MCP 通信
2. Server 处理 initialize、tools/list、tools/call
3. Client 构造和发送 MCP 请求
4. 理解完整的协议消息流

阶段总结：
  你已经深入理解了 MCP 协议的细节。
  下一阶段，我们将学习如何开发自定义 MCP Server。
```

---

## 作业

1. **完成实战**：运行本课的最小 MCP 示例。

2. **扩展题**：添加一个新的工具（如天气查询）。

3. **协议题**：用 Wireshark 或日志分析 MCP 消息流。
