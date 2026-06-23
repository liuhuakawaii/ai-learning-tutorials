# 阶段实战：完整 WASM 应用

## 项目目标

构建一个完整的 WASM 多媒体处理平台：图像编辑器 + 音频处理 + 数据可视化。综合运用课程所学的全部技术。

## 功能模块

1. **图像编辑器**——滤镜、裁剪、调整（WASM 加速）
2. **音频处理**——波形显示、音量调整、降噪（WASM + Web Audio）
3. **数据可视化**——大数据集图表渲染（WASM + Canvas）
4. **性能面板**——实时显示处理耗时和 FPS

## 技术架构

```
┌─────────────────────────────────┐
│           UI 层 (React)          │
├─────────────────────────────────┤
│        处理层 (WASM)             │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │图像   │ │音频   │ │数据   │    │
│  │滤镜   │ │处理   │ │计算   │    │
│  └──────┘ └──────┘ └──────┘    │
├─────────────────────────────────┤
│        渲染层 (Canvas/WebGL)     │
├─────────────────────────────────┤
│        存储层 (IndexedDB)        │
└─────────────────────────────────┘
```

## 图像编辑器

```typescript
// features/image-editor.ts
import { initWasm, apply_filter, get_pixels, set_pixels } from '../wasm/image_filter'

export function useImageEditor() {
  const [image, setImage] = useState<ImageData | null>(null)
  const [processing, setProcessing] = useState(false)

  async function applyFilter(filter: string, params?: Record<string, number>) {
    if (!image || processing) return
    setProcessing(true)

    const start = performance.now()

    // 发送到 Worker 处理
    const result = await worker.postMessage({
      type: 'filter',
      filter,
      pixels: image.data,
      width: image.width,
      height: image.height,
      params,
    })

    const elapsed = performance.now() - start
    console.log(`${filter}: ${elapsed.toFixed(2)}ms`)

    setImage(new ImageData(new Uint8ClampedArray(result), image.width, image.height))
    setProcessing(false)
  }

  return { image, setImage, applyFilter, processing }
}
```

## 音频处理

```typescript
// features/audio-processor.ts
export function useAudioProcessor() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)

  async function loadAudio(file: File) {
    const context = new AudioContext()
    const buffer = await file.arrayBuffer()
    const decoded = await context.decodeAudioData(buffer)
    setAudioBuffer(decoded)
  }

  function adjustVolume(buffer: AudioBuffer, factor: number): AudioBuffer {
    const context = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
    const source = context.createBufferSource()
    source.buffer = buffer

    const gain = context.createGain()
    gain.gain.value = factor
    source.connect(gain)
    gain.connect(context.destination)
    source.start()

    return context.startRendering()
  }

  return { audioBuffer, loadAudio, adjustVolume }
}
```

## 数据可视化

```typescript
// features/data-viz.ts
export function useDataViz(canvasRef: RefObject<HTMLCanvasElement>) {
  function renderChart(data: Float64Array, type: 'bar' | 'line') {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // 用 WASM 计算坐标
    const coords = calculate_coords(data, canvas.width, canvas.height)

    // Canvas 渲染
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (type === 'bar') {
      coords.forEach((c, i) => {
        ctx.fillStyle = '#3b82f6'
        ctx.fillRect(c.x, c.y, c.width, canvas.height - c.y)
      })
    }
  }

  return { renderChart }
}
```

## 性能面板

```typescript
// components/PerformancePanel.tsx
export function PerformancePanel({ metrics }) {
  return (
    <div className="perf-panel">
      <div className="metric">
        <span>处理耗时</span>
        <span>{metrics.processTime.toFixed(2)}ms</span>
      </div>
      <div className="metric">
        <span>FPS</span>
        <span>{metrics.fps}</span>
      </div>
      <div className="metric">
        <span>内存</span>
        <span>{(metrics.memory / 1024 / 1024).toFixed(1)}MB</span>
      </div>
    </div>
  )
}
```

## 项目结构

```
src/
├── features/
│   ├── image-editor/      # 图像编辑器
│   ├── audio-processor/   # 音频处理
│   └── data-viz/          # 数据可视化
├── wasm/
│   ├── image_filter/      # 图像滤镜 WASM
│   ├── audio_process/     # 音频处理 WASM
│   └── data_calc/         # 数据计算 WASM
├── workers/
│   └── processor.worker.ts
├── components/
│   ├── Editor.tsx
│   ├── Waveform.tsx
│   └── PerformancePanel.tsx
└── App.tsx
```

## 练习

### 练习一：完整平台

实现图像编辑器 + 音频处理 + 数据可视化三个模块。

### 练习二：Worker 处理

所有 WASM 计算放到 Web Worker 中，主线程只负责 UI 渲染。

### 练习三：性能优化

实现性能面板，实时显示每个操作的处理耗时。对比 Worker 和主线程处理的性能差异。

---

## 参考答案

### 练习一

按本课架构：WASM 模块 → React Hooks → UI 组件 → Canvas 渲染。

### 练习二

```typescript
// processor.worker.ts
import * as wasm from '../wasm/image_filter'

self.onmessage = async (e) => {
  const { filter, pixels, width, height, params } = e.data
  const result = wasm[filter](new Uint8Array(pixels), width, height, params)
  self.postMessage(result, [result.buffer])
}
```

### 练习三

```typescript
function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState({ processTime: 0, fps: 60, memory: 0 })

  function measure<T>(fn: () => T): T {
    const start = performance.now()
    const result = fn()
    const elapsed = performance.now() - start
    setMetrics(prev => ({ ...prev, processTime: elapsed }))
    return result
  }

  return { metrics, measure }
}
```
