# 02. 错误监控系统设计

> 错误分类、捕获机制、上报策略——设计一个不会"吵死人"也不会"漏报"的错误监控系统

## 本课目标

- 掌握前端错误的分类体系和每类错误的特点
- 理解错误监控系统的完整生命周期：捕获 → 处理 → 上报 → 聚合 → 告警
- 设计合理的采样策略和上报机制
- 理解错误聚合和去重的工程实现
- 能评估一个错误监控系统的设计决策

## 错误分类：不是所有错误都一样

前端错误可以分为五大类，每类的捕获方式、影响范围和处理策略都不同。

### 第一类：JavaScript 运行时错误

代码执行过程中抛出的异常。

```javascript
// TypeError: Cannot read properties of undefined
const userName = user.profile.name; // user 是 undefined

// ReferenceError: someVar is not defined
console.log(someVar); // 变量未声明

// RangeError: Maximum call stack size exceeded
function recursive() { recursive(); } // 无限递归

// SyntaxError: Unexpected token
JSON.parse('not valid json'); // 非法 JSON
```

特点：
- 最常见的前端错误类型
- 通常可以通过代码质量工具（TypeScript、ESLint）预防
- 影响范围取决于错误发生的位置——可能只是某个组件挂了，也可能是整个页面白屏

### 第二类：未处理的 Promise 异常

Promise 被 reject 但没有 `.catch()` 或 `try-catch` 处理。

```javascript
// 这个异常如果不处理，会触发 unhandledrejection 事件
async function fetchUserData(userId) {
  const response = await fetch(`/api/user/${userId}`);
  const data = await response.json();
  return data.name; // 如果 response 不是 200，这里可能出错
}

// 常见的遗漏场景
fetchUserData('u_123'); // 没有 .catch()，也没有 try-catch
```

特点：
- 随着 async/await 普及，这类错误越来越多
- 容易被忽略——不像同步错误那样立刻崩溃，可能在几秒后才表现出来
- 某些浏览器对 unhandledrejection 的处理不一致

### 第三类：资源加载错误

图片、脚本、样式表等资源加载失败。

```html
<!-- 这些错误无法被 try-catch 捕获 -->
<img src="/images/broken.png" onerror="handleImageError(this)">
<script src="/js/analytics.js"></script> <!-- 加载失败 -->
<link rel="stylesheet" href="/css/theme.css"> <!-- 加载失败 -->
```

特点：
- 无法被 `window.onerror` 捕获（资源错误不会冒泡到 window）
- 需要用 `addEventListener('error', ..., true)` 在捕获阶段监听
- 可能是 CDN 故障、资源被删除、CORS 问题等
- 对用户体验影响大——图片裂了、样式丢了、脚本不执行

### 第四类：网络请求错误

API 请求失败，包括超时、断网、服务端错误等。

```javascript
// fetch 不会因为 HTTP 状态码是非 2xx 而 reject
// 这是一个常见的坑
const response = await fetch('/api/data');
// response.status === 500 时，这里不会抛异常
// 需要手动检查
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}
```

特点：
- `fetch` 只在网络故障时 reject，HTTP 错误状态码不会触发 reject
- 需要封装统一的请求层来处理 HTTP 错误
- 超时需要自己实现（AbortController）
- 跨域错误可能拿不到详细的错误信息

### 第五类：框架特定错误

React、Vue 等框架有自己的错误处理机制。

```jsx
// React ErrorBoundary 捕获的错误
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 上报错误
    reportError(error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

特点：
- 只能捕获子组件树的渲染错误
- 不能捕获事件处理器中的错误（事件处理器里的错误需要用 try-catch）
- 不能捕获异步代码中的错误
- Vue 有 `onErrorCaptured` 钩子，功能类似

## 错误捕获的完整机制

一个完善的错误监控需要覆盖所有入口：

```javascript
class ErrorCollector {
  constructor(config) {
    this.config = config;
    this.buffer = [];
    this.setupGlobalHandlers();
    this.setupResourceHandler();
    this.setupNetworkInterceptor();
  }

  // 1. 全局 JavaScript 错误
  setupGlobalHandlers() {
    window.addEventListener('error', (event) => {
      // 区分资源错误和 JS 错误
      if (event.target?.tagName) {
        // 资源错误（在捕获阶段才能拿到）
        this.captureResourceError(event.target);
      } else {
        // JS 运行时错误
        this.captureJsError({
          type: 'runtime',
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        });
      }
    }, true); // 注意：资源错误需要在捕获阶段监听

    // 2. 未处理的 Promise 异常
    window.addEventListener('unhandledrejection', (event) => {
      this.captureJsError({
        type: 'unhandledrejection',
        message: event.reason?.message || String(event.reason),
        error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      });
    });
  }

  // 3. 资源加载错误
  setupResourceHandler() {
    // 已在 setupGlobalHandlers 中通过捕获阶段处理
    // 额外处理动态创建的资源
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName, options) {
      const element = originalCreateElement(tagName, options);
      if (['img', 'script', 'link'].includes(tagName.toLowerCase())) {
        element.addEventListener('error', (event) => {
          // 资源加载失败上报
        });
      }
      return element;
    };
  }

  // 4. 网络请求错误（通过封装 fetch 实现）
  setupNetworkInterceptor() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      try {
        const response = await originalFetch(...args);
        
        if (!response.ok) {
          this.captureNetworkError({
            url: args[0],
            status: response.status,
            statusText: response.statusText,
            duration: Date.now() - startTime,
          });
        }
        
        return response;
      } catch (error) {
        this.captureNetworkError({
          url: args[0],
          message: error.message,
          duration: Date.now() - startTime,
          isNetworkError: true,
        });
        throw error;
      }
    };
  }

  captureJsError(errorInfo) {
    const enrichedError = {
      ...errorInfo,
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent,
      stack: errorInfo.error?.stack,
    };
    
    this.buffer.push(enrichedError);
    this.maybeFlush();
  }

  captureResourceError(element) {
    this.buffer.push({
      type: 'resource',
      tagName: element.tagName,
      src: element.src || element.href,
      timestamp: Date.now(),
      url: location.href,
    });
    this.maybeFlush();
  }

  captureNetworkError(info) {
    this.buffer.push({
      type: 'network',
      ...info,
      timestamp: Date.now(),
      url: location.href,
    });
    this.maybeFlush();
  }

  maybeFlush() {
    if (this.buffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  flush() {
    if (this.buffer.length === 0) return;
    
    const data = this.buffer.splice(0);
    navigator.sendBeacon('/api/errors', JSON.stringify({
      errors: data,
      sessionId: this.config.sessionId,
    }));
  }
}
```

## 上报策略：什么时候上报、上报多少

### 采样策略

全量上报所有错误在高流量场景下成本很高。采样是平衡成本和覆盖率的手段。

```javascript
class SamplingStrategy {
  constructor(config) {
    // 不同错误类型可以有不同的采样率
    this.rates = {
      error: config.errorSampleRate ?? 1.0,      // 错误默认全量上报
      performance: config.perfSampleRate ?? 0.1,  // 性能数据 10% 采样
      behavior: config.behaviorSampleRate ?? 0.05, // 行为数据 5% 采样
    };
  }

  shouldReport(type) {
    const rate = this.rates[type] ?? 1.0;
    return Math.random() < rate;
  }
}
```

采样策略的设计要点：
- **错误应该高采样率或全量上报**：错误是最关键的信号，漏掉一个可能意味着漏掉一个影响大量用户的问题
- **性能和行为可以低采样率**：趋势分析不需要每条数据
- **采样率应该是可动态调整的**：线上出问题时需要临时提高采样率
- **采样应该基于会话而非事件**：同一个用户的事件要么全采要么全不采，避免数据不完整

### 上报时机

```javascript
class ReportScheduler {
  constructor() {
    this.queue = [];
    this.flushInterval = 5000; // 5 秒批量上报一次
    this.maxQueueSize = 50;    // 队列满时立即上报
    
    // 定时上报
    setInterval(() => this.flush(), this.flushInterval);
    
    // 页面关闭前上报（用 Beacon API）
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
    
    // 页面卸载时上报
    window.addEventListener('pagehide', () => this.flush());
  }

  add(event) {
    this.queue.push(event);
    if (this.queue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  flush() {
    if (this.queue.length === 0) return;
    
    const data = this.queue.splice(0);
    
    // 优先使用 Beacon API（页面关闭时也能发送）
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      navigator.sendBeacon('/api/collect', blob);
    } else {
      // 降级为 fetch + keepalive
      fetch('/api/collect', {
        method: 'POST',
        body: JSON.stringify(data),
        keepalive: true,
      }).catch(() => {
        // 上报失败，放回队列
        this.queue.unshift(...data);
      });
    }
  }
}
```

### 失败重试与离线缓存

```javascript
class ResilientReporter {
  constructor() {
    this.STORAGE_KEY = 'monitor_pending_events';
    this.MAX_STORED = 100;
  }

  async report(events) {
    try {
      const success = await this.sendToServer(events);
      if (!success) {
        this.storeLocally(events);
      }
    } catch {
      this.storeLocally(events);
    }
    
    // 尝试发送之前缓存的数据
    this.retryStored();
  }

  async sendToServer(events) {
    const response = await fetch('/api/collect', {
      method: 'POST',
      body: JSON.stringify(events),
      keepalive: true,
    });
    return response.ok;
  }

  storeLocally(events) {
    try {
      const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
      const merged = [...stored, ...events].slice(-this.MAX_STORED);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // localStorage 满了或不可用，丢弃旧数据
    }
  }

  async retryStored() {
    try {
      const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
      if (stored.length === 0) return;
      
      const success = await this.sendToServer(stored);
      if (success) {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch {
      // 静默失败
    }
  }
}
```

## 错误聚合与去重

同一个 bug 可能在一分钟内被一万个用户触发，如果不去重，你会收到一万条一模一样的告警。

### 错误指纹（Fingerprint）

错误去重的核心是生成一个稳定的"指纹"——相同根因的错误应该有相同的指纹。

```javascript
function generateFingerprint(error) {
  const parts = [
    error.type,
    error.message?.replace(/\d+/g, 'N').replace(/["'][^"']*["']/g, 'STR'),
    // 堆栈只取前 3 帧，去掉行号（因为行号在不同构建中可能变化）
    ...(error.stackFrames || []).slice(0, 3).map(
      frame => `${frame.functionName}@${frame.fileName}`
    ),
  ];
  
  // 生成简单哈希
  return hashString(parts.join('|'));
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转为 32 位整数
  }
  return hash.toString(36);
}
```

指纹设计的要点：
- 去掉行号和列号（构建后可能变化）
- 去掉错误消息中的动态部分（ID、URL、数值）
- 保留函数名和文件名
- 只取前几帧堆栈（后面的帧可能因调用路径不同而变化）

### 聚合维度

除了去重，还需要按多个维度聚合：

- **按错误类型**：TypeError、ReferenceError 各有多少
- **按页面**：哪些页面错误最多
- **按浏览器**：是否只在特定浏览器出现
- **按版本**：新版本发布后错误是否增加
- **按影响用户数**：同一个错误影响了多少用户

## 告警设计：什么时候该叫人

告警的核心挑战是平衡灵敏度和噪音。

```javascript
// 告警规则示例
const alertRules = [
  {
    name: '新错误类型出现',
    condition: (data) => data.newErrorTypes > 0,
    severity: 'warning',
    cooldown: '10m', // 同一错误 10 分钟内不重复告警
  },
  {
    name: '错误率突增',
    condition: (data) => data.errorRate > data.baselineErrorRate * 3,
    severity: 'critical',
    cooldown: '5m',
  },
  {
    name: '特定页面错误率异常',
    condition: (data) => {
      return data.pageErrorRates.some(
        page => page.rate > 0.05 && page.sessions > 100
      );
    },
    severity: 'critical',
    cooldown: '15m',
  },
  {
    name: '资源加载失败率上升',
    condition: (data) => data.resourceErrorRate > 0.1,
    severity: 'warning',
    cooldown: '30m',
  },
];
```

告警设计的原则：
- **分级**：critical（必须立刻处理）、warning（工作时间处理）、info（记录即可）
- **去抖**：相同告警在冷却时间内不重复发送
- **上下文**：告警消息要包含足够的排查信息
- **升级**：无人处理的告警应该升级（比如 15 分钟无人响应就电话通知）

## 本课小结

1. **错误分类**：JS 运行时错误、Promise 异常、资源加载错误、网络请求错误、框架错误
2. **捕获机制**：window.onerror、unhandledrejection、error 捕获阶段、fetch 拦截、ErrorBoundary
3. **上报策略**：批量上报、Beacon API、失败重试、离线缓存
4. **采样设计**：错误高采样率，性能和行为可低采样率，基于会话采样
5. **聚合去重**：通过错误指纹识别相同根因，按多维度聚合
6. **告警设计**：分级、去抖、上下文、升级机制

## 练习

### 练习一：错误分类练习

判断以下错误属于哪种类型，并说明应该用什么机制捕获：

1. 用户点击按钮后，`document.getElementById('result').textContent = data.name` 报错，因为 `data` 是 `null`
2. 页面上的第三方广告脚本加载失败
3. `await fetch('/api/order')` 返回 500
4. React 组件的 `render` 方法中访问了不存在的 props
5. `new Promise((resolve, reject) => { reject(new Error('fail')) })` 没有 `.catch()`

### 练习二：设计错误指纹

为以下两个错误设计指纹，判断它们是否应该被聚合为同一个错误：

错误 A（开发环境）：
```
TypeError: Cannot read properties of undefined (reading 'name')
    at UserCard (http://localhost:3000/src/components/UserCard.tsx:15:23)
    at renderWithHooks (http://localhost:3000/node_modules/react-dom/.../react-dom.development.js:14985:18)
```

错误 B（生产环境）：
```
TypeError: Cannot read properties of undefined (reading 'name')
    at UserCard (https://cdn.example.com/static/js/main.a1b2c3d4.js:1:2847)
    at renderWithHooks (https://cdn.example.com/static/js/main.a1b2c3d4.js:1:15234)
```

## 参考答案

### 练习一

1. **JS 运行时错误** → `window.onerror` 或 `addEventListener('error')`。根因是接口返回了 null，应该在代码中做空值保护
2. **资源加载错误** → `addEventListener('error', handler, true)` 在捕获阶段监听。第三方脚本通常无法控制，但需要知道它失败了
3. **网络请求错误** → 封装 `fetch`，检查 `response.ok`。`fetch` 不会因为 500 而 reject
4. **框架渲染错误** → React ErrorBoundary 的 `componentDidCatch`。注意只能捕获渲染过程中的错误
5. **未处理的 Promise 异常** → `addEventListener('unhandledrejection')`。或者在创建 Promise 时就加上 `.catch()`

### 练习二

它们**应该被聚合为同一个错误**。虽然堆栈的 URL 和行号不同，但：
- 错误类型相同：`TypeError`
- 错误消息相同：`Cannot read properties of undefined (reading 'name')`
- 函数名相同：`UserCard`
- 根因相同：在 `UserCard` 组件中访问了 undefined 的 `name` 属性

指纹应该只保留 `TypeError|Cannot read properties of undefined (reading 'N')|UserCard`，忽略 URL 和行号。

## 下一步

完成本课后，继续学习 [03. 前端错误捕获与上报](./03-error-capture-and-report.md)。
