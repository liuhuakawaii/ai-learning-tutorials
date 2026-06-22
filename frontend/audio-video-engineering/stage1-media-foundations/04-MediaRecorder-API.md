# 第四课：MediaRecorder API

## 场景引入

你想在 Web 应用中实现一个录音功能——用户点击按钮开始录制麦克风声音，录制完成后可以试听和下载。在 MediaRecorder API 出现之前，这需要依赖 Flash 插件或第三方库。现在，浏览器原生提供了 MediaRecorder API，配合 `getUserMedia` 获取媒体流，就能在纯前端实现录音、录屏等功能。

本课将系统学习 MediaRecorder API 的使用方法，掌握音频录制、视频录制、屏幕录制等核心能力。

## 学习目标

完成本课学习后，你将能够：

1. 使用 `getUserMedia` 获取用户的音频/视频流
2. 使用 `getDisplayMedia` 实现屏幕录制
3. 掌握 MediaRecorder 的创建、配置和事件处理
4. 实现录音和录屏功能
5. 理解录制选项（timeslice、码率等）的配置方法

## MediaStream：获取媒体流

### getUserMedia

`navigator.mediaDevices.getUserMedia()` 请求用户授权并获取音频/视频流。

```javascript
// 获取音频流（麦克风）
async function getAudioStream() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return stream;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      console.error('用户拒绝了麦克风权限');
    } else if (err.name === 'NotFoundError') {
      console.error('未找到麦克风设备');
    }
    throw err;
  }
}

// 获取视频流（摄像头）
async function getVideoStream() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      audio: true // 同时录制声音
    });
    return stream;
  } catch (err) {
    console.error('获取摄像头失败:', err.message);
    throw err;
  }
}

// 获取音频+视频流
async function getAVStream() {
  return await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: {
      echoCancellation: true,    // 回声消除
      noiseSuppression: true,    // 噪声抑制
      autoGainControl: true      // 自动增益
    }
  });
}
```

### getDisplayMedia

`navigator.mediaDevices.getDisplayMedia()` 用于屏幕录制，可以捕获整个屏幕、应用窗口或浏览器标签页。

```javascript
// 屏幕录制
async function getScreenStream() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',           // 显示鼠标光标
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: true // 部分浏览器支持系统音频
    });
    return stream;
  } catch (err) {
    console.error('屏幕录制被拒绝:', err.message);
    throw err;
  }
}

// 监听用户停止共享
function onStopSharing(stream, callback) {
  stream.getVideoTracks()[0].addEventListener('ended', () => {
    console.log('用户停止了屏幕共享');
    callback();
  });
}
```

### 媒体流的基本操作

```javascript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

// 获取所有轨道
const tracks = stream.getTracks();
console.log(`轨道数量: ${tracks.length}`);

// 获取音频轨道
const audioTracks = stream.getAudioTracks();
console.log(`音频轨道: ${audioTracks.length}`);
audioTracks.forEach(track => {
  console.log(`  音频: ${track.label}, 状态: ${track.readyState}`);
});

// 获取视频轨道
const videoTracks = stream.getVideoTracks();
videoTracks.forEach(track => {
  console.log(`  视频: ${track.label}, 设置:`, track.getSettings());
});

// 停止所有轨道（释放设备）
function stopStream(stream) {
  stream.getTracks().forEach(track => track.stop());
}

// 动态控制轨道
const videoTrack = stream.getVideoTracks()[0];
videoTrack.enabled = false; // 暂停视频（不释放设备）
videoTrack.enabled = true;  // 恢复视频
```

## MediaRecorder

### 基本用法

MediaRecorder 将 MediaStream 录制为可下载的媒体文件。

```javascript
async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // 创建 MediaRecorder 实例
  const recorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus'
  });

  // 存储录制的数据块
  const chunks = [];

  // 接收数据
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  // 录制停止时触发
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);

    // 创建下载链接
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    a.click();

    // 释放资源
    URL.revokeObjectURL(url);
    stream.getTracks().forEach(track => track.stop());
  };

  // 开始录制
  recorder.start();

  // 5 秒后停止
  setTimeout(() => {
    recorder.stop();
  }, 5000);
}
```

### MediaRecorder 状态

```javascript
const recorder = new MediaRecorder(stream);

console.log(recorder.state); // "inactive" | "recording" | "paused"

// 开始录制
recorder.start();          // state → "recording"
recorder.pause();          // state → "paused"
recorder.resume();         // state → "recording"
recorder.stop();           // state → "inactive"

// 监听状态变化
recorder.onstart = () => console.log('开始录制');
recorder.onpause = () => console.log('暂停录制');
recorder.onresume = () => console.log('恢复录制');
recorder.onstop = () => console.log('停止录制');
recorder.onerror = (e) => console.error('录制错误:', e.error);
```

### mimeType 配置

```javascript
// 检查浏览器支持的编码格式
function getSupportedMimeTypes() {
  const types = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8',
    'video/webm;codecs=vp9',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=hev1',
    'audio/webm;codecs=opus',
    'audio/webm;codecs=vorbis',
    'audio/mp4;codecs=mp4a',
    'audio/ogg;codecs=opus',
    'audio/wav'
  ];

  return types.filter(type => MediaRecorder.isTypeSupported(type));
}

console.log('支持的格式:', getSupportedMimeTypes());
```

## 录音实现

### 完整的录音器

```html
<!DOCTYPE html>
<html>
<head>
  <title>录音器</title>
  <style>
    .recorder { max-width: 500px; margin: 50px auto; text-align: center; }
    button { padding: 12px 24px; margin: 5px; font-size: 16px; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.recording { background: #ff4444; color: white; }
    #status { margin: 15px 0; font-size: 18px; }
    #timer { font-size: 24px; font-family: monospace; margin: 10px 0; }
    #playback { width: 100%; margin-top: 15px; }
    #downloadLink { display: none; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="recorder">
    <h2>在线录音器</h2>
    <div id="status">就绪</div>
    <div id="timer">00:00</div>
    <div>
      <button id="recordBtn">开始录音</button>
      <button id="pauseBtn" disabled>暂停</button>
      <button id="stopBtn" disabled>停止</button>
    </div>
    <audio id="playback" controls style="display:none;"></audio>
    <a id="downloadLink" download="recording.webm">下载录音</a>
  </div>

  <script>
    let mediaRecorder = null;
    let chunks = [];
    let stream = null;
    let timerInterval = null;
    let startTime = 0;

    const recordBtn = document.getElementById('recordBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const status = document.getElementById('status');
    const timer = document.getElementById('timer');
    const playback = document.getElementById('playback');
    const downloadLink = document.getElementById('downloadLink');

    function updateTimer() {
      const elapsed = Date.now() - startTime;
      const seconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      timer.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    recordBtn.addEventListener('click', async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

        mediaRecorder = new MediaRecorder(stream, { mimeType });
        chunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);

          playback.src = url;
          playback.style.display = 'block';
          downloadLink.href = url;
          downloadLink.style.display = 'inline';

          stream.getTracks().forEach(track => track.stop());
          clearInterval(timerInterval);
        };

        mediaRecorder.start(100); // 每 100ms 产出一次数据
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);

        recordBtn.disabled = true;
        recordBtn.classList.add('recording');
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        status.textContent = '录音中...';
      } catch (err) {
        status.textContent = `错误: ${err.message}`;
      }
    });

    pauseBtn.addEventListener('click', () => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        pauseBtn.textContent = '继续';
        status.textContent = '已暂停';
        clearInterval(timerInterval);
      } else {
        mediaRecorder.resume();
        pauseBtn.textContent = '暂停';
        status.textContent = '录音中...';
        startTime += Date.now() - startTime; // 简化处理
        timerInterval = setInterval(updateTimer, 1000);
      }
    });

    stopBtn.addEventListener('click', () => {
      mediaRecorder.stop();
      recordBtn.disabled = false;
      recordBtn.classList.remove('recording');
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      pauseBtn.textContent = '暂停';
      status.textContent = '录制完成';
    });
  </script>
</body>
</html>
```

## 录屏实现

```html
<!DOCTYPE html>
<html>
<head>
  <title>屏幕录制</title>
  <style>
    .container { max-width: 700px; margin: 50px auto; text-align: center; }
    button { padding: 12px 24px; margin: 5px; font-size: 16px; cursor: pointer; }
    button:disabled { opacity: 0.5; }
    #preview { width: 100%; max-height: 400px; margin: 15px 0; background: #000; }
    #status { margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h2>屏幕录制</h2>
    <video id="preview" autoplay muted playsinline></video>
    <div id="status">就绪</div>
    <button id="startBtn">开始录制</button>
    <button id="stopBtn" disabled>停止录制</button>
  </div>

  <script>
    let mediaRecorder = null;
    let chunks = [];

    const preview = document.getElementById('preview');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const status = document.getElementById('status');

    startBtn.addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true
        });

        preview.srcObject = stream;

        // 监听用户停止共享
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        });

        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : 'video/webm';

        mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 5000000 // 5Mbps
        });
        chunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `screen-recording-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);

          preview.srcObject = null;
          stream.getTracks().forEach(track => track.stop());
          status.textContent = '录制完成，文件已下载';
          startBtn.disabled = false;
          stopBtn.disabled = true;
        };

        mediaRecorder.start(1000);
        startBtn.disabled = true;
        stopBtn.disabled = false;
        status.textContent = '屏幕录制中...';
      } catch (err) {
        status.textContent = `错误: ${err.message}`;
      }
    });

    stopBtn.addEventListener('click', () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    });
  </script>
</body>
</html>
```

## 录制选项

### timeslice 参数

`start(timeslice)` 中的 timeslice 参数（毫秒）控制数据产出频率：

```javascript
// 每秒产出一次数据（适合实时上传）
recorder.start(1000);

// 每 500ms 产出一次（平衡延迟和效率）
recorder.start(500);

// 不指定 timeslice，录制结束后一次性产出所有数据
recorder.start();
```

```javascript
// 实时上传录音数据的模式
const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

recorder.ondataavailable = async (event) => {
  if (event.data.size > 0) {
    // 实时上传到服务器
    const formData = new FormData();
    formData.append('audio', event.data);
    await fetch('/api/upload-audio', { method: 'POST', body: formData });
  }
};

// 每 2 秒上传一次
recorder.start(2000);
```

### 码率配置

```javascript
// 指定视频码率
const videoRecorder = new MediaRecorder(stream, {
  mimeType: 'video/webm;codecs=vp9',
  videoBitsPerSecond: 2500000  // 2.5 Mbps
});

// 指定音频码率
const audioRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 128000   // 128 kbps
});
```

### 常见录制参数组合

```javascript
const recordingPresets = {
  // 高质量录屏
  highQuality: {
    mimeType: 'video/webm;codecs=vp9,opus',
    videoBitsPerSecond: 8000000,  // 8 Mbps
    audioBitsPerSecond: 256000    // 256 kbps
  },
  // 标准质量
  standard: {
    mimeType: 'video/webm;codecs=vp8,opus',
    videoBitsPerSecond: 2500000,  // 2.5 Mbps
    audioBitsPerSecond: 128000    // 128 kbps
  },
  // 低带宽
  lowBandwidth: {
    mimeType: 'video/webm;codecs=vp8',
    videoBitsPerSecond: 800000,   // 800 kbps
    audioBitsPerSecond: 64000     // 64 kbps
  },
  // 纯语音录音
  voiceOnly: {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 32000     // 32 kbps
  }
};
```

## 常见误区

### 误区一：所有浏览器都支持相同的编码格式

不同浏览器支持的 MediaRecorder mimeType 差异很大。Chrome 支持 WebM（VP8/VP9 + Opus/Vorbis），Safari 从较新版本才开始支持 MediaRecorder，且偏好 MP4 格式。在使用前必须用 `MediaRecorder.isTypeSupported()` 检测。

### 误区二：停止录制后不需要处理流

MediaRecorder 停止后，媒体流仍然保持活跃，摄像头指示灯可能仍然亮着。必须手动停止所有轨道以释放设备：

```javascript
recorder.onstop = () => {
  // 释放设备
  stream.getTracks().forEach(track => track.stop());
};
```

### 误区三：dataavailable 事件只在停止时触发

默认情况下，`dataavailable` 事件在调用 `stop()` 时触发一次。但如果使用了 `start(timeslice)`，则会按指定间隔持续触发。两种模式适用于不同场景：一次性下载用默认模式，实时上传用 timeslice 模式。

### 误区四：getUserMedia 的权限是一次性的

浏览器通常会记住用户的权限选择。首次授权后，后续调用不会再次弹窗。但用户可以随时在浏览器设置中撤销权限，代码必须处理权限被撤销的情况。

## 工程建议

### 始终检测格式支持

```javascript
function createRecorder(stream, preferredType) {
  // 按优先级尝试格式
  const types = [
    preferredType,
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'audio/webm;codecs=opus',
    'audio/webm'
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return new MediaRecorder(stream, { mimeType: type });
    }
  }

  throw new Error('浏览器不支持任何可用的录制格式');
}
```

### 错误处理最佳实践

```javascript
async function safeStartRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // ... 录制逻辑
  } catch (err) {
    switch (err.name) {
      case 'NotAllowedError':
        // 用户拒绝了权限
        alert('请允许麦克风权限后重试');
        break;
      case 'NotFoundError':
        // 没有找到麦克风
        alert('未检测到麦克风设备');
        break;
      case 'NotReadableError':
        // 设备被其他应用占用
        alert('麦克风被其他应用占用，请关闭后重试');
        break;
      default:
        alert(`录制失败: ${err.message}`);
    }
  }
}
```

## 小结

本课学习了 MediaRecorder API 的核心知识：

- **MediaStream**：通过 `getUserMedia` 和 `getDisplayMedia` 获取媒体流
- **MediaRecorder**：将媒体流录制为文件，支持 start/stop/pause/resume
- **录音实现**：纯音频录制，支持试听和下载
- **录屏实现**：屏幕捕获 + 录制，支持系统音频
- **录制选项**：timeslice 实现实时数据产出，码率控制文件大小

这些 API 使浏览器具备了完整的媒体录制能力，无需任何插件。

## 练习

### 练习一：屏幕录制器

实现一个屏幕录制器，要求：
- 使用 `getDisplayMedia` 获取屏幕流
- 支持开始/停止录制
- 录制完成后自动下载为 WebM 文件
- 处理用户主动停止共享的情况

### 练习二：摄像头录制器

实现一个摄像头录制器，要求：
- 同时录制摄像头画面和麦克风声音
- 实时预览摄像头画面
- 支持暂停/恢复录制
- 录制完成后显示预览和下载按钮

---

## 参考答案

### 练习一

**思路**：使用 `getDisplayMedia` 获取屏幕流，配合 MediaRecorder 录制，监听视频轨道的 `ended` 事件处理用户停止共享。

**答案**：

```html
<!DOCTYPE html>
<html>
<head>
  <title>屏幕录制器</title>
  <style>
    .container { max-width: 700px; margin: 50px auto; text-align: center; }
    button { padding: 12px 24px; margin: 5px; font-size: 16px; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.active { background: #ff4444; color: white; }
    #preview { width: 100%; max-height: 400px; margin: 15px 0; background: #000; }
    #status { margin: 10px 0; font-size: 16px; }
    #timer { font-size: 20px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <h2>屏幕录制器</h2>
    <video id="preview" autoplay muted playsinline></video>
    <div id="timer">00:00</div>
    <div id="status">就绪</div>
    <button id="startBtn">开始录制</button>
    <button id="stopBtn" disabled>停止录制</button>
  </div>

  <script>
    let mediaRecorder = null;
    let chunks = [];
    let stream = null;
    let timerInterval = null;
    let startTime = 0;

    const preview = document.getElementById('preview');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const status = document.getElementById('status');
    const timer = document.getElementById('timer');

    function updateTimer() {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      timer.textContent = `${m}:${s}`;
    }

    function resetUI() {
      startBtn.disabled = false;
      startBtn.classList.remove('active');
      stopBtn.disabled = true;
      clearInterval(timerInterval);
      timer.textContent = '00:00';
    }

    startBtn.addEventListener('click', async () => {
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true
        });

        preview.srcObject = stream;

        // 用户点击浏览器的"停止共享"按钮
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        });

        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : 'video/webm';

        mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 5000000
        });
        chunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `screen-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);

          preview.srcObject = null;
          stream.getTracks().forEach(track => track.stop());
          status.textContent = '录制完成，文件已下载';
          resetUI();
        };

        mediaRecorder.start(1000);
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);

        startBtn.disabled = true;
        startBtn.classList.add('active');
        stopBtn.disabled = false;
        status.textContent = '屏幕录制中...';
      } catch (err) {
        status.textContent = `错误: ${err.message}`;
        resetUI();
      }
    });

    stopBtn.addEventListener('click', () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    });
  </script>
</body>
</html>
```

**要点**：
- 必须监听视频轨道的 `ended` 事件，因为用户可以通过浏览器 UI 停止共享
- 停止录制时要释放所有轨道（`track.stop()`）
- 使用 `autoplay muted playsinline` 确保预览视频自动播放

### 练习二

**思路**：使用 `getUserMedia` 同时获取音频和视频流，实现暂停/恢复功能。

**答案**：

```html
<!DOCTYPE html>
<html>
<head>
  <title>摄像头录制器</title>
  <style>
    .container { max-width: 700px; margin: 50px auto; text-align: center; }
    video { width: 100%; max-height: 400px; margin: 10px 0; }
    button { padding: 10px 20px; margin: 5px; font-size: 15px; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #status { margin: 10px 0; }
    #playback { display: none; }
    #downloadBtn { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h2>摄像头录制器</h2>
    <video id="preview" autoplay muted playsinline></video>
    <video id="playback" controls></video>
    <div id="status">就绪</div>
    <div>
      <button id="startBtn">开始录制</button>
      <button id="pauseBtn" disabled>暂停</button>
      <button id="stopBtn" disabled>停止</button>
      <button id="downloadBtn">下载</button>
    </div>
  </div>

  <script>
    let mediaRecorder = null;
    let chunks = [];
    let stream = null;
    let lastBlob = null;

    const preview = document.getElementById('preview');
    const playback = document.getElementById('playback');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const status = document.getElementById('status');

    startBtn.addEventListener('click', async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });

        preview.srcObject = stream;
        preview.style.display = 'block';
        playback.style.display = 'none';
        downloadBtn.style.display = 'none';

        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : 'video/webm';

        mediaRecorder = new MediaRecorder(stream, { mimeType });
        chunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          lastBlob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(lastBlob);

          preview.style.display = 'none';
          playback.src = url;
          playback.style.display = 'block';
          downloadBtn.style.display = 'inline-block';

          stream.getTracks().forEach(track => track.stop());
          status.textContent = '录制完成';
        };

        mediaRecorder.start(500);
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        status.textContent = '录制中...';
      } catch (err) {
        status.textContent = `错误: ${err.message}`;
      }
    });

    pauseBtn.addEventListener('click', () => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        pauseBtn.textContent = '继续';
        status.textContent = '已暂停';
      } else if (mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        pauseBtn.textContent = '暂停';
        status.textContent = '录制中...';
      }
    });

    stopBtn.addEventListener('click', () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        pauseBtn.textContent = '暂停';
      }
    });

    downloadBtn.addEventListener('click', () => {
      if (lastBlob) {
        const url = URL.createObjectURL(lastBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webcam-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  </script>
</body>
</html>
```

**要点**：
- 摄像头预览需要 `autoplay muted playsinline` 属性
- 暂停后恢复录制，MediaRecorder 会继续向同一个文件追加数据
- 音频约束中的 `echoCancellation` 和 `noiseSuppression` 能显著提升录音质量
