# 材质系统——ShaderMaterial vs RawShaderMaterial、uniform 管理、材质缓存

## 材质不是"颜色"，是渲染指令

把材质理解为"给物体上色"是最大的误解。材质定义的是整个渲染过程——用什么 shader、怎么处理光照、怎么混合透明度、怎么写入深度。MeshStandardMaterial 背后是数百行 GLSL 代码和几十个 uniform。

理解材质系统，才能做出自定义效果，也才能理解为什么材质切换那么贵。

## Three.js 材质的继承结构

```
Material
├── ShaderMaterial          # 用户写 shader，Three.js 帮你加公共 uniform
├── RawShaderMaterial       # 用户写 shader，Three.js 什么都不加
├── MeshBasicMaterial       # 无光照
├── MeshStandardMaterial    # PBR 光照
│   ├── MeshPhysicalMaterial  # PBR + 清漆/透射
├── LineBasicMaterial
├── PointsMaterial
└── SpriteMaterial
```

每种内置材质都对应一组预定义的 shader 代码。Three.js 在运行时把这些代码拼接起来，根据材质参数生成最终的 shader 源码。

## ShaderMaterial vs RawShaderMaterial

**ShaderMaterial**：Three.js 自动注入公共 uniform 和 attribute 声明。你只需要写 `main()` 和自定义部分。

```ts
const material = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xff0000) }
    },
    vertexShader: `
        // Three.js 自动注入：
        // uniform mat4 projectionMatrix;
        // uniform mat4 modelViewMatrix;
        // attribute vec3 position;

        uniform float time;
        varying vec2 vUv;

        void main() {
            vUv = uv;
            vec3 pos = position;
            pos.y += sin(time + position.x) * 0.5;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 color;
        varying vec2 vUv;
        void main() {
            gl_FragColor = vec4(color * vUv.x, 1.0);
        }
    `
});
```

**RawShaderMaterial**：Three.js 不注入任何东西。你需要自己声明所有 uniform 和 attribute。

```ts
const material = new THREE.RawShaderMaterial({
    uniforms: {
        projectionMatrix: { value: null }, // 你需要自己传
        modelViewMatrix: { value: null },
        time: { value: 0 }
    },
    vertexShader: `
        precision highp float;

        uniform mat4 projectionMatrix;
        uniform mat4 modelViewMatrix;
        attribute vec3 position;

        void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    // ...
});
```

什么时候用 RawShaderMaterial？

- 需要完全控制 GLSL 版本和精度声明
- 需要和外部 shader 代码集成
- 不想依赖 Three.js 的自动注入机制

大多数情况用 ShaderMaterial 就够了。

## Uniform 管理：值的传递机制

材质的 `uniforms` 对象是 shader 和 JavaScript 之间的桥梁。

```ts
// 定义
uniforms: {
    time: { value: 0.0 },
    color: { value: new THREE.Color(0xff0000) }
}

// 更新
material.uniforms.time.value = performance.now() * 0.001;
```

Three.js 支持的 uniform 类型：

| JS 类型 | GLSL 类型 |
|---|---|
| `number` | `float` |
| `Vector2` | `vec2` |
| `Vector3` | `vec3` |
| `Color` | `vec3` |
| `Matrix3` | `mat3` |
| `Matrix4` | `mat4` |
| `Texture` | `sampler2D` |
| `Texture[]` | `sampler2D[]` |

重要细节：uniform 的值是引用类型时（Vector3、Color、Matrix4），修改 `.value` 的属性不会自动触发更新。你需要整体赋值或设 `needsUpdate`。

```ts
// 不会触发更新（只改了属性）
material.uniforms.color.value.r = 1.0;

// 会触发更新（整体赋值）
material.uniforms.color.value = new THREE.Color(1, 0, 0);

// 或者手动标记（对 Texture 类型有效）
material.uniforms.map.value = newTexture;
material.uniforms.map.value.needsUpdate = true;
```

## 材质缓存：ShaderProgram 的复用

Three.js 为每个材质生成一个 hash，相同 hash 的材质共享同一个 `WebGLProgram`（编译好的 shader）。

hash 的计算包括：

- 材质类型
- shader 代码
- 关键参数（wireframe、skinning、morphTargets 等）

```ts
// 两个 ShaderMaterial，shader 代码完全相同
const mat1 = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs });
const mat2 = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs });
// mat1 和 mat2 的 hash 不同（因为参数组合不同），但可能共享 program
```

内置材质的 shader 代码是动态拼接的。拼接结果取决于材质参数：

```ts
new THREE.MeshStandardMaterial({
    map: texture,           // 加 #define USE_MAP
    normalMap: normalMap,   // 加 #define USE_NORMALMAP
    metalness: 0.8,         // 影响 uniform
});
```

每种参数组合都会产生不同的 shader 代码，需要编译不同的 program。

## onBeforeCompile：内置材质的 hack

如果你想修改内置材质的 shader 但不想从头写，可以用 `onBeforeCompile`：

```ts
material.onBeforeCompile = (shader) => {
    // shader 是 Three.js 生成的完整 shader 对象
    shader.uniforms.time = { value: 0 };

    // 在 fragment shader 的 main() 之前插入代码
    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        uniform float time;
        `
    );

    // 在输出之前修改颜色
    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        gl_FragColor.rgb += sin(time) * 0.1;
        #include <dithering_fragment>
        `
    );
};

// 每帧更新
material.onBeforeCompile(shader => {
    shader.uniforms.time.value = performance.now() * 0.001;
});
```

这个技巧在 Three.js 社区很常见，但要注意：它依赖 shader 源码的特定位置标记，Three.js 版本升级可能破坏它。

## 材质的 GPU 资源管理

材质的 GPU 资源（shader program、texture）在第一次使用时创建，在材质被 dispose 时释放：

```ts
material.dispose(); // 释放 GPU 资源
```

如果你不 dispose，GPU 资源会一直占用。这是内存泄漏的常见来源——特别是动态创建材质的场景。

```ts
// 内存泄漏
function createBox() {
    const material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    // 如果后来 remove 了 mesh，但没 dispose material → shader program 泄漏
}
```

## 练习

### 练习一：自定义 ShaderMaterial

创建一个 ShaderMaterial，实现"扫描线"效果：

- uniform `time` 控制扫描线位置
- uniform `lineColor` 控制扫描线颜色
- 扫描线从下往上移动

### 练习二：材质复用实验

创建 100 个 Mesh，分三种情况：

1. 每个 Mesh 独立 new ShaderMaterial（代码相同）
2. 所有 Mesh 共享一个 material 实例
3. 所有 Mesh 用同一个 material，但 clone() 后赋值

用 `renderer.info.programs` 检查 shader program 数量。

### 练习三：onBeforeCompile 实验

给 MeshStandardMaterial 添加一个 `noiseMap`，在 fragment shader 中用噪声扰动法线，制造粗糙表面效果。要求用 onBeforeCompile 实现，不写全新 shader。

---

## 参考答案

### 练习一

```ts
const material = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        lineColor: { value: new THREE.Color(0x00ff00) },
        lineWidth: { value: 0.02 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec3 lineColor;
        uniform float lineWidth;
        varying vec2 vUv;
        void main() {
            float scan = smoothstep(time - lineWidth, time, vUv.y)
                       - smoothstep(time, time + lineWidth, vUv.y);
            vec3 color = mix(vec3(0.2), lineColor, scan);
            gl_FragColor = vec4(color, 1.0);
        }
    `
});

// 动画循环
function animate() {
    material.uniforms.time.value = (performance.now() * 0.0005) % 1.0;
}
```

### 练习二

1. 独立 new：`renderer.info.programs` 可能显示多个 program（取决于 hash 是否相同）
2. 共享实例：只有 1 个 program
3. clone()：clone 不会复制 shader program，仍然共享同一个 program

### 练习三

核心思路：

```ts
material.onBeforeCompile = (shader) => {
    shader.uniforms.noiseMap = { value: noiseTexture };
    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `
        #include <normal_fragment_maps>
        vec3 noiseNormal = texture2D(noiseMap, vUv).rgb * 2.0 - 1.0;
        normal = normalize(normal + noiseNormal * 0.3);
        `
    );
};
```
