# API 集成

## 场景引入

你的团队使用 GitHub 管理代码，需要定期拉取 PR 列表、自动打标签、统计贡献。GitHub 提供了完善的 REST API，但直接用 `requests` 调用会遇到认证管理、分页处理、限流应对等问题。你需要封装一个结构清晰、可复用的 API 客户端。

## 学习目标

- 理解 REST API 的设计原则和常见模式
- 能封装面向对象的 API 客户端
- 能实现 Webhook 接收和处理
- 能处理 API 限流和重试

## REST API 设计原则

REST API 以资源为导向，HTTP 方法表示操作：

```
GET    /users          # 列表
GET    /users/123      # 详情
POST   /users          # 创建
PUT    /users/123      # 全量更新
PATCH  /users/123      # 部分更新
DELETE /users/123      # 删除
```

## 封装 API 客户端

### 基础结构

```python
import requests

class BaseAPIClient:
    def __init__(self, base_url: str, timeout: tuple = (5, 15)):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.timeout = timeout

    def request(self, method: str, path: str, **kwargs) -> dict:
        kwargs.setdefault("timeout", self.timeout)
        resp = self.session.request(method, f"{self.base_url}{path}", **kwargs)
        resp.raise_for_status()
        return resp.json()

    def get(self, path, **kwargs): return self.request("GET", path, **kwargs)
    def post(self, path, **kwargs): return self.request("POST", path, **kwargs)
    def put(self, path, **kwargs): return self.request("PUT", path, **kwargs)
    def delete(self, path, **kwargs): return self.request("DELETE", path, **kwargs)

    def close(self):
        self.session.close()

    def __enter__(self): return self
    def __exit__(self, *args): self.close()
```

### 认证管理

```python
class TokenAuthClient(BaseAPIClient):
    def __init__(self, base_url: str, token: str, **kwargs):
        super().__init__(base_url, **kwargs)
        self.session.headers["Authorization"] = f"Bearer {token}"
```

### 分页处理

```python
class PaginatedClient(BaseAPIClient):
    def get_all_pages(self, path: str, data_key: str = "data", **params) -> list:
        results = []
        params.setdefault("page", 1)
        params.setdefault("per_page", 100)
        while True:
            resp = self.get(path, params=params)
            items = resp.get(data_key, [])
            results.extend(items)
            if len(items) < params["per_page"]:
                break
            params["page"] += 1
        return results
```

## Webhook 接收

```python
import hashlib, hmac
from flask import Flask, request, jsonify

app = Flask(__name__)
SECRET = "my-webhook-secret"

def verify_signature(payload: bytes, signature: str) -> bool:
    expected = hmac.new(SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)

@app.route("/webhook", methods=["POST"])
def handle_webhook():
    sig = request.headers.get("X-Hub-Signature-256", "")
    if not verify_signature(request.data, sig):
        return jsonify({"error": "签名无效"}), 401
    event = request.headers.get("X-GitHub-Event", "")
    payload = request.json
    if event == "push":
        print(f"推送到 {payload['ref']}")
    return jsonify({"status": "ok"}), 200
```

签名验证防止伪造请求，`hmac.compare_digest` 防止时序攻击。

## API 限流处理

```python
import time

class RateLimitedClient(BaseAPIClient):
    def request(self, method: str, path: str, **kwargs) -> dict:
        while True:
            resp = self.session.request(method, f"{self.base_url}{path}", **kwargs)
            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", 60))
                print(f"限流，等待 {wait} 秒")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
```

## 完整示例：GitHub API 客户端

```python
import time
import requests
from dataclasses import dataclass

@dataclass
class PullRequest:
    number: int
    title: str
    state: str
    author: str
    url: str

class GitHubClient:
    API_URL = "https://api.github.com"

    def __init__(self, token: str):
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        })

    def _request(self, method: str, path: str, **kwargs) -> dict:
        kwargs.setdefault("timeout", (5, 15))
        while True:
            resp = self.session.request(method, f"{self.API_URL}{path}", **kwargs)
            if resp.status_code == 403 and "rate limit" in resp.text.lower():
                reset = int(resp.headers.get("X-RateLimit-Reset", 0))
                wait = max(reset - time.time(), 0) + 1
                print(f"限流，等待 {wait:.0f} 秒")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            if resp.status_code == 204:
                return {}
            return resp.json()

    def get_pull_requests(self, owner: str, repo: str, state: str = "open") -> list[PullRequest]:
        data = self._get_all_pages(f"/repos/{owner}/{repo}/pulls", params={"state": state})
        return [
            PullRequest(pr["number"], pr["title"], pr["state"], pr["user"]["login"], pr["html_url"])
            for pr in data
        ]

    def create_issue(self, owner: str, repo: str, title: str, body: str = "") -> dict:
        return self._request("POST", f"/repos/{owner}/{repo}/issues", json={"title": title, "body": body})

    def add_labels(self, owner: str, repo: str, issue: int, labels: list[str]) -> dict:
        return self._request("POST", f"/repos/{owner}/{repo}/issues/{issue}/labels", json={"labels": labels})

    def _get_all_pages(self, path: str, **params) -> list:
        results = []
        params.setdefault("per_page", 100)
        params.setdefault("page", 1)
        while True:
            data = self._request("GET", path, params=params)
            if not isinstance(data, list):
                break
            results.extend(data)
            if len(data) < params["per_page"]:
                break
            params["page"] += 1
        return results

    def close(self):
        self.session.close()

    def __enter__(self): return self
    def __exit__(self, *args): self.close()

if __name__ == "__main__":
    import os
    with GitHubClient(os.environ.get("GITHUB_TOKEN", "")) as client:
        prs = client.get_pull_requests("octocat", "Hello-World")
        for pr in prs[:5]:
            print(f"#{pr.number} [{pr.state}] {pr.title}")
```

## 常见误区

### 1. 不处理分页

```python
# ❌ 只拿第一页
data = client.get("/repos/owner/repo/pulls")
# ✅ 循环翻页
all_data = client.get_all_pages("/repos/owner/repo/pulls")
```

### 2. 硬编码 API 地址

```python
# ❌ 切换环境困难
resp = requests.get("https://api.prod.example.com/users")
# ✅ 配置注入
client = APIClient(base_url=config["api_url"])
```

### 3. 忽略 429 限流

```python
# ❌ 直接抛异常
resp.raise_for_status()
# ✅ 检测限流并等待
if resp.status_code == 429:
    time.sleep(int(resp.headers.get("Retry-After", 60)))
```

## 工程建议

1. **封装为类**：认证、分页、限流逻辑集中在客户端
2. **Token 从环境变量读取**：`os.environ.get("API_TOKEN")`
3. **使用上下文管理器**：确保 Session 正确关闭
4. **Webhook 必须验证签名**：防止伪造请求

## 小结

本节学习了 REST API 设计原则、客户端封装（认证、分页、限流）、Webhook 签名验证。通过 GitHub API 客户端示例，将这些能力整合为生产级工具。

## 练习

### 练习一：天气 API 客户端

封装 OpenWeatherMap API 客户端，支持查询当前天气和 5 天预报。

### 练习二：Webhook 事件记录器

编写 Flask 应用，接收 GitHub Webhook 事件并记录到 JSON 文件。

---

## 参考答案

### 练习一

**思路**：封装 OpenWeatherMap 的核心接口，统一参数处理。

**答案**：

```python
import os
import requests

class WeatherClient:
    BASE_URL = "https://api.openweathermap.org/data/2.5"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or os.environ.get("OPENWEATHER_API_KEY", "")
        self.session = requests.Session()

    def _get(self, path: str, params: dict) -> dict:
        params["appid"] = self.api_key
        params.setdefault("units", "metric")
        params.setdefault("lang", "zh_cn")
        resp = self.session.get(f"{self.BASE_URL}{path}", params=params, timeout=10)
        resp.raise_for_status()
        return resp.json()

    def current_weather(self, city: str) -> dict:
        data = self._get("/weather", {"q": city})
        return {
            "city": data["name"],
            "temp": data["main"]["temp"],
            "description": data["weather"][0]["description"],
        }

    def forecast(self, city: str, days: int = 5) -> list[dict]:
        data = self._get("/forecast", {"q": city, "cnt": days * 8})
        return [{"datetime": i["dt_txt"], "temp": i["main"]["temp"], "desc": i["weather"][0]["description"]} for i in data["list"]]

    def close(self): self.session.close()
    def __enter__(self): return self
    def __exit__(self, *args): self.close()
```

**要点**：`units=metric` 返回摄氏度；`lang=zh_cn` 返回中文。

### 练习二

**思路**：Flask 接收 Webhook，签名校验后按事件类型记录。

**答案**：

```python
import json, hmac, hashlib
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify

app = Flask(__name__)
SECRET = "my-secret"
LOG_DIR = Path("webhook_logs")

def verify(payload: bytes, sig: str) -> bool:
    expected = hmac.new(SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", sig)

def log_event(event: str, payload: dict):
    LOG_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    with open(LOG_DIR / f"{event}_{ts}.json", "w", encoding="utf-8") as f:
        json.dump({"event": event, "time": ts, "payload": payload}, f, ensure_ascii=False, indent=2)

@app.route("/webhook", methods=["POST"])
def webhook():
    if not verify(request.data, request.headers.get("X-Hub-Signature-256", "")):
        return jsonify({"error": "签名验证失败"}), 401
    event = request.headers.get("X-GitHub-Event", "")
    log_event(event, request.json)
    return jsonify({"status": "已记录"}), 200
```

**要点**：`ensure_ascii=False` 确保中文正确写入 JSON。
