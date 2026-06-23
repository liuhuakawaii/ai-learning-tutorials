# 全局光照：Screen Space Ambient Occlusion

## 直接光照 vs 间接光照

上一课的延迟渲染只计算了直接光照——光线从光源出发，打到物体表面，反射到摄像机。但真实世界里，光线还会在物体之间多次弹射，这就是间接光照（全局光照）。

SSAO（Screen Space Ambient Occlusion）是最简单的全局光照近似：它不计算真正的光线弹射，而是在屏幕空间估计"每个像素被周围几何体遮挡了多少"。遮挡越多的地方越暗——角落、缝隙、褶皱处会自然变暗。

## SSAO 的原理

对屏幕上的每个像素：
1. 从深度缓冲重建世界坐标
2. 在法线半球内采样若干个邻近点
3. 检查这些点的深度是否比实际深度更近（被遮挡）
4. 遮挡比例就是 AO 值

```
AO = 1.0 - (被遮挡的采样数 / 总采样数)
```

AO = 1 表示完全不遮挡（开阔区域），AO = 0 表示完全被遮挡（深缝隙）。

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

const W = canvas.width, H = canvas.height;

// Pass 1: 写深度和法线到 G-Buffer
const depthNormalCode = /* wgsl */`
  struct UBO { mvp: mat4x4f, model: mat4x4f, normal_mat: mat4x4f };
  @group(0) @binding(0) var<uniform> ubo: UBO;

  struct Vout {
    @builtin(position) pos: vec4f,
    @location(0) norm: vec3f,
    @location(1) view_pos: vec3f,
  };

  @vertex
  fn vs(@location(0) position: vec3f, @location(1) normal: vec3f) -> Vout {
    var out: Vout;
    out.pos = ubo.mvp * vec4f(position, 1.0);
    out.norm = (ubo.normal_mat * vec4f(normal, 0.0)).xyz;
    out.view_pos = (ubo.model * vec4f(position, 1.0)).xyz;
    return out;
  }

  @fragment
  fn fs(in: Vout) -> @location(0) vec4f {
    let n = normalize(in.norm);
    // 把法线和深度打包输出
    return vec4f(n * 0.5 + 0.5, in.view_pos.z);
  }
`;

// Pass 2: SSAO 计算（compute shader）
const ssaoCode = /* wgsl */`
  struct Params {
    proj: mat4x4f,
    inv_proj: mat4x4f,
    samples: array<vec4f, 32>,
    radius: f32,
    bias: f32,
    noise_scale_x: f32,
    noise_scale_y: f32,
  };
  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var depth_norm_tex: texture_2d<f32>;
  @group(0) @binding(2> var ssao_out: texture_storage_2d<r32float, write>;

  // 从深度重建视图空间坐标
  fn reconstruct_view_pos(uv: vec2f) -> vec3f {
    let data = textureLoad(depth_norm_tex, vec2i(uv * vec2f(${W}.0, ${H}.0)), 0);
    return vec3f(uv * 2.0 - 1.0, data.w);
  }

  @compute @workgroup_size(8, 8)
  fn ssao_main(@builtin(global_invocation_id) id: vec3u) {
    let xy = vec2i(id.xy);
    if (xy.x >= ${W} || xy.y >= ${H}) { return; }

    let uv = vec2f(xy) / vec2f(${W}.0, ${H}.0);
    let data = textureLoad(depth_norm_tex, xy, 0);
    let normal = normalize(data.xyz * 2.0 - 1.0);
    let view_pos = reconstruct_view_pos(uv);

    // 哈希噪声（用于随机化采样方向）
    let noise = fract(sin(dot(vec2f(xy), vec2f(12.9898, 78.233))) * 43758.5453);

    var occlusion = 0.0;
    let sample_count = 16u;

    for (var i = 0u; i < sample_count; i++) {
      // 从预计算的采样核中取方向
      var sample_dir = params.samples[i].xyz;
      // 半球采样：如果方向在法线下方，翻转
      if (dot(sample_dir, normal) < 0.0) {
        sample_dir = -sample_dir;
      }

      // 加随机旋转
      let angle = noise * 6.283185;
      let s = sin(angle), c = cos(angle);
      sample_dir = vec3f(
        sample_dir.x * c - sample_dir.y * s,
        sample_dir.x * s + sample_dir.y * c,
        sample_dir.z
      );

      let sample_pos = view_pos + sample_dir * params.radius;

      // 投影到屏幕空间
      let clip = params.proj * vec4f(sample_pos, 1.0);
      let sample_uv = clip.xy / clip.w * 0.5 + 0.5;

      // 采样深度
      let sample_data = textureLoad(depth_norm_tex, vec2i(sample_uv * vec2f(${W}.0, ${H}.0)), 0);
      let sample_depth = sample_data.w;

      // 深度比较
      let range_check = smoothstep(0.0, 1.0, params.radius / abs(view_pos.z - sample_depth));
      occlusion += select(0.0, 1.0, sample_depth >= sample_pos.z + params.bias) * range_check;
    }

    occlusion = 1.0 - occlusion / f32(sample_count);
    textureStore(ssao_out, xy, vec4f(occlusion, 0, 0, 0));
  }
`;

// Pass 3: 最终合成（全屏四边形）
const compositeCode = /* wgsl */`
  @group(0) @binding(0) var ssao_tex: texture_2d<f32>;
  @group(0) @binding(1> var scene_tex: texture_2d<f32>;
  @group(0) @binding(2) var samp: sampler;

  @vertex
  fn vs(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4f {
    let p = array<vec2f, 6>(vec2f(-1,-1),vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(1,1),vec2f(-1,1));
    return vec4f(p[vid], 0, 1);
  }

  @fragment
  fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let xy = vec2i(pos.xy);
    let ao = textureLoad(ssao_tex, xy, 0).r;
    let scene = textureLoad(scene_tex, xy, 0).rgb;

    // 用 AO 调暗场景
    let color = scene * ao;

    // 简单 tone mapping
    let mapped = color / (color + vec3f(1.0));
    return vec4f(pow(mapped, vec3f(1.0 / 2.2)), 1.0);
  }
`;

// [Pipeline 创建、纹理创建、采样核生成...]
// 渲染循环：Pass 1 → Pass 2 → Pass 3

</script>
</body>
</html>
```

## 采样核生成

SSAO 需要在法线半球内均匀采样。JS 侧生成 32 个采样点：

```js
const samples = new Float32Array(32 * 4);
for (let i = 0; i < 32; i++) {
  // 半球内的均匀分布
  let x = Math.random() * 2 - 1;
  let y = Math.random() * 2 - 1;
  let z = Math.random(); // 只取正半球
  const len = Math.sqrt(x*x + y*y + z*z);
  x /= len; y /= len; z /= len;

  // 距离分布：越远的采样点权重越低（加速衰减）
  const scale = i / 32;
  const lerp = 0.1 + scale * scale * 0.9;

  samples[i * 4 + 0] = x * lerp;
  samples[i * 4 + 1] = y * lerp;
  samples[i * 4 + 2] = z * lerp;
}
```

## SSAO 的常见问题

- **噪点**：16 个采样点会产生明显的噪点。解决方案是用更大的采样核 + 双边模糊（bilateral blur）后处理。
- **屏幕空间的局限**：SSAO 只能看到屏幕上的信息。被遮挡的物体（不在视野内）不会影响 AO。这是所有屏幕空间技术的通病。
- **参数调优**：`radius` 控制遮挡检测范围，`bias` 防止自遮挡（z-fighting）。这两个参数需要根据场景尺度调整。

## 练习

1. 给 SSAO 结果加一个 4×4 的双边模糊 pass，减少噪点。
2. 实现 GTAO（Ground Truth Ambient Occlusion）——一种更物理准确的 AO 方法。
3. 尝试在延迟渲染管线中整合 SSAO：把 AO 值写入 G-Buffer 的 alpha 通道，光照 pass 中采样。
