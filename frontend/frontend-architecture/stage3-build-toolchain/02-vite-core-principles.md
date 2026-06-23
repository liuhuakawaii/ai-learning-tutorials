# 02. Vite 核心原理

> ESM Dev Server、esbuild 预构建、HMR 机制、Plugin 系统——Vite 为什么快

## 本课目标

- 理解 Vite 开发环境的工作原理
- 掌握预构建（Pre-bundling）的作用和机制
- 理解 Vite 的 HMR 实现方式
- 了解 Vite Plugin 系统的设计

## Vite 的启动流程

当你运行 `vite` 命令时，发生了什么：

```
1. 解析 vite.config.ts
2. 创建 Dev Server（基于 connect）
3. 启动文件监听（基于 chokidar）
4. 预构建 node_modules 中的依赖（esbuild）
5. Dev Server 就绪，等待浏览器请求
```

注意第 4 步——Vite 不会打包你的业务代码，但会预构建 `node_modules` 中的依赖。这是为什么？

## 为什么需要预构建

浏览器原生 ESM 可以处理这样的 import：

```javascript
import { add } from './utils.js';
```

但遇到这样的 import 就有问题了：

```javascript
import React from 'react';
import { debounce } from 'lodash-es';
```

浏览器不知道 `react` 是什么——它在 `node_modules` 里，浏览器没有 `node_modules` 的概念。而且一个包可能有几百个小模块：

```javascript
// lodash-es 内部结构
// 一个 import 会触发几百个 HTTP 请求
import { debounce } from 'lodash-es';
// → /node_modules/lodash-es/debounce.js
// → /node_modules/lodash-es/_deburrLetter.js
// → /node_modules/lodash-es/now.js
// → ... 几百个请求
```

几百个 HTTP 请求会让页面加载变慢。预构建解决的就是这个问题：

```bash
# 预构建前
lodash-es 被拆分为 600+ 个小模块
# 预构建后
lodash-es 被合并为 1 个文件
```

### 预构建的实现：esbuild

Vite 用 esbuild 做预构建，而不是用自己。原因很简单——esbuild 比任何 JavaScript 编写的打包器都快 10-100 倍。

```javascript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    include: ['lodash-es', 'axios'],  // 强制预构建的依赖
    exclude: ['your-local-pkg'],       // 排除预构建的依赖
    esbuildOptions: {
      // esbuild 配置
      target: 'es2020',
    },
  },
});
```

预构建的产物默认缓存在 `node_modules/.vite` 目录下。当 `package.json` 或 lock 文件变化时，Vite 会重新预构建。

### 预构建的两个核心目标

**1. 将非 ESM 格式转为 ESM**

很多 npm 包还是 CommonJS 格式：

```javascript
// 某个 npm 包（CommonJS）
const React = require('react');
module.exports = function Button() { /* ... */ };
```

浏览器不支持 `require`。预构建会把它转成 ESM：

```javascript
// 预构建后（ESM）
import React from 'react';
export default function Button() { /* ... */ }
```

**2. 将零散模块合并**

把包内部的几百个小模块合并成一个文件，减少 HTTP 请求数。

## 浏览器请求的处理流程

Dev Server 启动后，浏览器发起请求时的处理流程：

```
浏览器请求 /src/main.tsx
  ↓
Vite Dev Server 拦截
  ↓
检查是否是 node_modules 中的依赖
  → 是：返回预构建后的文件（来自 .vite 缓存）
  ↓
检查是否是业务代码
  → 是：用 esbuild 编译 TypeScript/JSX
  ↓
返回编译后的 ESM 模块
  ↓
浏览器解析 import，发起新的请求
  → 循环上述流程
```

关键点：Vite **不做打包**，只做**按需转换**。这就是为什么启动速度和项目规模无关——Vite 不需要提前处理所有文件。

## HMR：热模块替换

### 什么是 HMR

HMR（Hot Module Replacement）是指在不刷新页面的情况下，更新变化的模块。这在开发中非常重要：

- 表单里填了一半的数据不会丢失
- 组件的状态可以保持
- 页面滚动位置不会重置

### Webpack 的 HMR

Webpack 的 HMR 需要重新构建受影响的模块链：

```
文件变化 → 重新打包受影响的模块 → 通过 WebSocket 推送给浏览器 → 替换模块
```

问题在于"重新打包"这一步——如果变化的模块被很多其他模块依赖，重新打包的范围会很大。

### Vite 的 HMR

Vite 的 HMR 基于 ESM，粒度更细：

```
文件变化
  → Vite 检测到变化
  → 确定受影响的模块（精确到单个模块）
  → 通过 WebSocket 推送更新
  → 浏览器只需要重新请求变化的模块
```

```javascript
// Vite HMR API
if (import.meta.hot) {
  import.meta.hot.accept('./utils.js', (newModule) => {
    // 模块更新后的回调
    console.log('utils.js updated');
  });
}
```

### 框架的 HMR 集成

React 和 Vue 的 Vite 插件已经处理了 HMR 的细节：

```javascript
// React：@vitejs/plugin-react
// 自动处理组件的 HMR，不需要手动写 import.meta.hot

// Vue：@vitejs/plugin-vue
// 自动处理 SFC 的 HMR，包括 template、script、style
```

你不需要手动管理 HMR，框架插件会处理。但理解底层机制有助于排查 HMR 失效的问题。

### HMR 失败的常见原因

```javascript
// 1. 模块没有导出（无法被替换）
const config = { key: 'value' }; // 没有 export，HMR 无法更新

// 2. 循环依赖
// a.js imports b.js, b.js imports a.js → HMR 可能无法正确传播

// 3. 副作用模块
// 模块执行时修改了全局状态，HMR 替换后状态丢失
```

## Plugin 系统

Vite 的插件系统兼容 Rollup 插件接口，同时扩展了一些 Vite 特有的钩子。

### 插件的基本结构

```javascript
// vite-plugin-example.js
export default function myPlugin() {
  return {
    name: 'vite-plugin-example',

    // Vite 特有钩子
    configureServer(server) {
      // 配置 Dev Server
      server.middlewares.use((req, res, next) => {
        // 自定义中间件
        next();
      });
    },

    // Rollup 钩子（通用）
    transform(code, id) {
      // 转换代码
      if (id.endsWith('.md')) {
        return `export default ${JSON.stringify(code)}`;
      }
    },

    // 构建钩子
    buildStart() {
      console.log('build started');
    },
  };
}
```

### 常用钩子

**Vite 特有钩子**：

```javascript
export default function plugin() {
  return {
    name: 'my-plugin',

    // 在其他插件之前执行
    enforce: 'pre',

    // 配置 Dev Server
    configureServer(server) { /* ... */ },

    // 转换 index.html
    transformIndexHtml(html) { /* ... */ },

    // HMR 相关
    handleHotUpdate({ file, server, modules }) {
      // 自定义 HMR 行为
      // 返回空数组表示不更新
    },
  };
}
```

**Rollup 通用钩子**：

```javascript
export default function plugin() {
  return {
    name: 'my-plugin',

    // 构建开始
    buildStart(options) { /* ... */ },

    // 解析模块路径
    resolveId(source, importer) {
      // 返回自定义路径
      if (source === 'virtual-module') {
        return '\0virtual-module'; // \0 前缀表示虚拟模块
      }
    },

    // 加载模块内容
    load(id) {
      if (id === '\0virtual-module') {
        return 'export default "virtual content"';
      }
    },

    // 转换模块代码
    transform(code, id) {
      // 返回转换后的代码
    },

    // 构建结束
    buildEnd() { /* ... */ },
  };
}
```

### 插件的执行顺序

```javascript
// vite.config.ts
export default defineConfig({
  plugins: [
    pluginA(),           // 普通插件
    { ...pluginB(), enforce: 'pre' },  // 在核心插件之前执行
    { ...pluginC(), enforce: 'post' }, // 在核心插件之后执行
  ],
});
```

```
pluginB (pre) → Vite 核心插件 → pluginA → pluginC (post)
```

## esbuild 在 Vite 中的角色

esbuild 在 Vite 中承担了多个角色：

### 1. 依赖预构建

```bash
# 用 esbuild 将 node_modules 中的 CJS 包转为 ESM
# 速度比传统的 babel/rollup 快 10-100 倍
```

### 2. TypeScript / JSX 编译

```javascript
// vite.config.ts
export default defineConfig({
  esbuild: {
    target: 'es2020',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    // 支持 decorators（实验性）
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
      },
    },
  },
});
```

esbuild 只做**语法转换**（TypeScript → JavaScript，JSX → 函数调用），不做**类型检查**。类型检查需要另外运行 `tsc --noEmit`。

### 3. 代码压缩

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    minify: 'esbuild', // 默认用 esbuild 压缩，比 terser 快 20-40 倍
    // minify: 'terser', // 需要更小体积时用 terser
  },
});
```

## Vite 的生产构建

Vite 的生产构建用的是 Rollup，不是 esbuild。为什么？

```
开发环境：esbuild（快，不需要最优产物）
生产环境：Rollup（产物质量好，支持代码分割）
```

esbuild 的代码分割能力有限，生成的产物不够优化。Rollup 生成的 ESM 产物更干净、更适合生产环境。

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        // 控制产物的文件名和分包策略
        manualChunks: {
          vendor: ['react', 'react-dom'],
          utils: ['lodash-es', 'date-fns'],
        },
      },
    },
  },
});
```

## 实战：观察 Vite 的工作过程

### 1. 创建一个 Vite 项目

```bash
npm create vite@latest vite-demo -- --template react-ts
cd vite-demo
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

观察控制台输出：

```
  VITE v5.x.x  ready in 320 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

320 毫秒启动，和项目规模无关。

### 3. 观察预构建

```bash
# 删除缓存
rm -rf node_modules/.vite

# 启动后观察控制台
VITE v5.x.x  ready in 320 ms

# 首次访问时会触发预构建
# 控制台会显示预构建的依赖列表
```

### 4. 观察 HMR

在 `src/App.tsx` 中修改内容，观察浏览器：
- 不刷新页面
- 组件状态保持
- 控制台显示 HMR 更新日志

## Vite Dev Server 的内部结构

Vite 的 Dev Server 基于 connect（一个轻量的 HTTP 中间件框架），请求经过一系列中间件处理：

```
浏览器请求
  ↓
Vite 中间件链
  ├── staticMiddleware    → 处理静态文件（public 目录）
  ├── proxyMiddleware    → 处理代理配置
  ├── transformMiddleware → 处理模块请求（编译 TypeScript/JSX）
  └── spaFallback        → SPA 回退（所有请求返回 index.html）
  ↓
响应返回浏览器
```

**理解中间件链的意义**：

当你的请求没有返回预期结果时，知道请求经过了哪些中间件，有助于定位问题。比如：

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

如果 `/api/users` 没有正确代理，你可以检查：
1. 代理中间件是否匹配了 `/api` 前缀
2. 后端服务是否在运行
3. 请求是否被其他中间件拦截

### 静态文件处理

Vite 对 `public` 目录和 `src` 目录的处理方式不同：

```
public/         → 直接作为静态文件服务，不做任何转换
src/            → 经过编译后返回（TypeScript → JavaScript）
node_modules/   → 预构建后的文件
```

```typescript
// public/logo.png
// 访问 /logo.png 直接返回文件

// src/main.tsx
// 访问 /src/main.tsx 返回编译后的 JavaScript
```

### Source Map 支持

Vite 开发环境默认生成 Source Map，方便调试：

```typescript
// vite.config.ts
export default defineConfig({
  css: {
    devSourcemap: true, // CSS Source Map（默认开启）
  },
  build: {
    sourcemap: true, // 生产构建 Source Map（默认关闭）
  },
});
```

## Vite 的 CSS 处理

Vite 对 CSS 有内置支持，不需要额外配置：

### CSS Modules

```typescript
// 自动识别 *.module.css 文件
import styles from './App.module.css';

function App() {
  return <div className={styles.container}>Hello</div>;
}
```

### CSS 预处理器

```bash
# 安装预处理器即可，不需要额外配置
npm install -D sass
npm install -D less
```

```scss
// App.scss 自动识别
.container {
  color: red;
  .child {
    color: blue;
  }
}
```

### PostCSS

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    autoprefixer: {},
    'postcss-px-to-viewport': {
      viewportWidth: 375,
    },
  },
};
```

Vite 会自动读取 `postcss.config.js`，不需要额外配置。

### CSS 压缩

生产构建时，Vite 默认使用 esbuild 压缩 CSS：

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    cssMinify: 'esbuild', // 默认值，速度快
    // cssMinify: 'lightningcss', // 可选，压缩率更好
  },
});
```

## 常见误区

### 误区一：Vite 完全不打包

**错误理解**：Vite 在任何情况下都不打包

**正确理解**：Vite 开发环境不打包业务代码，但会预构建依赖。生产构建仍然用 Rollup 打包。

### 误区二：esbuild 就是 Vite

**错误理解**：Vite 就是 esbuild 的封装

**正确理解**：esbuild 在 Vite 中负责预构建和代码编译，但 Vite 的核心是 Dev Server 架构和 Plugin 系统。

### 误区三：Vite 不需要配置

**错误理解**：Vite 零配置，不需要管构建配置

**正确理解**：Vite 的零配置指的是开箱即用，但实际项目中仍然需要配置别名、代理、构建选项等。

## 本课小结

1. **Vite 的核心思路**：利用浏览器原生 ESM，开发环境不打包，按需编译
2. **预构建**：用 esbuild 将 CJS 依赖转为 ESM，合并零散模块，减少 HTTP 请求
3. **HMR**：基于 ESM 的精确模块替换，比 Webpack 的 HMR 更快
4. **Plugin 系统**：兼容 Rollup 钩子，扩展 Vite 特有钩子
5. **生产构建**：用 Rollup 而非 esbuild，因为 Rollup 的产物质量更好

## 练习

### 练习一：预构建验证

1. 创建一个 Vite 项目，安装 `lodash-es`
2. 删除 `node_modules/.vite` 缓存
3. 启动开发服务器，观察预构建日志
4. 检查 `node_modules/.vite` 目录下的产物

### 练习二：HMR 行为观察

1. 在一个 React 组件中添加 `useState`
2. 修改组件的 JSX，观察状态是否保持
3. 修改组件的文件名，观察 HMR 是否正常工作

## 参考答案

### 练习一

```bash
# 1. 创建项目并安装依赖
npm create vite@latest hmr-demo -- --template react-ts
cd hmr-demo
npm install lodash-es

# 2. 删除缓存
rm -rf node_modules/.vite

# 3. 启动开发服务器
npm run dev

# 控制台输出类似：
# ✨ dependencies have been pre-bundled
# lodash-es → node_modules/.vite/deps/lodash-es.js

# 4. 检查产物
ls node_modules/.vite/deps/
# 会看到 lodash-es.js 和 lodash-es.js.map
```

### 练习二

```tsx
// src/App.tsx
import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      {/* 修改这里的文字，观察 count 是否保持 */}
      <p>Hello Vite</p>
    </div>
  );
}

export default App;
```

**观察结果**：
- 修改 `<p>Hello Vite</p>` → 页面更新，count 保持
- 修改组件逻辑（如添加新的 state）→ HMR 可能失败，页面会刷新
- 重命名文件 → HMR 失败，页面会刷新

## 下一步

完成本课后，继续学习 [03. Vite 插件开发实战](./03-vite-plugin-dev.md)。
