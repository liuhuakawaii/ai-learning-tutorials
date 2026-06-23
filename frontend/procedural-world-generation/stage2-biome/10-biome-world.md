# 阶段实战：生成一个有多生物群落的世界

## 整合第二阶段的全部内容

这节课把温度模型、湿度模型、Biome 映射、植被放置、水体生成、天气系统全部整合到一起，生成一个可以自由探索的多生物群落世界。

这是第一个真正意义上的"项目"——不再是单个效果的演示，而是一个有完整视觉层次的场景。

## 项目结构

```
stage2-biome/
├── index.html
├── main.js
├── world.js
├── biomes.js
├── vegetation.js
├── water.js
└── weather.js
```

## biomes.js——Biome 定义与映射

```js
export const BIOME_TYPES = {
  OCEAN:     { name: '海洋',     color: [0.10, 0.30, 0.55], heightOffset: -2 },
  BEACH:     { name: '沙滩',     color: [0.85, 0.80, 0.55], heightOffset: 0.3 },
  DESERT:    { name: '沙漠',     color: [0.76, 0.70, 0.50], heightOffset: 0 },
  GRASSLAND: { name: '草原',     color: [0.45, 0.62, 0.22], heightOffset: 0 },
  SAVANNA:   { name: '热带草原', color: [0.62, 0.58, 0.18], heightOffset: 0 },
  TUNDRA:    { name: '冻原',     color: [0.68, 0.70, 0.66], heightOffset: 0 },
  BOREAL:    { name: '针叶林',   color: [0.14, 0.32, 0.14], heightOffset: 0 },
  FOREST:    { name: '落叶林',   color: [0.22, 0.48, 0.18], heightOffset: 0 },
  TROPICAL:  { name: '热带雨林', color: [0.08, 0.42, 0.08], heightOffset: 0 },
  SNOW:      { name: '雪地',     color: [0.88, 0.90, 0.93], heightOffset: 0 },
};

export function getBiome(height, temp, moisture) {
  if (height < -1) return BIOME_TYPES.OCEAN;
  if (height < 0.3 && moisture > 0.4) return BIOME_TYPES.BEACH;
  if (height > 12) return BIOME_TYPES.SNOW;

  if (temp < 0.25) return moisture > 0.5 ? BIOME_TYPES.TUNDRA : BIOME_TYPES.TUNDRA;
  if (temp < 0.55) {
    if (moisture < 0.3) return BIOME_TYPES.GRASSLAND;
    if (moisture < 0.65) return BIOME_TYPES.FOREST;
    return BIOME_TYPES.BOREAL;
  }
  if (moisture < 0.25) return BIOME_TYPES.DESERT;
  if (moisture < 0.5) return BIOME_TYPES.SAVANNA;
  return BIOME_TYPES.TROPICAL;
}
```

## world.js——地形与气候生成

```js
import { createNoise2D } from 'simplex-noise';
import { getBiome, BIOME_TYPES } from './biomes.js';

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

export function generateWorld(size, scale) {
  const heightMap = new Float32Array(size * size);
  const biomeMap = new Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size - 0.5;
      const nz = y / size - 0.5;

      let h = warpedNoise(nx * 3, nz * 3);

      const coastWarp = noise2D(nx * 8, nz * 8) * 0.12;
      if (h > coastWarp) {
        h = Math.pow(h - coastWarp, 1.3) + coastWarp;
      } else {
        h *= 0.25;
      }

      h *= 18;
      heightMap[y * size + x] = h;

      const temp = 1 - Math.abs(nz) * 1.2 + noise2D(nx * 2, nz * 2) * 0.15;
      const moisture = Math.max(0, Math.min(1,
        (1 - Math.abs(nx) * 0.8) * 0.5 + fbm(nx * 3 + 50, nz * 3 + 50) * 0.4
      ));

      biomeMap[y * size + x] = getBiome(h, temp, moisture);
    }
  }

  return { heightMap, biomeMap };
}
```

## vegetation.js——植被放置

```js
import * as THREE from 'three';
import { BIOME_TYPES } from './biomes.js';
import { fbm } from './world.js';

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function createPineTree(h) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.07, h * 0.3, 5),
    new THREE.MeshStandardMaterial({ color: 0x5c3a1e })
  );
  trunk.position.y = h * 0.15;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(h * (0.28 - i * 0.06), h * 0.32, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a5c1a })
    );
    cone.position.y = h * (0.3 + i * 0.18);
    g.add(cone);
  }
  return g;
}

function createBroadTree(h) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.09, h * 0.4, 5),
    new THREE.MeshStandardMaterial({ color: 0x6b4226 })
  );
  trunk.position.y = h * 0.2;
  g.add(trunk);
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(h * 0.33, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x2d7a2d })
  );
  crown.position.y = h * 0.58;
  crown.scale.y = 0.8;
  g.add(crown);
  return g;
}

function createCactus(h) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, h, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a7a3a })
  );
  body.position.y = h / 2;
  g.add(body);
  return g;
}

export function placeVegetation(scene, size, scale, heightMap, biomeMap) {
  const rand = seededRandom(42);
  const spacing = 2.2;

  for (let gz = -size / 2; gz < size / 2; gz += spacing) {
    for (let gx = -size / 2; gx < size / 2; gx += spacing) {
      const x = gx + (rand() - 0.5) * spacing * 0.5;
      const z = gz + (rand() - 0.5) * spacing * 0.5;

      const ix = Math.floor(((x / scale) + 0.5) * size);
      const iz = Math.floor(((z / scale) + 0.5) * size);
      if (ix < 0 || ix >= size || iz < 0 || iz >= size) continue;

      const idx = iz * size + ix;
      const h = heightMap[idx];
      const biome = biomeMap[idx];
      if (h < 0.5) continue;

      const density = fbm(x * 0.08, z * 0.08) * 0.5 + 0.5;
      let tree = null;

      if (biome === BIOME_TYPES.BOREAL && density > 0.3 && rand() > 0.25) {
        tree = createPineTree(1.2 + rand() * 1.5);
      } else if (biome === BIOME_TYPES.FOREST && density > 0.25 && rand() > 0.35) {
        tree = createBroadTree(1.5 + rand() * 2);
      } else if (biome === BIOME_TYPES.TROPICAL && density > 0.2 && rand() > 0.25) {
        tree = createBroadTree(2 + rand() * 2.5);
      } else if (biome === BIOME_TYPES.DESERT && rand() > 0.88) {
        tree = createCactus(0.6 + rand() * 1);
      } else if (biome === BIOME_TYPES.SAVANNA && density > 0.5 && rand() > 0.65) {
        tree = createBroadTree(0.8 + rand() * 1);
      }

      if (tree) {
        tree.position.set(x, h, z);
        tree.rotation.y = rand() * Math.PI * 2;
        scene.add(tree);
      }
    }
  }
}
```

## water.js——水体

```js
import * as THREE from 'three';

export function createWater(scene, scale) {
  const geo = new THREE.PlaneGeometry(scale * 1.2, scale * 1.2, 32, 32);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1a6e8a,
    transparent: true,
    opacity: 0.5,
    roughness: 0.1,
    metalness: 0.2,
  });
  const water = new THREE.Mesh(geo, mat);
  water.position.y = 0;
  scene.add(water);
  return water;
}
```

## weather.js——天气系统

```js
import * as THREE from 'three';

export function createRainSystem(count = 3000) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 80;
    pos[i * 3 + 1] = Math.random() * 40;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    vel[i] = 0.3 + Math.random() * 0.4;
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xaabbcc, size: 0.08, transparent: true, opacity: 0.5 });
  const rain = new THREE.Points(geo, mat);
  rain.userData.velocities = vel;
  return rain;
}

export function updateRain(rain, dt) {
  const pos = rain.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.array[i * 3 + 1] -= rain.userData.velocities[i] * dt * 60;
    if (pos.array[i * 3 + 1] < -2) pos.array[i * 3 + 1] = 40;
  }
  pos.needsUpdate = true;
}
```

## main.js——场景组装

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { generateWorld } from './world.js';
import { placeVegetation } from './vegetation.js';
import { createWater } from './water.js';
import { createRainSystem, updateRain } from './weather.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.007);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.2;

const SIZE = 100;
const SCALE = 80;

const { heightMap, biomeMap } = generateWorld(SIZE, SCALE);

const terrainGeo = new THREE.PlaneGeometry(SCALE, SCALE, SIZE - 1, SIZE - 1);
terrainGeo.rotateX(-Math.PI / 2);

const colors = [];
const posAttr = terrainGeo.attributes.position;

for (let i = 0; i < posAttr.count; i++) {
  const h = heightMap[i];
  const biome = biomeMap[i];
  posAttr.setY(i, h);

  const c = biome.color;
  const shadow = 0.65 + (h / 18) * 0.35;
  colors.push(c[0] * shadow, c[1] * shadow, c[2] * shadow);
}

terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals();
scene.add(new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true })));

placeVegetation(scene, SIZE, SCALE, heightMap, biomeMap);
const water = createWater(scene, SCALE);
const rain = createRainSystem(3000);
scene.add(rain);

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
sun.position.set(30, 40, 20);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.25));

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();

  water.position.y = Math.sin(t * 0.5) * 0.08;
  updateRain(rain, dt);

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
  <title>多生物群落世界</title>
  <style>
    * { margin: 0; padding: 0; }
    body { overflow: hidden; }
    #info {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      color: white; font-family: monospace; background: rgba(0,0,0,0.5);
      padding: 8px 16px; border-radius: 4px; pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="info">探索不同生物群落：绿色=森林 | 深绿=针叶林 | 黄绿=草原 | 黄=沙漠</div>
  <script type="module" src="main.js"></script>
</body>
</html>
```

## 观察要点

运行后在场景中漫游，注意观察：
- 不同 Biome 之间的颜色过渡
- 植被类型的差异（针叶林 vs 阔叶林 vs 仙人掌）
- 海洋和陆地的分界线
- 雨滴粒子的下落

用鼠标旋转视角从高处俯瞰，能看到整个世界的 Biome 分布——这比第一阶段的单色地形丰富太多了。

## 第二阶段回顾

现在我们有了：
1. **气候模型** → 温度和湿度的空间分布
2. **Biome 映射** → 根据气候划分生物群落
3. **植被系统** → 根据 Biome 放置不同类型的树木
4. **水体** → 海洋、河流
5. **天气** → 雨、雾的视觉效果

第三阶段会添加结构——洞穴、建筑、道路、NPC。
