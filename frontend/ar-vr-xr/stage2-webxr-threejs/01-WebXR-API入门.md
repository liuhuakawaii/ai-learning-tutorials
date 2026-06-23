# WebXR API 入门：让浏览器启动 AR/VR 会话

## 当前项目状态

你的 3D 场景已经在浏览器里跑起来了——Three.js 渲染、光照、交互都没问题。但用户还坐在电脑前用鼠标操作。下一步是让这个场景进入 XR 设备：戴上头显，看到虚拟物体出现在真实环境中。

WebXR Device API 是浏览器提供的标准化接口。它不关心你用的是 Quest、Vision Pro 还是 HoloLens，用同一套 API 就能访问所有 XR 设备的能力。

## 三个核心概念

WebXR 的整个设计围绕三个东西：

```
XRSession     → 一次 AR/VR 会话，从创建到结束
ReferenceSpace → 空间坐标系的基准点
XRFrame        → 每帧的追踪数据和渲染时机
```

搞清楚这三个，WebXR 就通了大半。

## 能力检测

请求会话之前必须确认设备支持：

```typescript
async function checkXRSupport() {
  if (!navigator.xr) {
    console.warn('当前浏览器不支持 WebXR')
    return null
  }

  const [vr, ar] = await Promise.all([
    navigator.xr.isSessionSupported('immersive-vr'),
    navigator.xr.isSessionSupported('immersive-ar')
  ])

  // 优先 AR，回退 VR
  if (ar) return 'immersive-ar'
  if (vr) return 'immersive-vr'
  return null
}
```

`immersive-ar` 和 `immersive-vr` 是两种会话模式。AR 模式下摄像头画面作为背景，VR 模式下完全由你控制渲染内容。

## 创建会话

```typescript
async function startXRSession(mode: XRSessionMode) {
  const session = await navigator.xr.requestSession(mode, {
    requiredFeatures: ['local-floor'],      // 必须有地面参考
    optionalFeatures: ['hand-tracking', 'hit-test'] // 可选
  })

  session.addEventListener('end', () => {
    console.log('XR 会话结束')
  })

  return session
}
```

`requiredFeatures` 里声明的功能如果设备不支持，会话创建会失败。`optionalFeatures` 不影响创建，运行时再检测。

## 参考空间

参考空间决定了坐标系的原点在哪里：

```
local          → 原点在用户启动会话时的位置
               → 头显移动后原点不动
               → 适合小范围体验

local-floor    → 原点在用户脚下的地面上
               → 比 local 多了地面高度偏移
               → 大多数 VR 应用用这个

bounded-floor  → 原点在地面，有安全边界
               → 边界数据告诉你用户能走多远
               → Room-scale VR 用这个

unbounded      → 原点任意，用户可以自由走动
               → AR 导航、大范围 AR 用这个
```

```typescript
const refSpace = await session.requestReferenceSpace('local-floor')
```

## 帧循环

WebXR 的渲染循环和普通 `requestAnimationFrame` 不同——它绑定到 XRSession：

```typescript
function onXRFrame(time: DOMHighResTimeStamp, frame: XRFrame) {
  const pose = frame.getViewerPose(refSpace)
  if (!pose) {
    session.requestAnimationFrame(onXRFrame) // 等待追踪恢复
    return
  }

  // 每个 view 对应一只眼睛（VR 有两只，AR 只有一只）
  for (const view of pose.views) {
    const viewport = glLayer.getViewport(view)
    renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height)

    // 用 view 的投影矩阵和视图矩阵渲染
    camera.projectionMatrix.fromArray(view.projectionMatrix)
    camera.matrixWorldInverse.fromArray(view.transform.matrix)
    camera.matrixWorld.copy(camera.matrixWorldInverse).invert()
  }

  session.requestAnimationFrame(onXRFrame) // 请求下一帧
}
```

## 整合 Three.js

Three.js 提供了 `WebXRManager` 来简化整合：

```typescript
import * as THREE from 'three'

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.xr.enabled = true // 关键：启用 XR 模式

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera()

async function enterXR() {
  const mode = await checkXRSupport()
  if (!mode) throw new Error('不支持 XR')

  const session = await startXRSession(mode)
  renderer.xr.setSession(session) // Three.js 自动处理帧循环

  // 进入 XR 后，renderer.render() 会自动使用 XR 帧循环
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera)
  })
}
```

`renderer.xr.enabled = true` 后，Three.js 会自动处理：
- 左右眼视图矩阵
- 投影矩阵
- 帧循环同步
- 视口设置

你只需要正常调 `renderer.render()`。

## 会话生命周期

```
用户点击"进入 XR"
    │
    ▼
requestSession() ──→ 权限请求 ──→ 用户授权
    │
    ▼
session.start ──→ XRSession 'start' 事件
    │
    ▼
帧循环运行中 ──→ requestAnimationFrame 循环
    │
    ▼
用户按"退出" 或 调用 session.end()
    │
    ▼
session.end ──→ 'end' 事件 ──→ 清理资源
```

## 你可能踩的坑

**坑一：在 Session 结束前不清理资源**

会话结束后，WebGL 上下文可能仍然有效但 XR 相关的资源已失效。必须在 `end` 事件中清理。

**坑二：不处理追踪丢失**

XR 追踪可能暂时丢失（用户遮挡摄像头、环境太暗）。`frame.getViewerPose()` 会返回 `null`，这时候不要渲染，等下一帧再试。

**坑三：requiredFeatures 写太多**

每多写一个 required feature，就多一批设备不支持你的应用。能放 optional 的就放 optional。

## 练习

### 练习一：设备能力检测页面

写一个 HTML 页面，打开后自动检测浏览器的 WebXR 支持情况，列出：是否支持 immersive-vr、immersive-ar、hand-tracking、hit-test。用表格展示结果。

### 练习二：最小 XR 会话

在练习一的基础上，添加一个"进入 VR"按钮。点击后请求 `immersive-vr` 会话，进入后在用户面前 2 米处渲染一个红色立方体。要求处理会话结束事件。

---

## 参考答案

### 练习一

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>XR 能力检测</title></head>
<body>
  <h2>WebXR 能力检测</h2>
  <table border="1" cellpadding="8">
    <tr><th>能力</th><th>状态</th></tr>
    <tr><td>navigator.xr</td><td id="xr">检测中...</td></tr>
    <tr><td>immersive-vr</td><td id="vr">检测中...</td></tr>
    <tr><td>immersive-ar</td><td id="ar">检测中...</td></tr>
  </table>
  <script>
    async function check() {
      document.getElementById('xr').textContent = navigator.xr ? '支持' : '不支持'
      if (!navigator.xr) return
      const [vr, ar] = await Promise.all([
        navigator.xr.isSessionSupported('immersive-vr'),
        navigator.xr.isSessionSupported('immersive-ar')
      ])
      document.getElementById('vr').textContent = vr ? '支持' : '不支持'
      document.getElementById('ar').textContent = ar ? '支持' : '不支持'
    }
    check()
  </script>
</body>
</html>
```

### 练习二

```typescript
import * as THREE from 'three'

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.xr.enabled = true
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera()
scene.add(new THREE.AmbientLight(0xffffff, 0.5))
scene.add(new THREE.DirectionalLight(0xffffff, 1))

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(0.3, 0.3, 0.3),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
)
cube.position.set(0, 1.5, -2) // 眼前 2 米，高度 1.5 米
scene.add(cube)

document.getElementById('enterVR')!.addEventListener('click', async () => {
  const session = await navigator.xr.requestSession('immersive-vr', {
    requiredFeatures: ['local-floor']
  })
  renderer.xr.setSession(session)

  session.addEventListener('end', () => {
    console.log('VR 会话已结束')
  })

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera)
  })
})
```
