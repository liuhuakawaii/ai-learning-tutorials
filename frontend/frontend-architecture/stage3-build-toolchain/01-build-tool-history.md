# 01. 构建工具演进史

> 从 Script 标签到 Bundler 到 No-Bundler，理解构建工具为什么存在

## 本课目标

- 理解前端构建工具演进的内在逻辑
- 明确每一代构建工具解决了什么问题、留下了什么问题
- 建立判断"什么时候需要构建工具"的能力

## 一切从 Script 标签说起

在前端工程化还没有成体系的年代，页面开发是这样的：

```html
<script src="jquery.js"></script>
<script src="utils.js"></script>
<script src="header.js"></script>
<script src="main.js"></script>
```

这种模式在项目规模小的时候没什么问题。但当项目增长到几十个文件时，麻烦就来了：

1. **顺序依赖**：`header.js` 依赖 `utils.js`，必须保证 script 标签顺序正确
2. **全局污染**：所有变量都在全局作用域，命名冲突是家常便饭
3. **重复请求**：每个页面都要加载一遍相同的脚本
4. **没有代码复用**：想用另一个文件里的函数，只能靠全局变量

这些问题不是"代码写得不好"，而是浏览器本身不支持模块化。我们需要一种机制，让代码可以按模块组织、按依赖加载。

## 模块化的尝试：从 IIFE 到 CommonJS

### IIFE 模拟模块

在原生模块系统出现之前，开发者用立即执行函数模拟模块：

```javascript
// utils.js
var Utils = (function () {
  var _private = 'secret';

  return {
    formatDate: function (date) {
      return date.toLocaleDateString();
    },
  };
})();

// main.js
Utils.formatDate(new Date());
```

这解决了全局污染问题，但没有解决依赖管理和代码复用。

### AMD 和 RequireJS

AMD（Asynchronous Module Definition）是为浏览器设计的模块系统，RequireJS 是它的实现：

```javascript
// 定义模块
define('utils', [], function () {
  return {
    formatDate: function (date) {
      return date.toLocaleDateString();
    },
  };
});

// 使用模块
require(['utils'], function (utils) {
  console.log(utils.formatDate(new Date()));
});
```

AMD 解决了浏览器端的模块化问题，但语法太啰嗦。每个模块都要用 `define` 包裹，使用时要写回调函数。开发者不喜欢这种写法。

### CommonJS：Node.js 的模块系统

Node.js 带来了 CommonJS：

```javascript
// utils.js
const fs = require('fs');

function formatDate(date) {
  return date.toLocaleDateString('zh-CN');
}

module.exports = { formatDate };

// main.js
const { formatDate } = require('./utils');
console.log(formatDate(new Date()));
```

CommonJS 解决了模块化问题，但它是为服务端设计的——`require` 是同步加载，在浏览器中行不通。

## Bundler 时代：Webpack 的崛起

浏览器不支持 CommonJS，但开发者需要模块化。解决方案是：在发布之前，把所有模块打包成一个或几个浏览器能运行的文件。

这就是 Bundler 的核心价值——**把开发者写的模块代码转换成浏览器能运行的产物**。

在 Webpack 之前，Browserify 是第一个流行的 Bundler。它做的事情很简单：把 CommonJS 模块打包成浏览器能运行的 IIFE。

```bash
# Browserify 的使用方式
browserify src/main.js -o bundle.js
```

```javascript
// 输入（CommonJS）
const utils = require('./utils');
console.log(utils.formatDate(new Date()));

// 输出（IIFE）
(function () {
  const utils = { formatDate: function (date) { /* ... */ } };
  console.log(utils.formatDate(new Date()));
})();
```

Browserify 解决了模块化问题，但它的扩展能力有限。当你需要处理 TypeScript、Sass、图片等非 JavaScript 资源时，Browserify 就力不从心了。

### Webpack 做了什么

Webpack 的核心能力：

```javascript
// webpack.config.js
module.exports = {
  entry: './src/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
```

它从入口文件开始，递归分析 `import` / `require`，构建依赖图，然后把所有模块打包成一个文件。

但 Webpack 不止于此。它的真正价值是 **Loader 和 Plugin 机制**——通过扩展，几乎可以处理任何类型的资源：

```javascript
module.exports = {
  module: {
    rules: [
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.tsx?$/, use: 'ts-loader' },
      { test: /\.(png|jpg)$/, type: 'asset/resource' },
    ],
  },
  plugins: [new HtmlWebpackPlugin(), new MiniCssExtractPlugin()],
};
```

CSS、图片、字体、TypeScript、Sass——Webpack 统统能处理。这让它成为了 2016-2020 年前端工程的事实标准。

### Webpack 的代价

Webpack 的问题不是功能不够，而是**随着项目规模增长，开发体验会急剧恶化**：

```bash
# 一个中型项目的启动时间
$ time npm run dev
webpack compiled successfully
npm run dev  45.32s
```

45 秒启动一个开发服务器。改一行代码，热更新要 2-3 秒。这不是配置问题，而是架构问题——Webpack 必须把整个项目打包完才能启动开发服务器。模块越多，启动越慢。

**冷启动问题的根因**：

```
源码 → 解析所有模块 → 构建完整依赖图 → 打包成 bundle → 启动 dev server
```

不管用户访问哪个页面，Webpack 都要先处理完整个项目。在几百个模块的项目中，这可以接受；在几千个模块的项目中，这就变成了噩梦。

## No-Bundler 时代：Vite 的思路

Vite 的核心思路是：**开发环境不需要打包**。

现代浏览器原生支持 ES Modules：

```html
<script type="module" src="/src/main.js"></script>
```

```javascript
// src/main.js
import { formatDate } from './utils.js'; // 浏览器原生支持
```

浏览器遇到 `import` 会自动发起 HTTP 请求去获取模块。Vite 要做的只是：**启动一个 Dev Server，按需返回编译后的模块**。

```
浏览器请求 /src/main.js
  → Vite 拦截请求
  → 用 esbuild 编译（极快）
  → 返回编译结果
  → 浏览器遇到新的 import，继续请求
  → Vite 按需编译
```

**对比**：

| 维度 | Webpack | Vite |
|------|---------|------|
| 启动方式 | 先打包，再启动 | 先启动，按需编译 |
| 启动时间 | O(n)，模块越多越慢 | O(1)，几乎瞬间启动 |
| HMR | 重新打包受影响的模块链 | 只更新变化的模块 |
| 生产构建 | Webpack 自身 | Rollup（或 esbuild） |

这不是 Vite 比 Webpack "更先进"，而是它们解决的问题不同：

- **Webpack**：解决的是"如何把 CommonJS 模块打包成浏览器能运行的代码"
- **Vite**：解决的是"浏览器已经支持 ESM 了，开发环境还需要打包吗"

## 构建工具的核心职责

无论工具怎么演进，构建工具的核心职责没变：

### 1. 模块化支持

```
开发者写的模块代码 → 构建工具处理 → 浏览器能运行的代码
```

- 过去：CommonJS → IIFE Bundle
- 现在：ESM → ESM（开发环境几乎不需要转换）

### 2. 代码转换

```
TypeScript / JSX / Sass / PostCSS → JavaScript / CSS
```

这一步不会消失。即使浏览器原生支持更多特性，开发者仍然需要编译时的代码转换能力。

### 3. 资源处理

```
图片 / 字体 / SVG → 优化后的、带 hash 的静态资源
```

图片压缩、格式转换、字体子集化——这些都需要构建时处理。

### 4. 优化与打包

```
开发代码 → Tree Shaking → Code Splitting → Minify → 生产产物
```

生产环境仍然需要打包。Vite 的生产构建用的是 Rollup，不是"零构建"。

### 5. 开发体验

```
文件变化 → 快速反馈 → 保持状态
```

HMR（热模块替换）、Source Map、Error Overlay——这些直接影响开发效率。

## Gulp 时代：任务运行器

在 Webpack 成为主流之前，Gulp 是另一个重要的构建工具。和 Webpack 不同，Gulp 的定位是**任务运行器**，而不是模块打包器。

```javascript
// gulpfile.js
const gulp = require('gulp');
const sass = require('gulp-sass');
const uglify = require('gulp-uglify');
const rename = require('gulp-rename');

// 编译 Sass
gulp.task('styles', () => {
  return gulp.src('src/scss/**/*.scss')
    .pipe(sass())
    .pipe(gulp.dest('dist/css'));
});

// 压缩 JavaScript
gulp.task('scripts', () => {
  return gulp.src('src/js/**/*.js')
    .pipe(uglify())
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('dist/js'));
});

// 监听文件变化
gulp.task('watch', () => {
  gulp.watch('src/scss/**/*.scss', gulp.series('styles'));
  gulp.watch('src/js/**/*.js', gulp.series('scripts'));
});

gulp.task('default', gulp.parallel('styles', 'scripts', 'watch'));
```

Gulp 的核心是**流（Stream）**——文件通过管道（pipe）依次经过各个处理步骤。这种模型很直观，但有一个问题：Gulp 不理解模块之间的依赖关系。

```
Gulp：文件 → 处理步骤1 → 处理步骤2 → 输出
Webpack：入口 → 依赖图 → 打包 → 输出
```

Gulp 适合处理"文件到文件"的转换（编译 Sass、压缩图片），但不适合处理"模块到模块"的打包。这就是为什么 Webpack 最终取代了 Gulp 在前端构建中的地位。

### Gulp 和 Webpack 的关系

它们不是替代关系，而是互补关系。在早期的项目中，常见这样的组合：

```
Gulp：负责任务编排（编译 Sass、压缩图片、启动服务器）
Webpack：负责模块打包（JavaScript 模块化）
```

随着 Webpack 的 Loader 和 Plugin 生态越来越完善，Gulp 的职责逐渐被 Webpack 吞并。到了 Webpack 4+，大多数项目已经不需要 Gulp 了。

## 现代编译器：esbuild 和 SWC

在 Vite 出现之前，构建工具的性能瓶颈主要在**编译**环节。用 JavaScript 写的 Babel 和 Terser，处理几十万个模块时需要几十秒。

esbuild 和 SWC 的思路是：**用更快的语言重写编译器**。

### esbuild：Go 语言实现

```bash
# esbuild 的速度对比
babel (JavaScript)     45.3s
esbuild (Go)           0.37s   # 快 100 倍以上
```

esbuild 可以作为独立工具使用：

```bash
# 编译 TypeScript
esbuild src/main.tsx --bundle --outfile=dist/main.js

# 压缩
esbuild src/main.tsx --bundle --minify --outfile=dist/main.js

# 生成 ESM 格式
esbuild src/main.tsx --bundle --format=esm --outfile=dist/main.js
```

```javascript
// 也可以作为库使用
const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  format: 'esm',
  outdir: 'dist',
});
```

### SWC：Rust 语言实现

SWC 的定位和 esbuild 类似，但更侧重于作为 Babel 的替代品：

```javascript
// .swcrc
{
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "tsx": true
    },
    "transform": {
      "react": {
        "runtime": "automatic"
      }
    }
  }
}
```

SWC 被 Next.js 用作默认编译器，也被 Turbopack（Webpack 的继任者）用作底层编译器。

### esbuild vs SWC

| 维度 | esbuild | SWC |
|------|---------|-----|
| 语言 | Go | Rust |
| 速度 | 极快 | 很快 |
| 功能 | 打包 + 编译 | 编译为主 |
| 插件 | 有限 | 兼容 Babel 插件 |
| 使用者 | Vite、Deno | Next.js、Turbopack |

两者都比 JavaScript 编写的工具快 10-100 倍。选择哪个取决于你的需求。

## 工具选型：不是越新越好

### 什么时候用 Vite

- 新项目，没有历史包袱
- 对开发启动速度有要求
- 项目不需要 Webpack 特有的功能（如 Module Federation）
- 团队愿意学习新工具

### 什么时候用 Webpack

- 已有 Webpack 项目，迁移成本大于收益
- 需要 Module Federation 做微前端
- 需要 Webpack 特有的 Plugin 生态
- 团队对 Webpack 更熟悉

### 什么时候用 esbuild / SWC

- 需要极致的编译速度
- 作为其他工具的底层编译器
- 简单的项目打包（不需要复杂的代码分割）

### 什么时候用 Rollup

- 打包库和组件库（产物干净、支持 ESM）
- 需要精确控制打包行为
- 不需要 Dev Server

### 选错工具的代价

选错工具不是"用哪个都行"的问题，而是会有实际的工程代价：

**场景一：小项目用了 Webpack**

一个简单的静态站点，用 Webpack 需要写 200 行配置。换成 Vite，5 行配置就能搞定。维护 200 行配置的时间成本是实实在在的。

**场景二：大型项目用了 Vite 但遇到兼容问题**

项目依赖了某个只支持 CJS 的旧包，Vite 的预构建处理不了。这时候要么花时间找替代包，要么回退到 Webpack。迁移的时间成本可能比优化 Webpack 更高。

**场景三：组件库用了 Webpack 打包**

Webpack 的产物包含运行时代码（模块加载器），不够干净。Rollup 的产物是纯粹的 ESM，更适合库的分发。

**判断原则**：

```
先评估需求 → 再选工具 → 遇到问题再调整
而不是：先选工具 → 再想办法适配需求
```

## 构建配置的本质

不管用什么工具，构建配置本质上是在回答这几个问题：

```javascript
// 1. 入口在哪？
entry: './src/main.js'

// 2. 产物放哪？
output: { path: './dist' }

// 3. 怎么处理不同类型的文件？
rules: [{ test: /\.tsx$/, use: 'ts-loader' }]

// 4. 开发环境怎么配？
devServer: { port: 3000 }

// 5. 生产环境怎么优化？
optimization: { splitChunks: true, minimize: true }

// 6. 有哪些额外操作？
plugins: [new CopyPlugin(), new CompressionPlugin()]
```

理解了这几个问题，你就能看懂任何构建工具的配置。

## 常见误区

### 误区一：构建工具越新越好

**错误理解**：Vite 比 Webpack 好，应该全面迁移到 Vite

**正确理解**：工具是为了解决问题。已有项目运行良好，不需要为了追新而迁移。迁移有成本，也有风险。

### 误区二：构建配置越复杂越好

**错误理解**：配置越详细、插件越多，项目越"专业"

**正确理解**：构建配置应该尽量简单。每多一个配置项，就多一个出问题的可能。先用默认配置，遇到具体问题再针对性优化。

### 误区三：构建工具可以解决所有问题

**错误理解**：引入某个构建工具就能解决项目的性能和质量问题

**正确理解**：构建工具解决的是"构建阶段"的问题。运行时性能、代码质量、用户体验——这些需要在代码层面解决，不是构建配置能搞定的。

### 误区四：开发环境和生产环境用同一套配置

**错误理解**：一套配置走天下

**正确理解**：开发环境关注启动速度和 HMR 体验；生产环境关注产物体积和运行时性能。它们的需求是不同的，配置也应该不同。

### 误区五：迁移构建工具可以解决所有问题

**错误理解**：项目慢是因为 Webpack 不行，换 Vite 就好了

**正确理解**：项目慢可能有很多原因：代码质量差、依赖太大、没有做代码分割、没有开启缓存。换工具是最激进的方案，应该先尝试优化现有配置。迁移本身也有风险——可能引入新的兼容问题。

## 本课小结

1. **构建工具的演进逻辑**：浏览器能力增长 → 模块化方案变化 → 构建工具适配
2. **Webpack 的核心价值**：Loader/Plugin 机制，能处理任何类型的资源
3. **Vite 的核心思路**：利用浏览器原态 ESM，开发环境不打包
4. **工具选型**：根据项目需求和团队情况选择，不是越新越好
5. **构建配置的本质**：回答入口、输出、转换、优化这几个核心问题
6. **每代工具都有技术债**：理解取舍，才能做出正确判断

## 练习

### 练习一：分析构建流程

拿你当前的项目，分析它的构建流程：
- 入口文件是什么？
- 经过了哪些转换步骤？
- 产物包含哪些文件？
- 构建时间是多少？

### 练习二：模块化历史

写一个简单的 demo，分别用 IIFE、CommonJS、ESM 三种方式实现模块化，观察它们的差异。

## 参考答案

### 练习一

以一个典型的 Vite + React 项目为例：

```
入口：src/main.tsx
转换步骤：TypeScript → JavaScript（esbuild）、JSX → React.createElement
产物：dist/index.html、dist/assets/index-[hash].js、dist/assets/index-[hash].css
构建时间：开发环境 <1s 启动，生产构建 ~5s
```

### 练习二

**IIFE 方式**：
```html
<script>
var MathModule = (function () {
  function add(a, b) { return a + b; }
  return { add };
})();
console.log(MathModule.add(1, 2));
</script>
```

**CommonJS 方式**（需要 Node.js 环境）：
```javascript
// math.js
function add(a, b) { return a + b; }
module.exports = { add };

// main.js
const { add } = require('./math');
console.log(add(1, 2));
```

**ESM 方式**：
```html
<script type="module">
import { add } from './math.js';
console.log(add(1, 2));
</script>
```

```javascript
// math.js
export function add(a, b) { return a + b; }
```

**差异**：
- IIFE：手动管理作用域，没有依赖管理
- CommonJS：同步加载，适合 Node.js，浏览器不原生支持
- ESM：浏览器原生支持，异步加载，支持静态分析（Tree Shaking）

## 下一步

完成本课后，继续学习 [02. Vite 核心原理](./02-vite-core-principles.md)。
