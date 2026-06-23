# 玩家交互——移动、碰撞、挖掘、建造

## 从观察者到参与者

前面的课程都在"看"世界——旋转相机、平移视角。但程序化世界的终极目标是让玩家"进入"世界：在地形上行走、与物体碰撞、挖掘方块、建造结构。

这节课实现一个第一人称的玩家控制器，包括移动、碰撞检测、挖掘和建造。

## 第一人称控制器

Three.js 的 PointerLockControls 可以锁定鼠标，实现 FPS 风格的视角控制：

```js
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const controls = new PointerLockControls(camera, renderer.domElement);

document.addEventListener('click', () => {
  controls.lock();
});

const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };

document.addEventListener('keydown', (e) => {
  if (e.code in keys) keys[e.code] = true;
});

document.addEventListener('keyup', (e) => {
  if (e.code in keys) keys[e.code] = false;
});

function updateMovement(dt) {
  const speed = 5 * dt;
  const direction = new THREE.Vector3();

  if (keys.KeyW) direction.z -= 1;
  if (keys.KeyS) direction.z += 1;
  if (keys.KeyA) direction.x -= 1;
  if (keys.KeyD) direction.x += 1;

  direction.normalize();
  controls.moveRight(direction.x * speed);
  controls.moveForward(-direction.z * speed);

  if (keys.Space) camera.position.y += speed;
  if (keys.ShiftLeft) camera.position.y -= speed;
}
```

## 碰撞检测

玩家不能穿入地形。最简单的碰撞检测：每帧检查玩家脚下的地形高度，如果相机低于地形高度就把相机推上去。

```js
function updateCollision() {
  const playerHeight = 1.7;
  const terrainH = getHeight(camera.position.x, camera.position.z);

  if (camera.position.y < terrainH + playerHeight) {
    camera.position.y = terrainH + playerHeight;
  }
}
```

更精确的碰撞需要检测玩家的包围盒（AABB）和地形三角面的交集，但对大多数场景来说高度检测够用了。

## 射线检测：挖掘和建造

挖掘和建造的核心是射线检测——从相机位置向视线方向发射一条射线，找到射线命中的第一个方块。

```js
const raycaster = new THREE.Raycaster();
raycaster.far = 8;

function getTargetBlock() {
  raycaster.set(camera.position, camera.getWorldDirection(new THREE.Vector3()));

  const intersects = raycaster.intersectObjects(interactableMeshes);
  if (intersects.length > 0) {
    const hit = intersects[0];
    const normal = hit.face.normal;
    const point = hit.point;

    const blockPos = new THREE.Vector3(
      Math.floor(point.x - normal.x * 0.5),
      Math.floor(point.y - normal.y * 0.5),
      Math.floor(point.z - normal.z * 0.5),
    );

    const placePos = new THREE.Vector3(
      Math.floor(point.x + normal.x * 0.5),
      Math.floor(point.y + normal.y * 0.5),
      Math.floor(point.z + normal.z * 0.5),
    );

    return { blockPos, placePos, hit };
  }

  return null;
}
```

## 完整代码：可探索的体素世界

```js
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createNoise2D } from 'simplex-noise';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);

const noise2D = createNoise2D();

function fbm(x, z) {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < 4; i++) {
    v += noise2D(x * f, z * f) * a;
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

const WORLD_SIZE = 32;
const blocks = new Map();

function blockKey(x, y, z) { return `${x},${y},${z}`; }

function getHeight(x, z) {
  return Math.floor(fbm(x * 0.08, z * 0.08) * 8 + 8);
}

const blockMaterials = {
  grass: new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.9 }),
  dirt: new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.95 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.85 }),
};

const blockGeo = new THREE.BoxGeometry(1, 1, 1);

function addBlock(x, y, z, type = 'grass') {
  const key = blockKey(x, y, z);
  if (blocks.has(key)) return;

  const mesh = new THREE.Mesh(blockGeo, blockMaterials[type] || blockMaterials.grass);
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  scene.add(mesh);
  blocks.set(key, { mesh, type, x, y, z });
}

function removeBlock(x, y, z) {
  const key = blockKey(x, y, z);
  const block = blocks.get(key);
  if (!block) return;

  scene.remove(block.mesh);
  blocks.delete(key);
}

for (let z = -WORLD_SIZE / 2; z < WORLD_SIZE / 2; z++) {
  for (let x = -WORLD_SIZE / 2; x < WORLD_SIZE / 2; x++) {
    const h = getHeight(x, z);
    for (let y = 0; y <= h; y++) {
      let type = 'grass';
      if (y < h - 2) type = 'stone';
      else if (y < h) type = 'dirt';
      addBlock(x, y, z, type);
    }
  }
}

for (let z = -WORLD_SIZE / 2; z < WORLD_SIZE / 2; z++) {
  for (let x = -WORLD_SIZE / 2; x < WORLD_SIZE / 2; x++) {
    const h = getHeight(x, z);
    if (Math.random() < 0.03 && h > 8) {
      for (let y = h + 1; y < h + 4; y++) {
        addBlock(x, y, z, 'wood');
      }
    }
  }
}

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const sun = new THREE.DirectionalLight(0xffeedd, 0.8);
sun.position.set(20, 30, 15);
scene.add(sun);

const crosshair = document.createElement('div');
crosshair.style.cssText = `
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 20px; height: 20px; pointer-events: none; z-index: 100;
`;
crosshair.innerHTML = `
  <div style="position:absolute;top:50%;left:0;right:0;height:2px;background:white;transform:translateY(-50%)"></div>
  <div style="position:absolute;left:50%;top:0;bottom:0;width:2px;background:white;transform:translateX(-50%)"></div>
`;
document.body.appendChild(crosshair);

const info = document.createElement('div');
info.style.cssText = `
  position: fixed; bottom: 15px; left: 50%; transform: translateX(-50%);
  color: white; font-family: monospace; font-size: 13px;
  background: rgba(0,0,0,0.6); padding: 8px 16px; border-radius: 6px;
  pointer-events: none; text-align: center;
`;
info.innerHTML = '点击进入 | WASD 移动 | 鼠标旋转 | 左键挖掘 | 右键建造 | 空格跳跃';
document.body.appendChild(info);

let selectedType = 'grass';
const typeNames = ['grass', 'dirt', 'stone', 'wood'];
let selectedIdx = 0;

document.addEventListener('keydown', (e) => {
  if (e.code === 'Digit1') selectedIdx = 0;
  if (e.code === 'Digit2') selectedIdx = 1;
  if (e.code === 'Digit3') selectedIdx = 2;
  if (e.code === 'Digit4') selectedIdx = 3;
  selectedType = typeNames[selectedIdx];
});

const velocity = new THREE.Vector3();
let canJump = false;

document.addEventListener('mousedown', (e) => {
  if (!controls.isLocked) {
    controls.lock();
    return;
  }

  const raycaster = new THREE.Raycaster();
  raycaster.far = 6;
  raycaster.set(camera.position, camera.getWorldDirection(new THREE.Vector3()));

  const meshes = Array.from(blocks.values()).map(b => b.mesh);
  const intersects = raycaster.intersectObjects(meshes);

  if (intersects.length > 0) {
    const hit = intersects[0];
    const normal = hit.face.normal;
    const point = hit.point;

    if (e.button === 0) {
      const bx = Math.floor(point.x - normal.x * 0.5);
      const by = Math.floor(point.y - normal.y * 0.5);
      const bz = Math.floor(point.z - normal.z * 0.5);
      removeBlock(bx, by, bz);
    } else if (e.button === 2) {
      const bx = Math.floor(point.x + normal.x * 0.5);
      const by = Math.floor(point.y + normal.y * 0.5);
      const bz = Math.floor(point.z + normal.z * 0.5);
      addBlock(bx, by, bz, selectedType);
    }
  }
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

const keys = {};
document.addEventListener('keydown', (e) => { keys[e.code] = true; });
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (controls.isLocked) {
    const speed = 6;
    const direction = new THREE.Vector3();

    if (keys.KeyW) direction.z -= 1;
    if (keys.KeyS) direction.z += 1;
    if (keys.KeyA) direction.x -= 1;
    if (keys.KeyD) direction.x += 1;
    direction.normalize();

    velocity.x = direction.x * speed;
    velocity.z = direction.z * speed;

    velocity.y -= 15 * dt;

    if (keys.Space && canJump) {
      velocity.y = 6;
      canJump = false;
    }

    controls.moveRight(velocity.x * dt);
    controls.moveForward(-velocity.z * dt);
    camera.position.y += velocity.y * dt;

    const groundH = getHeight(Math.floor(camera.position.x), Math.floor(camera.position.z)) + 1.7;
    if (camera.position.y < groundH) {
      camera.position.y = groundH;
      velocity.y = 0;
      canJump = true;
    }
  }

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

运行后点击画面进入控制模式：
- WASD 移动
- 鼠标旋转视角
- 空格跳跃
- 左键挖掘方块
- 右键在瞄准位置放置方块
- 数字键 1-4 切换方块类型

你会在一个体素世界上行走，可以挖洞、建墙、造楼梯。

## 碰撞的改进

当前的碰撞只检测脚下的高度。更完善的碰撞需要：
- **侧面碰撞**：检测玩家 AABB 和方块的交集
- **头顶碰撞**：防止玩家从方块内部穿过
- **斜坡处理**：允许玩家走上 1 格高的台阶

## 练习

1. 添加重力和惯性——玩家跳跃后有抛物线轨迹，落地时减速。
2. 实现"破坏动画"——方块被挖掘时不是瞬间消失，而是先出现裂纹再碎裂。
3. 添加"物品栏"UI——在屏幕底部显示当前持有的方块类型。

## 参考答案

### 练习 1
当前已经有重力（`velocity.y -= 15 * dt`）和惯性。可以添加空气阻力让下落更自然：`velocity.y *= 0.99`。落地时根据下落速度播放不同的音效。

### 练习 2
在挖掘时，给方块的材质添加一个裂纹纹理（用 Shader 在方块表面叠加裂纹），持续 0.3 秒后移除方块。可以配合粒子效果模拟碎屑飞溅。

### 练习 3
在屏幕底部创建一个 div，包含 4 个方块图标。当前选中的有高亮边框。监听数字键切换选中状态。
