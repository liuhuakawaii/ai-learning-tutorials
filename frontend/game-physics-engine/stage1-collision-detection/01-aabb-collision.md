# AABB 碰撞——轴对齐包围盒检测与响应

## 这节课解决什么问题

你有一个矩形角色和一个矩形墙壁，怎么判断它们撞上了？撞上之后怎么把角色推回去？

这是物理引擎最基础的能力。所有复杂的碰撞检测，最终都要回到这种简单的几何判断上。

## AABB 是什么

AABB（Axis-Aligned Bounding Box）就是边与坐标轴平行的矩形。不用考虑旋转，只需要知道左、右、上、下四个边界。

用两个点就能表示：最小点 `(minX, minY)` 和最大点 `(maxX, maxY)`。

```ts
interface AABB {
  minX: number
  minY: number
  maxX: number
  maxY: number
}
```

## 检测：两个 AABB 是否重叠

两个矩形不重叠的条件很容易想：一个完全在另一个的左边、右边、上边或下边。

反过来，只要四个方向都没分开，就是重叠的。

```ts
function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY
  )
}
```

注意用的是 `<` 和 `>`，不是 `<=` 和 `>=`。两个盒子刚好贴边不算碰撞，这在物理模拟里是合理的选择——否则堆叠的盒子会因为浮点精度问题不断触发碰撞。

## 穿透深度和碰撞法线

检测到碰撞还不够，还需要知道"嵌进去多深"和"从哪个方向推开"。

对 AABB 来说，分别算四个方向的穿透深度，取最小的那个：

```ts
interface CollisionInfo {
  normal: { x: number; y: number }
  depth: number
}

function aabbCollisionInfo(a: AABB, b: AABB): CollisionInfo | null {
  const overlapX = Math.min(a.maxX - b.minX, b.maxX - a.minX)
  const overlapY = Math.min(a.maxY - b.minY, b.maxY - a.minY)

  if (overlapX <= 0 || overlapY <= 0) return null

  if (overlapX < overlapY) {
    const sign = a.minX + (a.maxX - a.minX) / 2 < b.minX + (b.maxX - b.minX) / 2 ? -1 : 1
    return { normal: { x: sign, y: 0 }, depth: overlapX }
  } else {
    const sign = a.minY + (a.maxY - a.minY) / 2 < b.minY + (b.maxY - b.minY) / 2 ? -1 : 1
    return { normal: { x: 0, y: sign }, depth: overlapY }
  }
}
```

穿透深度最小的方向就是碰撞法线方向。这个直觉很简单：物体总是从最容易的那个方向被挤出去。

## 碰撞响应：位置修正

最简单的响应方式是直接把物体沿法线方向推出去：

```ts
function resolveCollision(
  a: AABB,
  b: AABB,
  info: CollisionInfo
): void {
  const pushX = info.normal.x * info.depth
  const pushY = info.normal.y * info.depth

  a.minX += pushX
  a.maxX += pushX
  a.minY += pushY
  a.maxY += pushY
}
```

这叫位置修正。它能解决"嵌进去"的问题，但不涉及速度变化。后面学刚体动力学时会用冲量法来处理速度。

## 完整示例：滑动的盒子

把上面的碎片拼起来，做一个可以在 Canvas 上跑的完整例子：

```ts
const canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 400
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

const box: AABB = { minX: 100, minY: 100, maxX: 160, maxY: 160 }
const wall: AABB = { minX: 300, minY: 50, maxX: 340, maxY: 350 }

const keys = new Set<string>()
window.addEventListener('keydown', (e) => keys.add(e.key))
window.addEventListener('keyup', (e) => keys.delete(e.key))

const SPEED = 3

function update() {
  let dx = 0, dy = 0
  if (keys.has('ArrowLeft')) dx -= SPEED
  if (keys.has('ArrowRight')) dx += SPEED
  if (keys.has('ArrowUp')) dy -= SPEED
  if (keys.has('ArrowDown')) dy += SPEED

  box.minX += dx
  box.maxX += dx
  box.minY += dy
  box.maxY += dy

  const info = aabbCollisionInfo(box, wall)
  if (info) {
    resolveCollision(box, wall, info)
  }
}

function draw() {
  ctx.clearRect(0, 0, 600, 400)
  ctx.fillStyle = '#4a9eff'
  ctx.fillRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY)
  ctx.fillStyle = '#666'
  ctx.fillRect(wall.minX, wall.minY, wall.maxX - wall.minX, wall.maxY - wall.minY)
}

function loop() {
  update()
  draw()
  requestAnimationFrame(loop)
}
loop()
```

用方向键移动蓝色盒子，碰到灰色墙壁会被推开。

## 常见错误

**用中心点距离判断 AABB 碰撞**。两个矩形的中心点距离近不代表碰撞，距离远也不代表没碰撞。AABB 的检测必须比较边界。

**碰撞法线方向搞反**。法线方向应该是"把 A 从 B 里推出来的方向"。算错方向会导致物体被推进墙壁里。

**忽略穿透深度为零的情况**。浮点运算可能算出极小的穿透深度，这种微小碰撞不需要处理，否则会出现物体在表面抖动的现象。可以加一个阈值：

```ts
const EPSILON = 0.001
if (info.depth < EPSILON) return
```

## 这个方案的边界

AABB 只能处理不旋转的矩形。一旦物体旋转了，它的包围盒就不再和坐标轴平行，需要换用 OBB（有向包围盒）或者后面会学的 SAT 算法。

不过 AABB 在实际项目中用得非常多，因为它的检测成本极低。很多引擎用 AABB 做第一轮粗筛（Broad Phase），通过了再做精确检测。

## 练习

### 练习一：多个静态障碍物

修改上面的代码，让场景里有 5 个不同位置的墙壁。角色碰到任何一个都会被推开。

### 练习二：AABB 包围盒

给一个任意形状的物体（比如一组点），写一个函数计算它的 AABB 包围盒：

```ts
function computeAABB(points: { x: number; y: number }[]): AABB
```

---

## 参考答案

### 练习一

把墙壁放进数组，每帧遍历检测：

```ts
const walls: AABB[] = [
  { minX: 300, minY: 50, maxX: 340, maxY: 350 },
  { minX: 100, minY: 200, maxX: 400, maxY: 240 },
  { minX: 450, minY: 100, maxX: 490, maxY: 300 },
  { minX: 50, minY: 300, maxX: 200, maxY: 340 },
  { minX: 400, minY: 50, maxX: 550, maxY: 90 },
]

function update() {
  // ... 移动逻辑同上 ...

  for (const wall of walls) {
    const info = aabbCollisionInfo(box, wall)
    if (info) {
      resolveCollision(box, wall, info)
    }
  }
}
```

**注意**：如果有多个碰撞同时发生，逐个修正可能会互相干扰。更严谨的做法是找到穿透最深的碰撞优先处理，或者用约束求解器统一处理。这里逐个修正对简单场景够用。

### 练习二

```ts
function computeAABB(points: { x: number; y: number }[]): AABB {
  let minX = Infinity, minY = Infinity
  let maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}
```

这个函数在后面做空间分区时会反复用到——任何形状都能用一个 AABB 来近似表示。
