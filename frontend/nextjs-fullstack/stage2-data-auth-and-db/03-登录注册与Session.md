# 第三课：登录注册与 Session

## 场景引入

你的团队协作工具已经可以创建团队和项目了，但任何人都能访问所有数据——没有登录，没有权限，没有身份。你需要实现一套完整的认证系统：用户注册时安全地存储密码、登录后保持会话状态、未登录用户不能访问 Dashboard、已登录用户不能重复访问登录页。你考虑过用 JWT，但发现无状态方案无法主动让用户的 session 失效（比如修改密码后踢掉旧设备）。你需要一套简单、安全、可控的认证方案。

## 学习目标

完成本课学习后，你将能够：

1. 理解 Web 认证的基本概念
2. 掌握密码哈希和安全存储
3. 实现基于 Cookie 的 Session 管理
4. 创建登录、注册和登出功能
5. 理解中间件在认证中的作用

---

## 一、认证基础

### 1.1 认证 vs 授权

```
认证（Authentication）= 你是谁？
  → 验证用户身份
  → 登录、注册

授权（Authorization）= 你能做什么？
  → 验证用户权限
  → 你能不能访问这个页面？能不能删除这篇文章？
```

### 1.2 常见认证方式

```
方式                  优点                    缺点
──────────────────────────────────────────────────────
Session + Cookie     简单、安全               需要服务端存储
JWT Token            无状态、可扩展           无法主动失效
OAuth                第三方登录               依赖第三方服务
```

---

## 二、密码安全

### 2.1 为什么不能存明文密码

```
❌ 错误做法：
数据库存储：password = "123456"
如果数据库泄露，所有用户密码都暴露了

✅ 正确做法：
数据库存储：password = "$2b$10$xxxxxxx..."
即使数据库泄露，攻击者也无法还原密码
```

### 2.2 使用 bcrypt 哈希密码

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

```tsx
// lib/auth.ts
import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  // 生成 salt，10 轮加密
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}
```

### 2.3 哈希原理

```
原始密码     →  哈希函数  →  哈希值
"123456"     →  bcrypt    →  "$2b$10$xxxxxxx..."

特点：
1. 单向：无法从哈希值还原密码
2. 雪崩：输入稍有变化，输出完全不同
3. 盐值：相同密码，不同盐值，结果不同
```

---

## 三、Session 管理

### 3.1 Session 的工作原理

```
1. 用户提交登录表单
2. 服务器验证用户名密码
3. 服务器创建 Session（存储用户信息）
4. 服务器把 Session ID 写入 Cookie
5. 后续请求自动携带 Cookie
6. 服务器通过 Session ID 查找用户信息
```

### 3.2 使用 iron-session

```bash
npm install iron-session
```

```tsx
// lib/session.ts
import { SessionOptions, getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionData {
  userId?: string
  isLoggedIn: boolean
}

export const defaultSession: SessionData = {
  isLoggedIn: false,
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'my-app-session',
  cookieOptions: {
    httpOnly: true,     // JavaScript 无法访问
    secure: process.env.NODE_ENV === 'production', // HTTPS only
    sameSite: 'lax',    // CSRF 防护
    maxAge: 60 * 60 * 24 * 7, // 7 天
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions
  )

  if (!session.isLoggedIn) {
    session.isLoggedIn = defaultSession.isLoggedIn
  }

  return session
}
```

---

## 四、实现注册

### 4.1 注册 Server Action

```tsx
// app/(auth)/actions.ts
'use server'

import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const RegisterSchema = z.object({
  name: z.string().min(2, '名字至少 2 个字'),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位'),
})

export async function register(prevState: any, formData: FormData) {
  // 1. 验证输入
  const validatedFields = RegisterSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  const { name, email, password } = validatedFields.data

  // 2. 检查邮箱是否已注册
  const existingUser = await prisma.user.findUnique({
    where: { email }
  })

  if (existingUser) {
    return { error: '该邮箱已注册' }
  }

  // 3. 哈希密码
  const hashedPassword = await hashPassword(password)

  // 4. 创建用户
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    }
  })

  // 5. 创建 Session
  const session = await getSession()
  session.userId = user.id
  session.isLoggedIn = true
  await session.save()

  // 6. 重定向到 Dashboard
  redirect('/dashboard')
}
```

### 4.2 注册表单

```tsx
// app/(auth)/register/page.tsx
import { RegisterForm } from './RegisterForm'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6">注册</h1>
        <RegisterForm />
      </div>
    </div>
  )
}
```

```tsx
// app/(auth)/register/RegisterForm.tsx
'use client'

import { useActionState } from 'react'
import { register } from '../actions'

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(register, null)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          名字
        </label>
        <input
          id="name"
          name="name"
          required
          className="w-full px-3 py-2 border rounded"
        />
        {state?.errors?.name && (
          <p className="text-red-500 text-sm mt-1">{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          邮箱
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full px-3 py-2 border rounded"
        />
        {state?.errors?.email && (
          <p className="text-red-500 text-sm mt-1">{state.errors.email[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full px-3 py-2 border rounded"
        />
        {state?.errors?.password && (
          <p className="text-red-500 text-sm mt-1">{state.errors.password[0]}</p>
        )}
      </div>

      {state?.error && (
        <p className="text-red-500">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {isPending ? '注册中...' : '注册'}
      </button>
    </form>
  )
}
```

---

## 五、实现登录

### 5.1 登录 Server Action

```tsx
// app/(auth)/actions.ts
const LoginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
})

export async function login(prevState: any, formData: FormData) {
  // 1. 验证输入
  const validatedFields = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  const { email, password } = validatedFields.data

  // 2. 查找用户
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    return { error: '邮箱或密码不正确' }
  }

  // 3. 验证密码
  const isValid = await verifyPassword(password, user.password)

  if (!isValid) {
    return { error: '邮箱或密码不正确' }
  }

  // 4. 创建 Session
  const session = await getSession()
  session.userId = user.id
  session.isLoggedIn = true
  await session.save()

  // 5. 重定向
  redirect('/dashboard')
}
```

### 5.2 登出

```tsx
// app/(auth)/actions.ts
export async function logout() {
  const session = await getSession()
  session.destroy()
  redirect('/login')
}
```

---

## 六、保护路由

### 6.1 获取当前用户

```tsx
// lib/auth.ts
import { prisma } from './prisma'
import { getSession } from './session'

export async function getCurrentUser() {
  const session = await getSession()

  if (!session.userId) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
    }
  })

  return user
}

export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return user
}
```

### 6.2 在页面中使用

```tsx
// app/(dashboard)/layout.tsx
import { requireAuth } from '@/lib/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  return (
    <div>
      <header>
        <span>欢迎，{user.name}</span>
        <form action={logout}>
          <button type="submit">登出</button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  )
}
```

---

## 七、中间件保护

### 7.1 使用中间件统一保护路由

```tsx
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const session = await getIronSession<SessionData>(
    request,
    NextResponse.next(),
    sessionOptions
  )

  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/register')

  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')

  // 未登录用户不能访问 Dashboard
  if (isDashboard && !session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 已登录用户不能访问登录页
  if (isAuthPage && session.isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
}
```

---

## 八、密码重置（扩展）

### 8.1 生成重置令牌

```tsx
import crypto from 'crypto'

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function createPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    // 不暴露用户是否存在
    return
  }

  const token = generateResetToken()
  const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 小时

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      token,
      expires,
    }
  })

  // 发送邮件（这里只是示例）
  await sendEmail(user.email, {
    subject: '重置密码',
    body: `点击链接重置密码: ${process.env.NEXT_PUBLIC_URL}/reset-password?token=${token}`
  })
}
```

---

## 九、动手练习

### 练习 1：实现完整的注册登录流程

1. 创建注册页面
2. 创建登录页面
3. 实现登出功能
4. 测试完整的用户流程

### 练习 2：添加表单验证

使用 Zod 添加更完善的验证：

```tsx
const RegisterSchema = z.object({
  name: z.string()
    .min(2, '名字至少 2 个字')
    .max(50, '名字最多 50 个字'),
  email: z.string()
    .email('邮箱格式不正确')
    .toLowerCase(),
  password: z.string()
    .min(8, '密码至少 8 位')
    .regex(/[A-Z]/, '密码必须包含大写字母')
    .regex(/[0-9]/, '密码必须包含数字'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: '两次密码不一致',
  path: ['confirmPassword'],
})
```

### 练习 3：实现中间件保护

1. 创建 middleware.ts
2. 保护 /dashboard 路由
3. 测试未登录访问时的重定向

---

## 参考答案

### 练习 1：实现完整的注册登录流程

**思路**：注册和登录都需要 Server Action 来处理表单提交。注册流程：验证输入 → 检查邮箱唯一性 → 哈希密码 → 创建用户 → 创建 Session → 重定向。登录流程：验证输入 → 查找用户 → 验证密码 → 创建 Session → 重定向。

**答案**：

```tsx
// lib/session.ts
import { SessionOptions, getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionData {
  userId?: string
  isLoggedIn: boolean
}

export const defaultSession: SessionData = {
  isLoggedIn: false,
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'my-app-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)

  if (!session.isLoggedIn) {
    session.isLoggedIn = defaultSession.isLoggedIn
  }

  return session
}
```

```tsx
// app/(auth)/actions.ts
'use server'

import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const RegisterSchema = z.object({
  name: z.string().min(2, '名字至少 2 个字'),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位'),
})

const LoginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
})

export async function register(prevState: any, formData: FormData) {
  const validatedFields = RegisterSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors }
  }

  const { name, email, password } = validatedFields.data

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return { error: '该邮箱已注册' }
  }

  const hashedPassword = await hashPassword(password)

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
  })

  const session = await getSession()
  session.userId = user.id
  session.isLoggedIn = true
  await session.save()

  redirect('/dashboard')
}

export async function login(prevState: any, formData: FormData) {
  const validatedFields = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors }
  }

  const { email, password } = validatedFields.data

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return { error: '邮箱或密码不正确' }
  }

  const isValid = await verifyPassword(password, user.password)
  if (!isValid) {
    return { error: '邮箱或密码不正确' }
  }

  const session = await getSession()
  session.userId = user.id
  session.isLoggedIn = true
  await session.save()

  redirect('/dashboard')
}

export async function logout() {
  const session = await getSession()
  session.destroy()
  redirect('/login')
}
```

```tsx
// app/(auth)/login/page.tsx
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6">登录</h1>
        <LoginForm />
      </div>
    </div>
  )
}
```

```tsx
// app/(auth)/login/LoginForm.tsx
'use client'

import { useActionState } from 'react'
import { login } from '../actions'

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, null)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">邮箱</label>
        <input id="email" name="email" type="email" required className="w-full px-3 py-2 border rounded" />
        {state?.errors?.email && (
          <p className="text-red-500 text-sm mt-1">{state.errors.email[0]}</p>
        )}
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">密码</label>
        <input id="password" name="password" type="password" required className="w-full px-3 py-2 border rounded" />
        {state?.errors?.password && (
          <p className="text-red-500 text-sm mt-1">{state.errors.password[0]}</p>
        )}
      </div>
      {state?.error && <p className="text-red-500">{state.error}</p>}
      <button type="submit" disabled={isPending} className="w-full py-2 bg-blue-500 text-white rounded disabled:opacity-50">
        {isPending ? '登录中...' : '登录'}
      </button>
      <p className="text-center text-sm text-gray-500">
        还没有账号？<a href="/register" className="text-blue-500">注册</a>
      </p>
    </form>
  )
}
```

**要点**：
- 登录失败的提示统一返回"邮箱或密码不正确"，不区分邮箱不存在还是密码错误
- `useActionState` 替代了旧版的 `useFormState`，第一个参数是 Server Action
- 注册成功后自动登录（创建 Session），用户体验更好

### 练习 2：添加表单验证

**思路**：使用 Zod 的 `refine` 方法实现跨字段验证（如确认密码）。密码策略通过 `regex` 强制要求包含大写字母和数字。

**答案**：

```tsx
// app/(auth)/actions.ts 中的 RegisterSchema
import { z } from 'zod'

const RegisterSchema = z.object({
  name: z.string()
    .min(2, '名字至少 2 个字')
    .max(50, '名字最多 50 个字'),
  email: z.string()
    .email('邮箱格式不正确')
    .transform((val) => val.toLowerCase()),
  password: z.string()
    .min(8, '密码至少 8 位')
    .regex(/[A-Z]/, '密码必须包含大写字母')
    .regex(/[0-9]/, '密码必须包含数字'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次密码不一致',
  path: ['confirmPassword'],
})
```

在注册表单中添加确认密码字段：

```tsx
// app/(auth)/register/RegisterForm.tsx
'use client'

import { useActionState } from 'react'
import { register } from '../actions'

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(register, null)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">名字</label>
        <input id="name" name="name" required className="w-full px-3 py-2 border rounded" />
        {state?.errors?.name && <p className="text-red-500 text-sm mt-1">{state.errors.name[0]}</p>}
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">邮箱</label>
        <input id="email" name="email" type="email" required className="w-full px-3 py-2 border rounded" />
        {state?.errors?.email && <p className="text-red-500 text-sm mt-1">{state.errors.email[0]}</p>}
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">密码</label>
        <input id="password" name="password" type="password" required className="w-full px-3 py-2 border rounded" />
        {state?.errors?.password && <p className="text-red-500 text-sm mt-1">{state.errors.password[0]}</p>}
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">确认密码</label>
        <input id="confirmPassword" name="confirmPassword" type="password" required className="w-full px-3 py-2 border rounded" />
        {state?.errors?.confirmPassword && <p className="text-red-500 text-sm mt-1">{state.errors.confirmPassword[0]}</p>}
      </div>
      {state?.error && <p className="text-red-500">{state.error}</p>}
      <button type="submit" disabled={isPending} className="w-full py-2 bg-blue-500 text-white rounded disabled:opacity-50">
        {isPending ? '注册中...' : '注册'}
      </button>
    </form>
  )
}
```

**要点**：
- `refine` 用于跨字段验证，必须放在 `z.object` 之后
- `path: ['confirmPassword']` 指定错误信息关联到确认密码字段
- `.transform(val => val.toLowerCase())` 在验证通过后自动转换邮箱为小写
- 密码策略应该在服务端强制执行，前端的 `required` 和 `minLength` 只是体验优化

### 练习 3：实现中间件保护

**思路**：使用 `middleware.ts` 拦截请求，通过 `iron-session` 读取 Session 判断登录状态。未登录用户访问 Dashboard 时重定向到登录页，已登录用户访问登录页时重定向到 Dashboard。

**答案**：

```tsx
// middleware.ts（项目根目录）
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, sessionOptions)

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isDashboard = pathname.startsWith('/dashboard')

  if (isDashboard && !session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthPage && session.isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
}
```

测试方法：

1. 启动开发服务器 `npm run dev`
2. 直接访问 `http://localhost:3000/dashboard`，应被重定向到 `/login`
3. 注册或登录后访问 `/login`，应被重定向到 `/dashboard`

**要点**：
- 中间件中创建的 `response` 对象需要传给 `getIronSession`，这样才能正确设置 Cookie
- `matcher` 配置限定中间件只在特定路径生效，避免影响静态资源和其他 API 路由
- 中间件运行在 Edge Runtime，不能使用 Node.js 特有的 API（如 `fs`、`crypto`）

---

## 常见误区

1. **"密码加密后存储就行"**：加密（encryption）是可逆的，解密后就能还原密码。正确做法是用 bcrypt 哈希（hashing），它是单向的，即使数据库泄露也无法还原原始密码。
2. **"Session Secret 可以硬编码在代码里"**：`SESSION_SECRET` 必须通过环境变量配置，不能写在代码中。硬编码的 secret 一旦被泄露（比如提交到 Git），所有用户的 session 都可以被伪造。
3. **"前端判断用户是否登录就够了"**：前端的登录状态可以被篡改（修改 localStorage、伪造 Cookie）。所有涉及权限的操作必须在服务端验证 session，前端只做 UI 展示。
4. **"登录失败的提示应该写'邮箱不存在'"**：这会泄露用户是否注册过的信息。安全的做法是统一返回"邮箱或密码不正确"，不区分具体原因。

## 工程建议

1. **用 `iron-session` 而不是自己实现 Session**：`iron-session` 基于加密的 Cookie，数据存在客户端但无法篡改。比自己实现 Cookie 签名和验证更安全。
2. **中间件统一保护路由**：用 `middleware.ts` 拦截所有 `/dashboard` 路径的请求，未登录时重定向到登录页。不要在每个页面组件里重复检查登录状态。
3. **密码策略要强制执行**：最少 8 位、包含大写字母和数字——用 Zod schema 在服务端验证，不要只依赖前端的 `required` 属性。
4. **登录成功后重定向到用户原来要去的页面**：用 `?redirect=/dashboard/projects` 参数保存目标地址，登录成功后跳转到该地址，而不是总是跳到首页。

## 十、小结

```
本课核心要点：

1. 密码必须哈希存储，使用 bcrypt
2. Session + Cookie 是最简单的认证方式
3. iron-session 提供安全的 Session 管理
4. 注册流程：验证 → 检查邮箱 → 哈希密码 → 创建用户 → 创建 Session
5. 登录流程：验证 → 查找用户 → 验证密码 → 创建 Session
6. 使用中间件统一保护路由
```

下一课我们将学习权限模型：如何实现 owner、admin、member 角色。
