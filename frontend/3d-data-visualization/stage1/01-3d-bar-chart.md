# 3D 柱状图——从数据到几何体的映射

## 这节课解决什么问题

你在 ECharts 里做过柱状图，用户能看到数据。但当维度增加——比如同时展示城市、时间、行业——平面柱状图要么挤不下，要么需要切很多 tab。3D 柱状图把第三个维度用空间位置编码，让多维数据在同一个视图里可比较。

问题是：数据字段怎么变成 3D 里的高度、颜色、位置？

## 建立映射思维

3D 柱状图本质上是把数据表的每一行映射成一个长方体。映射关系通常是：

| 数据维度 | 视觉通道 | 说明 |
|---------|---------|------|
| 分类 A（城市） | X 轴位置 | 每个城市占一列 |
| 分类 B（行业） | Z 轴位置 | 每个行业占一行 |
| 数值（营收） | Y 轴高度 | 柱子高度表示数值大小 |
| 数值（增长率） | 颜色色相 | 绿色增长、红色下降 |

这个映射不是固定的。你需要根据数据特征决定哪个维度放哪个通道。

## 最小可运行示例

先搭一个 Three.js 场景，放一组柱子进去：

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

interface DataPoint {
  city: string
  industry: string
  revenue: number
  growth: number
}

const data: DataPoint[] = [
  { city: '北京', industry: '科技', revenue: 850, growth: 0.12 },
  { city: '北京', industry: '金融', revenue: 620, growth: -0.05 },
  { city: '上海', industry: '科技', revenue: 720, growth: 0.08 },
  { city: '上海', industry: '金融', revenue: 900, growth: 0.15 },
  { city: '深圳', industry: '科技', revenue: 680, growth: 0.20 },
  { city: '深圳', industry: '金融', revenue: 450, growth: -0.03 },
]

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a1a2e)

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000)
camera.position.set(12, 10, 12)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(devicePixelRatio)
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const cities = [...new Set(data.map(d => d.city))]
const industries = [...new Set(data.map(d => d.industry))]

const maxRevenue = Math.max(...data.map(d => d.revenue))
const spacing = 2
const barWidth = 0.6

function growthToColor(growth: number): THREE.Color {
  if (growth >= 0) {
    const t = Math.min(growth / 0.2, 1)
    return new THREE.Color().lerpColors(
      new THREE.Color(0x44aa88),
      new THREE.Color(0x00ff88),
      t
    )
  } else {
    const t = Math.min(Math.abs(growth) / 0.1, 1)
    return new THREE.Color().lerpColors(
      new THREE.Color(0xaa4444),
      new THREE.Color(0xff2222),
      t
    )
  }
}

const bars: THREE.Mesh[] = []

data.forEach(d => {
  const xi = cities.indexOf(d.city)
  const zi = industries.indexOf(d.industry)
  const height = (d.revenue / maxRevenue) * 6

  const geometry = new THREE.BoxGeometry(barWidth, height, barWidth)
  geometry.translate(0, height / 2, 0)

  const material = new THREE.MeshStandardMaterial({
    color: growthToColor(d.growth),
    roughness: 0.4,
    metalness: 0.2,
  })

  const bar = new THREE.Mesh(geometry, material)
  bar.position.set(
    (xi - (cities.length - 1) / 2) * spacing,
    0,
    (zi - (industries.length - 1) / 2) * spacing
  )
  bar.userData = d
  scene.add(bar)
  bars.push(bar)
})

const gridHelper = new THREE.GridHelper(20, 20, 0x444466, 0x333355)
scene.add(gridHelper)

const ambient = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambient)
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
dirLight.position.set(5, 10, 5)
scene.add(dirLight)

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}
animate()

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})
```

## 映射设计的关键判断

### 为什么 X 和 Z 放分类，Y 放数值

人眼对高度差异最敏感。把数值映射到 Y 轴高度，观察者扫一眼就能比较大小。如果把数值映射到 X 或 Z 轴位置，比较需要额外的心智计算。

### 颜色通道不要重复编码已有的信息

如果柱子高度已经表示营收，颜色再表示营收就是浪费。颜色应该编码另一个维度——这里是增长率。这样同一个柱子同时传递两条信息。

### 色彩选择要考虑语义

增长用暖色/绿色、下降用冷色/红色，这符合大多数人的直觉。但如果你的受众在金融领域，可能红涨绿跌。映射关系要匹配用户的领域认知。

## 加上坐标轴标签

没有标签的 3D 图表是废的。用 CSS2DRenderer 做标签：

```ts
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(innerWidth, innerHeight)
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.top = '0'
labelRenderer.domElement.style.pointerEvents = 'none'
document.body.appendChild(labelRenderer.domElement)

cities.forEach((city, i) => {
  const div = document.createElement('div')
  div.textContent = city
  div.style.color = '#ccc'
  div.style.fontSize = '14px'
  div.style.padding = '2px 6px'
  const label = new CSS2DObject(div)
  label.position.set(
    (i - (cities.length - 1) / 2) * spacing,
    -0.5,
    -(industries.length / 2) * spacing - 1
  )
  scene.add(label)
})

industries.forEach((ind, i) => {
  const div = document.createElement('div')
  div.textContent = ind
  div.style.color = '#ccc'
  div.style.fontSize = '14px'
  const label = new CSS2DObject(div)
  label.position.set(
    -(cities.length / 2) * spacing - 1,
    -0.5,
    (i - (industries.length - 1) / 2) * spacing
  )
  scene.add(label)
})
```

## 添加悬停交互

鼠标悬停时高亮柱子并显示详情：

```ts
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let hovered: THREE.Mesh | null = null

const tooltip = document.createElement('div')
tooltip.style.cssText = `
  position: fixed; padding: 8px 12px; background: rgba(0,0,0,0.85);
  color: #fff; border-radius: 4px; font-size: 13px; pointer-events: none;
  display: none; z-index: 10;
`
document.body.appendChild(tooltip)

window.addEventListener('mousemove', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1
  mouse.y = -(e.clientY / innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects(bars)

  if (hovered) {
    (hovered.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000)
    hovered = null
  }

  if (hits.length > 0) {
    hovered = hits[0].object as THREE.Mesh
    const d = hovered.userData as DataPoint
    ;(hovered.material as THREE.MeshStandardMaterial).emissive.setHex(0x333333)
    tooltip.style.display = 'block'
    tooltip.style.left = `${e.clientX + 12}px`
    tooltip.style.top = `${e.clientY - 8}px`
    tooltip.textContent = `${d.city} · ${d.industry}：营收 ${d.revenue} 亿，增长 ${(d.growth * 100).toFixed(1)}%`
  } else {
    tooltip.style.display = 'none'
  }
})
```

别忘了在 animate 函数里加上 `labelRenderer.render(scene, camera)`。

## 常见坑

**柱子穿插**：当数据量大时，柱子间距不够会重叠。解法是根据数据量动态计算 spacing。

**数值差异过大**：比如一个城市营收 10000，另一个只有 5。线性映射会让矮柱子几乎看不见。可以考虑对数映射，但要在标签上注明。

**透明度不够**：当观察角度导致柱子互相遮挡时，可以给被遮挡的柱子加透明度，或者用半透明材质。

## 练习

### 练习一：添加第四维度

在现有映射基础上，用柱子的粗细（XZ 平面尺寸）编码员工数量。修改代码，让同一张图展示四个数据维度。

### 练习二：动画入场

让柱子从高度 0 动画增长到目标高度，用 `requestAnimationFrame` 实现，不要用任何动画库。

---

## 参考答案

### 练习一

**思路**：在创建 BoxGeometry 时，把 barWidth 从固定值改为根据员工数量计算。

```ts
const maxEmployees = Math.max(...data.map(d => d.employees))

data.forEach(d => {
  const xi = cities.indexOf(d.city)
  const zi = industries.indexOf(d.industry)
  const height = (d.revenue / maxRevenue) * 6
  const widthScale = 0.3 + (d.employees / maxEmployees) * 0.7

  const geometry = new THREE.BoxGeometry(
    barWidth * widthScale,
    height,
    barWidth * widthScale
  )
  // ... 其余代码不变
})
```

**注意**：粗细差异太小时人眼分辨不出，差异太大时柱子会重叠。需要根据数据分布调整映射范围。

### 练习二

**思路**：在 data 里记录目标高度，渲染时用一个动画变量逐步逼近。

```ts
const barTargets = data.map(d => (d.revenue / maxRevenue) * 6)
const barCurrentHeights = new Float32Array(data.length).fill(0)

function animate() {
  requestAnimationFrame(animate)

  bars.forEach((bar, i) => {
    barCurrentHeights[i] += (barTargets[i] - barCurrentHeights[i]) * 0.08
    bar.scale.y = barCurrentHeights[i] / barTargets[i] || 0.001
  })

  controls.update()
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}
```

**常见错误**：直接用 `bar.scale.y` 从 0 到 1 线性变化会显得生硬。用缓动（这里用的是 ease-out 指数逼近）效果更自然。
