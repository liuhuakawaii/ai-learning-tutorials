# Voronoi 艺术

## 这节课解决什么问题

第 4 课用逐像素方法画了 Voronoi 图——很慢。这节课用 Delaunay 三角剖分的对偶性来高效生成 Voronoi 图，并在上面做艺术化处理：填充渐变色、加纹理、做动态效果。

## Delaunay 和 Voronoi 的关系

- **Delaunay 三角剖分**：把一组点连成三角形，使得每个三角形的外接圆内不含其他点
- **Voronoi 图**：每个种子点周围的"领地"，领地内的任何位置都比其他种子更近

它们是**对偶图**：Delaunay 三角形的外接圆心就是 Voronoi 的顶点。所以只需要实现 Delaunay，Voronoi 就自动出来了。

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

ctx.fillStyle = '#0a0a1a';
ctx.fillRect(0, 0, W, H);

// ---- Bowyer-Watson Delaunay 三角剖分 ----
function delaunay(points) {
  // 超级三角形（包含所有点）
  const st = [
    { x: -1000, y: -1000 },
    { x: 3000, y: -1000 },
    { x: 1000, y: 3000 },
  ];
  let triangles = [{ v: st }];

  for (const p of points) {
    const bad = [];
    for (const tri of triangles) {
      if (inCircumcircle(p, tri.v[0], tri.v[1], tri.v[2])) {
        bad.push(tri);
      }
    }

    // 找到边界边（只属于一个坏三角形的边）
    const edges = [];
    for (const tri of bad) {
      for (let i = 0; i < 3; i++) {
        const e = [tri.v[i], tri.v[(i + 1) % 3]];
        let shared = false;
        for (const other of bad) {
          if (other === tri) continue;
          for (let j = 0; j < 3; j++) {
            if (sameEdge(e, [other.v[j], other.v[(j + 1) % 3]])) {
              shared = true;
              break;
            }
          }
          if (shared) break;
        }
        if (!shared) edges.push(e);
      }
    }

    // 移除坏三角形，用新三角形替代
    triangles = triangles.filter(t => !bad.includes(t));
    for (const e of edges) {
      triangles.push({ v: [e[0], e[1], p] });
    }
  }

  // 移除包含超级三角形顶点的三角形
  return triangles.filter(t =>
    !t.v.some(v => st.some(s => s.x === v.x && s.y === v.y))
  );
}

function inCircumcircle(p, a, b, c) {
  const ax = a.x - p.x, ay = a.y - p.y;
  const bx = b.x - p.x, by = b.y - p.y;
  const cx = c.x - p.x, cy = c.y - p.y;
  const det = (ax * ax + ay * ay) * (bx * cy - cx * by)
            - (bx * bx + by * by) * (ax * cy - cx * ay)
            + (cx * cx + cy * cy) * (ax * by - bx * ay);
  return det > 0;
}

function sameEdge(e1, e2) {
  return (e1[0] === e2[0] && e1[1] === e2[1]) ||
         (e1[0] === e2[1] && e1[1] === e2[0]);
}

// 外接圆心（= Voronoi 顶点）
function circumcenter(a, b, c) {
  const D = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(D) < 1e-10) return null;
  const ux = ((a.x * a.x + a.y * a.y) * (b.y - c.y) + (b.x * b.x + b.y * b.y) * (c.y - a.y) + (c.x * c.x + c.y * c.y) * (a.y - b.y)) / D;
  const uy = ((a.x * a.x + a.y * a.y) * (c.x - b.x) + (b.x * b.x + b.y * b.y) * (a.x - c.x) + (c.x * c.x + c.y * c.y) * (b.x - a.x)) / D;
  return { x: ux, y: uy };
}

// ---- 生成点集 ----
const points = [];
// 核心区域用蓝噪声（均匀但不规则分布）
for (let i = 0; i < 60; i++) {
  let best = null, bestDist = 0;
  // 简单的 Mitchell 最佳候选法
  for (let c = 0; c < 10; c++) {
    const candidate = { x: Math.random() * W, y: Math.random() * H };
    let minD = Infinity;
    for (const p of points) {
      const d = (p.x - candidate.x) ** 2 + (p.y - candidate.y) ** 2;
      minD = Math.min(minD, d);
    }
    if (minD > bestDist) {
      bestDist = minD;
      best = candidate;
    }
  }
  if (best) points.push(best);
}

// ---- 三角剖分 ----
const triangles = delaunay(points);

// ---- 画 Voronoi 区域 ----
// 用三角形的外接圆心连线形成 Voronoi 边
const voronoiEdges = [];
for (const tri of triangles) {
  const cc = circumcenter(tri.v[0], tri.v[1], tri.v[2]);
  if (!cc) continue;
  tri.cc = cc;
}

// 找共享边的三角形对，连接它们的外接圆心
for (let i = 0; i < triangles.length; i++) {
  for (let j = i + 1; j < triangles.length; j++) {
    const a = triangles[i], b = triangles[j];
    let shared = 0;
    for (const va of a.v) {
      for (const vb of b.v) {
        if (va === vb) shared++;
      }
    }
    if (shared === 2 && a.cc && b.cc) {
      voronoiEdges.push([a.cc, b.cc]);
    }
  }
}

// 渲染 Voronoi 区域（用种子点的颜色）
points.forEach((p, i) => {
  const hue = (i * 137.508) % 360; // 黄金角分配
  // 找到这个点相关的所有三角形外接圆心，组成多边形
  const centers = [];
  for (const tri of triangles) {
    if (tri.v.includes(p) && tri.cc) {
      centers.push(tri.cc);
    }
  }
  if (centers.length < 3) return;

  // 按角度排序
  centers.sort((a, b) => {
    return Math.atan2(a.y - p.y, a.x - p.x) - Math.atan2(b.y - p.y, b.x - p.x);
  });

  ctx.fillStyle = `hsla(${hue}, 55%, 35%, 0.7)`;
  ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.5)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centers[0].x, centers[0].y);
  for (let k = 1; k < centers.length; k++) {
    ctx.lineTo(centers[k].x, centers[k].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
});

// 画种子点
points.forEach(p => {
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
  ctx.fill();
});

// 画 Delaunay 三角形（淡色）
ctx.strokeStyle = 'rgba(255,255,255,0.08)';
ctx.lineWidth = 0.5;
for (const tri of triangles) {
  ctx.beginPath();
  ctx.moveTo(tri.v[0].x, tri.v[0].y);
  ctx.lineTo(tri.v[1].x, tri.v[1].y);
  ctx.lineTo(tri.v[2].x, tri.v[2].y);
  ctx.closePath();
  ctx.stroke();
}
</script>
</body>
</html>
```

## 蓝噪声的重要性

随机撒点会导致有些区域密、有些区域疏。用 Mitchell 最佳候选法（每次生成多个候选，选离现有点最远的那个）可以得到更均匀的分布——这就是"蓝噪声"。效果上看，Voronoi 区域大小更均匀，视觉更舒服。

## Voronoi 的艺术用法

- **彩色玻璃窗**：每个区域填充不同颜色
- **裂纹效果**：Voronoi 边作为裂纹线
- **地形图**：每个区域代表一个"领地"
- **点彩画**：在每个区域内画不同纹理
- **动态 Voronoi**：种子点移动，区域实时更新

## 本课产出

60 个蓝噪声分布的种子点生成的 Voronoi 图，每个区域填充渐变色，底层叠加 Delaunay 三角形网格。
