# 网络拓扑图——节点-边布局、自动布局算法

## 场景

网络拓扑图在运维、安全、社交分析中很常见：服务器之间的连接、微服务调用链、社交关系。它和力导向图的区别是：拓扑图通常有明确的层次结构（核心层、汇聚层、接入层），不能纯用力学模拟。

## 数据结构

```ts
interface TopologyNode {
  id: string
  label: string
  type: 'core' | 'aggregation' | 'access' | 'server' | 'database'
  group: string
  metrics?: {
    cpu: number
    memory: number
    connections: number
  }
}

interface TopologyEdge {
  source: string
  target: string
  bandwidth: number
  latency: number
  status: 'normal' | 'warning' | 'error'
}

const topology = generateTopology()

function generateTopology() {
  const nodes: TopologyNode[] = [
    { id: 'core-1', label: '核心交换机', type: 'core', group: 'network' },
    { id: 'core-2', label: '核心交换机B', type: 'core', group: 'network' },
    { id: 'agg-1', label: '汇聚-北京', type: 'aggregation', group: 'network' },
    { id: 'agg-2', label: '汇聚-上海', type: 'aggregation', group: 'network' },
    { id: 'agg-3', label: '汇聚-深圳', type: 'aggregation', group: 'network' },
    ...Array.from({ length: 9 }, (_, i) => ({
      id: `srv-${i}`, label: `服务器-${i}`, type: 'server' as const,
      group: 'compute', metrics: { cpu: Math.random() * 100, memory: Math.random() * 100, connections: Math.floor(Math.random() * 500) },
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      id: `db-${i}`, label: `数据库-${i}`, type: 'database' as const,
      group: 'storage', metrics: { cpu: Math.random() * 80, memory: Math.random() * 90, connections: Math.floor(Math.random() * 200) },
    })),
  ]

  const edges: TopologyEdge[] = [
    { source: 'core-1', target: 'core-2', bandwidth: 10000, latency: 0.1, status: 'normal' },
    { source: 'core-1', target: 'agg-1', bandwidth: 10000, latency: 0.5, status: 'normal' },
    { source: 'core-1', target: 'agg-2', bandwidth: 10000, latency: 1.2, status: 'normal' },
    { source: 'core-2', target: 'agg-3', bandwidth: 10000, latency: 1.5, status: 'warning' },
    ...Array.from({ length: 9 }, (_, i) => ({
      source: `agg-${(i % 3) + 1}`, target: `srv-${i}`, bandwidth: 1000, latency: 0.3 + Math.random(), status: 'normal' as const,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      source: `srv-${i}`, target: `db-${i % 3}`, bandwidth: 500, latency: 0.2 + Math.random(), status: Math.random() > 0.8 ? 'error' as const : 'normal' as const,
    })),
  ]

  return { nodes, edges }
}
```

## 层次布局算法

拓扑图的布局目标：同一层的节点水平排列，不同层垂直分布。

```ts
import * as THREE from 'three'

const typeToLayer: Record<string, number> = {
  core: 3,
  aggregation: 2,
  access: 1,
  server: 1,
  database: 0,
}

function hierarchicalLayout(nodes: TopologyNode[]): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>()
  const layers = new Map<number, TopologyNode[]>()

  nodes.forEach(node => {
    const layer = typeToLayer[node.type] ?? 1
    if (!layers.has(layer)) layers.set(layer, [])
    layers.get(layer)!.push(node)
  })

  const layerSpacing = 5
  const nodeSpacing = 3

  layers.forEach((layerNodes, layer) => {
    const totalWidth = (layerNodes.length - 1) * nodeSpacing
    layerNodes.forEach((node, i) => {
      positions.set(node.id, new THREE.Vector3(
        -totalWidth / 2 + i * nodeSpacing,
        layer * layerSpacing,
        0
      ))
    })
  })

  return positions
}
```

## Three.js 渲染

```ts
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0a1a)

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200)
camera.position.set(0, 10, 25)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

const controls = new (await import('three/examples/jsm/controls/OrbitControls.js')).OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const positions = hierarchicalLayout(topology.nodes)

const typeColors: Record<string, number> = {
  core: 0xff4444,
  aggregation: 0xffaa00,
  server: 0x44aaff,
  database: 0x44ff88,
}

const typeSizes: Record<string, number> = {
  core: 0.8,
  aggregation: 0.6,
  server: 0.4,
  database: 0.5,
}

const nodeMeshes = new Map<string, THREE.Mesh>()

topology.nodes.forEach(node => {
  const geo = new THREE.SphereGeometry(typeSizes[node.type] || 0.4, 20, 20)
  const mat = new THREE.MeshStandardMaterial({
    color: typeColors[node.type] || 0xaaaaaa,
    roughness: 0.4,
    metalness: 0.3,
  })
  const mesh = new THREE.Mesh(geo, mat)
  const pos = positions.get(node.id)!
  mesh.position.copy(pos)
  mesh.userData = node
  scene.add(mesh)
  nodeMeshes.set(node.id, mesh)
})

const edgeStatusColors: Record<string, number> = {
  normal: 0x334466,
  warning: 0xffaa00,
  error: 0xff4444,
}

const edgeLines: THREE.Line[] = []

topology.edges.forEach(edge => {
  const from = positions.get(edge.source)
  const to = positions.get(edge.target)
  if (!from || !to) return

  const points = [from.clone(), to.clone()]
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineBasicMaterial({
    color: edgeStatusColors[edge.status],
    transparent: true,
    opacity: edge.status === 'normal' ? 0.4 : 0.8,
  })
  const line = new THREE.Line(geo, mat)
  line.userData = edge
  scene.add(line)
  edgeLines.push(line)
})

const ambient = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambient)
const dir = new THREE.DirectionalLight(0xffffff, 0.7)
dir.position.set(5, 10, 5)
scene.add(dir)

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}
animate()
```

## 边的曲线化

当两个节点之间有多条边，或者边太密集时，用直线会重叠。曲线化能让结构更清晰：

```ts
function createCurvedEdge(
  from: THREE.Vector3,
  to: THREE.Vector3,
  curveAmount: number = 0.3
): THREE.CurvePath<THREE.Vector3> {
  const mid = new THREE.Vector3().lerpVectors(from, to, 0.5)
  const dir = new THREE.Vector3().subVectors(to, from).normalize()
  const up = new THREE.Vector3(0, 0, 1)
  const offset = new THREE.Vector3().crossVectors(dir, up).multiplyScalar(curveAmount * from.distanceTo(to))
  mid.add(offset)

  const curve = new THREE.QuadraticBezierCurve3(from, mid, to)
  return curve
}

topology.edges.forEach(edge => {
  const from = positions.get(edge.source)!
  const to = positions.get(edge.target)!
  const curve = createCurvedEdge(from, to)
  const points = curve.getPoints(30)
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineBasicMaterial({
    color: edgeStatusColors[edge.status],
    transparent: true,
    opacity: edge.status === 'normal' ? 0.35 : 0.8,
  })
  const line = new THREE.Line(geo, mat)
  scene.add(line)
})
```

## 节点指标可视化

节点颜色或大小动态变化，反映实时指标：

```ts
function updateNodeMetrics(mesh: THREE.Mesh, metrics: { cpu: number; memory: number }) {
  const mat = mesh.material as THREE.MeshStandardMaterial
  const cpuT = metrics.cpu / 100
  const color = new THREE.Color().lerpColors(
    new THREE.Color(0x44aaff),
    new THREE.Color(0xff4444),
    cpuT
  )
  mat.color.copy(color)
  mat.emissive.copy(color).multiplyScalar(cpuT * 0.3)
}

// 模拟实时更新
setInterval(() => {
  topology.nodes.forEach(node => {
    if (node.metrics) {
      node.metrics.cpu = Math.max(0, Math.min(100, node.metrics.cpu + (Math.random() - 0.5) * 10))
      const mesh = nodeMeshes.get(node.id)
      if (mesh) updateNodeMetrics(mesh, node.metrics)
    }
  })
}, 2000)
```

## 常见问题

**节点太多时布局算法变慢**：层次布局是 O(n)，比力导向的 O(n²) 快得多。但节点太多时同一层放不下，需要分组或分页。

**边太多遮挡节点**：加透明度、只显示选中节点的边、或按 status 过滤。

## 练习

### 练习一：告警动画

状态为 error 的边做闪烁动画——线的颜色在红色和暗色之间切换。

### 练习二：节点展开/折叠

双击一个汇聚节点，隐藏其下属的服务器和数据库节点，再次双击展开。

---

## 参考答案

### 练习一

```ts
let time = 0
function animate() {
  requestAnimationFrame(animate)
  time += 0.05

  edgeLines.forEach(line => {
    const edge = line.userData as TopologyEdge
    if (edge.status === 'error') {
      const mat = line.material as THREE.LineBasicMaterial
      const pulse = (Math.sin(time * 5) + 1) / 2
      mat.color.lerpColors(
        new THREE.Color(0xff4444),
        new THREE.Color(0x330000),
        1 - pulse
      )
      mat.opacity = 0.3 + pulse * 0.7
    }
  })

  controls.update()
  renderer.render(scene, camera)
}
```

### 练习二

```ts
const collapsed = new Set<string>()

function getDescendants(nodeId: string): string[] {
  const children = topology.edges
    .filter(e => e.source === nodeId)
    .map(e => e.target)
  const result = [...children]
  children.forEach(c => result.push(...getDescendants(c)))
  return result
}

function toggleCollapse(nodeId: string) {
  if (collapsed.has(nodeId)) {
    collapsed.delete(nodeId)
  } else {
    collapsed.add(nodeId)
  }

  const descendants = getDescendants(nodeId)
  descendants.forEach(id => {
    const mesh = nodeMeshes.get(id)
    if (mesh) mesh.visible = !collapsed.has(nodeId)
  })

  edgeLines.forEach(line => {
    const edge = line.userData as TopologyEdge
    if (descendants.includes(edge.source) || descendants.includes(edge.target)) {
      line.visible = !collapsed.has(nodeId)
    }
  })
}

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

renderer.domElement.addEventListener('dblclick', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1
  mouse.y = -(e.clientY / innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects([...nodeMeshes.values()])
  if (hits.length > 0) {
    const node = hits[0].object.userData as TopologyNode
    if (node.type === 'aggregation') toggleCollapse(node.id)
  }
})
```
