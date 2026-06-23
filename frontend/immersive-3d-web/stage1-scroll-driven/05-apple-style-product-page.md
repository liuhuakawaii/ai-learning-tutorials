# 阶段实战：构建 Apple 风格产品滚动展示页

## 这节课要做什么

把前四课学到的技术组合起来，做一个完整的滚动驱动产品展示页。目标效果：

1. **远景登场**：产品从远处飞来，灯光渐亮
2. **正面展示**：相机移到正面，模型缓缓旋转
3. **细节特写**：相机推进到局部，材质细节清晰可见
4. **拆解展示**：模型各部件散开，展示内部结构
5. **收尾回归**：部件合拢，相机退远，文字信息浮现

整个过程由滚动驱动，用户完全掌控节奏。

## 页面结构

```html
<body>
  <div class="scroll-container" style="height: 500vh;">
    <canvas id="scene" style="position: sticky; top: 0;"></canvas>
    <div class="text-overlay">
      <div class="section-title" data-section="0">远见</div>
      <div class="section-title" data-section="1">精工</div>
      <div class="section-title" data-section="2">入微</div>
      <div class="section-title" data-section="3">解构</div>
    </div>
  </div>
</body>
```

文字叠加在 canvas 上方，用 CSS 控制显示/隐藏。

## 场景搭建

```ts
import { Scene, PerspectiveCamera, WebGLRenderer } from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

const scene = new Scene()
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100)
const renderer = new WebGLRenderer({
  canvas: document.getElementById("scene") as HTMLCanvasElement,
  antialias: true,
  alpha: true,
})
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.toneMapping = 2 // ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
```

## 相机路径

定义一条从远到近、从正面到侧面再到顶部的路径：

```ts
import { CatmullRomCurve3, Vector3 } from "three"

const cameraPath = new CatmullRomCurve3([
  new Vector3(0, 3, 15),    // 起点：远处正面
  new Vector3(0, 1, 8),     // 靠近正面
  new Vector3(5, 0.5, 3),   // 侧面特写
  new Vector3(3, 0.5, 1),   // 更近的侧面
  new Vector3(0, 8, 2),     // 顶部俯视
  new Vector3(0, 2, 12),    // 回到远景
])
```

## 分段控制

把 0-1 的 progress 分成 5 段，每段有独立的相机行为和模型状态：

```ts
const segments = [
  { start: 0,   end: 0.2 }, // 远景登场
  { start: 0.2, end: 0.4 }, // 正面展示
  { start: 0.4, end: 0.6 }, // 细节特写
  { start: 0.6, end: 0.8 }, // 拆解
  { start: 0.8, end: 1.0 }, // 收尾
]

function getSegmentProgress(globalP: number, segIdx: number): number {
  const seg = segments[segIdx]
  return Math.max(0, Math.min(1, (globalP - seg.start) / (seg.end - seg.start)))
}
```

## 拆解动画

假设模型由 3 个部件组成（上壳、内部组件、底壳），拆解时各部件沿 Y 轴散开：

```ts
const parts = [topShell, internals, bottomShell]
const explodeOffsets = [2, 0, -2] // 各部件的 Y 偏移

function updateExplode(localP: number) {
  parts.forEach((part, i) => {
    part.position.y = explodeOffsets[i] * localP
  })
}
```

用 ease 函数让拆解有弹性：

```ts
const easedP = gsap.parseEase("back.out(1.5)")(localP)
```

## 文字淡入

用 GSAP 控制 HTML 文字的 opacity 和 transform：

```ts
const titles = document.querySelectorAll(".section-title")

function updateTextOverlay(globalP: number) {
  titles.forEach((el, i) => {
    const localP = getSegmentProgress(globalP, i)
    const opacity = localP > 0.3 && localP < 0.7 ? 1 : 0
    const y = localP < 0.3 ? 30 : localP > 0.7 ? -30 : 0
    gsap.set(el, { opacity, y })
  })
}
```

## 主循环

ScrollTrigger 只负责更新 progress 值，渲染在 rAF 里统一处理：

```ts
let scrollProgress = 0

ScrollTrigger.create({
  trigger: ".scroll-container",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    scrollProgress = self.progress
  },
})

function animate() {
  requestAnimationFrame(animate)

  // 相机沿路径移动
  const easedProgress = gsap.parseEase("power1.inOut")(scrollProgress)
  camera.position.copy(cameraPath.getPoint(easedProgress))

  // 分段处理
  if (scrollProgress < 0.2) {
    const lp = getSegmentProgress(scrollProgress, 0)
    camera.lookAt(0, 0, 0)
    scene.children[0].rotation.y += 0.005
  } else if (scrollProgress < 0.4) {
    camera.lookAt(0, 0.5, 0)
  } else if (scrollProgress < 0.6) {
    camera.lookAt(0, 0.5, 0)
  } else if (scrollProgress < 0.8) {
    const lp = getSegmentProgress(scrollProgress, 3)
    updateExplode(lp)
    camera.lookAt(0, 1, 0)
  } else {
    const lp = getSegmentProgress(scrollProgress, 4)
    updateExplode(1 - lp)
    camera.lookAt(0, 0, 0)
  }

  updateTextOverlay(scrollProgress)
  renderer.render(scene, camera)
}
animate()
```

## 光照设计

整个页面的光照也随滚动变化：

- 第 1 段：暗调，主光从侧面打来，营造悬念
- 第 2 段：全亮，均匀照明，展示产品全貌
- 第 3 段：聚光灯效果，只照亮细节区域
- 第 4 段：冷蓝光，科技感，配合拆解
- 第 5 段：回到温暖的主光

## 最终效果描述

当用户缓慢向下滚动时：

首先看到一个暗色背景中隐约的产品轮廓，相机从远处缓缓靠近。灯光逐渐亮起，产品从阴影中浮现。

继续滚动，相机移到正面，产品完整展现在眼前，表面材质反射着环境光。文字"精工"从下方滑入。

再滚动，镜头推向产品的细节——接缝、按钮、表面纹理在聚光灯下纤毫毕现。

然后产品开始拆解，上壳浮起、内部组件暴露，冷蓝色的光照强调每个零件的精密结构。

最后部件合拢，相机退远，产品回到起始位置，文字"解构"淡出，留下完整的品牌感。

## 练习

### 练习一：替换你自己的模型

用一个你自己的 GLTF/GLB 模型替换示例中的产品。调整相机路径和灯光，让它适合你的模型的形状和尺寸。关键要调整的是控制点坐标和 lookAt 目标。

### 练习二：增加第六段——材质切换

在最后一段（progress 0.8-1.0）收尾之前，插入一段新内容：产品表面材质从默认材质切换到几种不同颜色/材质的效果（陶瓷、金属、木质），模拟产品配色选择器。用 morph targets 或直接切换 material.map 实现。

---

## 参考答案

### 练习一

**思路**：加载模型后先计算 bounding box，根据模型尺寸自动调整相机路径的缩放。

```ts
const loader = new GLTFLoader()
loader.load("your-model.glb", (gltf) => {
  const model = gltf.scene

  // 计算模型尺寸
  const box = new Box3().setFromObject(model)
  const size = box.getSize(new Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)

  // 根据模型尺寸缩放相机距离
  const scale = maxDim / 2
  const cameraPath = new CatmullRomCurve3([
    new Vector3(0, 3 * scale, 15 * scale),
    new Vector3(0, 1 * scale, 8 * scale),
    // ... 按比例缩放
  ])

  scene.add(model)
})
```

### 练习二

**思路**：准备多套材质，在滚动时切换。

```ts
const materials = {
  default: model.material.clone(),
  ceramic: new MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.2 }),
  metal: new MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.1 }),
  wood: new MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 }),
}

const materialKeys = Object.keys(materials)

// 在 progress 0.7-0.8 之间做材质切换
if (scrollProgress >= 0.7 && scrollProgress < 0.8) {
  const localP = (scrollProgress - 0.7) / 0.1
  const idx = Math.floor(localP * materialKeys.length)
  model.material = materials[materialKeys[idx]]
}
```

**常见错误**：直接替换 material 后忘记设置 `needsUpdate = true`。如果是 PBR 材质，确保环境贴图也应用到了新材质上。
