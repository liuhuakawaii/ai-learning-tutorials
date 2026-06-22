# Stage 1 阶段报告：动画基础

## 学习目标

完成本阶段后，你应该能够：

1. **理解浏览器渲染动画的基本原理**
   - 知道帧率（FPS）如何影响动画流畅度
   - 理解主线程（JS 执行、样式计算、布局、绘制）与合成线程的分工
   - 能判断一个动画方案是否会引发卡顿或回流

2. **掌握 CSS 动画的两种范式**
   - 区分 `transition`（状态驱动）和 `animation`（关键帧驱动）的适用场景
   - 能用纯 CSS 实现复杂的入场、退场和循环动画
   - 理解 `animation-fill-mode`、`animation-direction` 等属性的实际作用

3. **使用 Web Animations API 精确控制动画**
   - 在 JavaScript 层面操控动画的播放、暂停、反转和速率
   - 理解 WAAPI 与 CSS 动画的对应关系和各自优势
   - 能用 `Animation.finished` Promise 编排动画序列

4. **用 requestAnimationFrame 构建自定义动画循环**
   - 掌握 `rAF` 的时间戳回调机制
   - 能手动实现帧率无关的动画逻辑（delta time 补偿）
   - 理解 rAF 与 `setInterval` 的本质区别

5. **深入理解缓动函数的设计原理**
   - 理解贝塞尔曲线的控制点如何影响运动感受
   - 能根据场景选择或自定义缓动函数
   - 知道"弹性"、"回弹"等效果的数学表达

## 核心概念速查

| 概念 | 一句话解释 |
|------|-----------|
| **FPS 与帧预算** | 浏览器每秒渲染 60 帧时，每帧约 16.6ms；超过预算则丢帧，用户感知为卡顿。 |
| **渲染管线** | JS → 样式计算 → 布局（Layout）→ 绘制（Paint）→ 合成（Composite）。 |
| **重绘与回流** | 改变 `width`/`left` 等布局属性触发回流（重排），代价高昂；优先用 `transform`/`opacity` 只触发合成层更新。 |
| **CSS Transition** | 基于属性值变化触发的"从 A 到 B"的过渡，适合 hover、focus 等交互反馈。 |
| **CSS Animation** | 用 `@keyframes` 定义多阶段动画，支持循环、延迟、交替方向，适合持续性动画。 |
| **Web Animations API** | 浏览器原生 JS 动画接口，返回 `Animation` 对象，可精确控制播放状态和时间。 |
| **requestAnimationFrame** | 浏览器提供的逐帧回调，回调频率匹配屏幕刷新率，是 JS 动画的基础原语。 |
| **贝塞尔缓动** | 通过两个控制点定义速度曲线；CSS 的 `cubic-bezier()` 和 JS 的自定义缓动都基于此。 |
| **will-change** | 提示浏览器某个属性即将变化，提前创建合成层；滥用会消耗 GPU 内存。 |

## 实践练习

### 练习一：缓动函数可视化对比器

创建一个页面，左右并排展示一个小球的运动，左侧使用 `linear`，右侧使用 `ease-in-out`。通过 `requestAnimationFrame` 同时驱动两个小球，并在上方实时显示当前帧率（FPS 计数器）。

**具体要求**：
- 两个小球必须完全同步启动
- FPS 计数器使用滑动窗口平均（取最近 60 帧的平均值）
- 添加一个按钮可以切换右侧小球的缓动类型（ease-in / ease-out / ease-in-out / cubic-bezier 自定义）
- 记录并对比不同缓动下的视觉感受差异

**目标**：理解缓动对动画"感受"的影响，掌握 rAF 的基本用法。

### 练习二：纯 CSS 骨架屏加载动画

不使用任何 JavaScript，仅用 CSS Animation 实现一个骨架屏（Skeleton Screen）加载效果：包含文本行占位块、头像圆形占位块和卡片占位块，所有元素有错开的闪烁动画。

**具体要求**：
- 至少包含 3 种不同形状的占位块（矩形文本行、圆形头像、方形卡片）
- 使用 `animation-delay` 让各元素的闪烁动画错开
- 使用 `animation-fill-mode: forwards` 保持终态
- 动画在 `prefers-reduced-motion: reduce` 时自动降级为静态灰色块

**目标**：掌握 CSS Animation 的 `@keyframes`、`animation-delay`、`animation-fill-mode` 以及无障碍降级。

### 练习三：WAAPI 弹性弹窗

用 Web Animations API 实现一个模态弹窗的入场/退场动画。入场使用弹性缓动（先放大超过目标尺寸再回弹），退场使用快速缩小 + 淡出。

**具体要求**：
- 入场动画：从 `scale(0.5)` + `opacity(0)` 到 `scale(1)` + `opacity(1)`，使用弹性缓动
- 退场动画：从 `scale(1)` + `opacity(1)` 到 `scale(0.8)` + `opacity(0)`，时长 200ms
- 通过 JS 控制动画的播放和反转，而不是切换 CSS class
- 支持点击遮罩层触发退场，退场完成后隐藏弹窗 DOM
- 使用 `Animation.finished` Promise 等待动画结束

**目标**：掌握 WAAPI 的 `animate()` 方法、`Animation.finished` Promise、以及 `playbackRate` 控制。

## 自测问题

1. 为什么用 `transform: translateX()` 做位移动画比用 `left` 更流畅？从浏览器渲染管线的角度解释。
2. CSS `transition` 和 `animation` 的本质区别是什么？什么场景下用 transition 更合适？
3. `requestAnimationFrame` 的回调参数 `timestamp` 有什么用？为什么不能在 rAF 回调里直接做耗时操作？
4. `cubic-bezier(0.68, -0.55, 0.27, 1.55)` 这个贝塞尔曲线会产生什么效果？控制点的 y 值超出 [0,1] 范围意味着什么？
5. 如何检测用户的 `prefers-reduced-motion` 设置并据此调整动画策略？
6. `setInterval(fn, 16)` 和 `requestAnimationFrame(fn)` 都能实现"每帧执行"，为什么后者更推荐？

## 常见陷阱

- **滥用 `will-change`**：`will-change` 会创建新的合成层，过度使用反而消耗 GPU 内存。只在动画即将开始时添加，动画结束后移除。
- **忘记 `animation-fill-mode`**：动画结束后元素会跳回初始状态。对入场动画使用 `forwards` 保持终态，对初始隐藏的元素使用 `backwards` 在延迟期间保持初始帧。
- **在 rAF 中阻塞主线程**：rAF 回调与渲染共享帧预算，如果回调中有大量计算或 DOM 操作，动画会卡顿。将重计算放到 `requestIdleCallback` 或 Web Worker。
- **忽略动画性能属性**：同时动画 `transform` 和 `opacity` 没问题，但同时动画 `width`、`height`、`margin` 会触发回流，导致性能下降。
- **缓动函数选择不当**：UI 交互通常用短促的缓动（0.2-0.3s），装饰性动画可以用更夸张的缓动。不要对所有动画使用同一个缓动。
- **rAF 回调不取消**：组件销毁时必须调用 `cancelAnimationFrame()`，否则回调继续执行会导致内存泄漏和报错。

## 相关课时

- [01-动画原理](../../stage1-animation-foundations/01-动画原理.md)
- [02-CSS-Transition与Animation](../../stage1-animation-foundations/02-CSS-Transition与Animation.md)
- [03-Web-Animations-API](../../stage1-animation-foundations/03-Web-Animations-API.md)
- [04-请求动画帧](../../stage1-animation-foundations/04-请求动画帧.md)
- [05-缓动函数深入](../../stage1-animation-foundations/05-缓动函数深入.md)
- [06-阶段实战-CSS动画合集](../../stage1-animation-foundations/06-阶段实战-CSS动画合集.md)
