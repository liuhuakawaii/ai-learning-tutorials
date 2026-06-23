# 噪声基础——Perlin/Simplex/Worley 噪声的工程实现

## 这节课解决什么问题

程序化生成的起点是噪声。没有噪声，生成的世界就是平板一块。但噪声不是"随机"——随机数生成的图案充满锯齿和噪点，而 Perlin 噪声生成的是连续、平滑、有"山丘感"的值场。

这节课要搞清楚三件事：
- 噪声和随机数的本质区别
- 三种常用噪声各自适合什么场景
- 如何在 Three.js 里把噪声值变成可视化的地形

## 从随机数到噪声

先看一个反直觉的事实：`Math.random()` 生成的值在空间上完全不相关。把随机数铺成二维网格，每个格子的值和相邻格子毫无关系。这在生成地形时意味着：左边是海拔 8000 米的山峰，右边可能就是海拔 -2000 米的海沟。

Perlin 噪声的核心思路是在每个格点分配一个梯度向量，然后用插值函数平滑过渡。结果是：相邻点的值高度相关，但相距较远的点逐渐失去相关性。这恰好模拟了自然界中"局部连续、整体变化"的特征。

## 三种噪声的适用场景

| 噪声类型 | 视觉特征 | 典型用途 |
|---------|---------|---------|
| Perlin | 平滑的山丘状起伏 | 地形高度、云层密度 |
| Simplex | 类似 Perlin，但计算更快，无方向伪影 | 实时生成、GPU 着色器 |
| Worley (Cell) | 蜂窝状、有明确的细胞边界 | 岩石纹理、皮肤毛孔、熔岩 |

## 代码：用 Three.js 可视化 Perlin 噪声

下面的代码在平面上用 Perlin 噪声生成高度图，通过颜色映射让值的变化肉眼可见。

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

const SIZE = 64;
const geometry = new THREE.PlaneGeometry(40, 40, SIZE, SIZE);
geometry.rotateX(-Math.PI / 2);

const colors = [];
const posAttr = geometry.attributes.position;

for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i);
  const z = posAttr.getZ(i);

  const nx = x / 40;
  const nz = z / 40;
  const height = noise2D(nx * 4, nz * 4) * 5;

  posAttr.setY(i, height);

  const t = (height + 5) / 10;
  const color = new THREE.Color();
  color.setHSL(0.3 - t * 0.3, 0.6, 0.3 + t * 0.4);
  colors.push(color.r, color.g, color.b);
}

geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
geometry.computeVertexNormals();

const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

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

运行后你会看到一个高低起伏的彩色平面——低处偏绿（像草地），高处偏黄（像山顶）。颜色是通过高度值做 HSL 映射得到的。

## 多层叠加：让地形更自然

单层噪声太平滑，真实地形有大轮廓也有小细节。解决办法是叠加多层噪声，每层频率加倍、振幅减半——这就是分形噪声（fBm）：

```js
function fbm(x, z, octaves = 4) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}
```

把上面代码中的 `noise2D(nx * 4, nz * 4)` 替换为 `fbm(nx * 4, nz * 4)`，地形会立刻变得丰富——大山上有小山丘，小山丘上还有更小的褶皱。

## 练习

1. 把 `octaves` 从 4 改成 8，观察地形细节的变化。再改成 1，对比单层噪声。
2. 将噪声类型换成 Worley 噪声（`simplex-noise` 库也提供了 `createNoise2D` 的变体），看看蜂窝状图案在地形上是什么效果。
3. 尝试修改 `persistence`（振幅衰减率）从 0.5 改成 0.7，观察地形是否变得更"粗糙"。

## 参考答案

### 练习 1
octaves=1 时地形非常平滑，像被磨平的沙丘；octaves=8 时会出现很多细小褶皱，视觉上更接近真实山地，但计算量也翻倍。实际项目中 4-6 层是比较好的平衡点。

### 练习 2
Worley 噪声生成的地形会出现明显的"细胞边界"——像干裂的河床或龟裂的岩石。它不适合做自然地形，但非常适合做岩石表面、爬行动物皮肤等有明确边界的纹理。

### 练习 3
persistence=0.7 时高频层的振幅衰减更慢，意味着细节（小山丘、小褶皱）对最终高度的贡献更大，地形看起来更"毛糙"。persistence=0.3 时地形会更圆润平滑。
