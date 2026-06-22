# 存储 API

## 场景引入

在前面的课程中，我们已经多次使用 `chrome.storage` 来保存标注数据和计数器值。但你可能注意到，`chrome.storage` 有三种存储模式：`local`、`sync` 和 `session`。它们有什么区别？什么时候该用哪种？为什么不能直接用 `localStorage`？

这些问题的答案与扩展的架构特性密切相关——Service Worker 没有 DOM 环境，`localStorage` 不可用；用户可能在多台设备上使用同一个扩展，数据需要同步；某些数据只需要在当前会话中保留，不需要持久化。

本课将深入 Chrome 存储 API 的三种模式，以及如何设计扩展的数据层。

## 学习目标

- 理解 chrome.storage 三种模式的差异和适用场景
- 掌握存储数据的结构化设计
- 学会监听存储变化并做出响应
- 了解存储限制和性能优化策略

## 三种存储模式

### chrome.storage.local

本地存储，数据保存在用户设备上，不会同步到其他设备。

```javascript
// 写入
await chrome.storage.local.set({
  annotations: [{ id: 1, text: '标注内容' }],
  settings: { theme: 'dark' }
});

// 读取
const { annotations, settings } = await chrome.storage.local.get([
  'annotations',
  'settings'
]);

// 读取单个值
const { count = 0 } = await chrome.storage.local.get('count');

// 删除
await chrome.storage.local.remove('annotations');

// 清空
await chrome.storage.local.clear();
```

**适用场景**：大量数据、不需要同步、缓存数据。

### chrome.storage.sync

同步存储，数据通过用户的 Google 账号自动同步到所有设备。

```javascript
// 写入（同步到所有设备）
await chrome.storage.sync.set({
  preferences: {
    highlightColor: '#ffeb3b',
    fontSize: 14,
    autoSave: true
  }
});

// 读取（从当前设备读取，已自动同步）
const { preferences } = await chrome.storage.sync.get('preferences');
```

**适用场景**：用户设置、偏好配置等小量数据。

**限制**：
- 单个 item 最大 8KB
- 总存储量 100KB
- 每个写入操作最多 120 个 item
- 每分钟最多 120 次写入操作

### chrome.storage.session

会话存储，数据仅在当前浏览器会话中保留，关闭浏览器后清除。

```javascript
// 写入（Chrome 102+）
await chrome.storage.session.set({
  currentTask: {
    status: 'processing',
    progress: 45
  }
});

// 读取
const { currentTask } = await chrome.storage.session.get('currentTask');
```

**适用场景**：临时状态、登录 token、当前会话的临时数据。

**限制**：
- 单个 item 最大 8KB
- 总存储量 10MB（Chrome 112+）
- Service Worker 终止后数据仍然保留（直到浏览器关闭）

## 为什么不用 localStorage

Service Worker 中没有 `window` 对象，因此 `localStorage` 不可用。即使在 popup 中可以用，也不推荐：

```javascript
// ❌ localStorage 的问题
localStorage.setItem('data', 'value'); // Service Worker 中报错
localStorage.getItem('data');          // Content Script 中获取的是网页的 localStorage

// ✅ chrome.storage 的优势
chrome.storage.local.set({ data: 'value' }); // 所有上下文都能用
chrome.storage.local.get('data');            // 访问的是扩展自己的存储
```

`chrome.storage` 的优势：
- 在所有扩展上下文中都能使用（包括 Service Worker）
- 支持非字符串类型（对象、数组、数字等）
- 支持容量变化监听
- 支持跨设备同步

## 数据结构设计

### 扁平化设计

```javascript
// ❌ 深层嵌套
await chrome.storage.local.set({
  users: {
    user1: {
      settings: {
        theme: {
          color: 'dark',
          fontSize: 14
        }
      }
    }
  }
});

// ✅ 扁平化
await chrome.storage.local.set({
  'users.user1.theme.color': 'dark',
  'users.user1.theme.fontSize': 14
});
```

Chrome 存储 API 不支持部分读取嵌套对象，扁平化结构更便于操作。

### 按功能分区

```javascript
// 设置相关的用 sync
await chrome.storage.sync.set({
  'settings.theme': 'dark',
  'settings.language': 'zh-CN',
  'settings.highlightColor': '#ffeb3b'
});

// 数据相关的用 local
await chrome.storage.local.set({
  'data.annotations': [],
  'data.history': [],
  'data.cache.lastUpdate': Date.now()
});

// 临时状态用 session
await chrome.storage.session.set({
  'temp.currentTab': 'settings',
  'temp.searchQuery': ''
});
```

## 存储变化监听

```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log(`存储区域 ${areaName} 发生变化:`);

  for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(`  ${key}: ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`);
  }
});

// 根据变化执行相应操作
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes['settings.theme']) {
    applyTheme(changes['settings.theme'].newValue);
  }

  if (areaName === 'local' && changes['data.annotations']) {
    updateAnnotationBadge(changes['data.annotations'].newValue);
  }
});
```

## 存储限制与配额

| 存储区域 | 单 item 限制 | 总容量 | 同步 |
|---------|------------|--------|------|
| local | 无特殊限制 | 默认 5MB，可申请增加 | 否 |
| sync | 8KB | 100KB | 是 |
| session | 8KB | 10MB | 否 |

### 检查存储用量

```javascript
async function getStorageUsage() {
  const localBytes = await chrome.storage.local.getBytesInUse(null);
  const syncBytes = await chrome.storage.sync.getBytesInUse(null);

  return {
    local: {
      used: localBytes,
      limit: 5 * 1024 * 1024,
      percent: ((localBytes / (5 * 1024 * 1024)) * 100).toFixed(2)
    },
    sync: {
      used: syncBytes,
      limit: 100 * 1024,
      percent: ((syncBytes / (100 * 1024)) * 100).toFixed(2)
    }
  };
}
```

### 容量超限处理

```javascript
async function safeSet(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    if (error.message.includes('QUOTA_BYTES')) {
      await cleanupOldData();
      await chrome.storage.local.set({ [key]: value });
    } else {
      throw error;
    }
  }
}

async function cleanupOldData() {
  const data = await chrome.storage.local.get(null);
  const entries = Object.entries(data);

  // 按时间排序，删除最旧的数据
  const sorted = entries
    .filter(([key]) => key.startsWith('cache_'))
    .sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));

  const toRemove = sorted.slice(0, Math.ceil(sorted.length / 2));
  await chrome.storage.local.remove(toRemove.map(([key]) => key));
}
```

## 批量操作优化

```javascript
// ❌ 逐条写入
for (const item of items) {
  await chrome.storage.local.set({ [item.id]: item });
}

// ✅ 批量写入
const batch = {};
items.forEach(item => {
  batch[item.id] = item;
});
await chrome.storage.local.set(batch);
```

批量操作比逐条操作快得多，因为减少了 I/O 次数。

## 常见误区

### 误区一：chrome.storage 是同步 API

`chrome.storage` 的所有操作都是异步的。虽然有回调形式，但推荐使用 Promise 化的方式。

```javascript
// ❌ 同步思维
const data = chrome.storage.local.get('key');

// ✅ 异步
const data = await chrome.storage.local.get('key');
```

### 误区二：sync 存储是实时同步的

`chrome.storage.sync` 的同步不是实时的，可能有几分钟的延迟。不要依赖 sync 存储来做实时数据同步。

### 误区三：session 存储在 Service Worker 重启后丢失

`chrome.storage.session` 在 Service Worker 终止后仍然保留数据，直到浏览器关闭。它比全局变量可靠。

### 误区四：直接修改存储中的对象

存储中读取的对象是副本，修改副本不会影响存储中的数据。

```javascript
// ❌ 修改副本
const { settings } = await chrome.storage.local.get('settings');
settings.theme = 'dark'; // 不会自动保存

// ✅ 重新写入
settings.theme = 'dark';
await chrome.storage.local.set({ settings });
```

## 工程建议

1. **分类存储**：设置用 sync，数据用 local，临时状态用 session
2. **扁平化键名**：使用 `section.key` 格式，避免深层嵌套
3. **批量操作**：尽量一次性读写多个 key，减少 I/O 次数
4. **容量监控**：定期检查存储用量，接近上限时清理旧数据
5. **变化监听**：使用 `onChanged` 事件响应存储变化，而不是轮询

## 小结

Chrome 存储 API 提供了三种模式，分别适用于不同场景。理解它们的差异和限制，设计合理的数据结构，是构建可靠扩展的基础。

## 练习

### 练习一：存储策略

为一个"阅读列表"扩展设计存储方案：需要保存用户添加的网页链接（可能很多）、用户偏好设置（高亮颜色、排序方式）、当前正在阅读的文章位置。说明每种数据应该使用哪种存储模式。

### 练习二：数据迁移

编写一个版本迁移函数，在扩展更新时将 v1 的扁平数据结构（`{ url, title }` 数组）转换为 v2 的索引结构（`{ byUrl: {}, byDate: {} }`）。

### 练习三：缓存管理

实现一个 LRU 缓存系统，使用 `chrome.storage.local` 存储，最多保留 100 条记录，超出时删除最久未使用的。

---

## 参考答案

### 练习一

**答案**：

```
阅读链接 → chrome.storage.local
  - 理由：数据量可能很大，不需要跨设备同步
  - 键名设计：`readlist.{url_hash}` 便于按 URL 查询

用户偏好 → chrome.storage.sync
  - 理由：用户在不同设备上希望保持一致的设置
  - 键名设计：`pref.highlightColor`、`pref.sortBy`

当前阅读位置 → chrome.storage.session
  - 理由：临时状态，浏览器关闭后不需要保留
  - 键名设计：`current.article`、`current.scrollY`
```

### 练习二

**答案**：

```javascript
async function migrateV1ToV2() {
  const { readlist = [] } = await chrome.storage.local.get('readlist');
  if (!Array.isArray(readlist)) return;

  const byUrl = {};
  const byDate = {};

  readlist.forEach(item => {
    const key = hashUrl(item.url);
    byUrl[key] = item;

    const date = item.addedAt?.slice(0, 10) || 'unknown';
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(key);
  });

  await chrome.storage.local.set({
    'readlist.byUrl': byUrl,
    'readlist.byDate': byDate,
    'readlist.version': 2
  });

  await chrome.storage.local.remove('readlist');
}

function hashUrl(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0;
  }
  return `url_${Math.abs(hash).toString(36)}`;
}
```

### 练习三

**答案**：

```javascript
class LRUStorageCache {
  constructor(maxSize = 100, storageKey = 'lru_cache') {
    this.maxSize = maxSize;
    this.storageKey = storageKey;
  }

  async get(key) {
    const cache = await this.loadCache();
    const entry = cache[key];
    if (!entry) return null;

    entry.lastAccess = Date.now();
    await this.saveCache(cache);
    return entry.value;
  }

  async set(key, value) {
    const cache = await this.loadCache();

    if (!cache[key] && Object.keys(cache).length >= this.maxSize) {
      this.evictOldest(cache);
    }

    cache[key] = {
      value,
      lastAccess: Date.now(),
      createdAt: cache[key]?.createdAt || Date.now()
    };

    await this.saveCache(cache);
  }

  evictOldest(cache) {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of Object.entries(cache)) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) delete cache[oldestKey];
  }

  async loadCache() {
    const { [this.storageKey]: cache = {} } = await chrome.storage.local.get(this.storageKey);
    return cache;
  }

  async saveCache(cache) {
    await chrome.storage.local.set({ [this.storageKey]: cache });
  }
}
```
