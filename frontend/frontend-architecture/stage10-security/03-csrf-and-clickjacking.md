# 03. CSRF 与点击劫持

> CSRF 和点击劫持都是"利用用户信任"的攻击，防御的关键是"验证请求来源"

## 本课目标

- 理解 CSRF 攻击原理和防御方法
- 掌握点击劫持的原理和防御措施
- 学会配置 X-Frame-Options 和 CSP
- 了解 SameSite Cookie 的使用

## 从一个真实场景说起

假设你在维护一个银行网站，遇到了这些问题：

1. **资金被盗**：用户被诱导访问恶意网站，导致资金被转走
2. **账户被操作**：攻击者冒充用户执行操作
3. **网站被嵌入**：你的网站被嵌入到恶意网站中

这些问题的根源是**CSRF 和点击劫持漏洞**。

## CSRF（跨站请求伪造）

### 什么是 CSRF

CSRF（Cross-Site Request Forgery）是攻击者诱导用户在已登录的情况下，向你的网站发送恶意请求。

### CSRF 原理

```
1. 用户登录 bank.com，获得 Cookie
2. 用户访问 evil.com
3. evil.com 包含隐藏的表单
4. 用户浏览器自动向 bank.com 发送请求
5. bank.com 识别到用户的 Cookie，认为是合法请求
```

### CSRF 攻击示例

```html
<!-- evil.com -->
<img src="https://bank.com/transfer?to=attacker&amount=10000" style="display:none">

<!-- 或者使用表单 -->
<form action="https://bank.com/transfer" method="POST" id="csrf-form">
  <input type="hidden" name="to" value="attacker">
  <input type="hidden" name="amount" value="10000">
</form>
<script>document.getElementById('csrf-form').submit();</script>
```

### CSRF 防御

#### 1. CSRF Token

```javascript
// 服务端生成 CSRF Token
app.get('/api/csrf-token', (req, session) => {
  const token = generateToken();
  req.session.csrfToken = token;
  res.json({ token });
});

// 客户端在请求中携带 Token
async function transfer(to, amount) {
  const { token } = await fetch('/api/csrf-token').then(r => r.json());
  
  await fetch('/api/transfer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token
    },
    body: JSON.stringify({ to, amount })
  });
}
```

#### 2. SameSite Cookie

```javascript
// 设置 SameSite Cookie
res.cookie('session', sessionId, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict'  // 或 'lax'
});
```

**SameSite 值**：
- `strict`：完全禁止第三方 Cookie
- `lax`：GET 请求允许，POST 请求禁止
- `none`：允许（必须配合 Secure）

#### 3. 验证 Origin 和 Referer

```javascript
// 验证请求来源
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer;
  
  if (!origin || !origin.startsWith('https://bank.com')) {
    return res.status(403).json({ error: 'Invalid origin' });
  }
  
  next();
});
```

#### 4. 自定义请求头

```javascript
// 客户端添加自定义头
fetch('/api/transfer', {
  method: 'POST',
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ to, amount })
});

// 服务端验证自定义头
app.use((req, res, next) => {
  if (req.method === 'POST' && !req.headers['x-requested-with']) {
    return res.status(403).json({ error: 'Missing custom header' });
  }
  next();
});
```

### CSRF 防御最佳实践

```javascript
// 完整的 CSRF 防御中间件
function csrfProtection(req, res, next) {
  // 1. 验证请求方法
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // 2. 验证 Origin
    const origin = req.headers.origin;
    if (origin && origin !== 'https://bank.com') {
      return res.status(403).json({ error: 'Invalid origin' });
    }
    
    // 3. 验证 Referer
    const referer = req.headers.referer;
    if (referer && !referer.startsWith('https://bank.com')) {
      return res.status(403).json({ error: 'Invalid referer' });
    }
    
    // 4. 验证 CSRF Token
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    if (token !== req.session.csrfToken) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }
  
  next();
}
```

## 点击劫持（Clickjacking）

### 什么是点击劫持

点击劫持是攻击者将你的网站嵌入到透明的 iframe 中，诱导用户点击隐藏的元素。

### 点击劫持原理

```
1. 攻击者创建一个恶意网站
2. 恶意网站包含透明的 iframe，指向你的网站
3. 恶意网站显示诱导用户点击的内容
4. 用户点击时，实际上点击的是 iframe 中的按钮
5. 用户在不知情的情况下执行了操作
```

### 点击劫持示例

```html
<!-- evil.com -->
<style>
  iframe {
    position: absolute;
    width: 700px;
    height: 500px;
    opacity: 0.0001;
    z-index: 2;
  }
  
  .bait {
    position: absolute;
    top: 250px;
    left: 100px;
    z-index: 1;
  }
</style>

<div class="bait">点击领取奖品</div>
<iframe src="https://bank.com/transfer?to=attacker&amount=10000"></iframe>
```

### 点击劫持防御

#### 1. X-Frame-Options

```nginx
# 完全禁止嵌入
X-Frame-Options: DENY

# 只允许同源嵌入
X-Frame-Options: SAMEORIGIN

# 允许指定来源嵌入
X-Frame-Options: ALLOW-FROM https://example.com
```

#### 2. CSP frame-ancestors

```nginx
# 完全禁止嵌入
Content-Security-Policy: frame-ancestors 'none';

# 只允许同源嵌入
Content-Security-Policy: frame-ancestors 'self';

# 允许指定来源嵌入
Content-Security-Policy: frame-ancestors 'self' https://example.com;
```

#### 3. JavaScript 防御

```javascript
// 检测是否被嵌入
if (window !== window.top) {
  // 被嵌入了，可以采取措施
  window.top.location = window.location;
}

// 或者阻止嵌入
if (window !== window.top) {
  document.body.innerHTML = '';
  throw new Error('This page cannot be embedded');
}
```

#### 4. 二次确认

```javascript
// 关键操作需要二次确认
async function transfer(to, amount) {
  const confirmed = await showConfirmDialog(
    `确定要转账 ${amount} 元给 ${to} 吗？`
  );
  
  if (confirmed) {
    // 执行转账
  }
}
```

### 点击劫持防御最佳实践

```nginx
# Nginx 配置
server {
  # 完全禁止嵌入（推荐）
  add_header X-Frame-Options "DENY";
  
  # 或者只允许同源嵌入
  # add_header X-Frame-Options "SAMEORIGIN";
  
  # CSP 策略
  add_header Content-Security-Policy "frame-ancestors 'none';";
}
```

```javascript
// 服务端设置头
app.use((req, res, next) => {
  // 完全禁止嵌入
  res.setHeader('X-Frame-Options', 'DENY');
  
  // CSP 策略
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  
  next();
});
```

## SameSite Cookie 深入

### SameSite 值

#### Strict

```javascript
// 完全禁止第三方 Cookie
res.cookie('session', sessionId, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict'
});
```

**适用场景**：
- 银行、支付等敏感网站
- 完全不需要第三方 Cookie

#### Lax

```javascript
// 宽松模式：GET 请求允许，POST 请求禁止
res.cookie('session', sessionId, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax'
});
```

**适用场景**：
- 大多数网站
- 需要从外部链接跳转

#### None

```javascript
// 允许第三方 Cookie（必须配合 Secure）
res.cookie('session', sessionId, {
  httpOnly: true,
  secure: true,
  sameSite: 'none'
});
```

**适用场景**：
- 需要跨站使用 Cookie
- OAuth 回调

### SameSite 与 CSRF

```javascript
// 使用 SameSite 防御 CSRF
app.use((req, res, next) => {
  // 设置 SameSite Cookie
  res.cookie('session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  });
  
  next();
});
```

### SameSite 浏览器支持

| 浏览器 | 支持版本 |
|--------|----------|
| Chrome | 51+ |
| Firefox | 60+ |
| Safari | 12+ |
| Edge | 18+ |

## 安全头配置

### 完整的安全头配置

```nginx
# Nginx 安全头配置
server {
  # 防止点击劫持
  add_header X-Frame-Options "DENY" always;
  
  # 防止 MIME 类型嗅探
  add_header X-Content-Type-Options "nosniff" always;
  
  # 启用 XSS 过滤
  add_header X-XSS-Protection "1; mode=block" always;
  
  # 强制 HTTPS
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  
  # CSP 策略
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';" always;
  
  # Referrer 策略
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  
  # 权限策略
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
}
```

### Express 安全头配置

```javascript
const helmet = require('helmet');

app.use(helmet());

// 或者自定义配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
```

## React 应用防御

### CSRF Token 管理

```jsx
// CSRF Token Provider
import React, { createContext, useContext, useEffect, useState } from 'react';

const CSRFContext = createContext();

export function CSRFProvider({ children }) {
  const [token, setToken] = useState(null);

  useEffect(() => {
    fetch('/api/csrf-token')
      .then(res => res.json())
      .then(data => setToken(data.token));
  }, []);

  return (
    <CSRFContext.Provider value={token}>
      {children}
    </CSRFContext.Provider>
  );
}

export function useCSRFToken() {
  return useContext(CSRFContext);
}

// 使用 CSRF Token
function TransferForm() {
  const token = useCSRFToken();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    await fetch('/api/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token
      },
      body: JSON.stringify({
        to: e.target.to.value,
        amount: e.target.amount.value
      })
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="to" />
      <input type="number" name="amount" />
      <button type="submit">转账</button>
    </form>
  );
}
```

### 安全的 HTTP 客户端

```javascript
// 安全的 fetch 封装
async function secureFetch(url, options = {}) {
  const csrfToken = getCsrfToken();
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  };
  
  if (csrfToken) {
    defaultHeaders['X-CSRF-Token'] = csrfToken;
  }
  
  return fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });
}
```

## 本课小结

本课我们学习了 CSRF 与点击劫持防御：

1. **CSRF 原理**：利用用户登录状态发送恶意请求
2. **CSRF 防御**：CSRF Token、SameSite Cookie、验证 Origin/Referer、自定义请求头
3. **点击劫持原理**：透明 iframe 诱导用户点击
4. **点击劫持防御**：X-Frame-Options、CSP frame-ancestors、JavaScript 防御
5. **SameSite Cookie**：strict、lax、none 的区别和使用
6. **安全头配置**：完整的安全头配置方案

## 练习

### 练习一：实现 CSRF 防御

为你的项目实现 CSRF 防御：
- 生成 CSRF Token
- 验证 CSRF Token
- 配置 SameSite Cookie

### 练习二：配置安全头

为你的项目配置安全头：
- X-Frame-Options
- CSP
- 其他安全头

## 参考答案

### 练习一

```javascript
const crypto = require('crypto');
const session = require('express-session');

// 生成 CSRF Token
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// CSRF 中间件
function csrfMiddleware(req, res, next) {
  // 生成 Token 并存储在 Session 中
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  
  // 将 Token 暴露给前端
  res.locals.csrfToken = req.session.csrfToken;
  
  // 验证 POST/PUT/DELETE 请求
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    
    if (token !== req.session.csrfToken) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }
  
  next();
}

// 设置 SameSite Cookie
app.use(session({
  secret: 'your-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 1 天
  }
}));

app.use(csrfMiddleware);
```

### 练习二

```nginx
# Nginx 安全头配置
server {
  listen 443 ssl http2;
  server_name example.com;
  
  # SSL 配置
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  # 安全头
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
  
  location / {
    proxy_pass http://localhost:3000;
  }
}
```

## 下一步

完成本课后，继续学习 [04. 依赖安全与供应链攻击](./04-dependency-security.md)。