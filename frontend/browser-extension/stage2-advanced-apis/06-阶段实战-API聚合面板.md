# 阶段实战：API 聚合面板——整合多个 API 到一个扩展

## 当前项目状态

前五课学了存储、网络拦截、标签页管理、右键菜单、侧边栏和 DevTools。本课把它们整合成一个"API 聚合面板"：用户在任何网页上右键选中文本，可以快速查词典、翻译、搜索 GitHub，结果在侧边栏中展示。

## 功能规划

```
API 聚合面板
├── 右键菜单：选中文本后出现"查词典"/"翻译"/"GitHub 搜索"
├── 侧边栏：展示 API 查询结果
├── 历史记录：chrome.storage.local 保存查询历史
├── 快捷键：Ctrl+Shift+F 快速搜索
└── 设置：配置 API Key、默认翻译语言
```

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "API 聚合面板",
  "version": "1.0.0",
  "permissions": ["activeTab", "storage", "contextMenus", "sidePanel"],
  "action": { "default_popup": "popup.html" },
  "background": { "service_worker": "background.js" },
  "side_panel": { "default_path": "sidepanel.html" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "commands": {
    "quick-search": {
      "suggested_key": { "default": "Ctrl+Shift+F" },
      "description": "快速搜索"
    }
  }
}
```

## 右键菜单

```javascript
// background.js
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'dictionary',
    title: '查词典: %s',
    contexts: ['selection']
  })
  chrome.contextMenus.create({
    id: 'translate',
    title: '翻译: %s',
    contexts: ['selection']
  })
  chrome.contextMenus.create({
    id: 'github',
    title: 'GitHub 搜索: %s',
    contexts: ['selection']
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const query = info.selectionText
  const action = info.menuItemId

  // 存储查询
  await chrome.storage.local.set({
    currentQuery: { text: query, action, timestamp: Date.now() }
  })

  // 打开侧边栏
  chrome.sidePanel.open({ tabId: tab.id })
})
```

## API 查询

```javascript
// background.js
async function queryAPI(action, text) {
  switch (action) {
    case 'dictionary':
      return await fetchDictionary(text)
    case 'translate':
      return await fetchTranslation(text)
    case 'github':
      return await searchGitHub(text)
  }
}

async function fetchDictionary(word) {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
  if (!res.ok) return { error: '未找到释义' }
  const data = await res.json()
  return {
    word: data[0].word,
    phonetic: data[0].phonetic,
    meanings: data[0].meanings.map(m => ({
      partOfSpeech: m.partOfSpeech,
      definitions: m.definitions.slice(0, 3).map(d => d.definition)
    }))
  }
}

async function fetchTranslation(text) {
  // 使用免费翻译 API
  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh`)
  const data = await res.json()
  return { translation: data.responseData.translatedText }
}

async function searchGitHub(query) {
  const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=5`)
  const data = await res.json()
  return {
    repos: data.items.map(r => ({
      name: r.full_name,
      description: r.description,
      stars: r.stargazers_count,
      url: r.html_url
    }))
  }
}
```

## 侧边栏

```html
<!-- sidepanel.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui; padding: 16px; margin: 0; }
    .result { background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 8px 0; }
    .error { background: #fee; color: #c00; }
    h3 { margin: 0 0 8px; }
    .history-item { padding: 8px; border-bottom: 1px solid #eee; cursor: pointer; }
    .history-item:hover { background: #f0f0f0; }
  </style>
</head>
<body>
  <h2>API 聚合面板</h2>
  <div id="result"></div>
  <h3>查询历史</h3>
  <div id="history"></div>
  <script src="sidepanel.js"></script>
</body>
</html>
```

```javascript
// sidepanel.js
chrome.storage.onChanged.addListener((changes) => {
  if (changes.currentQuery) {
    const { text, action } = changes.currentQuery.newValue
    performQuery(action, text)
  }
})

async function performQuery(action, text) {
  const resultEl = document.getElementById('result')
  resultEl.innerHTML = '查询中...'

  const result = await chrome.runtime.sendMessage({
    type: 'QUERY_API', action, text
  })

  if (result.error) {
    resultEl.innerHTML = `<div class="result error">${result.error}</div>`
  } else {
    resultEl.innerHTML = renderResult(action, result)
  }

  // 保存到历史
  saveToHistory({ text, action, result, timestamp: Date.now() })
}

function renderResult(action, result) {
  switch (action) {
    case 'dictionary':
      return `<div class="result">
        <h3>${result.word} ${result.phonetic || ''}</h3>
        ${result.meanings.map(m => `
          <p><strong>${m.partOfSpeech}</strong></p>
          <ul>${m.definitions.map(d => `<li>${d}</li>`).join('')}</ul>
        `).join('')}
      </div>`
    case 'translate':
      return `<div class="result"><h3>翻译结果</h3><p>${result.translation}</p></div>`
    case 'github':
      return `<div class="result"><h3>GitHub</h3>
        ${result.repos.map(r => `
          <p><a href="${r.url}" target="_blank">${r.name}</a> ⭐${r.stars}</p>
          <p style="color:#666;font-size:13px">${r.description || ''}</p>
        `).join('')}
      </div>`
  }
}
```

## 你可能踩的坑

**坑一：API 限速**

免费 API 通常有调用频率限制。用 chrome.storage 做本地缓存，相同查询不重复请求。

**坑二：CORS 限制**

Content Script 中的 fetch 受 CORS 限制。API 调用应该在 Background Service Worker 中进行。

**坑三：侧边栏生命周期**

侧边栏在用户关闭后会销毁。重新打开时需要从 storage 恢复状态。

## 练习

### 练习一：查询缓存

实现本地缓存：相同查询 24 小时内不重复请求 API，直接返回缓存结果。

### 练习二：自定义 API

让用户在设置页面中配置自定义 API（URL、请求方式、响应格式），扩展支持动态添加新的查询渠道。

---

## 参考答案

### 练习一

```javascript
async function cachedQuery(action, text) {
  const cacheKey = `cache_${action}_${text}`
  const cached = await chrome.storage.local.get(cacheKey)

  if (cached[cacheKey] && Date.now() - cached[cacheKey].timestamp < 24 * 60 * 60 * 1000) {
    return cached[cacheKey].data
  }

  const result = await queryAPI(action, text)
  await chrome.storage.local.set({
    [cacheKey]: { data: result, timestamp: Date.now() }
  })
  return result
}
```

### 练习二

```javascript
// 在 settings 中存储自定义 API 配置
const customAPIs = [
  {
    name: '自定义翻译',
    url: 'https://your-api.com/translate?q={query}',
    method: 'GET',
    responsePath: 'data.translation'
  }
]

// 动态创建右键菜单
chrome.storage.sync.get('customAPIs', ({ customAPIs }) => {
  customAPIs.forEach(api => {
    chrome.contextMenus.create({
      id: api.name,
      title: `${api.name}: %s`,
      contexts: ['selection']
    })
  })
})
```
