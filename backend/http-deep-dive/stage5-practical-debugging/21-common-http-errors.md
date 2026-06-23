# 常见 HTTP 错误排查——CORS 报错、证书过期、连接超时

## 错误是学习协议的最好入口

你可能写了很多年代码，但对 HTTP 的理解可能来自"报错了 → Google → 粘贴答案"。这种方式能解决问题，但不能建立理解。

这节课我们从三个最常见的 HTTP 错误入手，拆解它们的根因，建立排查思路。

## 错误一：CORS 报错

**现象**：浏览器控制台报错：

```
Access to fetch at 'https://api.example.com/data' from origin 'http://localhost:3000' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**排查步骤**：

1. **确认是 CORS 问题还是网络问题**。用 curl 测试同一个请求：

```bash
curl -v https://api.example.com/data
```

如果 curl 能收到响应，说明服务器是正常的，只是浏览器因为 CORS 策略阻止了。如果 curl 也失败了，那是网络问题或服务器问题，不是 CORS。

2. **检查响应头**。用 curl 看服务器返回了哪些 CORS 相关的头部：

```bash
curl -vI -H "Origin: http://localhost:3000" https://api.example.com/data 2>&1 | grep -i "access-control"
```

常见问题：
- 服务器没有返回 `Access-Control-Allow-Origin`
- `Allow-Origin` 的值跟请求的 `Origin` 不匹配
- 用了 `*` 但请求带了凭证（Cookie）
- 缺少 `Access-Control-Allow-Methods` 或 `Access-Control-Allow-Headers`

3. **检查预检请求**。如果是非简单请求（PUT、DELETE、带自定义头部），浏览器会先发 OPTIONS 预检：

```bash
curl -v -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  https://api.example.com/data
```

如果预检返回 404 或 405，说明服务器没有处理 OPTIONS 请求。

4. **检查浏览器 Network 面板**。CORS 错误时，请求实际上可能已经发送并收到了响应，但浏览器因为缺少 CORS 头部而拒绝把响应交给 JavaScript。Network 面板中可以看到实际的请求和响应。

## 错误二：证书错误

**现象**：浏览器显示"您的连接不是私密连接"或 curl 报错：

```
curl: (60) SSL certificate problem: unable to get local issuer certificate
```

**排查步骤**：

1. **检查证书是否过期**：

```bash
echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null | openssl x509 -noout -dates
```

输出类似：
```
notBefore=Jan  1 00:00:00 2024 GMT
notAfter=Dec 31 23:59:59 2024 GMT
```

如果 `notAfter` 已经过去，证书过期了。

2. **检查证书链是否完整**：

```bash
echo | openssl s_client -connect example.com:443 -servername example.com 2>&1 | grep -i "verify return code"
```

如果返回 `Verify return code: 21 (unable to verify the first certificate)`，说明证书链不完整——服务器没有发送中间证书。

3. **检查域名是否匹配**：

```bash
echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null | openssl x509 -noout -text | grep -A1 "Subject Alternative Name"
```

证书的 SAN（Subject Alternative Name）必须包含请求的域名。通配符证书（如 `*.example.com`）匹配所有子域名，但不匹配根域名（`example.com`）。

4. **检查证书是否被吊销**：

```bash
echo | openssl s_client -connect example.com:443 -servername example.com -crl_check 2>&1 | grep -i "revoke"
```

5. **curl 跳过证书验证（仅用于调试）**：

```bash
curl -vk https://example.com
```

`-k` 选项跳过证书验证。只在调试时使用，生产环境永远不要用。

## 错误三：连接超时

**现象**：请求发送后长时间没有响应，最终超时：

```
curl: (28) Connection timed out after 10001 milliseconds
```

或浏览器显示 `ERR_CONNECTION_TIMED_OUT`。

**排查步骤**：

1. **确认是 DNS 问题还是连接问题**：

```bash
# 检查 DNS 解析
nslookup example.com
# 或
dig example.com

# 检查 TCP 连接
telnet example.com 443
# 或
nc -zv example.com 443
```

如果 DNS 解析成功但 TCP 连接超时，说明服务器不可达（防火墙、服务器宕机、网络不通）。

2. **检查是否是特定端口的问题**：

```bash
# 测试 80 端口
curl -v http://example.com

# 测试 443 端口
curl -v https://example.com
```

如果 HTTP 能通但 HTTPS 不通，可能是 443 端口被防火墙阻断。

3. **检查是否是代理问题**：

```bash
# 检查是否设置了代理
echo $HTTP_PROXY
echo $HTTPS_PROXY

# 绕过代理
curl --noproxy '*' https://example.com
```

4. **检查是否是 DNS 污染**：

```bash
# 用不同的 DNS 服务器
nslookup example.com 8.8.8.8
nslookup example.com 1.1.1.1
```

如果返回的 IP 不同，可能遇到了 DNS 污染。

5. **用 traceroute 看网络路径**：

```bash
# Linux/macOS
traceroute example.com

# Windows
tracert example.com
```

这会显示从你的机器到目标服务器经过的每一个路由器。如果某个节点超时或丢包严重，就是问题所在。

## 用 Node.js 模拟这些错误

```js
const http = require('http')

// 模拟 CORS 错误
const corsErrorServer = http.createServer((req, res) => {
  // 故意不设置 CORS 头部
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ message: 'no cors headers' })
})
corsErrorServer.listen(3001)

// 模拟超时
const timeoutServer = http.createServer((req, res) => {
  // 故意不响应
  console.log('收到请求，但不响应')
})
timeoutServer.listen(3002)

// 模拟慢响应
const slowServer = http.createServer((req, res) => {
  setTimeout(() => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('slow response')
  }, 30000)  // 30 秒后才响应
})
slowServer.listen(3003)
```

## 排查工具箱

- **curl -v**：查看请求和响应的完整头部
- **curl --trace-time**：带时间戳的详细输出
- **Wireshark**：抓包分析网络层行为
- **openssl s_client**：检查 TLS 握手和证书
- **nslookup/dig**：DNS 诊断
- **telnet/nc**：TCP 连接测试
- **traceroute/tracert**：网络路径追踪
- **Chrome DevTools Network**：浏览器请求分析
- **SSL Labs**：在线 TLS 配置检查
- **securityheaders.com**：安全头部检查

## 工程启发

1. **先区分是客户端问题还是服务器问题**。用 curl 测试，如果 curl 能正常工作但浏览器不行，通常是 CORS 或浏览器策略问题。
2. **看状态码和响应头**。4xx 是客户端错误，5xx 是服务器错误。响应头里通常有足够的信息来定位问题。
3. **网络问题要分层排查**。DNS → TCP → TLS → HTTP，每一层都可能出问题。

## 练习

### 练习一：模拟并排查 CORS 错误

1. 创建一个不返回 CORS 头部的服务器
2. 用浏览器的 `fetch()` 请求它，观察报错
3. 添加正确的 CORS 头部，修复问题

### 练习二：用 openssl 排查证书问题

用 openssl 检查以下网站的证书信息：
- https://expired.badssl.com（过期证书）
- https://wrong.host.badssl.com（域名不匹配）
- https://self-signed.badssl.com（自签名证书）

记录每个证书的具体问题。

---

## 参考答案

### 练习一

```js
const http = require('http')

// 第一步：不带 CORS 头部
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ message: 'hello' }))
})

// 第二步：添加 CORS 头部
const serverWithCors = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ message: 'hello' }))
})
```

### 练习二

```bash
# 过期证书
echo | openssl s_client -connect expired.badssl.com:443 2>/dev/null | openssl x509 -noout -dates
# 输出显示 notAfter 已经过去

# 域名不匹配
echo | openssl s_client -connect wrong.host.badssl.com:443 2>/dev/null | openssl x509 -noout -text | grep "Subject:"
# 证书的 Subject 是 *.badssl.com，但请求的是 wrong.host.badssl.com

# 自签名证书
echo | openssl s_client -connect self-signed.badssl.com:443 2>&1 | grep "Verify return code"
# 返回 "unable to get local issuer certificate" 或类似错误
```
