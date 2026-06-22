# Three.js 动画基础：关键帧、骨骼与变形

## 场景引入

在前端动效开发中，CSS 动画和 GSAP 能解决大部分二维交互需求。但当产品需要展示一个可旋转的 3D 模型、骨骼驱动的角色动画、或者顶点级别的网格变形时，我们必须进入 WebGL 的世界。Three.js 是目前最成熟的 WebGL 抽象库，它将 GPU 渲染管线封装成开发者可理解的 API，同时保留了底层控制能力。

本课从一个真实需求出发：设计师交付了一个 glTF 格式的产品模型，需要在网页上播放开箱动画——盖子旋转打开、内部零件依次弹出、材质渐变发光。这个需求涉及 Three.js 的三大动画系统：关键帧动画（KeyframeTrack）、骨骼动画（SkinnedMesh）、变形目标（Morph Targets）。

## 学习目标

1. 理解 Three.js 动画系统的架构：AnimationMixer、AnimationClip、AnimationAction
2. 掌握关键帧动画的创建与控制方式
3. 了解骨骼动画（SkinnedMesh）的工作原理与应用场景
4. 掌握变形目标（Morph Targets）的实现与混合
5. 学会加载和控制 glTF 模型中的动画数据
6. 理解动画系统的性能瓶颈与优化策略

## 核心架构：AnimationMixer 与 AnimationClip

### 三层架构总览

Three.js 的动画系统可以类比为一个"视频播放器"：

- **AnimationClip** = 视频文件：一段完整的动画数据，包含多条时间轴（Track）。每个 Clip 通常对应一个独立的动作，比如"行走""跑步""跳跃"。
- **AnimationMixer** = 播放引擎：负责管理多个 Action 的播放、混合、过渡。一个场景通常只需要一个 Mixer，它挂载在需要动画化的根对象上。
- **AnimationAction** = 播放实例：Clip 的运行时状态。同一个 Clip 可以创建多个 Action，各自拥有独立的播放进度、速度、权重。

理解这三者的关系是掌握 Three.js 动画的关键。Clip 是静态数据，Action 是动态状态，Mixer 是调度中心。

### 基础播放流程

```javascript
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100)
camera.position.set(0, 2, 5)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
document.body.appendChild(renderer.domElement)

const mixer = new THREE.AnimationMixer(null)
const clock = new THREE.Clock()

new GLTFLoader().load('/models/product-box.glb', (gltf) => {
  scene.add(gltf.scene)
  mixer.setRoot(gltf.scene)
  gltf.animations.forEach((clip) => {
    const action = mixer.clipAction(clip)
    action.setLoop(THREE.LoopOnce)
    action.clampWhenFinished = true
    action.play()
  })
})

function animate() {
  requestAnimationFrame(animate)
  mixer.update(clock.getDelta())
  renderer.render(scene, camera)
}
animate()
```

关键点：`mixer.update(delta)` 必须在每帧调用，delta 来自 `clock.getDelta()`，确保动画与帧率解耦。如果传入固定值（如 `mixer.update(0.016)`），动画速度会与渲染帧率绑定，在高刷屏上播放速度异常。

### AnimationAction 的核心属性

AnimationAction 控制单个动画实例的行为，理解其属性是实现精细控制的前提：

| 属性 | 作用 | 默认值 |
|------|------|--------|
| `time` | 当前播放位置（秒） | 0 |
| `timeScale` | 播放速度倍率，负值可倒放 | 1 |
| `weight` | 混合权重，0 = 不可见，1 = 完全生效 | 1 |
| `paused` | 暂停/恢复 | false |
| `enabled` | 是否参与混合计算 | true |
| `loop` | 循环模式：LoopOnce / LoopRepeat / LoopPingPong | LoopRepeat |
| `clampWhenFinished` | 播放结束后是否停留在最后一帧 | false |
| `zeroSlopeAtEnd` | 末尾是否平滑过渡（避免突变） | true |

```javascript
const action = mixer.clipAction(clip)
action.setLoop(THREE.LoopRepeat)     // 循环播放
action.timeScale = 2                  // 2 倍速
action.weight = 0.5                   // 半透明混合
action.play()

// 暂停与恢复
action.paused = true
action.paused = false

// 倒放
action.timeScale = -1
action.time = action.getClip().duration  // 从末尾开始
```

## 关键帧动画：KeyframeTrack

### 概念理解

KeyframeTrack 是 Three.js 动画系统的"原子单位"。每条 Track 负责控制对象的一个属性在时间轴上的变化。可以把 Track 想象成一根拉直的绳子，绳子上挂着若干夹子（关键帧），每个夹子标记了"在这个时刻，属性应该是什么值"。引擎会在夹子之间自动插值，生成平滑的过渡。

当 glTF 文件不包含动画数据，或需要程序化创建动画时，使用 KeyframeTrack 手动构建。

### 轨道类型速查

| 轨道类 | 插值方式 | 典型用途 | 值的格式 |
|--------|---------|---------|---------|
| VectorKeyframeTrack | 线性/三次 | 位置、缩放 | 每帧 3 个值 (x, y, z) |
| QuaternionKeyframeTrack | 球面线性 (SLERP) | 旋转 | 每帧 4 个值 (x, y, z, w) |
| NumberKeyframeTrack | 线性 | 透明度、Morph 权重、自定义 uniform | 每帧 1 个值 |
| ColorKeyframeTrack | 线性 | 颜色过渡 | 每帧 3 个值 (r, g, b) |
| BooleanKeyframeTrack | 阶梯 | 开关状态 | 每帧 1 个值 (0 或 1) |
| StringKeyframeTrack | 阶梯 | 文本切换 | 每帧 1 个字符串 |

### 基础示例：位置 + 旋转动画

```javascript
const box = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x4a90d9 })
)
scene.add(box)

// 位置轨道：立方体沿三角形路径移动
// 时间点：0s → 1s → 2s → 3s
// 位置：原点 → 右前方 → 右后方 → 回到原点
const positionTrack = new THREE.VectorKeyframeTrack(
  '.position',
  [0, 1, 2, 3],                                          // 时间数组
  [0, 0, 0,  2, 3, 0,  2, 3, -2,  0, 0, 0]              // 对应的 xyz 值
)

// 旋转轨道：使用四元数避免万向锁
const rotationTrack = new THREE.QuaternionKeyframeTrack(
  '.quaternion',
  [0, 1.5, 3],                                            // 时间点
  [
    ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
    ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)).toArray(),
    ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI * 2, 0)).toArray()
  ]
)

// 将两条轨道组合成一个 Clip
const clip = new THREE.AnimationClip('orbit', 3, [positionTrack, rotationTrack])
const mixer = new THREE.AnimationMixer(box)
mixer.clipAction(clip).setLoop(THREE.LoopRepeat).play()
```

时间数组和值数组的对应关系是初学者最容易混淆的地方。时间数组的长度决定了关键帧数量 N，值数组的长度 = N × 每帧分量数。对于 VectorKeyframeTrack，每个关键帧有 3 个分量 (x, y, z)，所以 4 个关键帧需要 12 个值。

### 进阶示例：颜色渐变与透明度动画

```javascript
const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 32),
  new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true })
)
scene.add(sphere)

// 颜色轨道：红 → 绿 → 蓝 → 红
const colorTrack = new THREE.ColorKeyframeTrack(
  '.material.color',
  [0, 1, 2, 3],
  [1, 0, 0,  0, 1, 0,  0, 0, 1,  1, 0, 0]
)

// 透明度轨道：不透明 → 半透明 → 不透明
const opacityTrack = new THREE.NumberKeyframeTrack(
  '.material.opacity',
  [0, 1.5, 3],
  [1, 0.3, 1]
)

const clip = new THREE.AnimationClip('color-shift', 3, [colorTrack, opacityTrack])
const mixer = new THREE.AnimationMixer(sphere)
mixer.clipAction(clip).setLoop(THREE.LoopRepeat).play()
```

注意 `.material.color` 和 `.material.opacity` 这样的属性路径——Three.js 使用点号分隔的路径字符串来定位要动画化的属性。路径必须精确匹配对象的属性链，否则 Track 不会生效且不会报错。

### 进阶示例：缩放弹性动画

```javascript
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xf39c12 })
)
scene.add(cube)

// 缩放轨道：模拟呼吸效果（放大 → 缩小 → 放大）
const scaleTrack = new THREE.VectorKeyframeTrack(
  '.scale',
  [0, 0.8, 1.6, 2.4],
  [1, 1, 1,  1.2, 0.9, 1.2,  0.95, 1.05, 0.95,  1, 1, 1]
)

// 使用自定义插值曲线实现弹性效果
scaleTrack.setInterpolation(THREE.InterpolateSmooth)

const clip = new THREE.AnimationClip('breath', 2.4, [scaleTrack])
const mixer = new THREE.AnimationMixer(cube)
mixer.clipAction(clip).setLoop(THREE.LoopRepeat).play()
```

Three.js 支持四种插值模式：
- `InterpolateLinear`（默认）：线性插值，匀速过渡
- `InterpolateDiscrete`：阶梯式，直接跳到下一个值
- `InterpolateSmooth`：三次 Hermite 插值，首尾减速
- `InterpolateLinear`：球面线性（仅用于 QuaternionKeyframeTrack）

## 骨骼动画：SkinnedMesh

### 工作原理

骨骼动画适合角色、柔性物体等需要"蒙皮"效果的场景。理解骨骼动画需要想象一个木偶：木偶的内部有骨架（Bone），外部是布料皮肤（Mesh）。当骨架的手臂抬起时，手臂附近的布料会跟着动，但肩膀附近的布料动得少——这就是"蒙皮权重"的作用。

每个顶点关联一组骨骼和权重（最多 4 个），骨骼变换时顶点按权重加权混合位置。权重之和必须为 1，否则模型会拉伸或压缩。

### 手动构建骨骼系统

```javascript
const boneRoot = new THREE.Bone()
const boneArm = new THREE.Bone()
const boneHand = new THREE.Bone()
boneRoot.add(boneArm); boneArm.add(boneHand)
boneArm.position.set(0, 1, 0); boneHand.position.set(0, 1, 0)

const skeleton = new THREE.Skeleton([boneRoot, boneArm, boneHand])
const geometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8)
const skinIndices = [], skinWeights = []
const posAttr = geometry.getAttribute('position')

for (let i = 0; i < posAttr.count; i++) {
  const y = posAttr.getY(i)
  if (y < 0) { skinIndices.push(0, 1, 0, 0); skinWeights.push(1, 0, 0, 0) }
  else { skinIndices.push(1, 2, 0, 0); skinWeights.push(0.5, 0.5, 0, 0) }
}

geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4))
geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4))

const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ color: 0x4a90d9 }))
mesh.add(boneRoot); mesh.bind(skeleton); scene.add(mesh)
```

`skinIndex` 和 `skinWeight` 是两个并行的 BufferAttribute，每个顶点有 4 个分量。`skinIndex` 存储骨骼索引（引用 Skeleton.bones 数组的下标），`skinWeight` 存储对应骨骼对该顶点的影响权重。在渲染时，GPU 会将 4 个骨骼的变换矩阵按权重加权求和，得到该顶点的最终位置。

### 骨骼动画的驱动方式

骨骼动画通常有两种驱动方式：

1. **外部数据驱动**：从 glTF 文件加载骨骼动画，Three.js 自动解析并创建 KeyframeTrack
2. **程序化驱动**：直接修改 Bone 对象的 rotation / position / quaternion

```javascript
// 程序化驱动骨骼旋转
function animate() {
  requestAnimationFrame(animate)
  const t = clock.getElapsedTime()
  boneArm.rotation.z = Math.sin(t * 2) * 0.5  // 手臂前后摆动
  boneHand.rotation.z = Math.sin(t * 3) * 0.3  // 手腕跟随摆动
  renderer.render(scene, camera)
}
```

## 变形目标：Morph Targets

### 工作原理

变形目标适合面部表情、形变效果。每个 Morph Target 是一组顶点偏移量，通过权重控制混合比例。可以把它想象成"图层"：基础形态是底层，每个 Morph Target 是一个叠加层，权重控制这个层的不透明度。

与骨骼动画不同，Morph Targets 不依赖骨骼层级，而是直接修改顶点位置。这意味着它更适合局部形变（如嘴角上扬、眉毛皱起），但不适合关节驱动的运动（如手臂弯曲）。

```javascript
const geometry = new THREE.SphereGeometry(1, 32, 32)
const basePos = geometry.getAttribute('position').array.slice()
const smileTarget = new Float32Array(basePos.length)

for (let i = 0; i < basePos.length; i += 3) {
  const y = basePos[i + 1]
  smileTarget[i] = basePos[i]
  smileTarget[i + 1] = basePos[i + 1] + (y > 0 ? y * 0.2 : 0)
  smileTarget[i + 2] = basePos[i + 2]
}

geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(smileTarget, 3)]
const material = new THREE.MeshStandardMaterial({ color: 0x4a90d9, morphTargets: true })
const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)

const morphTrack = new THREE.NumberKeyframeTrack('.morphTargetInfluences[0]', [0, 1, 2], [0, 1, 0])
const clip = new THREE.AnimationClip('smile', 2, [morphTrack])
```

### 多 Morph Target 混合

当一个模型有多个 Morph Target 时，它们的效果会叠加。比如同时有"微笑"和"眨眼"两个 Target，可以独立控制各自的权重，实现"微笑且眨眼"或"不笑只眨眼"的组合效果。

```javascript
// 创建两个 Morph Target：微笑和惊讶
const geometry = new THREE.SphereGeometry(1, 32, 32)
const basePos = geometry.getAttribute('position').array.slice()
const smile = new Float32Array(basePos.length)
const surprise = new Float32Array(basePos.length)

for (let i = 0; i < basePos.length; i += 3) {
  const x = basePos[i], y = basePos[i + 1], z = basePos[i + 2]
  // 微笑：上半部分向上推
  smile[i] = x; smile[i + 1] = y + (y > 0 ? y * 0.15 : 0); smile[i + 2] = z
  // 惊讶：整体拉长变窄
  surprise[i] = x * 0.85; surprise[i + 1] = y * 1.3; surprise[i + 2] = z * 0.85
}

geometry.morphAttributes.position = [
  new THREE.Float32BufferAttribute(smile, 3),
  new THREE.Float32BufferAttribute(surprise, 3)
]

const material = new THREE.MeshStandardMaterial({ color: 0x4a90d9, morphTargets: true })
const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)

// 独立控制两个 Target 的权重
mesh.morphTargetInfluences[0] = 0.5  // 半微笑
mesh.morphTargetInfluences[1] = 0.8  // 接近惊讶
```

## 动画混合与过渡

### Crossfade 原理

AnimationMixer 支持多个 Action 同时播放并按权重混合，实现动画过渡（crossfade）。Crossfade 的核心思想是：同时播放两个动画，旧动画权重从 1 降到 0，新动画权重从 0 升到 1。在过渡期间，两个动画的姿态会按权重混合，产生平滑的过渡效果。

```javascript
function crossFade(fromAction, toAction, duration) {
  toAction.enabled = true; toAction.weight = 0; toAction.play()
  const startTime = performance.now()

  function update() {
    const t = Math.min((performance.now() - startTime) / 1000 / duration, 1)
    fromAction.weight = 1 - t; toAction.weight = t
    if (t < 1) requestAnimationFrame(update)
    else fromAction.stop()
  }
  update()
}
```

### 带时间缩放的 Crossfade

在角色动画中，切换动作时通常需要同步两段动画的时间，避免"滑步"现象。Three.js 提供了 `AnimationMixer.crossFadeTo()` 方法，内部处理了时间同步：

```javascript
function crossFadeWithSync(fromAction, toAction, duration) {
  toAction.enabled = true
  toAction.weight = 0
  toAction.time = 0
  toAction.play()

  // 使用 Three.js 内置方法，自动同步时间
  fromAction.crossFadeTo(toAction, duration, true)
}
```

## glTF 动画加载最佳实践

### glTF 动画数据结构

glTF 是 WebGL 的标准 3D 格式，Three.js 的 GLTFLoader 会自动解析其中的动画数据。一个 glTF 文件可以包含多段动画（如 idle、walk、run），每段动画对应一个 AnimationClip。

```javascript
new GLTFLoader().load('/models/character.glb', (gltf) => {
  // gltf.animations 是 AnimationClip 数组
  console.log('动画数量:', gltf.animations.length)
  gltf.animations.forEach((clip) => {
    console.log('动画名称:', clip.name, '时长:', clip.duration)
  })
})
```

### 使用 AnimationUtils.subclip() 拆分动画

有些 DCC 工具（如 Blender）导出的 glTF 会将所有动画合并成一个长 Clip。此时需要用 `AnimationUtils.subclip()` 按帧范围拆分：

```javascript
import { AnimationUtils } from 'three'

new GLTFLoader().load('/models/character.glb', (gltf) => {
  const fullClip = gltf.animations[0]  // 假设所有动画在一个 Clip 里

  // 按帧范围拆分：idle (0-30帧), walk (31-60帧), run (61-90帧)
  const idleClip = AnimationUtils.subclip(fullClip, 'idle', 0, 30, 30)
  const walkClip = AnimationUtils.subclip(fullClip, 'walk', 31, 60, 30)
  const runClip = AnimationUtils.subclip(fullClip, 'run', 61, 90, 30)

  const actions = {
    idle: mixer.clipAction(idleClip),
    walk: mixer.clipAction(walkClip),
    run: mixer.clipAction(runClip)
  }
})
```

### 根运动（Root Motion）处理

glTF 动画可能包含根骨骼的位移数据，这会导致模型在播放动画时"漂移"。处理方式取决于产品需求：

```javascript
new GLTFLoader().load('/models/character.glb', (gltf) => {
  scene.add(gltf.scene)
  mixer.setRoot(gltf.scene)

  gltf.animations.forEach((clip) => {
    // 方式一：移除根骨骼的位置轨道，模型留在原地
    clip.tracks = clip.tracks.filter(track => !track.name.startsWith('.position'))

    // 方式二：保留根运动，用于需要实际位移的场景（如第三人称控制）
    const action = mixer.clipAction(clip)
    action.play()
  })
})
```

### 动画事件监听

AnimationMixer 支持事件系统，可以监听动画的开始、结束、循环等关键时刻：

```javascript
mixer.addEventListener('finished', (event) => {
  console.log('动画播放完毕:', event.action.getClip().name)
})

mixer.addEventListener('loop', (event) => {
  console.log('动画循环了一次:', event.action.getClip().name)
})

// 监听特定 Action 的事件
const action = mixer.clipAction(clip)
action.addEventListener('loop', () => {
  console.log('这个动画循环了')
})
```

## 多 KeyframeTrack 协同示例

在实际项目中，一个动画通常由多条 Track 协同驱动。以下示例展示了一个"开箱动画"：盒子盖子旋转打开、内部零件弹出、材质发光。

```javascript
const box = new THREE.Group()
scene.add(box)

// 盒子主体
const boxBody = new THREE.Mesh(
  new THREE.BoxGeometry(2, 1, 2),
  new THREE.MeshStandardMaterial({ color: 0x8b4513 })
)
boxBody.position.y = 0.5
box.add(boxBody)

// 盒子盖子（以底部为轴旋转）
const lidPivot = new THREE.Group()
lidPivot.position.set(0, 1, -1)
box.add(lidPivot)

const lid = new THREE.Mesh(
  new THREE.BoxGeometry(2, 0.2, 2),
  new THREE.MeshStandardMaterial({ color: 0xa0522d })
)
lid.position.set(0, 0.1, 1)
lidPivot.add(lid)

// 内部零件
const part = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x000000 })
)
part.position.y = 0.8
part.visible = false
box.add(part)

// 盖子旋转动画：0-1秒打开到 120 度
const lidTrack = new THREE.QuaternionKeyframeTrack(
  'lidPivot.quaternion',
  [0, 0.5, 1],
  [
    ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
    ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).toArray(),
    ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI * 2 / 3, 0, 0)).toArray()
  ]
)

// 零件弹出动画：1-2秒从盒子中心弹到上方
const partPosTrack = new THREE.VectorKeyframeTrack(
  'part.position',
  [1, 1.5, 2],
  [0, 0.8, 0,  0, 2.5, 0,  0, 2, 0]
)

// 零件发光动画：1.5-3秒 emissive 从黑到金黄
const partEmissiveTrack = new THREE.ColorKeyframeTrack(
  'part.material.emissive',
  [1.5, 2.5, 3],
  [0, 0, 0,  1, 0.8, 0,  0.5, 0.4, 0]
)

const clip = new THREE.AnimationClip('unbox', 3, [lidTrack, partPosTrack, partEmissiveTrack])
const mixer = new THREE.AnimationMixer(box)

// 使用事件监听控制零件显示
mixer.addEventListener('loop', () => { part.visible = true })
const action = mixer.clipAction(clip)
action.setLoop(THREE.LoopOnce)
action.clampWhenFinished = true
action.play()
```

## 性能考量

### 动画系统的性能瓶颈

Three.js 动画系统的性能开销主要来自三个层面：

1. **CPU 端计算**：每帧需要遍历所有活跃的 Track，计算插值结果，更新对象属性。Track 数量越多、关键帧越密，CPU 开销越大。
2. **Morph Target 计算**：Morph Target 的顶点偏移在 CPU 端计算（不是 GPU），当顶点数量大时（如高面数模型），会显著影响帧率。
3. **骨骼矩阵更新**：每帧需要遍历骨骼层级，计算世界矩阵，然后上传到 GPU。骨骼数量多时（如复杂角色有 50+ 骨骼），开销明显。

### 优化策略

```javascript
// 1. 减少活跃 Track 数量
// 不需要的动画及时停止，而不是暂停（暂停仍参与混合计算）
action.stop()  // 而不是 action.paused = true

// 2. 降低关键帧密度
// 如果动画不需要每帧精确，可以手动减少关键帧数量
// 或使用 AnimationUtils.subclip() 按步长采样

// 3. Morph Target 优化
// 使用 LOD：远处的模型用低面数版本
// 合并相似的 Morph Target，减少同时激活的数量

// 4. 骨骼优化
// 使用骨骼剔除：不可见的骨骼跳过计算
// 合并小骨骼：将影响相近的骨骼合并

// 5. 使用 InstancedMesh 批量渲染
// 当场景中有大量相同动画的实例时（如一群鸟），
// 使用 InstancedMesh + 共享 AnimationMixer
```

### 性能监控

```javascript
// 监控动画系统的性能
const stats = { trackCount: 0, actionCount: 0, mixerCount: 0 }

function countAnimations(object) {
  object.traverse((child) => {
    if (child.userData.mixer) stats.mixerCount++
  })
}

// 在开发阶段，使用 Three.js 的 Stats 监控帧率
import Stats from 'three/addons/libs/stats.module.js'
const statsPanel = new Stats()
document.body.appendChild(statsPanel.dom)

function animate() {
  requestAnimationFrame(animate)
  mixer.update(clock.getDelta())
  renderer.render(scene, camera)
  statsPanel.update()
}
```

## 常见误区

1. **忘记调用 `mixer.update()`**：动画不会播放是最常见的问题。Mixer 不会自动更新，必须在渲染循环中手动调用。

2. **使用欧拉角做旋转动画**：万向锁问题会导致旋转抖动，应使用 QuaternionKeyframeTrack。欧拉角的三个轴在特定角度会退化为两个自由度，导致旋转路径不可预测。

3. **Morph Target 权重超出 [0,1] 范围**：会导致网格形变超出预期。虽然技术上可以超出范围（实现夸张效果），但通常需要限制在 0-1 之间。

4. **骨骼绑定后忘记调用 `mesh.bind(skeleton)`**：骨骼存在但不生效。`bind()` 方法将骨骼矩阵与网格关联，缺少这一步骨骼变换不会影响顶点。

5. **glTF 动画播放后模型位置异常**：可能是动画包含了根骨骼的位移。检查动画 Track 中是否有 `.position` 轨道作用于根骨骼。

6. **KeyframeTrack 的属性路径写错**：路径必须精确匹配对象的属性链，如 `.position`、`.quaternion`、`.material.opacity`。路径错误不会报错，但动画不会生效。

7. **跨浏览器时钟不一致**：`performance.now()` 在不同浏览器中的精度不同，导致动画速度微小差异。使用 Three.js 的 `Clock` 类可以避免这个问题。

8. **Mixer 的根对象设置错误**：`mixer.setRoot()` 必须设置为动画 Track 路径的根对象。如果 Track 路径是 `.position`，根对象就是被动画化的 Mesh；如果路径是 `head.rotation`，根对象应该是包含 `head` 子对象的 Group。

## 工程建议

1. **优先使用 glTF 格式**：Three.js 的 glTF loader 会自动解析动画数据，减少手动构建 Track 的工作量。glTF 是 WebGL 的标准格式，工具链支持最好。

2. **使用 AnimationUtils.subclip() 拆分动画**：一个 glTF 文件中的多个动画可以按帧范围拆分，避免手动管理多个文件。

3. **生产环境关闭 debug 可视化**：skeleton helper 和 bone axes 上线前移除。这些辅助对象会增加渲染开销，且对用户无意义。

4. **大量动画实例使用对象池**：频繁创建/销毁 AnimationAction 会产生 GC 压力。预创建 Action 池，复用而非重建。

5. **移动端优先测试 Morph Target 性能**：Morph Target 计算在 CPU 端，顶点多时帧率下降明显。在移动端建议降低模型面数或减少同时激活的 Morph Target 数量。

6. **动画资源按需加载**：不要一次性加载所有动画 Clip。使用动态 import 或按需加载，减少首屏资源体积。

7. **使用 `action.stop()` 而非 `action.paused = true`**：停止的 Action 不参与混合计算，暂停的 Action 仍会占用 CPU。对于长时间不播放的动画，用 `stop()` 释放资源。

8. **骨骼动画使用 `skeleton.update()` 手动控制**：默认情况下 Three.js 每帧自动更新骨骼矩阵，但在某些场景（如静态角色展示）可以关闭自动更新，手动调用以节省开销。

## 小结

Three.js 动画系统由三个层次组成：关键帧动画（通用，适合程序化控制）、骨骼动画（适合角色和柔性物体）、变形目标（适合面部表情和形变）。它们通过 AnimationMixer 统一管理，支持混合与过渡。理解这三者的适用场景和性能特征，是构建 3D 交互产品的基础。

## 练习

### 练习一：弹跳球动画

使用 KeyframeTrack 创建一个弹跳球动画。球从高处落下，触地后压缩变形（通过缩放实现），然后弹起，每次弹起高度递减 50%，共弹跳 4 次后静止。要求动画循环播放。

### 练习二：Morph 表情切换

创建一个球体网格，定义两个 Morph Target：一个是"微笑"（嘴角上扬），一个是"惊讶"（整体拉长）。按下空格键时，从当前表情平滑过渡到下一个表情，循环切换。

### 练习三：glTF 动画控制面板

加载一个包含多段动画的 glTF 模型（如 idle、walk、run），实现 UI 控制面板：点击按钮切换动画，切换时使用 crossfade 过渡，过渡时长 0.3 秒。

### 练习四：路径动画与朝向

创建一个立方体，使用 KeyframeTrack 让它沿一条曲线路径移动（至少 5 个关键帧），同时保持立方体的正面朝向运动方向。提示：需要同时动画 position 和 quaternion，quaternion 的值需要根据运动方向计算。

### 练习五：骨骼 IK 模拟

创建一个两段骨骼（上臂 + 前臂），程序化驱动骨骼旋转，让前臂末端始终指向场景中的一个目标点（简单的逆运动学模拟）。目标点跟随鼠标移动。

---

## 参考答案

### 练习一

**思路**：使用 VectorKeyframeTrack 控制 position.y 和 scale，将压缩变形的关键帧放在触地时刻。每次弹起高度递减 50%，时间间隔也相应缩短（因为下落距离变短）。

**答案**：

```javascript
const ball = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 32, 32),
  new THREE.MeshStandardMaterial({ color: 0xe74c3c })
)
scene.add(ball)

const times = [], posY = [], scaleXZ = [], scaleY = []
let height = 5, time = 0

for (let i = 0; i < 5; i++) {
  // 最高点
  times.push(time); posY.push(height); scaleXZ.push(1); scaleY.push(1)
  // 触地：压缩变形
  time += Math.sqrt(height / 5) * 0.3  // 下落时间与高度的平方根成正比
  times.push(time); posY.push(0); scaleXZ.push(1.3); scaleY.push(0.7)
  // 弹起
  time += 0.1
  height *= 0.5
}
// 最终静止在地面
times.push(time); posY.push(0); scaleXZ.push(1); scaleY.push(1)

const posTrack = new THREE.VectorKeyframeTrack(
  '.position',
  times,
  posY.flatMap(y => [0, y, 0])
)

const scaleTrack = new THREE.VectorKeyframeTrack(
  '.scale',
  times,
  scaleXZ.map((xz, i) => [xz, scaleY[i], xz]).flat()
)

const clip = new THREE.AnimationClip('bounce', time, [posTrack, scaleTrack])
const mixer = new THREE.AnimationMixer(ball)
mixer.clipAction(clip).setLoop(THREE.LoopRepeat).play()
```

**要点**：
- 弹跳时在触地帧插入压缩缩放，模拟弹性形变
- 下落时间使用物理公式 `t = sqrt(2h/g)` 的简化版本，让动画更自然
- 每次弹起高度递减 50%，时间间隔也相应缩短
- 最终帧恢复原始缩放，避免循环时出现突变

### 练习二

**思路**：为球体创建两个 Morph Target，使用 NumberKeyframeTrack 动画化权重，三状态循环切换。关键在于从当前权重值开始过渡，而不是从 0 开始。

**答案**：

```javascript
const geometry = new THREE.SphereGeometry(1, 32, 32)
const basePos = geometry.getAttribute('position').array.slice()
const smile = new Float32Array(basePos.length)
const surprise = new Float32Array(basePos.length)

for (let i = 0; i < basePos.length; i += 3) {
  const x = basePos[i], y = basePos[i + 1], z = basePos[i + 2]
  // 微笑：上半部分向上推，模拟嘴角上扬
  smile[i] = x; smile[i + 1] = y + (y > 0 ? y * 0.15 : 0); smile[i + 2] = z
  // 惊讶：整体拉长变窄
  surprise[i] = x * 0.85; surprise[i + 1] = y * 1.3; surprise[i + 2] = z * 0.85
}

geometry.morphAttributes.position = [
  new THREE.Float32BufferAttribute(smile, 3),
  new THREE.Float32BufferAttribute(surprise, 3)
]
const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
  color: 0x4a90d9,
  morphTargets: true
}))
scene.add(mesh)

const morphStates = [
  [0, 0],  // 中性
  [1, 0],  // 微笑
  [0, 1]   // 惊讶
]
let currentState = 0
const mixer = new THREE.AnimationMixer(mesh)

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return
  const prevState = currentState
  currentState = (currentState + 1) % morphStates.length

  // 从当前实际权重开始过渡
  const t0 = new THREE.NumberKeyframeTrack(
    '.morphTargetInfluences[0]',
    [0, 0.5],
    [mesh.morphTargetInfluences[0], morphStates[currentState][0]]
  )
  const t1 = new THREE.NumberKeyframeTrack(
    '.morphTargetInfluences[1]',
    [0, 0.5],
    [mesh.morphTargetInfluences[1], morphStates[currentState][1]]
  )

  const action = mixer.clipAction(new THREE.AnimationClip('morph', 0.5, [t0, t1]))
  action.setLoop(THREE.LoopOnce)
  action.clampWhenFinished = true
  action.play()
})
```

**要点**：
- 三个状态循环：中性 → 微笑 → 惊讶 → 中性
- Morph 权重动画使用 NumberKeyframeTrack
- 从当前实际权重值开始过渡，避免切换时的跳变
- `clampWhenFinished = true` 确保动画结束后保持最终状态

### 练习三

**思路**：加载 glTF 后遍历 animations 数组创建多个 Action，通过 UI 按钮触发 crossfade 切换。关键在于维护当前 Action 的引用，切换时同时播放两个 Action 并插值权重。

**答案**：

```javascript
const actions = {}; let currentAction = null

new GLTFLoader().load('/models/character.glb', (gltf) => {
  scene.add(gltf.scene); mixer.setRoot(gltf.scene)

  gltf.animations.forEach((clip) => {
    const action = mixer.clipAction(clip)
    action.setLoop(THREE.LoopRepeat)
    actions[clip.name] = action
  })

  currentAction = actions[Object.keys(actions)[0]]
  currentAction.play()
})

function switchAnimation(name) {
  const next = actions[name]
  if (!next || next === currentAction) return

  // 准备过渡
  currentAction.weight = 1
  next.weight = 0
  next.enabled = true
  next.time = 0
  next.play()

  const startTime = performance.now()
  const duration = 300  // 0.3 秒

  function fade() {
    const t = Math.min((performance.now() - startTime) / duration, 1)
    // 使用平滑插值而非线性，过渡更自然
    const smoothT = t * t * (3 - 2 * t)
    currentAction.weight = 1 - smoothT
    next.weight = smoothT
    if (t < 1) {
      requestAnimationFrame(fade)
    } else {
      currentAction.stop()
      currentAction = next
    }
  }
  fade()
}

document.getElementById('idle-btn').onclick = () => switchAnimation('idle')
document.getElementById('walk-btn').onclick = () => switchAnimation('walk')
document.getElementById('run-btn').onclick = () => switchAnimation('run')
```

**要点**：
- crossfade 的核心是同时播放两个 Action 并线性插值权重
- 使用平滑插值（smoothstep）让过渡更自然
- 过渡完成后停止旧 Action，释放计算资源
- `next.time = 0` 确保新动画从头开始

### 练习四

**思路**：使用 VectorKeyframeTrack 控制位置，同时根据运动方向计算四元数，用 QuaternionKeyframeTrack 控制朝向。关键在于根据相邻关键帧的位置差计算朝向。

**答案**：

```javascript
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 0.5, 0.5),
  new THREE.MeshStandardMaterial({ color: 0x3498db })
)
scene.add(cube)

// 定义路径点
const pathPoints = [
  new THREE.Vector3(-3, 0, 0),
  new THREE.Vector3(-1, 0, -2),
  new THREE.Vector3(1, 0, 1),
  new THREE.Vector3(3, 0, -1),
  new THREE.Vector3(2, 0, 3),
  new THREE.Vector3(-2, 0, 2),
  new THREE.Vector3(-3, 0, 0)  // 回到起点
]

const times = [0, 1, 2, 3, 4, 5, 6]
const positionValues = pathPoints.flatMap(p => [p.x, p.y, p.z])

// 计算每个关键帧的朝向四元数
const quaternionValues = []
const forward = new THREE.Vector3()
const quat = new THREE.Quaternion()

for (let i = 0; i < pathPoints.length; i++) {
  if (i < pathPoints.length - 1) {
    forward.subVectors(pathPoints[i + 1], pathPoints[i]).normalize()
  }
  // 始终朝向运动方向
  quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward)
  quaternionValues.push(quat.x, quat.y, quat.z, quat.w)
}

const posTrack = new THREE.VectorKeyframeTrack('.position', times, positionValues)
const rotTrack = new THREE.QuaternionKeyframeTrack('.quaternion', times, quaternionValues)
const clip = new THREE.AnimationClip('path', 6, [posTrack, rotTrack])
const mixer = new THREE.AnimationMixer(cube)
mixer.clipAction(clip).setLoop(THREE.LoopRepeat).play()
```

**要点**：
- 使用 `setFromUnitVectors()` 从运动方向计算四元数
- 最后一个关键帧的朝向保持与前一个相同，避免突变
- 路径闭合时（回到起点），位置和朝向都回到初始值

### 练习五

**思路**：使用两段骨骼（上臂 + 前臂），在每帧根据目标点位置计算骨骼旋转角度。这是简化的 2D IK 问题，可以用三角函数直接求解。

**答案**：

```javascript
const boneUpper = new THREE.Bone()
const boneLower = new THREE.Bone()
boneUpper.add(boneLower)
boneUpper.position.set(0, 2, 0)
boneLower.position.set(0, 1.5, 0)

const skeleton = new THREE.Skeleton([boneUpper, boneLower])

// 创建可视化网格
const upperGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8)
upperGeo.translate(0, 0.75, 0)
const lowerGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8)
lowerGeo.translate(0, 0.75, 0)

const upperMesh = new THREE.SkinnedMesh(upperGeo, new THREE.MeshStandardMaterial({ color: 0xe74c3c }))
const lowerMesh = new THREE.SkinnedMesh(lowerGeo, new THREE.MeshStandardMaterial({ color: 0x3498db }))

// 设置蒙皮权重（全部绑定到单根骨骼）
function setupSkin(mesh, boneIndex) {
  const posAttr = mesh.geometry.getAttribute('position')
  const indices = [], weights = []
  for (let i = 0; i < posAttr.count; i++) {
    indices.push(boneIndex, 0, 0, 0)
    weights.push(1, 0, 0, 0)
  }
  mesh.geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4))
  mesh.geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4))
  mesh.add(boneUpper)
  mesh.bind(skeleton)
}

setupSkin(upperMesh, 0)
scene.add(upperMesh)

// 目标点
const target = new THREE.Mesh(
  new THREE.SphereGeometry(0.15, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0x2ecc71 })
)
scene.add(target)

const targetPos = new THREE.Vector3()
const mouse = new THREE.Vector2()

window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1
  mouse.y = -(e.clientY / innerHeight) * 2 + 1
})

const raycaster = new THREE.Raycaster()
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

function animate() {
  requestAnimationFrame(animate)

  // 将鼠标位置转换为 3D 世界坐标
  raycaster.setFromCamera(mouse, camera)
  raycaster.ray.intersectPlane(plane, targetPos)
  target.position.copy(targetPos)

  // IK 计算：让前臂末端指向目标
  const shoulderPos = new THREE.Vector3(0, 2, 0)
  const toTarget = targetPos.clone().sub(shoulderPos)
  const distance = toTarget.length()

  // 上臂朝向目标
  const angle = Math.atan2(toTarget.x, toTarget.y)
  boneUpper.rotation.z = -angle

  // 前臂保持与上臂相同方向（简化版 IK）
  boneLower.rotation.z = 0

  renderer.render(scene, camera)
}
animate()
```

**要点**：
- 简化的 2D IK：上臂朝向目标，前臂跟随
- 使用 `atan2()` 计算旋转角度
- 鼠标位置通过 Raycaster 转换为 3D 世界坐标
- 实际项目中可使用 CCD（循环坐标下降）或 FABRIK 算法实现更精确的 IK
