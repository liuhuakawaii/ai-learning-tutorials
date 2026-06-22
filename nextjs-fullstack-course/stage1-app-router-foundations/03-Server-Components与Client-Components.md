# 第三课：Server Components 与 Client Components

## 场景引入

你在做一个内容管理系统的文章详情页，页面需要展示文章内容（来自数据库）、评论列表（来自另一个 API）和一个点赞按钮。你本能地给整个页面加了 `'use client'`，然后在 `useEffect` 里分别调用两个接口获取数据。结果发现：页面加载时先白屏，然后两个接口串行请求，最后才渲染出内容。更糟的是，`date-fns` 和 `lodash` 这些只在服务端才需要的库也被打包进了客户端 bundle，JS 体积暴涨。你需要理解 Server Components 和 Client Components 的边界在哪里，才能做出正确的架构选择。

## 学习目标

完成本课学习后，你将能够：

1. 理解 Server Components 和 Client Components 的本质区别
2. 掌握何时使用 Server Components，何时使用 Client Components
3. 学会 `'use client'` 指令的正确使用方式
4. 理解组件边界对性能和功能的影响
5. 避免常见的组件边界错误

---

## 一、两种组件的本质

### 1.1 一个生活类比

```
Server Component = 后厨
  - 在服务器上执行
  - 可以直接访问数据库、文件系统、环境变量
  - 做好的菜（HTML）端给用户
  - 用户看不到后厨怎么做菜

Client Component = 餐桌上的服务员
  - 在浏览器中执行
  - 可以响应用户操作（点击、输入）
  - 可以使用浏览器 API（localStorage、navigator）
  - 用户可以看到服务员在做什么
```

### 1.2 核心区别

```
┌─────────────────────┬─────────────────────────┬─────────────────────────┐
│       特性           │    Server Component     │    Client Component     │
├─────────────────────┼─────────────────────────┼─────────────────────────┤
│ 执行环境            │ 服务器                  │ 浏览器                  │
│ 默认？              │ 是                      │ 需要 'use client'       │
│ 能用 useState?      │ 不能                    │ 能                      │
│ 能用 useEffect?     │ 不能                    │ 能                      │
│ 能用 onClick?       │ 不能                    │ 能                      │
│ 能访问数据库?       │ 能                      │ 不能                    │
│ 能访问环境变量?     │ 能（安全的）            │ 不能（会泄露）          │
│ 能用浏览器 API?     │ 不能                    │ 能                      │
│ JS 发送给浏览器?    │ 不发送                  │ 发送                    │
│ 包大小影响          │ 不影响                  │ 影响                    │
└─────────────────────┴─────────────────────────┴─────────────────────────┘
```

---

## 二、Server Components

### 2.1 默认就是 Server Component

在 App Router 中，所有组件默认都是 Server Component：

```tsx
// app/page.tsx — 这是一个 Server Component
// 不需要任何特殊标记

export default function HomePage() {
  // 可以直接访问数据库
  const posts = await db.post.findMany()

  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.summary}</p>
        </article>
      ))}
    </div>
  )
}
```

### 2.2 Server Component 的优势

**优势一：零客户端 JS**

```tsx
// 这个组件不会向浏览器发送任何 JavaScript
export default function StaticContent() {
  return (
    <div>
      <h1>这段内容是纯 HTML</h1>
      <p>没有 JS 被发送到浏览器</p>
    </div>
  )
}
```

**优势二：直接访问后端资源**

```tsx
export default async function UserList() {
  // 直接查数据库，不需要 API 层
  const users = await db.user.findMany({
    select: { id: true, name: true, email: true }
  })

  // 直接读文件
  const config = await fs.readFile('./config.json', 'utf-8')

  // 直接用环境变量（不会泄露给客户端）
  const apiKey = process.env.API_KEY

  return <div>...</div>
}
```

**优势三：自动代码分割**

```tsx
import { HeavyComponent } from './HeavyComponent'

export default function Page() {
  // HeavyComponent 的代码不会在首页加载时被下载
  // 只有导航到这个页面时才会加载
  return <HeavyComponent />
}
```

### 2.3 Server Component 不能做什么

```tsx
export default function Counter() {
  // ❌ 不能用 useState
  const [count, setCount] = useState(0)  // 报错！

  // ❌ 不能用 useEffect
  useEffect(() => { ... })  // 报错！

  // ❌ 不能用事件处理
  return <button onClick={() => setCount(count + 1)}>+1</button>  // 报错！
}
```

---

## 三、Client Components

### 3.1 如何声明

在文件顶部添加 `'use client'` 指令：

```tsx
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>计数: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  )
}
```

### 3.2 何时需要 Client Component

**需要用户交互：**

```tsx
'use client'

import { useState } from 'react'

export default function SearchBar() {
  const [query, setQuery] = useState('')

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="搜索..."
    />
  )
}
```

**需要浏览器 API：**

```tsx
'use client'

import { useEffect, useState } from 'react'

export default function WindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const update = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return <p>窗口大小: {size.width} x {size.height}</p>
}
```

**需要 useEffect 或 useRef：**

```tsx
'use client'

import { useRef, useEffect } from 'react'

export default function AutoFocusInput() {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return <input ref={inputRef} />
}
```

### 3.3 常见的 Client Component 场景

```
需要 'use client' 的场景：
  ✅ 表单输入和处理
  ✅ 按钮点击事件
  ✅ 鼠标/键盘事件
  ✅ 动画和过渡
  ✅ 第三方库需要 useEffect
  ✅ localStorage / sessionStorage
  ✅ WebSocket 连接
  ✅ 浏览器检测
```

---

## 四、组件边界

### 4.1 什么是组件边界

`'use client'` 指令定义了一个边界：这个文件及其导入的所有模块都会在客户端执行。

```
                    组件边界示意图

  Server Component 区域          Client Component 区域
  ┌─────────────────────┐      ┌─────────────────────┐
  │                     │      │  'use client'       │
  │  Page               │      │                     │
  │  ├── Header         │      │  SearchBar          │
  │  ├── Article        │      │  ├── Input          │
  │  └── Sidebar ───────┼──────┼──→ Dropdown         │
  │                     │      │  └── Button         │
  └─────────────────────┘      └─────────────────────┘

  服务器执行                      浏览器执行
  不发送 JS                      发送 JS
```

### 4.2 导入规则

```tsx
// ✅ Server Component 可以导入 Client Component
import ClientComponent from './ClientComponent'

// ✅ Client Component 可以导入其他 Client Component
'use client'
import AnotherClient from './AnotherClient'

// ❌ Client Component 不能导入 Server Component
'use client'
import ServerComponent from './ServerComponent'  // 报错！
```

### 4.3 正确的组件组合模式

**模式一：Server Component 包裹 Client Component**

```tsx
// app/page.tsx (Server Component)
import ClientCounter from './ClientCounter'

export default async function Page() {
  const data = await fetchData() // 服务端获取数据

  return (
    <div>
      <h1>{data.title}</h1>
      <ClientCounter initialCount={data.count} />
    </div>
  )
}

// app/ClientCounter.tsx (Client Component)
'use client'

import { useState } from 'react'

export default function ClientCounter({ initialCount }) {
  const [count, setCount] = useState(initialCount)

  return (
    <button onClick={() => setCount(count + 1)}>
      {count}
    </button>
  )
}
```

**模式二：Client Component 作为插槽**

```tsx
// app/page.tsx (Server Component)
export default function Page() {
  return (
    <ClientLayout sidebar={<ServerSidebar />}>
      <ServerContent />
    </ClientLayout>
  )
}

// app/ClientLayout.tsx (Client Component)
'use client'

export default function ClientLayout({ children, sidebar }) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="flex">
      {isOpen && <aside>{sidebar}</aside>}
      <main>{children}</main>
    </div>
  )
}
```

---

## 五、性能考虑

### 5.1 客户端包大小

```tsx
// ❌ 整个文件都会被打包到客户端
'use client'

import { useState } from 'react'
import { format } from 'date-fns'  // 这个库也会被打包
import _ from 'lodash'  // 这个库也会被打包

export default function DatePicker() {
  // ...
}
```

```tsx
// ✅ 只把需要交互的部分标记为 Client Component
// 大部分逻辑放在 Server Component 中
import { format } from 'date-fns'  // 只在服务端执行
import _ from 'lodash'  // 只在服务端执行

export default async function DateDisplay() {
  const formatted = format(new Date(), 'yyyy-MM-dd')

  return (
    <div>
      <p>{formatted}</p>
      <ClientDatePicker />  {/* 只有交互部分在客户端 */}
    </div>
  )
}
```

### 5.2 最小化客户端代码

```
原则：把 'use client' 边界推到组件树的最底层

❌ 错误做法：
'use client'  ← 整个页面都在客户端
export default function Page() {
  const data = useFetchData()
  return <div><h1>{data.title}</h1><Button /></div>
}

✅ 正确做法：
export default async function Page() {  ← 服务端
  const data = await fetchData()
  return <div><h1>{data.title}</h1><ClientButton /></div>
}
'use client'  ← 只有按钮在客户端
export default function ClientButton() {
  return <button onClick={...}>点击</button>
}
```

---

## 常见误区

### 6.1 错误：在 Server Component 中使用 useState

```
Error: useState only works in Client Components.
Add the 'use client' directive at the top of the file.
```

解决：要么把组件标记为 `'use client'`，要么把状态逻辑移到子组件中。

### 6.2 错误：把 Server Component 传给 Client Component 的 children

```tsx
// ❌ 这会报错
'use client'
export default function Modal({ children }) {
  return <div className="modal">{children}</div>
}

// 传入 Server Component 作为 children
import ServerComponent from './ServerComponent'
<Modal><ServerComponent /></Modal>  // 报错！
```

```tsx
// ✅ 正确做法：children 可以是 Server Component
'use client'
export default function Modal({ children }) {
  return <div className="modal">{children}</div>
}

// 因为 children 是 React.ReactNode，Next.js 会正确处理
<Modal>
  <ServerComponent />  {/* 这是 OK 的 */}
</Modal>
```

实际上 `children` 作为 prop 传递是 OK 的，但其他 prop 不行：

```tsx
// ❌ 不能把 Server Component 作为普通 prop 传递
'use client'
export default function Card({ header, body }) {
  return <div>{header}{body}</div>
}

<Card header={<ServerHeader />} body={<ServerBody />} />  // 报错！
```

```tsx
// ✅ 用 children 解决
'use client'
export default function Card({ children }) {
  return <div className="card">{children}</div>
}

<Card>
  <ServerHeader />
  <ServerBody />
</Card>
```

## 工程建议

1. **把 `'use client'` 边界推到组件树的最底层**：不要给整个页面加 `'use client'`，只在真正需要交互的叶子组件上标记。这样服务端的库（如 Prisma、date-fns）不会被打包进客户端。
2. **用 children 模式组合 Server 和 Client Component**：Client Component 可以通过 `children` prop 接收 Server Component，这是 Next.js 推荐的组合模式。不要尝试把 Server Component 作为普通 prop 传递。
3. **数据获取放在 Server Component，交互逻辑放在 Client Component**：Server Component 负责查数据库、调用内部 API、格式化数据；Client Component 负责处理用户输入、动画、浏览器 API。
4. **避免在 Server Component 中导入不必要的客户端依赖**：如果你的组件树中某个子组件需要 `'use client'`，确保它的父级不会因为导入链而被拖入客户端 bundle。

---

## 七、动手练习

### 练习 1：Server Component 数据获取

创建一个 Server Component，直接从模拟的"数据库"获取数据并显示：

```tsx
// app/users/page.tsx
const mockUsers = [
  { id: 1, name: '张三', email: 'zhangsan@example.com' },
  { id: 2, name: '李四', email: 'lisi@example.com' },
  { id: 3, name: '王五', email: 'wangwu@example.com' },
]

export default async function UsersPage() {
  // 模拟数据库查询延迟
  await new Promise(resolve => setTimeout(resolve, 500))
  const users = mockUsers

  return (
    <div>
      <h1>用户列表</h1>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.name} - {user.email}</li>
        ))}
      </ul>
    </div>
  )
}
```

### 练习 2：Client Component 交互

创建一个带搜索和过滤的用户列表：

```tsx
// app/UserSearch.tsx
'use client'

import { useState } from 'react'

export default function UserSearch({ users }) {
  const [query, setQuery] = useState('')

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索用户..."
      />
      <ul>
        {filtered.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

### 练习 3：组合 Server 和 Client Component

创建一个页面，Server Component 获取数据，Client Component 处理交互：

```tsx
// app/products/page.tsx
import ProductList from './ProductList'

export default async function ProductsPage() {
  const products = await fetchProducts()

  return (
    <div>
      <h1>产品列表</h1>
      <ProductList products={products} />
    </div>
  )
}

// app/products/ProductList.tsx
'use client'

export default function ProductList({ products }) {
  const [sortBy, setSortBy] = useState('name')

  const sorted = [...products].sort((a, b) =>
    sortBy === 'name'
      ? a.name.localeCompare(b.name)
      : a.price - b.price
  )

  return (
    <div>
      <select onChange={(e) => setSortBy(e.target.value)}>
        <option value="name">按名称</option>
        <option value="price">按价格</option>
      </select>
      <ul>
        {sorted.map(p => <li key={p.id}>{p.name} - ¥{p.price}</li>)}
      </ul>
    </div>
  )
}
```

---

## 八、小结

```
本课核心要点：

1. Server Components 是默认的，在服务端执行，不发送 JS 到客户端
2. Client Components 需要 'use client'，在浏览器执行，处理交互
3. Server Component 可以直接访问数据库和环境变量
4. Client Component 可以使用 useState、useEffect、事件处理
5. 把 'use client' 边界推到组件树的最底层以最小化客户端代码
6. Server Component 可以作为 children 传给 Client Component
```

下一课我们将学习数据获取、缓存和重新验证策略。
