# 实时光线追踪——WebGPU Ray Tracing、降噪、混合渲染

## 光栅化的局限

Three.js 默认用光栅化渲染：把三角形投射到屏幕上，逐像素着色。速度快，但有几个硬伤：

- 反射需要反射探针或屏幕空间反射（SSR），只能近似
- 阴影靠 Shadow Map，分辨率有限，边缘锯齿
- 全局光照需要烘焙或预计算
- 透明物体的折射和焦散基本没法做

光追（Ray Tracing）从物理上模拟光线的传播路径，这些问题自然解决。代价是计算量大——但 WebGPU 的 Compute Shader 让它在浏览器里变得可行。

## 光追的基本思路

对屏幕上的每个像素，发射一条光线：

```
相机 → 像素 → 打到物体 → 反射/折射 → 打到另一个物体 → ... → 打到光源
```

沿着光线路径累加颜色贡献。一条光线最多弹射 N 次（通常 4-8 次）。

## WebGPU 光追架构

用 Compute Shader 对每个像素并行发射光线：

```wgsl
@group(0) @binding(0) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<storage, read> spheres: array<Sphere>;
@group(0) @binding(2) var<uniform> uCamera: CameraData;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let pixel = vec2<f32>(f32(id.x), f32(id.y));
  let uv = pixel / uResolution;
  
  // 生成初始光线
  let ray = generateRay(uv, uCamera);
  
  // 追踪
  let color = trace(ray, 0);
  
  textureStore(outputTex, id.xy, vec4<f32>(color, 1.0));
}
```

## 光线-球体求交

最基础的几何体求交：

```wgsl
fn raySphereIntersect(ray: Ray, sphere: Sphere) -> f32 {
  let oc = ray.origin - sphere.center;
  let a = dot(ray.direction, ray.direction);
  let b = 2.0 * dot(oc, ray.direction);
  let c = dot(oc, oc) - sphere.radius * sphere.radius;
  let discriminant = b * b - 4.0 * a * c;
  
  if (discriminant < 0.0) { return -1.0; }
  
  let t = (-b - sqrt(discriminant)) / (2.0 * a);
  return select(-1.0, t, t > 0.001);
}
```

## 追踪函数

递归式光追（用循环模拟递归，WGSL 不支持递归）：

```wgsl
fn trace(ray: Ray, maxBounces: i32) -> vec3<f32> {
  var color = vec3<f32>(0.0);
  var throughput = vec3<f32>(1.0);
  var currentRay = ray;
  
  for (var bounce = 0; bounce < maxBounces; bounce++) {
    let hit = findClosestHit(currentRay);
    
    if (hit.t < 0.0) {
      // 打到天空
      color += throughput * skyColor(currentRay.direction);
      break;
    }
    
    // 累加自发光
    color += throughput * hit.material.emission;
    
    // 更新通量
    throughput *= hit.material.albedo;
    
    // 反射方向（漫反射用随机方向）
    let normal = hit.normal;
    let scatterDir = normal + randomUnitVector();
    currentRay = Ray(hit.point + normal * 0.001, normalize(scatterDir));
  }
  
  return color;
}
```

## 降噪——必须做的事

光追最大的问题是噪点。每个像素只发射 1 条光线时，采样不足导致大量噪点。增加到每像素 64 或 128 条光线可以消除噪点，但实时性能不允许。

降噪策略：

**时间累积**：利用前几帧的采样结果，当前帧只算 1 条新光线，与历史帧混合。

```wgsl
let currentColor = trace(ray, 4);
let historyColor = textureLoad(historyTex, pixel, 0).rgb;
let blended = mix(historyColor, currentColor, 0.05); // 5% 新 + 95% 旧
```

**空间滤波**：对相邻像素做边缘保持的模糊（bilateral filter）。

```wgsl
fn denoiseBilateral(pixel: vec2<i32>) -> vec3<f32> {
  let center = textureLoad(noisyTex, pixel, 0).rgb;
  let centerDepth = textureLoad(depthTex, pixel, 0).r;
  let centerNormal = textureLoad(normalTex, pixel, 0).rgb;
  
  var sum = vec3<f32>(0.0);
  var weightSum = 0.0;
  
  for (var dy = -2; dy <= 2; dy++) {
    for (var dx = -2; dx <= 2; dx++) {
      let sample = textureLoad(noisyTex, pixel + vec2<i32>(dx, dy), 0).rgb;
      let depth = textureLoad(depthTex, pixel + vec2<i32>(dx, dy), 0).r;
      let normal = textureLoad(normalTex, pixel + vec2<i32>(dx, dy), 0).rgb;
      
      let wDepth = exp(-abs(depth - centerDepth) * 50.0);
      let wNormal = pow(max(dot(normal, centerNormal), 0.0), 32.0);
      let wSpatial = exp(-f32(dx * dx + dy * dy) * 0.5);
      
      let weight = wDepth * wNormal * wSpatial;
      sum += sample * weight;
      weightSum += weight;
    }
  }
  return sum / weightSum;
}
```

## 混合渲染

不需要整个场景都光追。可以把光追用于需要精确反射的部分（金属表面、玻璃），其余用光栅化：

```ts
// Pass 1: 光栅化不透明物体到 G-Buffer
// Pass 2: 对反射物体的像素用 Compute Shader 做光追
// Pass 3: 合成最终画面
```

## 视觉效果描述

一个金属球体放在大理石地板上。光栅化渲染时，球体的"反射"是假的环境贴图。开启光追后，球体表面精确反射出地板的纹理、周围物体的倒影、甚至球体自己在地板上的反射。地板上的阴影不是锯齿的 Shadow Map，而是柔和的接触阴影。

每像素 1 条光线时画面布满噪点，像老电视的雪花。加上时间累积降噪后，噪点逐渐消退，画面在 10-20 帧内变得清晰。

## 练习

### 练习一：反射金属球

场景中放 3 个球：一个镜面金属球（反射率 0.95）、一个粗糙金属球（反射率 0.3）、一个漫反射球。观察三者在光追下的反射差异。镜面球应该清晰反射周围环境，粗糙球的反射模糊。

### 练习二：折射玻璃球

给一个球体添加折射材质（IOR 1.5），光线穿过时弯曲。在球体后面放一个彩色方块，通过球体应该能看到倒转和变形的方块。需要实现 `refract` 函数和菲涅尔效应。

---

## 参考答案

### 练习一

**思路**：材质属性区分反射类型。

```wgsl
struct Material {
  albedo: vec3<f32>,
  roughness: f32,
  metallic: f32,
  emission: vec3<f32>,
}

fn scatter(ray: Ray, hit: HitRecord) -> Ray {
  let mat = hit.material;
  
  if (mat.metallic > 0.5) {
    // 金属反射
    let reflected = reflect(ray.direction, hit.normal);
    let fuzz = mat.roughness * randomUnitVector();
    return Ray(hit.point, normalize(reflected + fuzz));
  } else {
    // 漫反射
    return Ray(hit.point, normalize(hit.normal + randomUnitVector()));
  }
}
```

三个球的材质定义：

```wgsl
let mirrorSphere = Material(vec3<f32>(0.9), 0.0, 1.0, vec3<f32>(0.0));
let roughMetalSphere = Material(vec3<f32>(0.8, 0.6, 0.2), 0.7, 1.0, vec3<f32>(0.0));
let diffuseSphere = Material(vec3<f32>(0.2, 0.5, 0.8), 1.0, 0.0, vec3<f32>(0.0));
```

### 练习二

**思路**：用 Snell 定律计算折射方向，菲涅尔方程决定反射/折射比例。

```wgsl
fn refract(dir: vec3<f32>, normal: vec3<f32>, ior: f32) -> vec3<f32> {
  let cosi = clamp(dot(dir, normal), -1.0, 1.0);
  let etai = select(ior, 1.0, cosi > 0.0);
  let etat = select(1.0, ior, cosi > 0.0);
  let n = select(-normal, normal, cosi > 0.0);
  let cost = sqrt(1.0 - (etai / etat) * (1.0 - cosi * cosi));
  return (etai / etat) * dir + (etai / etat * cosi - cost) * n;
}

fn fresnel(cosTheta: f32, ior: f32) -> f32 {
  var r0 = (1.0 - ior) / (1.0 + ior);
  r0 = r0 * r0;
  return r0 + (1.0 - r0) * pow(1.0 - cosTheta, 5.0);
}
```

在 trace 函数中：

```wgsl
if (hit.material.ior > 1.0) {
  let cosTheta = min(dot(-rayDir, hit.normal), 1.0);
  let reflectProb = fresnel(cosTheta, hit.material.ior);
  
  if (random() < reflectProb) {
    // 反射
    nextDir = reflect(rayDir, hit.normal);
  } else {
    // 折射
    nextDir = refract(rayDir, hit.normal, hit.material.ior);
  }
}
```

**常见错误**：折射光线在球体内部会发生全内反射。需要在内部碰撞时翻转法线，并用 1/IOR 作为新的折射率。
