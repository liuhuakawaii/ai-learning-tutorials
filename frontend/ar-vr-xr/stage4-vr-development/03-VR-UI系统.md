# VR UI 系统

## 场景引入

你在 VR 中打开一个菜单，文字模糊得像隔着毛玻璃。伸手去按按钮，手穿过了面板。菜单悬浮在眼前，转头时它跟着你转，像甩不掉的膏药。

这些都是 VR UI 的经典反模式。VR UI 不是把 2D 界面贴到 3D 空间——它需要考虑空间定位、可读性、交互方式和用户舒适度。本课将教你构建一套专业的 World-Space UI 系统。

## 学习目标

- 理解 World-Space UI 与传统 2D UI 的本质区别
- 设计适合 VR 的面板布局系统
- 解决 VR 中的字体渲染和可读性问题
- 实现叙事性 UI（Diegetic UI）

## World-Space UI 基础

传统 UI 渲染在屏幕空间，VR 中 UI 必须存在于 3D 世界中：

```typescript
class WorldSpacePanel {
  private mesh: THREE.Mesh
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private texture: THREE.CanvasTexture

  constructor(width: number, height: number, private resolution: number = 1024) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = resolution
    this.canvas.height = Math.round(resolution * (height / width))
    this.ctx = this.canvas.getContext('2d')!

    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter

    const mat = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, side: THREE.DoubleSide })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat)
    this.mesh.userData.isUI = true
  }

  getContent(): THREE.Mesh { return this.mesh }

  updateTexture(drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
    drawFn(this.ctx, this.canvas.width, this.canvas.height)
    this.texture.needsUpdate = true
  }
}
```

### 面板布局系统

最佳 UI 区域是水平 ±30°、垂直 ±15° 的锥形区域：

```typescript
class PanelLayout {
  private panels = new Map<string, WorldSpacePanel>()
  private container = new THREE.Group()

  addPanel(id: string, panel: WorldSpacePanel, position: 'center' | 'left' | 'right' | 'above', distance = 1.5) {
    this.panels.set(id, panel)
    const mesh = panel.getContent()
    const offsets: Record<string, THREE.Vector3> = {
      center: new THREE.Vector3(0, 0, -distance),
      left:   new THREE.Vector3(-0.6, 0, -distance),
      right:  new THREE.Vector3(0.6, 0, -distance),
      above:  new THREE.Vector3(0, 0.4, -distance)
    }
    mesh.position.copy(offsets[position])
    this.container.add(mesh)
  }

  update(camera: THREE.Camera) {
    const cameraPos = new THREE.Vector3()
    camera.getWorldPosition(cameraPos)
    this.panels.forEach(panel => {
      const mesh = panel.getContent()
      const target = cameraPos.clone(); target.y = mesh.position.y
      mesh.lookAt(target)
    })
  }

  getContainer(): THREE.Group { return this.container }
}
```

## 字体渲染

VR 中像素密度远低于显示器，小字会模糊。字体大小应用物理单位（米）而非像素：

```typescript
function calculateVRFontSize(
  panelWidth: number, panelResolution: number, desiredHeightCm: number, viewingDistance: number
): number {
  const pixelsPerMeter = panelResolution / panelWidth
  const desiredHeightMeters = desiredHeightCm / 100
  const distanceFactor = viewingDistance / 1.5
  return Math.round(desiredHeightMeters * pixelsPerMeter * distanceFactor)
}

class VRTextRenderer {
  private static FONT_SIZES = { title: 48, subtitle: 36, body: 28, caption: 22 }

  static renderText(
    ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
    size: keyof typeof VRTextRenderer.FONT_SIZES, color = '#ffffff'
  ) {
    const fontSize = VRTextRenderer.FONT_SIZES[size]
    ctx.save()
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.lineWidth = fontSize * 0.08
    ctx.lineJoin = 'round'
    ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.textBaseline = 'top'
    ctx.strokeText(text, x, y)
    ctx.fillStyle = color
    ctx.fillText(text, x, y)
    ctx.restore()
  }
}
```

## 交互式按钮

```typescript
class VRButton {
  private mesh: THREE.Mesh
  private isHovered = false
  private isPressed = false
  private callbacks: (() => void)[] = []

  constructor(label: string, width = 0.3, height = 0.08) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3366ff, roughness: 0.3, metalness: 0.1 })
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.02), mat)
    this.mesh.userData.isButton = true

    const labelPanel = new WorldSpacePanel(width, height, 256)
    labelPanel.updateTexture((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 36px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(label, w / 2, h / 2)
    })
    labelPanel.getContent().position.z = 0.011
    this.mesh.add(labelPanel.getContent())
  }

  onActivate(callback: () => void) { this.callbacks.push(callback) }

  onHover() {
    if (this.isHovered) return
    this.isHovered = true
    ;(this.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x222222)
    this.mesh.scale.setScalar(1.05)
  }

  onUnhover() {
    this.isHovered = false
    ;(this.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000)
    this.mesh.scale.setScalar(1.0)
  }

  onPress() { this.isPressed = true; this.mesh.position.z -= 0.005 }

  onRelease() {
    if (!this.isPressed) return
    this.isPressed = false; this.mesh.position.z += 0.005
    this.callbacks.forEach(cb => cb())
  }

  getMesh(): THREE.Mesh { return this.mesh }
}
```

## 叙事性 UI（Diegetic UI）

叙事性 UI 是 VR 最高级的 UI 形式——界面元素本身就是场景的一部分：

```typescript
class DiegeticPhone {
  private phone: THREE.Group
  private screen: WorldSpacePanel
  private isOpen = false

  constructor(private scene: THREE.Scene) {
    this.phone = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.15, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.8 })
    )
    this.phone.add(body)

    this.screen = new WorldSpacePanel(0.07, 0.13, 512)
    this.screen.getContent().position.z = 0.006
    this.phone.add(this.screen.getContent())
    this.phone.visible = false
    scene.add(this.phone)
  }

  toggle() {
    this.isOpen = !this.isOpen
    this.phone.visible = this.isOpen
    if (this.isOpen) this.renderMenu()
  }

  update(controllerPos: THREE.Vector3, controllerQuat: THREE.Quaternion) {
    if (!this.isOpen) return
    this.phone.position.copy(controllerPos)
    this.phone.quaternion.copy(controllerQuat)
    this.phone.rotateX(-Math.PI / 6)
  }

  private renderMenu() {
    this.screen.updateTexture((ctx, w, h) => {
      ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, w, h)
      VRTextRenderer.renderText(ctx, '设置', 24, 24, 'title')
      const items = ['移动方式', '舒适度', '音频', '网络', '退出']
      items.forEach((item, i) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
        ctx.fillRect(24, 100 + i * 70, w - 48, 56)
        VRTextRenderer.renderText(ctx, item, 40, 114 + i * 70, 'body')
      })
    })
  }
}
```

### 叙事性 UI 设计原则

1. **物理一致性**：UI 元素必须遵循物理世界规则（平板放在桌上，不悬浮）
2. **空间锚定**：UI 应锚定在场景中的合理位置（控制台固定在墙上）
3. **上下文相关**：驾驶时显示车载仪表，维修时显示工具箱

## 常见误区

1. **直接移植 2D 界面**：VR 需要更大按钮（≥2cm）、更少层级、更简洁布局
2. **UI 跟随头部运动**：Head-Locked UI 会导致不适，应使用 Soft Follow 或固定
3. **忽视文字可读性**：VR 中所有交互文字必须在 1.5 米距离内清晰可读
4. **过度使用 3D UI**：设置面板用平面更高效，只有场景相关 UI 才需 3D 叙事性设计

## 工程建议

1. **分辨率策略**：面板纹理至少 1024×1024，文字密集面板用 2048
2. **交互距离**：面板放在 1-2 米处
3. **对比度**：文字与背景对比度至少 4.5:1，VR 中建议 7:1
4. **渲染优化**：UI 面板用 `MeshBasicMaterial`（不受光照影响）

## 小结

VR UI 系统的核心是把界面"放入"3D 世界。本课介绍了：

- **World-Space Panel**：基于 Canvas 纹理的 3D 面板
- **字体渲染**：基于物理尺寸的字号计算，描边增强可读性
- **交互按钮**：支持射线指向和物理接触
- **叙事性 UI**：将界面元素融入场景，提升沉浸感

好的 VR UI 应该是隐形的——用户专注于任务，而不是寻找按钮。

## 练习

### 练习一：实现滚动列表

在 World-Space Panel 上实现可滚动列表。支持手柄摇杆滚动、惯性滚动、滚动条显示。

### 练习二：设计叙事性 HUD

为 VR 驾驶场景设计叙事性 HUD。将速度、方向、警告集成到载具仪表盘中。

---

## 参考答案

### 练习一

**思路**：用 Canvas 裁剪区域模拟滚动视口，摇杆控制偏移，松手后惯性衰减。

```typescript
class VRScrollList {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private texture: THREE.CanvasTexture
  private scrollY = 0
  private velocity = 0
  private items: { label: string }[] = []
  private itemHeight = 60

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 1024
    this.canvas.height = Math.round(1024 * (height / width))
    this.ctx = this.canvas.getContext('2d')!
    this.texture = new THREE.CanvasTexture(this.canvas)
  }

  setItems(items: { label: string }[]) { this.items = items; this.scrollY = 0; this.render() }
  scroll(delta: number) { this.velocity = delta * 500 }

  update(dt: number) {
    this.velocity *= 0.92
    this.scrollY += this.velocity * dt
    this.scrollY = Math.max(0, Math.min(this.scrollY, this.items.length * this.itemHeight - this.canvas.height))
    if (Math.abs(this.velocity) > 0.5) this.render()
  }

  private render() {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(20, 20, 30, 0.95)'; ctx.fillRect(0, 0, w, h)
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip()
    const start = Math.floor(this.scrollY / this.itemHeight)
    const end = Math.min(start + Math.ceil(h / this.itemHeight) + 1, this.items.length)
    for (let i = start; i < end; i++) {
      const y = i * this.itemHeight - this.scrollY
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'
      ctx.fillRect(8, y, w - 16, this.itemHeight)
      ctx.fillStyle = '#ffffff'; ctx.font = '24px sans-serif'; ctx.textBaseline = 'middle'
      ctx.fillText(this.items[i].label, 24, y + this.itemHeight / 2)
    }
    ctx.restore(); this.texture.needsUpdate = true
  }
}
```

### 练习二

**思路**：将 HUD 信息集成到载具 3D 模型的仪表盘位置。速度用圆形仪表盘。

```typescript
class DiegeticVehicleHUD {
  private speedGauge: WorldSpacePanel

  constructor(vehicle: THREE.Group) {
    this.speedGauge = new WorldSpacePanel(0.12, 0.12, 512)
    this.speedGauge.getContent().position.set(0, 0.85, -0.4)
    vehicle.add(this.speedGauge.getContent())
  }

  update(speed: number) {
    this.speedGauge.updateTexture((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2, cy = h / 2, r = w * 0.4
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 8
      ctx.beginPath(); ctx.arc(cx, cy, r, 0.75 * Math.PI, 2.25 * Math.PI); ctx.stroke()
      const angle = 0.75 * Math.PI + (speed / 200) * 1.5 * Math.PI
      ctx.strokeStyle = speed > 120 ? '#ff4444' : '#00cc66'; ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * r * 0.8, cy + Math.sin(angle) * r * 0.8)
      ctx.stroke()
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(speed.toFixed(0), cx, cy + 15)
    })
  }
}
```
