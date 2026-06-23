# 阶段实战：用噪声和网格生成一幅抽象画

## 目标

把前四课学的噪声、颜色、形状、网格组合起来，生成一幅完整的抽象画作品。不是 demo 拼接，而是一个有统一风格的独立作品。

## 设计思路

作品叫"地层"——灵感来自地质切面图。用噪声生成波浪状的地层线，用六边形网格填充纹理，用调色板控制色彩过渡。

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="800" height="800"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ---- 噪声工具 ----
function fade(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
function hash(x, y) {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  return lerp(
    lerp(hash(xi, yi), hash(xi + 1, yi), u),
    lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u),
    v
  );
}
function fbm(x, y, octaves = 4) {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < octaves; i++) {
    v += a * noise(x * f, y * f);
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

// ---- 调色板 ----
// 地层风格：从深蓝到暖橙的渐变
function palette(t) {
  const colors = [
    [22, 38, 87],   // 深蓝
    [41, 68, 148],  // 蓝
    [78, 205, 196], // 青
    [199, 236, 196],// 浅绿
    [255, 209, 102],// 黄
    [255, 107, 107],// 红
    [155, 89, 182], // 紫
  ];
  t = Math.max(0, Math.min(1, t));
  const idx = t * (colors.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  const c0 = colors[Math.min(i, colors.length - 1)];
  const c1 = colors[Math.min(i + 1, colors.length - 1)];
  return [
    Math.round(lerp(c0[0], c1[0], f)),
    Math.round(lerp(c0[1], c1[1], f)),
    Math.round(lerp(c0[2], c1[2], f)),
  ];
}

// ---- 背景 ----
ctx.fillStyle = '#0a0a1a';
ctx.fillRect(0, 0, W, H);

// ---- 地层波浪线 ----
const layers = 30;
for (let i = 0; i < layers; i++) {
  const baseY = (i / layers) * H;
  const t = i / layers;
  const [r, g, b] = palette(t);

  ctx.beginPath();
  for (let x = 0; x <= W; x += 2) {
    const nx = x / 200;
    const ny = i * 0.3;
    const displacement = fbm(nx, ny, 5) * 60 - 30;
    const y = baseY + displacement;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  // 闭合到画布底部
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fill();
}

// ---- 六边形网格覆盖层 ----
const hexSize = 18;
const hexW = hexSize * 2;
const hexH = Math.sqrt(3) * hexSize;

for (let row = -1; row < H / hexH + 1; row++) {
  for (let col = -1; col < W / (hexW * 0.75) + 1; col++) {
    const x = col * hexW * 0.75;
    const y = row * hexH + (col % 2 === 1 ? hexH / 2 : 0);

    // 用噪声决定是否画这个六边形
    const n = fbm(x / 150, y / 150, 3);
    if (n < 0.35) continue;

    // 用位置决定颜色
    const colorT = (y / H + fbm(x / 300, y / 300, 2) * 0.3) % 1;
    const [r, g, b] = palette(colorT);
    const alpha = 0.15 + n * 0.25;

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const angle = (Math.PI / 3) * k - Math.PI / 6;
      const hx = x + hexSize * Math.cos(angle);
      const hy = y + hexSize * Math.sin(angle);
      k === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

// ---- 散点装饰 ----
for (let i = 0; i < 200; i++) {
  const x = Math.random() * W;
  const y = Math.random() * H;
  const n = fbm(x / 100, y / 100, 2);
  if (n < 0.45) continue;
  const t = y / H;
  const [r, g, b] = palette(t);
  const size = 1 + n * 3;
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.4 + n * 0.3})`;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
}
</script>
</body>
</html>
```

## 代码拆解

1. **噪声引擎**（前 25 行）：和第一课一样，`fbm` 叠加多层噪声
2. **调色板**（palette 函数）：7 色渐变，输入 0-1 输出 RGB。和第二课的思路一致
3. **地层线**（主循环）：30 条波浪线，每条用噪声偏移 Y 坐标，从下往上用调色板取色
4. **六边形覆盖**：用噪声决定哪些六边形可见，产生疏密变化
5. **散点**：随机点用噪声过滤，只有"密度够"的地方才画

## 改造建议

- 换调色板：把 `palette` 函数里的颜色数组换成第二课的任何一种调色板算法
- 换网格：把六边形换成三角或矩形，感受不同的纹理
- 改噪声频率：`x / 200` 改成 `x / 50`，地层会更碎更密
- 加动画：让噪声的输入加上时间参数 `fbm(x / 200 + time, ny, 5)`

## 本课产出

一幅 800×800 的抽象画：底层是噪声驱动的彩色地层波浪，中层是疏密有致的六边形网格纹理，顶层是散落的光点。所有视觉元素都由噪声和算法控制，刷新页面会得到不同的变体。
