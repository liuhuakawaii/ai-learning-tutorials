"""MCP Server 骨架：数据库查询 MCP Server。

这是毕业项目的 MCP Server 实现起点。
学员需要根据 05-mcp-dev-course 的知识完成实现。

用法:
    python backend/mcp_servers/database_server.py
"""
import sqlite3
from pathlib import Path

try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    HAS_MCP = True
except ImportError:
    HAS_MCP = False

from backend.config import DB_PATH


def get_db_schema() -> str:
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    schema_parts = []
    for (table_name,) in tables:
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        cols = [f"  {col[1]} ({col[2]})" for col in columns]
        schema_parts.append(f"表 {table_name}:\n" + "\n".join(cols))
    conn.close()
    return "\n\n".join(schema_parts)


def execute_query(sql: str) -> str:
    if not sql.strip().upper().startswith("SELECT"):
        return "错误: 仅允许 SELECT 查询"
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        conn.close()
        import json
        return json.dumps([dict(zip(columns, row)) for row in rows], ensure_ascii=False)
    except Exception as e:
        return f"查询错误: {e}"


if HAS_MCP:
    server = Server("database-mcp-server")

    @server.tool()
    async def query_database(sql: str) -> str:
        """执行只读 SQL 查询（仅 SELECT）"""
        return execute_query(sql)

    @server.resource("db://schema")
    async def get_schema() -> str:
        """获取数据库表结构"""
        return get_db_schema()

    async def main():
        async with stdio_server() as (read_stream, write_stream):
            await server.run(read_stream, write_stream, server.create_initialization_options())

    if __name__ == "__main__":
        import asyncio
        asyncio.run(main())
else:
    if __name__ == "__main__":
        print("MCP SDK 未安装。请运行: pip install mcp")
        print("当前可用功能:")
        print(f"  数据库路径: {DB_PATH}")
        print(f"  表结构:\n{get_db_schema()}")
