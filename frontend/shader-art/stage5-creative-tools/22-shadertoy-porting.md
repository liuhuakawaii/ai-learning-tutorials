# 第 22 课：Shadertoy 移植——从 Shadertoy 到 Three.js / WebGPU

Shadertoy 是最好的 Shader 学习平台，但它有围墙——没法在自己的项目里用。这节课讲解如何把 Shadertoy 上的 Shader 迁移到 Three.js 和 WebGPU。

## Shadertoy 的约定

Shadertoy 对用户隐藏了很多底层细节。移植前先了解这些约定：

| Shadertoy | 标准 GLSL / Three.js |
|---|---|
| `mainImage(out vec4 fragColor, in vec2 fragCoord)` | `void main()` + `gl_FragColor` |
| `iResolution`（自动声明） | 需要手动声明 `uniform vec3 iResolution` |
| `iTime`（自动声明） | 需要手动声明 `uniform float iTime` |
| `iMouse`（自动声明） | 需要手动声明 `uniform vec4 iMouse` |
| `iChannel0` 等纹理 | 需要手动绑定 `uniform sampler2D iChannel0` |
| `texture(iChannel0, uv)` | 标准 GLSL 130+ 用 `texture`，WebGL 1 用 `texture2D` |
| 坐标原点在左下角 | Three.js ShaderMaterial 也一样 |
| 输出自动做 gamma 校正 | 需要手动加 `pow(col, vec3(1.0/2.2))` |

## 移植到 Three.js ShaderMaterial

Three.js 的 `ShaderMaterial` 接受自定义的顶点和片段着色器：

```javascript
import * as THREE from 'three';

const material = new THREE.ShaderMaterial({
    uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector3() },
        iMouse: { value: new THREE.Vector4() }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        precision mediump float;
        uniform float iTime;
        uniform vec3 iResolution;
        uniform vec4 iMouse;
        varying vec2 vUv;

        // 从 Shadertoy 复制的代码，做以下修改：
        // 1. 把 mainImage 改成 main
        // 2. 把 fragCoord 改成 gl_FragCoord.xy
        // 3. 把输出赋值给 gl_FragColor

        void main() {
            vec2 fragCoord = vUv * iResolution.xy;
            vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

            vec3 col = vec3(0.0);
            // ... 原始 Shadertoy 逻辑 ...

            gl_FragColor = vec4(col, 1.0);
        }
    `
});

// 在渲染循环中更新 uniform
function animate(time) {
    material.uniforms.iTime.value = time / 1000;
    material.uniforms.iResolution.value.set(
        window.innerWidth, window.innerHeight, 1
    );
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
```

关键修改：
1. `mainImage(out vec4 fragColor, in vec2 fragCoord)` → `void main()`
2. 赋值 `fragColor = vec4(...)` → 赋值 `gl_FragColor = vec4(...)`
3. 用 `varying vec2 vUv` 和 `iResolution.xy` 重建 `fragCoord`

## 全屏四边形 vs 后处理

两种方式在 Three.js 里使用自定义 Shader：

**方式一：全屏四边形**

```javascript
const geometry = new THREE.PlaneGeometry(2, 2);
const mesh = new THREE.Mesh(geometry, material);
const scene = new THREE.Scene();
scene.add(mesh);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
```

**方式二：EffectComposer 后处理**

```javascript
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

const shaderPass = new ShaderPass({
    uniforms: {
        tDiffuse: { value: null }, // Three.js 自动传入上一个 pass 的输出
        iTime: { value: 0 }
    },
    vertexShader: `...`,
    fragmentShader: `...`
});

composer.addPass(shaderPass);
```

后处理方式适合把 Shadertoy 效果叠加到已有的 3D 场景上。

## 纹理移植

Shadertoy 的 `iChannel0` 对应 Three.js 的纹理 uniform：

```javascript
const loader = new THREE.TextureLoader();
const texture = loader.load('noise.png');
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;

material.uniforms.iChannel0 = { value: texture };
```

Shader 里的采样：
- Shadertoy：`texture(iChannel0, uv)`
- WebGL 1：`texture2D(iChannel0, uv)`
- WebGL 2 / Three.js：`texture(iChannel0, uv)`（Three.js 自动处理兼容性）

## 移植到 WebGPU

WebGPU 的着色语言是 WGSL，和 GLSL 语法差异很大。但 Three.js 的 `WebGPURenderer` 支持通过 TSL（Three Shading Language）写类似 GLSL 的代码：

```javascript
import * as THREE from 'three/webgpu';
import { uniform, vec4, uv, time, sin, cos, length } from 'three/tsl';

const material = new THREE.MeshBasicNodeMaterial();
material.colorNode = vec4(
    sin(uv().x.mul(10).add(time())),
    cos(uv().y.mul(10)),
    0.5,
    1.0
);
```

对于复杂的 Shadertoy Shader，更实际的做法是用 `wgslFn` 直接写 WGSL：

```javascript
import { wgslFn } from 'three/tsl';

const shader = wgslFn(`
    @fragment
    fn main(@builtin(frag_coord) fragCoord: vec4f) -> @location(0) vec4f {
        let uv = (fragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
        // ... WGSL 代码 ...
        return vec4f(col, 1.0);
    }
`);
```

## 常见移植坑

1. **精度问题**：Shadertoy 默认 `highp`，Three.js 默认 `mediump`。加 `precision highp float;`。

2. **纹理坐标**：Three.js 的纹理坐标原点在左上角（y 轴向下），Shadertoy 在左下角。用 `vec2 uv = vec2(vUv.x, 1.0 - vUv.y);` 翻转。

3. **gamma 校正**：Shadertoy 输出设置里有 sRGB 选项。Three.js 默认不做，需要手动加 `pow(col, vec3(1.0/2.2))` 或设置 `renderer.outputColorSpace = THREE.SRGBColorSpace`。

4. **iMouse 行为**：Three.js 不提供 `iMouse`，需要自己监听鼠标事件并传入 uniform。

5. **音频纹理**：Shadertoy 的 `iChannel0` 频谱数据在 Three.js 里需要用 Web Audio API 的 AnalyserNode 生成。

## 完整移植示例

把一个 Shadertoy 旋涡星系移植到 Three.js：

```javascript
// Shadertoy 原始代码（省略 noise 函数）
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float r = length(uv);
    float angle = atan(uv.y, uv.x);
    float spiral = sin(angle * 3.0 - r * 15.0 + iTime * 0.5);
    spiral *= exp(-r * 2.5);
    vec3 col = mix(vec3(0.05, 0.02, 0.1), vec3(0.8, 0.6, 1.0), spiral * 0.5 + 0.5);
    fragColor = vec4(col, 1.0);
}

// Three.js 移植
const galaxyMaterial = new THREE.ShaderMaterial({
    uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1) }
    },
    fragmentShader: `
        precision highp float;
        uniform float iTime;
        uniform vec3 iResolution;

        void main() {
            vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
            float r = length(uv);
            float angle = atan(uv.y, uv.x);
            float spiral = sin(angle * 3.0 - r * 15.0 + iTime * 0.5);
            spiral *= exp(-r * 2.5);
            vec3 col = mix(vec3(0.05, 0.02, 0.1), vec3(0.8, 0.6, 1.0), spiral * 0.5 + 0.5);
            gl_FragColor = vec4(col, 1.0);
        }
    `
});
```

## 练习

1. 把第一课的渐变 Shader 移植到 Three.js ShaderMaterial。
2. 给 Three.js 版本加上鼠标交互（iMouse uniform）。
3. 把一个使用 `iChannel0` 纹理的 Shadertoy 作品移植到 Three.js。

## 参考答案

### 练习 1

```javascript
const material = new THREE.ShaderMaterial({
    uniforms: {
        iResolution: { value: new THREE.Vector3() }
    },
    fragmentShader: `
        precision mediump float;
        uniform vec3 iResolution;
        void main() {
            vec2 uv = gl_FragCoord.xy / iResolution.xy;
            vec3 col = mix(vec3(0.1, 0.2, 0.8), vec3(0.9, 0.3, 0.2), uv.x);
            gl_FragColor = vec4(col, 1.0);
        }
    `
});
```

### 练习 2

```javascript
// JavaScript 端
window.addEventListener('mousemove', e => {
    material.uniforms.iMouse.value.set(e.clientX, window.innerHeight - e.clientY, 0, 0);
});
window.addEventListener('mousedown', e => {
    material.uniforms.iMouse.value.z = e.clientX;
    material.uniforms.iMouse.value.w = window.innerHeight - e.clientY;
});
```

### 练习 3

```javascript
const loader = new THREE.TextureLoader();
const noiseTexture = loader.load('noise.png');
noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;

material.uniforms.iChannel0 = { value: noiseTexture };

// Shader 中
uniform sampler2D iChannel0;
// ...
vec4 tex = texture2D(iChannel0, uv);
```
