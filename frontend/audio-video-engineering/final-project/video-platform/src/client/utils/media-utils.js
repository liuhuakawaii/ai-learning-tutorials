/**
 * 媒体工具函数
 *
 * 封装常用的音视频处理工具，供各组件复用
 */

/**
 * 检测浏览器支持的媒体格式
 *
 * @returns {object} 各格式的支持情况
 */
export function detectMediaSupport() {
  const video = document.createElement('video');
  const audio = document.createElement('audio');

  return {
    // 视频格式
    mp4: video.canPlayType('video/mp4') !== '',
    webm: video.canPlayType('video/webm') !== '',
    ogg: video.canPlayType('video/ogg') !== '',
    hls: video.canPlayType('application/vnd.apple.mpegurl') !== '' ||
         typeof window.Hls !== 'undefined',
    mse: typeof MediaSource !== 'undefined',

    // 音频格式
    mp3: audio.canPlayType('audio/mpeg') !== '',
    wav: audio.canPlayType('audio/wav') !== '',
    oggAudio: audio.canPlayType('audio/ogg') !== '',
    opus: audio.canPlayType('audio/ogg; codecs=opus') !== '',
    aac: audio.canPlayType('audio/mp4; codecs=mp4a.40.2') !== '',

    // 录制支持
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    webRTC: typeof RTCPeerConnection !== 'undefined',
    screenShare: typeof navigator.mediaDevices !== 'undefined' &&
                 typeof navigator.mediaDevices.getDisplayMedia === 'function',

    // Web Audio API
    webAudio: typeof AudioContext !== 'undefined' ||
              typeof webkitAudioContext !== 'undefined'
  };
}

/**
 * 获取用户媒体流
 *
 * @param {object} constraints - 媒体约束
 * @returns {Promise<MediaStream>}
 */
export async function getUserMedia(constraints = { video: true, audio: true }) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('浏览器不支持 getUserMedia');
  }

  return navigator.mediaDevices.getUserMedia(constraints);
}

/**
 * 获取屏幕共享流
 *
 * @returns {Promise<MediaStream>}
 */
export async function getDisplayMedia() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error('浏览器不支持 getDisplayMedia');
  }

  return navigator.mediaDevices.getDisplayMedia({ video: true });
}

/**
 * 格式化时间（秒 -> MM:SS 或 HH:MM:SS）
 *
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间字符串
 */
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 格式化文件大小
 *
 * @param {number} bytes - 字节数
 * @returns {string} 可读的大小字符串
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

/**
 * 计算音频 RMS（均方根）音量
 *
 * @param {Uint8Array} dataArray - 时域数据
 * @returns {number} 0-1 之间的音量值
 */
export function calculateVolume(dataArray) {
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const normalized = (dataArray[i] - 128) / 128;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / dataArray.length);
  return Math.min(1, rms * 3); // 放大以便可视化
}

/**
 * 将音量转换为分贝值
 *
 * @param {number} volume - 0-1 之间的音量值
 * @returns {number} 分贝值
 */
export function volumeToDb(volume) {
  if (volume <= 0) return -Infinity;
  return 20 * Math.log10(volume);
}

/**
 * 生成随机颜色（用于可视化）
 *
 * @param {number} index - 索引
 * @param {number} total - 总数
 * @returns {string} HSL 颜色字符串
 */
export function getVisualizationColor(index, total) {
  const hue = (index / total) * 360;
  return `hsl(${hue}, 80%, 55%)`;
}

/**
 * 创建简化的音频可视化数据
 *
 * @param {AnalyserNode} analyser - 音频分析节点
 * @param {number} barCount - 频谱条数量
 * @returns {Uint8Array} 归一化的频谱数据
 */
export function getVisualizationData(analyser, barCount = 64) {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  // 将频谱数据聚合为指定数量的条
  const result = new Uint8Array(barCount);
  const step = Math.floor(bufferLength / barCount);

  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += dataArray[i * step + j];
    }
    result[i] = sum / step;
  }

  return result;
}

/**
 * 安全地停止媒体流的所有轨道
 *
 * @param {MediaStream} stream - 媒体流
 */
export function stopMediaStream(stream) {
  if (!stream) return;

  stream.getTracks().forEach(track => {
    track.stop();
  });
}

/**
 * 检查是否为安全上下文（HTTPS 或 localhost）
 *
 * @returns {boolean}
 */
export function isSecureContext() {
  return window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

/**
 * 获取推荐的媒体录制配置
 *
 * @returns {object} MediaRecorder 配置
 */
export function getRecommendedRecordingConfig() {
  const configs = [
    { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 2500000 },
    { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 2500000 },
    { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2500000 },
    { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 2500000 },
    { mimeType: 'video/webm' },
    { mimeType: 'video/mp4' }
  ];

  for (const config of configs) {
    if (MediaRecorder.isTypeSupported(config.mimeType)) {
      return config;
    }
  }

  return {}; // 使用默认配置
}
