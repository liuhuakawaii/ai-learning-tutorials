# 并行归约：GPU 上的累加 / 最大值 / 直方图

## 从串行到并行的思维转换

在 CPU 上，对数组求和很简单：

```js
let sum = 0;
for (let i = 0; i < n; i++) sum += arr[i];
```

这是一个 O(n) 的串行操作。你不能在 GPU 上用同样的方式做——GPU 有成千上万个核心，它们不擅长串行累加，但擅长并行工作。

并行归约的核心思想：**把一个大问题拆成很多小问题，各自计算，然后合并结果。**

```
输入: [1, 2, 3, 4, 5, 6, 7, 8]

第 1 轮: [1+2, 3+4, 5+6, 7+8] = [3, 7, 11, 15]
第 2 轮: [3+7, 11+15] = [10, 26]
第 3 轮: [10+26] = [36]
```

每一轮，活跃的调用数减半，直到只剩一个结果。这是 log(n) 轮，每轮 O(1) 并行。

## Shared Memory 归约

同一工作组内的归约通过 shared memory 实现：

```wgsl
var<workgroup> shared_data: array<f32, 256>;

@compute @workgroup_size(256)
fn reduce(@builtin(local_invocation_id) local_id: vec3u,
          @builtin(global_invocation_id) global_id: vec3u) {
  // 第一步：每个调用把自己的数据加载到 shared memory
  shared_data[local_id.x] = input[global_id.x];
  workgroupBarrier();

  // 第二步：归约（步长不断减半）
  for (var stride = 128u; stride > 0u; stride >>= 1u) {
    if (local_id.x < stride) {
      shared_data[local_id.x] += shared_data[local_id.x + stride];
    }
    workgroupBarrier();
  }

  // 第三步：工作组结果写到输出
  if (local_id.x == 0u) {
    output[workgroup_id.x] = shared_data[0];
  }
}
```

## 完整实现：数组求和

```html
<!DOCTYPE html>
<html>
<body>
<pre id="output"></pre>
<script type="module">
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const DATA_SIZE = 1024 * 1024;
const WORKGROUP_SIZE = 256;
const WORKGROUP_COUNT = Math.ceil(DATA_SIZE / WORKGROUP_SIZE);

const shaderCode = /* wgsl */`
  @group(0) @binding(0) var<storage, read> input_data: array<f32>;
  @group(0) @binding(1) var<storage, read_write> output_data: array<f32>;
  @group(0) @binding(2) var<uniform> params: vec4u; // data_size, _, _, _

  var<workgroup> shared_mem: array<f32, ${WORKGROUP_SIZE}>;

  @compute @workgroup_size(${WORKGROUP_SIZE})
  fn reduce_sum(@builtin(local_invocation_id) local_id: vec3u,
                @builtin(global_invocation_id) global_id: vec3u,
                @builtin(workgroup_id) wg_id: vec3u) {
    let i = global_id.x;
    // 加载数据，越界填 0
    shared_mem[local_id.x] = select(0.0, input_data[i], i < params.x);
    workgroupBarrier();

    // 归约
    for (var stride = ${WORKGROUP_SIZE / 2}u; stride > 0u; stride >>= 1u) {
      if (local_id.x < stride) {
        shared_mem[local_id.x] += shared_mem[local_id.x + stride];
      }
      workgroupBarrier();
    }

    if (local_id.x == 0u) {
      output_data[wg_id.x] = shared_mem[0];
    }
  }
`;

const shaderModule = device.createShaderModule({ code: shaderCode });

const pipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: shaderModule, entryPoint: 'reduce_sum' },
});

// 输入数据
const inputData = new Float32Array(DATA_SIZE);
let expectedSum = 0;
for (let i = 0; i < DATA_SIZE; i++) {
  inputData[i] = Math.random() * 10;
  expectedSum += inputData[i];
}

const inputBuffer = device.createBuffer({
  size: inputData.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(inputBuffer, 0, inputData);

// 中间结果 buffer（一个工作组一个结果）
const intermediateBuffer = device.createBuffer({
  size: WORKGROUP_COUNT * 4,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
});

const paramsBuffer = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([DATA_SIZE, 0, 0, 0]));

const stagingBuffer = device.createBuffer({
  size: WORKGROUP_COUNT * 4,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
});

// Pass 1：并行归约到工作组级别
const bindGroup1 = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: inputBuffer } },
    { binding: 1, resource: { buffer: intermediateBuffer } },
    { binding: 2, resource: { buffer: paramsBuffer } },
  ],
});

// 如果工作组数量 > WORKGROUP_SIZE，需要多轮归约
// 这里假设 WORKGROUP_COUNT <= WORKGROUP_SIZE，两轮就够了
const outputBuffer = device.createBuffer({
  size: 4,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
});

const bindGroup2 = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: intermediateBuffer } },
    { binding: 1, resource: { buffer: outputBuffer } },
    { binding: 2, resource: { buffer: paramsBuffer } },
  ],
});

// 执行
const encoder = device.createCommandEncoder();

// Pass 1: DATA_SIZE → WORKGROUP_COUNT 个部分和
const pass1 = encoder.beginComputePass();
pass1.setPipeline(pipeline);
pass1.setBindGroup(0, bindGroup1);
pass1.dispatchWorkgroups(WORKGROUP_COUNT);
pass1.end();

// Pass 2: WORKGROUP_COUNT → 1 个最终和
device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([WORKGROUP_COUNT, 0, 0, 0]));
const pass2 = encoder.beginComputePass();
pass2.setPipeline(pipeline);
pass2.setBindGroup(0, bindGroup2);
pass2.dispatchWorkgroups(1);
pass2.end();

encoder.copyBufferToBuffer(outputBuffer, 0, stagingBuffer, 0, 4);
device.queue.submit([encoder.finish()]);

await stagingBuffer.mapAsync(GPUMapMode.READ);
const gpuSum = new Float32Array(stagingBuffer.getMappedRange())[0];
stagingBuffer.unmap();

document.getElementById('output').textContent = [
  `CPU sum:  ${expectedSum.toFixed(4)}`,
  `GPU sum:  ${gpuSum.toFixed(4)}`,
  `误差:     ${Math.abs(expectedSum - gpuSum).toFixed(4)}`,
  `数据量:   ${DATA_SIZE.toLocaleString()} 个浮点数`,
].join('\n');
</script>
</body>
</html>
```

## 多轮归约

当数据量很大时，第一轮归约产生的部分和可能还超过一个工作组的容量。解决方案是多轮：

```
第 1 轮：N 个元素 → N/256 个部分和
第 2 轮：N/256 个元素 → N/65536 个部分和
...直到结果能放进一个工作组
```

100 万个元素需要 2 轮（1000000 → 4096 → 16）。10 亿个元素需要 3 轮。

## 除了求和还能归约什么

同样的模式，换一下归约操作就行：

```wgsl
// 最大值
shared_mem[local_id.x] = max(shared_mem[local_id.x], shared_mem[local_id.x + stride]);

// 最小值
shared_mem[local_id.x] = min(shared_mem[local_id.x], shared_mem[local_id.x + stride]);

// 乘积
shared_mem[local_id.x] *= shared_mem[local_id.x + stride];
```

直方图稍微复杂一些——每个 bin 需要原子操作：

```wgsl
@group(0) @binding(0) var<storage, read_write> histogram: array<atomic<u32>>;

@compute @workgroup_size(256)
fn hist(@builtin(global_invocation_id) id: vec3u) {
  let value = input_data[id.x];
  let bin = u32(value * 256.0);
  atomicAdd(&histogram[bin], 1u);
}
```

## 性能注意事项

1. **Bank Conflict**：Shared memory 按 32 个 bank 组织。如果多个调用访问同一个 bank 的不同地址，会产生冲突。步长为 1 的归约不会冲突，但某些模式会。
2. **Divergent Branching**：`if (local_id.x < stride)` 在归约后期会让很多调用空闲。这是正常的——归约本身就是活跃调用逐轮减半的过程。
3. **Occupancy**：workgroup_size 太大（比如 1024）会减少同时运行的工作组数量，降低 GPU 利用率。256 是一个常用折中。

## 练习

1. 实现并行最大值归约：找到数组中的最大值。
2. 实现直方图：输入 0-1 之间的浮点数，统计每个区间的数量（256 个 bin）。
3. 挑战：实现并行前缀和（prefix sum），也叫 scan。提示：先做 up-sweep（归约），再做 down-sweep。
