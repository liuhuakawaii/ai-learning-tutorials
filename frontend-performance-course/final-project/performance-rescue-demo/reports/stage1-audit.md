# 第一阶段：性能体检报告

> **示例报告**：以下是一份填写完成的报告示例，供学员参考格式和深度。实际报告请用你自己的测试数据。

## 测试环境

- 测试 URL：http://localhost:3000/slow.html
- 浏览器版本：Chrome 120.0.6099.109
- 网络节流：Fast 3G（1.6 Mbps 下行，750ms RTT）
- CPU 节流：4x slowdown
- 测试时间：2024-01-15 14:30

## 基线指标

| 页面 | LCP | CLS | INP/交互延迟 | TBT | JS 传输 | 图片传输 |
|------|-----|-----|--------------|-----|---------|----------|
| slow.html | 4.8s | 0.35 | 380ms | 1200ms | 245 KB | 1.2 MB |
| optimized.html | 1.2s | 0.02 | 85ms | 120ms | 45 KB | 180 KB |

## Lighthouse 评分

| 类别 | slow.html | optimized.html |
|------|-----------|----------------|
| Performance | 32 | 96 |
| FCP | 2.1s | 0.6s |
| LCP | 4.8s | 1.2s |
| TBT | 1200ms | 120ms |
| CLS | 0.35 | 0.02 |
| Speed Index | 3.9s | 1.1s |

## 关键发现

| 优先级 | 现象 | 证据 | 疑似根因 | 下一步 |
|--------|------|------|----------|--------|
| P0 | LCP 4.8s，远超 2.5s 阈值 | Lighthouse 报告 LCP 元素为 hero 图片 | hero 图片 1.2MB 未压缩，无 preload | 压缩图片 + 添加 preload |
| P0 | CLS 0.35，超过 0.1 阈值 | Performance 面板显示布局偏移 | 图片无尺寸属性，广告脚本动态插入 | 添加 width/height + 预留空间 |
| P1 | TBT 1200ms，主线程阻塞严重 | Performance 面板长任务列表 | 第三方分析脚本 180KB 同步加载 | defer 加载 + 拆分为异步 |
| P1 | JS 传输 245KB | Network 面板 | 未压缩的 vendor.js | 启用 Gzip/Brotli 压缩 |
| P2 | 字体 FOUT 闪烁 | 渲染过程截图 | 字体文件 200KB 阻塞渲染 | font-display: swap + preload |

## 证据附件

- Lighthouse 报告：`screenshots/lighthouse-slow.png`
- Performance trace：`screenshots/performance-trace-slow.json`
- Network waterfall 截图：`screenshots/network-waterfall.png`
- LCP 元素截图：`screenshots/lcp-element.png`
- CLS 来源截图：`screenshots/cls-source.png`
- 慢交互记录：`screenshots/slow-interaction.png`

## 第一阶段结论

先修的问题：

1. **LCP 图片优化**（P0）：hero 图片从 1.2MB 压缩到 120KB，添加 `<link rel="preload">`
2. **CLS 布局稳定**（P0）：所有图片添加 width/height，广告容器预留固定高度
3. **第三方脚本治理**（P1）：分析脚本改为 defer + async，延迟到首屏后加载

理由：LCP 和 CLS 是 Core Web Vitals 的核心指标，直接影响用户体验和搜索排名。TBT 虽然也高，但可以通过 defer 第三方脚本同时解决。
