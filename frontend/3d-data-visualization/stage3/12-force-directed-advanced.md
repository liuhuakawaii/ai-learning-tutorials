# 力导向图进阶——Fruchterman-Reingold、社区检测可视化

## 上一课遗留的问题

基础力导向图有两个大问题：
1. 收敛慢——节点在最终位置附近震荡很久
2. 看不出社区结构——节点均匀分布，看不出哪些节点属于同一组

这节课用更好的布局算法和社区检测来解决。

## Fruchterman-Reingold 算法

FR 算法是对基础力导向的改进。核心改进：引入"理想弹簧长度" k，所有力的计算都基于 k：

```ts
interface Node {
  id: string
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  community: number
}

interface Edge {
  source: string
  target: string
}

function fruchtermanReingold(
  nodes: Node[],
  edges: Edge[],
  width: number,
  height: number,
  depth: number,
  iterations: number = 200
) {
  const area = width * height * depth
  const k = Math.cbrt(area / nodes.length) * 0.8

  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  for (let iter = 0; iter < iterations; iter++) {
    const temperature = width * (1 - iter / iterations)

    // 排斥力
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].vx = 0
      nodes[i].vy = 0
      nodes[i].vz = 0
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const dz = nodes[i].z - nodes[j].z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01
        const force = (k * k) / dist
        nodes[i].vx += (dx / dist) * force
        nodes[i].vy += (dy / dist) * force
        nodes[i].vz += (dz / dist) * force
      }
    }

    // 吸引力
    edges.forEach(edge => {
      const a = nodeMap.get(edge.source)!
      const b = nodeMap.get(edge.target)!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dz = b.z - a.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01
      const force = (dist * dist) / k
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      const fz = (dz / dist) * force
      a.vx += fx; a.vy += fy; a.vz += fz
      b.vx -= fx; b.vy -= fy; b.vz -= fz
    })

    // 限位 + 温度衰减
    nodes.forEach(node => {
      const disp = Math.sqrt(node.vx * node.vx + node.vy * node.vy + node.vz * node.vz) + 0.01
      const scale = Math.min(disp, temperature) / disp
      node.x += node.vx * scale
      node.y += node.vy * scale
      node.z += node.vz * scale
      // 边界约束
      node.x = Math.max(-width / 2, Math.min(width / 2, node.x))
      node.y = Math.max(-height / 2, Math.min(height / 2, node.y))
      node.z = Math.max(-depth / 2, Math.min(depth / 2, node.z))
    })
  }
}
```

温度参数是 FR 的关键——前期允许大步移动，后期只做微调，避免震荡。

## 社区检测：Louvain 算法

Louvain 算法通过优化模块度（modularity）把图分成社区。实现较复杂，这里用一个简化版本：

```ts
function detectCommunities(nodes: Node[], edges: Edge[]): Map<string, number> {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const adjacency = new Map<string, Set<string>>()
  nodes.forEach(n => adjacency.set(n.id, new Set()))
  edges.forEach(e => {
    adjacency.get(e.source)?.add(e.target)
    adjacency.get(e.target)?.add(e.source)
  })

  const totalEdges = edges.length
  const degree = new Map<string, number>()
  nodes.forEach(n => degree.set(n.id, adjacency.get(n.id)!.size))

  // 初始化：每个节点一个社区
  const community = new Map<string, number>()
  nodes.forEach((n, i) => community.set(n.id, i))

  // 简化的模块度增益计算
  function modularityGain(nodeId: string, targetCommunity: number): number {
    const neighbors = adjacency.get(nodeId)!
    let inCommunity = 0
    let totalInCommunity = 0

    nodes.forEach(n => {
      if (community.get(n.id) === targetCommunity) {
        totalInCommunity += degree.get(n.id)!
        if (neighbors.has(n.id)) inCommunity++
      }
    })

    const ki = degree.get(nodeId)!
    const sigmaIn = totalInCommunity
    return inCommunity / totalEdges - (ki * sigmaIn) / (2 * totalEdges * totalEdges)
  }

  // 迭代优化
  let improved = true
  while (improved) {
    improved = false
    nodes.forEach(node => {
      const currentCommunity = community.get(node.id)!
      const neighborCommunities = new Set(
        [...adjacency.get(node.id)!].map(n => community.get(n)!)
      )

      let bestCommunity = currentCommunity
      let bestGain = 0

      neighborCommunities.forEach(c => {
        const gain = modularityGain(node.id, c)
        if (gain > bestGain) {
          bestGain = gain
          bestCommunity = c
        }
      })

      if (bestCommunity !== currentCommunity) {
        community.set(node.id, bestCommunity)
        improved = true
      }
    })
  }

  return community
}
```

## 社区感知的力导向

把社区信息融入布局——同一社区的节点吸引力更强，不同社区的排斥力更大：

```ts
function communityAwareFR(
  nodes: Node[],
  edges: Edge[],
  communities: Map<string, number>
) {
  const k = 5
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // 排斥力（所有节点对）
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01
      // 不同社区排斥力更大
      const multiplier = communities.get(a.id) !== communities.get(b.id) ? 1.5 : 1.0
      const force = (k * k * multiplier) / dist
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      const fz = (dz / dist) * force
      a.vx += fx; a.vy += fy; a.vz += fz
      b.vx -= fx; b.vy -= fy; b.vz -= fz
    }
  }

  // 吸引力（相连节点，同社区更紧）
  edges.forEach(edge => {
    const a = nodeMap.get(edge.source)!
    const b = nodeMap.get(edge.target)!
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01
    const sameCommunity = communities.get(a.id) === communities.get(b.id)
    const multiplier = sameCommunity ? 0.5 : 1.5
    const force = (dist * dist) / (k * multiplier)
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    const fz = (dz / dist) * force
    a.vx += fx; a.vy += fy; a.vz += fz
    b.vx -= fx; b.vy -= fy; b.vz -= fz
  })
}
```

## Three.js 可视化

社区用颜色区分，社区内节点用同色系不同亮度：

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const communityPalette = [
  0x4fc3f7, 0xff7043, 0x66bb6a, 0xab47bc,
  0xffd54f, 0xff8a80, 0x80cbc4, 0xce93d8,
]

function getCommunityColor(communityId: number, brightness: number = 1): THREE.Color {
  const base = communityPalette[communityId % communityPalette.length]
  const color = new THREE.Color(base)
  color.multiplyScalar(brightness)
  return color
}

// 渲染节点
const geometry = new THREE.BufferGeometry()
const positions = new Float32Array(nodes.length * 3)
const colors = new Float32Array(nodes.length * 3)

nodes.forEach((node, i) => {
  positions[i * 3] = node.x
  positions[i * 3 + 1] = node.y
  positions[i * 3 + 2] = node.z

  const comm = communities.get(node.id) ?? 0
  const color = getCommunityColor(comm, 0.8 + Math.random() * 0.4)
  colors[i * 3] = color.r
  colors[i * 3 + 1] = color.g
  colors[i * 3 + 2] = color.b
})

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

const material = new THREE.PointsMaterial({
  size: 0.3,
  vertexColors: true,
  transparent: true,
  opacity: 0.9,
})

const pointCloud = new THREE.Points(geometry, material)
scene.add(pointCloud)
```

## 社区凸包

给每个社区画一个凸包（convex hull），视觉上明确社区边界：

```ts
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js'

function drawCommunityHulls(nodes: Node[], communities: Map<string, number>) {
  const communityNodes = new Map<number, THREE.Vector3[]>()

  nodes.forEach(node => {
    const comm = communities.get(node.id)!
    if (!communityNodes.has(comm)) communityNodes.set(comm, [])
    communityNodes.get(comm)!.push(new THREE.Vector3(node.x, node.y, node.z))
  })

  communityNodes.forEach((points, commId) => {
    if (points.length < 4) return

    const geometry = new ConvexGeometry(points)
    const material = new THREE.MeshBasicMaterial({
      color: communityPalette[commId % communityPalette.length],
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
  })
}
```

## 练习

### 练习一：社区统计面板

在侧边栏显示每个社区的节点数、边数、平均度数。点击某个社区高亮其所有节点。

### 练习二：布局过渡动画

当社区标签切换时（从 community A 变到 community B），节点位置平滑过渡而不是瞬间跳变。

---

## 参考答案

### 练习一

```ts
function computeCommunityStats(
  nodes: Node[],
  edges: Edge[],
  communities: Map<string, number>
) {
  const stats = new Map<number, { nodeCount: number; edgeCount: number; avgDegree: number }>()

  nodes.forEach(node => {
    const c = communities.get(node.id)!
    if (!stats.has(c)) stats.set(c, { nodeCount: 0, edgeCount: 0, avgDegree: 0 })
    stats.get(c)!.nodeCount++
  })

  edges.forEach(edge => {
    const cs = communities.get(edge.source)
    const ct = communities.get(edge.target)
    if (cs === ct) stats.get(cs)!.edgeCount++
  })

  stats.forEach(s => {
    s.avgDegree = s.nodeCount > 0 ? (s.edgeCount * 2) / s.nodeCount : 0
  })

  return stats
}

function renderCommunityPanel(stats: Map<number, { nodeCount: number; edgeCount: number; avgDegree: number }>) {
  const panel = document.getElementById('community-panel')!
  panel.innerHTML = ''
  stats.forEach((s, commId) => {
    const div = document.createElement('div')
    div.style.cssText = 'padding: 8px; margin-bottom: 4px; border-radius: 4px; cursor: pointer;'
    div.style.background = `#${(communityPalette[commId % communityPalette.length] as number).toString(16)}22`
    div.innerHTML = `
      <div style="color: #${(communityPalette[commId % communityPalette.length] as number).toString(16)}; font-weight: bold;">社区 ${commId}</div>
      <div style="color: #aaa; font-size: 12px;">
        节点: ${s.nodeCount} | 边: ${s.edgeCount} | 平均度: ${s.avgDegree.toFixed(1)}
      </div>
    `
    div.addEventListener('click', () => highlightCommunity(commId))
    panel.appendChild(div)
  })
}
```

### 练习二

```ts
let targetPositions = new Map<number, { x: number; y: number; z: number }>()

function animateToLayout(newPositions: Map<string, THREE.Vector3>) {
  nodes.forEach((node, i) => {
    const target = newPositions.get(node.id)!
    targetPositions.set(i, { x: target.x, y: target.y, z: target.z })
  })
}

function animate() {
  requestAnimationFrame(animate)

  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
  let needsUpdate = false

  targetPositions.forEach((target, i) => {
    const cx = posAttr.getX(i), cy = posAttr.getY(i), cz = posAttr.getZ(i)
    const dx = target.x - cx, dy = target.y - cy, dz = target.z - cz
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || Math.abs(dz) > 0.01) {
      posAttr.setXYZ(i, cx + dx * 0.08, cy + dy * 0.08, cz + dz * 0.08)
      needsUpdate = true
    } else {
      posAttr.setXYZ(i, target.x, target.y, target.z)
      targetPositions.delete(i)
    }
  })

  if (needsUpdate) posAttr.needsUpdate = true
  controls.update()
  renderer.render(scene, camera)
}
```
