# 阶段实战：同一应用的三种协议性能对比

## 目标

这个阶段的实战任务是：创建一个 Node.js 应用，分别用 HTTP/1.1、HTTP/2、HTTP/3 提供相同的服务，然后在不同网络条件下对比它们的性能。

这不是一个简单的"哪个更快"的对比。我们要理解的是：在什么条件下，哪个协议更适合，为什么。

## 第一步：创建 HTTP/1.1 服务器

```js
// server-http1.js
const http = require('http')

const data = JSON.stringify({
  message: 'Hello from HTTP/1.1',
  timestamp: Date.now(),
  items: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item-${i}` }))
})

const server = http.createServer((req, res) => {
  if (req.url === '/api/data') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    })
    res.end(data)
  } else if (req.url === '/api/resources') {
    // 模拟多个资源请求
    const resources = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      data: `resource-${i}-${'x'.repeat(100)}`
    }))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(resources))
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

server.listen(3001, () => console.log('HTTP/1.1 服务器监听 :3001'))
```

## 第二步：创建 HTTP/2 服务器

```js
// server-http2.js
const http2 = require('http2')

const data = JSON.stringify({
  message: 'Hello from HTTP/2',
  timestamp: Date.now(),
  items: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item-${i}` }))
})

const server = http2.createServer()

server.on('stream', (stream, headers) => {
  const path = headers[':path']

  if (path === '/api/data') {
    stream.respond({ ':status': 200, 'content-type': 'application/json' })
    stream.end(data)
  } else if (path === '/api/resources') {
    const resources = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      data: `resource-${i}-${'x'.repeat(100)}`
    }))
    stream.respond({ ':status': 200, 'content-type': 'application/json' })
    stream.end(JSON.stringify(resources))
  } else {
    stream.respond({ ':status': 404 })
    stream.end('Not Found')
  }
})

server.listen(3002, () => console.log('HTTP/2 服务器监听 :3002'))
```

## 第三步：创建性能测试脚本

```js
// benchmark.js
const http = require('http')
const http2 = require('http2')

async function benchmarkHttp1(url, concurrency, requests) {
  return new Promise((resolve) => {
    const results = []
    let completed = 0
    const start = Date.now()

    function makeRequest() {
      const reqStart = Date.now()
      http.get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => data += chunk)
        res.on('end', () => {
          results.push({ time: Date.now() - reqStart, size: data.length })
          completed++
          if (completed < requests) {
            makeRequest()
          } else if (results.length === requests) {
            resolve({
              protocol: 'HTTP/1.1',
              totalTime: Date.now() - start,
              requests: results.length,
              avgTime: results.reduce((s, r) => s + r.time, 0) / results.length,
              p95Time: results.sort((a, b) => a.time - b.time)[Math.floor(results.length * 0.95)].time
            })
          }
        })
      })
    }

    for (let i = 0; i < Math.min(concurrency, requests); i++) {
      makeRequest()
    }
  })
}

async function benchmarkHttp2(url, concurrency, requests) {
  const client = http2.connect(url.replace(/\/api\/.*/, ''))
  const results = []
  let completed = 0
  const start = Date.now()

  return new Promise((resolve) => {
    function makeRequest() {
      const reqStart = Date.now()
      const path = url.replace(/https?:\/\/[^/]+/, '')
      const req = client.request({ ':path': path })

      let data = ''
      req.on('data', (chunk) => data += chunk)
      req.on('end', () => {
        results.push({ time: Date.now() - reqStart, size: data.length })
        completed++
        if (completed < requests) {
          makeRequest()
        } else if (results.length === requests) {
          client.close()
          resolve({
            protocol: 'HTTP/2',
            totalTime: Date.now() - start,
            requests: results.length,
            avgTime: results.reduce((s, r) => s + r.time, 0) / results.length,
            p95Time: results.sort((a, b) => a.time - b.time)[Math.floor(results.length * 0.95)].time
          })
        }
      })
      req.end()
    }

    for (let i = 0; i < Math.min(concurrency, requests); i++) {
      makeRequest()
    }
  })
}

async function main() {
  const requests = 100
  const concurrency = 10

  console.log(`测试参数: ${requests} 请求, ${concurrency} 并发\n`)

  const http1Result = await benchmarkHttp1('http://localhost:3001/api/data', concurrency, requests)
  console.log('HTTP/1.1:', http1Result)

  const http2Result = await benchmarkHttp2('http://localhost:3002/api/data', concurrency, requests)
  console.log('HTTP/2:', http2Result)

  console.log('\n对比:')
  console.log(`总时间: HTTP/1.1 ${http1Result.totalTime}ms vs HTTP/2 ${http2Result.totalTime}ms`)
  console.log(`平均延迟: HTTP/1.1 ${http1Result.avgTime.toFixed(1)}ms vs HTTP/2 ${http2Result.avgTime.toFixed(1)}ms`)
  console.log(`P95 延迟: HTTP/1.1 ${http1Result.p95Time}ms vs HTTP/2 ${http2Result.p95Time}ms`)
}

main().catch(console.error)
```

## 第四步：模拟不同网络条件

在 Linux 上用 `tc` 模拟高延迟和丢包：

```bash
# 添加 100ms 延迟
sudo tc qdisc add dev lo root netem delay 100ms

# 添加 2% 丢包率
sudo tc qdisc add dev lo root netem delay 100ms loss 2%

# 清除规则
sudo tc qdisc del dev lo root
```

在 macOS 上用 Network Link Conditioner（需要安装 Additional Tools for Xcode）。

在 Windows 上可以用 WSL2 + tc，或者用 Node.js 的网络层模拟：

```js
// 简单的延迟模拟（在服务器端）
function addDelay(handler, delayMs) {
  return (req, res) => {
    setTimeout(() => handler(req, res), delayMs)
  }
}
```

## 第五步：运行测试并分析结果

```bash
# 启动服务器
node server-http1.js &
node server-http2.js &

# 运行基准测试
node benchmark.js

# 在不同网络条件下重复测试
```

**预期结果分析**：

| 场景 | HTTP/1.1 | HTTP/2 | 原因 |
|------|----------|--------|------|
| 低延迟零丢包 | 相近 | 相近 | 差异不明显 |
| 高延迟零丢包 | 较慢 | 较快 | HTTP/2 多路复用减少 RTT |
| 高丢包 | 可能更快 | 较慢 | HTTP/1.1 多连接独立，HTTP/2 单连接受丢包影响 |

## 验收清单

- [ ] HTTP/1.1 和 HTTP/2 服务器都能正常工作
- [ ] 性能测试脚本能正确运行并输出结果
- [ ] 在不同网络条件下运行了测试
- [ ] 能解释为什么 HTTP/2 在某些场景下反而更慢
- [ ] 理解了协议选型不是"越高越好"

## 常见问题

**Q: 为什么 HTTP/2 在本地测试中可能比 HTTP/1.1 慢？**
A: 本地网络延迟接近 0，多路复用的优势体现不出来。而且 HTTP/2 的帧解析、HPACK 编解码有额外的 CPU 开销。只有在高延迟网络上，减少 RTT 的优势才能抵消这些开销。

**Q: 怎么测试 HTTP/3？**
A: Node.js 目前对 HTTP/3 的支持还不完善。可以用 Caddy 做反向代理来提供 HTTP/3，或者用专门的 HTTP/3 测试工具如 `h2load`（需要编译时启用 HTTP/3 支持）。
