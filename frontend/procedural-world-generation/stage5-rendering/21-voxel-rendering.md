# 体素渲染——Marching Cubes、Greedy Meshing

## 从方块到曲面

前面的课程用 BoxGeometry 一个一个方块地渲染体素世界。这在 Minecraft 风格中没问题，但如果你想让地形表面更光滑呢？或者想让洞穴的墙壁有自然的弧度？

Marching Cubes 算法可以把体素数据转换成平滑的三角面网格。它的工作原理是：遍历每个体素格子，根据格子 8 个顶点的"有/没有"状态，查表生成一组三角形。

## Marching Cubes 的核心

每个体素格子有 8 个顶点，每个顶点有两种状态（在表面内/外），总共 256 种组合。每种组合对应一组预定义的三角形。实际实现中用一个查找表来存储这 256 种情况。

```js
const EDGE_TABLE = new Uint16Array(256);
const TRI_TABLE = new Int16Array(256 * 16);

function marchingCubes(volume, sx, sy, sz, isoLevel) {
  const vertices = [];
  const normals = [];

  for (let z = 0; z < sz - 1; z++) {
    for (let y = 0; y < sy - 1; y++) {
      for (let x = 0; x < sx - 1; x++) {
        const corners = [
          volume[z * sy * sx + y * sx + x],
          volume[z * sy * sx + y * sx + x + 1],
          volume[(z + 1) * sy * sx + y * sx + x + 1],
          volume[(z + 1) * sy * sx + y * sx + x],
          volume[z * sy * sx + (y + 1) * sx + x],
          volume[z * sy * sx + (y + 1) * sx + x + 1],
          volume[(z + 1) * sy * sx + (y + 1) * sx + x + 1],
          volume[(z + 1) * sy * sx + (y + 1) * sx + x],
        ];

        let cubeIndex = 0;
        for (let i = 0; i < 8; i++) {
          if (corners[i] < isoLevel) cubeIndex |= (1 << i);
        }

        if (EDGE_TABLE[cubeIndex] === 0) continue;

        const vertList = new Array(12);
        const edge = EDGE_TABLE[cubeIndex];

        const cornerPositions = [
          [x, y, z], [x+1, y, z], [x+1, y, z+1], [x, y, z+1],
          [x, y+1, z], [x+1, y+1, z], [x+1, y+1, z+1], [x, y+1, z+1],
        ];

        const edgePairs = [
          [0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7],
        ];

        for (let i = 0; i < 12; i++) {
          if (edge & (1 << i)) {
            const [a, b] = edgePairs[i];
            const t = (isoLevel - corners[a]) / (corners[b] - corners[a]);
            const pa = cornerPositions[a], pb = cornerPositions[b];
            vertList[i] = [
              pa[0] + (pb[0] - pa[0]) * t,
              pa[1] + (pb[1] - pa[1]) * t,
              pa[2] + (pb[2] - pa[2]) * t,
            ];
          }
        }

        const triRow = cubeIndex * 16;
        for (let i = 0; TRI_TABLE[triRow + i] !== -1; i += 3) {
          for (let j = 0; j < 3; j++) {
            const v = vertList[TRI_TABLE[triRow + i + j]];
            vertices.push(v[0], v[1], v[2]);
          }
        }
      }
    }
  }

  return new Float32Array(vertices);
}
```

## Greedy Meshing：减少三角形数量

Marching Cubes 生成的网格有大量冗余——平面上的每个体素格子都生成了三角形，但一个大面片只需要两个三角形就够了。

Greedy Meshing 的思路是：合并相邻的、共面的、相同类型的面片。

```js
function greedyMesh(volume, sx, sy, sz, isoLevel) {
  const quads = [];

  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;

    const size = [sx, sy, sz];
    const pos = [0, 0, 0];
    const mask = new Int8Array(size[u] * size[v]);

    pos[axis] = -1;
    while (++pos[axis] < size[axis] - 1) {
      let n = 0;
      for (pos[v] = 0; pos[v] < size[v]; pos[v]++) {
        for (pos[u] = 0; pos[u] < size[u]; pos[u]++) {
          const a = volume[pos[2] * sy * sx + pos[1] * sx + pos[0]] < isoLevel;
          const b = volume[(pos[2] + (axis === 2 ? 1 : 0)) * sy * sx +
                           (pos[1] + (axis === 1 ? 1 : 0)) * sx +
                           (pos[0] + (axis === 0 ? 1 : 0))] < isoLevel;
          mask[n++] = a === b ? 0 : a ? -1 : 1;
        }
      }

      n = 0;
      for (let j = 0; j < size[v]; j++) {
        for (let i = 0; i < size[u];) {
          const c = mask[n];
          if (c !== 0) {
            let w = 1;
            while (i + w < size[u] && mask[n + w] === c) w++;

            let h = 1;
            let done = false;
            while (j + h < size[v] && !done) {
              for (let k = 0; k < w; k++) {
                if (mask[n + h * size[u] + k] !== c) { done = true; break; }
              }
              if (!done) h++;
            }

            pos[u] = i; pos[v] = j;
            const du = [0, 0, 0]; du[u] = w;
            const dv = [0, 0, 0]; dv[v] = h;
            quads.push({ pos: [...pos], du, dv, normal: axis, dir: c });
            for (let l = 0; l < h; l++)
              for (let k = 0; k < w; k++)
                mask[n + l * size[u] + k] = 0;

            i += w; n += w;
          } else {
            i++; n++;
          }
        }
      }
    }
  }

  return quads;
}
```

## 完整代码：体素地形的平滑渲染

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(20, 25, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const noise2D = createNoise2D();

function fbm(x, z) {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < 4; i++) {
    v += noise2D(x * f, z * f) * a;
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

const SIZE = 32;
const volume = new Float32Array(SIZE * SIZE * SIZE);

for (let z = 0; z < SIZE; z++) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const wx = x / SIZE, wz = z / SIZE;
      const terrainH = (fbm(wx * 3, wz * 3) * 0.5 + 0.5) * SIZE * 0.6;
      const density = (terrainH - y) / SIZE;
      const cave = fbm(wx * 5 + 100, y / SIZE * 5) * 0.3;
      volume[z * SIZE * SIZE + y * SIZE + x] = density + cave;
    }
  }
}

function getNormal(volume, x, y, z, sx, sy, sz) {
  const idx = (i, j, k) => volume[k * sy * sx + j * sx + i];
  const nx = (x > 0 ? idx(x-1,y,z) : 0) - (x < sx-1 ? idx(x+1,y,z) : 0);
  const ny = (y > 0 ? idx(x,y-1,z) : 0) - (y < sy-1 ? idx(x,y+1,z) : 0);
  const nz = (z > 0 ? idx(x,y,z-1) : 0) - (z < sz-1 ? idx(x,y,z+1) : 0);
  const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
  return [nx/len, ny/len, nz/len];
}

const vertices = [];
const colors = [];
const isoLevel = 0.0;

for (let z = 0; z < SIZE - 1; z++) {
  for (let y = 0; y < SIZE - 1; y++) {
    for (let x = 0; x < SIZE - 1; x++) {
      const corners = [
        volume[z*SIZE*SIZE + y*SIZE + x],
        volume[z*SIZE*SIZE + y*SIZE + x+1],
        volume[(z+1)*SIZE*SIZE + y*SIZE + x+1],
        volume[(z+1)*SIZE*SIZE + y*SIZE + x],
        volume[z*SIZE*SIZE + (y+1)*SIZE + x],
        volume[z*SIZE*SIZE + (y+1)*SIZE + x+1],
        volume[(z+1)*SIZE*SIZE + (y+1)*SIZE + x+1],
        volume[(z+1)*SIZE*SIZE + (y+1)*SIZE + x],
      ];

      let cubeIndex = 0;
      for (let i = 0; i < 8; i++) {
        if (corners[i] < isoLevel) cubeIndex |= (1 << i);
      }

      if (cubeIndex === 0 || cubeIndex === 255) continue;

      const edgePairs = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
      const cp = [[x,y,z],[x+1,y,z],[x+1,y,z+1],[x,y,z+1],[x,y+1,z],[x+1,y+1,z],[x+1,y+1,z+1],[x,y+1,z+1]];

      const vertList = [];
      for (let i = 0; i < 12; i++) {
        if (EDGE_TABLE[cubeIndex] & (1 << i)) {
          const [a, b] = edgePairs[i];
          const t = (isoLevel - corners[a]) / (corners[b] - corners[a]);
          vertList.push([
            cp[a][0] + (cp[b][0] - cp[a][0]) * t,
            cp[a][1] + (cp[b][1] - cp[a][1]) * t,
            cp[a][2] + (cp[b][2] - cp[a][2]) * t,
          ]);
        } else {
          vertList.push(null);
        }
      }

      for (let i = 0; TRI_TABLE[cubeIndex * 16 + i] !== -1; i += 3) {
        for (let j = 0; j < 3; j++) {
          const v = vertList[TRI_TABLE[cubeIndex * 16 + i + j]];
          vertices.push(v[0], v[1], v[2]);

          const n = getNormal(volume, Math.floor(v[0]), Math.floor(v[1]), Math.floor(v[2]), SIZE, SIZE, SIZE);
          const h = v[1] / SIZE;
          const c = new THREE.Color();
          if (h < 0.3) c.setHSL(0.28, 0.5, 0.3);
          else if (h < 0.6) c.setHSL(0.2, 0.4, 0.35);
          else c.setHSL(0.08, 0.3, 0.5);
          c.multiplyScalar(0.5 + n[1] * 0.5);
          colors.push(c.r, c.g, c.b);
        }
      }
    }
  }
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
geometry.computeVertexNormals();

const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

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

运行后你会看到一个平滑的体素地形——不再是方块堆叠，而是有自然弧度的山丘和凹陷的洞穴。表面颜色根据法线方向变化，模拟光照效果。

## EDGE_TABLE 和 TRI_TABLE

上面代码中用到了 `EDGE_TABLE` 和 `TRI_TABLE`，这两个查找表有 256 个条目。完整的表太长了，实际项目中通常从文件导入或用算法生成。Paul Bourke 的经典实现是最常用的参考：http://paulbourke.net/geometry/polygonise/

## 练习

1. 把 `isoLevel` 从 0.0 改成 -0.2 和 0.2，观察表面位置的变化。
2. 在 Marching Cubes 的输出上计算每个顶点的法线，用 `flatShading: false` 看平滑光照效果。
3. 对比 Marching Cubes 和 Greedy Meshing 的三角形数量——Greedy Meshing 通常能减少 80% 以上的三角形。

## 参考答案

### 练习 1
isoLevel 越小，表面越往"内"收缩——地形变得更瘦削；isoLevel 越大，表面越往外膨胀——地形变得更臃肿。这相当于调整"等值面"的位置。

### 练习 2
在顶点着色中，对每个顶点计算周围体素的梯度向量作为法线。`flatShading: false` 时 Three.js 会自动插值法线，表面看起来更光滑。

### 练习 3
对于一个 32³ 的平面上层，Marching Cubes 可能生成约 10 万个三角形，Greedy Meshing 可以减少到 2 万个以下。但 Greedy Meshing 的实现复杂度更高。
