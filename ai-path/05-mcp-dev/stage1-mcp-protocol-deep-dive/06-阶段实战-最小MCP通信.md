# 06 阶段实战——用原始 HTTP 请求实现一个最小 MCP 通信

> 动手实现一个最小的 MCP 通信，深入理解协议细节。

## 场景引入

学了 MCP 协议的消息格式、传输层和能力协商，但总觉得隔着一层。Inspector 能连上 Server，但你不知道 Inspector 到底发了什么消息；SDK 能工作，但封装得太深看不到协议细节。你想从零开始，用最原始的 HTTP 请求手动构造一条 MCP 消息，亲手发给 Server，看看完整的请求和响应到底长什么样。只有这样，你才能真正理解协议的每一层在做什么。

---

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
            # 用 ast.literal_eval 替代 eval()，防止代码注入
            import ast, operator
            expression = arguments.get("expression", "0")
            # 只允许数字和基本算术运算
            allowed_ops = {ast.Add: operator.add, ast.Sub: operator.sub,
                          ast.Mult: operator.mul, ast.Div: operator.truediv}
            def safe_eval(node):
                if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
                    return node.value
                elif isinstance(node, ast.BinOp) and type(node.op) in allowed_ops:
                    return allowed_ops[type(node.op)](safe_eval(node.left), safe_eval(node.right))
                elif isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
                    return -safe_eval(node.operand)
                raise ValueError(f"不支持的表达式: {expression}")
            result = safe_eval(ast.parse(expression, mode='eval').body)
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

## 常见误区

```
误区 1：最小实现就是 Hello World
  最小 MCP 实现必须包含 initialize → tools/list → tools/call 三个阶段。
  跳过初始化直接调用工具，不符合协议规范，大多数 Client 会拒绝连接。

误区 2：用 eval() 处理用户输入的表达式
  即使是教学示例，也不能用 eval() 处理用户输入。
  用 ast.literal_eval 或自己写的解析器，养成安全编码的习惯。

误区 3：Server 返回错误就完事了
  错误响应要包含有意义的错误码和错误信息。
  不要所有错误都返回 -32603 Internal error，Client 无法区分错误类型。

误区 4：测试只需要跑通 happy path
  必须测试边界情况：空输入、非法参数、未知方法、超长消息。
  这些才是生产环境中最常见的问题。
```

---

## 工程建议

```
1. 先用 curl 手动测试
   在写 Client 代码之前，先用 curl 发送 JSON-RPC 请求。
   这样可以隔离 Server 的问题和 Client 的问题。

2. 把消息流打印到日志
   在 Server 的入口和出口打印完整的请求和响应消息。
   调试 MCP 问题时，消息流日志是最有价值的排查工具。

3. 从 HTTP 迁移到 stdio 很容易
   最小实现用 HTTP 是为了方便测试，但生产环境通常用 stdio。
   消息格式完全一样，只是传输方式不同。

4. 为 final-project 打基础
   这个最小实现是你后续所有 MCP Server 开发的基础模板。
   把它保存好，后面的课程会在此基础上逐步扩展。
```

---

## 小结

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
