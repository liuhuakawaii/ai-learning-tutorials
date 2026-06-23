# TLS 1.3 的改进——1-RTT 握手、0-RTT 恢复

## TLS 1.2 的问题

TLS 1.2 是 2008 年发布的，用了十多年。它的主要问题是握手太慢：

```
TLS 1.2 完整握手:
客户端 → 服务器: ClientHello
服务器 → 客户端: ServerHello + Certificate + ServerKeyExchange + ServerHelloDone
客户端 → 服务器: ClientKeyExchange + ChangeCipherSpec + Finished
服务器 → 客户端: ChangeCipherSpec + Finished

总计: 2 个 RTT
```

在 100ms RTT 的网络上，光握手就要 200ms。加上 TCP 的三次握手（1 RTT），总共需要 300ms 才能开始传输第一个字节的应用数据。

TLS 1.3 的目标是减少握手时间，同时提高安全性。

## TLS 1.3 的 1-RTT 握手

```
TLS 1.3 握手:
客户端 → 服务器: ClientHello + key_share
服务器 → 客户端: ServerHello + key_share + EncryptedExtensions + Certificate + CertificateVerify + Finished
客户端 → 服务器: Finished

总计: 1 个 RTT
```

TLS 1.3 把服务器的多个消息合并成一个往返，并且在 ServerHello 之后就开始加密通信。这比 TLS 1.2 少了一个 RTT。

怎么做到的？关键在于客户端在 ClientHello 中就发送了自己的 DH 公钥（`key_share`），服务器在 ServerHello 中返回自己的 DH 公钥。双方可以立即计算出共享密钥，不需要像 TLS 1.2 那样先协商参数再交换密钥。

## 0-RTT 恢复

TLS 1.3 还支持 0-RTT 恢复：如果客户端之前连接过这个服务器，可以在第一个数据包中就带上应用数据，实现零延迟建连。

```
TLS 1.3 0-RTT:
客户端 → 服务器: ClientHello + key_share + 早期数据（应用数据）
服务器 → 客户端: ServerHello + Finished + 响应数据

总计: 0 个 RTT（对于应用数据）
```

0-RTT 的原理是：客户端保存了上次连接的 PSK（Pre-Shared Key），用这个密钥加密早期数据。服务器收到后用 PSK 解密，同时进行正常的密钥交换。

## 0-RTT 的安全风险

0-RTT 有一个严重的安全问题：**重放攻击**。

攻击者可以捕获客户端的 0-RTT 数据包，然后重新发送给服务器。服务器无法区分这是客户端的原始请求还是攻击者的重放。

这在以下场景下很危险：

- 如果 0-RTT 数据是一个 POST 请求（比如转账），重放会导致重复执行
- 如果 0-RTT 数据包含了幂等性假设（比如"只执行一次"），重放会破坏这个假设

TLS 1.3 规范建议：
- 0-RTT 数据只用于幂等请求（GET、HEAD）
- 服务器应该限制 0-RTT 的使用（比如只允许特定路径）
- 服务器可以用 `early_data` 扩展拒绝 0-RTT 数据

## 用 curl 观察 TLS 1.3

```bash
# 强制使用 TLS 1.3
curl -v --tlsv1.3 https://example.com 2>&1 | grep -i "tls\|ssl"

# 查看是否使用了 0-RTT
curl -v --tlsv1.3 --tls-max 1.3 https://example.com 2>&1 | grep -i "early\|0-rtt"
```

用 Wireshark 观察 TLS 1.3 握手：

1. 配置 SSLKEYLOGFILE
2. 过滤 `tls.handshake.type == 1`（ClientHello）
3. 展开 ClientHello 的扩展，找到 `supported_versions` 和 `key_share`
4. 观察 ServerHello 之后的数据是否被加密

## TLS 1.3 去掉了什么

TLS 1.3 不只是添加了新特性，还删除了很多不安全或不必要的东西：

**删除的密码套件**：
- 所有非 AEAD 的密码套件（如 CBC 模式的 AES）
- 所有使用 SHA-1 的密码套件
- 所有使用 RSA 密钥交换的密码套件（不提供前向安全性）
- 所有使用静态 DH 的密码套件

**删除的功能**：
- 压缩（导致 CRIME 攻击）
- 重新协商（导致 Triple Handshake 攻击）
- DSA 证书
- 导出密钥（export keying material）的旧方式

**简化的功能**：
- 密码套件列表从几十个减少到 5 个
- 握手消息格式更简单
- 密钥派生用 HKDF 替代了 PRF

## 用 Node.js 验证 TLS 版本

```js
const https = require('https')
const fs = require('fs')

const options = {
  key: fs.readFileSync('./certs/server.key'),
  cert: fs.readFileSync('./certs/server.crt'),
  // Node.js 默认支持 TLS 1.3
  // 可以通过 minVersion/maxVersion 控制
  minVersion: 'TLSv1.3',
  maxVersion: 'TLSv1.3'
}

const server = https.createServer(options, (req, res) => {
  const tlsVersion = req.socket.getProtocol()
  const cipher = req.socket.getCipher()

  console.log(`TLS 版本: ${tlsVersion}`)
  console.log(`密码套件: ${cipher.name}`)

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ tlsVersion, cipher: cipher.name }))
})

server.listen(3000, () => console.log('监听 :3000'))
```

测试：

```bash
# TLS 1.3
curl -vk --tlsv1.3 https://localhost:3000

# TLS 1.2（如果服务器允许）
curl -vk --tlsv1.2 https://localhost:3000
```

## 前向安全性（Forward Secrecy）

TLS 1.3 强制使用前向安全性。这意味着即使服务器的长期私钥泄露了，过去的通信记录仍然安全。

前向安全性的原理是：每次连接都生成临时的 DH 密钥对，用完就丢。即使攻击者拿到了服务器的长期私钥，也无法解密过去捕获的流量，因为临时密钥已经不存在了。

TLS 1.2 可以选择不用前向安全性（比如用 RSA 密钥交换），TLS 1.3 强制使用（只支持 (EC)DHE 密钥交换）。

## 工程启发

1. **TLS 1.3 应该是默认选择**。所有现代浏览器和服务器都支持 TLS 1.3。除非你有兼容性需求（比如需要支持老版本的 Java 客户端），否则应该强制使用 TLS 1.3。
2. **0-RTT 要谨慎使用**。只在幂等请求中使用 0-RTT。对于有副作用的请求（POST、PUT、DELETE），应该等握手完成后再发送。
3. **证书管理已经不是障碍**。Let's Encrypt 提供免费证书，certbot/acme.sh 自动续期。没有理由不用 HTTPS。

## 练习

### 练习一：对比 TLS 1.2 和 TLS 1.3 的握手时间

用 curl 的 `--trace-time` 选项，分别用 TLS 1.2 和 TLS 1.3 访问同一个网站，对比握手完成的时间。

```bash
curl -v --trace-time --tlsv1.2 https://example.com 2>&1 | head -20
curl -v --trace-time --tlsv1.3 https://example.com 2>&1 | head -20
```

### 练习二：用 Node.js 测试 TLS 版本协商

创建一个服务器，同时支持 TLS 1.2 和 TLS 1.3。用 curl 分别用两个版本访问，打印协商的 TLS 版本和密码套件。

---

## 参考答案

### 练习一

**预期结果**：TLS 1.3 的握手通常比 TLS 1.2 快一个 RTT。在本地网络上差异不明显（RTT < 1ms），在远程网络上差异可能有 100-200ms。

用 `--trace-time` 可以看到每个步骤的时间戳。对比 `SSL connection using` 这一行出现的时间，就是握手完成的时间。

### 练习二

```js
const https = require('https')
const fs = require('fs')

const options = {
  key: fs.readFileSync('./certs/server.key'),
  cert: fs.readFileSync('./certs/server.crt'),
  // 不设置 minVersion/maxVersion，让 Node.js 自动协商
}

const server = https.createServer(options, (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    protocol: req.socket.getProtocol(),
    cipher: req.socket.getCipher().name
  }))
})

server.listen(3000, () => console.log('监听 :3000'))
```

测试：

```bash
curl -vk --tlsv1.2 https://localhost:3000  # 应该返回 TLSv1.2
curl -vk --tlsv1.3 https://localhost:3000  # 应该返回 TLSv1.3
```

**预期发现**：TLS 1.3 的密码套件名称中包含 `SHA256` 或 `SHA384`（如 `TLS_AES_128_GCM_SHA256`），而 TLS 1.2 的密码套件名称更长（如 `ECDHE-RSA-AES128-GCM-SHA256`）。
