# TLS/SSL 握手——证书验证、密钥交换、会话恢复

## 为什么需要 TLS

HTTP 是明文传输的。任何人截获数据包都能看到内容。TLS（传输层安全）在 HTTP 之下加密数据，保证：
- **机密性**：数据被加密，只有接收方能解密
- **完整性**：数据在传输中不被篡改
- **身份验证**：确认对方是合法的服务器

## TLS 握手过程（TLS 1.3）

TLS 1.3 简化了握手过程，只需 1-RTT：

```
客户端                                  服务器
  |                                       |
  | 1. ClientHello                        |
  |    - 支持的密码套件                    |
  |    - 客户端随机数                      |
  |    - 密钥共享（ECDHE）                 |
  | ------------------------------------> |
  |                                       |
  | 2. ServerHello                        |
  |    - 选择的密码套件                    |
  |    - 服务器随机数                      |
  |    - 密钥共享（ECDHE）                 |
  |    - 证书                             |
  |    - 证书验证签名                      |
  |    - Finished                         |
  | <------------------------------------ |
  |                                       |
  | 3. Finished                           |
  | ------------------------------------> |
  |                                       |
  | 加密通信开始                           |
```

### ClientHello

客户端发送：
- 支持的 TLS 版本
- 支持的密码套件列表
- 客户端随机数（32 字节）
- 密钥共享（ECDHE 公钥）
- 其他扩展

### ServerHello

服务器回复：
- 选择的 TLS 版本
- 选择的密码套件
- 服务器随机数（32 字节）
- 密钥共享（ECDHE 公钥）
- 证书
- 证书验证签名
- Finished 消息

### 密钥计算

双方使用 ECDHE 公钥计算预主密钥，然后派生出会话密钥。会话密钥用于加密实际数据。

## TLS 1.2 vs TLS 1.3

| 特性 | TLS 1.2 | TLS 1.3 |
|------|---------|---------|
| 握手 RTT | 2-RTT | 1-RTT |
| 会话恢复 | 1-RTT | 0-RTT |
| 密码套件 | 很多 | 仅 5 个 |
| 前向保密 | 可选 | 必需 |
| 密钥交换 | RSA/ECDHE | 仅 ECDHE |

## 证书验证

服务器证书包含：
- 域名
- 公钥
- 有效期
- 颁发者（CA）
- 数字签名

客户端验证证书：
1. 检查域名是否匹配
2. 检查证书是否过期
3. 检查证书链是否可信
4. 检查证书是否被吊销

### 证书链

```
根 CA（自签名）
└── 中间 CA
    └── 服务器证书
```

客户端需要验证整个证书链。根 CA 证书预装在操作系统或浏览器中。

## 会话恢复

TLS 1.3 支持两种会话恢复：

### PSK（预共享密钥）

握手完成后，服务器发送 NewSessionTicket。客户端下次连接时可以用这个 ticket 恢复会话，不需要完整的握手。

### 0-RTT

客户端在 ClientHello 中携带加密的应用数据，服务器在 ServerHello 后立即解密。

0-RTT 的安全风险：重放攻击。攻击者可以捕获并重放 0-RTT 数据。

## 实验：抓包观察 TLS 握手

### 用 Wireshark 抓包

```bash
# 启动 Wireshark 抓包
# 过滤器: tls

# 访问 HTTPS 网站
curl https://example.com
```

### 分析 TLS 握手

在 Wireshark 中找到 TLS 握手：

1. **ClientHello**：展开 TLS 层，查看支持的密码套件
2. **ServerHello**：查看选择的密码套件和证书
3. **Finished**：握手完成

### 查看证书信息

```bash
# 用 openssl 查看证书
openssl s_client -connect example.com:443 -showcerts

# 查看证书详情
echo | openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -text -noout
```

### 测试 TLS 版本

```bash
# 测试 TLS 1.2
openssl s_client -connect example.com:443 -tls1_2

# 测试 TLS 1.3
openssl s_client -connect example.com:443 -tls1_3
```

## 实验：用 curl 测试 TLS

```bash
# 查看 TLS 握手详情
curl -v https://example.com

# 输出示例:
# * TLSv1.3 (OUT), TLS handshake, Client hello (1):
# * TLSv1.3 (IN), TLS handshake, Server hello (2):
# * TLSv1.3 (IN), TLS handshake, Encrypted Extensions (8):
# * TLSv1.3 (IN), TLS handshake, Certificate (11):
# * TLSv1.3 (IN), TLS handshake, Certificate Verify (15):
# * TLSv1.3 (IN), TLS handshake, Finished (20):
```

## 常见 TLS 错误

### 证书过期

```
curl: (60) SSL certificate problem: certificate has expired
```

解决方法：更新证书或系统时间。

### 证书域名不匹配

```
curl: (60) SSL certificate problem: unable to get local issuer certificate
```

解决方法：检查证书域名是否与访问的域名匹配。

### 自签名证书

```
curl: (60) SSL certificate problem: self signed certificate
```

解决方法：添加 CA 证书或使用 `-k` 参数跳过验证（不推荐）。

## 练习

### 练习一：抓取 TLS 握手

1. 用 Wireshark 抓取 HTTPS 流量
2. 记录 ClientHello 和 ServerHello 的密码套件
3. 查看服务器证书信息

### 练习二：测试不同 TLS 版本

1. 用 openssl 测试网站支持的 TLS 版本
2. 对比 TLS 1.2 和 TLS 1.3 的握手时间
3. 分析为什么 TLS 1.3 更快

---

## 参考答案

### 练习一

ClientHello 密码套件示例：
```
TLS_AES_256_GCM_SHA384
TLS_CHACHA20_POLY1305_SHA256
TLS_AES_128_GCM_SHA256
```

ServerHello 选择的套件：
```
TLS_AES_256_GCM_SHA384
```

证书信息：
```
Subject: CN=example.com
Issuer: CN=Let's Encrypt Authority X3
Not Before: Jan  1 00:00:00 2023 GMT
Not After: Apr  1 00:00:00 2023 GMT
```

### 练习二

```bash
# 测试支持的 TLS 版本
openssl s_client -connect example.com:443 -tls1_2 2>&1 | grep "Protocol"
openssl s_client -connect example.com:443 -tls1_3 2>&1 | grep "Protocol"
```

**关键点**：TLS 1.3 比 TLS 1.2 快，因为：
- 握手从 2-RTT 减少到 1-RTT
- 会话恢复支持 0-RTT
- 密码套件更少，协商更快

**常见错误**：以为 TLS 握手只发生在第一次连接。实际上每次新连接都需要握手，除非使用会话恢复。
