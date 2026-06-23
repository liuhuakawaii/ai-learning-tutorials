# 网格分区——均匀网格、空间哈希

## 为什么需要空间分区

前面所有的碰撞检测都是"每对都检测"。n 个物体需要检测 n*(n-1)/2 对。100 个物体就是 4950 次检测。

但大多数物体离得很远，根本不可能碰撞。空间分区的思路是：只检测可能碰撞的物体对，跳过那些距离远的。

## 均匀网格

把空间划分成大小相同的格子。每个物体放到它所在的格子里。碰撞检测只需要在同一格子（和相邻格子）里的物体之间进行。

```ts
interface Vec2 { x: number; y: number }

interface AABB {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface GridCell {
  bodies: number[]
}

class UniformGrid {
  cellSize: number
  cols: number
  rows: number
  cells: GridCell[]

  constructor(width: number, height: number, cellSize: number) {
    this.cellSize = cellSize
    this.cols = Math.ceil(width / cellSize)
    this.rows = Math.ceil(height / cellSize)
    this.cells = Array.from({ length: this.cols * this.rows }, () => ({ bodies: [] }))
  }

  clear(): void {
    for (const cell of this.cells) cell.bodies.length = 0
  }

  insert(id: number, aabb: AABB): void {
    const minCol = Math.max(0, Math.floor(aabb.minX / this.cellSize))
    const maxCol = Math.min(this.cols - 1, Math.floor(aabb.maxX / this.cellSize))
    const minRow = Math.max(0, Math.floor(aabb.minY / this.cellSize))
    const maxRow = Math.min(this.rows - 1, Math.floor(aabb.maxY / this.cellSize))

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        this.cells[row * this.cols + col].bodies.push(id)
      }
    }
  }

  query(aabb: AABB): Set<number> {
    const result = new Set<number>()
    const minCol = Math.max(0, Math.floor(aabb.minX / this.cellSize))
    const maxCol = Math.min(this.cols - 1, Math.floor(aabb.maxX / this.cellSize))
    const minRow = Math.max(0, Math.floor(aabb.minY / this.cellSize))
    const maxRow = Math.min(this.rows - 1, Math.floor(aabb.maxY / this.cellSize))

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        for (const id of this.cells[row * this.cols + col].bodies) {
          result.add(id)
        }
      }
    }
    return result
  }
}
```

## 使用网格做碰撞检测

```ts
function broadPhase(
  bodies: { aabb: AABB }[],
  grid: UniformGrid,
): [number, number][] {
  grid.clear()
  for (let i = 0; i < bodies.length; i++) {
    grid.insert(i, bodies[i].aabb)
  }

  const pairs = new Set<string>()
  const result: [number, number][] = []

  for (let i = 0; i < bodies.length; i++) {
    const nearby = grid.query(bodies[i].aabb)
    for (const j of nearby) {
      if (i >= j) continue
      const key = `${i}-${j}`
      if (pairs.has(key)) continue
      pairs.add(key)
      result.push([i, j])
    }
  }

  return result
}
```

`pairs` 集合避免重复检测同一对。一个物体可能在多个格子里，它的邻居也可能在多个格子里。

## 格子大小的选择

格子太小：一个物体跨越很多格子，插入和查询都慢。
格子太大：每个格子里物体太多，退化成暴力检测。

经验法则：格子大小设为最大物体尺寸的 2-3 倍。

```ts
function optimalCellSize(bodies: { aabb: AABB }[]): number {
  let maxSize = 0
  for (const body of bodies) {
    const w = body.aabb.maxX - body.aabb.minX
    const h = body.aabb.maxY - body.aabb.minY
    maxSize = Math.max(maxSize, w, h)
  }
  return maxSize * 2.5
}
```

## 空间哈希

均匀网格需要知道场景大小。空间哈希不需要——它用哈希函数把任意坐标映射到固定大小的桶里。

```ts
class SpatialHash {
  cellSize: number
  buckets: Map<string, number[]>

  constructor(cellSize: number) {
    this.cellSize = cellSize
    this.buckets = new Map()
  }

  clear(): void {
    this.buckets.clear()
  }

  private hash(col: number, row: number): string {
    return `${col},${row}`
  }

  insert(id: number, aabb: AABB): void {
    const minCol = Math.floor(aabb.minX / this.cellSize)
    const maxCol = Math.floor(aabb.maxX / this.cellSize)
    const minRow = Math.floor(aabb.minY / this.cellSize)
    const maxRow = Math.floor(aabb.maxY / this.cellSize)

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const key = this.hash(col, row)
        let bucket = this.buckets.get(key)
        if (!bucket) {
          bucket = []
          this.buckets.set(key, bucket)
        }
        bucket.push(id)
      }
    }
  }

  query(aabb: AABB): Set<number> {
    const result = new Set<number>()
    const minCol = Math.floor(aabb.minX / this.cellSize)
    const maxCol = Math.floor(aabb.maxX / this.cellSize)
    const minRow = Math.floor(aabb.minY / this.cellSize)
    const maxRow = Math.floor(aabb.maxY / this.cellSize)

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const bucket = this.buckets.get(this.hash(col, row))
        if (bucket) {
          for (const id of bucket) result.add(id)
        }
      }
    }
    return result
  }
}
```

空间哈希的优势是不需要预分配内存。物体分布稀疏时只占用实际有物体的桶。

## 完整示例：大量弹跳球

```ts
const canvas = document.createElement('canvas')
canvas.width = 800
canvas.height = 600
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  aabb: AABB
}

const NUM_BALLS = 300
const balls: Ball[] = []

for (let i = 0; i < NUM_BALLS; i++) {
  const radius = 5 + Math.random() * 8
  balls.push({
    x: Math.random() * 700 + 50,
    y: Math.random() * 500 + 50,
    vx: (Math.random() - 0.5) * 4,
    vy: (Math.random() - 0.5) * 4,
    radius,
    aabb: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  })
}

const grid = new UniformGrid(800, 600, 40)
let collisionChecks = 0

function updateAABB(ball: Ball): void {
  ball.aabb.minX = ball.x - ball.radius
  ball.aabb.minY = ball.y - ball.radius
  ball.aabb.maxX = ball.x + ball.radius
  ball.aabb.maxY = ball.y + ball.radius
}

function update() {
  for (const ball of balls) {
    ball.vy += 0.2
    ball.x += ball.vx
    ball.y += ball.vy

    if (ball.x < ball.radius) { ball.x = ball.radius; ball.vx *= -0.8 }
    if (ball.x > 800 - ball.radius) { ball.x = 800 - ball.radius; ball.vx *= -0.8 }
    if (ball.y < ball.radius) { ball.y = ball.radius; ball.vy *= -0.8 }
    if (ball.y > 600 - ball.radius) { ball.y = 600 - ball.radius; ball.vy *= -0.8 }

    updateAABB(ball)
  }

  collisionChecks = 0
  grid.clear()
  for (let i = 0; i < balls.length; i++) {
    grid.insert(i, balls[i].aabb)
  }

  for (let i = 0; i < balls.length; i++) {
    const nearby = grid.query(balls[i].aabb)
    for (const j of nearby) {
      if (i >= j) continue
      collisionChecks++
      const a = balls[i]
      const b = balls[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const distSq = dx * dx + dy * dy
      const radiusSum = a.radius + b.radius
      if (distSq < radiusSum * radiusSum && distSq > 0) {
        const dist = Math.sqrt(distSq)
        const nx = dx / dist
        const ny = dy / dist
        const overlap = radiusSum - dist
        a.x -= nx * overlap / 2
        a.y -= ny * overlap / 2
        b.x += nx * overlap / 2
        b.y += ny * overlap / 2
        const relV = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
        a.vx -= relV * nx * 0.5
        a.vy -= relV * ny * 0.5
        b.vx += relV * nx * 0.5
        b.vy += relV * ny * 0.5
      }
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, 800, 600)

  for (const ball of balls) {
    ctx.fillStyle = '#4a9eff'
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = '#fff'
  ctx.font = '14px monospace'
  ctx.fillText(`Balls: ${NUM_BALLS} | Collision checks: ${collisionChecks}`, 10, 20)
  ctx.fillText(`Brute force would need: ${NUM_BALLS * (NUM_BALLS - 1) / 2}`, 10, 40)
}

function loop() {
  update()
  draw()
  requestAnimationFrame(loop)
}
loop()
```

300 个球，网格分区后碰撞检测次数远少于暴力的 44850 次。

## 常见错误

**物体跨越多个格子时重复检测**。用 Set 去重，或者用 `i < j` 的条件过滤。

**格子大小选错**。太大退化成暴力检测，太小物体跨太多格子。观察实际的碰撞检测次数来调优。

**每帧重建网格**。物体不多时可以每帧清空重建。物体很多时可以考虑增量更新。

## 练习

### 练习一：性能对比

分别用暴力检测和网格分区检测 500 个球。记录每帧的碰撞检测次数和耗时。

### 练习二：自适应格子大小

根据场景中物体的平均大小自动计算最优格子大小。物体大小差异很大时怎么办？

---

## 参考答案

### 练习一

```ts
// 暴力检测
let bruteForceChecks = 0
for (let i = 0; i < balls.length; i++) {
  for (let j = i + 1; j < balls.length; j++) {
    bruteForceChecks++
    // ... 检测逻辑
  }
}

console.log('Brute force:', bruteForceChecks)
console.log('Grid:', collisionChecks)
// 500 个球：暴力 124750 次 vs 网格大约 2000-5000 次
```

### 练习二

```ts
function adaptiveCellSize(bodies: { aabb: AABB }[]): number {
  let totalSize = 0
  for (const body of bodies) {
    const w = body.aabb.maxX - body.aabb.minX
    const h = body.aabb.maxY - body.aabb.minY
    totalSize += Math.max(w, h)
  }
  const avgSize = totalSize / bodies.length
  return avgSize * 3
}
```

物体大小差异很大时，可以用多层网格（不同粒度）或者用四叉树。
