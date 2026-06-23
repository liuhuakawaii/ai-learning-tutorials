# 内容协商——Accept、Content-Encoding、Transfer-Encoding

## 同一个 URL，不同的响应内容

你用浏览器访问 `https://api.example.com/data`，期望看到 JSON。你用 curl 访问同一个 URL，也期望看到 JSON。但如果你用一个只支持 XML 的老客户端访问呢？它可能期望看到 XML。

这就是内容协商要解决的问题：同一个资源可以有多种表现形式（JSON、XML、HTML），客户端告诉服务器它偏好哪种，服务器返回最合适的那个。

但内容协商不只是格式选择。它还涉及压缩（客户端说"我能解压 gzip"，服务器就发压缩后的数据）、语言（客户端说"我要中文"，服务器返回中文页面）等。

## Accept 系列头部

客户端通过以下头部告诉服务器自己的偏好：

- `Accept`：期望的媒体类型（MIME type），如 `application/json`、`text/html`
- `Accept-Encoding`：支持的压缩编码，如 `gzip`、`br`（Brotli）、`deflate`
- `Accept-Language`：期望的语言，如 `zh-CN`、`en-US`
- `Accept-Charset`：期望的字符集（现在基本不用了，因为 UTF-8 已经统一）

这些头部的值可以有优先级。用 `q` 参数表示权重（0-1，默认 1）：

```
Accept: text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8
```

这表示：最想要 HTML，其次是 XHTML，再次是 XML（权重 0.9），其他格式也行（权重 0.8）。

用 curl 观察：

```bash
# 请求 JSON
curl -H "Accept: application/json" https://httpbin.org/get

# 请求 HTML
curl -H "Accept: text/html" https://httpbin.org/get
```

httpbin 会根据 Accept 头部返回不同格式的响应。观察响应中的 `Content-Type` 头部，它告诉你服务器实际返回的是什么格式。

## Content-Encoding vs Transfer-Encoding

这两个头部很容易混淆，但它们解决的是完全不同的问题。

**Content-Encoding** 表示资源本身的编码方式。比如服务器把 HTML 文件用 gzip 压缩后再发送，响应头就是：

```
Content-Encoding: gzip
Content-Type: text/html
```

客户端收到后需要先解压 gzip，才能得到原始的 HTML。`Content-Encoding` 是资源的属性——如果你把响应保存到文件，保存的是压缩后的数据。

**Transfer-Encoding** 表示传输过程中的编码方式。最常见的值是 `chunked`（分块传输）：

```
Transfer-Encoding: chunked
```

分块传输的意思是：服务器不知道响应总共有多长（比如在动态生成内容），没法提前设置 `Content-Length`。于是它把内容切成一块一块发送，每块前面加上这块的字节数（十六进制），最后发一个长度为 0 的块表示结束。

```
HTTP/1.1 200 OK
Transfer-Encoding: chunked

4\r\n
Wiki\r\n
6\r\n
pedia \r\n
E\r\n
in \r\n
\r\n
chunks.\r\n
0\r\n
\r\n
```

这段的意思是：第一块 4 字节（"Wiki"），第二块 6 字节（"pedia "），第三块 14 字节（"in \r\n\r\nchunks."），第四块 0 字节（结束）。

关键区别：`Content-Encoding` 是端到端的（end-to-end），会一直保留到最终消费者；`Transfer-Encoding` 是逐跳的（hop-by-hop），每个中间代理都可能修改它。

## 用 curl 做压缩实验

```bash
# 不请求压缩
curl -v https://example.com 2>&1 | grep -i "content-encoding"

# 请求 gzip 压缩
curl -v -H "Accept-Encoding: gzip" https://example.com 2>&1 | grep -i "content-encoding"

# 请求 Brotli 压缩
curl -v -H "Accept-Encoding: br" https://example.com 2>&1 | grep -i "content-encoding"
```

如果服务器支持对应的压缩方式，响应中会出现 `Content-Encoding: gzip` 或 `Content-Encoding: br`。

比较响应体大小：

```bash
# 原始响应
curl -s https://example.com | wc -c

# gzip 压缩后的响应
curl -s -H "Accept-Encoding: gzip" https://example.com | wc -c
```

对于 HTML 这样的文本内容，gzip 通常能压缩到原来的 20-30%。Brotli 的压缩率通常比 gzip 好 10-20%，但压缩速度更慢。

## 用 Node.js 实现内容协商

写一个支持多种格式的服务器：

```js
const http = require('http')
const zlib = require('zlib')

const data = {
  users: [
    { id: 1, name: '张三' },
    { id: 2, name: '李四' }
  ]
}

const server = http.createServer((req, res) => {
  const accept = req.headers.accept || '*/*'
  const acceptEncoding = req.headers['accept-encoding'] || ''

  let body, contentType

  if (accept.includes('application/json')) {
    body = JSON.stringify(data)
    contentType = 'application/json; charset=utf-8'
  } else if (accept.includes('text/html')) {
    body = '<ul><li>张三</li><li>李四</li></ul>'
    contentType = 'text/html; charset=utf-8'
  } else {
    body = '张三, 李四'
    contentType = 'text/plain; charset=utf-8'
  }

  const bodyBuffer = Buffer.from(body)

  if (acceptEncoding.includes('gzip')) {
    zlib.gzip(bodyBuffer, (err, compressed) => {
      if (err) {
        res.writeHead(500)
        res.end('压缩失败')
        return
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Encoding': 'gzip',
        'Content-Length': compressed.length
      })
      res.end(compressed)
    })
  } else {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': bodyBuffer.length
    })
    res.end(bodyBuffer)
  }
})

server.listen(3000, () => console.log('监听 :3000'))
```

测试：

```bash
# 请求 JSON
curl -H "Accept: application/json" http://localhost:3000

# 请求 HTML + gzip
curl -H "Accept: text/html" -H "Accept-Encoding: gzip" --compressed http://localhost:3000
```

## Vary 头部：告诉缓存怎么做选择

当服务器根据请求头部做了内容协商时，必须在响应中加上 `Vary` 头部：

```
Vary: Accept, Accept-Encoding
```

这告诉缓存：这个响应是根据 `Accept` 和 `Accept-Encoding` 这两个头部的值生成的。缓存下次收到请求时，不能只看 URL，还要看这两个头部的值是否匹配。

如果没有 `Vary` 头部，缓存可能把 JSON 格式的响应返回给期望 HTML 的客户端。这是内容协商中最常见的 bug。

## 工程启发

1. **Accept 是客户端的声明，不是强制要求**。服务器可以忽略 Accept 头部直接返回任意格式。但这样做会导致客户端解析失败，所以服务端应该尊重客户端的偏好。
2. **压缩是性价比最高的性能优化之一**。对文本内容启用 gzip 或 Brotli，传输量减少 70-80%，几乎零成本。现代服务器和 CDN 默认都会启用压缩。
3. **`Vary` 头部是缓存正确性的关键**。如果你的 API 支持内容协商，一定要设置正确的 `Vary` 头部，否则 CDN 和浏览器缓存会返回错误的内容。

## 练习

### 练习一：观察浏览器的 Accept 头部

用 Node.js 创建一个服务器，打印收到的所有 `Accept*` 头部。分别用 Chrome、curl、Postman 请求这个服务器，对比它们默认发送的 `Accept`、`Accept-Encoding`、`Accept-Language` 头部有什么不同。

### 练习二：实现一个支持 Brotli 压缩的静态文件服务器

用 Node.js 的 `zlib` 模块实现一个静态文件服务器，支持：
- 客户端请求 Brotli 压缩时返回 `.br` 文件
- 客户端请求 gzip 时返回 `.gz` 文件
- 都不支持时返回原始文件
- 正确设置 `Vary: Accept-Encoding`

---

## 参考答案

### 练习一

**思路**：打印请求头，对比不同客户端的默认值。

```js
const http = require('http')

const server = http.createServer((req, res) => {
  console.log(`--- ${req.headers['user-agent']} ---`)
  console.log('Accept:', req.headers.accept)
  console.log('Accept-Encoding:', req.headers['accept-encoding'])
  console.log('Accept-Language:', req.headers['accept-language'])
  console.log('')
  res.end('OK')
})

server.listen(3000, () => console.log('监听 :3000'))
```

**预期发现**：
- Chrome 默认发送的 Accept 很复杂，包含 HTML、XHTML、XML、图片格式等
- curl 默认 Accept 是 `*/*`（什么都接受）
- Chrome 的 Accept-Encoding 包含 `gzip, deflate, br`（支持 Brotli）
- curl 的 Accept-Encoding 只有 `gzip`（除非编译时启用了 Brotli）

### 练习二

**思路**：预压缩文件，根据请求头选择返回哪个版本。

```js
const http = require('http')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const STATIC_DIR = './public'

function serveFile(filePath, req, res) {
  const acceptEncoding = req.headers['accept-encoding'] || ''

  if (acceptEncoding.includes('br') && fs.existsSync(filePath + '.br')) {
    res.writeHead(200, {
      'Content-Encoding': 'br',
      'Vary': 'Accept-Encoding',
      'Content-Type': getContentType(filePath)
    })
    fs.createReadStream(filePath + '.br').pipe(res)
  } else if (acceptEncoding.includes('gzip') && fs.existsSync(filePath + '.gz')) {
    res.writeHead(200, {
      'Content-Encoding': 'gzip',
      'Vary': 'Accept-Encoding',
      'Content-Type': getContentType(filePath)
    })
    fs.createReadStream(filePath + '.gz').pipe(res)
  } else {
    res.writeHead(200, {
      'Vary': 'Accept-Encoding',
      'Content-Type': getContentType(filePath)
    })
    fs.createReadStream(filePath).pipe(res)
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath)
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  }
  return types[ext] || 'application/octet-stream'
}
```

**常见错误**：
- 忘记设置 `Vary: Accept-Encoding`，导致 CDN 返回压缩版本给不支持的客户端
- 在运行时压缩文件——应该在部署时预压缩，运行时直接读取
- Brotli 和 gzip 的 Content-Type 应该相同（都是原始文件的 MIME type）
