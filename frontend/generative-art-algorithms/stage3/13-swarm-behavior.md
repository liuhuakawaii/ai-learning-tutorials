# 群体行为

## 这节课解决什么问题

鸟群没有领队，但它们能整齐地转向、分散、再聚合。鱼群、蜂群也有类似行为。Craig Reynolds 在 1986 年发现，只需要三条规则就能模拟这种"涌现"的群体秩序：

1. **分离**：别撞到邻居
2. **对齐**：和邻居飞同一个方向
3. **聚合**：别离群体太远

这三条规则只看局部，没有全局指挥，但整体涌现出流畅的群体运动。

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

const NUM_BOIDS = 120;
const BOID_SIZE = 6;

// Boid 参数（调这些旋钮看效果）
const SEPARATION_DIST = 25;
const ALIGNMENT_DIST = 50;
const COHESION_DIST = 80;
const SEPARATION_FORCE = 0.05;
const ALIGNMENT_FORCE = 0.02;
const COHESION_FORCE = 0.01;
const MAX_SPEED = 3;
const MIN_SPEED = 1.5;

class Boid {
  constructor() {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.hue = 180 + Math.random() * 60;
  }

  update(boids) {
    let sepX = 0, sepY = 0, sepCount = 0;
    let aliX = 0, aliY = 0, aliCount = 0;
    let cohX = 0, cohY = 0, cohCount = 0;

    for (const other of boids) {
      if (other === this) continue;
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 分离：太近就推开
      if (dist < SEPARATION_DIST && dist > 0) {
        sepX -= dx / dist;
        sepY -= dy / dist;
        sepCount++;
      }
      // 对齐：一定范围内，取邻居速度的平均
      if (dist < ALIGNMENT_DIST) {
        aliX += other.vx;
        aliY += other.vy;
        aliCount++;
      }
      // 聚合：一定范围内，向邻居中心靠拢
      if (dist < COHESION_DIST) {
        cohX += other.x;
        cohY += other.y;
        cohCount++;
      }
    }

    // 应用力
    if (sepCount > 0) {
      this.vx += (sepX / sepCount) * SEPARATION_FORCE;
      this.vy += (sepY / sepCount) * SEPARATION_FORCE;
    }
    if (aliCount > 0) {
      this.vx += ((aliX / aliCount) - this.vx) * ALIGNMENT_FORCE;
      this.vy += ((aliY / aliCount) - this.vy) * ALIGNMENT_FORCE;
    }
    if (cohCount > 0) {
      this.vx += ((cohX / cohCount - this.x)) * COHESION_FORCE;
      this.vy += ((cohY / cohCount - this.y)) * COHESION_FORCE;
    }

    // 速度限制
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > MAX_SPEED) {
      this.vx = (this.vx / speed) * MAX_SPEED;
      this.vy = (this.vy / speed) * MAX_SPEED;
    }
    if (speed < MIN_SPEED) {
      this.vx = (this.vx / speed) * MIN_SPEED;
      this.vy = (this.vy / speed) * MIN_SPEED;
    }

    // 更新位置
    this.x += this.vx;
    this.y += this.vy;

    // 环形边界：从一边出去，从另一边回来
    if (this.x < 0) this.x += W;
    if (this.x > W) this.x -= W;
    if (this.y < 0) this.y += H;
    if (this.y > H) this.y -= H;
  }

  draw() {
    const angle = Math.atan2(this.vy, this.vx);
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const alpha = 0.5 + (speed / MAX_SPEED) * 0.5;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    // 画三角形
    ctx.fillStyle = `hsla(${this.hue}, 70%, 60%, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(BOID_SIZE, 0);
    ctx.lineTo(-BOID_SIZE * 0.6, -BOID_SIZE * 0.4);
    ctx.lineTo(-BOID_SIZE * 0.6, BOID_SIZE * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

const boids = Array.from({ length: NUM_BOIDS }, () => new Boid());

// 鼠标交互：点击添加排斥力
let mouseX = -100, mouseY = -100;
canvas.addEventListener('mousemove', (e) => {
  mouseX = e.offsetX;
  mouseY = e.offsetY;
});

function animate() {
  ctx.fillStyle = 'rgba(10, 10, 26, 0.15)';
  ctx.fillRect(0, 0, W, H);

  // 鼠标排斥力
  boids.forEach(b => {
    const dx = b.x - mouseX;
    const dy = b.y - mouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 100 && dist > 0) {
      b.vx += (dx / dist) * 0.5;
      b.vy += (dy / dist) * 0.5;
    }
  });

  boids.forEach(b => b.update(boids));
  boids.forEach(b => b.draw());

  requestAnimationFrame(animate);
}

ctx.fillStyle = '#0a0a1a';
ctx.fillRect(0, 0, W, H);
animate();
</script>
</body>
</html>
```

## 参数的视觉效果

| 参数 | 值小 | 值大 |
|------|------|------|
| SEPARATION_FORCE | 粒子挤成一团 | 粒子散开不聚群 |
| ALIGNMENT_FORCE | 各飞各的 | 整齐的鱼群效果 |
| COHESION_FORCE | 松散分布 | 紧密的鸟群 |
| MAX_SPEED | 慢悠悠 | 飞快但难控制 |

最有趣的实验：把 COHESION_FORCE 调大到 0.05，看粒子快速聚成一个紧密球体。

## 涌现现象

三条简单规则叠加后出现的行为：
- **旋转漩涡**：大量 boids 形成环形流动
- **分裂与合并**：群体遇到障碍（或鼠标）时分裂，过后合并
- **领导者效应**：没有指定 leader，但最前面的 boid 自然成为临时 leader

## 本课产出

120 个三角形 boids 在深色画布上形成流畅的群体运动。鼠标移动时 boids 会避开。轨迹叠加产生运动模糊效果。
