# 画面合成——3D 与 HTML/CSS 混合排版

## 3D 不是全部

看 Apple 的产品页，3D 模型旁边有标题文字、规格参数、按钮。这些不是用 Three.js TextGeometry 画的——是普通的 HTML/CSS，和 3D 场景在同一个页面上叠加。

纯 3D 页面很难做好排版、响应式、可访问性。把 3D 当作视觉层，HTML 当作内容层，各取所长。

## 三种叠加方式

### 方式一：Canvas 背景 + HTML 前景

最常用。Canvas 固定在背景，HTML 浮在上面：

```css
.canvas-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.content {
  position: relative;
  z-index: 1;
  /* 内容自然滚动 */
}
```

3D 场景在背后播放，HTML 内容在前景滚动。两者各自独立。

### 方式二：Canvas 嵌入内容流

Canvas 是页面内容的一部分，跟着滚动：

```html
<section class="hero">
  <h1>产品名称</h1>
  <p>产品描述</p>
</section>

<div class="canvas-wrapper" style="height: 100vh;">
  <canvas id="scene"></canvas>
</div>

<section class="specs">
  <h2>技术规格</h2>
  ...
</section>
```

适合"先介绍 → 展示 3D → 再介绍"的叙事结构。

### 方式三：Canvas 全屏 + 固定定位内容

Canvas 全屏，部分 HTML 元素也固定在屏幕上，用 JavaScript 控制显隐：

```css
.canvas-container {
  position: fixed;
  inset: 0;
}

.text-overlay {
  position: fixed;
  z-index: 1;
}

.text-block {
  position: absolute;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.5s, transform 0.5s;
}

.text-block.active {
  opacity: 1;
  transform: translateY(0);
}
```

## CSS pointer-events 控制交互穿透

当 HTML 元素覆盖在 Canvas 上时，鼠标事件会被 HTML 拦截，Canvas 收不到 mousemove。

```css
/* 文字不阻挡鼠标事件 */
.text-overlay {
  pointer-events: none;
}

/* 但按钮需要接收点击 */
.text-overlay button {
  pointer-events: auto;
}
```

## 滚动驱动 HTML 和 3D 同步

最核心的技巧：用同一个 ScrollTrigger 同时控制 Three.js 动画和 HTML 元素：

```ts
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: ".wrapper",
    start: "top top",
    end: "bottom bottom",
    scrub: 1,
  },
})

// 3D 动画
tl.to(camera.position, { z: 3, duration: 1 }, 0)

// HTML 动画（同一个 timeline）
tl.to(".title", { opacity: 0, y: -30, duration: 0.3 }, 0)
tl.fromTo(".subtitle", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.3)
```

GSAP 的 timeline 让 3D 和 HTML 动画在同一时间轴上精确对齐。

## HTML 元素的 3D 定位

有时候需要 HTML 元素"附着"在 3D 空间中的某个位置——比如物体旁边的标注文字。

用 `Vector3.project()` 把 3D 坐标投影到屏幕：

```ts
function worldToScreen(position: Vector3): { x: number; y: number } {
  const projected = position.clone().project(camera)
  return {
    x: (projected.x * 0.5 + 0.5) * innerWidth,
    y: (-projected.y * 0.5 + 0.5) * innerHeight,
  }
}

// 每帧更新标注位置
function animate() {
  requestAnimationFrame(animate)
  
  const screenPos = worldToScreen(labelAnchor.position)
  label.style.left = `${screenPos.x}px`
  label.style.top = `${screenPos.y}px`
  
  // 太远或在相机后面时隐藏
  const distance = camera.position.distanceTo(labelAnchor.position)
  label.style.opacity = distance < 10 ? "1" : "0"
  
  renderer.render(scene, camera)
}
```

## 混合排版的设计原则

1. **3D 是氛围，HTML 是信息**：不要用 TextGeometry 显示大段文字
2. **层次要清晰**：确保文字在任何 3D 背景上都可读（加半透明遮罩或文字阴影）
3. **性能分离**：3D 渲染和 HTML 动画用不同的优化策略
4. **响应式**：HTML 自然支持响应式，3D 需要手动调整相机 FOV 和物体位置
5. **可访问性**：HTML 文字可以被屏幕阅读器读取，TextGeometry 不行

## 文字在 3D 背景上的可读性

3D 场景的亮度和颜色不断变化，文字可能在某些时刻看不清。

解决方案：

```css
/* 文字阴影 */
.title {
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}

/* 半透明背景 */
.text-card {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 24px;
}

/* 渐变遮罩 */
.gradient-mask {
  background: linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.6));
}
```

## 练习

### 练习一：3D 标注系统

在 3D 场景中的物体上放置 3 个 HTML 标注。每个标注有标题和描述，用细线连接到物体上的具体位置。相机旋转时标注跟随移动，始终面向屏幕。当标注被物体遮挡时自动隐藏。

### 练习二：滚动章节叙事

做一个 5 段滚动页面：每段有全屏的 3D 背景 + 固定位置的 HTML 文字。3D 场景在各段之间平滑过渡（相机移动、物体变化），HTML 文字淡入淡出。段与段之间有明显的视觉节奏变化。

---

## 参考答案

### 练习一

**思路**：3D 坐标投影到屏幕 + 遮挡检测。

```ts
interface Annotation {
  position: Vector3
  element: HTMLElement
  line: SVGLineElement
}

function updateAnnotations(annotations: Annotation[]) {
  annotations.forEach(ann => {
    const screenPos = worldToScreen(ann.position)
    
    // 更新标注位置
    ann.element.style.transform = `translate(${screenPos.x}px, ${screenPos.y}px)`
    
    // 遮挡检测：比较深度
    const raycaster = new Raycaster()
    raycaster.setFromCamera(
      new Vector2(
        (screenPos.x / innerWidth) * 2 - 1,
        -(screenPos.y / innerHeight) * 2 + 1
      ),
      camera
    )
    const hits = raycaster.intersectObjects(scene.children, true)
    const isOccluded = hits.length > 0 && hits[0].distance < camera.position.distanceTo(ann.position) - 0.1
    
    ann.element.style.opacity = isOccluded ? "0" : "1"
    
    // 更新连接线
    ann.line.setAttribute("x1", String(screenPos.x))
    ann.line.setAttribute("y1", String(screenPos.y))
    // 线的另一端固定在屏幕某位置
  })
}
```

### 练习二

**思路**：GSAP timeline + ScrollTrigger 控制所有动画。

```ts
const sections = [
  { title: "远见", cameraPos: new Vector3(0, 2, 10) },
  { title: "精工", cameraPos: new Vector3(3, 1, 5) },
  { title: "入微", cameraPos: new Vector3(1, 0.5, 2) },
  { title: "解构", cameraPos: new Vector3(0, 3, 3) },
  { title: "回归", cameraPos: new Vector3(0, 2, 10) },
]

const tl = gsap.timeline({
  scrollTrigger: {
    trigger: ".wrapper",
    start: "top top",
    end: "bottom bottom",
    scrub: 1,
    snap: {
      snapTo: 1 / (sections.length - 1), // 吸附到每段
      duration: 0.5,
    },
  },
})

sections.forEach((section, i) => {
  const pos = i / (sections.length - 1)
  
  tl.to(camera.position, {
    x: section.cameraPos.x,
    y: section.cameraPos.y,
    z: section.cameraPos.z,
    duration: 1,
  }, i)
  
  tl.to(`.section-${i}`, {
    opacity: 1,
    y: 0,
    duration: 0.5,
  }, i)
  tl.to(`.section-${i}`, {
    opacity: 0,
    y: -30,
    duration: 0.5,
  }, i + 0.5)
})
```

**常见错误**：`scrub: 1` 的 1 是延迟秒数，不是 boolean。设为 true 等于 0.5。延迟越大，动画跟随滚动越"松"。
