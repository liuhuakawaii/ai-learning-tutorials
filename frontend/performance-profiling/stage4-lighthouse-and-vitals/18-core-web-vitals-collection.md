# Core Web Vitals 采集

> Lighthouse 只能跑一次，但用户的性能数据需要持续采集。web-vitals 库让你用几十行代码就做到。

## Core Web Vitals 是什么

Core Web Vitals 是 Google 定义的三个核心用户体验指标：

- **LCP（Largest Contentful Paint）**：加载性能——主要内容多快显示出来
- **INP（Interaction to Next Paint）**：交互性能——用户操作后页面多快响应
- **CLS（Cumulative Layout Shift）**：视觉稳定性——页面内容是否突然移动

这三个指标直接影响 Google 的搜索排名。更重要的是，它们对应用户的真实体验：页面加载快不快、操作响应快不快、内容会不会乱跳。

## 用 web-vitals 库采集

`web-vitals` 是 Google 官方的采集库，封装了 PerformanceObserver API，处理了各种边界情况。

```bash
npm install web-vitals
```

```tsx
import { onLCP, onINP, onCLS } from 'web-vitals'

function sendToAnalytics(metric: { name: string; value: number; id: string }) {
  // 发送到你的分析后端
  console.log(`${metric.name}: ${metric.value}`)

  // 用 sendBeacon 确保页面关闭前数据能发出去
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      '/api/vitals',
      JSON.stringify({
        name: metric.name,
        value: metric.value,
        id: metric.id,
        page: location.pathname,
      })
    )
  }
}

onLCP(sendToAnalytics)
onINP(sendToAnalytics)
onCLS(sendToAnalytics)
```

`web-vitals` 的每个回调只在指标"最终确定"时触发一次。LCP 在用户开始交互后最终确定，CLS 在页面卸载时最终确定，INP 在页面生命周期内持续更新直到最终确定。

## 用 PerformanceObserver 直接采集

如果不想引入 `web-vitals` 库，可以直接用 PerformanceObserver API：

```tsx
// LCP
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries()
  const lastEntry = entries[entries.length - 1]
  console.log('LCP:', lastEntry.startTime)
})
lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })

// Layout Shift
const clsObserver = new PerformanceObserver((list) => {
  let clsValue = 0
  for (const entry of list.getEntries()) {
    if (!(entry as any).hadRecentInput) {
      clsValue += (entry as any).value
    }
  }
  console.log('CLS:', clsValue)
})
clsObserver.observe({ type: 'layout-shift', buffered: true })

// Long Tasks（用于计算 TBT）
const longTaskObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Long Task:', entry.duration, 'ms')
  }
})
longTaskObserver.observe({ type: 'longtask', buffered: true })
```

PerformanceObserver 比 `web-vitals` 更底层，需要自己处理计算逻辑（比如 CLS 的累加规则、INP 的选取逻辑）。除非有特殊需求，建议用 `web-vitals`。

## 指标的详细含义

### LCP

LCP 衡量的是视口内最大内容元素的渲染时间。"最大内容元素"可能是：
- `<img>` 元素
- `<svg>` 内的 `<image>`
- `<video>` 的封面图
- 包含文本的块级元素

LCP 的"结束时间"是元素的渲染完成时间，不是加载完成时间。对于图片，是图片开始绘制的时间（通常等于图片的 decode 完成时间）。

影响 LCP 的因素：
- LCP 资源的加载时间（图片大小、CDN 速度）
- LCP 元素的渲染是否被其他资源阻塞（CSS、JS）
- 服务器响应时间（TTFB）

### INP

INP 是 2024 年替代 FID 的指标。FID 只测量"第一次"交互的输入延迟，INP 测量"所有"交互中响应最慢的那个。

INP 的计算：
1. 记录用户的所有交互（点击、键盘、触摸）
2. 计算每个交互的"延迟"（从输入到下一帧渲染的时间）
3. 取第 98 百分位的延迟值（排除异常极端值）

INP 的评分阈值：
- **0-200ms**：绿色
- **200-500ms**：橙色
- **>500ms**：红色

优化 INP 的方向：
- 减少事件处理器的 JavaScript 执行时间
- 把非关键工作推迟到 `requestAnimationFrame` 或 `setTimeout`
- 减少 DOM 操作和样式计算

### CLS

CLS 的计算有几个特殊规则：
- 只计算非用户触发的布局偏移
- 用户输入后的 500ms 窗口内的偏移不计入
- 用"会话窗口"（Session Window）聚合：最多 5 秒的窗口，间隙超过 1 秒则开始新窗口
- 取所有会话窗口中最大的一个作为最终 CLS

## 在开发环境中实时查看

Chrome DevTools 的 Console 面板可以实时查看指标：

```tsx
// 在 Console 里运行
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      console.log(`LCP: ${entry.startTime.toFixed(0)}ms`)
    }
    if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
      console.log(`CLS: ${entry.value.toFixed(4)}`)
    }
  }
}).observe({ type: 'largest-contentful-paint', buffered: true })

new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
      console.log(`CLS: ${entry.value.toFixed(4)}`)
    }
  }
}).observe({ type: 'layout-shift', buffered: true })
```

Chrome 的 Performance 面板在录制时也会在 Timings 轨道上显示这些指标的时间点。

## 练习

### 练习一：集成 web-vitals

在你的 React 项目里集成 `web-vitals` 库：

1. 安装并配置采集代码
2. 在浏览器 Console 里观察采集到的数值
3. 在不同页面之间导航，记录每个页面的 LCP、INP、CLS

### 练习二：用 PerformanceObserver 定位问题

不用 `web-vitals`，直接用 PerformanceObserver 采集 LCP。在采集到 LCP 后：

1. 在 Performance 面板的 Timings 轨道上找到 LCP 的时间点
2. 对应到 Main 轨道，看 LCP 时间点之前有哪些阻塞资源
3. 找出影响 LCP 的关键资源

---

## 参考答案

### 练习一

典型的采集结果：
- LCP：取决于页面复杂度，一般在 1-3 秒
- INP：简单的 React 页面通常在 50-150ms
- CLS：如果图片和字体处理得当，通常在 0-0.1

注意：开发模式（React dev mode）的性能比生产模式差很多。用 `npm run build && npm run preview` 测试更准确。

### 练习二

找到 LCP 元素的方法：
1. `performance.getEntriesByType('largest-contentful-paint')` 返回 LCP 条目
2. 条目的 `element` 属性指向 LCP 元素的 DOM 节点
3. 在 Performance 面板里，LCP 时间点之前如果有未完成的 CSS 或 JS 请求，它们就是优化目标

如果 LCP 元素是图片，检查它是否被 preload、是否有 `fetchpriority="high"`、是否被 CSS 或 JS 阻塞。
