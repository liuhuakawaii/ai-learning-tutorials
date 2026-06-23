# 阶段实战——用原始 HTTP 实现一个最小 MCP 通信

> 课型：练习复盘课
> 目标：不用 SDK，从零构造 MCP 消息，理解协议的每一层

## 任务说明

用 Python（Flask 或 http.server）实现一个最小 MCP Server，用 `requests` 实现 Client。整个过程不用任何 MCP SDK，只用标准库和 Flask。

要求：
- Server 支持 `initialize`、`tools/list`、`tools/call` 三个方法
- Server 暴露一个 `calculator` 工具
- Client 完成完整的初始化 → 发现 → 调用流程
- 所有消息都是标准 JSON-RPC 2.0 格式

## 实现路径

### 第一步：Server 端——手动处理 JSON-RPC

```python
from flask import Flask, request, jsonify
import ast, operator

app = Flask(__name__)

TOOLS = [
    {
        "name": "calculator",
        "description": "执行数学计算。仅支持加减乘除，不支持函数调用。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "expression": {"type": "string", "description": "数学表达式，如 '2 + 3 * 4'"}
            },
            "required": ["expression"]
        }
    }
]

SAFE_OPS = {
    ast.Add: operator.add, ast.Sub: operator.sub,
    ast.Mult: operator.mul, ast.Div: operator.truediv,
}

def safe_eval(expr: str) -> float:
    """安全的表达式求值——只允许数字和四则运算"""
    def _eval(node):
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in SAFE_OPS:
            return SAFE_OPS[type(node.op)](_eval(node.left), _eval(node.right))
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
            return -_eval(node.operand)
        raise ValueError(f"不支持的表达式: {expr}")
    return _eval(ast.parse(expr, mode='eval').body)

def jsonrpc_ok(req_id, result):
    return jsonify({"jsonrpc": "2.0", "id": req_id, "result": result})

def jsonrpc_error(req_id, code, message):
    return jsonify({"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}})

@app.route("/mcp", methods=["POST"])
def handle_mcp():
    msg = request.json
    method = msg.get("method")
    params = msg.get("params", {})
    req_id = msg.get("id")

    if method == "initialize":
        return jsonrpc_ok(req_id, {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {"listChanged": True}},
            "serverInfo": {"name": "minimal-mcp", "version": "0.1.0"}
        })

    if method == "notifications/initialized":
        return "", 204

    if method == "tools/list":
        return jsonrpc_ok(req_id, {"tools": TOOLS})

    if method == "tools/call":
        tool_name = params.get("name")
        args = params.get("arguments", {})
        if tool_name != "calculator":
            return jsonrpc_error(req_id, -32601, f"未知工具: {tool_name}")
        try:
            result = safe_eval(args.get("expression", "0"))
            return jsonrpc_ok(req_id, {"content": [{"type": "text", "text": str(result)}]})
        except Exception as e:
            return jsonrpc_ok(req_id, {
                "content": [{"type": "text", "text": f"计算错误: {e}"}],
                "isError": True
            })

    return jsonrpc_error(req_id, -32601, f"未知方法: {method}")

if __name__ == "__main__":
    app.run(port=8080)
```

### 第二步：Client 端——手动构造请求

```python
import requests

SERVER_URL = "http://localhost:8080/mcp"
request_id = 0

def send(method, params=None):
    global request_id
    request_id += 1
    msg = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params:
        msg["params"] = params
    resp = requests.post(SERVER_URL, json=msg)
    return resp.json()

# 1. 初始化
init_result = send("initialize", {
    "protocolVersion": "2024-11-05",
    "capabilities": {"tools": {}},
    "clientInfo": {"name": "my-client", "version": "0.1.0"}
})
print(f"Server: {init_result['result']['serverInfo']['name']}")

# 2. 通知 Server 客户端就绪
send("notifications/initialized")

# 3. 发现工具
tools_result = send("tools/list")
for tool in tools_result["result"]["tools"]:
    print(f"  工具: {tool['name']} - {tool['description']}")

# 4. 调用工具
call_result = send("tools/call", {
    "name": "calculator",
    "arguments": {"expression": "2 + 3 * 4"}
})
print(f"结果: {call_result['result']['content'][0]['text']}")
```

### 第三步：验证

```bash
# 终端 1：启动 Server
python server.py

# 终端 2：运行 Client
python client.py
# 输出：
# Server: minimal-mcp
#   工具: calculator - 执行数学计算。仅支持加减乘除，不支持函数调用。
# 结果: 14
```

## 复盘：关键判断

### 1. initialize 必须在 tools/list 之前

MCP 协议规定：Client 必须先发送 `initialize`，Server 返回能力信息后，Client 发送 `notifications/initialized`，之后才能调用其他方法。这不是形式主义——`initialize` 阶段双方交换能力信息，决定了后续哪些方法可用。

如果跳过初始化直接调 `tools/list`，规范的 Server 会返回错误。

### 2. notifications/initialized 没有 id

通知（notification）是不需要响应的消息。JSON-RPC 2.0 规定：有 `id` 的是请求，没 `id` 的是通知。`notifications/initialized` 是通知，所以没有 `id` 字段，Server 也不返回响应。

### 3. tools/call 的错误要走 result，不是 error

Tool 执行失败（比如表达式语法错误）应该在 `result` 里返回 `isError: true`，而不是返回 JSON-RPC error。JSON-RPC error 是协议层的错误（方法不存在、参数格式错误），Tool 执行失败是业务层的错误。

```
协议层错误 → 返回 error 字段
  {"jsonrpc": "2.0", "id": 1, "error": {"code": -32601, "message": "Method not found"}}

业务层错误 → 返回 result 字段 + isError
  {"jsonrpc": "2.0", "id": 1, "result": {"content": [...], "isError": true}}
```

### 4. safe_eval 为什么不用 eval()

`eval()` 会执行任意 Python 代码。用户传入 `__import__('os').system('rm -rf /')` 就能删掉你的服务器。用 `ast.parse` + 白名单操作符，只允许数字和四则运算。

这不是"最佳实践"，是安全底线。生产环境的 MCP Server 处理的是真实系统能力（数据库、文件系统、API），输入校验比这个例子严格得多。

## 常见错误

| 错误 | 现象 | 原因 |
|------|------|------|
| 跳过初始化 | Server 返回 -32600 | 没发 initialize 就调 tools/list |
| 把通知当请求 | Client 等响应超时 | notifications/initialized 没有 id，不该等响应 |
| Tool 错误返回 error | Client 认为协议出错 | 业务错误应该返回 result + isError |
| 用 eval() | 服务器被入侵 | 用户输入恶意代码直接执行 |
| 不处理未知方法 | Server 返回 None | method 不在已知列表里要返回 -32601 |

## 练习

### 练习一：添加一个新 Tool

在 Server 中添加一个 `weather` Tool，接受 `city` 参数，返回 Mock 天气数据。要求：
- 用真实的城市-温度映射（不要随机数）
- description 写清楚 Tool 做什么、什么时候用、有什么限制
- Client 能正确发现并调用这个 Tool

### 练习二：测试边界情况

用 curl 或修改 Client 代码，测试以下场景，记录 Server 的响应：

1. 发送一个不存在的 method（如 `"method": "tools/delete"`）
2. 发送缺少 `method` 字段的请求
3. 调用 calculator 时传入 `{"expression": "__import__('os')"}`
4. 调用 calculator 时传入空字符串
5. 连续快速发送 10 个请求

### 练习三：添加日志

在 Server 的 `handle_mcp` 函数入口和出口打印完整的请求和响应消息。然后重新运行 Client，观察消息流。

```python
# 提示：在 handle_mcp 开头加
print(f">>> {request.json}")

# 在返回前加
print(f"<<< {response.get_json()}")
```

回答：从日志中能看到 MCP 协议的哪些设计细节？

---

## 参考答案

### 练习一

```python
# 添加到 TOOLS 列表
{
    "name": "weather",
    "description": "查询城市天气。返回当前温度和天气状况。仅支持中国主要城市。",
    "inputSchema": {
        "type": "object",
        "properties": {
            "city": {"type": "string", "description": "城市名称，如 '北京'、'上海'"}
        },
        "required": ["city"]
    }
}

# 添加到 handle_mcp 的 tools/call 分支
WEATHER_DATA = {"北京": "晴 25°C", "上海": "多云 22°C", "深圳": "阵雨 28°C"}

if tool_name == "weather":
    city = args.get("city", "")
    weather = WEATHER_DATA.get(city)
    if weather:
        return jsonrpc_ok(req_id, {"content": [{"type": "text", "text": weather}]})
    return jsonrpc_ok(req_id, {
        "content": [{"type": "text", "text": f"不支持的城市: {city}"}],
        "isError": True
    })
```

### 练习二

| 测试 | 预期响应 | 错误码 |
|------|----------|--------|
| 不存在的 method | `error: {"code": -32601}` | -32601 Method not found |
| 缺少 method | `error: {"code": -32600}` | -32600 Invalid request |
| 危险表达式 | `error: {"code": -32602}` 或计算错误 | 取决于实现 |
| 空字符串 | `result: "0"` 或计算错误 | 取决于 safe_eval 实现 |
| 连续 10 个请求 | 全部正常返回 | 无错误 |

### 练习三

日志中能看到的设计细节：
1. `initialize` 的请求和响应都有 `id`，是标准请求-响应模式
2. `notifications/initialized` 没有 `id`，Server 不返回响应
3. 每个请求的 `id` 是递增的，用于匹配请求和响应
4. `tools/call` 的参数结构是 `{name, arguments}`，不是直接传参数
5. 错误响应和成功响应不能同时存在（有 `result` 就没 `error`）
