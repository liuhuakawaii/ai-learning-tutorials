# 力与冲量——重力、摩擦力、弹性力、冲量-动量定理

## 力和冲量有什么区别

力作用一段时间，改变速度。冲量在瞬间作用，直接改变速度。

推一个箱子 10 秒是力。踢一脚球是冲量。物理引擎里两者都需要。

## 力的累积

一帧内可能有多个力同时作用：重力、风力、弹簧力、摩擦力。把它们加起来再除以质量得到加速度：

```ts
interface Vec2 { x: number; y: number }

interface RigidBody {
  position: Vec2
  velocity: Vec2
  force: Vec2
  mass: number
  inverseMass: number
}

function clearForces(body: RigidBody): void {
  body.force.x = 0
  body.force.y = 0
}

function applyForce(body: RigidBody, force: Vec2): void {
  body.force.x += force.x
  body.force.y += force.y
}

function integrateForces(body: RigidBody, dt: number): void {
  if (body.inverseMass === 0) return
  body.velocity.x += body.force.x * body.inverseMass * dt
  body.velocity.y += body.force.y * body.inverseMass * dt
}
```

`inverseMass`（质量的倒数）是个常用技巧。质量无穷大的物体（比如地面）设 `inverseMass = 0`，这样力对它不起作用，也避免了除以零。

## 重力

最简单的力：

```ts
function applyGravity(body: RigidBody, gravity: Vec2): void {
  if (body.inverseMass === 0) return
  body.force.x += gravity.x / body.inverseMass
  body.force.y += gravity.y / body.inverseMass
}
```

注意这里用 `gravity / inverseMass` 而不是 `gravity * mass`。结果一样，但除以 inverseMass 在质量无穷大时不会出错。

## 摩擦力

### 静摩擦和动摩擦

物体静止时需要克服静摩擦力才能动起来，运动中受到动摩擦力阻碍。

```ts
function applyFriction(body: RigidBody, normalForce: number, muStatic: number, muDynamic: number): void {
  const vx = body.velocity.x
  const vy = body.velocity.y
  const speed = Math.sqrt(vx * vx + vy * vy)

  if (speed < 0.01) {
    const frictionForce = Math.min(normalForce * muStatic, Math.abs(body.force.x) + Math.abs(body.force.y))
    if (frictionForce > 0) {
      const factor = frictionForce / Math.max(speed, 0.001)
      body.force.x -= vx * factor
      body.force.y -= vy * factor
    }
  } else {
    const factor = normalForce * muDynamic / speed
    body.force.x -= vx * factor
    body.force.y -= vy * factor
  }
}
```

速度很小时用静摩擦系数，否则用动摩擦系数。这样物体在低速时会停下来，而不是在零附近振荡。

### 简化版：线性阻尼

实际项目中常用一个更简单的模型：

```ts
function applyDamping(body: RigidBody, damping: number): void {
  body.velocity.x *= damping
  body.velocity.y *= damping
}
```

`damping` 设成 0.99 就是每帧损失 1% 的速度。这不物理上准确，但效果够用，而且计算便宜。

## 弹性力（胡克定律）

弹簧把两个物体拉向（或推开）平衡位置：

```ts
function springForce(
  a: RigidBody,
  b: RigidBody,
  restLength: number,
  stiffness: number,
  dampingCoeff: number,
): Vec2 {
  const dx = b.position.x - a.position.x
  const dy = b.position.y - a.position.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return { x: 0, y: 0 }

  const nx = dx / dist
  const ny = dy / dist
  const stretch = dist - restLength

  const relVx = b.velocity.x - a.velocity.x
  const relVy = b.velocity.y - a.velocity.y
  const relVn = relVx * nx + relVy * ny

  const force = stiffness * stretch + dampingCoeff * relVn
  return { x: force * nx, y: force * ny }
}
```

`stiffness` 控制弹簧多硬，`dampingCoeff` 控制振荡多快衰减。没有阻尼的弹簧会永远振下去。

## 冲量

冲量直接改变速度，不经过力和时间的积分：

```ts
function applyImpulse(body: RigidBody, impulse: Vec2): void {
  if (body.inverseMass === 0) return
  body.velocity.x += impulse.x * body.inverseMass
  body.velocity.y += impulse.y * body.inverseMass
}
```

碰撞响应主要靠冲量。一球撞另一球，在碰撞瞬间施加冲量改变两球的速度。

## 冲量-动量定理

动量 = 质量 × 速度。冲量 = 动量的变化。

要让一个 1 kg 的物体速度从 5 m/s 变成 -3 m/s，需要的冲量是 1 × (-3 - 5) = -8 N·s。

碰撞响应的冲量大小：

```ts
function computeCollisionImpulse(
  a: RigidBody,
  b: RigidBody,
  normal: Vec2,
  restitution: number,
): number {
  const relVx = b.velocity.x - a.velocity.x
  const relVy = b.velocity.y - a.velocity.y
  const relVn = relVx * normal.x + relVy * normal.y

  if (relVn > 0) return 0

  const invMassSum = a.inverseMass + b.inverseMass
  if (invMassSum === 0) return 0

  return -(1 + restitution) * relVn / invMassSum
}
```

`restitution = 0` 是完全非弹性碰撞（粘在一起），`restitution = 1` 是完全弹性碰撞（没有能量损失）。

## 完整示例：力的合成

```ts
const canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 400
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

const body: RigidBody = {
  position: { x: 300, y: 200 },
  velocity: { x: 0, y: 0 },
  force: { x: 0, y: 0 },
  mass: 1,
  inverseMass: 1,
}

const GRAVITY: Vec2 = { x: 0, y: 200 }
const WIND: Vec2 = { x: 80, y: 0 }
const DAMPING = 0.98
const DT = 1 / 60

const trail: Vec2[] = []

function update() {
  clearForces(body)
  applyGravity(body, GRAVITY)
  applyForce(body, WIND)
  applyDamping(body, DAMPING)

  integrateForces(body, DT)
  body.position.x += body.velocity.x * DT
  body.position.y += body.velocity.y * DT

  if (body.position.y > 380) {
    body.position.y = 380
    body.velocity.y *= -0.6
  }
  if (body.position.x > 580) {
    body.position.x = 580
    body.velocity.x *= -0.6
  }
  if (body.position.x < 20) {
    body.position.x = 20
    body.velocity.x *= -0.6
  }

  trail.push({ ...body.position })
  if (trail.length > 200) trail.shift()
}

function draw() {
  ctx.clearRect(0, 0, 600, 400)

  ctx.strokeStyle = '#4a9eff44'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < trail.length; i++) {
    if (i === 0) ctx.moveTo(trail[i].x, trail[i].y)
    else ctx.lineTo(trail[i].x, trail[i].y)
  }
  ctx.stroke()

  ctx.fillStyle = '#4a9eff'
  ctx.beginPath()
  ctx.arc(body.position.x, body.position.y, 12, 0, Math.PI * 2)
  ctx.fill()

  const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2)
  if (speed > 1) {
    ctx.strokeStyle = '#ff0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(body.position.x, body.position.y)
    ctx.lineTo(
      body.position.x + (body.velocity.x / speed) * 30,
      body.position.y + (body.velocity.y / speed) * 30,
    )
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

物体受重力和风力的合力作用，轨迹是一条抛物线。尾迹显示了运动路径。

## 常见错误

**力和冲量搞混**。力需要乘以 dt，冲量直接加到速度上。如果把力当冲量用，物体瞬间获得巨大速度。

**忘记每帧清零力**。力是累积的，每帧开始时必须清零，否则力会无限叠加。

**重力用了两次**。有时候代码里既在力的累加里加了重力，又在位置更新时直接加了重力。导致物体以两倍重力下落。

## 练习

### 练习一：弹簧连接的两个球

两个球用弹簧连接，从不同高度释放。观察它们的振荡行为。调整 stiffness 和 damping 观察效果。

### 练习二：台球碰撞

用冲量法模拟两个台球的正面碰撞。一个球静止，另一个以速度 v 撞过来。验证动量守恒。

---

## 参考答案

### 练习一

```ts
const ballA: RigidBody = {
  position: { x: 250, y: 100 }, velocity: { x: 0, y: 0 },
  force: { x: 0, y: 0 }, mass: 1, inverseMass: 1,
}
const ballB: RigidBody = {
  position: { x: 350, y: 300 }, velocity: { x: 0, y: 0 },
  force: { x: 0, y: 0 }, mass: 1, inverseMass: 1,
}

function update() {
  clearForces(ballA)
  clearForces(ballB)
  applyGravity(ballA, GRAVITY)
  applyGravity(ballB, GRAVITY)

  const sf = springForce(ballA, ballB, 100, 30, 2)
  applyForce(ballA, sf)
  applyForce(ballB, { x: -sf.x, y: -sf.y })

  integrateForces(ballA, DT)
  integrateForces(ballB, DT)
  ballA.position.x += ballA.velocity.x * DT
  ballA.position.y += ballA.velocity.y * DT
  ballB.position.x += ballB.velocity.x * DT
  ballB.position.y += ballB.velocity.y * DT
}
```

### 练习二

```ts
const ballA: RigidBody = {
  position: { x: 200, y: 200 }, velocity: { x: 5, y: 0 },
  force: { x: 0, y: 0 }, mass: 1, inverseMass: 1,
}
const ballB: RigidBody = {
  position: { x: 300, y: 200 }, velocity: { x: 0, y: 0 },
  force: { x: 0, y: 0 }, mass: 1, inverseMass: 1,
}

const impulse = computeCollisionImpulse(ballA, ballB, { x: 1, y: 0 }, 1.0)
applyImpulse(ballA, { x: -impulse, y: 0 })
applyImpulse(ballB, { x: impulse, y: 0 })
```

碰撞后 A 静止，B 以 A 的原速度运动。动量守恒：1×5 + 1×0 = 1×0 + 1×5。
