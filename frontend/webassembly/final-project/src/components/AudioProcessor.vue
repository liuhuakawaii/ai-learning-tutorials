<script setup lang="ts">
import { ref } from 'vue'
import type { AudioProcessOptions, AudioProcessResult } from '../types'

const fileInputRef = ref<HTMLInputElement | null>(null)
const audioContext = ref<AudioContext | null>(null)
const audioBuffer = ref<AudioBuffer | null>(null)
const processing = ref(false)
const lastResult = ref<AudioProcessResult | null>(null)
const processType = ref<AudioProcessOptions['type']>('volume')
const paramValue = ref(50)
const fileName = ref('')
const isPlaying = ref(false)
const audioSource = ref<AudioBufferSourceNode | null>(null)

const processTypes: { value: AudioProcessOptions['type']; label: string }[] = [
  { value: 'volume', label: '音量调节' },
  { value: 'speed', label: '变速处理' },
  { value: 'reverse', label: '音频反转' },
  { value: 'fade', label: '淡入淡出' },
]

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name
  const arrayBuffer = await file.arrayBuffer()

  if (!audioContext.value) {
    audioContext.value = new AudioContext()
  }
  audioBuffer.value = await audioContext.value.decodeAudioData(arrayBuffer)
  lastResult.value = null
}

function processAudio() {
  if (!audioBuffer.value || !audioContext.value) return
  processing.value = true

  const ctx = audioContext.value
  const buffer = audioBuffer.value
  const startTime = performance.now()

  const channels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const processedBuffer = ctx.createBuffer(channels, length, sampleRate)

  for (let ch = 0; ch < channels; ch++) {
    const input = buffer.getChannelData(ch)
    const output = processedBuffer.getChannelData(ch)

    switch (processType.value) {
      case 'volume': {
        const gain = paramValue.value / 50
        for (let i = 0; i < input.length; i++) {
          output[i] = input[i] * gain
        }
        break
      }
      case 'speed': {
        const speed = paramValue.value / 50
        for (let i = 0; i < length; i++) {
          const srcIdx = Math.min(Math.floor(i * speed), input.length - 1)
          output[i] = input[srcIdx]
        }
        break
      }
      case 'reverse': {
        for (let i = 0; i < length; i++) {
          output[i] = input[length - 1 - i]
        }
        break
      }
      case 'fade': {
        const fadeLen = Math.floor(length * (paramValue.value / 100))
        for (let i = 0; i < length; i++) {
          let gain = 1
          if (i < fadeLen) gain = i / fadeLen
          if (i > length - fadeLen) gain = (length - i) / fadeLen
          output[i] = input[i] * gain
        }
        break
      }
    }
  }

  const duration = performance.now() - startTime
  lastResult.value = {
    buffer: processedBuffer.getChannelData(0),
    sampleRate,
    duration,
  }

  processing.value = false
}

function playResult() {
  if (!audioContext.value || !lastResult.value) return
  stopPlayback()

  const ctx = audioContext.value
  const result = lastResult.value
  const buffer = ctx.createBuffer(1, result.buffer.length, result.sampleRate)
  buffer.copyToChannel(result.buffer, 0)

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start()
  source.onended = () => { isPlaying.value = false }
  audioSource.value = source
  isPlaying.value = true
}

function stopPlayback() {
  if (audioSource.value) {
    try { audioSource.value.stop() } catch {}
    audioSource.value = null
    isPlaying.value = false
  }
}
</script>

<template>
  <div class="audio-processor">
    <h2>音频处理</h2>
    <p class="desc">支持音量调节、变速、反转、淡入淡出等操作</p>

    <div class="controls">
      <div class="control-group">
        <label>选择音频：</label>
        <input ref="fileInputRef" type="file" accept="audio/*" @change="onFileChange" />
        <span v-if="fileName" class="file-name">{{ fileName }}</span>
      </div>

      <div class="control-group">
        <label>处理类型：</label>
        <select v-model="processType">
          <option v-for="t in processTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>

      <div v-if="processType !== 'reverse'" class="control-group">
        <label>参数：{{ paramValue }}%</label>
        <input v-model.number="paramValue" type="range" min="0" max="100" />
      </div>

      <div class="button-group">
        <button :disabled="processing || !audioBuffer" @click="processAudio">
          {{ processing ? '处理中...' : '处理音频' }}
        </button>
        <button :disabled="!lastResult" @click="isPlaying ? stopPlayback() : playResult()">
          {{ isPlaying ? '停止' : '试听' }}
        </button>
      </div>
    </div>

    <div v-if="lastResult" class="result-info">
      <span>采样率：{{ lastResult.sampleRate }}Hz</span>
      <span>耗时：{{ lastResult.duration.toFixed(2) }}ms</span>
      <span>样本数：{{ lastResult.buffer.length }}</span>
    </div>
  </div>
</template>

<style scoped>
.audio-processor h2 { margin-bottom: 0.5rem; color: #a78bfa; }
.desc { color: #94a3b8; margin-bottom: 1.5rem; font-size: 0.9rem; }
.controls { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
.control-group { display: flex; align-items: center; gap: 0.75rem; }
.control-group label { min-width: 120px; font-size: 0.9rem; }
.file-name { color: #6ee7b7; font-size: 0.85rem; }
select { background: #0f172a; color: #e2e8f0; border: 1px solid #334155; padding: 0.5rem; border-radius: 6px; }
input[type="range"] { flex: 1; max-width: 300px; }
.button-group { display: flex; gap: 0.75rem; }
button { padding: 0.6rem 1.2rem; background: #8b5cf6; color: white; border: none; border-radius: 6px; cursor: pointer; transition: background 0.2s; }
button:hover:not(:disabled) { background: #7c3aed; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.result-info { display: flex; gap: 1.5rem; font-size: 0.85rem; color: #94a3b8; padding: 0.75rem; background: #0f172a; border-radius: 6px; }
</style>
