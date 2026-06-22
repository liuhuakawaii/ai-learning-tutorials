# WebXR API 入门

## 场景引入

你已经了解了空间计算的基本概念——坐标系、变换矩阵、四元数。现在的问题是：如何在浏览器中真正启动一个 AR 或 VR 会话？设备的摄像头画面怎么获取？头显的位置追踪数据怎么拿到？

WebXR Device API 就是浏览器提供的标准化接口，它抽象了底层硬件差异，让你用统一的 API 访问 AR/VR 设备的能力。本课将从最基础的概念开始：会话（Session）、参考空间（Reference Space）和帧循环（Frame Loop）。

## 学习目标

- 理解 WebXR Device API 的核心架构
- 掌握 XRSession 的创建、配置和生命周期
- 理解不同参考空间类型及其适用场景
- 掌握 XRFrame 回调与渲染循环的协作方式
- 能编写基础的 WebXR 启动代码

## WebXR 架构概览

WebXR 的核心设计遵循「会话驱动」模型。整个交互过程可以抽象为三个阶段：

1. **能力检测**：确认当前设备是否支持所需的 XR 功能
2. **会话创建**：请求一个特定类型的 XR 会话
3. **帧循环**：在每帧中获取追踪数据并渲染

```
┌─────────────────────────────────────────────────┐
│                  WebXR Device API                │
├─────────────────────────────────────────────────┤
│  navigator.xr.requestSession()                   │
│         ↓                                        │
│  XRSession                                       │
│    ├── requestReferenceSpace()                   │
│    ├── requestAnimationFrame() → XRFrame         │
│    │     ├── getViewerPose()                     │
│    │     ├── getHitTestResults()                 │
│    │     └── inputSources (controllers)          │
│    └── end()                                     │
└─────────────────────────────────────────────────┘
```

## 能力检测

在请求会话之前，必须先确认设备是否支持 WebXR 以及所需的特性。WebXR 提供了 `isSessionSupported` 方法用于快速检测。

```typescript
// 检测是否支持沉浸式 AR 会话
async function checkARSupport(): Promise<boolean> {
  if (!navigator.xr) {
    console.warn('当前浏览器不支持 WebXR');
    return false;
  }
  return await navigator.xr.isSessionSupported('immersive-ar');
}

// 检测是否支持沉浸式 VR 会话
async function checkVRSupport(): Promise<boolean> {
  if (!navigator.xr) {
    console.warn('当前浏览器不支持 WebXR');
    return false;
  }
  return await navigator.xr.isSessionSupported('immersive-vr');
}
```

WebXR 定义了三种会话模式：

| 模式 | 说明 | 典型设备 |
|------|------|----------|
| `immersive-ar` | 沉浸式 AR，叠加虚拟内容到真实世界 | 手机、AR 眼镜 |
| `immersive-vr` | 沉浸式 VR，完全替换视觉输入 | VR 头显 |
| `inline` | 内联模式，在网页中显示 XR 内容 | 任何设备 |

## XRSession 生命周期

XRSession 是 WebXR 的核心对象，代表一次 AR/VR 交互会话。它的生命周期如下：

```
请求会话 → 会话创建 → 活跃状态 → 会话结束
   ↑          ↓          ↓          ↓
requestSession  配置参考空间  帧循环渲染  释放资源
```

### 创建会话

```typescript
// 定义会话特性请求
const xrSessionInit: XRSessionInit = {
  requiredFeatures: ['local-floor'],      // 必须支持的特性
  optionalFeatures: ['hit-test', 'anchors'], // 可选特性
  domOverlay: { root: document.getElementById('overlay') } // DOM 叠加层
};

// 请求 AR 会话
async function startARSession(): Promise<XRSession> {
  if (!navigator.xr) {
    throw new Error('WebXR 不可用');
  }

  const supported = await navigator.xr.isSessionSupported('immersive-ar');
  if (!supported) {
    throw new Error('当前设备不支持沉浸式 AR');
  }

  const session = await navigator.xr.requestSession('immersive-ar', xrSessionInit);

  // 监听会话结束事件
  session.addEventListener('end', () => {
    console.log('XR 会话已结束');
    // 清理资源、重置 UI
    cleanupXRResources();
  });

  return session;
}
```

### 会话特性请求的策略

`requiredFeatures` 和 `optionalFeatures` 的区别直接影响会话创建的成败：

- **requiredFeatures**：如果设备不支持其中任何一个特性，`requestSession` 会直接抛出异常
- **optionalFeatures**：设备不支持时仍可正常创建会话，但对应功能不可用

```typescript
// 错误做法：把非必需特性放到 requiredFeatures
const badConfig: XRSessionInit = {
  requiredFeatures: ['local-floor', 'hit-test', 'anchors', 'hand-tracking']
  // 如果设备不支持手部追踪，整个会话创建都会失败
};

// 正确做法：区分必需和可选
const goodConfig: XRSessionInit = {
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['hit-test', 'anchors', 'hand-tracking']
  // 即使设备不支持手部追踪，会话仍然可以创建
};
```

## 参考空间

参考空间（Reference Space）是 WebXR 中最容易被误解的概念之一。它定义了追踪数据的坐标原点和范围。

### 为什么需要参考空间

追踪数据本质上是相对于某个物理点的位移和旋转。不同应用场景需要不同的原点：

- AR 应用：原点通常在用户脚下或设备初始位置
- VR 房间级体验：原点在房间地面上
- VR 坐姿体验：原点在用户座位位置

### 参考空间类型

```typescript
// 1. local - 以设备初始位置为原点，无楼层信息
// 适用：站立式 VR、简单 AR
const localSpace = await session.requestReferenceSpace('local');

// 2. local-floor - 以设备初始位置为原点，但原点在地面
// 适用：大多数 VR 应用，AR 应用
const localFloorSpace = await session.requestReferenceSpace('local-floor');

// 3. bounded-floor - 房间级追踪，有安全边界
// 适用：房间级 VR 体验
const boundedFloorSpace = await session.requestReferenceSpace('bounded-floor');

// 4. viewer - 以设备当前位置为原点（每帧变化）
// 适用：手部追踪等特殊场景
const viewerSpace = await session.requestReferenceSpace('viewer');
```

### 选择参考空间的决策树

```
需要知道用户的物理高度？
├── 是 → local-floor 或 bounded-floor
└── 否 → local
    │
    需要房间级追踪和安全边界？
    ├── 是 → bounded-floor
    └── 否 → local-floor（最通用的选择）
```

### 参考空间与坐标系的关系

参考空间本质上定义了一个坐标系的原点和朝向：

- **原点**：根据参考空间类型确定
- **朝向**：Y 轴向上，Z 轴朝向用户初始前方
- **单位**：米

```typescript
// 获取参考空间后，可以用它来转换坐标
const referenceSpace = await session.requestReferenceSpace('local-floor');

// XRFrame 的 getViewerPose 接收参考空间作为参数
// 返回的位姿数据就是相对于这个参考空间的
```

## 帧循环

帧循环是 WebXR 应用的核心。它类似于 `requestAnimationFrame`，但专门为 XR 设备优化。

### 基本帧循环

```typescript
class XRFrameLoop {
  private session: XRSession;
  private referenceSpace: XRReferenceSpace;
  private gl: WebGLRenderingContext;
  private baseLayer: XRWebGLLayer;

  constructor(session: XRSession, canvas: HTMLCanvasElement) {
    this.session = session;

    // 创建 WebGL 上下文，启用 XR 兼容
    this.gl = canvas.getContext('webgl', { xrCompatible: true })!;

    // 创建 XRWebGLLayer 作为渲染目标
    this.baseLayer = new XRWebGLLayer(session, this.gl);
    session.updateRenderState({ baseLayer: this.baseLayer });
  }

  async start(): Promise<void> {
    this.referenceSpace = await this.session.requestReferenceSpace('local-floor');
    this.session.requestAnimationFrame(this.onFrame.bind(this));
  }

  private onFrame(time: DOMHighResTimeStamp, frame: XRFrame): void {
    // 请求下一帧（在处理当前帧之前请求，确保连续性）
    this.session.requestAnimationFrame(this.onFrame.bind(this));

    // 获取当前帧的相机位姿
    const pose = frame.getViewerPose(this.referenceSpace);
    if (!pose) {
      // 位姿不可用（追踪丢失），跳过本帧渲染
      return;
    }

    // 清除画布
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.baseLayer.framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 遍历每个视图（左眼和右眼）
    for (const view of pose.views) {
      const viewport = this.baseLayer.getViewport(view)!;
      gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

      // 获取视图的投影矩阵和变换矩阵
      const projectionMatrix = view.projectionMatrix;
      const transform = view.transform;

      // 在这里渲染场景...
      this.renderScene(projectionMatrix, transform);
    }
  }

  private renderScene(projectionMatrix: Float32Array, transform: XRRigidTransform): void {
    // 实际渲染逻辑将在后续课程中实现
  }
}
```

### 理解 XRFrame 的数据结构

每帧获取的数据形成了一个层次结构：

```
XRFrame
  └── XRViewerPose（相对于参考空间的相机位姿）
        ├── transform（位置 + 旋转）
        └── views[]（每个眼睛/摄像头的视图）
              ├── eye（left / right / none）
              ├── projectionMatrix（投影矩阵 4x4）
              └── transform（该视图的变换）
```

对于 AR 会话，`views` 数组通常只有一个元素（单摄像头）；对于 VR 头显，通常有两个元素（左眼和右眼）。

### 处理追踪丢失

XR 设备的追踪可能因为遮挡、光照不足等原因暂时丢失。正确处理追踪丢失是健壮应用的必要条件：

```typescript
private onFrame(time: DOMHighResTimeStamp, frame: XRFrame): void {
  this.session.requestAnimationFrame(this.onFrame.bind(this));

  const pose = frame.getViewerPose(this.referenceSpace);

  if (!pose) {
    // 追踪丢失：显示提示信息，但不要停止帧循环
    this.showTrackingLostOverlay();
    return;
  }

  // 追踪恢复：隐藏提示信息
  this.hideTrackingLostOverlay();

  // 正常渲染...
}
```

## 实战：最小 WebXR 应用

将以上概念整合为一个可运行的最小 WebXR 应用：

```typescript
class MinimalXRApp {
  private session: XRSession | null = null;
  private gl: WebGLRenderingContext | null = null;
  private baseLayer: XRWebGLLayer | null = null;
  private referenceSpace: XRReferenceSpace | null = null;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async start(): Promise<void> {
    // 1. 能力检测
    if (!navigator.xr) {
      throw new Error('WebXR 不可用');
    }

    const supported = await navigator.xr.isSessionSupported('immersive-ar');
    if (!supported) {
      throw new Error('沉浸式 AR 不受支持');
    }

    // 2. 初始化 WebGL
    this.gl = this.canvas.getContext('webgl', { xrCompatible: true })!;
    if (!this.gl) {
      throw new Error('WebGL 不可用');
    }

    // 3. 创建会话
    this.session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local-floor'],
    });

    // 4. 配置渲染层
    this.baseLayer = new XRWebGLLayer(this.session, this.gl);
    this.session.updateRenderState({ baseLayer: this.baseLayer });

    // 5. 获取参考空间
    this.referenceSpace = await this.session.requestReferenceSpace('local-floor');

    // 6. 启动帧循环
    this.session.requestAnimationFrame(this.onFrame.bind(this));

    // 7. 监听结束
    this.session.addEventListener('end', () => this.onSessionEnd());
  }

  private onFrame(time: DOMHighResTimeStamp, frame: XRFrame): void {
    if (!this.session || !this.gl || !this.baseLayer || !this.referenceSpace) return;

    this.session.requestAnimationFrame(this.onFrame.bind(this));

    const pose = frame.getViewerPose(this.referenceSpace);
    if (!pose) return;

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.baseLayer.framebuffer);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    for (const view of pose.views) {
      const viewport = this.baseLayer.getViewport(view)!;
      this.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
      // 实际渲染逻辑
    }
  }

  private onSessionEnd(): void {
    this.session = null;
    this.baseLayer = null;
    this.referenceSpace = null;
  }

  end(): void {
    this.session?.end();
  }
}
```

## 常见误区

### 误区一：把 `requestAnimationFrame` 和 XR 帧循环混用

WebXR 有自己的帧循环机制（`session.requestAnimationFrame`），它与浏览器的 `requestAnimationFrame` 是独立的。XR 帧循环的频率与设备刷新率同步，而浏览器的 `requestAnimationFrame` 通常固定在 60Hz。

```typescript
// 错误：使用浏览器的 requestAnimationFrame 驱动 XR 渲染
function wrongLoop() {
  requestAnimationFrame(wrongLoop);
  // 在这里获取 XR pose 数据可能导致不同步
}

// 正确：使用 session 的 requestAnimationFrame
function correctLoop(time: DOMHighResTimeStamp, frame: XRFrame) {
  session.requestAnimationFrame(correctLoop);
  // 在这里获取 XR pose 数据是同步且正确的
}
```

### 误区二：忽略 `requiredFeatures` 与 `optionalFeatures` 的区别

把所有特性都放到 `requiredFeatures` 会导致在不支持某些特性的设备上完全无法启动会话。应该只把应用核心功能必需的特性放入 `requiredFeatures`。

### 误区三：认为参考空间是固定的

参考空间在会话创建时确定，但设备可能会重新校准。不要假设参考空间的原点永远不变，特别是在长时间运行的会话中。

### 误区四：在没有 `xrCompatible` 上下文的情况下使用 WebGL

WebXR 要求 WebGL 上下文在创建时启用 `xrCompatible` 标志。如果先创建普通 WebGL 上下文再尝试用于 WebXR，会报错。

## 工程建议

1. **特性检测优先**：在 UI 层面先检测 WebXR 支持情况，不支持时优雅降级，而不是让用户点击按钮后才报错
2. **参考空间选择**：除非有特殊需求，优先使用 `local-floor`，它在大多数设备上都有良好支持
3. **帧循环中的早期退出**：`getViewerPose` 返回 `null` 时不要恐慌，这是正常情况，只需跳过渲染
4. **资源管理**：会话结束时及时释放 WebGL 资源，避免内存泄漏
5. **HTTPS 要求**：WebXR 只在安全上下文中可用，开发时使用 `localhost` 或配置本地 HTTPS

## 小结

本课介绍了 WebXR Device API 的三个核心概念：

- **XRSession**：代表一次 AR/VR 会话，管理生命周期和渲染状态
- **参考空间**：定义追踪数据的坐标原点，影响所有位姿数据的解读
- **帧循环**：通过 `session.requestAnimationFrame` 驱动渲染，每帧获取最新的追踪数据

这三个概念是所有 WebXR 应用的基础。后续课程将在此基础上分别深入 AR 和 VR 的具体功能。

## 练习

### 练习一：参考空间选择

一个 VR 密室逃脱游戏，玩家需要在 3m x 3m 的房间内走动寻找线索。应该选择哪种参考空间？为什么？

### 练习二：会话特性配置

设计一个 AR 家具摆放应用的 `XRSessionInit` 配置。该应用的核心功能是在真实地面上放置家具模型，同时希望支持锚点功能（让用户固定家具位置）。

### 练习三：帧循环实现

实现一个帧循环，要求：
- 每帧输出当前相机位置（x, y, z）
- 追踪丢失时输出警告日志
- 追踪恢复时输出恢复日志

---

## 参考答案

### 练习一

**思路**：密室逃脱需要房间级走动，必须有地面参考和安全边界。

**答案**：选择 `bounded-floor`。原因：
- `bounded-floor` 提供房间级追踪，原点在地面上
- 它包含安全边界信息（`boundsGeometry`），可以用来防止玩家撞墙
- `local-floor` 虽然有地面信息，但没有安全边界，不适合需要走动的场景

**要点**：
- `bounded-floor` 适用于房间级 VR 体验
- 安全边界是房间级体验的关键安全特性

### 练习二

**思路**：区分必需特性（核心功能）和可选特性（增强功能）。

**答案**：
```typescript
const sessionConfig: XRSessionInit = {
  requiredFeatures: ['local-floor'],  // 需要地面参考来正确放置家具
  optionalFeatures: ['hit-test', 'anchors']  // 命中检测和锚点是增强功能
};
```

**要点**：
- `local-floor` 是必需的，因为家具必须放置在正确地面上
- `hit-test` 和 `anchors` 是可选的，没有它们应用仍可运行（比如用其他方式放置家具）
- 不要把 `hit-test` 放到 `requiredFeatures`，因为不是所有设备都支持

### 练习三

**思路**：基于 `requestAnimationFrame` 的递归调用，处理好 `pose` 为 `null` 的情况。

**答案**：
```typescript
let wasTracking = true;

function onFrame(time: DOMHighResTimeStamp, frame: XRFrame): void {
  session.requestAnimationFrame(onFrame);

  const pose = frame.getViewerPose(referenceSpace);

  if (!pose) {
    if (wasTracking) {
      console.warn('追踪丢失');
      wasTracking = false;
    }
    return;
  }

  if (!wasTracking) {
    console.log('追踪已恢复');
    wasTracking = true;
  }

  const position = pose.transform.position;
  console.log(`相机位置: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);

  // 渲染逻辑...
}
```

**要点**：
- 使用 `wasTracking` 状态变量追踪状态变化，避免每帧都输出日志
- 追踪丢失时不应停止帧循环，应继续请求下一帧
- `pose` 为 `null` 是正常现象，不需要错误处理
