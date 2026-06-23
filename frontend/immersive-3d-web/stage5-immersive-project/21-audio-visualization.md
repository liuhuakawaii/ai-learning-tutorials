# 3D 音频可视化——Web Audio + Three.js 联动

## 声音是看不见的——直到你把它画出来

音频可视化不是新东西。Winamp 的频谱条、SoundCloud 的波形图都是。但用 Three.js 做音频可视化，可以把频率数据映射到 3D 空间——粒子的跳动、模型的变形、光照的脉冲，全部跟着音乐走。

## Web Audio API 的 AnalyserNode

Web Audio API 提供 `AnalyserNode`，它能实时输出音频的频率数据：

```ts
const audioCtx = new AudioContext()
const analyser = audioCtx.createAnalyser()
analyser.fftSize = 2048 // 频率分辨率

// 连接音频源
const audio = new Audio("music.mp3")
const source = audioCtx.createMediaElementSource(audio)
source.connect(analyser)
analyser.connect(audioCtx.destination)

// 获取频率数据
const freqData = new Uint8Array(analyser.frequencyBinCount) // 1024 个 bin
analyser.getByteFrequencyData(freqData)
```

`freqData` 是一个 0-255 的数组，每个元素对应一个频率段的能量。

## 频率分段

1024 个 bin 太多，通常分成 4-8 个频段：

```ts
function getFrequencyBands(data: Uint8Array): number[] {
  const bands = [
    sub:    average(data, 0, 10),     // 20-100Hz  超低音
    bass:   average(data, 10, 40),    // 100-400Hz 低音
    low:    average(data, 40, 80),    // 400-800Hz 中低
    mid:    average(data, 80, 200),   // 800-2kHz  中频
    high:   average(data, 200, 500),  // 2k-5kHz   中高
    treble: average(data, 500, 1024), // 5k-20kHz  高频
  ]
  return bands
}

function average(arr: Uint8Array, start: number, end: number): number {
  let sum = 0
  for (let i = start; i < end; i++) sum += arr[i]
  return sum / (end - start) / 255 // 归一化到 0-1
}
```

## 映射到 3D 属性

频率数据可以映射到任何视觉属性：

```ts
function animate() {
  requestAnimationFrame(animate)
  
  analyser.getByteFrequencyData(freqData)
  const bands = getFrequencyBands(freqData)
  
  // 低频 → 模型缩放（鼓点脉冲）
  const scale = 1 + bands.bass * 0.3
  model.scale.setScalar(scale)
  
  // 中频 → 旋转速度
  model.rotation.y += bands.mid * 0.05
  
  // 高频 → 粒子亮度
  particleMaterial.uniforms.uBrightness.value = 0.5 + bands.treble * 2
  
  // 超低频 → Bloom 强度
  bloomPass.strength = 0.5 + bands.sub * 3
  
  renderer.render(scene, camera)
}
```

## 频谱环

把频率数据画成 3D 环形频谱：

```ts
const BAR_COUNT = 128
const bars: Mesh[] = []
const radius = 3

for (let i = 0; i < BAR_COUNT; i++) {
  const geo = new BoxGeometry(0.02, 1, 0.02)
  const mat = new MeshStandardMaterial({ color: 0x4488ff })
  const bar = new Mesh(geo, mat)
  
  const angle = (i / BAR_COUNT) * Math.PI * 2
  bar.position.set(
    Math.cos(angle) * radius,
    0,
    Math.sin(angle) * radius
  )
  bar.rotation.y = -angle
  scene.add(bar)
  bars.push(bar)
}

function updateSpectrum() {
  analyser.getByteFrequencyData(freqData)
  
  for (let i = 0; i < BAR_COUNT; i++) {
    const dataIndex = Math.floor(i * freqData.length / BAR_COUNT)
    const value = freqData[dataIndex] / 255
    
    bars[i].scale.y = 0.1 + value * 3
    bars[i].material.color.setHSL(0.6 - value * 0.4, 0.8, 0.5)
  }
}
```

## 波形可视化

频谱是频率域的，波形是时间域的：

```ts
const waveData = new Uint8Array(analyser.fftSize)
const waveGeo = new BufferGeometry()
const wavePositions = new Float32Array(512 * 3)
waveGeo.setAttribute("position", new Float32BufferAttribute(wavePositions, 3))
const waveLine = new Line(waveGeo, new LineBasicMaterial({ color: 0x00ff88 }))
scene.add(waveLine)

function updateWaveform() {
  analyser.getByteTimeDomainData(waveData)
  
  const positions = waveLine.geometry.attributes.position
  for (let i = 0; i < 512; i++) {
    const x = (i / 512 - 0.5) * 10
    const y = (waveData[i * 4] / 255 - 0.5) * 2
    positions.setXYZ(i, x, y, 0)
  }
  positions.needsUpdate = true
}
```

## 平滑过渡

频率数据每帧跳动很大，直接用会很抖。做指数平滑：

```ts
const smoothedBands = [0, 0, 0, 0, 0, 0]

function smoothBands(bands: number[], factor: number = 0.1) {
  for (let i = 0; i < bands.length; i++) {
    smoothedBands[i] += (bands[i] - smoothedBands[i]) * factor
  }
  return smoothedBands
}
```

## 用户交互：麦克风输入

除了播放音乐，也可以用麦克风实时输入：

```ts
async function useMicrophone() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const source = audioCtx.createMediaStreamSource(stream)
  source.connect(analyser)
  // 不连接 destination，避免回声
}
```

## 练习

### 练习一：鼓点检测

检测音频中的鼓点（低频能量突增），在鼓点发生时触发视觉事件：粒子爆炸、模型脉冲、屏幕闪烁。用能量变化率而不是绝对值来检测鼓点。

### 练习二：音频驱动的粒子系统

把粒子系统的力场强度映射到频率数据。低频时粒子聚集在中心，高频时粒子向外扩散。不同频段控制不同区域的粒子，形成"音乐雕塑"。

---

## 参考答案

### 练习一

**思路**：记录前一帧的低频能量，差值超过阈值时触发。

```ts
let prevBass = 0
const BEAT_THRESHOLD = 0.15

function detectBeat(bands: number[]): boolean {
  const bass = bands[0] + bands[1] // sub + bass
  const delta = bass - prevBass
  prevBass = bass
  return delta > BEAT_THRESHOLD
}

// 在动画循环中
const bands = getFrequencyBands(freqData)
if (detectBeat(bands)) {
  // 触发爆炸效果
  gsap.to(particleMaterial.uniforms.uIntensity, {
    value: 3,
    duration: 0.05,
    yoyo: true,
    repeat: 1,
  })
  bloomPass.strength = 3
  gsap.to(bloomPass, { strength: 0.5, duration: 0.3 })
}
```

### 练习二

**思路**：把频率数据作为纹理传入 GPU Compute Shader。

```ts
// 创建频率纹理
const freqTexture = new DataTexture(freqData, freqData.length, 1, RedFormat)
freqTexture.needsUpdate = true

// 传入 Compute Shader
function animate() {
  analyser.getByteFrequencyData(freqData)
  freqTexture.needsUpdate = true
  
  // Compute Shader 根据频率修改力场
  computeMaterial.uniforms.uFreqTexture.value = freqTexture
}
```

```wgsl
@compute @workgroup_size(256)
fn simulate(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  var pos = particles[i].position;
  
  // 根据粒子角度采样频率
  let angle = atan2(pos.z, pos.x);
  let freqIndex = (angle / 3.14159 * 0.5 + 0.5);
  let energy = textureSampleLevel(freqTex, sampler, vec2<f32>(freqIndex, 0.0), 0.0).r;
  
  // 能量驱动径向力
  let radial = normalize(pos) * energy * 5.0;
  vel += radial * dt;
}
```

**常见错误**：浏览器要求用户交互后才能创建 AudioContext。需要在用户点击"播放"按钮后初始化 Web Audio。
