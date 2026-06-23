# 交互与筛选——刷选、过滤、钻取、联动

## 交互是可视化的灵魂

没有交互的可视化是图片。用户需要能"问问题"——选中一部分数据看详情，过滤掉噪声，从概览钻到细节。这节课实现四种核心交互模式。

## 刷选（Brush Selection）

在 Deck.gl 里实现矩形刷选——用户拖拽画矩形，选中范围内的数据点：

```ts
import { Deck } from '@deck.gl/core'
import { ScatterplotLayer, PolygonLayer } from '@deck.gl/layers'

interface DataPoint {
  position: [number, number]
  value: number
  category: string
}

const points: DataPoint[] = Array.from({ length: 100000 }, () => ({
  position: [
    116 + (Math.random() - 0.5) * 2,
    39 + (Math.random() - 0.5) * 2,
  ] as [number, number],
  value: Math.random() * 100,
  category: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
}))

const categoryColors: Record<string, [number, number, number, number]> = {
  A: [65, 182, 196, 180],
  B: [255, 127, 0, 180],
  C: [51, 160, 44, 180],
  D: [178, 77, 210, 180],
}

interface BrushState {
  active: boolean
  start: [number, number] | null
  end: [number, number] | null
}

const brush: BrushState = { active: false, start: null, end: null }
let selectedPoints = new Set<DataPoint>()

function getSelectionRect(): [number, number][] | null {
  if (!brush.start || !brush.end) return null
  const [x1, y1] = brush.start
  const [x2, y2] = brush.end
  return [
    [Math.min(x1, x2), Math.min(y1, y2)],
    [Math.max(x1, x2), Math.min(y1, y2)],
    [Math.max(x1, x2), Math.max(y1, y2)],
    [Math.min(x1, x2), Math.max(y1, y2)],
  ]
}

function isInsideRect(point: DataPoint, rect: [number, number][]): boolean {
  const [lon, lat] = point.position
  return (
    lon >= rect[0][0] && lon <= rect[2][0] &&
    lat >= rect[0][1] && lat <= rect[2][1]
  )
}

const deck = new Deck({
  container: 'deck-container',
  initialViewState: { longitude: 116.4, latitude: 39.9, zoom: 10, pitch: 30 },
  controller: true,
  layers: [],
  onDragStart: (info: any) => {
    if (info.rightButton) {
      brush.active = true
      brush.start = info.coordinate as [number, number]
      brush.end = brush.start
    }
  },
  onDrag: (info: any) => {
    if (brush.active && info.coordinate) {
      brush.end = info.coordinate as [number, number]
      updateSelection()
    }
  },
  onDragEnd: () => {
    brush.active = false
  },
})

function updateSelection() {
  const rect = getSelectionRect()
  if (!rect) return

  selectedPoints.clear()
  points.forEach(p => {
    if (isInsideRect(p, rect)) selectedPoints.add(p)
  })

  updateLayers()
}

function updateLayers() {
  const rect = getSelectionRect()

  const selectionLayer = rect
    ? new PolygonLayer({
        id: 'selection',
        data: [{ polygon: rect }],
        getPolygon: d => d.polygon,
        getFillColor: [65, 182, 196, 40],
        getLineColor: [65, 182, 196, 200],
        getLineWidth: 2,
      })
    : null

  const scatterLayer = new ScatterplotLayer({
    id: 'points',
    data: points,
    getPosition: (d: DataPoint) => d.position,
    getRadius: 50,
    radiusMinPixels: 2,
    getFillColor: (d: DataPoint) => {
      if (selectedPoints.size > 0 && !selectedPoints.has(d)) {
        return [100, 100, 100, 50]
      }
      return categoryColors[d.category]
    },
    pickable: true,
  })

  const layers = [scatterLayer]
  if (selectionLayer) layers.push(selectionLayer)
  deck.setProps({ layers })
}

updateLayers()
```

## 过滤（Filtering）

多维度过滤面板：

```ts
interface FilterState {
  categories: Set<string>
  valueRange: [number, number]
}

const filters: FilterState = {
  categories: new Set(['A', 'B', 'C', 'D']),
  valueRange: [0, 100],
}

function applyFilters(data: DataPoint[]): DataPoint[] {
  return data.filter(d => {
    if (!filters.categories.has(d.category)) return false
    if (d.value < filters.valueRange[0] || d.value > filters.valueRange[1]) return false
    return true
  })
}

function createFilterUI() {
  const panel = document.createElement('div')
  panel.style.cssText = 'position: fixed; left: 10px; top: 10px; width: 180px; background: rgba(0,0,0,0.85); padding: 12px; border-radius: 6px; color: #ccc; font-size: 12px; z-index: 10;'

  // 类别过滤
  const catLabel = document.createElement('div')
  catLabel.textContent = '类别'
  catLabel.style.cssText = 'font-weight: bold; margin-bottom: 6px;'
  panel.appendChild(catLabel)

  const categories = ['A', 'B', 'C', 'D']
  categories.forEach(cat => {
    const label = document.createElement('label')
    label.style.cssText = 'display: block; margin-bottom: 4px; cursor: pointer;'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) filters.categories.add(cat)
      else filters.categories.delete(cat)
      refreshLayers()
    })
    label.appendChild(checkbox)
    label.appendChild(document.createTextNode(` ${cat}`))
    panel.appendChild(label)
  })

  // 值范围过滤
  const rangeLabel = document.createElement('div')
  rangeLabel.style.cssText = 'font-weight: bold; margin: 12px 0 6px;'
  rangeLabel.textContent = '值范围'
  panel.appendChild(rangeLabel)

  const minSlider = document.createElement('input')
  minSlider.type = 'range'
  minSlider.min = '0'
  minSlider.max = '100'
  minSlider.value = '0'
  minSlider.style.width = '100%'
  panel.appendChild(minSlider)

  const maxSlider = document.createElement('input')
  maxSlider.type = 'range'
  maxSlider.min = '0'
  maxSlider.max = '100'
  maxSlider.value = '100'
  maxSlider.style.width = '100%'
  panel.appendChild(maxSlider)

  const rangeDisplay = document.createElement('div')
  rangeDisplay.style.marginTop = '4px'
  panel.appendChild(rangeDisplay)

  function updateRange() {
    const min = parseInt(minSlider.value)
    const max = parseInt(maxSlider.value)
    filters.valueRange = [Math.min(min, max), Math.max(min, max)]
    rangeDisplay.textContent = `${filters.valueRange[0]} - ${filters.valueRange[1]}`
    refreshLayers()
  }

  minSlider.addEventListener('input', updateRange)
  maxSlider.addEventListener('input', updateRange)

  document.body.appendChild(panel)
}

function refreshLayers() {
  const filtered = applyFilters(points)
  const scatterLayer = new ScatterplotLayer({
    id: 'points',
    data: filtered,
    getPosition: (d: DataPoint) => d.position,
    getRadius: 50,
    radiusMinPixels: 2,
    getFillColor: (d: DataPoint) => categoryColors[d.category],
    pickable: true,
  })
  deck.setProps({ layers: [scatterLayer] })
}

createFilterUI()
```

## 钻取（Drill-Down）

从概览视图钻到细节：

```ts
type ViewLevel = 'country' | 'province' | 'city' | 'district'

interface ViewState {
  level: ViewLevel
  data: any[]
  filter?: string
}

const viewStates: Record<ViewLevel, ViewState> = {
  country: { level: 'country', data: [], filter: undefined },
  province: { level: 'province', data: [], filter: undefined },
  city: { level: 'city', data: [], filter: undefined },
  district: { level: 'district', data: [], filter: undefined },
}

let currentLevel: ViewLevel = 'country'

function drillDown(target: string) {
  const levels: ViewLevel[] = ['country', 'province', 'city', 'district']
  const currentIdx = levels.indexOf(currentLevel)
  if (currentIdx >= levels.length - 1) return

  currentLevel = levels[currentIdx + 1]
  loadLevelData(currentLevel, target)
}

function drillUp() {
  const levels: ViewLevel[] = ['country', 'province', 'city', 'district']
  const currentIdx = levels.indexOf(currentLevel)
  if (currentIdx <= 0) return

  currentLevel = levels[currentIdx - 1]
  loadLevelData(currentLevel)
}

async function loadLevelData(level: ViewLevel, filter?: string) {
  // 实际项目中从 API 加载对应层级的数据
  const data = await fetchDataForLevel(level, filter)
  renderLevel(level, data)
}

function renderLevel(level: ViewLevel, data: any[]) {
  const zoomMap: Record<ViewLevel, number> = {
    country: 4,
    province: 7,
    city: 10,
    district: 13,
  }

  deck.setProps({
    initialViewState: {
      longitude: 116.4,
      latitude: 39.9,
      zoom: zoomMap[level],
      transitionDuration: 1000,
    },
  })

  // 根据层级选择不同的图层类型
  switch (level) {
    case 'country':
      // 省级多边形
      break
    case 'province':
      // 市级点
      break
    case 'city':
      // 区县级详细点
      break
    case 'district':
      // 最细粒度
      break
  }
}
```

## 联动（Linked Views）

多个视图同步交互：

```ts
import * as THREE from 'three'

interface LinkedView {
  id: string
  type: 'deck' | 'three'
  instance: Deck | THREE.WebGLRenderer
  highlight: (ids: Set<string>) => void
}

const linkedViews: LinkedView[] = []

function registerView(view: LinkedView) {
  linkedViews.push(view)
}

function broadcastHighlight(sourceId: string, highlightedIds: Set<string>) {
  linkedViews.forEach(view => {
    if (view.id !== sourceId) {
      view.highlight(highlightedIds)
    }
  })
}

// Deck.gl 视图
const mapView: LinkedView = {
  id: 'map',
  type: 'deck',
  instance: deck,
  highlight: (ids: Set<string>) => {
    const scatterLayer = new ScatterplotLayer({
      id: 'points',
      data: points,
      getPosition: (d: DataPoint) => d.position,
      getRadius: 50,
      radiusMinPixels: 2,
      getFillColor: (d: DataPoint) => {
        if (ids.size > 0 && !ids.has(d.value.toString())) {
          return [100, 100, 100, 50]
        }
        return categoryColors[d.category]
      },
    })
    deck.setProps({ layers: [scatterLayer] })
  },
}

registerView(mapView)

// Three.js 3D 视图
const threeView: LinkedView = {
  id: '3d',
  type: 'three',
  instance: renderer,
  highlight: (ids: Set<string>) => {
    nodeMeshes.forEach((mesh, id) => {
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.opacity = ids.size === 0 || ids.has(id) ? 1 : 0.1
    })
  },
}

registerView(threeView)
```

## 双向绑定

点击 Deck.gl 的点，高亮 Three.js 中对应的对象：

```ts
const deckInstance = new Deck({
  container: 'deck-container',
  initialViewState: { longitude: 116.4, latitude: 39.9, zoom: 10 },
  controller: true,
  layers: [scatterLayer],
  onClick: (info: any) => {
    if (info.object) {
      const id = info.object.value.toString()
      broadcastHighlight('map', new Set([id]))
    } else {
      broadcastHighlight('map', new Set())
    }
  },
})
```

## 练习

### 练习一：框选统计

框选数据后，在面板中显示选中点的统计信息（数量、均值、分布）。

### 练习二：钻取面包屑

在顶部添加面包屑导航，显示当前层级路径（如：全国 > 北京 > 朝阳区），点击可返回上级。

---

## 参考答案

### 练习一

```ts
const statsPanel = document.createElement('div')
statsPanel.style.cssText = 'position: fixed; right: 10px; top: 10px; width: 180px; background: rgba(0,0,0,0.85); padding: 12px; border-radius: 6px; color: #ccc; font-size: 12px;'
document.body.appendChild(statsPanel)

function updateSelectionStats() {
  if (selectedPoints.size === 0) {
    statsPanel.innerHTML = '<div style="color: #888;">拖拽右键框选数据</div>'
    return
  }

  const selected = [...selectedPoints]
  const values = selected.map(p => p.value)
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)

  const catCounts = new Map<string, number>()
  selected.forEach(p => catCounts.set(p.category, (catCounts.get(p.category) || 0) + 1))

  statsPanel.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">选中统计</div>
    <div>数量: ${selected.length}</div>
    <div>均值: ${mean.toFixed(1)}</div>
    <div>范围: ${min.toFixed(1)} - ${max.toFixed(1)}</div>
    <div style="margin-top: 8px; font-weight: bold;">类别分布</div>
    ${[...catCounts.entries()].map(([cat, count]) =>
      `<div style="color: rgb(${categoryColors[cat].join(',')});">${cat}: ${count}</div>`
    ).join('')}
  `
}
```

### 练习二

```ts
const breadcrumb = document.createElement('div')
breadcrumb.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; height: 36px; background: rgba(0,0,0,0.8); display: flex; align-items: center; padding: 0 12px; z-index: 100;'
document.body.appendChild(breadcrumb)

const breadcrumbPath: { level: string; label: string }[] = []

function updateBreadcrumb() {
  breadcrumb.innerHTML = breadcrumbPath.map((item, i) => {
    const isLast = i === breadcrumbPath.length - 1
    return `
      <span style="color: ${isLast ? '#4fc3f7' : '#888'}; cursor: ${isLast ? 'default' : 'pointer'}; font-size: 13px;"
        onclick="${isLast ? '' : `drillToLevel(${i})`}">
        ${item.label}
      </span>
      ${i < breadcrumbPath.length - 1 ? '<span style="color: #555; margin: 0 6px;">›</span>' : ''}
    `
  }).join('')
}

function drillToLevel(index: number) {
  breadcrumbPath.splice(index + 1)
  currentLevel = breadcrumbPath[index].level as ViewLevel
  loadLevelData(currentLevel, breadcrumbPath[index].label)
  updateBreadcrumb()
}

function drillDown(target: string) {
  breadcrumbPath.push({ level: currentLevel, label: target })
  // ... 切换层级
  updateBreadcrumb()
}
```
