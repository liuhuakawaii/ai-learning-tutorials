# GPU 加速——WebGL/Instanced Rendering、WebGPU Compute

## 渲染管线回顾

浏览器里的 3D 渲染走的是 GPU 管线。理解管线的瓶颈在哪里，才能知道怎么优化。

```
CPU (JavaScript)         GPU (WebGL/WebGPU)
  ↓                        ↓
准备顶点数据    →    顶点着色器（变换位置）
                      ↓
                    光栅化（三角形→像素）
                      ↓
                    片元着色器（计算颜色）
                      ↓
                    输出到帧缓冲
```

CPU 瓶颈：JavaScript 准备数据太慢
GPU 瓶颈：draw call 太多、着色器太复杂

## Instanced Rendering

传统方式：1 万个点 = 1 万个 draw call。Instanced：1 万个点 = 1 个 draw call。

```ts
import * as THREE from 'three'

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200)
camera.position.set(0, 0, 30)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

const instanceCount = 100000

const geometry = new THREE.SphereGeometry(0.1, 8, 8)
const material = new THREE.MeshStandardMaterial({
  roughness: 0.4,
  metalness: 0.3,
})

const instancedMesh = new THREE.InstancedMesh(geometry, material, instanceCount)
instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

const dummy = new THREE.Object3D()
const color = new THREE.Color()

const positions: { x: number; y: number; z: number; vx: number; vy: number; vz: number }[] = []

for (let i = 0; i < instanceCount; i++) {
  const x = (Math.random() - 0.5) * 40
  const y = (Math.random() - 0.5) * 40
  const z = (Math.random() - 0.5) * 40
  positions.push({ x, y, z, vx: 0, vy: 0, vz: 0 })

  dummy.position.set(x, y, z)
  dummy.scale.setScalar(0.5 + Math.random() * 1.5)
  dummy.updateMatrix()
  instancedMesh.setMatrixAt(i, dummy.matrix)

  const hue = (i / instanceCount) * 360
  color.setHSL(hue / 360, 0.7, 0.5)
  instancedMesh.setColorAt(i, color)
}

instancedMesh.instanceMatrix.needsUpdate = true
if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true

scene.add(instancedMesh)

scene.add(new THREE.AmbientLight(0xffffff, 0.5))
const dirLight = new THREE.DirectionalLight(0xffffff, 0.7)
dirLight.position.set(5, 10, 5)
scene.add(dirLight)

const controls = new (await import('three/examples/jsm/controls/OrbitControls.js')).OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
```

10 万个球体，只有 1 个 draw call。

## GPU 粒子模拟

用 TransformFeedback（WebGL2）或 Compute Shader（WebGPU）在 GPU 上做粒子运动：

### WebGL2 方式

```ts
// WebGL2 TransformFeedback 需要手动管理 buffer
// 这里用简化的 JavaScript 版本演示概念

function updateParticlesOnCPU() {
  const matrix = new THREE.Matrix4()
  const color = new THREE.Color()

  for (let i = 0; i < instanceCount; i++) {
    const p = positions[i]

    // 简单引力模拟
    const distSq = p.x * p.x + p.y * p.y + p.z * p.z + 0.01
    const dist = Math.sqrt(distSq)
    const force = 50 / distSq

    p.vx -= (p.x / dist) * force * 0.016
    p.vy -= (p.y / dist) * force * 0.016
    p.vz -= (p.z / dist) * force * 0.016
    p.vx *= 0.99
    p.vy *= 0.99
    p.vz *= 0.99

    p.x += p.vx
    p.y += p.vy
    p.z += p.vz

    matrix.makeTranslation(p.x, p.y, p.z)
    const s = 0.3 + Math.sin(Date.now() * 0.001 + i) * 0.2
    matrix.scale(new THREE.Vector3(s, s, s))
    instancedMesh.setMatrixAt(i, matrix)
  }

  instancedMesh.instanceMatrix.needsUpdate = true
}
```

### WebGPU Compute（实验性）

```ts
// WebGPU compute shader - 未来方向
const computeShader = `
  @group(0) @binding(0) var<storage, read_write> positions : array<vec4<f32>>;
  @group(0) @binding(1) var<storage, read_write> velocities : array<vec4<f32>>;

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id : vec3<u32>) {
    let i = id.x;
    if (i >= arrayLength(&positions)) { return; }

    let pos = positions[i];
    let dist = length(pos.xyz) + 0.01;
    let force = 50.0 / (dist * dist);
    let acc = -(pos.xyz / dist) * force * 0.016;

    velocities[i] = vec4(
      (velocities[i].xyz + acc) * 0.99,
      0.0
    );

    positions[i] = vec4(
      pos.xyz + velocities[i].xyz,
      1.0
    );
  }
`
```

WebGPU 的 compute shader 能在 GPU 上并行处理数百万个粒子，比 CPU 快 100 倍以上。但目前浏览器支持还不完整。

## BufferGeometry 性能优化

### 避免每帧重新创建 geometry

```ts
// 错误做法
function update() {
  const newGeo = new THREE.BufferGeometry()
  newGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3))
  mesh.geometry.dispose()
  mesh.geometry = newGeo
}

// 正确做法
function update() {
  const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < newPositions.length; i++) {
    posAttr.array[i] = newPositions[i]
  }
  posAttr.needsUpdate = true
}
```

### 使用 TypedArray

```ts
// 慢
const positions: number[] = []
for (let i = 0; i < 100000 * 3; i++) positions.push(Math.random())

// 快
const positions = new Float32Array(100000 * 3)
for (let i = 0; i < positions.length; i++) positions[i] = Math.random()
```

### 设置正确的 usage hint

```ts
// 数据每帧都变
geometry.attributes.position.setUsage(THREE.DynamicDrawUsage)

// 数据偶尔变
geometry.attributes.position.setUsage(THREE.StreamDrawUsage)

// 数据基本不变
geometry.attributes.position.setUsage(THREE.StaticDrawUsage)
```

## 视锥裁剪

不在视野内的对象不应该渲染：

```ts
// Three.js 默认对 Mesh 做视锥裁剪
// 对 InstancedMesh，需要自己实现

const frustum = new THREE.Frustum()
const projScreenMatrix = new THREE.Matrix4()

function cullInstances() {
  projScreenMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  )
  frustum.setFromProjectionMatrix(projScreenMatrix)

  const matrix = new THREE.Matrix4()
  let visibleCount = 0

  for (let i = 0; i < instanceCount; i++) {
    const p = positions[i]
    const visible = frustum.containsPoint(new THREE.Vector3(p.x, p.y, p.z))

    if (visible) {
      matrix.makeTranslation(p.x, p.y, p.z)
      instancedMesh.setMatrixAt(visibleCount, matrix)
      visibleCount++
    }
  }

  instancedMesh.count = visibleCount
  instancedMesh.instanceMatrix.needsUpdate = true
}
```

## 帧率监控

```ts
const stats = new (await import('three/examples/jsm/libs/stats.module.js')).default()
document.body.appendChild(stats.dom)

function animate() {
  requestAnimationFrame(animate)
  stats.update()

  updateParticlesOnCPU()
  controls.update()
  renderer.render(scene, camera)
}
animate()
```

## 常见性能陷阱

**每帧 new 对象**：避免在 animate 里创建 Vector3、Color。预分配，复用。

**过多的 raycaster**：对 InstancedMesh 的 raycaster 很慢。限制每帧只做一次。

**不必要的透明**：transparent: true 的物体需要排序，开销大。不透明物体不需要。

**未优化的纹理**：用 2 的幂次尺寸的纹理（256x256, 512x512）。

## 练习

### 练习一：LOD 系统

根据相机距离，远处的点用更少的面片（4 面体代替球体），近处用高精度球体。

### 练习二：GPU Pick

实现一个基于颜色编码的 GPU picking 方案——把每个实例渲染成唯一颜色到一个离屏 FBO，读取鼠标位置的像素值来确定选中了哪个实例。

---

## 参考答案

### 练习一

```ts
const lodLevels = [
  { distance: 0, geometry: new THREE.SphereGeometry(0.1, 16, 16) },
  { distance: 30, geometry: new THREE.SphereGeometry(0.1, 8, 8) },
  { distance: 60, geometry: new THREE.OctahedronGeometry(0.1, 0) },
  { distance: 100, geometry: new THREE.TetrahedronGeometry(0.1, 0) },
]

const lodMeshes = lodLevels.map(lod =>
  new THREE.InstancedMesh(lod.geometry, material, instanceCount)
)

function updateLOD() {
  const camPos = camera.position
  lodMeshes.forEach(mesh => { mesh.visible = false })

  for (let i = 0; i < instanceCount; i++) {
    const p = positions[i]
    const dist = camPos.distanceTo(new THREE.Vector3(p.x, p.y, p.z))

    let lodIndex = 0
    for (let l = lodLevels.length - 1; l >= 0; l--) {
      if (dist > lodLevels[l].distance) { lodIndex = l; break }
    }

    const matrix = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)
    lodMeshes[lodIndex].setMatrixAt(i, matrix)
    lodMeshes[lodIndex].visible = true
  }

  lodMeshes.forEach(mesh => {
    mesh.instanceMatrix.needsUpdate = true
  })
}
```

### 练习二

```ts
const pickRT = new THREE.WebGLRenderTarget(innerWidth, innerHeight)
const pickScene = new THREE.Scene()
const pickMaterial = new THREE.MeshBasicMaterial()

// 给每个实例一个唯一颜色
for (let i = 0; i < instanceCount; i++) {
  const r = (i >> 16) & 0xff
  const g = (i >> 8) & 0xff
  const b = i & 0xff
  instancedMesh.setColorAt(i, new THREE.Color(r / 255, g / 255, b / 255))
}

function gpuPick(mouseX: number, mouseY: number): number {
  renderer.setRenderTarget(pickRT)
  renderer.render(pickScene, camera)
  renderer.setRenderTarget(null)

  const pixelBuffer = new Uint8Array(4)
  renderer.readRenderTargetPixels(pickRT, mouseX, innerHeight - mouseY, 1, 1, pixelBuffer)

  const id = (pixelBuffer[0] << 16) | (pixelBuffer[1] << 8) | pixelBuffer[2]
  return id < instanceCount ? id : -1
}
```
