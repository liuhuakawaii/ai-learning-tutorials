# 04 Vue 3 + TypeScript 前端工程

> 前端不是"画页面"——是把复杂的后端能力翻译成人能理解的界面。

## 场景引入

后端 API 已经写好了，现在需要用 Vue 3 搭建前端工程。但企业级前端不是写几个页面那么简单：状态管理怎么做？API 调用怎么封装才优雅？TypeScript 类型怎么和后端对齐？组件库怎么按需导入？路由守卫怎么配置？这些问题处理不好，项目写到一半就会陷入混乱——组件之间传参像蜘蛛网，API 调用散落各处，类型报错满屏飘红。

## 学习目标

- 搭建 Vue 3 + TypeScript + Naive UI 的企业级前端工程
- 掌握组合式 API、Pinia 状态管理、Vue Router 配置
- 实现 AI 应用的通用布局和组件
- 理解前端工程化的关键配置

## 前置要求

- 已通过 `npm create vue@latest` 创建前端项目
- Vue 3 基础（模板语法、响应式、组件）
- TypeScript 基础（接口、泛型、类型推导）

## 项目初始化

```bash
npm create vue@latest frontend -- --typescript --router --pinia
cd frontend
npm install naive-ui @vicons/ionicons5 axios
npm install -D @vueuse/core unplugin-auto-import unplugin-vue-components
```

### 配置 Naive UI 自动导入

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [NaiveUiResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

## 应用入口与全局配置

```typescript
// frontend/src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createDiscreteApi } from 'naive-ui'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 全局 Naive UI 消息 API
const { message, notification, dialog } = createDiscreteApi(
  ['message', 'notification', 'dialog']
)
app.provide('message', message)
app.provide('notification', notification)
app.provide('dialog', dialog)

app.mount('#app')
```

## 全局类型定义

在项目根目录创建类型共享：

```typescript
// frontend/src/types/api.ts
// 后端 API 返回的通用结构
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
}

// 用户
export interface User {
  id: string
  email: string
  username: string
  is_active: boolean
  created_at: string
}

// 对话会话
export interface ChatSession {
  id: string
  title: string
  agent_id: string | null
  created_at: string
  updated_at: string
  message_count: number
}

// 消息
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  token_usage: number
  created_at: string
}

// Agent
export interface Agent {
  id: string
  name: string
  description: string
  system_prompt: string
  model: string
  temperature: number
  max_tokens: number
  tools: Tool[] | null
  is_published: boolean
  version: number
}

export interface Tool {
  name: string
  description: string
  parameters: Record<string, unknown>
}
```

## API 调用封装

```typescript
// frontend/src/api/client.ts
import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

// 请求拦截器：自动加 token
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：统一错误处理
client.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError<{ detail: string }>) => {
    const status = error.response?.status
    const message = error.response?.data?.detail || '网络错误'
    
    if (status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    
    return Promise.reject(new ApiError(status || 0, message))
  }
)

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export default client
```

```typescript
// frontend/src/api/chat.ts
import client from './client'
import type { ChatSession, Message, PaginatedResponse } from '@/types/api'

export const chatApi = {
  // 会话列表
  listSessions(page = 1, size = 20) {
    return client.get<any, PaginatedResponse<ChatSession>>(
      '/chat/sessions',
      { params: { page, size } }
    )
  },

  // 创建会话
  createSession(message: string, agentId?: string) {
    return client.post<any, { session_id: string; message: Message }>(
      '/chat/sessions',
      { message, agent_id: agentId }
    )
  },

  // 发送消息
  sendMessage(sessionId: string, message: string) {
    return client.post<any, { session_id: string; message: Message }>(
      `/chat/sessions/${sessionId}/messages`,
      { message }
    )
  },

  // 删除会话
  deleteSession(sessionId: string) {
    return client.delete(`/chat/sessions/${sessionId}`)
  },
}
```

## Pinia 状态管理

```typescript
// frontend/src/stores/chat.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { chatApi } from '@/api/chat'
import type { ChatSession, Message } from '@/types/api'

export const useChatStore = defineStore('chat', () => {
  // 状态
  const sessions = ref<ChatSession[]>([])
  const currentSessionId = ref<string | null>(null)
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const isSending = ref(false)

  // 计算属性
  const currentSession = computed(() =>
    sessions.value.find((s) => s.id === currentSessionId.value)
  )

  // 操作
  async function loadSessions() {
    const res = await chatApi.listSessions()
    sessions.value = res.items
  }

  async function createSession(message: string) {
    isSending.value = true
    try {
      const res = await chatApi.createSession(message)
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
      // 乐观更新：先显示用户消息
      messages.value.push({
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        token_usage: 0,
        created_at: new Date().toISOString(),
      })

      const res = await chatApi.sendMessage(currentSessionId.value, message)
      messages.value.push(res.message)
    } finally {
      isSending.value = false
    }
  }

  return {
    sessions,
    currentSessionId,
    messages,
    isLoading,
    isSending,
    currentSession,
    loadSessions,
    createSession,
    sendMessage,
  }
})
```

## 路由配置

```typescript
// frontend/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/chat' },
        {
          path: 'chat',
          name: 'Chat',
          component: () => import('@/views/Chat.vue'),
        },
        {
          path: 'chat/:sessionId',
          name: 'ChatSession',
          component: () => import('@/views/Chat.vue'),
        },
        {
          path: 'agents',
          name: 'Agents',
          component: () => import('@/views/Agents.vue'),
        },
        {
          path: 'knowledge',
          name: 'Knowledge',
          component: () => import('@/views/Knowledge.vue'),
        },
        {
          path: 'workflows',
          name: 'Workflows',
          component: () => import('@/views/Workflows.vue'),
        },
        {
          path: 'settings',
          name: 'Settings',
          component: () => import('@/views/Settings.vue'),
        },
      ],
    },
  ],
})

// 路由守卫
router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    return { name: 'Login' }
  }
})

export default router
```

## 主布局组件

```vue
<!-- frontend/src/layouts/MainLayout.vue -->
<template>
  <n-layout has-sider style="height: 100vh">
    <!-- 侧边栏 -->
    <n-layout-sider
      bordered
      :width="240"
      :collapsed-width="64"
      :collapsed="collapsed"
      show-trigger
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="logo" :class="{ collapsed }">
        <n-icon size="24"><LogoIcon /></n-icon>
        <span v-if="!collapsed">AI Agent Platform</span>
      </div>
      
      <n-menu
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        :options="menuOptions"
        :value="activeKey"
        @update:value="onMenuSelect"
      />
    </n-layout-sider>

    <!-- 主内容区 -->
    <n-layout>
      <n-layout-header bordered style="height: 56px; padding: 0 24px">
        <div class="header">
          <n-breadcrumb>
            <n-breadcrumb-item>{{ currentTitle }}</n-breadcrumb-item>
          </n-breadcrumb>
          <n-space align="center">
            <n-avatar round size="small">{{ userInitial }}</n-avatar>
          </n-space>
        </div>
      </n-layout-header>
      
      <n-layout-content content-style="padding: 24px;">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NIcon } from 'naive-ui'
import {
  ChatbubbleOutline,
  PersonOutline,
  LibraryOutline,
  GitNetworkOutline,
  SettingsOutline,
} from '@vicons/ionicons5'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)

const menuOptions = [
  {
    label: '对话',
    key: 'chat',
    icon: () => h(NIcon, null, { default: () => h(ChatbubbleOutline) }),
  },
  {
    label: 'Agent 管理',
    key: 'agents',
    icon: () => h(NIcon, null, { default: () => h(PersonOutline) }),
  },
  {
    label: '知识库',
    key: 'knowledge',
    icon: () => h(NIcon, null, { default: () => h(LibraryOutline) }),
  },
  {
    label: '工作流',
    key: 'workflows',
    icon: () => h(NIcon, null, { default: () => h(GitNetworkOutline) }),
  },
  {
    label: '设置',
    key: 'settings',
    icon: () => h(NIcon, null, { default: () => h(SettingsOutline) }),
  },
]

const activeKey = computed(() => route.path.split('/')[1] || 'chat')
const currentTitle = computed(() => {
  const map: Record<string, string> = {
    chat: '对话',
    agents: 'Agent 管理',
    knowledge: '知识库',
    workflows: '工作流',
    settings: '设置',
  }
  return map[activeKey.value] || '首页'
})

function onMenuSelect(key: string) {
  router.push(`/${key}`)
}
</script>

<style scoped>
.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  font-size: 16px;
  font-weight: 600;
}
.logo.collapsed {
  justify-content: center;
  padding: 16px 0;
}
.logo.collapsed span {
  display: none;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}
</style>
```

## 练习

### 练习 1：API 封装

为以下 API 模块创建完整的调用封装：

1. 用户认证（登录、注册、获取当前用户）
2. Agent 管理（CRUD）
3. 知识库管理（CRUD + 文档上传）

### 练习 2：状态管理

创建以下 Pinia Store：

1. `useUserStore`：用户登录状态、token 管理
2. `useAgentStore`：Agent 列表、当前编辑的 Agent

### 练习 3：页面开发

实现以下页面的静态版本（不对接后端，用 mock 数据）：

1. 登录页（表单验证、错误提示）
2. 对话页（消息列表、输入框、发送按钮）

---

## 参考答案

### 练习 1

**思路**：参照 `chat.ts` 的 API 封装模式，为用户认证、Agent 管理、知识库管理分别创建独立的 API 模块，统一使用 `client` 实例。

**答案**：

```typescript
// frontend/src/api/auth.ts
import client from './client'
import type { User } from '@/types/api'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export const authApi = {
  login(data: LoginRequest) {
    return client.post<any, TokenResponse>('/auth/login', data)
  },
  register(data: RegisterRequest) {
    return client.post<any, User>('/auth/register', data)
  },
  getCurrentUser() {
    return client.get<any, User>('/auth/me')
  },
}
```

```typescript
// frontend/src/api/agent.ts
import client from './client'
import type { Agent, PaginatedResponse } from '@/types/api'

export interface CreateAgentRequest {
  name: string
  description?: string
  system_prompt: string
  model?: string
  temperature?: number
  max_tokens?: number
}

export const agentApi = {
  list(page = 1, size = 20) {
    return client.get<any, PaginatedResponse<Agent>>('/agents', { params: { page, size } })
  },
  get(id: string) {
    return client.get<any, Agent>(`/agents/${id}`)
  },
  create(data: CreateAgentRequest) {
    return client.post<any, Agent>('/agents', data)
  },
  update(id: string, data: Partial<CreateAgentRequest>) {
    return client.put<any, Agent>(`/agents/${id}`, data)
  },
  delete(id: string) {
    return client.delete(`/agents/${id}`)
  },
}
```

```typescript
// frontend/src/api/knowledge.ts
import client from './client'
import type { PaginatedResponse } from '@/types/api'

export interface KnowledgeBase {
  id: string
  name: string
  description: string
  document_count: number
  indexing_status: string
  created_at: string
}

export interface Document {
  id: string
  filename: string
  file_type: string
  chunk_count: number
  indexing_status: string
  created_at: string
}

export const knowledgeApi = {
  list(page = 1, size = 20) {
    return client.get<any, PaginatedResponse<KnowledgeBase>>('/knowledge', { params: { page, size } })
  },
  get(id: string) {
    return client.get<any, KnowledgeBase>(`/knowledge/${id}`)
  },
  create(data: { name: string; description?: string }) {
    return client.post<any, KnowledgeBase>('/knowledge', data)
  },
  delete(id: string) {
    return client.delete(`/knowledge/${id}`)
  },
  uploadDocument(kbId: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return client.post<any, Document>(`/knowledge/${kbId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  listDocuments(kbId: string) {
    return client.get<any, Document[]>(`/knowledge/${kbId}/documents`)
  },
}
```

**要点**：
- API 模块按业务域拆分，每个文件职责单一，方便维护
- `client.get<any, T>` 的第二个泛型参数是响应数据类型，让调用方获得类型提示
- 常见错误：在组件里直接写 `axios.get('/api/xxx')`，绕过了统一的错误处理和 token 注入

### 练习 2

**思路**：用 Pinia 的组合式 API（`defineStore` + `setup` 函数）创建 Store，`useUserStore` 管理登录状态和 token，`useAgentStore` 管理 Agent 列表。

**答案**：

```typescript
// frontend/src/stores/user.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import type { User } from '@/types/api'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const isLoggedIn = computed(() => !!token.value)

  async function login(email: string, password: string) {
    const res = await authApi.login({ email, password })
    token.value = res.access_token
    localStorage.setItem('token', res.access_token)
    await fetchUser()
  }

  async function fetchUser() {
    user.value = await authApi.getCurrentUser()
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  return { user, token, isLoggedIn, login, fetchUser, logout }
})
```

```typescript
// frontend/src/stores/agent.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { agentApi } from '@/api/agent'
import type { Agent } from '@/types/api'

export const useAgentStore = defineStore('agent', () => {
  const agents = ref<Agent[]>([])
  const currentAgent = ref<Agent | null>(null)
  const isLoading = ref(false)

  async function loadAgents() {
    isLoading.value = true
    try {
      const res = await agentApi.list()
      agents.value = res.items
    } finally {
      isLoading.value = false
    }
  }

  async function loadAgent(id: string) {
    currentAgent.value = await agentApi.get(id)
  }

  async function createAgent(data: { name: string; system_prompt: string }) {
    const agent = await agentApi.create(data)
    agents.value.unshift(agent)
    return agent
  }

  async function deleteAgent(id: string) {
    await agentApi.delete(id)
    agents.value = agents.value.filter(a => a.id !== id)
  }

  return { agents, currentAgent, isLoading, loadAgents, loadAgent, createAgent, deleteAgent }
})
```

**要点**：
- `token` 存在 `localStorage` 中实现持久化，页面刷新后不会丢失登录状态
- Store 只放全局共享状态，组件局部状态（如表单输入）用 `ref` 即可
- 常见错误：在 Store 里直接操作 DOM 或使用 `useMessage` 等 UI 组件的 composable，Store 应该只管数据逻辑

### 练习 3

**思路**：创建 Login.vue 和 Chat.vue 两个页面组件，使用 Naive UI 组件库，用 mock 数据填充，实现基本交互。

**答案**：

```vue
<!-- frontend/src/views/Login.vue -->
<template>
  <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #f5f5f5">
    <n-card title="登录" style="width: 400px">
      <n-form ref="formRef" :model="formData" :rules="rules">
        <n-form-item path="email" label="邮箱">
          <n-input v-model:value="formData.email" placeholder="请输入邮箱" />
        </n-form-item>
        <n-form-item path="password" label="密码">
          <n-input v-model:value="formData.password" type="password" placeholder="请输入密码" show-password-on="click" />
        </n-form-item>
        <n-button type="primary" block :loading="loading" @click="handleLogin">
          登录
        </n-button>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'

const router = useRouter()
const message = useMessage()
const formRef = ref<FormInst | null>(null)
const loading = ref(false)

const formData = reactive({
  email: '',
  password: '',
})

const rules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 位', trigger: 'blur' },
  ],
}

async function handleLogin() {
  try {
    await formRef.value?.validate()
    loading.value = true
    // mock 登录成功
    localStorage.setItem('token', 'mock-token')
    message.success('登录成功')
    router.push('/')
  } catch {
    message.error('请检查输入')
  } finally {
    loading.value = false
  }
}
</script>
```

```vue
<!-- frontend/src/views/Chat.vue -->
<template>
  <n-layout has-sider style="height: 100vh">
    <n-layout-sider bordered :width="280">
      <div style="padding: 16px">
        <n-button type="primary" block @click="createSession">新建对话</n-button>
      </div>
      <n-list hoverable clickable>
        <n-list-item v-for="s in mockSessions" :key="s.id" @click="selectSession(s.id)">
          <n-thing :title="s.title" :description="s.updated_at" />
        </n-list-item>
      </n-list>
    </n-layout-sider>
    <n-layout>
      <n-layout-content content-style="padding: 24px; display: flex; flex-direction: column; height: calc(100vh - 56px);">
        <div style="flex: 1; overflow-y: auto; margin-bottom: 16px">
          <div v-for="msg in messages" :key="msg.id" :style="{ textAlign: msg.role === 'user' ? 'right' : 'left', marginBottom: 12 }">
            <n-tag :type="msg.role === 'user' ? 'info' : 'success'">{{ msg.content }}</n-tag>
          </div>
        </div>
        <n-space>
          <n-input v-model:value="inputText" placeholder="输入消息..." @keydown.enter="handleSend" style="width: 400px" />
          <n-button type="primary" :disabled="!inputText.trim()" @click="handleSend">发送</n-button>
        </n-space>
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const inputText = ref('')
const messages = ref([
  { id: '1', role: 'user', content: '你好' },
  { id: '2', role: 'assistant', content: '你好！有什么可以帮助你的？' },
])
const mockSessions = [
  { id: '1', title: '新对话', updated_at: '2025-01-01 12:00' },
  { id: '2', title: '销售数据分析', updated_at: '2025-01-01 11:00' },
]

function handleSend() {
  if (!inputText.value.trim()) return
  messages.value.push({ id: String(Date.now()), role: 'user', content: inputText.value })
  inputText.value = ''
}

function createSession() {
  messages.value = []
}

function selectSession(id: string) {
  console.log('selected session', id)
}
</script>
```

**要点**：
- 登录页用 Naive UI 的 `n-form` 配合 `FormRules` 做表单校验，比手写校验逻辑更可靠
- 对话页的侧边栏 + 消息列表布局是 AI 对话应用的标准模式
- 常见错误：表单校验只在前端做，后端也必须校验，前端校验可以绕过

## 本节要点

- Vue 3 组合式 API + TypeScript = 企业级前端的标准配置
- Pinia 比 Vuex 更简洁，是 Vue 3 的官方推荐状态管理
- API 调用封装 + 类型定义 = 前后端协作效率翻倍
- Naive UI 自动导入让开发体验更流畅

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| Naive UI 组件不生效 | 没配置自动导入或手动注册 | 检查 `unplugin-vue-components` 配置 |
| 路由守卫不生效 | `meta.requiresAuth` 拼写错误 | 检查路由配置和守卫逻辑 |
| TypeScript 报错 `any` | 没有定义类型 | 创建 `types/api.ts` 并导入 |
| 热更新不工作 | Vite 配置错误 | 检查 `vite.config.ts` 的 proxy 配置 |

## 工程建议

- API 调用层要集中管理，不要在组件里直接写 `axios.get`，方便统一处理错误、token、超时
- Pinia Store 只放全局共享状态，组件局部状态用 `ref`/`reactive` 即可，不要过度使用全局状态
- TypeScript 的 `strict` 模式建议从项目第一天开启，后期补类型定义成本极高
- Naive UI 等组件库用自动导入（unplugin-vue-components）减少手动注册的样板代码
- 前端路由守卫要在项目初期就配好，避免后期遗漏权限检查
