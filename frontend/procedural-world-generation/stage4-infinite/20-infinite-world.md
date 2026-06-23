# 阶段实战：实现一个无限可探索的世界

## 整合第四阶段的全部内容

这节课把 Chunk 系统、种子系统、异步生成、参数化编辑全部整合，实现一个真正的无限可探索世界。玩家可以在其中自由移动，世界在玩家周围持续加载和生成。

这是课程中最重要的里程碑——从"一个固定场景"跨越到"一个无限世界"。

## 项目结构

```
stage4-infinite/
├── index.html
├── main.js
├── worker.js
└── ui.js
```

## worker.js——地形生成 Worker

```js
function hash(n) {
  n = (n << 13) ^ n;
  return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff;
}

function valueNoise(seed, x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const v00 = hash(ix * 374761 + iz * 668265 + seed);
  const v10 = hash((ix + 1) * 374761 + iz * 668265 + seed);
  const v01 = hash(ix * 374761 + (iz + 1) * 668265 + seed);
  const v11 = hash((ix + 1) * 374761 + (iz + 1) * 668265 + seed);
  return (v00 * (1 - sx) + v10 * sx) * (1 - sz) + (v01 * (1 - sx) + v11 * sx) * sz;
}

function fbm(seed, x, z, octaves) {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise(seed + i * 1000, x * f, z * f) * a;
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

function getHeight(seed, wx, wz, scale, height) {
  return fbm(seed, wx * 0.02 * scale, wz * 0.02 * scale, 5) * height - height * 0.3;
}

self.onmessage = function (e) {
  const { cx, cz, chunkSize, seed, scale, height, biomeParams } = e.data;
  const heightMap = new Float32Array(chunkSize * chunkSize);
  const biomeMap = new Uint8Array(chunkSize * chunkSize);

  for (let z = 0; z < chunkSize; z++) {
    for (let x = 0; x < chunkSize; x++) {
      const wx = cx * chunkSize + x;
      const wz = cz * chunkSize + z;
      const h = getHeight(seed, wx, wz, scale, height);
      heightMap[z * chunkSize + x] = h;

      const temp = fbm(seed + 5000, wx * 0.01, wz * 0.01, 3);
      const moisture = fbm(seed + 9000, wx * 0.012, wz * 0.012, 3);

      let biome = 0;
      if (h < 0) biome = 0;
      else if (temp < 0.3) biome = 1;
      else if (moisture < 0.35) biome = 2;
      else if (moisture < 0.6) biome = 3;
      else biome = 4;

      biomeMap[z * chunkSize + x] = biome;
    }
  }

  self.postMessage({ cx, cz, heightMap, biomeMap }, [heightMap.buffer, biomeMap.buffer]);
};
```

## ui.js——参数面板

```js
export function createParamUI(onChange) {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position:fixed;top:10px;left:10px;width:240px;
    background:rgba(0,0,0,0.7);color:white;padding:12px;
    font-family:monospace;font-size:12px;border-radius:8px;z-index:100;
  `;

  const params = {
    seed: 42, terrainScale: 4, terrainHeight: 15,
    seaLevel: 0.3, renderDistance: 5,
  };

  const sliders = [
    { key: 'seed', label: '种子', min: 1, max: 999999, step: 1 },
    { key: 'terrainScale', label: '地形缩放', min: 1, max: 10, step: 0.1 },
    { key: 'terrainHeight', label: '地形高度', min: 5, max: 30, step: 0.5 },
    { key: 'seaLevel', label: '海平面', min: 0, max: 0.8, step: 0.05 },
    { key: 'renderDistance', label: '视距', min: 3, max: 10, step: 1 },
  ];

  panel.innerHTML = `<h3 style="margin:0 0 8px 0">无限世界</h3>`;

  for (const s of sliders) {
    const row = document.createElement('div');
    row.style.marginBottom = '6px';
    row.innerHTML = `
      <div>${s.label}: <span id="v_${s.key}">${params[s.key]}</span></div>
      <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${params[s.key]}" style="width:100%">
    `;
    const input = row.querySelector('input');
    const valEl = row.querySelector('span');
    input.addEventListener('input', () => {
      params[s.key] = parseFloat(input.value);
      valEl.textContent = params[s.key];
      onChange(params);
    });
    panel.appendChild(row);
  }

  const randomBtn = document.createElement('button');
  randomBtn.textContent = '随机种子';
  randomBtn.style.cssText = 'width:100%;padding:5px;margin-top:6px;cursor:pointer;';
  randomBtn.onclick = () => {
    params.seed = Math.floor(Math.random() * 999999) + 1;
    panel.querySelector('input').value = params.seed;
    panel.querySelector('[id^="v_seed"]').textContent = params.seed;
    onChange(params);
  };
  panel.appendChild(randomBtn);

  document.body.appendChild(panel);
  return params;
}
```

## main.js——完整无限世界

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createParamUI } from './ui.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.006);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 25, 35);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.1;

const CHUNK_SIZE = 16;
const chunkMeshes = new Map();
const pendingChunks = new Set();

let params = { seed: 42, terrainScale: 4, terrainHeight: 15, seaLevel: 0.3, renderDistance: 5 };

function createWorker() {
  const code = `
    function hash(n){n=(n<<13)^n;return((n*(n*n*15731+789221)+1376312589)&0x7fffffff)/0x7fffffff;}
    function vn(s,x,z){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);
    return(hash(ix*374761+iz*668265+s)*(1-sx)+hash((ix+1)*374761+iz*668265+s)*sx)*(1-sz)+
    (hash(ix*374761+(iz+1)*668265+s)*(1-sx)+hash((ix+1)*374761+(iz+1)*668265+s)*sx)*sz;}
    function fbm(s,x,z,o){let v=0,a=1,f=1,m=0;for(let i=0;i<o;i++){v+=vn(s+i*1000,x*f,z*f)*a;m+=a;a*=0.5;f*=2;}return v/m;}
    self.onmessage=function(e){
      const{cx,cz,chunkSize,seed,scale,height}=e.data;
      const hm=new Float32Array(chunkSize*chunkSize);
      const bm=new Uint8Array(chunkSize*chunkSize);
      for(let z=0;z<chunkSize;z++)for(let x=0;x<chunkSize;x++){
        const wx=cx*chunkSize+x,wz=cz*chunkSize+z;
        const h=fbm(seed,wx*0.02*scale,wz*0.02*scale,5)*height-height*0.3;
        hm[z*chunkSize+x]=h;
        const t=fbm(seed+5000,wx*0.01,wz*0.01,3);
        const m=fbm(seed+9000,wx*0.012,wz*0.012,3);
        let b=0;if(h<0)b=0;else if(t<0.3)b=1;else if(m<0.35)b=2;else if(m<0.6)b=3;else b=4;
        bm[z*chunkSize+x]=b;
      }
      self.postMessage({cx,cz,heightMap:hm,biomeMap:bm},[hm.buffer,bm.buffer]);
    };
  `;
  const blob = new Blob([code], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

const workers = [createWorker(), createWorker()];
const pendingQueue = [];

function chunkKey(cx, cz) { return `${cx},${cz}`; }

const BIOME_COLORS = [
  [0.58, 0.6, 0.25],
  [0.68, 0.7, 0.66],
  [0.76, 0.7, 0.5],
  [0.28, 0.55, 0.32],
  [0.15, 0.4, 0.15],
];

function buildChunkMesh(cx, cz, heightMap, biomeMap) {
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE);
  geo.rotateX(-Math.PI / 2);
  const colors = [];
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const h = heightMap[i];
    pos.setY(i, h);

    const bc = BIOME_COLORS[biomeMap[i]];
    const shadow = 0.65 + Math.min(h / 20, 0.35);
    const c = new THREE.Color(bc[0] * shadow, bc[1] * shadow, bc[2] * shadow);
    colors.push(c.r, c.g, c.b);
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, transparent: true, opacity: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx * CHUNK_SIZE + CHUNK_SIZE / 2, 0, cz * CHUNK_SIZE + CHUNK_SIZE / 2);

  const start = performance.now();
  function fadeIn() {
    const t = Math.min((performance.now() - start) / 300, 1);
    mat.opacity = t;
    if (t < 1) requestAnimationFrame(fadeIn);
    else mat.transparent = false;
  }
  fadeIn();

  return mesh;
}

function requestChunk(cx, cz) {
  const key = chunkKey(cx, cz);
  if (chunkMeshes.has(key) || pendingChunks.has(key)) return;
  pendingChunks.add(key);

  const dist = Math.hypot(cx - Math.floor(camera.position.x / CHUNK_SIZE), cz - Math.floor(camera.position.z / CHUNK_SIZE));
  pendingQueue.push({ cx, cz, dist, key });
  pendingQueue.sort((a, b) => a.dist - b.dist);
  processQueue();
}

function processQueue() {
  const idle = workers.find(w => !w.busy);
  if (!idle || pendingQueue.length === 0) return;

  const job = pendingQueue.shift();
  idle.busy = true;

  idle.onmessage = (e) => {
    idle.busy = false;
    pendingChunks.delete(job.key);

    if (!chunkMeshes.has(job.key)) {
      const mesh = buildChunkMesh(e.data.cx, e.data.cz, e.data.heightMap, e.data.biomeMap);
      scene.add(mesh);
      chunkMeshes.set(job.key, mesh);
    }
    processQueue();
  };

  idle.postMessage({
    cx: job.cx, cz: job.cz,
    chunkSize: CHUNK_SIZE, seed: params.seed,
    scale: params.terrainScale, height: params.terrainHeight,
  });
}

function updateChunks() {
  const pcx = Math.floor(camera.position.x / CHUNK_SIZE);
  const pcz = Math.floor(camera.position.z / CHUNK_SIZE);
  const rd = params.renderDistance;
  const needed = new Set();

  for (let dz = -rd; dz <= rd; dz++) {
    for (let dx = -rd; dx <= rd; dx++) {
      if (dx * dx + dz * dz > rd * rd) continue;
      const key = chunkKey(pcx + dx, pcz + dz);
      needed.add(key);
      requestChunk(pcx + dx, pcz + dz);
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

function rebuildWorld() {
  for (const [key, mesh] of chunkMeshes) {
    scene.remove(mesh);
    mesh.geometry.dispose();
  }
  chunkMeshes.clear();
  pendingChunks.clear();
  pendingQueue.length = 0;
  updateChunks();
}

const waterGeo = new THREE.PlaneGeometry(200, 200, 1, 1);
waterGeo.rotateX(-Math.PI / 2);
const waterMat = new THREE.MeshStandardMaterial({
  color: 0x1a6e8a, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.2,
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.position.y = 0;
scene.add(water);

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
sun.position.set(30, 40, 20);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.25));

params = createParamUI((newParams) => {
  Object.assign(params, newParams);
  rebuildWorld();
});

updateChunks();

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  water.position.y = Math.sin(t * 0.3) * 0.05;
  water.position.x = Math.floor(camera.position.x / CHUNK_SIZE) * CHUNK_SIZE + CHUNK_SIZE / 2;
  water.position.z = Math.floor(camera.position.z / CHUNK_SIZE) * CHUNK_SIZE + CHUNK_SIZE / 2;
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

## index.html

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>无限程序化世界</title>
  <style>
    * { margin: 0; padding: 0; }
    body { overflow: hidden; }
    #info {
      position: fixed; bottom: 15px; left: 50%; transform: translateX(-50%);
      color: white; font-family: monospace; font-size: 12px;
      background: rgba(0,0,0,0.5); padding: 6px 14px; border-radius: 4px;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="info">WASD/鼠标移动 | 世界无限生成 | 左侧面板调节参数</div>
  <script type="module" src="main.js"></script>
</body>
</html>
```

## 运行效果

打开页面后你会看到：
- 左侧面板可以调节种子、地形参数
- 世界在玩家周围无限生成
- 新的 Chunk 平滑淡入
- 不同 Biome 有不同颜色
- 海洋区域有半透明水面
- 雾效让远处逐渐模糊

平移视角到很远的地方，世界会持续生成。切换种子，整个世界会重新生成。

## 第四阶段回顾

现在我们有了一个真正的无限世界：
1. **Chunk 系统** → 只加载玩家附近的地形
2. **种子系统** → 确定性生成，可分享
3. **异步生成** → Worker 线程，不阻塞渲染
4. **参数化编辑** → 可调节的世界生成参数
5. **平滑过渡** → Chunk 淡入淡出

第五阶段会关注渲染质量——体素渲染、地形纹理、植被动画、玩家交互。
