# 第2课：Core Web Vitals：LCP、INP、CLS

> **课程定位**：深入理解 Google 核心性能指标，建立量化优化目标
> **前置知识**：了解性能优化的基本目标（快、稳、可交互）
> **预计时长**：40 分钟

## 场景引入

你在用 PageSpeed Insights 检查公司官网时发现一个矛盾：Lighthouse 报告显示 LCP 只有 1.5 秒，评级为"良好"，但 CrUX 真实用户数据却显示 LCP P75 高达 4.8 秒，评级为"差"。进一步排查发现，LCP 在你的笔记本上测的是标题文字，但真实用户在手机上看到的 LCP 元素是一张 3MB 的 Hero 图片——因为手机屏幕布局不同，首屏最大的内容块完全不同。这个案例说明：不理解 LCP、INP、CLS 的计算规则，你甚至无法正确解读数据。

---

## 学习目标

完成本课学习后，你将能够：

1. 解释 LCP、INP、CLS 三个指标分别衡量什么
2. 说出每个指标的"良好"和"差"的阈值
3. 识别页面上影响 LCP、INP、CLS 的常见问题来源
4. 使用 `web-vitals` 库在浏览器中采集这三个指标
5. 针对一个真实页面，诊断哪个指标最需要优先优化

---

## 一、LCP：加载速度的核心指标

### 1.1 什么是 LCP？

**LCP（Largest Contentful Paint，最大内容绘制）** 衡量的是页面上**最大的可见内容元素**出现在屏幕上的时间。

```
页面加载过程中的 LCP：

  时间轴 ─────────────────────────────────────────→

  0ms        ┌──────────────────────┐
             │                      │
             │   空白               │  ← 用户看到白屏
             │                      │
             └──────────────────────┘

  800ms      ┌──────────────────────┐
             │  标题出现了            │
             │  ───────────────     │
             │                      │  ← FCP（First Contentful Paint）
             │                      │    第一个内容出现，但不是 LCP
             └──────────────────────┘

  1500ms     ┌──────────────────────┐
             │  标题                 │
             │  ───────────────     │
             │  ┌────────────────┐  │
             │  │                │  │  ← LCP！最大的内容块出现
             │  │   Hero 图片    │  │    这张图片是页面上最大的可见元素
             │  │                │  │
             │  └────────────────┘  │
             └──────────────────────┘
```

**关键理解**：LCP 不是整个页面加载完成的时间，而是页面上"最大内容块"出现的时间。用户感知的"页面加载完成"往往就是 LCP 时间。

### 1.2 哪些元素会被算作 LCP？

```
┌──────────────────────────────────────────────────────────────┐
│              可能成为 LCP 元素的类型                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 图片                                                    │
│     ├── <img> 标签                                          │
│     ├── <svg> 内的 <image>                                  │
│     ├── CSS background-image（通过 url() 加载的）            │
│     └── 视频的封面图（poster）                                │
│                                                              │
│  2. 文本块                                                   │
│     ├── 包含文本节点的块级元素                                │
│     ├── <h1>、<p>、<div> 等                                  │
│     └── 通常是首屏最大的一段文字                              │
│                                                              │
│  3. 其他                                                     │
│     └── 带有渐变背景的元素（被视为"内容"）                    │
│                                                              │
│  ⚠️ 不会成为 LCP 元素：                                      │
│     ├── visibility: hidden 的元素                            │
│     ├── opacity: 0 的元素                                    │
│     ├── 被裁剪到不可见的元素（overflow: hidden 裁剪掉的部分）│
│     └── 纯 CSS 动画/渐变（非 url() 加载的图片）              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 LCP 的阈值

```
┌──────────────────────────────────────────────────────────────┐
│                    LCP 阈值标准                                │
├────────────────┬─────────────────┬───────────────────────────┤
│     Good       │ Needs Improve   │        Poor               │
│    ✅ 良好      │  ⚠️ 需改进      │       ❌ 差                │
├────────────────┼─────────────────┼───────────────────────────┤
│   ≤ 2.5 秒     │  2.5 ~ 4 秒     │       > 4 秒              │
├────────────────┼─────────────────┼───────────────────────────┤
│  Google 评估   │  用户开始感到    │  大量用户流失              │
│  为"快"        │  不耐烦          │  SEO 受到负面影响          │
└────────────────┴─────────────────┴───────────────────────────┘
```

### 1.4 常见的 LCP 问题来源

```
导致 LCP 慢的常见原因：

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │  服务器响应慢（TTFB 高）                                 │
  │  ├── 服务器处理时间长                                    │
  │  ├── 数据库查询慢                                        │
  │  ├── CDN 未配置                                          │
  │  └── 太多重定向                                          │
  │                                                         │
  │  关键资源加载慢                                          │
  │  ├── 首屏大图没有 preload                                │
  │  ├── 图片格式不对（用 PNG 而不是 WebP）                  │
  │  ├── 图片尺寸过大（用 2000px 图片显示 400px 的区域）     │
  │  └── CSS/JS 阻塞了渲染                                  │
  │                                                         │
  │  客户端渲染慢                                            │
  │  ├── 大量 JS 需要下载和执行后才渲染内容                   │
  │  ├── CSR（客户端渲染）框架首屏空白                       │
  │  └── 关键 CSS 没有内联                                   │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
```

### 1.5 用代码采集 LCP

```javascript
// 使用 PerformanceObserver 监听 LCP
const observer = new PerformanceObserver((entryList) => {
  const entries = entryList.getEntries();
  const lastEntry = entries[entries.length - 1];

  console.log('LCP:', lastEntry.startTime);
  console.log('LCP 元素:', lastEntry.element);
  console.log('LCP URL:', lastEntry.url); // 如果是图片
});

observer.observe({ type: 'largest-contentful-paint', buffered: true });
```

```javascript
// 使用 web-vitals 库（推荐，更简洁）
import { onLCP } from 'web-vitals';

onLCP((metric) => {
  console.log('LCP:', metric.value);      // 数值（毫秒）
  console.log('评级:', metric.rating);     // 'good' | 'needs-improvement' | 'poor'
  console.log('元素:', metric.entries[0]?.element);
});
```

---

## 二、INP：交互响应的核心指标

### 2.1 什么是 INP？

**INP（Interaction to Next Paint，交互到下次绘制）** 衡量的是用户与页面交互后，页面多久能在屏幕上更新视觉反馈。

```
用户点击按钮后的时间分解：

  用户点击
      │
      ├─→ 输入延迟（Input Delay）
      │   主线程在忙什么？如果有长任务在执行，
      │   点击事件需要排队等待
      │
      ├─→ 处理时间（Processing Time）
      │   事件处理函数执行的时间
      │   包括 JS 计算、DOM 更新、状态变更
      │
      ├─→ 呈现延迟（Presentation Delay）
      │   浏览器将 DOM 变更渲染到屏幕上的时间
      │   包括 Layout、Paint、Composite
      │
      └─→ 视觉反馈（Next Paint）
          用户在屏幕上看到变化
          （按钮变色、弹窗出现、列表更新等）

  ┌────────────────────────────────────────────────────────────┐
  │                                                            │
  │  INP = 输入延迟 + 处理时间 + 呈现延迟                       │
  │                                                            │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
  │  │ 输入延迟  │ │ 处理时间  │ │ 呈现延迟  │ ──→ 视觉反馈     │
  │  │          │ │          │ │          │                   │
  │  │ 等待     │ │ JS 执行  │ │ 渲染     │                   │
  │  └──────────┘ └──────────┘ └──────────┘                   │
  │                                                            │
  └────────────────────────────────────────────────────────────┘
```

### 2.2 INP vs 已废弃的 FID

```
┌──────────────────────────────────────────────────────────────┐
│                INP 与 FID 的区别                              │
├──────────────────┬───────────────────────────────────────────┤
│                  │                                           │
│  FID（已废弃）    │  只测量"第一次"交互的输入延迟              │
│                  │  不包括处理时间和呈现延迟                   │
│                  │  不包括后续交互                             │
│                  │  2024 年已被 INP 替代                      │
│                  │                                           │
├──────────────────┼───────────────────────────────────────────┤
│                  │                                           │
│  INP（当前标准）  │  测量"所有"交互中表现最差的那个            │
│                  │  包含完整的延迟链路（输入+处理+呈现）       │
│                  │  更真实地反映页面的整体交互体验             │
│                  │                                           │
└──────────────────┴───────────────────────────────────────────┘
```

### 2.3 INP 的阈值

```
┌──────────────────────────────────────────────────────────────┐
│                    INP 阈值标准                                │
├────────────────┬─────────────────┬───────────────────────────┤
│     Good       │ Needs Improve   │        Poor               │
│    ✅ 良好      │  ⚠️ 需改进      │       ❌ 差                │
├────────────────┼─────────────────┼───────────────────────────┤
│   ≤ 200ms      │  200 ~ 500ms    │       > 500ms             │
├────────────────┼─────────────────┼───────────────────────────┤
│  操作流畅      │  用户感到卡顿    │  用户可能重复点击          │
│  即时反馈      │  但还能用        │  认为页面无响应            │
└────────────────┴─────────────────┴───────────────────────────┘
```

### 2.4 常见的 INP 问题来源

```
导致 INP 差的常见原因：

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │  输入延迟高（Input Delay）                               │
  │  ├── 长任务阻塞主线程                                    │
  │  ├── 页面初始化期间有大量 JS 执行                        │
  │  ├── 多个事件处理函数排队                                │
  │  └── setTimeout 延迟回调执行                             │
  │                                                         │
  │  处理时间长（Processing Time）                           │
  │  ├── 事件处理函数中做了太多事情                          │
  │  ├── 同步 DOM 操作太多                                   │
  │  ├── 复杂的计算（排序、过滤大量数据）                     │
  │  └── 触发了强制同步布局（读取 offsetHeight 后立即写入）  │
  │                                                         │
  │  呈现延迟高（Presentation Delay）                        │
  │  ├── DOM 变更导致大面积回流                              │
  │  ├── 复杂的 CSS 选择器                                   │
  │  ├── 过多的图层合成                                      │
  │  └── 大量的 Paint 操作                                   │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
```

### 2.5 用代码采集 INP

```javascript
// 使用 PerformanceObserver 监听 INP
const observer = new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    console.log('交互类型:', entry.name);       // click, keydown, etc.
    console.log('输入延迟:', entry.processingStart - entry.startTime);
    console.log('处理时间:', entry.processingEnd - entry.processingStart);
    console.log('呈现延迟:', entry.startTime + entry.duration - entry.processingEnd);
    console.log('总延迟:', entry.duration);
  }
});

observer.observe({ type: 'event', durationThreshold: 0, buffered: true });
```

```javascript
// 使用 web-vitals 库（推荐）
import { onINP } from 'web-vitals';

onINP((metric) => {
  console.log('INP:', metric.value);
  console.log('评级:', metric.rating);

  // attribution 帮助定位问题
  const attribution = metric.attribution;
  console.log('交互类型:', attribution.interactionType);
  console.log('目标元素:', attribution.interactionTarget);
  console.log('输入延迟:', attribution.inputDelay);
  console.log('处理时间:', attribution.processingDuration);
  console.log('呈现延迟:', attribution.presentationDelay);
});
```

---

## 三、CLS：视觉稳定性的核心指标

### 3.1 什么是 CLS？

**CLS（Cumulative Layout Shift，累积布局偏移）** 衡量的是页面在加载和使用过程中，元素发生意外移动的总量。

```
一个典型的布局抖动场景：

  第 1 帧：                    第 2 帧（图片加载后）：
  ┌────────────────────┐      ┌────────────────────┐
  │  标题              │      │  标题              │
  │  ───────────────   │      │  ───────────────   │
  │                    │      │  ┌──────────────┐  │
  │  [图片占位符]       │  →   │  │   图片        │  │
  │                    │      │  │   150px 高     │  │
  │  ───────────────   │      │  └──────────────┘  │
  │  正文内容           │      │  ───────────────   │
  │  你正在阅读这段文字 │      │  正文内容           │
  │                    │      │  ← 整段文字被推下去了│
  │  [点击这里]         │      │  你刚才看的位置变了  │
  └────────────────────┘      └────────────────────┘

  CLS 发生了！用户正在阅读的内容突然下移。
```

### 3.2 CLS 的计算方式

CLS 不是简单地计算"偏移了多少像素"，而是用一个公式来衡量偏移的"影响程度"：

```
┌──────────────────────────────────────────────────────────────┐
│                    CLS 计算公式                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  布局偏移分数 = 影响范围（Impact Fraction）                    │
│               × 移动距离（Distance Fraction）                  │
│                                                              │
│  影响范围 = 不稳定元素影响的区域 ÷ 视口面积                    │
│  移动距离 = 元素移动的最大距离 ÷ 视口高度                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

举个例子：

```
视口大小：1000px × 800px

一个 500px × 200px 的元素从 y=200px 移动到 y=400px

影响范围（Impact Fraction）：
  元素原始位置 + 新位置 的并集面积
  = 从 y=200 到 y=600（400px 高）× 500px 宽
  = 200,000 px²
  视口面积 = 800,000 px²
  Impact Fraction = 200,000 / 800,000 = 0.25

移动距离（Distance Fraction）：
  元素移动了 200px
  视口高度 = 800px
  Distance Fraction = 200 / 800 = 0.25

本次布局偏移分数 = 0.25 × 0.25 = 0.0625
```

### 3.3 CLS 的"会话窗口"

Google 不是把页面生命周期中所有偏移加在一起，而是用**会话窗口（Session Window）**来计算：

```
┌──────────────────────────────────────────────────────────────┐
│              CLS 会话窗口机制                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  规则：                                                       │
│  1. 连续的布局偏移，间隔 < 1 秒，总窗口 < 5 秒，算作一个会话  │
│  2. 取所有会话窗口中 CLS 值最大的那个作为最终 CLS              │
│                                                              │
│  时间轴示例：                                                 │
│  ─────────────────────────────────────────────────────→      │
│  0s   1s   2s   3s   5s   6s   7s   8s  10s                 │
│  ▲    ▲    ▲         ▲    ▲                                 │
│  │    │    │         │    │                                  │
│  移动 移动 移动      移动 移动                                │
│  .01  .02  .03       .15  .08                                │
│  ├──────────────────┤  ├────────────┤                        │
│   会话窗口 1: 0.06     会话窗口 2: 0.23                      │
│                                                              │
│  最终 CLS = max(0.06, 0.23) = 0.23                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.4 CLS 的阈值

```
┌──────────────────────────────────────────────────────────────┐
│                    CLS 阈值标准                                │
├────────────────┬─────────────────┬───────────────────────────┤
│     Good       │ Needs Improve   │        Poor               │
│    ✅ 良好      │  ⚠️ 需改进      │       ❌ 差                │
├────────────────┼─────────────────┼───────────────────────────┤
│   ≤ 0.1        │  0.1 ~ 0.25     │       > 0.25              │
├────────────────┼─────────────────┼───────────────────────────┤
│  页面稳定      │  偶尔有抖动      │  频繁抖动，严重影响操作    │
│  用户体验好    │  用户可能误点    │  用户感到沮丧              │
└────────────────┴─────────────────┴───────────────────────────┘
```

### 3.5 常见的 CLS 问题来源

```
导致 CLS 的常见原因（按影响程度排序）：

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │  1. 图片/视频没有设置尺寸                                │
  │     <img src="hero.jpg"> ← 没有 width/height            │
  │     加载完成后才撑开空间，把下方内容挤下去                │
  │     修复：设置 width/height 或使用 aspect-ratio          │
  │                                                         │
  │  2. 动态注入的内容                                       │
  │     Cookie 提示、促销横幅、通知栏                        │
  │     从页面顶部插入，把现有内容往下推                      │
  │     修复：预留空间或从底部插入                            │
  │                                                         │
  │  3. Web 字体加载                                         │
  │     FOUT（Flash of Unstyled Text）                       │
  │     字体加载完成后文字宽度变化                            │
  │     修复：font-display: optional 或预加载字体             │
  │                                                         │
  │  4. 动态计算的内容                                       │
  │     JS 加载数据后渲染列表、表格                          │
  │     容器高度不确定                                       │
  │     修复：设置 min-height 预留空间                       │
  │                                                         │
  │  5. 广告和嵌入内容                                       │
  │     iframe、广告位、社交组件                             │
  │     尺寸未知，加载后改变布局                              │
  │     修复：为广告位预留固定尺寸                            │
  │                                                         │
  │  6. 在现有内容上方插入元素                               │
  │     JS 动态在 DOM 顶部插入元素                           │
  │     修复：使用 transform 动画代替 DOM 插入               │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
```

### 3.6 用代码采集 CLS

```javascript
// 使用 PerformanceObserver 监听 CLS
let clsValue = 0;
let sessionValue = 0;
let sessionEntries = [];

const observer = new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    // 只计算非用户预期的布局偏移
    if (!entry.hadRecentInput) {
      // 会话窗口逻辑：间隔 < 1秒，窗口 < 5秒
      const firstEntryTime = sessionEntries[0]?.startTime || entry.startTime;
      if (entry.startTime - firstEntryTime < 1000 &&
          entry.startTime - sessionEntries[0]?.startTime < 5000) {
        sessionValue += entry.value;
        sessionEntries.push(entry);
      } else {
        sessionValue = entry.value;
        sessionEntries = [entry];
      }
      clsValue = Math.max(clsValue, sessionValue);
    }
  }
  console.log('当前 CLS:', clsValue);
});

observer.observe({ type: 'layout-shift', buffered: true });
```

```javascript
// 使用 web-vitals 库（推荐）
import { onCLS } from 'web-vitals';

onCLS((metric) => {
  console.log('CLS:', metric.value);
  console.log('评级:', metric.rating);

  // 查看哪些元素导致了偏移
  for (const entry of metric.entries) {
    console.log('偏移元素:', entry.sources?.[0]?.node);
    console.log('偏移值:', entry.value);
  }
});
```

---

## 四、完整采集脚本

### 4.1 使用 web-vitals 库同时采集三个指标

```javascript
// vitals-reporter.js
import { onLCP, onINP, onCLS } from 'web-vitals';

function sendToAnalytics(metric) {
  const data = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,       // 'good' / 'needs-improvement' / 'poor'
    delta: metric.delta,
    id: metric.id,
    page: window.location.pathname,
    timestamp: Date.now(),
  };

  // 使用 sendBeacon 确保页面关闭前也能发送
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', JSON.stringify(data));
  } else {
    fetch('/api/vitals', {
      method: 'POST',
      body: JSON.stringify(data),
      keepalive: true,
    });
  }
}

// 采集三个核心指标
onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);

// 控制台输出（开发时使用）
onLCP(console.log);
onINP(console.log);
onCLS(console.log);
```

### 4.2 用 PerformanceObserver 采集（不用第三方库）

```javascript
// 纯原生实现，无依赖，体积更小
function observeVitals() {
  // LCP
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lcp = entries[entries.length - 1];
    report('LCP', lcp.startTime);
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  // CLS
  let cls = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        cls += entry.value;
      }
    }
    report('CLS', cls);
  }).observe({ type: 'layout-shift', buffered: true });

  // INP（通过 event 类型）
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      report('INP', entry.duration);
    }
  }).observe({ type: 'event', durationThreshold: 0, buffered: true });
}

function report(name, value) {
  console.log(`${name}: ${value}`);
}
```

---

## 五、三个指标在页面生命周期中的位置

```
页面加载时间线与 Core Web Vitals：

  ←──── 加载阶段 ──────────────────────────→  ←── 交互阶段 ──→

  DNS  TCP  TLS  请求  响应  解析  渲染       用户操作
  │    │    │    │     │     │     │            │
  ▼    ▼    ▼    ▼     ▼     ▼     ▼            ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │  TTFB                                                       │
  │  ├──────┤                                                   │
  │                    FCP                                       │
  │                    ├────┤                                    │
  │                         LCP                                 │
  │                         ├────────┤                          │
  │                                                              │
  │                                    CLS（持续测量）            │
  │                                    ├────────────────────→    │
  │                                                              │
  │                                                    INP      │
  │                                                    ├────┤    │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘

  TTFB = Time to First Byte（服务器响应时间）
  FCP  = First Contentful Paint（第一个内容出现）
  LCP  = Largest Contentful Paint（最大内容出现）→ 衡量"快"
  CLS  = Cumulative Layout Shift（布局偏移）     → 衡量"稳"
  INP  = Interaction to Next Paint（交互响应）   → 衡量"可交互"
```

---

## 六、Lab 数据 vs Field 数据的指标差异

```
┌──────────────────────────────────────────────────────────────┐
│              同一个指标在 Lab 和 Field 中的差异                 │
├──────────┬───────────────────────┬───────────────────────────┤
│  指标    │  Lab 数据              │  Field 数据               │
├──────────┼───────────────────────┼───────────────────────────┤
│  LCP     │  Lighthouse 报告中的   │  web-vitals 采集的真实     │
│          │  "Largest Contentful   │  用户 LCP 时间             │
│          │  Paint"               │  取 P75 值                 │
├──────────┼───────────────────────┼───────────────────────────┤
│  INP     │  Lab 中无法测量 INP！  │  只能通过 Field 数据采集   │
│          │  因为 INP 需要真实     │  需要用户实际交互          │
│          │  用户交互              │  取 P75 值                 │
├──────────┼───────────────────────┼───────────────────────────┤
│  CLS     │  Lighthouse 报告中的   │  web-vitals 采集的真实     │
│          │  "Cumulative Layout    │  用户 CLS 值               │
│          │  Shift"               │  取 P75 值                 │
└──────────┴───────────────────────┴───────────────────────────┘

⚠️ 重要：INP 只能通过 Field 数据测量，Lab 数据无法模拟真实用户交互。
   这也是为什么你必须采集线上数据的原因。
```

---

## 常见误区

1. **把 LCP 等同于页面加载完成时间**：LCP 衡量的是页面上最大内容元素的出现时间，不是所有资源加载完成的时间。一个页面可能 LCP 很快但还有大量资源在后台加载。
2. **在 Lab 中测量 INP**：INP 需要真实用户交互才能测量，Lighthouse 等 Lab 工具无法模拟真实交互。Lab 中的 TBT 只是 INP 的近似替代指标。
3. **忽略 CLS 的会话窗口机制**：CLS 不是把所有布局偏移简单相加，而是取会话窗口中的最大值。理解这个机制才能正确诊断 CLS 问题。
4. **只关注 P50 而忽视 P75**：Google 评估 Core Web Vitals 看的是 P75（第 75 百分位数），即 75% 的用户体验。平均值掩盖了尾部用户的糟糕体验。

## 工程建议

1. **同时采集 Lab 和 Field 数据**：开发阶段用 Lighthouse 做门槛，上线后立即集成 web-vitals 采集真实用户数据。
2. **使用 web-vitals 的 attribution 功能**：`metric.attribution` 能告诉你 LCP 是哪个元素、INP 是哪个交互导致的，大幅缩短排查时间。
3. **用 sendBeacon 上报数据**：确保页面关闭前性能数据也能发送成功，`navigator.sendBeacon` 比 `fetch` 更可靠。
4. **按维度下钻分析**：按设备类型、网络条件、地域等维度拆分数据，找出问题最严重的用户群体。

## 动手练习

### 练习一：测量你的网站

```
步骤：
1. 选择你正在开发的一个网站（或任意一个你管理的网站）
2. 安装 web-vitals：npm install web-vitals
3. 在入口文件中添加采集代码：
   import { onLCP, onINP, onCLS } from 'web-vitals';
   onLCP(console.log);
   onINP(console.log);
   onCLS(console.log);
4. 打开浏览器访问页面
5. 等待 LCP 和 CLS 数据输出
6. 进行几次点击操作，触发 INP 测量
7. 记录三个指标的数值和评级

问题：
- 哪个指标最差？为什么？
- LCP 对应的元素是什么？（可以从 entry.element 获取）
- CLS 是由什么元素引起的？
```

### 练习二：诊断 LCP 问题

```
步骤：
1. 打开 Chrome DevTools → Performance 面板
2. 录制一次页面加载
3. 在录制结果中找到 LCP 标记（绿色竖线）
4. 点击 LCP 标记，查看对应的 DOM 元素
5. 检查这个元素：
   - 如果是图片：它的格式是什么？尺寸多大？是否被 preload？
   - 如果是文字：是否有 CSS/JS 阻塞了渲染？
6. 查看 Network 面板的瀑布图，找到 LCP 资源的加载时间线

分析：
- LCP 元素是从什么时候开始加载的？
- 有没有更早加载但不重要的资源占用了带宽？
- 你能做什么来让 LCP 元素更早出现？
```

### 练习三：制造并修复 CLS

```
步骤：
1. 创建一个包含以下问题的 HTML 页面：
   - 一张没有 width/height 的图片
   - 一个延迟 2 秒后从顶部插入的横幅
   - 一个使用 Google Fonts 的标题（没有 preload）
2. 打开页面，观察布局抖动
3. 使用 web-vitals 采集 CLS 值
4. 逐个修复这些问题：
   - 给图片添加 width/height
   - 为横幅预留空间
   - 预加载字体或使用 font-display: optional
5. 再次测量 CLS，对比修复前后的数值

问题：
- 修复前 CLS 是多少？修复后呢？
- 哪个问题对 CLS 的影响最大？
```

---

## 小结

本课的核心要点：

1. **LCP 衡量"快"**：页面上最大内容元素的出现时间，阈值是 ≤ 2.5 秒为良好
2. **INP 衡量"可交互"**：用户交互后到页面视觉更新的完整延迟，阈值是 ≤ 200ms 为良好。注意 INP 只能通过 Field 数据测量
3. **CLS 衡量"稳"**：页面元素意外移动的累积量，阈值是 ≤ 0.1 为良好
4. **web-vitals 是采集首选**：Google 官方库，体积仅 ~1.5KB，支持 attribution 归因
5. **INP 无法在 Lab 中测量**：这是必须采集线上数据的重要原因之一

---

## 下一课预告

下一课我们将深入 Lab 数据和 Field 数据的区别——你将了解为什么 Lighthouse 分数很高但用户仍然抱怨慢，以及如何正确使用两种数据来做性能决策。同时你还会学习如何获取 Google 的 CrUX（Chrome UX Report）数据，这是 Google 搜索排名的真实依据。
