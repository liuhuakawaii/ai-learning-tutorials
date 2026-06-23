# 音频可视化

## 这节课解决什么问题

把声音变成图像——不是简单的波形图，而是用音频的频率和振幅来驱动生成艺术图案。低频控制大形状，高频控制细节纹理，节奏控制动画节拍。

## 核心概念

- **时域数据**：每个时刻的振幅（波形）
- **频域数据**：每个频率的能量（频谱）——通过 FFT（快速傅里叶变换）得到
- **频段分组**：低频（鼓、贝斯）、中频（人声）、高频（镲、齿音）

```html
<!DOCTYPE html>
<html>
<body>
<div style="color:#ccc;font:14px monospace;margin:10px 0;">
  <button id="btn" style="padding:6px 16px;font:14px monospace;">点击开始（需要麦克风权限）</button>
  <span style="color:#666;">或播放音乐后点击</span>
</div>
<canvas id="c" width="800" height="600"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

ctx.fillStyle = '#0a0a1a';
ctx.fillRect(0, 0, W, H);

let audioCtx, analyser, dataArray, freqArray;

document.getElementById('btn').addEventListener('click', async () => {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
  } catch (e) {
    // 麦克风不可用，尝试播放测试音
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 220;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(analyser);
    gain.connect(audioCtx.destination);
    osc.start();
  }

  dataArray = new Uint8Array(analyser.frequencyBinCount);
  freqArray = new Uint8Array(analyser.frequencyBinCount);
  document.getElementById('btn').textContent = '运行中...';
  animate();
});

// 获取频段平均能量
function bandEnergy(start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += freqArray[i];
  }
  return sum / (end - start) / 255;
}

// 噪声
function hash(x) {
  let n = Math.sin(x * 127.1) * 43758.5453;
  return n - Math.floor(n);
}

function animate() {
  analyser.getByteFrequencyData(freqArray);
  analyser.getByteTimeDomainData(dataArray);

  // 淡出
  ctx.fillStyle = 'rgba(10, 10, 26, 0.08)';
  ctx.fillRect(0, 0, W, H);

  // 频段能量
  const bass = bandEnergy(0, 10);      // 低频
  const mid = bandEnergy(10, 80);      // 中频
  const high = bandEnergy(80, 200);    // 高频
  const overall = (bass + mid + high) / 3;

  const time = performance.now() / 1000;

  // ---- 中央旋涡：由低频驱动大小 ----
  const cx = W / 2, cy = H / 2;
  const baseRadius = 50 + bass * 200;

  for (let i = 0; i < 200; i++) {
    const angle = (i / 200) * Math.PI * 2 + time * 0.5;
    const freqIdx = Math.floor((i / 200) * freqArray.length);
    const freqVal = freqArray[freqIdx] / 255;
    const r = baseRadius + freqVal * 150;
    const x = cx + Math.cos(angle * 3 + time) * r;
    const y = cy + Math.sin(angle * 3 + time) * r;
    const size = 2 + freqVal * 6;

    const hue = (i * 2 + time * 50) % 360;
    const alpha = 0.3 + freqVal * 0.5;
    ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 外圈粒子：由中频驱动 ----
  for (let i = 0; i < 100; i++) {
    const angle = (i / 100) * Math.PI * 2;
    const freqIdx = Math.floor((i / 100) * freqArray.length);
    const freqVal = freqArray[freqIdx] / 255;
    const r = 250 + mid * 100 + freqVal * 80;
    const x = cx + Math.cos(angle + time * 0.3) * r;
    const y = cy + Math.sin(angle + time * 0.3) * r;

    ctx.strokeStyle = `hsla(${180 + i * 2}, 70%, 50%, ${0.2 + freqVal * 0.4})`;
    ctx.lineWidth = 1 + freqVal * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle + time * 0.3) * 200, cy + Math.sin(angle + time * 0.3) * 200);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  // ---- 底部波形：由时域数据驱动 ----
  ctx.strokeStyle = `hsla(160, 80%, 60%, ${0.5 + overall * 0.3})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < dataArray.length; i++) {
    const x = (i / dataArray.length) * W;
    const y = H - 60 + (dataArray[i] / 255 - 0.5) * 80;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // ---- 频谱柱状图 ----
  const barCount = 64;
  const barW = W / barCount;
  for (let i = 0; i < barCount; i++) {
    const val = freqArray[i] / 255;
    const barH = val * 100;
    const hue = (i / barCount) * 360;
    ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.4)`;
    ctx.fillRect(i * barW, H - barH, barW - 1, barH);
  }

  requestAnimationFrame(animate);
}
</script>
</body>
</html>
```

## 音频驱动的生成艺术技巧

**频段分层**：
- 低频（鼓点）→ 控制大形状的缩放、脉动
- 中频（旋律）→ 控制粒子位置、颜色
- 高频（镲片）→ 控制细节纹理、闪烁

**节拍检测**：
- 低频能量突增 → 大概率是鼓点
- 用滑动窗口平均，当前帧远高于平均值 → 触发特效

**平滑处理**：
- 原始音频数据跳动很快，直接用会让画面闪烁
- 用指数移动平均：`smoothed = smoothed * 0.8 + current * 0.2`

## 浏览器音频限制

- 需要用户交互（点击按钮）才能启动 AudioContext
- 麦克风需要 HTTPS 或 localhost
- 如果没有麦克风，代码会 fallback 到一个测试音调

## 本课产出

点击按钮后启动音频分析，中央旋涡由低频驱动脉动，外圈粒子由中频控制，底部显示波形和频谱柱状图。
