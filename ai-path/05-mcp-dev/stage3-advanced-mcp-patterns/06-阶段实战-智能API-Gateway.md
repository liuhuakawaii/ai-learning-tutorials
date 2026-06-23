# 阶段实战——开发一个支持动态 Tool 的智能 API Gateway MCP Server

> 课型：项目推进课
> 目标：从 OpenAPI 规范自动生成 MCP Tool，支持运行时增删 API

## 当前卡点

公司有 20 个内部 REST API，你希望 AI 助手能调用它们。最笨的方法是为每个 API 手写一个 MCP Tool——但 API 会频繁增删改，每次变更都要改代码重新部署。

你想要一个"智能 API Gateway"：把 API 的 OpenAPI 规范喂给它，它自动生成 MCP Tool。API 变更时更新规范文件就行，不用改代码。

## 方案选择

### 方案 A：代码生成

用脚本从 OpenAPI 规范生成 Python/TypeScript 代码，然后部署。

**问题**：生成的代码还是需要部署。每次 API 变更都要重新生成、重新部署。

### 方案 B：运行时解析

Server 启动时读取 OpenAPI 规范，运行时动态注册 Tool。API 变更时重新读取规范即可。

**好处**：不需要重新部署。可以加一个 `reload_spec` Tool 让 AI 触发重新加载。

选择方案 B。

## 代码落地

### OpenAPI 规范解析

```python
import json
import yaml
from pathlib import Path
from mcp.types import Tool

def parse_openapi_spec(spec_path: str) -> list[dict]:
    """从 OpenAPI 规范提取 API 信息"""
    path = Path(spec_path)
    if path.suffix in (".yaml", ".yml"):
        with open(path) as f:
            spec = yaml.safe_load(f)
    else:
        with open(path) as f:
            spec = json.load(f)

    apis = []
    for path_str, methods in spec.get("paths", {}).items():
        for method, detail in methods.items():
            if method not in ("get", "post", "put", "delete", "patch"):
                continue
            apis.append({
                "path": path_str,
                "method": method.upper(),
                "operation_id": detail.get("operationId", f"{method}_{path_str}"),
                "summary": detail.get("summary", ""),
                "description": detail.get("description", ""),
                "parameters": extract_parameters(detail),
            })
    return apis

def extract_parameters(detail: dict) -> dict:
    """从 OpenAPI 操作提取 JSON Schema 格式的参数"""
    properties = {}
    required = []

    for param in detail.get("parameters", []):
        name = param["name"]
        schema = param.get("schema", {"type": "string"})
        properties[name] = {
            "type": schema.get("type", "string"),
            "description": param.get("description", ""),
        }
        if param.get("default") is not None:
            properties[name]["default"] = param["default"]
        if param.get("required"):
            required.append(name)

    # 请求体
    if "requestBody" in detail:
        body = detail["requestBody"].get("content", {}).get("application/json", {}).get("schema", {})
        if body.get("properties"):
            for name, prop in body["properties"].items():
                properties[name] = {
                    "type": prop.get("type", "string"),
                    "description": prop.get("description", ""),
                }

    return {"type": "object", "properties": properties, "required": required}

def api_to_tool(api: dict) -> Tool:
    """把 API 信息转成 MCP Tool"""
    name = api["operation_id"].replace("-", "_").replace("/", "_")
    description = api.get("summary") or api.get("description") or f"{api['method']} {api['path']}"
    description = f"{description}。方法: {api['method']}，路径: {api['path']}"

    return Tool(name=name, description=description, inputSchema=api["parameters"])
```

### 动态 Tool 注册

```python
from mcp.server import Server
from mcp.types import TextContent
import aiohttp

server = Server("api-gateway")
registry = {}  # name -> {tool, api_info}

def load_spec(spec_path: str):
    """加载 OpenAPI 规范并注册 Tool"""
    apis = parse_openapi_spec(spec_path)
    registry.clear()
    for api in apis:
        tool = api_to_tool(api)
        registry[tool.name] = {"tool": tool, "api": api}

@server.list_tools()
async def handle_list_tools():
    return [entry["tool"] for entry in registry.values()]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict):
    if name not in registry:
        raise ValueError(f"未知工具: {name}")

    api = registry[name]["api"]
    url = f"{BASE_URL}{api['path']}"
    method = api["method"]

    # 替换路径参数
    for key, value in arguments.items():
        url = url.replace(f"{{{key}}}", str(value))

    try:
        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, json=arguments, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                result = await resp.json()
                return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]
    except Exception as e:
        return [TextContent(type="text", text=f"API 调用失败: {e}")]

# 核心 Tool：运行时重新加载规范
@server.tool()
async def reload_api_spec(spec_path: str) -> list[TextContent]:
    """重新加载 API 规范文件。在 API 变更后调用。

    Args:
        spec_path: OpenAPI 规范文件路径（JSON 或 YAML）
    """
    try:
        load_spec(spec_path)
        return [TextContent(type="text", text=f"已加载 {len(registry)} 个 API")]
    except Exception as e:
        return [TextContent(type="text", text=f"加载失败: {e}")]
```

### 示例 OpenAPI 规范

```yaml
# apis.yaml
openapi: "3.0.0"
info:
  title: 内部 API
  version: "1.0"
servers:
  - url: http://localhost:3000
paths:
  /users:
    get:
      operationId: list_users
      summary: 获取用户列表
      parameters:
        - name: limit
          in: query
          schema: { type: integer, default: 20 }
          description: 返回数量上限
    post:
      operationId: create_user
      summary: 创建用户
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name: { type: string, description: 用户名 }
                email: { type: string, description: 邮箱 }
  /users/{user_id}:
    get:
      operationId: get_user
      summary: 获取单个用户
      parameters:
        - name: user_id
          in: path
          required: true
          schema: { type: string }
          description: 用户 ID
```

## 验证

```bash
# 1. 准备 OpenAPI 规范文件 apis.yaml
# 2. 启动 Server
mcp dev server.py

# 3. 在 Inspector 中：
#    - 调用 reload_api_spec 加载规范
#    - 调用 tools/list 看到自动生成的 Tool
#    - 调用 list_users 测试 API
```

## 复盘：关键判断

### 1. 自动生成的 description 不够好

OpenAPI 的 `summary` 往往是给开发者看的，不是给 AI 看的。AI 需要知道"什么时候用这个 Tool"。

解决：生成后人工优化 description，或者在 OpenAPI 规范里加 `x-mcp-description` 扩展字段。

### 2. 路径参数和查询参数要统一

OpenAPI 把参数分成 path/query/body，但 MCP Tool 只有一个 `arguments` 对象。解析时要把所有参数平铺到一个 JSON Schema 里。

### 3. 限流策略要分 Tool

查询类 API 可以放宽限制（每秒 100 次），写入类 API 要严格限流（每秒 10 次）。限流参数应该是配置项，不需要重新部署就能调整。

## 练习

### 练习一：添加请求体支持

当前实现只处理了 GET 请求和路径参数。为 POST/PUT 请求添加请求体支持：从 `arguments` 中提取请求体参数，放在 `json=` 参数里发送。

### 练习二：添加限流

为每个 API 添加独立的限流配置。在 OpenAPI 规范中用扩展字段指定：

```yaml
paths:
  /users:
    get:
      x-mcp-rate-limit: 100  # 每秒最多 100 次
    post:
      x-mcp-rate-limit: 10   # 每秒最多 10 次
```

实现限流逻辑，超限时返回友好提示。

### 练习三：端到端测试

1. 用 `http.server` 搭一个简单的 Mock API 服务
2. 写一个 OpenAPI 规范描述这个 Mock API
3. 启动 MCP Server 加载规范
4. 用 Inspector 调用自动生成的 Tool，验证请求能正确到达 Mock API

---

## 参考答案

### 练习一

在 `handle_call_tool` 中区分请求方法：

```python
@server.call_tool()
async def handle_call_tool(name: str, arguments: dict):
    if name not in registry:
        raise ValueError(f"未知工具: {name}")

    api = registry[name]["api"]
    url = f"{BASE_URL}{api['path']}"
    method = api["method"]

    # 分离路径参数和请求体
    path_params = {}
    body_params = {}
    for key, value in arguments.items():
        if f"{{{key}}}" in url:
            url = url.replace(f"{{{key}}}", str(value))
            path_params[key] = value
        else:
            body_params[key] = value

    try:
        async with aiohttp.ClientSession() as session:
            kwargs = {"timeout": aiohttp.ClientTimeout(total=30)}
            if method in ("POST", "PUT", "PATCH") and body_params:
                kwargs["json"] = body_params
            elif method == "GET" and body_params:
                kwargs["params"] = body_params

            async with session.request(method, url, **kwargs) as resp:
                result = await resp.json()
                return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]
    except Exception as e:
        return [TextContent(type="text", text=f"API 调用失败: {e}")]
```

### 练习二

```python
import time
from collections import defaultdict

class RateLimiter:
    def __init__(self):
        self._counts: dict[str, list[float]] = defaultdict(list)

    def check(self, name: str, limit: int) -> bool:
        now = time.time()
        self._counts[name] = [t for t in self._counts[name] if now - t < 1.0]
        if len(self._counts[name]) >= limit:
            return False
        self._counts[name].append(now)
        return True

rate_limiter = RateLimiter()

# 在 parse_openapi_spec 中提取限流配置
def extract_rate_limit(detail: dict) -> int:
    return detail.get("x-mcp-rate-limit", 100)

# 在 handle_call_tool 中检查限流
limit = registry[name]["api"].get("rate_limit", 100)
if not rate_limiter.check(name, limit):
    return [TextContent(type="text", text=f"请求频率超限（{limit}/秒），请稍后重试")]
```
