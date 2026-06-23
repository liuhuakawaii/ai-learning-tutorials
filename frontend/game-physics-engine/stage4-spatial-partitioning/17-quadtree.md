# 四叉树——动态四叉树的插入/查询/删除

## 网格的局限

均匀网格在物体分布均匀时很好用。但如果物体集中在角落，大部分格子是空的，浪费内存。

更麻烦的是物体大小差异很大。一个小粒子和一个大平台，格子大小该设多少？设小了大平台跨很多格子，设大了小粒子的检测没有意义。

四叉树自适应地划分空间。物体密集的地方多分，稀疏的地方少分。

## 四叉树的结构

```ts
interface Vec2 { x: number; y: number }
interface AABB { minX: number; minY: number; maxX: number; maxY: number }

const MAX_OBJECTS = 4
const MAX_DEPTH = 8

interface QuadNode {
  bounds: AABB
  objects: { id: number; aabb: AABB }[]
  children: QuadNode[] | null
  depth: number
}
```

每个节点有一个边界框。如果节点里的物体数量超过阈值，就分裂成四个子节点。

## 构建四叉树

```ts
function createQuadNode(bounds: AABB, depth: number): QuadNode {
  return { bounds, objects: [], children: null, depth }
}

function split(node: QuadNode): void {
  const { minX, minY, maxX, maxY } = node.bounds
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2

  node.children = [
    createQuadNode({ minX, minY, maxX: midX, maxY: midY }, node.depth + 1),
    createQuadNode({ minX: midX, minY, maxX, maxY: midY }, node.depth + 1),
    createQuadNode({ minX, minY: midY, maxX: midX, maxY }, node.depth + 1),
    createQuadNode({ minX: midX, minY: midY, maxX, maxY }, node.depth + 1),
  ]

  const oldObjects = node.objects
  node.objects = []

  for (const obj of oldObjects) {
    insertIntoNode(node, obj)
  }
}

function quadrantOf(node: QuadNode, aabb: AABB): number[] {
  if (!node.children) return []

  const midX = (node.bounds.minX + node.bounds.maxX) / 2
  const midY = (node.bounds.minY + node.bounds.maxY) / 2

  const quads: number[] = []
  if (aabb.minX < midX && aabb.minY < midY) quads.push(0)
  if (aabb.maxX >= midX && aabb.minY < midY) quads.push(1)
  if (aabb.minX < midX && aabb.maxY >= midY) quads.push(2)
  if (aabb.maxX >= midX && aabb.maxY >= midY) quads.push(3)

  return quads
}
```

一个物体可能跨越多个象限，需要插入到所有相交的子节点中。

## 插入

```ts
function insertIntoNode(
  node: QuadNode,
  obj: { id: number; aabb: AABB },
): void {
  if (node.children) {
    const quads = quadrantOf(node, obj.aabb)
    for (const qi of quads) {
      insertIntoNode(node.children[qi], obj)
    }
    return
  }

  node.objects.push(obj)

  if (node.objects.length > MAX_OBJECTS && node.depth < MAX_DEPTH) {
    split(node)
  }
}
```

插入时如果节点已分裂，递归到子节点。如果节点未分裂且物体数超限，先分裂再重新分配。

## 查询

查询一个区域内的所有物体：

```ts
function query(node: QuadNode, aabb: AABB, result: Set<number>): void {
  if (!aabbOverlap(node.bounds, aabb)) return

  for (const obj of node.objects) {
    if (aabbOverlap(obj.aabb, aabb)) {
      result.add(obj.id)
    }
  }

  if (node.children) {
    for (const child of node.children) {
      query(child, aabb, result)
    }
  }
}

function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}
```

查询时先检查节点边界是否和查询区域重叠。不重叠就跳过整棵子树。

## 删除

```ts
function removeFromNode(
  node: QuadNode,
  obj: { id: number; aabb: AABB },
): boolean {
  if (!aabbOverlap(node.bounds, obj.aabb)) return false

  const idx = node.objects.findIndex(o => o.id === obj.id)
  if (idx >= 0) {
    node.objects.splice(idx, 1)
    return true
  }

  if (node.children) {
    let found = false
    for (const child of node.children) {
      if (removeFromNode(child, obj)) found = true
    }
    return found
  }

  return false
}
```

删除后可以检查节点是否需要合并（物体太少时合并回父节点）。实际引擎通常不合并——每帧重建整棵树。

## 每帧重建 vs 增量更新

大多数物理引擎每帧重建四叉树。原因是物体每帧都在移动，增量更新的成本和重建差不多。

```ts
class QuadTree {
  root: QuadNode

  constructor(bounds: AABB) {
    this.root = createQuadNode(bounds, 0)
  }

  clear(): void {
    this.root.objects = []
    this.root.children = null
  }

  insert(id: number, aabb: AABB): void {
    insertIntoNode(this.root, { id, aabb })
  }

  query(aabb: AABB): Set<number> {
    const result = new Set<number>()
    query(this.root, aabb, result)
    return result
  }
}
```

## 完整示例：四叉树可视化

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
}

const balls: Ball[] = []
for (let i = 0; i < 100; i++) {
  balls.push({
    x: Math.random() * 500 + 50,
    y: Math.random() * 500 + 50,
    vx: (Math.random() - 0.5) * 3,
    vy: (Math.random() - 0.5) * 3,
    radius: 5 + Math.random() * 5,
  })
}

const tree = new QuadTree({ minX: 0, minY: 0, maxX: 600, maxY: 600 })

function getAABB(ball: Ball): AABB {
  return {
    minX: ball.x - ball.radius,
    minY: ball.y - ball.radius,
    maxX: ball.x + ball.radius,
    maxY: ball.y + ball.radius,
  }
}

function drawNode(node: QuadNode): void {
  ctx.strokeStyle = '#ffffff22'
  ctx.lineWidth = 0.5
  ctx.strokeRect(
    node.bounds.minX, node.bounds.minY,
    node.bounds.maxX - node.bounds.minX,
    node.bounds.maxY - node.bounds.minY,
  )
  if (node.children) {
    for (const child of node.children) drawNode(child)
  }
}

function update() {
  tree.clear()
  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i]
    ball.x += ball.vx
    ball.y += ball.vy
    if (ball.x < ball.radius || ball.x > 600 - ball.radius) ball.vx *= -1
    if (ball.y < ball.radius || ball.y > 600 - ball.radius) ball.vy *= -1
    ball.x = Math.max(ball.radius, Math.min(600 - ball.radius, ball.x))
    ball.y = Math.max(ball.radius, Math.min(600 - ball.radius, ball.y))
    tree.insert(i, getAABB(ball))
  }

  for (let i = 0; i < balls.length; i++) {
    const nearby = tree.query(getAABB(balls[i]))
    for (const j of nearby) {
      if (i >= j) continue
      const a = balls[i], b = balls[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const distSq = dx * dx + dy * dy
      const rSum = a.radius + b.radius
      if (distSq < rSum * rSum && distSq > 0) {
        const dist = Math.sqrt(distSq)
        const nx = dx / dist, ny = dy / dist
        const overlap = rSum - dist
        a.x -= nx * overlap / 2
        a.y -= ny * overlap / 2
        b.x += nx * overlap / 2
        b.y += ny * overlap / 2
      }
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, 600, 600)
  drawNode(tree.root)
  for (const ball of balls) {
    ctx.fillStyle = '#4a9eff'
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
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

画面上可以看到四叉树的格子随球的分布动态变化。

## 四叉树 vs 网格

| | 均匀网格 | 四叉树 |
|---|---|---|
| 内存 | 固定，可能浪费 | 动态，按需分配 |
| 物体大小差异 | 需要设好格子大小 | 自适应 |
| 实现复杂度 | 简单 | 中等 |
| 性能 | 物体均匀时最快 | 物体不均匀时更好 |

## 常见错误

**物体跨象限时重复检测**。一个物体在多个叶子节点里，查询时会返回多次。用 Set 去重。

**没有限制深度**。物体全挤在一个点时会无限分裂。`MAX_DEPTH` 必须设上限。

**边界框算错**。AABB 必须包含物体的所有部分。旋转的多边形 AABB 会变大。

## 练习

### 练习一：鼠标查询

鼠标移动时，高亮鼠标周围 100px 范围内的所有球。用四叉树的 query 方法。

### 练习二：四叉树统计

显示四叉树的节点数量、最大深度、平均每个节点的物体数。调整 MAX_OBJECTS 观察变化。

---

## 参考答案

### 练习一

```ts
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const range = { minX: mx - 100, minY: my - 100, maxX: mx + 100, maxY: my + 100 }
  const nearby = tree.query(range)
  // 高亮 nearby 里的球
})
```

### 练习二

```ts
function treeStats(node: QuadNode): { nodes: number; maxDepth: number; totalObjects: number } {
  let nodes = 1
  let maxDepth = node.depth
  let totalObjects = node.objects.length
  if (node.children) {
    for (const child of node.children) {
      const childStats = treeStats(child)
      nodes += childStats.nodes
      maxDepth = Math.max(maxDepth, childStats.maxDepth)
      totalObjects += childStats.totalObjects
    }
  }
  return { nodes, maxDepth, totalObjects }
}
```
