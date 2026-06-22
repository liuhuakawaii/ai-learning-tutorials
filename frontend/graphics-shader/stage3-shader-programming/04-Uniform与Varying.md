# Uniform 与 Varying

## 场景引入

Shader 运行在 GPU 上，CPU 无法直接访问它的变量。那么如何把时间、鼠标位置、变换矩阵等数据从 CPU 传到 GPU？答案就是 Uniform 变量。而 Varying 变量则负责在顶点着色器和片元着色器之间传递数据，由 GPU 自动完成插值。理解这两类变量的工作机制，是连接 CPU 和 GPU 世界的桥梁。

## 学习目标

1. 掌握 Uniform 变量的声明、使用和最佳实践
2. 理解 Varying 的插值机制（包括透视校正）
3. 学会使用 u_time、u_mouse、u_resolution 驱动 Shader 效果
4. 掌握 Uniform Buffer Object 的使用方法

---

## 一、Uniform 变量基础

### 1.1 声明与使用

Uniform 变量是**只读**的，所有顶点和片元共享同一份数据：

```glsl
// 顶点着色器和片元着色器都可以声明同名 Uniform
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform float uTime;
uniform vec2 uResolution;
uniform sampler2D uTexture;
```

### 1.2 CPU 端设置 Uniform

```typescript
// Three.js 中设置 Uniform
const material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0.0 },
        uResolution: { value: new THREE.Vector2() },
        uLightDir: { value: new THREE.Vector3(1, 1, 1).normalize() },
        uTexture: { value: texture },
    },
    vertexShader: vertexShaderSource,
    fragmentShader: fragmentShaderSource,
});

// 每帧更新
function animate() {
    material.uniforms.uTime.value = performance.now() / 1000;
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
```

**原生 WebGL 设置**：

```typescript
// 获取 Uniform 位置
const timeLoc = gl.getUniformLocation(program, 'uTime');
const resolutionLoc = gl.getUniformLocation(program, 'uResolution');
const lightDirLoc = gl.getUniformLocation(program, 'uLightDir');

// 设置值
gl.uniform1f(timeLoc, performance.now() / 1000);
gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
gl.uniform3f(lightDirLoc, 1.0, 1.0, 1.0);

// 矩阵需要使用 Matrix4fv
const matrixLoc = gl.getUniformLocation(program, 'uModelMatrix');
gl.uniformMatrix4fv(matrixLoc, false, modelMatrix.elements);
```

---

## 二、Varying 变量与插值

### 2.1 基本使用

Varying 变量从顶点着色器输出，经过光栅化阶段的插值后，传入片元着色器：

```glsl
// 顶点着色器
varying vec3 vColor;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vColor = aColor;        // 直接传递顶点颜色
    vUv = aUv;              // 直接传递 UV 坐标
    vNormal = aNormal;      // 传递法线
    gl_Position = uMVP * vec4(aPosition, 1.0);
}

// 片元着色器
varying vec3 vColor;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
    // 这里的值是经过插值的，不是顶点着色器的原始值
    gl_FragColor = vec4(vColor, 1.0);
}
```

### 2.2 插值过程图解

```
顶点着色器输出 → 光栅化插值 → 片元着色器输入

顶点 A (颜色=红)          片元 (颜色=红蓝混合)
     ●───────────────────────●
     │                       │
     │   光栅化器自动计算     │
     │   每个片元的插值值     │
     │                       │
     ●───────────────────────●
顶点 B (颜色=蓝)          片元 (颜色=红蓝混合)

插值公式（重心坐标）：
P = λA * A + λB * B + λC * C

其中 λA + λB + λC = 1，是三角形内点 P 的重心坐标
```

### 2.3 透视校正插值

这是 Varying 最容易被忽略的细节：GPU 使用**透视校正**插值，而非简单的屏幕空间线性插值。

```
透视校正 vs 线性插值：

相机
  ◉
  │╲
  │ ╲
  │  ╲  近处三角形（小）
  │   ╲
  │    ●───────●
  │    │ 远处  │
  │    │三角形 │
  │    │（大） │
  │    ●───────●
  │
屏幕

透视投影后，远处的三角形在屏幕上被压缩。
如果直接在屏幕空间线性插值，纹理会出现扭曲。
GPU 自动进行透视除法，确保插值在 3D 空间中是正确的。
```

**数学原理**：

```glsl
// 透视校正插值的简化说明
// 对于透视投影，正确的插值公式是：

// 在顶点着色器中，GPU 记录每个顶点的 1/w 值
// 对于片元 P，其 varying 值为：

// V_P = (V_A/w_A * λA + V_B/w_B * λB + V_C/w_C * λC)
//      / (1/w_A * λA + 1/w_B * λB + 1/w_C * λC)

// 这保证了在 3D 空间中等间距的点，在屏幕上的插值也是正确的
```

---

## 三、常用内置 Uniform

### 3.1 u_time 驱动动画

```glsl
uniform float uTime;  // 时间，单位：秒

void main() {
    vec2 uv = vUv;

    // 旋转动画
    float angle = uTime * 0.5;  // 每秒旋转 0.5 弧度
    float s = sin(angle);
    float c = cos(angle);
    uv = mat2(c, -s, s, c) * (uv - 0.5) + 0.5;

    // 脉冲动画
    float pulse = sin(uTime * 2.0) * 0.5 + 0.5;  // 0~1 循环

    // 颜色循环
    vec3 color = 0.5 + 0.5 * cos(uTime + uv.xyx + vec3(0, 2, 4));

    gl_FragColor = vec4(color, 1.0);
}
```

### 3.2 u_mouse 交互

```glsl
uniform vec2 uMouse;      // 鼠标位置，归一化到 [0,1]
uniform vec2 uMouseDelta; // 鼠标移动增量

void main() {
    vec2 uv = vUv;

    // 鼠标影响的扭曲效果
    vec2 mouse = uMouse;
    float dist = distance(uv, mouse);
    float strength = smoothstep(0.3, 0.0, dist);
    uv += normalize(uv - mouse) * strength * 0.1;

    // 鼠标跟踪的光晕
    float glow = 0.01 / (dist + 0.01);
    vec3 color = texture2D(uTexture, uv).rgb + vec3(glow * 0.3);

    gl_FragColor = vec4(color, 1.0);
}
```

### 3.3 u_resolution 屏幕尺寸

```glsl
uniform vec2 uResolution;  // 屏幕分辨率（像素）

varying vec2 vUv;

void main() {
    // 将 UV 从 [0,1] 转换为像素坐标
    vec2 pixel = vUv * uResolution;

    // 宽高比校正
    float aspect = uResolution.x / uResolution.y;
    vec2 uv = vUv;
    uv.x *= aspect;

    // 基于像素坐标的特效
    float grid = step(0.5, fract(pixel.x / 20.0)) + step(0.5, fract(pixel.y / 20.0));
    grid = mod(grid, 2.0);

    vec3 color = vec3(grid);
    gl_FragColor = vec4(color, 1.0);
}
```

---

## 四、Uniform Buffer Object (UBO)

### 4.1 为什么需要 UBO？

当多个 Shader 共享同一组 Uniform 时，逐个设置 Uniform 效率低下。UBO 允许将一组 Uniform 打包成一个 Buffer，一次绑定即可：

```
传统方式：                    UBO 方式：
Shader A ──→ Set Uniform 1   Shader A ──→ Bind UBO
Shader A ──→ Set Uniform 2   Shader B ──→ Bind UBO (同一份数据)
Shader A ──→ Set Uniform 3   Shader C ──→ Bind UBO (同一份数据)
Shader B ──→ Set Uniform 1
Shader B ──→ Set Uniform 2
Shader B ──→ Set Uniform 3

多次 API 调用                  一次 API 调用
```

### 4.2 UBO 的内存布局

```glsl
// GLSL 中声明 Uniform Block
layout(std140) uniform CameraData {
    mat4 uViewMatrix;           // 偏移 0, 大小 64
    mat4 uProjectionMatrix;     // 偏移 64, 大小 64
    vec3 uCameraPosition;       // 偏移 128, 大小 12 (padding 4)
    float uNear;                // 偏移 140, 大小 4
    float uFar;                 // 偏移 144, 大小 4
    float uTime;                // 偏移 148, 大小 4
};

// std140 布局规则：
// 标量：4 字节对齐
// vec2：8 字节对齐
// vec3/vec4：16 字节对齐
// mat4：16 字节对齐（按列存储，每列 16 字节）
// 数组：每个元素 16 字节对齐
```

### 4.3 TypeScript 端使用 UBO

```typescript
// 创建 UBO
const uboBuffer = gl.createBuffer();
gl.bindBuffer(gl.UNIFORM_BUFFER, uboBuffer);
gl.bufferData(gl.UNIFORM_BUFFER, 160, gl.DYNAMIC_DRAW);  // 160 字节

// 填充数据
const data = new Float32Array(40);
data.set(viewMatrix.elements, 0);       // 偏移 0
data.set(projMatrix.elements, 16);      // 偏移 64 (16*4)
data.set([cameraPos.x, cameraPos.y, cameraPos.z, 0], 32); // 偏移 128
data.set([near, far, time, 0], 36);     // 偏移 144

gl.bindBuffer(gl.UNIFORM_BUFFER, uboBuffer);
gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);

// 绑定到绑定点
const blockIndex = gl.getUniformBlockIndex(program, 'CameraData');
gl.uniformBlockBinding(program, blockIndex, 0);  // 绑定点 0
gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, uboBuffer);
```

---

## 五、CPU 到 GPU 数据传递最佳实践

### 5.1 数据传递方式对比

```
方式              更新频率        数据量      适用场景
──────────────────────────────────────────────────────
Uniform          每帧           小          变换矩阵、时间、颜色
UBO              每帧           中          相机数据、光照参数
Texture          低频           大          查找表、噪声图、预计算数据
SSBO             每帧           大          粒子系统、大量实例数据
Varying          每顶点         中          UV、法线、颜色
```

### 5.2 性能优化策略

```typescript
// 策略 1：减少 Uniform 更新次数
// 不好：每帧更新所有 Uniform
material.uniforms.uTime.value = time;
material.uniforms.uMouse.value = mouse;
material.uniforms.uResolution.value = resolution;

// 好：只更新变化的 Uniform
if (mouseChanged) {
    material.uniforms.uMouse.value.copy(mouse);
}
material.uniforms.uTime.value = time;  // 时间每帧必更新

// 策略 2：使用纹理代替大量 Uniform
// 不好：传递 1000 个浮点数作为 Uniform
// const data = new Float32Array(1000);
// gl.uniform1fv(loc, data);

// 好：将数据打包到纹理中
const dataTexture = new THREE.DataTexture(data, 1000, 1, THREE.RedFormat);
dataTexture.needsUpdate = true;
material.uniforms.uDataTexture.value = dataTexture;

// 策略 3：使用 InstancedBufferAttribute 传递逐实例数据
// 而不是为每个实例设置单独的 Uniform
const offsets = new Float32Array(instanceCount * 3);
const offsetAttr = new THREE.InstancedBufferAttribute(offsets, 3);
geometry.setAttribute('aOffset', offsetAttr);
```

---

## 六、完整示例：交互式 Shader

```glsl
// 顶点着色器
uniform mat4 uMVP;
uniform float uTime;

attribute vec3 aPosition;
attribute vec2 aUv;

varying vec2 vUv;
varying float vWave;

void main() {
    vec3 pos = aPosition;

    // 顶点动画
    float wave = sin(pos.x * 3.0 + uTime) * cos(pos.z * 3.0 + uTime) * 0.1;
    pos.y += wave;
    vWave = wave;

    vUv = aUv;
    gl_Position = uMVP * vec4(pos, 1.0);
}
```

```glsl
// 片元着色器
precision mediump float;

uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uResolution;
uniform sampler2D uTexture;

varying vec2 vUv;
varying float vWave;

void main() {
    vec2 uv = vUv;

    // 鼠标交互扭曲
    vec2 mouse = uMouse;
    float dist = distance(uv, mouse);
    float influence = smoothstep(0.4, 0.0, dist);
    uv += normalize(uv - mouse) * influence * 0.05;

    // 纹理采样
    vec3 color = texture2D(uTexture, uv).rgb;

    // 波浪影响颜色
    color += vec3(vWave * 2.0);

    // 鼠标光晕
    float glow = 0.02 / (dist + 0.02);
    color += vec3(0.2, 0.5, 1.0) * glow * 0.3;

    // 时间驱动的颜色变化
    color *= 0.8 + 0.2 * sin(uTime * 0.5);

    gl_FragColor = vec4(color, 1.0);
}
```

---

## 常见误区

1. **Uniform 忘记设置**：如果 Uniform 没有在 CPU 端设置，其值是未定义的（通常是 0）。不要依赖默认值。

2. **Varying 命名不一致**：顶点着色器和片元着色器中的 Varying 变量必须同名且同类型，否则链接失败。

3. **透视校正的误解**：Varying 的插值是透视校正的，不是屏幕空间线性的。这意味着在透视投影下，纹理映射是正确的，但如果你需要屏幕空间线性插值（如后处理），需要特殊处理。

4. **Uniform 精度问题**：在移动端，Uniform 的精度由声明决定。`uniform mediump float uValue;` 在所有着色器中必须使用相同精度。

---

## 工程建议

1. **统一 Uniform 命名规范**：采用 `u` 前缀 + 驼峰命名，如 `uModelMatrix`、`uLightDir`。这能一眼区分 Uniform 和 Attribute/Varying。

2. **预计算传递**：CPU 端能算的不要传到 GPU 端算。MVP 矩阵、法线矩阵等在 CPU 端预计算好，通过 Uniform 传入。

3. **使用 UBO 共享数据**：多个 Shader 共享的相机、光照数据应使用 UBO，避免重复设置。

4. **调试 Uniform**：在开发阶段，可以将 Uniform 值可视化为颜色输出，方便调试。例如 `gl_FragColor = vec4(vec3(uTime), 1.0);` 可以检查时间值是否正确。

---

## 小结

Uniform 和 Varying 是 CPU 与 GPU 之间数据传递的两大通道。Uniform 用于传递全局一致的数据（变换矩阵、时间、鼠标位置），Varying 用于在顶点着色器和片元着色器之间传递经过插值的数据（UV、法线、颜色）。理解 UBO 的内存布局、Varying 的透视校正插值、以及各种数据传递方式的适用场景，是编写高效 Shader 的基础。

## 练习

1. 实现一个交互式 Shader：鼠标移动时产生涟漪效果，点击时产生爆炸效果。使用 uMouse 和 uTime Uniform。

2. 使用 UBO 封装相机数据（viewMatrix、projectionMatrix、cameraPosition），在多个 Shader 之间共享。

3. 编写一个 Shader，将 Varying 插值可视化：在三角形的三个顶点分别设置红、绿、蓝颜色，观察插值结果。

4. 实现一个基于纹理的查找表（LUT）颜色校正系统：将颜色值作为 UV 坐标采样 LUT 纹理，实现色调映射。

---

## 参考答案

### 练习一

**思路**：交互式涟漪效果的核心是用 `uMouse` 记录鼠标位置，用 `uTime` 驱动波纹扩散。涟漪通过计算片元到鼠标位置的距离，用 `sin(dist - time * speed)` 产生扩散的环形波。爆炸效果则在点击时用 `uClickTime` 记录时间，驱动从点击位置向外扩散的冲击波。

**答案**：
```glsl
// 交互涟漪 - 片元着色器
precision mediump float;

uniform float uTime;
uniform vec2 uMouse;        // 鼠标当前位置（归一化坐标）
uniform vec2 uResolution;
uniform bool uClicked;      // 是否正在点击
uniform float uClickTime;   // 点击发生的时间

varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    vec2 mouse = uMouse;

    // 计算片元到鼠标位置的距离
    float dist = length(uv - mouse);

    // 1. 持续涟漪效果（鼠标移动时）
    float ripple = sin(dist * 40.0 - uTime * 5.0) * 0.5 + 0.5;
    ripple *= smoothstep(0.5, 0.0, dist);  // 只在鼠标附近显示
    ripple *= 0.15;  // 控制强度

    // 2. 爆炸冲击波（点击时）
    float shockwave = 0.0;
    if (uClicked) {
        float timeSinceClick = uTime - uClickTime;
        float waveRadius = timeSinceClick * 0.5;  // 冲击波半径随时间扩大
        float waveThickness = 0.02 + timeSinceClick * 0.01;  // 波逐渐变宽
        shockwave = smoothstep(waveRadius - waveThickness, waveRadius, dist)
                  * smoothstep(waveRadius + waveThickness, waveRadius, dist);
        shockwave *= max(0.0, 1.0 - timeSinceClick * 0.5);  // 逐渐衰减
    }

    // 3. UV 扰动
    vec2 distortedUv = uv + normalize(uv - mouse) * (ripple + shockwave) * 0.02;

    // 基础颜色（棋盘格用于观察扰动）
    float grid = mod(floor(distortedUv.x * 20.0) + floor(distortedUv.y * 20.0), 2.0);
    vec3 baseColor = mix(vec3(0.2, 0.4, 0.8), vec3(1.0), grid * 0.3);

    // 叠加涟漪颜色
    baseColor += vec3(0.3, 0.6, 1.0) * ripple;
    baseColor += vec3(1.0, 0.5, 0.2) * shockwave;

    gl_FragColor = vec4(baseColor, 1.0);
}
```

```typescript
// TypeScript 端设置 Uniform
const uniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uClicked: { value: false },
    uClickTime: { value: 0 },
};

window.addEventListener('mousemove', (e) => {
    uniforms.uMouse.value.set(e.clientX / window.innerWidth, 1.0 - e.clientY / window.innerHeight);
});

window.addEventListener('mousedown', (e) => {
    uniforms.uClicked.value = true;
    uniforms.uClickTime.value = performance.now() / 1000;
});
```

**要点**：
- `sin(dist * freq - time * speed)` 是经典扩散波公式，`freq` 控制波密度，`speed` 控制扩散速度
- `smoothstep` 同时用于限制涟漪范围和衰减波的边缘
- UV 扰动 `normalize(dir) * strength` 模拟折射，是水波纹效果的基础技术

---

### 练习二

**思路**：UBO 的核心思想是将共享数据（相机矩阵、位置等）打包到一个缓冲区，多个 Shader 通过绑定点引用同一个 UBO。这样当相机移动时，只需更新一次 UBO，所有使用它的 Shader 自动获取新数据。

**答案**：
```glsl
// 共享相机数据 UBO（在多个 Shader 中复用）
// 先在 Shader 中声明布局
layout(std140) uniform CameraData {
    mat4 uViewMatrix;
    mat4 uProjectionMatrix;
    vec3 uCameraPosition;
    float uNear;
    float uFar;
};
```

```typescript
// TypeScript 端实现 UBO
// 1. 创建 Uniform Buffer
const cameraUBO = gl.createBuffer();
const bufferSize = 16 * 4 * 2 + 4 * 4 + 4 * 2;  // 2 个 mat4 + vec3 + float + padding
gl.bindBuffer(gl.UNIFORM_BUFFER, cameraUBO);
gl.bufferData(gl.UNIFORM_BUFFER, bufferSize, gl.DYNAMIC_DRAW);

// 2. 获取绑定点并绑定
const blockIndex = gl.getUniformBlockIndex(program, 'CameraData');
gl.uniformBlockBinding(program, blockIndex, 0);  // 绑定点 0
gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, cameraUBO);

// 3. 更新数据
function updateCameraUBO(camera: THREE.Camera) {
    const data = new Float32Array(bufferSize / 4);

    // viewMatrix (16 floats, 列主序)
    data.set(camera.matrixWorldInverse.elements, 0);
    // projectionMatrix (16 floats)
    data.set(camera.projectionMatrix.elements, 16);
    // cameraPosition (3 floats) + padding (1 float)
    data[32] = camera.position.x;
    data[33] = camera.position.y;
    data[34] = camera.position.z;
    data[35] = 0.0;  // padding
    // near + far
    data[36] = (camera as THREE.PerspectiveCamera).near;
    data[37] = (camera as THREE.PerspectiveCamera).far;

    gl.bindBuffer(gl.UNIFORM_BUFFER, cameraUBO);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
}

// 多个 Shader 共享同一个绑定点 0，自动获取相同的相机数据
```

**要点**：
- `std140` 布局有严格的对齐规则：`vec3` 对齐到 16 字节，`mat4` 对齐到 16 字节
- UBO 大小必须是 16 字节的倍数（`std140` 要求）
- 绑定点（binding point）是 UBO 与 Shader 之间的桥梁，多个 Shader 可以绑定到同一个绑定点
- 更新一次 UBO，所有绑定它的 Shader 都会自动使用新数据，避免重复设置

---

### 练习三

**思路**：Varying 插值可视化的核心是在顶点着色器中为三角形的三个顶点分别设置不同的颜色值（红、绿、蓝），片元着色器直接输出插值后的颜色。通过观察渐变效果，可以直观理解光栅化阶段的线性插值和透视校正。

**答案**：
```glsl
// Varying 插值可视化 - 顶点着色器
uniform mat4 uMVP;

attribute vec3 aPosition;
attribute vec3 aColor;  // 每个顶点的颜色

varying vec3 vColor;
varying vec2 vPosition;  // 用于额外可视化

void main() {
    vColor = aColor;
    vPosition = aPosition.xy;
    gl_Position = uMVP * vec4(aPosition, 1.0);
}
```

```glsl
// Varying 插值可视化 - 片元着色器
precision mediump float;

varying vec3 vColor;
varying vec2 vPosition;

void main() {
    // 直接输出插值后的颜色
    gl_FragColor = vec4(vColor, 1.0);
}
```

```typescript
// TypeScript 端创建三角形
const geometry = new THREE.BufferGeometry();
const vertices = new Float32Array([
    -0.5, -0.5, 0.0,  // 顶点 0（左下）
     0.5, -0.5, 0.0,  // 顶点 1（右下）
     0.0,  0.5, 0.0,  // 顶点 2（顶部）
]);
const colors = new Float32Array([
    1.0, 0.0, 0.0,  // 红
    0.0, 1.0, 0.0,  // 绿
    0.0, 0.0, 1.0,  // 蓝
]);
geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.ShaderMaterial({
    vertexShader: vertexSource,
    fragmentShader: fragmentSource,
    vertexColors: true,
});
```

**要点**：
- Varying 插值是逐片元进行的，光栅化阶段在三角形内部对顶点属性做线性插值
- 透视投影下插值是透视校正的（非线性），近处插值更密、远处更稀疏
- 观察三角形中心的颜色应为 `(~0.33, ~0.33, ~0.33)` 的灰白色，说明三色均匀混合

---

### 练习四

**思路**：LUT 颜色校正的核心思想是：将原始颜色的 RGB 分量作为 UV 坐标，去采样一张预先计算好的 3D 查找表纹理（通常展开为 2D 纹理）。LUT 纹理中的颜色就是校正后的结果。关键是将 3D 坐标正确映射到 2D 纹理的 UV。

**答案**：
```glsl
// LUT 颜色校正 - 片元着色器
precision mediump float;

uniform sampler2D uSceneTexture;  // 场景渲染结果
uniform sampler2D uLUT;           // LUT 纹理（16x16x16 展开为 256x16）
uniform float uLUTSize;           // LUT 每个维度的大小（如 16.0）

varying vec2 vUv;

vec3 sampleLUT(vec3 color) {
    // 将颜色 [0,1] 映射到 LUT 索引空间
    float size = uLUTSize;
    vec3 scaledColor = color * (size - 1.0);

    // 计算在 2D LUT 纹理中的位置
    // LUT 布局：每行 size 个 slice，每列 1 个 slice
    float blueIndex = floor(scaledColor.b);
    float blueFrac = fract(scaledColor.b);

    // 当前 slice 的 UV
    vec2 uv0 = vec2(
        (scaledColor.r + blueIndex * size) / (size * size),
        scaledColor.g / size
    );

    // 下一个 slice 的 UV（用于蓝色通道的插值）
    vec2 uv1 = vec2(
        (scaledColor.r + (blueIndex + 1.0) * size) / (size * size),
        scaledColor.g / size
    );

    // 采样两个 slice 并线性插值
    vec3 color0 = texture2D(uLUT, uv0).rgb;
    vec3 color1 = texture2D(uLUT, uv1).rgb;

    return mix(color0, color1, blueFrac);
}

void main() {
    vec4 sceneColor = texture2D(uSceneTexture, vUv);
    vec3 correctedColor = sampleLUT(sceneColor.rgb);
    gl_FragColor = vec4(correctedColor, sceneColor.a);
}
```

**要点**：
- 3D LUT 展开为 2D 纹理时，通常按蓝色通道分 slice 排列
- 双线性插值在两个 slice 之间进行，确保颜色过渡平滑
- LUT 纹理通常使用线性滤波（`THREE.LinearFilter`），避免色带
- LUT 可以通过 Photoshop 等工具生成，用于实现电影级色调映射
