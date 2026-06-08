# 第3课：Load - 入库、更新、幂等

> **课程定位**：掌握数据加载到数据库的技术，确保数据写入的可靠性
> **前置知识**：第2课（Transform）
> **预计时长**：50 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 实现数据写入数据库的各种方式
2. 理解并实现幂等操作
3. 处理数据冲突和更新策略
4. 设计批量写入优化方案
5. 实现事务控制和错误恢复

---

## 一、Load 的定位

### 1.1 在 ETL 中的角色

```
┌──────────────────────────────────────────────────────────────┐
│                    Load 的职责                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Extract（提取）→ Transform（转换）→ Load（加载）            │
│       │                  │                  │                │
│       │                  │              本课重点              │
│       ▼                  ▼                  ▼                │
│   原始数据  ──→    清洗数据    ──→    写入数据库              │
│                                                              │
│   核心任务：                                                   │
│   ├── 数据入库：INSERT                                       │
│   ├── 数据更新：UPDATE                                       │
│   ├── 幂等操作：重复执行结果一致                             │
│   └── 批量优化：高效写入大量数据                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、基本写入操作

### 2.1 单条写入

```python
from sqlalchemy import create_engine, text
from typing import Dict, Any, Optional
from datetime import datetime

class DataLoader:
    """数据加载器"""
    
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string)
    
    def insert_one(self, table: str, data: Dict[str, Any]) -> bool:
        """插入单条数据"""
        columns = ", ".join(data.keys())
        placeholders = ", ".join([f":{key}" for key in data.keys()])
        
        query = f"INSERT INTO {table} ({columns}) VALUES ({placeholders})"
        
        try:
            with self.engine.connect() as conn:
                conn.execute(text(query), data)
                conn.commit()
            return True
        except Exception as e:
            print(f"插入失败: {e}")
            return False
    
    def update_one(
        self,
        table: str,
        data: Dict[str, Any],
        where: Dict[str, Any]
    ) -> bool:
        """更新单条数据"""
        set_clause = ", ".join([f"{key} = :{key}" for key in data.keys()])
        where_clause = " AND ".join([f"{key} = :where_{key}" for key in where.keys()])
        
        # 合并参数
        params = {**data, **{f"where_{k}": v for k, v in where.items()}}
        
        query = f"UPDATE {table} SET {set_clause} WHERE {where_clause}"
        
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text(query), params)
                conn.commit()
            return result.rowcount > 0
        except Exception as e:
            print(f"更新失败: {e}")
            return False
```

### 2.2 批量写入

```python
import pandas as pd
from typing import List, Dict, Any

class BatchDataLoader(DataLoader):
    """批量数据加载器"""
    
    def insert_many(
        self,
        table: str,
        data: List[Dict[str, Any]],
        batch_size: int = 1000
    ) -> int:
        """批量插入"""
        if not data:
            return 0
        
        columns = ", ".join(data[0].keys())
        placeholders = ", ".join([f":{key}" for key in data[0].keys()])
        query = f"INSERT INTO {table} ({columns}) VALUES ({placeholders})"
        
        inserted = 0
        
        try:
            with self.engine.connect() as conn:
                # 分批处理
                for i in range(0, len(data), batch_size):
                    batch = data[i:i + batch_size]
                    conn.execute(text(query), batch)
                    inserted += len(batch)
                
                conn.commit()
            
            return inserted
            
        except Exception as e:
            print(f"批量插入失败: {e}")
            return inserted
    
    def insert_from_dataframe(
        self,
        table: str,
        df: pd.DataFrame,
        batch_size: int = 1000
    ) -> int:
        """从 DataFrame 插入"""
        data = df.to_dict(orient="records")
        return self.insert_many(table, data, batch_size)
```

---

## 三、幂等操作

### 3.1 什么是幂等？

```
┌──────────────────────────────────────────────────────────────┐
│                    幂等性                                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  定义：执行一次和执行多次的结果相同                           │
│                                                              │
│  例子：                                                       │
│  ├── ✅ 幂等：UPDATE SET status = 'done' WHERE id = 1        │
│  │      └── 执行多次，status 都是 'done'                     │
│  │                                                           │
│  └── ❌ 非幂等：INSERT INTO table VALUES (...)               │
│         └── 执行多次，会插入多条记录                          │
│                                                              │
│  为什么需要幂等？                                              │
│  ├── 任务失败后可以安全重试                                   │
│  ├── 避免数据重复                                             │
│  └── 简化错误处理逻辑                                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 实现幂等写入

```python
class IdempotentLoader(DataLoader):
    """幂等数据加载器"""
    
    def upsert_one(
        self,
        table: str,
        data: Dict[str, Any],
        key_columns: List[str]
    ) -> bool:
        """插入或更新（Upsert）"""
        
        # 构建 INSERT ... ON CONFLICT UPDATE 语句
        columns = ", ".join(data.keys())
        placeholders = ", ".join([f":{key}" for key in data.keys()])
        
        # 冲突时更新的列（排除主键）
        update_columns = [k for k in data.keys() if k not in key_columns]
        update_clause = ", ".join([f"{col} = EXCLUDED.{col}" for col in update_columns])
        
        conflict_columns = ", ".join(key_columns)
        
        query = f"""
            INSERT INTO {table} ({columns})
            VALUES ({placeholders})
            ON CONFLICT ({conflict_columns})
            DO UPDATE SET {update_clause}
        """
        
        try:
            with self.engine.connect() as conn:
                conn.execute(text(query), data)
                conn.commit()
            return True
        except Exception as e:
            print(f"Upsert 失败: {e}")
            return False
    
    def upsert_many(
        self,
        table: str,
        data: List[Dict[str, Any]],
        key_columns: List[str],
        batch_size: int = 1000
    ) -> int:
        """批量 Upsert"""
        if not data:
            return 0
        
        upserted = 0
        
        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]
            
            for record in batch:
                if self.upsert_one(table, record, key_columns):
                    upserted += 1
        
        return upserted
```

### 3.3 基于批次的幂等

```python
class BatchIdempotentLoader(DataLoader):
    """基于批次的幂等加载器"""
    
    def is_batch_loaded(self, batch_id: str) -> bool:
        """检查批次是否已加载"""
        query = """
            SELECT COUNT(*) as cnt
            FROM etl_batch_log
            WHERE batch_id = :batch_id AND status = 'completed'
        """
        
        with self.engine.connect() as conn:
            result = conn.execute(text(query), {"batch_id": batch_id})
            row = result.fetchone()
            return row[0] > 0
    
    def log_batch_start(self, batch_id: str, source: str):
        """记录批次开始"""
        query = """
            INSERT INTO etl_batch_log (batch_id, source, start_time, status)
            VALUES (:batch_id, :source, NOW(), 'running')
        """
        
        with self.engine.connect() as conn:
            conn.execute(text(query), {
                "batch_id": batch_id,
                "source": source
            })
            conn.commit()
    
    def log_batch_complete(self, batch_id: str, record_count: int):
        """记录批次完成"""
        query = """
            UPDATE etl_batch_log
            SET end_time = NOW(), status = 'completed', record_count = :count
            WHERE batch_id = :batch_id
        """
        
        with self.engine.connect() as conn:
            conn.execute(text(query), {
                "batch_id": batch_id,
                "count": record_count
            })
            conn.commit()
    
    def load_with_batch_check(
        self,
        table: str,
        data: List[Dict[str, Any]],
        batch_id: str,
        source: str,
        key_columns: List[str]
    ) -> Dict[str, Any]:
        """带批次检查的加载"""
        
        # 检查批次是否已处理
        if self.is_batch_loaded(batch_id):
            return {
                "success": True,
                "message": "批次已处理，跳过",
                "loaded_count": 0
            }
        
        # 记录开始
        self.log_batch_start(batch_id, source)
        
        try:
            # 执行加载
            loaded_count = self.upsert_many(table, data, key_columns)
            
            # 记录完成
            self.log_batch_complete(batch_id, loaded_count)
            
            return {
                "success": True,
                "message": "加载成功",
                "loaded_count": loaded_count
            }
            
        except Exception as e:
            # 记录失败
            self.log_batch_error(batch_id, str(e))
            
            return {
                "success": False,
                "message": str(e),
                "loaded_count": 0
            }
```

---

## 四、数据冲突处理

### 4.1 冲突策略

```
┌──────────────────────────────────────────────────────────────┐
│                    冲突处理策略                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  策略 1：覆盖（OVERWRITE）                                    │
│  ├── 新数据覆盖旧数据                                        │
│  ├── 适用：新数据总是更准确                                  │
│  └── 实现：INSERT OR REPLACE / ON CONFLICT UPDATE            │
│                                                              │
│  策略 2：忽略（IGNORE）                                       │
│  ├── 保留旧数据，忽略新数据                                  │
│  ├── 适用：旧数据更可靠                                      │
│  └── 实现：INSERT OR IGNORE / ON CONFLICT DO NOTHING         │
│                                                              │
│  策略 3：合并（MERGE）                                        │
│  ├── 合并新旧数据                                            │
│  ├── 适用：需要保留双方信息                                  │
│  └── 实现：自定义合并逻辑                                    │
│                                                              │
│  策略 4：报错（ERROR）                                        │
│  ├── 发现冲突时报错                                          │
│  ├── 适用：数据不应重复                                      │
│  └── 实现：普通 INSERT（主键冲突会报错）                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 实现不同策略

```python
from enum import Enum
from typing import List, Dict, Any, Optional

class ConflictStrategy(Enum):
    """冲突策略"""
    OVERWRITE = "overwrite"  # 覆盖
    IGNORE = "ignore"        # 忽略
    ERROR = "error"          # 报错

class ConflictHandler:
    """冲突处理器"""
    
    def __init__(self, engine):
        self.engine = engine
    
    def insert_with_strategy(
        self,
        table: str,
        data: Dict[str, Any],
        key_columns: List[str],
        strategy: ConflictStrategy
    ) -> bool:
        """根据策略插入数据"""
        
        if strategy == ConflictStrategy.OVERWRITE:
            return self._insert_overwrite(table, data, key_columns)
        elif strategy == ConflictStrategy.IGNORE:
            return self._insert_ignore(table, data, key_columns)
        elif strategy == ConflictStrategy.ERROR:
            return self._insert_error(table, data, key_columns)
        else:
            raise ValueError(f"未知策略: {strategy}")
    
    def _insert_overwrite(
        self,
        table: str,
        data: Dict[str, Any],
        key_columns: List[str]
    ) -> bool:
        """覆盖策略"""
        columns = ", ".join(data.keys())
        placeholders = ", ".join([f":{key}" for key in data.keys()])
        
        update_columns = [k for k in data.keys() if k not in key_columns]
        update_clause = ", ".join([f"{col} = EXCLUDED.{col}" for col in update_columns])
        conflict_columns = ", ".join(key_columns)
        
        query = f"""
            INSERT INTO {table} ({columns})
            VALUES ({placeholders})
            ON CONFLICT ({conflict_columns})
            DO UPDATE SET {update_clause}
        """
        
        with self.engine.connect() as conn:
            conn.execute(text(query), data)
            conn.commit()
        return True
    
    def _insert_ignore(
        self,
        table: str,
        data: Dict[str, Any],
        key_columns: List[str]
    ) -> bool:
        """忽略策略"""
        columns = ", ".join(data.keys())
        placeholders = ", ".join([f":{key}" for key in data.keys()])
        conflict_columns = ", ".join(key_columns)
        
        query = f"""
            INSERT INTO {table} ({columns})
            VALUES ({placeholders})
            ON CONFLICT ({conflict_columns})
            DO NOTHING
        """
        
        with self.engine.connect() as conn:
            conn.execute(text(query), data)
            conn.commit()
        return True
    
    def _insert_error(
        self,
        table: str,
        data: Dict[str, Any],
        key_columns: List[str]
    ) -> bool:
        """报错策略"""
        columns = ", ".join(data.keys())
        placeholders = ", ".join([f":{key}" for key in data.keys()])
        
        query = f"INSERT INTO {table} ({columns}) VALUES ({placeholders})"
        
        with self.engine.connect() as conn:
            conn.execute(text(query), data)
            conn.commit()
        return True
```

---

## 五、事务控制

### 5.1 事务的重要性

```
┌──────────────────────────────────────────────────────────────┐
│                    事务控制                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  什么是事务？                                                  │
│  ├── 一组操作要么全部成功，要么全部失败                       │
│  ├── 保证数据的一致性                                        │
│  └── 支持回滚                                                │
│                                                              │
│  为什么需要事务？                                              │
│  ├── 批量写入可能部分失败                                    │
│  ├── 需要保证数据完整性                                      │
│  └── 失败时需要恢复到之前的状态                              │
│                                                              │
│  ACID 特性：                                                  │
│  ├── 原子性（Atomicity）：要么全做，要么全不做                │
│  ├── 一致性（Consistency）：数据始终合法                      │
│  ├── 隔离性（Isolation）：并发互不干扰                        │
│  └── 持久性（Durability）：提交后永久保存                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 事务实现

```python
from contextlib import contextmanager
from typing import Generator

class TransactionalLoader(DataLoader):
    """支持事务的数据加载器"""
    
    @contextmanager
    def transaction(self) -> Generator:
        """事务上下文管理器"""
        conn = self.engine.connect()
        trans = conn.begin()
        
        try:
            yield conn
            trans.commit()
        except Exception as e:
            trans.rollback()
            raise e
        finally:
            conn.close()
    
    def load_in_transaction(
        self,
        table: str,
        data: List[Dict[str, Any]],
        key_columns: List[str]
    ) -> Dict[str, Any]:
        """在事务中加载数据"""
        
        try:
            with self.transaction() as conn:
                loaded = 0
                
                for record in data:
                    # 构建 Upsert 语句
                    columns = ", ".join(record.keys())
                    placeholders = ", ".join([f":{key}" for key in record.keys()])
                    
                    update_columns = [k for k in record.keys() if k not in key_columns]
                    update_clause = ", ".join([f"{col} = EXCLUDED.{col}" for col in update_columns])
                    conflict_columns = ", ".join(key_columns)
                    
                    query = f"""
                        INSERT INTO {table} ({columns})
                        VALUES ({placeholders})
                        ON CONFLICT ({conflict_columns})
                        DO UPDATE SET {update_clause}
                    """
                    
                    conn.execute(text(query), record)
                    loaded += 1
                
                # 如果到这里没有异常，事务会自动提交
            
            return {
                "success": True,
                "loaded_count": loaded
            }
            
        except Exception as e:
            # 事务会自动回滚
            return {
                "success": False,
                "error": str(e),
                "loaded_count": 0
            }
```

---

## 六、批量写入优化

### 6.1 性能优化策略

```
┌──────────────────────────────────────────────────────────────┐
│                    批量写入优化                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  策略 1：批量提交                                              │
│  ├── 不要逐条提交                                            │
│  ├── 每 N 条提交一次                                         │
│  └── 减少事务开销                                            │
│                                                              │
│  策略 2：使用 COPY 命令                                       │
│  ├── PostgreSQL 的 COPY 比 INSERT 快很多                     │
│  ├── 适合大量数据导入                                        │
│  └── 使用 pandas 的 to_sql                                   │
│                                                              │
│  策略 3：禁用索引                                              │
│  ├── 大量导入时临时禁用索引                                  │
│  ├── 导入后重建索引                                          │
│  └── 适合首次导入                                            │
│                                                              │
│  策略 4：并行写入                                              │
│  ├── 多线程/多进程写入                                       │
│  ├── 注意数据库连接池限制                                    │
│  └── 适合无依赖的数据                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 优化实现

```python
import pandas as pd
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor

class OptimizedLoader(DataLoader):
    """优化的数据加载器"""
    
    def bulk_insert(
        self,
        table: str,
        df: pd.DataFrame,
        batch_size: int = 10000
    ) -> int:
        """使用 pandas 批量插入"""
        try:
            df.to_sql(
                table,
                self.engine,
                if_exists="append",
                index=False,
                chunksize=batch_size,
                method="multi"  # 使用多值 INSERT
            )
            return len(df)
        except Exception as e:
            print(f"批量插入失败: {e}")
            return 0
    
    def parallel_insert(
        self,
        table: str,
        data: List[Dict[str, Any]],
        key_columns: List[str],
        max_workers: int = 4,
        batch_size: int = 1000
    ) -> int:
        """并行插入"""
        
        # 分批
        batches = [data[i:i + batch_size] for i in range(0, len(data), batch_size)]
        
        loaded = 0
        
        def process_batch(batch):
            return self.upsert_many(table, batch, key_columns)
        
        # 并行处理
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            results = list(executor.map(process_batch, batches))
            loaded = sum(results)
        
        return loaded
```

---

## 七、完整的加载流程

```python
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime

@dataclass
class LoadConfig:
    """加载配置"""
    table: str
    key_columns: List[str]
    conflict_strategy: ConflictStrategy = ConflictStrategy.OVERWRITE
    batch_size: int = 1000
    use_transaction: bool = True

class ETLDataLoader:
    """ETL 数据加载器"""
    
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string)
        self.batch_loader = BatchIdempotentLoader(connection_string)
        self.transactional = TransactionalLoader(connection_string)
        self.optimized = OptimizedLoader(connection_string)
    
    def load(
        self,
        data: List[Dict[str, Any]],
        config: LoadConfig,
        batch_id: str,
        source: str
    ) -> Dict[str, Any]:
        """执行加载"""
        
        # 检查批次
        if self.batch_loader.is_batch_loaded(batch_id):
            return {
                "success": True,
                "message": "批次已处理",
                "loaded_count": 0
            }
        
        # 记录开始
        self.batch_loader.log_batch_start(batch_id, source)
        
        try:
            if config.use_transaction:
                # 事务加载
                result = self.transactional.load_in_transaction(
                    config.table,
                    data,
                    config.key_columns
                )
            else:
                # 批量加载
                loaded = self.optimized.parallel_insert(
                    config.table,
                    data,
                    config.key_columns,
                    batch_size=config.batch_size
                )
                result = {"success": True, "loaded_count": loaded}
            
            if result["success"]:
                self.batch_loader.log_batch_complete(batch_id, result["loaded_count"])
            
            return result
            
        except Exception as e:
            self.batch_loader.log_batch_error(batch_id, str(e))
            return {
                "success": False,
                "error": str(e),
                "loaded_count": 0
            }

# 使用示例
loader = ETLDataLoader("postgresql://user:pass@localhost/db")

config = LoadConfig(
    table="clean_jobs",
    key_columns=["job_id"],
    conflict_strategy=ConflictStrategy.OVERWRITE,
    batch_size=1000,
    use_transaction=True
)

result = loader.load(
    data=clean_data,
    config=config,
    batch_id="batch_20240115_001",
    source="jobs_api"
)
```

---

## 动手练习

### 练习一：实现幂等写入

实现一个幂等的写入函数，要求：

1. 基于主键判断是否已存在
2. 存在则更新，不存在则插入
3. 返回实际操作的记录数

### 练习二：实现事务控制

实现一个事务控制的批量写入，要求：

1. 全部成功才提交
2. 任一失败则回滚
3. 返回成功/失败状态

### 练习三：性能测试

测试不同批量大小对写入性能的影响：

```python
# 测试 batch_size = 100, 500, 1000, 5000 的性能差异
```

---

## 小结

本课的核心要点：

1. **Load**是 ETL 的最后一步，负责数据写入数据库
2. **幂等操作**：重复执行结果一致，支持安全重试
3. **冲突策略**：覆盖、忽略、合并、报错
4. **事务控制**：保证数据一致性，支持回滚
5. **批量优化**：批量提交、并行写入、使用 COPY

---

## 下一课预告

下一课我们将学习**数据质量规则**，如何定义和实施数据质量检查，确保数据的准确性和完整性。
