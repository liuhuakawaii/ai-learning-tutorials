# 协议选型——什么时候用 HTTP/1.1、HTTP/2、HTTP/3

## 版本越高不等于越好

每次有新协议出来，总有人说"赶紧升级"。但协议选型不是追新版本，而是在具体场景下做权衡。HTTP/1.1、HTTP/2、HTTP/3 各有适用场景，选错了反而会更差。

这节课我们从工程角度分析三个版本的优劣，给出具体的选型建议。

## HTTP/1.1 仍然适用的场景

HTTP/1.1 没有过时。以下场景用 HTTP/1.1 反而更合适：

**内部服务间通信**：数据中心内部网络延迟低（<1ms）、丢包率接近零。HTTP/2 的多路复用和头部压缩在这种环境下收益很小，反而增加了实现复杂度。很多公司的内部 RPC 仍然用 HTTP/1.1 + JSON。

**简单的 API 服务**：如果你的 API 每秒只有几百个请求，每个请求的响应时间很短，HTTP/1.1 的 6 个并发连接完全够用。HTTP/2 的多路复用在这种场景下没有明显优势。

**调试和开发**：HTTP/1.1 是纯文本协议，用 curl、Wireshark 甚至肉眼就能看懂。HTTP/2 是二进制帧，调试时需要工具解码。开发阶段用 HTTP/1.1 更方便。

**客户端兼容性**：虽然现代浏览器都支持 HTTP/2，但你不能假设所有客户端都支持。物联网设备、老版本的 HTTP 客户端库、某些企业内网的代理服务器可能只支持 HTTP/1.1。

## HTTP/2 适用的场景

HTTP/2 的核心优势是多路复用和头部压缩，以下场景能充分发挥这些优势：

**Web 前端**：一个页面可能有 50-100 个请求（HTML、CSS、JS、图片、字体）。HTTP/1.1 需要 6 个 TCP 连接来并发，HTTP/2 只需要 1 个连接就能处理所有请求。减少了连接数，也减少了 TCP 慢启动的开销。

**高延迟网络**：跨洋请求的 RTT 可能有 100-200ms。HTTP/1.1 的队头阻塞在这种网络上影响很大，HTTP/2 的多路复用可以显著减少总延迟。

**gRPC**：gRPC 基于 HTTP/2，利用了多路复用、双向流、头部压缩等特性。如果你用 gRPC，就必须用 HTTP/2。

**服务器推送（已弃用）**：虽然 HTTP/2 的服务器推送已被浏览器弃用，但在特定场景（如内网应用、嵌入式设备）中仍然有用。

## HTTP/3 适用的场景

HTTP/3 的核心优势是解决了 TCP 层面的队头阻塞，以下场景收益最大：

**移动网络**：移动网络的丢包率通常在 1-5%，切换基站时会丢包。HTTP/2 在这种环境下性能下降明显，HTTP/3 的 QUIC 协议能更好地处理丢包。

**弱网环境**：高丢包 + 高延迟的网络（如偏远地区的 3G 网络），HTTP/3 的优势最明显。

**频繁建连**：QUIC 的 0-RTT 恢复对于需要频繁建立新连接的场景很有价值。但要注意 0-RTT 的重放攻击风险。

**连接迁移**：QUIC 使用连接 ID 而不是 IP + 端口来标识连接。当用户的 IP 地址变化时（比如从 Wi-Fi 切换到 4G），QUIC 连接可以无缝迁移，不需要重新建连。

## 不应该用 HTTP/3 的场景

**数据中心内部**：低延迟、零丢包的网络中，QUIC 的 UDP 开销可能比 TCP 更大。而且 QUIC 的用户态实现不如内核 TCP 高效。

**资源受限的设备**：QUIC 的实现比 TCP 复杂得多，需要更多的 CPU 和内存。对于嵌入式设备，可能没有足够的资源运行 QUIC。

**需要中间设备处理**：某些网络设备（防火墙、负载均衡器、代理）对 TCP 的支持比 UDP 好。UDP 流量可能被限速或阻断。

## 协议协商机制

客户端和服务器怎么协商用哪个协议？

**ALPN（Application-Layer Protocol Negotiation）**：在 TLS 握手阶段，客户端告诉服务器自己支持哪些协议，服务器选择一个。这是 HTTP/2 和 HTTP/3 的主要协商方式。

```bash
# 用 openssl 查看服务器支持的 ALPN 协议
openssl s_client -connect example.com:443 -alpn h2,http/1.1
```

**Alt-Svc 头部**：服务器在 HTTP/2 响应中通过 `Alt-Svc` 头部告诉客户端"我还支持 HTTP/3"：

```
Alt-Svc: h3=":443"; ma=86400
```

客户端下次连接时会尝试用 HTTP/3。如果 QUIC 连接失败，自动回退到 HTTP/2。

**Upgrade 头部**：HTTP/1.1 可以通过 `Upgrade` 头部升级到 HTTP/2，但实际上很少用，因为浏览器不支持这种升级方式。

## 性能对比的实际数据

以下是一些公开的性能对比数据（仅供参考，实际性能取决于具体环境）：

**低延迟网络（RTT < 10ms）**：
- HTTP/1.1 和 HTTP/2 差异不大
- HTTP/3 略慢于 HTTP/2（UDP 开销）

**高延迟网络（RTT ~100ms）**：
- HTTP/2 比 HTTP/1.1 快 20-30%（多路复用）
- HTTP/3 和 HTTP/2 差异不大（零丢包）

**高丢包网络（丢包率 2%）**：
- HTTP/2 可能比 HTTP/1.1 慢（TCP 队头阻塞）
- HTTP/3 比 HTTP/2 快 20-50%（独立流）

## 工程启发

1. **协议选型要考虑整个链路**。不只是客户端和服务器之间的协议，还有中间的代理、CDN、负载均衡器。如果中间设备不支持 HTTP/2，客户端和服务器支持也没用。
2. **渐进升级是正确的策略**。先确保 HTTP/2 工作正常，再考虑 HTTP/3。不要跳过 HTTP/2 直接上 HTTP/3。
3. **监控比选择更重要**。选了协议之后，要监控实际的性能指标（延迟、吞吐量、错误率），用数据验证选择是否正确。

## 练习

### 练习一：测试你访问的网站用什么协议

用 curl 访问以下网站，记录它们使用的协议版本：

```bash
curl -v https://www.google.com 2>&1 | grep "HTTP/"
curl -v https://www.cloudflare.com 2>&1 | grep "HTTP/"
curl -v https://github.com 2>&1 | grep "HTTP/"
```

### 练习二：用 Node.js 创建一个同时支持 HTTP/1.1 和 HTTP/2 的服务器

创建一个服务器，同时监听 HTTP/1.1 和 HTTP/2。用 curl 分别用两种协议访问，验证都能正常工作。

---

## 参考答案

### 练习一

**预期结果**：
- Google、Cloudflare、GitHub 通常返回 HTTP/2
- 如果 curl 支持 HTTP/3，Cloudflare 可能返回 HTTP/3
- 某些网站可能仍然返回 HTTP/1.1

注意 curl 的 `-v` 选项会显示协商的协议版本。如果看到 `HTTP/2.0`，说明协商成功了。

### 练习二

**思路**：Node.js 的 `http2` 模块支持创建同时处理 HTTP/1.1 和 HTTP/2 的服务器。

```js
const http2 = require('http2')
const { HTTP2_HEADER_PATH } = http2.constants

const server = http2.createServer()

server.on('stream', (stream, headers) => {
  const path = headers[HTTP2_HEADER_PATH]
  console.log(`请求: ${path} (协议: ${stream.session.alpnProtocol || 'h2c'})`)

  stream.respond({ ':status': 200, 'content-type': 'application/json' })
  stream.end(JSON.stringify({
    protocol: stream.session.alpnProtocol || 'h2c',
    streamId: stream.id
  }))
})

server.listen(3000, () => {
  console.log('监听 :3000')
})
```

测试：

```bash
# HTTP/2 (h2c)
curl --http2-prior-knowledge http://localhost:3000/

# HTTP/1.1
curl --http1.1 http://localhost:3000/
```

**注意**：明文 HTTP/2（h2c）和 HTTP/1.1 可以在同一个端口上共存，因为 HTTP/2 的连接前奏（24 字节）跟 HTTP/1.1 的请求格式不同。但如果用 TLS，需要通过 ALPN 来协商协议。
