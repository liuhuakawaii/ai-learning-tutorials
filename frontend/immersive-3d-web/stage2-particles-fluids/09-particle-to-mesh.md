# 粒子到模型——粒子聚合/扩散动画

## 粒子是最自由的顶点

一个模型本质上就是一组顶点。一组粒子也是一组顶点。如果让粒子**飞到模型的顶点位置**，就能实现"粒子聚合成模型"的效果。反过来，让粒子从模型顶点位置散开，就是"模型碎裂成粒子"。

Apple 的 AirPods 产品页用过这种效果：无数光点从四面八方汇聚，组成耳机的形状。

## 目标位置数组

先获取模型的所有顶点坐标：

```ts
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

const loader = new GLTFLoader()
let targetPositions: Float32Array

loader.load("model.glb", (gltf) => {
  const mesh = gltf.scene.children[0] as Mesh
  const geo = mesh.geometry
  const pos = geo.attributes.position

  targetPositions = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    targetPositions[i * 3 + 0] = pos.getX(i)
    targetPositions[i * 3 + 1] = pos.getY(i)
    targetPositions[i * 3 + 2] = pos.getZ(i)
  }

  // 如果粒子数 > 顶点数，循环复用
  // 如果粒子数 < 顶点数，随机采样
})
```

粒子数和模型顶点数通常不一致。两种处理方式：

- **粒子多**：循环复用顶点位置，多个粒子飞向同一个顶点
- **粒子少**：随机采样一部分顶点作为目标

## 传入 Compute Shader

把目标位置数组作为 Storage Buffer 传入 GPU：

```wgsl
@group(0) @binding(0) var<storage, read> targetPositions: array<vec3<f32>>;
@group(0) @binding(1) var<uniform> uBlendFactor: f32; // 0=自由, 1=完全聚合
```

## 弹性吸引

直接线性插值太死板。用弹性公式让粒子在到达目标前有"抖动"：

```wgsl
@compute @workgroup_size(256)
fn simulate(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  var pos = particlePos[i];
  var vel = particleVel[i];
  
  let target = targetPositions[i % arrayLength(&targetPositions)];
  
  // 弹性力：F = -k * (pos - target)
  let springForce = (target - pos) * 8.0;
  let damping = vel * -2.0;
  
  vel += (springForce + damping) * uDeltaTime;
  pos += vel * uDeltaTime;
  
  // 混合自由运动和聚合
  let freePos = pos + curlNoise(pos * 0.3) * uDeltaTime;
  let assembledPos = pos;
  
  particlePos[i] = mix(freePos, assembledPos, uBlendFactor);
  particleVel[i] = vel;
}
```

`uBlendFactor` 从 0 到 1，粒子从自由流动逐渐变为被目标吸引。

## 顺序聚合 vs 随机聚合

**随机聚合**：所有粒子同时开始飞向目标。效果直接但平淡。

**顺序聚合**：粒子按索引顺序依次开始移动，形成"从头到尾"的扫描效果：

```wgsl
let normalizedIndex = f32(i) / f32(particleCount);
let delay = normalizedIndex * 0.5; // 前半段时间内依次启动
let localBlend = clamp((uBlendFactor - delay) / 0.3, 0.0, 1.0);
```

更高级的做法是按空间位置排序——从模型中心向外扩散聚合，或者从一端扫到另一端。

## 边缘发光

粒子在聚合过程中保持发光，完全聚合后逐渐变暗，恢复成正常的模型材质：

```wgsl
// render.frag
float assembled = uBlendFactor;
float glow = 1.0 - assembled * 0.8;
vec3 particleColor = mix(vec3(0.3, 0.7, 1.0), baseColor, assembled);
float alpha = mix(0.8, 1.0, assembled);
```

聚合完成时，粒子变成了模型的顶点，视觉上从发光粒子平滑过渡到实体表面。

## 散开效果

把 blend factor 反过来，从 1 到 0，模型就碎裂成粒子。可以在散开时给一个初始速度：

```wgsl
let explodeDir = normalize(pos - center); // 从中心向外
let explodeForce = explodeDir * 5.0 * (1.0 - uBlendFactor);
vel += explodeForce * uDeltaTime;
```

## 视觉效果描述

页面加载时，50 万个发光粒子在空间中自由流动，像一团蓝色的星云。用户向下滚动，粒子开始被吸引——先是中心的粒子动起来，然后向外扩展，像一个漩涡在收拢。几秒钟后，所有粒子到达目标位置，蓝色光芒消退，一个完整的产品模型出现在眼前。

继续滚动，模型再次碎裂，粒子向四面八方散开，重新回到自由流动状态。

## 练习

### 练习一：多模型切换

准备两个不同的模型（比如球体和立方体）。滚动时粒子先聚合成第一个模型，保持一会儿，再散开，然后聚合成第二个模型。两个模型之间需要做目标位置的插值过渡。

### 练习二：文字粒子

用 Canvas 2D 把一段文字渲染成像素数据，提取不透明像素的位置作为聚合目标。文字的粒子化效果比 3D 模型更有视觉冲击力——每个字由上千个光点组成。

---

## 参考答案

### 练习一

**思路**：两组目标位置数组，用 morph 风格的混合。

```wgsl
@group(0) @binding(0) var<storage, read> targetA: array<vec3<f32>>;
@group(0) @binding(1) var<storage, read> targetB: array<vec3<f32>>;
@group(0) @binding(2) var<uniform> uModelBlend: f32; // 0=modelA, 1=modelB

@compute @workgroup_size(256)
fn simulate(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let tA = targetA[i % arrayLength(&targetA)];
  let tB = targetB[i % arrayLength(&targetB)];
  let target = mix(tA, tB, uModelBlend);
  
  // 弹性吸引到混合后的目标
  let springForce = (target - pos) * 8.0;
  // ...
}
```

滚动映射：0-0.3 散开 → 0.3-0.6 聚合成 A → 0.6-0.7 过渡到 B → 0.7-1.0 保持 B。

### 练习二

**思路**：Canvas 采样文字像素坐标。

```ts
function getTextPositions(text: string, fontSize: number): Float32Array {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  canvas.width = 1024
  canvas.height = 256

  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, 1024, 256)
  ctx.fillStyle = "#fff"
  ctx.font = `bold ${fontSize}px Arial`
  ctx.textAlign = "center"
  ctx.fillText(text, 512, 180)

  const imageData = ctx.getImageData(0, 0, 1024, 256)
  const positions: number[] = []

  for (let y = 0; y < 256; y += 2) {
    for (let x = 0; x < 1024; x += 2) {
      const idx = (y * 1024 + x) * 4
      if (imageData.data[idx] > 128) {
        // 映射到 3D 空间
        positions.push(
          (x - 512) * 0.02,
          (128 - y) * 0.02,
          (Math.random() - 0.5) * 0.5
        )
      }
    }
  }

  return new Float32Array(positions)
}
```

**常见错误**：Canvas 的 `getImageData` 返回的是 RGBA，判断像素是否"有内容"时用 R 通道即可（因为文字是白色）。注意 `textAlign = "center"` 让文字居中，否则 3D 偏移。
