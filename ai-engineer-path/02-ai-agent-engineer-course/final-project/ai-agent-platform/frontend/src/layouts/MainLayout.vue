<template>
  <n-layout has-sider style="height: 100vh">
    <n-layout-sider bordered :width="240" :collapsed="collapsed" show-trigger @collapse="collapsed = true" @expand="collapsed = false">
      <div class="logo" :class="{ collapsed }">
        <span v-if="!collapsed">AI Agent Platform</span>
        <span v-else>AI</span>
      </div>
      <n-menu :collapsed="collapsed" :options="menuOptions" :value="activeKey" @update:value="onMenuSelect" />
    </n-layout-sider>
    <n-layout>
      <n-layout-header bordered style="height: 56px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-weight: 600;">{{ currentTitle }}</span>
        <n-space align="center">
          <span>{{ userStore.username }}</span>
          <n-button size="small" @click="handleLogout">退出</n-button>
        </n-space>
      </n-layout-header>
      <n-layout-content content-style="height: calc(100vh - 56px); overflow: auto;">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NIcon } from 'naive-ui'
import { ChatbubbleOutline, PersonOutline, LibraryOutline, GitNetworkOutline, ExtensionPuzzleOutline, SettingsOutline } from '@vicons/ionicons5'
import { useUserStore } from '@/stores'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const collapsed = ref(false)

const menuOptions = [
  { label: '对话', key: 'chat', icon: () => h(NIcon, null, { default: () => h(ChatbubbleOutline) }) },
  { label: 'Agent 管理', key: 'agents', icon: () => h(NIcon, null, { default: () => h(PersonOutline) }) },
  { label: '知识库', key: 'knowledge', icon: () => h(NIcon, null, { default: () => h(LibraryOutline) }) },
  { label: '工作流', key: 'workflows', icon: () => h(NIcon, null, { default: () => h(GitNetworkOutline) }) },
  { label: 'Skill 市场', key: 'skills', icon: () => h(NIcon, null, { default: () => h(ExtensionPuzzleOutline) }) },
  { label: '设置', key: 'settings', icon: () => h(NIcon, null, { default: () => h(SettingsOutline) }) },
]

const activeKey = computed(() => route.path.split('/')[1] || 'chat')
const currentTitle = computed(() => {
  const map: Record<string, string> = { chat: '对话', agents: 'Agent 管理', knowledge: '知识库', workflows: '工作流', skills: 'Skill 市场', settings: '设置' }
  return map[activeKey.value] || '首页'
})

function onMenuSelect(key: string) { router.push(`/${key}`) }
function handleLogout() { userStore.logout(); router.push('/login') }
</script>

<style scoped>
.logo { padding: 20px 24px; font-size: 18px; font-weight: 700; text-align: center; }
.logo.collapsed { padding: 20px 0; }
</style>
