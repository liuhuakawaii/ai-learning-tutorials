# 树形结构——组织架构图、文件系统树、决策树

## 树形数据的特点

树是一种特殊的图——每个节点只有一个父节点（根节点除外）。组织架构、文件系统、决策树、分类体系都是树。树的可视化目标是让层次关系一目了然。

## 数据结构

```ts
interface TreeNode {
  id: string
  name: string
  children?: TreeNode[]
  data?: {
    value?: number
    type?: string
    description?: string
  }
}

const orgTree: TreeNode = {
  id: 'ceo', name: 'CEO',
  children: [
    {
      id: 'cto', name: 'CTO',
      children: [
        { id: 'fe', name: '前端团队', data: { value: 12, type: 'team' } },
        { id: 'be', name: '后端团队', data: { value: 15, type: 'team' } },
        { id: 'infra', name: '基础设施', data: { value: 8, type: 'team' } },
      ],
    },
    {
      id: 'cfo', name: 'CFO',
      children: [
        { id: 'finance', name: '财务部', data: { value: 6, type: 'team' } },
        { id: 'audit', name: '审计部', data: { value: 4, type: 'team' } },
      ],
    },
    {
      id: 'cmo', name: 'CMO',
      children: [
        { id: 'marketing', name: '市场部', data: { value: 10, type: 'team' } },
        { id: 'sales', name: '销售部', data: { value: 20, type: 'team' } },
        { id: 'brand', name: '品牌部', data: { value: 5, type: 'team' } },
      ],
    },
  ],
}
```

## 布局算法：Reingold-Tilford

Reingold-Tilford 算法是树布局的经典算法，目标：同层节点不重叠，子树居中于父节点下方。

```ts
interface LayoutNode {
  id: string
  name: string
  x: number
  y: number
  children: LayoutNode[]
  data?: TreeNode['data']
}

function layoutTree(root: TreeNode, levelSpacing: number = 4, nodeSpacing: number = 2): LayoutNode {
  let leafIndex = 0

  function layout(node: TreeNode, depth: number): LayoutNode {
    if (!node.children || node.children.length === 0) {
      return {
        ...node,
        x: leafIndex++ * nodeSpacing,
        y: depth * levelSpacing,
        children: [],
      }
    }

    const children = node.children.map(c => layout(c, depth + 1))
    const centerX = (children[0].x + children[children.length - 1].x) / 2

    return {
      ...node,
      x: centerX,
      y: depth * levelSpacing,
      children,
    }
  }

  return layout(root, 0)
}
```

## Three.js 渲染

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0d1117)

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200)
camera.position.set(0, 5, 25)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const layout = layoutTree(orgTree)

const typeColors: Record<string, number> = {
  team: 0x4fc3f7,
  manager: 0xff7043,
}

const nodeMeshes = new Map<string, THREE.Mesh>()

function renderTree(node: LayoutNode) {
  const size = node.data?.value ? 0.2 + (node.data.value / 20) * 0.5 : 0.4
  const geo = new THREE.SphereGeometry(size, 16, 16)
  const color = node.children.length > 0 ? 0xff7043 : 0x4fc3f7
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.3,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(node.x, -node.y, 0)
  mesh.userData = node
  scene.add(mesh)
  nodeMeshes.set(node.id, mesh)

  node.children.forEach(child => {
    renderTree(child)

    // 画连线
    const from = new THREE.Vector3(node.x, -node.y, 0)
    const to = new THREE.Vector3(child.x, -child.y, 0)
    const mid = new THREE.Vector3().lerpVectors(from, to, 0.5)
    mid.y += 1

    const curve = new THREE.QuadraticBezierCurve3(from, mid, to)
    const points = curve.getPoints(20)
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.6 })
    const line = new THREE.Line(lineGeo, lineMat)
    scene.add(line)
  })
}

renderTree(layout)

// 光照
scene.add(new THREE.AmbientLight(0xffffff, 0.5))
const dirLight = new THREE.DirectionalLight(0xffffff, 0.7)
dirLight.position.set(5, 10, 5)
scene.add(dirLight)

// 标签
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(innerWidth, innerHeight)
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.top = '0'
labelRenderer.domElement.style.pointerEvents = 'none'
document.body.appendChild(labelRenderer.domElement)

function addLabels(node: LayoutNode) {
  const div = document.createElement('div')
  div.textContent = node.name
  div.style.cssText = 'color: #ccc; font-size: 12px; padding: 2px 6px; background: rgba(0,0,0,0.5); border-radius: 3px;'
  const label = new CSS2DObject(div)
  label.position.set(node.x, -node.y - 0.8, 0)
  scene.add(label)

  node.children.forEach(c => addLabels(c))
}
addLabels(layout)

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}
animate()
```

## 径向布局

把树从垂直变成圆形展开，适合节点多的场景：

```ts
function radialLayout(
  root: TreeNode,
  radiusStep: number = 3,
  startAngle: number = 0,
  endAngle: number = Math.PI * 2
): LayoutNode {
  function countLeaves(node: TreeNode): number {
    if (!node.children?.length) return 1
    return node.children.reduce((sum, c) => sum + countLeaves(c), 0)
  }

  function layout(node: TreeNode, depth: number, aStart: number, aEnd: number): LayoutNode {
    const angle = (aStart + aEnd) / 2
    const radius = depth * radiusStep

    const result: LayoutNode = {
      ...node,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      children: [],
    }

    if (node.children?.length) {
      const totalLeaves = countLeaves(node)
      let currentAngle = aStart

      result.children = node.children.map(child => {
        const childLeaves = countLeaves(child)
        const childAngle = (childLeaves / totalLeaves) * (aEnd - aStart)
        const childLayout = layout(child, depth + 1, currentAngle, currentAngle + childAngle)
        currentAngle += childAngle
        return childLayout
      })
    }

    return result
  }

  return layout(root, 0, startAngle, endAngle)
}
```

## 折叠与展开

点击节点时展开/折叠子树：

```ts
const collapsedNodes = new Set<string>()

function toggleNode(nodeId: string) {
  if (collapsedNodes.has(nodeId)) {
    collapsedNodes.delete(nodeId)
  } else {
    collapsedNodes.add(nodeId)
  }
  rebuildScene()
}

function getVisibleNodes(node: LayoutNode): LayoutNode[] {
  const result = [node]
  if (!collapsedNodes.has(node.id)) {
    node.children.forEach(c => result.push(...getVisibleNodes(c)))
  }
  return result
}

function rebuildScene() {
  // 移除旧的 mesh 和 line
  scene.children.filter(c => c instanceof THREE.Mesh || c instanceof THREE.Line).forEach(c => scene.remove(c))
  nodeMeshes.clear()

  const visible = getVisibleNodes(layout)
  visible.forEach(n => {
    // 重新创建 mesh 和连线
    renderVisibleNode(n)
  })
}
```

## 练习

### 练习一：决策树可视化

用同样的布局算法渲染一个机器学习决策树，叶子节点用颜色编码分类结果，中间节点显示分裂条件。

### 练习二：搜索高亮

加一个搜索框，输入节点名称后高亮匹配的节点及其路径到根节点。

---

## 参考答案

### 练习一

```ts
interface DecisionNode extends TreeNode {
  data: {
    condition?: string
    class?: string
    samples: number
    gini: number
  }
}

const decisionTree: DecisionNode = {
  id: 'root', name: '根节点', data: { condition: '收入 ≤ 50K?', samples: 1000, gini: 0.5 },
  children: [
    {
      id: 'n1', name: '左子树', data: { condition: '年龄 ≤ 30?', samples: 600, gini: 0.4 },
      children: [
        { id: 'leaf1', name: '拒绝', data: { class: 'rejected', samples: 400, gini: 0 } },
        { id: 'leaf2', name: '通过', data: { class: 'approved', samples: 200, gini: 0 } },
      ],
    },
    {
      id: 'n2', name: '右子树', data: { class: 'approved', samples: 400, gini: 0 },
    },
  ],
}

const classColors: Record<string, number> = {
  approved: 0x66bb6a,
  rejected: 0xff4444,
}
```

### 练习二

```ts
const searchInput = document.createElement('input')
searchInput.placeholder = '搜索节点...'
searchInput.style.cssText = 'position: fixed; top: 10px; right: 10px; padding: 6px 12px; z-index: 10;'
document.body.appendChild(searchInput)

function findPathToRoot(nodeId: string): string[] {
  const path: string[] = [nodeId]
  function search(node: LayoutNode): boolean {
    if (node.id === nodeId) return true
    for (const child of node.children) {
      if (search(child)) {
        path.push(node.id)
        return true
      }
    }
    return false
  }
  search(layout)
  return path
}

searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase()
  if (!query) {
    resetHighlights()
    return
  }

  const matches = [...nodeMeshes.keys()].filter(id => id.toLowerCase().includes(query))
  const highlightSet = new Set<string>()
  matches.forEach(id => findPathToRoot(id).forEach(n => highlightSet.add(n)))

  nodeMeshes.forEach((mesh, id) => {
    const mat = mesh.material as THREE.MeshStandardMaterial
    if (highlightSet.has(id)) {
      mat.emissive.setHex(0x444444)
      mat.opacity = 1
    } else {
      mat.emissive.setHex(0x000000)
      mat.opacity = 0.2
    }
  })
})
```
