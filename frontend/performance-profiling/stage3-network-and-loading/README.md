# 第三阶段：网络与加载

## 阶段目标

掌握 Network 面板的 Timing 轨道和请求瀑布图分析方法，能识别加载瓶颈并用 Code Splitting、Service Worker 等手段优化资源加载。

## 课时列表

1. [Network 面板深度——Timing 轨道的每个阶段含义（DNS/TCP/TTFB/Content Download）](11-network-panel-deep.md)
2. [请求瀑布图分析——串行 vs 并行、预加载、预连接的效果](12-waterfall-analysis.md)
3. [资源加载优化——Code Splitting、Tree Shaking、动态 import 的实际效果](13-resource-loading-optimization.md)
4. [Service Worker 缓存策略——Cache API、Workbox、离线优先 vs 网络优先](14-service-worker-caching.md)
5. [阶段实战：优化一个页面的加载瀑布图](15-stage3-practice-waterfall.md)

## 验收标准

- 能解读 Network 面板 Timing 轨道的每个阶段（DNS/TCP/TTFB/Content Download）
- 能通过瀑布图识别串行加载瓶颈并用预加载/预连接优化
- 能用 Code Splitting 和动态 import 减少首屏加载体积
- 能配置 Service Worker 缓存策略（Cache API/Workbox）
