# 阶段实战：WebXR AR 产品展示——从"能看"到"能交互"

## 当前项目状态

你已经会创建 XR 会话、渲染 3D 物体。但用户还只能看，不能和虚拟物体交互。本课要构建的是一个完整的 AR 产品展示应用：用户通过手机摄像头在真实环境中放置虚拟家具，可以旋转、缩放、移动。

这个场景在电商领域有真实需求——IKEA Place 就是这类应用。

## 核心交互流程

```
1. 用户打开应用，摄像头画面作为背景
2. 屏幕中心显示一个准星
3. 准星检测到地面时，显示半透明的产品预览
4. 用户点击屏幕，产品"放置"到地面
5. 用户可以拖拽移动、双指旋转、捏合缩放
6. 产品位置通过锚点固定，用户走开再回来位置不变
```

## 命中检测（Hit Test）

命中检测是 AR 交互的基础——它告诉你"准星指向的地方在真实世界中是什么"：

```typescript
class HitTestManager {
  private hitTestSource: XRHitTestSource | null = null

  async init(session: XRSession, refSpace: XRReferenceSpace) {
    this.hitTestSource = await session.requestHitTestSource({
      space: refSpace,
      entityTypes: ['plane', 'point'] // 检测平面和特征点
    })
  }

  getHit(frame: XRFrame, refSpace: XRReferenceSpace): XRPose | null {
    if (!this.hitTestSource) return null
    const results = frame.getHitTestResults(this.hitTestSource)
    if (results.length === 0) return null
    return results[0].getPose(refSpace)
  }

  dispose() {
    this.hitTestSource?.cancel()
  }
}
```

## 锚点系统

用户放置产品后，产品位置需要固定在真实世界中。锚点（Anchor）就是干这个的：

```typescript
class AnchorManager {
  private anchors: Map<string, XRAnchor> = new Map()

  async createAnchor(frame: XRFrame, pose: XRPose): Promise<string> {
    const anchor = await frame.createAnchor(pose, frame.session.inputSources[0]?.targetRaySpace)
    const id = `anchor_${Date.now()}`
    this.anchors.set(id, anchor)
    return id
  }

  getAnchorPose(id: string, frame: XRFrame, refSpace: XRReferenceSpace): XRPose | null {
    const anchor = this.anchors.get(id)
    if (!anchor) return null
    return anchor.anchorSpace ? frame.getPose(anchor.anchorSpace, refSpace) : null
  }
}
```

## 交互系统

用户需要拖拽、旋转、缩放产品。关键是把手势映射到 3D 变换：

```typescript
class InteractionSystem {
  private selectedObject: THREE.Object3D | null = null
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private intersectPoint = new THREE.Vector3()

  constructor(private renderer: THREE.WebGLRenderer,
              private camera: THREE.Camera,
              private hitTest: HitTestManager) {}

  // 单指拖拽：移动物体
  handleDrag(screenX: number, screenY: number, frame: XRFrame, refSpace: XRReferenceSpace) {
    if (!this.selectedObject) return

    const pose = this.hitTest.getHit(frame, refSpace)
    if (pose) {
      const pos = pose.transform.position
      this.selectedObject.position.set(pos.x, pos.y, pos.z)
    }
  }

  // 双指旋转
  handleRotate(angle: number) {
    if (!this.selectedObject) return
    this.selectedObject.rotation.y += angle
  }

  // 捏合缩放
  handleScale(scale: number) {
    if (!this.selectedObject) return
    const s = THREE.MathUtils.clamp(scale, 0.5, 3)
    this.selectedObject.scale.setScalar(s)
  }
}
```

## 产品放置

```typescript
async function placeProduct(
  scene: THREE.Scene,
  model: THREE.Object3D,
  pose: XRPose,
  anchorManager: AnchorManager,
  frame: XRFrame
) {
  const clone = model.clone()
  const pos = pose.transform.position
  const orient = pose.transform.orientation

  clone.position.set(pos.x, pos.y, pos.z)
  clone.quaternion.set(orient.x, orient.y, orient.z, orient.w)
  scene.add(clone)

  // 创建锚点锁定位置
  const anchorId = await anchorManager.createAnchor(frame, pose)
  clone.userData.anchorId = anchorId

  return clone
}
```

## 完整应用入口

```typescript
async function main() {
  const container = document.getElementById('app')!
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.xr.enabled = true
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()

  // 加载产品模型
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync('/models/chair.glb')
  const productModel = gltf.scene
  productModel.visible = false // 预览时半透明

  // 初始化子系统
  const hitTest = new HitTestManager()
  const anchorManager = new AnchorManager()
  const interaction = new InteractionSystem(renderer, camera, hitTest)

  // 进入 AR
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test', 'local-floor'],
    optionalFeatures: ['anchors', 'hand-tracking']
  })

  renderer.xr.setSession(session)
  const refSpace = await session.requestReferenceSpace('local-floor')
  await hitTest.init(session, refSpace)

  // 渲染循环
  renderer.setAnimationLoop((time, frame) => {
    const pose = hitTest.getHit(frame, refSpace)

    // 准星跟随命中点
    if (pose) {
      const pos = pose.transform.position
      reticle.position.set(pos.x, pos.y, pos.z)
      reticle.visible = true
      productModel.position.copy(reticle.position)
      productModel.visible = true
    } else {
      reticle.visible = false
      productModel.visible = false
    }

    renderer.render(scene, camera)
  })
}
```

## 你可能踩的坑

**坑一：命中检测没有平面结果**

`entityTypes` 如果只写 `['plane']`，在没有检测到平面的环境中（比如户外草地）会返回空。加上 `'point'` 可以回退到特征点检测。

**坑二：锚点不持久**

WebXR 的锚点只在当前会话内有效。关闭应用后锚点丢失。需要持久化方案（如保存锚点的语义描述，下次用时重新定位）。

**坑三：模型太大或太小**

3D 模型的单位需要和真实世界一致。一个椅子模型如果建模时用的是厘米，放到 AR 中会变成巨人椅。导入前检查模型的单位。

## 练习

### 练习一：多产品切换

在现有代码基础上，添加 3 个不同的产品模型（椅子、桌子、台灯）。在 UI 上添加产品选择按钮，点击后切换当前要放置的产品。

### 练习二：放置历史

实现一个放置记录列表，显示所有已放置的产品。点击列表中的项目，相机自动对准该产品位置（用 `tween` 平滑过渡）。

---

## 参考答案

### 练习一

```typescript
const products = {
  chair: await loadModel('/models/chair.glb'),
  table: await loadModel('/models/table.glb'),
  lamp: await loadModel('/models/lamp.glb')
}
let currentProduct = 'chair'

document.querySelectorAll('.product-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentProduct = btn.dataset.product
    // 更新预览模型
    previewModel.children.forEach(c => c.visible = false)
    previewModel.getObjectByName(currentProduct)!.visible = true
  })
})
```

### 练习二

```typescript
interface PlacedItem {
  id: string
  product: string
  position: THREE.Vector3
  object: THREE.Object3D
}

const placedItems: PlacedItem[] = []

function addToHistory(item: PlacedItem) {
  placedItems.push(item)
  renderHistoryList()
}

function renderHistoryList() {
  const list = document.getElementById('history')!
  list.innerHTML = placedItems.map(item => `
    <div class="history-item" data-id="${item.id}">
      ${item.product} @ (${item.position.x.toFixed(1)}, ${item.position.z.toFixed(1)})
    </div>
  `).join('')

  list.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const item = placedItems.find(i => i.id === el.dataset.id)
      if (item) focusOnObject(item.object)
    })
  })
}

function focusOnObject(obj: THREE.Object3D) {
  // 用 tween 平滑移动相机到物体位置
  const target = obj.position.clone()
  target.y += 1.5 // 眼睛高度
  target.z += 1   // 后退 1 米
  // ... tween 动画
}
```
