# 阶段实战：构建一个完整的程序化世界探索体验

## 把所有阶段串起来

这是课程的最终实战。目标是把前 24 课学到的全部技术整合成一个完整的、可探索的程序化世界。

这不是简单的代码拼接——需要考虑各系统之间的配合、性能的平衡、以及玩家体验的连贯性。

## 系统架构

```
完整的程序化世界
├── 地形系统
│   ├── 噪声生成（Simplex + fBm + Domain Warping）
│   ├── 侵蚀模拟（热力 + 水力）
│   └── Chunk 管理（加载/卸载/LOD）
├── 生态系统
│   ├── 气候模型（温度 + 湿度）
│   ├── Biome 映射（Whittaker 图）
│   └── 植被放置（实例化渲染）
├── 结构系统
│   ├── 洞穴生成（3D 细胞自动机）
│   ├── 建筑生成（废墟 + 道路）
│   └── NPC 行为（状态机）
├── 渲染系统
│   ├── 多层纹理 + 法线贴图
│   ├── 水面反射
│   ├── 天气效果（雾、雨、云）
│   └── 植被动画（风吹）
├── 交互系统
│   ├── 第一人称控制
│   ├── 碰撞检测
│   └── 挖掘 / 建造
└── 种子系统
    ├── 确定性生成
    └── 参数化编辑
```

## 核心代码：场景管理器

```js
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class WorldScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.005);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 20, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    document.body.appendChild(this.renderer.domElement);

    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    this.clock = new THREE.Clock();
    this.systems = [];

    this.setupLighting();
    this.setupInput();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setupLighting() {
    this.scene.add(new THREE.AmbientLight(0x8899bb, 0.3));
    this.sunLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    this.sunLight.position.set(30, 40, 20);
    this.scene.add(this.sunLight);
    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.25));
  }

  setupInput() {
    this.keys = {};
    document.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    document.addEventListener('click', () => { if (!this.controls.isLocked) this.controls.lock(); });
  }

  addSystem(system) {
    this.systems.push(system);
  }

  start() {
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const elapsed = this.clock.getElapsedTime();

      for (const system of this.systems) {
        system.update(dt, elapsed, this);
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}
```

## 地形系统

```js
import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

function fbm(seed, x, z, octaves = 5) {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise(seed + i * 1000, x * f, z * f) * a;
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

function getHeight(seed, wx, wz) {
  let h = fbm(seed, wx * 0.02, wz * 0.02) * 15;
  const coastWarp = fbm(seed + 7000, wx * 0.01, wz * 0.01) * 3;
  h += coastWarp;
  return h - 5;
}

export class TerrainSystem {
  constructor(world) {
    this.world = world;
    this.chunkSize = 16;
    this.renderDistance = 6;
    this.chunks = new Map();
    this.seed = 42;
  }

  update(dt, elapsed, scene) {
    const pcx = Math.floor(scene.camera.position.x / this.chunkSize);
    const pcz = Math.floor(scene.camera.position.z / this.chunkSize);
    const needed = new Set();

    for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
      for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
        if (dx * dx + dz * dz > this.renderDistance * this.renderDistance) continue;
        const key = `${pcx + dx},${pcz + dz}`;
        needed.add(key);

        if (!this.chunks.has(key)) {
          this.loadChunk(pcx + dx, pcz + dx, scene);
        }
      }
    }

    for (const [key, mesh] of this.chunks) {
      if (!needed.has(key)) {
        scene.scene.remove(mesh);
        mesh.geometry.dispose();
        this.chunks.delete(key);
      }
    }
  }

  loadChunk(cx, cz, scene) {
    const geo = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, this.chunkSize, this.chunkSize);
    geo.rotateX(-Math.PI / 2);
    const colors = [];
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i) + this.chunkSize / 2;
      const lz = pos.getZ(i) + this.chunkSize / 2;
      const wx = cx * this.chunkSize + lx;
      const wz = cz * this.chunkSize + lz;
      const h = getHeight(this.seed, wx, wz);
      pos.setY(i, h);

      const c = new THREE.Color();
      if (h < 0) c.setHSL(0.58, 0.6, 0.25);
      else if (h < 4) c.setHSL(0.28, 0.55, 0.32);
      else if (h < 8) c.setHSL(0.22, 0.45, 0.38);
      else c.setHSL(0.1, 0.3, 0.55);
      colors.push(c.r, c.g, c.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }));
    mesh.position.set(cx * this.chunkSize + this.chunkSize / 2, 0, cz * this.chunkSize + this.chunkSize / 2);
    scene.scene.add(mesh);
    this.chunks.set(`${cx},${cz}`, mesh);
  }

  getHeightAt(x, z) {
    return getHeight(this.seed, x, z);
  }
}
```

## 天气系统

```js
export class WeatherSystem {
  constructor(world) {
    this.world = world;
    this.rainParticles = this.createRain(3000);
    this.weather = 'clear';
    world.scene.add(this.rainParticles);
  }

  createRain(count) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 100;
      pos[i * 3 + 1] = Math.random() * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xaabbcc, size: 0.08, transparent: true, opacity: 0.5 });
    const rain = new THREE.Points(geo, mat);
    rain.visible = false;
    return rain;
  }

  update(dt, elapsed, scene) {
    if (Math.random() < 0.0005) {
      this.weather = this.weather === 'clear' ? 'rain' : 'clear';
      this.rainParticles.visible = this.weather === 'rain';
      scene.scene.fog.density = this.weather === 'rain' ? 0.012 : 0.005;
      scene.scene.background.set(this.weather === 'rain' ? 0x667788 : 0x87ceeb);
    }

    if (this.rainParticles.visible) {
      const pos = this.rainParticles.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.array[i * 3 + 1] -= 0.5 * dt * 60;
        if (pos.array[i * 3 + 1] < -2) pos.array[i * 3 + 1] = 40;
      }
      pos.needsUpdate = true;
    }
  }
}
```

## 玩家系统

```js
export class PlayerSystem {
  constructor(world) {
    this.world = world;
    this.velocity = new THREE.Vector3();
    this.canJump = false;
  }

  update(dt, elapsed, scene) {
    if (!scene.controls.isLocked) return;

    const speed = 6;
    const direction = new THREE.Vector3();
    if (scene.keys.KeyW) direction.z -= 1;
    if (scene.keys.KeyS) direction.z += 1;
    if (scene.keys.KeyA) direction.x -= 1;
    if (scene.keys.KeyD) direction.x += 1;
    direction.normalize();

    this.velocity.y -= 15 * dt;
    if (scene.keys.Space && this.canJump) {
      this.velocity.y = 7;
      this.canJump = false;
    }

    scene.controls.moveRight(direction.x * speed * dt);
    scene.controls.moveForward(-direction.z * speed * dt);
    scene.camera.position.y += this.velocity.y * dt;

    const terrain = this.world.getSystem('terrain');
    if (terrain) {
      const groundH = terrain.getHeightAt(scene.camera.position.x, scene.camera.position.z) + 1.7;
      if (scene.camera.position.y < groundH) {
        scene.camera.position.y = groundH;
        this.velocity.y = 0;
        this.canJump = true;
      }
    }
  }
}
```

## index.html

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>程序化世界探索</title>
  <style>
    * { margin: 0; padding: 0; }
    body { overflow: hidden; }
    canvas { display: block; }
    #ui {
      position: fixed; bottom: 15px; left: 50%; transform: translateX(-50%);
      color: white; font-family: monospace; font-size: 13px;
      background: rgba(0,0,0,0.6); padding: 10px 20px; border-radius: 6px;
      pointer-events: none; text-align: center;
    }
    #crosshair {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      pointer-events: none; z-index: 100;
    }
    #crosshair::before, #crosshair::after {
      content: ''; position: absolute; background: white;
    }
    #crosshair::before {
      width: 16px; height: 2px; top: -1px; left: -8px;
    }
    #crosshair::after {
      width: 2px; height: 16px; top: -8px; left: -1px;
    }
  </style>
</head>
<body>
  <div id="crosshair"></div>
  <div id="ui">点击进入世界 | WASD 移动 | 空格跳跃 | 鼠标旋转</div>
  <script type="module" src="main.js"></script>
</body>
</html>
```

## 运行效果

打开页面后点击进入世界：
- 第一人称视角在程序化地形上行走
- 不同 Biome 有不同的颜色
- 天气随机变化（晴天 ↔ 雨天）
- 可以跳跃，有重力和碰撞
- 世界在玩家周围无限生成

## 从这里开始

课程到此结束。你已经掌握了程序化世界生成的核心技术：

1. **噪声算法** → 生成连续、自然的值场
2. **地形生成** → 多层叠加、Domain Warping、侵蚀模拟
3. **生物群落** → 气候模型、Biome 映射、植被分布
4. **结构生成** → 洞穴、建筑、道路、NPC
5. **无限世界** → Chunk 系统、种子、异步生成
6. **渲染优化** → 体素渲染、纹理混合、实例化、Billboard
7. **玩家交互** → 移动、碰撞、挖掘、建造

这些技术的组合方式是无限的。你可以：
- 加入更复杂的 Biome 系统
- 实现多人联网
- 添加更多类型的建筑和 NPC
- 用 WebGPU 加速渲染
- 生成自定义的矿石、洞穴、地下城

关键不是记住所有代码，而是理解每个系统背后的思路——然后根据你的项目需求做出合适的选择。
