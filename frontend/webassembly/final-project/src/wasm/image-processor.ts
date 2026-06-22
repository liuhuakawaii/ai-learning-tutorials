/**
 * Wasm 图像处理模块封装
 * 封装 Rust 编译的 Wasm 模块，提供统一的 JS 调用接口
 */

import type { ImageFilterOptions, ImageProcessResult } from '../types'

/** Wasm 模块是否已初始化 */
let wasmModule: any = null
let initialized = false

/** 初始化 Wasm 图像处理模块 */
export async function initImageProcessor(): Promise<void> {
  if (initialized) return

  try {
    const wasm = await import('../../crates/image-processor/pkg/image_processor')
    await wasm.default()
    wasmModule = wasm
    initialized = true
  } catch (err) {
    console.warn('Wasm 模块加载失败，将使用 JS 降级:', err)
    throw err
  }
}

/** 使用 Wasm 处理图像 */
export async function processImage(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  options: ImageFilterOptions
): Promise<ImageProcessResult> {
  if (!initialized || !wasmModule) {
    throw new Error('Wasm 模块未初始化，请先调用 initImageProcessor()')
  }

  const startTime = performance.now()

  const resultPtr = wasmModule.process_image(
    imageData,
    width,
    height,
    options.type,
    options.intensity
  )

  const processedData = new Uint8ClampedArray(
    wasmModule.memory.buffer,
    resultPtr,
    width * height * 4
  )

  const duration = performance.now() - startTime

  return {
    data: new Uint8ClampedArray(processedData),
    width,
    height,
    duration,
    implementation: 'wasm',
  }
}

/** 检查 Wasm 是否可用 */
export function isWasmReady(): boolean {
  return initialized && wasmModule !== null
}
