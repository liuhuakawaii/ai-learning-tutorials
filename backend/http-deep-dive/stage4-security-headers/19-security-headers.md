# 安全头部——CSP、HSTS、X-Frame-Options、SameSite Cookie

## HTTP 头部不只是传数据

前面的课程中，我们把 HTTP 头部当作传数据的通道（Content-Type、Cache-Control 等）。但有一类头部专门用于安全：它们告诉浏览器"按照我说的方式保护这个页面"。

这些安全头部不是强制的——服务器不设置它们，页面也能正常工作。但不设置它们，你的网站就少了一层防护。

## Content-Security-Policy (CSP)

CSP 是最重要的安全头部之一。它告诉浏览器这个页面可以加载哪些资源（脚本、样式、图片、字体等），其他的都阻止。

最常见的用途是防止 XSS（跨站脚本攻击）。假设攻击者往你的页面注入了 `<script src="https://evil.com/steal.js"></script>`，如果没有 CSP，浏览器会执行这个脚本。有了 CSP，浏览器会检查脚本的来源是否在白名单中。

```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' https://cdn.example.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
```

各个指令的含义：

- `default-src`：默认策略，没有单独指定的资源类型用这个
- `script-src`：JavaScript 的来源
- `style-src`：CSS 的来源
- `img-src`：图片的来源
- `connect-src`：fetch/XHR/WebSocket 的目标
- `frame-ancestors`：谁可以嵌入这个页面（替代 X-Frame-Options）
- `base-uri`：`<base>` 标签的合法 URL
- `form-action`：表单提交的合法目标

特殊值：
- `'self'`：同源
- `'unsafe-inline'`：允许内联脚本/样式（不推荐）
- `'unsafe-eval'`：允许 eval()（不推荐）
- `'none'`：不允许任何来源
- `data:`：允许 data: URI
- `https:`：允许所有 HTTPS 来源

用 curl 观察：

```bash
curl -vI https://github.com 2>&1 | grep -i "content-security-policy"
```

GitHub 的 CSP 非常严格，列出了所有允许的来源。

## HSTS (HTTP Strict Transport Security)

HSTS 告诉浏览器：以后访问这个网站，必须用 HTTPS，即使用户输入的是 `http://`。

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- `max-age`：缓存时间（秒）。31536000 是 1 年
- `includeSubDomains`：对子域名也生效
- `preload`：申请加入浏览器的 HSTS 预加载列表

HSTS 解决的问题：用户第一次访问 `http://bank.com` 时，服务器返回 301 重定向到 `https://bank.com`。但这个重定向本身是明文的，中间人可以拦截它。HSTS 让浏览器记住"这个网站只用 HTTPS"，下次直接用 HTTPS 访问。

## X-Frame-Options

X-Frame-Options 控制页面是否可以被嵌入到 `<iframe>` 中。

```
X-Frame-Options: DENY                    # 不允许嵌入
X-Frame-Options: SAMEORIGIN              # 只允许同源嵌入
X-Frame-Options: ALLOW-FROM https://...  # 允许指定来源嵌入（已弃用）
```

这可以防止点击劫持（Clickjacking）攻击：攻击者把你的页面嵌入到透明的 iframe 中，诱导用户点击。X-Frame-Options 已经被 CSP 的 `frame-ancestors` 指令取代，但为了兼容老浏览器，建议同时设置两者。

## SameSite Cookie

SameSite 属性控制 Cookie 在跨站请求时的行为。我们在 Cookie 那节课已经讲过，这里再强调一下安全相关的设置：

```
Set-Cookie: session=abc123; SameSite=Lax; Secure; HttpOnly
```

- `Strict`：跨站请求完全不发送 Cookie。安全性最高，但用户体验差（从其他网站点链接过来也不带 Cookie）
- `Lax`：GET 请求会发送，POST 不会。这是现代浏览器的默认值
- `None`：总是发送，必须同时设置 `Secure`

## 其他安全头部

**X-Content-Type-Options**：

```
X-Content-Type-Options: nosniff
```

阻止浏览器猜测 MIME 类型。如果服务器说 `Content-Type: text/plain`，浏览器就按纯文本处理，即使内容看起来像 HTML 或 JavaScript。这防止了 MIME 类型混淆攻击。

**Referrer-Policy**：

```
Referrer-Policy: strict-origin-when-cross-origin
```

控制 `Referer` 头部发送多少信息。`strict-origin-when-cross-origin` 表示：同源请求发送完整 URL，跨域请求只发送源（不带路径），HTTPS 到 HTTP 不发送。

**Permissions-Policy**：

```
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

控制页面可以使用哪些浏览器功能。上面的设置禁用了摄像头、麦克风和地理位置。

## 用 Node.js 设置安全头部

```js
const http = require('http')

function setSecurityHeaders(res) {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '))

  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('X-XSS-Protection', '0')  // 现代浏览器不需要，禁用以避免干扰 CSP
}

const server = http.createServer((req, res) => {
  setSecurityHeaders(res)

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(`
    <!DOCTYPE html>
    <html>
    <head><title>安全头部测试</title></head>
    <body>
      <h1>安全头部已设置</h1>
      <p>检查响应头以验证安全配置。</p>
    </body>
    </html>
  `)
})

server.listen(3000, () => console.log('监听 :3000'))
```

测试：

```bash
curl -vI http://localhost:3000 2>&1 | grep -i "content-security-policy\|strict-transport\|x-frame\|x-content-type\|referrer-policy\|permissions-policy"
```

## 用在线工具检查安全头部

访问 https://securityheaders.com/，输入你的网站 URL，它会检查所有安全头部并给出评分。

## 工程启发

1. **安全头部是防御纵深**。即使你的代码没有 XSS 漏洞，CSP 也能在漏洞被发现时提供额外保护。安全不应该只依赖代码审查。
2. **HSTS 要小心启用**。一旦设置了 HSTS，在 `max-age` 期间内，即使你的 HTTPS 证书出问题，用户也无法用 HTTP 访问。建议先用短的 `max-age` 测试，确认没问题后再延长。
3. **CSP 要逐步收紧**。一开始可以用 `Content-Security-Policy-Report-Only` 模式，只报告违规不阻止。等收集了足够的报告后再正式启用。

## 练习

### 练习一：用 securityheaders.com 检查真实网站

访问以下网站，记录它们的安全头部评分和缺失的头部：
- https://github.com
- https://google.com
- https://你的网站

### 练习二：为一个 Express 应用添加安全头部

用 Express 创建一个简单的应用，添加所有本节课讲到的安全头部。用 curl 验证所有头部都正确设置。

---

## 参考答案

### 练习一

**预期发现**：
- GitHub 通常有 A+ 评分，设置了大部分安全头部
- Google 的评分可能不如预期（因为某些功能需要宽松的 CSP）
- 大多数网站缺少 Permissions-Policy 和 Referrer-Policy

### 练习二

```js
const express = require('express')
const app = express()

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'")
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
})

app.get('/', (req, res) => {
  res.send('<h1>安全头部测试</h1>')
})

app.listen(3000, () => console.log('监听 :3000'))
```

验证：

```bash
curl -vI http://localhost:3000 2>&1 | grep -iE "content-security|strict-transport|x-frame|x-content|referrer|permissions"
```
