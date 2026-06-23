# 运动学——位置、速度、加速度、积分器

## 为什么不能直接用 `position += velocity`

上一阶段的弹球模拟用的就是这种方式。看起来能跑，但有几个问题：

- 帧率变慢时物体也变慢
- 快速移动的物体会穿墙
- 物体的行为依赖帧率

这些都指向同一个根因：物理更新和时间没有正确关联。

## 三个基本量

- **位置**（position）：物体在哪里
- **速度**（velocity）：位置的变化率
- **加速度**（acceleration）：速度的变化率

加速度由力产生（F = ma），速度由加速度累积，位置由速度累积。这个累积过程就是"积分"。

## Euler 积分——最简单但有坑

```ts
interface Body {
  position: { x: number; y: number }
  velocity: { x: number; y: number }
  acceleration: { x: number; y: number }
}

function eulerStep(body: Body, dt: number): void {
  body.velocity.x += body.acceleration.x * dt
  body.velocity.y += body.acceleration.y * dt
  body.position.x += body.velocity.x * dt
  body.position.y += body.velocity.y * dt
}
```

每帧用固定的时间步 `dt`（比如 1/60 秒）。

Euler 积分的问题是"能量漂移"。在弹簧系统里特别明显——弹簧会越振越大，因为 Euler 在每步开始时用旧的速度算位置，误差会累积。

## 半隐式 Euler（Symplectic Euler）

先更新速度，再用新速度更新位置。只改一行顺序：

```ts
function symplecticEuler(body: Body, dt: number): void {
  body.velocity.x += body.acceleration.x * dt
  body.velocity.y += body.acceleration.y * dt
  body.position.x += body.velocity.x * dt  // 用的是刚更新的速度
  body.position.y += body.velocity.y * dt
}
```

这个改动看起来微不足道，但效果好很多。弹簧系统的能量基本守恒，不会越振越大。大多数 2D 物理引擎用的就是半隐式 Euler。

## Verlet 积分——没有显式速度

Verlet 的思路完全不同。它不存速度，只存当前位置和上一帧的位置：

```ts
interface VerletBody {
  position: { x: number; y: number }
  previousPosition: { x: number; y: number }
  acceleration: { x: number; y: number }
}

function verletStep(body: VerletBody, dt: number): void {
  const tempX = body.position.x
  const tempY = body.position.y

  body.position.x = 2 * body.position.x - body.previousPosition.x + body.acceleration.x * dt * dt
  body.position.y = 2 * body.position.y - body.previousPosition.y + body.acceleration.y * dt * dt

  body.previousPosition.x = tempX
  body.previousPosition.y = tempY
}
```

速度隐含在 `position - previousPosition` 里。要获取速度时：

```ts
function getVelocity(body: VerletBody, dt: number): { x: number; y: number } {
  return {
    x: (body.position.x - body.previousPosition.x) / dt,
    y: (body.position.y - body.previousPosition.y) / dt,
  }
}
```

Verlet 的优势是对约束求解特别友好。后面做绳索模拟时会用到它。

## RK4——最精确但最贵

Runge-Kutta 4 阶（RK4）在每步内采样 4 次，加权平均得到更精确的结果：

```ts
interface State {
  x: number
  y: number
  vx: number
  vy: number
}

interface Derivative {
  dx: number
  dy: number
  dvx: number
  dvy: number
}

function evaluate(
  state: State,
  dt: number,
  derivative: Derivative,
  accel: (state: State) => { ax: number; ay: number },
): Derivative {
  const newState: State = {
    x: state.x + derivative.dx * dt,
    y: state.y + derivative.dy * dt,
    vx: state.vx + derivative.dvx * dt,
    vy: state.vy + derivative.dvy * dt,
  }
  const a = accel(newState)
  return { dx: newState.vx, dy: newState.vy, dvx: a.ax, dvy: a.ay }
}

function rk4Step(
  state: State,
  dt: number,
  accel: (state: State) => { ax: number; ay: number },
): void {
  const a = evaluate(state, 0, { dx: 0, dy: 0, dvx: 0, dvy: 0 }, accel)
  const b = evaluate(state, dt * 0.5, a, accel)
  const c = evaluate(state, dt * 0.5, b, accel)
  const d = evaluate(state, dt, c, accel)

  state.x += ((a.dx + 2 * (b.dx + c.dx) + d.dx) / 6) * dt
  state.y += ((a.dy + 2 * (b.dy + c.dy) + d.dy) / 6) * dt
  state.vx += ((a.dvx + 2 * (b.dvx + c.dvx) + d.dvx) / 6) * dt
  state.vy += ((a.dvy + 2 * (b.dvy + c.dvy) + d.dvy) / 6) * dt
}
```

RK4 在物理模拟精度要求高的场景（比如弹道计算、天体模拟）很有用。但对大多数游戏来说，半隐式 Euler 就够了。

## 固定时间步

不管帧率是多少，物理模拟都应该用固定的时间步：

```ts
const FIXED_DT = 1 / 60
let accumulator = 0

function gameLoop(currentTime: number): void {
  const frameTime = Math.min((currentTime - lastTime) / 1000, 0.1)
  lastTime = currentTime
  accumulator += frameTime

  while (accumulator >= FIXED_DT) {
    physicsStep(FIXED_DT)
    accumulator -= FIXED_DT
  }

  render()
  requestAnimationFrame(gameLoop)
}
```

这叫"固定时间步 + 插值渲染"。物理每秒更新 60 次（或者你设的频率），渲染帧率可以自由变化。

## 完整示例：三种积分器对比

```ts
const canvas = document.createElement('canvas')
canvas.width = 800
canvas.height = 400
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

const SPRING_K = 50
const DAMPING = 0.5
const REST_LENGTH = 100

interface SpringBody {
  x: number
  y: number
  vx: number
  vy: number
  prevX?: number
  prevY?: number
  label: string
  color: string
}

const bodies: SpringBody[] = [
  { x: 200, y: 200, vx: 0, vy: 0, label: 'Euler', color: '#ff6b6b' },
  { x: 400, y: 200, vx: 0, vy: 0, label: 'Symplectic', color: '#4ecdc4' },
  { x: 600, y: 200, vx: 0, vy: 0, prevX: 600, prevY: 210, label: 'Verlet', color: '#ffd93d' },
]

const anchorY = 100
const DT = 1 / 60

function springForce(body: SpringBody): { ax: number; ay: number } {
  const dy = body.y - anchorY
  const springF = -SPRING_K * (dy - REST_LENGTH)
  const dampF = -DAMPING * body.vy
  return { ax: 0, ay: (springF + dampF) }
}

function eulerUpdate(body: SpringBody) {
  const f = springForce(body)
  body.vx += f.ax * DT
  body.vy += f.ay * DT
  body.x += body.vx * DT
  body.y += body.vy * DT
}

function symplecticUpdate(body: SpringBody) {
  const f = springForce(body)
  body.vx += f.ax * DT
  body.vy += f.ay * DT
  body.x += body.vx * DT
  body.y += body.vy * DT
}

function verletUpdate(body: SpringBody) {
  const f = springForce(body)
  const tempX = body.x
  const tempY = body.y
  body.x = 2 * body.x - (body.prevX ?? body.x) + f.ax * DT * DT
  body.y = 2 * body.y - (body.prevY ?? body.y) + f.ay * DT * DT
  body.prevX = tempX
  body.prevY = tempY
}

function draw() {
  ctx.clearRect(0, 0, 800, 400)

  for (const body of bodies) {
    ctx.strokeStyle = body.color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(body.x, anchorY)
    ctx.lineTo(body.x, body.y)
    ctx.stroke()

    ctx.fillStyle = body.color
    ctx.beginPath()
    ctx.arc(body.x, body.y, 15, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#fff'
    ctx.font = '14px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(body.label, body.x, body.y - 25)
  }
}

function loop() {
  eulerUpdate(bodies[0])
  symplecticUpdate(bodies[1])
  verletUpdate(bodies[2])
  draw()
  requestAnimationFrame(loop)
}
loop()
```

运行后观察三个球的振荡。Euler 的球会越振越大，Symplectic 和 Verlet 基本保持稳定。

## 常见错误

**用可变时间步做物理**。`requestAnimationFrame` 的回调间隔不固定，直接用它做物理会导致不同帧率下物理行为不一致。

**积分顺序错误**。Euler 和 Symplectic Euler 的区别就是先更新速度还是先更新位置。顺序错了，能量就不守恒。

**忘记归一化时间单位**。力的单位是牛顿，质量是千克，时间是秒。如果 dt 用毫秒或者位置用像素，比例关系就全乱了。

## 练习

### 练习一：弹道轨迹

用 Euler 和 RK4 分别模拟一个抛射物（初速度 50 m/s，角度 45 度，重力 9.8 m/s²）。对比 10 秒后的位置误差。

### 练习二：积分器能量守恒

创建一个弹簧振子系统，记录每帧的总能量（动能 + 势能）。用图表展示三种积分器的能量变化曲线。

---

## 参考答案

### 练习一

```ts
const initial = { x: 0, y: 0, vx: 50 * Math.cos(Math.PI / 4), vy: 50 * Math.sin(Math.PI / 4) }
const gravity = { ax: 0, ay: -9.8 }

let euler = { ...initial }
let rk4State = { x: initial.x, y: initial.y, vx: initial.vx, vy: initial.vy }

for (let t = 0; t < 10; t += DT) {
  euler.vx += gravity.ax * DT
  euler.vy += gravity.ay * DT
  euler.x += euler.vx * DT
  euler.y += euler.vy * DT

  rk4Step(rk4State, DT, () => gravity)
}

console.log('Euler:', euler.x.toFixed(2), euler.y.toFixed(2))
console.log('RK4:', rk4State.x.toFixed(2), rk4State.y.toFixed(2))
```

RK4 的结果更接近解析解。Euler 的误差在小 dt 时可以接受，但 dt 大了就会明显偏移。

### 练习二

```ts
function totalEnergy(body: SpringBody): number {
  const kinetic = 0.5 * (body.vx * body.vx + body.vy * body.vy)
  const dy = body.y - anchorY
  const potential = 0.5 * SPRING_K * (dy - REST_LENGTH) * (dy - REST_LENGTH)
  return kinetic + potential
}
```

每帧记录 `totalEnergy()` 的值，画折线图。Euler 的能量会逐渐增大，Symplectic 基本持平。
