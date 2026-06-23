# 阶段实战：招聘数据 ETL 管道

> 你的任务：搭建一个能跑在生产环境的招聘数据 ETL 管道。不是 demo，是出了问题能定位、能重试、能追溯的那种。

把前面六课串起来：从招聘 API 拉数据 → 清洗标准化 → 质量检查 → 写入数据库。每一步有日志，每一批数据有批次号，失败的数据不会污染干净表。

```
招聘 API → Extract → Transform → Quality Check → clean_jobs
                                                → quarantine_jobs
```

---

## 项目结构

```
jobs_etl/
├── config/settings.py      # 配置
├── extractors/api_extractor.py
├── transformers/cleaner.py
├── quality/checker.py
├── loaders/db_loader.py
├── pipeline.py
└── main.py
```

按 E→T→Q→L 拆模块，每个阶段可独立测试。

## 配置

```python
from dataclasses import dataclass, field

@dataclass
class ETLConfig:
    api_base_url: str = "https://api.example.com"
    api_key: str = None
    page_size: int = 100
    max_pages: int = 50
    strip_fields: list = field(default_factory=lambda: ["title", "company", "city"])
    salary_fields: list = field(default_factory=lambda: ["salary_min", "salary_max"])
    experience_map: dict = field(default_factory=lambda: {
        "应届": "不限", "1年以下": "1-3年", "3-5年": "3-5年", "5-10年": "5-10年", "10年以上": "10年以上"})
    fill_defaults: dict = field(default_factory=lambda: {"experience": "未知", "education": "未知", "skills": ""})
    required_fields: list = field(default_factory=lambda: ["job_id", "title", "company", "city"])
    salary_range: tuple = (0, 500000)
    db_url: str = "postgresql://user:pass@localhost:5432/jobs"
```

## 提取器

```python
import requests, time
from datetime import datetime

class JobsAPIExtractor:
    def __init__(self, config):
        self.config = config
        self.session = requests.Session()
        self.session.headers["Accept"] = "application/json"
        if config.api_key:
            self.session.headers["Authorization"] = f"Bearer {config.api_key}"

    def extract(self, city=None, keyword=None) -> list:
        all_jobs = []
        for page in range(1, self.config.max_pages + 1):
            params = {"page": page, "page_size": self.config.page_size}
            if city: params["city"] = city
            if keyword: params["keyword"] = keyword
            data = self._request_with_retry(f"{self.config.api_base_url}/jobs", params)
            if not data: break
            jobs = data.get("data", [])
            if not jobs: break
            for job in jobs:
                job["_source"] = "jobs_api"
                job["_crawl_time"] = datetime.now().isoformat()
            all_jobs.extend(jobs)
        return all_jobs

    def _request_with_retry(self, url, params):
        for attempt in range(3):
            try:
                resp = self.session.get(url, params=params, timeout=30)
                if resp.status_code >= 500: time.sleep(2 ** attempt); continue
                resp.raise_for_status()
                return resp.json()
            except requests.RequestException: time.sleep(2 ** attempt)
        return None
```

给每条数据加 `_source` 和 `_crawl_time`——排查数据问题时你需要知道"这条数据是什么时候从哪来的"。

## 清洗器

```python
import pandas as pd, re

class JobsCleaner:
    def __init__(self, config):
        self.config = config

    def clean(self, raw_data: list) -> pd.DataFrame:
        df = pd.DataFrame(raw_data)
        for col in self.config.strip_fields:
            if col in df.columns:
                df[col] = df[col].astype(str).str.strip().replace("nan", None)
        for col in self.config.salary_fields:
            if col in df.columns: df[col] = df[col].apply(self._to_number)
        if all(c in df.columns for c in ["salary_min", "salary_max"]):
            df["salary_avg"] = (df["salary_min"] + df["salary_max"]) / 2
            bad = df["salary_min"] > df["salary_max"]
            df.loc[bad, ["salary_min", "salary_max"]] = df.loc[bad, ["salary_max", "salary_min"]].values
        if "experience" in df.columns:
            df["experience"] = df["experience"].map(self.config.experience_map).fillna(df["experience"])
        df = df.fillna(self.config.fill_defaults)
        if "job_id" in df.columns:
            df = df.sort_values("_crawl_time", ascending=False).drop_duplicates("job_id", keep="first")
        return df

    @staticmethod
    def _to_number(val):
        if pd.isna(val): return None
        if isinstance(val, (int, float)): return float(val)
        cleaned = re.sub(r"[￥$€¥,元/月]", "", str(val).strip())
        try: return float(cleaned)
        except ValueError: return None
```

去重放在清洗阶段——同一职位可能从不同 API 被多次拉到，只有标准化 `job_id` 后才能正确去重。

## 质量检查与加载

```python
class QualityChecker:
    def __init__(self, config): self.config = config
    def check(self, df) -> dict:
        issues = []
        for field in self.config.required_fields:
            if field in df.columns:
                null_count = df[field].isnull().sum()
                if null_count > 0:
                    issues.append({"rule": f"{field}_required", "severity": "critical" if field == "job_id" else "error", "count": int(null_count)})
        for col in self.config.salary_fields:
            if col in df.columns:
                lo, hi = self.config.salary_range
                bad = ((df[col] < lo) | (df[col] > hi)).sum()
                if bad > 0: issues.append({"rule": f"{col}_range", "severity": "warning", "count": int(bad)})
        return {"total": len(df), "passed": len(issues) == 0, "issues": issues}
```

质量检查不修改数据，只报告问题。
```python
import pandas as pd
from sqlalchemy import create_engine, text

class DBLoader:
    def __init__(self, db_url: str): self.engine = create_engine(db_url)

    def load_raw(self, data: list, batch_id: str) -> int:
        df = pd.DataFrame(data); df["batch_id"] = batch_id
        df.to_sql("raw_jobs", self.engine, if_exists="append", index=False); return len(df)

    def load_clean(self, df: pd.DataFrame, batch_id: str) -> int:
        df = df.copy(); df["batch_id"] = batch_id; loaded = 0
        with self.engine.begin() as conn:
            for _, row in df.iterrows():
                record = row.to_dict()
                cols = ", ".join(record.keys())
                placeholders = ", ".join(f":{k}" for k in record.keys())
                update_cols = [k for k in record if k != "job_id"]
                update_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
                conn.execute(text(f"INSERT INTO clean_jobs ({cols}) VALUES ({placeholders}) ON CONFLICT (job_id) DO UPDATE SET {update_clause}"), record)
                loaded += 1
        return loaded

    def load_quarantine(self, df, indices, batch_id):
        if not indices: return 0
        q = df.loc[indices].copy(); q["batch_id"] = batch_id; q["status"] = "pending"
        q.to_sql("quarantine_jobs", self.engine, if_exists="append", index=False); return len(q)
```

Upsert 保证重复运行不会插入重复数据。
## 管道编排与运行

```python
import uuid
from datetime import datetime

class JobsETLPipeline:
    def __init__(self, config):
        self.config = config
        self.extractor = JobsAPIExtractor(config)
        self.cleaner = JobsCleaner(config)
        self.checker = QualityChecker(config)
        self.loader = DBLoader(config.db_url)

    def run(self, city=None, keyword=None) -> dict:
        batch_id = f"etl_{datetime.now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}"
        result = {"batch_id": batch_id, "start_time": datetime.now()}
        try:
            raw_data = self.extractor.extract(city, keyword)
            self.loader.load_raw(raw_data, batch_id)
            clean_df = self.cleaner.clean(raw_data)
            quality = self.checker.check(clean_df)
            loaded = self.loader.load_clean(clean_df, batch_id)
            result.update({"status": "completed", "raw_count": len(raw_data),
                           "clean_count": len(clean_df), "loaded_count": loaded, "quality": quality})
        except Exception as e:
            result.update({"status": "failed", "error": str(e)})
        result["end_time"] = datetime.now()
        result["duration"] = (result["end_time"] - result["start_time"]).total_seconds()
        return result
```

运行：`JobsETLPipeline(ETLConfig()).run(city="北京", keyword="前端")`
## 验收清单

- `raw_jobs` 保留原始数据，`job_id` 不重复入库（Upsert）
- 质量规则覆盖：必填、范围、枚举、唯一性
- `quarantine_jobs` 接住异常数据，`batch_id` 可追溯
- 管道重跑不会产生重复数据

## 练习与参考答案

### 练习一：补全异常隔离

修改 `run` 方法：根据质量检查结果把有问题的记录写入 `quarantine_jobs`，只把通过检查的写入 `clean_jobs`。

质量检查返回问题记录索引，用索引把数据分成"干净"和"隔离"两部分。遍历 `quality["issues"]`，找到 severity 为 critical 的字段，提取对应空值行的索引，调用 `load_quarantine` 写入隔离表，然后 `drop` 这些行再写入 `clean_jobs`。

```python
quarantine_indices = []
for issue in quality["issues"]:
    if issue["severity"] == "critical":
        field = issue["rule"].replace("_required", "")
        if field in clean_df.columns:
            quarantine_indices.extend(clean_df[clean_df[field].isnull()].index.tolist())
quarantine_indices = list(set(quarantine_indices))
self.loader.load_quarantine(clean_df, quarantine_indices, batch_id)
good_df = clean_df.drop(quarantine_indices)
loaded = self.loader.load_clean(good_df, batch_id)
```

`job_id` 为空是 critical——没有主键的记录无法追踪，必须隔离。

### 练习二：定时调度

```python
import schedule, time, logging
from config.settings import ETLConfig
from pipeline import JobsETLPipeline

logging.basicConfig(filename="etl_schedule.log", level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(message)s")

def run_etl():
    try:
        result = JobsETLPipeline(ETLConfig()).run()
        logging.info(f"完成: {result['batch_id']}")
    except Exception as e:
        logging.error(f"失败: {e}")

schedule.every().day.at("08:00").do(run_etl)
while True:
    schedule.run_pending(); time.sleep(60)
```

用 `logging` 而不是 `print`——定时任务跑在后台，日志文件是唯一的排查手段。
