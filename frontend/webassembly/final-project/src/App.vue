<script setup lang="ts">
import { ref } from 'vue'
import ImageProcessor from './components/ImageProcessor.vue'
import AudioProcessor from './components/AudioProcessor.vue'
import FileCompressor from './components/FileCompressor.vue'
import PerformancePanel from './components/PerformancePanel.vue'

const activeTab = ref<'image' | 'audio' | 'compress' | 'performance'>('image')

const tabs = [
  { key: 'image' as const, label: '图像处理' },
  { key: 'audio' as const, label: '音频处理' },
  { key: 'compress' as const, label: '文件压缩' },
  { key: 'performance' as const, label: '性能面板' },
]
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>WASM 多媒体处理平台</h1>
      <p class="subtitle">基于 WebAssembly 的高性能浏览器端多媒体处理</p>
    </header>

    <nav class="tab-nav">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>

    <main class="main-content">
      <ImageProcessor v-if="activeTab === 'image'" />
      <AudioProcessor v-else-if="activeTab === 'audio'" />
      <FileCompressor v-else-if="activeTab === 'compress'" />
      <PerformancePanel v-else-if="activeTab === 'performance'" />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  min-height: 100vh;
}

.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.app-header {
  text-align: center;
  margin-bottom: 2rem;
}

.app-header h1 {
  font-size: 2rem;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: #94a3b8;
  margin-top: 0.5rem;
}

.tab-nav {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid #1e293b;
  padding-bottom: 0.5rem;
}

.tab-btn {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: all 0.2s;
  font-size: 0.95rem;
}

.tab-btn:hover {
  background: #1e293b;
  color: #e2e8f0;
}

.tab-btn.active {
  background: #1e293b;
  color: #60a5fa;
  border-bottom: 2px solid #60a5fa;
}

.main-content {
  background: #1e293b;
  border-radius: 12px;
  padding: 2rem;
  min-height: 400px;
}
</style>
