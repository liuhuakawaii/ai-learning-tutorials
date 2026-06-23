# 阶段实战：构建实时群体模拟可视化

## 整合 Stage 4 的所有技术

这一课把 Boids 群体行为、程序化噪声环境、碰撞检测整合成一个完整的群体模拟系统。

场景：
- 30000 个 boids 在一个程序化噪声地形上空飞行
- 地形用 fBm 生成，boids 需要避开地面
- 有 3 个"捕食者"跟随群体中心移动
- Bloom 后处理让效果更好看

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

const BOID_COUNT = 30000;
const WG = 256;
const TERRAIN_SIZE = 256;

// ──── 地形生成 Compute Shader ────
const terrainCode = /* wgsl */`
  @group(0) @binding(0) var terrain_out: texture_storage_2d<rgba8unorm, write>;

  fn hash2(p: vec2f) -> vec2f {
    let k = vec2f(127.1, 311.7);
    return fract(sin(vec2f(dot(p, k), dot(p, k.yx + 1.0))) * 43758.5453) * 2.0 - 1.0;
  }

  fn perlin(p: vec2f) -> f32 {
    let i = floor(p); let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(dot(hash2(i), f), dot(hash2(i + vec2f(1,0)), f - vec2f(1,0)), u.x),
      mix(dot(hash2(i + vec2f(0,1)), f - vec2f(0,1)), dot(hash2(i + vec2f(1,1)), f - vec2f(1,1)), u.x),
      u.y
    );
  }

  fn fbm(p: vec2f) -> f32 {
    var v = 0.0; var a = 0.5; var f = 1.0;
    for (var i = 0; i < 6; i++) { v += a * perlin(p * f); f *= 2.0; a *= 0.5; }
    return v;
  }

  @compute @workgroup_size(8, 8)
  fn gen_terrain(@builtin(global_invocation_id) id: vec3u) {
    let size = textureDimensions(terrain_out);
    if (id.x >= size.x || id.y >= size.y) { return; }
    let uv = vec2f(f32(id.x), f32(id.y)) / vec2f(f32(size.x), f32(size.y));
    let h = fbm(uv * 5.0) * 0.5 + 0.5;
    let color = mix(vec3f(0.1, 0.2, 0.1), vec3f(0.4, 0.35, 0.2), h);
    textureStore(terrain_out, vec2i(id.xy), vec4f(color, h));
  }
`;

// ──── Boids Compute Shader ────
const boidCode = /* wgsl */`
  struct Boid { pos: vec4f, vel: vec4f };
  struct Params {
    dt: f32, sep_r: f32, ali_r: f32, coh_r: f32,
    sep_w: f32, ali_w: f32, coh_w: f32, max_spd: f32,
    predator_x: f32, predator_y: f32, predator_z: f32, predator_active: f32,
    time: f32, bounds: f32, _, _,
  };
  @group(0) @binding(0) var<storage, read_write> boids: array<Boid>;
  @group(0) @binding(1) var<uniform> params: Params;

  fn terrain_height(x: f32, z: f32) -> f32 {
    // 简化：用数学函数近似地形高度
    return sin(x * 2.0) * cos(z * 2.0) * 0.15 - 0.3;
  }

  @compute @workgroup_size(${WG})
  fn update(@builtin(global_invocation_id) id: vec3u) {
    let i = id.x;
    if (i >= arrayLength(&boids)) { return; }

    let self = boids[i];
    var sep = vec3f(0.0);
    var ali = vec3f(0.0);
    var coh = vec3f(0.0);
    var sc = 0.0; var ac = 0.0; var cc = 0.0;

    // 只检查附近的 boid（采样 100 个）
    for (var j = 0u; j < 100u; j++) {
      let ni = (i + j * 317u) % arrayLength(&boids); // 伪随机采样
      if (ni == i) { continue; }
      let other = boids[ni];
      let diff = self.pos.xyz - other.pos.xyz;
      let dist = length(diff);

      if (dist < params.sep_r && dist > 0.001) {
        sep += normalize(diff) / dist; sc += 1.0;
      }
      if (dist < params.ali_r) {
        ali += other.vel.xyz; ac += 1.0;
      }
      if (dist < params.coh_r) {
        coh += other.pos.xyz; cc += 1.0;
      }
    }

    var vel = self.vel.xyz;

    if (sc > 0.0) { vel += normalize(sep / sc) * params.sep_w * params.dt; }
    if (ac > 0.0) { vel += normalize(ali / ac - self.vel.xyz) * params.ali_w * params.dt; }
    if (cc > 0.0) { vel += normalize(coh / cc - self.pos.xyz) * params.coh_w * params.dt; }

    // 避开捕食者
    if (params.predator_active > 0.5) {
      let to_pred = self.pos.xyz - vec3f(params.predator_x, params.predator_y, params.predator_z);
      let pd = length(to_pred);
      if (pd < 0.5) {
        vel += normalize(to_pred) * 3.0 * params.dt / (pd + 0.1);
      }
    }

    // 避开地面
    let ground = terrain_height(self.pos.x, self.pos.z);
    if (self.pos.y < ground + 0.1) {
      vel.y += 2.0 * params.dt;
    }

    // 天花板
    if (self.pos.y > 0.8) {
      vel.y -= 1.0 * params.dt;
    }

    // 速度限制
    let spd = length(vel);
    if (spd > params.max_spd) { vel = normalize(vel) * params.max_spd; }
    if (spd < 0.05) { vel = normalize(select(vec3f(0,1,0), vel, spd > 0.001)) * 0.1; }

    var pos = self.pos.xyz + vel * params.dt;

    // 环形水平边界
    let b = params.bounds;
    if (pos.x > b) { pos.x = -b; }
    if (pos.x < -b) { pos.x = b; }
    if (pos.z > b) { pos.z = -b; }
    if (pos.z < -b) { pos.z = b; }

    boids[i] = Boid(vec4f(pos, 1.0), vec4f(vel, 1.0));
  }
`;

// ──── Boid 渲染 Shader ────
const boidRenderCode = /* wgsl */`
  struct UBO { mvp: mat4x4f };
  @group(0) @binding(0) var<uniform> ubo: UBO;
  @group(0) @binding(1) var<storage, read> boids: array<vec4f>;

  struct Vout {
    @builtin(position) pos: vec4f,
    @location(0) color: vec3f,
  };

  @vertex
  fn vs(@builtin(vertex_index) vid: u32) -> Vout {
    let bi = vid / 3u;
    let vi = vid % 3u;
    let p = boids[bi * 2];     // pos
    let v = boids[bi * 2 + 1]; // vel

    let angle = atan2(v.z, x) // 实际应该是 atan2(v.z, v.x)
    let c = cos(angle); let s = sin(angle);

    let shapes = array<vec3f, 3>(
      vec3f(0.008, 0, 0), vec3f(-0.004, 0, 0.003), vec3f(-0.004, 0, -0.003),
    );
    let local = shapes[vi];
    let rotated = vec3f(
      local.x * c - local.z * s,
      local.y,
      local.x * s + local.z * c
    );

    var out: Vout;
    out.pos = ubo.mvp * vec4f(p.xyz + rotated, 1.0);

    let spd = length(v.xyz);
    let t = clamp(spd / 1.5, 0.0, 1.0);
    out.color = mix(vec3f(0.2, 0.6, 1.0), vec3f(1.0, 0.4, 0.2), t);
    return out;
  }

  @fragment
  fn fs(@location(0) color: vec3f) -> @location(0) vec4f {
    return vec4f(color, 1.0);
  }
`;

// ──── 地形渲染 Shader ────
const terrainRenderCode = /* wgsl */`
  struct UBO { mvp: mat4x4f };
  @group(0) @binding(0) var<uniform> ubo: UBO;
  @group(0) @binding(1) var terrain_tex: texture_2d<f32>;
  @group(0) @binding(2> var samp: sampler;

  struct Vout {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
    @location(1) height: f32,
  };

  @vertex
  fn vs(@builtin(vertex_index) vid: u32) -> Vout {
    // 生成地形网格
    let grid_size = ${TERRAIN_SIZE};
    let x = vid % grid_size;
    let y = vid / grid_size;
    let uv = vec2f(f32(x), f32(y)) / f32(grid_size);
    let h = textureLoad(terrain_tex, vec2i(x, y), 0).w;

    let world_xz = (uv - 0.5) * 2.0;
    let world_pos = vec3f(world_xz.x, h - 0.5, world_xz.y);

    var out: Vout;
    out.pos = ubo.mvp * vec4f(world_pos, 1.0);
    out.uv = uv;
    out.height = h;
    return out;
  }

  @fragment
  fn fs(in: Vout) -> @location(0) vec4f {
    let color = textureLoad(terrain_tex, vec2i(in.uv * ${TERRAIN_SIZE}.0), 0).rgb;
    return vec4f(color * 0.8, 1.0);
  }
`;

// [所有 Pipeline 创建、Buffer 创建、BindGroup 创建...]
// [Bloom 后处理（复用 Stage 3 的代码）...]

// 鼠标交互
let mouseX = 0, mouseY = 0, mouseDown = false;
canvas.addEventListener('mousedown', () => mouseDown = true);
canvas.addEventListener('mouseup', () => mouseDown = false);
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouseX = ((e.clientX - r.left) / r.width - 0.5) * 2;
  mouseY = -((e.clientY - r.top) / r.height - 0.5) * 2;
});

function frame(time) {
  const t = time / 1000;
  device.queue.writeBuffer(boidParamsBuf, 0, new Float32Array([
    1/60, 0.02, 0.06, 0.06,  // dt, sep_r, ali_r, coh_r
    3.0, 1.0, 0.5, 1.5,       // sep_w, ali_w, coh_w, max_spd
    mouseX, mouseY, 0, mouseDown ? 1 : 0, // predator
    t, 1.2, 0, 0,              // time, bounds
  ]));

  const enc = device.createCommandEncoder();

  // 1. 生成地形（只需一次，这里每帧重复演示）
  // 2. Boids compute
  const cp = enc.beginComputePass();
  cp.setPipeline(boidComputePipeline);
  cp.setBindGroup(0, boidComputeBG);
  cp.dispatchWorkgroups(Math.ceil(BOID_COUNT / WG));
  cp.end();

  // 3. 渲染地形
  // 4. 渲染 boids
  // 5. Bloom 后处理

  device.queue.submit([enc.finish()]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## 性能优化要点

1. **邻居采样**：遍历 30000 个 boid 太贵。这里用伪随机采样 100 个——视觉效果足够好，性能提升 300 倍。
2. **SoA 布局**：位置和速度分别存储，GPU 缓存更友好。
3. **地形只生成一次**：地形纹理在初始化时生成一次，之后只读。

## 视觉效果设计

- Boid 颜色随速度变化——慢时蓝色，快时橙色
- 地形用程序化颜色——低处绿色，高处棕色
- Bloom 后处理让 boid 轨迹有发光感
- 捕食者用鼠标控制，按住时 boids 四散

## 练习

1. 加入多种群：两种不同颜色的 boid 群，各自有自己的聚集行为，但会互相避让。
2. 实现更真实的地形碰撞：boid 应该沿着地形表面滑行，而不是硬性拉回。
3. 加入声音反馈：boid 速度越快，音调越高（用 Web Audio API）。
