# 机器学习推理：WebGPU 上的模型推理

## 为什么在浏览器里跑 ML 模型

- **隐私**：数据不离开用户设备
- **延迟**：不需要网络往返
- **离线**：没有网络也能用
- **成本**：不需要服务器端 GPU

WebGPU Compute Shader 可以高效执行矩阵乘法——这是神经网络的核心操作。

## 矩阵乘法的 GPU 实现

神经网络的每一层本质上是 `output = weights × input + bias`，就是一个矩阵乘法。

GPU 上的矩阵乘法有多种实现方式：

1. **朴素版**：每个调用计算输出矩阵的一个元素
2. **Shared Memory 版**：工作组协作加载子矩阵到共享内存
3. **Tiled 版**：把矩阵分块，减少全局内存访问

## 完整实现：前馈神经网络推理

这个例子实现一个简单的全连接网络推理，识别手写数字（28×28 灰度图）。

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="canvas" width="280" height="280"></canvas>
<pre id="output"></pre>
<script type="module">
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

// ──── 矩阵乘法 Compute Shader ────
const matmulCode = /* wgsl */`
  struct Params {
    M: u32,  // 输出维度
    K: u32,  // 输入维度
    N: u32,  // batch size (通常 1)
    _pad: u32,
  };
  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var<storage, read> A: array<f32>;  // weights [M × K]
  @group(0) @binding(2) var<storage, read> B: array<f32>;  // input [K × N]
  @group(0) @binding(3) var<storage, read_write> C: array<f32>; // output [M × N]

  // Shared memory 矩阵乘法
  const TILE = 16u;
  var<workgroup> tileA: array<f32, 256>; // 16×16
  var<workgroup> tileB: array<f32, 256>; // 16×16

  @compute @workgroup_size(16, 16)
  fn matmul(@builtin(global_invocation_id) gid: vec3u,
            @builtin(local_invocation_id) lid: vec3u,
            @builtin(workgroup_id) wid: vec3u) {
    let row = gid.y;
    let col = gid.x;
    let M = params.M;
    let K = params.K;
    let N = params.N;

    var sum = 0.0;
    let num_tiles = (K + TILE - 1u) / TILE;

    for (var t = 0u; t < num_tiles; t++) {
      // 协作加载子矩阵到 shared memory
      let a_col = t * TILE + lid.x;
      let b_row = t * TILE + lid.y;

      if (row < M && a_col < K) {
        tileA[lid.y * TILE + lid.x] = A[row * K + a_col];
      } else {
        tileA[lid.y * TILE + lid.x] = 0.0;
      }

      if (b_row < K && col < N) {
        tileB[lid.y * TILE + lid.x] = B[b_row * N + col];
      } else {
        tileB[lid.y * TILE + lid.x] = 0.0;
      }

      workgroupBarrier();

      // 计算子矩阵的部分积
      for (var k = 0u; k < TILE; k++) {
        sum += tileA[lid.y * TILE + k] * tileB[k * TILE + lid.x];
      }

      workgroupBarrier();
    }

    if (row < M && col < N) {
      C[row * N + col] = sum;
    }
  }
`;

// ──── 激活函数 Compute Shader ────
const reluCode = /* wgsl */`
  @group(0) @binding(0) var<storage, read_write> data: array<f32>;

  @compute @workgroup_size(256)
  fn relu(@builtin(global_invocation_id) id: vec3u) {
    if (id.x >= arrayLength(&data)) { return; }
    data[id.x] = max(0.0, data[id.x]);
  }
`;

const softmaxCode = /* wgsl */`
  @group(0) @binding(0) var<storage, read_write> data: array<f32>;
  @group(0) @binding(1) var<uniform> size: vec4u;

  @compute @workgroup_size(1)
  fn softmax() {
    let n = size.x;
    // 找最大值（数值稳定）
    var max_val = -1e30;
    for (var i = 0u; i < n; i++) {
      max_val = max(max_val, data[i]);
    }
    // 计算 exp 和 sum
    var sum = 0.0;
    for (var i = 0u; i < n; i++) {
      data[i] = exp(data[i] - max_val);
      sum += data[i];
    }
    // 归一化
    for (var i = 0u; i < n; i++) {
      data[i] /= sum;
    }
  }
`;

// ──── 网络结构 ────
// 784 → 256 → 128 → 10
// 两层全连接 + ReLU + Softmax 输出

// 预训练权重（随机初始化，实际应用中从文件加载）
const layer1_weights = new Float32Array(256 * 784);
const layer1_bias = new Float32Array(256);
const layer2_weights = new Float32Array(128 * 256);
const layer2_bias = new Float32Array(128);
const layer3_weights = new Float32Array(10 * 128);
const layer3_bias = new Float32Array(10);

// 填充随机权重（实际应用中从 ONNX 文件加载）
[layer1_weights, layer2_weights, layer3_weights].forEach(w => {
  for (let i = 0; i < w.length; i++) w[i] = (Math.random() - 0.5) * 0.1;
});

// 创建 GPU buffers
function createStorageBuffer(data) {
  const buf = device.createBuffer({
    size: data.byteLength || data,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  if (data instanceof Float32Array) device.queue.writeBuffer(buf, 0, data);
  return buf;
}

const w1Buf = createStorageBuffer(layer1_weights);
const b1Buf = createStorageBuffer(layer1_bias);
const w2Buf = createStorageBuffer(layer2_weights);
const b2Buf = createStorageBuffer(layer2_bias);
const w3Buf = createStorageBuffer(layer3_weights);
const b3Buf = createStorageBuffer(layer3_bias);

const inputBuf = createStorageBuffer(784 * 4);
const h1Buf = createStorageBuffer(256 * 4);
const h2Buf = createStorageBuffer(128 * 4);
const outputBuf = createStorageBuffer(10 * 4);

const paramsBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
const sizeBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

// 创建 pipelines
const matmulModule = device.createShaderModule({ code: matmulCode });
const reluModule = device.createShaderModule({ code: reluCode });
const softmaxModule = device.createShaderModule({ code: softmaxCode });

const matmulPipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: matmulModule, entryPoint: 'matmul' },
});
const reluPipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: reluModule, entryPoint: 'relu' },
});
const softmaxPipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: softmaxModule, entryPoint: 'softmax' },
});

// 推理函数
function infer(inputData) {
  device.queue.writeBuffer(inputBuf, 0, inputData);

  const enc = device.createCommandEncoder();

  // Layer 1: matmul + relu
  // output = weights(256×784) × input(784×1) + bias
  device.queue.writeBuffer(paramsBuf, 0, new Uint32Array([256, 784, 1, 0]));
  const bg1 = device.createBindGroup({
    layout: matmulPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: w1Buf } },
      { binding: 2, resource: { buffer: inputBuf } },
      { binding: 3, resource: { buffer: h1Buf } },
    ],
  });
  let p = enc.beginComputePass();
  p.setPipeline(matmulPipeline);
  p.setBindGroup(0, bg1);
  p.dispatchWorkgroups(Math.ceil(1 / 16), Math.ceil(256 / 16));
  p.end();

  // ReLU
  const bgRelu1 = device.createBindGroup({
    layout: reluPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: h1Buf } }],
  });
  p = enc.beginComputePass();
  p.setPipeline(reluPipeline);
  p.setBindGroup(0, bgRelu1);
  p.dispatchWorkgroups(Math.ceil(256 / 256));
  p.end();

  // Layer 2: matmul + relu
  device.queue.writeBuffer(paramsBuf, 0, new Uint32Array([128, 256, 1, 0]));
  const bg2 = device.createBindGroup({
    layout: matmulPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: w2Buf } },
      { binding: 2, resource: { buffer: h1Buf } },
      { binding: 3, resource: { buffer: h2Buf } },
    ],
  });
  p = enc.beginComputePass();
  p.setPipeline(matmulPipeline);
  p.setBindGroup(0, bg2);
  p.dispatchWorkgroups(Math.ceil(1 / 16), Math.ceil(128 / 16));
  p.end();

  const bgRelu2 = device.createBindGroup({
    layout: reluPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: h2Buf } }],
  });
  p = enc.beginComputePass();
  p.setPipeline(reluPipeline);
  p.setBindGroup(0, bgRelu2);
  p.dispatchWorkgroups(Math.ceil(128 / 256));
  p.end();

  // Layer 3: matmul + softmax
  device.queue.writeBuffer(paramsBuf, 0, new Uint32Array([10, 128, 1, 0]));
  const bg3 = device.createBindGroup({
    layout: matmulPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: w3Buf } },
      { binding: 2, resource: { buffer: h2Buf } },
      { binding: 3, resource: { buffer: outputBuf } },
    ],
  });
  p = enc.beginComputePass();
  p.setPipeline(matmulPipeline);
  p.setBindGroup(0, bg3);
  p.dispatchWorkgroups(1, 1);
  p.end();

  device.queue.writeBuffer(sizeBuf, 0, new Uint32Array([10, 0, 0, 0]));
  const bgSoftmax = device.createBindGroup({
    layout: softmaxPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: outputBuf } },
      { binding: 1, resource: { buffer: sizeBuf } },
    ],
  });
  p = enc.beginComputePass();
  p.setPipeline(softmaxPipeline);
  p.setBindGroup(0, bgSoftmax);
  p.dispatchWorkgroups(1);
  p.end();

  device.queue.submit([enc.finish()]);
}

// [Canvas 绘图交互 + 推理调用...]
</script>
</body>
</html>
```

## 性能对比

| 方案 | 矩阵乘法实现 | 推理速度 |
|------|------------|---------|
| CPU (JS) | 纯 JS 循环 | ~10ms |
| WebGL | 纹理 + 片段着色器 | ~5ms |
| WebGPU | Compute Shader | ~1ms |
| ONNX Runtime Web | WebGPU 后端 | ~0.5ms |

WebGPU compute shader 在矩阵乘法上比 WebGL 快 5-10 倍，因为：
- Compute shader 可以用 shared memory 做 tiling
- 不需要把数据伪装成纹理
- 更好的线程调度

## 练习

1. 实现卷积层：把卷积操作转化为矩阵乘法（im2col 方法）。
2. 加载一个真实的 ONNX 模型文件，解析权重并执行推理。
3. 实现批处理推理——同时处理多张图片，观察吞吐量变化。
