import client from './client'

export const authApi = {
  login: (email: string, password: string) =>
    client.post('/auth/login', { email, password }),
  register: (email: string, username: string, password: string) =>
    client.post('/auth/register', { email, username, password }),
  getMe: () => client.get('/auth/me'),
}

export const chatApi = {
  listSessions: (page = 1, size = 20) =>
    client.get('/chat/sessions', { params: { page, size } }),
  createSession: (message: string, agentId?: string) =>
    client.post('/chat/sessions', { message, agent_id: agentId }),
  sendMessage: (sessionId: string, message: string, model?: string) =>
    client.post(`/chat/sessions/${sessionId}/messages`, { message, model }),
  listMessages: (sessionId: string) =>
    client.get(`/chat/sessions/${sessionId}/messages`),
  deleteSession: (sessionId: string) =>
    client.delete(`/chat/sessions/${sessionId}`),
  listModels: () => client.get('/chat/models'),
}

export const agentApi = {
  list: (page = 1, size = 20) =>
    client.get('/agents', { params: { page, size } }),
  get: (id: string) => client.get(`/agents/${id}`),
  create: (data: any) => client.post('/agents', data),
  update: (id: string, data: any) => client.put(`/agents/${id}`, data),
  delete: (id: string) => client.delete(`/agents/${id}`),
  publish: (id: string) => client.post(`/agents/${id}/publish`),
}

export const knowledgeApi = {
  list: (page = 1, size = 20) =>
    client.get('/knowledge', { params: { page, size } }),
  get: (id: string) => client.get(`/knowledge/${id}`),
  create: (data: any) => client.post('/knowledge', data),
  delete: (id: string) => client.delete(`/knowledge/${id}`),
  listDocuments: (kbId: string) => client.get(`/knowledge/${kbId}/documents`),
  uploadDocument: (kbId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return client.post(`/knowledge/${kbId}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteDocument: (kbId: string, docId: string) =>
    client.delete(`/knowledge/${kbId}/documents/${docId}`),
  query: (kbId: string, query: string) =>
    client.post(`/knowledge/${kbId}/query`, { query }),
}

export const workflowApi = {
  list: (page = 1, size = 20) =>
    client.get('/workflows', { params: { page, size } }),
  get: (id: string) => client.get(`/workflows/${id}`),
  create: (data: any) => client.post('/workflows', data),
  update: (id: string, data: any) => client.put(`/workflows/${id}`, data),
  delete: (id: string) => client.delete(`/workflows/${id}`),
  execute: (id: string) => client.post(`/workflows/${id}/execute`),
}

export const skillApi = {
  list: (page = 1, size = 20, type?: string) =>
    client.get('/skills', { params: { page, size, type } }),
  get: (id: string) => client.get(`/skills/${id}`),
  create: (data: any) => client.post('/skills', data),
  update: (id: string, data: any) => client.put(`/skills/${id}`, data),
  delete: (id: string) => client.delete(`/skills/${id}`),
  test: (id: string, input: any) => client.post(`/skills/${id}/test`, input),
}

export const statsApi = {
  overview: () => client.get('/stats/overview'),
  usage: (days = 7) => client.get('/stats/usage', { params: { days } }),
  models: () => client.get('/stats/models'),
}
