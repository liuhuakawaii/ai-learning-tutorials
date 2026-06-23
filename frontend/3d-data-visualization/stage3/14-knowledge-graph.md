# 知识图谱——实体关系、语义网络、SPARQL 可视化

## 知识图谱和普通图的区别

普通图的节点是同类实体（都是服务器、都是人），边是同类关系（都是连接、都是认识）。知识图谱的节点是异构实体（人物、地点、事件、概念），边是语义关系（出生于、参与了、属于）。可视化时需要区分不同类型的节点和边。

## 数据格式

知识图谱常用三元组（Subject - Predicate - Object）表示：

```ts
interface Triple {
  subject: { id: string; name: string; type: string }
  predicate: string
  object: { id: string; name: string; type: string }
}

const knowledgeTriples: Triple[] = [
  {
    subject: { id: 'einstein', name: '爱因斯坦', type: 'Person' },
    predicate: '出生于',
    object: { id: 'ulm', name: '乌尔姆', type: 'City' },
  },
  {
    subject: { id: 'einstein', name: '爱因斯坦', type: 'Person' },
    predicate: '提出',
    object: { id: 'relativity', name: '相对论', type: 'Theory' },
  },
  {
    subject: { id: 'einstein', name: '爱因斯坦', type: 'Person' },
    predicate: '获得',
    object: { id: 'nobel1921', name: '1921年诺贝尔物理学奖', type: 'Award' },
  },
  {
    subject: { id: 'einstein', name: '爱因斯坦', type: 'Person' },
    predicate: '工作于',
    object: { id: 'ias', name: '普林斯顿高等研究院', type: 'Institution' },
  },
  {
    subject: { id: 'relativity', name: '相对论', type: 'Theory' },
    predicate: '影响',
    object: { id: 'quantum', name: '量子力学', type: 'Theory' },
  },
  {
    subject: { id: 'bohr', name: '玻尔', type: 'Person' },
    predicate: '提出',
    object: { id: 'bohr_model', name: '原子模型', type: 'Theory' },
  },
  {
    subject: { id: 'bohr', name: '玻尔', type: 'Person' },
    predicate: '获得',
    object: { id: 'nobel1922', name: '1922年诺贝尔物理学奖', type: 'Award' },
  },
  {
    subject: { id: 'einstein', name: '爱因斯坦', type: 'Person' },
    predicate: '影响',
    object: { id: 'bohr', name: '玻尔', type: 'Person' },
  },
]
```

## 构建图结构

从三元组提取节点和边：

```ts
interface KGNode {
  id: string
  name: string
  type: string
  degree: number
}

interface KGEdge {
  source: string
  target: string
  predicate: string
}

function buildGraph(triples: Triple[]): { nodes: Map<string, KGNode>; edges: KGEdge[] } {
  const nodes = new Map<string, KGNode>()
  const edges: KGEdge[] = []

  triples.forEach(t => {
    if (!nodes.has(t.subject.id)) {
      nodes.set(t.subject.id, { ...t.subject, degree: 0 })
    }
    if (!nodes.has(t.object.id)) {
      nodes.set(t.object.id, { ...t.object, degree: 0 })
    }

    nodes.get(t.subject.id)!.degree++
    nodes.get(t.object.id)!.degree++

    edges.push({
      source: t.subject.id,
      target: t.object.id,
      predicate: t.predicate,
    })
  })

  return { nodes, edges }
}

const { nodes, edges } = buildGraph(knowledgeTriples)
```

## Three.js 力导向布局 + 类型区分

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0d1117)

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200)
camera.position.set(0, 5, 20)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const typeColors: Record<string, number> = {
  Person: 0x4fc3f7,
  City: 0x66bb6a,
  Theory: 0xff7043,
  Award: 0xffd54f,
  Institution: 0xab47bc,
}

const typeShapes: Record<string, THREE.BufferGeometry> = {
  Person: new THREE.SphereGeometry(0.35, 16, 16),
  City: new THREE.BoxGeometry(0.5, 0.5, 0.5),
  Theory: new THREE.OctahedronGeometry(0.35),
  Award: new THREE.TorusGeometry(0.3, 0.1, 8, 16),
  Institution: new THREE.CylinderGeometry(0.25, 0.35, 0.5, 6),
}

interface LayoutPos { x: number; y: number; z: number; vx: number; vy: number; vz: number }
const nodePositions = new Map<string, LayoutPos>()

nodes.forEach(node => {
  nodePositions.set(node.id, {
    x: (Math.random() - 0.5) * 15,
    y: (Math.random() - 0.5) * 15,
    z: (Math.random() - 0.5) * 15,
    vx: 0, vy: 0, vz: 0,
  })
})

function simulateStep() {
  const nodeArr = [...nodePositions.values()]
  const k = 4

  for (let i = 0; i < nodeArr.length; i++) {
    nodeArr[i].vx = 0; nodeArr[i].vy = 0; nodeArr[i].vz = 0
    for (let j = i + 1; j < nodeArr.length; j++) {
      const dx = nodeArr[i].x - nodeArr[j].x
      const dy = nodeArr[i].y - nodeArr[j].y
      const dz = nodeArr[i].z - nodeArr[j].z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01
      const force = (k * k) / dist
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      const fz = (dz / dist) * force
      nodeArr[i].vx += fx; nodeArr[i].vy += fy; nodeArr[i].vz += fz
      nodeArr[j].vx -= fx; nodeArr[j].vy -= fy; nodeArr[j].vz -= fz
    }
  }

  edges.forEach(edge => {
    const a = nodePositions.get(edge.source)!
    const b = nodePositions.get(edge.target)!
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01
    const force = (dist * dist) / k
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    const fz = (dz / dist) * force
    a.vx += fx; a.vy += fy; a.vz += fz
    b.vx -= fx; b.vy -= fy; b.vz -= fz
  })

  nodeArr.forEach(pos => {
    pos.vx *= 0.9; pos.vy *= 0.9; pos.vz *= 0.9
    pos.x += pos.vx; pos.y += pos.vy; pos.z += pos.vz
  })
}
```

## 渲染节点和边

```ts
const nodeMeshes = new Map<string, THREE.Mesh>()

nodes.forEach(node => {
  const geo = typeShapes[node.type] || new THREE.SphereGeometry(0.3, 12, 12)
  const mat = new THREE.MeshStandardMaterial({
    color: typeColors[node.type] || 0xaaaaaa,
    roughness: 0.4,
    metalness: 0.3,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.userData = node
  scene.add(mesh)
  nodeMeshes.set(node.id, mesh)
})

const lineGroup = new THREE.Group()
scene.add(lineGroup)

function updatePositions() {
  nodes.forEach(node => {
    const pos = nodePositions.get(node.id)!
    const mesh = nodeMeshes.get(node.id)!
    mesh.position.set(pos.x, pos.y, pos.z)
  })

  lineGroup.clear()
  edges.forEach(edge => {
    const a = nodePositions.get(edge.source)!
    const b = nodePositions.get(edge.target)!
    const points = [
      new THREE.Vector3(a.x, a.y, a.z),
      new THREE.Vector3(b.x, b.y, b.z),
    ]
    const geo = new THREE.BufferGeometry().setFromPoints(points)
    const mat = new THREE.LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.5 })
    lineGroup.add(new THREE.Line(geo, mat))
  })
}

scene.add(new THREE.AmbientLight(0xffffff, 0.5))
const dl = new THREE.DirectionalLight(0xffffff, 0.7)
dl.position.set(5, 10, 5)
scene.add(dl)

// 标签
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(innerWidth, innerHeight)
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.top = '0'
labelRenderer.domElement.style.pointerEvents = 'none'
document.body.appendChild(labelRenderer.domElement)

nodes.forEach(node => {
  const div = document.createElement('div')
  div.textContent = node.name
  div.style.cssText = 'color: #ccc; font-size: 11px; padding: 1px 4px; background: rgba(0,0,0,0.5); border-radius: 2px;'
  const label = new CSS2DObject(div)
  const pos = nodePositions.get(node.id)!
  label.position.set(pos.x, pos.y - 0.6, pos.z)
  scene.add(label)
})

let iteration = 0
function animate() {
  requestAnimationFrame(animate)
  if (iteration < 200) {
    simulateStep()
    updatePositions()
    iteration++
  }
  controls.update()
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}
animate()
```

## 关系标签

在边的中点显示谓词：

```ts
edges.forEach(edge => {
  const a = nodePositions.get(edge.source)!
  const b = nodePositions.get(edge.target)!
  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2
  const midZ = (a.z + b.z) / 2

  const div = document.createElement('div')
  div.textContent = edge.predicate
  div.style.cssText = 'color: #ffaa00; font-size: 10px; padding: 1px 3px;'
  const label = new CSS2DObject(div)
  label.position.set(midX, midY, midZ)
  scene.add(label)
})
```

## 图谱查询可视化

用户输入一个实体名称，高亮该实体及其一跳邻居：

```ts
function queryEntity(entityName: string) {
  const targetNode = [...nodes.values()].find(n => n.name === entityName)
  if (!targetNode) return

  const neighbors = new Set<string>([targetNode.id])
  edges.forEach(edge => {
    if (edge.source === targetNode.id) neighbors.add(edge.target)
    if (edge.target === targetNode.id) neighbors.add(edge.source)
  })

  nodeMeshes.forEach((mesh, id) => {
    const mat = mesh.material as THREE.MeshStandardMaterial
    if (neighbors.has(id)) {
      mat.opacity = 1
      mat.emissive.setHex(0x222222)
    } else {
      mat.opacity = 0.15
      mat.emissive.setHex(0x000000)
    }
  })
}
```

## 练习

### 练习一：SPARQL 查询面板

加一个输入框，用户输入简单的 SPARQL-like 查询（如 `?x 出生于 ?y`），解析后高亮匹配的边。

### 练习二：图谱统计

显示节点类型分布（饼图或条形图）、关系类型分布、平均度数。

---

## 参考答案

### 练习一

```ts
const queryInput = document.createElement('input')
queryInput.placeholder = '如: ?x 出生于 ?y'
queryInput.style.cssText = 'position: fixed; top: 10px; left: 10px; padding: 6px 12px; width: 200px; z-index: 10;'
document.body.appendChild(queryInput)

queryInput.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return
  const query = queryInput.value.trim()

  const match = query.match(/^(\S+)\s+(\S+)\s+(\S+)$/)
  if (!match) return

  const [, s, predicate, o] = match
  const isVariableS = s.startsWith('?')
  const isVariableO = o.startsWith('?')

  const matchingTriples = knowledgeTriples.filter(t => {
    const predMatch = t.predicate === predicate
    const sMatch = isVariableS || t.subject.name === s
    const oMatch = isVariableO || t.object.name === o
    return predMatch && sMatch && oMatch
  })

  const highlightNodes = new Set<string>()
  const highlightEdges = new Set<string>()

  matchingTriples.forEach(t => {
    highlightNodes.add(t.subject.id)
    highlightNodes.add(t.object.id)
  })

  edges.forEach((edge, i) => {
    const triple = knowledgeTriples.find(t =>
      t.subject.id === edge.source && t.object.id === edge.target && t.predicate === edge.predicate
    )
    if (triple && triple.predicate === predicate) {
      highlightEdges.add(`${edge.source}-${edge.target}`)
    }
  })

  nodeMeshes.forEach((mesh, id) => {
    const mat = mesh.material as THREE.MeshStandardMaterial
    mat.opacity = highlightNodes.has(id) ? 1 : 0.15
  })
})
```

### 练习二

```ts
function renderStats() {
  const typeCounts = new Map<string, number>()
  nodes.forEach(n => {
    typeCounts.set(n.type, (typeCounts.get(n.type) || 0) + 1)
  })

  const predCounts = new Map<string, number>()
  edges.forEach(e => {
    predCounts.set(e.predicate, (predCounts.get(e.predicate) || 0) + 1)
  })

  const panel = document.createElement('div')
  panel.style.cssText = 'position: fixed; right: 10px; top: 10px; background: rgba(0,0,0,0.8); padding: 12px; border-radius: 6px; color: #ccc; font-size: 12px; max-width: 200px;'

  let html = '<div style="font-weight: bold; margin-bottom: 8px;">实体类型</div>'
  typeCounts.forEach((count, type) => {
    html += `<div style="color: #${(typeColors[type] || 0xaaaaaa).toString(16)};">${type}: ${count}</div>`
  })
  html += '<div style="font-weight: bold; margin: 8px 0;">关系类型</div>'
  predCounts.forEach((count, pred) => {
    html += `<div>${pred}: ${count}</div>`
  })
  html += `<div style="margin-top: 8px;">平均度数: ${(edges.length * 2 / nodes.size).toFixed(1)}</div>`

  panel.innerHTML = html
  document.body.appendChild(panel)
}
```
