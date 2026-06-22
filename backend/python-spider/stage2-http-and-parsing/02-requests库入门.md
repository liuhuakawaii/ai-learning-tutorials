# 第2课：requests 库入门

> **课程定位：** 第二阶段 · HTTP 与网页解析 · 第 2 课时
> **前置知识：** HTTP 协议基础、Python 基础语法、pip 包管理
> **预计时长：** 50 分钟

---

## 场景引入

你已经学会了用 DevTools 分析 HTTP 请求，知道了请求头、状态码、Content-Type 这些概念。现在你想用 Python 代码自动发送请求，把网页数据抓下来。但问题是：Python 标准库的 urllib 用起来又臭又长，光发一个 GET 请求就要写五六行代码，还得手动处理编码、超时、异常。

你需要一个更好用的工具。requests 库就是答案——它把复杂的 HTTP 操作封装成了简洁直观的 API，一行代码就能发请求，两行代码就能拿到数据。接下来我们就用它发出第一个爬虫请求。

---

完成本课学习后，你将能够：

1. 安装并导入 requests 库
2. 用 requests.get() 发送 GET 请求并获取响应
3. 访问响应对象的常用属性（status_code、headers、text、content、json()）
4. 使用 params 参数传递查询字符串
5. 使用 requests.post() 发送 POST 请求（data 和 json 参数）
6. 自定义请求头（User-Agent、Referer 等）
7. 使用 cookies 参数和 Session 对象管理会话
8. 设置 timeout 防止请求卡死
9. 用 try/except 处理常见网络异常
10. 对比 requests 和 JavaScript 的 fetch()

---

## 一、安装 requests——你的第一个爬虫工具

### 1.1 安装

```bash
# 在终端/命令行中执行
pip install requests

# 如果你有多个 Python 版本，可能需要用：
pip3 install requests

# 验证安装是否成功
python -c "import requests; print(requests.__version__)"
# 输出类似：2.31.0
```

### 1.2 为什么选 requests？

```
Python 发 HTTP 请求的几种方式：

┌─────────────────┬────────────┬────────────┬──────────────┐
│  方式            │  易用性     │  功能       │  推荐度       │
├─────────────────┼────────────┼────────────┼──────────────┤
│  urllib          │  ★★☆☆☆    │  基础       │  了解即可     │
│  urllib3         │  ★★★☆☆    │  较全       │  底层库       │
│  requests ★     │  ★★★★★    │  完善       │  首选！       │
│  httpx          │  ★★★★★    │  异步支持    │  进阶选择     │
└─────────────────┴────────────┴────────────┴──────────────┘

requests 的口号："HTTP for Humans"（为人类设计的 HTTP 库）
它把复杂的底层操作封装成了简单直观的 API。
```

**生活类比：** 如果 urllib 是手动挡汽车（需要自己操作离合、换挡），那 requests 就是自动挡——你只需要踩油门（发请求）和看仪表盘（读响应）。

---

## 二、发送第一个 GET 请求

### 2.1 最简单的请求

```python
import requests

# 发送一个 GET 请求，就像在浏览器输入 URL 并回车
response = requests.get("https://httpbin.org/get")

# response 就是服务器的响应对象
# 就像你拆开快递包裹——里面可能有各种东西
print(response)  # <Response [200]>  ← 状态码 200，成功！
```

### 2.2 响应对象的常用属性

```python
import requests

response = requests.get("https://httpbin.org/get")

# ── 状态码 ──
# 就像快递单上的"签收状态"
print(response.status_code)   # 200  ← 数字形式
print(response.ok)            # True ← 2xx 时为 True，其他为 False

# ── 响应头 ──
# 就像快递包裹上的各种标签和说明
print(response.headers)
print(response.headers["Content-Type"])  # application/json

# ── 响应体（文本） ──
# 就是包裹里的"货物"，以字符串形式返回
print(response.text)          # '{"args":{},"headers":{...},...}'
print(response.encoding)      # utf-8（编码方式）

# ── 响应体（二进制） ──
# 适用于图片、文件等非文本内容
print(response.content)       # b'{"args":{},"headers":{...},...}'
# response.content 是 bytes 类型
# response.text    是 str 类型

# ── 响应体（JSON 解析） ──
# 如果服务器返回的是 JSON，直接解析成 Python 字典
data = response.json()
print(type(data))             # <class 'dict'>
print(data["headers"]["Host"])  # httpbin.org
```

### 2.3 text vs content vs json() 怎么选？

```
┌──────────────────┬──────────────┬──────────────────────────────┐
│  属性/方法        │  返回类型     │  适用场景                     │
├──────────────────┼──────────────┼──────────────────────────────┤
│  response.text    │  str         │  HTML 页面、纯文本            │
│  response.content │  bytes       │  图片、PDF、音视频等二进制文件 │
│  response.json()  │  dict / list │  API 返回的 JSON 数据         │
└──────────────────┴──────────────┴──────────────────────────────┘

# ✅ 正确选择：
# 抓网页 → 用 .text（返回 HTML 字符串）
# 抓 API → 用 .json()（直接得到 Python 字典）
# 下载图片 → 用 .content（得到二进制数据，再写入文件）

# ❌ 常见错误：
# response.json() 用于非 JSON 响应 → 会抛出 JSONDecodeError
# response.text 用于图片 → 得到乱码字符串
```

---

## 三、查询参数（Query Parameters）

### 3.1 用 params 传递参数

```python
import requests

# ❌ 错误做法：手动拼接 URL
# 容易出错，特殊字符需要手动编码
url = "https://www.example.com/search?q=python&page=1&lang=zh"
response = requests.get(url)

# ✅ 正确做法：使用 params 参数
# requests 会自动帮你拼接 URL 并处理编码
params = {
    "q": "python",
    "page": 1,
    "lang": "zh",
}
response = requests.get("https://www.example.com/search", params=params)

# 查看实际请求的 URL
print(response.url)
# https://www.example.com/search?q=python&page=1&lang=zh

# params 里的值也可以是列表（自动变成多个同名参数）
params = {
    "q": "python",
    "tags": ["爬虫", "入门"],  # → tags=%E7%88%AC%E8%99%AB&tags=%E5%85%A5%E9%97%A8
}
response = requests.get("https://www.example.com/search", params=params)
print(response.url)
# https://www.example.com/search?q=python&tags=%E7%88%AC%E8%99%AB&tags=%E5%85%A5%E9%97%A8
```

**生活类比：** params 就像点外卖时的"备注栏"——你不用自己把备注写到地址里，而是单独填一个表单，系统自动帮你附加到订单上。

---

## 四、POST 请求——提交数据

### 4.1 表单提交（data 参数）

```python
import requests

# 模拟表单提交（Content-Type: application/x-www-form-urlencoded）
# 就像你在网页上填了一个登录表单并点击"提交"
data = {
    "username": "alice",
    "password": "123456",
}
response = requests.post("https://httpbin.org/post", data=data)

print(response.json()["form"])  # {'username': 'alice', 'password': '123456'}
# "form" 字段说明服务器把它当作表单数据解析了
```

### 4.2 JSON 提交（json 参数）

```python
import requests

# 发送 JSON 数据（Content-Type: application/json）
# 就像前后端分离项目中，前端调 API 发送 JSON
json_data = {
    "username": "alice",
    "password": "123456",
}
response = requests.post("https://httpbin.org/post", json=json_data)

print(response.json()["json"])  # {'username': 'alice', 'password': '123456'}
# "json" 字段说明服务器把它当作 JSON 解析了
```

### 4.3 data 和 json 的区别

```python
# data=  → Content-Type: application/x-www-form-urlencoded（表单格式）
#          数据编码为：username=alice&password=123456

# json=  → Content-Type: application/json（JSON 格式）
#          数据编码为：{"username":"alice","password":"123456"}

# ❌ 常见错误：用 data 发 JSON
response = requests.post(url, data=json.dumps({"key": "value"}))
# Content-Type 仍然是 form-urlencoded，服务器可能解析失败

# ✅ 正确做法：用 json 参数
response = requests.post(url, json={"key": "value"})
# Content-Type 自动设为 application/json，一切正常
```

---

## 五、自定义请求头

### 5.1 为什么需要自定义请求头？

```python
# 很多网站会检查请求头来判断"你是不是真人浏览器"
# 如果没有 User-Agent，服务器可能直接返回 403

# ❌ 不加 User-Agent 的请求
response = requests.get("https://www.example.com")
print(response.request.headers["User-Agent"])
# python-requests/2.31.0  ← 暴露了你是 Python 脚本！
# 有些网站看到这个直接拒绝

# ✅ 设置有意义的 User-Agent，说明客户端身份
headers = {
    "User-Agent": "LearningScraper/1.0 (contact@example.com)",
}
response = requests.get("https://www.example.com", headers=headers)
print(response.request.headers["User-Agent"])
# LearningScraper/1.0 (contact@example.com)  ← 标明用途和联系方式
```

### 5.2 常用请求头设置

```python
import requests

headers = {
    # 浏览器身份标识——必须加！
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    # 来源页面
    "Referer": "https://www.example.com/list",
    # 我能接受的响应格式和语言
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}
response = requests.get("https://www.example.com", headers=headers)
# 提示：headers 的 key 大小写不敏感，"User-Agent" 和 "user-agent" 效果一样
```

**生活类比：** 自定义请求头就像带好身份证、介绍信——去政府办事（请求数据），对方先检查证件（请求头），不带证件可能被拒之门外。

---

## 六、Cookies——保持登录状态

### 6.1 什么是 Cookie？

```
Cookie 的工作流程：

客户端（你）                     服务器
    │  ① 登录请求 username=alice  │
    │ ──────────────────────────→ │
    │  ② 响应头：Set-Cookie: session_id=abc123
    │ ←────────────────────────── │
    │  ③ 后续请求自动带上 Cookie    │
    │  Cookie: session_id=abc123  │
    │ ──────────────────────────→ │
    │  ④ 服务器识别出你已登录       │
    │ ←────────────────────────── │
```

**生活类比：** Cookie 就像酒店的房卡——办理入住（登录）拿到房卡（Cookie），之后进出房间（访问页面）刷房卡即可，不用每次重新登记。

### 6.2 在 requests 中使用 Cookie

```python
import requests

# 方法1：直接在请求中传 cookies 参数
cookies = {
    "session_id": "abc123",
    "user_token": "xyz789",
}
response = requests.get("https://www.example.com/dashboard", cookies=cookies)

# 方法2：把 Cookie 放在请求头里（效果一样）
headers = {
    "Cookie": "session_id=abc123; user_token=xyz789",
}
response = requests.get("https://www.example.com/dashboard", headers=headers)

# 方法3：从浏览器 DevTools 复制 Cookie
# 在 DevTools → Application → Cookies 中找到你需要的 Cookie
# 或者从 Network 面板的请求头中复制 Cookie 值
```

---

## 七、Session——持久连接的管家

### 7.1 为什么需要 Session？

```python
# ❌ 没有 Session：每个请求都是独立的
# 请求1登录了，但 Cookie 不会自动带到请求2
r1 = requests.get("https://www.example.com/login", ...)  # 登录
r2 = requests.get("https://www.example.com/dashboard")   # 未登录状态！

# ✅ 有 Session：自动管理 Cookie 和连接
session = requests.Session()
r1 = session.get("https://www.example.com/login", ...)   # 登录
r2 = session.get("https://www.example.com/dashboard")    # 自动带上 Cookie！
```

### 7.2 Session 的三大好处

```python
import requests

session = requests.Session()

# 好处1：自动管理 Cookie
session.get("https://httpbin.org/cookies/set/name/alice")
r = session.get("https://httpbin.org/cookies")
print(r.json())  # {'cookies': {'name': 'alice'}}  ← Cookie 自动保存了！

# 好处2：复用 TCP 连接（keep-alive），减少握手开销，速度更快

# 好处3：统一设置默认请求头，不用每次请求都传
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9",
})
# 之后所有请求自动带上这些 headers

# ✅ 推荐用 with 语句，自动关闭
with requests.Session() as session:
    r = session.get("https://httpbin.org/get")
    print(r.status_code)
```

**生活类比：** Session 就像超市会员卡——没有它每次都要办临时通行证（手动传 Cookie），有了它一张卡通行所有通道。

---

## 八、超时处理——防止请求卡死

### 8.1 为什么必须设置超时？

```python
# ❌ 不设超时——可能无限等待
# 如果服务器不响应，你的程序会一直卡在这里
response = requests.get("https://www.slow-server.com")  # 可能卡一辈子...

# ✅ 设置超时——最多等几秒
# timeout 参数单位是秒
response = requests.get("https://www.example.com", timeout=5)  # 最多等5秒
```

### 8.2 timeout 的两种设置方式

```python
import requests

# 方式1：统一超时（连接+读取都是同一个值）
response = requests.get("https://www.example.com", timeout=5)

# 方式2：分别设置连接超时和读取超时（推荐）
# (连接超时, 读取超时)
response = requests.get("https://www.example.com", timeout=(3, 10))
# 连接超时 3 秒：3秒内没建立连接就放弃
# 读取超时 10 秒：连接成功后，10秒内没收到完整响应就放弃
```

**生活类比：**

- **连接超时** = 打电话拨号，响了 3 秒没人接就挂掉
- **读取超时** = 对方接了电话但一直不说话，等了 10 秒就挂掉

---

## 九、错误处理——优雅地应对异常

### 9.1 常见异常类型

```python
import requests

# ── ConnectionError：连接失败 ──
# 网络不通、DNS 解析失败、服务器拒绝连接
try:
    response = requests.get("https://www.nonexistent-website-12345.com", timeout=5)
except requests.exceptions.ConnectionError as e:
    print(f"连接失败：{e}")

# ── Timeout：超时 ──
# 服务器响应太慢，超过你设置的等待时间
try:
    response = requests.get("https://www.slow-server.com", timeout=1)
except requests.exceptions.Timeout as e:
    print(f"请求超时：{e}")

# ── HTTPError：HTTP 状态码错误 ──
# 状态码是 4xx 或 5xx 时抛出（需要手动调用 raise_for_status()）
response = requests.get("https://httpbin.org/status/404")
print(response.status_code)  # 404，但不会自动抛异常
response.raise_for_status()   # 这里才会抛出 HTTPError
# 抛出 requests.exceptions.HTTPError

# ── JSONDecodeError：JSON 解析失败 ──
# 响应内容不是合法的 JSON
response = requests.get("https://httpbin.org/html")
try:
    data = response.json()
except requests.exceptions.JSONDecodeError as e:
    print(f"JSON 解析失败：{e}")
```

### 9.2 完整的错误处理模板

```python
import requests

def safe_get(url, params=None, headers=None, timeout=(3, 10)):
    """安全的 GET 请求封装，返回 (响应对象, 错误信息) 元组"""
    try:
        response = requests.get(url, params=params, headers=headers, timeout=timeout)
        response.raise_for_status()
        return response, None
    except requests.exceptions.Timeout:
        return None, "请求超时"
    except requests.exceptions.ConnectionError:
        return None, "连接失败"
    except requests.exceptions.HTTPError as e:
        return None, f"HTTP 错误：{e.response.status_code}"
    except requests.exceptions.RequestException as e:
        return None, f"未知错误：{e}"

# 使用示例
response, error = safe_get("https://httpbin.org/get")
if error:
    print(f"出错了：{error}")
else:
    print(f"成功！数据：{response.json()}")
```

> **提醒：** 爬虫运行时间长，网络环境复杂，不处理异常迟早会崩。这是基本功。

---

## 十、对比 JavaScript 的 fetch()

如果你有前端开发经验，这个对照表会帮你快速上手：

```python
# ── JS: fetch() ──                    ── Python: requests ──

# GET 请求
fetch(url).then(r => r.json())       →  requests.get(url).json()

# 带查询参数
fetch(url + "?page=1&size=10")       →  requests.get(url, params={"page":1,"size":10})

# POST JSON
fetch(url, {method:"POST",           →  requests.post(url, json={"name":"alice"})
  body:JSON.stringify({name:"alice"})})

# 自定义 headers
fetch(url, {headers:{"X-Token":"x"}})→  requests.get(url, headers={"X-Token":"x"})

# 获取状态码
res.status                           →  response.status_code

# 获取响应头
res.headers.get("content-type")      →  response.headers["Content-Type"]
```

```python
# 关键差异：
# 1. fetch() 是异步（Promise），requests 是同步——直接拿到结果，不需要 .then()
# 2. fetch() 不会自动抛异常（404/500 也不会），requests 配合 raise_for_status() 一行搞定
# 3. Cookie：浏览器自动管理，Python 需要用 Session 对象手动管理
# 4. 超时：JS 需要 AbortController（很麻烦），Python 只需 timeout=5
```

---

## 十一、动手练习

### 练习1：抓取 httpbin 的 GET 接口

```python
"""
目标：发送 GET 请求并解析响应
步骤：
1. 向 https://httpbin.org/get 发送 GET 请求，传参 name=你的名字, age=你的年龄
2. 打印：状态码、Content-Type、args 字段、headers 中的 User-Agent
"""
import requests

params = {"name": "你的名字", "age": 20}
response = requests.get("https://httpbin.org/get", params=params)

# 在这里补充你的代码...
```

### 练习2：对比有无 User-Agent 的区别

```python
"""
目标：理解 User-Agent 的重要性
步骤：
1. 不加 headers，GET 请求 https://httpbin.org/headers，观察 User-Agent
2. 加上浏览器 User-Agent，再次请求，对比变化
"""
import requests

# 第1次：不加 headers
r1 = requests.get("https://httpbin.org/headers")
print("不加 headers:", r1.json())

# 第2次：加 headers
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"}
r2 = requests.get("https://httpbin.org/headers", headers=headers)
print("加 headers:", r2.json())
```

### 练习3：用 Session 完成登录流程

```python
"""
目标：用 Session 保持 Cookie
步骤：
1. 创建一个 Session 对象
2. 用 session 访问 https://httpbin.org/cookies/set/token/abc123
   （这个接口会设置一个 Cookie）
3. 用同一个 session 访问 https://httpbin.org/cookies
4. 验证 Cookie 是否被自动带上了
5. 打印响应 JSON，应该能看到 {"cookies": {"token": "abc123"}}
"""

# 参考代码框架
import requests

with requests.Session() as session:
    # 第1步：设置 Cookie
    session.get("https://httpbin.org/cookies/set/token/abc123")

    # 第2步：验证 Cookie
    r = session.get("https://httpbin.org/cookies")
    print(r.json())  # 期望输出：{'cookies': {'token': 'abc123'}}
```

---

## 常见误区

- **用 `data=` 参数发送 JSON 数据。** `data=` 发送的是表单格式（application/x-www-form-urlencoded），要发 JSON 必须用 `json=` 参数，否则服务器可能解析失败。
- **不设置 timeout 就发请求。** 不设超时意味着网络异常时程序会无限卡死。生产环境中每个请求都必须设置 timeout，这是最基本的安全措施。
- **用 `response.text` 处理所有响应。** `response.text` 适合 HTML 和纯文本，但处理图片等二进制数据会乱码；API 返回的 JSON 用 `.json()` 更直接。根据 Content-Type 选择正确的读取方式。
- **每次都用 `requests.get()` 而不用 Session。** 没有 Session，每次请求都是独立的连接，Cookie 不会自动保持，TCP 连接也无法复用。需要登录态或多页采集时必须用 Session。

---

## 工程建议

- **优先使用 `params` 而非手动拼接 URL。** 手动拼 URL 容易遗漏编码问题，`requests` 的 `params` 参数会自动处理特殊字符编码，更安全也更可读。
- **为每个请求设置 `timeout=(连接超时, 读取超时)`。** 推荐分别设置连接超时和读取超时，比如 `timeout=(3, 10)`，这样连接建立失败和响应读取慢可以分开控制。
- **用 Session 管理所有请求。** 即使不需要登录态，Session 也能复用 TCP 连接（keep-alive），提高批量请求的速度。用 `with requests.Session()` 确保资源自动释放。
- **统一异常处理，不要在每个请求处都写 try/except。** 封装一个通用的请求函数（如 `safe_get`），集中处理超时、连接失败、HTTP 错误等异常，保持业务代码简洁。

---

## 小结

本课的核心知识点：

1. **requests 是 Python 最流行的 HTTP 库**，API 简洁直观，"HTTP for Humans"
2. **GET 请求用 `requests.get()`**，响应对象有 `.status_code`、`.text`、`.json()` 等常用属性
3. **查询参数用 `params` 字典**，requests 自动编码拼接，不要手动拼 URL
4. **POST 请求有两种数据格式**：`data=` 发表单，`json=` 发 JSON，requests 自动设置 Content-Type
5. **自定义请求头用 `headers` 参数**，User-Agent 应该清楚说明客户端身份
6. **Cookie 是保持登录状态的关键**，可以用 `cookies` 参数手动传，也可以用 Session 自动管理
7. **Session 对象自动管理 Cookie 和 TCP 连接**，是爬虫的标准做法
8. **`timeout` 参数必须设置**，防止程序因网络问题无限卡死
9. **用 try/except 处理网络异常**，爬虫运行时间长，异常处理是基本功
10. **requests 是同步的**，比 JS 的 fetch() 更直观，不需要 Promise 链

> **前端开发者的优势：** 你已经熟悉了 HTTP 的请求/响应模型和 API 调用方式。requests 的 params、headers、json 等参数，和你在 JS 中用 fetch() 时传的配置几乎一模一样——只是语法从 JS 变成了 Python。

---

## 下一课预告

下一课我们将学习 HTML 的结构——了解网页的"骨架"长什么样。只有理解了 HTML 的标签、属性和 DOM 树结构，你才能用 Python 精准地从网页中"抠"出你想要的数据。如果你已经能熟练使用 requests 发请求和读响应，那下一步就是学会解析这些响应内容。

---

## 参考答案

### 练习一

**思路**：向 httpbin 的 GET 接口发送带查询参数的请求，然后从响应中提取状态码、Content-Type、args 字段和 User-Agent。

**答案**：
```python
import requests

params = {"name": "小明", "age": 20}
response = requests.get("https://httpbin.org/get", params=params)

print("状态码:", response.status_code)
print("Content-Type:", response.headers["Content-Type"])
print("args 字段:", response.json()["args"])
print("User-Agent:", response.json()["headers"]["User-Agent"])
```

**要点**：
- `params` 参数会自动编码并拼接到 URL 中，不需要手动拼接
- `response.json()` 直接将 JSON 响应解析为 Python 字典
- `response.status_code` 返回数字类型的状态码，200 表示成功

### 练习二

**思路**：分别发送不带 User-Agent 和带 User-Agent 的请求，对比 httpbin 返回的 headers 信息，观察默认 User-Agent 暴露了 `python-requests` 标识。

**答案**：
```python
import requests

# 第1次：不加 headers
r1 = requests.get("https://httpbin.org/headers")
print("不加 headers:")
print(r1.json())
# User-Agent 会显示 python-requests/2.x.x

# 第2次：加 headers
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36"
}
r2 = requests.get("https://httpbin.org/headers", headers=headers)
print("\n加 headers:")
print(r2.json())
# User-Agent 显示为 Chrome 浏览器
```

**要点**：
- 不设置 User-Agent 时，requests 默认发送 `python-requests/x.x.x`，容易被网站识别为爬虫
- 很多网站会检查 User-Agent，看到是 Python 脚本可能直接返回 403
- 设置合理的 User-Agent 是最基本的反反爬措施

### 练习三

**思路**：使用 Session 对象保持 Cookie。先访问设置 Cookie 的接口，再用同一个 Session 访问读取 Cookie 的接口，验证 Cookie 是否自动带上。

**答案**：
```python
import requests

with requests.Session() as session:
    # 第1步：设置 Cookie（httpbin 的 cookies/set 接口会返回 Set-Cookie 响应头）
    session.get("https://httpbin.org/cookies/set/token/abc123")

    # 第2步：验证 Cookie 是否自动带上
    r = session.get("https://httpbin.org/cookies")
    print(r.json())  # 期望输出：{'cookies': {'token': 'abc123'}}

    # 验证通过说明 Session 自动管理了 Cookie
    print("Cookie 验证成功！" if r.json() == {'cookies': {'token': 'abc123'}} else "Cookie 验证失败")
```

**要点**：
- `requests.Session()` 会自动保存服务器返回的 Set-Cookie，并在后续请求中自动带上
- 使用 `with` 语句确保 Session 资源自动释放
- Session 除了管理 Cookie，还能复用 TCP 连接（keep-alive），提高请求速度
