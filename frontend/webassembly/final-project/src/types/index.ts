/** 图像处理模块类型定义 */

export interface ImageFilterOptions {
  /** 滤镜类型 */
  type: 'grayscale' | 'blur' | 'sharpen' | 'edge-detect' | 'brightness'
  /** 滤镜强度，范围 0-100 */
  intensity: number
}

export interface ImageProcessResult {
  /** 处理后的像素数据 */
  data: Uint8ClampedArray
  /** 图像宽度 */
  width: number
  /** 图像高度 */
  height: number
  /** 处理耗时（毫秒） */
  duration: number
  /** 使用的实现方式 */
  implementation: 'wasm' | 'js'
}

export interface BenchmarkResult {
  /** 测试名称 */
  name: string
  /** WASM 实现耗时 */
  wasmTime: number
  /** JS 实现耗时 */
  jsTime: number
  /** 加速比 */
  speedup: number
}

/** 音频处理模块类型定义 */

export interface AudioProcessOptions {
  /** 处理类型 */
  type: 'volume' | 'speed' | 'reverse' | 'fade'
  /** 参数值 */
  value: number
}

export interface AudioProcessResult {
  /** 处理后的音频缓冲区 */
  buffer: Float32Array
  /** 采样率 */
  sampleRate: number
  /** 处理耗时（毫秒） */
  duration: number
}

/** 文件压缩模块类型定义 */

export interface CompressOptions {
  /** 压缩算法 */
  algorithm: 'gzip' | 'deflate'
  /** 压缩级别 1-9 */
  level: number
}

export interface CompressResult {
  /** 压缩后的数据 */
  data: Uint8Array
  /** 原始大小（字节） */
  originalSize: number
  /** 压缩后大小（字节） */
  compressedSize: number
  /** 压缩率 */
  ratio: number
  /** 处理耗时（毫秒） */
  duration: number
}

/** Worker 线程池类型定义 */

export interface WorkerTask<T = unknown> {
  id: string
  type: string
  payload: T
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

export interface WorkerPoolConfig {
  /** 线程数量，默认为 navigator.hardwareConcurrency */
  poolSize: number
  /** 任务队列最大长度 */
  maxQueueSize: number
}

/** 性能监控类型定义 */

export interface PerformanceMetrics {
  /** CPU 使用率 */
  cpuUsage: number
  /** 内存使用量（MB） */
  memoryUsage: number
  /** 活跃 Worker 数量 */
  activeWorkers: number
  /** 任务队列长度 */
  queueLength: number
  /** 平均处理时间（毫秒） */
  avgProcessTime: number
}
