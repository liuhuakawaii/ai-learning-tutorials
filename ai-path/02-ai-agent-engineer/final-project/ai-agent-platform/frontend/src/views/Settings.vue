<template>
  <div style="padding: 24px; max-width: 800px;">
    <n-h2 prefix="bar">设置</n-h2>

    <n-card title="模型配置" style="margin-bottom: 16px;">
      <n-form label-placement="left" label-width="140">
        <n-form-item label="默认 LLM 提供商">
          <n-select v-model:value="config.defaultProvider" :options="providerOptions" />
        </n-form-item>
        <n-form-item label="默认模型">
          <n-input v-model:value="config.defaultModel" placeholder="gpt-4o-mini" />
        </n-form-item>
      </n-form>
    </n-card>

    <n-card title="OpenAI 配置" style="margin-bottom: 16px;">
      <n-form label-placement="left" label-width="140">
        <n-form-item label="API Key">
          <n-input v-model:value="config.openaiKey" type="password" show-password-on="click" placeholder="sk-..." />
        </n-form-item>
        <n-form-item label="BASE_URL">
          <n-input v-model:value="config.openaiBaseUrl" placeholder="https://api.openai.com/v1" />
          <n-text depth="3" style="margin-top: 4px; font-size: 12px;">
            支持自定义 API 地址，如国内代理或私有部署
          </n-text>
        </n-form-item>
      </n-form>
    </n-card>

    <n-card title="Anthropic 配置" style="margin-bottom: 16px;">
      <n-form label-placement="left" label-width="140">
        <n-form-item label="API Key">
          <n-input v-model:value="config.anthropicKey" type="password" show-password-on="click" placeholder="sk-ant-..." />
        </n-form-item>
        <n-form-item label="BASE_URL">
          <n-input v-model:value="config.anthropicBaseUrl" placeholder="https://api.anthropic.com" />
        </n-form-item>
      </n-form>
    </n-card>

    <n-card title="可用模型" style="margin-bottom: 16px;">
      <n-spin :show="loadingModels">
        <n-list v-if="models.length > 0">
          <n-list-item v-for="m in models" :key="m.id">
            <n-thing :title="m.id" :description="`输入: $${m.pricing.input}/M tokens · 输出: $${m.pricing.output}/M tokens`" />
          </n-list-item>
        </n-list>
        <n-empty v-else description="未检测到可用模型，请配置 API Key" />
      </n-spin>
    </n-card>

    <n-alert type="info" style="margin-bottom: 16px;">
      API Key 和 BASE_URL 配置需要在后端 .env 文件中修改，修改后重启后端服务生效。
      此页面展示当前配置状态。
    </n-alert>

    <n-card title="系统信息">
      <n-descriptions :column="1" bordered>
        <n-descriptions-item label="平台版本">1.0.0</n-descriptions-item>
        <n-descriptions-item label="前端框架">Vue 3 + Naive UI</n-descriptions-item>
        <n-descriptions-item label="后端框架">FastAPI + SQLAlchemy</n-descriptions-item>
        <n-descriptions-item label="数据库">PostgreSQL 16 + pgvector</n-descriptions-item>
      </n-descriptions>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { chatApi } from '@/api'

const models = ref<any[]>([])
const loadingModels = ref(false)

const config = reactive({
  defaultProvider: 'openai',
  defaultModel: 'gpt-4o-mini',
  openaiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  anthropicKey: '',
  anthropicBaseUrl: 'https://api.anthropic.com',
})

const providerOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
]

onMounted(async () => {
  loadingModels.value = true
  try {
    const res: any = await chatApi.listModels()
    models.value = res
  } catch {
    models.value = []
  } finally {
    loadingModels.value = false
  }
})
</script>
