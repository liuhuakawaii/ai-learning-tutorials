# 相机动画——沿路径飞行、焦点切换、平滑过渡

## 为什么相机不能直接跳

上一课让相机沿 Z 轴直线推进，这在"展示一个物体"的场景里够用。但大多数沉浸式网站的相机动画是**沿一条曲线飞行**的——穿过房间、绕过建筑、从远景飞到特写。

直接在两个点之间线性插值，镜头运动是僵硬的。你见过的那些流畅的镜头运动，背后是**路径曲线 + 速度曲线**的组合。

## 用 CatmullRomCurve3 定义飞行路径

Three.js 的 `CatmullRomCurve3` 接受一组控制点，生成一条穿过所有点的平滑曲线：

```ts
import { CatmullRomCurve3, Vector3 } from "three"

const path = new CatmullRomCurve3([
  new Vector3(0, 2, 10),
  new Vector3(3, 1, 5),
  new Vector3(-2, 0.5, 0),
  new Vector3(0, 1, -5),
  new Vector3(2, 2, -10),
])
```

用 `path.getPoint(t)` 获取曲线上任意位置的坐标，t 从 0 到 1。

## 沿路径移动相机

把 ScrollTrigger 的 progress 直接传给 `getPoint`：

```ts
ScrollTrigger.create({
  trigger: ".wrapper",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    const t = self.progress
    const point = path.getPoint(t)
    camera.position.copy(point)
    renderer.render(scene, camera)
  },
})
```

相机位置动了，但镜头方向还是默认的 (0,0,-1)。你需要同时控制**相机看向哪里**。

## lookAt 的两种用法

**方案 A：始终看向固定点**

```ts
camera.lookAt(0, 0, 0)
```

简单，但相机飞到物体背面时会翻转。

**方案 B：沿另一条曲线看向目标**

```ts
const lookAtPath = new CatmullRomCurve3([
  new Vector3(0, 0, 0),
  new Vector3(0, 0.5, -2),
  new Vector3(0, 1, -5),
])

onUpdate: (self) => {
  const t = self.progress
  camera.position.copy(path.getPoint(t))
  camera.lookAt(lookAtPath.getPoint(t))
}
```

两条曲线可以不同，这样相机会边飞边"转头"，产生更自然的镜头运动。

## 速度曲线——别匀速飞

匀速飞行看起来像监控摄像头。真实镜头有加速和减速。

用 `gsap.parseEase` 或手动映射来调整 t 的分布：

```ts
onUpdate: (self) => {
  // 用 ease 函数重新映射 progress
  const raw = self.progress
  const t = raw < 0.5
    ? 2 * raw * raw        // 前半段加速
    : 1 - Math.pow(-2 * raw + 2, 2) / 2  // 后半段减速

  camera.position.copy(path.getPoint(t))
}
```

或者更简单，用 GSAP 的 ease：

```ts
const easeProgress = gsap.parseEase("power2.inOut")(self.progress)
```

## 焦点切换——分段叙事

一个产品展示页通常有多个"章节"：远景全景 → 产品特写 → 细节放大 → 拆解爆炸图。

用 `path.getPoints()` 把路径分成几段，每段对应一个叙事节点：

```ts
const sections = [
  { range: [0, 0.3], focus: new Vector3(0, 0, 0) },      // 全景
  { range: [0.3, 0.6], focus: new Vector3(0, 1, 0) },    // 特写
  { range: [0.6, 1.0], focus: new Vector3(0, 0.5, 0) },  // 细节
]

onUpdate: (self) => {
  const t = self.progress
  const pos = path.getPoint(t)
  camera.position.copy(pos)

  const section = sections.find(s => t >= s.range[0] && t < s.range[1])
  if (section) {
    camera.lookAt(section.focus)
  }
}
```

## 可视化调试路径

开发时很难凭坐标想象曲线形状。用 `Line` 画出路径：

```ts
import { LineBasicMaterial, Line, BufferGeometry } from "three"

const points = path.getPoints(100)
const geometry = new BufferGeometry().setFromPoints(points)
const material = new LineBasicMaterial({ color: 0x00ff00 })
const pathLine = new Line(geometry, material)
scene.add(pathLine)
```

在最终发布时隐藏它。开发阶段它能救你的命。

## 练习

### 练习一：螺旋上升的相机

创建一条从 (0, -5, 10) 螺旋上升到 (0, 5, 10) 的路径，相机始终看向原点。滚动时相机沿螺旋线飞行。

### 练习二：三段式镜头

定义三个阶段：远观（z=15）→ 侧面特写（x=5, z=2）→ 顶部俯视（y=10, z=0）。每段用不同的 lookAt 目标，段与段之间有平滑的速度过渡。

---

## 参考答案

### 练习一

**思路**：用三角函数生成螺旋控制点，然后构建 CatmullRomCurve3。

```ts
const spiralPoints: Vector3[] = []
for (let i = 0; i <= 20; i++) {
  const t = i / 20
  const angle = t * Math.PI * 4 // 转两圈
  const y = -5 + t * 10
  spiralPoints.push(new Vector3(
    Math.cos(angle) * 3,
    y,
    Math.sin(angle) * 3
  ))
}
const spiralPath = new CatmullRomCurve3(spiralPoints)

ScrollTrigger.create({
  trigger: ".wrapper",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    camera.position.copy(spiralPath.getPoint(self.progress))
    camera.lookAt(0, 0, 0)
    renderer.render(scene, camera)
  },
})
```

### 练习二

**思路**：三段路径控制点 + 分段 lookAt。

```ts
const cameraPath = new CatmullRomCurve3([
  new Vector3(0, 2, 15),
  new Vector3(3, 1, 8),
  new Vector3(5, 1, 2),
  new Vector3(3, 5, 1),
  new Vector3(0, 10, 0),
])

const targets = [
  new Vector3(0, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, 0, 0),
]

function getLookAt(t: number): Vector3 {
  if (t < 0.33) return targets[0]
  if (t < 0.66) return targets[1]
  return targets[2]
}

// 也可以用 lerp 在段间平滑过渡
function getSmoothLookAt(t: number): Vector3 {
  const idx = Math.min(Math.floor(t * 3), 2)
  const next = Math.min(idx + 1, 2)
  const localT = (t * 3) % 1
  return new Vector3().lerpVectors(targets[idx], targets[next], localT)
}
```

**常见错误**：路径控制点太密集或太稀疏。太密会让相机抖动，太稀疏会让曲线不够平滑。通常 5-10 个控制点够用了。
