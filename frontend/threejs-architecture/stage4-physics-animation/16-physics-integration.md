# 物理引擎集成——Cannon.js/Ammo.js/Rapier 对比、与 Three.js 同步

## 为什么 3D 场景需要物理

物体碰撞、重力下落、刚体堆叠——这些效果如果手写，需要自己实现碰撞检测、速度积分、约束求解。物理引擎把这些都封装好了，你只需要描述物体的物理属性（质量、摩擦、弹性），引擎告诉你每帧物体该在哪里。

## 三种主流物理引擎

### Cannon.js / cannon-es

纯 JavaScript 实现，API 简洁，社区维护版 cannon-es 持续更新。

```ts
import * as CANNON from 'cannon-es';

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

// 创建物理球体
const sphereBody = new CANNON.Body({
    mass: 5,
    shape: new CANNON.Sphere(1),
    position: new CANNON.Vec3(0, 10, 0)
});
world.addBody(sphereBody);
```

优点：纯 JS，npm 安装即可，调试方便。
缺点：性能一般，复杂场景力不从心。

### Ammo.js

Bullet 物理引擎的 WebAssembly 移植。功能最完整。

```ts
import Ammo from 'ammo.js';

const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
const broadphase = new Ammo.btDbvtBroadphase();
const solver = new Ammo.btSequentialImpulseConstraintSolver();
const world = new Ammo.btDiscreteDynamicsWorld(
    dispatcher, broadphase, solver, collisionConfiguration
);
world.setGravity(new Ammo.btVector3(0, -9.82, 0));
```

优点：功能完整，性能好。
缺点：API 是 C++ 风格，冗长难用。WASM 文件 1MB+。

### Rapier

Rust 编写，WASM 编译，API 现代。

```ts
import RAPIER from '@dimforge/rapier3d';

const world = new RAPIER.World({ x: 0, y: -9.82, z: 0 });

const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, 10, 0);
const rigidBody = world.createRigidBody(rigidBodyDesc);
const colliderDesc = RAPIER.ColliderDesc.ball(1);
world.createCollider(colliderDesc, rigidBody);
```

优点：性能最好，API 现代，支持 WASM 和 JS 两种模式。
缺点：相对新，社区小。

## 选择建议

| 场景 | 推荐 |
|---|---|
| 简单 demo、学习 | cannon-es |
| 复杂物理、工业级 | Rapier |
| 需要 Bullet 全功能 | Ammo.js |
| 移动端、性能敏感 | Rapier |

## 与 Three.js 同步

物理引擎维护自己的世界，Three.js 维护自己的场景。每帧需要同步：

```ts
// cannon-es 同步
function syncPhysics(world: CANNON.World, meshes: Map<CANNON.Body, THREE.Mesh>) {
    world.bodies.forEach(body => {
        const mesh = meshes.get(body);
        if (!mesh) return;

        mesh.position.copy(body.position as any);
        mesh.quaternion.copy(body.quaternion as any);
    });
}

// 每帧
function animate() {
    world.step(1 / 60);
    syncPhysics(world, bodyMeshMap);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
```

关键问题：物理引擎和渲染用不同的坐标/单位系统。Three.js 用 Y 轴朝上，有些物理引擎用 Z 轴朝上。需要转换。

## 碰撞形状

物理引擎不需要用原始网格做碰撞检测——太慢了。用简化形状：

```ts
// cannon-es 形状
new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5))      // 盒子
new CANNON.Sphere(1)                                    // 球体
new CANNON.Cylinder(0.5, 0.5, 2, 8)                    // 圆柱
new CANNON.Plane()                                       // 无限平面
new CANNON.ConvexPolyhedron(vertices, faces)             // 凸多面体
new CANNON.Trimesh(vertices, indices)                    // 三角网格（静态）
```

Trimesh 只能用于静态物体（地面、墙壁），不能用于动态物体——凸包分解是处理复杂动态物体的方式。

## 碰撞事件

```ts
// cannon-es
sphereBody.addEventListener('collide', (event: CANNON.ICollisionEvent) => {
    const contact = event.contact;
    const impactVelocity = contact.getImpactVelocityAlongNormal();
    if (Math.abs(impactVelocity) > 2) {
        // 播放碰撞音效
        playSound('hit');
    }
});
```

## 约束

物理引擎支持各种约束（关节）：

```ts
// cannon-es：HingeConstraint（铰链，如门）
const hingeConstraint = new CANNON.HingeConstraint(doorBody, frameBody, {
    pivotA: new CANNON.Vec3(-1, 0, 0),
    pivotB: new CANNON.Vec3(1, 0, 0),
    axisA: new CANNON.Vec3(0, 1, 0),
    axisB: new CANNON.Vec3(0, 1, 0)
});
world.addConstraint(hingeConstraint);
```

## 时间步长

物理模拟的时间步长是关键参数：

```ts
// 固定时间步长（推荐）
world.step(1 / 60, deltaTime, 3);
// 参数：固定步长、实际经过时间、最大子步数
```

固定步长保证模拟的确定性。如果帧率波动，用子步数补偿。

## 练习

### 练习一：物理球体下落

用 cannon-es 创建一个场景：一个球体从高度 10 下落到地面。要求：

- 物理和渲染同步
- 球体落地后弹跳（设置 restitution）
- 地面用 Plane 形状

### 练习二：堆叠实验

创建 20 个立方体堆叠在一起。对比 cannon-es 和 Rapier 的稳定性——哪个引擎的堆叠更稳定（不容易穿透或倒塌）？

### 练习三：碰撞检测性能

创建 500 个动态物体，测量：

1. 物理步进耗时（`world.step()`）
2. 同步到 Three.js 的耗时
3. 总帧时间中物理占比

---

## 参考答案

### 练习一

```ts
import * as CANNON from 'cannon-es';

// 物理世界
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

// 地面
const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane()
});
groundBody.quaternion.setFromEulerAngles(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// 球体
const sphereBody = new CANNON.Body({
    mass: 5,
    shape: new CANNON.Sphere(1),
    position: new CANNON.Vec3(0, 10, 0),
    material: new CANNON.Material({ restitution: 0.7 })
});
world.addBody(sphereBody);

// Three.js
const sphereMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
scene.add(sphereMesh);

// 同步
function animate() {
    world.step(1 / 60);
    sphereMesh.position.copy(sphereBody.position as any);
    sphereMesh.quaternion.copy(sphereBody.quaternion as any);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();
```

### 练习二

Rapier 的堆叠通常更稳定，因为它使用 CCD（连续碰撞检测）和更好的求解器。cannon-es 在堆叠层数多时容易穿透。

### 练习三

500 个物体时，`world.step()` 通常需要 5-15ms（取决于碰撞对数量）。同步到 Three.js 约 1-2ms。物理占比 30-60%。
