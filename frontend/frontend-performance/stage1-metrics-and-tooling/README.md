# 第一阶段：指标与诊断工具

## 阶段目标

理解性能指标和诊断工具，学会先测量再优化。第一阶段不急着改代码，而是建立一份可信的基线报告。

## 课时安排

1. 性能目标：快、稳、可交互
2. Core Web Vitals：LCP、INP、CLS
3. Lab 数据与 Field 数据
4. Chrome DevTools Performance
5. Lighthouse 报告解读
6. 性能归因方法
7. 阶段实战：页面性能体检报告

## 阶段项目

使用贯穿项目：

```text
frontend-performance-course/final-project/performance-rescue-demo
```

本阶段只测量 `slow.html`，不要修改页面。输出 `reports/stage1-audit.md`，记录 Lighthouse、Performance trace、Network waterfall、LCP 元素、CLS 来源、长任务和慢交互。

## 验收标准

- 有 Lighthouse 报告
- 有 Performance trace 截图或关键记录
- 有 Network 面板资源分析
- 每个问题都有证据
- 优先级排序清晰
- 能解释为什么先修 P0，而不是平均用力
