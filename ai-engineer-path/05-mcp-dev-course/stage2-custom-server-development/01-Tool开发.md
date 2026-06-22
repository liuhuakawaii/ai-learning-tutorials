# 第 1 课：Tool 开发——从需求分析到 Tool 实现的完整流程

> **课程定位**：掌握 MCP Tool 的设计和实现，这是 MCP Server 最核心的能力
> **前置知识**：第 1 阶段的 MCP 协议基础
> **预计时长**：50 分钟

## 场景引入

你接到需求：为公司的 PostgreSQL 数据库开发一个 MCP Server，让 AI 助手能查询数据。你写了一个 execute_sql 工具，传入 SQL 字符串直接执行。测试时发现两个问题：第一，AI 模型不知道什么时候该用这个工具，因为 description 写得太模糊；第二，有人传了 DROP TABLE 进来，工具直接执行了。一个 Tool 的 name、description、inputSchema 怎么设计才合理？哪些操作应该暴露，哪些必须禁止？

---

## 学习目标

完成本课学习后，你将能够：

1. 说出 MCP Tool 的设计原则
2. 用 Python 和 TypeScript 各实现一个 Tool
3. 用 MCP Inspector 测试 Tool
4. 设计合理的 Tool 输入 Schema

---

## 一、Tool 设计原则

```
好的 Tool 设计：

1. 单一职责
   ┌─────────────────────────────────────────────────────┐
   │  ✗ 一个 Tool 同时查数据库、发邮件、写文件              │
   │  ✓ 数据库查询是一个 Tool，发邮件是另一个 Tool          │
   └─────────────────────────────────────────────────────┘

2. 清晰描述
   ┌─────────────────────────────────────────────────────┐
   │  name: "query_database"                              │
   │  description: "执行只读 SQL 查询，仅允许 SELECT 语句"  │
   │                                                      │
   │  AI 模型通过 description 决定是否调用这个 Tool         │
   │  描述不清 → 模型不知道什么时候该用 → 调用错误          │
   └─────────────────────────────────────────────────────┘

3. 输入验证
   ┌─────────────────────────────────────────────────────┐
   │  用 JSON Schema / Zod / Pydantic 定义输入格式         │
   │  MCP SDK 会自动验证输入，不合格直接拒绝                │
   └─────────────────────────────────────────────────────┘

4. 安全边界
   ┌─────────────────────────────────────────────────────┐
   │  - 只读操作优先（SELECT 而非 DELETE）                  │
   │  - 限制返回数据量（LIMIT）                            │
   │  - 不暴露内部路径和错误堆栈                            │
   └─────────────────────────────────────────────────────┘
```

---

## 二、Python 实现

### 2.1 基础 Tool

```python
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent
import json

server = Server("my-tools-server")

@server.tool()
async def query_database(sql: str) -> list[TextContent]:
    """执行只读 SQL 查询。

    Args:
        sql: SQL SELECT 查询语句。仅允许 SELECT，不允许 INSERT/UPDATE/DELETE。
    """
    # 验证：只允许 SELECT
    if not sql.strip().upper().startswith("SELECT"):
        return [TextContent(
            type="text",
            text="错误: 仅允许 SELECT 查询，不支持修改操作"
        )]

    try:
        # 执行查询（Mock）
        results = [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]
        return [TextContent(
            type="text",
            text=json.dumps(results, ensure_ascii=False, indent=2)
        )]
    except Exception as e:
        return [TextContent(
            type="text",
            text=f"查询执行失败: {str(e)}"
        )]


@server.tool()
async def read_file(path: str) -> list[TextContent]:
    """读取指定路径的文件内容。

    Args:
        path: 文件的绝对路径或相对路径。
    """
    from pathlib import Path

    file_path = Path(path)
    if not file_path.exists():
        return [TextContent(type="text", text=f"文件不存在: {path}")]
    if not file_path.is_file():
        return [TextContent(type="text", text=f"路径不是文件: {path}")]

    try:
        content = file_path.read_text(encoding="utf-8")
        # 限制返回长度
        if len(content) > 50000:
            content = content[:50000] + "\n\n... (内容过长，已截断)"
        return [TextContent(type="text", text=content)]
    except Exception as e:
        return [TextContent(type="text", text=f"读取失败: {str(e)}")]
```

### 2.2 用 Pydantic 定义复杂输入

```python
from pydantic import BaseModel, Field

class QueryInput(BaseModel):
    """数据库查询参数。"""
    sql: str = Field(description="SQL SELECT 查询语句")
    limit: int = Field(default=100, ge=1, le=10000, description="返回行数上限")
    database: str = Field(default="main", description="数据库名称")

@server.tool()
async def query_database_v2(input: QueryInput) -> list[TextContent]:
    """执行只读 SQL 查询（支持高级参数）。"""
    sql = input.sql
    if input.limit and "LIMIT" not in sql.upper():
        sql = f"{sql.rstrip(';')} LIMIT {input.limit}"

    results = execute_sql(sql, database=input.database)
    return [TextContent(type="text", text=json.dumps(results))]
```

---

## 三、TypeScript 实现

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-tools-server",
  version: "1.0.0",
});

// 方式 1：用 Zod schema 定义输入
server.tool(
  "query_database",
  "执行只读 SQL 查询，仅允许 SELECT 语句",
  {
    sql: z.string().describe("SQL SELECT 查询语句"),
    limit: z.number().default(100).describe("返回行数上限"),
  },
  async ({ sql, limit }) => {
    if (!sql.trim().toUpperCase().startsWith("SELECT")) {
      return { content: [{ type: "text", text: "错误: 仅允许 SELECT 查询" }] };
    }

    try {
      const results = await executeQuery(sql, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `查询失败: ${e}` }] };
    }
  }
);

// 方式 2：简单参数
server.tool(
  "read_file",
  "读取指定路径的文件内容",
  { path: z.string().describe("文件路径") },
  async ({ path }) => {
    try {
      const content = await fs.readFile(path, "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch (e) {
      return { content: [{ type: "text", text: `文件不存在: ${path}` }] };
    }
  }
);

// 启动
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 四、用 MCP Inspector 测试

```
MCP Inspector 是官方调试工具，可以可视化测试 Tool。

启动方式：
  # Python
  mcp dev my_server.py

  # TypeScript
  npx @modelcontextprotocol/inspector node dist/my_server.js

Inspector 界面：
  ┌─────────────────────────────────────────────────────────┐
  │  MCP Inspector                                          │
  │                                                         │
  │  Tools:                                                 │
  │  ┌───────────────────────────────────────────────────┐  │
  │  │ query_database                                     │  │
  │  │ description: "执行只读 SQL 查询"                    │  │
  │  │ input: { "sql": "SELECT * FROM users" }            │  │
  │  │ [Run]                                              │  │
  │  └───────────────────────────────────────────────────┘  │
  │  ┌───────────────────────────────────────────────────┐  │
  │  │ read_file                                          │  │
  │  │ description: "读取文件内容"                         │  │
  │  │ input: { "path": "/tmp/test.txt" }                 │  │
  │  │ [Run]                                              │  │
  │  └───────────────────────────────────────────────────┘  │
  │                                                         │
  │  Result:                                                │
  │  { "content": [{ "type": "text", "text": "..." }] }     │
  └─────────────────────────────────────────────────────────┘

测试步骤：
  1. 启动 Inspector
  2. 在 Tools 列表中看到你注册的 Tool
  3. 输入参数，点击 Run
  4. 查看返回结果或错误信息
  5. 测试边界情况（空输入、非法输入、超长输入）
```

---

## 五、Tool 设计模式

### 5.1 CRUD Tool 组

```
一个资源通常需要一组 Tool：

  read_user    → 查询用户
  create_user  → 创建用户
  update_user  → 更新用户
  delete_user  → 删除用户

设计建议：
  - 读操作（read）优先，写操作谨慎
  - 写操作可以加确认参数（dry_run=True）
  - 删除操作可以软删除
```

### 5.2 查询 + 执行分离

```
复杂操作拆分为两步：

  Tool 1: generate_sql(query: str) -> str
    根据自然语言生成 SQL

  Tool 2: execute_sql(sql: str) -> str
    执行 SQL 并返回结果

  为什么要分离？
  - 人类可以在两步之间审批 SQL
  - 生成的 SQL 可以被检查和修改
  - 执行逻辑可以复用
```

### 5.3 带进度的长时间操作

```
对于耗时操作，返回进度信息：

  @server.tool()
  async def process_large_file(path: str) -> list[TextContent]:
      """处理大文件。"""
      total_lines = count_lines(path)
      processed = 0

      for line in read_lines(path):
          process_line(line)
          processed += 1
          if processed % 1000 == 0:
              # 返回进度
              print(f"进度: {processed}/{total_lines}")

      return [TextContent(type="text", text=f"处理完成: {processed} 行")]
```

---

## 六、常见误区

```
错误 1：Tool 描述不够清晰
  症状：AI 模型不知道什么时候该调用这个 Tool
  原因：description 太简短或含糊
  解决：用一句话说清楚 Tool 做什么、什么时候用

错误 2：没有验证输入
  症状：非法输入导致 Tool 崩溃
  原因：没有用 Schema 验证
  解决：用 Zod / Pydantic / JSON Schema 定义输入格式

错误 3：暴露内部错误
  症状：用户看到数据库连接字符串或文件路径
  原因：直接把 Exception.message 返回给用户
  解决：捕获异常后返回友好的错误信息

错误 4：Tool 做太多事
  症状：一个 Tool 有 5 个参数、做 3 件事
  原因：违反单一职责原则
  解决：拆分成多个 Tool

错误 5：忘记处理空结果
  症状：查询返回空列表时 Tool 报错
  原因：没有处理空数据的情况
  解决：空结果返回有意义的信息（"未找到匹配记录"）
```

---

## 工程建议

```
1. description 要写给 AI 看，不是给人看
   AI 模型通过 description 决定是否调用 Tool。描述要包含：
   - Tool 做什么（动作）
   - 什么时候用（触发条件）
   - 有什么限制（安全边界）
   例如："执行只读 SQL 查询。仅允许 SELECT 语句，自动添加 LIMIT 限制。"

2. inputSchema 要尽可能严格
   用 enum 限制可选值、用 pattern 限制格式、用 maxLength 限制长度。
   Schema 越严格，AI 模型生成合法参数的概率越高。

3. 读写分离是基本原则
   把查询和修改拆成独立的 Tool。查询 Tool 可以放心暴露给 AI，
   修改 Tool 要加 dry_run 参数或确认机制。

4. 用 MCP Inspector 做回归测试
   每次修改 Tool 的实现后，用 MCP Inspector 跑一遍标准测试用例。
   特别关注：空输入、非法参数、超大输入、边界值。
```

---

## 小结

```
本课核心要点：

1. Tool 设计原则：单一职责、清晰描述、输入验证、安全边界
2. Python 用 @server.tool() 装饰器，TypeScript 用 server.tool() 方法
3. 用 MCP Inspector 测试 Tool 的输入输出
4. 常见模式：CRUD 组、查询执行分离、带进度的长操作
5. 错误处理：验证输入、友好错误信息、不暴露内部细节

---

**下一课**: [02 Resource 开发——让 AI 访问结构化数据](./02-Resource开发.md)
```

---

## 练习

1. **设计题**：为一个"文件管理"场景设计 3 个 Tool（列出目录、读取文件、搜索文件），写出每个 Tool 的 name、description 和 input schema。

2. **实现题**：用 Python 或 TypeScript 实现"搜索文件"Tool，支持按文件名模式搜索和按文件内容搜索两种模式。

3. **测试题**：用 MCP Inspector 测试你的 Tool，尝试以下输入：空字符串路径、不存在的路径、超大文件路径，观察 Tool 的行为。
