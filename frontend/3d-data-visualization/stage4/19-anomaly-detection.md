# 异常检测可视化——离群值高亮、阈值标记

## 异常数据的可视化挑战

异常检测的输出是"哪些数据点不正常"。但"不正常"有很多种：突然跳变、持续偏高、周期性异常、多个指标同时异常。可视化要让用户快速定位这些模式，而不是在一堆数据里自己找。

## 数据模型

```ts
interface DataPoint {
  timestamp: number
  value: number
  isAnomaly: boolean
  anomalyScore: number
  anomalyType?: 'spike' | 'drift' | 'level_shift' | 'seasonal'
}

interface ThresholdConfig {
  warning: number
  error: number
  critical: number
}

function generateAnomalyData(): DataPoint[] {
  const now = Date.now()
  const hour = 3600000
  const data: DataPoint[] = []

  for (let i = 0; i < 168; i++) {
    const base = 50 + Math.sin(i / 24 * Math.PI * 2) * 15
    const noise = (Math.random() - 0.5) * 10
    let value = base + noise
    let isAnomaly = false
    let anomalyScore = 0
    let anomalyType: DataPoint['anomalyType']

    // 人为注入异常
    if (i === 48) { value = 95; isAnomaly = true; anomalyScore = 0.95; anomalyType = 'spike' }
    if (i >= 72 && i <= 80) { value += 25; isAnomaly = true; anomalyScore = 0.7; anomalyType = 'drift' }
    if (i === 120) { value = 10; isAnomaly = true; anomalyScore = 0.85; anomalyType = 'spike' }

    data.push({
      timestamp: now - (168 - i) * hour,
      value,
      isAnomaly,
      anomalyScore,
      anomalyType,
    })
  }

  return data
}

const data = generateAnomalyData()
const thresholds: ThresholdConfig = { warning: 65, error: 80, critical: 90 }
```

## 3D 可视化布局

X 轴是时间，Y 轴是值，Z 轴可以编码另一个维度（如 anomalyScore）：

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0d1117)

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200)
camera.position.set(15, 10, 12)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const timeScale = 0.4
const valueScale = 0.1
const scoreScale = 5
```

## 正常数据与异常数据分层渲染

正常数据用半透明线，异常数据用高亮的 3D 标记：

```ts
// 正常折线
const normalPositions: THREE.Vector3[] = data.map((d, i) =>
  new THREE.Vector3(i * timeScale, d.value * valueScale, 0)
)

const lineGeo = new THREE.BufferGeometry().setFromPoints(normalPositions)
const lineMat = new THREE.LineBasicMaterial({ color: 0x336699, transparent: true, opacity: 0.6 })
const line = new THREE.Line(lineGeo, lineMat)
scene.add(line)

// 面积填充
const areaPositions: number[] = []
const areaColors: number[] = []

for (let i = 0; i < normalPositions.length - 1; i++) {
  const p1 = normalPositions[i]
  const p2 = normalPositions[i + 1]
  const c = data[i].isAnomaly ? new THREE.Color(0xff4444) : new THREE.Color(0x336699)

  areaPositions.push(p1.x, p1.y, 0, p1.x, 0, 0, p2.x, p2.y, 0)
  areaPositions.push(p2.x, p2.y, 0, p1.x, 0, 0, p2.x, 0, 0)
  for (let j = 0; j < 6; j++) areaColors.push(c.r, c.g, c.b)
}

const areaGeo = new THREE.BufferGeometry()
areaGeo.setAttribute('position', new THREE.Float32BufferAttribute(areaPositions, 3))
areaGeo.setAttribute('color', new THREE.Float32BufferAttribute(areaColors, 3))
const areaMat = new THREE.MeshBasicMaterial({
  vertexColors: true, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
})
scene.add(new THREE.Mesh(areaGeo, areaMat))
```

## 异常点 3D 标记

用不同形状标记不同异常类型：

```ts
const anomalyShapes: Record<string, THREE.BufferGeometry> = {
  spike: new THREE.OctahedronGeometry(0.2),
  drift: new THREE.BoxGeometry(0.3, 0.15, 0.15),
  level_shift: new THREE.CylinderGeometry(0.15, 0.15, 0.3, 6),
  seasonal: new THREE.TorusGeometry(0.15, 0.05, 8, 16),
}

const anomalyMeshes: THREE.Mesh[] = []

data.forEach((d, i) => {
  if (!d.isAnomaly) return

  const geo = anomalyShapes[d.anomalyType || 'spike'] || new THREE.SphereGeometry(0.15)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff4444,
    roughness: 0.3,
    metalness: 0.5,
    emissive: new THREE.Color(0x440000),
    transparent: true,
    opacity: 0.8 + d.anomalyScore * 0.2,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(i * timeScale, d.value * valueScale, d.anomalyScore * scoreScale)
  mesh.userData = d
  scene.add(mesh)
  anomalyMeshes.push(mesh)
})
```

## 阈值平面

用半透明平面标记阈值线，一目了然：

```ts
function addThresholdPlane(
  value: number,
  color: number,
  label: string,
  opacity: number = 0.1
) {
  const y = value * valueScale
  const length = data.length * timeScale

  const geo = new THREE.PlaneGeometry(length, 0.01)
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  })
  const plane = new THREE.Mesh(geo, mat)
  plane.position.set(length / 2, y, 0)
  scene.add(plane)

  // 阈值线
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, y, 0),
    new THREE.Vector3(length, y, 0),
  ])
  const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 })
  scene.add(new THREE.Line(lineGeo, lineMat))
}

addThresholdPlane(thresholds.warning, 0xffaa00, 'Warning', 0.05)
addThresholdPlane(thresholds.error, 0xff6600, 'Error', 0.08)
addThresholdPlane(thresholds.critical, 0xff0000, 'Critical', 0.1)
```

## 异常分数热力条

在折线下方放一条热力条，用颜色编码 anomalyScore：

```ts
const heatBarSegments = data.length
const heatBarGeo = new THREE.PlaneGeometry(
  heatBarSegments * timeScale,
  0.5,
  heatBarSegments,
  1
)
const heatColors: number[] = []
const posAttr = heatBarGeo.getAttribute('position') as THREE.BufferAttribute

for (let i = 0; i < heatBarSegments; i++) {
  const score = data[i].anomalyScore
  const color = new THREE.Color().lerpColors(
    new THREE.Color(0x1a1a3e),
    new THREE.Color(0xff4444),
    score
  )
  // 每个顶点对用相同颜色
  heatColors.push(color.r, color.g, color.b)
  heatColors.push(color.r, color.g, color.b)
}

const colorAttr = new THREE.Float32BufferAttribute(heatColors, 3)
heatBarGeo.setAttribute('color', colorAttr)

const heatBarMat = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.8,
  side: THREE.DoubleSide,
})
const heatBar = new THREE.Mesh(heatBarGeo, heatBarMat)
heatBar.position.set(heatBarSegments * timeScale / 2, -0.5, 0)
scene.add(heatBar)
```

## 异常聚类标注

把连续的异常区间用矩形框标注出来：

```ts
function findAnomalyRanges(data: DataPoint[]): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = []
  let inRange = false
  let start = 0

  data.forEach((d, i) => {
    if (d.isAnomaly && !inRange) {
      start = i
      inRange = true
    } else if (!d.isAnomaly && inRange) {
      ranges.push({ start, end: i - 1 })
      inRange = false
    }
  })

  if (inRange) ranges.push({ start, end: data.length - 1 })
  return ranges
}

const ranges = findAnomalyRanges(data)

ranges.forEach(range => {
  const x1 = range.start * timeScale
  const x2 = (range.end + 1) * timeScale
  const y1 = 0
  const y2 = Math.max(...data.slice(range.start, range.end + 1).map(d => d.value)) * valueScale + 1

  const geo = new THREE.PlaneGeometry(x2 - x1, y2 - y1)
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff4444,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
  })
  const plane = new THREE.Mesh(geo, mat)
  plane.position.set((x1 + x2) / 2, (y1 + y2) / 2, -0.5)
  scene.add(plane)
})
```

## 交互详情

点击异常点弹出详情：

```ts
const tooltip = document.createElement('div')
tooltip.style.cssText = `
  position: fixed; padding: 10px 14px; background: rgba(0,0,0,0.9);
  color: #fff; border-radius: 6px; font-size: 12px;
  pointer-events: none; display: none; z-index: 10;
  border: 1px solid #ff4444;
`
document.body.appendChild(tooltip)

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

renderer.domElement.addEventListener('mousemove', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1
  mouse.y = -(e.clientY / innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects(anomalyMeshes)

  if (hits.length > 0) {
    const d = hits[0].object.userData as DataPoint
    const time = new Date(d.timestamp).toLocaleString()
    tooltip.style.display = 'block'
    tooltip.style.left = `${e.clientX + 12}px`
    tooltip.style.top = `${e.clientY - 8}px`
    tooltip.innerHTML = `
      <div style="color: #ff4444; font-weight: bold;">异常检测</div>
      <div>时间: ${time}</div>
      <div>值: ${d.value.toFixed(1)}</div>
      <div>异常分数: ${d.anomalyScore.toFixed(2)}</div>
      <div>类型: ${d.anomalyType || 'unknown'}</div>
    `
  } else {
    tooltip.style.display = 'none'
  }
})
```

## 光照和后期

```ts
scene.add(new THREE.AmbientLight(0xffffff, 0.5))
const dirLight = new THREE.DirectionalLight(0xffffff, 0.7)
dirLight.position.set(5, 10, 5)
scene.add(dirLight)

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}
animate()
```

## 练习

### 练习一：异常过滤

加三个按钮：全部显示、只显示异常、隐藏异常。切换时用动画过渡。

### 练习二：多指标关联

在 Z 轴方向放第二条指标线，当两个指标同时异常时，用连线标记关联。

---

## 参考答案

### 练习一

```ts
let showMode: 'all' | 'anomaly' | 'normal' = 'all'

function setVisibility(mode: 'all' | 'anomaly' | 'normal') {
  showMode = mode

  // 折线
  const lineAttr = lineGeo.getAttribute('position') as THREE.BufferAttribute
  data.forEach((d, i) => {
    const y = mode === 'anomaly' && !d.isAnomaly ? 0
      : mode === 'normal' && d.isAnomaly ? 0
      : d.value * valueScale
    // 用 AnimatedValue 做过渡
  })

  // 异常标记
  anomalyMeshes.forEach(mesh => {
    const d = mesh.userData as DataPoint
    const shouldShow = mode === 'all' || (mode === 'anomaly' && d.isAnomaly)
    mesh.visible = shouldShow
  })
}

const modes = ['all', 'anomaly', 'normal'] as const
const labels = ['全部', '仅异常', '仅正常']
modes.forEach((mode, i) => {
  const btn = document.createElement('button')
  btn.textContent = labels[i]
  btn.style.cssText = 'margin: 4px; padding: 6px 12px; cursor: pointer;'
  btn.addEventListener('click', () => setVisibility(mode))
  document.body.appendChild(btn)
})
```

### 练习二

```ts
const secondMetricData = generateAnomalyData() // 第二条指标

const secondPositions = secondMetricData.map((d, i) =>
  new THREE.Vector3(i * timeScale, d.value * valueScale, 5)
)

const secondLineGeo = new THREE.BufferGeometry().setFromPoints(secondPositions)
const secondLineMat = new THREE.LineBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 })
scene.add(new THREE.Line(secondLineGeo, secondLineMat))

// 同时异常的连线
data.forEach((d1, i) => {
  const d2 = secondMetricData[i]
  if (d1.isAnomaly && d2.isAnomaly) {
    const p1 = new THREE.Vector3(i * timeScale, d1.value * valueScale, 0)
    const p2 = new THREE.Vector3(i * timeScale, d2.value * valueScale, 5)
    const geo = new THREE.BufferGeometry().setFromPoints([p1, p2])
    const mat = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 })
    scene.add(new THREE.Line(geo, mat))
  }
})
```
