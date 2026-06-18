import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { chatApi, authApi, agentApi, knowledgeApi, workflowApi, skillApi, statsApi } from '@/api'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userId = ref('')
  const username = ref('')
  const isLoggedIn = computed(() => !!token.value)

  async function login(email: string, password: string) {
    const res: any = await authApi.login(email, password)
    token.value = res.access_token
    userId.value = res.user_id
    username.value = res.username
    localStorage.setItem('token', res.access_token)
  }

  function logout() {
    token.value = ''
    userId.value = ''
    username.value = ''
    localStorage.removeItem('token')
  }

  return { token, userId, username, isLoggedIn, login, logout }
})

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<any[]>([])
  const currentSessionId = ref<string | null>(null)
  const messages = ref<any[]>([])
  const isLoading = ref(false)
  const isSending = ref(false)
  const availableModels = ref<any[]>([])

  async function loadSessions() {
    const res: any = await chatApi.listSessions()
    sessions.value = res.items
  }

  async function createSession(message: string) {
    isSending.value = true
    try {
      const res: any = await chatApi.createSession(message)
      currentSessionId.value = res.session_id
      messages.value = [res.message]
      await loadSessions()
    } finally {
      isSending.value = false
    }
  }

  async function sendMessage(message: string) {
    if (!currentSessionId.value) return
    isSending.value = true
    try {
      messages.value.push({
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      })

      const res: any = await chatApi.sendMessage(currentSessionId.value, message)
      messages.value.push(res.message)
    } finally {
      isSending.value = false
    }
  }

  async function loadMessages(sessionId: string) {
    currentSessionId.value = sessionId
    const res: any = await chatApi.listMessages(sessionId)
    messages.value = res
  }

  async function deleteSession(sessionId: string) {
    await chatApi.deleteSession(sessionId)
    if (currentSessionId.value === sessionId) {
      currentSessionId.value = null
      messages.value = []
    }
    await loadSessions()
  }

  async function loadModels() {
    try {
      const res: any = await chatApi.listModels()
      availableModels.value = res
    } catch {
      availableModels.value = []
    }
  }

  return {
    sessions, currentSessionId, messages, isLoading, isSending, availableModels,
    loadSessions, createSession, sendMessage, loadMessages, deleteSession, loadModels,
  }
})

export const useAgentStore = defineStore('agent', () => {
  const agents = ref<any[]>([])
  const total = ref(0)
  const isLoading = ref(false)

  async function loadAgents(page = 1, size = 20) {
    isLoading.value = true
    try {
      const res: any = await agentApi.list(page, size)
      agents.value = res.items
      total.value = res.total
    } finally {
      isLoading.value = false
    }
  }

  async function createAgent(data: any) {
    const res: any = await agentApi.create(data)
    await loadAgents()
    return res
  }

  async function updateAgent(id: string, data: any) {
    const res: any = await agentApi.update(id, data)
    await loadAgents()
    return res
  }

  async function deleteAgent(id: string) {
    await agentApi.delete(id)
    await loadAgents()
  }

  async function publishAgent(id: string) {
    const res: any = await agentApi.publish(id)
    await loadAgents()
    return res
  }

  return { agents, total, isLoading, loadAgents, createAgent, updateAgent, deleteAgent, publishAgent }
})

export const useKnowledgeStore = defineStore('knowledge', () => {
  const knowledgeBases = ref<any[]>([])
  const documents = ref<any[]>([])
  const total = ref(0)
  const isLoading = ref(false)

  async function loadKBs(page = 1, size = 20) {
    isLoading.value = true
    try {
      const res: any = await knowledgeApi.list(page, size)
      knowledgeBases.value = res.items
      total.value = res.total
    } finally {
      isLoading.value = false
    }
  }

  async function createKB(data: any) {
    const res: any = await knowledgeApi.create(data)
    await loadKBs()
    return res
  }

  async function deleteKB(id: string) {
    await knowledgeApi.delete(id)
    await loadKBs()
  }

  async function loadDocuments(kbId: string) {
    const res: any = await knowledgeApi.listDocuments(kbId)
    documents.value = res
  }

  async function uploadDocument(kbId: string, file: File) {
    const res: any = await knowledgeApi.uploadDocument(kbId, file)
    await loadDocuments(kbId)
    await loadKBs()
    return res
  }

  async function deleteDocument(kbId: string, docId: string) {
    await knowledgeApi.deleteDocument(kbId, docId)
    await loadDocuments(kbId)
    await loadKBs()
  }

  return {
    knowledgeBases, documents, total, isLoading,
    loadKBs, createKB, deleteKB, loadDocuments, uploadDocument, deleteDocument,
  }
})

export const useWorkflowStore = defineStore('workflow', () => {
  const workflows = ref<any[]>([])
  const total = ref(0)
  const isLoading = ref(false)

  async function loadWorkflows(page = 1, size = 20) {
    isLoading.value = true
    try {
      const res: any = await workflowApi.list(page, size)
      workflows.value = res.items
      total.value = res.total
    } finally {
      isLoading.value = false
    }
  }

  async function createWorkflow(data: any) {
    const res: any = await workflowApi.create(data)
    await loadWorkflows()
    return res
  }

  async function deleteWorkflow(id: string) {
    await workflowApi.delete(id)
    await loadWorkflows()
  }

  async function executeWorkflow(id: string) {
    return await workflowApi.execute(id)
  }

  return { workflows, total, isLoading, loadWorkflows, createWorkflow, deleteWorkflow, executeWorkflow }
})

export const useSkillStore = defineStore('skill', () => {
  const skills = ref<any[]>([])
  const total = ref(0)
  const isLoading = ref(false)

  async function loadSkills(page = 1, size = 20, type?: string) {
    isLoading.value = true
    try {
      const res: any = await skillApi.list(page, size, type)
      skills.value = res.items
      total.value = res.total
    } finally {
      isLoading.value = false
    }
  }

  async function createSkill(data: any) {
    const res: any = await skillApi.create(data)
    await loadSkills()
    return res
  }

  async function updateSkill(id: string, data: any) {
    const res: any = await skillApi.update(id, data)
    await loadSkills()
    return res
  }

  async function deleteSkill(id: string) {
    await skillApi.delete(id)
    await loadSkills()
  }

  return { skills, total, isLoading, loadSkills, createSkill, updateSkill, deleteSkill }
})

export const useStatsStore = defineStore('stats', () => {
  const overview = ref<any>(null)
  const usage = ref<any>(null)
  const modelStats = ref<any[]>([])
  const isLoading = ref(false)

  async function loadOverview() {
    isLoading.value = true
    try {
      overview.value = await statsApi.overview()
    } finally {
      isLoading.value = false
    }
  }

  async function loadUsage(days = 7) {
    usage.value = await statsApi.usage(days)
  }

  async function loadModelStats() {
    modelStats.value = await statsApi.models() as any[]
  }

  return { overview, usage, modelStats, isLoading, loadOverview, loadUsage, loadModelStats }
})
