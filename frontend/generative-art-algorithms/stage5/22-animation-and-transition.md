# 动画与过渡

## 这节课解决什么问题

静态的生成艺术可以很漂亮，但加上动画后生命力完全不同。这节课实现三种动画技术：噪声动画（形状随时间变形）、形态变换（一种形状平滑变成另一种）、生长动画（结构从种子展开）。

## 关键区别

- **帧动画**：每帧画全新的画面。简单但可能闪烁。
- **增量动画**：每帧在上一帧基础上修改。适合粒子和轨迹。
- **变形动画**：两组状态之间插值。需要起始和结束状态。

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

// 噪声
function hash(x, y) {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function fade(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
function noise2D(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  return lerp(
    lerp(hash(xi, yi), hash(xi + 1, yi), fade(x - xi)),
    lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), fade(x - xi)),
    fade(y - yi)
  );
}

// ---- 动画一：噪声变形圆 ----
function deformCircle(cx, cy, radius, time, points = 100) {
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const n = noise2D(
      Math.cos(angle) * 2 + time * 0.5,
      Math.sin(angle) * 2 + time * 0.5
    );
    const r = radius + n * radius * 0.4;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ---- 动画二：形态变换 ----
// 方形和圆形之间插值
function shapeMorph(cx, cy, size, t, detail = 60) {
  ctx.beginPath();
  for (let i = 0; i <= detail; i++) {
    const angle = (i / detail) * Math.PI * 2;

    // 方形坐标
    const sqX = cx + size * Math.sign(Math.cos(angle)) * Math.min(1, Math.abs(1 / Math.cos(angle)));
    const sqY = cy + size * Math.sign(Math.sin(angle)) * Math.min(1, Math.abs(1 / Math.sin(angle)));
    // 用更简单的方形近似
    const sqDist = size / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
    const squareX = cx + Math.cos(angle) * Math.min(size, sqDist);
    const squareY = cy + Math.sin(angle) * Math.min(size, sqDist);

    // 圆形坐标
    const circX = cx + Math.cos(angle) * size;
    const circY = cy + Math.sin(angle) * size;

    // 插值
    const smoothT = t * t * (3 - 2 * t); // ease-in-out
    const x = lerp(squareX, circX, smoothT);
    const y = lerp(squareY, circY, smoothT);

    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ---- 动画三：分形树生长 ----
const TREE_DEPTH = 10;
let growProgress = 0; // 0 → 1

function drawGrowingTree(cx, cy, angle, length, depth, progress) {
  if (depth <= 0 || length < 2) return;

  // 当前层级的生长进度
  const levelProgress = Math.min(1, progress * TREE_DEPTH - (TREE_DEPTH - depth));
  if (levelProgress <= 0) return;

  const targetX = cx + Math.cos(angle) * length;
  const targetY = cy + Math.sin(angle) * length;
  const currentX = lerp(cx, targetX, levelProgress);
  const currentY = lerp(cy, targetY, levelProgress);

  const hue = 120 + depth * 15;
  const alpha = 0.6 + levelProgress * 0.4;
  ctx.strokeStyle = `hsla(${hue}, 60%, ${35 + depth * 5}%, ${alpha})`;
  ctx.lineWidth = depth * 0.7;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(currentX, currentY);
  ctx.stroke();

  if (levelProgress >= 1) {
    const spread = 0.35 + (depth % 3) * 0.08;
    drawGrowingTree(targetX, targetY, angle - spread, length * 0.72, depth - 1, progress);
    drawGrowingTree(targetX, targetY, angle + spread, length * 0.72, depth - 1, progress);
  }
}

// ---- 主循环 ----
function animate() {
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);

  const time = performance.now() / 1000;

  // 左上：噪声变形圆
  ctx.strokeStyle = 'rgba(78, 205, 196, 0.8)';
  ctx.lineWidth = 2;
  deformCircle(160, 150, 80, time);
  ctx.stroke();
  // 第二个圆，噪声偏移
  ctx.strokeStyle = 'rgba(255, 107, 107, 0.5)';
  deformCircle(160, 150, 60, time + 10);
  ctx.stroke();
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText('噪声变形', 100, 260);

  // 右上：形态变换
  const morphT = (Math.sin(time * 0.8) + 1) / 2; // 0↔1 循环
  ctx.strokeStyle = 'rgba(155, 89, 182, 0.8)';
  ctx.lineWidth = 2;
  shapeMorph(500, 150, 80, morphT);
  ctx.stroke();
  ctx.fillStyle = '#888';
  ctx.fillText(`形态变换 (${(morphT * 100).toFixed(0)}% 圆)`, 420, 260);

  // 下方：分形树生长
  growProgress = (Math.sin(time * 0.3) + 1) / 2 * 1.2; // 缓慢生长
  drawGrowingTree(W / 2, H - 40, -Math.PI / 2, 80, TREE_DEPTH, growProgress);
  ctx.fillStyle = '#888';
  ctx.fillText('分形树生长', W / 2 - 40, H - 10);

  requestAnimationFrame(animate);
}

animate();
</script>
</body>
</html>
```

## 动画的时间感

**缓动函数**比匀速运动更有"感觉"：
- `ease-in`：慢启动，越来越快（物体下落）
- `ease-out`：快启动，越来越慢（刹车）
- `ease-in-out`：两头慢，中间快（最自然的过渡）
- `spring`：带弹性回弹（UI 动画常用）

上面的 `t * t * (3 - 2 * t)` 就是 ease-in-out。

## 噪声动画的关键

噪声值是确定的——`noise(x, y)` 永远返回同一个值。要让它动起来，需要加一个时间维度：`noise(x, y, time)`。但 3D 噪声比 2D 慢，所以常用两个技巧：

1. 把 time 加到 x 或 y 上：`noise(x + time, y)` → 图案水平滑动
2. 用 time 做旋转：把 (x, y) 旋转一个角度再采样噪声

## 本课产出

三个动画并排：左上的噪声变形圆、右上的方形↔圆形形态变换、下方的分形树生长动画。
