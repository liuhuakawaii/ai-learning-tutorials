# 05. 性能指标采集

> Core Web Vitals（LCP/FID/CLS/INP/TTFB）、Performance API——用数据度量用户感知到的性能

## 本课目标

- 理解 Core Web Vitals 每个指标的含义、计算方式和优化方向
- 掌握 Performance API 和 Performance Observer 的使用
- 能够采集和上报前端性能指标
- 理解 RUM（Real User Monitoring）和实验室测试的区别
- 能为项目设计性能指标采集方案

## 为什么性能指标很重要

用户不会告诉你"页面慢了 500 毫秒"，他们只会觉得"这个网站有点卡"然后离开。

Google 的研究数据：
- 页面加载时间从 1s 增加到 3s，跳出率增加 32%
- 页面加载时间从 1s 增加到 6s，跳出率增加 106%
- 53% 的移动用户在页面加载超过 3 秒时会离开

但"感觉慢"是主观的，你需要客观的指标来衡量和优化。这就是 Web Vitals 的意义——用标准化的指标度量用户感知到的性能。

## Core Web Vitals

Core Web Vitals 是 Google 定义的三个核心性能指标，直接影响 SEO 排名。

### LCP（Largest Contentful Paint）—— 最大内容绘制

**衡量什么**：页面主要内容的加载速度。具体来说，是视口中最大的图片或文本块完成渲染的时间。

```javascript
// LCP 的"最大内容元素"可能是：
// 1. <img> 元素
// 2. <image> 元素（SVG 内）
// 3. <video> 的封面图
// 4. 带有背景图的元素（通过 url() 加载）
// 5. 包含文本节点的块级元素

// 一个典型的 LCP 时间线：
// 0ms     用户开始加载页面
// 200ms   首字节到达（TTFB）
// 400ms   首次内容绘制（FCP）
// 800ms   Hero 图片开始加载
// 1200ms  Hero 图片渲染完成 ← LCP 时间
```

**目标值**：
- Good：≤ 2.5 秒
- Needs Improvement：2.5 - 4 秒
- Poor：> 4 秒

**采集方式**：

```javascript
// 使用 PerformanceObserver
const lcpObserver = new PerformanceObserver((entryList) => {
  const entries = entryList.getEntries();
  const lastEntry = entries[entries.length - 1];
  
  // LCP 可能多次触发（用户滚动、新内容出现）
  // 取最后一次的值
  const lcp = lastEntry.startTime;
  
  console.log('LCP:', lcp);
  console.log('LCP Element:', lastEntry.element);
  console.log('LCP URL:', lastEntry.url);
});

lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
```

**buffered: true 的作用**：PerformanceObserver 只能捕获注册后发生的条目。加了 `buffered: true` 后，会回放缓冲区中已有的条目，确保不遗漏。

### FID（First Input Delay）—— 首次输入延迟（已被 INP 替代）

**衡量什么**：用户第一次与页面交互（点击、按键等）到浏览器实际开始处理事件处理函数的时间差。

```
用户点击按钮
  → 浏览器正在执行长任务（比如 JS 解析）
  → 长任务结束（150ms 后）
  → 浏览器开始执行点击事件处理函数
  
FID = 150ms（等待时间）
```

FID 只测量"延迟"，不测量事件处理函数本身执行了多久。

```javascript
const fidObserver = new PerformanceObserver((entryList) => {
  const firstInput = entryList.getEntries()[0];
  
  // processingStart - startTime = 输入延迟时间
  const fid = firstInput.processingStart - firstInput.startTime;
  
  console.log('FID:', fid);
  console.log('Input Type:', firstInput.name); // click, keydown 等
});

fidObserver.observe({ type: 'first-input', buffered: true });
```

**目标值**：
- Good：≤ 100ms
- Needs Improvement：100 - 300ms
- Poor：> 300ms

### INP（Interaction to Next Paint）—— 交互到下一帧绘制

**衡量什么**：INP 观察用户在页面整个生命周期内所有点击、键盘、触摸交互的延迟，取其中最差的那个（用第 98 百分位数衡量）。2024 年 3 月起，INP 正式替代 FID 成为 Core Web Vitals 指标。

```
INP 不只看第一次交互，而是看所有交互：

交互 1（点击按钮）：延迟 50ms
交互 2（输入搜索）：延迟 80ms  
交互 3（提交表单）：延迟 200ms ← 这是最差的

INP = 200ms（取最差的那个）
```

```javascript
// INP 的采集比 FID 复杂，需要记录所有交互
const interactions = [];

const inpObserver = new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    const interactionTime = entry.processingEnd - entry.startTime;
    interactions.push({
      type: entry.name,
      duration: entry.duration,       // 从输入到下一帧绘制的总时间
      startTime: entry.startTime,
      processingStart: entry.processingStart,
      processingEnd: entry.processingEnd,
    });
  }
});

inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 40 });

// 页面卸载时计算 INP
function calculateINP() {
  if (interactions.length === 0) return null;
  
  // 按 duration 排序，取第 98 百分位
  const sorted = interactions.sort((a, b) => b.duration - a.duration);
  const index = Math.min(Math.floor(sorted.length * 0.02), sorted.length - 1);
  
  return sorted[index].duration;
}
```

**目标值**：
- Good：≤ 200ms
- Needs Improvement：200 - 500ms
- Poor：> 500ms

### CLS（Cumulative Layout Shift）—— 累积布局偏移

**衡量什么**：页面在加载和使用过程中，元素发生意外移动的程度。比如你正要点击一个按钮，突然上方插入了一个广告，按钮被推下去了——你点到了别的东西。

```
CLS 的计算公式：

Layout Shift Score = Impact Fraction × Distance Fraction

Impact Fraction：受影响的区域占视口的比例
Distance Fraction：元素移动的距离占视口的比例

例如：
一个图片加载后，把下方内容推下去 100px
视口高度 1000px
影响区域 500px（50%）
移动距离 100px（10%）

Layout Shift Score = 0.5 × 0.1 = 0.05
```

```javascript
let clsValue = 0;
let clsEntries = [];
let sessionValue = 0;
let sessionEntries = [];
let previousSessionEndTime = 0;

const clsObserver = new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    // 只统计没有用户输入的布局偏移
    if (entry.hadRecentInput) continue;
    
    const firstSessionEntry = sessionEntries[0];
    const lastSessionEntry = sessionEntries[sessionEntries.length - 1];
    
    // 如果和上一次偏移间隔超过 1 秒，或总时间超过 5 秒，开始新的会话
    if (
      entry.startTime - lastSessionEntry?.startTime > 1000 ||
      entry.startTime - firstSessionEntry?.startTime > 5000
    ) {
      // 保存上一个会话的值
      if (sessionValue > clsValue) {
        clsValue = sessionValue;
        clsEntries = [...sessionEntries];
      }
      sessionValue = entry.value;
      sessionEntries = [entry];
    } else {
      sessionValue += entry.value;
      sessionEntries.push(entry);
    }
  }
});

clsObserver.observe({ type: 'layout-shift', buffered: true });
```

**目标值**：
- Good：≤ 0.1
- Needs Improvement：0.1 - 0.25
- Poor：> 0.25

**CLS 的特殊性**：CLS 是一个持续变化的值（页面整个生命周期都在累积），而 LCP、FID 是单次事件。所以 CLS 的上报时机通常是在页面 `visibilitychange` 为 `hidden` 时。

### TTFB（Time to First Byte）—— 首字节时间

**衡量什么**：从发起请求到接收第一个字节的时间。反映服务器响应速度和网络延迟。

```
TTFB = 重定向时间 + DNS 查询 + TCP 连接 + TLS 协商 + 请求发送 + 服务器处理

用户输入 URL
  → DNS 查询 (20ms)
  → TCP 连接 (30ms)
  → TLS 协商 (50ms)
  → 发送请求 (5ms)
  → 服务器处理 (100ms)
  → 收到第一个字节 ← TTFB = 205ms
```

```javascript
// TTFB 通过 Navigation Timing API 采集
const navigation = performance.getEntriesByType('navigation')[0];
const ttfb = navigation.responseStart - navigation.requestStart;

// 或更精确的计算（包含重定向）
const ttfbWithRedirect = navigation.responseStart - navigation.startTime;
```

**目标值**：
- Good：≤ 800ms
- Needs Improvement：800ms - 1.8s
- Poor：> 1.8s

## 其他重要性能指标

### FCP（First Contentful Paint）—— 首次内容绘制

```javascript
const fcpObserver = new PerformanceObserver((entryList) => {
  const fcp = entryList.getEntries()[0];
  console.log('FCP:', fcp.startTime);
});
fcpObserver.observe({ type: 'paint', buffered: true });
```

### TTI（Time to Interactive）—— 可交互时间

TTI 测量页面从开始加载到完全可交互的时间。这个指标没有 Performance API 原生支持，需要 polyfill。

```javascript
// TTI 的定义：
// 1. FCP 已经发生
// 2. 主线程在 5 秒内没有长任务（> 50ms）
// 3. 此时往前推，找到最后一个长任务的结束时间

// 使用 web-vitals 库采集
import { onTTI } from 'web-vitals';

onTTI((metric) => {
  console.log('TTI:', metric.value);
});
```

### TBT（Total Blocking Time）—— 总阻塞时间

```javascript
// TBT = 所有长任务（> 50ms）超出 50ms 部分的总和
// 长任务：执行时间 > 50ms 的任务

// 例如：
// 任务 A：70ms → 阻塞时间 = 70 - 50 = 20ms
// 任务 B：120ms → 阻塞时间 = 120 - 50 = 70ms
// TBT = 20 + 70 = 90ms

const longTasks = [];
const longTaskObserver = new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    longTasks.push(entry);
  }
});
longTaskObserver.observe({ type: 'longtask', buffered: true });

function calculateTBT() {
  return longTasks.reduce((tbt, task) => {
    return tbt + Math.max(0, task.duration - 50);
  }, 0);
}
```

## Performance API 深入

### Navigation Timing API

```javascript
const navigation = performance.getEntriesByType('navigation')[0];

const timing = {
  // DNS 查询
  dns: navigation.domainLookupEnd - navigation.domainLookupStart,
  
  // TCP 连接
  tcp: navigation.connectEnd - navigation.connectStart,
  
  // TLS 协商
  tls: navigation.secureConnectionStart > 0 
    ? navigation.connectEnd - navigation.secureConnectionStart 
    : 0,
  
  // TTFB
  ttfb: navigation.responseStart - navigation.requestStart,
  
  // 内容下载
  contentDownload: navigation.responseEnd - navigation.responseStart,
  
  // DOM 解析
  domParse: navigation.domInteractive - navigation.responseEnd,
  
  // DOM Content Loaded
  domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
  
  // 页面完全加载
  load: navigation.loadEventEnd - navigation.startTime,
  
  // 重定向
  redirect: navigation.redirectEnd - navigation.redirectStart,
};

console.log('Performance Timing:', timing);
```

### Resource Timing API

```javascript
// 获取所有资源的加载时间
const resources = performance.getEntriesByType('resource');

resources.forEach(resource => {
  console.log({
    name: resource.name,
    type: resource.initiatorType, // script, link, img, fetch...
    duration: resource.duration,
    size: resource.transferSize,
    // DNS + TCP + TLS + TTFB + Download
    timing: {
      dns: resource.domainLookupEnd - resource.domainLookupStart,
      tcp: resource.connectEnd - resource.connectStart,
      ttfb: resource.responseStart - resource.requestStart,
      download: resource.responseEnd - resource.responseStart,
    },
  });
});

// 找出加载最慢的资源
const slowest = resources
  .sort((a, b) => b.duration - a.duration)
  .slice(0, 10);
```

### Long Task API

```javascript
// 监控主线程长任务（> 50ms）
const longTaskObserver = new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    console.log({
      duration: entry.duration,        // 任务持续时间
      startTime: entry.startTime,      // 开始时间
      attribution: entry.attribution,  // 任务来源
    });
    
    // 通常 attribution 会告诉你：
    // - script：JS 脚本执行
    // - layout：布局计算
    // - style：样式计算
  }
});

longTaskObserver.observe({ type: 'longtask', buffered: true });
```

## 使用 web-vitals 库

Google 官方提供的 `web-vitals` 库封装了所有 Core Web Vitals 的采集逻辑：

```javascript
import { onLCP, onFID, onCLS, onINP, onTTFB, onFCP } from 'web-vitals';

function reportMetric(metric) {
  // metric 包含：
  // - name: 指标名称
  // - value: 指标值
  // - rating: 'good' | 'needs-improvement' | 'poor'
  // - delta: 与上次上报的差值
  // - id: 唯一标识（用于去重）
  // - entries: 相关的 PerformanceEntry 列表
  
  console.log(`${metric.name}: ${metric.value} (${metric.rating})`);
  
  // 上报到监控平台
  fetch('/api/metrics', {
    method: 'POST',
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      page: location.pathname,
    }),
    keepalive: true,
  });
}

// 采集所有 Core Web Vitals
onLCP(reportMetric);
onFID(reportMetric);
onCLS(reportMetric);
onINP(reportMetric);
onTTFB(reportMetric);
onFCP(reportMetric);
```

## RUM vs 实验室测试

### RUM（Real User Monitoring）

真实用户监控，采集的是真实用户在真实环境中的性能数据。

```
优势：
- 反映真实用户体验
- 覆盖各种设备、网络、浏览器
- 样本量大，统计意义强

劣势：
- 数据有噪声（网络波动、设备差异）
- 只能观察到已上线的版本
- 需要后端存储和分析
```

### 实验室测试（Lab Testing）

在受控环境中模拟用户访问，测量性能指标。

```
常用工具：
- Lighthouse（Chrome DevTools 内置）
- WebPageTest
- Chrome DevTools Performance 面板

优势：
- 环境一致，可重复
- 可以测试未上线的版本
- 提供详细的优化建议

劣势：
- 不代表真实用户体验
- 模拟网络和设备可能与真实情况不同
- 无法覆盖所有用户场景
```

### 最佳实践：两者结合

```
开发阶段：Lab Testing
  → CI 集成 Lighthouse，性能预算检查
  → PR 不能合并如果性能回归

上线后：RUM
  → 采集真实用户数据
  → 按设备/网络/地区分析
  → 发现 Lab 测试无法覆盖的问题
```

## 性能指标采集方案设计

### 采集 SDK

```javascript
class PerformanceMonitor {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate ?? 0.1; // 10% 采样
    this.endpoint = options.endpoint;
    
    if (Math.random() > this.sampleRate) return;
    
    this.collectWebVitals();
    this.collectNavigationTiming();
    this.collectResourceTiming();
    this.collectLongTasks();
  }

  collectWebVitals() {
    // 使用 web-vitals 库
    const report = (metric) => this.send({
      type: 'web-vital',
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      page: location.pathname,
    });

    onLCP(report, { reportAllChanges: true });
    onCLS(report, { reportAllChanges: true });
    onINP(report, { reportAllChanges: true });
    onTTFB(report);
    onFCP(report);
  }

  collectNavigationTiming() {
    const observer = new PerformanceObserver((list) => {
      const nav = list.getEntries()[0];
      this.send({
        type: 'navigation',
        ttfb: nav.responseStart - nav.requestStart,
        domParse: nav.domInteractive - nav.responseEnd,
        domReady: nav.domContentLoadedEventEnd - nav.startTime,
        load: nav.loadEventEnd - nav.startTime,
        redirect: nav.redirectEnd - nav.redirectStart,
        protocol: nav.nextHopProtocol,
      });
    });
    observer.observe({ type: 'navigation', buffered: true });
  }

  collectResourceTiming() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      // 只关注慢资源（> 1 秒）
      const slowResources = entries.filter(e => e.duration > 1000);
      if (slowResources.length > 0) {
        this.send({
          type: 'slow-resources',
          resources: slowResources.map(r => ({
            name: r.name,
            type: r.initiatorType,
            duration: r.duration,
            size: r.transferSize,
          })),
        });
      }
    });
    observer.observe({ type: 'resource', buffered: true });
  }

  collectLongTasks() {
    if (!('PerformanceObserver' in window) ||
        !PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      const tasks = list.getEntries();
      this.send({
        type: 'long-tasks',
        tasks: tasks.map(t => ({
          duration: t.duration,
          startTime: t.startTime,
        })),
      });
    });
    observer.observe({ type: 'longtask' });
  }

  send(data) {
    const payload = {
      ...data,
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent,
      connectionType: navigator.connection?.effectiveType,
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.endpoint, JSON.stringify(payload));
    } else {
      fetch(this.endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
  }
}
```

## 常见误区

### 误区一：只看平均值

**错误理解**：LCP 平均 1.5 秒，性能不错

**正确理解**：平均值会掩盖问题。如果 90% 的用户 LCP 是 1 秒，10% 的用户 LCP 是 10 秒，平均值是 1.9 秒看起来还行，但实际上有 10% 的用户体验极差。应该看 P75（第 75 百分位）。

### 误区二：只在开发环境测性能

**错误理解**：我的 MacBook Pro 上 Lighthouse 100 分，性能没问题

**正确理解**：开发者通常用高性能设备和高速网络。用户的设备可能是三年前的中端手机，网络可能是 4G。必须结合 RUM 数据。

### 误区三：优化到 Good 就够了

**错误理解**：LCP 2.4 秒，在 Good 范围内，不需要优化了

**正确理解**：2.4 秒只比"需要改进"的阈值好一点。如果你的应用是工具类（用户频繁使用），应该追求更快。性能优化的投入产出比需要结合业务场景判断。

## 本课小结

1. **LCP**：主要内容加载完成时间，目标 ≤ 2.5s
2. **INP**：最差交互响应时间，目标 ≤ 200ms（替代了 FID）
3. **CLS**：累积布局偏移，目标 ≤ 0.1
4. **TTFB**：服务器响应时间，目标 ≤ 800ms
5. **Performance API**：Navigation Timing、Resource Timing、Long Task API
6. **采集策略**：web-vitals 库 + PerformanceObserver + 采样上报

## 练习

### 练习一：分析你的项目性能

用 Chrome DevTools 的 Performance 面板和 Lighthouse 分析你当前项目的性能：
- LCP、CLS、INP 分别是多少？
- 最慢的资源加载是什么？
- 有没有长任务（> 50ms）？
- 性能瓶颈在哪？

### 练习二：实现性能采集

为你的项目添加性能采集代码：
- 使用 `web-vitals` 库采集 Core Web Vitals
- 在页面卸载时上报所有指标
- 按设备类型（mobile/desktop）区分上报

## 参考答案

### 练习一

以一个典型的 React SPA 为例：

```
Lighthouse 分析结果：
- Performance: 72
- FCP: 1.8s
- LCP: 3.2s (Poor)
- TBT: 350ms
- CLS: 0.08 (Good)

常见瓶颈：
1. 主 JS bundle 过大（500KB+），解析时间长 → 导致 TBT 高
2. Hero 图片没有预加载 → 导致 LCP 慢
3. 第三方脚本（分析、广告）阻塞主线程
4. 没有使用 SSR 或预渲染 → FCP 慢

优化方向：
- 代码分割，延迟加载非首屏组件
- 图片预加载 + 使用 WebP 格式
- 第三方脚本使用 async/defer
- 考虑 SSR 或 SSG
```

### 练习二

```javascript
// performance-monitor.js
import { onLCP, onFID, onCLS, onINP, onTTFB, onFCP } from 'web-vitals';

const metrics = [];
const endpoint = '/api/performance';

function collectMetric(metric) {
  metrics.push({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
  });
}

// 采集所有 Core Web Vitals
onLCP(collectMetric);
onFID(collectMetric);
onCLS(collectMetric, { reportAllChanges: true });
onINP(collectMetric);
onTTFB(collectMetric);
onFCP(collectMetric);

// 页面卸载时上报
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && metrics.length > 0) {
    const payload = {
      metrics,
      page: location.pathname,
      deviceType: /Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      connectionType: navigator.connection?.effectiveType || 'unknown',
      timestamp: Date.now(),
    };
    
    navigator.sendBeacon(endpoint, JSON.stringify(payload));
  }
});
```

## 下一步

完成本课后，继续学习 [06. 用户行为追踪与埋点](./06-user-behavior-tracking.md)。
