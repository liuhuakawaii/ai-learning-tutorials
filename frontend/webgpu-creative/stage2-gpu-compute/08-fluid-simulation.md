# 流体模拟：Navier-Stokes 的 GPU 实现

## 从直觉到方程

流体看起来复杂，但核心物理只有三条守恒定律：
1. **质量守恒**——流体不会凭空消失
2. **动量守恒**——力改变流体速度（牛顿第二定律的流体版本）
3. **能量守恒**——（我们这里先忽略）

Navier-Stokes 方程把这些守恒律写成了数学形式。不用被方程吓到——离散化之后，每一步的计算都很直观。

## Stable Fluids 方法

Jos Stam 在 1999 年提出的 Stable Fluids 方法把流体模拟拆成 4 步，每一步都是一个独立的 compute shader：

1. **外力施加**（Force）：给流体施加外力（比如鼠标拖拽产生的力）
2. **平流**（Advection）：流体带着量（速度、密度）移动
3. **扩散**（Diffusion）：粘性让速度场变平滑
4. **投影**（Projection）：让速度场保持无散度（不可压缩）

投影是最关键的一步——它求解一个泊松方程，让流体"不产生也不消灭"。

## 2D 流体模拟实现

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

const GRID = 256;
const DX = 1.0 / GRID;

const commonHeader = /* wgsl */`
  @group(0) @binding(0) var<uniform> params: vec4f; // dt, diff, visc, time
  @group(0) @binding(1) var<storage, read_write> vel: array<vec2f>;
  @group(0) @binding(2) var<storage, read_write> vel_prev: array<vec2f>;
  @group(0) @binding(3) var<storage, read_write> dens: array<f32>;
  @group(0) @binding(4) var<storage, read_write> dens_prev: array<f32>;

  fn idx(x: i32, y: i32) -> u32 {
    let cx = clamp(x, 0, ${GRID - 1});
    let cy = clamp(y, 0, ${GRID - 1});
    return u32(cy * ${GRID} + cx);
  }
`;

// Step 1: 外力
const addForceShader = device.createShaderModule({ code: commonHeader + /* wgsl */`
  @group(0) @binding(5) var<uniform> mouse: vec4f; // mx, my, mdx, mdy

  @compute @workgroup_size(16, 16)
  fn add_force(@builtin(global_invocation_id) id: vec3u) {
    let x = i32(id.x);
    let y = i32(id.y);
    if (x >= ${GRID} || y >= ${GRID}) { return; }

    let i = idx(x, y);
    let pos = vec2f(f32(x) / ${GRID}.0, f32(y) / ${GRID}.0);
    let mpos = mouse.xy;

    // 鼠标附近的密度源
    let dist = distance(pos, mpos);
    if (dist < 0.03 && mouse.z > 0.0) {
      dens[i] += 2.0 * (1.0 - dist / 0.03);
      vel[i] += mouse.zw * 5.0 * (1.0 - dist / 0.03);
    }
  }
`});

// Step 2: 平流（半拉格朗日法）
const advectShader = device.createShaderModule({ code: commonHeader + /* wgsl */`
  @compute @workgroup_size(16, 16)
  fn advect(@builtin(global_invocation_id) id: vec3u) {
    let x = i32(id.x);
    let y = i32(id.y);
    if (x >= ${GRID} || y >= ${GRID}) { return; }

    let i = idx(x, y);
    let dt = params.x;
    let v = vel[i];

    // 回溯：当前位置减去速度 * dt，找到"来源"
    let src_x = f32(x) - v.x * dt * f32(${GRID});
    let src_y = f32(y) - v.y * dt * f32(${GRID});

    // 双线性插值
    let x0 = i32(floor(src_x));
    let y0 = i32(floor(src_y));
    let x1 = x0 + 1;
    let y1 = y0 + 1;
    let sx = src_x - f32(x0);
    let sy = src_y - f32(y0);

    let s00 = vel_prev[idx(x0, y0)];
    let s10 = vel_prev[idx(x1, y0)];
    let s01 = vel_prev[idx(x0, y1)];
    let s11 = vel_prev[idx(x1, y1)];

    vel[i] = mix(mix(s00, s10, sx), mix(s01, s11, sx), sy);

    // 密度也做平流
    let d00 = dens_prev[idx(x0, y0)];
    let d10 = dens_prev[idx(x1, y0)];
    let d01 = dens_prev[idx(x0, y1)];
    let d11 = dens_prev[idx(x1, y1)];
    dens[i] = mix(mix(d00, d10, sx), mix(d01, d11, sx), sy);
  }
`});

// Step 3: 扩散（Jacobi 迭代）
const diffuseShader = device.createShaderModule({ code: commonHeader + /* wgsl */`
  @compute @workgroup_size(16, 16)
  fn diffuse(@builtin(global_invocation_id) id: vec3u) {
    let x = i32(id.x);
    let y = i32(id.y);
    if (x >= ${GRID} || y >= ${GRID}) { return; }

    let i = idx(x, y);
    let diff = params.y;
    let a = params.x * diff * f32(${GRID} * ${GRID});

    // Jacobi 迭代一步
    vel[i] = (vel_prev[i] + a * (
      vel[idx(x-1, y)] + vel[idx(x+1, y)] +
      vel[idx(x, y-1)] + vel[idx(x, y+1)]
    )) / (1.0 + 4.0 * a);
  }
`});

// Step 4: 投影（求解压力泊松方程，Jacobi 迭代）
const projectShader = device.createShaderModule({ code: commonHeader + /* wgsl */`
  @group(0) @binding(6) var<storage, read_write> pressure: array<f32>;
  @group(0) @binding(7) var<storage, read_write> divergence: array<f32>;

  @compute @workgroup_size(16, 16)
  fn project_div(@builtin(global_invocation_id) id: vec3u) {
    let x = i32(id.x);
    let y = i32(id.y);
    if (x >= ${GRID} || y >= ${GRID}) { return; }
    let i = idx(x, y);

    let vl = vel[idx(x-1, y)].x;
    let vr = vel[idx(x+1, y)].x;
    let vb = vel[idx(x, y-1)].y;
    let vt = vel[idx(x, y+1)].y;

    divergence[i] = -0.5 * (vr - vl + vt - vb) / f32(${GRID});
    pressure[i] = 0.0;
  }

  @compute @workgroup_size(16, 16)
  fn project_solve(@builtin(global_invocation_id) id: vec3u) {
    let x = i32(id.x);
    let y = i32(id.y);
    if (x >= ${GRID} || y >= ${GRID}) { return; }
    let i = idx(x, y);

    pressure[i] = (divergence[i] +
      pressure[idx(x-1, y)] + pressure[idx(x+1, y)] +
      pressure[idx(x, y-1)] + pressure[idx(x, y+1)]
    ) / 4.0;
  }

  @compute @workgroup_size(16, 16)
  fn project_apply(@builtin(global_invocation_id) id: vec3u) {
    let x = i32(id.x);
    let y = i32(id.y);
    if (x >= ${GRID} || y >= ${GRID}) { return; }
    let i = idx(x, y);

    let pl = pressure[idx(x-1, y)];
    let pr = pressure[idx(x+1, y)];
    let pb = pressure[idx(x, y-1)];
    let pt = pressure[idx(x, y+1)];

    vel[i].x -= 0.5 * (pr - pl) * f32(${GRID});
    vel[i].y -= 0.5 * (pt - pb) * f32(${GRID});
  }
`});

// 渲染 shader
const renderShader = device.createShaderModule({ code: /* wgsl */`
  @group(0) @binding(0) var<storage, read> dens: array<f32>;

  struct Vout { @builtin(position) pos: vec4f, @location(0) uv: vec2f };

  @vertex
  fn vs_main(@builtin(vertex_index) vid: u32) -> Vout {
    let pos = array<vec2f, 6>(
      vec2f(-1,-1), vec2f(1,-1), vec2f(1,1),
      vec2f(-1,-1), vec2f(1,1), vec2f(-1,1),
    );
    var out: Vout;
    out.pos = vec4f(pos[vid], 0, 1);
    out.uv = pos[vid] * 0.5 + 0.5;
    return out;
  }

  @fragment
  fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    let gx = i32(uv.x * ${GRID}.0);
    let gy = i32((1.0 - uv.y) * ${GRID}.0);
    let i = u32(clamp(gy, 0, ${GRID - 1}) * ${GRID} + clamp(gx, 0, ${GRID - 1}));
    let d = dens[i];

    let color = mix(
      vec3f(0.0, 0.0, 0.05),
      vec3f(0.2, 0.5, 1.0),
      clamp(d * 2.0, 0.0, 1.0)
    );
    return vec4f(color, 1.0);
  }
`);

// [Pipeline 和 BindGroup 创建省略——结构与前面课程相同]

// 鼠标追踪
let mouseX = 0.5, mouseY = 0.5, mouseDX = 0, mouseDY = 0, mouseDown = 0;
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = 1.0 - (e.clientY - rect.top) / rect.height;
  mouseDX = nx - mouseX;
  mouseDY = ny - mouseY;
  mouseX = nx;
  mouseY = ny;
});
canvas.addEventListener('mousedown', () => mouseDown = 1);
canvas.addEventListener('mouseup', () => mouseDown = 0);

function frame() {
  // 更新 uniform
  const dt = 0.1;
  const diff = 0.0001;
  const visc = 0.00001;
  // ... writeBuffer calls for params, mouse uniforms ...

  // 每帧步骤：
  // 1. addForce
  // 2. swap vel/vel_prev, diffuse → vel
  // 3. swap vel/vel_prev, advect → vel
  // 4. project (div → solve × 20 → apply)
  // 5. swap dens/dens_prev, advect density
  // 6. render density

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## 关键概念

### 半拉格朗日平流

传统方法（欧拉法）在固定网格上追踪流体变化，容易数值不稳定。半拉格朗日法反过来——对每个网格点，沿着速度方向回溯，找到"这个量是从哪来的"。

```
新值 = 采样（旧值，在 回溯位置）
```

这个方法无条件稳定——即使时间步长很大，也不会爆炸。代价是数值耗散（流体会慢慢"模糊"）。

### 投影步

投影是流体模拟最关键也最贵的一步。它求解一个泊松方程来计算压力场，然后从速度场中减去压力梯度，使速度场散度为零（不可压缩）。

Jacobi 迭代是最简单的求解器——收敛慢但容易并行化。实际生产中会用 Gauss-Seidel 或 Multigrid 方法。

## 练习

1. 加入密度的扩散步骤（和速度扩散类似），让颜色更平滑地扩散。
2. 加入第二个流体源（比如键盘 WASD 控制），实现两个流体的交互。
3. 尝试实现 vorticity confinement（涡量约束）——一种对抗数值耗散的技术，让流体保持漩涡细节。
