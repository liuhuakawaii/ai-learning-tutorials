# Background Service Worker

## 场景引入

Content Script 负责操作网页 DOM，Popup 负责展示 UI，那谁来统一管理这些组件？谁来监听浏览器事件、处理跨标签页的逻辑、管理扩展的全局状态？答案是 Background Service Worker。

Manifest V3 用 Service Worker 替代了 V2 的持久化后台页面，这是一个根本性的架构变化。Service Worker 不会一直运行，它会在空闲时被浏览器终止以节省资源。这意味着你不能在全局变量中存储状态，也不能假设"这段代码一直在后台跑"。

理解 Service Worker 的事件驱动模型和生命周期管理，是开发可靠扩展的关键。

## 学习目标

- 理解 Service Worker 的事件驱动模型
- 掌握 Service Worker 的生命周期管理
- 学会在 Service Worker 中管理持久化状态
- 熟练使用 chrome.alarms 实现定时任务
- 掌握离屏文档（Offscreen Document）的使用

## 事件驱动模型

Service Worker 不是"常驻后台"的脚本。它是一个事件处理器：浏览器将事件分发给它，它处理完事件后可能被终止。

```
浏览器事件                          Service Worker 状态
──────────                         ──────────────────
扩展安装                            → 启动
  └─ onInstalled                    → 处理 → 空闲
用户点击图标                         → 启动（如果已终止）
  └─ onMessage                      → 处理 → 空闲
收到网络请求                         → 启动（如果已终止）
  └─ onMessage                      → 处理 → 空闲
空闲 30 秒                          → 终止
定时器触发                           → 启动
  └─ onAlarm                        → 处理 → 空闲
```

### 可以监听的事件

```javascript
// 扩展生命周期
chrome.runtime.onInstalled.addListener((details) => {
  // 扩展安装或更新时触发
  if (details.reason === 'install') {
    console.log('首次安装');
  } else if (details.reason === 'update') {
    console.log('版本更新', details.previousVersion);
  }
});

chrome.runtime.onStartup.addListener(() => {
  // 浏览器启动时触发（不是扩展启动）
  console.log('浏览器启动了');
});

// 消息监听
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_DATA') {
    fetchDataFromAPI(message.url).then(data => {
      sendResponse(data);
    });
    return true; // 表示异步响应
  }
});

// 标签页事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log('页面加载完成:', tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  console.log('标签页关闭:', tabId);
});

// 网络请求事件（需要 declarativeNetRequest）
// 存储变化监听
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log(`${areaName} 存储发生变化:`, changes);
});
```

### Service Worker 不能做的事

```javascript
// ❌ 不能访问 DOM
document.querySelector('h1'); // ReferenceError: document is not defined

// ❌ 不能使用 window 对象
window.location; // ReferenceError: window is not defined

// ❌ 不能使用 XMLHttpRequest
const xhr = new XMLHttpRequest(); // ReferenceError

// ❌ 不能使用持久化全局变量
let counter = 0; // Service Worker 终止后丢失
```

Service Worker 可以使用 `fetch` API 进行网络请求，使用 `chrome.storage` 持久化状态。

## 生命周期管理

### 安装与更新

```javascript
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // 初始化默认配置
    await chrome.storage.local.set({
      settings: {
        enabled: true,
        theme: 'light',
        language: 'zh-CN'
      },
      stats: {
        totalProcessed: 0,
        installDate: new Date().toISOString()
      }
    });

    // 创建右键菜单
    chrome.contextMenus.create({
      id: 'my-extension-action',
      title: '使用扩展处理',
      contexts: ['selection']
    });
  }

  if (details.reason === 'update') {
    const oldVersion = details.previousVersion;
    const newVersion = chrome.runtime.getManifest().version;
    console.log(`从 ${oldVersion} 更新到 ${newVersion}`);

    // 处理数据迁移
    await migrateData(oldVersion, newVersion);
  }
});

async function migrateData(oldVersion, newVersion) {
  const data = await chrome.storage.local.get(null);

  // 示例：v1.x → v2.0 的数据结构变更
  if (oldVersion.startsWith('1.')) {
    const oldSettings = data.settings;
    const newSettings = {
      ...oldSettings,
      newField: 'default_value'
    };
    await chrome.storage.local.set({ settings: newSettings });
  }
}
```

### 保持 Service Worker 活跃

某些场景下需要 Service Worker 持续运行（如长时间的数据同步）。有几种策略：

**1. chrome.alarms（推荐）**

```javascript
// 设置定期唤醒闹钟
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // 执行定期任务
    performBackgroundTask();
  }
});
```

`chrome.alarms` 的最小间隔是 0.5 分钟（30 秒），而且 Chrome 会限制过于频繁的闹钟。

**2. 长连接端口**

```javascript
// popup 或 content script 中
const port = chrome.runtime.connect({ name: 'keepAlive' });

port.onDisconnect.addListener(() => {
  // 连接断开，Service Worker 可能已终止
  console.log('连接断开');
});
```

当有活跃的端口连接时，Service Worker 不会被终止。但 popup 关闭时端口会断开。

**3. Offscreen Document（Chrome 109+）**

对于需要 DOM 或 Web API 的后台任务，可以使用离屏文档：

```javascript
// background.js
async function createOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_PARSER', 'AUDIO_PLAYBACK'],
    justification: '需要 DOM 解析能力'
  });
}
```

```html
<!-- offscreen.html -->
<!DOCTYPE html>
<html>
<body>
  <script src="offscreen.js"></script>
</body>
</html>
```

```javascript
// offscreen.js - 可以使用 DOM API
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PARSE_HTML') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(message.html, 'text/html');
    const title = doc.querySelector('title')?.textContent;
    chrome.runtime.sendMessage({
      type: 'PARSE_RESULT',
      title
    });
  }
});
```

## 状态管理

Service Worker 的全局变量在其被终止时会丢失。必须使用 `chrome.storage` 进行持久化。

### 封装状态管理工具

```javascript
// state-manager.js
class StateManager {
  constructor(storageArea = 'local') {
    this.storage = chrome.storage[storageArea];
    this.cache = new Map();
  }

  async get(key) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const result = await this.storage.get(key);
    const value = result[key];
    this.cache.set(key, value);
    return value;
  }

  async set(key, value) {
    this.cache.set(key, value);
    await this.storage.set({ [key]: value });
  }

  async update(key, updater) {
    const current = await this.get(key);
    const updated = updater(current);
    await this.set(key, updated);
    return updated;
  }

  async remove(key) {
    this.cache.delete(key);
    await this.storage.remove(key);
  }

  clearCache() {
    this.cache.clear();
  }
}

const state = new StateManager();

// 使用示例
async function incrementCounter() {
  return state.update('counter', (count = 0) => count + 1);
}
```

### 监听存储变化

```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(`${areaName}.${key}: ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`);

    // 根据变化执行相应操作
    if (key === 'settings' && oldValue?.enabled !== newValue?.enabled) {
      handleEnabledToggle(newValue.enabled);
    }
  }
});
```

## 定时任务

### 使用 chrome.alarms

```javascript
// 设置闹钟
chrome.runtime.onInstalled.addListener(() => {
  // 每 5 分钟检查一次
  chrome.alarms.create('periodicCheck', { periodInMinutes: 5 });

  // 一次性闹钟，延迟 1 分钟
  chrome.alarms.create('oneTimeTask', { delayInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  switch (alarm.name) {
    case 'periodicCheck':
      await performPeriodicCheck();
      break;
    case 'oneTimeTask':
      await performOneTimeTask();
      break;
  }
});

async function performPeriodicCheck() {
  const { lastCheck = 0 } = await chrome.storage.local.get('lastCheck');
  const now = Date.now();

  // 避免过于频繁的检查
  if (now - lastCheck < 4 * 60 * 1000) return;

  await chrome.storage.local.set({ lastCheck: now });
  // 执行实际检查逻辑
}
```

### 闹钟的限制

- 最小间隔：0.5 分钟
- Chrome 可能延迟闹钟以节省资源（特别是电池供电的设备）
- 不要依赖闹钟的精确时间，它可能延迟几分钟

## 错误处理

Service Worker 中的未捕获错误会导致它终止。完善的错误处理很重要：

```javascript
// 全局错误捕获
self.addEventListener('error', (event) => {
  console.error('Service Worker 错误:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的 Promise 拒绝:', event.reason);
});

// 安全的消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('消息处理失败:', error);
      sendResponse({ error: error.message });
    });
  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'FETCH_DATA':
      const response = await fetch(message.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    default:
      throw new Error(`未知消息类型: ${message.type}`);
  }
}
```

## 常见误区

### 误区一：Service Worker 会一直运行

这是从 V2 迁移到 V3 时最常犯的错误。V3 的 Service Worker 会在空闲约 30 秒后被终止。所有需要持久化的状态必须存入 `chrome.storage`。

### 误区二：在 Service Worker 中使用 DOM API

Service Worker 没有 DOM 环境。需要解析 HTML 或使用 Web API（如 Canvas）时，使用 Offscreen Document。

### 误区三：在 onInstalled 中执行长时间操作

`onInstalled` 事件处理器应该尽快完成。如果需要执行耗时操作，使用 `chrome.alarms` 延迟执行或拆分成多个小任务。

### 误区四：忽略 Service Worker 终止对消息传递的影响

如果 Service Worker 已被终止，发送给它的消息会触发它重新启动，但需要时间。在 Content Script 或 Popup 中发送消息时，要做好延迟和错误处理。

## 工程建议

1. **无状态设计**：把 Service Worker 当作无状态的事件处理器，所有状态存入 storage
2. **快速响应**：事件处理器应该尽快完成，耗时操作使用异步或 Offscreen Document
3. **完善的错误处理**：捕获所有错误，避免 Service Worker 因未处理的异常而终止
4. **谨慎使用 alarm**：不要设置过于频繁的定时任务，遵守 Chrome 的限制
5. **版本迁移逻辑**：在 `onInstalled` 中处理数据结构的版本迁移

## 小结

Background Service Worker 是扩展的核心组件，负责事件监听、状态管理和组件协调。Manifest V3 将其改为非持久化的 Service Worker，要求开发者采用无状态设计和持久化存储策略。

理解事件驱动模型、生命周期管理和存储策略，是构建可靠扩展的基础。下一课将学习 popup、content script 和 background 之间的消息通信机制。

## 练习

### 练习一：生命周期日志

创建一个扩展，在 Service Worker 的各个生命周期事件（onInstalled、onStartup、onMessage）中记录日志到 `chrome.storage.local`，然后在 popup 中展示完整的生命周期日志。

### 练习二：定时任务

实现一个"网页监控"功能：用户设置一个 URL 和检查间隔，扩展定期检查该 URL 的页面内容是否发生变化，变化时发送通知。

### 练习三：状态持久化

实现一个计数器扩展，点击 popup 中的按钮增加计数。确保即使 Service Worker 被终止再重启，计数值也不会丢失。

---

## 参考答案

### 练习一

**思路**：在每个生命周期事件中追加日志条目到 storage。

**答案**：

```javascript
// background.js
async function logEvent(eventName, details = {}) {
  const { logs = [] } = await chrome.storage.local.get('logs');
  logs.push({
    event: eventName,
    timestamp: new Date().toISOString(),
    details
  });
  // 只保留最近 100 条
  await chrome.storage.local.set({ logs: logs.slice(-100) });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await logEvent('onInstalled', {
    reason: details.reason,
    previousVersion: details.previousVersion
  });
});

chrome.runtime.onStartup.addListener(async () => {
  await logEvent('onStartup');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_LOGS') {
    chrome.storage.local.get('logs').then(({ logs = [] }) => {
      sendResponse({ logs });
    });
    return true;
  }
  if (message.type === 'CLEAR_LOGS') {
    chrome.storage.local.set({ logs: [] }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
```

### 练习二

**思路**：使用 chrome.alarms 设置定时检查，用 fetch 请求目标 URL，对比内容 hash。

**答案**：

```javascript
// background.js
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ monitors: [] });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ADD_MONITOR') {
    addMonitor(message.url, message.intervalMinutes).then(sendResponse);
    return true;
  }
  if (message.type === 'GET_MONITORS') {
    chrome.storage.local.get('monitors').then(sendResponse);
    return true;
  }
});

async function addMonitor(url, intervalMinutes) {
  const { monitors = [] } = await chrome.storage.local.get('monitors');
  const id = `monitor_${Date.now()}`;

  monitors.push({ id, url, intervalMinutes, lastHash: null });
  await chrome.storage.local.set({ monitors });

  chrome.alarms.create(id, { periodInMinutes: intervalMinutes });
  return { success: true, id };
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('monitor_')) return;

  const { monitors = [] } = await chrome.storage.local.get('monitors');
  const monitor = monitors.find(m => m.id === alarm.name);
  if (!monitor) return;

  try {
    const response = await fetch(monitor.url);
    const html = await response.text();
    const hash = await computeHash(html);

    if (monitor.lastHash && monitor.lastHash !== hash) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '页面变化检测',
        message: `${monitor.url} 的内容已发生变化`
      });
    }

    monitor.lastHash = hash;
    await chrome.storage.local.set({ monitors });
  } catch (error) {
    console.error(`检查 ${monitor.url} 失败:`, error);
  }
});

async function computeHash(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### 练习三

**思路**：使用 chrome.storage.local 持久化计数值，每次读取和更新都通过 storage。

**答案**：

```javascript
// background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INCREMENT') {
    chrome.storage.local.get('count').then(({ count = 0 }) => {
      const newCount = count + 1;
      chrome.storage.local.set({ count: newCount }).then(() => {
        sendResponse({ count: newCount });
      });
    });
    return true;
  }
  if (message.type === 'GET_COUNT') {
    chrome.storage.local.get('count').then(({ count = 0 }) => {
      sendResponse({ count });
    });
    return true;
  }
  if (message.type === 'RESET') {
    chrome.storage.local.set({ count: 0 }).then(() => {
      sendResponse({ count: 0 });
    });
    return true;
  }
});
```

```javascript
// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const countEl = document.getElementById('count');
  const incrementBtn = document.getElementById('increment');
  const resetBtn = document.getElementById('reset');

  async function refreshCount() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_COUNT' });
    countEl.textContent = response.count;
  }

  incrementBtn.addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({ type: 'INCREMENT' });
    countEl.textContent = response.count;
  });

  resetBtn.addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({ type: 'RESET' });
    countEl.textContent = response.count;
  });

  await refreshCount();
});
```

**要点**：
- 计数值存放在 `chrome.storage.local` 而非全局变量中
- Service Worker 终止再重启后，从 storage 中读取的值仍然存在
- 每次操作都通过消息传递委托给 Service Worker 处理
