# 第二课：Web Audio API

## 场景引入

你想做一个音乐播放器，除了播放音频，还需要显示频谱图、调节均衡器、实现淡入淡出效果。HTML5 的 `<audio>` 标签只能做到基本播放，无法对音频信号进行精细控制。

Web Audio API 提供了一套完整的音频处理框架，让你能够在浏览器中实现专业级的音频操作。它的核心思想是**节点图（Node Graph）**——将音频处理拆分为多个节点，用连线将它们串联起来，形成一条音频处理管线。

本课将从 AudioContext 开始，逐步掌握 Web Audio API 的核心能力。

## 学习目标

完成本课学习后，你将能够：

1. 正确创建和管理 AudioContext，理解浏览器自动播放策略
2. 理解节点图架构，能够搭建自定义音频处理管线
3. 使用常用节点实现音量控制、滤波、频谱分析
4. 使用 Canvas 实现音频可视化
5. 理解 AudioWorklet 的使用场景和基本用法

## AudioContext

### 创建与状态管理

AudioContext 是 Web Audio API 的入口，所有音频操作都在其中进行。

```javascript
// 创建 AudioContext
const audioContext = new AudioContext();

// AudioContext 有三种状态
console.log(audioContext.state); // "running" | "suspended" | "closed"

// 检查状态
if (audioContext.state === 'suspended') {
  // 需要用户交互后才能恢复
  await audioContext.resume();
}

// 关闭 AudioContext（释放系统资源）
await audioContext.close();
```

### 自动播放策略

现代浏览器出于用户体验考虑，禁止在没有用户交互的情况下播放音频。AudioContext 创建后可能处于 `suspended` 状态，需要在用户交互事件中调用 `resume()`。

```javascript
// 错误做法：页面加载时直接创建并播放
const ctx = new AudioContext();
const osc = ctx.createOscillator();
osc.connect(ctx.destination);
osc.start(); // 可能被浏览器阻止

// 正确做法：在用户交互后激活
document.getElementById('playBtn').addEventListener('click', async () => {
  const ctx = new AudioContext();

  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const osc = ctx.createOscillator();
  osc.connect(ctx.destination);
  osc.start();
});

// 封装一个可复用的 AudioContext 管理器
class AudioContextManager {
  constructor() {
    this.context = null;
  }

  async getContext() {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    return this.context;
  }

  async close() {
    if (this.context && this.context.state !== 'closed') {
      await this.context.close();
      this.context = null;
    }
  }
}
```

## 节点图架构

Web Audio API 的核心设计是**节点图**。音频从源节点出发，经过一系列处理节点，最终到达目标节点。

```
[源节点] → [处理节点] → [处理节点] → [目标节点]
  Oscillator → Gain → BiquadFilter → Destination
```

每个节点有输入端口和输出端口，通过 `connect()` 方法连接：

```javascript
const ctx = new AudioContext();

// 创建节点
const source = ctx.createOscillator();    // 源节点
const gain = ctx.createGain();            // 处理节点：音量控制
const filter = ctx.createBiquadFilter();  // 处理节点：滤波器

// 连接节点链
source.connect(gain);      // 源 → 音量
gain.connect(filter);      // 音量 → 滤波器
filter.connect(ctx.destination); // 滤波器 → 输出（扬声器）

// 启动源
source.start();
```

节点可以分叉和合并，构建复杂的处理图：

```javascript
// 分叉：一个源同时发送到两个处理链
const ctx = new AudioContext();
const source = ctx.createOscillator();

const gainLeft = ctx.createGain();
const gainRight = ctx.createGain();

// 源同时连接到左右两个通道
source.connect(gainLeft);
source.connect(gainRight);

// 各自连接到不同的效果处理
gainLeft.connect(ctx.destination);
gainRight.connect(ctx.destination);
```

## 常用节点

### OscillatorNode（振荡器）

产生基础波形的源节点，常用于生成音调。

```javascript
const ctx = new AudioContext();

// 创建振荡器
const osc = ctx.createOscillator();

// 设置波形类型
osc.type = 'sine'; // 'sine' | 'square' | 'sawtooth' | 'triangle'

// 设置频率（音高）
osc.frequency.setValueAtTime(440, ctx.currentTime); // 440Hz = A4 音

// 启动和停止
osc.start(ctx.currentTime);
osc.stop(ctx.currentTime + 2); // 2 秒后停止

osc.connect(ctx.destination);
```

```javascript
// 播放一个简单的音阶
function playScale(ctx) {
  const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
  const duration = 0.5;

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    // 音量包络：避免爆音
    gain.gain.setValueAtTime(0, ctx.currentTime + i * duration);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * duration + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + (i + 1) * duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + i * duration);
    osc.stop(ctx.currentTime + (i + 1) * duration);
  });
}
```

### GainNode（增益节点）

控制音量，是最常用的处理节点。

```javascript
const ctx = new AudioContext();
const gain = ctx.createGain();

// 设置音量（0.0 ~ 1.0，可超过 1.0 但会失真）
gain.gain.setValueAtTime(0.5, ctx.currentTime);

// 动态调整音量
gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 2); // 2 秒内渐强

// 实现静音/取消静音
function toggleMute(gainNode, ctx) {
  if (gainNode.gain.value > 0) {
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
  } else {
    gainNode.gain.setValueAtTime(1, ctx.currentTime);
  }
}

// 实现淡入淡出
function fadeOut(gainNode, ctx, duration = 1) {
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
}

function fadeIn(gainNode, ctx, duration = 1) {
  gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + duration);
}
```

### BiquadFilterNode（滤波器）

对音频进行频率过滤，可用于均衡器、降噪等场景。

```javascript
const ctx = new AudioContext();
const filter = ctx.createBiquadFilter();

// 滤波器类型
filter.type = 'lowpass';   // 低通：只保留低频
// 'highpass' | 'bandpass' | 'lowshelf' | 'highshelf' | 'peaking' | 'notch' | 'allpass'

// 设置截止频率
filter.frequency.setValueAtTime(1000, ctx.currentTime); // 1kHz

// 设置 Q 值（谐振峰的尖锐程度）
filter.Q.setValueAtTime(1, ctx.currentTime);

// 设置增益（仅对 shelving 和 peaking 类型有效）
filter.gain.setValueAtTime(0, ctx.currentTime);

// 实现一个简单的三段均衡器
class SimpleEQ {
  constructor(ctx) {
    this.low = ctx.createBiquadFilter();
    this.mid = ctx.createBiquadFilter();
    this.high = ctx.createBiquadFilter();

    this.low.type = 'lowshelf';
    this.low.frequency.setValueAtTime(320, ctx.currentTime);

    this.mid.type = 'peaking';
    this.mid.frequency.setValueAtTime(1000, ctx.currentTime);
    this.mid.Q.setValueAtTime(0.5, ctx.currentTime);

    this.high.type = 'highshelf';
    this.high.frequency.setValueAtTime(3200, ctx.currentTime);

    // 串联三个滤波器
    this.low.connect(this.mid);
    this.mid.connect(this.high);
  }

  // 调节某一段的增益（-12 ~ +12 dB）
  setBand(band, gainDb) {
    this[band].gain.setValueAtTime(gainDb, this[band].context.currentTime);
  }

  getInput() { return this.low; }
  getOutput() { return this.high; }
}
```

### AnalyserNode（分析节点）

对音频进行频域分析，不改变音频信号，只提取数据用于可视化。

```javascript
const ctx = new AudioContext();
const analyser = ctx.createAnalyser();

// FFT 大小（必须是 2 的幂），决定频率分辨率
analyser.fftSize = 2048; // 默认值

// 获取频率数据
const bufferLength = analyser.frequencyBinCount; // fftSize / 2
const dataArray = new Uint8Array(bufferLength);

// getByteFrequencyData：0-255 的频率强度
analyser.getByteFrequencyData(dataArray);

// getFloatFrequencyData：以 dB 为单位的频率强度
const floatData = new Float32Array(bufferLength);
analyser.getFloatFrequencyData(floatData);
```

## 音频可视化

将 AnalyserNode 的频率数据绘制到 Canvas 上，实现频谱图：

```html
<!DOCTYPE html>
<html>
<head>
  <title>音频可视化</title>
  <style>
    body { margin: 0; background: #000; display: flex; flex-direction: column; align-items: center; }
    canvas { margin-top: 20px; }
    button { margin: 10px; padding: 10px 20px; font-size: 16px; }
  </style>
</head>
<body>
  <button id="startBtn">开始</button>
  <canvas id="visualizer" width="800" height="300"></canvas>

  <script>
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    let audioCtx, analyser, dataArray, animationId;

    document.getElementById('startBtn').addEventListener('click', async () => {
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;

      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      osc.connect(analyser);
      analyser.connect(audioCtx.destination);
      osc.start();

      dataArray = new Uint8Array(analyser.frequencyBinCount);
      draw();
    });

    function draw() {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const hue = (i / dataArray.length) * 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth;
      }
    }
  </script>
</body>
</html>
```

## 实时音频处理

### ScriptProcessorNode（已废弃）

ScriptProcessorNode 允许用 JavaScript 直接处理音频样本，但由于在主线程运行，容易造成卡顿。

```javascript
// 仅作了解，不推荐使用
const ctx = new AudioContext();
const processor = ctx.createScriptProcessor(1024, 1, 1);

processor.onaudioprocess = function(event) {
  const input = event.inputBuffer.getChannelData(0);
  const output = event.outputBuffer.getChannelData(0);

  // 直接处理每个样本
  for (let i = 0; i < input.length; i++) {
    output[i] = input[i] * 0.5; // 将音量减半
  }
};
```

### AudioWorklet（推荐方案）

AudioWorklet 在独立的 AudioWorklet 线程中运行，不会阻塞主线程。

```javascript
// volume-processor.js — AudioWorklet 处理器文件
class VolumeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.volume = 1.0;
    this.port.onmessage = (event) => {
      this.volume = event.data.volume;
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    for (let channel = 0; channel < input.length; channel++) {
      for (let i = 0; i < input[channel].length; i++) {
        output[channel][i] = input[channel][i] * this.volume;
      }
    }

    return true; // 返回 true 保持处理器活跃
  }
}

registerProcessor('volume-processor', VolumeProcessor);
```

```javascript
// 主线程代码
async function setupAudioWorklet() {
  const ctx = new AudioContext();

  // 加载 Worklet 模块
  await ctx.audioWorklet.addModule('volume-processor.js');

  // 创建 Worklet 节点
  const workletNode = new AudioWorkletNode(ctx, 'volume-processor');

  // 通过 MessagePort 与 Worklet 通信
  workletNode.port.postMessage({ volume: 0.5 });

  // 连接到音频图
  const source = ctx.createOscillator();
  source.connect(workletNode);
  workletNode.connect(ctx.destination);
  source.start();
}
```

## 常见误区

### 误区一：AudioContext 可以随时创建

AudioContext 在创建后可能处于 `suspended` 状态，必须在用户交互事件（click、touchstart 等）中调用 `resume()` 才能激活。如果在页面加载时直接创建并尝试播放音频，会被浏览器静默阻止。

### 误区二：一个页面只能有一个 AudioContext

虽然技术上可以创建多个 AudioContext，但每个都会占用系统音频资源。最佳实践是复用同一个 AudioContext，在不需要时调用 `close()` 释放资源。

### 误区三：ScriptProcessorNode 够用了

ScriptProcessorNode 已被标记为废弃（deprecated），因为它在主线程中运行，处理复杂逻辑时会导致音频卡顿。生产环境应使用 AudioWorklet。

### 误区四：直接用 gain = 0 实现静音

将 GainNode 的 gain 设为 0 并不能完全释放音频处理的计算资源。如果需要彻底静音，应该断开节点连接（`disconnect()`）或停止源节点。

## 工程建议

### AudioContext 生命周期管理

```javascript
// 推荐的 AudioContext 管理模式
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.nodes = [];
  }

  async init() {
    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  createNode(type, options = {}) {
    const node = this.ctx[`create${type}`](options);
    this.nodes.push(node);
    return node;
  }

  async dispose() {
    this.nodes.forEach(node => {
      try { node.disconnect(); } catch (e) {}
    });
    this.nodes = [];
    if (this.ctx && this.ctx.state !== 'closed') {
      await this.ctx.close();
    }
    this.ctx = null;
  }
}
```

### 性能优化

1. **复用 AudioContext**：不要频繁创建和销毁
2. **及时断开不用的节点**：释放计算资源
3. **合理设置 fftSize**：AnalyserNode 的 fftSize 越大，频率分辨率越高，但计算量也越大
4. **使用 AudioWorklet**：将密集计算移到独立线程

## 小结

本课学习了 Web Audio API 的核心概念和使用方法：

- **AudioContext**：音频处理的入口，需要注意自动播放策略
- **节点图架构**：音频处理的核心设计模式，通过 connect() 连接节点
- **常用节点**：OscillatorNode（振荡器）、GainNode（音量）、BiquadFilterNode（滤波）、AnalyserNode（分析）
- **音频可视化**：将频域数据绘制到 Canvas
- **AudioWorklet**：在独立线程中处理音频的现代方案

这些知识是后续所有音频处理工作的基础。

## 练习

### 练习一：音调生成器

实现一个简单的音调生成器，要求：
- 用户可以通过滑块选择频率（200Hz - 2000Hz）
- 用户可以选择波形类型（sine、square、sawtooth、triangle）
- 点击按钮开始/停止播放
- 播放时显示当前频率

### 练习二：音频可视化器

基于 AnalyserNode 实现一个波形可视化器，要求：
- 使用 `getByteTimeDomainData` 获取时域数据
- 在 Canvas 上绘制波形图
- 波形颜色为绿色，背景为黑色
- 波形线宽为 2px

---

## 参考答案

### 练习一

**思路**：使用 AudioContext + OscillatorNode，通过 input[type="range"] 控制频率，select 控制波形类型。

**答案**：

```html
<!DOCTYPE html>
<html>
<head>
  <title>音调生成器</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; }
    .control { margin: 15px 0; }
    label { display: block; margin-bottom: 5px; }
    input[type="range"] { width: 100%; }
    button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
  </style>
</head>
<body>
  <h2>音调生成器</h2>
  <div class="control">
    <label>频率: <span id="freqDisplay">440</span> Hz</label>
    <input type="range" id="freqSlider" min="200" max="2000" value="440">
  </div>
  <div class="control">
    <label>波形类型</label>
    <select id="waveType">
      <option value="sine">正弦波 (Sine)</option>
      <option value="square">方波 (Square)</option>
      <option value="sawtooth">锯齿波 (Sawtooth)</option>
      <option value="triangle">三角波 (Triangle)</option>
    </select>
  </div>
  <button id="playBtn">开始播放</button>

  <script>
    let audioCtx = null;
    let oscillator = null;
    let isPlaying = false;

    const freqSlider = document.getElementById('freqSlider');
    const freqDisplay = document.getElementById('freqDisplay');
    const waveType = document.getElementById('waveType');
    const playBtn = document.getElementById('playBtn');

    freqSlider.addEventListener('input', () => {
      freqDisplay.textContent = freqSlider.value;
      if (oscillator && isPlaying) {
        oscillator.frequency.setValueAtTime(
          parseFloat(freqSlider.value),
          audioCtx.currentTime
        );
      }
    });

    playBtn.addEventListener('click', async () => {
      if (!isPlaying) {
        audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        oscillator = audioCtx.createOscillator();
        oscillator.type = waveType.value;
        oscillator.frequency.setValueAtTime(
          parseFloat(freqSlider.value),
          audioCtx.currentTime
        );
        oscillator.connect(audioCtx.destination);
        oscillator.start();

        isPlaying = true;
        playBtn.textContent = '停止播放';
      } else {
        oscillator.stop();
        audioCtx.close();
        oscillator = null;
        audioCtx = null;
        isPlaying = false;
        playBtn.textContent = '开始播放';
      }
    });
  </script>
</body>
</html>
```

**要点**：
- AudioContext 必须在用户交互事件中创建
- 使用 `setValueAtTime` 而非直接赋值来修改音频参数
- 停止播放时要关闭 AudioContext 释放资源

### 练习二

**思路**：使用 AnalyserNode 的 `getByteTimeDomainData` 获取时域波形数据，然后在 Canvas 上逐点绘制。

**答案**：

```html
<!DOCTYPE html>
<html>
<head>
  <title>波形可视化器</title>
  <style>
    body { margin: 0; background: #000; display: flex; flex-direction: column; align-items: center; }
    button { margin: 20px; padding: 10px 20px; font-size: 16px; }
    canvas { border: 1px solid #333; }
  </style>
</head>
<body>
  <button id="startBtn">开始可视化</button>
  <canvas id="waveform" width="800" height="200"></canvas>

  <script>
    const canvas = document.getElementById('waveform');
    const ctx = canvas.getContext('2d');
    let audioCtx, analyser, dataArray, animationId;

    document.getElementById('startBtn').addEventListener('click', async () => {
      audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;

      // 使用麦克风作为音源
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      dataArray = new Uint8Array(analyser.frequencyBinCount);
      draw();
    });

    function draw() {
      animationId = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00ff00';
      ctx.beginPath();

      const sliceWidth = canvas.width / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0; // 归一化到 0-2
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }
  </script>
</body>
</html>
```

**要点**：
- `getByteTimeDomainData` 返回 0-255 的时域数据，128 为静音中线
- 将数据归一化后映射到 Canvas 的 Y 坐标
- 使用 `requestAnimationFrame` 实现平滑动画
