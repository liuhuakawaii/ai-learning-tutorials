# 动画性能

> 同样的动画效果，用 `left` 移动掉帧，用 `transform` 移动流畅。这背后是浏览器渲染管线的分层机制。

## 为什么有些属性动画更"便宜"

上一阶段讲过渲染流水线：Style → Layout → Paint → Composite。不同属性的修改会触发不同的阶段。

**触发 Layout 的属性**：`width`、`height`、`top`、`left`、`margin`、`padding`、`font-size`
→ 每一帧都要重新计算布局，代价最高

**触发 Paint 的属性**：`color`、`background`、`box-shadow`、`outline`
→ 不需要重新布局，但要重新绘制

**只触发 Composite 的属性**：`transform`、`opacity`
→ 直接由 GPU 处理，代价最低

在 Performance 面板里录制一个动画，观察 Main 轨道：
- 用 `left` 动画：每帧都有 Layout + Paint + Composite 色块
- 用 `transform` 动画：只有 Composite 色块（几乎看不到）

## GPU 加速

`transform` 和 `opacity` 之所以便宜，是因为它们可以由 GPU 直接处理，不需要 CPU 参与布局和绘制。

浏览器会把需要独立处理的元素提升为一个**合成层（Composited Layer）**。每个合成层对应 GPU 上的一个纹理。修改 `transform` 或 `opacity` 只需要更新这个纹理的位置或透明度，不需要重新绘制。

在 DevTools 里查看合成层：Performance 面板录制后，选择某个帧，点击 **Layers** 标签页，可以看到页面的合成层树。

## will-change

`will-change` 属性告诉浏览器"这个元素即将变化"，让浏览器提前把它提升为合成层：

```css
.animated-element {
  will-change: transform;
}
```

但 `will-change` 不是越多越好。每个合成层都要占用 GPU 内存（一张位图纹理）。提升太多层会导致**层爆炸（Layer Explosion）**。

## 层爆炸

层爆炸发生在以下情况：浏览器因为一个元素被提升为合成层，而把它的相邻元素或父元素也提升——因为它们在绘制顺序上需要覆盖在合成层之上。

一个典型的例子：

```css
.card {
  /* 这个元素被提升为合成层 */
  animation: slide 1s ease-in-out;
}

/* 如果 .card 的兄弟元素在 z 轴上覆盖它 */
/* 浏览器也会把兄弟元素提升为合成层 */
.card-overlay {
  position: absolute;
  /* 被动提升 */
}
```

在 Performance 面板的 Layers 视图里，如果看到大量合成层（几十个），就是层爆炸。

解决方案：
- 限制动画元素的 `z-index` 范围
- 给动画元素设置 `contain: layout style paint` 限制影响范围
- 不要在大面积元素上做动画

## CSS 动画 vs JavaScript 动画

CSS 动画（`@keyframes` + `animation`）和 JavaScript 动画（`requestAnimationFrame` + 修改样式）在性能上没有本质区别——关键都在于修改的是什么属性。

CSS 动画的优势：
- 浏览器可以在主线程繁忙时仍然保持动画运行
- 可以自动利用 GPU 加成

JavaScript 动画的优势：
- 更灵活（可以响应用户输入、动态调整参数）
- 可以用 GSAP 等库做更复杂的缓动和编排

对于简单的过渡效果（hover、进入/离开），优先用 CSS `transition`。对于复杂的动画序列，用 JavaScript 动画库。

## 检测动画性能

在 Performance 面板里录制动画，关注：

1. **FPS 轨道**：动画期间是否保持绿色（60fps）
2. **Main 轨道**：动画期间是否有长任务
3. **Frames 轨道**：每一帧的实际耗时

在 Console 里也可以实时查看 FPS：

```tsx
let lastTime = performance.now()
let frames = 0

function measureFPS() {
  frames++
  const now = performance.now()
  if (now - lastTime >= 1000) {
    console.log(`FPS: ${frames}`)
    frames = 0
    lastTime = now
  }
  requestAnimationFrame(measureFPS)
}

requestAnimationFrame(measureFPS)
```

## 练习

### 练习一：对比属性动画性能

写一个包含 100 个元素的页面，分别用以下方式做动画，录制 Performance 对比：

1. `element.style.left = ...`
2. `element.style.transform = 'translateX(...)'`
3. `element.style.opacity = ...`

记录每种方式的帧率和 Main 轨道表现。

### 练习二：检测并修复层爆炸

用 DevTools 的 Layers 面板检查你的项目（或一个有动画效果的页面）：

1. 打开 Performance 面板，录制一次包含动画的操作
2. 查看 Layers 视图，记录合成层数量
3. 如果有大量合成层，分析原因并尝试减少

---

## 参考答案

### 练习一

- `left`：FPS 可能在 30-45，Main 轨道上有密集的 Layout 色块
- `transform`：FPS 应该保持 60，Main 轨道几乎没有额外工作
- `opacity`：FPS 保持 60，和 `transform` 类似

100 个元素同时用 `left` 做动画，每一帧要计算 100 个元素的布局——这就是为什么它卡。`transform` 和 `opacity` 跳过了布局和绘制。

### 练习二

检查合成层的方法：
1. Performance 面板 → 录制 → 选择一帧 → Layers 标签
2. 右上角的 "Paint Flashing" 选项可以高亮重绘的区域

层爆炸的常见原因：
- `position: fixed` 或 `position: sticky` 的元素
- 有 `transform` 或 `will-change` 的元素的兄弟节点
- 3D 变换（`translateZ(0)` hack）被滥用

修复：移除不必要的 `will-change`，用 `contain` 限制动画影响范围。
