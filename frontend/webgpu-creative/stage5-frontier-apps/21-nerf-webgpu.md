# Neural Radiance Fields：WebGPU 实现神经辐射场

## 用神经网络表示 3D 场景

传统的 3D 场景用网格（mesh）或点云表示。NeRF（2020 年 MIT 提出）换了一种思路：用一个神经网络来"记住"整个场景。

输入：一个 3D 坐标 (x, y, z) + 一个观察方向 (θ, φ)
输出：这个点的颜色 (r, g, b) + 密度 (σ)

密度表示这个点"有多不透明"——密度高的地方就是物体表面。

## 体积渲染

NeRF 的渲染方式不是光栅化三角形，而是**射线行进**（ray marching）：

```
对屏幕上的每个像素：
  1. 从摄像机发出一条射线
  2. 沿射线均匀采样 N 个点
  3. 对每个点，用神经网络预测颜色和密度
  4. 用体积渲染公式累积颜色
```

体积渲染公式（简化版）：

```
最终颜色 = Σ (T_i * α_i * c_i)

其中：
  T_i = exp(-Σ σ_j * δ_j, j<i)  // 透射率：前面有多少被吸收了
  α_i = 1 - exp(-σ_i * δ_i)     // 不透明度
  c_i = 第 i 个采样点的颜色
  δ_i = 采样点间距
```

## 简化 NeRF 实现

这里实现一个预训练好的简化 NeRF——输入是硬编码的权重，不需要训练。场景是一个简单的程序化形状（球体和立方体的组合）。

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="canvas" width="512" height="512"></canvas>
<script type="module">
const canvas = document.getElementById('canvas');
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: 'opaque' });

const SH_SAMPLES = 64; // 每条射线的采样点数

const nerfCode = /* wgsl */`
  struct Params {
    cam_pos: vec4f,
    cam_right: vec4f,
    cam_up: vec4f,
    cam_forward: vec4f,
    resolution: vec4f, // width, height, fov, _
  };
  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;

  // 简化的场景表示：用数学函数代替神经网络
  // 真实 NeRF 会用一个 MLP 网络
  fn scene_color_density(pos: vec3f) -> vec4f {
    // 球体
    let sphere_center = vec3f(0.0, 0.0, -2.0);
    let sphere_r = 0.8;
    let sphere_dist = length(pos - sphere_center) - sphere_r;

    // 立方体
    let box_center = vec3f(0.5, 0.3, -2.5);
    let box_size = vec3f(0.4, 0.4, 0.4);
    let box_q = abs(pos - box_center) - box_size;
    let box_dist = length(max(box_q, vec3f(0.0))) + min(max(box_q.x, max(box_q.y, box_q.z)), 0.0);

    // SDF 融合
    let d = min(sphere_dist, box_dist);

    // 密度：只有 SDF 表面附近才有密度
    let sigma = smoothstep(0.02, -0.02, d) * 5.0;

    // 颜色
    var color = vec3f(0.8, 0.3, 0.2); // 红色球体
    if (box_dist < sphere_dist) {
      color = vec3f(0.2, 0.5, 0.8); // 蓝色立方体
    }

    // 用法线方向做简单着色（SDF 梯度近似法线）
    let eps = 0.01;
    let dx = scene_sdf(pos + vec3f(eps, 0, 0)) - scene_sdf(pos - vec3f(eps, 0, 0));
    let dy = scene_sdf(pos + vec3f(0, eps, 0)) - scene_sdf(pos - vec3f(0, eps, 0));
    let dz = scene_sdf(pos + vec3f(0, 0, eps)) - scene_sdf(pos - vec3f(0, 0, eps));
    let normal = normalize(vec3f(dx, dy, dz));
    let light = normalize(vec3f(1, 2, 1));
    let diffuse = max(dot(normal, light), 0.0);
    color = color * (diffuse * 0.7 + 0.3);

    return vec4f(color, sigma);
  }

  fn scene_sdf(pos: vec3f) -> f32 {
    let sphere_dist = length(pos - vec3f(0, 0, -2)) - 0.8;
    let box_q = abs(pos - vec3f(0.5, 0.3, -2.5)) - vec3f(0.4);
    let box_dist = length(max(box_q, vec3f(0.0))) + min(max(box_q.x, max(box_q.y, box_q.z)), 0.0);
    return min(sphere_dist, box_dist);
  }

  @compute @workgroup_size(8, 8)
  fn render(@builtin(global_invocation_id) id: vec3u) {
    let w = i32(params.resolution.x);
    let h = i32(params.resolution.y);
    if (id.x >= u32(w) || id.y >= u32(h)) { return; }

    // 计算射线方向
    let uv = (vec2f(f32(id.x), f32(id.y)) / vec2f(f32(w), f32(h)) - 0.5) * 2.0;
    let fov = params.resolution.z;
    let aspect = f32(w) / f32(h);
    let ray_dir = normalize(
      params.cam_right.xyz * uv.x * aspect * tan(fov * 0.5) +
      params.cam_up.xyz * uv.y * tan(fov * 0.5) +
      params.cam_forward.xyz
    );

    // 射线行进
    var color = vec3f(0.0);
    var transmittance = 1.0;
    let t_near = 0.1;
    let t_far = 10.0;
    let dt = (t_far - t_near) / f32(${SH_SAMPLES});

    for (var i = 0; i < ${SH_SAMPLES}; i++) {
      let t = t_near + f32(i) * dt;
      let sample_pos = params.cam_pos.xyz + ray_dir * t;

      let cd = scene_color_density(sample_pos);
      let sigma = cd.w;
      let sample_color = cd.rgb;

      // 体积渲染
      let alpha = 1.0 - exp(-sigma * dt);
      let weight = transmittance * alpha;
      color += weight * sample_color;
      transmittance *= (1.0 - alpha);

      // 早停：已经不透明了
      if (transmittance < 0.01) { break; }
    }

    // 背景色
    color += transmittance * vec3f(0.05, 0.05, 0.1);

    // Tone mapping
    color = color / (color + vec3f(1.0));
    color = pow(color, vec3f(1.0 / 2.2));

    textureStore(output, vec2i(id.xy), vec4f(color, 1.0));
  }
`;

const shaderModule = device.createShaderModule({ code: nerfCode });
const pipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: shaderModule, entryPoint: 'render' },
});

const outputTex = device.createTexture({
  size: [512, 512],
  format: 'rgba8unorm',
  usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
});

const paramsBuffer = device.createBuffer({
  size: 96, // 3 vec4 * 16 + 1 vec4 * 16 = 64 + 16 + 16
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: paramsBuffer } },
    { binding: 1, resource: outputTex.createView() },
  ],
});

// 摄像机参数
let camAngle = 0;
function frame(time) {
  camAngle = time / 3000;
  const camDist = 3.0;
  const camPos = [Math.cos(camAngle) * camDist, 0.5, Math.sin(camAngle) * camDist - 1.5];
  const target = [0, 0, -2];

  const forward = normalize(sub(target, camPos));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);

  const params = new Float32Array(24);
  params.set([...camPos, 1], 0);
  params.set([...right, 1], 4);
  params.set([...up, 1], 8);
  params.set([...forward, 1], 12);
  params.set([512, 512, Math.PI / 3, 0], 16);
  device.queue.writeBuffer(paramsBuffer, 0, params);

  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(512 / 8), Math.ceil(512 / 8));
  pass.end();
  device.queue.submit([enc.finish()]);

  // 用渲染管线把 outputTex 画到 canvas（省略）
  requestAnimationFrame(frame);
}

function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function normalize(v) { const l = Math.sqrt(v[0]**2+v[1]**2+v[2]**2); return l>0?[v[0]/l,v[1]/l,v[2]/l]:v; }
function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## 真正的 NeRF

上面的代码用 SDF 函数代替了神经网络。真正的 NeRF 需要：

1. **位置编码**：把 (x,y,z,θ,φ) 通过高频正弦/余弦函数编码到高维空间
2. **MLP 前向推理**：8-9 层全连接网络，每层 256 个神经元
3. **输出**：RGB 颜色 + 密度 σ

在 WebGPU 上实现 MLP 推理就是把矩阵乘法写成 compute shader——下一课会详细讲。

## NeRF 的局限

- **慢**：每条射线需要 64-128 次神经网络推理，一帧需要几秒
- **静态场景**：原始 NeRF 不能表示运动物体
- **需要大量训练数据**：通常需要几十到几百张不同角度的照片

这些局限催生了后续的改进：Instant-NGP（快速训练）、Gaussian Splatting（实时渲染）。

## 练习

1. 修改 SDF 场景，添加更多几何体（圆环、圆柱等）。
2. 增加采样数到 128，观察渲染质量变化。
3. 实现自适应采样：先用大步长粗略采样，在高密度区域用小步长精细采样。
