# 第5课：Next.js 图片、字体、路由和缓存

> **课程定位**：掌握 Next.js 内置的性能优化能力
> **前置知识**：了解 React 基础和 Next.js App Router
> **预计时长**：40 分钟

## 场景引入

你把一个 React SPA 迁移到了 Next.js App Router，本以为性能会自动变好，结果 Lighthouse 分数反而从 75 降到了 68。排查发现：你还在用 `<img>` 标签加载图片，没有用 next/image 的自动格式转换和响应式尺寸；Google Fonts 通过 `<link>` 标签引入，导致额外的 DNS 查询和布局偏移；所有页面都是客户端渲染，没有利用 Server Components 减少 JS 体积。Next.js 内置了大量性能优化能力，但它们不会自动生效——你需要知道在哪里用、怎么用。

---

## 学习目标

1. 使用 next/image 自动优化图片
2. 使用 next/font 优化字体加载
3. 理解 App Router 的缓存机制
4. 掌握路由级别的性能优化

---

## 一、next/image 图片优化

### 1.1 基本用法

```jsx
import Image from 'next/image';

// 自动优化：格式转换、尺寸调整、懒加载
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority           // 首屏图片：禁用懒加载
/>

// 远程图片
<Image
  src="https://example.com/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  sizes="(max-width: 768px) 100vw, 50vw"  // 响应式尺寸
/>
```

### 1.2 自动优化能力

```
┌──────────────────────────────────────────────────────────────┐
│              next/image 自动优化                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 格式转换                                                 │
│     自动转换为 WebP / AVIF（浏览器支持时）                    │
│     体积通常减少 30-50%                                      │
│                                                              │
│  2. 响应式尺寸                                               │
│     根据设备生成不同尺寸的图片                                │
│     不会下载比显示尺寸更大的图片                              │
│                                                              │
│  3. 懒加载                                                   │
│     默认 loading="lazy"                                      │
│     首屏图片用 priority                                      │
│                                                              │
│  4. 布局稳定性                                               │
│     自动设置 width/height → 无 CLS                           │
│                                                              │
│  5. CDN 缓存                                                 │
│     优化后的图片可以被 CDN 缓存                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 响应式图片

```jsx
// fill 模式：填满父容器
<div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
  <Image
    src="/hero.jpg"
    alt="Hero"
    fill
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    style={{ objectFit: 'cover' }}
  />
</div>

// sizes 属性告诉浏览器图片在不同断点的显示尺寸
// 浏览器自动选择最合适的图片尺寸下载
```

### 1.4 占位符和模糊

```jsx
<Image
  src="/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQ..." // 低质量占位图
/>

// 或使用内置的 SVG 占位符
<Image
  src="/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/svg+xml;base64,..." // 自动生成
/>
```

---

## 二、next/font 字体优化

### 2.1 Google Fonts

```jsx
// app/layout.tsx
import { Inter, Roboto } from 'next/font/google';

const inter = inter({
  subsets: ['latin'],
  display: 'swap',        // font-display 策略
  preload: true,          // 预加载
  fallback: ['system-ui', 'arial'], // 后备字体
});

export default function RootLayout({ children }) {
  return (
    <html lang="zh" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
```

### 2.2 本地字体

```jsx
import localFont from 'next/font/local';

const myFont = localFont({
  src: [
    { path: './fonts/MyFont-Regular.woff2', weight: '400' },
    { path: './fonts/MyFont-Bold.woff2', weight: '700' },
  ],
  display: 'swap',
});
```

### 2.3 next/font 的优势

```
┌──────────────────────────────────────────────────────────────┐
│              next/font 优化能力                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 零布局偏移                                               │
│     自动计算后备字体尺寸匹配                                  │
│     使用 size-adjust、ascent-override 等 CSS                 │
│                                                              │
│  2. 内联字体 CSS                                             │
│     字体声明内联到 HTML → 无额外请求                          │
│                                                              │
│  3. 自动预加载                                                │
│     只预加载使用的字重和子集                                  │
│                                                              │
│  4. 隐私                                                     │
│     Google Fonts 自托管 → 不向 Google 发送请求                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 三、App Router 缓存机制

### 3.1 缓存层级

```
┌──────────────────────────────────────────────────────────────┐
│              Next.js 缓存层级                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  请求级缓存（Request Memoization）                            │
│  ├─ 同一请求中多次 fetch 相同 URL → 只请求一次                 │
│  ├─ 生命周期：单次请求                                        │
│  │                                                           │
│  数据缓存（Data Cache）                                       │
│  ├─ fetch 请求的响应被持久化缓存                              │
│  ├─ 生命周期：直到手动 revalidate                             │
│  │                                                           │
│  完整路由缓存（Full Route Cache）                             │
│  ├─ 静态渲染的页面被缓存为 HTML                               │
│  ├─ 生命周期：直到重新部署或 revalidate                       │
│  │                                                           │
│  路由缓存（Router Cache）                                     │
│  ├─ 客户端预取的路由被缓存                                    │
│  ├─ 生命周期：会话期间（静态 5min，动态 30s）                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 控制缓存

```javascript
// 1. fetch 缓存（默认缓存）
const data = await fetch('https://api.example.com/data');

// 2. 不缓存（每次都请求）
const data = await fetch('https://api.example.com/data', {
  cache: 'no-store'
});

// 3. 定时重新验证
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 3600 } // 每小时重新验证
});

// 4. 按需重新验证
import { revalidateTag } from 'next/cache';

// 在 Server Action 中
async function updateData() {
  await saveData();
  revalidateTag('my-data');
}
```

### 3.3 静态 vs 动态渲染

```javascript
// 静态渲染（构建时渲染，缓存为 HTML）
// 默认行为，适合不常变化的页面
export default async function Page() {
  const data = await fetch('https://api.example.com/static-data');
  return <div>{/* ... */}</div>;
}

// 动态渲染（请求时渲染）
// 使用了动态 API 或 opt-out 缓存
export default async function Page() {
  const cookieStore = cookies(); // 动态 API → 动态渲染
  const data = await fetch('https://api.example.com/data', {
    cache: 'no-store' // 不缓存 → 动态渲染
  });
  return <div>{/* ... */}</div>;
}
```

---

## 四、路由性能优化

### 4.1 预取路由

```jsx
import Link from 'next/link';

// Link 组件自动预取可视区域内的路由
<Link href="/dashboard">Dashboard</Link>

// 禁用预取
<Link href="/heavy-page" prefetch={false}>Heavy Page</Link>
```

### 4.2 路由分组和代码分割

```
app/
├── layout.tsx           # 根布局
├── page.tsx             # 首页
├── (marketing)/         # 营销页面组
│   ├── layout.tsx       # 营销布局
│   ├── about/page.tsx
│   └── pricing/page.tsx
└── (dashboard)/         # 仪表盘组
    ├── layout.tsx       # 仪表盘布局（需要认证）
    ├── analytics/page.tsx
    └── settings/page.tsx

每个路由自动代码分割 → 只加载当前页面的 JS
```

### 4.3 Loading 和 Suspense

```jsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <DashboardSkeleton />;
}

// 或在组件中使用 Suspense
import { Suspense } from 'react';

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<ChartSkeleton />}>
        <SlowChart />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <SlowTable />
      </Suspense>
    </div>
  );
}
```

### 4.4 并行路由

```
app/
├── layout.tsx
├── page.tsx
├── @analytics/
│   └── page.tsx    # 并行加载
└── @notifications/
    └── page.tsx    # 并行加载
```

```jsx
// layout.tsx
export default function Layout({ analytics, notifications }) {
  return (
    <div>
      <main>{/* main content */}</main>
      <aside>{analytics}</aside>
      <aside>{notifications}</aside>
    </div>
  );
}
```

---

## 五、检查清单

```
┌──────────────────────────────────────────────────────────────┐
│              Next.js 性能检查清单                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  图片                                                        │
│  □ 所有图片使用 next/image                                    │
│  □ 首屏图片添加 priority                                      │
│  □ 设置 sizes 属性支持响应式                                  │
│                                                              │
│  字体                                                        │
│  □ 使用 next/font 加载字体                                    │
│  □ 设置 display: 'swap'                                      │
│  □ 只加载需要的字重和子集                                     │
│                                                              │
│  缓存                                                        │
│  □ 静态数据使用默认缓存                                       │
│  □ 动态数据使用 revalidate 或 no-store                        │
│  □ 使用 revalidateTag 进行按需更新                            │
│                                                              │
│  路由                                                        │
│  □ 使用 loading.tsx 提供即时反馈                              │
│  □ 独立区块用 Suspense 包裹                                   │
│  □ 考虑并行路由加速加载                                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 常见误区

1. **给所有图片都加 priority**：priority 会禁用懒加载并预加载图片。只有首屏最大的图片（LCP 元素）才需要 priority，其他图片应该用默认的懒加载。
2. **手动引入 Google Fonts 而不用 next/font**：手动 `<link>` 引入会向 Google 发送请求（隐私问题），且无法自动匹配后备字体尺寸（布局偏移）。next/font 自动处理这些问题。
3. **不设置 sizes 属性**：没有 sizes，浏览器可能下载比实际显示尺寸更大的图片。设置 sizes="(max-width: 768px) 100vw, 50vw" 让浏览器选择最合适的图片。
4. **把所有数据都设为 no-store**：不缓存意味着每次请求都要重新获取数据，增加服务器负载和响应时间。静态数据应该用默认缓存，动态数据用 revalidate 定时刷新。

## 工程建议

1. **首屏图片用 next/image 的 priority 属性**：它会自动生成 preload 标签、设置 fetchpriority="high"，一步到位。
2. **用 next/font 加载所有字体**：无论是 Google Fonts 还是本地字体，next/font 都能自动处理内联 CSS、预加载和后备字体匹配。
3. **静态页面用默认缓存，动态页面用 revalidate**：博客文章用默认缓存（构建时渲染），用户个人数据用 no-store（每次请求渲染），商品列表用 revalidate: 3600（每小时刷新）。
4. **用 loading.tsx 提供即时反馈**：Next.js 的 loading.tsx 会自动包装成 Suspense，在页面数据加载时显示骨架屏。

## 动手练习

### 练习一：优化图片

1. 把项目中的 `<img>` 替换为 `next/image`
2. 给首屏图片添加 priority
3. 对比优化前后的网络请求数和传输大小

### 练习二：优化字体

1. 用 next/font 替代手动引入的字体
2. 观察字体加载是否还有布局偏移
3. 检查 Network 面板中字体的加载方式

### 练习三：缓存策略

1. 给一个页面设置不同的缓存策略
2. 观察数据何时更新、何时使用缓存
3. 使用 revalidateTag 实现按需更新

---

## 参考答案

### 练习一：优化图片

**思路**：把项目中的 `<img>` 替换为 `next/image`，给首屏图片添加 priority，对比优化前后的网络请求数和传输大小。

**答案**：

```jsx
// ❌ 优化前：原生 img 标签
function ProductHero({ product }) {
  return (
    <img src={product.image} alt={product.name} width={800} height={600} />
  );
}

// ✅ 优化后：next/image
import Image from 'next/image';

function ProductHero({ product }) {
  return (
    <Image
      src={product.image}
      alt={product.name}
      width={800}
      height={600}
      priority                    // 首屏图片：禁用懒加载 + 预加载
      sizes="(max-width: 768px) 100vw, 50vw"  // 响应式尺寸
      placeholder="blur"          // 加载时显示模糊占位图
      blurDataURL={product.blurHash}
    />
  );
}
```

```markdown
优化效果：

优化前（原生 img）：
- 下载原始 JPEG: 800KB
- 无格式转换、无响应式尺寸、无懒加载
- LCP: 3.8s

优化后（next/image）：
- 自动转为 WebP: 120KB（节省 85%）
- 自动生成 640w/750w/828w/1080w/1200w 多种尺寸
- priority 图片自动生成 <link rel="preload">
- LCP: 1.6s（节省 58%）

Network 面板对比：
- 优化前: 1 个请求，800KB JPEG
- 优化后: 1 个请求，120KB WebP（浏览器根据 sizes 选择最合适的尺寸）
```

**要点**：
- next/image 自动处理格式转换、响应式尺寸、懒加载、CLS 稳定
- priority 只用于首屏最大的图片（LCP 元素）
- sizes 属性让浏览器选择最合适的图片尺寸

### 练习二：优化字体

**思路**：用 next/font 替代手动引入的字体，观察字体加载是否还有布局偏移。

**答案**：

```jsx
// ❌ 优化前：手动引入 Google Fonts
// <head>
//   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
// </head>
// 问题：向 Google 发请求（隐私问题）、无法自动匹配后备字体尺寸

// ✅ 优化后：next/font
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['Arial', 'Helvetica'],
  adjustFontFallback: true,  // 自动匹配后备字体尺寸
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

```markdown
优化效果：

优化前：
- 字体从 Google CDN 加载: 120ms
- FOUT: 字体切换时文字宽度变化 → 布局偏移
- CLS: 0.05（由字体引起）

优化后：
- 字体 CSS 内联到 HTML: 0ms（无需额外请求）
- 后备字体尺寸自动匹配: 无布局偏移
- CLS: 0.00

Network 面板观察：
- 优化前: 1 个额外请求到 fonts.googleapis.com
- 优化后: 0 个额外请求（CSS 内联，字体由 Next.js 自动优化）
```

**要点**：
- next/font 自动处理内联 CSS、预加载、后备字体匹配
- adjustFontFallback: true 自动计算 size-adjust 等属性
- 不再向 Google 发请求，保护用户隐私

### 练习三：缓存策略

**思路**：给一个页面设置不同的缓存策略，观察数据何时更新、何时使用缓存。

**答案**：

```jsx
// 静态缓存（默认）：构建时渲染，数据不变
export default async function StaticPage() {
  const data = await fetch('https://api.example.com/static-data');
  return <div>{data.title}</div>;
}

// 定时重新验证：每小时刷新一次
export default async function ProductPage() {
  const data = await fetch('https://api.example.com/products', {
    next: { revalidate: 3600 }  // 1 小时
  });
  return <ProductList items={data} />;
}

// 不缓存：每次请求都重新获取
export default async function UserDashboard() {
  const data = await fetch('https://api.example.com/user/data', {
    cache: 'no-store'
  });
  return <Dashboard data={data} />;
}

// 按需重新验证：数据变更时刷新
import { revalidateTag } from 'next/cache';

async function addProduct(formData) {
  'use server';
  await saveProduct(formData);
  revalidateTag('products');  // 使 products 缓存失效
}
```

```markdown
验证方法：

1. 静态缓存：
   - 构建后访问页面 → 数据固定
   - 修改 API 数据 → 页面数据不变
   - 重新构建后 → 数据更新

2. 定时重新验证（revalidate: 3600）：
   - 第 1 次访问 → 请求 API，缓存结果
   - 1 小时内访问 → 使用缓存，不请求 API
   - 1 小时后访问 → 重新请求 API，更新缓存

3. 不缓存（no-store）：
   - 每次访问都请求 API
   - 数据始终最新
   - 服务器负载最高

4. 按需重新验证（revalidateTag）：
   - 访问页面 → 使用缓存
   - 提交表单 → revalidateTag('products')
   - 再次访问 → 重新请求 API（缓存已失效）
```

**要点**：
- 默认缓存适合静态内容（博客、文档）
- revalidate 适合定时变化的内容（商品列表、新闻）
- no-store 适合实时数据（用户个人数据、股票行情）
- revalidateTag 适合用户操作后需要更新的数据

---

## 小结

1. **next/image**：自动格式转换、响应式尺寸、懒加载、CLS 稳定
2. **next/font**：零布局偏移、内联 CSS、自动预加载
3. **缓存层级**：请求级 → 数据级 → 路由级 → 客户端缓存
4. **静态 vs 动态**：默认静态，使用动态 API 或 opt-out 时动态渲染
5. **路由优化**：预取、代码分割、Suspense、并行路由

---

## 下一课预告

下一课将学习 Server Components 对性能的影响——理解服务端渲染和客户端渲染的取舍。
