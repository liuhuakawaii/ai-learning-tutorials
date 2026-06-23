# 风格化渲染——卡通渲染/像素化/故障艺术

## 不一定要追求真实

PBR 材质、光线追踪、HDR 环境——前面的课都在追求"真实"。但真实不是唯一的审美方向。卡通渲染、像素化、故障艺术这些风格化手法，能让页面有强烈的品牌个性。

## 卡通渲染（Toon Shading）

卡通渲染的核心：把连续的光照梯度离散化为几档色块。

正常 PBR：光照从暗到亮是平滑渐变。
卡通渲染：只有"暗"、"中"、"亮"三个色块，边界清晰。

```glsl
// fragment shader
uniform vec3 lightDir;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  vec3 normal = normalize(vNormal);
  float NdotL = dot(normal, normalize(lightDir));
  
  // 离散化
  float shade;
  if (NdotL > 0.6) shade = 1.0;
  else if (NdotL > 0.2) shade = 0.6;
  else if (NdotL > -0.1) shade = 0.3;
  else shade = 0.1;
  
  vec3 baseColor = vec3(0.2, 0.5, 0.9);
  gl_FragColor = vec4(baseColor * shade, 1.0);
}
```

### 描边（Outline）

卡通风格通常有黑色描边。最常用的方法是**法线外扩**：

在 vertex shader 里沿法线方向把顶点往外推一点，然后用正面剔除渲染背面，得到一圈描边：

```glsl
// outline.vert
uniform float outlineWidth;

void main() {
  vec3 pos = position + normal * outlineWidth;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}

// outline.frag
void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // 纯黑
}
```

```ts
// 在 Three.js 中实现
const outlineMesh = originalMesh.clone()
outlineMesh.material = new ShaderMaterial({
  vertexShader: outlineVert,
  fragmentShader: outlineFrag,
  side: BackSide, // 只渲染背面
})
outlineMesh.scale.multiplyScalar(1.02)
scene.add(outlineMesh)
```

## 像素化（Pixelation）

把渲染分辨率降低，再用最近邻采样放大，就得到像素风格。

```ts
// 降低渲染分辨率
const pixelRatio = 0.1 // 10% 分辨率
renderer.setSize(innerWidth * pixelRatio, innerHeight * pixelRatio, false)
renderer.domElement.style.width = "100%"
renderer.domElement.style.height = "100%"
renderer.domElement.style.imageRendering = "pixelated" // CSS 最近邻
```

更精细的控制是用后处理：

```glsl
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float pixelSize;

varying vec2 vUv;

void main() {
  vec2 pixels = resolution / pixelSize;
  vec2 uv = floor(vUv * pixels) / pixels;
  gl_FragColor = texture2D(tDiffuse, uv);
}
```

## 故障艺术（Glitch Art）

GlitchPass 只是基础。更酷的故障效果可以自己做：

### 扫描线

```glsl
void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  
  // 水平扫描线
  float scanline = sin(vUv.y * resolution.y * 1.5) * 0.04;
  color.rgb -= scanline;
  
  gl_FragColor = color;
}
```

### 随机水平位移

```glsl
uniform float uTime;
uniform float uIntensity;

float random(float seed) {
  return fract(sin(seed * 12.9898) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  
  // 随机选择某些行做水平位移
  float row = floor(uv.y * 100.0);
  float shouldDisplace = step(0.98, random(row + floor(uTime * 10.0)));
  uv.x += shouldDisplace * (random(row) - 0.5) * uIntensity;
  
  vec4 color = texture2D(tDiffuse, uv);
  gl_FragColor = color;
}
```

### RGB 分离

```glsl
void main() {
  vec2 uv = vUv;
  float offset = 0.01 * sin(uTime * 3.0);
  
  float r = texture2D(tDiffuse, uv + vec2(offset, 0.0)).r;
  float g = texture2D(tDiffuse, uv).g;
  float b = texture2D(tDiffuse, uv - vec2(offset, 0.0)).b;
  
  gl_FragColor = vec4(r, g, b, 1.0);
}
```

## 组合使用

风格化效果可以叠加：

```
场景渲染 → Toon Shader → 描边 → 像素化 → 扫描线 → Glitch → 输出
```

顺序很重要——先做 Toon 再像素化，和先像素化再 Toon，结果完全不同。

## 实验：同场景三种风格

同一个模型，三种渲染风格并排对比：

| 风格 | Shader | 后处理 |
|------|--------|--------|
| 写实 PBR | MeshPhysicalMaterial | Bloom + 景深 |
| 卡通 | Toon + Outline | 色块化 + 无后处理 |
| 故障 | PBR | Glitch + 扫描线 + CA |

## 练习

### 练习一：滚动风格过渡

一个产品模型，从写实 PBR 渲染过渡到卡通风格。不是瞬间切换，而是通过 shader uniform 平滑过渡：光照的离散化程度从连续渐变到三档色块，描边从透明逐渐显现。

### 练习二：CRT 显示器效果

模拟老式 CRT 显示器的视觉效果：扫描线 + 屏幕弯曲 + 边缘暗角 + 轻微的色彩偏移 + 偶尔的闪烁。用后处理链实现。

---

## 参考答案

### 练习一

**思路**：在 shader 里用 `mixFactor` 混合 PBR 和 Toon 光照。

```glsl
uniform float uToonMix; // 0=PBR, 1=Toon

void main() {
  float NdotL = dot(normal, normalize(lightDir));
  
  // PBR 连续光照
  float pbrShade = max(0.0, NdotL);
  
  // Toon 离散光照
  float toonShade;
  if (NdotL > 0.6) toonShade = 1.0;
  else if (NdotL > 0.2) toonShade = 0.6;
  else toonShade = 0.3;
  
  float shade = mix(pbrShade, toonShade, uToonMix);
  
  // 描边
  float outline = 1.0; // 从 outline pass 合成
  color = baseColor * shade * mix(1.0, outline, uToonMix);
}
```

```ts
// ScrollTrigger 控制
onUpdate: (self) => {
  toonMaterial.uniforms.uToonMix.value = self.progress
  outlineMesh.material.opacity = self.progress
}
```

### 练习二

**思路**：多个后处理 pass 组合。

```ts
const crtShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uCurvature: { value: 3.0 },
    uScanlineIntensity: { value: 0.1 },
    uVignetteIntensity: { value: 0.5 },
  },
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uCurvature;
    uniform float uScanlineIntensity;
    uniform float uVignetteIntensity;
    varying vec2 vUv;
    
    vec2 curveUV(vec2 uv) {
      uv = uv * 2.0 - 1.0;
      vec2 offset = abs(uv.yx) / vec2(uCurvature);
      uv = uv + uv * offset * offset;
      uv = uv * 0.5 + 0.5;
      return uv;
    }
    
    void main() {
      vec2 uv = curveUV(vUv);
      
      // 超出屏幕范围
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0);
        return;
      }
      
      vec4 color = texture2D(tDiffuse, uv);
      
      // 扫描线
      float scanline = sin(uv.y * 800.0) * uScanlineIntensity;
      color.rgb -= scanline;
      
      // 偶尔闪烁
      float flicker = 0.99 + 0.01 * sin(uTime * 8.0);
      color.rgb *= flicker;
      
      // 暗角
      vec2 vignette = uv * (1.0 - uv);
      float vig = vignette.x * vignette.y * 15.0;
      vig = pow(vig, uVignetteIntensity);
      color.rgb *= vig;
      
      gl_FragColor = color;
    }
  `,
}
```

**常见错误**：CRT 弯曲效果会让 UV 超出 0-1 范围，不处理的话边缘会出现重复或拉伸。加 `if` 判断超出范围就输出黑色。
