# 04. Webpack 深度优化

> 持久化缓存、并行构建、Module Federation——让 Webpack 跑得更快

## 本课目标

- 掌握 Webpack 持久化缓存（filesystem cache）的配置和原理
- 理解并行构建的实现方式和适用场景
- 了解 Module Federation 的核心概念和使用方式

## 为什么需要优化 Webpack

一个典型的中型项目，Webpack 的构建数据：

```bash
# 优化前
$ time npm run build
webpack 5.88.0 compiled with 3 errors in 45000 ms
npm run build  48.32s

# 产物体积
dist/
  main.js        2.1 MB
  vendor.js      850 KB
  styles.css     120 KB
```

45 秒的构建时间，2.1 MB 的主包。这不是 Webpack 的问题，而是配置的问题。

## 优化一：持久化缓存

### 问题：每次构建都从零开始

默认情况下，Webpack 每次构建都会重新编译所有模块。即使代码没有变化，也要花时间处理。

### 解决方案：filesystem cache

Webpack 5 内置了持久化缓存，可以把编译结果缓存到磁盘：

```javascript
// webpack.config.js
module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      // 当这些文件变化时，缓存失效
      config: [__filename],
    },
    name: 'my-app', // 缓存名称，区分不同配置
    cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
  },
};
```

**效果**：

```bash
# 首次构建（无缓存）
webpack compiled in 45000 ms

# 第二次构建（有缓存，代码无变化）
webpack compiled in 2300 ms

# 部分代码变化
webpack compiled in 8500 ms
```

### 缓存的工作原理

```
首次构建：
  模块编译 → 计算模块 hash → 存入缓存 → 输出产物

后续构建：
  读取缓存 → 对比模块 hash → hash 相同则跳过编译 → 输出产物
```

Webpack 会根据以下因素计算缓存 key：
- 文件内容
- 文件路径
- loader 配置
- 插件配置
- 依赖关系

任何因素变化都会导致缓存失效。

### 缓存失效的常见原因

```javascript
// 1. 配置文件变化
// webpack.config.js 修改后，缓存自动失效

// 2. 依赖版本变化
// package.json 中的依赖版本变化

// 3. loader/plugin 版本变化
// 升级了 babel-loader 版本

// 4. 环境变量变化
// process.env.NODE_ENV 变化
```

### 配置缓存策略

```javascript
// webpack.config.js
module.exports = {
  cache: {
    type: 'filesystem',

    // 缓存版本号，手动控制缓存失效
    version: '1.0.0',

    // 缓存目录
    cacheDirectory: path.resolve(__dirname, '.webpack-cache'),

    // 缓存压缩（减少磁盘占用）
    compression: 'gzip',

    // 缓存过期时间
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 天

    // 缓存粒度
    // 'dependencies'：基于依赖图
    // 'pack'：基于打包结果
    buildDependencies: {
      config: [__filename],
      tsconfig: [path.resolve(__dirname, 'tsconfig.json')],
    },
  },
};
```

## 优化二：并行构建

### 问题：单线程瓶颈

Webpack 默认在单线程中处理所有模块。当项目有几百个 TypeScript 文件时，编译会成为瓶颈。

### 解决方案：thread-loader

`thread-loader` 可以把 loader 的工作分配到多个 worker 线程：

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'thread-loader',
            options: {
              workers: 4, // worker 数量
              workerParallelJobs: 50, // 每个 worker 并行处理的 job 数
              poolTimeout: 2000, // worker 空闲超时
            },
          },
          {
            loader: 'ts-loader',
            options: {
              happyPackMode: true, // 配合 thread-loader
              transpileOnly: true, // 只转译，不检查类型
            },
          },
        ],
      },
    ],
  },
};
```

**效果**：

```bash
# 单线程
ts-loader: 25000 ms

# 4 线程
thread-loader + ts-loader: 8000 ms
```

### 并行构建的限制

**不是所有场景都适合并行**：

1. **小项目不适合**：worker 线程的创建和通信有开销，文件少于 50 个时可能更慢
2. **某些 loader 不兼容**：`thread-loader` 不支持所有 loader
3. **内存占用增加**：每个 worker 线程都需要独立的内存空间

**推荐的并行策略**：

```javascript
const os = require('os');

module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'thread-loader',
            options: {
              // worker 数量 = CPU 核心数 - 1
              workers: Math.max(os.cpus().length - 1, 1),
            },
          },
          'ts-loader',
        ],
        // 排除 node_modules
        exclude: /node_modules/,
      },
    ],
  },
};
```

### 其他并行方案

**1. terser-webpack-plugin 并行压缩**

```javascript
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true, // 启用并行压缩
        terserOptions: {
          compress: {
            drop_console: true, // 删除 console
          },
        },
      }),
    ],
  },
};
```

**2. css-minimizer-webpack-plugin 并行压缩 CSS**

```javascript
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = {
  optimization: {
    minimizer: [
      new CssMinimizerPlugin({
        parallel: true,
      }),
    ],
  },
};
```

## 优化三：Module Federation

### 问题：微前端中的代码共享

在微前端架构中，多个独立部署的应用需要共享代码。传统方案：

1. **npm 包**：需要重新构建和发布，所有应用都要更新依赖
2. **CDN 引入**：版本管理困难，类型不安全
3. **复制代码**：维护成本高，容易出现不一致

### Module Federation 的思路

Module Federation 允许应用在**运行时**共享模块：

```javascript
// app1/webpack.config.js（提供模块的应用）
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'app1',
      filename: 'remoteEntry.js',
      exposes: {
        './Button': './src/components/Button',
        './utils': './src/utils',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
  ],
};
```

```javascript
// app2/webpack.config.js（消费模块的应用）
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'app2',
      remotes: {
        app1: 'app1@http://localhost:3001/remoteEntry.js',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
  ],
};
```

```typescript
// app2/src/App.tsx
import React from 'react';

// 动态加载 app1 的 Button 组件
const RemoteButton = React.lazy(() => import('app1/Button'));

function App() {
  return (
    <div>
      <h1>App 2</h1>
      <React.Suspense fallback="Loading...">
        <RemoteButton />
      </React.Suspense>
    </div>
  );
}
```

### Module Federation 的核心概念

**Host（宿主）**：消费远程模块的应用

**Remote（远程）**：提供模块的应用

**Shared（共享）**：多个应用共享的依赖（如 react、react-dom）

**singleton**：确保共享依赖只有一个实例，避免多个 React 实例导致的问题

```javascript
new ModuleFederationPlugin({
  shared: {
    react: {
      singleton: true,        // 只允许一个实例
      requiredVersion: '^18.0.0', // 版本要求
      eager: true,            // 启动时就加载，不懒加载
    },
  },
});
```

### Module Federation 的运行时行为

```
1. app2 启动，加载自己的代码
2. 遇到 import('app1/Button')
3. 从 http://localhost:3001/remoteEntry.js 获取远程模块信息
4. 检查共享依赖（react）是否已加载
  - 已加载：直接使用
  - 未加载：从远程或本地加载
5. 加载 Button 模块
6. 渲染组件
```

### Module Federation 2.0

Module Federation 2.0 带来了更多功能：

```javascript
// 使用 @module-federation/enhanced
const { ModuleFederationPlugin } = require('@module-federation/enhanced');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'app1',
      exposes: {
        './Button': './src/components/Button',
      },
      // 运行时插件
      runtimePlugins: [
        require.resolve('@module-federation/node/runtimePlugin'),
      ],
      // 类型声明生成
      dts: {
        generate: true,
      },
    }),
  ],
};
```

## 综合优化配置

把上述优化整合到一个配置中：

```javascript
// webpack.config.prod.js
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const os = require('os');

module.exports = {
  mode: 'production',
  entry: './src/main.tsx',

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js',
    clean: true,
  },

  // 持久化缓存
  cache: {
    type: 'filesystem',
    cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
    buildDependencies: {
      config: [__filename],
    },
    compression: 'gzip',
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          // 并行构建
          {
            loader: 'thread-loader',
            options: {
              workers: Math.max(os.cpus().length - 1, 1),
            },
          },
          {
            loader: 'ts-loader',
            options: {
              happyPackMode: true,
              transpileOnly: true,
            },
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },

  optimization: {
    minimizer: [
      // 并行压缩
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          compress: { drop_console: true },
        },
      }),
      new CssMinimizerPlugin({ parallel: true }),
    ],

    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
        },
      },
    },
  },

  plugins: [
    // 可选：产物分析
    process.env.ANALYZE && new BundleAnalyzerPlugin(),
  ].filter(Boolean),
};
```

## 性能对比

优化前后的构建时间对比：

```bash
# 优化前
webpack compiled in 45000 ms

# 持久化缓存（第二次构建）
webpack compiled in 2300 ms

# 持久化缓存 + 并行构建
webpack compiled in 1200 ms

# 持久化缓存 + 并行构建 + 并行压缩
webpack compiled in 900 ms
```

## 常见误区

### 误区一：缓存永远有效

**错误理解**：配置了 filesystem cache 就不用管了

**正确理解**：缓存会因为配置变化、依赖升级等原因失效。要监控缓存命中率，及时调整策略。

### 误区二：并行越多越好

**错误理解**：worker 数量越多，构建越快

**正确理解**：worker 有创建和通信开销，太多反而更慢。一般设为 CPU 核心数 - 1。

### 误区三：Module Federation 可以替代 npm 包

**错误理解**：有了 Module Federation 就不需要发布 npm 包了

**正确理解**：Module Federation 适合运行时共享，npm 包适合构建时共享。两者适用于不同场景。

## 本课小结

1. **持久化缓存**：把编译结果缓存到磁盘，第二次构建大幅提速
2. **并行构建**：用 thread-loader 把编译工作分配到多个线程
3. **Module Federation**：运行时共享模块，适合微前端架构
4. **综合优化**：缓存 + 并行 + 压缩优化，可以把构建时间降低 90% 以上

## 练习

### 练习一：配置持久化缓存

在你现有的 Webpack 项目中配置 filesystem cache，对比优化前后的构建时间。

### 练习二：Module Federation Demo

搭建两个 Webpack 应用，用 Module Federation 共享一个组件，观察运行时行为。

## 参考答案

### 练习一

```bash
# 1. 记录优化前的构建时间
time npm run build

# 2. 在 webpack.config.js 中添加缓存配置
cache: {
  type: 'filesystem',
  cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
}

# 3. 第一次构建（缓存写入）
time npm run build

# 4. 第二次构建（缓存命中）
time npm run build

# 5. 对比时间
# 典型结果：45s → 45s（首次） → 3s（缓存命中）
```

### 练习二

```bash
# 项目结构
# host-app/（消费模块）
# remote-app/（提供模块）

# remote-app/webpack.config.js
new ModuleFederationPlugin({
  name: 'remote',
  filename: 'remoteEntry.js',
  exposes: { './Button': './src/Button' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})

# host-app/webpack.config.js
new ModuleFederationPlugin({
  name: 'host',
  remotes: { remote: 'remote@http://localhost:3001/remoteEntry.js' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})

# host-app/src/App.tsx
const RemoteButton = React.lazy(() => import('remote/Button'));
```

## 下一步

完成本课后，继续学习 [05. 代码分割策略](./05-code-splitting.md)。
