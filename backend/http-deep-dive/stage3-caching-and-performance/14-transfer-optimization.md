# 传输优化——gzip/brotli 压缩、分块传输、SSE

## 压缩是最容易落地的性能优化

你可能听过很多性能优化的建议：代码分割、懒加载、预渲染……这些都需要改代码。但有一个优化几乎零成本，只需要配置一下服务器：压缩。

HTTP 响应体通常是文本（HTML、CSS、JS、JSON），文本内容有很高的压缩比。gzip 通常能压缩到原来的 20-30%，Brotli 能压缩到 15-25%。这意味着传输量减少 70-80%，页面加载时间显著缩短。

## gzip 压缩

gzip 是最广泛支持的压缩算法。客户端在请求时通过 `Accept-Encoding: gzip` 告诉服务器自己支持 gzip，服务器在响应中通过 `Content-Encoding: gzip` 告诉客户端响应体是 gzip 压缩的。

用 curl 测试：

```bash
# 不压缩
curl -s https://example.com | wc -c

# gzip 压缩
curl -s -H "Accept-Encoding: gzip" https://example.com --compressed | wc -c
```

`--compressed` 选项让 curl 自动解压 gzip 响应。

## Brotli 压缩

Brotli 是 Google 开发的压缩算法，比 gzip 好 10-20%。现代浏览器都支持 Brotli（通过 `Accept-Encoding: br`）。

但 Brotli 有一个特点：压缩速度比 gzip 慢，特别是最高压缩级别（11）。所以通常的做法是：
- 静态资源在构建时用 Brotli 预压缩（离线压缩，不关心速度）
- 动态响应用 gzip（在线压缩，速度更重要）

用 Node.js 测试压缩效果：

```js
const zlib = require('zlib')

const html = `
<!DOCTYPE html>
<html>
<head>
  <title>测试页面</title>
  <link rel="stylesheet" href="/style.css">
  <script src="/app.js"></script>
</head>
<body>
  <h1>Hello World</h1>
  <p>这是一个用于测试压缩效果的页面。重复内容可以提高压缩比。</p>
  <p>这是一个用于测试压缩效果的页面。重复内容可以提高压缩比。</p>
  <p>这是一个用于测试压缩效果的页面。重复内容可以提高压缩比。</p>
</body>
</html>
`.repeat(10)

const original = Buffer.byteLength(html)
console.log(`原始大小: ${original} 字节`)

zlib.gzip(html, (err, gzipResult) => {
  console.log(`gzip: ${gzipResult.length} 字节 (${(gzipResult.length / original * 100).toFixed(1)}%)`)
})

zlib.brotliCompress(html, (err, brResult) => {
  console.log(`brotli: ${brResult.length} 字节 (${(brResult.length / original * 100).toFixed(1)}%)`)
})
```

## 分块传输（Chunked Transfer-Encoding）

当服务器不知道响应总长度时（比如在动态生成内容），可以用分块传输：

```js
const http = require('http')

const server = http.createServer((req, res) => {
  if (req.url === '/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked'
    })

    // 分块发送
    let count = 0
    const interval = setInterval(() => {
      count++
      if (count > 10) {
        res.end()  // 发送 0 长度的块，表示结束
        clearInterval(interval)
        return
      }
      res.write(`数据块 ${count}\n`)
    }, 100)
  }
})

server.listen(3000, () => console.log('监听 :3000'))
```

测试：

```bash
curl -N http://localhost:3000/stream
```

`-N` 选项禁用 curl 的缓冲，让你实时看到每个数据块到达。

分块传输的格式：

```
HTTP/1.1 200 OK
Transfer-Encoding: chunked

5\r\n
Hello\r\n
6\r\n
 World\r\n
0\r\n
\r\n
```

每块前面是十六进制的长度，`\r\n` 是分隔符，最后是长度为 0 的块表示结束。

## Server-Sent Events (SSE)

SSE 是基于 HTTP 的单向服务器推送技术。服务器通过 `Content-Type: text/event-stream` 告诉客户端"这是一个事件流"，然后持续发送事件。

SSE 的格式：

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: message
data: {"time": "2024-01-01T00:00:00Z"}

event: update
data: {"count": 42}

data: 没有事件名的消息

```

每个事件以空行分隔。`data` 是消息内容，`event` 是事件类型（可选），`id` 是事件 ID（用于断线重连），`retry` 是重连间隔（毫秒）。

用 Node.js 实现 SSE：

```js
const http = require('http')

const server = http.createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    })

    let id = 0
    const interval = setInterval(() => {
      id++
      const data = JSON.stringify({ time: new Date().toISOString(), id })
      res.write(`id: ${id}\nevent: message\ndata: ${data}\n\n`)
    }, 1000)

    req.on('close', () => {
      clearInterval(interval)
    })
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`
      <html>
      <body>
        <div id="output"></div>
        <script>
          const source = new EventSource('/events')
          source.onmessage = (e) => {
            const data = JSON.parse(e.data)
            document.getElementById('output').innerHTML += '<p>' + data.time + '</p>'
          }
        </script>
      </body>
      </html>
    `)
  }
})

server.listen(3000, () => console.log('监听 :3000'))
```

SSE 的优点：
- 基于纯 HTTP，不需要 WebSocket 那样的协议升级
- 自动重连（浏览器内置支持）
- 支持事件类型和事件 ID

缺点：
- 只能服务器向客户端推送（单向）
- 有最大并发连接数限制（浏览器对同一域名的连接数限制）
- 不支持二进制数据（需要 Base64 编码）

## 压缩和分块传输的组合

当同时使用压缩和分块传输时，顺序很重要：

```
原始数据 → 压缩 → 分块传输
```

也就是说，先压缩整个响应，再分块发送压缩后的数据。不能先分块再压缩（因为压缩算法需要看到完整的数据才能达到好的压缩比）。

但有一种例外：如果用 gzip 的流式压缩模式，可以边压缩边发送。Node.js 的 `zlib.createGzip()` 就支持这种模式：

```js
const zlib = require('zlib')

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Content-Encoding': 'gzip',
    'Transfer-Encoding': 'chunked'
  })

  const gzip = zlib.createGzip()
  gzip.pipe(res)

  // 分块写入数据
  let count = 0
  const interval = setInterval(() => {
    count++
    if (count > 10) {
      gzip.end()
      clearInterval(interval)
      return
    }
    gzip.write(`数据块 ${count}\n`)
  }, 100)
})
```

## 工程启发

1. **压缩是性价比最高的优化**。对文本内容启用 gzip/Brotli，传输量减少 70-80%，几乎零成本。所有生产环境的 HTTP 服务器都应该启用压缩。
2. **SSE 比 WebSocket 简单得多**。如果你只需要服务器向客户端推送数据（如实时日志、股票行情），SSE 是更好的选择。WebSocket 适合需要双向通信的场景（如聊天、协作编辑）。
3. **分块传输适合流式响应**。当响应体很大或需要动态生成时，分块传输可以减少首字节时间（TTFB）。

## 练习

### 练习一：对比不同压缩算法的效果

用 Node.js 的 `zlib` 模块，分别用 gzip（级别 1 和 9）和 Brotli（级别 1 和 11）压缩一个 HTML 文件，对比压缩率和压缩时间。

### 练习二：实现一个实时日志流

用 SSE 实现一个实时日志流：
- 服务器每秒生成一条日志（带时间戳和级别）
- 客户端用 EventSource 接收并显示
- 支持断线自动重连

---

## 参考答案

### 练习一

**思路**：用 `process.hrtime.bigint()` 测量压缩时间。

```js
const zlib = require('zlib')
const fs = require('fs')

const content = fs.readFileSync('large.html', 'utf-8')
console.log(`原始大小: ${Buffer.byteLength(content)} 字节\n`)

const tests = [
  { name: 'gzip-1', fn: (cb) => zlib.gzip(content, { level: 1 }, cb) },
  { name: 'gzip-9', fn: (cb) => zlib.gzip(content, { level: 9 }, cb) },
  { name: 'brotli-1', fn: (cb) => zlib.brotliCompress(content, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1 } }, cb) },
  { name: 'brotli-11', fn: (cb) => zlib.brotliCompress(content, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }, cb) }
]

tests.forEach(({ name, fn }) => {
  const start = process.hrtime.bigint()
  fn((err, result) => {
    const time = Number(process.hrtime.bigint() - start) / 1e6
    const ratio = (result.length / Buffer.byteLength(content) * 100).toFixed(1)
    console.log(`${name}: ${result.length} 字节 (${ratio}%), ${time.toFixed(1)}ms`)
  })
})
```

**预期结果**：
- gzip-1 压缩率约 25-30%，速度最快
- gzip-9 压缩率约 20-25%，速度较慢
- brotli-1 压缩率约 22-27%，速度与 gzip-1 相近
- brotli-11 压缩率约 15-20%，速度最慢（可能比 gzip-9 慢 10 倍）

### 练习二

```js
const http = require('http')

const LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG']
const MESSAGES = ['请求处理完成', '数据库连接慢', '缓存命中', '用户登录', '文件上传成功']

const server = http.createServer((req, res) => {
  if (req.url === '/logs') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })

    let id = 0
    const interval = setInterval(() => {
      id++
      const log = {
        id,
        time: new Date().toISOString(),
        level: LEVELS[Math.floor(Math.random() * LEVELS.length)],
        message: MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
      }
      res.write(`id: ${id}\nevent: log\ndata: ${JSON.stringify(log)}\n\n`)
    }, 1000)

    req.on('close', () => clearInterval(interval))
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`
      <html><body>
        <div id="logs" style="font-family: monospace;"></div>
        <script>
          const source = new EventSource('/logs')
          source.addEventListener('log', (e) => {
            const log = JSON.parse(e.data)
            const div = document.getElementById('logs')
            div.innerHTML = '<p>[' + log.time + '] ' + log.level + ': ' + log.message + '</p>' + div.innerHTML
          })
        </script>
      </body></html>
    `)
  }
})

server.listen(3000, () => console.log('监听 :3000'))
```

测试时可以在浏览器中打开 `http://localhost:3000`，然后断开网络再恢复，观察 EventSource 是否自动重连。
