# 阶段实战：配置一个 A+ 评级的 HTTPS 站点

## 目标

这个阶段的实战任务是：用 Node.js 创建一个 HTTPS 站点，配置所有必要的安全头部，目标是在 https://www.ssllabs.com/ssltest/ 和 https://securityheaders.com/ 上获得 A+ 评级。

这不是一个理论练习。你要实际配置证书、TLS 参数、安全头部，并用在线工具验证。

## 第一步：生成证书

开发环境用自签名证书。生产环境用 Let's Encrypt。

```bash
# 用 mkcert 生成本地可信证书
mkcert -install
mkcert localhost 127.0.0.1 ::1

# 或用 openssl 生成自签名证书
openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.crt -days 365 -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1"
```

## 第二步：HTTPS 服务器配置

```js
const https = require('https')
const fs = require('fs')
const path = require('path')

const options = {
  key: fs.readFileSync('./certs/server.key'),
  cert: fs.readFileSync('./certs/server.crt'),

  // TLS 配置
  minVersion: 'TLSv1.2',  // 最低 TLS 1.2
  ciphers: [
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-CHACHA20-POLY1305'
  ].join(':'),
  honorCipherOrder: true,

  // HSTS 预加载需要这个
  // 注意：这会禁用 TLS 会话恢复的某些功能
  // sessionTimeout: 300
}

function setSecurityHeaders(res) {
  // HSTS - 1 年，包含子域名
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')

  // CSP - 严格策略
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; '))

  // 点击劫持防护
  res.setHeader('X-Frame-Options', 'DENY')

  // MIME 类型嗅探防护
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // Referrer 策略
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // 权限策略
  res.setHeader('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ].join(', '))

  // 禁用旧版 XSS 过滤器（现代浏览器不需要）
  res.setHeader('X-XSS-Protection', '0')

  // CORS（如果需要）
  // res.setHeader('Access-Control-Allow-Origin', 'https://your-frontend.com')
}

const server = https.createServer(options, (req, res) => {
  setSecurityHeaders(res)

  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HTTPS A+ 站点</title>
        <style>
          body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: #f0f0f0; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .section { margin-bottom: 30px; }
          code { background: #e0e0e0; padding: 2px 6px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>HTTPS A+ 站点</h1>
          <p>这个站点配置了所有必要的安全头部。</p>
        </div>
        <div class="section">
          <h2>安全配置</h2>
          <ul>
            <li>TLS 1.2+ with strong cipher suites</li>
            <li>HSTS with preload</li>
            <li>Strict Content Security Policy</li>
            <li>X-Frame-Options: DENY</li>
            <li>X-Content-Type-Options: nosniff</li>
            <li>Referrer-Policy: strict-origin-when-cross-origin</li>
            <li>Permissions-Policy: restrictive</li>
          </ul>
        </div>
        <div class="section">
          <h2>验证工具</h2>
          <ul>
            <li><a href="https://www.ssllabs.com/ssltest/">SSL Labs Test</a></li>
            <li><a href="https://securityheaders.com/">Security Headers</a></li>
            <li><a href="https://observatory.mozilla.org/">Mozilla Observatory</a></li>
          </ul>
        </div>
      </body>
      </html>
    `)
  } else if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', tls: req.socket.getProtocol() }))
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

server.listen(3000, () => {
  console.log('HTTPS 服务器监听 https://localhost:3000')
  console.log('TLS 版本:', server.getProtocol?.() || 'TLSv1.2+')
})
```

## 第三步：HTTP 到 HTTPS 重定向

```js
const http = require('http')

// HTTP 服务器只做重定向
const redirectServer = http.createServer((req, res) => {
  const host = req.headers.host?.replace(/:\d+$/, '') || 'localhost'
  const httpsUrl = `https://${host}:3000${req.url}`

  res.writeHead(301, {
    'Location': httpsUrl,
    'Strict-Transport-Security': 'max-age=31536000'
  })
  res.end()
})

redirectServer.listen(8080, () => {
  console.log('HTTP 重定向服务器监听 :8080')
})
```

## 第四步：验证配置

用 curl 验证所有头部：

```bash
# 检查安全头部
curl -vI http://localhost:8080 2>&1 | grep -i "location\|strict-transport"

curl -vkI https://localhost:3000 2>&1 | grep -iE "strict-transport|content-security|x-frame|x-content|referrer|permissions|x-xss"

# 检查 TLS 配置
curl -vk https://localhost:3000/api/health 2>&1 | grep -i "ssl\|tls"
```

## 第五步：在线工具测试

1. **SSL Labs**：https://www.ssllabs.com/ssltest/
   - 输入你的域名
   - 等待测试完成
   - 目标：A+ 评级

2. **Security Headers**：https://securityheaders.com/
   - 输入你的 URL
   - 检查所有头部是否正确设置
   - 目标：A+ 评级

3. **Mozilla Observatory**：https://observatory.mozilla.org/
   - 综合安全评估

## 验收清单

- [ ] HTTPS 服务器正常运行
- [ ] TLS 版本最低 1.2，推荐 1.3
- [ ] 使用强密码套件
- [ ] HSTS 设置了 max-age >= 1 年
- [ ] CSP 策略严格但不影响功能
- [ ] X-Frame-Options 设置为 DENY 或 SAMEORIGIN
- [ ] X-Content-Type-Options 设置为 nosniff
- [ ] Referrer-Policy 设置合理
- [ ] Permissions-Policy 禁用了不需要的功能
- [ ] HTTP 请求重定向到 HTTPS
- [ ] SSL Labs 评级 A+
- [ ] Security Headers 评级 A+

## 常见问题

**Q: SSL Labs 测试需要公网域名吗？**
A: 是的。SSL Labs 只能测试公网可访问的服务器。本地开发环境可以用 curl 和 openssl 手动验证 TLS 配置。

**Q: 自签名证书能获得 A+ 吗？**
A: 不能。SSL Labs 会检查证书是否由受信任的 CA 签发。自签名证书会降低评分。

**Q: CSP 会影响页面功能吗？**
A: 会。严格的 CSP 会阻止内联脚本、eval()、外部资源等。需要根据实际需求调整策略。建议先用 `Content-Security-Policy-Report-Only` 测试。
