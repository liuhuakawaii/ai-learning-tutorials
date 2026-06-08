# 第五课：XSS、CSRF 和输入清理

## 学习目标

完成本课学习后，你将能够：

1. 理解 XSS 攻击的原理和防护
2. 理解 CSRF 攻击的原理和防护
3. 实现输入验证和清理
4. 安全地处理用户输入

---

## 一、XSS 攻击

### 1.1 什么是 XSS

> **XSS（Cross-Site Scripting）是指攻击者在网页中注入恶意脚本，当其他用户访问时执行。**

```
攻击流程：
1. 攻击者在评论中提交：<script>stealCookies()</script>
2. 服务器保存这条评论
3. 其他用户访问页面，看到这条评论
4. 浏览器执行其中的脚本
5. 攻击者获取用户的 Cookie
```

### 1.2 XSS 类型

```
存储型 XSS
  → 恶意代码存储在服务器
  → 所有访问者都会执行
  → 最危险

反射型 XSS
  → 恶意代码在 URL 中
  → 用户点击链接时执行
  → 需要诱导用户点击

DOM 型 XSS
  → 恶意代码通过 DOM 操作执行
  → 不经过服务器
  → 前端漏洞
```

### 1.3 React 的防护

```tsx
// React 默认转义 HTML
export default function Comment({ text }) {
  return <p>{text}</p>
  // 即使 text 包含 <script>，也会被转义显示
}

// ❌ 危险：使用 dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ 安全：使用 DOMPurify 清理
import DOMPurify from 'dompurify'

<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

---

## 二、CSRF 攻击

### 2.1 什么是 CSRF

> **CSRF（Cross-Site Request Forgery）是指攻击者诱导用户在已登录的网站上执行非本意的操作。**

```
攻击流程：
1. 用户登录了 bank.com
2. 用户访问 evil.com
3. evil.com 页面中有：<img src="https://bank.com/transfer?to=attacker&amount=1000">
4. 浏览器自动带上 bank.com 的 Cookie
5. bank.com 以为是用户本人操作
6. 转账成功
```

### 2.2 CSRF 防护

```tsx
// Next.js Server Actions 自动防护 CSRF
// 因为 Server Actions 使用 POST 请求，并且有特殊的 header 验证

// 手动检查 Origin
export async function POST(request: Request) {
  const origin = request.headers.get('origin')

  if (origin !== process.env.NEXT_PUBLIC_URL) {
    return new Response('Forbidden', { status: 403 })
  }

  // 处理请求
}
```

### 2.3 SameSite Cookie

```tsx
// lib/session.ts
export const sessionOptions: SessionOptions = {
  cookieOptions: {
    sameSite: 'lax',  // 防止 CSRF
    httpOnly: true,    // 防止 XSS 读取
    secure: true,      // 只在 HTTPS 发送
  }
}
```

---

## 三、输入验证

### 3.1 使用 Zod 验证

```tsx
import { z } from 'zod'

const UserInputSchema = z.object({
  name: z.string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z一-龥]+$/, '只能包含字母和汉字'),

  email: z.string().email(),

  age: z.number()
    .int()
    .min(0)
    .max(150),

  bio: z.string()
    .max(500)
    .transform(val => val.replace(/<[^>]*>/g, '')), // 移除 HTML 标签
})

export async function updateUser(formData: FormData) {
  const validated = UserInputSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    age: Number(formData.get('age')),
    bio: formData.get('bio'),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  // 使用验证后的数据
  await prisma.user.update({
    where: { id: userId },
    data: validated.data
  })
}
```

### 3.2 输入清理

```tsx
// 移除 HTML 标签
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

// 转义特殊字符
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 清理文件名
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
}
```

---

## 四、SQL 注入防护

### 4.1 Prisma 自动防护

```tsx
// Prisma 使用参数化查询，自动防止 SQL 注入

// ✅ 安全
const users = await prisma.user.findMany({
  where: {
    name: userInput  // 自动参数化
  }
})

// ❌ 危险：原生 SQL
const users = await prisma.$queryRaw(
  `SELECT * FROM users WHERE name = '${userInput}'`  // SQL 注入！
)

// ✅ 安全：使用参数
const users = await prisma.$queryRaw(
  Prisma.sql`SELECT * FROM users WHERE name = ${userInput}`
)
```

---

## 五、安全头部

### 5.1 设置安全头部

```tsx
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  }
]

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}
```

---

## 六、文件上传安全

### 6.1 验证文件类型

```tsx
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function uploadFile(formData: FormData) {
  const file = formData.get('file') as File

  // 验证类型
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: '不支持的文件类型' }
  }

  // 验证大小
  if (file.size > MAX_SIZE) {
    return { error: '文件太大' }
  }

  // 验证文件扩展名
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) {
    return { error: '不支持的文件扩展名' }
  }

  // 生成安全的文件名
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  // 保存文件
  // ...
}
```

---

## 七、环境变量安全

### 7.1 不要暴露敏感信息

```tsx
// ❌ 错误：在客户端代码中使用
const apiKey = process.env.API_KEY

// ✅ 正确：只在服务端使用
// 使用 NEXT_PUBLIC_ 前缀的变量才会暴露给客户端
const publicUrl = process.env.NEXT_PUBLIC_URL
```

### 7.2 环境变量分类

```
客户端可访问（NEXT_PUBLIC_ 前缀）：
  NEXT_PUBLIC_URL
  NEXT_PUBLIC_ANALYTICS_ID

仅服务端可访问：
  DATABASE_URL
  API_KEY
  SESSION_SECRET
```

---

## 八、动手练习

### 练习 1：实现输入验证

1. 为表单添加 Zod 验证
2. 清理用户输入
3. 测试各种恶意输入

### 练习 2：设置安全头部

1. 配置 CSP
2. 配置 HSTS
3. 测试安全头部是否生效

### 练习 3：安全文件上传

1. 验证文件类型
2. 验证文件大小
3. 生成安全的文件名

---

## 九、小结

```
本课核心要点：

1. XSS：注入恶意脚本，React 默认防护，使用 dangerouslySetInnerHTML 要小心
2. CSRF：诱导执行操作，Server Actions 自动防护，SameSite Cookie
3. 输入验证：使用 Zod，清理特殊字符
4. SQL 注入：Prisma 自动防护，使用参数化查询
5. 安全头部：CSP、HSTS、X-Frame-Options
```

下一课我们将学习无障碍和键盘操作。
