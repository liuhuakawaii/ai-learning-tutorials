# Broad Phase——Sweep and Prune、空间哈希对比

## Broad Phase 的角色

物理引擎的碰撞检测分两阶段：

1. **Broad Phase**（粗筛）：快速找出可能碰撞的物体对，排除不可能碰撞的
2. **Narrow Phase**（精检）：对 Broad Phase 的结果做精确碰撞检测

Broad Phase 不需要精确，只需要快。宁可多报几对（假阳性），不能漏掉（假阴性）。

## Sweep and Prune（扫描修剪）

SAP 的思路极其简单：如果两个物体在 x 轴上的投影不重叠，它们一定不会碰撞。

把所有物体按 AABB 的最小 x 排序，然后扫描一遍，找出在 x 轴上重叠的对。再对这些对检查 y 轴。

```ts
interface AABB { minX: number; minY: number; maxX: number; maxY: number }

interface SAPEntry {
  id: number
  aabb: AABB
}

function sweepAndPrune(bodies: SAPEntry[]): [number, number][] {
  const sorted = [...bodies].sort((a, b) => a.aabb.minX - b.aabb.minX)
  const pairs: [number, number][] = []

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].aabb.minX > sorted[i].aabb.maxX) break

      if (
        sorted[i].aabb.minY < sorted[j].aabb.maxY &&
        sorted[i].aabb.maxY > sorted[j].aabb.minY
      ) {
        pairs.push([sorted[i].id, sorted[j].id])
      }
    }
  }

  return pairs
}
```

内层循环在 x 轴不重叠时立即 break。在 y 轴上检查是否重叠。

## 增量排序优化

物体每帧移动不多，排序结果和上一帧很接近。用插入排序比快速排序更快：

```ts
function insertionSort(arr: SAPEntry[]): void {
  for (let i = 1; i < arr.length; i++) {
    const key = arr[i]
    let j = i - 1
    while (j >= 0 && arr[j].aabb.minX > key.aabb.minX) {
      arr[j + 1] = arr[j]
      j--
    }
    arr[j + 1] = key
  }
}
```

对于几乎有序的数组，插入排序是 O(n)，比快速排序的 O(n log n) 快。

## 事件驱动的 SAP

更进一步，只在物体的 AABB 端点跨越时更新排序：

```ts
interface Endpoint {
  value: number
  bodyId: number
  isMin: boolean
}

function sweepAndPruneEndpoints(endpoints: Endpoint[]): [number, number][] {
  endpoints.sort((a, b) => a.value - b.value)

  const active = new Set<number>()
  const pairs: [number, number][] = []

  for (const ep of endpoints) {
    if (ep.isMin) {
      for (const other of active) {
        pairs.push([Math.min(ep.bodyId, other), Math.max(ep.bodyId, other)])
      }
      active.add(ep.bodyId)
    } else {
      active.delete(ep.bodyId)
    }
  }

  return pairs
}
```

## 空间哈希回顾

空间哈希在第 16 课已经实现过。这里对比它的性能特征：

```ts
function spatialHashBroadPhase(
  bodies: { id: number; aabb: AABB }[],
  cellSize: number,
): [number, number][] {
  const buckets = new Map<string, number[]>()

  for (const body of bodies) {
    const minCol = Math.floor(body.aabb.minX / cellSize)
    const maxCol = Math.floor(body.aabb.maxX / cellSize)
    const minRow = Math.floor(body.aabb.minY / cellSize)
    const maxRow = Math.floor(body.aabb.maxY / cellSize)

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const key = `${col},${row}`
        let bucket = buckets.get(key)
        if (!bucket) {
          bucket = []
          buckets.set(key, bucket)
        }
        bucket.push(body.id)
      }
    }
  }

  const pairSet = new Set<string>()
  const pairs: [number, number][] = []

  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = Math.min(bucket[i], bucket[j])
        const b = Math.max(bucket[i], bucket[j])
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
```

## 三种 Broad Phase 对比

| 方法 | 构建 | 查询 | 适用场景 |
|---|---|---|---|
| 均匀网格 | O(n) | O(1) 每物体 | 物体大小相近，分布均匀 |
| 空间哈希 | O(n) | O(1) 每物体 | 物体大小相近，分布不均匀 |
| Sweep and Prune | O(n log n) | O(n) 最坏 | 物体运动慢，帧间变化小 |
| BVH | O(n log n) | O(log n) 每物体 | 物体大小差异大 |

## 完整示例：三种方法性能对比

```ts
const canvas = document.createElement('canvas')
canvas.width = 800
canvas.height = 400
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

interface Ball {
  x: number; y: number; vx: number; vy: number; radius: number
  aabb: AABB
}

function createBalls(n: number, clustered: boolean): Ball[] {
  const balls: Ball[] = []
  for (let i = 0; i < n; i++) {
    const r = 5 + Math.random() * 5
    let x: number, y: number
    if (clustered) {
      x = 300 + (Math.random() - 0.5) * 200
      y = 200 + (Math.random() - 0.5) * 200
    } else {
      x = Math.random() * 700 + 50
      y = Math.random() * 300 + 50
    }
    balls.push({
      x, y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      radius: r,
      aabb: { minX: x - r, minY: y - r, maxX: x + r, maxY: y + r },
    })
  }
  return balls
}

function updateAABB(ball: Ball): void {
  ball.aabb.minX = ball.x - ball.radius
  ball.aabb.minY = ball.y - ball.radius
  ball.aabb.maxX = ball.x + ball.radius
  ball.aabb.maxY = ball.y + ball.radius
}

function benchmark(name: string, fn: () => void, iterations: number): number {
  const start = performance.now()
  for (let i = 0; i < iterations; i++) fn()
  return performance.now() - start
}

const NUM = 500
const balls = createBalls(NUM, false)

for (const ball of balls) updateAABB(ball)

const sapEntries: SAPEntry[] = balls.map((b, i) => ({ id: i, aabb: b.aabb }))

const bruteTime = benchmark('brute', () => {
  const pairs: [number, number][] = []
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      if (aabbOverlap(balls[i].aabb, balls[j].aabb)) pairs.push([i, j])
    }
  }
}, 10)

const sapTime = benchmark('sap', () => sweepAndPrune(sapEntries), 10)

const hashTime = benchmark('hash', () => spatialHashBroadPhase(
  balls.map((b, i) => ({ id: i, aabb: b.aabb })), 30,
), 10)

console.log(`Brute: ${bruteTime.toFixed(1)}ms`)
console.log(`SAP: ${sapTime.toFixed(1)}ms`)
console.log(`Hash: ${hashTime.toFixed(1)}ms`)
```

## 实际引擎怎么选

Box2D 用的是 Sweep and Prune。因为 2D 物理场景通常物体不多（几百到几千），SAP 的常数因子小，对慢速运动的物体效率很高。

3D 引擎（如 Bullet）常用 BVH。3D 空间更大，物体大小差异更大，BVH 的自适应能力更重要。

很多引擎混合使用：BVH 做第一层粗筛，SAP 做第二层。

## 常见错误

**SAP 只检查了一个轴**。必须同时检查 x 和 y 轴。只检查 x 轴会产生大量假阳性。

**空间哈希的 cellSize 太小**。大物体会跨很多格子，插入成本高。通常设为最大物体尺寸的 2-3 倍。

**每帧重建数据结构**。SAP 的优势是增量排序。每帧重建就失去了这个优势。

## 练习

### 练习一：动态物体

创建 200 个慢速移动的物体，对比 SAP 和空间哈希的每帧更新耗时。

### 练习二：混合策略

实现一个两层 Broad Phase：先用粗粒度的空间哈希分区，再在每个分区内用 SAP 排序。

---

## 参考答案

### 练习一

慢速移动的物体，SAP 的增量排序优势明显。空间哈希每帧需要清除所有桶再重新插入。

### 练习二

```ts
function hybridBroadPhase(bodies: SAPEntry[], gridSize: number): [number, number][] {
  const grid = new Map<string, SAPEntry[]>()
  for (const body of bodies) {
    const col = Math.floor((body.aabb.minX + body.aabb.maxX) / 2 / gridSize)
    const row = Math.floor((body.aabb.minY + body.aabb.maxY) / 2 / gridSize)
    const key = `${col},${row}`
    let bucket = grid.get(key)
    if (!bucket) { bucket = []; grid.set(key, bucket) }
    bucket.push(body)
  }

  const allPairs: [number, number][] = []
  for (const bucket of grid.values()) {
    allPairs.push(...sweepAndPrune(bucket))
  }
  return allPairs
}
```
