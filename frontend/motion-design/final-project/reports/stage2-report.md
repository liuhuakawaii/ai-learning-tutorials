# Stage 2 阶段报告：CSS 进阶与交互效果

## 学习目标

完成本阶段后，你应该能够：

1. **运用 CSS 3D 变换构建空间动画**
   - 理解 `perspective`、`transform-style: preserve-3d`、`backface-visibility` 的协作关系
   - 能用纯 CSS 实现翻转卡片、立方体旋转等 3D 效果
   - 理解 3D 变换中父子元素的坐标系继承关系

2. **用 SVG 实现路径动画**
   - 掌握 `stroke-dasharray` 和 `stroke-dashoffset` 的描边动画原理
   - 能用 CSS 或 JS 驱动 SVG path 的绘制、变形和运动
   - 理解 `getTotalLength()` 动态获取路径长度的方法

3. **构建滚动驱动动画**
   - 使用 CSS `scroll-timeline` 和 `animation-timeline` 实现纯 CSS 滚动动画
   - 理解其与 JS 滚动监听的本质区别（合成层 vs 主线程）
   - 能处理嵌套滚动容器和自定义滚动方向

4. **实现视差滚动效果**
   - 区分基于 `transform` 的高性能视差和基于 `background-attachment` 的简单视差
   - 能构建多层视差页面，理解各层速度系数的计算方法

5. **用 Canvas 实现粒子系统**
   - 掌握 Canvas 2D 的绘制循环和状态管理
   - 理解粒子生命周期（生成、运动、衰减、销毁）
   - 能构建基本的粒子发射器并优化渲染性能

6. **将 D3 数据绑定与动画结合**
   - 理解 D3 的 `enter/update/exit` 模式如何与过渡动画配合
   - 能实现数据驱动的可视化动画

## 核心概念速查

| 概念 | 一句话解释 |
|------|-----------|
| **perspective** | 定义观察者到 z=0 平面的距离，值越小 3D 效果越强烈；作用于父容器。 |
| **transform-style** | `preserve-3d` 让子元素在 3D 空间中渲染；`flat`（默认）将所有内容压平到 2D。 |
| **backface-visibility** | 控制元素背面是否可见；翻转动画中设置 `hidden` 可避免看到镜像内容。 |
| **SVG stroke-dasharray** | 定义描边的虚线模式；设置为路径总长度时，配合 `dashoffset` 动画可实现"绘制"效果。 |
| **scroll-timeline** | CSS 原生滚动时间线，将滚动进度映射到动画进度，无需 JS 监听 scroll 事件。 |
| **视差滚动** | 前景和背景以不同速度滚动，产生纵深感；核心是不同层的速度系数不同。 |
| **Canvas 粒子系统** | 在每帧清除画布并重绘所有粒子，通过管理粒子的位置、速度、生命周期实现动态效果。 |
| **D3 数据驱动** | `data()` 绑定数据到 DOM，`enter()` 创建新元素，`exit()` 移除旧元素，`transition()` 添加动画。 |

## 实践练习

### 练习一：3D 翻转卡片组

创建一组可交互的卡片（至少 6 张），鼠标悬停时卡片绕 Y 轴翻转 180° 显示背面内容。

**具体要求**：
- 使用 `perspective` 和 `transform-style: preserve-3d` 实现真实 3D 翻转
- 卡片正面是图片，背面是描述文字
- 多张卡片的翻转有交错延迟（stagger effect），用 `transition-delay` 实现
- 翻转过程中不能看到卡片背面的镜像内容（`backface-visibility: hidden`）

**目标**：掌握 CSS 3D 变换的空间思维和 `backface-visibility` 的应用。

### 练习二：SVG 路径动画 Logo

找一个 SVG 格式的 Logo 或图标（至少包含 3 条 path），用 `stroke-dasharray` + `stroke-dashoffset` 实现"一笔一笔绘制出来"的动画效果。

**具体要求**：
- 动画在页面加载时自动播放
- 各 path 的绘制动画依次发生，而非同时
- 绘制完成后填充颜色淡入（transition from stroke-only to filled）
- 使用 JS 的 `getTotalLength()` 动态获取每条路径的长度

**目标**：掌握 SVG 描边动画的核心原理和 `getTotalLength()` 的使用。

### 练习三：滚动驱动数据仪表盘

创建一个长页面，包含 3-4 个数据可视化区块（柱状图、折线图、饼图等）。当用户滚动到每个区块时，图表动画自动触发。

**具体要求**：
- 优先使用 CSS `scroll-timeline` 实现，不支持时降级为 JS
- 柱状图的柱子从底部生长，折线图的线条逐步绘制
- 动画只播放一次（滚动经过后保持终态）
- 各图表区块的动画有合理的触发时机（进入视口 20% 时开始）

**目标**：综合运用滚动驱动动画和 SVG/Canvas 动画。

## 自测问题

1. 为什么 `perspective` 要加在父元素而不是做 3D 变换的元素本身？如果父子元素都设置了 `perspective` 会怎样？
2. SVG `stroke-dasharray: 1000` 和 `stroke-dashoffset: 1000` 同时设置时，为什么路径看起来是完全隐藏的？动画过程中 `dashoffset` 从 1000 变到 0 意味着什么？
3. CSS `scroll-timeline` 和 JavaScript 监听 `scroll` 事件实现滚动动画，性能上有什么本质区别？为什么前者更优？
4. Canvas 粒子系统中，为什么每帧要先 `clearRect` 再重绘所有粒子？如果不清除会怎样？
5. D3 的 `enter/update/exit` 模式中，如果数据量变化（比如从 10 条变到 5 条），`exit()` 选择集包含什么？如何为退出的元素添加过渡动画？

## 常见陷阱

- **3D 变换不生效**：忘记在父元素设置 `perspective` 或 `transform-style: preserve-3d`，子元素的 3D 变换会被压平。还要检查是否被 `overflow: hidden` 截断。
- **SVG 路径长度不固定**：不同 path 的 `getTotalLength()` 值不同，不能用固定值。必须用 JS 动态获取每条路径的长度。
- **scroll-timeline 兼容性**：CSS `scroll-timeline` 在部分浏览器中仍需前缀或尚未完全支持。生产环境建议准备 JS 降级方案。
- **视差在移动端失效**：iOS Safari 对 `background-attachment: fixed` 支持不佳，且移动端滚动性能敏感。移动端建议用 `transform` + JS 的方案，或直接关闭视差。
- **Canvas 性能瓶颈**：粒子数量超过 5000 时，2D Canvas 会明显卡顿。此时应考虑 WebGL（如 Three.js 的粒子系统）或降低粒子数量。
- **D3 transition 与 Vue/React 冲突**：框架管理 DOM 生命周期可能与 D3 的 DOM 操作冲突。推荐让框架负责 DOM 结构，D3 只负责数据计算和过渡动画。

## 相关课时

- [01-3D变换动画](../../stage2-css-transitions/01-3D变换动画.md)
- [02-SVG动画](../../stage2-css-transitions/02-SVG动画.md)
- [03-滚动驱动动画](../../stage2-css-transitions/03-滚动驱动动画.md)
- [04-视差效果](../../stage2-css-transitions/04-视差效果.md)
- [05-粒子系统](../../stage2-css-transitions/05-粒子系统.md)
- [06-阶段实战-交互式数据可视化](../../stage2-css-transitions/06-阶段实战-交互式数据可视化.md)
