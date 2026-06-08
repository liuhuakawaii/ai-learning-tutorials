# 第3课：CSS / JS 阻塞

> **课程定位**：理解 CSS 和 JS 如何阻塞渲染，掌握解除阻塞的具体方法
> **前置知识**：了解关键渲染路径（CRP）
> **预计时长**：35 分钟

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

## 小结

1. **CSS 渲染阻塞**：不阻塞解析，但 CSSOM 完成前不渲染
2. **JS 解析阻塞**：暂停 DOM 构建，用 async/defer/module 解决
3. **async 适合独立脚本**：分析、广告、不依赖 DOM 的脚本
4. **defer 适合应用脚本**：有依赖关系、需要 DOM 的脚本
5. **内联关键 CSS**：首屏样式 < 10KB 内联到 HTML

---

## 下一课预告

下一课将学习 preload、preconnect、lazy load 等资源加载策略——让关键资源先到、非关键资源后到。
