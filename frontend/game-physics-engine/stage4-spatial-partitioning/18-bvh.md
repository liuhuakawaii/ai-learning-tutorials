# BVH——层次包围体的构建与遍历

## 什么是 BVH

BVH（Bounding Volume Hierarchy）是一棵二叉树，每个节点有一个包围盒，叶子节点是实际的物体。

和四叉树不同，BVH 不按空间位置划分，而是按物体的位置聚类划分。物体密集的区域会分得更细。

## 为什么用 BVH

四叉树在物体分布不均匀时效率不稳定。BVH 根据物体的实际分布来构建，每个叶子节点只包含一个物体，不会有物体跨节点的问题。

BVH 在动态场景中的更新也很高效——只更新移动物体所在的分支。

## 节点结构

```ts
interface AABB { minX: number; minY: number; maxX: number; maxY: number }

interface BVHNode {
  aabb: AABB
  left: BVHNode | null
  right: BVHNode | null
  bodyIndex: number
}
```

叶子节点的 `left` 和 `right` 为 null，`bodyIndex` 指向物体。内部节点的 `bodyIndex` 为 -1。

## 构建 BVH

最简单的构建策略是按最长轴中位数分割：

```ts
function buildBVH(bodies: { aabb: AABB }[], indices: number[], depth: number): BVHNode {
  if (indices.length === 1) {
    return {
      aabb: { ...bodies[indices[0]].aabb },
      left: null,
      right: null,
      bodyIndex: indices[0],
    }
  }

  const nodeAABB = computeBounds(bodies, indices)
  const axis = longestAxis(nodeAABB)

  indices.sort((a, b) => {
    const centerA = (bodies[a].aabb.minX + bodies[a].aabb.maxX) / 2
    const centerB = (bodies[b].aabb.minX + bodies[b].aabb.maxX) / 2
    if (axis === 0) {
      return centerA - centerB
    }
    const centerYA = (bodies[a].aabb.minY + bodies[a].aabb.maxY) / 2
    const centerYB = (bodies[b].aabb.minY + bodies[b].aabb.maxY) / 2
    return centerYA - centerYB
  })

  const mid = Math.floor(indices.length / 2)
  const leftIndices = indices.slice(0, mid)
  const rightIndices = indices.slice(mid)

  return {
    aabb: nodeAABB,
    left: buildBVH(bodies, leftIndices, depth + 1),
    right: buildBVH(bodies, rightIndices, depth + 1),
    bodyIndex: -1,
  }
}

function computeBounds(bodies: { aabb: AABB }[], indices: number[]): AABB {
  let minX = Infinity, minY = Infinity
  let maxX = -Infinity, maxY = -Infinity
  for (const i of indices) {
    const a = bodies[i].aabb
    if (a.minX < minX) minX = a.minX
    if (a.minY < minY) minY = a.minY
    if (a.maxX > maxX) maxX = a.maxX
    if (a.maxY > maxY) maxY = a.maxY
  }
  return { minX, minY, maxX, maxY }
}

function longestAxis(aabb: AABB): number {
  const dx = aabb.maxX - aabb.minX
  const dy = aabb.maxY - aabb.minY
  return dx > dy ? 0 : 1
}
```

构建的时间复杂度是 O(n log n)。

## SAH 构建（Surface Area Heuristic）

更精确的构建方法是 SAH。它选择使"遍历成本 + 分割后检测成本"最小的分割点：

```ts
function sahCost(aabb: AABB): number {
  const dx = aabb.maxX - aabb.minX
  const dy = aabb.maxY - aabb.minY
  return 2 * (dx + dy)
}

function findBestSplit(bodies: { aabb: AABB }[], indices: number[]): number {
  let bestCost = Infinity
  let bestSplit = Math.floor(indices.length / 2)

  for (let axis = 0; axis < 2; axis++) {
    indices.sort((a, b) => {
      const centerA = axis === 0
        ? (bodies[a].aabb.minX + bodies[a].aabb.maxX) / 2
        : (bodies[a].aabb.minY + bodies[a].aabb.maxY) / 2
      const centerB = axis === 0
        ? (bodies[b].aabb.minX + bodies[b].aabb.maxX) / 2
        : (bodies[b].aabb.minY + bodies[b].aabb.maxY) / 2
      return centerA - centerB
    })

    for (let i = 1; i < indices.length; i++) {
      const leftBounds = computeBounds(bodies, indices.slice(0, i))
      const rightBounds = computeBounds(bodies, indices.slice(i))
      const cost = sahCost(leftBounds) * i + sahCost(rightBounds) * (indices.length - i)
      if (cost < bestCost) {
        bestCost = cost
        bestSplit = i
      }
    }
  }

  return bestSplit
}
```

SAH 构建更慢，但生成的树质量更高，遍历更快。

## 遍历查询

```ts
function queryBVH(node: BVHNode | null, aabb: AABB, result: number[]): void {
  if (!node) return
  if (!aabbOverlap(node.aabb, aabb)) return

  if (node.bodyIndex >= 0) {
    result.push(node.bodyIndex)
    return
  }

  queryBVH(node.left, aabb, result)
  queryBVH(node.right, aabb, result)
}

function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}
```

查询时先检查节点的 AABB 是否和查询区域重叠。不重叠就跳过整棵子树。

## 自碰撞检测

BVH 最常见的用法是自碰撞检测——找出所有可能碰撞的物体对：

```ts
function selfCollision(nodeA: BVHNode, nodeB: BVHNode, pairs: Set<string>): void {
  if (!aabbOverlap(nodeA.aabb, nodeB.aabb)) return

  if (nodeA.bodyIndex >= 0 && nodeB.bodyIndex >= 0) {
    if (nodeA.bodyIndex !== nodeB.bodyIndex) {
      const key = nodeA.bodyIndex < nodeB.bodyIndex
        ? `${nodeA.bodyIndex}-${nodeB.bodyIndex}`
        : `${nodeB.bodyIndex}-${nodeA.bodyIndex}`
      pairs.add(key)
    }
    return
  }

  if (nodeA.bodyIndex >= 0) {
    selfCollision(nodeA, nodeB.left!, pairs)
    selfCollision(nodeA, nodeB.right!, pairs)
  } else if (nodeB.bodyIndex >= 0) {
    selfCollision(nodeA.left!, nodeB, pairs)
    selfCollision(nodeA.right!, nodeB, pairs)
  } else {
    selfCollision(nodeA.left!, nodeB.left!, pairs)
    selfCollision(nodeA.left!, nodeB.right!, pairs)
    selfCollision(nodeA.right!, nodeB.left!, pairs)
    selfCollision(nodeA.right!, nodeB.right!, pairs)
  }
}
```

## 动态更新

物体移动后，BVH 的节点 AABB 需要更新。最简单的方法是每帧重建。更高效的方法是只更新移动物体所在的分支：

```ts
function refit(node: BVHNode, bodies: { aabb: AABB }[]): void {
  if (node.bodyIndex >= 0) {
    node.aabb = { ...bodies[node.bodyIndex].aabb }
    return
  }

  if (node.left) refit(node.left, bodies)
  if (node.right) refit(node.right, bodies)

  node.aabb = mergeAABB(
    node.left?.aabb ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    node.right?.aabb ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  )
}

function mergeAABB(a: AABB, b: AABB): AABB {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}
```

refit 是 O(n)，比重建的 O(n log n) 快，但只适用于物体位置变化但拓扑不变的情况。

## 完整示例

```ts
const canvas = document.createElement('canvas')
canvas.width = 600
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

const balls: Ball[] = []
for (let i = 0; i < 80; i++) {
  const r = 5 + Math.random() * 8
  balls.push({
    x: Math.random() * 500 + 50,
    y: Math.random() * 500 + 50,
    vx: (Math.random() - 0.5) * 3,
    vy: (Math.random() - 0.5) * 3,
    radius: r,
    aabb: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  })
}

function updateAABB(ball: Ball): void {
  ball.aabb.minX = ball.x - ball.radius
  ball.aabb.minY = ball.y - ball.radius
  ball.aabb.maxX = ball.x + ball.radius
  ball.aabb.maxY = ball.y + ball.radius
}

function drawBVH(node: BVHNode | null, depth: number): void {
  if (!node || depth > 4) return
  ctx.strokeStyle = `rgba(255,255,255,${0.15 - depth * 0.03})`
  ctx.lineWidth = 1
  ctx.strokeRect(
    node.aabb.minX, node.aabb.minY,
    node.aabb.maxX - node.aabb.minX,
    node.aabb.maxY - node.aabb.minY,
  )
  drawBVH(node.left, depth + 1)
  drawBVH(node.right, depth + 1)
}

function update() {
  for (const ball of balls) {
    ball.x += ball.vx
    ball.y += ball.vy
    if (ball.x < ball.radius || ball.x > 600 - ball.radius) ball.vx *= -1
    if (ball.y < ball.radius || ball.y > 600 - ball.radius) ball.vy *= -1
    ball.x = Math.max(ball.radius, Math.min(600 - ball.radius, ball.x))
    ball.y = Math.max(ball.radius, Math.min(600 - ball.radius, ball.y))
    updateAABB(ball)
  }

  const indices = balls.map((_, i) => i)
  const root = buildBVH(balls, indices, 0)

  const pairs = new Set<string>()
  selfCollision(root, root, pairs)

  for (const key of pairs) {
    const [i, j] = key.split('-').map(Number)
    const a = balls[i], b = balls[j]
    const dx = b.x - a.x, dy = b.y - a.y
    const distSq = dx * dx + dy * dy
    const rSum = a.radius + b.radius
    if (distSq < rSum * rSum && distSq > 0) {
      const dist = Math.sqrt(distSq)
      const nx = dx / dist, ny = dy / dist
      a.x -= nx * (rSum - dist) / 2
      a.y -= ny * (rSum - dist) / 2
      b.x += nx * (rSum - dist) / 2
      b.y += ny * (rSum - dist) / 2
    }
  }

  return root
}

function loop() {
  const root = update()
  ctx.clearRect(0, 0, 600, 600)
  drawBVH(root, 0)
  for (const ball of balls) {
    ctx.fillStyle = '#4a9eff'
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
    ctx.fill()
  }
  requestAnimationFrame(loop)
}
loop()
```

## 常见错误

**每帧排序太慢**。sort 在构建时调用，如果每帧重建要小心性能。对小数组（< 100）影响不大。

**refit 后 AABB 膨胀**。refit 只收紧 AABB，不会收缩。物体大幅移动后 AABB 会比实际大很多，降低检测效率。每隔一段时间需要重建。

**叶子节点判断错误**。`bodyIndex >= 0` 是叶子节点。忘记判断会导致无限递归。

## 练习

### 练习一：BVH vs 网格

对比 BVH 和均匀网格在物体分布不均匀时的性能。

### 练习二：增量更新

实现一个 BVH，物体移动时只 refit 而不重建。每隔 60 帧重建一次。

---

## 参考答案

### 练习一

在物体聚集在一个角落的场景下，均匀网格的大部分格子是空的，但查询时仍需遍历。BVH 的树结构能更好地适应这种分布。

### 练习二

```ts
let frameCount = 0

function update() {
  // ... 移动物体

  frameCount++
  if (frameCount % 60 === 0) {
    root = buildBVH(balls, balls.map((_, i) => i), 0)
  } else {
    refit(root, balls)
  }
}
```
