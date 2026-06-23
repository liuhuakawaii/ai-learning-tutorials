# HTTP 协议与 DevTools

## 为什么爬虫第一步不是写代码

你在浏览器里打开一个电商网站，看到满屏商品信息。打开 DevTools 的 Network 面板一看——几十个请求，有的返回 HTML，有的返回 JSON，有的 302 跳转，有的 403 被拒绝。你完全看不懂这些请求在干什么。

爬虫的核心就是**用代码模拟浏览器发送 HTTP 请求**。如果你不懂 HTTP，就不知道该往哪里发请求、发什么内容、怎么判断返回对不对。看懂这些"快递单"，才能用 Python 模拟出一模一样的请求。

## HTTP 请求/响应周期

当你输入 `https://www.example.com` 并回车：

```
浏览器构造 HTTP 请求：
┌───────────────────────────────────────┐
│ GET / HTTP/1.1                        │ ← 请求行
│ Host: www.example.com                 │ ┐
│ User-Agent: Chrome/120                │ │ 请求头
│ Accept: text/html                     │ ┘
│                                       │ ← 请求体（GET 为空）
└───────────────────────────────────────┘
         │ 发往服务器
         ▼
服务器构造 HTTP 响应：
┌───────────────────────────────────────┐
│ HTTP/1.1 200 OK                       │ ← 状态行
│ Content-Type: text/html               │ ┐
│ Content-Length: 1256                   │ │ 响应头
│                                       │ ┘
│ <!DOCTYPE html><html>...</html>       │ ← 响应体
└───────────────────────────────────────┘
```

URL 结构：`https://www.example.com:443/search?q=python&page=1#results`

协议方案 | 主机名 | 端口 | 路径 | 查询参数 | 片段标识

## HTTP 方法

| 方法 | 含义 | 爬虫中的用途 |
|------|------|-------------|
| GET | 获取资源 | 最常用，直接请求页面 |
| POST | 提交数据 | 登录、搜索、翻页 |
| PUT | 更新数据 | 较少使用 |
| DELETE | 删除数据 | 较少使用 |

GET 参数在 URL 里（查询字符串），POST 参数在请求体里（body）。爬虫中 GET 和 POST 最常用。

## 请求头中的关键字段

```python
headers = {
    # 浏览器身份标识——不加这个很多网站会拒绝
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    # 来源页面
    "Referer": "https://www.example.com/list",
    # 我能接受什么格式
    "Accept": "text/html,application/xhtml+xml",
    # Cookie
    "Cookie": "session_id=abc123",
}
```

## 状态码

| 状态码 | 含义 | 爬虫怎么处理 |
|--------|------|-------------|
| 200 | 成功 | 继续解析 |
| 301 | 永久重定向 | 跟随新地址 |
| 302 | 临时重定向 | 跟踪 Location 头 |
| 403 | 禁止访问 | 检查请求头、加 Cookie |
| 404 | 找不到 | 检查 URL |
| 429 | 请求太频繁 | 降低频率 |
| 500 | 服务器错误 | 等一会儿重试 |

记忆：2xx 成功，3xx 重定向，4xx 你的锅，5xx 服务器的锅。

## Content-Type

响应头中的 Content-Type 告诉你响应体是什么格式：

- `text/html` → HTML 网页，用 BeautifulSoup 解析
- `application/json` → JSON 数据，直接用 `.json()` 解析
- `image/jpeg` → 图片，二进制数据

拿到响应后先看 Content-Type，再决定怎么处理。把 JSON 当 HTML 解析会出错。

## HTTPS

HTTP 端口 80，明文传输；HTTPS 端口 443，SSL/TLS 加密。对爬虫来说没有区别——requests 库默认支持 HTTPS，代码不需要额外配置。HTTPS 只加密传输过程，不影响你发送请求和接收响应。

## keep-alive

HTTP/1.0 每次请求都要重新建立 TCP 连接；HTTP/1.1 默认 keep-alive，多个请求复用同一个连接。requests 的 Session 对象就是利用了这个原理，显著提高抓取速度。

## DevTools Network 面板

这是爬虫开发者最重要的调试工具。

**打开方式**：F12 → Network 标签

**Filter 栏**：
- Doc → 文档请求（HTML 页面本身）
- XHR → AJAX 请求（API 接口返回的 JSON）★ 爬虫重点
- JS / CSS / Img → 资源文件

**关键操作：Copy as cURL**

1. 在 Network 面板找到目标请求
2. 右键 → Copy → Copy as cURL (bash)
3. 得到一条完整的 cURL 命令，包含 URL、方法、所有请求头

这条 cURL 命令包含了发请求需要的一切信息，后面学了 requests 就可以翻译成 Python 代码。这是爬虫开发的基本流程。

**XHR 请求是关键**：很多网站的数据是通过 JavaScript 动态加载的 API 返回的 JSON。直接抓 API 比解析 HTML 简单得多，数据也更干净。

## 练习

### 练习一：用 DevTools 抓取请求

打开 https://example.com，用 Network 面板观察：一共有多少个请求？主文档状态码？Content-Type？

### 练习二：分析 API 请求

打开 https://news.ycombinator.com，Network → Fetch/XHR 过滤，找到数据请求，记录 URL、方法、状态码、Content-Type。

### 练习三：Copy as cURL

打开 https://httpbin.org/get，右键主文档请求 → Copy as cURL，分析：请求 URL、有几个请求头、User-Agent 是什么。

---

## 参考答案

### 练习一

example.com 只有 1 个请求（极简页面）。状态码 200，Content-Type `text/html; charset=UTF-8`，约 1.25 KB。

### 练习二

Hacker News 是服务端渲染，数据直接嵌在 HTML 中，没有独立的 XHR 请求。如果打开现代 SPA 应用（如 GitHub 某些页面），会有真正的 XHR 返回 JSON。

### 练习三

```bash
# 典型的 cURL 命令
curl 'https://httpbin.org/get' \
  -H 'accept: text/html,...' \
  -H 'user-agent: Mozilla/5.0 ...' \
  -H 'cookie: ...'
```

翻译成 Python：

```python
import requests
headers = {
    "accept": "text/html,...",
    "user-agent": "Mozilla/5.0 ...",
}
response = requests.get("https://httpbin.org/get", headers=headers)
print(response.json())
```
