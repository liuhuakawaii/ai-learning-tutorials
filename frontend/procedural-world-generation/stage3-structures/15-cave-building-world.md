# 阶段实战：在世界中生成洞穴和建筑

## 整合第三阶段的全部内容

这节课把洞穴系统、废墟建筑、道路网络、NPC 生物全部整合到前两阶段的世界中。目标是生成一个有地下洞穴、地表建筑、道路连接、生物活动的完整场景。

## 项目结构

```
stage3-structures/
├── index.html
├── main.js
├── world.js        # 复用 stage2 的世界生成
├── cave.js
├── buildings.js
├── roads.js
└── creatures.js
```

## cave.js——洞穴生成模块

```js
export function generateCave(sx, sy, sz, fillProb = 0.42, iterations = 5) {
  const grid = new Uint8Array(sx * sy * sz);

  for (let i = 0; i < grid.length; i++) {
    grid[i] = Math.random() < fillProb ? 1 : 0;
  }

  for (let iter = 0; iter < iterations; iter++) {
    const next = new Uint8Array(grid.length);
    for (let z = 0; z < sz; z++) {
      for (let y = 0; y < sy; y++) {
        for (let x = 0; x < sx; x++) {
          let count = 0;
          for (let dz = -1; dz <= 1; dz++) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0 && dz === 0) continue;
                const nx = x + dx, ny = y + dy, nz = z + dz;
                if (nx < 0 || nx >= sx || ny < 0 || ny >= sy || nz < 0 || nz >= sz) {
                  count++;
                } else {
                  count += grid[nz * sy * sx + ny * sx + nx];
                }
              }
            }
          }
          const idx = z * sy * sx + y * sx + x;
          next[idx] = count > 13 ? 1 : count < 13 ? 0 : grid[idx];
        }
      }
    }
    for (let i = 0; i < grid.length; i++) grid[i] = next[i];
  }

  return grid;
}

export function buildCaveMesh(grid, sx, sy, sz) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0x665544,
    roughness: 0.9,
    metalness: 0.05,
  });

  let visibleCount = 0;
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        if (grid[z * sy * sx + y * sx + x] === 1) {
          let hasAir = false;
          for (const [dx, dy, dz] of [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]]) {
            const nx = x + dx, ny = y + dy, nz = z + dz;
            if (nx < 0 || nx >= sx || ny < 0 || ny >= sy || nz < 0 || nz >= sz) {
              hasAir = true;
            } else if (grid[nz * sy * sx + ny * sx + nx] === 0) {
              hasAir = true;
            }
          }
          if (hasAir) visibleCount++;
        }
      }
    }
  }

  const mesh = new THREE.InstancedMesh(geometry, material, visibleCount);
  let idx = 0;
  const matrix = new THREE.Matrix4();

  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        if (grid[z * sy * sx + y * sx + x] === 1) {
          let hasAir = false;
          for (const [dx, dy, dz] of [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]]) {
            const nx = x + dx, ny = y + dy, nz = z + dz;
            if (nx < 0 || nx >= sx || ny < 0 || ny >= sy || nz < 0 || nz >= sz) {
              hasAir = true;
            } else if (grid[nz * sy * sx + ny * sx + nx] === 0) {
              hasAir = true;
            }
          }
          if (hasAir) {
            matrix.setPosition(x - sx / 2, y - sy, z - sz / 2);
            mesh.setMatrixAt(idx, matrix);
            idx++;
          }
        }
      }
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = idx;
  return mesh;
}
```

## buildings.js——建筑生成模块

```js
function createRuin(width, depth, height, damage) {
  const group = new THREE.Group();

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.3, 0.25, depth + 0.3),
    new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 0.95 })
  );
  foundation.position.y = 0.12;
  group.add(foundation);

  const wallThickness = 0.2;
  const sides = [
    { x: 0, z: depth / 2, rot: 0, w: width },
    { x: 0, z: -depth / 2, rot: 0, w: width },
    { x: width / 2, z: 0, rot: Math.PI / 2, w: depth },
    { x: -width / 2, z: 0, rot: Math.PI / 2, w: depth },
  ];

  for (const side of sides) {
    const segs = Math.ceil(side.w / 0.5);
    for (let i = 0; i < segs; i++) {
      if (Math.random() < damage * 0.7) continue;
      const segW = side.w / segs;
      const segH = Math.max(0.3, height * (1 - Math.random() * damage * 0.5));

      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(segW, segH, wallThickness),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.08, 0.15, 0.45 + Math.random() * 0.1),
          roughness: 0.9,
        })
      );

      const offset = (i - segs / 2 + 0.5) * segW;
      wall.position.set(
        side.x + Math.cos(side.rot) * offset,
        segH / 2 + 0.25,
        side.z + Math.sin(side.rot) * offset,
      );
      wall.rotation.y = side.rot;

      if (Math.random() < damage * 0.4) {
        wall.rotation.z = (Math.random() - 0.5) * 0.25;
      }
      group.add(wall);
    }
  }

  return group;
}

export function placeBuildings(scene, positions, heightFn) {
  for (const { x, z } of positions) {
    const h = heightFn(x, z);
    if (h < 0.5) continue;

    const w = 2 + Math.random() * 3;
    const d = 2 + Math.random() * 3;
    const bh = 2 + Math.random() * 2;
    const damage = 0.2 + Math.random() * 0.5;

    const ruin = createRuin(w, d, bh, damage);
    ruin.position.set(x, h, z);
    ruin.rotation.y = Math.random() * Math.PI * 2;
    scene.add(ruin);
  }
}
```

## roads.js——道路模块

```js
export function generateRoadPaths(buildings, gridSize) {
  const edges = [];
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const d = Math.hypot(buildings[i].x - buildings[j].x, buildings[i].y - buildings[j].y);
      edges.push({ from: i, to: j, dist: d });
    }
  }
  edges.sort((a, b) => a.dist - b.dist);

  const parent = buildings.map((_, i) => i);
  const find = (x) => parent[x] === x ? x : (parent[x] = find(parent[x]));

  const paths = [];

  for (const edge of edges) {
    const a = find(edge.from), b = find(edge.to);
    if (a === b) continue;
    parent[a] = b;

    const from = buildings[edge.from];
    const to = buildings[edge.to];

    let cx = from.x, cy = from.y;
    const path = [{ x: cx, y: cy }];

    while (cx !== to.x || cy !== to.y) {
      const dx = Math.sign(to.x - cx);
      const dy = Math.sign(to.y - cy);
      if (Math.abs(to.x - cx) > Math.abs(to.y - cy)) cx += dx;
      else cy += dy;
      path.push({ x: cx, y: cy });
    }

    paths.push(path);
  }

  return paths;
}
```

## creatures.js——生物模块

```js
export class CreatureSystem {
  constructor() {
    this.deer = [];
    this.birds = [];
  }

  addDeer(x, z, mesh) {
    this.deer.push({
      mesh,
      x, z,
      targetX: x + (Math.random() - 0.5) * 10,
      targetZ: z + (Math.random() - 0.5) * 10,
      speed: 1 + Math.random() * 0.8,
      timer: 3 + Math.random() * 4,
      state: 'wander',
    });
  }

  addBird(x, z, mesh) {
    this.birds.push({
      mesh,
      x, z,
      y: 5 + Math.random() * 4,
      angle: Math.random() * Math.PI * 2,
      radius: 5 + Math.random() * 8,
      speed: 0.3 + Math.random() * 0.4,
      wingPhase: Math.random() * Math.PI * 2,
    });
  }

  update(dt, heightFn) {
    for (const d of this.deer) {
      d.timer -= dt;
      if (d.state === 'wander') {
        const dx = d.targetX - d.x, dz = d.targetZ - d.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.3) {
          d.x += (dx / dist) * d.speed * dt;
          d.z += (dz / dist) * d.speed * dt;
        }
        if (d.timer <= 0 || dist < 0.5) {
          d.state = d.timer <= 0 ? 'idle' : 'wander';
          d.targetX = d.x + (Math.random() - 0.5) * 12;
          d.targetZ = d.z + (Math.random() - 0.5) * 12;
          d.timer = 3 + Math.random() * 5;
        }
      } else if (d.state === 'idle') {
        if (d.timer <= 0) {
          d.state = 'wander';
          d.timer = 4 + Math.random() * 4;
        }
      }
      d.mesh.position.set(d.x, heightFn(d.x, d.z), d.z);
      d.mesh.rotation.y = Math.atan2(d.targetX - d.x, d.targetZ - d.z);
    }

    for (const b of this.birds) {
      b.angle += b.speed * dt;
      b.wingPhase += dt * 8;
      const bx = b.x + Math.cos(b.angle) * b.radius;
      const bz = b.z + Math.sin(b.angle) * b.radius;
      b.mesh.position.set(bx, b.y + Math.sin(b.wingPhase * 0.3) * 0.5, bz);
      b.mesh.rotation.y = b.angle + Math.PI / 2;
    }
  }
}
```

## main.js——完整场景组装

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';
import { generateCave, buildCaveMesh } from './cave.js';
import { placeBuildings } from './buildings.js';
import { generateRoadPaths } from './roads.js';
import { CreatureSystem } from './creatures.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.006);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
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

function getHeight(x, z) {
  return fbm(x * 0.05, z * 0.05) * 10;
}

const TERRAIN_SIZE = 60;
const terrainGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 60, 60);
terrainGeo.rotateX(-Math.PI / 2);
const tColors = [];
const tPos = terrainGeo.attributes.position;

for (let i = 0; i < tPos.count; i++) {
  const x = tPos.getX(i), z = tPos.getZ(i);
  const h = getHeight(x, z);
  tPos.setY(i, h);
  const c = new THREE.Color();
  if (h < 0) c.setHSL(0.58, 0.6, 0.25);
  else if (h < 3) c.setHSL(0.28, 0.55, 0.32);
  else if (h < 6) c.setHSL(0.22, 0.45, 0.35);
  else c.setHSL(0.1, 0.3, 0.5);
  tColors.push(c.r, c.g, c.b);
}

terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(tColors, 3));
terrainGeo.computeVertexNormals();
scene.add(new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true })));

const caveGrid = generateCave(20, 8, 20, 0.43, 5);
const caveMesh = buildCaveMesh(caveGrid, 20, 8, 20);
caveMesh.position.y = -10;
scene.add(caveMesh);

const buildingPositions = [];
function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const rand = seededRandom(42);

for (let i = 0; i < 6; i++) {
  const x = (rand() - 0.5) * 35;
  const z = (rand() - 0.5) * 35;
  buildingPositions.push({ x, z });
}

placeBuildings(scene, buildingPositions, getHeight);

const gridBuildings = buildingPositions.map(b => ({
  x: Math.floor((b.x / TERRAIN_SIZE + 0.5) * 60),
  y: Math.floor((b.z / TERRAIN_SIZE + 0.5) * 60),
}));

const roadPaths = generateRoadPaths(gridBuildings, 60);
const roadPoints = [];

for (const path of roadPaths) {
  for (const { x, y } of path) {
    const wx = (x / 60 - 0.5) * TERRAIN_SIZE;
    const wz = (y / 60 - 0.5) * TERRAIN_SIZE;
    roadPoints.push(new THREE.Vector3(wx, getHeight(wx, wz) + 0.05, wz));
  }
}

if (roadPoints.length > 1) {
  const roadGeo = new THREE.BufferGeometry().setFromPoints(roadPoints);
  scene.add(new THREE.Points(roadGeo, new THREE.PointsMaterial({ color: 0x8a7a5a, size: 0.25 })));
}

const creatureSystem = new CreatureSystem();

for (let i = 0; i < 10; i++) {
  const x = (rand() - 0.5) * 35;
  const z = (rand() - 0.5) * 35;
  if (getHeight(x, z) < 0.5) continue;

  const deer = new THREE.Group();
  deer.add(Object.assign(new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.4, 1),
    new THREE.MeshStandardMaterial({ color: 0x8b6914 })
  ), { position: new THREE.Vector3(0, 0.7, 0) }));
  deer.add(Object.assign(new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x6b4914 })
  ), { position: new THREE.Vector3(-0.15, 0.35, -0.3) }));
  deer.add(Object.assign(new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x6b4914 })
  ), { position: new THREE.Vector3(0.15, 0.35, -0.3) }));

  scene.add(deer);
  creatureSystem.addDeer(x, z, deer);
}

for (let i = 0; i < 6; i++) {
  const bird = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  scene.add(bird);
  creatureSystem.addBird((rand() - 0.5) * 30, (rand() - 0.5) * 30, bird);
}

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
sun.position.set(25, 35, 20);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.25));

const torchLight = new THREE.PointLight(0xff8833, 1.5, 15);
torchLight.position.set(0, 3, 0);
scene.add(torchLight);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();

  creatureSystem.update(dt, getHeight);
  torchLight.intensity = 1.2 + Math.sin(t * 3) * 0.3;

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
  <title>程序化世界——结构生成</title>
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
  <div id="info">地表：废墟 + 道路 + 生物 | 地下：洞穴系统（向下移动查看）</div>
  <script type="module" src="main.js"></script>
</body>
</html>
```

## 观察要点

运行后注意：
- 地表上散布着不同损坏程度的废墟
- 褐色的道路连接着各栋建筑
- 鹿群在草地上漫步，鸟在空中盘旋
- 地下有一个独立的洞穴系统（需要把相机向下移动才能看到）
- 火把光源在洞穴中摇曳

## 第三阶段回顾

现在世界有了结构层次：
1. **地表**：地形 + Biome + 植被 + 水体 + 天气
2. **建筑**：程序化废墟 + 道路网络
3. **生物**：NPC 行为状态机 + 生态系统
4. **地下**：3D 洞穴系统

第四阶段会解决"无限"——让世界不再局限于固定大小。
