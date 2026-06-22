# 第五课：Server Actions 与表单提交

## 场景引入

你在做一个博客平台的文章创建功能。传统的做法是：前端收集表单数据，调用 `fetch('/api/posts', { method: 'POST' })`，后端再处理。你需要写 API Route、构造请求对象、处理 CORS、解析响应、管理 loading 状态……一个简单的创建文章功能，代码分散在三个文件里。更烦人的是，每次提交后你还得手动调用 `router.refresh()` 来刷新列表，否则新文章不会出现在页面上。你开始想：有没有一种方式，让表单提交像调用本地函数一样简单？

## 学习目标

完成本课学习后，你将能够：

1. 理解 Server Actions 的概念和用途
2. 掌握表单提交的标准写法
3. 学会使用 `useFormStatus` 和 `useActionState` 处理表单状态
4. 理解乐观更新（Optimistic UI）的实现方式
5. 知道 Server Actions 的安全考虑

---

## 一、什么是 Server Actions

### 1.1 概念

> **Server Actions 是可以在客户端直接调用的服务端函数。** 你不需要手动创建 API 端点，只需要定义一个函数，就可以在表单或事件处理中调用它。

```
传统方式：
  前端 → fetch('/api/posts', { method: 'POST', body: ... }) → 后端处理

Server Actions：
  前端 → 直接调用 createPost(data) → 后端处理
```

### 1.2 生活类比

```
传统 API = 去银行柜台办事
  - 你要先取号（创建 API 路由）
  - 填写表格（构造请求）
  - 排队等待（fetch 调用）
  - 柜台处理（后端处理）
  - 拿到结果（解析响应）

Server Actions = 用手机银行 App
  - 直接点击按钮
  - 自动完成所有流程
  - 你不需要知道后台怎么处理
```

---

## 二、定义 Server Actions

### 2.1 在 Server Component 中定义

```tsx
// app/posts/page.tsx
export default async function PostsPage() {
  // 定义 Server Action
  async function createPost(formData: FormData) {
    'use server'

    const title = formData.get('title') as string
    const content = formData.get('content') as string

    await db.post.create({
      data: { title, content }
    })
  }

  return (
    <form action={createPost}>
      <input name="title" placeholder="标题" />
      <textarea name="content" placeholder="内容" />
      <button type="submit">创建文章</button>
    </form>
  )
}
```

### 2.2 在单独文件中定义（推荐）

```tsx
// app/posts/actions.ts
'use server'

import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  // 验证
  if (!title || title.length < 2) {
    return { error: '标题至少 2 个字' }
  }

  // 创建
  await db.post.create({
    data: { title, content }
  })

  // 重新验证缓存
  revalidatePath('/posts')

  return { success: true }
}
```

```tsx
// app/posts/page.tsx
import { createPost } from './actions'

export default async function PostsPage() {
  const posts = await db.post.findMany()

  return (
    <div>
      <form action={createPost}>
        <input name="title" placeholder="标题" />
        <textarea name="content" placeholder="内容" />
        <button type="submit">创建</button>
      </form>
      <ul>
        {posts.map(post => <li key={post.id}>{post.title}</li>)}
      </ul>
    </div>
  )
}
```

---

## 三、表单状态处理

### 3.1 useFormStatus

`useFormStatus` 可以获取表单的提交状态：

```tsx
// app/SubmitButton.tsx
'use client'

import { useFormStatus } from 'react-dom'

export default function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? '提交中...' : '提交'}
    </button>
  )
}
```

```tsx
// app/posts/page.tsx
import { createPost } from './actions'
import SubmitButton from './SubmitButton'

export default function PostsPage() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="标题" />
      <SubmitButton />
    </form>
  )
}
```

### 3.2 useActionState

`useActionState` 可以管理表单的返回状态：

```tsx
// app/posts/PostForm.tsx
'use client'

import { useActionState } from 'react'
import { createPost } from './actions'

export default function PostForm() {
  const [state, formAction, isPending] = useActionState(createPost, null)

  return (
    <form action={formAction}>
      <input name="title" placeholder="标题" />

      {state?.error && (
        <p className="text-red-500">{state.error}</p>
      )}

      {state?.success && (
        <p className="text-green-500">创建成功！</p>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? '提交中...' : '提交'}
      </button>
    </form>
  )
}
```

```tsx
// app/posts/actions.ts
'use server'

export async function createPost(prevState: any, formData: FormData) {
  const title = formData.get('title') as string

  if (!title || title.length < 2) {
    return { error: '标题至少 2 个字' }
  }

  await db.post.create({ data: { title } })

  return { success: true }
}
```

---

## 四、在事件处理中调用 Server Actions

### 4.1 除了表单，也可以在事件中调用

```tsx
'use client'

import { deletePost } from './actions'

export function DeleteButton({ postId }: { postId: string }) {
  return (
    <button
      onClick={async () => {
        const result = await deletePost(postId)
        if (result.error) {
          alert(result.error)
        }
      }}
    >
      删除
    </button>
  )
}
```

```tsx
// actions.ts
'use server'

export async function deletePost(id: string) {
  try {
    await db.post.delete({ where: { id } })
    revalidatePath('/posts')
    return { success: true }
  } catch (error) {
    return { error: '删除失败' }
  }
}
```

---

## 五、乐观更新

### 5.1 什么是乐观更新

乐观更新是指在服务器响应之前，先在 UI 上显示"假定成功"的结果，让界面感觉更快。

```
普通流程：
  点击删除 → 等待服务器 → 更新 UI
  用户感知：慢

乐观流程：
  点击删除 → 立即更新 UI → 后台发送请求
  如果失败 → 回滚 UI
  用户感知：快
```

### 5.2 使用 useOptimistic

```tsx
// app/posts/PostList.tsx
'use client'

import { useOptimistic } from 'react'
import { deletePost } from './actions'

export default function PostList({ posts }) {
  const [optimisticPosts, removeOptimisticPost] = useOptimistic(
    posts,
    (currentPosts, postId) =>
      currentPosts.filter(post => post.id !== postId)
  )

  return (
    <ul>
      {optimisticPosts.map(post => (
        <li key={post.id}>
          {post.title}
          <button
            onClick={async () => {
              removeOptimisticPost(post.id)
              await deletePost(post.id)
            }}
          >
            删除
          </button>
        </li>
      ))}
    </ul>
  )
}
```

---

## 六、安全考虑

### 6.1 Server Actions 会暴露为 API 端点

虽然你用函数的方式调用 Server Actions，但 Next.js 会把它暴露为 HTTP 端点。所以必须验证输入：

```tsx
'use server'

export async function createPost(formData: FormData) {
  // ✅ 必须验证
  const title = formData.get('title') as string

  if (!title || typeof title !== 'string') {
    return { error: '无效的标题' }
  }

  if (title.length > 100) {
    return { error: '标题太长' }
  }

  // ✅ 必须检查权限
  const session = await getSession()
  if (!session) {
    return { error: '未登录' }
  }

  // ✅ 使用参数化查询防止 SQL 注入
  await db.post.create({
    data: {
      title,
      authorId: session.userId
    }
  })
}
```

### 6.2 权限检查

```tsx
'use server'

export async function deletePost(postId: string) {
  const session = await getSession()
  if (!session) {
    return { error: '未登录' }
  }

  const post = await db.post.findUnique({
    where: { id: postId }
  })

  if (!post) {
    return { error: '文章不存在' }
  }

  if (post.authorId !== session.userId) {
    return { error: '没有权限删除' }
  }

  await db.post.delete({ where: { id: postId } })
  revalidatePath('/posts')

  return { success: true }
}
```

---

## 七、完整的表单示例

### 7.1 创建文章的完整流程

```tsx
// app/posts/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const PostSchema = z.object({
  title: z.string().min(2, '标题至少 2 个字').max(100, '标题最多 100 个字'),
  content: z.string().min(10, '内容至少 10 个字'),
})

export async function createPost(prevState: any, formData: FormData) {
  // 1. 验证输入
  const validatedFields = PostSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  // 2. 检查权限
  const session = await getSession()
  if (!session) {
    return { error: '请先登录' }
  }

  // 3. 创建文章
  try {
    await db.post.create({
      data: {
        ...validatedFields.data,
        authorId: session.userId,
      }
    })
  } catch (error) {
    return { error: '创建失败，请重试' }
  }

  // 4. 重新验证缓存
  revalidatePath('/posts')

  // 5. 返回成功
  return { success: true }
}
```

```tsx
// app/posts/CreatePostForm.tsx
'use client'

import { useActionState } from 'react'
import { createPost } from './actions'

export default function CreatePostForm() {
  const [state, formAction, isPending] = useActionState(createPost, null)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="title">标题</label>
        <input
          id="title"
          name="title"
          className="w-full border rounded px-3 py-2"
        />
        {state?.errors?.title && (
          <p className="text-red-500 text-sm">{state.errors.title[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="content">内容</label>
        <textarea
          id="content"
          name="content"
          rows={6}
          className="w-full border rounded px-3 py-2"
        />
        {state?.errors?.content && (
          <p className="text-red-500 text-sm">{state.errors.content[0]}</p>
        )}
      </div>

      {state?.error && (
        <p className="text-red-500">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {isPending ? '创建中...' : '创建文章'}
      </button>
    </form>
  )
}
```

---

## 八、动手练习

### 练习 1：创建简单的待办事项

```tsx
// app/todos/actions.ts
'use server'

let todos = [
  { id: 1, text: '学习 Next.js', done: false },
  { id: 2, text: '做练习', done: false },
]

export async function addTodo(formData: FormData) {
  const text = formData.get('text') as string
  if (!text) return { error: '内容不能为空' }

  todos.push({
    id: Date.now(),
    text,
    done: false,
  })

  revalidatePath('/todos')
  return { success: true }
}

export async function toggleTodo(id: number) {
  todos = todos.map(todo =>
    todo.id === id ? { ...todo, done: !todo.done } : todo
  )
  revalidatePath('/todos')
}

export async function getTodos() {
  return todos
}
```

### 练习 2：实现删除确认

创建一个带确认对话框的删除功能：

```tsx
'use client'

import { useState } from 'react'
import { deletePost } from './actions'

export function DeleteButton({ postId, postTitle }) {
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <>
      <button onClick={() => setShowConfirm(true)}>删除</button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded">
            <h3>确认删除</h3>
            <p>确定要删除"{postTitle}"吗？</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowConfirm(false)}>取消</button>
              <button
                onClick={async () => {
                  await deletePost(postId)
                  setShowConfirm(false)
                }}
                className="bg-red-500 text-white"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

### 练习 3：实现乐观更新的点赞功能

```tsx
// app/posts/LikeButton.tsx
'use client'

import { useOptimistic } from 'react'
import { likePost } from './actions'

export function LikeButton({ postId, initialLikes }) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    initialLikes,
    (currentLikes) => currentLikes + 1
  )

  return (
    <button
      onClick={async () => {
        addOptimisticLike()
        await likePost(postId)
      }}
    >
      👍 {optimisticLikes}
    </button>
  )
}
```

---

## 常见误区

1. **"Server Actions 是安全的，不需要验证输入"**：虽然 Server Actions 在服务端执行，但 Next.js 会把它们暴露为 HTTP 端点，任何人都可以构造请求调用。必须像对待普通 API 一样验证输入、检查权限。
2. **"useFormStatus 可以放在表单的任何位置"**：`useFormStatus` 只能用于 `<form>` 内部的子组件，不能在定义 `<form>` 的同一个组件中使用。它读取的是最近的父级 `<form>` 的状态。
3. **"乐观更新不需要处理失败"**：`useOptimistic` 会在服务器响应前先更新 UI，但如果服务器返回错误，你需要有回滚机制。否则用户看到的是"操作成功"，实际数据却没有变化。
4. **"Server Actions 只能用于表单"**：Server Actions 也可以在事件处理器（如 `onClick`）中调用，不限于 `<form action={...}>`。删除、点赞等操作可以直接在按钮点击时调用。

## 工程建议

1. **Server Actions 单独放在 `actions.ts` 文件中**：不要在 Server Component 里内联定义 Server Action，抽到单独的 `actions.ts` 文件中，既方便复用也方便测试。
2. **用 Zod 做输入验证**：在 Server Action 中用 Zod 的 `safeParse` 验证 FormData，返回结构化的错误信息（`flatten().fieldErrors`），前端用 `useActionState` 展示。
3. **提交成功后用 `revalidatePath` 刷新缓存**：Server Action 修改数据后，调用 `revalidatePath` 或 `revalidateTag` 让相关页面重新获取数据，不需要手动 `router.refresh()`。
4. **用 `redirect` 而不是返回跳转地址**：创建成功后需要跳转到详情页时，直接在 Server Action 中调用 `redirect('/posts/123')`，而不是返回 URL 让前端跳转。

## 九、小结

```
本课核心要点：

1. Server Actions 是可以直接调用的服务端函数，不需要手动创建 API
2. 用 'use server' 标记 Server Action
3. useFormStatus 获取表单提交状态，useActionState 管理返回状态
4. useOptimistic 实现乐观更新，让 UI 感觉更快
5. 必须验证输入和检查权限，Server Actions 会暴露为 HTTP 端点
6. Server Actions 适合表单提交和简单的数据变更
```

下一课我们将学习错误处理、加载状态和空状态的处理。
