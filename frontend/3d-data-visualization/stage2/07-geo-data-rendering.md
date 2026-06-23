# 地理数据渲染——GeoJSON、热力图、流线图

## 这节课做什么

上节课你已经能在地球上放点了。这节课处理更复杂的地理数据格式——GeoJSON 的多边形、线，以及如何用热力图和流线图表达空间分布和流动。

## GeoJSON 在 Cesium 中加载

GeoJSON 是地理数据的事实标准。Cesium 内置支持：

```ts
import * as Cesium from 'cesium'

const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  animation: false,
  timeline: false,
})

// 加载省份边界
const provinces = await Cesium.GeoJsonDataSource.load('/data/china-provinces.geojson', {
  stroke: Cesium.Color.fromCssColorString('#4fc3f7').withAlpha(0.8),
  strokeWidth: 1.5,
  fill: Cesium.Color.fromCssColorString('#4fc3f7').withAlpha(0.15),
  clampToGround: true,
})
viewer.dataSources.add(provinces)

// 按数据给每个省上色
const gdpData: Record<string, number> = {
  '广东': 12.9e12, '江苏': 12.3e12, '山东': 8.7e12,
  '浙江': 7.8e12, '河南': 6.1e12, // ... 更多省份
}
const maxGdp = Math.max(...Object.values(gdpData))

provinces.entities.values.forEach(entity => {
  const name = entity.name || ''
  const gdp = gdpData[name] || 0
  const t = gdp / maxGdp
  const color = Cesium.Color.fromHsl(0.55 - t * 0.55, 0.75, 0.5, 0.6)
  ;(entity.polygon as Cesium.PolygonGraphics).material = color
  ;(entity.polygon as Cesium.PolygonGraphics).heightReference = Cesium.HeightReference.CLAMP_TO_GROUND

  entity.description = `<b>${name}</b><br>GDP: ${(gdp / 1e12).toFixed(2)} 万亿`
})
```

## 热力图

热力图把离散点数据变成连续的颜色场。Cesium 本身不内置热力图层，需要用第三方库或自定义实现。

### 方案一：用 Cesium Heatmap

```ts
import CesiumHeatmap from 'cesium-heatmap'

const heatData = cities.map(c => ({
  x: c.lon,
  y: c.lat,
  value: c.population,
}))

const heatmap = CesiumHeatmap.create(
  viewer,
  { west: 73, south: 18, east: 135, north: 53 },
  {
    heatmapData: heatData,
    maxOpacity: 0.8,
    minOpacity: 0.1,
    radius: 25,
    blur: 15,
  }
)
```

### 方案二：自定义 Canvas 热力图叠加

```ts
function createHeatmapOverlay(
  viewer: Cesium.Viewer,
  points: { lon: number; lat: number; value: number }[],
  bounds: { west: number; south: number; east: number; north: number }
) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // 绘制热力点
  points.forEach(p => {
    const x = ((p.lon - bounds.west) / (bounds.east - bounds.west)) * canvas.width
    const y = ((bounds.north - p.lat) / (bounds.north - bounds.south)) * canvas.height
    const radius = 30

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, `rgba(255, 0, 0, ${Math.min(p.value / 10000000, 1)})`)
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  })

  viewer.imageryLayers.addImageryProvider(
    await Cesium.SingleTileImageryProvider.fromUrl(canvas.toDataURL(), {
      rectangle: Cesium.Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north),
    })
  )
}
```

## 流线图

流线图（Flow Map）表达空间中的流动——迁徙、物流、网络流量。核心是弧线 + 箭头。

```ts
interface FlowData {
  from: { lon: number; lat: number }
  to: { lon: number; lat: number }
  volume: number
}

const flows: FlowData[] = [
  { from: { lon: 116.4, lat: 39.9 }, to: { lon: 121.5, lat: 31.2 }, volume: 5000 },
  { from: { lon: 113.3, lat: 23.1 }, to: { lon: 116.4, lat: 39.9 }, volume: 3500 },
  { from: { lon: 121.5, lat: 31.2 }, to: { lon: 139.7, lat: 35.7 }, volume: 2800 },
]

const volumeMax = Math.max(...flows.map(f => f.volume))

function addFlowLine(viewer: Cesium.Viewer, flow: FlowData) {
  const t = flow.volume / volumeMax
  const height = 200000 + t * 800000

  const midLon = (flow.from.lon + flow.to.lon) / 2
  const midLat = (flow.from.lat + flow.to.lat) / 2

  const spline = new Cesium.CatmullRomSpline({
    times: [0, 0.5, 1],
    points: [
      Cesium.Cartesian3.fromDegrees(flow.from.lon, flow.from.lat, 0),
      Cesium.Cartesian3.fromDegrees(midLon, midLat, height),
      Cesium.Cartesian3.fromDegrees(flow.to.lon, flow.to.lat, 0),
    ],
  })

  const positions: Cesium.Cartesian3[] = []
  for (let s = 0; s <= 1; s += 0.01) {
    positions.push(spline.evaluate(s))
  }

  const color = Cesium.Color.fromHsl(0.55 - t * 0.55, 0.9, 0.55, 0.6 + t * 0.3)
  const width = 1 + t * 4

  viewer.entities.add({
    polyline: {
      positions,
      width,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.15,
        color,
      }),
      clampToGround: false,
    },
  })

  // 起点和终点标记
  ;[flow.from, flow.to].forEach((pos, idx) => {
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(pos.lon, pos.lat),
      point: {
        pixelSize: idx === 0 ? 6 : 8,
        color: idx === 0 ? Cesium.Color.CYAN : Cesium.Color.YELLOW,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    })
  })
}

flows.forEach(f => addFlowLine(viewer, f))
```

## 动画流动效果

让流线看起来有东西在"流"，用 MaterialProperty 的动态纹理：

```ts
function addAnimatedFlowLine(viewer: Cesium.Viewer, flow: FlowData) {
  const positions = computeArcPositions(flow.from, flow.to, 500000)

  const entity = viewer.entities.add({
    polyline: {
      positions,
      width: 3,
      material: new Cesium.PolylineFlowMaterialProperty({
        color: Cesium.Color.CYAN.withAlpha(0.8),
        duration: 2000,
        repeat: 1,
      }),
    },
  })
}
```

如果 Cesium 版本不支持 PolylineFlowMaterialProperty，可以用自定义 Material：

```ts
const flowMaterial = new Cesium.Material({
  fabric: {
    type: 'FlowLine',
    uniforms: {
      color: new Cesium.Color(0.3, 0.8, 1.0, 0.8),
      time: 0,
    },
    source: `
      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        float s = materialInput.st.s;
        float t = czm_frameNumber / 120.0;
        float flow = fract(s * 4.0 - t);
        material.diffuse = color.rgb;
        material.alpha = color.a * flow * smoothstep(0.0, 0.1, flow);
        return material;
      }
    `,
  },
})
```

## 数据映射设计

| 数据维度 | 视觉通道 | 说明 |
|---------|---------|------|
| 流量大小 | 线宽度 | 越粗流量越大 |
| 流量大小 | 线颜色亮度 | 辅助编码 |
| 方向 | 起点→终点 | 弧线方向 |
| 区域总量 | 面填充色 | 省份/区域颜色 |

## 练习

### 练习一：双向流线

实现双向流动——如果 A→B 和 B→A 都有流量，两条弧线应该分别偏向两侧，不要重叠。

### 练习二：省份颜色图例

在页面右下角加一个水平渐变色条，标注 GDP 的最小值和最大值。

---

## 参考答案

### 练习一

```ts
function addBidirectionalFlow(
  viewer: Cesium.Viewer,
  from: { lon: number; lat: number },
  to: { lon: number; lat: number },
  forwardVolume: number,
  backwardVolume: number
) {
  // 计算法线方向，偏移弧线
  const dLon = to.lon - from.lon
  const dLat = to.lat - from.lat
  const len = Math.sqrt(dLon * dLon + dLat * dLat)
  const offsetLon = (-dLat / len) * 0.5
  const offsetLat = (dLon / len) * 0.5

  // 正向弧线偏左
  addFlowLineWithOffset(viewer, from, to, forwardVolume, offsetLon, offsetLat)
  // 反向弧线偏右
  addFlowLineWithOffset(viewer, to, from, backwardVolume, -offsetLon, -offsetLat)
}

function addFlowLineWithOffset(
  viewer: Cesium.Viewer,
  from: { lon: number; lat: number },
  to: { lon: number; lat: number },
  volume: number,
  offsetLon: number,
  offsetLat: number
) {
  const midLon = (from.lon + to.lon) / 2 + offsetLon
  const midLat = (from.lat + to.lat) / 2 + offsetLat
  // ... 创建弧线，逻辑同 addFlowLine
}
```

### 练习二

```ts
const legend = document.createElement('div')
legend.style.cssText = `
  position: fixed; bottom: 20px; right: 20px;
  background: rgba(0,0,0,0.7); padding: 12px 16px; border-radius: 6px;
`
legend.innerHTML = `
  <div style="color: #ccc; font-size: 12px; margin-bottom: 6px;">GDP（万亿）</div>
  <div style="display: flex; align-items: center; gap: 8px;">
    <span style="color: #aaa; font-size: 11px;">0</span>
    <div style="width: 150px; height: 12px; border-radius: 3px;
      background: linear-gradient(to right, hsl(200,75%,50%), hsl(0,75%,50%));"></div>
    <span style="color: #aaa; font-size: 11px;">${maxGdp / 1e12}</span>
  </div>
`
document.body.appendChild(legend)
```
