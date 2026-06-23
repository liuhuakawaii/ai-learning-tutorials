# 分形

## 这节课解决什么问题

分形的核心特征是**自相似**——放大后看到的结构和整体一样。一棵树的分支像小树，一片海岸线的局部像整体。这节课实现四种经典分形，重点是看到它们的视觉特征而非数学细节。

## 四种分形的直觉

- **Mandelbrot**：对复数反复做 `z = z² + c`，看它发散还是收敛。边界处有无穷细节。
- **Julia**：和 Mandelbrot 同一个公式，但固定 c，变 z₀。不同的 c 产生完全不同的图案。
- **Sierpinski 三角**：把等边三角形不断挖掉中间，递归三层就能认出来。
- **分形树**：一根线分成两根，每根再分两根，像真实的树。

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

// ---- Mandelbrot 集合 ----
function mandelbrot(ox, oy, w, h) {
  const imgData = ctx.createImageData(w, h);
  const maxIter = 80;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      // 映射像素到复数平面
      const cx = (px / w - 0.7) * 3.0;
      const cy = (py / h - 0.5) * 2.4;
      let zx = 0, zy = 0;
      let iter = 0;
      while (zx * zx + zy * zy < 4 && iter < maxIter) {
        const tmp = zx * zx - zy * zy + cx;
        zy = 2 * zx * zy + cy;
        zx = tmp;
        iter++;
      }
      const i = (py * w + px) * 4;
      if (iter === maxIter) {
        // 集合内部：黑色
        imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = 0;
      } else {
        // 集合外部：用迭代次数上色
        const t = iter / maxIter;
        imgData.data[i] = Math.floor(9 * (1 - t) * t * t * t * 255);
        imgData.data[i + 1] = Math.floor(15 * (1 - t) * (1 - t) * t * t * 255);
        imgData.data[i + 2] = Math.floor(8.5 * (1 - t) * (1 - t) * (1 - t) * t * 255);
      }
      imgData.data[i + 3] = 255;
    }
  }
  ctx.putImageData(imgData, ox, oy);
}

// ---- Julia 集合 ----
function julia(ox, oy, w, h, cr, ci) {
  const imgData = ctx.createImageData(w, h);
  const maxIter = 80;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let zx = (px / w - 0.5) * 3.0;
      let zy = (py / h - 0.5) * 2.4;
      let iter = 0;
      while (zx * zx + zy * zy < 4 && iter < maxIter) {
        const tmp = zx * zx - zy * zy + cr;
        zy = 2 * zx * zy + ci;
        zx = tmp;
        iter++;
      }
      const i = (py * w + px) * 4;
      if (iter === maxIter) {
        imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = 0;
      } else {
        const t = iter / maxIter;
        imgData.data[i] = Math.floor(255 * t);
        imgData.data[i + 1] = Math.floor(180 * (1 - t) * t * 2);
        imgData.data[i + 2] = Math.floor(200 * (1 - t));
      }
      imgData.data[i + 3] = 255;
    }
  }
  ctx.putImageData(imgData, ox, oy);
}

// ---- Sierpinski 三角 ----
function sierpinski(x, y, size, depth) {
  if (depth === 0) {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size * 0.866, y + size * 0.5);
    ctx.lineTo(x + size * 0.866, y + size * 0.5);
    ctx.closePath();
    ctx.fill();
    return;
  }
  const half = size / 2;
  sierpinski(x, y - half, half, depth - 1);          // 上
  sierpinski(x - half * 0.866, y + half * 0.5, half, depth - 1); // 左下
  sierpinski(x + half * 0.866, y + half * 0.5, half, depth - 1); // 右下
}

// ---- 分形树 ----
function tree(x, y, angle, length, depth) {
  if (depth === 0 || length < 2) return;
  const x2 = x + Math.cos(angle) * length;
  const y2 = y + Math.sin(angle) * length;
  const t = depth / 10;
  ctx.strokeStyle = `hsl(${120 + t * 60}, ${50 + t * 20}%, ${30 + t * 25}%)`;
  ctx.lineWidth = depth * 0.8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const spread = 0.4 + Math.random() * 0.2;
  tree(x2, y2, angle - spread, length * 0.72, depth - 1);
  tree(x2, y2, angle + spread, length * 0.72, depth - 1);
  if (Math.random() > 0.6) {
    tree(x2, y2, angle + (Math.random() - 0.5), length * 0.5, depth - 1);
  }
}

// ---- 绘制 ----
mandelbrot(10, 10, 280, 280);
julia(310, 10, 280, 280, -0.7, 0.27015);

ctx.fillStyle = 'rgba(155, 89, 182, 0.8)';
sierpinski(740, 160, 120, 6);

tree(170, 550, -Math.PI / 2, 80, 9);
tree(520, 550, -Math.PI / 2, 70, 10);

// 标签
ctx.fillStyle = '#888';
ctx.font = '12px monospace';
ctx.fillText('Mandelbrot 集合', 10, 300);
ctx.fillText('Julia 集合 (c = -0.7+0.27i)', 310, 300);
ctx.fillText('Sierpinski 三角', 670, 300);
ctx.fillText('分形树', 130, 360);
ctx.fillText('分形树（更密）', 480, 360);
</script>
</body>
</html>
```

## 改参数看效果

- **Mandelbrot**：修改映射范围 `(px / w - 0.7) * 3.0` 里的 `0.7` 和 `3.0`，可以放大某个区域
- **Julia**：改 `cr, ci` 参数。经典值：`(-0.7, 0.27015)`、`(0.355, 0.355)`、`(-0.4, 0.6)`
- **分形树**：改 `length * 0.72` 的衰减率。`0.7` 以下更稀疏，`0.8` 以上更茂密
- **递归深度**：Sierpinski 从 6 改到 8，分形树从 9 改到 12——细节暴增，但计算量也暴增

## 分形在生成艺术中的用法

- 分形树→植物、闪电、血管
- Mandelbrot 边界→无穷细节的装饰纹理
- Sierpinski→镂空图案、窗花
- 递归分形→嵌套构图

## 本课产出

四个区域：Mandelbrot 集合的标志性图案、Julia 集合的旋涡、Sierpinski 三角的镂空、两棵递归分形树。
