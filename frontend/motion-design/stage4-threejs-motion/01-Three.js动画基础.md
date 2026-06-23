# Three.js 动画基础

## 为什么需要 3D

CSS 3D 变换能做翻转卡片和简单立方体，但它本质上还是 2D 元素在 3D 空间中排列。当你需要光照、材质、模型加载、粒子系统、物理模拟时，需要一个真正的 3D 渲染引擎。

Three.js 是 Web 上最成熟的 3D 库。它不是游戏引擎，而是一个渲染库——给你画笔和画布，怎么画由你决定。

## 最小 3D 场景

一个 Three.js 场景需要四样东西：

```javascript
import * as THREE from 'three'

// 1. 场景：所有物体的容器
const scene = new THREE.Scene()

// 2. 相机：决定你从哪里看、看到多宽
const camera = new THREE.PerspectiveCamera(
  75,                                    // 视野角度
  window.innerWidth / window.innerHeight, // 宽高比
  0.1,                                   // 近裁剪面
  1000                                   // 远裁剪面
)
camera.position.z = 5

// 3. 渲染器：把 3D 场景画到 2D 屏幕上
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

// 4. 物体
const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshStandardMaterial({ color: 0x3b82f6 })
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

// 光照
const light = new THREE.DirectionalLight(0xffffff, 1)
light.position.set(5, 5, 5)
scene.add(light)
scene.add(new THREE.AmbientLight(0x404040))

// 动画循环
function animate() {
  requestAnimationFrame(animate)
  cube.rotation.x += 0.01
  cube.rotation.y += 0.01
  renderer.render(scene, camera)
}
animate()
```

## 场景图

Three.js 的场景是一个树状结构：

```
Scene
├── Mesh (Cube)
│   ├── BoxGeometry
│   └── MeshStandardMaterial
├── DirectionalLight
├── AmbientLight
└── Group
    ├── Mesh (Sphere)
    └── Mesh (Cone)
```

`scene.add()` 把物体加到场景中，`group.add()` 把物体加到组中。组可以整体移动、旋转、缩放。

## 几何体

Three.js 内置了常见几何体：

```javascript
new THREE.BoxGeometry(1, 1, 1)         // 立方体
new THREE.SphereGeometry(1, 32, 32)    // 球体
new THREE.CylinderGeometry(1, 1, 2, 32)// 圆柱
new THREE.TorusGeometry(1, 0.3, 16, 100)// 圆环
new THREE.PlaneGeometry(5, 5)          // 平面
new THREE.ConeGeometry(1, 2, 32)       // 圆锥
```

参数含义：尺寸、分段数（越多越光滑，也越慢）。

## 材质

材质决定物体的外观：

```javascript
// 基础材质（不受光照影响）
new THREE.MeshBasicMaterial({ color: 0x3b82f6 })

// 标准材质（受光照影响，有金属感和粗糙度）
new THREE.MeshStandardMaterial({
  color: 0x3b82f6,
  metalness: 0.3,
  roughness: 0.7,
})

// 物理材质（更真实，支持更多属性）
new THREE.MeshPhysicalMaterial({
  color: 0x3b82f6,
  metalness: 0.5,
  roughness: 0.3,
  clearcoat: 1,        // 清漆层
  clearcoatRoughness: 0.1,
})
```

## 光照

```javascript
// 环境光：均匀照亮所有面
new THREE.AmbientLight(0x404040, 0.5)

// 方向光：像太阳，平行光
new THREE.DirectionalLight(0xffffff, 1)

// 点光源：像灯泡，向四周发光
new THREE.PointLight(0xffffff, 1, 100)

// 聚光灯：锥形光束
new THREE.SpotLight(0xffffff, 1)
```

## 动画方式

### 方式一：直接在循环中修改

```javascript
function animate() {
  requestAnimationFrame(animate)
  cube.rotation.x += 0.01
  cube.position.y = Math.sin(Date.now() * 0.001) * 0.5
  renderer.render(scene, camera)
}
```

### 方式二：GSAP 控制

```javascript
import gsap from 'gsap'

gsap.to(cube.rotation, {
  y: Math.PI * 2,
  duration: 2,
  ease: 'power2.inOut',
  repeat: -1,
})
```

GSAP 的优势是可以用 Timeline 编排复杂的 3D 动画序列。

### 方式三：骨骼动画和变形目标

对于加载的 3D 模型（glTF），动画数据通常内置在文件中：

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
loader.load('model.glb', (gltf) => {
  scene.add(gltf.scene)
  const mixer = new THREE.AnimationMixer(gltf.scene)
  const action = mixer.clipAction(gltf.animations[0])
  action.play()

  function animate() {
    requestAnimationFrame(animate)
    mixer.update(0.016) // 每帧更新动画
    renderer.render(scene, camera)
  }
  animate()
})
```

## 响应式

```javascript
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
```

## 性能要点

- 几何体分段数按需设置，不要默认 128 段
- 材质数量越少越好，相同材质的物体可以合并几何体
- 使用 `BufferGeometry`（Three.js 默认）而不是旧的 `Geometry`
- 阴影很贵，只在关键物体上启用
- 使用 `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` 限制像素比

## 练习

### 练习一：旋转地球

创建一个球体，贴上地球纹理，让它绕 Y 轴旋转。添加方向光模拟太阳。

### 练习二：粒子星空

用 `THREE.Points` 创建 1000 个随机分布的粒子，缓慢旋转，形成星空效果。

### 练习三：物体阵列

创建 5×5 的立方体阵列，每个立方体根据与中心的距离做不同相位的上下浮动（正弦波）。

---

## 参考答案

### 练习一

```javascript
const geo = new THREE.SphereGeometry(2, 64, 64)
const mat = new THREE.MeshStandardMaterial({
  map: new THREE.TextureLoader().load('earth.jpg'),
})
const earth = new THREE.Mesh(geo, mat)
scene.add(earth)

const sun = new THREE.DirectionalLight(0xffffff, 1)
sun.position.set(5, 3, 5)
scene.add(sun)

function animate() {
  requestAnimationFrame(animate)
  earth.rotation.y += 0.002
  renderer.render(scene, camera)
}
animate()
```

### 练习二

```javascript
const count = 1000
const positions = new Float32Array(count * 3)
for (let i = 0; i < count * 3; i++) {
  positions[i] = (Math.random() - 0.5) * 100
}
const geo = new THREE.BufferGeometry()
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2 })
const stars = new THREE.Points(geo, mat)
scene.add(stars)

function animate() {
  requestAnimationFrame(animate)
  stars.rotation.y += 0.0003
  stars.rotation.x += 0.0001
  renderer.render(scene, camera)
}
animate()
```

### 练习三

```javascript
for (let x = -2; x <= 2; x++) {
  for (let z = -2; z <= 2; z++) {
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6 })
    )
    cube.position.set(x * 1.2, 0, z * 1.2)
    scene.add(cube)
  }
}

const meshes = scene.children.filter(c => c.isMesh)
function animate() {
  requestAnimationFrame(animate)
  const t = Date.now() * 0.002
  meshes.forEach((m, i) => {
    m.position.y = Math.sin(t + i * 0.3) * 0.5
  })
  renderer.render(scene, camera)
}
animate()
```
