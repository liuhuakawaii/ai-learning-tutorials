# HTTP/2 为什么快——多路复用、头部压缩、服务器推送

## 从一个反直觉的现象开始

你可能听过"HTTP/2 比 HTTP/1.1 快"，但快在哪里？如果只是版本号更高就更快，那 HTTP/3 应该更快，HTTP/4 应该更快……这不是版本号竞赛。

HTTP/2 解决的是 HTTP/1.1 的三个具体问题。理解这三个问题，你就理解了 HTTP/2 的全部设计动机。

## 问题一：队头阻塞

上一阶段我们讲过，HTTP/1.1 在同一个连接上必须按顺序处理请求。请求 A 慢了，后面的请求都得等。

HTTP/2 的解决方案是**多路复用**（Multiplexing）：在同一个 TCP 连接上，多个请求和响应可以同时传输，互不阻塞。

这怎么做到的？HTTP/2 把请求和响应拆成了一个个**帧**（Frame），每个帧有一个**流 ID**（Stream ID）。不同流的帧可以交错发送，接收方根据流 ID 重新组装。

打个比方：HTTP/1.1 像单车道公路，前车不动后车就得等。HTTP/2 像多车道公路，不同车道的车可以同时通行。

用 curl 观察 HTTP/2 的帧：

```bash
curl -v --http2 https://example.com 2>&1 | grep -i "HTTP/2"
```

如果服务器支持 HTTP/2，你会看到 `* Using HTTP/2`。

## 问题二：头部冗余

HTTP/1.1 的头部是纯文本，每次请求都要重复发送。一个典型的请求头：

```
GET /api/users HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Accept-Encoding: gzip, deflate, br
Cookie: session_id=abc123; theme=dark; lang=zh-CN
Connection: keep-alive
```

这些头部加起来可能有 500-800 字节。如果一个页面有 50 个请求，光头部就要传 25-40KB。而且这些请求的大部分头部都是相同的（Host、User-Agent、Cookie 等）。

HTTP/2 的解决方案是 **HPACK 头部压缩**：

1. 维护一个头部字段表（静态表 + 动态表）
2. 常见的头部字段（如 `:method: GET`、`:scheme: https`）用一个索引号表示
3. 重复的头部字段只在第一次发送完整值，后续只发送索引号
4. 值可以用霍夫曼编码压缩

HPACK 能把头部压缩到原来的 10-20%。

## 问题三：一个连接不够用

HTTP/1.1 的解决方案是开多个 TCP 连接（浏览器通常开 6 个）。但每个连接都要独立做 TCP 慢启动、独立维护拥塞窗口，资源利用率不高。

HTTP/2 只用一个 TCP 连接，通过多路复用在同一连接上并发所有请求。这样 TCP 的拥塞窗口可以被所有请求共享，启动更快，利用率更高。

## HTTP/2 的帧格式

HTTP/2 的基本单位是帧（Frame），每个帧有一个固定 9 字节的帧头：

```
+-----------------------------------------------+
|                 Length (24)                    |
+---------------+---------------+---------------+
|   Type (8)    |   Flags (8)   |
+-+-------------+---------------+---------------+
|R|                 Stream Identifier (31)      |
+=+=============================================+
|                   Frame Payload               |
+-----------------------------------------------+
```

- Length：帧载荷的长度（最大 16384 字节，即 16KB）
- Type：帧类型（DATA、HEADERS、SETTINGS、RST_STREAM 等）
- Flags：标志位
- R：保留位，必须为 0
- Stream Identifier：流 ID

关键帧类型：

- `DATA`：传输请求或响应的正文
- `HEADERS`：传输请求或响应的头部（用 HPACK 编码）
- `SETTINGS`：连接级配置（如最大帧大小、最大并发流数）
- `RST_STREAM`：终止一个流（不需要关闭整个连接）
- `PUSH_PROMISE`：服务器推送

## 用 Node.js 创建 HTTP/2 服务器

Node.js 内置了 HTTP/2 支持：

```js
const http2 = require('http2')
const fs = require('fs')

const server = http2.createServer()

server.on('stream', (stream, headers) => {
  const path = headers[':path']
  const method = headers[':method']

  console.log(`HTTP/2 请求: ${method} ${path}`)

  if (path === '/') {
    stream.respond({ ':status': 200, 'content-type': 'text/html; charset=utf-8' })
    stream.end('<h1>HTTP/2 服务器</h1>')
  } else if (path === '/api/data') {
    stream.respond({ ':status': 200, 'content-type': 'application/json' })
    stream.end(JSON.stringify({ protocol: 'HTTP/2', streamId: stream.id }))
  } else {
    stream.respond({ ':status': 404 })
    stream.end('Not Found')
  }
})

server.listen(3000, () => {
  console.log('HTTP/2 服务器监听 :3000')
})
```

测试（注意 HTTP/2 通常需要 TLS，这里用明文 h2c 做测试）：

```bash
curl --http2-prior-knowledge http://localhost:3000/
```

## 服务器推送

HTTP/2 允许服务器在客户端请求之前就主动推送资源。比如客户端请求 HTML 页面，服务器知道页面需要 CSS 和 JS，就一起推送过去，不需要客户端再发请求。

```
客户端 → 服务器：GET /index.html
服务器 → 客户端：PUSH_PROMISE /style.css（先告诉客户端要推什么）
服务器 → 客户端：HEADERS + DATA /index.html（响应 HTML）
服务器 → 客户端：HEADERS + DATA /style.css（推送 CSS）
```

但服务器推送在实践中效果不好：

- 推送的资源客户端可能已经有缓存了（浪费带宽）
- 推送时机不好判断，可能抢占了主请求的带宽
- 浏览器对推送的支持和策略各不相同

Chrome 在 2022 年已经移除了对 HTTP/2 服务器推送的支持。现在更推荐用 `103 Early Hints` 来提示客户端预加载资源。

## 工程启发

1. **多路复用不是没有代价**。所有请求共享一个 TCP 连接，如果这个连接丢包了，所有流都会受影响（TCP 层面的队头阻塞）。这就是 HTTP/3 要用 UDP 替代 TCP 的原因之一。
2. **HPACK 需要维护状态**。客户端和服务器各自维护一个头部表，如果中间有代理修改了头部，表就不同步了。所以 HTTP/2 的代理必须正确处理 HPACK。
3. **HTTP/2 的性能提升主要在高延迟网络**。在本地或低延迟网络中，HTTP/1.1 和 HTTP/2 的差异不大。真正的差异出现在跨洋请求、移动网络等高延迟场景。

## 练习

### 练习一：对比 HTTP/1.1 和 HTTP/2 的头部大小

用 Wireshark 分别抓取 HTTP/1.1 和 HTTP/2 的请求，对比头部占用的字节数。记录：
- HTTP/1.1 的原始文本头部大小
- HTTP/2 的 HPACK 编码后头部大小
- 压缩率

### 练习二：用 Node.js 创建一个 HTTP/2 服务器，返回多个资源

创建一个 HTTP/2 服务器，当客户端请求 `/page` 时，返回一个 HTML 页面，同时通过服务器推送 `/style.css` 和 `/script.js`。

---

## 参考答案

### 练习一

**思路**：用 Wireshark 的 "Follow HTTP/2 Stream" 功能查看帧内容。

HTTP/1.1 的头部是纯文本，直接看字节数即可。HTTP/2 的 HPACK 编码后的头部在 HEADERS 帧中，Wireshark 会解码显示原始头部，但实际传输的字节数在帧的 Length 字段中。

对于典型的请求（Host + User-Agent + Accept + Cookie），HTTP/1.1 大约 400-800 字节，HTTP/2 HPACK 编码后大约 30-80 字节，压缩率 90%+。

### 练习二

**思路**：在 stream 事件中，除了响应请求的流，还可以通过 `stream.pushStream` 推送其他资源。

```js
const http2 = require('http2')

const server = http2.createServer()

server.on('stream', (stream, headers) => {
  if (headers[':path'] === '/page') {
    // 推送 CSS
    stream.pushStream({ ':path': '/style.css' }, (err, pushStream) => {
      if (err) return
      pushStream.respond({ ':status': 200, 'content-type': 'text/css' })
      pushStream.end('body { color: red; }')
    })

    // 推送 JS
    stream.pushStream({ ':path': '/script.js' }, (err, pushStream) => {
      if (err) return
      pushStream.respond({ ':status': 200, 'content-type': 'application/javascript' })
      pushStream.end('console.log("pushed")')
    })

    // 响应 HTML
    stream.respond({ ':status': 200, 'content-type': 'text/html; charset=utf-8' })
    stream.end('<link rel="stylesheet" href="/style.css"><script src="/script.js"></script><h1>Page</h1>')
  }
})

server.listen(3000, () => console.log('监听 :3000'))
```

**注意**：用 curl 测试时需要加 `--http2-prior-knowledge`，因为这是明文 HTTP/2。
