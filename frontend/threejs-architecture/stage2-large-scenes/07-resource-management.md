# 资源管理——纹理/模型异步加载、LOD 策略、内存预算

## 加载是 3D 应用的"冷启动"问题

一个 Three.js 场景的资源通常包括：模型文件（GLTF/OBJ）、纹理图片、环境贴图、字体文件、音频。如果同步加载，用户看到的是空白画面等几十秒。如果不限制并发，浏览器会同时发起上百个请求。如果不管内存，GPU 显存爆了直接崩溃。

资源管理的核心问题：怎么加载、怎么缓存、怎么释放。

## 加载器的异步模型

Three.js 的加载器都继承自 `Loader` 基类，采用回调 + 事件模式：

```ts
const loader = new GLTFLoader();

loader.load(
    'model.glb',
    (gltf) => {
        // 加载完成
        scene.add(gltf.scene);
    },
    (event) => {
        // 进度
        const percent = (event.loaded / event.total * 100).toFixed(1);
        console.log(`${percent}% loaded`);
    },
    (error) => {
        // 错误
        console.error('Load failed:', error);
    }
);
```

更现代的用法是 `loadAsync()`，返回 Promise：

```ts
const gltf = await loader.loadAsync('model.glb');
```

## 并发控制：不要一次加载 100 个文件

浏览器对同一域名的并发连接数限制在 6 个左右。如果同时发起 100 个请求，它们会排队。更糟的是，每个请求都占内存，同时加载太多会撑爆。

需要一个加载队列：

```ts
class LoadQueue {
    private queue: (() => Promise<any>)[] = [];
    private running = 0;
    private maxConcurrent: number;

    constructor(maxConcurrent = 6) {
        this.maxConcurrent = maxConcurrent;
    }

    add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            });
            this._process();
        });
    }

    private _process() {
        while (this.running < this.maxConcurrent && this.queue.length > 0) {
            const task = this.queue.shift()!;
            this.running++;
            task().finally(() => {
                this.running--;
                this._process();
            });
        }
    }
}

// 使用
const queue = new LoadQueue(4);
const model = await queue.add(() => loader.loadAsync('model.glb'));
const texture = await queue.add(() => textureLoader.loadAsync('diffuse.jpg'));
```

## 缓存策略

重复加载同一个 URL 是浪费。Three.js 的纹理加载器有内置缓存：

```ts
// TextureLoader 内部用 Cache
THREE.Cache.enabled = true;

// 相同 URL 返回同一个纹理对象
const tex1 = await textureLoader.loadAsync('brick.jpg');
const tex2 = await textureLoader.loadAsync('brick.jpg');
console.log(tex1 === tex2); // true
```

但模型加载器（GLTFLoader）没有自动缓存——同一个 GLB 文件加载两次，会得到两个独立的 scene 对象。需要自己实现：

```ts
const modelCache = new Map<string, THREE.Group>();

async function loadModel(url: string): Promise<THREE.Group> {
    if (modelCache.has(url)) {
        // clone 而不是重新加载
        return modelCache.get(url)!.clone();
    }
    const gltf = await loader.loadAsync(url);
    modelCache.set(url, gltf.scene);
    return gltf.scene;
}
```

## LOD：按距离选择细节层级

LOD（Level of Detail）不是"远处用低面数模型"那么简单。它需要解决：

1. 什么时候切换？——基于屏幕像素大小，不是世界距离
2. 切换时怎么避免跳变？——用 hysteresis（滞后）
3. 低面数模型怎么来？——手动建模或自动减面

Three.js 内置了 `LOD` 对象：

```ts
const lod = new THREE.LOD();

// 添加不同细节层级
lod.addLevel(highDetailMesh, 0);    // 距离 0-50 用高精度
lod.addLevel(mediumDetailMesh, 50); // 距离 50-200 用中精度
lod.addLevel(lowDetailMesh, 200);   // 距离 200+ 用低精度

scene.add(lod);
```

每帧渲染时，Three.js 根据物体到相机的距离选择合适的层级。但这用的是世界距离，不是屏幕像素大小——同一个物体在大屏和小屏上表现不同。

更精确的做法：

```ts
// 手动基于屏幕占比选择
function getLODLevel(object, camera, renderer) {
    const distance = camera.position.distanceTo(object.position);
    const height = renderer.domElement.height;
    const fov = camera.fov * Math.PI / 180;

    // 物体在屏幕上的近似像素高度
    const screenSize = height / (2 * Math.tan(fov / 2)) / distance * object.scale.y;

    if (screenSize > 500) return 0; // 高精度
    if (screenSize > 100) return 1; // 中精度
    return 2; // 低精度
}
```

## 纹理内存预算

纹理是 GPU 内存的最大消耗者。一张 2048×2048 的 RGBA 纹理，未压缩时占 16 MB。一个场景如果有 50 张这样的纹理，就是 800 MB。

计算公式：

```
内存 = width × height × bytesPerPixel × (4/3)  // mipmap 额外 1/3
```

压缩纹理格式可以大幅减少内存：

| 格式 | 压缩比 | 适用 |
|---|---|---|
| KTX2 (Basis Universal) | 4:1 ~ 8:1 | 通用，Web 支持好 |
| DDS (DXT/BC) | 4:1 ~ 8:1 | 桌面端 |
| ASTC | 可变 | 移动端 |

Three.js 支持 KTX2 加载：

```ts
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';

const ktx2Loader = new KTX2Loader()
    .setTranscoderPath('basis/')
    .detectSupport(renderer);

const texture = await ktx2Loader.loadAsync('texture.ktx2');
```

## 资源释放

Three.js 的资源不会自动释放。你需要手动管理：

```ts
// 释放几何体
geometry.dispose();

// 释放材质
material.dispose();

// 释放纹理
texture.dispose();

// 释放整个场景
function disposeScene(scene) {
    scene.traverse((object) => {
        if (object.isMesh) {
            object.geometry.dispose();
            if (Array.isArray(object.material)) {
                object.material.forEach(m => m.dispose());
            } else {
                object.material.dispose();
            }
        }
    });
}
```

不 dispose 的后果：GPU 内存持续增长，直到浏览器标签页崩溃。

## 练习

### 练习一：实现加载队列

实现一个支持优先级的加载队列。要求：

- 高优先级资源（相机附近的物体）先加载
- 支持取消（用户离开页面时取消未完成的请求）
- 进度回调

### 练习二：纹理内存计算器

写一个函数，计算场景中所有纹理的 GPU 内存占用：

```ts
function calculateTextureMemory(scene: THREE.Scene): {
    totalBytes: number;
    details: { name: string; bytes: number; resolution: string }[];
}
```

### 练习三：资源释放检查器

写一个函数，检查场景中有哪些资源没有被 dispose。提示：遍历场景，检查 geometry 和 material 的 dispose 方法是否被调用过（可以通过 proxy 或 wrapper 实现）。

---

## 参考答案

### 练习一

```ts
class PriorityLoadQueue {
    private queue: { priority: number; task: () => Promise<any> }[] = [];
    private running = 0;
    private maxConcurrent: number;
    private abortController = new AbortController();

    constructor(maxConcurrent = 6) {
        this.maxConcurrent = maxConcurrent;
    }

    add<T>(task: () => Promise<T>, priority = 0): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ priority, task: async () => {
                try { resolve(await task()); } catch (e) { reject(e); }
            }});
            this.queue.sort((a, b) => b.priority - a.priority);
            this._process();
        });
    }

    cancel() { this.abortController.abort(); }

    private _process() {
        while (this.running < this.maxConcurrent && this.queue.length > 0) {
            const { task } = this.queue.shift()!;
            this.running++;
            task().finally(() => { this.running--; this._process(); });
        }
    }
}
```

### 练习二

```ts
function calculateTextureMemory(scene: THREE.Scene) {
    const textures = new Set<THREE.Texture>();
    scene.traverse(obj => {
        if (obj.isMesh) {
            const mat = obj.material;
            for (const key of Object.keys(mat)) {
                if (mat[key]?.isTexture) textures.add(mat[key]);
            }
        }
    });

    const details = [];
    let total = 0;
    for (const tex of textures) {
        const w = tex.image?.width || 0;
        const h = tex.image?.height || 0;
        const bytes = w * h * 4 * (4 / 3); // RGBA + mipmap
        total += bytes;
        details.push({ name: tex.name || 'unnamed', bytes, resolution: `${w}x${h}` });
    }
    return { totalBytes: total, details };
}
```

### 练习三

最简单的实现是用 WeakSet 记录已 dispose 的资源：

```ts
const disposed = new WeakSet();
const origDispose = THREE.BufferGeometry.prototype.dispose;
THREE.BufferGeometry.prototype.dispose = function() {
    disposed.add(this);
    origDispose.call(this);
};

function checkLeaks(scene: THREE.Scene) {
    const leaked: string[] = [];
    scene.traverse(obj => {
        if (obj.isMesh) {
            if (!disposed.has(obj.geometry)) leaked.push(`geometry of ${obj.name}`);
        }
    });
    return leaked;
}
```
