<script setup lang="ts">
import { ref } from 'vue'
import type { CompressOptions, CompressResult } from '../types'

const fileInputRef = ref<HTMLInputElement | null>(null)
const processing = ref(false)
const lastResult = ref<CompressResult | null>(null)
const fileName = ref('')
const algorithm = ref<CompressOptions['algorithm']>('gzip')
const level = ref(6)
const rawFileData = ref<ArrayBuffer | null>(null)

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name
  rawFileData.value = await file.arrayBuffer()
  lastResult.value = null
}

async function compressFile() {
  if (!rawFileData.value) return
  processing.value = true

  const data = new Uint8Array(rawFileData.value)
  const startTime = performance.now()

  try {
    const cs = new CompressionStream(algorithm.value)
    const writer = cs.writable.getWriter()
    writer.write(data)
    writer.close()

    const reader = cs.readable.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
    const compressed = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      compressed.set(chunk, offset)
      offset += chunk.length
    }

    const duration = performance.now() - startTime
    lastResult.value = {
      data: compressed,
      originalSize: data.length,
      compressedSize: compressed.length,
      ratio: (1 - compressed.length / data.length) * 100,
      duration,
    }
  } catch (err) {
    console.error('压缩失败:', err)
  }

  processing.value = false
}

function downloadResult() {
  if (!lastResult.value || !fileName.value) return
  const blob = new Blob([lastResult.value.data])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName.value}.${algorithm.value}`
  a.click()
  URL.revokeObjectURL(url)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}
</script>

<template>
  <div class="file-compressor">
    <h2>文件压缩</h2>
    <p class="desc">使用浏览器原生 CompressionStream 进行 gzip / deflate 压缩</p>

    <div class="controls">
      <div class="control-group">
        <label>选择文件：</label>
        <input ref="fileInputRef" type="file" @change="onFileChange" />
        <span v-if="fileName" class="file-name">{{ fileName }}</span>
      </div>

      <div class="control-group">
        <label>压缩算法：</label>
        <select v-model="algorithm">
          <option value="gzip">Gzip</option>
          <option value="deflate">Deflate</option>
        </select>
      </div>

      <div class="button-group">
        <button :disabled="processing || !rawFileData" @click="compressFile">
          {{ processing ? '压缩中...' : '开始压缩' }}
        </button>
        <button :disabled="!lastResult" @click="downloadResult">下载压缩文件</button>
      </div>
    </div>

    <div v-if="lastResult" class="result-info">
      <span>原始大小：{{ formatSize(lastResult.originalSize) }}</span>
      <span>压缩后：{{ formatSize(lastResult.compressedSize) }}</span>
      <span>压缩率：{{ lastResult.ratio.toFixed(1) }}%</span>
      <span>耗时：{{ lastResult.duration.toFixed(2) }}ms</span>
    </div>
  </div>
</template>

<style scoped>
.file-compressor h2 { margin-bottom: 0.5rem; color: #34d399; }
.desc { color: #94a3b8; margin-bottom: 1.5rem; font-size: 0.9rem; }
.controls { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
.control-group { display: flex; align-items: center; gap: 0.75rem; }
.control-group label { min-width: 120px; font-size: 0.9rem; }
.file-name { color: #6ee7b7; font-size: 0.85rem; }
select { background: #0f172a; color: #e2e8f0; border: 1px solid #334155; padding: 0.5rem; border-radius: 6px; }
.button-group { display: flex; gap: 0.75rem; }
button { padding: 0.6rem 1.2rem; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; transition: background 0.2s; }
button:hover:not(:disabled) { background: #059669; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.result-info { display: flex; gap: 1.5rem; font-size: 0.85rem; color: #94a3b8; padding: 0.75rem; background: #0f172a; border-radius: 6px; }
</style>
