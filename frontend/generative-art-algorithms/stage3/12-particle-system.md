# 粒子系统

## 这节课解决什么问题

粒子系统是生成艺术中最通用的工具之一。它的核心思想是：不直接画最终画面，而是模拟大量微小粒子的运动，让它们的轨迹构成画面。力场决定粒子怎么飞，生命周期决定粒子何时消失，叠加起来就能模拟火焰、烟雾、水流、光线。

## 核心组件

每个粒子只有几个属性：位置、速度、加速度、生命值、颜色。每帧做三件事：
1. 施加力（重力、风、吸引、排斥）
2. 更新速度和位置
3. 移除死亡粒子，补充新粒子

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

// ---- 粒子类 ----
class Particle {
  constructor(x, y, config) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * (config.speed || 2);
    this.vy = (Math.random() - 0.5) * (config.speed || 2);
    this.life = config.life || 120;
    this.maxLife = this.life;
    this.size = config.size || 2;
    this.hue = config.hue || 200;
    this.decay = config.decay || 0.98;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= this.decay;
    this.vy *= this.decay;
    this.life--;
  }

  draw() {
    const alpha = (this.life / this.maxLife) * 0.8;
    const size = this.size * (this.life / this.maxLife);
    ctx.fillStyle = `hsla(${this.hue}, 80%, 60%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  isDead() {
    return this.life <= 0;
  }
}

// ---- 场景一：粒子喷泉 ----
const fountain = [];
function runFountain() {
  // 从底部中心发射
  for (let i = 0; i < 3; i++) {
    fountain.push(new Particle(W * 0.2, H * 0.85, {
      speed: 4,
      life: 80,
      size: 3,
      hue: 30 + Math.random() * 30,
    }));
    // 给一个向上的初速度
    const p = fountain[fountain.length - 1];
    p.vx = (Math.random() - 0.5) * 3;
    p.vy = -4 - Math.random() * 3;
  }

  // 重力
  fountain.forEach(p => { p.vy += 0.08; });
  fountain.forEach(p => p.update());
  fountain.forEach(p => p.draw());

  // 移除死亡粒子
  for (let i = fountain.length - 1; i >= 0; i--) {
    if (fountain[i].isDead()) fountain.splice(i, 1);
  }
}

// ---- 场景二：吸引子 ----
const attractors = [
  { x: W * 0.7, y: H * 0.3, strength: 0.5 },
  { x: W * 0.85, y: H * 0.7, strength: -0.3 }, // 负值=排斥
];
const attracted = [];

function runAttractor() {
  for (let i = 0; i < 2; i++) {
    attracted.push(new Particle(
      W * 0.5 + (Math.random() - 0.5) * 200,
      H * 0.5 + (Math.random() - 0.5) * 200,
      { speed: 1, life: 200, size: 2, hue: 200 + Math.random() * 60 }
    ));
  }

  attracted.forEach(p => {
    attractors.forEach(a => {
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 10;
      const force = a.strength / (dist * 0.05);
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force;
    });
    p.update();
    p.draw();
  });

  for (let i = attracted.length - 1; i >= 0; i--) {
    if (attracted[i].isDead()) attracted.splice(i, 1);
  }

  // 画吸引子位置
  attractors.forEach(a => {
    ctx.fillStyle = a.strength > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,100,100,0.3)';
    ctx.beginPath();
    ctx.arc(a.x, a.y, 8, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ---- 场景三：漩涡 ----
const vortex = [];
const vortexCenter = { x: W * 0.5, y: H * 0.5 };

function runVortex() {
  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 100;
    vortex.push(new Particle(
      vortexCenter.x + Math.cos(angle) * dist,
      vortexCenter.y + Math.sin(angle) * dist,
      { speed: 0.5, life: 150, size: 1.5, hue: 280 + Math.random() * 40 }
    ));
  }

  vortex.forEach(p => {
    const dx = p.x - vortexCenter.x;
    const dy = p.y - vortexCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // 切向力（旋转）+ 径向力（吸向中心）
    p.vx += -dy / dist * 0.3 - dx / dist * 0.01;
    p.vy += dx / dist * 0.3 - dy / dist * 0.01;
    p.update();
    p.draw();
  });

  for (let i = vortex.length - 1; i >= 0; i--) {
    if (vortex[i].isDead()) vortex.splice(i, 1);
  }
}

// ---- 动画 ----
function animate() {
  // 不清空画布，让轨迹叠加形成拖尾
  ctx.fillStyle = 'rgba(10, 10, 26, 0.05)';
  ctx.fillRect(0, 0, W, H);

  runFountain();
  runAttractor();
  runVortex();

  requestAnimationFrame(animate);
}

// 标签
ctx.fillStyle = '#888';
ctx.font = '12px monospace';
ctx.fillText('粒子喷泉', 40, 30);
ctx.fillText('吸引子/排斥子', W * 0.55, 30);
ctx.fillText('漩涡', W * 0.45, H * 0.45);

animate();
</script>
</body>
</html>
```

## 画布不清空的技巧

注意动画循环里用 `rgba(10,10,26,0.05)` 覆盖而非 `clearRect`。这会让粒子留下渐隐的轨迹，产生发光拖尾效果。alpha 值越小，拖尾越长。

## 力场的种类

- **重力**：`vy += 常数`，简单但效果好
- **吸引/排斥**：力与距离成反比（或反平方），可以用鼠标位置做吸引子
- **漩涡**：切向力让粒子绕圈，径向力控制松紧
- **噪声力场**：每个位置的力方向由噪声决定（下节课流场会专门讲）

## 本课产出

三个粒子场景同时运行：左下角的粒子喷泉（带重力）、右上角的吸引子/排斥子、中央的漩涡。粒子轨迹叠加产生发光拖尾。
