/**
 * 自定义视频播放器组件
 *
 * 功能：
 * - 播放/暂停控制
 * - 进度条拖拽定位
 * - 音量调节
 * - 倍速播放
 * - 全屏切换
 * - 键盘快捷键
 */
export class VideoPlayer {
  constructor(container) {
    this.container = container;
    this.video = null;
    this.isPlaying = false;
    this.isMuted = false;
    this.isFullscreen = false;
    this.playbackRate = 1;

    this.render();
    this.bindEvents();
  }

  /**
   * 渲染播放器 UI
   */
  render() {
    this.container.innerHTML = `
      <div class="card">
        <div class="player-wrapper" style="position: relative; background: #000; border-radius: 8px; overflow: hidden;">
          <video id="main-video" style="width: 100%; display: block;" crossorigin="anonymous">
            您的浏览器不支持 video 标签
          </video>

          <!-- 播放器覆盖层 -->
          <div class="player-overlay" style="position: absolute; bottom: 0; left: 0; right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.8)); padding: 20px 16px 12px;
            transition: opacity 0.3s;">

            <!-- 进度条 -->
            <div class="progress-container" style="width: 100%; height: 4px; background: rgba(255,255,255,0.3);
              border-radius: 2px; cursor: pointer; margin-bottom: 12px; position: relative;">
              <div class="progress-played" style="height: 100%; background: #ff4757; border-radius: 2px;
                width: 0%; position: relative;">
                <div style="position: absolute; right: -6px; top: -4px; width: 12px; height: 12px;
                  background: #ff4757; border-radius: 50%; opacity: 0; transition: opacity 0.2s;"
                  class="progress-thumb"></div>
              </div>
              <div class="progress-buffer" style="position: absolute; top: 0; left: 0; height: 100%;
                background: rgba(255,255,255,0.2); border-radius: 2px; width: 0%;"></div>
            </div>

            <!-- 控制栏 -->
            <div style="display: flex; align-items: center; gap: 12px;">
              <!-- 播放/暂停 -->
              <button id="btn-play" style="background: none; border: none; color: #fff; font-size: 20px;
                cursor: pointer; padding: 4px;" title="播放/暂停">▶</button>

              <!-- 时间显示 -->
              <span id="time-display" style="font-size: 13px; color: #ccc; min-width: 100px;">
                00:00 / 00:00
              </span>

              <div style="flex: 1;"></div>

              <!-- 倍速 -->
              <button id="btn-speed" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
                color: #fff; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;"
                title="播放速度">1x</button>

              <!-- 音量 -->
              <div style="display: flex; align-items: center; gap: 6px;">
                <button id="btn-mute" style="background: none; border: none; color: #fff; font-size: 18px;
                  cursor: pointer; padding: 4px;" title="静音">🔊</button>
                <input type="range" id="volume-slider" min="0" max="1" step="0.05" value="1"
                  style="width: 80px; accent-color: #ff4757;">
              </div>

              <!-- 全屏 -->
              <button id="btn-fullscreen" style="background: none; border: none; color: #fff; font-size: 18px;
                cursor: pointer; padding: 4px;" title="全屏">⛶</button>
            </div>
          </div>

          <!-- 中央播放按钮 -->
          <div id="big-play-btn" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 64px; height: 64px; background: rgba(255,71,87,0.9); border-radius: 50%;
            display: flex; align-items: center; justify-content: center; cursor: pointer;
            font-size: 28px; color: #fff; transition: transform 0.2s;">▶</div>
        </div>

        <!-- 视频信息 -->
        <div style="margin-top: 16px;">
          <h3 id="video-title" style="font-size: 18px; margin-bottom: 8px;">选择一个视频开始播放</h3>
          <p id="video-desc" style="color: #888; font-size: 14px;">
            支持本地视频文件或网络视频流。使用下方控件或键盘快捷键控制播放。
          </p>
          <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
            <span style="background: #222; padding: 4px 10px; border-radius: 4px; font-size: 12px; color: #888;">
              空格: 播放/暂停
            </span>
            <span style="background: #222; padding: 4px 10px; border-radius: 4px; font-size: 12px; color: #888;">
              ←/→: 快退/快进 5s
            </span>
            <span style="background: #222; padding: 4px 10px; border-radius: 4px; font-size: 12px; color: #888;">
              ↑/↓: 音量增减
            </span>
            <span style="background: #222; padding: 4px 10px; border-radius: 4px; font-size: 12px; color: #888;">
              F: 全屏
            </span>
            <span style="background: #222; padding: 4px 10px; border-radius: 4px; font-size: 12px; color: #888;">
              M: 静音
            </span>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top: 16px;">
        <h3>演示视频</h3>
        <p style="color: #888; margin-bottom: 12px;">点击加载示例视频，或通过上传模块上传自己的视频</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="demo-btn" data-src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            style="background: #222; border: 1px solid #444; color: #ccc; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
            🐰 Big Buck Bunny
          </button>
          <button class="demo-btn" data-src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
            style="background: #222; border: 1px solid #444; color: #ccc; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
            🐘 Elephants Dream
          </button>
        </div>
      </div>
    `;

    this.video = this.container.querySelector('#main-video');
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    const video = this.video;
    const btnPlay = this.container.querySelector('#btn-play');
    const bigPlay = this.container.querySelector('#big-play-btn');
    const btnMute = this.container.querySelector('#btn-mute');
    const volumeSlider = this.container.querySelector('#volume-slider');
    const btnSpeed = this.container.querySelector('#btn-speed');
    const btnFullscreen = this.container.querySelector('#btn-fullscreen');
    const progressContainer = this.container.querySelector('.progress-container');
    const progressPlayed = this.container.querySelector('.progress-played');
    const progressBuffer = this.container.querySelector('.progress-buffer');
    const timeDisplay = this.container.querySelector('#time-display');

    // 播放/暂停
    const togglePlay = () => {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    };

    btnPlay.addEventListener('click', togglePlay);
    bigPlay.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);

    video.addEventListener('play', () => {
      this.isPlaying = true;
      btnPlay.textContent = '⏸';
      bigPlay.style.display = 'none';
    });

    video.addEventListener('pause', () => {
      this.isPlaying = false;
      btnPlay.textContent = '▶';
      bigPlay.style.display = 'flex';
    });

    // 进度条更新
    video.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      const percent = (video.currentTime / video.duration) * 100;
      progressPlayed.style.width = `${percent}%`;
      timeDisplay.textContent = `${this.formatTime(video.currentTime)} / ${this.formatTime(video.duration)}`;
    });

    // 缓冲进度
    video.addEventListener('progress', () => {
      if (video.buffered.length > 0 && video.duration) {
        const buffered = video.buffered.end(video.buffered.length - 1);
        progressBuffer.style.width = `${(buffered / video.duration) * 100}%`;
      }
    });

    // 进度条点击定位
    progressContainer.addEventListener('click', (e) => {
      const rect = progressContainer.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      video.currentTime = percent * video.duration;
    });

    // 进度条拖拽
    let isDragging = false;
    progressContainer.addEventListener('mousedown', (e) => {
      isDragging = true;
      const rect = progressContainer.getBoundingClientRect();
      video.currentTime = ((e.clientX - rect.left) / rect.width) * video.duration;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = progressContainer.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      video.currentTime = percent * video.duration;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // 进度条 hover 显示拖拽手柄
    progressContainer.addEventListener('mouseenter', () => {
      this.container.querySelector('.progress-thumb').style.opacity = '1';
    });
    progressContainer.addEventListener('mouseleave', () => {
      this.container.querySelector('.progress-thumb').style.opacity = '0';
    });

    // 音量控制
    btnMute.addEventListener('click', () => {
      video.muted = !video.muted;
      this.isMuted = video.muted;
      btnMute.textContent = video.muted ? '🔇' : '🔊';
    });

    volumeSlider.addEventListener('input', () => {
      video.volume = parseFloat(volumeSlider.value);
      video.muted = false;
      btnMute.textContent = video.volume === 0 ? '🔇' : '🔊';
    });

    // 倍速切换
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    let speedIndex = 2;
    btnSpeed.addEventListener('click', () => {
      speedIndex = (speedIndex + 1) % speeds.length;
      this.playbackRate = speeds[speedIndex];
      video.playbackRate = this.playbackRate;
      btnSpeed.textContent = `${this.playbackRate}x`;
    });

    // 全屏
    btnFullscreen.addEventListener('click', () => this.toggleFullscreen());

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      // 只在播放器模块激活时响应
      if (!this.container.closest('.module.active')) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'ArrowRight':
          video.currentTime = Math.min(video.duration, video.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          volumeSlider.value = video.volume;
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          volumeSlider.value = video.volume;
          break;
        case 'f':
        case 'F':
          this.toggleFullscreen();
          break;
        case 'm':
        case 'M':
          video.muted = !video.muted;
          btnMute.textContent = video.muted ? '🔇' : '🔊';
          break;
      }
    });

    // 双击全屏
    video.addEventListener('dblclick', () => this.toggleFullscreen());

    // 演示视频按钮
    this.container.querySelectorAll('.demo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.load(btn.dataset.src);
      });
    });
  }

  /**
   * 加载视频源
   */
  load(src) {
    this.video.src = src;
    this.video.load();
    this.container.querySelector('#video-title').textContent = src.split('/').pop();
  }

  /**
   * 切换全屏
   */
  toggleFullscreen() {
    const wrapper = this.container.querySelector('.player-wrapper');

    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().catch(err => {
        console.warn('全屏失败:', err.message);
      });
    } else {
      document.exitFullscreen();
    }
  }

  /**
   * 格式化时间 秒 -> MM:SS
   */
  formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
