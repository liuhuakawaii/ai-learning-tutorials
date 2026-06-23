# 种子系统——确定性生成、种子分享

## 同一个世界，不同的机器

上节课实现了无限地形，但有一个问题：每次刷新页面，世界都不一样。这在单人游戏中无所谓，但如果两个玩家想进入同一个世界呢？或者玩家想回到上次去过的某个地方？

种子（Seed）系统解决这个问题：给随机数生成器一个固定的起点，之后的所有随机数序列都是确定的。同样的种子 + 同样的坐标 = 同样的地形。

## 伪随机数生成器

JavaScript 的 `Math.random()` 不能设置种子。我们需要自己实现一个可播种的 PRNG：

```js
class SeededRandom {
  constructor(seed) {
    this.state = seed;
  }

  next() {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff;
    return (this.state >>> 0) / 0xffffffff;
  }

  nextRange(min, max) {
    return min + this.next() * (max - min);
  }

  nextInt(min, max) {
    return Math.floor(this.nextRange(min, max));
  }
}
```

这是线性同余生成器（LCG），简单但足够用于程序化生成。Minecraft 用的是类似的思路。

## 种子如何传播到噪声

噪声库（如 `simplex-noise`）也接受种子。但更通用的做法是：用种子生成一组偏移量，加到噪声的输入坐标上。

```js
function seededNoise(noise2D, seed, x, z) {
  const rng = new SeededRandom(seed);
  const offsetX = rng.nextRange(-10000, 10000);
  const offsetZ = rng.nextRange(-10000, 10000);
  return noise2D(x + offsetX, z + offsetZ);
}
```

这样同一个种子总是产生同样的偏移量，噪声输出就是确定的。

## 哈希函数：从坐标到种子

对于 Chunk 系统，每个 Chunk 的种子需要从全局种子和 Chunk 坐标推导出来：

```js
function chunkSeed(globalSeed, cx, cz) {
  let hash = globalSeed;
  hash = (hash * 31 + cx) & 0xffffffff;
  hash = (hash * 31 + cz) & 0xffffffff;
  return hash;
}
```

这个哈希函数保证：
- 同一个全局种子 + 同一个坐标 = 同一个结果
- 不同坐标产生不同的种子
- 相邻坐标的种子差异很大（避免相似地形）

## 完整代码：种子可控的世界

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

class SeededRandom {
  constructor(seed) {
    this.state = seed | 0;
  }
  next() {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff;
    return (this.state >>> 0) / 0xffffffff;
  }
  nextRange(min, max) { return min + this.next() * (max - min); }
}

function chunkSeed(globalSeed, cx, cz) {
  let hash = globalSeed | 0;
  hash = (Math.imul(hash, 31) + cx) | 0;
  hash = (Math.imul(hash, 31) + cz) | 0;
  return hash;
}

function valueNoise(seed, x, z) {
  const rng = new SeededRandom(seed);
  const ox = rng.nextRange(-10000, 10000);
  const oz = rng.nextRange(-10000, 10000);

  const px = x + ox, pz = z + oz;
  const ix = Math.floor(px), iz = Math.floor(pz);
  const fx = px - ix, fz = pz - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);

  function hash2d(x, z) {
    const r = new SeededRandom(x * 374761393 + z * 668265263 + seed);
    return r.next();
  }

  const v00 = hash2d(ix, iz);
  const v10 = hash2d(ix + 1, iz);
  const v01 = hash2d(ix, iz + 1);
  const v11 = hash2d(ix + 1, iz + 1);

  return (v00 * (1 - sx) + v10 * sx) * (1 - sz) + (v01 * (1 - sx) + v11 * sx) * sz;
}

function fbm(seed, x, z, octaves = 4) {
  let value = 0, amplitude = 1, frequency = 1, maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    const s = chunkSeed(seed, i * 1000, 0);
    value += valueNoise(s, x * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxValue;
}

function getHeight(seed, worldX, worldZ) {
  return fbm(seed, worldX * 0.02, worldZ * 0.02) * 15 - 5;
}

let globalSeed = 42;

const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 5;
const chunkMeshes = new Map();

function chunkKey(cx, cz) { return `${cx},${cz}`; }

function buildChunkMesh(seed, cx, cz) {
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE);
  geo.rotateX(-Math.PI / 2);

  const colors = [];
  const posAttr = geo.attributes.position;

  for (let i = 0; i < posAttr.count; i++) {
    const lx = posAttr.getX(i) + CHUNK_SIZE / 2;
    const lz = posAttr.getZ(i) + CHUNK_SIZE / 2;
    const wx = cx * CHUNK_SIZE + lx;
    const wz = cz * CHUNK_SIZE + lz;

    const h = getHeight(seed, wx, wz);
    posAttr.setY(i, h);

    const c = new THREE.Color();
    if (h < 0) c.setHSL(0.58, 0.6, 0.25);
    else if (h < 3) c.setHSL(0.28, 0.55, 0.32);
    else if (h < 7) c.setHSL(0.22, 0.45, 0.38);
    else c.setHSL(0.1, 0.3, 0.55);
    colors.push(c.r, c.g, c.b);
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }));
  mesh.position.set(cx * CHUNK_SIZE + CHUNK_SIZE / 2, 0, cz * CHUNK_SIZE + CHUNK_SIZE / 2);
  return mesh;
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
        const mesh = buildChunkMesh(globalSeed, pcx + dx, pcz + dz);
        scene.add(mesh);
        chunkMeshes.set(key, mesh);
      }
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

function rebuildAllChunks() {
  for (const [key, mesh] of chunkMeshes) {
    scene.remove(mesh);
    mesh.geometry.dispose();
  }
  chunkMeshes.clear();
  updateChunks();
}

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
sun.position.set(30, 40, 20);
scene.add(sun);

updateChunks();

const infoEl = document.createElement('div');
infoEl.style.cssText = 'position:fixed;top:10px;left:10px;color:white;font-family:monospace;background:rgba(0,0,0,0.6);padding:10px;border-radius:4px;';
infoEl.innerHTML = `种子: ${globalSeed}<br>按 R 随机种子<br>按 1-9 设置种子`;
document.body.appendChild(infoEl);

document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    globalSeed = Math.floor(Math.random() * 2147483647);
    rebuildAllChunks();
    infoEl.innerHTML = `种子: ${globalSeed}<br>按 R 随机种子<br>按 1-9 设置种子`;
  }
  if (e.key >= '1' && e.key <= '9') {
    globalSeed = parseInt(e.key) * 111111111;
    rebuildAllChunks();
    infoEl.innerHTML = `种子: ${globalSeed}<br>按 R 随机种子<br>按 1-9 设置种子`;
  }
});

function animate() {
  requestAnimationFrame(animate);
  updateChunks();
  controls.update();
  renderer.render(scene, camera);
}
animate();
```

运行后按 R 随机切换种子，按 1-9 选择固定种子。每次切换种子，整个世界会重新生成。同一个种子在任何时候都会生成完全相同的世界。

## 种子的分享

种子可以是任何 32 位整数。实际项目中可以把种子编码成更容易分享的格式：

```js
function seedToString(seed) {
  return seed.toString(36).toUpperCase();
}

function stringToSeed(str) {
  return parseInt(str, 36);
}
```

玩家只需要分享一个短字符串，就能进入同一个世界。

## 确定性的保证

要保证确定性，必须注意：
- 所有随机数都通过 SeededRandom 生成
- 不使用 `Math.random()`、`Date.now()` 等不确定源
- 浮点运算在不同平台上可能有微小差异——对程序化生成通常可以接受

## 练习

1. 实现一个种子输入框，让玩家手动输入种子字符串。
2. 在 Chunk 坐标之外再加入 Y 坐标到种子计算中，让同一水平面上不同高度的洞穴有不同结构。
3. 用种子生成 Biome 映射——同一个种子的 Biome 分布必须完全一致。

## 参考答案

### 练习 1
在 infoEl 中加一个 `<input>` 元素，监听 change 事件，把输入的字符串通过 `stringToSeed` 转换为种子值，然后调用 `rebuildAllChunks()`。

### 练习 2
在 `chunkSeed` 中加入 Y 参数：`hash = (Math.imul(hash, 31) + cy) | 0;`。这样不同高度层的噪声偏移不同，洞穴结构在垂直方向上有变化。

### 练习 3
Biome 的温度和湿度噪声也需要用种子来生成偏移量。确保 `seededNoise` 函数在所有噪声计算中统一使用。
