# 阶段实战：用遗传算法进化出一组艺术图案

## 目标

用第 11 课的遗传算法框架，但这次进化的是**参数化图案生成器**而非简单形状。每个个体的基因控制一个算法的参数，让程序自动进化出视觉上有趣的图案。

## 设计思路

每个个体控制一个"旋涡生成器"的参数：
- 中心位置、旋转速度、颜色范围
- 粒子数量、力场强度
- 几种对称模式

适应度函数不靠人工选择，而是用规则自动评分：颜色多样性、对称性、细节密度。

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

// 基因定义
function randomGenome() {
  return {
    // 旋涡参数
    centerX: 0.3 + Math.random() * 0.4,
    centerY: 0.3 + Math.random() * 0.4,
    spiralTightness: 0.5 + Math.random() * 3,
    rotationSpeed: 0.5 + Math.random() * 2,
    // 力场
    attractStrength: 0.1 + Math.random() * 0.5,
    repelStrength: 0.05 + Math.random() * 0.3,
    noiseScale: 20 + Math.random() * 80,
    noiseStrength: 0.5 + Math.random() * 2,
    // 颜色
    hueBase: Math.random() * 360,
    hueRange: 30 + Math.random() * 120,
    satBase: 50 + Math.random() * 40,
    // 对称
    symmetry: [1, 2, 3, 4, 5, 6][Math.floor(Math.random() * 6)],
    // 粒子
    particleCount: 200 + Math.floor(Math.random() * 400),
    particleLife: 50 + Math.floor(Math.random() * 150),
    particleSize: 1 + Math.random() * 3,
  };
}

// 噪声
function hash(x, y) {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function fade(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
function noise2D(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  return lerp(
    lerp(hash(xi, yi), hash(xi + 1, yi), fade(xf)),
    lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), fade(xf)),
    fade(yf)
  );
}

// 渲染一个个体
function renderGenome(genome, ox, oy, size) {
  const cx = ox + genome.centerX * size;
  const cy = oy + genome.centerY * size;
  const imgData = ctx.createImageData(size, size);

  // 用粒子轨迹渲染
  const particles = [];
  for (let i = 0; i < genome.particleCount; i++) {
    particles.push({
      x: ox + Math.random() * size,
      y: oy + Math.random() * size,
      life: genome.particleLife,
    });
  }

  // 每个像素的颜色累加
  const accum = Array.from({ length: size * size }, () => [0, 0, 0, 0]);

  for (const p of particles) {
    let px = p.x, py = p.y;
    for (let step = 0; step < p.life; step++) {
      const lpx = Math.floor(px - ox);
      const lpy = Math.floor(py - oy);
      if (lpx < 0 || lpx >= size || lpy < 0 || lpy >= size) break;

      // 对称变换
      for (let s = 0; s < genome.symmetry; s++) {
        const angle = (s / genome.symmetry) * Math.PI * 2;
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const a = Math.atan2(dy, dx) + angle;
        const sx = Math.floor(cx + Math.cos(a) * dist - ox);
        const sy = Math.floor(cy + Math.sin(a) * dist - oy);
        if (sx >= 0 && sx < size && sy >= 0 && sy < size) {
          const idx = sy * size + sx;
          const hue = (genome.hueBase + dist * 0.5 + step * 2) % 360;
          const t = step / p.life;
          accum[idx][0] += (1 - t) * 0.3;
          accum[idx][1] += (1 - t) * 0.2;
          accum[idx][2] += (1 - t) * 0.5;
          accum[idx][3] += 0.5;
        }
      }

      // 力场更新
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) + 1;
      const angle = Math.atan2(dy, dx);

      // 螺旋力
      const spiralAngle = angle + genome.spiralTightness / dist * 50;
      px += Math.cos(spiralAngle) * genome.rotationSpeed;
      py += Math.sin(spiralAngle) * genome.rotationSpeed;

      // 噪声力
      const n = noise2D(px / genome.noiseScale, py / genome.noiseScale);
      px += Math.cos(n * Math.PI * 4) * genome.noiseStrength;
      py += Math.sin(n * Math.PI * 4) * genome.noiseStrength;
    }
  }

  // 写入像素
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const [r, g, b, a] = accum[idx];
      const maxV = Math.max(r, g, b, 1);
      const pi = idx * 4;
      imgData.data[pi] = Math.min(255, (r / maxV) * 255 * (genome.hueBase / 360 + 0.3));
      imgData.data[pi + 1] = Math.min(255, (g / maxV) * 200);
      imgData.data[pi + 2] = Math.min(255, (b / maxV) * 255);
      imgData.data[pi + 3] = Math.min(255, a * 20);
    }
  }
  ctx.putImageData(imgData, ox, oy);
}

// 适应度评分
function fitness(genome) {
  // 用渲染后的像素分析
  const size = 50;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = tempCanvas.height = size;
  const tempCtx = tempCanvas.getContext('2d');
  // 简化：直接基于基因参数评分
  let score = 0;
  // 颜色多样性
  score += Math.min(genome.hueRange / 120, 1) * 30;
  // 对称性（4-6 对称得分高）
  if (genome.symmetry >= 4) score += 20;
  // 粒子密度
  score += Math.min(genome.particleCount / 500, 1) * 20;
  // 力场复杂度
  score += Math.min(genome.noiseStrength, 2) * 10;
  // 随机扰动避免全部收敛
  score += Math.random() * 15;
  return score;
}

// 遗传操作
function crossover(a, b) {
  const child = {};
  for (const key of Object.keys(a)) {
    child[key] = Math.random() < 0.5 ? a[key] : b[key];
  }
  return child;
}

function mutate(genome, rate = 0.2) {
  const mutated = { ...genome };
  for (const key of Object.keys(mutated)) {
    if (Math.random() < rate) {
      if (key === 'symmetry') {
        mutated.symmetry = [1, 2, 3, 4, 5, 6][Math.floor(Math.random() * 6)];
      } else if (key === 'particleCount') {
        mutated.particleCount = 200 + Math.floor(Math.random() * 400);
      } else if (key === 'hueBase') {
        mutated.hueBase = Math.random() * 360;
      } else {
        mutated[key] *= 0.7 + Math.random() * 0.6;
      }
    }
  }
  return mutated;
}

// 主循环
const POP_SIZE = 9;
const COLS = 3;
const CELL = Math.floor(W / COLS);

let population = Array.from({ length: POP_SIZE }, () => randomGenome());

function renderAll() {
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);
  population.forEach((g, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    renderGenome(g, col * CELL, row * CELL, CELL);
  });
}

function evolveGeneration() {
  // 评分
  const scores = population.map(g => ({ genome: g, score: fitness(g) }));
  scores.sort((a, b) => b.score - a.score);

  // 选择前 3 作为亲本
  const parents = scores.slice(0, 3).map(s => s.genome);
  const newPop = [...parents]; // 精英保留

  while (newPop.length < POP_SIZE) {
    const a = parents[Math.floor(Math.random() * parents.length)];
    const b = parents[Math.floor(Math.random() * parents.length)];
    newPop.push(mutate(crossover(a, b)));
  }

  population = newPop;
  renderAll();
}

renderAll();

// 每 2 秒进化一代
let gen = 1;
setInterval(() => {
  evolveGeneration();
  gen++;
}, 2000);
</script>
</body>
</html>
```

## 代码拆解

1. **基因结构**（randomGenome）：14 个参数控制旋涡生成器
2. **渲染器**（renderGenome）：模拟粒子在力场中的轨迹，用对称变换增强美感
3. **适应度函数**：基于基因参数自动评分（颜色多样性、对称性、复杂度）
4. **进化循环**：每 2 秒自动进化一代，精英保留 + 交叉 + 变异

## 适应度函数的陷阱

自动评分很容易陷入"符合规则但无聊"的陷阱。常见的坑：
- 颜色多样性高 → 程序学会把所有颜色都塞进去 → 彩虹噪音
- 对称性高 → 程序只保留完全对称 → 无趣
- 加随机扰动可以部分缓解，但更好的方案是混合自动+人工评分

## 本课产出

9 幅旋涡图案排列成 3×3 网格，每 2 秒自动进化一代。观察图案如何从随机噪声逐渐收敛为有结构的对称图案。
