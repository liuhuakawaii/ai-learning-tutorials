# Content Script

## 场景引入

上一课我们用 Content Script 提取了页面的基本信息。但实际开发中，Content Script 的作用远不止"读取"——它能修改页面 DOM、注入自定义样式、拦截用户交互、甚至创建全新的 UI 元素。

然而，Content Script 的注入方式和运行环境有很多细节需要注意：什么时候自动注入？什么时候手动注入？隔离世界到底意味着什么？为什么有时候操作 DOM 会和网页自身的脚本冲突？

本课将深入 Content Script 的核心机制，让你能自如地操控任何网页。

## 学习目标

- 掌握 Content Script 的两种注入策略（自动注入 vs 按需注入）
- 理解隔离世界（Isolated World）的工作原理
- 熟练操作网页 DOM 和注入自定义 UI
- 掌握 Content Script 与网页脚本的交互方式

## 注入策略

Content Script 有两种注入方式，适用于不同场景。

### 自动注入

在 manifest.json 中声明，页面加载时自动注入：

```json
{
  "content_scripts": [
    {
      "matches": ["https://www.example.com/*"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ]
}
```

`run_at` 参数控制注入时机：

| 值 | 时机 | 适用场景 |
|-----|------|----------|
| `document_start` | DOM 构建之前，CSS 加载之后 | 拦截页面脚本、修改页面行为 |
| `document_end` | DOM 构建完成，资源未加载 | 操作 DOM 元素 |
| `document_idle` | DOM 完成且空闲时（默认） | 大多数场景 |

### 按需注入

通过 `chrome.scripting.executeScript` 在需要时手动注入：

```javascript
// background.js - 用户点击图标时注入
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
});
```

按需注入的优势：
- 不会在所有页面上运行，节省资源
- 可以根据条件决定是否注入
- 需要 `activeTab` 权限即可，不需要 `host_permissions`

动态注入 CSS：

```javascript
await chrome.scripting.insertCSS({
  target: { tabId: tab.id },
  css: 'body { border: 3px solid red !important; }'
});
```

注入函数而非文件：

```javascript
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: (color) => {
    document.body.style.backgroundColor = color;
  },
  args: ['lightyellow']
});
```

这种"函数注入"方式适合简短的逻辑，不需要单独创建文件。

## 隔离世界

这是 Content Script 最重要的概念之一。

### 什么是隔离世界

Content Script 运行在"隔离世界"（Isolated World）中。它和网页脚本共享同一份 DOM，但拥有独立的 JavaScript 全局对象。

```
┌───────────────────────────────────────┐
│           网页渲染进程                   │
│                                       │
│  ┌─────────────┐  ┌────────────────┐  │
│  │  主世界       │  │  隔离世界       │  │
│  │  (网页脚本)   │  │  (Content Script)│ │
│  │             │  │              │  │
│  │ window.foo  │  │ window.foo    │  │
│  │ = '网页'     │  │ = undefined   │  │
│  │             │  │              │  │
│  │ ┌─────────────────────────────┐│  │
│  │ │      共享的 DOM 树           ││  │
│  │ │  document.querySelector()   ││  │
│  │ │  两边看到的是同一份 DOM       ││  │
│  │ └─────────────────────────────┘│  │
│  └─────────────┘  └────────────────┘  │
└───────────────────────────────────────┘
```

### 隔离带来的影响

```javascript
// 网页脚本（主世界）
window.myApp = { theme: 'dark' };
document.querySelector('#app').dataset.initialized = 'true';

// Content Script（隔离世界）
console.log(window.myApp);         // undefined - 看不到网页的全局变量
console.log(window === window);    // false - 两个不同的 window 对象
console.log(document.querySelector('#app').dataset.initialized); // 'true' - DOM 是共享的
```

**共享的**：DOM 树、`document`、`window.location`、`window.getComputedStyle()`
**独立的**：JavaScript 全局变量、`window` 对象引用、`prototype` 链

### 与网页脚本通信

如果需要与网页脚本交换数据，必须通过 `window.postMessage`：

```javascript
// Content Script 向网页发送消息
window.postMessage({
  source: 'my-extension',
  type: 'REQUEST_DATA',
  payload: null
}, '*');

// Content Script 监听网页的回复
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== 'webpage') return;

  console.log('收到网页数据:', event.data.payload);
});
```

```javascript
// 网页脚本
window.addEventListener('message', (event) => {
  if (event.data?.source !== 'my-extension') return;

  if (event.data.type === 'REQUEST_DATA') {
    window.postMessage({
      source: 'webpage',
      type: 'DATA_RESPONSE',
      payload: { userId: 123, name: '张三' }
    }, '*');
  }
});
```

**安全注意**：使用 `postMessage` 时必须验证消息来源（`event.source`）和数据格式，防止被恶意页面注入消息。

## DOM 操作实战

Content Script 最常见的任务是操作网页 DOM。以下是一些实用模式。

### 创建自定义 UI 元素

```javascript
function createFloatingButton() {
  const container = document.createElement('div');
  container.id = 'my-extension-container';

  const shadow = container.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
    <style>
      .btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: #1a73e8;
        color: white;
        border: none;
        cursor: pointer;
        font-size: 20px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      }
      .btn:hover {
        transform: scale(1.1);
      }
    </style>
    <button class="btn">📌</button>
  `;

  shadow.querySelector('.btn').addEventListener('click', () => {
    handleButtonClick();
  });

  document.body.appendChild(container);
}

createFloatingButton();
```

**为什么使用 Shadow DOM？** 使用 `attachShadow({ mode: 'closed' })` 创建封闭的影子 DOM，可以：
- 防止网页的 CSS 影响扩展的 UI 样式
- 防止扩展的 CSS 污染网页
- 避免 ID 和类名冲突

### 拦截和修改页面行为

```javascript
// 拦截页面的表单提交
document.querySelectorAll('form').forEach(form => {
  form.addEventListener('submit', (event) => {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    console.log('表单提交数据:', data);
  });
});

// 拦截链接点击
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link) return;

  const url = new URL(link.href);
  if (url.hostname.includes('tracking.com')) {
    event.preventDefault();
    console.log('拦截了跟踪链接:', link.href);
  }
}, true);
```

### 监听 DOM 变化

```javascript
// 使用 MutationObserver 监听 DOM 变化
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches('.comment')) {
          processComment(node);
        }
        node.querySelectorAll?.('.comment').forEach(processComment);
      }
    });
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

function processComment(element) {
  if (element.dataset.processed) return;
  element.dataset.processed = 'true';

  const text = element.textContent;
  if (text.includes('关键词')) {
    element.style.borderLeft = '3px solid #e74c3c';
    element.style.paddingLeft = '8px';
  }
}
```

`MutationObserver` 是处理动态加载内容的标准方案。很多现代网站（如社交媒体）的内容是通过 JavaScript 动态渲染的，静态注入的脚本无法捕获这些元素。

## 注入时机与 DOM 就绪

不同 `run_at` 设置下，DOM 的可用状态不同：

```javascript
// document_start 时，DOM 可能还未构建
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  // 此时 DOM 已就绪
  const target = document.querySelector('#target-element');
  if (target) {
    // 元素存在，执行操作
  }
}
```

如果目标元素是动态加载的，需要结合 `MutationObserver`：

```javascript
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`等待元素 ${selector} 超时`));
    }, timeout);

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

// 使用
try {
  const element = await waitForElement('.dynamic-content');
  processElement(element);
} catch (error) {
  console.warn(error.message);
}
```

## 常见误区

### 误区一：Content Script 可以访问所有 Chrome API

Content Script 只能访问有限的 Chrome API 子集。它可以使用 `chrome.runtime`（消息传递）、`chrome.storage`、`chrome.i18n` 等，但不能使用 `chrome.tabs`、`chrome.cookies`、`chrome.windows` 等需要特殊权限的 API。

需要这些 API 时，必须通过消息传递请求 Background Service Worker 代为执行。

### 误区二：隔离世界意味着完全安全

隔离世界防止了 JavaScript 层面的直接访问，但 DOM 是共享的。恶意网页可以通过监听 DOM 变化来推测 Content Script 的行为。不要在 DOM 中存储敏感信息。

### 误区三：Content Script 会自动注入到所有页面

只有在 `manifest.json` 中通过 `matches` 声明的 URL 模式才会自动注入。而且 `chrome://`、`chrome-extension://`、Chrome 应用商店等特殊页面永远不会注入 Content Script。

### 误区四：直接操作网页的 CSSOM

Content Script 通过 `<style>` 标签注入的样式可能被网页的高优先级样式覆盖。使用 Shadow DOM 或 `!important` 可以缓解，但最可靠的方式是使用 Shadow DOM 隔离。

## 工程建议

1. **优先使用 Shadow DOM**：创建自定义 UI 时，始终使用 Shadow DOM 隔离样式
2. **合理选择注入时机**：大多数场景用 `document_idle` 即可，需要拦截页面脚本才用 `document_start`
3. **避免频繁 DOM 操作**：批量修改 DOM，使用 `DocumentFragment` 或一次性 `innerHTML`
4. **处理 SPA 路由变化**：单页应用的 URL 变化不会触发页面重新加载，需要监听 `popstate` 或使用 `MutationObserver`
5. **清理副作用**：在页面卸载时移除注入的元素和事件监听器，避免内存泄漏

## 小结

Content Script 是扩展与网页之间的桥梁。它运行在隔离世界中，与网页共享 DOM 但隔离 JavaScript 全局对象。掌握注入策略（自动 vs 按需）、DOM 操作技巧和与网页脚本的通信方式，是开发功能丰富的扩展的基础。

## 练习

### 练习一：注入策略选择

以下场景应该使用自动注入还是按需注入？说明理由：
1. 广告拦截器，需要在页面加载前拦截请求
2. 网页截图工具，用户点击图标时才触发
3. 持续监控某个网站的价格变动
4. 在所有网页右键时添加"翻译选中文本"菜单

### 练习二：DOM 操作

编写一个 Content Script，在每个网页右下角添加一个可拖拽的浮动按钮，点击后高亮页面中所有的邮箱地址（`xxx@xxx.xxx` 格式），并显示找到的数量。

### 练习三：隔离世界实验

创建一个扩展，分别在网页脚本和 Content Script 中设置 `window.testVar`，然后验证两个世界的变量是隔离的。使用 `postMessage` 实现双向通信。

---

## 参考答案

### 练习一

**答案**：

1. **自动注入 + `document_start`**：广告拦截需要在页面脚本执行前就注入拦截逻辑，如果等用户点击再注入就来不及了。
2. **按需注入**：截图是用户主动触发的操作，不需要在所有页面上都注入脚本。使用 `activeTab` 权限 + `chrome.scripting.executeScript` 即可。
3. **自动注入**：价格监控需要持续运行，页面加载时就开始监听价格元素的变化。
4. **自动注入**：右键菜单需要在所有网页上可用，Content Script 需要处理选中文本的逻辑。

### 练习二

**思路**：创建浮动按钮 + 使用正则匹配邮箱 + 使用 Shadow DOM 隔离样式。

**答案**：

```javascript
function createEmailFinder() {
  const container = document.createElement('div');
  container.id = 'email-finder-ext';

  const shadow = container.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      .fab {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #4285f4;
        color: white;
        border: none;
        cursor: pointer;
        font-size: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        z-index: 2147483647;
        transition: transform 0.2s;
      }
      .fab:hover { transform: scale(1.1); }
      .badge {
        position: absolute;
        top: -8px;
        right: -8px;
        background: #ea4335;
        color: white;
        border-radius: 12px;
        padding: 2px 6px;
        font-size: 12px;
        display: none;
      }
      .highlight {
        background: #fff3cd !important;
        outline: 2px solid #ffc107 !important;
      }
    </style>
    <button class="fab">📧<span class="badge" id="count"></span></button>
  `;

  const btn = shadow.querySelector('.fab');
  const countBadge = shadow.querySelector('#count');

  btn.addEventListener('click', () => {
    highlightEmails(countBadge);
  });

  document.body.appendChild(container);
}

function highlightEmails(countBadge) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let count = 0;
  const textNodes = [];

  while (walker.nextNode()) {
    if (walker.currentNode.parentElement.closest('#email-finder-ext')) continue;
    if (emailRegex.test(walker.currentNode.textContent)) {
      textNodes.push(walker.currentNode);
    }
    emailRegex.lastIndex = 0;
  }

  textNodes.forEach(node => {
    const span = document.createElement('span');
    span.innerHTML = node.textContent.replace(
      emailRegex,
      '<span class="highlight" style="background:#fff3cd!important;outline:2px solid #ffc107!important;">$&</span>'
    );
    node.parentNode.replaceChild(span, node);
    count += (span.innerHTML.match(emailRegex) || []).length;
  });

  countBadge.textContent = count;
  countBadge.style.display = count > 0 ? 'block' : 'none';
}

createEmailFinder();
```

### 练习三

**思路**：分别在 manifest 的 content_scripts 和网页中注入脚本，使用 postMessage 通信。

**答案**：

```json
{
  "manifest_version": 3,
  "name": "隔离世界实验",
  "version": "1.0.0",
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["inject.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

```javascript
// content.js
window.testVar = '来自Content Script';
console.log('[Content Script] window.testVar:', window.testVar);

const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
document.documentElement.appendChild(script);
script.remove();

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.source === 'webpage') {
    console.log('[Content Script] 收到网页消息:', event.data.message);
    console.log('[Content Script] 网页的 testVar:', event.data.testVar);
    window.postMessage({ source: 'extension', message: '你好，网页！' }, '*');
  }
});
```

```javascript
// inject.js
console.log('[网页脚本] window.testVar:', window.testVar); // undefined
window.testVar = '来自网页脚本';
console.log('[网页脚本] 设置后的 window.testVar:', window.testVar);

window.postMessage({
  source: 'webpage',
  message: '你好，扩展！',
  testVar: window.testVar
}, '*');

window.addEventListener('message', (event) => {
  if (event.data?.source === 'extension') {
    console.log('[网页脚本] 收到扩展消息:', event.data.message);
  }
});
```

**要点**：
- 两个 `window.testVar` 互不影响，证明了隔离世界的独立性
- `postMessage` 是两个世界之间唯一的通信桥梁
- `inject.js` 需要在 `web_accessible_resources` 中声明才能被网页访问
