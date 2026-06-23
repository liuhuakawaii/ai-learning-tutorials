# 碰撞响应——冲量法、摩擦力模型、恢复系数

## 为什么需要专门的碰撞响应

前面的碰撞检测只解决了"碰没碰"和"怎么推开"。但碰撞时速度怎么变化？球撞墙弹回来的速率是多少？两个不同质量的物体碰撞后各自怎么动？

这些都靠碰撞响应来解决。

## 冲量法的基本思路

碰撞发生在一瞬间。与其计算碰撞过程中复杂的力的变化，不如直接算出一个冲量，一次性改变两个物体的速度。

```ts
interface Vec2 { x: number; y: number }

interface RigidBody {
  position: Vec2
  velocity: Vec2
  angularVelocity: number
  force: Vec2
  torque: number
  mass: number
  inverseMass: number
  inertia: number
  inverseInertia: number
}

interface Contact {
  point: Vec2
  normal: Vec2
  penetration: number
}
```

## 计算法向冲量

碰撞的法向冲量要满足两个条件：
1. 碰撞后沿法线方向的相对速度反向（或变为零）
2. 满足恢复系数的约束

```ts
function computeNormalImpulse(
  a: RigidBody,
  b: RigidBody,
  contact: Contact,
  restitution: number,
): number {
  const rv = relativeVelocity(a, b, contact.point)
  const contactVelocity = rv.x * contact.normal.x + rv.y * contact.normal.y

  if (contactVelocity > 0) return 0

  const ra = { x: contact.point.x - a.position.x, y: contact.point.y - a.position.y }
  const rb = { x: contact.point.x - b.position.x, y: contact.point.y - b.position.y }

  const raCrossN = ra.x * contact.normal.y - ra.y * contact.normal.x
  const rbCrossN = rb.x * contact.normal.y - rb.y * contact.normal.x

  const invMassSum = a.inverseMass + b.inverseMass +
    raCrossN * raCrossN * a.inverseInertia +
    rbCrossN * rbCrossN * b.inverseInertia

  return -(1 + restitution) * contactVelocity / invMassSum
}

function relativeVelocity(a: RigidBody, b: RigidBody, contactPoint: Vec2): Vec2 {
  const ra = { x: contactPoint.x - a.position.x, y: contactPoint.y - a.position.y }
  const rb = { x: contactPoint.x - b.position.x, y: contactPoint.y - b.position.y }

  return {
    x: (a.velocity.x - a.angularVelocity * ra.y) - (b.velocity.x - b.angularVelocity * rb.y),
    y: (a.velocity.y + a.angularVelocity * ra.x) - (b.velocity.y + b.angularVelocity * rb.x),
  }
}
```

碰撞点的相对速度要算上旋转的影响。接触点离质心越远，旋转对相对速度的贡献越大。

## 恢复系数

恢复系数 e 描述碰撞的能量保留程度：
- e = 0：完全非弹性碰撞，碰撞后不反弹
- e = 1：完全弹性碰撞，能量完全保留
- 0 < e < 1：实际情况，有能量损失

不同材料组合的恢复系数：

```ts
const MATERIALS = {
  steel: 0.6,
  wood: 0.4,
  rubber: 0.8,
  glass: 0.5,
  ice: 0.1,
}

function combinedRestitution(a: string, b: string): number {
  return Math.max(MATERIALS[a as keyof typeof MATERIALS] ?? 0.5, MATERIALS[b as keyof typeof MATERIALS] ?? 0.5)
}
```

实际引擎通常取两种材料恢复系数的较大值，或者取平均值。

## 切向冲量（摩擦力）

碰撞时的摩擦力通过切向冲量实现。思路和法向冲量一样，但方向沿着接触面：

```ts
function computeFrictionImpulse(
  a: RigidBody,
  b: RigidBody,
  contact: Contact,
  normalImpulse: number,
  frictionCoeff: number,
): Vec2 {
  const rv = relativeVelocity(a, b, contact.point)

  const tangentX = rv.x - (rv.x * contact.normal.x + rv.y * contact.normal.y) * contact.normal.x
  const tangentY = rv.y - (rv.x * contact.normal.x + rv.y * contact.normal.y) * contact.normal.y
  const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY)

  if (tangentLen < 0.001) return { x: 0, y: 0 }

  const tangent = { x: tangentX / tangentLen, y: tangentY / tangentLen }

  const ra = { x: contact.point.x - a.position.x, y: contact.point.y - a.position.y }
  const rb = { x: contact.point.x - b.position.x, y: contact.point.y - b.position.y }

  const raCrossT = ra.x * tangent.y - ra.y * tangent.x
  const rbCrossT = rb.x * tangent.y - rb.y * tangent.x

  const invMassSum = a.inverseMass + b.inverseMass +
    raCrossT * raCrossT * a.inverseInertia +
    rbCrossT * rbCrossT * b.inverseInertia

  let jt = -(
    rv.x * tangent.x + rv.y * tangent.y
  ) / invMassSum

  const maxFriction = Math.abs(normalImpulse) * frictionCoeff
  jt = Math.max(-maxFriction, Math.min(maxFriction, jt))

  return { x: tangent.x * jt, y: tangent.y * jt }
}
```

关键点：切向冲量的大小不能超过法向冲量乘以摩擦系数（库仑摩擦模型）。否则物体会"反向滑动"，不物理。

## 应用冲量

```ts
function applyImpulseAtContact(
  a: RigidBody,
  b: RigidBody,
  contact: Contact,
  impulse: Vec2,
): void {
  const ra = { x: contact.point.x - a.position.x, y: contact.point.y - a.position.y }
  const rb = { x: contact.point.x - b.position.x, y: contact.point.y - b.position.y }

  a.velocity.x += impulse.x * a.inverseMass
  a.velocity.y += impulse.y * a.inverseMass
  a.angularVelocity += (ra.x * impulse.y - ra.y * impulse.x) * a.inverseInertia

  b.velocity.x -= impulse.x * b.inverseMass
  b.velocity.y -= impulse.y * b.inverseMass
  b.angularVelocity -= (rb.x * impulse.y - rb.y * impulse.x) * b.inverseInertia
}
```

## 完整的碰撞处理流程

```ts
function resolveCollision(
  a: RigidBody,
  b: RigidBody,
  contact: Contact,
  restitution: number,
  friction: number,
): void {
  const jn = computeNormalImpulse(a, b, contact, restitution)
  const normalImpulse = { x: jn * contact.normal.x, y: jn * contact.normal.y }
  applyImpulseAtContact(a, b, contact, normalImpulse)

  const frictionImpulse = computeFrictionImpulse(a, b, contact, jn, friction)
  applyImpulseAtContact(a, b, contact, frictionImpulse)
}
```

先计算法向冲量（反弹），再计算切向冲量（摩擦）。顺序很重要——摩擦冲量依赖法向冲量的大小。

## 完整示例：台球碰撞

```ts
const canvas = document.createElement('canvas')
canvas.width = 700
canvas.height = 350
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

function createBall(x: number, y: number, vx: number): RigidBody {
  const mass = 1
  const radius = 15
  const inertia = 0.5 * mass * radius * radius
  return {
    position: { x, y },
    velocity: { x: vx, y: 0 },
    angularVelocity: 0,
    force: { x: 0, y: 0 },
    torque: 0,
    mass, inverseMass: 1 / mass,
    inertia, inverseInertia: 1 / inertia,
  }
}

const balls: RigidBody[] = [
  createBall(200, 175, 8),
  createBall(450, 175, 0),
  createBall(500, 150, 0),
  createBall(500, 200, 0),
]

const DT = 1 / 60
const FRICTION_COEFF = 0.2
const RESTITUTION = 0.95

function update() {
  for (const ball of balls) {
    ball.velocity.x *= 0.998
    ball.velocity.y *= 0.998
    ball.angularVelocity *= 0.998
    ball.position.x += ball.velocity.x * DT * 60
    ball.position.y += ball.velocity.y * DT * 60
    ball.angle += ball.angularVelocity * DT * 60
  }

  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i]
      const b = balls[j]
      const dx = b.position.x - a.position.x
      const dy = b.position.y - a.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const radiusSum = 30

      if (dist < radiusSum && dist > 0) {
        const normal = { x: dx / dist, y: dy / dist }
        const penetration = radiusSum - dist
        const contactPoint = {
          x: a.position.x + normal.x * 15,
          y: a.position.y + normal.y * 15,
        }

        a.position.x -= normal.x * penetration / 2
        a.position.y -= normal.y * penetration / 2
        b.position.x += normal.x * penetration / 2
        b.position.y += normal.y * penetration / 2

        resolveCollision(a, b, {
          point: contactPoint, normal, penetration,
        }, RESTITUTION, FRICTION_COEFF)
      }
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, 700, 350)
  ctx.fillStyle = '#1a5c1a'
  ctx.fillRect(0, 0, 700, 350)

  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i]
    ctx.fillStyle = i === 0 ? '#fff' : `hsl(${i * 60}, 70%, 50%)`
    ctx.beginPath()
    ctx.arc(ball.position.x, ball.position.y, 15, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = '#0003'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(ball.position.x, ball.position.y)
    const cos = Math.cos(ball.angle)
    const sin = Math.sin(ball.angle)
    ctx.lineTo(ball.position.x + cos * 15, ball.position.y + sin * 15)
    ctx.stroke()
  }
}

function loop() {
  update()
  draw()
  requestAnimationFrame(loop)
}
loop()
```

白球撞向一组球，球之间互相碰撞。画面上的短线显示了每个球的旋转。

## 常见错误

**切向冲量方向算反**。切向方向要从相对速度中减去法向分量，不能直接用速度方向。

**没有限制摩擦冲量大小**。不限制的话会出现"负摩擦"，物体碰撞后会加速。

**位置修正和冲量的顺序**。必须先修正位置（推开），再施加冲量。否则冲量计算时接触点的位置不对。

## 练习

### 练习一：不同恢复系数对比

让球从同一高度落到地面，分别用 e=0.2、e=0.6、e=1.0，对比弹跳高度。

### 练习二：旋转台球

用球杆击打球的不同位置（左边、右边、上方、下方），观察球的运动轨迹和旋转方向。

---

## 参考答案

### 练习一

```ts
const heights = [0.2, 0.6, 1.0]
const balls = heights.map((e, i) => ({
  body: createBall(100 + i * 150, 50, 0),
  restitution: e,
}))

function update() {
  for (const ball of balls) {
    ball.body.velocity.y += 500 * DT
    ball.body.position.y += ball.body.velocity.y * DT

    if (ball.body.position.y > 300) {
      ball.body.position.y = 300
      const jn = -(1 + ball.restitution) * ball.body.velocity.y / ball.body.inverseMass
      ball.body.velocity.y += jn * ball.body.inverseMass
    }
  }
}
```

e=1.0 的球弹回原高度，e=0.2 的球几乎不弹。

### 练习二

击打位置相对于球心的偏移产生角速度：

```ts
function strike(ball: RigidBody, hitPoint: Vec2, direction: Vec2, power: number): void {
  const impulse = { x: direction.x * power, y: direction.y * power }
  applyImpulseAtContact(ball, impulse, hitPoint)
}

// 击打球的右侧（产生逆时针旋转）
strike(whiteBall, { x: whiteBall.position.x + 10, y: whiteBall.position.y }, { x: 1, y: 0 }, 10)
```
