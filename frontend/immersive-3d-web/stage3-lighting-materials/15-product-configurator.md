# 阶段实战：构建实时产品配置器

## 目标

做一个产品材质/颜色配置器——用户可以实时切换产品的材质、颜色、环境光照，看到 PBR 渲染的真实效果。

视觉效果：一个耳机模型悬浮在场景中央，左侧面板可以选择材质（金属、塑料、木纹、陶瓷），右侧选择颜色，顶部切换环境（室内、户外、夜景）。所有切换都有平滑过渡。

## 页面布局

```html
<body>
  <canvas id="scene"></canvas>
  <div class="controls">
    <div class="material-panel">
      <button data-material="metal">拉丝金属</button>
      <button data-material="plastic">磨砂塑料</button>
      <button data-material="wood">胡桃木</button>
      <button data-material="ceramic">陶瓷</button>
    </div>
    <div class="color-panel">
      <div class="color-swatch" data-color="#1a1a2e"></div>
      <div class="color-swatch" data-color="#e94560"></div>
      <div class="color-swatch" data-color="#0f3460"></div>
      <div class="color-swatch" data-color="#f5f5dc"></div>
    </div>
    <div class="env-panel">
      <button data-env="studio">摄影棚</button>
      <button data-env="outdoor">户外</button>
      <button data-env="night">夜景</button>
    </div>
  </div>
</body>
```

## 材质预设

```ts
interface MaterialPreset {
  metalness: number
  roughness: number
  anisotropy: number
  clearcoat: number
  clearcoatRoughness: number
  sheen: number
  sheenColor?: Color
  transmission: number
  thickness: number
  ior: number
}

const presets: Record<string, MaterialPreset> = {
  metal: {
    metalness: 1.0,
    roughness: 0.25,
    anisotropy: 0.7,
    clearcoat: 0,
    clearcoatRoughness: 0,
    sheen: 0,
    transmission: 0,
    thickness: 0,
    ior: 1.5,
  },
  plastic: {
    metalness: 0.0,
    roughness: 0.4,
    anisotropy: 0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
    sheen: 0.3,
    sheenColor: new Color(0xffffff),
    transmission: 0,
    thickness: 0,
    ior: 1.5,
  },
  wood: {
    metalness: 0.0,
    roughness: 0.7,
    anisotropy: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
    sheen: 0,
    transmission: 0,
    thickness: 0,
    ior: 1.5,
  },
  ceramic: {
    metalness: 0.0,
    roughness: 0.1,
    anisotropy: 0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    sheen: 0,
    transmission: 0.1,
    thickness: 0.5,
    ior: 1.6,
  },
}
```

## 平滑过渡

材质切换不是瞬间替换，用 GSAP 动画过渡：

```ts
import gsap from "gsap"

const material = new MeshPhysicalMaterial({
  color: 0x1a1a2e,
  metalness: 0,
  roughness: 0.4,
})

function switchMaterial(presetName: string) {
  const target = presets[presetName]
  gsap.to(material, {
    metalness: target.metalness,
    roughness: target.roughness,
    clearcoat: target.clearcoat,
    clearcoatRoughness: target.clearcoatRoughness,
    sheen: target.sheen,
    transmission: target.transmission,
    thickness: target.thickness,
    ior: target.ior,
    duration: 0.8,
    ease: "power2.inOut",
  })
}
```

## 颜色切换

```ts
const colorSwatches = document.querySelectorAll(".color-swatch")
colorSwatches.forEach(swatch => {
  swatch.addEventListener("click", () => {
    const hex = swatch.getAttribute("data-color")!
    const targetColor = new Color(hex)
    const currentColor = material.color.clone()

    gsap.to(currentColor, {
      r: targetColor.r,
      g: targetColor.g,
      b: targetColor.b,
      duration: 0.5,
      onUpdate: () => {
        material.color.copy(currentColor)
      },
    })
  })
})
```

## 环境切换

```ts
const envMaps: Record<string, Texture> = {}

async function loadEnvironments() {
  const pmrem = new PMREMGenerator(renderer)
  const loader = new RGBELoader()

  const [studio, outdoor, night] = await Promise.all([
    loader.loadAsync("studio.hdr"),
    loader.loadAsync("outdoor.hdr"),
    loader.loadAsync("night.hdr"),
  ])

  envMaps.studio = pmrem.fromEquirectangular(studio).texture
  envMaps.outdoor = pmrem.fromEquirectangular(outdoor).texture
  envMaps.night = pmrem.fromEquirectangular(night).texture
}

function switchEnvironment(name: string) {
  // 瞬间切换（环境贴图没法平滑过渡）
  scene.environment = envMaps[name]

  // 背景模糊过渡
  scene.backgroundBlurriness = 1
  scene.background = envMaps[name]
  gsap.to(scene, {
    backgroundBlurriness: 0,
    duration: 1,
    ease: "power2.out",
  })
}
```

## 模型悬浮动画

产品不停旋转和悬浮，即使不操作也在动：

```ts
function animate() {
  requestAnimationFrame(animate)

  const time = clock.getElapsedTime()

  // 悬浮
  model.position.y = Math.sin(time * 1.5) * 0.1

  // 缓慢旋转
  model.rotation.y += 0.003

  renderer.render(scene, camera)
}
```

## 最终效果描述

页面中央悬浮着一个耳机模型，表面是拉丝金属质感，缓慢旋转。左侧点击"磨砂塑料"，金属光泽逐渐消退，表面变得柔和，高光从锐利变为弥散。再点击"陶瓷"，表面变得光滑如镜，带有清漆层的双层高光。

右侧色板切换到红色，耳机表面从深蓝平滑过渡到热烈的红色。顶部切换到户外环境，耳机表面反射出蓝天白云，暗部充满来自地面的间接光。

## 练习

### 练习一：添加程序化纹理

为"木纹"材质添加程序化纹理。在 fragment shader 中用 FBM 生成木纹图案，映射到材质的 color 和 roughness 上。木纹方向应该跟随模型的 UV 坐标。

### 练习二：截图功能

添加一个"截图"按钮，点击后用 `renderer.domElement.toDataURL()` 保存当前画面。更高级的做法是用 `renderer.readPixels` 读取高分辨率渲染结果（比如 4K），然后下载为 PNG。

---

## 参考答案

### 练习一

**思路**：自定义 ShaderMaterial 替代木纹的 MeshPhysicalMaterial。

```ts
const woodMaterial = new ShaderMaterial({
  uniforms: {
    uScale: { value: 8.0 },
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vViewDir = -normalize(mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    uniform float uScale;
    varying vec2 vUv;
    varying vec3 vNormal;
    
    // ... noise functions ...
    
    void main() {
      vec2 p = vUv * uScale;
      float noise = fbm(p, 4);
      float dist = length(p - vec2(0.5)) * 20.0 + noise * 5.0;
      float ring = fract(dist);
      float ringValue = smoothstep(0.3, 0.5, ring) - smoothstep(0.5, 0.7, ring);
      
      vec3 lightWood = vec3(0.8, 0.5, 0.2);
      vec3 darkWood = vec3(0.4, 0.2, 0.05);
      vec3 color = mix(lightWood, darkWood, ringValue);
      
      // 简单光照
      vec3 light = normalize(vec3(1.0, 1.0, 1.0));
      float diff = max(dot(vNormal, light), 0.0);
      
      gl_FragColor = vec4(color * (0.3 + 0.7 * diff), 1.0);
    }
  `,
})
```

### 练习二

**思路**：高分辨率离屏渲染 + 截图下载。

```ts
function takeScreenshot(resolution: number = 3840) {
  const aspect = innerWidth / innerHeight
  const width = resolution
  const height = resolution / aspect

  // 创建离屏渲染目标
  const renderTarget = new WebGLRenderTarget(width, height)

  // 临时改变相机和 renderer
  const originalSize = renderer.getSize(new Vector2())
  camera.aspect = aspect
  camera.updateProjectionMatrix()

  renderer.setSize(width, height)
  renderer.setRenderTarget(renderTarget)
  renderer.render(scene, camera)
  renderer.setRenderTarget(null)

  // 读取像素
  const pixels = new Uint8Array(width * height * 4)
  renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels)

  // 创建 canvas 并下载
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  const imageData = ctx.createImageData(width, height)
  imageData.data.set(pixels)
  ctx.putImageData(imageData, 0, 0)

  // 翻转 Y 轴（WebGL 坐标系和 Canvas 相反）
  ctx.scale(1, -1)
  ctx.drawImage(canvas, 0, -height)

  const link = document.createElement("a")
  link.download = "product-screenshot.png"
  link.href = canvas.toDataURL("image/png")
  link.click()

  // 恢复
  renderer.setSize(originalSize.x, originalSize.y)
  camera.aspect = originalSize.x / originalSize.y
  camera.updateProjectionMatrix()
  renderTarget.dispose()
}
```

**常见错误**：`readRenderTargetPixels` 读出的像素是 Y 轴翻转的，需要在 canvas 上做翻转。另外高分辨率截图会导致短暂卡顿，可以显示一个 loading 提示。
