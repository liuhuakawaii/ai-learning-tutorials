# SSAO 与环境光遮蔽

## 场景引入

仔细观察房间角落、物体接缝、砖块缝隙——这些地方比其他区域更暗。这种现象叫做环境光遮蔽（Ambient Occlusion，AO），是光线被周围几何体遮挡导致的自然阴影。AO 是增强场景深度感和真实感最有效的技术之一，几乎所有的现代游戏都使用它。SSAO（Screen Space Ambient Occlusion）是最常用的实时 AO 实现，本节将深入讲解其原理和优化方法。

## 学习目标

- 理解 AO 的物理含义和视觉作用
- 掌握 SSAO 的核心原理（半球采样/深度比较）
- 学会采样核优化和采样模式设计
- 理解 HBAO 和 GTAO 的改进思路
- 掌握 AO 去噪（Bilateral Blur）的实现
- 了解 AO 的性能优化策略

---

## 1. AO 概念

环境光遮蔽衡量的是一个点被周围几何体遮挡的程度。

```
AO 原理示意：

  无 AO：                    有 AO：
  ┌──────────────────┐      ┌──────────────────┐
  │                  │      │                  │
  │    ████████      │      │    ████████      │
  │    ████████      │      │   ░████████      │
  │                  │      │  ░░░░████████    │
  │                  │      │  ░░░░░░░░░░░░    │
  └──────────────────┘      └──────────────────┘

  AO 值：                    AO 值：
  0 = 完全遮挡               角落和接缝处 AO 值低
  1 = 完全暴露               开阔区域 AO 值高

  物理含义：
  AO = 半球上未被遮挡的比例

       法线方向
          ↑
          │   ████████ 遮挡物
          │  ╱
          │ ╱  采样射线
          │╱
  ────────*────────── 表面点
```

AO 的数学定义：

```
A(p) = 1 / π ∫_Ω V(p, ω) · (n · ω) dω

其中：
  p = 表面上的点
  Ω = 法线方向的半球
  V(p, ω) = 可见性函数（0=遮挡, 1=可见）
  n = 法线
  ω = 采样方向
```

---

## 2. SSAO 原理

SSAO 在屏幕空间中通过采样深度缓冲来估计 AO。

```
SSAO 采样原理：

  相机视角
       │
       v
  ┌──────────────────┐
  │   ████████       │  深度缓冲
  │  ░░░░████████    │
  │  ░░░░░░░░░░░░    │
  └──────────────────┘

  对于每个像素 p：
  1. 在 p 周围生成采样点（半球内）
  2. 将采样点投影到屏幕空间
  3. 比较采样点深度与深度缓冲
  4. 如果采样点被遮挡（深度更深），AO 减少

  半球采样：
       法线 ↑
            │  · 采样点 1
            │ ·
            │·
  ──────────*──────────
           p ·
            │ ·
            │  · 采样点 5
```

```glsl
// SSAO 片段着色器
uniform sampler2D uDepthTexture;
uniform sampler2D uNormalTexture;
uniform sampler2D uNoiseTexture;  // 随机旋转纹理
uniform vec3 uSamples[64];        // 采样核
uniform mat4 uProjection;
uniform mat4 uInverseProjection;
uniform vec2 uNoiseScale;         // 屏幕分辨率 / 噪声纹理尺寸
uniform float uRadius;
uniform float uBias;
uniform int uKernelSize;

varying vec2 vUV;

// 从深度重建视空间位置
vec3 viewPosFromDepth(vec2 uv, float depth) {
    vec4 clipPos = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 viewPos = uInverseProjection * clipPos;
    return viewPos.xyz / viewPos.w;
}

void main() {
    float depth = texture2D(uDepthTexture, vUV).r;

    // 跳过天空
    if (depth >= 1.0) {
        gl_FragColor = vec4(1.0);
        return;
    }

    vec3 fragPos = viewPosFromDepth(vUV, depth);
    vec3 normal = normalize(texture2D(uNormalTexture, vUV).rgb * 2.0 - 1.0);

    // 随机旋转向量（减少带状伪影）
    vec3 randomVec = texture2D(uNoiseTexture, vUV * uNoiseScale).rgb * 2.0 - 1.0;

    // 构建 TBN 矩阵（将采样核从切线空间变换到视空间）
    vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN = mat3(tangent, bitangent, normal);

    float occlusion = 0.0;

    for (int i = 0; i < uKernelSize; i++) {
        // 采样点（切线空间 -> 视空间）
        vec3 samplePos = TBN * uSamples[i];
        samplePos = fragPos + samplePos * uRadius;

        // 投影到屏幕空间
        vec4 offset = uProjection * vec4(samplePos, 1.0);
        offset.xyz /= offset.w;
        offset.xy = offset.xy * 0.5 + 0.5;

        // 采样深度并比较
        float sampleDepth = texture2D(uDepthTexture, offset.xy).r;
        vec3 sampleViewPos = viewPosFromDepth(offset.xy, sampleDepth);

        // 范围检查（避免远处物体影响）
        float rangeCheck = smoothstep(0.0, 1.0, uRadius / abs(fragPos.z - sampleViewPos.z));

        // 如果采样点比实际表面更远，说明被遮挡
        occlusion += (sampleViewPos.z >= samplePos.z + uBias ? 1.0 : 0.0) * rangeCheck;
    }

    occlusion = 1.0 - (occlusion / float(uKernelSize));
    gl_FragColor = vec4(vec3(occlusion), 1.0);
}
```

---

## 3. 采样核优化

```
采样核设计：

  随机采样                半球采样              余弦加权采样
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │ · ·  ·   │          │    · ·   │          │  · · ·   │
  │  ·   · · │          │  · · ·   │          │ · · · ·  │
  │ ·  ·     │          │ · · · ·  │          │· · · · · │
  │   ·  · · │          │*─────────│          │*─────────│
  └──────────┘          └──────────┘          └──────────┘
  分布不均匀              朝法线方向采样        越靠近法线采样越密

  优化：使用余弦加权半球采样 + 随机旋转
```

```typescript
// 生成优化的采样核
function generateSampleKernel(size: number): Float32Array {
  const kernel = new Float32Array(size * 3);

  for (let i = 0; i < size; i++) {
    // 在半球内均匀采样
    const x = Math.random() * 2.0 - 1.0;
    const y = Math.random() * 2.0 - 1.0;
    const z = Math.random(); // 半球，z > 0

    const sample = new THREE.Vector3(x, y, z).normalize();

    // 余弦加权：越靠近法线方向，采样越密集
    const scale = i / size;
    const lerpScale = 0.1 + scale * scale * 0.9; // 非线性缩放
    sample.multiplyScalar(lerpScale);

    kernel[i * 3] = sample.x;
    kernel[i * 3 + 1] = sample.y;
    kernel[i * 3 + 2] = sample.z;
  }

  return kernel;
}

// 生成随机旋转向量（4x4 纹理）
function generateNoiseTexture(): THREE.DataTexture {
  const size = 4;
  const data = new Float32Array(size * size * 3);

  for (let i = 0; i < size * size; i++) {
    data[i * 3] = Math.random() * 2.0 - 1.0;
    data[i * 3 + 1] = Math.random() * 2.0 - 1.0;
    data[i * 3 + 2] = 0.0; // z=0，只在切平面旋转
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBFormat, THREE.FloatType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
```

---

## 4. HBAO（Horizon-Based Ambient Occlusion）

HBAO 基于水平角原理，在屏幕空间中沿方向扫描，找到最大遮挡角度。

```
HBAO 原理：

  视线方向
       │
       v
  ┌──────────────────┐
  │   ████████       │
  │  ░░░░████████    │
  │  ░░░░░░░░░░░░    │
  └──────────────────┘

  对于每个像素 p，沿多个方向扫描：

       法线 n
          ↑ θ = 0
          │
          │ ╲ θ = 遮挡角
          │  ╲
  ────────*───╲──────
         p    ╲
               ████████ 遮挡物

  AO = Σ sin(θ_max) / 方向数

  θ_max 越大 → 遮挡越多 → AO 越暗
```

```glsl
// HBAO 片段着色器
uniform sampler2D uDepthTexture;
uniform sampler2D uNormalTexture;
uniform mat4 uProjection;
uniform mat4 uInverseProjection;
uniform float uRadius;
uniform float uMaxRadiusPixels;
uniform int uDirections;
uniform int uSteps;

varying vec2 vUV;

// Ray Marching 方向
const vec2 directions[8] = vec2[](
    vec2(1.0, 0.0), vec2(-1.0, 0.0),
    vec2(0.0, 1.0), vec2(0.0, -1.0),
    vec2(0.707, 0.707), vec2(-0.707, 0.707),
    vec2(0.707, -0.707), vec2(-0.707, -0.707)
);

float horizonOcclusion(vec2 uv, vec3 fragPos, vec3 normal, vec2 direction) {
    float occlusion = 0.0;
    float stepSize = uRadius / float(uSteps);

    for (int i = 1; i <= uSteps; i++) {
        vec2 sampleUV = uv + direction * stepSize * float(i);
        float sampleDepth = texture2D(uDepthTexture, sampleUV).r;
        vec3 samplePos = viewPosFromDepth(sampleUV, sampleDepth);

        vec3 horizonDir = samplePos - fragPos;
        float horizonDist = length(horizonDir);

        if (horizonDist < uRadius) {
            float cosTheta = dot(normalize(horizonDir), normal);
            float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

            // 距离衰减
            float attenuation = 1.0 - horizonDist / uRadius;
            occlusion = max(occlusion, sinTheta * attenuation);
        }
    }

    return occlusion;
}

void main() {
    float depth = texture2D(uDepthTexture, vUV).r;
    if (depth >= 1.0) {
        gl_FragColor = vec4(1.0);
        return;
    }

    vec3 fragPos = viewPosFromDepth(vUV, depth);
    vec3 normal = normalize(texture2D(uNormalTexture, vUV).rgb * 2.0 - 1.0);

    float totalOcclusion = 0.0;
    for (int i = 0; i < uDirections; i++) {
        totalOcclusion += horizonOcclusion(vUV, fragPos, normal, directions[i]);
    }

    float ao = 1.0 - totalOcclusion / float(uDirections);
    gl_FragColor = vec4(vec3(ao), 1.0);
}
```

---

## 5. GTAO（Ground Truth Ambient Occlusion）

GTAO 是目前最先进的实时 AO 算法，基于 Ground Truth 参考解进行近似。

```
GTAO 改进点：

  ┌─────────────────────────────────────────────────┐
  │ SSAO            │ HBAO           │ GTAO         │
  ├─────────────────────────────────────────────────┤
  │ 半球采样         │ 水平角扫描      │ 积分近似     │
  │ 采样数 = 64     │ 方向数 = 8     │ 方向数 = 4~8 │
  │ 无可见性函数     │ 简单可见性      │ 精确可见性   │
  │ 无衰减曲线       │ 线性衰减        │ 余弦衰减     │
  │ 性能：高         │ 性能：中        │ 性能：低     │
  │ 质量：中         │ 质量：中高      │ 质量：高     │
  └─────────────────────────────────────────────────┘
```

```glsl
// GTAO 核心算法（简化版）
float groundTruthAO(vec3 fragPos, vec3 normal, vec2 uv) {
    float ao = 0.0;
    const int DIRECTIONS = 4;
    const int STEPS = 6;

    for (int d = 0; d < DIRECTIONS; d++) {
        float angle = float(d) / float(DIRECTIONS) * PI;
        vec2 direction = vec2(cos(angle), sin(angle));

        // 在每个方向上寻找水平角
        float horizonCos1 = -1.0;
        float horizonCos2 = -1.0;

        for (int s = 1; s <= STEPS; s++) {
            float stepSize = float(s) / float(STEPS) * uRadius;
            vec2 sampleUV = uv + direction * stepSize;
            float sampleDepth = texture2D(uDepthTexture, sampleUV).r;
            vec3 samplePos = viewPosFromDepth(sampleUV, sampleDepth);

            vec3 horizon = samplePos - fragPos;
            float cosH = dot(normalize(horizon), normal);

            // 两个方向的最大遮挡角
            horizonCos1 = max(horizonCos1, cosH - float(s > 1) * 0.1);
            horizonCos2 = max(horizonCos2, cosH);
        }

        // 积分近似
        ao += (horizonCos1 + horizonCos2) * 0.5;
    }

    return clamp(ao / float(DIRECTIONS) + 0.5, 0.0, 1.0);
}
```

---

## 6. AO 去噪（Bilateral Blur）

AO 结果通常有噪声，需要使用保边模糊（Bilateral Blur）去噪。

```
Bilateral Blur 原理：

  普通高斯模糊：              Bilateral Blur：
  ┌──────────────────┐      ┌──────────────────┐
  │ ░░░░░░░░░░░░░░░░ │      │ ░░░░░░████████░░ │
  │ ░░░░░░░░░░░░░░░░ │      │ ░░░░░░████████░░ │
  │ ████████░░░░░░░░ │      │ ████████░░░░░░░░ │
  │ ░░░░░░░░░░░░░░░░ │      │ ████████░░░░░░░░ │
  └──────────────────┘      └──────────────────┘
  边缘被模糊                  边缘被保留

  Bilateral Blur 同时考虑：
  1. 空间距离（高斯权重）
  2. 颜色/深度差异（相似性权重）
```

```glsl
// Bilateral Blur 片段着色器
uniform sampler2D uInputTexture;
uniform sampler2D uDepthTexture;
uniform vec2 uDirection;       // (1,0) 水平 / (0,1) 垂直
uniform vec2 uTexelSize;
uniform float uBlurRadius;
uniform float uDepthThreshold;
uniform float uNormalThreshold;

varying vec2 vUV;

void main() {
    vec4 centerColor = texture2D(uInputTexture, vUV);
    float centerDepth = texture2D(uDepthTexture, vUV).r;

    vec4 result = vec4(0.0);
    float totalWeight = 0.0;

    for (float i = -uBlurRadius; i <= uBlurRadius; i += 1.0) {
        vec2 sampleUV = vUV + uDirection * i * uTexelSize;

        vec4 sampleColor = texture2D(uInputTexture, sampleUV);
        float sampleDepth = texture2D(uDepthTexture, sampleUV).r;

        // 空间权重（高斯）
        float spatialWeight = exp(-i * i / (2.0 * uBlurRadius * uBlurRadius));

        // 深度权重（保边）
        float depthDiff = abs(centerDepth - sampleDepth);
        float depthWeight = exp(-depthDiff * depthDiff / (2.0 * uDepthThreshold * uDepthThreshold));

        // 颜色权重
        float colorDiff = length(sampleColor.rgb - centerColor.rgb);
        float colorWeight = exp(-colorDiff * colorDiff / 0.1);

        float weight = spatialWeight * depthWeight * colorWeight;
        result += sampleColor * weight;
        totalWeight += weight;
    }

    gl_FragColor = result / totalWeight;
}
```

```typescript
// SSAO 后处理管线
class SSAOPass {
  private ssaoRenderTarget: THREE.WebGLRenderTarget;
  private blurRenderTarget: THREE.WebGLRenderTarget;
  private ssaoMaterial: THREE.ShaderMaterial;
  private blurMaterial: THREE.ShaderMaterial;
  private compositeMaterial: THREE.ShaderMaterial;

  constructor(width: number, height: number) {
    // SSAO 渲染目标（半分辨率）
    this.ssaoRenderTarget = new THREE.WebGLRenderTarget(width / 2, height / 2, {
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    // 模糊渲染目标
    this.blurRenderTarget = new THREE.WebGLRenderTarget(width / 2, height / 2);

    this.ssaoMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uDepthTexture: { value: null },
        uNormalTexture: { value: null },
        uNoiseTexture: { value: generateNoiseTexture() },
        uSamples: { value: generateSampleKernel(64) },
        uRadius: { value: 0.5 },
        uBias: { value: 0.025 },
        uKernelSize: { value: 64 },
      },
      vertexShader: fullscreenVertShader,
      fragmentShader: ssaoFragShader,
    });

    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uInputTexture: { value: this.ssaoRenderTarget.texture },
        uDepthTexture: { value: null },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uBlurRadius: { value: 4.0 },
        uDepthThreshold: { value: 0.01 },
      },
      vertexShader: fullscreenVertShader,
      fragmentShader: bilateralBlurFragShader,
    });
  }

  render(renderer: THREE.WebGLRenderer): void {
    // 1. 计算 SSAO
    renderer.setRenderTarget(this.ssaoRenderTarget);
    // ... 渲染全屏四边形

    // 2. 水平模糊
    this.blurMaterial.uniforms.uDirection.value.set(1, 0);
    renderer.setRenderTarget(this.blurRenderTarget);
    // ... 渲染

    // 3. 垂直模糊
    this.blurMaterial.uniforms.uDirection.value.set(0, 1);
    renderer.setRenderTarget(null);
    // ... 渲染
  }
}
```

---

## 常见误区

1. **采样半径不随场景尺度调整**：SSAO 的采样半径是视空间单位，如果场景尺度变化大（室内 vs 室外），固定半径会导致室内 AO 太强或室外 AO 太弱。应该根据场景尺度动态调整半径。

2. **忽略深度不连续处**：在物体边缘，深度差异很大，如果不做范围检查，远处的物体会影响近处的 AO 计算，产生"光晕"伪影。必须使用 `smoothstep` 限制采样范围。

3. **不做去噪**：原始 SSAO 结果噪声很大，直接使用会让画面看起来很脏。必须使用 Bilateral Blur 去噪，同时保留边缘细节。

4. **AO 作为最终颜色输出**：AO 应该作为乘法因子叠加到场景光照中，而不是直接输出。`finalColor = lighting * ao`，否则场景会看起来太暗。

---

## 工程建议

1. **半分辨率渲染**：SSAO 对分辨率不敏感，半分辨率渲染 + 上采样几乎看不出差异，但性能提升 4 倍。这是最有效的优化手段。

2. **采样核大小选择**：16~32 个采样点通常足够。更多采样点的收益递减，但性能线性增长。使用 Poisson Disk 分布可以用更少采样点获得更好效果。

3. **时间复用**：使用蓝噪声对采样核进行时间抖动，结合 TAA 可以用 16 步达到 64 步的效果。

4. **分层 AO**：近处使用高质量 AO（GTAO），远处使用低质量 AO（简单 SSAO 或烘焙 AO），通过距离平滑过渡。

---

## 小结

本节系统讲解了环境光遮蔽技术：AO 的物理含义、SSAO 的半球采样原理、采样核优化、HBAO 的水平角扫描、GTAO 的积分近似以及 Bilateral Blur 去噪。AO 是增强场景真实感最有效的后处理效果之一，理解各种实现方案的质量-性能权衡，才能在实际项目中做出正确选择。

## 练习

1. 实现基础的 SSAO 着色器，使用 32 个采样点和半球采样。
2. 为 SSAO 添加 Bilateral Blur 去噪，保留边缘细节。
3. 实现采样核的随机旋转，使用 4x4 噪声纹理。
4. 将 SSAO 集成到延迟渲染管线中，作为环境光照的调制因子。
5. 比较 SSAO 和 HBAO 的效果差异，分析各自的优缺点。

---

## 参考答案

### 练习一

**思路**：SSAO 的核心思想：在每个像素处构建切线空间半球（法线方向为上），在半球内随机采样多个点，检查这些点是否被遮挡（深度比较）。被遮挡的采样点越多，环境光遮蔽越强。

**答案**：

```glsl
// SSAO 片段着色器
precision highp float;

uniform sampler2D uDepthTex;
uniform sampler2D uNormalTex;
uniform sampler2D uNoiseTex;      // 4x4 随机旋转向量
uniform vec3 uSamples[32];        // 半球采样核
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uInvViewProj;
uniform vec2 uNoiseScale;         // 屏幕尺寸 / 4
uniform float uRadius;            // 采样半径
uniform float uBias;              // 深度偏移

varying vec2 vUV;

// 重建视空间位置
vec3 reconstructViewPos(vec2 uv, float depth) {
    vec4 clipPos = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 viewPos = uInvViewProj * clipPos;
    return (viewPos.xyz / viewPos.w);
}

void main() {
    float depth = texture2D(uDepthTex, vUV).r;
    if (depth >= 1.0) { gl_FragColor = vec4(1.0); return; }

    // 重建视空间位置和法线
    vec3 fragPos = reconstructViewPos(vUV, depth);
    vec3 normal = normalize(texture2D(uNormalTex, vUV).rgb * 2.0 - 1.0);

    // 随机旋转向量（4x4 噪声纹理，平铺屏幕）
    vec3 randomVec = texture2D(uNoiseTex, vUV * uNoiseScale).rgb * 2.0 - 1.0;

    // 构建 TBN 矩阵（切线空间）
    vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN = mat3(tangent, bitangent, normal);

    // 半球采样
    float occlusion = 0.0;
    for (int i = 0; i < 32; i++) {
        // 将采样点从切线空间变换到视空间
        vec3 samplePos = TBN * uSamples[i];
        samplePos = fragPos + samplePos * uRadius;

        // 将采样点投影到屏幕空间
        vec4 offset = uProjection * vec4(samplePos, 1.0);
        offset.xyz /= offset.w;
        offset.xyz = offset.xyz * 0.5 + 0.5;

        // 采样该位置的深度
        float sampleDepth = texture2D(uDepthTex, offset.xy).r;
        vec3 sampleViewPos = reconstructViewPos(offset.xy, sampleDepth);

        // 深度比较：采样点是否被遮挡
        float rangeCheck = smoothstep(0.0, 1.0, uRadius / abs(fragPos.z - sampleViewPos.z));
        occlusion += (sampleViewPos.z >= samplePos.z + uBias ? 1.0 : 0.0) * rangeCheck;
    }

    occlusion = 1.0 - (occlusion / 32.0);
    gl_FragColor = vec4(vec3(occlusion), 1.0);
}
```

**要点**：
- 采样核在切线空间的半球内随机分布，靠近原点的采样点密度更高（加权分布）
- `rangeCheck` 防止距离过远的采样点产生错误遮蔽
- 结果是灰度图：白色=无遮蔽，黑色=完全遮蔽

---

### 练习二

**思路**：SSAO 结果包含大量高频噪声（随机采样导致），需要模糊去噪。Bilateral Blur（双边模糊）在平滑噪声的同时保留边缘细节：只对深度相近的像素进行模糊，深度差异大的像素（通常是边缘）不参与模糊。

**答案**：

```glsl
// Bilateral Blur 片段着色器
precision highp float;

uniform sampler2D uSSAOTex;
uniform sampler2D uDepthTex;
uniform vec2 uTexelSize;        // 1.0 / 屏幕尺寸
uniform int uBlurRadius;        // 模糊半径，如 4
uniform float uDepthThreshold;  // 深度差异阈值

varying vec2 vUV;

void main() {
    float centerAO = texture2D(uSSAOTex, vUV).r;
    float centerDepth = texture2D(uDepthTex, vUV).r;

    float totalAO = 0.0;
    float totalWeight = 0.0;

    // 双边模糊：空间权重 × 深度权重
    for (int i = -4; i <= 4; i++) {
        for (int j = -4; j <= 4; j++) {
            vec2 offset = vec2(float(i), float(j)) * uTexelSize;
            vec2 sampleUV = vUV + offset;

            float sampleAO = texture2D(uSSAOTex, sampleUV).r;
            float sampleDepth = texture2D(uDepthTex, sampleUV).r;

            // 空间权重（高斯衰减）
            float dist = length(vec2(float(i), float(j)));
            float spatialWeight = exp(-dist * dist / (2.0 * 2.0));

            // 深度权重（边缘保留）
            float depthDiff = abs(centerDepth - sampleDepth);
            float depthWeight = exp(-depthDiff * depthDiff / (2.0 * uDepthThreshold * uDepthThreshold));

            float weight = spatialWeight * depthWeight;
            totalAO += sampleAO * weight;
            totalWeight += weight;
        }
    }

    float blurredAO = totalAO / totalWeight;
    gl_FragColor = vec4(vec3(blurredAO), 1.0);
}
```

**要点**：
- 空间权重使用高斯函数，中心像素权重最高
- 深度权重使边缘处（深度差异大）的像素不参与模糊，保留边缘锐度
- 模糊半径 4（9x9 核）通常足够，更大的核性能开销大但效果提升有限

---

### 练习三

**思路**：采样核随机旋转可以减少规律性条纹噪声。使用 4x4 的随机旋转向量纹理（每个像素一个随机方向），平铺在屏幕上。每个像素的采样核绕法线旋转不同角度，使相邻像素的采样模式不同。

**答案**：

```typescript
// 创建 4x4 噪声纹理
function createNoiseTexture(): THREE.DataTexture {
    const size = 4;
    const data = new Float32Array(size * size * 3);

    for (let i = 0; i < size * size; i++) {
        // 随机旋转向量（切线空间，绕法线旋转）
        const angle = Math.random() * Math.PI * 2;
        data[i * 3] = Math.cos(angle);      // x
        data[i * 3 + 1] = Math.sin(angle);  // y
        data[i * 3 + 2] = 0.0;              // z（切线空间内）
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBFormat, THREE.FloatType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
}

// 在着色器中使用
// vec3 randomVec = texture2D(uNoiseTex, vUV * uNoiseScale).rgb * 2.0 - 1.0;
// uNoiseScale = vec2(screenWidth / 4.0, screenHeight / 4.0);
```

```glsl
// 随机旋转的采样核构建
vec3 randomVec = texture2D(uNoiseTex, vUV * uNoiseScale).rgb * 2.0 - 1.0;

// Gram-Schmidt 正交化构建 TBN
vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
vec3 bitangent = cross(normal, tangent);
mat3 TBN = mat3(tangent, bitangent, normal);

// 采样核绕法线旋转（每个像素不同）
for (int i = 0; i < 32; i++) {
    vec3 samplePos = TBN * uSamples[i]; // 自动应用随机旋转
    samplePos = fragPos + samplePos * uRadius;
    // ...
}
```

**要点**：
- 噪声纹理使用 `NearestFilter` 和 `RepeatWrapping`，确保每个像素有唯一的随机方向
- 噪声纹理尺寸 4x4（16 个随机方向）足够，更大的尺寸不会明显提升效果
- 随机旋转配合 TAA 时间抗锯齿可以进一步减少噪声

---

### 练习四

**思路**：将 SSAO 集成到延迟渲染管线中，作为环境光的调制因子。在 Deferred Lighting Pass 中，读取 SSAO 纹理，将 AO 值乘以环境光分量，减少被遮蔽区域的环境光照。

**答案**：

```glsl
// 带 SSAO 的 Deferred Lighting 片段着色器
precision highp float;

uniform sampler2D uAlbedoTex;
uniform sampler2D uNormalTex;
uniform sampler2D uDepthTex;
uniform sampler2D uMaterialTex;
uniform sampler2D uSSAOTex;        // SSAO 纹理
uniform vec3 uCameraPos;
uniform vec3 uAmbientColor;

varying vec2 vUV;

void main() {
    // 读取 G-Buffer
    vec3 albedo = texture2D(uAlbedoTex, vUV).rgb;
    vec3 normal = texture2D(uNormalTex, vUV).rgb * 2.0 - 1.0;
    float depth = texture2D(uDepthTex, vUV).r;
    vec4 material = texture2D(uMaterialTex, vUV);

    // 读取 SSAO
    float ao = texture2D(uSSAOTex, vUV).r;

    // 重建世界坐标
    vec3 worldPos = reconstructWorldPos(vUV, depth, uInvViewProj);

    // 直接光照（不受 AO 影响）
    vec3 Lo = vec3(0.0);
    for (int i = 0; i < uLightCount; i++) {
        Lo += calculateDirectLight(i, worldPos, normal, albedo, material);
    }

    // 环境光（受 AO 调制）
    vec3 F0 = mix(vec3(0.04), albedo, material.r);
    vec3 kD = (vec3(1.0) - fresnelSchlick(max(dot(normal, normalize(uCameraPos - worldPos)), 0.0), F0))
              * (1.0 - material.r);

    // SSAO 调制环境光
    vec3 ambient = uAmbientColor * albedo * kD * ao;

    vec3 color = ambient + Lo;

    // 色调映射
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));
    gl_FragColor = vec4(color, 1.0);
}
```

**要点**：
- AO 只影响环境光（间接光照），不影响直接光照
- 金属材质的环境光使用 Fresnel 调整，非金属使用 Lambert 漫反射
- SSAO 纹理需要在 Deferred Lighting Pass 之前完成模糊处理

---

### 练习五

**思路**：SSAO 使用半球采样判断遮挡，HBAO 使用水平角扫描近似遮蔽。两者在质量、性能和视觉特征上有明显差异。通过实际渲染对比分析各自的优缺点。

**答案**：

**SSAO vs HBAO 对比分析：**

```
+────────────────────+────────────────────+────────────────────+
|       特性         |       SSAO         |       HBAO         |
+────────────────────+────────────────────+────────────────────+
| 采样方式           | 半球内随机采样     | 沿方向扫描水平角   |
| 采样次数           | 16~32 次           | 4~8 方向 × 步进    |
| 遮蔽判断           | 深度比较           | 最大水平角近似     |
| 边缘质量           | 有噪声，需模糊     | 更平滑，噪声少     |
| 性能               | 中等               | 略好（采样更高效） |
| 实现复杂度         | 简单               | 中等               |
| 屏幕空间伪影       | 条纹噪声           | 方向性伪影         |
| 可模糊性           | 需要 Bilateral Blur| 可选模糊           |
+────────────────────+────────────────────+────────────────────+
```

**SSAO 优缺点：**
- 优点：实现简单，采样核易于理解和调试，适合入门
- 缺点：随机采样噪声大，需要额外的模糊 Pass，边缘保留困难
- 适用场景：性能要求不高的场景，或作为学习环境光遮蔽的起点

**HBAO 优缺点：**
- 优点：采样更高效（方向扫描而非随机），结果更平滑，噪声少
- 缺点：方向性伪影（水平/垂直方向遮蔽更明显），实现较复杂
- 适用场景：需要高质量 AO 的场景，性能预算中等

**GTAO（推荐）：**
- 综合了 SSAO 和 HBAO 的优点，使用积分近似计算遮蔽
- 支持方向和距离衰减，质量最高
- 适合性能预算充足、追求高质量的项目

**要点**：
- SSAO 的噪声来自随机采样，HBAO 的伪影来自方向扫描的离散化
- 现代引擎多使用 GTAO 或 SSDO（Screen-Space Directional Occlusion）
- 无论哪种方案，时间复用（Temporal Reprojection）都是提升质量的关键技术
