# 阶段实战 - Shader 特效合集

## 场景引入

前九课学习了 GLSL 语法、顶点和片元着色器、Uniform/Varying、噪声函数、SDF、后处理、Compute Shader 和开发调试工具。现在是时候将这些知识综合运用，实现一组经典的 Shader 特效。本课将实现五个在游戏和交互应用中常见的效果：全息投影、溶解效果、扫描线、水波纹和菲涅尔发光。每个效果都包含完整的代码和原理说明，可以直接应用到你的项目中。

## 学习目标

1. 掌握全息投影效果的实现原理（扫描线 + 边缘发光）
2. 理解溶解效果的噪声采样与 discard 技术
3. 实现扫描线效果的时间驱动动画
4. 掌握水波纹的 UV 扰动技术
5. 理解菲涅尔发光的物理原理与 Shader 实现

---

## 一、全息投影效果

### 1.1 效果说明

模拟科幻电影中的全息投影：物体表面有水平扫描线，边缘有发光效果，整体带有闪烁和抖动。

### 1.2 实现原理

```
全息投影的视觉组成：

  ┌─────────────────────────┐
  │ ░░░░░░░░░░░░░░░░░░░░░░░ │ ← 水平扫描线（周期性条纹）
  │ ░░░░░░░░░░░░░░░░░░░░░░░ │
  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← 边缘发光（Fresnel）
  │ ░░░░░░░░░░░░░░░░░░░░░░░ │
  │ ░░░░░░░░░░░░░░░░░░░░░░░ │ ← 时间抖动（uTime 驱动）
  └─────────────────────────┘
     透明度随扫描线变化
     颜色通常为青色/蓝色
```

### 1.3 完整代码

```glsl
// 全息投影 - 顶点着色器
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uTime;

attribute vec3 aPosition;
attribute vec3 aNormal;

varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec2 vUv;

void main() {
    vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(uModelMatrix) * aNormal);
    vUv = aPosition.xy;  // 使用位置作为 UV

    gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
}
```

```glsl
// 全息投影 - 片元着色器
precision mediump float;

uniform float uTime;
uniform vec3 uHoloColor;       // 全息颜色（通常为青色）
uniform float uScanSpeed;      // 扫描线速度
uniform float uScanFrequency;  // 扫描线频率
uniform float uFlickerSpeed;   // 闪烁速度

varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec2 vUv;

void main() {
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    vec3 normal = normalize(vWorldNormal);

    // 1. Fresnel 边缘发光
    float fresnel = 1.0 - abs(dot(normal, viewDir));
    fresnel = pow(fresnel, 2.0);

    // 2. 水平扫描线
    float scanLine = sin(vWorldPos.y * uScanFrequency - uTime * uScanSpeed);
    scanLine = scanLine * 0.5 + 0.5;  // 映射到 [0, 1]
    scanLine = pow(scanLine, 4.0);     // 增加对比度

    // 3. 垂直扫描波
    float scanWave = sin(vWorldPos.y * 2.0 + uTime * 3.0);
    scanWave = smoothstep(0.8, 1.0, scanWave);

    // 4. 闪烁效果
    float flicker = sin(uTime * uFlickerSpeed) * 0.1 + 0.9;
    flicker *= sin(uTime * uFlickerSpeed * 1.3) * 0.05 + 0.95;

    // 5. 组合效果
    float alpha = fresnel * 0.8 + scanLine * 0.3 + scanWave * 0.5;
    alpha *= flicker;
    alpha = clamp(alpha, 0.0, 1.0);

    // 6. 颜色
    vec3 color = uHoloColor * alpha;

    // 7. 添加一些随机噪点
    float noise = fract(sin(dot(vWorldPos.xy, vec2(12.9898, 78.233))) * 43758.5453);
    color += vec3(noise * 0.05);

    gl_FragColor = vec4(color, alpha);
}
```

```typescript
// TypeScript 端使用
const holoMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uHoloColor: { value: new THREE.Color(0, 1, 1) },  // 青色
        uScanSpeed: { value: 2.0 },
        uScanFrequency: { value: 10.0 },
        uFlickerSpeed: { value: 5.0 },
        uCameraPos: { value: camera.position },
    },
    vertexShader: holoVertexShader,
    fragmentShader: holoFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
});

// 动画循环
function animate() {
    holoMaterial.uniforms.uTime.value = performance.now() / 1000;
    holoMaterial.uniforms.uCameraPos.value.copy(camera.position);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
```

---

## 二、溶解效果

### 2.1 效果说明

物体从某个区域开始逐渐溶解消失，溶解边缘有发光效果。常用于角色死亡、物体消失等游戏场景。

### 2.2 实现原理

```
溶解效果原理：

噪声纹理              溶解阈值              最终效果
┌───────┐            ┌───────┐            ┌───────┐
│▓░▓▓░▓▓│            │████░░░│            │▓▓▓▓   │
│░▓▓▓▓▓░│     ×      │████░░░│     =      │  ▓▓   │
│▓▓░▓▓▓▓│            │████░░░│            │▓▓     │
│▓▓▓▓░▓░│            │████░░░│            │▓▓▓    │
└───────┘            └───────┘            └───────┘
噪声值 < 阈值         阈值从左到右递增       左侧保留，右侧溶解
的区域被丢弃                              边缘有发光
```

### 2.3 完整代码

```glsl
// 溶解效果 - 片元着色器
precision mediump float;

uniform sampler2D uDiffuseMap;       // 漫反射贴图
uniform sampler2D uNoiseTexture;     // 噪声纹理
uniform float uDissolveAmount;       // 溶解程度 (0~1)
uniform float uEdgeWidth;            // 发光边缘宽度
uniform vec3 uEdgeColor;             // 边缘发光颜色
uniform float uEdgeGlow;             // 边缘发光强度

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

// 将噪声值映射到溶解阈值
float dissolveThreshold(float amount, float edgeWidth) {
    return amount * (1.0 + edgeWidth);
}

void main() {
    // 采样漫反射贴图
    vec4 diffuseColor = texture2D(uDiffuseMap, vUv);

    // 采样噪声纹理
    float noise = texture2D(uNoiseTexture, vUv).r;

    // 计算溶解阈值
    float threshold = dissolveThreshold(uDissolveAmount, uEdgeWidth);

    // 1. 完全溶解的区域：丢弃
    if (noise < uDissolveAmount) {
        discard;
    }

    // 2. 边缘发光区域
    float edgeFactor = 0.0;
    if (noise < threshold) {
        // 在溶解边缘，计算发光强度
        edgeFactor = 1.0 - (noise - uDissolveAmount) / uEdgeWidth;
        edgeFactor = pow(edgeFactor, 2.0);
    }

    // 3. 光照计算
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    vec3 normal = normalize(vWorldNormal);
    float NdotL = max(dot(normal, lightDir), 0.0);
    vec3 lighting = diffuseColor.rgb * (0.3 + 0.7 * NdotL);

    // 4. 混合边缘发光
    vec3 finalColor = mix(lighting, uEdgeColor * uEdgeGlow, edgeFactor);

    // 5. 透明度（用于半透明边缘）
    float alpha = 1.0;
    if (noise < threshold) {
        alpha = smoothstep(uDissolveAmount, threshold, noise);
    }

    gl_FragColor = vec4(finalColor, alpha);
}
```

```typescript
// 溶解动画控制
class DissolveEffect {
    private material: THREE.ShaderMaterial;
    private dissolveAmount: number = 0;
    private isDissolving: boolean = false;
    private dissolveSpeed: number = 0.5;

    constructor(mesh: THREE.Mesh) {
        // 生成噪声纹理
        const noiseTexture = this.generateNoiseTexture(256, 256);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uDiffuseMap: { value: mesh.material.map },
                uNoiseTexture: { value: noiseTexture },
                uDissolveAmount: { value: 0 },
                uEdgeWidth: { value: 0.1 },
                uEdgeColor: { value: new THREE.Color(1, 0.3, 0) },  // 橙色边缘
                uEdgeGlow: { value: 2.0 },
            },
            vertexShader: dissolveVertexShader,
            fragmentShader: dissolveFragmentShader,
            transparent: true,
        });

        mesh.material = this.material;
    }

    private generateNoiseTexture(width: number, height: number): THREE.DataTexture {
        const data = new Uint8Array(width * height * 4);
        for (let i = 0; i < width * height; i++) {
            const value = Math.random() * 255;
            data[i * 4] = value;
            data[i * 4 + 1] = value;
            data[i * 4 + 2] = value;
            data[i * 4 + 3] = 255;
        }
        const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
        texture.needsUpdate = true;
        return texture;
    }

    startDissolve() {
        this.isDissolving = true;
        this.dissolveAmount = 0;
    }

    update(deltaTime: number) {
        if (this.isDissolving) {
            this.dissolveAmount += deltaTime * this.dissolveSpeed;
            this.material.uniforms.uDissolveAmount.value = this.dissolveAmount;

            if (this.dissolveAmount >= 1.0) {
                this.isDissolving = false;
            }
        }
    }
}
```

---

## 三、扫描线效果

### 3.1 效果说明

模拟科幻扫描或雷达扫描效果，一个发光的线从物体表面扫过。

### 3.2 实现原理

```
扫描线效果：

时间 t=0                时间 t=0.5              时间 t=1.0
┌───────────┐          ┌───────────┐          ┌───────────┐
│           │          │     │     │          │           │
│     ●     │          │     │     │          │           │
│    ╱│╲    │    →     │     │     │    →     │           │
│   ╱ │ ╲   │          │     │     │          │           │
│  ╱  │  ╲  │          │     ●     │          │     ●     │
│           │          │    ╱│╲    │          │    ╱│╲    │
└───────────┘          └───────────┘          └───────────┘
扫描线从中心向外扩散      扫描线到达中间          扫描线到达边缘
```

### 3.3 完整代码

```glsl
// 扫描线 - 片元着色器
precision mediump float;

uniform float uTime;
uniform vec3 uScanColor;        // 扫描线颜色
uniform float uScanSpeed;       // 扫描速度
uniform float uScanWidth;       // 扫描线宽度
uniform float uScanInterval;    // 扫描间隔
uniform vec3 uCenter;           // 扫描中心点

varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(uCameraPos - vWorldPos);

    // 1. 计算到扫描中心的距离
    float dist = length(vWorldPos.xz - uCenter.xz);

    // 2. 扫描线位置（随时间移动）
    float scanPos = mod(uTime * uScanSpeed, uScanInterval);

    // 3. 扫描线效果
    float scanLine = smoothstep(scanPos - uScanWidth, scanPos, dist)
                   - smoothstep(scanPos, scanPos + uScanWidth, dist);

    // 4. Fresnel 边缘增强
    float fresnel = 1.0 - abs(dot(normal, viewDir));
    fresnel = pow(fresnel, 3.0);

    // 5. 基础材质（假设有一个基础颜色）
    vec3 baseColor = vec3(0.1, 0.1, 0.2);

    // 6. 组合效果
    vec3 finalColor = baseColor + uScanColor * scanLine * 2.0;
    finalColor += uScanColor * fresnel * 0.3;

    // 7. 扫描线经过后的残留发光
    float afterglow = smoothstep(scanPos - uScanWidth * 3.0, scanPos, dist);
    afterglow *= 1.0 - scanLine;
    finalColor += uScanColor * afterglow * 0.2;

    gl_FragColor = vec4(finalColor, 1.0);
}
```

---

## 四、水波纹效果

### 4.1 效果说明

当物体接触水面时产生的波纹扩散效果，或作为全屏后处理效果。

### 4.2 实现原理

```
水波纹 UV 扰动：

原始 UV 网格              波纹扰动后
┌──┬──┬──┬──┐          ┌──┬──┬──┬──┐
│  │  │  │  │          │ ╱│╲ │  │  │
├──┼──┼──┼──┤          ├──┼──┼──┼──┤
│  │  │  │  │    →     │ ╲│╱ │  │  │
├──┼──┼──┼──┤          ├──┼──┼──┼──┤
│  │  │  │  │          │  │  │  │  │
└──┴──┴──┴──┘          └──┴──┴──┴──┘
均匀 UV 坐标             波纹中心附近的 UV 被扰动
                        产生折射效果
```

### 4.3 完整代码

```glsl
// 水波纹 - 片元着色器
precision mediump float;

uniform sampler2D uTexture;         // 原始画面
uniform float uTime;
uniform vec2 uRippleCenter;        // 波纹中心 (UV 坐标)
uniform float uRippleSpeed;        // 波纹扩散速度
uniform float uRippleWidth;        // 波纹宽度
uniform float uRippleStrength;     // 扰动强度
uniform float uRippleDecay;        // 波纹衰减速度

varying vec2 vUv;

float ripple(vec2 uv, vec2 center, float time) {
    float dist = distance(uv, center);

    // 波纹随时间扩散
    float wave = sin(dist * 30.0 - time * uRippleSpeed);
    wave *= exp(-dist * 5.0);  // 距离衰减
    wave *= exp(-time * uRippleDecay);  // 时间衰减

    return wave;
}

void main() {
    vec2 uv = vUv;

    // 1. 计算波纹扰动
    float wave = ripple(uv, uRippleCenter, uTime);

    // 2. UV 扰动（模拟折射）
    vec2 dir = normalize(uv - uRippleCenter);
    vec2 distortedUV = uv + dir * wave * uRippleStrength * 0.02;

    // 3. 采样原始纹理
    vec4 color = texture2D(uTexture, distortedUV);

    // 4. 添加波纹高光
    float highlight = abs(wave) * 0.5;
    color.rgb += vec3(highlight * 0.3);

    // 5. 中心发光
    float dist = distance(uv, uRippleCenter);
    float glow = exp(-dist * 10.0) * exp(-uTime * 2.0);
    color.rgb += vec3(0.2, 0.5, 1.0) * glow;

    gl_FragColor = color;
}
```

```typescript
// 交互式水波纹
class WaterRipple {
    private material: THREE.ShaderMaterial;
    private ripples: Array<{ center: THREE.Vector2, time: number }> = [];

    constructor(texture: THREE.Texture) {
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTexture: { value: texture },
                uTime: { value: 0 },
                uRippleCenter: { value: new THREE.Vector2(0.5, 0.5) },
                uRippleSpeed: { value: 8.0 },
                uRippleStrength: { value: 1.0 },
                uRippleDecay: { value: 1.0 },
            },
            vertexShader: rippleVertexShader,
            fragmentShader: rippleFragmentShader,
        });
    }

    addRipple(x: number, y: number) {
        this.ripples.push({
            center: new THREE.Vector2(x, y),
            time: 0,
        });
    }

    update(deltaTime: number) {
        this.material.uniforms.uTime.value += deltaTime;

        // 更新最近的波纹
        if (this.ripples.length > 0) {
            const ripple = this.ripples[0];
            ripple.time += deltaTime;
            this.material.uniforms.uRippleCenter.value.copy(ripple.center);

            if (ripple.time > 3.0) {
                this.ripples.shift();
            }
        }
    }
}
```

---

## 五、菲涅尔发光

### 5.1 效果说明

菲涅尔效应是自然界中真实存在的光学现象：当视线与表面夹角越小（越接近掠射角），反射越强。这个效果常用于能量护盾、力场、边缘高光等。

### 5.2 物理原理

```
菲涅尔效应示意：

        视线方向
           │
           ▼
    ───────┼─────── 表面
          ╱│╲
         ╱ │ ╲      法线
        ╱  │  ╲
       ╱   │   ╲

正视（0°）：反射弱，透射强     掠射（90°）：反射强，透射弱
┌───────────┐                ┌───────────┐
│           │                │▓▓▓▓▓▓▓▓▓▓▓│
│    淡     │                │▓▓▓ 强 ▓▓▓▓│
│           │                │▓▓▓▓▓▓▓▓▓▓▓│
└───────────┘                └───────────┘

菲涅尔公式（简化）：
F = F0 + (1 - F0) × (1 - cos θ)^5

F0 = 垂直入射时的反射率（如玻璃约 0.04）
θ = 视线与法线的夹角
```

### 5.3 完整代码

```glsl
// 菲涅尔发光 - 片元着色器
precision mediump float;

uniform vec3 uFresnelColor;     // 发光颜色
uniform float uFresnelPower;    // 菲涅尔指数（越大边缘越窄）
uniform float uFresnelStrength; // 发光强度
uniform float uFresnelBias;     // 偏移（控制最小发光）
uniform float uTime;
uniform float uPulseSpeed;      // 脉冲速度

varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(uCameraPos - vWorldPos);

    // 1. 菲涅尔计算
    float cosTheta = abs(dot(normal, viewDir));
    float fresnel = uFresnelBias + (1.0 - uFresnelBias) * pow(1.0 - cosTheta, uFresnelPower);

    // 2. 脉冲效果
    float pulse = sin(uTime * uPulseSpeed) * 0.2 + 0.8;

    // 3. 基础材质颜色（半透明）
    vec3 baseColor = vec3(0.1, 0.1, 0.3);
    float baseAlpha = 0.3;

    // 4. 菲涅尔发光
    vec3 fresnelColor = uFresnelColor * fresnel * uFresnelStrength * pulse;

    // 5. 最终颜色
    vec3 finalColor = baseColor * baseAlpha + fresnelColor;
    float finalAlpha = max(baseAlpha, fresnel);

    gl_FragColor = vec4(finalColor, finalAlpha);
}
```

### 5.4 能量护盾效果

```glsl
// 能量护盾 - 片元着色器
precision mediump float;

uniform vec3 uShieldColor;
uniform float uTime;
uniform float uHitTime;          // 受击时间
uniform vec3 uHitPoint;          // 受击位置
uniform float uHitRadius;        // 受击扩散半径

varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(uCameraPos - vWorldPos);

    // 1. 菲涅尔基础
    float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 3.0);

    // 2. 六边形网格图案
    vec2 hexUV = vWorldPos.xy * 10.0;
    float hex = abs(fract(hexUV.x) - 0.5) + abs(fract(hexUV.y) - 0.5);
    hex = smoothstep(0.4, 0.5, hex);

    // 3. 受击波纹
    float hitDist = distance(vWorldPos, uHitPoint);
    float hitTime = uTime - uHitTime;
    float hitWave = sin(hitDist * 20.0 - hitTime * 10.0);
    hitWave *= smoothstep(uHitRadius, 0.0, hitDist);
    hitWave *= exp(-hitTime * 3.0);  // 衰减

    // 4. 组合效果
    vec3 color = uShieldColor * (fresnel * 1.5 + hex * 0.3 + hitWave * 2.0);
    float alpha = fresnel * 0.8 + hex * 0.2 + hitWave * 0.5;
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha);
}
```

---

## 六、综合应用建议

### 6.1 效果组合

这些效果可以自由组合：

```
组合示例：

全息投影 + 扫描线 = 科幻 UI 元素
溶解 + 菲涅尔 = 能量消散效果
水波纹 + 扫描线 = 雷达波纹
菲涅尔 + 噪声 = 动态能量护盾
```

### 6.2 性能优化

```
效果性能对比：

效果              计算复杂度    纹理采样    适用场景
──────────────────────────────────────────────
全息投影          低           0          角色特效
溶解              中           1          物体消失
扫描线            低           0          环境特效
水波纹            中           1          交互反馈
菲涅尔            低           0          材质增强

移动端建议：
- 避免同时使用多个纹理采样效果
- 减少 sin/cos 调用次数
- 使用 mediump 精度
```

---

## 常见误区

1. **菲涅尔的物理准确性**：游戏中的菲涅尔通常是艺术化处理，不是物理精确的。不要纠结于正确的 F0 值，视觉效果好就行。

2. **溶解效果的噪声纹理选择**：使用蓝噪声（Blue Noise）比白噪声效果更好，过渡更均匀。避免使用程序化噪声，可能会有明显的重复图案。

3. **水波纹的性能问题**：多个波纹叠加时计算量线性增长。限制同时存在的波纹数量，或使用纹理预计算波纹叠加结果。

4. **全息投影的深度测试**：全息效果通常需要关闭深度写入（depthWrite: false），否则会被不透明物体遮挡。

---

## 工程建议

1. **参数化设计**：所有效果的参数都应该通过 Uniform 暴露，方便美术调整。使用 GUI 工具（如 dat.gui、Tweakpane）实时调参。

2. **预计算纹理**：噪声纹理、查找表等应在加载时预计算，不要在 Shader 中实时生成。

3. **效果分层**：复杂效果应该拆分为多个 Pass，每个 Pass 负责一个子效果，最后合成。这样更容易调试和复用。

4. **移动端适配**：为移动端准备简化版本，减少纹理采样和计算复杂度。使用 `#ifdef` 预处理指令区分平台。

---

## 小结

本课实现了五个经典 Shader 特效：全息投影（扫描线 + 边缘发光）、溶解效果（噪声 + discard + 边缘发光）、扫描线（时间驱动的扩散波）、水波纹（UV 扰动 + 折射）、菲涅尔发光（视角相关的边缘发光）。每个效果都包含了完整的原理说明和可运行代码。这些效果是 Shader 编程的基础工具箱，掌握它们后，你就能组合创造出无限的视觉效果。

## 练习

1. 将全息投影和溶解效果组合：物体先显示全息效果，然后逐渐溶解消失。

2. 实现一个交互式水波纹系统：鼠标点击产生波纹，支持多个波纹同时存在和叠加。

3. 为菲涅尔发光添加颜色渐变：根据菲涅尔强度映射不同的颜色（从中心到边缘：蓝 → 青 → 白）。

4. 实现一个受击反馈效果：当物体被击中时，在受击点产生向外扩散的能量波纹，结合菲涅尔发光和扫描线效果。

---

## 参考答案

### 练习一

**思路**：组合全息投影和溶解效果的关键是用一个统一的进度参数（`uProgress`）控制两个效果的时序。先显示全息效果（`uProgress < 0.5`），然后过渡到溶解消失（`uProgress > 0.5`）。溶解部分复用噪声采样 + discard 技术。

**答案**：
```glsl
// 全息溶解 - 顶点着色器
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uTime;

attribute vec3 aPosition;
attribute vec3 aNormal;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
    vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(uModelMatrix) * aNormal);
    vUv = aPosition.xy;
    gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
}
```

```glsl
// 全息溶解 - 片元着色器
precision mediump float;

uniform float uTime;
uniform float uProgress;       // 0 = 正常，0~0.5 = 全息，0.5~1.0 = 溶解
uniform vec3 uHoloColor;
uniform vec3 uCameraPos;
uniform sampler2D uNoiseTex;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;

// 噪声采样
float sampleNoise(vec2 uv) {
    return texture2D(uNoiseTex, uv).r;
}

void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(uCameraPos - vWorldPos);

    // 阶段 1：全息效果（0 ~ 0.5）
    float holoPhase = smoothstep(0.0, 0.3, uProgress);

    // Fresnel 边缘发光
    float fresnel = 1.0 - abs(dot(normal, viewDir));
    fresnel = pow(fresnel, 2.0);

    // 扫描线
    float scanLine = sin(vWorldPos.y * 20.0 - uTime * 3.0) * 0.5 + 0.5;
    scanLine = pow(scanLine, 4.0);

    // 全息颜色
    vec3 holoColor = uHoloColor * (fresnel * 0.8 + scanLine * 0.3 + 0.1);
    float holoAlpha = holoPhase * (fresnel * 0.6 + 0.4);

    // 阶段 2：溶解效果（0.5 ~ 1.0）
    float dissolvePhase = smoothstep(0.4, 1.0, uProgress);

    // 噪声采样
    float noise = sampleNoise(vUv * 2.0);

    // 溶解阈值
    float dissolveThreshold = dissolvePhase * 1.4 - 0.2;  // -0.2 ~ 1.2
    float dissolveEdge = smoothstep(dissolveThreshold - 0.1, dissolveThreshold, noise);

    // 边缘发光
    float edgeGlow = smoothstep(dissolveThreshold, dissolveThreshold + 0.1, noise)
                   * smoothstep(dissolveThreshold + 0.2, dissolveThreshold + 0.1, noise);
    vec3 edgeColor = vec3(1.0, 0.5, 0.2) * edgeGlow * 3.0;

    // discard 溶解区域
    if (dissolvePhase > 0.0 && noise < dissolveThreshold) {
        discard;
    }

    // 组合
    vec3 color = mix(holoColor, edgeColor, dissolvePhase);
    float alpha = mix(holoAlpha, 1.0 - dissolvePhase * 0.5, dissolvePhase);

    // 闪烁
    float flicker = sin(uTime * 8.0) * 0.05 + 0.95;
    color *= flicker;

    gl_FragColor = vec4(color, alpha);
}
```

```typescript
// TypeScript 端控制进度
const material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },     // 0 → 1 的动画进度
        uHoloColor: { value: new THREE.Color(0, 0.8, 1) },
        uCameraPos: { value: camera.position },
        uNoiseTex: { value: noiseTexture },
    },
    vertexShader: vertexSource,
    fragmentShader: fragmentSource,
    transparent: true,
    side: THREE.DoubleSide,
});

// 动画控制
function animateDissolve(duration: number) {
    const startTime = performance.now() / 1000;
    function update() {
        const elapsed = performance.now() / 1000 - startTime;
        material.uniforms.uProgress.value = Math.min(elapsed / duration, 1.0);
        if (elapsed < duration) requestAnimationFrame(update);
    }
    update();
}
```

**要点**：
- `uProgress` 分两个阶段：0~0.5 为全息阶段，0.5~1.0 为溶解阶段
- `dissolveThreshold` 从 -0.2 到 1.2 变化，确保溶解从边缘开始、完全消失
- `edgeGlow` 用两个 `smoothstep` 叠加，在溶解边界产生发光带
- 闪烁效果贯穿整个过程，增强全息感

---

### 练习二

**思路**：交互式水波纹需要支持多个波纹同时存在。每个波纹由点击位置、开始时间、强度等参数定义。在片元着色器中遍历所有活跃波纹，计算每个波纹对当前片元的影响，然后叠加。

**答案**：
```glsl
// 多波纹系统 - 片元着色器
precision mediump float;

#define MAX_RIPPLES 8

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uRipplePos[MAX_RIPPLES];    // 波纹位置
uniform float uRippleTime[MAX_RIPPLES];  // 波纹开始时间
uniform float uRippleIntensity[MAX_RIPPLES]; // 波纹强度
uniform int uRippleCount;                // 当前活跃波纹数

varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    vec3 baseColor = vec3(0.1, 0.2, 0.4);  // 水面基础颜色
    vec2 totalDistortion = vec2(0.0);
    float totalSpecular = 0.0;

    // 遍历所有活跃波纹
    for (int i = 0; i < MAX_RIPPLES; i++) {
        if (i >= uRippleCount) break;

        vec2 rippleCenter = uRipplePos[i];
        float timeSinceStart = uTime - uRippleTime[i];
        float intensity = uRippleIntensity[i];

        // 跳过未激活的波纹
        if (timeSinceStart < 0.0 || intensity < 0.01) continue;

        // 波纹参数
        float speed = 2.0;
        float frequency = 15.0;
        float damping = 3.0;

        // 距离和方向
        vec2 dir = uv - rippleCenter;
        float dist = length(dir);
        vec2 normDir = normalize(dir);

        // 波纹扩散半径
        float waveRadius = timeSinceStart * speed;

        // 波纹形状（环形波）
        float wave = sin((dist - waveRadius) * frequency) * 0.5 + 0.5;
        wave *= smoothstep(waveRadius + 0.1, waveRadius, dist);  // 外边界
        wave *= smoothstep(waveRadius - 0.3, waveRadius, dist);  // 内边界

        // 衰减
        float decay = exp(-timeSinceStart * damping);

        // UV 扰动
        float distortionStrength = wave * intensity * decay * 0.02;
        totalDistortion += normDir * distortionStrength;

        // 高光效果
        totalSpecular += wave * intensity * decay * 0.5;
    }

    // 应用 UV 扰动
    vec2 distortedUv = uv + totalDistortion;

    // 水面纹理（棋盘格用于观察扰动）
    float grid = mod(floor(distortedUv.x * 30.0) + floor(distortedUv.y * 30.0), 2.0);
    vec3 waterColor = mix(baseColor, baseColor * 1.3, grid * 0.3);

    // 叠加波纹高光
    waterColor += vec3(1.0, 0.95, 0.9) * totalSpecular;

    // 菲涅尔（简化）
    float fresnel = 0.3 + 0.2 * totalSpecular;
    waterColor += vec3(0.3, 0.5, 0.7) * fresnel;

    gl_FragColor = vec4(waterColor, 0.95);
}
```

```typescript
// TypeScript 端管理多个波纹
class RippleManager {
    private ripples: Array<{
        position: THREE.Vector2;
        startTime: number;
        intensity: number;
    }> = [];

    addRipple(x: number, y: number) {
        if (this.ripples.length >= 8) {
            this.ripples.shift();  // 移除最旧的波纹
        }
        this.ripples.push({
            position: new THREE.Vector2(x, y),
            startTime: performance.now() / 1000,
            intensity: 1.0,
        });
    }

    update(material: THREE.ShaderMaterial) {
        const uniforms = material.uniforms;
        const now = performance.now() / 1000;

        // 衰减强度，移除过期波纹
        this.ripples = this.ripples.filter(r => {
            r.intensity *= 0.99;
            return r.intensity > 0.01;
        });

        // 上传数据
        for (let i = 0; i < 8; i++) {
            if (i < this.ripples.length) {
                uniforms.uRipplePos.value[i].copy(this.ripples[i].position);
                uniforms.uRippleTime.value[i] = this.ripples[i].startTime;
                uniforms.uRippleIntensity.value[i] = this.ripples[i].intensity;
            }
        }
        uniforms.uRippleCount.value = this.ripples.length;
    }
}

// 使用
const rippleManager = new RippleManager();
canvas.addEventListener('click', (e) => {
    const x = e.clientX / window.innerWidth;
    const y = 1.0 - e.clientY / window.innerHeight;
    rippleManager.addRipple(x, y);
});
```

**要点**：
- `MAX_RIPPLES` 限制最大同时波纹数量，避免循环过长
- 波纹形状由两个 `smoothstep` 夹出一个环形区域
- `exp(-time * damping)` 实现波纹的自然衰减
- UV 扰动的方向是 `normalize(dir)`，从点击点向外扩散

---

### 练习三

**思路**：菲涅尔发光的颜色渐变核心是：根据 Fresnel 强度（0 到 1）在多个颜色锚点之间插值。中心到边缘的渐变映射为蓝 → 青 → 白，使用分段 `mix` 或 `smoothstep` 实现平滑过渡。

**答案**：
```glsl
// 菲涅尔渐变发光 - 片元着色器
precision mediump float;

uniform vec3 uCameraPos;
uniform vec3 uBaseColor;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(uCameraPos - vWorldPos);

    // Fresnel 强度
    float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
    fresnel = pow(fresnel, 2.0);

    // 颜色渐变：蓝 → 青 → 白
    vec3 innerColor = vec3(0.1, 0.3, 0.8);   // 蓝色（中心附近）
    vec3 midColor = vec3(0.0, 0.8, 0.9);     // 青色（中间）
    vec3 outerColor = vec3(1.0, 1.0, 1.0);   // 白色（边缘）

    // 分段插值
    vec3 glowColor;
    if (fresnel < 0.4) {
        glowColor = mix(innerColor, midColor, fresnel / 0.4);
    } else {
        glowColor = mix(midColor, outerColor, (fresnel - 0.4) / 0.6);
    }

    // 可选：使用 smoothstep 实现更平滑的过渡
    // vec3 glowColor = mix(innerColor, midColor, smoothstep(0.0, 0.4, fresnel));
    // glowColor = mix(glowColor, outerColor, smoothstep(0.4, 1.0, fresnel));

    // 最终颜色
    vec3 color = uBaseColor * (1.0 - fresnel) + glowColor * fresnel;

    // 额外的发光强度
    color += glowColor * fresnel * 0.5;

    gl_FragColor = vec4(color, 1.0);
}
```

**要点**：
- Fresnel 的 `pow(fresnel, 2.0)` 指数控制发光的集中程度，值越大发光越集中在边缘
- 分段 `mix` 可以精确控制颜色过渡点，`smoothstep` 版本更平滑但控制精度稍低
- 基础色 `uBaseColor * (1-fresnel)` 确保中心区域保持物体本色
- 发光强度叠加 `+ glowColor * fresnel * 0.5` 使边缘更明亮

---

### 练习四

**思路**：受击反馈效果需要三个核心组件：1) 受击点位置和时间的 Uniform，2) 从受击点向外扩散的能量波纹，3) 菲涅尔发光和扫描线的叠加。能量波纹使用 `sin(dist - time * speed)` 驱动，与扫描线的垂直扩散结合。

**答案**：
```glsl
// 受击反馈 - 片元着色器
precision mediump float;

uniform float uTime;
uniform vec3 uHitPoint;        // 受击点（物体空间）
uniform float uHitTime;        // 受击时间
uniform float uHitIntensity;   // 受击强度（0 = 无受击）
uniform vec3 uCameraPos;
uniform vec3 uBaseColor;
uniform vec3 uEnergyColor;     // 能量颜色（如橙色/红色）

varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float timeSinceHit = uTime - uHitTime;

    // 1. 菲涅尔基础发光
    float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
    fresnel = pow(fresnel, 2.0);

    // 2. 受击能量波纹（从受击点向外扩散）
    float hitDist = length(vWorldPos - uHitPoint);

    // 扩散波
    float waveRadius = timeSinceHit * 3.0;  // 扩散速度
    float waveThickness = 0.2 + timeSinceHit * 0.1;  // 波逐渐变宽
    float wave = smoothstep(waveRadius - waveThickness, waveRadius, hitDist)
               * smoothstep(waveRadius + waveThickness, waveRadius, hitDist);

    // 多层波纹
    float wave2Radius = timeSinceHit * 2.0;
    float wave2 = smoothstep(wave2Radius - 0.15, wave2Radius, hitDist)
                * smoothstep(wave2Radius + 0.15, wave2Radius, hitDist);

    // 衰减
    float hitDecay = exp(-timeSinceHit * 2.0) * uHitIntensity;

    // 3. 扫描线（垂直方向）
    float scanLine = sin(vWorldPos.y * 15.0 - timeSinceHit * 8.0) * 0.5 + 0.5;
    scanLine = pow(scanLine, 3.0);
    float scanWave = sin(vWorldPos.y * 5.0 - timeSinceHit * 4.0);
    scanWave = smoothstep(0.7, 1.0, scanWave);

    // 4. 组合效果
    vec3 baseColor = uBaseColor;

    // 菲涅尔
    vec3 fresnelColor = vec3(0.5, 0.7, 1.0) * fresnel * 0.3;

    // 受击能量
    vec3 hitColor = uEnergyColor * (wave + wave2 * 0.5) * hitDecay * 2.0;
    hitColor += uEnergyColor * scanLine * hitDecay * 0.3;
    hitColor += uEnergyColor * scanWave * hitDecay * 0.5;

    // 边缘发光增强（受击时菲涅尔更亮）
    fresnelColor += uEnergyColor * fresnel * hitDecay * 0.5;

    // 最终颜色
    vec3 color = baseColor + fresnelColor + hitColor;

    // 透明度（受击时边缘更通透）
    float alpha = 1.0 - fresnel * 0.2 * (1.0 + hitDecay);

    gl_FragColor = vec4(color, alpha);
}
```

```typescript
// TypeScript 端控制受击反馈
class HitFeedback {
    private material: THREE.ShaderMaterial;
    private hitIntensity: number = 0;

    constructor(material: THREE.ShaderMaterial) {
        this.material = material;
    }

    trigger(hitPoint: THREE.Vector3) {
        this.material.uniforms.uHitPoint.value.copy(hitPoint);
        this.material.uniforms.uHitTime.value = performance.now() / 1000;
        this.hitIntensity = 1.0;
    }

    update() {
        // 衰减受击强度
        this.hitIntensity *= 0.95;
        this.material.uniforms.uHitIntensity.value = this.hitIntensity;

        // 更新时间
        this.material.uniforms.uTime.value = performance.now() / 1000;
    }
}

// 使用
const hitFeedback = new HitFeedback(hitMaterial);

// 点击物体时触发
raycaster.setFromCamera(mouse, camera);
const intersects = raycaster.intersectObject(targetMesh);
if (intersects.length > 0) {
    hitFeedback.trigger(intersects[0].point);
}

// 动画循环中更新
function animate() {
    hitFeedback.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
```

**要点**：
- `exp(-time * 2.0)` 实现能量的自然衰减，模拟受击后能量逐渐消散
- 多层波纹（`wave` 和 `wave2`）产生更丰富的视觉层次
- 扫描线的 `pow(scanLine, 3.0)` 增加对比度，使线条更锐利
- `uHitIntensity` 在 CPU 端衰减，避免受击效果永久持续
