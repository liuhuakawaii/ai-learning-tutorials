# Cookie 与 Session——状态保持的工程实现

## HTTP 是无状态的，但用户不是

HTTP 协议本身是无状态的：每个请求都是独立的，服务器不会记住你之前发过什么请求。你第一次访问一个网站和第一百次访问，在 HTTP 层面没有任何区别。

但现实世界需要状态：用户登录后，后续请求要能识别他是谁；购物车里加了商品，刷新页面后商品还在；语言偏好设置了一次，下次访问还要记住。

Cookie 就是 HTTP 为了解决这个问题引入的机制。它不是唯一的方案，但它是唯一在 HTTP 协议层面原生支持的方案。

## Set-Cookie 和 Cookie：服务器和客户端的对话

整个流程是这样的：

1. 客户端发请求给服务器
2. 服务器在响应中通过 `Set-Cookie` 头部下发一个或多个 Cookie
3. 客户端保存这些 Cookie
4. 客户端后续请求同一个域名时，自动在 `Cookie` 头部带上这些值

用 curl 观察：

```bash
# 第一次请求，观察 Set-Cookie
curl -v https://httpbin.org/cookies/set/mykey/myvalue 2>&1 | grep -i "set-cookie"

# 带 Cookie 请求
curl -v -b "mykey=myvalue" https://httpbin.org/cookies 2>&1 | grep -i "cookie"
```

`Set-Cookie` 头部的格式：

```
Set-Cookie: name=value; Domain=.example.com; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Lax
```

每个属性的作用：

- `name=value`：Cookie 的键值对
- `Domain`：哪些域名可以收到这个 Cookie。省略时默认为当前域名
- `Path`：URL 路径前缀匹配。只有路径匹配的请求才会带上这个 Cookie
- `Max-Age`：Cookie 的存活时间（秒）。省略时为会话 Cookie，关闭浏览器就删除
- `Expires`：过期时间点。跟 `Max-Age` 作用类似，但 `Max-Age` 优先级更高
- `Secure`：只在 HTTPS 请求中发送
- `HttpOnly`：JavaScript 不能通过 `document.cookie` 读取
- `SameSite`：跨站请求时是否发送（后面详细讲）

## Cookie 的安全隐患

Cookie 最大的安全问题是：它会被自动发送。你访问 `evil.com`，如果页面上有一个 `<img src="https://bank.com/transfer?to=attacker">`，浏览器会自动带上 `bank.com` 的 Cookie。这就是 CSRF（跨站请求伪造）攻击的基础。

为了应对这个问题，引入了几个机制：

**Secure 标志**：Cookie 只在 HTTPS 连接中发送。防止 Cookie 在 HTTP 明文传输中被窃听。

**HttpOnly 标志**：JavaScript 无法读取这个 Cookie。即使页面被 XSS 攻击注入了恶意脚本，脚本也拿不到 Cookie 的值。

**SameSite 属性**：控制跨站请求时 Cookie 的行为。有三个值：
- `Strict`：完全不发送。从 `other-site.com` 点链接跳转到你的网站，请求也不带 Cookie
- `Lax`：GET 请求会发送，POST 不会。这是现代浏览器的默认值
- `None`：总是发送，但必须同时设置 `Secure`

## Session：服务端的状态存储

Cookie 本身只存储一个标识符（session ID），真正的用户状态存在服务端。这就是 Session 的工作方式：

1. 用户登录，服务器创建一个 Session，生成 session ID
2. 服务器通过 `Set-Cookie` 把 session ID 发给客户端
3. 客户端后续请求带上这个 session ID
4. 服务器根据 session ID 查找对应的 Session 数据

用 Node.js 实现一个最简单的 Session 机制：

```js
const http = require('http')
const crypto = require('crypto')

const sessions = {}

const server = http.createServer((req, res) => {
  // 解析 Cookie
  const cookies = {}
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach((c) => {
      const [name, ...rest] = c.trim().split('=')
      cookies[name] = rest.join('=')
    })
  }

  let sessionId = cookies['session_id']
  if (!sessionId || !sessions[sessionId]) {
    // 创建新 Session
    sessionId = crypto.randomBytes(32).toString('hex')
    sessions[sessionId] = { createdAt: Date.now(), visits: 0 }
    res.setHeader('Set-Cookie', `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax`)
  }

  sessions[sessionId].visits++

  if (req.url === '/login') {
    sessions[sessionId].user = '张三'
    res.end(`已登录，访问次数: ${sessions[sessionId].visits}`)
  } else if (req.url === '/me') {
    const user = sessions[sessionId].user
    res.end(user ? `当前用户: ${user}，访问次数: ${sessions[sessionId].visits}` : '未登录')
  } else {
    res.end(`访问次数: ${sessions[sessionId].visits}`)
  }
})

server.listen(3000, () => console.log('监听 :3000'))
```

测试：

```bash
# 第一次访问（创建 Session）
curl -v http://localhost:3000/

# 带 Cookie 访问（复用 Session）
curl -v -b "session_id=从上一步的 Set-Cookie 中复制" http://localhost:3000/login

# 查看登录状态
curl -v -b "session_id=同一个值" http://localhost:3000/me
```

## Session 的工程问题

上面的实现有几个问题，在生产环境中必须解决：

**内存泄漏**：Session 存在内存里，用户越来越多，内存会一直增长。需要定期清理过期的 Session。

**水平扩展**：如果有多台服务器，用户的请求可能被路由到不同的机器上。Session 存在 A 机器的内存里，请求被路由到 B 机器，就找不到 Session 了。解决方案：
- 把 Session 存到 Redis 或数据库里（共享存储）
- 用负载均衡器的粘性会话（sticky session），让同一个用户的请求总是路由到同一台机器
- 不用服务端 Session，改用 JWT（把状态存在客户端）

**Session 固定攻击**：攻击者先访问网站拿到一个 session ID，然后诱导用户使用这个 session ID 登录。登录后攻击者就知道了用户的 session ID。防御方法：登录成功后重新生成 session ID。

## Cookie 的大小限制

浏览器对 Cookie 有严格限制：
- 每个 Cookie 最大约 4KB
- 每个域名下的 Cookie 总数通常限制在 50 个左右

这意味着你不能把大量数据存在 Cookie 里。Cookie 适合存标识符（session ID、用户 ID），不适合存业务数据。

## 工程启发

1. **Cookie 是自动发送的**。这是它的便利之处，也是安全隐患的根源。`SameSite` 属性是现代浏览器防御 CSRF 的主要手段。
2. **Session ID 必须足够随机**。如果 session ID 可以被猜到，攻击者就能伪造会话。用 `crypto.randomBytes()` 生成至少 32 字节的随机数。
3. **生产环境不要把 Session 存在进程内存里**。用 Redis 是最常见的方案——它支持 TTL 自动过期、支持多实例共享、性能足够好。

## 练习

### 练习一：用 curl 观察 Cookie 的自动发送

1. 用 curl 访问 `https://httpbin.org/cookies/set/token/abc123`，记录 Set-Cookie 响应头
2. 用 `-c` 选项把 Cookie 保存到文件
3. 用 `-b` 选项从文件加载 Cookie，再次访问 `https://httpbin.org/cookies`，验证 Cookie 被自动发送

### 练习二：实现一个带 CSRF 防护的表单提交

用 Node.js 实现：
1. GET `/form` 返回一个表单，包含一个随机的 CSRF token（存在 Session 中）
2. POST `/submit` 验证请求中的 CSRF token 是否匹配 Session 中的值
3. 不匹配则返回 403

---

## 参考答案

### 练习一

**操作步骤**：

```bash
# 第一步：获取 Cookie 并保存到文件
curl -v -c cookies.txt https://httpbin.org/cookies/set/token/abc123

# 查看保存的 Cookie
cat cookies.txt

# 第二步：带 Cookie 访问
curl -v -b cookies.txt https://httpbin.org/cookies
```

输出应该包含 `{"cookies": {"token": "abc123"}}`，说明 Cookie 被自动发送了。

`-c` 选项把 Cookie 保存到 Netscape 格式的文本文件，`-b` 选项从这个文件加载 Cookie。这是 curl 管理会话的标准方式。

### 练习二

**思路**：用 Session 存储 CSRF token，表单中用隐藏字段携带 token。

```js
const http = require('http')
const crypto = require('crypto')

const sessions = {}

function parseCookies(cookieHeader) {
  const cookies = {}
  if (cookieHeader) {
    cookieHeader.split(';').forEach((c) => {
      const [name, ...rest] = c.trim().split('=')
      cookies[name] = rest.join('=')
    })
  }
  return cookies
}

function getSession(req, res) {
  const cookies = parseCookies(req.headers.cookie)
  let sid = cookies['sid']
  if (!sid || !sessions[sid]) {
    sid = crypto.randomBytes(32).toString('hex')
    sessions[sid] = {}
    res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax`)
  }
  return sessions[sid]
}

const server = http.createServer((req, res) => {
  const session = getSession(req, res)

  if (req.method === 'GET' && req.url === '/form') {
    const token = crypto.randomBytes(32).toString('hex')
    session.csrfToken = token
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(`
      <form method="POST" action="/submit">
        <input type="hidden" name="_csrf" value="${token}">
        <input type="text" name="message" placeholder="输入内容">
        <button type="submit">提交</button>
      </form>
    `)
  } else if (req.method === 'POST' && req.url === '/submit') {
    let body = ''
    req.on('data', (chunk) => body += chunk)
    req.on('end', () => {
      const params = new URLSearchParams(body)
      if (params.get('_csrf') !== session.csrfToken) {
        res.writeHead(403)
        res.end('CSRF token 无效')
        return
      }
      res.end(`提交成功: ${params.get('message')}`)
    })
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

server.listen(3000, () => console.log('监听 :3000'))
```

**为什么这个方案能防 CSRF**：攻击者可以在自己的网站上构造一个 POST 表单提交到你的服务器，但他拿不到 CSRF token（因为 token 存在你的 Session 中，而 SameSite Cookie 和 HttpOnly 限制了跨站访问），所以他的请求会被拒绝。
