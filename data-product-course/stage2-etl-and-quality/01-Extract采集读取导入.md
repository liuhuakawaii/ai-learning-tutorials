# 第1课：Extract - 采集、读取、导入

> **课程定位**：掌握 ETL 中 Extract 阶段的各种数据获取方式
> **前置知识**：第一阶段全部课程
> **预计时长**：50 分钟

---

## 场景引入

你负责一个招聘数据产品，每天需要从三个不同的招聘网站 API 拉取最新职位数据。一开始你写了个简单的 `requests.get()` 脚本，跑得挺好。但很快问题来了：某个 API 偶尔超时，脚本直接挂掉；另一个 API 改了分页参数，你漏了一半数据；还有的返回格式变了，下游解析全报错。你意识到，数据提取远不止"发个请求拿数据"这么简单——它需要重试、分页、格式校验和日志记录。

---

## 学习目标

完成本课学习后，你将能够：

1. 理解 Extract 在 ETL 中的定位和职责
2. 实现从 API、文件、数据库等多种来源提取数据
3. 设计统一的数据提取接口
4. 处理提取过程中的异常情况
5. 记录提取日志和批次信息

---

## 一、Extract 的定位

### 1.1 ETL 流程回顾

```
┌──────────────────────────────────────────────────────────────┐
│                    ETL 流程                                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Extract（提取）→ Transform（转换）→ Load（加载）            │
│       │                  │                  │                │
│       ▼                  ▼                  ▼                │
│   从数据源获取        清洗、转换、        写入目标             │
│   原始数据            标准化数据          数据库               │
│                                                              │
│   本课重点                                                    │
│   └── Extract：如何高效、可靠地获取数据？                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Extract 的职责

```
┌──────────────────────────────────────────────────────────────┐
│                    Extract 的职责                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  核心任务：                                                   │
│  ├── 从各种数据源获取数据                                    │
│  ├── 统一数据格式                                            │
│  ├── 记录元信息（来源、时间、批次）                          │
│  └── 保存原始数据                                            │
│                                                              │
│  设计原则：                                                   │
│  ├── 不修改原始数据                                          │
│  ├── 记录完整的来源信息                                      │
│  ├── 支持增量提取                                            │
│  └── 处理异常情况                                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、从 API 提取数据

### 2.1 基本请求

```python
import requests
from datetime import datetime
from typing import Optional, Dict, Any

class APIExtractor:
    """API 数据提取器"""
    
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        
        # 设置默认请求头
        self.session.headers.update({
            "User-Agent": "DataProduct/1.0",
            "Accept": "application/json",
        })
        
        if api_key:
            self.session.headers["Authorization"] = f"Bearer {api_key}"
    
    def extract(self, endpoint: str, params: Optional[Dict] = Any) -> Dict:
        """提取数据"""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            return {
                "success": True,
                "data": response.json(),
                "metadata": {
                    "source": url,
                    "extract_time": datetime.now().isoformat(),
                    "status_code": response.status_code,
                }
            }
            
        except requests.RequestException as e:
            return {
                "success": False,
                "error": str(e),
                "metadata": {
                    "source": url,
                    "extract_time": datetime.now().isoformat(),
                }
            }
```

### 2.2 分页提取

```python
from typing import List

class PaginatedAPIExtractor(APIExtractor):
    """支持分页的 API 提取器"""
    
    def extract_all(
        self,
        endpoint: str,
        params: Optional[Dict] = Any,
        page_param: str = "page",
        size_param: str = "per_page",
        page_size: int = 100,
        max_pages: int = 100
    ) -> List[Dict]:
        """提取所有分页数据"""
        
        all_data = []
        page = 1
        
        while page <= max_pages:
            # 构建分页参数
            page_params = {
                **(params or {}),
                page_param: page,
                size_param: page_size
            }
            
            # 提取当前页
            result = self.extract(endpoint, page_params)
            
            if not result["success"]:
                print(f"提取失败: {result['error']}")
                break
            
            data = result["data"]
            
            # 检查是否有数据
            if not data or (isinstance(data, list) and len(data) == 0):
                break
            
            all_data.extend(data if isinstance(data, list) else [data])
            page += 1
        
        return all_data
```

### 2.3 带重试的提取

```python
import time
from functools import wraps

def retry_on_failure(max_retries: int = 3, delay: float = 1.0):
    """失败重试装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise e
                    
                    wait_time = delay * (2 ** attempt)
                    print(f"尝试 {attempt + 1} 失败，{wait_time}秒后重试: {e}")
                    time.sleep(wait_time)
            
            return None
        return wrapper
    return decorator

class ReliableAPIExtractor(APIExtractor):
    """带重试的 API 提取器"""
    
    @retry_on_failure(max_retries=3, delay=2.0)
    def extract_with_retry(self, endpoint: str, params: Optional[Dict] = Any) -> Dict:
        """带重试的提取"""
        return self.extract(endpoint, params)
```

---

## 三、从文件提取数据

### 3.1 CSV 文件提取

```python
import pandas as pd
from pathlib import Path
from typing import Union

class CSVExtractor:
    """CSV 文件提取器"""
    
    def __init__(self, encoding: str = "utf-8"):
        self.encoding = encoding
    
    def extract(self, file_path: Union[str, Path]) -> Dict:
        """提取 CSV 数据"""
        file_path = Path(file_path)
        
        if not file_path.exists():
            return {
                "success": False,
                "error": f"文件不存在: {file_path}"
            }
        
        try:
            df = pd.read_csv(file_path, encoding=self.encoding)
            
            return {
                "success": True,
                "data": df.to_dict(orient="records"),
                "metadata": {
                    "source": str(file_path),
                    "extract_time": datetime.now().isoformat(),
                    "row_count": len(df),
                    "columns": list(df.columns),
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def extract_with_validation(
        self,
        file_path: Union[str, Path],
        required_columns: List[str]
    ) -> Dict:
        """提取并验证列"""
        result = self.extract(file_path)
        
        if not result["success"]:
            return result
        
        # 验证必需列
        columns = result["metadata"]["columns"]
        missing_columns = [col for col in required_columns if col not in columns]
        
        if missing_columns:
            return {
                "success": False,
                "error": f"缺少必需列: {missing_columns}"
            }
        
        return result
```

### 3.2 Excel 文件提取

```python
class ExcelExtractor:
    """Excel 文件提取器"""
    
    def extract(
        self,
        file_path: Union[str, Path],
        sheet_name: Optional[str] = None
    ) -> Dict:
        """提取 Excel 数据"""
        file_path = Path(file_path)
        
        if not file_path.exists():
            return {
                "success": False,
                "error": f"文件不存在: {file_path}"
            }
        
        try:
            # 读取指定 sheet 或第一个 sheet
            df = pd.read_excel(
                file_path,
                sheet_name=sheet_name or 0,
                engine="openpyxl"
            )
            
            return {
                "success": True,
                "data": df.to_dict(orient="records"),
                "metadata": {
                    "source": str(file_path),
                    "extract_time": datetime.now().isoformat(),
                    "row_count": len(df),
                    "columns": list(df.columns),
                    "sheet_name": sheet_name or "Sheet1",
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
```

### 3.3 JSON 文件提取

```python
import json

class JSONExtractor:
    """JSON 文件提取器"""
    
    def extract(self, file_path: Union[str, Path]) -> Dict:
        """提取 JSON 数据"""
        file_path = Path(file_path)
        
        if not file_path.exists():
            return {
                "success": False,
                "error": f"文件不存在: {file_path}"
            }
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # 统一转换为列表
            if isinstance(data, dict):
                data = [data]
            
            return {
                "success": True,
                "data": data,
                "metadata": {
                    "source": str(file_path),
                    "extract_time": datetime.now().isoformat(),
                    "row_count": len(data),
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
```

---

## 四、从数据库提取数据

### 4.1 SQLAlchemy 提取器

```python
from sqlalchemy import create_engine, text
import pandas as pd

class DatabaseExtractor:
    """数据库提取器"""
    
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string)
    
    def extract(
        self,
        query: str,
        params: Optional[Dict] = Any
    ) -> Dict:
        """执行查询提取数据"""
        try:
            df = pd.read_sql(
                text(query),
                self.engine,
                params=params
            )
            
            return {
                "success": True,
                "data": df.to_dict(orient="records"),
                "metadata": {
                    "source": "database",
                    "extract_time": datetime.now().isoformat(),
                    "row_count": len(df),
                    "columns": list(df.columns),
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def extract_table(
        self,
        table_name: str,
        columns: Optional[List[str]] = None,
        where: Optional[str] = None,
        limit: Optional[int] = None
    ) -> Dict:
        """提取整表数据"""
        
        # 构建查询
        cols = ", ".join(columns) if columns else "*"
        query = f"SELECT {cols} FROM {table_name}"
        
        if where:
            query += f" WHERE {where}"
        
        if limit:
            query += f" LIMIT {limit}"
        
        return self.extract(query)
```

---

## 五、统一提取接口

### 5.1 提取器工厂

```python
from enum import Enum

class SourceType(Enum):
    API = "api"
    CSV = "csv"
    EXCEL = "excel"
    JSON = "json"
    DATABASE = "database"

class ExtractorFactory:
    """提取器工厂"""
    
    @staticmethod
    def create(source_type: SourceType, **kwargs):
        """创建提取器"""
        
        if source_type == SourceType.API:
            return APIExtractor(**kwargs)
        
        elif source_type == SourceType.CSV:
            return CSVExtractor(**kwargs)
        
        elif source_type == SourceType.EXCEL:
            return ExcelExtractor(**kwargs)
        
        elif source_type == SourceType.JSON:
            return JSONExtractor(**kwargs)
        
        elif source_type == SourceType.DATABASE:
            return DatabaseExtractor(**kwargs)
        
        else:
            raise ValueError(f"不支持的数据源类型: {source_type}")

# 使用示例
api_extractor = ExtractorFactory.create(
    SourceType.API,
    base_url="https://api.example.com",
    api_key="your_key"
)

csv_extractor = ExtractorFactory.create(SourceType.CSV, encoding="utf-8")
```

### 5.2 统一提取结果格式

```python
from dataclasses import dataclass
from typing import Any, List, Optional
from datetime import datetime

@dataclass
class ExtractResult:
    """提取结果"""
    success: bool
    data: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    
    @property
    def row_count(self) -> int:
        return len(self.data) if self.data else 0
    
    def to_dict(self) -> Dict:
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "metadata": self.metadata,
            "row_count": self.row_count
        }

class UnifiedExtractor:
    """统一提取器"""
    
    def extract(self, source_type: SourceType, **kwargs) -> ExtractResult:
        """统一提取接口"""
        
        extractor = ExtractorFactory.create(source_type, **kwargs)
        
        # 根据类型调用相应方法
        if source_type == SourceType.API:
            result = extractor.extract(kwargs.get("endpoint"), kwargs.get("params"))
        elif source_type in [SourceType.CSV, SourceType.EXCEL, SourceType.JSON]:
            result = extractor.extract(kwargs.get("file_path"))
        elif source_type == SourceType.DATABASE:
            result = extractor.extract(kwargs.get("query"), kwargs.get("params"))
        else:
            return ExtractResult(success=False, error="不支持的类型")
        
        return ExtractResult(
            success=result["success"],
            data=result.get("data"),
            error=result.get("error"),
            metadata=result.get("metadata")
        )
```

---

## 六、提取日志和批次管理

### 6.1 批次管理

```python
import uuid
from datetime import datetime

class BatchManager:
    """批次管理器"""
    
    def __init__(self, source: str):
        self.source = source
    
    def create_batch_id(self) -> str:
        """创建批次号"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = uuid.uuid4().hex[:8]
        return f"{self.source}_{timestamp}_{unique_id}"
    
    def create_batch_record(self, batch_id: str) -> Dict:
        """创建批次记录"""
        return {
            "batch_id": batch_id,
            "source": self.source,
            "start_time": datetime.now().isoformat(),
            "status": "running",
            "extracted_count": 0,
            "error_count": 0,
        }

# 使用示例
batch_mgr = BatchManager("jobs_api")
batch_id = batch_mgr.create_batch_id()
# 输出: "jobs_api_20240115_083000_a1b2c3d4"
```

### 6.2 提取日志

```python
import logging
from typing import Dict, Any

class ExtractLogger:
    """提取日志"""
    
    def __init__(self, log_file: str = "extract.log"):
        self.logger = logging.getLogger("extract")
        self.logger.setLevel(logging.INFO)
        
        # 文件处理器
        handler = logging.FileHandler(log_file, encoding="utf-8")
        handler.setFormatter(logging.Formatter(
            "%(asctime)s - %(levelname)s - %(message)s"
        ))
        self.logger.addHandler(handler)
    
    def log_start(self, batch_id: str, source: str):
        """记录开始"""
        self.logger.info(f"批次 {batch_id} 开始提取 - 来源: {source}")
    
    def log_success(self, batch_id: str, count: int):
        """记录成功"""
        self.logger.info(f"批次 {batch_id} 提取成功 - 数量: {count}")
    
    def log_error(self, batch_id: str, error: str):
        """记录失败"""
        self.logger.error(f"批次 {batch_id} 提取失败 - 错误: {error}")
    
    def log_complete(self, batch_id: str, stats: Dict[str, Any]):
        """记录完成"""
        self.logger.info(
            f"批次 {batch_id} 完成 - "
            f"成功: {stats.get('success', 0)}, "
            f"失败: {stats.get('failed', 0)}"
        )
```

---

## 七、完整的提取流程示例

```python
from datetime import datetime

class DataExtractionPipeline:
    """数据提取管道"""
    
    def __init__(self, source: str, source_type: SourceType, **config):
        self.source = source
        self.source_type = source_type
        self.config = config
        
        self.batch_mgr = BatchManager(source)
        self.extractor = UnifiedExtractor()
        self.logger = ExtractLogger()
    
    def run(self) -> Dict:
        """运行提取流程"""
        
        # 1. 创建批次
        batch_id = self.batch_mgr.create_batch_id()
        batch_record = self.batch_mgr.create_batch_record(batch_id)
        
        self.logger.log_start(batch_id, self.source)
        
        try:
            # 2. 提取数据
            result = self.extractor.extract(self.source_type, **self.config)
            
            if not result.success:
                self.logger.log_error(batch_id, result.error)
                batch_record["status"] = "failed"
                batch_record["error"] = result.error
                return batch_record
            
            # 3. 更新批次记录
            batch_record["status"] = "completed"
            batch_record["extracted_count"] = result.row_count
            batch_record["end_time"] = datetime.now().isoformat()
            batch_record["metadata"] = result.metadata
            
            self.logger.log_success(batch_id, result.row_count)
            
            return {
                "batch_record": batch_record,
                "data": result.data
            }
            
        except Exception as e:
            self.logger.log_error(batch_id, str(e))
            batch_record["status"] = "failed"
            batch_record["error"] = str(e)
            return batch_record

# 使用示例
pipeline = DataExtractionPipeline(
    source="jobs_api",
    source_type=SourceType.API,
    base_url="https://api.example.com",
    endpoint="/jobs",
    params={"city": "beijing"}
)

result = pipeline.run()
```

---

## 常见误区

- **提取阶段就做数据清洗**：Extract 的职责是"原样获取"，清洗是 Transform 的事。在提取阶段修改数据会破坏原始数据的可追溯性。
- **不记录来源信息**：很多初学者只保存数据本身，不记录数据来自哪个 API、哪个文件、什么时间采集的。一旦数据有问题，根本无法溯源。
- **忽略分页边界情况**：只测试了正常分页，没考虑空页、最后一页不满、API 返回重复数据等边界情况，导致线上数据丢失或重复。
- **重试策略过于简单**：直接 `time.sleep(5)` 然后重试，不区分临时故障和永久故障（如 401 认证失败），也不做指数退避，可能把 API 打崩。

---

## 工程建议

1. **原始数据永远保留一份**：提取的数据先写入 `raw_*` 表或原始文件，后续处理基于副本操作。这样出问题时可以回溯对比。
2. **每个提取任务生成唯一批次号**：批次号包含数据源、时间戳和唯一 ID，方便后续追踪"这批数据是哪次运行产出的"。
3. **提取器设计为可组合的接口**：用工厂模式或策略模式封装不同数据源，对外暴露统一的 `extract()` 接口，方便扩展新数据源。
4. **设置合理的超时和重试参数**：API 调用建议超时 30 秒，重试 3 次，指数退避（1s、2s、4s）。对 4xx 错误（除 429）不重试，5xx 和网络错误才重试。

---

## 动手练习

### 练习一：实现 CSV 提取器

实现一个 CSV 提取器，要求：

1. 支持指定编码
2. 支持指定列提取
3. 记录提取元信息
4. 处理文件不存在的情况

### 练习二：实现分页 API 提取

实现一个分页 API 提取器，要求：

1. 自动处理分页
2. 支持自定义分页参数
3. 设置最大页数限制
4. 记录提取进度

### 练习三：设计统一提取接口

设计一个统一的提取接口，支持：

1. API、CSV、JSON 三种数据源
2. 统一的返回格式
3. 批次管理
4. 日志记录

---

## 小结

本课的核心要点：

1. **Extract**是 ETL 的第一步，负责从数据源获取原始数据
2. **多种数据源**：API、CSV、Excel、JSON、数据库
3. **统一接口**：通过工厂模式创建不同的提取器
4. **批次管理**：每次提取都有唯一批次号
5. **日志记录**：记录提取的开始、成功、失败

---

## 下一课预告

下一课我们将学习 **Transform - 清洗、去重、标准化**，这是 ETL 中最重要的环节，把原始数据变成可信赖的高质量数据。
