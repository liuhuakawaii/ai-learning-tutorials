# 凸多边形碰撞——SAT（分离轴定理）算法

## 为什么 AABB 和圆不够用

AABB 不能旋转。圆形对长条形物体的近似很差。真实游戏里的物体大多是不规则的凸多边形。

SAT 能检测任意两个凸多边形是否碰撞，而且能给出精确的碰撞法线和穿透深度。它是 2D 物理引擎最常用的碰撞检测算法之一。

## 核心直觉

拿两把尺子，一把横着放，一把斜着放。把它们都投影到桌面上的 x 轴上——如果投影不重叠，它们一定没碰撞。

SAT 的想法是：如果两个凸多边形没碰撞，一定存在某条轴，让它们的投影不重叠。这条轴叫"分离轴"。

反过来，如果所有可能的分离轴上投影都重叠，两个多边形就碰撞了。

关键问题：哪些轴需要检测？答案是每条边的法线。两个多边形的所有边的法线加起来，就是需要检测的全部轴。

## 第一步：投影

把多边形的所有顶点投影到一条轴上，得到一个区间 `[min, max]`：

```ts
interface Vec2 { x: number; y: number }
interface Polygon { vertices: Vec2[] }

function projectPolygon(polygon: Polygon, axis: Vec2): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const v of polygon.vertices) {
    const proj = v.x * axis.x + v.y * axis.y
    if (proj < min) min = proj
    if (proj > max) max = proj
  }
  return { min, max }
}
```

投影就是点积。点积的几何意义是"一个向量在另一个向量方向上有多长"。

## 第二步：检测分离

两个区间如果不重叠，就找到了分离轴：

```ts
function overlapAmount(a: { min: number; max: number }, b: { min: number; max: number }): number {
  return Math.min(a.max - b.min, b.max - a.min)
}
```

返回值大于 0 表示重叠，小于等于 0 表示分离。

## 第三步：获取所有分离轴

从多边形的每条边计算法线：

```ts
function getAxes(polygon: Polygon): Vec2[] {
  const axes: Vec2[] = []
  const verts = polygon.vertices
  for (let i = 0; i < verts.length; i++) {
    const next = verts[(i + 1) % verts.length]
    const edgeX = next.x - verts[i].x
    const edgeY = next.y - verts[i].y
    const len = Math.sqrt(edgeX * edgeX + edgeY * edgeY)
    axes.push({ x: -edgeY / len, y: edgeX / len })
  }
  return axes
}
```

边的法线就是把边向量旋转 90 度再归一化。

## 完整 SAT 检测

```ts
interface SATResult {
  normal: Vec2
  depth: number
}

function satCollision(a: Polygon, b: Polygon): SATResult | null {
  let minDepth = Infinity
  let bestAxis: Vec2 | null = null

  const axesA = getAxes(a)
  const axesB = getAxes(b)
  const allAxes = [...axesA, ...axesB]

  for (const axis of allAxes) {
    const projA = projectPolygon(a, axis)
    const projB = projectPolygon(b, axis)
    const overlap = overlapAmount(projA, projB)

    if (overlap <= 0) return null

    if (overlap < minDepth) {
      minDepth = overlap
      bestAxis = axis
    }
  }

  if (!bestAxis) return null

  const centerA = getCenter(a)
  const centerB = getCenter(b)
  const d = { x: centerB.x - centerA.x, y: centerB.y - centerA.y }
  const dot = d.x * bestAxis.x + d.y * bestAxis.y
  if (dot < 0) {
    bestAxis = { x: -bestAxis.x, y: -bestAxis.y }
  }

  return { normal: bestAxis, depth: minDepth }
}

function getCenter(polygon: Polygon): Vec2 {
  let cx = 0, cy = 0
  for (const v of polygon.vertices) {
    cx += v.x
    cy += v.y
  }
  const n = polygon.vertices.length
  return { x: cx / n, y: cy / n }
}
```

穿透深度最小的轴就是碰撞法线方向。法线方向要从 A 指向 B，通过两个多边形中心的连线来判断。

## 完整示例：旋转多边形碰撞

```ts
const canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 400
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

function createRegularPolygon(cx: number, cy: number, radius: number, sides: number, angle: number = 0): Polygon {
  const vertices: Vec2[] = []
  for (let i = 0; i < sides; i++) {
    const a = angle + (Math.PI * 2 * i) / sides
    vertices.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) })
  }
  return { vertices }
}

let angle1 = 0
let angle2 = 0

function getPolygons(): [Polygon, Polygon] {
  const a = createRegularPolygon(200, 200, 60, 5, angle1)
  const b = createRegularPolygon(400, 200, 50, 4, angle2)
  return [a, b]
}

function drawPolygon(poly: Polygon, color: string, collision: boolean) {
  ctx.fillStyle = collision ? '#ff4444' : color
  ctx.beginPath()
  ctx.moveTo(poly.vertices[0].x, poly.vertices[0].y)
  for (let i = 1; i < poly.vertices.length; i++) {
    ctx.lineTo(poly.vertices[i].x, poly.vertices[i].y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1
  ctx.stroke()
}

function loop() {
  angle1 += 0.02
  angle2 -= 0.015

  const [a, b] = getPolygons()
  const result = satCollision(a, b)

  ctx.clearRect(0, 0, 600, 400)
  drawPolygon(a, '#4a9eff', !!result)
  drawPolygon(b, '#44bb44', !!result)

  if (result) {
    const centerA = getCenter(a)
    ctx.strokeStyle = '#ff0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(centerA.x, centerA.y)
    ctx.lineTo(centerA.x + result.normal.x * 50, centerA.y + result.normal.y * 50)
    ctx.stroke()
  }

  requestAnimationFrame(loop)
}
loop()
```

两个多边形在旋转，碰撞时变红，并画出碰撞法线。

## SAT 的局限

SAT 只能检测**凸多边形**。凹多边形需要先拆成多个凸多边形（凸分解），或者换用其他算法。

SAT 的轴数量随边数增长。两个各有 n 条边的多边形需要检测 2n 条轴。边很多时性能会下降。

对于凸多边形之间的碰撞，还有一个更通用的算法叫 GJK，下一节课会讲。

## 常见错误

**忘记归一化法线**。边向量旋转 90 度后如果不归一化，投影的数值会不对，穿透深度计算就会出错。

**法线方向不确定**。SAT 给出的法线方向可能是反的。必须用两个多边形中心的相对位置来修正方向。

**把凹多边形直接丢给 SAT**。凹多边形在某些轴上的投影可能不连续，SAT 的结论会失效。

## 练习

### 练习一：拖拽多边形

让鼠标可以拖拽其中一个多边形移动。碰撞时显示穿透深度数值。

### 练习二：三角形堆叠

创建 5 个三角形，让它们在重力下落到地面并堆叠起来。用 SAT 检测碰撞，位置修正处理响应。

---

## 参考答案

### 练习一

```ts
let dragTarget: Polygon | null = null
let dragOffset = { x: 0, y: 0 }

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const [a, b] = getPolygons()
  if (pointInPolygon(mx, my, b)) {
    dragTarget = b
    const center = getCenter(b)
    dragOffset = { x: center.x - mx, y: center.y - my }
  }
})

canvas.addEventListener('mousemove', (e) => {
  if (!dragTarget) return
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left + dragOffset.x
  const my = e.clientY - rect.top + dragOffset.y
  const center = getCenter(dragTarget)
  const dx = mx - center.x
  const dy = my - center.y
  for (const v of dragTarget.vertices) {
    v.x += dx
    v.y += dy
  }
})

canvas.addEventListener('mouseup', () => { dragTarget = null })

function pointInPolygon(px: number, py: number, poly: Polygon): boolean {
  let inside = false
  const vs = poly.vertices
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y
    const xj = vs[j].x, yj = vs[j].y
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}
```

### 练习二

三角形堆叠的核心是每帧对所有多边形对做 SAT 检测，碰撞时修正位置。重力加在 vy 上，地面用一个大的静态矩形表示。三角形之间的碰撞用 SAT。注意迭代顺序——先处理穿透最深的碰撞，堆叠会更稳定。
