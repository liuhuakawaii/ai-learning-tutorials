# 阶段实战——为 PostgreSQL 数据库开发一个完整的 MCP Server

> 课型：练习复盘课
> 目标：把 Tool、Resource、Prompt 三种原语整合成一个生产级的数据库 MCP Server

## 任务说明

为公司的真实 PostgreSQL 数据库开发一个 MCP Server，让 AI 助手能：
- 查询表结构（Resource）
- 执行只读 SQL（Tool）
- 生成复杂查询（Prompt Template）

要求：
- 用 asyncpg 连接池
- SQL 必须参数化，不能拼接字符串
- 只读查询自动加 LIMIT 保护
- 所有 Tool 调用记录审计日志

## 实现路径

### Server 骨架

```python
import json
import asyncio
import logging
from datetime import datetime
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, PromptMessage
import asyncpg

logger = logging.getLogger("pg-mcp")

server = Server("postgresql-server")
pool: asyncpg.Pool = None

# ========== Tool ==========

@server.tool()
async def query_database(sql: str, limit: int = 100) -> list[TextContent]:
    """执行只读 SQL 查询。

    Args:
        sql: SQL SELECT 语句。仅允许 SELECT，不支持 INSERT/UPDATE/DELETE/DROP。
        limit: 返回行数上限，默认 100，最大 1000。自动添加到没有 LIMIT 的查询中。
    """
    logger.info(f"query_database called: sql={sql!r}, limit={limit}")

    # 校验：只允许 SELECT
    normalized = sql.strip().upper()
    if not normalized.startswith("SELECT"):
        return [TextContent(type="text", text="错误: 仅允许 SELECT 查询")]

    # 自动添加 LIMIT
    if "LIMIT" not in normalized:
        sql = f"{sql.rstrip(';')} LIMIT {min(limit, 1000)}"

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql)
            result = [dict(r) for r in rows]
            logger.info(f"query_database returned {len(result)} rows")
            return [TextContent(type="text", text=json.dumps(result, default=str, ensure_ascii=False, indent=2))]
    except asyncpg.PostgresError as e:
        logger.error(f"query_database error: {e}")
        return [TextContent(type="text", text=f"SQL 执行失败: {e}")]

@server.tool()
async def explain_query(sql: str) -> list[TextContent]:
    """查看 SQL 的执行计划。用于分析查询性能。

    Args:
        sql: SQL SELECT 语句。会自动加上 EXPLAIN ANALYZE。
    """
    if not sql.strip().upper().startswith("SELECT"):
        return [TextContent(type="text", text="错误: 仅允许 SELECT 查询")]

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(f"EXPLAIN ANALYZE {sql}")
            plan = "\n".join(r[0] for r in rows)
            return [TextContent(type="text", text=plan)]
    except asyncpg.PostgresError as e:
        return [TextContent(type="text", text=f"执行计划生成失败: {e}")]

# ========== Resource ==========

@server.resource("postgres://tables")
async def list_tables() -> list[TextContent]:
    """获取数据库中所有用户表"""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        )
        tables = [r["table_name"] for r in rows]
        return [TextContent(type="text", text=json.dumps(tables, ensure_ascii=False))]

@server.resource("postgres://tables/{table_name}/schema")
async def table_schema(table_name: str) -> list[TextContent]:
    """获取指定表的列定义"""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT column_name, data_type, is_nullable, column_default
               FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = $1
               ORDER BY ordinal_position""",
            table_name
        )
        columns = [dict(r) for r in rows]
        return [TextContent(type="text", text=json.dumps(columns, ensure_ascii=False, indent=2))]

# ========== Prompt ==========

@server.prompt()
async def query_helper(table: str, question: str) -> list[PromptMessage]:
    """根据自然语言问题生成 SQL 查询。

    Args:
        table: 目标表名
        question: 用户的自然语言问题，如"最近 7 天注册的用户有多少"
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT column_name, data_type
               FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = $1""",
            table
        )
        schema = "\n".join(f"- {r['column_name']}: {r['data_type']}" for r in rows)

    return [PromptMessage(
        role="user",
        content=TextContent(type="text", text=f"""表 {table} 的结构：
{schema}

问题：{question}

请生成一个 PostgreSQL SELECT 查询来回答这个问题。只返回 SQL，不要解释。""")
    )]

# ========== 启动 ==========

async def main():
    global pool
    pool = await asyncpg.create_pool(
        "postgresql://user:password@localhost:5432/mydb",
        min_size=2, max_size=10
    )
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
```

## 复盘：关键判断

### 1. query 和 explain 要分开

为什么不把 EXPLAIN 做成 query_database 的一个参数？因为它们是不同的操作：
- `query_database` 返回数据
- `explain_query` 返回执行计划

如果合成一个 Tool，AI 需要在"查数据"和"看执行计划"之间做选择，description 很难写清楚。拆开后每个 Tool 的职责明确，AI 容易判断。

### 2. Resource 和 Tool 的区别

```
Resource: postgres://tables
  - 只读，返回表列表
  - 由 Host 主动获取，不依赖 AI 决策
  - 适合元数据（表结构、列信息）

Tool: query_database
  - AI 主动调用，传入 SQL
  - 返回实际数据
  - 适合数据操作
```

Resource 是"AI 可以看的数据"，Tool 是"AI 可以做的事"。表结构是元数据，应该用 Resource；查询结果是操作，应该用 Tool。

### 3. LIMIT 保护是必要的

AI 可能生成 `SELECT * FROM users`——如果表有 100 万行，这个查询会拖垮数据库。自动添加 `LIMIT 1000` 是防御性编程。

但这不是万能的。AI 也可能生成 `SELECT * FROM users WHERE 1=1`，LIMIT 只限制了返回行数，不能阻止全表扫描。生产环境还需要：
- 查询超时（`statement_timeout`）
- 只读连接（`default_transaction_read_only`）
- 连接池限制

### 4. 参数化查询不是可选的

```python
# ✗ 字符串拼接——SQL 注入
sql = f"SELECT * FROM users WHERE name = '{user_input}'"

# ✓ 参数化查询
rows = await conn.fetch("SELECT * FROM users WHERE name = $1", user_input)
```

即使你的 Tool 只允许 SELECT，用户也可能传入 `' OR 1=1 --`。参数化查询是唯一正确的做法。

### 5. 审计日志要在 Tool 入口记录

```python
logger.info(f"query_database called: sql={sql!r}, limit={limit}")
```

记录什么：
- 谁调用（如果有多用户）
- 调用什么 Tool
- 传了什么参数
- 返回了什么结果
- 耗时多久

这些数据是安全审计和性能优化的基础。

## 常见错误

| 错误 | 后果 | 正确做法 |
|------|------|----------|
| 字符串拼接 SQL | SQL 注入 | 用 asyncpg 的 `$1` 参数化 |
| 不加 LIMIT | 全表扫描拖垮数据库 | 自动添加 LIMIT |
| 连接池太大 | 上下文切换降低性能 | CPU核心数 × 2 + 磁盘数 |
| Resource 和 Tool 返回相同数据 | 语义混乱 | Resource 返回元数据，Tool 返回数据 |
| 不记录日志 | 出问题无法排查 | 每次调用记录参数和结果 |

## 练习

### 练习一：添加写操作 Tool

添加 `insert_record` 和 `update_record` 两个 Tool，要求：
- 用参数化查询
- 先 dry_run 预览影响行数，再真正执行
- 记录审计日志

### 练习二：添加 Resource 缓存

表结构不会频繁变化。为 `postgres://tables/{table_name}/schema` 添加缓存：
- 缓存 5 分钟
- 提供手动清除缓存的 Tool

### 练习三：测试安全边界

用 MCP Inspector 测试以下攻击场景，验证你的 Server 是否安全：

1. `sql: "SELECT * FROM users; DROP TABLE users; --"`
2. `sql: "SELECT * FROM users WHERE name = '' OR 1=1 --"`
3. `sql: "SELECT pg_sleep(10)"`（长时间查询）
4. `sql: "SELECT * FROM information_schema.tables"`（元数据泄露）

---

## 参考答案

### 练习一

```python
@server.tool()
async def insert_record(table: str, data: str, dry_run: bool = True) -> list[TextContent]:
    """插入一条记录。

    Args:
        table: 目标表名
        data: JSON 格式的列名-值映射，如 '{"name": "Alice", "age": 30}'
        dry_run: 默认 true，只预览 SQL 不真正执行。设为 false 才真正插入。
    """
    try:
        record = json.loads(data)
    except json.JSONDecodeError:
        return [TextContent(type="text", text="错误: data 必须是合法的 JSON 字符串")]

    columns = ", ".join(record.keys())
    placeholders = ", ".join(f"${i+1}" for i in range(len(record)))
    values = list(record.values())
    sql = f"INSERT INTO {table} ({columns}) VALUES ({placeholders})"

    if dry_run:
        return [TextContent(type="text", text=f"[DRY RUN] 将执行:\n{sql}\n参数: {values}")]

    try:
        async with pool.acquire() as conn:
            result = await conn.execute(sql, *values)
            logger.info(f"insert_record: table={table}, data={data}")
            return [TextContent(type="text", text=f"插入成功: {result}")]
    except asyncpg.PostgresError as e:
        return [TextContent(type="text", text=f"插入失败: {e}")]
```

### 练习二

```python
from datetime import datetime, timedelta

_schema_cache: dict[str, tuple[datetime, list]] = {}
CACHE_TTL = timedelta(minutes=5)

@server.resource("postgres://tables/{table_name}/schema")
async def table_schema(table_name: str) -> list[TextContent]:
    now = datetime.now()
    if table_name in _schema_cache:
        cached_time, cached_data = _schema_cache[table_name]
        if now - cached_time < CACHE_TTL:
            return [TextContent(type="text", text=json.dumps(cached_data, ensure_ascii=False, indent=2))]

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT column_name, data_type, is_nullable, column_default
               FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = $1
               ORDER BY ordinal_position""",
            table_name
        )
        columns = [dict(r) for r in rows]

    _schema_cache[table_name] = (now, columns)
    return [TextContent(type="text", text=json.dumps(columns, ensure_ascii=False, indent=2))]

@server.tool()
async def clear_schema_cache() -> list[TextContent]:
    """清除表结构缓存。在表结构变更后调用。"""
    _schema_cache.clear()
    return [TextContent(type="text", text="缓存已清除")]
```

### 练习三

| 攻击 | 预期行为 | 原因 |
|------|----------|------|
| `DROP TABLE` | 被拒绝："仅允许 SELECT" | 不以 SELECT 开头 |
| `OR 1=1` | 正常执行但参数化 | `$1` 参数化会把整个字符串当作值 |
| `pg_sleep` | 可能执行成功 | 需要 `statement_timeout` 保护 |
| `information_schema` | 正常返回 | SELECT 允许访问元数据，需要额外限制 |
