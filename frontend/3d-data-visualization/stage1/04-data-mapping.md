# 数据映射——颜色/大小/位置的数据编码

## 这节课的定位

前面三节课你已经用过位置、颜色、大小来编码数据，但都是凭直觉选的。这节课把映射设计系统化——面对一张数据表，如何决定哪个字段用哪个视觉通道，以及如何实现各种映射函数。

这不是美术课。映射设计的目标是让观察者能快速、准确地读出数据差异。

## 视觉通道的感知能力

人眼对不同视觉属性的感知精度不一样：

| 视觉通道 | 感知精度 | 适合编码 |
|---------|---------|---------|
| 位置（X/Y/Z） | 最高 | 精确数值比较 |
| 长度/高度 | 高 | 数值大小 |
| 角度/斜率 | 中等 | 趋势变化 |
| 面积 | 较低 | 粗略数量级 |
| 颜色亮度 | 中等 | 连续数值 |
| 颜色色相 | 较低 | 分类、离散值 |
| 透明度 | 低 | 筛选状态、次要信息 |
| 纹理/形状 | 低 | 分类标记 |

核心原则：**最重要的数据维度用最高精度的通道编码**。

## 颜色映射

### 连续值 → 颜色梯度

最常见的映射。实现方式是定义两个（或多个）颜色锚点，然后在之间插值：

```ts
import * as THREE from 'three'

interface ColorRamp {
  stops: { value: number; color: THREE.Color }[]
}

const temperatureRamp: ColorRamp = {
  stops: [
    { value: 0, color: new THREE.Color(0x2166ac) },
    { value: 0.25, color: new THREE.Color(0x67a9cf) },
    { value: 0.5, color: new THREE.Color(0xf7f7f7) },
    { value: 0.75, color: new THREE.Color(0xef8a62) },
    { value: 1, color: new THREE.Color(0xb2182b) },
  ],
}

function sampleRamp(ramp: ColorRamp, t: number): THREE.Color {
  t = Math.max(0, Math.min(1, t))
  const stops = ramp.stops
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].value && t <= stops[i + 1].value) {
      const local = (t - stops[i].value) / (stops[i + 1].value - stops[i].value)
      return new THREE.Color().lerpColors(stops[i].color, stops[i + 1].color, local)
    }
  }
  return stops[stops.length - 1].color.clone()
}
```

### 分类值 → 离散色板

分类数据用色相区分，不要用亮度（人眼对亮度差异的分辨力不够）：

```ts
const categoricalPalette = [
  0x4e79a7, 0xf28e2b, 0xe15759, 0x76b7b2,
  0x59a14f, 0xedc948, 0xb07aa1, 0xff9da7,
  0x9c755f, 0xfab0ce,
]

function categoryColor(index: number): THREE.Color {
  return new THREE.Color(categoricalPalette[index % categoricalPalette.length])
}
```

选色板时考虑色觉障碍——红绿同时出现对约 8% 的男性用户是灾难。上面的色板来自 Tableau 10，经过色觉障碍测试。

## 大小映射

### 线性映射

```ts
function linearScale(
  value: number,
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number
): number {
  const t = (value - domainMin) / (domainMax - domainMin)
  return rangeMin + t * (rangeMax - rangeMin)
}
```

### 面积映射 vs 半径映射

这是最常见的错误。如果你想用圆的面积表示数值大小：

```ts
function radiusByArea(
  value: number,
  maxValue: number,
  maxRadius: number
): number {
  // 面积 ∝ 值 → 半径 ∝ sqrt(值)
  return maxRadius * Math.sqrt(value / maxValue)
}

// 错误做法：半径直接 ∝ 值
function radiusByValue(value: number, maxValue: number, maxRadius: number): number {
  return maxRadius * (value / maxValue)
}
```

如果用半径线性映射，value 翻倍时面积变成 4 倍，观察者会严重高估差异。

### 3D 里的体积映射

球体体积 V = (4/3)πr³，所以：

```ts
function radiusByVolume(
  value: number,
  maxValue: number,
  maxRadius: number
): number {
  return maxRadius * Math.cbrt(value / maxValue)
}
```

## 位置映射

3D 可视化里位置映射通常是把数据值直接映射到坐标轴：

```ts
interface DataSet {
  records: { gdp: number; population: number; lifeExpectancy: number }[]
}

function mapToPosition(
  record: { gdp: number; population: number; lifeExpectancy: number },
  bounds: {
    gdpRange: [number, number]
    popRange: [number, number]
    lifeRange: [number, number]
  }
): THREE.Vector3 {
  return new THREE.Vector3(
    linearScale(record.gdp, ...bounds.gdpRange, -10, 10),
    linearScale(record.lifeExpectancy, ...bounds.lifeRange, -10, 10),
    linearScale(record.population, ...bounds.popRange, -10, 10)
  )
}
```

位置映射的关键是轴的选择。把最重要的比较放在 Y 轴（人眼最敏感），次要的放 X 和 Z。

## 组合映射：同时编码多个维度

实际项目中经常需要在一个几何体上编码 5-6 个维度。视觉通道不够用时，有两种策略：

### 策略一：分层展示

同一个图表里放所有数据，但加筛选控件让用户按某个维度切片。

### 策略二：小多图

同一组数据在多个子视图中用不同的映射方案展示。Three.js 里可以用多个 viewport 实现：

```ts
function renderSmallMultiples() {
  const viewports = [
    { left: 0, bottom: 0, width: 0.5, height: 0.5 },
    { left: 0.5, bottom: 0, width: 0.5, height: 0.5 },
    { left: 0, bottom: 0.5, width: 0.5, height: 0.5 },
    { left: 0.5, bottom: 0.5, width: 0.5, height: 0.5 },
  ]

  viewports.forEach((vp, i) => {
    const x = vp.left * innerWidth
    const y = vp.bottom * innerHeight
    const w = vp.width * innerWidth
    const h = vp.height * innerHeight

    renderer.setViewport(x, y, w, h)
    renderer.setScissor(x, y, w, h)
    renderer.setScissorTest(true)

    // 每个视口用不同的映射
    cameras[i].aspect = w / h
    cameras[i].updateProjectionMatrix()
    renderer.render(scene, cameras[i])
  })
}
```

## 映射设计的常见错误

**彩虹色图**：jet/rainbow 色图在亮度上不均匀，会制造假的边界。用 viridis、plasma 或自定义的发散色图。

**忽视数据分布**：均匀映射在数据严重偏斜时会让大部分点挤在角落。先看数据分布，再决定用线性、对数还是分位数映射。

**视觉通道冲突**：颜色和大小都在编码同一个字段，浪费了一个通道，也增加了认知负担。

## 练习

### 练习一：实现一个映射工具函数

写一个 `createMapper` 函数，接收数据范围、视觉范围、映射类型（linear/log/sqrt/cbrt），返回映射函数。

### 练习二：颜色图例

在场景边缘渲染一个颜色图例（color legend），显示温度色带和对应数值。用 HTML/CSS 叠加在 canvas 上。

---

## 参考答案

### 练习一

```ts
type ScaleType = 'linear' | 'log' | 'sqrt' | 'cbrt'

function createMapper(
  domain: [number, number],
  range: [number, number],
  type: ScaleType = 'linear'
): (value: number) => number {
  const [dMin, dMax] = domain
  const [rMin, rMax] = range
  const dSpan = dMax - dMin || 1
  const rSpan = rMax - rMin

  const transforms: Record<ScaleType, (t: number) => number> = {
    linear: t => t,
    log: t => Math.log(t * 9 + 1) / Math.log(10),
    sqrt: t => Math.sqrt(t),
    cbrt: t => Math.cbrt(t),
  }

  return (value: number) => {
    const t = Math.max(0, Math.min(1, (value - dMin) / dSpan))
    const transformed = transforms[type](t)
    return rMin + transformed * rSpan
  }
}

const heightMapper = createMapper([0, 1000], [0, 6], 'log')
const colorMapper = createMapper([-20, 40], [0, 1], 'linear')
const sizeMapper = createMapper([0, 50000], [0.2, 1.5], 'sqrt')
```

### 练习二

```ts
function createColorLegend(
  ramp: ColorRamp,
  label: string,
  minVal: number,
  maxVal: number
): HTMLDivElement {
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed; right: 20px; top: 50%; transform: translateY(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 4px;
  `

  const title = document.createElement('div')
  title.textContent = label
  title.style.cssText = 'color: #ccc; font-size: 12px; margin-bottom: 8px;'
  container.appendChild(title)

  const bar = document.createElement('div')
  bar.style.cssText = 'width: 20px; height: 200px; border-radius: 4px;'
  const gradientStops = ramp.stops
    .map(s => `#${s.color.getHexString()} ${s.value * 100}%`)
    .join(', ')
  bar.style.background = `linear-gradient(to bottom, ${gradientStops})`
  container.appendChild(bar)

  const labels = [maxVal, (maxVal + minVal) / 2, minVal]
  labels.forEach(val => {
    const lbl = document.createElement('div')
    lbl.textContent = val.toFixed(0)
    lbl.style.cssText = 'color: #aaa; font-size: 11px;'
    container.appendChild(lbl)
  })

  return container
}

document.body.appendChild(
  createColorLegend(temperatureRamp, '温度 (°C)', -20, 40)
)
```
