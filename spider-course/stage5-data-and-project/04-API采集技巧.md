# 第4课：API 采集技巧

> **课程定位：** 第五阶段 · 数据存储与综合项目 · 第 4 课时
> **前置知识：** requests 库基础、JSON 处理、HTTP 基础概念（请求方法、状态码、请求头）
> **预计时长：** 75 分钟

---

## 场景引入

你要从某网站采集商品数据，写了 BeautifulSoup 解析 HTML 的代码，跑了两天都正常。第三天早上一看——爬虫挂了，页面结构改了，所有选择器全部失效。你花了一整天重写解析逻辑。后来同事告诉你："这个网站有公开 API，直接拿 JSON 数据，格式稳定、效率高，根本不需要解析 HTML。"你一脸懵——API 在哪？怎么调？这就是本课要解决的问题。

---

## 学习目标

完成本课学习后，你将能够：

1. 理解 API 采集与 HTML 爬取的本质区别及各自的适用场景
2. 使用浏览器 DevTools 的 Network 面板找到隐藏的 API 接口
3. 正确处理 JSON 格式的 API 响应数据
4. 实现多种分页策略的自动采集（offset/limit、page/size、游标分页）
5. 携带 API Key、Bearer Token 等认证信息访问受保护的 API
6. 处理速率限制和 API 错误，编写健壮的采集代码
7. 对比 API 采集与 HTML 爬取，根据实际场景做出正确选择

---

## 一、API 采集 vs HTML 爬取——点菜 vs 偷看厨房

### 1.1 一个餐厅的比喻

想象你去一家餐厅吃饭：

```
方式一：看菜单点菜（API 采集）
┌──────────────────────────────────────────────────────┐
│  你：我要一份宫保鸡丁，不要辣                          │
│  厨房：好的，这是你的菜（干净、完整、格式标准）        │
│                                                      │
│  特点：直接拿到你要的数据，格式规整，效率高            │
└──────────────────────────────────────────────────────┘

方式二：趴在厨房窗口偷看（HTML 爬取）
┌──────────────────────────────────────────────────────┐
│  你：我看到厨师在切鸡肉...放了花生...加了辣椒...       │
│  厨房：（不知道你在看，随时可能换厨师、改流程）        │
│                                                      │
│  特点：需要从一堆原始材料中自己拼凑信息，随时可能变化  │
└──────────────────────────────────────────────────────┘
```

### 1.2 本质区别

```
API 采集 vs HTML 爬取 对比
┌──────────────┬──────────────────────┬──────────────────────┐
│   对比维度   │   API 采集           │   HTML 爬取          │
├──────────────┼──────────────────────┼──────────────────────┤
│ 数据格式     │ JSON / XML（结构化） │ HTML（需要解析）     │
│ 稳定性       │ 高（接口有版本管理） │ 低（页面随时改版）   │
│ 效率         │ 高（只传必要数据）   │ 低（传整个页面）     │
│ 反爬难度     │ 一般有速率限制       │ 可能有各种反爬机制   │
│ 数据完整性   │ 通常很完整           │ 可能需要滚动加载     │
│ 法律风险     │ 较低（公开接口）     │ 需注意 robots.txt    │
│ 适用场景     │ 有公开 API 的网站    │ 没有 API 的网站      │
└──────────────┴──────────────────────┴──────────────────────┘
```

### 1.3 前端开发者的天然优势

作为前端开发者，你其实已经在天天和 API 打交道了！

```javascript
// 你平时写的前端代码
const res = await fetch("/api/products?page=1&size=20");
const data = await res.json();
console.log(data.items);
```

```python
# 爬虫里做的事情本质上一样
import requests

res = requests.get("https://api.example.com/products", params={
    "page": 1,
    "size": 20
})
data = res.json()
print(data["items"])
```

唯一的区别是：前端用 `fetch`，爬虫用 `requests`；前端由浏览器处理 Cookie，爬虫需要自己管理。

---

## 二、找到隐藏的 API——当侦探的感觉

### 2.1 网站的数据从哪来？

很多看起来是"页面渲染"的网站，数据其实是通过 API 加载的：

```
你看到的页面                     幕后发生了什么
┌───────────────────┐           ┌──────────────────────────────┐
│ ┌───────────────┐ │           │ 1. 浏览器加载 HTML 框架      │
│ │ 商品列表       │ │           │ 2. JavaScript 执行           │
│ │  · iPhone 15  │ │  ← 实际 → │ 3. 调用 /api/products 接口   │
│ │  · MacBook    │ │           │ 4. 拿到 JSON 数据            │
│ │  · AirPods    │ │           │ 5. 渲染成你看到的列表        │
│ └───────────────┘ │           └──────────────────────────────┘
└───────────────────┘
```

### 2.2 用 DevTools 抓 API

这是最关键的技能，一步一步来：

```
操作步骤
┌──────────────────────────────────────────────────────────────┐
│ 1. 打开目标网站                                              │
│ 2. 按 F12 打开开发者工具                                     │
│ 3. 切换到 Network（网络）面板                                │
│ 4. 勾选 XHR 过滤器（只看 AJAX 请求，过滤掉图片/CSS/JS）     │
│ 5. 在页面上进行操作（翻页、搜索、滚动加载）                  │
│ 6. 观察新出现的请求                                          │
│ 7. 点击请求，查看 Headers 和 Response                        │
└──────────────────────────────────────────────────────────────┘
```

```
DevTools Network 面板示意
┌──────────────────────────────────────────────────────────────┐
│ [All] [Fetch/XHR] [JS] [CSS] [Img] [Media] [Doc]            │
│  ↑ 点这个                                                    │
├──────────────────────────────────────────────────────────────┤
│ Name             Status  Type    Size    Time                │
│ products?page=1  200     xhr     12.5KB  156ms   ← 就是它！  │
│ products?page=2  200     xhr     11.8KB  143ms   ← 翻页触发  │
│ search?q=python  200     xhr     8.2KB   201ms   ← 搜索触发  │
├──────────────────────────────────────────────────────────────┤
│ Headers | Payload | Preview | Response                       │
│                                                          │
│ General:                                                   │
│   Request URL: https://api.example.com/v1/products       │
│   Request Method: GET                                    │
│   Status Code: 200 OK                                    │
│                                                          │
│ Request Headers:                                         │
│   Authorization: Bearer eyJhbGciOi...   ← 认证信息       │
│   User-Agent: Mozilla/5.0 ...                            │
│   X-Requested-With: XMLHttpRequest    ← AJAX 标识        │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 识别 API 的特征

怎么判断一个请求是 API 而不是普通页面？

```
API 请求的典型特征
┌──────────────────────────────────────────────────────────────┐
│ ✅ URL 特征：                                                │
│    · 路径包含 /api/、/v1/、/data/                           │
│    · 带有查询参数 page、limit、offset、q 等                 │
│    · 返回 JSON 而非 HTML                                     │
│                                                              │
│ ✅ 请求头特征：                                              │
│    · Accept: application/json                                │
│    · X-Requested-With: XMLHttpRequest                        │
│    · 带有 Authorization 头                                   │
│                                                              │
│ ✅ 响应特征：                                                │
│    · Content-Type: application/json                          │
│    · 内容是 JSON 格式：{"code": 0, "data": [...]}           │
└──────────────────────────────────────────────────────────────┘
```

### 2.4 实战：找到一个公开 API

以 GitHub 为例（无需登录即可访问的公开 API）：

```python
import requests

# GitHub 公开 API：搜索仓库
url = "https://api.github.com/search/repositories"
params = {
    "q": "python web scraping",
    "sort": "stars",
    "order": "desc",
    "per_page": 5
}

response = requests.get(url, params=params)
data = response.json()

# 打印结果
print(f"共找到 {data['total_count']} 个仓库\n")
for repo in data["items"]:
    print(f"⭐ {repo['stargazers_count']:>6}  {repo['full_name']}")
    print(f"        {repo['description'][:60]}")
    print()
```

---

## 三、JSON API 响应处理

### 3.1 解析 JSON 响应

API 返回的 JSON 就像前端拿到的接口数据，处理方式几乎一样：

```python
import requests

response = requests.get("https://api.example.com/products/1")

# 检查状态码
if response.status_code == 200:
    data = response.json()  # 等同于 res.json() in JS

    # 像操作 JavaScript 对象一样操作
    name = data["name"]
    price = data["price"]
    tags = data.get("tags", [])  # 安全取值，带默认值

    print(f"商品: {name}, 价格: {price}")
else:
    print(f"请求失败: {response.status_code}")
```

### 3.2 处理嵌套 JSON

API 返回的 JSON 经常是深层嵌套的，前端同学应该很熟悉：

```python
# 常见的 API 响应结构
api_response = {
    "code": 0,
    "message": "success",
    "data": {
        "total": 100,
        "items": [
            {
                "id": 1,
                "name": "Python教程",
                "author": {
                    "name": "张三",
                    "avatar": "https://example.com/avatar.jpg"
                },
                "tags": ["python", "beginner"]
            }
        ]
    }
}

# 安全地访问深层数据
# ❌ 错误：直接取值，层级一错就崩
# author_name = api_response["data"]["items"][0]["author"]["name"]

# ✅ 正确：使用 get() 链式安全取值
items = api_response.get("data", {}).get("items", [])
if items:
    first = items[0]
    author_name = first.get("author", {}).get("name", "未知作者")
    print(f"作者: {author_name}")

# 提取所有标签
all_tags = []
for item in items:
    all_tags.extend(item.get("tags", []))
print(f"所有标签: {all_tags}")  # ["python", "beginner"]
```

### 3.3 前端同学的 JSON 处理对照表

```
JSON 操作对照表
┌────────────────────────┬──────────────────────────────────────┐
│   JavaScript           │   Python                             │
├────────────────────────┼──────────────────────────────────────┤
│ JSON.parse(str)        │ json.loads(str)                      │
│ JSON.stringify(obj)    │ json.dumps(obj, ensure_ascii=False)  │
│ obj.key                │ obj["key"] 或 obj.get("key")         │
│ arr.filter(...)        │ [x for x in arr if ...]              │
│ arr.map(...)           │ [func(x) for x in arr]               │
│ arr.find(...)          │ next((x for x in arr if ...), None)  │
│ arr.length             │ len(arr)                             │
│ Object.keys(obj)       │ obj.keys()                           │
│ { ...obj, newKey: 1 }  │ {**obj, "newKey": 1}                 │
└────────────────────────┴──────────────────────────────────────┘
```

---

## 四、分页采集——拿到所有数据

### 4.1 三种常见分页方式

```
分页策略一览
┌────────────────────────┬─────────────────────────────────────┐
│   方式                 │   参数示例                          │
├────────────────────────┼─────────────────────────────────────┤
│ 偏移量分页             │ ?offset=0&limit=20                  │
│ (offset / limit)       │ ?offset=20&limit=20                 │
│                        │ ?offset=40&limit=20                 │
├────────────────────────┼─────────────────────────────────────┤
│ 页码分页               │ ?page=1&size=20                     │
│ (page / size)          │ ?page=2&size=20                     │
│                        │ ?page=3&size=20                     │
├────────────────────────┼─────────────────────────────────────┤
│ 游标分页               │ ?cursor=abc123&limit=20             │
│ (cursor / next)        │ ?cursor=def456&limit=20             │
│                        │ ?cursor=ghi789&limit=20             │
│                        │ （每页返回下一页的 cursor）          │
└────────────────────────┴─────────────────────────────────────┘
```

### 4.2 偏移量分页（offset / limit）

最常见的方式，和 SQL 的 LIMIT/OFFSET 一个道理：

```python
import requests
import time

def fetch_all_offset(base_url, page_size=20, max_pages=50):
    """使用 offset/limit 方式翻页采集"""
    all_items = []
    offset = 0

    for page_num in range(1, max_pages + 1):
        print(f"正在获取第 {page_num} 页 (offset={offset})...")

        params = {
            "offset": offset,
            "limit": page_size
        }

        response = requests.get(base_url, params=params)
        data = response.json()

        items = data.get("results", [])
        if not items:
            print("没有更多数据了")
            break

        all_items.extend(items)
        print(f"  获取到 {len(items)} 条，累计 {len(all_items)} 条")

        # 如果返回的数据少于请求数量，说明是最后一页
        if len(items) < page_size:
            break

        offset += page_size
        time.sleep(1)  # 礼貌等待，别太快

    return all_items

# 使用示例
# items = fetch_all_offset("https://api.example.com/products")
# print(f"共采集 {len(items)} 条数据")
```

### 4.3 页码分页（page / size）

```python
def fetch_all_page(base_url, page_size=20, max_pages=50):
    """使用 page/size 方式翻页采集"""
    all_items = []

    for page in range(1, max_pages + 1):
        print(f"正在获取第 {page} 页...")

        params = {
            "page": page,
            "size": page_size
        }

        response = requests.get(base_url, params=params)

        if response.status_code != 200:
            print(f"请求失败: {response.status_code}")
            break

        data = response.json()

        # 不同 API 的数据结构可能不同，需要根据实际情况调整
        items = data.get("data", {}).get("items", [])
        total = data.get("data", {}).get("total", 0)

        if not items:
            break

        all_items.extend(items)
        print(f"  获取到 {len(items)} 条，累计 {len(all_items)}/{total}")

        # 判断是否已获取全部数据
        if len(all_items) >= total:
            break

        time.sleep(1)

    return all_items
```

### 4.4 游标分页（cursor-based）

这种方式最"优雅"，很多大厂 API 都用这种方式：

```python
def fetch_all_cursor(base_url, page_size=20, max_pages=50):
    """使用游标方式翻页采集"""
    all_items = []
    cursor = None  # 第一页没有 cursor

    for page_num in range(1, max_pages + 1):
        print(f"正在获取第 {page_num} 页...")

        params = {"limit": page_size}
        if cursor:
            params["cursor"] = cursor

        response = requests.get(base_url, params=params)
        data = response.json()

        items = data.get("items", [])
        if not items:
            break

        all_items.extend(items)

        # 获取下一页的游标
        cursor = data.get("next_cursor")
        has_more = data.get("has_more", False)

        print(f"  获取到 {len(items)} 条，has_more={has_more}")

        if not has_more or not cursor:
            print("已到达最后一页")
            break

        time.sleep(1)

    return all_items
```

### 4.5 分页策略的选择

```
如何判断 API 用的是哪种分页？
┌──────────────────────────────────────────────────────────────┐
│ 方法：看 API 返回的参数名                                    │
│                                                              │
│ 响应里有 offset/limit     → 用偏移量分页                     │
│ 响应里有 page/size/total  → 用页码分页                       │
│ 响应里有 cursor/next_cursor/has_more → 用游标分页            │
│                                                              │
│ 不确定的时候：在 DevTools 里多翻几页，看 URL 参数怎么变化    │
└──────────────────────────────────────────────────────────────┘
```

---

## 五、认证——证明"我是谁"

### 5.1 常见认证方式

```
API 认证方式
┌──────────────────┬─────────────────────────────────────────┐
│   方式           │   说明                                  │
├──────────────────┼─────────────────────────────────────────┤
│ API Key          │ 最简单，就是一个字符串密钥              │
│                  │ 通常放在 URL 参数或请求头里              │
├──────────────────┼─────────────────────────────────────────┤
│ Bearer Token     │ 一串 JWT 令牌，放在 Authorization 头里  │
│                  │ 需要先登录获取 token                    │
├──────────────────┼─────────────────────────────────────────┤
│ OAuth 2.0        │ 第三方登录授权，流程最复杂              │
│                  │ 一般爬虫场景不常用                      │
├──────────────────┼─────────────────────────────────────────┤
│ Cookie / Session │ 浏览器登录后自动携带                    │
│                  │ 爬虫需要模拟登录获取 Cookie             │
└──────────────────┴─────────────────────────────────────────┘
```

### 5.2 API Key 认证

最简单的认证方式，很多公开 API 都用这个：

```python
import requests

# 方式一：放在 URL 参数里
API_KEY = "your_api_key_here"
response = requests.get(
    "https://api.example.com/data",
    params={"api_key": API_KEY, "q": "python"}
)

# 方式二：放在请求头里（更安全，不会出现在 URL 日志中）
response = requests.get(
    "https://api.example.com/data",
    headers={"X-API-Key": API_KEY}
)

# 方式三：很多 API 用 Authorization 头
response = requests.get(
    "https://api.example.com/data",
    headers={"Authorization": f"ApiKey {API_KEY}"}
)
```

### 5.3 Bearer Token 认证

需要先登录获取 token，然后每次请求都带上：

```python
import requests

# 第一步：登录获取 token
login_url = "https://api.example.com/auth/login"
login_data = {
    "username": "your_username",
    "password": "your_password"
}

login_response = requests.post(login_url, json=login_data)
token = login_response.json()["access_token"]
print(f"获取到 token: {token[:20]}...")

# 第二步：使用 token 访问受保护的 API
headers = {
    "Authorization": f"Bearer {token}"
}

# 后续所有请求都带上这个 headers
response = requests.get(
    "https://api.example.com/user/profile",
    headers=headers
)
print(response.json())
```

### 5.4 管理多个认证信息

实际项目中，推荐把认证信息放在配置文件或环境变量中：

```python
import os
import requests

# 从环境变量读取（推荐，不会泄露到代码仓库）
API_KEY = os.environ.get("MY_API_KEY", "")
BEARER_TOKEN = os.environ.get("MY_BEARER_TOKEN", "")

# 或者从配置文件读取
import json

def load_config(config_path="config.json"):
    """加载配置文件"""
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)

# config.json 内容示例：
# {
#     "api_key": "sk-xxxxxxxxxxxx",
#     "base_url": "https://api.example.com",
#     "timeout": 30
# }

# ❌ 错误：把密钥直接写在代码里
# API_KEY = "sk-abc123secretkey"   # 泄露风险！

# ✅ 正确：使用环境变量或配置文件
API_KEY = os.environ.get("API_KEY")
```

---

## 六、速率限制与配额——别太快

### 6.1 什么是速率限制？

API 服务端通常会限制你的请求频率，防止被滥用：

```
速率限制的典型表现
┌──────────────────────────────────────────────────────────────┐
│ HTTP 状态码：429 Too Many Requests                           │
│                                                              │
│ 响应头里通常包含：                                           │
│   X-RateLimit-Limit: 100        ← 每分钟最多 100 次          │
│   X-RateLimit-Remaining: 0      ← 本分钟额度已用完           │
│   X-RateLimit-Reset: 1709616060 ← 额度重置的时间戳           │
│   Retry-After: 30               ← 建议等 30 秒再试           │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 优雅地处理速率限制

```python
import requests
import time

def request_with_retry(url, params=None, max_retries=3):
    """带重试机制的请求，自动处理速率限制"""
    for attempt in range(max_retries):
        response = requests.get(url, params=params)

        if response.status_code == 200:
            return response.json()

        if response.status_code == 429:
            # 被限速了，等待后重试
            retry_after = int(response.headers.get("Retry-After", 60))
            print(f"⚠ 被限速了！等待 {retry_after} 秒后重试...")

            # 也可以从 X-RateLimit-Reset 计算等待时间
            reset_time = response.headers.get("X-RateLimit-Reset")
            if reset_time:
                wait_time = max(int(reset_time) - int(time.time()), 1)
                retry_after = min(wait_time, retry_after)

            time.sleep(retry_after)
            continue

        if response.status_code >= 500:
            # 服务器错误，等一下再试
            print(f"服务器错误 {response.status_code}，等待后重试...")
            time.sleep(5 * (attempt + 1))  # 递增等待
            continue

        # 其他错误（400, 401, 403 等），不重试
        print(f"请求失败: {response.status_code} - {response.text}")
        return None

    print("重试次数已用完")
    return None
```

### 6.3 主动限速——做一个有礼貌的爬虫

```python
import time

class RateLimiter:
    """简单的速率限制器"""

    def __init__(self, requests_per_second=2):
        self.min_interval = 1.0 / requests_per_second
        self.last_request_time = 0

    def wait(self):
        """确保两次请求之间有足够的间隔"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_interval:
            sleep_time = self.min_interval - elapsed
            time.sleep(sleep_time)
        self.last_request_time = time.time()

# 使用
limiter = RateLimiter(requests_per_second=1)  # 每秒最多 1 个请求

for page in range(1, 100):
    limiter.wait()  # 自动等待
    response = requests.get(f"https://api.example.com/data?page={page}")
    # ... 处理数据
```

---

## 七、API 错误处理——不能因为一次失败就放弃

### 7.1 常见 API 错误

```
API 常见错误码及处理策略
┌──────┬──────────────────────┬─────────────────────────────────┐
│ 状态 │   含义               │   处理策略                      │
├──────┼──────────────────────┼─────────────────────────────────┤
│ 200  │ 成功                 │ 正常处理                        │
│ 204  │ 成功但无内容         │ 返回空结果                      │
│ 400  │ 请求参数错误         │ 检查参数，不重试                │
│ 401  │ 未认证               │ 检查 token，重新登录            │
│ 403  │ 无权限               │ 检查权限，不重试                │
│ 404  │ 资源不存在           │ 跳过该资源                      │
│ 429  │ 请求太频繁           │ 等待后重试                      │
│ 500  │ 服务器内部错误       │ 等待后重试                      │
│ 502  │ 网关错误             │ 等待后重试                      │
│ 503  │ 服务不可用           │ 等待较长时间后重试              │
└──────┴──────────────────────┴─────────────────────────────────┘
```

### 7.2 完整的错误处理模板

```python
import requests
import time
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

class APIClient:
    """一个健壮的 API 客户端"""

    def __init__(self, base_url, headers=None, timeout=30):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        if headers:
            self.session.headers.update(headers)
        self.timeout = timeout

    def get(self, endpoint, params=None, max_retries=3):
        """发送 GET 请求，自动处理各种错误"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        for attempt in range(max_retries):
            try:
                response = self.session.get(
                    url, params=params, timeout=self.timeout
                )

                # 成功
                if response.status_code == 200:
                    return response.json()

                # 速率限制
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    logger.warning(f"被限速，等待 {retry_after} 秒")
                    time.sleep(retry_after)
                    continue

                # 客户端错误（不重试）
                if 400 <= response.status_code < 500:
                    logger.error(
                        f"客户端错误 {response.status_code}: "
                        f"{response.text[:200]}"
                    )
                    return None

                # 服务端错误（重试）
                if response.status_code >= 500:
                    logger.warning(
                        f"服务端错误 {response.status_code}，"
                        f"第 {attempt + 1} 次重试"
                    )
                    time.sleep(5 * (attempt + 1))
                    continue

            except requests.exceptions.Timeout:
                logger.warning(f"请求超时，第 {attempt + 1} 次重试")
                time.sleep(3)

            except requests.exceptions.ConnectionError:
                logger.warning(f"连接失败，第 {attempt + 1} 次重试")
                time.sleep(5)

            except requests.exceptions.RequestException as e:
                logger.error(f"请求异常: {e}")
                return None

        logger.error(f"请求失败，已重试 {max_retries} 次: {url}")
        return None

# 使用示例
client = APIClient(
    base_url="https://api.github.com",
    headers={"Accept": "application/vnd.github.v3+json"}
)

data = client.get("/search/repositories", params={
    "q": "python",
    "per_page": 5
})

if data:
    for repo in data["items"]:
        print(f"  {repo['full_name']}")
else:
    print("获取数据失败")
```

---

## 八、实战：采集 GitHub 公开 API

让我们用一个完整的例子，把前面学的都串起来：

```python
import requests
import time
import json
from datetime import datetime

class GitHubScraper:
    """GitHub 公开 API 采集器"""

    BASE_URL = "https://api.github.com"

    def __init__(self, token=None):
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Python-API-Scraper-Tutorial"
        })
        # 如果有 token，可以提高速率限制（5000次/小时 vs 60次/小时）
        if token:
            self.session.headers["Authorization"] = f"Bearer {token}"

        self.request_count = 0

    def _get(self, endpoint, params=None):
        """带速率控制的 GET 请求"""
        url = f"{self.BASE_URL}{endpoint}"
        self.request_count += 1

        # 每 10 个请求检查一次速率限制
        if self.request_count % 10 == 0:
            self._check_rate_limit()

        response = self.session.get(url, params=params, timeout=30)

        if response.status_code == 200:
            return response.json()
        elif response.status_code == 403:
            # 可能是速率限制
            reset_time = int(response.headers.get("X-RateLimit-Reset", 0))
            wait = max(reset_time - int(time.time()), 60)
            print(f"  速率限制，等待 {wait} 秒...")
            time.sleep(wait)
            return self._get(endpoint, params)  # 重试
        else:
            print(f"  请求失败: {response.status_code}")
            return None

    def _check_rate_limit(self):
        """检查剩余请求次数"""
        data = self._get("/rate_limit")
        if data:
            core = data["resources"]["core"]
            remaining = core["remaining"]
            limit = core["limit"]
            print(f"  API 配额: {remaining}/{limit} 次")

            if remaining < 10:
                reset_time = core["reset"]
                wait = max(reset_time - int(time.time()), 10)
                print(f"  配额不足，等待 {wait} 秒...")
                time.sleep(wait)

    def search_repositories(self, query, sort="stars", per_page=30, pages=3):
        """搜索仓库，支持翻页"""
        all_repos = []

        for page in range(1, pages + 1):
            print(f"\n搜索仓库: 第 {page} 页")
            data = self._get("/search/repositories", params={
                "q": query,
                "sort": sort,
                "order": "desc",
                "per_page": per_page,
                "page": page
            })

            if not data or "items" not in data:
                break

            total = data["total_count"]
            items = data["items"]
            print(f"  找到 {total} 个仓库，本页 {len(items)} 个")

            for repo in items:
                all_repos.append({
                    "name": repo["full_name"],
                    "stars": repo["stargazers_count"],
                    "forks": repo["forks_count"],
                    "language": repo["language"],
                    "description": (repo["description"] or "")[:100],
                    "url": repo["html_url"],
                    "created": repo["created_at"][:10],
                    "updated": repo["updated_at"][:10]
                })

            time.sleep(2)  # 礼貌等待

        return all_repos

    def get_user_repos(self, username, per_page=100, max_pages=5):
        """获取某个用户的所有仓库（游标分页风格）"""
        all_repos = []
        page = 1

        while page <= max_pages:
            print(f"\n获取 {username} 的仓库: 第 {page} 页")
            items = self._get(f"/users/{username}/repos", params={
                "type": "public",
                "sort": "updated",
                "per_page": per_page,
                "page": page
            })

            if not items:
                break

            all_repos.extend(items)
            print(f"  获取到 {len(items)} 个仓库")

            # GitHub 用 Link 头来告诉你要不要翻页
            # 如果返回数量少于请求数，说明是最后一页
            if len(items) < per_page:
                break

            page += 1
            time.sleep(1)

        return all_repos

    def save_to_json(self, data, filename):
        """保存数据为 JSON 文件"""
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\n数据已保存到 {filename}，共 {len(data)} 条")


# ========== 使用示例 ==========
if __name__ == "__main__":
    scraper = GitHubScraper()  # 无 token，每小时 60 次

    # 搜索 Python 相关的热门仓库
    repos = scraper.search_repositories(
        query="python web framework",
        sort="stars",
        per_page=10,
        pages=2
    )

    # 打印结果
    print("\n" + "=" * 60)
    print("搜索结果 Top 10:")
    print("=" * 60)
    for i, repo in enumerate(repos[:10], 1):
        print(f"\n{i}. {repo['name']}")
        print(f"   ⭐ {repo['stars']}  🍴 {repo['forks']}  📝 {repo['language']}")
        print(f"   {repo['description']}")

    # 保存结果
    scraper.save_to_json(repos, "github_repos.json")
```

---

## 九、API 采集 vs HTML 爬取——什么时候用哪个？

### 9.1 决策树

```
选择采集方式的决策树
                    ┌─────────────────────┐
                    │ 目标网站有公开 API？ │
                    └──────┬──────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
                   是            否
                    │             │
                    ▼             │
            ┌───────────────┐     │
            │ API 满足需求？ │     │
            └──────┬────────┘     │
                   │              │
            ┌──────┴──────┐      │
            ▼             ▼      ▼
           是            否      │
            │             │      │
            ▼             ▼      ▼
      ┌──────────┐  ┌──────────────────┐
      │ 用 API ✅ │  │ HTML 爬取 + API │
      │ 最佳选择  │  │ 结合使用         │
      └──────────┘  └──────────────────┘
```

### 9.2 详细对比

```
场景对照表
┌────────────────────────┬───────────────────────┬───────────────────────┐
│   场景                 │   推荐方案            │   原因                │
├────────────────────────┼───────────────────────┼───────────────────────┤
│ GitHub、Twitter 等     │ API 采集              │ 有完善的公开 API      │
│ 电商网站商品列表       │ HTML 爬取             │ 一般没有公开 API      │
│ 天气数据               │ API 采集              │ 公开天气 API 很多     │
│ 新闻网站文章           │ HTML 爬取             │ 内容型网站一般无 API  │
│ 地图 POI 数据          │ API 采集              │ 地图 API 成熟稳定     │
│ 社交媒体动态           │ API + HTML 结合       │ API 有限制，HTML 补充 │
│ 政府公开数据           │ API 采集              │ 很多政府数据开放平台  │
│ 论坛帖子               │ HTML 爬取             │ 通常没有 API          │
└────────────────────────┴───────────────────────┴───────────────────────┘
```

### 9.3 混合策略

实际项目中，API 和 HTML 爬取经常配合使用：

```python
# 混合策略示例：先用 API 获取列表，再用 HTML 解析详情
import requests
from bs4 import BeautifulSoup

class HybridScraper:
    """混合采集器：API + HTML"""

    def get_product_list_from_api(self):
        """第一步：用 API 高效获取商品列表"""
        response = requests.get("https://api.example.com/products", params={
            "page": 1, "size": 100
        })
        products = response.json()["items"]
        # 返回: [{"id": 1, "url": "/product/1"}, ...]
        return products

    def get_product_detail_from_html(self, url):
        """第二步：用 HTML 解析获取商品详情（API 不提供的字段）"""
        response = requests.get(f"https://example.com{url}")
        soup = BeautifulSoup(response.text, "html.parser")

        # 解析 HTML 中 API 没有的数据
        detail = {
            "description": soup.select_one(".desc").text.strip(),
            "images": [img["src"] for img in soup.select(".gallery img")],
            "reviews_count": soup.select_one(".review-count").text
        }
        return detail

    def scrape(self):
        """完整流程：API 列表 + HTML 详情"""
        products = self.get_product_list_from_api()
        print(f"API 获取到 {len(products)} 个商品")

        for product in products:
            detail = self.get_product_detail_from_html(product["url"])
            product.update(detail)
            print(f"  已解析: {product.get('name', product['id'])}")

        return products
```

---

## 动手练习

### 练习一：DevTools 抓 API 实战

打开你常用的网站（比如掘金、知乎、B站等），完成以下任务：

1. 打开 DevTools 的 Network 面板，勾选 XHR 过滤
2. 在页面上翻一页或搜索一个关键词
3. 找到返回数据的 API 请求
4. 记录下来：
   - 请求 URL
   - 请求方法（GET/POST）
   - 请求头中重要的字段
   - 查询参数
   - 响应数据的 JSON 结构

```python
# 用 requests 复现你找到的 API
import requests

url = "你找到的 API URL"
headers = {
    "User-Agent": "Mozilla/5.0 ...",  # 从 DevTools 复制
    # 其他必要的请求头
}
params = {
    # 从 DevTools 复制的参数
}

response = requests.get(url, headers=headers, params=params)
data = response.json()
print(f"状态码: {response.status_code}")
print(f"数据结构: {list(data.keys())}")
```

### 练习二：GitHub API 分页采集

使用 GitHub 公开 API，采集某个编程语言（比如 Python）的前 50 个最热门仓库：

```python
# 要求：
# 1. 使用翻页获取完整数据（GitHub 搜索 API 每页最多 100 条）
# 2. 提取：仓库名、Star 数、Fork 数、描述、创建时间
# 3. 按 Star 数降序排列
# 4. 保存为 CSV 文件

# 你的代码
def scrape_top_repos(language, count=50):
    pass
```

### 练习三：带认证的 API 采集

注册一个免费的 API 服务（推荐 OpenWeatherMap，免费额度足够练习），完成以下任务：

```python
# 1. 注册并获取 API Key
# 2. 调用天气 API 获取多个城市的天气数据
# 3. 处理可能的错误（城市名错误、API Key 无效等）
# 4. 将结果整理成表格保存

# 提示代码框架
import requests

API_KEY = "你的 API Key"

def get_weather(city):
    """获取指定城市的天气"""
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "q": city,
        "appid": API_KEY,
        "units": "metric",
        "lang": "zh_cn"
    }
    # 你的代码...
    pass

# 测试
cities = ["北京", "上海", "广州", "深圳", "杭州"]
# 你的代码...
```

---

## 常见误区

- **API 采集不需要考虑反爬**：虽然 API 返回的是结构化数据，但服务端仍然会做速率限制（429 错误）、Token 验证、IP 封禁等。不做限速和错误处理，爬虫很快就会被封。
- **直接在代码里写 API Key**：把密钥硬编码在源码里，一旦推送到 GitHub 就泄露了。应该用环境变量或独立的配置文件（加入 `.gitignore`）管理敏感信息。
- **拿到 API 响应就直接用**：API 返回的 JSON 结构可能嵌套很深，直接用 `data["items"][0]["author"]["name"]` 取值，某一层结构变了就会崩。应该用 `.get()` 链式安全取值，带默认值兜底。
- **翻页只翻到第一页就停了**：很多 API 的 `total` 字段告诉你总共有多少条数据，但实际返回的可能因为权限、过滤等原因少于预期。应该同时检查返回数量和 `has_more` 标志来判断是否继续翻页。

---

## 工程建议

- **优先找 API，找不到再用 HTML 爬取**：在 DevTools 的 Network 面板里用 XHR 过滤器找找看，很多看似是页面渲染的网站，数据其实是通过 API 加载的。API 采集的稳定性和效率远高于 HTML 解析。
- **封装一个带重试机制的 API 客户端**：处理 429（等待 Retry-After）、5xx（递增等待重试）、超时（重新连接）等场景。一个好的客户端类能让你在后续项目中直接复用。
- **分页采集时加 `time.sleep` 做限速**：即使 API 没有明确的速率限制，也应该控制在每秒 1-2 个请求。太快了轻则被限速，重则被封 IP。用 `random.uniform()` 加点随机抖动更像真实用户。
- **API 和 HTML 爬取可以混合使用**：常见模式是用 API 获取列表数据（高效、结构化），用 HTML 解析详情页（补充 API 不提供的字段）。两者不是对立的，灵活组合效果最好。

---

## 小结

本课核心知识点回顾：

1. **API 采集比 HTML 爬取更优雅** —— 就像点菜比偷看厨房更高效，数据格式规整、稳定性高
2. **DevTools 是你的侦探工具** —— Network 面板 + XHR 过滤，能帮你找到任何隐藏的 API
3. **JSON 处理你已经会了** —— 前端天天在做的事，爬虫里换个库名就行
4. **三种分页策略** —— offset/limit、page/size、cursor，看 API 返回的数据结构来选择
5. **认证必不可少** —— API Key 最简单，Bearer Token 需要先登录，永远不要把密钥写在代码里
6. **做一个有礼貌的爬虫** —— 控制请求频率，处理 429 错误，带重试机制
7. **API 和 HTML 爬取不是对立的** —— 实际项目中经常混合使用，各取所长

记住这个 API 采集的核心流程：

```
找到 API → 分析参数 → 处理认证 → 发送请求 → 解析 JSON → 处理分页 → 保存数据
      ↑                                              │
      └──────── 遇到 429/错误？等待后重试 ────────────┘
```

---

## 下一课预告

到这里，你已经掌握了 HTML 采集、API 采集和数据清洗的关键技能。下一课我们将学习 **robots.txt 与法律道德**，把合规边界、服务条款、请求频率和隐私保护讲清楚。完成这一步之后，再进入综合项目实战会更稳。
