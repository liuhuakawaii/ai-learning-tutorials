# 资源加载优化

> Code Splitting、Tree Shaking、动态 import——这些词你可能都听过。但它们在 Network 面板里到底改变了什么？

## 先看问题：一个 500KB 的 JS Bundle

假设你的 React 应用打包后输出了一个 `bundle.js`，500KB（压缩后）。用户打开首页时，浏览器需要下载这 500KB，解析它，编译它，然后执行。

在 Network 面板里，你会看到：
- 一个大请求，Content Download 阶段很长
- 在 Performance 面板里，Main 轨道上有一个很长的黄色色块（JS 解析和编译）

问题不只是下载慢——500KB 的 JS 解析和编译在中端手机上可能需要 200-500ms，这段时间主线程是被阻塞的。

## Code Splitting

Code Splitting 的核心思想：不要一次性加载所有代码，只加载当前页面需要的代码。

在 React + Webpack/Vite 项目里，用动态 `import()` 实现：

```tsx
import { lazy, Suspense } from 'react'

// 首页只加载首页的代码
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Settings = lazy(() => import('./pages/Settings'))

function App() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  )
}
```

打包后，Webpack/Vite 会生成多个 chunk 文件。用户访问首页只下载 Dashboard 的代码，访问设置页才下载 Settings 的代码。

在 Network 面板里对比：
- 优化前：一个 500KB 的 `bundle.js`
- 优化后：一个 200KB 的 `main.js` + 一个 50KB 的 `Dashboard.chunk.js`（首屏需要的）+ 其他页面按需加载

## Tree Shaking

Tree Shaking 是打包工具自动删除未使用代码的过程。它依赖 ES Module 的静态分析——`import` 和 `export` 是静态声明，打包工具可以在编译时确定哪些模块被使用了。

Tree Shaking 生效的条件：
- 使用 ES Module 语法（`import`/`export`），不是 CommonJS（`require`/`module.exports`）
- 打包工具开启了 Tree Shaking（Webpack 5 默认开启，Vite 默认开启）
- 第三方库支持 Tree Shaking（提供 ES Module 格式）

怎么验证 Tree Shaking 是否生效：

1. 在代码里 `import { debounce } from 'lodash-es'`，只用了 `debounce`
2. 打包后搜索 `throttle`——如果没找到，说明 `throttle` 被 tree-shake 掉了
3. 在 Network 面板里看 JS 文件大小——比 import 整个 `lodash-es` 小得多

用 `lodash`（CommonJS 格式）和 `lodash-es`（ES Module 格式）的差异在 Network 面板里一目了然。

## 动态 import 的实际效果

动态 `import()` 不只是路由级的代码分割。它可以在任何需要的时候触发加载：

```tsx
function ReportGenerator() {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)

    // 只在用户点击"生成报告"时才加载 xlsx 库
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    // ...

    setIsGenerating(false)
  }

  return (
    <button onClick={handleGenerate} disabled={isGenerating}>
      {isGenerating ? '生成中...' : '生成 Excel 报告'}
    </button>
  )
}
```

`xlsx` 库约 300KB。如果放在静态 `import` 里，首屏就要下载它。用动态 `import()` 后，只有用户真正需要生成报告时才下载。

在 Network 面板里观察：
- 首屏加载：没有 `xlsx` 相关的请求
- 点击按钮后：出现一个新的 JS 请求，大小约 300KB
- 请求完成后：报告生成

## Bundle 分析

要优化打包结果，首先要知道打包后都有什么。Webpack Bundle Analyzer 或 Vite 的 `rollup-plugin-visualizer` 可以生成可视化的打包分析。

```bash
# Webpack
npx webpack-bundle-analyzer stats.json

# Vite
npx vite-bundle-visualizer
```

分析结果会告诉你每个模块在打包产物里占了多少空间。常见的发现：

- 某个你只用了一个函数的库，整个库都被打包进去了
- 日期处理库（moment.js vs day.js）占了大量空间
- 重复的依赖（同一个库的不同版本被打包了两次）

## 在 Network 面板里验证优化

每次优化后，在 Network 面板里验证：

1. **文件数量**：Code Splitting 后请求数会增加，但每个请求更小
2. **首屏 JS 大小**：应该明显减小
3. **加载时间**：首屏的 JS 下载时间应该减少
4. **后续加载**：按需加载的 chunk 应该在用户触发操作时才出现

## 练习

### 练习一：Code Splitting 前后对比

在一个 React 项目里：

1. 把所有页面组件用静态 `import` 引入，打包，记录 Network 面板里首屏 JS 的大小
2. 改成 `lazy(() => import(...))`，打包，对比首屏 JS 的大小
3. 切换到其他页面，观察是否出现了新的 chunk 请求

### 练习二：找出打包产物里的大户

用 Webpack Bundle Analyzer 或 `rollup-plugin-visualizer` 分析你的项目，找出：

1. 打包后体积最大的 3 个模块
2. 有没有你只用了一小部分但整个被打包的库
3. 能否用更小的替代品（比如 day.js 替代 moment.js）

---

## 参考答案

### 练习一

典型结果：
- 静态 import：首屏 JS 约 400-600KB（取决于项目复杂度）
- Code Splitting 后：首屏 JS 约 150-250KB，每个页面 chunk 约 30-80KB
- 切换路由时：Network 面板出现新的 JS 请求

注意：Code Splitting 不是越多越好。每个 chunk 都有加载延迟和解析开销。过于细碎的分割可能反而降低性能。

### 练习二

常见发现：
- moment.js + locale 文件可以占 200-300KB，用 day.js 只需 2-7KB
- lodash 全量引入可以占 70KB+，用 lodash-es + Tree Shaking 可以只引入需要的函数
- 一些 UI 库（如 antd）如果不支持 Tree Shaking，可能整个库都被打包
