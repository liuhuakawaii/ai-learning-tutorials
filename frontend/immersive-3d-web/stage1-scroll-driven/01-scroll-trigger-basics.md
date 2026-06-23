# 滚动驱动动画——GSAP ScrollTrigger + Three.js 联动

## 从一个现象说起

打开 Apple 的 iPhone 产品页，向下滚动时，手机模型会旋转、镜头会推进、背景光会变化。这不是一段预渲染视频——它在实时响应你的滚动位置。

做到这一点的关键不是 Three.js 有多强，而是**谁在驱动动画的进度**。

## 两种驱动方式的区别

大多数人做 Three.js 动画时用 `requestAnimationFrame` + 时间：

```ts
function animate() {
  const elapsed = clock.getElapsedTime()
  mesh.rotation.y = elapsed * 0.5
  requestAnimationFrame(animate)
}
```

这种方式适合自动播放的循环动画。但滚动驱动的场景完全不同——动画进度由用户滚动决定，不是时间。

用户可能快速划过，也可能慢慢拖拽，甚至反复来回。你需要一个**归一化的进度值**（0 到 1），把滚动位置映射到动画状态。

## ScrollTrigger 的核心概念

GSAP ScrollTrigger 做的事情很简单：把 DOM 元素的滚动位置映射到一个 0-1 的 `progress`。

```ts
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const trigger = ScrollTrigger.create({
  trigger: ".container",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    const progress = self.progress // 0 → 1
  },
})
```

`start` 和 `end` 定义了滚动区间。当 `.container` 的顶部到达视口顶部时，progress 为 0；当 `.container` 的底部到达视口底部时，progress 为 1。

## 把 progress 接入 Three.js

拿到 progress 后，把它映射到任何 Three.js 属性：

```ts
ScrollTrigger.create({
  trigger: ".canvas-container",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    const p = self.progress

    // 相机沿 Z 轴推进
    camera.position.z = 5 - p * 3

    // 模型旋转
    model.rotation.y = p * Math.PI * 2

    // 材质透明度变化
    model.material.opacity = 1 - p * 0.5

    renderer.render(scene, camera)
  },
})
```

不需要在 `requestAnimationFrame` 里判断滚动——ScrollTrigger 已经帮你处理了节流和回调时机。

## Canvas 的布局问题

Three.js 的 canvas 需要足够长的滚动空间。常见做法：

```html
<div class="canvas-container" style="position: relative; height: 500vh;">
  <canvas style="position: sticky; top: 0; height: 100vh;"></canvas>
</div>
```

`position: sticky` 让 canvas 在滚动时固定在视口内，而外层容器的 500vh 提供了足够的滚动距离。

## 实验：对比有无滚动驱动

写一个最简场景：一个立方体，两套方案。

**方案 A**：时间驱动

```ts
function animate() {
  cube.rotation.y += 0.01
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
```

**方案 B**：滚动驱动

```ts
ScrollTrigger.create({
  trigger: ".wrapper",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    cube.rotation.y = self.progress * Math.PI * 2
    renderer.render(scene, camera)
  },
})
```

把两个方案放在相邻的两个 section 里对比，感受区别：

- 时间驱动：匀速、自动、用户只能看
- 滚动驱动：变速、被动、用户在"操控"动画

这个区别决定了整个课程后续所有内容的基础——你的动画进度来自用户的操作，而不是你的时钟。

## 性能注意事项

ScrollTrigger 的 `onUpdate` 在滚动时高频触发。在里面做渲染没问题，但要注意：

- 不要每次都重建材质或几何体
- 不要在回调里做 DOM 查询
- 只更新这一帧需要变化的属性
- 如果场景复杂，考虑用 `will-change: transform` 提示浏览器

## 练习

### 练习一：滚动控制的淡入淡出

创建一个场景：一个球体从左侧滑入，到中间完全可见，再从右侧滑出。用 ScrollTrigger 的 progress 控制 position.x 和 material.opacity。滚动区间设为 300vh。

### 练习二：多属性联动

一个 torus knot，同时控制：
- rotation.y（旋转一圈）
- scale（从 0.5 到 1.5 再回到 0.5）
- 材质颜色（从蓝到红再到蓝）

用 `progress` 通过插值实现，不要用 GSAP 的 timeline——直接算。

---

## 参考答案

### 练习一

**思路**：把 progress 映射到 x 坐标（-5 → 0 → 5）和 opacity（0 → 1 → 0）。前半段做淡入，后半段做淡出。

```ts
ScrollTrigger.create({
  trigger: ".wrapper",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    const p = self.progress
    sphere.position.x = Math.sin(p * Math.PI) * 5
    sphere.material.opacity = Math.sin(p * Math.PI)
    sphere.material.transparent = true
    renderer.render(scene, camera)
  },
})
```

`Math.sin(p * Math.PI)` 在 0→1 区间产生 0→1→0 的平滑曲线。

### 练习二

**思路**：每个属性独立映射。颜色用 `Color.lerp`。

```ts
import { Color } from "three"

const blue = new Color(0x2266ff)
const red = new Color(0xff2244)
const tempColor = new Color()

ScrollTrigger.create({
  trigger: ".wrapper",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    const p = self.progress
    torusKnot.rotation.y = p * Math.PI * 2
    torusKnot.scale.setScalar(0.5 + Math.sin(p * Math.PI))
    tempColor.copy(blue).lerp(red, Math.sin(p * Math.PI))
    torusKnot.material.color.copy(tempColor)
    renderer.render(scene, camera)
  },
})
```

**常见错误**：直接在回调里 `new Color()`——每帧创建新对象会触发 GC。预先创建好颜色对象，用 `copy` 和 `lerp` 复用。
