# 01 Tool 开发——从需求分析到 Tool 实现的完整流程

> MCP Tool 是最常见的原语。掌握 Tool 开发是 MCP 开发的基础。

## 学习目标

- 掌握 MCP Tool 的设计和实现方法
- 理解 Tool 的输入输出规范
- 学会从需求分析到实现的完整流程

---

## 一、Tool 设计原则

```
Tool 设计原则：

1. 单一职责
   - 每个 Tool 只做一件事
   - 避免过于复杂的 Tool

2. 清晰描述
   - 名称简洁明了
   - 描述准确说明功能
   - 参数描述清楚

3. 输入验证
   - 定义输入 Schema
   - 验证输入参数
   - 处理无效输入

4. 错误处理
   - 返回有意义的错误信息
   - 不要暴露内部细节
   - 支持错误恢复
```

---

## 二、Tool 实现

```python
from mcp.server import Server
from mcp.types import Tool, TextContent

server = Server("my-server")

@server.tool()
async def database_query(sql: str) -> list[TextContent]:
    """执行数据库查询
    
    Args:
        sql: SQL 查询语句
    """
    try:
        # 执行查询
        results = await execute_sql(sql)
        
        # 返回结果
        return [TextContent(
            type="text",
            text=json.dumps(results, ensure_ascii=False)
        )]
    except Exception as e:
        return [TextContent(
            type="text",
            text=f"查询失败：{str(e)}"
        )]

@server.tool()
async def file_read(path: str) -> list[TextContent]:
    """读取文件内容
    
    Args:
        path: 文件路径
    """
    try:
        with open(path, "r") as f:
            content = f.read()
        return [TextContent(type="text", text=content)]
    except FileNotFoundError:
        return [TextContent(type="text", text=f"文件不存在：{path}")]
```

---

## 三、Tool Schema

```python
from pydantic import BaseModel, Field

class DatabaseQueryInput(BaseModel):
    """数据库查询输入"""
    sql: str = Field(description="SQL 查询语句")
    limit: int = Field(default=100, description="返回行数限制")

@server.tool()
async def database_query(input: DatabaseQueryInput) -> list[TextContent]:
    """执行数据库查询"""
    results = await execute_sql(input.sql, limit=input.limit)
    return [TextContent(type="text", text=json.dumps(results))]
```

---

## 四、Tool 注册

```python
# 方式 1：装饰器
@server.tool()
async def my_tool(param: str) -> list[TextContent]:
    ...

# 方式 2：手动注册
server.add_tool(Tool(
    name="my_tool",
    description="我的工具",
    inputSchema={
        "type": "object",
        "properties": {
            "param": {"type": "string"}
        }
    }
))
```

---

## 小结

```
本课核心要点：

1. Tool 设计原则：单一职责、清晰描述、输入验证、错误处理
2. 用 @server.tool() 装饰器注册 Tool
3. 用 Pydantic 定义输入 Schema
4. 返回 TextContent 或其他内容类型

下一课：Resource 开发——让 AI 访问结构化数据。
```

---

## 练习

1. **设计题**：设计一个 Tool 的输入 Schema。

2. **实现题**：实现一个文件读取 Tool。

3. **测试题**：测试你的 Tool 的错误处理。
