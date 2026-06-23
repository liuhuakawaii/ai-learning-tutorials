# Wave Function Collapse

## 这节课解决什么问题

给你一组小瓦片（比如草地、水面、道路），规定哪些瓦片可以相邻，然后让算法自动拼出一张大地图——相邻瓦片的边缘必须匹配。这就是 Wave Function Collapse（WFC）的核心思想。它从约束条件出发生成内容，而不是从随机出发。

## 直觉理解

想象你在玩拼图：
- 每个格子有几种可能的瓦片（"叠加态"）
- 你先选一个可能性最少的格子，随机确定它（"坍缩"）
- 确定后，邻居的可能选项就减少了（"传播约束"）
- 反复直到所有格子都确定

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="600" height="600"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const COLS = 20;
const ROWS = 20;
const CELL = canvas.width / COLS;

// 瓦片类型及其颜色
const TILES = {
  water:  { color: '#2980b9', edges: { up: 'water', down: 'water', left: 'water', right: 'water' } },
  sand:   { color: '#f39c12', edges: { up: 'water', down: 'grass', left: 'sand', right: 'sand' } },
  grass:  { color: '#27ae60', edges: { up: 'grass', down: 'grass', left: 'grass', right: 'grass' } },
  forest: { color: '#1a5c2a', edges: { up: 'grass', down: 'forest', left: 'forest', right: 'forest' } },
  rock:   { color: '#7f8c8d', edges: { up: 'rock', down: 'rock', left: 'rock', right: 'rock' } },
};

// 邻接规则：哪些瓦片可以放在哪个方向
// key: 当前瓦片, value: { 方向: [允许的瓦片列表] }
const ADJACENCY = {
  water:  { up: ['water', 'sand'], down: ['water', 'sand'], left: ['water', 'sand'], right: ['water', 'sand'] },
  sand:   { up: ['water', 'sand'], down: ['grass', 'sand'], left: ['sand', 'water', 'grass'], right: ['sand', 'water', 'grass'] },
  grass:  { up: ['sand', 'grass', 'forest'], down: ['grass', 'forest'], left: ['grass', 'sand', 'forest'], right: ['grass', 'sand', 'forest'] },
  forest: { up: ['grass', 'forest', 'rock'], down: ['forest', 'rock'], left: ['grass', 'forest', 'rock'], right: ['grass', 'forest', 'rock'] },
  rock:   { up: ['forest', 'rock'], down: ['forest', 'rock'], left: ['forest', 'rock'], right: ['forest', 'rock'] },
};

const DIRS = [
  { name: 'up', dr: -1, dc: 0, opposite: 'down' },
  { name: 'down', dr: 1, dc: 0, opposite: 'up' },
  { name: 'left', dr: 0, dc: -1, opposite: 'right' },
  { name: 'right', dr: 0, dc: 1, opposite: 'left' },
];

// 网格：每个格子存储还可能的瓦片列表
let grid = Array.from({ length: ROWS }, () =>
  Array.from({ length: COLS }, () => new Set(Object.keys(TILES)))
);

let collapsed = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

// 坍缩一个格子：随机选一个瓦片
function collapseCell(r, c) {
  const options = [...grid[r][c]];
  const chosen = options[Math.floor(Math.random() * options.length)];
  grid[r][c] = new Set([chosen]);
  collapsed[r][c] = true;
  return chosen;
}

// 传播约束
function propagate(r, c) {
  const queue = [[r, c]];
  while (queue.length > 0) {
    const [cr, cc] = queue.shift();
    const currentOptions = [...grid[cr][cc]];

    for (const dir of DIRS) {
      const nr = cr + dir.dr;
      const nc = cc + dir.dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (collapsed[nr][nc]) continue;

      // 计算邻居在当前方向上允许的瓦片
      const allowed = new Set();
      for (const tile of currentOptions) {
        for (const adj of ADJACENCY[tile][dir.name]) {
          allowed.add(adj);
        }
      }

      // 过滤邻居的选项
      const before = grid[nr][nc].size;
      for (const option of [...grid[nr][nc]]) {
        if (!allowed.has(option)) {
          grid[nr][nc].delete(option);
        }
      }

      // 如果选项减少了，继续传播
      if (grid[nr][nc].size < before) {
        if (grid[nr][nc].size === 0) {
          // 冲突：回退（简单处理：重置这个格子）
          grid[nr][nc] = new Set(Object.keys(TILES));
        }
        queue.push([nr, nc]);
      }
    }
  }
}

// 渲染
function render() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const options = [...grid[r][c]];
      if (options.length === 1) {
        ctx.fillStyle = TILES[options[0]].color;
      } else {
        // 未坍缩：用选项数量显示不确定性
        const entropy = options.length / Object.keys(TILES).length;
        const gray = Math.floor(30 + entropy * 40);
        ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
      }
      ctx.fillRect(c * CELL, r * CELL, CELL - 1, CELL - 1);
    }
  }
}

// 动画式逐步坍缩
function step() {
  // 找熵最小（选项最少）的未坍缩格子
  let minEntropy = Infinity;
  let minR = -1, minC = -1;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (collapsed[r][c]) continue;
      const e = grid[r][c].size;
      if (e < minEntropy) {
        minEntropy = e;
        minR = r;
        minC = c;
      }
    }
  }

  if (minR === -1) return false; // 全部完成

  collapseCell(minR, minC);
  propagate(minR, minC);
  render();
  return true;
}

// 初始化：先在四角放特定瓦片作为种子
grid[0][0] = new Set(['water']);
collapsed[0][0] = true;
grid[ROWS - 1][COLS - 1] = new Set(['rock']);
collapsed[ROWS - 1][COLS - 1] = true;
grid[0][COLS - 1] = new Set(['water']);
collapsed[0][COLS - 1] = true;
grid[ROWS - 1][0] = new Set(['rock']);
collapsed[ROWS - 1][0] = true;
propagate(0, 0);
propagate(ROWS - 1, COLS - 1);
propagate(0, COLS - 1);
propagate(ROWS - 1, 0);

render();

let interval = setInterval(() => {
  if (!step()) clearInterval(interval);
}, 50);
</script>
</body>
</html>
```

## WFC vs 其他生成方法

| 方法 | 思路 | 优点 | 缺点 |
|------|------|------|------|
| 纯随机 | 每格独立随机选 | 简单 | 无结构，看起来杂乱 |
| 噪声 | 用噪声值映射瓦片 | 有连续性 | 难控制局部约束 |
| WFC | 从约束出发坍缩 | 保证局部合理 | 可能冲突卡死 |

## WFC 的局限

- 需要手工设计瓦片和邻接规则——规则不好，结果就不好
- 可能卡死（某格没有任何合法选项）——实际实现需要回溯
- 计算量随网格大小指数增长——大地图需要优化

## 真实应用

- **Townscaper**：用类似 WFC 的方法生成城市
- **Bad North**：用 WFC 生成岛屿地形
- **像素画工具**：用 WFC 从样本生成新纹理

## 本课产出

一个 20×20 的地图，逐步从四角坍缩到填满，自动形成从水域→沙滩→草地→森林→岩石的自然过渡。
