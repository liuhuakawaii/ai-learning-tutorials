# 遗传算法

## 这节课解决什么问题

假设你想画一幅抽象画，但不知道什么颜色组合最好看。你可以让程序"进化"出来：随机生成一组候选方案，让人类（或评分函数）挑出好看的，让它们"交配"产生下一代，反复迭代。这就是遗传算法在艺术中的用法。

## 核心概念的视觉直觉

- **基因**：一幅画的参数——颜色、位置、大小、形状
- **个体**：一组基因构成的一幅完整画
- **适应度**：这幅画有多"好"（可以用规则打分，也可以让人类选）
- **选择**：好的个体有更高概率被选中繁殖
- **交叉**：两个个体的基因各取一半，拼成新个体
- **变异**：随机改动个别基因，保持多样性

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="900" height="600"></canvas>
<div style="margin-top:10px;font:14px monospace;color:#ccc;">
  点击你更喜欢的缩略图来选择亲本。当前第 <span id="gen">1</span> 代。
  <button onclick="evolve()" style="margin-left:20px;padding:4px 12px;font:14px monospace;">进化下一代</button>
</div>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const POP_SIZE = 8;    // 种群大小：8 幅画
const GENES = 15;      // 每幅画由 15 个形状组成
const COLS = 4;
const ROWS = 2;
const CELL_W = W / COLS;
const CELL_H = H / ROWS;

let population = [];
let generation = 1;
let selected = [];

// 基因：一个形状的描述
function randomGene() {
  return {
    x: Math.random(),
    y: Math.random(),
    size: 0.05 + Math.random() * 0.2,
    hue: Math.random() * 360,
    sat: 50 + Math.random() * 40,
    lit: 30 + Math.random() * 40,
    alpha: 0.3 + Math.random() * 0.5,
    shape: Math.floor(Math.random() * 3), // 0=圆 1=矩形 2=三角
  };
}

// 个体：一组基因
function randomIndividual() {
  return Array.from({ length: GENES }, () => randomGene());
}

// 渲染一个个体到指定区域
function renderIndividual(genes, ox, oy, w, h) {
  // 背景
  ctx.fillStyle = '#111';
  ctx.fillRect(ox, oy, w, h);

  for (const g of genes) {
    const x = ox + g.x * w;
    const y = oy + g.y * h;
    const s = g.size * Math.min(w, h);
    ctx.fillStyle = `hsla(${g.hue}, ${g.sat}%, ${g.lit}%, ${g.alpha})`;

    if (g.shape === 0) {
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    } else if (g.shape === 1) {
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x - s, y + s);
      ctx.lineTo(x + s, y + s);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// 渲染整个种群
function render() {
  ctx.clearRect(0, 0, W, H);
  population.forEach((genes, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    renderIndividual(genes, col * CELL_W, row * CELL_H, CELL_W, CELL_H);
  });
  document.getElementById('gen').textContent = generation;
}

// 交叉：两个亲本各取一半基因
function crossover(parentA, parentB) {
  const child = [];
  for (let i = 0; i < GENES; i++) {
    child.push({ ...(Math.random() < 0.5 ? parentA[i] : parentB[i]) });
  }
  return child;
}

// 变异：随机改动个别基因
function mutate(genes, rate = 0.15) {
  return genes.map(g => {
    if (Math.random() < rate) {
      const mutated = { ...g };
      const field = ['x', 'y', 'size', 'hue', 'sat', 'lit', 'alpha'][Math.floor(Math.random() * 7)];
      if (field === 'hue') mutated.hue = Math.random() * 360;
      else if (field === 'size') mutated.size = 0.05 + Math.random() * 0.2;
      else if (field === 'x' || field === 'y') mutated[field] = Math.random();
      else mutated[field] = Math.max(0, Math.min(100, mutated[field] + (Math.random() - 0.5) * 30));
      return mutated;
    }
    return g;
  });
}

// 点击选择
canvas.addEventListener('click', (e) => {
  const col = Math.floor(e.offsetX / CELL_W);
  const row = Math.floor(e.offsetY / CELL_H);
  const idx = row * COLS + col;
  if (idx >= 0 && idx < POP_SIZE) {
    if (selected.includes(idx)) {
      selected = selected.filter(i => i !== idx);
    } else {
      selected.push(idx);
    }
    // 高亮选中的
    render();
    selected.forEach(i => {
      const c = i % COLS, r = Math.floor(i / COLS);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(c * CELL_W + 2, r * CELL_H + 2, CELL_W - 4, CELL_H - 4);
    });
  }
});

// 进化
function evolve() {
  if (selected.length < 2) {
    alert('请至少点选 2 幅你喜欢的画');
    return;
  }
  const parents = selected.map(i => population[i]);
  const newPop = [];

  // 精英保留：选中的直接进入下一代
  parents.forEach(p => newPop.push([...p]));

  // 繁殖填满种群
  while (newPop.length < POP_SIZE) {
    const a = parents[Math.floor(Math.random() * parents.length)];
    const b = parents[Math.floor(Math.random() * parents.length)];
    newPop.push(mutate(crossover(a, b)));
  }

  population = newPop;
  selected = [];
  generation++;
  render();
}

// 初始化
population = Array.from({ length: POP_SIZE }, () => randomIndividual());
render();
</script>
</body>
</html>
```

## 交互式 vs 自动适应度

这节课用的是**人工选择**——你自己点选喜欢的画。这比自动评分更有意思，因为"好看"很难量化。

自动适应度常用的规则：
- 颜色和谐度（色相分布是否集中）
- 对称性
- 形状分布均匀度
- 与目标图案的相似度（像素级差异）

但这些规则往往会进化出"符合规则但无聊"的作品。人工选择能保留更多意外之美。

## 遗传算法在艺术中的真实用法

- **Karl Sims 的进化虚拟生物**（1994）：用遗传算法进化 3D 生物形态
- **Fidenza**（Tyler Hobbs）：虽然不用遗传算法，但参数空间的探索逻辑类似
- **调色板进化**：让程序生成几百种调色板，人类快速筛选

## 本课产出

一个可交互的进化艺术系统。8 幅画显示在 4×2 网格中，点击选中喜欢的，点"进化下一代"产生新作品。几代之后就能看到风格逐渐收敛。
