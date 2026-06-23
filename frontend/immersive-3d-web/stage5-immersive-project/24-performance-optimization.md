# 性能优化——LOD、实例化、GPU Profiling、移动端适配

## 100 万粒子很酷，但手机跑不动

前面的课程追求视觉效果，很少提性能。但真实项目必须面对性能约束：用户设备从 iPhone SE 到 RTX 4090，差异巨大。

性能优化不是事后补救，是从设计阶段就要考虑的工程决策。

## 第一步：量化

优化之前先知道瓶颈在哪里。浏览器提供了丰富的性能工具：

### Chrome DevTools Performance

```ts
// 手动标记性能区间
performance.mark("render-start")
renderer.render(scene, camera)
performance.mark("render-end")
performance.measure("render", "render-start", "render-end")
```

### Three.js Renderer Info

```ts
// 每帧输出渲染统计
console.log(renderer.info)
// {
//   render: { calls: 50, triangles: 100000, points: 0, lines: 0 },
//   memory: { geometries: 30, textures: 15 },
//   programs: 5
// }
```

关键指标：

- `calls`：draw call 数量，越少越好（移动端 < 100）
- `triangles`：三角形总数
- `geometries` / `textures`：GPU 资源数量

### GPU Profiling

Chrome 的 `chrome://tracing` 或 `WebGL Insights` 扩展可以看 GPU 时间。

```ts
// WebGL 扩展
const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2")
if (ext) {
  const query = gl.createQuery()
  gl.beginQuery(ext.TIME_ELAPSED_EXT, query)
  // 渲染
  gl.endQuery(ext.TIME_ELAPSED_EXT)
  
  // 异步获取结果
  setTimeout(() => {
    const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)
    if (available) {
      const time = gl.getQueryParameter(query, gl.QUERY_RESULT)
      console.log(`GPU render time: ${time / 1000000}ms`)
    }
  }, 100)
}
```

## LOD（Level of Detail）

远处的物体不需要高精度模型。LOD 根据相机距离自动切换不同精度的模型：

```ts
import { LOD } from "three"

const lod = new LOD()

// 高精度：相机距离 0-10
const highDetail = new Mesh(
  new SphereGeometry(1, 64, 64),
  new MeshStandardMaterial()
)
lod.addLevel(highDetail, 0)

// 中精度：相机距离 10-30
const midDetail = new Mesh(
  new SphereGeometry(1, 16, 16),
  new MeshStandardMaterial()
)
lod.addLevel(midDetail, 10)

// 低精度：相机距离 30+
const lowDetail = new Mesh(
  new SphereGeometry(1, 8, 8),
  new MeshStandardMaterial()
)
lod.addLevel(lowDetail, 30)

scene.add(lod)
```

Three.js 自动根据相机距离选择合适的 level。手动更新：

```ts
function animate() {
  lod.update(camera)
}
```

## 实例化（Instanced Rendering）

场景中有 1000 个相同的物体（比如粒子、建筑、树木），用 InstancedMesh 一次 draw call 画完：

```ts
import { InstancedMesh, Object3D } from "three"

const count = 1000
const mesh = new InstancedMesh(
  new BoxGeometry(1, 1, 1),
  new MeshStandardMaterial(),
  count
)

const dummy = new Object3D()
for (let i = 0; i < count; i++) {
  dummy.position.set(
    Math.random() * 50 - 25,
    Math.random() * 50 - 25,
    Math.random() * 50 - 25
  )
  dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
  dummy.updateMatrix()
  mesh.setMatrixAt(i, dummy.matrix)
}
mesh.instanceMatrix.needsUpdate = true

scene.add(mesh)
```

1000 个立方体，只有 1 个 draw call。

## Draw Call 合并

不使用实例化的场景，可以通过合并几何体减少 draw call：

```ts
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"

const geometries = meshes.map(m => {
  const geo = m.geometry.clone()
  geo.applyMatrix4(m.matrixWorld)
  return geo
})

const merged = mergeGeometries(geometries)
const mergedMesh = new Mesh(merged, sharedMaterial)
scene.add(mergedMesh)

// 删除原来的独立 mesh
meshes.forEach(m => scene.remove(m))
```

代价：合并后不能单独移动每个物体。适合静态场景。

## 纹理优化

| 策略 | 方法 |
|------|------|
| 压缩格式 | 用 KTX2 + Basis 纹理压缩，体积减少 4-8 倍 |
| Mipmap | Three.js 默认开启，确保纹理尺寸是 2 的幂 |
| 纹理图集 | 多张小纹理合并成一张大纹理 |
| 按需加载 | 只加载当前视角可见的纹理 |

```ts
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js"

const ktx2Loader = new KTX2Loader()
ktx2Loader.setTranscoderPath("basis/")
ktx2Loader.detectSupport(renderer)

ktx2Loader.load("texture.ktx2", (texture) => {
  material.map = texture
  material.needsUpdate = true
})
```

## 移动端适配

```ts
function getQualitySettings(): QualitySettings {
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
  const pixelRatio = Math.min(devicePixelRatio, isMobile ? 1.5 : 2)
  const shadowMapSize = isMobile ? 512 : 2048
  const particleCount = isMobile ? 100_000 : 1_000_000
  const postProcessing = !isMobile
  
  return { pixelRatio, shadowMapSize, particleCount, postProcessing }
}
```

### 动态降质

如果帧率持续低于 30fps，自动降低画质：

```ts
const frameTimes: number[] = []
const FPS_THRESHOLD = 30

function checkPerformance(deltaTime: number) {
  frameTimes.push(deltaTime)
  if (frameTimes.length > 60) frameTimes.shift()
  
  const avgFPS = 1000 / (frameTimes.reduce((a, b) => a + b) / frameTimes.length)
  
  if (avgFPS < FPS_THRESHOLD) {
    // 降级
    renderer.setPixelRatio(1)
    bloomPass.strength *= 0.5
    particleSystem.maxCount *= 0.5
    console.warn("性能不足，自动降级画质")
  }
}
```

## 内存管理

Three.js 不会自动释放 GPU 资源。离开页面或切换场景时必须手动清理：

```ts
function disposeScene(scene: Scene) {
  scene.traverse(child => {
    if (child instanceof Mesh) {
      child.geometry.dispose()
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose())
      } else {
        child.material.dispose()
      }
    }
  })
  
  // 清理渲染目标
  composer?.passes.forEach(pass => {
    if (pass.renderTarget) pass.renderTarget.dispose()
  })
}
```

## 练习

### 练习一：性能仪表盘

创建一个实时性能面板，显示：FPS、draw call 数、三角形数、GPU 内存、JS 堆内存。当 FPS 低于 30 时面板变红。用 `renderer.info` 和 `performance.memory` 获取数据。

### 练习二：LOD 自动切换

场景中放 100 个球体，每个球体有 3 级 LOD。相机移动时，靠近的球体显示高精度，远处的显示低精度。在性能面板中显示当前各级 LOD 的使用数量。

---

## 参考答案

### 练习一

**思路**：创建 HTML 面板，每帧更新数据。

```ts
class PerformanceDashboard {
  private element: HTMLElement
  private fpsHistory: number[] = []
  
  constructor() {
    this.element = document.createElement("div")
    this.element.style.cssText = `
      position: fixed; top: 10px; right: 10px;
      background: rgba(0,0,0,0.7); color: #0f0;
      font-family: monospace; font-size: 12px;
      padding: 10px; z-index: 1000; min-width: 200px;
    `
    document.body.appendChild(this.element)
  }
  
  update(renderer: WebGLRenderer, deltaTime: number) {
    this.fpsHistory.push(1000 / deltaTime)
    if (this.fpsHistory.length > 60) this.fpsHistory.shift()
    
    const avgFPS = this.fpsHistory.reduce((a, b) => a + b) / this.fpsHistory.length
    const info = renderer.info
    
    const memory = (performance as any).memory
    const jsHeapMB = memory ? (memory.usedJSHeapSize / 1048576).toFixed(1) : "N/A"
    
    this.element.innerHTML = `
      <div style="color: ${avgFPS < 30 ? '#f00' : '#0f0'}">
        FPS: ${avgFPS.toFixed(0)}
      </div>
      <div>Draw Calls: ${info.render.calls}</div>
      <div>Triangles: ${info.render.triangles.toLocaleString()}</div>
      <div>Geometries: ${info.memory.geometries}</div>
      <div>Textures: ${info.memory.textures}</div>
      <div>JS Heap: ${jsHeapMB} MB</div>
    `
    
    info.reset()
  }
}

const dashboard = new PerformanceDashboard()

function animate() {
  requestAnimationFrame(animate)
  const delta = clock.getDelta()
  dashboard.update(renderer, delta)
  renderer.render(scene, camera)
}
```

### 练习二

**思路**：为每个球体创建 LOD 实例，每帧更新。

```ts
const lods: LOD[] = []
const sphereGeo = [
  new SphereGeometry(1, 64, 64),  // 高
  new SphereGeometry(1, 16, 16),  // 中
  new SphereGeometry(1, 8, 8),    // 低
]

for (let i = 0; i < 100; i++) {
  const lod = new LOD()
  
  const high = new Mesh(sphereGeo[0], new MeshStandardMaterial({ color: 0x4488ff }))
  const mid = new Mesh(sphereGeo[1], new MeshStandardMaterial({ color: 0x4488ff }))
  const low = new Mesh(sphereGeo[2], new MeshStandardMaterial({ color: 0x4488ff }))
  
  lod.addLevel(high, 0)
  lod.addLevel(mid, 15)
  lod.addLevel(low, 30)
  
  lod.position.set(
    Math.random() * 60 - 30,
    Math.random() * 20 - 10,
    Math.random() * 60 - 30
  )
  
  scene.add(lod)
  lods.push(lod)
}

function animate() {
  lods.forEach(lod => lod.update(camera))
  
  // 统计各级 LOD 使用数量
  let highCount = 0, midCount = 0, lowCount = 0
  lods.forEach(lod => {
    const dist = lod.position.distanceTo(camera.position)
    if (dist < 15) highCount++
    else if (dist < 30) midCount++
    else lowCount++
  })
  dashboard.updateLOD(highCount, midCount, lowCount)
}
```

**常见错误**：`renderer.info` 的计数器会累积，每帧开始前要调用 `renderer.info.reset()`。否则数字只会越来越大。
