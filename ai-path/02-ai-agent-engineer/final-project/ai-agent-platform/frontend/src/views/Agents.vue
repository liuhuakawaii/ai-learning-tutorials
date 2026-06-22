<template>
  <div style="padding: 24px;">
    <n-space justify="space-between" align="center" style="margin-bottom: 16px;">
      <n-h2 prefix="bar" style="margin: 0;">Agent 管理</n-h2>
      <n-button type="primary" @click="showCreateModal = true">创建 Agent</n-button>
    </n-space>

    <n-data-table
      :columns="columns"
      :data="agentStore.agents"
      :loading="agentStore.isLoading"
      :pagination="pagination"
      :row-key="(row: any) => row.id"
      @update:page="onPageChange"
    />

    <n-modal v-model:show="showCreateModal" preset="dialog" title="创建 Agent" style="width: 600px;">
      <n-form ref="formRef" :model="formData" label-placement="left" label-width="100">
        <n-form-item label="名称" path="name">
          <n-input v-model:value="formData.name" placeholder="给 Agent 起个名字" />
        </n-form-item>
        <n-form-item label="描述">
          <n-input v-model:value="formData.description" type="textarea" placeholder="描述 Agent 的能力" />
        </n-form-item>
        <n-form-item label="System Prompt">
          <n-input v-model:value="formData.system_prompt" type="textarea" :rows="4" placeholder="设定 Agent 的角色和行为" />
        </n-form-item>
        <n-form-item label="模型">
          <n-select v-model:value="formData.model" :options="modelOptions" />
        </n-form-item>
        <n-form-item label="Temperature">
          <n-slider v-model:value="formData.temperature" :min="0" :max="2" :step="0.1" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showCreateModal = false">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="handleCreate">创建</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import { NButton, NSpace, NTag, NPopconfirm, useMessage } from 'naive-ui'
import { useAgentStore } from '@/stores'

const agentStore = useAgentStore()
const message = useMessage()
const showCreateModal = ref(false)
const submitting = ref(false)
const currentPage = ref(1)

const formData = reactive({
  name: '',
  description: '',
  system_prompt: '你是一个有帮助的 AI 助手。',
  model: 'gpt-4o-mini',
  temperature: 0.7,
})

const modelOptions = [
  { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'Claude Sonnet', value: 'claude-sonnet-4-20250514' },
]

const pagination = reactive({ page: 1, pageSize: 20, showSizePicker: false, pageCount: 1 })

const columns = [
  { title: '名称', key: 'name', width: 150 },
  { title: '模型', key: 'model', width: 130 },
  {
    title: '状态', key: 'is_published', width: 80,
    render: (row: any) => h(NTag, { type: row.is_published ? 'success' : 'default', size: 'small' }, { default: () => row.is_published ? '已发布' : '草稿' }),
  },
  { title: '版本', key: 'version', width: 60 },
  { title: '创建时间', key: 'created_at', width: 170, render: (row: any) => new Date(row.created_at).toLocaleString('zh-CN') },
  {
    title: '操作', key: 'actions', width: 200,
    render: (row: any) => h(NSpace, { size: 'small' }, {
      default: () => [
        h(NButton, { size: 'small', type: 'info', onClick: () => handlePublish(row.id) }, { default: () => '发布' }),
        h(NPopconfirm, { onPositiveClick: () => handleDelete(row.id) }, {
          trigger: () => h(NButton, { size: 'small', type: 'error' }, { default: () => '删除' }),
          default: () => '确认删除？',
        }),
      ],
    }),
  },
]

onMounted(() => agentStore.loadAgents())

function onPageChange(page: number) {
  currentPage.value = page
  pagination.page = page
  agentStore.loadAgents(page)
}

async function handleCreate() {
  if (!formData.name.trim()) { message.warning('请输入名称'); return }
  submitting.value = true
  try {
    await agentStore.createAgent({ ...formData })
    showCreateModal.value = false
    message.success('创建成功')
    Object.assign(formData, { name: '', description: '', system_prompt: '你是一个有帮助的 AI 助手。', model: 'gpt-4o-mini', temperature: 0.7 })
  } catch { message.error('创建失败') } finally { submitting.value = false }
}

async function handlePublish(id: string) {
  try { await agentStore.publishAgent(id); message.success('发布成功') } catch { message.error('发布失败') }
}

async function handleDelete(id: string) {
  try { await agentStore.deleteAgent(id); message.success('删除成功') } catch { message.error('删除失败') }
}
</script>
