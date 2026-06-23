# 世界种子编辑——参数化控制、预览系统

## 不只是随机一个数

前面的课程用一个整数作为种子来控制世界生成。但一个数字能表达的信息太少了——玩家想要"一个有很多山的世界"或"一个海洋面积大的世界"，光靠种子数字做不到。

这节课要做两件事：
1. 把世界生成参数化——地形高度、海洋比例、Biome 分布都可以独立调节
2. 做一个预览系统——在进入世界之前，先看到缩略图

## 参数化世界生成

```js
const defaultParams = {
  seed: 42,
  terrainScale: 4.0,
  terrainHeight: 15,
  seaLevel: 0.3,
  mountainThreshold: 0.6,
  erosionStrength: 0.5,
  biomeBlend: 0.5,
  vegetationDensity: 0.6,
};

function generateWithParams(params, x, z) {
  const rng = new SeededRandom(params.seed);
  const ox = rng.nextRange(-10000, 10000);
  const oz = rng.nextRange(-10000, 10000);

  let h = fbm(params.seed, (x + ox) * 0.02 * params.terrainScale, (z + oz) * 0.02 * params.terrainScale);
  h = (h - params.seaLevel) * params.terrainHeight;

  if (h > params.mountainThreshold * params.terrainHeight) {
    h = params.mountainThreshold * params.terrainHeight + (h - params.mountainThreshold * params.terrainHeight) * 1.5;
  }

  return h;
}
```

## 预览系统

在进入世界之前，生成一张小分辨率的缩略图。128×128 的高度图只需要几毫秒，可以实时预览。

```js
function generatePreview(params, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(size, size);

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const h = generateWithParams(params, x - size / 2, z - size / 2);
      const idx = (z * size + x) * 4;

      let r, g, b;
      if (h < 0) {
        const t = Math.max(0, 1 + h / 5);
        r = 30 + t * 10;
        g = 80 + t * 20;
        b = 140 + t * 30;
      } else if (h < params.terrainHeight * 0.3) {
        r = 80;
        g = 140;
        b = 50;
      } else if (h < params.terrainHeight * 0.6) {
        r = 120;
        g = 100;
        b = 60;
      } else {
        const t = Math.min(1, (h - params.terrainHeight * 0.6) / (params.terrainHeight * 0.4));
        r = 180 + t * 50;
        g = 170 + t * 50;
        b = 160 + t * 60;
      }

      imageData.data[idx] = r;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
```

## 完整代码：带 UI 的种子编辑器

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let params = {
  seed: 42,
  terrainScale: 4.0,
  terrainHeight: 15,
  seaLevel: 0.3,
  vegetationDensity: 0.6,
};

let scene, camera, renderer, controls;

function createUI() {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed; top: 10px; left: 10px; width: 280px;
    background: rgba(0,0,0,0.75); color: white; padding: 15px;
    font-family: monospace; border-radius: 8px; z-index: 100;
  `;

  panel.innerHTML = `
    <h3 style="margin:0 0 10px 0;">世界编辑器</h3>

    <label>种子: <span id="seedVal">${params.seed}</span></label><br>
    <input type="range" id="seed" min="1" max="999999" value="${params.seed}" style="width:100%">

    <label>地形缩放: <span id="scaleVal">${params.terrainScale}</span></label><br>
    <input type="range" id="scale" min="1" max="10" step="0.1" value="${params.terrainScale}" style="width:100%">

    <label>地形高度: <span id="heightVal">${params.terrainHeight}</span></label><br>
    <input type="range" id="height" min="5" max="30" step="0.5" value="${params.terrainHeight}" style="width:100%">

    <label>海平面: <span id="seaVal">${params.seaLevel}</span></label><br>
    <input type="range" id="sea" min="0" max="0.8" step="0.05" value="${params.seaLevel}" style="width:100%">

    <label>植被密度: <span id="vegVal">${params.vegetationDensity}</span></label><br>
    <input type="range" id="veg" min="0" max="1" step="0.05" value="${params.vegetationDensity}" style="width:100%">

    <div style="margin-top:10px;text-align:center;">
      <canvas id="preview" width="128" height="128" style="border:1px solid #555;border-radius:4px;"></canvas>
    </div>

    <button id="randomSeed" style="margin-top:8px;width:100%;padding:6px;">随机种子</button>
    <button id="enterWorld" style="margin-top:4px;width:100%;padding:8px;background:#4a9;color:white;border:none;border-radius:4px;cursor:pointer;">进入世界</button>
  `;

  document.body.appendChild(panel);

  const sliders = ['seed', 'scale', 'height', 'sea', 'veg'];
  const keys = ['seed', 'terrainScale', 'terrainHeight', 'seaLevel', 'vegetationDensity'];
  const valIds = ['seedVal', 'scaleVal', 'heightVal', 'seaVal', 'vegVal'];

  sliders.forEach((id, i) => {
    const slider = panel.querySelector(`#${id}`);
    const valEl = panel.querySelector(`#${valIds[i]}`);

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      params[keys[i]] = val;
      valEl.textContent = val;
      updatePreview();
    });
  });

  panel.querySelector('#randomSeed').addEventListener('click', () => {
    params.seed = Math.floor(Math.random() * 999999) + 1;
    panel.querySelector('#seed').value = params.seed;
    panel.querySelector('#seedVal').textContent = params.seed;
    updatePreview();
  });

  panel.querySelector('#enterWorld').addEventListener('click', () => {
    panel.style.display = 'none';
    initWorld();
  });

  updatePreview();
}

function updatePreview() {
  const canvas = document.getElementById('preview');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 128;
  const imageData = ctx.createImageData(size, size);

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const h = generateHeight(params.seed, (x - 64) * 0.5, (z - 64) * 0.5);
      const idx = (z * size + x) * 4;

      let r, g, b;
      if (h < params.seaLevel * params.terrainHeight - params.terrainHeight) {
        r = 30; g = 80; b = 140;
      } else if (h < 0) {
        r = 80; g = 140; b = 50;
      } else if (h < params.terrainHeight * 0.4) {
        r = 110; g = 130; b = 60;
      } else {
        const t = Math.min(1, h / params.terrainHeight);
        r = 160 + t * 60; g = 150 + t * 60; b = 140 + t * 70;
      }

      imageData.data[idx] = r;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

class SeededRandom {
  constructor(seed) { this.state = seed | 0; }
  next() {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff;
    return (this.state >>> 0) / 0xffffffff;
  }
}

function valueNoise(seed, x, z) {
  function hash(n) {
    n = (n << 13) ^ n;
    return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff;
  }
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  return (hash(ix*374761393+iz*668265263+seed)*(1-sx) + hash((ix+1)*374761393+iz*668265263+seed)*sx) * (1-sz) +
         (hash(ix*374761393+(iz+1)*668265263+seed)*(1-sx) + hash((ix+1)*374761393+(iz+1)*668265263+seed)*sx) * sz;
}

function fbm(seed, x, z) {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < 4; i++) {
    v += valueNoise(seed + i * 1000, x * f, z * f) * a;
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

function generateHeight(seed, x, z) {
  const rng = new SeededRandom(seed);
  const ox = rng.nextRange(-10000, 10000);
  const oz = rng.nextRange(-10000, 10000);
  return fbm(seed, (x + ox) * 0.02 * params.terrainScale, (z + oz) * 0.02 * params.terrainScale) * params.terrainHeight - params.terrainHeight * 0.3;
}

function initWorld() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.007);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 25, 35);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const CHUNK_SIZE = 16;
  const RENDER_DISTANCE = 4;
  const chunkMeshes = new Map();

  function buildChunk(cx, cz) {
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE);
    geo.rotateX(-Math.PI / 2);
    const colors = [];
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i) + CHUNK_SIZE / 2;
      const lz = pos.getZ(i) + CHUNK_SIZE / 2;
      const h = generateHeight(params.seed, cx * CHUNK_SIZE + lx, cz * CHUNK_SIZE + lz);
      pos.setY(i, h);

      const c = new THREE.Color();
      if (h < 0) c.setHSL(0.58, 0.6, 0.25);
      else if (h < params.terrainHeight * 0.3) c.setHSL(0.28, 0.55, 0.32);
      else if (h < params.terrainHeight * 0.6) c.setHSL(0.22, 0.45, 0.38);
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
        if (dx*dx + dz*dz > RENDER_DISTANCE*RENDER_DISTANCE) continue;
        const key = `${pcx+dx},${pcz+dz}`;
        needed.add(key);
        if (!chunkMeshes.has(key)) {
          const mesh = buildChunk(pcx+dx, pcz+dz);
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

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  scene.add(new THREE.DirectionalLight(0xffeedd, 1.0).copy(Object.assign(new THREE.DirectionalLight(), { position: new THREE.Vector3(30,40,20) })));

  function animate() {
    requestAnimationFrame(animate);
    updateChunks();
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

createUI();
```

运行后你会看到一个左侧面板，可以调节种子、地形缩放、高度、海平面、植被密度。面板下方有一个实时预览图，显示当前参数下世界的缩略图。点击"进入世界"后进入 3D 探索模式。

## 预设参数

可以提供几个有趣的预设：

```js
const presets = {
  '群岛': { seed: 12345, terrainScale: 6, seaLevel: 0.5, terrainHeight: 10 },
  '大陆': { seed: 67890, terrainScale: 2, seaLevel: 0.2, terrainHeight: 20 },
  '高原': { seed: 11111, terrainScale: 3, seaLevel: 0.1, terrainHeight: 25 },
  '平原': { seed: 22222, terrainScale: 5, seaLevel: 0.25, terrainHeight: 8 },
};
```

## 练习

1. 添加"保存"和"加载"功能——把当前参数存到 localStorage，下次打开时恢复。
2. 添加一个"分享"按钮——把参数编码成 URL 查询字符串。
3. 在预览图上添加 Biome 颜色——根据温度和湿度映射不同颜色。

## 参考答案

### 练习 1
用 `localStorage.setItem('worldParams', JSON.stringify(params))` 保存，页面加载时 `JSON.parse(localStorage.getItem('worldParams'))` 恢复。

### 练习 2
用 `btoa(JSON.stringify(params))` 编码参数为 Base64 字符串，拼到 URL 后面。页面加载时检查 URL 参数并解码。

### 练习 3
在预览生成中增加温度和湿度计算，用 Whittaker 图的颜色映射替代简单的高度颜色。
