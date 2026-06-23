# 植被分布——基于气候的植被生成、树木放置

## 从 Biome 到植被

上节课我们用温度和湿度划分出了不同的生物群落。但光有颜色还不够——森林里应该有树，草地上应该有草，沙漠里应该有仙人掌。这节课要在 Biome 的基础上放置植被。

程序化放置植被的核心挑战是：看起来自然。不能像撒芝麻一样均匀分布，也不能完全随机——真实世界的植被有集群效应，树会成片生长，草地有疏密变化。

## 植被分布的三个原则

### 1. 概率分布而非确定分布

每个位置的 Biome 决定了"这里能长什么"以及"长的概率有多大"。森林里 80% 的格子有树，但不是 100%。

### 2. 噪声调制密度

用噪声来调制植被密度，让分布有自然的疏密变化：

```js
const density = fbm(x * 5, z * 5) * 0.5 + 0.5;
const hasTree = density > 0.3;
```

### 3. 避免均匀间隔

在网格上放置植被时，加一点随机偏移，避免"阅兵式"的整齐排列：

```js
const offsetX = (Math.random() - 0.5) * spacing * 0.6;
const offsetZ = (Math.random() - 0.5) * spacing * 0.6;
```

## 树木的几何体

用简单的几何体组合来表示不同类型的树：

```js
function createPineTree(height) {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.08, height * 0.3, 5),
    new THREE.MeshStandardMaterial({ color: 0x5c3a1e })
  );
  trunk.position.y = height * 0.15;
  group.add(trunk);

  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(height * (0.3 - i * 0.07), height * 0.35, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a5c1a })
    );
    cone.position.y = height * (0.3 + i * 0.2);
    group.add(cone);
  }

  return group;
}

function createDeciduousTree(height) {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.1, height * 0.4, 5),
    new THREE.MeshStandardMaterial({ color: 0x6b4226 })
  );
  trunk.position.y = height * 0.2;
  group.add(trunk);

  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(height * 0.35, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x2d7a2d })
  );
  crown.position.y = height * 0.6;
  crown.scale.y = 0.8;
  group.add(crown);

  return group;
}

function createCactus(height) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, height, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a7a3a })
  );
  body.position.y = height / 2;
  group.add(body);

  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, height * 0.4, 5),
    new THREE.MeshStandardMaterial({ color: 0x3a7a3a })
  );
  arm.position.set(0.15, height * 0.6, 0);
  arm.rotation.z = -0.5;
  group.add(arm);

  return group;
}
```

## 完整代码：带植被的 Biome 场景

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

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

function getBiomeType(temp, moisture) {
  if (temp < 0.25) return 'tundra';
  if (temp < 0.55) {
    if (moisture < 0.3) return 'grassland';
    if (moisture < 0.65) return 'forest';
    return 'boreal';
  }
  if (moisture < 0.25) return 'desert';
  if (moisture < 0.5) return 'savanna';
  return 'tropical';
}

function getHeight(x, z) {
  return fbm(x * 0.05, z * 0.05, 5) * 15;
}

function getBiomeColor(biome) {
  switch (biome) {
    case 'tundra':    return [0.70, 0.72, 0.68];
    case 'grassland': return [0.50, 0.65, 0.25];
    case 'forest':    return [0.25, 0.50, 0.20];
    case 'boreal':    return [0.15, 0.35, 0.15];
    case 'desert':    return [0.76, 0.70, 0.50];
    case 'savanna':   return [0.65, 0.60, 0.20];
    case 'tropical':  return [0.10, 0.45, 0.10];
    default:          return [0.4, 0.4, 0.4];
  }
}

const SIZE = 80;
const SCALE = 80;
const terrainGeo = new THREE.PlaneGeometry(SCALE, SCALE, SIZE - 1, SIZE - 1);
terrainGeo.rotateX(-Math.PI / 2);

const terrainColors = [];
const posAttr = terrainGeo.attributes.position;

for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i);
  const z = posAttr.getZ(i);
  const h = getHeight(x, z);
  posAttr.setY(i, h);

  const temp = 1 - Math.abs(z / SCALE) * 0.8 + noise2D(x * 0.02, z * 0.02) * 0.1;
  const moisture = Math.max(0, Math.min(1, 0.5 + noise2D(x * 0.03 + 50, z * 0.03 + 50) * 0.3));
  const biome = getBiomeType(temp, moisture);
  const c = getBiomeColor(biome);
  const shadow = 0.7 + (h / 15) * 0.3;

  terrainColors.push(c[0] * shadow, c[1] * shadow, c[2] * shadow);
}

terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
terrainGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
scene.add(new THREE.Mesh(terrainGeo, terrainMat));

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);
const spacing = 2.5;

for (let gz = -SIZE / 2; gz < SIZE / 2; gz += spacing) {
  for (let gx = -SIZE / 2; gx < SIZE / 2; gx += spacing) {
    const x = gx + (rand() - 0.5) * spacing * 0.6;
    const z = gz + (rand() - 0.5) * spacing * 0.6;

    const h = getHeight(x, z);
    if (h < 0.5) continue;

    const temp = 1 - Math.abs(z / SCALE) * 0.8 + noise2D(x * 0.02, z * 0.02) * 0.1;
    const moisture = Math.max(0, Math.min(1, 0.5 + noise2D(x * 0.03 + 50, z * 0.03 + 50) * 0.3));
    const biome = getBiomeType(temp, moisture);
    const density = fbm(x * 0.1, z * 0.1) * 0.5 + 0.5;

    let tree = null;

    if (biome === 'boreal' && density > 0.3 && rand() > 0.3) {
      tree = createPineTree(1.5 + rand() * 1.5);
    } else if (biome === 'forest' && density > 0.25 && rand() > 0.4) {
      tree = createDeciduousTree(1.5 + rand() * 2);
    } else if (biome === 'tropical' && density > 0.2 && rand() > 0.3) {
      tree = createDeciduousTree(2 + rand() * 2.5);
    } else if (biome === 'desert' && rand() > 0.85) {
      tree = createCactus(0.8 + rand() * 1.2);
    } else if (biome === 'savanna' && density > 0.5 && rand() > 0.7) {
      tree = createDeciduousTree(1 + rand() * 1);
    }

    if (tree) {
      tree.position.set(x, h, z);
      tree.rotation.y = rand() * Math.PI * 2;
      scene.add(tree);
    }
  }
}

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
sun.position.set(30, 40, 20);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.3));

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
```

运行后你会看到：
- 针叶林区域密集的尖顶松树
- 落叶林区域圆顶的阔叶树
- 沙漠中零星的仙人掌
- 热带区域茂密的大树
- 草原上稀疏的树木
- 冻原和水面上没有植被

## 性能注意事项

上面的代码为每棵树创建了独立的几何体和材质。当树的数量达到几千棵时，渲染帧率会明显下降。实际项目中会用实例化渲染（InstancedMesh）来批量绘制相同类型的树——这在第 23 课"植被渲染"会详细讲。

## 练习

1. 给草地添加草丛——用细长的圆锥体随机散布在草地区域。
2. 让树木的高度也受 Biome 参数影响——热带的树更高，冻原的树更矮。
3. 添加岩石——在山坡（坡度大的地方）放置灰色的不规则多面体。

## 参考答案

### 练习 1
在 `grassland` 和 `savanna` 的判断分支中，用 `rand() > 0.5` 概率创建一个细长的绿色圆锥体（半径 0.03、高度 0.3），放在地面上。密集的草丛会让草地看起来更丰满。

### 练习 2
树木高度公式中加入温度因子：`const treeHeight = baseHeight * (0.5 + temp * 0.8);`。热带的树会比冻原的高出 50% 以上。

### 练习 3
计算每个网格点的坡度（相邻点高度差的最大值），坡度大于某个阈值时放置一个 `DodecahedronGeometry` 的灰色岩石。山坡越陡，岩石越多。
