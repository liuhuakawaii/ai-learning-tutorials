# 移动端适配——分辨率降级、Shader 简化、内存控制

## 移动端不是"小屏幕的桌面端"

移动端和桌面端的差异不只是屏幕小。GPU 带宽低、内存小、发热降频、触摸输入——这些都需要专门处理。

## 分辨率降级

最简单也最有效的优化：降低渲染分辨率。

```ts
// 获取设备像素比
const pixelRatio = Math.min(window.devicePixelRatio, 2); // 限制最高 2

// 降低分辨率
const renderScale = 0.75; // 75% 分辨率
renderer.setPixelRatio(pixelRatio * renderScale);
renderer.setSize(window.innerWidth, window.innerHeight);
```

更激进的策略：动态分辨率。帧率低时自动降低分辨率：

```ts
class DynamicResolution {
    private scale = 1.0;
    private targetFPS = 30;
    private fpsHistory: number[] = [];

    update(fps: number) {
        this.fpsHistory.push(fps);
        if (this.fpsHistory.length < 30) return;

        const avgFPS = this.fpsHistory.reduce((a, b) => a + b) / this.fpsHistory.length;
        this.fpsHistory = [];

        if (avgFPS < this.targetFPS * 0.9) {
            this.scale = Math.max(0.5, this.scale - 0.05);
        } else if (avgFPS > this.targetFPS * 1.1) {
            this.scale = Math.min(1.0, this.scale + 0.02);
        }

        return this.scale;
    }

    getScale() { return this.scale; }
}
```

## GPU 简化

### 降级 Shader

移动端用简化版 shader：

```ts
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

const material = isMobile
    ? new THREE.MeshLambertMaterial({ map: diffuseMap })  // 无 PBR
    : new THREE.MeshStandardMaterial({
        map: diffuseMap,
        normalMap: normalMap,
        roughness: 0.5,
        metalness: 0.1
    });
```

### 减少光照计算

- 移动端只用 1-2 个方向光，不用点光源
- 关闭阴影，或只给主光源开阴影
- 阴影贴图分辨率降到 512×512

```ts
if (isMobile) {
    renderer.shadowMap.enabled = false;
    // 或者只给一个光源开阴影
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(512, 512);
}
```

### 关闭不必要的特性

```ts
if (isMobile) {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // 跳过色彩空间转换
}
```

## 内存控制

移动端内存通常只有 2-4 GB，浏览器标签页能用的更少（约 500MB-1GB）。

### 纹理内存预算

```ts
const MEMORY_BUDGET = isMobile ? 200 * 1024 * 1024 : 512 * 1024 * 1024; // 200MB / 512MB

let currentTextureMemory = 0;

function canAllocateTexture(width: number, height: number, bytesPerPixel: number): boolean {
    const size = width * height * bytesPerPixel * (4 / 3); // 包括 mipmap
    return currentTextureMemory + size <= MEMORY_BUDGET;
}
```

### 几何体内存预算

```ts
function getGeometryMemory(geometry: THREE.BufferGeometry): number {
    let total = 0;
    for (const name of Object.keys(geometry.attributes)) {
        const attr = geometry.attributes[name];
        total += attr.array.byteLength;
    }
    if (geometry.index) total += geometry.index.array.byteLength;
    return total;
}
```

### 资源回收

移动端需要更积极的资源释放：

```ts
class ResourcePool {
    private pool = new Map<string, { resource: any; lastUsed: number }>();
    private maxIdleTime = 5000; // 5 秒未使用就释放

    update() {
        const now = Date.now();
        for (const [key, entry] of this.pool) {
            if (now - entry.lastUsed > this.maxIdleTime) {
                entry.resource.dispose();
                this.pool.delete(key);
            }
        }
    }
}
```

## 触摸输入

触摸和鼠标的行为不同：

- 没有 hover 事件
- 多点触控需要处理
- 滚动/缩放需要手势识别
- 触摸延迟（300ms）需要处理

```ts
// 触摸延迟
canvas.style.touchAction = 'none'; // 禁用浏览器默认手势

// 单指旋转
let touchStartX: number, touchStartY: number;
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }
});

canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        // 旋转相机
        camera.rotation.y -= dx * 0.01;
        camera.rotation.x -= dy * 0.01;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }
});
```

## 设备检测与降级策略

```ts
class DeviceCapabilities {
    static detect() {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return 'low';

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debugInfo
            ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
            : '';

        // 简单的设备分级
        if (/Mali-G|Adreno 3|PowerVR/i.test(renderer)) return 'low';
        if (/Adreno 5|Adreno 6|Mali-G7/i.test(renderer)) return 'medium';
        return 'high';
    }

    static getSettings(level: string) {
        switch (level) {
            case 'low':
                return {
                    pixelRatio: 1,
                    shadows: false,
                    postProcessing: false,
                    maxTextureSize: 512,
                    maxLights: 2
                };
            case 'medium':
                return {
                    pixelRatio: Math.min(window.devicePixelRatio, 1.5),
                    shadows: true,
                    postProcessing: false,
                    maxTextureSize: 1024,
                    maxLights: 4
                };
            case 'high':
                return {
                    pixelRatio: Math.min(window.devicePixelRatio, 2),
                    shadows: true,
                    postProcessing: true,
                    maxTextureSize: 2048,
                    maxLights: 8
                };
        }
    }
}
```

## 练习

### 练习一：动态分辨率

实现上面的 DynamicResolution 类，在帧率低于 30fps 时自动降低渲染分辨率。在桌面端用 Chrome 的 CPU throttling 模拟低端设备。

### 练习二：设备检测

用 DeviceCapabilities.detect() 在不同设备上测试。记录返回值，验证分级是否合理。

### 练习三：移动端触摸控制

实现一个支持以下手势的 3D 场景控制：

- 单指拖拽旋转相机
- 双指捏合缩放
- 双指平移

---

## 参考答案

### 练习一

```ts
const dynRes = new DynamicResolution();
const fpsCounter = new FPSCounter();

function animate() {
    requestAnimationFrame(animate);
    fpsCounter.update();

    const scale = dynRes.update(fpsCounter.getFPS());
    if (scale !== undefined) {
        renderer.setSize(
            window.innerWidth * scale,
            window.innerHeight * scale,
            false
        );
        renderer.domElement.style.width = window.innerWidth + 'px';
        renderer.domElement.style.height = window.innerHeight + 'px';
    }

    renderer.render(scene, camera);
}
```

### 练习二

典型结果：

- iPhone：low 或 medium
- iPad Pro：medium 或 high
- Android 旗舰：medium
- Android 低端：low

### 练习三

```ts
class TouchControls {
    private singleTouch = { x: 0, y: 0, active: false };
    private pinchStart = 0;
    private pinchActive = false;

    constructor(private camera: THREE.Camera, private canvas: HTMLElement) {
        canvas.addEventListener('touchstart', this.onTouchStart);
        canvas.addEventListener('touchmove', this.onTouchMove);
        canvas.addEventListener('touchend', this.onTouchEnd);
    }

    private onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
            this.singleTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: true };
        } else if (e.touches.length === 2) {
            this.pinchActive = true;
            const dx = e.touches[1].clientX - e.touches[0].clientX;
            const dy = e.touches[1].clientY - e.touches[0].clientY;
            this.pinchStart = Math.sqrt(dx * dx + dy * dy);
        }
    }

    private onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1 && this.singleTouch.active) {
            const dx = e.touches[0].clientX - this.singleTouch.x;
            const dy = e.touches[0].clientY - this.singleTouch.y;
            this.camera.rotation.y -= dx * 0.005;
            this.camera.rotation.x = Math.max(-Math.PI/2,
                Math.min(Math.PI/2, this.camera.rotation.x - dy * 0.005));
            this.singleTouch.x = e.touches[0].clientX;
            this.singleTouch.y = e.touches[0].clientY;
        } else if (e.touches.length === 2 && this.pinchActive) {
            const dx = e.touches[1].clientX - e.touches[0].clientX;
            const dy = e.touches[1].clientY - e.touches[0].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const scale = this.pinchStart / dist;
            this.camera.position.multiplyScalar(scale);
            this.pinchStart = dist;
        }
    }

    private onTouchEnd = () => {
        this.singleTouch.active = false;
        this.pinchActive = false;
    }
}
```
