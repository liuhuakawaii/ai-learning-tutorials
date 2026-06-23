# 几何与缓冲区——BufferGeometry 内存布局、Attribute 系统、GPU 上传

## 为什么几何体不是"一堆点"

很多人把 BufferGeometry 理解为"一组顶点坐标"。但真实的几何体数据远不止坐标——法线、UV、颜色、自定义属性，全部存在一起。它们的内存布局决定了 GPU 能不能高效读取，也决定了你能不能做实例化渲染。

## BufferGeometry 的内存模型

一个 BufferGeometry 持有一组 `BufferAttribute`，每个 Attribute 对应一种数据：

```ts
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
```

每个 BufferAttribute 内部是一个 `TypedArray`（如 Float32Array），存储在 CPU 内存中。上传到 GPU 时，Three.js 为每个 Attribute 创建一个 WebGLBuffer（VBO）。

关键：**每个 Attribute 是独立的 VBO**。position 一个 buffer，normal 一个 buffer，uv 一个 buffer。

这意味着 GPU 读取一个顶点的数据时，需要从多个 buffer 中分别读取。这叫 **Structure of Arrays (SoA)** 布局，与之对应的是 **Array of Structures (AoS)**。

```
SoA（Three.js 的方式）：
position: [x0,y0,z0, x1,y1,z1, x2,y2,z2, ...]
normal:   [nx0,ny0,nz0, nx1,ny1,nz1, ...]
uv:       [u0,v0, u1,v1, u2,v2, ...]

AoS（交错布局）：
interleaved: [x0,y0,z0,nx0,ny0,nz0,u0,v0, x1,y1,z1,nx1,ny1,nz1,u1,v1, ...]
```

SoA 的优势是每个属性可以独立更新（比如只更新 position），劣势是 GPU 需要多次 buffer 绑定。AoS 正好相反。

## InterleavedBufferAttribute：交错布局

Three.js 也支持 AoS 布局，通过 `InterleavedBuffer`：

```ts
// 交错布局：position + normal 放在同一个 buffer 里
const stride = 6 * 4; // 3 floats position + 3 floats normal, 每个 4 bytes
const buffer = new InterleavedBuffer(new Float32Array([
    // x, y, z, nx, ny, nz
    0, 0, 0, 0, 1, 0,
    1, 0, 0, 0, 1, 0,
    // ...
]), stride);

const positionAttr = new InterleavedBufferAttribute(buffer, 3, 0); // offset=0
const normalAttr = new InterleavedBufferAttribute(buffer, 3, 3 * 4); // offset=12 bytes
```

交错布局在以下场景更优：

- 所有属性一起读取（典型渲染流程）
- 减少 GPU 内存带宽压力
- 缓存命中率更高（相关数据在内存中连续）

## Index Buffer：减少顶点重复

如果两个三角形共享一个顶点，不需要存两份。Index Buffer 用整数索引引用顶点：

```ts
const indices = [0, 1, 2, 2, 3, 0]; // 两个三角形
geometry.setIndex(indices);
```

Index Buffer 本身也是一个 WebGLBuffer，类型通常是 Uint16Array 或 Uint32Array。

判断用哪种：

- Uint16：顶点数 < 65536 → 省内存
- Uint32：顶点数 ≥ 65536 → 必须用

Three.js 默认根据顶点数自动选择。

## GPU 上传时机

BufferGeometry 的数据不会自动上传到 GPU。上传发生在第一次渲染该几何体时：

```ts
// WebGLGeometries.js 简化版
function get(geometry) {
    if (!geometryWebGL[geometry.id]) {
        // 创建 VBO 并上传数据
        geometryWebGL[geometry.id] = createBuffers(geometry);
    }
    return geometryWebGL[geometry.id];
}
```

上传后，数据存在 GPU 内存中。之后如果你修改了 TypedArray 的内容，需要标记 `needsUpdate = true`：

```ts
positionAttr.setX(0, 5); // 修改值
positionAttr.needsUpdate = true; // 标记需要重新上传
```

这又是一个 dirty flag 模式——不在每次修改时上传，等渲染时统一处理。

## 属性类型与 GPU 对应关系

| Three.js 类型 | GLSL 类型 | 组件数 |
|---|---|---|
| Float32BufferAttribute(vec3) | vec3 | 3 |
| Float32BufferAttribute(vec2) | vec2 | 2 |
| Uint8BufferAttribute(color) | vec3 (normalized) | 3 |
| Int8BufferAttribute(flags) | int | 1 |

`normalized` 参数很重要：如果你用 Uint8 存颜色（0-255），设 `normalized = true` 后 GPU 会自动映射到 0.0-1.0。

## 自定义 Attribute

你可以添加任意名称的 Attribute，在 shader 里读取：

```ts
// 存储每个顶点的"权重"
geometry.setAttribute('weight', new THREE.Float32BufferAttribute(weights, 1));

// vertex shader
attribute float weight;
varying float vWeight;
void main() {
    vWeight = weight;
    // ...
}
```

这在自定义材质效果时非常有用——每个顶点的数据直接传给 GPU，不需要额外的 uniform 或 texture。

## 从内存布局看性能

几何体的内存开销计算：

```ts
// 一个简单立方体：8 顶点，12 三角形
// position: 8 × 3 × 4 = 96 bytes
// normal:   8 × 3 × 4 = 96 bytes
// uv:       8 × 2 × 4 = 64 bytes
// index:    36 × 2 = 72 bytes (Uint16)
// 总计：328 bytes

// 一个角色模型：50000 顶点
// position: 50000 × 3 × 4 = 600 KB
// normal:   50000 × 3 × 4 = 600 KB
// uv:       50000 × 2 × 4 = 400 KB
// index:    150000 × 4 = 600 KB (Uint32)
// 总计：~2.2 MB
```

大型场景需要监控几何体内存预算。`renderer.info.memory` 可以查看当前的几何体内存使用。

## 练习

### 练习一：Attribute 内存计算

一个模型有 10000 顶点，包含 position(vec3)、normal(vec3)、uv(vec2)、color(vec4)。分别计算使用 Float32 和 Float16（如果支持）的内存开销。Index 使用 Uint32，三角形数为 20000。

### 练习二：交错 vs 非交错性能对比

创建两个相同几何体，一个用默认 BufferAttribute，一个用 InterleavedBufferAttribute。在每帧修改 position 数据时，测量两者的上传时间差异。

```ts
// 测试框架
function benchmark(name, fn, iterations = 100) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(2)}ms`);
}
```

### 练习三：自定义 Attribute 实现渐变

为一个 PlaneGeometry 添加自定义 `progress` 属性（0.0 到 1.0），在 vertex shader 中根据 progress 值做顶点偏移，实现"从左到右展开"的动画效果。

---

## 参考答案

### 练习一

- position: 10000 × 3 × 4 = 120 KB
- normal: 10000 × 3 × 4 = 120 KB
- uv: 10000 × 2 × 4 = 80 KB
- color: 10000 × 4 × 4 = 160 KB
- index: 60000 × 4 = 240 KB
- 总计：720 KB

Float16 的话除以 2，但需要 `OES_element_index_uint` 扩展和 half-float 支持。

### 练习二

交错布局在"同时修改多个属性"时更快（一次 buffer.bind），在"只修改一个属性"时可能更慢（需要计算偏移）。差异取决于具体 GPU 驱动。

### 练习三

```ts
const geometry = new THREE.PlaneGeometry(10, 10, 100, 1);
const progress = new Float32Array(100 * 2 * 1); // 顶点数
for (let i = 0; i < progress.length; i++) {
    progress[i] = (i % 101) / 100; // 从左到右 0→1
}
geometry.setAttribute('progress', new THREE.BufferAttribute(progress, 1));

// vertex shader
// attribute float progress;
// void main() {
//     vec3 pos = position;
//     pos.z += progress * sin(time) * 2.0;
//     gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
// }
```
