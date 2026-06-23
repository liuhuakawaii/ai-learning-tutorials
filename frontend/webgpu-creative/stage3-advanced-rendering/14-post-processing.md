# 后处理：Tone Mapping 与 Bloom

## 为什么渲染结果需要后处理

渲染管线输出的颜色值是线性空间的 HDR（High Dynamic Range）值——可能超过 1.0。但显示器只能显示 0-1 的 LDR（Low Dynamic Range）颜色。

两个问题需要解决：
1. **Tone Mapping**：把 HDR 值映射到显示器能显示的范围
2. **Bloom**：让高亮区域"溢出"光芒，模拟真实摄像机的镜头光晕

## Bloom 的实现步骤

```
原始渲染 → 提取亮区 → 水平模糊 → 垂直模糊 → 叠加回原图 → Tone Mapping
```

高斯模糊用两趟（水平 + 垂直）分离实现，比直接 2D 模糊便宜得多——这就是"可分离滤波器"。

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

const W = canvas.width, H = canvas.height;

// 高斯权重（9-tap）
const blurWeights = new Float32Array([
  0.0162162162, 0.0540540541, 0.1216216216, 0.1945945946, 0.2270270270,
  0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162,
]);

// ──── Pass 1: 亮区提取 ────
const thresholdCode = /* wgsl */`
  @group(0) @binding(0) var scene_tex: texture_2d<f32>;

  @vertex
  fn vs(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4f {
    let p = array<vec2f, 6>(vec2f(-1,-1),vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(1,1),vec2f(-1,1));
    return vec4f(p[vid], 0, 1);
  }

  @fragment
  fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let color = textureLoad(scene_tex, vec2i(pos.xy), 0).rgb;
    let brightness = dot(color, vec3f(0.2126, 0.7152, 0.0722));
    let threshold = 0.8;
    let soft = smoothstep(threshold - 0.1, threshold + 0.1, brightness);
    return vec4f(color * soft, 1.0);
  }
`;

// ──── Pass 2: 高斯模糊（水平/垂直） ────
const blurCode = /* wgsl */`
  @group(0) @binding(0) var input_tex: texture_2d<f32>;
  @group(0) @binding(1) var<uniform> direction: vec2f; // (1,0) 或 (0,1)

  const weights = array<f32, 9>(
    0.0162162162, 0.0540540541, 0.1216216216, 0.1945945946, 0.2270270270,
    0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162,
  );

  @vertex
  fn vs(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4f {
    let p = array<vec2f, 6>(vec2f(-1,-1),vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(1,1),vec2f(-1,1));
    return vec4f(p[vid], 0, 1);
  }

  @fragment
  fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let size = textureDimensions(input_tex);
    let xy = vec2i(pos.xy);
    var color = vec3f(0.0);

    for (var i = -4; i <= 4; i++) {
      let offset = vec2i(direction * f32(i));
      let sample_pos = clamp(xy + offset, vec2i(0), vec2i(size) - 1);
      color += textureLoad(input_tex, sample_pos, 0).rgb * weights[i + 4];
    }

    return vec4f(color, 1.0);
  }
`;

// ──── Pass 3: 合成 + Tone Mapping ────
const compositeCode = /* wgsl */`
  @group(0) @binding(0) var scene_tex: texture_2d<f32>;
  @group(0) @binding(1) var bloom_tex: texture_2d<f32>;

  // ACES Tone Mapping
  fn aces_tone_map(x: vec3f) -> vec3f {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
  }

  @vertex
  fn vs(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4f {
    let p = array<vec2f, 6>(vec2f(-1,-1),vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(1,1),vec2f(-1,1));
    return vec4f(p[vid], 0, 1);
  }

  @fragment
  fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let xy = vec2i(pos.xy);
    let scene = textureLoad(scene_tex, xy, 0).rgb;
    let bloom = textureLoad(bloom_tex, xy, 0).rgb;

    // 叠加 bloom
    let hdr = scene + bloom * 0.5;

    // ACES Tone Mapping
    let mapped = aces_tone_map(hdr);

    // Gamma 校正
    let gamma = pow(mapped, vec3f(1.0 / 2.2));

    return vec4f(gamma, 1.0);
  }
`;

// 创建中间纹理
function createRT(w, h) {
  return device.createTexture({
    size: [w, h],
    format: 'rgba16float', // HDR 格式
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
  });
}

const sceneRT = createRT(W, H);
const brightRT = createRT(W / 2, H / 2); // 降采样
const blurH = createRT(W / 2, H / 2);
const blurV = createRT(W / 2, H / 2);

// [Pipeline 创建省略]

function frame() {
  const enc = device.createCommandEncoder();

  // Pass 0: 主场景渲染 → sceneRT（前面课程的延迟渲染 pass）

  // Pass 1: 提取亮区
  const p1 = enc.beginRenderPass({
    colorAttachments: [{
      view: brightRT.createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });
  // p1.setPipeline(thresholdPipeline);
  // p1.setBindGroup(0, thresholdBG);
  // p1.draw(6);
  p1.end();

  // Pass 2a: 水平模糊
  const p2a = enc.beginRenderPass({
    colorAttachments: [{
      view: blurH.createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });
  // p2a.setPipeline(blurPipeline);
  // p2a.setBindGroup(0, blurHBG); // direction = (1, 0)
  // p2a.draw(6);
  p2a.end();

  // Pass 2b: 垂直模糊
  const p2b = enc.beginRenderPass({
    colorAttachments: [{
      view: blurV.createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });
  // p2b.setPipeline(blurPipeline);
  // p2b.setBindGroup(0, blurVBG); // direction = (0, 1)
  // p2b.draw(6);
  p2b.end();

  // Pass 3: 合成 + Tone Mapping
  const p3 = enc.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });
  // p3.setPipeline(compositePipeline);
  // p3.setBindGroup(0, compositeBG);
  // p3.draw(6);
  p3.end();

  device.queue.submit([enc.finish()]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## Tone Mapping 算法对比

| 算法 | 特点 | 适用场景 |
|------|------|---------|
| Reinhard | `color / (1 + color)` | 简单通用 |
| ACES | 电影工业标准，对比度好 | 游戏、电影 |
| Filmic | 类似 ACES，暗部更好 | 写实渲染 |

ACES 是目前最常用的选择——它在暗部和亮部都有不错的对比度表现。

## Bloom 的参数调优

- **亮度阈值**：太低会让整个场景都发光，太高看不到 bloom 效果。0.7-0.9 是常用范围。
- **模糊半径**：半径越大，光晕越扩散。多趟模糊（blur → 降采样 → 再 blur）可以实现大范围光晕。
- **混合强度**：bloom 和原始场景的混合比例。0.3-0.8 看效果。

## 练习

1. 实现多级 Bloom：多次降采样 + 模糊，产生更大范围的光晕。
2. 尝试其他 Tone Mapping 算法（Reinhard, Filmic），对比视觉差异。
3. 加入色差（Chromatic Aberration）效果——RGB 三个通道有微小偏移，模拟镜头色散。
