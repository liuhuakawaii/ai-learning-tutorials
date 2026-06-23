# 形状生成

## 这节课解决什么问题

用代码画形状，最容易想到的是 `rect()` 和 `circle()`。但这些规则形状拼不出有机感。这节课用三种数学方法生成有生命力的曲线和形状：随机游走、Lissajous 曲线、参数方程。

## 随机游走：醉汉走路也能画画

随机游走是最简单的"有结构的随机"——每一步随机选一个方向，走一小段。最终轨迹会形成有机的、不可预测的线条。

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

ctx.fillStyle = '#111';
ctx.fillRect(0, 0, W, H);

// 随机游走：每步偏移一个随机角度
function randomWalk(steps = 5000) {
  let x = W / 2;
  let y = H / 2;
  let angle = Math.random() * Math.PI * 2;
  const stepSize = 3;

  ctx.strokeStyle = 'rgba(78, 205, 196, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);

  for (let i = 0; i < steps; i++) {
    // 角度微调：不是完全随机，而是上一步角度 ±一小段
    angle += (Math.random() - 0.5) * 0.8;
    x += Math.cos(angle) * stepSize;
    y += Math.sin(angle) * stepSize;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// Lissajous 曲线：两个正弦波叠加
// 直觉：就像用两根手指分别控制 X 和 Y 的摆动频率
function lissajous(cx, cy, a, b, phase, color, points = 1000) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * Math.PI * 2;
    const x = cx + Math.sin(a * t + phase) * 150;
    const y = cy + Math.sin(b * t) * 150;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// 参数方程花瓣：用角度控制半径
function flower(cx, cy, petals, color, points = 500) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * Math.PI * 2;
    const r = 80 + 60 * Math.cos(petals * t);
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ---- 绘制 ----

// 左上：随机游走
randomWalk(8000);

// 右上：Lissajous（3:4 频率比产生优美的结）
lissajous(600, 150, 3, 4, 0, 'rgba(255, 107, 107, 0.8)');
lissajous(600, 150, 3, 4, Math.PI / 4, 'rgba(78, 205, 196, 0.6)');
lissajous(600, 150, 3, 4, Math.PI / 2, 'rgba(255, 209, 102, 0.4)');

// 左下：参数方程花瓣
flower(200, 450, 5, 'rgba(155, 89, 182, 0.8)');
flower(200, 450, 7, 'rgba(52, 152, 219, 0.5)');

// 右下：叠加多个 Lissajous 形成图案
for (let i = 0; i < 12; i++) {
  const phase = (i / 12) * Math.PI * 2;
  const hue = (i / 12) * 360;
  lissajous(600, 450, 5, 6, phase, `hsla(${hue}, 70%, 60%, 0.4)`);
}

// 标签
ctx.fillStyle = '#888';
ctx.font = '12px monospace';
ctx.fillText('随机游走', 20, 30);
ctx.fillText('Lissajous 3:4', 510, 30);
ctx.fillText('参数方程花瓣', 140, 380);
ctx.fillText('Lissajous 叠加', 530, 380);
</script>
</body>
</html>
```

## 关键参数的视觉意义

**Lissajous 的 a:b 频率比**决定曲线形状：
- 1:1 → 椭圆（相位不同，椭圆旋转）
- 1:2 → 抛物线状
- 3:4 → 复杂的结状图案
- 频率比是无理数 → 曲线永远不闭合，最终填满整个区域

**参数方程的花瓣数**：
- `cos(3t)` → 三瓣
- `cos(5t)` → 五瓣
- `cos(2.5t)` → 不对称的五瓣（因为 2.5 不是整数）

**随机游走的 angle 偏移量**：
- 偏移大（±1.5）→ 轨迹像毛线团
- 偏移小（±0.1）→ 轨迹像缓弯的河流
- 偏移为 0 → 就是一条直线

## 组合使用

这些形状生成方法可以混合：
- 用随机游走的轨迹作为 Lissajous 的相位偏移
- 用参数方程控制粒子发射器的形状
- 用 Lissajous 曲线作为路径，沿路径排列圆形

## 本课产出

四个区域分别展示：随机游走的有机线条、Lissajous 的几何曲线、参数方程的花瓣、多组 Lissajous 叠加形成的复杂图案。
