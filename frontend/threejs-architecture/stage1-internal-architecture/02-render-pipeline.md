# 渲染管线——WebGLRenderer 内部流程、RenderList 排序、材质切换

## 一帧画面是怎么出来的

你调用 `renderer.render(scene, camera)` 时，Three.js 不是直接把场景丢给 GPU。它在 CPU 端做了大量准备工作：遍历场景图、收集物体、排序、生成 WebGL 命令。理解这个流程，才能理解为什么"减少 draw call"比"减少三角形"更重要。

## WebGLRenderer.render() 的主流程

简化后的核心流程：

```ts
render(scene, camera) {
    // 1. 更新场景矩阵
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();

    // 2. 准备渲染列表
    this._renderLists = this._renderListCompiler.compile(scene);

    // 3. 渲染背景
    this._renderBackground(scene);

    // 4. 不透明物体（前到后）
    this._renderObjects(opaqueList, scene, camera);

    // 5. 透明物体（后到前）
    this._renderObjects(transparentList, scene, camera);
}
```

每一步都有设计考量。

## RenderList：CPU 端的物体收集

Three.js 遍历场景图，把所有可见的 Mesh 收集到一个列表里。这个列表叫 `RenderList`，由 `WebGLRenderLists` 管理。

收集过程考虑：

- `visible === false` 的物体跳过
- `frustumCulled === true`（默认）且不在视锥内的物体跳过
- 物体的世界包围盒用于视锥裁剪

```ts
// 简化的视锥裁剪
if (object.frustumCulled) {
    const frustum = new Frustum().setFromProjectionMatrix(
        camera.projectionMatrix * camera.matrixWorldInverse
    );
    if (!frustum.intersectsObject(object)) {
        return; // 跳过
    }
}
```

## 排序策略：为什么分两组

RenderList 被分成两组：

**不透明组**：按 `material.id` 排序（前到后 z 顺序是次要的）

**透明组**：按物体到相机的距离排序（后到前）

为什么？

不透明物体的 z-buffer 会自动处理遮挡，所以渲染顺序不影响正确性。但材质切换很贵——切换材质意味着切换 shader program、重新绑定 uniform 和 texture。按材质排序让相同材质的物体连续渲染，减少切换次数。

透明物体没有 z-buffer（需要 alpha blending），必须从后往前渲染才能得到正确的混合结果。所以按距离排序。

```ts
// 排序函数
function painterSortStable(a, b) {
    if (a.material.id !== b.material.id) {
        return a.material.id - b.material.id;
    }
    if (a.renderOrder !== b.renderOrder) {
        return a.renderOrder - b.renderOrder;
    }
    return a.z - b.z; // z 作为 tie-breaker
}

function reversePainterSortStable(a, b) {
    if (a.renderOrder !== b.renderOrder) {
        return a.renderOrder - b.renderOrder;
    }
    if (a.material.id !== b.material.id) {
        return a.material.id - b.material.id;
    }
    return b.z - a.z; // 远的先渲染
}
```

## 渲染单个物体的流程

对列表中的每个物体，Three.js 做：

1. 检查 material 是否和上一个物体相同，如果不同则切换
2. 绑定 geometry（VBO/VAO）
3. 设置 uniform（modelMatrix, viewMatrix, normalMatrix 等）
4. 调用 `gl.drawElements()` 或 `gl.drawArrays()`

```ts
// 简化版
function renderObject(object, scene, camera, geometry, material) {
    if (material !== currentMaterial) {
        currentMaterial?.deactivate();
        material.activate(); // 编译/切换 shader, 绑定 uniform
        currentMaterial = material;
    }

    // 绑定几何体
    state.setVertexArrays(geometry);

    // 设置物体特定的 uniform
    program.setUniform('modelMatrix', object.matrixWorld);
    program.setUniform('normalMatrix', object.normalMatrix);

    // Draw call
    gl.drawElements(gl.TRIANGLES, geometry.index.count, gl.UNSIGNED_INT, 0);
}
```

## 材质切换的真实成本

一次材质切换涉及：

- 切换 shader program（`gl.useProgram()`）
- 重新绑定所有 uniform
- 重新绑定所有 texture
- 可能切换 blend mode、depth test 状态

这比一次 draw call 本身贵得多。这也是为什么"减少 draw call"在 Three.js 里是首要优化方向——不是因为 GPU 画不动，而是因为 CPU 端的状态切换太贵。

一个简单的实验：

```ts
// 场景 A：100 个物体，100 种材质 → 100 次材质切换
// 场景 B：100 个物体，1 种材质 → 1 次材质切换
// 场景 B 的帧率通常是场景 A 的 3-5 倍
```

## 理解 WebGLProgram 缓存

Three.js 不会为每个 Mesh 重新编译 shader。它用材质的 hash 值做缓存：

```ts
// 材质 hash 包含：类型 + 参数组合
// 两个参数完全相同的 MeshMaterial 会共享同一个 WebGLProgram
```

但如果你为每个物体创建了独立的 material 实例（即使参数相同），hash 就不同，会编译多份 shader。

```ts
// 错误：100 次编译
for (let i = 0; i < 100; i++) {
    const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: 0xff0000 }) // 每次 new
    );
}

// 正确：1 次编译
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
for (let i = 0; i < 100; i++) {
    const mesh = new THREE.Mesh(geometry, material); // 共享
}
```

## 从渲染管线看架构决策

Three.js 的渲染管线设计反映了几个工程判断：

**CPU 是瓶颈，不是 GPU**：排序、状态管理、uniform 上传都在 CPU 端。GPU 端的渲染通常很快。优化重点在减少 CPU 工作量。

**批处理的代价**：排序本身有 O(n log n) 的成本，但如果材质切换从 100 次降到 5 次，这个排序就值得。

**默认保守，手动激进**：默认 `frustumCulled = true` 是安全的，但如果你知道所有物体都在视锥内（如 UI 场景），关掉可以省掉包围盒计算。

**渲染顺序是正确性问题**：透明物体必须后到前渲染，这不是优化而是正确性要求。renderOrder 属性让你在材质相同的情况下也能控制顺序。

## 练习

### 练习一：测量材质切换

创建一个场景，200 个物体，分三种情况：

1. 每个物体独立 material 实例（参数相同）
2. 所有物体共享一个 material 实例
3. 200 个物体分 5 组，每组共享一个 material

用 `renderer.info` 读取 draw call 数量和 program 数量，记录差异。

### 练习二：renderOrder 实验

创建两个透明物体 A 和 B，让它们在空间上重叠。分别设置：

- A.renderOrder = 0, B.renderOrder = 0
- A.renderOrder = 1, B.renderOrder = 0

观察渲染结果差异，解释原因。

### 练习三：源码追踪

在 Three.js 源码中找到 `WebGLRenderLists` 和 `WebGLRenderList`，回答：

1. RenderList 是怎么在帧之间复用的？
2. `renderOrder` 在排序中排第几位？
3. 为什么透明和不透明物体要分成两个数组？

---

## 参考答案

### 练习一

预期 `renderer.info`：

1. 独立 material：`info.render.calls = 200`，`info.programs.length` 可能大于 1（如果 hash 不同）
2. 共享 material：`info.render.calls = 200`（draw call 数不变），`info.programs.length = 1`
3. 5 组共享：`info.render.calls = 200`，`info.programs.length = 5`

draw call 数量不变，变的是 shader program 数量和材质切换次数。减少 draw call 需要的是 InstancedMesh 或 BatchedMesh。

### 练习二

renderOrder = 0 时，两个透明物体按距离排序（后到前）。renderOrder 不同时，renderOrder 小的先渲染。如果 A.renderOrder = 1，A 会后渲染，覆盖在 B 上面。

### 练习三

1. RenderList 在 WebGLRenderLists 中按 scene 和 camera 的 id 缓存，每帧复用同一个 list 对象，用 `.init()` 清空而不是重新创建。
2. 排序优先级：renderOrder > material.id > z distance。
3. 因为排序策略不同——不透明按材质排序优化切换，透明按距离排序保证正确性。
