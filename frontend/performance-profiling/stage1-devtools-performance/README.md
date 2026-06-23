# 第一阶段：DevTools Performance 面板

## 阶段目标

掌握 Chrome DevTools Performance 面板的全景视图，理解帧率分析、渲染流水线追踪和 Main 轨道的调用栈解读，能输出完整的性能分析报告。

## 课时列表

1. [Performance 面板全景——录制、时间线、火焰图、Summary 每个区域的含义](01-performance-panel-overview.md)
2. [帧率分析——Frames 轨道、长任务识别、60fps 的工程含义](02-frame-rate-analysis.md)
3. [渲染流水线追踪——Recalculate Style → Layout → Paint → Composite 每一步](03-rendering-pipeline.md)
4. [Main 轨道深度解读——调用栈、Task、Microtask 的时间分布](04-main-track-deep-dive.md)
5. [阶段实战：分析一个真实页面并输出性能报告](05-stage1-practice-report.md)

## 验收标准

- 能用 Performance 面板录制并解读时间线、火焰图和 Summary 区域
- 能通过 Frames 轨道识别长任务并定位到具体函数
- 能追踪渲染流水线的每一步（Style → Layout → Paint → Composite）
- 能输出包含帧率、长任务、渲染瓶颈的完整性能报告
