# 移动端 HTTP 特殊问题——弱网、连接切换、后台限制

## 移动端不是桌面端的缩小版

很多人在桌面端开发和测试，然后觉得"移动端也差不多"。但移动端的网络环境跟桌面端有本质区别：

- **网络不稳定**：4G/5G 信号会波动，进电梯会断网，切换基站会丢包
- **网络切换**：Wi-Fi 和蜂窝网络之间切换，IP 地址会变化
- **后台限制**：App 进入后台后，系统可能暂停网络请求
- **电量限制**：频繁的网络请求会消耗电量，系统会限制后台网络活动
- **延迟更高**：蜂窝网络的 RTT 通常比 Wi-Fi 高 2-3 倍

这些差异会导致一些在桌面端不会出现的问题。

## 弱网环境下的 HTTP 行为

在弱网环境下（高延迟、高丢包），HTTP 的行为会跟正常网络有很大差异。

### 连接建立变慢

TCP 三次握手需要 1.5 个 RTT。在 4G 网络上 RTT 可能有 50-100ms，加上 TLS 握手（1-2 RTT），建立一个 HTTPS 连接可能需要 150-300ms。

如果页面有 20 个请求需要建立新连接，光连接建立就要 3-6 秒。

### 超时更容易触发

弱网环境下，正常的请求也可能因为延迟高而触发超时。很多开发者设置的超时时间太短（比如 3 秒），在弱网环境下会导致大量假超时。

```js
// 不好的做法：超时太短
const controller = new AbortController()
setTimeout(() => controller.abort(), 3000)  // 3 秒超时

// 更好的做法：根据网络类型调整超时
function getTimeout() {
  const connection = navigator.connection
  if (!connection) return 10000  // 默认 10 秒

  switch (connection.effectiveType) {
    case '4g': return 5000
    case '3g': return 10000
    case '2g': return 30000
    case 'slow-2g': return 60000
    default: return 10000
  }
}
```

### TCP 慢启动影响更大

TCP 的拥塞控制在新连接上从很小的窗口开始（通常 10 个 MSS，约 14KB）。在高延迟网络上，窗口增长很慢，导致初始传输速度很慢。

这就是为什么 HTTP/2 的单连接复用在弱网环境下可能反而更慢——所有请求都受制于一个连接的慢启动。

## 网络切换

当用户从 Wi-Fi 切换到 4G（或反过来），IP 地址会变化。这对 HTTP 有什么影响？

### HTTP/1.1 和 HTTP/2

TCP 连接是用四元组（源 IP、源端口、目标 IP、目标端口）标识的。IP 变化后，所有现有的 TCP 连接都会断开。

浏览器需要重新建立连接，重新进行 TLS 握手，之前的所有 Keep-Alive 连接都失效。

### HTTP/3 (QUIC)

QUIC 用连接 ID 而不是四元组来标识连接。IP 变化后，连接 ID 不变，QUIC 连接可以无缝迁移。

这是 HTTP/3 在移动端的核心优势之一。

### 用 JavaScript 监听网络变化

```js
// 监听网络变化
navigator.connection.addEventListener('change', () => {
  console.log('网络类型:', navigator.connection.effectiveType)
  console.log('下行带宽:', navigator.connection.downlink, 'Mbps')
  console.log('RTT:', navigator.connection.rtt, 'ms')

  // 网络变化时，可能需要重新建立连接
  // 或者切换到更保守的请求策略
})

// 监听在线/离线状态
window.addEventListener('online', () => {
  console.log('网络恢复')
  // 重试失败的请求
})

window.addEventListener('offline', () => {
  console.log('网络断开')
  // 暂停请求，进入离线模式
})
```

## 后台限制

当 App 进入后台时，操作系统会限制网络活动以节省电量。

### iOS 后台限制

iOS 对后台 App 的网络限制很严格：
- 后台下载有大小限制（通常 50MB 以内）
- 后台任务有时间限制（约 30 秒）
- 长连接可能被系统断开

### Android 后台限制

Android 的后台限制因版本而异：
- Android 6.0+ 引入了 Doze 模式，限制后台网络
- Android 7.0+ 引入了 App Standby，限制不常用 App 的网络
- Android 12+ 进一步限制后台网络活动

### 应对策略

1. **关键请求在前台完成**。不要依赖后台网络来完成关键操作。
2. **用后台同步 API**。Service Worker 的 Background Sync API 可以在网络恢复时自动重试请求。
3. **合理设置重试策略**。后台请求失败后，不要立即重试，等回到前台再重试。

## 用 Node.js 模拟弱网环境

```js
const http = require('http')

// 模拟弱网的中间件
function weakNetwork(handler, options = {}) {
  const { delay = 200, jitter = 100, packetLoss = 0.05 } = options

  return (req, res) => {
    // 模拟丢包
    if (Math.random() < packetLoss) {
      console.log(`[丢包] ${req.method} ${req.url}`)
      req.socket.destroy()
      return
    }

    // 模拟延迟抖动
    const actualDelay = delay + (Math.random() - 0.5) * jitter * 2
    setTimeout(() => {
      handler(req, res)
    }, Math.max(0, actualDelay))
  }
}

const server = http.createServer(weakNetwork((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    message: 'response from weak network',
    timestamp: Date.now()
  }))
}, { delay: 300, jitter: 200, packetLoss: 0.1 }))

server.listen(3000, () => console.log('弱网服务器监听 :3000'))
```

测试：

```bash
# 多次请求，观察延迟和失败率
for i in {1..20}; do
  curl -s --max-time 5 http://localhost:3000/test && echo " OK" || echo " FAILED"
done
```

## 前端的应对策略

### 请求重试

```js
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(getTimeout())
      })

      if (response.ok) return response

      // 5xx 错误可以重试
      if (response.status >= 500) {
        lastError = new Error(`HTTP ${response.status}`)
        continue
      }

      // 4xx 错误不重试
      return response
    } catch (err) {
      lastError = err
      if (err.name === 'AbortError') {
        console.log(`请求超时，重试 ${i + 1}/${maxRetries}`)
      }
    }

    // 指数退避
    await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000))
  }

  throw lastError
}
```

### 离线优先策略

```js
// 使用 Service Worker 实现离线缓存
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // 先返回缓存
      if (cached) {
        // 后台更新缓存
        fetch(event.request).then((response) => {
          caches.open('v1').then((cache) => {
            cache.put(event.request, response)
          })
        })
        return cached
      }

      // 没有缓存，从网络获取
      return fetch(event.request).catch(() => {
        // 网络也失败，返回离线页面
        return caches.match('/offline.html')
      })
    })
  )
})
```

## 工程启发

1. **移动端的网络是不可靠的**。所有网络请求都应该有超时、重试、降级策略。
2. **HTTP/3 在移动端有明显优势**。QUIC 的连接迁移和独立流可以显著改善移动端的网络体验。
3. **测试要在真实设备上进行**。模拟器无法完全模拟真实移动网络的行为。

## 练习

### 练习一：用 Node.js 模拟弱网并测试重试策略

1. 创建一个弱网服务器（高延迟 + 随机丢包）
2. 用 JavaScript 实现带重试的请求
3. 对比有重试和无重试的成功率

### 练习二：实现一个离线可用的 API 缓存

用 Service Worker 实现：
1. 网络请求成功时缓存响应
2. 网络请求失败时返回缓存的响应
3. 网络恢复时更新缓存

---

## 参考答案

### 练习一

```js
const http = require('http')

// 弱网服务器
const server = http.createServer((req, res) => {
  if (Math.random() < 0.3) {  // 30% 丢包率
    req.socket.destroy()
    return
  }
  setTimeout(() => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  }, 200 + Math.random() * 300)
})

server.listen(3000, () => {
  // 测试无重试
  let success = 0, fail = 0
  const test = async () => {
    for (let i = 0; i < 100; i++) {
      try {
        await fetch('http://localhost:3000', { signal: AbortSignal.timeout(2000) })
        success++
      } catch {
        fail++
      }
    }
    console.log(`无重试: 成功 ${success}, 失败 ${fail}`)

    // 测试有重试
    success = 0; fail = 0
    for (let i = 0; i < 100; i++) {
      for (let retry = 0; retry < 3; retry++) {
        try {
          await fetch('http://localhost:3000', { signal: AbortSignal.timeout(2000) })
          success++
          break
        } catch {
          if (retry === 2) fail++
        }
      }
    }
    console.log(`有重试: 成功 ${success}, 失败 ${fail}`)
    server.close()
  }
  test()
})
```

### 练习二

参考上面的 Service Worker 代码。关键点：
- 使用 Cache API 存储响应
- 网络请求优先，缓存作为降级方案
- 使用 Background Sync API 在网络恢复时更新缓存
