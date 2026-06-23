# 后处理架构——EffectComposer 的 Chain 设计、自定义 Pass

## 渲染到纹理：后处理的基础

正常的渲染流程是直接画到屏幕上。后处理的思路是：先画到一张纹理（RenderTarget），然后对这张纹理做图像处理，最后把处理结果画到屏幕。

这和图片编辑软件的滤镜链一样——每一步都是"输入一张图，输出一张图"。

## EffectComposer 的架构

Three.js 的后处理通过 `EffectComposer` 实现。它管理一条 Pass 链：

```ts
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

const composer = new EffectComposer(renderer);

// Pass 1：正常渲染场景到纹理
composer.addPass(new RenderPass(scene, camera));

// Pass 2：泛光效果
composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5, // strength
    0.4, // radius
    0.85 // threshold
));

// Pass 3：自定义后处理
composer.addPass(new ShaderPass(customShader));

// 替代 renderer.render()
function animate() {
    composer.render();
}
```

## 内部工作原理

EffectComposer 维护两个 RenderTarget（读/写），Pass 链在它们之间交替：

```
RenderTarget A ← RenderPass（场景渲染到 A）
RenderTarget B ← BloomPass（读 A，写 B）
RenderTarget A ← VignettePass（读 B，写 A）
屏幕 ← CopyPass（读 A，画到屏幕）
```

最后一个 Pass 的 `renderToScreen = true`，直接画到默认帧缓冲区。

```ts
// EffectComposer.render() 简化版
render() {
    for (let i = 0; i < this.passes.length; i++) {
        const pass = this.passes[i];

        if (pass.renderToScreen) {
            // 画到屏幕
            this.renderer.setRenderTarget(null);
        } else {
            // 画到另一个 RenderTarget
            this.renderer.setRenderTarget(this.writeBuffer);
            [this.readBuffer, this.writeBuffer] = [this.writeBuffer, this.readBuffer];
        }

        pass.render(this.renderer, this.writeBuffer, this.readBuffer);
    }
}
```

## Pass 的接口

每个 Pass 需要实现：

```ts
class Pass {
    enabled = true;
    renderToScreen = false;
    needsSwap = true; // 是否需要交换读写缓冲区

    setSize(width: number, height: number) {}

    render(
        renderer: THREE.WebGLRenderer,
        writeBuffer: THREE.WebGLRenderTarget,
        readBuffer: THREE.WebGLRenderTarget
    ) {}
}
```

`needsSwap` 是个关键设计。如果一个 Pass 只是读取输入（比如屏幕空间阴影），不需要写入，设为 `false` 可以省掉一次纹理拷贝。

## 自定义 ShaderPass

最常用的自定义方式是 `ShaderPass`，它接受一个 Three.js 格式的 shader 对象：

```ts
const vignetteShader = {
    uniforms: {
        tDiffuse: { value: null }, // 输入纹理
        offset: { value: 1.0 },
        darkness: { value: 1.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;

        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
            float vignette = 1.0 - dot(uv, uv);
            texel.rgb *= mix(1.0 - darkness, 1.0, vignette);
            gl_FragColor = texel;
        }
    `
};

const vignettePass = new ShaderPass(vignetteShader);
composer.addPass(vignettePass);
```

## 常见后处理效果的实现思路

**Bloom（泛光）**：提取高亮区域 → 多次高斯模糊 → 和原图叠加。需要多个 Pass。

**SSAO（屏幕空间环境光遮蔽）**：读取深度缓冲区 → 采样周围像素 → 计算遮蔽因子。需要深度纹理。

**Tone Mapping（色调映射）**：把 HDR 颜色映射到 LDR。单 Pass，逐像素操作。

**FXAA/SMAA（抗锯齿）**：基于边缘检测的模糊。单 Pass。

## 后处理的性能代价

每增加一个 Pass：

- 多一次全屏渲染（draw call）
- 多一次纹理读写
- 如果分辨率不降级，每 Pass 的像素数 = 屏幕分辨率

1920×1080 屏幕上，一个全屏 Pass 处理 207 万个像素。3 个 Pass 就是 600 万像素的处理量。

优化策略：

1. **降低渲染分辨率**：后处理 Pass 在半分辨率下运行
2. **合并 Pass**：把多个效果写到一个 shader 里
3. **跳过不需要的 Pass**：如果场景没有高亮物体，跳过 Bloom

```ts
// 降低后处理分辨率
const composer = new EffectComposer(renderer);
composer.setSize(
    window.innerWidth / 2,  // 半分辨率
    window.innerHeight / 2
);
```

## 自定义 Pass 的进阶用法

如果 ShaderPass 不够用，可以继承 Pass 实现完全自定义的逻辑：

```ts
class CustomPass extends Pass {
    private _material: THREE.ShaderMaterial;
    private _fsQuad: FullScreenQuad;

    constructor() {
        super();
        this._material = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                time: { value: 0 }
            },
            vertexShader: `...`,
            fragmentShader: `...`
        });
        this._fsQuad = new FullScreenQuad(this._material);
    }

    render(renderer, writeBuffer, readBuffer) {
        this._material.uniforms.tDiffuse.value = readBuffer.texture;
        this._material.uniforms.time.value = performance.now() * 0.001;

        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
        } else {
            renderer.setRenderTarget(writeBuffer);
        }
        this._fsQuad.render(renderer);
    }
}
```

## 练习

### 练习一：实现自定义后处理效果

实现一个"像素化"后处理效果：

- uniform `pixelSize` 控制像素块大小
- 输出图像被分块，每块取中心像素的颜色

### 练习二：多 Pass 链性能测试

创建一个包含 5 个 ShaderPass 的后处理链（vignette + pixelate + color grading + film grain + output）。逐步禁用 Pass，记录每种情况的帧时间。

### 练习三：深度纹理后处理

利用 `DepthTexture` 实现一个简单的雾效：

- 读取深度缓冲区
- 根据深度计算雾的浓度
- 在 fragment shader 中混合雾色和场景颜色

```ts
// 获取深度纹理
const depthTexture = new THREE.DepthTexture();
renderTarget.depthTexture = depthTexture;
```

---

## 参考答案

### 练习一

```ts
const pixelateShader = {
    uniforms: {
        tDiffuse: { value: null },
        pixelSize: { value: 4.0 },
        resolution: { value: new THREE.Vector2() }
    },
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float pixelSize;
        uniform vec2 resolution;
        varying vec2 vUv;
        void main() {
            vec2 dxy = pixelSize / resolution;
            vec2 coord = dxy * floor(vUv / dxy) + dxy * 0.5;
            gl_FragColor = texture2D(tDiffuse, coord);
        }
    `
};
```

### 练习二

预期：每增加一个 Pass，帧时间增加约 0.5-2ms（取决于分辨率和 GPU）。5 个 Pass 在 1080p 下可能增加 3-10ms。

### 练习三

```ts
const fogShader = {
    uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        fogColor: { value: new THREE.Color(0xcccccc) },
        fogNear: { value: 10 },
        fogFar: { value: 100 },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 1000 },
        projectionMatrixInverse: { value: new THREE.Matrix4() },
        viewMatrixInverse: { value: new THREE.Matrix4() }
    },
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        varying vec2 vUv;

        void main() {
            float depth = texture2D(tDepth, vUv).x;
            float z = fogNear * fogFar / (fogFar - depth * (fogFar - fogNear));
            float fogFactor = smoothstep(fogNear, fogFar, z);
            vec4 color = texture2D(tDiffuse, vUv);
            gl_FragColor = vec4(mix(color.rgb, fogColor, fogFactor), color.a);
        }
    `
};
```
