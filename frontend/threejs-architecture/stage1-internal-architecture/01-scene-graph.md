# 场景图设计——Object3D 父子关系、矩阵更新链、dirty flag

## 从一个常见的困惑开始

很多人用 Three.js 写出过这样的代码：

```ts
const parent = new THREE.Group()
const child = new THREE.Mesh(geometry, material)
parent.add(child)
parent.position.x = 5
```

然后发现 `child` 也跟着移动了。这看起来"理所当然"，但背后的机制决定了你在大型场景里能不能写出高效代码。

问题在于：Three.js 是怎么知道 `child` 的世界坐标变了？它什么时候重新计算？如果一个场景有 5000 个物体，每一帧都重新计算所有矩阵，性能撑不住。它怎么避免的？

## Object3D 不是"物体"，是场景图节点

`Object3D` 是 Three.js 场景图的基本单元。Mesh、Group、Camera、Light、Bone 全部继承自它。

一个 Object3D 持有：

- `position`: Vector3，局部坐标
- `quaternion`: Quaternion，局部旋转
- `scale`: Vector3，局部缩放
- `matrix`: Matrix4，局部变换矩阵
- `matrixWorld`: Matrix4，世界变换矩阵
- `children`: Object3D[]，子节点
- `parent`: Object3D | null，父节点

父子关系通过 `add()` 和 `remove()` 建立。调用 `parent.add(child)` 时，Three.js 做了三件事：

1. 如果 child 已经有旧 parent，先从旧 parent 的 children 里移除
2. 把 child 加到 parent.children
3. 设置 child.parent = parent

```ts
// three.js/src/core/Object3D.js 简化版
add(object) {
    if (object.parent !== null) {
        object.parent.remove(object);
    }
    object.parent = this;
    this.children.push(object);
}
```

场景图是一棵树。`Scene` 是根节点。渲染器从 Scene 开始遍历，遇到 Camera 记录视角，遇到 Mesh 记录待渲染物体，遇到 Light 收集光照信息。

## 矩阵更新链：从局部到世界

每个 Object3D 的 `matrix` 由 `position`、`quaternion`、`scale` 计算得来：

```ts
// Object3D.updateMatrix()
updateMatrix() {
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.matrixWorldNeedsUpdate = true;
}
```

世界矩阵 `matrixWorld` 不是直接算的，而是从 parent 一路乘下来：

```
child.matrixWorld = parent.matrixWorld × child.matrix
```

这在 `updateMatrixWorld()` 里递归完成：

```ts
// 简化版
updateMatrixWorld(force) {
    if (this.matrixAutoUpdate) this.updateMatrix();
    if (this.matrixWorldNeedsUpdate || force) {
        if (this.parent === null) {
            this.matrixWorld.copy(this.matrix);
        } else {
            this.matrixWorld.multiplyMatrices(
                this.parent.matrixWorld,
                this.matrix
            );
        }
        this.matrixWorldNeedsUpdate = false;
        force = true;
    }
    // 递归更新所有子节点
    for (const child of this.children) {
        child.updateMatrixWorld(force);
    }
}
```

关键设计：`force` 参数。如果 parent 的 matrixWorld 更新了（force = true），所有子节点都要重新计算。如果 parent 没变，子节点如果自己也没变，就跳过。

## Dirty Flag：延迟更新的核心

Three.js 不在你修改 position 的瞬间重算矩阵。它设一个标记，等下一帧渲染时统一处理。

```ts
// 当你写 position.x = 5 时
// 只是改了值，没有触发任何计算

// 渲染前，renderer 会调用 scene.updateMatrixWorld()
// 这时候才真正算矩阵
```

这就是 dirty flag 模式。好处是：

- 同一帧内多次修改 position，只算一次
- 没动过的物体不重算
- 子树如果没变化，递归直接跳过

坏处是：

- 如果你在渲染前读 `matrixWorld`，可能拿到旧值
- 需要手动调用 `updateMatrixWorld()` 才能保证读到最新值

这个设计在实时渲染场景里非常合理——写入频率远高于读取频率，延迟到读取时才计算是最优策略。

## 真实问题：矩阵更新的性能瓶颈

在大型场景里，`updateMatrixWorld()` 的递归遍历本身就有开销。如果你有 10000 个 Object3D，即使大部分没动，遍历 10000 次 `for (const child of this.children)` 也是成本。

Three.js 的优化是 `matrixWorldNeedsUpdate` 标记。只有标记为 true 的节点才重算 matrixWorld。但递归遍历本身还是会走完整棵树。

一个常见的错误优化思路是"把不动的物体移到独立 Group"。这不解决问题——遍历还是走全树。

有效的优化方向：

1. 减少 Object3D 数量（合并几何体）
2. 使用 `matrixAutoUpdate = false` 手动控制矩阵
3. 对完全静态的物体，渲染前设 `matrixAutoUpdate = false`，初始化时算一次 matrixWorld

```ts
// 静态物体优化
staticMesh.matrixAutoUpdate = false;
staticMesh.updateMatrix();
staticMesh.updateMatrixWorld();
```

## 从这个设计学到什么

Three.js 的场景图设计体现了几个通用的架构判断：

- **延迟计算**：改值时不计算，读取时才计算，用 dirty flag 追踪
- **树形传播**：父节点的变化自然传播到子节点，不需要单独通知
- **增量更新**：没变的子树跳过，用标记避免无意义计算
- **组合优于继承**：Object3D 是通用节点，Mesh/Camera/Light 是"组合"了不同能力的特化

这些模式在任何有层级结构的系统里都可能出现——DOM 树、UI 组件树、文件系统、组织架构。

## 练习

### 练习一：手动实现 dirty flag

实现一个简单的 `TransformNode` 类，支持父子关系和 dirty flag。要求：

- 设置 position/rotation/scale 时标记 dirty
- 获取 worldTransform 时，如果 dirty 才重算
- 子节点在父节点变化时自动 dirty

```ts
class TransformNode {
    // 你的实现
}
```

### 练习二：阅读 Three.js 源码

在 Three.js 源码中找到 `Object3D.updateMatrixWorld()` 的实现，回答：

1. `matrixWorldNeedsUpdate` 和 `force` 参数分别控制什么？
2. 为什么 `matrixAutoUpdate` 的判断在 `matrixWorldNeedsUpdate` 之前？
3. 如果你设了 `matrixAutoUpdate = false` 但没手动调 `updateMatrix()`，会发生什么？

### 练习三：性能实验

创建一个包含 5000 个 Object3D 的场景，用 `performance.now()` 测量：

1. 所有物体 `matrixAutoUpdate = true` 时，`scene.updateMatrixWorld()` 耗时
2. 所有物体 `matrixAutoUpdate = false` 时，耗时
3. 只有 100 个物体 `matrixAutoUpdate = true`，其余 false，耗时

记录数据，解释差异。

---

## 参考答案

### 练习一

```ts
class TransformNode {
    position = { x: 0, y: 0, z: 0 };
    rotation = { x: 0, y: 0, z: 0 };
    scale = { x: 1, y: 1, z: 1 };
    parent: TransformNode | null = null;
    children: TransformNode[] = [];
    private _dirty = true;
    private _worldMatrix = new Float32Array(16);

    add(child: TransformNode) {
        if (child.parent) child.parent.remove(child);
        child.parent = this;
        this.children.push(child);
        child._markDirty();
    }

    remove(child: TransformNode) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parent = null;
        }
    }

    private _markDirty() {
        this._dirty = true;
        for (const child of this.children) child._markDirty();
    }

    get worldMatrix(): Float32Array {
        if (this._dirty) {
            // 简化：实际需要 compose + multiply
            this._dirty = false;
        }
        return this._worldMatrix;
    }
}
```

**常见错误**：只标记自己 dirty，忘了递归标记子节点。

### 练习二

1. `matrixAutoUpdate` 控制是否从 position/quaternion/scale 重新计算局部矩阵。`matrixWorldNeedsUpdate` 控制是否需要重算世界矩阵。`force` 是从父节点传播下来的"父节点变了"信号。

2. 因为即使 `matrixAutoUpdate = false`（局部矩阵不变），如果父节点的 matrixWorld 变了，子节点的 matrixWorld 仍然需要更新。

3. 局部矩阵 `matrix` 保持初始化时的值（默认单位矩阵），matrixWorld 也会基于这个值计算。物体不会随 position 变化而移动。

### 练习三

预期结果：

- 全部 true：遍历 5000 节点，每个都 compose + multiply，耗时最长
- 全部 false：遍历 5000 节点，但跳过 compose，只检查 force/needsUpdate，快很多
- 100 true + 4900 false：遍历全树，但只有 100 个做实际计算，接近全 false 的耗时

遍历成本是固定的，计算成本是可变的。减少"真正需要计算的节点数"比减少遍历更有效。
