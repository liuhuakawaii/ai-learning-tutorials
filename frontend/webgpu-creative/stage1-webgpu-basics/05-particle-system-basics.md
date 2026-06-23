# 阶段实战：用 WebGPU 渲染一个粒子系统

## 把前面学到的东西串起来

这一课综合前 4 课的内容：用 compute shader 更新粒子物理，用渲染管线绘制粒子。这是 WebGPU 创意编程的"Hello World"——后面所有的项目都建立在这个模式之上。

核心架构：

```
每帧循环：
  1. Compute Shader 读取粒子位置/速度，计算物理，写入新位置/速度
  2. 渲染管线读取更新后的位置，绘制粒子
```

Compute 和渲染共用同一个 storage buffer。不需要 CPU 参与物理计算，也不需要在 GPU 和 CPU 之间来回拷贝数据。

## 完整实现

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="canvas" width="800" height="600"></canvas>
<script type="module">
const canvas = document.getElementById('canvas');
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: 'opaque' });

const PARTICLE_COUNT = 100000;

// ──── Compute Shader：物理更新 ────
const computeCode = /* wgsl */`
  struct Particle {
    pos: vec2f,
    vel: vec2f,
    life: f32,
    _pad: vec3f,
  };
  struct Particles {
    data: array<Particle>,
  };

  @group(0) @binding(0) var<storage, read_write> particles: Particles;
  @group(0) @binding(1) var<uniform> params: vec4f; // dt, gravity, time, _pad

  @compute @workgroup_size(256)
  fn compute_main(@builtin(global_invocation_id) id: vec3u) {
    let i = id.x;
    if (i >= arrayLength(&particles.data)) { return; }

    var p = particles.data[i];
    let dt = params.x;
    let gravity = params.y;
    let time = params.z;

    // 重力
    p.vel.y -= gravity * dt;

    // 小幅随机扰动（用简单的伪随机）
    let noise = fract(sin(dot(p.pos, vec2f(12.9898, 78.233)) + time) * 43758.5453);
    p.vel.x += (noise - 0.5) * 0.001;

    // 更新位置
    p.pos += p.vel * dt;

    // 生命周期衰减
    p.life -= dt * 0.3;

    // 边界反弹
    if (p.pos.y < -1.0) {
      p.pos.y = -1.0;
      p.vel.y *= -0.6;
      p.vel.x *= 0.95;
    }
    if (p.pos.x < -1.5) { p.pos.x = 1.5; }
    if (p.pos.x > 1.5) { p.pos.x = -1.5; }

    // 重生
    if (p.life <= 0.0) {
      let seed = fract(sin(f32(i) * 1234.5678 + time) * 4567.8901);
      p.pos = vec2f((seed - 0.5) * 0.4, 0.8 + (seed - 0.5) * 0.2);
      p.vel = vec2f((seed - 0.5) * 0.3, seed * 0.5 + 0.2);
      p.life = 0.8 + seed * 0.4;
    }

    particles.data[i] = p;
  }
`;

// ──── Render Shader：绘制粒子 ────
const renderCode = /* wgsl */`
  struct Particle {
    pos: vec2f,
    vel: vec2f,
    life: f32,
    _pad: vec3f,
  };
  struct Particles {
    data: array<Particle>,
  };
  @group(0) @binding(0) var<storage, read> particles: Particles;

  struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) life: f32,
  };

  @vertex
  fn vs_main(@builtin(vertex_index) vid: u32) -> VertexOutput {
    let quad = array<vec2f, 6>(
      vec2f(-1, -1), vec2f(1, -1), vec2f(1, 1),
      vec2f(-1, -1), vec2f(1, 1), vec2f(-1, 1),
    );

    let particleIdx = vid / 6;
    let quadIdx = vid % 6;
    let p = particles.data[particleIdx];
    let q = quad[quadIdx];

    var out: VertexOutput;
    let size = 0.005;
    out.position = vec4f(
      p.pos.x + q.x * size,
      p.pos.y + q.y * size,
      0.0, 1.0
    );
    out.uv = q * 0.5 + 0.5;
    out.life = p.life;
    return out;
  }

  @fragment
  fn fs_main(@location(0) uv: vec2f, @location(1) life: f32) -> @location(0) vec4f {
    let dist = length(uv - vec2f(0.5));
    if (dist > 0.5) { discard; }

    let glow = smoothstep(0.5, 0.0, dist);
    let alpha = glow * clamp(life, 0.0, 1.0);

    // 颜色随生命变化：活着时蓝白，快死时橙红
    let alive_color = vec3f(0.4, 0.7, 1.0);
    let dead_color = vec3f(1.0, 0.3, 0.1);
    let color = mix(dead_color, alive_color, clamp(life, 0.0, 1.0));

    return vec4f(color * glow, alpha);
  }
`;

const computeModule = device.createShaderModule({ code: computeCode });
const renderModule = device.createShaderModule({ code: renderCode });

const computePipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: computeModule, entryPoint: 'compute_main' },
});

const renderPipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module: renderModule, entryPoint: 'vs_main' },
  fragment: {
    module: renderModule,
    entryPoint: 'fs_main',
    targets: [{
      format,
      blend: {
        color: { srcFactor: 'src-alpha', dstFactor: 'one' },
        alpha: { srcFactor: 'one', dstFactor: 'one' },
      },
    }],
  },
});

// ──── 初始粒子数据 ────
// 每个粒子：pos.xy(8) + vel.xy(8) + life(4) + pad(12) = 32 bytes
const stride = 8; // 8 个 f32
const particleData = new Float32Array(PARTICLE_COUNT * stride);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const base = i * stride;
  particleData[base + 0] = (Math.random() - 0.5) * 0.4;  // pos.x
  particleData[base + 1] = 0.8 + Math.random() * 0.2;     // pos.y
  particleData[base + 2] = (Math.random() - 0.5) * 0.3;   // vel.x
  particleData[base + 3] = Math.random() * 0.5 + 0.2;     // vel.y
  particleData[base + 4] = Math.random();                   // life
}

const particleBuffer = device.createBuffer({
  size: particleData.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(particleBuffer, 0, particleData);

const paramsBuffer = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

// Compute 和 Render 共享同一个 particleBuffer
const computeBindGroup = device.createBindGroup({
  layout: computePipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: particleBuffer } },
    { binding: 1, resource: { buffer: paramsBuffer } },
  ],
});

const renderBindGroup = device.createBindGroup({
  layout: renderPipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: particleBuffer } },
  ],
});

// ──── 渲染循环 ────
let startTime = performance.now();

function frame() {
  const now = performance.now();
  const dt = 1 / 60;
  const time = (now - startTime) / 1000;

  device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([dt, 0.5, time, 0]));

  const commandEncoder = device.createCommandEncoder();

  // Pass 1: Compute — 更新粒子
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, computeBindGroup);
  computePass.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / 256));
  computePass.end();

  // Pass 2: Render — 绘制粒子
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0.01, g: 0.01, b: 0.03, a: 1 },
    }],
  });
  renderPass.setPipeline(renderPipeline);
  renderPass.setBindGroup(0, renderBindGroup);
  renderPass.draw(PARTICLE_COUNT * 6);
  renderPass.end();

  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## 代码架构解析

### Ping-Pong 的简化版

这里只有一个 storage buffer，compute shader 同时读写它（`read_write`）。这在物理更新场景里是安全的——每个调用只修改自己的粒子，不会影响其他粒子。

如果粒子之间有交互（比如碰撞检测），就需要真正的双缓冲：读 A 写 B，下一帧读 B 写 A。

### 加法混合

渲染管线的混合模式：

```ts
blend: {
  color: { srcFactor: 'src-alpha', dstFactor: 'one' },
  alpha: { srcFactor: 'one', dstFactor: 'one' },
}
```

`dstFactor: 'one'` 意味着新像素颜色直接加到已有颜色上（additive blending）。这让重叠的粒子产生发光效果——粒子越多，越亮。

### 伪随机

GPU 上没有 `Math.random()`。着色器里的随机用数学公式生成：

```wgsl
let noise = fract(sin(dot(p.pos, vec2f(12.9898, 78.233)) + time) * 43758.5453);
```

这是个经典的伪随机函数，视觉上足够随机，但不适合密码学用途。

## 你已经掌握了 WebGPU 创意编程的基础模式

所有后续课程都是这个模式的变体：

1. 用 storage buffer 存数据
2. 用 compute shader 做计算
3. 用渲染管线做可视化
4. 有时加后处理 pass

区别只在于计算逻辑的复杂度和渲染效果的精细度。

## 练习

1. 加入鼠标交互：点击时在鼠标位置生成大量粒子（提示：用 uniform 传入鼠标坐标，compute shader 里判断如果粒子生命值为 0 就在鼠标位置重生）。
2. 改变粒子的发射形状——从点发射改成圆环发射或扇形发射。
3. 加入颜色渐变：根据粒子速度动态计算颜色，速度越快越亮。
