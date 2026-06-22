/**
 * HLS 自适应流媒体播放器组件
 *
 * 功能：
 * - 基于 hls.js 的 HLS 流播放
 * - 自适应码率切换
 * - 画质手动选择
 * - 播放统计信息
 *
 * HLS 原理：
 * - 将视频切分为小的 TS 分片（通常 4-10 秒）
 * - 生成 M3U8 索引文件描述分片顺序
 * - 支持多码率自适应：根据网络状况自动切换画质
 * - 客户端通过不断请求新的分片实现"流式"播放
 */
export class HlsPlayer {
  constructor(container) {
    this.container = container;
    this.hls = null;
    this.video = null;
    this.levels = [];
    this.currentLevel = -1; // -1 = 自适应

    this.render();
    this.bindEvents();
  }

  /**
   * 渲染 UI
   */
  render() {
    this.container.innerHTML = `
      <div class="card">
        <div style="position: relative; background: #000; border-radius: 8px; overflow: hidden;">
          <video id="hls-video" style="width: 100%; display: block;" controls>
            您的浏览器不支持 video 标签
          </video>
        </div>

        <!-- HLS 控制面板 -->
        <div style="margin-top: 16px; display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
          <div>
            <label style="font-size: 13px; color: #888;">画质选择</label>
            <select id="quality-select" style="background: #222; color: #ccc; border: 1px solid #444;
              padding: 6px 12px; border-radius: 4px; margin-left: 8px;">
              <option value="-1">自动</option>
            </select>
          </div>

          <div>
            <label style="font-size: 13px; color: #888;">播放速度</label>
            <select id="hls-speed-select" style="background: #222; color: #ccc; border: 1px solid #444;
              padding: 6px 12px; border-radius: 4px; margin-left: 8px;">
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1" selected>1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </div>
        </div>

        <!-- 播放统计 -->
        <div id="hls-stats" style="margin-top: 16px; display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
          <div style="background: #222; padding: 12px; border-radius: 8px;">
            <p style="font-size: 12px; color: #888;">当前码率</p>
            <p id="stat-bitrate" style="font-size: 18px; color: #fff; font-weight: 600;">-</p>
          </div>
          <div style="background: #222; padding: 12px; border-radius: 8px;">
            <p style="font-size: 12px; color: #888;">分辨率</p>
            <p id="stat-resolution" style="font-size: 18px; color: #fff; font-weight: 600;">-</p>
          </div>
          <div style="background: #222; padding: 12px; border-radius: 8px;">
            <p style="font-size: 12px; color: #888;">缓冲长度</p>
            <p id="stat-buffer" style="font-size: 18px; color: #fff; font-weight: 600;">-</p>
          </div>
          <div style="background: #222; padding: 12px; border-radius: 8px;">
            <p style="font-size: 12px; color: #888;">加载延迟</p>
            <p id="stat-latency" style="font-size: 18px; color: #fff; font-weight: 600;">-</p>
          </div>
        </div>
      </div>

      <!-- HLS 演示 -->
      <div class="card" style="margin-top: 16px;">
        <h3>HLS 流媒体演示</h3>
        <p style="color: #888; margin-bottom: 12px;">
          HLS（HTTP Live Streaming）将视频切分为小的 TS 分片，通过 M3U8 索引文件描述。
          客户端根据网络状况自动切换不同码率的流，实现自适应播放。
        </p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="hls-demo-btn"
            data-src="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
            style="background: #222; border: 1px solid #444; color: #ccc; padding: 8px 16px;
            border-radius: 6px; cursor: pointer;">
            📺 演示流 1
          </button>
          <button class="hls-demo-btn"
            data-src="https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8"
            style="background: #222; border: 1px solid #444; color: #ccc; padding: 8px 16px;
            border-radius: 6px; cursor: pointer;">
            📺 Apple 演示流
          </button>
        </div>
      </div>

      <!-- HLS 原理说明 -->
      <div class="card" style="margin-top: 16px;">
        <h3>HLS 工作原理</h3>
        <div style="margin-top: 12px; color: #ccc; line-height: 1.8; font-size: 14px;">
          <p><strong>1. 服务端：</strong>将视频转码为多码率版本，每个版本切分为 4-10 秒的 TS 分片</p>
          <p><strong>2. 索引文件：</strong>生成 M3U8 格式的播放列表，描述分片顺序和码率信息</p>
          <p><strong>3. 客户端：</strong>解析 M3U8，逐片下载 TS 分片并播放</p>
          <p><strong>4. 自适应：</strong>检测下载速度，动态切换到最合适的码率</p>
          <pre style="background: #111; padding: 12px; border-radius: 6px; margin-top: 12px;
            overflow-x: auto; font-size: 13px; color: #2ed573;">
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480
480p.m3u8</pre>
        </div>
      </div>
    `;
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    this.video = this.container.querySelector('#hls-video');

    // 画质选择
    this.container.querySelector('#quality-select').addEventListener('change', (e) => {
      const level = parseInt(e.target.value);
      this.switchLevel(level);
    });

    // 播放速度
    this.container.querySelector('#hls-speed-select').addEventListener('change', (e) => {
      this.video.playbackRate = parseFloat(e.target.value);
    });

    // 演示按钮
    this.container.querySelectorAll('.hls-demo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.loadHlsStream(btn.dataset.src);
      });
    });

    // 统计信息更新
    setInterval(() => this.updateStats(), 1000);
  }

  /**
   * 加载 HLS 流
   */
  async loadHlsStream(url) {
    // 动态加载 hls.js
    if (!window.Hls) {
      await this.loadHlsLibrary();
    }

    if (window.Hls && window.Hls.isSupported()) {
      // 使用 hls.js
      if (this.hls) {
        this.hls.destroy();
      }

      this.hls = new window.Hls({
        startLevel: -1, // 自适应
        capLevelToPlayerSize: true,
        debug: false
      });

      this.hls.loadSource(url);
      this.hls.attachMedia(this.video);

      this.hls.on(window.Hls.Events.MANIFEST_PARSED, (event, data) => {
        this.levels = data.levels;
        this.updateQualityOptions();
        this.video.play().catch(() => {});
      });

      this.hls.on(window.Hls.Events.LEVEL_SWITCHED, (event, data) => {
        this.currentLevel = data.level;
        this.updateQualityOptions();
      });

      this.hls.on(window.Hls.Events.ERROR, (event, data) => {
        console.error('HLS 错误:', data.type, data.details);
        if (data.fatal) {
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              this.hls.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              this.hls.recoverMediaError();
              break;
            default:
              this.hls.destroy();
              break;
          }
        }
      });

    } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari 原生支持
      this.video.src = url;
      this.video.addEventListener('loadedmetadata', () => {
        this.video.play().catch(() => {});
      });
    } else {
      console.warn('浏览器不支持 HLS 播放');
    }
  }

  /**
   * 动态加载 hls.js
   */
  loadHlsLibrary() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
      script.onload = resolve;
      script.onerror = () => {
        console.warn('hls.js 加载失败，将使用原生播放');
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  /**
   * 更新画质选项
   */
  updateQualityOptions() {
    const select = this.container.querySelector('#quality-select');
    select.innerHTML = '<option value="-1">自动</option>';

    this.levels.forEach((level, index) => {
      const option = document.createElement('option');
      option.value = index;
      const width = level.width || '?';
      const height = level.height || '?';
      const bitrate = level.bitrate ? (level.bitrate / 1000).toFixed(0) : '?';
      option.textContent = `${width}x${height} (${bitrate} kbps)`;
      if (index === this.currentLevel) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  /**
   * 切换画质
   */
  switchLevel(level) {
    if (!this.hls) return;
    this.hls.currentLevel = level;
    this.currentLevel = level;
  }

  /**
   * 更新播放统计
   */
  updateStats() {
    if (!this.video || !this.hls) return;

    const level = this.levels[this.currentLevel] || this.levels[this.hls.currentLevel];

    // 当前码率
    const bitrate = level ? (level.bitrate / 1000).toFixed(0) + ' kbps' : '-';
    this.container.querySelector('#stat-bitrate').textContent = bitrate;

    // 分辨率
    const resolution = level ? `${level.width}x${level.height}` : '-';
    this.container.querySelector('#stat-resolution').textContent = resolution;

    // 缓冲长度
    if (this.video.buffered.length > 0) {
      const buffered = this.video.buffered.end(this.video.buffered.length - 1) - this.video.currentTime;
      this.container.querySelector('#stat-buffer').textContent = buffered.toFixed(1) + 's';
    }

    // 加载延迟（简化的估算）
    if (this.hls.latency !== undefined) {
      this.container.querySelector('#stat-latency').textContent = this.hls.latency.toFixed(2) + 's';
    }
  }
}
