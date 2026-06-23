# 阶段实战：构建一个实时数据监控 3D 大屏

## 项目目标

整合第四阶段的技能，构建一个完整的实时数据监控大屏：多个服务器的指标实时更新，异常自动检测和高亮，告警动画，时间回放。

## 页面布局

```
+------------------+----------------------------------+
|  指标面板 (220px) |    3D 主视图                      |
|                  |                                  |
|  服务器列表       |    柱状图 + 折线 + 异常标记        |
|  指标卡片         |                                  |
|  告警列表         |                                  |
|                  |                                  |
+------------------+----------------------------------+
|  时间轴 / 回放控制                                  |
+---------------------------------------------------+
```

## 数据层

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

interface ServerMetrics {
  id: string
  name: string
  cpu: number
  memory: number
  network: number
  diskIO: number
  requests: number
  status: 'normal' | 'warning' | 'error'
}

interface MetricSnapshot {
  timestamp: number
  servers: Map<string, ServerMetrics>
}

interface Alert {
  id: string
  timestamp: number
  serverId: string
  level: 'warning' | 'error' | 'critical'
  metric: string
  value: number
  threshold: number
}

const servers: ServerMetrics[] = [
  { id: 'web-1', name: 'Web-1', cpu: 45, memory: 60, network: 300, diskIO: 200, requests: 800, status: 'normal' },
  { id: 'web-2', name: 'Web-2', cpu: 72, memory: 55, network: 450, diskIO: 350, requests: 1200, status: 'normal' },
  { id: 'web-3', name: 'Web-3', cpu: 35, memory: 40, network: 200, diskIO: 150, requests: 600, status: 'normal' },
  { id: 'api-1', name: 'API-1', cpu: 60, memory: 70, network: 500, diskIO: 100, requests: 2000, status: 'normal' },
  { id: 'api-2', name: 'API-2', cpu: 55, memory: 65, network: 400, diskIO: 120, requests: 1800, status: 'normal' },
  { id: 'db-1', name: 'DB-1', cpu: 80, memory: 85, network: 150, diskIO: 600, requests: 500, status: 'warning' },
]

const thresholds = {
  cpu: { warning: 70, error: 85, critical: 95 },
  memory: { warning: 75, error: 90, critical: 95 },
  requests: { warning: 1500, error: 2000, critical: 2500 },
}
```

## 时间窗口缓冲

```ts
class MetricBuffer {
  private snapshots: MetricSnapshot[] = []
  private maxDuration: number

  constructor(maxDurationMs: number = 300000) {
    this.maxDuration = maxDurationMs
  }

  add(snapshot: MetricSnapshot) {
    this.snapshots.push(snapshot)
    const cutoff = Date.now() - this.maxDuration
    while (this.snapshots.length > 0 && this.snapshots[0].timestamp < cutoff) {
      this.snapshots.shift()
    }
  }

  getLatest(): MetricSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1]
  }

  getHistory(serverId: string, metric: string, count: number = 60): number[] {
    const recent = this.snapshots.slice(-count)
    return recent.map(s => {
      const m = s.servers.get(serverId)
      return m ? (m as any)[metric] : 0
    })
  }

  getAll(): MetricSnapshot[] {
    return this.snapshots
  }
}

const buffer = new MetricBuffer()
```

## 模拟数据源

```ts
function updateMetrics() {
  const snapshot: MetricSnapshot = { timestamp: Date.now(), servers: new Map() }

  servers.forEach(server => {
    const jitter = () => (Math.random() - 0.5) * 5
    server.cpu = Math.max(0, Math.min(100, server.cpu + jitter()))
    server.memory = Math.max(0, Math.min(100, server.memory + jitter() * 0.5))
    server.network = Math.max(0, server.network + jitter() * 20)
    server.diskIO = Math.max(0, server.diskIO + jitter() * 10)
    server.requests = Math.max(0, server.requests + jitter() * 50)

    if (server.cpu > thresholds.cpu.error) server.status = 'error'
    else if (server.cpu > thresholds.cpu.warning) server.status = 'warning'
    else server.status = 'normal'

    snapshot.servers.set(server.id, { ...server })
  })

  buffer.add(snapshot)
  checkAlerts(snapshot)
}

setInterval(updateMetrics, 1000)
```

## 3D 场景

```ts
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0a1a)

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200)
camera.position.set(0, 10, 20)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
document.getElementById('main')!.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(innerWidth, innerHeight)
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.top = '0'
labelRenderer.domElement.style.pointerEvents = 'none'
document.getElementById('main')!.appendChild(labelRenderer.domElement)

scene.add(new THREE.AmbientLight(0xffffff, 0.5))
const dirLight = new THREE.DirectionalLight(0xffffff, 0.7)
dirLight.position.set(5, 10, 5)
scene.add(dirLight)

const gridHelper = new THREE.GridHelper(20, 20, 0x222244, 0x1a1a33)
scene.add(gridHelper)
```

## 柱状图渲染

```ts
const barSpacing = 3
const barMeshes = new Map<string, THREE.Mesh>()
const barTargets = new Map<string, number>()

servers.forEach((server, i) => {
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16)
  geo.translate(0, 0.5, 0)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4fc3f7,
    roughness: 0.4,
    metalness: 0.3,
    transparent: true,
  })
  const mesh = new THREE.Mesh(geo, mat)
  const x = (i - (servers.length - 1) / 2) * barSpacing
  mesh.position.set(x, 0, 0)
  mesh.userData = server
  scene.add(mesh)
  barMeshes.set(server.id, mesh)
  barTargets.set(server.id, 1)

  // 标签
  const div = document.createElement('div')
  div.textContent = server.name
  div.style.cssText = 'color: #aaa; font-size: 11px; padding: 1px 4px; background: rgba(0,0,0,0.5); border-radius: 2px;'
  const label = new CSS2DObject(div)
  label.position.set(x, -0.5, 0)
  scene.add(label)
})
```

## Sparkline 折线

```ts
const sparklineGroup = new THREE.Group()
scene.add(sparklineGroup)

function updateSparklines() {
  sparklineGroup.clear()

  servers.forEach((server, i) => {
    const history = buffer.getHistory(server.id, 'cpu', 60)
    if (history.length < 2) return

    const x = (i - (servers.length - 1) / 2) * barSpacing
    const points = history.map((v, j) =>
      new THREE.Vector3(x - 1 + j * (2 / 60), v * 0.05, 1)
    )

    const geo = new THREE.BufferGeometry().setFromPoints(points)
    const mat = new THREE.LineBasicMaterial({
      color: server.status === 'error' ? 0xff4444 : 0x4fc3f7,
      transparent: true,
      opacity: 0.6,
    })
    sparklineGroup.add(new THREE.Line(geo, mat))
  })
}
```

## 告警系统

```ts
const alerts: Alert[] = []
const alertRingPool: THREE.Mesh[] = []

function checkAlerts(snapshot: MetricSnapshot) {
  snapshot.servers.forEach((metrics, serverId) => {
    if (metrics.cpu > thresholds.cpu.error) {
      const alert: Alert = {
        id: `${serverId}-${Date.now()}`,
        timestamp: Date.now(),
        serverId,
        level: metrics.cpu > thresholds.cpu.critical ? 'critical' : 'error',
        metric: 'cpu',
        value: metrics.cpu,
        threshold: thresholds.cpu.error,
      }
      alerts.push(alert)
      triggerAlertEffect(serverId, alert.level)
      updateAlertPanel()
    }
  })
}

function triggerAlertEffect(serverId: string, level: string) {
  const mesh = barMeshes.get(serverId)
  if (!mesh) return

  const color = level === 'critical' ? 0xff0000 : level === 'error' ? 0xff4444 : 0xffaa00
  const ringGeo = new THREE.RingGeometry(0.5, 0.8, 32)
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.position.copy(mesh.position)
  ring.position.y += mesh.scale.y + 0.5
  ring.rotation.x = -Math.PI / 2
  ring.userData = { startTime: Date.now() }
  scene.add(ring)
  alertRingPool.push(ring)
}
```

## 告警面板

```ts
function updateAlertPanel() {
  const panel = document.getElementById('alert-list')!
  const recent = alerts.slice(-10).reverse()

  panel.innerHTML = recent.map(a => `
    <div style="padding: 6px; margin-bottom: 4px; border-radius: 4px;
      background: ${a.level === 'critical' ? 'rgba(255,0,0,0.2)' : 'rgba(255,68,68,0.1)'};">
      <div style="color: ${a.level === 'critical' ? '#ff0000' : '#ff4444'}; font-weight: bold;">
        ${a.level.toUpperCase()}
      </div>
      <div style="color: #aaa; font-size: 11px;">
        ${a.serverId} · ${a.metric}: ${a.value.toFixed(1)}% > ${a.threshold}%
      </div>
      <div style="color: #666; font-size: 10px;">
        ${new Date(a.timestamp).toLocaleTimeString()}
      </div>
    </div>
  `).join('')
}
```

## 指标卡片

```ts
function updateMetricCards() {
  const latest = buffer.getLatest()
  if (!latest) return

  const container = document.getElementById('metric-cards')!
  container.innerHTML = ''

  latest.servers.forEach((metrics, serverId) => {
    const card = document.createElement('div')
    card.style.cssText = 'padding: 8px; margin-bottom: 6px; background: rgba(255,255,255,0.03); border-radius: 4px;'
    card.innerHTML = `
      <div style="color: #4fc3f7; font-weight: bold; margin-bottom: 4px;">${metrics.name}</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; font-size: 11px;">
        <span style="color: #aaa;">CPU</span>
        <span style="color: ${metrics.cpu > 80 ? '#ff4444' : '#66bb6a'};">${metrics.cpu.toFixed(1)}%</span>
        <span style="color: #aaa;">MEM</span>
        <span style="color: ${metrics.memory > 80 ? '#ff4444' : '#66bb6a'};">${metrics.memory.toFixed(1)}%</span>
        <span style="color: #aaa;">NET</span>
        <span style="color: #ccc;">${metrics.network.toFixed(0)}</span>
        <span style="color: #aaa;">REQ</span>
        <span style="color: #ccc;">${metrics.requests.toFixed(0)}/s</span>
      </div>
    `
    container.appendChild(card)
  })
}
```

## 时间回放

```ts
let isPlaying = true
let playbackIndex = -1

const timelineSlider = document.createElement('input')
timelineSlider.type = 'range'
timelineSlider.min = '0'
timelineSlider.max = '100'
timelineSlider.value = '100'
timelineSlider.style.cssText = 'width: 100%; margin-top: 8px;'
document.getElementById('timeline')!.appendChild(timelineSlider)

timelineSlider.addEventListener('input', () => {
  const val = parseInt(timelineSlider.value)
  isPlaying = val === 100
  if (!isPlaying) {
    const snapshots = buffer.getAll()
    playbackIndex = Math.floor((val / 100) * (snapshots.length - 1))
    renderSnapshot(snapshots[playbackIndex])
  }
})

function renderSnapshot(snapshot: MetricSnapshot) {
  snapshot.servers.forEach((metrics, serverId) => {
    const mesh = barMeshes.get(serverId)
    if (!mesh) return

    const targetHeight = 0.5 + (metrics.cpu / 100) * 8
    barTargets.set(serverId, targetHeight)

    const mat = mesh.material as THREE.MeshStandardMaterial
    const t = metrics.cpu / 100
    mat.color.lerpColors(new THREE.Color(0x4fc3f7), new THREE.Color(0xff4444), t)
  })
}
```

## 动画循环

```ts
let pulseTime = 0

function animate() {
  requestAnimationFrame(animate)
  pulseTime += 0.05

  // 柱子平滑过渡
  barMeshes.forEach((mesh, serverId) => {
    const target = barTargets.get(serverId) || 1
    const current = mesh.scale.y
    mesh.scale.y += (target - current) * 0.1
  })

  // 告警环动画
  for (let i = alertRingPool.length - 1; i >= 0; i--) {
    const ring = alertRingPool[i]
    const elapsed = (Date.now() - ring.userData.startTime) / 1000
    const scale = 1 + elapsed * 3
    const opacity = Math.max(0, 1 - elapsed)
    ring.scale.setScalar(scale)
    ;(ring.material as THREE.MeshBasicMaterial).opacity = opacity * 0.8
    if (opacity <= 0) {
      scene.remove(ring)
      alertRingPool.splice(i, 1)
    }
  }

  // 脉冲高亮
  barMeshes.forEach((mesh, serverId) => {
    const server = servers.find(s => s.id === serverId)
    if (server?.status === 'error') {
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.emissive.setHex(Math.sin(pulseTime * 4) > 0 ? 0x330000 : 0x000000)
    }
  })

  if (isPlaying) {
    updateSparklines()
    updateMetricCards()
    barTargets.clear()
    const latest = buffer.getLatest()
    if (latest) {
      latest.servers.forEach((m, id) => {
        barTargets.set(id, 0.5 + (m.cpu / 100) * 8)
      })
    }
  }

  controls.update()
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}

animate()
```

## 练习

### 练习一：指标切换

加下拉框让用户选择柱子映射的指标（CPU / Memory / Requests），切换时动画过渡。

### 练习二：告警声音

当新告警产生时播放提示音（用 Web Audio API 生成简单的 beep）。

---

## 参考答案

### 练习一

```ts
let activeMetric = 'cpu'

const select = document.createElement('select')
select.style.cssText = 'position: fixed; top: 10px; left: 10px; padding: 4px 8px; z-index: 10;'
;['cpu', 'memory', 'requests'].forEach(m => {
  const opt = document.createElement('option')
  opt.value = m
  opt.textContent = m.toUpperCase()
  select.appendChild(opt)
})
document.body.appendChild(select)

select.addEventListener('change', () => {
  activeMetric = select.value
})

// 在 animate 中
const value = (server as any)[activeMetric] || 0
const maxVal = activeMetric === 'requests' ? 3000 : 100
barTargets.set(server.id, 0.5 + (value / maxVal) * 8)
```

### 练习二

```ts
const audioCtx = new AudioContext()

function playBeep(frequency: number = 800, duration: number = 0.15) {
  const oscillator = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioCtx.destination)

  oscillator.frequency.value = frequency
  oscillator.type = 'sine'
  gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration)

  oscillator.start(audioCtx.currentTime)
  oscillator.stop(audioCtx.currentTime + duration)
}

function checkAlerts(snapshot: MetricSnapshot) {
  snapshot.servers.forEach((metrics, serverId) => {
    if (metrics.cpu > thresholds.cpu.error) {
      // ... 创建 alert ...
      playBeep(metrics.cpu > thresholds.cpu.critical ? 1200 : 800)
    }
  })
}
```
