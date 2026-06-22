# 第三课：Canvas 与视频帧

## 场景引入

你正在开发一个在线教育平台，产品经理提出了两个需求：

1. 学生在观看教学视频时，可以随时截取当前画面保存为笔记图片
2. 视频播放器支持实时滤镜——比如灰度模式、反色、模糊效果

这两个需求的核心都是**对视频帧的像素级操作**。HTML5 Canvas 提供了 `drawImage()` 方法，可以将视频的当前帧绘制到画布上，然后通过 `getImageData()` 获取像素数据进行任意处理。

本课将深入 Canvas 的视频帧操作能力，掌握视频截图、实时滤镜、像素级处理等实用技能。

## 学习目标

完成本课学习后，你将能够：

1. 使用 Canvas 的 `drawImage()` 将视频帧绘制到画布
2. 理解像素数据结构，使用 `getImageData` 进行像素级操作
3. 实现视频截图功能，将当前帧导出为图片
4. 实现实时视频滤镜效果
5. 合理使用 `requestAnimationFrame` 控制绘制频率

## Video + Canvas 基础

### drawImage 绘制视频帧

Canvas 的 `drawImage()` 方法可以接受 `<video>` 元素作为图像源，绘制视频的当前帧。

```html
<!DOCTYPE html>
<html>
<head>
  <title>视频帧绘制</title>
  <style>
    video, canvas { max-width: 100%; }
    canvas { display: block; margin-top: 10px; }
  </style>
</head>
<body>
  <video id="video" controls crossorigin="anonymous">
    <source src="https://example.com/video.mp4" type="video/mp4">
  </video>
  <canvas id="canvas"></canvas>

  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    video.addEventListener('loadedmetadata', () => {
      // 设置 canvas 尺寸与视频一致
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    });

    // 方法一：点击时截取当前帧
    canvas.addEventListener('click', () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    });

    // 方法二：实时绘制（跟随视频播放）
    function renderLoop() {
      if (!video.paused && !video.ended) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      requestAnimationFrame(renderLoop);
    }
    video.addEventListener('play', renderLoop);
  </script>
</body>
</html>
```

### drawImage 的三种调用方式

```javascript
const ctx = canvas.getContext('2d');

// 方式一：原始尺寸，从 (0,0) 开始
ctx.drawImage(video, 0, 0);

// 方式二：指定目标尺寸（缩放）
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

// 方式三：裁剪 + 缩放（从源裁剪指定区域，绘制到目标位置）
ctx.drawImage(
  video,
  // 源矩形（从视频帧中裁剪）
  100, 100,    // 源起点 (sx, sy)
  400, 300,    // 源尺寸 (sw, sh)
  // 目标矩形（绘制到 canvas 的位置）
  50, 50,      // 目标起点 (dx, dy)
  200, 150     // 目标尺寸 (dw, dh)
);
```

## 像素操作

### getImageData 与 putImageData

Canvas 提供了直接操作像素的能力。`getImageData()` 返回一个 `ImageData` 对象，包含像素数据的扁平数组。

```javascript
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// 绘制视频帧
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

// 获取像素数据
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const data = imageData.data; // Uint8ClampedArray

// 像素数据结构：每 4 个元素代表一个像素 [R, G, B, A]
// 第 (x, y) 个像素的索引 = (y * width + x) * 4

const width = canvas.width;
const height = canvas.height;

// 遍历每个像素
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    const r = data[index];       // 红色通道
    const g = data[index + 1];   // 绿色通道
    const b = data[index + 2];   // 蓝色通道
    const a = data[index + 3];   // 透明度

    // 在这里处理像素...
  }
}

// 将修改后的像素数据写回 canvas
ctx.putImageData(imageData, 0, 0);
```

### RGBA 像素模型

每个像素由 4 个分量组成，每个分量取值范围为 0-255：

```javascript
// 颜色操作示例
function setPixel(data, x, y, width, r, g, b, a = 255) {
  const index = (y * width + x) * 4;
  data[index] = r;
  data[index + 1] = g;
  data[index + 2] = b;
  data[index + 3] = a;
}

function getPixel(data, x, y, width) {
  const index = (y * width + x) * 4;
  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2],
    a: data[index + 3]
  };
}
```

## 视频截图

实现一个完整的视频截图功能，将当前帧导出为可下载的图片：

```html
<!DOCTYPE html>
<html>
<head>
  <title>视频截图工具</title>
  <style>
    .container { max-width: 800px; margin: 0 auto; }
    video { width: 100%; }
    canvas { display: none; }
    .actions { margin: 10px 0; }
    button { padding: 8px 16px; margin-right: 10px; cursor: pointer; }
    .preview { margin-top: 10px; }
    .preview img { max-width: 200px; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <div class="container">
    <video id="video" controls>
      <source src="https://example.com/video.mp4" type="video/mp4">
    </video>
    <canvas id="canvas"></canvas>
    <div class="actions">
      <button id="captureBtn">截图</button>
      <button id="downloadBtn" disabled>下载图片</button>
    </div>
    <div class="preview" id="preview"></div>
  </div>

  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const captureBtn = document.getElementById('captureBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const preview = document.getElementById('preview');

    let capturedBlob = null;

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    });

    captureBtn.addEventListener('click', () => {
      // 将视频当前帧绘制到 canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 转换为 Blob
      canvas.toBlob((blob) => {
        capturedBlob = blob;
        const url = URL.createObjectURL(blob);

        // 显示预览
        const img = document.createElement('img');
        img.src = url;
        preview.innerHTML = '';
        preview.appendChild(img);

        downloadBtn.disabled = false;
      }, 'image/png');
    });

    downloadBtn.addEventListener('click', () => {
      if (!capturedBlob) return;

      const url = URL.createObjectURL(capturedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `screenshot-${Date.now()}.png`;
      a.click();

      // 释放 URL
      URL.revokeObjectURL(url);
    });
  </script>
</body>
</html>
```

## 实时滤镜

### 灰度滤镜

将彩色图像转换为灰度的经典算法——加权平均法：

```javascript
function applyGrayscale(imageData) {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // 加权平均：人眼对绿色最敏感，蓝色最不敏感
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;       // R
    data[i + 1] = gray;   // G
    data[i + 2] = gray;   // B
    // Alpha 保持不变
  }

  return imageData;
}
```

### 反色滤镜

```javascript
function applyInvert(imageData) {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];       // R
    data[i + 1] = 255 - data[i + 1]; // G
    data[i + 2] = 255 - data[i + 2]; // B
  }

  return imageData;
}
```

### 亮度调整

```javascript
function applyBrightness(imageData, factor) {
  // factor: -255 到 +255
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] + factor));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + factor));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + factor));
  }

  return imageData;
}
```

### 卷积模糊

使用 3×3 卷积核实现简单的均值模糊：

```javascript
function applyBlur(imageData) {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  // 3×3 均值卷积核
  const kernel = [
    1/9, 1/9, 1/9,
    1/9, 1/9, 1/9,
    1/9, 1/9, 1/9
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB 三个通道
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        const idx = (y * width + x) * 4 + c;
        output[idx] = sum;
      }
      output[(y * width + x) * 4 + 3] = data[(y * width + x) * 4 + 3]; // Alpha
    }
  }

  return new ImageData(output, width, height);
}
```

### 组合滤镜的实时应用

```html
<!DOCTYPE html>
<html>
<head>
  <title>实时视频滤镜</title>
  <style>
    .container { max-width: 800px; margin: 0 auto; }
    video, canvas { width: 49%; }
    .controls { margin: 10px 0; }
    select, button { padding: 8px; margin-right: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <video id="video" controls>
      <source src="https://example.com/video.mp4" type="video/mp4">
    </video>
    <canvas id="canvas"></canvas>
    <div class="controls">
      <select id="filterSelect">
        <option value="none">无滤镜</option>
        <option value="grayscale">灰度</option>
        <option value="invert">反色</option>
        <option value="blur">模糊</option>
      </select>
      <button id="playBtn">播放</button>
    </div>
  </div>

  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const filterSelect = document.getElementById('filterSelect');
    const playBtn = document.getElementById('playBtn');

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    });

    playBtn.addEventListener('click', async () => {
      video.play();
    });

    function applyGrayscale(data) {
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
        data[i] = data[i+1] = data[i+2] = gray;
      }
    }

    function applyInvert(data) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];
        data[i+1] = 255 - data[i+1];
        data[i+2] = 255 - data[i+2];
      }
    }

    function render() {
      if (!video.paused && !video.ended) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const filter = filterSelect.value;
        if (filter !== 'none') {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          switch (filter) {
            case 'grayscale': applyGrayscale(data); break;
            case 'invert': applyInvert(data); break;
          }

          ctx.putImageData(imageData, 0, 0);
        }
      }
      requestAnimationFrame(render);
    }

    video.addEventListener('play', render);
  </script>
</body>
</html>
```

## 性能考量

### 逐像素处理的性能瓶颈

对 1920×1080 的视频帧进行逐像素处理，每帧需要处理约 200 万个像素（800 万次数组访问）。在 30fps 下，每秒需要处理 6000 万次操作，这对主线程是很大的负担。

```javascript
// 性能测试：逐像素操作的耗时
const canvas = document.createElement('canvas');
canvas.width = 1920;
canvas.height = 1080;
const ctx = canvas.getContext('2d');

// 模拟一帧数据
ctx.fillRect(0, 0, 1920, 1080);

const start = performance.now();
const imageData = ctx.getImageData(0, 0, 1920, 1080);
const data = imageData.data;

for (let i = 0; i < data.length; i += 4) {
  const gray = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
  data[i] = data[i+1] = data[i+2] = gray;
}

ctx.putImageData(imageData, 0, 0);
console.log(`耗时: ${performance.now() - start} ms`);
// 通常在 10-30ms 之间，勉强能在 30fps 下运行
```

### 优化策略

**降低处理分辨率**：将视频缩小处理后再放大显示。

```javascript
// 使用较小的 canvas 进行处理
const processCanvas = document.createElement('canvas');
processCanvas.width = 640;
processCanvas.height = 360;
const processCtx = processCanvas.getContext('2d');

function renderOptimized() {
  // 将视频缩小绘制到处理 canvas
  processCtx.drawImage(video, 0, 0, 640, 360);

  // 在小尺寸上做像素处理
  const imageData = processCtx.getImageData(0, 0, 640, 360);
  applyGrayscale(imageData.data);
  processCtx.putImageData(imageData, 0, 0);

  // 将处理结果放大绘制到显示 canvas
  ctx.drawImage(processCanvas, 0, 0, canvas.width, canvas.height);

  requestAnimationFrame(renderOptimized);
}
```

**控制处理帧率**：不必每帧都处理。

```javascript
let lastProcessTime = 0;
const PROCESS_INTERVAL = 1000 / 15; // 15fps 处理，30fps 显示

function renderThrottled(timestamp) {
  if (timestamp - lastProcessTime >= PROCESS_INTERVAL) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyGrayscale(imageData.data);
    ctx.putImageData(imageData, 0, 0);

    lastProcessTime = timestamp;
  }
  requestAnimationFrame(renderThrottled);
}
```

### OffscreenCanvas

对于重度处理任务，可以使用 OffscreenCanvas 将计算移到 Web Worker 中：

```javascript
// 主线程
const canvas = document.getElementById('canvas');
const offscreen = canvas.transferControlToOffscreen();

const worker = new Worker('filter-worker.js');
worker.postMessage({ canvas: offscreen }, [offscreen]);

// filter-worker.js
self.onmessage = function(e) {
  const canvas = e.data.canvas;
  const ctx = canvas.getContext('2d');

  // 在 Worker 中进行像素处理，不阻塞主线程
  function processFrame(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
      data[i] = data[i+1] = data[i+2] = gray;
    }
    return imageData;
  }

  // 接收视频帧数据进行处理
  self.onmessage = function(e) {
    if (e.data.imageData) {
      const processed = processFrame(e.data.imageData);
      ctx.putImageData(processed, 0, 0);
    }
  };
};
```

## 常见误区

### 误区一：跨域视频可以直接操作像素

当视频来自不同的域时，即使设置了 `crossorigin="anonymous"`，如果服务器没有返回正确的 CORS 头，`getImageData()` 会抛出安全错误。Canvas 被"污染"后，无法读取像素数据。

```javascript
// 正确做法：确保视频服务器返回 CORS 头
// Access-Control-Allow-Origin: *
const video = document.createElement('video');
video.crossOrigin = 'anonymous'; // 必须在设置 src 之前
video.src = 'https://cdn.example.com/video.mp4';
```

### 误区二：视频播放时每一帧都能被 drawImage 捕获

`drawImage(video, ...)` 只能捕获已经解码完成的帧。在视频跳转（seek）后，可能需要等待一小段时间才能获取到正确的帧。监听视频的 `seeked` 事件更可靠。

```javascript
video.currentTime = 30; // 跳转到 30 秒
video.addEventListener('seeked', () => {
  // 此时 drawImage 能获取到 30 秒处的帧
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
});
```

### 误区三：getImageData/putImageData 很快

这两个方法涉及大量数据的内存拷贝，对大尺寸 canvas 来说开销不小。尽量减少调用次数，如果只需要处理局部区域，可以只获取该区域的像素数据。

```javascript
// 不好：获取整个画布的像素
const allPixels = ctx.getImageData(0, 0, 1920, 1080);

// 更好：只获取需要处理的区域
const region = ctx.getImageData(100, 100, 400, 300);
```

## 工程建议

### 合理使用 CSS 滤镜

如果不需要像素级操作，优先使用 CSS 滤镜，它们由 GPU 加速，性能远优于 JavaScript 像素处理：

```javascript
// CSS 滤镜：由 GPU 加速，性能优秀
video.style.filter = 'grayscale(100%)';
video.style.filter = 'brightness(1.2) contrast(1.1)';
video.style.filter = 'blur(5px)';

// JavaScript 像素处理：仅在 CSS 无法实现时使用
```

### requestAnimationFrame 的正确使用

```javascript
// 正确：在视频播放时启动循环，在暂停时停止
let animationId = null;

function startRender() {
  function loop() {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    animationId = requestAnimationFrame(loop);
  }
  loop();
}

function stopRender() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

video.addEventListener('play', startRender);
video.addEventListener('pause', stopRender);
video.addEventListener('ended', stopRender);
```

## 小结

本课学习了 Canvas 与视频帧操作的核心技术：

- **drawImage**：将视频帧绘制到 Canvas，支持裁剪和缩放
- **像素操作**：通过 `getImageData` 获取像素数组，进行逐像素处理
- **视频截图**：将当前帧导出为 PNG/JPEG 图片
- **实时滤镜**：灰度、反色、模糊等效果的实现
- **性能优化**：降低分辨率、控制帧率、使用 OffscreenCanvas

这些技术是视频编辑器、特效处理、图像识别等高级应用的基础。

## 练习

### 练习一：视频截图工具

实现一个视频截图工具，要求：
- 支持截取视频当前帧
- 截图时添加时间水印（显示截图时间）
- 支持下载为 PNG 格式
- 显示截图预览列表

### 练习二：灰度滤镜

实现一个实时灰度滤镜，要求：
- 视频播放时实时应用灰度效果
- 提供一个滑块控制灰度程度（0% = 原色，100% = 完全灰度）
- 显示处理前后的 FPS 对比

---

## 参考答案

### 练习一

**思路**：在 drawImage 之后，使用 `fillText` 在 canvas 上绘制时间戳水印，然后用 `toBlob` 导出。

**答案**：

```html
<!DOCTYPE html>
<html>
<head>
  <title>视频截图工具</title>
  <style>
    .container { max-width: 800px; margin: 0 auto; }
    video { width: 100%; }
    canvas { display: none; }
    .actions { margin: 10px 0; }
    button { padding: 8px 16px; margin-right: 10px; cursor: pointer; }
    .previews { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
    .preview-item { position: relative; }
    .preview-item img { width: 150px; border: 1px solid #ccc; cursor: pointer; }
    .preview-item .time { position: absolute; bottom: 2px; left: 2px;
      background: rgba(0,0,0,0.7); color: #fff; font-size: 10px; padding: 2px 4px; }
  </style>
</head>
<body>
  <div class="container">
    <video id="video" controls>
      <source src="https://example.com/video.mp4" type="video/mp4">
    </video>
    <canvas id="canvas"></canvas>
    <div class="actions">
      <button id="captureBtn">截图</button>
    </div>
    <div class="previews" id="previews"></div>
  </div>

  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const previews = document.getElementById('previews');

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    });

    document.getElementById('captureBtn').addEventListener('click', () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 添加时间水印
      const timeStr = new Date().toLocaleTimeString();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(10, canvas.height - 40, 200, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '16px Arial';
      ctx.fillText(`截图时间: ${timeStr}`, 15, canvas.height - 18);

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.innerHTML = `
          <img src="${url}" />
          <span class="time">${timeStr}</span>
        `;
        item.querySelector('img').addEventListener('click', () => {
          const a = document.createElement('a');
          a.href = url;
          a.download = `screenshot-${Date.now()}.png`;
          a.click();
        });
        previews.prepend(item);
      }, 'image/png');
    });
  </script>
</body>
</html>
```

**要点**：
- `crossorigin` 属性必须在设置 `src` 之前设置
- 使用 `fillRect` 半透明背景让水印文字更清晰
- 使用 `URL.createObjectURL` 创建预览 URL，记得在不需要时调用 `revokeObjectURL` 释放内存

### 练习二

**思路**：用滑块控制灰度程度，在像素处理时混合原始颜色和灰度值。

**答案**：

```html
<!DOCTYPE html>
<html>
<head>
  <title>实时灰度滤镜</title>
  <style>
    .container { max-width: 800px; margin: 0 auto; }
    video { width: 49%; }
    canvas { width: 49%; }
    .controls { margin: 10px 0; }
    input[type="range"] { width: 300px; }
    #fps { margin-left: 20px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <video id="video" controls>
      <source src="https://example.com/video.mp4" type="video/mp4">
    </video>
    <canvas id="canvas"></canvas>
    <div class="controls">
      <label>灰度程度: <span id="value">0</span>%</label>
      <input type="range" id="grayscale" min="0" max="100" value="0">
      <span id="fps">FPS: --</span>
    </div>
  </div>

  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const slider = document.getElementById('grayscale');
    const valueDisplay = document.getElementById('value');
    const fpsDisplay = document.getElementById('fps');

    let frameCount = 0;
    let lastFpsTime = performance.now();

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    });

    slider.addEventListener('input', () => {
      valueDisplay.textContent = slider.value;
    });

    video.addEventListener('play', render);

    function render() {
      if (video.paused || video.ended) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const intensity = slider.value / 100;
      if (intensity > 0) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
          data[i] = data[i] * (1 - intensity) + gray * intensity;
          data[i+1] = data[i+1] * (1 - intensity) + gray * intensity;
          data[i+2] = data[i+2] * (1 - intensity) + gray * intensity;
        }

        ctx.putImageData(imageData, 0, 0);
      }

      // FPS 计算
      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        fpsDisplay.textContent = `FPS: ${frameCount}`;
        frameCount = 0;
        lastFpsTime = now;
      }

      requestAnimationFrame(render);
    }
  </script>
</body>
</html>
```

**要点**：
- 灰度程度用线性插值（lerp）实现：`result = original * (1 - t) + gray * t`
- FPS 计算使用 1 秒窗口统计帧数
- 注意 `getImageData` 的性能开销，高分辨率视频可能需要降低处理分辨率
