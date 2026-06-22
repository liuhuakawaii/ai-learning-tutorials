# 第4课：preload、preconnect、lazy load

> **课程定位**：掌握资源加载优先级控制，让关键资源先到、非关键资源后到
> **前置知识**：了解 CSS/JS 阻塞机制和关键渲染路径
> **预计时长**：35 分钟

## 场景引入

你的页面首屏有一张 Hero 图片，但 Network 瀑布图显示它在 2.5 秒后才开始加载——因为浏览器先解析 HTML、再加载 CSS、从 CSS 中发现 background-image 才发起图片请求。你给图片加了 `<link rel="preload">` 和 `fetchpriority="high"`，LCP 从 4 秒降到 1.8 秒。但你又犯了一个错误：给首屏图片也加了 `loading="lazy"`，结果图片反而加载更晚了。资源提示（Resource Hints）是一把双刃剑，用对了事半功倍，用错了适得其反。

---

## 学习目标

1. 使用 `<link rel="preload">` 提前加载关键资源
2. 使用 `<link rel="preconnect">` 提前建立连接
3. 使用 `loading="lazy"` 延迟加载非首屏图片
4. 区分 preload、prefetch、preconnect、dns-prefetch 的用途
5. 避免常见的资源提示错误

---

## 一、资源提示概览

```
┌──────────────────────────────────────────────────────────────┐
│                    资源提示（Resource Hints）                  │
├───────────────┬────────────────────┬─────────────────────────┤
│  提示          │  作用              │  使用场景                │
├───────────────┼────────────────────┼─────────────────────────┤
│  preload       │  提前加载资源       │  关键图片、字体、脚本    │
│  preconnect    │  提前建立完整连接   │  必须的第三方源          │
│  dns-prefetch  │  提前解析 DNS       │  可能用到的第三方源      │
│  prefetch      │  空闲时预加载       │  下一页可能需要的资源    │
│  prerender     │  预渲染整个页面     │  用户可能访问的下一页    │
└───────────────┴────────────────────┴─────────────────────────┘
```

---

## 二、preload

### 2.1 什么是 preload

```html
<!-- 告诉浏览器：这个资源很重要，尽早加载 -->
<link rel="preload" href="/hero.webp" as="image">
<link rel="preload" href="/critical.css" as="style">
<link rel="preload" href="/app.js" as="script">
<link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>
```

### 2.2 什么时候用 preload

```
┌──────────────────────────────────────────────────────────────┐
│              应该 preload 的资源                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. LCP 图片（首屏最大的图片）                                │
│     <link rel="preload" as="image" href="/hero.webp">       │
│                                                              │
│  2. 关键字体                                                  │
│     <link rel="preload" as="font" href="/font.woff2"        │
│           type="font/woff2" crossorigin>                     │
│                                                              │
│  3. 关键 CSS（如果无法内联）                                  │
│     <link rel="preload" as="style" href="/critical.css">    │
│                                                              │
│  4. 在 CSS 中引用的背景图                                     │
│     浏览器解析 CSS 才能发现 → 预加载更早                      │
│                                                              │
│  ⚠️ 不要 preload 所有资源！只 preload 真正关键的 1-3 个       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 fetchpriority

```html
<!-- 现代浏览器支持 fetchpriority 属性 -->
<img src="/hero.webp" fetchpriority="high">   <!-- LCP 图片 -->
<img src="/below-fold.jpg" fetchpriority="low"> <!-- 非首屏图片 -->

<link rel="preload" href="/hero.webp" as="image" fetchpriority="high">
```

---

## 三、preconnect 和 dns-prefetch

### 3.1 preconnect

```html
<!-- 提前建立 DNS + TCP + TLS 连接 -->
<link rel="preconnect" href="https://cdn.example.com">
<link rel="preconnect" href="https://fonts.googleapis.com">

<!-- 适用场景：你确定会用到这个源的资源 -->
```

### 3.2 dns-prefetch

```html
<!-- 只提前解析 DNS（比 preconnect 轻量） -->
<link rel="dns-prefetch" href="//analytics.google.com">
<link rel="dns-prefetch" href="//www.googletagmanager.com">

<!-- 适用场景：有多个第三方源，不确定是否都会用到 -->
```

### 3.3 对比

```
┌──────────────┬───────────────────────────────────────┐
│              │  DNS    TCP    TLS    适用场景          │
├──────────────┼───────────────────────────────────────┤
│  preconnect  │  ✅     ✅     ✅    必须用的第三方源   │
│  dns-prefetch│  ✅     ❌     ❌    可能用的第三方源   │
└──────────────┴───────────────────────────────────────┘

建议：每个页面 preconnect 不超过 3 个，dns-prefetch 不超过 6 个
```

---

## 四、懒加载

### 4.1 图片懒加载

```html
<!-- 原生懒加载（最简单） -->
<img src="/below-fold.jpg" loading="lazy" width="800" height="600">

<!-- 首屏图片不要用 lazy！ -->
<img src="/hero.jpg" loading="eager" fetchpriority="high" width="800" height="600">
```

### 4.2 Intersection Observer 自定义懒加载

```javascript
// 当元素进入视口时才加载
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      observer.unobserve(img);
    }
  });
});

document.querySelectorAll('img[data-src]').forEach(img => {
  observer.observe(img);
});
```

```html
<img data-src="/photo.jpg" src="/placeholder.svg" loading="lazy">
```

### 4.3 组件懒加载（React）

```javascript
// React.lazy() 动态导入组件
const HeavyChart = React.lazy(() => import('./HeavyChart'));

function Dashboard() {
  return (
    <Suspense fallback={<div>Loading chart...</div>}>
      <HeavyChart />
    </Suspense>
  );
}
```

---

## 五、prefetch

```html
<!-- 预加载下一页可能需要的资源（低优先级） -->
<link rel="prefetch" href="/next-page.js">

<!-- 与 preload 的区别 -->
<!-- preload：当前页面需要，高优先级 -->
<!-- prefetch：未来可能需要，低优先级 -->
```

---

## 六、常见误区

```
❌ 错误 1：preload 所有资源
→ 浏览器同时下载太多，反而互相抢带宽

✅ 正确：只 preload 真正关键的 1-3 个资源

❌ 错误 2：首屏图片用 loading="lazy"
→ 延迟了 LCP

✅ 正确：首屏图片用 fetchpriority="high"，非首屏才 lazy

❌ 错误 3：preconnect 太多源
→ 每个 preconnect 都消耗资源

✅ 正确：preconnect 最多 3 个，其余用 dns-prefetch

❌ 错误 4：preload 了但没用到
→ 浏览器下载了浪费

✅ 正确：preload 的资源一定要在渲染中使用
```

---

## 动手练习

### 练习一：给 LCP 图片添加 preload

1. 找到页面的 LCP 图片
2. 添加 `<link rel="preload">` 和 `fetchpriority="high"`
3. 对比优化前后的 LCP 时间

### 练习二：实现图片懒加载

1. 创建一个有 20 张图片的页面
2. 给非首屏图片添加 `loading="lazy"`
3. 用 Network 面板观察图片加载时机

### 练习三：优化第三方资源

1. 列出页面中所有第三方域名
2. 对必须使用的源添加 preconnect
3. 对可选的源添加 dns-prefetch

---

## 参考答案

### 练习一：给 LCP 图片添加 preload

**思路**：找到页面的 LCP 图片，添加 preload 和 fetchpriority="high"，对比优化前后的 LCP。

**答案**：

```html
<!-- 优化前 -->
<img src="/images/hero.jpg" alt="Hero" width="1200" height="600">

<!-- 优化后 -->
<head>
  <!-- 预加载 LCP 图片 -->
  <link rel="preload" as="image" href="/images/hero.webp" type="image/webp">
</head>
<body>
  <img src="/images/hero.webp" alt="Hero" width="1200" height="600"
       fetchpriority="high" decoding="async">
</body>
```

```markdown
优化效果：
- 优化前 LCP: 3.8s（图片从 2.0s 才开始加载）
- 优化后 LCP: 1.6s（图片从 0.2s 就开始加载）
- LCP 节省: 2.2s（降低 58%）

原因：
- preload 让浏览器在解析 HTML 阶段就开始下载图片
- fetchpriority="high" 提升图片的下载优先级
- WebP 格式比 JPEG 小 60%，下载更快
```

**要点**：
- preload 必须放在 <head> 中，越早越好
- fetchpriority="high" 只用于 LCP 图片，不要滥用
- preload 的资源一定要在页面中使用，否则浪费带宽

### 练习二：实现图片懒加载

**思路**：创建一个有 20 张图片的页面，给非首屏图片添加 loading="lazy"，观察加载时机。

**答案**：

```html
<!-- test-lazy-load.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    .gallery { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 16px; }
    .gallery img { width: 100%; height: 200px; object-fit: cover; }
  </style>
</head>
<body>
  <h1>图片懒加载测试</h1>
  <div class="gallery">
    <!-- 首屏图片：不用 lazy，用 fetchpriority -->
    <img src="https://picsum.photos/400/200?1" alt="" width="400" height="200"
         fetchpriority="high">
    <img src="https://picsum.photos/400/200?2" alt="" width="400" height="200"
         fetchpriority="high">

    <!-- 非首屏图片：懒加载 -->
    <img src="https://picsum.photos/400/200?3" alt="" width="400" height="200" loading="lazy">
    <img src="https://picsum.photos/400/200?4" alt="" width="400" height="200" loading="lazy">
    <!-- ... 共 20 张 ... -->
    <img src="https://picsum.photos/400/200?20" alt="" width="400" height="200" loading="lazy">
  </div>
</body>
</html>
```

```markdown
Network 面板观察结果：

初始加载（不滚动）：
- 只加载了前 2 张图片（首屏可见）
- 其余 18 张图片未发起请求

滚动到第 3-4 张时：
- 第 3-4 张图片开始加载
- 浏览器在图片进入视口前约 200px 开始预加载

滚动到底部时：
- 所有 20 张图片都已加载
- 但初始加载只有 2 张 → 节省了 18 张图片的带宽

初始传输大小对比：
- 不用 lazy: 20 张 × 100KB = 2MB
- 用 lazy: 2 张 × 100KB = 200KB（节省 90%）
```

**要点**：
- loading="lazy" 是最简单的懒加载方案，不需要 JS
- 首屏图片不要用 lazy，会延迟 LCP
- 浏览器在图片进入视口前约 200px 开始预加载，体验流畅

### 练习三：优化第三方资源

**思路**：列出页面中所有第三方域名，对必须使用的源添加 preconnect，对可选的源添加 dns-prefetch。

**答案**：

```markdown
第三方域名审计：

域名                              用途          必要性    优化策略
www.googletagmanager.com         GTM 分析       高       preconnect
www.google-analytics.com         GA 分析        高       preconnect
fonts.googleapis.com             Google Fonts   高       preconnect
connect.facebook.net             Facebook SDK   低       dns-prefetch
cdn.jsdelivr.net                 CDN            中       dns-prefetch
www.googletagservices.com        广告           低       延迟加载
```

```html
<head>
  <!-- 必须的源：preconnect（最多 3 个） -->
  <link rel="preconnect" href="https://www.googletagmanager.com">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <!-- 可选的源：dns-prefetch（最多 6 个） -->
  <link rel="dns-prefetch" href="//connect.facebook.net">
  <link rel="dns-prefetch" href="//cdn.jsdelivr.net">
</head>
```

```markdown
优化效果：
- preconnect 的源：DNS + TCP + TLS 提前完成，节省 200-500ms
- dns-prefetch 的源：DNS 提前完成，节省 50-100ms
- 第三方脚本的加载时间从 800ms 降到 300ms
```

**要点**：
- preconnect 最多 3 个，每个都会消耗 DNS + TCP + TLS 资源
- dns-prefetch 更轻量，只做 DNS 解析
- preconnect 的资源一定要用到，否则浪费

---

## 工程建议

1. **用 Lighthouse 的 "Preload key requests" 审计项指导 preload**：不要凭感觉 preload，让 Lighthouse 告诉你哪些资源应该 preload。
2. **首屏图片用 fetchpriority="high"，非首屏用 loading="lazy"**：这是最简单的图片加载策略，不要混淆两者的使用场景。
3. **preconnect 最多 3 个，dns-prefetch 最多 6 个**：过多的预连接反而消耗带宽和 CPU 资源。
4. **用 Performance 面板的 Network 瀑布图验证效果**：添加资源提示后，检查瀑布图中资源的加载时机是否符合预期。

## 小结

1. **preload 关键资源**：LCP 图片、关键字体、关键 CSS
2. **preconnect 必须的源**：最多 3 个，提前建立连接
3. **lazy load 非首屏**：`loading="lazy"` 最简单
4. **prefetch 未来资源**：低优先级，空闲时加载
5. **fetchpriority**：高优先级给 LCP，低优先级给非首屏

---

## 下一课预告

下一课将学习减少长任务——你将了解什么是长任务，如何识别它们，以及如何通过拆分、Web Worker 等手段减少主线程阻塞。
