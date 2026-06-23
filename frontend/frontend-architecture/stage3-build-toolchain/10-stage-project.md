# 10. 阶段项目：为组件库定制构建流程

> 使用 Vite/Rollup 打包组件库、externals、peerDependencies——让组件库可以被其他项目使用

## 本课目标

- 为组件库设计完整的构建流程
- 配置 externals 和 peerDependencies
- 生成 ESM 和 CJS 双格式产物
- 生成类型声明文件
- 验证产物的正确性

## 组件库构建 vs 应用构建

应用构建和组件库构建的目标完全不同：

| 维度 | 应用构建 | 组件库构建 |
|------|----------|------------|
| 入口 | 一个入口文件 | 多个入口（每个组件） |
| 产物 | HTML + JS + CSS | JS 模块 + 类型声明 |
| 外部依赖 | 全部打包 | 声明为 external |
| Tree Shaking | 应用层做 | 库要支持 |
| 格式 | 通常是 ESM | ESM + CJS 双格式 |
| CSS | 打包到 JS 或独立文件 | 独立文件或 CSS-in-JS |

## 项目结构

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.module.css
│   │   │   └── index.ts
│   │   ├── Input/
│   │   │   ├── Input.tsx
│   │   │   └── index.ts
│   │   └── index.ts          # 所有组件的统一导出
│   ├── utils/
│   │   └── index.ts
│   └── index.ts              # 库的入口
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── vite.config.ts
```

## 配置 package.json

```json
{
  "name": "@my-lib/ui",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./button": {
      "import": "./dist/components/Button/index.js",
      "require": "./dist/components/Button/index.cjs",
      "types": "./dist/components/Button/index.d.ts"
    },
    "./input": {
      "import": "./dist/components/Input/index.js",
      "require": "./dist/components/Input/index.cjs",
      "types": "./dist/components/Input/index.d.ts"
    },
    "./style.css": "./dist/style.css"
  },
  "files": ["dist"],
  "sideEffects": ["**/*.css"],
  "peerDependencies": {
    "react": ">=16.8.0",
    "react-dom": ">=16.8.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": false },
    "react-dom": { "optional": false }
  }
}
```

**关键配置**：

- `main`：CJS 格式入口
- `module`：ESM 格式入口
- `types`：类型声明入口
- `exports`：条件导出，支持按路径引入
- `files`：发布时包含的文件
- `sideEffects`：声明哪些文件有副作用
- `peerDependencies`：对等依赖，不会被打包

## 配置 Vite/Rollup 构建

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      exclude: ['src/**/*.test.*', 'src/**/*.spec.*'],
      rollupTypes: true, // 合并类型声明
    }),
  ],

  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },

    rollupOptions: {
      // 外部依赖，不打包
      external: ['react', 'react-dom', 'react/jsx-runtime'],

      output: {
        // 保留模块结构，支持按路径引入
        preserveModules: true,
        preserveModulesRoot: 'src',

        // 全局变量（UMD 格式时使用）
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },

    // CSS 单独打包
    cssCodeSplit: false,

    // 压缩
    minify: false, // 库通常不压缩，让使用者自己压缩
  },
});
```

## 外部依赖（externals）

### 为什么需要 externals

组件库的依赖（如 React）不应该被打包。原因：

1. **避免重复打包**：使用组件库的项目已经安装了 React，如果组件库也打包了 React，会导致两个 React 实例
2. **减小体积**：React 有 40+ KB（gzip），打包进去会大大增加库的体积
3. **版本一致性**：让使用者决定 React 版本，避免版本冲突

### 配置 externals

```typescript
// vite.config.ts
rollupOptions: {
  external: [
    // 精确匹配
    'react',
    'react-dom',

    // 匹配 react 相关的所有子路径
    /^react/,

    // 匹配 react-dom 相关的所有子路径
    /^react-dom/,

    // 如果使用了 CSS-in-JS
    '@emotion/react',
    '@emotion/styled',
  ],
}
```

### externals 的效果

```typescript
// 源码
import React from 'react';
import { useState } from 'react';

// 构建产物（external 保留 import 语句）
import React from 'react';
import { useState } from 'react';
```

外部依赖的 import 语句被保留，运行时由使用者提供。

## peerDependencies

### 什么是 peerDependencies

peerDependencies 表示"我对等依赖于某个包，但我不会安装它，使用者需要自己安装"。

```json
{
  "peerDependencies": {
    "react": ">=16.8.0",
    "react-dom": ">=16.8.0"
  }
}
```

### peerDependencies vs dependencies

| 类型 | 说明 | 示例 |
|------|------|------|
| dependencies | 直接依赖，会被安装 | axios, lodash |
| peerDependencies | 对等依赖，不会被安装 | react, vue |
| devDependencies | 开发依赖，不会被发布 | typescript, vitest |

**什么时候用 peerDependencies**：
- 依赖是框架级的（React、Vue）
- 使用者一定会安装这个依赖
- 不希望版本冲突

**什么时候用 dependencies**：
- 依赖是工具库（axios、lodash）
- 使用者可能没有安装
- 希望版本锁定

### 可选的 peerDependencies

```json
{
  "peerDependencies": {
    "react": ">=16.8.0",
    "react-dom": ">=16.8.0",
    "vue": ">=3.0.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": false },
    "react-dom": { "optional": false },
    "vue": { "optional": true }
  }
}
```

## 类型声明生成

### 使用 vite-plugin-dts

```bash
pnpm add -D vite-plugin-dts
```

```typescript
// vite.config.ts
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      exclude: ['src/**/*.test.*'],
      rollupTypes: true,        // 合并类型到一个文件
      insertTypesEntry: true,   // 自动插入 types 入口
    }),
  ],
});
```

### 类型声明的产物

```
dist/
├── index.js
├── index.cjs
├── index.d.ts              # 合并后的类型声明
├── components/
│   ├── Button/
│   │   ├── index.js
│   │   ├── index.cjs
│   │   └── index.d.ts
│   └── Input/
│       ├── index.js
│       ├── index.cjs
│       └── index.d.ts
└── style.css
```

## 完整的构建配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      exclude: ['src/**/*.test.*', 'src/**/*.spec.*'],
      rollupTypes: true,
    }),
  ],

  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },

    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        /^react/,
        /^react-dom/,
      ],

      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },

    cssCodeSplit: false,
    minify: false,
    sourcemap: true,
  },
});
```

## 构建产物验证

### 验证脚本

```typescript
// scripts/check-build.ts
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const distDir = resolve(__dirname, '../dist');

// 检查必要文件是否存在
const requiredFiles = [
  'index.js',
  'index.cjs',
  'index.d.ts',
  'style.css',
  'components/Button/index.js',
  'components/Button/index.cjs',
  'components/Button/index.d.ts',
];

let hasError = false;

for (const file of requiredFiles) {
  const filePath = resolve(distDir, file);
  if (!existsSync(filePath)) {
    console.error(`❌ Missing: ${file}`);
    hasError = true;
  } else {
    console.log(`✅ Found: ${file}`);
  }
}

// 检查 ESM 格式
const esmContent = readFileSync(resolve(distDir, 'index.js'), 'utf-8');
if (esmContent.includes('require(')) {
  console.error('❌ ESM file contains require()');
  hasError = true;
} else {
  console.log('✅ ESM format is correct');
}

// 检查 external
if (esmContent.includes('from "react"') || esmContent.includes("from 'react'")) {
  console.log('✅ React is externalized');
} else {
  console.error('❌ React might be bundled');
  hasError = true;
}

// 检查 CJS 格式
const cjsContent = readFileSync(resolve(distDir, 'index.cjs'), 'utf-8');
if (cjsContent.includes('require(')) {
  console.log('✅ CJS format is correct');
} else {
  console.error('❌ CJS file does not contain require()');
  hasError = true;
}

if (hasError) {
  console.error('\n❌ Build verification failed');
  process.exit(1);
} else {
  console.log('\n✅ Build verification passed');
}
```

```json
{
  "scripts": {
    "build": "vite build",
    "check": "tsx scripts/check-build.ts",
    "build:check": "npm run build && npm run check"
  }
}
```

### 使用构建产物

```typescript
// 在另一个项目中使用
// 1. 安装
// pnpm add @my-lib/ui

// 2. 引入组件
import { Button, Input } from '@my-lib/ui';
import '@my-lib/ui/style.css';

// 3. 按路径引入（Tree Shaking 友好）
import { Button } from '@my-lib/ui/button';
import '@my-lib/ui/style.css';
```

## CSS 处理策略

### 策略一：CSS 单独文件

```typescript
// vite.config.ts
build: {
  cssCodeSplit: false, // 所有 CSS 合并到一个文件
}
```

产物：

```
dist/
  index.js
  index.cjs
  style.css      # 所有组件的样式
```

使用者需要手动引入 CSS：

```typescript
import '@my-lib/ui/style.css';
```

### 策略二：CSS Modules

```typescript
// Button.module.css
.button {
  background: blue;
  color: white;
}

// Button.tsx
import styles from './Button.module.css';

export function Button({ children }) {
  return <button className={styles.button}>{children}</button>;
}
```

构建时 CSS Modules 会被处理成普通 CSS。

### 策略三：CSS-in-JS

如果使用 styled-components 或 emotion，CSS 会在运行时生成，不需要单独的 CSS 文件。但需要把 CSS-in-JS 库设为 external：

```typescript
external: [
  'react',
  'react-dom',
  '@emotion/react',
  '@emotion/styled',
]
```

## 发布流程

```json
{
  "scripts": {
    "build": "vite build",
    "check": "tsx scripts/check-build.ts",
    "prepublishOnly": "npm run build && npm run check",
    "release": "npm publish --access public"
  }
}
```

```bash
# 1. 构建并验证
npm run build:check

# 2. 发布
npm publish --access public

# 或者使用 changesets
pnpm changeset
pnpm changeset version
pnpm changeset publish
```

## 常见问题

### 问题一：引入组件库后样式不生效

**原因**：没有引入 CSS 文件

**解决**：在文档中明确说明需要引入 CSS

```typescript
import '@my-lib/ui/style.css';
```

### 问题二：出现两个 React 实例

**原因**：组件库打包了 React

**解决**：检查 externals 配置，确保 React 不被打包

### 问题三：TypeScript 报错找不到类型

**原因**：types 字段配置错误，或类型声明文件没有生成

**解决**：检查 package.json 中的 types 字段，确保 vite-plugin-dts 正常工作

### 问题四：按路径引入不生效

**原因**：exports 配置错误

**解决**：检查 package.json 中的 exports 字段，确保路径正确

## 常见误区

### 误区一：把所有依赖都设为 peerDependencies

**错误理解**：peerDependencies 越多越好

**正确理解**：只有框架级依赖（React、Vue）和使用者一定会安装的依赖才用 peerDependencies。工具库应该用 dependencies。

### 误区二：库不需要压缩

**错误理解**：库的产物不需要压缩

**正确理解**：库通常不压缩（让使用者自己压缩），但如果是 CDN 使用的 UMD 格式，应该压缩。

### 误区三：忽略产物验证

**错误理解**：构建成功就万事大吉

**正确理解**：构建成功不代表产物正确。需要验证格式、external、类型声明等。

## 本课小结

1. **组件库构建 vs 应用构建**：目标不同，配置不同
2. **externals**：不打包框架依赖，避免重复打包
3. **peerDependencies**：声明对等依赖，让使用者管理版本
4. **双格式产物**：ESM + CJS，满足不同使用场景
5. **类型声明**：使用 vite-plugin-dts 自动生成
6. **产物验证**：构建后必须验证产物的正确性

## 练习

### 练习一：搭建组件库构建流程

为你的组件库配置完整的构建流程，包括：
- ESM + CJS 双格式
- 类型声明
- CSS 单独文件
- externals 配置

### 练习二：验证构建产物

编写验证脚本，检查：
- 必要文件是否存在
- ESM 格式是否正确
- CJS 格式是否正确
- React 是否被 external

## 参考答案

### 练习一

```bash
# 1. 安装依赖
pnpm add -D vite @vitejs/plugin-react vite-plugin-dts

# 2. 配置 vite.config.ts
# （参考上面的完整配置）

# 3. 配置 package.json
# （参考上面的 package.json 配置）

# 4. 构建
npm run build

# 5. 检查产物
ls -la dist/
```

### 练习二

```typescript
// scripts/check-build.ts
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const distDir = resolve(__dirname, '../dist');

const checks = [
  {
    name: 'ESM entry exists',
    check: () => existsSync(resolve(distDir, 'index.js')),
  },
  {
    name: 'CJS entry exists',
    check: () => existsSync(resolve(distDir, 'index.cjs')),
  },
  {
    name: 'Types exist',
    check: () => existsSync(resolve(distDir, 'index.d.ts')),
  },
  {
    name: 'CSS exists',
    check: () => existsSync(resolve(distDir, 'style.css')),
  },
  {
    name: 'ESM format correct',
    check: () => {
      const content = readFileSync(resolve(distDir, 'index.js'), 'utf-8');
      return !content.includes('require(');
    },
  },
  {
    name: 'React externalized',
    check: () => {
      const content = readFileSync(resolve(distDir, 'index.js'), 'utf-8');
      return content.includes("from 'react'") || content.includes('from "react"');
    },
  },
];

let failed = 0;
for (const { name, check } of checks) {
  if (check()) {
    console.log(`✅ ${name}`);
  } else {
    console.error(`❌ ${name}`);
    failed++;
  }
}

process.exit(failed > 0 ? 1 : 0);
```

## 下一步

完成本阶段后，继续学习 [stage4：代码质量工程](../stage4-code-quality/README.md)。
