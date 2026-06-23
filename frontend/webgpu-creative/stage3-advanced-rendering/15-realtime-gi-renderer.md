# 阶段实战：构建带全局光照的实时渲染器

## 整合 Stage 3 的所有技术

这一课把延迟渲染、阴影、SSAO、Bloom 后处理整合成一个完整的渲染管线。

```
渲染流程：
Pass 0: Shadow Map（从光源视角渲染深度）
Pass 1: G-Buffer（几何体写位置/法线/颜色/深度）
Pass 2: SSAO（计算环境光遮蔽）
Pass 3: SSAO 模糊（消除噪点）
Pass 4: 光照（读 G-Buffer + Shadow Map + SSAO，计算最终颜色）
Pass 5: Bloom 亮区提取
Pass 6: Bloom 水平模糊
Pass 7: Bloom 垂直模糊
Pass 8: 合成 + Tone Mapping
```

## 场景内容

一个有 10 个几何体（立方体和球体）的场景，1 个方向光 + 16 个点光源，地面接收阴影。

## 管线架构

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

const W = canvas.width, H = canvas.height;
const SHADOW_SIZE = 1024;
const LIGHT_COUNT = 16;

// ──── 纹理资源 ────
const gbufPos = device.createTexture({
  size: [W, H], format: 'rgba16float',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
});
const gbufNorm = device.createTexture({
  size: [W, H], format: 'rgba16float',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
});
const gbufAlbedo = device.createTexture({
  size: [W, H], format: 'rgba8unorm',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
});
const depthTex = device.createTexture({
  size: [W, H], format: 'depth24plus',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
});
const shadowTex = device.createTexture({
  size: [SHADOW_SIZE, SHADOW_SIZE], format: 'depth32float',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
});
const ssaoTex = device.createTexture({
  size: [W, H], format: 'r32float',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
});
const ssaoBlurTex = device.createTexture({
  size: [W, H], format: 'r32float',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
});
const sceneHDR = device.createTexture({
  size: [W, H], format: 'rgba16float',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
});
const bloomA = device.createTexture({
  size: [W / 2, H / 2], format: 'rgba16float',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
});
const bloomB = device.createTexture({
  size: [W / 2, H / 2], format: 'rgba16float',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
});

// ──── 着色器定义 ────
// (Shadow pass, G-Buffer pass, SSAO compute, SSAO blur compute,
//  Lighting pass, Brightness extract, Blur H/V, Composite + Tone Mapping)
//
// 这些着色器的代码与前面 4 课完全一致，这里只列出 pipeline 创建和渲染循环。

// ──── 几何体数据 ────
// 生成 10 个物体（立方体 + 球体）的顶点数据
// 地面（大四边形）

// ──── 光源数据 ────
const lights = new Float32Array(LIGHT_COUNT * 8); // 每个光源 2 个 vec4
for (let i = 0; i < LIGHT_COUNT; i++) {
  const angle = (i / LIGHT_COUNT) * Math.PI * 2;
  const r = 3 + Math.sin(i * 1.7) * 1.5;
  lights[i * 8 + 0] = Math.cos(angle) * r;   // x
  lights[i * 8 + 1] = 1.5 + Math.sin(i * 2.3) * 0.5; // y
  lights[i * 8 + 2] = Math.sin(angle) * r;   // z
  lights[i * 8 + 3] = 3.0;                    // radius
  lights[i * 8 + 4] = 0.8 + Math.random() * 0.2; // r
  lights[i * 8 + 5] = 0.6 + Math.random() * 0.2; // g
  lights[i * 8 + 6] = 0.4 + Math.random() * 0.2; // b
  lights[i * 8 + 7] = 8.0;                    // intensity
}

// ──── 渲染循环 ────
let frameIdx = 0;
function frame(time) {
  const t = time / 1000;
  const enc = device.createCommandEncoder();

  // 更新光源位置（动画）
  for (let i = 0; i < LIGHT_COUNT; i++) {
    const angle = (i / LIGHT_COUNT) * Math.PI * 2 + t * 0.3;
    const r = 3 + Math.sin(t * 0.5 + i * 1.7) * 1.5;
    lights[i * 8 + 0] = Math.cos(angle) * r;
    lights[i * 8 + 2] = Math.sin(angle) * r;
    lights[i * 8 + 1] = 1.5 + Math.sin(t + i * 2.3) * 0.8;
  }

  // Pass 0: Shadow Map
  const shadowPass = enc.beginRenderPass({
    colorAttachments: [],
    depthStencilAttachment: {
      view: shadowTex.createView(),
      depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1.0,
    },
  });
  shadowPass.setPipeline(shadowPipeline);
  shadowPass.setBindGroup(0, shadowBindGroup);
  shadowPass.setVertexBuffer(0, sceneVBuf);
  shadowPass.draw(sceneVertexCount);
  shadowPass.end();

  // Pass 1: G-Buffer
  const gbufPass = enc.beginRenderPass({
    colorAttachments: [
      { view: gbufPos.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r:0,g:0,b:0,a:0 } },
      { view: gbufNorm.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r:0,g:0,b:0,a:0 } },
      { view: gbufAlbedo.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r:0,g:0,b:0,a:0 } },
    ],
    depthStencilAttachment: {
      view: depthTex.createView(),
      depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1.0,
    },
  });
  gbufPass.setPipeline(gbufPipeline);
  gbufPass.setBindGroup(0, gbufBindGroup);
  gbufPass.setVertexBuffer(0, sceneVBuf);
  gbufPass.draw(sceneVertexCount);
  gbufPass.end();

  // Pass 2: SSAO (compute)
  const ssaoPass = enc.beginComputePass();
  ssaoPass.setPipeline(ssaoPipeline);
  ssaoPass.setBindGroup(0, ssaoBindGroup);
  ssaoPass.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));
  ssaoPass.end();

  // Pass 3: SSAO Blur (compute)
  const blurPass = enc.beginComputePass();
  blurPass.setPipeline(ssaoBlurPipeline);
  blurPass.setBindGroup(0, ssaoBlurBindGroup);
  blurPass.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));
  blurPass.end();

  // Pass 4: Lighting
  const lightPass = enc.beginRenderPass({
    colorAttachments: [{
      view: sceneHDR.createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r:0,g:0,b:0,a:1 },
    }],
  });
  lightPass.setPipeline(lightingPipeline);
  lightPass.setBindGroup(0, lightingBindGroup);
  lightPass.draw(6);
  lightPass.end();

  // Pass 5: Bloom threshold
  const threshPass = enc.beginRenderPass({
    colorAttachments: [{
      view: bloomA.createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r:0,g:0,b:0,a:1 },
    }],
  });
  threshPass.setPipeline(threshPipeline);
  threshPass.setBindGroup(0, threshBindGroup);
  threshPass.draw(6);
  threshPass.end();

  // Pass 6: Blur H
  const blurHPass = enc.beginRenderPass({
    colorAttachments: [{
      view: bloomB.createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r:0,g:0,b:0,a:1 },
    }],
  });
  blurHPass.setPipeline(blurHPipeline);
  blurHPass.setBindGroup(0, blurHBindGroup);
  blurHPass.draw(6);
  blurHPass.end();

  // Pass 7: Blur V
  const blurVPass = enc.beginRenderPass({
    colorAttachments: [{
      view: bloomA.createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r:0,g:0,b:0,a:1 },
    }],
  });
  blurVPass.setPipeline(blurVPipeline);
  blurVPass.setBindGroup(0, blurVBindGroup);
  blurVPass.draw(6);
  blurVPass.end();

  // Pass 8: Composite + Tone Mapping
  const compPass = enc.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r:0,g:0,b:0,a:1 },
    }],
  });
  compPass.setPipeline(compositePipeline);
  compPass.setBindGroup(0, compositeBindGroup);
  compPass.draw(6);
  compPass.end();

  device.queue.submit([enc.finish()]);
  frameIdx++;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## 管线状态管理

9 个 pass 意味着 9 套 pipeline + bind group。在真实引擎中，这些会被组织成一个渲染图（Render Graph）：

```txt
Shadow ──┐
         ├─→ Lighting ──→ Bloom ──→ Composite
G-Buffer ┘       ↑
                 SSAO ──┘
```

每个节点声明它的输入纹理和输出纹理，渲染图自动排序执行顺序。

## 性能瓶颈

1. **G-Buffer 带宽**：4 个 MRT 纹理的写入和读取是最大的带宽消耗
2. **SSAO 采样**：16-32 个采样点 × 每个像素 = 大量纹理读取
3. **Bloom 模糊**：两趟高斯模糊，每趟 9 次纹理采样

优化手段：降采样 SSAO 和 Bloom、使用更紧凑的 G-Buffer 格式、合并 pass。

## 练习

1. 添加 TAA（Temporal Anti-Aliasing）：利用前一帧的结果做时间域抗锯齿。
2. 实现屏幕空间反射（SSR）：在 G-Buffer 基础上做光线步进，反射周围环境。
3. 把延迟渲染改成 Forward+（Tiled Forward）：把屏幕分 tile，每个 tile 只计算影响它的光源。
