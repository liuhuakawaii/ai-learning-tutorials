# GJK 算法——Gilbert-Johnson-Keerthi 算法与 EPA 扩展

## SAT 有什么不爽

SAT 需要遍历所有边的法线。两个各有 10 条边的多边形，要检测 20 条轴。如果形状更复杂，轴的数量线性增长。

GJK 不关心边数。它通过迭代逼近两个形状的"最近距离"，在大多数情况下几步就能判断是否碰撞。对于圆形、多边形、甚至曲线形状都适用。

## Minkowski 差

GJK 的数学基础是 Minkowski 差：把形状 A 的每个点减去形状 B 的每个点，得到一个新的形状。

如果 A 和 B 碰撞，Minkowski 差一定包含原点。

但直接计算 Minkowski 差太贵了。GJK 的精妙之处在于：它不需要显式计算整个 Minkowski 差，只需要在它的边界上采样。

## Support 函数

给定一个方向，Support 函数返回形状在该方向上最远的点：

```ts
interface Vec2 { x: number; y: number }
interface Shape {
  support(direction: Vec2): Vec2
}
```

对 Minkowski 差来说，Support 就是 A 在方向 d 上最远的点，减去 B 在反方向上最远的点：

```ts
function supportMinkowski(a: Shape, b: Shape, d: Vec2): Vec2 {
  const sa = a.support(d)
  const sb = b.support({ x: -d.x, y: -d.y })
  return { x: sa.x - sb.x, y: sa.y - sb.y }
}
```

## 三角形的 Support

```ts
function createTriangleShape(cx: number, cy: number, radius: number, angle: number = 0): Shape {
  const vertices: Vec2[] = []
  for (let i = 0; i < 3; i++) {
    const a = angle + (Math.PI * 2 * i) / 3
    vertices.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) })
  }
  return {
    support(d: Vec2): Vec2 {
      let best = vertices[0]
      let bestDot = best.x * d.x + best.y * d.y
      for (let i = 1; i < vertices.length; i++) {
        const dot = vertices[i].x * d.x + vertices[i].y * d.y
        if (dot > bestDot) {
          best = vertices[i]
          bestDot = dot
        }
      }
      return best
    },
  }
}
```

## GJK 核心逻辑

GJK 维护一个单纯形（simplex）——点、线段或三角形。每一步往单纯形里加一个新点，然后判断原点是否在单纯形内或附近。

```ts
interface Simplex {
  points: Vec2[]
}

function gjk(a: Shape, b: Shape): boolean {
  const simplex: Vec2[] = []
  let direction = { x: 1, y: 0 }

  simplex.push(supportMinkowski(a, b, direction))
  direction = { x: -simplex[0].x, y: -simplex[0].y }

  for (let i = 0; i < 30; i++) {
    const point = supportMinkowski(a, b, direction)
    if (point.x * direction.x + point.y * direction.y < 0) return false

    simplex.push(point)

    if (handleSimplex(simplex, direction)) return true
  }

  return false
}
```

每一步：沿当前方向找 Minkowski 差上的一个新点。如果新点在方向上的投影是负的，说明已经"走过头了"，原点不在 Minkowski 差内，没有碰撞。

## 单纯形处理

```ts
function handleSimplex(simplex: Vec2[], direction: Vec2): boolean {
  if (simplex.length === 2) {
    return handleLine(simplex, direction)
  }
  return handleTriangle(simplex, direction)
}

function handleLine(simplex: Vec2[], direction: Vec2): boolean {
  const b = simplex[1]
  const a = simplex[0]
  const ab = { x: b.x - a.x, y: b.y - a.y }
  const ao = { x: -a.x, y: -a.y }

  if (dot(ab, ao) > 0) {
    direction.x = cross(cross(ab, ao), ab).y * -1
    direction.y = cross(cross(ab, ao), ab).x
  } else {
    simplex.length = 0
    simplex.push(a)
    direction.x = ao.x
    direction.y = ao.y
  }
  return false
}

function handleTriangle(simplex: Vec2[], direction: Vec2): boolean {
  const c = simplex[2]
  const b = simplex[1]
  const a = simplex[0]
  const ab = { x: b.x - a.x, y: b.y - a.y }
  const ac = { x: c.x - a.x, y: c.y - a.y }
  const ao = { x: -a.x, y: -a.y }

  const abPerp = tripleCross(ac, ab, ab)
  const acPerp = tripleCross(ab, ac, ac)

  if (dot(abPerp, ao) > 0) {
    simplex.length = 0
    simplex.push(a, b)
    direction.x = abPerp.x
    direction.y = abPerp.y
    return false
  }

  if (dot(acPerp, ao) > 0) {
    simplex.length = 0
    simplex.push(a, c)
    direction.x = acPerp.x
    direction.y = acPerp.y
    return false
  }

  return true
}

function dot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y }
function cross(a: Vec2, b: Vec2): number { return a.x * b.y - a.y * b.x }
function tripleCross(a: Vec2, b: Vec2, c: Vec2): Vec2 {
  const z = a.x * b.y - a.y * b.x
  return { x: -c.y * z, y: c.x * z }
}
```

三角形处理的核心是判断原点在三角形的哪一侧。如果在三条边的内侧，就是碰撞了。

## EPA 扩展：获取碰撞信息

GJK 只能告诉你"碰没碰"。要获取穿透深度和碰撞法线，需要 EPA（Expanding Polytope Algorithm）。

EPA 的思路是：GJK 结束时的三角形在 Minkowski 差内部，不断沿最近的边向外扩展，直到逼近边界。原点到边界的距离就是穿透深度，方向就是碰撞法线。

```ts
function epa(a: Shape, b: Shape, simplex: Vec2[]): SATResult | null {
  const polytope = [...simplex]

  for (let iteration = 0; iteration < 30; iteration++) {
    let minDist = Infinity
    let minIndex = 0
    let minNormal = { x: 0, y: 0 }

    for (let i = 0; i < polytope.length; i++) {
      const j = (i + 1) % polytope.length
      const edge = { x: polytope[j].x - polytope[i].x, y: polytope[j].y - polytope[i].y }
      let normal = { x: edge.y, y: -edge.x }
      const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y)
      normal.x /= len
      normal.y /= len

      const dist = dot(normal, polytope[i])

      if (dist < 0) {
        normal.x = -normal.x
        normal.y = -normal.y
      }

      if (Math.abs(dist) < Math.abs(minDist)) {
        minDist = Math.abs(dist)
        minIndex = j
        minNormal = normal
      }
    }

    const support = supportMinkowski(a, b, minNormal)
    const supportDist = dot(minNormal, support)

    if (Math.abs(supportDist - minDist) < 0.001) {
      return { normal: minNormal, depth: supportDist }
    }

    polytope.splice(minIndex, 0, support)
  }

  return null
}
```

## 圆形的 Support 函数

GJK 对圆形特别优雅——圆形的 Support 函数只需要归一化方向乘以半径：

```ts
function createCircleShape(cx: number, cy: number, radius: number): Shape {
  return {
    support(d: Vec2): Vec2 {
      const len = Math.sqrt(d.x * d.x + d.y * d.y)
      return { x: cx + (d.x / len) * radius, y: cy + (d.y / len) * radius }
    },
  }
}
```

同一个 GJK 函数可以检测圆-圆、圆-多边形、多边形-多边形的碰撞。不需要为每种形状组合写专门的检测函数。

## 完整示例：GJK 可视化

```ts
const canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 400
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

const circle = createCircleShape(200, 200, 50)
let triAngle = 0

function loop() {
  triAngle += 0.02
  const tri = createTriangleShape(350, 200, 60, triAngle)

  const colliding = gjk(circle, tri)

  ctx.clearRect(0, 0, 600, 400)

  ctx.fillStyle = colliding ? '#ff4444' : '#4a9eff'
  ctx.beginPath()
  ctx.arc(200, 200, 50, 0, Math.PI * 2)
  ctx.fill()

  const verts = [0, 1, 2].map(i => {
    const a = triAngle + (Math.PI * 2 * i) / 3
    return { x: 350 + 60 * Math.cos(a), y: 200 + 60 * Math.sin(a) }
  })
  ctx.fillStyle = colliding ? '#ff4444' : '#44bb44'
  ctx.beginPath()
  ctx.moveTo(verts[0].x, verts[0].y)
  ctx.lineTo(verts[1].x, verts[1].y)
  ctx.lineTo(verts[2].x, verts[2].y)
  ctx.closePath()
  ctx.fill()

  requestAnimationFrame(loop)
}
loop()
```

## 常见错误

**Support 函数方向算反**。Support 应该返回方向上最远的点，不是最近的。方向取反会导致 GJK 永远不收敛。

**EPA 的 polytope 退化**。如果 GJK 给出的初始单纯形是退化的（三个点共线），EPA 会出问题。需要确保初始单纯形是一个真正的三角形。

**迭代次数不够**。GJK 通常 10 步内收敛，EPA 需要更多。如果形状非常扁或者非常接近，可能需要更多迭代。

## 练习

### 练习一：GJK 步进可视化

把 GJK 的每一步都画出来——当前单纯形、当前搜索方向、新采样的 Support 点。用按钮控制步进。

### 练习二：圆-多边形碰撞

用 GJK 实现圆形和任意凸多边形的碰撞检测，用 EPA 获取碰撞信息。对比和专门的圆-多边形检测函数的结果是否一致。

---

## 参考答案

### 练习一

步进可视化的核心改造是把 GJK 改成生成器函数，每步 yield 当前状态：

```ts
function* gjkSteps(a: Shape, b: Shape) {
  const simplex: Vec2[] = []
  let direction = { x: 1, y: 0 }
  simplex.push(supportMinkowski(a, b, direction))
  direction = { x: -simplex[0].x, y: -simplex[0].y }
  yield { simplex: [...simplex], direction: { ...direction }, done: false }

  for (let i = 0; i < 30; i++) {
    const point = supportMinkowski(a, b, direction)
    if (point.x * direction.x + point.y * direction.y < 0) {
      yield { simplex: [...simplex], direction: { ...direction }, done: true, result: false }
      return
    }
    simplex.push(point)
    if (handleSimplex(simplex, direction)) {
      yield { simplex: [...simplex], direction: { ...direction }, done: true, result: true }
      return
    }
    yield { simplex: [...simplex], direction: { ...direction }, done: false }
  }
}
```

每帧（或每次点击按钮）调用 `step.next()`，画出当前的 simplex 和 direction。

### 练习二

GJK + EPA 和专门的圆-多边形检测应该给出相同的法线和深度（误差在浮点精度范围内）。如果结果不一致，通常是 EPA 的精度问题——可以增加 EPA 的迭代次数或用更小的收敛阈值。
