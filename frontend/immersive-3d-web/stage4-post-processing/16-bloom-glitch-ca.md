# Bloom/Glitch/Chromatic Aberration——后处理链设计

## 后处理是什么

渲染管线输出的是一帧像素数据。后处理（Post-Processing）是在这帧像素上做二次加工——模糊、扭曲、色彩偏移、叠加效果。

它和 Photoshop 的滤镜本质一样，只不过每帧都在实时执行。

## 后处理链

多个后处理效果按顺序串联：A 的输出是 B 的输入。顺序不同，结果不同。

```
场景渲染 → Bloom → Chromatic Aberration → Glitch → 输出到屏幕
```

每一步都需要一个中间帧缓冲（FBO）。Three.js 的 `EffectComposer` 管理这个链。

## EffectComposer 基础

```ts
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"

const composer = new EffectComposer(renderer)

// 第一步：正常渲染场景
composer.addPass(new RenderPass(scene, camera))

// 第二步：Bloom
const bloomPass = new UnrealBloomPass(
  new Vector2(innerWidth, innerHeight),
  1.5,  // strength
  0.4,  // radius
  0.85  // threshold
)
composer.addPass(bloomPass)

// 最后一步输出到屏幕
bloomPass.renderToScreen = true

// 渲染循环
function animate() {
  requestAnimationFrame(animate)
  composer.render() // 替代 renderer.render()
}
```

## Bloom——发光效果

Bloom 让亮度超过阈值的区域向外"溢出"光芒。现实中的路灯、霓虹灯、太阳都有这种效果。

原理：
1. 提取亮度高于阈值的像素
2. 对这些像素做高斯模糊（通常多 pass，从大半径到小半径）
3. 把模糊结果叠加到原始画面上

```ts
// 调整 Bloom 强度
bloomPass.strength = 2.0  // 光芒强度
bloomPass.radius = 0.5    // 光芒扩散范围
bloomPass.threshold = 0.8 // 亮度阈值（越低越容易发光）
```

**选择性 Bloom**：只让特定物体发光。方法是用两个渲染层：

```ts
// 设置发光物体的 renderOrder
glowingMesh.layers.set(1)

// 第一个 composer 渲染发光层
const bloomComposer = new EffectComposer(renderer)
bloomComposer.addPass(new RenderPass(scene, camera)) // 只渲染 layer 1

// 第二个 composer 渲染全部 + Bloom 叠加
```

## Chromatic Aberration——色差

镜头不能把所有波长的光聚焦到同一点，导致红绿蓝三个通道有微小偏移。这是镜头缺陷，但在视觉上很"电影感"。

```ts
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js"

const chromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.003 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec2 center = vec2(0.5);
      vec2 dir = vUv - center;
      float dist = length(dir);
      
      // 离中心越远色差越大
      float offset = amount * dist;
      
      float r = texture2D(tDiffuse, vUv + dir * offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - dir * offset).b;
      
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
}

const chromaticPass = new ShaderPass(chromaticAberrationShader)
composer.addPass(chromaticPass)
```

## Glitch——故障艺术

画面随机撕裂、颜色错位、扫描线，模拟数字信号故障。

```ts
import { GlitchPass } from "three/examples/jsm/postprocessing/GlitchPass.js"

const glitchPass = new GlitchPass()
glitchPass.goWild = false // false=偶尔触发, true=持续故障
composer.addPass(glitchPass)
```

GlitchPass 内部随机决定是否触发故障，以及故障的类型（水平位移、颜色偏移、扫描线等）。

## 后处理链的顺序

效果的顺序影响结果：

| 顺序 | 效果 |
|------|------|
| Bloom → Glitch | 发光的物体也被故障撕裂 |
| Glitch → Bloom | 故障边缘有发光溢出 |
| CA → Bloom | 色差后再 Bloom，颜色更杂 |
| Bloom → CA | Bloom 后色差，光芒有彩色边缘 |

通常推荐：Render → Bloom → 其他风格化效果 → 色调映射 → 输出。

## 性能代价

每个后处理 pass 都是全屏 draw call + fragment shader 执行：

- Bloom：最少 3-4 个 pass（提取 + 多级模糊 + 合成）
- Glitch：1 个 pass
- CA：1 个 pass

总 pass 数超过 8-10 个时，移动端开始吃力。要监控 `renderer.info.render.calls`。

## 练习

### 练习一：脉冲式 Bloom

Bloom 的强度随时间脉冲：正常时 strength=0.5，每隔 2 秒突然跳到 3.0 然后快速衰减。模拟"心跳"般的发光效果。用 `Math.exp(-t)` 做衰减曲线。

### 练习二：自定义后处理——Vignette

写一个自定义 ShaderPass 实现暗角（Vignette）效果——画面四角变暗，中心保持明亮。把参数暴露出来：暗角强度和范围。

---

## 参考答案

### 练习一

**思路**：用时间驱动 Bloom strength，叠加脉冲衰减。

```ts
let pulseTime = -10 // 上次脉冲时间

function animate() {
  requestAnimationFrame(animate)
  
  const time = clock.getElapsedTime()
  
  // 每 2 秒触发一次脉冲
  if (time - pulseTime > 2.0) {
    pulseTime = time
  }
  
  const elapsed = time - pulseTime
  const pulse = Math.exp(-elapsed * 5) // 衰减曲线
  
  bloomPass.strength = 0.5 + pulse * 3.0
  
  composer.render()
}
```

### 练习二

**思路**：自定义 fragment shader 在后处理阶段应用暗角。

```ts
const vignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.8 },
    smoothness: { value: 0.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    uniform float smoothness;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float vignette = smoothstep(0.5, smoothness, dist);
      color.rgb *= 1.0 - vignette * intensity;
      
      gl_FragColor = color;
    }
  `,
}

const vignettePass = new ShaderPass(vignetteShader)
composer.addPass(vignettePass)
```

**常见错误**：后处理的输入纹理名必须是 `tDiffuse`（Three.js ShaderPass 约定）。如果改了名字，需要同步修改 `textureID`。
