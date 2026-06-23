# 渲染管线：Vertex → Fragment 的 WGSL 实现

## 从数据到像素

GPU 渲染的本质是一条流水线。你把一堆顶点数据丢进去，经过顶点着色器变换、光栅化插值、片段着色器着色，最终写出像素颜色。

```
顶点数据 → [顶点着色器] → 裁剪 → 光栅化 → [片段着色器] → 帧缓冲
```

顶点着色器负责"这些点在哪"，片段着色器负责"这些像素什么颜色"。中间的光栅化阶段由硬件自动完成——你不用管三角形怎么变成像素。

## 旋转立方体

这一课我们实现一个带 uniform 变换矩阵的旋转立方体。重点理解：
- 顶点缓冲区如何描述几何体
- uniform buffer 如何从 JS 侧传递数据到 WGSL
- MVP（Model-View-Projection）矩阵如何工作

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

const shaderCode = /* wgsl */`
  struct Uniforms {
    mvp: mat4x4f,
  };
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;

  struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
  };

  @vertex
  fn vs_main(@location(0) pos: vec3f, @location(1) col: vec3f) -> VertexOutput {
    var out: VertexOutput;
    out.position = uniforms.mvp * vec4f(pos, 1.0);
    out.color = col;
    return out;
  }

  @fragment
  fn fs_main(@location(0) color: vec3f) -> @location(0) vec4f {
    return vec4f(color, 1.0);
  }
`;

const shaderModule = device.createShaderModule({ code: shaderCode });

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module: shaderModule,
    entryPoint: 'vs_main',
    buffers: [{
      arrayStride: 24, // 3 floats pos + 3 floats color = 6 * 4
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x3' },
      ],
    }],
  },
  fragment: {
    module: shaderModule,
    entryPoint: 'fs_main',
    targets: [{ format }],
  },
  primitive: {
    topology: 'triangle-list',
    cullMode: 'back',
  },
  depthStencil: {
    format: 'depth24plus',
    depthWriteEnabled: true,
    depthCompare: 'less',
  },
});

// 立方体顶点：8 个顶点，6 种颜色（每面一个颜色）
const positions = [
  // 前面
  -1,-1, 1,  1,-1, 1,  1, 1, 1,  -1,-1, 1,  1, 1, 1, -1, 1, 1,
  // 后面
   1,-1,-1, -1,-1,-1, -1, 1,-1,   1,-1,-1, -1, 1,-1,  1, 1,-1,
  // 上面
  -1, 1, 1,  1, 1, 1,  1, 1,-1,  -1, 1, 1,  1, 1,-1, -1, 1,-1,
  // 下面
  -1,-1,-1,  1,-1,-1,  1,-1, 1,  -1,-1,-1,  1,-1, 1, -1,-1, 1,
  // 右面
   1,-1, 1,  1,-1,-1,  1, 1,-1,   1,-1, 1,  1, 1,-1,  1, 1, 1,
  // 左面
  -1,-1,-1, -1,-1, 1, -1, 1, 1,  -1,-1,-1, -1, 1, 1, -1, 1,-1,
];

const faceColors = [
  [1,0,0], [0,1,0], [0,0,1], [1,1,0], [1,0,1], [0,1,1],
];

// 构建带颜色的顶点数组
const vertexData = new Float32Array(36 * 6);
for (let face = 0; face < 6; face++) {
  for (let v = 0; v < 6; v++) {
    const i = face * 6 + v;
    vertexData[i * 6 + 0] = positions[i * 3 + 0];
    vertexData[i * 6 + 1] = positions[i * 3 + 1];
    vertexData[i * 6 + 2] = positions[i * 3 + 2];
    vertexData[i * 6 + 3] = faceColors[face][0];
    vertexData[i * 6 + 4] = faceColors[face][1];
    vertexData[i * 6 + 5] = faceColors[face][2];
  }
}

const vertexBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertexData);

const uniformBuffer = device.createBuffer({
  size: 64, // mat4x4f = 16 * 4 bytes
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const depthTexture = device.createTexture({
  size: [canvas.width, canvas.height],
  format: 'depth24plus',
  usage: GPUBufferUsage.RENDER_ATTACHMENT,
});

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
});

// 简单矩阵工具
function mat4_perspective(fov, aspect, near, far) {
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, far * nf, -1,
    0, 0, far * near * nf, 0,
  ]);
}

function mat4_multiply(a, b) {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[j * 4 + i] =
        a[0 * 4 + i] * b[j * 4 + 0] +
        a[1 * 4 + i] * b[j * 4 + 1] +
        a[2 * 4 + i] * b[j * 4 + 2] +
        a[3 * 4 + i] * b[j * 4 + 3];
    }
  }
  return out;
}

function mat4_rotateY(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([
    c, 0, s, 0,  0, 1, 0, 0,  -s, 0, c, 0,  0, 0, 0, 1,
  ]);
}

function mat4_rotateX(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([
    1, 0, 0, 0,  0, c, -s, 0,  0, s, c, 0,  0, 0, 0, 1,
  ]);
}

const proj = mat4_perspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 100);

function frame(time) {
  const t = time / 1000;
  const view = new Float32Array([
    1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-5,1,
  ]);
  const model = mat4_multiply(mat4_rotateY(t), mat4_rotateX(t * 0.7));
  const mvp = mat4_multiply(proj, mat4_multiply(view, model));
  device.queue.writeBuffer(uniformBuffer, 0, mvp);

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1 },
    }],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
      depthClearValue: 1.0,
    },
  });

  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.setVertexBuffer(0, vertexBuffer);
  passEncoder.draw(36);
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## 管线的关键概念

### 顶点缓冲区布局

`arrayStride` 和 `attributes` 告诉 GPU 如何从你的 buffer 里读取顶点数据。这个立方体用交错布局（interleaved）：`[pos.x, pos.y, pos.z, col.r, col.g, col.b]`。

你也可以用分离布局（separate buffers）——位置一个 buffer，颜色一个 buffer。交错布局对缓存更友好，分离布局更灵活。

### Uniform Buffer

Uniform 是从 CPU 传到 GPU 的常量数据。这里传的是 MVP 矩阵，每帧更新一次。Uniform buffer 有大小限制（通常 64KB），适合传变换矩阵、时间、光照参数这类小数据。

大数据要用 Storage Buffer（下一课讲）。

### 深度缓冲

没有深度缓冲，立方体背面的面会覆盖前面的面。`depth24plus` 格式每个像素用 24 位存深度值。`depthCompare: 'less'` 表示只有更近的像素才能通过深度测试。

### 背面剔除

`cullMode: 'back'` 告诉 GPU 不要渲染背对摄像机的三角形。这是性能优化——立方体有 12 个三角形，任意时刻最多只能看到 6 个。

## WGSL 里的矩阵运算

注意 WGSL 的矩阵是**列主序**（column-major），和 WebGL 的 GLSL 一样。`mat4x4f` 的内存布局是：

```wgsl
// column 0: bytes 0-15
// column 1: bytes 16-31
// column 2: bytes 32-47
// column 3: bytes 63-63
```

JS 侧写入 `Float32Array` 时也要按列主序排列。上面的 `mat4_multiply` 函数就是按列主序写的。

## 练习

1. 给立方体加上法线数据，在片段着色器里做简单的方向光照（Lambert diffuse）。
2. 试试 `topology: 'line-list'` 和 `topology: 'point-list'`，观察立方体的线框和点表示。
3. 修改 MVP 矩阵里的 view 部分，实现鼠标控制摄像机旋转（提示：监听 `mousemove`，用鼠标偏移量控制 `rotateX` 和 `rotateY`）。
