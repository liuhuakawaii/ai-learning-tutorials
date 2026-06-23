# L-System

## 这节课解决什么问题

L-System（Lindenmayer System）是一套字符串重写规则：把一个字符替换成一组字符，反复替换后，把字符串翻译成画图指令。最开始用来模拟植物生长，但它的递归本质让它能画出几乎所有分形图形。

## 核心机制

```
初始字符串：  F
替换规则：    F → F[+F]F[-F]F
第 0 代：     F
第 1 代：     F[+F]F[-F]F
第 2 代：     F[+F]F[-F]F[+F[+F]F[-F]F]F[+F]F[-F]F[-F[+F]F[-F]F]F[+F]F[-F]F
```

每一代都比上一代长得多。然后用"海龟绘图"把字符串翻译成线条：
- `F`：前进
- `+`：右转
- `-`：左转
- `[`：保存当前位置（入栈）
- `]`：回到保存的位置（出栈）

栈机制让树枝能分叉后再回来，这正是树的结构。

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="900" height="700"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

ctx.fillStyle = '#0a0a1a';
ctx.fillRect(0, 0, W, H);

// L-System 引擎
function generate(axiom, rules, iterations) {
  let current = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const ch of current) {
      next += rules[ch] || ch;
    }
    current = next;
  }
  return current;
}

// 海龟绘图
function draw(str, startX, startY, angle, stepLen, angleDeg, colorFn) {
  const stack = [];
  let x = startX, y = startY;
  let dir = angle;
  let depth = 0;

  ctx.lineWidth = 1;

  for (const ch of str) {
    switch (ch) {
      case 'F':
        const nx = x + Math.cos(dir) * stepLen;
        const ny = y + Math.sin(dir) * stepLen;
        ctx.strokeStyle = colorFn ? colorFn(depth) : 'rgba(78, 205, 196, 0.8)';
        ctx.lineWidth = Math.max(0.5, 3 - depth * 0.3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        x = nx;
        y = ny;
        break;
      case '+':
        dir += angleDeg * Math.PI / 180;
        break;
      case '-':
        dir -= angleDeg * Math.PI / 180;
        break;
      case '[':
        stack.push({ x, y, dir, depth });
        depth++;
        break;
      case ']':
        const state = stack.pop();
        x = state.x;
        y = state.y;
        dir = state.dir;
        depth = state.depth;
        break;
    }
  }
}

// ---- 定义几种经典 L-System ----

// 1. 分形树
const tree = {
  axiom: 'F',
  rules: { 'F': 'FF+[+F-F-F]-[-F+F+F]' },
  iterations: 4,
  angle: 22.5,
  step: 6,
  startX: 150, startY: 650, startAngle: -Math.PI / 2,
  color: (d) => `hsl(${120 + d * 15}, ${60 - d * 5}%, ${45 + d * 5}%)`
};

// 2. 蕨类植物
const fern = {
  axiom: 'X',
  rules: { 'X': 'F+[[X]-X]-F[-FX]+X', 'F': 'FF' },
  iterations: 6,
  angle: 25,
  step: 4,
  startX: 450, startY: 680, startAngle: -Math.PI / 2,
  color: (d) => `hsl(${140 + d * 10}, ${65}%, ${35 + d * 8}%)`
};

// 3. Koch 雪花
const koch = {
  axiom: 'F--F--F',
  rules: { 'F': 'F+F--F+F' },
  iterations: 4,
  angle: 60,
  step: 3,
  startX: 720, startY: 500, startAngle: 0,
  color: (d) => `hsl(${200 + d * 20}, 70%, ${60 + d * 5}%)`
};

// 4. Sierpinski 三角（用 L-System 表示）
const sierpinski = {
  axiom: 'F-G-G',
  rules: { 'F': 'F-G+F+G-F', 'G': 'GG' },
  iterations: 6,
  angle: 120,
  step: 4,
  startX: 150, startY: 300, startAngle: 0,
  color: (d) => `hsl(${280 + d * 15}, 65%, ${55 + d * 5}%)`
};

// 5. Hilbert 曲线
const hilbert = {
  axiom: 'A',
  rules: { 'A': '-BF+AFA+FB-', 'B': '+AF-BFB-FA+' },
  iterations: 6,
  angle: 90,
  step: 5,
  startX: 450, startY: 350, startAngle: 0,
  color: (d) => `hsl(${40 + d * 30}, 80%, ${55}%)`
};

// ---- 绘制 ----
const systems = [tree, fern, koch, sierpinski, hilbert];
const labels = ['分形树', '蕨类植物', 'Koch 雪花', 'Sierpinski 三角', 'Hilbert 曲线'];

systems.forEach((sys, i) => {
  const str = generate(sys.axiom, sys.rules, sys.iterations);
  draw(str, sys.startX, sys.startY, sys.startAngle, sys.step, sys.angle, sys.color);
});

// 标签
ctx.fillStyle = '#888';
ctx.font = '12px monospace';
labels.forEach((label, i) => {
  const x = [40, 350, 650, 40, 380][i];
  const y = [200, 200, 200, 420, 180][i];
  ctx.fillText(label, x, y);
});
</script>
</body>
</html>
```

## 调参感受

- **迭代次数**是最关键的参数。4 代和 6 代的细节差距巨大。超过 7 代字符串会暴增到百万字符，浏览器可能卡死
- **角度**决定枝条展开方式。树用 22-25°，雪花用 60°，Hilbert 用 90°
- **步长**随迭代次数缩小。迭代越多，步长越小，否则画不下

## 为什么 L-System 适合生成植物

真实植物的生长是"尖端分裂"——茎尖不断分出新芽，新芽再分新芽。L-System 的字符串重写恰好模拟了这个过程。`[` 和 `]` 对应"长出新枝"和"回到主干"。加上随机性（角度和步长的微小扰动），就能生成非常逼真的植物。

## 本课产出

五种经典 L-System 图形：分形树、蕨类植物、Koch 雪花、Sierpinski 三角、Hilbert 曲线。每种都有不同的字符串规则和绘图参数。
