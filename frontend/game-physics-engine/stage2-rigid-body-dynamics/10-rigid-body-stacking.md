# 阶段实战：刚体堆叠模拟

## 目标

用前面四课学的动力学知识，做一个刚体堆叠场景：不同形状的物体在重力下落到地面，互相碰撞、堆叠、旋转。

这个项目整合了积分器、力与冲量、旋转动力学和碰撞响应。

## 引擎核心结构

```ts
interface Vec2 { x: number; y: number }

interface RigidBody {
  id: number
  position: Vec2
  velocity: Vec2
  angle: number
  angularVelocity: number
  force: Vec2
  torque: number
  shape: Shape
  isStatic: boolean
}

type Shape = CircleShape | PolygonShape

interface CircleShape {
  type: 'circle'
  radius: number
  mass: number
  inverseMass: number
  inertia: number
  inverseInertia: number
}

interface PolygonShape {
  type: 'polygon'
  vertices: Vec2[]
  normals: Vec2[]
  mass: number
  inverseMass: number
  inertia: number
  inverseInertia: number
}
```

## 创建形状

```ts
function createCircle(radius: number, density: number): CircleShape {
  const mass = density * Math.PI * radius * radius
  const inertia = 0.5 * mass * radius * radius
  return {
    type: 'circle', radius,
    mass, inverseMass: 1 / mass,
    inertia, inverseInertia: 1 / inertia,
  }
}

function createBox(width: number, height: number, density: number): PolygonShape {
  const hw = width / 2, hh = height / 2
  const vertices = [
    { x: -hw, y: -hh }, { x: hw, y: -hh },
    { x: hw, y: hh }, { x: -hw, y: hh },
  ]
  const normals = [
    { x: 0, y: -1 }, { x: 1, y: 0 },
    { x: 0, y: 1 }, { x: -1, y: 0 },
  ]
  const mass = density * width * height
  const inertia = (mass * (width * width + height * height)) / 12
  return {
    type: 'polygon', vertices, normals,
    mass, inverseMass: 1 / mass,
    inertia, inverseInertia: 1 / inertia,
  }
}

function createRegularPolygon(radius: number, sides: number, density: number): PolygonShape {
  const vertices: Vec2[] = []
  const normals: Vec2[] = []
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides
    vertices.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) })
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides
    const ex = vertices[j].x - vertices[i].x
    const ey = vertices[j].y - vertices[i].y
    const len = Math.sqrt(ex * ex + ey * ey)
    normals.push({ x: -ey / len, y: ex / len })
  }
  const area = 0.5 * sides * radius * radius * Math.sin(Math.PI * 2 / sides)
  const mass = density * area
  const inertia = mass * radius * radius / 2
  return {
    type: 'polygon', vertices, normals,
    mass, inverseMass: 1 / mass,
    inertia, inverseInertia: 1 / inertia,
  }
}
```

## 碰撞检测

```ts
interface Contact {
  point: Vec2
  normal: Vec2
  penetration: number
  bodyA: RigidBody
  bodyB: RigidBody
}

function detectShapeCollision(a: RigidBody, b: RigidBody): Contact | null {
  if (a.shape.type === 'circle' && b.shape.type === 'circle') {
    return circleVsCircle(a, b)
  }
  if (a.shape.type === 'polygon' && b.shape.type === 'polygon') {
    return satVsPolygon(a, b)
  }
  if (a.shape.type === 'circle' && b.shape.type === 'polygon') {
    return circleVsPolygon(a, b)
  }
  if (a.shape.type === 'polygon' && b.shape.type === 'circle') {
    const contact = circleVsPolygon(b, a)
    if (contact) {
      contact.normal = { x: -contact.normal.x, y: -contact.normal.y }
      contact.bodyA = a
      contact.bodyB = b
    }
    return contact
  }
  return null
}
```

`circleVsCircle`、`satVsPolygon`、`circleVsPolygon` 的实现参考第一阶段的课程。

## 碰撞响应

```ts
function resolveContact(contact: Contact, restitution: number, friction: number): void {
  const a = contact.bodyA
  const b = contact.bodyB

  const ra = { x: contact.point.x - a.position.x, y: contact.point.y - a.position.y }
  const rb = { x: contact.point.x - b.position.x, y: contact.point.y - b.position.y }

  const rv = {
    x: (b.velocity.x - b.angularVelocity * rb.y) - (a.velocity.x - a.angularVelocity * ra.y),
    y: (b.velocity.y + b.angularVelocity * rb.x) - (a.velocity.y + a.angularVelocity * ra.x),
  }
  const vn = rv.x * contact.normal.x + rv.y * contact.normal.y
  if (vn > 0) return

  const raCrossN = ra.x * contact.normal.y - ra.y * contact.normal.x
  const rbCrossN = rb.x * contact.normal.y - rb.y * contact.normal.x
  const invMassSum = (a.isStatic ? 0 : a.inverseMass) + (b.isStatic ? 0 : b.inverseMass) +
    (a.isStatic ? 0 : raCrossN * raCrossN * a.inverseInertia) +
    (b.isStatic ? 0 : rbCrossN * rbCrossN * b.inverseInertia)

  const jn = -(1 + restitution) * vn / invMassSum
  const impulse = { x: jn * contact.normal.x, y: jn * contact.normal.y }

  if (!a.isStatic) {
    a.velocity.x -= impulse.x * a.inverseMass
    a.velocity.y -= impulse.y * a.inverseMass
    a.angularVelocity -= (ra.x * impulse.y - ra.y * impulse.x) * a.inverseInertia
  }
  if (!b.isStatic) {
    b.velocity.x += impulse.x * b.inverseMass
    b.velocity.y += impulse.y * b.inverseMass
    b.angularVelocity += (rb.x * impulse.y - rb.y * impulse.x) * b.inverseInertia
  }

  const tangentX = rv.x - vn * contact.normal.x
  const tangentY = rv.y - vn * contact.normal.y
  const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY)
  if (tangentLen > 0.001) {
    const tangent = { x: tangentX / tangentLen, y: tangentY / tangentLen }
    const raCrossT = ra.x * tangent.y - ra.y * tangent.x
    const rbCrossT = rb.x * tangent.y - rb.y * tangent.x
    const invMassSumT = (a.isStatic ? 0 : a.inverseMass) + (b.isStatic ? 0 : b.inverseMass) +
      (a.isStatic ? 0 : raCrossT * raCrossT * a.inverseInertia) +
      (b.isStatic ? 0 : rbCrossT * rbCrossT * b.inverseInertia)
    let jt = -(rv.x * tangent.x + rv.y * tangent.y) / invMassSumT
    jt = Math.max(-jn * friction, Math.min(jn * friction, jt))
    const frictionImpulse = { x: jt * tangent.x, y: jt * tangent.y }
    if (!a.isStatic) {
      a.velocity.x -= frictionImpulse.x * a.inverseMass
      a.velocity.y -= frictionImpulse.y * a.inverseMass
      a.angularVelocity -= (ra.x * frictionImpulse.y - ra.y * frictionImpulse.x) * a.inverseInertia
    }
    if (!b.isStatic) {
      b.velocity.x += frictionImpulse.x * b.inverseMass
      b.velocity.y += frictionImpulse.y * b.inverseMass
      b.angularVelocity += (rb.x * frictionImpulse.y - rb.y * frictionImpulse.x) * b.inverseInertia
    }
  }
}
```

## 构建场景

```ts
const canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 500
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

const DT = 1 / 60
const GRAVITY: Vec2 = { x: 0, y: 600 }
const RESTITUTION = 0.3
const FRICTION = 0.5

let nextId = 0
function addBody(
  x: number, y: number, shape: Shape, isStatic = false, angle = 0,
): RigidBody {
  const body: RigidBody = {
    id: nextId++, position: { x, y },
    velocity: { x: 0, y: 0 }, angle, angularVelocity: 0,
    force: { x: 0, y: 0 }, torque: 0,
    shape, isStatic,
  }
  bodies.push(body)
  return body
}

const bodies: RigidBody[] = []

addBody(300, 480, createBox(600, 40, 1), true)
addBody(0, 250, createBox(40, 500, 1), true)
addBody(600, 250, createBox(40, 500, 1), true)

for (let row = 0; row < 5; row++) {
  for (let col = 0; col < 5 - row; col++) {
    const x = 175 + col * 60 + row * 30
    const y = 440 - row * 45
    addBody(x, y, createBox(50, 40, 1))
  }
}

addBody(300, 50, createCircle(20, 1))
```

场景：地面 + 两面墙 + 一摞方块 + 一个从上方落下的球。

## 主循环

```ts
function update() {
  for (const body of bodies) {
    if (body.isStatic) continue
    body.force.x += GRAVITY.x / body.shape.inverseMass
    body.force.y += GRAVITY.y / body.shape.inverseMass
  }

  for (const body of bodies) {
    if (body.isStatic) continue
    body.velocity.x += body.force.x * body.shape.inverseMass * DT
    body.velocity.y += body.force.y * body.shape.inverseMass * DT
    body.angularVelocity += body.torque * body.shape.inverseInertia * DT
    body.position.x += body.velocity.x * DT
    body.position.y += body.velocity.y * DT
    body.angle += body.angularVelocity * DT
    body.force.x = 0
    body.force.y = 0
    body.torque = 0
  }

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      if (bodies[i].isStatic && bodies[j].isStatic) continue
      const contact = detectShapeCollision(bodies[i], bodies[j])
      if (contact) {
        resolveContact(contact, RESTITUTION, FRICTION)
      }
    }
  }
}

function drawBody(body: RigidBody) {
  ctx.save()
  ctx.translate(body.position.x, body.position.y)
  ctx.rotate(body.angle)

  if (body.shape.type === 'circle') {
    ctx.fillStyle = '#4a9eff'
    ctx.beginPath()
    ctx.arc(0, 0, body.shape.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#2a7edf'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(body.shape.radius, 0)
    ctx.stroke()
  } else {
    ctx.fillStyle = body.isStatic ? '#444' : '#6bc5ff'
    ctx.beginPath()
    const verts = body.shape.vertices
    ctx.moveTo(verts[0].x, verts[0].y)
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x, verts[i].y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#2a7edf'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  ctx.restore()
}

function loop() {
  update()
  ctx.clearRect(0, 0, 600, 500)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, 600, 500)
  for (const body of bodies) drawBody(body)
  requestAnimationFrame(loop)
}
loop()
```

## 堆叠稳定性

刚体堆叠最大的问题是"抖动"。底部的方块承受上面所有方块的重量，如果碰撞响应不够精确，方块会在微小的穿透和修正之间来回振荡。

改进方法：

**多次迭代碰撞求解**。每帧不只检测一次碰撞，而是迭代 3-8 次：

```ts
const SOLVER_ITERATIONS = 5

for (let iter = 0; iter < SOLVER_ITERATIONS; iter++) {
  for (let i = 0; i < contacts.length; i++) {
    resolveContact(contacts[i], RESTITUTION, FRICTION)
  }
}
```

**睡眠机制**。速度低于阈值的物体标记为"睡眠"，不参与物理计算：

```ts
const SLEEP_THRESHOLD = 0.1

function isSleeping(body: RigidBody): boolean {
  const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2)
  return speed < SLEEP_THRESHOLD && Math.abs(body.angularVelocity) < SLEEP_THRESHOLD
}
```

被碰撞吵醒时重新激活。

## 常见错误

**位置修正不够**。穿透后只修正一次，下一帧又穿透，导致底部方块不断下沉。需要多次迭代或连续修正。

**摩擦系数太高**。堆叠的方块会"粘"在一起，看起来不合理。通常 0.3-0.5 的摩擦系数就够了。

**没有睡眠机制**。所有物体每帧都做碰撞检测和响应，即使已经静止。堆叠场景下这是巨大的浪费。
