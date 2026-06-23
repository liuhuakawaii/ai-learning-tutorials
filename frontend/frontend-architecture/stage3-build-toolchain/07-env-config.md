# 07. 环境变量与构建配置管理

> .env 文件、模式（mode）、define 配置、多环境构建——让构建配置清晰可控

## 本课目标

- 理解环境变量在前端构建中的作用
- 掌握 .env 文件的组织方式和加载规则
- 学会使用 define 配置注入运行时常量
- 设计多环境构建方案

## 环境变量的两类场景

前端项目中，环境变量有两个完全不同的用途：

### 1. 构建时变量

在构建阶段使用，影响打包行为：

```typescript
// 根据环境决定是否启用 mock
if (process.env.NODE_ENV === 'development') {
  // 启用 mock
}

// 根据环境决定 API 地址
const API_BASE = process.env.VITE_API_BASE;
```

这些变量在 `npm run build` 时被替换为实际值，打包后不再存在。

### 2. 运行时常量

在浏览器中使用的常量，通过 `define` 配置注入：

```typescript
// 构建时替换
console.log(__VERSION__);     // 被替换为 '1.0.0'
console.log(__BUILD_TIME__);  // 被替换为 '2024-01-15T10:30:00.000Z'
```

这些不是真正的环境变量，而是构建时的字符串替换。

## .env 文件的组织方式

### Vite 的 .env 文件规则

Vite 按以下优先级加载 .env 文件：

```
.env                    # 所有模式都加载
.env.local              # 所有模式都加载，被 git 忽略
.env.[mode]             # 只在指定模式加载
.env.[mode].local       # 只在指定模式加载，被 git 忽略
```

**优先级**：`.env.[mode].local` > `.env.[mode]` > `.env.local` > `.env`

**示例**：

```bash
# .env（所有环境通用）
VITE_APP_TITLE=My App
VITE_API_VERSION=v1

# .env.development（开发环境）
VITE_API_BASE=http://localhost:3000
VITE_ENABLE_MOCK=true

# .env.production（生产环境）
VITE_API_BASE=https://api.example.com
VITE_ENABLE_MOCK=false

# .env.local（本地覆盖，不提交到 git）
VITE_API_BASE=http://localhost:3001
```

### 变量命名规范

Vite 要求客户端可访问的变量必须以 `VITE_` 为前缀：

```bash
# ✅ 客户端可以访问
VITE_API_BASE=https://api.example.com
VITE_APP_TITLE=My App

# ❌ 客户端无法访问（安全考虑）
API_SECRET=xxx
DB_PASSWORD=xxx
```

**为什么需要前缀？** 防止敏感信息泄露到客户端代码中。

### Webpack 的环境变量

Webpack 使用 `DefinePlugin` 注入环境变量：

```javascript
// webpack.config.js
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.API_BASE': JSON.stringify(process.env.API_BASE),
    }),
  ],
};
```

Webpack 不会自动加载 .env 文件，需要配合 `dotenv`：

```javascript
// webpack.config.js
const dotenv = require('dotenv');
const env = dotenv.config({ path: `.env.${process.env.NODE_ENV}` }).parsed;

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(env),
    }),
  ],
};
```

## 模式（mode）的概念

### Vite 的模式

```bash
# 开发模式（默认）
vite              # mode = 'development'

# 生产模式
vite build        # mode = 'production'

# 自定义模式
vite build --mode staging
vite build --mode test
```

模式决定了加载哪个 .env 文件：

```bash
vite --mode staging
# 加载 .env.staging

vite build --mode production
# 加载 .env.production
```

### 模式的实际用途

```bash
# .env.development
VITE_API_BASE=http://localhost:3000
VITE_ENABLE_MOCK=true

# .env.staging
VITE_API_BASE=https://staging-api.example.com
VITE_ENABLE_MOCK=false

# .env.production
VITE_API_BASE=https://api.example.com
VITE_ENABLE_MOCK=false
```

```bash
# 开发环境
npm run dev               # 加载 .env.development

# 测试环境
npm run build -- --mode staging  # 加载 .env.staging

# 生产环境
npm run build              # 加载 .env.production
```

## define 配置

### Vite 的 define

`define` 用于在构建时替换代码中的全局常量：

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __FEATURE_FLAG__: true,
  },
});
```

```typescript
// src/app.ts
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

console.log(`App v${__APP_VERSION__} built at ${__BUILD_TIME__}`);
// 编译后变成：
// console.log(`App v1.0.0 built at 2024-01-15T10:30:00.000Z`);
```

### define 与 import.meta.env 的区别

```typescript
// import.meta.env：Vite 内置的环境变量
// 只能访问 .env 文件中的变量
console.log(import.meta.env.VITE_API_BASE);

// define：自定义全局常量
// 可以是任何值，不限于环境变量
console.log(__APP_VERSION__);
```

**什么时候用 define**：
- 版本号、构建时间等构建时确定的常量
- 功能开关（feature flags）
- 需要被 Tree Shaking 的条件代码

```typescript
// 功能开关示例
declare const __ENABLE_ANALYTICS__: boolean;

if (__ENABLE_ANALYTICS__) {
  // 这段代码在 __ENABLE_ANALYTICS__ 为 false 时会被 Tree Shaking 移除
  initAnalytics();
}
```

### Webpack 的 DefinePlugin

```javascript
// webpack.config.js
const webpack = require('webpack');
const pkg = require('./package.json');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __ENABLE_ANALYTICS__: JSON.stringify(process.env.NODE_ENV === 'production'),
    }),
  ],
};
```

## 多环境构建方案

### 环境划分的典型模式

```
development   → 本地开发，需要 mock、debug、热更新
staging       → 预发布环境，尽量接近生产
production    → 生产环境，压缩、优化、关闭 debug
test          → 测试环境，用于 CI/CD
```

不是每个项目都需要 4 个环境。小项目可能只需要 development 和 production。大项目可能需要更多（如 pre-production、canary 等）。

### 方案一：基于 .env 文件

最简单的方案，适合环境差异不大的项目：

```
.env                    # 通用配置
.env.development        # 开发环境
.env.staging            # 预发布环境
.env.production         # 生产环境
```

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:staging": "vite build --mode staging",
    "build:prod": "vite build --mode production"
  }
}
```

### 方案二：基于配置文件

适合环境差异较大的项目：

```
config/
  development.ts
  staging.ts
  production.ts
  index.ts
```

```typescript
// config/index.ts
const mode = import.meta.env.MODE || 'development';

const configs = {
  development: {
    apiBase: 'http://localhost:3000',
    enableMock: true,
    logLevel: 'debug',
  },
  staging: {
    apiBase: 'https://staging-api.example.com',
    enableMock: false,
    logLevel: 'info',
  },
  production: {
    apiBase: 'https://api.example.com',
    enableMock: false,
    logLevel: 'error',
  },
};

export default configs[mode];
```

```typescript
// 使用
import config from './config';

fetch(`${config.apiBase}/users`);
```

### 方案三：运行时配置

适合需要在部署后修改配置（不需要重新构建）：

```typescript
// public/runtime-config.js
window.__RUNTIME_CONFIG__ = {
  apiBase: 'https://api.example.com',
  featureFlag: true,
};
```

```html
<!-- index.html -->
<script src="/runtime-config.js"></script>
<script type="module" src="/src/main.ts"></script>
```

```typescript
// src/config.ts
interface RuntimeConfig {
  apiBase: string;
  featureFlag: boolean;
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__: RuntimeConfig;
  }
}

export const config = window.__RUNTIME_CONFIG__ || {
  apiBase: import.meta.env.VITE_API_BASE,
  featureFlag: false,
};
```

**优点**：部署后可以通过修改配置文件切换环境，不需要重新构建。

**缺点**：配置在运行时才确定，不能被 Tree Shaking。

## TypeScript 类型声明

为环境变量和 define 常量添加类型声明：

```typescript
// src/env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_ENABLE_MOCK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// define 常量
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
declare const __ENABLE_ANALYTICS__: boolean;
```

## 安全注意事项

### 不要泄露敏感信息

```bash
# ❌ 错误：敏感信息写入 .env 并提交到 git
# .env
VITE_API_SECRET=sk-xxxx
VITE_DB_PASSWORD=xxxx

# ✅ 正确：敏感信息只在服务端使用
# .env.local（被 git 忽略）
API_SECRET=sk-xxxx
DB_PASSWORD=xxxx
```

### 客户端环境变量的安全性

**重要**：所有以 `VITE_` 开缀的变量都会被打包到客户端代码中，任何人都可以看到。

```typescript
// ❌ 不要在客户端存储敏感信息
const secret = import.meta.env.VITE_API_SECRET;

// ✅ 敏感操作应该通过服务端 API 完成
const response = await fetch('/api/sensitive-operation');
```

### 验证环境变量

在应用启动时验证必要的环境变量：

```typescript
// src/config/validate.ts
const requiredEnvVars = [
  'VITE_API_BASE',
  'VITE_APP_TITLE',
] as const;

for (const envVar of requiredEnvVars) {
  if (!import.meta.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const config = {
  apiBase: import.meta.env.VITE_API_BASE,
  appTitle: import.meta.env.VITE_APP_TITLE,
};
```

## 常见误区

### 误区一：把所有配置都放在 .env 中

**错误理解**：.env 应该包含所有配置

**正确理解**：.env 只适合环境相关的配置（API 地址、功能开关等）。业务配置（路由、菜单等）应该放在代码中。

### 误区二：开发和生产用同一个 .env

**错误理解**：一个 .env 走天下

**正确理解**：不同环境的配置应该分开管理。开发环境可能需要 mock、debug 模式；生产环境需要优化、压缩。

### 误区三：define 可以替换任何代码

**错误理解**：define 可以替换任何 JavaScript 表达式

**正确理解**：define 做的是字符串替换，不是代码求值。`define: { FOO: 1 + 2 }` 会被替换为 `1 + 2` 而不是 `3`。需要用 `JSON.stringify()` 包装。

## 本课小结

1. **环境变量分类**：构建时变量（.env）和运行时常量（define）
2. **.env 文件规则**：按模式加载，优先级明确
3. **define 配置**：构建时替换全局常量，支持 Tree Shaking
4. **多环境方案**：.env 文件、配置文件、运行时配置，各有适用场景
5. **安全注意**：不要在客户端暴露敏感信息

## 练习

### 练习一：多环境配置

为你的项目配置 3 个环境（development、staging、production），使用 .env 文件管理。

### 练习二：运行时配置

实现一个运行时配置方案，支持在部署后修改 API 地址而不需要重新构建。

## 参考答案

### 练习一

```bash
# .env（通用）
VITE_APP_TITLE=My App

# .env.development
VITE_API_BASE=http://localhost:3000
VITE_ENABLE_MOCK=true

# .env.staging
VITE_API_BASE=https://staging-api.example.com
VITE_ENABLE_MOCK=false

# .env.production
VITE_API_BASE=https://api.example.com
VITE_ENABLE_MOCK=false
```

```json
{
  "scripts": {
    "dev": "vite",
    "build:staging": "vite build --mode staging",
    "build:prod": "vite build"
  }
}
```

### 练习二

```typescript
// public/runtime-config.js
window.__RUNTIME_CONFIG__ = {
  apiBase: 'https://api.example.com',
  featureFlag: true,
};

// src/config.ts
interface RuntimeConfig {
  apiBase: string;
  featureFlag: boolean;
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__: RuntimeConfig;
  }
}

export function getConfig(): RuntimeConfig {
  if (window.__RUNTIME_CONFIG__) {
    return window.__RUNTIME_CONFIG__;
  }

  // 回退到构建时配置
  return {
    apiBase: import.meta.env.VITE_API_BASE || '',
    featureFlag: false,
  };
}
```

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
  <script src="/runtime-config.js"></script>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

## 下一步

完成本课后，继续学习 [08. 多包构建编排](./08-multi-package-build.md)。
