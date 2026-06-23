# 场景分区——Octree/BVH/Portal Culling 原理与实现

## 视锥裁剪不够用

上一阶段我们看到 Three.js 用视锥裁剪跳过不在视野内的物体。这对几百个物体的场景够用，但对几万个物体的大型场景，逐个检查包围盒本身就有成本。更糟的是，视锥裁剪只解决"看不看得到"，不解决"怎么快速找到附近的物体"——比如碰撞检测需要"找到我周围 5 米内的所有物体"。

场景分区的目标：把 O(n) 的遍历变成 O(log n) 的查找。

## 空间划分的三种思路

**均匀网格（Grid）**：把空间切成等大的格子。简单，但物体跨格子时处理麻烦，且空间利用率低。

**层次结构（Octree / BVH）**：递归地把空间分成更小的区域。自适应物体分布，但树的维护成本更高。

**可见性集（Portal / PVS）**：基于连通性判断哪些区域可能互相可见。适合室内场景，实现复杂。

大多数 3D 应用用的是 Octree 或 BVH。

## Octree：八叉树

Octree 把每个空间节点分成 8 个子节点（2×2×2）。如果一个子节点里的物体数量超过阈值，继续细分。

```ts
class OctreeNode {
    bounds: Box3;
    children: OctreeNode[] = [];
    objects: Object3D[] = [];
    depth: number;
    maxDepth = 8;
    maxObjects = 10;

    insert(object: Object3D): boolean {
        // 检查物体是否在这个节点的范围内
        if (!this.bounds.containsBox(getBoundingBox(object))) return false;

        // 如果还有空间或达到最大深度，存这里
        if (this.objects.length < this.maxObjects || this.depth >= this.maxDepth) {
            this.objects.push(object);
            return true;
        }

        // 需要细分
        if (this.children.length === 0) this.subdivide();

        // 尝试插入子节点
        for (const child of this.children) {
            if (child.insert(object)) return true;
        }

        // 物体跨多个子节点，存在父节点
        this.objects.push(object);
        return true;
    }

    subdivide(): void {
        const center = new THREE.Vector3();
        this.bounds.getCenter(center);
        const halfSize = new THREE.Vector3();
        this.bounds.getSize(halfSize).multiplyScalar(0.5);

        // 创建 8 个子节点
        for (let i = 0; i < 8; i++) {
            const childBounds = new THREE.Box3();
            childBounds.min.set(
                center.x + (i & 1 ? 0 : -halfSize.x),
                center.y + (i & 2 ? 0 : -halfSize.y),
                center.z + (i & 4 ? 0 : -halfSize.z)
            );
            childBounds.max.copy(childBounds.min).add(halfSize);

            const child = new OctreeNode(childBounds, this.depth + 1);
            this.children.push(child);
        }
    }

    queryFrustum(frustum: Frustum): Object3D[] {
        const result: Object3D[] = [];

        // 如果这个节点不在视锥内，跳过整个子树
        if (!frustum.intersectsBox(this.bounds)) return result;

        // 这个节点里的物体（跨子节点的）
        result.push(...this.objects);

        // 递归子节点
        for (const child of this.children) {
            result.push(...child.queryFrustum(frustum));
        }

        return result;
    }
}
```

Octree 的查询从 O(n) 变成了 O(k + log n)，其中 k 是可见物体数。

## BVH：层次包围盒

BVH 和 Octree 的区别：BVH 不切分空间，而是把物体分组。每组用一个包围盒包起来，然后递归。

```ts
class BVHNode {
    bounds: Box3;
    left: BVHNode | null = null;
    right: BVHNode | null = null;
    objects: Object3D[] = []; // 只有叶子节点有

    // 用 SAH（Surface Area Heuristic）构建
    static build(objects: Object3D[]): BVHNode {
        const node = new BVHNode();
        node.bounds = computeBounds(objects);

        if (objects.length <= 4) {
            node.objects = objects;
            return node;
        }

        // 找最佳分割轴和位置
        const { axis, splitPos } = findBestSplit(objects);
        const left: Object3D[] = [];
        const right: Object3D[] = [];

        for (const obj of objects) {
            const center = getCenter(obj);
            if (center[axis] < splitPos) {
                left.push(obj);
            } else {
                right.push(obj);
            }
        }

        node.left = BVHNode.build(left);
        node.right = BVHNode.build(right);
        return node;
    }
}
```

BVH 在光线追踪中用得最多——`THREE.Mesh` 的 `raycast` 可以用 BVH 加速。Three.js 社区有 `three-mesh-bvh` 库专门做这个。

## Portal Culling：室内场景的利器

Portal Culling 的思路完全不同：不切分空间，而是基于房间和门（portal）判断可见性。

```
[房间 A] --- 门1 --- [房间 B] --- 门2 --- [房间 C]
```

如果你在房间 A，通过门 1 可以看到房间 B，通过门 1+门 2 可以看到房间 C。但如果你背对着门 1，房间 B 和 C 都不需要渲染。

实现思路：

1. 把场景分成多个 cell（房间）
2. 每个 cell 有若干 portal（门/窗）
3. 渲染时，从当前 cell 开始，检查每个 portal 是否在视锥内
4. 如果在，渲染 portal 连接的 cell，并递归

这种方法在室内场景（建筑可视化、游戏关卡）中非常高效，因为它直接利用了场景的连通性。

## Three.js 内置的分区支持

Three.js 核心不包含场景分区，但有社区方案：

- `three-mesh-bvh`：BVH 加速的 raycast 和 geometry 查询
- `three-octree`：Octree 实现
- `three-instanced-mesh`：内置的实例化渲染（严格来说不是分区，但解决类似问题）

Three.js 的设计哲学是保持核心精简，分区作为外部库。

## 选择哪种方案

| 场景特征 | 推荐方案 |
|---|---|
| 户外、物体分布均匀 | 均匀网格 |
| 户外、物体分布不均 | Octree |
| 需要快速 raycast | BVH |
| 室内场景 | Portal Culling |
| 动态物体多 | 简单网格或不做分区 |

没有银弹。分区本身有构建和维护成本，如果场景物体少于 1000 个，直接遍历可能更快。

## 练习

### 练习一：实现简化版 Octree

用 Three.js 的 Box3 和 Vector3 实现一个 Octree，支持：

- `insert(object, boundingBox)` 插入物体
- `queryBox(box)` 查询与给定 Box3 相交的所有物体
- `querySphere(center, radius)` 查询球形范围内的所有物体

### 练习二：Octree vs 暴力遍历性能对比

创建 10000 个随机分布的 Mesh，分别用 Octree 和直接遍历做 1000 次球形范围查询。测量总耗时。

```ts
const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 50);

// 暴力遍历
function bruteForceQuery(objects, sphere) {
    return objects.filter(obj => sphere.containsPoint(obj.position));
}
```

### 练习三：BVH raycast 集成

使用 `three-mesh-bvh` 库，为一个高面数模型（>10 万面）构建 BVH。对比 BVH raycast 和默认 raycast 的性能差异。

---

## 参考答案

### 练习一

```ts
class SimpleOctree {
    private root: OctreeNode;
    constructor(bounds: THREE.Box3) {
        this.root = new OctreeNode(bounds, 0);
    }
    insert(object: THREE.Object3D) {
        this.root.insert(object);
    }
    queryBox(box: THREE.Box3): THREE.Object3D[] {
        return this.root.queryBox(box);
    }
}
```

关键细节：物体跨多个子节点时，存在父节点中。这保证了查询的正确性，但可能让某些节点的物体列表很长。

### 练习二

预期结果：Octree 查询在场景物体多时显著快于暴力遍历。但 Octree 构建本身有成本。如果只做一次查询，暴力更快；如果做 1000 次查询，Octree 的构建成本被摊薄。

### 练习三

```ts
import { computeBoundsTree, MeshBVH } from 'three-mesh-bvh';

geometry.computeBoundsTree(); // 构建 BVH
const mesh = new THREE.Mesh(geometry, material);

// raycast 自动使用 BVH
const raycaster = new THREE.Raycaster();
const intersects = raycaster.intersectObject(mesh);
```

高面数模型上，BVH raycast 可以快 10-100 倍。
