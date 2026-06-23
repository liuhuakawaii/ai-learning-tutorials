# 地形与建筑——3D 地形、建筑物拉伸、BIM 数据

## 这节课做什么

前面的课程里地球是平的——即使有地形数据，点和线都浮在一个假想的球面上。这节课让数据"站"在真实地形上：建筑从地面拉起、数据点贴合山势、BIM 模型叠加到城市。

## 3D 地形

Cesium 的地形系统把高程数据变成三角网格，叠加在椭球体上：

```ts
import * as Cesium from 'cesium'

const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  animation: false,
  timeline: false,
})

// 地形质量配置
viewer.scene.globe.terrainExaggeration = 1.0
viewer.scene.globe.terrainExaggerationRelativeHeight = 0

// 飞到山区看地形效果
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(103.8, 27.9, 500000),
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-35),
    roll: 0,
  },
})
```

`terrainExaggeration` 控制高程放大倍数。真实地形在大尺度下起伏很小，放大 1.5-2 倍效果更明显。

## 建筑物拉伸

拿到建筑物的 GeoJSON 多边形（footprint），用 extrudedPolygon 拉伸成 3D：

```ts
interface Building {
  footprint: [number, number][]
  height: number
  name: string
  type: string
}

const buildings: Building[] = [
  {
    name: '国贸三期',
    type: 'commercial',
    height: 330,
    footprint: [
      [116.461, 39.908],
      [116.462, 39.908],
      [116.462, 39.909],
      [116.461, 39.909],
    ],
  },
  {
    name: '居民楼A',
    type: 'residential',
    height: 45,
    footprint: [
      [116.455, 39.905],
      [116.456, 39.905],
      [116.456, 39.906],
      [116.455, 39.906],
    ],
  },
]

const typeColors: Record<string, Cesium.Color> = {
  commercial: Cesium.Color.fromCssColorString('#4fc3f7').withAlpha(0.7),
  residential: Cesium.Color.fromCssColorString('#66bb6a').withAlpha(0.7),
  industrial: Cesium.Color.fromCssColorString('#ff7043').withAlpha(0.7),
}

buildings.forEach(b => {
  const positions = b.footprint.map(([lon, lat]) =>
    Cesium.Cartesian3.fromDegrees(lon, lat)
  )

  viewer.entities.add({
    name: b.name,
    polygon: {
      hierarchy: positions,
      extrudedHeight: b.height,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      material: typeColors[b.type] || Cesium.Color.GRAY.withAlpha(0.7),
      outline: true,
      outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
    },
    description: `<b>${b.name}</b><br>类型: ${b.type}<br>高度: ${b.height}m`,
  })
})
```

## 从 OpenStreetMap 获取建筑数据

实际项目中建筑数据通常来自 OSM。用 Overpass API 查询：

```ts
async function fetchOSMBuildings(
  south: number, west: number, north: number, east: number
): Promise<Building[]> {
  const query = `
    [out:json][timeout:60];
    (
      way["building"](${south},${west},${north},${east});
    );
    out body;>;out skel qt;
  `

  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
  })
  const data = await resp.json()

  const nodes = new Map<number, [number, number]>()
  data.elements
    .filter((e: any) => e.type === 'node')
    .forEach((n: any) => nodes.set(n.id, [n.lon, n.lat]))

  return data.elements
    .filter((e: any) => e.type === 'way' && e.tags?.building)
    .map((way: any) => ({
      name: way.tags?.['name:zh'] || way.tags?.name || '未命名建筑',
      type: way.tags?.building || 'yes',
      height: parseFloat(way.tags?.height || way.tags?.['building:levels'] * 3 || '15'),
      footprint: way.nodes
        .map((id: number) => nodes.get(id))
        .filter(Boolean) as [number, number][],
    }))
}

// 使用
const buildings = await fetchOSMBuildings(39.90, 116.45, 39.92, 116.47)
buildings.forEach(b => addBuildingEntity(b))
```

## 数据叠加到建筑上

建筑不只是看的——它可以承载数据。比如用颜色编码用电量，用高度叠加额外数据：

```ts
interface BuildingEnergy {
  buildingId: string
  energyUse: number // kWh
  co2: number // tons
}

function colorByEnergy(energyUse: number, maxEnergy: number): Cesium.Color {
  const t = Math.min(energyUse / maxEnergy, 1)
  return Cesium.Color.fromHsl(0.33 - t * 0.33, 0.7, 0.5, 0.75)
}

function addEnergyBuilding(building: Building, energy: BuildingEnergy, maxEnergy: number) {
  viewer.entities.add({
    name: building.name,
    polygon: {
      hierarchy: building.footprint.map(([lon, lat]) =>
        Cesium.Cartesian3.fromDegrees(lon, lat)
      ),
      extrudedHeight: building.height,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      material: colorByEnergy(energy.energyUse, maxEnergy),
    },
    description: `
      <b>${building.name}</b><br>
      能耗: ${energy.energyUse.toLocaleString()} kWh<br>
      CO₂: ${energy.co2} t
    `,
  })
}
```

## 地形剖面

查看某条路径上的高程变化，对道路规划、管线设计有用：

```ts
async function getTerrainProfile(
  positions: Cesium.Cartesian3[],
  numSamples: number = 50
): Promise<{ distance: number; elevation: number }[]> {
  const cartographicPositions = positions.map(p =>
    Cesium.Cartographic.fromCartesian(p)
  )

  const sampledPositions: Cesium.Cartographic[] = []
  for (let i = 0; i < cartographicPositions.length - 1; i++) {
    const a = cartographicPositions[i]
    const b = cartographicPositions[i + 1]
    for (let t = 0; t < 1; t += 1 / numSamples) {
      sampledPositions.push(new Cesium.Cartographic(
        Cesium.Math.lerp(a.longitude, b.longitude, t),
        Cesium.Math.lerp(a.latitude, b.latitude, t)
      ))
    }
  }

  const terrainProvider = viewer.terrainProvider
  const heights = await Cesium.sampleTerrainMostDetailed(
    terrainProvider,
    sampledPositions
  )

  let cumulativeDistance = 0
  return heights.map((h, i) => {
    if (i > 0) {
      const prev = Cesium.Cartesian3.fromRadians(
        heights[i - 1].longitude, heights[i - 1].latitude
      )
      const curr = Cesium.Cartesian3.fromRadians(h.longitude, h.latitude)
      cumulativeDistance += Cesium.Cartesian3.distance(prev, curr)
    }
    return { distance: cumulativeDistance, elevation: h.height }
  })
}
```

## 性能考虑

大量建筑拉伸（几千个以上）用 Entity API 会卡。解决方案：

1. **Cesium 3D Tiles**：如果数据源支持，直接用 3D Tiles 格式
2. **视锥裁剪**：只加载相机可见范围内的建筑
3. **LOD**：远处用低精度几何体，近处用高精度

```ts
// 简单的视锥裁剪
function isPositionVisible(position: Cesium.Cartesian3): boolean {
  return viewer.camera.frustum.computeVisibility(
    Cesium.BoundingSphere.fromPoints([position])
  ) !== Cesium.Intersect.OUTSIDE
}
```

## 练习

### 练习一：建筑高度动画

让所有建筑从高度 0 动画拉伸到目标高度，入场效果。

### 练习二：地形热力图

在山区上方叠加一个半透明的热力平面，用颜色编码某个测量值（如气温）。

---

## 参考答案

### 练习一

```ts
function animateBuildingHeight(entity: Cesium.Entity, targetHeight: number, duration: number) {
  const start = Cesium.JulianDate.now()
  const polygon = entity.polygon as Cesium.PolygonGraphics

  polygon.extrudedHeight = new Cesium.CallbackProperty(() => {
    const elapsed = Cesium.JulianDate.secondsDifference(Cesium.JulianDate.now(), start)
    const t = Math.min(elapsed / (duration / 1000), 1)
    const eased = 1 - Math.pow(1 - t, 3)
    return targetHeight * eased
  }, false)
}

buildings.forEach((b, i) => {
  const entity = addBuildingEntity(b)
  setTimeout(() => animateBuildingHeight(entity, b.height, 1500), i * 50)
})
```

### 练习二

```ts
// 创建一个平面网格，顶点高程从地形采样
async function createTerrainHeatmap(
  bounds: { west: number; south: number; east: number; north: number },
  gridSize: number,
  temperatureData: number[][]
) {
  const positions: Cesium.Cartesian3[] = []
  const colors: Cesium.Color[] = []

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const lon = bounds.west + (x / gridSize) * (bounds.east - bounds.west)
      const lat = bounds.south + (y / gridSize) * (bounds.north - bounds.south)
      positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, 2000))
      const t = temperatureData[y][x]
      colors.push(Cesium.Color.fromHsl(0.6 - t * 0.6, 0.8, 0.5, 0.5))
    }
  }

  // 用 GeometryInstance + Primitive 创建带颜色的网格
  // ... 类似之前的 Primitive 合并方式
}
```
