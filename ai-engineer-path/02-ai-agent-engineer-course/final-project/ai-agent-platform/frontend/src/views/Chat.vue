<template>
  <div class="chat-page">
    <div class="sidebar">
      <n-button type="primary" block @click="createNewSession" :disabled="!inputText.trim()">新建对话</n-button>
      <n-list hoverable clickable style="margin-top: 12px;">
        <n-list-item v-for="s in chatStore.sessions" :key="s.id" :class="{ active: s.id === chatStore.currentSessionId }" @click="selectSession(s.id)">
          <n-thing :title="s.title" :description="new Date(s.updated_at).toLocaleString('zh-CN')" />
        </n-list-item>
      </n-list>
    </div>

    <div class="main">
      <div class="messages" ref="messagesRef">
        <div v-for="msg in chatStore.messages" :key="msg.id" :class="['msg', msg.role]">
          <n-avatar v-if="msg.role === 'assistant'" round size="small" style="background: #18a058;">AI</n-avatar>
          <div class="bubble">
            <div>{{ msg.content }}</div>
            <div v-if="msg.model" class="meta">
              <n-tag size="tiny" type="info">{{ msg.model }}</n-tag>
              <span v-if="msg.input_tokens">{{ msg.input_tokens + msg.output_tokens }} tokens</span>
              <span v-if="msg.latency_ms">{{ msg.latency_ms }}ms</span>
            </div>
          </div>
          <n-avatar v-if="msg.role === 'user'" round size="small" style="background: #2080f0;">U</n-avatar>
        </div>
      </div>

      <div class="input-area">
        <n-input v-model:value="inputText" type="textarea" :rows="3" placeholder="输入消息... (Enter 发送)" :disabled="chatStore.isSending" @keydown.enter.exact.prevent="handleSend" />
        <n-button type="primary" :loading="chatStore.isSending" :disabled="!inputText.trim()" @click="handleSend" style="margin-top: 8px;">发送</n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '@/stores'
import { useMessage } from 'naive-ui'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const message = useMessage()
const inputText = ref('')
const messagesRef = ref<HTMLElement>()

onMounted(() => {
  chatStore.loadSessions()
  if (route.params.sessionId) chatStore.loadMessages(route.params.sessionId as string)
})

watch(() => chatStore.messages.length, () => {
  nextTick(() => { if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight })
})

async function createNewSession() {
  if (!inputText.value.trim()) return
  try {
    await chatStore.createSession(inputText.value)
    inputText.value = ''
    router.push(`/chat/${chatStore.currentSessionId}`)
  } catch (e) { message.error('创建失败') }
}

async function handleSend() {
  if (!inputText.value.trim()) return
  if (!chatStore.currentSessionId) { await createNewSession(); return }
  const text = inputText.value
  inputText.value = ''
  try { await chatStore.sendMessage(text) } catch (e) { message.error('发送失败') }
}

function selectSession(id: string) {
  chatStore.loadMessages(id)
  router.push(`/chat/${id}`)
}
</script>

<style scoped>
.chat-page { display: flex; height: 100%; }
.sidebar { width: 280px; padding: 16px; border-right: 1px solid #eee; overflow-y: auto; }
.main { flex: 1; display: flex; flex-direction: column; }
.messages { flex: 1; overflow-y: auto; padding: 24px; }
.msg { display: flex; gap: 8px; margin-bottom: 16px; }
.msg.user { justify-content: flex-end; }
.bubble { max-width: 70%; padding: 12px 16px; border-radius: 12px; background: #f0f0f0; }
.msg.user .bubble { background: #18a058; color: white; }
.meta { margin-top: 8px; font-size: 12px; color: #999; display: flex; gap: 8px; }
.input-area { padding: 16px; border-top: 1px solid #eee; }
.active { background: #f0faf0; }
</style>
