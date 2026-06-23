# GLSL 基础语法：Shader 的编程语言

## 现象

你用 Three.js 的 `MeshStandardMaterial` 能做出不错的材质，但如果你想实现一个自定义的渐变效果、卡通风格、或者水面波纹——内置材质就不够用了。你需要写 Shader。

GLSL（OpenGL Shading Language）是 Shader 的编程语言。语法类似 C，但运行在 GPU 上。

## 数据类型

```glsl
// 标量
float a = 1.0;      // 浮点数（必须带小数点）
int b = 42;          // 整数
bool c = true;       // 布尔

// 向量
vec2 v2 = vec2(1.0, 2.0);
vec3 v3 = vec3(1.0, 2.0, 3.0);
vec4 v4 = vec4(1.0, 2.0, 3.0, 4.0);

// 访问分量
float x = v3.x;     // 也支持 .r, .s
float y = v3.y;     // 也支持 .g, .t
float z = v3.z;     // 也支持 .b, .p

// 向量重组
vec2 xy = v3.xy;    // (1.0, 2.0)
vec3 bgr = v3.bgr;  // (3.0, 2.0, 1.0)

// 矩阵
mat4 m = mat4(1.0); // 4x4 单位矩阵
mat3 m3 = mat3(1.0);

// 纹理采样器
sampler2D tex;       // 2D 纹理
samplerCube cubeTex; // 立方体纹理
```

## 内置函数

```glsl
// 数学
float sin(float)
float cos(float)
float tan(float)
float sqrt(float)
float pow(float base, float exp)
float abs(float)
float sign(float)
float floor(float)
float ceil(float)
float fract(float)    // 小数部分
float mod(float, float)
float min(float, float)
float max(float, float)
float clamp(float min, float max, float val)
float mix(float a, float b, float t)  // 线性插值: a + (b-a)*t
float step(float edge, float val)     // 阶梯函数
float smoothstep(float a, float b, float t) // 平滑阶梯

// 向量
float length(vec3)
float distance(vec3, vec3)
float dot(vec3, vec3)
vec3 cross(vec3, vec3)
vec3 normalize(vec3)
vec3 reflect(vec3 I, vec3 N)
vec3 refract(vec3 I, vec3 N, float eta)
```

## 顶点着色器

```glsl
#version 300 es

// 输入（Attribute）
in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

// 输出（Varying）
out vec3 v_normal;
out vec2 v_uv;
out vec3 v_worldPos;

// Uniform
uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat3 u_normalMatrix;

void main() {
  vec4 worldPos = u_modelMatrix * vec4(a_position, 1.0);
  v_worldPos = worldPos.xyz;
  v_normal = u_normalMatrix * a_normal;
  v_uv = a_uv;

  gl_Position = u_projectionMatrix * u_viewMatrix * worldPos;
}
```

## 片元着色器

```glsl
#version 300 es
precision mediump float;

// 输入（从顶点着色器插值）
in vec3 v_normal;
in vec2 v_uv;
in vec3 v_worldPos;

// 输出
out vec4 fragColor;

// Uniform
uniform vec3 u_lightPos;
uniform vec3 u_cameraPos;
uniform sampler2D u_texture;

void main() {
  vec3 N = normalize(v_normal);
  vec3 L = normalize(u_lightPos - v_worldPos);
  vec3 V = normalize(u_cameraPos - v_worldPos);
  vec3 H = normalize(L + V);

  // Blinn-Phong 光照
  float diffuse = max(dot(N, L), 0.0);
  float specular = pow(max(dot(N, H), 0.0), 32.0);

  vec3 baseColor = texture(u_texture, v_uv).rgb;
  vec3 color = baseColor * (0.1 + 0.7 * diffuse) + vec3(0.3) * specular;

  fragColor = vec4(color, 1.0);
}
```

## 在 Three.js 中使用自定义 Shader

```typescript
const material = new THREE.ShaderMaterial({
  uniforms: {
    u_time: { value: 0 },
    u_color1: { value: new THREE.Color(0xff6b6b) },
    u_color2: { value: new THREE.Color(0x4ecdc4) }
  },
  vertexShader: `
    varying vec2 v_uv;
    void main() {
      v_uv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float u_time;
    uniform vec3 u_color1;
    uniform vec3 u_color2;
    varying vec2 v_uv;
    void main() {
      float t = sin(v_uv.x * 10.0 + u_time) * 0.5 + 0.5;
      vec3 color = mix(u_color1, u_color2, t);
      gl_FragColor = vec4(color, 1.0);
    }
  `
})

// 动画更新
function animate() {
  material.uniforms.u_time.value = performance.now() / 1000
  requestAnimationFrame(animate)
}
```

## 你可能踩的坑

**坑一：忘记 `precision mediump float`**

片元着色器必须声明浮点精度，否则编译失败。

**坑二：GLSL 的类型转换比 JS 严格**

`float a = 1;` 会报错，必须写 `float a = 1.0;`

**坑三：varying 不匹配**

顶点着色器的 `out` 变量名和片元着色器的 `in` 变量名必须一致。

## 练习

### 练习一：渐变 Shader

实现一个 Shader：根据 UV 坐标从红色渐变到蓝色。

### 练习二：时间动画

实现一个 Shader：用 `u_time` uniform 实现颜色随时间变化的效果。

---

## 参考答案

### 练习一

```glsl
// 片元着色器
precision mediump float;
varying vec2 v_uv;
void main() {
  vec3 color = mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), v_uv.x);
  gl_FragColor = vec4(color, 1.0);
}
```

### 练习二

```glsl
uniform float u_time;
varying vec2 v_uv;
void main() {
  float r = sin(u_time) * 0.5 + 0.5;
  float g = sin(u_time + 2.094) * 0.5 + 0.5;
  float b = sin(u_time + 4.189) * 0.5 + 0.5;
  gl_FragColor = vec4(r, g, b, 1.0);
}
```
