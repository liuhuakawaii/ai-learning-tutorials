# 约束求解——迭代法、Sequential Impulse

## 约束求解为什么需要迭代

前面的约束都是单独处理的。但当多个约束同时作用于同一批物体时，它们会互相干扰。

解决 A 和 B 的约束可能让 B 和 C 的约束被违反。解决 B 和 C 又可能让 A 和 B 重新违反。

迭代法就是反复过一遍所有约束，每轮修正一点，直到收敛。

## Sequential Impulse（顺序脉冲）

这是 Box2D 使用的方法，也是最广泛使用的约束求解方法。

核心思路：把约束转化为脉冲（impulse），每轮对每个约束计算并施加一个脉冲，迭代多轮。

```ts
interface Vec2 { x: number; y: number }

interface RigidBody {
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
}

interface Constraint {
  bodyA: RigidBody
  bodyB: RigidBody
  anchorA: Vec2
  anchorB: Vec2
  bias: number
  gamma: number
  accumulatedImpulse: number
  jacobian: { j1: Vec2; j2: number; j3: Vec2; j4: number }
}
```

## 构建约束

首先计算约束的雅可比矩阵（Jacobian）。对于距离约束，雅可比描述了"每个自由度对约束误差的贡献"：

```ts
function buildConstraint(
  constraint: Constraint,
  targetDistance: number,
  dt: number,
  baumgarte: number,
): void {
  const { bodyA, bodyB, anchorA, anchorB } = constraint
  const worldA = getWorldPoint(bodyA, anchorA)
  const worldB = getWorldPoint(bodyB, anchorB)

  const dx = worldB.x - worldA.x
  const dy = worldB.y - worldA.y
  const currentDistance = Math.sqrt(dx * dx + dy * dy)

  if (currentDistance < 0.0001) {
    constraint.jacobian = { j1: { x: 1, y: 0 }, j2: 0, j3: { x: -1, y: 0 }, j4: 0 }
    constraint.bias = 0
    return
  }

  const nx = dx / currentDistance
  const ny = dy / currentDistance
  const error = currentDistance - targetDistance

  const ra = { x: worldA.x - bodyA.position.x, y: worldA.y - bodyA.position.y }
  const rb = { x: worldB.x - bodyB.position.x, y: worldB.y - bodyB.position.y }

  constraint.jacobian = {
    j1: { x: -nx, y: -ny },
    j2: -(ra.x * (-ny) - ra.y * (-nx)),
    j3: { x: nx, y: ny },
    j4: rb.x * ny - rb.y * nx,
  }

  constraint.bias = -(baumgarte / dt) * error
  constraint.accumulatedImpulse = 0
}

function getWorldPoint(body: RigidBody, local: Vec2): Vec2 {
  const cos = Math.cos(body.angle)
  const sin = Math.sin(body.angle)
  return {
    x: body.position.x + local.x * cos - local.y * sin,
    y: body.position.y + local.x * sin + local.y * cos,
  }
}
```

`baumgarte` 参数控制位置修正的强度。太大物体会抖动，太小约束会软。

## 求解脉冲

每轮对每个约束计算一个脉冲：

```ts
function solveConstraint(constraint: Constraint, dt: number): void {
  const { bodyA, bodyB, jacobian: J } = constraint

  const vA = bodyA.velocity
  const vB = bodyB.velocity
  const wA = bodyA.angularVelocity
  const wB = bodyB.angularVelocity

  const jv = J.j1.x * vA.x + J.j1.y * vA.y + J.j2 * wA +
             J.j3.x * vB.x + J.j3.y * vB.y + J.j4 * wB

  const effectiveMass =
    J.j1.x * J.j1.x * bodyA.inverseMass + J.j1.y * J.j1.y * bodyA.inverseMass +
    J.j2 * J.j2 * bodyA.inverseInertia +
    J.j3.x * J.j3.x * bodyB.inverseMass + J.j3.y * J.j3.y * bodyB.inverseMass +
    J.j4 * J.j4 * bodyB.inverseInertia

  if (effectiveMass === 0) return

  const lambda = -(jv + constraint.bias) / effectiveMass

  const oldAccumulated = constraint.accumulatedImpulse
  constraint.accumulatedImpulse += lambda

  bodyA.velocity.x += J.j1.x * lambda * bodyA.inverseMass
  bodyA.velocity.y += J.j1.y * lambda * bodyA.inverseMass
  bodyA.angularVelocity += J.j2 * lambda * bodyA.inverseInertia

  bodyB.velocity.x += J.j3.x * lambda * bodyB.inverseMass
  bodyB.velocity.y += J.j3.y * lambda * bodyB.inverseMass
  bodyB.angularVelocity += J.j4 * lambda * bodyB.inverseInertia
}
```

## 完整的求解循环

```ts
const BAUMGARTE = 0.2
const ITERATIONS = 8

function solveConstraints(constraints: Constraint[], dt: number): void {
  for (const c of constraints) {
    buildConstraint(c, c.targetDistance ?? 0, dt, BAUMGARTE)
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const c of constraints) {
      solveConstraint(c, dt)
    }
  }
}
```

先构建所有约束，然后迭代求解。迭代中，后面的约束会"覆盖"前面的修正，但多轮下来会逐渐收敛。

## 约束的 warm starting

上一帧的脉冲结果可以作为下一帧的初始猜测：

```ts
function warmStart(constraint: Constraint): void {
  const { bodyA, bodyB, jacobian: J, accumulatedImpulse } = constraint

  bodyA.velocity.x += J.j1.x * accumulatedImpulse * bodyA.inverseMass
  bodyA.velocity.y += J.j1.y * accumulatedImpulse * bodyA.inverseMass
  bodyA.angularVelocity += J.j2 * accumulatedImpulse * bodyA.inverseInertia

  bodyB.velocity.x += J.j3.x * accumulatedImpulse * bodyB.inverseMass
  bodyB.velocity.y += J.j3.y * accumulatedImpulse * bodyB.inverseMass
  bodyB.angularVelocity += J.j4 * accumulatedImpulse * bodyB.inverseInertia
}
```

warm starting 能显著减少收敛所需的迭代次数。

## 完整示例：绳索桥

一组方块用距离约束连起来，两端固定，中间放一个重物：

```ts
const canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 400
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

const GRAVITY: Vec2 = { x: 0, y: 400 }
const DT = 1 / 60
const ITERATIONS = 10
const BAUMGARTE = 0.15

const bodies: RigidBody[] = []
const constraints: Constraint[] = []

const NUM = 12
const SEGMENT = 40

for (let i = 0; i <= NUM; i++) {
  const mass = (i === 0 || i === NUM) ? 1 : (i === Math.floor(NUM / 2) ? 3 : 1)
  bodies.push({
    position: { x: 100 + i * SEGMENT, y: 100 },
    velocity: { x: 0, y: 0 },
    angle: 0, angularVelocity: 0,
    force: { x: 0, y: 0 }, torque: 0,
    mass, inverseMass: (i === 0 || i === NUM) ? 0 : 1 / mass,
    inertia: 100, inverseInertia: (i === 0 || i === NUM) ? 0 : 1 / 100,
  })
}

for (let i = 0; i < NUM; i++) {
  constraints.push({
    bodyA: bodies[i], bodyB: bodies[i + 1],
    anchorA: { x: 20, y: 0 }, anchorB: { x: -20, y: 0 },
    bias: 0, gamma: 0, accumulatedImpulse: 0,
    jacobian: { j1: { x: 0, y: 0 }, j2: 0, j3: { x: 0, y: 0 }, j4: 0 },
    targetDistance: SEGMENT,
  } as Constraint)
}

function update() {
  for (const body of bodies) {
    if (body.inverseMass === 0) continue
    body.velocity.x += GRAVITY.x * DT
    body.velocity.y += GRAVITY.y * DT
    body.position.x += body.velocity.x * DT
    body.position.y += body.velocity.y * DT
    body.velocity.x *= 0.999
    body.velocity.y *= 0.999
  }

  for (const c of constraints) {
    buildConstraint(c, (c as any).targetDistance ?? SEGMENT, DT, BAUMGARTE)
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const c of constraints) {
      solveConstraint(c, DT)
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, 600, 400)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, 600, 400)

  ctx.strokeStyle = '#8b7355'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(bodies[0].position.x, bodies[0].position.y)
  for (let i = 1; i < bodies.length; i++) {
    ctx.lineTo(bodies[i].position.x, bodies[i].position.y)
  }
  ctx.stroke()

  for (const body of bodies) {
    ctx.fillStyle = body.inverseMass === 0 ? '#ff0' : (body.mass > 2 ? '#ff6b6b' : '#4a9eff')
    ctx.fillRect(body.position.x - 15, body.position.y - 10, 30, 20)
  }
}

function loop() {
  update()
  draw()
  requestAnimationFrame(loop)
}
loop()
```

两端固定，中间的红色方块更重。绳索在重力下形成悬链线。

## 常见错误

**迭代次数太少**。约束看起来软，物体之间有明显的穿透或拉伸。增加迭代次数会改善，但性能也会下降。

**Baumgarte 系数太大**。位置修正过强会导致物体抖动。通常 0.1-0.3 之间。

**没有 warm starting**。每次从零开始求解，收敛慢。warm starting 能让迭代减少 2-3 倍。

**约束构建时没有用世界坐标**。锚点是局部坐标，必须变换到世界空间。

## 练习

### 练习一：迭代次数对比

分别用 1、3、8、20 次迭代运行同一个绳索桥场景。对比绳索的"硬度"。

### 练习二：约束求解器的收敛

记录每轮迭代后约束误差的总和。画出误差随迭代次数的下降曲线。

---

## 参考答案

### 练习一

迭代次数越多，绳索越接近刚性。1 次迭代时绳索很软，明显拉伸。20 次时几乎不拉伸，但计算量是 1 次的 20 倍。实际项目中通常 4-8 次是好的平衡点。

### 练习二

```ts
function measureConstraintError(constraints: Constraint[]): number {
  let totalError = 0
  for (const c of constraints) {
    const worldA = getWorldPoint(c.bodyA, c.anchorA)
    const worldB = getWorldPoint(c.bodyB, c.anchorB)
    const dx = worldB.x - worldA.x
    const dy = worldB.y - worldA.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    totalError += Math.abs(dist - (c as any).targetDistance)
  }
  return totalError
}
```

误差通常呈指数下降。前 3-4 次迭代改善最大，之后收益递减。
