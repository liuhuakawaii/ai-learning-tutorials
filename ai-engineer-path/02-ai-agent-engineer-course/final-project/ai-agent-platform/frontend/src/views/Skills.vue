<template>
  <div style="padding: 24px;">
    <n-space justify="space-between" align="center" style="margin-bottom: 16px;">
      <n-h2 prefix="bar" style="margin: 0;">Skill 市场</n-h2>
      <n-space>
        <n-select v-model:value="filterType" :options="typeOptions" placeholder="筛选类型" clearable style="width: 150px;" @update:value="onFilterChange" />
        <n-button type="primary" @click="showCreateModal = true">创建 Skill</n-button>
      </n-space>
    </n-space>

    <n-grid :cols="3" :x-gap="16" :y-gap="16">
      <n-gi v-for="skill in skillStore.skills" :key="skill.id">
        <n-card :title="skill.name" hoverable>
          <template #header-extra>
            <n-tag :type="typeColorMap[skill.type] || 'default'" size="small">{{ skill.type }}</n-tag>
          </template>
          <n-text depth="3">{{ skill.description || '暂无描述' }}</n-text>
          <n-space style="margin-top: 12px;" size="small">
            <n-tag size="small" :type="skill.is_enabled ? 'success' : 'warning'">{{ skill.is_enabled ? '启用' : '禁用' }}</n-tag>
            <n-tag v-if="skill.requires_approval" size="small" type="warning">需审批</n-tag>
          </n-space>
          <template #action>
            <n-space>
              <n-button size="small" @click="handleToggle(skill)">{{ skill.is_enabled ? '禁用' : '启用' }}</n-button>
              <n-popconfirm @positive-click="handleDelete(skill.id)">
                <template #trigger><n-button size="small" type="error" quaternary>删除</n-button></template>
                确认删除？
              </n-popconfirm>
            </n-space>
          </template>
        </n-card>
      </n-gi>
    </n-grid>

    <n-empty v-if="!skillStore.isLoading && skillStore.skills.length === 0" description="暂无 Skill，点击右上角创建" style="margin-top: 60px;" />

    <n-modal v-model:show="showCreateModal" preset="dialog" title="创建 Skill">
      <n-form :model="createForm" label-placement="left" label-width="100">
        <n-form-item label="名称"><n-input v-model:value="createForm.name" placeholder="Skill 名称" /></n-form-item>
        <n-form-item label="类型">
          <n-select v-model:value="createForm.type" :options="typeOptions" />
        </n-form-item>
        <n-form-item label="描述"><n-input v-model:value="createForm.description" type="textarea" placeholder="描述 Skill 功能" /></n-form-item>
        <n-form-item label="需审批"><n-switch v-model:value="createForm.requires_approval" /></n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showCreateModal = false">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="handleCreate">创建</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { useSkillStore } from '@/stores'

const skillStore = useSkillStore()
const message = useMessage()
const showCreateModal = ref(false)
const submitting = ref(false)
const filterType = ref<string | null>(null)

const typeOptions = [
  { label: 'API Skill', value: 'api' },
  { label: 'Script Skill', value: 'script' },
  { label: 'Workflow Skill', value: 'workflow' },
  { label: 'MCP Skill', value: 'mcp' },
]

const typeColorMap: Record<string, string> = {
  api: 'info',
  script: 'success',
  workflow: 'warning',
  mcp: 'error',
}

const createForm = reactive({
  name: '',
  type: 'api',
  description: '',
  requires_approval: false,
})

onMounted(() => skillStore.loadSkills())

function onFilterChange(type: string | null) {
  skillStore.loadSkills(1, 20, type || undefined)
}

async function handleCreate() {
  if (!createForm.name.trim()) { message.warning('请输入名称'); return }
  submitting.value = true
  try {
    await skillStore.createSkill({ ...createForm })
    showCreateModal.value = false
    message.success('创建成功')
    createForm.name = ''
    createForm.type = 'api'
    createForm.description = ''
    createForm.requires_approval = false
  } catch { message.error('创建失败') } finally { submitting.value = false }
}

async function handleToggle(skill: any) {
  try {
    await skillStore.updateSkill(skill.id, { is_enabled: !skill.is_enabled })
    message.success(skill.is_enabled ? '已禁用' : '已启用')
  } catch { message.error('操作失败') }
}

async function handleDelete(id: string) {
  try { await skillStore.deleteSkill(id); message.success('删除成功') } catch { message.error('删除失败') }
}
</script>
