# 浏览器缓存机制——Memory Cache、Disk Cache、Service Worker Cache

## 打开 DevTools 看缓存

打开 Chrome DevTools 的 Network 面板，刷新一个你经常访问的网站。看 Size 这一列，你会看到一些请求显示 `(disk cache)` 或 `(memory cache)`。这些请求根本没有发送到服务器——浏览器直接从本地缓存中读取了响应。

这就是 HTTP 缓存的核心价值：减少网络请求，加快页面加载。

但浏览器的缓存不是只有一种。它有至少四种缓存层，每层的行为和优先级都不同。

## 四种缓存层

**Memory Cache**：存在内存中，速度最快，但生命周期最短——关闭标签页就没了。浏览器通常把当前页面中渲染需要的资源（CSS、JS、小图片）放在内存缓存中。

**Disk Cache**：存在磁盘上，速度比内存慢，但持久化存储。即使关闭浏览器再打开，缓存还在。大文件（图片、字体、视频）通常存在磁盘缓存中。

**Service Worker Cache**：由 JavaScript 控制的缓存，生命周期独立于页面。Service Worker 可以拦截网络请求，决定是从缓存读取还是从网络获取。这是 PWA（渐进式 Web 应用）的核心技术。

**Push Cache**：HTTP/2 服务器推送的资源存在这里，只在当前会话有效，且容量最小（每个连接大约 128 个请求）。

浏览器查找缓存的顺序大致是：Memory Cache → Service Worker Cache → Disk Cache → 网络请求。

## 用 curl 验证缓存行为

curl 默认不缓存。要观察浏览器的缓存行为，需要用 DevTools 或者写代码模拟。

用 curl 模拟带缓存头的请求：

```bash
# 第一次请求，获取资源和缓存头
curl -v https://example.com/style.css 2>&1 | grep -i "cache-control\|etag\|last-modified\|expires"

# 第二次请求，带上 If-None-Match（ETag 的值）
curl -v -H 'If-None-Match: "3147526947+gzip"' https://example.com/style.css
```

如果资源没有变化，服务器会返回 `304 Not Modified`，不带响应体。这就是协商缓存的工作方式。

## 用 Node.js 观察缓存头部

创建一个服务器，演示不同的缓存策略：

```js
const http = require('http')
const crypto = require('crypto')

const HTML_CONTENT = '<html><body><h1>缓存测试</h1><link rel="stylesheet" href="/style.css"><script src="/app.js"></script></body></html>'
let cssVersion = 1

const server = http.createServer((req, res) => {
  const now = new Date().toUTCString()

  if (req.url === '/') {
    // HTML：不缓存，每次都从服务器获取
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'  // 每次都验证
    })
    res.end(HTML_CONTENT)
  } else if (req.url === '/style.css') {
    // CSS：强缓存 1 小时
    const content = `body { color: red; } /* v${cssVersion} */`
    res.writeHead(200, {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'max-age=3600',
      'Last-Modified': now
    })
    res.end(content)
  } else if (req.url === '/app.js') {
    // JS：协商缓存
    const content = `console.log('v${cssVersion}')`
    const etag = crypto.createHash('md5').update(content).digest('hex')
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
      'ETag': `"${etag}"`
    })
    res.end(content)
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

server.listen(3000, () => console.log('监听 :3000'))
```

用浏览器访问 `http://localhost:3000`，然后在 DevTools 中观察：
- `/` 的请求：每次都发，但可能收到 304
- `/style.css`：第一次请求后，后续刷新直接从内存/磁盘缓存读取
- `/app.js`：每次都发验证请求，服务器比较 ETag 后决定返回 304 还是 200

## 缓存位置的决定因素

浏览器把资源放在内存还是磁盘，没有统一标准，但有一些常见的规律：

- 当前页面的主文档（HTML）通常不缓存，或只存在内存中
- CSS 和 JS 在当前页面生命周期内存在内存中
- 图片通常存在磁盘中（因为体积大）
- 字体通常存在磁盘中

Chrome 的实际行为比较复杂，会根据资源大小、类型、访问频率等因素综合决定。你不能精确控制资源存在内存还是磁盘，但可以通过 `Cache-Control` 头部影响缓存时间。

## Service Worker 缓存

Service Worker 是一个运行在浏览器后台的 JavaScript 脚本，它可以拦截网络请求并决定如何响应：

```js
// sw.js - Service Worker 脚本
const CACHE_NAME = 'v1'
const ASSETS = ['/style.css', '/app.js']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS)
    })
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached
      }
      return fetch(event.request).then((response) => {
        // 缓存新资源
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone)
          })
        }
        return response
      })
    })
  )
})
```

Service Worker 缓存的优点：
- 完全由 JavaScript 控制，可以实现复杂的缓存策略
- 可以缓存任何请求，包括跨域请求
- 即使服务器不可用，也能从缓存中提供资源

缺点：
- 需要 HTTPS（localhost 除外）
- 第一次安装时不缓存，需要第二次访问才能生效
- 更新 Service Worker 需要谨慎处理缓存失效

## 工程启发

1. **缓存分层是必要的**。不同类型的资源需要不同的缓存策略。HTML 通常不缓存或短时间缓存（因为它是入口），CSS/JS 可以用带版本号的长时间缓存，图片可以用更长时间的缓存。
2. **内存缓存和磁盘缓存的区别对开发者透明**。你不需要关心资源存在内存还是磁盘，浏览器会自动处理。你需要关心的是 `Cache-Control`、`ETag` 这些 HTTP 头部。
3. **Service Worker 是最灵活的缓存方案**。但它增加了复杂度，只在需要离线支持或精细控制缓存时才值得引入。

## 练习

### 练习一：用 DevTools 观察缓存行为

1. 访问一个设置了强缓存的网站（如 `https://cdn.jsdelivr.net`）
2. 在 DevTools 的 Network 面板中观察哪些请求来自缓存
3. 勾选 "Disable cache" 选项，再次刷新，对比请求数量和加载时间

### 练习二：实现一个带版本号的静态资源缓存策略

用 Node.js 实现：
- HTML 文件：`Cache-Control: no-cache`（每次都验证）
- CSS/JS 文件：文件名中带 hash（如 `app.abc123.js`），`Cache-Control: max-age=31536000`（1 年）
- 图片：`Cache-Control: max-age=86400`（1 天）

---

## 参考答案

### 练习一

**观察要点**：
- 第一次访问时，所有资源都从网络加载
- 第二次刷新时，部分资源显示 `(memory cache)` 或 `(disk cache)`
- 勾选 "Disable cache" 后，所有资源都重新从网络加载
- 可以右键点击请求 → Clear browser cache 来清除特定域名的缓存

### 练习二

**思路**：用文件内容的 hash 作为文件名的一部分。当文件内容变化时，hash 变化，URL 也变化，浏览器会请求新资源。当文件内容不变时，URL 不变，浏览器直接从缓存读取。

```js
const http = require('http')
const fs = require('fs')
const crypto = require('crypto')
const path = require('path')

function getFileHash(filePath) {
  const content = fs.readFileSync(filePath)
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8)
}

const STATIC_DIR = './public'

const server = http.createServer((req, res) => {
  // 解析带 hash 的文件名：app.abc123.js -> app.js
  const match = req.url.match(/^(.+)\.[a-f0-9]{8}(\.\w+)$/)
  const realPath = match ? match[1] + match[2] : req.url
  const filePath = path.join(STATIC_DIR, realPath)

  if (!fs.existsSync(filePath)) {
    res.writeHead(404)
    res.end('Not Found')
    return
  }

  const ext = path.extname(filePath)
  const content = fs.readFileSync(filePath)

  if (ext === '.html') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    })
  } else if (ext === '.css' || ext === '.js') {
    const hash = getFileHash(filePath)
    res.writeHead(200, {
      'Content-Type': ext === '.css' ? 'text/css' : 'application/javascript',
      'Cache-Control': 'public, max-age=31536000, immutable'
    })
  } else {
    res.writeHead(200, {
      'Content-Type': 'image/' + ext.slice(1),
      'Cache-Control': 'public, max-age=86400'
    })
  }
  res.end(content)
})

server.listen(3000, () => console.log('监听 :3000'))
```

**关键点**：文件名中的 hash 必须基于文件内容计算。当内容变化时，hash 变化，URL 变化，浏览器会请求新版本。这就是"缓存破坏"（cache busting）的标准做法。
