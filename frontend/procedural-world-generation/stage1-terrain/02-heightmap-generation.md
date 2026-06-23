# 高度图生成——多层噪声叠加、Domain Warping

## 为什么单层噪声不够

上节课我们用分形噪声叠加出了有细节的地形，但仔细看会发现一个问题：地形太"均匀"了。每一处的山丘密度、起伏幅度都差不多，像是用同一个模具反复印出来的。

真实地形不是这样的。真实地形有"区域特征"——这片区域是连绵的山丘，那片区域是平坦的冲积平原，中间可能还有一条蜿蜒的河谷。这种区域级别的变化，靠叠加更多噪声层解决不了，因为 fBm 的每一层都是全局均匀的。

Domain Warping 的思路是：在采样噪声之前，先用另一组噪声把采样坐标"扭曲"掉。这样原本规则的噪声网格就被拉伸、弯曲、折叠，自然产生了区域性的特征差异。

## Domain Warping 的直觉

想象你在一张橡胶薄膜上画了一个规则的网格，然后用手从不同方向拉扯薄膜。网格上的线条就不再平行了——有的地方被挤压，有的地方被拉伸。如果你在这个变形后的网格上再画一层噪声，那噪声就会跟着变形，出现原本不存在的大尺度结构。

数学上就是：

```
扭曲后的x = x + noise(x, z) * warpStrength
扭曲后的z = z + noise(x + 100, z + 100) * warpStrength
最终高度 = fbm(扭曲后的x, 扭曲后的z)
```

注意第二个噪声的坐标加了 100 的偏移——这是为了避免两组噪声完全相关。

## 完整代码：带 Domain Warping 的地形

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

function warpedNoise(x, z, warpStrength = 0.5) {
  const wx = fbm(x + 0.0, z + 0.0) * warpStrength;
  const wz = fbm(x + 5.2, z + 1.3) * warpStrength;
  return fbm(x + wx, z + wz);
}

const SIZE = 128;
const geometry = new THREE.PlaneGeometry(60, 60, SIZE, SIZE);
geometry.rotateX(-Math.PI / 2);

const colors = [];
const posAttr = geometry.attributes.position;

for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i);
  const z = posAttr.getZ(i);

  const nx = x / 60;
  const nz = z / 60;
  const height = warpedNoise(nx * 3, nz * 3, 0.8) * 12;

  posAttr.setY(i, height);

  const t = (height + 12) / 24;
  const color = new THREE.Color();
  if (t < 0.3) {
    color.setHSL(0.58, 0.7, 0.25 + t * 0.5);
  } else if (t < 0.6) {
    color.setHSL(0.35 - (t - 0.3) * 0.5, 0.5, 0.35 + (t - 0.3) * 0.3);
  } else {
    color.setHSL(0.1, 0.3, 0.5 + (t - 0.6) * 0.5);
  }
  colors.push(color.r, color.g, color.b);
}

geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
geometry.computeVertexNormals();

const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(15, 25, 15);
scene.add(dirLight);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
```

运行后你会看到地形有了明显的区域分化——左边可能是一片高原，右边是低洼的谷地，中间有蜿蜒的分界线。颜色从蓝色（低处/水域边缘）过渡到绿色（中等高度）再到黄白色（山顶）。

## 调参直觉

`warpStrength` 控制扭曲的强度：
- 0.0：没有扭曲，退化为普通 fBm
- 0.3~0.5：轻微扭曲，地形有微妙的区域变化
- 0.8~1.2：强扭曲，出现明显的区域特征，像独立的山系和盆地
- 2.0+：过度扭曲，地形变得破碎、不自然

通常 0.5~1.0 是比较好的范围。

## 进阶：多级 Warping

可以叠加多级 warp——先用大尺度 warp 划分区域，再用小尺度 warp 添加局部变化：

```js
function multiWarp(x, z) {
  const bigWarp = warpedNoise(x * 0.5, z * 0.5, 2.0);
  const smallWarp = warpedNoise(x * 2 + 10, z * 2 + 10, 0.3);
  return (bigWarp + smallWarp) * 0.5;
}
```

这样地形既有大尺度的区域分化（山系、平原），也有小尺度的局部变化（山丘、沟壑）。

## 练习

1. 将 `warpStrength` 从 0.8 改成 0.0、1.5、3.0，分别观察效果。
2. 在 Domain Warping 中把用于扭曲的噪声层数从 4 改成 2，看区域特征是否更"大块"。
3. 尝试用 `warpedNoise` 的输出作为湿度值，低于 0 的区域染成蓝色代表水域。

## 参考答案

### 练习 1
warpStrength=0.0 时地形回归普通 fBm，没有区域分化；1.5 时出现非常明显的独立山系；3.0 时地形被严重扭曲，出现不自然的尖刺和断裂。

### 练习 2
减少 warp 噪声的 octaves 会让扭曲更"大块"——区域特征从山丘级别变成山系级别。这是因为低频噪声只包含大尺度变化。

### 练习 3
在高度计算后加一个判断：`if (height < 0) { color.setHSL(0.6, 0.8, 0.3); }` 就能把低处染成水域颜色。这是后面"水体生成"课的基础思路。
