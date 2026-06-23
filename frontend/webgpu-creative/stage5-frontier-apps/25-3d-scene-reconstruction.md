# 阶段实战：构建 WebGPU 加速的 3D 场景重建工具

## 整合 Stage 5 的所有技术

这一课构建一个完整的 3D 场景查看器，结合：
- 体积渲染（内部结构可视化）
- 简化的 NeRF 射线行进（连续表面表示）
- ML 推理（神经网络预测颜色和密度）
- Bloom 后处理（视觉增强）

场景：一个包含多个物体的 3D 空间，用户可以用鼠标旋转摄像机，从任意角度查看。

## 架构设计

```
┌─────────────────────────────────────────┐
│  Compute Pass 1: 体积数据预处理          │
│  (生成 SDF + 颜色场)                     │
├─────────────────────────────────────────┤
│  Compute Pass 2: 射线行进 + 体积渲染     │
│  (每条射线 → 颜色 + 深度)                │
├─────────────────────────────────────────┤
│  Render Pass: Bloom 后处理 + 合成        │
│  (亮区提取 → 模糊 → Tone Mapping)       │
├─────────────────────────────────────────┤
│  UI: Canvas 2D 叠加层                    │
│  (参数滑块、FPS、信息)                    │
└─────────────────────────────────────────┘
```

## 完整实现

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="canvas" width="800" height="600"></canvas>
<div id="ui"></div>
<script type="module">
const canvas = document.getElementById('canvas');
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: 'opaque' });

const W = canvas.width, H = canvas.height;
const STEPS = 150;

// ──── 射线行进 + 体积渲染 Shader ────
const volumeCode = /* wgsl */`
  struct Params {
    inv_vp: mat4x4f,
    cam_pos: vec4f,
    light_dir: vec4f,
    params: vec4f, // step_size, density_scale, ao_intensity, time
  };
  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var output: texture_storage_2d<rgba16float, write>;

  // 程序化 SDF 场景
  fn scene_sdf(p: vec3f) -> f32 {
    // 地面
    let ground = p.y + 0.5;

    // 球体
    let s1 = length(p - vec3f(0.0, 0.0, -2.0)) - 1.0;

    // 立方体
    let box_p = p - vec3f(1.5, 0.2, -1.5);
    let box_q = abs(box_p) - vec3f(0.5);
    let box = length(max(box_q, vec3f(0.0))) + min(max(box_q.x, max(box_q.y, box_q.z)), 0.0);

    // 圆环
    let torus_p = p - vec3f(-1.2, 0.0, -2.5);
    let torus_q = vec2f(length(torus_p.xz) - 0.7, torus_p.y);
    let torus = length(torus_q) - 0.2;

    // 融合
    var d = min(s1, min(box, torus));
    d = min(d, ground);

    return d;
  }

  fn scene_color(p: vec3f) -> vec3f {
    let s1 = length(p - vec3f(0, 0, -2)) - 1.0;
    let box_p = p - vec3f(1.5, 0.2, -1.5);
    let box_q = abs(box_p) - vec3f(0.5);
    let box = length(max(box_q, vec3f(0.0))) + min(max(box_q.x, max(box_q.y, box_q.z)), 0.0);
    let torus_p = p - vec3f(-1.2, 0, -2.5);
    let torus = length(vec2f(length(torus_p.xz) - 0.7, torus_p.y)) - 0.2;
    let ground = p.y + 0.5;

    let d = min(s1, min(box, min(torus, ground)));

    if (d == s1) { return vec3f(0.8, 0.3, 0.2); }
    if (d == box) { return vec3f(0.2, 0.6, 0.8); }
    if (d == torus) { return vec3f(0.8, 0.7, 0.2); }
    return vec3f(0.3, 0.3, 0.3); // 地面
  }

  // SDF 法线
  fn calc_normal(p: vec3f) -> vec3f {
    let e = 0.001;
    return normalize(vec3f(
      scene_sdf(p + vec3f(e, 0, 0)) - scene_sdf(p - vec3f(e, 0, 0)),
      scene_sdf(p + vec3f(0, e, 0)) - scene_sdf(p - vec3f(0, e, 0)),
      scene_sdf(p + vec3f(0, 0, e)) - scene_sdf(p - vec3f(0, 0, e))
    ));
  }

  // 简易 AO
  fn calc_ao(p: vec3f, n: vec3f) -> f32 {
    var occ = 0.0;
    let weight = 0.5;
    for (var i = 1; i <= 4; i++) {
      let dist = f32(i) * 0.05;
      occ += (dist - scene_sdf(p + n * dist)) * weight;
      weight *= 0.5;
    }
    return clamp(1.0 - occ * params.params.y, 0.0, 1.0);
  }

  // 软阴影
  fn calc_shadow(ro: vec3f, rd: vec3f) -> f32 {
    var t = 0.02;
    var res = 1.0;
    for (var i = 0; i < 32; i++) {
      let d = scene_sdf(ro + rd * t);
      if (d < 0.001) { return 0.0; }
      res = min(res, 8.0 * d / t);
      t += clamp(d, 0.01, 0.2);
      if (t > 5.0) { break; }
    }
    return clamp(res, 0.0, 1.0);
  }

  @compute @workgroup_size(8, 8)
  fn render(@builtin(global_invocation_id) id: vec3u) {
    if (id.x >= ${W}u || id.y >= ${H}u) { return; }

    let uv = vec2f(f32(id.x), f32(id.y)) / vec2f(${W}.0, ${H}.0);
    let ndc = uv * 2.0 - 1.0;
    ndc.y = -ndc.y;

    // 射线方向
    let far = params.inv_vp * vec4f(ndc, 1.0, 1.0);
    let ray_dir = normalize(far.xyz / far.w - params.cam_pos.xyz);
    let ray_origin = params.cam_pos.xyz;

    // Sphere tracing
    var t = 0.0;
    var hit = false;
    for (var i = 0; i < ${STEPS}; i++) {
      let p = ray_origin + ray_dir * t;
      let d = scene_sdf(p);
      if (d < 0.001) { hit = true; break; }
      if (t > 20.0) { break; }
      t += d;
    }

    var color = vec3f(0.02, 0.02, 0.05); // 背景色

    if (hit) {
      let p = ray_origin + ray_dir * t;
      let normal = calc_normal(p);
      let albedo = scene_color(p);

      // 光照
      let light_dir = normalize(params.light_dir.xyz);
      let diffuse = max(dot(normal, light_dir), 0.0);
      let shadow = calc_shadow(p + normal * 0.01, light_dir);
      let ao = calc_ao(p, normal);

      // Blinn-Phong 高光
      let view_dir = -ray_dir;
      let half_dir = normalize(light_dir + view_dir);
      let spec = pow(max(dot(normal, half_dir), 0.0), 64.0);

      color = albedo * (diffuse * shadow * 0.7 + 0.15) * ao;
      color += vec3f(1.0) * spec * shadow * 0.3;

      // 雾效
      let fog = 1.0 - exp(-t * 0.05);
      color = mix(color, vec3f(0.02, 0.02, 0.05), fog);
    }

    textureStore(output, vec2i(id.xy), vec4f(color, 1.0));
  }
`;

// ──── Bloom 后处理（复用 Stage 3 的实现） ────
// threshold → blur H → blur V → composite + tone mapping

// ──── 鼠标交互 ────
let camTheta = 0.5, camPhi = 0.3, camDist = 5.0;
let dragging = false, lastX, lastY;

canvas.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
canvas.addEventListener('mouseup', () => dragging = false);
canvas.addEventListener('mousemove', e => {
  if (!dragging) return;
  camTheta += (e.clientX - lastX) * 0.005;
  camPhi = Math.max(-1.5, Math.min(1.5, camPhi + (e.clientY - lastY) * 0.005));
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('wheel', e => {
  camDist = Math.max(2, Math.min(15, camDist + e.deltaY * 0.01));
});

// 矩阵工具
function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,far*nf,-1, 0,0,far*near*nf,0]);
}
function lookAt(eye, target, up) {
  const z = n(sub(eye, target)), x = n(cross(up, z)), y = cross(z, x);
  return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
}
function sub(a,b) { return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
function cross(a,b) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function dot(a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function n(v) { const l=Math.sqrt(dot(v,v)); return l>0?[v[0]/l,v[1]/l,v[2]/l]:v; }
function inv(m) {
  const o = new Float32Array(16);
  const a = m;
  const s0 = a[0]*a[5]-a[1]*a[4], s1 = a[0]*a[6]-a[2]*a[4];
  const s2 = a[0]*a[7]-a[3]*a[4], s3 = a[1]*a[6]-a[2]*a[5];
  const s4 = a[1]*a[7]-a[3]*a[5], s5 = a[2]*a[7]-a[3]*a[6];
  const c0 = a[8]*a[13]-a[9]*a[12], c1 = a[8]*a[14]-a[10]*a[12];
  const c2 = a[8]*a[15]-a[11]*a[12], c3 = a[9]*a[14]-a[10]*a[13];
  const c4 = a[9]*a[15]-a[11]*a[13], c5 = a[10]*a[15]-a[11]*a[14];
  const det = s0*c5-s1*c4+s2*c3+s3*c2-s4*c1+s5*c0;
  const invdet = 1.0 / det;
  o[0]=(a[5]*c5-a[6]*c4+a[7]*c3)*invdet;
  o[1]=(-a[1]*c5+a[2]*c4-a[3]*c3)*invdet;
  o[2]=(a[13]*s5-a[14]*s4+a[15]*s3)*invdet;
  o[3]=(-a[9]*s5+a[10]*s4-a[11]*s3)*invdet;
  o[4]=(-a[4]*c5+a[6]*c2-a[7]*c1)*invdet;
  o[5]=(a[0]*c5-a[2]*c2+a[3]*c1)*invdet;
  o[6]=(-a[12]*s5+a[14]*s2-a[15]*s1)*invdet;
  o[7]=(a[8]*s5-a[10]*s2+a[11]*s1)*invdet;
  o[8]=(a[4]*c4-a[5]*c2+a[7]*c0)*invdet;
  o[9]=(-a[0]*c4+a[1]*c2-a[3]*c0)*invdet;
  o[10]=(a[12]*s4-a[13]*s2+a[15]*s0)*invdet;
  o[11]=(-a[8]*s4+a[9]*s2-a[11]*s0)*invdet;
  o[12]=(-a[4]*c3+a[5]*c1-a[6]*c0)*invdet;
  o[13]=(a[0]*c3-a[1]*c1+a[2]*c0)*invdet;
  o[14]=(-a[12]*s3+a[13]*s1-a[14]*s0)*invdet;
  o[15]=(a[8]*s3-a[9]*s1+a[10]*s0)*invdet;
  return o;
}

// [所有 Pipeline 创建、Buffer 创建...]

function frame(time) {
  const t = time / 1000;
  const camPos = [
    Math.sin(camTheta) * Math.cos(camPhi) * camDist,
    Math.sin(camPhi) * camDist + 1,
    Math.cos(camTheta) * Math.cos(camPhi) * camDist,
  ];
  const target = [0, 0, -2];
  const view = lookAt(camPos, target, [0, 1, 0]);
  const proj = perspective(Math.PI / 3, W / H, 0.1, 100);
  const vp = mul(proj, view);
  const inv_vp = inv(vp);

  // 更新 uniform
  const paramsData = new Float32Array(32);
  paramsData.set(inv_vp, 0);
  paramsData.set([...camPos, 1], 16);
  paramsData.set([0.5, 1.0, 0.3, 1], 20); // light dir
  paramsData.set([0.01, 2.0, 1.0, t], 24); // step_size, density, ao, time
  device.queue.writeBuffer(paramsBuffer, 0, paramsData);

  const enc = device.createCommandEncoder();

  // Compute: 射线行进
  const cp = enc.beginComputePass();
  cp.setPipeline(volumePipeline);
  cp.setBindGroup(0, volumeBindGroup);
  cp.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));
  cp.end();

  // Bloom 后处理
  // [threshold → blur H → blur V → composite...]

  device.queue.submit([enc.finish()]);
  requestAnimationFrame(frame);
}

function mul(a,b) { const o=new Float32Array(16); for(let i=0;i<4;i++) for(let j=0;j<4;j++) o[j*4+i]=a[i]*b[j*4]+a[4+i]*b[j*4+1]+a[8+i]*b[j*4+2]+a[12+i]*b[j*4+3]; return o; }

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## 性能优化

1. **自适应步长**：靠近表面时用小步长（精确），远离表面时用大步长（快速跳过空区域）。这就是 SDF 的天然优势——步长 = SDF 值。
2. **早停**：累积的不透明度接近 1.0 时提前退出。
3. **降采样渲染**：在半分辨率下做射线行进，然后上采样（结合时序抗锯齿）。

## 这个工具能扩展什么

- 加载真实的 3D 扫描数据（点云、体素）
- 加入神经网络预测的材质属性
- 支持实时编辑（添加/删除物体）
- 导出渲染结果为图片或视频
- 支持 VR 头显（WebXR + WebGPU）

## 课程回顾

25 课从 WebGPU 基础到前沿应用，覆盖了：

1. **基础**：渲染管线、Buffer、Compute Shader
2. **计算**：并行归约、粒子物理、流体模拟、排序
3. **渲染**：延迟渲染、全局光照、阴影、后处理
4. **模拟**：噪声、Game of Life、Boids、布料
5. **前沿**：NeRF、Gaussian Splatting、体积渲染、ML 推理

核心模式始终不变：**用 storage buffer 存数据，用 compute shader 做计算，用渲染管线做可视化。**

下一步可以做的：
- 把这些技术组合成一个完整的 WebGPU 引擎
- 尝试 WebGPU + WebXR 做 VR/AR 应用
- 研究 WebGPU 的多线程特性（SharedArrayBuffer + OffscreenCanvas）

## 练习

1. 给场景添加可交互的物体——点击某个物体，高亮显示它。
2. 实现环境光探针（Environment Probe）——用立方体贴图存储环境光照。
3. 把这个查看器封装成一个可复用的 Web Component。
