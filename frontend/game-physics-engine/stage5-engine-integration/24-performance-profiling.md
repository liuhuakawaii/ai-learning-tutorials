# 性能分析——碰撞检测次数、约束求解迭代、帧率监控

## 性能问题的来源

物理引擎的性能瓶颈通常在这几个地方：

1. **碰撞检测**：物体越多越慢，是 O(n²) 暴力检测或 O(n log n) 带空间分区
2. **约束求解**：迭代次数 × 约束数量
3. **内存分配**：每帧创建临时对象会触发 GC
4. **渲染**：物体太多时 Canvas/WebGL 也是瓶颈

不要猜，要量。先找到瓶颈，再优化。

## 计时器

最简单的性能工具：

```ts
class Timer {
  private marks = new Map<string, number>()
  private durations = new Map<string, number[]>()

  start(name: string): void {
    this.marks.set(name, performance.now())
  }

  end(name: string): void {
    const start = this.marks.get(name)
    if (start === undefined) return
    const duration = performance.now() - start
    let arr = this.durations.get(name)
    if (!arr) {
      arr = []
      this.durations.set(name, arr)
    }
    arr.push(duration)
    if (arr.length > 120) arr.shift()
  }

  getAverage(name: string): number {
    const arr = this.durations.get(name)
    if (!arr || arr.length === 0) return 0
    return arr.reduce((a, b) => a + b) / arr.length
  }

  getLast(name: string): number {
    const arr = this.durations.get(name)
    if (!arr || arr.length === 0) return 0
    return arr[arr.length - 1]
  }
}
```

## 在物理引擎中埋点

```ts
class MonitoredWorld extends World {
  timer = new Timer()
  stats = {
    bodyCount: 0,
    broadPhasePairs: 0,
    narrowPhaseChecks: 0,
    actualCollisions: 0,
    constraintIterations: 0,
  }

  step(dt: number): void {
    this.timer.start('total')

    this.timer.start('integrate')
    for (const body of this.bodies) {
      body.integrate(dt, this.gravity)
    }
    this.timer.end('integrate')

    this.timer.start('constraints')
    for (let iter = 0; iter < 4; iter++) {
      for (const constraint of this.constraints) {
        constraint.solve(dt)
      }
    }
    this.timer.end('constraints')

    this.timer.start('broadPhase')
    const pairs = this.broadPhase()
    this.timer.end('broadPhase')

    this.timer.start('narrowPhase')
    this.resolveCollisions(pairs)
    this.timer.end('narrowPhase')

    this.timer.end('total')

    this.stats.bodyCount = this.bodies.length
    this.stats.broadPhasePairs = pairs.length
  }
}
```

## 帧率监控

```ts
class FPSCounter {
  private frames: number[] = []
  private fps = 0
  private minFps = Infinity
  private maxFps = 0

  update(time: number): void {
    this.frames.push(time)
    while (this.frames.length > 0 && this.frames[0] < time - 1000) {
      this.frames.shift()
    }
    this.fps = this.frames.length
    if (this.fps < this.minFps) this.minFps = this.fps
    if (this.fps > this.maxFps) this.maxFps = this.fps
  }

  get current(): number { return this.fps }
  get min(): number { return this.minFps }
  get max(): number { return this.maxFps }

  reset(): void {
    this.minFps = Infinity
    this.maxFps = 0
  }
}
```

## 性能面板

把所有信息画在一个面板上：

```ts
class PerformancePanel {
  fpsCounter = new FPSCounter
  show = true
  history: { fps: number; broadPhase: number; narrowPhase: number; total: number }[] = []
  maxHistory = 120

  update(time: number, timer: Timer): void {
    this.fpsCounter.update(time)
    this.history.push({
      fps: this.fpsCounter.current,
      broadPhase: timer.getAverage('broadPhase'),
      narrowPhase: timer.getAverage('narrowPhase'),
      total: timer.getAverage('total'),
    })
    if (this.history.length > this.maxHistory) this.history.shift()
  }

  draw(ctx: CanvasRenderingContext2D, timer: Timer, stats: any): void {
    if (!this.show) return

    ctx.fillStyle = '#000000cc'
    ctx.fillRect(0, 0, 280, 200)

    ctx.fillStyle = '#fff'
    ctx.font = '11px monospace'
    const lines = [
      `FPS: ${this.fpsCounter.current} (min: ${this.fpsCounter.min} max: ${this.fpsCounter.max})`,
      `Bodies: ${stats.bodyCount}`,
      `Broad phase pairs: ${stats.broadPhasePairs}`,
      `--- Average times ---`,
      `Total: ${timer.getAverage('total').toFixed(2)}ms`,
      `Integrate: ${timer.getAverage('integrate').toFixed(2)}ms`,
      `Constraints: ${timer.getAverage('constraints').toFixed(2)}ms`,
      `Broad phase: ${timer.getAverage('broadPhase').toFixed(2)}ms`,
      `Narrow phase: ${timer.getAverage('narrowPhase').toFixed(2)}ms`,
    ]
    lines.forEach((line, i) => ctx.fillText(line, 5, 15 + i * 18))

    this.drawGraph(ctx)
  }

  private drawGraph(ctx: CanvasRenderingContext2D): void {
    if (this.history.length < 2) return

    const x = 5
    const y = 175
    const w = 270
    const h = 40
    const maxTime = 20

    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, h)

    ctx.strokeStyle = '#4a9eff'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < this.history.length; i++) {
      const px = x + (i / this.maxHistory) * w
      const py = y + h - (this.history[i].total / maxTime) * h
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    ctx.strokeStyle = '#ff6b6b'
    ctx.beginPath()
    for (let i = 0; i < this.history.length; i++) {
      const px = x + (i / this.maxHistory) * w
      const py = y + h - (this.history[i].broadPhase / maxTime) * h
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
}
```

## 内存分配优化

每帧创建临时对象会触发垃圾回收，导致帧率突然下降：

```ts
// 不好：每帧创建新对象
function bad(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

// 好：复用对象
const _tempVec: Vec2 = { x: 0, y: 0 }
function good(a: Vec2, b: Vec2): Vec2 {
  _tempVec.x = a.x + b.x
  _tempVec.y = a.y + b.y
  return _tempVec
}
```

对象池模式：

```ts
class ObjectPool<T> {
  private pool: T[] = []
  private factory: () => T

  constructor(factory: () => T) {
    this.factory = factory
  }

  acquire(): T {
    return this.pool.pop() ?? this.factory()
  }

  release(obj: T): void {
    this.pool.push(obj)
  }
}
```

## 基准测试

创建不同规模的场景，测量性能：

```ts
function benchmark(name: string, setup: () => World, steps: number): void {
  const world = setup()
  const start = performance.now()
  for (let i = 0; i < steps; i++) {
    world.step(1 / 60)
  }
  const elapsed = performance.now() - start
  console.log(`${name}: ${(elapsed / steps).toFixed(2)}ms/step, ${world.bodies.length} bodies`)
}

benchmark('100 circles', () => {
  const w = new World()
  for (let i = 0; i < 100; i++) w.addBody(new RigidBody(new CircleShape(10), Math.random() * 500, Math.random() * 500, 1))
  return w
}, 300)

benchmark('500 circles', () => {
  const w = new World()
  for (let i = 0; i < 500; i++) w.addBody(new RigidBody(new CircleShape(10), Math.random() * 500, Math.random() * 500, 1))
  return w
}, 300)
```

## 优化清单

按优先级排序：

1. **加空间分区**：暴力检测 → 网格/BVH，通常提升 10-100 倍
2. **减少对象分配**：对象池、预分配数组
3. **减少约束迭代**：从 10 次降到 4-6 次
4. **睡眠机制**：静止的物体不参与计算
5. **AABB 快速排除**：碰撞检测先检查 AABB
6. **批量渲染**：Canvas drawImage 或 WebGL instancing
7. **Web Workers**：碰撞检测放到 worker 线程

## 常见错误

**过早优化**。先 profile 找到瓶颈。可能渲染才是瓶颈，而不是物理。

**只看平均帧率**。平均 60fps 但每 10 帧掉到 20fps 的体验比稳定的 50fps 差得多。关注最低帧率和帧时间方差。

**忽略 GC 暂停**。JavaScript 的 GC 会导致不可预测的帧率下降。Chrome DevTools 的 Performance 面板能看到 GC 事件。

## 练习

### 练习一：性能回归测试

创建一个基准场景（200 个物体），记录每步的平均耗时。每次修改代码后运行基准，确保性能没有退化。

### 练习二：瓶颈定位

在一个有 1000 个物体的场景中，分别测量 broad phase、narrow phase、constraint solver 和 integration 的耗时。画出饼图。

---

## 参考答案

### 练习一

```ts
function regressionTest(): boolean {
  const world = createBenchmarkScene(200)
  const times: number[] = []
  for (let i = 0; i < 100; i++) {
    const start = performance.now()
    world.step(1 / 60)
    times.push(performance.now() - start)
  }
  const avg = times.reduce((a, b) => a + b) / times.length
  const baseline = 2.5 // 已知基线
  console.log(`Average: ${avg.toFixed(2)}ms, Baseline: ${baseline}ms`)
  return avg < baseline * 1.1 // 允许 10% 的波动
}
```

### 练习二

```ts
// 用 timer 的数据画饼图
const data = [
  { label: 'Integrate', value: timer.getAverage('integrate'), color: '#4a9eff' },
  { label: 'Constraints', value: timer.getAverage('constraints'), color: '#4ecdc4' },
  { label: 'Broad', value: timer.getAverage('broadPhase'), color: '#ff6b6b' },
  { label: 'Narrow', value: timer.getAverage('narrowPhase'), color: '#ffd93d' },
]
const total = data.reduce((s, d) => s + d.value, 0)
let angle = 0
for (const d of data) {
  const sliceAngle = (d.value / total) * Math.PI * 2
  ctx.fillStyle = d.color
  ctx.beginPath()
  ctx.moveTo(400, 300)
  ctx.arc(400, 300, 100, angle, angle + sliceAngle)
  ctx.fill()
  angle += sliceAngle
}
```
