# 09. 构建产物分析

> bundle analyzer、Tree Shaking 验证、dead code 检测——弄清楚产物里到底有什么

## 本课目标

- 掌握构建产物的分析方法
- 验证 Tree Shaking 是否生效
- 学会检测和清理死代码
- 建立产物体积的持续监控

## 为什么要分析构建产物

你可能遇到过这样的情况：

```bash
# 项目构建完成后
$ ls -lh dist/assets/
total 3.2M
-rw-r--r--  1 user  staff   2.1M  main.js
-rw-r--r--  1 user  staff   850K  vendor.js
-rw-r--r--  1 user  staff   120K  styles.css
```

2.1 MB 的 main.js，里面到底有什么？是业务代码太多，还是第三方库太大？是 Tree Shaking 没生效，还是引入了不需要的模块？

**不分析产物，你就不知道优化该从哪里下手。**

## 使用 Rollup Plugin Visualizer（Vite）

```bash
pnpm add -D rollup-plugin-visualizer
```

```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      open: true,           // 构建后自动打开报告
      filename: 'stats.html',
      gzipSize: true,       // 显示 gzip 后的体积
      brotliSize: true,     // 显示 brotli 后的体积
    }),
  ],
});
```

```bash
npm run build
# 自动打开 stats.html
```

报告会显示：
- 每个模块的体积占比
- 模块之间的依赖关系
- 哪些模块占用了最多的空间

## 使用 webpack-bundle-analyzer（Webpack）

```bash
pnpm add -D webpack-bundle-analyzer
```

```javascript
// webpack.config.js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',      // 生成静态报告
      reportFilename: 'report.html',
      openAnalyzer: false,          // 不自动打开
      generateStatsFile: true,      // 生成 stats.json
      statsFilename: 'stats.json',
    }),
  ],
};
```

```bash
# 或者通过环境变量控制
ANALYZE=true npm run build
```

### 分析报告的解读

**1. 识别大模块**

```
vendor.js (850 KB)
├── lodash.js (250 KB)     ← 全量引入了 lodash
├── moment.js (200 KB)     ← moment 本身很大
├── antd.js (300 KB)       ← 没有按需引入
└── 其他 (100 KB)
```

**2. 识别重复模块**

```
main.js
└── react (50 KB)

vendor.js
└── react (50 KB)          ← react 被打包了两次
```

**3. 识别不需要的模块**

```
vendor.js
└── lodash.js (250 KB)
    ├── get.js (5 KB)      ← 用了
    ├── set.js (5 KB)      ← 用了
    └── ... 其他 240 KB    ← 没用到，但被打包了
```

## Tree Shaking 验证

### 什么是 Tree Shaking

Tree Shaking 是指在打包时移除没有被使用的代码（dead code）。它依赖 ESM 的静态分析能力。

```typescript
// utils.ts
export function add(a: number, b: number) {
  return a + b;
}

export function subtract(a: number, b: number) {
  return a - b;
}

export function multiply(a: number, b: number) {
  return a * b;
}
```

```typescript
// main.ts
import { add } from './utils';
console.log(add(1, 2));
```

如果 Tree Shaking 生效，`subtract` 和 `multiply` 不会被打包。

### 验证 Tree Shaking 是否生效

**方法一：搜索未使用的导出**

```bash
# 构建后在产物中搜索
grep -r "subtract" dist/
# 如果没有找到，说明 Tree Shaking 生效了
```

**方法二：使用 source-map-explorer**

```bash
pnpm add -D source-map-explorer

# 构建时生成 source map
# vite.config.ts: build.sourcemap = true

npx source-map-explorer dist/assets/main-*.js
```

**方法三：使用 Knip**

```bash
pnpm add -D knip

# 检测未使用的导出
npx knip
```

Knip 会分析项目中的导出和导入，找出没有被使用的代码。

### Tree Shaking 失败的常见原因

**1. 使用了 CommonJS 格式**

```javascript
// ❌ CommonJS 无法 Tree Shaking
const utils = require('./utils');
module.exports = { add: utils.add };

// ✅ ESM 可以 Tree Shaking
export { add } from './utils';
```

**2. 有副作用的模块**

```typescript
// side-effects.ts
console.log('This module has side effects');
export const value = 42;
```

如果模块有副作用（执行时有外部影响），Tree Shaking 不会移除它。

**解决方案**：在 package.json 中声明无副作用：

```json
{
  "sideEffects": false
}
```

或者指定哪些文件有副作用：

```json
{
  "sideEffects": [
    "*.css",
    "./src/polyfills.ts"
  ]
}
```

**3. 动态访问**

```typescript
// ❌ 动态访问，无法静态分析
const utils = require('./utils');
const fn = utils[someKey]; // 不知道用了哪个导出

// ✅ 静态访问
import { add } from './utils';
```

**4. 某些库不支持 Tree Shaking**

```typescript
// ❌ lodash 不支持 Tree Shaking
import { debounce } from 'lodash';

// ✅ 使用 lodash-es（ESM 格式）
import { debounce } from 'lodash-es';

// ✅ 或者使用按需引入
import debounce from 'lodash/debounce';
```

## Dead Code 检测

### 使用 Knip

Knip 是一个强大的死代码检测工具：

```bash
pnpm add -D knip
```

```json
// knip.json
{
  "entry": ["src/main.ts"],
  "project": ["src/**/*.{ts,tsx}"]
}
```

```bash
npx knip
```

输出示例：

```
Unused files (3)
  src/utils/old-helper.ts
  src/components/DeprecatedButton.tsx
  src/pages/legacy/OldPage.tsx

Unused dependencies (2)
  moment
  lodash

Unlisted dependencies (1)
  axios

Unused exports (5)
  src/utils/format.ts: formatDate
  src/utils/validate.ts: isValidEmail
```

### 使用 ts-prune

```bash
pnpm add -D ts-prune

npx ts-prune
```

输出示例：

```
src/utils/format.ts:12 - formatDate
src/utils/validate.ts:5 - isValidEmail
src/components/Button.tsx:30 - ButtonVariant
```

### 手动检测

```bash
# 搜索只导出但没有被导入的函数
# 1. 找出所有导出
grep -r "export function" src/ | awk '{print $3}' | sort > exports.txt

# 2. 找出所有导入
grep -r "import.*from" src/ | grep -oP '\{[^}]+\}' | tr ',' '\n' | tr -d '{} ' | sort > imports.txt

# 3. 找出没有被导入的导出
comm -23 exports.txt imports.txt
```

## 产物体积监控

### 使用 size-limit

```bash
pnpm add -D size-limit @size-limit/preset-app
```

```json
// package.json
{
  "size-limit": [
    {
      "path": "dist/assets/main-*.js",
      "limit": "200 KB",
      "gzip": true
    },
    {
      "path": "dist/assets/vendor-*.js",
      "limit": "300 KB",
      "gzip": true
    }
  ],
  "scripts": {
    "size": "size-limit",
    "size:check": "size-limit --check"
  }
}
```

```bash
# 查看体积
pnpm size

# 检查是否超限（CI 中使用）
pnpm size:check
```

### 使用 bundlesize

```bash
pnpm add -D bundlesize
```

```json
// package.json
{
  "bundlesize": [
    {
      "path": "./dist/assets/main-*.js",
      "maxSize": "200 kB",
      "compression": "gzip"
    }
  ]
}
```

### CI 集成

```yaml
# .github/workflows/size.yml
name: Bundle Size
on: [pull_request]

jobs:
  size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - name: Check bundle size
        run: pnpm size:check
```

## 常见的优化手段

### 1. 替换大依赖

```typescript
// ❌ moment.js (200 KB)
import moment from 'moment';
moment().format('YYYY-MM-DD');

// ✅ date-fns (按需引入，~5 KB)
import { format } from 'date-fns';
format(new Date(), 'yyyy-MM-dd');

// ✅ dayjs (2 KB)
import dayjs from 'dayjs';
dayjs().format('YYYY-MM-DD');
```

### 2. 按需引入

```typescript
// ❌ 全量引入 antd
import 'antd/dist/antd.css';

// ✅ 按需引入
import { Button, Input } from 'antd';
```

### 3. 使用 ESM 格式

```typescript
// ❌ CommonJS 格式，无法 Tree Shaking
import _ from 'lodash';
_.debounce(fn, 300);

// ✅ ESM 格式，支持 Tree Shaking
import { debounce } from 'lodash-es';
debounce(fn, 300);
```

### 4. 代码压缩

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    minify: 'terser', // 比 esbuild 压缩率更高
    terserOptions: {
      compress: {
        drop_console: true,  // 删除 console
        drop_debugger: true, // 删除 debugger
        pure_funcs: ['console.log'], // 删除特定函数调用
      },
    },
  },
});
```

## 实战：分析一个真实项目

### 步骤 1：构建并生成报告

```bash
# Vite 项目
pnpm add -D rollup-plugin-visualizer

# vite.config.ts 添加 visualizer 插件
# 构建
npm run build

# 打开 stats.html 查看报告
```

### 步骤 2：识别问题

```
报告中发现：
1. lodash 被全量引入（250 KB），但只用了 3 个函数
2. moment.js (200 KB) 可以用 dayjs 替代
3. antd 没有按需引入（300 KB）
4. react 被打包了两次（main 和 vendor 各一份）
```

### 步骤 3：逐个优化

```typescript
// 1. 替换 lodash
// 之前：import _ from 'lodash';
// 之后：import { debounce, throttle } from 'lodash-es';

// 2. 替换 moment
// 之前：import moment from 'moment';
// 之后：import dayjs from 'dayjs';

// 3. antd 按需引入
// 之前：import 'antd/dist/antd.css';
// 之后：按组件引入，配合 vite-plugin-imp

// 4. 检查 react 重复打包
// 配置 resolve.alias 确保只有一个 react 实例
```

### 步骤 4：验证优化效果

```bash
# 优化前
main.js    2.1 MB
vendor.js  850 KB

# 优化后
main.js    450 KB
vendor.js  280 KB

# 总体积从 2.95 MB 降到 730 KB，减少 75%
```

## 常见误区

### 误区一：只看总大小，不看组成

**错误理解**：产物小就是好

**正确理解**：产物小可能是因为功能少，也可能是因为有用的代码被误删了。要分析组成，确保该有的代码都在。

### 误区二：Tree Shaking 可以解决所有问题

**错误理解**：开了 Tree Shaking 就不用管代码质量了

**正确理解**：Tree Shaking 只能移除未使用的导出。如果代码本身写得不好（如全量引入），Tree Shaking 帮不了你。

### 误区三：优化是一次性的

**错误理解**：分析一次就够了

**正确理解**：随着项目发展，产物体积会增长。需要持续监控，定期分析。

## 本课小结

1. **产物分析工具**：rollup-plugin-visualizer、webpack-bundle-analyzer、source-map-explorer
2. **Tree Shaking 验证**：搜索未使用导出、使用 Knip 检测
3. **Dead Code 检测**：Knip、ts-prune、手动检测
4. **体积监控**：size-limit、bundlesize、CI 集成
5. **常见优化**：替换大依赖、按需引入、使用 ESM 格式

## 练习

### 练习一：产物分析

分析你当前项目的构建产物，找出最大的 3 个模块，思考优化方案。

### 练习二：Tree Shaking 验证

验证你项目中的 Tree Shaking 是否生效，找出失效的原因并修复。

## 参考答案

### 练习一

```bash
# 1. 安装分析工具
pnpm add -D rollup-plugin-visualizer

# 2. 配置 vite.config.ts
# plugins: [visualizer({ open: true })]

# 3. 构建并查看报告
npm run build

# 4. 分析结果示例
# 最大的 3 个模块：
# - antd (300 KB) → 按需引入
# - lodash (250 KB) → 换成 lodash-es
# - moment (200 KB) → 换成 dayjs
```

### 练习二

```bash
# 1. 检查是否有 CommonJS 格式的依赖
grep -r "require(" src/

# 2. 检查 package.json 中的 sideEffects 配置
cat package.json | grep sideEffects

# 3. 构建后搜索未使用的导出
grep -r "subtract" dist/

# 4. 使用 Knip 检测
npx knip
```

## 下一步

完成本课后，继续学习 [10. 阶段项目：为组件库定制构建流程](./10-stage-project.md)。
