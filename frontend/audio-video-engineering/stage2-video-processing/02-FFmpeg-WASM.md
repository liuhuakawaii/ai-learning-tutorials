# 第二课：FFmpeg.wasm 浏览器端视频处理

## 场景引入

用户上传了一段 5 分钟的视频，只需要截取其中 30 秒的片段。传统方案是把整个文件上传到服务器，服务器用 FFmpeg 处理后再返回。但这段视频可能有 500MB，上传就要等好几分钟。

如果能在浏览器本地完成裁剪，用户体验会好得多——不需要上传、不需要等待服务器响应、不需要额外的服务器成本。FFmpeg.wasm 就是实现这一目标的关键技术。

## 学习目标

1. 理解 FFmpeg.wasm 的架构原理（Emscripten、WASM、SharedArrayBuffer）
2. 掌握 FFmpeg.wasm 的环境搭建和基础配置
3. 学会使用 FFmpeg.wasm 实现视频裁剪、拼接、格式转换等常见操作
4. 了解性能优化策略：Web Workers、流式 I/O
5. 理解 SharedArrayBuffer 的安全限制及解决方案

---

## FFmpeg.wasm 架构

FFmpeg.wasm 是 FFmpeg 的 WebAssembly 版本，通过 Emscripten 将 C/C++ 编写的 FFmpeg 编译为 WASM，使其能在浏览器中运行。

### 技术栈

```
┌─────────────────────────────────────────┐
│              JavaScript API              │
│         (@ffmpeg/ffmpeg npm 包)          │
├─────────────────────────────────────────┤
│           Web Worker 线程                │
│    (隔离计算密集型任务，不阻塞主线程)       │
├─────────────────────────────────────────┤
│          FFmpeg.wasm 核心                 │
│    (Emscripten 编译的 C/C++ 代码)         │
├─────────────────────────────────────────┤
│        SharedArrayBuffer                 │
│   (线程间共享内存，实现高效数据传输)        │
├─────────────────────────────────────────┤
│         WebAssembly Runtime              │
│        (浏览器 WASM 引擎)                │
└─────────────────────────────────────────┘
```

### SharedArrayBuffer 的安全要求

SharedArrayBuffer 是多线程 WebAssembly 的基础，但出于安全考虑（防范 Spectre 攻击），浏览器要求页面必须设置特定 HTTP 头才能使用：

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

---

## 环境搭建

### 安装依赖

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util
```

### 配置 CORS 头

在开发服务器和生产服务器中添加必要的响应头。

```javascript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
});
```

```javascript
// next.config.js (Next.js)
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};
```

### 基础初始化

```javascript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

async function initFFmpeg() {
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  console.log('FFmpeg.wasm 加载完成');
}

// 监听日志输出
ffmpeg.on('log', ({ message }) => {
  console.log('[FFmpeg]', message);
});

// 监听进度
ffmpeg.on('progress', ({ progress, time }) => {
  console.log(`进度: ${(progress * 100).toFixed(1)}%, 处理时间: ${time}μs`);
});
```

---

## 基础操作

### 视频裁剪

```javascript
async function trimVideo(inputFile, startTime, duration) {
  await initFFmpeg();

  // 将文件写入 WASM 虚拟文件系统
  await ffmpeg.writeFile('input.mp4', await fetchFile(inputFile));

  // 执行裁剪命令
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-ss', startTime,      // 起始时间，如 '00:01:30'
    '-t', duration,         // 持续时长，如 '30'（秒）
    '-c', 'copy',           // 直接复制流，不重新编码（极快）
    'output.mp4'
  ]);

  // 读取输出文件
  const data = await ffmpeg.readFile('output.mp4');
  const blob = new Blob([data.buffer], { type: 'video/mp4' });

  // 清理虚拟文件系统
  await ffmpeg.deleteFile('input.mp4');
  await ffmpeg.deleteFile('output.mp4');

  return blob;
}

// 使用示例
const fileInput = document.getElementById('video-input');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const trimmedBlob = await trimVideo(file, '00:01:30', '30');

  const url = URL.createObjectURL(trimmedBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trimmed.mp4';
  a.click();
});
```

### 视频拼接

```javascript
async function concatVideos(videoFiles) {
  await initFFmpeg();

  // 写入所有输入文件
  for (let i = 0; i < videoFiles.length; i++) {
    const data = await fetchFile(videoFiles[i]);
    await ffmpeg.writeFile(`input${i}.mp4`, data);
  }

  // 创建 concat 列表文件
  const listContent = videoFiles
    .map((_, i) => `file 'input${i}.mp4'`)
    .join('\n');
  await ffmpeg.writeFile('filelist.txt', listContent);

  // 执行拼接
  await ffmpeg.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'filelist.txt',
    '-c', 'copy',
    'output.mp4'
  ]);

  const data = await ffmpeg.readFile('output.mp4');
  const blob = new Blob([data.buffer], { type: 'video/mp4' });

  // 清理
  for (let i = 0; i < videoFiles.length; i++) {
    await ffmpeg.deleteFile(`input${i}.mp4`);
  }
  await ffmpeg.deleteFile('filelist.txt');
  await ffmpeg.deleteFile('output.mp4');

  return blob;
}
```

### 格式转换

```javascript
async function convertFormat(inputFile, targetFormat) {
  await initFFmpeg();

  await ffmpeg.writeFile('input', await fetchFile(inputFile));

  const outputName = `output.${targetFormat}`;
  const args = ['-i', 'input'];

  switch (targetFormat) {
    case 'webm':
      args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0');
      break;
    case 'gif':
      args.push('-vf', 'fps=10,scale=480:-1:flags=lanczos');
      break;
    case 'mp3':
      args.push('-vn', '-ab', '192k');
      break;
    default:
      args.push('-c', 'copy');
  }

  args.push(outputName);
  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName);
  const mimeTypes = {
    webm: 'video/webm',
    gif: 'image/gif',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
  };

  return new Blob([data.buffer], { type: mimeTypes[targetFormat] });
}
```

---

## 进阶操作

### 添加水印

```javascript
async function addWatermark(videoFile, watermarkText) {
  await initFFmpeg();

  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

  // 使用 drawtext 滤镜添加文字水印
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-vf', `drawtext=text='${watermarkText}':fontsize=24:fontcolor=white:x=10:y=10:alpha=0.5`,
    '-c:a', 'copy',
    'output.mp4'
  ]);

  const data = await ffmpeg.readFile('output.mp4');
  return new Blob([data.buffer], { type: 'video/mp4' });
}
```

### 提取音频

```javascript
async function extractAudio(videoFile) {
  await initFFmpeg();

  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-vn',               // 不包含视频
    '-acodec', 'libmp3lame',
    '-ab', '192k',
    'output.mp3'
  ]);

  const data = await ffmpeg.readFile('output.mp3');
  return new Blob([data.buffer], { type: 'audio/mpeg' });
}
```

### 生成缩略图

```javascript
async function generateThumbnail(videoFile, time = '00:00:01') {
  await initFFmpeg();

  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-ss', time,
    '-vframes', '1',
    '-vf', 'scale=320:-1',
    'thumbnail.jpg'
  ]);

  const data = await ffmpeg.readFile('thumbnail.jpg');
  return new Blob([data.buffer], { type: 'image/jpeg' });
}
```

---

## 性能优化

### 使用 Web Worker 隔离

将 FFmpeg 操作放在独立的 Worker 线程中，避免阻塞主线程的 UI 渲染。

```javascript
// worker.js
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    self.postMessage({ type: 'ready' });
  }

  if (type === 'trim') {
    const { fileBuffer, startTime, duration } = payload;

    ffmpeg.on('progress', ({ progress }) => {
      self.postMessage({ type: 'progress', progress });
    });

    await ffmpeg.writeFile('input.mp4', new Uint8Array(fileBuffer));
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-ss', startTime,
      '-t', duration,
      '-c', 'copy',
      'output.mp4'
    ]);

    const data = await ffmpeg.readFile('output.mp4');
    self.postMessage({ type: 'done', buffer: data.buffer }, [data.buffer]);
  }
};
```

```javascript
// 主线程
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

worker.onmessage = (e) => {
  const { type, progress, buffer } = e.data;

  if (type === 'progress') {
    updateProgressBar(progress);
  }

  if (type === 'done') {
    const blob = new Blob([buffer], { type: 'video/mp4' });
    downloadBlob(blob, 'trimmed.mp4');
  }
};

function trimInWorker(file, startTime, duration) {
  file.arrayBuffer().then((buffer) => {
    worker.postMessage({
      type: 'trim',
      payload: { buffer, startTime, duration }
    }, [buffer]);
  });
}
```

### 流式 I/O 处理大文件

```javascript
async function processLargeFile(file, onProgress) {
  await initFFmpeg();

  // 分块读取大文件
  const chunkSize = 10 * 1024 * 1024; // 10MB
  const totalChunks = Math.ceil(file.size / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    const buffer = await chunk.arrayBuffer();

    if (i === 0) {
      await ffmpeg.writeFile('input.mp4', new Uint8Array(buffer));
    } else {
      // 追加写入（需要自定义实现）
      const existing = await ffmpeg.readFile('input.mp4');
      const combined = new Uint8Array(existing.length + buffer.byteLength);
      combined.set(existing);
      combined.set(new Uint8Array(buffer), existing.length);
      await ffmpeg.writeFile('input.mp4', combined);
    }

    onProgress((i + 1) / totalChunks);
  }
}
```

---

## 常见误区

### 误区一：SharedArrayBuffer 只需要前端配置

SharedArrayBuffer 需要服务器返回特定的 HTTP 头，本地开发时容易遗漏。如果页面没有设置 `Cross-Origin-Opener-Policy` 和 `Cross-Origin-Embedder-Policy`，FFmpeg.wasm 会降级为单线程模式，性能大幅下降。

### 误区二：FFmpeg.wasm 可以替代服务端 FFmpeg

FFmpeg.wasm 的性能约为原生 FFmpeg 的 5-10 倍慢（受限于 WASM 运行时），且受限于浏览器内存（通常 2-4GB）。对于大文件或复杂处理，服务端 FFmpeg 仍然是更好的选择。

### 误区三：`-c copy` 可以处理所有裁剪需求

`-c copy` 是流复制模式，裁剪速度极快但精度有限——它只能在关键帧处精确切割。如果需要帧精度裁剪，必须重新编码（去掉 `-c copy`），速度会慢很多。

---

## 工程建议

1. **显示进度条**：FFmpeg 处理可能耗时较长，务必通过 `progress` 事件向用户展示进度
2. **合理使用 `-c copy`**：如果裁剪精度要求不高，使用流复制模式可以秒级完成
3. **处理内存限制**：大文件分块处理，处理完成后及时清理虚拟文件系统
4. **降级方案**：检测 SharedArrayBuffer 是否可用，不可用时提示用户或降级到服务端处理
5. **缓存 WASM 核心**：将 `ffmpeg-core.wasm` 缓存到 IndexedDB，避免重复下载

---

## 小结

本课讲解了 FFmpeg.wasm 的架构、配置和常用操作：

- FFmpeg.wasm 通过 Emscripten 将 FFmpeg 编译为 WASM，在浏览器中运行
- SharedArrayBuffer 是多线程的基础，需要特定 HTTP 头支持
- 基础操作包括裁剪、拼接、格式转换，进阶操作包括水印、音频提取、缩略图
- 性能优化关键：Web Worker 隔离、流式 I/O、缓存 WASM 核心

---

## 练习

### 练习一：构建视频裁剪器

实现一个浏览器端视频裁剪工具，要求：
- 支持用户上传视频文件
- 提供起始时间和结束时间输入
- 显示裁剪进度
- 支持预览裁剪结果
- 提供下载功能

### 练习二：构建音频提取器

实现一个从视频中提取音频的工具，要求：
- 支持选择输出格式（MP3、WAV）
- 支持选择音频质量（128k、192k、320k）
- 显示处理进度
- 处理完成后自动播放提取的音频

---

## 参考答案

### 练习一

**思路**：组合使用 HTML5 Video 元素获取时间信息，FFmpeg.wasm 执行裁剪，Blob URL 实现预览和下载。

**答案**：

```javascript
class VideoTrimmer {
  constructor(container) {
    this.container = container;
    this.ffmpeg = new FFmpeg();
    this.ready = false;
    this.init();
  }

  async init() {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    this.ready = true;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <input type="file" id="file-input" accept="video/*" />
      <video id="preview" controls style="max-width:100%"></video>
      <div>
        <label>起始时间: <input type="text" id="start-time" value="00:00:00" /></label>
        <label>结束时间: <input type="text" id="end-time" value="00:00:10" /></label>
      </div>
      <div id="progress-bar" style="width:100%;height:4px;background:#eee">
        <div id="progress" style="width:0%;height:100%;background:#4caf50"></div>
      </div>
      <button id="trim-btn" ${this.ready ? '' : 'disabled'}>裁剪</button>
      <a id="download-link" style="display:none">下载结果</a>
    `;

    const fileInput = this.container.querySelector('#file-input');
    const preview = this.container.querySelector('#preview');
    const trimBtn = this.container.querySelector('#trim-btn');

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      preview.src = URL.createObjectURL(file);
    });

    trimBtn.addEventListener('click', () => this.trim());
  }

  async trim() {
    const fileInput = this.container.querySelector('#file-input');
    const startTime = this.container.querySelector('#start-time').value;
    const endTime = this.container.querySelector('#end-time').value;
    const progressEl = this.container.querySelector('#progress');
    const downloadLink = this.container.querySelector('#download-link');

    const file = fileInput.files[0];
    if (!file) return alert('请先选择视频文件');

    const duration = this.timeToSeconds(endTime) - this.timeToSeconds(startTime);

    await this.ffmpeg.writeFile('input.mp4', await fetchFile(file));

    this.ffmpeg.on('progress', ({ progress }) => {
      progressEl.style.width = `${(progress * 100).toFixed(1)}%`;
    });

    await this.ffmpeg.exec([
      '-i', 'input.mp4',
      '-ss', startTime,
      '-t', String(duration),
      '-c', 'copy',
      'output.mp4'
    ]);

    const data = await this.ffmpeg.readFile('output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });

    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = 'trimmed.mp4';
    downloadLink.style.display = 'inline';

    await this.ffmpeg.deleteFile('input.mp4');
    await this.ffmpeg.deleteFile('output.mp4');
  }

  timeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number);
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
}
```

**要点**：
- 使用 `-c copy` 实现快速裁剪（流复制，不重新编码）
- 通过 `progress` 事件更新进度条
- 处理完成后清理虚拟文件系统，避免内存泄漏

### 练习二

**思路**：使用 FFmpeg 的 `-vn` 参数去除视频流，配合 `-acodec` 和 `-ab` 参数控制音频编码和质量。

**答案**：

```javascript
class AudioExtractor {
  constructor() {
    this.ffmpeg = new FFmpeg();
    this.init();
  }

  async init() {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  }

  async extract(videoFile, format = 'mp3', quality = '192k') {
    await this.ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

    const outputName = `output.${format}`;
    const args = ['-i', 'input.mp4', '-vn'];

    if (format === 'mp3') {
      args.push('-acodec', 'libmp3lame', '-ab', quality);
    } else if (format === 'wav') {
      args.push('-acodec', 'pcm_s16le');
    }

    args.push(outputName);
    await this.ffmpeg.exec(args);

    const data = await this.ffmpeg.readFile(outputName);
    const mime = format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    const blob = new Blob([data.buffer], { type: mime });

    await this.ffmpeg.deleteFile('input.mp4');
    await this.ffmpeg.deleteFile(outputName);

    return blob;
  }
}

// 使用示例
const extractor = new AudioExtractor();
const fileInput = document.getElementById('video-input');
const resultAudio = document.getElementById('result-audio');

document.getElementById('extract-btn').addEventListener('click', async () => {
  const file = fileInput.files[0];
  const format = document.getElementById('format-select').value;
  const quality = document.getElementById('quality-select').value;

  const audioBlob = await extractor.extract(file, format, quality);
  resultAudio.src = URL.createObjectURL(audioBlob);
  resultAudio.play();
});
```

**要点**：
- MP3 使用 `libmp3lame` 编码器，WAV 使用 PCM 无损编码
- `-ab` 参数控制音频码率，值越大音质越好但文件越大
- WAV 格式不需要码率参数，因为是无损的
