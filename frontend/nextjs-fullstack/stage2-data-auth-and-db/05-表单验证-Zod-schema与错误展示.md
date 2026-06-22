# 第五课：表单验证 — Zod schema 与错误展示

## 场景引入

你的注册表单上线后，数据库里开始出现各种脏数据：邮箱字段存了 `"abc"` 这种无效格式，名字字段是空字符串，密码只有 1 位。你检查发现，前端只加了 `required` 属性，用户用 Postman 直接调 API 就能绕过所有验证。更糟糕的是，当用户输入不合法时，页面没有给出任何错误提示，表单只是"什么都不发生"。你需要一套统一的验证方案：同一个 Schema 既能用在前端提供即时反馈，又能用在后端确保数据安全，而且错误信息要清晰地展示在对应的字段旁边。

## 学习目标

完成本课学习后，你将能够：

1. 理解为什么需要表单验证
2. 掌握 Zod 的基本用法
3. 在 Server Actions 中使用 Zod 验证
4. 在客户端展示验证错误
5. 实现服务端和客户端双重验证

---

## 一、为什么需要表单验证

### 1.1 两层验证

```
客户端验证（前端）
  → 提供即时反馈
  → 提升用户体验
  → 但可以被绕过

服务端验证（后端）
  → 确保数据安全
  → 防止恶意请求
  → 最终防线
```

### 1.2 不验证的后果

```
没有验证：

❌ 用户名为空 → 数据库错误
❌ 邮箱格式错误 → 无法发送邮件
❌ SQL 注入 → 数据库被攻击
❌ XSS 输入 → 其他用户被攻击
❌ 超长输入 → 内存溢出
```

---

## 二、Zod 基础

### 2.1 什么是 Zod

> **Zod 是一个 TypeScript 优先的 schema 验证库。** 它可以定义数据的形状，验证输入，并自动推断 TypeScript 类型。

```bash
npm install zod
```

### 2.2 基本类型

```tsx
import { z } from 'zod'

// 字符串
const nameSchema = z.string()
const emailSchema = z.string().email()
const passwordSchema = z.string().min(8)

// 数字
const ageSchema = z.number().min(0).max(150)
const priceSchema = z.number().positive()

// 布尔
const activeSchema = z.boolean()

// 日期
const dateSchema = z.date()
const dateStringSchema = z.string().datetime()
```

### 2.3 字符串验证

```tsx
z.string()
  .min(2, '至少 2 个字')
  .max(50, '最多 50 个字')

z.string()
  .email('邮箱格式不正确')

z.string()
  .url('URL 格式不正确')

z.string()
  .uuid('UUID 格式不正确')

z.string()
  .regex(/^[a-zA-Z]+$/, '只能包含字母')

z.string()
  .trim()           // 去除首尾空格
  .toLowerCase()    // 转小写
```

### 2.4 数字验证

```tsx
z.number()
  .int('必须是整数')
  .min(0, '不能小于 0')
  .max(100, '不能大于 100')

z.number()
  .positive('必须是正数')

z.number()
  .nonnegative('不能是负数')
```

### 2.5 可选和可空

```tsx
// 可选（undefined 或有值）
z.string().optional()

// 可空（null 或有值）
z.string().nullable()

// 可选且可空
z.string().nullish()

// 默认值
z.string().default('默认值')
```

---

## 三、对象 Schema

### 3.1 定义对象

```tsx
const UserSchema = z.object({
  name: z.string().min(2, '名字至少 2 个字'),
  email: z.string().email('邮箱格式不正确'),
  age: z.number().min(0).optional(),
})

// 推断类型
type User = z.infer<typeof UserSchema>
// { name: string; email: string; age?: number | undefined }
```

### 3.2 嵌套对象

```tsx
const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zip: z.string().regex(/^\d{6}$/, '邮编格式不正确'),
})

const UserSchema = z.object({
  name: z.string(),
  address: AddressSchema,
})
```

### 3.3 数组

```tsx
const TagsSchema = z.array(z.string().min(1))

const UserSchema = z.object({
  name: z.string(),
  tags: z.array(z.string()).min(1, '至少选择一个标签'),
})
```

---

## 四、在 Server Actions 中验证

### 4.1 基本用法

```tsx
'use server'

import { z } from 'zod'

const CreatePostSchema = z.object({
  title: z.string().min(2, '标题至少 2 个字').max(100),
  content: z.string().min(10, '内容至少 10 个字'),
  status: z.enum(['draft', 'published']),
})

export async function createPost(prevState: any, formData: FormData) {
  // 使用 safeParse（不会抛出错误）
  const validatedFields = CreatePostSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    status: formData.get('status'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  // validatedFields.data 是验证后的数据，类型安全
  const { title, content, status } = validatedFields.data

  await db.post.create({
    data: { title, content, status }
  })

  return { success: true }
}
```

### 4.2 flatten().fieldErrors 的结构

```tsx
// 验证失败时返回的结构
{
  errors: {
    title: ['标题至少 2 个字'],
    content: ['内容至少 10 个字'],
    status: undefined  // 没有错误的字段是 undefined
  }
}
```

### 4.3 在表单中显示错误

```tsx
'use client'

import { useActionState } from 'react'

export function CreatePostForm() {
  const [state, formAction, isPending] = useActionState(createPost, null)

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="title">标题</label>
        <input
          id="title"
          name="title"
          aria-describedby="title-error"
        />
        {state?.errors?.title && (
          <p id="title-error" className="text-red-500 text-sm">
            {state.errors.title[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="content">内容</label>
        <textarea
          id="content"
          name="content"
          aria-describedby="content-error"
        />
        {state?.errors?.content && (
          <p id="content-error" className="text-red-500 text-sm">
            {state.errors.content[0]}
          </p>
        )}
      </div>

      <button type="submit" disabled={isPending}>
        {isPending ? '创建中...' : '创建'}
      </button>
    </form>
  )
}
```

---

## 五、可复用的表单组件

### 5.1 表单字段包装

```tsx
// components/FormField.tsx
interface FormFieldProps {
  label: string
  name: string
  errors?: string[]
  children: React.ReactNode
}

export function FormField({ label, name, errors, children }: FormFieldProps) {
  const errorId = `${name}-error`

  return (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium mb-1">
        {label}
      </label>
      {children}
      {errors && errors.length > 0 && (
        <p id={errorId} className="text-red-500 text-sm mt-1">
          {errors[0]}
        </p>
      )}
    </div>
  )
}
```

### 5.2 使用

```tsx
<FormField label="标题" name="title" errors={state?.errors?.title}>
  <input
    id="title"
    name="title"
    className="w-full px-3 py-2 border rounded"
  />
</FormField>

<FormField label="内容" name="content" errors={state?.errors?.content}>
  <textarea
    id="content"
    name="content"
    rows={6}
    className="w-full px-3 py-2 border rounded"
  />
</FormField>
```

---

## 六、客户端验证

### 6.1 使用 React Hook Form + Zod

```bash
npm install react-hook-form @hookform/resolvers
```

```tsx
// components/PostForm.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const PostSchema = z.object({
  title: z.string().min(2, '标题至少 2 个字'),
  content: z.string().min(10, '内容至少 10 个字'),
})

type PostFormData = z.infer<typeof PostSchema>

export function PostForm({ onSubmit }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<PostFormData>({
    resolver: zodResolver(PostSchema),
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="title">标题</label>
        <input
          id="title"
          {...register('title')}
        />
        {errors.title && (
          <p className="text-red-500 text-sm">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="content">内容</label>
        <textarea
          id="content"
          {...register('content')}
        />
        {errors.content && (
          <p className="text-red-500 text-sm">{errors.content.message}</p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '提交中...' : '提交'}
      </button>
    </form>
  )
}
```

### 6.2 客户端 + 服务端双重验证

```tsx
// 使用同一个 Schema
const PostSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(10),
})

// 服务端 Action
'use server'
export async function createPost(data: unknown) {
  const validated = PostSchema.safeParse(data)
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }
  // ...
}

// 客户端表单
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createPost } from './actions'

export function PostForm() {
  const form = useForm({
    resolver: zodResolver(PostSchema),
  })

  async function onSubmit(data) {
    const result = await createPost(data)
    if (result?.errors) {
      // 处理服务端错误
      Object.entries(result.errors).forEach(([field, messages]) => {
        form.setError(field as any, {
          message: messages[0]
        })
      })
    }
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>
}
```

---

## 七、自定义验证

### 7.1 自定义验证规则

```tsx
const RegisterSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: '两次密码不一致',
  path: ['confirmPassword'], // 错误显示在哪个字段
})
```

### 7.2 异步验证

```tsx
const RegisterSchema = z.object({
  email: z.string().email(),
}).refine(
  async (data) => {
    // 异步检查邮箱是否已注册
    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    })
    return !existing
  },
  {
    message: '该邮箱已注册',
    path: ['email'],
  }
)
```

---

## 八、完整的注册表单示例

```tsx
// lib/schemas.ts
import { z } from 'zod'

export const RegisterSchema = z.object({
  name: z.string()
    .min(2, '名字至少 2 个字')
    .max(50, '名字最多 50 个字'),
  email: z.string()
    .email('邮箱格式不正确')
    .transform(v => v.toLowerCase()),
  password: z.string()
    .min(8, '密码至少 8 位')
    .regex(/[A-Z]/, '密码必须包含大写字母')
    .regex(/[0-9]/, '密码必须包含数字'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: '两次密码不一致',
  path: ['confirmPassword'],
})

export type RegisterFormData = z.infer<typeof RegisterSchema>
```

```tsx
// app/register/actions.ts
'use server'

import { RegisterSchema } from '@/lib/schemas'
import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function register(prevState: any, formData: FormData) {
  const validatedFields = RegisterSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  const { name, email, password } = validatedFields.data

  const existingUser = await prisma.user.findUnique({
    where: { email }
  })

  if (existingUser) {
    return {
      errors: { email: ['该邮箱已注册'] }
    }
  }

  const hashedPassword = await hashPassword(password)

  await prisma.user.create({
    data: { name, email, password: hashedPassword }
  })

  return { success: true }
}
```

```tsx
// app/register/RegisterForm.tsx
'use client'

import { useActionState } from 'react'
import { register } from './actions'
import { FormField } from '@/components/FormField'

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(register, null)

  if (state?.success) {
    return (
      <div className="text-center p-4">
        <h2 className="text-xl font-bold text-green-600 mb-2">注册成功！</h2>
        <a href="/login" className="text-blue-500">去登录</a>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormField label="名字" name="name" errors={state?.errors?.name}>
        <input
          id="name"
          name="name"
          required
          className="w-full px-3 py-2 border rounded"
        />
      </FormField>

      <FormField label="邮箱" name="email" errors={state?.errors?.email}>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full px-3 py-2 border rounded"
        />
      </FormField>

      <FormField label="密码" name="password" errors={state?.errors?.password}>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full px-3 py-2 border rounded"
        />
      </FormField>

      <FormField
        label="确认密码"
        name="confirmPassword"
        errors={state?.errors?.confirmPassword}
      >
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          className="w-full px-3 py-2 border rounded"
        />
      </FormField>

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

## 九、动手练习

### 练习 1：创建通用验证 Schema

为常见场景创建可复用的 Schema：

```tsx
// lib/schemas.ts
export const EmailSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
})

export const PasswordSchema = z.object({
  password: z.string()
    .min(8, '密码至少 8 位')
    .max(100, '密码太长'),
})

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
```

### 练习 2：实现项目创建表单

创建一个带完整验证的项目创建表单：

```tsx
const CreateProjectSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(500).optional(),
  teamId: z.string().uuid(),
  visibility: z.enum(['public', 'private']),
  tags: z.array(z.string()).min(1, '至少选择一个标签'),
})
```

### 练习 3：实现搜索表单

创建一个带验证的搜索表单：

```tsx
const SearchSchema = z.object({
  query: z.string().min(1, '请输入搜索关键词').max(100),
  category: z.string().optional(),
  sortBy: z.enum(['relevance', 'date', 'name']).default('relevance'),
  page: z.coerce.number().int().positive().default(1),
})
```

---

## 参考答案

### 练习一：创建通用验证 Schema

**思路**：通用 Schema 的关键是覆盖常见验证场景，同时保持复用性。邮箱、密码、分页参数是几乎所有表单都会用到的基础验证，应该抽成独立的 Schema，通过 `merge` 或 `extend` 组合使用。

**答案**：

```tsx
// lib/schemas.ts
import { z } from 'zod'

export const EmailSchema = z.object({
  email: z.string().email('邮箱格式不正确').transform(v => v.toLowerCase()),
})

export const PasswordSchema = z.object({
  password: z.string()
    .min(8, '密码至少 8 位')
    .max(100, '密码不能超过 100 位')
    .regex(/[A-Z]/, '密码必须包含大写字母')
    .regex(/[0-9]/, '密码必须包含数字'),
})

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const NameSchema = z.object({
  name: z.string()
    .min(2, '名字至少 2 个字')
    .max(50, '名字最多 50 个字')
    .trim(),
})

// 组合使用示例
export const LoginSchema = EmailSchema.extend({
  password: z.string().min(1, '请输入密码'),
})

export const ForgotPasswordSchema = EmailSchema

export const ResetPasswordSchema = PasswordSchema.extend({
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: '两次密码不一致',
  path: ['confirmPassword'],
})
```

**要点**：
- `z.coerce.number()` 自动把 URL 字符串参数转为数字，避免手动 `parseInt`
- `.transform(v => v.toLowerCase())` 在验证通过后自动转小写，确保存入数据库的邮箱格式统一
- 用 `.extend()` 组合基础 Schema，避免重复定义相同字段
- 密码验证用 `.regex()` 叠加多条规则，每条规则有独立的错误提示

### 练习二：实现项目创建表单

**思路**：项目创建涉及多个字段类型（字符串、枚举、数组），需要同时处理客户端即时验证和服务端安全验证。使用 `useActionState` + Zod 的 `safeParse` 模式，在服务端返回 `flatten().fieldErrors`，客户端用 `FormField` 组件展示错误。

**答案**：

```tsx
// lib/schemas/project.ts
import { z } from 'zod'

export const CreateProjectSchema = z.object({
  name: z.string()
    .min(2, '项目名称至少 2 个字')
    .max(50, '项目名称最多 50 个字')
    .trim(),
  description: z.string()
    .max(500, '描述最多 500 个字')
    .optional()
    .transform(v => v || undefined),
  teamId: z.string().uuid('团队 ID 格式不正确'),
  visibility: z.enum(['public', 'private'], {
    errorMap: () => ({ message: '请选择可见性' }),
  }),
  tags: z.array(z.string().min(1))
    .min(1, '至少选择一个标签')
    .max(10, '最多选择 10 个标签'),
})

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>
```

```tsx
// app/projects/actions.ts
'use server'

import { CreateProjectSchema } from '@/lib/schemas/project'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createProject(prevState: any, formData: FormData) {
  const user = await requireAuth()

  const tagsRaw = formData.get('tags')
  const tags = typeof tagsRaw === 'string' ? tagsRaw.split(',').map(t => t.trim()) : []

  const validated = CreateProjectSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    teamId: formData.get('teamId'),
    visibility: formData.get('visibility'),
    tags,
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { name, description, teamId, visibility, tags: validatedTags } = validated.data

  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: { userId: user.id, teamId }
    }
  })

  if (!membership) {
    return { errors: { teamId: ['你不是该团队的成员'] } }
  }

  await prisma.project.create({
    data: {
      name,
      description,
      teamId,
      visibility,
      tags: validatedTags,
      creatorId: user.id,
    }
  })

  revalidatePath('/projects')
  return { success: true }
}
```

```tsx
// app/projects/create/CreateProjectForm.tsx
'use client'

import { useActionState } from 'react'
import { createProject } from '../actions'
import { FormField } from '@/components/FormField'

export function CreateProjectForm({ teamId }: { teamId: string }) {
  const [state, formAction, isPending] = useActionState(createProject, null)

  if (state?.success) {
    return <p className="text-green-600">项目创建成功！</p>
  }

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      <input type="hidden" name="teamId" value={teamId} />

      <FormField label="项目名称" name="name" errors={state?.errors?.name}>
        <input
          id="name"
          name="name"
          required
          className="w-full px-3 py-2 border rounded"
        />
      </FormField>

      <FormField label="项目描述" name="description" errors={state?.errors?.description}>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="w-full px-3 py-2 border rounded"
        />
      </FormField>

      <FormField label="可见性" name="visibility" errors={state?.errors?.visibility}>
        <select id="visibility" name="visibility" className="w-full px-3 py-2 border rounded">
          <option value="">请选择</option>
          <option value="public">公开</option>
          <option value="private">私有</option>
        </select>
      </FormField>

      <FormField label="标签" name="tags" errors={state?.errors?.tags}>
        <input
          id="tags"
          name="tags"
          placeholder="用逗号分隔，如：前端,React,TypeScript"
          className="w-full px-3 py-2 border rounded"
        />
      </FormField>

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {isPending ? '创建中...' : '创建项目'}
      </button>
    </form>
  )
}
```

**要点**：
- 数组类型的字段（`tags`）在 FormData 中以逗号分隔的字符串传递，需要在 Action 中手动 split
- `z.enum` 的第二个参数 `errorMap` 可以自定义枚举校验的错误提示
- 隐藏字段 `teamId` 通过 props 传入，不暴露给用户修改
- 服务端查询用户是否属于该团队，防止越权创建项目

### 练习三：实现搜索表单

**思路**：搜索表单需要和 URL 参数联动，使用 `useSearchParams` 读取当前参数、`useRouter` 更新 URL。Zod Schema 负责参数类型转换和默认值，确保传给服务端的参数类型正确。

**答案**：

```tsx
// lib/schemas/search.ts
import { z } from 'zod'

export const SearchSchema = z.object({
  query: z.string()
    .min(1, '请输入搜索关键词')
    .max(100, '搜索关键词不能超过 100 个字')
    .trim(),
  category: z.string().optional().default(''),
  sortBy: z.enum(['relevance', 'date', 'name']).default('relevance'),
  page: z.coerce.number().int().positive().default(1),
})

export type SearchParams = z.infer<typeof SearchSchema>
```

```tsx
// components/SearchForm.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export function SearchForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('query') || '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmed = query.trim()
    if (trimmed.length === 0) {
      setError('请输入搜索关键词')
      return
    }
    if (trimmed.length > 100) {
      setError('搜索关键词不能超过 100 个字')
      return
    }

    setError(null)
    const params = new URLSearchParams(searchParams.toString())
    params.set('query', trimmed)
    params.delete('page')
    router.push(`/search?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="搜索项目、任务、成员..."
          className="flex-1 px-4 py-2 border rounded"
        />
        <select
          defaultValue={searchParams.get('category') || ''}
          onChange={e => {
            const params = new URLSearchParams(searchParams.toString())
            if (e.target.value) {
              params.set('category', e.target.value)
            } else {
              params.delete('category')
            }
            params.delete('page')
            router.push(`/search?${params.toString()}`)
          }}
          className="px-3 py-2 border rounded"
        >
          <option value="">全部分类</option>
          <option value="projects">项目</option>
          <option value="tasks">任务</option>
          <option value="members">成员</option>
        </select>
        <select
          defaultValue={searchParams.get('sortBy') || 'relevance'}
          onChange={e => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('sortBy', e.target.value)
            router.push(`/search?${params.toString()}`)
          }}
          className="px-3 py-2 border rounded"
        >
          <option value="relevance">相关度</option>
          <option value="date">日期</option>
          <option value="name">名称</option>
        </select>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-500 text-white rounded"
        >
          搜索
        </button>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </form>
  )
}
```

```tsx
// app/search/page.tsx
import { prisma } from '@/lib/prisma'
import { SearchSchema } from '@/lib/schemas/search'
import { SearchForm } from '@/components/SearchForm'
import { Pagination } from '@/components/Pagination'

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const rawParams = await searchParams
  const validated = SearchSchema.safeParse({
    query: rawParams.query,
    category: rawParams.category,
    sortBy: rawParams.sortBy,
    page: rawParams.page,
  })

  if (!validated.success) {
    return (
      <div>
        <SearchForm />
        <p className="text-gray-500 mt-8">请输入有效的搜索关键词</p>
      </div>
    )
  }

  const { query, category, sortBy, page } = validated.data
  const pageSize = 20
  const skip = (page - 1) * pageSize

  const orderBy = (() => {
    switch (sortBy) {
      case 'date': return { createdAt: 'desc' as const }
      case 'name': return { name: 'asc' as const }
      default: return { _relevance: { fields: ['name'], search: query, sort: 'desc' as const } }
    }
  })()

  const where = {
    AND: [
      {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { description: { contains: query, mode: 'insensitive' as const } },
        ]
      },
      category ? { category } : {},
    ]
  }

  const [results, totalCount] = await Promise.all([
    prisma.project.findMany({ where, orderBy, skip, take: pageSize }),
    prisma.project.count({ where }),
  ])

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div>
      <SearchForm />
      <p className="text-sm text-gray-500 mt-4">共 {totalCount} 条结果</p>
      <ul className="mt-4 space-y-2">
        {results.map(item => (
          <li key={item.id} className="p-4 bg-white border rounded">
            <h3 className="font-medium">{item.name}</h3>
            <p className="text-gray-500 text-sm">{item.description}</p>
          </li>
        ))}
      </ul>
      <Pagination totalPages={totalPages} currentPage={page} />
    </div>
  )
}
```

**要点**：
- 搜索时必须重置 `page` 参数，否则用户在第 5 页搜索新关键词可能看到空结果
- 客户端做基本的空值和长度校验（即时反馈），服务端用 Zod 做完整的类型验证（安全防线）
- `sortBy` 使用枚举约束，防止用户传入非法排序字段
- 服务端 `SearchSchema.safeParse` 处理 URL 参数的类型转换（`z.coerce.number` 把字符串转数字）

---

## 常见误区

1. **"前端验证够了，后端不需要再验证"**：前端验证可以被绕过（禁用 JS、用 Postman 直接调用）。服务端必须独立验证所有输入，不能信任前端传来的数据。
2. **"用 if/else 手写验证就行"**：手写验证逻辑散落在各处，容易遗漏字段，也难以复用。Zod 可以在一个地方定义完整的验证规则，自动生成 TypeScript 类型，前端和后端共用。
3. **"错误信息直接返回英文"**：Zod 默认的错误信息是英文的（如 "Expected string, received number"），需要通过 `.min(2, '至少 2 个字')` 自定义中文提示，否则用户体验很差。
4. **"safeParse 和 parse 效果一样"**：`parse` 验证失败会抛出异常，`safeParse` 返回 `{ success, data/error }` 对象。在 Server Action 中应该用 `safeParse`，避免异常导致整个 action 崩溃。

## 工程建议

1. **把 Schema 定义在 `lib/schemas.ts` 中集中管理**：不要在每个 Server Action 中重复定义验证规则。集中的 Schema 文件方便维护和复用。
2. **用 `flatten().fieldErrors` 展示字段级错误**：Zod 的 `error.flatten().fieldErrors` 返回 `{ fieldName: ['错误信息'] }` 结构，可以直接在表单中用 `state?.errors?.fieldName?.[0]` 展示。
3. **客户端和服务端共用同一个 Schema**：React Hook Form + `zodResolver` 可以在客户端使用同一个 Zod Schema 做即时验证，确保前后端验证规则一致。
4. **用 `z.coerce` 处理 URL 参数类型转换**：URL 参数都是字符串，`z.coerce.number()` 可以自动把字符串转为数字，避免 `parseInt` 的重复代码。

## 十、小结

```
本课核心要点：

1. 两层验证：客户端提供即时反馈，服务端确保安全
2. Zod 是 TypeScript 优先的验证库，类型推断强大
3. safeParse 不会抛出错误，返回 success/errors
4. flatten().fieldErrors 便于在表单中展示错误
5. 客户端和后端共用同一个 Schema 确保一致性
6. 自定义验证用 refine，异步验证用 refine + async
```

下一课我们将学习文件上传与对象存储。
