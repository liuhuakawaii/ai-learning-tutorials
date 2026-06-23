# 阶段实战：手写一个 HTTP/1.1 服务器并抓包验证

## 目标

这个阶段的实战任务是：用 Node.js 的 `net` 模块（不是 `http` 模块）手写一个 HTTP/1.1 服务器，然后用 Wireshark 和 curl 抓包验证它的行为。

为什么要手写？因为你每天用 Express、Koa、Fastify 这些框架，它们帮你处理了 HTTP 协议的所有细节。但如果你不理解这些细节，遇到问题时就只能靠 Google 搜错误信息。手写一遍之后，你会对 HTTP 的报文结构、连接管理、错误处理有直观的理解。

## 第一步：最简单的 TCP 服务器

先从一个能返回固定响应的 TCP 服务器开始：

```js
const net = require('net')

const server = net.createServer((socket) => {
  console.log('客户端连接')

  socket.on('data', (data) => {
    const request = data.toString()
    console.log('--- 收到请求 ---')
    console.log(request)
    console.log('--- 结束 ---')

    const response = [
      'HTTP/1.1 200 OK',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Length: 13',
      'Connection: keep-alive',
      '',
      'Hello, World!'
    ].join('\r\n')

    socket.write(response)
  })

  socket.on('close', () => {
    console.log('客户端断开')
  })
})

server.listen(3000, () => {
  console.log('服务器监听 :3000')
})
```

启动后用 curl 测试：

```bash
curl -v http://localhost:3000/
```

观察 curl 的输出：它会显示完整的请求头和响应头。这就是你的服务器在 HTTP 层面的真实表现。

## 第二步：解析请求并路由

现在让服务器能根据请求路径返回不同的内容：

```js
const net = require('net')

function parseRequest(data) {
  const raw = data.toString()
  const [headerPart, body] = raw.split('\r\n\r\n')
  const lines = headerPart.split('\r\n')
  const [method, fullPath, version] = lines[0].split(' ')

  const [path, ...queryParts] = fullPath.split('?')
  const query = queryParts.join('?')

  const headers = {}
  for (let i = 1; i < lines.length; i++) {
    const colonIndex = lines[i].indexOf(':')
    if (colonIndex === -1) continue
    const key = lines[i].substring(0, colonIndex).trim().toLowerCase()
    const value = lines[i].substring(colonIndex + 1).trim()
    headers[key] = value
  }

  return { method, path, query, version, headers, body }
}

function buildResponse(statusCode, statusText, headers, body) {
  const bodyBuffer = Buffer.from(body, 'utf-8')
  const headerLines = [
    `HTTP/1.1 ${statusCode} ${statusText}`,
    ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
    'Content-Length: ' + bodyBuffer.length,
    'Connection: keep-alive',
    ''
  ]
  return Buffer.concat([
    Buffer.from(headerLines.join('\r\n'), 'utf-8'),
    Buffer.from('\r\n', 'utf-8'),
    bodyBuffer
  ])
}

const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    const req = parseRequest(data)
    console.log(`${req.method} ${req.path}`)

    let response
    if (req.path === '/' && req.method === 'GET') {
      response = buildResponse(200, 'OK',
        { 'Content-Type': 'text/html; charset=utf-8' },
        '<h1>首页</h1><p><a href="/api/time">查看时间</a></p>'
      )
    } else if (req.path === '/api/time' && req.method === 'GET') {
      response = buildResponse(200, 'OK',
        { 'Content-Type': 'application/json; charset=utf-8' },
        JSON.stringify({ time: new Date().toISOString() })
      )
    } else if (req.path === '/api/echo' && req.method === 'POST') {
      response = buildResponse(200, 'OK',
        { 'Content-Type': 'application/json; charset=utf-8' },
        JSON.stringify({ received: req.body, headers: req.headers })
      )
    } else {
      response = buildResponse(404, 'Not Found',
        { 'Content-Type': 'text/plain; charset=utf-8' },
        '404 Not Found'
      )
    }

    socket.write(response)
  })
})

server.listen(3000, () => {
  console.log('服务器监听 :3000')
})
```

测试：

```bash
# 访问首页
curl http://localhost:3000/

# 获取时间
curl http://localhost:3000/api/time

# POST 请求
curl -X POST -d '{"hello":"world"}' -H "Content-Type: application/json" http://localhost:3000/api/echo

# 404
curl http://localhost:3000/notfound
```

## 第三步：处理 Keep-Alive

上面的代码有一个问题：它假设每次 `data` 事件都包含一个完整的 HTTP 请求。但在 Keep-Alive 连接上，可能收到多个请求的数据被合并在一起，或者一个请求被拆成多次 `data` 事件。

这是一个真实的工程问题。正确的做法是实现一个状态机：先读取头部，从 `Content-Length` 或 `Transfer-Encoding` 确定正文长度，然后读取正文，最后处理请求。

这里给出一个简化版本，只处理 `Content-Length` 的情况：

```js
const net = require('net')

function createParser(onRequest) {
  let buffer = Buffer.alloc(0)

  return function onData(chunk) {
    buffer = Buffer.concat([buffer, chunk])

    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) return  // 头部还没收完

      const headerPart = buffer.slice(0, headerEnd).toString()
      const lines = headerPart.split('\r\n')
      const [method, path, version] = lines[0].split(' ')

      const headers = {}
      for (let i = 1; i < lines.length; i++) {
        const colonIndex = lines[i].indexOf(':')
        if (colonIndex === -1) continue
        const key = lines[i].substring(0, colonIndex).trim().toLowerCase()
        const value = lines[i].substring(colonIndex + 1).trim()
        headers[key] = value
      }

      const contentLength = parseInt(headers['content-length'] || '0', 10)
      const bodyStart = headerEnd + 4
      const totalLength = bodyStart + contentLength

      if (buffer.length < totalLength) return  // 正文还没收完

      const body = buffer.slice(bodyStart, totalLength).toString()
      buffer = buffer.slice(totalLength)  // 保留剩余数据（下一个请求）

      onRequest({ method, path, version, headers, body })
    }
  }
}

const server = net.createServer((socket) => {
  const parse = createParser((req) => {
    console.log(`${req.method} ${req.path}`)

    const body = JSON.stringify({ path: req.path, method: req.method })
    const response = [
      'HTTP/1.1 200 OK',
      'Content-Type: application/json; charset=utf-8',
      `Content-Length: ${Buffer.byteLength(body)}`,
      'Connection: keep-alive',
      '',
      body
    ].join('\r\n')

    socket.write(response)
  })

  socket.on('data', parse)
})

server.listen(3000, () => {
  console.log('服务器监听 :3000')
})
```

测试 Keep-Alive：

```bash
# curl 默认对 HTTP/1.1 启用 Keep-Alive
curl -v http://localhost:3000/a http://localhost:3000/b
```

## 第四步：用 Wireshark 抓包

1. 打开 Wireshark，选择 Loopback 接口（因为服务器在 localhost）
2. 设置过滤器：`tcp.port == 3000`
3. 开始捕获
4. 用 curl 发请求：`curl -v http://localhost:3000/`
5. 在 Wireshark 中找到对应的 TCP 流（右键 → Follow → TCP Stream）

你会看到：
- TCP 三次握手（SYN → SYN-ACK → ACK）
- HTTP 请求报文（纯文本）
- HTTP 响应报文（纯文本）
- 如果是 Keep-Alive，连接会保持一段时间
- 最后是 TCP 四次挥手（FIN → ACK → FIN → ACK）

这就是 HTTP 在网络线上的真实样子。

## 验收清单

- [ ] 服务器能正确解析请求行（方法、路径、版本）
- [ ] 服务器能正确解析请求头部
- [ ] 服务器能正确处理 POST 请求体
- [ ] 服务器能返回不同状态码（200、404）
- [ ] 服务器能设置正确的 Content-Type 和 Content-Length
- [ ] 用 Wireshark 能看到完整的 TCP + HTTP 交互过程
- [ ] 理解了 Keep-Alive 连接上请求的边界问题

## 常见问题

**Q: 为什么不用 `http` 模块？**
A: `http` 模块帮你做了所有的协议解析。用 `net` 模块是为了让你亲手处理报文的边界、头部解析、正文读取这些细节。理解了这些，你才会真正明白框架在帮你做什么。

**Q: 为什么 Wireshark 抓不到 localhost 的包？**
A: Windows 上 localhost 走的是 loopback 接口，需要用 Wireshark 的 "Adapter for loopback traffic capture" 来捕获。如果没有这个选项，可以改用 `127.0.0.1` 或用 `curl` 的 `-v` 选项来观察。

**Q: 生产环境能用手写服务器吗？**
A: 不能。生产环境用框架（Express、Fastify 等），它们处理了安全、性能、边界情况等大量问题。手写只是为了理解原理。
