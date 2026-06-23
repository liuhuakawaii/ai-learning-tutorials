# Chunk 系统——分块加载/卸载、LOD 管理

## 为什么需要 Chunk

前面的课程把整个世界一次性加载到内存和显存中。128×128 的地形大约 16000 个顶点，还算能跑。但如果世界是 10000×10000 呢？一亿个顶点，显存直接爆掉。

Chunk 系统的核心思路：只加载玩家附近的地形块，远处的卸载或降精度。这就是 Minecraft 的基本原理——你看到的世界不是一次性生成的，而是随着你的移动逐步加载和卸载的。

## Chunk 的基本结构

```js
const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 64;
const RENDER_DISTANCE = 4;

class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.mesh = null;
    this.dirty = true;
  }

  getBlock(x, y, z) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return 0;
    return this.blocks[z * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + x];
  }

  setBlock(x, y, z, type) {
    this.blocks[z * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + x] = type;
    this.dirty = true;
  }
}
```

每个 Chunk 是一个 16×64×16 的体素块。`dirty` 标记表示需要重新生成网格。

## Chunk 管理器

管理器负责决定哪些 Chunk 需要加载，哪些需要卸载：

```js
class ChunkManager {
  constructor() {
    this.chunks = new Map();
  }

  key(cx, cz) {
    return `${cx},${cz}`;
  }

  update(playerX, playerZ) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    const needed = new Set();
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
        if (dx * dx + dz * dz > RENDER_DISTANCE * RENDER_DISTANCE) continue;
        needed.add(this.key(pcx + dx, pcz + dz));
      }
    }

    for (const key of needed) {
      if (!this.chunks.has(key)) {
        const [cx, cz] = key.split(',').map(Number);
        this.loadChunk(cx, cz);
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (!needed.has(key)) {
        this.unloadChunk(key, chunk);
      }
    }
  }

  loadChunk(cx, cz) {
    const chunk = new Chunk(cx, cz);
    this.generateTerrain(chunk);
    this.chunks.set(this.key(cx, cz), chunk);
    return chunk;
  }

  unloadChunk(key, chunk) {
    if (chunk.mesh) {
      chunk.mesh.geometry.dispose();
    }
    this.chunks.delete(key);
  }

  generateTerrain(chunk) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = chunk.cx * CHUNK_SIZE + x;
        const worldZ = chunk.cz * CHUNK_SIZE + z;

        const height = this.getHeight(worldX, worldZ);
        const h = Math.floor(height) + 32;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let type = 0;
          if (y === 0) type = 3;
          else if (y < h - 4) type = 2;
          else if (y < h) type = 1;
          else if (y <= 32) type = 0;

          chunk.setBlock(x, y, z, type);
        }
      }
    }
  }

  getHeight(x, z) {
    return Math.sin(x * 0.05) * Math.cos(z * 0.05) * 8 + Math.sin(x * 0.02 + z * 0.03) * 4;
  }
}
```

## LOD（Level of Detail）

远处的 Chunk 不需要和近处一样精细。LOD 的策略：

- 距离 0-1 个 Chunk：全精度
- 距离 2-3 个 Chunk：每 2 个格子合并为 1 个
- 距离 4+ 个 Chunk：每 4 个格子合并为 1 个

```js
function getLODLevel(cx, cz, playerCX, playerCZ) {
  const dist = Math.max(Math.abs(cx - playerCX), Math.abs(cz - playerCZ));
  if (dist <= 1) return 0;
  if (dist <= 3) return 1;
  return 2;
}
```

## 完整代码：可移动的无限地形

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 30);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;

const noise2D = createNoise2D();

function fbm(x, z, octaves = 4) {
  let value = 0, amplitude = 1, frequency = 1, maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxValue;
}

function getHeight(worldX, worldZ) {
  return fbm(worldX * 0.02, worldZ * 0.02) * 12;
}

const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 5;
const chunkMeshes = new Map();

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function getBiomeColor(h) {
  const c = new THREE.Color();
  if (h < 0) c.setHSL(0.58, 0.6, 0.25);
  else if (h < 3) c.setHSL(0.28, 0.55, 0.32);
  else if (h < 7) c.setHSL(0.22, 0.45, 0.38);
  else c.setHSL(0.1, 0.3, 0.55);
  return c;
}

function buildChunkMesh(cx, cz, lod) {
  const step = 1 << lod;
  const size = CHUNK_SIZE / step;
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, size, size);
  geo.rotateX(-Math.PI / 2);

  const colors = [];
  const posAttr = geo.attributes.position;

  for (let i = 0; i < posAttr.count; i++) {
    const lx = posAttr.getX(i) + CHUNK_SIZE / 2;
    const lz = posAttr.getZ(i) + CHUNK_SIZE / 2;

    const worldX = cx * CHUNK_SIZE + lx;
    const worldZ = cz * CHUNK_SIZE + lz;

    const h = getHeight(worldX, worldZ);
    posAttr.setY(i, h);

    const c = getBiomeColor(h);
    colors.push(c.r, c.g, c.b);
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx * CHUNK_SIZE + CHUNK_SIZE / 2, 0, cz * CHUNK_SIZE + CHUNK_SIZE / 2);
  return mesh;
}

function getLOD(cx, cz, pcx, pcz) {
  const dist = Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz));
  if (dist <= 1) return 0;
  if (dist <= 3) return 1;
  return 2;
}

function updateChunks() {
  const pcx = Math.floor(camera.position.x / CHUNK_SIZE);
  const pcz = Math.floor(camera.position.z / CHUNK_SIZE);

  const needed = new Set();

  for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      if (dx * dx + dz * dz > RENDER_DISTANCE * RENDER_DISTANCE) continue;
      const key = chunkKey(pcx + dx, pcz + dz);
      needed.add(key);

      if (!chunkMeshes.has(key)) {
        const lod = getLOD(pcx + dx, pcz + dz, pcx, pcz);
        const mesh = buildChunkMesh(pcx + dx, pcz + dz, lod);
        scene.add(mesh);
        chunkMeshes.set(key, { mesh, lod });
      }
    }
  }

  for (const [key, data] of chunkMeshes) {
    if (!needed.has(key)) {
      scene.remove(data.mesh);
      data.mesh.geometry.dispose();
      chunkMeshes.delete(key);
    }
  }
}

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
sun.position.set(30, 40, 20);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.25));

updateChunks();

const clock = new THREE.Clock();

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

运行后你可以用鼠标平移视角。随着视角移动，新的 Chunk 会在边缘加载，远处的 Chunk 会被卸载。世界没有边界——你可以一直移动下去。

## 性能关键点

- **不要每帧都检查**：用 `playerChunkChanged` 标记，只在玩家跨越 Chunk 边界时更新
- **异步生成**：Chunk 的地形计算放到 Web Worker 中，避免阻塞主线程
- **网格复用**：卸载的 Chunk 网格放入对象池，重新加载时复用

## 练习

1. 把 `RENDER_DISTANCE` 从 5 改成 8，观察加载的 Chunk 数量变化和帧率影响。
2. 给 LOD 切换添加平滑过渡——用透明度淡入淡出代替突然出现/消失。
3. 在 Chunk 边界处检查相邻 Chunk 的数据，避免地形出现裂缝。

## 参考答案

### 练习 1
RENDER_DISTANCE=5 时大约加载 78 个 Chunk（π×5²），改成 8 后大约 201 个。如果每个 Chunk 有 256 个面片，帧率会明显下降。这就是为什么需要 LOD。

### 练习 2
新建 Chunk 时先设置 `mesh.material.opacity = 0; mesh.material.transparent = true;`，然后在 animate 中逐步增加到 1。卸载时反向操作。

### 练习 3
在 buildChunkMesh 中，对于边缘的顶点，采样相邻 Chunk 的高度值来设置 Y 坐标。这需要相邻 Chunk 已经生成好，或者先生成高度数据再建网格。
