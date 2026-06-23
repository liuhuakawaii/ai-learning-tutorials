# 数据聚合——六边形聚合、聚类可视化、LOD

## 为什么需要聚合

100 万个点在屏幕上会变成一团色块。人眼无法分辨重叠的点。聚合把附近的点合并成一个代表性的图形——六边形、网格、聚类——让宏观结构显现出来。

## HexagonLayer 六边形聚合

Deck.gl 内置的 HexagonLayer 自动把点聚合到六边形网格里：

```ts
import { Deck } from '@deck.gl/core'
import { HexagonLayer } from '@deck.gl/aggregation-layers'

interface DataPoint {
  position: [number, number]
  value: number
}

function generatePoints(count: number): DataPoint[] {
  return Array.from({ length: count }, () => ({
    position: [
      116 + (Math.random() - 0.5) * 2 + Math.sin(Math.random() * 10) * 0.3,
      39 + (Math.random() - 0.5) * 2 + Math.cos(Math.random() * 10) * 0.3,
    ] as [number, number],
    value: Math.random() * 100,
  }))
}

const points = generatePoints(500000)

const hexLayer = new HexagonLayer({
  id: 'hexagon',
  data: points,
  getPosition: (d: DataPoint) => d.position,
  radius: 500,
  elevationScale: 50,
  extruded: true,
  colorRange: [
    [255, 255, 178],
    [254, 204, 92],
    [253, 141, 60],
    [240, 59, 32],
    [189, 0, 38],
  ],
  colorAggregation: 'MEAN',
  elevationAggregation: 'SUM',
  getElevationWeight: (d: DataPoint) => d.value,
  getColorWeight: (d: DataPoint) => d.value,
  pickable: true,
  onClick: (info: any) => {
    if (info.object) {
      console.log('Hex:', info.object.points.length, 'points')
    }
  },
})

const deck = new Deck({
  container: 'deck-container',
  initialViewState: {
    longitude: 116.4,
    latitude: 39.9,
    zoom: 10,
    pitch: 50,
    bearing: 0,
  },
  controller: true,
  layers: [hexLayer],
})
```

六边形的优势：比方形网格更均匀，视觉上更自然。

## GridLayer 网格聚合

```ts
import { GridLayer } from '@deck.gl/aggregation-layers'

const gridLayer = new GridLayer({
  id: 'grid',
  data: points,
  getPosition: (d: DataPoint) => d.position,
  cellSize: 400,
  elevationScale: 30,
  extruded: true,
  colorRange: [
    [255, 255, 178],
    [254, 204, 92],
    [253, 141, 60],
    [240, 59, 32],
    [189, 0, 38],
  ],
  colorAggregation: 'MEAN',
  getElevationWeight: (d: DataPoint) => d.value,
  getColorWeight: (d: DataPoint) => d.value,
  pickable: true,
})
```

## K-Means 聚类

在 JavaScript 里实现 K-Means，然后用不同颜色/形状渲染聚类结果：

```ts
interface Cluster {
  center: [number, number]
  points: DataPoint[]
  color: [number, number, number]
}

function kMeans(data: DataPoint[], k: number, maxIterations: number = 20): Cluster[] {
  // 初始化中心点
  const centers: [number, number][] = []
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(Math.random() * data.length)
    centers.push([...data[idx].position])
  }

  let clusters: Cluster[] = centers.map((c, i) => ({
    center: c,
    points: [],
    color: [
      Math.floor(Math.random() * 200 + 55),
      Math.floor(Math.random() * 200 + 55),
      Math.floor(Math.random() * 200 + 55),
    ],
  }))

  for (let iter = 0; iter < maxIterations; iter++) {
    // 清空聚类
    clusters.forEach(c => { c.points = [] })

    // 分配点到最近的中心
    data.forEach(point => {
      let minDist = Infinity
      let nearest = 0
      clusters.forEach((cluster, ci) => {
        const dx = point.position[0] - cluster.center[0]
        const dy = point.position[1] - cluster.center[1]
        const dist = dx * dx + dy * dy
        if (dist < minDist) {
          minDist = dist
          nearest = ci
        }
      })
      clusters[nearest].points.push(point)
    })

    // 更新中心
    clusters.forEach(cluster => {
      if (cluster.points.length === 0) return
      const sumLon = cluster.points.reduce((s, p) => s + p.position[0], 0)
      const sumLat = cluster.points.reduce((s, p) => s + p.position[1], 0)
      cluster.center = [sumLon / cluster.points.length, sumLat / cluster.points.length]
    })
  }

  return clusters.filter(c => c.points.length > 0)
}

const clusters = kMeans(points, 8)
```

## 聚类可视化

用 Deck.gl 渲染聚类结果——中心点 + 凸包边界：

```ts
import { ScatterplotLayer, PolygonLayer, TextLayer } from '@deck.gl/layers'

function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points

  points.sort((a, b) => a[0] - b[0] || a[1] - b[1])

  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

  const lower: number[][] = []
  for (const p of points) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }

  const upper: number[][] = []
  for (const p of [...points].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }

  return [...lower.slice(0, -1), ...upper.slice(0, -1)] as [number, number][]
}

const clusterPolygons = clusters.map((cluster, i) => ({
  polygon: convexHull(cluster.points.map(p => p.position)),
  color: cluster.color,
  pointCount: cluster.points.length,
}))

const hullLayer = new PolygonLayer({
  id: 'hulls',
  data: clusterPolygons,
  getPolygon: d => d.polygon,
  getFillColor: d => [...d.color, 30],
  getLineColor: d => [...d.color, 150],
  getLineWidth: 2,
  lineWidthMinPixels: 1,
})

const centerLayer = new ScatterplotLayer({
  id: 'centers',
  data: clusters.map(c => ({ position: c.center, color: c.color, count: c.points.length })),
  getPosition: d => d.position,
  getFillColor: d => [...d.color, 200],
  getRadius: d => Math.sqrt(d.count) * 50,
  radiusMinPixels: 5,
  radiusMaxPixels: 30,
})

const labelLayer = new TextLayer({
  id: 'labels',
  data: clusters.map(c => ({ position: c.center, text: `${c.points.length}` })),
  getPosition: d => d.position,
  getText: d => d.text,
  getSize: 14,
  getColor: [255, 255, 255, 220],
  getTextAnchor: 'middle',
  getAlignmentBaseline: 'center',
})

deck.setProps({ layers: [hullLayer, centerLayer, labelLayer] })
```

## 缩放级别自适应聚合

不同缩放级别用不同精度的聚合：

```ts
import { COORDINATE_SYSTEM } from '@deck.gl/core'

let currentZoom = 10

function getAggregationRadius(zoom: number): number {
  if (zoom < 8) return 5000
  if (zoom < 10) return 2000
  if (zoom < 12) return 500
  if (zoom < 14) return 200
  return 50
}

const deck = new Deck({
  container: 'deck-container',
  initialViewState: { longitude: 116.4, latitude: 39.9, zoom: 10, pitch: 45 },
  controller: true,
  onViewStateChange: ({ viewState }) => {
    currentZoom = viewState.zoom
    const radius = getAggregationRadius(currentZoom)
    hexLayer.setProps({ radius })
  },
  layers: [hexLayer],
})
```

## LOD（Level of Detail）

在 Three.js 里，LOD 用 `THREE.LOD` 对象实现：

```ts
import * as THREE from 'three'

class DataLOD {
  private lod: THREE.LOD

  constructor(scene: THREE.Scene) {
    this.lod = new THREE.LOD()

    // 近距离：高精度球体
    const highGeo = new THREE.SphereGeometry(0.3, 16, 16)
    const highMat = new THREE.MeshStandardMaterial({ color: 0x4fc3f7 })
    this.lod.addLevel(new THREE.Mesh(highGeo, highMat), 0)

    // 中距离：低精度球体
    const medGeo = new THREE.SphereGeometry(0.3, 8, 8)
    const medMat = new THREE.MeshStandardMaterial({ color: 0x4fc3f7 })
    this.lod.addLevel(new THREE.Mesh(medGeo, medMat), 20)

    // 远距离：点
    const farGeo = new THREE.BufferGeometry()
    farGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))
    const farMat = new THREE.PointsMaterial({ color: 0x4fc3f7, size: 0.3 })
    this.lod.addLevel(new THREE.Points(farGeo, farMat), 50)

    scene.add(this.lod)
  }

  setPosition(x: number, y: number, z: number) {
    this.lod.position.set(x, y, z)
  }
}

// 对大量数据点使用 LOD
const dataLODs: DataLOD[] = []
points.slice(0, 10000).forEach(p => {
  const lod = new DataLOD(scene)
  lod.setPosition(
    (p.position[0] - 116.4) * 100,
    0,
    (p.position[1] - 39.9) * 100
  )
  dataLODs.push(lod)
})
```

## 练习

### 练习一：聚类参数控制

加滑块让用户调整 K-Means 的 k 值（聚类数），实时重新聚类和渲染。

### 练习二：聚合热力图叠加

在六边形聚合层下方叠加一层热力图，两种视图同时展示。

---

## 参考答案

### 练习一

```ts
const kSlider = document.createElement('input')
kSlider.type = 'range'
kSlider.min = '2'
kSlider.max = '20'
kSlider.value = '8'
document.body.appendChild(kSlider)

const kLabel = document.createElement('span')
kLabel.textContent = 'K = 8'
document.body.appendChild(kLabel)

kSlider.addEventListener('input', () => {
  const k = parseInt(kSlider.value)
  kLabel.textContent = `K = ${k}`
  const newClusters = kMeans(points, k)
  // 更新图层
  updateClusterLayers(newClusters)
})
```

### 练习二

```ts
import { HeatmapLayer } from '@deck.gl/aggregation-layers'

const heatmapLayer = new HeatmapLayer({
  id: 'heatmap-base',
  data: points,
  getPosition: (d: DataPoint) => d.position,
  getWeight: (d: DataPoint) => d.value,
  radiusPixels: 30,
  intensity: 0.8,
  threshold: 0.05,
  colorRange: [
    [255, 255, 204],
    [255, 237, 160],
    [254, 217, 118],
    [254, 178, 76],
    [253, 141, 60],
    [252, 78, 42],
    [227, 26, 28],
    [189, 0, 38],
  ],
})

deck.setProps({ layers: [heatmapLayer, hexLayer] })
```
