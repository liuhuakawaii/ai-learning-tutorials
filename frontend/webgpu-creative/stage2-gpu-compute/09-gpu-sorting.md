# 排序：GPU 并行排序（Bitonic Sort）

## 为什么 GPU 不能用快速排序

快速排序是分治算法——每一步都要根据 pivot 把数组分成两半，下一步依赖上一步的结果。这种**串行依赖**在 GPU 上是灾难——几千个核心只能排队等 pivot 分完。

GPU 排序需要一种**完全并行**的算法：每一步里，所有比较-交换操作可以同时进行，互不依赖。

Bitonic Sort（双调排序）就是这种算法。

## 什么是双调序列

一个序列是双调的（bitonic），如果它先递增后递减（或者先递减后递增）。比如 `[1, 3, 5, 4, 2]` 就是双调的。

Bitonic Sort 的核心性质：**把一个双调序列做一次"蝴蝶"操作，就能分成两个独立的子序列，各自也是双调的。** 递归下去，直到序列长度为 1。

```
n=8 的 Bitonic Sort 步骤：

第 1 轮（步长 2）：  比较距离 2 的元素，交替升序/降序
第 2 轮（步长 4）：  比较距离 4 的元素
第 3 轮（步长 8）：  比较距离 8 的元素
```

总共有 log(n) 轮，每轮有 log(n) 个子步骤。每步里，所有比较-交换对可以并行执行。

## 完整实现

```html
<!DOCTYPE html>
<html>
<body>
<pre id="output"></pre>
<script type="module">
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const N = 1024 * 64; // 必须是 2 的幂
const WORKGROUP_SIZE = 256;

const shaderCode = /* wgsl */`
  @group(0) @binding(0) var<storage, read_write> data: array<u32>;
  @group(0) @binding(1) var<uniform> params: vec4u; // stage, step, _, _

  @compute @workgroup_size(${WORKGROUP_SIZE})
  fn bitonic_sort(@builtin(global_invocation_id) id: vec3u) {
    let i = id.x;
    if (i >= arrayLength(&data)) { return; }

    let stage = params.x;
    let step = params.y;

    // 计算当前元素的伙伴
    let block_size = 1u << (stage + 1u);
    let half_block = 1u << step;
    let block_idx = i / block_size;
    let in_block = i % block_size;

    // 确定比较方向（升序/降序交替）
    let ascending = (i / half_block) % 2u == 0u;

    // 计算伙伴索引
    var partner: u32;
    if (in_block < half_block) {
      partner = i + half_block;
    } else {
      partner = i - half_block;
    }

    if (partner >= arrayLength(&data)) { return; }

    // 比较-交换
    let a = data[i];
    let b = data[partner];

    if (ascending) {
      if (a > b && i < partner) {
        data[i] = b;
        data[partner] = a;
      }
    } else {
      if (a < b && i < partner) {
        data[i] = b;
        data[partner] = a;
      }
    }
  }
`;

const shaderModule = device.createShaderModule({ code: shaderCode });

const pipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: shaderModule, entryPoint: 'bitonic_sort' },
});

// 输入数据
const inputData = new Uint32Array(N);
for (let i = 0; i < N; i++) {
  inputData[i] = Math.floor(Math.random() * N * 10);
}

const dataBuffer = device.createBuffer({
  size: inputData.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(dataBuffer, 0, inputData);

const paramsBuffer = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const stagingBuffer = device.createBuffer({
  size: inputData.byteLength,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
});

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: dataBuffer } },
    { binding: 1, resource: { buffer: paramsBuffer } },
  ],
});

// 执行排序
const numStages = Math.log2(N);
const encoder = device.createCommandEncoder();

for (let stage = 0; stage < numStages; stage++) {
  for (let step = stage; step >= 0; step--) {
    const params = new Uint32Array([stage, step, 0, 0]);
    device.queue.writeBuffer(paramsBuffer, 0, params);

    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(N / WORKGROUP_SIZE));
    pass.end();
  }
}

encoder.copyBufferToBuffer(dataBuffer, 0, stagingBuffer, 0, inputData.byteLength);
device.queue.submit([encoder.finish()]);

await stagingBuffer.mapAsync(GPUMapMode.READ);
const result = new Uint32Array(stagingBuffer.getMappedRange().slice());
stagingBuffer.unmap();

// 验证
const cpuSorted = [...inputData].sort((a, b) => a - b);
let correct = true;
for (let i = 0; i < N; i++) {
  if (result[i] !== cpuSorted[i]) { correct = false; break; }
}

document.getElementById('output').textContent = [
  `数据量: ${N.toLocaleString()} 个元素`,
  `GPU 排序结果: ${correct ? '正确 ✓' : '错误 ✗'}`,
  `前 20 个: ${Array.from(result.slice(0, 20)).join(', ')}`,
  `总 dispatch 次数: ${numStages * (numStages + 1) / 2}`,
].join('\n');
</script>
</body>
</html>
```

## Bitonic Sort 的代价

Bitonic Sort 的比较-交换次数是 O(n log²n)，比快速排序的 O(n log n) 多了一个 log n 因子。但它在 GPU 上更快，因为：

1. **每一步完全并行**——所有比较-交换同时执行
2. **没有分支**——整个算法是确定性的
3. **内存访问模式规则**——对 GPU 缓存友好

## 为什么需要这么多 Dispatch

排序过程被拆成很多个小的 compute dispatch：

```
stage 0: step 0 → 1 个 dispatch
stage 1: step 1, step 0 → 2 个 dispatch
stage 2: step 2, step 1, step 0 → 3 个 dispatch
...
```

总计 log(n) × (log(n) + 1) / 2 个 dispatch。每个 dispatch 之间，GPU 需要完成上一步的所有写入才能开始下一步——这是全局同步点。

## 练习

1. 把排序结果可视化：排序前用随机颜色，排序后用渐变色，对比视觉效果。
2. 修改算法实现降序排序。
3. 挑战：实现 Radix Sort——每轮按一个 bit 分桶，用 compute shader 的原子操作做前缀和。
