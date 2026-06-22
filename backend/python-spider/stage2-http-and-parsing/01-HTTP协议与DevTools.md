# 第1课：HTTP 协议与 DevTools

> **课程定位：** 第二阶段 · HTTP 与网页解析 · 第 1 课时
> **前置知识：** Python 基础语法、前端开发基本经验（HTML/CSS/JS）
> **预计时长：** 45 分钟

---

## 场景引入

你在浏览器里打开一个电商网站，看到满屏的商品信息。你心想："这些数据要是能用 Python 自动抓下来就好了。"但你打开 DevTools 的 Network 面板一看——几十个请求，有的返回 HTML，有的返回 JSON，有的状态码是 302 跳转，有的直接 403 被拒绝。你完全看不懂这些请求到底在干什么。

这就是为什么爬虫的第一步不是写代码，而是理解 HTTP 协议。你需要知道浏览器到底向服务器发了什么、服务器回了什么、哪些信息是关键的。只有看懂了这些"快递单"，你才能用 Python 模拟出一模一样的请求。

---

完成本课学习后，你将能够：

1. 用生活类比解释 HTTP 协议的工作原理
2. 画出完整的 HTTP 请求/响应周期图
3. 区分 GET、POST、PUT、DELETE 四种常用 HTTP 方法
4. 说出 HTTP 请求和响应的各组成部分
5. 记住常见状态码的含义（200、301、302、403、404、500）
6. 区分 text/html 和 application/json 两种 Content-Type
7. 熟练使用浏览器 DevTools 的 Network 面板抓包
8. 解释 HTTPS 相对于 HTTP 的安全优势

---

## 一、HTTP 是什么？——邮局类比

### 1.1 生活中的"请求-响应"

你每天都在用 HTTP，只是你没意识到而已。

想象你在网上买了一本书，流程是这样的：

```
┌──────────┐                              ┌──────────┐
│          │   ① 寄出订单（请求）          │          │
│   你      │ ──────────────────────────→  │  网上书店 │
│（客户端） │                              │（服务器） │
│          │   ② 寄回书籍（响应）          │          │
│          │ ←──────────────────────────  │          │
└──────────┘                              └──────────┘
```

HTTP（HyperText Transfer Protocol，超文本传输协议）就是这个"寄送规则"：

- **你** = 客户端（浏览器、Python 脚本、App）
- **网上书店** = 服务器（网站后端）
- **订单** = HTTP 请求（Request）
- **书籍** = HTTP 响应（Response）
- **寄送规则** = HTTP 协议（规定双方怎么沟通）

### 1.2 为什么前端开发者要理解 HTTP？

作为前端开发者，你可能觉得"我只管写页面，HTTP 是后端的事"。但爬虫的核心就是 **用代码模拟浏览器发送 HTTP 请求**。如果你不懂 HTTP，你就不知道该往哪里发请求、发什么内容、怎么判断返回对不对。

> **一句话总结：** 爬虫 = 自动化地发 HTTP 请求 + 解析响应内容。

---

## 二、请求/响应周期——完整流程

### 2.1 一次完整的 HTTP 通信

当你在浏览器输入 `https://www.example.com` 并按下回车，到底发生了什么？

```
┌─────────────────────────────────────────────────────────────────┐
│                     浏览器（客户端）                              │
│                                                                 │
│  ① 你在地址栏输入 URL 并回车                                      │
│  ② 浏览器构造 HTTP 请求                                           │
│     ┌───────────────────────────────────────┐                   │
│     │ GET / HTTP/1.1                        │ ← 请求行           │
│     │ Host: www.example.com                 │ ┐                  │
│     │ User-Agent: Chrome/120                │ │ 请求头            │
│     │ Accept: text/html                     │ │                  │
│     │ Accept-Language: zh-CN                │ ┘                  │
│     │                                       │                    │
│     │                                       │ ← 请求体（空）     │
│     └───────────────────────────────────────┘                   │
│  ③ 浏览器把请求发往服务器                                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ═══════════╪═══════════  互联网
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     服务器（如 Nginx）                            │
│                                                                 │
│  ④ 服务器收到请求，处理逻辑                                        │
│  ⑤ 服务器构造 HTTP 响应                                           │
│     ┌───────────────────────────────────────┐                   │
│     │ HTTP/1.1 200 OK                       │ ← 状态行           │
│     │ Content-Type: text/html               │ ┐                  │
│     │ Content-Length: 1256                   │ │ 响应头            │
│     │ Server: nginx/1.24                    │ ┘                  │
│     │                                       │                    │
│     │ <!DOCTYPE html><html>...</html>       │ ← 响应体           │
│     └───────────────────────────────────────┘                   │
│  ⑥ 服务器把响应发回浏览器                                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     浏览器（客户端）                              │
│                                                                 │
│  ⑦ 浏览器收到响应，解析 HTML                                      │
│  ⑧ 发现 CSS/JS/图片等资源，再发新请求                              │
│  ⑨ 页面渲染完成                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 一个 URL 长什么样？

```
https://www.example.com:443/search?q=python&page=1#results
│       │                │   │          │            │
│       │                │   │          │            └─ 片段标识（锚点）
│       │                │   │          └─ 查询参数
│       │                │   └─ 路径
│       │                └─ 端口号（HTTPS 默认 443，HTTP 默认 80）
│       └─ 主机名（域名）
└─ 协议方案（scheme）
```

**生活类比：** URL 就像快递地址——协议是运输方式（航空/陆运），主机名是城市，路径是街道门牌号，查询参数是附加说明（"放门口""请联系李女士"）。

---

## 三、HTTP 方法——"你想干什么？"

### 3.1 四种常用方法

HTTP 方法告诉服务器"我想对这个资源做什么操作"：

```
┌──────────┬──────────────┬───────────────────────────────────┐
│  方法     │  含义         │  生活类比                          │
├──────────┼──────────────┼───────────────────────────────────┤
│  GET     │  获取资源      │  去图书馆借书看                     │
│  POST    │  提交/创建数据  │  去图书馆登记办借书卡                │
│  PUT     │  更新/替换数据  │  把书架上的旧版换成新版              │
│  DELETE  │  删除数据      │  把书从书架上拿走                   │
└──────────┴──────────────┴───────────────────────────────────┘
```

### 3.2 GET 和 POST 的关键区别

这是面试高频题，也是爬虫中最重要的区分：

```python
# ❌ 错误理解：GET 没有请求体，POST 一定有请求体
# 实际上：GET 也可以有请求体（只是规范不推荐），POST 也可以没有请求体

# ✅ 正确理解的核心区别：
# GET  —— 参数放在 URL 里（查询字符串），浏览器地址栏可见
# POST —— 参数放在请求体里（body），地址栏不可见

# GET 请求示例：
# URL: https://api.example.com/users?id=123
# 参数 ?id=123 暴露在 URL 中

# POST 请求示例：
# URL: https://api.example.com/users
# Body: {"id": 123, "name": "张三"}
# 参数藏在请求体里，URL 中看不到
```

**爬虫中的影响：**

- GET 请求构造简单，直接拼接 URL 即可
- POST 请求需要额外提供 body 数据（后面课程会详细讲）

---

## 四、HTTP 请求的组成部分

### 4.1 请求的三大块

```
┌─────────────────────────────────────────┐
│              HTTP 请求                   │
├─────────────────────────────────────────┤
│ ① 请求行（Request Line）                │
│    方法 + 路径 + 协议版本                 │
│    例：GET /index.html HTTP/1.1          │
├─────────────────────────────────────────┤
│ ② 请求头（Request Headers）             │
│    Host: www.example.com                 │
│    User-Agent: Mozilla/5.0 ...           │
│    Accept: text/html,application/json    │
│    Cookie: session_id=abc123             │
│    Referer: https://www.google.com       │
│    Content-Type: application/json        │
├─────────────────────────────────────────┤
│ ③ 请求体（Request Body）                 │
│    GET 请求通常为空                       │
│    POST 请求可以是表单数据、JSON 等        │
│    例：username=alice&password=123456     │
└─────────────────────────────────────────┘
```

### 4.2 几个重要请求头详解

```python
# 作为爬虫开发者，你需要特别关注这几个请求头：

headers = {
    # 浏览器身份标识——告诉服务器"我是谁"
    # 爬虫如果不加这个，很多网站会直接拒绝
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",

    # 来源页面——告诉服务器"我从哪跳转来的"
    "Referer": "https://www.example.com/list",

    # 我能接受什么格式的响应
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",

    # 我能接受什么语言
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",

    # 浏览器自动带上的 Cookie
    "Cookie": "session_id=abc123; user_token=xyz789",
}
```

---

## 五、HTTP 响应的组成部分

### 5.1 响应的三大块

```
┌─────────────────────────────────────────┐
│              HTTP 响应                   │
├─────────────────────────────────────────┤
│ ① 状态行（Status Line）                 │
│    协议版本 + 状态码 + 状态描述            │
│    例：HTTP/1.1 200 OK                   │
├─────────────────────────────────────────┤
│ ② 响应头（Response Headers）             │
│    Content-Type: text/html; charset=utf8 │
│    Content-Length: 1256                   │
│    Server: nginx/1.24                    │
│    Set-Cookie: session_id=abc123         │
│    Date: Mon, 01 Jun 2026 12:00:00 GMT   │
├─────────────────────────────────────────┤
│ ③ 响应体（Response Body）                │
│    可能是 HTML、JSON、图片二进制数据等     │
│    这就是爬虫要"抓"的目标                 │
└─────────────────────────────────────────┘
```

### 5.2 Content-Type 响应类型

Content-Type 告诉你"响应体里装的是什么格式的数据"：

```python
# 两种最常见的 Content-Type：

# 1. text/html —— 返回的是 HTML 网页
#    浏览器会把它渲染成你看到的页面
#    爬虫需要解析 HTML 提取数据
"Content-Type: text/html; charset=utf-8"

# 2. application/json —— 返回的是 JSON 数据
#    前后端分离项目中 API 的标准返回格式
#    爬虫直接用 .json() 解析即可，非常方便
"Content-Type: application/json; charset=utf-8"

# 其他常见的（了解即可）：
# text/plain          —— 纯文本
# application/xml     —— XML 格式
# image/jpeg          —— JPEG 图片
# image/png           —— PNG 图片
# application/pdf     —— PDF 文件
```

**生活类比：** Content-Type 就像快递包裹上的标签——"易碎品""文件""食品"。你得先看标签，才知道怎么拆包裹。拿到 JSON 当 HTML 解析，就像把食品当文件拆，肯定出错。

---

## 六、状态码——服务器的"回复暗号"

### 6.1 状态码分类

```
┌──────────┬──────────────┬──────────────────────────────────┐
│  状态码   │  类别         │  含义                            │
├──────────┼──────────────┼──────────────────────────────────┤
│  1xx     │  信息性       │  请求已收到，继续处理              │
│  2xx     │  成功         │  请求被成功接收、理解、处理        │
│  3xx     │  重定向       │  需要进一步操作才能完成请求        │
│  4xx     │  客户端错误   │  请求本身有问题（你的锅）          │
│  5xx     │  服务器错误   │  服务器内部出问题了（服务器的锅）  │
└──────────┴──────────────┴──────────────────────────────────┘
```

### 6.2 爬虫中最常遇到的状态码

```python
# ✅ 200 OK —— 成功！服务器正常返回了你要的数据
# 爬虫：一切正常，继续解析

# ✅ 301 Moved Permanently —— 永久重定向
# 资源已经永久搬到新地址了
# 爬虫：服务器会在响应头里给出新地址，需要跟着跳转

# ✅ 302 Found —— 临时重定向
# 资源临时在另一个地址
# 爬虫：常见于登录跳转，需要跟踪 Location 头

# ❌ 403 Forbidden —— 禁止访问
# 服务器认识你，但不让你进
# 爬虫：可能是被反爬了，需要检查请求头、加 Cookie 等

# ❌ 404 Not Found —— 找不到资源
# URL 写错了，或者页面已被删除
# 爬虫：检查 URL 是否正确，数据可能已下架

# ❌ 500 Internal Server Error —— 服务器内部错误
# 服务器自己代码崩了
# 爬虫：不是你的问题，等一会儿重试

# 其他值得关注的：
# 401 Unauthorized —— 需要登录认证
# 429 Too Many Requests —— 你请求太频繁了，被限速
# 503 Service Unavailable —— 服务暂时不可用（可能在维护）
```

**记忆技巧：**

- 2xx = "好的收到"（成功）
- 3xx = "你去那边"（重定向）
- 4xx = "你搞错了"（客户端的锅）
- 5xx = "我搞砸了"（服务器的锅）

---

## 七、HTTPS vs HTTP

### 7.1 区别一目了然

```
HTTP：                        HTTPS：
┌──────────┐                  ┌──────────┐
│  你的请求  │                  │  你的请求  │
│  明文传输  │                  │  加密传输  │
│  ↓        │                  │  ↓        │
│  任何人可  │                  │  看到的只  │
│  以偷看    │                  │  是乱码    │
└──────────┘                  └──────────┘
  "我爱你"                      "x#9@kL!m"
  ↑ 中间人能看懂                 ↑ 中间人看不懂
```

### 7.2 关键知识点

```python
# HTTP  —— 端口 80，明文传输，不安全
# HTTPS —— 端口 443，SSL/TLS 加密，安全

# 对爬虫来说：
# 1. 现在绝大多数网站都是 HTTPS，你的爬虫代码一样能抓
# 2. requests 库默认支持 HTTPS，不需要额外配置
# 3. 唯一区别：HTTPS 多了一层加密/解密，但对你透明

# ❌ 错误想法："HTTPS 的网站我爬不了"
# ✅ 正确认知：HTTPS 只加密传输过程，不影响你发送请求和接收响应
```

---

## 八、Connection: keep-alive

### 8.1 为什么需要它？

```
没有 keep-alive（HTTP/1.0 默认行为）：
┌────────┐                    ┌────────┐
│ 客户端  │──建立连接──→       │ 服务器  │
│        │──请求1──→          │        │
│        │←──响应1──          │        │
│        │──断开连接──         │        │
│        │                    │        │
│        │──重新建立连接──→    │        │  ← 每次都要重新握手，浪费时间
│        │──请求2──→          │        │
│        │←──响应2──          │        │
│        │──断开连接──         │        │
└────────┘                    └────────┘

有 keep-alive（HTTP/1.1 默认行为）：
┌────────┐                    ┌────────┐
│ 客户端  │──建立连接──→       │ 服务器  │
│        │──请求1──→          │        │
│        │←──响应1──          │        │
│        │──请求2──→          │        │  ← 同一个连接，不用断开重连
│        │←──响应2──          │        │
│        │──请求3──→          │        │
│        │←──响应3──          │        │
│        │──关闭连接──         │        │
└────────┘                    └────────┘
```

**生活类比：** keep-alive 就像你去银行办事——

- **没有 keep-alive：** 每办一件事都要取号、排队、到窗口、办完走人，再取号、排队……
- **有 keep-alive：** 到窗口后连续办多件事，最后再离开。

对爬虫来说，用 keep-alive 可以显著提高抓取速度（后面的 `Session` 对象就是利用了这个原理）。

---

## 九、实战：浏览器 DevTools Network 面板

### 9.1 打开 Network 面板

这是你作为爬虫开发者 **最重要的调试工具**，没有之一。

```
操作步骤：
1. 打开 Chrome 浏览器
2. 按 F12（或 Ctrl+Shift+I）打开 DevTools
3. 点击 "Network"（网络）标签
4. 在地址栏输入 https://www.example.com 并回车
5. 你会看到一列请求记录
```

### 9.2 Network 面板详解

```
┌─────────────────────────────────────────────────────────────┐
│  Network 面板                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Filter 过滤栏：                                             │
│  [All] [Fetch/XHR] [JS] [CSS] [Img] [Media] [Doc] [WS]    │
│                                                             │
│  ┌─────────┬────────┬──────┬────────┬─────┬────────┐       │
│  │  Name   │ Status │ Type │ Size   │Time │ ...    │       │
│  ├─────────┼────────┼──────┼────────┼─────┼────────┤       │
│  │ index.  │ 200    │ doc  │ 1.2KB  │120ms│ ...    │       │
│  │ css     │ 200    │ css  │ 45KB   │ 50ms│ ...    │       │
│  │ app.js  │ 200    │ js   │ 128KB  │ 80ms│ ...    │       │
│  │ data    │ 200    │ xhr  │ 3.4KB  │200ms│ ...    │       │
│  └─────────┴────────┴──────┴────────┴─────┴────────┘       │
│                                                             │
│  点击某个请求后，右侧面板显示详情：                             │
│  [Headers] [Preview] [Response] [Cookies] [Timing]          │
│                                                             │
│  Headers 标签页：                                            │
│  ├── General                                                │
│  │   Request URL: https://www.example.com                   │
│  │   Request Method: GET                                    │
│  │   Status Code: 200 OK                                    │
│  ├── Response Headers                                       │
│  │   Content-Type: text/html; charset=UTF-8                 │
│  │   Server: nginx                                          │
│  └── Request Headers                                        │
│      User-Agent: Mozilla/5.0 ...                            │
│      Accept: text/html ...                                  │
│      Cookie: ...                                            │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Filter 栏——快速找到你要的请求

```python
# 前端开发者常用过滤方式：

# Doc     —— 只看文档请求（HTML 页面本身）
# XHR     —— 只看 AJAX 请求（API 接口返回的 JSON 数据）★ 爬虫重点
# JS      —— 只看 JavaScript 文件
# CSS     —— 只看样式表
# Img     —— 只看图片

# 🔥 爬虫小技巧：
# 很多网站的数据是通过 XHR 请求动态加载的
# 你看到的页面内容可能不是 HTML 里写死的
# 而是 JS 发了一个 API 请求，拿到 JSON 后渲染的
# 这时候直接抓 API（JSON）比解析 HTML 简单得多！
```

### 9.4 复制为 cURL——爬虫的起点

这是 DevTools 最强大的功能之一：

```
操作步骤：
1. 在 Network 面板中找到目标请求
2. 右键点击该请求
3. 选择 "Copy" → "Copy as cURL (bash)"
4. 得到一条完整的 cURL 命令

示例输出：
curl 'https://api.example.com/users?page=1' \
  -H 'accept: application/json' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...' \
  -H 'cookie: session_id=abc123' \
  -H 'referer: https://www.example.com/users'
```

```python
# 这条 cURL 命令包含了你发请求需要的一切信息：
# 1. 请求 URL
# 2. 请求方法（默认 GET）
# 3. 所有请求头（User-Agent、Cookie、Referer 等）

# 后面学了 requests 库，你就可以直接把这些信息翻译成 Python 代码
# 这就是爬虫开发的基本流程！
```

### 9.5 Preview 和 Response 标签

```
Preview 标签 —— 预览响应内容
  - 如果是 JSON，会自动格式化显示（方便阅读）
  - 如果是 HTML，会显示渲染后的效果
  - 如果是图片，会直接显示图片

Response 标签 —— 显示原始响应内容
  - 就是服务器返回的原始文本
  - JSON 就是一大串字符串
  - HTML 就是一大堆标签

# 🔥 爬虫判断技巧：
# 如果 Preview 里能看到你要的数据，说明请求对了
# 如果 Response 是乱码或空白，可能需要检查编码或认证
```

---

## 十、动手练习

### 练习1：用 DevTools 抓取一个页面的所有请求

```
目标：打开 https://example.com，用 Network 面板观察所有请求
步骤：
1. 打开 DevTools → Network
2. 勾选 "Preserve log"（保留日志）
3. 访问 https://example.com
4. 回答以下问题：
   - 一共有多少个请求？
   - 主文档请求的状态码是什么？
   - 主文档的 Content-Type 是什么？
   - 总共传输了多少数据？（看底部的 Size 统计）
```

### 练习2：分析一个 API 请求

```
目标：找到一个 XHR 请求并分析它的完整信息
步骤：
1. 打开 https://news.ycombinator.com（Hacker News）
2. 在 Network 面板中选择 "Fetch/XHR" 过滤
3. 刷新页面
4. 找到一个数据请求，点击它
5. 记录以下信息：
   - 请求 URL
   - 请求方法
   - 状态码
   - Content-Type
   - 响应数据的前 200 个字符
```

### 练习3：Copy as cURL 并分析

```
目标：复制一个请求的 cURL 命令并理解它
步骤：
1. 随便打开一个网站（如 https://httpbin.org/get）
2. 在 Network 面板找到主文档请求
3. 右键 → Copy → Copy as cURL (bash)
4. 把命令粘贴到文本编辑器
5. 回答：
   - 请求的 URL 是什么？
   - 有几个请求头？
   - User-Agent 是什么？
   - 请求方法是什么？
```

---

## 常见误区

- **认为 HTTPS 网站不能爬。** HTTPS 只是加密了传输过程，requests 库默认支持 HTTPS，你的代码不需要任何额外配置就能请求 HTTPS 网站。
- **看到 403 就以为 URL 错了。** 403 Forbidden 通常不是 URL 的问题，而是服务器识别出你不是浏览器——检查一下有没有设置 User-Agent 请求头。
- **把状态码 200 当作"数据一定正确"。** 200 只说明请求被成功处理了，但响应内容可能是登录页面、反爬提示页或空数据，还需要验证实际内容。
- **忽略 Content-Type 直接解析。** 拿到响应后不检查 Content-Type，把 JSON 当 HTML 解析，或者把 HTML 当 JSON 解析，导致各种奇怪的错误。

---

## 工程建议

- **养成用 DevTools "Copy as cURL" 的习惯。** 每次爬取新网站前，先在浏览器中找到目标请求，右键复制为 cURL，再翻译成 Python 代码。这比从零构造请求高效得多。
- **重点关注 XHR/Fetch 标签页。** 很多网站的数据是通过 JavaScript 动态加载的 API 接口返回的 JSON，直接抓 API 比解析 HTML 简单得多，数据也更干净。
- **记录目标网站的请求头和 Cookie 信息。** 把成功请求的 headers 保存下来，遇到反爬时可以快速复用，不用每次都去 DevTools 里翻找。
- **从一开始就设置好 User-Agent。** 即使是学习阶段的代码，也加上有意义的 User-Agent。这既是礼貌，也能避免很多莫名其妙的 403 错误。

---

## 小结

本课的核心知识点：

1. **HTTP 是"客户端-服务器"的沟通协议**，爬虫的本质就是用代码模拟浏览器发 HTTP 请求
2. **请求由三部分组成：** 请求行（方法+路径+版本）、请求头（元信息）、请求体（数据）
3. **响应由三部分组成：** 状态行（版本+状态码）、响应头（元信息）、响应体（内容）
4. **四种 HTTP 方法：** GET（获取）、POST（创建）、PUT（更新）、DELETE（删除），爬虫最常用的是 GET 和 POST
5. **状态码是服务器的回复暗号：** 2xx 成功、3xx 重定向、4xx 客户端错误、5xx 服务器错误
6. **Content-Type 告诉你响应体的格式：** text/html 是网页，application/json 是 API 数据
7. **DevTools Network 面板是你的爬虫调试利器：** 用它观察请求细节，用 Copy as cURL 快速获取请求信息
8. **HTTPS 只是加密了传输过程**，不影响爬虫工作
9. **keep-alive 让多个请求复用同一个连接**，提高效率

> **前端开发者的优势：** 你已经用浏览器开发工具调试过无数次了，现在只需要把视角从"前端调试"切换到"抓包分析"，大部分工具都是你熟悉的。

---

## 下一课预告

下一课我们将正式开始写 Python 代码——用 `requests` 库发送你的第一个 HTTP 请求。你会发现，上一课学到的所有 HTTP 知识（请求头、状态码、Content-Type）在代码中都有直接对应。如果你已经能熟练使用 DevTools 分析请求，那下一课将会非常轻松。

---

## 参考答案

### 练习1

**思路**：打开 DevTools Network 面板，访问目标网站，观察请求列表中的请求数量、状态码、Content-Type 和传输数据量。

**答案**：

```
操作步骤：
1. 打开 Chrome → F12 → Network 标签
2. 勾选 "Preserve log"
3. 访问 https://example.com
4. 观察结果：

回答：
- 请求数量：1 个（example.com 是极简页面，只有主文档）
- 主文档状态码：200 OK
- Content-Type：text/html; charset=UTF-8
- 传输数据量：约 1.25 KB

补充说明：
- example.com 是最简单的测试页面，只有一个 HTML 请求
- 真实网站（如电商、新闻）通常有几十到上百个请求
- 可以点击 "Size" 列按大小排序，找出最大的资源文件
- "Preserve log" 的作用是保留跳转前的请求记录，不会因页面跳转而清空
```

**要点**：
- `example.com` 是最简单的测试页面，真实网站的请求数量会多得多
- "Preserve log" 勾选后可以捕获页面跳转前后的所有请求
- Size 列显示的 `(from disk cache)` 或 `(from memory cache)` 表示资源来自缓存，没有实际传输
- 底部状态栏会显示总请求数和总传输数据量

### 练习2

**思路**：在 Hacker News 网站中使用 XHR 过滤器找到数据请求，点击请求查看 Headers、Response 等详情。

**答案**：

```
操作步骤：
1. 打开 https://news.ycombinator.com
2. Network → 选择 "Fetch/XHR" 过滤
3. 刷新页面（Ctrl+R）
4. 观察 XHR 请求列表

典型发现：
- 请求 URL：https://news.ycombinator.com/news（主页面本身就是数据源）
- 请求方法：GET
- 状态码：200 OK
- Content-Type：text/html; charset=utf-8

注意：Hacker News 是服务端渲染的网站，数据直接嵌在 HTML 中，
不是通过独立的 API 请求获取 JSON。这是一个典型的"HTML 解析"场景。

对比：如果打开一个现代 SPA 应用（如 GitHub 的某些页面），
你会看到真正的 XHR 请求返回 application/json 格式的数据。
```

**要点**：
- 不是所有网站都有 XHR 请求——传统的服务端渲染网站（如 Hacker News）直接返回 HTML
- 如果 XHR 标签下没有请求，说明数据可能直接嵌在 HTML 中，需要解析 HTML
- 现代前后端分离的网站（React/Vue 应用）通常有大量 XHR 请求返回 JSON
- 爬虫策略选择：有 JSON API 就直接抓 API（更简单），没有就解析 HTML

### 练习3

**思路**：使用 "Copy as cURL" 功能获取完整的请求信息，然后逐项分析 cURL 命令的组成部分。

**答案**：

```
操作步骤：
1. 打开 https://httpbin.org/get
2. F12 → Network
3. 找到主文档请求（通常是第一个）
4. 右键 → Copy → Copy as cURL (bash)
5. 粘贴到文本编辑器

典型的 cURL 命令：
curl 'https://httpbin.org/get' \
  -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' \
  -H 'accept-language: zh-CN,zh;q=0.9,en;q=0.8' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' \
  -H 'cookie: ...'

分析：
- 请求 URL：https://httpbin.org/get
- 请求头数量：通常 4-6 个（accept、accept-language、user-agent、cookie 等）
- User-Agent：Mozilla/5.0 ... Chrome/120.0.0.0（浏览器身份标识）
- 请求方法：GET（默认，cURL 命令中没有显式写出）

翻译成 Python 代码：
import requests

headers = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

response = requests.get("https://httpbin.org/get", headers=headers)
print(response.status_code)
print(response.json())
```

**要点**：
- "Copy as cURL" 是爬虫开发的起点——它包含了发请求需要的一切信息
- `-H` 参数对应 Python 中的 `headers` 字典
- cURL 命令默认是 GET 方法，POST 请求会有 `-d` 参数表示请求体
- `httpbin.org/get` 会回显你的请求信息，非常适合调试
- 把 cURL 翻译成 Python `requests` 代码是爬虫开发的基本功
