# 第二阶段：加载与渲染优化

## 阶段目标

掌握浏览器加载链路、关键渲染路径、资源优先级和布局稳定性，并把第一阶段发现的问题改出可量化收益。

## 课时安排

1. 浏览器加载链路
2. 关键渲染路径
3. CSS / JS 阻塞
4. preload、preconnect、lazy load
5. 减少长任务
6. 防止布局抖动
7. 阶段实战：首屏加载优化

## 阶段项目

使用 `final-project/performance-rescue-demo/work.html` 作为练习页，重点处理：

- Hero/LCP 资源发现太晚
- 同步第三方脚本阻塞
- 字体阻塞和布局稳定性
- 异步内容插入导致 CLS
- 首屏渲染中的长任务

优化后与 `slow.html` 和 `optimized.html` 对照，输出 `reports/stage2-loading-before-after.md`。

## 验收标准

- LCP 元素明确
- 关键图片有合理的发现、尺寸和优先级策略
- 异步内容有预留空间，无明显布局抖动
- 阻塞脚本和长任务有处理方案
- 优化前后有数据对比
