# 多人 3D 空间——WebSocket 实时同步相机位置

## 一个人的 3D 和一群人的 3D

打开一个 3D 产品页，你是一个人看。但如果能看到其他用户也在这个空间里——他们的相机位置用一个小光点表示，甚至能看到他们在看什么——这个空间就有了"存在感"。

多人 3D 空间不是要做成 VR Chat。它可以很轻量：只同步相机位置和朝向，让页面有一种"这个空间里有其他人"的感觉。

## WebSocket 基础

WebSocket 是浏览器和服务器之间的持久双向连接。比 HTTP 轮询高效得多：

```ts
const ws = new WebSocket("wss://your-server.com/ws")

ws.onopen = () => {
  console.log("已连接到多人空间")
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  handleRemoteUpdate(data)
}

function sendPosition(pos: Vector3, target: Vector3) {
  ws.send(JSON.stringify({
    type: "camera",
    position: { x: pos.x, y: pos.y, z: pos.z },
    target: { x: target.x, y: target.y, z: target.z },
  }))
}
```

## 数据格式设计

只传必要信息，减少带宽：

```ts
interface CameraUpdate {
  type: "camera"
  id: string        // 用户 ID
  p: [number, number, number]  // position
  t: [number, number, number]  // lookAt target
  ts: number        // 时间戳
}
```

用数组而不是对象可以减少 JSON 字符串长度。每秒发送 10-20 次就够了。

## 发送频率控制

不需要每帧都发。用定时器控制：

```ts
const SEND_INTERVAL = 50 // 20Hz
let lastSendTime = 0

function animate() {
  requestAnimationFrame(animate)
  
  const now = performance.now()
  if (now - lastSendTime > SEND_INTERVAL) {
    sendPosition(camera.position, controls.target)
    lastSendTime = now
  }
  
  renderer.render(scene, camera)
}
```

## 接收远程用户数据

```ts
const remoteUsers: Map<string, {
  position: Vector3
  target: Vector3
  mesh: Mesh
}> = new Map()

function handleRemoteUpdate(data: CameraUpdate) {
  if (!remoteUsers.has(data.id)) {
    // 新用户，创建可视化
    const indicator = createUserIndicator(data.id)
    remoteUsers.set(data.id, {
      position: new Vector3(),
      target: new Vector3(),
      mesh: indicator,
    })
  }
  
  const user = remoteUsers.get(data.id)!
  // 用 lerp 平滑过渡，避免抖动
  user.position.lerp(
    new Vector3(data.p[0], data.p[1], data.p[2]),
    0.2
  )
  user.target.lerp(
    new Vector3(data.t[0], data.t[1], data.t[2]),
    0.2
  )
  user.mesh.position.copy(user.position)
}
```

## 用户可视化

远程用户用一个小光点 + 相机视锥体表示：

```ts
function createUserIndicator(id: string): Mesh {
  const group = new Group()
  
  // 光点
  const dot = new Mesh(
    new SphereGeometry(0.1),
    new MeshBasicMaterial({ color: getUserColor(id) })
  )
  group.add(dot)
  
  // 相机视锥体线框
  const frustumGeo = new BufferGeometry()
  const frustumVerts = new Float32Array([
    // 8 个顶点的视锥体线框
  ])
  frustumGeo.setAttribute("position", new Float32BufferAttribute(frustumVerts, 3))
  const frustum = new LineSegments(
    frustumGeo,
    new LineBasicMaterial({ color: getUserColor(id), opacity: 0.5, transparent: true })
  )
  group.add(frustum)
  
  // 用户名标签（用 CSS2DRenderer 或 sprite）
  
  scene.add(group)
  return dot
}

function getUserColor(id: string): number {
  // 根据 ID 生成稳定颜色
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return hash & 0xffffff
}
```

## 服务端转发

最简单的 WebSocket 服务器（Node.js + ws）：

```ts
import { WebSocketServer } from "ws"

const wss = new WebSocketServer({ port: 8080 })
const clients = new Map<string, WebSocket>()

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2)
  clients.set(id, ws)
  
  // 通知其他人新用户加入
  broadcast({ type: "join", id })
  
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString())
    msg.id = id
    // 转发给其他所有人
    for (const [otherId, otherWs] of clients) {
      if (otherId !== id) {
        otherWs.send(JSON.stringify(msg))
      }
    }
  })
  
  ws.on("close", () => {
    clients.delete(id)
    broadcast({ type: "leave", id })
  })
})

function broadcast(msg: any) {
  const data = JSON.stringify(msg)
  for (const ws of clients.values()) {
    ws.send(data)
  }
}
```

## 差异化传输

不是所有数据都需要每帧同步。分优先级：

| 数据 | 频率 | 重要性 |
|------|------|--------|
| 相机位置 | 20Hz | 高 |
| 相机朝向 | 10Hz | 中 |
| 鼠标点击事件 | 实时 | 高 |
| 当前看的物体 | 1Hz | 低 |

## 带宽优化

- 用 Float32Array 代替 JSON（二进制协议）
- 压缩精度到小数点后 2 位
- 只在位置变化超过阈值时发送

```ts
// 二进制协议
function encodeCameraUpdate(pos: Vector3, target: Vector3): ArrayBuffer {
  const buffer = new ArrayBuffer(25)
  const view = new DataView(buffer)
  view.setUint8(0, 1) // type: camera
  view.setFloat32(1, Math.round(pos.x * 100) / 100)
  view.setFloat32(5, Math.round(pos.y * 100) / 100)
  view.setFloat32(9, Math.round(pos.z * 100) / 100)
  view.setFloat32(13, Math.round(target.x * 100) / 100)
  view.setFloat32(17, Math.round(target.y * 100) / 100)
  view.setFloat32(21, Math.round(target.z * 100) / 100)
  return buffer
}
```

## 练习

### 练习一：用户光标射线

除了同步相机位置，还同步每个用户的鼠标射线方向。在 3D 场景中画出每个用户的射线（Line），可以看到其他人正在看哪个方向。

### 练习二：多人标注

用户可以在 3D 空间中放置标注（点击物体，在该位置创建一个标记）。标注通过 WebSocket 同步给所有用户，每个人都能看到其他人放置的标注。

---

## 参考答案

### 练习一

**思路**：同步 raycaster 的 origin 和 direction。

```ts
// 发送
function sendRay(origin: Vector3, direction: Vector3) {
  ws.send(JSON.stringify({
    type: "ray",
    o: [origin.x, origin.y, origin.z],
    d: [direction.x, direction.y, direction.z],
  }))
}

// 接收后更新射线
function updateRemoteRay(id: string, origin: Vector3, direction: Vector3) {
  let ray = remoteRays.get(id)
  if (!ray) {
    const geo = new BufferGeometry()
    geo.setAttribute("position", new Float32BufferAttribute(new Float32Array(6), 3))
    ray = new Line(geo, new LineBasicMaterial({
      color: getUserColor(id),
      transparent: true,
      opacity: 0.6,
    }))
    scene.add(ray)
    remoteRays.set(id, ray)
  }
  
  const positions = ray.geometry.attributes.position
  positions.setXYZ(0, origin.x, origin.y, origin.z)
  positions.setXYZ(1,
    origin.x + direction.x * 20,
    origin.y + direction.y * 20,
    origin.z + direction.z * 20,
  )
  positions.needsUpdate = true
}
```

### 练习二

**思路**：WebSocket 消息类型扩展为 "annotation"，包含 3D 位置和文字。

```ts
// 放置标注
canvas.addEventListener("dblclick", (e) => {
  const worldPos = getMouseWorldPos(e)
  if (worldPos) {
    ws.send(JSON.stringify({
      type: "annotation",
      pos: [worldPos.x, worldPos.y, worldPos.z],
      text: prompt("输入标注文字") || "标注",
    }))
  }
})

// 接收标注
function handleAnnotation(data: any) {
  const pos = new Vector3(data.pos[0], data.pos[1], data.pos[2])
  const annotation = createAnnotationMarker(pos, data.text, data.id)
  scene.add(annotation)
}

function createAnnotationMarker(pos: Vector3, text: string, userId: string): Group {
  const group = new Group()
  
  // 小球
  const sphere = new Mesh(
    new SphereGeometry(0.15),
    new MeshBasicMaterial({ color: getUserColor(userId) })
  )
  group.add(sphere)
  
  // HTML 标签（用 CSS2DObject）
  const label = new CSS2DObject(createLabelElement(text))
  group.add(label)
  
  group.position.copy(pos)
  return group
}
```

**常见错误**：多人场景中的物体需要全局唯一 ID，否则用户 A 和用户 B 可能创建同 ID 的标注导致冲突。用用户 ID + 时间戳生成唯一 ID。
