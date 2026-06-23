# 环境光——IBL、反射探针、动态天空

## 直接光不够真实

一个金属球放在白色房间里，你看到的不只是球面上的高光——还有墙壁在球面上的反射、地面反弹的间接光、从窗户进来的漫射天光。这些间接光照占了真实场景光照的 60-80%。

如果只打一盏 DirectionalLight，金属球看起来会很"假"——暗部死黑，没有层次。

## IBL（Image-Based Lighting）

IBL 用一张 HDR 全景图作为光源。每个像素方向上的 HDR 值就是那个方向射来的光。

原理：在 shader 里对 HDR 环境图做**卷积**：

- **漫反射**：对环境图做半球积分（pre-filtered irradiance map）
- **镜面反射**：用粗糙度作为 mip level 采样（pre-filtered environment map）
- **BRDF 查找表**：预计算菲涅尔和几何遮蔽

```ts
import { PMREMGenerator } from "three"

const pmrem = new PMREMGenerator(renderer)
pmrem.compileEquirectangularShader()

// 加载 HDR
const hdrTexture = await new RGBELoader().loadAsync("studio.hdr")
const envMap = pmrem.fromEquirectangular(hdrTexture).texture

scene.environment = envMap  // 所有 PBR 材质自动使用
scene.background = envMap   // 用作背景
```

`scene.environment` 设一次，场景中所有 MeshStandardMaterial 和 MeshPhysicalMaterial 自动使用它做 IBL。

## 反射探针（Reflection Probe）

IBL 给整个场景一个统一的环境。但如果你的场景里有两个房间，每个房间的环境不同——需要用反射探针。

反射探针在某个位置拍一张立方体贴图（Cubemap），附近的物体用这张 cubemap 做反射：

```ts
import { CubeCamera, WebGLCubeRenderTarget } from "three"

const cubeRenderTarget = new WebGLCubeRenderTarget(256)
const cubeCamera = new CubeCamera(0.1, 100, cubeRenderTarget)

// 每帧更新探针
cubeCamera.position.set(roomCenter.x, roomCenter.y, roomCenter.z)
cubeCamera.update(renderer, scene)

// 附近的物体使用这张 cubemap
nearbyMesh.material.envMap = cubeRenderTarget.texture
```

## 动态天空

静态 HDR 环境图是固定的。动态天空可以让云飘动、太阳移动、昼夜变化。

Three.js 内置了 `Sky` 对象：

```ts
import { Sky } from "three/examples/jsm/objects/Sky.js"

const sky = new Sky()
sky.scale.setScalar(10000)
scene.add(sky)

const sun = new Vector3()
const uniforms = sky.material.uniforms

uniforms.turbidity.value = 10      // 浑浊度
uniforms.rayleigh.value = 2        // 瑞利散射
uniforms.mieCoefficient.value = 0.005
uniforms.mieDirectionalG.value = 0.8

// 太阳位置
function setSunPosition(elevation: number, azimuth: number) {
  const phi = MathUtils.degToRad(90 - elevation)
  const theta = MathUtils.degToRad(azimuth)
  sun.setFromSphericalCoords(1, phi, theta)
  uniforms.sunPosition.value.copy(sun)
}
```

把 Sky 作为背景后，可以用它的辐照度数据更新场景光照：

```ts
// 用 sky 的辐照度更新环境
const renderTarget = pmrem.fromScene(sky)
scene.environment = renderTarget.texture
```

## 多环境切换的过渡

产品页面常在不同场景间切换：室内 → 户外 → 夜景。

直接切换 `scene.environment` 会有一帧的突变。平滑过渡的方法：

```ts
// 创建两个环境的混合
const envA = pmrem.fromEquirectangular(hdrA).texture
const envB = pmrem.fromEquirectangular(hdrB).texture

// 方法1：用 Mesh 做渐变
const envSphere = new Mesh(
  new SphereGeometry(500, 64, 64),
  new ShaderMaterial({
    uniforms: {
      envA: { value: envA },
      envB: { value: envB },
      mixFactor: { value: 0 },
    },
    vertexShader: `...`,
    fragmentShader: `
      uniform samplerCube envA;
      uniform samplerCube envB;
      uniform float mixFactor;
      varying vec3 vDirection;
      void main() {
        vec3 colorA = texture(envA, vDirection).rgb;
        vec3 colorB = texture(envB, vDirection).rgb;
        gl_FragColor = vec4(mix(colorA, colorB, mixFactor), 1.0);
      }
    `,
    side: BackSide,
  })
)
```

## 环境光与材质的交互

同一材质在不同环境下的表现差异巨大：

| 环境 | 金属效果 | 皮肤效果 |
|------|----------|----------|
| 暗室 + 单灯 | 对比强烈，高光锐利 | 苍白，缺少红润 |
| 阳光户外 | 充满反射细节 | 自然，有血色 |
| 阴天 | 柔和的灰色调 | 均匀，少层次 |
| 霓虹灯 | 彩色反射条纹 | 不自然的色块 |

好的材质调整必须在目标环境下进行。

## 练习

### 练习一：昼夜环境过渡

从一张日间 HDR 环境过渡到夜间 HDR 环境。同时改变 Sky 参数（turbidity、rayleigh）、太阳位置、环境光强度。整个过渡由滚动驱动。

### 练习二：室内反射探针

在一个小房间里放一个金属球。用 CubeCamera 在球的位置实时渲染环境 cubemap，让球面反射出房间的墙壁、地板、天花板。移动球的位置，反射内容自动更新。

---

## 参考答案

### 练习一

**思路**：Sky + 滚动驱动所有参数。

```ts
const sky = new Sky()
const sunPosition = new Vector3()

ScrollTrigger.create({
  trigger: ".wrapper",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    const p = self.progress // 0=正午, 1=午夜
    
    // 太阳从头顶落到地平线以下
    const elevation = 90 - p * 180 // 90° → -90°
    const phi = MathUtils.degToRad(90 - elevation)
    sunPosition.setFromSphericalCoords(1, phi, 0)
    sky.material.uniforms.sunPosition.value.copy(sunPosition)
    
    // 天空参数
    sky.material.uniforms.turbidity.value = 2 + p * 8
    sky.material.uniforms.rayleigh.value = 1 + p * 3
    
    // 环境光强度
    ambientLight.intensity = Math.max(0.05, 1 - p * 1.5)
    
    // 更新环境贴图
    const envMap = pmrem.fromScene(sky).texture
    scene.environment = envMap
    scene.background = envMap
  },
})
```

### 练习二

**思路**：CubeCamera 跟随金属球位置。

```ts
const cubeRenderTarget = new WebGLCubeRenderTarget(512, {
  generateMipmaps: true,
  minFilter: LinearMipmapLinearFilter,
})
const cubeCamera = new CubeCamera(0.1, 100, cubeRenderTarget)

function animate() {
  requestAnimationFrame(animate)
  
  // CubeCamera 跟随球体
  cubeCamera.position.copy(metalSphere.position)
  
  // 临时隐藏球体避免自反射
  metalSphere.visible = false
  cubeCamera.update(renderer, scene)
  metalSphere.visible = true
  
  // 应用 cubemap
  metalSphere.material.envMap = cubeRenderTarget.texture
  metalSphere.material.envMapIntensity = 1.0
  
  renderer.render(scene, camera)
}
```

**常见错误**：CubeCamera 的分辨率不要太高（512 够了），每帧渲染 6 次（立方体 6 面）开销很大。如果环境变化不频繁，可以每 N 帧更新一次。
