# 阶段实战：构建支持 10 万面片的场景管理器

## 目标

把前四节课的内容组合起来，构建一个能够高效渲染 10 万面片场景的管理器。这不是一个完整引擎，而是一个验证架构思路的原型。

要求：

1. 场景中有多种物体（建筑、植被、地面）
2. 相机可以自由移动
3. 帧率保持在 30fps 以上（中端 GPU）

## 架构设计

```
SceneManager
├── SpatialIndex          ← 场景分区（Octree）
├── ResourcePool          ← 资源缓存与释放
├── InstanceManager       ← 实例化渲染
├── LODController         ← 细节层级管理
└── CullingSystem         ← 可见性判断
```

## 第一步：场景数据生成

先创建测试数据。10 万面片意味着大约 5 万个三角形（每面片 2 个三角形）。

```ts
interface SceneObject {
    id: number;
    type: 'building' | 'tree' | 'ground' | 'rock';
    position: THREE.Vector3;
    rotation: number;
    scale: number;
}

function generateSceneData(count: number): SceneObject[] {
    const objects: SceneObject[] = [];
    const types: SceneObject['type'][] = ['building', 'tree', 'ground', 'rock'];

    for (let i = 0; i < count; i++) {
        objects.push({
            id: i,
            type: types[Math.floor(Math.random() * types.length)],
            position: new THREE.Vector3(
                Math.random() * 500 - 250,
                0,
                Math.random() * 500 - 250
            ),
            rotation: Math.random() * Math.PI * 2,
            scale: 0.5 + Math.random() * 1.5
        });
    }
    return objects;
}
```

## 第二步：资源池

为每种物体类型创建几何体和材质的共享池：

```ts
class ResourcePool {
    private geometries = new Map<string, THREE.BufferGeometry>();
    private materials = new Map<string, THREE.Material>();

    registerGeometry(type: string, geometry: THREE.BufferGeometry) {
        this.geometries.set(type, geometry);
    }

    registerMaterial(type: string, material: THREE.Material) {
        this.materials.set(type, material);
    }

    getGeometry(type: string): THREE.BufferGeometry {
        return this.geometries.get(type)!;
    }

    getMaterial(type: string): THREE.Material {
        return this.materials.get(type)!;
    }

    dispose() {
        this.geometries.forEach(g => g.dispose());
        this.materials.forEach(m => m.dispose());
    }
}

// 初始化
const pool = new ResourcePool();
pool.registerGeometry('tree', new THREE.CylinderGeometry(0.1, 0.3, 5, 6));
pool.registerGeometry('building', new THREE.BoxGeometry(10, 20, 10));
pool.registerGeometry('rock', new THREE.DodecahedronGeometry(2, 0));
```

## 第三步：实例化渲染管理

同类物体用 InstancedMesh：

```ts
class InstanceManager {
    private instances = new Map<string, THREE.InstancedMesh>();
    private objectMap = new Map<number, { type: string; index: number }>();

    create(type: string, geometry: THREE.BufferGeometry,
           material: THREE.Material, maxCount: number) {
        const mesh = new THREE.InstancedMesh(geometry, material, maxCount);
        mesh.count = 0;
        this.instances.set(type, mesh);
        return mesh;
    }

    addObject(obj: SceneObject, matrix: THREE.Matrix4) {
        const instance = this.instances.get(obj.type)!;
        const index = instance.count;
        instance.setMatrixAt(index, matrix);
        instance.count++;
        instance.instanceMatrix.needsUpdate = true;
        this.objectMap.set(obj.id, { type: obj.type, index });
    }

    getMesh(type: string): THREE.InstancedMesh {
        return this.instances.get(type)!;
    }
}
```

## 第四步：空间索引

用简化的网格分区（比 Octree 实现简单，效果足够）：

```ts
class GridIndex {
    private cellSize: number;
    private cells = new Map<string, SceneObject[]>();

    constructor(cellSize = 50) {
        this.cellSize = cellSize;
    }

    private getKey(x: number, z: number): string {
        const cx = Math.floor(x / this.cellSize);
        const cz = Math.floor(z / this.cellSize);
        return `${cx},${cz}`;
    }

    insert(obj: SceneObject) {
        const key = this.getKey(obj.position.x, obj.position.z);
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key)!.push(obj);
    }

    query(center: THREE.Vector3, radius: number): SceneObject[] {
        const result: SceneObject[] = [];
        const minCx = Math.floor((center.x - radius) / this.cellSize);
        const maxCx = Math.floor((center.x + radius) / this.cellSize);
        const minCz = Math.floor((center.z - radius) / this.cellSize);
        const maxCz = Math.floor((center.z + radius) / this.cellSize);

        for (let cx = minCx; cx <= maxCx; cx++) {
            for (let cz = minCz; cz <= maxCz; cz++) {
                const cell = this.cells.get(`${cx},${cz}`);
                if (cell) result.push(...cell);
            }
        }
        return result;
    }
}
```

## 第五步：LOD 控制

根据相机距离切换实例的细节层级：

```ts
class LODController {
    private levels = new Map<string, {
        distances: number[];
        meshes: THREE.InstancedMesh[];
    }>();

    addLevel(type: string, distance: number, mesh: THREE.InstancedMesh) {
        if (!this.levels.has(type)) {
            this.levels.set(type, { distances: [], meshes: [] });
        }
        const level = this.levels.get(type)!;
        level.distances.push(distance);
        level.meshes.push(mesh);
    }

    update(cameraPosition: THREE.Vector3) {
        for (const [type, level] of this.levels) {
            // 简化：基于相机到原点的距离
            const distance = cameraPosition.length();
            for (let i = 0; i < level.meshes.length; i++) {
                level.meshes[i].visible = (i === 0) ||
                    (distance > level.distances[i - 1] && distance <= level.distances[i]);
            }
        }
    }
}
```

## 第六步：组装

```ts
function setupSceneManager(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    const pool = new ResourcePool();
    const instanceManager = new InstanceManager();
    const gridIndex = new GridIndex(50);
    const lodController = new LODController();

    // 注册资源
    pool.registerGeometry('tree', treeGeometry);
    pool.registerMaterial('tree', treeMaterial);

    // 创建实例化网格
    const treeMesh = instanceManager.create('tree', treeGeometry, treeMaterial, 50000);
    scene.add(treeMesh);

    // 生成场景数据
    const objects = generateSceneData(50000);

    // 插入空间索引
    for (const obj of objects) {
        gridIndex.insert(obj);
    }

    // 每帧更新
    function update(camera: THREE.Camera) {
        const camPos = camera.position;
        const visibleObjects = gridIndex.query(camPos, 200);

        // 重建实例化数据
        treeMesh.count = 0;
        const dummy = new THREE.Object3D();
        for (const obj of visibleObjects) {
            dummy.position.copy(obj.position);
            dummy.rotation.y = obj.rotation;
            dummy.scale.setScalar(obj.scale);
            dummy.updateMatrix();
            treeMesh.setMatrixAt(treeMesh.count, dummy.matrix);
            treeMesh.count++;
        }
        treeMesh.instanceMatrix.needsUpdate = true;
    }

    return { update };
}
```

## 性能分析

预期性能瓶颈：

1. **空间索引查询**：如果格子大小合适，查询是 O(1)
2. **实例矩阵更新**：每帧重置所有实例的矩阵，O(k)，k 是可见物体数
3. **draw call**：物体类型数 = draw call 数，通常 < 10
4. **GPU 三角形**：10 万面 = 5 万三角形，GPU 轻松处理

实际瓶颈在 JavaScript 端的矩阵计算。如果每帧有 10000 个可见物体需要更新矩阵，`dummy.updateMatrix()` 调用 10000 次就是成本。

优化方向：避免每帧重建，只在相机移动超过阈值时更新。

## 练习

### 练习一：完成场景管理器

基于上面的代码，完成一个可运行的场景管理器。要求：

- 至少支持 3 种物体类型
- 相机用 OrbitControls 或 FlyControls
- 显示 FPS 和 draw call 数量

### 练习二：添加空间分区优化

当前代码每帧查询所有可见物体。添加一个"脏标记"——只有当相机移动超过 10 个单位时才重新查询。

### 练习三：性能瓶颈定位

用 Chrome DevTools 的 Performance 面板录制 10 秒的运行数据。找出：

1. JavaScript 执行时间最长的函数
2. 每帧的总耗时
3. 是否有长任务（>16ms）

---

## 参考答案

### 练习一

完整代码较长，核心框架已在上面给出。关键补充：

```ts
// 初始化
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 50, 100);

const controls = new OrbitControls(camera, renderer.domElement);
const manager = setupSceneManager(scene, renderer);

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    manager.update(camera);
    renderer.render(scene, camera);
}
animate();
```

### 练习二

```ts
let lastCameraPosition = new THREE.Vector3();
const UPDATE_THRESHOLD = 10;

function update(camera: THREE.Camera) {
    if (camera.position.distanceTo(lastCameraPosition) < UPDATE_THRESHOLD) {
        return; // 相机没怎么动，跳过
    }
    lastCameraPosition.copy(camera.position);
    // ... 原有的更新逻辑
}
```

### 练习三

用 Chrome DevTools 的 Performance 面板录制。常见发现：

1. `updateMatrix()` 和 `setMatrixAt()` 是主要耗时
2. `renderer.render()` 内部的 `projectObject` 遍历是第二大耗时
3. 如果有 GC 峰值，说明有临时对象创建（如 new Vector3 在循环里）
