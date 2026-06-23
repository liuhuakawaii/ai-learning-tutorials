# 阴影：Shadow Mapping

## 阴影的本质

阴影就是"光被挡住了"。判断一个点是否在阴影中，只需要问一个问题：从这个点到光源的路径上，有没有其他物体？

Shadow Mapping 的做法很直接：
1. 从光源的视角渲染一张深度图（Shadow Map）
2. 在主渲染 pass 中，把每个像素变换到光源空间
3. 比较像素深度和 Shadow Map 中的深度——如果像素更深，说明被遮挡

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

const SHADOW_SIZE = 1024;

// ──── Shadow Map 写入 Shader ────
const shadowCode = /* wgsl */`
  struct UBO { light_vp: mat4x4f };
  @group(0) @binding(0) var<uniform> ubo: UBO;

  @vertex
  fn vs(@location(0) pos: vec3f) -> @builtin(position) vec4f {
    return ubo.light_vp * vec4f(pos, 1.0);
  }

  @fragment
  fn fs() -> @location(0) vec4f {
    return vec4f(0.0); // 不需要颜色输出
  }
`;

// ──── 主渲染 Shader（带阴影） ────
const mainCode = /* wgsl */`
  struct UBO {
    mvp: mat4x4f,
    model: mat4x4f,
    normal_mat: mat4x4f,
    light_vp: mat4x4f,
    light_dir: vec4f,
    cam_pos: vec4f,
  };
  @group(0) @binding(0) var<uniform> ubo: UBO;
  @group(0) @binding(1) var shadow_tex: texture_depth_2d;
  @group(0) @binding(2) var shadow_sampler: sampler_comparison;

  struct Vout {
    @builtin(position) pos: vec4f,
    @location(0) norm: vec3f,
    @location(1) world_pos: vec3f,
  };

  @vertex
  fn vs(@location(0) position: vec3f, @location(1) normal: vec3f) -> Vout {
    var out: Vout;
    let world = ubo.model * vec4f(position, 1.0);
    out.pos = ubo.mvp * vec4f(position, 1.0);
    out.norm = (ubo.normal_mat * vec4f(normal, 0.0)).xyz;
    out.world_pos = world.xyz;
    return out;
  }

  @fragment
  fn fs(in: Vout) -> @location(0) vec4f {
    let normal = normalize(in.norm);
    let light_dir = normalize(ubo.light_dir.xyz);

    // 漫反射
    let ndotl = max(dot(normal, light_dir), 0.0);
    let albedo = vec3f(0.8, 0.6, 0.4);
    var color = albedo * ndotl * 0.8 + albedo * 0.1; // 漫反射 + 环境光

    // 阴影计算
    let light_clip = ubo.light_vp * vec4f(in.world_pos, 1.0);
    var shadow_uv = light_clip.xy / light_clip.w * 0.5 + 0.5;
    shadow_uv.y = 1.0 - shadow_uv.y; // 翻转 Y

    let shadow_depth = light_clip.z / light_clip.w;

    // PCF（Percentage Closer Filtering）—— 3x3 采样柔化阴影边缘
    var shadow = 0.0;
    let texel_size = 1.0 / ${SHADOW_SIZE}.0;
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        let offset = vec2f(f32(dx), f32(dy)) * texel_size;
        shadow += textureSampleCompare(
          shadow_tex, shadow_sampler,
          shadow_uv + offset, shadow_depth - 0.005
        );
      }
    }
    shadow /= 9.0;

    // 边界检查
    if (shadow_uv.x < 0.0 || shadow_uv.x > 1.0 || shadow_uv.y < 0.0 || shadow_uv.y > 1.0) {
      shadow = 1.0;
    }

    color *= max(shadow, 0.15); // 阴影中也保留一点环境光

    return vec4f(color, 1.0);
  }
`;

// ──── 创建 Shadow Map 纹理 ────
const shadowTexture = device.createTexture({
  size: [SHADOW_SIZE, SHADOW_SIZE],
  format: 'depth32float',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
});

// ──── Shadow Pipeline ────
const shadowModule = device.createShaderModule({ code: shadowCode });
const shadowPipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module: shadowModule,
    entryPoint: 'vs',
    buffers: [{
      arrayStride: 24,
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x3' },
      ],
    }],
  },
  fragment: {
    module: shadowModule,
    entryPoint: 'fs',
    targets: [], // 无颜色输出
  },
  depthStencil: {
    format: 'depth32float',
    depthWriteEnabled: true,
    depthCompare: 'less',
  },
});

// ──── Main Pipeline ────
const mainModule = device.createShaderModule({ code: mainCode });
const mainPipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module: mainModule,
    entryPoint: 'vs',
    buffers: [{
      arrayStride: 24,
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x3' },
      ],
    }],
  },
  fragment: {
    module: mainModule,
    entryPoint: 'fs',
    targets: [{ format }],
  },
  depthStencil: {
    format: 'depth24plus',
    depthWriteEnabled: true,
    depthCompare: 'less',
  },
});

// 场景几何体
function createBox() {
  // 立方体顶点（位置 + 法线）
  return new Float32Array([
    // 前面
    -1,-1,1, 0,0,1,  1,-1,1, 0,0,1,  1,1,1, 0,0,1,
    -1,-1,1, 0,0,1,  1,1,1, 0,0,1,  -1,1,1, 0,0,1,
    // 后面、上面、下面、左面、右面...
    // (省略其余 5 面，结构相同)
  ]);
}

function createGround() {
  return new Float32Array([
    -10,0,-10, 0,1,0,  10,0,-10, 0,1,0,  10,0,10, 0,1,0,
    -10,0,-10, 0,1,0,  10,0,10, 0,1,0,  -10,0,10, 0,1,0,
  ]);
}

// 矩阵工具
function ortho(l,r,b,t,n,f) {
  return new Float32Array([
    2/(r-l),0,0,0, 0,2/(t-b),0,0, 0,0,1/(f-n),0,
    -(r+l)/(r-l),-(t+b)/(t-b),-n/(f-n),1,
  ]);
}

// 光源方向
const lightDir = [0.5, 1.0, 0.3];
const lightProj = ortho(-10, 10, -10, 10, 0.1, 20);
// lightView = lookAt(lightDir * 10, [0,0,0], [0,1,0])

function frame() {
  const enc = device.createCommandEncoder();

  // Pass 1: Shadow Map
  const sp = enc.beginRenderPass({
    colorAttachments: [],
    depthStencilAttachment: {
      view: shadowTexture.createView(),
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
      depthClearValue: 1.0,
    },
  });
  sp.setPipeline(shadowPipeline);
  // sp.setBindGroup(0, shadowBindGroup);
  // sp.setVertexBuffer(0, sceneBuffer);
  // sp.draw(vertexCount);
  sp.end();

  // Pass 2: Main Render
  const mp = enc.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r: 0.2, g: 0.3, b: 0.4, a: 1 },
    }],
    depthStencilAttachment: {
      view: device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      }).createView(),
      depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1.0,
    },
  });
  mp.setPipeline(mainPipeline);
  // mp.setBindGroup(0, mainBindGroup);
  // mp.setVertexBuffer(0, sceneBuffer);
  // mp.draw(vertexCount);
  mp.end();

  device.queue.submit([enc.finish()]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
</script>
</body>
</html>
```

## 关键细节

### 深度偏移

阴影计算中的 `shadow_depth - 0.005` 是深度偏移（depth bias），防止表面自阴影（surface acne）——因为 Shadow Map 的精度有限，表面自己的深度和 Shadow Map 里的深度可能有微小差异，导致表面错误地遮挡自己。

### PCF

直接采样 Shadow Map 会产生锯齿状的硬阴影。PCF（Percentage Closer Filtering）在采样周围做多次比较，然后平均结果，产生柔和的阴影边缘。

### 阴影贴图分辨率

1024×1024 对近景够用，远景会出现明显的像素化。Cascaded Shadow Maps（CSM）把场景分成几段，每段用不同分辨率的 Shadow Map，近处高精度，远处低精度。

## 练习

1. 实现 Cascaded Shadow Maps：把视锥体分成 3 段，每段一张 Shadow Map。
2. 尝试 Variance Shadow Maps（VSM）——用方差代替直接深度比较，可以用普通纹理模糊。
3. 给阴影加软边缘（soft shadow）——根据到遮挡物的距离调整阴影强度。
