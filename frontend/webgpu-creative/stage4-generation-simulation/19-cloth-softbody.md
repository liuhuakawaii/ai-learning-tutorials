# 布料模拟：弹簧-质点系统的 GPU 加速

## 布料的物理模型

布料可以建模为一个弹簧-质点网格：

- **质点**：网格上的每个交叉点，有位置和速度
- **弹簧**：连接相邻质点的约束，有三种类型：
  - 结构弹簧（structural）：连接上下左右邻居
  - 剪切弹簧（shear）：连接对角邻居
  - 弯曲弹簧（bend）：连接隔一个的邻居（抵抗弯曲）

每个质点受重力、弹簧力、阻尼力影响。Verlet 积分法比 Euler 积分更稳定——它直接积分加速度到位置，不需要显式存速度。

## Verlet 积分

```
new_pos = 2 * pos - old_pos + acceleration * dt²
```

用 `pos` 和 `old_pos` 的差隐式表示速度，数值更稳定。

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

const CLOTH_W = 64;
const CLOTH_H = 64;
const POINT_COUNT = CLOTH_W * CLOTH_H;
const WG = 256;

const computeCode = /* wgsl */`
  @group(0) @binding(0) var<storage, read_write> positions: array<vec4f>;
  @group(0) @binding(1) var<storage, read_write> old_positions: array<vec4f>;
  @group(0) @binding(2) var<uniform> params: vec4f; // dt, gravity, damping, rest_length
  @group(0) @binding(3) var<uniform> mouse: vec4f; // mx, my, click, _

  fn idx(x: i32, y: i32) -> u32 {
    return u32(clamp(y, 0, ${CLOTH_H - 1}) * ${CLOTH_W} + clamp(x, 0, ${CLOTH_W - 1}));
  }

  @compute @workgroup_size(${WG})
  fn simulate(@builtin(global_invocation_id) id: vec3u) {
    let i = id.x;
    if (i >= arrayLength(&positions)) { return; }

    let x = i32(i % ${CLOTH_W});
    let y = i32(i / ${CLOTH_W});

    // 固定点：第一行固定
    if (y == 0) { return; }

    var pos = positions[i].xyz;
    var old = old_positions[i].xyz;
    let dt = params.x;
    let gravity = params.y;
    let damping = params.z;
    let rest = params.w;

    // Verlet 积分
    var vel = (pos - old) * damping;
    var new_pos = pos + vel + vec3f(0.0, -gravity * dt * dt, 0.0);

    // 弹簧约束（结构弹簧）
    var correction = vec3f(0.0);
    let neighbors = array<vec2i, 4>(
      vec2i(1, 0), vec2i(-1, 0), vec2i(0, 1), vec2i(0, -1),
    );

    for (var n = 0; n < 4; n++) {
      let nx = x + neighbors[n].x;
      let ny = y + neighbors[n].y;
      if (nx < 0 || nx >= ${CLOTH_W} || ny < 0 || ny >= ${CLOTH_H}) { continue; }

      let ni = idx(nx, ny);
      let neighbor_pos = positions[ni].xyz;
      let diff = new_pos - neighbor_pos;
      let dist = length(diff);
      if (dist < 0.0001) { continue; }

      // 弹簧力
      let displacement = dist - rest;
      let force_dir = normalize(diff);
      correction -= force_dir * displacement * 0.5;
    }

    new_pos += correction;

    // 鼠标交互
    if (mouse.z > 0.5) {
      let mouse_pos = vec3f(mouse.xy, 0.0);
      let to_mouse = mouse_pos - new_pos;
      let dist = length(to_mouse);
      if (dist < 0.1) {
        new_pos = mix(new_pos, mouse_pos, 0.3);
      }
    }

    // 碰撞：不让布料穿到地下
    if (new_pos.y < -0.8) {
      new_pos.y = -0.8;
    }

    old_positions[i] = vec4f(pos, 1.0);
    positions[i] = vec4f(new_pos, 1.0);
  }
`;

const renderCode = /* wgsl */`
  @group(0) @binding(0) var<uniform> mvp: mat4x4f;
  @group(0) @binding(1) var<storage, read> positions: array<vec4f>;

  struct Vout {
    @builtin(position) pos: vec4f,
    @location(0) norm: vec3f,
  };

  @vertex
  fn vs(@builtin(vertex_index) vid: u32) -> Vout {
    let i = vid;
    let p = positions[i].xyz;
    var out: Vout;
    out.pos = mvp * vec4f(p, 1.0);

    // 简易法线（用有限差分）
    let x = i32(i % ${CLOTH_W});
    let y = i32(i / ${CLOTH_W});
    let left = positions[u32(clamp(y, 0, ${CLOTH_H-1}) * ${CLOTH_W} + clamp(x-1, 0, ${CLOTH_W-1}))].xyz;
    let right = positions[u32(clamp(y, 0, ${CLOTH_H-1}) * ${CLOTH_W} + clamp(x+1, 0, ${CLOTH_W-1}))].xyz;
    let up = positions[u32(clamp(y-1, 0, ${CLOTH_H-1}) * ${CLOTH_W} + clamp(x, 0, ${CLOTH_W-1}))].xyz;
    let down = positions[u32(clamp(y+1, 0, ${CLOTH_H-1}) * ${CLOTH_W} + clamp(x, 0, ${CLOTH_W-1}))].xyz;
    out.norm = normalize(cross(right - left, down - up));
    return out;
  }

  @fragment
  fn fs(@location(0) norm: vec3f) -> @location(0) vec4f {
    let light = normalize(vec3f(0.5, 1.0, 0.3));
    let ndotl = max(dot(normalize(norm), light), 0.0);
    let color = vec3f(0.8, 0.2, 0.2) * (ndotl * 0.7 + 0.3);
    return vec4f(color, 1.0);
  }
`;

// 生成布料索引（三角形网格）
const indices = new Uint32Array((CLOTH_W - 1) * (CLOTH_H - 1) * 6);
let idx = 0;
for (let y = 0; y < CLOTH_H - 1; y++) {
  for (let x = 0; x < CLOTH_W - 1; x++) {
    const i = y * CLOTH_W + x;
    indices[idx++] = i;
    indices[idx++] = i + CLOTH_W;
    indices[idx++] = i + 1;
    indices[idx++] = i + 1;
    indices[idx++] = i + CLOTH_W;
    indices[idx++] = i + CLOTH_W + 1;
  }
}

// 初始位置：挂在顶部的一块布
const posData = new Float32Array(POINT_COUNT * 4);
const oldPosData = new Float32Array(POINT_COUNT * 4);
const restLength = 1.0 / CLOTH_W;

for (let y = 0; y < CLOTH_H; y++) {
  for (let x = 0; x < CLOTH_W; x++) {
    const i = (y * CLOTH_W + x) * 4;
    const px = (x / CLOTH_W - 0.5) * 1.5;
    const py = 0.7 - (y / CLOTH_H) * 1.2;
    posData[i] = px;
    posData[i + 1] = py;
    posData[i + 2] = 0;
    posData[i + 3] = 1;
    oldPosData[i] = px;
    oldPosData[i + 1] = py;
    oldPosData[i + 2] = 0;
    oldPosData[i + 3] = 1;
  }
}

const posBuf = device.createBuffer({ size: posData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
const oldPosBuf = device.createBuffer({ size: oldPosData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(posBuf, 0, posData);
device.queue.writeBuffer(oldPosBuf, 0, oldPosData);

const indexBuf = device.createBuffer({ size: indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(indexBuf, 0, indices);

const paramsBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
const mvpBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
const mouseBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

// 鼠标追踪
let mx = 0, my = 0, mclick = 0;
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
  my = -((e.clientY - r.top) / r.height - 0.5) * 2;
});
canvas.addEventListener('mousedown', () => mclick = 1);
canvas.addEventListener('mouseup', () => mclick = 0);

// [Pipeline 和 BindGroup 创建...]

function frame() {
  device.queue.writeBuffer(paramsBuf, 0, new Float32Array([1/60, 0.8, 0.99, restLength]));
  device.queue.writeBuffer(mouseBuf, 0, new Float32Array([mx, my, mclick, 0]));

  const enc = device.createCommandEncoder();

  // Compute pass
  const cp = enc.beginComputePass();
  cp.setPipeline(computePipeline);
  cp.setBindGroup(0, computeBG);
  cp.dispatchWorkgroups(Math.ceil(POINT_COUNT / WG));
  cp.end();

  // Render pass
  const rp = enc.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1 },
    }],
  });
  rp.setPipeline(renderPipeline);
  rp.setBindGroup(0, renderBG);
  rp.setVertexBuffer(0, posBuf);
  rp.setIndexBuffer(indexBuf, 'uint32');
  rp.drawIndexed(indices.length);
  rp.end();

  device.queue.submit([enc.finish()]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## Verlet 积分 vs Euler 积分

| 方法 | 公式 | 稳定性 |
|------|------|--------|
| Euler | `pos += vel * dt; vel += acc * dt` | 不稳定，容易爆炸 |
| Verlet | `pos = 2*pos - old + acc*dt²` | 稳定，能量守恒好 |
| Symplectic Euler | `vel += acc * dt; pos += vel * dt` | 中等 |

Verlet 的隐式速度表示让它天然对约束求解友好——拉回约束只需要直接修改位置，不需要修改速度。

## 约束迭代

上面的代码只做了一轮弹簧约束。更稳定的布料需要多轮迭代（Position Based Dynamics 的思路）：

```
for iter in 0..N:
    solve_constraints()
```

迭代越多，布料越硬。3-5 轮通常够用。

## 练习

1. 加入风力：给布料施加一个随时间变化的风向量，让布料飘动。
2. 实现撕裂：如果弹簧拉伸超过某个阈值就断开，模拟布料撕裂效果。
3. 尝试 Position Based Dynamics (PBD) 方法：先预测位置，然后迭代约束修正，最后更新速度。
