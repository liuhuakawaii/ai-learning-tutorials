/**
 * Worker 线程池实现
 * 使用 Web Worker 进行多线程并行计算，支持 SharedArrayBuffer 进行高效数据传输
 */

import type { WorkerPoolConfig, WorkerTask } from '../types'

const DEFAULT_CONFIG: WorkerPoolConfig = {
  poolSize: navigator.hardwareConcurrency || 4,
  maxQueueSize: 64,
}

export class WorkerPool {
  private workers: Worker[] = []
  private idleWorkers: number[] = []
  private taskQueue: WorkerTask[] = []
  private activeTasks = new Map<string, number>()
  private config: WorkerPoolConfig

  constructor(config?: Partial<WorkerPoolConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.init()
  }

  /** 初始化 Worker 线程池 */
  private init(): void {
    for (let i = 0; i < this.config.poolSize; i++) {
      const worker = this.createWorker(i)
      this.workers.push(worker)
      this.idleWorkers.push(i)
    }
  }

  /** 创建单个 Worker 实例 */
  createWorker(index: number): Worker {
    const workerCode = `
      self.onmessage = function(e) {
        const { id, type, payload } = e.data;
        try {
          let result;
          switch (type) {
            case 'process-image':
              result = processImagePayload(payload);
              break;
            case 'compress':
              result = compressPayload(payload);
              break;
            default:
              throw new Error('未知任务类型: ' + type);
          }
          self.postMessage({ id, result, error: null });
        } catch (err) {
          self.postMessage({ id, result: null, error: err.message });
        }
      };

      function processImagePayload(payload) {
        const { data, width, height, filter, intensity } = payload;
        const pixels = new Uint8ClampedArray(data);
        const factor = intensity / 100;
        for (let i = 0; i < pixels.length; i += 4) {
          const gray = pixels[i] * 0.299 + pixels[i+1] * 0.587 + pixels[i+2] * 0.114;
          pixels[i]   = pixels[i]   + (gray - pixels[i])   * factor;
          pixels[i+1] = pixels[i+1] + (gray - pixels[i+1]) * factor;
          pixels[i+2] = pixels[i+2] + (gray - pixels[i+2]) * factor;
        }
        return pixels.buffer;
      }

      function compressPayload(payload) {
        const { data } = payload;
        return data;
      }
    `

    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    const worker = new Worker(url)
    URL.revokeObjectURL(url)

    worker.onmessage = (e: MessageEvent) => {
      const { id, result, error } = e.data
      const task = this.activeTasks.get(id)
      if (task !== undefined) {
        this.activeTasks.delete(id)
        this.idleWorkers.push(task)
        this.processNext()
      }
    }

    return worker
  }

  /** 提交任务到线程池 */
  async submit<T>(type: string, payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.taskQueue.length >= this.config.maxQueueSize) {
        reject(new Error('任务队列已满'))
        return
      }

      const task: WorkerTask = {
        id: crypto.randomUUID(),
        type,
        payload,
        resolve: resolve as (v: unknown) => void,
        reject,
      }

      if (this.idleWorkers.length > 0) {
        this.dispatch(task)
      } else {
        this.taskQueue.push(task)
      }
    })
  }

  /** 将任务分发给空闲 Worker */
  private dispatch(task: WorkerTask): void {
    const workerIndex = this.idleWorkers.pop()!
    this.activeTasks.set(task.id, workerIndex)
    this.workers[workerIndex].postMessage({
      id: task.id,
      type: task.type,
      payload: task.payload,
    })
  }

  /** 处理队列中的下一个任务 */
  private processNext(): void {
    if (this.taskQueue.length > 0 && this.idleWorkers.length > 0) {
      const task = this.taskQueue.shift()!
      this.dispatch(task)
    }
  }

  /** 获取当前活跃 Worker 数量 */
  get activeCount(): number {
    return this.activeTasks.size
  }

  /** 获取队列中等待的任务数量 */
  get queueLength(): number {
    return this.taskQueue.length
  }

  /** 销毁所有 Worker */
  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate()
    }
    this.workers = []
    this.idleWorkers = []
    this.taskQueue = []
    this.activeTasks.clear()
  }
}

/** 全局线程池单例 */
let poolInstance: WorkerPool | null = null

export function getWorkerPool(config?: Partial<WorkerPoolConfig>): WorkerPool {
  if (!poolInstance) {
    poolInstance = new WorkerPool(config)
  }
  return poolInstance
}

/** 使用 SharedArrayBuffer 在主线程与 Worker 之间共享数据 */
export function createSharedBuffer(size: number): SharedArrayBuffer {
  return new SharedArrayBuffer(size)
}
