# 06 阶段实战——为 PostgreSQL 数据库开发一个完整的 MCP Server

> 把前 5 课学到的知识整合成一个完整的 PostgreSQL MCP Server。

## 场景引入

前 5 课你分别学了 Tool、Resource、Prompt 的开发和错误处理。现在要把这些知识整合起来，为公司的真实 PostgreSQL 数据库开发一个完整的 MCP Server。这个 Server 要让 AI 助手能查询表结构、执行 SQL、生成复杂查询——而且要安全、健壮、可维护。这不是 demo，是生产级的工具。

---

## 学习目标

- 开发一个完整的 PostgreSQL MCP Server
- 集成 Tool、Resource、Prompt
- 输出一个可运行的数据库工具

---

## 一、Server 架构

```python
from mcp.server import Server
from mcp.types import Tool, Resource, Prompt, TextContent, PromptMessage
import asyncpg

class PostgreSQLMCPServer:
    """PostgreSQL MCP Server"""
    
    def __init__(self, connection_string: str):
        self.server = Server("postgresql-server")
        self.connection_string = connection_string
        self.pool = None
        
        self._register_tools()
        self._register_resources()
        self._register_prompts()
    
    async def initialize(self):
        """初始化连接池"""
        self.pool = await asyncpg.create_pool(self.connection_string)
    
    def _register_tools(self):
        """注册工具"""
        
        @self.server.tool()
        async def query(sql: str) -> list[TextContent]:
            """执行 SQL 查询"""
            async with self.pool.acquire() as conn:
                results = await conn.fetch(sql)
                return [TextContent(
                    type="text",
                    text=json.dumps([dict(r) for r in results], default=str)
                )]
        
        @self.server.tool()
        async def execute(sql: str) -> list[TextContent]:
            """执行 SQL 命令"""
            async with self.pool.acquire() as conn:
                result = await conn.execute(sql)
                return [TextContent(type="text", text=result)]
    
    def _register_resources(self):
        """注册资源"""
        
        @self.server.resource("postgres://tables")
        async def list_tables() -> list[TextContent]:
            """获取表列表"""
            async with self.pool.acquire() as conn:
                tables = await conn.fetch(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
                )
                return [TextContent(
                    type="text",
                    text=json.dumps([t['table_name'] for t in tables])
                )]
        
        @self.server.resource("postgres://tables/{table_name}")
        async def table_schema(table_name: str) -> list[TextContent]:
            """获取表结构"""
            async with self.pool.acquire() as conn:
                columns = await conn.fetch(
                    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
                    table_name
                )
                return [TextContent(
                    type="text",
                    text=json.dumps([dict(c) for c in columns])
                )]
    
    def _register_prompts(self):
        """注册提示"""
        
        @self.server.prompt()
        async def query_helper(table: str, question: str) -> list[PromptMessage]:
            """查询助手"""
            async with self.pool.acquire() as conn:
                schema = await conn.fetch(
                    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
                    table
                )
                schema_text = "\n".join([f"- {c['column_name']}: {c['data_type']}" for c in schema])
                
                return [PromptMessage(
                    role="user",
                    content=TextContent(
                        type="text",
                        text=f"""表 {table} 的结构：
{schema_text}

问题：{question}

请生成 SQL 查询。"""
                    )
                )]
```

---

## 二、使用示例

```python
async def main():
    # 创建 Server
    server = PostgreSQLMCPServer("postgresql://user:pass@localhost/mydb")
    await server.initialize()
    
    # 运行
    from mcp.transport.stdio import StdioServerTransport
    transport = StdioServerTransport()
    await server.server.run(transport)

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 三、测试

```bash
# 启动 Server
python server.py

# 使用 MCP Inspector 测试
npx @modelcontextprotocol/inspector python server.py
```

## 常见误区

```
误区 1：直接拼接 SQL 字符串
  即使是只读查询，也要用参数化查询防止 SQL 注入。
  asyncpg 的 $1、$2 参数化语法比字符串拼接安全得多。

误区 2：连接池大小越大越好
  连接池大小应该等于 CPU 核心数 × 2 + 磁盘数。
  过大的连接池反而会因为上下文切换降低性能。

误区 3：Resource 和 Tool 返回相同的数据
  Resource 返回元数据（表结构、列信息），Tool 返回实际数据（查询结果）。
  两者的职责不同，不要混用。

误区 4：生产环境不需要 MCP Inspector 测试
  Inspector 不仅用于开发调试，也应该作为 CI/CD 的一部分。
  每次部署前用 Inspector 跑一遍回归测试。
```

---

## 工程建议

```
1. 只读查询和写操作分开部署
  query Tool 可以暴露给所有用户，execute Tool 只暴露给管理员。
  甚至可以把它们放在不同的 Server 实例中。

2. 自动添加 LIMIT 保护
  对没有 LIMIT 的 SELECT 查询自动添加 LIMIT 1000。
  防止 AI 生成全表扫描的查询拖垮数据库。

3. Resource 要缓存
  表结构不会频繁变化，Resource 数据应该缓存。
  设置合理的 TTL（如 5 分钟），减少数据库压力。

4. 记录所有 Tool 调用的审计日志
  每次 tools/call 都要记录：谁调用、什么参数、什么结果、耗时多久。
  这是安全审计和性能优化的基础数据。
```

---

## 小结

1. 完整的 PostgreSQL MCP Server 包含 Tool、Resource、Prompt
2. Tool 提供查询和执行能力
3. Resource 提供表和结构信息
4. Prompt 提供查询助手功能

阶段总结：
  你已经掌握了 MCP Server 的开发方法。
  下一阶段，我们将学习高级 MCP 模式。
```

---

## 作业

1. **完成实战**：运行本课的 PostgreSQL MCP Server。

2. **扩展题**：添加更多的 Tool（如插入、更新、删除）。

3. **测试题**：用 MCP Inspector 测试你的 Server。
