# 第4课：preload、preconnect、lazy load

> **课程定位**：掌握资源加载优先级控制，让关键资源先到、非关键资源后到
> **前置知识**：了解 CSS/JS 阻塞机制和关键渲染路径
> **预计时长**：35 分钟

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

## 六、常见错误

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

## 小结

1. **preload 关键资源**：LCP 图片、关键字体、关键 CSS
2. **preconnect 必须的源**：最多 3 个，提前建立连接
3. **lazy load 非首屏**：`loading="lazy"` 最简单
4. **prefetch 未来资源**：低优先级，空闲时加载
5. **fetchpriority**：高优先级给 LCP，低优先级给非首屏

---

## 下一课预告

下一课将学习减少长任务——你将了解什么是长任务，如何识别它们，以及如何通过拆分、Web Worker 等手段减少主线程阻塞。
