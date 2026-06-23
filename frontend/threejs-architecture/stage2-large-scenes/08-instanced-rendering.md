# 实例化渲染——InstancedMesh 适用场景、与 BatchedMesh 对比

## 为什么 10000 棵树会让帧率暴跌

场景里放 10000 棵相同的树，每棵树是一个 Mesh。渲染时，Three.js 为每棵树单独发一次 draw call。10000 次 draw call 意味着 10000 次 CPU-GPU 通信，10000 次状态切换。GPU 画一棵树只需要 0.01ms，但 CPU 准备一次 draw call 可能需要 0.1ms。CPU 成了瓶颈。

实例化渲染的思路：告诉 GPU "用同一个几何体和材质，在不同位置画 10000 次"。一次 draw call，GPU 自己处理位置差异。

## InstancedMesh 基础

```ts
const count = 10000;
const geometry = new THREE.CylinderGeometry(0.1, 0.3, 5, 8);
const material = new THREE.MeshStandardMaterial({ color: 0x228b22 });

const instancedMesh = new THREE.InstancedMesh(geometry, material, count);

// 为每个实例设置变换矩阵
const dummy = new THREE.Object3D();
for (let i = 0; i < count; i++) {
    dummy.position.set(
        Math.random() * 200 - 100,
        0,
        Math.random() * 200 - 100
    );
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.scale.setScalar(0.8 + Math.random() * 0.4);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);
}

instancedMesh.instanceMatrix.needsUpdate = true;
scene.add(instancedMesh);
```

一次 draw call 画 10000 棵树。性能提升可以是 100 倍以上。

## instanceMatrix 的内存布局

InstancedMesh 的 `instanceMatrix` 是一个 `InstancedBufferAttribute`，存储每个实例的 4×4 矩阵：

```ts
// 内部结构
// Float32Array, 每个实例 16 个 float
// instanceMatrix = new InstancedBufferAttribute(
//     new Float32Array(count * 16), 16
// );
```

10000 个实例 = 10000 × 16 × 4 = 640 KB。这是额外的 GPU 内存开销，但比 10000 个独立 Mesh 的管理开销小得多。

## per-instance 数据：颜色、自定义属性

除了位置，还可以给每个实例设置颜色或其他自定义数据：

```ts
// per-instance 颜色
const colors = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
    colors[i * 3] = Math.random();
    colors[i * 3 + 1] = Math.random() * 0.5 + 0.5;
    colors[i * 3 + 2] = Math.random() * 0.3;
}
instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
```

自定义 per-instance 属性需要自定义 shader：

```ts
const customAttr = new THREE.InstancedBufferAttribute(
    new Float32Array(count), 1
);
// ... 填充数据
geometry.setAttribute('instanceWeight', customAttr);

// 在 vertex shader 中
// attribute float instanceWeight; // Three.js 自动注入
```

## InstancedMesh 的限制

**所有实例共享同一个几何体和材质**。如果 10000 棵树里有 5 种不同的树模型，需要 5 个 InstancedMesh。

**不能单独控制某个实例的可见性**。如果要隐藏第 42 号实例，只能把它移到屏幕外或 scale 到 0：

```ts
// "隐藏"实例 42
const matrix = new THREE.Matrix4();
matrix.makeScale(0, 0, 0); // 不可见
instancedMesh.setMatrixAt(42, matrix);
instancedMesh.instanceMatrix.needsUpdate = true;
```

**Frustum culling 是对整个 InstancedMesh 做的**，不是对单个实例。如果包围盒不在视锥内，所有实例都不渲染。这对散布在大范围的实例是个问题——相机只看到一小部分，但 GPU 画了全部。

解决办法：对大范围实例做空间分区，每个分区一个 InstancedMesh。

## BatchedMesh：Three.js 的新方案

`BatchedMesh`（Three.js r152+）比 InstancedMesh 更灵活：

```ts
const batchedMesh = new BatchedMesh(
    10000,    // 最大实例数
    1000000,  // 最大顶点数
    1000000   // 最大索引数
);

// 可以添加不同的几何体
for (let i = 0; i < 10000; i++) {
    const geometryId = batchedMesh.addGeometry(treeGeometries[i % 5]);
    const matrix = new THREE.Matrix4();
    // ... 设置矩阵
    batchedMesh.setMatrixAt(geometryId, matrix);
}

batchedMesh.material = sharedMaterial;
```

BatchedMesh 的优势：

- 支持多种不同几何体
- 可以单独控制每个实例
- 仍然是一次 draw call（内部做了几何体合并）

劣势：

- 构建时间更长（需要合并几何体）
- 内存开销更大（所有几何体数据都在一个大 buffer 里）
- 不适合动态变化的几何体

## 选择指南

| 需求 | 方案 |
|---|---|
| 同一模型大量重复 | InstancedMesh |
| 不同模型但相同材质 | BatchedMesh |
| 需要 per-instance 物理 | InstancedMesh + 自定义属性 |
| 需要单独控制可见性 | BatchedMesh |
| 动态几何体 | 普通 Mesh |

## 练习

### 练习一：实例化粒子场

用 InstancedMesh 创建 50000 个旋转的立方体。要求：

- 每个实例有独立的旋转速度（存在自定义 attribute 里）
- 在 vertex shader 中实现旋转
- 测量 FPS

### 练习二：InstancedMesh 视锥裁剪优化

创建 10000 个实例，分布在 500×500 的区域内。实现空间分区：

1. 把区域分成 10×10 的格子
2. 每个格子一个 InstancedMesh
3. 每帧只渲染相机所在格子及相邻格子的 InstancedMesh

对比优化前后的 draw call 数量和 FPS。

### 练习三：BatchedMesh 实验

用 BatchedMesh 创建一个包含 5 种不同几何体（box、sphere、cone、cylinder、torus）的场景，每种 2000 个实例。对比 BatchedMesh 和 5 个 InstancedMesh 的性能。

---

## 参考答案

### 练习一

```ts
const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const count = 50000;
const instancedMesh = new THREE.InstancedMesh(geometry, material, count);

// 设置 per-instance 旋转速度
const rotationSpeeds = new Float32Array(count);
for (let i = 0; i < count; i++) {
    rotationSpeeds[i] = Math.random() * 2 + 0.5;
}
geometry.setAttribute('rotationSpeed',
    new THREE.InstancedBufferAttribute(rotationSpeeds, 1));

// vertex shader
// attribute float rotationSpeed;
// uniform float time;
// void main() {
//     float angle = time * rotationSpeed;
//     mat2 rot = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
//     vec3 pos = position;
//     pos.xz = rot * pos.xz;
//     gl_Position = projectionMatrix * modelViewMatrix
//                 * instanceMatrix * vec4(pos, 1.0);
// }
```

### 练习二

10×10 格子 = 100 个 InstancedMesh。相机在中心格子时，只渲染 9 个格子（3×3），draw call 从 100 降到 9。但每个格子的实例数变多了（约 100 个 vs 原来的整个 10000 个），所以每个 draw call 的 GPU 工作量不变。总体收益取决于裁剪比例。

### 练习三

BatchedMesh 构建时间更长，但渲染时 draw call 更少（1 vs 5）。如果几何体数量多、种类少，InstancedMesh 更简单高效；如果种类多但每种数量少，BatchedMesh 更合适。
