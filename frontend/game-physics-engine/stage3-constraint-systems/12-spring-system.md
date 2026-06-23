# 弹簧系统——胡克定律、阻尼、弹簧链

## 弹簧不只是物理课上的东西

游戏里的弹簧无处不在。角色跟随摄像机的平滑移动是弹簧。UI 元素的弹性动画是弹簧。绳子的物理行为本质上也是弹簧（只是刚度很高）。

弹簧的核心是胡克定律：力 = 刚度 × 偏移量。偏离平衡位置多远，就受到多大的恢复力。

## 胡克定律

```ts
interface Vec2 { x: number; y: number }

function hookeForce(
  position: Vec2,
  anchor: Vec2,
  restLength: number,
  stiffness: number,
): Vec2 {
  const dx = position.x - anchor.x
  const dy = position.y - anchor.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return { x: 0, y: 0 }

  const stretch = dist - restLength
  const nx = dx / dist
  const ny = dy / dist
  return { x: -stiffness * stretch * nx, y: -stiffness * stretch * ny }
}
```

`stiffness` 越大，弹簧越硬。`restLength` 是弹簧的自然长度。拉长了会往回收，压缩了会往外推。

## 阻尼

没有阻尼的弹簧会永远振荡。现实中的弹簧有摩擦，振幅会逐渐减小。

```ts
function dampedSpringForce(
  position: Vec2,
  velocity: Vec2,
  anchor: Vec2,
  anchorVelocity: Vec2,
  restLength: number,
  stiffness: number,
  damping: number,
): Vec2 {
  const dx = position.x - anchor.x
  const dy = position.y - anchor.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return { x: 0, y: 0 }

  const nx = dx / dist
  const ny = dy / dist
  const stretch = dist - restLength

  const relVx = velocity.x - anchorVelocity.x
  const relVy = velocity.y - anchorVelocity.y
  const relVn = relVx * nx + relVy * ny

  const force = stiffness * stretch + damping * relVn
  return { x: -force * nx, y: -force * ny }
}
```

`damping` 是沿弹簧方向的速度阻尼。力的方向分两部分：弹簧的弹性力（拉回平衡位置）和阻尼力（抵抗相对运动）。

## 临界阻尼

阻尼大小决定了弹簧的行为：

- **欠阻尼**（damping < 临界值）：振荡，逐渐衰减
- **临界阻尼**（damping = 临界值）：最快回到平衡位置，不振荡
- **过阻尼**（damping > 临界值）：缓慢回到平衡位置，不振荡

临界阻尼系数：`damping_critical = 2 * sqrt(stiffness * mass)`

游戏里通常用欠阻尼（让物体有弹跳感）或临界阻尼（让摄像机平滑跟随）。

## 弹簧链

多个粒子用弹簧连接，形成弹簧链。和距离约束不同，弹簧链有真实的弹性和阻尼：

```ts
interface Particle {
  position: Vec2
  velocity: Vec2
  mass: number
  inverseMass: number
}

interface Spring {
  a: number
  b: number
  restLength: number
  stiffness: number
  damping: number
}
```

## 完整示例：弹簧链 + 重力

```ts
const canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 400
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

const GRAVITY: Vec2 = { x: 0, y: 400 }
const DT = 1 / 60

const particles: Particle[] = []
const springs: Spring[] = []

const NUM = 10
for (let i = 0; i <= NUM; i++) {
  particles.push({
    position: { x: 300, y: 50 + i * 25 },
    velocity: { x: 0, y: 0 },
    mass: 1,
    inverseMass: i === 0 ? 0 : 1,
  })
}

for (let i = 0; i < NUM; i++) {
  springs.push({
    a: i, b: i + 1,
    restLength: 25,
    stiffness: 800,
    damping: 20,
  })
}

let mouseX = 300, mouseY = 50
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect()
  mouseX = e.clientX - rect.left
  mouseY = e.clientY - rect.top
})

function update() {
  particles[0].position.x = mouseX
  particles[0].position.y = mouseY
  particles[0].velocity.x = 0
  particles[0].velocity.y = 0

  for (const p of particles) {
    if (p.inverseMass === 0) continue
    p.velocity.x += GRAVITY.x * DT
    p.velocity.y += GRAVITY.y * DT
  }

  for (const s of springs) {
    const a = particles[s.a]
    const b = particles[s.b]
    const force = dampedSpringForce(
      a.position, a.velocity,
      b.position, b.velocity,
      s.restLength, s.stiffness, s.damping,
    )
    a.velocity.x += force.x * a.inverseMass * DT
    a.velocity.y += force.y * a.inverseMass * DT
    b.velocity.x -= force.x * b.inverseMass * DT
    b.velocity.y -= force.y * b.inverseMass * DT
  }

  for (const p of particles) {
    if (p.inverseMass === 0) continue
    p.position.x += p.velocity.x * DT
    p.position.y += p.velocity.y * DT
  }
}

function draw() {
  ctx.clearRect(0, 0, 600, 400)

  ctx.strokeStyle = '#8b7355'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(particles[0].position.x, particles[0].position.y)
  for (let i = 1; i < particles.length; i++) {
    ctx.lineTo(particles[i].position.x, particles[i].position.y)
  }
  ctx.stroke()

  for (const p of particles) {
    ctx.fillStyle = p.inverseMass === 0 ? '#ff0' : '#4a9eff'
    ctx.beginPath()
    ctx.arc(p.position.x, p.position.y, 5, 0, Math.PI * 2)
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

拖动鼠标移动顶部粒子，链条在弹簧力和重力作用下自然摆动。

## 弹簧 vs 距离约束

| | 弹簧 | 距离约束 |
|---|---|---|
| 拉伸 | 可以拉伸 | 不拉伸（迭代够多） |
| 弹性 | 有 | 无 |
| 性能 | 每粒子一次力计算 | 每约束多次迭代 |
| 适用 | 柔性物体、弹性连接 | 刚性连接、棍棒 |

很多引擎混合使用两者。软的东西用弹簧，硬的东西用约束。

## 弹簧在游戏中的应用

**摄像机跟随**：用弹簧把摄像机连到角色。角色突然移动时摄像机不会瞬间跟上，而是有一个弹性延迟。

**布料模拟**：网格状的弹簧连接。水平和垂直方向用距离约束保持形状，对角线用弹簧防止过度剪切变形。

**物理 UI**：按钮按下时的弹性回弹、列表滚动的弹性边界。

## 常见错误

**dt 太大导致弹簧爆炸**。Euler 积分对弹簧系统很敏感。dt > 2 * sqrt(mass / stiffness) 时弹簧会发散。解决方案：用更小的 dt，或者用半隐式 Euler。

**刚度和阻尼没有配合**。刚度很高但阻尼很低，物体会疯狂振荡。通常 `damping` 设为 `stiffness * 0.02` 到 `stiffness * 0.1` 之间。

**弹簧力方向算反**。力应该把物体拉向平衡位置。如果方向反了，弹簧会把物体推开。

## 练习

### 练习一：弹簧秤

一个粒子挂在弹簧下端，添加不同的重量（改变质量），观察弹簧拉伸量。验证胡克定律。

### 练习二：双弹簧系统

两个粒子分别挂在两根弹簧下端，中间再用一根弹簧连起来。观察耦合振荡。

---

## 参考答案

### 练习一

```ts
const spring: Spring = { a: 0, b: 1, restLength: 50, stiffness: 200, damping: 10 }
const anchor: Particle = { position: { x: 300, y: 50 }, velocity: { x: 0, y: 0 }, mass: 1, inverseMass: 0 }
let weight: Particle = { position: { x: 300, y: 100 }, velocity: { x: 0, y: 0 }, mass: 1, inverseMass: 1 }

// 改变 weight.mass 观察平衡位置
// 平衡时：k * stretch = m * g
// stretch = m * g / k
```

质量 1 时拉伸约 0.05 * g / 200，质量 2 时拉伸翻倍。

### 练习二

```ts
const particles = [
  { position: { x: 200, y: 50 }, velocity: { x: 0, y: 0 }, mass: 1, inverseMass: 0 },
  { position: { x: 200, y: 150 }, velocity: { x: 0, y: 0 }, mass: 1, inverseMass: 1 },
  { position: { x: 400, y: 50 }, velocity: { x: 0, y: 0 }, mass: 1, inverseMass: 0 },
  { position: { x: 400, y: 200 }, velocity: { x: 0, y: 0 }, mass: 1.5, inverseMass: 1/1.5 },
]

const springs = [
  { a: 0, b: 1, restLength: 80, stiffness: 300, damping: 5 },
  { a: 2, b: 3, restLength: 80, stiffness: 300, damping: 5 },
  { a: 1, b: 3, restLength: 150, stiffness: 100, damping: 3 },
]
```

两个不同质量的摆通过中间弹簧耦合。质量差导致两个摆的振荡频率不同，能量通过中间弹簧在两者之间传递。
