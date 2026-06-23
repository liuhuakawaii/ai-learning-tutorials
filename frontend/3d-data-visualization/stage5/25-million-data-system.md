# 阶段实战：构建一个百万级数据的 3D 可视化系统

## 项目目标

把第五阶段所有技能整合成一个完整的系统：百万级数据点渲染、多层聚合、GPU 加速、交互式筛选和钻取。这是一个接近生产环境的数据大屏。

## 系统架构

```
+--------------------------------------------------+
|                  页面布局                           |
+------------------+-------------------------------+
| 控制面板 (250px)  |  Deck.gl 主视图 (自适应)        |
|                  |                                |
|  数据源选择       |   地图 + 散点 + 聚合 + 飞线      |
|  聚合控制         |                                |
|  筛选面板         |                                |
|  详情面板         |                                |
+------------------+-------------------------------+
| Three.js 3D 详情视图（点击钻入后展示）               |
+--------------------------------------------------+
```

## 数据层

```ts
import { Deck } from '@deck.gl/core'
import { ScatterplotLayer, ArcLayer, PolygonLayer, TextLayer } from '@deck.gl/layers'
import { HexagonLayer, HeatmapLayer } from '@deck.gl/aggregation-layers'

interface DataPoint {
  id: string
  position: [number, number]
  value: number
  category: string
  region: string
  timestamp: number
}

interface RegionData {
  id: string
  name: string
  polygon: [number, number][]
  totalValue: number
  pointCount: number
}

function generateLargeDataset(count: number): DataPoint[] {
  const categories = ['A', 'B', 'C', 'D', 'E']
  const regions = ['华东', '华南', '华北', '西南', '西北']

  return Array.from({ length: count }, (_, i) => {
    const region = regions[Math.floor(Math.random() * regions.length)]
    const regionOffset: Record<string, [number, number]> = {
      '华东': [120, 31],
      '华南': [113, 23],
      '华北': [116, 40],
      '西南': [104, 30],
      '西北': [108, 34],
    }
    const offset = regionOffset[region]
    return {
      id: `p-${i}`,
      position: [
        offset[0] + (Math.random() - 0.5) * 6 + Math.sin(i * 0.001) * 2,
        offset[1] + (Math.random() - 0.5) * 4 + Math.cos(i * 0.001) * 1.5,
      ] as [number, number],
      value: Math.random() * 100,
      category: categories[Math.floor(Math.random() * categories.length)],
      region,
      timestamp: Date.now() - Math.random() * 86400000 * 7,
    }
  })
}

const points = generateLargeDataset(1000000)
```

## 视图状态管理

```ts
interface AppViewState {
  viewMode: 'scatter' | 'hexagon' | 'heatmap'
  selectedCategories: Set<string>
  selectedRegions: Set<string>
  valueRange: [number, number]
  zoom: number
  selectedPoint: DataPoint | null
}

const viewState: AppViewState = {
  viewMode: 'hexagon',
  selectedCategories: new Set(['A', 'B', 'C', 'D', 'E']),
  selectedRegions: new Set(['华东', '华南', '华北', '西南', '西北']),
  valueRange: [0, 100],
  zoom: 5,
  selectedPoint: null,
}

function getFilteredData(): DataPoint[] {
  return points.filter(p => {
    if (!viewState.selectedCategories.has(p.category)) return false
    if (!viewState.selectedRegions.has(p.region)) return false
    if (p.value < viewState.valueRange[0] || p.value > viewState.valueRange[1]) return false
    return true
  })
}
```

## Deck.gl 主视图

```ts
const categoryColors: Record<string, [number, number, number, number]> = {
  A: [65, 182, 196, 180],
  B: [255, 127, 0, 180],
  C: [51, 160, 44, 180],
  D: [178, 77, 210, 180],
  E: [255, 215, 0, 180],
}

function createLayers() {
  const filtered = getFilteredData()
  const layers: any[] = []

  if (viewState.viewMode === 'scatter') {
    layers.push(new ScatterplotLayer({
      id: 'scatter',
      data: filtered,
      getPosition: (d: DataPoint) => d.position,
      getRadius: 30,
      radiusMinPixels: 1,
      radiusMaxPixels: 6,
      getFillColor: (d: DataPoint) => categoryColors[d.category],
      opacity: 0.5,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 120],
      onClick: (info: any) => {
        if (info.object) {
          viewState.selectedPoint = info.object
          showDetailPanel(info.object)
        }
      },
    }))
  } else if (viewState.viewMode === 'hexagon') {
    layers.push(new HexagonLayer({
      id: 'hexagon',
      data: filtered,
      getPosition: (d: DataPoint) => d.position,
      radius: viewState.zoom > 10 ? 200 : viewState.zoom > 7 ? 500 : 2000,
      elevationScale: 40,
      extruded: true,
      colorRange: [
        [255, 255, 178],
        [254, 204, 92],
        [253, 141, 60],
        [240, 59, 32],
        [189, 0, 38],
      ],
      colorAggregation: 'MEAN',
      elevationAggregation: 'COUNT',
      getColorWeight: (d: DataPoint) => d.value,
      getElevationWeight: 1,
      pickable: true,
      onClick: (info: any) => {
        if (info.object) {
          showHexDetail(info.object)
        }
      },
    }))
  } else if (viewState.viewMode === 'heatmap') {
    layers.push(new HeatmapLayer({
      id: 'heatmap',
      data: filtered,
      getPosition: (d: DataPoint) => d.position,
      getWeight: (d: DataPoint) => d.value,
      radiusPixels: 25,
      intensity: 1.2,
      threshold: 0.05,
      colorRange: [
        [255, 255, 204],
        [255, 237, 160],
        [254, 217, 118],
        [253, 141, 60],
        [227, 26, 28],
        [128, 0, 38],
      ],
    }))
  }

  return layers
}

const deck = new Deck({
  container: 'deck-container',
  initialViewState: {
    longitude: 112,
    latitude: 32,
    zoom: 5,
    pitch: 40,
    bearing: 0,
  },
  controller: true,
  layers: createLayers(),
  onViewStateChange: ({ viewState: vs }) => {
    viewState.zoom = vs.zoom
    deck.setProps({ layers: createLayers() })
  },
  getTooltip: (info: any) => {
    if (!info.object) return null
    if (viewState.viewMode === 'hexagon') {
      return {
        html: `<div>聚合点: ${info.object.count || info.object.points?.length || 0}</div>`,
        style: { background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' },
      }
    }
    return {
      html: `<div>值: ${info.object.value?.toFixed(1) || 'N/A'}</div><div>类别: ${info.object.category || ''}</div>`,
      style: { background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' },
    }
  },
})
```

## 控制面板

```ts
function createControlPanel() {
  const panel = document.createElement('div')
  panel.style.cssText = 'position: fixed; left: 0; top: 0; width: 250px; height: 100vh; background: #0d1117; padding: 16px; overflow-y: auto; z-index: 10; border-right: 1px solid #222;'

  panel.innerHTML = `
    <h2 style="color: #e6e6e6; font-size: 16px; margin: 0 0 16px;">数据探索器</h2>

    <div style="margin-bottom: 16px;">
      <div style="color: #888; font-size: 12px; margin-bottom: 6px;">视图模式</div>
      <div id="view-modes" style="display: flex; gap: 4px;">
        <button data-mode="scatter" class="mode-btn">散点</button>
        <button data-mode="hexagon" class="mode-btn active">六边形</button>
        <button data-mode="heatmap" class="mode-btn">热力</button>
      </div>
    </div>

    <div style="margin-bottom: 16px;">
      <div style="color: #888; font-size: 12px; margin-bottom: 6px;">类别筛选</div>
      <div id="category-filters"></div>
    </div>

    <div style="margin-bottom: 16px;">
      <div style="color: #888; font-size: 12px; margin-bottom: 6px;">区域筛选</div>
      <div id="region-filters"></div>
    </div>

    <div style="margin-bottom: 16px;">
      <div style="color: #888; font-size: 12px; margin-bottom: 6px;">值范围</div>
      <input type="range" id="value-min" min="0" max="100" value="0" style="width: 100%;">
      <input type="range" id="value-max" min="0" max="100" value="100" style="width: 100%;">
      <div id="value-display" style="color: #aaa; font-size: 11px; text-align: center;">0 - 100</div>
    </div>

    <div id="stats" style="color: #ccc; font-size: 12px;"></div>
    <div id="detail" style="color: #ccc; font-size: 12px; margin-top: 12px;"></div>
  `

  // 样式
  const style = document.createElement('style')
  style.textContent = `
    .mode-btn { padding: 4px 10px; background: #222; color: #aaa; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .mode-btn.active { background: #4fc3f7; color: #000; }
    .filter-check { display: block; margin-bottom: 3px; cursor: pointer; color: #ccc; font-size: 12px; }
  `
  document.head.appendChild(style)

  document.body.appendChild(panel)

  // 绑定事件
  panel.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      viewState.viewMode = (btn as HTMLElement).dataset.mode as any
      deck.setProps({ layers: createLayers() })
    })
  })

  // 类别筛选
  const catContainer = panel.querySelector('#category-filters')!
  const categories = ['A', 'B', 'C', 'D', 'E']
  categories.forEach(cat => {
    const label = document.createElement('label')
    label.className = 'filter-check'
    const color = categoryColors[cat]
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) viewState.selectedCategories.add(cat)
      else viewState.selectedCategories.delete(cat)
      deck.setProps({ layers: createLayers() })
      updateStats()
    })
    label.appendChild(checkbox)
    label.innerHTML += ` <span style="color: rgb(${color.join(',')});">${cat}</span>`
    catContainer.appendChild(label)
  })

  // 区域筛选
  const regionContainer = panel.querySelector('#region-filters')!
  const regions = ['华东', '华南', '华北', '西南', '西北']
  regions.forEach(region => {
    const label = document.createElement('label')
    label.className = 'filter-check'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) viewState.selectedRegions.add(region)
      else viewState.selectedRegions.delete(region)
      deck.setProps({ layers: createLayers() })
      updateStats()
    })
    label.appendChild(checkbox)
    label.innerHTML += ` ${region}`
    regionContainer.appendChild(label)
  })

  // 值范围
  const minSlider = panel.querySelector('#value-min') as HTMLInputElement
  const maxSlider = panel.querySelector('#value-max') as HTMLInputElement
  const valueDisplay = panel.querySelector('#value-display')!

  function updateValueRange() {
    const min = parseInt(minSlider.value)
    const max = parseInt(maxSlider.value)
    viewState.valueRange = [Math.min(min, max), Math.max(min, max)]
    valueDisplay.textContent = `${viewState.valueRange[0]} - ${viewState.valueRange[1]}`
    deck.setProps({ layers: createLayers() })
    updateStats()
  }

  minSlider.addEventListener('input', updateValueRange)
  maxSlider.addEventListener('input', updateValueRange)
}

function updateStats() {
  const filtered = getFilteredData()
  const statsDiv = document.getElementById('stats')!
  const mean = filtered.reduce((s, p) => s + p.value, 0) / (filtered.length || 1)

  statsDiv.innerHTML = `
    <div>显示: ${filtered.length.toLocaleString()} / ${points.length.toLocaleString()}</div>
    <div>均值: ${mean.toFixed(1)}</div>
  `
}

function showDetailPanel(point: DataPoint) {
  const detail = document.getElementById('detail')!
  detail.innerHTML = `
    <div style="border-top: 1px solid #333; padding-top: 8px;">
      <div style="font-weight: bold; color: #4fc3f7;">数据详情</div>
      <div>ID: ${point.id}</div>
      <div>位置: ${point.position[0].toFixed(3)}, ${point.position[1].toFixed(3)}</div>
      <div>值: ${point.value.toFixed(2)}</div>
      <div>类别: ${point.category}</div>
      <div>区域: ${point.region}</div>
    </div>
  `
}
```

## Three.js 钻取视图

点击聚合单元后，展示该区域的 3D 柱状图：

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const detailContainer = document.getElementById('detail-3d')!
let detailScene: THREE.Scene
let detailCamera: THREE.PerspectiveCamera
let detailRenderer: THREE.WebGLRenderer

function initDetailScene() {
  detailScene = new THREE.Scene()
  detailScene.background = new THREE.Color(0x0d1117)

  detailCamera = new THREE.PerspectiveCamera(60, detailContainer.clientWidth / detailContainer.clientHeight, 0.1, 100)
  detailCamera.position.set(8, 6, 8)

  detailRenderer = new THREE.WebGLRenderer({ antialias: true })
  detailRenderer.setSize(detailContainer.clientWidth, detailContainer.clientHeight)
  detailContainer.appendChild(detailRenderer.domElement)

  const controls = new OrbitControls(detailCamera, detailRenderer.domElement)
  controls.enableDamping = true

  detailScene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const dir = new THREE.DirectionalLight(0xffffff, 0.7)
  dir.position.set(5, 10, 5)
  detailScene.add(dir)

  function animate() {
    requestAnimationFrame(animate)
    controls.update()
    detailRenderer.render(detailScene, detailCamera)
  }
  animate()
}

function showHexDetail(hexData: any) {
  const hexPoints: DataPoint[] = hexData.points || []
  if (hexPoints.length === 0) return

  detailContainer.style.display = 'block'
  if (!detailScene) initDetailScene()

  // 清除旧内容
  while (detailScene.children.length > 2) {
    detailScene.remove(detailScene.children[detailScene.children.length - 1])
  }

  // 按类别分组
  const grouped = new Map<string, DataPoint[]>()
  hexPoints.forEach(p => {
    if (!grouped.has(p.category)) grouped.set(p.category, [])
    grouped.get(p.category)!.push(p)
  })

  const spacing = 1.5
  let index = 0
  grouped.forEach((group, cat) => {
    const count = group.length
    const meanValue = group.reduce((s, p) => s + p.value, 0) / count
    const height = (meanValue / 100) * 5

    const geo = new THREE.BoxGeometry(0.8, height, 0.8)
    geo.translate(0, height / 2, 0)
    const color = categoryColors[cat]
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color[0] / 255, color[1] / 255, color[2] / 255),
      roughness: 0.4,
      metalness: 0.3,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set((index - (grouped.size - 1) / 2) * spacing, 0, 0)
    detailScene.add(mesh)
    index++
  })

  const gridHelper = new THREE.GridHelper(10, 10, 0x222244, 0x1a1a33)
  detailScene.add(gridHelper)
}

initDetailScene()
```

## 统计信息

```ts
function showHexStats(hexData: any) {
  const hexPoints: DataPoint[] = hexData.points || []
  if (hexPoints.length === 0) return

  const values = hexPoints.map(p => p.value)
  const catCounts = new Map<string, number>()
  hexPoints.forEach(p => catCounts.set(p.category, (catCounts.get(p.category) || 0) + 1))

  const statsDiv = document.getElementById('stats')!
  statsDiv.innerHTML = `
    <div style="font-weight: bold; color: #ffd54f;">聚合区域统计</div>
    <div>点数: ${hexPoints.length.toLocaleString()}</div>
    <div>均值: ${(values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)}</div>
    <div>最大: ${Math.max(...values).toFixed(1)}</div>
    <div>最小: ${Math.min(...values).toFixed(1)}</div>
    <div style="margin-top: 6px; font-weight: bold;">类别分布</div>
    ${[...catCounts.entries()].map(([cat, count]) => {
      const color = categoryColors[cat]
      return `<div style="color: rgb(${color.join(',')});">${cat}: ${count} (${(count / hexPoints.length * 100).toFixed(1)}%)</div>`
    }).join('')}
  `
}
```

## 主程序入口

```ts
async function main() {
  createControlPanel()
  updateStats()
}

main()
```

## 练习

### 练习一：数据导出

加一个"导出"按钮，把当前筛选后的数据导出为 CSV 文件。

### 练习二：视图同步旋转

Deck.gl 和 Three.js 的相机同步旋转——拖拽一个视图时另一个视图也跟着转。

---

## 参考答案

### 练习一

```ts
function exportCSV(data: DataPoint[]) {
  const headers = ['id', 'longitude', 'latitude', 'value', 'category', 'region', 'timestamp']
  const rows = data.map(d => [
    d.id,
    d.position[0],
    d.position[1],
    d.value,
    d.category,
    d.region,
    new Date(d.timestamp).toISOString(),
  ].join(','))

  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `data-export-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const exportBtn = document.createElement('button')
exportBtn.textContent = '导出 CSV'
exportBtn.style.cssText = 'margin-top: 12px; padding: 6px 12px; width: 100%; cursor: pointer; background: #333; color: #ccc; border: none; border-radius: 4px;'
exportBtn.addEventListener('click', () => exportCSV(getFilteredData()))
document.querySelector('#stats')!.appendChild(exportBtn)
```

### 练习二

```ts
function syncCameras(deckViewState: any) {
  const { longitude, latitude, zoom, bearing, pitch } = deckViewState

  // Three.js 相机同步
  const distance = 100000 / Math.pow(2, zoom)
  const phi = (90 - pitch) * Math.PI / 180
  const theta = (bearing + 90) * Math.PI / 180

  detailCamera.position.set(
    distance * Math.sin(phi) * Math.cos(theta),
    distance * Math.cos(phi),
    distance * Math.sin(phi) * Math.sin(theta)
  )
  detailCamera.lookAt(0, 0, 0)
}

// 在 Deck 的 onViewStateChange 中调用
onViewStateChange: ({ viewState }) => {
  syncCameras(viewState)
}
```
