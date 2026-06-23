# 流场可视化

## 这节课解决什么问题

流场是一个"每点都有方向"的场——想象风吹过草原，每根草倒向不同方向。用 Perlin 噪声给每个位置分配一个角度，粒子在场中流动，轨迹就形成优美的流线图案。这是生成艺术中最有表现力的技术之一。

## 核心思想

1. 用噪声生成一个角度场：每个 (x, y) 对应一个角度
2. 在场中释放大量粒子
3. 每帧每个粒子按当前位置的角度走一小步
4. 粒子的轨迹叠加形成流线

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

// 噪声函数
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
function fbm(x, y, octaves = 3) {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < octaves; i++) {
    v += a * noise2D(x * f, y * f);
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

// 流场参数
const NOISE_SCALE = 0.003;  // 噪声缩放（越小→流线越平缓）
const TIME_SPEED = 0.0005;  // 时间演化速度
const STEP_SIZE = 2;        // 每步前进距离
const PARTICLE_COUNT = 2000;
const PARTICLE_LIFE = 120;  // 每个粒子存活帧数

let time = 0;

// 粒子
function createParticle() {
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    life: PARTICLE_LIFE + Math.floor(Math.random() * 60),
    maxLife: PARTICLE_LIFE,
    hue: Math.random() * 360,
  };
}

let particles = Array.from({ length: PARTICLE_COUNT }, () => createParticle());

// 获取流场角度
function getAngle(x, y, t) {
  return fbm(x * NOISE_SCALE, y * NOISE_SCALE + t, 3) * Math.PI * 4;
}

function animate() {
  // 淡出旧轨迹
  ctx.fillStyle = 'rgba(10, 10, 26, 0.02)';
  ctx.fillRect(0, 0, W, H);

  time += TIME_SPEED;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const angle = getAngle(p.x, p.y, time);

    // 保存旧位置
    const ox = p.x, oy = p.y;

    // 按流场方向前进一步
    p.x += Math.cos(angle) * STEP_SIZE;
    p.y += Math.sin(angle) * STEP_SIZE;
    p.life--;

    // 画线段
    const alpha = (p.life / p.maxLife) * 0.6;
    const hue = (p.hue + time * 100) % 360;
    ctx.strokeStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    // 边界或生命耗尽：重置
    if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || p.life <= 0) {
      particles[i] = createParticle();
    }
  }

  requestAnimationFrame(animate);
}

animate();
</script>
</body>
</html>
```

## 关键参数的视觉效果

**NOISE_SCALE（噪声缩放）**：
- `0.001`：流线非常平缓，像缓慢的大气流动
- `0.003`：中等细节，有漩涡但不杂乱
- `0.01`：密集的小漩涡，像湍流

**TIME_SPEED（时间演化）**：
- `0`：流场静止，粒子走固定路线
- `0.0005`：缓慢演化，流线不断变化
- `0.002`：快速变化，图案不断翻新

**PARTICLE_LIFE（粒子寿命）**：
- `30`：短线段，看起来像点
- `120`：中等流线
- `300`：长流线，图案更连贯但更新慢

## 艺术变体

1. **颜色映射**：粒子颜色按噪声值或速度变化，而非随机
2. **多层流场**：两个噪声场叠加，一个控制方向，一个控制速度
3. **交互流场**：鼠标位置影响流场（加一个吸引/排斥力）
4. **SVG 输出**：把粒子轨迹导出为 SVG 路径

## 流场 + 图像

流场可以和图像结合：用图像的亮度或色相来调制流场角度，让流线沿着图像的结构走。这在第 18 课会专门讲。

## 本课产出

2000 个粒子在 Perlin 噪声流场中流动，轨迹叠加形成不断演化的流线图案。粒子颜色随时间缓慢变化。
