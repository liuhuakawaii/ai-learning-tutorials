# 延迟渲染：G-Buffer、光照 Pass、多光源

## 前向渲染的瓶颈

前向渲染（Forward Rendering）对每个物体，先做顶点变换，再做光照计算。如果场景有 N 个物体和 M 个光源，复杂度是 O(N × M)——100 个物体 × 64 个光源 = 6400 次光照计算。

而且，被遮挡的物体也做了光照计算（浪费了）。

延迟渲染（Deferred Rendering）的思路是：先把所有几何信息写到一组缓冲区（G-Buffer），然后在屏幕空间做一次光照计算。复杂度变成 O(N + 屏幕像素数 × M)。

## G-Buffer 里存什么

```
G-Buffer 0: 世界坐标 (xyz, -)
G-Buffer 1: 法线 (xyz, -)
G-Buffer 2: 颜色 + 材质 (rgb, metallic)
G-Buffer 3: 深度（可选，用 depth buffer 代替）
```

光照 pass 只需要读这些缓冲区，不需要知道物体的几何形状。

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
const LIGHT_COUNT = 64;

// ──── G-Buffer 写入 Shader ────
const gbufCode = /* wgsl */`
  struct UBO { mvp: mat4x4f, model: mat4x4f, normal_mat: mat4x4f };
  @group(0) @binding(0) var<uniform> ubo: UBO;

  struct GBufferOut {
    @location(0) world_pos: vec4f,
    @location(1) normal: vec4f,
    @location(2) albedo: vec4f,
    @builtin(position) position: vec4f,
  };

  @vertex
  fn vs(@location(0) pos: vec3f, @location(1) norm: vec3f, @location(2) color: vec3f) -> GBufferOut {
    var out: GBufferOut;
    let world = ubo.model * vec4f(pos, 1.0);
    out.position = ubo.mvp * vec4f(pos, 1.0);
    out.world_pos = world;
    out.normal = ubo.normal_mat * vec4f(norm, 0.0);
    out.albedo = vec4f(color, 1.0);
    return out;
  }

  @fragment
  fn fs(in: GBufferOut) -> GBufferOut {
    var out: GBufferOut;
    out.world_pos = in.world_pos;
    out.normal = normalize(in.normal);
    out.albedo = in.albedo;
    out.position = in.position;
    return out;
  }
`;

// ──── 光照 Pass Shader ────
const lightCode = /* wgsl */`
  struct Light {
    position: vec4f,  // xyz = pos, w = radius
    color: vec4f,     // rgb = color, a = intensity
  };
  struct Lights {
    data: array<Light, ${LIGHT_COUNT}>,
  };

  @group(0) @binding(0) var gbuf_pos: texture_2d<f32>;
  @group(0) @binding(1) var gbuf_norm: texture_2d<f32>;
  @group(0) @binding(2) var gbuf_albedo: texture_2d<f32>;
  @group(0) @binding(3) var<uniform> lights: Lights;
  @group(0) @binding(4) var<uniform> cam_pos: vec4f;

  @vertex
  fn vs(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4f {
    let pos = array<vec2f, 6>(
      vec2f(-1,-1), vec2f(1,-1), vec2f(1,1),
      vec2f(-1,-1), vec2f(1,1), vec2f(-1,1),
    );
    return vec4f(pos[vid], 0, 1);
  }

  @fragment
  fn fs(@builtin(position) frag_coord: vec4f) -> @location(0) vec4f {
    let uv = vec2u(frag_coord.xy);
    let world_pos = textureLoad(gbuf_pos, uv, 0).xyz;
    let normal = normalize(textureLoad(gbuf_norm, uv, 0).xyz);
    let albedo = textureLoad(gbuf_albedo, uv, 0).rgb;

    // 环境光
    var color = albedo * 0.05;

    // 逐光源计算
    for (var i = 0; i < ${LIGHT_COUNT}; i++) {
      let light = lights.data[i];
      let to_light = light.position.xyz - world_pos;
      let dist = length(to_light);
      let dir = to_light / dist;

      // 衰减
      let atten = light.color.a / (1.0 + dist * dist / (light.position.w * light.position.w));

      // Lambert diffuse
      let ndotl = max(dot(normal, dir), 0.0);
      color += albedo * light.color.rgb * ndotl * atten;

      // Blinn-Phong specular
      let view_dir = normalize(cam_pos.xyz - world_pos);
      let half_dir = normalize(dir + view_dir);
      let spec = pow(max(dot(normal, half_dir), 0.0), 32.0);
      color += light.color.rgb * spec * atten * 0.3;
    }

    return vec4f(color, 1.0);
  }
`;

// [Pipeline 创建、G-Buffer 纹理创建、光源数据初始化...]
// [渲染循环：Pass 1 写 G-Buffer，Pass 2 做光照...]

</script>
</body>
</html>
```

## G-Buffer 纹理格式选择

| 数据 | 推荐格式 | 原因 |
|------|---------|------|
| 世界坐标 | rgba16float | float32 太贵，16 位精度够用 |
| 法线 | rgba16float 或 rgba8snorm | 法线范围 [-1,1]，8 位有 banding |
| 颜色 | rgba8unorm | 颜色精度 8 位足够 |
| 深度 | depth24plus | 标准深度格式 |

带宽是延迟渲染的瓶颈——G-Buffer 越大，写入和读取的带宽越多。实际项目中会用各种压缩技巧减少 G-Buffer 大小。

## 光源数据

64 个光源存在一个 uniform buffer 里。每个光源 32 字节（position + color），64 个 = 2048 字节，在 uniform 限制内。

光源位置和颜色在 JS 侧每帧更新——可以做光源动画。

## 延迟渲染的局限

1. **透明物体**：G-Buffer 只存最近表面的信息，透明物体需要单独用前向 pass 处理
2. **MSAA 兼容性差**：G-Buffer 的多重采样比前向渲染复杂得多
3. **带宽大**：多个 MRT 纹理的读写带宽消耗大，移动端是瓶颈
4. **材质多样性**：所有物体共享同一个光照 shader，材质差异靠 G-Buffer 里的参数区分

## 练习

1. 添加 256 个光源，观察延迟渲染在多光源下的性能优势。
2. 实现点光源的阴影：对每个光源，渲染一张深度立方体贴图（cube shadow map），光照 pass 中采样深度比较。
3. 尝试 Tiled Deferred Rendering：把屏幕分成 16×16 的 tile，每个 tile 只计算影响它的光源。
