# 前端性能分析工具深度课

> 打开 DevTools Performance 面板，你看得懂火焰图吗？

## 适合谁

- 做过前端开发，但性能优化停留在"压缩图片""加懒加载"
- Performance、Memory、Lighthouse 面板打开过但看不懂
- 想从"凭感觉优化"升级到"用数据驱动优化"

## 学完能做什么

- 用 Chrome DevTools Performance 面板逐帧分析页面渲染过程
- 用 Memory 面板定位内存泄漏（堆快照对比、Allocation Timeline）
- 用 Lighthouse 的评分算法理解每个指标的权重和优化方向
- 采集并分析 Core Web Vitals（LCP/FID/CLS/INP）
- 为团队建立性能监控体系（RUM + Lab 数据）

## 技术栈

| 类别 | 工具 |
|------|------|
| 浏览器工具 | Chrome DevTools（Performance/Memory/Network/Lighthouse） |
| 采集 | web-vitals 库、PerformanceObserver API |
| 分析 | SpeedCurve、WebPageTest |
| 监控 | Sentry Performance、Datadog RUM |
| 项目 | React + Next.js（用于实战分析） |

## 学习路线

### 第一阶段：DevTools Performance 面板

1. Performance 面板全景——录制、时间线、火焰图、Summary 每个区域的含义
2. 帧率分析——Frames 轨道、长任务识别、60fps 的工程含义
3. 渲染流水线追踪——Recalculate Style → Layout → Paint → Composite 每一步
4. Main 轨道深度解读——调用栈、Task、Microtask 的时间分布
5. 阶段实战：分析一个真实页面并输出性能报告

### 第二阶段：内存分析

6. Memory 面板入门——堆快照、内存分配时间线、内存分配采样
7. 内存泄漏定位——堆快照对比（Comparison）、Detached DOM Tree
8. 常见内存泄漏模式——闭包引用、事件监听器未清理、定时器、全局变量
9. 内存优化实践——WeakMap/WeakRef、虚拟滚动、大列表的内存管理
10. 阶段实战：定位并修复一个真实应用的内存泄漏

### 第三阶段：网络与加载

11. Network 面板深度——Timing 轨道的每个阶段含义（DNS/TCP/TTFB/Content Download）
12. 请求瀑布图分析——串行 vs 并行、预加载、预连接的效果
13. 资源加载优化——Code Splitting、Tree Shaking、动态 import 的实际效果
14. Service Worker 缓存策略——Cache API、Workbox、离线优先 vs 网络优先
15. 阶段实战：优化一个页面的加载瀑布图

### 第四阶段：Lighthouse 与 Web Vitals

16. Lighthouse 评分算法——FCP/TBT/LSI/CLS/TTFB 各占多少权重
17. Lab 数据 vs Field 数据——为什么 Lighthouse 分数和用户体感不一致
18. Core Web Vitals 采集——用 web-vitals 库和 PerformanceObserver 采集 LCP/FID/CLS/INP
19. 性能预算设定——怎么定 LCP < 2.5s 的目标并持续达标
20. 阶段实战：搭建一个性能监控 Dashboard

### 第五阶段：实战分析

21. React 性能分析——React DevTools Profiler、渲染次数、不必要的重渲染
22. 长列表性能——虚拟滚动（react-window）、Intersection Observer、分页加载
23. 动画性能——GPU 加速、will-change、合成层、层爆炸
24. 移动端性能——低端设备、弱网、电池优化、触控延迟
25. 阶段实战：为一个真实项目完成完整的性能优化

## 贯穿项目

每阶段的实战任务逐步构建一个性能分析报告：

- 阶段一：用 Performance 面板分析页面，输出帧率和长任务报告
- 阶段二：用 Memory 面板定位内存泄漏，输出堆快照对比
- 阶段三：用 Network 面板分析加载瀑布图，输出优化建议
- 阶段四：用 Lighthouse 和 web-vitals 采集核心指标，搭建 Dashboard
- 阶段五：综合运用所有工具完成完整优化

## 验收标准

- 能用 Performance 面板识别长任务并定位到具体函数
- 能用 Memory 面板通过堆快照对比找到内存泄漏
- 能用 Lighthouse 评分算法解释每个指标的权重
- 能用 web-vitals 库采集 Core Web Vitals 并设置性能预算
- 能为一个真实项目输出完整的性能分析报告

## 参考文档

- Chrome DevTools Performance 文档：https://developer.chrome.com/docs/devtools/performance
- Web Vitals：https://web.dev/vitals/
- Lighthouse Scoring：https://developer.chrome.com/docs/lighthouse/performance
- MDN Performance API：https://developer.mozilla.org/en-US/docs/Web/API/Performance
