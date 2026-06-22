# 06 阶段实战——构建一个多 MCP Server 的 Agent 系统并完成安全审计

> 把前 5 课学到的知识整合成一个完整的多 Server Agent 系统。

## 场景引入

经过前 4 个阶段的学习，你已经掌握了 MCP 协议、Server 开发、高级模式和生态集成。现在要把所有知识整合起来，构建一个生产级的多 Server Agent 系统：连接文件系统、数据库、API Gateway 三个 Server，集成认证、授权、审计日志，支持动态 Tool 注册和故障转移。这不只是课程练习，而是你实际项目中会遇到的完整架构。

---

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

## 常见误区

```
误区 1：安全审计是一次性的工作
  安全审计应该是持续的过程。每次 Server 更新、权限变更都要重新审计。
  把安全审计集成到 CI/CD 流程中。

误区 2：多 Server 系统不需要统一的错误处理
  每个 Server 的错误格式可能不同，Manager 层要统一转换。
  Agent 看到的应该是一致的错误格式，不管底层是哪个 Server。

误区 3：生产环境可以直接用课程代码
  课程代码是教学用的简化版本。生产环境需要增加：监控、告警、限流、熔断。
  把课程代码作为起点，在此基础上完善。

误区 4：系统上线就完事了
  上线后要持续监控：工具调用量、错误率、延迟分布、资源使用情况。
  根据监控数据优化 Tool 设计和 Server 配置。
```

---

## 工程建议

```
1. 安全层和业务层分离
  认证、授权、审计作为独立的中间件，不和 Tool 逻辑耦合。
  新增 Tool 时自动继承安全层的能力，不需要重复实现。

2. 监控指标要覆盖全链路
  从 Agent 发起请求到返回结果，每个环节都要有监控指标。
  关键指标：请求量、错误率、P99 延迟、Tool 调用成功率。

3. 配置和代码分离
  Server 列表、路由规则、限流参数、权限配置都应该是配置项。
  通过配置中心动态更新，不需要重新部署。

4. 为毕业项目做准备
  这个阶段的实战是毕业项目（AI 数据分析平台）的技术基础。
  把架构模式、安全设计、监控方案都记录下来，毕业项目会用到。
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
