# Tool 开发——从需求分析到 Tool 实现的完整流程

> 前置：第 1 阶段的 MCP 协议基础
> 课型：机制与源码课

## 一个被拒绝的 Tool

你写了一个 MCP Server，注册了一个 `execute_sql` 工具：

```python
@server.tool()
async def execute_sql(sql: str) -> list[TextContent]:
    """执行 SQL 查询"""
    result = await db.execute(sql)
    return [TextContent(type="text", text=str(result))]
```

用 MCP Inspector 测试，AI 模型看到这个 Tool 后：
- 不知道什么时候该用它（description 太模糊）
- 传了 `DROP TABLE users` 进来（没有输入校验）
- 返回了一堆内部错误信息（没有错误处理）

一个 Tool 要让 AI 能用、敢用、用对，需要搞清楚三件事：AI 怎么决定调用你、参数怎么保证合法、错误怎么不暴露内部细节。

## AI 是怎么"看到" Tool 的

当 Client 调用 `tools/list` 时，Server 返回的不是代码，是元数据：

```json
{
    "name": "query_database",
    "description": "执行只读 SQL 查询。仅允许 SELECT 语句，自动添加 LIMIT 1000。",
    "inputSchema": {
        "type": "object",
        "properties": {
            "sql": {"type": "string", "description": "SQL SELECT 查询语句"},
            "database": {"type": "string", "default": "main", "description": "数据库名称"}
        },
        "required": ["sql"]
    }
}
```

AI 模型看到的就是这些。它根据 `description` 决定"什么时候调用"，根据 `inputSchema` 决定"传什么参数"。

```
description 写得差 → AI 不知道什么时候用 → 该调的时候不调，不该调的时候乱调
inputSchema 不严格 → AI 生成不合法参数 → Tool 执行失败
```

这不是代码质量的问题，是接口设计的问题。Tool 的 description 和 inputSchema 是给 AI 看的接口文档。

## MCP SDK 怎么把函数变成 Tool

用 Python MCP SDK 写一个 Tool：

```python
from mcp.server import Server
from mcp.types import TextContent

server = Server("my-server")

@server.tool()
async def query_database(sql: str, limit: int = 100) -> list[TextContent]:
    """执行只读 SQL 查询。

    Args:
        sql: SQL SELECT 查询语句。仅允许 SELECT，不允许 INSERT/UPDATE/DELETE。
        limit: 返回行数上限，默认 100，最大 1000。
    """
    if not sql.strip().upper().startswith("SELECT"):
        return [TextContent(type="text", text="错误: 仅允许 SELECT 查询")]

    # ... 执行查询
    return [TextContent(type="text", text=json.dumps(results))]
```

SDK 做了什么：
1. 从函数签名提取参数名和类型 → 生成 `inputSchema`
2. 从 docstring 提取描述 → 生成 `description`
3. 注册到 Server 的工具列表 → 响应 `tools/list`
4. 包装调用逻辑 → 响应 `tools/call`

但 SDK 不会帮你做安全校验。`if not sql.strip().upper().startswith("SELECT")` 这行是你自己写的——SDK 不知道你的业务规则。

## TypeScript SDK 的写法

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

server.tool(
    "query_database",
    "执行只读 SQL 查询。仅允许 SELECT 语句。",
    {
        sql: z.string().describe("SQL SELECT 查询语句"),
        limit: z.number().default(100).describe("返回行数上限"),
    },
    async ({ sql, limit }) => {
        if (!sql.trim().toUpperCase().startsWith("SELECT")) {
            return { content: [{ type: "text", text: "错误: 仅允许 SELECT" }] };
        }
        const results = await executeQuery(sql, limit);
        return { content: [{ type: "text", text: JSON.stringify(results) }] };
    }
);
```

Python 用 docstring 描述，TypeScript 用 Zod schema 描述。效果一样：SDK 把它们转成 MCP 规范要求的 `inputSchema` 和 `description`。

## Tool 设计的四个判断

### 判断一：拆还是合

```
场景：数据库操作——查询表结构、执行 SQL、查看执行计划

方案 A：一个 Tool 搞定
  name: "database_operation"
  参数: operation (query/schema/plan), sql, table_name
  问题：description 很难写清楚"什么时候用"，AI 经常选错 operation

方案 B：拆成三个 Tool
  name: "query_database"  → 执行 SELECT
  name: "get_table_schema" → 获取表结构
  name: "explain_query"   → 查看执行计划
  每个 Tool 的 description 精准，AI 容易判断
```

原则：一个 Tool 做一件事。如果 description 里出现了"或者"，大概率该拆。

### 判断二：读还是写

```
读操作（SELECT、GET、LIST）：
  - 安全，可以放心暴露
  - 幂等，多次调用结果一样
  - 可以缓存

写操作（INSERT、UPDATE、DELETE）：
  - 危险，需要额外保护
  - 不幂等，重复调用会出问题
  - 应该有确认机制

工程实践：
  - 读操作优先暴露
  - 写操作加 dry_run 参数
  - 删除用软删除
```

### 判断三：参数怎么定

```python
# 太宽松——AI 可能传任意字符串
@server.tool()
async def query_database(sql: str): ...

# 太严格——AI 可能无法生成合法参数
@server.tool()
async def query_database(
    table: str,
    columns: list[str],
    where: dict,
    order_by: str,
    limit: int
): ...

# 合理——核心参数严格，可选参数有默认值
@server.tool()
async def query_database(
    sql: str,  # 核心参数，AI 生成 SQL
    limit: int = 100,  # 安全限制
    database: str = "main"  # 可选，默认值
): ...
```

### 判断四：错误怎么返回

```
错误 1：Tool 内部异常
  ✗ return [TextContent(type="text", text=str(e))]
    → 可能暴露数据库连接字符串、文件路径等内部信息

  ✓ try:
        result = await db.execute(sql)
    except DatabaseError:
        return [TextContent(type="text", text="查询执行失败，请检查 SQL 语法")]
    except ConnectionError:
        return [TextContent(type="text", text="数据库连接失败，请稍后重试")]

错误 2：参数不合法
  ✗ 不处理，直接执行
  ✓ if not sql.strip().upper().startswith("SELECT"):
        return [TextContent(type="text", text="仅允许 SELECT 查询")]

错误 3：结果为空
  ✗ return [TextContent(type="text", text="[]")]
  ✓ return [TextContent(type="text", text="未找到匹配记录")]
```

## MCP Inspector：你的调试利器

```bash
# Python Server
mcp dev my_server.py

# TypeScript Server
npx @modelcontextprotocol/inspector node dist/server.js
```

Inspector 能做的事：
- 看到 Server 暴露了哪些 Tool
- 手动输入参数测试 Tool
- 查看完整的 JSON-RPC 消息
- 测试边界情况（空输入、非法输入）

每次改完 Tool 的实现，都要用 Inspector 跑一遍。特别是改了 description 或 inputSchema 之后——AI 的调用行为可能完全变了。

## 练习

### 练习一：设计并实现文件搜索 Tool

实现一个 `search_files` Tool，支持两种搜索模式：
- `filename`：按文件名模式搜索（支持通配符 `*.py`）
- `content`：按文件内容搜索（纯文本匹配）

要求：
- description 包含三个要素：做什么、什么时候用、有什么限制
- inputSchema 用 enum 限制 mode 的可选值
- 处理边界情况：路径不存在、无权限、搜索结果为空

### 练习二：用 MCP Inspector 测试边界情况

用 Inspector 测试你实现的 Tool，覆盖以下场景：

1. 空字符串路径
2. 不存在的路径
3. 无权限的目录
4. 搜索一个包含 10000+ 文件的目录（观察性能）
5. 搜索关键词包含特殊字符（如 `SELECT * FROM users`）

记录每个场景的实际表现，标注哪些需要改进。

---

## 参考答案

### 练习一

```python
import os
import fnmatch
from pathlib import Path
from mcp.server import Server
from mcp.types import TextContent
import json

server = Server("file-search")

@server.tool()
async def search_files(
    directory: str,
    mode: str,
    pattern: str,
    max_results: int = 50
) -> list[TextContent]:
    """在指定目录下搜索文件。

    Args:
        directory: 搜索的根目录
        mode: 搜索模式。filename 按文件名匹配（支持通配符如 *.py），content 按文件内容匹配。
        pattern: 搜索关键词或通配符模式。
        max_results: 最大返回结果数，默认 50，最大 200。
    """
    if mode not in ("filename", "content"):
        return [TextContent(type="text", text=f"不支持的搜索模式: {mode}，可选: filename, content")]

    base = Path(directory)
    if not base.exists():
        return [TextContent(type="text", text=f"目录不存在: {directory}")]
    if not base.is_dir():
        return [TextContent(type="text", text=f"不是目录: {directory}")]

    results = []
    text_exts = {".txt", ".py", ".js", ".ts", ".md", ".json", ".yaml", ".yml", ".toml"}

    try:
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for fname in files:
                full = Path(root) / fname
                matched = False

                if mode == "filename":
                    if fnmatch.fnmatch(fname.lower(), pattern.lower()):
                        results.append({"path": str(full), "name": fname, "size": full.stat().st_size})
                        matched = True

                elif mode == "content":
                    if full.suffix.lower() not in text_exts:
                        continue
                    if full.stat().st_size > 1_048_576:
                        continue
                    try:
                        text = full.read_text(encoding="utf-8", errors="ignore")
                        if pattern.lower() in text.lower():
                            lines = text.split("\n")
                            hits = [{"line": i + 1, "text": l.strip()}
                                    for i, l in enumerate(lines) if pattern.lower() in l.lower()][:3]
                            results.append({"path": str(full), "name": fname, "matches": hits})
                            matched = True
                    except (PermissionError, UnicodeDecodeError):
                        continue

                if len(results) >= max_results:
                    break
            if len(results) >= max_results:
                break
    except PermissionError:
        return [TextContent(type="text", text=f"无权限访问: {directory}")]

    if not results:
        return [TextContent(type="text", text=f"未找到匹配文件（模式: {mode}，关键词: {pattern}）")]

    return [TextContent(type="text", text=json.dumps({
        "total": len(results),
        "truncated": len(results) >= max_results,
        "results": results
    }, ensure_ascii=False, indent=2))]
```

### 练习二

| 场景 | 预期表现 | 改进点 |
|------|----------|--------|
| 空字符串路径 | 返回"目录不存在" | 加空字符串检查 |
| 不存在路径 | 返回"目录不存在" | 已处理 |
| 无权限目录 | 返回"无权限访问" | 已处理 |
| 大目录 | 可能较慢但不会崩溃 | 加 max_results 限制 |
| 特殊字符 | content 模式正常（纯文本匹配） | filename 模式通配符可能误匹配 |
