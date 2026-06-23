# 阶段实战：为一个真实项目完成完整的性能优化

> 这是课程的最后一个实战。把前 24 课学的所有工具和方法组合起来，对一个项目做从分析到优化到验证的完整流程。

## 目标

选择一个中等复杂度的 React 项目（你自己写的或开源的），完成以下任务：

1. 用 Performance 面板分析渲染性能
2. 用 Memory 面板检查内存泄漏
3. 用 Network 面板分析加载瀑布图
4. 用 Lighthouse 建立基线分数
5. 实施至少 5 项优化
6. 对比优化前后的数据
7. 输出完整的性能分析报告

## 选择项目

建议选择以下类型的项目：
- 包含列表页面（表格、卡片列表）
- 包含表单和交互
- 包含路由切换
- 有真实的 API 调用
- 打包后 JS 体积 > 300KB

如果没有合适的项目，可以用 Vite + React + React Router 创建一个包含以下页面的简单应用：
- 首页（有图表或卡片列表）
- 列表页（有 100+ 条数据）
- 详情页（有图片和表单）
- 设置页（有表单）

## 分析清单

### 渲染性能

用 Performance 面板录制每个页面的交互操作：

- [ ] 是否有掉帧？掉帧比例是多少？
- [ ] 是否有长任务？最长的长任务耗时多少？
- [ ] 渲染分布（Scripting/Rendering/Painting）是否合理？
- [ ] 是否有强制同步布局？
- [ ] React 组件是否有不必要的重渲染？

### 内存

用 Memory 面板做堆快照分析：

- [ ] 页面加载后内存大小是否合理（<50MB）？
- [ ] 在页面间反复导航后内存是否持续增长？
- [ ] 是否有 Detached DOM 元素？
- [ ] 是否有闭包引用的大对象？

### 网络加载

用 Network 面板分析加载瀑布图：

- [ ] 首屏 JS 总大小是否 < 200KB（gzip）？
- [ ] 是否有串行加载的请求？
- [ ] 图片是否做了响应式加载？
- [ ] 是否有未使用的资源被打包？
- [ ] 字体加载是否优化了？

### Lighthouse

跑一次 Lighthouse 建立基线：

- [ ] Performance 分数
- [ ] FCP、LCP、TBT、CLS 各指标数值
- [ ] Opportunities 列表前 5 条

## 优化清单

根据分析结果，从以下优化中选择至少 5 项实施：

### 加载优化
- [ ] Code Splitting（路由级懒加载）
- [ ] Tree Shaking 验证
- [ ] 图片压缩和格式优化（WebP/AVIF）
- [ ] 字体优化（preload、font-display: swap）
- [ ] 关键 CSS 提取和内联

### 渲染优化
- [ ] 长列表虚拟滚动
- [ ] React.memo 减少不必要的重渲染
- [ ] 拆分长任务（scheduler.yield）
- [ ] 避免强制同步布局

### 内存优化
- [ ] 修复内存泄漏（事件监听器、定时器清理）
- [ ] 缓存策略优化（LRU、WeakMap）

### 网络优化
- [ ] API 调用并行化
- [ ] Service Worker 缓存
- [ ] 预加载关键资源

## 验证

每项优化后都要验证：

1. **定性验证**：用 Performance 面板录制，观察帧率、长任务、渲染流水线的变化
2. **定量验证**：跑 Lighthouse，对比分数变化
3. **回归验证**：确认优化没有引入新问题（功能正常、没有错误）

## 输出报告模板

```markdown
# 完整性能优化报告

## 项目信息
- 项目名称：
- 技术栈：React + TypeScript + [构建工具]
- 优化前 Lighthouse 分数：

## 分析阶段

### 渲染性能分析
- 主要发现：
- 关键数据：

### 内存分析
- 主要发现：
- 关键数据：

### 网络分析
- 主要发现：
- 关键数据：

### Lighthouse 基线
| 指标 | 数值 | 评级 |
|------|------|------|
| FCP | | |
| LCP | | |
| TBT | | |
| CLS | | |
| Performance Score | | |

## 优化实施

### 优化 1：[名称]
- 问题：
- 方案：
- 效果：
- 验证方式：

### 优化 2：[名称]
...

## 优化后对比

| 指标 | 优化前 | 优化后 | 变化 |
|------|--------|--------|------|
| FCP | | | |
| LCP | | | |
| TBT | | | |
| CLS | | | |
| Performance Score | | | |
| JS Bundle Size | | | |
| DOM 节点数（列表页） | | | |
| 内存占用（列表页） | | | |

## 总结
- 最有效的优化：
- 投入产出比最高的优化：
- 如果继续优化，下一步：
```

## 练习

### 练习一：完成完整优化

选择一个项目，按上面的流程完成从分析到优化到验证的完整过程。输出报告。

至少做到：
- 5 项优化措施
- Lighthouse 分数提升 10 分以上
- 每项优化有数据支撑的验证

### 练习二：建立持续监控

在项目里集成性能监控：

1. 用 `web-vitals` 采集 Core Web Vitals
2. 配置 Lighthouse CI 检查性能预算
3. 设定性能预算（LCP < 2.5s, CLS < 0.1, JS < 200KB）

确保性能优化不是一次性的，而是可以持续维持的。

---

## 参考答案

### 练习一

一份合格的报告应该包含：

1. **有数据的分析**：不是"页面很慢"，而是"首页 LCP 4.2s，主要瓶颈是 350KB 的 JS bundle 的解析和执行"
2. **有逻辑的优化**：不是"加了懒加载"，而是"路由级 Code Splitting 首屏 JS 从 350KB 降到 120KB，LCP 从 4.2s 降到 2.8s"
3. **有对比的验证**：优化前后的 Lighthouse 分数和具体指标数值

### 练习二

持续监控的最小配置：

```tsx
// vitals.ts
import { onLCP, onINP, onCLS } from 'web-vitals'

const budgets = { LCP: 2500, INP: 200, CLS: 0.1 }

function report(metric: { name: string; value: number }) {
  const budget = budgets[metric.name as keyof typeof budgets]
  if (budget && metric.value > budget) {
    console.warn(`[Perf] ${metric.name} exceeded budget: ${metric.value} > ${budget}`)
  }
  // 发送到分析后端
}

onLCP(report)
onINP(report)
onCLS(report)
```

配合 Lighthouse CI，每次 PR 合并前自动检查性能预算。这就是从"一次性优化"到"持续保障"的转变。
