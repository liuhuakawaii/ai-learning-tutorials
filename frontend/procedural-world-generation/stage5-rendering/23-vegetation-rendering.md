# 植被渲染——Billboard、实例化、风吹动画

## 植被是性能杀手

第 7 课我们用独立的 Mesh 放置树木。这在几十棵树时没问题，但真实世界的森林有成千上万棵树。每棵树用一个 Mesh 意味着成千上万次 draw call，帧率会降到个位数。

这节课用三种技术解决植被渲染的性能问题：
1. **Billboard**：远处的树用一张始终朝向相机的图片代替 3D 模型
2. **实例化渲染**：同一类型的树用 InstancedMesh 一次绘制全部
3. **风吹动画**：在顶点着色器中实现，不需要 CPU 参与

## InstancedMesh：一次绘制上万个实例

```js
function createInstancedTrees(count) {
  const trunkGeo = new THREE.CylinderGeometry(0.05, 0.08, 1.5, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e });
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);

  const crownGeo = new THREE.SphereGeometry(0.6, 6, 5);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2d7a2d });
  const crownMesh = new THREE.InstancedMesh(crownGeo, crownMat, count);

  return { trunkMesh, crownMesh, count };
}

function placeInstance(mesh, index, x, y, z, scale, rotation) {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3(x, y, z);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotation, 0));
  const scaleVec = new THREE.Vector3(scale, scale, scale);

  matrix.compose(position, quaternion, scaleVec);
  mesh.setMatrixAt(index, matrix);
  mesh.instanceMatrix.needsUpdate = true;
}
```

InstancedMesh 的核心：所有实例共享同一个几何体和材质，但每个实例有自己的变换矩阵。GPU 一次 draw call 就能绘制所有实例。

## Billboard：远处的树用图片

Billboard 是一张始终朝向相机的平面。对于远处的树，玩家看不清细节，用一张树的图片就足够了。

```js
function createBillboardTree() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#5c3a1e';
  ctx.fillRect(26, 80, 12, 48);

  ctx.fillStyle = '#2d7a2d';
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.lineTo(60, 90);
  ctx.lineTo(4, 90);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1a5c1a';
  ctx.beginPath();
  ctx.moveTo(32, 20);
  ctx.lineTo(55, 80);
  ctx.lineTo(9, 80);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.transparent = true;

  const geo = new THREE.PlaneGeometry(2, 3);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geo, mat);
}
```

## 风吹动画

在顶点着色器中，根据顶点的高度偏移 X 坐标，模拟风吹效果。树顶摆动幅度大，树干不动。

```glsl
uniform float time;
uniform float windStrength;
uniform vec2 windDirection;

varying vec3 vColor;

void main() {
  vec3 pos = position;

  float heightFactor = max(0.0, pos.y) * 0.5;
  float windPhase = time * 2.0 + pos.x * 0.5 + pos.z * 0.3;
  float windOffset = sin(windPhase) * windStrength * heightFactor;

  pos.x += windDirection.x * windOffset;
  pos.z += windDirection.y * windOffset;

  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
  vColor = color;
}
```

## 完整代码：高性能森林

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 15, 25);

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

function getHeight(x, z) {
  return fbm(x * 0.04, z * 0.04) * 10;
}

const terrainGeo = new THREE.PlaneGeometry(80, 80, 80, 80);
terrainGeo.rotateX(-Math.PI / 2);
const tColors = [];
const tPos = terrainGeo.attributes.position;

for (let i = 0; i < tPos.count; i++) {
  const x = tPos.getX(i), z = tPos.getZ(i);
  const h = getHeight(x, z);
  tPos.setY(i, h);
  const c = new THREE.Color();
  if (h < 0) c.setHSL(0.58, 0.6, 0.25);
  else c.setHSL(0.28, 0.55, 0.3 + h * 0.015);
  tColors.push(c.r, c.g, c.b);
}

terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(tColors, 3));
terrainGeo.computeVertexNormals();
scene.add(new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true })));

const TREE_COUNT = 2000;

const windShader = {
  uniforms: {
    time: { value: 0 },
    windStrength: { value: 0.15 },
    windDirection: { value: new THREE.Vector2(1, 0.5).normalize() },
  },
  vertexShader: `
    uniform float time;
    uniform float windStrength;
    uniform vec2 windDirection;

    void main() {
      vec3 pos = position;

      float heightFactor = max(0.0, pos.y) * 0.4;
      float windPhase = time * 1.5 + float(gl_InstanceID) * 0.1;
      float windOffset = sin(windPhase) * windStrength * heightFactor;

      pos.x += windDirection.x * windOffset;
      pos.z += windDirection.y * windOffset;

      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    void main() {
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

const trunkGeo = new THREE.CylinderGeometry(0.04, 0.07, 1.5, 5);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e });
const trunkInstances = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_COUNT);

const crownGeo = new THREE.SphereGeometry(0.55, 6, 5);
const crownMat = new THREE.ShaderMaterial({
  uniforms: {
    ...THREE.UniformsUtils.clone(windShader.uniforms),
    color: { value: new THREE.Color(0x2d7a2d) },
  },
  vertexShader: windShader.vertexShader,
  fragmentShader: windShader.fragmentShader,
});
const crownInstances = new THREE.InstancedMesh(crownGeo, crownMat, TREE_COUNT);

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const rand = seededRandom(42);

for (let i = 0; i < TREE_COUNT; i++) {
  const x = (rand() - 0.5) * 70;
  const z = (rand() - 0.5) * 70;
  const h = getHeight(x, z);

  if (h < 0.5 || h > 8) continue;
  if (rand() > 0.5) continue;

  const treeScale = 0.8 + rand() * 1.2;
  const rotation = rand() * Math.PI * 2;

  position.set(x, h + 0.75 * treeScale, z);
  quaternion.setFromEuler(new THREE.Euler(0, rotation, 0));
  scale.set(treeScale, treeScale, treeScale);
  matrix.compose(position, quaternion, scale);
  trunkInstances.setMatrixAt(i, matrix);

  position.set(x, h + 1.8 * treeScale, z);
  matrix.compose(position, quaternion, scale);
  crownInstances.setMatrixAt(i, matrix);
}

trunkInstances.instanceMatrix.needsUpdate = true;
crownInstances.instanceMatrix.needsUpdate = true;
scene.add(trunkInstances);
scene.add(crownInstances);

const billboardCanvas = document.createElement('canvas');
billboardCanvas.width = 64;
billboardCanvas.height = 128;
const bCtx = billboardCanvas.getContext('2d');
bCtx.fillStyle = '#5c3a1e';
bCtx.fillRect(26, 80, 12, 48);
bCtx.fillStyle = '#2d7a2d';
bCtx.beginPath();
bCtx.moveTo(32, 0);
bCtx.lineTo(60, 90);
bCtx.lineTo(4, 90);
bCtx.closePath();
bCtx.fill();
const billboardTex = new THREE.CanvasTexture(billboardCanvas);

const billboardGeo = new THREE.PlaneGeometry(2, 3);
const billboardMat = new THREE.MeshBasicMaterial({
  map: billboardTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
});

const billboards = [];
for (let i = 0; i < 200; i++) {
  const x = (rand() - 0.5) * 70;
  const z = (rand() - 0.5) * 70;
  const h = getHeight(x, z);
  if (h < 0.5) continue;

  const bb = new THREE.Mesh(billboardGeo, billboardMat);
  bb.position.set(x, h + 1.5, z);
  bb.scale.setScalar(1 + rand());
  scene.add(bb);
  billboards.push(bb);
}

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
sun.position.set(20, 30, 15);
scene.add(sun);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  crownMat.uniforms.time.value = t;

  for (const bb of billboards) {
    bb.lookAt(camera.position);
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

运行后你会看到：
- 2000 棵树用实例化渲染，帧率保持流畅
- 树冠在风中轻轻摆动（顶点着色器动画）
- 远处的树用 Billboard 替代，始终朝向相机
- 整体视觉效果比之前的纯几何体丰富很多

## LOD 策略组合

实际项目中植被的 LOD 通常是：
- 0-30 米：完整的 3D 模型（InstancedMesh）
- 30-80 米：简化的 3D 模型（更少的面数）
- 80-200 米：Billboard
- 200 米以上：不渲染

## 练习

1. 把 `TREE_COUNT` 从 2000 改成 10000，观察帧率变化。
2. 给不同类型的树（松树、阔叶树）用不同的颜色和形状。
3. 在顶点着色器中添加"被玩家碰撞时弯曲"的效果——树在玩家靠近时让开。

## 参考答案

### 练习 1
InstancedMesh 的性能非常好——10000 棵树通常也能保持 60fps。瓶颈不在绘制，而在实例矩阵的更新（如果树会移动的话）。

### 练习 2
创建两组 InstancedMesh：一组用 ConeGeometry（松树），一组用 SphereGeometry（阔叶树）。根据 Biome 类型决定在哪组中放置实例。

### 练习 3
在着色器中传入玩家位置 uniform，计算顶点到玩家的距离。距离小于阈值时，根据距离偏移顶点——越近弯曲越大。这就是经典的"草丛被踩踏"效果。
