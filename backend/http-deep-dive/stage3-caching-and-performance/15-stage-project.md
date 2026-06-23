# 阶段实战：设计一个静态资源的完整缓存策略

## 目标

这个阶段的实战任务是：为一个 Web 应用设计完整的静态资源缓存策略，包括强缓存、协商缓存、CDN 缓存、压缩、版本管理，并用 Node.js 实现。

这不是一个理论练习。你要实现一个能运行的服务器，用 curl 和 DevTools 验证缓存行为是否符合预期。

## 第一步：项目结构

```
cache-demo/
├── public/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── img/
│       └── logo.png
├── server.js
└── build.js          # 构建脚本，生成带 hash 的文件名
```

## 第二步：构建脚本

```js
// build.js
const fs = require('fs')
const crypto = require('crypto')
const path = require('path')

const PUBLIC_DIR = './public'
const OUTPUT_FILE = './manifest.json'

function getFileHash(filePath) {
  const content = fs.readFileSync(filePath)
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8)
}

function processDirectory(dir) {
  const manifest = {}

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.name !== 'index.html') {  // HTML 不加 hash
        const hash = getFileHash(fullPath)
        const ext = path.extname(entry.name)
        const baseName = path.basename(entry.name, ext)
        const relativePath = path.relative(PUBLIC_DIR, fullPath).replace(/\\/g, '/')
        const hashedName = `${baseName}.${hash}${ext}`
        const hashedPath = path.join(path.dirname(relativePath), hashedName)

        manifest[relativePath] = hashedPath
      }
    }
  }

  walk(dir)
  return manifest
}

const manifest = processDirectory(PUBLIC_DIR)
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2))
console.log('构建完成:', manifest)
```

运行 `node build.js` 生成 `manifest.json`，记录了原始文件名到带 hash 文件名的映射。

## 第三步：服务器实现

```js
// server.js
const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const zlib = require('zlib')

const PUBLIC_DIR = './public'
const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf-8'))

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
}

function getCachePolicy(filePath) {
  const ext = path.extname(filePath)

  if (ext === '.html') {
    // HTML：协商缓存
    return {
      'Cache-Control': 'no-cache',
      'ETag': getETag(filePath)
    }
  }

  // CSS/JS/图片：检查是否有带 hash 的版本
  const relativePath = path.relative(PUBLIC_DIR, filePath).replace(/\\/g, '/')
  const hashedPath = manifest[relativePath]

  if (hashedPath) {
    // 有 hash 版本：强缓存 1 年
    return {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  }

  // 其他资源：强缓存 1 天
  return {
    'Cache-Control': 'public, max-age=86400'
  }
}

function getETag(filePath) {
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath)
  return '"' + crypto.createHash('md5').update(content).digest('hex') + '"'
}

function compressResponse(content, encoding) {
  return new Promise((resolve, reject) => {
    if (encoding === 'br') {
      zlib.brotliCompress(content, (err, result) => {
        if (err) reject(err)
        else resolve(result)
      })
    } else if (encoding === 'gzip') {
      zlib.gzip(content, (err, result) => {
        if (err) reject(err)
        else resolve(result)
      })
    } else {
      resolve(content)
    }
  })
}

const server = http.createServer(async (req, res) => {
  let urlPath = req.url.split('?')[0]
  if (urlPath === '/') urlPath = '/index.html'

  // 尝试匹配带 hash 的文件名
  const originalPath = Object.keys(manifest).find(key => manifest[key] === urlPath.slice(1))
  const filePath = path.join(PUBLIC_DIR, originalPath || urlPath)

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
    return
  }

  const stats = fs.statSync(filePath)
  const cachePolicy = getCachePolicy(filePath)

  // 协商缓存检查
  const ifNoneMatch = req.headers['if-none-match']
  const etag = cachePolicy.ETag || getETag(filePath)

  if (ifNoneMatch && etag && ifNoneMatch === etag) {
    res.writeHead(304)
    res.end()
    return
  }

  // 读取文件
  const content = fs.readFileSync(filePath)
  const ext = path.extname(filePath)
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  // 压缩
  const acceptEncoding = req.headers['accept-encoding'] || ''
  let encoding = null
  if (acceptEncoding.includes('br') && content.length > 1024) {
    encoding = 'br'
  } else if (acceptEncoding.includes('gzip') && content.length > 1024) {
    encoding = 'gzip'
  }

  const headers = {
    'Content-Type': contentType,
    ...cachePolicy,
    'Vary': 'Accept-Encoding'
  }

  if (etag) {
    headers['ETag'] = etag
  }

  if (encoding) {
    const compressed = await compressResponse(content, encoding)
    headers['Content-Encoding'] = encoding
    headers['Content-Length'] = compressed.length
    res.writeHead(200, headers)
    res.end(compressed)
  } else {
    headers['Content-Length'] = content.length
    res.writeHead(200, headers)
    res.end(content)
  }
})

server.listen(3000, () => console.log('服务器监听 :3000'))
```

## 第四步：HTML 中引用带 hash 的资源

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>缓存策略演示</title>
  <!-- 通过服务器端模板或构建工具替换为带 hash 的路径 -->
  <link rel="stylesheet" href="/css/style.css">
  <script src="/js/app.js" defer></script>
</head>
<body>
  <h1>缓存策略演示</h1>
  <img src="/img/logo.png" alt="Logo">
</body>
</html>
```

实际项目中，你需要在构建时把 HTML 中的引用替换为带 hash 的文件名。这里为了演示简化了这一步。

## 第五步：验证缓存行为

```bash
# 1. 首次请求 HTML（协商缓存）
curl -v http://localhost:3000/ 2>&1 | grep -i "cache-control\|etag"

# 2. 带 ETag 再次请求（应该返回 304）
curl -v -H 'If-None-Match: "上一步的ETag值"' http://localhost:3000/

# 3. 请求 CSS（强缓存）
curl -v http://localhost:3000/css/style.css 2>&1 | grep -i "cache-control"

# 4. 请求带 hash 的 CSS（强缓存 1 年）
curl -v http://localhost:3000/css/style.abc12345.css 2>&1 | grep -i "cache-control"

# 5. 测试压缩
curl -v -H "Accept-Encoding: gzip, br" http://localhost:3000/js/app.js --compressed 2>&1 | grep -i "content-encoding"
```

## 验收清单

- [ ] HTML 文件使用协商缓存（`no-cache` + ETag）
- [ ] CSS/JS 文件使用强缓存（`max-age=31536000`）
- [ ] 带 hash 的文件名能正确解析
- [ ] gzip 和 Brotli 压缩正常工作
- [ ] ETag 验证返回 304
- [ ] 理解了为什么 HTML 不用强缓存
- [ ] 理解了为什么 CSS/JS 用带 hash 的文件名

## 常见问题

**Q: 为什么 HTML 不用强缓存？**
A: HTML 是入口页面。如果 HTML 被强缓存了，即使你更新了 CSS/JS 的文件名，用户访问的还是旧 HTML，里面引用的还是旧 CSS/JS。所以 HTML 必须每次都验证。

**Q: 为什么 CSS/JS 可以用强缓存？**
A: 因为用了带 hash 的文件名。当内容变化时，hash 变化，文件名变化，HTML 中的引用也变化。浏览器会请求新的 URL，不会用旧缓存。

**Q: 生产环境怎么部署？**
A: 通常用 Nginx 或 CDN 做静态资源服务，Node.js 只处理 API 请求。Nginx 的 `try_files` 和 `expires` 指令可以实现类似的缓存策略。
