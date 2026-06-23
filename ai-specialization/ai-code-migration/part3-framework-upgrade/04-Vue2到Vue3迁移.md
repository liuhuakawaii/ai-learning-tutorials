# 第四课：Vue 2 到 Vue 3 迁移——组件架构的范式升级

## 场景引入

你的团队用 Vue 2 + Vuex + Vue Router 3 构建了一个企业级后台管理系统，经过两年迭代，已有 200 多个组件、15 个 Vuex 模块。系统运行稳定，但 Vue 2 已于 2023 年 12 月 31 日正式 EOL（End of Life），不再接收安全补丁。

你想迁移到 Vue 3，但面对的不只是 API 变化。Vue 3 用 Composition API 替代 Options API 作为主要编程范式，用 `reactive`/`ref` 替代 `data` 函数，用 `Pinia` 替代 `Vuex`，模板语法有若干不兼容变化，甚至虚拟 DOM 的实现都从 Object-based 换成了 Compiler-optimized。

更棘手的是，你的项目依赖了 `vue-element-admin` 中的十几个组件，以及 `vuedraggable`、`vue-quill-editor` 等第三方 Vue 2 插件——它们在 Vue 3 下全部无法运行。

本课讲的是如何在保持业务连续性的前提下，系统地把 Vue 2 项目迁移到 Vue 3，包括组件重写、状态管理迁移、路由升级、第三方库替换的完整路径。

## 学习目标

完成本课学习后，你将能够：

1. 理解 Vue 2 和 Vue 3 的核心架构差异
2. 将 Options API 组件转换为 Composition API
3. 将 Vuex 状态管理迁移到 Pinia
4. 处理 Vue Router 3 到 4 的 API 变化
5. 解决第三方 Vue 2 插件的兼容问题
6. 使用 Vue 2.7 和 `@vue/compat` 实现渐进式迁移

## 核心概念

### 一、为什么 Vue 3 是一次架构重构

Vue 3 不是简单的 API 升级，而是从编译器到运行时的全面重构。理解这些变化的本质有助于判断迁移的优先级。

```
Vue 2 → Vue 3 架构变化全景：

┌─────────────────────────────────────────────────────────┐
│                     Vue 2 架构                           │
│  Options API → Template Compiler → Virtual DOM → Patch  │
│  Vuex 4 → Vue Router 3 → Vue CLI                       │
├─────────────────────────────────────────────────────────┤
│                     Vue 3 架构                           │
│  Composition API → Compiler + Vite → optimized VNode    │
│  Pinia → Vue Router 4 → Vite                           │
│  + Teleport + Suspense + Fragments                      │
└─────────────────────────────────────────────────────────┘

关键架构变化：
  1. Options API → Composition API（逻辑组织方式的根本改变）
  2. Virtual DOM 重写（静态提升 + Patch Flag 优化）
  3. Proxy 替代 Object.defineProperty（响应式系统重写）
  4. Tree-shaking 支持（按需引入 API）
  5. TypeScript 原生支持（源码用 TS 重写）
```

### 二、Options API 与 Composition API 的映射

Options API 按选项类型组织代码（data、methods、computed、watch），Composition API 按逻辑关注点组织代码。

```
Options API 的代码组织：
┌──────────────────────────────────────┐
│ export default {                     │
│   data() { ... }          ← 状态     │
│   computed: { ... }       ← 计算     │
│   methods: { ... }        ← 方法     │
│   watch: { ... }          ← 监听     │
│   mounted() { ... }       ← 生命周期  │
│ }                                    │
└──────────────────────────────────────┘
  问题：同一功能的代码分散在不同选项中

Composition API 的代码组织：
┌──────────────────────────────────────┐
│ // 搜索功能                          │
│ const keyword = ref('')              │
│ const results = computed(...)        │
│ function search() { ... }            │
│ watch(keyword, ...)                  │
│                                      │
│ // 分页功能                          │
│ const page = ref(1)                  │
│ const paged = computed(...)          │
│ function nextPage() { ... }          │
└──────────────────────────────────────┘
  优势：相关逻辑聚合在一起，可提取为 composable
```

### 三、响应式系统的根本变化

Vue 2 用 `Object.defineProperty` 拦截属性的 getter/setter，Vue 3 用 `Proxy` 代理整个对象。这不是内部优化，它改变了响应式的行为边界。

```
Object.defineProperty（Vue 2）：
  ✓ 能检测：属性的读取和赋值
  ✗ 不能检测：新增属性（需要 Vue.set）
  ✗ 不能检测：删除属性（需要 Vue.delete）
  ✗ 不能检测：数组下标赋值
  ✗ 不能检测：数组长度修改

Proxy（Vue 3）：
  ✓ 能检测：所有属性操作（包括新增、删除）
  ✓ 能检测：数组所有操作
  ✓ 能检测：Map、Set 的操作
  ✗ 不能检测：基本类型的值（需要用 ref 包装）
```

### 四、模板语法的不兼容变化

Vue 3 的模板编译器做了若干不兼容变更，直接影响现有模板代码。

| 变化点 | Vue 2 | Vue 3 |
|--------|-------|-------|
| 根节点 | 必须单根节点 | 支持多根节点（Fragments） |
| `v-model` | `value` + `input` | `modelValue` + `update:modelValue` |
| `v-for` + `v-if` | `v-if` 优先级高 | `v-for` 优先级高 |
| 事件修饰符 | `@click.native` | `emits` 选项声明 |
| 生命周期 | `beforeDestroy` | `beforeUnmount` |
| 插槽 | `slot` + `slot-scope` | `v-slot` 统一语法 |

### 五、渐进式迁移路径

Vue 官方提供了 `@vue/compat` 兼容包，让 Vue 3 运行 Vue 2 风格的代码，并对不兼容用法发出警告。

```
推荐迁移路径：

阶段 1：升级基础设施
  Vue CLI → Vite（可选但推荐）
  Vue 2.x → Vue 2.7（内置 Composition API）
  Webpack 4 → Webpack 5（如不迁移 Vite）

阶段 2：引入兼容层
  安装 @vue/compat
  配置 compat mode（运行时警告）
  逐步修复警告

阶段 3：状态管理迁移
  Vuex → Pinia（可以共存）
  逐个模块迁移

阶段 4：组件迁移
  新组件用 Composition API
  旧组件逐步重写
  第三方库替换

阶段 5：清理
  移除 @vue/compat
  移除 Vue 2 遗留代码
  完善 TypeScript 类型
```

## 完整代码示例

### 示例一：Options API 到 Composition API

**迁移前：Vue 2 Options API**

```vue
<!-- UserList.vue - Vue 2 -->
<template>
  <div class="user-list">
    <input 
      v-model="searchKeyword" 
      placeholder="搜索用户..."
      @input="debouncedSearch"
    />
    <div v-if="loading" class="loading">加载中...</div>
    <ul v-else>
      <li 
        v-for="user in filteredUsers" 
        :key="user.id"
        :class="{ active: selectedId === user.id }"
        @click="selectUser(user)"
      >
        {{ user.name }} - {{ user.email }}
      </li>
    </ul>
    <div class="pagination">
      <button @click="prevPage" :disabled="page <= 1">上一页</button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button @click="nextPage" :disabled="page >= totalPages">下一页</button>
    </div>
  </div>
</template>

<script>
import { debounce } from 'lodash-es'
import { fetchUsers } from '@/api/user'

export default {
  name: 'UserList',
  
  props: {
    role: { type: String, default: 'all' }
  },
  
  data() {
    return {
      users: [],
      searchKeyword: '',
      loading: false,
      page: 1,
      pageSize: 20,
      total: 0,
      selectedId: null,
    }
  },
  
  computed: {
    filteredUsers() {
      if (!this.searchKeyword) return this.users
      const keyword = this.searchKeyword.toLowerCase()
      return this.users.filter(u => 
        u.name.toLowerCase().includes(keyword) ||
        u.email.toLowerCase().includes(keyword)
      )
    },
    totalPages() {
      return Math.ceil(this.total / this.pageSize)
    },
  },
  
  watch: {
    role() {
      this.page = 1
      this.loadUsers()
    },
    page() {
      this.loadUsers()
    },
  },
  
  created() {
    this.debouncedSearch = debounce(this.handleSearch, 300)
    this.loadUsers()
  },
  
  beforeDestroy() {
    this.debouncedSearch.cancel()
  },
  
  methods: {
    async loadUsers() {
      this.loading = true
      try {
        const res = await fetchUsers({
          role: this.role,
          page: this.page,
          pageSize: this.pageSize,
        })
        this.users = res.data
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    
    handleSearch() {
      this.page = 1
      this.loadUsers()
    },
    
    selectUser(user) {
      this.selectedId = user.id
      this.$emit('select', user)
    },
    
    prevPage() {
      if (this.page > 1) this.page--
    },
    
    nextPage() {
      if (this.page < this.totalPages) this.page++
    },
  },
}
</script>
```

**迁移后：Vue 3 Composition API + `<script setup>`**

```vue
<!-- UserList.vue - Vue 3 -->
<template>
  <div class="user-list">
    <input 
      v-model="searchKeyword" 
      placeholder="搜索用户..."
    />
    <div v-if="loading" class="loading">加载中...</div>
    <ul v-else>
      <li 
        v-for="user in filteredUsers" 
        :key="user.id"
        :class="{ active: selectedId === user.id }"
        @click="selectUser(user)"
      >
        {{ user.name }} - {{ user.email }}
      </li>
    </ul>
    <div class="pagination">
      <button :disabled="page <= 1" @click="page--">上一页</button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button :disabled="page >= totalPages" @click="page++">下一页</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { debounce } from 'lodash-es'
import { fetchUsers } from '@/api/user'

const props = defineProps({
  role: { type: String, default: 'all' },
})

const emit = defineEmits(['select'])

const users = ref([])
const searchKeyword = ref('')
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const total = ref(0)
const selectedId = ref(null)

const filteredUsers = computed(() => {
  if (!searchKeyword.value) return users.value
  const keyword = searchKeyword.value.toLowerCase()
  return users.value.filter(u =>
    u.name.toLowerCase().includes(keyword) ||
    u.email.toLowerCase().includes(keyword)
  )
})

const totalPages = computed(() => Math.ceil(total.value / pageSize))

async function loadUsers() {
  loading.value = true
  try {
    const res = await fetchUsers({
      role: props.role,
      page: page.value,
      pageSize,
    })
    users.value = res.data
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const debouncedSearch = debounce(() => {
  page.value = 1
  loadUsers()
}, 300)

watch(searchKeyword, debouncedSearch)
watch(() => props.role, () => {
  page.value = 1
  loadUsers()
})
watch(page, loadUsers)

function selectUser(user) {
  selectedId.value = user.id
  emit('select', user)
}

loadUsers()

onBeforeUnmount(() => {
  debouncedSearch.cancel()
})
</script>
```

### 示例二：提取可复用的 Composable

```javascript
// composables/usePagination.js
import { ref, computed, watch } from 'vue'

export function usePagination(fetchFn, { defaultPageSize = 20 } = {}) {
  const items = ref([])
  const loading = ref(false)
  const page = ref(1)
  const total = ref(0)
  const error = ref(null)

  const totalPages = computed(() => 
    Math.ceil(total.value / defaultPageSize)
  )

  async function load(params = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await fetchFn({
        page: page.value,
        pageSize: defaultPageSize,
        ...params,
      })
      items.value = res.data
      total.value = res.total
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  function goToPage(p) {
    if (p >= 1 && p <= totalPages.value) {
      page.value = p
    }
  }

  return {
    items,
    loading,
    page,
    total,
    error,
    totalPages,
    load,
    goToPage,
    nextPage: () => goToPage(page.value + 1),
    prevPage: () => goToPage(page.value - 1),
  }
}
```

### 示例三：Vuex 到 Pinia 迁移

**迁移前：Vuex 模块**

```javascript
// store/modules/user.js - Vuex
const state = () => ({
  currentUser: null,
  userList: [],
  permissions: [],
  loginLoading: false,
})

const getters = {
  isLoggedIn: (state) => !!state.currentUser,
  userName: (state) => state.currentUser?.name || '',
  hasPermission: (state) => (permission) => {
    return state.permissions.includes(permission)
  },
}

const mutations = {
  SET_USER(state, user) {
    state.currentUser = user
  },
  SET_USER_LIST(state, list) {
    state.userList = list
  },
  SET_PERMISSIONS(state, permissions) {
    state.permissions = permissions
  },
  SET_LOGIN_LOADING(state, loading) {
    state.loginLoading = loading
  },
}

const actions = {
  async login({ commit }, credentials) {
    commit('SET_LOGIN_LOADING', true)
    try {
      const user = await authApi.login(credentials)
      commit('SET_USER', user)
      commit('SET_PERMISSIONS', user.permissions)
      return user
    } finally {
      commit('SET_LOGIN_LOADING', false)
    }
  },
  
  async fetchUserList({ commit }, params) {
    const res = await userApi.list(params)
    commit('SET_USER_LIST', res.data)
    return res
  },
  
  logout({ commit }) {
    authApi.logout()
    commit('SET_USER', null)
    commit('SET_PERMISSIONS', [])
  },
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
}
```

```javascript
// store/index.js - Vuex 根 store
import Vue from 'vue'
import Vuex from 'vuex'
import user from './modules/user'

Vue.use(Vuex)

export default new Vuex.Store({
  modules: { user },
})
```

**迁移后：Pinia**

```javascript
// stores/user.js - Pinia
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import { userApi } from '@/api/user'

export const useUserStore = defineStore('user', () => {
  const currentUser = ref(null)
  const userList = ref([])
  const permissions = ref([])
  const loginLoading = ref(false)

  const isLoggedIn = computed(() => !!currentUser.value)
  const userName = computed(() => currentUser.value?.name || '')

  function hasPermission(permission) {
    return permissions.value.includes(permission)
  }

  async function login(credentials) {
    loginLoading.value = true
    try {
      const user = await authApi.login(credentials)
      currentUser.value = user
      permissions.value = user.permissions
      return user
    } finally {
      loginLoading.value = false
    }
  }

  async function fetchUserList(params) {
    const res = await userApi.list(params)
    userList.value = res.data
    return res
  }

  function logout() {
    authApi.logout()
    currentUser.value = null
    permissions.value = []
  }

  return {
    currentUser,
    userList,
    permissions,
    loginLoading,
    isLoggedIn,
    userName,
    hasPermission,
    login,
    fetchUserList,
    logout,
  }
})
```

Pinia 的优势：没有 mutations（直接修改 state）、完整的 TypeScript 类型推断、多个 store 之间可以互相引用、不需要命名空间（每个 store 本身就是独立模块）。

### 示例四：Vue Router 3 到 4 的迁移

**迁移前：Vue Router 3**

```javascript
// router/index.js - Vue Router 3
import Vue from 'vue'
import VueRouter from 'vue-router'
import store from '@/store'

Vue.use(VueRouter)

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { guest: true },
  },
  {
    path: '/dashboard',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
      },
    ],
  },
  {
    path: '/user/:id',
    name: 'UserProfile',
    component: () => import('@/views/UserProfile.vue'),
    props: true,
  },
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes,
})

router.beforeEach((to, from, next) => {
  const isLoggedIn = store.getters['user/isLoggedIn']
  if (to.meta.guest) {
    next(isLoggedIn ? '/dashboard' : undefined)
  } else if (!isLoggedIn) {
    next('/login')
  } else {
    next()
  }
})

export default router
```

**迁移后：Vue Router 4**

```javascript
// router/index.js - Vue Router 4
import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { guest: true },
  },
  {
    path: '/dashboard',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
      },
    ],
  },
  {
    path: '/user/:id',
    name: 'UserProfile',
    component: () => import('@/views/UserProfile.vue'),
    props: true,
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  const userStore = useUserStore()
  if (to.meta.guest) {
    return userStore.isLoggedIn ? '/dashboard' : true
  }
  if (!userStore.isLoggedIn) {
    return '/login'
  }
  return true
})

export default router
```

关键变化：`new VueRouter()` → `createRouter()`；`mode: 'history'` → `createWebHistory()`；导航守卫不再需要 `next()` 回调，直接 return 即可；`import.meta.env.BASE_URL` 替代 `process.env.BASE_URL`。

### 示例五：第三方库替换方案

```
常见 Vue 2 插件的 Vue 3 替代方案：

┌─────────────────────────┬───────────────────────────────┐
│   Vue 2 插件              │   Vue 3 替代                   │
├─────────────────────────┼───────────────────────────────┤
│ vue-element-admin 组件   │ Element Plus                  │
│ Vue.use(ElementUI)       │ app.use(ElementPlus)          │
├─────────────────────────┼───────────────────────────────┤
│ vuedraggable (Vue 2)    │ vue.draggable.next            │
│ 或 SortableJS 直接使用   │                               │
├─────────────────────────┼───────────────────────────────┤
│ vue-quill-editor         │ @vueup/vue-quill              │
├─────────────────────────┼───────────────────────────────┤
│ vue-i18n v8              │ vue-i18n v9+                  │
├─────────────────────────┼───────────────────────────────┤
│ Vuex 3/4                 │ Pinia                         │
├─────────────────────────┼───────────────────────────────┤
│ vue-chartjs v3           │ vue-chartjs v5                │
├─────────────────────────┼───────────────────────────────┤
│ Nuxt 2                   │ Nuxt 3                        │
└─────────────────────────┴───────────────────────────────┘
```

## 常见误区

### 误区一：先迁移到 Composition API 再升级 Vue 版本

Vue 2.7 已经内置了 Composition API 支持。正确做法是在 Vue 2.7 下先用 Composition API 重写组件，确认无误后再升级到 Vue 3。这样每次只处理一个变化源（API 风格或框架版本），出问题时更容易定位。

### 误区二：一次性重写所有组件

200 个组件不可能一次重写完成。正确做法是新组件用 Composition API，旧组件保持原样。当某个旧组件需要修改时，借机重写。`@vue/compat` 允许两种风格共存。

### 误区三：忽略 v-model 的双向绑定变化

Vue 3 的 `v-model` 用 `modelValue` 替代了 `value`，用 `update:modelValue` 替代了 `input` 事件。如果项目中有大量自定义组件使用 `v-model`，这些全部需要修改。特别是封装了表单组件的项目，影响面很大。

### 误区四：认为 Proxy 响应式没有限制

Vue 3 的 Proxy 不能代理基本类型，所以 `ref()` 包装是必须的。而且 Proxy 有浏览器兼容性要求——不支持 IE11。如果你的项目需要支持 IE11，Vue 3 不是合适的选择。

### 误区五：直接替换生命周期钩子名称

`beforeDestroy` → `beforeUnmount`、`destroyed` → `unmounted`，这些容易忘。更隐蔽的是 `beforeCreate` 和 `created` 在 `<script setup>` 中不再需要——setup 本身就替代了这两个钩子。

## 小结

Vue 2 到 Vue 3 迁移的关键路径：

1. **升级到 Vue 2.7**，在 Vue 2 下引入 Composition API
2. **安装 `@vue/compat`**，在 Vue 3 兼容模式下运行
3. **迁移状态管理**，Vuex → Pinia（可共存）
4. **替换第三方库**，找到 Vue 3 兼容版本
5. **逐步重写组件**，Options API → Composition API
6. **移除兼容层**，完成全面切换

## 练习

### 练习一：组件迁移

将以下 Vue 2 Options API 组件迁移为 Vue 3 Composition API（`<script setup>` 语法）：

```vue
<template>
  <div>
    <button @click="count++">点击次数: {{ count }}</button>
    <p>双倍: {{ doubleCount }}</p>
    <button @click="reset">重置</button>
  </div>
</template>

<script>
export default {
  data() {
    return { count: 0 }
  },
  computed: {
    doubleCount() {
      return this.count * 2
    },
  },
  methods: {
    reset() {
      this.count = 0
    },
  },
  watch: {
    count(newVal) {
      console.log('count changed:', newVal)
    },
  },
}
</script>
```

### 练习二：Vuex 到 Pinia

将以下 Vuex store 迁移为 Pinia store：

```javascript
// Vuex
const cartModule = {
  namespaced: true,
  state: () => ({
    items: [],
  }),
  getters: {
    totalPrice: (state) => state.items.reduce((sum, i) => sum + i.price * i.qty, 0),
    itemCount: (state) => state.items.reduce((sum, i) => sum + i.qty, 0),
  },
  mutations: {
    ADD_ITEM(state, product) {
      const existing = state.items.find(i => i.id === product.id)
      if (existing) {
        existing.qty++
      } else {
        state.items.push({ ...product, qty: 1 })
      }
    },
    REMOVE_ITEM(state, productId) {
      state.items = state.items.filter(i => i.id !== productId)
    },
  },
  actions: {
    addToCart({ commit }, product) {
      commit('ADD_ITEM', product)
    },
    removeFromCart({ commit }, productId) {
      commit('REMOVE_ITEM', productId)
    },
  },
}
```

---

## 参考答案

### 练习一

**思路**：将 `data` 转为 `ref`，`computed` 转为 `computed()` 函数，`methods` 转为普通函数，`watch` 转为 `watch()` 函数。

**答案**：

```vue
<template>
  <div>
    <button @click="count++">点击次数: {{ count }}</button>
    <p>双倍: {{ doubleCount }}</p>
    <button @click="reset">重置</button>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const count = ref(0)

const doubleCount = computed(() => count.value * 2)

watch(count, (newVal) => {
  console.log('count changed:', newVal)
})

function reset() {
  count.value = 0
}
</script>
```

**要点**：
- `<script setup>` 中不需要 `export default`，不需要 `methods`、`computed` 选项
- `ref` 包装的基本类型在模板中自动解包（不需要 `.value`），在 JS 中需要 `.value`
- `watch` 的第一个参数可以是 ref（直接传入）或 getter 函数

### 练习二

**思路**：使用 `defineStore` 的 Setup 语法（推荐），直接用 `ref`/`computed` 定义状态。

**答案**：

```javascript
// stores/cart.js - Pinia
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCartStore = defineStore('cart', () => {
  const items = ref([])

  const totalPrice = computed(() =>
    items.value.reduce((sum, item) => sum + item.price * item.qty, 0)
  )

  const itemCount = computed(() =>
    items.value.reduce((sum, item) => sum + item.qty, 0)
  )

  function addToCart(product) {
    const existing = items.value.find(i => i.id === product.id)
    if (existing) {
      existing.qty++
    } else {
      items.value.push({ ...product, qty: 1 })
    }
  }

  function removeFromCart(productId) {
    const index = items.value.findIndex(i => i.id === productId)
    if (index > -1) {
      items.value.splice(index, 1)
    }
  }

  return { items, totalPrice, itemCount, addToCart, removeFromCart }
})
```

**要点**：
- Pinia 不需要 mutations，直接在 action 中修改 state
- `defineStore` 的 Setup 语法更接近 Composition API 风格
- `items.value.find()` 直接返回引用，修改会触发响应式
- `splice` 替代重新赋值 `items.value = items.value.filter(...)`，保持响应式引用
