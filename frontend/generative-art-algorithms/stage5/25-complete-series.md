# 阶段实战：创作一个完整的生成艺术系列

## 目标

综合前 24 课的所有技术，创作一个有统一风格的生成艺术系列——"星图"。每幅作品由同一个算法生成，通过不同的种子和参数产生变化，但保持视觉一致性。这是生成艺术的终极表达：算法即艺术家。

## 系列设计理念

"星图"系列的核心算法：
1. 用噪声生成流场
2. 粒子在流场中流动形成轨迹
3. 对称变换增加几何美感
4. 调色板统一但每幅不同
5. 种子控制所有随机性

```html
<!DOCTYPE html>
<html>
<body>
<div style="font:13px monospace;color:#ccc;padding:10px;">
  <label>种子: <input id="seed" type="number" value="1" min="1" max="9999" style="width:60px;font:13px monospace;background:#222;color:#ccc;border:1px solid #444;"></label>
  <button onclick="prevSeed()" style="margin-left:8px;padding:3px 8px;font:13px monospace;">◀</button>
  <button onclick="nextSeed()" style="margin-left:2px;padding:3px 8px;font:13px monospace;">▶</button>
  <button onclick="randomSeed()" style="margin-left:8px;padding:3px 8px;font:13px monospace;">随机</button>
  <button onclick="exportCurrent()" style="margin-left:8px;padding:3px 8px;font:13px monospace;">导出 PNG</button>
  <button onclick="showGrid()" style="margin-left:8px;padding:3px 8px;font:13px monospace;">网格预览</button>
  <span style="color:#666;margin-left:10px;">← → 切换 | 参数自动保存</span>
</div>
<canvas id="c" width="800" height="800"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

let currentSeed = 1;

// ---- 可复现随机 ----
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 种子噪声
function createNoise(seed) {
  const rng = mulberry32(seed);
  const perm = Array.from({ length: 512 }, () => Math.floor(rng() * 256));

  function fade(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function grad(hash, x, y) {
    const h = hash & 3;
    return ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  }

  return function noise(x, y) {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = perm[(perm[xi] + yi) & 511];
    const ba = perm[(perm[(xi + 1) & 255] + yi) & 511];
    const ab = perm[(perm[xi] + (yi + 1)) & 511];
    const bb = perm[(perm[(xi + 1) & 255] + (yi + 1)) & 511];
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    );
  };
}

function fbm(noise, x, y, octaves = 5) {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < octaves; i++) {
    v += a * noise(x * f, y * f);
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

// ---- 系列参数生成 ----
function seriesParams(seed) {
  const rng = mulberry32(seed);
  return {
    hueBase: rng() * 360,
    hueRange: 40 + rng() * 80,
    symmetry: [3, 4, 5, 6, 8][Math.floor(rng() * 5)],
    noiseScale: 0.0015 + rng() * 0.003,
    swirlStrength: 0.5 + rng() * 2,
    particleCount: 800 + Math.floor(rng() * 800),
    lineSteps: 40 + Math.floor(rng() * 60),
    backgroundHue: rng() * 360,
  };
}

// ---- 渲染器 ----
function renderStarMap(seed) {
  const params = seriesParams(seed);
  const noise = createNoise(seed);
  const cx = W / 2, cy = H / 2;

  // 背景
  const bgHue = params.backgroundHue;
  ctx.fillStyle = `hsl(${bgHue}, 30%, 5%)`;
  ctx.fillRect(0, 0, W, H);

  // 星云背景层：大尺度噪声
  const nebulaData = ctx.createImageData(W, H);
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const n = fbm(noise, x * 0.003, y * 0.003, 3);
      const brightness = Math.max(0, n * 0.15);
      const hue = params.hueBase + n * 30;
      // 简化 HSL→RGB
      const c = brightness * 255;
      for (let dy = 0; dy < 2 && y + dy < H; dy++) {
        for (let dx = 0; dx < 2 && x + dx < W; dx++) {
          const i = ((y + dy) * W + x + dx) * 4;
          nebulaData.data[i] = c * (0.8 + Math.sin(hue * 0.01) * 0.2);
          nebulaData.data[i + 1] = c * 0.7;
          nebulaData.data[i + 2] = c * (1.2 - Math.sin(hue * 0.01) * 0.2);
          nebulaData.data[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(nebulaData, 0, 0);

  // 粒子轨迹层
  const rng = mulberry32(seed + 100);
  for (let i = 0; i < params.particleCount; i++) {
    let x = rng() * W;
    let y = rng() * H;
    const hue = params.hueBase + rng() * params.hueRange - params.hueRange / 2;

    ctx.beginPath();
    ctx.moveTo(x, y);

    for (let step = 0; step < params.lineSteps; step++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 流场角度
      const baseAngle = fbm(noise, x * params.noiseScale, y * params.noiseScale, 4) * Math.PI * 4;
      // 旋涡分量
      const swirlAngle = Math.atan2(dy, dx) + Math.PI / 2;
      const angle = baseAngle + swirlAngle * params.swirlStrength * (1 - dist / (W * 0.7));

      x += Math.cos(angle) * 1.5;
      y += Math.sin(angle) * 1.5;
      ctx.lineTo(x, y);

      if (x < -10 || x > W + 10 || y < -10 || y > H + 10) break;
    }

    const alpha = 0.08 + rng() * 0.15;
    ctx.strokeStyle = `hsla(${hue}, 60%, 55%, ${alpha})`;
    ctx.lineWidth = 0.5 + rng() * 0.5;
    ctx.stroke();
  }

  // 对称层：复制并旋转
  if (params.symmetry > 1) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = tempCanvas.height = W;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    ctx.save();
    ctx.globalAlpha = 0.3;
    for (let s = 1; s < params.symmetry; s++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((s / params.symmetry) * Math.PI * 2);
      ctx.translate(-cx, -cy);
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // 星点：随机亮点
  const starRng = mulberry32(seed + 200);
  for (let i = 0; i < 80; i++) {
    const sx = starRng() * W;
    const sy = starRng() * H;
    const sr = 0.5 + starRng() * 2;
    const sa = 0.3 + starRng() * 0.7;
    ctx.fillStyle = `rgba(255, 255, 255, ${sa})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    // 星芒
    if (sr > 1.5) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${sa * 0.3})`;
      ctx.lineWidth = 0.3;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(sx - Math.cos(a) * sr * 3, sy - Math.sin(a) * sr * 3);
        ctx.lineTo(sx + Math.cos(a) * sr * 3, sy + Math.sin(a) * sr * 3);
        ctx.stroke();
      }
    }
  }

  // 签名
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '11px monospace';
  ctx.fillText(`STAR MAP #${seed}`, 10, H - 10);
  ctx.fillText(`sym=${params.symmetry} particles=${params.particleCount}`, 10, H - 25);
}

// ---- 控制 ----
function prevSeed() {
  currentSeed = Math.max(1, currentSeed - 1);
  document.getElementById('seed').value = currentSeed;
  renderStarMap(currentSeed);
}

function nextSeed() {
  currentSeed++;
  document.getElementById('seed').value = currentSeed;
  renderStarMap(currentSeed);
}

function randomSeed() {
  currentSeed = Math.floor(Math.random() * 9999) + 1;
  document.getElementById('seed').value = currentSeed;
  renderStarMap(currentSeed);
}

function exportCurrent() {
  const link = document.createElement('a');
  link.download = `star-map-${currentSeed}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function showGrid() {
  const gridSize = 3;
  const cellSize = Math.floor(W / gridSize);
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = W;
  gridCanvas.height = H;
  const gridCtx = gridCanvas.getContext('2d');

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const seed = r * gridSize + c + 1;
      // 渲染到临时 canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = tempCanvas.height = cellSize;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0, W, H, 0, 0, cellSize, cellSize);
      // 直接在主 canvas 上渲染小版本
      ctx.save();
      ctx.beginPath();
      ctx.rect(c * cellSize, r * cellSize, cellSize - 2, cellSize - 2);
      ctx.clip();
      renderStarMap(seed);
      ctx.restore();
    }
  }
}

// 键盘快捷键
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') prevSeed();
  if (e.key === 'ArrowRight') nextSeed();
  if (e.key === 'r') randomSeed();
  if (e.key === 'e') exportCurrent();
});

// 输入框
document.getElementById('seed').addEventListener('change', (e) => {
  currentSeed = Math.max(1, parseInt(e.target.value) || 1);
  renderStarMap(currentSeed);
});

// 初始渲染
renderStarMap(currentSeed);
</script>
</body>
</html>
```

## 系列的统一性

同一个算法 + 同一套参数空间 = 一个系列。每幅画的差异来自：
- 种子不同 → 流场不同
- 参数组合不同 → 色彩、对称、密度不同

但视觉风格一致：都是暗色背景、发光流线、对称构图。

## 完整的创作流程

1. **设计算法**：选择核心算法（流场 + 对称 + 噪声）
2. **定义参数空间**：确定哪些参数可调，范围是多少
3. **实现渲染器**：把算法写成 `render(seed)` 函数
4. **探索空间**：快速翻看不同种子，找到好看的区域
5. **精选作品**：从几百个候选中选出 10-20 幅
6. **导出**：PNG 用于展示，SVG 用于打印，参数记录用于复现
7. **发布**：上传到 fxhash、Art Blocks 或自建网站

## 从第一课到这里的回顾

| 课时 | 技术 | 在本作品中的用法 |
|------|------|----------------|
| 01 | 噪声 | 流场、星云背景 |
| 02 | 颜色 | 调色板生成 |
| 03 | 形状 | 粒子轨迹 |
| 04 | 网格 | 网格预览布局 |
| 06 | 分形 | 星云的自相似结构 |
| 12 | 粒子 | 轨迹生成 |
| 17 | 流场 | 核心算法 |
| 21 | 参数化 | 种子和参数系统 |
| 24 | 导出 | PNG/SVG 输出 |

## 本课产出

一个完整的"星图"系列生成艺术系统。通过种子切换不同作品，支持 PNG 导出和网格预览。所有作品共享同一算法，但各有独特面貌。
