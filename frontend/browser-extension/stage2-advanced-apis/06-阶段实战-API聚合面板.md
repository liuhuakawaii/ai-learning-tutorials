# 阶段实战：API 聚合面板

## 场景引入

阶段二学习了存储、网络拦截、标签页管理、右键菜单、通知和侧边栏等高级 API。现在将这些知识综合起来，构建一个实用的开发者工具——API 聚合面板。

这个扩展的功能：在侧边栏中实时展示当前页面的所有 API 请求，支持按域名、状态码筛选，可以将常用 API 保存到收藏夹，并在请求失败时推送通知。这是一个对前端开发者非常实用的工具。

## 学习目标

- 综合运用存储、网络拦截、侧边栏、通知等 API
- 实现 DevTools Network 面板的简化版
- 构建数据筛选、收藏、通知的完整交互
- 掌握扩展中实时数据流的处理模式

## 功能规划

```
API 聚合面板
├── 侧边栏实时展示 API 请求列表
├── 按域名、状态码、方法筛选
├── 请求详情查看（headers、body、timing）
├── 收藏常用 API 端点
├── 失败请求（4xx/5xx）推送通知
└── 导出请求日志为 HAR 格式
```

## 项目结构

```
api-panel/
├── manifest.json
├── background.js
├── sidepanel.html
├── sidepanel.css
├── sidepanel.js
├── content/
│   └── interceptor.js
└── icons/
```

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "API 聚合面板",
  "version": "1.0.0",
  "description": "实时监控和管理页面 API 请求",
  "permissions": [
    "sidePanel",
    "storage",
    "notifications",
    "webRequest",
    "declarativeNetRequest"
  ],
  "host_permissions": ["<all_urls>"],
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/interceptor.js"],
      "run_at": "document_start"
    }
  ]
}
```

## Background：请求监控

```javascript
// background.js
const requests = new Map();
const FAILED_THRESHOLD = 400;

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    requests.set(details.requestId, {
      id: details.requestId,
      url: details.url,
      method: details.method,
      type: details.type,
      startTime: details.timeStamp,
      tabId: details.tabId,
      status: 'pending'
    });
  },
  { urls: ['<all_urls>'] }
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    const request = requests.get(details.requestId);
    if (request) {
      request.status = details.statusCode;
      request.endTime = details.timeStamp;
      request.duration = details.timeStamp - request.startTime;
      request.statusLine = details.statusLine;

      notifySidePanel(request);

      if (details.statusCode >= FAILED_THRESHOLD) {
        notifyFailedRequest(request);
      }
    }
  },
  { urls: ['<all_urls>'] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    const request = requests.get(details.requestId);
    if (request) {
      request.status = 'error';
      request.error = details.error;
      request.endTime = details.timeStamp;

      notifySidePanel(request);
    }
  },
  { urls: ['<all_urls>'] }
);

function notifySidePanel(request) {
  chrome.runtime.sendMessage({
    type: 'REQUEST_UPDATE',
    request: {
      id: request.id,
      url: request.url,
      method: request.method,
      type: request.type,
      status: request.status,
      duration: request.duration,
      error: request.error
    }
  }).catch(() => {});
}

async function notifyFailedRequest(request) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  if (settings.notifyFailures === false) return;

  const domain = new URL(request.url).hostname;
  chrome.notifications.create(`failed_${request.id}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '请求失败',
    message: `${request.method} ${domain} → ${request.status}`,
    priority: 1
  });
}

// 长连接支持
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    const recentRequests = [...requests.values()].slice(-100);
    port.postMessage({
      type: 'INITIAL_DATA',
      requests: recentRequests
    });

    port.onMessage.addListener((message) => {
      if (message.type === 'CLEAR_REQUESTS') {
        requests.clear();
        port.postMessage({ type: 'CLEARED' });
      }
      if (message.type === 'GET_REQUEST_DETAIL') {
        const req = requests.get(message.id);
        port.postMessage({ type: 'REQUEST_DETAIL', request: req });
      }
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    settings: {
      notifyFailures: true,
      maxRequests: 500,
      autoClear: false
    },
    favorites: []
  });
});
```

## Side Panel UI

```html
<!-- sidepanel.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="sidepanel.css">
</head>
<body>
  <div class="app">
    <header class="header">
      <h1>API 监控面板</h1>
      <div class="header-actions">
        <button id="clear-btn" title="清除">🗑</button>
        <button id="export-btn" title="导出 HAR">📥</button>
        <button id="settings-btn" title="设置">⚙</button>
      </div>
    </header>

    <div class="filters">
      <select id="method-filter">
        <option value="">所有方法</option>
        <option value="GET">GET</option>
        <option value="POST">POST</option>
        <option value="PUT">PUT</option>
        <option value="DELETE">DELETE</option>
      </select>
      <select id="status-filter">
        <option value="">所有状态</option>
        <option value="2xx">2xx 成功</option>
        <option value="3xx">3xx 重定向</option>
        <option value="4xx">4xx 客户端错误</option>
        <option value="5xx">5xx 服务端错误</option>
        <option value="error">网络错误</option>
      </select>
      <input type="text" id="search" placeholder="搜索 URL...">
    </div>

    <div class="stats-bar">
      <span id="total-count">0</span> 个请求
      <span class="separator">|</span>
      <span id="error-count" class="error">0</span> 个错误
    </div>

    <div id="request-list" class="request-list"></div>
  </div>

  <div id="detail-modal" class="modal hidden">
    <div class="modal-header">
      <h2>请求详情</h2>
      <button id="close-modal">✕</button>
    </div>
    <div id="detail-content" class="modal-content"></div>
  </div>

  <script src="sidepanel.js"></script>
</body>
</html>
```

```css
/* sidepanel.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  color: #333;
  background: #fafafa;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header h1 {
  font-size: 16px;
  color: #1a73e8;
}

.header-actions button {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.header-actions button:hover {
  background: #f0f0f0;
}

.filters {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.filters select,
.filters input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.stats-bar {
  padding: 8px 16px;
  font-size: 12px;
  color: #666;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.stats-bar .error {
  color: #e74c3c;
  font-weight: 600;
}

.stats-bar .separator {
  margin: 0 8px;
  color: #ddd;
}

.request-list {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.request-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.15s;
}

.request-item:hover {
  background: #f5f5f5;
}

.request-item .method {
  font-weight: 600;
  font-size: 11px;
  min-width: 50px;
}

.request-item .method.GET { color: #4caf50; }
.request-item .method.POST { color: #ff9800; }
.request-item .method.PUT { color: #2196f3; }
.request-item .method.DELETE { color: #e74c3c; }

.request-item .url {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.request-item .status {
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

.request-item .status.s2xx { color: #4caf50; }
.request-item .status.s3xx { color: #ff9800; }
.request-item .status.s4xx { color: #e74c3c; }
.request-item .status.s5xx { color: #e74c3c; }
.request-item .status.error { color: #999; }

.request-item .duration {
  min-width: 60px;
  text-align: right;
  color: #999;
  font-size: 11px;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  z-index: 100;
  overflow-y: auto;
}

.modal.hidden {
  display: none;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  position: sticky;
  top: 0;
  background: white;
}

.modal-content {
  padding: 16px;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-section h3 {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
}

.detail-row {
  display: flex;
  padding: 4px 0;
  border-bottom: 1px solid #f5f5f5;
}

.detail-row .key {
  min-width: 120px;
  color: #666;
}

.detail-row .value {
  flex: 1;
  word-break: break-all;
}
```

```javascript
// sidepanel.js
let port = null;
let allRequests = [];
let filters = { method: '', status: '', search: '' };

document.addEventListener('DOMContentLoaded', () => {
  connectToBackground();
  setupFilters();
  setupActions();
});

function connectToBackground() {
  port = chrome.runtime.connect({ name: 'sidepanel' });

  port.onMessage.addListener((message) => {
    switch (message.type) {
      case 'INITIAL_DATA':
        allRequests = message.requests;
        renderRequests();
        break;
      case 'REQUEST_UPDATE':
        updateRequest(message.request);
        break;
      case 'CLEARED':
        allRequests = [];
        renderRequests();
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    setTimeout(connectToBackground, 1000);
  });
}

function updateRequest(request) {
  const index = allRequests.findIndex(r => r.id === request.id);
  if (index >= 0) {
    allRequests[index] = request;
  } else {
    allRequests.push(request);
    if (allRequests.length > 500) {
      allRequests = allRequests.slice(-500);
    }
  }
  renderRequests();
}

function setupFilters() {
  document.getElementById('method-filter').addEventListener('change', (e) => {
    filters.method = e.target.value;
    renderRequests();
  });

  document.getElementById('status-filter').addEventListener('change', (e) => {
    filters.status = e.target.value;
    renderRequests();
  });

  document.getElementById('search').addEventListener('input', (e) => {
    filters.search = e.target.value.toLowerCase();
    renderRequests();
  });
}

function setupActions() {
  document.getElementById('clear-btn').addEventListener('click', () => {
    port.postMessage({ type: 'CLEAR_REQUESTS' });
  });

  document.getElementById('export-btn').addEventListener('click', exportHAR);
  document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('detail-modal').classList.add('hidden');
  });
}

function getFilteredRequests() {
  return allRequests.filter(req => {
    if (filters.method && req.method !== filters.method) return false;

    if (filters.status) {
      const status = String(req.status);
      if (filters.status === 'error' && status !== 'error') return false;
      if (filters.status === '2xx' && !status.startsWith('2')) return false;
      if (filters.status === '3xx' && !status.startsWith('3')) return false;
      if (filters.status === '4xx' && !status.startsWith('4')) return false;
      if (filters.status === '5xx' && !status.startsWith('5')) return false;
    }

    if (filters.search && !req.url.toLowerCase().includes(filters.search)) return false;

    return true;
  });
}

function renderRequests() {
  const filtered = getFilteredRequests();
  const container = document.getElementById('request-list');

  const errorCount = allRequests.filter(r => r.status >= 400 || r.status === 'error').length;
  document.getElementById('total-count').textContent = filtered.length;
  document.getElementById('error-count').textContent = errorCount;

  container.innerHTML = filtered.slice(-200).reverse().map(req => {
    const domain = getDomain(req.url);
    const path = getPath(req.url);
    const statusClass = getStatusClass(req.status);

    return `
      <div class="request-item" data-id="${req.id}">
        <span class="method ${req.method}">${req.method}</span>
        <span class="url" title="${req.url}">${domain}${path}</span>
        <span class="status ${statusClass}">${req.status}</span>
        <span class="duration">${req.duration ? req.duration + 'ms' : '-'}</span>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.request-item').forEach(item => {
    item.addEventListener('click', () => {
      showDetail(item.dataset.id);
    });
  });
}

function showDetail(requestId) {
  const request = allRequests.find(r => r.id === requestId);
  if (!request) return;

  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('detail-content');

  content.innerHTML = `
    <div class="detail-section">
      <h3>基本信息</h3>
      <div class="detail-row"><span class="key">方法</span><span class="value">${request.method}</span></div>
      <div class="detail-row"><span class="key">URL</span><span class="value">${request.url}</span></div>
      <div class="detail-row"><span class="key">状态</span><span class="value">${request.status}</span></div>
      <div class="detail-row"><span class="key">类型</span><span class="value">${request.type}</span></div>
      <div class="detail-row"><span class="key">耗时</span><span class="value">${request.duration || '-'}ms</span></div>
      ${request.error ? `<div class="detail-row"><span class="key">错误</span><span class="value">${request.error}</span></div>` : ''}
    </div>
  `;

  modal.classList.remove('hidden');
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getPath(url) {
  try {
    const u = new URL(url);
    return u.pathname.length > 40
      ? u.pathname.substring(0, 40) + '...'
      : u.pathname;
  } catch {
    return '';
  }
}

function getStatusClass(status) {
  if (status === 'error') return 'error';
  if (status >= 500) return 's5xx';
  if (status >= 400) return 's4xx';
  if (status >= 300) return 's3xx';
  return 's2xx';
}

async function exportHAR() {
  const har = {
    log: {
      version: '1.2',
      creator: { name: 'API Panel', version: '1.0.0' },
      entries: allRequests.map(req => ({
        startedDateTime: new Date(req.startTime).toISOString(),
        time: req.duration || 0,
        request: {
          method: req.method,
          url: req.url,
          httpVersion: 'HTTP/1.1',
          headers: [],
          queryString: [],
          headersSize: -1,
          bodySize: -1
        },
        response: {
          status: req.status,
          statusText: '',
          httpVersion: 'HTTP/1.1',
          headers: [],
          content: { size: 0, mimeType: '' },
          headersSize: -1,
          bodySize: -1
        }
      }))
    }
  };

  const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `api-log-${Date.now()}.har`;
  a.click();
  URL.revokeObjectURL(url);
}
```

## 工程建议

1. **请求数据量控制**：webRequest 会产生大量事件，设置上限（如 500 条），超出时清理旧数据
2. **Side Panel 连接管理**：Side Panel 可能被关闭和重新打开，需要处理连接断开和重连
3. **性能考虑**：高频请求场景下，使用批量更新而非逐条渲染
4. **HAR 导出**：HAR 是标准的 HTTP 归档格式，可以导入 Chrome DevTools 或其他工具分析

## 常见误区

### 误区一：webRequest 能获取请求体

`webRequest` 无法获取 POST 请求的 body 内容。如果需要请求体，需要在 content script 中拦截 `fetch` 或 `XMLHttpRequest`。

### 误区二：所有请求都会触发 webRequest 事件

某些内部请求（如 Service Worker 的 fetch）可能不会触发 `webRequest` 事件。

### 误区三：Side Panel 数据可以一直累积

长时间运行的页面可能产生大量请求数据。必须设置上限，避免内存溢出。

## 小结

本课综合运用了阶段二学习的所有 API，构建了一个实用的 API 聚合面板。这个项目展示了：

- **webRequest**：监控网络请求
- **storage**：保存设置和收藏
- **sidePanel**：常驻显示的 UI
- **notifications**：失败请求通知

这些 API 的组合使用模式，是构建功能丰富的扩展的基础。

## 练习

### 练习一：请求重放

添加"重放请求"功能：点击某个请求后，可以修改参数重新发送。

### 练习二：请求对比

实现请求对比功能：选择两个请求，对比它们的 headers、timing 等差异。

### 练习三：性能统计

添加性能统计面板：展示请求时间分布图、域名请求占比、平均响应时间等指标。

---

## 参考答案

### 练习一

**答案**：

```javascript
async function replayRequest(request) {
  try {
    const options = {
      method: request.method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (request.method !== 'GET' && request.body) {
      options.body = request.body;
    }

    const response = await fetch(request.url, options);
    const data = await response.text();

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: data.substring(0, 10000)
    };
  } catch (error) {
    return { error: error.message };
  }
}

// 在 sidepanel.js 中添加重放按钮
function showDetail(requestId) {
  const request = allRequests.find(r => r.id === requestId);
  // ... 渲染详情 ...

  const replayBtn = document.createElement('button');
  replayBtn.textContent = '重放请求';
  replayBtn.addEventListener('click', async () => {
    replayBtn.disabled = true;
    replayBtn.textContent = '重放中...';
    const result = await replayRequest(request);
    console.log('重放结果:', result);
    replayBtn.textContent = '重放完成';
  });
  content.appendChild(replayBtn);
}
```

### 练习二

**答案**：

```javascript
function compareRequests(id1, id2) {
  const req1 = allRequests.find(r => r.id === id1);
  const req2 = allRequests.find(r => r.id === id2);

  return {
    url: { a: req1.url, b: req2.url },
    method: { a: req1.method, b: req2.method },
    status: { a: req1.status, b: req2.status },
    duration: { a: req1.duration, b: req2.duration },
    difference: Math.abs((req1.duration || 0) - (req2.duration || 0))
  };
}

let selectedForCompare = [];

function toggleCompare(requestId) {
  const index = selectedForCompare.indexOf(requestId);
  if (index >= 0) {
    selectedForCompare.splice(index, 1);
  } else if (selectedForCompare.length < 2) {
    selectedForCompare.push(requestId);
  }

  if (selectedForCompare.length === 2) {
    const diff = compareRequests(selectedForCompare[0], selectedForCompare[1]);
    showComparison(diff);
    selectedForCompare = [];
  }
}
```

### 练习三

**答案**：

```javascript
function calculateStats() {
  const total = allRequests.length;
  if (total === 0) return null;

  const durations = allRequests
    .filter(r => r.duration)
    .map(r => r.duration);

  const avgDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  const domainCounts = {};
  allRequests.forEach(r => {
    const domain = getDomain(r.url);
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  });

  const statusCounts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, error: 0 };
  allRequests.forEach(r => {
    if (r.status === 'error') statusCounts.error++;
    else if (r.status >= 500) statusCounts['5xx']++;
    else if (r.status >= 400) statusCounts['4xx']++;
    else if (r.status >= 300) statusCounts['3xx']++;
    else statusCounts['2xx']++;
  });

  const methodCounts = {};
  allRequests.forEach(r => {
    methodCounts[r.method] = (methodCounts[r.method] || 0) + 1;
  });

  return {
    total,
    avgDuration: Math.round(avgDuration),
    domainCounts,
    statusCounts,
    methodCounts,
    p95: percentile(durations, 95),
    p99: percentile(durations, 99)
  };
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
}
```
