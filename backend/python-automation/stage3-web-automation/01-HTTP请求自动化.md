# HTTP 请求自动化

## 场景引入

你负责维护一个内部系统，需要每天定时调用第三方 API 拉取数据、同步到本地数据库。手动操作不仅枯燥，还容易遗漏。你需要一个脚本自动完成 HTTP 请求、处理认证、管理会话、应对网络异常。Python 的 `requests` 库是处理这些需求的标准工具。

## 学习目标

- 掌握 `requests` 发送 GET/POST 请求及自定义 Headers 和 Cookies
- 理解 Session 对象如何保持会话状态
- 能实现 Basic、Bearer 等常见认证方式
- 能设计限流、超时、重试机制
- 能封装一个生产级 API 客户端

## requests 基础

### GET 与 POST 请求

```python
import requests

# GET 请求
resp = requests.get("https://httpbin.org/get", params={"page": 1, "size": 10})
print(resp.status_code, resp.json())

# POST JSON
resp = requests.post("https://httpbin.org/post", json={"username": "admin"})

# POST 表单
resp = requests.post("https://httpbin.org/post", data={"field1": "value1"})

# 上传文件
with open("report.pdf", "rb") as f:
    resp = requests.post("https://httpbin.org/post", files={"file": f})
```

`params` 自动编码为查询字符串；`json=` 自动设置 `Content-Type: application/json`。

### 自定义 Headers 和 Cookies

```python
headers = {"User-Agent": "MyApp/1.0", "Accept": "application/json"}
cookies = {"session_id": "abc123"}
resp = requests.get(url, headers=headers, cookies=cookies)
```

## Session 保持会话

```python
with requests.Session() as session:
    session.headers.update({"Authorization": "Bearer my-token"})
    session.post("https://httpbin.org/post", json={"user": "admin", "pass": "123"})
    resp = session.get("https://httpbin.org/get")
```

`Session` 自动管理 Cookie、连接池和默认 Headers，比每次调用 `requests.get()` 更高效。

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

## 超时与限流

```python
# 超时：连接 5 秒，读取 10 秒
resp = requests.get(url, timeout=(5, 10))

# 令牌桶限流
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

`timeout` 不设置则永久等待，生产环境必须指定。

## 错误处理与指数退避

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

指数退避 `2 ** attempt` 避免在服务器过载时频繁重试。

## 完整示例：带重试和限流的 API 客户端

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

集成 Session 连接池、自动重试（指数退避）、令牌桶限流、超时控制和上下文管理器。

## 常见误区

### 1. 不设置超时

```python
# ❌ 永久等待，脚本挂起
resp = requests.get(url)
# ✅ 必须设置超时
resp = requests.get(url, timeout=10)
```

### 2. 每次请求创建新连接

```python
# ❌ 每次新建 TCP 连接
for url in urls:
    requests.get(url)
# ✅ 用 Session 复用连接
session = requests.Session()
for url in urls:
    session.get(url)
```

### 3. 忽略 HTTP 错误状态码

```python
# ❌ 404/500 不会抛异常
resp = requests.get(url)
# ✅ 检查状态码
resp.raise_for_status()
```

## 工程建议

1. **始终设置超时**：生产环境用 `timeout=(5, 15)` 区分连接和读取超时
2. **用 Session 复用连接**：减少 TCP 握手开销
3. **敏感信息不硬编码**：Token 从环境变量读取
4. **重试用指数退避**：`2 ** attempt` 秒间隔，避免雪崩

## 小结

本节学习了 requests 的 GET/POST 请求、Headers/Cookies 设置、Session 会话管理、多种认证方式、超时和限流机制。通过封装 APIClient 类，将这些能力整合为可复用的生产级客户端。

## 练习

### 练习一：批量下载文件

编写脚本，从 URL 列表批量下载文件，要求：使用 Session、设置超时、失败重试 3 次。

### 练习二：实现指数退避重试装饰器

编写装饰器 `@retry_with_backoff(max_retries=3, base_delay=1)`，异常时自动重试，间隔指数增长。

---

## 参考答案

### 练习一

**思路**：用 Session 复用连接，流式下载，分块写入避免内存溢出。

**答案**：

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

**要点**：`stream=True` 流式下载大文件；`iter_content` 分块写入。

### 练习二

**思路**：用 `functools.wraps` 保留元信息，循环重试并指数增长延迟。

**答案**：

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

**要点**：`max_retries + 1` 次循环保证首次调用加重试次数正确。
