# 第三阶段：缓存与性能

## 阶段目标

掌握浏览器缓存、强缓存与协商缓存、CDN 多级缓存的协作机制，能为静态资源设计完整的缓存策略并验证效果。

## 课时列表

1. [浏览器缓存机制——Memory Cache、Disk Cache、Service Worker Cache](11-browser-cache.md)
2. [强缓存 vs 协商缓存——Cache-Control、ETag、Last-Modified 的协作](12-strong-vs-negotiation-cache.md)
3. [CDN 缓存——回源、刷新、预热、多级缓存架构](13-cdn-cache.md)
4. [传输优化——gzip/brotli 压缩、分块传输、SSE](14-transfer-optimization.md)
5. [阶段实战：设计一个静态资源的完整缓存策略](15-stage-project.md)

## 验收标准

- 能画出浏览器缓存查找的完整决策流程（Memory → Disk → 协商 → 回源）
- 能正确配置 Cache-Control、ETag、Last-Modified 并解释它们的协作关系
- 能设计包含 CDN 的多级缓存架构并说明各级缓存的失效策略
- 能对比 gzip 和 brotli 压缩的压缩率与 CPU 开销
