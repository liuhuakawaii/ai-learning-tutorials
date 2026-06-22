import { VideoPlayer } from './components/video-player.js';
import { AudioRecorder } from './components/audio-recorder.js';
import { HlsPlayer } from './components/hls-player.js';
import { VideoChat } from './components/video-chat.js';

/**
 * 应用入口
 * 管理模块切换和组件初始化
 */
class App {
  constructor() {
    this.currentModule = 'player';
    this.components = {};

    this.initNavigation();
    this.initComponents();
    this.initUpload();
    this.loadVideoList();
  }

  /**
   * 初始化导航切换
   */
  initNavigation() {
    const buttons = document.querySelectorAll('nav button');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const module = btn.dataset.module;
        this.switchModule(module);

        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  /**
   * 切换功能模块
   */
  switchModule(module) {
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
    document.getElementById(`module-${module}`).classList.add('active');
    this.currentModule = module;
  }

  /**
   * 初始化各功能组件
   */
  initComponents() {
    // 视频播放器
    this.components.player = new VideoPlayer(
      document.getElementById('video-player-container')
    );

    // 音频录制器
    this.components.recorder = new AudioRecorder(
      document.getElementById('audio-recorder-container')
    );

    // HLS 播放器
    this.components.hls = new HlsPlayer(
      document.getElementById('hls-player-container')
    );

    // 视频通话
    this.components.chat = new VideoChat(
      document.getElementById('video-chat-container')
    );
  }

  /**
   * 初始化视频上传功能
   */
  initUpload() {
    const zone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const progressBar = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const statusText = document.getElementById('upload-status');

    // 点击选择文件
    zone.addEventListener('click', () => fileInput.click());

    // 拖拽效果
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.uploadFile(files[0]);
      }
    });

    // 文件选择
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        this.uploadFile(fileInput.files[0]);
      }
    });
  }

  /**
   * 上传视频文件
   * 支持分片上传大文件
   */
  async uploadFile(file) {
    const progressBar = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const statusText = document.getElementById('upload-status');

    progressBar.style.display = 'block';
    statusText.textContent = `正在上传: ${file.name}`;

    // 小文件直接上传
    if (file.size < 10 * 1024 * 1024) {
      const formData = new FormData();
      formData.append('video', file);

      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload/single');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            progressFill.style.width = `${percent}%`;
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            statusText.textContent = '✅ 上传成功';
            this.loadVideoList();
          } else {
            statusText.textContent = '❌ 上传失败';
          }
          setTimeout(() => {
            progressBar.style.display = 'none';
            progressFill.style.width = '0%';
          }, 2000);
        };

        xhr.onerror = () => {
          statusText.textContent = '❌ 网络错误';
        };

        xhr.send(formData);
      } catch (err) {
        statusText.textContent = `❌ 上传失败: ${err.message}`;
      }
    } else {
      // 大文件分片上传
      await this.uploadInChunks(file);
    }
  }

  /**
   * 分片上传大文件
   * 1. 初始化上传，获取 uploadId
   * 2. 逐片上传
   * 3. 合并分片
   */
  async uploadInChunks(file) {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB/片
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const statusText = document.getElementById('upload-status');
    const progressFill = document.getElementById('progress-fill');

    try {
      // 1. 初始化
      const initRes = await fetch('/api/upload/chunk/init', { method: 'POST' });
      const { uploadId } = await initRes.json();

      // 2. 逐片上传
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', i);

        await fetch('/api/upload/chunk', {
          method: 'POST',
          body: formData
        });

        const percent = ((i + 1) / totalChunks) * 100;
        progressFill.style.width = `${percent}%`;
        statusText.textContent = `上传中: ${Math.round(percent)}%`;
      }

      // 3. 合并
      statusText.textContent = '正在合并分片...';
      const mergeRes = await fetch('/api/upload/chunk/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          filename: file.name,
          totalChunks
        })
      });

      if (mergeRes.ok) {
        statusText.textContent = '✅ 上传成功';
        this.loadVideoList();
      } else {
        statusText.textContent = '❌ 合并失败';
      }
    } catch (err) {
      statusText.textContent = `❌ 上传失败: ${err.message}`;
    }

    setTimeout(() => {
      document.getElementById('upload-progress').style.display = 'none';
      progressFill.style.width = '0%';
    }, 2000);
  }

  /**
   * 加载已上传视频列表
   */
  async loadVideoList() {
    try {
      const res = await fetch('/api/upload/list');
      const { videos } = await res.json();

      const grid = document.getElementById('video-list');
      grid.innerHTML = videos.length === 0
        ? '<p style="color: #888; padding: 20px;">暂无视频，请上传</p>'
        : videos.map(v => `
            <div class="video-card" data-id="${v.videoId}">
              <div class="thumb">🎬</div>
              <div class="info">
                <h4>${v.filename}</h4>
                <small>${this.formatSize(v.size)}</small>
              </div>
            </div>
          `).join('');

      // 点击播放
      grid.querySelectorAll('.video-card').forEach(card => {
        card.addEventListener('click', () => {
          const videoId = card.dataset.id;
          this.components.player.load(`/uploads/${videoId}.mp4`);
          this.switchModule('player');
          document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
          document.querySelector('[data-module="player"]').classList.add('active');
        });
      });
    } catch (err) {
      console.warn('加载视频列表失败:', err.message);
    }
  }

  /**
   * 格式化文件大小
   */
  formatSize(bytes) {
    if (!bytes) return '未知大小';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }
}

// 启动应用
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
