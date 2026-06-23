# 细胞自动机

## 这节课解决什么问题

细胞自动机用最简单的规则产生复杂的涌现行为。每个细胞只看邻居的状态来决定自己下一帧是死是活——没有任何中央控制，但整体却出现结构、运动甚至计算能力。这节课实现三种经典细胞自动机。

## 三种细胞自动机的视觉差异

- **Game of Life**：二维网格，2 个邻居规则，产生滑翔机、振荡器、静止物
- **Langton's Ant**：一只"蚂蚁"在网格上走，简单的左右转规则画出高速公路
- **Rule 30**：一维，用上一行三个格子决定下一行一个格子，产生看似随机的三角形图案

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

// ---- Game of Life ----
function gameOfLife(ox, oy, cols, rows, cellSize, generations) {
  // 初始化随机网格
  let grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Math.random() > 0.7 ? 1 : 0)
  );

  function countNeighbors(g, r, c) {
    let sum = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = (r + dr + rows) % rows; // 环形边界
        const nc = (c + dc + cols) % cols;
        sum += g[nr][nc];
      }
    }
    return sum;
  }

  for (let gen = 0; gen < generations; gen++) {
    const next = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const n = countNeighbors(grid, r, c);
        if (grid[r][c] === 1) {
          next[r][c] = (n === 2 || n === 3) ? 1 : 0; // 存活条件
        } else {
          next[r][c] = n === 3 ? 1 : 0; // 诞生条件
        }
      }
    }
    grid = next;
  }

  // 渲染
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c]) {
        const hue = 120 + (r + c) * 2;
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.fillRect(ox + c * cellSize, oy + r * cellSize, cellSize - 1, cellSize - 1);
      }
    }
  }
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText(`Game of Life (${generations} 代)`, ox, oy - 5);
}

// ---- Langton's Ant ----
function langtonsAnt(ox, oy, w, h) {
  const grid = Array.from({ length: h }, () => Array(w).fill(0));
  let x = Math.floor(w / 2), y = Math.floor(h / 2);
  let dir = 0; // 0=上 1=右 2=下 3=左
  const dx = [0, 1, 0, -1];
  const dy = [-1, 0, 1, 0];

  for (let step = 0; step < 12000; step++) {
    if (grid[y][x] === 0) {
      grid[y][x] = 1;
      dir = (dir + 1) % 4; // 白格右转
    } else {
      grid[y][x] = 0;
      dir = (dir + 3) % 4; // 黑格左转
    }
    x = (x + dx[dir] + w) % w;
    y = (y + dy[dir] + h) % h;
  }

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (grid[r][c]) {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(ox + c, oy + r, 1, 1);
      }
    }
  }
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText("Langton's Ant (12000 步)", ox, oy - 5);
}

// ---- Rule 30 ----
function rule30(ox, oy, width, rows) {
  let row = Array(width).fill(0);
  row[Math.floor(width / 2)] = 1; // 种子：中间一个活细胞

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < width; c++) {
      if (row[c]) {
        ctx.fillStyle = `hsl(${280 + r * 0.5}, 60%, ${40 + Math.random() * 20}%)`;
        ctx.fillRect(ox + c, oy + r, 1, 1);
      }
    }
    // 计算下一行
    const next = Array(width).fill(0);
    for (let c = 0; c < width; c++) {
      const left = row[(c - 1 + width) % width];
      const center = row[c];
      const right = row[(c + 1) % width];
      const pattern = (left << 2) | (center << 1) | right;
      // Rule 30 的二进制：00011110
      next[c] = (30 >> pattern) & 1;
    }
    row = next;
  }
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText('Rule 30', ox, oy - 5);
}

// ---- 绘制 ----
gameOfLife(20, 40, 60, 40, 7, 100);
langtonsAnt(500, 40, 300, 200);
rule30(20, 350, 860, 230);
</script>
</body>
</html>
```

## 涌现：规则简单，行为复杂

Game of Life 只有两条规则（活细胞 2-3 邻居存活，死细胞 3 邻居诞生），但能产生：
- **静止物**：2×2 方块、蜂窝
- **振荡器**：闪烁灯、脉冲星
- **滑翔机**：能"移动"的结构，每 4 代移一格

这些不是预设的——它们从规则中"涌现"出来。这是生成艺术的核心思想：设计规则，让复杂性自己出现。

## Rule 30 为什么重要

Stephen Wolfram 发现 Rule 30 产生的图案看起来完全随机，但它是确定性的。这个一维细胞自动机曾被用作伪随机数生成器。它的视觉特征——左侧有规律三角形，右侧看似随机——在生成艺术中很受欢迎。

## 本课产出

三个区域：Game of Life 的彩色细胞群落、Langton's Ant 走出的高速公路、Rule 30 的三角形伪随机图案。
