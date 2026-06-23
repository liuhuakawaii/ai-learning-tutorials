# 图像像素化

## 这节课解决什么问题

把一张照片变成生成艺术作品，核心思路是"用算法重新解释像素"。不是简单的缩小分辨率，而是用 Voronoi 区域、马赛克块、抖动点阵等方式重新表达图像的信息。

## 三种像素化方法

1. **Voronoi 像素**：用图像亮度控制 Voronoi 种子的密度——亮区密、暗区疏
2. **马赛克**：把图像分成块，每块取平均色
3. **抖动（Dithering）**：用黑白点的密度模拟灰度层次

```html
<!DOCTYPE html>
<html>
<body>
<input type="file" id="file" accept="image/*" style="color:#ccc;font:14px monospace;">
<span style="color:#666;font:14px monospace;">选择一张图片开始</span>
<canvas id="c" width="900" height="600"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

ctx.fillStyle = '#0a0a1a';
ctx.fillRect(0, 0, W, H);

let imageData = null;
let imgW = 0, imgH = 0;

document.getElementById('file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    // 缩放到 canvas 的一半宽度
    imgW = Math.floor(W / 3);
    imgH = Math.floor(img.height / img.width * imgW);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imgW;
    tempCanvas.height = imgH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0, imgW, imgH);
    imageData = tempCtx.getImageData(0, 0, imgW, imgH);
    process();
  };
  img.src = URL.createObjectURL(file);
});

function getPixel(x, y) {
  const i = (y * imgW + x) * 4;
  return [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]];
}

function getBrightness(x, y) {
  const [r, g, b] = getPixel(x, y);
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
}

function process() {
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);

  // ---- 方法一：Voronoi 像素 ----
  voronoiPixelate(10, 10, imgW, imgH);

  // ---- 方法二：马赛克 ----
  mosaic(imgW + 20, 10, imgW, imgH);

  // ---- 方法三：抖动 ----
  dither((imgW + 20) * 2, 10, imgW, imgH);
}

// Voronoi 像素化：用亮度控制种子密度
function voronoiPixelate(ox, oy, w, h) {
  const seeds = [];
  // 用泊松盘采样（简化版：逐格候选）
  const cellSize = 6;
  for (let gy = 0; gy < h; gy += cellSize) {
    for (let gx = 0; gx < w; gx += cellSize) {
      const bx = Math.floor(gx + cellSize / 2);
      const by = Math.floor(gy + cellSize / 2);
      if (bx >= w || by >= h) continue;
      const brightness = getBrightness(bx, by);
      // 亮度越高，越可能放种子（亮区更密）
      if (Math.random() < brightness * 0.6 + 0.2) {
        const jitterX = gx + Math.random() * cellSize;
        const jitterY = gy + Math.random() * cellSize;
        seeds.push({ x: jitterX, y: jitterY, color: getPixel(bx, by) });
      }
    }
  }

  // 逐像素找最近种子
  const imgData = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let minD = Infinity, closest = seeds[0];
      for (const s of seeds) {
        const d = (s.x - x) ** 2 + (s.y - y) ** 2;
        if (d < minD) { minD = d; closest = s; }
      }
      const i = (y * w + x) * 4;
      imgData.data[i] = closest.color[0];
      imgData.data[i + 1] = closest.color[1];
      imgData.data[i + 2] = closest.color[2];
      imgData.data[i + 3] = 255;
    }
  }
  ctx.putImageData(imgData, ox, oy);

  // 标签
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText('Voronoi 像素', ox, oy + h + 15);
}

// 马赛克
function mosaic(ox, oy, w, h) {
  const blockSize = 8;
  const imgData = ctx.createImageData(w, h);

  for (let by = 0; by < h; by += blockSize) {
    for (let bx = 0; bx < w; bx += blockSize) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = 0; dy < blockSize && by + dy < h; dy++) {
        for (let dx = 0; dx < blockSize && bx + dx < w; dx++) {
          const [pr, pg, pb] = getPixel(bx + dx, by + dy);
          r += pr; g += pg; b += pb; count++;
        }
      }
      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);

      for (let dy = 0; dy < blockSize && by + dy < h; dy++) {
        for (let dx = 0; dx < blockSize && bx + dx < w; dx++) {
          const i = ((by + dy) * w + bx + dx) * 4;
          imgData.data[i] = r;
          imgData.data[i + 1] = g;
          imgData.data[i + 2] = b;
          imgData.data[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(imgData, ox, oy);
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText('马赛克', ox, oy + h + 15);
}

// Floyd-Steinberg 抖动
function dither(ox, oy, w, h) {
  const imgData = ctx.createImageData(w, h);
  // 先复制灰度值到浮点数组
  const gray = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      gray.push(getBrightness(x, y));
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const old = gray[idx];
      const newVal = old > 0.5 ? 1 : 0;
      const error = old - newVal;
      gray[idx] = newVal;

      // Floyd-Steinberg: 传播误差到右、下、左下、右下
      if (x + 1 < w) gray[idx + 1] += error * 7 / 16;
      if (y + 1 < h) gray[idx + w] += error * 5 / 16;
      if (x - 1 >= 0 && y + 1 < h) gray[idx + w - 1] += error * 3 / 16;
      if (x + 1 < w && y + 1 < h) gray[idx + w + 1] += error * 1 / 16;

      const c = Math.floor(newVal * 255);
      const i = idx * 4;
      imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = c;
      imgData.data[i + 3] = 255;
    }
  }
  ctx.putImageData(imgData, ox, oy);
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText('Floyd-Steinberg 抖动', ox, oy + h + 15);
}
</script>
</body>
</html>
```

## 用法

点击"选择文件"上传一张图片，三种像素化效果会自动并排显示。

## 进阶方向

- **Voronoi 像素 + 流场**：种子沿流场移动，像素化效果随时间变化
- **彩色抖动**：不只是黑白，用调色板做彩色抖动
- **实时摄像头**：用 `getUserMedia` 捕获摄像头画面，实时像素化
- **SVG 输出**：把 Voronoi 区域导出为 SVG 多边形

## 本课产出

上传图片后并排显示三种像素化效果：Voronoi 像素（密度随亮度变化）、马赛克（方块平均色）、Floyd-Steinberg 抖动（纯黑白点阵模拟灰度）。
