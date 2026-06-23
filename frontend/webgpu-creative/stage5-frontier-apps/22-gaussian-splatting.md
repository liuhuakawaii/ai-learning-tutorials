# Gaussian Splatting：3D 高斯溅射的 Web 实现

## 为什么 NeRF 太慢

NeRF 的渲染需要对每条射线做 64-128 次神经网络推理。512×512 的图像就是 26 万条射线 × 64 次推理 = 1600 万次网络前向传播。即使用 GPU，也需要几秒。

Gaussian Splatting（2023 年 Inria 提出）完全绕过了神经网络——它用一组 3D 高斯椭球来表示场景，渲染时直接把这些椭球"投射"（splat）到屏幕上。

## 高斯椭球的表示

每个高斯有这些属性：

```
position: vec3f      // 中心位置
covariance: mat3f    // 3x3 协方差矩阵（决定椭球形状和朝向）
color: vec3f         // RGB 颜色
opacity: f32         // 不透明度
```

协方差矩阵可以分解为旋转矩阵 R 和缩放矩阵 S：Σ = R · S · Sᵀ · Rᵀ

## 渲染流程

```
对每个高斯：
  1. 把 3D 中心投影到 2D 屏幕坐标
  2. 把 3D 协方差投影到 2D 协方差
  3. 计算这个高斯在屏幕上的影响范围（一个 2D 高斯）
  4. 对范围内的每个像素，计算高斯值
  5. 按深度排序，Alpha 混合
```

这比 NeRF 快得多——不需要射线行进，不需要神经网络推理。

## 简化实现

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

const GAUSSIAN_COUNT = 50000;

// ──── Compute: 高斯投影 ────
const projectCode = /* wgsl */`
  struct Gaussian {
    pos: vec4f,       // xyz = position, w = opacity
    color: vec4f,     // rgb = color, a = padding
    scale: vec4f,     // xyz = scale, a = padding
    rot: vec4f,       // xyzw = quaternion rotation
  };
  struct ProjectedGaussian {
    screen_pos: vec4f,  // xy = screen pos, zw = padding
    cov2d: vec4f,       // xx, xy, yy of 2D covariance
    color: vec4f,       // rgb = color, a = opacity
    depth: f32,
    _pad: vec3f,
  };

  struct Params {
    view_proj: mat4x4f,
    cam_pos: vec4f,
    resolution: vec4f,
    tan_fov: vec4f, // tan(fov_x/2), tan(fov_y/2), _, _
  };

  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var<storage, read> gaussians: array<Gaussian>;
  @group(0) @binding(2) var<storage, read_write> projected: array<ProjectedGaussian>;

  fn quat_to_mat3(q: vec4f) -> mat3x3f {
    let x = q.x; let y = q.y; let z = q.z; let w = q.w;
    return mat3x3f(
      1 - 2*(y*y + z*z), 2*(x*y - w*z), 2*(x*z + w*y),
      2*(x*y + w*z), 1 - 2*(x*x + z*z), 2*(y*z - w*x),
      2*(x*z - w*y), 2*(y*z + w*x), 1 - 2*(x*x + y*y),
    );
  }

  @compute @workgroup_size(256)
  fn project(@builtin(global_invocation_id) id: vec3u) {
    let i = id.x;
    if (i >= arrayLength(&gaussians)) { return; }

    let g = gaussians[i];
    let pos = g.pos.xyz;
    let opacity = g.pos.w;

    // 投影到屏幕空间
    let clip = params.view_proj * vec4f(pos, 1.0);
    if (clip.w <= 0.0) { return; } // 在摄像机后面

    let ndc = clip.xy / clip.w;
    let res = params.resolution.xy;
    let screen = (ndc * 0.5 + 0.5) * res;
    screen.y = res.y - screen.y; // 翻转 Y

    // 计算 3D 协方差
    let R = quat_to_mat3(g.rot);
    let S = mat3x3f(g.scale.x, 0, 0, 0, g.scale.y, 0, 0, 0, g.scale.z);
    let cov3d = R * S * S * transpose(R);

    // 投影到 2D 协方差（简化的 Jacobian）
    let z = clip.w;
    let tx = params.tan_fov.x;
    let ty = params.tan_fov.y;
    let J = mat3x3f(
      res.x / (2.0 * tx * z), 0, 0,
      0, res.y / (2.0 * ty * z), 0,
      0, 0, 0
    );
    let cov2d_3x3 = J * cov3d * transpose(J);

    // 提取 2D 协方差的上三角
    let cov2d = vec4f(cov2d_3x3[0][0], cov2d_3x3[0][1], cov2d_3x3[1][1], 0);

    projected[i] = ProjectedGaussian(
      vec4f(screen, 0, 0),
      cov2d,
      vec4f(g.color.rgb, opacity),
      clip.w,
      vec3f(0),
    );
  }
`;

// ──── Compute: 按深度排序 ────
// (简化：用 bitonic sort，复用 Stage 2 的代码)

// ──── Fragment: 高斯 Splat 渲染 ────
const splatCode = /* wgsl */`
  struct ProjectedGaussian {
    screen_pos: vec4f,
    cov2d: vec4f,
    color: vec4f,
    depth: f32,
    _pad: vec3f,
  };
  @group(0) @binding(0) var<storage, read> projected: array<ProjectedGaussian>;
  @group(0) @binding(1) var<uniform> resolution: vec2f;

  struct Vout {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
    @location(1) @interpolate(flat) idx: u32,
  };

  @vertex
  fn vs(@builtin(vertex_index) vid: u32) -> Vout {
    // 每个高斯画一个四边形（6 个顶点）
    let quad = array<vec2f, 6>(
      vec2f(-1,-1), vec2f(1,-1), vec2f(1,1),
      vec2f(-1,-1), vec2f(1,1), vec2f(-1,1),
    );

    let gi = vid / 6u;
    let qi = vid % 6u;
    let p = projected[gi];
    let local = quad[qi];

    // 2D 高斯的影响范围
    let cov = p.cov2d;
    let a = cov.x; let b = cov.y; let c = cov.z;
    let det = a * c - b * b;
    if (det <= 0.0) { return Vout(vec4f(0), vec2f(0), 0u); }

    // 特征分解确定椭圆大小
    let trace = a + c;
    let discriminant = sqrt(max(trace * trace - 4.0 * det, 0.0));
    let lambda1 = (trace + discriminant) * 0.5;
    let lambda2 = (trace - discriminant) * 0.5;

    // 3-sigma 范围
    let radius = 3.0 * sqrt(max(lambda1, lambda2));

    var out: Vout;
    out.pos = vec4f(
      (p.screen_pos.xy + local * radius) / resolution * 2.0 - 1.0,
      0.0, 1.0
    );
    out.pos.y = -out.pos.y;
    out.uv = local;
    out.idx = gi;
    return out;
  }

  @fragment
  fn fs(in: Vout) -> @location(0) vec4f {
    let p = projected[in.idx];

    // 计算 2D 高斯值
    let cov = p.cov2d;
    let a = cov.x; let b = cov.y; let c = cov.z;
    let det = a * c - b * b;
    if (det <= 0.0) { discard; }

    let inv_det = 1.0 / det;
    let inv_a = c * inv_det;
    let inv_b = -b * inv_det;
    let inv_c = a * inv_det;

    let u = in.uv.x;
    let v = in.uv.y;
    let power = -0.5 * (inv_a * u * u + 2.0 * inv_b * u * v + inv_c * v * v);

    if (power > -4.0) { discard; } // 超出 2-sigma 范围

    let alpha = p.color.a * exp(power);
    if (alpha < 1.0 / 255.0) { discard; }

    return vec4f(p.color.rgb * alpha, alpha);
  }
`;

// 生成随机高斯数据
const gaussianData = new Float32Array(GAUSSIAN_COUNT * 16); // 4 个 vec4
for (let i = 0; i < GAUSSIAN_COUNT; i++) {
  const base = i * 16;
  // 位置：球形分布
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = Math.pow(Math.random(), 0.5) * 1.5;
  gaussianData[base + 0] = r * Math.sin(phi) * Math.cos(theta);
  gaussianData[base + 1] = r * Math.sin(phi) * Math.sin(theta);
  gaussianData[base + 2] = r * Math.cos(phi) - 2;
  gaussianData[base + 3] = 0.8; // opacity

  // 颜色
  gaussianData[base + 4] = Math.random();
  gaussianData[base + 5] = Math.random();
  gaussianData[base + 6] = Math.random();

  // 缩放
  const s = 0.02 + Math.random() * 0.05;
  gaussianData[base + 8] = s;
  gaussianData[base + 9] = s;
  gaussianData[base + 10] = s;

  // 旋转（单位四元数）
  const u1 = Math.random(), u2 = Math.random(), u3 = Math.random();
  gaussianData[base + 12] = Math.sqrt(1 - u1) * Math.sin(2 * Math.PI * u2);
  gaussianData[base + 13] = Math.sqrt(1 - u1) * Math.cos(2 * Math.PI * u2);
  gaussianData[base + 14] = Math.sqrt(u1) * Math.sin(2 * Math.PI * u3);
  gaussianData[base + 15] = Math.sqrt(u1) * Math.cos(2 * Math.PI * u3);
}

// [Buffer 创建、Pipeline 创建、渲染循环...]
// 渲染循环：Compute 投影 → 排序 → 渲染 Splat（Alpha Blending）

</script>
</body>
</html>
```

## 排序很重要

高斯 Splatting 的渲染依赖正确的深度排序——从后往前渲染（painter's algorithm），前面的高斯覆盖后面的。这需要按深度对所有高斯排序。

Stage 2 学的 Bitonic Sort 在这里派上用场了。

## 与 NeRF 的对比

| 维度 | NeRF | Gaussian Splatting |
|------|------|-------------------|
| 表示 | 隐式（神经网络） | 显式（高斯椭球） |
| 渲染 | 射线行进 | 投影 + 光栅化 |
| 速度 | 慢（秒级） | 快（实时） |
| 训练 | 慢（小时级） | 快（分钟级） |
| 内存 | 小（网络权重） | 大（每个高斯的属性） |
| 质量 | 高（连续表示） | 高（但可能有伪影） |

## 练习

1. 修改高斯数量，找到实时渲染的上限。
2. 实现更准确的协方差投影——使用完整的 Jacobian 矩阵。
3. 尝试用鼠标旋转摄像机，观察高斯场景的不同角度。
