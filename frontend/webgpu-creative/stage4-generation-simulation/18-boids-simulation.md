# 群体模拟：Boids 算法

## 三条规则，万千行为

Craig Reynolds 在 1986 年提出的 Boids 算法只用三条规则就能模拟鸟群、鱼群、羊群的群体行为：

1. **分离（Separation）**：避免和邻居靠太近
2. **对齐（Alignment）**：和邻居保持相同飞行方向
3. **凝聚（Cohesion）**：向邻居的中心靠拢

每条规则产生一个力向量，加到 boid 的速度上。没有全局协调，没有领导者，只有局部交互——群体行为完全涌现自个体规则。

## 为什么 GPU 适合这个任务

每个 boid 需要遍历所有邻居来计算三个力。10000 个 boid，每个检查 10000 个邻居 = 10⁸ 次距离计算。CPU 上每帧需要几十毫秒，GPU 上几千个核心并行处理，可以实时运行。

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

const BOID_COUNT = 10000;
const WG = 256;

const computeCode = /* wgsl */`
  struct Boid {
    pos: vec2f,
    vel: vec2f,
  };
  struct Boids {
    data: array<Boid>,
  };
  struct Params {
    dt: f32,
    sep_radius: f32,
    ali_radius: f32,
    coh_radius: f32,
    sep_weight: f32,
    ali_weight: f32,
    coh_weight: f32,
    max_speed: f32,
  };

  @group(0) @binding(0) var<storage, read_write> boids: Boids;
  @group(0) @binding(1) var<uniform> params: Params;

  @compute @workgroup_size(${WG})
  fn update(@builtin(global_invocation_id) id: vec3u) {
    let i = id.x;
    if (i >= arrayLength(&boids.data)) { return; }

    let self = boids.data[i];
    var sep = vec2f(0.0); // 分离力
    var ali = vec2f(0.0); // 对齐力
    var coh = vec2f(0.0); // 凝聚力
    var sep_count = 0.0;
    var ali_count = 0.0;
    var coh_count = 0.0;

    let count = arrayLength(&boids.data);

    // 遍历所有邻居（简化版，生产环境用空间哈希）
    for (var j = 0u; j < count; j++) {
      if (j == i) { continue; }

      let other = boids.data[j];
      let diff = self.pos - other.pos;
      let dist = length(diff);

      // 分离：太近就推开
      if (dist < params.sep_radius && dist > 0.001) {
        sep += normalize(diff) / dist;
        sep_count += 1.0;
      }

      // 对齐：统计邻居速度
      if (dist < params.ali_radius) {
        ali += other.vel;
        ali_count += 1.0;
      }

      // 凝聚：统计邻居位置
      if (dist < params.coh_radius) {
        coh += other.pos;
        coh_count += 1.0;
      }
    }

    var new_vel = self.vel;

    // 应用三个力
    if (sep_count > 0.0) {
      new_vel += normalize(sep / sep_count) * params.sep_weight * params.dt;
    }
    if (ali_count > 0.0) {
      let avg_vel = ali / ali_count;
      new_vel += normalize(avg_vel - self.vel) * params.ali_weight * params.dt;
    }
    if (coh_count > 0.0) {
      let center = coh / coh_count;
      new_vel += normalize(center - self.pos) * params.coh_weight * params.dt;
    }

    // 速度限制
    let speed = length(new_vel);
    if (speed > params.max_speed) {
      new_vel = normalize(new_vel) * params.max_speed;
    }
    if (speed < 0.1) {
      new_vel = normalize(select(vec2f(1, 0), new_vel, speed > 0.001)) * 0.1;
    }

    // 更新位置
    var new_pos = self.pos + new_vel * params.dt;

    // 环形边界
    if (new_pos.x > 1.5) { new_pos.x = -1.5; }
    if (new_pos.x < -1.5) { new_pos.x = 1.5; }
    if (new_pos.y > 1.5) { new_pos.y = -1.5; }
    if (new_pos.y < -1.5) { new_pos.y = 1.5; }

    boids.data[i] = Boid(new_pos, new_vel);
  }
`;

const renderCode = /* wgsl */`
  @group(0) @binding(0) var<storage, read> boids: array<vec4f>; // pos.xy, vel.xy

  struct Vout {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
  };

  @vertex
  fn vs(@builtin(vertex_index) vid: u32) -> Vout {
    // 每个 boid 画一个三角形（3 个顶点）
    let boid_idx = vid / 3u;
    let vert_idx = vid % 3u;
    let data = boids[boid_idx];
    let pos = data.xy;
    let vel = data.zw;

    // 三角形方向跟随速度
    let angle = atan2(vel.y, vel.x);
    let c = cos(angle);
    let s = sin(angle);

    // 三角形形状
    let shapes = array<vec2f, 3>(
      vec2f(0.01, 0.0),   // 尖端
      vec2f(-0.005, 0.004), // 左翼
      vec2f(-0.005, -0.004), // 右翼
    );
    let local = shapes[vert_idx];
    let rotated = vec2f(
      local.x * c - local.y * s,
      local.x * s + local.y * c
    );

    var out: Vout;
    out.position = vec4f(pos + rotated, 0.0, 1.0);

    // 颜色随速度变化
    let speed = length(vel);
    let t = clamp(speed / 1.5, 0.0, 1.0);
    out.color = mix(vec3f(0.3, 0.5, 0.9), vec3f(0.9, 0.3, 0.2), t);

    return out;
  }

  @fragment
  fn fs(@location(0) color: vec3f) -> @location(0) vec4f {
    return vec4f(color, 1.0);
  }
`;

const computeModule = device.createShaderModule({ code: computeCode });
const renderModule = device.createShaderModule({ code: renderCode });

const computePipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: computeModule, entryPoint: 'update' },
});

const renderPipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module: renderModule, entryPoint: 'vs' },
  fragment: {
    module: renderModule,
    entryPoint: 'fs',
    targets: [{ format }],
  },
  primitive: { cullMode: 'none' },
});

// 初始 boid 数据
const boidData = new Float32Array(BOID_COUNT * 4); // pos.xy, vel.xy
for (let i = 0; i < BOID_COUNT; i++) {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * 1.0;
  boidData[i * 4 + 0] = Math.cos(angle) * r;
  boidData[i * 4 + 1] = Math.sin(angle) * r;
  boidData[i * 4 + 2] = Math.cos(angle + Math.PI / 2) * 0.5;
  boidData[i * 4 + 3] = Math.sin(angle + Math.PI / 2) * 0.5;
}

const boidBuffer = device.createBuffer({
  size: boidData.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(boidBuffer, 0, boidData);

const paramsBuffer = device.createBuffer({
  size: 32,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const computeBG = device.createBindGroup({
  layout: computePipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: boidBuffer } },
    { binding: 1, resource: { buffer: paramsBuffer } },
  ],
});

const renderBG = device.createBindGroup({
  layout: renderPipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: boidBuffer } },
  ],
});

function frame() {
  // 更新参数
  device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([
    1/60,    // dt
    0.03,    // sep_radius
    0.08,    // ali_radius
    0.08,    // coh_radius
    3.0,     // sep_weight
    1.0,     // ali_weight
    0.5,     // coh_weight
    1.5,     // max_speed
  ]));

  const enc = device.createCommandEncoder();

  const cp = enc.beginComputePass();
  cp.setPipeline(computePipeline);
  cp.setBindGroup(0, computeBG);
  cp.dispatchWorkgroups(Math.ceil(BOID_COUNT / WG));
  cp.end();

  const rp = enc.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1 },
    }],
  });
  rp.setPipeline(renderPipeline);
  rp.setBindGroup(0, renderBG);
  rp.draw(BOID_COUNT * 3); // 3 vertices per boid triangle
  rp.end();

  device.queue.submit([enc.finish()]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## 性能瓶颈：O(n²) 遍历

每个 boid 遍历所有其他 boid 来找邻居。10000 个 boid 就是 10⁸ 次距离计算。

优化方案：
1. **空间哈希**：把空间分成网格，只检查同格和相邻格的 boid
2. **k-d tree**：对位置建树，范围查询 O(log n)
3. **限制邻居数量**：只取最近的 K 个邻居

这些优化在 CPU 上是必须的，在 GPU 上 10000 个 boid 还能实时，但 100000 个就需要空间加速了。

## 参数调优

| 参数 | 太小的效果 | 太大的效果 |
|------|-----------|-----------|
| sep_radius | 碰撞 | 松散群体 |
| ali_radius | 混乱 | 过度统一 |
| coh_radius | 分散 | 紧密簇拥 |
| sep_weight | 撞在一起 | 散开 |
| ali_weight | 各飞各的 | 军队般整齐 |
| coh_weight | 独狼 | 拥挤 |

## 练习

1. 加入"捕食者"：一个鼠标控制的点，boids 会远离它。
2. 加入障碍物：几个圆形障碍区，boids 需要绕行。
3. 尝试实现 3D Boids（加 z 轴），渲染成立体的鸟群效果。
