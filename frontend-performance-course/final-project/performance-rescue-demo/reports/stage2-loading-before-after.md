# 第二阶段：加载与渲染优化对比

> **示例报告**：以下是一份填写完成的报告示例，供学员参考格式和深度。实际报告请用你自己的测试数据。

## 本阶段目标

把 `work.html` 的首屏加载、布局稳定性和阻塞资源向 `optimized.html` 收敛。

## 优化前后对比

| 改动 | 优化前 | 优化后 | 证据 |
|------|--------|--------|------|
| LCP 图片发现与优先级 | 无 preload，解析到 `<img>` 才开始下载 | `<link rel="preload" as="image">` 在 head 中 | Network 面板：LCP 图片提前 400ms 开始下载 |
| 图片尺寸/格式/质量 | hero.jpg 1.2MB，原始尺寸 | hero-optimized.jpg 120KB，WebP 格式，质量 80 | 文件大小减少 90% |
| 布局空间预留 | 图片无 width/height，加载后撑开布局 | 所有图片添加 width/height + aspect-ratio | CLS 从 0.35 降到 0.02 |
| 字体加载策略 | 字体文件 200KB 阻塞渲染 | font-display: swap + preload 关键字体 | FCP 提前 300ms，无 FOUT 闪烁 |
| 阻塞脚本 | analytics.js 180KB 同步加载 | defer + 延迟到首屏后 2 秒加载 | TBT 从 1200ms 降到 120ms |
| 首屏长任务 | 单个 800ms 长任务 | 拆分为多个 <50ms 的小任务 | Performance 面板无 >50ms 长任务 |

## 指标变化

| 指标 | slow.html | work.html 优化前 | work.html 优化后 | 说明 |
|------|-----------|------------------|------------------|------|
| LCP | 4.8s | 4.5s | 1.3s | 图片压缩 + preload 效果最显著 |
| CLS | 0.35 | 0.28 | 0.03 | 图片尺寸预留解决大部分偏移 |
| TBT | 1200ms | 1100ms | 150ms | defer 第三方脚本效果显著 |
| FCP | 2.1s | 2.0s | 0.7s | 字体 preload + 减少阻塞资源 |
| JS 传输 | 245 KB | 245 KB | 68 KB | Gzip 压缩 + 移除未使用代码 |

## 决策说明

本阶段最有效的改动：

1. **图片压缩 + preload**（LCP -3.5s）：效果最立竿见影。hero 图片从 1.2MB 压缩到 120KB 并添加 preload，LCP 从 4.8s 降到 1.3s。
2. **defer 第三方脚本**（TBT -1050ms）：analytics.js 从同步改为 defer 后，TBT 从 1200ms 降到 150ms，主线程不再被阻塞。
3. **图片尺寸预留**（CLS -0.32）：所有 `<img>` 添加 width/height 后，CLS 从 0.35 降到 0.03。

没有做或暂缓的改动：

- **图片 CDN**：当前使用本地服务器，未接入 CDN。生产环境建议接入。
- **Service Worker 缓存**：当前未实现离线缓存。可作为后续优化。
- **HTTP/2 Server Push**：需要服务器配置支持，当前未实现。
