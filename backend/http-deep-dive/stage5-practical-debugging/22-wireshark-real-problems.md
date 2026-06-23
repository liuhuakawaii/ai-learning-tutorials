# 抓包分析真实问题——用 Wireshark 定位"请求发了但没响应"

## 抓包是终极排查手段

当 curl 的 `-v` 输出不够用，当日志里看不到问题，当浏览器 DevTools 只显示"请求失败"——你需要抓包。

Wireshark 能让你看到网络上实际传输的每一个字节。它是排查网络问题的终极工具。

这节课我们用 Wireshark 分析三个真实的网络问题场景。

## 场景一：TCP 连接建立失败

**现象**：curl 报错 `Connection refused`。

**抓包分析**：

1. 打开 Wireshark，开始捕获
2. 过滤 `tcp.flags.syn == 1`（只看 SYN 包）
3. 发起请求
4. 观察是否有 SYN-ACK 响应

如果看到 SYN 包被 RST（TCP RST 标志位），说明目标端口没有监听：

```
客户端 → 服务器: SYN
服务器 → 客户端: RST, ACK  (端口未监听)
```

如果看到 SYN 包后没有任何响应，说明：
- 防火墙丢弃了 SYN 包
- 服务器宕机了
- 网络不通

```bash
# 测试端口是否开放
nc -zv example.com 443

# 测试防火墙是否阻断
traceroute -p 443 example.com
```

## 场景二：TLS 握手失败

**现象**：curl 报错 `SSL: CERTIFICATE_VERIFY_FAILED` 或 `handshake failure`。

**抓包分析**：

1. 配置 SSLKEYLOGFILE 让 Wireshark 能解密 TLS
2. 过滤 `tls.handshake`
3. 观察握手过程

常见的失败模式：

**证书过期**：
```
ClientHello → ServerHello → Certificate → Alert: certificate expired
```

**密码套件不匹配**：
```
ClientHello (支持的密码套件列表) → ServerHello (选择的密码套件) → Alert: handshake failure
```

如果服务器选择的密码套件客户端不支持，握手会失败。用 openssl 检查：

```bash
# 列出客户端支持的密码套件
openssl ciphers -v 'HIGH:!aNULL:!MD5'

# 测试服务器支持的密码套件
openssl s_client -connect example.com:443 -cipher 'ECDHE-RSA-AES128-GCM-SHA256'
```

**SNI 不匹配**：
```
ClientHello (SNI: wrong.example.com) → Alert: unrecognized_name
```

## 场景三：HTTP 请求发了但响应很慢

**现象**：curl 报错 `Operation timed out`，或者响应延迟很高。

**抓包分析**：

1. 过滤 `tcp.stream eq N`（N 是具体的 TCP 流编号）
2. 观察数据包的时间戳
3. 查看 TCP 层的行为

可能的原因：

**TCP 窗口为零**：
```
客户端 → 服务器: 数据
服务器 → 客户端: ACK, Window: 0  (接收缓冲区满了)
客户端 → 服务器: [等待窗口更新]
```

服务器处理不过来，接收缓冲区满了，告诉客户端"别发了"。客户端只能等服务器处理完数据后发送 `Window Update`。

**大量重传**：
```
客户端 → 服务器: 数据 (Seq=1000)
[超时]
客户端 → 服务器: 数据 (Seq=1000) [重传]
[超时]
客户端 → 服务器: 数据 (Seq=1000) [重传]
```

丢包导致 TCP 重传，每次重传等待时间翻倍（指数退避）。

**服务端处理慢**：
```
客户端 → 服务器: POST /api/heavy-query [请求数据]
[等待 5 秒]
服务器 → 客户端: HTTP/1.1 200 OK [响应数据]
```

请求和响应之间有很长的间隔，说明服务器在处理请求时卡住了。这不是网络问题，是应用层问题。

## Node.js 服务器模拟这些场景

```js
const http = require('http')

// 场景：慢响应
const slowServer = http.createServer((req, res) => {
  if (req.url === '/slow') {
    // 模拟数据库查询很慢
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ data: 'slow result' }))
    }, 5000)
  } else if (req.url === '/big') {
    // 模拟大响应
    res.writeHead(200, { 'Content-Type': 'application/json' })
    const data = 'x'.repeat(10 * 1024 * 1024)  // 10MB
    res.end(JSON.stringify({ data }))
  } else if (req.url === '/chunked') {
    // 分块传输，每块延迟 1 秒
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked'
    })
    let count = 0
    const interval = setInterval(() => {
      count++
      if (count > 5) {
        res.end()
        clearInterval(interval)
        return
      }
      res.write(`chunk ${count}\n`)
    }, 1000)
  }
})

slowServer.listen(3000, () => console.log('监听 :3000'))
```

测试并用 Wireshark 抓包：

```bash
# 慢响应
curl -v --max-time 10 http://localhost:3000/slow

# 大响应
curl -v http://localhost:3000/big

# 分块传输
curl -v -N http://localhost:3000/chunked
```

## Wireshark 实用过滤器

```bash
# HTTP 请求
http.request

# HTTP 响应
http.response

# 特定域名
http.host == "example.com"

# TCP 重传
tcp.analysis.retransmission

# TCP 零窗口
tcp.analysis.zero_window

# TLS 握手
tls.handshake

# TLS 告警
tls.alert_message

# 特定 IP
ip.addr == 192.168.1.100

# 特定端口
tcp.port == 443

# DNS 查询
dns
```

## 用 Follow TCP Stream 看完整对话

在 Wireshark 中，右键点击一个 TCP 包 → Follow → TCP Stream，可以看到这个 TCP 连接上的所有数据，包括 HTTP 请求和响应的完整内容。

这对排查 HTTP 层的问题非常有用：你可以看到实际发送和接收的字节，而不是 curl 或浏览器显示的格式化内容。

## 工程启发

1. **抓包是最后的手段，但也是最可靠的**。日志可能有 bug，监控可能有盲区，但网络上的数据包是真实的。
2. **分层排查**。先看 TCP 层（连接是否建立、有没有重传），再看 TLS 层（握手是否成功），最后看 HTTP 层（请求和响应的内容）。
3. **时间线很重要**。在 Wireshark 中看时间戳，能帮你判断延迟发生在哪一步。

## 练习

### 练习一：用 Wireshark 抓取 HTTP 请求的完整过程

1. 启动 Wireshark，选择正确的网卡
2. 设置过滤器 `tcp.port == 3000`
3. 用 curl 发一个请求到本地服务器
4. 在 Wireshark 中找到这个 TCP 流
5. 记录：SYN、SYN-ACK、HTTP 请求、HTTP 响应、FIN 的时间戳

### 练习二：模拟并分析 TCP 重传

用 Node.js 创建一个服务器，在响应前故意等待 10 秒。用 Wireshark 抓包，观察：
- TCP 窗口是否变为零
- 是否有重传
- 客户端是否有超时机制

---

## 参考答案

### 练习一

**预期时间线**：
- T=0ms: SYN
- T=0ms: SYN-ACK（本地网络延迟接近零）
- T=0ms: ACK（三次握手完成）
- T=0ms: HTTP 请求
- T=1-10ms: HTTP 响应（取决于服务器处理时间）
- T=响应后: FIN（如果是非 Keep-Alive 连接）

在本地网络上，整个过程可能在 10ms 内完成。在远程网络上，每个 RTT 都会增加延迟。

### 练习二

**预期观察**：
- TCP 窗口可能不会变为零（因为服务器没有收到大量数据）
- 但如果客户端发送了大量请求体，服务器处理慢，窗口可能变为零
- curl 的 `--max-time` 选项会在应用层超时，但 TCP 连接可能仍然保持
- 在 Wireshark 中可以看到 curl 发送 RST 来关闭连接（而不是正常的 FIN）
