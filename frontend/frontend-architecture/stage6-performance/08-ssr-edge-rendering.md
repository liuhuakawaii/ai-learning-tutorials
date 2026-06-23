# 08. 服务端渲染与边缘渲染 —— SSR/SSG/ISR/ESR 原理与选型

> 客户端渲染解决不了所有问题——了解什么时候需要在服务端生成 HTML

## 本课目标

- 理解 SSR、SSG、ISR、ESR 的原理和差异
- 掌握各种渲染策略的适用场景和选型依据
- 了解 Next.js 和 Nuxt 中的实现方式
- 理解 hydration 的原理和性能影响

## 为什么需要服务端渲染

### 客户端渲染（CSR）的问题

```
CSR 的加载过程：
1. 浏览器请求 HTML → 收到空的 shell（<div id="app"></div>）
2. 下载 JS bundle
3. 解析 JS
4. 执行 JS，请求 API 数据
5. 渲染 HTML
6. 用户看到内容

问题：
- 步骤 2-5 期间用户看到白屏
- 搜索引擎爬虫可能看不到内容（SEO 问题）
- 首屏性能依赖 JS 下载和执行速度
```

```
SSR 的加载过程：
1. 浏览器请求 HTML → 服务器生成完整 HTML 返回
2. 用户立即看到内容（FCP 快）
3. 下载 JS bundle
4. 执行 JS，接管页面（hydration）
5. 页面可交互

优势：
- 首屏内容出现快（不需要等 JS 下载执行）
- 对 SEO 友好（爬虫能直接看到完整 HTML）
- 在弱网/低端设备上体验更好
```

## 渲染策略对比

```
┌──────────┬────────────────────────────────────────────────────────┐
│  策略     │  描述                                                  │
├──────────┼────────────────────────────────────────────────────────┤
│  CSR     │  客户端渲染：HTML 在浏览器中生成                        │
│  SSR     │  服务端渲染：每次请求在服务器生成 HTML                   │
│  SSG     │  静态站点生成：构建时生成 HTML，部署到 CDN               │
│  ISR     │  增量静态再生：SSG + 后台按需重新生成                    │
│  ESR     │  边缘服务端渲染：在 CDN 边缘节点生成 HTML               │
└──────────┴────────────────────────────────────────────────────────┘
```

### SSR（Server-Side Rendering）

```
每次用户请求：
  浏览器 → 服务器 → 服务器查询数据 → 服务器渲染 HTML → 返回浏览器

优点：
  - 首屏快（HTML 包含完整内容）
  - SEO 友好
  - 动态内容（每次请求都是最新数据）

缺点：
  - 服务器负载高（每次请求都要渲染）
  - TTFB 可能慢（服务器渲染需要时间）
  - 需要服务器基础设施
  - hydration 成本（JS 下载后要"接管"页面）

适用场景：
  - 内容频繁变化的页面（商品详情、社交动态）
  - 需要 SEO 的动态页面
  - 根据用户身份展示不同内容的页面
```

```javascript
// Next.js SSR 示例
// pages/products/[id].tsx
export async function getServerSideProps(context) {
  const { id } = context.params;
  const product = await fetchProduct(id);
  
  return {
    props: {
      product,
    },
  };
}

export default function ProductDetail({ product }) {
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <span>¥{product.price}</span>
    </div>
  );
}
```

### SSG（Static Site Generation）

```
构建时：
  代码 + 数据 → 生成静态 HTML 文件 → 部署到 CDN

用户请求：
  浏览器 → CDN → 直接返回静态 HTML（极快）

优点：
  - 极快的响应速度（CDN 边缘节点直接返回）
  - 零服务器负载（纯静态文件）
  - 高可用（CDN 天然高可用）
  - 低成本（不需要服务器）

缺点：
  - 内容在构建时确定，更新需要重新构建部署
  - 不适合频繁变化的内容
  - 页面数量多时构建时间长

适用场景：
  - 博客、文档站
  - 营销页面、落地页
  - 内容变化不频繁的页面
```

```javascript
// Next.js SSG 示例
// pages/about.tsx
export async function getStaticProps() {
  const teamData = await fetchTeamData();
  
  return {
    props: {
      teamData,
    },
  };
}

// pages/blog/[slug].tsx
export async function getStaticPaths() {
  const posts = await fetchAllPosts();
  
  return {
    paths: posts.map(post => ({
      params: { slug: post.slug },
    })),
    fallback: 'blocking',  // 未预渲染的页面在首次请求时生成
  };
}

export async function getStaticProps({ params }) {
  const post = await fetchPost(params.slug);
  
  return {
    props: { post },
    revalidate: false,  // 不重新验证
  };
}
```

### ISR（Incremental Static Regeneration）

```
ISR = SSG + 后台按需重新生成

原理：
1. 首次请求：生成静态 HTML（和 SSG 一样）
2. 缓存期内：直接返回缓存的 HTML
3. 缓存过期后的第一次请求：返回旧的 HTML，
   同时在后台触发重新生成
4. 重新生成完成后，新的 HTML 替换旧的

优点：
  - 既有 SSG 的速度
  - 又能保持内容相对新鲜
  - 不需要完整重新构建

缺点：
  - 缓存过期后第一次请求看到的可能是旧内容
  - 重新生成期间旧内容仍然可用
  - 需要支持 ISR 的部署平台

适用场景：
  - 电商商品页面（价格/库存偶尔变化）
  - 新闻文章（发布后偶尔更新）
  - 用户主页（内容变化不频繁）
```

```javascript
// Next.js ISR 示例
// pages/products/[id].tsx
export async function getStaticPaths() {
  // 只预渲染热门商品
  const hotProducts = await fetchHotProducts();
  
  return {
    paths: hotProducts.map(p => ({
      params: { id: p.id },
    })),
    fallback: 'blocking',  // 其他商品首次请求时生成
  };
}

export async function getStaticProps({ params }) {
  const product = await fetchProduct(params.id);
  
  return {
    props: { product },
    revalidate: 60,  // 60 秒后可以在后台重新生成
  };
}
```

### ESR（Edge Server Rendering）

```
ESR = SSR + CDN 边缘节点

原理：
1. 用户请求到达 CDN 边缘节点
2. 边缘节点执行渲染逻辑（运行 JS）
3. 边缘节点查询数据（从缓存或源站）
4. 边缘节点生成 HTML 并返回

优点：
  - SSR 的首屏优势
  - CDN 的低延迟（用户离边缘节点近）
  - 比传统 SSR 更低的 TTFB

缺点：
  - 边缘运行时能力有限（V8 Isolates，不是完整 Node.js）
  - 不是所有 Node.js API 都可用
  - 冷启动问题
  - 调试困难

适用场景：
  - 全球用户分布的网站
  - 对 TTFB 要求极高的场景
  - 渲染逻辑相对简单的页面
```

```javascript
// Cloudflare Workers ESR 示例
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // 在边缘节点渲染 React 组件
    const html = ReactDOMServer.renderToString(
      <App url={url} />
    );
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  },
};

// Next.js Middleware + Edge Runtime
// middleware.ts
export const config = {
  runtime: 'edge',
};

export default function middleware(request) {
  // 在边缘节点执行的逻辑
  const country = request.geo?.country || 'US';
  
  // 可以在边缘做 A/B 测试、地理位置重定向等
}
```

## Hydration 的问题与优化

### 什么是 Hydration

```
SSR 返回的 HTML 是"静态的"——它没有事件监听器、没有交互能力。

Hydration 是让静态 HTML "活过来"的过程：
1. 浏览器下载 JS bundle
2. React/Vue 在客户端重新执行组件函数
3. 生成虚拟 DOM，和已有的 HTML 对比（而不是创建新 DOM）
4. 绑定事件监听器
5. 页面变得可交互

问题：
- Hydration 期间主线程被占用
- 用户看到页面了但点击没反应（TTI 慢于 FCP）
- 所有组件都要 hydration，即使很多组件不需要交互
```

### 部分 Hydration（Partial Hydration）

```jsx
// React Server Components（Next.js 13+）
// 服务端组件不需要 hydration

// app/page.tsx（默认是 Server Component）
async function ProductPage({ params }) {
  const product = await fetchProduct(params.id);
  
  return (
    <div>
      {/* 这部分在服务端渲染，不需要 hydration */}
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <ProductImages images={product.images} />
      
      {/* 这部分是 Client Component，需要 hydration */}
      <AddToCartButton productId={product.id} />
    </div>
  );
}

// app/components/AddToCartButton.tsx
'use client';  // 标记为 Client Component

function AddToCartButton({ productId }) {
  const [loading, setLoading] = useState(false);
  
  return (
    <button onClick={() => addToCart(productId)}>
      加入购物车
    </button>
  );
}
```

### 选择性 Hydration

```jsx
// React.lazy + Suspense 实现选择性加载
import { lazy, Suspense } from 'react';

// 非首屏的交互组件延迟加载和 hydration
const Comments = lazy(() => import('./Comments'));
const ShareButtons = lazy(() => import('./ShareButtons'));

function ArticlePage({ article }) {
  return (
    <div>
      {/* 首屏内容立即 hydration */}
      <h1>{article.title}</h1>
      <div>{article.content}</div>
      
      {/* 非首屏组件延迟 hydration */}
      <Suspense fallback={<div>加载评论...</div>}>
        <Comments articleId={article.id} />
      </Suspense>
      
      <Suspense fallback={<div>加载分享按钮...</div>}>
        <ShareButtons url={article.url} />
      </Suspense>
    </div>
  );
}
```

## 选型决策框架

```
问自己这些问题：

1. 内容需要 SEO 吗？
   不需要 → CSR
   需要 → 继续

2. 内容变化频率？
   构建时确定 → SSG
   偶尔变化 → ISR
   每次请求可能不同 → SSR

3. 用户分布？
   单一地区 → 传统 SSR
   全球分布 → ESR

4. 页面数量？
   少量页面 → SSG / ISR
   大量页面（10 万+）→ ISR（避免构建时间过长）

5. 交互复杂度？
   纯展示 → SSG / ISR
   复杂交互 → SSR + 选择性 Hydration
   类似 App → CSR
```

```
典型场景选型：

博客/文档站         → SSG
营销落地页          → SSG
电商商品列表        → ISR（revalidate: 60）
电商商品详情        → ISR（revalidate: 300）
用户仪表盘         → CSR（不需要 SEO，内容私有）
社交动态流          → SSR（内容实时变化）
新闻网站           → ISR（revalidate: 60）
全球 SaaS 产品      → ESR
```

## 本课小结

```
渲染策略速查表：

CSR：白屏时间长，SEO 差，但最简单
SSR：首屏快，SEO 好，但服务器负载高
SSG：最快，零服务器成本，但内容静态
ISR：SSG 的速度 + 内容可更新，但有缓存延迟
ESR：SSR 的首屏 + CDN 的延迟，但边缘运行时有限制

核心取舍：
  性能 vs 新鲜度 vs 成本 vs 复杂度

没有银弹——大多数网站会混合使用多种策略。
```

## 练习

### 练习一：选择渲染策略

为以下页面选择最合适的渲染策略，并说明理由：

1. 一个技术博客的文章页面
2. 一个电商网站的搜索结果页
3. 一个 SaaS 产品的用户管理后台
4. 一个新闻网站的首页
5. 一个全球化 SaaS 产品的营销页面

### 练习二：实现 ISR 缓存策略

你正在开发一个电商网站的商品详情页，需要实现以下需求：

- 热门商品（Top 1000）在构建时预渲染
- 其他商品首次访问时生成
- 商品价格和库存每 5 分钟更新一次
- 用户评论实时显示

请设计这个页面的渲染策略，说明用 SSR、SSG 还是 ISR，以及具体的实现方式。

---

## 参考答案

### 练习一

```
1. 技术博客文章页面
   策略：SSG
   理由：
   - 内容发布后很少变化
   - 需要 SEO（技术文章是搜索引擎流量的重要来源）
   - 博客文章数量有限，构建时间可控
   - CDN 直接返回，速度最快
   - 可选：如果文章偶尔更新，用 ISR（revalidate: 3600）

2. 电商搜索结果页
   策略：SSR 或 CSR（取决于是否需要 SEO）
   理由：
   - 搜索结果是动态的（每次查询不同）
   - 商品库存/价格实时变化
   - 搜索组合太多，无法预渲染
   - 如果需要 SEO → SSR
   - 如果不需要 SEO（如登录后的搜索）→ CSR

3. SaaS 用户管理后台
   策略：CSR
   理由：
   - 内容完全私有，不需要 SEO
   - 数据实时变化
   - 交互复杂（表单、表格、操作确认）
   - CSR 最简单，不需要服务器渲染
   - 可以用骨架屏优化加载体验

4. 新闻网站首页
   策略：ISR
   理由：
   - 首页内容需要 SEO
   - 新闻内容会更新，但不是每秒都变
   - 首页流量大，需要 CDN 缓存
   - revalidate: 60（1 分钟更新一次）
   - 保证大部分请求命中缓存，同时内容相对新鲜

5. 全球化 SaaS 营销页面
   策略：SSG 或 ESR
   理由：
   - 营销页面内容变化不频繁 → SSG 足够
   - 如果需要根据地区展示不同内容 → ESR
   - 如果只是简单的多语言 → SSG + 语言路由
   - 营销页面需要极致的加载速度
```

### 练习二

```javascript
// pages/products/[id].tsx

// 策略：ISR + SSR 混合

// 热门商品：构建时预渲染
export async function getStaticPaths() {
  const hotProducts = await fetchHotProductIds(1000);
  
  return {
    paths: hotProducts.map(id => ({
      params: { id: String(id) },
    })),
    fallback: 'blocking',  // 非热门商品首次请求时生成
  };
}

// 商品基本信息：ISR（5 分钟更新）
export async function getStaticProps({ params }) {
  const product = await fetchProduct(params.id);
  
  if (!product) {
    return { notFound: true };
  }
  
  return {
    props: {
      // 只传递不频繁变化的数据
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images,
        specs: product.specs,
      },
    },
    revalidate: 300,  // 5 分钟后可以在后台重新生成
  };
}

// 价格和库存：客户端实时获取
function ProductPage({ product }) {
  // 价格和库存在客户端实时获取
  const { price, stock } = useRealtimePrice(product.id);
  
  // 评论：客户端获取（实时）
  const { data: comments } = useComments(product.id);
  
  return (
    <div>
      <ProductImages images={product.images} />
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      
      {/* 实时价格 */}
      <PriceDisplay price={price} stock={stock} />
      
      {/* 购买按钮（客户端组件） */}
      <AddToCartButton productId={product.id} disabled={stock === 0} />
      
      {/* 商品详情（静态） */}
      <ProductSpecs specs={product.specs} />
      
      {/* 评论（客户端获取，可延迟加载） */}
      <Suspense fallback={<CommentsSkeleton />}>
        <CommentSection comments={comments} />
      </Suspense>
    </div>
  );
}

// 实时价格 Hook
function useRealtimePrice(productId) {
  const [data, setData] = useState({ price: null, stock: null });
  
  useEffect(() => {
    // 首次获取
    fetchPrice(productId).then(setData);
    
    // 每 30 秒更新一次
    const interval = setInterval(() => {
      fetchPrice(productId).then(setData);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [productId]);
  
  return data;
}
```

```
策略说明：

商品基本信息（名称、描述、图片、规格）：
  - ISR，revalidate: 300（5 分钟）
  - 变化不频繁，可以接受短暂延迟
  - CDN 缓存，速度快

价格和库存：
  - 客户端实时获取
  - 变化频繁，需要实时性
  - 首屏先显示 ISR 缓存的价格，客户端更新后刷新
  - 用 SWR 或 React Query 管理缓存

评论：
  - 客户端获取
  - 实时性要求高
  - 非首屏内容，可以延迟加载
  - 用 Suspense 包裹，不影响首屏渲染

效果：
  - 首屏渲染速度快（ISR 缓存命中）
  - SEO 友好（HTML 包含完整商品信息）
  - 价格实时准确（客户端更新）
  - 评论实时显示（客户端获取）
```

## 下一步

完成本课后，继续学习 [09. 性能预算与持续监控](./09-performance-budget-monitoring.md)。
