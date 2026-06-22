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

---

## 参考答案

### 练习一：设计文件管理 Tool

**思路**：按单一职责原则设计三个 Tool，每个 Tool 只做一件事。name 用动词_名词格式，description 要说清楚 Tool 做什么、什么时候用、有什么限制。

**答案**：

```python
from pydantic import BaseModel, Field


# Tool 1: 列出目录
list_directory_schema = {
    "name": "list_directory",
    "description": "列出指定目录下的文件和子目录。返回每个条目的名称、类型（文件/目录）、大小。适用于了解目录结构或查找文件。",
    "inputSchema": {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "目录的绝对路径或相对路径"
            },
            "show_hidden": {
                "type": "boolean",
                "default": False,
                "description": "是否显示隐藏文件（以 . 开头的文件）"
            },
            "max_depth": {
                "type": "integer",
                "default": 1,
                "minimum": 1,
                "maximum": 5,
                "description": "递归深度，1 表示只看当前目录"
            }
        },
        "required": ["path"]
    }
}


# Tool 2: 读取文件
read_file_schema = {
    "name": "read_file",
    "description": "读取指定路径的文件内容。仅支持文本文件，最大 50KB。适用于查看配置文件、代码文件、日志文件等。",
    "inputSchema": {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "文件的绝对路径或相对路径"
            },
            "encoding": {
                "type": "string",
                "enum": ["utf-8", "gbk", "ascii"],
                "default": "utf-8",
                "description": "文件编码"
            },
            "max_lines": {
                "type": "integer",
                "default": 1000,
                "minimum": 1,
                "maximum": 5000,
                "description": "最大读取行数"
            }
        },
        "required": ["path"]
    }
}


# Tool 3: 搜索文件
search_files_schema = {
    "name": "search_files",
    "description": "在指定目录下搜索文件。支持按文件名模式搜索（如 *.py）和按文件内容搜索（如包含 'TODO' 的文件）。适用于查找特定文件或代码片段。",
    "inputSchema": {
        "type": "object",
        "properties": {
            "directory": {
                "type": "string",
                "description": "搜索的根目录"
            },
            "mode": {
                "type": "string",
                "enum": ["filename", "content"],
                "description": "搜索模式：filename 按文件名匹配，content 按文件内容匹配"
            },
            "pattern": {
                "type": "string",
                "description": "搜索模式。filename 模式支持通配符（如 *.py），content 模式为纯文本搜索"
            },
            "max_results": {
                "type": "integer",
                "default": 50,
                "minimum": 1,
                "maximum": 200,
                "description": "最大返回结果数"
            }
        },
        "required": ["directory", "mode", "pattern"]
    }
}
```

**要点**：
- description 要包含三个要素：做什么（动作）、什么时候用（触发条件）、有什么限制（安全边界）
- inputSchema 用 enum 限制可选值，用 minimum/maximum 限制范围，提高参数合法率
- 常见错误：description 写成"列出目录"这种太简短的描述，AI 不知道什么时候该用

### 练习二：实现搜索文件 Tool

**思路**：用 Python 实现完整的 search_files Tool，支持 filename 和 content 两种搜索模式，处理边界情况（路径不存在、权限错误、文件过大）。

**答案**：

```python
import os
import re
from pathlib import Path
from mcp.server import Server
from mcp.types import TextContent
import json

server = Server("file-manager")


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
        mode: 搜索模式，filename 按文件名匹配，content 按文件内容匹配
        pattern: 搜索模式。filename 模式支持通配符，content 模式为纯文本搜索
        max_results: 最大返回结果数
    """
    # 参数验证
    if not directory:
        return [TextContent(type="text", text="错误：目录路径不能为空")]

    if mode not in ("filename", "content"):
        return [TextContent(type="text", text=f"错误：不支持的搜索模式 '{mode}'，可选值：filename, content")]

    if not pattern:
        return [TextContent(type="text", text="错误：搜索模式不能为空")]

    base_path = Path(directory)
    if not base_path.exists():
        return [TextContent(type="text", text=f"错误：目录不存在 '{directory}'")]
    if not base_path.is_dir():
        return [TextContent(type="text", text=f"错误：路径不是目录 '{directory}'")]

    results = []

    try:
        if mode == "filename":
            # 按文件名搜索（支持通配符）
            import fnmatch
            for root, dirs, files in os.walk(base_path):
                # 跳过隐藏目录
                dirs[:] = [d for d in dirs if not d.startswith(".")]
                for filename in files:
                    if fnmatch.fnmatch(filename.lower(), pattern.lower()):
                        full_path = Path(root) / filename
                        results.append({
                            "path": str(full_path),
                            "name": filename,
                            "size": full_path.stat().st_size,
                        })
                        if len(results) >= max_results:
                            break
                if len(results) >= max_results:
                    break

        elif mode == "content":
            # 按文件内容搜索
            text_extensions = {".txt", ".py", ".js", ".ts", ".md", ".json", ".yaml", ".yml", ".toml", ".cfg", ".ini"}
            for root, dirs, files in os.walk(base_path):
                dirs[:] = [d for d in dirs if not d.startswith(".")]
                for filename in files:
                    file_path = Path(root) / filename
                    if file_path.suffix.lower() not in text_extensions:
                        continue
                    # 限制文件大小（最大 1MB）
                    if file_path.stat().st_size > 1_048_576:
                        continue
                    try:
                        content = file_path.read_text(encoding="utf-8", errors="ignore")
                        if pattern.lower() in content.lower():
                            # 找到匹配行
                            lines = content.split("\n")
                            matching_lines = [
                                {"line_num": i + 1, "content": line.strip()}
                                for i, line in enumerate(lines)
                                if pattern.lower() in line.lower()
                            ][:5]  # 每个文件最多返回 5 个匹配行
                            results.append({
                                "path": str(file_path),
                                "name": filename,
                                "matching_lines": matching_lines,
                            })
                            if len(results) >= max_results:
                                break
                    except (PermissionError, UnicodeDecodeError):
                        continue
                if len(results) >= max_results:
                    break

    except PermissionError:
        return [TextContent(type="text", text=f"错误：没有权限访问目录 '{directory}'")]

    if not results:
        return [TextContent(type="text", text=f"未找到匹配的文件（模式：{mode}，关键词：{pattern}）")]

    return [TextContent(
        type="text",
        text=json.dumps({
            "total": len(results),
            "results": results,
            "truncated": len(results) >= max_results
        }, ensure_ascii=False, indent=2)
    )]
```

**要点**：
- 参数验证要在执行搜索之前，返回明确的错误信息
- 搜索时要跳过隐藏目录（.git, .node_modules）和二进制文件
- content 模式要限制文件大小，避免读取超大文件导致内存溢出
- 常见错误：不处理 PermissionError，导致遍历到无权限目录时崩溃

### 练习三：用 MCP Inspector 测试边界情况

**思路**：系统性地测试三种边界输入，观察 Tool 的行为是否符合预期（返回友好错误，不崩溃）。

**答案**：

```
测试用例与预期行为：

测试 1：空字符串路径
  输入：{ "directory": "", "mode": "filename", "pattern": "*.py" }
  预期：返回 "错误：目录路径不能为空"
  实际验证：在 Inspector 中输入空字符串，点击 Run

测试 2：不存在的路径
  输入：{ "directory": "/nonexistent/path", "mode": "filename", "pattern": "*.py" }
  预期：返回 "错误：目录不存在 '/nonexistent/path'"
  实际验证：输入一个肯定不存在的路径

测试 3：超大文件路径（content 模式）
  输入：{ "directory": "/path/to/large/files", "mode": "content", "pattern": "TODO" }
  预期：跳过超过 1MB 的文件，只搜索小文件
  实际验证：在目录中放一个 2MB 的日志文件，确认不会被读取

测试 4：特殊字符
  输入：{ "directory": "/tmp", "mode": "content", "pattern": "SELECT * FROM users WHERE name='test'" }
  预期：正常搜索，不报错
  实际验证：确认特殊字符不会导致正则表达式或 JSON 解析错误

测试 5：无权限目录
  输入：{ "directory": "/root", "mode": "filename", "pattern": "*" }
  预期：返回 "错误：没有权限访问目录 '/root'"
  实际验证：在无权限目录上执行搜索

验证清单：
  ☑ 空输入返回友好错误，不崩溃
  ☑ 不存在的路径返回明确提示
  ☑ 超大文件被跳过，不导致内存溢出
  ☑ 特殊字符被安全处理
  ☑ 权限错误被捕获并返回友好信息
  ☑ 结果格式符合 MCP 规范（TextContent 数组）
```

**要点**：
- 测试不仅要验证正常流程，更要验证异常流程
- Tool 应该在任何输入下都不会崩溃，始终返回有意义的结果或错误信息
- 常见错误：只测试正常输入就认为 Tool 完成了，上线后遇到异常输入就崩溃
