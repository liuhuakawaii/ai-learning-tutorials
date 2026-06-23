# 移动端性能

> 在你的 MacBook 上跑 Lighthouse 满分，用户用千元安卓机打开白屏 5 秒。移动端性能是另一回事。

## 移动端和桌面端的差异

同样的代码在不同设备上的表现差异巨大：

| 维度 | 桌面端 | 移动端（中低端） |
|------|--------|----------------|
| CPU | 4-8 核，3GHz+ | 4-8 核，1.5-2GHz |
| 内存 | 16-32GB | 2-4GB |
| 网络 | WiFi，稳定 | 4G/5G，波动大 |
| 屏幕 | 1920x1080+ | 360-414px 宽 |
| 交互 | 鼠标，精确 | 触摸，有延迟 |

一个在桌面上 50ms 完成的 JavaScript 任务，在低端手机上可能需要 200-500ms。这就是为什么 Lighthouse 默认用 4x CPU throttling 来模拟。

## Chrome DevTools 的设备模拟

Performance 面板可以模拟移动设备的 CPU 和网络条件：

1. 打开 Performance 面板
2. 点击齿轮图标（Capture settings）
3. **CPU throttling**：选择 4x slowdown 或 6x slowdown
4. **Network throttling**：选择 Slow 4G 或 Fast 3G

录制一次，对比无 throttling 的结果。差异能帮你理解移动端用户的真实体验。

但这只是"模拟"。真正的低端手机性能比 4x throttling 还差。如果条件允许，用真实设备测试。

## 弱网的影响

弱网不只是下载慢。它影响的是整个加载链：

- **TTFB 变长**：每个请求的服务器往返时间从 50ms 变成 300-500ms
- **资源加载变慢**：一个 100KB 的 JS 文件在 4G 下要 2-3 秒
- **API 调用变慢**：用户看到更长时间的 loading 状态
- **请求失败率上升**：超时、断连导致需要重试

在 Performance 面板里用 Slow 4G 模拟：
- 首屏加载时间可能从 2 秒变成 8-10 秒
- JS 解析时间增加（因为 CPU throttling）
- 大量时间花在网络等待上

## 触控延迟

移动端浏览器有一个 300ms 的点击延迟——浏览器要等 300ms 确认用户是单击还是双击缩放。现代浏览器在以下条件下会消除这个延迟：

- 页面设置了 `<meta name="viewport" content="width=device-width">`
- CSS 的 `touch-action: manipulation`

如果用户反馈"点击反应慢"，先检查这两个条件是否满足。

在 Performance 面板里录制一次点击，看 `touchstart` 到 `click` 之间是否有 300ms 的间隔。

## 电池优化

移动端的 CPU 频率受电池状态影响。电量低时 CPU 可能降频 30-50%，同样的任务耗时更长。

此外，频繁的网络请求和计算会加速电池消耗。对于移动端，减少不必要的后台工作（轮询、动画）不只是性能问题，也是电池问题。

## 移动端特有的性能问题

**大图片在小屏幕上**：一张 1920px 宽的图片在 360px 的屏幕上显示，浪费了 5 倍的下载量和解码时间。

```html
<picture>
  <source media="(max-width: 414px)" srcset="hero-mobile.webp" />
  <source media="(min-width: 415px)" srcset="hero-desktop.webp" />
  <img src="hero-desktop.jpg" alt="Hero" />
</picture>
```

**触摸事件处理**：`touchmove` 事件触发频率远高于 `scroll`（每帧可能触发多次）。如果事件处理器很重，容易导致卡顿。

```tsx
// 不推荐：每次 touchmove 都执行
element.addEventListener('touchmove', (e) => {
  expensiveCalculation(e.touches[0])
})

// 推荐：节流或用 Passive Event Listener
element.addEventListener('touchmove', (e) => {
  expensiveCalculation(e.touches[0])
}, { passive: true }) // 不调用 preventDefault，浏览器可以优化
```

**输入框延迟**：移动端的虚拟键盘弹出时会触发 resize 和 layout。如果页面有很多输入框或复杂布局，键盘弹出/收起可能会卡顿。

## 在真实设备上测试

Chrome DevTools 的远程调试可以连接 Android 设备：

1. 手机开启 USB 调试
2. 用 USB 线连接电脑
3. Chrome 打开 `chrome://inspect`
4. 选择手机上的页面，点击 "Inspect"

这样可以在电脑上用 DevTools 操作手机上的页面，Performance 面板录制的是手机上的真实性能数据。

## 练习

### 练习一：CPU Throttling 对比

对你的项目分别录制无 throttling 和 4x throttling 的页面加载，对比：

1. LCP 的差异
2. TBT 的差异
3. 长任务数量的差异

记录数据并分析哪些优化对移动端影响最大。

### 练习二：弱网优化

用 Slow 4G 网络模拟，录制你的项目页面加载：

1. 记录首屏加载时间
2. 找出加载最慢的 3 个资源
3. 提出 2 个针对性的优化建议（考虑弱网场景）

---

## 参考答案

### 练习一

典型差异：
- **无 throttling**：LCP ~1.5s, TBT ~100ms
- **4x throttling**：LCP ~4-6s, TBT ~400-800ms

TBT 的增长比例通常比 LCP 更大——因为 JavaScript 执行时间直接受 CPU 影响，而 LCP 还包含网络时间。

对移动端影响最大的优化：
- 减少 JavaScript 体积（Code Splitting）——直接影响解析和执行时间
- 减少主线程工作（Web Worker）——移动端 CPU 更容易被阻塞
- 优化 LCP 元素的加载（preload）——弱网下 TTFB 更长

### 练习二

Slow 4G 下的典型发现：
- TTFB 可能从 50ms 变成 300-500ms
- 100KB 的 JS 文件下载时间从 200ms 变成 2-3s
- 多个 API 串行调用的总等待时间可能是桌面端的 5-10 倍

针对性优化建议：
- API 响应压缩（gzip/brotli）——减少传输量
- Service Worker 缓存策略——回访时避免重复下载
- 关键 CSS 内联——减少渲染阻塞请求
- 图片响应式加载——小屏幕下载小图片
