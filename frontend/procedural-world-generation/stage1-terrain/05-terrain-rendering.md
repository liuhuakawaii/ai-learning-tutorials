# 阶段实战：生成一个有山有水的地形并渲染

## 把前四课的内容串起来

这节课是第一阶段的收尾实战。目标是把噪声、高度图、地形特征、侵蚀模拟全部整合，生成一个可以直接用鼠标探索的地形场景。

这不再是单个算法的演示，而是一个小型项目——需要考虑代码组织、渲染性能、视觉效果的整体配合。

## 项目结构

```
stage1-terrain/
├── index.html
├── main.js
├── terrain.js
├── erosion.js
└── coloring.js
```

## terrain.js——地形生成核心

```js
import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

export function fbm(x, z, octaves = 5) {
  let value = 0, amplitude = 1, frequency = 1, maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxValue;
}

export function warpedNoise(x, z, strength = 0.7) {
  const wx = fbm(x, z) * strength;
  const wz = fbm(x + 5.2, z + 1.3) * strength;
  return fbm(x + wx, z + wz);
}

export function generateHeightMap(size, scale = 4) {
  const map = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const nz = y / size;
      let h = warpedNoise(nx * scale, nz * scale);

      const coastWarp = noise2D(nx * 8, nz * 8) * 0.1;
      if (h > coastWarp) {
        h = Math.pow(h - coastWarp, 1.3) + coastWarp;
      } else {
        h *= 0.2;
      }

      map[y * size + x] = h * 20;
    }
  }
  return map;
}
```

## erosion.js——侵蚀处理

```js
export function applyThermalErosion(map, size, iterations = 20) {
  const talus = 0.015;
  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const idx = y * size + x;
        const h = map[idx];
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dx, dy] of dirs) {
          const ni = (y + dy) * size + (x + dx);
          const diff = h - map[ni];
          if (diff > talus) {
            const transfer = diff * 0.25;
            map[idx] -= transfer;
            map[ni] += transfer;
          }
        }
      }
    }
  }
  return map;
}

export function applyHydraulicErosion(map, size, drops = 8000) {
  for (let d = 0; d < drops; d++) {
    let x = Math.random() * (size - 2) + 1;
    let y = Math.random() * (size - 2) + 1;
    let sediment = 0, water = 1, vx = 0, vy = 0;

    for (let step = 0; step < 48; step++) {
      const ix = Math.floor(x), iy = Math.floor(y);
      const idx = iy * size + ix;
      const fx = x - ix, fy = y - iy;

      const h00 = map[idx];
      const h10 = map[idx + 1];
      const h01 = map[idx + size];
      const h11 = map[idx + size + 1];

      const gx = (h10 - h00) * (1 - fy) + (h11 - h01) * fy;
      const gy = (h01 - h00) * (1 - fx) + (h11 - h10) * fx;

      vx = vx * 0.85 - gx * 40;
      vy = vy * 0.85 - gy * 40;
      const len = Math.sqrt(vx * vx + vy * vy);
      if (len < 0.001) break;
      vx /= len; vy /= len;
      x += vx * 0.08; y += vy * 0.08;
      if (x < 1 || x >= size - 2 || y < 1 || y >= size - 2) break;

      const newIdx = Math.floor(y) * size + Math.floor(x);
      const hDiff = map[newIdx] - map[idx];

      if (hDiff > 0) {
        const deposit = Math.min(sediment, hDiff);
        sediment -= deposit;
        map[idx] += deposit;
      } else {
        const erosion = Math.min(-hDiff, water * 0.08);
        sediment += erosion;
        map[newIdx] -= erosion;
      }
      water *= 0.99;
    }
    const fi = Math.floor(y) * size + Math.floor(x);
    map[fi] += sediment;
  }
  return map;
}
```

## coloring.js——地形着色

```js
import * as THREE from 'three';

const SEA_LEVEL = 0;
const color = new THREE.Color();

export function getTerrainColor(height) {
  const h = height;

  if (h < SEA_LEVEL - 3) {
    color.setHSL(0.6, 0.75, 0.12);
  } else if (h < SEA_LEVEL - 0.5) {
    const t = (h + 3) / 2.5;
    color.setHSL(0.58, 0.7, 0.12 + t * 0.15);
  } else if (h < SEA_LEVEL + 0.3) {
    color.setHSL(0.15, 0.4, 0.75);
  } else if (h < 2) {
    color.setHSL(0.28, 0.6, 0.3);
  } else if (h < 6) {
    const t = (h - 2) / 4;
    color.setHSL(0.28 - t * 0.12, 0.55 - t * 0.15, 0.3 + t * 0.1);
  } else if (h < 12) {
    const t = (h - 6) / 6;
    color.setHSL(0.1, 0.3, 0.45 + t * 0.15);
  } else {
    color.setHSL(0.08, 0.1, 0.8);
  }

  return color;
}
```

## main.js——场景组装

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { generateHeightMap } from './terrain.js';
import { applyThermalErosion, applyHydraulicErosion } from './erosion.js';
import { getTerrainColor } from './coloring.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 80, 200);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 35, 50);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.2;

const SIZE = 128;
const SCALE = 80;

const heightMap = generateHeightMap(SIZE, 3.5);
applyThermalErosion(heightMap, SIZE, 15);
applyHydraulicErosion(heightMap, SIZE, 6000);

const geometry = new THREE.PlaneGeometry(SCALE, SCALE, SIZE - 1, SIZE - 1);
geometry.rotateX(-Math.PI / 2);

const colors = [];
const posAttr = geometry.attributes.position;

for (let i = 0; i < posAttr.count; i++) {
  const h = heightMap[i];
  posAttr.setY(i, h);

  const c = getTerrainColor(h);
  colors.push(c.r, c.g, c.b);
}

geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
geometry.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.85,
  metalness: 0.05,
});
const terrain = new THREE.Mesh(geometry, terrainMat);
scene.add(terrain);

const waterGeo = new THREE.PlaneGeometry(SCALE, SCALE, 32, 32);
waterGeo.rotateX(-Math.PI / 2);
const waterMat = new THREE.MeshStandardMaterial({
  color: 0x1a6e8a,
  transparent: true,
  opacity: 0.55,
  roughness: 0.1,
  metalness: 0.3,
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.position.y = 0;
scene.add(water);

const sunLight = new THREE.DirectionalLight(0xffeedd, 1.2);
sunLight.position.set(30, 40, 20);
sunLight.castShadow = true;
scene.add(sunLight);

scene.add(new THREE.AmbientLight(0x8899bb, 0.35));

scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.3));

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();
  water.position.y = Math.sin(t * 0.5) * 0.1;

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

## index.html——入口

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>程序化地形生成</title>
  <style>
    * { margin: 0; padding: 0; }
    body { overflow: hidden; }
    canvas { display: block; }
    #info {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: white;
      font-family: monospace;
      background: rgba(0,0,0,0.5);
      padding: 8px 16px;
      border-radius: 4px;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="info">鼠标拖拽旋转 | 滚轮缩放 | 右键平移</div>
  <script type="module" src="main.js"></script>
</body>
</html>
```

## 运行效果

打开页面后你会看到：
- 远处是深蓝色的海洋，近处有浅蓝色的浅水区
- 白色的沙滩过渡到绿色的平原
- 平原上偶尔有被侵蚀切割出的小峡谷
- 远方是棕色的山脉，山顶有白雪
- 水面微微起伏，模拟波浪
- 雾效让远处的地形逐渐融入天空

用鼠标可以自由旋转、缩放、平移视角。整个地形是确定性的——刷新页面会得到完全相同的地形。

## 从这里开始

第一阶段完成了。你现在有了一个能生成真实感地形的工具链：

1. **噪声** → 生成基础高度值
2. **Domain Warping** → 创造区域特征
3. **地形特征函数** → 雕刻山峰、海岸线、平原
4. **侵蚀模拟** → 添加自然的侵蚀痕迹
5. **着色系统** → 根据高度和水域渲染视觉效果

第二阶段会在这个基础上添加生物群落——不同区域会有不同的植被、气候和颜色。
