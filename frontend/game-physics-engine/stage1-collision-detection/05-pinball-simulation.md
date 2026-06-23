# 阶段实战：带碰撞检测的弹球模拟

## 目标

把前四节课学的碰撞检测整合到一起，做一个能跑的弹球场景：球在重力下落，碰到各种形状的障碍物会弹跳，玩家可以用发射器弹出新球。

这个项目覆盖 AABB、圆形和多边形碰撞，以及基本的碰撞响应。

## 整体结构

```ts
interface Vec2 { x: number; y: number }

interface Ball {
  pos: Vec2
  vel: Vec2
  radius: number
  restitution: number
}

interface Wall {
  type: 'aabb'
  rect: { minX: number; minY: number; maxX: number; maxY: number }
  restitution: number
}

interface Bumper {
  type: 'circle'
  pos: Vec2
  radius: number
  restitution: number
}

interface Ramp {
  type: 'polygon'
  vertices: Vec2[]
  restitution: number
}

type Obstacle = Wall | Bumper | Ramp
```

把障碍物分成三种类型，对应前几课学的碰撞检测方法。

## 碰撞检测路由

根据类型选择不同的检测函数：

```ts
interface CollisionResult {
  normal: Vec2
  depth: number
}

function detectCollision(ball: Ball, obstacle: Obstacle): CollisionResult | null {
  switch (obstacle.type) {
    case 'aabb':
      return circleAABBCollision(ball, obstacle.rect)
    case 'circle':
      return circleCircleCollision(ball.pos, ball.radius, obstacle.pos, obstacle.radius)
    case 'polygon':
      return circlePolygonCollision(ball, obstacle.vertices)
  }
}
```

### 圆-AABB 碰撞

```ts
function circleAABBCollision(
  ball: Ball,
  rect: { minX: number; minY: number; maxX: number; maxY: number }
): CollisionResult | null {
  const closestX = Math.max(rect.minX, Math.min(ball.pos.x, rect.maxX))
  const closestY = Math.max(rect.minY, Math.min(ball.pos.y, rect.maxY))
  const dx = ball.pos.x - closestX
  const dy = ball.pos.y - closestY
  const distSq = dx * dx + dy * dy

  if (distSq >= ball.radius * ball.radius) return null

  const dist = Math.sqrt(distSq)
  if (dist === 0) return { normal: { x: 0, y: -1 }, depth: ball.radius }
  return { normal: { x: dx / dist, y: dy / dist }, depth: ball.radius - dist }
}
```

### 圆-圆碰撞

```ts
function circleCircleCollision(
  aPos: Vec2, aRadius: number,
  bPos: Vec2, bRadius: number,
): CollisionResult | null {
  const dx = bPos.x - aPos.x
  const dy = bPos.y - aPos.y
  const distSq = dx * dx + dy * dy
  const radiusSum = aRadius + bRadius
  if (distSq >= radiusSum * radiusSum) return null

  const dist = Math.sqrt(distSq)
  if (dist === 0) return { normal: { x: 1, y: 0 }, depth: radiusSum }
  return {
    normal: { x: dx / dist, y: dy / dist },
    depth: radiusSum - dist,
  }
}
```

### 圆-多边形碰撞

用 SAT 的思路，但只检测多边形的边法线和圆心到最近顶点这条轴：

```ts
function circlePolygonCollision(ball: Ball, vertices: Vec2[]): CollisionResult | null {
  let minDepth = Infinity
  let bestNormal: Vec2 = { x: 0, y: 0 }

  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length
    const edgeX = vertices[j].x - vertices[i].x
    const edgeY = vertices[j].y - vertices[i].y
    const len = Math.sqrt(edgeX * edgeX + edgeY * edgeY)
    const axis = { x: -edgeY / len, y: edgeX / len }

    const projCenter = ball.pos.x * axis.x + ball.pos.y * axis.y
    const projRadius = ball.radius

    let minV = Infinity, maxV = -Infinity
    for (const v of vertices) {
      const p = v.x * axis.x + v.y * axis.y
      if (p < minV) minV = p
      if (p > maxV) maxV = p
    }

    const overlap = Math.min(projCenter + projRadius - minV, maxV - (projCenter - projRadius))
    if (overlap <= 0) return null

    if (overlap < minDepth) {
      minDepth = overlap
      bestNormal = axis
    }
  }

  const polyCenter = vertices.reduce(
    (c, v) => ({ x: c.x + v.x, y: c.y + v.y }),
    { x: 0, y: 0 },
  )
  polyCenter.x /= vertices.length
  polyCenter.y /= vertices.length

  const d = { x: ball.pos.x - polyCenter.x, y: ball.pos.y - polyCenter.y }
  if (d.x * bestNormal.x + d.y * bestNormal.y < 0) {
    bestNormal = { x: -bestNormal.x, y: -bestNormal.y }
  }

  return { normal: bestNormal, depth: minDepth }
}
```

## 碰撞响应

位置修正 + 速度反射：

```ts
function resolveBallCollision(ball: Ball, result: CollisionResult, restitution: number): void {
  ball.pos.x += result.normal.x * result.depth
  ball.pos.y += result.normal.y * result.depth

  const vn = ball.vel.x * result.normal.x + ball.vel.y * result.normal.y
  if (vn < 0) {
    ball.vel.x -= (1 + restitution) * vn * result.normal.x
    ball.vel.y -= (1 + restitution) * vn * result.normal.y
  }
}
```

`restitution` 是恢复系数。0 表示完全不弹，1 表示完全弹回。弹球游戏中 bumper 的恢复系数设高一些会更有趣。

## 构建场景

```ts
const canvas = document.createElement('canvas')
canvas.width = 400
canvas.height = 700
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

const GRAVITY = 0.3
const FRICTION = 0.999

const balls: Ball[] = []
const obstacles: Obstacle[] = [
  { type: 'aabb', rect: { minX: 0, minY: 680, maxX: 400, maxY: 700 }, restitution: 0.3 },
  { type: 'aabb', rect: { minX: 0, minY: 0, maxX: 10, maxY: 700 }, restitution: 0.5 },
  { type: 'aabb', rect: { minX: 390, minY: 0, maxX: 400, maxY: 700 }, restitution: 0.5 },
  { type: 'circle', pos: { x: 200, y: 300 }, radius: 30, restitution: 1.2 },
  { type: 'circle', pos: { x: 120, y: 400 }, radius: 25, restitution: 1.2 },
  { type: 'circle', pos: { x: 280, y: 400 }, radius: 25, restitution: 1.2 },
  { type: 'circle', pos: { x: 200, y: 500 }, radius: 20, restitution: 1.0 },
  { type: 'polygon', vertices: [
    { x: 50, y: 200 }, { x: 100, y: 250 }, { x: 50, y: 300 },
  ], restitution: 0.5 },
  { type: 'polygon', vertices: [
    { x: 350, y: 200 }, { x: 300, y: 250 }, { x: 350, y: 300 },
  ], restitution: 0.5 },
]
```

场景里有墙壁（AABB）、弹射器（圆形，恢复系数 > 1 会加速球）、斜坡（多边形）。

## 发射和主循环

```ts
function launchBall() {
  balls.push({
    pos: { x: 200, y: 50 },
    vel: { x: (Math.random() - 0.5) * 4, y: 2 },
    radius: 10,
    restitution: 0.6,
  })
}

canvas.addEventListener('click', launchBall)

function update() {
  for (const ball of balls) {
    ball.vel.y += GRAVITY
    ball.vel.x *= FRICTION
    ball.vel.y *= FRICTION
    ball.pos.x += ball.vel.x
    ball.pos.y += ball.vel.y

    for (const obstacle of obstacles) {
      const result = detectCollision(ball, obstacle)
      if (result) {
        resolveBallCollision(ball, result, obstacle.restitution)
      }
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, 400, 700)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, 400, 700)

  for (const obs of obstacles) {
    switch (obs.type) {
      case 'aabb':
        ctx.fillStyle = '#444'
        ctx.fillRect(obs.rect.minX, obs.rect.minY, obs.rect.maxX - obs.rect.minX, obs.rect.maxY - obs.rect.minY)
        break
      case 'circle':
        ctx.fillStyle = obs.restitution > 1 ? '#ff6b6b' : '#4ecdc4'
        ctx.beginPath()
        ctx.arc(obs.pos.x, obs.pos.y, obs.radius, 0, Math.PI * 2)
        ctx.fill()
        break
      case 'polygon':
        ctx.fillStyle = '#45b7d1'
        ctx.beginPath()
        ctx.moveTo(obs.vertices[0].x, obs.vertices[0].y)
        for (let i = 1; i < obs.vertices.length; i++) {
          ctx.lineTo(obs.vertices[i].x, obs.vertices[i].y)
        }
        ctx.closePath()
        ctx.fill()
        break
    }
  }

  for (const ball of balls) {
    ctx.fillStyle = '#ffd93d'
    ctx.beginPath()
    ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

function loop() {
  update()
  draw()
  requestAnimationFrame(loop)
}
loop()
```

点击画布发射球。球碰到红色 bumper 会被加速（恢复系数 > 1），碰到斜坡会滑下来。

## 让它更像弹球

几个改进点：

**Flipper（弹射板）**：在底部加两个可以旋转的挡板，按左右键弹起。这需要多边形碰撞 + 旋转动力学，后面的课会覆盖。

**计分**：bumper 上加分，画在 Canvas 上。

**球数限制**：加 5 条命，球掉出底部扣一条命。

**粒子效果**：碰撞时产生小粒子。这不需要物理引擎，简单的粒子系统就行。

## 这个项目的局限

碰撞响应用的是最简单的位置修正 + 速度反射。球多了会穿透，堆叠会抖动。后面的刚体动力学课会用冲量法替代。

没有空间分区，所有障碍物每帧都检测。障碍物多了会卡。第四阶段会优化。

## 常见错误

**球穿墙**。速度太快时，一帧之内球从墙的一侧移到了另一侧，碰撞检测就失效了。后面会讲 CCD（连续碰撞检测）来解决这个问题。

**恢复系数设太高**。大于 1 的恢复系数会让球越弹越快，最终飞出场景。需要加速度上限：

```ts
const MAX_SPEED = 15
const speed = Math.sqrt(ball.vel.x * ball.vel.x + ball.vel.y * ball.vel.y)
if (speed > MAX_SPEED) {
  ball.vel.x = (ball.vel.x / speed) * MAX_SPEED
  ball.vel.y = (ball.vel.y / speed) * MAX_SPEED
}
```

**帧率不稳定导致物理行为不一致**。用 `requestAnimationFrame` 的 delta time 来固定物理步长，或者用固定时间步。
