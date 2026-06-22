# 第6课：Server Components 与缓存

> **课程定位**：理解 React Server Components 对性能的影响和正确的使用方式
> **前置知识**：了解 Next.js App Router 和 React 基础
> **预计时长**：35 分钟

## 场景引入

你的 Next.js 博客文章页面加载时，浏览器要先下载 300KB 的 JS 包（包含 Markdown 解析器、代码高亮库、评论组件），然后执行 JS、请求数据、再渲染。Lighthouse 报告显示 LCP 3.8 秒，其中 2 秒花在 JS 下载和执行上。但仔细一看，文章内容和代码高亮根本不需要交互——它们完全可以放在服务端渲染，客户端只需要下载评论区的 JS。用 Server Components 重构后，客户端 JS 从 300KB 降到 50KB，LCP 从 3.8 秒降到 1.2 秒。

---

## 学习目标

1. 理解 Server Components 和 Client Components 的区别
2. 掌握 Server Components 带来的性能优势
3. 学会合理划分服务端和客户端组件
4. 理解 Server Actions 和数据变更

---

## 一、Server vs Client Components

```
┌──────────────────────────────────────────────────────────────┐
│              Server Components vs Client Components           │
├──────────────────────┬───────────────────────────────────────┤
│                      │ Server          │ Client              │
├──────────────────────┼─────────────────┼─────────────────────┤
│ 运行环境             │ 服务端          │ 浏览器              │
│ JS 发送到客户端      │ ❌ 不发送       │ ✅ 发送             │
│ 可以访问服务端资源   │ ✅ 数据库等     │ ❌ 不能             │
│ 可以用 hooks         │ ❌ 不能         │ ✅ useState 等      │
│ 可以绑定事件         │ ❌ 不能         │ ✅ onClick 等       │
│ 可以用浏览器 API     │ ❌ 不能         │ ✅ window 等        │
│ 默认                  │ ✅ App Router 默认│ 需要 'use client' │
└──────────────────────┴─────────────────┴─────────────────────┘
```

```jsx
// Server Component（默认）
// 运行在服务端，JS 不发送到客户端
async function ProductList() {
  const products = await db.query('SELECT * FROM products');
  return (
    <ul>
      {products.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}

// Client Component
'use client';
import { useState } from 'react';

function ProductFilter() {
  const [category, setCategory] = useState('all');
  return (
    <select value={category} onChange={e => setCategory(e.target.value)}>
      <option value="all">All</option>
      <option value="electronics">Electronics</option>
    </select>
  );
}
```

---

## 二、性能优势

### 2.1 更小的客户端 JS 包

```
┌──────────────────────────────────────────────────────────────┐
│              Server Components 减少 JS 体积                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  传统 React 应用：                                            │
│  ┌──────────────────────────────────────┐                    │
│  │  客户端 JS 包 = 所有组件代码          │                    │
│  │  + 依赖库（markdown, syntax highlight）│                    │
│  │  + 数据获取逻辑                       │                    │
│  │  = 很大的 bundle                     │                    │
│  └──────────────────────────────────────┘                    │
│                                                              │
│  使用 Server Components：                                     │
│  ┌──────────────────────────────────────┐                    │
│  │  客户端 JS 包 = 只有 'use client' 组件│                    │
│  │  Server Components → 0 JS            │                    │
│  │  = 更小的 bundle                     │                    │
│  └──────────────────────────────────────┘                    │
│                                                              │
│  例：一篇博客文章页面                                        │
│  - Markdown 渲染：服务端（0 JS）                              │
│  - 代码高亮：服务端（0 JS）                                   │
│  - 评论表单：客户端（需要交互）                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 数据获取优化

```jsx
// ❌ 传统：客户端获取数据
'use client';
function Profile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/user').then(res => res.json()).then(setUser);
  }, []);

  if (!user) return <Spinner />;
  return <div>{user.name}</div>;
}
// 问题：瀑布式请求（先加载 JS → 再请求数据 → 再渲染）

// ✅ Server Component：直接获取数据
async function Profile() {
  const user = await db.getUser();
  return <div>{user.name}</div>;
}
// 优势：服务端直接访问数据库，无额外网络请求
```

### 2.3 串行请求优化

```jsx
// ❌ 客户端瀑布式请求
'use client';
function Dashboard() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    fetch('/api/user').then(res => res.json()).then(setUser);
  }, []);

  useEffect(() => {
    if (user) { // 依赖 user → 等 user 加载完才请求 orders
      fetch(`/api/orders?userId=${user.id}`).then(res => res.json()).then(setOrders);
    }
  }, [user]);
}

// ✅ Server Component：并行获取
async function Dashboard() {
  const [user, orders] = await Promise.all([
    db.getUser(),
    db.getOrders(),
  ]);
  // 或者用 React 的 cache 函数
  return <DashboardUI user={user} orders={orders} />;
}
```

---

## 三、组件边界划分

### 3.1 划分原则

```
┌──────────────────────────────────────────────────────────────┐
│              何时用 Server vs Client                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  用 Server Components：                                       │
│  ✓ 数据获取（数据库、API）                                    │
│  ✓ 访问服务端资源（文件系统、环境变量）                        │
│  ✓ 敏感逻辑（API keys、token）                               │
│  ✓ 大依赖（markdown 解析、语法高亮）                          │
│  ✓ 静态展示（不需要交互的部分）                               │
│                                                              │
│  用 Client Components：                                       │
│  ✓ 事件处理（onClick、onChange）                              │
│  ✓ 状态和 hooks（useState、useEffect）                        │
│  ✓ 浏览器 API（localStorage、navigator）                     │
│  ✓ 第三方库需要 hooks 或浏览器环境                            │
│                                                              │
│  原则：Client 边界尽量往下推                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 边界下推示例

```jsx
// ❌ 整个页面标记为 client（把不需要交互的部分也变成了 client）
'use client';
function BlogPost({ post }) {
  return (
    <article>
      <h1>{post.title}</h1>
      <Markdown content={post.body} />  {/* 不需要交互 */}
      <AuthorBio author={post.author} />  {/* 不需要交互 */}
      <CommentSection postId={post.id} />  {/* 需要交互 */}
    </article>
  );
}

// ✅ 只把需要交互的部分标记为 client
function BlogPost({ post }) {
  return (
    <article>
      <h1>{post.title}</h1>
      <Markdown content={post.body} />       {/* Server */}
      <AuthorBio author={post.author} />     {/* Server */}
      <CommentSection postId={post.id} />    {/* Client */}
    </article>
  );
}

// CommentSection.tsx
'use client';
function CommentSection({ postId }) {
  const [comments, setComments] = useState([]);
  // 交互逻辑...
}
```

---

## 四、Server Actions

### 4.1 定义和使用

```jsx
// actions.ts
'use server';

export async function addToCart(productId) {
  const cart = await getCart();
  cart.items.push(productId);
  await saveCart(cart);
  revalidateTag('cart');
}

// AddToCartButton.tsx
'use client';
import { addToCart } from './actions';

function AddToCartButton({ productId }) {
  return (
    <button onClick={() => addToCart(productId)}>
      Add to Cart
    </button>
  );
}
```

### 4.2 表单处理

```jsx
// Server Action 直接在表单中使用
async function createPost(formData) {
  'use server';
  const title = formData.get('title');
  const body = formData.get('body');
  await db.insert('posts', { title, body });
  revalidatePath('/posts');
  redirect('/posts');
}

function CreatePostForm() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="body" required />
      <button type="submit">Create</button>
    </form>
  );
}
```

---

## 五、缓存策略组合

```jsx
// 路由：静态缓存
// 数据：定时重新验证
export default async function ProductPage({ params }) {
  const product = await fetch(
    `https://api.example.com/products/${params.id}`,
    { next: { revalidate: 3600 } }  // 1 小时
  );

  return (
    <div>
      <ProductDetail product={product} />
      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews productId={params.id} />
      </Suspense>
    </div>
  );
}

// 评论：动态获取（不缓存）
async function ProductReviews({ productId }) {
  const reviews = await fetch(
    `https://api.example.com/reviews?product=${productId}`,
    { cache: 'no-store' }  // 每次都请求
  );

  return <ReviewList reviews={reviews} />;
}
```

---

## 六、常见模式

### 6.1 组合模式：Server 包裹 Client

```jsx
// Server Component 获取数据，传递给 Client Component
async function ProductPage({ params }) {
  const product = await db.getProduct(params.id);

  return (
    <ProductDetail
      product={product}          // Server 获取的数据
      addToCart={addToCartAction} // Server Action
    />
  );
}

// Client Component 处理交互
'use client';
function ProductDetail({ product, addToCart }) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <QuantitySelector value={quantity} onChange={setQuantity} />
      <button onClick={() => addToCart(product.id, quantity)}>
        Add to Cart
      </button>
    </div>
  );
}
```

---

## 常见误区

1. **把整个页面标记为 'use client'**：这是最常见的错误。一旦顶层组件标记为 client，其下所有组件都变成客户端组件，即使它们不需要交互。Client 边界应该尽量往下推。
2. **Server Components 中使用 useState/useEffect**：Server Components 不能用 hooks。如果组件需要状态或副作用，必须标记为 'use client'。
3. **在 Client Component 中直接获取数据库数据**：Client Component 运行在浏览器中，不能直接访问数据库。数据获取应该在 Server Component 中完成，通过 props 传递给 Client Component。
4. **滥用 Server Actions 做所有数据变更**：Server Actions 适合表单提交和简单的数据变更。复杂的交互逻辑（拖拽、实时更新）还是应该用客户端状态 + API 路由。

## 工程建议

1. **默认用 Server Component，只在需要时标记 'use client'**：这是 App Router 的设计哲学。需要事件处理、hooks、浏览器 API 时才转为 Client Component。
2. **用 Promise.all 并行获取多个数据源**：Server Component 可以 await 多个数据请求，避免客户端的瀑布式请求。
3. **缓存策略按数据更新频率选择**：不常变的数据用默认缓存（构建时渲染），定时变化的数据用 revalidate，实时数据用 no-store。
4. **用 Suspense 包裹慢数据获取**：如果页面中有一个数据源特别慢，用 Suspense 包裹它，让其他部分先渲染。

## 动手练习

### 练习一：组件边界划分

1. 给一个博客页面划分 Server/Client 边界
2. 把不需要交互的部分改为 Server Components
3. 对比 JS 包大小变化

### 练习二：数据获取优化

1. 把客户端数据获取改为 Server Components
2. 用 Promise.all 并行获取多个数据源
3. 对比加载速度

### 练习三：Server Actions

1. 创建一个表单，使用 Server Action 处理提交
2. 添加 revalidatePath/revalidateTag 进行缓存更新
3. 测试表单提交和数据刷新

---

## 参考答案

### 练习一：组件边界划分

**思路**：给一个博客页面划分 Server/Client 边界，把不需要交互的部分改为 Server Components，对比 JS 包大小变化。

**答案**：

```jsx
// ❌ 优化前：整个页面是 Client Component
'use client';
import { useState, useEffect } from 'react';

function BlogPost({ slug }) {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);

  useEffect(() => {
    fetch(`/api/posts/${slug}`).then(r => r.json()).then(setPost);
    fetch(`/api/posts/${slug}/comments`).then(r => r.json()).then(setComments);
  }, [slug]);

  if (!post) return <div>Loading...</div>;

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
      <CommentSection comments={comments} />
    </article>
  );
}

// ✅ 优化后：Server Component + Client Component 边界下推
// app/posts/[slug]/page.tsx (Server Component)
async function BlogPost({ params }) {
  // 直接访问数据库，不需要 API 路由
  const post = await db.posts.findOne({ slug: params.slug });
  const comments = await db.comments.find({ postId: post.id });

  return (
    <article>
      <h1>{post.title}</h1>
      {/* 博客内容不需要交互 → Server Component */}
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
      {/* 评论区需要交互 → Client Component */}
      <CommentSection initialComments={comments} postId={post.id} />
    </article>
  );
}

// components/CommentSection.tsx (Client Component)
'use client';
import { useState } from 'react';

export function CommentSection({ initialComments, postId }) {
  const [comments, setComments] = useState(initialComments);
  // ... 交互逻辑
}
```

```markdown
JS 包大小对比：

优化前（整个页面是 Client Component）：
- 客户端 JS: 85KB (gzipped)
- 包含: React 状态管理、数据获取、评论交互、博客内容渲染

优化后（Server Component + Client 边界下推）：
- 客户端 JS: 25KB (gzipped)
- 只包含: 评论区交互逻辑
- 博客内容在服务端渲染，不发送 JS 到客户端

节省: 60KB (71%)
```

**要点**：
- Server Component 不发送 JS 到客户端，减少包大小
- Client 边界应该尽量往下推，只标记需要交互的组件
- 数据获取应该在 Server Component 中完成

### 练习二：数据获取优化

**思路**：把客户端数据获取改为 Server Components，用 Promise.all 并行获取多个数据源。

**答案**：

```jsx
// ❌ 优化前：客户端瀑布式请求
'use client';
function Dashboard() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetch('/api/user').then(r => r.json()).then(setUser)
      .then(() => fetch('/api/orders').then(r => r.json()).then(setOrders))
      .then(() => fetch('/api/notifications').then(r => r.json()).then(setNotifications));
  }, []);

  // 瀑布式: user → orders → notifications
  // 总时间: 300ms + 200ms + 150ms = 650ms
}

// ✅ 优化后：Server Component 并行获取
async function Dashboard() {
  // 并行获取所有数据
  const [user, orders, notifications] = await Promise.all([
    db.users.findOne({ id: userId }),
    db.orders.find({ userId }),
    db.notifications.find({ userId, unread: true }),
  ]);

  // 总时间: max(300ms, 200ms, 150ms) = 300ms

  return (
    <div>
      <UserInfo user={user} />
      <OrderList orders={orders} />
      <NotificationBell notifications={notifications} />
    </div>
  );
}
```

```markdown
性能对比：

优化前（瀑布式请求）：
- 总时间: 650ms（串行）
- 客户端发起 3 个请求，依次等待

优化后（并行获取）：
- 总时间: 300ms（并行）
- 服务端直接访问数据库，无网络开销
- 节省: 350ms (54%)

额外优势：
- 数据在服务端获取，减少客户端 JS
- 数据库查询在服务端网络（低延迟），不是客户端网络
- SEO 友好（内容在服务端渲染）
```

**要点**：
- Promise.all 并行获取多个数据源，取最长的那个作为总时间
- Server Component 可以直接访问数据库，不需要 API 路由
- 瀑布式请求是性能杀手，应该尽量并行化

### 练习三：Server Actions

**思路**：创建一个表单，使用 Server Action 处理提交，添加 revalidatePath/revalidateTag 进行缓存更新。

**答案**：

```jsx
// app/posts/create/page.tsx
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

async function createPost(formData) {
  'use server';

  const title = formData.get('title');
  const content = formData.get('content');

  // 服务端验证
  if (!title || title.length < 3) {
    return { error: '标题至少 3 个字符' };
  }

  // 写入数据库
  await db.posts.create({ title, content });

  // 使博客列表缓存失效
  revalidatePath('/posts');
  // 或用 tag: revalidateTag('posts');

  // 重定向到新文章
  redirect(`/posts/${newPost.slug}`);
}

function CreatePostForm() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="标题" required minLength={3} />
      <textarea name="content" placeholder="内容" required />
      <button type="submit">发布</button>
    </form>
  );
}
```

```markdown
功能验证：

1. 填写表单并提交
2. Server Action 在服务端执行：
   - 验证数据
   - 写入数据库
   - 调用 revalidatePath('/posts')
3. 页面重定向到新文章
4. 访问 /posts → 列表已更新（缓存已失效）

对比传统 API 路由：
- 传统方式: 客户端 → API 路由 → 数据库 → 返回 → 客户端更新
- Server Action: 表单直接提交到服务端 → 数据库 → 重定向
- Server Action 减少了一次客户端到服务端的往返
```

**要点**：
- Server Action 用 'use server' 标记，在服务端执行
- revalidatePath/revalidateTag 使相关缓存失效
- redirect 在 Server Action 中可以直接使用

---

## 小结

1. **Server Components**：不发送 JS 到客户端，直接访问服务端资源
2. **Client Components**：需要交互、状态、浏览器 API 时使用
3. **边界下推**：Client 边界尽量往下推，减少客户端 JS
4. **数据获取**：Server Components 可以并行获取，避免瀑布式请求
5. **Server Actions**：服务端处理数据变更，配合缓存重新验证
6. **组合模式**：Server 获取数据 → 传递给 Client 处理交互

---

## 下一课预告

下一课是阶段实战——你将优化一个 Dashboard 页面，使筛选、搜索、表格滚动和输入交互更顺畅。
