# 2D 物理引擎架构——World/Body/Shape/Constraint 的设计

## 为什么需要架构

前面四阶段的代码是零散的函数和数据结构。要构建一个可用的物理引擎，需要把这些组织成清晰的模块。

好的架构不是为了"设计模式"，而是为了让：
- 添加新形状只需要写一个类
- 添加新约束只需要实现一个接口
- 碰撞检测和物理模拟解耦
- 渲染代码不侵入物理核心

## 核心类型

```ts
interface Vec2 {
  x: number
  y: number
}

function vec2(x: number, y: number): Vec2 { return { x, y } }
function v2Add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y } }
function v2Sub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y } }
function v2Scale(v: Vec2, s: number): Vec2 { return { x: v.x * s, y: v.y * s } }
function v2Dot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y }
function v2Cross(a: Vec2, b: Vec2): number { return a.x * b.y - a.y * b.x }
function v2Len(v: Vec2): number { return Math.sqrt(v.x * v.x + v.y * v.y) }
function v2Norm(v: Vec2): Vec2 { const l = v2Len(v); return l > 0 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 } }
```

## Shape 抽象

```ts
type ShapeType = 'circle' | 'polygon'

interface Shape {
  type: ShapeType
  body: RigidBody
  computeAABB(): AABB
  computeMass(density: number): { mass: number; inertia: number }
}

interface AABB { minX: number; minY: number; maxX: number; maxY: number }
```

### Circle Shape

```ts
class CircleShape implements Shape {
  type: 'circle' = 'circle'
  body!: RigidBody
  radius: number

  constructor(radius: number) {
    this.radius = radius
  }

  computeAABB(): AABB {
    const p = this.body.position
    return {
      minX: p.x - this.radius, minY: p.y - this.radius,
      maxX: p.x + this.radius, maxY: p.y + this.radius,
    }
  }

  computeMass(density: number) {
    const mass = density * Math.PI * this.radius * this.radius
    return { mass, inertia: 0.5 * mass * this.radius * this.radius }
  }
}
```

### Polygon Shape

```ts
class PolygonShape implements Shape {
  type: 'polygon' = 'polygon'
  body!: RigidBody
  vertices: Vec2[]

  constructor(vertices: Vec2[]) {
    this.vertices = vertices
  }

  computeAABB(): AABB {
    const cos = Math.cos(this.body.angle)
    const sin = Math.sin(this.body.angle)
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity
    for (const v of this.vertices) {
      const wx = this.body.position.x + v.x * cos - v.y * sin
      const wy = this.body.position.y + v.x * sin + v.y * cos
      if (wx < minX) minX = wx
      if (wy < minY) minY = wy
      if (wx > maxX) maxX = wx
      if (wy > maxY) maxY = wy
    }
    return { minX, minY, maxX, maxY }
  }

  computeMass(density: number) {
    let area = 0
    let inertia = 0
    const n = this.vertices.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const cross = Math.abs(v2Cross(this.vertices[i], this.vertices[j]))
      area += cross
      inertia += cross * (
        v2Dot(this.vertices[i], this.vertices[i]) +
        v2Dot(this.vertices[i], this.vertices[j]) +
        v2Dot(this.vertices[j], this.vertices[j])
      )
    }
    area /= 2
    const mass = density * area
    inertia = (mass * inertia) / (6 * area)
    return { mass, inertia }
  }
}
```

## RigidBody

```ts
class RigidBody {
  position: Vec2
  velocity: Vec2
  angle: number
  angularVelocity: number
  force: Vec2
  torque: number
  mass: number
  inverseMass: number
  inertia: number
  inverseInertia: number
  shape: Shape
  restitution: number
  friction: number
  isStatic: boolean

  constructor(shape: Shape, x: number, y: number, density: number, isStatic = false) {
    this.position = vec2(x, y)
    this.velocity = vec2(0, 0)
    this.angle = 0
    this.angularVelocity = 0
    this.force = vec2(0, 0)
    this.torque = 0
    this.isStatic = isStatic
    this.restitution = 0.3
    this.friction = 0.4
    this.shape = shape
    shape.body = this

    if (isStatic) {
      this.mass = 0
      this.inverseMass = 0
      this.inertia = 0
      this.inverseInertia = 0
    } else {
      const massInfo = shape.computeMass(density)
      this.mass = massInfo.mass
      this.inverseMass = 1 / this.mass
      this.inertia = massInfo.inertia
      this.inverseInertia = 1 / this.inertia
    }
  }

  applyForce(force: Vec2, worldPoint?: Vec2): void {
    this.force = v2Add(this.force, force)
    if (worldPoint) {
      const r = v2Sub(worldPoint, this.position)
      this.torque += v2Cross(r, force)
    }
  }

  integrate(dt: number, gravity: Vec2): void {
    if (this.isStatic) return

    this.velocity = v2Add(this.velocity, v2Scale(gravity, dt))
    this.velocity = v2Add(this.velocity, v2Scale(this.force, this.inverseMass * dt))
    this.angularVelocity += this.torque * this.inverseInertia * dt

    this.position = v2Add(this.position, v2Scale(this.velocity, dt))
    this.angle += this.angularVelocity * dt

    this.force = vec2(0, 0)
    this.torque = 0
  }
}
```

## Constraint 接口

```ts
interface Constraint {
  solve(dt: number): void
}

class DistanceConstraint implements Constraint {
  bodyA: RigidBody
  bodyB: RigidBody
  anchorA: Vec2
  anchorB: Vec2
  distance: number
  stiffness: number

  constructor(a: RigidBody, b: RigidBody, anchorA: Vec2, anchorB: Vec2, distance: number, stiffness = 1) {
    this.bodyA = a
    this.bodyB = b
    this.anchorA = anchorA
    this.anchorB = anchorB
    this.distance = distance
    this.stiffness = stiffness
  }

  solve(dt: number): void {
    const worldA = this.getWorldAnchor(this.bodyA, this.anchorA)
    const worldB = this.getWorldAnchor(this.bodyB, this.anchorB)
    const diff = v2Sub(worldB, worldA)
    const dist = v2Len(diff)
    if (dist === 0) return

    const correction = (dist - this.distance) / dist * this.stiffness
    const totalInvMass = this.bodyA.inverseMass + this.bodyB.inverseMass
    if (totalInvMass === 0) return

    const ratioA = this.bodyA.inverseMass / totalInvMass
    const ratioB = this.bodyB.inverseMass / totalInvMass

    this.bodyA.position = v2Add(this.bodyA.position, v2Scale(diff, correction * ratioA))
    this.bodyB.position = v2Sub(this.bodyB.position, v2Scale(diff, correction * ratioB))
  }

  private getWorldAnchor(body: RigidBody, local: Vec2): Vec2 {
    const cos = Math.cos(body.angle)
    const sin = Math.sin(body.angle)
    return {
      x: body.position.x + local.x * cos - local.y * sin,
      y: body.position.y + local.x * sin + local.y * cos,
    }
  }
}
```

## World

```ts
class World {
  bodies: RigidBody[] = []
  constraints: Constraint[] = []
  gravity: Vec2
  broadPhaseGrid: UniformGrid

  constructor(gravity: Vec2 = vec2(0, 500)) {
    this.gravity = gravity
    this.broadPhaseGrid = new UniformGrid(1000, 1000, 50)
  }

  addBody(body: RigidBody): void {
    this.bodies.push(body)
  }

  addConstraint(constraint: Constraint): void {
    this.constraints.push(constraint)
  }

  step(dt: number): void {
    for (const body of this.bodies) {
      body.integrate(dt, this.gravity)
    }

    for (let iter = 0; iter < 4; iter++) {
      for (const constraint of this.constraints) {
        constraint.solve(dt)
      }
    }

    const pairs = this.broadPhase()
    this.resolveCollisions(pairs)
  }

  private broadPhase(): [number, number][] {
    this.broadPhaseGrid.clear()
    for (let i = 0; i < this.bodies.length; i++) {
      this.broadPhaseGrid.insert(i, this.bodies[i].shape.computeAABB())
    }
    return this.broadPhaseGrid.queryPairs()
  }

  private resolveCollisions(pairs: [number, number][]): void {
    for (const [i, j] of pairs) {
      const a = this.bodies[i]
      const b = this.bodies[j]
      const contact = this.detectCollision(a, b)
      if (contact) {
        this.resolveContact(a, b, contact)
      }
    }
  }

  private detectCollision(a: RigidBody, b: RigidBody): Contact | null {
    if (a.shape.type === 'circle' && b.shape.type === 'circle') {
      return this.circleVsCircle(a, b)
    }
    return null
  }

  private circleVsCircle(a: RigidBody, b: RigidBody): Contact | null {
    const csA = a.shape as CircleShape
    const csB = b.shape as CircleShape
    const dx = b.position.x - a.position.x
    const dy = b.position.y - a.position.y
    const distSq = dx * dx + dy * dy
    const rSum = csA.radius + csB.radius
    if (distSq >= rSum * rSum) return null
    const dist = Math.sqrt(distSq)
    const normal = dist > 0 ? { x: dx / dist, y: dy / dist } : { x: 1, y: 0 }
    return {
      point: { x: a.position.x + normal.x * csA.radius, y: a.position.y + normal.y * csA.radius },
      normal,
      penetration: rSum - dist,
    }
  }

  private resolveContact(a: RigidBody, b: RigidBody, contact: Contact): void {
    const ra = v2Sub(contact.point, a.position)
    const rb = v2Sub(contact.point, b.position)
    const rv = v2Sub(
      v2Sub(b.velocity, v2Scale(vec2(-rb.y, rb.x), b.angularVelocity)),
      v2Sub(a.velocity, v2Scale(vec2(-ra.y, ra.x), a.angularVelocity)),
    )
    const vn = v2Dot(rv, contact.normal)
    if (vn > 0) return

    const raCrossN = v2Cross(ra, contact.normal)
    const rbCrossN = v2Cross(rb, contact.normal)
    const invMassSum = a.inverseMass + b.inverseMass +
      raCrossN * raCrossN * a.inverseInertia +
      rbCrossN * rbCrossN * b.inverseInertia

    const restitution = Math.max(a.restitution, b.restitution)
    const jn = -(1 + restitution) * vn / invMassSum
    const impulse = v2Scale(contact.normal, jn)

    a.velocity = v2Sub(a.velocity, v2Scale(impulse, a.inverseMass))
    a.angularVelocity -= v2Cross(ra, impulse) * a.inverseInertia
    b.velocity = v2Add(b.velocity, v2Scale(impulse, b.inverseMass))
    b.angularVelocity += v2Cross(rb, impulse) * b.inverseInertia

    a.position = v2Sub(a.position, v2Scale(contact.normal, contact.penetration * a.inverseMass / (a.inverseMass + b.inverseMass)))
    b.position = v2Add(b.position, v2Scale(contact.normal, contact.penetration * b.inverseMass / (a.inverseMass + b.inverseMass)))
  }
}

interface Contact {
  point: Vec2
  normal: Vec2
  penetration: number
}
```

## 使用方式

```ts
const world = new World(vec2(0, 500))

const ground = world.addBody(new RigidBody(
  new PolygonShape([
    { x: -400, y: -20 }, { x: 400, y: -20 },
    { x: 400, y: 20 }, { x: -400, y: 20 },
  ]),
  400, 580, 1, true,
))

for (let i = 0; i < 20; i++) {
  world.addBody(new RigidBody(
    new CircleShape(10 + Math.random() * 10),
    Math.random() * 600 + 100,
    Math.random() * 200 + 50,
    1,
  ))
}

function loop() {
  world.step(1 / 60)
  // render...
  requestAnimationFrame(loop)
}
loop()
```

## 扩展点

添加新形状：实现 `Shape` 接口，在 `World.detectCollision` 中添加新的分支。

添加新约束：实现 `Constraint` 接口，添加到 `World.constraints`。

添加新碰撞检测：在 `detectCollision` 中根据 shape type 组合选择检测函数。

## 常见错误

**Shape 和 Body 的引用循环**。Shape 持有 Body 的引用，Body 也持有 Shape 的引用。构造时要注意顺序。

**AABB 没有每帧更新**。物体移动后 AABB 必须重新计算。在 `broadPhase` 调用前统一更新。

**碰撞响应的位置修正和冲量顺序**。先修正位置，再施加冲量。否则接触点位置不对。
