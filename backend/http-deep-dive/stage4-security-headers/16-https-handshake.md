# HTTPS 握手全流程——ClientHello → 证书验证 → 密钥交换

## 为什么需要 HTTPS

HTTP 是明文协议。你发的每一个字节——请求头、请求体、Cookie、密码——在网络上都是裸奔的。中间人（比如同一 Wi-Fi 下的攻击者、恶意的 ISP、国家级的网络设备）可以：

- **窃听**：看到你发的所有内容
- **篡改**：修改请求或响应（比如往页面里注入广告或恶意脚本）
- **冒充**：假装自己是目标服务器

HTTPS 就是在 HTTP 下面加了一层 TLS（Transport Layer Security）。TLS 做三件事：

1. **加密**：第三方看不到内容
2. **完整性**：第三方改不了内容
3. **身份认证**：你确实在跟目标服务器通信

## TLS 握手的目标

TLS 握手要解决的核心问题是：客户端和服务器如何在不安全的网络上协商出一个只有双方知道的加密密钥？

这听起来像是鸡生蛋蛋生鸡的问题——如果网络不安全，怎么安全地交换密钥？答案是非对称加密和 Diffie-Hellman 密钥交换。

## 用 Wireshark 观察 TLS 握手

打开 Wireshark，捕获访问 `https://example.com` 的流量。过滤 `tls.handshake`，你会看到以下步骤：

### 第一步：ClientHello

客户端发送 ClientHello，告诉服务器：

```
ClientHello:
  版本: TLS 1.2
  随机数: 32 字节的随机数（后面用于生成密钥）
  会话 ID: 空（新连接）
  密码套件列表:
    TLS_AES_128_GCM_SHA256
    TLS_AES_256_GCM_SHA384
    TLS_CHACHA20_POLY1305_SHA256
    ...（客户端支持的所有密码套件）
  扩展:
    server_name: example.com          (SNI)
    supported_versions: TLS 1.3, TLS 1.2
    supported_groups: x25519, secp256r1
    key_share: x25519 公钥
    signature_algorithms: ...
```

**SNI（Server Name Indication）** 告诉服务器客户端想访问哪个域名。这是因为一个 IP 地址可能托管多个网站（虚拟主机），服务器需要知道用哪个证书。

### 第二步：ServerHello

服务器回复 ServerHello，选择参数：

```
ServerHello:
  版本: TLS 1.3
  随机数: 32 字节
  会话 ID: ...
  密码套件: TLS_AES_128_GCM_SHA256
  扩展:
    key_share: x25519 公钥
```

服务器从客户端的列表中选择一个密码套件，并返回自己的 DH 公钥。

### 第三步：证书和密钥交换

服务器发送：

```
Certificate:
  证书链:
    - example.com 的证书（叶子证书）
    - 中间 CA 的证书
    - 根 CA 的证书（可选，通常不发）

CertificateVerify:
  用服务器私钥对握手消息的签名

Finished:
  握手完成的验证数据
```

客户端收到证书后，验证：
1. 证书是否过期
2. 证书的域名是否匹配
3. 证书是否由受信任的 CA 签发
4. 证书链是否完整

### 第四步：客户端完成

客户端发送：

```
Finished:
  握手完成的验证数据
```

此时双方都有了足够的信息来生成对称加密密钥。后续的通信用对称加密（如 AES-128-GCM），因为对称加密比非对称加密快得多。

## 用 Node.js 创建 HTTPS 服务器

```js
const https = require('https')
const fs = require('fs')
const path = require('path')

// 需要先生成证书（用 mkcert 或 openssl）
const options = {
  key: fs.readFileSync('./certs/server.key'),
  cert: fs.readFileSync('./certs/server.crt')
}

const server = https.createServer(options, (req, res) => {
  console.log(`TLS 版本: ${req.socket.getProtocol()}`)
  console.log(`密码套件: ${req.socket.getCipher().name}`)

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    protocol: req.socket.getProtocol(),
    cipher: req.socket.getCipher().name,
    peerCert: req.socket.getPeerCertificate().subject
  }))
})

server.listen(3000, () => console.log('HTTPS 服务器监听 :3000'))
```

生成自签名证书（开发用）：

```bash
# 用 mkcert（推荐，自动信任）
mkcert -install
mkcert localhost 127.0.0.1

# 或用 openssl
openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.crt -days 365 -nodes -subj "/CN=localhost"
```

测试：

```bash
# 用 curl 访问（-k 跳过自签名证书验证）
curl -vk https://localhost:3000

# 查看证书信息
curl -vI https://example.com 2>&1 | grep -i "certificate\|issuer\|expire"
```

## 证书验证的细节

客户端验证证书时，会检查以下内容：

**域名匹配**：证书中的 Subject Alternative Name (SAN) 或 Common Name (CN) 必须匹配请求的域名。支持通配符（如 `*.example.com`）。

**有效期**：证书有 `Not Before` 和 `Not After` 字段。过期的证书会被拒绝。

**信任链**：证书由 CA（Certificate Authority）签发。客户端内置了受信任的根 CA 列表。如果证书的签发者不在列表中，需要通过中间证书建立信任链。

**吊销检查**：客户端可以通过 CRL（Certificate Revocation List）或 OCSP（Online Certificate Status Protocol）检查证书是否被吊销。

## 自签名证书为什么不安全

自签名证书的问题不在于加密强度——它用的加密算法跟正规证书一样。问题在于没有第三方验证身份。

当你访问 `https://bank.com` 时，浏览器需要确认这个证书真的是银行的，而不是攻击者伪造的。正规证书由受信任的 CA 签发，CA 会验证申请者确实拥有这个域名。自签名证书任何人都能生成，所以浏览器会显示警告。

## 工程启发

1. **HTTPS 是必须的**。不是"可选的安全增强"，而是基本要求。现代浏览器会标记 HTTP 网站为"不安全"，Chrome 甚至会阻止 HTTP 页面上的某些功能。
2. **证书管理是运维工作**。Let's Encrypt 提供免费的自动证书。用 certbot 或 acme.sh 自动化证书申请和续期。
3. **TLS 握手有延迟成本**。TLS 1.2 需要 2 个 RTT，TLS 1.3 只需要 1 个 RTT。在高延迟网络上，这个差异很显著。

## 练习

### 练习一：用 Wireshark 完整分析 TLS 1.3 握手

1. 配置 Wireshark 解密 TLS 流量（设置 SSLKEYLOGFILE）
2. 访问 `https://example.com`
3. 在 Wireshark 中找到 ClientHello、ServerHello、证书、Finished 消息
4. 记录握手过程中交换了哪些参数

### 练习二：用 Node.js 创建 HTTPS 服务器并验证证书信息

创建一个 HTTPS 服务器，用 curl 访问并打印：
- TLS 版本
- 密码套件
- 证书的域名和有效期
- 证书的签发者

---

## 参考答案

### 练习一

**预期观察**：
- ClientHello 包含客户端支持的 TLS 版本、密码套件、SNI 扩展
- ServerHello 选择了 TLS 1.3 和一个密码套件
- Certificate 包含证书链
- 双方的 Finished 消息验证了握手的完整性

TLS 1.3 的握手比 TLS 1.2 更紧凑，往返次数更少。

### 练习二

```bash
# 用 curl 查看证书信息
curl -vI https://example.com 2>&1 | grep -i "ssl\|tls\|certificate"

# 用 openssl 查看详细证书信息
openssl s_client -connect example.com:443 -servername example.com < /dev/null 2>/dev/null | openssl x509 -text -noout
```

输出包括：
- TLS 版本（如 TLSv1.3）
- 密码套件（如 TLS_AES_128_GCM_SHA256）
- 证书的 Subject（域名）
- 证书的 Issuer（签发者）
- 证书的 Not Before / Not After（有效期）
