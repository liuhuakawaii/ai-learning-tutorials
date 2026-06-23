# 交互式生成

## 这节课解决什么问题

让用户的鼠标、触摸、键盘输入直接影响生成过程。不是调参数然后看结果，而是实时参与创作——鼠标画出轨迹，粒子跟随；触摸改变流场；键盘切换模式。交互让生成艺术从"观看"变成"参与"。

## 三种交互模式

1. **鼠标作吸引子**：粒子被鼠标吸引或排斥
2. **绘画驱动生成**：鼠标轨迹成为流场的种子
3. **触摸改变规则**：不同区域有不同的生成规则

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="800" height="600"></canvas>
<div style="font:13px monospace;color:#ccc;padding:8px;">
  模式: <span id="mode">吸引</span>
  <button onclick="setMode('attract')" style="margin-left:10px;padding:3px 8px;font:13px monospace;">吸引</button>
  <button onclick="setMode('repel')" style="margin-left:4px;padding:3px 8px;font:13px monospace;">排斥</button>
  <button onclick="setMode('flow')" style="margin-left:4px;padding:3px 8px;font:13px monospace;">流场</button>
  <button onclick="setMode('draw')" style="margin-left:4px;padding:3px 8px;font:13px monospace;">绘画</button>
  <button onclick="clearCanvas()" style="margin-left:4px;padding:3px 8px;font:13px monospace;">清除</button>
</div>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

let mode = 'attract';
function setMode(m) { mode = m; document.getElementById('mode').textContent = m; }
function clearCanvas() {
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);
  particles = createParticles();
  trails = [];
}

// 鼠标状态
let mouseX = W / 2, mouseY = H / 2;
let mouseDown = false;
let prevMouseX = mouseX, prevMouseY = mouseY;

canvas.addEventListener('mousemove', (e) => {
  prevMouseX = mouseX;
  prevMouseY = mouseY;
  mouseX = e.offsetX;
  mouseY = e.offsetY;
});
canvas.addEventListener('mousedown', () => mouseDown = true);
canvas.addEventListener('mouseup', () => mouseDown = false);
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  prevMouseX = mouseX;
  prevMouseY = mouseY;
  mouseX = t.clientX - rect.left;
  mouseY = t.clientY - rect.top;
  mouseDown = true;
}, { passive: false });
canvas.addEventListener('touchend', () => mouseDown = false);

// 绘画轨迹
let trails = [];

// ---- 粒子 ----
const PARTICLE_COUNT = 1500;

function createParticle() {
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    vx: 0, vy: 0,
    life: 100 + Math.random() * 200,
    maxLife: 300,
    hue: 200 + Math.random() * 60,
    size: 1 + Math.random() * 2,
  };
}

let particles = Array.from({ length: PARTICLE_COUNT }, () => createParticle());

// 噪声
function hash(x, y) {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function fade(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
function noise2D(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  return lerp(
    lerp(hash(xi, yi), hash(xi + 1, yi), fade(x - xi)),
    lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), fade(x - xi)),
    fade(y - yi)
  );
}

function animate() {
  // 超淡覆盖
  ctx.fillStyle = 'rgba(10, 10, 26, 0.03)';
  ctx.fillRect(0, 0, W, H);

  const time = performance.now() / 1000;

  // 记录绘画轨迹
  if (mode === 'draw' && mouseDown) {
    trails.push({ x: mouseX, y: mouseY, age: 0 });
    if (trails.length > 2000) trails.shift();
  }

  // 更新粒子
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    switch (mode) {
      case 'attract': {
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 10;
        const force = 50 / (dist + 50);
        p.vx += (dx / dist) * force * 0.3;
        p.vy += (dy / dist) * force * 0.3;
        break;
      }
      case 'repel': {
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy) + 10;
        if (dist < 150) {
          const force = 100 / (dist + 50);
          p.vx += (dx / dist) * force * 0.5;
          p.vy += (dy / dist) * force * 0.5;
        }
        break;
      }
      case 'flow': {
        // 鼠标位置影响流场
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const baseAngle = noise2D(p.x * 0.005, p.y * 0.005 + time * 0.2) * Math.PI * 4;
        const mouseAngle = Math.atan2(dy, dx);
        const influence = Math.max(0, 1 - dist / 300);
        const angle = lerp(baseAngle, mouseAngle, influence * 0.5);
        p.vx += Math.cos(angle) * 0.3;
        p.vy += Math.sin(angle) * 0.3;
        break;
      }
      case 'draw': {
        // 跟随最近的轨迹点
        let minD = Infinity, closest = null;
        for (const t of trails) {
          const d = (t.x - p.x) ** 2 + (t.y - p.y) ** 2;
          if (d < minD) { minD = d; closest = t; }
        }
        if (closest && minD < 200 * 200) {
          const dx = closest.x - p.x;
          const dy = closest.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          p.vx += (dx / dist) * 0.5;
          p.vy += (dy / dist) * 0.5;
        }
        // 加一点噪声扰动
        const n = noise2D(p.x * 0.01, p.y * 0.01 + time * 0.1);
        p.vx += Math.cos(n * Math.PI * 2) * 0.1;
        p.vy += Math.sin(n * Math.PI * 2) * 0.1;
        break;
      }
    }

    // 阻尼
    p.vx *= 0.95;
    p.vy *= 0.95;

    // 速度限制
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (speed > 5) {
      p.vx = (p.vx / speed) * 5;
      p.vy = (p.vy / speed) * 5;
    }

    p.x += p.vx;
    p.y += p.vy;
    p.life--;

    // 边界
    if (p.x < 0) p.x += W;
    if (p.x > W) p.x -= W;
    if (p.y < 0) p.y += H;
    if (p.y > H) p.y -= H;

    // 画粒子
    const alpha = Math.min(1, p.life / 50) * 0.6;
    const hue = p.hue + speed * 20;
    ctx.fillStyle = `hsla(${hue}, 70%, 55%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    // 重置
    if (p.life <= 0) {
      particles[i] = createParticle();
    }
  }

  // 画绘画轨迹
  if (mode === 'draw') {
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < trails.length; i++) {
      const t = trails[i];
      i === 0 ? ctx.moveTo(t.x, t.y) : ctx.lineTo(t.x, t.y);
      t.age++;
    }
    ctx.stroke();
    // 清除过老的轨迹
    trails = trails.filter(t => t.age < 500);
  }

  // 鼠标光标
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 20, 0, Math.PI * 2);
  ctx.stroke();

  requestAnimationFrame(animate);
}

ctx.fillStyle = '#0a0a1a';
ctx.fillRect(0, 0, W, H);
animate();
</script>
</body>
</html>
```

## 四种模式的效果

- **吸引**：粒子像飞蛾扑火一样涌向鼠标
- **排斥**：鼠标像石头扔进池塘，粒子四散
- **流场**：鼠标改变噪声流场的方向，粒子跟着流动
- **绘画**：按住鼠标画轨迹，粒子被轨迹吸引形成发光线条

## 交互设计的要点

1. **即时反馈**：用户的每个动作都应该有可见的响应
2. **渐进式复杂**：不要一开始就把所有交互塞进去
3. **可逆性**：提供清除/撤销功能
4. **触屏兼容**：同时监听 mouse 和 touch 事件

## 本课产出

一个 1500 粒子的交互式生成系统，四种模式通过按钮切换。鼠标移动实时影响粒子行为，绘画模式可以画出光轨。
