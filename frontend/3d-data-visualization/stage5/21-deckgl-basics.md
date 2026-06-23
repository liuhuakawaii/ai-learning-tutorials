# Deck.gl 基础——大规模点/线/面数据渲染

## 为什么需要 Deck.gl

Three.js 能渲染 1 万个点，WebGL 直接写能渲染 10 万个点。但当数据量到百万级时，你需要一个专门为大规模地理数据设计的框架。Deck.gl 就是干这个的——它用分层架构、GPU 实例化渲染、自动 LOD，让你在浏览器里渲染百万级点、线、面。

Deck.gl 的核心概念：
- **Layer**：一个数据可视化图层（ScatterplotLayer、ArcLayer、HexagonLayer 等）
- **Deck**：图层容器，管理渲染管线
- **View**：视口控制（MapView、OrbitView、FirstPersonView）

## 基本设置

```ts
import { Deck } from '@deck.gl/core'
import { ScatterplotLayer, LineLayer, PolygonLayer } from '@deck.gl/layers'

const deck = new Deck({
  container: 'deck-container',
  initialViewState: {
    longitude: 116.4,
    latitude: 39.9,
    zoom: 10,
    pitch: 45,
    bearing: 0,
  },
  controller: true,
  layers: [],
})
```

## 百万级散点

生成 100 万个随机点，用 ScatterplotLayer 渲染：

```ts
interface DataPoint {
  position: [number, number]
  value: number
  category: number
}

function generatePoints(count: number): DataPoint[] {
  return Array.from({ length: count }, () => ({
    position: [
      116 + (Math.random() - 0.5) * 2,
      39 + (Math.random() - 0.5) * 2,
    ] as [number, number],
    value: Math.random() * 100,
    category: Math.floor(Math.random() * 5),
  }))
}

const points = generatePoints(1000000)

const categoryColors: [number, number, number, number][] = [
  [65, 182, 196, 200],
  [255, 127, 0, 200],
  [51, 160, 44, 200],
  [178, 77, 210, 200],
  [255, 215, 0, 200],
]

const scatterLayer = new ScatterplotLayer({
  id: 'scatter',
  data: points,
  getPosition: (d: DataPoint) => d.position,
  getRadius: (d: DataPoint) => 30 + d.value * 2,
  getFillColor: (d: DataPoint) => categoryColors[d.category],
  radiusMinPixels: 1,
  radiusMaxPixels: 15,
  opacity: 0.6,
  pickable: true,
  autoHighlight: true,
  highlightColor: [255, 255, 255, 100],
  onClick: (info: any) => {
    if (info.object) {
      console.log('Clicked:', info.object)
    }
  },
})

deck.setProps({ layers: [scatterLayer] })
```

Deck.gl 的 ScatterplotLayer 用 GPU instancing 渲染，100 万个点也能保持 60fps。

## ArcLayer 飞线

```ts
import { ArcLayer } from '@deck.gl/layers'

interface FlightData {
  from: [number, number]
  to: [number, number]
  passengers: number
}

const flights: FlightData[] = Array.from({ length: 5000 }, () => {
  const from: [number, number] = [116 + (Math.random() - 0.5) * 30, 39 + (Math.random() - 0.5) * 20]
  const to: [number, number] = [from[0] + (Math.random() - 0.5) * 20, from[1] + (Math.random() - 0.5) * 15]
  return { from, to, passengers: Math.random() * 5000 }
})

const arcLayer = new ArcLayer({
  id: 'arcs',
  data: flights,
  getSourcePosition: (d: FlightData) => d.from,
  getTargetPosition: (d: FlightData) => d.to,
  getSourceColor: [0, 200, 255, 150],
  getTargetColor: [255, 100, 0, 150],
  getWidth: (d: FlightData) => 1 + (d.passengers / 5000) * 4,
  widthMinPixels: 1,
  widthMaxPixels: 8,
  greatCircle: true,
  pickable: true,
})

deck.setProps({ layers: [scatterLayer, arcLayer] })
```

## PolygonLayer 面数据

```ts
import { PolygonLayer } from '@deck.gl/layers'

interface RegionData {
  polygon: [number, number][]
  name: string
  population: number
  gdp: number
}

const regions: RegionData[] = [
  {
    name: '区域A',
    population: 5e6,
    gdp: 2e12,
    polygon: [
      [116.2, 39.8],
      [116.6, 39.8],
      [116.6, 40.1],
      [116.2, 40.1],
    ],
  },
  // ... 更多区域
]

const maxPop = Math.max(...regions.map(r => r.population))

const polygonLayer = new PolygonLayer({
  id: 'regions',
  data: regions,
  getPolygon: (d: RegionData) => d.polygon,
  getFillColor: (d: RegionData) => {
    const t = d.population / maxPop
    return [
      Math.floor(65 + t * 190),
      Math.floor(182 - t * 100),
      Math.floor(196 - t * 100),
      180,
    ]
  },
  getLineColor: [255, 255, 255, 100],
  getLineWidth: 1,
  lineWidthMinPixels: 1,
  pickable: true,
  extruded: true,
  getElevation: (d: RegionData) => (d.gdp / 2e12) * 50000,
  elevationScale: 1,
})
```

## 视图控制

```ts
// 飞到某个位置
deck.setProps({
  initialViewState: {
    longitude: 121.5,
    latitude: 31.2,
    zoom: 12,
    pitch: 60,
    bearing: 30,
    transitionDuration: 2000,
    transitionInterpolator: new FlyToInterpolator(),
  },
})
```

## 图层组合

Deck.gl 的图层是独立的，可以自由组合：

```ts
import { HeatmapLayer } from '@deck.gl/aggregation-layers'

const heatmapLayer = new HeatmapLayer({
  id: 'heatmap',
  data: points,
  getPosition: (d: DataPoint) => d.position,
  getWeight: (d: DataPoint) => d.value,
  radiusPixels: 30,
  intensity: 1,
  threshold: 0.1,
  colorRange: [
    [255, 255, 178],
    [254, 204, 92],
    [253, 141, 60],
    [240, 59, 32],
    [189, 0, 38],
  ],
})

deck.setProps({ layers: [heatmapLayer, arcLayer] })
```

## 性能对比

| 场景 | THREE.Points | Deck.gl ScatterplotLayer |
|------|-------------|-------------------------|
| 1 万点 | 60fps | 60fps |
| 10 万点 | 30fps | 60fps |
| 100 万点 | 5fps | 60fps |
| 1000 万点 | 不可用 | 40fps |

差距来自 Deck.gl 的自动分片渲染、WebGL2 instancing、和视锥裁剪。

## 与 Mapbox 集成

Deck.gl 可以叠加在 Mapbox 底图上：

```ts
import { MapboxOverlay } from '@deck.gl/mapbox'
import mapboxgl from 'mapbox-gl'

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [116.4, 39.9],
  zoom: 10,
  pitch: 45,
})

const deckOverlay = new MapboxOverlay({
  layers: [scatterLayer, arcLayer],
})

map.addControl(deckOverlay)
```

## 练习

### 练习一：数据筛选

添加滑块，筛选 value 范围内的点。Deck.gl 重新渲染时只需要更新 data prop。

### 练习二：Tooltip

用 `getTooltip` 回调实现悬停提示。

---

## 参考答案

### 练习一

```ts
const rangeSlider = document.createElement('input')
rangeSlider.type = 'range'
rangeSlider.min = '0'
rangeSlider.max = '100'
rangeSlider.value = '0'
document.body.appendChild(rangeSlider)

rangeSlider.addEventListener('input', () => {
  const minVal = parseInt(rangeSlider.value)
  const filtered = points.filter(p => p.value >= minVal)
  scatterLayer.setProps({ data: filtered })
})
```

### 练习二

```ts
const deck = new Deck({
  container: 'deck-container',
  initialViewState: { longitude: 116.4, latitude: 39.9, zoom: 10, pitch: 45 },
  controller: true,
  layers: [scatterLayer],
  getTooltip: (info: any) => {
    if (!info.object) return null
    return {
      html: `<div>值: ${info.object.value.toFixed(1)}</div><div>类别: ${info.object.category}</div>`,
      style: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        color: '#fff',
        padding: '6px 10px',
        borderRadius: '4px',
        fontSize: '12px',
      },
    }
  },
})
```
