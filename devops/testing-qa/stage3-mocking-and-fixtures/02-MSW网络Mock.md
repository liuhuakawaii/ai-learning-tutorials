# MSW 网络 Mock

## 场景引入

你用 `vi.mock('axios')` Mock 了网络请求，测试通过了。但上线后发现：请求的 URL 拼错了、请求头漏了 Content-Type、POST body 的字段名写反了。问题出在哪？`vi.mock` 替换的是代码模块，它不管你发出去的请求长什么样——你 Mock 的是"调用行为"，而不是"网络层"。

Mock Service Worker（MSW）换了一个思路：它在**网络层**拦截请求，你的代码照常调用 `fetch` 或 `axios`，MSW 假装自己是服务器返回响应。这样，请求的 URL、headers、body 格式全都会被真实执行，只有一环不同——响应来自本地而不是真正的服务器。

## 学习目标

- 理解 MSW 的拦截原理与 `vi.mock` 的本质区别
- 掌握 MSW 在 Node.js 测试环境中的配置和使用
- 学会定义 handler 模拟各种响应场景
- 能根据场景选择 MSW 或 vi.mock

## MSW 的工作原理

传统 Mock（如 vi.mock）的拦截位置在**代码层**：

```
你的代码 → axios 模块（被替换为空壳） → 返回 Mock 数据
```

MSW 的拦截位置在**网络层**：

```
你的代码 → fetch/axios → 网络层拦截 → 返回 Mock 数据
```

在 Node.js 环境中，MSW 通过拦截 `http`/`https` 模块实现；在浏览器中，通过 Service Worker API 拦截。无论哪种方式，你的业务代码**完全不需要修改**。

## 安装与配置

```bash
npm install -D msw
```

### 定义 Handler

创建 `mocks/handlers.ts`，定义所有需要拦截的请求：

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from 'msw'

interface User {
  id: string
  name: string
  email: string
}

const mockUsers: User[] = [
  { id: '1', name: '张三', email: 'zhangsan@test.com' },
  { id: '2', name: '李四', email: 'lisi@test.com' },
]

export const handlers = [
  http.get('*/api/users', ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const pageSize = 10
    const start = (page - 1) * pageSize
    return HttpResponse.json({
      data: mockUsers.slice(start, start + pageSize),
      total: mockUsers.length,
      page,
      pageSize,
    })
  }),

  http.get('*/api/users/:id', ({ params }) => {
    const user = mockUsers.find((u) => u.id === params.id)
    if (!user) {
      return HttpResponse.json({ error: '用户不存在' }, { status: 404 })
    }
    return HttpResponse.json(user)
  }),

  http.post('*/api/users', async ({ request }) => {
    const body = (await request.json()) as { name: string; email: string }
    const newUser: User = { id: String(mockUsers.length + 1), ...body }
    return HttpResponse.json(newUser, { status: 201 })
  }),
]
```

### 测试环境配置

```typescript
// mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

```typescript
// vitest.setup.ts
import { server } from './mocks/server'
import { beforeAll, afterAll, afterEach } from 'vitest'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

## 在测试中使用

```typescript
// services/user-api.test.ts
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { fetchUsers, fetchUserById, createUser } from './user-api'

describe('fetchUsers', () => {
  it('返回分页用户列表', async () => {
    const result = await fetchUsers(1)
    expect(result.data).toHaveLength(2)
    expect(result.data[0].name).toBe('张三')
  })
})

describe('fetchUserById', () => {
  it('用户存在时返回用户数据', async () => {
    const user = await fetchUserById('1')
    expect(user.name).toBe('张三')
  })

  it('用户不存在时抛出错误', async () => {
    await expect(fetchUserById('999')).rejects.toThrow('用户不存在')
  })
})
```

## 模拟特殊场景

### 模拟网络错误

```typescript
it('网络错误时抛出异常', async () => {
  server.use(
    http.get('*/api/users', () => {
      return HttpResponse.error()
    })
  )
  await expect(fetchUsers(1)).rejects.toThrow()
})
```

### 模拟延迟响应

```typescript
it('慢请求显示加载状态', async () => {
  server.use(
    http.get('*/api/users', async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      return HttpResponse.json({ data: [], total: 0 })
    })
  )

  const start = Date.now()
  await fetchUsers(1)
  expect(Date.now() - start).toBeGreaterThanOrEqual(1900)
})
```

### 模拟分页

```typescript
it('翻页返回不同数据', async () => {
  server.use(
    http.get('*/api/users', ({ request }) => {
      const url = new URL(request.url)
      const page = parseInt(url.searchParams.get('page') ?? '1')
      if (page > 2) {
        return HttpResponse.json({ data: [], total: 20, page, pageSize: 10 })
      }
      return HttpResponse.json({
        data: [{ id: '1', name: '张三', email: 'a@b.com' }],
        total: 20, page, pageSize: 10,
      })
    })
  )

  const page3 = await fetchUsers(3)
  expect(page3.data).toHaveLength(0)
})
```

### 模拟认证失败

```typescript
it('token 过期返回 401', async () => {
  server.use(
    http.get('*/api/users', () => {
      return HttpResponse.json({ error: 'Token expired' }, { status: 401 })
    })
  )
  await expect(fetchUsers(1)).rejects.toThrow('Token expired')
})
```

## 与 vi.mock 的区别和选择

| 维度 | MSW | vi.mock |
|------|-----|---------|
| 拦截层级 | 网络层 | 代码模块层 |
| 验证目标 | 真实的 HTTP 请求 | 模块函数调用 |
| 代码侵入 | 无 | 需要 Mock 路径 |
| 测试类型 | 集成测试为主 | 单元测试为主 |
| 维护成本 | Handler 与 API 合约对应 | Mock 与实现路径耦合 |

**选择建议：**

- 测试数据获取层（API client）：用 MSW，验证请求格式和响应处理
- 测试业务逻辑层（service）：用 vi.mock，快速 Mock 掉 API client
- 测试组件如何处理网络状态（loading/error/success）：用 MSW，更接近真实场景

## 常见误区

1. **把 MSW 当作 Mock 一切的工具**：纯函数、工具函数不需要 MSW
2. **Handler 定义了但没验证请求**：只关注返回值，没有检查请求的 headers 和 body
3. **忘记 `server.resetHandlers()`**：前一个测试的临时 handler 会影响后续测试
4. **用 `http.all('*')` 拦截一切**：过于宽泛的匹配会让测试失去精确性

## 工程建议

1. **Handler 文件按 API 模块拆分**：`handlers/user.ts`、`handlers/order.ts`
2. **在 CI 中设置 `onUnhandledRequest: 'error'`**：发现未 Mock 的请求
3. **Handler 与 API 文档同步**：推荐用 OpenAPI/Swagger 自动生成 MSW handler
4. **`server.use()` 只用于特殊场景**：默认 handler 应覆盖大部分正常流程

## 小结

MSW 在网络层拦截请求，让你的代码执行真实的 HTTP 调用逻辑，只替换服务器响应。它特别适合验证"请求是否正确"和"响应处理是否正确"的集成测试。与 `vi.mock` 的模块级 Mock 形成互补——MSW 测试边界行为，vi.mock 测试内部逻辑。根据测试目标选择合适的工具。

## 练习

### 练习一：定义 MSW Handler

为一个博客 API 定义 MSW handler，要求：
- `GET /api/posts` 返回文章列表，支持 `?page=` 分页
- `GET /api/posts/:id` 返回单篇文章，不存在时返回 404
- `POST /api/posts` 创建文章，需要验证请求 body 包含 `title` 和 `content`

### 练习二：对比 MSW 和 vi.mock

有一个 `UserProfile` 组件，内部调用 `fetchUserById` 获取用户数据后渲染。请分别用 MSW 和 vi.mock 两种方式写出测试，说明各自的优缺点。

---

## 参考答案

### 练习一

**思路**：按照 MSW 的 handler 语法定义三个路由，注意参数提取和错误响应。

**答案**：

```typescript
import { http, HttpResponse } from 'msw'

const mockPosts = [
  { id: '1', title: '第一篇文章', content: '内容一', createdAt: '2024-01-01' },
  { id: '2', title: '第二篇文章', content: '内容二', createdAt: '2024-01-02' },
]

export const postHandlers = [
  http.get('*/api/posts', ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const pageSize = 10
    const start = (page - 1) * pageSize
    return HttpResponse.json({
      data: mockPosts.slice(start, start + pageSize),
      total: mockPosts.length, page,
    })
  }),

  http.get('*/api/posts/:id', ({ params }) => {
    const post = mockPosts.find((p) => p.id === params.id)
    if (!post) return HttpResponse.json({ error: '文章不存在' }, { status: 404 })
    return HttpResponse.json(post)
  }),

  http.post('*/api/posts', async ({ request }) => {
    const body = (await request.json()) as { title?: string; content?: string }
    if (!body.title || !body.content) {
      return HttpResponse.json({ error: '缺少 title 或 content' }, { status: 400 })
    }
    return HttpResponse.json(
      { id: '3', ...body, createdAt: new Date().toISOString() },
      { status: 201 }
    )
  }),
]
```

**要点**：`http.get('*/api/posts/:id')` 中的 `*` 匹配任意域名；POST handler 需要 `await request.json()` 解析 body。

### 练习二

**思路**：对比两种方式在组件测试中的差异。

**答案**：

MSW 方式——更接近真实场景，验证了请求路径和 headers，但配置较重：

```typescript
it('MSW 方式：显示用户名称', async () => {
  server.use(
    http.get('*/api/users/:id', () => {
      return HttpResponse.json({ id: '1', name: '张三', bio: '前端工程师' })
    })
  )
  render(<UserProfile userId="1" />)
  await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument())
})
```

vi.mock 方式——更轻量快速，但不会验证 HTTP 层的行为：

```typescript
vi.mock('./user-api')

it('vi.mock 方式：显示用户名称', async () => {
  vi.mocked(userApi.fetchUserById).mockResolvedValue({
    id: '1', name: '张三', bio: '前端工程师',
  })
  render(<UserProfile userId="1" />)
  await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument())
})
```

**对比**：组件测试通常用 MSW 更有价值，因为它同时验证了请求和响应处理。
