# 温度与湿度——气候模型、Biome 映射

## 为什么有了高度还不够

第一阶段生成的地形只有一种逻辑：高处是山，低处是水。但真实世界不是这样——同样海拔 2000 米的地方，可能是热带雨林，也可能是寒带针叶林，还可能是干旱的高原荒漠。决定地表长什么样的不只是高度，还有温度和湿度。

这节课要建立一个简单的气候模型，然后用温度+湿度+高度三个维度来决定每个点属于什么生物群落（Biome）。

## 温度模型

真实世界的温度受纬度和海拔影响。简化模型：

```js
function temperature(x, z, height) {
  const latitudeFactor = 1 - Math.abs(z / worldSize) * 0.8;
  const altitudeFactor = Math.max(0, 1 - height * 0.04);
  const noiseVariation = noise2D(x * 0.02, z * 0.02) * 0.1;
  return latitudeFactor * altitudeFactor + noiseVariation;
}
```

纬度越高（z 越大）温度越低，海拔越高温度越低。加一点噪声让温度分布不那么规则。

## 湿度模型

湿度主要受距离海洋远近影响，加一些局部变化：

```js
function moisture(x, z, height, distToSea) {
  const seaInfluence = Math.max(0, 1 - distToSea * 0.05);
  const altitudeInfluence = Math.max(0, 1 - height * 0.02);
  const noiseVariation = noise2D(x * 0.03 + 50, z * 0.03 + 50) * 0.2;
  return Math.max(0, Math.min(1, seaInfluence * altitudeInfluence + noiseVariation));
}
```

## Biome 映射表

Whittaker 图是最经典的生物群落分类方法——用温度和湿度两个轴来划分：

| | 干燥 | 中等 | 湿润 |
|---|---|---|---|
| **寒冷** | 冻原 | 针叶林 | 湿地 |
| **温带** | 草原 | 落叶林 | 温带雨林 |
| **炎热** | 沙漠 | 热带草原 | 热带雨林 |

```js
const BIOME = {
  DESERT:       { color: [0.76, 0.70, 0.50], name: '沙漠' },
  GRASSLAND:    { color: [0.50, 0.65, 0.25], name: '草原' },
  SAVANNA:      { color: [0.65, 0.60, 0.20], name: '热带草原' },
  TUNDRA:       { color: [0.70, 0.72, 0.68], name: '冻原' },
  BOREAL:       { color: [0.15, 0.35, 0.15], name: '针叶林' },
  TEMPERATE:    { color: [0.25, 0.50, 0.20], name: '落叶林' },
  TROPICAL:     { color: [0.10, 0.45, 0.10], name: '热带雨林' },
  WETLAND:      { color: [0.30, 0.45, 0.35], name: '湿地' },
  SNOW:         { color: [0.90, 0.92, 0.95], name: '雪地' },
};

function getBiome(temp, moisture, height) {
  if (height > 14) return BIOME.SNOW;
  if (height < 0) return BIOME.WETLAND;

  if (temp < 0.25) {
    return moisture > 0.5 ? BIOME.WETLAND : BIOME.TUNDRA;
  } else if (temp < 0.55) {
    if (moisture < 0.3) return BIOME.GRASSLAND;
    if (moisture < 0.65) return BIOME.TEMPERATE;
    return BIOME.BOREAL;
  } else {
    if (moisture < 0.25) return BIOME.DESERT;
    if (moisture < 0.5) return BIOME.SAVANNA;
    return BIOME.TROPICAL;
  }
}
```

## 完整代码：气候可视化

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

const BIOME = {
  DESERT:    { color: [0.76, 0.70, 0.50] },
  GRASSLAND: { color: [0.50, 0.65, 0.25] },
  SAVANNA:   { color: [0.65, 0.60, 0.20] },
  TUNDRA:    { color: [0.70, 0.72, 0.68] },
  BOREAL:    { color: [0.15, 0.35, 0.15] },
  TEMPERATE: { color: [0.25, 0.50, 0.20] },
  TROPICAL:  { color: [0.10, 0.45, 0.10] },
  WETLAND:   { color: [0.30, 0.45, 0.35] },
  SNOW:      { color: [0.90, 0.92, 0.95] },
};

function getBiome(temp, moisture, height) {
  if (height > 14) return BIOME.SNOW;
  if (height < 0) return BIOME.WETLAND;
  if (temp < 0.25) return moisture > 0.5 ? BIOME.WETLAND : BIOME.TUNDRA;
  if (temp < 0.55) {
    if (moisture < 0.3) return BIOME.GRASSLAND;
    if (moisture < 0.65) return BIOME.TEMPERATE;
    return BIOME.BOREAL;
  }
  if (moisture < 0.25) return BIOME.DESERT;
  if (moisture < 0.5) return BIOME.SAVANNA;
  return BIOME.TROPICAL;
}

const SIZE = 128;
const SCALE = 80;
const geometry = new THREE.PlaneGeometry(SCALE, SCALE, SIZE - 1, SIZE - 1);
geometry.rotateX(-Math.PI / 2);

const colors = [];
const posAttr = geometry.attributes.position;

for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i);
  const z = posAttr.getZ(i);

  const nx = x / SCALE;
  const nz = z / SCALE;

  const height = fbm(nx * 4, nz * 4) * 18;
  posAttr.setY(i, height);

  const temp = 1 - Math.abs(nz) * 0.8 + noise2D(nx * 2, nz * 2) * 0.1;
  const moisture = Math.max(0, Math.min(1,
    (1 - Math.abs(nx) * 0.5) * 0.6 + noise2D(nx * 3 + 50, nz * 3 + 50) * 0.2
  ));

  const biome = getBiome(temp, moisture, height);
  const c = biome.color;
  const h = height / 18;
  const shadow = 0.7 + h * 0.3;

  colors.push(c[0] * shadow, c[1] * shadow, c[2] * shadow);
}

geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
geometry.computeVertexNormals();

const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

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

运行后你会看到一个多彩的世界：中心偏热带（绿色），两极偏寒冷（灰白色），靠近边缘的干燥区域是沙漠色，山脊上是雪白色。不同颜色的边界是自然过渡的，因为温度和湿度是连续变化的。

## Biome 边界的平滑处理

直接用阈值划分 Biome 会导致颜色边界生硬。实际项目中会在边界区域做插值：

```js
function blendBiomes(biomeA, biomeB, t) {
  return [
    biomeA.color[0] * (1 - t) + biomeB.color[0] * t,
    biomeA.color[1] * (1 - t) + biomeB.color[1] * t,
    biomeA.color[2] * (1 - t) + biomeB.color[2] * t,
  ];
}
```

当温度或湿度接近阈值时，用相邻两个 Biome 的颜色做插值，让过渡更自然。

## 练习

1. 修改温度模型中的纬度系数，让热带区域更宽或更窄。
2. 添加一个新的 Biome："高山草甸"——海拔在 8-12 之间、温度在 0.3-0.5 的区域。
3. 把湿度模型改成以噪声为主（去掉海洋距离的影响），观察 Biome 分布是否变得更"斑块化"。

## 参考答案

### 练习 1
纬度系数从 0.8 改成 0.4 会让热带区域从南北纬 30° 扩展到 60°；改成 1.2 会让热带压缩到赤道附近很窄的带状区域。

### 练习 2
在 `getBiome` 函数中加一个条件：`if (height > 8 && height < 12 && temp > 0.3 && temp < 0.5) return BIOME.ALPLINE;`。高山草甸会在中等温度的山腰出现。

### 练习 3
去掉海洋距离后，湿度完全由噪声决定，Biome 分布会变得非常"斑块化"——沙漠旁边可能直接是雨林，没有过渡。这说明海洋距离对湿度建模很重要。
