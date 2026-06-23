# 阶段实战：生成一组分形和植物图案

## 目标

用本阶段学的分形、细胞自动机、L-System，生成一组风格统一的装饰图案——像一套墙砖设计或印花图案。

## 设计思路

生成 6 个圆形徽章图案，每个用不同的算法，但统一用深色背景、霓虹线条、圆形裁剪。这种"徽章阵列"风格在生成艺术 NFT 和打印品中很常见。

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="900" height="600"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

ctx.fillStyle = '#0a0a1a';
ctx.fillRect(0, 0, W, H);

// 圆形裁剪辅助
function clipCircle(cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
}

function unclip() {
  ctx.restore();
}

// 圆形边框
function drawBorder(cx, cy, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

// ---- 1. Mandelbrot 片段 ----
function mandelbrotBadge(cx, cy, r) {
  clipCircle(cx, cy, r);
  const size = r * 2;
  const imgData = ctx.createImageData(size, size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const cr = ((px - size / 2) / size) * 1.2 - 0.3;
      const ci = ((py - size / 2) / size) * 1.2;
      let zr = 0, zi = 0;
      let iter = 0;
      while (zr * zr + zi * zi < 4 && iter < 60) {
        const tmp = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = tmp;
        iter++;
      }
      const i = (py * size + px) * 4;
      if (iter < 60) {
        const t = iter / 60;
        imgData.data[i] = Math.floor(255 * Math.pow(t, 0.5));
        imgData.data[i + 1] = Math.floor(180 * t * t);
        imgData.data[i + 2] = Math.floor(100 + 155 * (1 - t));
      }
      imgData.data[i + 3] = 255;
    }
  }
  ctx.putImageData(imgData, cx - r, cy - r);
  unclip();
  drawBorder(cx, cy, r, '#ff6b6b');
}

// ---- 2. Julia 片段 ----
function juliaBadge(cx, cy, r) {
  clipCircle(cx, cy, r);
  const size = r * 2;
  const imgData = ctx.createImageData(size, size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let zr = ((px - size / 2) / size) * 2.5;
      let zi = ((py - size / 2) / size) * 2.5;
      let iter = 0;
      while (zr * zr + zi * zi < 4 && iter < 60) {
        const tmp = zr * zr - zi * zi - 0.7;
        zi = 2 * zr * zi + 0.27015;
        zr = tmp;
        iter++;
      }
      const i = (py * size + px) * 4;
      if (iter < 60) {
        const t = iter / 60;
        imgData.data[i] = Math.floor(100 * (1 - t));
        imgData.data[i + 1] = Math.floor(255 * t);
        imgData.data[i + 2] = Math.floor(200 * Math.pow(t, 0.7));
      }
      imgData.data[i + 3] = 255;
    }
  }
  ctx.putImageData(imgData, cx - r, cy - r);
  unclip();
  drawBorder(cx, cy, r, '#4ecdc4');
}

// ---- 3. 分形树 ----
function treeBadge(cx, cy, r) {
  clipCircle(cx, cy, r);
  ctx.fillStyle = '#0d0d24';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  function branch(x, y, angle, len, depth) {
    if (depth === 0 || len < 2) return;
    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;
    const hue = 120 + depth * 15;
    ctx.strokeStyle = `hsla(${hue}, 70%, ${40 + depth * 5}%, 0.9)`;
    ctx.lineWidth = depth * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const spread = 0.35 + (depth % 3) * 0.1;
    branch(x2, y2, angle - spread, len * 0.7, depth - 1);
    branch(x2, y2, angle + spread, len * 0.7, depth - 1);
  }
  branch(cx, cy + r * 0.8, -Math.PI / 2, r * 0.4, 9);
  unclip();
  drawBorder(cx, cy, r, '#2ecc71');
}

// ---- 4. 细胞自动机 Rule 30 ----
function rule30Badge(cx, cy, r) {
  clipCircle(cx, cy, r);
  ctx.fillStyle = '#0d0d24';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  const width = r * 2;
  let row = Array(width).fill(0);
  row[width / 2] = 1;
  for (let y = 0; y < r * 2; y++) {
    for (let x = 0; x < width; x++) {
      if (row[x]) {
        const dist = Math.sqrt((x - r) ** 2 + (y - r) ** 2);
        if (dist < r) {
          ctx.fillStyle = `hsl(${280 + y * 0.3}, 70%, ${50 + x * 0.1}%)`;
          ctx.fillRect(cx - r + x, cy - r + y, 1, 1);
        }
      }
    }
    const next = Array(width).fill(0);
    for (let c = 0; c < width; c++) {
      const l = row[(c - 1 + width) % width];
      const m = row[c];
      const ri = row[(c + 1) % width];
      next[c] = (30 >> ((l << 2) | (m << 1) | ri)) & 1;
    }
    row = next;
  }
  unclip();
  drawBorder(cx, cy, r, '#9b59b6');
}

// ---- 5. L-System 蕨类 ----
function fernBadge(cx, cy, r) {
  clipCircle(cx, cy, r);
  ctx.fillStyle = '#0d0d24';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  let str = 'X';
  for (let i = 0; i < 6; i++) {
    let next = '';
    for (const ch of str) {
      if (ch === 'X') next += 'F+[[X]-X]-F[-FX]+X';
      else if (ch === 'F') next += 'FF';
      else next += ch;
    }
    str = next;
  }

  const stack = [];
  let x = cx, y = cy + r * 0.7, dir = -Math.PI / 2, depth = 0;
  for (const ch of str) {
    if (ch === 'F') {
      const nx = x + Math.cos(dir) * 3;
      const ny = y + Math.sin(dir) * 3;
      ctx.strokeStyle = `hsla(${140 + depth * 12}, 65%, ${40 + depth * 4}%, 0.8)`;
      ctx.lineWidth = Math.max(0.3, 2 - depth * 0.2);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      x = nx; y = ny;
    } else if (ch === '+') dir += 25 * Math.PI / 180;
    else if (ch === '-') dir -= 25 * Math.PI / 180;
    else if (ch === '[') { stack.push({ x, y, dir, depth }); depth++; }
    else if (ch === ']') { const s = stack.pop(); x = s.x; y = s.y; dir = s.dir; depth = s.depth; }
  }
  unclip();
  drawBorder(cx, cy, r, '#1abc9c');
}

// ---- 6. 噪声旋涡 ----
function noiseSwirl(cx, cy, r) {
  clipCircle(cx, cy, r);

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

  // 画旋涡粒子轨迹
  for (let i = 0; i < 500; i++) {
    let x = cx + (Math.random() - 0.5) * r * 2;
    let y = cy + (Math.random() - 0.5) * r * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let step = 0; step < 50; step++) {
      const angle = noise2D(x / 60, y / 60) * Math.PI * 4;
      x += Math.cos(angle) * 2;
      y += Math.sin(angle) * 2;
      ctx.lineTo(x, y);
    }
    const hue = (i * 137.5) % 360;
    ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.2)`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  unclip();
  drawBorder(cx, cy, r, '#f39c12');
}

// ---- 布局 ----
const badges = [
  { fn: mandelbrotBadge, label: 'Mandelbrot' },
  { fn: juliaBadge, label: 'Julia' },
  { fn: treeBadge, label: '分形树' },
  { fn: rule30Badge, label: 'Rule 30' },
  { fn: fernBadge, label: '蕨类 L-System' },
  { fn: noiseSwirl, label: '噪声旋涡' },
];

const cols = 3;
const r = 85;
const gapX = 280;
const gapY = 190;
const startX = 160;
const startY = 120;

badges.forEach((b, i) => {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const cx = startX + col * gapX;
  const cy = startY + row * gapY;
  b.fn(cx, cy, r);
  ctx.fillStyle = '#666';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(b.label, cx, cy + r + 18);
});
ctx.textAlign = 'start';
</script>
</body>
</html>
```

## 代码结构

1. **裁剪工具**：`clipCircle` 用 Canvas 的 clip 功能把内容限制在圆形内
2. **六个独立函数**：每个 badge 是一个函数，内部调用自己的算法
3. **统一布局**：用网格计算位置，3×2 排列

## 扩展方向

- 加交互：鼠标悬停时 badge 旋转或放大
- 换形状：把圆形裁剪换成六边形
- 加动画：让 Mandelbrot 的缩放动起来，或者让分形树生长
- 导出 SVG：把 Canvas 内容转为 SVG 路径

## 本课产出

6 个圆形徽章排列成 3×2 网格，分别展示 Mandelbrot、Julia、分形树、Rule 30、蕨类 L-System、噪声旋涡。统一深色背景和霓虹风格。
