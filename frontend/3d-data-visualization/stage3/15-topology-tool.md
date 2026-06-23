# 阶段实战：构建一个网络拓扑可视化工具

## 项目目标

把第三阶段的技能整合成一个完整的网络拓扑可视化工具：支持层次布局和力导向布局切换、节点类型区分、边的状态高亮、社区检测、交互查询。

## 整体架构

```
TopologyVisualizer
├── DataManager        — 数据加载、格式转换
├── LayoutEngine       — 层次/力导向布局
├── Renderer           — Three.js 渲染
├── CommunityDetector  — 社区检测
├── InteractionManager — 点击、悬停、搜索
└── UI                 — 侧边栏、工具栏
```

## 数据

模拟一个有 100 个节点的网络：

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

interface Node {
  id: string
  label: string
  type: 'router' | 'switch' | 'server' | 'database' | 'client'
  layer: 'core' | 'distribution' | 'access'
  cpu?: number
  status: 'normal' | 'warning' | 'error'
}

interface Edge {
  source: string
  target: string
  bandwidth: number
  latency: number
  status: 'normal' | 'warning' | 'error'
}

function generateNetwork(nodeCount: number): { nodes: Node[]; edges: Edge[] } {
  const types: Node['type'][] = ['router', 'switch', 'server', 'database', 'client']
  const layers: Node['layer'][] = ['core', 'distribution', 'access']

  const nodes: Node[] = Array.from({ length: nodeCount }, (_, i) => {
    const layer = i < 5 ? 'core' : i < 20 ? 'distribution' : 'access'
    const type = layer === 'core' ? 'router' : layer === 'distribution' ? 'switch' : types[2 + Math.floor(Math.random() * 3)]
    return {
      id: `n-${i}`,
      label: `${type}-${i}`,
      type,
      layer,
      cpu: Math.random() * 100,
      status: Math.random() > 0.9 ? 'error' : Math.random() > 0.8 ? 'warning' : 'normal',
    }
  })

  const edges: Edge[] = []

  // 核心层互联
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      edges.push({ source: `n-${i}`, target: `n-${j}`, bandwidth: 10000, latency: 0.1, status: 'normal' })
    }
  }

  // 分布层连接核心
  for (let i = 5; i < 20; i++) {
    const coreIdx = Math.floor(Math.random() * 5)
    edges.push({ source: `n-${coreIdx}`, target: `n-${i}`, bandwidth: 1000, latency: 0.5, status: Math.random() > 0.9 ? 'warning' : 'normal' })
  }

  // 接入层连接分布
  for (let i = 20; i < nodeCount; i++) {
    const distIdx = 5 + Math.floor(Math.random() * 15)
    edges.push({ source: `n-${distIdx}`, target: `n-${i}`, bandwidth: 100, latency: 1 + Math.random() * 5, status: Math.random() > 0.85 ? 'error' : 'normal' })
  }

  return { nodes, edges }
}

const { nodes, edges } = generateNetwork(100)
const nodeMap = new Map(nodes.map(n => [n.id, n]))
```

## 布局引擎

```ts
type LayoutType = 'hierarchical' | 'force'

function hierarchicalLayout(nodes: Node[]): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>()
  const layers = new Map<string, Node[]>()

  nodes.forEach(n => {
    if (!layers.has(n.layer)) layers.set(n.layer, [])
    layers.get(n.layer)!.push(n)
  })

  const layerY: Record<string, number> = { core: 10, distribution: 5, access: 0 }
  const layerSpacing = 5

  layers.forEach((layerNodes, layer) => {
    const cols = Math.ceil(Math.sqrt(layerNodes.length))
    layerNodes.forEach((node, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      positions.set(node.id, new THREE.Vector3(
        (col - cols / 2) * 2,
        layerY[layer] * layerSpacing / 3,
        (row - Math.floor(layerNodes.length / cols) / 2) * 2
      ))
    })
  })

  return positions
}

function forceLayout(nodes: Node[], edges: Edge[], iterations: number = 100): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>()
  const velocities = new Map<string, THREE.Vector3>()

  nodes.forEach(n => {
    positions.set(n.id, new THREE.Vector3(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20
    ))
    velocities.set(n.id, new THREE.Vector3())
  })

  const k = 4

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 10 * (1 - iter / iterations)

    nodes.forEach(ni => {
      const pi = positions.get(ni.id)!
      const vi = velocities.get(ni.id)!
      vi.set(0, 0, 0)

      nodes.forEach(nj => {
        if (ni.id === nj.id) return
        const pj = positions.get(nj.id)!
        const d = pi.distanceTo(pj) + 0.01
        const force = (k * k) / d
        vi.addScaledVector(pi.clone().sub(pj).normalize(), force)
      })
    })

    edges.forEach(e => {
      const pa = positions.get(e.source)!
      const pb = positions.get(e.target)!
      const va = velocities.get(e.source)!
      const vb = velocities.get(e.target)!
      const d = pa.distanceTo(pb) + 0.01
      const force = (d * d) / k
      const dir = pb.clone().sub(pa).normalize()
      va.addScaledVector(dir, force)
      vb.addScaledVector(dir, -force)
    })

    nodes.forEach(n => {
      const p = positions.get(n.id)!
      const v = velocities.get(n.id)!
      const len = v.length() + 0.01
      v.multiplyScalar(Math.min(len, temp) / len)
      p.add(v)
      p.clamp(new THREE.Vector3(-15, -15, -15), new THREE.Vector3(15, 15, 15))
    })
  }

  return positions
}
```

## 场景设置

```ts
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0a1a)

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200)
camera.position.set(0, 10, 25)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(innerWidth, innerHeight)
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.top = '0'
labelRenderer.domElement.style.pointerEvents = 'none'
document.body.appendChild(labelRenderer.domElement)

scene.add(new THREE.AmbientLight(0xffffff, 0.5))
const dirLight = new THREE.DirectionalLight(0xffffff, 0.7)
dirLight.position.set(5, 10, 5)
scene.add(dirLight)
```

## 渲染

```ts
const typeColors: Record<string, number> = {
  router: 0xff4444,
  switch: 0xffaa00,
  server: 0x44aaff,
  database: 0x44ff88,
  client: 0xaa88ff,
}

const statusColors: Record<string, number> = {
  normal: 0x334466,
  warning: 0xffaa00,
  error: 0xff4444,
}

let nodeMeshes = new Map<string, THREE.Mesh>()
let edgeLines: THREE.Line[] = []
let labels: CSS2DObject[] = []

function clearScene() {
  nodeMeshes.forEach(m => scene.remove(m))
  edgeLines.forEach(l => scene.remove(l))
  labels.forEach(l => scene.remove(l))
  nodeMeshes.clear()
  edgeLines = []
  labels = []
}

function renderGraph(positions: Map<string, THREE.Vector3>) {
  clearScene()

  nodes.forEach(node => {
    const pos = positions.get(node.id)!
    const geo = new THREE.SphereGeometry(0.25, 12, 12)
    const color = node.status === 'error' ? 0xff4444 : typeColors[node.type] || 0xaaaaaa
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.3,
      transparent: true,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos)
    mesh.userData = node
    scene.add(mesh)
    nodeMeshes.set(node.id, mesh)

    const div = document.createElement('div')
    div.textContent = node.label
    div.style.cssText = 'color: #aaa; font-size: 10px; padding: 1px 3px; background: rgba(0,0,0,0.4); border-radius: 2px;'
    const label = new CSS2DObject(div)
    label.position.set(pos.x, pos.y - 0.5, pos.z)
    scene.add(label)
    labels.push(label)
  })

  edges.forEach(edge => {
    const a = positions.get(edge.source)!
    const b = positions.get(edge.target)!
    const geo = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()])
    const mat = new THREE.LineBasicMaterial({
      color: statusColors[edge.status],
      transparent: true,
      opacity: edge.status === 'normal' ? 0.25 : 0.7,
    })
    const line = new THREE.Line(geo, mat)
    line.userData = edge
    scene.add(line)
    edgeLines.push(line)
  })
}

let currentLayout = hierarchicalLayout(nodes)
renderGraph(currentLayout)
```

## 布局切换

```ts
let currentLayoutType: LayoutType = 'hierarchical'

function switchLayout(type: LayoutType) {
  currentLayoutType = type
  if (type === 'hierarchical') {
    currentLayout = hierarchicalLayout(nodes)
  } else {
    currentLayout = forceLayout(nodes, edges, 150)
  }
  renderGraph(currentLayout)
}

// 工具栏按钮
const toolbar = document.createElement('div')
toolbar.style.cssText = 'position: fixed; top: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 10;'

const hierBtn = document.createElement('button')
hierBtn.textContent = '层次布局'
hierBtn.style.cssText = 'padding: 6px 16px; cursor: pointer; background: #333; color: #ccc; border: none; border-radius: 4px;'
hierBtn.addEventListener('click', () => switchLayout('hierarchical'))

const forceBtn = document.createElement('button')
forceBtn.textContent = '力导向布局'
forceBtn.style.cssText = 'padding: 6px 16px; cursor: pointer; background: #333; color: #ccc; border: none; border-radius: 4px;'
forceBtn.addEventListener('click', () => switchLayout('force'))

toolbar.append(hierBtn, forceBtn)
document.body.appendChild(toolbar)
```

## 搜索与高亮

```ts
const searchBox = document.createElement('input')
searchBox.placeholder = '搜索节点...'
searchBox.style.cssText = 'position: fixed; top: 10px; right: 10px; padding: 6px 12px; z-index: 10; width: 150px;'
document.body.appendChild(searchBox)

searchBox.addEventListener('input', () => {
  const query = searchBox.value.toLowerCase()
  nodeMeshes.forEach((mesh, id) => {
    const node = mesh.userData as Node
    const match = !query || node.label.toLowerCase().includes(query)
    const mat = mesh.material as THREE.MeshStandardMaterial
    mat.opacity = match ? 1 : 0.15
  })
})
```

## 详情面板

```ts
const detailPanel = document.createElement('div')
detailPanel.style.cssText = `
  position: fixed; left: 10px; top: 60px; width: 200px; background: rgba(13,17,23,0.9);
  padding: 12px; border-radius: 6px; color: #ccc; font-size: 12px; display: none;
`
document.body.appendChild(detailPanel)

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

renderer.domElement.addEventListener('click', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1
  mouse.y = -(e.clientY / innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects([...nodeMeshes.values()])

  if (hits.length > 0) {
    const node = hits[0].object.userData as Node
    const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id)
    detailPanel.style.display = 'block'
    detailPanel.innerHTML = `
      <div style="font-weight: bold; color: #${(typeColors[node.type] || 0xaaaaaa).toString(16)};">${node.label}</div>
      <div>类型: ${node.type}</div>
      <div>层级: ${node.layer}</div>
      <div>CPU: ${node.cpu?.toFixed(1)}%</div>
      <div>状态: <span style="color: ${node.status === 'error' ? '#ff4444' : node.status === 'warning' ? '#ffaa00' : '#66bb6a'}">${node.status}</span></div>
      <div>连接数: ${connectedEdges.length}</div>
    `
  } else {
    detailPanel.style.display = 'none'
  }
})
```

## 动画循环

```ts
function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  labelRenderer.setSize(innerWidth, innerHeight)
})

animate()
```

## 练习

### 练习一：告警闪烁

状态为 error 的节点做脉冲动画——周期性地放大和高亮。

### 练习二：边流量动画

在边上添加流动粒子，粒子速度和密度映射 bandwidth。

---

## 参考答案

### 练习一

```ts
let pulseTime = 0
function animate() {
  requestAnimationFrame(animate)
  pulseTime += 0.05

  nodeMeshes.forEach(mesh => {
    const node = mesh.userData as Node
    if (node.status === 'error') {
      const scale = 1 + Math.sin(pulseTime * 4) * 0.3
      mesh.scale.setScalar(scale)
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.emissive.setHex(Math.sin(pulseTime * 4) > 0 ? 0x440000 : 0x000000)
    }
  })

  controls.update()
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}
```

### 练习二

```ts
const particleCount = 200
const particleGeo = new THREE.BufferGeometry()
const particlePositions = new Float32Array(particleCount * 3)
const particleSpeeds = new Float32Array(particleCount)
const particleEdges = new Array<Edge>(particleCount)

for (let i = 0; i < particleCount; i++) {
  const edge = edges[Math.floor(Math.random() * edges.length)]
  particleEdges[i] = edge
  particleSpeeds[i] = 0.005 + (edge.bandwidth / 10000) * 0.02
}

particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
const particleMat = new THREE.PointsMaterial({ color: 0x44aaff, size: 0.15, transparent: true, opacity: 0.8 })
const particles = new THREE.Points(particleGeo, particleMat)
scene.add(particles)

const particleProgress = new Float32Array(particleCount).fill(0)

function updateParticles() {
  const pos = particleGeo.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < particleCount; i++) {
    const edge = particleEdges[i]
    const a = currentLayout.get(edge.source)!
    const b = currentLayout.get(edge.target)!
    particleProgress[i] = (particleProgress[i] + particleSpeeds[i]) % 1
    const t = particleProgress[i]
    pos.setXYZ(i,
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
      a.z + (b.z - a.z) * t
    )
  }
  pos.needsUpdate = true
}
```
