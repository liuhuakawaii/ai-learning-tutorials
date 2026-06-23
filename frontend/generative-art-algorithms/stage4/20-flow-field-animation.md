# 阶段实战：生成一个流场动画作品

## 目标

用第 17 课的流场技术，生成一个完整的、可导出的动画作品。不是 demo，而是一件有名字的生成艺术作品——"潮汐"。

## 设计理念

"潮汐"模拟海水涨落：流场随时间缓慢演化，粒子在场中流动形成潮水般的纹理。颜色从深蓝渐变到浅绿，偶尔有白色泡沫点闪现。整体节奏缓慢，适合做动态壁纸或展览。

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="1000" height="700"></canvas>
<div style="margin-top:8px;font:14px monospace;color:#ccc;">
  <button onclick="togglePause()" style="padding:4px 12px;font:14px monospace;">暂停/继续</button>
  <button onclick="resetCanvas()" style="padding:4px 12px;font:14px monospace;margin-left:8px;">重置</button>
  <span style="color:#666;margin-left:12px;">帧: <span id="frame">0</span></span>
</div>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

let paused = false;
let frameCount = 0;

function togglePause() { paused = !paused; if (!paused) animate(); }
function resetCanvas() {
  frameCount = 0;
  particles = createParticles();
  ctx.fillStyle = '#050a18';
  ctx.fillRect(0, 0, W, H);
}

// ---- 噪声 ----
function hash(x, y) {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function fade(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
function noise2D(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  return lerp(
    lerp(hash(xi, yi), hash(xi + 1, yi), fade(xf)),
    lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), fade(xf)),
    fade(yf)
  );
}
function fbm(x, y, octaves = 4) {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < octaves; i++) {
    v += a * noise2D(x * f, y * f);
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

// ---- 流场 ----
const NOISE_SCALE = 0.002;
let timeOffset = 0;

function flowAngle(x, y) {
  // 主流场
  const main = fbm(x * NOISE_SCALE, y * NOISE_SCALE + timeOffset, 4);
  // 潮汐调制：用低频大尺度噪声模拟涨落
  const tide = fbm(x * 0.0005, y * 0.0005 + timeOffset * 0.3, 2);
  return main * Math.PI * 4 + tide * Math.PI * 2;
}

// ---- 粒子 ----
const PARTICLE_COUNT = 3000;
const LIFE_MIN = 80;
const LIFE_MAX = 200;

function createParticle() {
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    life: LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN),
    maxLife: LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN),
    speed: 1 + Math.random() * 2,
    // 海洋色系
    hue: 180 + Math.random() * 40,  // 180-220: 蓝到青
    sat: 50 + Math.random() * 30,
    lit: 30 + Math.random() * 25,
  };
}

let particles = Array.from({ length: PARTICLE_COUNT }, () => createParticle());

// 泡沫粒子（偶尔出现的白色高亮点）
let foamParticles = [];
function spawnFoam() {
  if (Math.random() < 0.1 && foamParticles.length < 100) {
    foamParticles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      life: 20 + Math.random() * 30,
      maxLife: 50,
      size: 1 + Math.random() * 3,
    });
  }
}

// ---- 调色板 ----
function particleColor(p) {
  const lifeRatio = p.life / p.maxLife;
  const alpha = lifeRatio * 0.4;
  // 颜色随位置和时间微调
  const yTone = p.y / H; // 上方偏深，下方偏浅
  const lit = p.lit + yTone * 15;
  return `hsla(${p.hue}, ${p.sat}%, ${lit}%, ${alpha})`;
}

// ---- 主循环 ----
function animate() {
  if (paused) return;

  // 超淡覆盖：产生极长拖尾
  ctx.fillStyle = 'rgba(5, 10, 24, 0.012)';
  ctx.fillRect(0, 0, W, H);

  timeOffset += 0.0003;
  frameCount++;

  // 更新普通粒子
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const angle = flowAngle(p.x, p.y);
    const ox = p.x, oy = p.y;

    p.x += Math.cos(angle) * p.speed;
    p.y += Math.sin(angle) * p.speed;
    p.life--;

    // 画线段
    ctx.strokeStyle = particleColor(p);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    // 重置
    if (p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10 || p.life <= 0) {
      particles[i] = createParticle();
    }
  }

  // 泡沫
  spawnFoam();
  for (let i = foamParticles.length - 1; i >= 0; i--) {
    const f = foamParticles[i];
    const alpha = (f.life / f.maxLife) * 0.8;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
    ctx.fill();
    f.life--;
    if (f.life <= 0) foamParticles.splice(i, 1);
  }

  // 偶尔的"浪花"：一小块区域变亮
  if (Math.random() < 0.02) {
    const wx = Math.random() * W;
    const wy = Math.random() * H;
    const grad = ctx.createRadialGradient(wx, wy, 0, wx, wy, 40);
    grad.addColorStop(0, 'rgba(200, 230, 255, 0.1)');
    grad.addColorStop(1, 'rgba(200, 230, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(wx - 40, wy - 40, 80, 80);
  }

  document.getElementById('frame').textContent = frameCount;
  requestAnimationFrame(animate);
}

// 初始背景
ctx.fillStyle = '#050a18';
ctx.fillRect(0, 0, W, H);
animate();
</script>
</body>
</html>
```

## 代码拆解

1. **双层噪声流场**：主噪声控制方向，低频"潮汐噪声"调制整体流动
2. **3000 粒子**：海洋色系（蓝-青），超淡覆盖产生极长拖尾
3. **泡沫系统**：随机出现的白色亮点，模拟浪花
4. **浪花闪光**：偶尔在随机位置画一个径向渐变亮斑

## 改造建议

- **换色系**：把 hue 从 `180-220` 改成 `0-30`（暖色调），变成"岩浆"
- **加交互**：鼠标位置添加一个吸引中心
- **导出帧**：用 `canvas.toDataURL()` 定时截图，之后拼成视频
- **加音效**：接第 19 课的音频分析，让海浪节奏跟随音乐

## 本课产出

一个 1000×700 的流场动画，3000 个粒子在双层噪声流场中流动，形成不断演化的潮汐纹理。有暂停/重置按钮，显示帧数。
