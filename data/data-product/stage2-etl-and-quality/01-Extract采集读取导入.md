# Extract：采集、读取、导入

> 你有三个招聘网站的 API。一个偶尔超时，一个改了分页参数，一个改了返回格式。你的 `requests.get()` 脚本已经跑不动了。

这三个问题分别对应 Extract 的三个核心挑战：**容错**、**适配**、**校验**。

## Extract 的职责

只做一件事：**从数据源原样拿到数据，附上来源信息**。不在这个阶段做清洗——如果提取阶段就改了数据，后面发现有问题时你没法回溯对比。原始数据是"案发现场"，得保留。

## 从 API 提取

### 基本请求封装

直接用 `requests.get()` 能跑，但生产环境需要处理超时、认证、错误码：

```python
import requests
from datetime import datetime

class APIExtractor:
    def __init__(self, base_url: str, api_key: str = None):
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json"})
        if api_key: self.session.headers["Authorization"] = f"Bearer {api_key}"
        self.base_url = base_url

    def extract(self, endpoint: str, params: dict = None) -> dict:
        url = f"{self.base_url}/{endpoint}"
        try:
            resp = self.session.get(url, params=params, timeout=30)
            resp.raise_for_status()
            return {"success": True, "data": resp.json(),
                    "metadata": {"source": url, "extract_time": datetime.now().isoformat()}}
        except requests.RequestException as e:
            return {"success": False, "error": str(e)}
```

### 重试：不是所有错误都该重试

401（认证失败）重试一万次也没用，429（限流）和 5xx 才值得重试。用指数退避避免把对方打崩：

```python
import time

def retry_request(session, url, params, max_retries=3):
    for attempt in range(max_retries):
        try:
            resp = session.get(url, params=params, timeout=30)
            if resp.status_code == 429 or resp.status_code >= 500:
                time.sleep(2 ** attempt)
                continue
            resp.raise_for_status()
            return resp.json()
        except requests.ConnectionError:
            time.sleep(2 ** attempt)
    return None
```

### 分页提取

不同 API 的分页设计差异很大：有的用 `page` + `per_page`，有的用 `offset` + `limit`。关键是把分页参数名做成可配置的：

```python
def extract_all_pages(extractor, endpoint, params=None,
                      page_key="page", size_key="per_page",
                      page_size=100, max_pages=50, data_key="data"):
    all_data = []
    for page in range(1, max_pages + 1):
        page_params = {**(params or {}), page_key: page, size_key: page_size}
        result = extractor.extract(endpoint, page_params)
        if not result["success"]:
            break
        items = result["data"].get(data_key, []) if isinstance(result["data"], dict) else result["data"]
        if not items:
            break
        all_data.extend(items)
    return all_data
```

## 从文件提取

### CSV：编码是第一个坑

```python
import pandas as pd
from pathlib import Path

def extract_csv(file_path: str, encoding: str = "utf-8", required_columns: list = None) -> dict:
    path = Path(file_path)
    if not path.exists(): return {"success": False, "error": f"文件不存在: {path}"}
    try: df = pd.read_csv(path, encoding=encoding)
    except UnicodeDecodeError: df = pd.read_csv(path, encoding="gbk")
    if required_columns:
        missing = [c for c in required_columns if c not in df.columns]
        if missing: return {"success": False, "error": f"缺少列: {missing}"}
    return {"success": True, "data": df.to_dict(orient="records"),
            "metadata": {"source": str(path), "row_count": len(df), "columns": list(df.columns)}}
```

国内很多 CSV 是 GBK 编码，先试 UTF-8 再 fallback 到 GBK 是实际工程中的常见做法。

### JSON：结构不统一

```python
import json

def extract_json(file_path: str, data_key: str = None) -> dict:
    path = Path(file_path)
    if not path.exists(): return {"success": False, "error": f"文件不存在: {path}"}
    with open(path, "r", encoding="utf-8") as f: raw = json.load(f)
    if data_key and isinstance(raw, dict): data = raw.get(data_key, [])
    elif isinstance(raw, list): data = raw
    else: data = [raw]
    return {"success": True, "data": data, "metadata": {"source": str(path), "row_count": len(data)}}
```

## 从数据库提取

```python
from sqlalchemy import create_engine, text
import pandas as pd

class DatabaseExtractor:
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string)

    def extract(self, query: str, params: dict = None) -> dict:
        try:
            df = pd.read_sql(text(query), self.engine, params=params)
            return {
                "success": True, "data": df.to_dict(orient="records"),
                "metadata": {"row_count": len(df), "columns": list(df.columns)}
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
```

不要在提取阶段拼接用户输入到 SQL 里。用参数化查询（`params`）。

## 统一接口

三种数据源返回格式不一样，下游代码就要写三套 `if-else`。用注册器模式统一接口：

```python
from dataclasses import dataclass, field

@dataclass
class ExtractResult:
    success: bool
    data: list = field(default_factory=list)
    error: str = None
    metadata: dict = field(default_factory=dict)

EXTRACTORS = {}

def register_extractor(name):
    def decorator(fn):
        EXTRACTORS[name] = fn
        return fn
    return decorator

@register_extractor("csv")
def csv_ext(file_path, **kwargs):
    return extract_csv(file_path, **kwargs)

@register_extractor("json")
def json_ext(file_path, **kwargs):
    return extract_json(file_path, **kwargs)

def extract(source_type: str, **kwargs) -> ExtractResult:
    fn = EXTRACTORS.get(source_type)
    if not fn:
        return ExtractResult(success=False, error=f"不支持: {source_type}")
    result = fn(**kwargs)
    return ExtractResult(success=result["success"], data=result.get("data", []),
                         error=result.get("error"), metadata=result.get("metadata", {}))
```

新增数据源时只需要加一个函数和装饰器，不用改 `extract` 函数本身。

## 批次管理

每次提取生成一个批次号，格式包含数据源、时间戳和随机 ID：

```python
import uuid
from datetime import datetime

def create_batch_id(source: str) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{source}_{ts}_{uuid.uuid4().hex[:8]}"
```

批次号贯穿整个 ETL 流程。出了问题，搜批次号就能找到这批数据的完整生命周期。

## 练习与参考答案

### 练习一：带重试的分页提取器

实现一个函数，从分页 API 提取所有数据：支持自定义分页参数名，每页失败时重试 3 次（指数退避），返回结果包含每页的提取日志，最大页数限制防止无限循环。

### 练习二：统一提取器

设计一个提取器，支持 API、CSV、JSON 三种来源，统一 `ExtractResult` 返回格式，每次提取自动记录批次号，失败时返回结构化错误。

---

## 参考答案

### 练习一

```python
import requests, time

def extract_paginated(base_url, endpoint, params=None,
                      page_key="page", size_key="per_page",
                      page_size=100, max_pages=50, data_key="data"):
    session, all_data, page_log = requests.Session(), [], []
    for page in range(1, max_pages + 1):
        req_params = {**(params or {}), page_key: page, size_key: page_size}
        for attempt in range(3):
            try:
                resp = session.get(f"{base_url}{endpoint}", params=req_params, timeout=30)
                if resp.status_code >= 500: time.sleep(2 ** attempt); continue
                resp.raise_for_status()
                items = resp.json().get(data_key, [])
                page_log.append({"page": page, "records": len(items)})
                if not items: return {"data": all_data, "log": page_log}
                all_data.extend(items); break
            except requests.RequestException as e:
                if attempt == 2: page_log.append({"page": page, "records": 0, "error": str(e)})
                time.sleep(2 ** attempt)
        else: break
    return {"data": all_data, "log": page_log}
```

`page_log` 的价值：线上排查时你需要知道"第 7 页没拿到数据"，而不是只知道"总共少了 200 条"。

### 练习二

```python
from dataclasses import dataclass, field
import uuid
from datetime import datetime

@dataclass
class ExtractResult:
    success: bool
    data: list = field(default_factory=list)
    error: str = None
    metadata: dict = field(default_factory=dict)
    batch_id: str = ""

_registry = {}

def register(name):
    def deco(fn): _registry[name] = fn; return fn
    return deco

def extract(source_type: str, **kwargs) -> ExtractResult:
    fn = _registry.get(source_type)
    if not fn: return ExtractResult(success=False, error=f"未知数据源: {source_type}")
    batch_id = f"{source_type}_{datetime.now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}"
    raw = fn(**kwargs)
    return ExtractResult(success=raw["success"], data=raw.get("data", []),
                         error=raw.get("error"), metadata=raw.get("metadata", {}),
                         batch_id=batch_id)
```

把 `batch_id` 生成放在 `extract` 而不是各提取器里，是因为批次管理是 Extract 阶段的公共职责。
