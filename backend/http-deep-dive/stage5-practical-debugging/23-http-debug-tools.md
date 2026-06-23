# HTTP 调试工具链——curl 高级用法、httpie、Charles/Fiddler

## curl 不只是 curl -v

大多数人用 curl 只会 `curl -v URL`。但 curl 是一个功能极其丰富的 HTTP 调试工具，掌握它的高级用法能让你在排查问题时事半功倍。

## curl 高级用法

### 保存和加载 Cookie

```bash
# 保存 Cookie 到文件
curl -c cookies.txt https://example.com/login -d "user=admin&pass=123"

# 加载 Cookie 发请求
curl -b cookies.txt https://example.com/dashboard

# 同时保存和加载（维持会话）
curl -b cookies.txt -c cookies.txt https://example.com/profile
```

### 发送文件

```bash
# 上传文件
curl -X POST -F "file=@./photo.jpg" https://api.example.com/upload

# 发送 JSON 文件
curl -X POST -H "Content-Type: application/json" -d @data.json https://api.example.com/process

# 发送 multipart/form-data
curl -X POST -F "name=test" -F "file=@./data.csv" https://api.example.com/import
```

### 限速和超时

```bash
# 限速下载（100KB/s）
curl --limit-rate 100K -O https://example.com/large-file.zip

# 连接超时 5 秒，总超时 30 秒
curl --connect-timeout 5 --max-time 30 https://example.com

# 重试 3 次
curl --retry 3 --retry-delay 2 https://example.com
```

### 代理

```bash
# 使用 HTTP 代理
curl -x http://proxy:8080 https://example.com

# 使用 SOCKS 代理
curl --socks5-hostname proxy:1080 https://example.com

# 代理认证
curl -x http://proxy:8080 -U user:pass https://example.com
```

### 自定义请求

```bash
# 自定义头部
curl -H "X-Custom: value" -H "Authorization: Bearer token" https://example.com

# 自定义方法
curl -X PATCH -d '{"name":"new"}' -H "Content-Type: application/json" https://example.com/api/resource

# 发送原始请求（用于测试非标准协议）
curl --raw 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n' https://example.com
```

### 调试和跟踪

```bash
# 详细输出（包含 TLS 信息）
curl -vvv https://example.com

# 带时间戳
curl --trace-time https://example.com

# 保存完整的请求和响应
curl --trace trace.txt https://example.com

# 只看响应头
curl -I https://example.com

# 只看状态码
curl -o /dev/null -s -w "%{http_code}" https://example.com

# 看 DNS 解析时间、连接时间、TLS 时间、总时间
curl -o /dev/null -s -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" https://example.com
```

### HTTP/2 和 HTTP/3

```bash
# 强制 HTTP/2
curl --http2 https://example.com

# 强制 HTTP/2-prior-knowledge（h2c，不需要 TLS）
curl --http2-prior-knowledge http://localhost:3000

# 强制 HTTP/3
curl --http3 https://example.com
```

## httpie：比 curl 更友好的 HTTP 客户端

httpie 是一个现代化的 HTTP 客户端，默认输出格式化的 JSON，语法更直观。

安装：

```bash
pip install httpie
# 或
brew install httpie
```

基本用法：

```bash
# GET 请求
http GET https://api.example.com/users

# POST JSON
http POST https://api.example.com/users name=john email=john@example.com

# 带查询参数
http GET https://api.example.com/users page==1 limit==10

# 自定义头部
http GET https://api.example.com/users Authorization:"Bearer token"

# 上传文件
http --form POST https://api.example.com/upload file@./photo.jpg

# 下载文件
http --download https://example.com/file.zip
```

httpie 的优势：
- 默认格式化输出 JSON
- 自动设置 Content-Type
- 语法更直观（`key=value` 而不是 `-d '{"key":"value"}'`）
- 支持会话（类似 curl 的 Cookie 管理）

```bash
# 会话管理
http --session=login POST https://api.example.com/login user=admin pass=123
http --session=login GET https://api.example.com/dashboard
```

## Charles 和 Fiddler：图形化代理抓包工具

Charles 和 Fiddler 是 HTTP 代理工具，它们拦截浏览器和服务器之间的所有 HTTP/HTTPS 流量。

### 为什么需要代理抓包工具

curl 和 Wireshark 适合特定请求的调试，但代理工具有独特的优势：

- **浏览器行为观察**：能看到浏览器实际发出的请求，包括重定向、预检请求、Service Worker 拦截等
- **请求修改**：可以修改请求和响应，测试不同的场景
- **断点调试**：可以在请求发送前暂停，修改后再发送
- **历史记录**：自动保存所有请求的历史，方便回溯

### Charles 基本用法

1. 启动 Charles，默认监听 8888 端口
2. 配置浏览器使用 Charles 作为代理（或安装 Charles 的 CA 证书来抓取 HTTPS）
3. 在 Charles 中可以看到所有 HTTP 请求

Charles 的常用功能：
- **Breakpoints**：对特定请求设置断点，修改请求或响应
- **Map Remote**：把请求重定向到不同的服务器
- **Map Local**：用本地文件替代服务器响应
- **Throttle**：模拟慢网络
- **Rewrite**：自动修改请求/响应的头部或内容

### Fiddler 基本用法

Fiddler 是 Windows 上的 HTTP 调试代理，功能类似 Charles。

1. 启动 Fiddler，它会自动配置系统代理
2. 在 Fiddler 中可以看到所有 HTTP 请求
3. 用 Fiddler Script 可以自定义修改请求和响应

## 选择哪个工具

| 场景 | 推荐工具 |
|------|----------|
| 命令行快速测试 | curl |
| 命令行 + 格式化 JSON | httpie |
| 分析浏览器行为 | Charles/Fiddler |
| 网络层分析 | Wireshark |
| API 开发测试 | Postman/Insomnia |
| 自动化测试 | curl + shell 脚本 |

## 用 Node.js 实现一个简单的 HTTP 调试代理

```js
const http = require('http')
const https = require('https')
const url = require('url')

const proxy = http.createServer((req, res) => {
  const target = url.parse(req.url)

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  console.log('请求头:', JSON.stringify(req.headers, null, 2))

  const options = {
    hostname: target.hostname,
    port: target.port || 80,
    path: target.path,
    method: req.method,
    headers: req.headers
  }

  const proxyReq = http.request(options, (proxyRes) => {
    console.log(`响应: ${proxyRes.statusCode}`)
    console.log('响应头:', JSON.stringify(proxyRes.headers, null, 2))

    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    console.error('代理错误:', err.message)
    res.writeHead(502)
    res.end('Bad Gateway')
  })

  req.pipe(proxyReq)
})

proxy.listen(8888, () => {
  console.log('代理服务器监听 :8888')
  console.log('使用方式: curl -x http://localhost:8888 https://example.com')
})
```

## 工程启发

1. **工具是手段，理解是目的**。curl 的每个选项背后都有 HTTP 协议的对应概念。理解了协议，工具的选项就自然记住了。
2. **不同工具有不同的视角**。curl 看的是单个请求，Wireshark 看的是网络层，Charles 看的是浏览器行为。排查复杂问题时，需要结合多个工具的视角。
3. **自动化很重要**。对于重复的排查工作，写成脚本比手动操作更可靠。

## 练习

### 练习一：用 curl 测量请求各阶段的时间

用 curl 的 `-w` 选项测量以下时间：
- DNS 解析时间
- TCP 连接时间
- TLS 握手时间
- 首字节时间（TTFB）
- 总时间

分别测试 HTTP 和 HTTPS，对比差异。

### 练习二：用 httpie 完成一个完整的 API 测试流程

用 httpie 完成：
1. 创建一个资源（POST）
2. 获取资源列表（GET）
3. 更新资源（PUT）
4. 删除资源（DELETE）

---

## 参考答案

### 练习一

```bash
curl -o /dev/null -s -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" https://example.com

curl -o /dev/null -s -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" http://example.com
```

**预期差异**：HTTPS 比 HTTP 多了 TLS 握手时间（`time_appconnect - time_connect`）。在本地网络上差异很小，在远程网络上可能有 100-200ms。

### 练习二

```bash
# 创建
http POST https://api.example.com/users name=john email=john@example.com

# 获取列表
http GET https://api.example.com/users

# 更新
http PUT https://api.example.com/users/1 name=john-updated email=john-new@example.com

# 删除
http DELETE https://api.example.com/users/1
```

**注意**：httpie 的 `key=value` 语法会自动设置 `Content-Type: application/json`。如果需要其他 Content-Type，用 `--form`（form-data）或手动指定。
