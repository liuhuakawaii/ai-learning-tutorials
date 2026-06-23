# 阶段实战：绳索和链条模拟

## 目标

把距离约束、弹簧、铰链和约束求解整合起来，做一个绳索和链条的物理模拟。包括：拖拽绳索、绳索挂载物体、链条断裂、绳索桥。

## 引擎基础

```ts
interface Vec2 { x: number; y: number }

interface Particle {
  position: Vec2
  previousPosition: Vec2
  mass: number
  inverseMass: number
  pinned: boolean
}

interface Link {
  a: number
  b: number
  restLength: number
  broken: boolean
  breakThreshold: number
}
```

用 Verlet 积分做物理更新，距离约束做链接：

```ts
const GRAVITY: Vec2 = { x: 0, y: 600 }
const DT = 1 / 60
const ITERATIONS = 15

function verletStep(p: Particle): void {
  if (p.pinned) return
  const vx = p.position.x - p.previousPosition.x
  const vy = p.position.y - p.previousPosition.y
  p.previousPosition.x = p.position.x
  p.previousPosition.y = p.position.y
  p.position.x += vx * 0.999 + GRAVITY.x * DT * DT
  p.position.y += vy * 0.999 + GRAVITY.y * DT * DT
}

function solveLink(particles: Particle[], link: Link): void {
  if (link.broken) return
  const a = particles[link.a]
  const b = particles[link.b]
  const dx = b.position.x - a.position.x
  const dy = b.position.y - a.position.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return

  if (dist > link.restLength * link.breakThreshold) {
    link.broken = true
    return
  }

  const diff = (dist - link.restLength) / dist
  const totalInvMass = a.inverseMass + b.inverseMass
  if (totalInvMass === 0) return

  const correctionX = dx * diff / totalInvMass
  const correctionY = dy * diff / totalInvMass

  if (!a.pinned) {
    a.position.x += correctionX * a.inverseMass
    a.position.y += correctionY * a.inverseMass
  }
  if (!b.pinned) {
    b.position.x -= correctionX * b.inverseMass
    b.position.y -= correctionY * b.inverseMass
  }
}
```

## 场景一：拖拽绳索

鼠标拖拽绳索上的任意粒子：

```ts
const canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 500
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

const particles: Particle[] = []
const links: Link[] = []

function createRope(
  startX: number, startY: number,
  numSegments: number, segmentLength: number,
  pinStart: boolean,
): { particles: number[], links: number[] } {
  const startIdx = particles.length
  const pIndices: number[] = []
  const lIndices: number[] = []

  for (let i = 0; i <= numSegments; i++) {
    particles.push({
      position: { x: startX + i * segmentLength, y: startY },
      previousPosition: { x: startX + i * segmentLength, y: startY },
      mass: 1,
      inverseMass: (i === 0 && pinStart) ? 0 : 1,
      pinned: i === 0 && pinStart,
    })
    pIndices.push(startIdx + i)
  }

  for (let i = 0; i < numSegments; i++) {
    links.push({
      a: startIdx + i,
      b: startIdx + i + 1,
      restLength: segmentLength,
      broken: false,
      breakThreshold: 3,
    })
    lIndices.push(links.length - 1)
  }

  return { particles: pIndices, links: lIndices }
}

const rope1 = createRope(150, 80, 12, 25, true)
const rope2 = createRope(350, 80, 8, 30, true)

let dragIndex = -1
let dragOffset = { x: 0, y: 0 }

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  let closest = -1
  let closestDist = 30
  for (let i = 0; i < particles.length; i++) {
    const dx = particles[i].position.x - mx
    const dy = particles[i].position.y - my
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < closestDist) {
      closestDist = d
      closest = i
    }
  }
  if (closest >= 0) {
    dragIndex = closest
    dragOffset.x = particles[closest].position.x - mx
    dragOffset.y = particles[closest].position.y - my
  }
})

canvas.addEventListener('mousemove', (e) => {
  if (dragIndex < 0) return
  const rect = canvas.getBoundingClientRect()
  particles[dragIndex].position.x = e.clientX - rect.left + dragOffset.x
  particles[dragIndex].position.y = e.clientY - rect.top + dragOffset.y
})

canvas.addEventListener('mouseup', () => { dragIndex = -1 })

function update() {
  for (const p of particles) verletStep(p)
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const link of links) solveLink(particles, link)
  }
}

function draw() {
  ctx.clearRect(0, 0, 600, 500)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, 600, 500)

  for (const link of links) {
    if (link.broken) continue
    ctx.strokeStyle = '#8b7355'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(particles[link.a].position.x, particles[link.a].position.y)
    ctx.lineTo(particles[link.b].position.x, particles[link.b].position.y)
    ctx.stroke()
  }

  for (const p of particles) {
    ctx.fillStyle = p.pinned ? '#ff0' : '#4a9eff'
    ctx.beginPath()
    ctx.arc(p.position.x, p.position.y, 4, 0, Math.PI * 2)
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

## 场景二：绳索桥

两端固定的绳索，上面可以放重物：

```ts
function createBridge(x1: number, y1: number, x2: number, y2: number, segments: number): void {
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    particles.push({
      position: { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t },
      previousPosition: { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t },
      mass: 1,
      inverseMass: (i === 0 || i === segments) ? 0 : 1,
      pinned: i === 0 || i === segments,
    })
  }

  const startIdx = particles.length - segments - 1
  const dx = (x2 - x1) / segments
  const dy = (y2 - y1) / segments
  const segLength = Math.sqrt(dx * dx + dy * dy)

  for (let i = 0; i < segments; i++) {
    links.push({
      a: startIdx + i,
      b: startIdx + i + 1,
      restLength: segLength,
      broken: false,
      breakThreshold: 2.5,
    })
  }
}
```

## 场景三：断裂链

快速甩动时链条断裂：

```ts
function update() {
  for (const p of particles) verletStep(p)

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const link of links) solveLink(particles, link)
  }

  for (const link of links) {
    if (link.broken) continue
    const a = particles[link.a]
    const b = particles[link.b]
    const dx = b.position.x - a.position.x
    const dy = b.position.y - a.position.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > link.restLength * link.breakThreshold) {
      link.broken = true
    }
  }
}
```

## 高级：布料模拟

把粒子排成网格，水平、垂直和对角线都用约束连接：

```ts
function createCloth(
  startX: number, startY: number,
  cols: number, rows: number,
  spacing: number,
): void {
  const startIdx = particles.length

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      particles.push({
        position: { x: startX + col * spacing, y: startY + row * spacing },
        previousPosition: { x: startX + col * spacing, y: startY + row * spacing },
        mass: 1,
        inverseMass: row === 0 ? 0 : 1,
        pinned: row === 0,
      })
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = startIdx + row * cols + col
      if (col < cols - 1) {
        links.push({ a: idx, b: idx + 1, restLength: spacing, broken: false, breakThreshold: 4 })
      }
      if (row < rows - 1) {
        links.push({ a: idx, b: idx + cols, restLength: spacing, broken: false, breakThreshold: 4 })
      }
      if (col < cols - 1 && row < rows - 1) {
        links.push({ a: idx, b: idx + cols + 1, restLength: spacing * Math.SQRT2, broken: false, breakThreshold: 4 })
      }
    }
  }
}
```

对角线约束防止布料过度剪切变形。没有对角线约束的布料会像果冻一样晃。

## 风力

给布料加风力只需要对每个粒子施加一个力：

```ts
function applyWind(particles: Particle[], wind: Vec2): void {
  for (const p of particles) {
    if (p.pinned) continue
    p.position.x += wind.x * DT * DT
    p.position.y += wind.y * DT * DT
  }
}

// 在 update 中
const wind = { x: Math.sin(Date.now() / 1000) * 200, y: 0 }
applyWind(particles, wind)
```

## 性能优化

布料的粒子数量 = rows × cols，约束数量约为粒子数的 3 倍。100×100 的布料有 10000 个粒子和 30000 条约束，每帧迭代 15 次 = 450000 次约束求解。

优化方法：
- 只对拉伸超过阈值的约束做修正
- 用空间哈希快速找到可能碰撞的粒子对
- 布料自碰撞检测（防止穿模）

## 常见错误

**约束迭代次数不够**。绳索太软，看起来像橡皮筋。增加迭代次数或者减少粒子数量。

**Verlet 的阻尼不对**。速度衰减因子 0.999 是经验值。太小（比如 0.99）绳子会很快停下来，太大（比如 0.9999）几乎没有阻尼。

**布料自碰撞没处理**。布料穿过自身会很奇怪。需要检测并修正粒子之间的碰撞。
