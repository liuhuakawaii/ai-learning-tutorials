# 物理材质——PBR 深度、各向异性、次表面散射

## PBR 不只是"设个 metalness"

Three.js 的 MeshStandardMaterial 已经实现了基于物理的渲染（PBR），但大多数人只用到 color + roughness + metalness 三个参数。真实的材质系统要处理更多现象：

- **各向异性**：拉丝金属的反射方向不均匀
- **次表面散射（SSS）**：光进入半透明材质内部再散射出来（皮肤、蜡烛、牛奶、树叶）
- **清漆层**：汽车漆面的双层结构
- **薄膜干涉**：肥皂泡、油膜的彩虹色

## 各向异性（Anisotropy）

拉丝金属表面有方向性的微观划痕，导致反射沿一个方向拉长。

```ts
import { MeshPhysicalMaterial } from "three"

const material = new MeshPhysicalMaterial({
  color: 0xcccccc,
  metalness: 1.0,
  roughness: 0.3,
  anisotropy: 0.8,          // 0=各向同性, 1=最大各向异性
  anisotropyRotation: 0.5,  // 各向异性方向的角度
})
```

`anisotropy` 控制反射拉伸的程度，`anisotropyRotation` 控制拉伸方向。

视觉区别：

- isotropic（各向同性）：反射光点是圆形
- anisotropic（各向异性）：反射光点是椭圆形，沿划痕方向拉长

## 次表面散射（SSS）

光打到皮肤上不会立即反射——一部分光进入皮肤内部，被血红蛋白和胶原蛋白散射后从附近的位置出来。这让皮肤看起来有"通透感"。

Three.js 的 MeshPhysicalMaterial 支持 SSS：

```ts
const skinMaterial = new MeshPhysicalMaterial({
  color: 0xffccaa,
  roughness: 0.5,
  transmission: 0.0,       // 不是透射
  thickness: 2.0,          // 散射介质的厚度
  sheen: 0.5,              // 表面光泽
  sheenColor: new Color(0xff6666),
})
```

但 Three.js 的 SSS 实现是简化版。要更真实的效果，需要自定义 shader：

```glsl
// 简化的 SSS
vec3 subsurfaceScattering(vec3 lightDir, vec3 normal, vec3 viewDir) {
  // 背光透射
  float backLight = max(0.0, dot(-lightDir, viewDir));
  float sss = pow(backLight, 3.0) * sssIntensity;
  
  // 散射颜色（皮肤偏红）
  vec3 sssColor = baseColor * vec3(1.0, 0.3, 0.1) * sss;
  
  return sssColor;
}
```

## 清漆层（Clearcoat）

汽车漆面、钢琴烤漆是双层结构：底层有色漆，上层透明清漆。

```ts
const carPaint = new MeshPhysicalMaterial({
  color: 0x1a3a8a,
  metalness: 0.0,
  roughness: 0.3,
  clearcoat: 1.0,           // 清漆强度
  clearcoatRoughness: 0.05, // 清漆粗糙度
})
```

清漆层的效果：在主反射之上叠加一层额外的高光，这层高光更锐利、不受底层颜色影响。现实中汽车漆面的那种"深度感"就是这么来的。

## 薄膜干涉（Iridescence）

肥皂泡、油膜、甲虫翅膀的彩虹色来自薄膜干涉——光在薄膜上下表面反射后产生相位差。

```ts
const soapBubble = new MeshPhysicalMaterial({
  color: 0xffffff,
  metalness: 0.0,
  roughness: 0.0,
  transmission: 0.9,
  thickness: 0.1,
  iridescence: 1.0,
  iridescenceIOR: 1.5,
  iridescenceThicknessRange: [100, 400],
})
```

`iridescenceThicknessRange` 控制薄膜厚度范围，不同厚度产生不同颜色。

## 实验：同一个球体，不同材质

创建 8 个相同的球体，每个用不同的材质属性组合：

```ts
const configs = [
  { name: "Default", props: { color: 0x888888 } },
  { name: "Metallic", props: { color: 0xcccccc, metalness: 1, roughness: 0.1 } },
  { name: "Rough", props: { color: 0x888888, roughness: 1.0 } },
  { name: "Anisotropic", props: { color: 0xcccccc, metalness: 1, roughness: 0.2, anisotropy: 0.9 } },
  { name: "Clearcoat", props: { color: 0x1a3a8a, clearcoat: 1, clearcoatRoughness: 0.05 } },
  { name: "SSS", props: { color: 0xffccaa, thickness: 2, sheen: 0.5, sheenColor: new Color(0xff6666) } },
  { name: "Iridescent", props: { color: 0xffffff, iridescence: 1, iridescenceIOR: 1.3 } },
  { name: "Glass", props: { color: 0xffffff, transmission: 0.95, roughness: 0, ior: 1.5 } },
]
```

排成一行，用同一个环境光和一盏点光源。这比看参数文档有用 100 倍——你一眼就能看出各参数对视觉的影响。

## 材质参数的工程意义

| 效果 | 产品类型 | 关键参数 |
|------|----------|----------|
| 拉丝不锈钢 | 厨具、手表 | metalness=1, anisotropy=0.7 |
| 皮肤 | 角色、美妆 | sheen, subsurface |
| 汽车漆 | 汽车、产品 | clearcoat=1 |
| 玻璃 | 容器、建筑 | transmission=0.9, ior=1.5 |
| 陶瓷 | 产品、餐具 | roughness=0.15, metalness=0 |
| 木头 | 家具 | roughness=0.8, metalness=0 |

## 练习

### 练习一：材质过渡动画

一个球体从金属材质过渡到玻璃材质。不是瞬间切换，而是同时改变 metalness、transmission、roughness、ior，让过渡过程中球体看起来像"融化"的金属变成透明的玻璃。

### 练习二：环境对材质的影响

同一个球体，分别在以下环境中展示：晴天户外、暖色室内、霓虹灯夜景。观察 PBR 材质如何自动响应不同的环境光照——同一种金属在三种环境下的反射完全不同。

---

## 参考答案

### 练习一

**思路**：用 ScrollTrigger 或时间驱动所有材质参数的同步插值。

```ts
const material = new MeshPhysicalMaterial({
  color: 0xcccccc,
  metalness: 1.0,
  roughness: 0.1,
  transmission: 0.0,
  thickness: 0.0,
  ior: 1.0,
})

// 在动画循环中
function updateMaterial(t: number) {
  // t: 0=金属, 1=玻璃
  material.metalness = 1 - t
  material.transmission = t
  material.roughness = 0.1 + Math.sin(t * Math.PI) * 0.3
  material.thickness = t * 2
  material.ior = 1 + t * 0.5
  material.color.setHSL(0.6, 0.1, 0.8 - t * 0.3)
}
```

过渡中 roughness 先变高再变低，中间有一段"模糊"状态，让过渡不那么机械。

### 练习二

**思路**：用三张不同的 HDR 环境贴图，滚动时切换。

```ts
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js"

const loader = new RGBELoader()
const envMaps = await Promise.all([
  loader.loadAsync("sunny.hdr"),
  loader.loadAsync("indoor.hdr"),
  loader.loadAsync("nightcity.hdr"),
])

const pmrem = new PMREMGenerator(renderer)
const envTextures = envMaps.map(tex => pmrem.fromEquirectangular(tex).texture)

// 切换环境
function setEnvironment(index: number) {
  scene.environment = envTextures[index]
  scene.background = envTextures[index]
  scene.backgroundBlurriness = 0.5
}
```

**常见错误**：切换 HDR 环境时如果直接赋值 `scene.environment`，会有一帧的闪烁。用 `scene.backgroundBlurriness` 过渡可以掩盖切换瞬间。
