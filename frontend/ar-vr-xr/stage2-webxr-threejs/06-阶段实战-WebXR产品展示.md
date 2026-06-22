# 阶段实战：WebXR AR 产品展示应用

## 场景引入

你已经掌握了 WebXR 的核心能力——会话管理、命中检测、锚点、Three.js 集成和空间音频。现在是时候将这些知识整合为一个完整的实战项目了。

本课将构建一个 **AR 产品展示应用**：用户通过手机摄像头在真实环境中放置虚拟产品（如家具），可以旋转、缩放、试听产品音效，并通过锚点确保产品位置稳定。这是一个在电商领域有广泛应用的场景。

## 学习目标

- 整合阶段二的所有知识构建完整应用
- 掌握 AR 产品展示的完整开发流程
- 实现物体放置、选择、变换的交互系统
- 处理真实的工程问题：资源加载、性能优化、错误处理
- 能独立完成类似项目的开发

## 项目架构

```
ar-product-viewer/
├── index.html                 # 入口页面
├── src/
│   ├── main.ts                # 应用入口
│   ├── ARSessionManager.ts    # XR 会话管理
│   ├── HitTestManager.ts      # 命中检测管理
│   ├── AnchorManager.ts       # 锚点管理
│   ├── ProductManager.ts      # 产品模型管理
│   ├── InteractionSystem.ts   # 交互系统
│   ├── UIManager.ts           # UI 反馈
│   └── AudioManager.ts        # 空间音频
├── assets/
│   ├── models/                # 3D 模型文件
│   └── sounds/                # 音频文件
└── package.json
```

## 核心模块实现

### 1. XRSession 管理器

封装 XR 会话的创建、配置和生命周期管理：

```typescript
type SessionState = 'idle' | 'starting' | 'active' | 'ended';

class ARSessionManager {
  private session: XRSession | null = null;
  private state: SessionState = 'idle';
  private stateListeners: ((state: SessionState) => void)[] = [];

  onStateChange(listener: (state: SessionState) => void): void {
    this.stateListeners.push(listener);
  }

  private setState(state: SessionState): void {
    this.state = state;
    this.stateListeners.forEach(l => l(state));
  }

  async start(
    renderer: THREE.WebGLRenderer,
    sessionConfig: XRSessionInit
  ): Promise<XRReferenceSpace> {
    if (!navigator.xr) {
      throw new Error('WebXR 不可用');
    }

    const supported = await navigator.xr.isSessionSupported('immersive-ar');
    if (!supported) {
      throw new Error('当前设备不支持 AR');
    }

    this.setState('starting');

    try {
      this.session = await navigator.xr.requestSession('immersive-ar', sessionConfig);

      this.session.addEventListener('end', () => {
        this.setState('ended');
        this.session = null;
      });

      renderer.xr.setSession(this.session);

      const referenceSpace = await this.session.requestReferenceSpace('local-floor');
      this.setState('active');

      return referenceSpace;
    } catch (error) {
      this.setState('idle');
      throw error;
    }
  }

  end(): void {
    this.session?.end();
  }

  get currentState(): SessionState {
    return this.state;
  }

  get currentSession(): XRSession | null {
    return this.session;
  }
}
```

### 2. 命中检测管理器

管理命中检测源和结果处理：

```typescript
class HitTestManager {
  private hitTestSource: XRHitTestSource | null = null;
  private active = false;

  async setup(session: XRSession, referenceSpace: XRReferenceSpace): Promise<void> {
    try {
      this.hitTestSource = await session.requestHitTestSource({
        space: referenceSpace,
      });
      this.active = true;
    } catch (error) {
      console.warn('命中检测不可用:', error);
      this.active = false;
    }
  }

  getHit(frame: XRFrame, referenceSpace: XRReferenceSpace): XRPose | null {
    if (!this.active || !this.hitTestSource) return null;

    const results = frame.getHitTestResults(this.hitTestSource);
    if (results.length === 0) return null;

    return results[0].getPose(referenceSpace) ?? null;
  }

  cancel(): void {
    this.hitTestSource?.cancel();
    this.hitTestSource = null;
    this.active = false;
  }
}
```

### 3. 锚点管理器

管理所有产品锚点的创建、更新和销毁：

```typescript
class AnchorManager {
  private anchors: Map<string, { anchor: XRAnchor; productId: string }> = new Map();

  async create(
    frame: XRFrame,
    hitPose: XRPose,
    productId: string
  ): Promise<string | null> {
    try {
      const anchor = await frame.createAnchor(hitPose, hitPose.space ?? undefined);
      const anchorId = crypto.randomUUID();
      this.anchors.set(anchorId, { anchor, productId });
      return anchorId;
    } catch (error) {
      console.error('创建锚点失败:', error);
      return null;
    }
  }

  update(frame: XRFrame, referenceSpace: XRReferenceSpace): Map<string, XRPose> {
    const poses = new Map<string, XRPose>();

    this.anchors.forEach(({ anchor }, id) => {
      const pose = frame.getPose(anchor.anchorSpace, referenceSpace);
      if (pose) {
        poses.set(id, pose);
      }
    });

    return poses;
  }

  remove(anchorId: string): void {
    const entry = this.anchors.get(anchorId);
    if (entry) {
      entry.anchor.delete();
      this.anchors.delete(anchorId);
    }
  }

  getByProductId(productId: string): string[] {
    const ids: string[] = [];
    this.anchors.forEach(({ productId: pid }, id) => {
      if (pid === productId) ids.push(id);
    });
    return ids;
  }

  clear(): void {
    this.anchors.forEach(({ anchor }) => anchor.delete());
    this.anchors.clear();
  }
}
```

### 4. 产品模型管理器

加载、缓存和管理 3D 产品模型：

```typescript
interface Product {
  id: string;
  name: string;
  modelPath: string;
  scale: number;
  description: string;
}

class ProductManager {
  private loader = new THREE.GLTFLoader();
  private models: Map<string, THREE.Group> = new Map();
  private placedProducts: Map<string, { model: THREE.Group; anchorId: string }> = new Map();

  async loadModel(product: Product): Promise<THREE.Group> {
    if (this.models.has(product.id)) {
      return this.models.get(product.id)!.clone();
    }

    return new Promise((resolve, reject) => {
      this.loader.load(
        product.modelPath,
        (gltf) => {
          const model = gltf.scene;
          model.scale.setScalar(product.scale);

          // 启用阴影
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          this.models.set(product.id, model);
          resolve(model.clone());
        },
        undefined,
        reject
      );
    });
  }

  placeProduct(
    productId: string,
    model: THREE.Group,
    anchorId: string,
    scene: THREE.Scene
  ): void {
    scene.add(model);
    this.placedProducts.set(productId, { model, anchorId });
  }

  removeProduct(productId: string, scene: THREE.Scene, anchorManager: AnchorManager): void {
    const entry = this.placedProducts.get(productId);
    if (!entry) return;

    scene.remove(entry.model);
    anchorManager.remove(entry.anchorId);
    this.placedProducts.delete(productId);
  }

  updateFromAnchors(
    anchorPoses: Map<string, XRPose>,
    anchorManager: AnchorManager
  ): void {
    this.placedProducts.forEach(({ model, anchorId }) => {
      const pose = anchorPoses.get(anchorId);
      if (!pose) return;

      const pos = pose.transform.position;
      const rot = pose.transform.orientation;
      model.position.set(pos.x, pos.y, pos.z);
      model.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    });
  }
}
```

### 5. 交互系统

处理用户对已放置产品的选择、旋转和缩放：

```typescript
type InteractionMode = 'idle' | 'selecting' | 'rotating' | 'scaling';

class InteractionSystem {
  private mode: InteractionMode = 'idle';
  private selectedProduct: THREE.Group | null = null;
  private raycaster = new THREE.Raycaster();
  private tempMatrix = new THREE.Matrix4();

  // 选择产品
  selectProduct(
    controller: THREE.Group,
    products: THREE.Group[]
  ): THREE.Group | null {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

    const intersects = this.raycaster.intersectObjects(products, true);

    if (intersects.length > 0) {
      // 找到被选中的产品根节点
      let selected = intersects[0].object;
      while (selected.parent && !selected.userData.productId) {
        selected = selected.parent;
      }
      this.selectedProduct = selected as THREE.Group;
      this.mode = 'selecting';
      return this.selectedProduct;
    }

    this.selectedProduct = null;
    this.mode = 'idle';
    return null;
  }

  // 旋转产品
  rotateProduct(angle: number): void {
    if (!this.selectedProduct) return;
    this.selectedProduct.rotation.y += angle;
  }

  // 缩放产品
  scaleProduct(factor: number): void {
    if (!this.selectedProduct) return;
    const newScale = this.selectedProduct.scale.x * factor;
    this.selectedProduct.scale.setScalar(
      Math.max(0.1, Math.min(5, newScale))
    );
  }

  get currentMode(): InteractionMode {
    return this.mode;
  }

  get selected(): THREE.Group | null {
    return this.selectedProduct;
  }

  deselect(): void {
    this.selectedProduct = null;
    this.mode = 'idle';
  }
}
```

### 6. UI 管理器

管理 DOM 叠加层的 UI 反馈：

```typescript
class UIManager {
  private overlay: HTMLElement;
  private statusText: HTMLElement;
  private productPanel: HTMLElement;

  constructor(containerId: string) {
    this.overlay = document.getElementById(containerId)!;
    this.statusText = document.getElementById('status')!;
    this.productPanel = document.getElementById('product-panel')!;
  }

  showStatus(message: string): void {
    this.statusText.textContent = message;
    this.statusText.style.display = 'block';
  }

  hideStatus(): void {
    this.statusText.style.display = 'none';
  }

  showProductPanel(products: Product[], onSelect: (product: Product) => void): void {
    this.productPanel.innerHTML = '';
    products.forEach((product) => {
      const button = document.createElement('button');
      button.textContent = product.name;
      button.className = 'product-button';
      button.addEventListener('click', () => onSelect(product));
      this.productPanel.appendChild(button);
    });
    this.productPanel.style.display = 'flex';
  }

  hideProductPanel(): void {
    this.productPanel.style.display = 'none';
  }

  showSelectedActions(
    product: Product,
    onRotate: () => void,
    onScale: (factor: number) => void,
    onDelete: () => void
  ): void {
    const panel = document.getElementById('action-panel')!;
    panel.innerHTML = `
      <div class="action-header">${product.name}</div>
      <button id="rotate-btn">旋转 45°</button>
      <button id="scale-up-btn">放大</button>
      <button id="scale-down-btn">缩小</button>
      <button id="delete-btn">删除</button>
    `;

    document.getElementById('rotate-btn')!.addEventListener('click', onRotate);
    document.getElementById('scale-up-btn')!.addEventListener('click', () => onScale(1.2));
    document.getElementById('scale-down-btn')!.addEventListener('click', () => onScale(0.8));
    document.getElementById('delete-btn')!.addEventListener('click', onDelete);

    panel.style.display = 'block';
  }

  hideActions(): void {
    const panel = document.getElementById('action-panel')!;
    panel.style.display = 'none';
  }
}
```

### 7. 空间音频管理

为产品展示添加空间音频效果：

```typescript
class ProductAudioManager {
  private audioSystem: SpatialAudioSystem;
  private productSounds: Map<string, string> = new Map();  // productId -> sourceId

  constructor() {
    this.audioSystem = new SpatialAudioSystem();
  }

  async init(): Promise<void> {
    await this.audioSystem.resume();
  }

  async addProductSound(
    productId: string,
    audioUrl: string,
    position: { x: number; y: number; z: number }
  ): Promise<void> {
    const sourceId = `product-${productId}`;
    await this.audioSystem.createSpatialSource(sourceId, audioUrl, position, {
      loop: true,
      refDistance: 1,
      maxDistance: 10,
      volume: 0.5,
    });
    this.productSounds.set(productId, sourceId);
  }

  updateProductPosition(
    productId: string,
    position: { x: number; y: number; z: number }
  ): void {
    const sourceId = this.productSounds.get(productId);
    if (sourceId) {
      this.audioSystem.updateSourcePosition(sourceId, position.x, position.y, position.z);
    }
  }

  removeProductSound(productId: string): void {
    const sourceId = this.productSounds.get(productId);
    if (sourceId) {
      this.audioSystem.removeSource(sourceId);
      this.productSounds.delete(productId);
    }
  }

  updateListener(camera: THREE.Camera): void {
    this.audioSystem.updateListener(camera);
  }

  dispose(): void {
    this.audioSystem.dispose();
  }
}
```

## 主应用整合

将所有模块整合到主应用中：

```typescript
class ARProductViewer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cameraGroup: THREE.Group;

  private sessionManager = new ARSessionManager();
  private hitTestManager = new HitTestManager();
  private anchorManager = new AnchorManager();
  private productManager = new ProductManager();
  private interactionSystem = new InteractionSystem();
  private uiManager: UIManager;
  private audioManager = new ProductAudioManager();

  private reticle: THREE.Mesh;  // 命中指示器
  private referenceSpace: XRReferenceSpace | null = null;
  private selectedProductForPlacement: Product | null = null;

  private products: Product[] = [
    {
      id: 'chair-1',
      name: '现代椅子',
      modelPath: '/assets/models/chair.glb',
      scale: 1,
      description: '简约现代风格椅子',
    },
    {
      id: 'table-1',
      name: '实木桌子',
      modelPath: '/assets/models/table.glb',
      scale: 1,
      description: '北欧风格实木桌子',
    },
    {
      id: 'lamp-1',
      name: '落地灯',
      modelPath: '/assets/models/lamp.glb',
      scale: 1,
      description: '简约落地灯',
    },
  ];

  constructor(container: HTMLElement) {
    // 初始化渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    // 初始化场景
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.01, 100
    );
    this.cameraGroup = new THREE.Group();
    this.cameraGroup.add(this.camera);
    this.scene.add(this.cameraGroup);

    // 光照
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    hemiLight.position.set(0.5, 1, 0.25);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0, 3, 1);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    // 命中指示器
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.08, 32),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    this.reticle.rotation.x = -Math.PI / 2;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    // UI
    this.uiManager = new UIManager('overlay');

    // 设置交互
    this.setupInteractions();

    // 渲染循环
    this.renderer.setAnimationLoop(this.animate.bind(this));
  }

  private setupInteractions(): void {
    // XR 按钮
    const xrButton = document.getElementById('start-ar')!;
    xrButton.addEventListener('click', () => this.startAR());

    // 产品选择面板
    this.uiManager.showProductPanel(this.products, (product) => {
      this.selectedProductForPlacement = product;
      this.uiManager.showStatus(`点击地面放置 ${product.name}`);
    });
  }

  private async startAR(): Promise<void> {
    try {
      this.referenceSpace = await this.sessionManager.start(this.renderer, {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hit-test', 'anchors', 'plane-detection'],
        domOverlay: { root: document.getElementById('overlay')! },
      });

      await this.hitTestManager.setup(
        this.sessionManager.currentSession!,
        this.referenceSpace
      );

      await this.audioManager.init();

      // 监听选择事件
      this.sessionManager.currentSession!.addEventListener('select', () => this.onSelect());

      this.uiManager.hideStatus();
    } catch (error) {
      this.uiManager.showStatus(`启动失败: ${(error as Error).message}`);
    }
  }

  private async onSelect(): Promise<void> {
    if (!this.referenceSpace || !this.sessionManager.currentSession) return;

    // 如果有选中的产品要放置
    if (this.selectedProductForPlacement && this.reticle.visible) {
      const frame = this.sessionManager.currentSession.currentFrame;
      if (!frame) return;

      // 从命中检测创建锚点
      const hitPose = this.hitTestManager.getHit(frame, this.referenceSpace);
      if (!hitPose) return;

      const anchorId = await this.anchorManager.create(
        frame,
        hitPose,
        this.selectedProductForPlacement.id
      );
      if (!anchorId) return;

      // 加载并放置产品模型
      try {
        const model = await this.productManager.loadModel(this.selectedProductForPlacement);
        this.productManager.placeProduct(
          this.selectedProductForPlacement.id,
          model,
          anchorId,
          this.scene
        );

        // 添加产品音效
        await this.audioManager.addProductSound(
          this.selectedProductForPlacement.id,
          '/assets/sounds/ambient.mp3',
          { x: hitPose.transform.position.x, y: hitPose.transform.position.y, z: hitPose.transform.position.z }
        );

        this.uiManager.showStatus(`${this.selectedProductForPlacement.name} 已放置`);
        this.selectedProductForPlacement = null;
      } catch (error) {
        this.uiManager.showStatus('模型加载失败');
      }
      return;
    }

    // 尝试选择已放置的产品
    // （需要实现射线与已放置模型的交互）
  }

  private animate(timestamp: number, frame?: XRFrame): void {
    if (!frame || !this.referenceSpace) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // 更新命中检测指示器
    const hitPose = this.hitTestManager.getHit(frame, this.referenceSpace);
    if (hitPose && this.selectedProductForPlacement) {
      const pos = hitPose.transform.position;
      const rot = hitPose.transform.orientation;
      this.reticle.visible = true;
      this.reticle.position.set(pos.x, pos.y, pos.z);
      this.reticle.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    } else {
      this.reticle.visible = false;
    }

    // 更新锚点
    const anchorPoses = this.anchorManager.update(frame, this.referenceSpace);
    this.productManager.updateFromAnchors(anchorPoses, this.anchorManager);

    // 更新音频监听器
    this.audioManager.updateListener(this.camera);

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.anchorManager.clear();
    this.hitTestManager.cancel();
    this.audioManager.dispose();
    this.sessionManager.end();
  }
}

// 启动
const app = new ARProductViewer(document.getElementById('app')!);
```

## 工程优化建议

### 性能优化

```typescript
// 1. 模型 LOD（细节层次）
const lod = new THREE.LOD();
lod.addLevel(highDetailModel, 0);    // 近距离：高细节
lod.addLevel(mediumDetailModel, 5);  // 中距离：中细节
lod.addLevel(lowDetailModel, 10);    // 远距离：低细节

// 2. 纹理压缩
const loader = new THREE.GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);  // 使用 Meshopt 压缩

// 3. 按需渲染
renderer.setAnimationLoop((timestamp, frame) => {
  // 只在场景变化时渲染
  if (sceneNeedsUpdate || frame) {
    renderer.render(scene, camera);
    sceneNeedsUpdate = false;
  }
});
```

### 错误处理

```typescript
// 全局错误处理
class ErrorHandler {
  static handle(error: Error, context: string): void {
    console.error(`[${context}]`, error);

    // 用户友好的错误提示
    const messages: Record<string, string> = {
      'WebXR 不可用': '您的浏览器不支持 AR 功能，请使用 Chrome 浏览器',
      '当前设备不支持 AR': '您的设备不支持 AR 功能',
      '命中检测不可用': '无法检测地面，请确保光线充足',
    };

    const userMessage = messages[error.message] ?? '发生未知错误';
    uiManager.showStatus(userMessage);
  }
}
```

### 离线支持

```typescript
// 使用 Service Worker 缓存模型和音频
// sw.js
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached ?? fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open('ar-assets-v1').then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});
```

## 常见误区

### 误区一：不预加载模型

在用户选择产品后才开始加载模型，会导致明显的等待时间。应该在应用启动时预加载所有产品模型，或使用渐进式加载。

### 误区二：忽略内存管理

每个 3D 模型和音频缓冲区都占用内存。如果用户放置了大量产品而不清理，会导致内存溢出。应该限制最大放置数量，并及时释放未使用的资源。

### 误区三：不处理追踪丢失

AR 追踪可能因为光线不足或遮挡而丢失。应用应该在追踪丢失时显示友好提示，并在追踪恢复后自动继续。

## 工程建议

1. **模型优化**：使用 glTF 格式，压缩纹理，减少多边形数量（移动端建议 < 100K 三角形/模型）
2. **渐进式加载**：先显示低精度模型，再逐步加载高精度版本
3. **交互反馈**：每个交互都应该有视觉或触觉反馈
4. **状态持久化**：使用 localStorage 保存用户的放置偏好
5. **分析与监控**：记录用户放置位置、交互行为，用于产品优化

## 小结

本课通过构建一个完整的 AR 产品展示应用，整合了阶段二的所有知识：

- **XRSession 管理**：会话生命周期和状态管理
- **命中检测**：确定产品放置位置
- **锚点管理**：固定产品在真实世界的位置
- **Three.js 集成**：3D 渲染和控制器交互
- **空间音频**：产品音效的空间化
- **UI 反馈**：DOM 叠加层的状态提示

这个项目涵盖了 AR 应用开发的核心流程，可以直接作为商业项目的基础架构。

## 练习

### 练习一：产品目录扩展

扩展产品目录，添加至少 6 个产品。为每个产品添加分类标签（如「家具」「灯具」「装饰」），并实现分类筛选 UI。

### 练习二：产品信息面板

当用户选中一个已放置的产品时，显示一个浮动信息面板，包含产品名称、描述、价格和「购买」按钮。信息面板应该跟随产品位置，始终面向用户。

### 练习三：AR 测量工具

在产品展示应用中集成一个简单的测量工具：用户可以在地面上标记两个点，显示两点之间的距离。这个功能可以帮助用户判断产品是否适合放置空间。

---

## 参考答案

### 练习一

**思路**：扩展 Product 接口添加分类字段，实现分类筛选组件。

**答案**：
```typescript
interface Product {
  id: string;
  name: string;
  modelPath: string;
  scale: number;
  description: string;
  category: 'furniture' | 'lighting' | 'decoration';
  price: number;
}

// 分类筛选
class CategoryFilter {
  private categories = ['全部', '家具', '灯具', '装饰'];
  private activeCategory = '全部';

  render(onFilter: (category: string) => void): void {
    const container = document.getElementById('category-filter')!;
    container.innerHTML = this.categories.map(cat =>
      `<button class="${cat === this.activeCategory ? 'active' : ''}" data-category="${cat}">${cat}</button>`
    ).join('');

    container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.category) {
        this.activeCategory = target.dataset.category;
        onFilter(this.activeCategory);
        this.render(onFilter);
      }
    });
  }

  filter(products: Product[]): Product[] {
    if (this.activeCategory === '全部') return products;
    const categoryMap: Record<string, string> = {
      '家具': 'furniture', '灯具': 'lighting', '装饰': 'decoration'
    };
    return products.filter(p => p.category === categoryMap[this.activeCategory]);
  }
}
```

**要点**：
- 分类使用中文显示，内部使用英文枚举
- 「全部」分类显示所有产品
- 筛选状态持久化到 localStorage

### 练习二

**思路**：使用 CSS3DRenderer 或 HTML/CSS 创建始终面向相机的信息面板。

**答案**：
```typescript
class ProductInfoPanel {
  private element: HTMLElement;
  private product: Product | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'product-info-panel';
    this.element.style.display = 'none';
    document.getElementById('overlay')!.appendChild(this.element);
  }

  show(product: Product, screenPosition: { x: number; y: number }): void {
    this.product = product;
    this.element.innerHTML = `
      <h3>${product.name}</h3>
      <p>${product.description}</p>
      <p class="price">¥${product.price}</p>
      <button class="buy-btn">加入购物车</button>
    `;
    this.element.style.left = `${screenPosition.x}px`;
    this.element.style.top = `${screenPosition.y}px`;
    this.element.style.display = 'block';
  }

  hide(): void {
    this.element.style.display = 'none';
    this.product = null;
  }

  // 将 3D 位置投影到屏幕坐标
  static projectToScreen(
    position: THREE.Vector3,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer
  ): { x: number; y: number } {
    const vector = position.clone().project(camera);
    const x = (vector.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
    const y = (-vector.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
    return { x, y };
  }
}
```

**要点**：
- 使用 Three.js 的 `project()` 方法将 3D 坐标转换为屏幕坐标
- 信息面板使用 DOM 元素，便于样式和交互
- 面板位置每帧更新，跟随产品移动

### 练习三

**思路**：使用命中检测获取两个端点，计算距离并可视化。

**答案**：
```typescript
class ARMeasurer {
  private points: THREE.Vector3[] = [];
  private markers: THREE.Mesh[] = [];
  private line: THREE.Line | null = null;
  private distanceLabel: HTMLElement;

  constructor(scene: THREE.Scene) {
    this.distanceLabel = document.getElementById('distance-label')!;

    // 创建标记点材质
    const markerGeom = new THREE.SphereGeometry(0.02, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    for (let i = 0; i < 2; i++) {
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.visible = false;
      scene.add(marker);
      this.markers.push(marker);
    }
  }

  addPoint(position: THREE.Vector3): void {
    if (this.points.length >= 2) {
      this.reset();
    }

    this.points.push(position.clone());
    this.markers[this.points.length - 1].position.copy(position);
    this.markers[this.points.length - 1].visible = true;

    if (this.points.length === 2) {
      this.drawLine();
      this.showDistance();
    }
  }

  private drawLine(): void {
    const geometry = new THREE.BufferGeometry().setFromPoints(this.points);
    const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
    this.line = new THREE.Line(geometry, material);
    // scene.add(this.line);
  }

  private showDistance(): void {
    const distance = this.points[0].distanceTo(this.points[1]);
    this.distanceLabel.textContent = `${(distance * 100).toFixed(1)} cm`;
    this.distanceLabel.style.display = 'block';
  }

  reset(): void {
    this.points = [];
    this.markers.forEach(m => m.visible = false);
    this.line?.remove();
    this.line = null;
    this.distanceLabel.style.display = 'none';
  }
}
```

**要点**：
- 两个红色球体标记端点
- 红线连接两个端点
- 距离以厘米显示（WebXR 单位是米）
- 第三次点击重置测量
