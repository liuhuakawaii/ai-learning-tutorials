# Lighthouse 评分算法

> Lighthouse 跑出来 60 分，你不知道该先提哪个指标。了解评分权重后，你就能找到投入产出比最高的优化方向。

## Lighthouse 的 Performance 分数由什么决定

Lighthouse 的 Performance 分数（0-100）由 5 个指标加权计算：

| 指标 | 权重 | 含义 |
|------|------|------|
| **FCP**（First Contentful Paint） | 10% | 首次渲染任何内容（文本、图片、canvas）的时间 |
| **SI**（Speed Index） | 10% | 页面内容的可见填充速度（越快越好） |
| **LCP**（Largest Contentful Paint） | 25% | 最大内容元素（图片或文字块）渲染完成的时间 |
| **TBT**（Total Blocking Time） | 30% | FCP 到 TTI 之间所有长任务的阻塞时间之和 |
| **CLS**（Cumulative Layout Shift） | 25% | 页面生命周期中布局偏移的累积值 |

注意权重分布：**TBT 占 30%，LCP 和 CLS 各占 25%**。这三个指标加起来占 80%。如果你只优化 FCP 和 SI，最多只能影响 20% 的分数。

## TBT（Total Blocking Time）

TBT 是 Lighthouse 评分里权重最高的指标，但很多开发者不了解它。

计算方式：统计 FCP 到 TTI（Time to Interactive）之间所有超过 50ms 的 Task。每个 Task 的"阻塞时间"= Task 耗时 - 50ms。所有 Task 的阻塞时间之和就是 TBT。

比如一个 80ms 的 Task，阻塞时间 = 80 - 50 = 30ms。如果有 3 个这样的 Task，TBT = 90ms。

TBT 的评分阈值（Lighthouse 的打分标准）：
- **0-200ms**：绿色（好）
- **200-600ms**：橙色（需要改进）
- **>600ms**：红色（差）

优化 TBT 的方向：
- 拆分长任务（用 `scheduler.yield()` 或 `setTimeout` 分帧）
- 减少 JavaScript 的解析和编译时间（Code Splitting、Tree Shaking）
- 延迟加载非关键 JavaScript（`defer`、`async`、动态 `import`）
- 用 Web Worker 把计算密集型任务移出主线程

## LCP（Largest Contentful Paint）

LCP 衡量的是用户看到"主要内容"的时间。它不是整个页面加载完成的时间，而是页面上最大的文本块或图片渲染完成的时间。

LCP 元素通常是：
- 首屏的大图（Hero Image）
- 文章标题和第一段文字
- 视频的封面图

LCP 的评分阈值：
- **0-2.5s**：绿色
- **2.5-4s**：橙色
- **>4s**：红色

优化 LCP 的方向：
- 优化 LCP 元素的加载（preload、fetchpriority="high"）
- 减少关键 CSS 和 JS 的加载时间（它们会延迟 LCP 元素的渲染）
- 优化服务器响应时间（TTFB）
- 使用 CDN

## CLS（Cumulative Layout Shift）

CLS 衡量页面的视觉稳定性——内容是否在用户阅读时突然移动。

CLS 的计算基于两个因素：
- **Impact Fraction**：偏移影响的区域占视口的比例
- **Distance Fraction**：元素移动的距离占视口的比例

Layout Shift Score = Impact Fraction × Distance Fraction

所有非用户触发的布局偏移（在 500ms 窗口内）累加得到 CLS。

常见的 CLS 来源：
- 图片没有设置尺寸，加载后撑开布局
- 字体加载导致文字大小变化
- 动态插入的内容（广告、弹窗）推动已有内容
- 动画触发了布局变化

CLS 的评分阈值：
- **0-0.1**：绿色
- **0.1-0.25**：橙色
- **>0.25**：红色

## 读懂 Lighthouse 报告

跑完 Lighthouse 后，报告分成几个部分：

**Metrics（指标）**：5 个核心指标的数值和评分。每个指标有"值"和"分数"。

**Opportunities（优化机会）**：Lighthouse 给出的具体优化建议，每条建议附带预估的节省时间。这些建议按"投入产出比"排序——排在前面的优化通常效果最大。

**Diagnostics（诊断信息）**：更细粒度的性能问题，比如 DOM 节点数量、JavaScript 执行时间等。

**Passed Audits（已通过）**：已经做好的优化项。

## 分数不代表一切

一个重要的认知：Lighthouse 的分数是基于**模拟环境**的。它用一个固定的 CPU 和网络条件（4x CPU throttling、Slow 4G）来模拟中端设备。你的用户可能用更好的设备，也可能用更差的。

Lighthouse 分数低一定说明有问题，但分数高不一定代表用户体验好。后面两节课会详细讲 Lab 数据 vs Field 数据的区别。

## 练习

### 练习一：解读 Lighthouse 报告

对你自己的项目（或任意网站）跑一次 Lighthouse，记录：

1. 各指标的数值和分数
2. Opportunities 列表前 5 条的建议和预估节省时间
3. 根据权重，判断应该优先优化哪个指标

### 练习二：权重敏感性分析

假设你的 Lighthouse 分数是 60 分，各指标得分如下：

- FCP: 80 分（权重 10%）
- SI: 70 分（权重 10%）
- LCP: 50 分（权重 25%）
- TBT: 40 分（权重 30%）
- CLS: 90 分（权重 25%）

如果你只能优化一个指标，优化哪个对总分的提升最大？计算一下。

---

## 参考答案

### 练习一

报告解读的关键不是记住数字，而是理解优先级。比如：

- 如果 TBT 很高（>600ms），而 LCP 和 CLS 都还行，优先优化 JavaScript 加载和执行
- 如果 LCP 很高（>4s），检查 LCP 元素是否被其他资源阻塞
- 如果 CLS 很高（>0.25），检查图片和字体的加载方式

### 练习二

计算每个指标的"提分空间"×"权重"：

- FCP: (100-80) × 10% = 2.0
- SI: (100-70) × 10% = 3.0
- LCP: (100-50) × 25% = 12.5
- TBT: (100-40) × 30% = 18.0
- CLS: (100-90) × 25% = 2.5

**TBT 的提分空间最大**（18.0 分），优化 TBT 对总分的提升效果最明显。

这就是为什么理解权重很重要——不是所有指标都值得同等投入。
