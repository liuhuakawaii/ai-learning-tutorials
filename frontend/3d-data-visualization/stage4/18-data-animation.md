# 数据动画——过渡动画、数据增长、趋势变化

## 动画在数据可视化中的作用

静态图表告诉用户"现在是什么样"，动画告诉用户"发生了什么变化"。过渡动画让用户理解数据的增减过程，而不是看到一个数字从 50 突然跳到 80。

这节课实现三种数据动画：数值过渡、增长动画、趋势流动。

## 数值过渡动画

最基础的动画——当前值平滑逼近目标值：

```ts
class AnimatedValue {
  current: number
  target: number
  velocity: number = 0
  damping: number = 0.85
  stiffness: number = 0.08

  constructor(initial: number = 0) {
    this.current = initial
    this.target = initial
  }

  setTarget(value: number) {
    this.target = value
  }

  update(): boolean {
    const force = (this.target - this.current) * this.stiffness
    this.velocity += force
    this.velocity *= this.damping
    this.current += this.velocity
    return Math.abs(this.velocity) > 0.001 || Math.abs(this.target - this.current) > 0.001
  }
}
```

这是一个弹簧阻尼系统。比 `lerp`（线性插值）效果好——开始快，到达时减速，有自然的弹性感。

## 3D 柱状图过渡动画

把 AnimatedValue 用在柱状图上：

```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

interface DataItem {
  label: string
  value: AnimatedValue
  color: THREE.Color
}

const items: DataItem[] = [
  { label: '北京', value: new AnimatedValue(0), color: new THREE.Color(0x4fc3f7) },
  { label: '上海', value: new AnimatedValue(0), color: new THREE.Color(0x66bb6a) },
  { label: '广州', value: new AnimatedValue(0), color: new THREE.Color(0xff7043) },
  { label: '深圳', value: new AnimatedValue(0), color: new THREE.Color(0xab47bc) },
  { label: '杭州', value: new AnimatedValue(0), color: new THREE.Color(0xffd54f) },
  { label: '成都', value: new AnimatedValue(0), color: new THREE.Color(0xff8a80) },
]

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0d1117)

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100)
camera.position.set(10, 8, 10)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

scene.add(new THREE.AmbientLight(0xffffff, 0.5))
const dir = new THREE.DirectionalLight(0xffffff, 0.7)
dir.position.set(5, 10, 5)
scene.add(dir)

const barMeshes: THREE.Mesh[] = []
const spacing = 2
const barWidth = 0.8

items.forEach((item, i) => {
  const geo = new THREE.BoxGeometry(barWidth, 1, barWidth)
  geo.translate(0, 0.5, 0)
  const mat = new THREE.MeshStandardMaterial({
    color: item.color,
    roughness: 0.4,
    metalness: 0.3,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set((i - (items.length - 1) / 2) * spacing, 0, 0)
  scene.add(mesh)
  barMeshes.push(mesh)
})

function animate() {
  requestAnimationFrame(animate)

  let needsUpdate = false
  items.forEach((item, i) => {
    if (item.value.update()) needsUpdate = true
    const height = item.value.current
    barMeshes[i].scale.y = Math.max(0.01, height / 100)
  })

  controls.update()
  renderer.render(scene, camera)
}
animate()
```

## 增长动画

数据"生长"出来的视觉效果——从底部向上增长，顶部有光晕：

```ts
class GrowthAnimation {
  private particles: THREE.Points
  private particlePositions: Float32Array
  private particleSpeeds: Float32Array
  private particleLifetimes: Float32Array
  private maxParticles: number

  constructor(scene: THREE.Scene, maxParticles: number = 200) {
    this.maxParticles = maxParticles
    this.particlePositions = new Float32Array(maxParticles * 3)
    this.particleSpeeds = new Float32Array(maxParticles)
    this.particleLifetimes = new Float32Array(maxParticles).fill(0)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3))

    const mat = new THREE.PointsMaterial({
      color: 0x44aaff,
      size: 0.15,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    this.particles = new THREE.Points(geo, mat)
    scene.add(this.particles)
  }

  emit(x: number, y: number, z: number) {
    for (let i = 0; i < this.maxParticles; i++) {
      if (this.particleLifetimes[i] <= 0) {
        this.particlePositions[i * 3] = x + (Math.random() - 0.5) * 0.3
        this.particlePositions[i * 3 + 1] = y
        this.particlePositions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3
        this.particleSpeeds[i] = 0.02 + Math.random() * 0.03
        this.particleLifetimes[i] = 1.0
        break
      }
    }
  }

  update() {
    for (let i = 0; i < this.maxParticles; i++) {
      if (this.particleLifetimes[i] > 0) {
        this.particleLifetimes[i] -= 0.015
        this.particlePositions[i * 3 + 1] += this.particleSpeeds[i]
      }
    }
    const attr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute
    attr.needsUpdate = true
  }
}

const growth = new GrowthAnimation(scene)
```

## 趋势流动动画

在折线上加一个流动的光点，表示数据趋势方向：

```ts
class TrendFlow {
  private points: THREE.Vector3[]
  private progress: number = 0
  private particle: THREE.Mesh
  private speed: number

  constructor(scene: THREE.Scene, points: THREE.Vector3[], color: number) {
    this.points = points
    this.speed = 0.005

    const geo = new THREE.SphereGeometry(0.15, 8, 8)
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    })
    this.particle = new THREE.Mesh(geo, mat)
    scene.add(this.particle)
  }

  update() {
    this.progress += this.speed
    if (this.progress >= 1) this.progress = 0

    const idx = this.progress * (this.points.length - 1)
    const i = Math.floor(idx)
    const t = idx - i

    if (i < this.points.length - 1) {
      this.particle.position.lerpVectors(this.points[i], this.points[i + 1], t)
    }
  }
}
```

## 数据更新触发

当新数据到达时，更新 AnimatedValue，动画系统自动处理过渡：

```ts
function updateData(newValues: number[]) {
  items.forEach((item, i) => {
    item.value.setTarget(newValues[i])
  })
}

// 模拟每 3 秒更新一次数据
setInterval(() => {
  updateData(items.map(() => 20 + Math.random() * 80))
}, 3000)

// 初始值动画入场
setTimeout(() => {
  updateData([85, 72, 65, 58, 45, 38])
}, 500)
```

## 面积图的生长动画

时间序列面积图从左到右"生长"出来：

```ts
class AreaGrowth {
  private mesh: THREE.Mesh
  private currentLength: number = 0
  private targetLength: number
  private totalPoints: number

  constructor(
    scene: THREE.Scene,
    dataPoints: THREE.Vector3[],
    baseY: number,
    color: number
  ) {
    this.totalPoints = dataPoints.length
    this.targetLength = dataPoints.length

    const positions: number[] = []
    const colors: number[] = []
    const col = new THREE.Color(color)

    for (let i = 0; i < dataPoints.length - 1; i++) {
      const p1 = dataPoints[i]
      const p2 = dataPoints[i + 1]

      positions.push(p1.x, p1.y, p1.z)
      positions.push(p1.x, baseY, p1.z)
      positions.push(p2.x, p2.y, p2.z)

      positions.push(p2.x, p2.y, p2.z)
      positions.push(p1.x, baseY, p1.z)
      positions.push(p2.x, baseY, p2.z)

      for (let j = 0; j < 6; j++) {
        colors.push(col.r, col.g, col.b)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    })

    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.geometry.setDrawRange(0, 0)
    scene.add(this.mesh)
  }

  update() {
    if (this.currentLength < this.targetLength) {
      this.currentLength += 6
      this.mesh.geometry.setDrawRange(0, Math.min(this.currentLength, this.totalPoints * 6))
    }
  }
}
```

## 组合使用

把这些动画组合在一起，构建一个有生命力的数据大屏：

```ts
const trendPoints = items.map((item, i) =>
  new THREE.Vector3((i - (items.length - 1) / 2) * spacing, item.value.current / 100 * 8, 0)
)
const trendFlow = new TrendFlow(scene, trendPoints, 0x44aaff)

function animate() {
  requestAnimationFrame(animate)

  items.forEach((item, i) => {
    if (item.value.update()) {
      barMeshes[i].scale.y = Math.max(0.01, item.value.current / 100)
    }
  })

  trendFlow.update()
  growth.update()

  // 在柱子顶部发射粒子
  items.forEach((item, i) => {
    if (Math.abs(item.value.velocity) > 0.5) {
      const bar = barMeshes[i]
      growth.emit(bar.position.x, bar.scale.y, bar.position.z)
    }
  })

  controls.update()
  renderer.render(scene, camera)
}
animate()
```

## 练习

### 练习一：数字翻牌器

在每个柱子上方用 CSS2DObject 显示当前值，数值变化时做数字翻牌效果（逐位滚动）。

### 练习二：颜色过渡

当 CPU 超过阈值时，柱子颜色从蓝色渐变到红色，同时触发告警闪烁。

---

## 参考答案

### 练习一

```ts
class FlipNumber {
  private element: HTMLDivElement
  private currentValue: string = ''

  constructor(scene: THREE.Scene, position: THREE.Vector3) {
    this.element = document.createElement('div')
    this.element.style.cssText = `
      color: #fff; font-size: 16px; font-weight: bold;
      font-family: monospace; padding: 2px 6px;
      background: rgba(0,0,0,0.6); border-radius: 3px;
    `
    const label = new CSS2DObject(this.element)
    label.position.copy(position)
    scene.add(label)
  }

  update(value: number) {
    const formatted = value.toFixed(1)
    if (formatted !== this.currentValue) {
      this.currentValue = formatted
      this.element.style.transition = 'transform 0.2s'
      this.element.style.transform = 'translateY(-4px)'
      this.element.textContent = formatted + '%'
      setTimeout(() => {
        this.element.style.transform = 'translateY(0)'
      }, 100)
    }
  }
}
```

### 练习二

```ts
function updateBarColor(mesh: THREE.Mesh, cpu: number) {
  const mat = mesh.material as THREE.MeshStandardMaterial
  const t = Math.min(cpu / 100, 1)
  mat.color.lerpColors(
    new THREE.Color(0x4fc3f7),
    new THREE.Color(0xff4444),
    t
  )

  if (cpu > 80) {
    const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5
    mat.emissive.lerpColors(
      new THREE.Color(0x000000),
      new THREE.Color(0x440000),
      pulse
    )
  } else {
    mat.emissive.setHex(0x000000)
  }
}
```
