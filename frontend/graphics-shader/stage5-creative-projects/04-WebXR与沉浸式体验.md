# WebXR 与沉浸式体验

## 场景引入

想象一下：戴上 VR 头盔，走进你用 Three.js 构建的 3D 数据可视化场景，用手柄抓取数据柱体旋转查看；或者举起手机，将虚拟的 3D 模型投射到真实桌面上——这就是 WebXR 的能力。WebXR Device API 是 WebVR 和 WebAR 的统一继任者，让浏览器原生支持虚拟现实和增强现实体验，无需安装任何插件。本课将系统学习 WebXR 的核心概念和 Three.js 集成方法。

## 学习目标

1. 理解 WebXR API 的核心概念（XRSession / ReferenceSpace）
2. 掌握 VR 场景的双眼立体渲染原理
3. 实现 AR 场景的平面检测与光照估计
4. 了解 WebXR 的手柄和手势交互方式
5. 掌握 Three.js 的 WebXR 集成方法
6. 理解 VR/AR 应用的性能要求（72/90/120fps）

## WebXR API 基础

### 核心概念架构

```
WebXR Device API 架构：

Navigator
  └─ xr (XRSystem)
       ├─ requestSession(mode, options)
       │    mode: "immersive-vr" | "immersive-ar" | "inline"
       │    options: { requiredFeatures, optionalFeatures }
       │
       ├─ isSessionSupported(mode)
       │
       └─ XRSession
            ├─ requestReferenceSpace(type)
            │    type: "local" | "local-floor" | "bounded-floor" | "viewer"
            │
            ├─ requestAnimationFrame(callback)
            │    每帧回调，提供 XRFrame
            │
            ├─ inputSources
            │    手柄 / 手势 / 眼动追踪
            │
            └─ end() → 结束会话
```

### 检测与初始化

```typescript
class WebXRManager {
  private session: XRSession | null = null
  private renderer: THREE.WebGLRenderer

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    this.renderer.xr.enabled = true
  }

  async isSupported(mode: XRSessionMode = 'immersive-vr'): Promise<boolean> {
    if (!navigator.xr) return false
    return navigator.xr.isSessionSupported(mode)
  }

  async startVR(): Promise<void> {
    const session = await navigator.xr!.requestSession('immersive-vr', {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['hand-tracking', 'hit-test'],
    })
    this.renderer.xr.setSession(session)
    this.session = session
    session.addEventListener('end', () => { this.session = null })
  }

  async startAR(): Promise<void> {
    const session = await navigator.xr!.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test', 'local-floor'],
      optionalFeatures: ['dom-overlay', 'light-estimation'],
      domOverlay: { root: document.getElementById('overlay')! },
    })
    this.renderer.xr.setSession(session)
    this.session = session
  }

  stop(): void {
    this.session?.end()
  }
}
```

### ReferenceSpace 类型

```
ReferenceSpace 类型示意：

"viewer"          "local"           "local-floor"
  👤                👤                 👤
  │                 │                  │
  ▼ 原点在眼睛     ▼ 原点在起始位置    ▼ 原点在地面
  ┌───┐            ┌───┐              ┌───┐
  │ ● │ 头部       │ ● │              │   │
  └───┘            └───┘              │ ● │ 头部
  (0,0,0)          (0,0,0)            └───┘
                                      (0,0,0) 地面

"bounded-floor"   有安全边界
  ┌─────────────┐
  │    👤        │  边界多边形
  │             │  防止用户撞墙
  └─────────────┘
```

## VR 场景渲染：双眼立体

### 立体渲染原理

```
VR 双眼渲染：

左眼视图              右眼视图
  ┌──────┐            ┌──────┐
  │      │            │      │
  │  ◉   │← IPD →│  ◉   │
  │      │  63mm      │      │
  └──────┘            └──────┘
     ↘                  ↙
      ┌────────────────┐
      │  左半   │  右半  │  ← HMD 显示屏
      │  画面   │  画面  │
      └────────────────┘

Three.js 处理:
  renderer.xr.enabled = true
  renderer.setAnimationLoop(render)
  → 自动创建两个相机（左眼/右眼）
  → 自动设置视锥体（非对称透视）
  → 渲染两次到同一画布的不同区域
```

```typescript
function setupVRScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.xr.enabled = true
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 100)
  scene.add(camera)

  // 控制器（手柄）
  const controller1 = renderer.xr.getController(0)
  const controller2 = renderer.xr.getController(1)
  scene.add(controller1, controller2)

  // 手柄射线可视化
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -5),
  ])
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00aaff })
  controller1.add(new THREE.Line(lineGeometry, lineMaterial))
  controller2.add(new THREE.Line(lineGeometry.clone(), lineMaterial.clone()))

  // 按钮
  const btn = document.getElementById('enterVR')!
  btn.addEventListener('click', async () => {
    const xr = new WebXRManager(renderer)
    if (await xr.isSupported()) {
      await xr.startVR()
    }
  })

  // 渲染循环 — 注意用 setAnimationLoop 而非 requestAnimationFrame
  renderer.setAnimationLoop((timestamp, frame) => {
    renderer.render(scene, camera)
  })
}
```

## AR 场景：平面检测与光照估计

### AR 核心特性

```
AR 场景层叠：

摄像头画面（真实世界）
  │
  ▼
┌─────────────────────────────┐
│  ┌─────────┐                │
│  │ 3D 模型  │ ← 投射到检测到 │
│  │ (虚拟)   │   的平面上     │
│  └─────────┘                │
│         🟫🟫🟫 ← 检测到的平面 │
│  真实场景透过背景显示         │
└─────────────────────────────┘

关键技术：
  1. Hit Testing → 将屏幕坐标映射到真实平面
  2. Light Estimation → 虚拟物体匹配真实光照
  3. Anchoring → 虚拟物体锁定在真实空间位置
```

```typescript
class ARScene {
  private hitTestSource: XRHitTestSource | null = null
  private reticle: THREE.Mesh

  async setupAR(session: XRSession, referenceSpace: XRReferenceSpace) {
    // 创建命中测试源
    const viewerSpace = await session.requestReferenceSpace('viewer')
    this.hitTestSource = await session.requestHitTestSource({
      space: viewerSpace,
    })

    // 准备准星（放置虚拟物体的指示器）
    const ringGeo = new THREE.RingGeometry(0.05, 0.06, 32)
    ringGeo.rotateX(-Math.PI / 2)
    this.reticle = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    )
    this.reticle.visible = false
  }

  onFrame(frame: XRFrame, referenceSpace: XRReferenceSpace) {
    if (!this.hitTestSource) return

    const hitResults = frame.getHitTestResults(this.hitTestSource)
    if (hitResults.length > 0) {
      const hit = hitResults[0]
      const pose = hit.getPose(referenceSpace)
      if (pose) {
        this.reticle.visible = true
        this.reticle.position.set(
          pose.transform.position.x,
          pose.transform.position.y,
          pose.transform.position.z
        )
        this.reticle.quaternion.set(
          pose.transform.orientation.x,
          pose.transform.orientation.y,
          pose.transform.orientation.z,
          pose.transform.orientation.w
        )
      }
    }
  }

  // 点击放置物体
  placeObject(scene: THREE.Scene, object: THREE.Object3D) {
    if (!this.reticle.visible) return
    const clone = object.clone()
    clone.position.copy(this.reticle.position)
    clone.quaternion.copy(this.reticle.quaternion)
    scene.add(clone)
  }
}
```

### 光照估计

```typescript
class LightEstimation {
  private lightProbe: XRLightProbe | null = null

  async setup(session: XRSession) {
    if (session.requestLightProbe) {
      this.lightProbe = await session.requestLightProbe({
        reflectionFormat: 'srgba8',
      })
    }
  }

  update(frame: XRFrame, light: THREE.Light) {
    if (!this.lightProbe) return
    const estimate = frame.getLightEstimate(this.lightProbe)
    if (estimate) {
      // 环境光强度
      const intensity = estimate.primaryLightIntensity
      light.intensity = (intensity.x + intensity.y + intensity.z) / 3

      // 环境光方向
      light.position.set(
        estimate.primaryLightDirection.x,
        estimate.primaryLightDirection.y,
        estimate.primaryLightDirection.z
      )
    }
  }
}
```

## WebXR 交互：手柄与手势

### 手柄输入

```
XR 手柄按键映射（标准控制器）：

     触摸板/摇杆
        ┌───┐
        │ ○ │
        └───┘
    ┌───┐   ┌───┐
    │ X │   │ A │    ← 按钮 (xr-standard)
    └───┘   └───┘
        ┌───┐
        │扳机│        ← trigger (select 事件)
        └───┘
        ┌───┐
        │握把│        ← grip (squeeze 事件)
        └───┘

inputSources[i].gamepad.axes: [x, y, x2, y2]
inputSources[i].gamepad.buttons: [trigger, grip, A, B, ...]
```

```typescript
class XRInputHandler {
  private controllers: THREE.Group[] = []
  private grabStates: Map<number, THREE.Object3D | null> = new Map()

  setup(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i)
      controller.addEventListener('selectstart', this.onSelectStart.bind(this))
      controller.addEventListener('squeezestart', this.onGrab.bind(this))
      controller.addEventListener('squeezeend', this.onRelease.bind(this))
      scene.add(controller)
      this.controllers.push(controller)
      this.grabStates.set(i, null)
    }
  }

  private onSelectStart(event: XRInputSourceEvent) {
    const controller = event.target as THREE.XRTargetRaySpace
    // 射线检测
    const raycaster = new THREE.Raycaster()
    const tempMatrix = new THREE.Matrix4()
    tempMatrix.identity().extractRotation(controller.matrixWorld)
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix)
  }

  private onGrab(event: XRInputSourceEvent) {
    const controller = event.target as THREE.XRTargetRaySpace
    const idx = this.controllers.indexOf(controller as any)
    // 检测附近物体并"抓取"
  }

  private onRelease(event: XRInputSourceEvent) {
    const controller = event.target as THREE.XRTargetRaySpace
    const idx = this.controllers.indexOf(controller as any)
    this.grabStates.set(idx, null)
  }
}
```

### 手势追踪

```typescript
class HandTracking {
  private handModels: THREE.Group[] = []

  setup(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    for (let i = 0; i < 2; i++) {
      const hand = renderer.xr.getHand(i)
      // 创建关节可视化
      const joints: THREE.Mesh[] = []
      for (let j = 0; j < 25; j++) {
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.005, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.6 })
        )
        joints.push(sphere)
        hand.add(sphere)
      }
      scene.add(hand)
    }
  }

  getGesture(frame: XRFrame, hand: XRHand): string {
    const indexTip = hand.get('index-finger-tip')
    const thumbTip = hand.get('thumb-tip')
    const middleTip = hand.get('middle-finger-tip')

    if (!indexTip || !thumbTip) return 'unknown'

    const indexPose = frame.getJointPose(indexTip)
    const thumbPose = frame.getJointPose(thumbTip)

    if (indexPose && thumbPose) {
      const dx = indexPose.transform.position.x - thumbPose.transform.position.x
      const dy = indexPose.transform.position.y - thumbPose.transform.position.y
      const dz = indexPose.transform.position.z - thumbPose.transform.position.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (dist < 0.02) return 'pinch'
      if (dist > 0.08) return 'open'
    }
    return 'neutral'
  }
}
```

## Three.js WebXR 集成

### 完整的 XR 应用模板

```typescript
import * as THREE from 'three'

class XRApplication {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private clock = new THREE.Clock()

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.xr.enabled = true
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.01, 100)

    this.setupLighting()
    this.buildContent()
    this.setupXR()
  }

  private setupLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(5, 10, 5)
    this.scene.add(dirLight)
  }

  private buildContent() {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x00aaff, roughness: 0.3 })
    )
    box.position.set(0, 1.2, -1.5)
    this.scene.add(box)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    )
    floor.rotation.x = -Math.PI / 2
    this.scene.add(floor)
  }

  private setupXR() {
    this.renderer.setAnimationLoop((timestamp, frame) => {
      this.renderer.render(this.scene, this.camera)
    })
  }

  async enterVR() {
    const session = await navigator.xr!.requestSession('immersive-vr', {
      requiredFeatures: ['local-floor'],
    })
    this.renderer.xr.setSession(session)
  }
}
```

## 性能要求

### VR 帧率目标

```
VR 设备帧率要求：

设备类型          目标帧率    每帧预算
─────────────────────────────────────
Quest 2/3         72/90/120   13.9/11.1/8.3 ms
PSVR2             90/120      11.1/8.3 ms
Valve Index       80/90/120   12.5/11.1/8.3 ms
Apple Vision Pro  90          11.1 ms

关键约束：
  - 必须渲染两次（左眼 + 右眼）
  - 任何掉帧都会导致眩晕
  - 必须保持稳定，不能有卡顿
```

### VR 性能优化策略

```typescript
class VROptimizer {
  // 固定注视点渲染（Foveated Rendering）
  static setupFoveatedRendering(
    renderer: THREE.WebGLRenderer,
    level: 'none' | 'low' | 'medium' | 'high'
  ) {
    // WebXR 层级 API 支持
    const session = renderer.xr.getSession()
    if (!session) return

    const layers = session.renderState.layers
    if (layers && layers.length > 0) {
      // 设置注视点渲染级别
      const foveationMap = { none: 0, low: 0.25, medium: 0.5, high: 0.75 }
      // 需要底层 XR 支持
    }
  }

  // LOD 策略：根据与相机距离切换精度
  static createLODModel(
    highDetail: THREE.BufferGeometry,
    lowDetail: THREE.BufferGeometry
  ): THREE.LOD {
    const lod = new THREE.LOD()
    const material = new THREE.MeshStandardMaterial({ color: 0x00aaff })
    lod.addLevel(new THREE.Mesh(highDetail, material), 0)
    lod.addLevel(new THREE.Mesh(lowDetail, material), 5)
    return lod
  }

  // 实例化渲染减少 Draw Call
  static createInstancedEnvironment(
    template: THREE.Mesh,
    positions: THREE.Vector3[],
    count: number
  ): THREE.InstancedMesh {
    const instanced = new THREE.InstancedMesh(
      template.geometry,
      template.material as THREE.Material,
      count
    )
    const matrix = new THREE.Matrix4()
    positions.forEach((pos, i) => {
      matrix.setPosition(pos)
      instanced.setMatrixAt(i, matrix)
    })
    instanced.instanceMatrix.needsUpdate = true
    return instanced
  }
}
```

## 常见误区

1. **使用 `requestAnimationFrame` 而非 `renderer.setAnimationLoop`**：在 WebXR 模式下，标准的 `requestAnimationFrame` 无法接收 XR 帧数据。Three.js 提供的 `setAnimationLoop` 会自动适配 XR 的帧回调机制。

2. **忽略 ReferenceSpace 的选择**：`local` 参考空间的原点在用户起始位置，如果用户站起来可能会"穿过"虚拟物体。VR 场景应优先使用 `local-floor`，确保虚拟地面与真实地面一致。

3. **在 VR 中使用过大的 FOV 或过近的物体**：双眼立体渲染有视差约束，物体距离眼睛太近（< 0.5m）会导致辐辏调节冲突，引发不适。应确保可交互物体保持在合理距离。

4. **忽略 AR 模式的透明背景**：AR 需要 `alpha: true` 创建 WebGL 上下文，并设置场景背景为 `null`，否则摄像头画面会被不透明背景遮挡。

## 工程建议

1. **渐进式增强**：先确保 2D 模式可用，再检测 WebXR 支持并添加 VR/AR 按钮。用 `navigator.xr.isSessionSupported()` 做特性检测，不支持时提供降级方案。

2. **使用 XR 模拟器开发**：Chrome 的 WebXR 模拟器插件可以在桌面端模拟 VR/AR 会话，避免频繁切换到真机。但最终必须在真实设备上测试性能和交互体验。

3. **管理 XR 会话生命周期**：监听 `sessionend` 事件清理资源，处理 `visibilitychange` 事件（用户摘下头盔时暂停渲染），在页面卸载前调用 `session.end()`。

4. **优化纹理和材质**：VR 渲染两次，纹理内存翻倍。使用压缩纹理（ASTC/ETC2），避免过多透明物体（Overdraw），Mipmap 对 VR 的视觉质量至关重要。

## 小结

本课系统学习了 WebXR 技术栈：XRSession 管理会话生命周期，ReferenceSpace 定义空间坐标系，VR 的双眼立体渲染由 Three.js 自动处理，AR 的平面检测通过 Hit Test API 实现。手柄交互和手势追踪是两种主要输入方式。性能是 VR/AR 的生命线——必须达到 72fps 以上且保持稳定，任何掉帧都会导致用户眩晕。

## 练习

1. 实现一个 VR 场景：创建一个简单的房间（地板 + 墙壁 + 几个立方体），支持手柄射线检测和点击交互，按扳机键改变立方体颜色。
2. 实现一个 AR 场景：用 Hit Test API 在检测到的平面上放置虚拟物体，支持多次放置，放置的物体随时间缓慢旋转。
3. 为 VR 场景添加手势追踪支持：检测"捏合"手势，在捏合位置生成粒子效果；检测"张开"手势，清除所有粒子。
4. 性能优化练习：构建一个包含 1000 个物体的 VR 场景，通过 Instancing、LOD、压缩纹理等手段将渲染时间控制在 8ms（120fps）以内，用 Spector.js 验证 Draw Call 数量。

---

## 参考答案

### 练习一

**思路**：VR 场景的核心是 Three.js 的 WebXR 集成——设置 `renderer.xr.enabled = true`，用 `VRButton` 创建进入按钮，手柄射线检测通过 `XRControllerModelFactory` 和 Raycaster 实现。关键点是 VR 的渲染循环不能用 `requestAnimationFrame`，必须用 `renderer.setAnimationLoop`。

**答案**：

```typescript
import * as THREE from 'three'
import { VRButton } from 'three/addons/webxr/VRButton.js'
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js'

function createVRRoom() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x222233)

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(0, 1.6, 3)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.xr.enabled = true
  document.body.appendChild(renderer.domElement)
  document.body.appendChild(VRButton.createButton(renderer))

  const room = new THREE.Group()
  scene.add(room)

  const floorGeo = new THREE.PlaneGeometry(6, 6)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  room.add(floor)

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x333355, roughness: 0.9 })
  const wallGeo = new THREE.PlaneGeometry(6, 3)
  const walls = [
    { pos: [0, 1.5, -3] as const, rot: [0, 0, 0] as const },
    { pos: [0, 1.5, 3] as const, rot: [0, Math.PI, 0] as const },
    { pos: [-3, 1.5, 0] as const, rot: [0, Math.PI / 2, 0] as const },
    { pos: [3, 1.5, 0] as const, rot: [0, -Math.PI / 2, 0] as const }
  ]
  walls.forEach(w => {
    const wall = new THREE.Mesh(wallGeo, wallMat)
    wall.position.set(...w.pos)
    wall.rotation.set(...w.rot)
    room.add(wall)
  })

  const cubePositions = [
    [0, 0.5, -1], [-1.5, 0.5, -1.5], [1.5, 0.5, -1.5],
    [-1, 0.5, 0], [1, 0.5, 0], [0, 1.5, -2]
  ]
  const cubes: THREE.Mesh[] = []
  cubePositions.forEach(pos => {
    const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4)
    const mat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })
    const cube = new THREE.Mesh(geo, mat)
    cube.position.set(...pos)
    cube.userData = { originalColor: mat.color.getHex() }
    room.add(cube)
    cubes.push(cube)
  })

  scene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(2, 4, 2)
  scene.add(dirLight)

  const controllerModelFactory = new XRControllerModelFactory()

  const controller1 = renderer.xr.getController(0)
  controller1.addEventListener('selectstart', () => onTrigger(controller1))
  scene.add(controller1)

  const controller2 = renderer.xr.getController(1)
  controller2.addEventListener('selectstart', () => onTrigger(controller2))
  scene.add(controller2)

  const grip1 = renderer.xr.getControllerGrip(0)
  grip1.add(controllerModelFactory.createControllerModel(grip1))
  scene.add(grip1)

  const grip2 = renderer.xr.getControllerGrip(1)
  grip2.add(controllerModelFactory.createControllerModel(grip2))
  scene.add(grip2)

  const rayGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5)
  ])
  const rayMat = new THREE.LineBasicMaterial({ color: 0x44ff44 })
  controller1.add(new THREE.Line(rayGeo, rayMat))
  controller2.add(new THREE.Line(rayGeo.clone(), rayMat.clone()))

  const raycaster = new THREE.Raycaster()

  function onTrigger(controller: THREE.XRTargetRaySpace) {
    const tempMatrix = new THREE.Matrix4()
    tempMatrix.identity().extractRotation(controller.matrixWorld)
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix)

    const intersects = raycaster.intersectObjects(cubes)
    if (intersects.length > 0) {
      const cube = intersects[0].object as THREE.Mesh
      const newColor = Math.random() * 0xffffff
      ;(cube.material as THREE.MeshStandardMaterial).color.setHex(newColor)
    }
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera)
  })
}

createVRRoom()
```

**要点**：
- `renderer.xr.enabled = true` 和 `VRButton.createButton()` 是 WebXR 的最低门槛
- VR 渲染循环必须用 `renderer.setAnimationLoop()` 替代 `requestAnimationFrame`，Three.js 内部处理了 XR 的帧同步
- 手柄交互通过 `selectstart` 事件触发，射线方向从 `controller.matrixWorld` 提取
- 控制器模型（Grip）用 `XRControllerModelFactory` 加载设备对应的 3D 模型，提升沉浸感

---

### 练习二

**思路**：AR 场景使用 `immersive-ar` 模式 + Hit Test API。Hit Test 通过 `session.requestHitTestSource()` 获取射线与真实平面的交点，用户点击时在交点处放置虚拟物体。多次放置只需维护一个物体数组。旋转动画在每帧更新 `rotation.y`。

**答案**：

```typescript
import * as THREE from 'three'
import { ARButton } from 'three/addons/webxr/ARButton.js'

function createARScene() {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.xr.enabled = true
  document.body.appendChild(renderer.domElement)

  const arButton = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: document.body }
  })
  document.body.appendChild(arButton)

  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const dirLight = new THREE.DirectionalLight(0xffffff, 1)
  dirLight.position.set(1, 3, 2)
  scene.add(dirLight)

  let hitTestSource: XRHitTestSource | null = null
  let hitTestSourceRequested = false

  const placedObjects: THREE.Mesh[] = []

  const cursorGeo = new THREE.RingGeometry(0.05, 0.06, 32)
  cursorGeo.rotateX(-Math.PI / 2)
  const cursorMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.7 })
  const cursor = new THREE.Mesh(cursorGeo, cursorMat)
  cursor.visible = false
  scene.add(cursor)

  function placeObject(position: THREE.Vector3) {
    const geometries = [
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.SphereGeometry(0.06, 32, 32),
      new THREE.ConeGeometry(0.06, 0.12, 32),
      new THREE.TorusGeometry(0.05, 0.02, 16, 32)
    ]
    const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff]

    const geo = geometries[Math.floor(Math.random() * geometries.length)]
    const mat = new THREE.MeshStandardMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      metalness: 0.3, roughness: 0.7
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(position)
    mesh.position.y += 0.05
    scene.add(mesh)
    placedObjects.push(mesh)
  }

  renderer.domElement.addEventListener('select', () => {
    if (cursor.visible) {
      placeObject(cursor.position)
    }
  })

  renderer.setAnimationLoop((timestamp, frame) => {
    if (frame) {
      const referenceSpace = renderer.xr.getReferenceSpace()
      const session = renderer.xr.getSession()

      if (!hitTestSourceRequested) {
        session?.requestReferenceSpace('viewer').then(viewerSpace => {
          session?.requestHitTestSource?.({ space: viewerSpace })?.then(source => {
            hitTestSource = source
          })
        })
        session?.addEventListener('end', () => {
          hitTestSourceRequested = false
          hitTestSource = null
        })
        hitTestSourceRequested = true
      }

      if (hitTestSource) {
        const hitTestResults = frame.getHitTestResults(hitTestSource)
        if (hitTestResults.length > 0) {
          const hit = hitTestResults[0]
          const pose = hit.getPose(referenceSpace!)
          if (pose) {
            cursor.visible = true
            cursor.matrix.fromArray(pose.transform.matrix)
            cursor.matrix.decompose(cursor.position, cursor.quaternion, cursor.scale)
          }
        } else {
          cursor.visible = false
        }
      }
    }

    placedObjects.forEach(obj => {
      obj.rotation.y += 0.02
    })

    renderer.render(scene, camera)
  })
}

createARScene()
```

**要点**：
- AR 需要 `alpha: true` 的 WebGLRenderer，这样摄像头画面才能透过 Canvas 显示
- Hit Test Source 的请求必须在 XR Session 内发起，且需要 `viewer` 参考空间
- `select` 事件在用户点击屏幕或按手柄扳机时触发，是 AR 交互的标准入口
- 放置物体后通过 `placedObjects` 数组管理所有已放置对象，便于后续操作（删除、移动等）

---

### 练习三

**思路**：手势追踪需要 `hand-tracking` 特性。`XRHand` 提供 25 个关节的位置数据，捏合手势通过计算拇指尖（joint 4）和食指尖（joint 8）的距离判断，张开手势通过所有手指尖到手掌中心的平均距离判断。粒子效果在手势位置生成。

**答案**：

```typescript
import * as THREE from 'three'
import { VRButton } from 'three/addons/webxr/VRButton.js'

function createHandTracking() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x111122)

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.xr.enabled = true
  document.body.appendChild(renderer.domElement)
  document.body.appendChild(VRButton.createButton(renderer, {
    optionalFeatures: ['hand-tracking']
  }))

  scene.add(new THREE.AmbientLight(0xffffff, 0.6))
  scene.add(new THREE.DirectionalLight(0xffffff, 0.8))

  const particles: THREE.Mesh[] = []
  const particleGeo = new THREE.SphereGeometry(0.008, 8, 8)

  const handMaterials = {
    pinch: new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0x441111 }),
    open: new THREE.MeshStandardMaterial({ color: 0x4444ff, emissive: 0x111144 }),
    default: new THREE.MeshStandardMaterial({ color: 0x44ff44, emissive: 0x114411 })
  }

  let hand1: XRHand | null = null
  let hand2: XRHand | null = null

  const session = renderer.xr.getSession()
  if (session) {
    session.addEventListener('inputsourceschange', () => {
      session.inputSources.forEach(source => {
        if (source.hand) {
          if (source.handedness === 'left') hand1 = source.hand
          else hand2 = source.hand
        }
      })
    })
  }

  const jointMeshes: THREE.Mesh[] = []
  const jointGeo = new THREE.SphereGeometry(0.005, 8, 8)
  const jointMat = new THREE.MeshBasicMaterial({ color: 0xffffff })

  for (let i = 0; i < 50; i++) {
    const mesh = new THREE.Mesh(jointGeo, jointMat)
    mesh.visible = false
    scene.add(mesh)
    jointMeshes.push(mesh)
  }

  function getFingerTipDistance(hand: XRHand, joint1Idx: number, joint2Idx: number): number {
    const j1 = hand.get(joint1Idx)
    const j2 = hand.get(joint2Idx)
    if (!j1 || !j2) return Infinity
    const p1 = new THREE.Vector3().copy(j1.position as unknown as THREE.Vector3)
    const p2 = new THREE.Vector3().copy(j2.position as unknown as THREE.Vector3)
    return p1.distanceTo(p2)
  }

  function getHandCenter(hand: XRHand): THREE.Vector3 {
    const center = new THREE.Vector3()
    let count = 0
    for (let i = 0; i < 25; i++) {
      const joint = hand.get(i)
      if (joint) {
        center.add(joint.position as unknown as THREE.Vector3)
        count++
      }
    }
    return count > 0 ? center.divideScalar(count) : center
  }

  function spawnParticles(position: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6),
        emissive: new THREE.Color().setHSL(Math.random(), 0.5, 0.2)
      })
      const p = new THREE.Mesh(particleGeo, mat)
      p.position.copy(position)
      p.userData = {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.05,
          Math.random() * 0.05,
          (Math.random() - 0.5) * 0.05
        ),
        life: 1.0
      }
      scene.add(p)
      particles.push(p)
    }
  }

  function clearParticles() {
    particles.forEach(p => {
      scene.remove(p)
      p.geometry.dispose()
      ;(p.material as THREE.Material).dispose()
    })
    particles.length = 0
  }

  renderer.setAnimationLoop(() => {
    let meshIdx = 0
    const hands = [hand1, hand2]

    hands.forEach(hand => {
      if (!hand) return
      for (let i = 0; i < 25; i++) {
        const joint = hand.get(i)
        if (joint && meshIdx < jointMeshes.length) {
          jointMeshes[meshIdx].visible = true
          jointMeshes[meshIdx].position.copy(joint.position as unknown as THREE.Vector3)
          meshIdx++
        }
      }

      const pinchDist = getFingerTipDistance(hand, 4, 8)
      const handCenter = getHandCenter(hand)

      if (pinchDist < 0.02) {
        spawnParticles(handCenter, 3)
      }

      let avgTipDist = 0
      const tipJoints = [4, 8, 12, 16, 20]
      tipJoints.forEach(idx => {
        const joint = hand.get(idx)
        if (joint) {
          avgTipDist += handCenter.distanceTo(joint.position as unknown as THREE.Vector3)
        }
      })
      avgTipDist /= tipJoints.length

      if (avgTipDist > 0.12) {
        clearParticles()
      }
    })

    for (let i = meshIdx; i < jointMeshes.length; i++) {
      jointMeshes[i].visible = false
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.position.add(p.userData.velocity)
      p.userData.velocity.y -= 0.001
      p.userData.life -= 0.02
      p.scale.setScalar(p.userData.life)
      if (p.userData.life <= 0) {
        scene.remove(p)
        p.geometry.dispose()
        ;(p.material as THREE.Material).dispose()
        particles.splice(i, 1)
      }
    }

    renderer.render(scene, camera)
  })
}

createHandTracking()
```

**要点**：
- 手势追踪需要 `hand-tracking` 可选特性，不是所有 VR 设备都支持
- `XRHand` 的 25 个关节遵循标准命名（0=wrist, 4=thumb_tip, 8=index_tip 等）
- 捏合检测用指尖距离 < 2cm 作为阈值，张开检测用所有指尖到手掌中心的平均距离
- 粒子需要生命周期管理（life 衰减 + 归零后销毁），否则会无限增长导致内存溢出

---

### 练习四

**思路**：VR 性能优化的核心是减少 Draw Call 和 GPU 负载。1000 个物体用 Instancing 合为少量 Draw Call，LOD 根据距离切换精度，压缩纹理减少显存带宽。Spector.js 验证优化效果。

**答案**：

```typescript
import * as THREE from 'three'
import { VRButton } from 'three/addons/webxr/VRButton.js'

function createPerformantVRScene() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x222233)

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(0, 1.6, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.xr.enabled = true
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  document.body.appendChild(renderer.domElement)
  document.body.appendChild(VRButton.createButton(renderer))

  scene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(2, 4, 2)
  scene.add(dirLight)

  const OBJECT_COUNT = 1000

  const highGeo = new THREE.SphereGeometry(0.3, 32, 32)
  const lowGeo = new THREE.SphereGeometry(0.3, 8, 8)

  const material = new THREE.MeshStandardMaterial({
    color: 0x4fc3f7, roughness: 0.5, metalness: 0.3
  })

  const instancedMesh = new THREE.InstancedMesh(highGeo, material, OBJECT_COUNT)
  const lowInstanceMesh = new THREE.InstancedMesh(lowGeo, material, OBJECT_COUNT)

  const dummy = new THREE.Object3D()
  const objectPositions: THREE.Vector3[] = []

  for (let i = 0; i < OBJECT_COUNT; i++) {
    const x = (Math.random() - 0.5) * 30
    const y = Math.random() * 3 + 0.5
    const z = (Math.random() - 0.5) * 30
    objectPositions.push(new THREE.Vector3(x, y, z))

    dummy.position.set(x, y, z)
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
    dummy.scale.setScalar(0.5 + Math.random() * 1.5)
    dummy.updateMatrix()

    instancedMesh.setMatrixAt(i, dummy.matrix)
    lowInstanceMesh.setMatrixAt(i, dummy.matrix)
  }

  instancedMesh.instanceMatrix.needsUpdate = true
  lowInstanceMesh.instanceMatrix.needsUpdate = true

  scene.add(instancedMesh)
  scene.add(lowInstanceMesh)

  const LOD_DISTANCE = 15
  let currentLOD: 'high' | 'low' = 'high'

  const infoEl = document.createElement('div')
  infoEl.style.cssText = 'position:fixed;top:10px;left:10px;color:#fff;font-size:13px;z-index:10;'
  document.body.appendChild(infoEl)

  let frameCount = 0
  let lastFpsTime = performance.now()
  let fps = 0

  renderer.setAnimationLoop(() => {
    frameCount++
    const now = performance.now()
    if (now - lastFpsTime >= 1000) {
      fps = frameCount
      frameCount = 0
      lastFpsTime = now
    }

    const camPos = camera.position
    let nearCount = 0
    let farCount = 0
    objectPositions.forEach(pos => {
      if (camPos.distanceTo(pos) < LOD_DISTANCE) nearCount++
      else farCount++
    })

    instancedMesh.visible = nearCount > 0
    lowInstanceMesh.visible = farCount > 0

    infoEl.innerHTML = `
      FPS: ${fps}<br>
      物体数: ${OBJECT_COUNT}<br>
      Draw Call: 2 (Instanced)<br>
      高精度: ${nearCount} | 低精度: ${farCount}
    `

    renderer.render(scene, camera)
  })
}

createPerformantVRScene()
```

**要点**：
- Instancing 将 1000 个物体从 1000 个 Draw Call 降到 2 个（高精度 + 低精度各一个），这是最关键的优化
- LOD 通过距离判断将物体分为近/远两组，分别使用不同精度的 InstancedMesh
- `powerPreference: 'high-performance'` 提示浏览器使用独立显卡（如果有）
- VR 场景的目标帧率是 72/90/120fps（取决于设备），对应帧预算为 13.9/11.1/8.3ms
