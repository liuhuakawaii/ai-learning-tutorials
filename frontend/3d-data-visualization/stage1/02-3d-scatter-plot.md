# 3D 散点图——点云渲染、颜色映射、交互选择

## 为什么需要 3D 散点图

散点图是最通用的数据探索工具。2D 散点图能展示两个变量的关系，但当数据有三个或更多连续变量时——比如基因表达量、物理模拟粒子、多维性能指标——你需要第三个轴。

3D 散点图的核心挑战不是画点，而是如何在有限的视觉空间里让成千上万个点仍然可读。

## 渲染大量点的性能问题

用 `THREE.Mesh` + `SphereGeometry` 画 1000 个点没问题，画 50000 个就开始卡。每个 Mesh 是一次 draw call，GPU 不喜欢这样。

解法：用 `THREE.Points` + `BufferGeometry`，一次 draw call 画所有点。

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

interface Sample {
  x: number
  y: number
  z: number
  category: string
  value: number
}

const categories = ['A', 'B', 'C', 'D']
const categoryColors: Record<string, THREE.Color> = {
  A: new THREE.Color(0x4fc3f7),
  B: new THREE.Color(0xff7043),
  C: new THREE.Color(0x66bb6a),
  D: new THREE.Color(0xab47bc),
}

function generateData(count: number): Sample[] {
  return Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 20,
    y: (Math.random() - 0.5) * 20,
    z: (Math.random() - 0.5) * 20,
    category: categories[Math.floor(Math.random() * categories.length)],
    value: Math.random() * 100,
  }))
}

const data = generateData(8000)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x111122)

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500)
camera.position.set(18, 14, 18)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
```

## 用 BufferGeometry 构建点云

把数据填进 attribute buffer：

```ts
const positions = new Float32Array(data.length * 3)
const colors = new Float32Array(data.length * 3)
const sizes = new Float32Array(data.length)

const maxValue = Math.max(...data.map(d => d.value))

data.forEach((d, i) => {
  positions[i * 3] = d.x
  positions[i * 3 + 1] = d.y
  positions[i * 3 + 2] = d.z

  const color = categoryColors[d.category]
  colors[i * 3] = color.r
  colors[i * 3 + 1] = color.g
  colors[i * 3 + 2] = color.b

  sizes[i] = 2 + (d.value / maxValue) * 8
})

const geometry = new THREE.BufferGeometry()
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
```

## 自定义 Shader 控制点的大小和形状

默认的 `THREE.PointsMaterial` 大小是屏幕像素，不随距离衰减。用 ShaderMaterial 可以精确控制：

```ts
const vertexShader = `
  attribute float size;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = `
  varying vec3 vColor;
  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    gl_FragColor = vec4(vColor, alpha * 0.85);
  }
`

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  vertexColors: true,
  transparent: true,
  depthWrite: false,
})

const points = new THREE.Points(geometry, material)
scene.add(points)
```

Fragment shader 里画了一个带柔和边缘的圆点。`discard` 让超出半径的像素不渲染，避免方块感。

## 坐标轴与参考面

散点图需要坐标轴来提供尺度参考：

```ts
function createAxis(
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: number
): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to])
  const mat = new THREE.LineBasicMaterial({ color })
  return new THREE.Line(geo, mat)
}

const axisLength = 12
scene.add(createAxis(
  new THREE.Vector3(-axisLength, 0, 0),
  new THREE.Vector3(axisLength, 0, 0),
  0xff4444
))
scene.add(createAxis(
  new THREE.Vector3(0, -axisLength, 0),
  new THREE.Vector3(0, axisLength, 0),
  0x44ff44
))
scene.add(createAxis(
  new THREE.Vector3(0, 0, -axisLength),
  new THREE.Vector3(0, 0, axisLength),
  0x4444ff
))

const gridXZ = new THREE.GridHelper(24, 24, 0x333355, 0x222244)
scene.add(gridXZ)
```

## 交互：框选与单点选取

### 单点选取（Raycaster）

`THREE.Points` 的 raycaster 需要特殊处理——它命中的是整个点云，需要自己找最近的点：

```ts
const raycaster = new THREE.Raycaster()
raycaster.params.Points = { threshold: 0.5 }
const mouse = new THREE.Vector2()

const tooltip = document.createElement('div')
tooltip.style.cssText = `
  position: fixed; padding: 6px 10px; background: rgba(0,0,0,0.8);
  color: #fff; border-radius: 4px; font-size: 12px;
  pointer-events: none; display: none; z-index: 10;
`
document.body.appendChild(tooltip)

window.addEventListener('mousemove', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1
  mouse.y = -(e.clientY / innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObject(points)

  if (intersects.length > 0) {
    const idx = intersects[0].index!
    const d = data[idx]
    tooltip.style.display = 'block'
    tooltip.style.left = `${e.clientX + 10}px`
    tooltip.style.top = `${e.clientY - 6}px`
    tooltip.textContent = `[${d.category}] (${d.x.toFixed(1)}, ${d.y.toFixed(1)}, ${d.z.toFixed(1)}) value=${d.value.toFixed(1)}`
  } else {
    tooltip.style.display = 'none'
  }
})
```

### 框选过滤

框选让用户在屏幕上画一个矩形，选中范围内的点。实现方式：记录鼠标起止坐标，转为 NDC，判断哪些点投影后落在矩形内。

## 数据映射设计

| 数据维度 | 视觉通道 | 选择理由 |
|---------|---------|---------|
| 分类 | 颜色色相 | 类别是离散的，色相天然离散 |
| 数值大小 | 点大小 | 连续变量，大小连续变化 |
| 三维坐标 | 空间位置 | 散点图的核心映射 |

如果还有第五个维度（比如时间），可以用动画——让点按时间顺序出现或移动。

## 常见问题

**点太密看不清**：加透明度，让重叠区域颜色加深自然形成密度暗示。或者加一个小的随机偏移（jitter）。

**旋转时迷失方向**：始终显示坐标轴和标签。考虑加一个 orientation gizmo（方向指示器）。

**颜色太多区分不开**：超过 6-7 种类别后，颜色就难以区分了。这时候应该加筛选控件，让用户按类别显隐。

## 练习

### 练习一：对数映射

当数据分布极度不均匀时（大部分值很小，少数值很大），线性映射会让小值点看不见。实现一个对数映射，让点大小更均匀。

### 练习二：淡入淡出分类过滤

添加 4 个按钮，点击某个类别按钮时，其他类别的点淡出（透明度降到 0.1），被选中的类别保持原样。

---

## 参考答案

### 练习一

```ts
const logMax = Math.log(maxValue + 1)

data.forEach((d, i) => {
  const logValue = Math.log(d.value + 1)
  sizes[i] = 2 + (logValue / logMax) * 8
})

geometry.attributes.size.needsUpdate = true
```

对数映射让 value=1 和 value=10 的差距变大，value=100 和 value=1000 的差距变小，视觉上更均匀。

### 练习二

```ts
const categoryBtns = categories.map(cat => {
  const btn = document.createElement('button')
  btn.textContent = cat
  btn.style.cssText = `margin: 4px; padding: 6px 16px; cursor: pointer;`
  btn.style.background = `#${categoryColors[cat].getHexString()}`
  btn.style.color = '#000'
  btn.style.border = 'none'
  btn.style.borderRadius = '4px'
  document.body.appendChild(btn)
  return btn
})

function filterByCategory(targetCat: string | null) {
  const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute
  data.forEach((d, i) => {
    const c = categoryColors[d.category]
    const active = targetCat === null || d.category === targetCat
    const factor = active ? 1.0 : 0.1
    colorAttr.setXYZ(i, c.r * factor, c.g * factor, c.b * factor)
  })
  colorAttr.needsUpdate = true
}

categoryBtns.forEach((btn, i) => {
  let active = false
  btn.addEventListener('click', () => {
    active = !active
    filterByCategory(active ? categories[i] : null)
  })
})
```
