# CORS 深度课——简单请求、预检请求、Credentials 的完整规则

## 为什么需要 CORS

你写了一个前端页面，用 `fetch('https://api.example.com/data')` 请求后端 API。浏览器会阻止这个请求，报 CORS 错误：

```
Access to fetch at 'https://api.example.com/data' from origin 'http://localhost:3000' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

CORS（Cross-Origin Resource Sharing）是浏览器的安全策略。默认情况下，浏览器不允许网页向不同源（协议 + 域名 + 端口）的服务器发请求。这是为了防止恶意网站 `evil.com` 偷偷向 `bank.com` 发请求，利用用户的登录状态执行操作。

但现代 Web 应用几乎都需要跨域请求（前后端分离、调用第三方 API）。CORS 就是让服务器明确告诉浏览器"我允许这个跨域请求"的机制。

## 简单请求

满足以下条件的请求是"简单请求"：

- 方法是 GET、HEAD 或 POST
- 只使用了安全的头部（Accept、Accept-Language、Content-Language、Content-Type）
- Content-Type 是 `text/plain`、`multipart/form-data` 或 `application/x-www-form-urlencoded`

简单请求直接发送，不需要预检。服务器在响应中加上 `Access-Control-Allow-Origin` 头部即可：

```
Access-Control-Allow-Origin: http://localhost:3000
# 或者
Access-Control-Allow-Origin: *
```

用 curl 测试：

```bash
# 简单请求（GET）
curl -v -H "Origin: http://localhost:3000" https://httpbin.org/get

# 简单请求（POST + text/plain）
curl -v -X POST -H "Origin: http://localhost:3000" -H "Content-Type: text/plain" -d "hello" https://httpbin.org/post
```

观察响应中的 `Access-Control-Allow-Origin` 头部。

## 预检请求（Preflight）

不满足简单请求条件的请求需要预检。浏览器会先发一个 OPTIONS 请求，询问服务器是否允许这个跨域请求：

```
OPTIONS /api/data HTTP/1.1
Origin: http://localhost:3000
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: Content-Type, Authorization
```

服务器响应：

```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

浏览器收到预检响应后，检查实际请求的方法和头部是否被允许。如果允许，才发送实际请求。

用 curl 模拟预检：

```bash
# 预检请求
curl -v -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  https://httpbin.org/put

# 实际请求
curl -v -X PUT \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{"name":"test"}' \
  https://httpbin.org/put
```

## 带凭证的请求

默认情况下，跨域请求不会带上 Cookie。如果你需要带上 Cookie（比如用 Session 认证），需要：

1. 客户端设置 `credentials: 'include'`
2. 服务器返回 `Access-Control-Allow-Credentials: true`
3. `Access-Control-Allow-Origin` 不能是 `*`，必须是具体的域名

```js
// 客户端
fetch('https://api.example.com/data', {
  credentials: 'include'
})
```

```
// 服务器响应
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
```

为什么 `Allow-Origin` 不能是 `*`？因为如果允许任意域名带凭证，`evil.com` 就可以向 `bank.com` 发带 Cookie 的请求，利用用户的登录状态执行操作。`*` 是一个便利的通配符，但跟凭证不兼容。

## Node.js 实现完整的 CORS

```js
const http = require('http')

function cors(req, res) {
  const origin = req.headers.origin
  const allowedOrigins = ['http://localhost:3000', 'http://localhost:8080']

  // 检查 Origin 是否在白名单中
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }

  // 允许凭证
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  // 允许的头部
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')

  // 允许的方法
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH')

  // 预检缓存时间
  res.setHeader('Access-Control-Max-Age', '86400')

  // 暴露给客户端的头部
  res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count, X-Request-Id')

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }
  return false
}

const server = http.createServer((req, res) => {
  if (cors(req, res)) return

  // 正常处理请求
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ message: 'success' }))
})

server.listen(3000, () => console.log('监听 :3000'))
```

## CORS 常见错误

**错误一：`Access-Control-Allow-Origin: *` + `credentials: include`**

浏览器会拒绝，因为 `*` 跟凭证不兼容。解决方案是返回具体的 Origin。

**错误二：预检请求返回 200 而不是 204**

预检请求应该返回 204（No Content）或 200，但不能有响应体。返回 200 带响应体不会报错，但 204 更规范。

**错误三：忘记处理 OPTIONS 请求**

如果服务器没有处理 OPTIONS 请求，预检会失败，实际请求也不会发送。确保所有需要 CORS 的路由都处理了 OPTIONS。

**错误四：`Access-Control-Allow-Headers` 没有包含自定义头部**

如果你的请求带了自定义头部（如 `X-Request-Id`），预检请求的 `Access-Control-Request-Headers` 会包含它。服务器的 `Access-Control-Allow-Headers` 必须也包含这个头部，否则预检失败。

## 工程启发

1. **CORS 是浏览器策略，不是服务器策略**。curl、Postman、后端服务之间的请求不受 CORS 限制。CORS 只在浏览器中生效。
2. **预检请求有性能开销**。每个跨域的非简单请求都要先发 OPTIONS 预检。`Access-Control-Max-Age` 可以让浏览器缓存预检结果，减少重复预检。
3. **不要用 `*` 作为 Allow-Origin**。除非你的 API 是完全公开的（不需要认证），否则应该返回具体的 Origin。

## 练习

### 练习一：用 curl 完整演示 CORS 流程

用 curl 模拟以下场景：
1. 简单 GET 请求（不需要预检）
2. 带 Authorization 头部的 GET 请求（需要预检）
3. PUT 请求（需要预检）
4. 带 Cookie 的请求（需要 Allow-Credentials）

### 练习二：实现一个支持 CORS 的 API 服务器

用 Node.js 实现：
- 支持 GET、POST、PUT、DELETE
- 只允许 `http://localhost:3000` 和 `http://localhost:8080` 两个域名
- 支持带凭证的请求
- 正确处理预检请求

---

## 参考答案

### 练习一

```bash
# 1. 简单 GET 请求
curl -v -H "Origin: http://localhost:3000" http://localhost:3001/api/data
# 观察响应中的 Access-Control-Allow-Origin

# 2. 带 Authorization 的 GET（需要预检）
curl -v -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization" \
  http://localhost:3001/api/data

# 3. PUT 请求（需要预检）
curl -v -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  http://localhost:3001/api/data

# 4. 带 Cookie 的请求
curl -v -H "Origin: http://localhost:3000" -b "session=abc123" http://localhost:3001/api/data
```

### 练习二

参考上面的 Node.js 代码。关键点：
- 在所有路由之前处理 CORS
- 用白名单检查 Origin
- OPTIONS 请求返回 204
- 设置 `Access-Control-Allow-Credentials: true` 时，`Allow-Origin` 必须是具体域名
