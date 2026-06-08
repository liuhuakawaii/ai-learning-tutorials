# 第6课：Server Components 与缓存

> **课程定位**：理解 React Server Components 对性能的影响和正确的使用方式
> **前置知识**：了解 Next.js App Router 和 React 基础
> **预计时长**：35 分钟

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
