# 06 阶段实战——构建一个多 MCP Server 的 Agent 系统并完成安全审计

> 把前 5 课学到的知识整合成一个完整的多 Server Agent 系统。

## 学习目标

- 构建多 MCP Server 的 Agent 系统
- 集成安全审计功能
- 输出一个可运行的生产级系统

---

## 一、系统架构

```
多 Server Agent 系统：

Agent
  │
  ├── Server Manager
  │   ├── 文件系统 Server
  │   ├── 数据库 Server
  │   └── API Gateway Server
  │
  ├── 安全层
  │   ├── 认证
  │   ├── 授权
  │   └── 审计
  │
  └── 工具路由
      └── 根据任务选择 Server
```

---

## 二、核心实现

```python
class ProductionMCPAgent:
    """生产级 MCP Agent"""
    
    def __init__(self):
        self.server_manager = MultiServerManager()
        self.security = SecurityManager()
        self.audit_logger = AuditLogger()
        self.tool_router = ToolRouter()
    
    async def initialize(self):
        """初始化"""
        # 添加 Server
        await self.server_manager.add_server("filesystem", create_filesystem_client())
        await self.server_manager.add_server("database", create_database_client())
        await self.server_manager.add_server("api", create_api_client())
        
        # 配置路由
        self.tool_router.add_route("file_", "filesystem")
        self.tool_router.add_route("db_", "database")
        self.tool_router.add_route("api_", "api")
    
    async def execute(self, task: str, user_id: str) -> str:
        """执行任务"""
        # 安全检查
        self.security.check_permission(user_id, task)
        
        # 选择工具
        tool_name = self._select_tool(task)
        
        # 审计日志
        self.audit_logger.log(user_id, tool_name, task)
        
        # 调用工具
        result = await self.server_manager.call_tool(tool_name, {"task": task})
        
        # 审计结果
        self.audit_logger.log_result(user_id, tool_name, result)
        
        return result
```

---

## 三、安全审计

```python
class SecurityAuditor:
    """安全审计员"""
    
    def audit_server(self, server_name: str, client: MCPClient) -> dict:
        """审计 Server"""
        results = {
            "server": server_name,
            "checks": []
        }
        
        # 检查认证
        results["checks"].append(self._check_auth(client))
        
        # 检查授权
        results["checks"].append(self._check_authorization(client))
        
        # 检查输入校验
        results["checks"].append(self._check_input_validation(client))
        
        return results
```

---

## 四、运行示例

```python
async def main():
    agent = ProductionMCPAgent()
    await agent.initialize()
    
    # 执行任务
    result = await agent.execute("读取文件 /tmp/test.txt", "user_123")
    print(result)

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 五、课程总结

```
课程 05 总结：

恭喜你完成了 MCP 协议深度开发实战课程！

你现在能够：
- 深入理解 MCP 协议的设计哲学和架构
- 开发生产级 MCP Server（Tool / Resource / Prompt）
- 实现 MCP Client 并集成到 Agent 系统
- 掌握 MCP 的安全模型和最佳实践
- 为内部系统开发 MCP 适配层

下一步：
- 将所学应用到你的实际项目中
- 贡献开源 MCP Server
- 关注 MCP 生态的最新发展
```

---

## 作业

1. **完成实战**：运行本课的多 Server Agent 系统。

2. **安全题**：完成安全审计，修复发现的问题。

3. **总结反思**：回顾整个课程，总结你的收获和下一步计划。
