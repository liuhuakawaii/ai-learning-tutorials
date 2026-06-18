# 06 阶段实战——为 PostgreSQL 数据库开发一个完整的 MCP Server

> 把前 5 课学到的知识整合成一个完整的 PostgreSQL MCP Server。

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

---

## 小结

```
本课核心要点：

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
