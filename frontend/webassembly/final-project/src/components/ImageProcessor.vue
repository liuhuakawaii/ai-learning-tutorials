<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { initImageProcessor, processImage as wasmProcessImage } from '../wasm/image-processor'
import type { ImageFilterOptions, ImageProcessResult } from '../types'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFilter = ref<ImageFilterOptions['type']>('grayscale')
const intensity = ref(50)
const processing = ref(false)
const lastResult = ref<ImageProcessResult | null>(null)
const originalImageData = ref<ImageData | null>(null)
const useWasm = ref(true)
const wasmReady = ref(false)

const filters: { value: ImageFilterOptions['type']; label: string }[] = [
  { value: 'grayscale', label: '灰度化' },
  { value: 'blur', label: '模糊' },
  { value: 'sharpen', label: '锐化' },
  { value: 'edge-detect', label: '边缘检测' },
  { value: 'brightness', label: '亮度调节' },
]

onMounted(async () => {
  try {
    await initImageProcessor()
    wasmReady.value = true
  } catch {
    console.warn('Wasm 模块加载失败，将使用 JS 降级方案')
    wasmReady.value = false
  }
})

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const img = new Image()
  const reader = new FileReader()
  reader.onload = (e) => {
    img.onload = () => {
      const canvas = canvasRef.value!
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      originalImageData.value = ctx.getImageData(0, 0, img.width, img.height)
    }
    img.src = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

function jsGrayscale(data: Uint8ClampedArray, intensityVal: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data)
  const factor = intensityVal / 100
  for (let i = 0; i < result.length; i += 4) {
    const gray = result[i] * 0.299 + result[i + 1] * 0.587 + result[i + 2] * 0.114
    result[i] = result[i] + (gray - result[i]) * factor
    result[i + 1] = result[i + 1] + (gray - result[i + 1]) * factor
    result[i + 2] = result[i + 2] + (gray - result[i + 2]) * factor
  }
  return result
}

function jsBlur(data: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data)
  const r = Math.max(1, Math.round(radius))
  for (let y = r; y < height - r; y++) {
    for (let x = r; x < width - r; x++) {
      let rSum = 0, gSum = 0, bSum = 0, count = 0
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4
          rSum += data[idx]
          gSum += data[idx + 1]
          bSum += data[idx + 2]
          count++
        }
      }
      const idx = (y * width + x) * 4
      result[idx] = rSum / count
      result[idx + 1] = gSum / count
      result[idx + 2] = bSum / count
    }
  }
  return result
}

async function applyFilter() {
  if (!canvasRef.value || !originalImageData.value) return
  processing.value = true

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')!
  const { width, height, data } = originalImageData.value
  const startTime = performance.now()

  let processedData: Uint8ClampedArray

  if (useWasm.value && wasmReady.value) {
    try {
      const result = await wasmProcessImage(data, width, height, {
        type: selectedFilter.value,
        intensity: intensity.value,
      })
      processedData = result.data
    } catch {
      // Wasm 处理失败，降级到 JS 实现
      processedData = fallbackProcess(data, width, height)
    }
  } else {
    processedData = fallbackProcess(data, width, height)
  }

  const duration = performance.now() - startTime
  const imageData = new ImageData(processedData, width, height)
  ctx.putImageData(imageData, 0, 0)

  lastResult.value = {
    data: processedData,
    width,
    height,
    duration,
    implementation: useWasm.value && wasmReady.value ? 'wasm' : 'js',
  }
  processing.value = false
}

function fallbackProcess(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  switch (selectedFilter.value) {
    case 'grayscale':
      return jsGrayscale(data, intensity.value)
    case 'blur':
      return jsBlur(data, width, height, intensity.value / 20)
    case 'brightness': {
      const result = new Uint8ClampedArray(data)
      const adjust = (intensity.value - 50) * 2.55
      for (let i = 0; i < result.length; i += 4) {
        result[i] = Math.max(0, Math.min(255, result[i] + adjust))
        result[i + 1] = Math.max(0, Math.min(255, result[i + 1] + adjust))
        result[i + 2] = Math.max(0, Math.min(255, result[i + 2] + adjust))
      }
      return result
    }
    default:
      return new Uint8ClampedArray(data)
  }
}

function resetImage() {
  if (!canvasRef.value || !originalImageData.value) return
  const ctx = canvasRef.value.getContext('2d')!
  ctx.putImageData(originalImageData.value, 0, 0)
  lastResult.value = null
}
</script>

<template>
  <div class="image-processor">
    <h2>图像处理</h2>
    <p class="desc">支持灰度化、模糊、锐化、边缘检测等滤镜，使用 Rust/Wasm 加速计算</p>

    <div class="controls">
      <div class="control-group">
        <label>选择图片：</label>
        <input ref="fileInputRef" type="file" accept="image/*" @change="onFileChange" />
      </div>

      <div class="control-group">
        <label>滤镜类型：</label>
        <select v-model="selectedFilter">
          <option v-for="f in filters" :key="f.value" :value="f.value">{{ f.label }}</option>
        </select>
      </div>

      <div class="control-group">
        <label>强度：{{ intensity }}%</label>
        <input v-model.number="intensity" type="range" min="0" max="100" />
      </div>

      <div class="control-group">
        <label>
          <input v-model="useWasm" type="checkbox" />
          使用 Wasm 加速
          <span v-if="wasmReady" class="badge success">已就绪</span>
          <span v-else class="badge warning">未加载</span>
        </label>
      </div>

      <div class="button-group">
        <button :disabled="processing || !originalImageData" @click="applyFilter">
          {{ processing ? '处理中...' : '应用滤镜' }}
        </button>
        <button :disabled="!originalImageData" @click="resetImage">重置</button>
      </div>
    </div>

    <canvas ref="canvasRef" class="preview-canvas"></canvas>

    <div v-if="lastResult" class="result-info">
      <span>实现方式：{{ lastResult.implementation === 'wasm' ? 'Rust/Wasm' : 'JavaScript' }}</span>
      <span>耗时：{{ lastResult.duration.toFixed(2) }}ms</span>
      <span>图像尺寸：{{ lastResult.width }} × {{ lastResult.height }}</span>
    </div>
  </div>
</template>

<style scoped>
.image-processor h2 {
  margin-bottom: 0.5rem;
  color: #60a5fa;
}

.desc {
  color: #94a3b8;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.control-group label {
  min-width: 120px;
  font-size: 0.9rem;
}

select,
input[type="file"] {
  background: #0f172a;
  color: #e2e8f0;
  border: 1px solid #334155;
  padding: 0.5rem;
  border-radius: 6px;
}

input[type="range"] {
  flex: 1;
  max-width: 300px;
}

.button-group {
  display: flex;
  gap: 0.75rem;
}

button {
  padding: 0.6rem 1.2rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover:not(:disabled) {
  background: #2563eb;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.badge {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.5rem;
}

.badge.success {
  background: #065f46;
  color: #6ee7b7;
}

.badge.warning {
  background: #78350f;
  color: #fbbf24;
}

.preview-canvas {
  max-width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.result-info {
  display: flex;
  gap: 1.5rem;
  font-size: 0.85rem;
  color: #94a3b8;
  padding: 0.75rem;
  background: #0f172a;
  border-radius: 6px;
}
</style>
