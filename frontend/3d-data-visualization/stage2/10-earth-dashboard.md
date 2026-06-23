# 阶段实战：构建一个 3D 地球数据大屏

## 项目目标

把第二阶段的技能组合成一个完整的 3D 地球数据大屏：地球上有省份颜色编码、城市气泡、飞线动画、建筑拉伸，侧边栏有数据面板和筛选控件。

## 页面布局

```
+------------------+--------------------------------+
|   侧边栏 (250px) |        Cesium 地球 (自适应)      |
|                  |                                |
|  数据概览         |                                |
|  筛选控件         |                                |
|  详情面板         |                                |
|                  |                                |
+------------------+--------------------------------+
```

```html
<div id="app" style="display: flex; height: 100vh;">
  <aside id="sidebar" style="width: 250px; background: #0d1117; padding: 16px; overflow-y: auto;">
    <h2 style="color: #e6e6e6; margin: 0 0 16px;">数据概览</h2>
    <div id="stats"></div>
    <h3 style="color: #aaa; margin: 16px 0 8px;">筛选</h3>
    <div id="filters"></div>
    <h3 style="color: #aaa; margin: 16px 0 8px;">详情</h3>
    <div id="detail" style="color: #ccc; font-size: 13px;"></div>
  </aside>
  <div id="cesiumContainer" style="flex: 1;"></div>
</div>
```

## 数据准备

```ts
import * as Cesium from 'cesium'

interface CityMetric {
  name: string
  lon: number
  lat: number
  population: number
  gdp: number
  airQuality: number
  category: 'tier1' | 'tier2' | 'tier3'
}

interface ProvinceMetric {
  name: string
  gdp: number
  population: number
  avgIncome: number
}

interface FlowConnection {
  from: string
  to: string
  volume: number
  type: 'flight' | 'rail' | 'highway'
}

const cities: CityMetric[] = [
  { name: '北京', lon: 116.4, lat: 39.9, population: 21.5e6, gdp: 3.6e12, airQuality: 72, category: 'tier1' },
  { name: '上海', lon: 121.5, lat: 31.2, population: 24.9e6, gdp: 3.87e12, airQuality: 68, category: 'tier1' },
  { name: '广州', lon: 113.3, lat: 23.1, population: 18.7e6, gdp: 2.8e12, airQuality: 65, category: 'tier1' },
  { name: '深圳', lon: 114.1, lat: 22.5, population: 17.6e6, gdp: 3.0e12, airQuality: 60, category: 'tier1' },
  { name: '成都', lon: 104.1, lat: 30.6, population: 21.0e6, gdp: 2.0e12, airQuality: 78, category: 'tier2' },
  { name: '武汉', lon: 114.3, lat: 30.6, population: 12.3e6, gdp: 1.8e12, airQuality: 80, category: 'tier2' },
  { name: '杭州', lon: 120.2, lat: 30.3, population: 12.2e6, gdp: 1.87e12, airQuality: 55, category: 'tier2' },
  // ... 更多城市
]

const flows: FlowConnection[] = [
  { from: '北京', to: '上海', volume: 8500, type: 'flight' },
  { from: '上海', to: '深圳', volume: 6200, type: 'flight' },
  { from: '北京', to: '成都', volume: 4100, type: 'flight' },
  { from: '广州', to: '武汉', volume: 3800, type: 'rail' },
  { from: '杭州', to: '上海', volume: 5500, type: 'highway' },
  // ... 更多线路
]
```

## Cesium 初始化

```ts
const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  animation: false,
  timeline: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  fullscreenButton: false,
})

viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0a1a')
viewer.scene.globe.enableLighting = true

viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(105, 32, 12000000),
  duration: 2,
})
```

## 城市气泡

人口映射大小，AQI 映射颜色：

```ts
const popMax = Math.max(...cities.map(c => c.population))

function aqiColor(aqi: number): Cesium.Color {
  if (aqi <= 50) return Cesium.Color.fromCssColorString('#00e400').withAlpha(0.7)
  if (aqi <= 100) return Cesium.Color.fromCssColorString('#ffff00').withAlpha(0.7)
  if (aqi <= 150) return Cesium.Color.fromCssColorString('#ff7e00').withAlpha(0.7)
  return Cesium.Color.fromCssColorString('#ff0000').withAlpha(0.7)
}

const cityEntities = new Map<string, Cesium.Entity>()

cities.forEach(city => {
  const t = city.population / popMax
  const radius = 15000 + t * 60000

  const entity = viewer.entities.add({
    id: `city-${city.name}`,
    position: Cesium.Cartesian3.fromDegrees(city.lon, city.lat),
    ellipse: {
      semiMajorAxis: radius,
      semiMinorAxis: radius,
      material: aqiColor(city.airQuality),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      outline: true,
      outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
    },
    label: {
      text: city.name,
      font: '13px sans-serif',
      fillColor: Cesium.Color.WHITE,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      pixelOffset: new Cesium.Cartesian2(0, -16),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
  })

  cityEntities.set(city.name, entity)
})
```

## 飞线层

按交通类型区分颜色和样式：

```ts
const cityMap = new Map(cities.map(c => [c.name, c]))

const flowTypeColors: Record<string, Cesium.Color> = {
  flight: Cesium.Color.CYAN.withAlpha(0.6),
  rail: Cesium.Color.ORANGE.withAlpha(0.6),
  highway: Cesium.Color.GREEN.withAlpha(0.5),
}

const flowEntities: Cesium.Entity[] = []

flows.forEach(flow => {
  const fromCity = cityMap.get(flow.from)
  const toCity = cityMap.get(flow.to)
  if (!fromCity || !toCity) return

  const positions = computeArcPositions(fromCity, toCity)

  const entity = viewer.entities.add({
    name: `${flow.from} → ${flow.to}`,
    polyline: {
      positions,
      width: 1 + (flow.volume / 10000) * 4,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.15,
        color: flowTypeColors[flow.type],
      }),
    },
  })
  flowEntities.push(entity)
})

function computeArcPositions(
  from: { lon: number; lat: number },
  to: { lon: number; lat: number }
): Cesium.Cartesian3[] {
  const positions: Cesium.Cartesian3[] = []
  const numPoints = 60
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const lon = from.lon + (to.lon - from.lon) * t
    const lat = from.lat + (to.lat - from.lat) * t
    const dist = Cesium.Cartesian3.distance(
      Cesium.Cartesian3.fromDegrees(from.lon, from.lat),
      Cesium.Cartesian3.fromDegrees(to.lon, to.lat)
    )
    const height = Math.sin(t * Math.PI) * dist * 0.2
    positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, height))
  }
  return positions
}
```

## 筛选控件

```ts
function createFilters() {
  const filtersDiv = document.getElementById('filters')!

  const tiers = ['tier1', 'tier2', 'tier3']
  const tierLabels: Record<string, string> = { tier1: '一线', tier2: '二线', tier3: '三线' }

  tiers.forEach(tier => {
    const label = document.createElement('label')
    label.style.cssText = 'display: block; color: #ccc; margin-bottom: 6px; cursor: pointer;'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.addEventListener('change', () => {
      cities.forEach(city => {
        const entity = cityEntities.get(city.name)
        if (entity) entity.show = city.category === tier ? checkbox.checked : entity.show
      })
    })
    label.appendChild(checkbox)
    label.appendChild(document.createTextNode(` ${tierLabels[tier]}城市`))
    filtersDiv.appendChild(label)
  })

  const flowTypes = ['flight', 'rail', 'highway']
  const flowLabels: Record<string, string> = { flight: '航班', rail: '铁路', highway: '公路' }

  flowTypes.forEach(type => {
    const label = document.createElement('label')
    label.style.cssText = 'display: block; color: #ccc; margin-bottom: 6px; cursor: pointer;'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.addEventListener('change', () => {
      flowEntities.forEach((e, i) => {
        if (flows[i].type === type) e.show = checkbox.checked
      })
    })
    label.appendChild(checkbox)
    label.appendChild(document.createTextNode(` ${flowLabels[type]}`))
    filtersDiv.appendChild(label)
  })
}
```

## 统计面板

```ts
function updateStats() {
  const statsDiv = document.getElementById('stats')!
  const totalPop = cities.reduce((s, c) => s + c.population, 0)
  const avgAqi = cities.reduce((s, c) => s + c.airQuality, 0) / cities.length

  statsDiv.innerHTML = `
    <div style="color: #4fc3f7; font-size: 28px; font-weight: bold;">
      ${cities.length}
      <span style="font-size: 13px; color: #888;">个城市</span>
    </div>
    <div style="color: #66bb6a; margin-top: 8px;">
      总人口: ${(totalPop / 1e8).toFixed(1)} 亿
    </div>
    <div style="color: #ff7043; margin-top: 4px;">
      平均 AQI: ${avgAqi.toFixed(0)}
    </div>
    <div style="color: #ab47bc; margin-top: 4px;">
      ${flows.length} 条连接线路
    </div>
  `
}
```

## 交互：点击城市查看详情

```ts
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
  const picked = viewer.scene.pick(click.position)
  if (Cesium.defined(picked) && picked.id) {
    const entity = picked.id as Cesium.Entity
    const cityId = entity.id
    if (cityId.startsWith('city-')) {
      const cityName = cityId.replace('city-', '')
      const city = cities.find(c => c.name === cityName)
      if (city) showCityDetail(city)
    }
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)

function showCityDetail(city: CityMetric) {
  const detail = document.getElementById('detail')!
  const connectedFlows = flows.filter(f => f.from === city.name || f.to === city.name)
  detail.innerHTML = `
    <h4 style="color: #4fc3f7; margin: 0 0 8px;">${city.name}</h4>
    <p>人口: ${(city.population / 1e6).toFixed(1)}M</p>
    <p>GDP: ${(city.gdp / 1e12).toFixed(2)}T</p>
    <p>AQI: <span style="color: ${aqiColor(city.airQuality).toCssColorString()}">${city.airQuality}</span></p>
    <p>等级: ${city.category}</p>
    <p>连接线路: ${connectedFlows.length}</p>
    <ul style="padding-left: 16px; margin-top: 4px;">
      ${connectedFlows.map(f => `<li>${f.from} → ${f.to} (${f.volume})</li>`).join('')}
    </ul>
  `

  viewer.flyTo(cityEntities.get(city.name)!, {
    offset: new Cesium.HeadingPitchRange(
      viewer.camera.heading,
      viewer.camera.pitch,
      500000
    ),
  })
}
```

## 主程序入口

```ts
async function main() {
  createFilters()
  updateStats()

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(105, 32, 12000000),
    duration: 2,
  })
}

main()
```

## 练习

### 练习一：自动循环展示

添加一个"自动播放"按钮，点击后依次飞到每个城市，停 2 秒后继续下一个。

### 练习二：图例面板

在右下角添加三个图例：城市大小图例（人口）、颜色图例（AQI 等级）、线型图例（交通类型）。

---

## 参考答案

### 练习一

```ts
let autoplayTimer: number | null = null

function startAutoplay() {
  let index = 0
  function flyNext() {
    const city = cities[index % cities.length]
    showCityDetail(city)
    index++
    autoplayTimer = window.setTimeout(flyNext, 3000)
  }
  flyNext()
}

function stopAutoplay() {
  if (autoplayTimer) {
    clearTimeout(autoplayTimer)
    autoplayTimer = null
  }
}

const autoBtn = document.createElement('button')
autoBtn.textContent = '自动播放'
autoBtn.style.cssText = 'margin-top: 16px; padding: 6px 12px; cursor: pointer;'
let playing = false
autoBtn.addEventListener('click', () => {
  playing = !playing
  autoBtn.textContent = playing ? '停止播放' : '自动播放'
  playing ? startAutoplay() : stopAutoplay()
})
document.getElementById('sidebar')!.appendChild(autoBtn)
```

### 练习二

```ts
const legendDiv = document.createElement('div')
legendDiv.style.cssText = `
  position: fixed; bottom: 20px; right: 20px;
  background: rgba(13,17,23,0.85); padding: 12px 16px; border-radius: 6px;
  color: #ccc; font-size: 12px;
`
legendDiv.innerHTML = `
  <div style="margin-bottom: 8px; font-weight: bold; color: #e6e6e6;">图例</div>
  <div style="margin-bottom: 6px;">
    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #00e400; margin-right: 4px;"></span> AQI ≤ 50
  </div>
  <div style="margin-bottom: 6px;">
    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #ffff00; margin-right: 4px;"></span> AQI 51-100
  </div>
  <div style="margin-bottom: 6px;">
    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #ff7e00; margin-right: 4px;"></span> AQI 101-150
  </div>
  <div style="margin-bottom: 8px;">
    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #ff0000; margin-right: 4px;"></span> AQI > 150
  </div>
  <div style="border-top: 1px solid #333; padding-top: 6px; margin-bottom: 4px;">交通类型</div>
  <div style="margin-bottom: 4px;">
    <span style="display: inline-block; width: 20px; height: 2px; background: cyan; margin-right: 4px; vertical-align: middle;"></span> 航班
  </div>
  <div style="margin-bottom: 4px;">
    <span style="display: inline-block; width: 20px; height: 2px; background: orange; margin-right: 4px; vertical-align: middle;"></span> 铁路
  </div>
  <div>
    <span style="display: inline-block; width: 20px; height: 2px; background: green; margin-right: 4px; vertical-align: middle;"></span> 公路
  </div>
`
document.body.appendChild(legendDiv)
```
