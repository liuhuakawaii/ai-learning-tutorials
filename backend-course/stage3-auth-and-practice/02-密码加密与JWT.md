# 第二课：密码加密与 JWT

## 场景引入

2023 年某知名社交平台发生数据泄露，1 亿用户的邮箱和密码被公开。由于该平台使用 MD5 存储密码，攻击者通过彩虹表在几小时内就还原了大部分用户的原始密码。更严重的是，很多用户在不同网站使用相同密码，导致连锁反应——大量其他平台的账号也被盗用。这个真实案例告诉我们：密码存储方式直接关系到用户的安全。与此同时，用户登录后如何在无状态的 HTTP 协议中保持身份？JWT（JSON Web Token）正是现代前后端分离架构中最主流的解决方案。本课将深入讲解密码加密的最佳实践和 JWT 双令牌机制的完整实现。

## 学习目标

完成本课学习后，你将能够：

1. 理解常见密码加密方案的区别，知道为什么 bcrypt 是最佳选择
2. 掌握 bcrypt 的使用方法（hash 和 compare）
3. 深入理解 JWT 的结构、签名原理和过期机制
4. 掌握 Access Token + Refresh Token 双令牌机制
5. 学会管理环境变量，封装认证工具函数

---

## 一、密码加密方案对比

### 1.1 为什么需要加密

```
数据库泄露是真实存在的威胁：

2023 年某知名公司数据库泄露：
  - 1 亿用户的邮箱和密码被公开
  - 明文存储 → 所有密码直接暴露
  - 用户在其他网站使用相同密码 → 连锁反应

即使数据库泄露，加密存储也能：
  ✅ 让攻击者无法直接获得原始密码
  ✅ 大幅增加破解成本和时间
  ✅ 保护用户在其他平台的账号安全
```

### 1.2 MD5 —— 为什么不安全

```
MD5（Message-Digest Algorithm 5）：
  一种哈希算法，输出 128 位（32 个十六进制字符）

示例：
  MD5("123456") = e10adc3949ba59abbe56e057f20f883e
  MD5("hello")  = 5d41402abc4b2a76b9719d911017c592

特点：
  - 同样的输入，永远得到同样的输出
  - 不可逆（理论上无法从哈希值推导出原始密码）
```

#### 为什么 MD5 不安全

```
攻击方式1：彩虹表攻击（Rainbow Table）

  彩虹表 = 预先计算好的 "密码 → 哈希值" 对照表

  常见密码的 MD5 值早已被计算出来：
  ┌─────────────┬──────────────────────────────────┐
  │ 密码         │ MD5                              │
  ├─────────────┼──────────────────────────────────┤
  │ 123456      │ e10adc3949ba59abbe56e057f20f883e │
  │ password    │ 5f4dcc3b5aa765d61d8327deb882cf99 │
  │ qwerty      │ d8578edf8458ce06fbc5bb76a58c5ca4 │
  │ letmein     │ 0d107d09f5bbe40cade3de5c71e9e9b7 │
  └─────────────┴──────────────────────────────────┘

  攻击者拿到 MD5 哈希值，查表即可得到原始密码！

攻击方式2：暴力破解

  MD5 计算速度极快（每秒可计算数十亿次）
  6 位纯数字密码：最多 100 万种组合
  用 GPU 几秒钟就能全部试完
```

### 1.3 SHA 系列 —— 为什么也不适合密码加密

```
SHA-256、SHA-512 等：
  比 MD5 更安全，常用于数据完整性校验
  但仍然不适合密码加密！

原因：
  ❌ 计算速度太快（设计初衷是"快速"）
  ❌ 没有内置"加盐"机制（需要手动实现）
  ❌ 对于密码场景，"快"反而是缺点
```

```
密码加密的矛盾需求：

  数据校验（SHA 的用途）：越快越好 → 快速验证文件是否被篡改
  密码存储（我们的用途）：越慢越好 → 让暴力破解的成本极高

  这就是为什么我们需要专门的密码哈希算法
```

### 1.4 bcrypt —— 最佳选择

```
bcrypt 的核心优势：

  1. 加盐（Salt）
     - 每次哈希都自动生成随机盐值
     - 相同的密码，每次得到不同的哈希值
     - 彩虹表攻击失效！

  2. 慢哈希（Slow Hash）
     - 可以调节计算复杂度（cost factor）
     - 让暴力破解变得极其昂贵
     - 对用户来说，一次登录慢 100ms 无所谓
     - 对攻击者来说，试 10 亿次密码需要几百年

  3. 自适应
     - 随着硬件性能提升，可以增加 cost factor
     - 保证破解成本始终足够高
```

#### bcrypt 工作原理

```
bcrypt 哈希过程：

  输入密码: "myPassword123"
      │
      ▼
  ┌──────────────────┐
  │  生成随机盐值      │
  │  salt = "$2b$10$" │
  │  + 22 位随机字符   │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │  bcrypt 加密      │
  │  (Blowfish 算法)  │
  │  cost = 10       │
  │  (2^10 = 1024 轮) │
  └────────┬─────────┘
           │
           ▼
  输出哈希: "$2b$10$N9qo8uLOickgx2ZMRZoMMe9ZvHbMxb.1Jp5W3U8XkA6Tf0nqrCOe"
            ↑       ↑                    ↑
            版本   cost                salt + hash（60 位）

  每次调用，salt 不同，输出也不同：
  bcrypt("myPassword123") → "$2b$10$abc..."
  bcrypt("myPassword123") → "$2b$10$xyz..."  ← 同一密码，不同结果！
```

---

## 二、bcrypt 代码实现

### 2.1 安装依赖

```bash
# 安装 bcrypt 和类型定义
npm install bcrypt
npm install -D @types/bcrypt

# TypeScript 项目推荐用 bcryptjs（纯 JS 实现，不需要编译原生模块）
npm install bcryptjs
npm install -D @types/bcryptjs
```

### 2.2 基本用法

```typescript
import bcrypt from 'bcryptjs'

// ==================== 哈希密码 ====================
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10  // cost factor，推荐 10-12
  const hashedPassword = await bcrypt.hash(password, saltRounds)
  return hashedPassword
}

// 使用示例
const password = 'myPassword123'
const hash = await hashPassword(password)
console.log(hash)
// 输出: "$2b$10$N9qo8uLOickgx2ZMRZoMMe..."
// 每次运行结果不同（因为随机盐值）

// ==================== 验证密码 ====================
async function comparePassword(password: string, hash: string): Promise<boolean> {
  const isMatch = await bcrypt.compare(password, hash)
  return isMatch
}

// 使用示例
const isCorrect = await comparePassword('myPassword123', hash)
console.log(isCorrect)  // true

const isWrong = await comparePassword('wrongPassword', hash)
console.log(isWrong)    // false
```

### 2.3 完整的密码工具模块

```typescript
// src/utils/password.ts
import bcrypt from 'bcryptjs'

// salt rounds 越大越安全，但越慢
// 10 = 约 100ms，12 = 约 300ms，14 = 约 1.5s
const SALT_ROUNDS = 10

/**
 * 对密码进行哈希加密
 * @param password - 原始密码
 * @returns 哈希后的密码
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS)
    const hashedPassword = await bcrypt.hash(password, salt)
    return hashedPassword
  } catch (error) {
    throw new Error('密码加密失败')
  }
}

/**
 * 验证密码是否匹配
 * @param password - 用户输入的原始密码
 * @param hashedPassword - 数据库中存储的哈希密码
 * @returns 是否匹配
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(password, hashedPassword)
    return isMatch
  } catch (error) {
    throw new Error('密码验证失败')
  }
}

// ==================== 测试 ====================
async function test() {
  // 测试哈希
  const password = 'Test123456'
  const hash = await hashPassword(password)
  console.log('原始密码:', password)
  console.log('哈希结果:', hash)

  // 测试验证
  console.log('正确密码验证:', await comparePassword('Test123456', hash))  // true
  console.log('错误密码验证:', await comparePassword('WrongPassword', hash))  // false

  // 验证相同密码产生不同哈希
  const hash2 = await hashPassword(password)
  console.log('两次哈希结果相同?', hash === hash2)  // false（盐值不同）
  console.log('但都能验证通过?', await comparePassword(password, hash2))  // true
}

test()
```

### 2.4 bcrypt 性能测试

```typescript
import bcrypt from 'bcryptjs'

async function benchmark() {
  const password = 'TestPassword123'
  const rounds = [8, 10, 12, 14]

  console.log('bcrypt 性能测试：')
  console.log('─'.repeat(50))

  for (const round of rounds) {
    const start = Date.now()
    await bcrypt.hash(password, round)
    const duration = Date.now() - start
    console.log(`Rounds ${round}: ${duration}ms (2^${round} = ${Math.pow(2, round)} 轮)`)
  }
}

benchmark()

// 典型输出：
// Rounds 8:  ~30ms
// Rounds 10: ~100ms   ← 推荐值
// Rounds 12: ~350ms
// Rounds 14: ~1400ms
```

---

## 三、JWT 详解

### 3.1 JWT 是什么

```
JWT（JSON Web Token）= 一种紧凑的、URL 安全的令牌格式

一句话理解：
  JWT 就是一个"密封的身份证明文件"
  - 里面有你的信息（姓名、角色等）
  - 有防伪标记（签名）
  - 有有效期（过期时间）
```

### 3.2 JWT 的结构

```
JWT 由三部分组成，用 . 分隔：

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiZXhhbXBsZUBnbWFpbC5jb20iLCJyb2xlIjoiVVNFUiIsImlhdCI6MTcxNjAwMDAwMCwiZXhwIjoxNzE2NjA0ODAwfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

拆解：
  第1段: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
         ↓ Base64 解码
         {"alg":"HS256","typ":"JWT"}
         → Header（头部）：算法和类型

  第2段: eyJ1c2VySWQiOjEsImVtYWlsIjoiZXhhbXBsZUBnbWFpbC5jb20iLCJyb2xlIjoiVVNFUiIsImlhdCI6MTcxNjAwMDAwMCwiZXhwIjoxNzE2NjA0ODAwfQ
         ↓ Base64 解码
         {"userId":1,"email":"example@gmail.com","role":"USER","iat":1716000000,"exp":1716604800}
         → Payload（载荷）：用户信息

  第3段: SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
         → Signature（签名）：防伪标记
```

### 3.3 JWT 结构图解

```
┌────────────────────────────────────────────────────────────┐
│                         JWT Token                           │
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Header     │  │  Payload    │  │  Signature  │       │
│  │  (头部)      │  │  (载荷)     │  │  (签名)     │       │
│  │             │  │             │  │             │       │
│  │ {           │  │ {           │  │             │       │
│  │  "alg":     │  │  "userId":  │  │  HMAC-SHA256│       │
│  │   "HS256",  │  │    1,      │  │  (          │       │
│  │  "typ":     │  │  "email":   │  │   Header +  │       │
│  │   "JWT"     │  │   "...",    │  │   Payload + │       │
│  │ }           │  │  "role":    │  │   Secret    │       │
│  │             │  │   "USER",   │  │  )          │       │
│  │             │  │  "exp":     │  │             │       │
│  │ Base64 编码  │  │   1716604800│  │             │       │
│  └─────────────┘  │ }           │  └─────────────┘       │
│                    │             │                         │
│                    │ Base64 编码  │                         │
│                    └─────────────┘                         │
│                                                            │
│  三段用 . 连接: Header.Payload.Signature                    │
└────────────────────────────────────────────────────────────┘
```

### 3.4 签名原理

```
签名的作用：防篡改

  签名算法（HMAC SHA256）：
  Signature = HMAC-SHA256(
    base64UrlEncode(Header) + "." + base64UrlEncode(Payload),
    Secret    ← 只有服务器知道的密钥
  )

为什么不可篡改：

  场景：攻击者想把 role 从 "USER" 改成 "ADMIN"

  原始 Token:
    Header.Payload.Signature ✅

  攻击者修改 Payload:
    Header.NEW_Payload.Signature ❌
                     ↑
        签名是用原始 Payload 计算的
        改了 Payload，签名就不匹配了
        服务器验证时会失败！

  攻击者同时修改 Payload 和 Signature:
    Header.NEW_Payload.NEW_Signature ❌
                     ↑
        攻击者不知道 Secret
        无法计算出正确的签名
        服务器验证时会失败！

  结论：没有 Secret，就无法伪造有效的 Token
```

### 3.5 JWT 的 Claims（声明）

```typescript
// JWT 标准 Claims
interface JWTClaims {
  // === 注册声明（Registered Claims）===
  iss?: string    // Issuer：签发者
  sub?: string    // Subject：主题（通常是用户 ID）
  aud?: string    // Audience：受众
  exp?: number    // Expiration Time：过期时间（Unix 时间戳）
  nbf?: number    // Not Before：生效时间
  iat?: number    // Issued At：签发时间
  jti?: string    // JWT ID：唯一标识

  // === 自定义声明（Custom Claims）===
  userId?: number
  email?: string
  role?: string
}

// 示例 Payload
{
  "sub": "1",                              // 用户 ID
  "email": "test@example.com",             // 用户邮箱
  "role": "USER",                          // 用户角色
  "iat": 1716000000,                       // 签发时间
  "exp": 1716604800                        // 过期时间（7 天后）
}
```

> **重要提醒：Payload 是 Base64 编码，不是加密！任何人都能解码看到内容。绝对不要在 JWT 中存储密码等敏感信息！**

---

## 四、jsonwebtoken 库使用

### 4.1 安装

```bash
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

### 4.2 核心 API

```typescript
import jwt from 'jsonwebtoken'

// 密钥（必须保密！通常放在环境变量中）
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret'

// ==================== sign：生成 Token ====================
function generateToken(payload: object, expiresIn: string = '7d'): string {
  const token = jwt.sign(payload, SECRET_KEY, { expiresIn })
  return token
}

// 使用示例
const token = generateToken({
  userId: 1,
  email: 'test@example.com',
  role: 'USER'
})
console.log(token)
// 输出: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// ==================== verify：验证 Token ====================
function verifyToken(token: string): any {
  try {
    const payload = jwt.verify(token, SECRET_KEY)
    return payload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token 已过期')
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Token 无效')
    }
    throw new Error('Token 验证失败')
  }
}

// 使用示例
try {
  const payload = verifyToken(token)
  console.log(payload)
  // { userId: 1, email: 'test@example.com', role: 'USER', iat: ..., exp: ... }
} catch (error) {
  console.error(error.message)
}

// ==================== decode：解码（不验证签名）====================
function unsafeDecode(token: string): any {
  const payload = jwt.decode(token)
  return payload
}

// 注意：decode 不验证签名，任何人都能解码！
// 仅用于调试，不要用于安全判断
```

### 4.3 完整的 JWT 工具模块

```typescript
// src/utils/jwt.ts
import jwt, { JwtPayload } from 'jsonwebtoken'

// 从环境变量读取密钥
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access-secret-key'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key'
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES || '15m'
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES || '7d'

// Token 载荷接口
export interface TokenPayload {
  userId: number
  email: string
  role: string
}

// Token 响应接口
export interface TokenPair {
  accessToken: string
  refreshToken: string
}

/**
 * 生成 Access Token
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN
  })
}

/**
 * 生成 Refresh Token
 */
export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(
    { userId: payload.userId },  // Refresh Token 只存 userId
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  )
}

/**
 * 生成 Token 对（Access + Refresh）
 */
export function generateTokenPair(payload: TokenPayload): TokenPair {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  }
}

/**
 * 验证 Access Token
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as TokenPayload & JwtPayload
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('ACCESS_TOKEN_EXPIRED')
    }
    throw new Error('ACCESS_TOKEN_INVALID')
  }
}

/**
 * 验证 Refresh Token
 */
export function verifyRefreshToken(token: string): { userId: number } {
  try {
    const payload = jwt.verify(token, REFRESH_SECRET) as JwtPayload
    return { userId: payload.userId }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('REFRESH_TOKEN_EXPIRED')
    }
    throw new Error('REFRESH_TOKEN_INVALID')
  }
}

/**
 * 从 Authorization header 提取 Token
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.split(' ')[1]
}
```

---

## 五、Access Token + Refresh Token 双令牌机制

### 5.1 为什么需要双 Token

```
单 Token 的问题：

  如果 Access Token 有效期很长（比如 30 天）：
    ❌ 一旦泄露，攻击者可以长时间使用
    ❌ 无法主动吊销（除非用黑名单）

  如果 Access Token 有效期很短（比如 15 分钟）：
    ❌ 用户每 15 分钟就要重新登录
    ❌ 用户体验极差

双 Token 解决方案：

  Access Token（访问令牌）：
    - 有效期短（15 分钟）
    - 用于访问 API
    - 泄露后影响时间有限

  Refresh Token（刷新令牌）：
    - 有效期长（7 天）
    - 只用于获取新的 Access Token
    - 存储更安全（httpOnly Cookie）
    - 可以被服务端吊销
```

### 5.2 双 Token 工作流程

```
┌──────────┐                              ┌──────────┐
│  浏览器   │                              │  服务器   │
└────┬─────┘                              └────┬─────┘
     │                                         │
     │  1. POST /login                         │
     │ ──────────────────────────────────────→ │
     │                                         │ 验证密码
     │  2. 返回 Access Token + Refresh Token    │
     │ ←────────────────────────────────────── │
     │                                         │
     │  （存储两个 Token）                        │
     │                                         │
     │  3. GET /api/profile                    │
     │     Authorization: Bearer <AccessToken> │
     │ ──────────────────────────────────────→ │
     │                                         │ 验证 Access Token
     │  4. 返回数据                              │
     │ ←────────────────────────────────────── │
     │                                         │
     │  ... 15 分钟后 ...                        │
     │                                         │
     │  5. GET /api/profile                    │
     │     Authorization: Bearer <旧Token>      │
     │ ──────────────────────────────────────→ │
     │                                         │ Access Token 过期！
     │  6. 401 Token Expired                   │
     │ ←────────────────────────────────────── │
     │                                         │
     │  7. POST /auth/refresh                  │
     │     { refreshToken: "xxx" }             │
     │ ──────────────────────────────────────→ │
     │                                         │ 验证 Refresh Token
     │                                         │ 生成新的 Token 对
     │  8. 返回新的 Access Token + Refresh Token │
     │ ←────────────────────────────────────── │
     │                                         │
     │  9. 用新 Token 重新发起请求               │
     │ ──────────────────────────────────────→ │
```

### 5.3 自动刷新 Token 的前端实现

```typescript
// 前端：封装带自动刷新的请求函数

interface TokenPair {
  accessToken: string
  refreshToken: string
}

let accessToken = localStorage.getItem('accessToken')
let refreshToken = localStorage.getItem('refreshToken')

// 存储 Token
function saveTokens(tokens: TokenPair) {
  accessToken = tokens.accessToken
  refreshToken = tokens.refreshToken
  localStorage.setItem('accessToken', tokens.accessToken)
  localStorage.setItem('refreshToken', tokens.refreshToken)
}

// 刷新 Token
async function refreshAccessToken(): Promise<string> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })

  if (!response.ok) {
    // Refresh Token 也过期了，需要重新登录
    localStorage.clear()
    window.location.href = '/login'
    throw new Error('需要重新登录')
  }

  const tokens = await response.json()
  saveTokens(tokens)
  return tokens.accessToken
}

// 封装请求函数（自动处理 Token 刷新）
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // 添加 Authorization header
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`
  }

  let response = await fetch(url, { ...options, headers })

  // 如果返回 401，尝试刷新 Token
  if (response.status === 401) {
    try {
      const newAccessToken = await refreshAccessToken()

      // 用新 Token 重试请求
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${newAccessToken}`
        }
      })
    } catch (error) {
      throw new Error('认证失败，请重新登录')
    }
  }

  return response
}

// 使用示例
const response = await authFetch('/api/articles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: '新文章', content: '...' })
})
```

---

## 六、环境变量管理

### 6.1 为什么需要环境变量

```
代码中不能硬编码敏感信息：

❌ 错误做法：
const SECRET = 'my-super-secret-key'
const DB_PASSWORD = 'admin123'
const API_KEY = 'sk-1234567890'

问题：
  1. 代码提交到 Git，密钥就泄露了
  2. 不同环境（开发/测试/生产）用同一个密钥
  3. 更改密钥需要改代码

✅ 正确做法：
const SECRET = process.env.JWT_SECRET
const DB_PASSWORD = process.env.DB_PASSWORD
const API_KEY = process.env.API_KEY
```

### 6.2 dotenv 库使用

```bash
npm install dotenv
```

```typescript
// src/config/env.ts
import dotenv from 'dotenv'

// 加载 .env 文件中的环境变量
dotenv.config()

export const env = {
  // 服务器配置
  PORT: parseInt(process.env.PORT || '3000'),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // 数据库配置
  DATABASE_URL: process.env.DATABASE_URL || '',

  // JWT 配置
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '15m',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '7d',

  // 文件上传配置
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880'),  // 5MB

  // CORS 配置
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
}
```

### 6.3 .env 文件

```bash
# .env（不要提交到 Git！）

# 服务器
PORT=3000
NODE_ENV=development

# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/blog_db

# JWT 密钥（生产环境用长随机字符串）
JWT_ACCESS_SECRET=dev-access-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# 文件上传
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

# CORS
CORS_ORIGIN=http://localhost:5173
```

```bash
# .env.example（提交到 Git，作为模板）

# 服务器
PORT=3000
NODE_ENV=development

# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/blog_db

# JWT（请替换为随机生成的密钥）
JWT_ACCESS_SECRET=your-access-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# 文件上传
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 6.4 生成安全的随机密钥

```typescript
// scripts/generate-secrets.ts
import crypto from 'crypto'

function generateSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('hex')
}

console.log('JWT_ACCESS_SECRET=' + generateSecret())
console.log('JWT_REFRESH_SECRET=' + generateSecret())

// 输出示例：
// JWT_ACCESS_SECRET=a1b2c3d4e5f6...（128 位十六进制字符）
// JWT_REFRESH_SECRET=f6e5d4c3b2a1...
```

```bash
# 或者用命令行生成
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 6.5 .gitignore 配置

```gitignore
# 环境变量
.env
.env.local
.env.*.local

# 编译输出
dist/

# 依赖
node_modules/

# 上传的文件
uploads/

# 日志
logs/

# IDE
.vscode/
.idea/
```

---

## 七、封装认证工具函数

### 7.1 完整的 auth 工具模块

```typescript
// src/utils/auth.ts
import bcrypt from 'bcryptjs'
import jwt, { JwtPayload } from 'jsonwebtoken'
import crypto from 'crypto'
import { env } from '../config/env'

// ==================== 密码相关 ====================

const SALT_ROUNDS = 10

/**
 * 对密码进行哈希加密
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * 验证密码是否匹配
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

/**
 * 验证密码强度
 * 规则：至少 8 位，包含大小写字母和数字
 */
export function validatePasswordStrength(password: string): {
  valid: boolean
  message: string
} {
  if (password.length < 8) {
    return { valid: false, message: '密码长度至少 8 位' }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '密码必须包含小写字母' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '密码必须包含大写字母' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码必须包含数字' }
  }
  return { valid: true, message: '密码强度合格' }
}

// ==================== JWT 相关 ====================

export interface TokenPayload {
  userId: number
  email: string
  role: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

/**
 * 生成 Access Token
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES
  })
}

/**
 * 生成 Refresh Token
 */
export function generateRefreshToken(userId: number): string {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES
  })
}

/**
 * 生成 Token 对
 */
export function generateTokenPair(payload: TokenPayload): TokenPair {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload.userId)
  }
}

/**
 * 验证 Access Token
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload & JwtPayload
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('ACCESS_TOKEN_EXPIRED')
    }
    throw new Error('ACCESS_TOKEN_INVALID')
  }
}

/**
 * 验证 Refresh Token
 */
export function verifyRefreshToken(token: string): { userId: number } {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload
    return { userId: payload.userId }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('REFRESH_TOKEN_EXPIRED')
    }
    throw new Error('REFRESH_TOKEN_INVALID')
  }
}

/**
 * 从 Authorization header 提取 Token
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.split(' ')[1]
}

// ==================== 邮箱验证 ====================

/**
 * 验证邮箱格式
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// ==================== 测试 ====================

async function test() {
  console.log('=== 密码测试 ===')
  const password = 'TestPassword123'
  const hash = await hashPassword(password)
  console.log('哈希结果:', hash)
  console.log('验证正确密码:', await comparePassword(password, hash))
  console.log('验证错误密码:', await comparePassword('wrong', hash))
  console.log('密码强度检查:', validatePasswordStrength('abc'))      // 不合格
  console.log('密码强度检查:', validatePasswordStrength('Test1234'))  // 合格

  console.log('\n=== JWT 测试 ===')
  const payload: TokenPayload = { userId: 1, email: 'test@example.com', role: 'USER' }
  const tokens = generateTokenPair(payload)
  console.log('Access Token:', tokens.accessToken.substring(0, 50) + '...')
  console.log('Refresh Token:', tokens.refreshToken.substring(0, 50) + '...')

  const verified = verifyAccessToken(tokens.accessToken)
  console.log('验证结果:', verified)
}

test()
```

---

## 动手练习

### 练习 1：密码哈希实验

```typescript
// 完成以下函数，实现密码哈希和验证

import bcrypt from 'bcryptjs'

// 1. 实现 hashPassword 函数
async function hashPassword(password: string): Promise<string> {
  // TODO: 使用 bcrypt 对密码进行哈希
  // 提示：salt rounds 设为 10
}

// 2. 实现 comparePassword 函数
async function comparePassword(password: string, hash: string): Promise<boolean> {
  // TODO: 使用 bcrypt.compare 验证密码
}

// 3. 测试你的实现
async function test() {
  const password = 'MySecurePassword123'

  const hash = await hashPassword(password)
  console.log('哈希值:', hash)

  console.log('正确密码:', await comparePassword(password, hash))  // 应该返回 true
  console.log('错误密码:', await comparePassword('wrong', hash))    // 应该返回 false

  // 验证同一密码产生不同哈希
  const hash2 = await hashPassword(password)
  console.log('两次哈希不同:', hash !== hash2)  // 应该返回 true
  console.log('但都验证通过:', await comparePassword(password, hash2))  // 应该返回 true
}

test()
```

### 练习 2：JWT Token 生成与验证

```typescript
// 完成以下函数，实现 JWT 的生成和验证

import jwt from 'jsonwebtoken'

const SECRET = 'my-secret-key'

// 1. 实现生成 Token 函数
function generateToken(userId: number, email: string, role: string): string {
  // TODO: 使用 jwt.sign 生成 Token
  // 设置过期时间为 1 小时
}

// 2. 实现验证 Token 函数
function verifyToken(token: string): { userId: number; email: string; role: string } | null {
  // TODO: 使用 jwt.verify 验证 Token
  // 验证失败返回 null
}

// 3. 测试
const token = generateToken(1, 'test@example.com', 'USER')
console.log('Token:', token)

const payload = verifyToken(token)
console.log('Payload:', payload)

const invalid = verifyToken('invalid-token')
console.log('Invalid:', invalid)  // 应该返回 null
```

### 练习 3：封装完整的认证工具

```typescript
// 为博客系统封装一个完整的 auth 工具模块，包含：

// 1. hashPassword(password: string): Promise<string>
// 2. comparePassword(password: string, hash: string): Promise<boolean>
// 3. validatePasswordStrength(password: string): { valid: boolean; message: string }
// 4. generateTokenPair(user: { id: number; email: string; role: string }): TokenPair
// 5. verifyAccessToken(token: string): TokenPayload
// 6. extractToken(authHeader: string | null): string | null

// 要求：
// - 使用 TypeScript 类型定义
// - 包含完整的错误处理
// - 编写测试用例
```

---

## 常见误区

1. **用 MD5 或 SHA 做密码加密**：MD5 和 SHA 系列算法设计初衷是"快速校验"，不是密码存储。它们计算速度极快（每秒数十亿次），暴力破解成本极低。密码加密需要"慢哈希"算法（如 bcrypt），让暴力破解变得不现实。

2. **在 JWT Payload 中存储敏感信息**：JWT 的 Payload 只是 Base64 编码，不是加密。任何人都可以解码看到内容（用 `atob()` 即可）。绝对不要在 Payload 中放密码、银行卡号等敏感数据。

3. **Access Token 有效期设得太长**：为了让用户"不用频繁登录"，把 Access Token 有效期设为 30 天。一旦 Token 泄露，攻击者可以长期冒充用户。正确做法是 Access Token 短有效期（15 分钟），Refresh Token 长有效期（7 天）。

4. **JWT 密钥使用弱密码**：用 `123456` 或 `secret` 作为 JWT 签名密钥，等于没有签名。密钥应该是至少 32 字节的随机字符串，且通过环境变量管理，不硬编码在代码中。

---

## 工程建议

1. **bcrypt 的 salt rounds 选 10-12**：rounds=10 约 100ms，rounds=12 约 350ms。对于登录场景，100ms 的延迟用户几乎无感，但暴力破解成本会指数级增长。不要为了追求极致性能而降低 rounds。

2. **JWT 密钥用 `crypto.randomBytes(64).toString('hex')` 生成**：不要自己编造密钥。每个环境（开发/测试/生产）使用不同的密钥，生产密钥至少 64 字节。

3. **实现 Token 轮转（Refresh Token Rotation）**：每次使用 Refresh Token 获取新 Token 对时，同时颁发新的 Refresh Token 并废弃旧的。这样即使某个 Refresh Token 泄露，攻击者也只能用一次。

4. **统一管理认证工具函数**：将 `hashPassword`、`comparePassword`、`generateTokenPair`、`verifyAccessToken` 等函数封装在 `utils/auth.ts` 中，避免在业务代码中直接调用 bcrypt 和 jwt 库。

---

## 小结

本课我们深入学习了密码加密和 JWT 的核心知识：

| 主题 | 要点 |
|------|------|
| **MD5/SHA** | 不适合密码加密，计算太快，容易被暴力破解 |
| **bcrypt** | 最佳密码哈希方案，加盐 + 慢哈希，抗暴力破解 |
| **bcrypt 使用** | `hash()` 加密，`compare()` 验证，salt rounds 推荐 10 |
| **JWT 结构** | Header.Payload.Signature，Base64 编码，不是加密 |
| **JWT 签名** | HMAC SHA256，防篡改，密钥必须保密 |
| **JWT Claims** | 标准声明（exp, iat, sub）+ 自定义声明 |
| **双 Token 机制** | Access Token 短有效期 + Refresh Token 长有效期 |
| **环境变量** | 敏感信息用 dotenv 管理，不硬编码，不提交 Git |
| **工具封装** | 统一的 auth 工具模块，方便复用 |

下一课我们将把这些工具组合起来，实现完整的 **登录注册流程**。
