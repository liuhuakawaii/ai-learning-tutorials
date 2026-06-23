# 洞穴系统——Cellular Automata、3D 洞穴网络

## 为什么噪声不能直接生成洞穴

前面的课程用噪声生成地形——连续、平滑、有起伏。但洞穴不是这样的。洞穴有明确的"有"和"没有"的边界，内部是空腔，外面是岩石。如果用噪声阈值来生成洞穴，得到的是海绵状的多孔结构，而不是有通道和大厅的真实洞穴。

Cellular Automata（细胞自动机）天然适合这种场景——它在二值网格上运作，通过简单的局部规则产生复杂的全局结构。

## 细胞自动机的基本规则

细胞自动机的核心思想：每个格子的下一个状态只取决于它自己和邻居的状态。

对于洞穴生成，规则很简单：
- 如果一个格子周围有超过 4 个邻居是"岩石"，它也变成"岩石"
- 如果周围少于 4 个邻居是"岩石"，它变成"空腔"
- 等于 4 个时保持不变

经过几轮迭代后，松散的随机噪声会"凝聚"成大块的岩石和大块的空腔，边界变得清晰——这就是洞穴。

```js
function initializeCave(width, height, fillProbability = 0.45) {
  const grid = new Uint8Array(width * height);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = Math.random() < fillProbability ? 1 : 0;
  }

  grid[0] = grid[width - 1] = 1;
  grid[(height - 1) * width] = grid[height * width - 1] = 1;

  return grid;
}

function countNeighbors(grid, x, y, width, height) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        count++;
      } else {
        count += grid[ny * width + nx];
      }
    }
  }
  return count;
}

function stepCave(grid, width, height) {
  const next = new Uint8Array(grid.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const neighbors = countNeighbors(grid, x, y, width, height);
      const idx = y * width + x;
      if (neighbors > 4) next[idx] = 1;
      else if (neighbors < 4) next[idx] = 0;
      else next[idx] = grid[idx];
    }
  }
  return next;
}

function generateCave(width, height, iterations = 5) {
  let grid = initializeCave(width, height);
  for (let i = 0; i < iterations; i++) {
    grid = stepCave(grid, width, height);
  }
  return grid;
}
```

## 从 2D 到 3D：洞穴网络

2D 洞穴是一层切片。要生成 3D 洞穴，有两种思路：

### 思路 1：叠加 2D 切片

把多个 2D 洞穴层堆叠起来，中间用噪声做垂直偏移，让洞穴在垂直方向上也有变化。

### 思路 2：3D 细胞自动机

直接在三维网格上运行细胞自动机。规则类似，但邻居从 8 个变成 26 个：

```js
function countNeighbors3D(grid, x, y, z, sx, sy, sz) {
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
  return count;
}
```

## 完整代码：3D 洞穴可视化

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(25, 20, 25);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const SX = 30, SY = 15, SZ = 30;
const FILL = 0.42;
const ITERATIONS = 5;

let grid = new Uint8Array(SX * SY * SZ);
for (let i = 0; i < grid.length; i++) {
  grid[i] = Math.random() < FILL ? 1 : 0;
}

for (let iter = 0; iter < ITERATIONS; iter++) {
  const next = new Uint8Array(grid.length);
  for (let z = 0; z < SZ; z++) {
    for (let y = 0; y < SY; y++) {
      for (let x = 0; x < SX; x++) {
        let count = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0 && dz === 0) continue;
              const nx = x + dx, ny = y + dy, nz = z + dz;
              if (nx < 0 || nx >= SX || ny < 0 || ny >= SY || nz < 0 || nz >= SZ) {
                count++;
              } else {
                count += grid[nz * SY * SX + ny * SX + nx];
              }
            }
          }
        }
        const idx = z * SY * SX + y * SX + x;
        if (count > 13) next[idx] = 1;
        else if (count < 13) next[idx] = 0;
        else next[idx] = grid[idx];
      }
    }
  }
  grid = next;
}

const geometry = new THREE.BoxGeometry(1, 1, 1);
const rockMaterial = new THREE.MeshStandardMaterial({
  color: 0x665544,
  roughness: 0.9,
  metalness: 0.05,
});

const instancedMesh = new THREE.InstancedMesh(geometry, rockMaterial, grid.reduce((a, b) => a + b, 0));
let instanceIndex = 0;
const matrix = new THREE.Matrix4();

for (let z = 0; z < SZ; z++) {
  for (let y = 0; y < SY; y++) {
    for (let x = 0; x < SX; x++) {
      if (grid[z * SY * SX + y * SX + x] === 1) {
        let hasAir = false;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) !== 1) continue;
              const nx = x + dx, ny = y + dy, nz = z + dz;
              if (nx < 0 || nx >= SX || ny < 0 || ny >= SY || nz < 0 || nz >= SZ) {
                hasAir = true;
              } else if (grid[nz * SY * SX + ny * SX + nx] === 0) {
                hasAir = true;
              }
            }
          }
        }

        if (hasAir) {
          matrix.setPosition(x - SX / 2, y, z - SZ / 2);
          instancedMesh.setMatrixAt(instanceIndex, matrix);
          instanceIndex++;
        }
      }
    }
  }
}

instancedMesh.instanceMatrix.needsUpdate = true;
instancedMesh.count = instanceIndex;
scene.add(instancedMesh);

scene.add(new THREE.AmbientLight(0x334455, 0.4));
const torch = new THREE.PointLight(0xff8833, 1.5, 30);
torch.position.set(0, 8, 0);
scene.add(torch);

const torch2 = new THREE.PointLight(0x3366ff, 1.0, 25);
torch2.position.set(10, 5, 10);
scene.add(torch2);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  torch.intensity = 1.2 + Math.sin(t * 3) * 0.3;
  controls.update();
  renderer.render(scene, camera);
}
animate();
```

运行后你会看到一个 3D 洞穴系统：大块的岩石中间有通道和大厅相连。两个点光源模拟火把，光线在洞穴中摇曳，创造出幽暗神秘的氛围。

## 关键参数的影响

| 参数 | 偏低 | 偏高 |
|------|------|------|
| fillProbability | 空腔太多，没有洞穴感 | 岩石太多，通道太窄 |
| iterations | 边界模糊，像海绵 | 边界清晰但结构简单 |
| neighbor threshold | 洞穴更大更开阔 | 洞穴更窄更曲折 |

## 练习

1. 把 `FILL` 从 0.42 改成 0.35 和 0.55，观察洞穴结构的变化。
2. 在洞穴底部添加一层"地板"——用噪声生成的高度覆盖最下面两层。
3. 把点光源的颜色改成暖黄色，模拟真实火把的光晕。

## 参考答案

### 练习 1
FILL=0.35 时洞穴非常开阔，几乎全是大厅；FILL=0.55 时通道很窄，有些地方甚至堵死了。0.42-0.48 是比较好的平衡点。

### 练习 2
在初始化后遍历最下面两层，把所有格子设为 1（岩石），然后在上面用噪声扰动边界。这样洞穴有了不平的地面，更真实。

### 练习 3
把 PointLight 的 color 从 `0xff8833` 改成 `0xffaa44`，再加一个同色的低强度环境光。火把的颜色偏暖橙色比偏红色更自然。
