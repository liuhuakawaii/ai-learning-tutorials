# 渲染优化——Draw Call 合并、纹理图集、Shader 优化

## 优化的目标是"够用"，不是"最快"

优化有成本——代码变复杂、维护变难、灵活性降低。目标是把性能提升到"流畅"（60fps 或 30fps），不是追求理论极限。

## Draw Call 合并

### 几何体合并

把多个静态物体的几何体合并成一个：

```ts
function mergeMeshes(meshes: THREE.Mesh[]): THREE.Mesh {
    const geometries = meshes.map(m => {
        const geo = m.geometry.clone();
        geo.applyMatrix4(m.matrixWorld);
        return geo;
    });

    const merged = BufferGeometryUtils.mergeGeometries(geometries);
    const material = meshes[0].material; // 假设材质相同
    return new THREE.Mesh(merged, material);
}
```

限制：合并后不能单独移动某个物体，不能有不同的材质。

### InstancedMesh

同一模型大量重复时用 InstancedMesh（第 8 节讲过）。一次 draw call 画 N 个实例。

### BatchedMesh

不同几何体但相同材质时用 BatchedMesh。Three.js r152+ 内置。

## 纹理图集（Texture Atlas）

把多张小纹理合成一张大纹理，减少纹理切换：

```ts
// 原来：3 种材质 = 3 次纹理切换
// 合并后：1 张图集 = 1 次纹理切换

// UV 坐标需要对应调整
// 原来 UV 范围 0-1，现在每个物体在图集中占不同区域
// 物体 A: UV 范围 (0, 0) 到 (0.33, 1)
// 物体 B: UV 范围 (0.33, 0) 到 (0.66, 1)
// 物体 C: UV 范围 (0.66, 0) 到 (1, 1)
```

Three.js 社区有 `texture-packer` 工具自动生成图集和调整 UV。

## 纹理优化

### 尺寸选择

纹理不需要总是 2048×2048。根据物体在屏幕上的大小选择：

- 角色特写：2048×2048
- 远处建筑：512×512
- 地面纹理：1024×1024（可 tiled）

### 压缩格式

KTX2 + Basis Universal 是目前最好的方案：

```ts
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';

const ktx2Loader = new KTX2Loader()
    .setTranscoderPath('basis/')
    .detectSupport(renderer);

const texture = await ktx2Loader.loadAsync('diffuse.ktx2');
```

压缩比 4:1 到 8:1，GPU 可以直接解压（不需要 CPU 参与）。

### Mipmap

Mipmap 是预计算的缩小版本纹理。GPU 自动选择合适的层级。关闭 mipmap 可以省 1/3 内存，但远处纹理会闪烁：

```ts
texture.generateMipmaps = true; // 默认 true
texture.minFilter = THREE.LinearMipmapLinearFilter; // 三线性过滤
texture.magFilter = THREE.LinearFilter;
```

## Shader 优化

### 分支优化

GPU 不擅长分支（if/else）。同一 warp/wavefront 的所有线程走同一条路径，否则分支发散：

```glsl
// 差：分支发散
if (vertexID % 2 == 0) {
    pos += normal * offset;
} else {
    pos -= normal * offset;
}

// 好：用 mix 替代
float sign = mod(float(vertexID), 2.0) * 2.0 - 1.0;
pos += normal * offset * sign;
```

### 精度优化

移动端用 `mediump` 替代 `highp`：

```glsl
// 差
precision highp float;

// 好（移动端）
precision mediump float;
```

`mediump` 在大多数移动端 GPU 上是 FP16（16 位浮点），比 FP32 快 2-4 倍。

### 纹理采样优化

纹理采样是 shader 中最昂贵的操作之一。减少采样次数：

```glsl
// 差：多次采样
vec4 color = texture2D(diffuseMap, vUv);
vec3 normal = texture2D(normalMap, vUv).rgb;
float ao = texture2D(aoMap, vUv).r;

// 如果可以，合并纹理
// diffuseMap: RGB = 颜色, A = AO
// normalMap: RGB = 法线
vec4 colorAO = texture2D(diffuseMap, vUv);
vec3 normal = texture2D(normalMap, vUv).rgb;
float ao = colorAO.a;
vec3 color = colorAO.rgb;
```

## 视锥裁剪优化

Three.js 默认对每个物体做视锥裁剪。但对大型 InstancedMesh，裁剪是对整体做的，不是对单个实例。如果你有 10000 个实例分布在大区域，相机只看到一小部分，GPU 还是画了全部。

解决方案：按空间分区，每个分区一个 InstancedMesh。

## 深度预通道（Z-Prepass）

先用最简单的 shader 画一遍深度（不输出颜色），然后正常渲染并启用深度测试。这样后面的 fragment shader 可以跳过被遮挡的像素。

```ts
// Z-Prepass
renderer.state.setMaterial(zPrepassMaterial);
scene.overrideMaterial = zPrepassMaterial;
renderer.render(scene, camera);

// 正常渲染
scene.overrideMaterial = null;
renderer.render(scene, camera);
```

对 overdraw 严重的场景（大量重叠物体）效果明显。

## 练习

### 练习一：几何体合并

创建 100 个位置不同的 Box（相同材质），分别用以下方式渲染：

1. 100 个独立 Mesh
2. 合并成 1 个 Mesh
3. 100 个 InstancedMesh

对比 draw call 数量和 FPS。

### 练习二：纹理图集

把 4 张 512×512 的纹理合成一张 1024×1024 的图集。创建 4 个 Mesh，每个使用图集的不同区域。对比 4 张独立纹理的材质切换次数。

### 练习三：Shader 精度测试

创建一个全屏后处理效果，分别用 `highp` 和 `mediump` 精度。在移动端浏览器上测试帧时间差异。

---

## 参考答案

### 练习一

预期：

1. 100 draw calls
2. 1 draw call
3. 1 draw call

FPS 差异取决于场景复杂度。在 100 个物体时差异可能不明显，到 1000+ 时合并方案优势明显。

### 练习二

4 张独立纹理：4 次纹理切换（如果排序后相邻）
1 张图集：1 次纹理切换

实际差异在 Three.js 的材质排序中可能不明显，因为材质 ID 相同时已经排在一起了。

### 练习三

在桌面端差异可能不明显（GPU 处理 FP32 和 FP16 速度差不多）。在移动端，mediump 通常快 20-50%。
