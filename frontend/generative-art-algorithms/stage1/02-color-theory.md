# 颜色理论

## 这节课解决什么问题

随机颜色看起来很廉价——因为纯随机 RGB 会均匀覆盖整个色彩空间，产生大量不和谐的组合。生成艺术的视觉质量，有一半取决于调色板。这节课用算法生成和谐的色彩组合。

## HSL 比 RGB 更适合生成艺术

RGB 三个通道独立，很难直觉地"调出一种感觉"。HSL 把颜色拆成人脑理解的三个维度：

- **H（色相）**：什么颜色，0-360 度环
- **S（饱和度）**：多鲜艳，0% 是灰色，100% 是纯色
- **L（亮度）**：多亮，0% 是黑色，100% 是白色

选一个色相，调 S 和 L，就能得到一组视觉协调的颜色。

## 五种经典调色板算法

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="800" height="600"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

function hsl(h, s, l) {
  return `hsl(${h % 360}, ${s}%, ${l}%)`;
}

// 1. 单色（Monochrome）：固定色相，只变亮度
function monochrome(baseH, count = 8) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const l = 20 + (60 / (count - 1)) * i;
    colors.push(hsl(baseH, 70, l));
  }
  return colors;
}

// 2. 互补（Complementary）：色轮对面的两个色相
function complementary(baseH, count = 8) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const h = i % 2 === 0 ? baseH : (baseH + 180) % 360;
    const l = 30 + Math.random() * 40;
    colors.push(hsl(h, 65 + Math.random() * 20, l));
  }
  return colors;
}

// 3. 类似色（Analogous）：色轮上相邻的色相
function analogous(baseH, count = 8) {
  const colors = [];
  const spread = 30; // 色相展开范围
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const h = baseH - spread / 2 + spread * t;
    const l = 35 + Math.random() * 35;
    colors.push(hsl(h, 60 + Math.random() * 25, l));
  }
  return colors;
}

// 4. 三元（Triadic）：色轮上三等分的色相
function triadic(baseH, count = 9) {
  const colors = [];
  const offsets = [0, 120, 240];
  for (let i = 0; i < count; i++) {
    const h = baseH + offsets[i % 3];
    const l = 30 + Math.random() * 40;
    colors.push(hsl(h, 60 + Math.random() * 25, l));
  }
  return colors;
}

// 5. 噪声调色板：用噪声控制亮度和饱和度的微变化
function noisePalette(baseH, count = 12) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    // 色相在 ±20 度内微摆
    const h = baseH + Math.sin(t * Math.PI * 2) * 20;
    // 饱和度在 50-80 之间波动
    const s = 50 + Math.sin(t * Math.PI * 4 + 1) * 15;
    // 亮度从暗到亮
    const l = 25 + t * 50;
    colors.push(hsl(h, s, l));
  }
  return colors;
}

// ---- 绘制 ----
const palettes = [
  { name: '单色 Monochrome', fn: monochrome },
  { name: '互补 Complementary', fn: complementary },
  { name: '类似色 Analogous', fn: analogous },
  { name: '三元 Triadic', fn: triadic },
  { name: '噪声调色板', fn: noisePalette },
];

const baseH = Math.floor(Math.random() * 360);
const rowH = H / palettes.length;

palettes.forEach((p, row) => {
  const colors = p.fn(baseH);
  const cellW = W / colors.length;

  // 标签
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText(p.name, 10, row * rowH + 20);

  // 色块
  colors.forEach((c, col) => {
    ctx.fillStyle = c;
    ctx.fillRect(col * cellW, row * rowH + 30, cellW - 2, rowH - 40);
  });
});

// 底部显示基准色相
ctx.fillStyle = '#888';
ctx.font = '12px monospace';
ctx.fillText(`基准色相: ${baseH}° — 刷新页面换一组`, 10, H - 10);
</script>
</body>
</html>
```

## 调色板怎么用到作品里

调色板不只是"选几个好看的颜色"。在生成艺术中，颜色通常由算法分配：

- **按噪声值映射**：噪声输出 0-1，映射到调色板的渐变位置
- **按区域分配**：Voronoi 区域、细胞状态、粒子簇各自领一个颜色
- **按层级分配**：分形的深层用暗色，浅层用亮色，自动产生景深感

## 避坑指南

- 饱和度全拉满（100%）会像儿童画——大部分生成艺术用 50-80% 更耐看
- 亮度范围太窄会导致画面糊成一片——至少拉开 30% 的亮度差
- 黑色背景比白色背景更适合颜色丰富的作品——深色衬托让色彩更突出
- 不要在同一作品里混用冷暖调——选一个方向，用亮度和饱和度做层次

## 本课产出

五种调色板算法的可视化对比，每次刷新生成新组合。理解"为什么随机颜色不好看"以及"算法如何生成和谐色彩"。
