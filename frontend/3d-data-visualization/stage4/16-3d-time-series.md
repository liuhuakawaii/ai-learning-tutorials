# 3D 时间序列——时间轴、滑动窗口、数据滚动

## 为什么要在 3D 里看时间序列

2D 时间序列（折线图）能看趋势，但当多个指标交织在一起时，线条会重叠。把时间放在 Z 轴或 X 轴上，每个指标一条独立的"轨道"，在 3D 空间里展开，重叠问题自然解决。

更重要的是，3D 让你可以同时看到多个时间窗口——比如同时对比"本周"和"去年同期"。

## 数据结构

```ts
interface TimePoint {
  timestamp: number
  metrics: Record<string, number>
}

interface TimeSeries {
  id: string
  label: string
  unit: string
  data: TimePoint[]
}

function generateTimeSeries(): TimeSeries[] {
  const now = Date.now()
  const hour = 3600000
  const metrics = ['cpu', 'memory', 'network', 'diskIO', 'requests']

  return metrics.map(metric => ({
    id: metric,
    label: metric.toUpperCase(),
    unit: metric === 'requests' ? 'req/s' : '%',
    data: Array.from({ length: 168 }, (_, i) => ({
      timestamp: now - (168 - i) * hour,
      metrics: {
        [metric]: metric === 'requests'
          ? 500 + Math.random() * 2000 + Math.sin(i / 24 * Math.PI * 2) * 800
          : 20 + Math.random() * 60 + Math.sin(i / 24 * Math.PI * 2) * 15,
      },
    })),
  }))
}

const series = generateTimeSeries()
```

## 时间轴布局

把时间放在 X 轴，每个指标在 Z 轴上占一条轨道，Y 轴是值：

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0d1117)

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500)
camera.position.set(20, 12, 15)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const trackSpacing = 3
const timeScale = 0.3
const valueScale = 0.1

const seriesColors = [0x4fc3f7, 0xff7043, 0x66bb6a, 0xab47bc, 0xffd54f]

series.forEach((s, si) => {
  const positions: THREE.Vector3[] = []

  s.data.forEach((point, pi) => {
    const x = pi * timeScale
    const y = point.metrics[s.id] * valueScale
    const z = si * trackSpacing
    positions.push(new THREE.Vector3(x, y, z))
  })

  const curve = new THREE.CatmullRomCurve3(positions)
  const curvePoints = curve.getPoints(positions.length * 2)
  const geo = new THREE.BufferGeometry().setFromPoints(curvePoints)
  const mat = new THREE.LineBasicMaterial({
    color: seriesColors[si],
    transparent: true,
    opacity: 0.8,
  })
  const line = new THREE.Line(geo, mat)
  scene.add(line)

  // 底面填充（面积图效果）
  const surfacePositions: number[] = []
  const surfaceColors: number[] = []
  const baseY = 0
  const color = new THREE.Color(seriesColors[si])

  for (let i = 0; i < curvePoints.length - 1; i++) {
    const p1 = curvePoints[i]
    const p2 = curvePoints[i + 1]

    surfacePositions.push(p1.x, p1.y, p1.z)
    surfacePositions.push(p1.x, baseY, p1.z)
    surfacePositions.push(p2.x, p2.y, p2.z)

    surfacePositions.push(p2.x, p2.y, p2.z)
    surfacePositions.push(p1.x, baseY, p1.z)
    surfacePositions.push(p2.x, baseY, p2.z)

    for (let j = 0; j < 6; j++) {
      surfaceColors.push(color.r, color.g, color.b)
    }
  }

  const surfGeo = new THREE.BufferGeometry()
  surfGeo.setAttribute('position', new THREE.Float32BufferAttribute(surfacePositions, 3))
  surfGeo.setAttribute('color', new THREE.Float32BufferAttribute(surfaceColors, 3))
  const surfMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  })
  scene.add(new THREE.Mesh(surfGeo, surfMat))
})
```

## 时间轴标尺

```ts
function createTimeAxis() {
  const axisGroup = new THREE.Group()
  const totalLength = series[0].data.length * timeScale

  // 主轴线
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(totalLength, 0, -1),
  ])
  axisGroup.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0x444466 })))

  // 刻度
  for (let i = 0; i < series[0].data.length; i += 24) {
    const x = i * timeScale
    const tickGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0, -1),
      new THREE.Vector3(x, -0.3, -1),
    ])
    axisGroup.add(new THREE.Line(tickGeo, new THREE.LineBasicMaterial({ color: 0x444466 })))
  }

  scene.add(axisGroup)
}
createTimeAxis()
```

## 滑动窗口

只渲染最近 N 个小时的数据，通过滚动查看历史：

```ts
const windowSize = 48 // 显示最近48个点
let windowStart = series[0].data.length - windowSize

function updateWindow() {
  series.forEach((s, si) => {
    const windowedData = s.data.slice(windowStart, windowStart + windowSize)
    const positions: THREE.Vector3[] = windowedData.map((point, pi) => {
      const x = pi * timeScale
      const y = (point.metrics[s.id] || 0) * valueScale
      const z = si * trackSpacing
      return new THREE.Vector3(x, y, z)
    })

    // 更新对应的 line 对象的 geometry
    // ... 需要保存 line 的引用
  })
}

// 鼠标滚轮控制窗口
window.addEventListener('wheel', e => {
  const delta = Math.sign(e.deltaY) * 3
  windowStart = Math.max(0, Math.min(series[0].data.length - windowSize, windowStart + delta))
  updateWindow()
})
```

## 参考面和网格

```ts
// 参考网格
function createGrid() {
  const gridGroup = new THREE.Group()
  const gridMat = new THREE.LineBasicMaterial({ color: 0x222244, transparent: true, opacity: 0.5 })

  // Y 方向参考线（值刻度）
  for (let v = 0; v <= 100; v += 20) {
    const y = v * valueScale
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, y, -1),
      new THREE.Vector3(series[0].data.length * timeScale, y, -1),
    ])
    gridGroup.add(new THREE.Line(geo, gridMat))
  }

  // Z 方向参考线（轨道分隔）
  series.forEach((_, si) => {
    const z = si * trackSpacing
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, z),
      new THREE.Vector3(series[0].data.length * timeScale, 0, z),
    ])
    gridGroup.add(new THREE.Line(geo, gridMat))
  })

  scene.add(gridGroup)
}
createGrid()
```

## 标签

```ts
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(innerWidth, innerHeight)
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.top = '0'
labelRenderer.domElement.style.pointerEvents = 'none'
document.body.appendChild(labelRenderer.domElement)

series.forEach((s, si) => {
  const div = document.createElement('div')
  div.textContent = s.label
  div.style.cssText = 'color: #ccc; font-size: 13px; padding: 2px 8px; background: rgba(0,0,0,0.5); border-radius: 3px;'
  const label = new CSS2DObject(div)
  label.position.set(-2, 3, si * trackSpacing)
  scene.add(label)
})
```

## 光标与数值读取

```ts
const cursorGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0, 10, -1),
])
const cursorMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
const cursor = new THREE.Line(cursorGeo, cursorMat)
scene.add(cursor)

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

window.addEventListener('mousemove', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1
  mouse.y = -(e.clientY / innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const intersect = new THREE.Vector3()
  raycaster.ray.intersectPlane(plane, intersect)

  if (intersect) {
    cursor.position.x = intersect.x
  }
})
```

## 常见问题

**数据量太大**：168 个点 * 5 个指标 = 840 个点，不算多。但如果要显示分钟级数据（一天 1440 个点），需要降采样或用 GPU instancing。

**时间轴标签重叠**：在 CSS2DObject 里根据缩放级别动态显示/隐藏标签。

## 练习

### 练习一：时间范围选择

用鼠标拖拽选择一个时间范围，高亮该范围内的数据并显示统计信息（均值、最大值、最小值）。

### 练习二：多时间对比

把"本周"和"上周"的数据在同一轨道上用不同颜色叠加显示。

---

## 参考答案

### 练习一

```ts
let dragStart: number | null = null
let dragEnd: number | null = null
const selectionBox = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 10),
  new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.15 })
)
selectionBox.visible = false
scene.add(selectionBox)

renderer.domElement.addEventListener('mousedown', e => {
  dragStart = screenToTimeX(e.clientX)
})

renderer.domElement.addEventListener('mousemove', e => {
  if (dragStart === null) return
  dragEnd = screenToTimeX(e.clientX)
  const minX = Math.min(dragStart, dragEnd)
  const maxX = Math.max(dragStart, dragEnd)
  selectionBox.visible = true
  selectionBox.position.x = (minX + maxX) / 2
  selectionBox.scale.x = maxX - minX
})

renderer.domElement.addEventListener('mouseup', () => {
  if (dragStart !== null && dragEnd !== null) {
    const startIdx = Math.floor(Math.min(dragStart, dragEnd) / timeScale)
    const endIdx = Math.ceil(Math.max(dragStart, dragEnd) / timeScale)
    showSelectionStats(startIdx + windowStart, endIdx + windowStart)
  }
  dragStart = null
  dragEnd = null
  selectionBox.visible = false
})

function screenToTimeX(clientX: number): number {
  const ndcX = (clientX / innerWidth) * 2 - 1
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(new THREE.Vector2(ndcX, 0), camera)
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const point = new THREE.Vector3()
  raycaster.ray.intersectPlane(plane, point)
  return point ? point.x : 0
}
```

### 练习二

```ts
function addComparisonData(currentSeries: TimeSeries, previousData: TimePoint[], color: number) {
  const positions: THREE.Vector3[] = previousData.map((point, pi) => {
    const x = pi * timeScale
    const y = (point.metrics[currentSeries.id] || 0) * valueScale
    const z = series.indexOf(currentSeries) * trackSpacing
    return new THREE.Vector3(x, y, z)
  })

  const geo = new THREE.BufferGeometry().setFromPoints(positions)
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5, linewidth: 1 })
  const line = new THREE.Line(geo, mat)
  scene.add(line)
}
```
