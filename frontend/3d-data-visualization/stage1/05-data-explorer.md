# 阶段实战：构建一个 3D 数据探索器

## 项目目标

把前四节课的内容整合成一个可交互的 3D 数据探索器：导入一份真实数据集，用散点图展示，支持颜色/大小映射切换、分类筛选、框选、详情查看。

这是第一阶段的综合练习，完成后你会得到一个可扩展的可视化基座，后续阶段的地理可视化和网络可视化都基于类似的交互框架。

## 数据集

用公开的 Gapminder 数据——每个国家一行，字段包括 GDP、人均寿命、人口、所属洲、年份。我们取 2020 年的截面数据：

```ts
interface CountryData {
  name: string
  gdpPerCapita: number
  lifeExpectancy: number
  population: number
  continent: string
}

// 实际项目里从 CSV/JSON 加载，这里用 fetch
async function loadData(): Promise<CountryData[]> {
  const resp = await fetch('/data/gapminder-2020.json')
  return resp.json()
}
```

如果暂时没有数据文件，可以用内联生成模拟数据：

```ts
function generateMockData(): CountryData[] {
  const continents = ['Asia', 'Europe', 'Africa', 'Americas', 'Oceania']
  return Array.from({ length: 80 }, (_, i) => ({
    name: `Country-${i}`,
    gdpPerCapita: 500 + Math.random() * 60000,
    lifeExpectancy: 45 + Math.random() * 40,
    population: 1e5 + Math.random() * 1.4e9,
    continent: continents[Math.floor(Math.random() * continents.length)],
  }))
}
```

## 整体架构

```
3D Data Explorer
├── SceneManager      — Three.js 场景、相机、渲染器、Controls
├── DataMapper        — 映射函数管理（颜色、大小、位置）
├── PointCloud        — BufferGeometry 点云渲染
├── InteractionManager — Raycaster、框选、tooltip
├── FilterPanel       — 分类筛选 UI
└── MappingPanel      — 映射维度切换 UI
```

## 核心实现

### SceneManager

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

class SceneManager {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  labelRenderer: CSS2DRenderer
  controls: OrbitControls

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0d1117)

    this.camera = new THREE.PerspectiveCamera(
      60, innerWidth / innerHeight, 0.1, 500
    )
    this.camera.position.set(20, 15, 20)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(innerWidth, innerHeight)
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)

    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.setSize(innerWidth, innerHeight)
    this.labelRenderer.domElement.style.position = 'absolute'
    this.labelRenderer.domElement.style.top = '0'
    this.labelRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(this.labelRenderer.domElement)

    this.controls = new OrbitControls(camera, this.renderer.domElement)
    this.controls.enableDamping = true

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(10, 15, 10)
    this.scene.add(dir)
    this.scene.add(new THREE.GridHelper(30, 30, 0x222244, 0x1a1a33))

    window.addEventListener('resize', this.onResize.bind(this))
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(innerWidth, innerHeight)
    this.labelRenderer.setSize(innerWidth, innerHeight)
  }

  render() {
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }
}
```

### DataMapper

```ts
type MapperFn = (value: number) => number

class DataMapper {
  private mappers = new Map<string, MapperFn>()

  set(
    name: string,
    domain: [number, number],
    range: [number, number],
    type: 'linear' | 'log' | 'sqrt' = 'linear'
  ) {
    const [dMin, dMax] = domain
    const [rMin, rMax] = range
    const transforms = {
      linear: (t: number) => t,
      log: (t: number) => Math.log(t * 9 + 1) / Math.log(10),
      sqrt: (t: number) => Math.sqrt(t),
    }
    this.mappers.set(name, (value: number) => {
      const t = Math.max(0, Math.min(1, (value - dMin) / (dMax - dMin || 1)))
      return rMin + transforms[type](t) * (rMax - rMin)
    })
  }

  get(name: string): MapperFn {
    return this.mappers.get(name) ?? ((v) => v)
  }
}
```

### PointCloud

```ts
class PointCloud {
  geometry: THREE.BufferGeometry
  material: THREE.ShaderMaterial
  points: THREE.Points
  data: CountryData[]

  constructor(scene: THREE.Scene, data: CountryData[]) {
    this.data = data
    this.geometry = new THREE.BufferGeometry()

    const positions = new Float32Array(data.length * 3)
    const colors = new Float32Array(data.length * 3)
    const sizes = new Float32Array(data.length)

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    this.material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (150.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float alpha = 1.0 - smoothstep(0.3, 0.5, d);
          gl_FragColor = vec4(vColor, alpha * 0.85);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    })

    this.points = new THREE.Points(this.geometry, this.material)
    scene.add(this.points)
  }

  updatePositions(mapper: DataMapper, xField: string, yField: string, zField: string) {
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute
    const mx = mapper.get(xField)
    const my = mapper.get(yField)
    const mz = mapper.get(zField)
    this.data.forEach((d, i) => {
      pos.setXYZ(i, mx((d as any)[xField]), my((d as any)[yField]), mz((d as any)[zField]))
    })
    pos.needsUpdate = true
  }

  updateColors(mapper: DataMapper, colorField: string, palette: THREE.Color[]) {
    const col = this.geometry.getAttribute('color') as THREE.BufferAttribute
    const colorFn = mapper.get(colorField)
    this.data.forEach((d, i) => {
      const t = colorFn((d as any)[colorField])
      const ci = Math.floor(t * (palette.length - 1))
      const c = palette[Math.min(ci, palette.length - 1)]
      col.setXYZ(i, c.r, c.g, c.b)
    })
    col.needsUpdate = true
  }

  updateSizes(mapper: DataMapper, sizeField: string) {
    const sz = this.geometry.getAttribute('size') as THREE.BufferAttribute
    const sizeFn = mapper.get(sizeField)
    this.data.forEach((d, i) => {
      sz.setX(i, sizeFn((d as any)[sizeField]))
    })
    sz.needsUpdate = true
  }

  setVisibility(mask: boolean[]) {
    const col = this.geometry.getAttribute('color') as THREE.BufferAttribute
    this.data.forEach((_, i) => {
      if (!mask[i]) {
        col.setXYZ(i, 0.1, 0.1, 0.1)
      }
    })
    col.needsUpdate = true
  }
}
```

### 主程序

```ts
async function main() {
  const data = generateMockData()

  const container = document.getElementById('app')!
  const scene = new SceneManager(container)

  const mapper = new DataMapper()
  mapper.set('gdpPerCapita', [0, 60000], [-10, 10], 'log')
  mapper.set('lifeExpectancy', [40, 85], [-10, 10], 'linear')
  mapper.set('population', [1e5, 1.4e9], [0.3, 2], 'sqrt')
  mapper.set('continent', [0, 4], [0, 1], 'linear')

  const cloud = new PointCloud(scene.scene, data)
  cloud.updatePositions(mapper, 'gdpPerCapita', 'lifeExpectancy', 'population')
  cloud.updateSizes(mapper, 'population')

  const palette = [
    new THREE.Color(0x4e79a7),
    new THREE.Color(0xf28e2b),
    new THREE.Color(0xe15759),
    new THREE.Color(0x76b7b2),
    new THREE.Color(0x59a14f),
  ]
  cloud.updateColors(mapper, 'continent', palette)

  function animate() {
    requestAnimationFrame(animate)
    scene.render()
  }
  animate()
}

main()
```

## 扩展方向

这个基座可以沿很多方向扩展：

- **映射面板**：下拉框切换 X/Y/Z 轴绑定的字段
- **筛选面板**：洲的复选框，勾选/取消控制点的显隐
- **框选工具**：鼠标拖拽矩形，选中的点高亮并弹出详情
- **动画过渡**：切换映射字段时，点的位置平滑过渡

这些交互在后续课程中会逐步用到。第一阶段的目标是把数据 → 映射 → 渲染 → 交互这条链路跑通。

## 练习

### 练习一：映射切换面板

给页面加三个下拉框，分别控制 X 轴、Y 轴、Z 轴绑定的数据字段。切换时点云位置平滑过渡（用 lerp 逼近，不要瞬间跳变）。

### 练习二：轴标签实时更新

当用户切换某个轴的绑定字段时，对应轴的标签（CSS2DObject）也要更新。

---

## 参考答案

### 练习一

```ts
let currentX = 'gdpPerCapita', currentY = 'lifeExpectancy', currentZ = 'population'
let targetPositions = new Float32Array(data.length * 3)

function computeTargets() {
  const mx = mapper.get(currentX)
  const my = mapper.get(currentY)
  const mz = mapper.get(currentZ)
  data.forEach((d, i) => {
    targetPositions[i * 3] = mx((d as any)[currentX])
    targetPositions[i * 3 + 1] = my((d as any)[currentY])
    targetPositions[i * 3 + 2] = mz((d as any)[currentZ])
  })
}

function animate() {
  requestAnimationFrame(animate)

  const pos = cloud.geometry.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < data.length * 3; i++) {
    const current = pos.array[i] as number
    pos.array[i] = current + (targetPositions[i] - current) * 0.08
  }
  pos.needsUpdate = true

  scene.render()
}

// 绑定下拉框事件
function bindAxis(select: HTMLSelectElement, setter: (field: string) => void) {
  select.addEventListener('change', () => {
    setter(select.value)
    computeTargets()
  })
}

bindAxis(xSelect, v => { currentX = v })
bindAxis(ySelect, v => { currentY = v })
bindAxis(zSelect, v => { currentZ = v })
```

### 练习二

```ts
const axisLabels: { label: CSS2DObject; field: string; axis: 'x' | 'y' | 'z' }[] = []

function createAxisLabel(field: string, axis: 'x' | 'y' | 'z') {
  const div = document.createElement('div')
  div.textContent = field
  div.style.cssText = 'color: #aaa; font-size: 13px; background: rgba(0,0,0,0.6); padding: 2px 8px; border-radius: 3px;'
  const label = new CSS2DObject(div)
  const pos = { x: 12, y: -0.5, z: -0.5 }
  if (axis === 'y') { pos.x = -0.5; pos.y = 12; pos.z = -0.5 }
  if (axis === 'z') { pos.x = -0.5; pos.y = -0.5; pos.z = 12 }
  label.position.set(pos.x, pos.y, pos.z)
  scene.scene.add(label)
  axisLabels.push({ label, field, axis })
}

function updateAxisLabel(axis: 'x' | 'y' | 'z', newField: string) {
  const entry = axisLabels.find(a => a.axis === axis)
  if (entry) {
    entry.field = newField
    ;(entry.label.element as HTMLDivElement).textContent = newField
  }
}
```
