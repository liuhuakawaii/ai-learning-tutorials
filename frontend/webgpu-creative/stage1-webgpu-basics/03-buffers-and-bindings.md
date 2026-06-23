# 缓冲与绑定：Buffer / BindGroup / BindGroupLayout

## GPU 资源绑定模型

WebGPU 里，着色器不能直接访问"全局变量"。所有外部数据——矩阵、纹理、采样器、大数组——都要通过绑定组（BindGroup）传入。

这套模型的核心思想是：**把资源声明和资源绑定分离**。

- `BindGroupLayout` 描述"我需要什么类型的资源"（声明）
- `BindGroup` 描述"这些资源具体是谁"（绑定）
- 创建 pipeline 时用 layout，渲染时用 bind group

这样设计的好处是：你可以用同一个 pipeline 配合不同的 bind group，渲染不同的数据。比如同一个着色器处理不同角色的模型，只需要切换 bind group。

## 存储缓冲区 vs Uniform 缓冲区

| 类型 | Uniform Buffer | Storage Buffer |
|------|---------------|----------------|
| 大小限制 | 通常 64KB | 通常 128MB+ |
| 读取速度 | 快（缓存优化） | 较慢 |
| 写入 | 着色器只读 | 着色器可读可写 |
| 用途 | 矩阵、参数 | 大数组、粒子数据、计算结果 |

简单参数用 uniform，大量数据用 storage buffer。

## 实例：用 Storage Buffer 传递粒子数据，用纹理渲染

这个例子用 storage buffer 存 10000 个粒子的位置，用一个 1x1 的白色纹理作为粒子贴片，在片段着色器里根据距粒子中心的距离着色。

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

const PARTICLE_COUNT = 10000;

const shaderCode = /* wgsl */`
  struct Particle {
    pos: vec2f,
    vel: vec2f,
  };
  struct Particles {
    data: array<Particle>,
  };
  @group(0) @binding(0) var<storage, read> particles: Particles;
  @group(0) @binding(1) var particleTex: texture_2d<f32>;
  @group(0) @binding(2) var particleSampler: sampler;

  struct Uniforms {
    aspect: f32,
    pointSize: f32,
  };
  @group(0) @binding(3) var<uniform> uniforms: Uniforms;

  struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
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
    let size = uniforms.pointSize;
    out.position = vec4f(
      p.pos.x + q.x * size,
      (p.pos.y + q.y * size) / uniforms.aspect,
      0.0, 1.0
    );
    out.uv = q * 0.5 + 0.5;
    return out;
  }

  @fragment
  fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    let dist = length(uv - vec2f(0.5));
    if (dist > 0.5) { discard; }
    let alpha = smoothstep(0.5, 0.3, dist);
    return vec4f(0.3, 0.6, 1.0, alpha);
  }
`;

const shaderModule = device.createShaderModule({ code: shaderCode });

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module: shaderModule, entryPoint: 'vs_main' },
  fragment: {
    module: shaderModule,
    entryPoint: 'fs_main',
    targets: [{
      format,
      blend: {
        color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
      },
    }],
  },
});

// 粒子初始数据
const particleData = new Float32Array(PARTICLE_COUNT * 4); // pos.xy, vel.xy
for (let i = 0; i < PARTICLE_COUNT; i++) {
  particleData[i * 4 + 0] = (Math.random() - 0.5) * 2;  // x
  particleData[i * 4 + 1] = (Math.random() - 0.5) * 2;  // y
  particleData[i * 4 + 2] = (Math.random() - 0.5) * 0.01; // vx
  particleData[i * 4 + 3] = (Math.random() - 0.5) * 0.01; // vy
}

const particleBuffer = device.createBuffer({
  size: particleData.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(particleBuffer, 0, particleData);

const uniformBuffer = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: particleBuffer } },
    {
      binding: 1,
      resource: device.createTexture({
        size: [1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUBufferUsage.COPY_DST,
      }).createView(),
    },
    {
      binding: 2,
      resource: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }),
    },
    { binding: 3, resource: { buffer: uniformBuffer } },
  ],
});

function frame(time) {
  const aspect = canvas.width / canvas.height;
  device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([aspect, 0.015]));

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1 },
    }],
  });

  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.draw(PARTICLE_COUNT * 6); // 6 vertices per quad
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## BindGroup 的布局结构

上面的代码创建了 4 个绑定：

```txt
@group(0) @binding(0) → Storage Buffer（粒子数据）
@group(0) @binding(1) → Texture（粒子纹理）
@group(0) @binding(2) → Sampler（采样器）
@group(0) @binding(3) → Uniform Buffer（参数）
```

`layout: 'auto'` 让 WebGPU 从着色器自动推断 bind group layout。在生产环境里，手动创建 `bindGroupLayout` 可以复用和优化。

## 多 Bind Group

当资源更新频率不同时，可以用多个 bind group：

```txt
@group(0) @binding(0) → 全局参数（每帧更新一次）
@group(1) @binding(0) → 材质数据（每个物体不同）
@group(2) @binding(0) → 骨骼数据（每个角色不同）
```

渲染时分别 `setBindGroup(0, ...)` / `setBindGroup(1, ...)` / `setBindGroup(2, ...)`。这比把所有资源塞进一个 bind group 更高效——切换材质时不需要重新绑定全局参数。

## Buffer 的 usage 标志

创建 buffer 时必须声明用途：

```ts
GPUBufferUsage.VERTEX    // 作为顶点缓冲区
GPUBufferUsage.INDEX     // 作为索引缓冲区
GPUBufferUsage.UNIFORM   // 作为 uniform 缓冲区
GPUBufferUsage.STORAGE   // 作为 storage 缓冲区
GPUBufferUsage.COPY_DST  // 可以从 CPU 写入
GPUBufferUsage.COPY_SRC  // 可以从 GPU 拷贝到其他 buffer
```

一个 buffer 可以有多个 usage，但组合必须在创建时确定，之后不能改。常见的组合：

- `VERTEX | COPY_DST`：顶点数据，CPU 写入
- `STORAGE | COPY_DST`：计算着色器用，CPU 写入
- `STORAGE | COPY_SRC`：计算着色器写入结果，然后拷贝到其他 buffer

## 练习

1. 修改粒子数量到 100000，观察性能变化。如果掉帧，想想瓶颈在哪。
2. 把存储缓冲区改成双缓冲（ping-pong）：两个 storage buffer，着色器从 A 读、写到 B，下一帧交换。这是 GPU 计算的常见模式。
3. 给每个粒子加一个生命周期属性，让粒子在屏幕上随机飘动并周期性重生。
