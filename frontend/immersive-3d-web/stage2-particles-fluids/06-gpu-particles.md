# GPU 粒子系统——Transform Feedback、100 万粒子实时渲染

## CPU 粒子的天花板

用 JavaScript 在 `requestAnimationFrame` 里逐个更新粒子位置，到 1 万个粒子就开始卡了。每帧做 10 万次位置更新 + 10 万次 draw call，CPU 直接投降。

真正的粒子系统把计算搬到 GPU 上：用 Vertex Shader 更新粒子位置，用 Transform Feedback 把结果写回 GPU 缓冲区，下一帧再读入。CPU 完全不参与逐粒子计算。

## 核心机制：Transform Feedback

Transform Feedback 是 WebGL2 / WebGPU 的能力，允许 Vertex Shader 的输出写入 GPU Buffer Object，而不是只输出给光栅化管线。

流程：

```
帧 N: 读 Buffer A → Vertex Shader 计算 → 写 Buffer B
帧 N+1: 读 Buffer B → Vertex Shader 计算 → 写 Buffer A
帧 N+2: 读 Buffer A → ...
```

两块缓冲区交替读写（ping-pong），每帧都在 GPU 上完成，CPU 只负责告诉 GPU "开始"。

## 数据结构

每个粒子需要：位置 (vec3)、速度 (vec3)、生命 (float)、大小 (float)。

```ts
const PARTICLE_COUNT = 500_000
const FLOATS_PER_PARTICLE = 8 // pos.xyz + vel.xyz + life + size

const dataA = new Float32Array(PARTICLE_COUNT * FLOATS_PER_PARTICLE)
const dataB = new Float32Array(PARTICLE_COUNT * FLOATS_PER_PARTICLE)

// 初始化
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const offset = i * FLOATS_PER_PARTICLE
  dataA[offset + 0] = (Math.random() - 0.5) * 2  // x
  dataA[offset + 1] = Math.random() * 5            // y
  dataA[offset + 2] = (Math.random() - 0.5) * 2  // z
  dataA[offset + 3] = (Math.random() - 0.5) * 0.1 // vx
  dataA[offset + 4] = Math.random() * 0.5 + 0.5   // vy
  dataA[offset + 5] = (Math.random() - 0.5) * 0.1 // vz
  dataA[offset + 6] = Math.random()                 // life
  dataA[offset + 7] = Math.random() * 3 + 1        // size
}
```

## Three.js 中的实现

Three.js 用 `BufferGeometry` + `TransformFeedback` 封装了原生 WebGL2 调用：

```ts
import {
  BufferGeometry, Float32BufferAttribute,
  ShaderMaterial, Points
} from "three"

// 创建两个 geometry（ping-pong）
const geoA = new BufferGeometry()
const geoB = new BufferGeometry()

geoA.setAttribute("position", new Float32BufferAttribute(dataA.slice(0, PARTICLE_COUNT * 3), 3))
geoA.setAttribute("velocity", new Float32BufferAttribute(dataA.slice(PARTICLE_COUNT * 3, PARTICLE_COUNT * 6), 3))
geoA.setAttribute("life", new Float32BufferAttribute(dataA.slice(PARTICLE_COUNT * 6, PARTICLE_COUNT * 7), 1))
geoA.setAttribute("size", new Float32BufferAttribute(dataA.slice(PARTICLE_COUNT * 7, PARTICLE_COUNT * 8), 1))

// geoB 结构相同，数据是 dataB
```

## 计算 Shader

Transform Feedback 用的 Vertex Shader 做物理更新：

```glsl
// simulation.vert
precision highp float;

in vec3 position;
in vec3 velocity;
in float life;
in float size;

uniform float uTime;
uniform float uDeltaTime;

out vec3 vPosition;
out vec3 vVelocity;
out float vLife;
out float vSize;

void main() {
  vLife = life - uDeltaTime * 0.2;
  
  if (vLife <= 0.0) {
    // 重置粒子
    vPosition = vec3(
      sin(uTime + float(gl_VertexID)) * 2.0,
      5.0,
      cos(uTime + float(gl_VertexID)) * 2.0
    );
    vVelocity = vec3(0.0, -1.0 + random(), 0.0);
    vLife = 1.0;
    vSize = size;
  } else {
    vec3 gravity = vec3(0.0, -0.5, 0.0);
    vec3 wind = vec3(sin(uTime) * 0.3, 0.0, cos(uTime * 0.7) * 0.2);
    vVelocity = velocity + (gravity + wind) * uDeltaTime;
    vPosition = position + vVelocity * uDeltaTime;
    vSize = size * vLife;
  }
}
```

## 渲染 Shader

用另一个 Shader 把粒子画成点：

```glsl
// render.vert
precision highp float;

in vec3 position;
in float life;
in float size;

uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;

out float vLife;

void main() {
  vLife = life;
  vec4 mvPos = viewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = size * (100.0 / -mvPos.z);
}

// render.frag
precision highp float;
in float vLife;
out vec4 fragColor;

void main() {
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) discard;
  float alpha = smoothstep(0.5, 0.0, dist) * vLife;
  vec3 color = mix(vec3(0.2, 0.5, 1.0), vec3(1.0, 0.3, 0.8), vLife);
  fragColor = vec4(color, alpha);
}
```

## Ping-Pong 循环

在渲染循环中交替使用两个 geometry：

```ts
let readGeo = geoA
let writeGeo = geoB

function animate() {
  requestAnimationFrame(animate)

  // 1. 计算阶段：用 Transform Feedback 更新粒子
  const simMaterial = new ShaderMaterial({
    vertexShader: simulationVert,
    varyings: ["vPosition", "vVelocity", "vLife", "vSize"],
    transformFeedback: {
      bufferGeometry: writeGeo,
    }
  })

  // 2. 渲染阶段：用更新后的数据画粒子
  renderMaterial.uniforms.uTime.value = clock.getElapsedTime()
  const particles = new Points(writeGeo, renderMaterial)
  renderer.render(scene, camera)

  // 3. 交换
  ;[readGeo, writeGeo] = [writeGeo, readGeo]
}
```

## 视觉效果描述

50 万个粒子从高处飘落，像发光的雪花。风从侧面吹来，粒子流随风弯曲。每个粒子有微弱的拖尾，整体形成一条流动的光带。鼠标移动时，附近的粒子被推开，留下短暂的空隙。

## 练习

### 练习一：粒子喷泉

改造粒子系统，让粒子从中心点向上喷射，然后受重力下落。喷射方向可以缓慢旋转，形成螺旋喷泉效果。生命值用完的粒子回到起点重生。

### 练习二：粒子数量对比

创建一个开关：按 1 键用 CPU 逐粒子更新（requestAnimationFrame + 循环），按 2 键用 GPU Transform Feedback。分别测试 1 万、10 万、100 万粒子的帧率，在页面上显示 FPS 和粒子数量。

---

## 参考答案

### 练习一

**思路**：在 simulation shader 里改变初始速度方向和重力。

```glsl
// 在重置粒子时
vPosition = vec3(0.0, 0.0, 0.0);
float angle = uTime * 0.5 + float(gl_VertexID) * 0.1;
float speed = 3.0 + random() * 2.0;
vVelocity = vec3(cos(angle) * speed, 5.0 + random() * 2.0, sin(angle) * speed);

// 每帧
vec3 gravity = vec3(0.0, -9.8, 0.0);
vVelocity += gravity * uDeltaTime;
vPosition += vVelocity * uDeltaTime;

// 碰到地面反弹
if (vPosition.y < 0.0) {
  vPosition.y = 0.0;
  vVelocity.y *= -0.6; // 能量损失
}
```

### 练习二

**思路**：CPU 版用数组循环 + `geometry.attributes.position.needsUpdate = true`。

```ts
// CPU 版本
const cpuPositions = new Float32Array(PARTICLE_COUNT * 3)
const cpuVelocities = new Float32Array(PARTICLE_COUNT * 3)

function updateCPU(dt: number) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3
    cpuVelocities[i3 + 1] -= 0.5 * dt
    cpuPositions[i3] += cpuVelocities[i3] * dt
    cpuPositions[i3 + 1] += cpuVelocities[i3 + 1] * dt
    cpuPositions[i3 + 2] += cpuVelocities[i3 + 2] * dt
  }
  cpuGeometry.attributes.position.needsUpdate = true
}
```

**常见错误**：CPU 版在 10 万粒子以上会明显卡顿，但不会崩溃——瓶颈在 JavaScript 的循环和 attribute upload，不在 draw call。GPU 版的瓶颈在显存和带宽，200 万以上才可能碰到。
