# 光影变化——随滚动改变光照、环境、色调

## 光是情绪

同一个模型，打上冷白光是科技感，打上暖黄光是温馨感，打上紫色侧光是神秘感。滚动页面时如果能同步改变光照，用户感受到的不只是"页面在动"，而是"情绪在变"。

这节课做的是：让光的颜色、强度、方向、环境贴图全部跟滚动联动。

## 基础：改变主光源

最简单的效果——滚动时改变 DirectionalLight 的颜色和强度：

```ts
const sun = new DirectionalLight(0xffffff, 1)
sun.position.set(5, 10, 5)
scene.add(sun)

ScrollTrigger.create({
  trigger: ".wrapper",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    const p = self.progress

    // 从日出到正午到日落
    const warmth = Math.sin(p * Math.PI)
    sun.color.setHSL(0.1, 0.8, 0.3 + warmth * 0.5)
    sun.intensity = 0.5 + warmth * 1.5

    // 光源角度变化
    sun.position.x = Math.cos(p * Math.PI) * 10
    sun.position.y = 5 + Math.sin(p * Math.PI) * 10

    renderer.render(scene, camera)
  },
})
```

滚动时，光照从左侧低角度的暖光（日出），变成正上方的强光（正午），再变成右侧低角度的暖光（日落）。

## 色温映射

用 HSL 的 Hue 控制色温很直观：

| Hue | 色温 | 场景感 |
|-----|------|--------|
| 0.05-0.1 | 暖橙/黄 | 日出、温暖、复古 |
| 0.15 | 绿 | 自然、森林 |
| 0.55-0.65 | 冷蓝 | 科技、冷峻、夜景 |
| 0.75-0.85 | 紫 | 神秘、魔幻 |

```ts
function temperatureToHue(t: number): number {
  // t: 0=冷 → 1=暖
  return 0.6 - t * 0.55 // 0.6(蓝) → 0.05(橙)
}
```

## 环境光的渐变

AmbientLight 控制整体亮度，但更真实的做法是用环境贴图（Environment Map）。滚动时切换环境贴图，或改变环境光强度：

```ts
import { PMREMGenerator } from "three"

// 假设有两套 HDR 环境
const indoorEnv = hdrLoader.load("indoor.hdr")
const outdoorEnv = hdrLoader.load("outdoor.hdr")

// 在 ScrollTrigger 中混合
scene.environment = self.progress < 0.5 ? indoorEnv : outdoorEnv
```

更平滑的做法是在 shader 里混合两张环境贴图，但 Three.js 不直接支持。一个简化方案是用 `scene.backgroundBlurriness` 配合透明度过渡。

## 阴影跟随变化

阴影的方向应该跟着光源走：

```ts
onUpdate: (self) => {
  const p = self.progress
  const angle = p * Math.PI

  sun.position.set(
    Math.cos(angle) * 10,
    5 + Math.sin(angle) * 5,
    5
  )
  sun.target.position.set(0, 0, 0)
  sun.target.updateMatrixWorld()
}
```

阴影的软硬程度也可以变——远处的光（低角度）产生更柔和的阴影：

```ts
// 阴影 camera 的范围影响阴影边缘软硬
const d = 5 + Math.sin(angle) * 3
sun.shadow.camera.left = -d
sun.shadow.camera.right = d
sun.shadow.camera.top = d
sun.shadow.camera.bottom = -d
```

## 背景色渐变

`scene.background` 也可以跟滚动联动，做天空色渐变：

```ts
import { Color } from "three"

const dawnColor = new Color(0xff9966)
const dayColor = new Color(0x87ceeb)
const duskColor = new Color(0x331155)
const tempColor = new Color()

onUpdate: (self) => {
  const p = self.progress
  if (p < 0.5) {
    tempColor.copy(dawnColor).lerp(dayColor, p * 2)
  } else {
    tempColor.copy(dayColor).lerp(duskColor, (p - 0.5) * 2)
  }
  scene.background = tempColor
}
```

## Fog 配合光照

雾的颜色应该和背景/光照一致：

```ts
scene.fog = new Fog(0xff9966, 5, 20)

onUpdate: (self) => {
  // 雾色跟随背景
  scene.fog.color.copy(tempColor)
  // 雾的浓度也可以变
  scene.fog.near = 3 + self.progress * 5
  scene.fog.far = 15 + self.progress * 10
}
```

## 练习

### 练习一：昼夜循环

一个球体放在场景中央。滚动从 0 到 1 完成一整个昼夜循环：
- 0-0.25：黎明（暖橙光从地平线升起）
- 0.25-0.5：正午（白色顶光，最亮）
- 0.5-0.75：黄昏（暖红光从另一侧落下）
- 0.75-1.0：夜晚（微弱的蓝紫色环境光，可见星空背景）

背景色、光源颜色、光源位置、环境光强度全部联动。

### 练习二：聚光灯扫射

一个黑暗场景，只有几盏 SpotLight。滚动时聚光灯依次亮起，照亮不同的物体。模拟"美术馆参观"——每到一个滚动位置，一束光打亮一件展品。

---

## 参考答案

### 练习一

**思路**：用一个统一的 cycle progress 映射到各项光照参数。

```ts
const sun = new DirectionalLight(0xffffff, 1)
const ambient = new AmbientLight(0x000022, 0.1)

const dawnColor = new Color(0xff7733)
const dayColor = new Color(0xffffff)
const duskColor = new Color(0xff4400)
const nightColor = new Color(0x112244)

const bgColorDawn = new Color(0xff9966)
const bgColorDay = new Color(0x87ceeb)
const bgColorDusk = new Color(0x552244)
const bgColorNight = new Color(0x0a0a2a)

const tempColor = new Color()
const tempBg = new Color()

function getColorAtProgress(p: number): Color {
  if (p < 0.25) {
    return tempColor.copy(dawnColor).lerp(dayColor, p * 4)
  } else if (p < 0.5) {
    return tempColor.copy(dayColor)
  } else if (p < 0.75) {
    return tempColor.copy(dayColor).lerp(duskColor, (p - 0.5) * 4)
  } else {
    return tempColor.copy(duskColor).lerp(nightColor, (p - 0.75) * 4)
  }
}

ScrollTrigger.create({
  trigger: ".wrapper",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    const p = self.progress
    const angle = p * Math.PI * 2

    sun.position.set(Math.cos(angle) * 10, Math.sin(angle) * 10, 5)
    sun.color.copy(getColorAtProgress(p))
    sun.intensity = Math.sin(angle) > 0 ? Math.sin(angle) * 2 : 0.1

    ambient.intensity = p > 0.75 ? 0.3 : 0.1

    scene.background.copy(getColorAtProgress(p))
    renderer.render(scene, camera)
  },
})
```

### 练习二

**思路**：每个展品对应一个 SpotLight 和一段滚动区间。

```ts
const exhibits = [
  { pos: new Vector3(-4, 3, 0), target: new Vector3(-4, 0, 0), light: new SpotLight(0xffaa44, 0, 20) },
  { pos: new Vector3(0, 3, 0), target: new Vector3(0, 0, 0), light: new SpotLight(0x44aaff, 0, 20) },
  { pos: new Vector3(4, 3, 0), target: new Vector3(4, 0, 0), light: new SpotLight(0xff44aa, 0, 20) },
]

exhibits.forEach(e => {
  e.light.position.copy(e.pos)
  e.light.target.position.copy(e.target)
  e.light.angle = Math.PI / 6
  e.light.penumbra = 0.5
  scene.add(e.light)
  scene.add(e.light.target)
})

onUpdate: (self) => {
  const p = self.progress
  exhibits.forEach((e, i) => {
    const start = i * 0.3
    const end = start + 0.3
    const localP = Math.max(0, Math.min(1, (p - start) / (end - start)))
    e.light.intensity = localP * 3
  })
}
```

**常见错误**：SpotLight 的 `target` 是一个 Object3D，需要 `add` 到场景里并且调用 `updateMatrixWorld()` 才能生效。
