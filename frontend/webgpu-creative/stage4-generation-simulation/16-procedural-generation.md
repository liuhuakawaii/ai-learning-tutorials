# 程序化生成：噪声与分形的 GPU 实现

## 为什么需要程序化生成

游戏里那些看起来自然的地形、云彩、木纹、大理石——很多不是美术手绘的，而是用数学噪声函数生成的。程序化生成的好处：

- 几乎零内存占用（不存纹理，运行时计算）
- 无限分辨率（放大后不会模糊）
- 参数可控（改一个种子就变一种地形）

核心工具是 **Perlin 噪声** 和它的叠加版本 **fBm（分形布朗运动）**。

## Perlin 噪声

Ken Perlin 在 1983 年发明的算法。核心思路：

1. 把空间划分成网格，每个格点分配一个随机梯度向量
2. 对于任意点，找到它所在的网格单元
3. 计算该点到四个角（2D）的向量，与对应梯度做点积
4. 用平滑插值（hermite 插值）混合四个角的值

```wgsl
// 哈希函数：给网格坐标生成伪随机梯度
fn hash2(p: vec2f) -> vec2f {
  let k = vec2f(127.1, 311.7);
  return fract(sin(vec2f(dot(p, k), dot(p, k.yx + vec2f(1.0)))) * 43758.5453) * 2.0 - 1.0;
}

// 2D Perlin 噪声
fn perlin(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f); // hermite 平滑

  let a = dot(hash2(i + vec2f(0, 0)), f - vec2f(0, 0));
  let b = dot(hash2(i + vec2f(1, 0)), f - vec2f(1, 0));
  let c = dot(hash2(i + vec2f(0, 1)), f - vec2f(0, 1));
  let d = dot(hash2(i + vec2f(1, 1)), f - vec2f(1, 1));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
```

## fBm（分形布朗运动）

fBm 就是把多个不同频率和振幅的噪声叠加：

```
fBm(p) = noise(p) + 0.5 * noise(2p) + 0.25 * noise(4p) + 0.125 * noise(8p) + ...
```

每一层叫一个"octave"。频率翻倍（细节更细），振幅减半（影响更小）。这就是分形——放大后看到的结构和整体相似。

## 完整实现：程序化地形纹理

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

const shaderCode = /* wgsl */`
  @group(0) @binding(0) var output: texture_storage_2d<rgba8unorm, write>;
  @group(0) @binding(1) var<uniform> params: vec4f; // seed, octaves, lacunarity, gain

  fn hash2(p: vec2f) -> vec2f {
    let k = vec2f(127.1, 311.7);
    return fract(sin(vec2f(dot(p, k), dot(p, k.yx + vec2f(1.0)))) * 43758.5453) * 2.0 - 1.0;
  }

  fn perlin(p: vec2f) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    let a = dot(hash2(i + vec2f(0, 0)), f - vec2f(0, 0));
    let b = dot(hash2(i + vec2f(1, 0)), f - vec2f(1, 0));
    let c = dot(hash2(i + vec2f(0, 1)), f - vec2f(0, 1));
    let d = dot(hash2(i + vec2f(1, 1)), f - vec2f(1, 1));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  fn fbm(p_in: vec2f) -> f32 {
    var p = p_in;
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    let octaves = i32(params.y);
    let lacunarity = params.z;
    let gain = params.w;

    for (var i = 0; i < octaves; i++) {
      value += amplitude * perlin(p * frequency);
      frequency *= lacunarity;
      amplitude *= gain;
    }
    return value;
  }

  // 程序化地形颜色
  fn terrain_color(height: f32, moisture: f32) -> vec3f {
    // 水
    if (height < -0.1) { return vec3f(0.1, 0.2, 0.5); }
    // 沙滩
    if (height < 0.0) { return vec3f(0.76, 0.70, 0.50); }
    // 草地
    if (height < 0.3) {
      let t = smoothstep(0.0, 0.3, height);
      return mix(vec3f(0.2, 0.5, 0.1), vec3f(0.1, 0.4, 0.05), t);
    }
    // 森林
    if (height < 0.5) { return vec3f(0.05, 0.3, 0.05); }
    // 岩石
    if (height < 0.7) { return vec3f(0.4, 0.35, 0.3); }
    // 雪
    return vec3f(0.9, 0.9, 0.95);
  }

  @compute @workgroup_size(8, 8)
  fn generate(@builtin(global_invocation_id) id: vec3u) {
    let size = textureDimensions(output);
    if (id.x >= size.x || id.y >= size.y) { return; }

    let uv = vec2f(f32(id.x), f32(id.y)) / vec2f(f32(size.x), f32(size.y));
    let seed = params.x;

    // 高度图
    let height = fbm(uv * 4.0 + vec2f(seed));
    // 湿度图（用不同偏移的噪声）
    let moisture = fbm(uv * 3.0 + vec2f(seed + 100.0)) * 0.5 + 0.5;

    var color = terrain_color(height, moisture);

    // 添加细节噪声（模拟纹理变化）
    let detail = perlin(uv * 20.0 + vec2f(seed + 50.0)) * 0.05;
    color += detail;

    textureStore(output, vec2i(id.xy), vec4f(clamp(color, vec3f(0.0), vec3f(1.0)), 1.0));
  }
`;

const shaderModule = device.createShaderModule({ code: shaderCode });
const pipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: shaderModule, entryPoint: 'generate' },
});

const outputTexture = device.createTexture({
  size: [512, 512],
  format: 'rgba8unorm',
  usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
});

const paramsBuffer = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: outputTexture.createView() },
    { binding: 1, resource: { buffer: paramsBuffer } },
  ],
});

// 参数：seed=42, octaves=6, lacunarity=2.0, gain=0.5
device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([42, 6, 2.0, 0.5]));

const encoder = device.createCommandEncoder();
const pass = encoder.beginComputePass();
pass.setPipeline(pipeline);
pass.setBindGroup(0, bindGroup);
pass.dispatchWorkgroups(Math.ceil(512 / 8), Math.ceil(512 / 8));
pass.end();
device.queue.submit([encoder.finish()]);

// 用 canvas 2D 显示结果（或用 WebGPU 渲染管线采样纹理）
const imgBitmap = await createImageBitmap(
  await (await fetch(outputTexture)).blob()
);
// ... 实际需要用 WebGPU 渲染管线把纹理画到 canvas
</script>
</body>
</html>
```

## fBm 参数的影响

| 参数 | 作用 | 典型值 |
|------|------|--------|
| octaves | 叠加层数，越多细节越丰富 | 4-8 |
| lacunarity | 频率倍增系数 | 2.0 |
| gain | 振幅衰减系数 | 0.5 |

`lacunarity > 2.0` 会让高频细节更突出（更"粗糙"），`gain < 0.5` 会让地形更平滑。

## 其他噪声变体

- **Simplex 噪声**：Perlin 的改进版，计算更快，没有方向性伪影
- **Worley 噪声**（Voronoi 噪声）：产生蜂窝状图案，适合做石头、细胞纹理
- **Warped fBm**：用噪声扭曲坐标，产生更有机的形状

## 练习

1. 修改 fBm 参数，生成不同风格的地形——沙漠、雪山、火山。
2. 实现 3D 噪声（`perlin` 函数多一个 z 维度），用它生成程序化体积云。
3. 实现 Worley 噪声：对每个像素，找到最近的随机点和第二近的点，用距离差做图案。
