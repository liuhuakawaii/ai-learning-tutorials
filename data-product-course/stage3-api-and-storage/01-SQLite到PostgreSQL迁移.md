# 第1课：SQLite 到 PostgreSQL 的迁移思路

> **课程定位**：理解不同数据库的适用场景，掌握数据库迁移的方法
> **前置知识**：第二阶段全部课程
> **预计时长**：45 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 对比 SQLite 和 PostgreSQL 的特点和适用场景
2. 设计数据库迁移策略
3. 实现数据迁移脚本
4. 处理迁移过程中的数据类型转换
5. 验证迁移后的数据完整性

---

## 一、SQLite vs PostgreSQL

### 1.1 特点对比

```
┌──────────────────────────────────────────────────────────────┐
│                SQLite vs PostgreSQL                           │
├────────────────┬─────────────────┬───────────────────────────┤
│     维度       │     SQLite      │      PostgreSQL           │
├────────────────┼─────────────────┼───────────────────────────┤
│  部署方式      │  嵌入式，单文件  │  独立服务，客户端连接      │
│  并发能力      │  低（单写多读）  │  高（多写多读）           │
│  数据容量      │  GB 级          │  TB 级                    │
│  功能特性      │  基础 SQL       │  高级特性丰富             │
│  JSON 支持     │  基础           │  强大（JSONB）            │
│  全文搜索      │  有限           │  强大                     │
│  扩展性        │  无             │  丰富扩展                 │
│  运维复杂度    │  极低           │  中等                     │
│  适用场景      │  开发、测试     │  生产环境                 │
└────────────────┴─────────────────┴───────────────────────────┘
```

### 1.2 适用场景

```
┌──────────────────────────────────────────────────────────────┐
│                    适用场景                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  选择 SQLite 当：                                             │
│  ├── 开发和测试阶段                                          │
│  ├── 数据量小（< 1GB）                                       │
│  ├── 单用户或低并发                                          │
│  ├── 嵌入式应用                                              │
│  └── 不想运维数据库服务                                      │
│                                                              │
│  选择 PostgreSQL 当：                                         │
│  ├── 生产环境                                                │
│  ├── 数据量大（> 1GB）                                       │
│  ├── 需要高并发                                              │
│  ├── 需要高级特性（JSONB、全文搜索）                         │
│  └── 需要数据安全和备份                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 数据类型映射

```
┌──────────────────────────────────────────────────────────────┐
│                    数据类型映射                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  SQLite              →  PostgreSQL                           │
│  ─────────────────────────────────────────                   │
│  INTEGER             →  INTEGER / BIGINT / SERIAL            │
│  REAL                →  REAL / DOUBLE PRECISION              │
│  TEXT                →  VARCHAR(n) / TEXT                     │
│  BLOB                →  BYTEA                                │
│  BOOLEAN (0/1)       →  BOOLEAN                              │
│  DATE (字符串)       →  DATE                                  │
│  DATETIME (字符串)   →  TIMESTAMP / TIMESTAMPTZ               │
│  JSON (字符串)       →  JSON / JSONB                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、迁移策略

### 2.1 迁移方式

```
┌──────────────────────────────────────────────────────────────┐
│                    迁移方式                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  方式 1：直接迁移                                              │
│  ├── 一次性把所有数据从 SQLite 导出再导入 PostgreSQL          │
│  ├── 优点：简单直接                                          │
│  └── 缺点：停机时间长                                        │
│                                                              │
│  方式 2：双写迁移                                              │
│  ├── 同时写入两个数据库，逐步切换                            │
│  ├── 优点：零停机                                            │
│  └── 缺点：实现复杂                                          │
│                                                              │
│  方式 3：ETL 迁移                                              │
│  ├── 通过 ETL 工具进行数据迁移和转换                         │
│  ├── 优点：可以做数据清洗                                    │
│  └── 缺点：需要额外开发                                      │
│                                                              │
│  推荐：开发阶段用 SQLite，生产环境用 PostgreSQL               │
│        通过 ETL 脚本实现数据迁移                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 迁移流程

```
┌──────────────────────────────────────────────────────────────┐
│                    迁移流程                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 准备阶段                                                  │
│     ├── 分析 SQLite 表结构                                   │
│     ├── 设计 PostgreSQL 表结构                               │
│     └── 准备迁移脚本                                         │
│                                                              │
│  2. 结构迁移                                                  │
│     ├── 创建 PostgreSQL 数据库                               │
│     ├── 创建表和索引                                         │
│     └── 创建约束和触发器                                     │
│                                                              │
│  3. 数据迁移                                                  │
│     ├── 导出 SQLite 数据                                     │
│     ├── 转换数据类型                                         │
│     └── 导入 PostgreSQL                                      │
│                                                              │
│  4. 验证阶段                                                  │
│     ├── 检查数据完整性                                       │
│     ├── 对比数据一致性                                       │
│     └── 测试应用功能                                         │
│                                                              │
│  5. 切换阶段                                                  │
│     ├── 更新应用配置                                         │
│     ├── 切换数据库连接                                       │
│     └── 监控运行状态                                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 三、迁移实现

### 3.1 SQLite 读取器

```python
import sqlite3
import pandas as pd
from typing import List, Dict, Any

class SQLiteReader:
    """SQLite 数据读取器"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
    
    def get_tables(self) -> List[str]:
        """获取所有表名"""
        query = "SELECT name FROM sqlite_master WHERE type='table'"
        cursor = self.conn.execute(query)
        return [row[0] for row in cursor.fetchall()]
    
    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        """获取表结构"""
        query = f"PRAGMA table_info({table_name})"
        cursor = self.conn.execute(query)
        
        schema = []
        for row in cursor.fetchall():
            schema.append({
                "cid": row[0],
                "name": row[1],
                "type": row[2],
                "notnull": row[3],
                "default": row[4],
                "pk": row[5]
            })
        
        return schema
    
    def read_table(self, table_name: str) -> pd.DataFrame:
        """读取表数据"""
        query = f"SELECT * FROM {table_name}"
        return pd.read_sql(query, self.conn)
    
    def read_with_query(self, query: str) -> pd.DataFrame:
        """执行查询"""
        return pd.read_sql(query, self.conn)
    
    def close(self):
        """关闭连接"""
        self.conn.close()
```

### 3.2 PostgreSQL 写入器

```python
import pandas as pd
from sqlalchemy import create_engine, text
from typing import List, Dict, Any

class PostgreSQLWriter:
    """PostgreSQL 数据写入器"""
    
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string)
    
    def create_table(self, table_name: str, schema: List[Dict[str, Any]]):
        """创建表"""
        
        # 映射数据类型
        type_mapping = {
            "INTEGER": "BIGINT",
            "REAL": "DOUBLE PRECISION",
            "TEXT": "TEXT",
            "BLOB": "BYTEA",
            "BOOLEAN": "BOOLEAN",
            "DATE": "DATE",
            "DATETIME": "TIMESTAMP",
            "JSON": "JSONB"
        }
        
        columns = []
        for col in schema:
            col_type = type_mapping.get(col["type"].upper(), "TEXT")
            nullable = "NOT NULL" if col["notnull"] else ""
            primary = "PRIMARY KEY" if col["pk"] else ""
            
            columns.append(f"{col['name']} {col_type} {nullable} {primary}")
        
        create_sql = f"""
            CREATE TABLE IF NOT EXISTS {table_name} (
                {', '.join(columns)}
            )
        """
        
        with self.engine.connect() as conn:
            conn.execute(text(create_sql))
            conn.commit()
    
    def write_dataframe(
        self,
        table_name: str,
        df: pd.DataFrame,
        if_exists: str = "append",
        batch_size: int = 1000
    ) -> int:
        """写入 DataFrame"""
        
        df.to_sql(
            table_name,
            self.engine,
            if_exists=if_exists,
            index=False,
            chunksize=batch_size
        )
        
        return len(df)
    
    def execute_sql(self, sql: str, params: Dict = None):
        """执行 SQL"""
        with self.engine.connect() as conn:
            conn.execute(text(sql), params or {})
            conn.commit()
    
    def close(self):
        """关闭连接"""
        self.engine.dispose()
```

### 3.3 数据迁移器

```python
from typing import List, Dict, Any
import pandas as pd

class DataMigrator:
    """数据迁移器"""
    
    def __init__(
        self,
        sqlite_path: str,
        pg_connection: str
    ):
        self.reader = SQLiteReader(sqlite_path)
        self.writer = PostgreSQLWriter(pg_connection)
    
    def migrate_all(self) -> Dict[str, Any]:
        """迁移所有表"""
        
        tables = self.reader.get_tables()
        results = {}
        
        for table in tables:
            result = self.migrate_table(table)
            results[table] = result
        
        return results
    
    def migrate_table(self, table_name: str) -> Dict[str, Any]:
        """迁移单个表"""
        
        print(f"迁移表: {table_name}")
        
        try:
            # 1. 获取表结构
            schema = self.reader.get_table_schema(table_name)
            
            # 2. 创建 PostgreSQL 表
            self.writer.create_table(table_name, schema)
            
            # 3. 读取数据
            data = self.reader.read_table(table_name)
            
            # 4. 转换数据类型
            data = self._convert_types(data, schema)
            
            # 5. 写入 PostgreSQL
            count = self.writer.write_dataframe(table_name, data)
            
            return {
                "status": "success",
                "record_count": count
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error": str(e)
            }
    
    def _convert_types(
        self,
        data: pd.DataFrame,
        schema: List[Dict[str, Any]]
    ) -> pd.DataFrame:
        """转换数据类型"""
        
        for col in schema:
            col_name = col["name"]
            col_type = col["type"].upper()
            
            if col_name not in data.columns:
                continue
            
            if col_type == "BOOLEAN":
                # SQLite 用 0/1 表示布尔值
                data[col_name] = data[col_name].astype(bool)
            
            elif col_type in ["DATE", "DATETIME"]:
                # 转换日期时间
                data[col_name] = pd.to_datetime(data[col_name], errors="coerce")
            
            elif col_type == "JSON":
                # JSON 字符串保持原样
                pass
        
        return data
    
    def close(self):
        """关闭连接"""
        self.reader.close()
        self.writer.close()
```

---

## 四、迁移验证

### 4.1 验证器

```python
class MigrationValidator:
    """迁移验证器"""
    
    def __init__(self, sqlite_path: str, pg_connection: str):
        self.reader = SQLiteReader(sqlite_path)
        self.writer = PostgreSQLWriter(pg_connection)
    
    def validate_all(self) -> Dict[str, Any]:
        """验证所有表"""
        
        tables = self.reader.get_tables()
        results = {}
        
        for table in tables:
            result = self.validate_table(table)
            results[table] = result
        
        return results
    
    def validate_table(self, table_name: str) -> Dict[str, Any]:
        """验证单个表"""
        
        # 读取源和目标数据
        source_data = self.reader.read_table(table_name)
        target_data = pd.read_sql(f"SELECT * FROM {table_name}", self.writer.engine)
        
        # 比较记录数
        source_count = len(source_data)
        target_count = len(target_data)
        
        # 比较列数
        source_cols = set(source_data.columns)
        target_cols = set(target_data.columns)
        
        return {
            "source_count": source_count,
            "target_count": target_count,
            "count_match": source_count == target_count,
            "source_columns": len(source_cols),
            "target_columns": len(target_cols),
            "columns_match": source_cols == target_cols,
            "missing_columns": list(source_cols - target_cols),
            "extra_columns": list(target_cols - source_cols)
        }
    
    def close(self):
        """关闭连接"""
        self.reader.close()
        self.writer.close()
```

---

## 五、完整的迁移脚本

```python
# migrate.py

import argparse
from config.settings import DatabaseConfig

def main():
    parser = argparse.ArgumentParser(description="SQLite 到 PostgreSQL 迁移")
    parser.add_argument("--sqlite", required=True, help="SQLite 数据库路径")
    parser.add_argument("--pg", required=True, help="PostgreSQL 连接字符串")
    parser.add_argument("--validate", action="store_true", help="迁移后验证")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("SQLite 到 PostgreSQL 迁移")
    print("=" * 60)
    print(f"源: {args.sqlite}")
    print(f"目标: {args.pg}")
    print()
    
    # 执行迁移
    migrator = DataMigrator(args.sqlite, args.pg)
    results = migrator.migrate_all()
    
    # 打印结果
    print("【迁移结果】")
    for table, result in results.items():
        status = "✓" if result["status"] == "success" else "✗"
        count = result.get("record_count", 0)
        print(f"  {status} {table}: {count} 条记录")
    
    # 验证
    if args.validate:
        print()
        print("【验证结果】")
        validator = MigrationValidator(args.sqlite, args.pg)
        validation = validator.validate_all()
        
        for table, result in validation.items():
            status = "✓" if result["count_match"] and result["columns_match"] else "✗"
            print(f"  {status} {table}: 源 {result['source_count']}, 目标 {result['target_count']}")
        
        validator.close()
    
    migrator.close()
    
    print()
    print("=" * 60)
    print("迁移完成")
    print("=" * 60)

if __name__ == "__main__":
    main()
```

---

## 动手练习

### 练习一：对比数据库特点

列出 SQLite 和 PostgreSQL 各 5 个优缺点：

```
SQLite 优点：
1. _______________
2. _______________
3. _______________
4. _______________
5. _______________

PostgreSQL 优点：
1. _______________
2. _______________
3. _______________
4. _______________
5. _______________
```

### 练习二：设计迁移方案

为"招聘数据"设计从 SQLite 迁移到 PostgreSQL 的方案：

```
1. 需要迁移哪些表？
2. 数据类型如何转换？
3. 如何验证迁移结果？
```

### 练习三：实现迁移脚本

实现一个简单的迁移脚本，完成：

1. 读取 SQLite 数据
2. 转换数据类型
3. 写入 PostgreSQL
4. 验证数据完整性

---

## 小结

本课的核心要点：

1. **SQLite 适用**：开发测试、小数据量、低并发
2. **PostgreSQL 适用**：生产环境、大数据量、高并发
3. **数据类型映射**：INTEGER→BIGINT、TEXT→VARCHAR/TEXT、BOOLEAN→BOOLEAN
4. **迁移流程**：准备→结构→数据→验证→切换
5. **验证重要性**：迁移后必须验证数据完整性

---

## 下一课预告

下一课我们将学习**表设计：raw、clean、metrics**，如何设计分层的数据表结构，支持数据产品的各种查询需求。
