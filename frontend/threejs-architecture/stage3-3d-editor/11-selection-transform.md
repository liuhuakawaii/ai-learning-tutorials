# 选择与变换——Raycasting、Gizmo 实现、TransformControls 原理

## 点击一个 3D 物体有多难

在 2D 界面里，点击一个按钮就是检测鼠标坐标是否在按钮矩形内。在 3D 场景里，鼠标坐标是屏幕空间的 2D 点，但物体在世界空间的 3D 位置。你需要把 2D 点"投射"成 3D 射线，然后检测这条射线和哪些物体相交。

这就是 raycasting（射线投射）。

## Three.js 的 Raycaster

```ts
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

canvas.addEventListener('click', (event) => {
    // 归一化设备坐标 (-1 到 +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 从相机出发，经过鼠标位置的射线
    raycaster.setFromCamera(mouse, camera);

    // 检测相交
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const hit = intersects[0]; // 最近的相交
        console.log('Hit:', hit.object.name);
        console.log('Point:', hit.point);       // 世界坐标相交点
        console.log('Distance:', hit.distance);  // 到相机的距离
        console.log('Face:', hit.face);          // 相交的三角面
    }
});
```

## 射线-物体相交的原理

### 射线-球体

最简单的相交检测。射线方程 `P = O + tD`（O 是起点，D 是方向），球方程 `|P - C|² = r²`。代入得到一个二次方程，判别式 > 0 则相交。

### 射线-AABB

轴对齐包围盒。分别对 x、y、z 轴计算进入和离开 t 值，取最大的进入 t 和最小的离开 t。如果 maxEnter < minLeave，相交。

### 射线-三角形

这是 Mesh raycast 的核心。Three.js 用 Möller–Trumbore 算法：

```ts
// 简化版
function rayTriangle(ray, a, b, c) {
    const edge1 = b.clone().sub(a);
    const edge2 = c.clone().sub(a);
    const pvec = ray.direction.clone().cross(edge2);
    const det = edge1.dot(pvec);

    if (Math.abs(det) < 1e-6) return null; // 平行

    const invDet = 1 / det;
    const tvec = ray.origin.clone().sub(a);
    const u = tvec.dot(pvec) * invDet;
    if (u < 0 || u > 1) return null;

    const qvec = tvec.clone().cross(edge1);
    const v = ray.direction.dot(qvec) * invDet;
    if (v < 0 || u + v > 1) return null;

    const t = edge2.dot(qvec) * invDet;
    return t > 0 ? t : null;
}
```

对一个 10 万面的 Mesh，逐三角形检测太慢。这就是为什么 BVH 加速很重要（第 6 节讲过）。

## TransformControls：变换 Gizmo 的实现

Three.js 的 `TransformControls` 让你通过拖拽 Gizmo 来移动/旋转/缩放物体。它的实现涉及几个关键设计：

### Gizmo 的几何体

Gizmo 是一组特殊的 Mesh——它们需要在相机缩放时保持固定屏幕大小，且不会被场景物体遮挡：

```ts
// 轴线
const lineGeometry = new THREE.BufferGeometry();
lineGeometry.setAttribute('position',
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));

// 箭头
const arrowGeometry = new THREE.ConeGeometry(0.05, 0.2, 12);

// 圆环（旋转 Gizmo）
const ringGeometry = new THREE.TorusGeometry(1, 0.01, 4, 64);
```

### Gizmo 的渲染顺序

Gizmo 必须渲染在所有物体之上，不参与深度测试：

```ts
gizmoMaterial.depthTest = false;
gizmoMaterial.depthWrite = false;
gizmo.renderOrder = 999; // 最后渲染
```

### 射线检测 Gizmo

拖拽 Gizmo 时，需要检测鼠标点击的是哪个轴：

```ts
// 每个 Gizmo 部件有不同的名称
xAxis.name = 'x';
yAxis.name = 'y';
zAxis.name = 'z';
xyPlane.name = 'xy';

// 点击时
const hit = raycaster.intersectObjects(gizmo.children)[0];
if (hit) {
    const axis = hit.object.name;
    // 根据 axis 决定约束方向
}
```

### 拖拽到世界空间的映射

点击 Gizmo 后，鼠标移动需要映射到 3D 空间的平移/旋转。这需要构造一个"拖拽平面"：

```ts
// 平移模式：构造一个包含拖拽轴的平面
const plane = new THREE.Plane();
if (axis === 'x') {
    // 构造包含 X 轴且面向相机的平面
    const cameraDir = camera.getWorldDirection(new THREE.Vector3());
    plane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3().crossVectors(
            new THREE.Vector3(1, 0, 0),
            cameraDir
        ),
        object.position
    );
}

// 鼠标移动时，射线与平面求交
const intersection = new THREE.Vector3();
raycaster.ray.intersectPlane(plane, intersection);
// 计算偏移量，应用到物体
```

## 选择高亮

选中物体时常见的视觉反馈：

```ts
// 方法 1：修改材质
selectedObject.material.emissive.setHex(0x333333);

// 方法 2：外轮廓（后处理）
// 用 Stencil Buffer 标记选中物体，然后在后处理中画轮廓

// 方法 3：线框叠加
const wireframe = new THREE.Mesh(
    selectedObject.geometry,
    new THREE.MeshBasicMaterial({
        wireframe: true,
        color: 0xffff00,
        depthTest: false
    })
);
selectedObject.add(wireframe);
```

方法 2 效果最好但实现最复杂。方法 1 最简单但会改变物体外观。方法 3 是折中方案。

## 多选与框选

框选（拖拽矩形选择多个物体）的实现：

1. 在屏幕上画一个矩形
2. 把矩形的四个角转成 3D 射线
3. 用这四条射线构造一个视锥体
4. 检测哪些物体在这个视锥体内

```ts
function boxSelect(
    startX: number, startY: number,
    endX: number, endY: number,
    camera: THREE.Camera,
    objects: THREE.Object3D[]
): THREE.Object3D[] {
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();

    // 构造选择视锥体（简化版）
    const left = Math.min(startX, endX);
    const right = Math.max(startX, endX);
    const bottom = Math.min(startY, endY);
    const top = Math.max(startY, endY);

    // ... 用这四个值构造投影矩阵，设置 frustum

    return objects.filter(obj => frustum.containsPoint(obj.position));
}
```

## 练习

### 练习一：实现物体拾取

创建一个包含 20 个不同颜色立方体的场景。点击时高亮被选中的立方体（改变 emissive 颜色），再次点击空白处取消选择。

### 练习二：自定义 Gizmo

实现一个简化的平移 Gizmo——只支持沿 Y 轴移动。要求：

- 显示一条竖线和一个箭头
- 拖拽箭头时物体沿 Y 轴移动
- Gizmo 保持固定屏幕大小

### 练习三：性能对比

创建一个 10 万面的模型。分别用默认 raycast 和 BVH 加速的 raycast 做 1000 次随机射线检测。记录耗时差异。

---

## 参考答案

### 练习一

```ts
let selected: THREE.Object3D | null = null;
const originalColors = new Map();

canvas.addEventListener('click', (event) => {
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);

    // 取消之前的选择
    if (selected) {
        selected.material.emissive.setHex(0x000000);
        selected = null;
    }

    // 检测新选择
    const intersects = raycaster.intersectObjects(cubes);
    if (intersects.length > 0) {
        selected = intersects[0].object;
        selected.material.emissive.setHex(0x333333);
    }
});
```

### 练习二

```ts
class SimpleYGizmo {
    private arrow: THREE.Mesh;
    private line: THREE.Line;
    private isDragging = false;
    private plane = new THREE.Plane();
    private offset = new THREE.Vector3();

    constructor(private target: THREE.Object3D) {
        // Y 轴线
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position',
            new THREE.Float32BufferAttribute([0, 0, 0, 0, 2, 0], 3));
        this.line = new THREE.Line(lineGeo,
            new THREE.LineBasicMaterial({ color: 0x00ff00, depthTest: false }));

        // 箭头
        const arrowGeo = new THREE.ConeGeometry(0.1, 0.3, 8);
        this.arrow = new THREE.Mesh(arrowGeo,
            new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false }));
        this.arrow.position.y = 2;
        this.arrow.name = 'y-arrow';
    }

    onMouseDown(raycaster: THREE.Raycaster) {
        const hit = raycaster.intersectObject(this.arrow);
        if (hit.length > 0) {
            this.isDragging = true;
            // 构造垂直于视线且包含 Y 轴的平面
            const camDir = new THREE.Vector3();
            raycaster.ray.direction.clone();
            this.plane.setFromNormalAndCoplanarPoint(
                new THREE.Vector3(1, 0, 0).cross(camDir).normalize(),
                this.target.position
            );
        }
    }

    onMouseMove(raycaster: THREE.Raycaster) {
        if (!this.isDragging) return;
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(this.plane, intersection);
        this.target.position.y = intersection.y;
    }

    onMouseUp() {
        this.isDragging = false;
    }
}
```

### 练习三

预期 BVH raycast 快 10-100 倍。对 10 万面模型，单次 raycast 可能从 5ms 降到 0.05ms。
