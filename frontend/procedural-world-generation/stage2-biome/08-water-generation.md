# 水体生成——河流、湖泊、海洋的程序化生成

## 水是地形的灵魂

第一阶段我们在地形上放了一块平面作为海洋，但那太粗糙了。真实世界的水体有丰富的形态：蜿蜒的河流从山间流向大海，湖泊嵌在山谷中，瀑布从悬崖倾泻而下，地下水形成了洞穴中的暗河。

这节课要做的不是模拟流体力学——那是物理引擎的活。我们要用程序化方法"生成"看起来合理的水体。

## 海洋与湖泊

海洋已经用阈值解决了：高度低于某个值的区域就是水域。但湖泊需要额外逻辑——湖泊是被陆地包围的低洼区域。

```js
function findLakes(heightMap, size) {
  const seaLevel = 0;
  const visited = new Uint8Array(size * size);
  const lakes = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (visited[idx] || heightMap[idx] >= seaLevel) continue;

      const lake = [];
      const queue = [{ x, y }];
      let touchesEdge = false;

      while (queue.length > 0) {
        const { x: cx, y: cy } = queue.shift();
        const ci = cy * size + cx;

        if (visited[ci]) continue;
        visited[ci] = 1;

        if (cx === 0 || cx === size - 1 || cy === 0 || cy === size - 1) {
          touchesEdge = true;
        }

        lake.push({ x: cx, y: cy });

        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            const ni = ny * size + nx;
            if (!visited[ni] && heightMap[ni] < seaLevel) {
              queue.push({ x: nx, y: ny });
            }
          }
        }
      }

      if (!touchesEdge && lake.length > 5) {
        lakes.push(lake);
      }
    }
  }

  return lakes;
}
```

这个函数用洪水填充算法找到所有被陆地包围的低洼区域——那就是湖泊。`touchesEdge` 检查确保排除海洋（海洋会连接到地图边缘）。

## 河流生成

河流的核心约束：从高处流向低处，路径尽量蜿蜒但不会太曲折。

一种简单但有效的方法：在山顶随机选择源头，然后沿着最陡下降方向走，同时加一点随机偏移让路径蜿蜒。

```js
function generateRiver(startX, startY, heightMap, size) {
  const path = [{ x: startX, y: startY }];
  let x = startX, y = startY;

  for (let step = 0; step < 200; step++) {
    let bestX = x, bestY = y, bestH = heightMap[y * size + x];

    const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

      const h = heightMap[ny * size + nx];
      const jitter = (Math.random() - 0.5) * 0.3;

      if (h + jitter < bestH) {
        bestH = h;
        bestX = nx;
        bestY = ny;
      }
    }

    if (bestX === x && bestY === y) break;

    x = bestX;
    y = bestY;
    path.push({ x, y });

    if (heightMap[y * size + x] < 0) break;
  }

  return path;
}
```

## 河流对地形的影响

河流不只是水——它会侵蚀河床，形成 V 字形的峡谷。在生成河流路径后，把路径两侧的地形削低：

```js
function carveRiver(path, heightMap, size, width = 2, depth = 1.5) {
  for (const { x, y } of path) {
    for (let dy = -width; dy <= width; dy++) {
      for (let dx = -width; dx <= width; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > width) continue;

        const factor = 1 - dist / width;
        heightMap[ny * size + nx] -= depth * factor * factor;
      }
    }
  }
}
```

## 完整代码：带河流和湖泊的地形

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 40, 50);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const noise2D = createNoise2D();

function fbm(x, z, octaves = 5) {
  let value = 0, amplitude = 1, frequency = 1, maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxValue;
}

const SIZE = 100;
const SCALE = 60;
const heightMap = new Float32Array(SIZE * SIZE);

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const nx = x / SIZE - 0.5;
    const nz = y / SIZE - 0.5;
    heightMap[y * SIZE + x] = fbm(nx * 4, nz * 4) * 12;
  }
}

const rivers = [];
for (let i = 0; i < 5; i++) {
  let sx, sy;
  do {
    sx = Math.floor(Math.random() * (SIZE - 20)) + 10;
    sy = Math.floor(Math.random() * (SIZE - 20)) + 10;
  } while (heightMap[sy * SIZE + sx] < 5);

  const path = generateRiver(sx, sy, heightMap, SIZE);
  if (path.length > 20) {
    carveRiver(path, heightMap, SIZE, 2, 1.0);
    rivers.push(path);
  }
}

const geometry = new THREE.PlaneGeometry(SCALE, SCALE, SIZE - 1, SIZE - 1);
geometry.rotateX(-Math.PI / 2);

const colors = [];
const posAttr = geometry.attributes.position;

for (let i = 0; i < posAttr.count; i++) {
  const h = heightMap[i];
  posAttr.setY(i, h);

  const color = new THREE.Color();
  if (h < -0.5) {
    color.setHSL(0.6, 0.75, 0.15);
  } else if (h < 0) {
    color.setHSL(0.58, 0.6, 0.25);
  } else if (h < 2) {
    color.setHSL(0.28, 0.55, 0.32);
  } else if (h < 6) {
    const t = (h - 2) / 4;
    color.setHSL(0.28 - t * 0.12, 0.5, 0.32 + t * 0.1);
  } else {
    color.setHSL(0.1, 0.3, 0.5 + (h - 6) * 0.03);
  }
  colors.push(color.r, color.g, color.b);
}

geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
geometry.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
scene.add(new THREE.Mesh(geometry, terrainMat));

const waterGeo = new THREE.PlaneGeometry(SCALE, SCALE, 32, 32);
waterGeo.rotateX(-Math.PI / 2);
const waterMat = new THREE.MeshStandardMaterial({
  color: 0x1a6e8a,
  transparent: true,
  opacity: 0.5,
  roughness: 0.1,
  metalness: 0.2,
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.position.y = 0;
scene.add(water);

const riverPoints = [];
for (const path of rivers) {
  for (const { x, y } of path) {
    const wx = (x / SIZE - 0.5) * SCALE;
    const wz = (y / SIZE - 0.5) * SCALE;
    const wy = heightMap[y * SIZE + x] + 0.05;
    riverPoints.push(new THREE.Vector3(wx, wy, wz));
  }
}

if (riverPoints.length > 1) {
  const riverCurve = new THREE.CatmullRomCurve3(riverPoints);
  const riverGeo = new THREE.TubeGeometry(riverCurve, riverPoints.length * 2, 0.15, 4, false);
  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x2288aa,
    transparent: true,
    opacity: 0.7,
  });
  scene.add(new THREE.Mesh(riverGeo, riverMat));
}

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
sun.position.set(30, 40, 20);
scene.add(sun);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  water.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.08;
  controls.update();
  renderer.render(scene, camera);
}
animate();
```

运行后你会看到：
- 蓝色的海洋在低处
- 从山间蜿蜒而出的河流，流经绿色的平原
- 河流明显切入地形，形成浅浅的河谷
- 水面微微起伏

## 河流的视觉增强

用 `TubeGeometry` 渲染河流比较简单但不够真实。更好的方法是把河流区域的地形标记出来，在渲染时对河流区域使用特殊的水材质（反射、透明、流动纹理）。

实际项目中还会在河流的上游做窄、下游做宽——河流越远水量越大，河道越宽：

```js
const riverWidth = 0.3 + (step / path.length) * 0.8;
```

## 练习

1. 在河流入海口处放置一个三角洲——用多条分叉的短路径模拟。
2. 添加瀑布检测——如果河流路径上相邻两点高度差大于阈值，在该位置放置一个竖直的半透明平面。
3. 湖泊的水位应该等于湖底最深处的高度 + 一定偏移，而不是固定值 0。

## 参考答案

### 练习 1
在河流路径的最后 20% 处，随机分出 2-3 条支流，每条支流偏移一个小角度。分叉点的河道宽度减半，模拟三角洲的扇形展开。

### 练习 2
遍历河流路径，如果相邻两点的高度差 > 1.5，在高点放置一个竖直的半透明蓝色平面（PlaneGeometry），宽度等于河宽，高度等于落差。加上粒子效果模拟水花更好。

### 练习 3
在 `findLakes` 中记录每个湖泊的最低点高度，水位设为最低点 + 0.3。这样不同湖泊的水位不同，更自然。
