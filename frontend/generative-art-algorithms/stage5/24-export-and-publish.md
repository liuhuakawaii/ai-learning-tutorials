# 导出与发布

## 这节课解决什么问题

作品在浏览器里很好看，但怎么拿出来？这节课实现三种导出方式：静态图片（PNG）、矢量图（SVG）、动画录制（WebGL 帧序列）。同时介绍 NFT 元数据格式，以及如何在网页上展示生成艺术。

## 导出方案对比

| 格式 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| PNG | 静态作品、社交媒体 | 通用、像素精确 | 放大会模糊 |
| SVG | 打印品、矢量作品 | 无限缩放、体积小 | 不适合像素化效果 |
| 帧序列 | 视频、GIF | 可编辑 | 文件大 |
| WebGL | 3D、高性能 | GPU 加速 | 实现复杂 |

## 实现

```html
<!DOCTYPE html>
<html>
<body>
<div style="font:13px monospace;color:#ccc;padding:10px;">
  <button onclick="exportPNG()" style="padding:4px 12px;font:13px monospace;">导出 PNG</button>
  <button onclick="exportSVG()" style="margin-left:6px;padding:4px 12px;font:13px monospace;">导出 SVG</button>
  <button onclick="toggleRecord()" id="recBtn" style="margin-left:6px;padding:4px 12px;font:13px monospace;">录制动画</button>
  <span id="status" style="margin-left:10px;color:#666;">就绪</span>
</div>
<canvas id="c" width="800" height="800"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ---- 生成作品 ----
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
function fbm(x, y) {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < 4; i++) {
    v += a * noise2D(x * f, y * f);
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}

// 用于 SVG 导出的路径收集
let svgPaths = [];

function drawFrame(time) {
  ctx.fillStyle = '#050a18';
  ctx.fillRect(0, 0, W, H);
  svgPaths = [];

  const cx = W / 2, cy = H / 2;

  for (let i = 0; i < 1500; i++) {
    let x = Math.random() * W;
    let y = Math.random() * H;

    ctx.beginPath();
    const pathPoints = [[x, y]];

    for (let step = 0; step < 60; step++) {
      const n = fbm(x * 0.004, y * 0.004 + time * 0.1);
      const angle = n * Math.PI * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      x += Math.cos(angle) * 2;
      y += Math.sin(angle) * 2;
      pathPoints.push([x, y]);
      ctx.lineTo(x, y);
      if (x < 0 || x > W || y < 0 || y > H) break;
    }

    ctx.moveTo(pathPoints[0][0], pathPoints[0][1]);
    for (let j = 1; j < pathPoints.length; j++) {
      ctx.lineTo(pathPoints[j][0], pathPoints[j][1]);
    }

    const hue = 200 + (i * 137.5 % 60);
    const alpha = 0.15 + Math.random() * 0.2;
    ctx.strokeStyle = `hsla(${hue}, 65%, 55%, ${alpha})`;
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // 收集 SVG 路径
    if (pathPoints.length > 1) {
      const d = `M${pathPoints[0][0].toFixed(1)},${pathPoints[0][1].toFixed(1)} ` +
        pathPoints.slice(1).map(p => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      svgPaths.push({ d, hue, alpha });
    }
  }
}

// ---- 导出 PNG ----
function exportPNG() {
  // 用 toDataURL 获取数据
  const dataURL = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `generative-art-${Date.now()}.png`;
  link.href = dataURL;
  link.click();
  document.getElementById('status').textContent = 'PNG 已下载';
}

// ---- 导出 SVG ----
function exportSVG() {
  // 先确保有路径数据
  drawFrame(performance.now() / 1000);

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#050a18"/>
  <g fill="none" stroke-width="0.7">`;

  for (const p of svgPaths) {
    svg += `\n    <path d="${p.d}" stroke="hsla(${p.hue},65%,55%,${p.alpha})" />`;
  }

  svg += `\n  </g>\n</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `generative-art-${Date.now()}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
  document.getElementById('status').textContent = `SVG 已下载 (${svgPaths.length} 条路径)`;
}

// ---- 动画录制 ----
let recorder = null;
let chunks = [];
let recording = false;

function toggleRecord() {
  if (!recording) {
    // 开始录制
    const stream = canvas.captureStream(30);
    recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `generative-art-${Date.now()}.webm`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      document.getElementById('status').textContent = '视频已下载';
    };
    recorder.start();
    recording = true;
    document.getElementById('recBtn').textContent = '停止录制';
    document.getElementById('status').textContent = '录制中...';
  } else {
    recorder.stop();
    recording = false;
    document.getElementById('recBtn').textContent = '录制动画';
  }
}

// ---- 动画 ----
let animFrame = 0;
function animate() {
  drawFrame(animFrame / 100);
  animFrame++;
  requestAnimationFrame(animate);
}

animate();
</script>
</body>
</html>
```

## NFT 元数据格式

如果要把生成艺术发布为 NFT，标准的元数据 JSON：

```json
{
  "name": "潮汐 #42",
  "description": "由流场算法生成的抽象艺术",
  "image": "ipfs://QmXxx...",
  "attributes": [
    { "trait_type": "Seed", "value": "42" },
    { "trait_type": "Noise Scale", "value": "0.003" },
    { "trait_type": "Symmetry", "value": "4" },
    { "trait_type": "Particle Count", "value": "3000" }
  ],
  "properties": {
    "algorithm": "flow-field",
    "version": "1.0",
    "generator": "generative-art-tutorial"
  }
}
```

`attributes` 里的参数可以被 NFT 平台解析，用于筛选和分类。

## 在线展示

- **fxhash**：Tezos 链上的生成艺术平台，上传 HTML 就行
- **Art Blocks**：以太坊上的生成艺术平台，代码存储在链上
- **OpenSea**：通用 NFT 平台，需要自己托管渲染页面
- **自建网站**：最灵活，用 `canvas.toDataURL()` 做预览图

## 本课产出

一个可导出的生成艺术作品：PNG（像素图）、SVG（矢量图）、WebM（动画录制）。底部显示导出状态和路径数量。
