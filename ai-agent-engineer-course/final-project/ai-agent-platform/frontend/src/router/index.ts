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
        { path: 'chat', name: 'Chat', component: () => import('@/views/Chat.vue') },
        { path: 'chat/:sessionId', name: 'ChatSession', component: () => import('@/views/Chat.vue') },
        { path: 'agents', name: 'Agents', component: () => import('@/views/Agents.vue') },
        { path: 'knowledge', name: 'Knowledge', component: () => import('@/views/Knowledge.vue') },
        { path: 'workflows', name: 'Workflows', component: () => import('@/views/Workflows.vue') },
        { path: 'skills', name: 'Skills', component: () => import('@/views/Skills.vue') },
        { path: 'settings', name: 'Settings', component: () => import('@/views/Settings.vue') },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    return { name: 'Login' }
  }
})

export default router
