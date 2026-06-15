<template>
  <div style="padding: 24px;">
    <n-space justify="space-between" align="center" style="margin-bottom: 16px;">
      <n-h2 prefix="bar" style="margin: 0;">工作流管理</n-h2>
      <n-button type="primary" @click="showCreateModal = true">创建工作流</n-button>
    </n-space>

    <n-data-table
      :columns="columns"
      :data="workflowStore.workflows"
      :loading="workflowStore.isLoading"
      :pagination="pagination"
      :row-key="(row: any) => row.id"
      @update:page="onPageChange"
    />

    <n-modal v-model:show="showCreateModal" preset="dialog" title="创建工作流">
      <n-form :model="createForm" label-placement="left" label-width="80">
        <n-form-item label="名称"><n-input v-model:value="createForm.name" placeholder="工作流名称" /></n-form-item>
        <n-form-item label="描述"><n-input v-model:value="createForm.description" type="textarea" placeholder="描述工作流用途" /></n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showCreateModal = false">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="handleCreate">创建</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="showEditorModal" preset="dialog" :title="`工作流编辑 - ${currentWorkflow?.name}`" style="width: 800px;">
      <n-alert type="info" style="margin-bottom: 16px;">
        可视化工作流编辑器正在开发中。当前可通过 JSON 编辑节点和连线。
      </n-alert>
      <n-code :code="editorJson" language="json" />
      <template #action>
        <n-button @click="showEditorModal = false">关闭</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import { NButton, NSpace, NTag, NPopconfirm, useMessage } from 'naive-ui'
import { useWorkflowStore } from '@/stores'

const workflowStore = useWorkflowStore()
const message = useMessage()
const showCreateModal = ref(false)
const showEditorModal = ref(false)
const submitting = ref(false)
const currentPage = ref(1)
const currentWorkflow = ref<any>(null)
const editorJson = ref('')
const createForm = reactive({ name: '', description: '' })

const pagination = reactive({ page: 1, pageSize: 20, showSizePicker: false, pageCount: 1 })

const columns = [
  { title: '名称', key: 'name', width: 150 },
  { title: '节点数', key: 'nodes', width: 80, render: (row: any) => row.nodes?.length || 0 },
  { title: '版本', key: 'version', width: 60 },
  {
    title: '状态', key: 'is_active', width: 80,
    render: (row: any) => h(NTag, { type: row.is_active ? 'success' : 'default', size: 'small' }, { default: () => row.is_active ? '启用' : '禁用' }),
  },
  { title: '创建时间', key: 'created_at', width: 170, render: (row: any) => new Date(row.created_at).toLocaleString('zh-CN') },
  {
    title: '操作', key: 'actions', width: 220,
    render: (row: any) => h(NSpace, { size: 'small' }, {
      default: () => [
        h(NButton, { size: 'small', onClick: () => openEditor(row) }, { default: () => '编辑' }),
        h(NButton, { size: 'small', type: 'info', onClick: () => handleExecute(row.id) }, { default: () => '执行' }),
        h(NPopconfirm, { onPositiveClick: () => handleDelete(row.id) }, {
          trigger: () => h(NButton, { size: 'small', type: 'error' }, { default: () => '删除' }),
          default: () => '确认删除？',
        }),
      ],
    }),
  },
]

onMounted(() => workflowStore.loadWorkflows())

function onPageChange(page: number) {
  currentPage.value = page
  pagination.page = page
  workflowStore.loadWorkflows(page)
}

async function handleCreate() {
  if (!createForm.name.trim()) { message.warning('请输入名称'); return }
  submitting.value = true
  try {
    await workflowStore.createWorkflow({ ...createForm })
    showCreateModal.value = false
    message.success('创建成功')
    createForm.name = ''
    createForm.description = ''
  } catch { message.error('创建失败') } finally { submitting.value = false }
}

function openEditor(workflow: any) {
  currentWorkflow.value = workflow
  editorJson.value = JSON.stringify({ nodes: workflow.nodes, edges: workflow.edges, variables: workflow.variables }, null, 2)
  showEditorModal.value = true
}

async function handleExecute(id: string) {
  try {
    const res: any = await workflowStore.executeWorkflow(id)
    message.success(`执行已启动: ${res.execution_id}`)
  } catch { message.error('执行失败') }
}

async function handleDelete(id: string) {
  try { await workflowStore.deleteWorkflow(id); message.success('删除成功') } catch { message.error('删除失败') }
}
</script>
