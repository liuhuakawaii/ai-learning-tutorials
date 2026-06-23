# 阶段实战：构建视觉特效展示站

## 目标

做一个单页网站，展示前四课学到的所有后处理和风格化效果。用户通过滚动在不同视觉风格间切换，每种风格都有对应的 3D 场景和后处理链。

## 页面结构

5 个全屏 section，每个对应一种视觉风格：

1. **写实 PBR**：Bloom + 景深 + 环境反射
2. **卡通渲染**：Toon Shading + 描边
3. **故障艺术**：Glitch + 扫描线 + RGB 分离
4. **电影感**：运动模糊 + 暗角 + 色调映射
5. **粒子化**：模型碎裂成粒子 + 发光

每种风格用不同的后处理链，滚动时平滑过渡。

## 场景共享

所有风格用同一个 3D 场景（一个产品模型），但切换不同的材质和后处理：

```ts
const scene = new Scene()
const model = await loadModel("product.glb")

const materials = {
  pbr: new MeshPhysicalMaterial({ color: 0x4488cc, metalness: 0.8, roughness: 0.2 }),
  toon: new MeshToonMaterial({ color: 0x4488cc }),
  wireframe: new MeshBasicMaterial({ wireframe: true, color: 0x00ff88 }),
}
```

## 后处理链管理

每种风格有自己的 EffectComposer，切换时替换：

```ts
const composers: Record<string, EffectComposer> = {}

function createPBRComposer(): EffectComposer {
  const c = new EffectComposer(renderer)
  c.addPass(new RenderPass(scene, camera))
  c.addPass(new UnrealBloomPass(new Vector2(innerWidth, innerHeight), 1.5, 0.4, 0.85))
  c.addPass(new BokehPass(scene, camera, { focus: 5, aperture: 0.02, maxblur: 0.01 }))
  return c
}

function createToonComposer(): EffectComposer {
  const c = new EffectComposer(renderer)
  c.addPass(new RenderPass(scene, camera))
  // Toon 不需要后处理，直接输出
  return c
}

function createGlitchComposer(): EffectComposer {
  const c = new EffectComposer(renderer)
  c.addPass(new RenderPass(scene, camera))
  c.addPass(new UnrealBloomPass(new Vector2(innerWidth, innerHeight), 0.5, 0.4, 0.85))
  c.addPass(new GlitchPass())
  c.addPass(new ShaderPass(chromaticAberrationShader))
  return c
}

function createCinematicComposer(): EffectComposer {
  const c = new EffectComposer(renderer)
  c.addPass(new RenderPass(scene, camera))
  c.addPass(motionBlurPass)
  c.addPass(vignettePass)
  return c
}
```

## 风格切换逻辑

```ts
let currentStyle = "pbr"
let targetStyle = "pbr"

function switchStyle(newStyle: string) {
  if (newStyle === currentStyle) return
  
  // 材质切换
  model.material = materials[newStyle] || materials.pbr
  
  // 后处理切换
  currentStyle = newStyle
}
```

## 滚动分段

```ts
const styleOrder = ["pbr", "toon", "glitch", "cinematic", "particles"]

ScrollTrigger.create({
  trigger: ".wrapper",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    const p = self.progress
    const idx = Math.floor(p * styleOrder.length)
    const style = styleOrder[Math.min(idx, styleOrder.length - 1)]
    switchStyle(style)
  },
})
```

## 每种风格的视觉描述

**写实 PBR**：金属表面反射出环境的细节，景深让背景模糊，Bloom 在高光处溢出柔和的光芒。整体画面像高端产品摄影。

**卡通渲染**：光照变成三档色块，黑色描边勾勒出模型轮廓。画面干净、简洁，像 3D 动画电影的截图。

**故障艺术**：画面随机撕裂，RGB 通道错位，扫描线覆盖整个屏幕。偶尔的闪烁和位移让画面充满数字不安定感。

**电影感**：运动模糊让快速移动的相机拖出残影，暗角聚焦视线，低饱和度的色调映射营造冷峻氛围。

**粒子化**：模型碎裂成数万个发光粒子，粒子在空间中流动，最终重新聚合成模型。

## HTML 叠加

每个 section 有固定位置的标题和描述：

```html
<div class="style-labels">
  <div class="label" data-style="pbr">
    <h2>PBR</h2>
    <p>物理真实的材质与光照</p>
  </div>
  <div class="label" data-style="toon">
    <h2>Toon</h2>
    <p>卡通风格化渲染</p>
  </div>
  <!-- ... -->
</div>
```

```ts
function updateLabels(progress: number) {
  const labels = document.querySelectorAll(".label")
  labels.forEach((label, i) => {
    const sectionStart = i / 5
    const sectionEnd = (i + 1) / 5
    const isActive = progress >= sectionStart && progress < sectionEnd
    label.classList.toggle("active", isActive)
  })
}
```

## 最终效果描述

打开页面，一个金属质感的产品模型悬浮在深色背景中，表面反射着周围的环境光，Bloom 让高光处微微发光。

向下滚动，画面突然变成卡通风格——光照变成清晰的色块边界，黑色描边出现，整个画面变得简洁有力。

继续滚动，画面开始"出错"——水平条纹撕裂画面，RGB 通道错位，像老式电视机的信号干扰。

再滚动，画面安静下来，变成电影般的低饱和度色调，运动模糊让相机的移动带有拖影，暗角把视线引向画面中央。

最后一段，模型碎裂成上万个发光粒子，在空间中重新流动、聚合，回到原始形态。

## 练习

### 练习一：添加第六种风格——赛博朋克

高对比度、霓虹色、大量 Bloom、扫描线、低角度灯光。色调偏向品红和青色。

### 练习二：风格混合

不是完全切换，而是在两种风格之间做平滑过渡。比如从 PBR 到 Toon 的过渡中，光照从连续渐变逐渐离散化，描边从透明逐渐显现。

---

## 参考答案

### 练习一

**思路**：赛博朋克 = 色调映射偏移 + 强 Bloom + 扫描线。

```ts
const cyberpunkShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
  },
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      
      // 高对比度
      color.rgb = pow(color.rgb, vec3(1.2));
      
      // 色调偏移：暗部偏青，亮部偏品红
      float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      vec3 shadowTint = vec3(0.0, 0.3, 0.5); // 青
      vec3 highlightTint = vec3(0.5, 0.0, 0.3); // 品红
      color.rgb = mix(color.rgb * shadowTint * 2.0, color.rgb * highlightTint * 2.0, luminance);
      
      // 扫描线
      float scanline = sin(vUv.y * 600.0 + uTime) * 0.05;
      color.rgb -= scanline;
      
      // 暗角
      vec2 vig = vUv * (1.0 - vUv);
      color.rgb *= pow(vig.x * vig.y * 15.0, 0.3);
      
      gl_FragColor = color;
    }
  `,
}
```

### 练习二

**思路**：用 `mixFactor` uniform 混合两种风格的后处理效果。

```ts
// 渐进式 Toon 化
const toonMixShader = {
  uniforms: {
    tDiffuse: { value: null },
    uToonMix: { value: 0 }, // 0=PBR, 1=Toon
  },
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uToonMix;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      
      // 连续 → 离散的过渡
      float steps = mix(256.0, 4.0, uToonMix); // 256=连续, 4=卡通
      float quantized = floor(luminance * steps) / steps;
      
      color.rgb *= mix(1.0, quantized / max(luminance, 0.001), uToonMix);
      
      gl_FragColor = color;
    }
  `,
}
```

**常见错误**：两种风格的后处理链如果 pass 数量差异很大，切换时会有明显的性能波动。可以用一个统一的 composer，通过 uniform 控制效果开关，避免频繁创建/销毁 pass。
