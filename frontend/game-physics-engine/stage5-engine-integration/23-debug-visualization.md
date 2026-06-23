# 可视化调试——碰撞体绘制、力向量可视化、碰撞点标注

## 为什么需要可视化调试

物理引擎的 bug 通常"看不见"。物体穿透了你看不出来，碰撞法线方向错了你看不出来，力的大小不对你也看不出来。

可视化调试是物理引擎开发中最重要的工具。把内部状态画出来，问题一目了然。

## 碰撞体绘制

最基本的调试功能：画出每个物体的碰撞形状。

```ts
function drawCollisionShape(
  ctx: CanvasRenderingContext2D,
  body: RigidBody,
  color: string = '#00ff00',
  lineWidth: number = 1,
): void {
  ctx.save()
  ctx.translate(body.position.x, body.position.y)
  ctx.rotate(body.angle)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth

  if (body.shape.type === 'circle') {
    const circle = body.shape as CircleShape
    ctx.beginPath()
    ctx.arc(0, 0, circle.radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(circle.radius, 0)
    ctx.stroke()
  } else if (body.shape.type === 'polygon') {
    const poly = body.shape as PolygonShape
    ctx.beginPath()
    ctx.moveTo(poly.vertices[0].x, poly.vertices[0].y)
    for (let i = 1; i < poly.vertices.length; i++) {
      ctx.lineTo(poly.vertices[i].x, poly.vertices[i].y)
    }
    ctx.closePath()
    ctx.stroke()
  }

  ctx.restore()
}
```

旋转指示线让你能看到物体的朝向。

## AABB 绘制

```ts
function drawAABB(ctx: CanvasRenderingContext2D, aabb: AABB, color: string = '#ffff0044'): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.strokeRect(aabb.minX, aabb.minY, aabb.maxX - aabb.minX, aabb.maxY - aabb.minY)
}
```

AABB 用半透明颜色画。重叠区域颜色会变深，一眼就能看出哪些物体的包围盒重叠。

## 力向量可视化

画出作用在物体上的力：

```ts
function drawForceVector(
  ctx: CanvasRenderingContext2D,
  body: RigidBody,
  force: Vec2,
  scale: number = 0.1,
  color: string = '#ff0000',
): void {
  const len = v2Len(force) * scale
  if (len < 1) return

  const dir = v2Norm(force)
  const endX = body.position.x + dir.x * len
  const endY = body.position.y + dir.y * len

  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(body.position.x, body.position.y)
  ctx.lineTo(endX, endY)
  ctx.stroke()

  const headLen = 8
  const headAngle = Math.atan2(dir.y, dir.x)
  ctx.beginPath()
  ctx.moveTo(endX, endY)
  ctx.lineTo(
    endX - headLen * Math.cos(headAngle - 0.4),
    endY - headLen * Math.sin(headAngle - 0.4),
  )
  ctx.moveTo(endX, endY)
  ctx.lineTo(
    endX - headLen * Math.cos(headAngle + 0.4),
    endY - headLen * Math.sin(headAngle + 0.4),
  )
  ctx.stroke()
}
```

## 速度向量

```ts
function drawVelocityVector(
  ctx: CanvasRenderingContext2D,
  body: RigidBody,
  scale: number = 5,
  color: string = '#00aaff',
): void {
  drawForceVector(ctx, body, body.velocity, scale, color)
}
```

## 碰撞点和法线

```ts
function drawContactPoint(
  ctx: CanvasRenderingContext2D,
  contact: { point: Vec2; normal: Vec2; penetration: number },
): void {
  ctx.fillStyle = '#ff0000'
  ctx.beginPath()
  ctx.arc(contact.point.x, contact.point.y, 4, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#ffff00'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(contact.point.x, contact.point.y)
  ctx.lineTo(
    contact.point.x + contact.normal.x * 20,
    contact.point.y + contact.normal.y * 20,
  )
  ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.font = '10px monospace'
  ctx.fillText(
    contact.penetration.toFixed(2),
    contact.point.x + 5,
    contact.point.y - 5,
  )
}
```

红色圆点标记碰撞位置，黄色箭头标记法线方向，数字标记穿透深度。

## 空间分区可视化

```ts
function drawGrid(ctx: CanvasRenderingContext2D, grid: UniformGrid): void {
  ctx.strokeStyle = '#ffffff11'
  ctx.lineWidth = 0.5

  for (let c = 0; c < grid.cols; c++) {
    ctx.beginPath()
    ctx.moveTo(c * grid.cellSize, 0)
    ctx.lineTo(c * grid.cellSize, grid.rows * grid.cellSize)
    ctx.stroke()
  }
  for (let r = 0; r < grid.rows; r++) {
    ctx.beginPath()
    ctx.moveTo(0, r * grid.cellSize)
    ctx.lineTo(grid.cols * grid.cellSize, r * grid.cellSize)
    ctx.stroke()
  }

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cells[r * grid.cols + c]
      if (cell.bodies.length > 0) {
        ctx.fillStyle = `rgba(0,255,0,${Math.min(cell.bodies.length * 0.05, 0.3)})`
        ctx.fillRect(c * grid.cellSize, r * grid.cellSize, grid.cellSize, grid.cellSize)
      }
    }
  }
}
```

格子里物体越多，颜色越深。一眼看出哪里最密集。

## 调试面板

```ts
class DebugPanel {
  bodyCount = 0
  constraintCount = 0
  collisionPairs = 0
  broadPhaseTime = 0
  narrowPhaseTime = 0
  fps = 0
  private frameTimes: number[] = []

  update(dt: number): void {
    this.frameTimes.push(dt)
    if (this.frameTimes.length > 60) this.frameTimes.shift()
    this.fps = Math.round(1000 / (this.frameTimes.reduce((a, b) => a + b) / this.frameTimes.length))
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000000aa'
    ctx.fillRect(5, 5, 220, 140)
    ctx.fillStyle = '#fff'
    ctx.font = '12px monospace'
    const lines = [
      `FPS: ${this.fps}`,
      `Bodies: ${this.bodyCount}`,
      `Constraints: ${this.constraintCount}`,
      `Collision pairs: ${this.collisionPairs}`,
      `Broad phase: ${this.broadPhaseTime.toFixed(2)}ms`,
      `Narrow phase: ${this.narrowPhaseTime.toFixed(2)}ms`,
    ]
    lines.forEach((line, i) => ctx.fillText(line, 10, 20 + i * 18))
  }
}
```

## 完整示例：带调试覆盖的物理场景

```ts
const canvas = document.createElement('canvas')
canvas.width = 800
canvas.height = 600
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

const world = new World(vec2(0, 500))
const debug = new DebugPanel()
let showDebug = true
let showColliders = true
let showVelocities = true
let showAABBs = false

window.addEventListener('keydown', (e) => {
  if (e.key === 'd') showDebug = !showDebug
  if (e.key === 'c') showColliders = !showColliders
  if (e.key === 'v') showVelocities = !showVelocities
  if (e.key === 'a') showAABBs = !showAABBs
})

const ground = new RigidBody(
  new PolygonShape([
    { x: -400, y: -15 }, { x: 400, y: -15 },
    { x: 400, y: 15 }, { x: -400, y: 15 },
  ]),
  400, 580, 1, true,
)
world.addBody(ground)

for (let i = 0; i < 15; i++) {
  world.addBody(new RigidBody(
    new CircleShape(10 + Math.random() * 15),
    Math.random() * 600 + 100,
    Math.random() * 300 + 50,
    1,
  ))
}

const contacts: { point: Vec2; normal: Vec2; penetration: number }[] = []
let lastTime = performance.now()

function loop(): void {
  const now = performance.now()
  const dt = now - lastTime
  lastTime = now
  debug.update(dt)

  contacts.length = 0
  const broadStart = performance.now()
  world.step(1 / 60)
  debug.broadPhaseTime = performance.now() - broadStart

  debug.bodyCount = world.bodies.length
  debug.constraintCount = world.constraints.length

  ctx.clearRect(0, 0, 800, 600)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, 800, 600)

  for (const body of world.bodies) {
    if (showAABBs) {
      drawAABB(ctx, body.shape.computeAABB())
    }
    if (showColliders) {
      drawCollisionShape(ctx, body, body.isStatic ? '#888' : '#00ff00')
    }
    if (showVelocities && !body.isStatic) {
      drawVelocityVector(ctx, body, 3)
    }
  }

  for (const contact of contacts) {
    drawContactPoint(ctx, contact)
  }

  if (showDebug) {
    debug.draw(ctx)
  }

  ctx.fillStyle = '#888'
  ctx.font = '12px monospace'
  ctx.fillText('D:debug  C:colliders  V:velocities  A:AABBs', 10, 590)

  requestAnimationFrame(loop)
}
loop()
```

快捷键切换不同的调试视图。开发时全开，发布时全关。

## 常见错误

**调试渲染和游戏渲染混在一起**。调试渲染应该是覆盖层，在游戏渲染之后画。这样关掉调试不影响游戏画面。

**调试信息太多**。500 个物体都画力向量和 AABB 会非常乱。可以只对选中的物体画详细信息。

**性能影响**。调试渲染本身有开销。大量 `strokeRect` 和 `fillText` 会拖慢帧率。发布版本必须关掉。

## 练习

### 练习一：物体选择

鼠标点击选择一个物体。选中后显示它的 AABB、速度向量、角速度和质量。

### 练习二：碰撞热力图

记录每个物体参与碰撞的次数。用颜色编码显示——碰撞越多越红。

---

## 参考答案

### 练习一

```ts
let selected: RigidBody | null = null

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  selected = null
  for (const body of world.bodies) {
    if (body.isStatic) continue
    const dx = mx - body.position.x
    const dy = my - body.position.y
    if (body.shape.type === 'circle') {
      if (dx * dx + dy * dy < (body.shape as CircleShape).radius ** 2) {
        selected = body
      }
    }
  }
})

// 在渲染循环中
if (selected) {
  drawCollisionShape(ctx, selected, '#ff0', 2)
  drawAABB(ctx, selected.shape.computeAABB(), '#ffff0066')
  drawVelocityVector(ctx, selected, 10, '#0ff')
  ctx.fillStyle = '#fff'
  ctx.font = '12px monospace'
  ctx.fillText(`Mass: ${selected.mass.toFixed(2)}`, selected.position.x + 30, selected.position.y - 30)
  ctx.fillText(`ω: ${selected.angularVelocity.toFixed(2)}`, selected.position.x + 30, selected.position.y - 15)
}
```

### 练习二

```ts
const collisionCounts = new Map<RigidBody, number>()

// 在碰撞检测中
for (const [i, j] of pairs) {
  // ... 碰撞检测
  if (collision) {
    collisionCounts.set(world.bodies[i], (collisionCounts.get(world.bodies[i]) ?? 0) + 1)
    collisionCounts.set(world.bodies[j], (collisionCounts.get(world.bodies[j]) ?? 0) + 1)
  }
}

// 渲染时
for (const body of world.bodies) {
  const count = collisionCounts.get(body) ?? 0
  const intensity = Math.min(count / 10, 1)
  drawCollisionShape(ctx, body, `rgb(${Math.round(intensity * 255)}, ${Math.round((1 - intensity) * 255)}, 0)`)
}
```
