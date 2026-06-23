# 阶段实战：Shader 特效合集——可视化效果对比

## 当前项目状态

前 9 课学了 GLSL 语法、顶点/片元着色器、Uniform/Varying、纹理采样、噪声函数、光照模型、自定义 ShaderMaterial、调试和热重载。本课把这些知识整合成一个 Shader 特效合集页面。

## 特效列表

```
1. 渐变色
2. 格子图案
3. 圆形和环形
4. 噪声纹理
5. 水波纹
6. 卡通着色（Toon Shading）
7. 菲涅尔效果
8. 扫描线效果
```

## 渐变色

```glsl
// fragment.glsl
precision mediump float;
varying vec2 v_uv;
uniform float u_time;

void main() {
  // 线性渐变
  vec3 color = mix(
    vec3(0.9, 0.2, 0.3),  // 红
    vec3(0.2, 0.5, 0.9),  // 蓝
    v_uv.x
  );
  gl_FragColor = vec4(color, 1.0);
}
```

## 格子图案

```glsl
void main() {
  vec2 grid = floor(v_uv * 8.0);
  float checker = mod(grid.x + grid.y, 2.0);
  vec3 color = mix(vec3(0.1), vec3(0.9), checker);
  gl_FragColor = vec4(color, 1.0);
}
```

## 噪声纹理

```glsl
// 简单的 2D 噪声
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  float n = noise(v_uv * 10.0);
  gl_FragColor = vec4(vec3(n), 1.0);
}
```

## 水波纹

```glsl
void main() {
  vec2 center = vec2(0.5);
  float dist = distance(v_uv, center);
  float wave = sin(dist * 30.0 - u_time * 3.0) * 0.5 + 0.5;
  vec3 color = mix(vec3(0.1, 0.3, 0.6), vec3(0.3, 0.6, 0.9), wave);
  gl_FragColor = vec4(color, 1.0);
}
```

## 卡通着色

```glsl
varying vec3 v_normal;
varying vec3 v_lightDir;

void main() {
  vec3 N = normalize(v_normal);
  vec3 L = normalize(v_lightDir);
  float intensity = dot(N, L);

  // 阶梯化：把连续的光照变成离散的色阶
  if (intensity > 0.8) intensity = 1.0;
  else if (intensity > 0.5) intensity = 0.7;
  else if (intensity > 0.2) intensity = 0.4;
  else intensity = 0.2;

  vec3 color = vec3(0.4, 0.7, 1.0) * intensity;
  gl_FragColor = vec4(color, 1.0);
}
```

## 菲涅尔效果

```glsl
varying vec3 v_normal;
varying vec3 v_viewDir;

void main() {
  vec3 N = normalize(v_normal);
  vec3 V = normalize(v_viewDir);

  // 菲涅尔：边缘更亮
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

  vec3 baseColor = vec3(0.2, 0.5, 0.8);
  vec3 edgeColor = vec3(0.8, 0.9, 1.0);
  vec3 color = mix(baseColor, edgeColor, fresnel);

  gl_FragColor = vec4(color, 1.0);
}
```

## 效果对比页面

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .cell { position: relative; }
    .cell canvas { width: 100%; aspect-ratio: 1; }
    .cell label { position: absolute; bottom: 4px; left: 4px;
                  background: rgba(0,0,0,0.5); color: white;
                  padding: 2px 6px; font-size: 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Shader 特效合集</h1>
  <div class="grid" id="grid"></div>
  <script type="module">
    import * as THREE from 'three'

    const effects = [
      { name: '渐变色', shader: gradientShader },
      { name: '格子', shader: checkerShader },
      { name: '噪声', shader: noiseShader },
      { name: '水波纹', shader: waveShader },
      { name: '卡通', shader: toonShader },
      { name: '菲涅尔', shader: fresnelShader },
      { name: '扫描线', shader: scanlineShader },
      { name: '圆形', shader: circleShader },
    ]

    for (const effect of effects) {
      const cell = document.createElement('div')
      cell.className = 'cell'

      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 256
      cell.appendChild(canvas)

      const label = document.createElement('label')
      label.textContent = effect.name
      cell.appendChild(label)

      document.getElementById('grid').appendChild(cell)
      renderEffect(canvas, effect.shader)
    }
  </script>
</body>
</html>
```

## 你可能踩的坑

**坑一：噪声函数精度问题**

不同 GPU 的 `sin` 精度不同，`hash` 函数的结果可能不一致。

**坑二：Shader 编译错误不明显**

GLSL 编译错误只在控制台显示，不会阻塞页面。用 `gl.getShaderInfoLog` 检查。

**坑三：性能问题**

片元着色器中的复杂计算（如多次纹理采样、循环）会严重影响性能。

## 练习

### 练习一：自定义特效

实现一个自定义 Shader 特效：用噪声函数生成大理石纹理。

### 练习二：特效切换动画

实现特效之间的平滑过渡：用 `mix` 函数在两个 Shader 的输出之间插值。

---

## 参考答案

### 练习一

```glsl
// 大理石纹理
void main() {
  vec2 p = v_uv * 5.0;
  float n = noise(p);
  float vein = sin(p.x * 3.0 + n * 5.0) * 0.5 + 0.5;
  vec3 color = mix(vec3(0.9, 0.85, 0.7), vec3(0.4, 0.3, 0.2), vein);
  gl_FragColor = vec4(color, 1.0);
}
```

### 练习二

```glsl
uniform sampler2D u_texture1;
uniform sampler2D u_texture2;
uniform float u_mix;

void main() {
  vec4 color1 = texture2D(u_texture1, v_uv);
  vec4 color2 = texture2D(u_texture2, v_uv);
  gl_FragColor = mix(color1, color2, u_mix);
}
```
