# 06 阶段实战——开发一个支持动态 Tool 的智能 API Gateway MCP Server

> 把前 5 课学到的高级模式整合成一个智能 API Gateway。

## 学习目标

- 开发一个智能 API Gateway MCP Server
- 集成动态 Tool、流式响应、批量操作
- 输出一个可运行的生产级 Server

---

## 一、架构设计

```python
class APIGatewayMCPServer:
    """API Gateway MCP Server"""
    
    def __init__(self):
        self.server = Server("api-gateway")
        self.tool_registry = DynamicToolRegistry()
        self.session_manager = SessionManager()
        self.rate_limiter = RateLimiter()
        
        self._register_core_tools()
        self._register_dynamic_tools()
    
    def _register_core_tools(self):
        """注册核心工具"""
        
        @self.server.tool()
        async def api_request(
            method: str,
            url: str,
            headers: dict = {},
            body: str = None
        ) -> list[TextContent]:
            """发送 API 请求"""
            # 限流检查
            if not self.rate_limiter.check():
                return [TextContent(type="text", text="请求频率超限")]
            
            # 发送请求
            result = await self._make_request(method, url, headers, body)
            return [TextContent(type="text", text=json.dumps(result))]
    
    def _register_dynamic_tools(self):
        """注册动态工具"""
        
        @self.server.tool()
        async def register_api(api_spec: dict) -> list[TextContent]:
            """注册 API"""
            tool = self._create_tool_from_spec(api_spec)
            self.tool_registry.register(tool)
            return [TextContent(type="text", text=f"已注册：{tool.name}")]
```

---

## 二、API 规范解析

```python
def _create_tool_from_spec(self, spec: dict) -> Tool:
    """从 API 规范创建 Tool"""
    return Tool(
        name=spec["name"],
        description=spec["description"],
        inputSchema=spec.get("parameters", {})
    )
```

---

## 三、使用示例

```python
# 启动 Server
server = APIGatewayMCPServer()

# 注册 API
await server.register_api({
    "name": "weather",
    "description": "获取天气信息",
    "parameters": {
        "type": "object",
        "properties": {
            "city": {"type": "string"}
        }
    }
})

# 调用 Tool
result = await server.call_tool("weather", {"city": "北京"})
```

---

## 小结

```
本课核心要点：

1. 智能 API Gateway 支持动态 Tool 注册
2. 集成限流、会话管理、错误处理
3. 从 API 规范自动生成 Tool
4. 支持运行时配置更新

阶段总结：
  你已经掌握了 MCP 的高级开发模式。
  下一阶段，我们将学习 MCP 生态集成。
```

---

## 作业

1. **完成实战**：运行本课的 API Gateway Server。

2. **扩展题**：添加更多的 API 注册和管理功能。

3. **测试题**：测试动态 Tool 注册和调用。
