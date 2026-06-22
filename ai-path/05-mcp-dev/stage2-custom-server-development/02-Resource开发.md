# 02 Resource 开发——让 AI 访问结构化数据

> **课程定位**：掌握 MCP Resource 的设计和实现，让 AI 能安全地读取结构化数据
> **前置知识**：Tool 开发基础、URI 概念
> **预计时长**：50 分钟

## 场景引入

你的 MCP Server 有一个 query_database Tool，AI 每次想知道"有哪些表"都要写 SQL 查询 information_schema。这不仅浪费 Token，还容易写错 SQL。你希望 AI 能直接"看到"数据库的表结构和数据样本，而不是每次都通过 Tool 去"查"。这就是 Resource 的价值——提供只读的数据视图，让 AI 像浏览文件一样浏览结构化数据。

---

## 学习目标

完成本课学习后，你将能够：

1. 说出 Resource 和 Tool 的本质区别及适用场景
2. 用 Python 和 TypeScript 各实现一个完整的 Resource
3. 设计合理的 URI 模式来组织资源
4. 实现 Resource 的订阅和变更通知机制

---

## 一、Resource vs Tool：本质区别

```
核心区别：操作 vs 读取

┌─────────────────────────────────────────────────────────────┐
│  Tool（工具）                                                │
│  - 有副作用：写入、删除、发送                                 │
│  - 执行动作：query_database(sql) → 执行 SQL                  │
│  - 不幂等：调用两次可能产生不同结果                            │
│                                                              │
│  Resource（资源）                                            │
│  - 无副作用：只读                                            │
│  - 提供数据：database://users → 返回用户列表                  │
│  - 幂等：调用 N 次结果相同                                    │
└─────────────────────────────────────────────────────────────┘

选择指南：
┌─────────────────────────────────────────────────────────────┐
│  需要"做"什么？ → Tool                                       │
│  - 执行 SQL INSERT/UPDATE/DELETE                             │
│  - 发送邮件、调用外部 API                                     │
│  - 创建/修改/删除资源                                        │
│                                                              │
│  需要"看"什么？ → Resource                                   │
│  - 查询数据库表结构                                           │
│  - 读取配置文件                                              │
│  - 获取 API 端点列表                                         │
│  - 读取实时数据流                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、URI 设计模式

```
URI 是 Resource 的地址，设计好坏直接影响 AI 的使用效率。

常用模式：

1. 层级模式
   database://tables                    → 所有表
   database://tables/users              → users 表
   database://tables/users/columns      → users 表的列

2. 实例模式
   file:///etc/config.json              → 特定文件
   api://v1/endpoints                   → API 端点列表
   redis://cache/keys                   → 缓存键列表

3. 查询模式
   db://query/users?status=active       → 带过滤条件
   search://docs?q=mcp&limit=10         → 带搜索参数

设计原则：
  - 使用有意义的 scheme（database://, file://, api://）
  - 层级清晰，从通用到具体
  - 支持参数化（{table_name} 模板）
  - 避免暴露敏感信息（密码、密钥）
```

---

## 三、Python 实现

```python
import json
import asyncio
from mcp.server import Server
from mcp.types import Resource, TextContent

server = Server("database-resource-server")

# ---- 模拟数据库 ----
TABLES = {
    "users": {
        "columns": [
            {"name": "id", "type": "INT", "primary_key": True},
            {"name": "email", "type": "VARCHAR(255)", "unique": True},
            {"name": "name", "type": "VARCHAR(100)"},
            {"name": "created_at", "type": "TIMESTAMP"},
        ],
        "row_count": 1250,
    },
    "orders": {
        "columns": [
            {"name": "id", "type": "INT", "primary_key": True},
            {"name": "user_id", "type": "INT", "foreign_key": "users.id"},
            {"name": "total", "type": "DECIMAL(10,2)"},
            {"name": "status", "type": "VARCHAR(20)"},
        ],
        "row_count": 8432,
    },
}


# ---- Resource 1：表列表 ----
@server.resource("database://tables")
async def list_tables() -> list[TextContent]:
    """返回所有表的概要信息"""
    summary = {
        name: {"row_count": t["row_count"], "column_count": len(t["columns"])}
        for name, t in TABLES.items()
    }
    return [TextContent(type="text", text=json.dumps(summary, indent=2))]


# ---- Resource 2：表结构 ----
@server.resource("database://tables/{table_name}")
async def get_table_schema(table_name: str) -> list[TextContent]:
    """返回指定表的完整结构"""
    if table_name not in TABLES:
        return [TextContent(type="text", text=f"Error: table '{table_name}' not found")]
    return [TextContent(type="text", text=json.dumps(TABLES[table_name], indent=2))]


# ---- Resource 3：表数据采样 ----
@server.resource("database://tables/{table_name}/sample")
async def get_table_sample(table_name: str) -> list[TextContent]:
    """返回表的前 5 行数据（用于 AI 理解数据格式）"""
    if table_name not in TABLES:
        return [TextContent(type="text", text=f"Error: table '{table_name}' not found")]

    # 模拟采样数据
    sample = {
        "table": table_name,
        "columns": [c["name"] for c in TABLES[table_name]["columns"]],
        "sample_rows": [
            {c["name": f"sample_{c['name']}"] for c in TABLES[table_name]["columns"]}
        ],
        "note": "This is a sample. Use the query_database tool for full data.",
    }
    return [TextContent(type="text", text=json.dumps(sample, indent=2))]


# ---- Resource 4：数据库状态 ----
@server.resource("database://status")
async def get_db_status() -> list[TextContent]:
    """返回数据库连接状态和统计"""
    status = {
        "connected": True,
        "version": "PostgreSQL 16.2",
        "total_tables": len(TABLES),
        "total_rows": sum(t["row_count"] for t in TABLES.values()),
        "uptime_hours": 720,
    }
    return [TextContent(type="text", text=json.dumps(status, indent=2))]
```

---

## 四、TypeScript 实现

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "file-resource-server", version: "1.0.0" },
  { capabilities: { resources: {} } }
);

// ---- 资源注册表 ----
interface ResourceEntry {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  read: () => Promise<string>;
}

const resources: ResourceEntry[] = [
  {
    uri: "config://app/settings",
    name: "应用配置",
    description: "当前应用的配置信息（不含敏感字段）",
    mimeType: "application/json",
    read: async () =>
      JSON.stringify({
        app_name: "MyApp",
        version: "1.2.0",
        features: { dark_mode: true, i18n: false },
      }),
  },
  {
    uri: "config://app/env",
    name: "环境变量",
    description: "当前环境的非敏感变量",
    mimeType: "application/json",
    read: async () =>
      JSON.stringify({
        NODE_ENV: process.env.NODE_ENV || "development",
        PORT: process.env.PORT || "3000",
        LOG_LEVEL: process.env.LOG_LEVEL || "info",
      }),
  },
];

// ---- 列出所有资源 ----
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: resources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    })),
  };
});

// ---- 读取资源内容 ----
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resource = resources.find((r) => r.uri === request.params.uri);
  if (!resource) {
    throw new Error(`Resource not found: ${request.params.uri}`);
  }
  const content = await resource.read();
  return {
    contents: [
      { uri: resource.uri, mimeType: resource.mimeType, text: content },
    ],
  };
});
```

---

## 五、Resource 订阅机制

```
Resource 支持实时订阅，当数据变化时通知 Client：

┌─────────────────────────────────────────────────────────────┐
│  订阅流程：                                                  │
│                                                              │
│  1. Client → Server: resources/subscribe { uri }             │
│  2. Server: 开始监听该资源                                    │
│  3. 数据变化时 → Server → Client: notifications/resources/updated │
│  4. Client 重新读取资源                                       │
└─────────────────────────────────────────────────────────────┘

适用场景：
  - 实时监控数据（CPU、内存、请求量）
  - 配置热更新
  - 数据库变更通知
  - WebSocket 数据流
```

```python
# Python 实现订阅
import asyncio
from datetime import datetime

class ResourceWatcher:
    """资源变更监听器"""

    def __init__(self):
        self._subscribers: dict[str, set[str]] = {}  # uri → session_ids
        self._last_values: dict[str, str] = {}

    def subscribe(self, uri: str, session_id: str):
        if uri not in self._subscribers:
            self._subscribers[uri] = set()
        self._subscribers[uri].add(session_id)

    def unsubscribe(self, uri: str, session_id: str):
        if uri in self._subscribers:
            self._subscribers[uri].discard(session_id)

    async def check_and_notify(self, uri: str, current_value: str):
        """检查值是否变化，变化则通知订阅者"""
        if self._last_values.get(uri) != current_value:
            self._last_values[uri] = current_value
            await self._notify_subscribers(uri)

    async def _notify_subscribers(self, uri: str):
        """通知所有订阅者"""
        for session_id in self._subscribers.get(uri, []):
            # 通过 MCP 通知机制发送
            print(f"Notifying {session_id}: {uri} updated at {datetime.now()}")
```

---

## 六、安全注意事项

```
Resource 安全清单：

1. 权限控制
   ┌─────────────────────────────────────────────────────────┐
   │  - 不同用户看到不同的 Resource                           │
   │  - 敏感数据需要鉴权后才能访问                             │
   │  - 使用 session 或 token 验证身份                        │
   └─────────────────────────────────────────────────────────┘

2. 数据脱敏
   ┌─────────────────────────────────────────────────────────┐
   │  - 返回数据时过滤敏感字段（密码、密钥、手机号）            │
   │  - 日志中不记录 Resource 内容                            │
   │  - 限制返回数据量（避免一次性返回百万行）                  │
   └─────────────────────────────────────────────────────────┘

3. 输入验证
   ┌─────────────────────────────────────────────────────────┐
   │  - URI 参数需要验证（防止路径遍历攻击）                   │
   │  - {table_name} 参数要白名单校验                         │
   │  - 避免 SQL 注入（参数化查询）                            │
   └─────────────────────────────────────────────────────────┘

4. 速率限制
   ┌─────────────────────────────────────────────────────────┐
   │  - 限制 Resource 读取频率                                 │
   │  - 大数据量 Resource 需要分页                             │
   │  - 缓存频繁访问的 Resource                                │
   └─────────────────────────────────────────────────────────┘
```

---

## 七、实战：文件系统 Resource

```python
import os
from pathlib import Path

server = Server("filesystem-resource")

BASE_DIR = Path("/safe/root")  # 限制根目录


@server.resource("file:///{path}")
async def read_file(path: str) -> list[TextContent]:
    """安全地读取文件内容"""
    # 安全检查：防止路径遍历
    full_path = (BASE_DIR / path).resolve()
    if not str(full_path).startswith(str(BASE_DIR.resolve())):
        return [TextContent(type="text", text="Error: access denied")]

    if not full_path.exists():
        return [TextContent(type="text", text=f"Error: file '{path}' not found")]

    if not full_path.is_file():
        return [TextContent(type="text", text=f"Error: '{path}' is not a file")]

    # 限制文件大小（最大 1MB）
    if full_path.stat().st_size > 1_048_576:
        return [TextContent(type="text", text="Error: file too large (max 1MB)")]

    content = full_path.read_text(encoding="utf-8", errors="replace")
    return [TextContent(type="text", text=content)]


@server.resource("file:///{path}/tree")
async def list_directory(path: str) -> list[TextContent]:
    """列出目录结构"""
    full_path = (BASE_DIR / path).resolve()
    if not str(full_path).startswith(str(BASE_DIR.resolve())):
        return [TextContent(type="text", text="Error: access denied")]

    if not full_path.is_dir():
        return [TextContent(type="text", text=f"Error: '{path}' is not a directory")]

    entries = []
    for entry in sorted(full_path.iterdir()):
        entries.append({
            "name": entry.name,
            "type": "directory" if entry.is_dir() else "file",
            "size": entry.stat().st_size if entry.is_file() else None,
        })
    return [TextContent(type="text", text=json.dumps(entries, indent=2))]
```

## 常见误区

```
误区 1：Resource 就是没有参数的 Tool
  Resource 和 Tool 的本质区别不是有没有参数，而是有没有副作用。
  Resource 是幂等的只读操作，Tool 是有副作用的动作。

误区 2：URI 可以随便设计
  URI 是 AI 理解资源结构的关键。糟糕的 URI 设计会导致 AI 无法有效发现和使用资源。
  用层级结构（scheme://collection/item）让 AI 能逐层浏览。

误区 3：Resource 不需要鉴权
  Resource 虽然是只读的，但数据本身可能敏感。
  数据库表结构、配置文件、用户信息都需要权限控制。

误区 4：返回数据越多越好
  Resource 应该返回 AI 需要的最小数据集。
  返回百万行数据不仅浪费带宽，还会超出模型的上下文窗口。
```

---

## 工程建议

```
1. Resource 和 Tool 配合使用
  Resource 提供数据视图（表结构、配置），Tool 执行操作（查询、修改）。
  AI 先通过 Resource 了解数据结构，再通过 Tool 执行操作。

2. URI 用 scheme 区分数据源
  database://tables、file:///path、config://settings——
  不同 scheme 让 AI 快速识别数据类型和来源。

3. 采样数据比全量数据更有用
  返回前 5 行数据样本，比返回全量数据更能帮 AI 理解数据格式。
  在 Resource 的 description 中说明"这是样本数据"。

4. 订阅机制用于实时数据
  对于会变化的数据（数据库状态、文件内容），实现 Resource 订阅。
  数据变化时主动通知 Client，避免轮询带来的性能开销。
```

---

## 小结

1. Resource = 只读数据访问，Tool = 有副作用的操作
2. URI 设计：层级清晰、参数化、安全性
3. Python 和 TypeScript 都能实现完整的 Resource
4. 订阅机制让 Client 能实时感知数据变化
5. 安全是第一要务：权限控制、数据脱敏、路径校验

---

**下一课**: [03 Prompt Template——在 Server 端管理可复用的 Prompt 模板](./03-Prompt-Template.md)
```

---

## 练习

1. **实现题**：为你的项目数据库实现一个 Resource Server，包含表列表、表结构、数据采样三个 Resource。

2. **URI 设计题**：为一个 Redis 缓存服务设计 Resource URI 体系，包括键列表、键值读取、过期时间查询。

3. **安全题**：实现一个文件系统 Resource，要求：(a) 防止路径遍历；(b) 限制文件大小；(c) 过滤敏感文件（.env、*.key）。

4. **订阅题**：实现一个 Resource Watcher，当文件内容变化时通知 Client。

---

## 参考答案

### 练习一：实现数据库 Resource Server

**思路**：用 Python 实现三个 Resource，分别返回表列表、表结构、数据采样。注意 URI 设计要层级清晰，返回数据要精简。

**答案**：

```python
import json
from mcp.server import Server
from mcp.types import TextContent

server = Server("database-resource-server")

# 模拟数据库
TABLES = {
    "users": {
        "columns": [
            {"name": "id", "type": "INT", "primary_key": True},
            {"name": "email", "type": "VARCHAR(255)", "unique": True},
            {"name": "name", "type": "VARCHAR(100)"},
            {"name": "status", "type": "VARCHAR(20)"},
            {"name": "created_at", "type": "TIMESTAMP"},
        ],
        "row_count": 1250,
    },
    "orders": {
        "columns": [
            {"name": "id", "type": "INT", "primary_key": True},
            {"name": "user_id", "type": "INT", "foreign_key": "users.id"},
            {"name": "total", "type": "DECIMAL(10,2)"},
            {"name": "status", "type": "VARCHAR(20)"},
            {"name": "created_at", "type": "TIMESTAMP"},
        ],
        "row_count": 8432,
    },
    "products": {
        "columns": [
            {"name": "id", "type": "INT", "primary_key": True},
            {"name": "name", "type": "VARCHAR(200)"},
            {"name": "price", "type": "DECIMAL(10,2)"},
            {"name": "stock", "type": "INT"},
        ],
        "row_count": 356,
    },
}


@server.resource("database://tables")
async def list_tables() -> list[TextContent]:
    """返回所有表的概要信息（表名、行数、列数）"""
    summary = {}
    for name, table in TABLES.items():
        summary[name] = {
            "row_count": table["row_count"],
            "column_count": len(table["columns"]),
            "columns_preview": [c["name"] for c in table["columns"][:3]],
        }
    return [TextContent(
        type="text",
        text=json.dumps(summary, ensure_ascii=False, indent=2)
    )]


@server.resource("database://tables/{table_name}")
async def get_table_schema(table_name: str) -> list[TextContent]:
    """返回指定表的完整结构（列名、类型、约束）"""
    if table_name not in TABLES:
        return [TextContent(
            type="text",
            text=json.dumps({"error": f"表 '{table_name}' 不存在", "available_tables": list(TABLES.keys())})
        )]
    table = TABLES[table_name]
    return [TextContent(
        type="text",
        text=json.dumps({
            "table_name": table_name,
            "row_count": table["row_count"],
            "columns": table["columns"],
        }, ensure_ascii=False, indent=2)
    )]


@server.resource("database://tables/{table_name}/sample")
async def get_table_sample(table_name: str) -> list[TextContent]:
    """返回表的前 5 行模拟数据（用于 AI 理解数据格式）"""
    if table_name not in TABLES:
        return [TextContent(type="text", text=json.dumps({"error": f"表 '{table_name}' 不存在"}))]

    table = TABLES[table_name]
    columns = [c["name"] for c in table["columns"]]
    # 生成模拟数据
    sample_rows = []
    for i in range(min(5, table["row_count"])):
        row = {}
        for col in table["columns"]:
            if col["type"] == "INT":
                row[col["name"]] = i + 1
            elif "VARCHAR" in col["type"]:
                row[col["name"]] = f"sample_{col['name']}_{i}"
            elif "DECIMAL" in col["type"]:
                row[col["name"]] = round(10.5 * (i + 1), 2)
            elif col["type"] == "TIMESTAMP":
                row[col["name"]] = "2024-01-01T00:00:00Z"
        sample_rows.append(row)

    return [TextContent(
        type="text",
        text=json.dumps({
            "table_name": table_name,
            "columns": columns,
            "sample_rows": sample_rows,
            "note": "这是模拟采样数据，使用 query_database Tool 获取真实数据",
        }, ensure_ascii=False, indent=2)
    )]
```

**要点**：
- Resource 返回的是"数据视图"，不是原始数据——要精简、结构化
- 采样数据用模拟数据即可，目的是让 AI 理解数据格式，不是提供真实数据
- URI 用层级结构（database://tables → database://tables/{name} → database://tables/{name}/sample）
- 常见错误：返回全量数据（如 1250 行用户数据），浪费 Token 且超出上下文窗口

### 练习二：为 Redis 设计 Resource URI

**思路**：Redis 的数据结构多样（String、Hash、List、Set、ZSet），URI 设计要能表达这些结构，同时支持层级浏览。

**答案**：

```
Redis Resource URI 体系：

一、基础资源

  1. redis://keys
     描述：所有键的列表（带类型和 TTL）
     返回示例：
     {
       "total_keys": 156,
       "keys": [
         {"key": "user:1001", "type": "hash", "ttl": 3600},
         {"key": "session:abc123", "type": "string", "ttl": 1800},
         {"key": "cache:products", "type": "list", "ttl": -1}
       ]
     }

  2. redis://keys/{key}
     描述：指定键的详细信息（类型、值、TTL、内存占用）
     返回示例（Hash 类型）：
     {
       "key": "user:1001",
       "type": "hash",
       "ttl": 3600,
       "size": 5,
       "fields": {
         "name": "Alice",
         "email": "alice@example.com",
         "status": "active"
       }
     }

  3. redis://keys/{key}/ttl
     描述：指定键的过期时间详情
     返回示例：
     {
       "key": "user:1001",
       "ttl_seconds": 3600,
       "expires_at": "2024-01-01T01:00:00Z",
       "is_persistent": false
     }

二、按类型浏览

  4. redis://keys/by-type/{type}
     描述：按类型筛选键（string, hash, list, set, zset）
     返回示例：
     {
       "type": "hash",
       "count": 42,
       "keys": ["user:1001", "user:1002", "config:app"]
     }

三、统计资源

  5. redis://stats
     描述：Redis 服务器状态概览
     返回示例：
     {
       "version": "7.2.0",
       "used_memory": "128MB",
       "connected_clients": 15,
       "total_keys": 156,
       "uptime_hours": 720
     }

  6. redis://stats/memory
     描述：内存使用详情
     返回示例：
     {
       "used_memory": 134217728,
       "used_memory_peak": 268435456,
       "memory_fragmentation_ratio": 1.2,
       "keys_by_type": {
         "string": 50,
         "hash": 42,
         "list": 30,
         "set": 20,
         "zset": 14
       }
     }

设计要点：
  - scheme 用 redis://，让 AI 一眼识别这是 Redis 数据
  - 按层级组织：keys → keys/{key} → keys/{key}/ttl
  - 按类型分组：keys/by-type/{type}
  - 提供统计信息：stats、stats/memory
  - 敏感信息（密码、连接串）不出现在 Resource 中
```

**要点**：
- URI 设计要让 AI 能"逐层浏览"——先看列表，再看详情
- 不同数据类型（Hash、List、Set）的返回格式要统一
- TTL 信息单独成 Resource，方便 AI 判断缓存是否即将过期
- 常见错误：把所有信息塞到一个 URI 里，返回数据过多

### 练习三：实现安全的文件系统 Resource

**思路**：实现三层安全防护：路径遍历防护（resolve + 白名单）、文件大小限制、敏感文件过滤。

**答案**：

```python
import json
import os
from pathlib import Path
from mcp.server import Server
from mcp.types import TextContent

server = Server("secure-filesystem")

# 安全配置
BASE_DIR = Path("/safe/root").resolve()
MAX_FILE_SIZE = 1_048_576  # 1MB
SENSITIVE_PATTERNS = {".env", ".env.*", "*.key", "*.pem", "*.secret", "credentials.*", "*.p12"}


def is_sensitive(filename: str) -> bool:
    """检查文件是否为敏感文件"""
    import fnmatch
    for pattern in SENSITIVE_PATTERNS:
        if fnmatch.fnmatch(filename.lower(), pattern.lower()):
            return True
    return False


def safe_resolve(path: str) -> Path | None:
    """安全地解析路径，防止路径遍历"""
    try:
        resolved = (BASE_DIR / path).resolve()
        # 关键检查：解析后的路径必须在 BASE_DIR 下
        if not str(resolved).startswith(str(BASE_DIR)):
            return None
        return resolved
    except (ValueError, OSError):
        return None


@server.resource("file:///{path}")
async def read_file(path: str) -> list[TextContent]:
    """安全地读取文件内容"""
    # 1. 路径遍历防护
    full_path = safe_resolve(path)
    if full_path is None:
        return [TextContent(type="text", text=json.dumps({
            "error": "访问被拒绝：路径超出允许范围",
            "allowed_root": str(BASE_DIR)
        }))]

    # 2. 文件存在性检查
    if not full_path.exists():
        return [TextContent(type="text", text=json.dumps({"error": f"文件不存在: {path}"}))]
    if not full_path.is_file():
        return [TextContent(type="text", text=json.dumps({"error": f"路径不是文件: {path}"}))]

    # 3. 敏感文件过滤
    if is_sensitive(full_path.name):
        return [TextContent(type="text", text=json.dumps({
            "error": "访问被拒绝：该文件为敏感文件",
            "reason": "敏感文件（.env, *.key, *.pem 等）不允许通过 MCP 访问"
        }))]

    # 4. 文件大小限制
    file_size = full_path.stat().st_size
    if file_size > MAX_FILE_SIZE:
        return [TextContent(type="text", text=json.dumps({
            "error": f"文件过大（{file_size} bytes），最大允许 {MAX_FILE_SIZE} bytes",
            "suggestion": "使用 search_files Tool 搜索特定内容"
        }))]

    # 5. 读取文件
    try:
        content = full_path.read_text(encoding="utf-8", errors="replace")
        return [TextContent(type="text", text=json.dumps({
            "path": str(full_path.relative_to(BASE_DIR)),
            "size": file_size,
            "content": content
        }, ensure_ascii=False))]
    except PermissionError:
        return [TextContent(type="text", text=json.dumps({"error": "没有权限读取该文件"}))]


@server.resource("file:///{path}/tree")
async def list_directory(path: str) -> list[TextContent]:
    """安全地列出目录内容"""
    full_path = safe_resolve(path)
    if full_path is None:
        return [TextContent(type="text", text=json.dumps({"error": "访问被拒绝"}))]

    if not full_path.exists() or not full_path.is_dir():
        return [TextContent(type="text", text=json.dumps({"error": f"目录不存在: {path}"}))]

    entries = []
    for entry in sorted(full_path.iterdir()):
        # 过滤敏感文件
        if entry.is_file() and is_sensitive(entry.name):
            entries.append({"name": entry.name, "type": "file", "access": "denied"})
        else:
            entries.append({
                "name": entry.name,
                "type": "directory" if entry.is_dir() else "file",
                "size": entry.stat().st_size if entry.is_file() else None,
            })

    return [TextContent(type="text", text=json.dumps({
        "path": str(full_path.relative_to(BASE_DIR)),
        "entries": entries,
        "total": len(entries)
    }, ensure_ascii=False, indent=2))]
```

**要点**：
- 路径遍历防护的核心是 resolve() + startswith() 检查，不能只用字符串拼接
- 敏感文件要用白名单模式匹配（.env, *.key），不能只靠后缀名
- 列目录时也要过滤敏感文件，不能只在读文件时过滤
- 常见错误：只检查了文件读取，忘记在目录列表中也过滤敏感文件

### 练习四：实现 Resource Watcher

**思路**：用文件哈希或修改时间检测文件变化，变化时通过 MCP 通知机制告知 Client。

**答案**：

```python
import asyncio
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Callable


class ResourceWatcher:
    """文件资源变更监听器"""

    def __init__(self, check_interval: float = 5.0):
        self._subscribers: dict[str, set[str]] = {}  # uri → session_ids
        self._file_hashes: dict[str, str] = {}  # path → md5 hash
        self._file_mtimes: dict[str, float] = {}  # path → modification time
        self._check_interval = check_interval
        self._running = False
        self._notify_callback: Callable | None = None

    def set_notify_callback(self, callback: Callable):
        """设置通知回调（用于发送 MCP 通知）"""
        self._notify_callback = callback

    def subscribe(self, uri: str, session_id: str):
        """订阅资源变更"""
        if uri not in self._subscribers:
            self._subscribers[uri] = set()
            # 首次订阅时记录文件当前状态
            file_path = self._uri_to_path(uri)
            if file_path and file_path.exists():
                self._file_hashes[uri] = self._compute_hash(file_path)
                self._file_mtimes[uri] = file_path.stat().st_mtime
        self._subscribers[uri].add(session_id)

    def unsubscribe(self, uri: str, session_id: str):
        """取消订阅"""
        if uri in self._subscribers:
            self._subscribers[uri].discard(session_id)
            if not self._subscribers[uri]:
                del self._subscribers[uri]
                self._file_hashes.pop(uri, None)
                self._file_mtimes.pop(uri, None)

    async def start(self):
        """启动监听循环"""
        self._running = True
        while self._running:
            await self._check_all_subscriptions()
            await asyncio.sleep(self._check_interval)

    async def stop(self):
        """停止监听"""
        self._running = False

    async def _check_all_subscriptions(self):
        """检查所有订阅的资源是否变化"""
        for uri in list(self._subscribers.keys()):
            file_path = self._uri_to_path(uri)
            if not file_path or not file_path.exists():
                continue

            current_mtime = file_path.stat().st_mtime
            if uri in self._file_mtimes and current_mtime != self._file_mtimes[uri]:
                # 修改时间变化，进一步检查哈希
                current_hash = self._compute_hash(file_path)
                if current_hash != self._file_hashes.get(uri):
                    self._file_hashes[uri] = current_hash
                    self._file_mtimes[uri] = current_mtime
                    await self._notify_change(uri)

    async def _notify_change(self, uri: str):
        """通知所有订阅者"""
        if self._notify_callback:
            for session_id in self._subscribers.get(uri, []):
                await self._notify_callback(session_id, uri)

    def _compute_hash(self, file_path: Path) -> str:
        """计算文件内容的 MD5 哈希"""
        try:
            content = file_path.read_bytes()
            return hashlib.md5(content).hexdigest()
        except (PermissionError, OSError):
            return ""

    def _uri_to_path(self, uri: str) -> Path | None:
        """将 file:/// URI 转换为本地路径"""
        if uri.startswith("file:///"):
            path_str = uri[8:]  # 去掉 file:///
            return Path(path_str).resolve()
        return None


# 使用示例
async def main():
    watcher = ResourceWatcher(check_interval=2.0)

    # 设置通知回调
    async def on_change(session_id: str, uri: str):
        notification = {
            "jsonrpc": "2.0",
            "method": "notifications/resources/updated",
            "params": {"uri": uri}
        }
        print(f"[{datetime.now()}] 通知 {session_id}: {uri} 已变更")

    watcher.set_notify_callback(on_change)

    # Client 订阅资源
    watcher.subscribe("file:///etc/config.json", "session-001")

    # 启动监听
    await watcher.start()


if __name__ == "__main__":
    asyncio.run(main())
```

**要点**：
- 用修改时间（mtime）做初筛，用内容哈希做确认，避免频繁读取文件
- 首次订阅时记录文件当前状态，避免立即触发一次"变更"通知
- 监听循环要设置合理的间隔（如 2-5 秒），太频繁会浪费 CPU
- 常见错误：只用修改时间判断变化，某些编辑器保存文件会更新 mtime 但内容不变
