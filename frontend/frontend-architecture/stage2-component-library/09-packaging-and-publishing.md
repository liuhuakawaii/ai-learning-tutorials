# 09. 组件库打包与发布

> 打包不是把代码压小，是决定消费者怎么用你的代码

## 本课目标

- 理解组件库打包与应用打包的区别
- 掌握 Rollup 和 esbuild 的打包配置
- 学会配置 Tree Shaking 和 sideEffects
- 建立版本管理和发布流程

## 组件库打包 vs 应用打包

应用打包的目标是产出一个可直接运行的产物。组件库打包的目标是产出一个可被其他项目引用的产物。

| 维度 | 应用打包 | 组件库打包 |
|------|----------|------------|
| 产物 | HTML + JS + CSS | ESM + CJS + 类型声明 |
| 入口 | 单入口 | 多入口（按组件导出） |
| 外部依赖 | 打包进去 | 外部化（peerDependencies） |
| Tree Shaking | 不关键 | 关键 |
| CSS | 打包进 JS 或单独提取 | 单独导出或 CSS-in-JS |
| 类型声明 | 不需要 | 必须有 |

## 打包工具选型

### Rollup

组件库打包的主流选择。输出干净的 ESM/CJS，Tree Shaking 效果好。

```bash
npm install -D rollup @rollup/plugin-typescript @rollup/plugin-node-resolve @rollup/plugin-commonjs
```

```typescript
// rollup.config.ts
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: true,
    },
  ],
  external: ['react', 'react-dom'],
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.build.json',
      declaration: true,
      declarationDir: 'dist/types',
    }),
  ],
};
```

### esbuild

速度极快，适合开发环境和简单场景。但对 ESM 输出和代码分割的支持不如 Rollup。

```typescript
// build.ts
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  sourcemap: true,
  external: ['react', 'react-dom'],
  target: 'es2020',
  minify: true,
});
```

### Vite Library Mode

Vite 底层用 Rollup，但封装了常用配置：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [react(), dts()],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
});
```

Vite Library Mode 适合快速开始，但定制性不如直接配置 Rollup。

## 外部化依赖

组件库不应该把 React、Vue 等框架打包进去。这些是 peerDependencies：

```json
{
  "name": "@myorg/ui",
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "devDependencies": {
    "react": "18.2.0",
    "react-dom": "18.2.0"
  }
}
```

在 Rollup 中用 `external` 配置排除：

```typescript
// 排除所有 react 相关包
external: (id) => /^react(-dom)?(\/.*)?$/.test(id),
```

如果用了 CSS-in-JS 库（如 styled-components），也需要外部化：

```typescript
external: [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'styled-components',
],
```

## Tree Shaking

### 什么是 Tree Shaking

Tree Shaking 是打包工具移除未使用代码的能力。组件库做好 Tree Shaking，消费者只打包用到的组件，不会把整个库都打进去。

### Tree Shaking 的前提

1. **使用 ESM 格式**：`import` / `export` 是静态的，打包工具可以分析依赖
2. **不要有副作用**：模块执行时不应该修改全局状态
3. **正确配置 sideEffects**

### sideEffects

`package.json` 中的 `sideEffects` 字段告诉打包工具哪些文件有副作用：

```json
{
  "sideEffects": false
}
```

这意味着所有模块都没有副作用，可以安全地 Tree Shake。

如果某些文件有副作用（如全局样式注册、polyfill）：

```json
{
  "sideEffects": [
    "*.css",
    "./src/polyfills.ts"
  ]
}
```

### 常见的副作用

```typescript
// 有副作用：模块加载时修改了全局状态
globalThis.__MY_LIB_VERSION__ = '1.0.0';

// 有副作用：模块加载时执行了操作
console.log('Library loaded');

// 有副作用：模块加载时注册了自定义元素
customElements.define('my-button', MyButtonElement);

// 无副作用：只导出函数和类型
export function Button() { ... }
export type ButtonProps = { ... };
```

### 导出结构优化

**不要这样做**：

```typescript
// src/index.ts
export * from './Button';
export * from './Input';
export * from './Select';
export * from './Table';
export * from './Form';
// ... 50 个组件
```

消费者写 `import { Button } from '@myorg/ui'` 时，打包工具需要分析整个 index.ts 才能确定只用了 Button。

**推荐做法**：

同时提供顶层导出和组件级导出：

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.cjs.js",
      "types": "./dist/types/index.d.ts"
    },
    "./Button": {
      "import": "./dist/Button.esm.js",
      "require": "./dist/Button.cjs.js",
      "types": "./dist/types/Button/index.d.ts"
    },
    "./Input": {
      "import": "./dist/Input.esm.js",
      "require": "./dist/Input.cjs.js",
      "types": "./dist/types/Input/index.d.ts"
    }
  }
}
```

消费者可以按需导入：

```typescript
// 从顶层导入（依赖 Tree Shaking）
import { Button } from '@myorg/ui';

// 直接导入组件（最可靠）
import { Button } from '@myorg/ui/Button';
```

## CSS 处理

### 方案一：CSS-in-JS

styled-components、emotion 等方案不需要额外处理 CSS，样式随组件一起打包。

### 方案二：CSS 文件单独导出

```typescript
// rollup.config.ts
import postcss from 'rollup-plugin-postcss';

export default {
  plugins: [
    postcss({
      extract: 'styles.css', // 提取为单独文件
      minimize: true,
    }),
  ],
};
```

消费者需要手动引入样式：

```typescript
import { Button } from '@myorg/ui';
import '@myorg/ui/styles.css';
```

### 方案三：CSS Modules

CSS Modules 在构建时处理，产出的 JavaScript 中只有 className 字符串：

```typescript
// 构建前
import styles from './Button.module.css';
<button className={styles.button} />

// 构建后
<button className="Button_button__abc123" />
```

CSS 文件单独导出，消费者引入即可。

## 类型声明

### 生成类型声明

TypeScript 编译器生成 `.d.ts` 文件：

```json
// tsconfig.build.json
{
  "compilerOptions": {
    "declaration": true,
    "declarationDir": "dist/types",
    "emitDeclarationOnly": true
  },
  "include": ["src"]
}
```

或者用 `vite-plugin-dts` 自动生成。

### package.json 配置

```json
{
  "types": "dist/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/index.esm.js",
      "require": "./dist/index.cjs.js"
    }
  }
}
```

`types` 字段在 `exports` 中要放在最前面，TypeScript 会优先读取。

## 版本管理

### 语义化版本

```
MAJOR.MINOR.PATCH

MAJOR：不兼容的 API 变更
MINOR：向后兼容的功能新增
PATCH：向后兼容的 Bug 修复
```

组件库的版本管理比应用更严格，因为消费者依赖你的 API 稳定性。

### 变更日志

使用 conventional-changelog 自动生成 CHANGELOG：

```bash
npm install -D conventional-changelog-cli
```

```json
{
  "scripts": {
    "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s"
  }
}
```

### 使用 changesets

changesets 是 monorepo 场景下更好的选择：

```bash
npm install -D @changesets/cli
npx changeset init
```

创建变更集：

```bash
npx changeset
# 选择包
# 选择版本类型（patch/minor/major）
# 描述变更
```

发布：

```bash
npx changeset version   # 更新版本号和 CHANGELOG
npx changeset publish   # 发布到 npm
```

## 发布流程

### package.json 配置

```json
{
  "name": "@myorg/ui",
  "version": "1.0.0",
  "main": "./dist/index.cjs.js",
  "module": "./dist/index.esm.js",
  "types": "./dist/types/index.d.ts",
  "files": [
    "dist"
  ],
  "sideEffects": false,
  "scripts": {
    "build": "rollup -c",
    "test": "vitest run",
    "lint": "eslint src --ext .ts,.tsx",
    "prepublishOnly": "npm run lint && npm run test && npm run build"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

`files` 字段指定发布到 npm 的文件，只包含 `dist` 目录。

`prepublishOnly` 确保发布前通过所有检查。

### npm 发布

```bash
# 登录
npm login

# 发布（首次）
npm publish --access public

# 更新版本
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0

# 发布更新
npm publish
```

### GitHub Actions 自动发布

```yaml
# .github/workflows/publish.yml
name: Publish
on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 实战：完整打包配置

### 项目结构

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.module.css
│   │   │   └── index.ts
│   │   ├── Input/
│   │   └── index.ts
│   ├── hooks/
│   ├── styles/
│   └── index.ts
├── rollup.config.ts
├── tsconfig.build.json
├── package.json
└── .changeset/
```

### Rollup 完整配置

```typescript
// rollup.config.ts
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import { globSync } from 'glob';
import path from 'path';

// 获取所有组件入口
const componentEntries = Object.fromEntries(
  globSync('src/components/*/index.ts').map((file) => [
    path.dirname(file).split('/').pop(),
    file,
  ])
);

export default [
  // 主入口
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/index.cjs.js',
        format: 'cjs',
        sourcemap: true,
      },
    ],
    external: (id) =>
      /^react(-dom)?(\/.*)?$/.test(id) ||
      /^styled-components(\/.*)?$/.test(id),
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.build.json',
        declaration: true,
        declarationDir: 'dist/types',
      }),
      postcss({
        extract: 'styles.css',
        minimize: true,
      }),
    ],
  },
  // 组件级入口（用于按需导入）
  ...Object.entries(componentEntries).map(([name, input]) => ({
    input,
    output: [
      {
        file: `dist/${name}.esm.js`,
        format: 'esm',
      },
      {
        file: `dist/${name}.cjs.js`,
        format: 'cjs',
      },
    ],
    external: (id) =>
      /^react(-dom)?(\/.*)?$/.test(id) ||
      /^styled-components(\/.*)?$/.test(id) ||
      /^\.\//.test(id) ||
      /^\.\.\//.test(id),
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.build.json',
        declaration: false,
      }),
      postcss({
        extract: false,
        modules: true,
      }),
    ],
  })),
];
```

## 常见误区

### 误区一：把所有依赖都打包

组件库应该外部化框架依赖（React、Vue）和大型库。把 React 打包进去会导致包体积暴增，而且消费者项目中会有两份 React。

### 误区二：只提供 CJS 格式

CJS 不支持 Tree Shaking。如果只提供 CJS，消费者无法按需导入。ESM 是必须的，CJS 是为了兼容老项目。

### 误区三：不提供类型声明

没有类型声明的 TypeScript 组件库等于没有 API 文档。TypeScript 用户无法获得自动补全和类型检查。

## 本课小结

1. **组件库打包与应用打包不同**：需要 ESM + CJS 双格式，外部化依赖
2. **Rollup 是主流选择**：输出干净，Tree Shaking 效果好
3. **sideEffects 必须配置**：确保消费者能正确 Tree Shake
4. **类型声明不可或缺**：`types` 字段放在 `exports` 最前面
5. **语义化版本 + changesets**：严格管理版本变更

## 练习

### 练习一：配置 Rollup 打包

为一个包含 Button 和 Input 两个组件的项目配置 Rollup 打包，要求：
- 输出 ESM 和 CJS 格式
- 外部化 React
- 生成类型声明
- CSS 单独提取

### 练习二：验证 Tree Shaking

创建一个测试项目，只导入 Button 组件，验证打包后不包含 Input 的代码。

## 参考答案

### 练习一

```typescript
// rollup.config.ts
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';

export default [
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.esm.js', format: 'esm', sourcemap: true },
      { file: 'dist/index.cjs.js', format: 'cjs', sourcemap: true },
    ],
    external: (id) => /^react(-dom)?(\/.*)?$/.test(id),
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.build.json',
        declaration: true,
        declarationDir: 'dist/types',
      }),
      postcss({ extract: 'styles.css', minimize: true }),
    ],
  },
  {
    input: 'src/components/Button/index.ts',
    output: [
      { file: 'dist/Button.esm.js', format: 'esm' },
      { file: 'dist/Button.cjs.js', format: 'cjs' },
    ],
    external: (id) => /^react(-dom)?(\/.*)?$/.test(id),
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.build.json', declaration: false }),
      postcss({ extract: false, modules: true }),
    ],
  },
  {
    input: 'src/components/Input/index.ts',
    output: [
      { file: 'dist/Input.esm.js', format: 'esm' },
      { file: 'dist/Input.cjs.js', format: 'cjs' },
    ],
    external: (id) => /^react(-dom)?(\/.*)?$/.test(id),
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.build.json', declaration: false }),
      postcss({ extract: false, modules: true }),
    ],
  },
];
```

### 练习二

```typescript
// test-tree-shaking/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'stats.html',
      gzipSize: true,
    }),
  ],
});

// test-tree-shaking/src/App.tsx
import { Button } from '@myorg/ui';
// 故意不导入 Input

function App() {
  return <Button>Click me</Button>;
}
```

```bash
# 构建并查看分析报告
npm run build
open stats.html
```

在分析报告中确认：dist/Input 相关代码不包含在产物中。

## 下一步

完成本课后，继续学习 [10. 阶段项目：设计并实现 Button 组件](./10-stage-project.md)。
