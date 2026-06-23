# WebGPU vs WebGL

## 一个真实的性能卡顿

你可能遇到过这种场景：一个 WebGL 应用里有几千个物体要绘制，每个物体都需要 `gl.bindBuffer`、`gl.bindTexture`、`gl.uniformXXX`、`gl.drawArrays`。JavaScript 侧每一帧要做成百上千次绑定调用，CPU 把大量时间花在驱动层的状态切换上，GPU 却在等。

这不是你的代码写得烂，而是 WebGL 的架构决定的——它是一个全局状态机，每次 draw call 都要从 JS 侧串行地设置状态。

WebGPU 的核心改进就一句话：**把状态设置变成命令录制，把 draw call 变成批量提交。**

## WebGL 的瓶颈在哪

WebGL 的渲染模型：

```txt
JS: bindBuffer → bindTexture → uniformMatrix → drawArrays
JS: bindBuffer → bindTexture → uniformMatrix → drawArrays
JS: bindBuffer → bindTexture → uniformMatrix → drawArrays
... 重复 N 次
```

每一帧，驱动层都要：
1. 验证每个 GL 调用的参数合法性
2. 同步修改全局状态机
3. 逐个提交 draw call 到 GPU

CPU 和 GPU 之间是串行交接。当 draw call 数量上千时，CPU 成为瓶颈，GPU 大部分时间在等。

## WebGPU 的做法

WebGPU 把渲染分成两步：

```txt
Step 1（录制）：
  encoder.beginRenderPass(...)
  passEncoder.setPipeline(pipeline)
  passEncoder.setBindGroup(0, bindGroup)
  passEncoder.draw(vertexCount)
  passEncoder.end()

Step 2（提交）：
  device.queue.submit([commandEncoder.finish()])
```

区别在于：
- **Render Pipeline 是不可变的**——创建时一次性设置好 shader、顶点布局、混合状态，运行时不能改。驱动层不需要每次 draw call 都验证。
- **Bind Group 是分组绑定**——把相关的资源（buffer、texture、sampler）打包成一个 BindGroup，一次绑定，而不是逐个设置 uniform。
- **Command Encoder 录制命令**——所有绘制指令被录制到 command buffer 里，最后一次性提交给 GPU。CPU 和 GPU 之间是异步的。

## 第一个 WebGPU 程序：画一个三角形

下面是完整的代码。对比你在 WebGL 里做同样的事，感受一下结构差异。

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="canvas" width="800" height="600"></canvas>
<script type="module">
// 1. 初始化
const canvas = document.getElementById('canvas');
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: 'opaque' });

// 2. 着色器
const shaderCode = /* wgsl */`
  struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
  };

  @vertex
  fn vs_main(@location(0) pos: vec2f, @location(1) col: vec3f) -> VertexOutput {
    var out: VertexOutput;
    out.position = vec4f(pos, 0.0, 1.0);
    out.color = col;
    return out;
  }

  @fragment
  fn fs_main(@location(0) color: vec3f) -> @location(0) vec4f {
    return vec4f(color, 1.0);
  }
`;

// 3. 创建 pipeline
const shaderModule = device.createShaderModule({ code: shaderCode });

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module: shaderModule,
    entryPoint: 'vs_main',
    buffers: [{
      arrayStride: 20, // 2 floats pos + 3 floats color = 5 * 4
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x2' },
        { shaderLocation: 1, offset: 8, format: 'float32x3' },
      ],
    }],
  },
  fragment: {
    module: shaderModule,
    entryPoint: 'fs_main',
    targets: [{ format }],
  },
});

// 4. 顶点数据
const vertices = new Float32Array([
  // x,    y,   r,   g,   b
   0.0,  0.5,  1.0, 0.0, 0.0,
  -0.5, -0.5,  0.0, 1.0, 0.0,
   0.5, -0.5,  0.0, 0.0, 1.0,
]);

const vertexBuffer = device.createBuffer({
  size: vertices.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertices);

// 5. 渲染
function render() {
  const commandEncoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const passEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: textureView,
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
    }],
  });

  passEncoder.setPipeline(pipeline);
  passEncoder.setVertexBuffer(0, vertexBuffer);
  passEncoder.draw(3);
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
}

render();
</script>
</body>
</html>
```

## WebGL 等价代码对比

同样画一个彩色三角形，WebGL 的写法：

```js
// WebGL 版本（简化）
const gl = canvas.getContext('webgl2');
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
gl.enableVertexAttribArray(1);
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 20, 8);

gl.useProgram(program);
gl.bindVertexArray(vao);
gl.clearColor(0.1, 0.1, 0.1, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.drawArrays(gl.TRIANGLES, 0, 3);
```

看起来 WebGL 代码更少？这只是最简单的场景。当场景里有 100 个不同材质的物体时：

- **WebGL**：每个物体都要 `useProgram → bindBuffer → uniformXXX → drawArrays`，100 次串行状态切换。
- **WebGPU**：创建 100 个 `BindGroup`，录制 100 条 `setBindGroup + draw` 命令，一次性 `submit`。GPU 自己排队处理。

## 关键架构差异总结

| 维度 | WebGL | WebGPU |
|------|-------|--------|
| 状态模型 | 全局状态机 | Pipeline + BindGroup |
| 命令提交 | 即时模式 | 命令录制 + 批量提交 |
| 着色器语言 | GLSL | WGSL |
| Compute Shader | 不支持（需要扩展） | 原生支持 |
| CPU/GPU 关系 | 同步为主 | 异步，CPU 录制，GPU 执行 |
| 内存管理 | 隐式 | 显式（Buffer、Texture 的创建和销毁） |

## 什么时候不用 WebGPU

- 你的应用只需要画几十个三角形，WebGL 够用
- 你需要兼容老浏览器，WebGPU 目前兼容性还不够（Chrome 113+ 支持）
- 你在做 2D 渲染为主，2D Canvas API 或 WebGL 就足够

WebGPU 的价值在 **GPU 密集型** 场景才体现：大量 draw call、compute shader、物理模拟、光线追踪。后面的课程会一步步展开这些场景。

## 练习

1. 把上面的三角形代码跑起来，修改顶点位置，画一个正方形（两个三角形）。
2. 在 WGSL 着色器里添加一个 `@group(0) @binding(0) var<uniform> time: f32`，让颜色随时间变化（提示：需要创建 uniform buffer，在 JS 侧每帧更新 `time` 值）。
