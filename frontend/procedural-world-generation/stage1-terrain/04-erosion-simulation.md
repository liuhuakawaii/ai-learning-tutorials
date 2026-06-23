# 侵蚀模拟——热力侵蚀、水力侵蚀的简化实现

## 为什么生成的地形看起来"假"

前面三节课生成的地形有高度变化、有区域特征、有海岸线，但总觉得少了点什么。仔细对比真实地形照片会发现：我们的山太"圆润"了，没有棱角分明的山脊，没有陡峭的悬崖，山坡上也没有冲沟。

这是噪声生成地形的根本局限——噪声本质上是平滑的，它生成的地形处处可微。但真实地形经历过数百万年的侵蚀：雨水冲刷出沟壑，重力让松散物质滑落，河流切割出峡谷。这些过程在地形上留下了"不平滑"的痕迹。

侵蚀模拟就是用算法模拟这些自然过程，让噪声生成的地形变得更真实。

## 热力侵蚀：最简单的侵蚀模型

热力侵蚀的规则非常简单：如果一个点和相邻点的高度差超过某个阈值，就把高的地方"削"一点，低的地方"填"一点。

这模拟的是重力作用下松散物质（沙土、碎石）的滑落。效果是：陡峭的山坡变缓，山谷被填平，地形整体变得更"圆润"。

```js
function thermalErosion(heightMap, size, iterations = 50) {
  const talus = 0.01;

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const idx = y * size + x;
        const h = heightMap[idx];

        const neighbors = [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
        ];

        for (const { dx, dy } of neighbors) {
          const ni = (y + dy) * size + (x + dx);
          const diff = h - heightMap[ni];

          if (diff > talus) {
            const transfer = diff * 0.25;
            heightMap[idx] -= transfer;
            heightMap[ni] += transfer;
          }
        }
      }
    }
  }

  return heightMap;
}
```

运行几次迭代后，原本尖锐的山峰会变钝，陡峭的山坡会出现阶梯状的"梯田"——这正是热力侵蚀的特征。

## 水力侵蚀：更复杂的模拟

水力侵蚀模拟的是雨水从山顶流下、携带泥沙、最终汇入河流的过程。简化版本包含四个步骤：

1. **降雨**：每个点增加少量水
2. **流动**：水从高处流向低处
3. **侵蚀**：水流带走高处的泥沙
4. **沉积**：水流变慢时泥沙沉积

```js
function hydraulicErosion(heightMap, size, drops = 10000) {
  for (let d = 0; d < drops; d++) {
    let x = Math.random() * (size - 2) + 1;
    let y = Math.random() * (size - 2) + 1;

    let sediment = 0;
    let water = 1;
    let vx = 0, vy = 0;

    for (let step = 0; step < 64; step++) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const idx = iy * size + ix;

      const fx = x - ix;
      const fy = y - iy;

      const h00 = heightMap[idx];
      const h10 = heightMap[idx + 1];
      const h01 = heightMap[idx + size];
      const h11 = heightMap[idx + size + 1];

      const gx = (h10 - h00) * (1 - fy) + (h11 - h01) * fy;
      const gy = (h01 - h00) * (1 - fx) + (h11 - h10) * fx;

      vx = vx * 0.9 - gx * 50;
      vy = vy * 0.9 - gy * 50;

      const len = Math.sqrt(vx * vx + vy * vy);
      if (len < 0.001) break;

      vx /= len;
      vy /= len;

      x += vx * 0.1;
      y += vy * 0.1;

      if (x < 1 || x >= size - 2 || y < 1 || y >= size - 2) break;

      const newIdx = Math.floor(y) * size + Math.floor(x);
      const newH = heightMap[newIdx];
      const oldH = heightMap[idx];

      const hDiff = newH - oldH;

      if (hDiff > 0) {
        const deposit = Math.min(sediment, hDiff);
        sediment -= deposit;
        heightMap[idx] += deposit;
      } else {
        const erosion = Math.min(-hDiff, water * 0.1);
        sediment += erosion;
        heightMap[newIdx] -= erosion;
      }

      water *= 0.99;
    }

    const finalIdx = Math.floor(y) * size + Math.floor(x);
    heightMap[finalIdx] += sediment;
  }

  return heightMap;
}
```

## 完整代码：侵蚀前后对比

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

const SIZE = 64;
const heightMap = new Float32Array(SIZE * SIZE);

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const nx = x / SIZE;
    const nz = y / SIZE;
    heightMap[y * SIZE + x] = fbm(nx * 4, nz * 4) * 10;
  }
}

const beforeMap = new Float32Array(heightMap);
thermalErosion(heightMap, SIZE, 30);
hydraulicErosion(heightMap, SIZE, 5000);
const afterMap = heightMap;

function createTerrainMesh(map, offsetX) {
  const geo = new THREE.PlaneGeometry(30, 30, SIZE - 1, SIZE - 1);
  geo.rotateX(-Math.PI / 2);

  const colors = [];
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const gx = Math.floor((i % SIZE));
    const gy = Math.floor(i / SIZE);
    const idx = gy * SIZE + gx;
    const h = map[idx];

    pos.setY(i, h);

    const t = h / 10;
    const color = new THREE.Color();
    color.setHSL(0.3 - t * 0.25, 0.5, 0.3 + t * 0.3);
    colors.push(color.r, color.g, color.b);
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.x = offsetX;
  return mesh;
}

scene.add(createTerrainMesh(beforeMap, -18));
scene.add(createTerrainMesh(afterMap, 18));

const label = document.createElement('div');
label.style.cssText = 'position:fixed;top:10px;left:0;right:0;text-align:center;color:white;font-size:18px;';
label.textContent = '左：侵蚀前  |  右：侵蚀后';
document.body.appendChild(label);

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
```

运行后左右两个地形并排显示：左边是原始噪声地形，右边是侵蚀后的地形。侵蚀后的地形山坡更缓，山谷更明显，整体更接近真实地貌。

## 侵蚀的代价

侵蚀模拟是计算密集型的。热力侵蚀需要遍历整个网格多次，水力侵蚀需要模拟成千上万滴水的轨迹。对于 64×64 的网格还算快，但 256×256 就需要明显的时间了。

实际项目中的策略：
- 预计算：在世界生成时一次性完成，结果缓存到 Chunk 中
- 降采样：在低分辨率网格上做侵蚀，再插值到高分辨率
- 只侵蚀可见区域：玩家附近的地形做完整侵蚀，远处的跳过

## 练习

1. 把热力侵蚀的 `talus` 从 0.01 改成 0.1，观察地形变化是否更剧烈。
2. 增加水力侵蚀的 `drops` 从 5000 到 20000，看山谷是否更深更明显。
3. 在水力侵蚀中记录每滴水的路径，用线条可视化这些路径——你会看到河流网络自然涌现。

## 参考答案

### 练习 1
talus 增大后，更多的点会被侵蚀——不仅陡峭的山坡，连中等坡度的区域也会被"削平"。结果是地形变得更平坦，失去了很多细节。

### 练习 2
更多的水滴意味着更多的侵蚀。山谷会更深更宽，山坡上会出现更多细小的冲沟。但到某个点后效果会饱和——地形已经被侵蚀到接近"平衡态"了。

### 练习 3
记录水滴路径后，你会看到树枝状的河流网络从山顶延伸到低洼处。这是水力侵蚀最迷人的副产品——不需要单独生成河流，河流会自然涌现。
