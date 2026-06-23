# 异步生成——Worker 线程、生成队列、平滑过渡

## 主线程不能被阻塞

前面的 Chunk 生成都在主线程上运行。当玩家快速移动时，多个 Chunk 同时需要生成，每个 Chunk 的地形计算可能需要几十毫秒。如果同时生成 5-10 个 Chunk，主线程会被阻塞几百毫秒——玩家会感觉到明显的卡顿。

解决方案是把地形计算放到 Web Worker 中。Worker 在后台线程运行，不会阻塞主线程的渲染。

## Worker 的基本结构

```js
// terrain-worker.js
self.onmessage = function(e) {
  const { cx, cz, chunkSize, seed } = e.data;

  const heightMap = new Float32Array(chunkSize * chunkSize);

  for (let z = 0; z < chunkSize; z++) {
    for (let x = 0; x < chunkSize; x++) {
      const worldX = cx * chunkSize + x;
      const worldZ = cz * chunkSize + z;
      heightMap[z * chunkSize + x] = getHeight(seed, worldX, worldZ);
    }
  }

  self.postMessage({
    cx, cz,
    heightMap,
  }, [heightMap.buffer]);
};
```

注意第二个参数 `[heightMap.buffer]`——这是 Transferable，把数据的所有权从 Worker 转移到主线程，避免复制。

## 生成队列

不是所有 Chunk 都需要立刻生成。离玩家最近的 Chunk 优先级最高：

```js
class GenerationQueue {
  constructor(workerPool) {
    this.queue = [];
    this.workers = workerPool;
    this.pending = new Map();
  }

  enqueue(cx, cz, priority) {
    const key = `${cx},${cz}`;
    if (this.pending.has(key)) return;

    this.queue.push({ cx, cz, priority, key });
    this.queue.sort((a, b) => a.priority - b.priority);
    this.process();
  }

  process() {
    const idleWorker = this.workers.find(w => !w.busy);
    if (!idleWorker || this.queue.length === 0) return;

    const job = this.queue.shift();
    idleWorker.busy = true;
    this.pending.set(job.key, idleWorker);

    idleWorker.onmessage = (e) => {
      idleWorker.busy = false;
      this.pending.delete(job.key);
      this.onChunkReady(e.data);
      this.process();
    };

    idleWorker.postMessage({
      cx: job.cx,
      cz: job.cz,
      chunkSize: 16,
      seed: globalSeed,
    });
  }

  cancel(cx, cz) {
    const key = `${cx},${cz}`;
    this.queue = this.queue.filter(j => j.key !== key);
  }
}
```

## 平滑过渡

新 Chunk 突然出现会很突兀。平滑过渡的方法：

### 1. 淡入

新建的 Chunk 先设为透明，逐渐变不透明：

```js
function fadeInChunk(mesh, duration = 500) {
  mesh.material.transparent = true;
  mesh.material.opacity = 0;

  const startTime = performance.now();

  function update() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    mesh.material.opacity = t;

    if (t < 1) {
      requestAnimationFrame(update);
    } else {
      mesh.material.transparent = false;
    }
  }

  update();
}
```

### 2. 高度插值

如果 Chunk 的网格精度变化（LOD），在边界处可能出现裂缝。解决办法是在边界处让相邻 Chunk 的顶点高度一致。

## 完整代码：异步 Chunk 加载

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.007);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 25, 35);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 5;
const globalSeed = 42;

const chunkMeshes = new Map();
const pendingChunks = new Set();

function chunkKey(cx, cz) { return `${cx},${cz}`; }

function getBiomeColor(h) {
  const c = new THREE.Color();
  if (h < 0) c.setHSL(0.58, 0.6, 0.25);
  else if (h < 3) c.setHSL(0.28, 0.55, 0.32);
  else if (h < 7) c.setHSL(0.22, 0.45, 0.38);
  else c.setHSL(0.1, 0.3, 0.55);
  return c;
}

function buildChunkMesh(cx, cz, heightMap) {
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE);
  geo.rotateX(-Math.PI / 2);

  const colors = [];
  const posAttr = geo.attributes.position;

  for (let i = 0; i < posAttr.count; i++) {
    const h = heightMap[i];
    posAttr.setY(i, h);
    const c = getBiomeColor(h);
    colors.push(c.r, c.g, c.b);
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    transparent: true,
    opacity: 0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx * CHUNK_SIZE + CHUNK_SIZE / 2, 0, cz * CHUNK_SIZE + CHUNK_SIZE / 2);

  fadeInChunk(mat, 400);
  return mesh;
}

function fadeInChunk(material, duration) {
  const start = performance.now();
  function tick() {
    const t = Math.min((performance.now() - start) / duration, 1);
    material.opacity = t;
    if (t < 1) requestAnimationFrame(tick);
    else material.transparent = false;
  }
  tick();
}

function createInlineWorker() {
  const code = `
    function valueNoise(seed, x, z) {
      function hash(n) {
        n = (n << 13) ^ n;
        return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff;
      }
      const ix = Math.floor(x), iz = Math.floor(z);
      const fx = x - ix, fz = z - iz;
      const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
      const v00 = hash(ix * 374761393 + iz * 668265263 + seed);
      const v10 = hash((ix+1) * 374761393 + iz * 668265263 + seed);
      const v01 = hash(ix * 374761393 + (iz+1) * 668265263 + seed);
      const v11 = hash((ix+1) * 374761393 + (iz+1) * 668265263 + seed);
      return (v00*(1-sx)+v10*sx)*(1-sz) + (v01*(1-sx)+v11*sx)*sz;
    }

    function fbm(seed, x, z) {
      let v=0, a=1, f=1, m=0;
      for (let i=0; i<4; i++) {
        v += valueNoise(seed+i*1000, x*f, z*f) * a;
        m += a; a *= 0.5; f *= 2;
      }
      return v/m;
    }

    self.onmessage = function(e) {
      const { cx, cz, chunkSize, seed } = e.data;
      const heightMap = new Float32Array(chunkSize * chunkSize);
      for (let z=0; z<chunkSize; z++) {
        for (let x=0; x<chunkSize; x++) {
          const wx = cx*chunkSize+x, wz = cz*chunkSize+z;
          heightMap[z*chunkSize+x] = fbm(seed, wx*0.02, wz*0.02)*15 - 5;
        }
      }
      self.postMessage({ cx, cz, heightMap }, [heightMap.buffer]);
    };
  `;

  const blob = new Blob([code], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

const workers = [createInlineWorker(), createInlineWorker()];
const pendingQueue = [];

function requestChunk(cx, cz) {
  const key = chunkKey(cx, cz);
  if (chunkMeshes.has(key) || pendingChunks.has(key)) return;

  const dist = Math.max(Math.abs(cx - Math.floor(camera.position.x / CHUNK_SIZE)),
                         Math.abs(cz - Math.floor(camera.position.z / CHUNK_SIZE)));

  pendingChunks.add(key);
  pendingQueue.push({ cx, cz, dist, key });
  pendingQueue.sort((a, b) => a.dist - b.dist);
  processQueue();
}

function processQueue() {
  const idleWorker = workers.find(w => !w.busy);
  if (!idleWorker || pendingQueue.length === 0) return;

  const job = pendingQueue.shift();
  idleWorker.busy = true;

  idleWorker.onmessage = (e) => {
    idleWorker.busy = false;
    pendingChunks.delete(job.key);

    if (!chunkMeshes.has(job.key)) {
      const mesh = buildChunkMesh(e.data.cx, e.data.cz, e.data.heightMap);
      scene.add(mesh);
      chunkMeshes.set(job.key, mesh);
    }

    processQueue();
  };

  idleWorker.postMessage({
    cx: job.cx, cz: job.cz,
    chunkSize: CHUNK_SIZE, seed: globalSeed,
  });
}

function updateChunks() {
  const pcx = Math.floor(camera.position.x / CHUNK_SIZE);
  const pcz = Math.floor(camera.position.z / CHUNK_SIZE);

  const needed = new Set();
  for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      if (dx*dx + dz*dz > RENDER_DISTANCE*RENDER_DISTANCE) continue;
      const key = chunkKey(pcx+dx, pcz+dz);
      needed.add(key);
      requestChunk(pcx+dx, pcz+dz);
    }
  }

  for (const [key, mesh] of chunkMeshes) {
    if (!needed.has(key)) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      chunkMeshes.delete(key);
    }
  }
}

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
sun.position.set(30, 40, 20);
scene.add(sun);

updateChunks();

function animate() {
  requestAnimationFrame(animate);
  updateChunks();
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

运行后效果和之前类似，但现在地形生成在后台线程中完成。快速移动视角时，新的 Chunk 会平滑淡入，不会阻塞渲染。

## Worker 池的大小

通常 2-4 个 Worker 就够了。太多 Worker 会消耗过多内存和 CPU。可以根据硬件核心数动态调整：

```js
const workerCount = Math.min(navigator.hardwareConcurrency || 4, 4);
```

## 练习

1. 添加一个加载指示器——当有待生成的 Chunk 时，在屏幕角落显示"加载中..."。
2. 实现 Chunk 取消——如果玩家快速移过一个区域，取消那些已经不再需要的 Chunk 生成请求。
3. 用 `performance.now()` 测量每个 Chunk 的生成时间，在控制台输出。

## 参考答案

### 练习 1
在 animate 中检查 `pendingQueue.length > 0`，如果大于 0 就显示指示器。可以用一个简单的 DOM 元素，或者在场景中放一个旋转的加载图标。

### 练习 2
在 `updateChunks` 中，如果某个 pendingChunk 的坐标已经不在 needed 集合中，从 pendingQueue 中移除它。Worker 的 onmessage 回调中也检查一下 key 是否还在 needed 中。

### 练习 3
在 Worker 的 onmessage 回调中记录 `performance.now()` 的差值。每个 Chunk 的生成时间通常在 5-20ms 之间，取决于地形复杂度。
