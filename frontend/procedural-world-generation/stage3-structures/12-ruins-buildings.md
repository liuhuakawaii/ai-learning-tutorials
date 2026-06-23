# 废墟与建筑——程序化建筑生成、损坏效果

## 程序化建筑不是随机堆砖

建筑是人类文明的标志。在程序化世界中放置建筑有两种做法：预制模型拼接和程序化生成。预制模型质量高但重复感强，程序化生成变化多但控制难度大。

这节课的策略是：用规则生成基本结构，再用噪声和随机破坏让它看起来"废墟化"。废墟比完好建筑更容易程序化——因为不对称和残缺本身就是特征。

## 建筑的基本结构

最简单的建筑由这些元素组成：
- 地基（矩形平台）
- 墙壁（四面围合）
- 门洞（墙壁上的空洞）
- 屋顶（斜面或平顶）
- 柱子（装饰性或结构性）

```js
function createRuinFoundation(width, depth, height) {
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a7a6a,
    roughness: 0.95,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = height / 2;
  return mesh;
}

function createWall(width, height, thickness) {
  const geo = new THREE.BoxGeometry(width, height, thickness);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9a8a7a,
    roughness: 0.9,
  });
  return new THREE.Mesh(geo, mat);
}
```

## 程序化损坏效果

废墟的关键是"不完整性"。实现方式：

### 1. 随机移除墙壁片段

```js
function createBrokenWall(width, height, thickness, damage = 0.3) {
  const segments = Math.ceil(width / 0.5);
  const group = new THREE.Group();

  for (let i = 0; i < segments; i++) {
    if (Math.random() < damage) continue;

    const segWidth = width / segments;
    const segHeight = height * (1 - Math.random() * damage * 0.5);

    const wall = createWall(segWidth, segHeight, thickness);
    wall.position.x = (i - segments / 2 + 0.5) * segWidth;
    wall.position.y = segHeight / 2;
    group.add(wall);
  }

  return group;
}
```

### 2. 倾斜和位移

```js
function addDamageTransform(mesh, damage) {
  mesh.rotation.x = (Math.random() - 0.5) * damage * 0.2;
  mesh.rotation.z = (Math.random() - 0.5) * damage * 0.2;
  mesh.position.x += (Math.random() - 0.5) * damage * 0.5;
  mesh.position.z += (Math.random() - 0.5) * damage * 0.5;
}
```

### 3. 碎石散落

```js
function createDebris(centerX, centerZ, radius, count) {
  const group = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(0.15, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 1 });

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const stone = new THREE.Mesh(geo, mat);
    stone.position.set(
      centerX + Math.cos(angle) * dist,
      Math.random() * 0.2,
      centerZ + Math.sin(angle) * dist,
    );
    stone.scale.setScalar(0.5 + Math.random() * 1.5);
    stone.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    group.add(stone);
  }

  return group;
}
```

## 完整代码：废墟建筑群

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 30);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const noise2D = createNoise2D();

function createRuin(width, depth, wallHeight, damage) {
  const group = new THREE.Group();

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.4, 0.3, depth + 0.4),
    new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 0.95 })
  );
  foundation.position.y = 0.15;
  group.add(foundation);

  const wallThickness = 0.25;
  const positions = [
    { x: 0, z: depth / 2, rotY: 0, w: width },
    { x: 0, z: -depth / 2, rotY: 0, w: width },
    { x: width / 2, z: 0, rotY: Math.PI / 2, w: depth },
    { x: -width / 2, z: 0, rotY: Math.PI / 2, w: depth },
  ];

  for (const pos of positions) {
    const segments = Math.ceil(pos.w / 0.6);
    for (let i = 0; i < segments; i++) {
      if (Math.random() < damage * 0.7) continue;

      const segW = pos.w / segments;
      const segH = wallHeight * (1 - Math.random() * damage * 0.6);
      const actualH = Math.max(0.3, segH);

      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(segW, actualH, wallThickness),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(0.55 + Math.random() * 0.1, 0.48 + Math.random() * 0.1, 0.38 + Math.random() * 0.1),
          roughness: 0.9,
        })
      );

      const offset = (i - segments / 2 + 0.5) * segW;
      wall.position.set(
        pos.x + Math.cos(pos.rotY) * offset,
        actualH / 2 + 0.3,
        pos.z + Math.sin(pos.rotY) * offset,
      );
      wall.rotation.y = pos.rotY;

      if (Math.random() < damage * 0.5) {
        wall.rotation.z = (Math.random() - 0.5) * 0.3;
        wall.position.x += (Math.random() - 0.5) * 0.2;
      }

      group.add(wall);
    }
  }

  if (Math.random() > damage * 0.8) {
    const roofGeo = new THREE.ConeGeometry(
      Math.max(width, depth) * 0.7,
      wallHeight * 0.5,
      4
    );
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({
      color: 0x4a3a2a,
      roughness: 0.95,
    }));
    roof.position.y = wallHeight + 0.3;
    roof.rotation.y = Math.PI / 4;
    if (Math.random() < damage) {
      roof.rotation.z = (Math.random() - 0.5) * 0.5;
    }
    group.add(roof);
  }

  const debris = createDebris(0, 0, Math.max(width, depth), Math.floor(damage * 20));
  group.add(debris);

  return group;
}

function createDebris(cx, cz, radius, count) {
  const group = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(0.15, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 1 });

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const stone = new THREE.Mesh(geo, mat);
    stone.position.set(
      cx + Math.cos(angle) * dist,
      Math.random() * 0.15,
      cz + Math.sin(angle) * dist,
    );
    stone.scale.setScalar(0.3 + Math.random() * 1.2);
    stone.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    group.add(stone);
  }
  return group;
}

const terrainGeo = new THREE.PlaneGeometry(60, 60, 32, 32);
terrainGeo.rotateX(-Math.PI / 2);
const terrainColors = [];
const tPos = terrainGeo.attributes.position;

for (let i = 0; i < tPos.count; i++) {
  const x = tPos.getX(i);
  const z = tPos.getZ(i);
  const h = noise2D(x * 0.05, z * 0.05) * 2;
  tPos.setY(i, h);
  const c = new THREE.Color();
  c.setHSL(0.28, 0.4, 0.3 + h * 0.02);
  terrainColors.push(c.r, c.g, c.b);
}

terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
terrainGeo.computeVertexNormals();
scene.add(new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true })));

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const rand = seededRandom(123);

for (let i = 0; i < 8; i++) {
  const x = (rand() - 0.5) * 40;
  const z = (rand() - 0.5) * 40;
  const w = 2 + rand() * 3;
  const d = 2 + rand() * 3;
  const h = 2 + rand() * 2.5;
  const damage = 0.2 + rand() * 0.6;

  const ruin = createRuin(w, d, h, damage);
  ruin.position.set(x, noise2D(x * 0.05, z * 0.05) * 2, z);
  ruin.rotation.y = rand() * Math.PI * 2;
  scene.add(ruin);
}

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
sun.position.set(20, 30, 15);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a4a2a, 0.25));

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
```

运行后你会看到散布在地形上的废墟群——有的只剩下地基和几段残墙，有的还保留着倾斜的屋顶，碎石散落四周。每栋建筑的损坏程度不同，形态各异。

## 建筑风格的参数化

通过调整参数可以生成不同风格的建筑：
- **宽度/深度比** > 2：长条形的棚屋或走廊
- **墙壁高度** > 4：高塔或教堂
- **damage** < 0.2：相对完好的建筑
- **damage** > 0.6：严重废墟

## 练习

1. 给废墟添加藤蔓——用绿色的细长圆柱体沿着残墙攀爬。
2. 在建筑内部放置一个火盆——用橙色的 PointLight 模拟火光。
3. 生成一个"广场"——多个建筑围绕一个中心空地排列。

## 参考答案

### 练习 1
遍历每面墙的顶部，在侧面随机放置若干绿色的 CylinderGeometry（半径 0.02、长度 0.5-1.5），略微倾斜贴在墙面上。

### 练习 2
在建筑内部中心放置一个小型 BoxGeometry 作为火盆，上方放一个 PointLight（颜色 0xff6622、强度 1.0、距离 8）。光线会让废墟内部有温暖的光晕。

### 练习 3
在中心点周围 5 米半径的圆上均匀放置 4-6 栋建筑，门洞朝向中心。广场中间可以放一个圆形的石台作为地标。
