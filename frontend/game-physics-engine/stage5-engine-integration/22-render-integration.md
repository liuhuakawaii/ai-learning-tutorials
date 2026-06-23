# 与渲染集成——将物理状态映射到 Canvas/WebGL

## 物理和渲染为什么要分离

物理引擎计算位置、角度、速度。渲染引擎画出来。两者的时间步不同，更新频率不同，混在一起会互相干扰。

分离后：
- 物理用固定时间步（60Hz），保证确定性
- 渲染用 requestAnimationFrame，帧率自由
- 物理代码不需要知道 Canvas 或 WebGL 的存在

## 渲染循环

```ts
const FIXED_DT = 1 / 60
let accumulator = 0
let lastTime = 0

function gameLoop(currentTime: number): void {
  const frameTime = Math.min((currentTime - lastTime) / 1000, 0.1)
  lastTime = currentTime
  accumulator += frameTime

  while (accumulator >= FIXED_DT) {
    world.step(FIXED_DT)
    accumulator -= FIXED_DT
  }

  const alpha = accumulator / FIXED_DT
  render(alpha)
  requestAnimationFrame(gameLoop)
}

requestAnimationFrame((time) => {
  lastTime = time
  requestAnimationFrame(gameLoop)
})
```

`alpha` 是插值因子。用于在两帧物理状态之间平滑渲染。

## 位置插值

物理更新不是每帧都发生。如果渲染 120fps 而物理 60fps，有一半的渲染帧物理没有更新。直接用最新的物理位置会导致物体看起来一卡一卡的。

插值解决这个问题：

```ts
interface RenderBody {
  body: RigidBody
  prevPosition: { x: number; y: number }
  prevAngle: number
  currPosition: { x: number; y: number }
  currAngle: number
}

function updateRenderState(renderBody: RenderBody): void {
  renderBody.prevPosition = { ...renderBody.currPosition }
  renderBody.prevAngle = renderBody.currAngle
  renderBody.currPosition = { ...renderBody.body.position }
  renderBody.currAngle = renderBody.body.angle
}

function getInterpolatedPosition(renderBody: RenderBody, alpha: number): { x: number; y: number; angle: number } {
  return {
    x: renderBody.prevPosition.x + (renderBody.currPosition.x - renderBody.prevPosition.x) * alpha,
    y: renderBody.prevPosition.y + (renderBody.currPosition.y - renderBody.prevPosition.y) * alpha,
    angle: renderBody.prevAngle + (renderBody.currAngle - renderBody.prevAngle) * alpha,
  }
}
```

## Canvas 渲染器

```ts
class CanvasRenderer {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  scale: number
  renderBodies: Map<RigidBody, RenderBody> = new Map()

  constructor(canvas: HTMLCanvasElement, scale = 1) {
    this.ctx = canvas.getContext('2d')!
    this.width = canvas.width
    this.height = canvas.height
    this.scale = scale
  }

  registerBody(body: RigidBody): void {
    this.renderBodies.set(body, {
      body,
      prevPosition: { ...body.position },
      prevAngle: body.angle,
      currPosition: { ...body.position },
      currAngle: body.angle,
    })
  }

  beginFrame(): void {
    this.ctx.clearRect(0, 0, this.width, this.height)
  }

  renderBody(body: RigidBody, alpha: number): void {
    const rb = this.renderBodies.get(body)
    if (!rb) return

    const pos = rb ? getInterpolatedPosition(rb, alpha) : { x: body.position.x, y: body.position.y, angle: body.angle }

    this.ctx.save()
    this.ctx.translate(pos.x * this.scale, pos.y * this.scale)
    this.ctx.rotate(pos.angle)

    if (body.shape.type === 'circle') {
      const circle = body.shape as CircleShape
      this.ctx.fillStyle = body.isStatic ? '#555' : '#4a9eff'
      this.ctx.beginPath()
      this.ctx.arc(0, 0, circle.radius * this.scale, 0, Math.PI * 2)
      this.ctx.fill()
    } else if (body.shape.type === 'polygon') {
      const poly = body.shape as PolygonShape
      this.ctx.fillStyle = body.isStatic ? '#555' : '#6bc5ff'
      this.ctx.beginPath()
      const v = poly.vertices
      this.ctx.moveTo(v[0].x * this.scale, v[0].y * this.scale)
      for (let i = 1; i < v.length; i++) {
        this.ctx.lineTo(v[i].x * this.scale, v[i].y * this.scale)
      }
      this.ctx.closePath()
      this.ctx.fill()
    }

    this.ctx.restore()
  }

  endFrame(): void {
    for (const [, rb] of this.renderBodies) {
      updateRenderState(rb)
    }
  }
}
```

## 摄像机

物理世界通常比屏幕大。摄像机控制视口位置：

```ts
class Camera {
  position: Vec2
  zoom: number
  target: RigidBody | null
  smoothing: number

  constructor() {
    this.position = { x: 0, y: 0 }
    this.zoom = 1
    this.target = null
    this.smoothing = 0.1
  }

  follow(body: RigidBody): void {
    this.target = body
  }

  update(): void {
    if (this.target) {
      this.position.x += (this.target.position.x - this.position.x) * this.smoothing
      this.position.y += (this.target.position.y - this.position.y) * this.smoothing
    }
  }

  applyToCtx(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    ctx.translate(canvasWidth / 2, canvasHeight / 2)
    ctx.scale(this.zoom, this.zoom)
    ctx.translate(-this.position.x, -this.position.y)
  }

  screenToWorld(sx: number, sy: number, canvasWidth: number, canvasHeight: number): Vec2 {
    return {
      x: (sx - canvasWidth / 2) / this.zoom + this.position.x,
      y: (sy - canvasHeight / 2) / this.zoom + this.position.y,
    }
  }
}
```

## 完整示例

```ts
const canvas = document.createElement('canvas')
canvas.width = 800
canvas.height = 600
document.body.appendChild(canvas)

const world = new World(vec2(0, 500))
const renderer = new CanvasRenderer(canvas)
const camera = new Camera()

const ground = new RigidBody(
  new PolygonShape([
    { x: -500, y: -15 }, { x: 500, y: -15 },
    { x: 500, y: 15 }, { x: -500, y: 15 },
  ]),
  400, 580, 1, true,
)
world.addBody(ground)
renderer.registerBody(ground)

const player = new RigidBody(new CircleShape(20), 400, 100, 1)
world.addBody(player)
renderer.registerBody(player)
camera.follow(player)

for (let i = 0; i < 30; i++) {
  const size = 15 + Math.random() * 20
  const body = new RigidBody(
    new PolygonShape([
      { x: -size, y: -size }, { x: size, y: -size },
      { x: size, y: size }, { x: -size, y: size },
    ]),
    Math.random() * 700 + 50,
    Math.random() * 400 + 50,
    1,
  )
  world.addBody(body)
  renderer.registerBody(body)
}

let lastTime = 0
let accumulator = 0

function loop(currentTime: number): void {
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1)
  lastTime = currentTime
  accumulator += dt

  while (accumulator >= FIXED_DT) {
    world.step(FIXED_DT)
    accumulator -= FIXED_DT
  }

  camera.update()
  renderer.beginFrame()

  canvas.getContext('2d')!.save()
  camera.applyToCtx(canvas.getContext('2d')!, 800, 600)

  for (const body of world.bodies) {
    renderer.renderBody(body, accumulator / FIXED_DT)
  }

  canvas.getContext('2d')!.restore()
  renderer.endFrame()

  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
```

## WebGL 渲染

Canvas 2D 对几百个物体够用。上千个物体时需要 WebGL：

```ts
class WebGLRenderer {
  gl: WebGLRenderingContext
  program: WebGLProgram
  positionBuffer: WebGLBuffer

  constructor(canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl')!
    this.program = this.createProgram()
    this.positionBuffer = this.gl.createBuffer()!
  }

  private createProgram(): WebGLProgram {
    const gl = this.gl
    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, `
      attribute vec2 a_position;
      uniform vec2 u_resolution;
      uniform vec2 u_translation;
      uniform float u_rotation;
      void main() {
        float c = cos(u_rotation);
        float s = sin(u_rotation);
        vec2 rotated = vec2(
          a_position.x * c - a_position.y * s,
          a_position.x * s + a_position.y * c
        );
        vec2 position = (rotated + u_translation) / u_resolution * 2.0 - 1.0;
        gl_Position = vec4(position * vec2(1, -1), 0, 1);
      }
    `)
    gl.compileShader(vs)

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, `
      precision mediump float;
      uniform vec4 u_color;
      void main() { gl_FragColor = u_color; }
    `)
    gl.compileShader(fs)

    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    return program
  }

  renderCircle(x: number, y: number, radius: number, angle: number): void {
    const gl = this.gl
    gl.useProgram(this.program)

    const segments = 24
    const verts: number[] = []
    for (let i = 0; i < segments; i++) {
      const a1 = (Math.PI * 2 * i) / segments
      const a2 = (Math.PI * 2 * (i + 1)) / segments
      verts.push(0, 0, radius * Math.cos(a1), radius * Math.sin(a1), radius * Math.cos(a2), radius * Math.sin(a2))
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW)

    const posLoc = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    gl.uniform2f(gl.getUniformLocation(this.program, 'u_resolution')!, 800, 600)
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_translation')!, x, y)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_rotation')!, angle)
    gl.uniform4f(gl.getUniformLocation(this.program, 'u_color')!, 0.29, 0.62, 1, 1)

    gl.drawArrays(gl.TRIANGLES, 0, segments * 3)
  }
}
```

WebGL 渲染的代码量比 Canvas 2D 大很多，但性能好一个数量级。

## 常见错误

**物理和渲染的时间步混用**。物理必须用固定时间步，渲染用可变时间步。不要用渲染帧率来驱动物理。

**没有插值**。物理 60fps + 渲染 120fps 时，物体看起来会抖动。插值让中间帧平滑过渡。

**摄像机变换影响物理坐标**。鼠标点击坐标需要从屏幕空间转换到世界空间。

## 练习

### 练习一：滚动摄像机

让摄像机跟随一个滚动的球。球可以滚到屏幕外面，摄像机自动跟随。

### 练习二：物理场景编辑器

鼠标点击在世界坐标处创建物体。右键删除最近的物体。

---

## 参考答案

### 练习一

```ts
camera.follow(player)
// 在 loop 中
camera.update()
ctx.save()
camera.applyToCtx(ctx, 800, 600)
// 渲染所有物体
ctx.restore()
```

### 练习二

```ts
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect()
  const worldPos = camera.screenToWorld(
    e.clientX - rect.left, e.clientY - rect.top, 800, 600,
  )
  const body = new RigidBody(new CircleShape(15), worldPos.x, worldPos.y, 1)
  world.addBody(body)
  renderer.registerBody(body)
})
```
