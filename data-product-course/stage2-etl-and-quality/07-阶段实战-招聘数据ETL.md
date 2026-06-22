# 第7课：阶段实战 - 招聘数据 ETL

> **课程定位**：综合运用 ETL 技术，实现完整的招聘数据处理管道
> **前置知识**：第1-6课
> **预计时长**：120 分钟

---

## 场景引入

前面六节课你分别学了 Extract、Transform、Load、数据质量、异常处理和日志追踪。现在是时候把它们串起来了。你的任务是：为一个招聘数据产品搭建完整的 ETL 管道，每天从招聘网站 API 拉取最新职位数据，清洗标准化后写入数据库，全程有质量检查、异常隔离、批次日志和血缘追踪。这不是一个 demo，而是一个能跑在生产环境的、可重试、可追溯、可维护的数据管道。

---

## 学习目标

完成本课学习后，你将能够：

1. 设计完整的 ETL 管道架构
2. 实现数据提取、转换、加载的完整流程
3. 集成数据质量检查
4. 实现批次管理和日志记录
5. 处理异常数据和错误恢复

---

## 一、项目架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    招聘数据 ETL 架构                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   数据源                                                         │
│   ┌──────────┐                                                  │
│   │ 招聘网站  │                                                  │
│   │ API/网页  │                                                  │
│   └────┬─────┘                                                  │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    ETL 管道                              │  │
│   │                                                         │  │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │  │
│   │  │ Extract  │→ │Transform │→ │ Quality  │→ │  Load  │ │  │
│   │  │          │  │          │  │  Check   │  │        │ │  │
│   │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    数据库                                │  │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│   │  │ raw_jobs │  │clean_jobs│  │quarantine│              │  │
│   │  └──────────┘  └──────────┘  └──────────┘              │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    日志与监控                            │  │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│   │  │ 批次日志  │  │ ETL 日志 │  │ 血缘追踪 │              │  │
│   │  └──────────┘  └──────────┘  └──────────┘              │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 项目结构

```
jobs_etl/
├── config/
│   ├── settings.py          # 配置文件
│   └── quality_rules.py     # 质量规则
├── extractors/
│   ├── api_extractor.py     # API 提取器
│   └── web_extractor.py     # 网页提取器
├── transformers/
│   ├── cleaner.py           # 数据清洗
│   ├── normalizer.py        # 数据标准化
│   └── deduplicator.py      # 去重
├── loaders/
│   ├── db_loader.py         # 数据库加载
│   └── batch_loader.py      # 批量加载
├── quality/
│   ├── checker.py           # 质量检查
│   ├── quarantine.py        # 隔离处理
│   └── reporter.py          # 报告生成
├── logging/
│   ├── batch_manager.py     # 批次管理
│   ├── etl_logger.py        # ETL 日志
│   └── lineage.py           # 血缘追踪
├── pipeline.py              # ETL 管道
└── main.py                  # 入口文件
```

---

## 二、配置设计

### 2.1 配置文件

```python
# config/settings.py

from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass
class DatabaseConfig:
    """数据库配置"""
    host: str = "localhost"
    port: int = 5432
    database: str = "jobs_data"
    user: str = "postgres"
    password: str = "password"
    
    @property
    def connection_string(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"

@dataclass
class ExtractConfig:
    """提取配置"""
    # API 配置
    api_base_url: str = "https://api.example.com"
    api_key: Optional[str] = None
    api_timeout: int = 30
    
    # 分页配置
    page_size: int = 100
    max_pages: int = 100
    
    # 重试配置
    max_retries: int = 3
    retry_delay: float = 2.0

@dataclass
class TransformConfig:
    """转换配置"""
    # 需要清洗的字段
    strip_columns: List[str] = None
    
    # 数值转换
    numeric_columns: Dict[str, str] = None
    
    # 枚举标准化
    enum_mapping: Dict[str, Dict[str, str]] = None
    
    # 缺失值填充
    fill_defaults: Dict[str, any] = None
    
    # 去重配置
    dedup_keys: List[str] = None
    dedup_time_column: Optional[str] = None

@dataclass
class QualityConfig:
    """质量配置"""
    # 必填字段
    required_fields: List[str] = None
    
    # 范围检查
    range_checks: Dict[str, Dict[str, float]] = None
    
    # 枚举检查
    enum_checks: Dict[str, List[str]] = None
    
    # 是否隔离异常数据
    quarantine_enabled: bool = True
    
    # 是否自动修复
    auto_fix_enabled: bool = True

@dataclass
class ETLConfig:
    """ETL 总配置"""
    db: DatabaseConfig = None
    extract: ExtractConfig = None
    transform: TransformConfig = None
    quality: QualityConfig = None
    
    # 运行配置
    batch_size: int = 1000
    log_file: str = "etl.log"
    log_level: str = "INFO"

# 默认配置
DEFAULT_CONFIG = ETLConfig(
    db=DatabaseConfig(),
    extract=ExtractConfig(),
    transform=TransformConfig(
        strip_columns=["title", "company", "city", "district"],
        numeric_columns={
            "salary_min": "decimal",
            "salary_max": "decimal"
        },
        enum_mapping={
            "experience": {
                "应届": "不限",
                "1年以下": "1-3年",
                "1-3年": "1-3年",
                "3-5年": "3-5年",
                "5-10年": "5-10年",
                "10年以上": "10年以上",
            },
            "education": {
                "大专": "大专",
                "本科": "本科",
                "硕士": "硕士",
                "博士": "博士",
                "不限": "不限",
            }
        },
        fill_defaults={
            "experience": "未知",
            "education": "未知",
            "skills": "",
            "description": ""
        },
        dedup_keys=["job_id"],
        dedup_time_column="crawl_time"
    ),
    quality=QualityConfig(
        required_fields=["job_id", "title", "company", "city"],
        range_checks={
            "salary_min": {"min": 0, "max": 1000000},
            "salary_max": {"min": 0, "max": 1000000}
        },
        enum_checks={
            "experience": ["1-3年", "3-5年", "5-10年", "10年以上", "不限", "未知"],
            "education": ["大专", "本科", "硕士", "博士", "不限", "未知"]
        }
    )
)
```

---

## 三、数据提取

### 3.1 API 提取器

```python
# extractors/api_extractor.py

import requests
from typing import List, Dict, Any, Optional
from datetime import datetime

class JobsAPIExtractor:
    """招聘数据 API 提取器"""
    
    def __init__(self, config: ExtractConfig):
        self.config = config
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "JobsETL/1.0",
            "Accept": "application/json"
        })
        
        if config.api_key:
            self.session.headers["Authorization"] = f"Bearer {config.api_key}"
    
    def extract(self, city: str = None, keyword: str = None) -> List[Dict[str, Any]]:
        """提取招聘数据"""
        
        all_jobs = []
        page = 1
        
        while page <= self.config.max_pages:
            # 构建请求参数
            params = {
                "page": page,
                "page_size": self.config.page_size
            }
            
            if city:
                params["city"] = city
            if keyword:
                params["keyword"] = keyword
            
            # 发送请求
            response = self._request_with_retry(
                f"{self.config.api_base_url}/jobs",
                params
            )
            
            if not response:
                break
            
            jobs = response.get("data", [])
            
            if not jobs:
                break
            
            # 添加元信息
            for job in jobs:
                job["source"] = "jobs_api"
                job["crawl_time"] = datetime.now().isoformat()
            
            all_jobs.extend(jobs)
            page += 1
        
        return all_jobs
    
    def _request_with_retry(
        self,
        url: str,
        params: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """带重试的请求"""
        
        for attempt in range(self.config.max_retries):
            try:
                response = self.session.get(
                    url,
                    params=params,
                    timeout=self.config.api_timeout
                )
                response.raise_for_status()
                return response.json()
                
            except requests.RequestException as e:
                if attempt == self.config.max_retries - 1:
                    print(f"请求失败: {e}")
                    return None
                
                wait_time = self.config.retry_delay * (2 ** attempt)
                print(f"请求失败，{wait_time}秒后重试: {e}")
                time.sleep(wait_time)
        
        return None
```

---

## 四、数据转换

### 4.1 数据清洗器

```python
# transformers/cleaner.py

import pandas as pd
import re
from decimal import Decimal, InvalidOperation
from typing import Dict, Any, Optional, Tuple

class JobsDataCleaner:
    """招聘数据清洗器"""
    
    def __init__(self, config: TransformConfig):
        self.config = config
    
    def clean(self, raw_data: List[Dict[str, Any]]) -> pd.DataFrame:
        """清洗数据"""
        
        df = pd.DataFrame(raw_data)
        
        # 1. 字符串清洗
        df = self._clean_strings(df)
        
        # 2. 数值转换
        df = self._convert_numeric(df)
        
        # 3. 日期转换
        df = self._convert_dates(df)
        
        # 4. 枚举标准化
        df = self._normalize_enums(df)
        
        # 5. 薪资计算
        df = self._calculate_salary(df)
        
        # 6. 缺失值填充
        df = self._fill_missing(df)
        
        return df
    
    def _clean_strings(self, df: pd.DataFrame) -> pd.DataFrame:
        """清洗字符串"""
        for col in self.config.strip_columns:
            if col in df.columns:
                df[col] = df[col].astype(str).str.strip()
                df[col] = df[col].replace("nan", None)
        
        return df
    
    def _convert_numeric(self, df: pd.DataFrame) -> pd.DataFrame:
        """转换数值"""
        for col, dtype in self.config.numeric_columns.items():
            if col in df.columns:
                if dtype == "decimal":
                    df[col] = df[col].apply(self._to_decimal)
                elif dtype == "int":
                    df[col] = df[col].apply(self._to_int)
        
        return df
    
    def _to_decimal(self, value) -> Optional[Decimal]:
        """转换为 Decimal"""
        if pd.isna(value):
            return None
        
        if isinstance(value, (int, float)):
            return Decimal(str(value))
        
        if isinstance(value, str):
            # 移除货币符号
            cleaned = re.sub(r'[￥$€¥,]', '', value.strip())
            try:
                return Decimal(cleaned)
            except InvalidOperation:
                return None
        
        return None
    
    def _to_int(self, value) -> Optional[int]:
        """转换为整数"""
        if pd.isna(value):
            return None
        
        try:
            return int(float(str(value)))
        except (ValueError, TypeError):
            return None
    
    def _convert_dates(self, df: pd.DataFrame) -> pd.DataFrame:
        """转换日期"""
        date_columns = ["publish_date", "crawl_time"]
        
        for col in date_columns:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors="coerce")
        
        return df
    
    def _normalize_enums(self, df: pd.DataFrame) -> pd.DataFrame:
        """标准化枚举值"""
        for col, mapping in self.config.enum_mapping.items():
            if col in df.columns:
                df[col] = df[col].map(mapping).fillna(df[col])
        
        return df
    
    def _calculate_salary(self, df: pd.DataFrame) -> pd.DataFrame:
        """计算薪资"""
        if "salary_min" in df.columns and "salary_max" in df.columns:
            # 确保是数值类型
            df["salary_min"] = pd.to_numeric(df["salary_min"], errors="coerce")
            df["salary_max"] = pd.to_numeric(df["salary_max"], errors="coerce")
            
            # 计算平均薪资
            df["salary_avg"] = (df["salary_min"] + df["salary_max"]) / 2
            
            # 修复逻辑错误：min > max
            mask = df["salary_min"] > df["salary_max"]
            df.loc[mask, ["salary_min", "salary_max"]] = df.loc[mask, ["salary_max", "salary_min"]].values
        
        return df
    
    def _fill_missing(self, df: pd.DataFrame) -> pd.DataFrame:
        """填充缺失值"""
        return df.fillna(self.config.fill_defaults)
```

---

## 五、数据质量检查

### 5.1 质量检查器

```python
# quality/checker.py

import pandas as pd
from typing import List, Dict, Any

class JobsQualityChecker:
    """招聘数据质量检查器"""
    
    def __init__(self, config: QualityConfig):
        self.config = config
    
    def check(self, data: pd.DataFrame) -> Dict[str, Any]:
        """执行质量检查"""
        
        results = {
            "total_records": len(data),
            "passed": 0,
            "failed": 0,
            "checks": []
        }
        
        # 1. 必填字段检查
        null_checks = self._check_required_fields(data)
        results["checks"].extend(null_checks)
        
        # 2. 范围检查
        range_checks = self._check_ranges(data)
        results["checks"].extend(range_checks)
        
        # 3. 枚举检查
        enum_checks = self._check_enums(data)
        results["checks"].extend(enum_checks)
        
        # 4. 唯一性检查
        unique_checks = self._check_uniqueness(data)
        results["checks"].extend(unique_checks)
        
        # 统计结果
        for check in results["checks"]:
            if check["passed"]:
                results["passed"] += 1
            else:
                results["failed"] += 1
        
        return results
    
    def _check_required_fields(self, data: pd.DataFrame) -> List[Dict]:
        """检查必填字段"""
        checks = []
        
        for field in self.config.required_fields:
            if field in data.columns:
                null_count = data[field].isnull().sum()
                null_rate = null_count / len(data)
                
                checks.append({
                    "rule": f"{field}_not_null",
                    "passed": null_count == 0,
                    "severity": "critical" if field == "job_id" else "error",
                    "message": f"{field} 空值数量: {null_count} ({null_rate:.2%})"
                })
        
        return checks
    
    def _check_ranges(self, data: pd.DataFrame) -> List[Dict]:
        """检查范围"""
        checks = []
        
        for field, bounds in self.config.range_checks.items():
            if field in data.columns:
                min_val = bounds.get("min")
                max_val = bounds.get("max")
                
                series = pd.to_numeric(data[field], errors="coerce")
                violations = 0
                
                if min_val is not None:
                    violations += (series < min_val).sum()
                
                if max_val is not None:
                    violations += (series > max_val).sum()
                
                checks.append({
                    "rule": f"{field}_range",
                    "passed": violations == 0,
                    "severity": "error",
                    "message": f"{field} 范围违规: {violations}"
                })
        
        return checks
    
    def _check_enums(self, data: pd.DataFrame) -> List[Dict]:
        """检查枚举值"""
        checks = []
        
        for field, allowed_values in self.config.enum_checks.items():
            if field in data.columns:
                invalid_mask = ~data[field].isin(allowed_values)
                invalid_count = invalid_mask.sum()
                
                checks.append({
                    "rule": f"{field}_enum",
                    "passed": invalid_count == 0,
                    "severity": "warning",
                    "message": f"{field} 无效值: {invalid_count}"
                })
        
        return checks
    
    def _check_uniqueness(self, data: pd.DataFrame) -> List[Dict]:
        """检查唯一性"""
        checks = []
        
        if "job_id" in data.columns:
            duplicate_count = data["job_id"].duplicated().sum()
            
            checks.append({
                "rule": "job_id_unique",
                "passed": duplicate_count == 0,
                "severity": "error",
                "message": f"job_id 重复: {duplicate_count}"
            })
        
        return checks
```

---

## 六、数据加载

### 6.1 数据库加载器

```python
# loaders/db_loader.py

import pandas as pd
from sqlalchemy import create_engine, text
from typing import List, Dict, Any

class JobsDataLoader:
    """招聘数据加载器"""
    
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string)
    
    def load_to_raw(self, data: List[Dict[str, Any]], batch_id: str) -> int:
        """加载到原始表"""
        
        df = pd.DataFrame(data)
        df["batch_id"] = batch_id
        
        # 保存到原始表
        df.to_sql(
            "raw_jobs",
            self.engine,
            if_exists="append",
            index=False
        )
        
        return len(df)
    
    def load_to_clean(self, data: pd.DataFrame, batch_id: str) -> int:
        """加载到清洗表"""
        
        data["batch_id"] = batch_id
        data["clean_time"] = pd.Timestamp.now()
        
        # 使用 Upsert 方式
        loaded = 0
        
        for _, row in data.iterrows():
            record = row.to_dict()
            
            try:
                self._upsert_clean_job(record)
                loaded += 1
            except Exception as e:
                print(f"加载失败: {e}")
        
        return loaded
    
    def _upsert_clean_job(self, record: Dict[str, Any]):
        """Upsert 到清洗表"""
        
        columns = ", ".join(record.keys())
        placeholders = ", ".join([f":{key}" for key in record.keys()])
        
        # 排除主键的更新列
        update_columns = [k for k in record.keys() if k != "job_id"]
        update_clause = ", ".join([f"{col} = EXCLUDED.{col}" for col in update_columns])
        
        query = f"""
            INSERT INTO clean_jobs ({columns})
            VALUES ({placeholders})
            ON CONFLICT (job_id)
            DO UPDATE SET {update_clause}
        """
        
        with self.engine.connect() as conn:
            conn.execute(text(query), record)
            conn.commit()
    
    def load_to_quarantine(
        self,
        data: pd.DataFrame,
        anomalies: List[Dict[str, Any]],
        batch_id: str
    ) -> int:
        """加载到隔离表"""
        
        # 找出异常记录的索引
        anomaly_indices = set()
        for anomaly in anomalies:
            anomaly_indices.add(anomaly["record_index"])
        
        if not anomaly_indices:
            return 0
        
        # 提取异常数据
        quarantine_data = data.loc[list(anomaly_indices)].copy()
        quarantine_data["batch_id"] = batch_id
        quarantine_data["quarantine_time"] = pd.Timestamp.now()
        quarantine_data["status"] = "pending"
        
        # 写入隔离表
        quarantine_data.to_sql(
            "quarantine_jobs",
            self.engine,
            if_exists="append",
            index=False
        )
        
        return len(quarantine_data)
```

---

## 七、完整管道

### 7.1 ETL 管道实现

```python
# pipeline.py

import pandas as pd
from datetime import datetime
from typing import Dict, Any, Optional

class JobsETLPipeline:
    """招聘数据 ETL 管道"""
    
    def __init__(self, config: ETLConfig = None):
        self.config = config or DEFAULT_CONFIG
        
        # 初始化组件
        self.extractor = JobsAPIExtractor(self.config.extract)
        self.cleaner = JobsDataCleaner(self.config.transform)
        self.checker = JobsQualityChecker(self.config.quality)
        self.loader = JobsDataLoader(self.config.db.connection_string)
        
        # 日志和追踪
        self.batch_mgr = BatchLifecycle(self.config.db.connection_string)
        self.logger = None
        self.lineage = LineageTracker(self.config.db.connection_string)
        self.reporter = ETLReportGenerator(self.config.db.connection_string)
    
    def run(
        self,
        city: str = None,
        keyword: str = None,
        source: str = "jobs_api"
    ) -> Dict[str, Any]:
        """运行 ETL 管道"""
        
        # 生成批次号
        batch_id = BatchManager.generate_batch_id(source, "etl")
        
        # 创建批次记录
        self.batch_mgr.create_batch(batch_id, source, "etl")
        
        # 初始化日志
        self.logger = StructuredLogger(batch_id)
        
        result = {
            "batch_id": batch_id,
            "start_time": datetime.now()
        }
        
        try:
            # 1. Extract
            self.logger.log_extract_start(source)
            raw_data = self.extractor.extract(city, keyword)
            self.logger.log_extract_complete(len(raw_data), 0)
            
            # 保存原始数据
            self.loader.load_to_raw(raw_data, batch_id)
            
            # 记录血缘
            self.lineage.record_lineage(
                target_table="raw_jobs",
                source_api=self.config.extract.api_base_url,
                transform_type="extracted",
                batch_id=batch_id
            )
            
            # 2. Transform
            self.logger.log_transform_start()
            clean_data = self.cleaner.clean(raw_data)
            
            # 记录血缘
            self.lineage.record_lineage(
                target_table="clean_jobs",
                source_table="raw_jobs",
                transform_type="cleaned",
                transform_logic="数据清洗和标准化",
                batch_id=batch_id
            )
            
            # 3. Quality Check
            quality_result = self.checker.check(clean_data)
            self.logger.log_quality_check(
                quality_result["passed"],
                quality_result["failed"]
            )
            
            # 隔离异常数据
            quarantine_count = 0
            if self.config.quality.quarantine_enabled and quality_result["failed"] > 0:
                anomalies = self._extract_anomalies(quality_result)
                quarantine_count = self.loader.load_to_quarantine(
                    clean_data, anomalies, batch_id
                )
            
            # 4. Load
            self.logger.log_load_start("clean_jobs")
            loaded_count = self.loader.load_to_clean(clean_data, batch_id)
            self.logger.log_load_complete(loaded_count)
            
            # 完成批次
            self.batch_mgr.complete_batch(
                batch_id,
                total_records=len(raw_data),
                success_records=loaded_count,
                failed_records=quarantine_count
            )
            
            # 更新结果
            result.update({
                "status": "completed",
                "raw_count": len(raw_data),
                "clean_count": len(clean_data),
                "loaded_count": loaded_count,
                "quarantine_count": quarantine_count,
                "quality_result": quality_result
            })
            
        except Exception as e:
            self.logger.log_error("etl", str(e))
            self.batch_mgr.fail_batch(batch_id, str(e))
            
            result.update({
                "status": "failed",
                "error": str(e)
            })
        
        result["end_time"] = datetime.now()
        result["duration"] = (result["end_time"] - result["start_time"]).total_seconds()
        
        # 生成报告
        result["report"] = self.reporter.generate_batch_report(batch_id)
        
        return result
    
    def _extract_anomalies(self, quality_result: Dict[str, Any]) -> list:
        """提取异常信息"""
        anomalies = []
        
        for check in quality_result.get("checks", []):
            if not check["passed"]:
                anomalies.append({
                    "rule": check["rule"],
                    "severity": check["severity"],
                    "message": check["message"],
                    "record_index": 0  # 简化处理
                })
        
        return anomalies
    
    def print_result(self, result: Dict[str, Any]):
        """打印结果"""
        print("=" * 60)
        print("ETL 执行结果")
        print("=" * 60)
        print(f"批次号: {result['batch_id']}")
        print(f"状态: {result['status']}")
        print(f"耗时: {result['duration']:.2f} 秒")
        print()
        
        if result["status"] == "completed":
            print("【数据统计】")
            print(f"  原始数据: {result['raw_count']}")
            print(f"  清洗数据: {result['clean_count']}")
            print(f"  加载数据: {result['loaded_count']}")
            print(f"  隔离数据: {result['quarantine_count']}")
            print()
            
            print("【质量检查】")
            qr = result["quality_result"]
            print(f"  通过: {qr['passed']}")
            print(f"  失败: {qr['failed']}")
        else:
            print(f"错误: {result.get('error')}")
        
        print("=" * 60)
```

---

## 八、运行入口

### 8.1 主程序

```python
# main.py

import argparse
from config.settings import DEFAULT_CONFIG

def main():
    parser = argparse.ArgumentParser(description="招聘数据 ETL")
    parser.add_argument("--city", help="城市筛选")
    parser.add_argument("--keyword", help="关键词筛选")
    parser.add_argument("--source", default="jobs_api", help="数据源")
    
    args = parser.parse_args()
    
    # 创建管道
    pipeline = JobsETLPipeline(DEFAULT_CONFIG)
    
    # 运行
    result = pipeline.run(
        city=args.city,
        keyword=args.keyword,
        source=args.source
    )
    
    # 打印结果
    pipeline.print_result(result)

if __name__ == "__main__":
    main()
```

### 8.2 运行示例

```bash
# 运行 ETL
python main.py --city 北京 --keyword 前端

# 输出示例
# ============================================================
# ETL 执行结果
# ============================================================
# 批次号: jobs_api_etl_20240115_083000_a1b2c3d4
# 状态: completed
# 耗时: 45.23 秒
#
# 【数据统计】
#   原始数据: 1500
#   清洗数据: 1480
#   加载数据: 1450
#   隔离数据: 30
#
# 【质量检查】
#   通过: 8
#   失败: 2
# ============================================================
```

---

## 九、验收标准

### 9.1 自检清单

```
┌──────────────────────────────────────────────────────────────┐
│                    验收标准                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  □ 原始数据不被覆盖                                          │
│    └── raw_jobs 表保留原始数据                                │
│                                                              │
│  □ ETL 可重复执行且不会重复入库                              │
│    └── 使用 Upsert 和批次检查                                │
│                                                              │
│  □ 至少 5 条质量规则                                         │
│    └── 必填、范围、枚举、唯一性检查                          │
│                                                              │
│  □ 失败数据能被定位                                          │
│    └── 隔离表记录异常数据                                    │
│                                                              │
│  □ 有批次日志                                                │
│    └── etl_batch_log 表记录每次执行                          │
│                                                              │
│  □ 有数据血缘                                                │
│    └── data_lineage 表记录数据来源                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 常见误区

- **先把代码写完再加日志和质量检查**：日志和质量检查不是"锦上添花"，而是管道的核心组成部分。应该从一开始就集成，而不是事后补丁。
- **配置硬编码在代码里**：数据库连接串、API 地址、质量规则阈值等写死在 Python 文件中，换环境就要改代码。应该用配置文件或环境变量管理。
- **不做错误恢复测试**：只测试正常流程，不测试 API 超时、数据库连接断开、部分数据写入失败等异常场景。上线后遇到故障才发现没有兜底方案。
- **整个管道一个大函数搞定**：所有逻辑塞在一个函数里，无法单独测试提取、清洗、加载等环节。应该按职责拆分模块，每个模块可独立测试和替换。

---

## 工程建议

1. **管道按 E→T→Q→L 四阶段组织代码**：Extract、Transform、Quality Check、Load 各自独立模块，通过 Pipeline 类串联，方便单独测试和替换。
2. **配置驱动而非代码驱动**：质量规则、清洗映射、数据库连接等全部配置化，新增数据源或调整规则时只需改配置文件。
3. **每个批次运行完生成执行报告**：包含原始数据量、清洗后数据量、加载成功数、隔离数、质量检查通过率、各阶段耗时，方便运营监控。
4. **先在小数据量上验证，再跑全量**：开发和测试时先用 `--limit 100` 跑小数据量，确认流程正确后再跑全量，避免浪费时间和资源。

---

## 小结

本课的核心要点：

1. **完整 ETL 管道**：提取 → 转换 → 质量检查 → 加载
2. **数据质量**：集成质量检查，隔离异常数据
3. **批次管理**：每次执行都有唯一批次号和日志
4. **数据血缘**：追踪数据来源和转换过程
5. **错误处理**：异常捕获、失败记录、可重试

---

## 阶段总结

恭喜你完成第二阶段的学习！你已经掌握了：

1. Extract：从各种数据源提取数据
2. Transform：数据清洗、去重、标准化
3. Load：数据入库、幂等操作、事务控制
4. 数据质量：质量规则、检查、隔离、修复
5. 批次日志：批次管理、ETL 日志、血缘追踪
6. 完整 ETL：综合运用以上技术构建数据管道

下一阶段我们将进入**存储与 API**，学习如何设计数据表结构和提供数据查询接口。
