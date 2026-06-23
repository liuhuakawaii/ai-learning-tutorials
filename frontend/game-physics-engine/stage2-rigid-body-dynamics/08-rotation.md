# 旋转动力学——角速度、角加速度、转动惯量、扭矩

## 为什么物体不只是平移

现实世界的东西会转。门绕铰链转，陀螺绕自身转，棒球在空中旋转。

物理引擎需要同时处理平移和旋转。旋转部分的数学结构和平移完全对应：

- 平移：力 → 加速度 → 速度 → 位置
- 旋转：扭矩 → 角加速度 → 角速度 → 角度

## 扭矩

力让物体加速，扭矩让物体旋转。扭矩 = 力 × 力臂（力到旋转中心的距离）。

```ts
interface Vec2 { x: number; y: number }

function torqueFromForce(force: Vec2, applicationPoint: Vec2, centerOfMass: Vec2): number {
  const rx = applicationPoint.x - centerOfMass.x
  const ry = applicationPoint.y - centerOfMass.y
  return rx * force.y - ry * force.x
}
```

叉积 `rx * fy - ry * fx` 给出扭矩的大小和方向（顺时针或逆时针）。

直觉：推门的时候，离铰链越远越省力。推门的正中间，扭矩最大。

## 转动惯量

转动惯量衡量物体抵抗旋转变化的能力。质量越大越难推动，转动惯量越大越难转动。

常见形状的转动惯量：

```ts
function momentOfInertiaBox(mass: number, width: number, height: number): number {
  return (mass * (width * width + height * height)) / 12
}

function momentOfInertiaDisk(mass: number, radius: number): number {
  return 0.5 * mass * radius * radius
}

function momentOfInertiaPolygon(mass: number, vertices: Vec2[]): number {
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length
    const cross = Math.abs(vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y)
    numerator += cross * (
      vertices[i].x * vertices[i].x + vertices[i].x * vertices[j].x + vertices[j].x * vertices[j].x +
      vertices[i].y * vertices[i].y + vertices[i].y * vertices[j].y + vertices[j].y * vertices[j].y
    )
    denominator += cross
  }
  return (mass * numerator) / (6 * denominator)
}
```

和质量一样，用 `inverseInertia` 避免除法：

```ts
interface RigidBody {
  position: Vec2
  velocity: Vec2
  force: Vec2
  angle: number
  angularVelocity: number
  torque: number
  mass: number
  inverseMass: number
  inertia: number
  inverseInertia: number
}
```

## 角加速度和角速度

```ts
function integrateAngular(body: RigidBody, dt: number): void {
  if (body.inverseInertia === 0) return
  body.angularVelocity += body.torque * body.inverseInertia * dt
  body.angle += body.angularVelocity * dt
  body.torque = 0
}
```

和平移积分完全对称。

## 力如何影响旋转

同一个力，作用点不同，效果不同。推门把手能开门，推铰链旁边推不开。

```ts
function applyForceAtPoint(
  body: RigidBody,
  force: Vec2,
  worldPoint: Vec2,
): void {
  body.force.x += force.x
  body.force.y += force.y

  const rx = worldPoint.x - body.position.x
  const ry = worldPoint.y - body.position.y
  body.torque += rx * force.y - ry * force.x
}
```

力同时影响平移和旋转。推门把手时，门平移（被推开）的同时也在旋转。

## 完整的刚体积分

```ts
function integrateBody(body: RigidBody, dt: number, gravity: Vec2): void {
  if (body.inverseMass === 0) return

  body.force.x += gravity.x / body.inverseMass
  body.force.y += gravity.y / body.inverseMass

  body.velocity.x += body.force.x * body.inverseMass * dt
  body.velocity.y += body.force.y * body.inverseMass * dt
  body.angularVelocity += body.torque * body.inverseInertia * dt

  body.position.x += body.velocity.x * dt
  body.position.y += body.velocity.y * dt
  body.angle += body.angularVelocity * dt

  body.force.x = 0
  body.force.y = 0
  body.torque = 0
}
```

## 旋转对碰撞的影响

碰撞点不在质心时，冲量会产生扭矩：

```ts
function applyImpulseAtPoint(
  body: RigidBody,
  impulse: Vec2,
  contactPoint: Vec2,
): void {
  body.velocity.x += impulse.x * body.inverseMass
  body.velocity.y += impulse.y * body.inverseMass

  const rx = contactPoint.x - body.position.x
  const ry = contactPoint.y - body.position.y
  body.angularVelocity += (rx * impulse.y - ry * impulse.x) * body.inverseInertia
}
```

这就是为什么台球可以打出旋球——球杆击打的位置不在球心时，球一边平移一边旋转。

## 完整示例：旋转的多边形

```ts
const canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 400
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

function createBody(
  x: number, y: number, vertices: Vec2[],
  mass: number,
): RigidBody {
  const inertia = momentOfInertiaPolygon(mass, vertices)
  return {
    position: { x, y },
    velocity: { x: 0, y: 0 },
    force: { x: 0, y: 0 },
    angle: 0,
    angularVelocity: 0,
    torque: 0,
    mass,
    inverseMass: 1 / mass,
    inertia,
    inverseInertia: 1 / inertia,
  }
}

const box = createBody(300, 200, [
  { x: -40, y: -20 }, { x: 40, y: -20 },
  { x: 40, y: 20 }, { x: -40, y: 20 },
], 1)

const GRAVITY: Vec2 = { x: 0, y: 300 }
const DT = 1 / 60

function getWorldVertices(body: RigidBody, localVerts: Vec2[]): Vec2[] {
  const cos = Math.cos(body.angle)
  const sin = Math.sin(body.angle)
  return localVerts.map(v => ({
    x: body.position.x + v.x * cos - v.y * sin,
    y: body.position.y + v.x * sin + v.y * cos,
  }))
}

function draw() {
  ctx.clearRect(0, 0, 600, 400)

  const localVerts = [
    { x: -40, y: -20 }, { x: 40, y: -20 },
    { x: 40, y: 20 }, { x: -40, y: 20 },
  ]
  const worldVerts = getWorldVertices(box, localVerts)

  ctx.fillStyle = '#4a9eff'
  ctx.beginPath()
  ctx.moveTo(worldVerts[0].x, worldVerts[0].y)
  for (let i = 1; i < worldVerts.length; i++) {
    ctx.lineTo(worldVerts[i].x, worldVerts[i].y)
  }
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#ff0'
  ctx.beginPath()
  ctx.arc(box.position.x, box.position.y, 4, 0, Math.PI * 2)
  ctx.fill()
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  applyForceAtPoint(box, { x: 0, y: -500 }, { x: mx, y: my })
})

function loop() {
  integrateBody(box, DT, GRAVITY)

  if (box.position.y > 350) {
    box.position.y = 350
    box.velocity.y *= -0.5
    box.angularVelocity *= 0.9
  }

  draw()
  requestAnimationFrame(loop)
}
loop()
```

点击画布的不同位置施加力。点击边缘会产生很大的旋转，点击质心几乎不转。

## 常见错误

**忘记扭矩也要清零**。和力一样，扭矩每帧必须清零。

**碰撞响应没考虑旋转**。只修改线速度不改角速度，物体碰到后不会转。特别是堆叠场景，物体看起来像滑冰。

**转动惯量算错**。转动惯量是相对于质心的。如果质心不在原点，需要用平行轴定理调整。

## 练习

### 练习一：旋转的 L 形

创建一个 L 形多边形，用鼠标点击不同位置施加力，观察旋转效果。

### 练习二：角动量守恒

一个旋转的物体突然改变形状（模拟花样滑冰收臂）。用代码验证角动量 `I × ω` 在没有外力矩时守恒。

---

## 参考答案

### 练习一

L 形的顶点：

```ts
const lShape = createBody(300, 200, [
  { x: -30, y: -30 }, { x: 0, y: -30 },
  { x: 0, y: 0 }, { x: 30, y: 0 },
  { x: 30, y: 30 }, { x: -30, y: 30 },
], 1)
```

L 形的质心不在几何中心。`momentOfInertiaPolygon` 会自动计算正确的转动惯量。点击 L 的短臂末端会比点击长臂末端产生更大的扭矩。

### 练习二

```ts
const body = createBody(300, 200, diskVerts, 1)
body.angularVelocity = 5

const initialAngularMomentum = body.inertia * body.angularVelocity

// 收臂：减小转动惯量
body.inertia *= 0.25
body.inverseInertia = 1 / body.inertia
// 保持角动量守恒
body.angularVelocity = initialAngularMomentum / body.inertia

console.log('Before:', initialAngularMomentum)
console.log('After:', body.inertia * body.angularVelocity)
```

转动惯量减小到 1/4，角速度增大到 4 倍。角动量守恒。
