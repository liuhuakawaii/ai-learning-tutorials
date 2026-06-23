# Next.js 与传统 React SPA 的差异

## 从一个真实问题开始

你用 Create React App 做了产品网站，部署后发现两个问题：搜索引擎完全搜不到——爬虫看到的是空的 `<div id="root"></div>`；用户反馈"打开白屏好几秒"——手机网络慢时更明显。

你试了代码分割、预加载、CDN，但白屏无法根本解决。问题在架构上：浏览器必须先下载并执行完所有 JavaScript，才能渲染第一行内容。

## SPA 的执行流程

```
用户访问 → 服务器返回空 HTML → 下载 JS bundle (200KB+) → 执行 JS → 调 API → 渲染页面
```

整个过程用户看到白屏，直到最后一步才有内容。三个核心问题：

1. **首屏白屏**：JS 下载 + 执行 + 数据请求的总时间
2. **SEO 不友好**：爬虫看到空 HTML
3. **所有逻辑在客户端**：用户可以通过 DevTools 绕过任何前端校验

## Next.js 的解决方案

> Next.js 是基于 React 的全栈框架，把"在服务器上运行 React"变简单了。

它帮你处理了路由、渲染策略、代码分割、图片优化、字体优化、API 路由、中间件、部署配置。

关键认知：**Next.js 不是路由库，是完整应用框架**。

## 核心差异

```
维度           传统 React SPA           Next.js
───────────────────────────────────────────────
渲染位置       仅客户端                 服务端 + 客户端
首� HTML      空的                     完整内容
SEO           差                       好
数据获取       组件挂载后 fetch         服务端直接查询
路由           手动配置                 文件系统自动生成
代码分割       需要手动配置             自动按路由分割
API 路由       需要另外搭后端           内置 API Routes
```

## 四种渲染策略

### CSR（客户端渲染）

传统 SPA 方式。`'use client'` 组件在浏览器执行。

```tsx
'use client'
export default function ProductList() {
  const [products, setProducts] = useState([])
  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts)
  }, [])
  return <ul>{products.map(p => <li key={p.id}>{p.name}</li>)}</ul>
}
```

### SSR（服务端渲染）

每次请求都在服务端渲染，返回完整 HTML。

```tsx
export default async function ProductList() {
  const products = await db.product.findMany()
  return <ul>{products.map(p => <li key={p.id}>{p.name}</li>)}</ul>
}
```

### SSG（静态生成）

构建时生成 HTML，部署到 CDN，速度极快。

```tsx
export default async function AboutPage() {
  const content = await fetchCMSContent('about')
  return <div>{content}</div>
}
```

### ISR（增量静态再生成）

SSG 的升级版：静态页面可以过期后自动更新。

```tsx
export const revalidate = 60 // 60 秒后可以重新生成
export default async function BlogPost({ params }) {
  const post = await db.post.findUnique({ where: { slug: params.slug } })
  return <article>{post.content}</article>
}
```

## 如何选择

```
数据变化频率    推荐策略       例子
──────────────────────────────────
几乎不变       SSG           关于页面、博客
偶尔变化       ISR           产品列表、新闻首页
频繁变化       SSR           仪表盘、实时数据
纯交互        CSR           聊天窗口、表单输入
```

## App Router 的思维转变

```
传统 React 思维：
  "这个组件需要数据 → 加 useEffect → 调 API"

Next.js 思维：
  "这个组件需要数据 → 直接在组件里查数据库"
  "只有需要交互的地方才加 'use client'"
```

```tsx
// ❌ 传统思维
'use client'
function UserProfile({ userId }) {
  const [user, setUser] = useState(null)
  useEffect(() => {
    fetch(`/api/users/${userId}`).then(r => r.json()).then(setUser)
  }, [userId])
}

// ✅ Next.js 思维
async function UserProfile({ userId }) {
  const user = await db.user.findUnique({ where: { id: userId } })
  return <div>{user.name}</div>
}
```

## 验证方法

右键"查看页面源代码"：
- 如果 HTML 里已经有完整内容 → SSR/SSG
- 如果只有空壳 div → CSR

## 练习

### 练习一：创建 Next.js 项目

```bash
npx create-next-app@latest my-app --typescript --tailwind --app
```

查看页面源代码，确认 HTML 已包含完整内容。

### 练习二：对比 CSR 和 SSR

创建两个页面：一个用 `'use client'` + `useState` + `useEffect`，一个直接 `async function`。对比源代码差异。

### 练习三：SSR 演示

创建 `app/ssr-demo/page.tsx`，在服务端获取当前时间和随机数。每次刷新应该不同，源代码中已有数据。

---

## 参考答案

### 练习一

```bash
npx create-next-app@latest my-app --typescript --tailwind --app
cd my-app && npm run dev
```

右键 → 查看页面源代码 → 搜索 `<h1`，应该能找到页面标题文本，而不是空的 `<div id="root">`。

### 练习二

CSR 页面源代码中，时间显示"加载中..."，需要 JS 执行后才更新。SSR 页面源代码中，时间已经是具体值。

### 练习三

```tsx
// app/ssr-demo/page.tsx
export default async function SSRDemo() {
  await new Promise(r => setTimeout(r, 500))
  return (
    <div>
      <h1>SSR 演示</h1>
      <p>生成时间: {new Date().toISOString()}</p>
      <p>随机数: {Math.random()}</p>
    </div>
  )
}
```

每次刷新页面，时间和随机数都变化，说明是服务端实时生成。
