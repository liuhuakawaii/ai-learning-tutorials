# HTTP 报文解剖——请求行、头部、正文的二进制真相

## 这节课解决什么问题

你每天写 `fetch('/api/users')` 或者用 Postman 发请求，但你有没有想过：这个请求在网络线上到底长什么样？服务器收到的字节流是怎么被拆解成"方法、路径、头部、正文"这几个部分的？

很多人对 HTTP 的理解停留在"GET 请求、POST 请求、200 成功、404 找不到"。这够用吗？日常开发够。但遇到以下场景就不够了：

- 为什么 curl 发的请求能成功，浏览器发的就 403？
- 为什么请求体明明有数据，服务端却收到空的？
- 为什么抓包看到的头部顺序跟代码里写的不一样？

这些问题的根源都在报文结构本身。

## 用 Wireshark 看一个真实请求

先装好 Wireshark，打开它，选择你正在用的网卡（通常是 Wi-Fi 或以太网），开始捕获。

然后用 curl 发一个最简单的请求：

```bash
curl -v http://httpbin.org/get
```

`-v` 会把请求和响应的头部打印出来。你会看到类似这样的输出：

```
> GET /get HTTP/1.1
> Host: httpbin.org
> User-Agent: curl/8.1.2
> Accept: */*
>
< HTTP/1.1 200 OK
< Content-Type: application/json
< Content-Length: 256
```

这看起来像纯文本，实际上它就是纯文本。HTTP/1.1 的报文就是 ASCII 文本，用 `\r\n`（CRLF）做行分隔。

但 Wireshark 能给你更底层的视角——它会展示 TCP 层的字节流，让你看到这些文本是怎么被切成 TCP 段的。

## 请求报文的三段结构

一个 HTTP 请求报文由三部分组成，用空行分隔：

```
请求行\r\n          ← 第一段：方法 + 路径 + 版本
头部字段\r\n        ← 第二段：Key: Value 形式的元数据
\r\n                ← 空行：头部结束的标记
请求正文            ← 第三段：可选的 body
```

拆开来看：

**请求行**是第一行，格式固定：

```
GET /api/users?page=1 HTTP/1.1
```

三个部分用空格分隔：方法、请求目标（路径 + 查询字符串）、HTTP 版本。注意请求目标可以是完整 URL（代理请求）或绝对路径（普通请求），但不能只有路径没有斜杠。

**头部字段**是从第二行开始到空行为止的每一行。每行一个字段，格式是 `字段名: 值`。字段名不区分大小写（RFC 9110 明确规定），但习惯上用首字母大写的连字符格式（如 `Content-Type`）。

这里有个容易忽略的细节：头部字段的顺序在 HTTP/1.1 中没有规定。服务器收到的顺序就是客户端发送的顺序。但有些代理服务器会重排头部，所以不要依赖头部顺序来做逻辑判断。

**空行**是 `\r\n\r\n`——两个连续的 CRLF。它告诉解析器"头部结束了，后面是正文"。这个分隔机制很重要，因为 HTTP 是基于文本行的协议，解析器需要一个明确的边界标记。

**请求正文**是空行之后的所有内容。GET 请求通常没有正文，POST/PUT/PATCH 请求才有。正文的长度由 `Content-Length` 头部指定，或者用 `Transfer-Encoding: chunked` 做分块传输。

## 用 Node.js 手动解析报文

理解报文结构最好的方式是自己解析它。写一个最原始的 TCP 服务器，不做任何 HTTP 框架的封装：

```js
const net = require('net')

const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    const raw = data.toString()
    console.log('--- 原始报文 ---')
    console.log(raw)
    console.log('--- 结束 ---')

    const [headerPart, body] = raw.split('\r\n\r\n')
    const lines = headerPart.split('\r\n')
    const [method, path, version] = lines[0].split(' ')

    const headers = {}
    for (let i = 1; i < lines.length; i++) {
      const [key, ...rest] = lines[i].split(':')
      headers[key.trim().toLowerCase()] = rest.join(':').trim()
    }

    console.log('方法:', method)
    console.log('路径:', path)
    console.log('版本:', version)
    console.log('头部:', headers)
    console.log('正文:', body || '(无)')

    socket.end('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK')
  })
})

server.listen(3000, () => {
  console.log('监听 :3000')
})
```

启动后用 curl 发请求：

```bash
curl -X POST http://localhost:3000/test -H "X-Custom: hello" -d '{"name":"test"}'
```

你会在 Node.js 控制台看到完整的原始报文，包括请求行、每个头部、空行、正文。

这个实验揭示了几个事实：

1. HTTP 真的就是文本协议（HTTP/1.1），解析它不需要特殊的二进制解码器
2. 头部字段可以有任意多个同名字段（比如多个 `Set-Cookie`），解析时要注意
3. `Content-Length` 如果跟实际正文长度不一致，行为是未定义的——服务端应该返回 400

## 一个容易踩的坑：请求体读取不完整

很多人在 Node.js 中手写 HTTP 服务器时遇到过这个问题：`data` 事件收到的数据不完整，请求体被截断了。

原因是 TCP 是流式协议，一次 `data` 事件不等于一个完整的 HTTP 请求。一个请求可能被拆成多个 TCP 段到达，或者多个请求被合并成一次 `data` 事件。

正确的做法是先读取头部，从 `Content-Length` 知道正文有多长，然后持续读取直到收够字节数。这就是为什么你在生产环境中不应该手写 HTTP 解析器——用框架，它们处理了这些边界情况。

但理解这个机制很重要，因为它解释了为什么有时候 `req.body` 是空的：不是框架有 bug，是你没有正确设置 `Content-Length` 或 `Content-Type`，框架不知道怎么解析正文。

## 响应报文结构

响应报文的结构跟请求几乎一样，只是第一行不同：

```
HTTP/1.1 200 OK\r\n        ← 状态行：版本 + 状态码 + 原因短语
Content-Type: text/html\r\n
Content-Length: 128\r\n
\r\n
<html>...</html>           ← 响应正文
```

状态行的格式是 `HTTP/版本 状态码 原因短语`。原因短语（Reason Phrase）在 HTTP/1.1 中是纯文本描述，比如 `200 OK`、`404 Not Found`。但在 HTTP/2 中，原因短语被去掉了——因为它跟状态码是重复信息，浪费带宽。

## 工程启发

1. **头部是元数据，不是数据本身**。不要把业务逻辑塞进自定义头部里，除非你有充分的理由（比如分布式追踪的 trace-id）。
2. **空行是分隔符**。如果你在做代理或网关，解析报文时一定要正确处理空行，否则会把头部当正文或反过来。
3. **HTTP/1.1 的文本协议有代价**。头部是未压缩的纯文本，重复发送相同头部会浪费带宽。这是 HTTP/2 引入头部压缩（HPACK）的直接原因。

## 练习

### 练习一：手动构造一个 HTTP 请求

用 Node.js 的 `net` 模块（不是 `http` 模块）创建一个 TCP 连接，手动拼装一个完整的 HTTP 请求报文发送到 `httpbin.org:80`，并解析响应。

要求：
- 请求行用 `GET /get HTTP/1.1`
- 至少包含 `Host`、`User-Agent`、`Accept` 三个头部
- 手动拼接 `\r\n` 分隔符
- 从 TCP 响应中提取状态码和响应正文

### 练习二：观察 Content-Length 不匹配的行为

用 Node.js 的 `net` 模块创建一个服务器，返回一个 `Content-Length: 100` 但实际正文只有 10 字节的响应。用 curl 和浏览器分别请求这个端点，观察它们的行为差异。

---

## 参考答案

### 练习一

**思路**：用 `net.createConnection` 建立 TCP 连接，手动拼装报文字符串，注意 CRLF 的使用。

```js
const net = require('net')

const request = [
  'GET /get HTTP/1.1',
  'Host: httpbin.org',
  'User-Agent: node-tcp-client',
  'Accept: application/json',
  '',  // 空行标记头部结束
  ''   // 无正文，但需要 CRLF 结尾
].join('\r\n')

const client = net.createConnection(80, 'httpbin.org', () => {
  client.write(request)
})

let responseData = ''
client.on('data', (chunk) => {
  responseData += chunk.toString()
})

client.on('end', () => {
  const [headerPart, body] = responseData.split('\r\n\r\n')
  const statusLine = headerPart.split('\r\n')[0]
  console.log('状态行:', statusLine)
  console.log('正文:', body.substring(0, 200))
})
```

**常见错误**：
- 忘记最后的空行（`\r\n\r\n`），导致服务器一直等待头部结束
- `Host` 头部写成小写 `host`——虽然规范不区分大小写，但某些服务器会拒绝
- 把 `\n` 当行分隔符而不是 `\r\n`

### 练习二

**思路**：`Content-Length` 声明的长度大于实际发送的正文长度时，客户端会一直等待直到超时。

```js
const net = require('net')

const server = net.createServer((socket) => {
  socket.on('data', () => {
    const body = 'short'  // 5 字节
    const response = [
      'HTTP/1.1 200 OK',
      'Content-Length: 100',  // 声明 100 字节
      '',
      body
    ].join('\r\n')
    socket.write(response)
    // 注意：不调用 socket.end()，让客户端自己超时
  })
})

server.listen(3001, () => console.log('监听 :3001'))
```

用 `curl http://localhost:3001` 请求，curl 会等待剩余的 95 字节到达，最终超时。用浏览器请求，浏览器通常会在几秒后中断连接并显示不完整的页面。

这说明 `Content-Length` 是一个契约——如果声明了就必须满足，否则行为不可预测。
