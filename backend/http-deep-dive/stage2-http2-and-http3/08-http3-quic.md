# HTTP/3 与 QUIC——为什么要在 UDP 上建可靠传输

## TCP 的队头阻塞是 HTTP/2 的阿喀琉斯之踵

HTTP/2 解决了 HTTP 层面的队头阻塞，但引入了一个新问题：TCP 层面的队头阻塞。

HTTP/2 把所有请求复用在一个 TCP 连接上。TCP 是可靠传输协议，它保证数据按序到达。如果中间有一个 TCP 段丢了，TCP 必须等这个段重传成功后，才能把后续的数据交给应用层——即使后续的数据已经到达了。

在丢包率 2% 的网络上（这在移动网络上很常见），HTTP/2 的性能可能还不如 HTTP/1.1 开 6 个连接。因为 HTTP/1.1 的 6 个连接是独立的，一个连接丢包不影响其他连接。

HTTP/3 的解决方案是：不用 TCP 了，改用基于 UDP 的 QUIC 协议。

## QUIC 是什么

QUIC（Quick UDP Internet Connections）最初是 Google 设计的传输层协议，现在由 IETF 标准化（RFC 9000）。

QUIC 在 UDP 之上实现了：
- 可靠传输（像 TCP）
- 流量控制（像 TCP）
- 拥塞控制（像 TCP）
- 多路复用（HTTP/2 的核心特性）
- 内置 TLS 1.3（安全层不再是可选的）

关键区别：QUIC 的多路复用是在传输层实现的，每个流是独立的。一个流丢包只影响这个流，其他流不受影响。

## 为什么基于 UDP

TCP 是操作系统内核实现的，修改 TCP 需要改内核代码，部署周期长。UDP 很简单，用户态程序可以自由实现任何传输逻辑。

QUIC 选择在 UDP 上实现，意味着：
- 可以在用户态快速迭代
- 不需要操作系统更新
- 可以跨平台一致实现
- 可以绕过中间网络设备对 TCP 的干扰

## 连接建立速度

TCP + TLS 1.2 的连接建立需要 3 个 RTT：

```
TCP 三次握手: 1 RTT
TLS 1.2 握手: 2 RTT
总计: 3 RTT
```

TCP + TLS 1.3 需要 2 个 RTT：

```
TCP 三次握手: 1 RTT
TLS 1.3 握手: 1 RTT
总计: 2 RTT
```

QUIC 把传输握手和加密握手合并了，首次连接只需要 1 个 RTT：

```
QUIC 握手（含 TLS 1.3）: 1 RTT
```

而且 QUIC 支持 0-RTT 恢复：如果客户端之前连接过这个服务器，可以在第一个数据包中就带上应用数据，实现 0 RTT 建连。

## 用 curl 测试 HTTP/3

curl 从 7.88.0 开始支持 HTTP/3（需要编译时启用）。测试方法：

```bash
# 检查 curl 是否支持 HTTP/3
curl --version | grep -i http3

# 访问支持 HTTP/3 的网站
curl --http3 https://www.cloudflare.com -v
```

在输出中你会看到 `* Alt-Svc: h3=":443"` 这样的头部，表示服务器支持 HTTP/3。

## 用 Node.js 创建 HTTP/3 服务器

Node.js 从 v21 开始实验性支持 HTTP/3（通过 `--experimental-quic` 标志）。目前更稳定的方案是用第三方库如 `@aspect-build/rules_js` 或直接用支持 HTTP/3 的反向代理（如 Caddy、Nginx）。

以下是概念性的代码结构（需要特定环境支持）：

```js
// 注意：这需要 Node.js 的实验性 QUIC 支持
// 实际运行可能需要特定版本和编译标志
const { createQuicSocket } = require('net')

// QUIC 的 API 与 TCP 类似，但底层是 UDP
```

实际上，大多数 HTTP/3 的部署方式是：

1. 用 Caddy 或 Nginx 做反向代理，它们支持 HTTP/3
2. 后端服务仍然用 HTTP/1.1 或 HTTP/2
3. 反向代理负责协议转换

## HTTP/3 的帧格式变化

HTTP/3 的帧格式跟 HTTP/2 不同：

- HTTP/2 的帧有固定的 9 字节帧头
- HTTP/3 的帧用变长整数编码，帧头更紧凑
- HTTP/3 去掉了 HTTP/2 的一些复杂性（如优先级、SETTINGS 的 ACK 机制）

HTTP/3 用 QPACK 替代了 HPACK 做头部压缩。QPACK 允许头部表的更新和引用可以乱序到达，解决了 HPACK 在多路复用场景下的同步问题。

## HTTP/3 的部署现状

HTTP/3 的支持情况：

- **浏览器**：Chrome、Firefox、Safari、Edge 都支持
- **CDN**：Cloudflare、AWS CloudFront、Google Cloud CDN 都支持
- **服务器**：Caddy 原生支持，Nginx 从 1.25 开始支持
- **Node.js**：实验性支持，生产环境建议用反向代理

## 工程启发

1. **HTTP/3 的主要收益在高丢包网络**。在数据中心内部（低延迟、零丢包），HTTP/2 和 HTTP/3 的差异不大。HTTP/3 的优势在移动网络、跨国访问等场景。
2. **0-RTT 有重放攻击风险**。0-RTT 数据没有前向安全性保护，可能被重放。对于有副作用的请求（如 POST），不应该用 0-RTT。
3. **协议升级是渐进的**。HTTP/3 不会一夜之间替代 HTTP/2。实际部署中，客户端通过 Alt-Svc 头部发现服务器支持 HTTP/3，然后在后续连接中尝试使用。

## 练习

### 练习一：用 Wireshark 观察 QUIC 流量

1. 在 Chrome 中访问一个支持 HTTP/3 的网站（如 `https://www.cloudflare.com`）
2. 在 Wireshark 中过滤 `quic` 协议
3. 观察 QUIC 包的结构：长头（Initial）和短头（1-RTT）
4. 记录连接建立过程中包的数量

### 练习二：对比 HTTP/2 和 HTTP/3 在丢包环境下的表现

用 `tc`（Linux）或 Network Link Conditioner（macOS）模拟 2% 的丢包率，分别用 HTTP/2 和 HTTP/3 下载一个大文件，对比下载速度。

---

## 参考答案

### 练习一

**预期观察**：
- QUIC 使用 UDP 端口 443
- 连接建立的第一个包是 Initial 包，包含客户端 hello
- 服务器的 Initial 包包含服务器 hello 和证书
- 后续数据用 1-RTT 包头（更短）
- 每个 QUIC 包可以包含多个帧

Wireshark 可能需要配置 QUIC 的密钥日志（跟 TLS 类似，设置 `SSLKEYLOGFILE`）才能解密载荷。

### 练习二

**预期结果**：在 2% 丢包率下：
- HTTP/2 的吞吐量会显著下降（因为 TCP 队头阻塞）
- HTTP/3 的吞吐量下降较少（因为 QUIC 的流是独立的）

具体数据取决于 RTT 和带宽。在 100ms RTT + 2% 丢包的典型场景下，HTTP/3 通常比 HTTP/2 快 20-50%。

**注意**：这个实验需要在 Linux 或 macOS 上进行（`tc` 命令）。Windows 用户可以用 WSL2 或 Network Link Conditioner（需要 macOS）。
