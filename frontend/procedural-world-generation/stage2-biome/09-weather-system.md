# 天气系统——云、雾、雨、雪的视觉效果

## 天气不是装饰

前几节课生成了地形、植被、水体，但场景看起来还是"假的"——天空太干净，空气太透明，缺少大气层带来的纵深感。真实世界有雾让远处模糊，有云投下阴影，有雨雪让天空变暗。

天气系统的价值不只是好看，它直接影响玩家对空间的感知。雾效定义了"能看到多远"，云影定义了"光照的方向感"，粒子效果定义了"现在的季节和气候"。

## 体积雾：让空气有质感

Three.js 内置了两种雾：`Fog`（线性雾）和 `FogExp2`（指数雾）。线性雾从近处开始逐渐变浓，适合室内场景；指数雾近处淡远处浓，更像真实大气。

```js
scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);
```

但这些只是"距离衰减"——真实的大气散射还有颜色变化。远处的物体偏蓝（大气散射），夕阳时偏暖（瑞利散射）。

## 体积云：用噪声生成的云层

云的本质是一团水蒸气。用噪声生成一个二维密度场，超过阈值的地方就是云。

```js
function createCloudLayer(y, coverage = 0.5, scale = 0.01) {
  const cloudGeo = new THREE.PlaneGeometry(200, 200, 64, 64);
  cloudGeo.rotateX(-Math.PI / 2);

  const posAttr = cloudGeo.attributes.position;
  const alphas = [];

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const density = fbm(x * scale, z * scale, 4) * 0.5 + 0.5;
    alphas.push(density > coverage ? (density - coverage) / (1 - coverage) : 0);
  }

  cloudGeo.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));

  const cloudMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      color: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: `
      attribute float alpha;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(color, vAlpha * 0.6);
      }
    `,
  });

  const cloud = new THREE.Mesh(cloudGeo, cloudMat);
  cloud.position.y = y;
  return cloud;
}
```

## 云影：让光照有变化

云投下的阴影是动态的——随着云的移动，地面上会出现明暗交替的斑块。简单实现：用一个噪声纹理在地面着色器中调制光照强度。

```js
const cloudShadowMaterial = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    void main() {
      vUv = uv;
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    // 简化的 fbm
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += noise(p) * a;
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 cloudUv = vWorldPos.xz * 0.005 + time * 0.02;
      float shadow = fbm(cloudUv);
      shadow = smoothstep(0.3, 0.6, shadow);

      vec3 baseColor = vec3(0.3, 0.55, 0.25);
      vec3 color = baseColor * (0.6 + 0.4 * (1.0 - shadow));
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  uniforms: {
    time: { value: 0 },
  },
});
```

## 雨雪粒子系统

```js
function createRainSystem(count = 5000) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 100;
    positions[i * 3 + 1] = Math.random() * 50;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    velocities[i] = 0.3 + Math.random() * 0.5;
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xaabbcc,
    size: 0.1,
    transparent: true,
    opacity: 0.6,
  });

  const rain = new THREE.Points(geo, mat);
  rain.userData.velocities = velocities;
  return rain;
}

function createSnowSystem(count = 3000) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 100;
    positions[i * 3 + 1] = Math.random() * 50;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    velocities[i * 3] = (Math.random() - 0.5) * 0.02;
    velocities[i * 3 + 1] = 0.02 + Math.random() * 0.05;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.2,
    transparent: true,
    opacity: 0.8,
  });

  const snow = new THREE.Points(geo, mat);
  snow.userData.velocities = velocities;
  return snow;
}

function updateParticles(particles, dt) {
  const pos = particles.geometry.attributes.position;
  const vel = particles.userData.velocities;
  const isRain = vel.length > 100;

  for (let i = 0; i < pos.count; i++) {
    if (isRain) {
      pos.array[i * 3 + 1] -= vel[i] * dt * 60;
    } else {
      pos.array[i * 3] += vel[i * 3] * dt * 60;
      pos.array[i * 3 + 1] -= vel[i * 3 + 1] * dt * 60;
      pos.array[i * 3 + 2] += vel[i * 3 + 2] * dt * 60;
    }

    if (pos.array[i * 3 + 1] < 0) {
      pos.array[i * 3 + 1] = 50;
    }
  }

  pos.needsUpdate = true;
}
```

## 完整场景：带天气的地形

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x99aacc, 0.006);

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

const SIZE = 80;
const SCALE = 60;
const terrainGeo = new THREE.PlaneGeometry(SCALE, SCALE, SIZE - 1, SIZE - 1);
terrainGeo.rotateX(-Math.PI / 2);

const colors = [];
const posAttr = terrainGeo.attributes.position;

for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i);
  const z = posAttr.getZ(i);
  const h = fbm(x / SCALE * 3, z / SCALE * 3) * 10;
  posAttr.setY(i, h);

  const t = (h + 5) / 15;
  const c = new THREE.Color();
  c.setHSL(0.3 - t * 0.25, 0.5, 0.3 + t * 0.3);
  colors.push(c.r, c.g, c.b);
}

terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals();
scene.add(new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true })));

scene.add(createCloudLayer(40, 0.45, 0.008));

const rain = createRainSystem(4000);
scene.add(rain);

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const sun = new THREE.DirectionalLight(0xffeedd, 0.8);
sun.position.set(30, 40, 20);
scene.add(sun);

const clock = new THREE.Clock();
let currentWeather = 'rain';

document.addEventListener('keydown', (e) => {
  if (e.key === '1') currentWeather = 'clear';
  if (e.key === '2') currentWeather = 'rain';
  if (e.key === '3') currentWeather = 'snow';
  if (e.key === '4') currentWeather = 'fog';
});

function updateWeather() {
  rain.visible = currentWeather === 'rain';

  switch (currentWeather) {
    case 'clear':
      scene.fog.density = 0.003;
      scene.background.set(0x87ceeb);
      break;
    case 'rain':
      scene.fog.density = 0.008;
      scene.background.set(0x556677);
      break;
    case 'snow':
      scene.fog.density = 0.01;
      scene.background.set(0xccccdd);
      break;
    case 'fog':
      scene.fog.density = 0.025;
      scene.background.set(0x999999);
      break;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  updateWeather();

  if (rain.visible) {
    updateParticles(rain, dt);
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();
```

运行后按数字键切换天气：1=晴天，2=雨天，3=雪天，4=浓雾。每种天气下背景色、雾的密度都会变化，雨天会有粒子下落。

## 天气与 Biome 的关联

天气不应该全局统一。沙漠不应该下雪，冻原不应该晴空万里。实际项目中会根据玩家所在的 Biome 和随机天气事件来决定当前天气：

```js
function getWeatherForBiome(biome, seed) {
  const roll = seededRandom(seed);
  switch (biome) {
    case 'desert': return roll > 0.9 ? 'sandstorm' : 'clear';
    case 'tundra': return roll > 0.3 ? 'snow' : 'clear';
    case 'tropical': return roll > 0.4 ? 'rain' : 'clear';
    default: return roll > 0.7 ? 'rain' : 'clear';
  }
}
```

## 练习

1. 给雨天添加闪电效果——每隔几秒随机一个方向的强光闪烁。
2. 让云层缓慢移动——在 cloudUv 中加上 `time * speed` 偏移。
3. 添加一个"暴风雪"天气——同时有雪和强雾，能见度极低。

## 参考答案

### 练习 1
在 animate 循环中，用 `Math.random() > 0.998` 概率触发闪电：设置 `sun.intensity = 5`，100ms 后恢复为 0.8。连续闪两次更真实。

### 练习 2
在云层 shader 的 fragmentShader 中，把 `cloudUv` 的计算改为 `vWorldPos.xz * 0.005 + time * vec2(0.02, 0.01)`，云会缓慢向右上方移动。

### 练习 3
同时启用雪粒子和浓雾（density=0.04），背景色设为纯白。粒子数量加倍，大小减半，模拟暴风雪的密集感。
