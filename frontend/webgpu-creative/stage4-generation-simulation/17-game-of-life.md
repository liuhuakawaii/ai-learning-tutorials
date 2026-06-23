# 生命游戏：GPU 上的 Conway's Game of Life 变体

## 规则极其简单，行为极其复杂

Conway's Game of Life 的规则只有两条：

1. 活细胞周围有 2-3 个活邻居 → 继续活着，否则死亡
2. 死细胞周围恰好有 3 个活邻居 → 复活

就这两条规则，涌现出 glider（滑翔机）、pulsar（脉冲星）、glider gun（滑翔机枪）等复杂结构。这是**涌现**的经典案例——简单规则产生复杂行为。

## GPU 实现的关键：双缓冲

Game of Life 需要同时读旧状态、写新状态。如果只用一个 buffer，一个调用写入的新值会影响邻居调用的读取，导致竞态条件。

解决方案是 **Ping-Pong**：两个 buffer A 和 B。这一帧从 A 读、写到 B，下一帧从 B 读、写到 A。

## 完整实现

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="canvas" width="800" height="800"></canvas>
<script type="module">
const canvas = document.getElementById('canvas');
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: 'opaque' });

const SIZE = 512;
const WG = 16;

// ──── Compute Shader：Game of Life 步进 ────
const computeCode = /* wgsl */`
  @group(0) @binding(0) var<storage, read> state_in: array<u32>;
  @group(0) @binding(1) var<storage, read_write> state_out: array<u32>;
  @group(0) @binding(2) var<uniform> params: vec4f; // width, height, rule_variant, _

  fn idx(x: i32, y: i32) -> u32 {
    let w = i32(params.x);
    let h = i32(params.y);
    return u32(((y + h) % h) * w + ((x + w) % w)); // 环形边界
  }

  fn count_neighbors(x: i32, y: i32) -> u32 {
    var count = 0u;
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if (dx == 0 && dy == 0) { continue; }
        count += state_in[idx(x + dx, y + dy)];
      }
    }
    return count;
  }

  @compute @workgroup_size(${WG}, ${WG})
  fn life_step(@builtin(global_invocation_id) id: vec3u) {
    let x = i32(id.x);
    let y = i32(id.y);
    if (x >= i32(params.x) || y >= i32(params.y)) { return; }

    let i = idx(x, y);
    let alive = state_in[i];
    let neighbors = count_neighbors(x, y);

    var next = 0u;

    // 标准 Conway 规则
    if (params.z < 0.5) {
      if (alive == 1u) {
        // 活细胞：2 或 3 个邻居存活
        next = select(0u, 1u, neighbors == 2u || neighbors == 3u);
      } else {
        // 死细胞：恰好 3 个邻居复活
        next = select(0u, 1u, neighbors == 3u);
      }
    }
    // HighLife 变体（规则 B36/S23）：多了一条——6 个邻居也能复活
    else {
      if (alive == 1u) {
        next = select(0u, 1u, neighbors == 2u || neighbors == 3u);
      } else {
        next = select(0u, 1u, neighbors == 3u || neighbors == 6u);
      }
    }

    state_out[i] = next;
  }
`;

// ──── Render Shader：可视化 ────
const renderCode = /* wgsl */`
  @group(0) @binding(0) var<storage, read> state: array<u32>;
  @group(0) @binding(1) var<uniform> params: vec4f;
  @group(0) @binding(2) var cell_sampler: sampler;

  struct Vout { @builtin(position) pos: vec4f, @location(0) uv: vec2f };

  @vertex
  fn vs(@builtin(vertex_index) vid: u32) -> Vout {
    let p = array<vec2f, 6>(vec2f(-1,-1),vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(1,1),vec2f(-1,1));
    var out: Vout;
    out.pos = vec4f(p[vid], 0, 1);
    out.uv = p[vid] * 0.5 + 0.5;
    return out;
  }

  @fragment
  fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
    let w = i32(params.x);
    let h = i32(params.y);
    let gx = i32(uv.x * f32(w));
    let gy = i32((1.0 - uv.y) * f32(h));
    let i = u32(clamp(gy, 0, h - 1) * w + clamp(gx, 0, w - 1));
    let alive = f32(state[i]);

    // 细胞颜色
    let bg = vec3f(0.02, 0.02, 0.05);
    let fg = vec3f(0.2, 0.8, 0.4);
    let color = mix(bg, fg, alive);

    // 网格线
    let cell_x = fract(uv.x * f32(w));
    let cell_y = fract((1.0 - uv.y) * f32(h));
    let grid = smoothstep(0.0, 0.02, min(cell_x, cell_y)) *
               smoothstep(0.0, 0.02, min(1.0 - cell_x, 1.0 - cell_y));
    let grid_color = mix(vec3f(0.05, 0.05, 0.1), color, grid);

    return vec4f(grid_color, 1.0);
  }
`;

const computeModule = device.createShaderModule({ code: computeCode });
const renderModule = device.createShaderModule({ code: renderCode });

const computePipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: computeModule, entryPoint: 'life_step' },
});

const renderPipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module: renderModule, entryPoint: 'vs' },
  fragment: {
    module: renderModule,
    entryPoint: 'fs',
    targets: [{ format }],
  },
});

// 初始状态：随机
const initState = new Uint32Array(SIZE * SIZE);
for (let i = 0; i < initState.length; i++) {
  initState[i] = Math.random() > 0.6 ? 1 : 0;
}

// Ping-pong buffers
const bufA = device.createBuffer({
  size: initState.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(bufA, 0, initState);

const bufB = device.createBuffer({
  size: initState.byteLength,
  usage: GPUBufferUsage.STORAGE,
});

const paramsBuffer = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([SIZE, SIZE, 0, 0]));

// 两个 bind group（A→B 和 B→A）
function makeComputeBG(src, dst) {
  return device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: src } },
      { binding: 1, resource: { buffer: dst } },
      { binding: 2, resource: { buffer: paramsBuffer } },
    ],
  });
}

let pingPong = 0;
const bgAB = makeComputeBG(bufA, bufB);
const bgBA = makeComputeBG(bufB, bufA);

// 渲染 bind group
const sampler = device.createSampler();
function makeRenderBG(buf) {
  return device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: buf } },
      { binding: 1, resource: { buffer: paramsBuffer } },
      { binding: 2, resource: sampler },
    ],
  });
}

let stepsPerFrame = 1;

function frame() {
  const enc = device.createCommandEncoder();

  // Compute pass：步进
  for (let s = 0; s < stepsPerFrame; s++) {
    const cp = enc.beginComputePass();
    cp.setPipeline(computePipeline);
    cp.setBindGroup(0, pingPong % 2 === 0 ? bgAB : bgBA);
    cp.dispatchWorkgroups(Math.ceil(SIZE / WG), Math.ceil(SIZE / WG));
    cp.end();
    pingPong++;
  }

  // Render pass：显示
  const currentBuf = pingPong % 2 === 0 ? bufA : bufB;
  const rp = enc.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });
  rp.setPipeline(renderPipeline);
  rp.setBindGroup(0, makeRenderBG(currentBuf));
  rp.draw(6);
  rp.end();

  device.queue.submit([enc.finish()]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## 环形边界

`idx` 函数用取模实现环形边界——网格的左边连着右边，上边连着下边。这相当于在环面上运行 Game of Life。

你也可以用固定边界（边界外全是死细胞）或反射边界。

## Game of Life 的变体

改变出生/存活规则就能得到完全不同的行为：

| 变体 | 出生 | 存活 | 特点 |
|------|------|------|------|
| Conway | 3 | 2,3 | 经典，glider, pulsar |
| HighLife | 3,6 | 2,3 | 有自我复制结构 |
| Day & Night | 3,6,7,8 | 3,4,6,7,8 | 对称（活/死角色互换） |
| Seeds | 2 | 无 | 死细胞，爆炸式扩张 |

## 练习

1. 实现鼠标交互：点击某个格子可以手动设置活/死状态。
2. 加入"年龄"属性：活细胞越老颜色越深，观察老细胞群的视觉效果。
3. 尝试 3D 版 Game of Life：每个细胞有 26 个邻居，规则改为 B5-7/S4-6。
