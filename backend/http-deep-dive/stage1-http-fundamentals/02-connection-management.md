# 连接管理——Keep-Alive、管线化、并发连接

## 为什么一个页面会打开几十个 TCP 连接

打开 Chrome DevTools 的 Network 面板，访问一个稍微复杂点的网页（比如 GitHub 首页），你会看到几十甚至上百个请求。如果每个请求都要建立一个新的 TCP 连接，光是 TCP 三次握手就要花掉大量时间。在 HTTPS 场景下，还要加上 TLS 握手，延迟会更高。

HTTP 的连接管理机制就是为了解决这个问题：怎么在同一个连接上发多个请求，怎么减少连接建立的开销，怎么在性能和资源之间找平衡。

## HTTP/1.0 的默认行为：短连接

HTTP/1.0 默认每个请求用一个独立的 TCP 连接。客户端发请求 → 收响应 → 关闭连接。下次请求再重新建立连接。

这很直观，但效率很低。一个页面有 10 张图片，就要建立 10 个 TCP 连接，每个连接都要经历：

```
TCP 三次握手（1.5 RTT）→ 发送请求 → 等待响应 → 收到响应 → 关闭连接
```

在延迟 50ms 的网络上，光握手就花了 750ms。

## Keep-Alive：复用连接

HTTP/1.1 默认启用 Keep-Alive（持久连接）。同一个 TCP 连接上可以发送多个请求-响应对，不需要每次都重新建立连接。

用 curl 观察：

```bash
curl -v --http1.1 https://example.com
```

在输出中你会看到：

```
* Connection #0 to host example.com left intact
```

这表示连接没有被关闭，可以复用。如果服务器不支持 Keep-Alive，会返回 `Connection: close` 头部，客户端收到后会关闭连接。

但 Keep-Alive 有一个经典问题：**队头阻塞**（Head-of-Line Blocking）。

假设你在一个连接上依次发了 3 个请求：

```
请求 A（耗时 2s）→ 请求 B（耗时 0.1s）→ 请求 C（耗时 0.1s）
```

虽然 B 和 C 很快就能处理完，但它们必须等 A 的响应回来之后才能被收到。因为 HTTP/1.1 的响应必须按请求顺序返回——你不能先收到 B 的响应再收到 A 的响应。

这意味着如果第一个请求很慢（比如一个复杂的数据库查询），后面的请求都会被阻塞。

## 管线化：理论上的优化

HTTP/1.1 引入了管线化（Pipelining）：客户端可以在收到前一个响应之前就发送下一个请求。

```
客户端：发请求 A → 发请求 B → 发请求 C（不等 A 的响应）
服务端：响应 A → 响应 B → 响应 C（必须按顺序）
```

这减少了等待时间，但问题并没有完全解决——响应仍然必须按顺序返回。如果 A 的处理很慢，B 和 C 的响应虽然已经准备好了，也必须等 A 先返回。

而且管线化在实践中几乎没被采用。原因很多：

- 一些代理服务器不支持管线化，会把管线化的请求搞混
- POST 请求不能管线化（因为语义上可能有副作用，不能重试）
- 如果连接中途断开，已经发送但未收到响应的请求需要重发，但很难判断哪些请求已经被服务器处理了

所以大多数浏览器默认关闭了管线化。这个功能在 HTTP/2 中被多路复用彻底取代。

## 并发连接：绕过队头阻塞的土办法

既然一个连接上有队头阻塞，那就多开几个连接。

HTTP/1.1 规范建议对每个主机最多同时使用 2 个持久连接。但浏览器通常违反这个建议，Chrome 默认对每个主机开 6 个 TCP 连接。

你可以用 Wireshark 验证这一点：

1. 打开 Wireshark，开始捕获
2. 用浏览器访问一个有很多资源的页面
3. 过滤 `tcp.flags.syn == 1`（只看 SYN 包，即新建连接）
4. 你会发现同一个域名有多个同时存在的 TCP 连接

这就是为什么早期的性能优化建议会说"把资源分布在多个子域名上"（比如 `static1.example.com`、`static2.example.com`）——每个子域名可以开 6 个连接，4 个子域名就有 24 个并发连接。

但这个做法有代价：更多的 TCP 连接意味着更多的内存和 CPU 开销（每个连接都要维护状态、拥塞窗口等）。而且 TCP 的拥塞控制是基于连接的，新连接的拥塞窗口很小，一开始发不了多少数据。

## 用 Node.js 观察连接复用

写一个简单的 HTTP 服务器，打印每次连接事件：

```js
const http = require('http')

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  // 模拟慢响应
  setTimeout(() => {
    res.end('OK')
  }, 100)
})

server.on('connection', (socket) => {
  console.log(`[连接] 新连接建立: ${socket.remoteAddress}:${socket.remotePort}`)
  socket.on('close', () => {
    console.log(`[连接] 连接关闭`)
  })
})

server.listen(3000, () => console.log('监听 :3000'))
```

用 curl 发两个请求，观察连接行为：

```bash
# 第一次请求
curl -v http://localhost:3000/a

# 第二次请求
curl -v http://localhost:3000/b
```

默认情况下 curl 会为每个请求建立新连接。但如果你用 `--keepalive`（curl 默认支持），并且请求间隔足够短，可能会看到连接复用。

更明显的实验是用 Node.js 的 `http` 模块做客户端：

```js
const http = require('http')

const agent = new http.Agent({ keepAlive: true, maxSockets: 1 })

function makeRequest(path) {
  return new Promise((resolve) => {
    http.get({ hostname: 'localhost', port: 3000, path, agent }, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => resolve(data))
    })
  })
}

Promise.all([
  makeRequest('/a'),
  makeRequest('/b'),
  makeRequest('/c')
]).then((results) => {
  console.log('全部完成:', results)
})
```

`maxSockets: 1` 强制只用一个连接。你会看到三个请求在同一个连接上依次完成（因为服务端有 100ms 延迟，总耗时约 300ms）。把 `maxSockets` 改成 3，三个请求会并行执行（总耗时约 100ms）。

## Connection 头部的微妙之处

`Connection` 头部是逐跳头部（hop-by-hop header），不会被代理转发。这意味着：

- 客户端发 `Connection: keep-alive` 给代理，代理不会把它转发给源服务器
- 代理需要自己决定跟源服务器用什么连接方式

`Keep-Alive` 头部可以携带超时时间和最大请求数：

```
Keep-Alive: timeout=5, max=100
```

这告诉对方：这个连接最多保持 5 秒空闲，最多复用 100 次。但这些参数只是建议，实现方可以忽略。

## 工程启发

1. **连接数是一个权衡**。更多的并发连接可以减少队头阻塞，但会增加服务器和操作系统的资源消耗。对 HTTP/1.1 来说，6 个并发连接是浏览器和服务器之间的默认平衡点。
2. **队头阻塞是 HTTP/2 诞生的直接原因**。HTTP/1.1 的所有连接管理优化都是在绕过而不是解决队头阻塞。HTTP/2 的多路复用才是真正解决这个问题的方案。
3. **代理服务器是连接管理的变数**。客户端和源服务器之间的 Keep-Alive 行为可能不一致，因为中间的代理、负载均衡器、CDN 都有自己的连接管理策略。

## 练习

### 练习一：用 Wireshark 观察并发连接

1. 打开 Wireshark 开始捕获
2. 用浏览器访问 `https://example.com`
3. 在 Wireshark 中过滤 `tcp.flags.syn == 1 && ip.dst == 93.184.216.34`（example.com 的 IP）
4. 记录观察到了几个并发 TCP 连接

### 练习二：对比单连接和多连接的性能差异

用 Node.js 写一个服务端（带 50ms 延迟）和一个客户端，分别测试：
- 1 个连接串行发 10 个请求
- 6 个连接并发发 10 个请求

记录总耗时，验证队头阻塞的影响。

---

## 参考答案

### 练习一

**答案**：对于 example.com 这样简单的页面（只有一个 HTML 文件，没有 CSS/JS/图片），通常只建立 1-2 个 TCP 连接。如果访问更复杂的页面（如 GitHub），你会看到 6 个并发连接指向同一个 IP，这是浏览器对 HTTP/1.1 的并发连接上限。

在 Wireshark 中还可以看到连接的生命周期：建立（SYN/SYN-ACK/ACK）→ 数据传输 → 空闲一段时间后关闭（FIN）。Keep-Alive 连接在最后一次请求完成后不会立即关闭，而是保持一段时间等待新请求。

### 练习二

**思路**：对比两种场景的总耗时。

```js
const http = require('http')

const server = http.createServer((req, res) => {
  setTimeout(() => res.end('OK'), 50)
})

server.listen(3000, () => {
  // 串行：单连接
  const agent1 = new http.Agent({ keepAlive: true, maxSockets: 1 })
  const start1 = Date.now()
  let done1 = 0
  for (let i = 0; i < 10; i++) {
    http.get({ hostname: 'localhost', port: 3000, path: `/${i}`, agent: agent1 }, (res) => {
      res.resume()
      res.on('end', () => {
        done1++
        if (done1 === 10) {
          console.log(`单连接串行: ${Date.now() - start1}ms`)
          testParallel()
        }
      })
    })
  }

  function testParallel() {
    // 并行：6 连接
    const agent2 = new http.Agent({ keepAlive: true, maxSockets: 6 })
    const start2 = Date.now()
    let done2 = 0
    for (let i = 0; i < 10; i++) {
      http.get({ hostname: 'localhost', port: 3000, path: `/${i}`, agent: agent2 }, (res) => {
        res.resume()
        res.on('end', () => {
          done2++
          if (done2 === 10) {
            console.log(`6连接并发: ${Date.now() - start2}ms`)
            server.close()
          }
        })
      })
    }
  }
})
```

**预期结果**：单连接串行约 500ms（10 × 50ms），6 连接并发约 100-150ms（2 批 × 50ms）。这说明队头阻塞在慢响应场景下的影响非常大。

**常见错误**：
- 忘记设置 `maxSockets`，Node.js 默认不限制并发连接数
- 忘记调用 `res.resume()` 消费响应体，导致连接被占满
