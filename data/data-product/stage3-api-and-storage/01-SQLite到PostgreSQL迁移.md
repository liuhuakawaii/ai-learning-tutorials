# SQLite 到 PostgreSQL 迁移

> 你的 SQLite 原型在本地跑得好好的。部署到服务器后，两个用户同时查询，报了 "database is locked"。这不是 bug，是 SQLite 的设计限制。

---

## 为什么要迁移

SQLite 是单写多读的。写操作会锁整个数据库文件，第二个写请求必须等第一个完成。PostgreSQL 用 MVCC（多版本并发控制），读操作永远不会被写操作阻塞。

```
SQLite：Writer 持锁 → Reader 全部等待
PostgreSQL：Writer 写行 A，Writer 写行 B，Reader 读快照，互不阻塞
```

---

## 核心差异

| 维度 | SQLite | PostgreSQL |
|------|--------|------------|
| 部署 | 单文件，零配置 | 独立服务，需要运维 |
| 并发 | 单写多读 | 多写多读 |
| 数据量 | GB 级 | TB 级 |
| JSON | TEXT 存储 | JSONB + GIN 索引 |
| 权限 | 无 | 用户/角色/表级 |

开发阶段用 SQLite，生产环境用 PostgreSQL。不是二选一，是不同阶段用不同工具。

---

## 数据类型映射

SQLite 的类型系统是动态的，PostgreSQL 是严格的。必须做类型转换：

```
SQLite               →  PostgreSQL
INTEGER              →  BIGINT
REAL                 →  DOUBLE PRECISION
TEXT                 →  TEXT
BOOLEAN (0/1)        →  BOOLEAN
DATE (字符串)        →  DATE
DATETIME (字符串)    →  TIMESTAMPTZ
JSON (字符串)        →  JSONB
```

最容易出错的是布尔值和日期——SQLite 没有原生布尔类型，用 0/1 表示，直接写入 PostgreSQL 的 BOOLEAN 列会报类型错误。

---

## 迁移实现

### 读取 SQLite

```python
import sqlite3
import pandas as pd

class SQLiteReader:
    def __init__(self, db_path: str):
        self.conn = sqlite3.connect(db_path)

    def get_tables(self) -> list:
        return [r[0] for r in self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'").fetchall()]

    def get_schema(self, table: str) -> list:
        return [{"name": r[1], "type": r[2], "notnull": r[3], "pk": r[5]}
                for r in self.conn.execute(f"PRAGMA table_info({table})").fetchall()]

    def read_table(self, table: str) -> pd.DataFrame:
        return pd.read_sql(f"SELECT * FROM {table}", self.conn)

    def close(self): self.conn.close()
```

### 写入 PostgreSQL（带类型转换）

```python
import pandas as pd
from sqlalchemy import create_engine, text

TYPE_MAP = {
    "INTEGER": "BIGINT", "REAL": "DOUBLE PRECISION", "TEXT": "TEXT",
    "BLOB": "BYTEA", "BOOLEAN": "BOOLEAN", "DATE": "DATE",
    "DATETIME": "TIMESTAMPTZ", "JSON": "JSONB",
}

class PGWriter:
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string)

    def create_table(self, table: str, schema: list):
        cols = []
        for col in schema:
            pg_type = TYPE_MAP.get(col["type"].upper(), "TEXT")
            nullable = "NOT NULL" if col["notnull"] else ""
            pk = "PRIMARY KEY" if col["pk"] else ""
            cols.append(f"{col['name']} {pg_type} {nullable} {pk}")
        with self.engine.begin() as conn:
            conn.execute(text(f"CREATE TABLE IF NOT EXISTS {table} ({', '.join(cols)})"))

    def write_dataframe(self, table: str, df: pd.DataFrame, schema: list) -> int:
        df = self._convert_types(df, schema)
        df.to_sql(table, self.engine, if_exists="append", index=False, chunksize=1000)
        return len(df)

    def _convert_types(self, df, schema):
        for col in schema:
            if col["name"] not in df.columns: continue
            if col["type"].upper() == "BOOLEAN":
                df[col["name"]] = df[col["name"]].astype(bool)
            elif col["type"].upper() in ("DATE", "DATETIME"):
                df[col["name"]] = pd.to_datetime(df[col["name"]], errors="coerce")
        return df

    def close(self): self.engine.dispose()
```

### 迁移器

```python
class Migrator:
    def __init__(self, sqlite_path: str, pg_url: str):
        self.reader = SQLiteReader(sqlite_path)
        self.writer = PGWriter(pg_url)

    def migrate_all(self) -> dict:
        return {t: self.migrate_table(t) for t in self.reader.get_tables()}

    def migrate_table(self, table: str) -> dict:
        try:
            schema = self.reader.get_schema(table)
            self.writer.create_table(table, schema)
            df = self.reader.read_table(table)
            count = self.writer.write_dataframe(table, df, schema)
            return {"status": "success", "count": count}
        except Exception as e:
            return {"status": "failed", "error": str(e)}

    def validate(self) -> dict:
        results = {}
        for table in self.reader.get_tables():
            src = self.reader.read_table(table)
            with self.writer.engine.connect() as conn:
                dst = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            results[table] = {"src": len(src), "dst": dst, "match": len(src) == dst}
        return results

    def close(self): self.reader.close(); self.writer.close()
```

---

## 验证：不能只看行数

记录数相等不代表数据正确。还需要：

1. **抽样比对**：随机取 10 条记录逐字段比对
2. **约束验证**：主键、唯一约束在目标库是否生效
3. **业务 SQL**：跑几条典型查询确认结果一致

```python
def validate_sample(reader, pg_engine, table, n=10):
    src = reader.read_table(table)
    dst = pd.read_sql(f"SELECT * FROM {table}", pg_engine)
    if len(src) != len(dst):
        return {"match": False, "reason": f"行数不等: {len(src)} vs {len(dst)}"}
    sample = src.sample(min(n, len(src)))
    pk = src.columns[0]
    mismatches = sum(1 for _, r in sample.iterrows() if dst[dst[pk] == r[pk]].empty)
    return {"match": mismatches == 0, "mismatches": mismatches}
```

---

## 迁移清单

```
迁移前：□ 备份 SQLite 文件 □ 测试环境演练 □ 记录每表数据量
迁移中：□ 按依赖顺序迁移 □ 每表验证行数 □ 布尔/日期字段重点检查
迁移后：□ 抽样比对内容 □ 跑业务 SQL □ 保留 SQLite 文件至少一周

## 练习与参考答案

### 练习一：SQLite SQL 转 PostgreSQL

```sql
-- 1. SQLite 自增主键
CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT);
-- 2. SQLite 日期函数
SELECT * FROM jobs WHERE date(publish_date) > date('now', '-7 days');
-- 3. SQLite 分组拼接
SELECT city, group_concat(title, ', ') FROM jobs GROUP BY city;
```

### 练习二：命令行迁移脚本

写一个迁移脚本：接受 SQLite 路径和 PostgreSQL 连接字符串，迁移所有表，自动做类型转换，迁移后验证行数，输出报告。

---

## 参考答案

### 练习一

```sql
-- 1. PostgreSQL 自增主键
CREATE TABLE jobs (id BIGSERIAL PRIMARY KEY, title TEXT);
-- 2. PostgreSQL 日期函数
SELECT * FROM jobs WHERE publish_date > CURRENT_DATE - INTERVAL '7 days';
-- 3. PostgreSQL 分组拼接
SELECT city, string_agg(title, ', ') FROM jobs GROUP BY city;
```

用 `BIGSERIAL` 而不是 `SERIAL`——`SERIAL` 最大 21 亿，数据量大时可能溢出。

### 练习二

```python
import argparse, time, sqlite3
import pandas as pd
from sqlalchemy import create_engine, text

TYPE_MAP = {"INTEGER": "BIGINT", "REAL": "DOUBLE PRECISION", "TEXT": "TEXT",
            "BLOB": "BYTEA", "BOOLEAN": "BOOLEAN", "DATE": "DATE",
            "DATETIME": "TIMESTAMPTZ", "JSON": "JSONB"}

def migrate(sqlite_path, pg_url):
    src = sqlite3.connect(sqlite_path)
    dst = create_engine(pg_url)
    report = []
    for table in [r[0] for r in src.execute(
            "SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        t0 = time.time()
        try:
            schema = src.execute(f"PRAGMA table_info({table})").fetchall()
            cols = []
            for cid, name, ctype, notnull, default, pk in schema:
                pt = TYPE_MAP.get(ctype.upper(), "TEXT")
                cols.append(f"{name} {pt} {'NOT NULL' if notnull else ''} {'PRIMARY KEY' if pk else ''}")
            with dst.begin() as conn:
                conn.execute(text(f"CREATE TABLE IF NOT EXISTS {table} ({', '.join(cols)})"))
            df = pd.read_sql(f"SELECT * FROM {table}", src)
            for cid, name, ctype, notnull, default, pk in schema:
                if name not in df.columns: continue
                if ctype.upper() == "BOOLEAN": df[name] = df[name].astype(bool)
                elif ctype.upper() in ("DATE", "DATETIME"): df[name] = pd.to_datetime(df[name], errors="coerce")
            df.to_sql(table, dst, if_exists="append", index=False, chunksize=1000)
            with dst.connect() as conn:
                pg_count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            mark = "ok" if len(df) == pg_count else "MISMATCH"
            report.append(f"  {mark} {table}: {len(df)} -> {pg_count} ({time.time()-t0:.1f}s)")
        except Exception as e:
            report.append(f"  FAIL {table}: {e}")
    src.close(); dst.dispose()
    return report

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--sqlite", required=True); p.add_argument("--pg", required=True)
    args = p.parse_args()
    for line in migrate(args.sqlite, args.pg): print(line)
```

每张表单独 try-catch——一张表失败不应该阻止其他表迁移。
