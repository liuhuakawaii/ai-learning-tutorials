# Stage 3 阶段报告：GSAP 大师课

## 学习目标

完成本阶段后，你应该能够：

1. **熟练使用 GSAP 核心 API**
   - 掌握 `gsap.to()`、`gsap.from()`、`gsap.fromTo()` 的参数结构和回调机制
   - 理解 GSAP 如何弥补 CSS 动画在 JS 控制力上的不足
   - 能用 `gsap.set()` 设置初始状态，用 `gsap.quickTo()` 实现高性能鼠标跟随

2. **用 Timeline 编排复杂动画序列**
   - 使用 `gsap.timeline()` 的 `position` 参数精确控制动画的时序关系
   - 实现交错（stagger）、嵌套 timeline 和条件分支
   - 理解 `labels`、`addPause()` 等高级编排功能

3. **用 ScrollTrigger 实现滚动驱动动画**
   - 掌握触发点（trigger）、滚动范围（start/end）的配置
   - 理解 scrub（滚动绑定）和 toggleActions（一次性触发）的区别
   - 能用 pin 固定元素，用 snap 实现滚动吸附

4. **在 React 中正确使用 GSAP**
   - 通过 `useGSAP` hook 管理动画上下文
   - 理解 `gsap.context()` 的清理机制
   - 避免 React 严格模式下的动画重复问题

5. **实现文字拆分动画**
   - 使用 SplitText 将文本拆分为字符/单词/行
   - 配合 GSAP 实现逐字出现、波浪形入场等高级效果

6. **用 MotionPath 驱动元素沿路径运动**
   - 让元素沿 SVG path 或自定义坐标点序列运动
   - 理解路径跟随与旋转偏移的关系

## 核心概念速查

| 概念 | 一句话解释 |
|------|-----------|
| **gsap.to()** | 从当前状态动画到目标状态；最常用的 GSAP 方法。 |
| **gsap.from()** | 从指定状态动画到当前状态；适合元素入场动画。 |
| **gsap.timeline()** | 动画时间线容器，通过 `position` 参数控制子动画的时序偏移和重叠。 |
| **position 参数** | `"<"` 与上一个动画同时开始；`">"` 在上一个动画结束后；`"-=0.5"` 提前 0.5s 开始。 |
| **stagger** | 为一组元素的动画添加交错延迟，支持数值、对象和函数三种形式。 |
| **ScrollTrigger** | GSAP 插件，将动画与滚动位置绑定，支持 scrub、pin、snap 等高级功能。 |
| **gsap.context()** | 动画作用域，`revert()` 可批量清理所有注册的动画；React 中通过 `useGSAP` 自动管理。 |
| **SplitText** | GSAP 文本插件，将 DOM 文本拆分为独立的 `<div>` 元素，便于逐字符/词/行动画。 |
| **MotionPath** | 让元素沿 SVG path 或坐标数组运动的插件，支持自动旋转和路径对齐。 |

## 实践练习

### 练习一：GSAP Timeline 品牌入场动画

为一个虚构品牌创建 5 秒的入场动画序列：Logo 从中心放大出现 → 品牌名逐字淡入 → 副标题从下方滑入 → 导航菜单依次从右侧滑入 → 背景渐变色过渡。

**具体要求**：
- 使用 `gsap.timeline()` 统一编排所有动画
- 用 `position` 参数实现精确的时序控制（至少使用 `"<"`、`">"` 和 `"-=0.3"` 三种写法）
- 为导航菜单使用 `stagger` 实现交错效果
- 提供 `.play()`、`.pause()`、`.reverse()` 按钮控制播放
- 使用 `labels` 标记关键时间点，支持 `.seek("navStart")` 跳转

**目标**：掌握 Timeline 的编排能力和 `position` 参数的各种写法。

### 练习二：ScrollTrigger 长页面叙事

创建一个至少有 5 个"章节"的长页面，每个章节在滚动到视口时触发入场动画，章节标题有 scrub 效果，中间某个章节要 pin 住。

**具体要求**：
- 使用 `scrub: true` 实现滚动绑定的平滑动画
- 至少一个章节使用 `pin: true`，pin 期间播放一个完整动画
- 动画在向下和向上滚动时都能正确响应
- 使用 `toggleActions` 控制一次性触发动画的进入和离开行为
- 使用 `start` 和 `end` 精确控制触发时机（如 `"top 80%"` 和 `"bottom 20%"`）

**目标**：深入理解 ScrollTrigger 的 trigger、start/end、scrub 和 pin 配置。

### 练习三：React 中的 GSAP 组件库

在 React 项目中创建 3 个可复用的动画组件：`<FadeIn>`（淡入）、`<SlideUp>`（从下方滑入）、`<StaggerList>`（列表交错出现）。

**具体要求**：
- 使用 `@gsap/react` 的 `useGSAP` hook 管理动画生命周期
- 组件卸载时正确清理动画（不产生内存泄漏）
- 支持通过 props 控制动画参数（`delay`、`duration`、`ease`）
- `<StaggerList>` 的列表项增减时动画能正确响应
- 在 React 严格模式下测试，确保动画不重复执行

**目标**：掌握 GSAP 在 React 中的正确集成方式和清理模式。

## 自测问题

1. `gsap.to()` 和 CSS `transition` 都能做"从 A 到 B"的动画，GSAP 的优势在哪？列举至少 3 个 CSS 做不到或很难做到的事情。
2. Timeline 的 `position` 参数中，`"<"` 和 `">0"` 分别表示什么？如果我想让第 3 个动画在第 1 个动画开始后 1 秒开始，而不是在第 2 个动画之后，该怎么写？
3. ScrollTrigger 的 `scrub: true` 和 `toggleActions: "play none none none"` 有什么本质区别？分别适合什么场景？
4. 在 React 严格模式下，为什么不用 `useGSAP` 而直接用 `useEffect` + `gsap.to()` 会导致动画重复执行？
5. SplitText 拆分文本后，如果页面窗口大小变化导致文本换行，拆分后的结构会出什么问题？如何处理？

## 常见陷阱

- **忘记注册插件**：`ScrollTrigger`、`MotionPath` 等插件需要 `gsap.registerPlugin()` 注册后才能使用。忘记注册不会报错，但插件功能不生效。
- **Timeline position 累加错误**：默认 position 是 `">"`（上一个动画结束后），如果想让多个动画同时开始，每个都要显式写 `"<"`。
- **React 中 GSAP 动画闪烁**：严格模式下 `useEffect` 会执行两次，导致动画重复。使用 `@gsap/react` 的 `useGSAP` hook 自动处理。
- **ScrollTrigger 刷新问题**：动态内容加载后，ScrollTrigger 的触发点计算会过时。需要调用 `ScrollTrigger.refresh()` 重新计算。
- **SplitText 的 SEO 问题**：拆分后的文本被包裹在大量 `<div>` 中，搜索引擎可能无法正确索引。在生产环境中，考虑用 `aria-label` 保留原始文本。
- **MotionPath 路径方向**：元素默认沿 path 的绘制方向运动。如果运动方向反了，检查 SVG path 的起点和终点，或者用 `autoRotate` 配合 `alignOrigin` 调整。

## 相关课时

- [01-GSAP核心API](../../stage3-gsap-masterclass/01-GSAP核心API.md)
- [02-ScrollTrigger](../../stage3-gsap-masterclass/02-ScrollTrigger.md)
- [03-GSAP与React](../../stage3-gsap-masterclass/03-GSAP与React.md)
- [04-Text动画](../../stage3-gsap-masterclass/04-Text动画.md)
- [05-MotionPath](../../stage3-gsap-masterclass/05-MotionPath.md)
- [06-阶段实战-品牌官网动效](../../stage3-gsap-masterclass/06-阶段实战-品牌官网动效.md)
