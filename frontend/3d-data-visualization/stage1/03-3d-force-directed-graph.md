# 3D 力导向图——网络拓扑的力布局算法

## 什么时候用力导向图

当你有节点和连接关系——社交网络、服务调用链、依赖关系——需要可视化时，力导向图是最直觉的选择。它模拟物理世界：节点之间互相排斥（库仑力），连边像弹簧一样拉近相连节点（胡克力），最终达到力学平衡。

3D 比 2D 的优势是：复杂网络在 2D 里边交叉严重，3D 给了更多空间让结构展开。

## 力导向算法核心

每轮迭代做两件事：

1. **排斥力**：所有节点对之间施加排斥力，防止重叠
2. **吸引力**：有边相连的节点之间施加吸引力，拉近距离

```ts
interface Node {
  id: string
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  group: string
  size: number
}

interface Edge {
  source: string
  target: string
  weight: number
}

const graph = generateSampleGraph()

function generateSampleGraph(): { nodes: Node[]; edges: Edge[] } {
  const groups = ['frontend', 'backend', 'database', 'infra']
  const nodes: Node[] = Array.from({ length: 60 }, (_, i) => ({
    id: `node-${i}`,
    x: (Math.random() - 0.5) * 30,
    y: (Math.random() - 0.5) * 30,
    z: (Math.random() - 0.5) * 30,
    vx: 0, vy: 0, vz: 0,
    group: groups[Math.floor(Math.random() * groups.length)],
    size: 0.3 + Math.random() * 0.7,
  }))

  const edges: Edge[] = []
  for (let i = 0; i < 90; i++) {
    const s = Math.floor(Math.random() * nodes.length)
    let t = Math.floor(Math.random() * nodes.length)
    if (s !== t) {
      edges.push({
        source: nodes[s].id,
        target: nodes[t].id,
        weight: 0.5 + Math.random() * 0.5,
      })
    }
  }
  return { nodes, edges }
}

const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))

function simulateStep(kRepulse = 50, kAttract = 0.01, damping = 0.9) {
  const nodes = graph.nodes

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z
      const distSq = dx * dx + dy * dy + dz * dz + 0.01
      const dist = Math.sqrt(distSq)
      const force = kRepulse / distSq
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      const fz = (dz / dist) * force
      a.vx += fx; a.vy += fy; a.vz += fz
      b.vx -= fx; b.vy -= fy; b.vz -= fz
    }
  }

  for (const edge of graph.edges) {
    const a = nodeMap.get(edge.source)!
    const b = nodeMap.get(edge.target)!
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01
    const force = kAttract * dist * edge.weight
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    const fz = (dz / dist) * force
    a.vx += fx; a.vy += fy; a.vz += fz
    b.vx -= fx; b.vy -= fy; b.vz -= fz
  }

  for (const node of nodes) {
    node.vx *= damping
    node.vy *= damping
    node.vz *= damping
    node.x += node.vx
    node.y += node.vy
    node.z += node.vz
  }
}
```

## 用 Three.js 渲染

节点用 `InstancedMesh` 渲染（比单独创建 Mesh 快），边用 `LineSegments`：

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const groupColors: Record<string, number> = {
  frontend: 0x4fc3f7,
  backend: 0xff7043,
  database: 0x66bb6a,
  infra: 0xab47bc,
}

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0a1a)

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200)
camera.position.set(20, 15, 20)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const nodeGeo = new THREE.SphereGeometry(1, 16, 16)
const nodeMat = new THREE.MeshStandardMaterial({ roughness: 0.5 })
const instancedMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, graph.nodes.length)
instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
scene.add(instancedMesh)

const dummy = new THREE.Object3D()
const tempColor = new THREE.Color()

function updateNodeInstances() {
  graph.nodes.forEach((node, i) => {
    dummy.position.set(node.x, node.y, node.z)
    const s = node.size * 0.4
    dummy.scale.set(s, s, s)
    dummy.updateMatrix()
    instancedMesh.setMatrixAt(i, dummy.matrix)
    tempColor.set(groupColors[node.group] || 0xffffff)
    instancedMesh.setColorAt(i, tempColor)
  })
  instancedMesh.instanceMatrix.needsUpdate = true
  if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true
}

const linePositions = new Float32Array(graph.edges.length * 6)
const lineColors = new Float32Array(graph.edges.length * 6)
const lineGeo = new THREE.BufferGeometry()
lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3))
const lineMat = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.4,
})
const lineSegments = new THREE.LineSegments(lineGeo, lineMat)
scene.add(lineSegments)

function updateEdges() {
  graph.edges.forEach((edge, i) => {
    const a = nodeMap.get(edge.source)!
    const b = nodeMap.get(edge.target)!
    linePositions[i * 6] = a.x
    linePositions[i * 6 + 1] = a.y
    linePositions[i * 6 + 2] = a.z
    linePositions[i * 6 + 3] = b.x
    linePositions[i * 6 + 4] = b.y
    linePositions[i * 6 + 5] = b.z

    const ca = new THREE.Color(groupColors[a.group] || 0xffffff)
    const cb = new THREE.Color(groupColors[b.group] || 0xffffff)
    lineColors[i * 6] = ca.r; lineColors[i * 6 + 1] = ca.g; lineColors[i * 6 + 2] = ca.b
    lineColors[i * 6 + 3] = cb.r; lineColors[i * 6 + 4] = cb.g; lineColors[i * 6 + 5] = cb.b
  })
  lineGeo.attributes.position.needsUpdate = true
  lineGeo.attributes.color.needsUpdate = true
}

const ambient = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambient)
const dirLight = new THREE.DirectionalLight(0xffffff, 0.7)
dirLight.position.set(10, 15, 10)
scene.add(dirLight)

let iteration = 0
function animate() {
  requestAnimationFrame(animate)
  if (iteration < 300) {
    simulateStep()
    updateNodeInstances()
    updateEdges()
    iteration++
  }
  controls.update()
  renderer.render(scene, camera)
}
animate()
```

## 布局参数的影响

| 参数 | 作用 | 调大 | 调小 |
|------|------|------|------|
| kRepulse | 排斥力强度 | 节点更分散 | 节点更紧凑 |
| kAttract | 吸引力强度 | 连接节点更近 | 结构更松散 |
| damping | 阻尼系数 | 收敛更快但可能震荡 | 收敛更稳定但更慢 |

没有万能参数。节点多、边密的网络需要更强的排斥力。稀疏网络需要更强的吸引力。

## 力导向图的局限

力导向图不保证确定性——每次运行结果不同。它也不适合有明确层次结构的数据（那种用树布局更好）。节点超过 500 个时，O(n²) 的排斥力计算会让迭代变慢，需要 Barnes-Hut 近似或其他优化。

## 练习

### 练习一：拖拽节点

实现鼠标拖拽某个节点，放开后力导向继续迭代。提示：用 Raycaster 找到被拖拽的节点，在 simulateStep 里把它的位置固定为鼠标位置。

### 练习二：边粗细编码权重

把边的粗细映射到 weight 值。THREE.LineBasicMaterial 不支持 lineWidth（WebGL 限制），需要用 `THREE.Line2`（fat lines）或自定义 tube geometry。

---

## 参考答案

### 练习一

```ts
let draggedNode: Node | null = null
const dragPlane = new THREE.Plane()
const intersectPoint = new THREE.Vector3()

renderer.domElement.addEventListener('mousedown', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1
  mouse.y = -(e.clientY / innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObject(instancedMesh)
  if (hits.length > 0) {
    const idx = hits[0].instanceId!
    draggedNode = graph.nodes[idx]
    dragPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()),
      new THREE.Vector3(draggedNode.x, draggedNode.y, draggedNode.z)
    )
  }
})

renderer.domElement.addEventListener('mousemove', e => {
  if (!draggedNode) return
  mouse.x = (e.clientX / innerWidth) * 2 - 1
  mouse.y = -(e.clientY / innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  raycaster.ray.intersectPlane(dragPlane, intersectPoint)
  draggedNode.x = intersectPoint.x
  draggedNode.y = intersectPoint.y
  draggedNode.z = intersectPoint.z
  draggedNode.vx = 0
  draggedNode.vy = 0
  draggedNode.vz = 0
  iteration = Math.max(0, iteration - 10)
})

window.addEventListener('mouseup', () => { draggedNode = null })
```

### 练习二

使用 `three/examples/jsm/lines/Line2` 实现可变宽度的线：

```ts
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'

graph.edges.forEach(edge => {
  const a = nodeMap.get(edge.source)!
  const b = nodeMap.get(edge.target)!
  const geo = new LineGeometry()
  geo.setPositions([a.x, a.y, a.z, b.x, b.y, b.z])
  const mat = new LineMaterial({
    color: 0x6688aa,
    linewidth: edge.weight * 3,
    resolution: new THREE.Vector2(innerWidth, innerHeight),
  })
  const line = new Line2(geo, mat)
  scene.add(line)
})
```

**注意**：Line2 的 linewidth 单位是像素，不会随距离缩放。如果你需要 3D 空间里的粗细变化，得用 TubeGeometry。
