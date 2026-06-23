# 交互式 3D 故事——多场景切换、转场动画

## 一个场景不够

前面的课程大多在一个场景里做动画。但真实的沉浸式网站——比如品牌官网、产品发布会——需要**多个场景之间的切换**。

Nike 的官网可能先展示跑步鞋的特写，然后切换到运动员在跑步的全景，再切到鞋底技术的拆解图。每个场景是独立的 3D 世界，转场是连接它们的桥梁。

## 场景管理架构

```ts
interface Scene3D {
  scene: Scene
  camera: PerspectiveCamera
  setup(): void       // 进入时初始化
  update(progress: number): void
  teardown(): void    // 离开时清理
}

class SceneManager {
  private scenes: Map<string, Scene3D> = new Map()
  private current: string = ""
  
  register(name: string, scene: Scene3D) {
    this.scenes.set(name, scene)
  }
  
  switchTo(name: string) {
    if (this.current) {
      this.scenes.get(this.current)?.teardown()
    }
    this.current = name
    this.scenes.get(name)?.setup()
  }
  
  update(progress: number) {
    this.scenes.get(this.current)?.update(progress)
  }
}
```

## 场景定义示例

```ts
const heroScene: Scene3D = {
  scene: new Scene(),
  camera: new PerspectiveCamera(50, aspect, 0.1, 100),
  
  setup() {
    this.scene.background = new Color(0x0a0a1a)
    const model = loadModel("product.glb")
    this.scene.add(model)
    this.camera.position.set(0, 1, 5)
  },
  
  update(progress: number) {
    // 内部滚动动画
    const model = this.scene.children[0]
    model.rotation.y = progress * Math.PI * 2
    this.camera.position.z = 5 - progress * 2
  },
  
  teardown() {
    // 清理 GPU 资源
    this.scene.traverse(child => {
      if (child instanceof Mesh) {
        child.geometry.dispose()
        child.material.dispose()
      }
    })
  },
}
```

## 转场方式

### 硬切

直接切换，没有过渡。简单但生硬。

```ts
function hardCut(from: Scene3D, to: Scene3D) {
  from.teardown()
  to.setup()
  // 下一帧直接渲染 to
}
```

### 淡入淡出

从 A 场景淡出到黑，再从黑淡入到 B：

```ts
function fadeTransition(from: Scene3D, to: Scene3D, duration: number) {
  const overlay = document.querySelector(".fade-overlay") as HTMLElement
  
  gsap.timeline()
    .to(overlay, { opacity: 1, duration: duration / 2 })
    .call(() => {
      from.teardown()
      to.setup()
    })
    .to(overlay, { opacity: 0, duration: duration / 2 })
}
```

### 相机飞越

最酷的转场——相机从 A 场景飞入 B 场景：

```ts
function cameraTransition(from: Scene3D, to: Scene3D) {
  // 在转场过程中，两个场景同时存在
  const transitionScene = new Scene()
  transitionScene.add(from.scene)
  transitionScene.add(to.scene)
  
  // 相机从 A 的位置飞到 B 的位置
  gsap.to(transitionCamera.position, {
    x: to.camera.position.x,
    y: to.camera.position.y,
    z: to.camera.position.z,
    duration: 2,
    ease: "power2.inOut",
  })
}
```

### 几何体变形转场

用一个全屏的几何体（球体或平面）做遮罩，膨胀后包裹整个画面：

```ts
const transitionSphere = new Mesh(
  new SphereGeometry(0.1, 64, 64),
  new MeshBasicMaterial({ color: 0x000000, side: BackSide })
)

function sphereTransition(from: Scene3D, to: Scene3D) {
  from.scene.add(transitionSphere)
  
  gsap.timeline()
    .to(transitionSphere.scale, {
      x: 100, y: 100, z: 100,
      duration: 1,
      ease: "power2.in",
    })
    .call(() => {
      from.teardown()
      to.setup()
      to.scene.add(transitionSphere)
    })
    .from(transitionSphere.scale, {
      x: 100, y: 100, z: 100,
      duration: 1,
      ease: "power2.out",
    })
}
```

## 场景间的共享状态

有些数据需要跨场景共享——比如相机位置的平滑过渡：

```ts
class SharedState {
  cameraPosition = new Vector3()
  cameraTarget = new Vector3()
  scrollProgress = 0
  mousePosition = new Vector2()
}

const shared = new SharedState()

// 每个场景在 update 中可以读写 shared
```

## 滚动驱动的场景切换

把页面分成 N 段，每段对应一个场景：

```ts
const sceneNames = ["hero", "features", "details", "cta"]

ScrollTrigger.create({
  trigger: ".wrapper",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    const p = self.progress
    const sceneIndex = Math.floor(p * sceneNames.length)
    const localProgress = (p * sceneNames.length) % 1
    
    const currentSceneName = sceneNames[Math.min(sceneIndex, sceneNames.length - 1)]
    
    if (currentSceneName !== manager.current) {
      manager.switchTo(currentSceneName)
    }
    
    manager.update(localProgress)
  },
})
```

## 练习

### 练习一：三场景转场

实现三个场景：一个球体场景、一个立方体场景、一个环面场景。用淡入淡出转场，滚动到每段边界时自动触发。每个场景内部有自己的旋转和光照动画。

### 练习二：相机飞越转场

两个场景之间用相机飞越做转场。A 场景中相机从远处看到全景，然后飞向一个"隧道"（几何体），穿过隧道后进入 B 场景。隧道是一个圆柱体，相机从圆柱体的一端飞到另一端。

---

## 参考答案

### 练习一

**思路**：三个独立场景对象 + 统一的渲染循环 + ScrollTrigger 驱动切换。

```ts
const scenes = [
  createScene("sphere", new SphereGeometry(1, 64, 64)),
  createScene("cube", new BoxGeometry(1.5, 1.5, 1.5)),
  createScene("torus", new TorusGeometry(1, 0.4, 32, 64)),
]

function createScene(name: string, geometry: BufferGeometry) {
  const scene = new Scene()
  scene.background = new Color(0x0a0a1a)
  
  const mesh = new Mesh(geometry, new MeshPhysicalMaterial({
    color: 0x4488ff,
    metalness: 0.8,
    roughness: 0.2,
  }))
  scene.add(mesh)
  
  const light = new DirectionalLight(0xffffff, 1)
  light.position.set(5, 5, 5)
  scene.add(light)
  
  return { scene, mesh }
}

let currentSceneIdx = 0
const overlay = document.querySelector(".fade-overlay")!

ScrollTrigger.create({
  trigger: ".wrapper",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    const idx = Math.floor(self.progress * 3)
    if (idx !== currentSceneIdx && idx < 3) {
      fadeToScene(idx)
      currentSceneIdx = idx
    }
    
    // 当前场景的内部动画
    const localP = (self.progress * 3) % 1
    scenes[currentSceneIdx].mesh.rotation.y = localP * Math.PI * 2
  },
})

function fadeToScene(idx: number) {
  gsap.timeline()
    .to(overlay, { opacity: 1, duration: 0.3 })
    .call(() => { currentSceneIdx = idx })
    .to(overlay, { opacity: 0, duration: 0.3 })
}
```

### 练习二

**思路**：转场时同时渲染两个场景，相机穿过圆柱体几何体。

```ts
const tunnel = new Mesh(
  new CylinderGeometry(2, 2, 20, 32, 1, true), // open-ended
  new MeshBasicMaterial({
    color: 0x111122,
    side: BackSide,
    transparent: true,
    opacity: 0.8,
  })
)

function cameraFlyTransition(from: Scene3D, to: Scene3D) {
  // 隧道放在两个场景之间
  from.scene.add(tunnel)
  tunnel.position.copy(from.camera.position)
  tunnel.lookAt(to.camera.position)
  
  const tl = gsap.timeline()
  
  // 相机飞入隧道
  tl.to(mainCamera.position, {
    z: mainCamera.position.z - 10,
    duration: 1,
    ease: "power2.in",
  })
  
  // 在隧道中间切换场景
  tl.call(() => {
    from.scene.remove(tunnel)
    to.scene.add(tunnel)
    // 调整隧道位置使相机在另一端
    tunnel.position.copy(to.camera.position)
    tunnel.position.z += 10
  })
  
  // 相机飞出隧道
  tl.to(mainCamera.position, {
    z: to.camera.position.z,
    duration: 1,
    ease: "power2.out",
  })
}
```

**常见错误**：转场期间如果两个场景都渲染，要注意清除深度缓冲区。否则 A 场景的深度会挡住 B 场景。在渲染 B 之前调用 `renderer.clearDepth()`。
