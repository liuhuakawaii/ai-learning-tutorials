# 模型变形——Morph Targets、顶点动画、过渡效果

## 变形是什么感觉

想象一个耳机产品页：滚动时，耳机从折叠状态慢慢展开。或者一个汽车页面：车身从流线型慢慢变成棱角分明的概念形态。

这不是两套模型在切换——是同一套顶点在不同位置之间插值。这就是 Morph Targets（变形目标）。

## Morph Targets 的工作原理

一个网格有 N 个顶点。每个顶点有初始位置 `base`。你再定义若干组目标位置 `target0`, `target1`, ...

每帧根据权重混合：

```
final = base + weight0 * (target0 - base) + weight1 * (target1 - base)
```

权重 0 表示完全保持原状，权重 1 表示完全变成目标形态。权重在 0-1 之间就是过渡状态。

## 用代码创建 Morph Targets

Three.js 的 `BufferGeometry` 原生支持 morph attributes：

```ts
import {
  BoxGeometry, MeshStandardMaterial, Mesh,
  Float32BufferAttribute
} from "three"

const geometry = new BoxGeometry(2, 2, 2, 32, 32, 32)
const positions = geometry.attributes.position

// 定义第一个变形目标：膨胀成球
const morphTarget1 = new Float32Array(positions.count * 3)
for (let i = 0; i < positions.count; i++) {
  const x = positions.getX(i)
  const y = positions.getY(i)
  const z = positions.getZ(i)
  const len = Math.sqrt(x * x + y * y + z * z)
  morphTarget1[i * 3] = (x / len) * 2
  morphTarget1[i * 3 + 1] = (y / len) * 2
  morphTarget1[i * 3 + 2] = (z / len) * 2
}

geometry.morphAttributes.position = [
  new Float32BufferAttribute(morphTarget1, 3)
]

const material = new MeshStandardMaterial({
  morphTargets: true,
  color: 0x4488ff,
})

const mesh = new Mesh(geometry, material)
```

权重通过 `mesh.morphTargetInfluences` 数组控制：

```ts
mesh.morphTargetInfluences[0] = 0.5 // 50% 变形
```

## 滚动驱动变形

把 morph 权重接入 ScrollTrigger：

```ts
ScrollTrigger.create({
  trigger: ".wrapper",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    const p = self.progress
    mesh.morphTargetInfluences[0] = p
    renderer.render(scene, camera)
  },
})
```

滚动时，立方体逐渐膨胀成球体。整个过程完全由用户控制。

## 多个变形目标的混合

可以同时有多个变形目标，独立控制权重：

```ts
// target0: 膨胀成球
// target1: 拉伸成圆柱
geometry.morphAttributes.position = [
  new Float32BufferAttribute(morphTarget1, 3),
  new Float32BufferAttribute(morphTarget2, 3),
]

onUpdate: (self) => {
  const p = self.progress
  if (p < 0.5) {
    mesh.morphTargetInfluences[0] = p * 2        // 0→1
    mesh.morphTargetInfluences[1] = 0
  } else {
    mesh.morphTargetInfluences[0] = 1
    mesh.morphTargetInfluences[1] = (p - 0.5) * 2 // 0→1
  }
}
```

前半段滚变成球，后半段从球变成圆柱。

## 法线也要跟着变

如果只变形顶点不做法线，光照会错。Three.js 可以自动生成 morph normals：

```ts
geometry.computeMorphNormals()
```

或者在 morphAttributes 里手动提供法线数组，精度更高。

## 程序化变形——不依赖建模软件

不一定需要 Blender 导出 morph targets。很多效果可以用代码生成：

**波浪变形**：

```ts
const waveTarget = new Float32Array(positions.count * 3)
for (let i = 0; i < positions.count; i++) {
  const x = positions.getX(i)
  const y = positions.getY(i)
  const z = positions.getZ(i)
  waveTarget[i * 3] = x
  waveTarget[i * 3 + 1] = y + Math.sin(x * 2) * 0.5
  waveTarget[i * 3 + 2] = z
}
```

**扭曲变形**：

```ts
for (let i = 0; i < positions.count; i++) {
  const x = positions.getX(i)
  const y = positions.getY(i)
  const z = positions.getZ(i)
  const angle = y * 0.5 // 沿 Y 轴扭曲
  twistTarget[i * 3] = x * Math.cos(angle) - z * Math.sin(angle)
  twistTarget[i * 3 + 1] = y
  twistTarget[i * 3 + 2] = x * Math.sin(angle) + z * Math.cos(angle)
}
```

## 性能考虑

Morph targets 的计算在 GPU 上完成（vertex shader 里做混合），性能比你想象的好。但要注意：

- morph attributes 数量越多，显存占用越大
- 每个 morph target 都是完整的顶点数组副本
- 超过 4 个 morph target 时考虑是否该换方案

## 练习

### 练习一：呼吸效果

一个球体，morph target 把它变成一个表面起伏的"有机体"（类似细胞膜）。用 ScrollTrigger 控制变形程度，同时配合一个慢速的 `sin(time)` 让它有"呼吸"感——即使不滚动，表面也在微微起伏。

### 练习二：方块雨

一个平面网格（PlaneGeometry 细分 100x100），用 morph target 把它变成一座山丘。滚动时从平面慢慢隆起成山。在隆起过程中，加一个顶点颜色属性：低处蓝色（水面），高处绿色（草地），最高处白色（雪顶）。

---

## 参考答案

### 练习一

**思路**：morph target 生成噪声表面，滚动控制 morph 权重，叠加时间变化。

```ts
import { SphereGeometry, Float32BufferAttribute } from "three"

const geo = new SphereGeometry(2, 64, 64)
const pos = geo.attributes.position

const morph = new Float32Array(pos.count * 3)
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i)
  const y = pos.getY(i)
  const z = pos.getZ(i)
  const len = Math.sqrt(x * x + y * y + z * z)
  const noise = Math.sin(x * 3) * Math.cos(y * 3) * Math.sin(z * 3) * 0.3
  morph[i * 3] = (x / len) * (2 + noise)
  morph[i * 3 + 1] = (y / len) * (2 + noise)
  morph[i * 3 + 2] = (z / len) * (2 + noise)
}
geo.morphAttributes.position = [new Float32BufferAttribute(morph, 3)]

// 在渲染循环中
const scrollWeight = scrollProgress // 来自 ScrollTrigger
const breathe = Math.sin(time * 2) * 0.1
mesh.morphTargetInfluences[0] = Math.min(1, scrollWeight + breathe)
```

### 练习二

**思路**：PlaneGeometry 的顶点 Y 坐标隆起，同时计算顶点颜色。

```ts
const geo = new PlaneGeometry(10, 10, 100, 100)
const pos = geo.attributes.position

const morph = new Float32Array(pos.count * 3)
const colors = new Float32Array(pos.count * 3)

for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i)
  const z = pos.getZ(i)
  const height = Math.sin(x * 0.5) * Math.cos(z * 0.5) * 2
    + Math.sin(x * 1.5) * 0.5

  morph[i * 3] = x
  morph[i * 3 + 1] = height
  morph[i * 3 + 2] = z

  if (height < 0) {
    colors[i * 3] = 0.1; colors[i * 3 + 1] = 0.3; colors[i * 3 + 2] = 0.8
  } else if (height < 1.5) {
    colors[i * 3] = 0.2; colors[i * 3 + 1] = 0.7; colors[i * 3 + 2] = 0.3
  } else {
    colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1.0
  }
}
geo.morphAttributes.position = [new Float32BufferAttribute(morph, 3)]
geo.setAttribute("color", new Float32BufferAttribute(colors, 3))
```

**常见错误**：忘记设置 `morphTargets: true` 在材质上，导致 morph 权重不生效。另外，PlaneGeometry 默认朝 Z 轴，需要 `rotateX(-Math.PI / 2)` 让它变成地面。
