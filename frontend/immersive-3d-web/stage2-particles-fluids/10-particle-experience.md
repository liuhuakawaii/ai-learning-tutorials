# 阶段实战：构建全屏粒子交互体验

## 目标

把前四课的粒子技术组合成一个完整的交互体验页面：

1. **开场**：100 万粒子自由流动（Curl Noise 力场）
2. **交互**：鼠标移动产生吸引力，留下拖尾
3. **聚合**：滚动触发粒子聚合为 3D 模型
4. **散开**：继续滚动模型碎裂，粒子重新流动
5. **流体**：鼠标快速移动时注入流体模拟，粒子跟随流场

整页没有 HTML 文字，纯粒子 + 背景色，用视觉讲述品牌感。

## 技术架构

```
┌─────────────────────────────────┐
│          WebGPU Context          │
├──────────┬──────────┬───────────┤
│ Compute  │ Compute  │  Render   │
│ Pass 1:  │ Pass 2:  │  Pass:    │
│ Simulate │ Simulate │  Draw     │
│ (physics)│ (fluid)  │  Points   │
└──────────┴──────────┴───────────┘
```

两个 Compute Pass 共同更新粒子：第一个处理力场和物理，第二个处理流体耦合。

## 粒子初始化

```ts
const PARTICLE_COUNT = 1_000_000
const STRIDE = 12 // pos.xyz + vel.xyz + color.rgb + life + size + padding

function initParticles(): Float32Array {
  const data = new Float32Array(PARTICLE_COUNT * STRIDE)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const off = i * STRIDE
    data[off + 0] = (Math.random() - 0.5) * 20
    data[off + 1] = (Math.random() - 0.5) * 20
    data[off + 2] = (Math.random() - 0.5) * 20
    data[off + 3] = 0 // vx
    data[off + 4] = 0 // vy
    data[off + 5] = 0 // vz
    data[off + 6] = 0.2 // r
    data[off + 7] = 0.5 // g
    data[off + 8] = 1.0 // b
    data[off + 9] = Math.random() // life
    data[off + 10] = Math.random() * 2 + 1 // size
  }
  return data
}
```

## Compute Shader 核心逻辑

```wgsl
@compute @workgroup_size(256)
fn simulate(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= PARTICLE_COUNT) { return; }
  
  var pos = particles[i].position;
  var vel = particles[i].velocity;
  
  // 1. Curl Noise 基础流动
  let noiseForce = curlNoise(pos * 0.2 + uTime * 0.05) * 0.8;
  vel += noiseForce * dt;
  
  // 2. 鼠标吸引力
  let toMouse = uMousePos - pos;
  let mouseDist = length(toMouse);
  if (mouseDist < 5.0 && uMouseDown > 0.5) {
    vel += normalize(toMouse) * 10.0 / max(mouseDist, 0.5) * dt;
  }
  
  // 3. 流体耦合
  let fluidVel = textureSample(fluidVelocity, sampler, pos.xz * 0.1 + 0.5).xy;
  vel += vec3<f32>(fluidVel.x, 0.0, fluidVel.y) * 0.5 * dt;
  
  // 4. 聚合力
  if (uBlendFactor > 0.0) {
    let target = targetPositions[i % TARGET_COUNT];
    let spring = (target - pos) * 6.0;
    let damp = vel * -3.0;
    vel += (spring + damp) * uBlendFactor * dt;
  }
  
  // 5. 边界反弹
  if (abs(pos.x) > 15.0) { vel.x *= -0.8; pos.x = clamp(pos.x, -15.0, 15.0); }
  if (abs(pos.y) > 15.0) { vel.y *= -0.8; pos.y = clamp(pos.y, -15.0, 15.0); }
  if (abs(pos.z) > 15.0) { vel.z *= -0.8; pos.z = clamp(pos.z, -15.0, 15.0); }
  
  // 阻尼
  vel *= 0.98;
  
  pos += vel * dt;
  
  particles[i].position = pos;
  particles[i].velocity = vel;
}
```

## 渲染 Shader

```wgsl
@vertex
fn vert(@location(0) pos: vec3<f32>, @location(1) color: vec3<f32>,
        @location(2) life: f32, @location(3) size: f32)
  -> VertexOutput {
  var out: VertexOutput;
  let mvPos = uViewMatrix * vec4<f32>(pos, 1.0);
  out.position = uProjectionMatrix * mvPos;
  out.color = color;
  out.life = life;
  // 远小近大
  out.pointSize = size * (200.0 / -mvPos.z);
  return out;
}

@fragment
fn frag(in: VertexOutput) -> @location(0) vec4<f32> {
  // 圆形点
  let dist = length(in.pointCoord - vec2<f32>(0.5));
  if (dist > 0.5) { discard; }
  
  let softEdge = smoothstep(0.5, 0.1, dist);
  let alpha = softEdge * in.life * 0.8;
  
  return vec4<f32>(in.color, alpha);
}
```

## 滚动分段

```ts
const sections = [
  { range: [0, 0.2],    action: "freeFlow" },
  { range: [0.2, 0.4],  action: "mouseInteract" },
  { range: [0.4, 0.7],  action: "assemble" },
  { range: [0.7, 0.85], action: "explode" },
  { range: [0.85, 1.0], action: "fluidFlow" },
]

function updateUniforms(progress: number) {
  if (progress < 0.4) {
    uniforms.uBlendFactor = 0
  } else if (progress < 0.7) {
    uniforms.uBlendFactor = (progress - 0.4) / 0.3
  } else if (progress < 0.85) {
    uniforms.uBlendFactor = 1 - (progress - 0.7) / 0.15
  } else {
    uniforms.uBlendFactor = 0
  }
}
```

## 背景色配合

```ts
const bgColors = [
  new Color(0x050510), // 深蓝黑（自由流动）
  new Color(0x0a0a20), // 稍亮（交互）
  new Color(0x151530), // 聚合时
  new Color(0x0a0a20), // 散开
  new Color(0x050510), // 流体
]

function updateBackground(progress: number) {
  const idx = Math.floor(progress * 5)
  const localP = (progress * 5) % 1
  const c = new Color().lerpColors(
    bgColors[Math.min(idx, 4)],
    bgColors[Math.min(idx + 1, 4)],
    localP
  )
  scene.background = c
}
```

## 最终效果描述

页面打开，深蓝黑色的背景中，100 万个微光粒子在空间中流动，像深海中的浮游生物。整个运动是无序但流畅的——Curl Noise 让它们永远在动，但不会堆积或消散。

鼠标移动时，附近的粒子被轻微吸引，形成一个跟随鼠标的光团。

向下滚动，粒子开始聚拢。先是中心的粒子被拉向一个点，然后向外扩展——它们在组装一个产品模型。蓝色的光芒在聚合过程中逐渐消退，最终变成一个实体的产品。

继续滚动，产品碎裂，粒子向四面八方散开。最后，快速移动鼠标时，粒子被注入的流体带动，形成可见的彩色流体尾迹。

## 练习

### 练习一：加入音频节奏

用 Web Audio API 的 AnalyserNode 获取音频的低频能量，把它映射到粒子的速度阻尼和力场强度。音乐节奏强时粒子运动更剧烈，安静时粒子趋于平稳。

### 练习二：交互式涂鸦

鼠标按下并移动时，在鼠标轨迹上"画"出一条粒子带。这些粒子从轨迹上获得初始速度，然后被力场捕获。长时间的涂鸦会让场景中的粒子分布产生记忆——之前鼠标走过的地方粒子密度更高。

---

## 参考答案

### 练习一

**思路**：Web Audio AnalyserNode 获取频率数据，取低频均值传入 GPU uniform。

```ts
const audioCtx = new AudioContext()
const analyser = audioCtx.createAnalyser()
analyser.fftSize = 256

const source = audioCtx.createMediaElementSource(audioElement)
source.connect(analyser)
analyser.connect(audioCtx.destination)

const freqData = new Uint8Array(analyser.frequencyBinCount)

function getAudioEnergy(): number {
  analyser.getByteFrequencyData(freqData)
  let sum = 0
  for (let i = 0; i < 16; i++) sum += freqData[i] // 低频 16 个 bin
  return sum / (16 * 255) // 归一化到 0-1
}

// 在渲染循环中
uniforms.uAudioEnergy = getAudioEnergy()
```

```wgsl
// Compute shader 中
let energy = uAudioEnergy;
let noiseStrength = 0.5 + energy * 2.0; // 能量高时噪声更强
let damping = 0.98 - energy * 0.05;     // 能量高时阻尼更低（粒子动得更久）
vel *= damping;
```

### 练习二

**思路**：记录鼠标轨迹点数组，每帧在轨迹上发射新粒子并施加沿切线方向的初速度。

```ts
const trail: Vector3[] = []
const MAX_TRAIL = 200

function onMouseMove(e: MouseEvent) {
  if (!mouseDown) return
  const pos = getMouseWorldPos()
  trail.push(pos)
  if (trail.length > MAX_TRAIL) trail.shift()
}

// 在 simulation uniform 中传入轨迹数据
// GPU 端：粒子靠近轨迹时被赋予沿切线的速度
```

```wgsl
// 在 compute shader 中检查轨迹
for (var t = 0u; t < arrayLength(&trailPoints); t++) {
  let trailPos = trailPoints[t];
  let dist = length(pos - trailPos);
  if (dist < 1.0) {
    let tangent = normalize(trailPoints[min(t + 1u, arrayLength(&trailPoints) - 1u)] - trailPos);
    vel += tangent * 3.0 * (1.0 - dist) * dt;
  }
}
```

**常见错误**：轨迹数据量大时不要每个粒子都遍历完整轨迹。可以先按空间分桶，只检查附近的轨迹段。
