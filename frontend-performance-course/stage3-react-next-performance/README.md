# 第三阶段：React / Next 性能

## 阶段目标

理解 React 渲染成本、状态设计、列表渲染和 Next.js 性能能力，并能把这些思路迁移到真实交互页面。

## 课时安排

1. React 渲染机制
2. 状态设计和重渲染
3. memo/useMemo/useCallback 的边界
4. 大列表和虚拟滚动
5. Next 图片、字体、路由
6. Server Components 与缓存
7. 阶段实战：Dashboard 交互优化

## 阶段项目

内置 demo 用原生 JavaScript 复现 React / Dashboard 中最常见的交互瓶颈：搜索、排序、大列表和加入购物车。你需要在 `work.html` 上优化这些交互，并说明如果迁移到 React / Next，应如何使用状态下沉、memo、useMemo、虚拟滚动和 Server Components。

输出 `reports/stage3-interaction-before-after.md`。

## 验收标准

- 关键交互无明显卡顿
- 搜索输入有防抖或低优先级处理
- 大列表不再全量渲染所有 DOM
- 长任务被拆分或延后
- React / Next 迁移说明不滥用 memo，有明确理由
