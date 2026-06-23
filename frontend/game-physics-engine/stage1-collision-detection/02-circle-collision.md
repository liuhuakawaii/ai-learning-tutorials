# 圆形碰撞——圆-圆、圆-矩形检测

## 为什么圆形碰撞重要

圆形是最自然的碰撞形状。球、子弹、粒子、角色的头部——很多东西用圆来近似比用矩形更合理。

而且圆形碰撞检测的计算量比多边形小得多。两个圆只需要算一次距离，比 SAT 或 GJK 简单一个数量级。

## 圆-圆碰撞

两个圆碰撞的条件极其直观：圆心距小于半径之和。

```ts
interface Circle {
  x: number
  y: number
  radius: number
}

function circleOverlap(a: Circle, b: Circle): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const distSq = dx * dx + dy * dy
  const radiusSum = a.radius + b.radius
  return distSq < radiusSum * radiusSum
}
```

这里用距离的平方来比较，避免了开方运算。开方在每帧要检测几百对碰撞时是不小的开销。

### 碰撞信息

知道碰撞了还不够，需要法线和穿透深度来修正位置：

```ts
function circleCollisionInfo(a: Circle, b: Circle): { normal: { x: number; y: number }; depth: number } | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const distSq = dx * dx + dy * dy
  const radiusSum = a.radius + b.radius

  if (distSq >= radiusSum * radiusSum) return null

  const dist = Math.sqrt(distSq)

  if (dist === 0) {
    return { normal: { x: 1, y: 0 }, depth: radiusSum }
  }

  return {
    normal: { x: dx / dist, y: dy / dist },
    depth: radiusSum - dist,
  }
}
```

两个圆心重合时要特殊处理——此时没有确定的碰撞方向，随便选一个方向推开。

### 位置修正

```ts
function resolveCircleCollision(a: Circle, b: Circle, info: { normal: { x: number; y: number }; depth: number }): void {
  const half = info.depth / 2
  a.x -= info.normal.x * half
  a.y -= info.normal.y * half
  b.x += info.normal.x * half
  b.y += info.normal.y * half
}
```

这里把两个圆各推开一半距离。如果其中一个物体是静态的（比如墙壁），就只移动另一个。

## 圆-矩形碰撞

这个稍微复杂一些。直觉上，最近点在矩形的哪条边上，就从那个方向推开。

```ts
interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function circleRectInfo(circle: Circle, rect: Rect): { normal: { x: number; y: number }; depth: number } | null {
  const closestX = Math.max(rect.minX, Math.min(circle.x, rect.maxX))
  const closestY = Math.max(rect.minY, Math.min(circle.y, rect.maxY))

  const dx = circle.x - closestX
  const dy = circle.y - closestY
  const distSq = dx * dx + dy * dy

  if (distSq >= circle.radius * circle.radius) return null

  const dist = Math.sqrt(distSq)

  if (dist === 0) {
    const toCenterX = circle.x - (rect.minX + rect.maxX) / 2
    const toCenterY = circle.y - (rect.minY + rect.maxY) / 2
    const absX = Math.abs(toCenterX)
    const absY = Math.abs(toCenterY)

    if (absX > absY) {
      const sign = toCenterX > 0 ? 1 : -1
      const depth = sign > 0
        ? (rect.maxX - rect.minX) / 2 + circle.radius
        : (rect.maxX - rect.minX) / 2 + circle.radius
      return { normal: { x: sign, y: 0 }, depth }
    } else {
      const sign = toCenterY > 0 ? 1 : -1
      return { normal: { x: 0, y: sign }, depth: (rect.maxY - rect.minY) / 2 + circle.radius }
    }
  }

  return {
    normal: { x: dx / dist, y: dy / dist },
    depth: circle.radius - dist,
  }
}
```

核心思路是先找到矩形上离圆心最近的点（clamp 操作），然后用圆心到最近点的距离判断碰撞。这比分别检测四条边和四个角要简洁得多。

## 完整示例：弹跳的球

```ts
const canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 400
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

const ball: Ball = { x: 200, y: 100, vx: 3, vy: 0, radius: 20 }

const walls: Rect[] = [
  { minX: 0, minY: 380, maxX: 600, maxY: 400 },
  { minX: 0, minY: 0, maxX: 600, maxY: 20 },
  { minX: 0, minY: 0, maxX: 20, maxY: 400 },
  { minX: 580, minY: 0, maxX: 600, maxY: 400 },
]

const box: Rect = { minX: 250, minY: 250, maxX: 350, maxY: 290 }

const GRAVITY = 0.5
const DAMPING = 0.8

function update() {
  ball.vy += GRAVITY
  ball.x += ball.vx
  ball.y += ball.vy

  const circleAsCircle: Circle = { x: ball.x, y: ball.y, radius: ball.radius }

  for (const wall of [...walls, box]) {
    const info = circleRectInfo(circleAsCircle, wall)
    if (info) {
      ball.x += info.normal.x * info.depth
      ball.y += info.normal.y * info.depth

      const dot = ball.vx * info.normal.x + ball.vy * info.normal.y
      ball.vx -= 2 * dot * info.normal.x * DAMPING
      ball.vy -= 2 * dot * info.normal.y * DAMPING
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, 600, 400)
  ctx.fillStyle = '#4a9eff'
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#666'
  for (const w of walls) {
    ctx.fillRect(w.minX, w.minY, w.maxX - w.minX, w.maxY - w.minY)
  }
  ctx.fillStyle = '#999'
  ctx.fillRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY)
}

function loop() {
  update()
  draw()
  requestAnimationFrame(loop)
}
loop()
```

球在重力下落，碰到墙壁和中间的矩形会弹跳。`DAMPING` 控制弹跳衰减——设成 1 会永远弹，设成 0.8 每次弹跳损失 20% 的能量。

## 常见错误

**圆-矩形碰撞时只检测圆心是否在矩形内**。当圆很大、矩形很小时，圆心在矩形外面但仍然碰撞。必须用最近点方法。

**忘记开方就用距离做穿透深度**。比较是否碰撞可以用距离平方，但算穿透深度必须开方，因为深度是线性的。

**位置修正后不更新速度**。只推开位置不改速度，物体下一帧会再次撞进去，产生抖动。

## 练习

### 练习一：圆-圆弹球

实现一个场景：10 个球在画布里互相碰撞和弹跳。每个球有不同的半径和初始速度。

### 练习二：最近点可视化

在 Canvas 上画一个矩形和一个跟随鼠标的圆。实时显示矩形上离圆最近的点，用一条线连接圆心和最近点。

---

## 参考答案

### 练习一

```ts
interface Ball { x: number; y: number; vx: number; vy: number; radius: number }

const balls: Ball[] = Array.from({ length: 10 }, () => ({
  x: Math.random() * 500 + 50,
  y: Math.random() * 300 + 50,
  vx: (Math.random() - 0.5) * 6,
  vy: (Math.random() - 0.5) * 6,
  radius: Math.random() * 15 + 10,
}))

function update() {
  for (const ball of balls) {
    ball.vy += 0.3
    ball.x += ball.vx
    ball.y += ball.vy
  }

  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const info = circleCollisionInfo(
        { x: balls[i].x, y: balls[i].y, radius: balls[i].radius },
        { x: balls[j].x, y: balls[j].y, radius: balls[j].radius },
      )
      if (info) {
        resolveCircleCollision(balls[i], balls[j], info)
        const dot1 = balls[i].vx * info.normal.x + balls[i].vy * info.normal.y
        const dot2 = balls[j].vx * info.normal.x + balls[j].vy * info.normal.y
        balls[i].vx += (dot2 - dot1) * info.normal.x * 0.9
        balls[i].vy += (dot2 - dot1) * info.normal.y * 0.9
        balls[j].vx += (dot1 - dot2) * info.normal.x * 0.9
        balls[j].vy += (dot1 - dot2) * info.normal.y * 0.9
      }
    }
  }
}
```

注意双重循环——n 个球需要检测 n*(n-1)/2 对。球多了会卡，这就是后面要学空间分区的原因。

### 练习二

```ts
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect()
  mouseX = e.clientX - rect.left
  mouseY = e.clientY - rect.top
})

function draw() {
  ctx.clearRect(0, 0, 600, 400)
  ctx.fillStyle = '#666'
  ctx.fillRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY)

  const closestX = Math.max(box.minX, Math.min(mouseX, box.maxX))
  const closestY = Math.max(box.minY, Math.min(mouseY, box.maxY))

  ctx.strokeStyle = '#f00'
  ctx.beginPath()
  ctx.moveTo(mouseX, mouseY)
  ctx.lineTo(closestX, closestY)
  ctx.stroke()

  ctx.fillStyle = '#f00'
  ctx.beginPath()
  ctx.arc(closestX, closestY, 4, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#4a9eff'
  ctx.beginPath()
  ctx.arc(mouseX, mouseY, 30, 0, Math.PI * 2)
  ctx.stroke()
}
```

这个可视化能帮助你直觉理解"最近点"是怎么算出来的——就是把圆心的坐标 clamp 到矩形的边界范围内。
