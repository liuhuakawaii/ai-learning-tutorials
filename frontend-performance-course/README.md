# 从零到一：前端性能与体验工程课程

> 面向前端开发者的项目驱动性能实战课：用一个贯穿式页面完成诊断、优化、复测、监控和性能预算，而不是只背零散指标。

## 课程设计

这门课围绕 `Performance Rescue` 贯穿项目展开。你会从一个故意做慢、做卡、做不稳定的页面开始，逐阶段把它改造成可解释、可验证、可持续监控的高性能页面。

- 统一实验项目：`final-project/performance-rescue-demo`
- 慢速基线：`slow.html`
- 练习页面：`work.html`
- 优化参考：`optimized.html`
- 本地监控页：`monitor.html`
- 每阶段产出一份 before / after 报告，最终合并成完整性能改造报告

## 适合谁

- 已经能做页面，但页面慢、卡、闪、指标不稳定
- 想系统掌握性能诊断和优化方法
- 想把性能优化变成可验证、可监控、可持续的工程能力

## 学完能做什么

- 使用 Lighthouse、Chrome DevTools、Web Vitals 定位性能问题
- 优化 LCP、INP、CLS 等关键体验指标
- 优化图片、字体、脚本、缓存和关键渲染路径
- 优化搜索、排序、大列表等高频交互
- 在 React / Next.js 项目中迁移同样的优化思路
- 建立性能预算、监控采集和回归检查机制

## 快速运行项目

```bash
cd frontend-performance-course/final-project/performance-rescue-demo
pnpm install
pnpm start
```

打开页面：

- 慢速基线：http://localhost:4173/slow.html
- 练习页面：http://localhost:4173/work.html
- 优化参考：http://localhost:4173/optimized.html
- 本地监控：http://localhost:4173/monitor.html

## 技术栈与工具

| 类别 | 内容 |
|------|------|
| 指标 | Core Web Vitals、LCP、INP、CLS、TBT |
| 工具 | Chrome DevTools、Lighthouse、Lighthouse CI |
| Demo | 原生 HTML / CSS / JavaScript，降低环境成本，聚焦浏览器性能本质 |
| 框架迁移 | React / Next.js 阶段讲解组件渲染、状态设计、图片、字体、路由和缓存 |
| 监控 | PerformanceObserver、本地 Web Vitals buffer、RUM 思路 |
| 治理 | 性能预算、CI 检查、回归报告、团队规范 |

## 学习路线

### 第一阶段：指标与诊断工具

1. 性能优化的目标：快、稳、可交互
2. Core Web Vitals：LCP、INP、CLS
3. Lab 数据与 Field 数据
4. Chrome DevTools Performance 面板
5. Lighthouse 报告解读
6. 性能问题归因：网络、主线程、渲染、资源
7. 阶段实战：基于 `slow.html` 输出页面性能体检报告

阶段产出：`reports/stage1-audit.md`

### 第二阶段：加载与渲染优化

1. 浏览器加载链路
2. 关键渲染路径
3. HTML、CSS、JS 对首屏的影响
4. 资源优先级：preload、preconnect、lazy load
5. 减少阻塞脚本和主线程长任务
6. 防止布局抖动
7. 阶段实战：把 `work.html` 的首屏体验向 `optimized.html` 收敛

阶段产出：`reports/stage2-loading-before-after.md`

### 第三阶段：React / Next 性能

1. React 渲染成本
2. 状态设计和重渲染控制
3. memo、useMemo、useCallback 的正确使用边界
4. 列表、虚拟滚动和大数据渲染
5. Next.js 图片、字体、路由和缓存
6. Server Components 对性能的影响
7. 阶段实战：优化搜索、排序、加入购物车和大列表交互

阶段产出：`reports/stage3-interaction-before-after.md`

说明：本仓库 demo 用原生 JavaScript 复现同类交互瓶颈，便于直接观察主线程和 DOM 成本。React / Next 学员可以把同一商品列表迁移成组件版，再用 Profiler 记录渲染范围和优化边界。

### 第四阶段：资源、缓存与网络

1. 图片格式、尺寸、响应式图片
2. 字体加载与 FOIT / FOUT
3. 代码分割与按需加载
4. HTTP 缓存、CDN、ETag
5. API 缓存和前端数据缓存
6. 第三方脚本治理
7. 阶段实战：资源体积减半，并解释收益来自哪里

阶段产出：`reports/stage4-assets-budget.md`

### 第五阶段：监控、预算与持续优化

1. 性能预算是什么
2. 在 CI 中跑 Lighthouse
3. 线上 Web Vitals 采集
4. 慢交互日志与用户路径
5. 性能回归分析
6. 团队性能规范
7. 阶段实战：使用 `monitor.html` 和 `lighthouserc.js` 建立持续检查

阶段产出：`reports/stage5-monitoring-report.md`

## 最终项目

**Performance Rescue：真实页面性能改造**

你将使用内置 demo 或自己的真实项目完成完整闭环：诊断、定位、优化、复测、监控和性能预算。

详情见 [最终项目说明](final-project/项目说明.md)。

## 学习建议

1. 每次优化必须先测量再修改。
2. 不要只看 Lighthouse 分数，要看真实用户路径和交互体验。
3. 每个问题都要写清证据、根因、改法和优化后的数据。
4. 保留 `slow.html` 作为基线，在 `work.html` 上练习，必要时对照 `optimized.html`。

## 参考官方文档

- Web Vitals：https://web.dev/articles/vitals
- Chrome Lighthouse：https://developer.chrome.com/docs/lighthouse
- Next.js App Router：https://nextjs.org/docs/app
