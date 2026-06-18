<template>
  <div style="padding: 24px;">
    <n-space justify="space-between" align="center" style="margin-bottom: 16px;">
      <n-h2 prefix="bar" style="margin: 0;">知识库管理</n-h2>
      <n-button type="primary" @click="showCreateModal = true">创建知识库</n-button>
    </n-space>

    <n-grid :cols="3" :x-gap="16" :y-gap="16">
      <n-gi v-for="kb in knowledgeStore.knowledgeBases" :key="kb.id">
        <n-card :title="kb.name" hoverable>
          <template #header-extra>
            <n-popconfirm @positive-click="handleDeleteKB(kb.id)">
              <template #trigger><n-button size="small" type="error" quaternary>删除</n-button></template>
             确认删除知识库「{{ kb.name }}」？
            </n-popconfirm>
          </template>
          <n-text depth="3">{{ kb.description || '暂无描述' }}</n-text>
          <n-space style="margin-top: 12px;" size="small">
            <n-tag size="small">{{ kb.document_count }} 文档</n-tag>
            <n-tag size="small" type="info">{{ kb.chunk_count }} 分块</n-tag>
            <n-tag size="small" :type="kb.status === 'active' ? 'success' : 'warning'">{{ kb.status }}</n-tag>
          </n-space>
          <template #action>
            <n-space>
              <n-button size="small" @click="openDocuments(kb)">管理文档</n-button>
              <n-button size="small" type="info" @click="openQuery(kb)">测试问答</n-button>
            </n-space>
          </template>
        </n-card>
      </n-gi>
    </n-grid>

    <n-empty v-if="!knowledgeStore.isLoading && knowledgeStore.knowledgeBases.length === 0" description="暂无知识库，点击右上角创建" style="margin-top: 60px;" />

    <n-modal v-model:show="showCreateModal" preset="dialog" title="创建知识库">
      <n-form :model="createForm" label-placement="left" label-width="80">
        <n-form-item label="名称"><n-input v-model:value="createForm.name" placeholder="知识库名称" /></n-form-item>
        <n-form-item label="描述"><n-input v-model:value="createForm.description" type="textarea" placeholder="描述知识库内容" /></n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showCreateModal = false">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="handleCreate">创建</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="showDocModal" preset="dialog" :title="`文档管理 - ${currentKB?.name}`" style="width: 700px;">
      <n-upload :action="''" :custom-request="handleUpload" accept=".pdf,.docx,.doc,.md,.txt,.html" :max="5">
        <n-button>上传文档</n-button>
      </n-upload>
      <n-list style="margin-top: 16px;">
        <n-list-item v-for="doc in knowledgeStore.documents" :key="doc.id">
          <n-thing :title="doc.filename">
            <template #description>
              <n-space size="small">
                <n-tag size="tiny">{{ doc.file_type }}</n-tag>
                <span>{{ (doc.file_size / 1024).toFixed(1) }} KB</span>
                <n-tag size="tiny" :type="doc.status === 'uploaded' ? 'success' : 'warning'">{{ doc.status }}</n-tag>
              </n-space>
            </template>
            <template #header-extra>
              <n-popconfirm @positive-click="handleDeleteDoc(doc.id)">
                <template #trigger><n-button size="tiny" type="error" quaternary>删除</n-button></template>
                确认删除？
              </n-popconfirm>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>
      <n-empty v-if="knowledgeStore.documents.length === 0" description="暂无文档" />
    </n-modal>

    <n-modal v-model:show="showQueryModal" preset="dialog" :title="`测试问答 - ${currentKB?.name}`" style="width: 600px;">
      <n-input v-model:value="queryText" type="textarea" :rows="3" placeholder="输入你的问题..." />
      <n-button type="primary" block style="margin-top: 12px;" :loading="queryLoading" @click="handleQuery">提问</n-button>
      <div v-if="queryResult" style="margin-top: 16px; padding: 12px; background: #f5f5f5; border-radius: 8px;">
        <div>{{ queryResult.answer }}</div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { useKnowledgeStore, knowledgeApi } from '@/stores'

const knowledgeStore = useKnowledgeStore()
const message = useMessage()

const showCreateModal = ref(false)
const showDocModal = ref(false)
const showQueryModal = ref(false)
const submitting = ref(false)
const queryLoading = ref(false)
const currentKB = ref<any>(null)
const queryText = ref('')
const queryResult = ref<any>(null)
const createForm = reactive({ name: '', description: '' })

onMounted(() => knowledgeStore.loadKBs())

async function handleCreate() {
  if (!createForm.name.trim()) { message.warning('请输入名称'); return }
  submitting.value = true
  try {
    await knowledgeStore.createKB({ ...createForm })
    showCreateModal.value = false
    message.success('创建成功')
    createForm.name = ''
    createForm.description = ''
  } catch { message.error('创建失败') } finally { submitting.value = false }
}

async function handleDeleteKB(id: string) {
  try { await knowledgeStore.deleteKB(id); message.success('删除成功') } catch { message.error('删除失败') }
}

function openDocuments(kb: any) {
  currentKB.value = kb
  knowledgeStore.loadDocuments(kb.id)
  showDocModal.value = true
}

async function handleUpload({ file }: any) {
  if (!currentKB.value) return
  try {
    await knowledgeStore.uploadDocument(currentKB.value.id, file.file)
    message.success('上传成功')
  } catch { message.error('上传失败') }
}

async function handleDeleteDoc(docId: string) {
  if (!currentKB.value) return
  try { await knowledgeStore.deleteDocument(currentKB.value.id, docId); message.success('删除成功') } catch { message.error('删除失败') }
}

function openQuery(kb: any) {
  currentKB.value = kb
  queryText.value = ''
  queryResult.value = null
  showQueryModal.value = true
}

async function handleQuery() {
  if (!queryText.value.trim() || !currentKB.value) return
  queryLoading.value = true
  try {
    queryResult.value = await knowledgeApi.query(currentKB.value.id, queryText.value)
  } catch { message.error('查询失败') } finally { queryLoading.value = false }
}
</script>
