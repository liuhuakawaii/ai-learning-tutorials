# 阶段实战：优化物理引擎的碰撞检测性能

## 目标

把前三阶段的物理引擎加上空间分区，做一个性能对比。创建一个有 500+ 物体的场景，分别用暴力检测、均匀网格、四叉树和 BVH，对比帧率和碰撞检测次数。

## 基准场景

```ts
const canvas = document.createElement('canvas')
canvas.width = 800
canvas.height = 600
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

interface Vec2 { x: number; y: number }
interface AABB { minX: number; minY: number; maxX: number; maxY: number }

interface Body {
  position: Vec2
  velocity: Vec2
  radius: number
  aabb: AABB
  isStatic: boolean
}

const GRAVITY: Vec2 = { x: 0, y: 200 }
const DT = 1 / 60
const NUM_BODIES = 600

function createBody(x: number, y: number, vx: number, vy: number, radius: number, isStatic = false): Body {
  return {
    position: { x, y },
    velocity: { x: vx, y: vy },
    radius,
    aabb: { minX: x - radius, minY: y - radius, maxX: x + radius, maxY: y + radius },
    isStatic,
  }
}

const bodies: Body[] = []

// 地面
bodies.push(createBody(400, 590, 0, 0, 0, true))
bodies[bodies.length - 1].aabb = { minX: 0, minY: 580, maxX: 800, maxY: 600 }

// 墙壁
bodies.push(createBody(5, 300, 0, 0, 0, true))
bodies[bodies.length - 1].aabb = { minX: 0, minY: 0, maxX: 10, maxY: 600 }
bodies.push(createBody(795, 300, 0, 0, 0, true))
bodies[bodies.length - 1].aabb = { minX: 790, minY: 0, maxX: 800, maxY: 600 }

// 动态物体
for (let i = 0; i < NUM_BODIES; i++) {
  const r = 3 + Math.random() * 5
  bodies.push(createBody(
    Math.random() * 700 + 50,
    Math.random() * 500 + 50,
    (Math.random() - 0.5) * 3,
    (Math.random() - 0.5) * 3,
    r,
  ))
}

function updateAABB(body: Body): void {
  if (body.isStatic && body.radius === 0) return
  body.aabb.minX = body.position.x - body.radius
  body.aabb.minY = body.position.y - body.radius
  body.aabb.maxX = body.position.x + body.radius
  body.aabb.maxY = body.position.y + body.radius
}
```

## 暴力检测

```ts
function bruteForce(bodies: Body[]): [number, number][] {
  const pairs: [number, number][] = []
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      if (aabbOverlap(bodies[i].aabb, bodies[j].aabb)) {
        pairs.push([i, j])
      }
    }
  }
  return pairs
}
```

## 均匀网格

```ts
class UniformGrid {
  cellSize: number
  cols: number
  rows: number
  cells: number[][]

  constructor(width: number, height: number, cellSize: number) {
    this.cellSize = cellSize
    this.cols = Math.ceil(width / cellSize)
    this.rows = Math.ceil(height / cellSize)
    this.cells = Array.from({ length: this.cols * this.rows }, () => [])
  }

  clear(): void {
    for (const cell of this.cells) cell.length = 0
  }

  insert(id: number, aabb: AABB): void {
    const minCol = Math.max(0, Math.floor(aabb.minX / this.cellSize))
    const maxCol = Math.min(this.cols - 1, Math.floor(aabb.maxX / this.cellSize))
    const minRow = Math.max(0, Math.floor(aabb.minY / this.cellSize))
    const maxRow = Math.min(this.rows - 1, Math.floor(aabb.maxY / this.cellSize))
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        this.cells[r * this.cols + c].push(id)
      }
    }
  }

  queryPairs(): [number, number][] {
    const pairSet = new Set<string>()
    const pairs: [number, number][] = []
    for (const cell of this.cells) {
      for (let i = 0; i < cell.length; i++) {
        for (let j = i + 1; j < cell.length; j++) {
          const a = Math.min(cell[i], cell[j])
          const b = Math.max(cell[i], cell[j])
          const key = `${a}-${b}`
          if (!pairSet.has(key)) {
            pairSet.add(key)
            pairs.push([a, b])
          }
        }
      }
    }
    return pairs
  }
}
```

## 性能测试框架

```ts
interface BenchmarkResult {
  name: string
  broadPhaseTime: number
  narrowPhaseTime: number
  pairCount: number
  checksCount: number
}

function runBenchmark(
  name: string,
  broadPhaseFn: () => [number, number][],
  iterations: number,
): BenchmarkResult {
  let totalTime = 0
  let totalPairs = 0

  for (let i = 0; i < iterations; i++) {
    for (const body of bodies) updateAABB(body)

    const start = performance.now()
    const pairs = broadPhaseFn()
    totalTime += performance.now() - start
    totalPairs += pairs.length
  }

  return {
    name,
    broadPhaseTime: totalTime / iterations,
    narrowPhaseTime: 0,
    pairCount: Math.round(totalPairs / iterations),
    checksCount: 0,
  }
}
```

## 完整的物理步

```ts
function physicsStep(broadPhaseFn: () => [number, number][]): number {
  for (const body of bodies) {
    if (body.isStatic) continue
    body.velocity.x += GRAVITY.x * DT
    body.velocity.y += GRAVITY.y * DT
    body.position.x += body.velocity.x * DT
    body.position.y += body.velocity.y * DT
    updateAABB(body)
  }

  const start = performance.now()
  const pairs = broadPhaseFn()
  const broadTime = performance.now() - start

  const narrowStart = performance.now()
  let collisions = 0
  for (const [i, j] of pairs) {
    const a = bodies[i]
    const b = bodies[j]
    const dx = b.position.x - a.position.x
    const dy = b.position.y - a.position.y
    const distSq = dx * dx + dy * dy
    const rSum = a.radius + b.radius
    if (distSq < rSum * rSum && distSq > 0) {
      collisions++
      const dist = Math.sqrt(distSq)
      const nx = dx / dist, ny = dy / dist
      const overlap = rSum - dist
      if (!a.isStatic && !b.isStatic) {
        a.position.x -= nx * overlap / 2
        a.position.y -= ny * overlap / 2
        b.position.x += nx * overlap / 2
        b.position.y += ny * overlap / 2
      } else if (a.isStatic) {
        b.position.x += nx * overlap
        b.position.y += ny * overlap
      } else {
        a.position.x -= nx * overlap
        a.position.y -= ny * overlap
      }
      const relV = (a.velocity.x - b.velocity.x) * nx + (a.velocity.y - b.velocity.y) * ny
      if (!a.isStatic) { a.velocity.x -= relV * nx * 0.5; a.velocity.y -= relV * ny * 0.5 }
      if (!b.isStatic) { b.velocity.x += relV * nx * 0.5; b.velocity.y += relV * ny * 0.5 }
    }
  }
  const narrowTime = performance.now() - narrowStart

  return broadTime + narrowTime
}
```

## 结果可视化

```ts
const results: BenchmarkResult[] = []
let currentMethod = 0
const methods = [
  { name: 'Brute Force', fn: () => bruteForce(bodies) },
  { name: 'Uniform Grid', fn: () => { const g = new UniformGrid(800, 600, 25); for (let i = 0; i < bodies.length; i++) g.insert(i, bodies[i].aabb); return g.queryPairs() } },
]

let frameCount = 0
let totalTime = 0
let totalCollisions = 0

function loop() {
  const time = physicsStep(methods[currentMethod].fn)
  totalTime += time
  frameCount++

  ctx.clearRect(0, 0, 800, 600)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, 800, 600)

  for (const body of bodies) {
    if (body.isStatic) {
      ctx.fillStyle = '#444'
      ctx.fillRect(body.aabb.minX, body.aabb.minY, body.aabb.maxX - body.aabb.minX, body.aabb.maxY - body.aabb.minY)
    } else {
      ctx.fillStyle = '#4a9eff'
      ctx.beginPath()
      ctx.arc(body.position.x, body.position.y, body.radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.fillStyle = '#fff'
  ctx.font = '14px monospace'
  ctx.fillText(`Method: ${methods[currentMethod].name}`, 10, 20)
  ctx.fillText(`Bodies: ${bodies.length}`, 10, 40)
  ctx.fillText(`Avg time: ${(totalTime / frameCount).toFixed(2)}ms`, 10, 60)
  ctx.fillText(`FPS: ${Math.round(1000 / (totalTime / frameCount))}`, 10, 80)

  requestAnimationFrame(loop)
}
loop()
```

## 优化策略汇总

### Broad Phase 选择

- 物体少（< 100）：暴力检测最快，没有额外开销
- 物体中等（100-1000）：均匀网格或空间哈希
- 物体多（> 1000）：BVH 或 SAP
- 物体大小差异大：BVH
- 物体运动慢：SAP

### Narrow Phase 优化

先用 AABB 快速排除，再做圆形/多边形精确检测：

```ts
function optimizedNarrowPhase(a: Body, b: Body): boolean {
  if (!aabbOverlap(a.aabb, b.aabb)) return false
  const dx = b.position.x - a.position.x
  const dy = b.position.y - a.position.y
  return dx * dx + dy * dy < (a.radius + b.radius) ** 2
}
```

### 碰撞对缓存

上一帧的碰撞对在这一帧很可能还是碰撞的。先检测上一帧的碰撞对：

```ts
let cachedPairs: [number, number][] = []

function optimizedBroadPhase(): [number, number][] {
  const stillActive: [number, number][] = []
  for (const [i, j] of cachedPairs) {
    if (aabbOverlap(bodies[i].aabb, bodies[j].aabb)) {
      stillActive.push([i, j])
    }
  }

  const newPairs = grid.queryPairs()
  const pairSet = new Set(stillActive.map(([i, j]) => `${i}-${j}`))
  for (const pair of newPairs) {
    const key = `${Math.min(pair[0], pair[1])}-${Math.max(pair[0], pair[1])}`
    if (!pairSet.has(key)) {
      stillActive.push(pair)
      pairSet.add(key)
    }
  }

  cachedPairs = stillActive
  return stillActive
}
```

## 常见错误

**Broad Phase 和 Narrow Phase 混在一起**。Broad Phase 只用 AABB 做粗筛，Narrow Phase 才做精确检测。把精确检测放在 Broad Phase 里会严重降低性能。

**格子大小没有调优**。不同的场景需要不同的格子大小。可以在初始化时根据物体平均大小自动计算。

**没有 profile 就优化**。先用性能测试找出瓶颈。可能碰撞检测不是瓶颈，而是渲染。

## 练习

### 练习一：混合策略

实现一个自动选择策略的方法：根据物体数量和分布自动选择暴力、网格或 BVH。

### 练习二：缓存命中率

统计碰撞对缓存的命中率。物体运动越慢，命中率越高。画出命中率随物体速度的变化曲线。

---

## 参考答案

### 练习一

```ts
function autoSelectStrategy(bodies: Body[]): () => [number, number][] {
  const n = bodies.length
  if (n < 100) return () => bruteForce(bodies)

  let totalRadius = 0
  for (const b of bodies) totalRadius += b.radius
  const avgRadius = totalRadius / n
  const cellSize = avgRadius * 3

  const grid = new UniformGrid(800, 600, cellSize)
  return () => {
    grid.clear()
    for (let i = 0; i < bodies.length; i++) grid.insert(i, bodies[i].aabb)
    return grid.queryPairs()
  }
}
```

### 练习二

```ts
let cacheHits = 0
let cacheMisses = 0

// 在 optimizedBroadPhase 中
for (const [i, j] of cachedPairs) {
  if (aabbOverlap(bodies[i].aabb, bodies[j].aabb)) {
    cacheHits++
    stillActive.push([i, j])
  } else {
    cacheMisses++
  }
}

console.log(`Hit rate: ${(cacheHits / (cacheHits + cacheMisses) * 100).toFixed(1)}%`)
```
