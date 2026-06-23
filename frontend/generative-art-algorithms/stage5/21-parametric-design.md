# 参数化设计

## 这节课解决什么问题

生成艺术的核心卖点之一是"同一个算法，不同参数，完全不同的作品"。但如果没有系统地管理参数，你就只能手动改数字碰运气。这节课实现一套参数化框架：用种子控制随机性，用滑块探索参数空间，用哈希函数保证可复现。

## 三个核心问题

1. **种子（Seed）**：同一个种子 → 同一幅画。改变种子 → 新作品但保持风格
2. **参数空间**：哪些参数可以调？它们之间有什么关系？
3. **探索方式**：怎么快速浏览参数空间里的不同区域？

```html
<!DOCTYPE html>
<html>
<body>
<div style="font:13px monospace;color:#ccc;padding:10px;">
  <label>种子: <input id="seed" type="number" value="42" style="width:80px;font:13px monospace;background:#222;color:#ccc;border:1px solid #444;"></label>
  <label style="margin-left:12px;">噪声频率: <input id="freq" type="range" min="1" max="50" value="10" style="width:120px;"> <span id="freqVal">10</span></label>
  <label style="margin-left:12px;">旋涡强度: <input id="swirl" type="range" min="0" max="100" value="40" style="width:120px;"> <span id="swirlVal">40</span></label>
  <label style="margin-left:12px;">对称数: <input id="sym" type="range" min="1" max="8" value="4" style="width:80px;"> <span id="symVal">4</span></label>
  <label style="margin-left:12px;">密度: <input id="density" type="range" min="50" max="2000" value="800" style="width:100px;"> <span id="densVal">800</span></label>
  <button onclick="generate()" style="margin-left:12px;padding:3px 10px;font:13px monospace;">生成</button>
  <button onclick="randomSeed()" style="margin-left:4px;padding:3px 10px;font:13px monospace;">随机种子</button>
</div>
<canvas id="c" width="800" height="800"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ---- 可复现的伪随机数生成器 ----
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 用种子初始化的噪声
function createSeededNoise(seed) {
  const rng = mulberry32(seed);
  const perm = Array.from({ length: 256 }, () => Math.floor(rng() * 256));

  function fade(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  return function noise2D(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    function grad(hash, x, y) {
      const h = hash & 3;
      const u = h < 2 ? x : y;
      const v = h < 2 ? y : x;
      return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }

    const aa = perm[(perm[xi] + yi) & 255];
    const ab = perm[(perm[xi] + yi + 1) & 255];
    const ba = perm[(perm[(xi + 1) & 255] + yi) & 255];
    const bb = perm[(perm[(xi + 1) & 255] + yi + 1) & 255];

    const u = fade(xf), v = fade(yf);
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    );
  };
}

function fbm(noise, x, y, octaves = 4) {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < octaves; i++) {
    v += a * noise(x * f, y * f);
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

// ---- 生成器 ----
function generate() {
  const seed = parseInt(document.getElementById('seed').value) || 0;
  const freq = parseInt(document.getElementById('freq').value) / 1000;
  const swirl = parseInt(document.getElementById('swirl').value) / 50;
  const sym = parseInt(document.getElementById('sym').value);
  const density = parseInt(document.getElementById('density').value);

  document.getElementById('freqVal').textContent = (freq * 1000).toFixed(0);
  document.getElementById('swirlVal').textContent = (swirl * 50).toFixed(0);
  document.getElementById('symVal').textContent = sym;
  document.getElementById('densVal').textContent = density;

  const noise = createSeededNoise(seed);
  const rng = mulberry32(seed + 1000);
  const cx = W / 2, cy = H / 2;

  ctx.fillStyle = '#050a18';
  ctx.fillRect(0, 0, W, H);

  // 调色板
  const hueBase = rng() * 360;

  for (let i = 0; i < density; i++) {
    let x = rng() * W;
    let y = rng() * H;

    for (let step = 0; step < 80; step++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // 对称变换
      for (let s = 0; s < sym; s++) {
        const symAngle = angle + (s / sym) * Math.PI * 2;
        const sx = cx + Math.cos(symAngle) * dist;
        const sy = cy + Math.sin(symAngle) * dist;
        if (sx < 0 || sx > W || sy < 0 || sy > H) continue;

        const n = fbm(noise, sx * freq, sy * freq, 4);
        const hue = (hueBase + n * 120 + dist * 0.1) % 360;
        const alpha = 0.15 + (step / 80) * 0.2;
        ctx.fillStyle = `hsla(${hue}, 65%, 55%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 流场更新
      const n = fbm(noise, x * freq, y * freq, 4);
      const swirlAngle = n * Math.PI * 4 + dist * swirl * 0.01;
      x += Math.cos(swirlAngle) * 2;
      y += Math.sin(swirlAngle) * 2;

      if (x < 0 || x > W || y < 0 || y > H) break;
    }
  }

  // 显示参数信息
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, H - 30, W, 30);
  ctx.fillStyle = '#666';
  ctx.font = '11px monospace';
  ctx.fillText(`seed=${seed}  freq=${(freq * 1000).toFixed(0)}  swirl=${(swirl * 50).toFixed(0)}  sym=${sym}  density=${density}`, 10, H - 10);
}

function randomSeed() {
  document.getElementById('seed').value = Math.floor(Math.random() * 100000);
  generate();
}

// 滑块实时更新
['freq', 'swirl', 'sym', 'density'].forEach(id => {
  document.getElementById(id).addEventListener('input', generate);
});

generate();
</script>
</body>
</html>
```

## 种子的意义

同一个种子 + 同一组参数 = 完全相同的画面。这意味着：
- 你可以把 `(seed=42, freq=10, swirl=40)` 分享给别人，他们能得到一样的作品
- 你可以在不同时间回到同一幅画
- 你可以在参数空间里做系统性搜索

## 参数空间探索

实际的生成艺术项目中，常用这些方法探索参数空间：
- **网格搜索**：固定其他参数，一个一个调
- **随机采样**：随机种子 + 随机参数组合
- **进化搜索**：第 11 课的方法
- **交互滑块**：像这节课一样，实时调参看效果

## 本课产出

一个带滑块和种子输入的交互式生成艺术系统。改变种子得到新作品，调整参数实时看到效果。底部显示当前参数组合。
