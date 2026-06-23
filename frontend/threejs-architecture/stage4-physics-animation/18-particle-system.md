# 粒子系统——GPU 粒子、Transform Feedback、Billboard

## 粒子为什么特殊

一个火焰效果可能需要 5000 个粒子，每个粒子有自己的位置、速度、生命周期。如果每个粒子是一个 Mesh，5000 个 draw call 直接把帧率打到个位数。

粒子系统的核心挑战：高效地更新和渲染大量小型、短命的物体。

## CPU 粒子：Three.js 的 Points

最简单的方案是 `Points`：

```ts
const count = 5000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(count * 3);
const velocities = new Float32Array(count * 3);
const lifetimes = new Float32Array(count);

// 初始化
for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2;
    positions[i * 3 + 1] = Math.random() * 5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
    velocities[i * 3 + 1] = Math.random() * 2 + 1; // 向上
    lifetimes[i] = Math.random();
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const material = new THREE.PointsMaterial({
    size: 0.1,
    color: 0xff6600,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// 每帧更新
function updateParticles(dt: number) {
    for (let i = 0; i < count; i++) {
        lifetimes[i] -= dt;
        if (lifetimes[i] <= 0) {
            // 重置粒子
            positions[i * 3 + 1] = 0;
            lifetimes[i] = Math.random();
        }
        positions[i * 3] += velocities[i * 3] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
    }
    (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
}
```

问题：每帧在 CPU 上更新 5000 × 3 个 float，然后上传到 GPU。粒子数到 10 万级别就扛不住了。

## GPU 粒子：Transform Feedback

WebGL 2.0 的 Transform Feedback 允许 GPU 上的 vertex shader 输出直接写回 buffer，不需要 CPU 介入。这意味着粒子的更新完全在 GPU 上完成。

Three.js 通过 `WebGLTransformFeedback` 支持：

```ts
// Transform Feedback 的核心思路
// Buffer A: 当前帧的粒子状态（位置、速度、生命）
// Buffer B: 下一帧的粒子状态（GPU 写入）
// 每帧交换 A 和 B

const updateMaterial = new THREE.ShaderMaterial({
    vertexShader: `
        in vec3 position;
        in vec3 velocity;
        in float life;

        out vec3 vPosition;
        out vec3 vVelocity;
        out float vLife;

        uniform float deltaTime;

        void main() {
            vLife = life - deltaTime;
            if (vLife <= 0.0) {
                // 重置粒子
                vPosition = vec3(
                    (float(gl_VertexID) / 5000.0 - 0.5) * 2.0,
                    0.0,
                    0.0
                );
                vVelocity = vec3(0.0, 2.0 + random() * 2.0, 0.0);
                vLife = 1.0;
            } else {
                vPosition = position + velocity * deltaTime;
                vVelocity = velocity + vec3(0.0, -9.8, 0.0) * deltaTime;
            }
        }
    `
});
```

实现细节较复杂，社区库如 `three-nebula` 或 `gpu-compute-particles` 可以直接用。

## GPU Compute（另一种方案）

用 RenderTarget（纹理）存储粒子状态，通过全屏 quad 的 fragment shader 更新：

```ts
// 粒子状态存在纹理里
// 每个像素 = 一个粒子
// R,G,B = x,y,z 位置
// A = 生命

const size = Math.ceil(Math.sqrt(count)); // 71x71 = 5041 个粒子
const stateTexture = new THREE.DataTexture(
    new Float32Array(size * size * 4),
    size, size,
    THREE.RGBAFormat,
    THREE.FloatType
);

// 更新 shader
const updateShader = {
    uniforms: {
        tState: { value: stateTexture },
        deltaTime: { value: 0.016 }
    },
    fragmentShader: `
        uniform sampler2D tState;
        uniform float deltaTime;
        varying vec2 vUv;

        void main() {
            vec4 state = texture2D(tState, vUv);
            vec3 position = state.rgb;
            float life = state.a - deltaTime;

            if (life <= 0.0) {
                position = vec3(0.0);
                life = 1.0;
            } else {
                position.y += 2.0 * deltaTime;
            }

            gl_FragColor = vec4(position, life);
        }
    `
};
```

渲染时，用另一个 shader 从状态纹理读取位置，画点：

```ts
const renderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        tState: { value: stateTexture },
        pointSize: { value: 3.0 }
    },
    vertexShader: `
        uniform sampler2D tState;
        uniform float pointSize;
        varying float vLife;

        void main() {
            // 从纹理读取位置
            vec2 uv = position.xy; // 用顶点的 xy 作为 UV
            vec4 state = texture2D(tState, uv);
            vLife = state.a;

            vec4 mvPosition = modelViewMatrix * vec4(state.rgb, 1.0);
            gl_PointSize = pointSize * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying float vLife;
        void main() {
            gl_FragColor = vec4(1.0, vLife, 0.0, vLife);
        }
    `
});
```

## Billboard：面向相机的粒子

粒子通常是 2D 图片（火焰、烟雾、光晕），需要始终面向相机。这就是 Billboard（广告牌）效果。

在 shader 里实现：

```glsl
// vertex shader
uniform vec3 cameraRight;
uniform vec3 cameraUp;

void main() {
    vec3 center = position;
    vec2 offset = uv * size; // uv 是 -1 到 +1

    vec3 worldPos = center
        + cameraRight * offset.x
        + cameraUp * offset.y;

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}
```

Three.js 的 `Sprite` 内置了 Billboard 行为，但自定义粒子通常需要自己写。

## 粒子系统的常见效果

**火焰**：橙色粒子从下往上，逐渐变大、变透明。Additive blending。

**烟雾**：灰色粒子缓慢上升，左右摆动。Alpha blending，深度写入。

**爆炸**：所有粒子从中心向外发射，速度随机，快速衰减。

**雨滴**：高速下落的细长粒子，不旋转。

**光晕**：小尺寸、高亮度、Additive blending。用于能量效果。

## 练习

### 练习一：实现 CPU 粒子系统

创建一个火焰效果的粒子系统。要求：

- 5000 个粒子
- 从中心向上发射
- 每个粒子有随机的水平偏移
- 生命结束时重置到底部
- 颜色从橙色渐变到红色

### 练习二：粒子性能测试

逐步增加粒子数量（1000、5000、10000、50000），记录每种情况的 FPS 和 CPU 更新耗时。

### 练习三：Billboard 粒子

用自定义 ShaderMaterial 实现 Billboard 粒子。要求每个粒子始终面向相机，且根据距离缩放大小。

---

## 参考答案

### 练习一

```ts
class FireParticles {
    private positions: Float32Array;
    private velocities: Float32Array;
    private lifetimes: Float32Array;
    private geometry: THREE.BufferGeometry;
    private points: THREE.Points;

    constructor(count = 5000) {
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);
        this.lifetimes = new Float32Array(count);

        for (let i = 0; i < count; i++) this.resetParticle(i);

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position',
            new THREE.BufferAttribute(this.positions, 3));

        this.points = new THREE.Points(this.geometry, new THREE.PointsMaterial({
            size: 0.15,
            color: 0xff6600,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
    }

    private resetParticle(i: number) {
        this.positions[i * 3] = (Math.random() - 0.5) * 0.5;
        this.positions[i * 3 + 1] = 0;
        this.positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
        this.velocities[i * 3] = (Math.random() - 0.5) * 0.3;
        this.velocities[i * 3 + 1] = Math.random() * 3 + 1;
        this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        this.lifetimes[i] = Math.random();
    }

    update(dt: number) {
        for (let i = 0; i < this.lifetimes.length; i++) {
            this.lifetimes[i] -= dt;
            if (this.lifetimes[i] <= 0) {
                this.resetParticle(i);
            }
            this.positions[i * 3] += this.velocities[i * 3] * dt;
            this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
            this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
        }
        (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    getObject() { return this.points; }
}
```

### 练习二

预期：
- 1000：60fps，CPU 更新 <1ms
- 5000：60fps，CPU 更新 ~2ms
- 10000：45-60fps，CPU 更新 ~4ms
- 50000：15-30fps，CPU 更新 ~20ms

瓶颈在 CPU 端的循环和 buffer 上传。

### 练习三

```ts
const material = new THREE.ShaderMaterial({
    uniforms: {
        pointSize: { value: 20.0 }
    },
    vertexShader: `
        uniform float pointSize;
        varying float vLife;
        void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = pointSize * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
            vLife = position.y / 5.0; // 用 y 作为生命代理
        }
    `,
    fragmentShader: `
        varying float vLife;
        void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            float alpha = 1.0 - dist * 2.0;
            gl_FragColor = vec4(1.0, vLife, 0.0, alpha * vLife);
        }
    `
});
```
