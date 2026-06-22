/**
 * 音频录制器组件
 *
 * 使用 Web Audio API 和 MediaRecorder 实现：
 * - 麦克风音频采集
 * - 实时音量可视化（波形 + 频谱）
 * - 录音控制（开始/暂停/停止）
 * - 录音回放与下载
 */
export class AudioRecorder {
  constructor(container) {
    this.container = container;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.chunks = [];
    this.isRecording = false;
    this.isPaused = false;
    this.recordings = [];
    this.animationId = null;

    this.render();
    this.bindEvents();
  }

  /**
   * 渲染 UI
   */
  render() {
    this.container.innerHTML = `
      <div class="card">
        <h3>麦克风录制</h3>
        <p style="color: #888; margin-bottom: 16px;">
          基于 Web Audio API 的音频采集，支持实时波形和频谱可视化
        </p>

        <!-- 可视化画布 -->
        <div style="display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 280px;">
            <p style="font-size: 12px; color: #888; margin-bottom: 4px;">波形图（时域）</p>
            <canvas id="waveform-canvas" width="400" height="120"
              style="width: 100%; background: #111; border-radius: 8px; border: 1px solid #333;"></canvas>
          </div>
          <div style="flex: 1; min-width: 280px;">
            <p style="font-size: 12px; color: #888; margin-bottom: 4px;">频谱图（频域）</p>
            <canvas id="frequency-canvas" width="400" height="120"
              style="width: 100%; background: #111; border-radius: 8px; border: 1px solid #333;"></canvas>
          </div>
        </div>

        <!-- 音量指示器 -->
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="font-size: 13px; color: #888;">音量</span>
          <div style="flex: 1; height: 8px; background: #222; border-radius: 4px; overflow: hidden;">
            <div id="volume-meter" style="height: 100%; width: 0%; background: linear-gradient(90deg, #2ed573, #ffa502, #ff4757);
              border-radius: 4px; transition: width 0.05s;"></div>
          </div>
          <span id="volume-db" style="font-size: 12px; color: #888; min-width: 50px;">-∞ dB</span>
        </div>

        <!-- 控制按钮 -->
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="btn-start-recording"
            style="background: #ff4757; border: none; color: #fff; padding: 12px 32px;
            border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600;">
            ⏺ 开始录制
          </button>
          <button id="btn-pause-recording" disabled
            style="background: #333; border: none; color: #888; padding: 12px 24px;
            border-radius: 8px; cursor: pointer; font-size: 16px;">
            ⏸ 暂停
          </button>
          <button id="btn-stop-recording" disabled
            style="background: #333; border: none; color: #888; padding: 12px 24px;
            border-radius: 8px; cursor: pointer; font-size: 16px;">
            ⏹ 停止
          </button>
        </div>

        <p id="recording-status" style="text-align: center; margin-top: 12px; color: #888; font-size: 14px;"></p>
      </div>

      <!-- 录音列表 -->
      <div class="card" style="margin-top: 16px;">
        <h3>录音记录</h3>
        <div id="recordings-list" style="margin-top: 12px;">
          <p style="color: #666;">暂无录音</p>
        </div>
      </div>
    `;
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    this.container.querySelector('#btn-start-recording').addEventListener('click', () => this.startRecording());
    this.container.querySelector('#btn-pause-recording').addEventListener('click', () => this.pauseRecording());
    this.container.querySelector('#btn-stop-recording').addEventListener('click', () => this.stopRecording());
  }

  /**
   * 初始化音频上下文和分析器
   */
  async initAudioContext() {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
  }

  /**
   * 开始录制
   */
  async startRecording() {
    try {
      await this.initAudioContext();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      // 连接音频分析节点
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);

      // 创建 MediaRecorder
      const options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        delete options.mimeType; // 降级
      }

      this.mediaRecorder = new MediaRecorder(stream, options);
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
        this.addRecording(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start(100); // 每 100ms 收集一次数据
      this.isRecording = true;
      this.isPaused = false;

      // 更新 UI
      this.updateButtonStates();
      this.container.querySelector('#recording-status').textContent = '🔴 录制中...';
      this.container.querySelector('#recording-status').style.color = '#ff4757';

      // 开始可视化
      this.startVisualization();

    } catch (err) {
      console.error('录音启动失败:', err);
      this.container.querySelector('#recording-status').textContent =
        `❌ 无法访问麦克风: ${err.message}`;
    }
  }

  /**
   * 暂停/恢复录制
   */
  pauseRecording() {
    if (!this.mediaRecorder || !this.isRecording) return;

    if (this.isPaused) {
      this.mediaRecorder.resume();
      this.isPaused = false;
      this.container.querySelector('#recording-status').textContent = '🔴 录制中...';
      this.container.querySelector('#btn-pause-recording').textContent = '⏸ 暂停';
    } else {
      this.mediaRecorder.pause();
      this.isPaused = true;
      this.container.querySelector('#recording-status').textContent = '⏸ 已暂停';
      this.container.querySelector('#btn-pause-recording').textContent = '▶ 继续';
    }
  }

  /**
   * 停止录制
   */
  stopRecording() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;

    this.mediaRecorder.stop();
    this.isRecording = false;
    this.isPaused = false;

    // 停止可视化
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // 清空画布
    this.clearCanvases();

    // 更新 UI
    this.updateButtonStates();
    this.container.querySelector('#recording-status').textContent = '✅ 录制完成';
    this.container.querySelector('#recording-status').style.color = '#2ed573';
    this.container.querySelector('#volume-meter').style.width = '0%';
    this.container.querySelector('#volume-db').textContent = '-∞ dB';
  }

  /**
   * 开始实时可视化
   */
  startVisualization() {
    const waveformCanvas = this.container.querySelector('#waveform-canvas');
    const frequencyCanvas = this.container.querySelector('#frequency-canvas');
    const waveformCtx = waveformCanvas.getContext('2d');
    const frequencyCtx = frequencyCanvas.getContext('2d');
    const volumeMeter = this.container.querySelector('#volume-meter');
    const volumeDb = this.container.querySelector('#volume-db');

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const freqArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!this.isRecording) return;
      this.animationId = requestAnimationFrame(draw);

      // === 波形图 ===
      this.analyser.getByteTimeDomainData(dataArray);

      waveformCtx.fillStyle = '#111';
      waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

      waveformCtx.lineWidth = 2;
      waveformCtx.strokeStyle = '#ff4757';
      waveformCtx.beginPath();

      const sliceWidth = waveformCanvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * waveformCanvas.height) / 2;

        if (i === 0) {
          waveformCtx.moveTo(x, y);
        } else {
          waveformCtx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      waveformCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
      waveformCtx.stroke();

      // === 频谱图 ===
      this.analyser.getByteFrequencyData(freqArray);

      frequencyCtx.fillStyle = '#111';
      frequencyCtx.fillRect(0, 0, frequencyCanvas.width, frequencyCanvas.height);

      const barWidth = (frequencyCanvas.width / bufferLength) * 2.5;
      let barX = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (freqArray[i] / 255) * frequencyCanvas.height;

        const hue = (i / bufferLength) * 360;
        frequencyCtx.fillStyle = `hsl(${hue}, 80%, 50%)`;
        frequencyCtx.fillRect(barX, frequencyCanvas.height - barHeight, barWidth, barHeight);

        barX += barWidth + 1;
        if (barX > frequencyCanvas.width) break;
      }

      // === 音量指示器 ===
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);
      const percent = Math.min(100, rms * 300);
      const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

      volumeMeter.style.width = `${percent}%`;
      volumeDb.textContent = isFinite(db) ? `${db.toFixed(1)} dB` : '-∞ dB';
    };

    draw();
  }

  /**
   * 添加录音到列表
   */
  addRecording(blob) {
    const url = URL.createObjectURL(blob);
    const id = Date.now();
    const duration = this.getRecordingDuration();

    this.recordings.push({ id, blob, url, duration });

    this.renderRecordings();
  }

  /**
   * 渲染录音列表
   */
  renderRecordings() {
    const list = this.container.querySelector('#recordings-list');

    if (this.recordings.length === 0) {
      list.innerHTML = '<p style="color: #666;">暂无录音</p>';
      return;
    }

    list.innerHTML = this.recordings.map(rec => `
      <div style="display: flex; align-items: center; gap: 12px; padding: 12px;
        background: #222; border-radius: 8px; margin-bottom: 8px;">
        <span style="font-size: 20px;">🎤</span>
        <div style="flex: 1;">
          <p style="font-size: 14px;">录音 #${rec.id}</p>
          <p style="font-size: 12px; color: #888;">${rec.duration}</p>
        </div>
        <audio controls src="${rec.url}" style="height: 32px; max-width: 300px;"></audio>
        <a href="${rec.url}" download="recording_${rec.id}.webm"
          style="background: #333; color: #ccc; padding: 6px 12px; border-radius: 4px;
          text-decoration: none; font-size: 13px;">下载</a>
      </div>
    `).join('');
  }

  /**
   * 获取录音时长（简化）
   */
  getRecordingDuration() {
    return new Date().toLocaleTimeString('zh-CN');
  }

  /**
   * 清空画布
   */
  clearCanvases() {
    ['waveform-canvas', 'frequency-canvas'].forEach(id => {
      const canvas = this.container.querySelector(`#${id}`);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
  }

  /**
   * 更新按钮状态
   */
  updateButtonStates() {
    const btnStart = this.container.querySelector('#btn-start-recording');
    const btnPause = this.container.querySelector('#btn-pause-recording');
    const btnStop = this.container.querySelector('#btn-stop-recording');

    btnStart.disabled = this.isRecording;
    btnPause.disabled = !this.isRecording;
    btnStop.disabled = !this.isRecording;

    btnStart.style.background = this.isRecording ? '#333' : '#ff4757';
    btnStart.style.color = this.isRecording ? '#666' : '#fff';
    btnPause.style.background = this.isRecording ? '#ffa502' : '#333';
    btnPause.style.color = this.isRecording ? '#fff' : '#888';
    btnStop.style.background = this.isRecording ? '#ff4757' : '#333';
    btnStop.style.color = this.isRecording ? '#fff' : '#888';
  }
}
