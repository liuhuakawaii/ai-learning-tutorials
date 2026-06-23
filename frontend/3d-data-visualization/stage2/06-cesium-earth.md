# 3D 地球——Cesium.js 基础、图层系统

## 为什么不用 Three.js 画地球

理论上你可以用 Three.js 加一张地球贴图画一个球。但它不处理：
- WGS84 坐标系转换
- 瓦片金字塔加载
- 地形高程
- 经纬度到 3D 坐标的投影
- 时间系统、影像图层、矢量图层的叠加

这些都是地理可视化的基础需求。Cesium.js 封装了这些能力，让你专注于数据层。

## 第一个 Cesium 场景

```ts
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  baseLayer: Cesium.ImageryLayer.fromProviderAsync(
    Cesium.TileMapServiceImageryProvider.fromUrl(
      Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
    )
  ),
  animation: false,
  timeline: false,
  baseLayerPicker: false,
})

viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 20000000),
})
```

`viewer` 是整个 Cesium 应用的入口。它管理场景、图层、相机、交互。

## Cesium 的图层系统

Cesium 用图层（Layer）组织内容，类似 Photoshop 的图层：

| 图层类型 | 用途 | 数据源 |
|---------|------|--------|
| ImageryLayer | 影像底图 | 瓦片服务 |
| TerrainProvider | 地形高程 | 地形瓦片 |
| Entity | 点、线、面、模型 | Entity API |
| DataSource | GeoJSON、KML、CZML | DataSource API |
| 3DTileset | 倾斜摄影、BIM | 3D Tiles |

```ts
// 添加影像图层
const imageryLayer = viewer.imageryLayers.addImageryProvider(
  await Cesium.WebMapServiceImageryProvider.fromUrl(
    'https://your-geoserver/wms',
    { layers: 'temperature', parameters: { transparent: true, format: 'image/png' } }
  )
)
imageryLayer.alpha = 0.7

// 添加 GeoJSON 数据源
const geoJson = await Cesium.GeoJsonDataSource.load('/data/cities.geojson', {
  stroke: Cesium.Color.WHITE,
  strokeWidth: 2,
  clampToGround: true,
})
viewer.dataSources.add(geoJson)
```

## 在地球上添加数据点

### 用 Entity API

Entity API 适合数据量不大（几千个以内）的场景：

```ts
interface CityData {
  name: string
  lon: number
  lat: number
  population: number
  gdp: number
}

const cities: CityData[] = [
  { name: '北京', lon: 116.4, lat: 39.9, population: 21.5e6, gdp: 3.6e12 },
  { name: '上海', lon: 121.5, lat: 31.2, population: 24.9e6, gdp: 3.87e12 },
  { name: '东京', lon: 139.7, lat: 35.7, population: 13.9e6, gdp: 9.5e12 },
  { name: '纽约', lon: -74.0, lat: 40.7, population: 8.3e6, gdp: 7.7e12 },
]

const popMax = Math.max(...cities.map(c => c.population))

cities.forEach(city => {
  const t = city.population / popMax
  const radius = 20000 + t * 80000
  const color = Cesium.Color.fromHsl(0.6 - t * 0.6, 0.8, 0.5, 0.7)

  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(city.lon, city.lat),
    ellipse: {
      semiMajorAxis: radius,
      semiMinorAxis: radius,
      material: color,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: city.name,
      font: '14px sans-serif',
      fillColor: Cesium.Color.WHITE,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      pixelOffset: new Cesium.Cartesian2(0, -20),
    },
    description: `<b>${city.name}</b><br>人口: ${(city.population / 1e6).toFixed(1)}M<br>GDP: ${(city.gdp / 1e12).toFixed(2)}T`,
  })
})
```

### 用 Primitive API（高性能）

当数据量超过几千个 Entity 会变慢。Primitive API 直接操作 GPU：

```ts
const instanceGeometry = new Cesium.GeometryInstance({
  geometry: new Cesium.CircleGeometry({
    center: Cesium.Cartesian3.fromDegrees(116.4, 39.9),
    radius: 50000,
  }),
  attributes: {
    color: Cesium.ColorGeometryInstanceAttribute.fromColor(
      Cesium.Color.fromCssColorString('#4fc3f7').withAlpha(0.7)
    ),
  },
})

viewer.scene.primitives.add(new Cesium.GroundPrimitive({
  geometryInstances: instanceGeometry,
  appearance: new Cesium.PerInstanceColorAppearance(),
}))
```

## 相机控制

```ts
// 飞到某个位置
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 500000),
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-45),
    roll: 0,
  },
  duration: 2,
})

// 持续旋转地球
viewer.clock.onTick.addEventListener(() => {
  viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, Cesium.Math.toRadians(0.1))
})

// 点击事件
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
  const picked = viewer.scene.pick(click.position)
  if (Cesium.defined(picked) && picked.id) {
    viewer.selectedEntity = picked.id
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)
```

## 常见坑

**API Key**：Cesium Ion 需要 token 才能访问地形和影像。开发时用 `Cesium.Ion.defaultAccessToken = 'your-token'`。离线部署需要自己搭建瓦片服务。

**性能**：Entity API 简单但慢，数据量大时切换到 Primitive API 或 3D Tiles。

**坐标系**：Cesium 用 WGS84 经纬度和 Cartesian3 符卡坐标。做数据对接时注意坐标系是否一致（GCJ-02 偏移问题）。

## 练习

### 练习一：动态数据面板

点击地球上某个城市时，侧边栏显示该城市的详细数据卡片。

### 练习二：飞线连接

用 Polyline 连接两个城市，线的颜色从起点渐变到终点。

---

## 参考答案

### 练习一

```ts
const infoPanel = document.getElementById('info-panel')!

handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
  const picked = viewer.scene.pick(click.position)
  if (Cesium.defined(picked) && picked.id) {
    const entity = picked.id as Cesium.Entity
    const desc = entity.description?.getValue(Cesium.JulianDate.now()) || ''
    infoPanel.innerHTML = `
      <h3>${entity.name}</h3>
      <div>${desc}</div>
    `
    infoPanel.style.display = 'block'
  } else {
    infoPanel.style.display = 'none'
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)
```

### 练习二

```ts
function addFlyLine(from: CityData, to: CityData) {
  const positions = Cesium.Cartesian3.fromDegreesArray([from.lon, from.lon, to.lon, to.lon])
  // 用 CatmullRom 曲线生成弧线
  const spline = new Cesium.CatmullRomSpline({
    times: [0, 0.5, 1],
    points: [
      Cesium.Cartesian3.fromDegrees(from.lon, from.lat, 0),
      Cesium.Cartesian3.fromDegrees(
        (from.lon + to.lon) / 2,
        (from.lat + to.lat) / 2,
        500000
      ),
      Cesium.Cartesian3.fromDegrees(to.lon, to.lat, 0),
    ],
  })

  const arcPositions: Cesium.Cartesian3[] = []
  for (let t = 0; t <= 1; t += 0.02) {
    arcPositions.push(spline.evaluate(t))
  }

  viewer.entities.add({
    polyline: {
      positions: arcPositions,
      width: 2,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.2,
        color: Cesium.Color.CYAN,
      }),
    },
  })
}
```
