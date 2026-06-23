# 流体模拟——WebGPU Compute Shader 实现 2D/3D 流体

## 流体模拟不是贴图

很多人以为页面上那种"液态流动"效果是用噪声贴图做的。噪声能做到波纹和扭曲，但做不到流体的核心特征：**互相影响、有惯性、会碰撞**。

真正的流体模拟让每个网格单元根据邻居的状态更新自身，形成涡流、湍流、扩散等现象。

## Navier-Stokes 方程（简化版）

流体的行为由 Navier-Stokes 方程描述。完整求解太重，工程中常用 **Stable Fluids** 方法（Jos Stam, 1999），核心步骤：

1. **添加外力**：鼠标、重力等外部作用
2. **扩散**：速度场的粘性扩散
3. **平移**：沿速度场运输速度本身（对流）
4. **投影**：确保速度场无散度（不可压缩）

每一步都是对网格的遍历和计算。GPU 的 Compute Shader 天然适合这种"大量单元、相同操作"的计算模式。

## WebGPU Compute Shader 基础

WebGPU 的 Compute Shader 运行在渲染管线之外，专门做通用计算：

```wgsl
@compute @workgroup_size(8, 8, 0)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let x = id.x;
  let y = id.y;
  // 在这里操作纹理数据
}
```

一个 workgroup 处理 8x8 个像素，GPU 会并行调度成千上万个 workgroup。

## 数据存储：Storage Texture

流体模拟用纹理存储速度场和密度场：

```ts
const velocityTexture = device.createTexture({
  size: [512, 512],
  format: "rg32float", // xy = 速度分量
  usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
})

const densityTexture = device.createTexture({
  size: [512, 512],
  format: "r32float",
  usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
})
```

## 四步 Compute Pass

每帧执行 4 个 compute pass：

```ts
function simulate(dt: number) {
  const encoder = device.createCommandEncoder()

  // Step 1: 添加外力
  const pass1 = encoder.beginComputePass()
  pass1.setPipeline(addForcePipeline)
  pass1.setBindGroup(0, forceBindGroup)
  pass1.dispatchWorkgroups(64, 64)
  pass1.end()

  // Step 2: 扩散
  const pass2 = encoder.beginComputePass()
  pass2.setPipeline(diffusePipeline)
  pass2.setBindGroup(0, diffuseBindGroup)
  pass2.dispatchWorkgroups(64, 64)
  pass2.end()

  // Step 3: 平移（对流）
  const pass3 = encoder.beginComputePass()
  pass3.setPipeline(advectPipeline)
  pass3.setBindGroup(0, advectBindGroup)
  pass3.dispatchWorkgroups(64, 64)
  pass3.end()

  // Step 4: 投影（压力求解）
  const pass4 = encoder.beginComputePass()
  pass4.setPipeline(projectPipeline)
  pass4.setBindGroup(0, projectBindGroup)
  pass4.dispatchWorkgroups(64, 64)
  pass4.end()

  device.queue.submit([encoder.finish()])
}
```

## 对流的实现

对流是流体模拟最关键的一步——沿速度场"追踪"每个格子的值：

```wgsl
@compute @workgroup_size(8, 8)
fn advect(@builtin(global_invocation_id) id: vec3<u32>) {
  let pos = vec2<f32>(f32(id.x), f32(id.y));
  let vel = textureLoad(velocitySrc, id.xy, 0).xy;
  
  // 沿速度场回溯
  let prev = pos - vel * uDeltaTime;
  
  // 从上一帧的速度纹理采样
  let result = textureSample(velocitySrc, sampler, prev / uResolution);
  
  textureStore(velocityDst, id.xy, vec4<f32>(result, 0.0, 1.0));
}
```

## 外力注入

鼠标位置注入速度和颜色：

```wgsl
@compute @workgroup_size(8, 8)
fn addForce(@builtin(global_invocation_id) id: vec3<u32>) {
  let pos = vec2<f32>(f32(id.x), f32(id.y));
  let dist = distance(pos, uMousePos);
  
  if (dist < uBrushSize) {
    let strength = 1.0 - dist / uBrushSize;
    var vel = textureLoad(velocity, id.xy, 0).xy;
    vel += uMouseVel * strength * uForceMultiplier;
    textureStore(velocity, id.xy, vec4<f32>(vel, 0.0, 1.0));
  }
}
```

## 渲染到屏幕

用全屏四边形 + fragment shader 把密度场画出来：

```wgsl
@fragment
fn frag(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy / uResolution;
  let density = textureSample(densityTex, sampler, uv).r;
  let vel = textureSample(velocityTex, sampler, uv).xy;
  
  // 用速度方向映射颜色
  let hue = atan2(vel.y, vel.x) / 3.14159 * 0.5 + 0.5;
  let color = hslToRgb(hue, 0.8, density * 0.5);
  
  return vec4<f32>(color, 1.0);
}
```

## 视觉效果描述

鼠标在画布上移动时，留下一条条彩色的流体尾迹。尾迹会慢慢扩散、混合，产生涡流。快速移动时能看到湍流——小的漩涡从主流动中分离出来。整个画面像是一缸在搅动的发光液体。

## 练习

### 练习一：双色混合

注入两种不同颜色的流体（比如左半边蓝色、右半边红色），让它们在中间相遇。观察混合、扩散、涡流产生的颜色过渡效果。

### 练习二：添加障碍物

在流体网格中定义一个圆形障碍物，流体绕过它流动。在障碍物后方应该能看到卡门涡街（Kármán vortex street）——交替脱落的小漩涡。

---

## 参考答案

### 练习一

**思路**：密度场改为 RGBA，注入时根据位置设置不同颜色通道。

```wgsl
@compute @workgroup_size(8, 8)
fn addDensity(@builtin(global_invocation_id) id: vec3<u32>) {
  let pos = vec2<f32>(f32(id.x), f32(id.y));
  
  // 左侧注入蓝色
  if (id.x < 10) {
    var d = textureLoad(density, id.xy, 0);
    d.b += 0.5;
    textureStore(density, id.xy, d);
  }
  
  // 右侧注入红色
  if (id.x > 502) {
    var d = textureLoad(density, id.xy, 0);
    d.r += 0.5;
    textureStore(density, id.xy, d);
  }
}
```

### 练习二

**思路**：在 advect 和 project 步骤中检查障碍物 SDF。

```wgsl
fn sdfCircle(pos: vec2<f32>, center: vec2<f32>, radius: f32) -> f32 {
  return distance(pos, center) - radius;
}

@compute @workgroup_size(8, 8)
fn advect(@builtin(global_invocation_id) id: vec3<u32>) {
  let pos = vec2<f32>(f32(id.x), f32(id.y));
  let dist = sdfCircle(pos, uObstacleCenter, uObstacleRadius);
  
  if (dist < 0.0) {
    // 在障碍物内部，速度设为 0
    textureStore(velocity, id.xy, vec4<f32>(0.0));
    return;
  }
  
  // 正常对流...
}
```

**常见错误**：不处理边界条件会导致流体从边缘"泄漏"。在每个 compute pass 的最后要刷新边界格子的速度。
