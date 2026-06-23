# 飞线动画——城市间连线、弧线动画

## 场景

飞线是数据大屏上最常见的元素之一——城市间的航线、物流路径、网络链路。它比静态连线多了一个维度：时间。线上有光点在流动，暗示数据在传输。

这节课在 Cesium 地球上实现飞线动画，包括弧线生成、流动材质、和性能优化。

## 弧线生成

飞线不能画直线——地球是球面，直线会穿进地里。需要用贝塞尔曲线或 CatmullRom 样条在 3D 空间中生成弧线：

```ts
import * as Cesium from 'cesium'

interface FlightRoute {
  from: { name: string; lon: number; lat: number }
  to: { name: string; lon: number; lat: number }
  passengers: number
}

const routes: FlightRoute[] = [
  { from: { name: '北京', lon: 116.4, lat: 39.9 }, to: { name: '上海', lon: 121.5, lat: 31.2 }, passengers: 8500 },
  { from: { name: '北京', lon: 116.4, lat: 39.9 }, to: { name: '广州', lon: 113.3, lat: 23.1 }, passengers: 6200 },
  { from: { name: '上海', lon: 121.5, lat: 31.2 }, to: { name: '东京', lon: 139.7, lat: 35.7 }, passengers: 4100 },
  { from: { name: '深圳', lon: 114.1, lat: 22.5 }, to: { name: '新加坡', lon: 103.8, lat: 1.3 }, passengers: 3200 },
  { from: { name: '成都', lon: 104.1, lat: 30.6 }, to: { name: '拉萨', lon: 91.1, lat: 29.6 }, passengers: 1800 },
]

function computeArcPositions(
  from: { lon: number; lat: number },
  to: { lon: number; lat: number },
  numPoints: number = 80
): Cesium.Cartesian3[] {
  const startCart = Cesium.Cartesian3.fromDegrees(from.lon, from.lat, 0)
  const endCart = Cesium.Cartesian3.fromDegrees(to.lon, to.lat, 0)

  const distance = Cesium.Cartesian3.distance(startCart, endCart)
  const height = distance * 0.25

  const start = Cesium.Cartographic.fromCartesian(startCart)
  const end = Cesium.Cartographic.fromCartesian(endCart)

  const positions: Cesium.Cartesian3[] = []
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const lon = Cesium.Math.lerp(start.longitude, end.longitude, t)
    const lat = Cesium.Math.lerp(start.latitude, end.latitude, t)
    const altitude = Math.sin(t * Math.PI) * height
    positions.push(Cesium.Cartesian3.fromRadians(lon, lat, altitude))
  }
  return positions
}
```

## 静态飞线

先画出线本身：

```ts
const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  animation: false,
  timeline: false,
})

viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(110, 25, 8000000),
})

const maxPassengers = Math.max(...routes.map(r => r.passengers))

routes.forEach(route => {
  const t = route.passengers / maxPassengers
  const positions = computeArcPositions(route.from, route.to)

  const color = Cesium.Color.fromHsl(0.55 - t * 0.55, 0.9, 0.6, 0.5 + t * 0.3)
  const width = 1.5 + t * 3

  viewer.entities.add({
    name: `${route.from.name} → ${route.to.name}`,
    polyline: {
      positions,
      width,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.15 + t * 0.1,
        color,
      }),
    },
  })

  // 起点终点标记
  addCityMarker(route.from)
  addCityMarker(route.to)
})

function addCityMarker(city: { name: string; lon: number; lat: number }) {
  if (viewer.entities.getById(city.name)) return
  viewer.entities.add({
    id: city.name,
    position: Cesium.Cartesian3.fromDegrees(city.lon, city.lat),
    point: {
      pixelSize: 6,
      color: Cesium.Color.CYAN,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: city.name,
      font: '13px sans-serif',
      fillColor: Cesium.Color.WHITE,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      pixelOffset: new Cesium.Cartesian2(0, -14),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
  })
}
```

## 流动动画

飞线的灵魂是"光点在线上移动"。实现方式是自定义 Material，用时间 uniform 控制光斑位置：

```ts
const flowMaterial = new Cesium.Material({
  fabric: {
    type: 'FlowLine',
    uniforms: {
      baseColor: new Cesium.Color(0.3, 0.85, 1.0, 0.6),
      speed: 1.0,
    },
    source: `
      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        float s = materialInput.st.s;
        float t = czm_frameNumber * 0.005 * speed;
        float pulse = sin((s - t) * 6.2831 * 2.0) * 0.5 + 0.5;
        pulse = pow(pulse, 3.0);
        material.diffuse = baseColor.rgb + pulse * vec3(0.4, 0.6, 1.0);
        material.alpha = baseColor.a * (0.3 + pulse * 0.7);
        return material;
      }
    `,
  },
})

routes.forEach(route => {
  const positions = computeArcPositions(route.from, route.to)
  viewer.entities.add({
    polyline: {
      positions,
      width: 3,
      material: flowMaterial,
    },
  })
})
```

`czm_frameNumber` 是 Cesium 内置的时间变量，每帧递增。把它除以一个系数再取 fract，就得到一个循环移动的值。

## 粒子拖尾效果

如果想要更明显的流动感，可以在弧线上移动一组粒子：

```ts
class FlowParticle {
  position: Cesium.Cartesian3
  entity: Cesium.Entity
  progress: number = 0
  route: FlightRoute
  positions: Cesium.Cartesian3[]

  constructor(viewer: Cesium.Viewer, route: FlightRoute) {
    this.route = route
    this.positions = computeArcPositions(route.from, route.to)
    this.position = this.positions[0]

    this.entity = viewer.entities.add({
      position: new Cesium.CallbackPositionProperty(() => {
        return this.position
      }, false),
      point: {
        pixelSize: 5,
        color: Cesium.Color.WHITE.withAlpha(0.9),
        heightReference: Cesium.HeightReference.NONE,
      },
    })
  }

  update(speed: number) {
    this.progress += speed
    if (this.progress >= 1) this.progress = 0

    const idx = Math.floor(this.progress * (this.positions.length - 1))
    this.position = this.positions[Math.min(idx, this.positions.length - 1)]
  }
}

const particles = routes.map(r => new FlowParticle(viewer, r))

viewer.scene.preUpdate.addEventListener(() => {
  particles.forEach(p => p.update(0.008))
})
```

## 批量飞线的性能优化

当飞线数量超过几百条时，逐条 Entity 创建会让帧率下降。

### 用 Primitive 合并

```ts
function createBatchedFlowLines(
  viewer: Cesium.Viewer,
  routes: FlightRoute[]
) {
  const instances: Cesium.GeometryInstance[] = []

  routes.forEach(route => {
    const positions = computeArcPositions(route.from, route.to, 40)

    const polyline = new Cesium.PolylineGeometry({
      positions,
      width: 2,
      vertexFormat: Cesium.PolylineMaterialAppearance.VERTEX_FORMAT,
    })

    instances.push(new Cesium.GeometryInstance({
      geometry: polyline,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
          Cesium.Color.CYAN.withAlpha(0.6)
        ),
      },
    }))
  })

  viewer.scene.primitives.add(new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PolylineMaterialAppearance({
      material: flowMaterial,
    }),
    asynchronous: false,
  }))
}
```

## 练习

### 练习一：鼠标悬停高亮

鼠标悬停在某条飞线上时，该线变粗、亮度增加，tooltip 显示航线名称和客运量。

### 练习二：脉冲圆环

在起点城市位置加一个从小变大再消失的圆环动画，模拟"发出"的视觉效果。

---

## 参考答案

### 练习一

```ts
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
let highlighted: Cesium.Entity | null = null

handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
  const picked = viewer.scene.pick(movement.endPosition)

  if (highlighted) {
    (highlighted.polyline as Cesium.PolylineGraphics).width = 3
    highlighted = null
  }

  if (Cesium.defined(picked) && picked.id?.polyline) {
    highlighted = picked.id
    ;(highlighted.polyline as Cesium.PolylineGraphics).width = 6
    viewer.canvas.style.cursor = 'pointer'
  } else {
    viewer.canvas.style.cursor = 'default'
  }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
```

### 练习二

```ts
function addPulseRing(viewer: Cesium.Viewer, lon: number, lat: number) {
  const startTime = Cesium.JulianDate.now()

  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    ellipse: {
      semiMajorAxis: new Cesium.CallbackProperty(() => {
        const elapsed = Cesium.JulianDate.secondsDifference(
          Cesium.JulianDate.now(), startTime
        )
        const t = (elapsed % 2) / 2
        return 10000 + t * 80000
      }, false),
      semiMinorAxis: new Cesium.CallbackProperty(() => {
        const elapsed = Cesium.JulianDate.secondsDifference(
          Cesium.JulianDate.now(), startTime
        )
        const t = (elapsed % 2) / 2
        return 10000 + t * 80000
      }, false),
      material: new Cesium.ColorMaterialProperty(
        new Cesium.CallbackProperty(() => {
          const elapsed = Cesium.JulianDate.secondsDifference(
            Cesium.JulianDate.now(), startTime
          )
          const t = (elapsed % 2) / 2
          return Cesium.Color.CYAN.withAlpha(1 - t)
        }, false)
      ),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      outline: true,
      outlineColor: Cesium.Color.CYAN.withAlpha(0.8),
    },
  })
}

routes.forEach(r => addPulseRing(viewer, r.from.lon, r.from.lat))
```
