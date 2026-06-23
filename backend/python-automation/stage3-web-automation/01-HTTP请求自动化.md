# HTTP 请求自动化

## 为什么需要封装 HTTP 请求

你负责维护一个内部系统，每天定时调用第三方 API 拉取数据同步到本地。手动操作枯燥且容易遗漏。你需要一个脚本自动完成 HTTP 请求、处理认证、管理会话、应对网络异常。

Python 的 `requests` 库是处理这些需求的标准工具。但直接用 `requests.get()` 不够——生产环境需要超时、重试、限流、会话管理。

## requests 基础

```python
import requests

# GET 请求，参数自动编码为查询字符串
resp = requests.get("https://httpbin.org/get", params={"page": 1, "size": 10})
print(resp.status_code, resp.json())

# POST JSON，自动设置 Content-Type
resp = requests.post("https://httpbin.org/post", json={"username": "admin"})

# 上传文件
with open("report.pdf", "rb") as f:
    resp = requests.post("https://httpbin.org/post", files={"file": f})
```

## Session 保持会话

`Session` 自动管理 Cookie、连接池和默认 Headers，比每次调用 `requests.get()` 高效：

```python
with requests.Session() as session:
    session.headers.update({"Authorization": "Bearer my-token"})
    session.post("https://httpbin.org/post", json={"user": "admin", "pass": "123"})
    resp = session.get("https://httpbin.org/get")
```

连续请求同一站点时，Session 复用 TCP 连接，减少握手开销。

## 认证方式

```python
from requests.auth import HTTPBasicAuth

# Basic 认证
resp = requests.get(url, auth=("admin", "pass"))

# Bearer Token
headers = {"Authorization": f"Bearer {token}"}
resp = requests.get(url, headers=headers)

# OAuth 2.0 获取 Token
resp = requests.post(token_url, data={
    "grant_type": "client_credentials",
    "client_id": client_id,
    "client_secret": client_secret,
})
token = resp.json()["access_token"]
```

## 超时与重试

生产环境必须设置超时，否则脚本可能永久挂起：

```python
# 超时：连接 5 秒，读取 10 秒
resp = requests.get(url, timeout=(5, 10))
```

指数退避重试——避免在服务器过载时频繁重试：

```python
import time
import requests
from requests.exceptions import HTTPError, ConnectionError, Timeout

def safe_request(url: str, max_retries: int = 3) -> requests.Response:
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            return resp
        except Timeout:
            print(f"第 {attempt + 1} 次超时")
        except ConnectionError:
            print(f"第 {attempt + 1} 次连接失败")
        except HTTPError:
            if resp.status_code >= 500:
                print(f"服务器错误 {resp.status_code}")
            else:
                raise
        time.sleep(2 ** attempt)
    raise RuntimeError(f"请求失败，已重试 {max_retries} 次")
```

`2 ** attempt` 产生 1s、2s、4s 的退避间隔。客户端错误（4xx）不重试，直接抛出。

## 限流

令牌桶限流——控制请求频率，避免触发 API 限速：

```python
import time, threading

class RateLimiter:
    def __init__(self, calls_per_second: float):
        self.interval = 1.0 / calls_per_second
        self.lock = threading.Lock()
        self.last_call = 0.0

    def acquire(self):
        with self.lock:
            wait = self.interval - (time.monotonic() - self.last_call)
            if wait > 0:
                time.sleep(wait)
            self.last_call = time.monotonic()
```

## 完整 API 客户端

集成 Session 连接池、自动重试、限流、超时和上下文管理器：

```python
import time
import threading
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

class APIClient:
    def __init__(self, base_url: str, token: str, calls_per_second: float = 5):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        })
        retry = Retry(total=3, backoff_factor=1, status_forcelist=[502, 503, 504])
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        self.interval = 1.0 / calls_per_second
        self.lock = threading.Lock()
        self.last_call = 0.0

    def _throttle(self):
        with self.lock:
            wait = self.interval - (time.monotonic() - self.last_call)
            if wait > 0:
                time.sleep(wait)
            self.last_call = time.monotonic()

    def request(self, method: str, path: str, **kwargs) -> dict:
        self._throttle()
        kwargs.setdefault("timeout", (5, 15))
        resp = self.session.request(method, f"{self.base_url}{path}", **kwargs)
        resp.raise_for_status()
        return resp.json()

    def get(self, path: str, **kwargs) -> dict:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs) -> dict:
        return self.request("POST", path, **kwargs)

    def close(self):
        self.session.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

if __name__ == "__main__":
    with APIClient("https://api.example.com", "my-token") as client:
        users = client.get("/users", params={"page": 1})
        print(users)
```

`Retry` + `HTTPAdapter` 处理 5xx 自动重试；`_throttle` 用锁保证线程安全；上下文管理器确保连接释放。

## 踩坑提醒

**不设置超时**：`requests.get(url)` 无超时时永久等待，生产环境必须指定。

**每次请求创建新连接**：用 Session 复用连接，减少 TCP 握手开销。

**忽略 HTTP 错误状态码**：404/500 不会抛异常，必须调 `resp.raise_for_status()`。

## 练习

### 练习一：批量下载文件

从 URL 列表批量下载文件，要求：使用 Session、设置超时、失败重试 3 次。

### 练习二：指数退避重试装饰器

编写装饰器 `@retry_with_backoff(max_retries=3, base_delay=1)`，异常时自动重试，间隔指数增长。

---

## 参考答案

### 练习一

```python
import requests
from pathlib import Path

def download_files(urls: list[str], dest_dir: str) -> None:
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    for i, url in enumerate(urls, 1):
        filename = url.split("/")[-1].split("?")[0] or f"file_{i}"
        for attempt in range(3):
            try:
                resp = session.get(url, timeout=30, stream=True)
                resp.raise_for_status()
                with open(dest / filename, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        f.write(chunk)
                print(f"{filename}: 下载完成")
                break
            except Exception as e:
                print(f"{filename}: 第 {attempt + 1} 次失败 ({e})")
    session.close()
```

`stream=True` 流式下载大文件；`iter_content` 分块写入避免内存溢出。

### 练习二

```python
import time
import functools

def retry_with_backoff(max_retries=3, base_delay=1.0):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries:
                        raise
                    delay = base_delay * (2 ** attempt)
                    print(f"重试 {attempt + 1}/{max_retries}，等待 {delay}s")
                    time.sleep(delay)
        return wrapper
    return decorator

@retry_with_backoff(max_retries=3, base_delay=1)
def fetch_data(url: str) -> dict:
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()
```

`max_retries + 1` 次循环保证首次调用加重试次数正确。
