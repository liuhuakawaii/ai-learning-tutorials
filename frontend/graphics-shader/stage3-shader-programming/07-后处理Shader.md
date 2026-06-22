# 后处理 Shader

## 场景引入

当你在游戏中看到柔和的光晕、画面边缘的暗角、运动模糊的拖影，这些效果并不是直接渲染出来的，而是对已经渲染好的画面进行二次处理——这就是后处理（Post Processing）。后处理 Shader 运行在全屏四边形上，读取渲染结果作为纹理，对每个像素应用各种图像处理算法。它是提升画面质感最高效的方式，也是 Shader 应用最广泛的领域之一。

## 学习目标

1. 理解 EffectComposer 的 Pass 架构
2. 掌握屏幕空间坐标的使用方法
3. 实现高斯模糊、Bloom、色调映射等常见后处理效果
4. 学会组合多个 Pass 实现复杂的后处理链

---

## 一、EffectComposer 架构

### 1.1 Pass 流水线

```
EffectComposer 的 Pass 流水线：

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ RenderPass  │────→│ BloomPass   │────→│ ToneMapPass │────→│ OutputPass  │
│ (渲染场景)   │     │ (提取亮部+  │     │ (色调映射)   │     │ (输出到屏幕) │
│             │     │  高斯模糊)   │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
  读写 Buffer A      读 Buffer A          读 Buffer B         读 Buffer C
  (场景颜色)         写 Buffer B          写 Buffer C         写屏幕
                    (亮部纹理)           (最终颜色)
```

### 1.2 Three.js 中搭建 EffectComposer

```typescript
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

// 创建渲染目标
const renderTarget = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,  // 使用半浮点精度
    }
);

// 创建 EffectComposer
const composer = new EffectComposer(renderer, renderTarget);

// 添加 Pass
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.5,   // 强度
    0.4,   // 半径
    0.85   // 阈值
);
composer.addPass(bloomPass);

// 渲染循环
function animate() {
    composer.render();  // 替代 renderer.render(scene, camera)
    requestAnimationFrame(animate);
}
```

---

## 二、屏幕空间坐标

### 2.1 全屏四边形的顶点着色器

后处理 Shader 运行在一个覆盖整个屏幕的四边形上：

```glsl
// 后处理专用顶点着色器
attribute vec2 aPosition;

varying vec2 vUv;

void main() {
    // 将 [-1,1] 的 NDC 坐标映射到 [0,1] 的 UV
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
```

**坐标系映射**：

```
NDC 坐标 (-1~1)           UV 坐标 (0~1)

(-1,1)────────(1,1)       (0,1)────────(1,1)
  │              │           │              │
  │      ●       │    →      │      ●       │
  │   (0,0)      │           │   (0.5,0.5)  │
  │              │           │              │
(-1,-1)───────(1,-1)      (0,0)────────(1,0)
```

### 2.2 像素坐标

```glsl
uniform vec2 uResolution;  // 屏幕分辨率

varying vec2 vUv;

void main() {
    // 像素坐标
    vec2 pixel = vUv * uResolution;

    // 宽高比校正后的 UV
    float aspect = uResolution.x / uResolution.y;
    vec2 uv = vUv;
    uv.x *= aspect;

    // 纹素大小（一个像素对应的 UV 增量）
    vec2 texelSize = 1.0 / uResolution;
}
```

---

## 三、高斯模糊（分离式）

### 3.1 原理

高斯模糊是图像处理中最基础的操作。直接的 2D 卷积计算量是 O(n²)，但高斯核是可分离的——可以分解为水平和垂直两次 1D 卷积，计算量降为 O(2n)。

```
分离式高斯模糊：

原始图像          水平模糊           垂直模糊（最终结果）
┌───────┐        ┌───────┐         ┌───────┐
│░░░░░░░│   →    │▒▒▒▒▒▒▒│    →    │▓▓▓▓▓▓▓│
│░░░░░░░│        │▒▒▒▒▒▒▒│         │▓▓▓▓▓▓▓│
│░░░░░░░│        │▒▒▒▒▒▒▒│         │▓▓▓▓▓▓▓│
└───────┘        └───────┘         └───────┘

Pass 1: 水平方向采样相邻像素    Pass 2: 垂直方向采样相邻像素
每像素采样 2n+1 次              每像素采样 2n+1 次
总计：2×(2n+1) 次采样           vs 直接卷积：(2n+1)² 次采样
```

### 3.2 实现

```glsl
// 高斯模糊片元着色器
precision mediump float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uDirection;  // (1,0) = 水平, (0,1) = 垂直
uniform float uRadius;

varying vec2 vUv;

void main() {
    vec2 texelSize = 1.0 / uResolution;
    vec3 result = vec3(0.0);
    float totalWeight = 0.0;

    // 9-tap 高斯核
    for (float i = -4.0; i <= 4.0; i += 1.0) {
        float weight = exp(-0.5 * (i * i) / (uRadius * uRadius));
        vec2 offset = uDirection * texelSize * i;
        result += texture2D(uTexture, vUv + offset).rgb * weight;
        totalWeight += weight;
    }

    gl_FragColor = vec4(result / totalWeight, 1.0);
}
```

**TypeScript 端设置**：

```typescript
const blurShader = {
    uniforms: {
        uTexture: { value: null },
        uResolution: { value: new THREE.Vector2() },
        uDirection: { value: new THREE.Vector2() },
        uRadius: { value: 4.0 },
    },
    vertexShader: postProcessVertexShader,
    fragmentShader: blurFragmentShader,
};

// 水平模糊 Pass
const hBlurPass = new ShaderPass(blurShader);
hBlurPass.uniforms.uDirection.value.set(1, 0);
composer.addPass(hBlurPass);

// 垂直模糊 Pass
const vBlurPass = new ShaderPass(blurShader);
vBlurPass.uniforms.uDirection.value.set(0, 1);
composer.addPass(vBlurPass);
```

---

## 四、Bloom 效果

### 4.1 原理

Bloom 让画面中高亮的区域产生光晕效果：

```
Bloom 流程：

原始场景          提取亮部           模糊亮部           合成
┌───────┐        ┌───────┐         ┌───────┐         ┌───────┐
│   ●   │   →    │   ●   │    →    │ ░░●░░ │    →    │ ░░●░░ │
│  ███  │        │  ███  │         │░░███░░│         │░░███░░│
│       │        │       │         │ ░░░░░ │         │       │
└───────┘        └───────┘         └───────┘         └───────┘
亮度 > 阈值的     用亮度阈值         高斯模糊            原始 + 模糊
像素保留          提取高亮区域        扩散光晕            = 最终效果
```

### 4.2 实现

```glsl
// 亮部提取 Pass
precision mediump float;

uniform sampler2D uTexture;
uniform float uThreshold;

varying vec2 vUv;

void main() {
    vec4 color = texture2D(uTexture, vUv);

    // 计算亮度
    float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));

    // 提取超过阈值的部分
    float soft = uThreshold - 0.2;
    float contribution = smoothstep(soft, uThreshold, brightness);

    gl_FragColor = vec4(color.rgb * contribution, 1.0);
}
```

```glsl
// Bloom 合成 Pass
precision mediump float;

uniform sampler2D uScene;       // 原始场景
uniform sampler2D uBloom;       // 模糊后的亮部
uniform float uIntensity;

varying vec2 vUv;

void main() {
    vec4 sceneColor = texture2D(uScene, vUv);
    vec4 bloomColor = texture2D(uBloom, vUv);

    // 叠加混合
    vec3 result = sceneColor.rgb + bloomColor.rgb * uIntensity;

    // 可选：使用阈值混合，避免整体过亮
    // float bloomMask = smoothstep(0.0, 1.0, bloomColor.r);
    // result = mix(sceneColor.rgb, sceneColor.rgb + bloomColor.rgb, bloomMask);

    gl_FragColor = vec4(result, 1.0);
}
```

---

## 五、色调映射（Tone Mapping）

### 5.1 为什么需要色调映射？

渲染管线通常在 HDR（高动态范围）下计算，最终显示器只能显示 LDR（低动态范围）。色调映射将 HDR 值压缩到 [0,1] 范围：

```
HDR → LDR 映射：

亮度
  ▲
  │        ╭─────────── HDR 原始值（可能 >1.0）
  │      ╭─╯
  │    ╭─╯
  │  ╭─╯        ┌─────────── Reinhard 映射
  │╭─╯        ╭─┘
  ├╯─────────╭╯
  │        ╭─╯    ┌─────────── ACES 映射
  │      ╭─╯    ╭─┘
  │    ╭─╯    ╭─╯
  │──╭─╯────╭─╯
  └──┴──────┴─────────────→ 输入亮度
  0   1     10   100
```

### 5.2 Reinhard 色调映射

```glsl
// Reinhard 算法
vec3 reinhardToneMapping(vec3 color) {
    return color / (1.0 + color);
}

// Reinhard 扩展版（可调最大亮度）
vec3 reinhardExtended(vec3 color, float maxWhite) {
    vec3 numerator = color * (1.0 + color / (maxWhite * maxWhite));
    return numerator / (1.0 + color);
}
```

### 5.3 ACES 色调映射（推荐）

```glsl
// ACES 近似（电影工业标准）
vec3 acesToneMapping(vec3 color) {
    // ACES 拟合曲线
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;

    return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
}

// 完整的色调映射 Pass
precision mediump float;

uniform sampler2D uTexture;
uniform float uExposure;

varying vec2 vUv;

void main() {
    vec4 color = texture2D(uTexture, vUv);

    // 曝光调整
    color.rgb *= uExposure;

    // ACES 色调映射
    color.rgb = acesToneMapping(color.rgb);

    // Gamma 校正
    color.rgb = pow(color.rgb, vec3(1.0 / 2.2));

    gl_FragColor = color;
}
```

---

## 六、Vignette（暗角）

```glsl
// 暗角效果
precision mediump float;

uniform sampler2D uTexture;
uniform float uRadius;      // 暗角半径 (0~1)
uniform float uSoftness;    // 边缘柔和度

varying vec2 vUv;

void main() {
    vec4 color = texture2D(uTexture, vUv);

    // 计算到中心的距离
    vec2 center = vUv - 0.5;
    float dist = length(center);

    // 暗角遮罩
    float vignette = smoothstep(uRadius, uRadius - uSoftness, dist);

    color.rgb *= vignette;

    gl_FragColor = color;
}
```

```
暗角效果示意：

┌─────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ▓ = 暗角区域
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓░░░░░░░░░▓▓▓▓▓│  ░ = 正常亮度
│▓▓▓▓▓░░░░░░░░░▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
└─────────────────────┘
```

---

## 七、色差（Chromatic Aberration）

```glsl
// 色差效果：RGB 通道偏移
precision mediump float;

uniform sampler2D uTexture;
uniform float uOffset;      // 偏移强度

varying vec2 vUv;

void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);

    // 距离中心越远，偏移越大
    vec2 dir = normalize(center);
    float offset = dist * uOffset;

    // 三通道分别采样
    float r = texture2D(uTexture, vUv + dir * offset * 0.01).r;
    float g = texture2D(uTexture, vUv).g;
    float b = texture2D(uTexture, vUv - dir * offset * 0.01).b;

    gl_FragColor = vec4(r, g, b, 1.0);
}
```

```
色差效果示意：

正常：                色差后：
┌──────────┐         ┌──────────┐
│  R G B   │         │  R  G  B │  ← 三通道在边缘分离
│  R G B   │    →    │  R  G  B │
│  R G B   │         │  R  G  B │
└──────────┘         └──────────┘
```

---

## 八、自定义后处理 Pass

### 8.1 完整的后处理 Pass 模板

```typescript
// 自定义后处理 Pass
const customPostProcess = {
    uniforms: {
        tDiffuse: { value: null },      // 上一个 Pass 的输出
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2() },
        uIntensity: { value: 1.0 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        precision mediump float;

        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform float uIntensity;

        varying vec2 vUv;

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);

            // 自定义效果
            // ...

            gl_FragColor = color;
        }
    `,
};

// 使用
const pass = new ShaderPass(customPostProcess);
composer.addPass(pass);
```

### 8.2 链式组合示例

```typescript
// 创建后处理链
const composer = new EffectComposer(renderer);

// 1. 渲染场景
composer.addPass(new RenderPass(scene, camera));

// 2. Bloom
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height), 0.5, 0.4, 0.85
);
composer.addPass(bloomPass);

// 3. 色调映射
const toneMapPass = new ShaderPass(ToneMapShader);
composer.addPass(toneMapPass);

// 4. 暗角
const vignettePass = new ShaderPass(VignetteShader);
vignettePass.uniforms.uRadius.value = 0.75;
vignettePass.uniforms.uSoftness.value = 0.3;
composer.addPass(vignettePass);

// 5. 色差
const chromaticPass = new ShaderPass(ChromaticAberrationShader);
chromaticPass.uniforms.uOffset.value = 0.5;
composer.addPass(chromaticPass);

// 最后一个 Pass 输出到屏幕
const outputPass = new ShaderPass(CopyShader);
outputPass.renderToScreen = true;
composer.addPass(outputPass);
```

---

## 常见误区

1. **精度问题**：后处理 Shader 中间结果可能超出 [0,1] 范围（HDR）。使用 `HalfFloatType` 或 `FloatType` 的 RenderTarget，否则会丢失高亮细节。

2. **模糊半径与性能**：高斯模糊的半径越大，采样次数越多。大半径模糊应使用多 Pass 降采样（如先缩小到 1/2，模糊，再放大）。

3. **Pass 顺序很重要**：色调映射应在 Bloom 之后（否则 Bloom 的亮度阈值会失效），Gamma 校正应在最后。

4. **纹理过滤模式**：后处理的 RenderTarget 应使用 `LinearFilter`，否则缩放时会出现锯齿。

---

## 工程建议

1. **使用 HalfFloat 精度**：HDR 渲染和后处理链应使用 `THREE.HalfFloatType`，在精度和性能之间取得平衡。

2. **合理设置 Pass 数量**：每个 Pass 都是一次全屏绘制。移动端应控制在 3-5 个 Pass 以内。

3. **降采样优化模糊**：Bloom 的模糊可以在 1/2 或 1/4 分辨率下进行，大幅减少计算量。

4. **性能监控**：使用 Spector.js 或浏览器 DevTools 监控每个 Pass 的绘制调用和纹理使用，找出瓶颈。

---

## 小结

后处理 Shader 是提升画面质感的核心技术。本课讲解了 EffectComposer 的 Pass 架构、屏幕空间坐标、高斯模糊（分离式）、Bloom 效果、色调映射（Reinhard/ACES）、暗角和色差等常见后处理效果的实现。掌握这些技术后，你就能为任何 3D 场景添加专业的视觉效果。

## 练习

1. 实现一个完整的后处理链：RenderPass → Bloom → ACES Tone Mapping → Vignette → Chromatic Aberration。

2. 实现运动模糊效果：使用上一帧和当前帧的 MVP 矩阵计算速度，沿速度方向模糊。

3. 编写一个屏幕空间的景深（DOF）效果：根据深度图对近处和远处的像素进行模糊。

4. 实现一个像素化效果：将画面缩小到低分辨率再放大，产生像素风格的视觉效果。

---

## 参考答案

### 练习一

**思路**：完整的后处理链需要按顺序串联多个 Pass：RenderPass 渲染场景 → Bloom 提取亮部并模糊 → ACES 色调映射压缩 HDR → Vignette 压暗边缘 → Chromatic Aberration 模拟色差。每个 Pass 读取上一个 Pass 的输出作为输入。

**答案**：
```glsl
// Bloom Pass - 亮部提取（片元着色器）
precision mediump float;

uniform sampler2D uTexture;
uniform float uThreshold;

varying vec2 vUv;

void main() {
    vec4 color = texture2D(uTexture, vUv);
    float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 extracted = color.rgb * smoothstep(uThreshold, uThreshold + 0.1, brightness);
    gl_FragColor = vec4(extracted, 1.0);
}
```

```glsl
// ACES Tone Mapping Pass
precision mediump float;

uniform sampler2D uTexture;

varying vec2 vUv;

vec3 ACESFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
    vec4 color = texture2D(uTexture, vUv);
    vec3 mapped = ACESFilm(color.rgb);
    gl_FragColor = vec4(mapped, 1.0);
}
```

```glsl
// Vignette + Chromatic Aberration Pass
precision mediump float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uVignetteStrength;
uniform float uChromaticAmount;

varying vec2 vUv;

void main() {
    vec2 uv = vUv;

    // 暗角
    vec2 center = uv - 0.5;
    float dist = length(center);
    float vignette = 1.0 - dist * dist * uVignetteStrength;
    vignette = clamp(vignette, 0.0, 1.0);

    // 色差（沿径向偏移 RGB 通道）
    float chromatic = uChromaticAmount * dist;
    vec2 dir = normalize(center);
    vec2 uvR = uv - dir * chromatic;
    vec2 uvB = uv + dir * chromatic;

    float r = texture2D(uTexture, uvR).r;
    float g = texture2D(uTexture, uv).g;
    float b = texture2D(uTexture, uvB).b;

    vec3 color = vec3(r, g, b) * vignette;
    gl_FragColor = vec4(color, 1.0);
}
```

```typescript
// TypeScript 端组装后处理链
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.5, 0.4, 0.85
);
composer.addPass(bloomPass);

const toneMappingPass = new ShaderPass(ACESMaterial);
composer.addPass(toneMappingPass);

const vignettePass = new ShaderPass(VignetteChromaticMaterial);
composer.addPass(vignettePass);
```

**要点**：
- 后处理链的顺序很重要：Bloom 在 Tone Mapping 之前（需要 HDR 数据），Vignette/色差在最后
- ACES 色调映射公式来自电影工业标准，比 Reinhard 更好地保留暗部和亮部细节
- 色差效果沿径向偏移，边缘处偏移最大，模拟真实镜头的色散

---

### 练习二

**思路**：运动模糊的核心思想是：用当前帧和上一帧的 MVP 矩阵计算每个像素的运动速度（velocity），然后沿速度方向多次采样并取平均。关键是将世界坐标从当前帧变换到上一帧的 NDC 空间，差值就是速度向量。

**答案**：
```glsl
// 运动模糊 - 片元着色器
precision mediump float;

uniform sampler2D uTexture;      // 当前帧颜色
uniform sampler2D uDepthTexture; // 当前帧深度
uniform mat4 uCurrentMVP;
uniform mat4 uPreviousMVP;       // 上一帧的 MVP
uniform float uBlurStrength;
uniform int uSampleCount;

varying vec2 vUv;

// 从深度重建 NDC 坐标
vec3 reconstructPosition(vec2 uv, float depth) {
    vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    return ndc.xyz;
}

void main() {
    // 读取深度并重建当前位置
    float depth = texture2D(uDepthTexture, vUv).r;
    vec3 currentNDC = reconstructPosition(vUv, depth);

    // 变换到上一帧的 NDC 空间
    vec4 worldPos = inverse(uCurrentMVP) * vec4(currentNDC, 1.0);
    vec4 prevNDC = uPreviousMVP * worldPos;
    vec2 prevUV = prevNDC.xy / prevNDC.w * 0.5 + 0.5;

    // 速度向量
    vec2 velocity = (vUv - prevUV) * uBlurStrength;

    // 沿速度方向多次采样
    vec3 color = texture2D(uTexture, vUv).rgb;
    float total = 1.0;

    for (int i = 1; i < 16; i++) {
        if (i >= uSampleCount) break;
        float t = float(i) / float(uSampleCount - 1);
        vec2 sampleUv = vUv + velocity * t;
        color += texture2D(uTexture, sampleUv).rgb;
        total += 1.0;
    }

    gl_FragColor = vec4(color / total, 1.0);
}
```

**要点**：
- `uPreviousMVP` 需要在每帧结束后保存当前 MVP，下一帧使用
- 深度为 1.0 的像素（天空）不应产生运动模糊，需要特殊处理
- `uBlurStrength` 控制模糊强度，通常 0.5-1.5 之间
- 采样次数 `uSampleCount` 越多越平滑，但性能开销线性增长

---

### 练习三

**思路**：景深（DOF）模拟真实相机的对焦效果：对焦平面上的物体清晰，近处和远处的物体模糊。实现方式是：根据深度图计算每个像素到对焦平面的距离，距离越大模糊半径越大，然后用可变半径的高斯模糊处理。

**答案**：
```glsl
// 景深效果 - 片元着色器
precision mediump float;

uniform sampler2D uTexture;
uniform sampler2D uDepthTexture;
uniform float uFocusDepth;      // 对焦距离
uniform float uFocusRange;      // 清晰范围
uniform float uBlurRadius;      // 最大模糊半径
uniform vec2 uResolution;

varying vec2 vUv;

float getBlurAmount(float depth) {
    // 将深度线性化
    float linearDepth = depth;  // 假设已经线性化

    // 计算到对焦平面的距离
    float dist = abs(linearDepth - uFocusDepth);

    // 在清晰范围内不模糊，范围外逐渐增大模糊
    float blur = smoothstep(uFocusRange, uFocusRange * 3.0, dist) * uBlurRadius;

    return blur;
}

void main() {
    float depth = texture2D(uDepthTexture, vUv).r;
    float blur = getBlurAmount(depth);

    // 可变半径的散景模糊（圆形核）
    vec3 color = vec3(0.0);
    float total = 0.0;

    // 根据模糊半径决定采样范围
    int samples = int(blur * 20.0);
    samples = clamp(samples, 1, 20);

    for (int x = -10; x <= 10; x++) {
        for (int y = -10; y <= 10; y++) {
            vec2 offset = vec2(float(x), float(y)) / uResolution * blur;
            float weight = 1.0 - length(vec2(x, y)) / 14.14;
            weight = max(weight, 0.0);
            weight *= weight;  // 圆形核衰减

            color += texture2D(uTexture, vUv + offset).rgb * weight;
            total += weight;
        }
    }

    gl_FragColor = vec4(color / total, 1.0);
}
```

**要点**：
- 线性深度非常重要：透视投影的深度是非线性的，直接使用会导致近处模糊范围过大
- `smoothstep(focusRange, focusRange * 3.0, dist)` 产生平滑的模糊过渡
- 散景形状由核函数决定：圆形核（`weight = 1.0 - r`）模拟光圈形状
- 实际项目中通常分两步：先水平模糊，再垂直模糊（分离式高斯）

---

### 练习四

**思路**：像素化效果的核心是将 UV 坐标量化到低分辨率网格，然后用量化后的 UV 采样纹理。这样每个"像素块"内的所有片元都采样同一个 UV 坐标，产生像素风格。

**答案**：
```glsl
// 像素化效果 - 片元着色器
precision mediump float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uPixelSize;  // 像素大小（如 4.0 表示 4x4 像素块）

varying vec2 vUv;

void main() {
    // 将 UV 量化到低分辨率网格
    vec2 pixelGrid = uResolution / uPixelSize;
    vec2 quantizedUv = floor(vUv * pixelGrid) / pixelGrid;

    // 在像素块中心采样（避免边缘伪影）
    vec2 centerUv = quantizedUv + 0.5 / pixelGrid;

    vec3 color = texture2D(uTexture, centerUv).rgb;

    // 可选：添加像素网格线
    vec2 pixelFract = fract(vUv * pixelGrid);
    float gridLine = step(0.95, pixelFract.x) + step(0.95, pixelFract.y);
    gridLine = min(gridLine, 1.0);
    color = mix(color, vec3(0.0), gridLine * 0.3);

    gl_FragColor = vec4(color, 1.0);
}
```

**要点**：
- `floor(uv * gridSize) / gridSize` 是 UV 量化的标准公式
- 加上 `0.5 / gridSize` 使采样点在像素块中心，避免边缘插值
- 网格线是可选的，`step(0.95, fract)` 在像素块边缘产生 1 像素的线
- `uPixelSize` 越大，像素化效果越明显（每个块越大）
