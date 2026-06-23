# 地形特征——山峰、山谷、平原、海岸线的生成

## 从噪声到地形的鸿沟

前两节课我们生成了连续的噪声值并映射成高度，看起来已经像地形了。但仔细审视会发现：它缺少地形的"特征感"。真实的山有尖顶和缓坡的不对称，海岸线有锯齿状的海湾和半岛，冲积平原有河流切割出的蜿蜒谷地。

这些特征不是靠叠加更多噪声层就能自然涌现的。它们需要对噪声值做后处理——用数学函数"雕刻"出特定的地貌形态。

## 地形特征的生成策略

### 山峰：用指数函数让高处更高

平滑的噪声高度分布是均匀的，山峰不够突出。用指数函数可以"拉伸"高值区：

```js
function mountainShape(h) {
  return Math.pow(Math.max(h, 0), 1.5);
}
```

输入 h=0.5 时输出 0.35，h=0.8 时输出 0.72，h=1.0 时输出 1.0。高值区被拉伸，低值区被压缩——山顶更陡峭，山脚更平缓。

### 海岸线：用阈值 + 噪声制造锯齿

如果直接用高度=0 作为海岸线，会得到一条平滑的边界。真实海岸线是锯齿状的。解决办法是把阈值本身也变成噪声：

```js
const seaLevel = 0;
const coastNoise = noise2D(x * 10, z * 10) * 0.15;
const isLand = height > seaLevel + coastNoise;
```

海岸线在 `seaLevel ± coastNoise` 之间摆动，自然形成海湾和半岛。

### 平原：用 clamp 制造平坦区域

山脚和平原的过渡区往往是平缓的。用平滑的 clamp 函数可以"压平"低于某个阈值的区域：

```js
function plateau(h, threshold, blend) {
  const t = Math.max(0, (h - threshold + blend) / (2 * blend));
  return threshold - blend + t * 2 * blend * (1 - t) + h * t;
}
```

## 完整代码：特征化地形

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 50, 60);

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

function warpedNoise(x, z, strength = 0.6) {
  const wx = fbm(x, z) * strength;
  const wz = fbm(x + 5.2, z + 1.3) * strength;
  return fbm(x + wx, z + wz);
}

function terrainHeight(x, z) {
  let h = warpedNoise(x * 0.8, z * 0.8);

  const coastWarp = noise2D(x * 6, z * 6) * 0.12;
  const isLand = h > coastWarp;

  if (isLand) {
    h = Math.pow(Math.max(h - coastWarp, 0), 1.4) + coastWarp;
  } else {
    h = h * 0.3;
  }

  const flatness = fbm(x * 0.3 + 20, z * 0.3 + 20);
  if (flatness > 0.3 && h > coastWarp) {
    h = coastWarp + (h - coastWarp) * 0.4;
  }

  return h * 15;
}

function getTerrainColor(height, seaLevel) {
  const color = new THREE.Color();
  const h = height / 15;

  if (height < seaLevel - 2) {
    color.setHSL(0.6, 0.8, 0.15);
  } else if (height < seaLevel) {
    color.setHSL(0.58, 0.6, 0.25 + (h + 0.2) * 2);
  } else if (height < seaLevel + 1) {
    color.setHSL(0.35, 0.3, 0.7);
  } else if (height < 5) {
    color.setHSL(0.28, 0.55, 0.35);
  } else if (height < 9) {
    const t = (height - 5) / 4;
    color.setHSL(0.28 - t * 0.15, 0.5 - t * 0.2, 0.35 + t * 0.15);
  } else {
    const t = Math.min((height - 9) / 4, 1);
    color.setHSL(0.1, 0.15 + t * 0.1, 0.7 + t * 0.2);
  }

  return color;
}

const SIZE = 128;
const SEA_LEVEL = 0;
const geometry = new THREE.PlaneGeometry(80, 80, SIZE, SIZE);
geometry.rotateX(-Math.PI / 2);

const colors = [];
const posAttr = geometry.attributes.position;

for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i);
  const z = posAttr.getZ(i);

  const height = terrainHeight(x / 80, z / 80);
  posAttr.setY(i, height);

  const color = getTerrainColor(height, SEA_LEVEL);
  colors.push(color.r, color.g, color.b);
}

geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
geometry.computeVertexNormals();

const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

const waterGeo = new THREE.PlaneGeometry(80, 80);
waterGeo.rotateX(-Math.PI / 2);
const waterMat = new THREE.MeshStandardMaterial({
  color: 0x1a6e8a,
  transparent: true,
  opacity: 0.6,
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.position.y = SEA_LEVEL;
scene.add(water);

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(20, 30, 15);
scene.add(dirLight);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
```

运行后你会看到一个有明确特征的地形：深蓝色的海洋、浅蓝色的浅水区、米白色的沙滩、绿色的植被区、棕色的山腰、白色的山顶。海岸线是锯齿状的，有些地方伸入海中形成半岛，有些地方凹入形成海湾。

## 特征组合的顺序很重要

先做海岸线变形，再做山峰拉伸，最后做平原压平。顺序反过来效果会完全不同——如果先压平再做海岸线，平原区域会被海岸线噪声破坏。

这种"后处理管线"的思路在程序化生成中非常常见：先生成基础值，再逐步施加变换，每一步都让地形更接近目标形态。

## 练习

1. 去掉 `flatness` 相关的平原生成代码，观察地形是否变得"到处都是山"。
2. 把 `coastWarp` 的频率从 6 改成 20，看海岸线是否变得更碎。
3. 添加一个"河谷"特征：用一维噪声定义一条蜿蜒的路径，路径附近的高度降低。

## 参考答案

### 练习 1
去掉平原代码后，地形确实到处是山——即使低处也有明显起伏。真实世界中平原占很大比例，这个对比说明了为什么需要"压平"处理。

### 练习 2
频率提高后海岸线变得更碎、更锯齿状，出现很多小岛屿和狭窄的海湾。频率太低则海岸线过于平滑，失去了自然感。通常 4~10 是比较好的范围。

### 练习 3
河谷可以用 `const riverPath = noise2D(z * 0.1, 0) * 20` 定义一条蜿蜒的路径，然后 `const distToRiver = Math.abs(x - riverPath)` 计算到路径的距离，距离小于某个值时降低高度。这在第 8 课"水体生成"会详细展开。
