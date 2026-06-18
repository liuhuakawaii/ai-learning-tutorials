# 02 Resource 开发——让 AI 访问结构化数据

> MCP Resource 让 AI 能够访问数据库、API、文件等结构化数据。

## 学习目标

- 掌握 MCP Resource 的设计和实现方法
- 理解 Resource 的访问和订阅机制
- 学会实现数据源适配的 Resource

---

## 一、Resource 概念

```
Resource vs Tool：

Tool：执行操作（执行查询、写入数据）
Resource：提供数据（读取数据、获取状态）

Resource 特点：
- 只读访问
- 支持订阅变更
- 适合数据源适配
```

---

## 二、Resource 实现

```python
from mcp.server import Server
from mcp.types import Resource, TextContent

server = Server("my-server")

@server.resource("database://tables")
async def list_tables() -> list[TextContent]:
    """获取数据库表列表"""
    tables = await get_database_tables()
    return [TextContent(
        type="text",
        text=json.dumps(tables)
    )]

@server.resource("database://tables/{table_name}")
async def get_table_schema(table_name: str) -> list[TextContent]:
    """获取表结构"""
    schema = await get_table_schema(table_name)
    return [TextContent(
        type="text",
        text=json.dumps(schema)
    )]
```

---

## 三、Resource 订阅

```python
@server.resource("data://realtime")
async def realtime_data() -> list[TextContent]:
    """实时数据"""
    data = await get_realtime_data()
    return [TextContent(type="text", text=json.dumps(data))]

# 订阅变更
@server.notification("notifications/resources/updated")
async def on_resource_updated(uri: str):
    """资源变更通知"""
    print(f"资源已更新：{uri}")
```

---

## 四、多数据源适配

```python
class DatabaseResource:
    """数据库资源"""
    
    def __init__(self, connection_string: str):
        self.connection = connect(connection_string)
    
    async def list_tables(self) -> list[str]:
        return await self.connection.execute("SHOW TABLES")
    
    async def get_schema(self, table: str) -> dict:
        return await self.connection.execute(f"DESCRIBE {table}")

class APIResource:
    """API 资源"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
    
    async def get_endpoints(self) -> list[str]:
        response = await httpx.get(f"{self.base_url}/endpoints")
        return response.json()
```

---

## 小结

```
本课核心要点：

1. Resource 提供只读数据访问
2. 支持 URI 模式的资源定位
3. 支持订阅资源变更
4. 可以适配多种数据源

下一课：Prompt Template——在 Server 端管理可复用的 Prompt 模板。
```

---

## 练习

1. **实现题**：实现一个数据库 Resource。

2. **订阅题**：实现资源变更订阅。

3. **适配题**：适配一个外部 API 为 Resource。
