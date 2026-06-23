# 网格系统

## 这节课解决什么问题

矩形网格是编程里最常见的排列方式，但在视觉上它最无聊。自然界很少用正方形铺满空间——蜂巢是六边形，晶体是三角形，细胞是不规则的 Voronoi 区域。这节课实现三种更有生命力的网格，以及它们在生成艺术中的用法。

## 三种网格的视觉差异

- **矩形网格**：行列对齐，每个点有 4 个邻居。像棋盘。
- **六边形网格**：错行排列，每个点有 6 个邻居。像蜂巢。
- **三角网格**：等边三角形密铺，每个点有 6 个邻居但连接方式不同。像分子结构。

## 实现

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

ctx.fillStyle = '#111';
ctx.fillRect(0, 0, W, H);

// ---- 矩形网格 ----
function drawRectGrid(ox, oy, cols, rows, size) {
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + r * size);
    ctx.lineTo(ox + cols * size, oy + r * size);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(ox + c * size, oy);
    ctx.lineTo(ox + c * size, oy + rows * size);
    ctx.stroke();
  }
  // 在交叉点画圆
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = ox + c * size;
      const y = oy + r * size;
      const noise = Math.sin(c * 0.5) * Math.cos(r * 0.5);
      const radius = 3 + noise * 3;
      ctx.fillStyle = `hsl(${(c + r) * 20}, 70%, 60%)`;
      ctx.beginPath();
      ctx.arc(x, y, Math.abs(radius), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---- 六边形网格 ----
function drawHexGrid(ox, oy, cols, rows, size) {
  const w = size * 2;
  const h = Math.sqrt(3) * size;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // 奇数行右移半个单位
      const x = ox + c * w * 0.75;
      const y = oy + r * h + (c % 2 === 1 ? h / 2 : 0);

      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();

      // 中心点
      const hue = (r * cols + c) * 8;
      ctx.fillStyle = `hsl(${hue}, 60%, 55%)`;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---- 三角网格 ----
function drawTriGrid(ox, oy, cols, rows, size) {
  const h = size * Math.sqrt(3) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ox + c * size / 2;
      const y = oy + r * h;
      // 正三角和倒三角交替
      const upward = (r + c) % 2 === 0;

      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      if (upward) {
        ctx.moveTo(x, y + h);
        ctx.lineTo(x + size / 2, y);
        ctx.lineTo(x + size, y + h);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x + size / 2, y + h);
        ctx.lineTo(x + size, y);
      }
      ctx.closePath();
      ctx.stroke();

      // 填充颜色
      const hue = (r * cols + c) * 12;
      ctx.fillStyle = `hsla(${hue}, 65%, 50%, 0.3)`;
      ctx.fill();
    }
  }
}

// ---- Voronoi 图（最近邻划分）----
function drawVoronoi(ox, oy, w, h, points) {
  // 逐像素判断离哪个点最近
  const imgData = ctx.createImageData(w, h);
  const colors = points.map((_, i) => {
    const hue = (i * 137.508) % 360; // 黄金角分配色相
    return [hue, 60 + Math.random() * 20, 45 + Math.random() * 20];
  });

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let minDist = Infinity;
      let closest = 0;
      for (let i = 0; i < points.length; i++) {
        const dx = px - points[i][0];
        const dy = py - points[i][1];
        const d = dx * dx + dy * dy; // 不需要 sqrt，只比较大小
        if (d < minDist) {
          minDist = d;
          closest = i;
        }
      }
      const [hue, sat, lit] = colors[closest];
      const idx = (py * w + px) * 4;
      // 简化 HSL→RGB
      const c = lit / 100;
      imgData.data[idx] = c * 255;
      imgData.data[idx + 1] = c * 255;
      imgData.data[idx + 2] = c * 255;
      imgData.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, ox, oy);

  // 画种子点
  points.forEach(([x, y]) => {
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(ox + x, oy + y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ---- 绘制 ----
drawRectGrid(30, 40, 10, 8, 40);

drawHexGrid(480, 40, 8, 6, 28);

drawTriGrid(30, 340, 16, 8, 35);

// Voronoi：随机种子点
const voronoiPoints = [];
for (let i = 0; i < 20; i++) {
  voronoiPoints.push([Math.random() * 260, Math.random() * 200]);
}
drawVoronoi(580, 340, 260, 200, voronoiPoints);

// 标签
ctx.fillStyle = '#888';
ctx.font = '12px monospace';
ctx.fillText('矩形网格', 30, 30);
ctx.fillText('六边形网格', 480, 30);
ctx.fillText('三角网格', 30, 330);
ctx.fillText('Voronoi（逐像素计算，稍慢）', 580, 330);
</script>
</body>
</html>
```

## 选择网格的依据

| 网格类型 | 适用场景 | 视觉特征 |
|---------|---------|---------|
| 矩形 | 像素画、数据可视化、棋盘格 | 整齐、人工感强 |
| 六边形 | 地图、蜂窝、自然纹理 | 有机、无方向偏好 |
| 三角 | 低面风格(low-poly)、分子结构 | 锐利、几何感 |
| Voronoi | 细胞、裂纹、区域划分 | 自然、不规则 |

## Voronoi 的快速近似

上面的逐像素 Voronoi 很慢（O(像素数 × 种子数)）。实际项目中用 Fortune 算法或直接计算 Delaunay 三角剖分再取对偶图。后面课程会专门讲。

## 本课产出

四种网格的可视化对比：矩形网格的规整、六边形网格的蜂巢感、三角网格的锐利、Voronoi 的不规则区域划分。
