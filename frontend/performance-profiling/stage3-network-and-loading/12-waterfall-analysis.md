# 请求瀑布图分析

> Network 面板的 Waterfall 列不只是好看——它直接展示了请求之间的依赖关系和并行程度。

## 瀑布图怎么看

Network 面板的 Waterfall 列是所有请求的时间线。每个横条从左到右代表请求的生命周期，颜色区分不同阶段：

- 白色/灰色：排队和阻塞
- 绿色：等待服务器响应（TTFB）
- 蓝色：下载内容

瀑布图的形状直接反映了页面加载的特征：

**瀑布形**：请求一个接一个，后面的等前面的完成才开始——这是串行加载，效率最差。

**平铺形**：请求几乎同时开始——这是并行加载，效率最好。

**阶梯形**：部分串行部分并行——这是大多数真实页面的形状。

## 串行加载的典型原因

**JavaScript 阻塞**：`<script>` 标签默认是同步阻塞的。浏览器遇到 `<script>` 时会暂停 HTML 解析，下载并执行完 JS 后才继续。

```html
<head>
  <!-- 这个 script 会阻塞后面所有资源的发现和下载 -->
  <script src="app.js"></script>
  <!-- 这个 CSS 要等 JS 下载完才开始发现和下载 -->
  <link rel="stylesheet" href="style.css" />
</head>
```

在瀑布图里你会看到：`app.js` 的横条结束后，`style.css` 才开始。

**CSS 阻塞渲染**：CSS 也是渲染阻塞资源。浏览器在 CSS 下载完成前不会渲染页面。

**JS 依赖 CSS**：如果一个同步 `<script>` 前面有 `<link rel="stylesheet">`，JS 会等 CSS 下载完才执行（因为 JS 可能查询样式）。

## 预加载和预连接

**dns-prefetch**：提前做 DNS 解析。

```html
<link rel="dns-prefetch" href="https://api.example.com" />
```

**preconnect**：提前做 DNS 解析 + TCP 连接 + TLS 协商。

```html
<link rel="preconnect" href="https://cdn.example.com" />
```

在瀑布图里，你会看到 `preconnect` 的目标域名的连接阶段（DNS + TCP + TLS）被提前到了 HTML 解析阶段，后续请求直接跳过这些阶段。

**preload**：提前下载当前页面需要的资源。

```html
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin />
<link rel="preload" href="/critical.css" as="stylesheet" />
```

preload 的资源会在 HTML 解析阶段就开始下载，不用等到浏览器发现它。适合关键的字体、CSS、首屏图片。

**prefetch**：提前下载下一页可能需要的资源。

```html
<link rel="prefetch" href="/next-page.js" />
```

prefetch 的优先级最低，只在浏览器空闲时下载。

## 在瀑布图里观察这些效果

1. 录制一个没有预加载/预连接的页面加载
2. 添加 `<link rel="preconnect" href="https://cdn.example.com" />`
3. 重新录制

对比两次瀑布图：第二次录制里，CDN 域名的连接阶段应该提前出现，后续 CDN 资源的开始时间也相应提前。

## 资源发现时机

浏览器下载资源的前提是"发现"它。发现方式有几种：

1. **HTML 解析时发现**：`<script>`、`<link>`、`<img>` 标签在 HTML 中直接出现
2. **CSS 解析时发现**：`@import`、`url()` 引用的资源
3. **JavaScript 执行时发现**：`import()`、动态创建的 `<script>`/`<img>`

发现时机越晚，资源开始下载的时间就越晚。这就是为什么 preload 有用——它把发现时机提前到了 HTML 解析的最早阶段。

## 一个优化瀑布图的思路

观察瀑布图，回答这些问题：

1. **有多少请求是串行的？** 如果超过 3 个请求串行，考虑拆分依赖关系
2. **关键资源是否尽早发现？** CSS 和首屏 JS 应该在 HTML 的 `<head>` 里
3. **第三方资源是否阻塞了主线？** 第三方脚本应该用 `async` 或 `defer`
4. **有没有空闲时段？** 瀑布图中间如果有空闲，说明有资源等待发现——考虑 preload

## 练习

### 练习一：绘制并分析瀑布图

打开一个你常用的网站，录制页面加载。在 Network 面板的瀑布图上：

1. 找到最长的请求横条，记录它在哪个阶段最耗时
2. 找到第一个开始的请求和最后一个开始的请求，计算时间差
3. 数一数有多少个请求是完全串行的（前一个完成后一个才开始）

### 练习二：用 preload 优化

找一个加载了自定义字体的页面（很多网站都有）。当前字体文件可能在 CSS 里才被发现，导致加载延迟。

在 HTML 的 `<head>` 里添加 `<link rel="preload">`，对比字体文件在瀑布图中的开始时间是否提前。

---

## 参考答案

### 练习一

分析结果示例：
- 最长的请求通常是主文档（HTML）或最大的 JS bundle
- HTML 请求的 TTFB 可能占总时间的 30-50%
- 首屏可见的图片通常在 CSS 和关键 JS 加载完后才开始——这是因为浏览器要先解析完 CSS 才知道需要哪些图片

### 练习二

添加 preload 后：
- 字体文件的开始下载时间从"CSS 解析完成后"提前到"HTML 解析阶段"
- 在瀑布图里，字体的横条会向左移动，和 CSS/JS 的加载重叠
- 如果字体是渲染阻塞的（没有 `font-display: swap`），这个优化可以减少用户看到"无样式文本"的时间
