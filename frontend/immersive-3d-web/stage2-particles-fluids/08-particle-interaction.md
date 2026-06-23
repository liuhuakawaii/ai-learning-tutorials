# 粒子交互——鼠标跟随、力场、粒子流

## 粒子不该只往下掉

上两课的粒子系统有了 GPU 计算能力，但行为还是"重力 + 风"这种简单物理。真实的沉浸式体验里，粒子会**响应鼠标**、被**力场吸引**、形成**有序的流动**。

这节课的核心是：给粒子系统加"意图"。

## 鼠标位置的 3D 映射

屏幕上的鼠标坐标是 2D，需要映射到 3D 场景里。最常用的方法是 Raycasting：

```ts
import { Raycaster, Vector2 } from "three"

const raycaster = new Raycaster()
const mouse = new Vector2()

window.addEventListener("mousemove", (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1
  mouse.y = -(e.clientY / innerHeight) * 2 + 1
})

function getMouseWorldPos(): Vector3 {
  raycaster.setFromCamera(mouse, camera)
  const plane = new Plane(new Vector3(0, 0, 1), 0)
  const target = new Vector3()
  raycaster.ray.intersectPlane(plane, target)
  return target
}
```

把这个位置传入 Compute Shader 的 uniform：

```wgsl
@group(0) @binding(0) var<uniform> uMousePos: vec3<f32>;
```

## 吸引力场

粒子被鼠标吸引，距离越近力越大：

```wgsl
fn attractForce(particlePos: vec3<f32>, attractPos: vec3<f32>, strength: f32) -> vec3<f32> {
  let dir = attractPos - particlePos;
  let dist = length(dir);
  if (dist < 0.01) { return vec3<f32>(0.0); }
  let force = strength / (dist * dist);
  return normalize(dir) * force;
}
```

在 simulation shader 里每帧累加：

```wgsl
let attract = attractForce(pos, uMousePos, 5.0);
vel += attract * uDeltaTime;
```

效果：鼠标附近的粒子被吸过来，形成一个旋涡状的聚集。

## 排斥力场

鼠标推开粒子，留下空洞：

```wgsl
fn repelForce(particlePos: vec3<f32>, repelPos: vec3<f32>, radius: f32, strength: f32) -> vec3<f32> {
  let dir = particlePos - repelPos;
  let dist = length(dir);
  if (dist > radius || dist < 0.01) { return vec3<f32>(0.0); }
  let falloff = 1.0 - dist / radius;
  return normalize(dir) * strength * falloff;
}
```

## 涡旋力场

不是所有力都指向一个点。涡旋力让粒子**绕着一个轴旋转**：

```wgsl
fn vortexForce(
  particlePos: vec3<f32>,
  center: vec3<f32>,
  axis: vec3<f32>,
  strength: f32
) -> vec3<f32> {
  let dir = particlePos - center;
  let radial = dot(dir, axis) * axis;
  let tangent = cross(normalize(dir - radial), axis);
  return tangent * strength;
}
```

粒子绕 Z 轴旋转的涡旋：

```wgsl
let vortex = vortexForce(pos, vec3<f32>(0.0), vec3<f32>(0.0, 0.0, 1.0), 3.0);
vel += vortex * uDeltaTime;
```

## 多力场叠加

真实场景中力场不会只有一个。叠加的方式是直接相加：

```wgsl
let totalForce = vec3<f32>(0.0);
totalForce += gravity;
totalForce += attractForce(pos, uMousePos, uAttractStrength);
totalForce += repelForce(pos, uObstaclePos, uObstacleRadius, uRepelStrength);
totalForce += vortexForce(pos, uVortexCenter, uVortexAxis, uVortexStrength);
totalForce += curlNoise(pos * 0.5) * uNoiseStrength;

vel += totalForce * uDeltaTime;
```

## Curl Noise——无散度噪声

普通 Perlin 噪声做出来的力场会有"源"和"汇"（粒子堆积或发散）。Curl Noise 是从噪声场的旋度（curl）生成速度场，天然无散度——粒子只旋转不聚集不发散。

```wgsl
fn curlNoise(p: vec3<f32>) -> vec3<f32> {
  let e = 0.01;
  let dx = noise(p + vec3<f32>(e, 0.0, 0.0)) - noise(p - vec3<f32>(e, 0.0, 0.0));
  let dy = noise(p + vec3<f32>(0.0, e, 0.0)) - noise(p - vec3<f32>(0.0, e, 0.0));
  let dz = noise(p + vec3<f32>(0.0, 0.0, e)) - noise(p - vec3<f32>(0.0, 0.0, e));
  // curl = ∇ × f
  return vec3<f32>(dz - dy, dx - dz, dy - dx) / (2.0 * e);
}
```

效果：粒子在空间中形成流动的曲线，像烟雾、像水流、像风的可视化。

## 视觉效果描述

50 万个粒子在空间中形成缓慢流动的云团。鼠标移动时，附近的粒子被吸引过来，形成一个光球跟随鼠标。快速挥动鼠标，粒子被甩开，在身后留下弧形的轨迹。松开鼠标，粒子重新被 Curl Noise 的力场捕获，回归流动状态。

## 练习

### 练习一：引力拖尾

鼠标按下时，粒子被吸引到鼠标位置形成一个球。鼠标移动时，球拖着一条粒子尾巴。松开鼠标后，粒子慢慢散开回到噪声场。用颜色区分"被捕获"和"自由流动"的粒子。

### 练习二：力场可视化

在场景中放置 3 个力场源（吸引、排斥、涡旋），用半透明的 wireframe 球体标记它们的位置。实时画出从每个力场源发出的力线（用 LineSegments），让力场的形状可视化。粒子同时受到三个力场的影响。

---

## 参考答案

### 练习一

**思路**：用一个 uniform 记录鼠标按下状态，按下时叠加吸引力，粒子颜色根据到鼠标的距离变化。

```wgsl
@group(0) @binding(0) var<uniform> uMousePos: vec3<f32>;
@group(0) @binding(1) var<uniform> uMouseDown: f32;

@compute @workgroup_size(256)
fn simulate(@builtin(global_invocation_id) id: vec3<u32>) {
  // ... 读取 pos, vel
  
  if (uMouseDown > 0.5) {
    let dir = uMousePos - pos;
    let dist = length(dir);
    let attract = normalize(dir) * 10.0 / max(dist, 0.5);
    vel += attract * dt;
  }
  
  // Curl noise 回归力
  vel += curlNoise(pos * 0.3 + uTime * 0.1) * 0.5 * (1.0 - uMouseDown);
  
  // 颜色：被捕获的粒子偏白，自由的偏蓝
  let distToMouse = length(pos - uMousePos);
  let captured = smoothstep(3.0, 0.5, distToMouse) * uMouseDown;
  vColor = mix(vec3<f32>(0.2, 0.5, 1.0), vec3<f32>(1.0, 1.0, 1.0), captured);
}
```

### 练习二

**思路**：CPU 端在每帧计算力线采样点，上传到 LineSegments geometry。

```ts
const lineCount = 100
const linePositions = new Float32Array(lineCount * 3 * 20) // 每条线 20 个点

function updateForceLines() {
  for (let i = 0; i < lineCount; i++) {
    const start = new Vector3(
      Math.random() * 4 - 2,
      Math.random() * 4 - 2,
      Math.random() * 4 - 2
    )
    let pos = start.clone()
    for (let j = 0; j < 20; j++) {
      const idx = (i * 20 + j) * 3
      linePositions[idx] = pos.x
      linePositions[idx + 1] = pos.y
      linePositions[idx + 2] = pos.z
      const force = computeTotalForce(pos) // CPU 端计算力场
      pos.add(force.normalize().multiplyScalar(0.3))
    }
  }
  lineGeo.attributes.position.needsUpdate = true
}
```

**常见错误**：力线步长太大导致线穿过力场源。用固定的小步长或自适应步长（力越大步长越小）。
