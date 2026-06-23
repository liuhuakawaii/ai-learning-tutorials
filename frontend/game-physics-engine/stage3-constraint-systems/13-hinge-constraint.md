# 铰链约束——旋转关节、角度限制

## 铰链是什么

门和门框之间是铰链。手臂和肩膀之间是铰链。链条的每一节之间是铰链。

铰链约束允许两个物体绕一个共同点旋转，但不允许它们分开。它结合了距离约束（固定点）和角度限制。

## 基础铰链：固定同一位置

最简单的铰链就是让两个物体的一个点重合：

```ts
interface Vec2 { x: number; y: number }

interface RigidBody {
  position: Vec2
  velocity: Vec2
  angle: number
  angularVelocity: number
  mass: number
  inverseMass: number
  inertia: number
  inverseInertia: number
}

interface HingeConstraint {
  bodyA: RigidBody
  bodyB: RigidBody
  localAnchorA: Vec2
  localAnchorB: Vec2
}
```

`localAnchorA` 和 `localAnchorB` 是各自物体局部坐标系中的锚点。在世界空间中，这两个锚点必须重合。

## 求解铰链约束

```ts
function getWorldAnchor(body: RigidBody, local: Vec2): Vec2 {
  const cos = Math.cos(body.angle)
  const sin = Math.sin(body.angle)
  return {
    x: body.position.x + local.x * cos - local.y * sin,
    y: body.position.y + local.x * sin + local.y * cos,
  }
}

function solveHingeConstraint(constraint: HingeConstraint): void {
  const { bodyA, bodyB, localAnchorA, localAnchorB } = constraint
  const anchorA = getWorldAnchor(bodyA, localAnchorA)
  const anchorB = getWorldAnchor(bodyB, localAnchorB)

  const dx = anchorB.x - anchorA.x
  const dy = anchorB.y - anchorA.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist === 0) return

  const ra = { x: anchorA.x - bodyA.position.x, y: anchorA.y - bodyA.position.y }
  const rb = { x: anchorB.x - bodyB.position.x, y: anchorB.y - bodyB.position.y }

  const raCrossX = ra.x * 0 - ra.y * 1
  const raCrossY = ra.x * 1 - ra.y * 0
  const rbCrossX = rb.x * 0 - rb.y * 1
  const rbCrossY = rb.x * 1 - rb.y * 0

  const K = bodyA.inverseMass + bodyB.inverseMass +
    raCrossX * raCrossX * bodyA.inverseInertia +
    rbCrossX * rbCrossX * bodyB.inverseInertia

  const correction = dist / (K + 0.0001)

  const nx = dx / dist
  const ny = dy / dist

  if (!bodyA.inverseMass) return
  bodyA.position.x += nx * correction * bodyA.inverseMass * 0.5
  bodyA.position.y += ny * correction * bodyA.inverseMass * 0.5
  bodyA.angle += (ra.x * ny - ra.y * nx) * correction * bodyA.inverseInertia * 0.5

  if (!bodyB.inverseMass) return
  bodyB.position.x -= nx * correction * bodyB.inverseMass * 0.5
  bodyB.position.y -= ny * correction * bodyB.inverseMass * 0.5
  bodyB.angle -= (rb.x * ny - rb.y * nx) * correction * bodyB.inverseInertia * 0.5
}
```

位置修正的同时也修正角度。锚点离质心越远，角度修正越明显。

## 带角度限制的铰链

现实中的铰链通常有角度限制。门只能开到 180 度，膝盖只能弯到一定角度：

```ts
interface LimitedHingeConstraint {
  bodyA: RigidBody
  bodyB: RigidBody
  localAnchorA: Vec2
  localAnchorB: Vec2
  minAngle: number
  maxAngle: number
}

function solveLimitedHinge(constraint: LimitedHingeConstraint): void {
  solveHingeConstraint(constraint)

  let relativeAngle = constraint.bodyB.angle - constraint.bodyA.angle
  while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2
  while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2

  if (relativeAngle < constraint.minAngle) {
    const correction = constraint.minAngle - relativeAngle
    const totalInvInertia = constraint.bodyA.inverseInertia + constraint.bodyB.inverseInertia
    if (totalInvInertia === 0) return
    const ratioA = constraint.bodyA.inverseInertia / totalInvInertia
    const ratioB = constraint.bodyB.inverseInertia / totalInvInertia
    constraint.bodyA.angle -= correction * ratioA
    constraint.bodyB.angle += correction * ratioB
  } else if (relativeAngle > constraint.maxAngle) {
    const correction = relativeAngle - constraint.maxAngle
    const totalInvInertia = constraint.bodyA.inverseInertia + constraint.bodyB.inverseInertia
    if (totalInvInertia === 0) return
    const ratioA = constraint.bodyA.inverseInertia / totalInvInertia
    const ratioB = constraint.bodyB.inverseInertia / totalInvInertia
    constraint.bodyA.angle += correction * ratioA
    constraint.bodyB.angle -= correction * ratioB
  }
}
```

角度限制用位置修正实现。超过限制时，按转动惯量的比例分摊修正。

## 完整示例：链条

一串方块用铰链连起来，顶部固定：

```ts
const canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 400
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

const GRAVITY: Vec2 = { x: 0, y: 500 }
const DT = 1 / 60
const CONSTRAINT_ITERATIONS = 8

const links: RigidBody[] = []
const hinges: HingeConstraint[] = []

const NUM_LINKS = 8
const LINK_WIDTH = 30
const LINK_HEIGHT = 15

for (let i = 0; i < NUM_LINKS; i++) {
  const mass = 1
  const inertia = mass * (LINK_WIDTH * LINK_WIDTH + LINK_HEIGHT * LINK_HEIGHT) / 12
  links.push({
    position: { x: 300, y: 50 + i * (LINK_HEIGHT + 5) },
    velocity: { x: 0, y: 0 },
    angle: 0,
    angularVelocity: 0,
    mass, inverseMass: 1 / mass,
    inertia, inverseInertia: 1 / inertia,
  })
}

links[0].inverseMass = 0
links[0].inverseInertia = 0

for (let i = 0; i < NUM_LINKS - 1; i++) {
  hinges.push({
    bodyA: links[i],
    bodyB: links[i + 1],
    localAnchorA: { x: 0, y: LINK_HEIGHT / 2 },
    localAnchorB: { x: 0, y: -LINK_HEIGHT / 2 },
  })
}

function update() {
  for (const body of links) {
    if (body.inverseMass === 0) continue
    body.velocity.x += GRAVITY.x * DT
    body.velocity.y += GRAVITY.y * DT
    body.velocity.x *= 0.999
    body.velocity.y *= 0.999
    body.angularVelocity *= 0.995
    body.position.x += body.velocity.x * DT
    body.position.y += body.velocity.y * DT
    body.angle += body.angularVelocity * DT
  }

  for (let iter = 0; iter < CONSTRAINT_ITERATIONS; iter++) {
    for (const h of hinges) {
      solveHingeConstraint(h)
    }
  }
}

function drawLink(body: RigidBody) {
  ctx.save()
  ctx.translate(body.position.x, body.position.y)
  ctx.rotate(body.angle)
  ctx.fillStyle = '#6bc5ff'
  ctx.strokeStyle = '#4a9eff'
  ctx.lineWidth = 1
  ctx.fillRect(-LINK_WIDTH / 2, -LINK_HEIGHT / 2, LINK_WIDTH, LINK_HEIGHT)
  ctx.strokeRect(-LINK_WIDTH / 2, -LINK_HEIGHT / 2, LINK_WIDTH, LINK_HEIGHT)
  ctx.fillStyle = '#ff0'
  ctx.beginPath()
  ctx.arc(0, -LINK_HEIGHT / 2, 3, 0, Math.PI * 2)
  ctx.arc(0, LINK_HEIGHT / 2, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

let mouseX = 300, mouseY = 50
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect()
  mouseX = e.clientX - rect.left
  mouseY = e.clientY - rect.top
})

function loop() {
  links[0].position.x = mouseX
  links[0].position.y = mouseY

  update()
  ctx.clearRect(0, 0, 600, 400)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, 600, 400)
  for (const link of links) drawLink(link)
  requestAnimationFrame(loop)
}
loop()
```

拖动鼠标移动顶部，链条自然摆动。每个链接通过铰链约束保持连接。

## 铰链 vs 距离约束

铰链约束住的是两个点重合，不只是距离。距离约束允许两个物体绕彼此旋转，铰链也允许，但锚点位置更精确。

对于链条这种场景，铰链和距离约束效果差不多。但对于机械臂这种需要精确锚点位置的场景，铰链更合适。

## 常见错误

**局部坐标系和世界坐标系搞混**。锚点是局部坐标，每次求解时要变换到世界空间。

**角度没有归一化**。角度会无限增长，比较角度时要先归一化到 [-π, π]。

**约束求解不够**。铰链约束比距离约束更难收敛，通常需要更多迭代。

## 练习

### 练习一：秋千

用铰链约束做一个秋千。底部的板子通过铰链连接到顶部的固定点。用鼠标推板子，观察摆动。

### 练习二：带角度限制的门

一扇门通过铰链连接到门框。限制门只能在 [-90°, 90°] 之间旋转。用鼠标点击施加力推门。

---

## 参考答案

### 练习一

```ts
const pivot: RigidBody = {
  position: { x: 300, y: 50 }, velocity: { x: 0, y: 0 },
  angle: 0, angularVelocity: 0,
  mass: 1, inverseMass: 0, inertia: 1, inverseInertia: 0,
}
const seat: RigidBody = {
  position: { x: 300, y: 250 }, velocity: { x: 0, y: 0 },
  angle: 0, angularVelocity: 0,
  mass: 1, inverseMass: 1, inertia: 100, inverseInertia: 1/100,
}
const hinge: HingeConstraint = {
  bodyA: pivot, bodyB: seat,
  localAnchorA: { x: 0, y: 0 }, localAnchorB: { x: 0, y: -100 },
}
```

### 练习二

```ts
const doorHinge: LimitedHingeConstraint = {
  bodyA: wall, bodyB: door,
  localAnchorA: { x: 0, y: 0 }, localAnchorB: { x: -40, y: 0 },
  minAngle: -Math.PI / 2,
  maxAngle: Math.PI / 2,
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  applyForceAtPoint(door, { x: 0, y: -200 }, { x: mx, y: my })
})
```
