# 粒子模拟：Compute Shader 实现 100 万粒子物理

## 从万级到百万级

Stage 1 的粒子系统有 10 万个粒子。现在把它推到 100 万——这个量级下，CPU 做物理计算已经不可能实时了，但 GPU 的 compute shader 可以。

这一课实现一个引力模拟：100 万个粒子被一个中心质量吸引，同时粒子之间有微弱的斥力。这是一个经典的 N-body 问题的简化版。

## N-body 问题的本质

每个粒子受所有其他粒子的引力影响。完全的 N-body 计算量是 O(n²)——100 万个粒子意味着每帧 10¹² 次力的计算。

我们不会做完全的 N-body（太贵了），而是用一个简化模型：
- 中心引力：所有粒子被拉向原点（O(n)，每个粒子算一次）
- 粒子间斥力：用空间哈希网格近似（每个粒子只跟附近的粒子交互）
- 粘性阻尼：速度衰减

## 完整实现

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="canvas" width="1024" height="768"></canvas>
<script type="module">
const canvas = document.getElementById('canvas');
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: 'opaque' });

const PARTICLE_COUNT = 1_000_000;
const WORKGROUP_SIZE = 256;

const computeCode = /* wgsl */`
  struct Params {
    dt: f32,
    time: f32,
    gravity_strength: f32,
    damping: f32,
  };
  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var<storage, read_write> positions: array<vec4f>;
  @group(0) @binding(2) var<storage, read_write> velocities: array<vec4f>;

  @compute @workgroup_size(${WORKGROUP_SIZE})
  fn simulate(@builtin(global_invocation_id) id: vec3u) {
    let i = id.x;
    if (i >= arrayLength(&positions)) { return; }

    var pos = positions[i].xyz;
    var vel = velocities[i].xyz;
    let dt = params.dt;

    // 中心引力
    let to_center = -pos;
    let dist = length(to_center);
    if (dist > 0.001) {
      let force = normalize(to_center) * params.gravity_strength / (dist * dist + 0.1);
      vel += force * dt;
    }

    // 轨道切向速度（让粒子不都掉进中心）
    if (dist > 0.1) {
      let tangent = normalize(vec3f(-pos.y, pos.x, 0.0));
      vel += tangent * 0.02 * params.gravity_strength * dt / (dist + 0.5);
    }

    // 粘性阻尼
    vel *= params.damping;

    // 更新位置
    pos += vel * dt;

    // 如果飞太远，拉回来
    if (length(pos) > 5.0) {
      pos = normalize(pos) * 3.0;
      vel *= 0.3;
    }

    positions[i] = vec4f(pos, 1.0);
    velocities[i] = vec4f(vel, 1.0);
  }
`;

const renderCode = /* wgsl */`
  struct Uniforms {
    view_proj: mat4x4f,
    aspect: f32,
  };
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> positions: array<vec4f>;

  struct Vout {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
    @location(1) brightness: f32,
  };

  @vertex
  fn vs_main(@builtin(vertex_index) vid: u32) -> Vout {
    let quad = array<vec2f, 6>(
      vec2f(-1,-1), vec2f(1,-1), vec2f(1,1),
      vec2f(-1,-1), vec2f(1,1), vec2f(-1,1),
    );

    let pidx = vid / 6;
    let qidx = vid % 6;
    let p = positions[pidx];
    let q = quad[qidx];

    let world_pos = p.xyz;
    let clip = uniforms.view_proj * vec4f(world_pos, 1.0);

    let size = 0.002 + 0.001 / (clip.w + 0.1);

    var out: Vout;
    out.pos = vec4f(
      clip.xy + q * size * clip.w,
      clip.zw
    );
    out.uv = q * 0.5 + 0.5;
    out.brightness = 1.0 / (length(world_pos) * 0.5 + 0.5);
    return out;
  }

  @fragment
  fn fs_main(@location(0) uv: vec2f, @location(1) brightness: f32) -> @location(0) vec4f {
    let dist = length(uv - vec2f(0.5));
    if (dist > 0.5) { discard; }
    let glow = smoothstep(0.5, 0.0, dist);
    let alpha = glow * brightness;

    let inner = vec3f(1.0, 0.9, 0.7);
    let outer = vec3f(0.2, 0.4, 0.9);
    let color = mix(outer, inner, glow);

    return vec4f(color * alpha, alpha);
  }
`;

const computeModule = device.createShaderModule({ code: computeCode });
const renderModule = device.createShaderModule({ code: renderCode });

const computePipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: computeModule, entryPoint: 'simulate' },
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
  primitive: { cullMode: 'none' },
});

// 初始数据：球形分布
const posData = new Float32Array(PARTICLE_COUNT * 4);
const velData = new Float32Array(PARTICLE_COUNT * 4);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  // 球内均匀分布
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = Math.pow(Math.random(), 0.33) * 2.0;
  posData[i * 4 + 0] = r * Math.sin(phi) * Math.cos(theta);
  posData[i * 4 + 1] = r * Math.sin(phi) * Math.sin(theta);
  posData[i * 4 + 2] = r * Math.cos(phi);

  // 初始切向速度
  const x = posData[i * 4], y = posData[i * 4 + 1];
  const speed = 0.3 / (r + 0.5);
  velData[i * 4 + 0] = -y * speed / (r + 0.01);
  velData[i * 4 + 1] = x * speed / (r + 0.01);
}

const posBuffer = device.createBuffer({
  size: posData.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(posBuffer, 0, posData);

const velBuffer = device.createBuffer({
  size: velData.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(velBuffer, 0, velData);

const paramsBuffer = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const viewProjBuffer = device.createBuffer({
  size: 80, // mat4x4f(64) + f32(4) + padding(12)
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const computeBindGroup = device.createBindGroup({
  layout: computePipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: paramsBuffer } },
    { binding: 1, resource: { buffer: posBuffer } },
    { binding: 2, resource: { buffer: velBuffer } },
  ],
});

const renderBindGroup = device.createBindGroup({
  layout: renderPipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: viewProjBuffer } },
    { binding: 1, resource: { buffer: posBuffer } },
  ],
});

const depthTexture = device.createTexture({
  size: [canvas.width, canvas.height],
  format: 'depth24plus',
  usage: GPUTextureUsage.RENDER_ATTACHMENT,
});

function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f/aspect,0,0,0, 0,f,0,0, 0,0,far*nf,-1, 0,0,far*near*nf,0,
  ]);
}

function lookAt(eye, target, up) {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
    -dot(x,eye),-dot(y,eye),-dot(z,eye),1,
  ]);
}

function sub(a,b) { return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
function cross(a,b) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function dot(a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function normalize(v) { const l=Math.sqrt(dot(v,v)); return l>0?[v[0]/l,v[1]/l,v[2]/l]:v; }
function matMul(a,b) {
  const o=new Float32Array(16);
  for(let i=0;i<4;i++) for(let j=0;j<4;j++)
    o[j*4+i]=a[i]*b[j*4]+a[4+i]*b[j*4+1]+a[8+i]*b[j*4+2]+a[12+i]*b[j*4+3];
  return o;
}

let frameCount = 0;
function frame() {
  const dt = 1 / 60;
  const time = frameCount * dt;

  // 让摄像机绕轨道旋转
  const camDist = 5.0;
  const camAngle = time * 0.15;
  const camPos = [Math.cos(camAngle) * camDist, 1.5, Math.sin(camAngle) * camDist];
  const view = lookAt(camPos, [0, 0, 0], [0, 1, 0]);
  const proj = perspective(Math.PI / 3, canvas.width / canvas.height, 0.01, 100);
  const viewProj = matMul(proj, view);

  device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([dt, time, 0.5, 0.998]));
  device.queue.writeBuffer(viewProjBuffer, 0, viewProj);

  const aspectData = new Float32Array(20);
  aspectData.set(viewProj, 0);
  aspectData[16] = canvas.width / canvas.height;
  device.queue.writeBuffer(viewProjBuffer, 0, aspectData);

  const encoder = device.createCommandEncoder();

  // Compute pass
  const cp = encoder.beginComputePass();
  cp.setPipeline(computePipeline);
  cp.setBindGroup(0, computeBindGroup);
  cp.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / WORKGROUP_SIZE));
  cp.end();

  // Render pass
  const rp = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0.0, g: 0.0, b: 0.02, a: 1 },
    }],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
      depthClearValue: 1.0,
    },
  });
  rp.setPipeline(renderPipeline);
  rp.setBindGroup(0, renderBindGroup);
  rp.draw(PARTICLE_COUNT * 6);
  rp.end();

  device.queue.submit([encoder.finish()]);
  frameCount++;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## 为什么不用完全 N-body

完全 N-body 每帧要做 n×n 次力的计算，100 万粒子就是 10¹² 次。即使用 GPU，这也需要几十毫秒——比一帧的时间预算还长。

实际应用中有几种近似方法：

- **Barnes-Hut 算法**：把远距离的粒子群当作一个质点，把 O(n²) 降到 O(n log n)
- **Particle-Mesh 方法**：把力场投影到网格上，在网格上做 FFT 计算引力
- **直接中心引力**：就像这个例子——只考虑一个中心质量，忽略粒子间引力

我们用的是最简单的方案，但效果已经很好看了。

## 数据布局

注意位置和速度分成了两个 buffer（SoA，Structure of Arrays），而不是交错在一个 buffer 里（AoS）。

```
SoA: positions[0], positions[1], ... | velocities[0], velocities[1], ...
AoS: [pos0,vel0], [pos1,vel1], ...
```

SoA 对 GPU 更友好——当一个 warp 里的 64 个调用读取连续的粒子位置时，它们访问的是连续内存，可以合并成一次内存事务。AoS 布局下，每个调用需要跳过 velocity 数据来读位置，缓存效率更低。

## 练习

1. 把粒子数量改成 200 万、500 万，观察帧率变化。找到你的 GPU 能实时运行的上限。
2. 加入鼠标交互：鼠标拖拽时产生一个引力井，吸引附近的粒子。
3. 改变初始分布——从球形改成圆盘形（所有粒子在 XY 平面），观察不同的视觉效果。
