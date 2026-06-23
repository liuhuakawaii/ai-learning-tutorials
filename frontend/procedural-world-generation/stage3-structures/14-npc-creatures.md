# NPC 与生物——程序化行为、生态系统模拟

## 让世界"活"起来

前面的课程生成了地形、植被、建筑、道路——但世界是静止的。真实的世界有动物在跑动、鸟在飞、鱼在游。这节课要在程序化世界中添加会动的生物。

程序化生物不是简单地让模型在场景里绕圈。好的程序化行为需要三个层次：
1. **外观**：生物长什么样
2. **行为**：生物做什么（觅食、休息、逃跑、巡逻）
3. **生态**：不同生物之间的关系（食物链、领地）

## 简单的行为状态机

有限状态机（FSM）是控制 NPC 行为的最简单方法。每个生物在任意时刻处于一个状态，根据条件切换到其他状态。

```js
const STATES = {
  IDLE: 'idle',
  WANDER: 'wander',
  EAT: 'eat',
  FLEE: 'flee',
  SLEEP: 'sleep',
};

class Creature {
  constructor(x, z, type) {
    this.x = x;
    this.z = z;
    this.type = type;
    this.state = STATES.IDLE;
    this.energy = 1;
    this.targetX = x;
    this.targetZ = z;
    this.stateTimer = 0;
  }

  update(dt, heightFn) {
    this.energy -= dt * 0.02;
    this.stateTimer -= dt;

    switch (this.state) {
      case STATES.IDLE:
        if (this.stateTimer <= 0) {
          if (this.energy < 0.3) {
            this.state = STATES.EAT;
            this.stateTimer = 3;
          } else {
            this.state = STATES.WANDER;
            this.targetX = this.x + (Math.random() - 0.5) * 10;
            this.targetZ = this.z + (Math.random() - 0.5) * 10;
            this.stateTimer = 5;
          }
        }
        break;

      case STATES.WANDER:
        this.moveToward(this.targetX, this.targetZ, dt, 1.5);
        if (this.stateTimer <= 0 || this.distTo(this.targetX, this.targetZ) < 0.5) {
          this.state = STATES.IDLE;
          this.stateTimer = 1 + Math.random() * 3;
        }
        break;

      case STATES.EAT:
        this.energy = Math.min(1, this.energy + dt * 0.1);
        if (this.energy > 0.8 || this.stateTimer <= 0) {
          this.state = STATES.IDLE;
          this.stateTimer = 2;
        }
        break;

      case STATES.FLEE:
        this.moveToward(this.targetX, this.targetZ, dt, 4);
        if (this.stateTimer <= 0) {
          this.state = STATES.IDLE;
          this.stateTimer = 2;
        }
        break;
    }
  }

  moveToward(tx, tz, dt, speed) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.1) {
      this.x += (dx / dist) * speed * dt;
      this.z += (dz / dist) * speed * dt;
    }
  }

  distTo(x, z) {
    return Math.sqrt((this.x - x) ** 2 + (this.z - z) ** 2);
  }
}
```

## 生物的外观

不同类型的生物用不同的几何体组合：

```js
function createDeer() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x8b6914 })
  );
  body.position.y = 0.8;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x9b7924 })
  );
  head.position.set(0, 1.1, 0.6);
  group.add(head);

  const legs = [];
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x6b4914 });
  const legPositions = [[-0.2, 0, -0.4], [0.2, 0, -0.4], [-0.2, 0, 0.4], [0.2, 0, 0.4]];

  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, 0.4, lz);
    group.add(leg);
    legs.push(leg);
  }

  group.userData.legs = legs;
  return group;
}

function createBird() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  group.add(body);

  const wingGeo = new THREE.PlaneGeometry(0.4, 0.1);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.DoubleSide });

  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.position.x = -0.25;
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWing.position.x = 0.25;
  group.add(rightWing);

  group.userData.wings = { left: leftWing, right: rightWing };
  return group;
}
```

## 完整代码：生态场景

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 25, 35);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

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

function getHeight(x, z) {
  return fbm(x * 0.05, z * 0.05) * 8;
}

const terrainGeo = new THREE.PlaneGeometry(60, 60, 60, 60);
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

const creatures = [];

for (let i = 0; i < 12; i++) {
  const x = (Math.random() - 0.5) * 40;
  const z = (Math.random() - 0.5) * 40;
  const h = getHeight(x, z);
  if (h < 0.5) continue;

  const deer = createDeer();
  deer.position.set(x, h, z);
  scene.add(deer);
  creatures.push({ mesh: deer, agent: new CreatureAgent(x, z, 'deer', 1.5) });
}

for (let i = 0; i < 8; i++) {
  const x = (Math.random() - 0.5) * 40;
  const z = (Math.random() - 0.5) * 40;

  const bird = createBird();
  bird.position.set(x, 5 + Math.random() * 5, z);
  scene.add(bird);
  creatures.push({ mesh: bird, agent: new BirdAgent(x, z) });
}

function CreatureAgent(x, z, type, speed) {
  this.x = x;
  this.z = z;
  this.type = type;
  this.speed = speed;
  this.state = 'wander';
  this.targetX = x + (Math.random() - 0.5) * 10;
  this.targetZ = z + (Math.random() - 0.5) * 10;
  this.timer = 3 + Math.random() * 5;
  this.energy = 0.5 + Math.random() * 0.5;
}

CreatureAgent.prototype.update = function (dt) {
  this.timer -= dt;
  this.energy -= dt * 0.015;

  if (this.state === 'wander') {
    const dx = this.targetX - this.x;
    const dz = this.targetZ - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.3) {
      this.x += (dx / dist) * this.speed * dt;
      this.z += (dz / dist) * this.speed * dt;
    }
    if (this.timer <= 0 || dist < 0.5) {
      this.state = this.energy < 0.3 ? 'eat' : 'idle';
      this.timer = 2 + Math.random() * 3;
    }
  } else if (this.state === 'idle') {
    if (this.timer <= 0) {
      this.state = 'wander';
      this.targetX = this.x + (Math.random() - 0.5) * 12;
      this.targetZ = this.z + (Math.random() - 0.5) * 12;
      this.timer = 4 + Math.random() * 4;
    }
  } else if (this.state === 'eat') {
    this.energy = Math.min(1, this.energy + dt * 0.08);
    if (this.timer <= 0 || this.energy > 0.8) {
      this.state = 'idle';
      this.timer = 1;
    }
  }
};

function BirdAgent(x, z) {
  this.x = x;
  this.z = z;
  this.y = 5 + Math.random() * 3;
  this.angle = Math.random() * Math.PI * 2;
  this.radius = 5 + Math.random() * 10;
  this.speed = 0.3 + Math.random() * 0.5;
  this.wingPhase = Math.random() * Math.PI * 2;
}

BirdAgent.prototype.update = function (dt) {
  this.angle += this.speed * dt;
  this.wingPhase += dt * 8;
};

function createDeer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x8b6914 })
  );
  body.position.y = 0.8;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x9b7924 })
  );
  head.position.set(0, 1.1, 0.6);
  g.add(head);

  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x6b4914 });
  for (const [lx, lz] of [[-0.2, -0.4], [0.2, -0.4], [-0.2, 0.4], [0.2, 0.4]]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, 0.4, lz);
    g.add(leg);
  }
  return g;
}

function createBird() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  ));
  const wingGeo = new THREE.PlaneGeometry(0.35, 0.08);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide });
  const lw = new THREE.Mesh(wingGeo, wingMat);
  lw.position.x = -0.2;
  g.add(lw);
  const rw = new THREE.Mesh(wingGeo, wingMat);
  rw.position.x = 0.2;
  g.add(rw);
  g.userData = { leftWing: lw, rightWing: rw };
  return g;
}

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
sun.position.set(20, 30, 15);
scene.add(sun);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  for (const c of creatures) {
    c.agent.update(dt);

    const h = getHeight(c.agent.x, c.agent.z);

    if (c.agent instanceof BirdAgent) {
      const bx = c.agent.x + Math.cos(c.agent.angle) * c.agent.radius;
      const bz = c.agent.z + Math.sin(c.agent.angle) * c.agent.radius;
      c.mesh.position.set(bx, c.agent.y + Math.sin(c.agent.wingPhase * 0.3) * 0.5, bz);
      c.mesh.rotation.y = c.agent.angle + Math.PI / 2;

      if (c.mesh.userData.leftWing) {
        c.mesh.userData.leftWing.rotation.z = Math.sin(c.agent.wingPhase) * 0.5;
        c.mesh.userData.rightWing.rotation.z = -Math.sin(c.agent.wingPhase) * 0.5;
      }
    } else {
      c.mesh.position.set(c.agent.x, h, c.agent.z);

      const dx = c.agent.targetX - c.agent.x;
      const dz = c.agent.targetZ - c.agent.z;
      if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) {
        c.mesh.rotation.y = Math.atan2(dx, dz);
      }
    }
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();
```

运行后你会看到：
- 鹿群在草地上漫步，偶尔停下来吃草
- 鸟在空中盘旋，翅膀上下扇动
- 生物的状态会随时间切换（行走→觅食→休息→行走）

## 生态系统的扩展

更复杂的生态系统可以加入：
- **食物链**：鹿吃草，狼吃鹿。鹿看到狼会逃跑。
- **领地**：每群动物有自己的活动范围，超出范围会自动返回。
- **繁殖**：能量充足的个体会繁殖，种群数量自然增长。
- **昼夜节律**：夜间食肉动物活跃，白天食草动物活跃。

## 练习

1. 添加"狼"类型的生物——看到鹿时会追击，鹿看到狼会逃跑。
2. 给生物添加足迹——在它们走过的地面上留下颜色稍深的点。
3. 实现昼夜循环——夜间降低环境光强度，食草动物大部分进入休息状态。

## 参考答案

### 练习 1
在 CreatureAgent 的 update 中加入距离检测：如果狼和鹿的距离 < 15，狼进入 chase 状态朝鹿移动，鹿进入 flee 状态背离狼移动。

### 练习 2
每隔 0.5 秒在生物当前位置的地形上放置一个深色的扁平圆盘（CircleGeometry），逐渐降低透明度直到消失。

### 练习 3
用 `Math.sin(time * 0.1)` 控制环境光强度。夜间（sin < 0）时鹿的 stateTimer 加速消耗，让它们更快进入 rest 状态。
