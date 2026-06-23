# Reaction-Diffusion

## 这节课解决什么问题

斑马身上的条纹、贝壳上的螺旋纹、珊瑚的花纹——这些自然界反复出现的图案，可以用一个只有两种化学物质的数学模型来模拟。这就是 Gray-Scott 模型：两种物质 A 和 B，A 补充进来，B 被消耗掉，两者相遇时 B 吃掉 A 并繁殖自己。扩散速率不同，就产生花纹。

## 直觉理解

想象一个水族箱：
- A 是营养液，持续从外部补充
- B 是细菌，吃 A 来繁殖，自己也会自然死亡
- A 扩散快（到处流），B 扩散慢（待在原地）
- 当 B 够多时，它形成斑点或条纹；密度再高就变成迷宫纹

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="400" height="400"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = 200; // 模拟分辨率（低分辨率足够展示图案）
const H = 200;
const scale = canvas.width / W; // 放大倍数

// 两个化学物质的浓度网格
let gridA = Array.from({ length: H }, () => Array(W).fill(1));
let gridB = Array.from({ length: H }, () => Array(W).fill(0));

// 在中央区域撒入 B 物质种子
for (let y = 80; y < 120; y++) {
  for (let x = 80; x < 120; x++) {
    gridB[y][x] = 1;
    // 加一点随机性让图案不对称
    if (Math.random() > 0.5) gridB[y][x] = 0.8;
  }
}

// 四角也撒一些种子，让图案更丰富
const seeds = [[30, 30], [170, 30], [30, 170], [170, 170]];
seeds.forEach(([sx, sy]) => {
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      if (dx * dx + dy * dy < 25) {
        gridB[sy + dy][sx + dx] = 1;
      }
    }
  }
});

// Gray-Scott 参数
const dA = 1.0;    // A 的扩散率
const dB = 0.5;    // B 的扩散率（比 A 慢）
const feed = 0.055; // 补充 A 的速率
const kill = 0.062; // 消耗 B 的速率

// Laplacian：一个格子和四个邻居的差值之和
function laplacian(grid, x, y) {
  const center = grid[y][x];
  let sum = 0;
  sum += grid[(y - 1 + H) % H][x] - center;      // 上
  sum += grid[(y + 1) % H][x] - center;           // 下
  sum += grid[y][(x - 1 + W) % W] - center;       // 左
  sum += grid[y][(x + 1) % W] - center;           // 右
  // 加上对角邻居（权重 0.05）
  sum += 0.05 * (grid[(y - 1 + H) % H][(x - 1 + W) % W] - center);
  sum += 0.05 * (grid[(y - 1 + H) % H][(x + 1) % W] - center);
  sum += 0.05 * (grid[(y + 1) % H][(x - 1 + W) % W] - center);
  sum += 0.05 * (grid[(y + 1) % H][(x + 1) % W] - center);
  return sum;
}

// 模拟一步
function step() {
  const nextA = Array.from({ length: H }, () => Array(W).fill(0));
  const nextB = Array.from({ length: H }, () => Array(W).fill(0));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = gridA[y][x];
      const b = gridB[y][x];
      const abb = a * b * b;

      nextA[y][x] = Math.min(1, Math.max(0,
        a + dA * laplacian(gridA, x, y) - abb + feed * (1 - a)
      ));
      nextB[y][x] = Math.min(1, Math.max(0,
        b + dB * laplacian(gridB, x, y) + abb - (kill + feed) * b
      ));
    }
  }
  gridA = nextA;
  gridB = nextB;
}

// 渲染
function render() {
  const imgData = ctx.createImageData(W * scale, H * scale);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = gridA[y][x];
      const b = gridB[y][x];
      const diff = a - b;
      // A 多的地方偏暖色，B 多的地方偏冷色
      const r = Math.floor(Math.min(255, diff * 255 + b * 100));
      const g = Math.floor(Math.min(255, a * 180));
      const bl = Math.floor(Math.min(255, b * 255));
      // 写入放大后的像素块
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const i = ((y * scale + sy) * W * scale + x * scale + sx) * 4;
          imgData.data[i] = r;
          imgData.data[i + 1] = g;
          imgData.data[i + 2] = bl;
          imgData.data[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// 动画循环
let frame = 0;
function animate() {
  for (let i = 0; i < 5; i++) step(); // 每帧模拟 5 步加速收敛
  render();
  frame++;
  if (frame < 200) requestAnimationFrame(animate);
}
animate();
</script>
</body>
</html>
```

## 参数是魔法旋钮

`feed` 和 `kill` 两个参数的微小变化，会产出完全不同的图案：

| feed | kill | 图案 |
|------|------|------|
| 0.055 | 0.062 | 斑点（Solitons） |
| 0.037 | 0.060 | 迷宫纹（Maze） |
| 0.025 | 0.060 | 条纹/孔洞 |
| 0.012 | 0.050 | 脉动斑点 |

试试改这两个值重新运行，每次都有惊喜。

## 深色背景更对

这个模型的视觉效果在深色背景上最突出。B 物质密集的区域像是被腐蚀出来的花纹，A 物质是底色。

## 真实应用

- 贝壳花纹模拟（Meinhardt 的研究）
- 抽象纹理生成
- 动态背景
- 贴图生成（配合 UV 映射）

## 本课产出

一个 400×400 的动画窗口，观察 Gray-Scott 模型从种子区域扩散、最终形成稳定花纹的过程。运行 200 帧后自动停止。
