<template>
  <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f5f5;">
    <n-card style="width: 400px;">
      <n-tabs v-model:value="tab" animated>
        <n-tab-pane name="login" tab="登录">
          <n-form ref="loginForm" :model="loginData" style="margin-top: 16px;">
            <n-form-item label="邮箱" path="email">
              <n-input v-model:value="loginData.email" placeholder="请输入邮箱" />
            </n-form-item>
            <n-form-item label="密码" path="password">
              <n-input v-model:value="loginData.password" type="password" placeholder="请输入密码" @keydown.enter="handleLogin" />
            </n-form-item>
            <n-button type="primary" block :loading="loading" @click="handleLogin">登录</n-button>
          </n-form>
        </n-tab-pane>
        <n-tab-pane name="register" tab="注册">
          <n-form :model="registerData" style="margin-top: 16px;">
            <n-form-item label="邮箱">
              <n-input v-model:value="registerData.email" placeholder="请输入邮箱" />
            </n-form-item>
            <n-form-item label="用户名">
              <n-input v-model:value="registerData.username" placeholder="请输入用户名" />
            </n-form-item>
            <n-form-item label="密码">
              <n-input v-model:value="registerData.password" type="password" placeholder="请输入密码" @keydown.enter="handleRegister" />
            </n-form-item>
            <n-button type="primary" block :loading="loading" @click="handleRegister">注册</n-button>
          </n-form>
        </n-tab-pane>
      </n-tabs>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useUserStore } from '@/stores'
import { authApi } from '@/api'

const router = useRouter()
const message = useMessage()
const userStore = useUserStore()
const tab = ref('login')
const loading = ref(false)

const loginData = ref({ email: '', password: '' })
const registerData = ref({ email: '', username: '', password: '' })

async function handleLogin() {
  loading.value = true
  try {
    await userStore.login(loginData.value.email, loginData.value.password)
    message.success('登录成功')
    router.push('/')
  } catch (e: any) {
    message.error(e.response?.data?.detail || '登录失败')
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  loading.value = true
  try {
    await authApi.register(registerData.value.email, registerData.value.username, registerData.value.password)
    message.success('注册成功，请登录')
    tab.value = 'login'
    loginData.value.email = registerData.value.email
    loginData.value.password = registerData.value.password
  } catch (e: any) {
    message.error(e.response?.data?.detail || '注册失败')
  } finally {
    loading.value = false
  }
}
</script>
