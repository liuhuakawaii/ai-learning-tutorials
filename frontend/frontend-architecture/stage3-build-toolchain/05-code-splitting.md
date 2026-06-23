# 05. 代码分割策略

> 路由级分割、组件级分割、动态 import、SplitChunksPlugin——让产物更合理

## 本课目标

- 理解代码分割的意义和原理
- 掌握路由级和组件级的代码分割方式
- 配置 SplitChunksPlugin 优化产物结构
- 避免常见的代码分割陷阱

## 为什么需要代码分割

一个 SPA 应用如果不做代码分割，产物通常是这样的：

```
dist/
  index.html
  main.js    # 2.5 MB（包含所有页面的代码）
  style.css  # 200 KB
```

用户访问首页，就要下载 2.5 MB 的 JavaScript。但实际上，首页可能只需要其中的 10%。剩下的 90% 是其他页面的代码——用户可能根本不会访问那些页面。

**代码分割的核心思路**：把代码拆成多个小文件，按需加载。

```
dist/
  index.html
  main.js         # 200 KB（公共代码 + 首页代码）
  home.js          # 50 KB（首页）
  dashboard.js     # 80 KB（仪表盘）
  settings.js      # 40 KB（设置页）
  vendor.js        # 300 KB（第三方库）
```

## 动态 import：代码分割的基础

JavaScript 的 `import()` 表达式是代码分割的基础：

```typescript
// 静态 import（打包时确定）
import { Button } from './Button';

// 动态 import（运行时按需加载）
const { Button } = await import('./Button');
```

构建工具看到 `import()` 语法时，会自动把目标模块拆分成独立的 chunk：

```typescript
// src/App.tsx
import { lazy, Suspense } from 'react';

// 动态导入，会生成独立的 chunk
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

构建产物：

```
dist/
  assets/
    index-[hash].js         # 主包（App + Router + 公共代码）
    Home-[hash].js           # 首页 chunk
    Dashboard-[hash].js      # 仪表盘 chunk
    Settings-[hash].js       # 设置页 chunk
```

## 路由级代码分割

路由级分割是最常见的代码分割方式，每个路由对应一个 chunk：

```typescript
// src/router.tsx
import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';

// 路由懒加载
const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/Home'),
      },
      {
        path: 'dashboard',
        lazy: () => import('./pages/Dashboard'),
      },
      {
        path: 'settings',
        lazy: () => import('./pages/Settings'),
      },
    ],
  },
];
```

### 路由分割的注意事项

**1. 避免过度分割**

```typescript
// 不好：每个小组件都分割
const Header = lazy(() => import('./components/Header'));
const Footer = lazy(() => import('./components/Footer'));
const Sidebar = lazy(() => import('./components/Sidebar'));

// 好：按路由分割，路由内的组件保持同步导入
import Header from './components/Header';
import Footer from './components/Footer';
```

路由内的小组件通常会被同时使用，分割只会增加 HTTP 请求数，没有收益。

**2. 预加载关键路由**

```typescript
// 用户可能很快会访问的路由，提前加载
const Dashboard = lazy(() => import('./pages/Dashboard'));

// 在用户 hover 导航链接时预加载
function NavLink({ to, children }) {
  const handleMouseEnter = () => {
    // 预加载模块
    import('./pages/Dashboard');
  };

  return (
    <Link to={to} onMouseEnter={handleMouseEnter}>
      {children}
    </Link>
  );
}
```

**3. 加载状态和错误处理**

```typescript
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

const Dashboard = lazy(() => import('./pages/Dashboard'));

function App() {
  return (
    <ErrorBoundary fallback={<div>页面加载失败</div>}>
      <Suspense fallback={<div>加载中...</div>}>
        <Dashboard />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## 组件级代码分割

对于大型组件（如富文本编辑器、图表库），也可以做代码分割：

```typescript
import { lazy, Suspense, useState } from 'react';

// 只在需要时加载富文本编辑器
const RichTextEditor = lazy(() => import('./RichTextEditor'));

function ArticleEditor() {
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div>
      <button onClick={() => setShowEditor(true)}>
        开始编辑
      </button>
      {showEditor && (
        <Suspense fallback={<div>编辑器加载中...</div>}>
          <RichTextEditor />
        </Suspense>
      )}
    </div>
  );
}
```

### 组件分割的适用场景

适合分割的组件：
- 体积大的组件（>100 KB）
- 不是首屏必须的组件
- 用户交互后才显示的组件（弹窗、抽屉）
- 条件渲染的组件（权限控制）

不适合分割的组件：
- 首屏渲染必须的组件
- 体积小的组件（<10 KB）
- 频繁渲染的组件（分割会增加渲染开销）

## SplitChunksPlugin：Webpack 的代码分割

Webpack 的 `splitChunks` 配置更细粒度，可以控制公共代码的提取：

### 默认行为

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all', // 对所有 chunk 生效（async + initial）
    },
  },
};
```

默认配置会：
- 提取 `node_modules` 中的依赖到 `vendor` chunk
- 被 2 个以上 chunk 共享的模块提取到 `common` chunk
- chunk 体积大于 20 KB 的才提取

### 常用配置

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',

      // 最小体积（字节），小于这个值的模块不提取
      minSize: 20000,

      // 最大体积，大于这个值的模块会尝试进一步拆分
      maxSize: 244000,

      // 最小被引用次数，少于这个值的模块不提取
      minChunks: 1,

      // 最大并发请求数
      maxAsyncRequests: 30,

      // 入口文件的最大并发请求数
      maxInitialRequests: 30,

      // 自动命名的分隔符
      automaticNameDelimiter: '~',

      cacheGroups: {
        // 第三方库
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          priority: 10,
          chunks: 'initial', // 只对 initial chunk 生效
        },

        // 公共模块
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },

        // 特定库单独打包
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react',
          priority: 20,
          chunks: 'all',
        },
      },
    },
  },
};
```

### 按模块分组

```javascript
cacheGroups: {
  // 框架相关
  framework: {
    test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
    name: 'framework',
    priority: 30,
    chunks: 'all',
  },

  // UI 库
  ui: {
    test: /[\\/]node_modules[\\/](antd|@ant-design)[\\/]/,
    name: 'ui',
    priority: 20,
    chunks: 'all',
  },

  // 工具库
  utils: {
    test: /[\\/]node_modules[\\/](lodash|moment|date-fns)[\\/]/,
    name: 'utils',
    priority: 10,
    chunks: 'all',
  },

  // 业务公共代码
  common: {
    minChunks: 2,
    priority: 5,
    reuseExistingChunk: true,
  },
},
```

### Vite 中的代码分割

Vite 使用 Rollup 的 `manualChunks` 配置：

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 把第三方库单独打包
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['antd'],
        },
      },
    },
  },
});
```

也可以用函数形式更精细地控制：

```typescript
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (id.includes('react')) return 'vendor-react';
    if (id.includes('antd')) return 'vendor-ui';
    return 'vendor-other';
  }
},
```

## 代码分割的常见问题

### 问题一：chunk 数量过多

**现象**：

```
dist/assets/
  Home-abc123.js
  Dashboard-def456.js
  Button-ghi789.js    # 1 KB
  Input-jkl012.js     # 0.5 KB
  Tooltip-mno345.js   # 0.3 KB
  ... 几百个小文件
```

**原因**：过度分割，每个小组件都成了独立 chunk。

**解决**：设置 `minSize`，小于阈值的模块不单独打包。

```javascript
splitChunks: {
  minSize: 20000, // 20 KB 以下的模块不单独打包
}
```

### 问题二：循环依赖导致分割失效

**现象**：某些模块没有被正确分割，被打包到了错误的 chunk 中。

**原因**：模块之间存在循环依赖，Webpack 无法确定该把模块放到哪个 chunk。

**解决**：检查并消除循环依赖。

```bash
# 检测循环依赖
npx madge --circular src/
```

### 问题三：动态 import 的 chunk 命名

**现象**：chunk 文件名是 hash，难以调试。

**解决**：使用 magic comments 指定 chunk 名称：

```typescript
const Dashboard = lazy(() => import(
  /* webpackChunkName: "dashboard" */
  './pages/Dashboard'
));

const Settings = lazy(() => import(
  /* webpackChunkName: "settings" */
  './pages/Settings'
));
```

### 问题四：首屏加载的 chunk 数量

**现象**：首屏需要加载很多小 chunk，增加 HTTP 请求数。

**解决**：合并首屏需要的 chunk，减少请求数。

```javascript
splitChunks: {
  maxInitialRequests: 5, // 入口文件最多 5 个并发请求
}
```

## 代码分割与首屏性能

代码分割的最终目标是提升首屏加载性能。但分割本身不是银弹，需要配合其他优化手段。

### 首屏加载的关键指标

```
FCP (First Contentful Paint)：首次内容绘制
LCP (Largest Contentful Paint)：最大内容绘制
TTI (Time to Interactive)：可交互时间
```

代码分割主要影响 TTI——减少首屏需要解析和执行的 JavaScript 量。

### 分割后的加载策略

```
首屏需要的代码 → 同步加载（main chunk）
首屏不需要但很快需要的代码 → 预加载（prefetch）
用户交互后才需要的代码 → 懒加载（lazy）
```

```typescript
// 预加载：用户可能很快会访问的页面
const Dashboard = lazy(() => import(
  /* webpackPrefetch: true */
  './pages/Dashboard'
));

// 懒加载：用户可能不会访问的页面
const Settings = lazy(() => import('./pages/Settings'));
```

Webpack 的 magic comments 支持 `webpackPrefetch` 和 `webpackPreload`：
- `webpackPrefetch`：浏览器空闲时加载
- `webpackPreload`：和父 chunk 一起加载

## 最佳实践

### 1. 按照使用频率分层

```
高频使用 → main chunk（同步加载）
中频使用 → lazy chunk（路由分割）
低频使用 → on-demand chunk（交互分割）
```

### 2. 监控 chunk 体积

```bash
# 使用 bundle analyzer 查看 chunk 组成
npx webpack-bundle-analyzer dist/stats.json
```

### 3. 配合缓存策略

```
vendor-[hash].js    → 长期缓存（第三方库变化少）
main-[hash].js      → 短期缓存（业务代码变化频繁）
[page]-[hash].js    → 长期缓存（页面代码变化较少）
```

使用 `contenthash` 确保内容变化时 hash 才变化：

```javascript
output: {
  filename: '[name].[contenthash:8].js',
}
```

## 常见误区

### 误区一：代码分割越多越好

**错误理解**：把每个组件都分割成独立 chunk

**正确理解**：分割会增加 HTTP 请求数和运行时开销。只对大模块和按需加载的模块做分割。

### 误区二：代码分割能解决所有体积问题

**错误理解**：做了代码分割就不需要优化代码了

**正确理解**：代码分割只是改变加载策略，不减少总代码量。还需要 Tree Shaking、依赖优化等手段减少总代码量。

### 误区三：splitChunks 配置一次就够了

**错误理解**：配好 splitChunks 就不用管了

**正确理解**：随着项目变化，splitChunks 的配置需要定期调整。新增依赖、代码结构变化都可能需要重新配置。

## 本课小结

1. **代码分割的核心**：把大 bundle 拆成小 chunk，按需加载
2. **动态 import**：代码分割的基础语法，构建工具自动识别
3. **路由级分割**：最常见的分割方式，每个路由一个 chunk
4. **组件级分割**：大型组件按需加载，减少首屏体积
5. **SplitChunksPlugin**：Webpack 的细粒度分包控制
6. **最佳实践**：按使用频率分层，监控体积，配合缓存

## 练习

### 练习一：路由级代码分割

在你现有的项目中，为每个路由页面添加代码分割，观察产物变化。

### 练习二：优化 SplitChunks 配置

分析你项目的依赖，设计合理的 SplitChunks 策略，把 vendor chunk 从一个大文件拆成多个有意义的分组。

## 参考答案

### 练习一

```typescript
// src/router.tsx
import { lazy, Suspense } from 'react';

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

**产物变化**：
```
# 优化前
main.js  2.5 MB

# 优化后
main.js        300 KB
Home-xxx.js     50 KB
Dashboard-xxx.js 80 KB
Settings-xxx.js  40 KB
vendor-xxx.js   500 KB
```

### 练习二

```javascript
// webpack.config.js
splitChunks: {
  chunks: 'all',
  cacheGroups: {
    react: {
      test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
      name: 'vendor-react',
      priority: 30,
    },
    antd: {
      test: /[\\/]node_modules[\\/](@?ant[d]?)[\\/]/,
      name: 'vendor-antd',
      priority: 20,
    },
    utils: {
      test: /[\\/]node_modules[\\/](lodash|moment|axios)[\\/]/,
      name: 'vendor-utils',
      priority: 10,
    },
    common: {
      minChunks: 2,
      priority: 5,
      reuseExistingChunk: true,
    },
  },
}
```

## 下一步

完成本课后，继续学习 [06. 资源优化](./06-asset-optimization.md)。
