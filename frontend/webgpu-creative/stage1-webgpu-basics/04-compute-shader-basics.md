# 计算着色器基础：Compute Shader、工作组与调用

## 为什么渲染管线不够用

渲染管线是为"画三角形"设计的——顶点着色器处理几何体，片段着色器处理像素。但很多时候你需要 GPU 做的事情跟画三角形无关：

- 物理模拟：更新 100 万个粒子的位置
- 图像处理：对一张 4K 图做高斯模糊
- 数据处理：对 1000 万个数排序
- 机器学习：矩阵乘法

用渲染管线做这些事很别扭——你得把数据伪装成"纹理"，把计算伪装成"画一个全屏四边形"。

Compute Shader 就是为通用 GPU 计算设计的。它不经过光栅化，不输出像素，直接在 GPU 上并行执行计算任务。

## 工作组与调用

GPU 上运行 compute shader 的组织方式：

```txt
Dispatch(workgroupsX, workgroupsY, workgroupsZ)
  └─ 每个工作组包含 workgroup_size_x × workgroup_size_y × workgroup_size_z 个调用
      └─ 每个调用是一个独立的着色器实例
```

在 WGSL 里：

```wgsl
@compute @workgroup_size(64, 1, 1)
fn compute_main(@builtin(global_invocation_id) id: vec3u) {
  // id.x 就是当前调用的全局唯一索引
  // 0, 1, 2, ..., workgroupsX * 64 - 1
}
```

`@workgroup_size(64)` 意味着每个工作组有 64 个调用。如果你 `dispatchWorkgroups(1000, 1, 1)`，总共就有 64000 个调用并行执行。

### 为什么 workgroup_size 通常选 64

GPU 的最小调度单位是 warp（NVIDIA）或 wavefront（AMD），通常是 32 或 64 个线程。选 64 是一个安全的默认值，确保一个工作组正好占满一个或两个 warp。

## 实例：并行数组平方

用 compute shader 把一个数组里的每个数求平方。

```html
<!DOCTYPE html>
<html>
<body>
<pre id="output"></pre>
<script type="module">
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const DATA_SIZE = 1024 * 1024; // 100 万个数

const computeShaderCode = /* wgsl */`
  @group(0) @binding(0) var<storage, read> input_data: array<f32>;
  @group(0) @binding(1) var<storage, read_write> output_data: array<f32>;

  @compute @workgroup_size(64)
  fn compute_main(@builtin(global_invocation_id) id: vec3u) {
    let i = id.x;
    if (i >= arrayLength(&input_data)) { return; }
    output_data[i] = input_data[i] * input_data[i];
  }
`;

const shaderModule = device.createShaderModule({ code: computeShaderCode });

const pipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: shaderModule, entryPoint: 'compute_main' },
});

// 准备输入数据
const inputData = new Float32Array(DATA_SIZE);
for (let i = 0; i < DATA_SIZE; i++) {
  inputData[i] = Math.random() * 100;
}

const inputBuffer = device.createBuffer({
  size: inputData.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(inputBuffer, 0, inputData);

const outputBuffer = device.createBuffer({
  size: inputData.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
});

// 用于 readback 的 staging buffer
const stagingBuffer = device.createBuffer({
  size: inputData.byteLength,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
});

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: inputBuffer } },
    { binding: 1, resource: { buffer: outputBuffer } },
  ],
});

// 执行计算
const commandEncoder = device.createCommandEncoder();
const passEncoder = commandEncoder.beginComputePass();
passEncoder.setPipeline(pipeline);
passEncoder.setBindGroup(0, bindGroup);
passEncoder.dispatchWorkgroups(Math.ceil(DATA_SIZE / 64)); // 每工作组 64 个
passEncoder.end();

// 拷贝结果到 staging buffer
commandEncoder.copyBufferToBuffer(
  outputBuffer, 0,
  stagingBuffer, 0,
  inputData.byteLength,
);

device.queue.submit([commandEncoder.finish()]);

// 读回结果
await stagingBuffer.mapAsync(GPUMapMode.READ);
const result = new Float32Array(stagingBuffer.getMappedRange());

const output = document.getElementById('output');
const lines = [];
for (let i = 0; i < 10; i++) {
  lines.push(`input[${i}] = ${inputData[i].toFixed(2)}, output[${i}] = ${result[i].toFixed(2)}`);
}
output.textContent = lines.join('\n');

stagingBuffer.unmap();
</script>
</body>
</html>
```

## 计算流程拆解

### 1. Dispatch vs Draw

渲染管线用 `draw(vertexCount)` 触发，compute 用 `dispatchWorkgroups(x, y, z)` 触发。

```ts
// 渲染：画 3 个顶点
passEncoder.draw(3);

// 计算：调度 1000 个工作组
passEncoder.dispatchWorkgroups(1000, 1, 1);
```

### 2. Readback 流程

GPU 的存储器和 CPU 是隔离的。要从 GPU 拿回数据：

1. Compute shader 写入 `outputBuffer`（STORAGE）
2. 用 `copyBufferToBuffer` 拷贝到 `stagingBuffer`（MAP_READ）
3. `mapAsync` 等待拷贝完成
4. `getMappedRange` 读取数据
5. `unmap` 释放映射

这个流程在后面的课里会反复用到。

### 3. 边界检查

着色器里的 `if (i >= arrayLength(&input_data)) { return; }` 很重要。当你 dispatch 的调用数超过数组长度时，多出来的调用不做任何事就返回。不做这个检查会导致越界写入。

## Shared Memory（工作组共享内存）

工作组内的调用可以共享一块高速内存：

```wgsl
var<workgroup> shared_data: array<f32, 64>;

@compute @workgroup_size(64)
fn main(@builtin(local_invocation_id) local_id: vec3u) {
  shared_data[local_id.x] = some_input[global_id.x];
  workgroupBarrier(); // 等所有调用都写完
  // 现在工作组内所有调用都能读 shared_data
}
```

Shared memory 比 storage buffer 快很多，但只在工作组内有效。后面的并行归约和排序会大量使用它。

## Compute Shader 的执行模型

```txt
dispatchWorkgroups(100, 1, 1)
  ├─ Workgroup 0:  64 个调用（可能并行执行）
  ├─ Workgroup 1:  64 个调用
  ├─ ...
  └─ Workgroup 99: 64 个调用

同一个工作组内的调用：
  - 可以通过 shared memory 通信
  - 可以用 workgroupBarrier() 同步
  - 硬件保证它们"一起启动"

不同工作组之间：
  - 没有任何同步机制
  - 不能通过 shared memory 通信
  - 执行顺序不确定
```

这个模型意味着：如果你的任务需要全局同步（比如排序），你得把计算拆成多个 dispatch，每个 dispatch 之间用 `device.queue.submit` 分隔。

## 练习

1. 修改 workgroup_size 为 `(256, 1, 1)` 和 `(1, 1, 1)`，对比性能差异。
2. 写一个 compute shader，输入一个数组，输出每个位置上"左边所有元素的和"（前缀和）。提示：先从简单版本开始，每个调用串行累加，然后再想并行方案。
3. 用 compute shader 实现一个简单的图像模糊：输入一张纹理（用 storage texture），对每个像素取周围 3x3 的平均值。
