# PBR 材质详解

## 场景引入

为什么金属看起来有光泽而塑料看起来是哑光的？为什么水面在不同角度反射率不同？为什么粗糙表面的高光面积大而光滑表面的高光面积小？这些问题的答案都藏在 PBR（Physically Based Rendering，基于物理的渲染）中。PBR 是现代游戏引擎的标准材质模型，它基于微表面理论和能量守恒原理，能够用统一的参数体系描述各种真实材质。本节将深入讲解 PBR 的数学原理和完整实现。

## 学习目标

- 理解微表面理论的三大核心函数：NDF、GAF、Fresnel
- 掌握 Cook-Torrance BRDF 的数学推导和着色器实现
- 理解金属度/粗糙度工作流和镜面反射/光泽度工作流
- 学会切线空间法线贴图的实现
- 掌握 IBL（Image-Based Lighting）的实现方法
- 能够实现完整的 PBR 着色器

---

## 1. 微表面理论

PBR 的核心假设：微观上看，所有表面都是由大量微小镜面组成。

```
微表面模型：

  光滑表面（粗糙度低）          粗糙表面（粗糙度高）
  ┌─────────────────┐          ┌─────────────────┐
  │ ═══════════════ │          │ ╲╱╲ ╱╲  ╱╲ ╱╲ │
  │ ═══════════════ │          │ ╱╲ ╲╱  ╲╱ ╲╱╲ │
  │ ═══════════════ │          │ ╲  ╱╲ ╱╲  ╱╲  │
  └─────────────────┘          └─────────────────┘
  法线方向一致                   法线方向分散
  反射方向集中 → 高光锐利        反射方向分散 → 高光模糊
```

微表面理论的三大核心函数：

```
  NDF (法线分布函数)     GAF (几何遮蔽函数)     Fresnel (菲涅尔)
  ─────────────────    ─────────────────    ─────────────────
  描述微表面法线分布    描述微表面自遮蔽      描述反射率随角度变化

  高 NDF → 高光集中     高 GAF → 无遮蔽       0° → 基础反射率
  低 NDF → 高光分散     低 GAF → 强遮蔽       90° → 反射率趋近 1
```

---

## 2. Cook-Torrance BRDF

PBR 的 BRDF（双向反射分布函数）由漫反射和镜面反射两部分组成：

```
BRDF = k_d * Lambert + k_s * CookTorrance

其中：
  k_d = 1 - k_s  （能量守恒）
  k_s = Fresnel  （反射比例）

Cook-Torrance 镜面反射：
           D(h) * F(v,h) * G(l,v,h)
  f_spec = ─────────────────────────
                4 * (N·L) * (N·V)

  D = NDF（法线分布函数）
  F = Fresnel（菲涅尔反射）
  G = GAF（几何遮蔽函数）
```

### 2.1 法线分布函数（NDF）

```glsl
// Trowbridge-Reitz GGX（最常用的 NDF）
float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;  // Disney 方法：粗糙度平方
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;

    float denom = NdotH2 * (a2 - 1.0) + 1.0;
    denom = 3.14159 * denom * denom;

    return a2 / denom;
}
```

### 2.2 几何遮蔽函数（GAF）

```glsl
// Schlick-GGX 几何遮蔽
float geometrySchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;  // 直接光照的 k 值
    return NdotV / (NdotV * (1.0 - k) + k);
}

// Smith 方法：视线方向和光线方向分别遮蔽
float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx1 = geometrySchlickGGX(NdotV, roughness);
    float ggx2 = geometrySchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
}
```

### 2.3 菲涅尔方程

```glsl
// Schlick 近似 Fresnel
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

// 粗糙表面的 Fresnel（用于 IBL）
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
}
```

### 2.4 完整 Cook-Torrance BRDF

```glsl
// 完整 PBR 片段着色器（直接光照）
uniform vec3 uAlbedo;
uniform float uMetallic;
uniform float uRoughness;
uniform float uAO;

uniform vec3 uLightPositions[4];
uniform vec3 uLightColors[4];
uniform vec3 uCameraPos;

varying vec3 vWorldPos;
varying vec3 vNormal;

const float PI = 3.14159265359;

void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);

    // 基础反射率（F0）
    vec3 F0 = vec3(0.04);  // 非金属的基础反射率
    F0 = mix(F0, uAlbedo, uMetallic);  // 金属的 F0 = albedo

    // 反射率方程（对每个光源累加）
    vec3 Lo = vec3(0.0);
    for (int i = 0; i < 4; i++) {
        vec3 L = normalize(uLightPositions[i] - vWorldPos);
        vec3 H = normalize(V + L);

        // 距离衰减
        float distance = length(uLightPositions[i] - vWorldPos);
        float attenuation = 1.0 / (distance * distance);
        vec3 radiance = uLightColors[i] * attenuation;

        // Cook-Torrance BRDF
        float D = distributionGGX(N, H, uRoughness);
        float G = geometrySmith(N, V, L, uRoughness);
        vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

        // 镜面反射
        vec3 numerator = D * G * F;
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.001;
        vec3 specular = numerator / denominator;

        // 能量守恒
        vec3 kS = F;          // 镜面反射比例
        vec3 kD = vec3(1.0) - kS;  // 漫反射比例
        kD *= 1.0 - uMetallic;    // 金属无漫反射

        // Lambert 漫反射
        float NdotL = max(dot(N, L), 0.0);
        vec3 diffuse = kD * uAlbedo / PI;

        Lo += (diffuse + specular) * radiance * NdotL;
    }

    // 环境光（简化）
    vec3 ambient = vec3(0.03) * uAlbedo * uAO;
    vec3 color = ambient + Lo;

    // HDR 色调映射
    color = color / (color + vec3(1.0));
    // Gamma 校正
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
}
```

---

## 3. 金属度/粗糙度工作流

```
Metallic-Roughness 工作流：

  参数            范围      含义
  ─────────────────────────────────────────
  Albedo          RGB       基础颜色（不含光照信息）
  Metallic        0~1       0=非金属, 1=金属
  Roughness       0~1       0=光滑, 1=粗糙
  AO              0~1       环境光遮蔽

  金属 vs 非金属的 F0：

  材质            F0 值          颜色
  ──────────────────────────────────────
  水             0.02           灰色
  塑料           0.04           灰色
  玻璃           0.04           灰色
  钻石           0.17           灰色
  铁             0.56           灰色
  金             1.0, 0.71, 0.29 金色
  铜             0.95, 0.64, 0.54 红铜色
  铝             0.91, 0.92, 0.92 银色
```

```typescript
// PBR 材质管理
class PBRMaterial {
  albedo: THREE.Color;
  metallic: number;
  roughness: number;
  ao: number;
  normalScale: number;
  emissive: THREE.Color;

  // 纹理贴图
  albedoMap: THREE.Texture | null;
  metallicRoughnessMap: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  aoMap: THREE.Texture | null;
  emissiveMap: THREE.Texture | null;

  constructor(options: Partial<PBRMaterial> = {}) {
    this.albedo = options.albedo ?? new THREE.Color(1, 1, 1);
    this.metallic = options.metallic ?? 0.0;
    this.roughness = options.roughness ?? 0.5;
    this.ao = options.ao ?? 1.0;
    this.normalScale = options.normalScale ?? 1.0;
    this.emissive = options.emissive ?? new THREE.Color(0, 0, 0);
  }

  getUniforms(): Record<string, THREE.IUniform> {
    return {
      uAlbedo: { value: this.albedo },
      uMetallic: { value: this.metallic },
      uRoughness: { value: this.roughness },
      uAO: { value: this.ao },
      uNormalScale: { value: this.normalScale },
      uEmissive: { value: this.emissive },
      uAlbedoMap: { value: this.albedoMap },
      uMetallicRoughnessMap: { value: this.metallicRoughnessMap },
      uNormalMap: { value: this.normalMap },
      uAOMap: { value: this.aoMap },
      uEmissiveMap: { value: this.emissiveMap },
    };
  }
}
```

---

## 4. 法线贴图（切线空间）

法线贴图将高精度的表面细节编码到纹理中，用低多边形模型实现高细节效果。

```
切线空间：

  模型空间法线              切线空间法线
  (指向世界 "上")           (指向表面 "上")
       ↑                        ↑ N
       │                        │
       │                        │
  ─────┼─────>              ────┼────> T (切线)
       │                        │
       ↓                       B (副切线)

  切线空间矩阵 TBN：
  [T.x B.x N.x]
  [T.y B.y N.y]
  [T.z B.z N.z]
```

```glsl
// 切线空间法线贴图
attribute vec3 aTangent;

varying mat3 vTBN;

void main() {
    // ... 顶点变换

    vec3 T = normalize(mat3(uModelMatrix) * aTangent);
    vec3 N = normalize(mat3(uModelMatrix) * aNormal);
    // Gram-Schmidt 正交化
    T = normalize(T - dot(T, N) * N);
    vec3 B = cross(N, T);

    vTBN = mat3(T, B, N);
}

// 片段着色器
uniform sampler2D uNormalMap;
uniform float uNormalScale;

void main() {
    // 采样法线贴图
    vec3 tangentNormal = texture2D(uNormalMap, vUV).rgb * 2.0 - 1.0;
    tangentNormal.xy *= uNormalScale;
    tangentNormal = normalize(tangentNormal);

    // 转换到世界空间
    vec3 worldNormal = normalize(vTBN * tangentNormal);

    // ... 使用 worldNormal 进行光照计算
}
```

---

## 5. IBL（Image-Based Lighting）

IBL 使用环境贴图代替点光源，提供更自然的全局光照。

```
IBL 分解：

  环境光照 = 漫反射 IBL + 镜面反射 IBL

  漫反射 IBL                镜面反射 IBL
  ┌──────────┐             ┌──────────┐
  │  环境贴图  │             │  预滤波贴图 │
  │  卷积模糊  │             │  多级 Mip  │
  └──────────┘             └──────────┘
       │                        │
       v                        v
  采样辐照度 Irradiance     采样预滤波环境光
       │                        │
       v                        v
  Lambert 漫反射             Cook-Torrance 镜面反射
```

```glsl
// IBL 漫反射
uniform samplerCube uIrradianceMap;  // 辐照度贴图（预卷积）

vec3 iblDiffuse(vec3 N) {
    return textureCube(uIrradianceMap, N).rgb;
}

// IBL 镜面反射
uniform samplerCube uPrefilterMap;   // 预滤波环境贴图
uniform sampler2D uBRDFLUT;          // BRDF 查找表

vec3 iblSpecular(vec3 N, vec3 V, float roughness, vec3 F0) {
    vec3 R = reflect(-V, N);

    // 根据粗糙度采样不同 Mip 级别的预滤波贴图
    const float MAX_REFLECTION_LOD = 4.0;
    vec3 prefilteredColor = textureCubeLod(uPrefilterMap, R,
                                            roughness * MAX_REFLECTION_LOD).rgb;

    // 采样 BRDF 查找表
    float NdotV = max(dot(N, V), 0.0);
    vec2 brdf = texture2D(uBRDFLUT, vec2(NdotV, roughness)).rg;

    // 合成
    vec3 F = fresnelSchlickRoughness(NdotV, F0, roughness);
    return prefilteredColor * (F * brdf.x + brdf.y);
}
```

---

## 6. 环境贴图预滤波

将环境贴图预计算为不同粗糙度级别的版本。

```glsl
// 环境贴图预滤波（渲染到 CubeMap 的每个面）
// 在片段着色器中使用重要性采样
const uint SAMPLE_COUNT = 1024u;

vec3 prefilterEnvMap(vec3 R, float roughness) {
    vec3 N = R;
    vec3 V = R;
    vec3 prefilteredColor = vec3(0.0);
    float totalWeight = 0.0;

    for (uint i = 0u; i < SAMPLE_COUNT; i++) {
        // 重要性采样 GGX
        vec2 Xi = hammersley(i, SAMPLE_COUNT);
        vec3 H = importanceSampleGGX(Xi, N, roughness);
        vec3 L = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0);
        if (NdotL > 0.0) {
            prefilteredColor += textureCube(uEnvironmentMap, L).rgb * NdotL;
            totalWeight += NdotL;
        }
    }

    return prefilteredColor / totalWeight;
}
```

```typescript
// Three.js 中预滤波环境贴图
function prefilterEnvironmentMap(
  renderer: THREE.WebGLRenderer,
  envMap: THREE.Texture,
  roughnessLevels: number = 5
): THREE.WebGLCubeRenderTarget {
  const size = 256;
  const prefilteredMap = new THREE.WebGLCubeRenderTarget(size, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });

  // 使用 PMREMGenerator 预滤波
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileCubemapShader();
  const result = pmremGenerator.fromCubemap(envMap as THREE.CubeTexture);
  pmremGenerator.dispose();

  return result;
}
```

---

## 7. PBR 材质球展示

```typescript
// PBR 材质球展示场景
function createPBRShowcase(): THREE.Group {
  const group = new THREE.Group();

  // 金属度/粗糙度网格
  const metallicSteps = 5;
  const roughnessSteps = 5;

  for (let m = 0; m < metallicSteps; m++) {
    for (let r = 0; r < roughnessSteps; r++) {
      const metallic = m / (metallicSteps - 1);
      const roughness = r / (roughnessSteps - 1);

      const material = new PBRMaterial({
        albedo: new THREE.Color(0.8, 0.2, 0.2),
        metallic,
        roughness,
      });

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 64, 64),
        createPBRShaderMaterial(material)
      );

      sphere.position.set(
        (m - metallicSteps / 2) * 1.5,
        (r - roughnessSteps / 2) * 1.5,
        0
      );

      group.add(sphere);
    }
  }

  return group;
}
```

---

## 常见误区

1. **粗糙度不平方**：Disney 的 PBR 模型建议对粗糙度参数做平方处理（`alpha = roughness * roughness`），这样在 0~1 范围内的调整更线性、更直观。直接使用原始值会导致低粗糙度区域变化不敏感。

2. **金属表面有漫反射**：金属表面的所有光照都来自镜面反射，漫反射为零。在着色器中必须用 `(1 - metallic)` 来衰减漫反射分量，否则金属表面会出现不真实的漫反射颜色。

3. **忽略能量守恒**：镜面反射和漫反射的比例必须满足能量守恒（`kD + kS <= 1`）。如果两者独立计算而不做约束，表面会看起来"发光"。

4. **法线贴图未做 Gamma 校正**：法线贴图通常存储在 sRGB 空间中，采样后需要转换到线性空间。如果直接使用 sRGB 值作为法线，会导致光照计算不准确。

---

## 工程建议

1. **粗糙度贴图设计**：粗糙度贴图应该使用线性空间存储（不带 Gamma），值范围 0~1。金属区域通常比非金属区域更光滑（粗糙度更低），这能增强金属感。

2. **BRDF 查找表**：预计算 BRDF LUT 可以避免运行时计算复杂的 Fresnel 积分。通常使用 256x256 的 RG16F 格式纹理，存储在场景初始化时。

3. **移动端 PBR**：移动端应使用简化的 PBR 模型——省略几何遮蔽函数 G，使用简化的 NDF（如 Blinn-Phong），将采样次数减少到 1~2 个光源。

4. **材质参数校准**：使用真实材质的测量数据（如 Albedo 值参考 albedo.info）来设置材质参数，避免凭感觉调参导致不真实的效果。

---

## 小结

本节详细讲解了 PBR 的数学原理：微表面理论（NDF、GAF、Fresnel）、Cook-Torrance BRDF、金属度/粗糙度工作流、切线空间法线贴图和 IBL。PBR 的核心思想是能量守恒和基于物理的散射模型，这使得材质在不同光照条件下都能保持视觉一致性。理解这些原理后，你就能够创建任何真实世界的材质。

## 练习

1. 实现基础的 Cook-Torrance BRDF 着色器，仅包含直接光照。
2. 为着色器添加法线贴图支持，实现切线空间变换。
3. 实现 IBL 漫反射部分，使用辐照度贴图替代常量环境光。
4. 添加 IBL 镜面反射，使用预滤波环境贴图和 BRDF 查找表。
5. 创建一个 PBR 材质球展示场景，包含 25 个不同金属度和粗糙度组合的球体。

---

## 参考答案

### 练习一

**思路**：Cook-Torrance BRDF 由漫反射（Lambert）和镜面反射（Cook-Torrance）两部分组成。镜面反射包含三个函数：NDF（GGX）、Fresnel（Schlick）、几何遮蔽（Smith）。直接光照需要对每个光源计算 BRDF 并累加。

**答案**：

```glsl
// Cook-Torrance BRDF 片段着色器（直接光照）
precision highp float;

uniform vec3 uAlbedo;
uniform float uMetallic;
uniform float uRoughness;
uniform vec3 uLightPositions[4];
uniform vec3 uLightColors[4];
uniform int uLightCount;
uniform vec3 uCameraPos;

varying vec3 vWorldPos;
varying vec3 vNormal;

const float PI = 3.14159265359;

// NDF: Trowbridge-Reitz GGX
float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;

    float denom = NdotH2 * (a2 - 1.0) + 1.0;
    denom = PI * denom * denom;

    return a2 / max(denom, 0.0001);
}

// 几何遮蔽：Smith's method
float geometrySchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

// Fresnel: Schlick 近似
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);

    // 计算 F0（基础反射率）
    vec3 F0 = mix(vec3(0.04), uAlbedo, uMetallic);

    vec3 Lo = vec3(0.0);

    for (int i = 0; i < 4; i++) {
        if (i >= uLightCount) break;

        vec3 L = normalize(uLightPositions[i] - vWorldPos);
        vec3 H = normalize(V + L);

        float distance = length(uLightPositions[i] - vWorldPos);
        float attenuation = 1.0 / (distance * distance);
        vec3 radiance = uLightColors[i] * attenuation;

        // Cook-Torrance BRDF
        float D = distributionGGX(N, H, uRoughness);
        float G = geometrySmith(N, V, L, uRoughness);
        vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

        vec3 numerator = D * G * F;
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
        vec3 specular = numerator / denominator;

        // 能量守恒
        vec3 kS = F;
        vec3 kD = (vec3(1.0) - kS) * (1.0 - uMetallic);

        float NdotL = max(dot(N, L), 0.0);
        Lo += (kD * uAlbedo / PI + specular) * radiance * NdotL;
    }

    // 环境光（简化）
    vec3 ambient = vec3(0.03) * uAlbedo;
    vec3 color = ambient + Lo;

    // HDR 色调映射
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
}
```

**要点**：
- F0（基础反射率）：非金属为 0.04，金属为 albedo 颜色值
- 金属度影响两个方面：F0 的值和漫反射的比例（金属无漫反射）
- 粗糙度在 Disney 方法中做平方处理（`roughness²`），使参数调整更线性

---

### 练习二

**思路**：法线贴图将细节法线存储在切线空间中。需要将顶点的法线（N）、切线（T）、副切线（B）构建 TBN 矩阵，将法线贴图采样值从切线空间变换到世界空间。

**答案**：

```glsl
// 切线空间法线贴图顶点着色器
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;
attribute vec3 aTangent;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec3 vWorldPos;
varying vec2 vUV;
varying mat3 vTBN;

void main() {
    vec3 worldPos = (uModelMatrix * vec4(aPosition, 1.0)).xyz;
    vWorldPos = worldPos;
    vUV = aUV;

    // 构建 TBN 矩阵
    vec3 N = normalize((uModelMatrix * vec4(aNormal, 0.0)).xyz);
    vec3 T = normalize((uModelMatrix * vec4(aTangent, 0.0)).xyz);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt 正交化
    vec3 B = cross(N, T);

    vTBN = mat3(T, B, N);

    gl_Position = uProjectionMatrix * uViewMatrix * vec4(worldPos, 1.0);
}
```

```glsl
// 法线贴图片段着色器
precision highp float;

uniform sampler2D uNormalMap;
uniform float uNormalStrength; // 法线强度，如 1.0

varying vec3 vWorldPos;
varying vec2 vUV;
varying mat3 vTBN;

vec3 getNormal() {
    // 采样法线贴图并解码 [0,1] -> [-1,1]
    vec3 tangentNormal = texture2D(uNormalMap, vUV).rgb * 2.0 - 1.0;

    // 可选：调整法线强度（Z 分量保持不变）
    tangentNormal.xy *= uNormalStrength;
    tangentNormal = normalize(tangentNormal);

    // 从切线空间变换到世界空间
    return normalize(vTBN * tangentNormal);
}

void main() {
    vec3 N = getNormal();
    // 后续光照计算使用 N ...
    gl_FragColor = vec4(N * 0.5 + 0.5, 1.0); // 可视化法线
}
```

**要点**：
- TBN 矩阵由切线（T）、副切线（B）、法线（N）组成，将切线空间变换到世界空间
- 切线需要在建模时预计算（包含在顶点属性中），副切线可通过 `cross(N, T)` 计算
- Gram-Schmidt 正交化确保 T 和 N 正交，避免非均匀缩放导致的法线偏移

---

### 练习三

**思路**：IBL 漫反射使用预计算的辐照度贴图（Irradiance Map）替代常量环境光。辐照度贴图存储了每个方向上半球积分的光照贡献，采样法线方向即可获得该点的漫反射环境光。

**答案**：

```glsl
// IBL 漫反射片段着色器
precision highp float;

uniform samplerCube uIrradianceMap; // 辐照度贴图
uniform vec3 uAlbedo;
uniform float uMetallic;

varying vec3 vNormal;
varying vec3 vWorldPos;

const float PI = 3.14159265359;

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);

    vec3 F0 = mix(vec3(0.04), uAlbedo, uMetallic);
    vec3 F = fresnelSchlick(max(dot(N, V), 0.0), F0);

    // 能量守恒
    vec3 kS = F;
    vec3 kD = (vec3(1.0) - kS) * (1.0 - uMetallic);

    // 采样辐照度贴图（法线方向的半球积分）
    vec3 irradiance = textureCube(uIrradianceMap, N).rgb;

    // 漫反射环境光
    vec3 diffuse = kD * irradiance * uAlbedo;

    // 镜面反射（后续练习补充）
    vec3 ambient = diffuse;

    vec3 color = ambient;
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
}
```

```typescript
// 预计算辐照度贴图
function createIrradianceMap(envMap: THREE.CubeTexture): THREE.WebGLRenderTarget {
    // 使用卷积将环境贴图转换为辐照度贴图
    // 每个像素 = 半球内所有方向光照的加权平均
    // 卷积核：cos(theta) * solid_angle
    const irradianceShader = `
        uniform samplerCube uEnvMap;
        varying vec3 vWorldDir;

        void main() {
            vec3 N = vWorldDir;
            vec3 irradiance = vec3(0.0);

            // 半球积分（简化版，实际使用重要性采样）
            vec3 up = vec3(0.0, 1.0, 0.0);
            vec3 right = normalize(cross(up, N));
            up = cross(N, right);

            float sampleDelta = 0.05;
            float nrSamples = 0.0;

            for (float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta) {
                for (float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta) {
                    vec3 tangentSample = vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
                    vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N;
                    irradiance += textureCube(uEnvMap, sampleVec).rgb * cos(theta) * sin(theta);
                    nrSamples++;
                }
            }

            irradiance = PI * irradiance * (1.0 / nrSamples);
            gl_FragColor = vec4(irradiance, 1.0);
        }
    `;
    // ... 渲染到 CubeRenderTarget
}
```

**要点**：
- 辐照度贴图是环境贴图的低频版本，存储每个方向的半球积分光照
- 金属材质没有漫反射（`kD = 0`），所以 IBL 漫反射只对非金属生效
- 预计算在场景加载时完成一次，运行时只需一次 CubeMap 采样

---

### 练习四

**思路**：IBL 镜面反射由两部分组成：预滤波环境贴图（按粗糙度模糊的环境贴图）和 BRDF 查找表（预计算 Fresnel 积分）。预滤波环境贴图的 mip 级别对应不同粗糙度，BRDF LUT 的 UV 由 NdotV 和粗糙度决定。

**答案**：

```glsl
// IBL 镜面反射片段着色器
precision highp float;

uniform samplerCube uPrefilteredMap; // 预滤波环境贴图
uniform sampler2D uBRDFLUT;          // BRDF 查找表
uniform vec3 uAlbedo;
uniform float uMetallic;
uniform float uRoughness;

varying vec3 vNormal;
varying vec3 vWorldPos;

vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);
    float NdotV = max(dot(N, V), 0.0);

    vec3 F0 = mix(vec3(0.04), uAlbedo, uMetallic);

    // Fresnel（粗糙度感知版本）
    vec3 F = fresnelSchlickRoughness(NdotV, F0, uRoughness);

    vec3 kS = F;
    vec3 kD = (vec3(1.0) - kS) * (1.0 - uMetallic);

    // 漫反射 IBL
    vec3 irradiance = textureCube(uIrradianceMap, N).rgb;
    vec3 diffuse = kD * irradiance * uAlbedo;

    // 镜面反射 IBL
    vec3 R = reflect(-V, N);
    // 使用粗糙度作为 mip 级别（粗糙度越高越模糊）
    float maxMipLevel = 7.0; // 假设预滤波贴图有 7 级 mip
    vec3 prefilteredColor = textureCubeLod(uPrefilteredMap, R, uRoughness * maxMipLevel).rgb;

    // BRDF 查找表
    vec2 brdf = texture2D(uBRDFLUT, vec2(NdotV, uRoughness)).rg;
    vec3 specular = prefilteredColor * (F * brdf.x + brdf.y);

    vec3 ambient = diffuse + specular;

    vec3 color = ambient;
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
}
```

**要点**：
- 预滤波环境贴图按粗糙度级别存储不同模糊程度的环境贴图，通过 `textureCubeLod` 采样对应 mip
- BRDF LUT 是 2D 纹理，U 轴为 NdotV，V 轴为粗糙度，存储 Fresnel 积分的近似结果
- `brdf.x` 是 Fresnel 的缩放因子，`brdf.y` 是偏移量，两者组合得到镜面反射的环境光贡献

---

### 练习五

**思路**：创建一个 5×5 的球体网格，X 轴控制金属度（0→1），Y 轴控制粗糙度（0→1）。每个球体使用相同的 PBR 着色器但不同的材质参数，展示金属度和粗糙度的完整组合效果。

**答案**：

```typescript
import * as THREE from 'three';

function createPBRShowcase(scene: THREE.Scene, pbrMaterial: THREE.ShaderMaterial): void {
    const sphereGeometry = new THREE.SphereGeometry(0.5, 64, 64);
    const gridSize = 5;
    const spacing = 1.5;

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const metallic = col / (gridSize - 1);   // 0 → 1（水平：金属度）
            const roughness = row / (gridSize - 1);  // 0 → 1（垂直：粗糙度）

            // 克隆材质并设置独立参数
            const material = pbrMaterial.clone();
            material.uniforms = {
                ...pbrMaterial.uniforms,
                uMetallic: { value: metallic },
                uRoughness: { value: roughness },
                uAlbedo: { value: new THREE.Color(0.8, 0.2, 0.2) }, // 红色基础色
            };

            const sphere = new THREE.Mesh(sphereGeometry, material);
            sphere.position.set(
                (col - (gridSize - 1) / 2) * spacing,
                (row - (gridSize - 1) / 2) * spacing,
                0
            );

            // 添加标签（可选）
            sphere.name = `M:${metallic.toFixed(2)} R:${roughness.toFixed(2)}`;
            scene.add(sphere);
        }
    }

    // 添加标签说明
    // X 轴：金属度 0→1
    // Y 轴：粗糙度 0→1
    // 左下角：非金属+光滑（塑料）
    // 右下角：金属+光滑（镜面金属）
    // 左上角：非金属+粗糙（石头）
    // 右上角：金属+粗糙（磨损金属）
}
```

**要点**：
- 5×5 网格覆盖了材质参数空间的典型组合：塑料（左下）、镜面金属（右下）、石头（左上）、磨损金属（右上）
- 确保场景中有足够的环境光（IBL）来展示材质的反射特性
- 使用统一的 albedo 颜色可以更清晰地对比金属度和粗糙度的影响
