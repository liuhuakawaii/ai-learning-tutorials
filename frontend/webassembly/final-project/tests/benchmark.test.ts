import { describe, it, expect } from 'vitest'

/** 模拟灰度化 JS 实现 */
function jsGrayscale(data: Uint8ClampedArray, intensity: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data)
  const factor = intensity / 100
  for (let i = 0; i < result.length; i += 4) {
    const gray = result[i] * 0.299 + result[i + 1] * 0.587 + result[i + 2] * 0.114
    result[i] = result[i] + (gray - result[i]) * factor
    result[i + 1] = result[i + 1] + (gray - result[i + 1]) * factor
    result[i + 2] = result[i + 2] + (gray - result[i + 2]) * factor
  }
  return result
}

/** 生成测试用随机像素数据 */
function generatePixels(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.random() * 255
    data[i + 1] = Math.random() * 255
    data[i + 2] = Math.random() * 255
    data[i + 3] = 255
  }
  return data
}

describe('WASM 多媒体处理平台 - 基准测试', () => {
  it('灰度化处理结果正确性', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255])
    const result = jsGrayscale(pixels, 100)
    // 灰度化后 R=G=B
    expect(result[0]).toBe(result[1])
    expect(result[1]).toBe(result[2])
  })

  it('256×256 图像灰度化性能', () => {
    const pixels = generatePixels(256, 256)
    const start = performance.now()
    jsGrayscale(pixels, 100)
    const duration = performance.now() - start
    expect(duration).toBeLessThan(1000)
  })

  it('512×512 图像灰度化性能', () => {
    const pixels = generatePixels(512, 512)
    const start = performance.now()
    jsGrayscale(pixels, 100)
    const duration = performance.now() - start
    expect(duration).toBeLessThan(5000)
  })

  it('Worker 线程池模块可导入', async () => {
    const mod = await import('../src/workers/worker-pool')
    expect(mod.WorkerPool).toBeDefined()
    expect(mod.getWorkerPool).toBeDefined()
  })

  it('Wasm 图像处理模块可导入', async () => {
    const mod = await import('../src/wasm/image-processor')
    expect(mod.initImageProcessor).toBeDefined()
    expect(mod.processImage).toBeDefined()
    expect(mod.isWasmReady).toBeDefined()
  })
})
