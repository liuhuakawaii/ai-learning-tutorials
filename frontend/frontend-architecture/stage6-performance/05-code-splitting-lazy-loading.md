# 05. 代码分割与懒加载最佳实践 —— React.lazy/Suspense、defineAsyncComponent、路由级分割

> 首屏只加载首屏需要的代码——把"以后再说"的代码留到以后再加载

## 本课目标

- 理解代码分割的原理和必要性
- 掌握 React.lazy/Suspense 的使用和边界处理
- 掌握 Vue defineAsyncComponent 的使用
- 理解路由级分割和组件级分割的适用场景
- 掌握预加载策略，避免懒加载带来的延迟感知

## 为什么需要代码分割

一个典型的 SPA 在构建后会生成一个大的 JS bundle：

```
没有代码分割：
app.js (800KB gzip)
  ├── React/Vue 运行时    (40KB)
  ├── 路由和状态管理       (30KB)
  ├── 首页组件             (50KB)
  ├── 商品列表页组件       (80KB)
  ├── 商品详情页组件       (100KB)
  ├── 用户中心组件         (120KB)
  ├── 管理后台组件         (150KB)
  ├── 工具库 (lodash等)    (80KB)
  └── 第三方 SDK          (150KB)

用户访问首页时，需要下载全部 800KB，即使他可能永远不会访问管理后台。
```

```
代码分割后：
vendor.js (120KB)    ← 框架 + 第三方库（不常变化，可长期缓存）
app.js (80KB)        ← 公共代码 + 路由 + 首页
home.js (50KB)       ← 首页专属代码
products.js (80KB)   ← 商品列表页
product-detail.js (100KB) ← 商品详情页
user-center.js (120KB)    ← 用户中心（按需加载）
admin.js (150KB)           ← 管理后台（按需加载）

用户访问首页时，只需要下载 120 + 80 + 50 = 250KB。
其他页面的代码在用户访问对应路由时才加载。
```

## 路由级代码分割

路由级分割是最常见、收益最大的分割方式。每个路由对应的组件独立成一个 chunk。

### React 路由分割

```jsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// lazy 接受一个返回 Promise 的函数
// 这个函数在组件首次渲染时才执行
const Home = lazy(() => import('./pages/Home'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const UserCenter = lazy(() => import('./pages/UserCenter'));
const Admin = lazy(() => import('./pages/Admin'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/user" element={<UserCenter />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

function Loading() {
  return <div className="loading-spinner">加载中...</div>;
}
```

**Suspense 的工作原理**：

```
当 lazy 组件首次渲染时：
1. React 尝试渲染 <Home />
2. Home 还没加载完成，抛出一个 Promise
3. React 捕获这个 Promise，渲染最近的 Suspense 的 fallback
4. Promise 完成后，React 重新渲染，显示真正的 Home 组件

注意：Suspense 必须包裹 lazy 组件，否则 React 会报错。
多个 lazy 组件可以共用一个 Suspense。
```

**错误处理**：

```jsx
import { lazy, Suspense } from 'react';

// 方式一：ErrorBoundary
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  render() {
    if (this.state.hasError) {
      return <div>加载失败，请刷新页面</div>;
    }
    return this.props.children;
  }
}

// 使用
function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

// 方式二：在 lazy 中处理错误
const Home = lazy(() =>
  import('./pages/Home').catch(err => {
    console.error('Failed to load Home:', err);
    // 返回一个降级组件
    return { default: () => <div>页面加载失败</div> };
  })
);
```

### Vue 路由分割

```javascript
// Vue Router 路由级分割
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    // 直接使用动态 import
    component: () => import('./views/Home.vue'),
  },
  {
    path: '/products',
    component: () => import('./views/Products.vue'),
  },
  {
    path: '/products/:id',
    component: () => import('./views/ProductDetail.vue'),
  },
  {
    path: '/user',
    component: () => import('./views/UserCenter.vue'),
  },
  {
    path: '/admin',
    component: () => import('./views/Admin.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});
```

```vue
<!-- Vue 中的 Suspense -->
<template>
  <Suspense>
    <template #default>
      <router-view />
    </template>
    <template #fallback>
      <div class="loading">加载中...</div>
    </template>
  </Suspense>
</template>

<!-- 注意：Vue 3 的 Suspense 仍是实验性功能 -->
<!-- 生产环境中更常见的做法是在组件内部处理加载状态 -->
```

```vue
<!-- Vue defineAsyncComponent -->
<script setup>
import { defineAsyncComponent } from 'vue';

// 基础用法
const AdminPanel = defineAsyncComponent(() =>
  import('./components/AdminPanel.vue')
);

// 带选项的用法
const HeavyChart = defineAsyncComponent({
  loader: () => import('./components/HeavyChart.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorDisplay,
  delay: 200,           // 延迟显示 loading（避免闪烁）
  timeout: 10000,       // 超时时间
});
</script>
```

## 组件级代码分割

除了路由，某些重量级组件也适合懒加载。

```jsx
// React：组件级懒加载
import { lazy, Suspense, useState } from 'react';

// 这个组件很大（比如富文本编辑器），只在用户需要时加载
const RichTextEditor = lazy(() => import('./RichTextEditor'));

function ArticleEditor() {
  const [showEditor, setShowEditor] = useState(false);
  
  return (
    <div>
      <h2>撰写文章</h2>
      {!showEditor ? (
        <button onClick={() => setShowEditor(true)}>
          打开编辑器
        </button>
      ) : (
        <Suspense fallback={<div>编辑器加载中...</div>}>
          <RichTextEditor />
        </Suspense>
      )}
    </div>
  );
}
```

```jsx
// 地图组件懒加载
const MapComponent = lazy(() => import('./MapComponent'));

function StoreLocation() {
  const [showMap, setShowMap] = useState(false);
  
  return (
    <div>
      <h3>门店地址</h3>
      <p>北京市朝阳区 xxx</p>
      <button onClick={() => setShowMap(true)}>查看地图</button>
      
      {showMap && (
        <Suspense fallback={<div style={{ height: 400 }}>地图加载中...</div>}>
          <MapComponent />
        </Suspense>
      )}
    </div>
  );
}
```

## 预加载策略

懒加载的问题是用户点击后才开始下载，有明显的等待感。预加载可以解决这个问题。

```jsx
// 策略一：鼠标悬停时预加载
function NavLink({ to, children }) {
  const route = routes[to];
  
  const handleMouseEnter = () => {
    // 鼠标悬停时开始预加载
    route.preload();
  };
  
  return (
    <Link to={to} onMouseEnter={handleMouseEnter}>
      {children}
    </Link>
  );
}

// 配合 lazy
const routes = {
  '/products': {
    component: lazy(() => import('./pages/Products')),
    preload: () => import('./pages/Products'),
  },
};
```

```jsx
// 策略二：空闲时预加载
// 在首屏加载完成后，预加载其他路由
useEffect(() => {
  // 等首屏加载完成
  if (document.readyState === 'complete') {
    // 空闲时预加载其他页面
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        import('./pages/Products');
        import('./pages/ProductDetail');
      });
    }
  }
}, []);
```

```javascript
// 策略三：Webpack magic comments 控制 chunk 名称和预加载
const Products = lazy(() =>
  import(
    /* webpackChunkName: "products" */
    /* webpackPrefetch: true */
    './pages/Products'
  )
);

// webpackPrefetch: true 会在浏览器空闲时自动添加 <link rel="prefetch">
// webpackPreload: true 会在父 chunk 加载时立即加载
```

## 第三方库的分割

```javascript
// Webpack: 将第三方库单独打包
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
          priority: 10,
        },
        // 大型库单独打包
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react-vendor',
          chunks: 'all',
          priority: 20,
        },
      },
    },
  },
};

// Vite: 自动处理第三方库分割
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['antd', '@ant-design/icons'],
        },
      },
    },
  },
});
```

```javascript
// 大型库按需加载
// 不要这样做：整个 lodash 4MB
import _ from 'lodash';

// 应该这样做：只引入需要的函数
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';

// 或者使用 lodash-es（支持 tree shaking）
import { debounce, throttle } from 'lodash-es';
```

## 代码分割的注意事项

### 避免过度分割

```
过度分割的问题：
1. 增加请求数量（每个 chunk 一个 HTTP 请求）
2. 增加 HTTP 开销（header、TCP 连接）
3. 增加解析和执行的碎片化
4. 增加构建配置复杂度

合理的分割粒度：
- 路由级：每个路由一个 chunk（推荐）
- 大型组件级：富文本编辑器、图表、地图等
- 第三方库：按是否常变化分组

不建议分割：
- 小组件（< 5KB）
- 频繁使用的公共组件
- 几乎每个页面都用到的工具函数
```

### 处理加载状态

```jsx
// 避免 loading 闪烁
function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </Suspense>
  );
}

// 好的 loading 设计：
// 1. 用骨架屏（Skeleton）而不是 spinner
// 2. 骨架屏的布局和真实页面接近
// 3. 如果加载很快（< 200ms），不显示 loading

// React 18 的 Suspense 支持嵌套
function App() {
  return (
    <Suspense fallback={<LayoutSkeleton />}>
      <Layout>
        <Suspense fallback={<ContentSkeleton />}>
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </Suspense>
      </Layout>
    </Suspense>
  );
}
```

## 本课小结

```
代码分割策略：

路由级分割（必须做）：
  - 每个路由一个 chunk
  - 首屏只加载当前路由的代码
  - React: lazy + Suspense
  - Vue: () => import()

组件级分割（按需做）：
  - 大型组件（编辑器、图表、地图）
  - 折叠/弹窗中的复杂内容
  - 权限相关的功能模块

第三方库分割：
  - vendor chunk 独立（长期缓存）
  - 大型库单独打包
  - 按需引入（lodash-es、date-fns）

预加载策略：
  - 鼠标悬停预加载
  - 空闲时预加载
  - Webpack prefetch hint
```

## 练习

### 练习一：设计代码分割方案

你正在开发一个电商网站，包含以下页面：

```
/ (首页)
/products (商品列表，含筛选和排序)
/products/:id (商品详情，含图片轮播、评论、推荐)
/cart (购物车)
/checkout (结算，含地址选择、支付)
/user (用户中心)
/user/orders (订单列表)
/user/settings (用户设置)
/admin (管理后台，仅管理员)
/admin/products (商品管理)
/admin/orders (订单管理)
```

请设计代码分割方案：
1. 哪些应该做路由级分割？哪些不应该？
2. 哪些页面内的组件应该做组件级分割？
3. 如何设计预加载策略？

### 练习二：实现带预加载的 lazy

实现一个增强版的 `lazyWithPreload` 函数：

```typescript
function lazyWithPreload(factory: () => Promise<{ default: React.ComponentType }>) {
  // 实现要求：
  // 1. 返回一个可以被 React.lazy 使用的组件
  // 2. 组件上挂载一个 preload 方法
  // 3. preload 调用后，后续渲染不再需要等待加载
}
```

---

## 参考答案

### 练习一

```
路由级分割方案：

主包（首屏加载）：
  - / (首页) → 包含在主包中（首屏必须立即渲染）

独立 chunk：
  - /products → products.js（商品列表）
  - /products/:id → product-detail.js（商品详情）
  - /cart → cart.js（购物车）
  - /checkout → checkout.js（结算流程）
  - /user → user.js（用户中心 + 子路由）
  - /admin → admin.js（管理后台 + 子路由）

为什么首页不单独分割：
  首页是用户第一个访问的页面，如果单独分割会增加一次 HTTP 请求，
  反而可能更慢。把首页放在主包中，配合 SSR 可以更快渲染。

组件级分割：
  - 商品详情页的图片轮播（可能很大）
  - 商品详情页的评论区（首屏不需要）
  - 结算页的支付组件（用户点击"去支付"时才需要）
  - 管理后台的图表组件（重量级）

预加载策略：
  - 首页的"商品列表"链接 → 鼠标悬停时预加载 products.js
  - 首页加载完成后 → 空闲时预加载 products.js
  - 商品列表页 → 鼠标悬停在商品卡片时预加载 product-detail.js
  - 用户登录后 → 空闲时预加载 user.js
  - 管理员访问时 → 不预加载 admin.js（低频页面）
```

### 练习二

```typescript
import React from 'react';

function lazyWithPreload(
  factory: () => Promise<{ default: React.ComponentType }>
) {
  let loaded = false;
  let loadingPromise: Promise<void> | null = null;
  let Component: React.ComponentType | null = null;

  const LazyComponent = React.lazy(() => {
    if (Component) {
      return Promise.resolve({ default: Component });
    }
    return factory().then((module) => {
      Component = module.default;
      loaded = true;
      return module;
    });
  });

  // 预加载方法
  LazyComponent.preload = () => {
    if (loaded) {
      return Promise.resolve();
    }
    if (!loadingPromise) {
      loadingPromise = factory().then((module) => {
        Component = module.default;
        loaded = true;
      });
    }
    return loadingPromise;
  };

  return LazyComponent;
}

// 使用示例
const Products = lazyWithPreload(() => import('./pages/Products'));

// 在导航组件中使用
function NavLink({ to, children }) {
  const handleMouseEnter = () => {
    // 鼠标悬停时预加载
    Products.preload();
  };

  return (
    <Link to={to} onMouseEnter={handleMouseEnter}>
      {children}
    </Link>
  );
}
```

```
实现要点：
1. 用闭包缓存加载状态和 Promise
2. preload 只执行一次工厂函数（避免重复请求）
3. React.lazy 内部检查是否已加载，已加载则直接返回
4. preload 返回 Promise，可以用于等待加载完成
```

## 下一步

完成本课后，继续学习 [06. 图片与媒体优化策略](./06-image-media-optimization.md)。
