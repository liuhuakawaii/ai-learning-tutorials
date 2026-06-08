# 第一课：Next.js 与传统 React SPA 的差异

## 学习目标

完成本课学习后，你将能够：

1. 理解传统 React SPA 的工作方式和局限性
2. 知道 Next.js 解决了哪些问题
3. 掌握 SSR、SSG、ISR 三种渲染策略的区别
4. 理解 App Router 的核心设计理念
5. 能判断一个页面应该用哪种渲染方式

---

## 一、传统 React SPA 回顾

### 1.1 什么是 SPA

SPA（Single Page Application）是指整个应用只有一个 HTML 页面，所有路由跳转、页面切换都由 JavaScript 在浏览器端完成。

```
用户访问网站
  ↓
服务器返回一个几乎空白的 HTML
  ↓
浏览器下载并执行 JavaScript bundle
  ↓
React 接管页面，渲染出 UI
  ↓
后续跳转都是 JS 操作，不再请求新页面
```

### 1.2 Create React App 的典型结构

```txt
my-app/
├── public/
│   └── index.html        ← 唯一的 HTML 文件
├── src/
│   ├── App.tsx           ← 路由和页面
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── About.tsx
│   │   └── Dashboard.tsx
│   └── index.tsx         ← 入口，挂载到 #root
└── package.json
```

`public/index.html` 长这样：

```html
<!DOCTYPE html>
<html>
  <head><title>My App</title></head>
  <body>
    <div id="root"></div>   <!-- 空的！等 JS 来填充 -->
    <script src="/static/js/bundle.js"></script>
  </body>
</html>
```

### 1.3 SPA 的三个核心问题

**问题一：首屏白屏**

```
用户点击链接
  → 浏览器下载 HTML（空的）
  → 下载 JS bundle（可能 200KB+）
  → 执行 JS
  → 调用 API 获取数据
  → 渲染页面
```

整个过程用户看到的是白屏，直到最后一步才有内容。网络越慢、JS 包越大，白屏越久。

**问题二：SEO 不友好**

搜索引擎爬虫看到的 HTML 是空的：

```html
<!-- 爬虫看到的 -->
<div id="root"></div>

<!-- 用户看到的（需要执行 JS 后） -->
<div id="root">
  <h1>欢迎来到我的网站</h1>
  <p>这是一篇重要的文章...</p>
</div>
```

虽然 Google 的爬虫可以执行 JS，但其他搜索引擎（百度、Bing）或社交媒体的链接预览可能无法正确获取内容。

**问题三：所有逻辑都在客户端**

```
传统 SPA 的分工：

浏览器（客户端）           服务器
├── 路由跳转               └── 提供 API
├── 数据获取               └── 返回 JSON
├── 页面渲染
├── 状态管理
├── 表单处理
└── 权限判断 ← 危险！用户可以篡改
```

所有业务逻辑都在客户端执行，用户可以通过浏览器开发者工具绕过任何前端校验。

---

## 二、Next.js 的解决方案

### 2.1 Next.js 是什么

> **Next.js 是一个基于 React 的全栈框架，它把"在服务器上运行 React"变成了一件简单的事。**

关键理解：Next.js 不是一个路由库，不是一个 UI 库，而是一个**完整的应用框架**。它帮你处理了：

- 路由（基于文件系统）
- 渲染策略（SSR、SSG、ISR）
- 代码分割（自动按路由拆分）
- 图片优化
- 字体优化
- API 路由
- 中间件
- 部署配置

### 2.2 一个生活类比

```
传统 React SPA = 自己搭帐篷露营
  - 你要自己带帐篷、睡袋、炉子
  - 你要自己选营地、搭帐篷
  - 你可以完全按自己的想法来
  - 但下雨了你要自己想办法

Next.js = 入住精装公寓
  - 水电网络都接好了
  - 你可以按规矩装修（自定义）
  - 你不需要操心地基和管道
  - 但你要遵守公寓的规则（框架约定）
```

### 2.3 核心差异对比

```
┌─────────────────┬────────────────────────┬────────────────────────┐
│     维度         │     传统 React SPA     │       Next.js          │
├─────────────────┼────────────────────────┼────────────────────────┤
│ 渲染位置         │ 仅客户端               │ 服务端 + 客户端         │
│ 首屏 HTML       │ 空的                   │ 完整内容                │
│ SEO            │ 差                      │ 好                     │
│ 数据获取        │ 组件挂载后 fetch        │ 服务端直接查询          │
│ 路由            │ 手动配置               │ 文件系统自动生成         │
│ 代码分割        │ 需要手动配置            │ 自动按路由分割           │
│ API 路由        │ 需要另外搭后端          │ 内置 API Routes         │
│ 部署            │ 静态文件即可            │ 需要 Node.js 环境       │
│ 学习成本        │ 低                     │ 中等（要理解服务端思维）  │
└─────────────────┴────────────────────────┴────────────────────────┘
```

---

## 三、渲染策略详解

### 3.1 CSR — 客户端渲染

这就是传统 SPA 的方式：

```tsx
// CSR：所有渲染在浏览器完成
'use client'

import { useState, useEffect } from 'react'

export default function ProductList() {
  const [products, setProducts] = useState([])

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data))
  }, [])

  return (
    <ul>
      {products.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  )
}
```

流程：

```
浏览器请求页面
  → 服务器返回空 HTML + JS
  → 浏览器执行 JS
  → useEffect 触发 fetch
  → 服务器返回数据
  → React 渲染列表
```

### 3.2 SSR — 服务端渲染

Next.js 默认在服务端渲染：

```tsx
// SSR：每次请求都在服务端渲染
export default async function ProductList() {
  const products = await db.product.findMany()

  return (
    <ul>
      {products.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  )
}
```

流程：

```
浏览器请求页面
  → 服务器执行 React 组件
  → 服务器查询数据库
  → 服务器渲染出完整 HTML
  → 浏览器收到完整 HTML，立即显示
  → 浏览器下载 JS，React "激活"页面（hydration）
```

**关键区别：** 用户看到第一个有意义的内容（FCP）的时间大幅提前。

### 3.3 SSG — 静态生成

对于不常变化的内容，可以在构建时生成 HTML：

```tsx
// SSG：构建时生成 HTML，所有用户看到同一份
export default async function AboutPage() {
  // 这段代码在 npm run build 时执行
  const content = await fetchCMSContent('about')

  return <div>{content}</div>
}
```

特点：

```
npm run build 时：
  → 执行组件代码
  → 生成静态 HTML 文件
  → 部署到 CDN

用户请求时：
  → CDN 直接返回 HTML
  → 无需服务器处理
  → 速度极快
```

### 3.4 ISR — 增量静态再生成

SSG 的升级版：静态页面可以在一定时间后自动更新：

```tsx
// ISR：构建时生成，但可以过期后重新生成
export const revalidate = 60 // 60 秒后可以重新生成

export default async function BlogPost({ params }) {
  const post = await db.post.findUnique({
    where: { slug: params.slug }
  })

  return <article>{post.content}</article>
}
```

流程：

```
第一次请求：
  → 生成静态 HTML（类似 SSG）
  → 缓存起来

60 秒内的请求：
  → 直接返回缓存的 HTML

60 秒后的第一个请求：
  → 先返回缓存的 HTML
  → 后台重新生成新的 HTML
  → 下一个请求就能看到新内容
```

### 3.5 如何选择渲染策略

```
数据变化频率    推荐策略       例子
─────────────────────────────────────────
几乎不变       SSG           关于页面、博客文章
偶尔变化       ISR           产品列表、新闻首页
频繁变化       SSR           用户仪表盘、实时数据
纯交互        CSR           聊天窗口、表单输入
```

---

## 四、App Router 的设计理念

### 4.1 从 Pages Router 到 App Router

Next.js 有两种路由系统：

```
Pages Router（旧）          App Router（新，当前推荐）
├── pages/                  ├── app/
│   ├── index.tsx           │   ├── page.tsx
│   ├── about.tsx           │   ├── about/
│   └── blog/               │   │   └── page.tsx
│       └── [slug].tsx      │   └── blog/
│                           │       └── [slug]/
│                           │           └── page.tsx
```

App Router 的核心改进：

| 特性 | Pages Router | App Router |
|------|-------------|-----------|
| 服务端组件 | 不支持 | 默认就是 |
| 嵌套布局 | 需要 _app.tsx hack | 原生支持 |
| 数据获取 | getServerSideProps | 直接在组件中 async/await |
| 流式渲染 | 不支持 | 支持 Suspense |
| Server Actions | 不支持 | 原生支持 |

### 4.2 "默认服务端"的思维转变

```
传统 React 思维：
  "这个组件需要数据 → 加个 useEffect → 调 API"

Next.js 思维：
  "这个组件需要数据 → 直接在组件里查数据库"
  "只有需要交互的地方才加 'use client'"
```

这是一个根本性的思维转变：

```tsx
// ❌ 传统思维：组件 → API → 数据库
'use client'
function UserProfile({ userId }) {
  const [user, setUser] = useState(null)
  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(setUser)
  }, [userId])
  // ...
}

// ✅ Next.js 思维：组件 → 数据库（一步到位）
async function UserProfile({ userId }) {
  const user = await db.user.findUnique({ where: { id: userId } })
  return <div>{user.name}</div>
}
```

---

## 五、动手练习

### 练习 1：创建你的第一个 Next.js 项目

```bash
npx create-next-app@latest my-first-app --typescript --tailwind --app
cd my-first-app
npm run dev
```

打开 http://localhost:3000，观察：

1. 页面是否一加载就有内容（不是白屏）
2. 查看页面源代码（右键 → 查看页面源代码），看看 HTML 是否包含完整内容
3. 对比你之前用 Create React App 创建的项目

### 练习 2：体验服务端渲染

创建一个新页面 `app/ssr-demo/page.tsx`：

```tsx
export default async function SSRDemo() {
  // 模拟一个耗时的数据获取
  await new Promise(resolve => setTimeout(resolve, 1000))

  const data = {
    message: '这个内容是在服务端生成的',
    time: new Date().toISOString(),
    randomNumber: Math.random()
  }

  return (
    <div>
      <h1>SSR 演示</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
```

观察：

1. 刷新页面时，时间戳是否每次都变化
2. randomNumber 是否每次都变化（说明是每次请求都重新渲染）
3. 查看页面源代码，确认 HTML 中已经有这些数据

### 练习 3：对比 CSR 和 SSR

创建两个页面对比：

`app/csr-demo/page.tsx`：

```tsx
'use client'

import { useState, useEffect } from 'react'

export default function CSRDemo() {
  const [time, setTime] = useState('加载中...')

  useEffect(() => {
    setTime(new Date().toISOString())
  }, [])

  return (
    <div>
      <h1>CSR 演示</h1>
      <p>生成时间: {time}</p>
    </div>
  )
}
```

`app/ssr-compare/page.tsx`：

```tsx
export default function SSRCompare() {
  return (
    <div>
      <h1>SSR 演示</h1>
      <p>生成时间: {new Date().toISOString()}</p>
    </div>
  )
}
```

分别查看两个页面的"查看页面源代码"，对比 HTML 内容的差异。

---

## 六、小结

```
本课核心要点：

1. 传统 SPA 的三个问题：首屏白屏、SEO 差、逻辑全在客户端
2. Next.js 通过服务端渲染解决了这些问题
3. 四种渲染策略：CSR（客户端）、SSR（服务端）、SSG（静态）、ISR（增量静态）
4. App Router 默认使用服务端组件，只有需要交互时才标记 'use client'
5. 思维转变：从"组件 → API → 数据库"变为"组件 → 数据库"
```

下一课我们将学习 App Router 的路由系统：如何用文件夹组织页面、布局和模板。
