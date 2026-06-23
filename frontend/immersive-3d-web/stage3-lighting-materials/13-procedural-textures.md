# 程序化纹理——噪声/分形生成材质（大理石/木纹/地形）

## 不用贴图也能做出好材质

一张 4K 贴图占 16MB 显存，放大后还会模糊。程序化纹理用数学公式在 shader 里实时生成图案，无限分辨率，显存占用为零。

大理石的纹路、木头的年轮、地形的等高线——这些都可以用噪声函数组合出来。

## 噪声函数基础

**白噪声**：每个点随机值，像电视雪花。用处不大。

```glsl
float whiteNoise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
```

**Value Noise**：在整数网格点生成随机值，中间用插值平滑。结果有块状感。

```glsl
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  
  float a = whiteNoise(i);
  float b = whiteNoise(i + vec2(1.0, 0.0));
  float c = whiteNoise(i + vec2(0.0, 1.0));
  float d = whiteNoise(i + vec2(1.0, 1.0));
  
  vec2 u = f * f * (3.0 - 2.0 * f); // smoothstep
  
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
```

**Perlin Noise**：在网格点生成梯度向量，用点积计算贡献。比 Value Noise 更自然，没有明显的方向性。

```glsl
float perlinNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // quintic
  
  return mix(
    mix(dot(hash2(i), f),
        dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}
```

**Simplex Noise**：比 Perlin 更高效，没有方向伪影。适合 GPU。

## 分形布朗运动（FBM）

单层噪声只有一种尺度的细节。把多层不同频率和振幅的噪声叠加，就得到分形细节——近看有小细节，远看有大结构：

```glsl
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  
  for (int i = 0; i < octaves; i++) {
    value += amplitude * perlinNoise(p * frequency);
    amplitude *= 0.5;  // 每层振幅减半
    frequency *= 2.0;  // 每层频率翻倍
  }
  
  return value;
}
```

4-6 层就够了。更多层增加的细节肉眼已经分辨不出。

## 大理石

大理石的纹路来自层状结构被地质压力扭曲。用噪声扭曲一个正弦波：

```glsl
vec3 marble(vec2 p) {
  float noise = fbm(p * 3.0, 6);
  
  // 用噪声扭曲正弦波的输入
  float wave = sin(p.x * 10.0 + noise * 8.0);
  
  // 映射到颜色
  float t = wave * 0.5 + 0.5; // 0-1
  vec3 white = vec3(0.95, 0.93, 0.88);
  vec3 dark = vec3(0.3, 0.2, 0.15);
  
  return mix(white, dark, t);
}
```

调整 `noise * 8.0` 的系数可以控制纹路的扭曲程度。

## 木纹

木纹是同心圆环被噪声扭曲：

```glsl
vec3 wood(vec2 p) {
  float noise = fbm(p * 4.0, 4);
  
  // 到中心的距离 + 噪声扭曲
  float dist = length(p - vec2(0.5)) * 20.0 + noise * 5.0;
  
  // 年轮
  float ring = fract(dist);
  float ringValue = smoothstep(0.3, 0.5, ring) - smoothstep(0.5, 0.7, ring);
  
  vec3 lightWood = vec3(0.8, 0.5, 0.2);
  vec3 darkWood = vec3(0.4, 0.2, 0.05);
  
  return mix(lightWood, darkWood, ringValue);
}
```

## 地形

用 FBM 做高度图，然后根据高度着色：

```glsl
vec3 terrain(vec2 p) {
  float height = fbm(p * 2.0, 8);
  
  // 根据高度分层
  if (height < -0.1) return vec3(0.1, 0.3, 0.8);   // 水
  if (height < 0.0) return vec3(0.76, 0.7, 0.5);    // 沙滩
  if (height < 0.3) return vec3(0.2, 0.6, 0.2);     // 草地
  if (height < 0.6) return vec3(0.4, 0.3, 0.2);     // 岩石
  return vec3(0.9, 0.9, 0.95);                       // 雪
}
```

## 在 Three.js 中使用自定义 Shader

```ts
const material = new ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uScale: { value: 3.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uScale;
    varying vec2 vUv;
    
    // ... noise functions ...
    
    void main() {
      vec3 color = marble(vUv * uScale);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
})
```

## 动态噪声

噪声的输入加一个时间偏移，图案就会"流动"：

```glsl
float animatedFbm = fbm(p + vec2(uTime * 0.1, uTime * 0.05), 6);
```

大理石纹路缓缓流动，木纹年轮缓慢旋转，地形上的云影移动。

## 练习

### 练习一：程序化云层

用 FBM 生成云层纹理，贴在一个平面上方。云的密度由噪声值决定：值高的地方浓密，值低的地方稀薄。加上时间偏移让云缓慢飘动。颜色从白色到淡灰色过渡。

### 练习二：腐蚀金属表面

用噪声模拟金属表面的锈蚀效果。原始金属色在噪声值高的区域逐渐变成锈红色。同时 roughness 也随噪声变化——锈蚀区域更粗糙。把这张程序化材质应用到上一课的金属球上。

---

## 参考答案

### 练习一

**思路**：多层 FBM 叠加，阈值控制云密度。

```glsl
vec4 cloud(vec2 uv, float time) {
  float n = fbm(uv * 3.0 + vec2(time * 0.02, time * 0.01), 6);
  float density = smoothstep(0.3, 0.7, n);
  
  vec3 cloudColor = mix(
    vec3(0.9, 0.95, 1.0),  // 薄云
    vec3(0.7, 0.75, 0.8),  // 厚云
    density
  );
  
  return vec4(cloudColor, density * 0.9);
}
```

渲染到一个半透明平面，放在场景上方。alpha 让天空背景透过来。

### 练习二

**思路**：噪声值同时驱动颜色和 roughness。

```glsl
uniform vec3 metalColor;
uniform vec3 rustColor;

void main() {
  float noise = fbm(vUv * 10.0, 5);
  float rustMask = smoothstep(0.2, 0.6, noise);
  
  vec3 color = mix(metalColor, rustColor, rustMask);
  float roughness = mix(0.1, 0.9, rustMask);
  float metalness = mix(1.0, 0.3, rustMask);
  
  gl_FragColor = vec4(color, 1.0);
  // roughness 和 metalness 通过 varying 或 uniform 传给 PBR shader
}
```

**常见错误**：噪声的 UV 坐标缩放太小会导致看不出纹理，太大会导致锯齿。先从 scale=1 开始，逐步增大直到纹理密度合适。
