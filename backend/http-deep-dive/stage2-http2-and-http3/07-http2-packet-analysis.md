# 从抓包看 HTTP/2——帧格式、流优先级、RST_STREAM

## 抓包是理解协议的唯一捷径

上一节讲了 HTTP/2 的设计动机和概念，但这还不够。你需要亲眼看到 HTTP/2 在网络线上的样子——帧是怎么组织的，流是怎么复用的，错误是怎么处理的。

这节课我们用 Wireshark 来抓包分析 HTTP/2 的帧格式。这是理解协议最直接的方式。

## 准备工作

HTTP/2 通常跑在 TLS 上（即 h2），这意味着你需要让 Wireshark 能解密 TLS 流量。有两种方式：

**方式一：用 SSLKEYLOGFILE 环境变量**

Chrome 和 Firefox 都支持把 TLS 会话密钥写入文件。设置环境变量：

```bash
# Windows
set SSLKEYLOGFILE=%USERPROFILE%\sslkeys.log

# macOS/Linux
export SSLKEYLOGFILE=~/sslkeys.log
```

然后在 Wireshark 中配置：Edit → Preferences → Protocols → TLS → (Pre)-Master-Secret log filename 指向这个文件。

**方式二：用明文 HTTP/2（h2c）**

如果你只是做本地实验，可以直接用明文 HTTP/2，不需要 TLS。Node.js 支持 h2c：

```js
const http2 = require('http2')

const server = http2.createServer()
server.on('stream', (stream, headers) => {
  stream.respond({ ':status': 200 })
  stream.end('Hello HTTP/2')
})

server.listen(3000, () => console.log('h2c 服务器监听 :3000'))
```

用 Wireshark 捕获 localhost:3000 的流量，就能直接看到 HTTP/2 的帧。

## 帧结构详解

在 Wireshark 中找到 HTTP/2 帧，展开详情。一个典型的连接建立过程：

### 连接前奏（Connection Preface）

客户端发送的前 24 字节是固定的：

```
505249202a20485454502f322e300d0a0d0a534d0d0a0d0a
```

这是字面量 `PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n`，用于在 TCP 连接上区分 HTTP/1.1 和 HTTP/2。

### SETTINGS 帧

连接建立后，双方交换 SETTINGS 帧，告诉对方自己的配置：

```
SETTINGS 帧:
  Type: 4 (SETTINGS)
  Flags: 0x00
  Stream ID: 0 (连接级)
  Settings:
    SETTINGS_HEADER_TABLE_SIZE: 4096
    SETTINGS_MAX_CONCURRENT_STREAMS: 100
    SETTINGS_INITIAL_WINDOW_SIZE: 65535
    SETTINGS_MAX_FRAME_SIZE: 16384
```

这些参数决定了：
- 头部压缩表的大小
- 最多同时有多少个流
- 每个流的初始窗口大小（流控）
- 单个帧的最大载荷

每个 SETTINGS 帧需要对方用 SETTINGS ACK 确认。

### HEADERS 帧

客户端发请求时，先发一个 HEADERS 帧，里面是 HPACK 编码的请求头部：

```
HEADERS 帧:
  Type: 1 (HEADERS)
  Flags: 0x04 (END_HEADERS)
  Stream ID: 1
  Header Block Fragment:
    :method: GET
    :path: /
    :scheme: http
    :authority: localhost:3000
    accept: */*
    user-agent: curl/8.1.2
```

注意 HTTP/2 的头部用伪头部（pseudo-header）表示，以冒号开头：
- `:method` 对应 HTTP/1.1 的请求方法
- `:path` 对应请求路径
- `:scheme` 对应协议方案（http/https）
- `:authority` 对应 HTTP/1.1 的 Host 头部

### DATA 帧

如果请求或响应有正文，用 DATA 帧传输：

```
DATA 帧:
  Type: 0 (DATA)
  Flags: 0x01 (END_STREAM)
  Stream ID: 1
  Length: 11
  Data: Hello HTTP/2
```

`END_STREAM` 标志表示这个流的数据发完了。

## 流优先级

HTTP/2 允许客户端指定流的优先级。比如浏览器请求一个 HTML 页面，其中包含 CSS 和 JS。CSS 应该优先于 JS 加载（因为 CSS 阻塞渲染），JS 应该优先于图片加载。

优先级通过 HEADERS 帧中的 `PRIORITY` 信息或单独的 PRIORITY 帧来设置：

```
PRIORITY 帧:
  Type: 2 (PRIORITY)
  Stream ID: 3
  Weight: 256 (默认 16，范围 1-256)
  Stream Dependency: 0 (根流)
  Exclusive: false
```

权重越高，分配到的带宽越多。流依赖表示"这个流依赖于那个流完成"。

但优先级在实践中效果不好。浏览器的优先级策略各不相同，服务器也经常忽略客户端的优先级建议。RFC 9113 也承认优先级机制不够完善，引入了新的优先级方案（RFC 9218）。

## RST_STREAM：终止一个流

在 HTTP/1.1 中，如果要取消一个请求，只能关闭整个 TCP 连接。HTTP/2 可以用 RST_STREAM 帧只终止一个流，不影响其他流：

```
RST_STREAM 帧:
  Type: 3 (RST_STREAM)
  Stream ID: 1
  Error Code: CANCEL (0x8)
```

常见的错误码：
- `NO_ERROR (0x0)`：正常终止
- `PROTOCOL_ERROR (0x1)`：协议错误
- `INTERNAL_ERROR (0x2)`：内部错误
- `FLOW_CONTROL_ERROR (0x3)`：流控错误
- `STREAM_CLOSED (0x5)`：流已关闭
- `CANCEL (0x8)`：取消

在 Node.js 中，客户端取消请求时会触发 RST_STREAM：

```js
const http2 = require('http2')

const client = http2.connect('http://localhost:3000')
const req = client.request({ ':path': '/slow' })

req.on('response', (headers) => {
  console.log('状态码:', headers[':status'])
})

// 50ms 后取消请求
setTimeout(() => {
  req.close(http2.constants.NGHTTP2_CANCEL)
}, 50)

req.on('close', () => {
  console.log('流已关闭')
  client.close()
})
```

服务端收到 RST_STREAM 后，应该停止处理这个流并释放资源。

## 用 Node.js 观察帧事件

Node.js 的 HTTP/2 模块提供了底层的帧事件：

```js
const http2 = require('http2')

const server = http2.createServer()

server.on('stream', (stream, headers) => {
  console.log('新流:', stream.id, headers[':method'], headers[':path'])

  stream.on('close', () => {
    console.log('流关闭:', stream.id)
  })

  if (headers[':path'] === '/slow') {
    // 模拟慢响应
    setTimeout(() => {
      stream.respond({ ':status': 200 })
      stream.end('slow response')
    }, 5000)
  } else {
    stream.respond({ ':status': 200 })
    stream.end('fast response')
  }
})

server.on('session', (session) => {
  session.on('remoteSettings', (settings) => {
    console.log('客户端 SETTINGS:', settings)
  })
})

server.listen(3000, () => console.log('监听 :3000'))
```

测试 RST_STREAM：

```bash
# curl 会在超时后取消请求，触发 RST_STREAM
curl --http2-prior-knowledge --max-time 1 http://localhost:3000/slow
```

## 流量控制

HTTP/2 在连接级和流级都有流量控制。每个流有一个窗口大小（默认 65535 字节），发送方不能发送超过窗口大小的数据。

当接收方消费了数据后，发送 WINDOW_UPDATE 帧来增加窗口：

```
WINDOW_UPDATE 帧:
  Type: 8 (WINDOW_UPDATE)
  Stream ID: 0 (连接级)
  Window Size Increment: 1000
```

这个机制防止了快发送方压垮慢接收方。但在实际应用中，默认窗口大小往往太小，导致高延迟连接上吞吐量受限。建议在连接建立时通过 SETTINGS 帧调大初始窗口。

## 工程启发

1. **帧是 HTTP/2 的基本单位**。理解帧类型和标志位，你就能读懂 Wireshark 中的 HTTP/2 流量。
2. **RST_STREAM 是 HTTP/2 的杀手特性之一**。它让取消请求不再需要关闭连接，这对长连接场景（如 gRPC）非常重要。
3. **流量控制需要调优**。默认的窗口大小在高延迟网络上会成为瓶颈。生产环境中应该把 `SETTINGS_INITIAL_WINDOW_SIZE` 调大。

## 练习

### 练习一：用 Wireshark 解码 HTTP/2 帧

1. 创建一个 h2c 服务器
2. 用 curl 发一个带请求体的 POST 请求
3. 在 Wireshark 中找到 HEADERS 帧和 DATA 帧
4. 记录每个帧的 Type、Flags、Stream ID

### 练习二：模拟流取消

用 Node.js 客户端创建一个请求，在收到响应前取消它。用 Wireshark 验证 RST_STREAM 帧被发送。

---

## 参考答案

### 练习一

**预期观察**：
- HEADERS 帧：Type=1, Flags=0x04 (END_HEADERS), Stream ID=1
- DATA 帧（请求体）：Type=0, Flags=0x01 (END_STREAM), Stream ID=1
- HEADERS 帧（响应头）：Type=1, Flags=0x04, Stream ID=1
- DATA 帧（响应体）：Type=0, Flags=0x01, Stream ID=1

如果请求体较大，会被拆成多个 DATA 帧，每个帧最大 16384 字节。

### 练习二

**思路**：客户端创建请求后立即关闭流。

```js
const http2 = require('http2')

const client = http2.connect('http://localhost:3000')
const req = client.request({ ':path': '/slow' })

req.on('response', () => {
  console.log('收到响应（不应该到达这里）')
})

// 立即取消
req.close(http2.constants.NGHTTP2_CANCEL)

req.on('close', () => {
  console.log('流已取消')
  client.close()
})
```

在 Wireshark 中应该看到一个 RST_STREAM 帧，Error Code 为 CANCEL (0x8)。注意这个 RST_STREAM 只影响 Stream ID 1，连接本身和其他流不受影响。
