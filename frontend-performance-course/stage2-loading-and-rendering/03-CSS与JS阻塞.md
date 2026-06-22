# 第3课：CSS / JS 阻塞

> **课程定位**：理解 CSS 和 JS 如何阻塞渲染，掌握解除阻塞的具体方法
> **前置知识**：了解关键渲染路径（CRP）
> **预计时长**：35 分钟

## 场景引入

你的项目在 `<head>` 中引入了 5 个 JS 文件：jQuery、Lodash、一个工具库、一个分析脚本和应用主脚本。Lighthouse 报告显示 FCP 高达 3.2 秒，原因是"Eliminate render-blocking resources"。你把所有 script 标签加上 defer，FCP 立刻降到 1.1 秒。但上了一个新需求后，发现某些页面功能失效了——因为 defer 脚本的执行顺序和你预期的不同。理解 CSS 和 JS 的阻塞机制，不只是知道"加 defer"，更要理解什么场景用 defer、什么场景用 async、什么场景必须同步。

---

## 学习目标

1. 区分 CSS 的"渲染阻塞"和 JS 的"解析阻塞"
2. 使用 media 属性将非关键 CSS 变为非阻塞
3. 正确使用 async、defer、module 加载脚本
4. 提取和内联关键 CSS
5. 避免常见的阻塞错误

---

## 一、CSS 阻塞详解

### 1.1 CSS 是渲染阻塞资源

```
CSS 阻塞行为：

  ✅ 不阻塞：HTML 解析（浏览器继续解析 DOM）
  ❌ 阻塞：  渲染（CSSOM 构建完成前不渲染任何像素）
  ❌ 阻塞：  后续 JS 执行（如果 JS 需要读取样式）

  浏览器行为：
  遇到 <link rel="stylesheet"> → 继续解析 HTML + 后台下载 CSS
  CSS 下载完成 → 解析 CSS 构建 CSSOM → 开始渲染
```

### 1.2 用 media 属性解除阻塞

```html
<!-- 当前屏幕必需，渲染阻塞 -->
<link rel="stylesheet" href="base.css">
<link rel="stylesheet" href="layout.css" media="screen">

<!-- 打印时才用，不阻塞渲染 -->
<link rel="stylesheet" href="print.css" media="print">

<!-- 大屏才用，小屏不阻塞 -->
<link rel="stylesheet" href="desktop.css" media="(min-width: 1024px)">
```

### 1.3 内联关键 CSS

```html
<head>
  <!-- 首屏关键样式内联（< 10KB） -->
  <style>
    body { margin: 0; font-family: system-ui; }
    .header { background: #333; padding: 16px; color: white; }
    .hero { height: 60vh; display: flex; align-items: center; }
  </style>

  <!-- 非关键 CSS 异步加载 -->
  <link rel="preload" href="full.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="full.css"></noscript>
</head>
```

---

## 二、JS 阻塞详解

### 2.1 JS 是解析阻塞资源

```
JS 阻塞行为：

  ❌ 阻塞：HTML 解析（暂停 DOM 构建）
  ❌ 阻塞：渲染（因为 DOM 没构建完）

  原因：JS 可能修改 DOM
  document.write('<p>新内容</p>')  ← 必须暂停解析才能执行
```

### 2.2 三种加载策略对比

```
┌────────────┬───────────────┬────────────────┬────────────────┐
│   策略      │  是否阻塞解析  │  执行时机       │  是否保证顺序   │
├────────────┼───────────────┼────────────────┼────────────────┤
│ 普通 script │  是           │  下载完立即执行  │  是（按位置）   │
│ async      │  否           │  下载完立即执行  │  否            │
│ defer      │  否           │  DOM 解析完成后  │  是            │
│ module     │  否           │  DOM 解析完成后  │  是            │
└────────────┴───────────────┴────────────────┴────────────────┘
```

### 2.3 选择正确的策略

```
┌──────────────────────────────────────────────────────────────┐
│              选择 async 还是 defer？                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  用 async 的场景：                                           │
│  ├── 分析脚本（Google Analytics、百度统计）                   │
│  ├── 广告脚本                                                │
│  ├── 不依赖 DOM 的独立脚本                                   │
│  └── 执行顺序无关紧要                                        │
│                                                              │
│  用 defer 的场景：                                           │
│  ├── 应用主脚本                                              │
│  ├── 依赖 DOM 的脚本                                         │
│  ├── 多个脚本有执行顺序依赖                                  │
│  └── 框架代码（React、Vue 等）                               │
│                                                              │
│  用 module 的场景：                                          │
│  ├── 使用 ES modules 的代码                                  │
│  ├── 需要 import/export                                      │
│  └── 等同于 defer + 严格模式                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 三、常见反模式

```
❌ 反模式 1：head 中放大量同步脚本
<head>
  <script src="jquery.js"></script>      <!-- 阻塞 300ms -->
  <script src="lodash.js"></script>      <!-- 阻塞 200ms -->
  <script src="app.js"></script>         <!-- 阻塞 400ms -->
</head>
→ 总共阻塞 900ms，页面白屏

✅ 正确做法：使用 defer
<head>
  <script defer src="jquery.js"></script>
  <script defer src="lodash.js"></script>
  <script defer src="app.js"></script>
</head>
→ 不阻塞解析，DOM 完成后按顺序执行

❌ 反模式 2：未压缩的 CSS/JS
→ 大文件传输时间长，阻塞时间长

✅ 正确做法：构建时压缩
→ Webpack/Vite/Next.js 默认压缩

❌ 反模式 3：加载了不需要的 CSS/JS
→ 首屏不需要的库也被同步加载

✅ 正确做法：Code splitting + 懒加载
→ 只加载当前页面需要的代码
```

---

## 四、Critical CSS 提取工具

```bash
# 使用 critical 库提取关键 CSS
npm install critical

# 命令行使用
npx critical https://example.com --base ./dist --inline

# 输出：内联关键 CSS + 预加载非关键 CSS 的 HTML
```

```javascript
// Webpack 插件：critters
const Critters = require('critters');
module.exports = {
  plugins: [
    new Critters({
      preload: 'swap',
    }),
  ],
};
```

---

## 动手练习

### 练习一：观察 CSS 阻塞

1. 创建一个页面，引入一个很大的 CSS 文件（用 setTimeout 模拟慢加载）
2. 观察页面是否白屏
3. 将 CSS 改为 media="print"，观察变化

### 练习二：async vs defer 实验

1. 创建 3 个 JS 文件，每个输出自己的名字和 document.readyState
2. 分别用普通/async/defer 加载，记录执行顺序

### 练习三：提取关键 CSS

1. 对一个真实页面运行 Coverage 面板
2. 找出首屏使用的 CSS
3. 尝试将首屏 CSS 内联

---

## 常见误区

1. **给所有 script 标签无脑加 defer**：有些脚本需要同步执行（如内联的环境变量注入脚本），加 defer 反而导致后续代码拿不到变量。要理解每个脚本的依赖关系再决定加载策略。
2. **把内联关键 CSS 理解为"把所有 CSS 内联"**：关键 CSS 应该只包含首屏必需的样式（< 10KB），把整个 CSS 文件内联会导致 HTML 膨胀，反而拖慢首次字节到达时间。
3. **认为 async 脚本一定比 defer 快**：async 脚本下载完立即执行，可能在 DOM 还没解析完时就执行了。如果脚本依赖 DOM，反而会报错。速度不是唯一考量，正确性更重要。
4. **忽略 CSS 的阻塞链路**：一个外部 CSS 文件阻塞渲染 → 渲染阻塞意味着 FCP 延迟 → FCP 延迟意味着 LCP 也可能延迟。CSS 阻塞的影响是连锁的。

## 工程建议

1. **用 media 属性拆分 CSS**：打印样式用 `media="print"`，大屏样式用 `media="(min-width: 1024px)"`，这些非匹配的 CSS 不会阻塞渲染。
2. **使用 critters 工具自动提取关键 CSS**：Webpack 项目可以用 critters 插件，构建时自动提取首屏 CSS 并内联。
3. **第三方分析脚本用 async**：Google Analytics、百度统计等脚本不依赖 DOM 且不需要特定执行顺序，用 async 最合适。
4. **用 Coverage 面板量化"浪费"的代码**：Chrome DevTools → More tools → Coverage，可以看到每个文件的关键字节占比，指导代码拆分。

## 小结

1. **CSS 渲染阻塞**：不阻塞解析，但 CSSOM 完成前不渲染
2. **JS 解析阻塞**：暂停 DOM 构建，用 async/defer/module 解决
3. **async 适合独立脚本**：分析、广告、不依赖 DOM 的脚本
4. **defer 适合应用脚本**：有依赖关系、需要 DOM 的脚本
5. **内联关键 CSS**：首屏样式 < 10KB 内联到 HTML

---

## 下一课预告

下一课将学习 preload、preconnect、lazy load 等资源加载策略——让关键资源先到、非关键资源后到。
