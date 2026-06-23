# 实时数据流——WebSocket 数据接入、增量更新

## 场景

监控大屏的数据不是静态的——CPU 使用率每秒变化，网络流量实时波动，告警随时产生。这节课把 WebSocket 接入 Three.js 可视化，实现数据的实时推流和增量渲染。

## WebSocket 数据协议

先定义服务端推送的数据格式：

```ts
interface MetricUpdate {
  type: 'metric'
  timestamp: number
  source: string
  metrics: {
    cpu: number
    memory: number
    networkIn: number
    networkOut: number
    diskIO: number
    requests: number
  }
}

interface AlertEvent {
  type: 'alert'
  timestamp: number
  source: string
  level: 'warning' | 'error' | 'critical'
  message: string
}

type DataMessage = MetricUpdate | AlertEvent
```

## 连接管理

```ts
class DataConnection {
  private ws: WebSocket | null = null
  private buffer: DataMessage[] = []
  private listeners: ((msg: DataMessage) => void)[] = []
  private reconnectTimer: number | null = null

  constructor(private url: string) {}

  connect() {
    this.ws = new WebSocket(this.url)

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as DataMessage
      this.buffer.push(msg)
      this.listeners.forEach(fn => fn(msg))
    }

    this.ws.onclose = () => {
      this.reconnectTimer = window.setTimeout(() => this.connect(), 3000)
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  onMessage(fn: (msg: DataMessage) => void) {
    this.listeners.push(fn)
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }
}
```

## 模拟数据源

没有真实 WebSocket 服务时，用模拟数据：

```ts
class MockDataSource {
  private listeners: ((msg: DataMessage) => void)[] = []
  private interval: number | null = null
  private sources = ['web-1', 'web-2', 'web-3', 'api-1', 'api-2', 'db-1']

  start(intervalMs: number = 1000) {
    this.interval = window.setInterval(() => {
      this.sources.forEach(source => {
        const msg: MetricUpdate = {
          type: 'metric',
          timestamp: Date.now(),
          source,
          metrics: {
            cpu: 20 + Math.random() * 60 + Math.sin(Date.now() / 60000) * 15,
            memory: 40 + Math.random() * 40,
            networkIn: Math.random() * 1000,
            networkOut: Math.random() * 800,
            diskIO: Math.random() * 500,
            requests: 100 + Math.random() * 1000,
          },
        }
        this.listeners.forEach(fn => fn(msg))
      })

      // 随机告警
      if (Math.random() > 0.92) {
        const alert: AlertEvent = {
          type: 'alert',
          timestamp: Date.now(),
          source: this.sources[Math.floor(Math.random() * this.sources.length)],
          level: Math.random() > 0.7 ? 'error' : 'warning',
          message: 'CPU 使用率超过阈值',
        }
        this.listeners.forEach(fn => fn(alert))
      }
    }, intervalMs)
  }

  onMessage(fn: (msg: DataMessage) => void) {
    this.listeners.push(fn)
  }

  stop() {
    if (this.interval) clearInterval(this.interval)
  }
}
```

## 数据缓冲与时间窗口

实时数据需要维护一个滑动窗口——保留最近 N 秒的数据：

```ts
class TimeWindowBuffer {
  private buffers = new Map<string, MetricUpdate[]>()
  private windowDuration: number

  constructor(windowDurationMs: number = 60000) {
    this.windowDuration = windowDurationMs
  }

  add(update: MetricUpdate) {
    if (!this.buffers.has(update.source)) {
      this.buffers.set(update.source, [])
    }
    const buf = this.buffers.get(update.source)!
    buf.push(update)

    // 清理过期数据
    const cutoff = Date.now() - this.windowDuration
    while (buf.length > 0 && buf[0].timestamp < cutoff) {
      buf.shift()
    }
  }

  getLatest(source: string): MetricUpdate | undefined {
    const buf = this.buffers.get(source)
    return buf?.[buf.length - 1]
  }

  getWindow(source: string): MetricUpdate[] {
    return this.buffers.get(source) || []
  }

  getAllSources(): string[] {
    return [...this.buffers.keys()]
  }
}
```

## Three.js 增量渲染

每个服务器用一个 3D 对象表示，指标映射到视觉属性：

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0a1a)

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200)
camera.position.set(0, 12, 18)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

scene.add(new THREE.AmbientLight(0xffffff, 0.5))
const dirLight = new THREE.DirectionalLight(0xffffff, 0.7)
dirLight.position.set(5, 10, 5)
scene.add(dirLight)

// 每个源一个柱子
const sourcePositions = new Map<string, THREE.Vector3>()
const sourceMeshes = new Map<string, THREE.Mesh>()
const barGeometries = new Map<string, THREE.BufferGeometry>()

const sources = ['web-1', 'web-2', 'web-3', 'api-1', 'api-2', 'db-1']
const sourceSpacing = 3

sources.forEach((source, i) => {
  const x = (i - (sources.length - 1) / 2) * sourceSpacing
  const pos = new THREE.Vector3(x, 0, 0)
  sourcePositions.set(source, pos)

  const geo = new THREE.CylinderGeometry(0.4, 0.4, 1, 16)
  geo.translate(0, 0.5, 0)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4fc3f7,
    roughness: 0.4,
    metalness: 0.3,
    transparent: true,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.copy(pos)
  mesh.userData = { source }
  scene.add(mesh)
  sourceMeshes.set(source, mesh)
  barGeometries.set(source, geo)
})
```

## 实时更新渲染

收到新数据后，增量更新柱子高度和颜色：

```ts
const buffer = new TimeWindowBuffer(60000)

function updateVisualization(update: MetricUpdate) {
  buffer.add(update)

  const mesh = sourceMeshes.get(update.source)
  if (!mesh) return

  const cpu = update.metrics.cpu
  const targetHeight = 0.5 + (cpu / 100) * 8

  // 平滑过渡
  const currentHeight = mesh.scale.y
  mesh.scale.y += (targetHeight - currentHeight) * 0.15

  // 颜色映射
  const mat = mesh.material as THREE.MeshStandardMaterial
  const t = cpu / 100
  mat.color.lerpColors(
    new THREE.Color(0x4fc3f7),
    new THREE.Color(0xff4444),
    t
  )
  mat.emissive.lerpColors(
    new THREE.Color(0x000000),
    new THREE.Color(0x440000),
    t * 0.5
  )
}
```

## Mini 图表（sparkline）

在每个柱子旁边显示最近的 CPU 折线：

```ts
class Sparkline {
  private geometry: THREE.BufferGeometry
  private material: THREE.LineBasicMaterial
  private line: THREE.Line
  private positions: Float32Array
  private maxPoints: number

  constructor(scene: THREE.Scene, maxPoints: number, color: number) {
    this.maxPoints = maxPoints
    this.positions = new Float32Array(maxPoints * 3)
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 })
    this.line = new THREE.Line(this.geometry, this.material)
    scene.add(this.line)
  }

  update(values: number[], origin: THREE.Vector3, width: number, height: number) {
    const startIdx = Math.max(0, values.length - this.maxPoints)
    const visible = values.slice(startIdx)
    const step = width / (this.maxPoints - 1)

    for (let i = 0; i < this.maxPoints; i++) {
      const v = i < visible.length ? visible[i] : 0
      this.positions[i * 3] = origin.x - width / 2 + i * step
      this.positions[i * 3 + 1] = origin.y + (v / 100) * height
      this.positions[i * 3 + 2] = origin.z + 0.5
    }

    this.geometry.setDrawRange(0, Math.min(visible.length, this.maxPoints))
    this.geometry.attributes.position.needsUpdate = true
  }
}

const sparklines = new Map<string, Sparkline>()
sources.forEach((source, i) => {
  sparklines.set(source, new Sparkline(scene, 60, seriesColors[i % seriesColors.length]))
})
```

## 告警效果

收到告警时在对应柱子上做脉冲动画：

```ts
const alertEffects: { mesh: THREE.Mesh; start: number; level: string }[] = []

function triggerAlert(alert: AlertEvent) {
  const mesh = sourceMeshes.get(alert.source)
  if (!mesh) return

  const ringGeo = new THREE.RingGeometry(0.5, 0.8, 32)
  const ringMat = new THREE.MeshBasicMaterial({
    color: alert.level === 'error' ? 0xff4444 : 0xffaa00,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.position.copy(mesh.position)
  ring.position.y += mesh.scale.y
  ring.rotation.x = -Math.PI / 2
  scene.add(ring)

  alertEffects.push({ mesh: ring, start: Date.now(), level: alert.level })
}

// 在动画循环中更新告警效果
function updateAlerts() {
  for (let i = alertEffects.length - 1; i >= 0; i--) {
    const effect = alertEffects[i]
    const elapsed = (Date.now() - effect.start) / 1000
    const scale = 1 + elapsed * 3
    const opacity = Math.max(0, 1 - elapsed)

    effect.mesh.scale.setScalar(scale)
    ;(effect.mesh.material as THREE.MeshBasicMaterial).opacity = opacity * 0.8

    if (opacity <= 0) {
      scene.remove(effect.mesh)
      alertEffects.splice(i, 1)
    }
  }
}
```

## 动画循环

```ts
function animate() {
  requestAnimationFrame(animate)
  updateAlerts()
  controls.update()
  renderer.render(scene, camera)
}
animate()

// 启动数据源
const dataSource = new MockDataSource()
dataSource.onMessage(msg => {
  if (msg.type === 'metric') {
    updateVisualization(msg)
    // 更新 sparkline
    const cpuValues = buffer.getWindow(msg.source).map(u => u.metrics.cpu)
    sparklines.get(msg.source)?.update(
      cpuValues,
      sourcePositions.get(msg.source)!,
      2,
      3
    )
  } else if (msg.type === 'alert') {
    triggerAlert(msg)
  }
})
dataSource.start(1000)
```

## 练习

### 练习一：数据面板

在侧边栏实时显示每个服务器的当前 CPU、内存、网络指标，数值变化时做闪烁提示。

### 练习二：历史回放

加一个时间滑块，可以回放过去 60 秒的历史数据。

---

## 参考答案

### 练习一

```ts
const panel = document.createElement('div')
panel.style.cssText = 'position: fixed; left: 10px; top: 10px; width: 200px; background: rgba(0,0,0,0.8); padding: 12px; border-radius: 6px; color: #ccc; font-size: 12px;'
document.body.appendChild(panel)

const metricElements = new Map<string, HTMLDivElement>()

sources.forEach(source => {
  const div = document.createElement('div')
  div.style.cssText = 'margin-bottom: 8px; padding: 6px; background: rgba(255,255,255,0.05); border-radius: 4px;'
  div.innerHTML = `<div style="font-weight: bold; color: #4fc3f7;">${source}</div>
    <div class="metrics">等待数据...</div>`
  panel.appendChild(div)
  metricElements.set(source, div.querySelector('.metrics') as HTMLDivElement)
})

dataSource.onMessage(msg => {
  if (msg.type !== 'metric') return
  const el = metricElements.get(msg.source)
  if (!el) return

  const prev = buffer.getLatest(msg.source)
  const changed = prev && Math.abs(prev.metrics.cpu - msg.metrics.cpu) > 5

  el.innerHTML = `
    CPU: <span style="color: ${msg.metrics.cpu > 80 ? '#ff4444' : '#66bb6a'}">${msg.metrics.cpu.toFixed(1)}%</span>
    | MEM: ${msg.metrics.memory.toFixed(1)}%
    | NET: ${msg.metrics.networkIn.toFixed(0)} in
  `

  if (changed) {
    el.style.transition = 'background 0.3s'
    el.style.background = 'rgba(255,100,100,0.2)'
    setTimeout(() => { el.style.background = 'transparent' }, 300)
  }
})
```

### 练习二

```ts
const slider = document.createElement('input')
slider.type = 'range'
slider.min = '0'
slider.max = '60'
slider.value = '60'
slider.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: 400px;'
document.body.appendChild(slider)

let isLive = true

slider.addEventListener('input', () => {
  isLive = parseInt(slider.value) === 60
  const secondsAgo = 60 - parseInt(slider.value)
  const targetTime = Date.now() - secondsAgo * 1000

  sources.forEach(source => {
    const windowData = buffer.getWindow(source)
    const closest = windowData.reduce((prev, curr) =>
      Math.abs(curr.timestamp - targetTime) < Math.abs(prev.timestamp - targetTime) ? curr : prev
    )
    updateVisualization(closest)
  })
})
```
