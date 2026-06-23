# 阶段实战：构建一个完整的 2D 物理引擎并展示

## 目标

把前 24 课的所有内容整合成一个完整的、可展示的 2D 物理引擎。这个引擎要能：

- 处理圆形、矩形、凸多边形的碰撞
- 支持刚体动力学（质量、力、冲量、旋转）
- 支持约束（距离约束、弹簧）
- 使用空间分区优化碰撞检测
- 有可视化调试工具
- 有一个展示场景

## 引擎文件结构

```
physics-engine/
├── src/
│   ├── math.ts          # Vec2, AABB, 矩阵运算
│   ├── shape.ts         # CircleShape, PolygonShape
│   ├── body.ts          # RigidBody
│   ├── collision.ts     # 碰撞检测（AABB, 圆, 多边形, SAT, GJK）
│   ├── contact.ts       # Contact, 碰撞响应
│   ├── constraint.ts    # DistanceConstraint, SpringConstraint
│   ├── broadphase.ts    # UniformGrid, SpatialHash, BVH
│   ├── world.ts         # World（核心循环）
│   ├── renderer.ts      # CanvasRenderer
│   ├── debug.ts         # DebugOverlay
│   └── index.ts         # 导出
├── demo/
│   └── main.ts          # 展示场景
└── package.json
```

## 核心模块

### math.ts

```ts
export interface Vec2 { x: number; y: number }
export interface AABB { minX: number; minY: number; maxX: number; maxY: number }

export const v2 = {
  create: (x: number, y: number): Vec2 => ({ x, y }),
  add: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y }),
  scale: (v: Vec2, s: number): Vec2 => ({ x: v.x * s, y: v.y * s }),
  dot: (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y,
  cross: (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x,
  len: (v: Vec2): number => Math.sqrt(v.x * v.x + v.y * v.y),
  lenSq: (v: Vec2): number => v.x * v.x + v.y * v.y,
  norm: (v: Vec2): Vec2 => { const l = v2.len(v); return l > 0 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 } },
  rotate: (v: Vec2, angle: number): Vec2 => {
    const c = Math.cos(angle), s = Math.sin(angle)
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }
  },
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}

export function mergeAABB(a: AABB, b: AABB): AABB {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}
```

### shape.ts

```ts
import { Vec2, AABB, v2 } from './math'

export interface Shape {
  type: 'circle' | 'polygon'
  computeAABB(position: Vec2, angle: number): AABB
  computeMass(density: number): { mass: number; inertia: number }
}

export class CircleShape implements Shape {
  type = 'circle' as const
  constructor(public radius: number) {}

  computeAABB(position: Vec2): AABB {
    return {
      minX: position.x - this.radius, minY: position.y - this.radius,
      maxX: position.x + this.radius, maxY: position.y + this.radius,
    }
  }

  computeMass(density: number) {
    const mass = density * Math.PI * this.radius * this.radius
    return { mass, inertia: 0.5 * mass * this.radius * this.radius }
  }
}

export class PolygonShape implements Shape {
  type = 'polygon' as const
  vertices: Vec2[]

  constructor(vertices: Vec2[]) {
    this.vertices = vertices
  }

  getWorldVertices(position: Vec2, angle: number): Vec2[] {
    return this.vertices.map(v => v2.add(position, v2.rotate(v, angle)))
  }

  computeAABB(position: Vec2, angle: number): AABB {
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity
    for (const v of this.vertices) {
      const w = v2.add(position, v2.rotate(v, angle))
      if (w.x < minX) minX = w.x
      if (w.y < minY) minY = w.y
      if (w.x > maxX) maxX = w.x
      if (w.y > maxY) maxY = w.y
    }
    return { minX, minY, maxX, maxY }
  }

  computeMass(density: number) {
    let area = 0, inertia = 0
    const n = this.vertices.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const cross = Math.abs(v2.cross(this.vertices[i], this.vertices[j]))
      area += cross
      inertia += cross * (
        v2.dot(this.vertices[i], this.vertices[i]) +
        v2.dot(this.vertices[i], this.vertices[j]) +
        v2.dot(this.vertices[j], this.vertices[j])
      )
    }
    area /= 2
    const mass = density * area
    return { mass, inertia: (mass * inertia) / (6 * area) }
  }

  static box(width: number, height: number): PolygonShape {
    const hw = width / 2, hh = height / 2
    return new PolygonShape([
      { x: -hw, y: -hh }, { x: hw, y: -hh },
      { x: hw, y: hh }, { x: -hw, y: hh },
    ])
  }

  static regularPolygon(radius: number, sides: number): PolygonShape {
    const verts: Vec2[] = []
    for (let i = 0; i < sides; i++) {
      const a = (Math.PI * 2 * i) / sides
      verts.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) })
    }
    return new PolygonShape(verts)
  }
}
```

### body.ts

```ts
import { Vec2, v2 } from './math'
import { Shape } from './shape'

export class RigidBody {
  position: Vec2
  velocity: Vec2
  angle = 0
  angularVelocity = 0
  force: Vec2 = { x: 0, y: 0 }
  torque = 0
  mass: number
  inverseMass: number
  inertia: number
  inverseInertia: number
  restitution: number
  friction: number
  isStatic: boolean
  shape: Shape

  constructor(shape: Shape, x: number, y: number, density: number, isStatic = false) {
    this.position = { x, y }
    this.velocity = { x: 0, y: 0 }
    this.isStatic = isStatic
    this.restitution = 0.3
    this.friction = 0.4
    this.shape = shape

    if (isStatic) {
      this.mass = this.inverseMass = this.inertia = this.inverseInertia = 0
    } else {
      const info = shape.computeMass(density)
      this.mass = info.mass
      this.inverseMass = 1 / this.mass
      this.inertia = info.inertia
      this.inverseInertia = 1 / this.inertia
    }
  }

  applyForce(force: Vec2, worldPoint?: Vec2): void {
    this.force = v2.add(this.force, force)
    if (worldPoint) {
      this.torque += v2.cross(v2.sub(worldPoint, this.position), force)
    }
  }

  integrate(dt: number, gravity: Vec2): void {
    if (this.isStatic) return
    this.velocity = v2.add(this.velocity, v2.scale(gravity, dt))
    this.velocity = v2.add(this.velocity, v2.scale(this.force, this.inverseMass * dt))
    this.angularVelocity += this.torque * this.inverseInertia * dt
    this.position = v2.add(this.position, v2.scale(this.velocity, dt))
    this.angle += this.angularVelocity * dt
    this.force = { x: 0, y: 0 }
    this.torque = 0
  }
}
```

### broadphase.ts

```ts
import { AABB, aabbOverlap } from './math'

export class UniformGrid {
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

  clear(): void { for (const c of this.cells) c.length = 0 }

  insert(id: number, aabb: AABB): void {
    const minC = Math.max(0, Math.floor(aabb.minX / this.cellSize))
    const maxC = Math.min(this.cols - 1, Math.floor(aabb.maxX / this.cellSize))
    const minR = Math.max(0, Math.floor(aabb.minY / this.cellSize))
    const maxR = Math.min(this.rows - 1, Math.floor(aabb.maxY / this.cellSize))
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++)
        this.cells[r * this.cols + c].push(id)
  }

  queryPairs(): [number, number][] {
    const seen = new Set<string>()
    const pairs: [number, number][] = []
    for (const cell of this.cells) {
      for (let i = 0; i < cell.length; i++) {
        for (let j = i + 1; j < cell.length; j++) {
          const a = Math.min(cell[i], cell[j])
          const b = Math.max(cell[i], cell[j])
          const key = `${a}-${b}`
          if (!seen.has(key)) { seen.add(key); pairs.push([a, b]) }
        }
      }
    }
    return pairs
  }
}
```

### world.ts

```ts
import { Vec2, v2 } from './math'
import { RigidBody } from './body'
import { CircleShape, PolygonShape } from './shape'
import { UniformGrid } from './broadphase'

export interface Contact {
  point: Vec2
  normal: Vec2
  penetration: number
}

export class World {
  bodies: RigidBody[] = []
  gravity: Vec2
  grid: UniformGrid
  iterations = 4

  constructor(gravity: Vec2 = { x: 0, y: 500 }, width = 1000, height = 1000, cellSize = 50) {
    this.gravity = gravity
    this.grid = new UniformGrid(width, height, cellSize)
  }

  addBody(body: RigidBody): RigidBody {
    this.bodies.push(body)
    return body
  }

  step(dt: number): void {
    for (const body of this.bodies) body.integrate(dt, this.gravity)

    this.grid.clear()
    for (let i = 0; i < this.bodies.length; i++) {
      this.grid.insert(i, this.bodies[i].shape.computeAABB(this.bodies[i].position, this.bodies[i].angle))
    }

    const pairs = this.grid.queryPairs()
    for (const [i, j] of pairs) {
      const contact = this.detect(this.bodies[i], this.bodies[j])
      if (contact) this.resolve(this.bodies[i], this.bodies[j], contact)
    }
  }

  private detect(a: RigidBody, b: RigidBody): Contact | null {
    if (a.shape.type === 'circle' && b.shape.type === 'circle') {
      return this.circleVsCircle(a, b)
    }
    if (a.shape.type === 'polygon' && b.shape.type === 'polygon') {
      return this.satPolygon(a, b)
    }
    return this.circleVsPolygon(
      a.shape.type === 'circle' ? a : b,
      a.shape.type === 'polygon' ? a : b,
    )
  }

  private circleVsCircle(a: RigidBody, b: RigidBody): Contact | null {
    const ra = (a.shape as CircleShape).radius
    const rb = (b.shape as CircleShape).radius
    const d = v2.sub(b.position, a.position)
    const distSq = v2.lenSq(d)
    const rSum = ra + rb
    if (distSq >= rSum * rSum) return null
    const dist = Math.sqrt(distSq)
    const n = dist > 0 ? v2.scale(d, 1 / dist) : { x: 1, y: 0 }
    return { point: v2.add(a.position, v2.scale(n, ra)), normal: n, penetration: rSum - dist }
  }

  private satPolygon(a: RigidBody, b: RigidBody): Contact | null {
    const shapeA = a.shape as PolygonShape
    const shapeB = b.shape as PolygonShape
    const vertsA = shapeA.getWorldVertices(a.position, a.angle)
    const vertsB = shapeB.getWorldVertices(b.position, b.angle)

    let minDepth = Infinity
    let bestNormal = { x: 0, y: 0 }

    const checkAxes = (verts: Vec2[]) => {
      for (let i = 0; i < verts.length; i++) {
        const j = (i + 1) % verts.length
        const edge = v2.sub(verts[j], verts[i])
        const axis = v2.norm({ x: -edge.y, y: edge.x })

        let minA = Infinity, maxA = -Infinity
        for (const v of vertsA) { const p = v2.dot(v, axis); if (p < minA) minA = p; if (p > maxA) maxA = p }
        let minB = Infinity, maxB = -Infinity
        for (const v of vertsB) { const p = v2.dot(v, axis); if (p < minB) minB = p; if (p > maxB) maxB = p }

        const overlap = Math.min(maxA - minB, maxB - minA)
        if (overlap <= 0) return false
        if (overlap < minDepth) { minDepth = overlap; bestNormal = axis }
      }
      return true
    }

    if (!checkAxes(vertsA)) return null
    if (!checkAxes(vertsB)) return null

    const d = v2.sub(b.position, a.position)
    if (v2.dot(d, bestNormal) < 0) bestNormal = v2.scale(bestNormal, -1)

    return { point: v2.add(a.position, v2.scale(bestNormal, 0)), normal: bestNormal, penetration: minDepth }
  }

  private circleVsPolygon(circleBody: RigidBody, polyBody: RigidBody): Contact | null {
    const circle = circleBody.shape as CircleShape
    const poly = polyBody.shape as PolygonShape
    const verts = poly.getWorldVertices(polyBody.position, polyBody.angle)

    let minDepth = Infinity
    let bestNormal = { x: 0, y: 0 }

    for (let i = 0; i < verts.length; i++) {
      const j = (i + 1) % verts.length
      const edge = v2.sub(verts[j], verts[i])
      const axis = v2.norm({ x: -edge.y, y: edge.x })

      let minV = Infinity, maxV = -Infinity
      for (const v of verts) { const p = v2.dot(v, axis); if (p < minV) minV = p; if (p > maxV) maxV = p }
      const projCenter = v2.dot(circleBody.position, axis)
      const projRadius = circle.radius
      const overlap = Math.min(projCenter + projRadius - minV, maxV - (projCenter - projRadius))
      if (overlap <= 0) return null
      if (overlap < minDepth) { minDepth = overlap; bestNormal = axis }
    }

    const d = v2.sub(circleBody.position, polyBody.position)
    if (v2.dot(d, bestNormal) < 0) bestNormal = v2.scale(bestNormal, -1)

    return {
      point: v2.add(circleBody.position, v2.scale(bestNormal, -circle.radius)),
      normal: bestNormal,
      penetration: minDepth,
    }
  }

  private resolve(a: RigidBody, b: RigidBody, contact: Contact): void {
    const ra = v2.sub(contact.point, a.position)
    const rb = v2.sub(contact.point, b.position)
    const rv = v2.sub(
      v2.sub(b.velocity, v2.scale({ x: -rb.y, y: rb.x }, b.angularVelocity)),
      v2.sub(a.velocity, v2.scale({ x: -ra.y, y: ra.x }, a.angularVelocity)),
    )
    const vn = v2.dot(rv, contact.normal)
    if (vn > 0) return

    const raCrossN = v2.cross(ra, contact.normal)
    const rbCrossN = v2.cross(rb, contact.normal)
    const invMassSum = a.inverseMass + b.inverseMass +
      raCrossN * raCrossN * a.inverseInertia +
      rbCrossN * rbCrossN * b.inverseInertia

    const e = Math.max(a.restitution, b.restitution)
    const jn = -(1 + e) * vn / invMassSum
    const impulse = v2.scale(contact.normal, jn)

    a.velocity = v2.sub(a.velocity, v2.scale(impulse, a.inverseMass))
    a.angularVelocity -= v2.cross(ra, impulse) * a.inverseInertia
    b.velocity = v2.add(b.velocity, v2.scale(impulse, b.inverseMass))
    b.angularVelocity += v2.cross(rb, impulse) * b.inverseInertia

    const totalInv = a.inverseMass + b.inverseMass
    if (totalInv > 0) {
      a.position = v2.sub(a.position, v2.scale(contact.normal, contact.penetration * a.inverseMass / totalInv))
      b.position = v2.add(b.position, v2.scale(contact.normal, contact.penetration * b.inverseMass / totalInv))
    }
  }
}
```

## 展示场景

```ts
import { World } from './src/world'
import { RigidBody } from './src/body'
import { CircleShape, PolygonShape } from './src/shape'

const canvas = document.createElement('canvas')
canvas.width = 800
canvas.height = 600
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

const world = new World({ x: 0, y: 500 }, 800, 600, 40)

world.addBody(new RigidBody(PolygonShape.box(800, 40), 400, 580, 1, true))
world.addBody(new RigidBody(PolygonShape.box(40, 600), 10, 300, 1, true))
world.addBody(new RigidBody(PolygonShape.box(40, 600), 790, 300, 1, true))

for (let i = 0; i < 30; i++) {
  const r = 8 + Math.random() * 12
  world.addBody(new RigidBody(
    new CircleShape(r),
    Math.random() * 600 + 100, Math.random() * 300 + 50, 1,
  ))
}

for (let i = 0; i < 10; i++) {
  const s = 15 + Math.random() * 15
  world.addBody(new RigidBody(
    PolygonShape.regularPolygon(s, Math.floor(Math.random() * 3) + 3),
    Math.random() * 600 + 100, Math.random() * 300 + 50, 1,
  ))
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect()
  world.addBody(new RigidBody(
    new CircleShape(12),
    e.clientX - rect.left, e.clientY - rect.top, 1,
  ))
})

let lastTime = 0
let accumulator = 0
const DT = 1 / 60

function loop(time: number): void {
  const frame = Math.min((time - lastTime) / 1000, 0.1)
  lastTime = time
  accumulator += frame

  while (accumulator >= DT) {
    world.step(DT)
    accumulator -= DT
  }

  ctx.clearRect(0, 0, 800, 600)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, 800, 600)

  for (const body of world.bodies) {
    ctx.save()
    ctx.translate(body.position.x, body.position.y)
    ctx.rotate(body.angle)

    if (body.shape.type === 'circle') {
      ctx.fillStyle = body.isStatic ? '#555' : '#4a9eff'
      ctx.beginPath()
      ctx.arc(0, 0, (body.shape as CircleShape).radius, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = body.isStatic ? '#555' : '#6bc5ff'
      ctx.beginPath()
      const verts = (body.shape as PolygonShape).vertices
      ctx.moveTo(verts[0].x, verts[0].y)
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y)
      ctx.closePath()
      ctx.fill()
    }

    ctx.restore()
  }

  ctx.fillStyle = '#fff'
  ctx.font = '12px monospace'
  ctx.fillText(`Bodies: ${world.bodies.length} | Click to add`, 10, 20)

  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
```

## 验证清单

运行前检查：

- [ ] 圆形碰撞不穿透
- [ ] 多边形碰撞不穿透
- [ ] 旋转物体碰撞后有角速度变化
- [ ] 堆叠场景不抖动
- [ ] 500+ 物体时帧率 > 30fps
- [ ] 点击创建物体不卡顿
- [ ] 空间分区正确过滤了远距离物体对

## 后续扩展

这个引擎覆盖了 2D 物理的核心。可以继续添加：

- 凹多边形支持（凸分解）
- CCD（连续碰撞检测）防止高速穿透
- 关节约束（铰链、滑轨）
- 碰撞回调（触发游戏逻辑）
- 物理材质系统
- 布料和软体
- Web Worker 多线程
