# Three.js XR 集成

## 场景引入

前面三课我们直接使用了 WebXR Device API 的底层接口——手动创建 `XRWebGLLayer`、手动管理帧循环、手动读取控制器数据。这些代码虽然功能完整，但非常繁琐。实际上，Three.js 提供了完善的 XR 集成模块，能够大幅简化 WebXR 开发。

本课将介绍如何使用 Three.js 的 XR 工具链：`XRButton` 启动会话、`XRControllerModelFactory` 渲染控制器模型、以及在 XR 模式下正确运行渲染循环。

## 学习目标

- 掌握 Three.js `XRButton` 的使用方法
- 理解 Three.js XR 渲染循环的配置
- 使用 `XRControllerModelFactory` 加载控制器模型
- 掌握 XR 模式下的相机和场景管理
- 能使用 Three.js 构建完整的 XR 应用骨架

## Three.js XR 模块概览

Three.js 的 XR 支持分布在几个关键模块中：

```
three
  ├── webxr/XRButton              # UI 按钮，自动处理会话请求
  ├── webxr/XRControllerModelFactory  # 加载控制器 3D 模型
  ├── webxr/XRHandModelFactory    # 加载手部追踪模型
  ├── webxr/XRMotionControllerManager  # 管理控制器模型资源
  └── Renderer (setAnimationLoop)  # XR 兼容的渲染循环
```

## XRButton：会话管理

`XRButton` 是 Three.js 提供的 UI 组件，它自动处理 WebXR 会话的创建和管理，包括能力检测、按钮状态切换、错误处理。

### 基本用法

```typescript
import * as THREE from 'three';
import { XRButton } from 'three/addons/webxr/XRButton.js';

function initScene(): void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // 启用 XR 支持
  renderer.xr.enabled = true;

  // 创建 XR 按钮
  const xrButton = XRButton.createButton(renderer, {
    // 会话类型
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['hit-test', 'anchors', 'plane-detection'],

    // 可选：自定义 DOM 叠加层
    domOverlay: { root: document.getElementById('overlay')! },
  });

  document.body.appendChild(xrButton);
}
```

### XRButton 的工作流程

`XRButton` 内部完成了以下工作：

1. 检测 `navigator.xr` 是否可用
2. 检测请求的会话类型是否受支持
3. 创建按钮 UI，根据状态显示不同文字
4. 按钮点击时调用 `navigator.xr.requestSession()`
5. 会话开始后调用 `renderer.xr.setSession()`
6. 会话结束时恢复按钮状态

```
页面加载
  ↓
XRButton 检测 WebXR 支持
  ├── 不支持 → 显示 "VR/AR 不支持"（禁用状态）
  └── 支持 → 显示 "进入 VR/AR"（可点击）
              ↓
          用户点击
              ↓
          requestSession() → 创建 XRSession
              ↓
          renderer.xr.setSession(session)
              ↓
          进入 XR 渲染模式
              ↓
          用户退出 → 恢复按钮状态
```

### 自定义 XRButton 样式

XRButton 创建的是一个标准的 HTML 按钮，可以通过 CSS 自定义样式：

```typescript
const xrButton = XRButton.createButton(renderer, {
  requiredFeatures: ['local-floor'],
});

// 自定义样式
xrButton.style.position = 'absolute';
xrButton.style.bottom = '20px';
xrButton.style.left = '50%';
xrButton.style.transform = 'translateX(-50%)';
xrButton.style.padding = '12px 24px';
xrButton.style.fontSize = '16px';
xrButton.style.backgroundColor = '#4CAF50';
xrButton.style.color = 'white';
xrButton.style.border = 'none';
xrButton.style.borderRadius = '4px';
xrButton.style.cursor = 'pointer';
```

## XR 渲染循环

在 XR 模式下，Three.js 的渲染循环与传统方式有重要区别。

### 传统 vs XR 渲染循环

```typescript
// 传统渲染循环
function animate(): void {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// XR 渲染循环（使用 setAnimationLoop）
renderer.setAnimationLoop((timestamp: number, frame?: XRFrame) => {
  // timestamp: DOMHighResTimeStamp
  // frame: XRFrame（XR 模式下可用，非 XR 模式下为 undefined）

  renderer.render(scene, camera);
});
```

`setAnimationLoop` 是 Three.js 为 XR 设计的渲染循环接口：

- 非 XR 模式：内部使用 `requestAnimationFrame`
- XR 模式：内部使用 `session.requestAnimationFrame`，自动与设备刷新率同步
- 回调接收 `XRFrame` 参数，可用于访问 XR 数据

### 访问 XRFrame 数据

```typescript
renderer.setAnimationLoop((timestamp, frame) => {
  if (!frame) {
    // 非 XR 模式，正常渲染
    renderer.render(scene, camera);
    return;
  }

  // XR 模式：可以访问 XRFrame 的数据
  const referenceSpace = renderer.xr.getReferenceSpace();
  if (!referenceSpace) return;

  const pose = frame.getViewerPose(referenceSpace);
  if (!pose) return;

  // 获取命中检测结果
  if (hitTestSource) {
    const hits = frame.getHitTestResults(hitTestSource);
    // 处理命中结果...
  }

  // 更新控制器输入
  updateControllers(frame, referenceSpace);

  // 渲染（Three.js 自动处理多视图渲染）
  renderer.render(scene, camera);
});
```

## XR 模式下的相机管理

在 XR 模式下，Three.js 的相机行为与传统 3D 不同。理解这一点至关重要。

### 相机的双重角色

```typescript
// 创建透视相机（用于非 XR 模式和场景初始化）
const camera = new THREE.PerspectiveCamera(
  75,                                     // 视场角
  window.innerWidth / window.innerHeight, // 宽高比
  0.1,                                    // 近裁剪面
  1000                                    // 远裁剪面
);
camera.position.set(0, 1.6, 0);  // 默认人眼高度

// 在 XR 模式下：
// - Three.js 自动使用 XR 设备提供的投影矩阵和视图矩阵
// - 相机的 position 和 rotation 仍然有效，作为「根偏移」
// - 实际渲染位置 = 相机位置 + XR 设备追踪偏移
```

### XR 相机的工作原理

```
非 XR 模式：
  渲染位置 = camera.position

XR 模式：
  渲染位置 = camera.position + XR 设备追踪偏移
  投影矩阵 = XR 设备提供的投影矩阵（覆盖 camera.projectionMatrix）
```

这意味着 `camera.position` 在 XR 模式下可以作为「传送偏移」使用：

```typescript
// 传送实现：修改相机位置
function teleportTo(position: THREE.Vector3): void {
  camera.position.copy(position);
  // XR 设备的追踪数据会自动叠加到这个位置上
}
```

### 使用 cameraGroup 实现传送

更清晰的做法是使用一个 Group 作为相机的父节点：

```typescript
// 创建相机组（传送时移动这个组）
const cameraGroup = new THREE.Group();
cameraGroup.add(camera);
scene.add(cameraGroup);

// 传送
function teleportTo(position: THREE.Vector3): void {
  cameraGroup.position.copy(position);
}

// XR 模式下，实际渲染位置 = cameraGroup.position + camera(XR offset)
```

## XRControllerModelFactory

`XRControllerModelFactory` 自动加载控制器的 3D 模型，让用户在 VR 中看到自己的手柄。

### 基本用法

```typescript
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

function setupControllers(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  const controllerModelFactory = new XRControllerModelFactory();

  // 创建两个控制器
  const controller1 = renderer.xr.getController(0);  // 左手
  const controller2 = renderer.xr.getController(1);  // 右手

  scene.add(controller1);
  scene.add(controller2);

  // 创建控制器模型组
  const controllerGrip1 = renderer.xr.getControllerGrip(0);
  const controllerGrip2 = renderer.xr.getControllerGrip(1);

  // 加载控制器模型
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
  controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));

  scene.add(controllerGrip1);
  scene.add(controllerGrip2);

  // 创建射线可视化
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -3),  // 3 米长的射线
  ]);
  const material = new THREE.LineBasicMaterial({ color: 0xffffff });

  const line1 = new THREE.Line(geometry, material);
  const line2 = new THREE.Line(geometry, material);

  controller1.add(line1);
  controller2.add(line2);
}
```

### 控制器的三个层级

Three.js 提供三个层级的控制器表示：

```
controller (XRController)
  ├── 位置和旋转：来自 targetRaySpace（射线起点）
  ├── 用途：射线投射、传送目标
  └── 事件：select, selectstart, selectend, squeeze, squeezestart, squeezeend

controllerGrip (XRControllerGrip)
  ├── 位置和旋转：来自 gripSpace（控制器物理位置）
  ├── 用途：渲染控制器 3D 模型
  └── 模型：通过 XRControllerModelFactory 加载

controllerModel (XRControllerModel)
  ├── 控制器的实际 3D 模型
  └── 包含按钮动画（按下时按钮下沉）
```

### 控制器事件

Three.js 将 WebXR 的输入事件桥接到 Three.js 对象上：

```typescript
// 选择事件（对应扳机键）
controller1.addEventListener('select', (event) => {
  console.log('扳机键按下');
});

controller1.addEventListener('selectstart', (event) => {
  console.log('扳机键开始按下');
});

controller1.addEventListener('selectend', (event) => {
  console.log('扳机键释放');
});

// 握持事件（对应握持键）
controller1.addEventListener('squeeze', (event) => {
  console.log('握持键按下');
});

controller1.addEventListener('squeezestart', (event) => {
  console.log('握持键开始按下');
});

controller1.addEventListener('squeezeend', (event) => {
  console.log('握持键释放');
});
```

### 射线交互

结合 `Raycaster` 实现射线与场景物体的交互：

```typescript
class RayInteraction {
  private raycaster = new THREE.Raycaster();
  private tempMatrix = new THREE.Matrix4();

  checkIntersection(
    controller: THREE.Group,
    targets: THREE.Object3D[]
  ): THREE.Intersection | null {
    // 从控制器的射线创建 Raycaster
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

    const intersections = this.raycaster.intersectObjects(targets, true);
    return intersections.length > 0 ? intersections[0] : null;
  }

  highlightObject(intersection: THREE.Intersection): void {
    const object = intersection.object;
    if (object instanceof THREE.Mesh) {
      (object.material as THREE.MeshBasicMaterial).color.set(0xff0000);
    }
  }

  resetHighlight(object: THREE.Object3D): void {
    if (object instanceof THREE.Mesh) {
      (object.material as THREE.MeshBasicMaterial).color.set(0xffffff);
    }
  }
}
```

## 完整的 Three.js XR 应用骨架

将以上所有组件整合为一个完整的 Three.js XR 应用：

```typescript
import * as THREE from 'three';
import { XRButton } from 'three/addons/webxr/XRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

class ThreeXRApp {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cameraGroup: THREE.Group;

  private controller1: THREE.Group;
  private controller2: THREE.Group;
  private controllerGrip1: THREE.Group;
  private controllerGrip2: THREE.Group;

  private rayInteraction = new RayInteraction();
  private highlightedObject: THREE.Object3D | null = null;

  constructor(container: HTMLElement) {
    // 初始化渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    container.appendChild(this.renderer.domElement);

    // 初始化场景
    this.scene = new THREE.Scene();

    // 初始化相机和相机组
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.cameraGroup = new THREE.Group();
    this.cameraGroup.add(this.camera);
    this.scene.add(this.cameraGroup);

    // 设置光照
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    this.scene.add(light);

    // 设置控制器
    this.setupControllers();

    // 设置场景内容
    this.setupScene();

    // 设置 XR 按钮
    this.setupXRButton();

    // 设置渲染循环
    this.renderer.setAnimationLoop(this.animate.bind(this));

    // 窗口大小变化
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private setupControllers(): void {
    const factory = new XRControllerModelFactory();

    this.controller1 = this.renderer.xr.getController(0);
    this.controller2 = this.renderer.xr.getController(1);

    this.controller1.addEventListener('selectstart', this.onSelectStart.bind(this));
    this.controller1.addEventListener('selectend', this.onSelectEnd.bind(this));

    this.scene.add(this.controller1);
    this.scene.add(this.controller2);

    this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
    this.controllerGrip1.add(factory.createControllerModel(this.controllerGrip1));
    this.scene.add(this.controllerGrip1);

    this.controllerGrip2 = this.renderer.xr.getControllerGrip(1);
    this.controllerGrip2.add(factory.createControllerModel(this.controllerGrip2));
    this.scene.add(this.controllerGrip2);

    // 射线可视化
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -5),
    ]);
    this.controller1.add(new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0x44ff44 })));
    this.controller2.add(new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0x44ff44 })));
  }

  private setupScene(): void {
    // 创建一个简单的地面和几个可交互物体
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x444444 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // 创建几个可交互的立方体
    const boxGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44];

    colors.forEach((color, i) => {
      const box = new THREE.Mesh(
        boxGeom,
        new THREE.MeshStandardMaterial({ color })
      );
      box.position.set(-1 + i * 0.6, 0.5, -1.5);
      box.userData.interactable = true;
      this.scene.add(box);
    });
  }

  private setupXRButton(): void {
    const xrButton = XRButton.createButton(this.renderer, {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['hit-test'],
    });
    document.body.appendChild(xrButton);
  }

  private onSelectStart(event: any): void {
    const controller = event.target as THREE.Group;
    const intersection = this.rayInteraction.checkIntersection(
      controller,
      this.scene.children.filter(c => c.userData.interactable)
    );

    if (intersection) {
      // 选中物体的逻辑
      console.log('选中物体:', intersection.object);
    }
  }

  private onSelectEnd(event: any): void {
    // 释放逻辑
  }

  private animate(timestamp: number, frame?: XRFrame): void {
    // 更新射线交互
    this.updateRayInteraction(this.controller1);
    this.updateRayInteraction(this.controller2);

    this.renderer.render(this.scene, this.camera);
  }

  private updateRayInteraction(controller: THREE.Group): void {
    const intersection = this.rayInteraction.checkIntersection(
      controller,
      this.scene.children.filter(c => c.userData.interactable)
    );

    if (intersection) {
      if (this.highlightedObject !== intersection.object) {
        if (this.highlightedObject) {
          this.rayInteraction.resetHighlight(this.highlightedObject);
        }
        this.highlightedObject = intersection.object;
        this.rayInteraction.highlightObject(intersection);
      }
    } else if (this.highlightedObject) {
      this.rayInteraction.resetHighlight(this.highlightedObject);
      this.highlightedObject = null;
    }
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// 启动应用
const app = new ThreeXRApp(document.getElementById('app')!);
```

## 常见误区

### 误区一：在 XR 模式下手动管理帧循环

使用 Three.js 的 `setAnimationLoop` 后，不需要手动调用 `session.requestAnimationFrame`。Three.js 内部已经处理好了。

### 误区二：忽略 renderer.xr.enabled

如果忘记设置 `renderer.xr.enabled = true`，XRButton 会正常创建会话，但渲染器不会进入 XR 模式。

### 误区三：在 XR 模式下使用 resize 事件

XR 模式下渲染器的尺寸由设备决定，不应该响应 `resize` 事件修改尺寸。应该在 XR 会话开始/结束时切换尺寸管理逻辑。

### 误区四：把控制器模型添加到 controller 而不是 controllerGrip

控制器模型应该添加到 `controllerGrip`（gripSpace），它反映控制器的物理位置。添加到 `controller`（targetRaySpace）会导致模型位置偏移。

## 工程建议

1. **优先使用 Three.js XR 工具**：`XRButton`、`XRControllerModelFactory` 等工具已经处理了大量边界情况
2. **cameraGroup 模式**：使用 Group 包裹相机，传送时移动 Group 而不是相机本身
3. **射线可视化**：始终显示控制器射线，让用户知道交互指向
4. **交互反馈**：物体被射线指向时高亮，被选中时有明确反馈
5. **性能监控**：XR 模式下使用 `renderer.info` 监控 draw call 和三角形数量

## 小结

本课介绍了 Three.js 的 XR 集成工具链：

- **XRButton**：自动处理 WebXR 会话的创建和 UI 状态管理
- **setAnimationLoop**：XR 兼容的渲染循环，自动同步设备刷新率
- **XRControllerModelFactory**：自动加载和渲染控制器 3D 模型
- **相机管理**：理解 XR 模式下相机的双重角色

使用 Three.js 的 XR 工具可以将上一课中数百行的底层代码简化为几十行，同时获得更好的兼容性和错误处理。

## 练习

### 练习一：场景搭建

使用 Three.js 搭建一个简单的 VR 场景，包含地面、几个不同颜色的立方体、和一个球体。使用 XRButton 启动 VR 会话，使用 XRControllerModelFactory 显示控制器模型。

### 练习二：射线选择

在练习一的基础上，实现射线选择功能：当控制器射线指向一个物体时，物体高亮显示；按下扳机键时，物体变色。

### 练习三：XR 状态管理

设计一个 XR 状态管理器，处理以下状态：未进入 XR、进入 XR、追踪丢失、会话结束。在不同状态下显示不同的 UI 提示。

---

## 参考答案

### 练习一

**思路**：使用 Three.js 标准场景搭建流程，加上 `renderer.xr.enabled = true` 和 `XRButton`。

**答案**：
```typescript
import * as THREE from 'three';
import { XRButton } from 'three/addons/webxr/XRButton.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 0);

const light = new THREE.HemisphereLight(0xffffff, 0x444444);
scene.add(light);
scene.add(new THREE.DirectionalLight(0xffffff, 0.5));

// 地面
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({ color: 0x333333 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// 立方体
const colors = [0xff0000, 0x00ff00, 0x0000ff];
colors.forEach((color, i) => {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    new THREE.MeshStandardMaterial({ color })
  );
  box.position.set(-0.6 + i * 0.6, 1, -1.5);
  scene.add(box);
});

// 球体
const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.2, 32, 32),
  new THREE.MeshStandardMaterial({ color: 0xffff00 })
);
sphere.position.set(0, 1.5, -1);
scene.add(sphere);

document.body.appendChild(XRButton.createButton(renderer, {
  requiredFeatures: ['local-floor'],
}));

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});
```

**要点**：
- `renderer.xr.enabled = true` 是必需的
- XRButton 自动处理会话创建
- `setAnimationLoop` 自动适配 XR 和非 XR 模式

### 练习二

**思路**：在 `setAnimationLoop` 中使用 Raycaster 检测射线与物体的交集。

**答案**：
```typescript
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();

let highlightedObject: THREE.Object3D | null = null;

renderer.setAnimationLoop((timestamp, frame) => {
  // 检查控制器射线交互
  const controller = renderer.xr.getController(0);

  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  const intersects = raycaster.intersectObjects(scene.children);

  // 重置之前的高亮
  if (highlightedObject && highlightedObject instanceof THREE.Mesh) {
    (highlightedObject.material as THREE.MeshStandardMaterial).emissive.set(0x000000);
    highlightedObject = null;
  }

  // 设置新的高亮
  if (intersects.length > 0 && intersects[0].object.userData.interactable) {
    highlightedObject = intersects[0].object;
    if (highlightedObject instanceof THREE.Mesh) {
      (highlightedObject.material as THREE.MeshStandardMaterial).emissive.set(0x333333);
    }
  }

  renderer.render(scene, camera);
});

// 扳机键变色
renderer.xr.getController(0).addEventListener('select', () => {
  if (highlightedObject && highlightedObject instanceof THREE.Mesh) {
    const hue = Math.random();
    (highlightedObject.material as THREE.MeshStandardMaterial).color.setHSL(hue, 1, 0.5);
  }
});
```

**要点**：
- 使用 `emissive` 属性做高亮，不影响物体本身颜色
- 每帧重置高亮再重新检测，处理射线离开物体的情况
- `select` 事件在扳机键按下时触发

### 练习三

**思路**：使用状态机管理 XR 状态，根据状态切换 UI 显示。

**答案**：
```typescript
type XRState = 'idle' | 'xr-active' | 'tracking-lost' | 'session-ended';

class XRStateManager {
  private state: XRState = 'idle';
  private statusElement: HTMLElement;

  constructor() {
    this.statusElement = document.getElementById('status')!;
    this.updateUI();
  }

  setState(newState: XRState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.updateUI();
  }

  private updateUI(): void {
    switch (this.state) {
      case 'idle':
        this.statusElement.textContent = '点击按钮进入 XR';
        this.statusElement.style.display = 'block';
        break;
      case 'xr-active':
        this.statusElement.style.display = 'none';
        break;
      case 'tracking-lost':
        this.statusElement.textContent = '追踪丢失，请调整设备位置';
        this.statusElement.style.display = 'block';
        break;
      case 'session-ended':
        this.statusElement.textContent = 'XR 会话已结束';
        this.statusElement.style.display = 'block';
        setTimeout(() => this.setState('idle'), 3000);
        break;
    }
  }
}
```

**要点**：
- 状态机确保 UI 与 XR 状态同步
- 追踪丢失时显示提示，但不停止渲染
- 会话结束后自动恢复到初始状态
