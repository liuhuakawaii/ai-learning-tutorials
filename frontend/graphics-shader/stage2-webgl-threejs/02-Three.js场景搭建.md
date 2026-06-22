# 第2课：Three.js 场景搭建

## 场景引入

上一课我们用原生 WebGL2 手动管理缓冲区、编译着色器、计算矩阵，画一个旋转三角形就写了上百行代码。在真实项目中，一个场景可能包含数百个物体、多种光源、复杂的材质和动画——从零写起不现实。Three.js 是最流行的 WebGL 封装库，它把底层 API 抽象为场景图（Scene Graph）模型，让你像搭积木一样构建 3D 世界。本课从一个旋转的彩色立方体开始，掌握 Three.js 的核心架构。

## 学习目标

1. 理解 Three.js 的三大核心对象：Scene、Camera、Renderer
2. 掌握 PerspectiveCamera 和 OrthographicCamera 的区别与参数配置
3. 学会使用 requestAnimationFrame 构建渲染循环
4. 理解 Three.js 的坐标系、单位系统和场景图结构
5. 能够搭建一个包含光源、物体和动画的完整 Three.js 场景

## 一、Three.js 核心三件套

任何 Three.js 应用都从三个对象开始：

```
  ┌─────────────────────────────────────────┐
  │                Renderer                  │
  │  ┌─────────────────────────────────┐    │
  │  │            Camera                │    │
  │  │  ┌─────────────────────────┐    │    │
  │  │  │        Scene             │    │    │
  │  │  │  ┌─────┐  ┌─────┐      │    │    │
  │  │  │  │物体1 │  │物体2 │ ...  │    │    │
  │  │  │  └─────┘  └─────┘      │    │    │
  │  │  │  ┌─────┐  ┌─────┐      │    │    │
  │  │  │  │光源1 │  │光源2 │      │    │    │
  │  │  │  └─────┘  └─────┘      │    │    │
  │  │  └─────────────────────────┘    │    │
  │  └─────────────────────────────────┘    │
  └─────────────────────────────────────────┘
         │
         ▼
       画布 (canvas)
```

- **Scene**：场景容器，所有物体、光源、相机都挂载在场景图上
- **Camera**：决定从哪个角度看场景，相当于你的眼睛
- **Renderer**：负责把场景渲染到画布上，是 WebGL 的封装

## 二、相机系统

Three.js 提供两种常用相机：

```typescript
import * as THREE from "three";

// 透视相机 — 模拟人眼，近大远小
const perspectiveCamera = new THREE.PerspectiveCamera(
    75,      // fov: 视野角度（度数）
    16 / 9,  // aspect: 宽高比
    0.1,     // near: 近裁剪面（比这更近的物体不渲染）
    1000     // far: 远裁剪面（比这更远的物体不渲染）
);

// 正交相机 — 无透视效果，常用于 2D 界面或工程制图
const orthoCamera = new THREE.OrthographicCamera(
    -5,      // left
     5,      // right
     5,      // top
    -5,      // bottom
    0.1,     // near
    1000     // far
);
```

```
  透视相机 (PerspectiveCamera)        正交相机 (OrthographicCamera)

       ╱│                                │
      ╱ │                                │
     ╱  │  ← 近裁剪面                    │  ← 近裁剪面
    ╱   │                                │
   ╱    │                                │
  ╱     │  ← 远裁剪面                    │  ← 远裁剪面
 ╱──────│                                │
        │                                │
  近大远小，有纵深感                 大小不变，无透视畸变
```

选择依据：3D 游戏和产品展示用透视相机；2D UI 叠加层、策略游戏俯视角用正交相机。

## 三、WebGLRenderer 配置

```typescript
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,        // 开启抗锯齿
    alpha: false,           // 不需要透明背景
    powerPreference: "high-performance", // 优先使用独显
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 避免高 DPI 设备性能问题
renderer.outputColorSpace = THREE.SRGBColorSpace; // 色彩空间
renderer.toneMapping = THREE.ACESFilmicToneMapping; // 色调映射
renderer.toneMappingExposure = 1.0;
```

`setPixelRatio` 限制为 2 是工程经验：在 4K 屏幕上设为 3 或 4 会导致渲染像素量暴增，帧率骤降，视觉提升却不明显。

## 四、渲染循环与帧率控制

```typescript
const clock = new THREE.Clock(); // 内置计时器

function animate(): void {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();  // 距上一帧的时间差（秒）
    const elapsed = clock.getElapsedTime(); // 自启动以来的总时间

    // 动画逻辑
    cube.rotation.x += delta * 0.5;
    cube.rotation.y += delta * 0.8;

    // 渲染
    renderer.render(scene, camera);
}

animate();
```

**为什么用 `requestAnimationFrame` 而不是 `setInterval`？**
- `requestAnimationFrame` 自动匹配屏幕刷新率（通常 60fps）
- 页面不可见时自动暂停，节省电量和性能
- 回调时机与浏览器绘制同步，避免画面撕裂

## 五、坐标系与单位

Three.js 使用右手坐标系：

```
        Y (上)
        │
        │
        │
        └────────── X (右)
       ╱
      ╱
     ╱
    Z (朝向屏幕外，即朝向观察者)

  默认相机位置：(0, 0, 5)，看向原点 (0, 0, 0)
  1 个单位 ≈ 1 米（约定俗成，不是强制）
```

物体默认在原点 `(0, 0, 0)`，相机默认在 `(0, 0, 5)`。如果物体也在原点，相机需要后退才能看到它。

## 六、完整代码：旋转立方体场景

```typescript
import * as THREE from "three";

// 1. 创建场景
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e); // 深蓝背景

// 2. 创建相机
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);
camera.position.set(2, 2, 3);
camera.lookAt(0, 0, 0);

// 3. 创建渲染器
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 4. 创建物体
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({
    color: 0x4fc3f7,
    metalness: 0.3,
    roughness: 0.4,
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// 5. 添加光源
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// 6. 添加辅助网格
const gridHelper = new THREE.GridHelper(10, 10, 0x444466, 0x333355);
scene.add(gridHelper);

// 7. 响应窗口大小变化
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); // 必须调用！
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 8. 渲染循环
const clock = new THREE.Clock();

function animate(): void {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    cube.rotation.x += delta * 0.6;
    cube.rotation.y += delta * 1.0;
    cube.position.y = Math.sin(clock.getElapsedTime() * 2) * 0.3;

    renderer.render(scene, camera);
}

animate();
```

## 七、场景图与父子关系

Three.js 的场景是一棵树，物体之间可以建立父子关系：

```typescript
const parent = new THREE.Group();
scene.add(parent);

const child = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xff6b6b })
);
child.position.x = 1.5; // 相对于父物体的局部坐标
parent.add(child);

// 旋转父物体，子物体会跟着转
parent.rotation.y += 0.01;
```

变换矩阵会沿场景图层级向下传递：父物体的变换影响所有子物体，子物体的变换是相对于父物体的局部空间。这是组织复杂场景的关键手段。

## 常见误区

**1. 窗口大小变化后忘记更新相机和渲染器**
`resize` 事件中必须同时更新 `camera.aspect`、`camera.updateProjectionMatrix()` 和 `renderer.setSize()`，三步缺一不可，否则画面会拉伸变形。

**2. 物体和相机都在原点，看不到任何东西**
这是新手最常遇到的问题。相机默认看向负 Z 方向，如果物体在原点、相机也在原点，物体就在相机背后。要么移动相机，要么调用 `camera.lookAt(target)`。

**3. 把 `setPixelRatio` 设置为 `window.devicePixelRatio` 而不加限制**
在 iPhone 上 `devicePixelRatio` 可以是 3，意味着渲染 9 倍像素。加上 `Math.min(devicePixelRatio, 2)` 是标准做法。

**4. 在渲染循环里每帧创建新对象**
`new THREE.Vector3()` 或 `new THREE.Color()` 每帧执行会触发大量垃圾回收，导致卡顿。应该在循环外预创建对象，循环内复用。

## 工程建议

**1. 始终设置 `renderer.outputColorSpace`**
默认值在 Three.js 较新版本中已改为 `SRGBColorSpace`，但显式设置能避免不同版本间的色彩差异。配合 `toneMapping` 使用可获得更真实的光照效果。

**2. 使用 `THREE.Clock` 管理时间**
不要用 `Date.now()` 或 `performance.now()` 手动计算时间差。`THREE.Clock` 的 `getDelta()` 和 `getElapsedTime()` 专为渲染循环设计，处理了暂停和溢出情况。

**3. 用 `Group` 组织逻辑对象**
把相关的物体（如一辆汽车的轮子、车身、车灯）放在同一个 `Group` 下，整体移动和旋转会方便很多，代码可读性也更高。

**4. 生产环境关闭 `antialias` 或使用后处理**
抗锯齿对性能影响较大。如果使用后处理管线（Post-Processing），应该关闭渲染器的内置抗锯齿，改用 FXAA 或 SMAA 等后处理方案。

## 小结

本课搭建了第一个完整的 Three.js 场景：Scene 管理所有对象，PerspectiveCamera 提供透视视角，WebGLRenderer 把一切渲染到画布。我们用 `requestAnimationFrame` 构建了稳定的渲染循环，用 `THREE.Clock` 管理时间驱动动画，并理解了右手坐标系和场景图的父子变换关系。这些概念是后续所有 Three.js 开发的基础。

## 练习

**练习 1**：在场景中同时添加一个立方体和一个球体，让立方体绕 Y 轴旋转，球体作为立方体的子物体，绕立方体公转。

**练习 2**：切换为正交相机，观察物体大小是否随距离变化。尝试调整正交相机的 left/right/top/bottom 参数，理解视锥体的概念。

**练习 3**：监听鼠标移动事件，让相机跟随鼠标位置轻微偏移（视差效果），营造一种"偷看"的感觉。

---

## 参考答案

### 练习一

**思路**：立方体和球体用 `Group` 组织父子关系。立方体是父物体绕 Y 轴自转，球体作为子物体设置偏移位置，自然跟随父物体公转。

**答案**：

```typescript
import * as THREE from "three";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(3, 3, 5);
camera.lookAt(0, 0, 0);

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 创建组合体
const group = new THREE.Group();

// 立方体（父物体）
const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
const cubeMat = new THREE.MeshStandardMaterial({ color: 0x4fc3f7 });
const cube = new THREE.Mesh(cubeGeo, cubeMat);
group.add(cube);

// 球体（子物体），偏移一定距离
const sphereGeo = new THREE.SphereGeometry(0.3, 32, 32);
const sphereMat = new THREE.MeshStandardMaterial({ color: 0xff7043 });
const sphere = new THREE.Mesh(sphereGeo, sphereMat);
sphere.position.set(2, 0, 0); // 偏移到立方体右侧
group.add(sphere);

scene.add(group);

// 光源
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// 网格地面
const gridHelper = new THREE.GridHelper(10, 10, 0x444466, 0x333355);
scene.add(gridHelper);

const clock = new THREE.Clock();

function animate(): void {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // 立方体绕 Y 轴旋转 → 球体作为子物体自动跟随公转
    group.rotation.y += delta * 0.8;

    // 球体自身也可加自转
    sphere.rotation.y += delta * 2.0;

    renderer.render(scene, camera);
}

animate();
```

**要点**：
- `Group` 的变换会级联到所有子物体：父物体旋转时，子物体的世界坐标自动变化
- 子物体的 `position` 是相对于父物体的局部坐标，`(2, 0, 0)` 表示在父物体 X 轴方向偏移 2 个单位
- 这就是场景图（Scene Graph）的核心优势：层级变换自动传播

---

### 练习二

**思路**：用 `THREE.OrthographicCamera` 替换 `PerspectiveCamera`。正交相机的视锥体是一个长方体，物体大小不随距离变化。调整 `left/right/top/bottom` 参数可以改变可见范围。

**答案**：

```typescript
import * as THREE from "three";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 5;

// 正交相机：视锥体是一个长方体
const camera = new THREE.OrthographicCamera(
    -frustumSize * aspect / 2,  // left
     frustumSize * aspect / 2,  // right
     frustumSize / 2,           // top
    -frustumSize / 2,           // bottom
    0.1,                        // near
    100                         // far
);
camera.position.set(3, 3, 5);
camera.lookAt(0, 0, 0);

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 放置两个距离不同的立方体
const nearGeo = new THREE.BoxGeometry(1, 1, 1);
const nearMat = new THREE.MeshStandardMaterial({ color: 0x4fc3f7 });
const nearCube = new THREE.Mesh(nearGeo, nearMat);
nearCube.position.set(-2, 0, 0);
scene.add(nearCube);

const farGeo = new THREE.BoxGeometry(1, 1, 1);
const farMat = new THREE.MeshStandardMaterial({ color: 0xff7043 });
const farCube = new THREE.Mesh(farGeo, farMat);
farCube.position.set(2, 0, -5); // 更远的位置
scene.add(farCube);

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(10, 10, 0x444466, 0x333355);
scene.add(gridHelper);

// 添加距离标注
console.log("近处立方体到相机距离:", camera.position.distanceTo(nearCube.position).toFixed(1));
console.log("远处立方体到相机距离:", camera.position.distanceTo(farCube.position).toFixed(1));

const clock = new THREE.Clock();

function animate(): void {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    nearCube.rotation.y += delta * 0.5;
    farCube.rotation.y += delta * 0.5;
    renderer.render(scene, camera);
}

animate();

// 调整 frustumSize 观察变化：变大则物体显得更小（视锥体更大），变小则物体显得更大
```

**要点**：
- 正交相机中，同样大小的物体无论远近，在屏幕上显示的尺寸相同——没有透视收缩
- `frustumSize` 决定了可见范围，值越大看到的范围越广，物体显得越小
- 窗口缩放时需要更新 `left/right/top/bottom` 以保持正确的宽高比
- 正交相机常用于 2D 游戏、CAD 建模界面、UI 叠加层等不需要透视效果的场景

---

### 练习三

**思路**：监听 `mousemove` 事件获取鼠标归一化坐标（-1 到 1），在渲染循环中用 `lerp` 平滑插值相机位置，让相机跟随鼠标轻微偏移，产生视差"偷看"效果。

**答案**：

```typescript
import * as THREE from "three";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
const basePosition = new THREE.Vector3(0, 0, 5);
camera.position.copy(basePosition);

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 场景物体
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x4fc3f7 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32);
const sphereMat = new THREE.MeshStandardMaterial({ color: 0xff7043 });
const sphere = new THREE.Mesh(sphereGeo, sphereMat);
sphere.position.set(-2, 0, 0);
scene.add(sphere);

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(10, 10, 0x444466, 0x333355);
scene.add(gridHelper);

// 鼠标归一化坐标
const mouse = new THREE.Vector2(0, 0);

window.addEventListener("mousemove", (event: MouseEvent) => {
    // 归一化到 -1 ~ 1
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

const clock = new THREE.Clock();
const parallaxStrength = 1.5; // 视差强度

function animate(): void {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // 目标位置 = 基础位置 + 鼠标偏移
    const targetX = basePosition.x + mouse.x * parallaxStrength;
    const targetY = basePosition.y + mouse.y * parallaxStrength;

    // lerp 平滑插值，避免相机突兀跳动
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.05);
    camera.lookAt(0, 0, 0);

    cube.rotation.y += delta * 0.5;
    sphere.rotation.y += delta * 0.3;

    renderer.render(scene, camera);
}

animate();
```

**要点**：
- `THREE.MathUtils.lerp(a, b, t)` 是线性插值，`t` 越小平滑效果越强（响应越慢）
- 鼠标坐标需要归一化到 `-1 ~ 1` 范围，Y 轴要取反（屏幕 Y 轴向下，3D Y 轴向上）
- `parallaxStrength` 控制偏移幅度，值太大会导致穿模，值太小效果不明显
- 每帧调用 `camera.lookAt(0, 0, 0)` 确保相机始终看向场景中心
