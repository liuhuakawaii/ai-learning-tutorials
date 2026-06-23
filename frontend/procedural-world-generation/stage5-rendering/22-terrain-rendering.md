# 地形渲染——多层纹理、法线贴图、视差映射

## 为什么 flatShading 不够

前面所有课程的地形都用 `flatShading: true` 加顶点颜色。这在远处看着还行，但近距离观察会发现：每个三角面都是纯色的，没有表面细节。草地看不到草的纹理，岩石看不到石头的裂纹，沙地看不到沙粒。

这节课要在地形上添加纹理、法线贴图和视差映射，让表面有真实的材质感。

## 多层纹理混合

一个地形不可能只用一张纹理——草地、岩石、泥土、雪需要不同的纹理。关键是在不同条件下混合这些纹理。

混合的依据：
- **高度**：低处泥土，高处岩石，山顶雪
- **坡度**：平缓处草地，陡峭处岩石
- **Biome**：不同 Biome 用不同纹理组合

```glsl
uniform sampler2D grassTexture;
uniform sampler2D rockTexture;
uniform sampler2D snowTexture;
uniform sampler2D dirtTexture;

varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
  vec2 uv = vWorldPos.xz * 0.1;

  vec4 grass = texture2D(grassTexture, uv * 3.0);
  vec4 rock = texture2D(rockTexture, uv * 2.0);
  vec4 snow = texture2D(snowTexture, uv * 4.0);
  vec4 dirt = texture2D(dirtTexture, uv * 2.5);

  float slope = 1.0 - vNormal.y;
  float height = vWorldPos.y;

  float grassWeight = smoothstep(0.4, 0.2, slope) * smoothstep(10.0, 5.0, height);
  float rockWeight = smoothstep(0.2, 0.4, slope) + smoothstep(5.0, 10.0, height) * (1.0 - smoothstep(12.0, 15.0, height));
  float snowWeight = smoothstep(12.0, 15.0, height);
  float dirtWeight = smoothstep(0.0, 2.0, height) * (1.0 - grassWeight - rockWeight);

  float total = grassWeight + rockWeight + snowWeight + dirtWeight;
  vec4 color = (grass * grassWeight + rock * rockWeight + snow * snowWeight + dirt * dirtWeight) / total;

  gl_FragColor = color;
}
```

## 法线贴图

法线贴图不改变几何体，但改变每个像素的法线方向。这样平面上也能有凹凸感——草地有草叶的凹凸，岩石有裂纹的阴影。

```glsl
uniform sampler2D grassNormal;
uniform sampler2D rockNormal;

vec3 perturbNormal(vec3 normal, vec3 tangent, vec3 bitangent, vec2 uv) {
  vec3 map = texture2D(grassNormal, uv).xyz * 2.0 - 1.0;
  mat3 TBN = mat3(tangent, bitangent, normal);
  return normalize(TBN * map);
}
```

## 视差映射（Parallax Mapping）

法线贴图只能模拟凹凸的光影效果，不能模拟真正的深度——从侧面看还是平的。视差映射通过偏移 UV 坐标来模拟深度，让表面看起来真的有凹陷。

```glsl
uniform sampler2D heightMap;
uniform float heightScale;

vec2 parallaxUV(vec2 uv, vec3 viewDir) {
  float height = texture2D(heightMap, uv).r;
  vec2 offset = viewDir.xy / viewDir.z * height * heightScale;
  return uv - offset;
}
```

## 完整代码：带纹理的地形

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.005);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const noise2D = createNoise2D();

function fbm(x, z) {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < 5; i++) {
    v += noise2D(x * f, z * f) * a;
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

function createProceduralTexture(color1, color2, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = noise2D(x * 0.05, y * 0.05) * 0.5 + 0.5;
      const c1 = color1, c2 = color2;
      const r = Math.floor(c1[0] * (1 - n) + c2[0] * n);
      const g = Math.floor(c1[1] * (1 - n) + c2[1] * n);
      const b = Math.floor(c1[2] * (1 - n) + c2[2] * n);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createNormalFromTexture(texture) {
  const canvas = document.createElement('canvas');
  const size = texture.image.width;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(texture.image, 0, 0);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const normalData = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const left = data[((y * size + Math.max(0, x - 1)) * 4)];
      const right = data[((y * size + Math.min(size - 1, x + 1)) * 4)];
      const up = data[((Math.max(0, y - 1) * size + x) * 4)];
      const down = data[((Math.min(size - 1, y + 1) * size + x) * 4)];

      const dx = (left - right) / 255;
      const dy = (up - down) / 255;
      const dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

      normalData.data[idx] = Math.floor((dx / len * 0.5 + 0.5) * 255);
      normalData.data[idx + 1] = Math.floor((dy / len * 0.5 + 0.5) * 255);
      normalData.data[idx + 2] = Math.floor((dz / len * 0.5 + 0.5) * 255);
      normalData.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(normalData, 0, 0);
  const normalTex = new THREE.CanvasTexture(canvas);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  return normalTex;
}

const grassTex = createProceduralTexture([60, 120, 40], [80, 150, 50]);
const rockTex = createProceduralTexture([100, 90, 80], [130, 120, 110]);
const snowTex = createProceduralTexture([220, 225, 235], [240, 240, 245]);
const dirtTex = createProceduralTexture([120, 90, 60], [150, 120, 80]);

const grassNormal = createNormalFromTexture(grassTex);
const rockNormal = createNormalFromTexture(rockTex);

const terrainShader = new THREE.ShaderMaterial({
  uniforms: {
    grassTex: { value: grassTex },
    rockTex: { value: rockTex },
    snowTex: { value: snowTex },
    dirtTex: { value: dirtTex },
    grassNormal: { value: grassNormal },
    rockNormal: { value: rockNormal },
    lightDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
  },
  vertexShader: `
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D grassTex;
    uniform sampler2D rockTex;
    uniform sampler2D snowTex;
    uniform sampler2D dirtTex;
    uniform sampler2D grassNormal;
    uniform sampler2D rockNormal;
    uniform vec3 lightDir;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
      vec2 uv = vWorldPos.xz * 0.05;

      vec4 grass = texture2D(grassTex, uv * 3.0);
      vec4 rock = texture2D(rockTex, uv * 2.0);
      vec4 snow = texture2D(snowTex, uv * 4.0);
      vec4 dirt = texture2D(dirtTex, uv * 2.5);

      float slope = 1.0 - vNormal.y;
      float height = vWorldPos.y;

      float grassW = smoothstep(0.35, 0.15, slope) * smoothstep(8.0, 3.0, height);
      float rockW = smoothstep(0.15, 0.35, slope) + smoothstep(3.0, 8.0, height) * (1.0 - smoothstep(10.0, 13.0, height));
      float snowW = smoothstep(10.0, 13.0, height);
      float dirtW = (1.0 - grassW - rockW - snowW) * 0.5;

      float total = max(grassW + rockW + snowW + dirtW, 0.001);
      vec4 color = (grass * grassW + rock * rockW + snow * snowW + dirt * dirtW) / total;

      vec3 normal = vNormal;
      if (slope < 0.25) {
        vec3 nMap = texture2D(grassNormal, uv * 3.0).xyz * 2.0 - 1.0;
        normal = normalize(mix(normal, nMap, 0.3));
      }

      float diff = max(dot(normal, lightDir), 0.0);
      float ambient = 0.25;
      color.rgb *= ambient + diff * 0.75;

      gl_FragColor = color;
    }
  `,
});

const SIZE = 64;
const SCALE = 40;
const geometry = new THREE.PlaneGeometry(SCALE, SCALE, SIZE, SIZE);
geometry.rotateX(-Math.PI / 2);
const posAttr = geometry.attributes.position;

for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i);
  const z = posAttr.getZ(i);
  const h = fbm(x * 0.05, z * 0.05) * 12;
  posAttr.setY(i, h);
}

geometry.computeVertexNormals();
const terrain = new THREE.Mesh(geometry, terrainShader);
scene.add(terrain);

scene.add(new THREE.AmbientLight(0xffffff, 0.2));
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

运行后把相机拉近地形表面，你会看到：
- 草地区域有细腻的纹理，不像之前那样纯色
- 陡峭的坡面自动切换成岩石纹理
- 高处有雪的纹理
- 法线贴图让表面有微妙的光影变化

## 纹理的性能考虑

- 纹理分辨率通常 512×512 或 1024×1024 就够了
- 用纹理图集（Atlas）减少 draw call
- 远处的 Chunk 用更低分辨率的纹理
- Mipmap 对地形纹理很重要——避免远处的摩尔纹

## 练习

1. 在着色器中添加距离雾——靠近相机的区域用纹理，远处直接混合雾色。
2. 给岩石纹理添加视差映射——在陡峭的坡面上看起来有深度感。
3. 用程序化方法生成一张带裂纹的岩石纹理，替代简单的噪声纹理。

## 参考答案

### 练习 1
在 fragmentShader 末尾加 `float fogFactor = smoothstep(50.0, 150.0, length(vWorldPos - cameraPosition)); color.rgb = mix(color.rgb, vec3(0.53, 0.81, 0.92), fogFactor);`。

### 练习 2
在岩石区域用 `parallaxUV` 函数偏移 UV，采样高度纹理来决定偏移量。这需要额外的高度纹理和视线方向的传入。

### 练习 3
用 Voronoi 噪声（Worley 噪声）生成裂纹图案——细胞边界是深色的裂纹，细胞内部是岩石底色。叠加多层不同频率的 Voronoi 让裂纹有粗有细。
