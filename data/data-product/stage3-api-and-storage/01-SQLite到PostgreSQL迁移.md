# 第1课：SQLite 到 PostgreSQL 的迁移思路

> **课程定位**：理解不同数据库的适用场景，掌握数据库迁移的方法
> **前置知识**：第二阶段全部课程
> **预计时长**：45 分钟

---

## 场景引入

你已经在本地用 SQLite 开发了数据产品的原型，一切运行良好。但当你把项目部署到服务器，发现多个用户同时查询时，数据库开始报 "database is locked" 错误。你意识到 SQLite 的单写多读限制在生产环境中是个致命问题，需要迁移到 PostgreSQL。但迁移不是简单地换个连接字符串——数据类型、索引、SQL 语法都有差异，你需要一套系统化的迁移方案。

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

## 常见误区

- **直接替换数据库连接字符串就能迁移成功**：实际上 SQLite 和 PostgreSQL 在数据类型、SQL 语法、并发处理等方面有显著差异，需要系统化的迁移方案
- **迁移后不需要验证数据完整性**：数据类型转换可能导致精度丢失或格式变化，必须逐表验证记录数和数据一致性
- **SQLite 的 SQL 可以直接在 PostgreSQL 上运行**：两种数据库的函数、语法存在差异，如日期处理、字符串操作等需要适配
- **迁移过程中不需要备份**：迁移操作可能失败或出错，必须在迁移前备份源数据，确保可以回滚

---

## 工程建议

- 迁移前先在测试环境完整演练一遍，记录每张表的迁移耗时和数据量，评估生产环境的停机窗口
- 使用批次号（batch_id）追踪每次迁移的数据，方便问题排查和数据回滚
- 迁移完成后保留 SQLite 原始文件至少一周，确认新系统稳定后再清理
- 为 PostgreSQL 配置合理的连接池参数（如 max_connections），避免迁移期间连接数耗尽

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

## 参考答案

### 练习一

**思路**：从部署方式、并发、数据量、功能特性、运维等维度对比两者的差异。

**答案**：

```
SQLite 优点：
1. 零配置，单文件存储，无需安装部署
2. 读取性能高，适合读多写少场景
3. 资源占用极低，适合嵌入式和移动端
4. 支持跨平台，数据库文件可直接复制迁移
5. 开发调试方便，删除一个文件即可重置数据库

SQLite 缺点：
1. 不支持高并发写入（写锁粒度为整个数据库）
2. 数据容量有限（建议 < 1GB）
3. 不支持网络访问，只能本地连接
4. 缺少高级特性（无存储过程、无 JSONB 索引）
5. 不支持细粒度权限控制

PostgreSQL 优点：
1. 支持高并发读写（MVCC 机制）
2. 数据容量可达 TB 级
3. 丰富的数据类型（JSONB、数组、全文搜索）
4. 强大的扩展性（PostGIS、pg_stat_statements 等）
5. 完善的权限管理和备份恢复机制

PostgreSQL 缺点：
1. 部署和运维复杂度高
2. 资源占用大（内存、磁盘）
3. 配置参数多，调优门槛高
4. 单机性能在极简单场景下不如 SQLite
5. 版本升级可能需要数据迁移
```

**要点**：
- SQLite 适合开发/测试/嵌入式，PostgreSQL 适合生产环境
- 选择数据库时需综合考虑并发量、数据量、运维能力

---

### 练习二

**思路**：梳理招聘数据涉及的表，逐一分析数据类型差异，设计验证方案。

**答案**：

```
1. 需要迁移的表：
   - raw_jobs（原始岗位数据）
   - clean_jobs（清洗后岗位数据）
   - metrics_city_daily（城市日统计）
   - metrics_skill_monthly（技能月统计）
   - etl_batch_log（批次日志）

2. 数据类型转换：
   - INTEGER → BIGINT（id 字段）
   - TEXT → VARCHAR(n) 或 TEXT（根据字段长度选择）
   - BOOLEAN (0/1) → BOOLEAN（is_active 等字段）
   - DATETIME (字符串) → TIMESTAMP（crawl_time、created_at）
   - DATE (字符串) → DATE（publish_date）
   - JSON (字符串) → JSONB（raw_data 字段，可利用 GIN 索引）

3. 验证迁移结果：
   - 逐表对比记录数：SELECT COUNT(*) 两端对比
   - 抽样对比数据：随机抽取 100 条记录逐字段比对
   - 验证约束完整性：检查主键、外键、唯一约束是否生效
   - 测试典型查询：执行业务 SQL 确认结果一致
   - 验证索引可用性：EXPLAIN ANALYZE 确认查询走索引
```

**要点**：
- 迁移前备份 SQLite 原始文件
- 验证不能只看记录数，还要抽查数据内容

---

### 练习三

**思路**：基于课程中的 SQLiteReader 和 PostgreSQLWriter，实现一个完整的迁移脚本，包含类型转换和验证。

**答案**：

```python
import sqlite3
import pandas as pd
from sqlalchemy import create_engine, text
from typing import Dict, Any

def migrate_sqlite_to_pg(sqlite_path: str, pg_url: str) -> Dict[str, Any]:
    """SQLite 到 PostgreSQL 迁移脚本"""

    # 连接源和目标
    sqlite_conn = sqlite3.connect(sqlite_path)
    pg_engine = create_engine(pg_url)

    # 类型映射
    type_map = {
        "INTEGER": "BIGINT",
        "REAL": "DOUBLE PRECISION",
        "TEXT": "TEXT",
        "BLOB": "BYTEA",
        "BOOLEAN": "BOOLEAN",
        "DATE": "DATE",
        "DATETIME": "TIMESTAMPTZ",
    }

    # 获取所有表
    tables = [
        row[0] for row in
        sqlite_conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    ]

    results = {}

    for table in tables:
        try:
            # 1. 读取表结构
            schema = sqlite_conn.execute(f"PRAGMA table_info({table})").fetchall()

            # 2. 构建 CREATE TABLE
            columns = []
            for col in schema:
                cid, name, col_type, notnull, default, pk = col
                pg_type = type_map.get(col_type.upper(), "TEXT")
                nullable = "NOT NULL" if notnull else ""
                primary = "PRIMARY KEY" if pk else ""
                columns.append(f"{name} {pg_type} {nullable} {primary}")

            create_sql = f"CREATE TABLE IF NOT EXISTS {table} ({', '.join(columns)})"

            with pg_engine.connect() as conn:
                conn.execute(text(create_sql))
                conn.commit()

            # 3. 读取并转换数据
            df = pd.read_sql(f"SELECT * FROM {table}", sqlite_conn)

            for col in schema:
                col_name = col[1]
                col_type = col[2].upper()
                if col_name not in df.columns:
                    continue
                if col_type == "BOOLEAN":
                    df[col_name] = df[col_name].astype(bool)
                elif col_type in ("DATE", "DATETIME"):
                    df[col_name] = pd.to_datetime(df[col_name], errors="coerce")

            # 4. 写入 PostgreSQL
            df.to_sql(table, pg_engine, if_exists="append", index=False, chunksize=1000)

            # 5. 验证记录数
            with pg_engine.connect() as conn:
                pg_count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()

            results[table] = {
                "status": "success",
                "sqlite_count": len(df),
                "pg_count": pg_count,
                "match": len(df) == pg_count,
            }
            print(f"  ✓ {table}: {len(df)} 条记录")

        except Exception as e:
            results[table] = {"status": "failed", "error": str(e)}
            print(f"  ✗ {table}: {e}")

    sqlite_conn.close()
    pg_engine.dispose()
    return results

if __name__ == "__main__":
    results = migrate_sqlite_to_pg(
        sqlite_path="recruitment.db",
        pg_url="postgresql://user:pass@localhost:5432/recruitment_db",
    )
    print("\n【验证结果】")
    for table, r in results.items():
        status = "✓" if r.get("match") else "✗"
        print(f"  {status} {table}: {r}")
```

**要点**：
- 使用 pandas 的 `to_sql` 批量写入，比逐条 INSERT 快得多
- 布尔值和日期时间必须做类型转换，否则 PostgreSQL 会报错
- 验证时同时检查记录数和抽样数据内容
