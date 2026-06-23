# 强缓存 vs 协商缓存——Cache-Control、ETag、Last-Modified 的协作

## 两种缓存策略

浏览器缓存分为两种策略：强缓存和协商缓存。它们不是二选一，而是协作关系——先检查强缓存，强缓存失效后再检查协商缓存。

强缓存：浏览器直接从本地缓存读取，不发请求给服务器。命中强缓存时，Network 面板显示 `(memory cache)` 或 `(disk cache)`，状态码是 200。

协商缓存：浏览器发请求给服务器验证资源是否过期。如果没过期，服务器返回 304 Not Modified（不带响应体），浏览器继续用本地缓存。如果过期了，服务器返回 200 和新资源。

## 强缓存：Cache-Control 和 Expires

控制强缓存的头部有两个：

**Cache-Control** 是现代方案，功能更强大：

```
Cache-Control: max-age=3600          # 秒数，从响应时间算起
Cache-Control: no-cache              # 不使用强缓存，每次都走协商缓存
Cache-Control: no-store              # 完全不缓存
Cache-Control: public                # CDN 可以缓存
Cache-Control: private               # 只有浏览器可以缓存，CDN 不能
Cache-Control: immutable             # 资源永远不会变化，不需要验证
```

**Expires** 是 HTTP/1.0 遗留方案，用绝对时间表示过期时间：

```
Expires: Thu, 01 Jan 2025 00:00:00 GMT
```

当 `Cache-Control` 和 `Expires` 同时存在时，`Cache-Control` 优先。

用 curl 观察：

```bash
curl -v https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js 2>&1 | grep -i "cache-control\|expires"
```

CDN 上的库文件通常设置很长的缓存时间（如 1 年），因为文件名中带版本号，内容不会变。

## 协商缓存：ETag 和 Last-Modified

当强缓存失效（`max-age` 过期或设置了 `no-cache`）时，浏览器会发一个条件请求给服务器验证资源是否变化。

**ETag** 是资源的唯一标识符（通常是内容的 hash）：

```
// 服务器响应
ETag: "33a64df5"

// 浏览器下次请求带上
If-None-Match: "33a64df5"
```

服务器比较客户端的 `If-None-Match` 和当前资源的 ETag。如果一致，返回 304；如果不一致，返回 200 和新资源。

**Last-Modified** 是资源的最后修改时间：

```
// 服务器响应
Last-Modified: Wed, 21 Oct 2023 07:28:00 GMT

// 浏览器下次请求带上
If-Modified-Since: Wed, 21 Oct 2023 07:28:00 GMT
```

服务器比较修改时间。如果资源没有更新过，返回 304。

ETag 优先级高于 Last-Modified。两者同时存在时，浏览器只用 ETag。

## 完整的缓存判断流程

```
1. 浏览器发起请求
2. 检查强缓存：
   - 有 Cache-Control: max-age 且未过期 → 直接用缓存（200 from cache）
   - 有 Expires 且未过期 → 直接用缓存
   - 都没有或已过期 → 进入步骤 3
3. 发条件请求给服务器：
   - 有 ETag → 发 If-None-Match
   - 有 Last-Modified → 发 If-Modified-Since
4. 服务器判断：
   - 资源未变 → 304 Not Modified（不带响应体）
   - 资源已变 → 200 OK（带新资源）
```

## 用 Node.js 实现完整的缓存策略

```js
const http = require('http')
const crypto = require('crypto')
const fs = require('fs')

const STATIC_FILES = {
  '/style.css': {
    content: 'body { color: red; }',
    contentType: 'text/css'
  },
  '/app.js': {
    content: 'console.log("hello")',
    contentType: 'application/javascript'
  }
}

// 计算 ETag
function getETag(content) {
  return '"' + crypto.createHash('md5').update(content).digest('hex') + '"'
}

const server = http.createServer((req, res) => {
  const file = STATIC_FILES[req.url]
  if (!file) {
    res.writeHead(404)
    res.end('Not Found')
    return
  }

  const etag = getETag(file.content)
  const lastModified = new Date().toUTCString()

  // 检查协商缓存
  const ifNoneMatch = req.headers['if-none-match']
  const ifModifiedSince = req.headers['if-modified-since']

  if (ifNoneMatch === etag) {
    res.writeHead(304)
    res.end()
    return
  }

  if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(lastModified)) {
    res.writeHead(304)
    res.end()
    return
  }

  // 返回完整响应
  res.writeHead(200, {
    'Content-Type': file.contentType,
    'Content-Length': Buffer.byteLength(file.content),
    'Cache-Control': 'no-cache',  // 每次都验证
    'ETag': etag,
    'Last-Modified': lastModified
  })
  res.end(file.content)
})

server.listen(3000, () => console.log('监听 :3000'))
```

测试：

```bash
# 第一次请求，获取 ETag
curl -v http://localhost:3000/style.css 2>&1 | grep -i "etag"

# 第二次请求，带上 ETag
curl -v -H 'If-None-Match: "上一步获取的值"' http://localhost:3000/style.css
```

## 强缓存的常见坑

**坑一：更新了文件但用户看到的是旧版本**

如果你的 CSS/JS 文件设置了 `max-age=31536000`（1 年），更新文件后，浏览器在过期前不会请求新版本。解决方案是用带 hash 的文件名（如 `app.abc123.js`），当内容变化时文件名也变化。

**坑二：no-cache 不是不缓存**

`no-cache` 的意思是"不使用强缓存，但可以协商缓存"。很多人以为 `no-cache` 是不缓存，实际上 `no-store` 才是完全不缓存。

**坑三：CDN 缓存和浏览器缓存不一致**

CDN 可能缓存了旧版本的资源，即使你更新了源站。需要主动刷新 CDN 缓存（后面 CDN 缓存那节课会详细讲）。

## 工程启发

1. **ETag 比 Last-Modified 更精确**。Last-Modified 的精度是秒，如果一秒内修改了多次，Last-Modified 无法区分。ETag 基于内容 hash，能精确判断内容是否变化。
2. **强缓存和协商缓存是协作关系**。强缓存减少请求次数，协商缓存减少传输数据量。两者结合使用效果最好。
3. **缓存策略要跟部署策略配合**。如果用带 hash 的文件名，可以设置很长的强缓存时间。如果用固定文件名，应该用 `no-cache` + ETag 做协商缓存。

## 练习

### 练习一：用 curl 完整演示协商缓存流程

1. 用 curl 请求一个资源，记录 ETag 和 Last-Modified
2. 用这些值发起条件请求
3. 验证服务器返回 304
4. 修改资源后再次请求，验证返回 200

### 练习二：设计一个 API 的缓存策略

为以下类型的 API 设计缓存策略，说明原因：
- 用户信息接口（`/api/user/profile`）
- 商品列表接口（`/api/products`）
- 静态配置接口（`/api/config`）
- 实时数据接口（`/api/realtime`）

---

## 参考答案

### 练习一

```bash
# 第一步：获取资源和 ETag
curl -v http://localhost:3000/style.css 2>&1 | grep -i "etag\|last-modified"

# 第二步：带 ETag 请求（假设 ETag 是 "abc123"）
curl -v -H 'If-None-Match: "abc123"' http://localhost:3000/style.css

# 第三步：修改服务器中的资源，重启服务器
# 第四步：再次带旧 ETag 请求，应该返回 200
curl -v -H 'If-None-Match: "abc123"' http://localhost:3000/style.css
```

### 练习二

**参考设计**：

- **用户信息接口**：`Cache-Control: private, max-age=60`。用户信息是私有数据（`private`），不能被 CDN 缓存。设置 60 秒强缓存，减少重复请求。用户修改信息后，60 秒内可能看到旧数据，这是可接受的。

- **商品列表接口**：`Cache-Control: public, max-age=300, stale-while-revalidate=600`。商品列表是公开数据，可以被 CDN 缓存。5 分钟强缓存，过期后 10 分钟内可以返回旧数据（`stale-while-revalidate`），同时后台异步更新缓存。

- **静态配置接口**：`Cache-Control: public, max-age=3600`。配置变化频率低，可以缓存 1 小时。如果配置紧急变更，可以通过版本号或手动刷新来更新。

- **实时数据接口**：`Cache-Control: no-store`。实时数据不应该被缓存。每次都要从服务器获取最新数据。

**关键原则**：缓存时间应该跟数据变化频率匹配。变化越频繁，缓存时间越短。
