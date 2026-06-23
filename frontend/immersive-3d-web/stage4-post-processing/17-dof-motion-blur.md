# 景深与运动模糊——模拟电影镜头效果

## 为什么游戏画面看起来像电影

游戏引擎的"电影模式"通常做两件事：景深（Depth of Field）和运动模糊（Motion Blur）。这两个效果模拟了真实摄像机的物理特性，让画面从"计算机渲染"变成"镜头拍摄"。

## 景深（Depth of Field）

真实镜头只能把一定距离范围内的物体拍清楚，太近或太远的物体会模糊。这个模糊范围由光圈大小决定——光圈越大，景深越浅。

### 实现原理

1. 读取每个像素的深度值（从深度缓冲区）
2. 根据深度计算模糊半径——离焦点越远，模糊越大
3. 对每个像素做圆盘模糊（Bokeh）

```ts
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js"

const bokehPass = new BokehPass(scene, camera, {
  focus: 5.0,       // 焦点距离（单位：世界坐标）
  aperture: 0.025,  // 光圈大小（越大越模糊）
  maxblur: 0.01,    // 最大模糊程度
})
composer.addPass(bokehPass)
```

### 滚动驱动焦点变化

产品展示页中，焦点随滚动改变——前景清晰时背景模糊，反之亦然：

```ts
ScrollTrigger.create({
  trigger: ".wrapper",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    const p = self.progress
    // 焦点从远处慢慢拉到近处
    bokehPass.uniforms.focus.value = 10 - p * 8
    // 光圈也可以变
    bokehPass.uniforms.aperture.value = 0.01 + p * 0.04
  },
})
```

### 自定义 Bokeh Shader

Three.js 内置的 BokehPass 效果一般。更好的做法是用两步高斯模糊 + 深度加权：

```glsl
// fragment shader
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform float focus;
uniform float aperture;
uniform vec2 resolution;

varying vec2 vUv;

float getBlurSize(float depth) {
  float coc = abs(depth - focus) * aperture;
  return clamp(coc, 0.0, 1.0);
}

void main() {
  float depth = texture2D(tDepth, vUv).r;
  float blur = getBlurSize(depth);
  
  vec4 color = vec4(0.0);
  float total = 0.0;
  
  // 圆盘采样
  for (float angle = 0.0; angle < 6.28; angle += 0.3) {
    for (float r = 1.0; r < 8.0; r += 1.0) {
      vec2 offset = vec2(cos(angle), sin(angle)) * r * blur / resolution;
      float sampleDepth = texture2D(tDepth, vUv + offset).r;
      float sampleBlur = getBlurSize(sampleDepth);
      
      // 只采样模糊半径内的像素（避免前景渗透到背景）
      if (sampleBlur >= r / 8.0) {
        color += texture2D(tDiffuse, vUv + offset);
        total += 1.0;
      }
    }
  }
  
  gl_FragColor = color / total;
}
```

## 运动模糊（Motion Blur）

真实摄像机有快门时间——快门打开的那段时间里，移动的物体会拖影。这让快速运动看起来更流畅。

### 基于速度缓冲的运动模糊

1. 渲染每个像素的运动速度（当前帧位置 - 上一帧位置）
2. 沿速度方向对像素做模糊

速度缓冲生成：

```glsl
// vertex shader
uniform mat4 prevModelViewProjection;
varying vec4 vCurPos;
varying vec4 vPrevPos;

void main() {
  vCurPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vPrevPos = prevModelViewProjection * vec4(position, 1.0);
  gl_Position = vCurPos;
}

// fragment shader
varying vec4 vCurPos;
varying vec4 vPrevPos;

void main() {
  vec2 curUV = vCurPos.xy / vCurPos.w * 0.5 + 0.5;
  vec2 prevUV = vPrevPos.xy / vPrevPos.w * 0.5 + 0.5;
  vec2 velocity = curUV - prevUV;
  
  // 输出速度到 MRT
  gl_FragData[1] = vec4(velocity, 0.0, 1.0);
}
```

运动模糊 pass：

```glsl
uniform sampler2D tDiffuse;
uniform sampler2D tVelocity;
uniform int samples;

varying vec2 vUv;

void main() {
  vec2 velocity = texture2D(tVelocity, vUv).xy;
  
  // 限制最大模糊长度
  velocity = clamp(velocity, -0.05, 0.05);
  
  vec4 color = vec4(0.0);
  for (int i = 0; i < 16; i++) {
    float t = float(i) / 15.0;
    color += texture2D(tDiffuse, vUv + velocity * t);
  }
  color /= 16.0;
  
  gl_FragColor = color;
}
```

### 相机运动模糊

即使场景中没有物体移动，相机快速旋转也会产生运动模糊。可以用相机的旋转速度来生成全局速度场，不需要逐物体的速度缓冲：

```ts
const prevCameraMatrix = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse)

function animate() {
  // 在渲染前
  motionBlurMaterial.uniforms.prevVP.value.copy(prevCameraMatrix)
  
  composer.render()
  
  prevCameraMatrix.copy(
    camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse)
  )
}
```

## 运动模糊的工程取舍

运动模糊让快速移动的物体看起来更自然，但有副作用：

- 静止时画面应该完全清晰，但采样不足会导致微弱的模糊
- 快速转身时整个画面模糊，影响可读性
- 在 VR 中运动模糊会导致眩晕

很多游戏允许玩家关闭运动模糊。在 web 产品页面中，运动模糊适合用在相机快速移动的转场瞬间，不适合持续开启。

## 练习

### 练习一：焦点跟随物体

场景中有 3 个物体排成一行。相机从左到右移动时，焦点始终锁定在中间的物体上。前景和背景物体根据距离产生不同程度的模糊。

### 练习二：转场运动模糊

相机从位置 A 快速飞到位置 B 的过程中，开启运动模糊。到达 B 后运动模糊逐渐消失。模糊强度和相机移动速度成正比。

---

## 参考答案

### 练习一

**思路**：每帧计算焦点物体到相机的距离，更新 BokehPass。

```ts
const objects = [
  new Mesh(new SphereGeometry(1), new MeshStandardMaterial({ color: 0xff4444 })),
  new Mesh(new SphereGeometry(1), new MeshStandardMaterial({ color: 0x44ff44 })),
  new Mesh(new SphereGeometry(1), new MeshStandardMaterial({ color: 0x4444ff })),
]

objects[0].position.set(-5, 0, 0)
objects[1].position.set(0, 0, 0)
objects[2].position.set(5, 0, 0)

// 相机移动动画
gsap.to(camera.position, {
  x: 5,
  duration: 5,
  ease: "power2.inOut",
})

function animate() {
  requestAnimationFrame(animate)
  
  // 焦点始终在中间物体上
  const focusDist = camera.position.distanceTo(objects[1].position)
  bokehPass.uniforms.focus.value = focusDist
  
  camera.lookAt(0, 0, 0)
  composer.render()
}
```

### 练习二

**思路**：相机移动时根据速度动态调整运动模糊强度。

```ts
let cameraSpeed = 0
let prevCameraPos = camera.position.clone()

function animate() {
  requestAnimationFrame(animate)
  
  cameraSpeed = camera.position.distanceTo(prevCameraPos)
  prevCameraPos.copy(camera.position)
  
  // 运动模糊强度和速度成正比
  motionBlurPass.uniforms.intensity.value = cameraSpeed * 50
  // 限制最大值
  motionBlurPass.uniforms.intensity.value = Math.min(
    motionBlurPass.uniforms.intensity.value, 1.0
  )
  
  composer.render()
}
```

**常见错误**：BokehPass 的 `focus` 参数单位是线性深度（相机空间的 Z 值），不是世界坐标距离。用 `camera.position.distanceTo(target)` 时要注意单位一致性。
