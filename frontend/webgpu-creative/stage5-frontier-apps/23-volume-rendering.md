# 体积渲染：医学/气象数据的 3D 可视化

## CT 扫描数据怎么 3D 显示

医学影像（CT、MRI）产生的是一个 3D 体素数组——每个体素是一个数值（比如密度）。传统的 2D 切片查看只能看一个截面，体积渲染可以让你从任意角度看到内部结构。

核心算法还是**射线行进**（ray marching）——和 NeRF 一样，从摄像机发出射线，沿射线采样，累积颜色和不透明度。

## 传递函数

体素数值本身不是颜色。需要一个**传递函数**（transfer function）把数值映射到颜色和不透明度：

```
密度 0.0-0.2  → 透明（空气）
密度 0.2-0.5  → 红色半透明（软组织）
密度 0.5-0.8  → 白色不透明（骨骼）
密度 0.8-1.0  → 黄色不透明（金属植入物）
```

传递函数是体积渲染的关键——不同的传递函数可以显示不同的组织。

## 完整实现

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="canvas" width="600" height="600"></canvas>
<script type="module">
const canvas = document.getElementById('canvas');
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: 'opaque' });

const VOL_SIZE = 128; // 体积分辨率
const STEPS = 200;    // 每条射线最大步数

const shaderCode = /* wgsl */`
  struct Params {
    mvp: mat4x4f,
    inv_mvp: mat4x4f,
    cam_pos: vec4f,
    vol_size: vec4f,  // size, step_size, _, _
    light_dir: vec4f,
  };
  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var vol_tex: texture_3d<f32>;
  @group(0) @binding(2) var vol_sampler: sampler;

  struct Vout { @builtin(position) pos: vec4f, @location(0) uv: vec2f };

  @vertex
  fn vs(@builtin(vertex_index) vid: u32) -> Vout {
    let p = array<vec2f, 6>(vec2f(-1,-1),vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(1,1),vec2f(-1,1));
    var out: Vout;
    out.pos = vec4f(p[vid], 0, 1);
    out.uv = p[vid] * 0.5 + 0.5;
    return out;
  }

  // 传递函数：把密度映射到颜色和不透明度
  fn transfer_function(density: f32) -> vec4f {
    // 空气
    if (density < 0.15) { return vec4f(0.0, 0.0, 0.0, 0.0); }
    // 软组织
    if (density < 0.4) {
      let t = smoothstep(0.15, 0.4, density);
      return vec4f(mix(vec3f(0.8, 0.2, 0.1), vec3f(0.9, 0.5, 0.3), t), t * 0.3);
    }
    // 骨骼
    if (density < 0.7) {
      let t = smoothstep(0.4, 0.7, density);
      return vec4f(mix(vec3f(0.9, 0.5, 0.3), vec3f(0.95, 0.95, 0.9), t), t * 0.8);
    }
    // 密质骨
    return vec4f(1.0, 1.0, 0.95, 1.0);
  }

  // 计算梯度（法线近似）
  fn sample_gradient(pos: vec3f) -> vec3f {
    let s = 1.0 / params.vol_size.x;
    let dx = textureSampleLevel(vol_tex, vol_sampler, pos + vec3f(s,0,0), 0).r -
             textureSampleLevel(vol_tex, vol_sampler, pos - vec3f(s,0,0), 0).r;
    let dy = textureSampleLevel(vol_tex, vol_sampler, pos + vec3f(0,s,0), 0).r -
             textureSampleLevel(vol_tex, vol_sampler, pos - vec3f(0,s,0), 0).r;
    let dz = textureSampleLevel(vol_tex, vol_sampler, pos + vec3f(0,0,s), 0).r -
             textureSampleLevel(vol_tex, vol_sampler, pos - vec3f(0,0,s), 0).r;
    return normalize(vec3f(dx, dy, dz));
  }

  @fragment
  fn fs(in: uv: vec2f) -> @location(0) vec4f {
    // 从屏幕坐标反投影射线
    let ndc = in.uv * 2.0 - 1.0;
    let near = params.inv_mvp * vec4f(ndc, 0.0, 1.0);
    let far = params.inv_mvp * vec4f(ndc, 1.0, 1.0);
    let ray_origin = near.xyz / near.w;
    let ray_dir = normalize(far.xyz / far.w - ray_origin);

    // 射线-AABB 相交（体积盒 [0,1]³）
    let box_min = vec3f(0.0);
    let box_max = vec3f(1.0);
    let inv_dir = 1.0 / ray_dir;
    let t0 = (box_min - ray_origin) * inv_dir;
    let t1 = (box_max - ray_origin) * inv_dir;
    let tmin_v = min(t0, t1);
    let tmax_v = max(t0, t1);
    let tmin = max(max(tmin_v.x, tmin_v.y), tmin_v.z);
    let tmax = min(min(tmax_v.x, tmax_v.y), tmax_v.z);

    if (tmin > tmax || tmax < 0.0) {
      return vec4f(0.05, 0.05, 0.1, 1.0); // 背景色
    }

    // 射线行进
    var color = vec3f(0.0);
    var alpha = 0.0;
    let step_size = params.vol_size.y;
    let start_t = max(tmin, 0.0);

    for (var t = start_t; t < tmax && alpha < 0.98; t += step_size) {
      let sample_pos = ray_origin + ray_dir * t;

      // 采样体积
      let density = textureSampleLevel(vol_tex, vol_sampler, sample_pos, 0).r;

      if (density < 0.05) { continue; }

      let tf = transfer_function(density);
      let sample_alpha = tf.a * step_size * 5.0;

      // 光照
      let normal = sample_gradient(sample_pos);
      let light = normalize(params.light_dir.xyz);
      let diffuse = max(dot(normal, light), 0.0);
      let ambient = 0.2;
      let lit_color = tf.rgb * (diffuse * 0.7 + ambient);

      // 前到后合成
      color += lit_color * sample_alpha * (1.0 - alpha);
      alpha += sample_alpha * (1.0 - alpha);
    }

    // 背景混合
    let bg = vec3f(0.05, 0.05, 0.1);
    color = mix(bg, color, alpha);

    // Tone mapping
    color = color / (color + vec3f(1.0));
    color = pow(color, vec3f(1.0 / 2.2));

    return vec4f(color, 1.0);
  }
`;

// 生成程序化体积数据（模拟器官形状）
const volData = new Float32Array(VOL_SIZE * VOL_SIZE * VOL_SIZE);
for (let z = 0; z < VOL_SIZE; z++) {
  for (let y = 0; y < VOL_SIZE; y++) {
    for (let x = 0; x < VOL_SIZE; x++) {
      const i = z * VOL_SIZE * VOL_SIZE + y * VOL_SIZE + x;
      const nx = x / VOL_SIZE - 0.5;
      const ny = y / VOL_SIZE - 0.5;
      const nz = z / VOL_SIZE - 0.5;

      // 外壳（球体）
      const sphere = Math.sqrt(nx*nx + ny*ny + nz*nz);
      let val = Math.max(0, 1 - sphere * 3) * 0.5;

      // 内部结构（噪声）
      const noise = Math.sin(nx * 15) * Math.cos(ny * 12) * Math.sin(nz * 10) * 0.3;
      val += noise * Math.max(0, 1 - sphere * 2.5);

      // 中心高密度
      if (sphere < 0.15) val = 0.9;

      volData[i] = Math.max(0, Math.min(1, val));
    }
  }
}

// 创建 3D 纹理
const volTexture = device.createTexture({
  size: [VOL_SIZE, VOL_SIZE, VOL_SIZE],
  format: 'r32float',
  dimension: '3d',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
});
device.queue.writeTexture(
  { texture: volTexture },
  volData.buffer,
  { bytesPerRow: VOL_SIZE * 4, rowsPerImage: VOL_SIZE },
  [VOL_SIZE, VOL_SIZE, VOL_SIZE],
);

// [Pipeline 创建、BindGroup 创建、渲染循环...]
// 渲染循环中每帧更新 mvp 和 inv_mvp

</script>
</body>
</html>
```

## 射线-AABB 相交

射线行进的第一步是找到射线什么时候进入、什么时候离开体积盒。这里用标准的 slab method：

```
对每个轴：
  t_near = (min - origin) / direction
  t_far  = (max - origin) / direction
  交换使 t_near < t_far

全局 t_enter = max(t_near_x, t_near_y, t_near_z)
全局 t_exit  = min(t_far_x, t_far_y, t_far_z)
```

## 前到后 vs 后到前

体积渲染有两种合成方式：

- **前到后**（front-to-back）：从摄像机近处往远处走。每步累积颜色和不透明度，接近完全不透明时提前退出。
- **后到前**（back-to-front）：从远处往近处走。更简单但不能早停。

前到后更高效，因为大部分射线在到达体积背面之前就已经不透明了。

## 练习

1. 实现不同的传递函数——只显示骨骼（高阈值），或只显示软组织（中等阈值）。
2. 加入环境光遮蔽：在体积内部计算 AO，让缝隙和角落更暗。
3. 尝试用医学公开数据集（如 Visible Human）替换程序化数据。
