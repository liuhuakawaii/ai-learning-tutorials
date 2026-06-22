# 侧边栏与 DevTools

## 场景引入

Popup 是扩展最常见的 UI 载体，但它有一个根本性的限制：点击其他地方就会关闭。对于需要持续显示的内容（如实时数据面板、翻译结果、笔记列表），Popup 并不合适。

Chrome 114 引入的 Side Panel（侧边栏）解决了这个问题——它可以常驻在浏览器侧面，用户可以同时查看侧边栏内容和网页内容。而 DevTools Panel 则面向开发者，在浏览器开发者工具中嵌入扩展的调试界面。

本课将讲解这两个高级 UI 组件的开发方式。

## 学习目标

- 掌握 Side Panel 的创建和管理
- 理解 Side Panel 与 popup 的差异
- 学会构建 DevTools 扩展面板
- 实现侧边栏与页面的实时联动

## Side Panel 基础

### 配置

```json
{
  "manifest_version": 3,
  "name": "侧边栏扩展",
  "version": "1.0.0",
  "permissions": ["sidePanel"],
  "side_panel": {
    "default_path": "sidepanel.html"
  }
}
```

```html
<!-- sidepanel.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      width: 100%;
      min-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 16px;
      margin: 0;
    }
    h1 {
      font-size: 18px;
      color: #1a73e8;
      margin-bottom: 16px;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }
    .data-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
    }
    .data-label {
      font-size: 12px;
      color: #666;
    }
    .data-value {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
  </style>
</head>
<body>
  <h1>页面分析</h1>
  <div class="section">
    <div class="section-title">基本信息</div>
    <div class="data-card">
      <div class="data-label">页面标题</div>
      <div class="data-value" id="title">-</div>
    </div>
    <div class="data-card">
      <div class="data-label">URL</div>
      <div class="data-value" id="url">-</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">内容统计</div>
    <div id="stats"></div>
  </div>
  <script src="sidepanel.js"></script>
</body>
</html>
```

```javascript
// sidepanel.js
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  updatePageInfo(tab);

  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    updatePageInfo(tab);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.status === 'complete') {
      updatePageInfo(tab);
    }
  });
});

function updatePageInfo(tab) {
  document.getElementById('title').textContent = tab.title || '-';
  document.getElementById('url').textContent = tab.url || '-';

  if (tab.url && !tab.url.startsWith('chrome://')) {
    chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' })
      .then(stats => {
        if (stats) {
          renderStats(stats);
        }
      })
      .catch(() => {});
  }
}

function renderStats(stats) {
  const container = document.getElementById('stats');
  container.innerHTML = Object.entries(stats).map(([key, value]) => `
    <div class="data-card">
      <div class="data-label">${key}</div>
      <div class="data-value">${value}</div>
    </div>
  `).join('');
}
```

### Side Panel 行为控制

```javascript
// background.js

// 设置侧边栏行为
chrome.sidePanel.setOptions({
  path: 'sidepanel.html',
  enabled: true
});

// 点击扩展图标时打开侧边栏（替代 popup）
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// 在特定标签页禁用侧边栏
chrome.sidePanel.setOptions({
  tabId: someTabId,
  enabled: false
});

// 手动打开侧边栏
chrome.sidePanel.open({ windowId: windowId });
```

### Side Panel 与 Popup 的差异

| 特性 | Popup | Side Panel |
|------|-------|-----------|
| 生命周期 | 打开时创建，关闭时销毁 | 常驻，与浏览器窗口同生命周期 |
| 关闭行为 | 点击其他地方自动关闭 | 用户手动关闭或切换 |
| 最大宽度 | 800px | 窗口宽度的 40% |
| 最小宽度 | 25px | 25px |
| API | `chrome.action` | `chrome.sidePanel` |
| 适用场景 | 快捷操作、设置 | 持续显示的内容 |

### 同时使用 Popup 和 Side Panel

不能同时为同一个 action 配置 popup 和 side panel 的自动打开。但可以手动控制：

```javascript
// 移除 popup，改为手动控制
chrome.action.onClicked.addListener(async (tab) => {
  const { useSidePanel = false } = await chrome.storage.local.get('useSidePanel');

  if (useSidePanel) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } else {
    // 无法动态切换 popup，需要在 manifest 中配置
  }
});
```

## DevTools Panel

DevTools Panel 让扩展在浏览器开发者工具中显示自定义面板。

### 配置

```json
{
  "manifest_version": 3,
  "name": "DevTools 扩展",
  "devtools_page": "devtools.html"
}
```

```html
<!-- devtools.html -->
<!DOCTYPE html>
<html>
<body>
  <script src="devtools.js"></script>
</body>
</html>
```

```javascript
// devtools.js
chrome.devtools.panels.create(
  'API 监控',                    // 面板标题
  'icons/icon16.png',           // 面板图标
  'panels/api-monitor.html'     // 面板页面
);
```

### DevTools Panel 内容

```html
<!-- panels/api-monitor.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 12px;
      margin: 0;
      padding: 8px;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      padding: 8px;
      border-bottom: 1px solid #eee;
    }
    button {
      padding: 4px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
    }
    button:hover {
      background: #f0f0f0;
    }
    .log-entry {
      padding: 4px 8px;
      border-bottom: 1px solid #f0f0f0;
      font-size: 11px;
    }
    .log-entry .method {
      color: #1a73e8;
      font-weight: bold;
    }
    .log-entry .url {
      color: #333;
    }
    .log-entry .status {
      color: #4caf50;
    }
    .log-entry .error {
      color: #e74c3c;
    }
    .log-entry .time {
      color: #999;
      margin-left: 8px;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="clear">清除</button>
    <button id="filter">筛选</button>
    <label>
      <input type="checkbox" id="auto-scroll" checked> 自动滚动
    </label>
  </div>
  <div id="logs"></div>
  <script src="api-monitor.js"></script>
</body>
</html>
```

```javascript
// panels/api-monitor.js
const logsContainer = document.getElementById('logs');
const clearBtn = document.getElementById('clear');
const autoScroll = document.getElementById('auto-scroll');

clearBtn.addEventListener('click', () => {
  logsContainer.innerHTML = '';
});

// 监听网络请求
chrome.devtools.network.onRequestFinished.addListener((request) => {
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const method = request.request.method;
  const url = request.request.url;
  const status = request.response.status;
  const time = new Date(request.startedDateTime).toLocaleTimeString();

  entry.innerHTML = `
    <span class="method">${method}</span>
    <span class="url">${url}</span>
    <span class="${status >= 400 ? 'error' : 'status'}">${status}</span>
    <span class="time">${time}</span>
  `;

  logsContainer.appendChild(entry);

  if (autoScroll.checked) {
    entry.scrollIntoView({ behavior: 'smooth' });
  }
});

// 获取当前页面的控制台消息
chrome.devtools.inspectedWindow.onResourceAdded.addListener((resource) => {
  console.log('Resource added:', resource.url);
});
```

### DevTools 与页面交互

```javascript
// 在被检查页面中执行代码
chrome.devtools.inspectedWindow.eval(
  'document.querySelectorAll("*").length',
  (result, isException) => {
    if (!isException) {
      console.log('页面元素数量:', result);
    }
  }
);

// 获取被检查页面的资源
chrome.devtools.network.getHAR((harLog) => {
  console.log('请求数量:', harLog.entries.length);
  harLog.entries.forEach(entry => {
    console.log(`${entry.request.method} ${entry.request.url} → ${entry.response.status}`);
  });
});
```

## Side Panel 实战：实时页面分析器

```javascript
// content.js - 收集页面数据并发送
class PageAnalyzer {
  constructor() {
    this.stats = {};
    this.analyze();
    this.setupObservers();
  }

  analyze() {
    this.stats = {
      elements: document.querySelectorAll('*').length,
      links: document.querySelectorAll('a[href]').length,
      images: document.querySelectorAll('img').length,
      forms: document.querySelectorAll('form').length,
      scripts: document.querySelectorAll('script').length,
      styles: document.querySelectorAll('link[rel="stylesheet"], style').length,
      textLength: document.body.innerText.length,
      title: document.title
    };
  }

  setupObservers() {
    const observer = new MutationObserver(() => {
      this.analyze();
      this.report();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  report() {
    chrome.runtime.sendMessage({
      type: 'PAGE_STATS',
      stats: this.stats
    }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATS') {
    sendResponse(window.__analyzer?.stats || {});
  }
  return true;
});

window.__analyzer = new PageAnalyzer();
```

```javascript
// background.js - 中转数据给 side panel
let currentStats = {};

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'PAGE_STATS') {
    currentStats = message.stats;
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    port.postMessage({ type: 'INITIAL_STATS', stats: currentStats });

    const listener = (message) => {
      if (message.type === 'PAGE_STATS') {
        port.postMessage({ type: 'STATS_UPDATE', stats: message.stats });
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    port.onDisconnect.addListener(() => {
      chrome.runtime.onMessage.removeListener(listener);
    });
  }
});
```

## 常见误区

### 误区一：Side Panel 在所有 Chrome 版本中可用

Side Panel 需要 Chrome 114+。对于需要支持旧版本的扩展，应该同时提供 popup 作为降级方案。

### 误区二：DevTools Panel 可以访问所有 Chrome API

DevTools Panel 运行在扩展的上下文中，可以使用大部分 Chrome API，但它不能直接访问被检查页面的 DOM，必须通过 `chrome.devtools.inspectedWindow.eval` 执行。

### 误区三：Side Panel 和 Popup 可以同时配置

不能同时为 action 配置 popup 和自动打开 side panel。需要选择其中一种，或者手动控制。

### 误区四：DevTools Panel 在生产环境中不需要

DevTools Panel 主要面向开发者。如果你的扩展面向普通用户，DevTools Panel 是可选的。但如果你的扩展是开发者工具（如 API 监控、性能分析），DevTools Panel 是核心功能。

## 工程建议

1. **Side Panel 适合持续内容**：实时监控、笔记、翻译结果等需要持续显示的内容
2. **Popup 适合快捷操作**：设置、一键操作、快速查看
3. **DevTools Panel 面向开发者**：API 监控、性能分析、DOM 检查等开发者工具
4. **响应式设计**：Side Panel 宽度可变，UI 要能适应不同宽度
5. **状态同步**：Side Panel 常驻显示，需要实时监听页面变化

## 小结

Side Panel 和 DevTools Panel 是扩展 UI 的高级形式。Side Panel 提供了常驻显示的侧边栏，适合实时内容；DevTools Panel 在开发者工具中嵌入扩展功能，面向开发者工具场景。理解它们的适用场景和实现方式，可以构建更丰富的扩展 UI。

## 练习

### 练习一：翻译侧边栏

实现一个翻译侧边栏：用户在网页上选中文本，侧边栏自动显示翻译结果。支持历史记录和收藏功能。

### 练习二：DevTools 存储查看器

构建一个 DevTools Panel，显示当前页面的 localStorage、sessionStorage 和 cookies 内容，支持搜索和编辑。

### 练习三：侧边栏笔记

实现一个侧边栏笔记应用：用户可以在浏览网页时随时在侧边栏记录笔记，笔记自动关联当前页面 URL。

---

## 参考答案

### 练习一

**答案**：

```javascript
// sidepanel.js
const history = [];
let currentTabId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;

  document.getElementById('translate-btn').addEventListener('click', async () => {
    const text = document.getElementById('source').value;
    const result = await translateText(text);
    displayResult(text, result);
  });

  chrome.tabs.onActivated.addListener(async (info) => {
    currentTabId = info.tabId;
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SELECTED_TEXT' && message.tabId === currentTabId) {
    document.getElementById('source').value = message.text;
    translateText(message.text).then(result => {
      displayResult(message.text, result);
    });
  }
});

async function translateText(text) {
  const response = await fetch('https://api.example.com/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target: 'zh-CN' })
  });
  return response.json();
}

function displayResult(original, result) {
  const output = document.getElementById('result');
  output.innerHTML = `
    <div class="result-card">
      <div class="original">${original}</div>
      <div class="translated">${result.translatedText}</div>
      <button onclick="copyText('${result.translatedText}')">复制</button>
      <button onclick="addToHistory('${original}', '${result.translatedText}')">收藏</button>
    </div>
  `;

  history.unshift({ original, translated: result.translatedText, time: Date.now() });
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById('history');
  container.innerHTML = history.slice(0, 20).map(item => `
    <div class="history-item">
      <span>${item.original.substring(0, 30)}</span>
      <span>→</span>
      <span>${item.translated.substring(0, 30)}</span>
    </div>
  `).join('');
}
```

### 练习二

**答案**：

```javascript
// panels/storage-viewer.js
document.addEventListener('DOMContentLoaded', async () => {
  await refreshAll();

  document.getElementById('refresh').addEventListener('click', refreshAll);
  document.getElementById('search').addEventListener('input', filterKeys);
});

async function refreshAll() {
  const data = await evalInPage(`
    JSON.stringify({
      localStorage: Object.fromEntries(
        Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])
      ),
      sessionStorage: Object.fromEntries(
        Object.keys(sessionStorage).map(k => [k, sessionStorage.getItem(k)])
      )
    })
  `);

  renderStorage('localStorage', data.localStorage);
  renderStorage('sessionStorage', data.sessionStorage);
  renderCookies();
}

function evalInPage(code) {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error) {
        resolve(null);
      } else {
        resolve(JSON.parse(result));
      }
    });
  });
}

function renderStorage(type, data) {
  const container = document.getElementById(type);
  container.innerHTML = Object.entries(data).map(([key, value]) => `
    <div class="entry" data-key="${key}">
      <span class="key">${key}</span>
      <span class="value">${value.substring(0, 100)}</span>
      <button onclick="editEntry('${type}', '${key}')">编辑</button>
      <button onclick="deleteEntry('${type}', '${key}')">删除</button>
    </div>
  `).join('');
}

async function deleteEntry(type, key) {
  await evalInPage(`${type}.removeItem('${key}')`);
  refreshAll();
}
```

### 练习三

**答案**：

```javascript
// sidepanel.js
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url;

  const { notes = {} } = await chrome.storage.local.get('notes');
  const pageNotes = notes[url] || [];

  renderNotes(pageNotes);

  document.getElementById('add-note').addEventListener('click', async () => {
    const text = document.getElementById('note-input').value.trim();
    if (!text) return;

    pageNotes.push({
      text,
      createdAt: Date.now()
    });

    notes[url] = pageNotes;
    await chrome.storage.local.set({ notes });

    document.getElementById('note-input').value = '';
    renderNotes(pageNotes);
  });
});

function renderNotes(notes) {
  const container = document.getElementById('notes-list');
  container.innerHTML = notes.map((note, i) => `
    <div class="note-item">
      <p>${note.text}</p>
      <small>${new Date(note.createdAt).toLocaleString()}</small>
      <button onclick="deleteNote(${i})">删除</button>
    </div>
  `).join('');
}
```
