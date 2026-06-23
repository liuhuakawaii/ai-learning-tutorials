# 阶段实战：构建完整沉浸式 3D 品牌官网

## 目标

把前 24 课学到的所有技术组合成一个完整的沉浸式 3D 品牌官网。这不是一个 demo——是一个有完整页面结构、视觉叙事、交互逻辑、性能考量的真实产品。

## 页面结构

```
Section 1: Hero（全屏 3D 场景 + 品牌标题）
Section 2: Features（滚动驱动的产品特性展示）
Section 3: Details（材质/颜色配置器）
Section 4: Experience（音频/粒子交互体验）
Section 5: Contact（3D 场景 + HTML 表单）
```

## 技术栈

- Three.js（渲染、材质、后处理）
- GSAP + ScrollTrigger（动画编排、滚动驱动）
- Web Audio API（音频可视化）
- WebSocket（多人在线，可选）
- TypeScript（类型安全）

## Section 1: Hero

全屏 3D 场景，产品模型悬浮旋转。背景是动态天空（Sky），Bloom 让高光处发光。HTML 标题从下方滑入。

```ts
function setupHero() {
  // 场景
  heroScene.background = new Color(0x0a0a1a)
  heroScene.environment = envMap
  
  // 模型
  const product = loadModel("product.glb")
  product.position.y = 0.5
  heroScene.add(product)
  
  // 光照
  const sun = new DirectionalLight(0xffffff, 2)
  sun.position.set(5, 10, 5)
  heroScene.add(sun)
  
  // 后处理
  heroComposer = new EffectComposer(renderer)
  heroComposer.addPass(new RenderPass(heroScene, camera))
  heroComposer.addPass(new UnrealBloomPass(
    new Vector2(innerWidth, innerHeight), 1.0, 0.4, 0.85
  ))
}
```

滚动时相机向产品推进，Bloom 强度增加：

```ts
ScrollTrigger.create({
  trigger: ".hero",
  start: "top top",
  end: "bottom top",
  onUpdate: (self) => {
    camera.position.z = 5 - self.progress * 3
    bloomPass.strength = 1 + self.progress * 2
    product.rotation.y = self.progress * Math.PI
  },
})
```

## Section 2: Features

三个产品特性，每个占 100vh。滚动时 3D 场景在三种状态间切换：

- 特性 1：相机在侧面，展示产品轮廓
- 特性 2：相机在顶部，展示产品结构
- 特性 3：相机在正面，展示材质细节

```ts
const featureCameraPositions = [
  new Vector3(5, 1, 3),
  new Vector3(0, 6, 0),
  new Vector3(0, 0.5, 2),
]

const featureCameraTargets = [
  new Vector3(0, 0.5, 0),
  new Vector3(0, 0, 0),
  new Vector3(0, 0.5, 0),
]

function updateFeatures(progress: number) {
  const idx = Math.min(Math.floor(progress * 3), 2)
  const localP = (progress * 3) % 1
  
  const from = featureCameraPositions[idx]
  const to = featureCameraPositions[Math.min(idx + 1, 2)]
  camera.position.lerpVectors(from, to, localP)
  
  const fromTarget = featureCameraTargets[idx]
  const toTarget = featureCameraTargets[Math.min(idx + 1, 2)]
  const target = new Vector3().lerpVectors(fromTarget, toTarget, localP)
  camera.lookAt(target)
}
```

每个特性旁边有 HTML 文字描述，用 GSAP 控制淡入淡出。

## Section 3: Details

产品配置器——材质、颜色、环境切换。使用第三阶段的技术。

```ts
function setupDetails() {
  // 材质预设
  // 颜色面板
  // 环境切换
  // GSAP 平滑过渡
}
```

## Section 4: Experience

音频可视化 + 粒子交互。用户可以选择播放音乐或使用麦克风。

```ts
function setupExperience() {
  // Web Audio 初始化
  // GPU 粒子系统
  // 频率数据映射到粒子力场
  // 鼠标交互
}
```

## Section 5: Contact

3D 场景作为背景，前景是 HTML 表单。3D 场景是缓慢旋转的产品，加上轻微的粒子效果。

```ts
function setupContact() {
  // 低负载场景
  const contactScene = new Scene()
  contactScene.background = new Color(0x050510)
  contactScene.add(product.clone())
  
  // 少量粒子装饰
  const particleCount = 1000
  // ...
}
```

## 性能策略

```ts
const quality = getQualitySettings()

function getQualitySettings() {
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
  const gpu = renderer.capabilities
  
  return {
    pixelRatio: Math.min(devicePixelRatio, isMobile ? 1.5 : 2),
    shadowMapSize: isMobile ? 512 : 2048,
    particleCount: isMobile ? 50_000 : 500_000,
    postProcessing: !isMobile && gpu.maxTextureSize > 4096,
    bloom: !isMobile,
    reflections: !isMobile,
  }
}
```

每个 section 只在可见时更新，离开视口后暂停：

```ts
const sectionStates = new Map<string, boolean>()

sections.forEach(section => {
  ScrollTrigger.create({
    trigger: section.element,
    start: "top bottom",
    end: "bottom top",
    onEnter: () => sectionStates.set(section.name, true),
    onLeave: () => sectionStates.set(section.name, false),
    onEnterBack: () => sectionStates.set(section.name, true),
    onLeaveBack: () => sectionStates.set(section.name, false),
  })
})

function animate() {
  requestAnimationFrame(animate)
  
  if (sectionStates.get("hero")) updateHero()
  if (sectionStates.get("features")) updateFeatures()
  if (sectionStates.get("details")) updateDetails()
  if (sectionStates.get("experience")) updateExperience()
  if (sectionStates.get("contact")) updateContact()
  
  // 只渲染当前活跃的场景
  activeComposer.render()
}
```

## 资源管理

```ts
class ResourceManager {
  private loaded = new Map<string, any>()
  
  async loadTexture(key: string, url: string): Promise<Texture> {
    if (this.loaded.has(key)) return this.loaded.get(key)
    const texture = await loader.loadAsync(url)
    this.loaded.set(key, texture)
    return texture
  }
  
  dispose(key: string) {
    const resource = this.loaded.get(key)
    if (resource?.dispose) resource.dispose()
    this.loaded.delete(key)
  }
  
  disposeAll() {
    this.loaded.forEach(r => r?.dispose?.())
    this.loaded.clear()
  }
}
```

## 最终效果描述

页面打开，深蓝背景中一个金属质感的产品悬浮在中央，表面反射着环境光，Bloom 让高光微微溢出。品牌名称从下方滑入。

向下滚动，相机围绕产品旋转，从不同角度展示产品。每个角度旁有简洁的 HTML 文字描述产品特性。

继续滚动，出现材质配置器——点击不同的材质按钮，产品表面平滑过渡，从拉丝金属变成陶瓷，再变成木纹。

再滚动，进入音频体验区。播放音乐后，产品周围出现数万个粒子，跟着节奏跳动。粒子被音乐的低频驱动形成脉冲，高频驱动形成光芒。

最后，3D 场景退到背景，一个简洁的联系表单浮现在前景。

整个过程在手机上也能流畅运行——粒子数量自动减少，后处理关闭，但核心的滚动叙事和交互体验保留。

## 练习

### 练习一：添加加载页面

在所有资源加载完成前，显示一个加载进度条。用 `THREE.LoadingManager` 追踪所有资源的加载状态。加载完成后，进度条淡出，页面正式开始。

### 练习二：路由化

用 History API 把 5 个 section 变成 5 个路由（`/`, `/features`, `/details`, `/experience`, `/contact`）。支持直接访问某个 section 的 URL，也支持浏览器的前进/后退。

---

## 参考答案

### 练习一

**思路**：LoadingManager + GSAP 动画。

```ts
const loadingManager = new THREE.LoadingManager()
const progressBar = document.querySelector(".progress-bar")!
const progressText = document.querySelector(".progress-text")!

loadingManager.onProgress = (url, loaded, total) => {
  const progress = loaded / total
  progressBar.style.width = `${progress * 100}%`
  progressText.textContent = `${Math.round(progress * 100)}%`
}

loadingManager.onLoad = () => {
  gsap.to(".loading-screen", {
    opacity: 0,
    duration: 0.8,
    onComplete: () => {
      document.querySelector(".loading-screen")!.remove()
      startExperience()
    },
  })
}

loadingManager.onError = (url) => {
  console.error(`加载失败: ${url}`)
}

const gltfLoader = new GLTFLoader(loadingManager)
const textureLoader = new TextureLoader(loadingManager)
const hdrLoader = new RGBELoader(loadingManager)

// 所有加载器共享同一个 manager
await Promise.all([
  gltfLoader.loadAsync("product.glb"),
  textureLoader.loadAsync("env.hdr"),
])
```

### 练习二

**思路**：ScrollTrigger + History API + popstate 事件。

```ts
const routes = [
  { path: "/", section: "hero" },
  { path: "/features", section: "features" },
  { path: "/details", section: "details" },
  { path: "/experience", section: "experience" },
  { path: "/contact", section: "contact" },
]

// Scroll 更新 URL
let updatingFromPopstate = false

routes.forEach(route => {
  ScrollTrigger.create({
    trigger: `#${route.section}`,
    start: "top center",
    end: "bottom center",
    onEnter: () => {
      if (!updatingFromPopstate) {
        history.pushState(null, "", route.path)
      }
    },
    onEnterBack: () => {
      if (!updatingFromPopstate) {
        history.pushState(null, "", route.path)
      }
    },
  })
})

// 浏览器前进/后退
window.addEventListener("popstate", () => {
  const route = routes.find(r => r.path === location.pathname)
  if (route) {
    updatingFromPopstate = true
    const el = document.getElementById(route.section)!
    gsap.to(window, {
      scrollTo: el,
      duration: 1,
      ease: "power2.inOut",
      onComplete: () => { updatingFromPopstate = false },
    })
  }
})

// 直接访问某个路由
const initialRoute = routes.find(r => r.path === location.pathname)
if (initialRoute && initialRoute.path !== "/") {
  setTimeout(() => {
    document.getElementById(initialRoute.section)?.scrollIntoView()
  }, 100)
}
```

**常见错误**：ScrollTrigger 的 `onEnter` 和 `onEnterBack` 会在滚动到边界时触发。如果用户快速滚动，可能在一次滚动中触发多个 route 的 `onEnter`，导致 URL 快速跳变。用 `updatingFromPopstate` 标志避免循环触发。
