# 距离约束——保持两点间固定距离

## 什么是约束

约束是限制物体运动的规则。"这两个点之间的距离必须是 100"就是一个距离约束。

约束和力不同。力改变速度，约束限制位置。约束更像是"你不能去那里"，而不是"你要往这边走"。

## 为什么需要距离约束

绳子、链条、棍棒、骨骼动画的骨骼——这些东西的本质都是"两个点保持固定距离"。

游戏里很多看起来复杂的东西，拆开看都是距离约束的组合。

## 最简单的位置修正

两个物体 A 和 B，想保持距离 d：

```ts
interface Vec2 { x: number; y: number }

interface Particle {
  position: Vec2
  previousPosition: Vec2
  mass: number
  inverseMass: number
}

function solveDistanceConstraint(a: Particle, b: Particle, targetDistance: number): void {
  const dx = b.position.x - a.position.x
  const dy = b.position.y - a.position.y
  const currentDistance = Math.sqrt(dx * dx + dy * dy)

  if (currentDistance === 0) return

  const correction = (currentDistance - targetDistance) / currentDistance
  const totalInverseMass = a.inverseMass + b.inverseMass
  if (totalInverseMass === 0) return

  const correctionX = dx * correction
  const correctionY = dy * correction

  const ratioA = a.inverseMass / totalInverseMass
  const ratioB = b.inverseMass / totalInverseMass

  a.position.x += correctionX * ratioA
  a.position.y += correctionY * ratioA
  b.position.x -= correctionX * ratioB
  b.position.y -= correctionY * ratioB
}
```

质量大的物体移动少，质量小的移动多。如果一个物体是静态的（inverseMass = 0），另一个物体承担全部修正。

## Verlet 积分 + 约束

Verlet 积分天然适合约束求解。位置本身就是状态，修正位置就等于施加约束：

```ts
function verletIntegrate(p: Particle, gravity: Vec2, dt: number): void {
  const vx = p.position.x - p.previousPosition.x
  const vy = p.position.y - p.previousPosition.y

  p.previousPosition.x = p.position.x
  p.previousPosition.y = p.position.y

  p.position.x += vx + gravity.x * dt * dt
  p.position.y += vy + gravity.y * dt * dt
}
```

速度隐含在 `position - previousPosition` 里。约束修正位置后，下一帧的速度自然被改变。

## 完整示例：绳子

一串粒子用距离约束连起来，就是一根绳子：

```ts
const canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 400
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

const GRAVITY: Vec2 = { x: 0, y: 500 }
const DT = 1 / 60
const CONSTRAINT_ITERATIONS = 10
const SEGMENT_LENGTH = 20
const NUM_SEGMENTS = 15

const particles: Particle[] = []
for (let i = 0; i <= NUM_SEGMENTS; i++) {
  particles.push({
    position: { x: 300 + i * SEGMENT_LENGTH, y: 50 },
    previousPosition: { x: 300 + i * SEGMENT_LENGTH, y: 50 },
    mass: 1,
    inverseMass: i === 0 ? 0 : 1,
  })
}

const constraints: { a: number; b: number; distance: number }[] = []
for (let i = 0; i < NUM_SEGMENTS; i++) {
  constraints.push({ a: i, b: i + 1, distance: SEGMENT_LENGTH })
}

let mouseX = 300
let mouseY = 50
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect()
  mouseX = e.clientX - rect.left
  mouseY = e.clientY - rect.top
})

function update() {
  particles[0].position.x = mouseX
  particles[0].position.y = mouseY

  for (const p of particles) {
    if (p.inverseMass === 0) continue
    verletIntegrate(p, GRAVITY, DT)
  }

  for (let iter = 0; iter < CONSTRAINT_ITERATIONS; iter++) {
    for (const c of constraints) {
      solveDistanceConstraint(particles[c.a], particles[c.b], c.distance)
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, 600, 400)

  ctx.strokeStyle = '#8b7355'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(particles[0].position.x, particles[0].position.y)
  for (let i = 1; i < particles.length; i++) {
    ctx.lineTo(particles[i].position.x, particles[i].position.y)
  }
  ctx.stroke()

  for (const p of particles) {
    ctx.fillStyle = p.inverseMass === 0 ? '#ff0' : '#4a9eff'
    ctx.beginPath()
    ctx.arc(p.position.x, p.position.y, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function loop() {
  update()
  draw()
  requestAnimationFrame(loop)
}
loop()
```

第一个粒子跟随鼠标，绳子在重力下自然垂落。增加 `CONSTRAINT_ITERATIONS` 会让绳子更硬。

## 约束迭代次数的影响

迭代次数少，绳子软（会拉伸）。迭代次数多，绳子硬（接近刚性棍棒）。

```
1 次迭代：橡皮筋
5 次迭代：绳子
20 次迭代：棍棒
100 次迭代：基本刚性
```

物理引擎通常在 4-10 次之间取一个平衡。太多次迭代会变卡。

## 固定约束（Pin Constraint）

把一个粒子固定在世界空间的一个点上：

```ts
function solvePinConstraint(p: Particle, target: Vec2): void {
  if (p.inverseMass === 0) return
  p.position.x = target.x
  p.position.y = target.y
}
```

这就是上面例子里第一个粒子的约束。鼠标在哪里，它就在哪里。

## 可断裂约束

给约束加一个最大拉伸距离，超过就断开：

```ts
interface BreakableConstraint {
  a: number
  b: number
  distance: number
  maxStretch: number
  broken: boolean
}

function solveBreakableConstraint(c: BreakableConstraint, particles: Particle[]): void {
  if (c.broken) return
  const a = particles[c.a]
  const b = particles[c.b]
  const dx = b.position.x - a.position.x
  const dy = b.position.y - a.position.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist > c.distance * c.maxStretch) {
    c.broken = true
    return
  }

  solveDistanceConstraint(a, b, c.distance)
}
```

这可以用来模拟断裂的绳子或者布料的撕裂。

## 常见错误

**约束修正导致粒子被推出屏幕**。多个约束同时修正一个粒子时，修正量会累积。用 Verlet 积分时，下一帧的速度会自动调整，但极端情况下还是可能飞出去。

**迭代顺序影响结果**。先处理前面的约束还是后面的约束，结果不同。通常从一端到另一端迭代，绳子会更自然。

**忘记 inverseMass = 0 的处理**。两个都是静态粒子时，`totalInverseMass` 为零，要跳过。

## 练习

### 练习一：弹性的绳子

降低约束迭代次数（1-2 次），让绳子有弹性。甩动鼠标时绳子会大幅拉伸然后回弹。

### 练习二：断链

创建一根链条，用可断裂约束。快速移动固定点，让链条因为拉伸过大而断裂。

---

## 参考答案

### 练习一

```ts
const CONSTRAINT_ITERATIONS = 1  // 低迭代次数 = 弹性
const SEGMENT_LENGTH = 25
```

甩动鼠标时，绳子末端的粒子因为惯性继续运动，拉伸约束。低迭代次数意味着每帧只能修正一部分拉伸，看起来就是弹性的。

### 练习二

```ts
const breakableConstraints: BreakableConstraint[] = []
for (let i = 0; i < NUM_SEGMENTS; i++) {
  breakableConstraints.push({
    a: i, b: i + 1,
    distance: SEGMENT_LENGTH,
    maxStretch: 2.5,
    broken: false,
  })
}

function update() {
  // 在约束求解中检查断裂
  for (const c of breakableConstraints) {
    solveBreakableConstraint(c, particles)
  }
}
```

快速甩鼠标时，链条末端拉伸超过 2.5 倍就断开。断开后上面的粒子飞走，下面的粒子在重力下落。
