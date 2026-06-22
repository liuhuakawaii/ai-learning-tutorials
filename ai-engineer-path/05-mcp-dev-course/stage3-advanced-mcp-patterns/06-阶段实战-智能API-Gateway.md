# 06 阶段实战——开发一个支持动态 Tool 的智能 API Gateway MCP Server

> 把前 5 课学到的高级模式整合成一个智能 API Gateway。

## 场景引入

公司有 20 个内部 REST API，你希望 AI 助手能调用它们。最笨的方法是为每个 API 写一个 MCP Tool——但 API 会频繁增删改，每次变更都要改代码重新部署。你想要一个"智能 API Gateway"：把 API 的 OpenAPI 规范喂给它，它自动生成 MCP Tool；API 变更时更新规范文件就行，不用改代码。这需要动态 Tool 注册、流式响应、批量操作等多种高级模式的综合运用。

---

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

## 常见误区

```
误区 1：从 OpenAPI 规范生成 Tool 就够了
  自动生成的 Tool 的 description 往往不够好。
  生成后要人工优化 description，让 AI 更容易理解和使用。

误区 2：限流对所有 Tool 一视同仁
  不同 Tool 的资源消耗差异很大。查询类 Tool 可以放宽限制，
  写入类 Tool 要严格限流。按 Tool 类型设置不同的限流策略。

误区 3：动态注册的 Tool 不需要测试
  动态注册只是省去了手动编码，但 Tool 的行为仍然需要测试。
  用自动化测试验证每个注册的 API 的输入输出是否符合预期。

误区 4：Gateway 不需要缓存
  对于读多写少的 API，Gateway 层缓存可以显著降低延迟。
  设置合理的缓存 TTL 和失效策略。
```

---

## 工程建议

```
1. API 规范文件放在配置中心
  不要把 OpenAPI 规范硬编码在代码里。放在配置中心或 Git 仓库，
  变更时自动触发 Tool 列表更新。

2. 限流策略要可配置
  限流参数（每秒请求数、突发量）应该是配置项，不需要重新部署就能调整。
  生产环境中根据实际流量动态调整。

3. 熔断器保护下游 API
  某个 API 连续失败时自动熔断，返回友好提示。
  避免一个慢 API 拖垮整个 Gateway。

4. 审计日志记录所有 API 调用
  记录：谁调用、哪个 API、什么参数、什么结果、耗时多久。
  这是安全审计和 API 使用分析的基础数据。
```

---

## 小结

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
