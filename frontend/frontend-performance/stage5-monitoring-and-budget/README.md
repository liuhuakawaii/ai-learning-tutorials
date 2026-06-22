# 第五阶段：监控、预算与持续优化

## 阶段目标

建立持续性能治理能力：性能预算、CI 检查、线上 Web Vitals、慢交互日志和回归分析。

## 课时安排

1. 性能预算
2. CI 中运行 Lighthouse
3. 线上 Web Vitals 采集
4. 慢交互日志
5. 性能回归分析
6. 团队性能规范
7. 阶段实战：性能监控面板

## 阶段项目

使用 demo 中的三部分完成治理闭环：

- `src/vitals.js`：采集 LCP、CLS、INP、Long Task 和自定义交互耗时
- `monitor.html`：查看本地采集到的指标
- `lighthouserc.js`：用 Lighthouse CI 检查性能预算

输出 `reports/stage5-monitoring-report.md`。

## 验收标准

- 有明确性能预算
- CI 能发现明显性能退化
- 本地能采集 LCP、INP、CLS 和慢交互
- 性能报告可持续更新
- 能说明预算超标后的处理流程
