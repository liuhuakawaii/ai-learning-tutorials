# 从零到一：前端性能与体验工程课程

> 面向前端开发者的性能实战课：从 Core Web Vitals、加载链路、渲染机制，到 React/Next 优化、缓存、监控和性能预算。

## 适合谁

- 已能做页面，但页面慢、卡、闪、指标不稳定
- 想系统掌握性能诊断和优化方法
- 想把性能优化变成可验证、可监控、可持续的工程能力

## 学完能做什么

- 使用 Lighthouse、DevTools、Web Vitals 定位性能问题
- 优化 LCP、INP、CLS 等关键体验指标
- 优化图片、字体、脚本、缓存和渲染路径
- 优化 React / Next.js 页面渲染和交互响应
- 建立性能预算、监控和回归检查

## 技术栈

| 类别 | 技术 |
|------|------|
| 指标 | Core Web Vitals |
| 工具 | Chrome DevTools、Lighthouse、WebPageTest |
| 前端 | React / Next.js |
| 构建 | Vite / Next build analyzer |
| 监控 | web-vitals、Sentry 思路 |
| 部署 | CDN、缓存策略 |

## 学习路线

### 第一阶段：指标与诊断工具

1. 性能优化的目标：快、稳、可交互
2. Core Web Vitals：LCP、INP、CLS
3. Lab 数据与 Field 数据
4. Chrome DevTools Performance 面板
5. Lighthouse 报告解读
6. 性能问题归因：网络、主线程、渲染、资源
7. 阶段实战：页面性能体检报告

### 第二阶段：加载与渲染优化

1. 浏览器加载链路
2. 关键渲染路径
3. HTML、CSS、JS 对首屏的影响
4. 资源优先级：preload、preconnect、lazy load
5. 减少阻塞脚本
6. 防止布局抖动
7. 阶段实战：首屏加载优化

### 第三阶段：React / Next 性能

1. React 渲染成本
2. 状态设计和重渲染控制
3. memo、useMemo、useCallback 的正确使用边界
4. 列表、虚拟滚动和大数据渲染
5. Next.js 图片、字体、路由和缓存
6. Server Components 对性能的影响
7. 阶段实战：Dashboard 交互优化

### 第四阶段：资源、缓存与网络

1. 图片格式、尺寸、响应式图片
2. 字体加载与 FOIT / FOUT
3. 代码分割与按需加载
4. HTTP 缓存、CDN、ETag
5. API 缓存和前端数据缓存
6. 第三方脚本治理
7. 阶段实战：资源体积减半

### 第五阶段：监控、预算与持续优化

1. 性能预算是什么
2. 在 CI 中跑 Lighthouse
3. 线上 Web Vitals 采集
4. 慢交互日志与用户路径
5. 性能回归分析
6. 团队性能规范
7. 阶段实战：性能监控面板

## 最终项目

**Performance Rescue：真实页面性能改造**

你将拿一个故意做慢的电商 / SaaS 页面，完成诊断、优化、监控和报告。

详情见 [最终项目说明](final-project/项目说明.md)。

## 学习建议

1. 性能优化必须先测量再修改。
2. 不要只看 Lighthouse 分数，要看真实用户路径和交互体验。
3. 每次优化都要记录 before / after 数据。

## 参考官方文档

- Web Vitals：https://web.dev/articles/vitals
- Next.js App Router：https://nextjs.org/docs/app

