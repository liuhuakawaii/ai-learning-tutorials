# CDN 缓存——回源、刷新、预热、多级缓存架构

## 为什么需要 CDN

假设你的服务器在北京，用户在美国。每次请求都要跨越太平洋，RTT 大约 200ms。一个页面有 50 个请求，光网络延迟就要 10 秒。

CDN（Content Delivery Network）的解决方案是：在全球部署很多节点，把你的内容缓存在离用户最近的节点上。用户请求时，DNS 把他导向最近的 CDN 节点，节点直接返回缓存的内容，不需要回源站。

这不是什么高深的技术，本质就是"把内容放到离用户近的地方"。但工程实现中有很多细节。

## CDN 的工作流程

```
用户 → DNS → CDN 边缘节点
                ↓
         缓存命中？ → 返回缓存内容
                ↓
            未命中 → 回源站
                ↓
         源站返回内容 → CDN 缓存一份 → 返回给用户
```

用 curl 观察 CDN 行为：

```bash
# 第一次请求（缓存未命中）
curl -v https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js 2>&1 | grep -i "x-cache\|cf-cache\|age"

# 第二次请求（可能命中缓存）
curl -v https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js 2>&1 | grep -i "x-cache\|cf-cache\|age"
```

CDN 通常会在响应中加上缓存状态头部：
- `X-Cache: HIT` 或 `MISS`（是否命中缓存）
- `CF-Cache-Status: HIT`（Cloudflare 的缓存状态）
- `Age: 1234`（资源在 CDN 上已经缓存了多久，秒）

## 回源（Origin Fetch）

当 CDN 节点没有缓存资源时，需要向源站请求。这个过程叫"回源"。

回源有几个需要注意的问题：

**回源带宽**：如果大量用户同时请求一个未缓存的资源，CDN 节点会向源站发大量请求。这可能打垮源站。解决方案是"合并回源"——多个用户请求同一个资源时，CDN 只向源站发一个请求，其他用户等待这个请求的结果。

**回源 Host 头部**：CDN 回源时，`Host` 头部通常是源站的域名，不是用户的请求域名。如果源站用虚拟主机，需要确保源站能正确处理 CDN 的回源请求。

**回源验证**：CDN 可以用条件请求（`If-None-Match`、`If-Modified-Since`）来验证缓存是否过期。如果源站返回 304，CDN 不需要重新下载整个资源。

## 缓存刷新

有时候你需要立即更新 CDN 上的缓存，不能等它自然过期。比如：

- 发现了严重 bug，紧急修复后需要立即生效
- 价格标错了，需要立即下架
- 法律要求删除某些内容

CDN 提供两种刷新方式：

**URL 刷新**：删除指定 URL 的缓存。下次请求时 CDN 会回源获取最新内容。

**目录刷新**：删除某个目录下所有 URL 的缓存。用于批量更新。

大多数 CDN 的 API 支持：

```bash
# 伪代码，具体 API 取决于 CDN 提供商
curl -X POST "https://cdn-api.example.com/purge" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"urls": ["https://example.com/style.css", "https://example.com/app.js"]}'
```

注意：CDN 刷新不是即时的。全球节点的缓存可能需要几分钟到几小时才能完全清除。

## 缓存预热

预热是刷新的反面：主动把资源推送到 CDN 节点，而不是等用户请求时再回源。

适用场景：
- 新网站上线，希望首次访问就很快
- 大促活动，预期会有大量流量
- 新版本发布，希望所有用户立即看到新内容

预热通常通过 CDN 的管理控制台或 API 来操作。你需要告诉 CDN 要预热的 URL 列表，CDN 会主动从源站拉取这些资源到各节点。

## 多级缓存架构

大型 CDN 通常有多级缓存：

```
用户 → 边缘节点（L1）→ 区域中心（L2）→ 源站
```

- **L1（边缘节点）**：离用户最近，容量小，缓存热门资源
- **L2（区域中心）**：覆盖更大的地理区域，容量更大，缓存更多资源
- **源站**：最终的数据来源

当 L1 没有缓存时，先问 L2，L2 也没有才回源站。这样减少了源站的压力。

用 curl 观察多级缓存：

```bash
curl -v https://example.com/resource.js 2>&1 | grep -i "x-cache\|via\|age"
```

有些 CDN 会在 `Via` 或 `X-Cache` 头部中显示缓存层级信息。

## 用 Node.js 模拟 CDN 行为

```js
const http = require('http')

// 模拟源站
const originServer = http.createServer((req, res) => {
  console.log(`[源站] 收到请求: ${req.url}`)

  const etag = '"v1"'
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304)
    res.end()
    return
  }

  const content = `console.log("version 1 - ${new Date().toISOString()}")`
  res.writeHead(200, {
    'Content-Type': 'application/javascript',
    'ETag': etag,
    'Cache-Control': 'max-age=60'
  })
  res.end(content)
})

// 模拟 CDN 边缘节点
const cdnCache = new Map()
const cdnServer = http.createServer((req, res) => {
  const cached = cdnCache.get(req.url)

  if (cached && Date.now() - cached.time < 60000) {
    console.log(`[CDN] 缓存命中: ${req.url}`)
    res.writeHead(200, {
      ...cached.headers,
      'X-Cache': 'HIT',
      'Age': Math.floor((Date.now() - cached.time) / 1000)
    })
    res.end(cached.body)
    return
  }

  console.log(`[CDN] 缓存未命中，回源: ${req.url}`)

  // 回源
  const originReq = http.request({
    hostname: 'localhost',
    port: 3001,
    path: req.url,
    headers: {
      ...req.headers,
      host: 'localhost:3001'
    }
  }, (originRes) => {
    let body = ''
    originRes.on('data', (chunk) => body += chunk)
    originRes.on('end', () => {
      // 缓存到 CDN
      cdnCache.set(req.url, {
        time: Date.now(),
        headers: { 'content-type': originRes.headers['content-type'] },
        body
      })

      res.writeHead(originRes.statusCode, {
        ...originRes.headers,
        'X-Cache': 'MISS'
      })
      res.end(body)
    })
  })
  originReq.end()
})

originServer.listen(3001, () => console.log('源站监听 :3001'))
cdnServer.listen(3000, () => console.log('CDN 监听 :3000'))
```

测试：

```bash
# 第一次请求（MISS）
curl -v http://localhost:3000/app.js 2>&1 | grep "X-Cache"

# 第二次请求（HIT）
curl -v http://localhost:3000/app.js 2>&1 | grep "X-Cache\|Age"
```

## 工程启发

1. **CDN 缓存的 key 通常是完整的 URL**。不同的查询参数会生成不同的缓存条目。如果你的 API 用查询参数做版本控制，注意缓存的影响。
2. **缓存刷新不是即时的**。全球节点同步需要时间。在刷新完成前，部分用户可能仍然看到旧内容。
3. **CDN 的成本模型是带宽**。回源带宽通常比边缘节点带宽贵。减少回源可以降低成本。

## 练习

### 练习一：用 curl 观察真实 CDN 的缓存行为

访问以下 CDN 资源，记录缓存状态、Age、缓存时间：

```bash
curl -v https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js 2>&1 | grep -i "cache\|age\|hit\|miss"
curl -v https://unpkg.com/react@18/umd/react.production.min.js 2>&1 | grep -i "cache\|age\|hit\|miss"
```

### 练习二：设计一个 CDN 缓存策略

为一个电商网站设计 CDN 缓存策略，包括：
- 首页 HTML
- 商品图片
- CSS/JS 文件
- API 接口（商品详情、用户信息）

说明每个资源的缓存时间、是否需要回源验证、如何处理紧急更新。

---

## 参考答案

### 练习一

**预期观察**：
- jsdelivr 和 unpkg 都使用 CDN，首次请求可能是 MISS，后续请求是 HIT
- `Age` 头部表示资源已经缓存了多久
- 缓存时间通常很长（如 `max-age=31536000`），因为这些是版本化的库文件

### 练习二

**参考设计**：

- **首页 HTML**：`Cache-Control: no-cache` + ETag。HTML 是入口页面，不能长时间缓存（否则用户看不到最新内容）。每次都走协商缓存，源站返回 304 即可（不传响应体，省带宽）。

- **商品图片**：`Cache-Control: public, max-age=86400`（1 天）。图片变化频率低，可以缓存 1 天。如果商品下架，手动刷新 CDN 缓存。图片 URL 用商品 ID + 图片版本号（如 `/img/123/v2.jpg`），这样更新图片时 URL 会变化。

- **CSS/JS 文件**：`Cache-Control: public, max-age=31536000, immutable`（1 年）。文件名中带 hash（如 `app.abc123.js`），内容变化时 hash 变化，URL 变化，浏览器会请求新版本。不需要手动刷新。

- **商品详情 API**：`Cache-Control: public, max-age=300, stale-while-revalidate=600`。缓存 5 分钟，过期后 10 分钟内返回旧数据（后台异步更新）。这样大部分请求不需要回源。

- **用户信息 API**：`Cache-Control: private, no-store`。用户数据是私有的，不能被 CDN 缓存。每次请求都直接到源站。
