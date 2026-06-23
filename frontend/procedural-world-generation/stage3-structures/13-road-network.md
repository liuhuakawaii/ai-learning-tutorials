# 道路网络——路径生成、A* 路径规划

## 道路连接什么

上节课生成了散落的废墟。但真实世界的建筑不会孤立存在——它们被道路连接。道路的走向不是随机的，它遵循两个原则：

1. **连接重要的点**（建筑、聚落、资源点）
2. **避开困难的地形**（陡坡、水域、密林）

这节课用 A* 算法在地形上生成连接建筑的道路网络。

## A* 路径规划回顾

A* 是一种启发式搜索算法。它在图上找到从起点到终点的最低代价路径。关键要素：

- **g(n)**：从起点到当前点的实际代价
- **h(n)**：从当前点到终点的估计代价（启发式）
- **f(n) = g(n) + h(n)**：总估计代价

在地形上，"代价"不只是距离——爬坡比平地贵，涉水比陆地贵。

```js
function aStar(startX, startY, endX, endY, costFn, width, height) {
  const openSet = [{ x: startX, y: startY, f: 0 }];
  const cameFrom = new Map();
  const gScore = new Map();
  const key = (x, y) => `${x},${y}`;

  gScore.set(key(startX, startY), 0);

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const ck = key(current.x, current.y);

    if (current.x === endX && current.y === endY) {
      const path = [];
      let k = ck;
      while (k) {
        const [x, y] = k.split(',').map(Number);
        path.unshift({ x, y });
        k = cameFrom.get(k);
      }
      return path;
    }

    const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
    for (const [dx, dy] of dirs) {
      const nx = current.x + dx, ny = current.y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const moveCost = costFn(current.x, current.y, nx, ny);
      const tentativeG = gScore.get(ck) + moveCost;
      const nk = key(nx, ny);

      if (!gScore.has(nk) || tentativeG < gScore.get(nk)) {
        cameFrom.set(nk, ck);
        gScore.set(nk, tentativeG);

        const h = Math.abs(nx - endX) + Math.abs(ny - endY);
        openSet.push({ x: nx, y: ny, f: tentativeG + h });
      }
    }
  }

  return null;
}
```

## 地形代价函数

道路的代价要考虑：
- **距离**：基础代价，对角线比直线贵
- **坡度**：爬坡代价更高
- **水域**：过河代价很高（除非架桥）
- **已有道路**：走已有道路更便宜（鼓励道路汇聚）

```js
function createTerrainCostFn(heightMap, roadMap, gridSize) {
  return (x1, y1, x2, y2) => {
    const h1 = heightMap[y1 * gridSize + x1];
    const h2 = heightMap[y2 * gridSize + x2];
    const slope = Math.abs(h2 - h1);

    let cost = 1;
    cost += slope * 3;

    if (h2 < 0) cost += 10;

    if (roadMap[y2 * gridSize + x2] > 0) cost *= 0.3;

    return cost;
  };
}
```

## 道路网络生成策略

1. 把所有建筑标记为"节点"
2. 用最小生成树（MST）确定哪些节点需要直连
3. 对每条 MST 边，用 A* 找到实际路径
4. 路径经过的格子标记为"道路"

```js
function buildRoadNetwork(buildings, heightMap, gridSize) {
  const roadMap = new Float32Array(gridSize * gridSize);

  const edges = [];
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const dist = Math.hypot(
        buildings[i].x - buildings[j].x,
        buildings[i].y - buildings[j].y
      );
      edges.push({ from: i, to: j, dist });
    }
  }
  edges.sort((a, b) => a.dist - b.dist);

  const parent = buildings.map((_, i) => i);
  const find = (x) => parent[x] === x ? x : (parent[x] = find(parent[x]));

  const mstEdges = [];
  for (const edge of edges) {
    const a = find(edge.from), b = find(edge.to);
    if (a !== b) {
      parent[a] = b;
      mstEdges.push(edge);
    }
  }

  const costFn = createTerrainCostFn(heightMap, roadMap, gridSize);

  for (const edge of mstEdges) {
    const from = buildings[edge.from];
    const to = buildings[edge.to];

    const path = aStar(from.x, from.y, to.x, to.y, costFn, gridSize, gridSize);

    if (path) {
      for (const { x, y } of path) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              roadMap[ny * gridSize + nx] = Math.max(
                roadMap[ny * gridSize + nx],
                1 - dist * 0.3
              );
            }
          }
        }
      }
    }
  }

  return roadMap;
}
```

## 完整代码：带道路的废墟场景

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

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

const GRID = 60;
const SCALE = 60;
const heightMap = new Float32Array(GRID * GRID);

for (let y = 0; y < GRID; y++) {
  for (let x = 0; x < GRID; x++) {
    heightMap[y * GRID + x] = fbm(x / GRID * 3, y / GRID * 3) * 8;
  }
}

const terrainGeo = new THREE.PlaneGeometry(SCALE, SCALE, GRID - 1, GRID - 1);
terrainGeo.rotateX(-Math.PI / 2);
const colors = [];
const tPos = terrainGeo.attributes.position;

for (let i = 0; i < tPos.count; i++) {
  const h = heightMap[i];
  tPos.setY(i, h);
  const c = new THREE.Color();
  if (h < 0) c.setHSL(0.58, 0.6, 0.25);
  else c.setHSL(0.28, 0.5, 0.3 + h * 0.02);
  colors.push(c.r, c.g, c.b);
}

terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals();
scene.add(new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true })));

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const rand = seededRandom(77);
const buildings = [];

for (let i = 0; i < 6; i++) {
  let bx, bz;
  do {
    bx = Math.floor(rand() * (GRID - 10)) + 5;
    bz = Math.floor(rand() * (GRID - 10)) + 5;
  } while (heightMap[bz * GRID + bx] < 0.5);

  buildings.push({ x: bx, y: bz });

  const wx = (bx / GRID - 0.5) * SCALE;
  const wz = (bz / GRID - 0.5) * SCALE;
  const h = heightMap[bz * GRID + bx];

  const building = new THREE.Mesh(
    new THREE.BoxGeometry(2 + rand() * 2, 2 + rand() * 2, 2 + rand() * 2),
    new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.9 })
  );
  building.position.set(wx, h + 1.5, wz);
  scene.add(building);
}

const roadMap = new Float32Array(GRID * GRID);
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

    if (Math.abs(to.x - cx) > Math.abs(to.y - cy)) {
      cx += dx;
    } else {
      cy += dy;
    }
    path.push({ x: cx, y: cy });
  }

  for (const { x, y } of path) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) {
          roadMap[ny * GRID + nx] = Math.max(roadMap[ny * GRID + nx], 1);
        }
      }
    }
  }
}

const roadPositions = [];
for (let y = 0; y < GRID; y++) {
  for (let x = 0; x < GRID; x++) {
    if (roadMap[y * GRID + x] > 0) {
      const wx = (x / GRID - 0.5) * SCALE;
      const wz = (y / GRID - 0.5) * SCALE;
      const h = heightMap[y * GRID + x];
      roadPositions.push(new THREE.Vector3(wx, h + 0.05, wz));
    }
  }
}

if (roadPositions.length > 1) {
  const roadGeo = new THREE.BufferGeometry().setFromPoints(roadPositions);
  const roadMat = new THREE.PointsMaterial({ color: 0x8a7a5a, size: 0.3 });
  scene.add(new THREE.Points(roadGeo, roadMat));
}

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
sun.position.set(20, 30, 15);
scene.add(sun);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
```

运行后你会看到几栋建筑之间有褐色的道路相连。道路在地形上蜿蜒，绕过低洼区域，尽量走平缓的坡面。

## 道路的视觉增强

当前用点来渲染道路比较粗糙。更好的做法：
- 用三角形条带生成道路的几何体
- 道路颜色比周围地形略深
- 道路表面比地形略低（压平草地）
- 在道路交叉处加宽

## 练习

1. 修改代价函数，让水域的代价从 10 降到 3——观察道路是否开始穿越浅水区。
2. 在道路交叉点放置一个路标——用简单的圆柱体 + 球体组合。
3. 给道路添加"宽度变化"——交叉处宽，单条道路窄。

## 参考答案

### 练习 1
水域代价降低后，道路会开始穿越浅水区和小河，不再完全绕行。代价 = 3 时道路会选择"直穿小河但绕行大湖"的策略。

### 练习 2
在每条道路的中点或交叉点，放置一个细圆柱体（半径 0.05、高度 1.5）顶部加一个小球体。颜色用白色或黄色，模拟路标。

### 练习 3
用 roadMap 的值来决定宽度——值越大（多条道路交汇处），渲染的点越大或三角形条带越宽。
