# 存储 API：扩展数据存在哪里

## 当前项目状态

你的扩展需要保存用户数据——设置、历史记录、缓存。localStorage 在扩展中有严重限制：Content Script 访问的是网页的 localStorage，不是扩展自己的。你需要用 chrome.storage。

## 三种存储

```javascript
// chrome.storage.local — 本地存储，持久化，最大 10MB
await chrome.storage.local.set({ colors: ['#ff0000', '#00ff00'] })
const { colors } = await chrome.storage.local.get('colors')

// chrome.storage.sync — 跨设备同步（登录同一 Google 账号）
await chrome.storage.sync.set({ theme: 'dark' })

// chrome.storage.session — 会话级存储，关闭浏览器后清除
await chrome.storage.session.set({ authToken: 'xxx' })
```

选择依据：
- 需要跨设备同步 → `sync`
- 敏感数据（token） → `session`
- 大量数据或不需要同步 → `local`

## 与 localStorage 的区别

```javascript
// localStorage：同步 API，5MB 限制，绑定到 origin
localStorage.setItem('key', 'value')

// chrome.storage：异步 API，10MB（local），不绑定 origin
await chrome.storage.local.set({ key: 'value' })
```

chrome.storage 的优势：
- 异步不阻塞
- 支持存储对象（不需要 JSON.stringify）
- Content Script 和 Background 共享同一份数据
- 支持变更监听

## 监听数据变化

```javascript
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
      console.log(`${key}: ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`)
    }
  }
})
```

## 实际应用：扩展设置

```javascript
// 默认设置
const DEFAULTS = {
  highlightColors: ['#ffeb3b', '#4caf50', '#2196f3'],
  autoSave: true,
  showBadge: true,
  maxAnnotations: 1000
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULTS))
  return { ...DEFAULTS, ...stored }
}

async function updateSetting(key, value) {
  await chrome.storage.sync.set({ [key]: value })
}
```

## 存储配额和清理

```javascript
async function checkStorageUsage() {
  const usage = await chrome.storage.local.getBytesInUse()
  const quota = chrome.storage.local.QUOTA_BYTES // 10MB
  console.log(`使用: ${(usage / 1024).toFixed(1)}KB / ${(quota / 1024 / 1024).toFixed(0)}MB`)
  return usage / quota
}

async function cleanupOldData(maxAge = 30 * 24 * 60 * 60 * 1000) {
  const all = await chrome.storage.local.get(null)
  const now = Date.now()
  const toRemove = []

  for (const [key, value] of Object.entries(all)) {
    if (value.createdAt && now - value.createdAt > maxAge) {
      toRemove.push(key)
    }
  }

  if (toRemove.length > 0) {
    await chrome.storage.local.remove(toRemove)
  }
}
```

## 你可能踩的坑

**坑一：storage.sync 有写入频率限制**

每分钟最多 120 次写入，每次最多 8192 个键。频繁更新的数据用 local。

**坑二：不处理异步**

chrome.storage 全是异步的。忘记 await 会导致读到旧数据。

**坑三：存储过大导致性能问题**

单个键的值不要超过 1MB。大量数据分键存储。

## 练习

### 练习一：设置页面

创建一个 Options Page，包含主题选择（亮/暗）、高亮颜色配置、最大标注数设置。修改后实时同步到 Content Script。

### 练习二：数据导出/导入

实现扩展数据的 JSON 导出和导入功能。导出文件包含所有 chrome.storage.local 的数据。

---

## 参考答案

### 练习一

```html
<!-- options.html -->
<select id="theme">
  <option value="light">亮色</option>
  <option value="dark">暗色</option>
</select>
<input type="number" id="maxAnnotations" value="1000">
<script src="options.js"></script>
```

```javascript
// options.js
async function load() {
  const settings = await chrome.storage.sync.get(['theme', 'maxAnnotations'])
  document.getElementById('theme').value = settings.theme || 'light'
  document.getElementById('maxAnnotations').value = settings.maxAnnotations || 1000
}

document.getElementById('theme').addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ theme: e.target.value })
})

load()
```

### 练习二

```javascript
async function exportData() {
  const data = await chrome.storage.local.get(null)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `extension-data-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
}

async function importData(file) {
  const text = await file.text()
  const data = JSON.parse(text)
  await chrome.storage.local.set(data)
}
```
