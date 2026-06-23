# 03. 前端错误捕获与上报

> window.onerror、unhandledrejection、React ErrorBoundary、try-catch——每个捕获点的能力边界和正确用法

## 本课目标

- 掌握前端所有错误捕获入口的工作原理和能力边界
- 理解 `window.onerror` 和 `addEventListener('error')` 的区别
- 掌握 `unhandledrejection` 的捕获机制和浏览器兼容性
- 实现 React ErrorBoundary 并理解它能捕获什么、不能捕获什么
- 正确使用 try-catch 处理局部错误
- 构建完整的错误捕获层

## 一个常见的错误

很多团队的错误监控只做了"一半"：

```javascript
// 只做了这一层
window.onerror = (message, source, lineno, colno, error) => {
  reportError(error);
};
```

然后线上出现了一个问题：用户的页面白屏了，但监控系统没有收到任何错误。

排查后发现，白屏的原因是一个图片 CDN 挂了，但资源加载错误不会触发 `window.onerror`。这个错误需要在捕获阶段监听才能拿到。

这节课的目标是帮你建立完整的错误捕获层，不遗漏任何一种错误。

## window.onerror：最基础的捕获点

```javascript
window.onerror = (message, source, lineno, colno, error) => {
  console.log({
    message,    // 错误消息："Uncaught TypeError: Cannot read..."
    source,     // 发生错误的文件URL
    lineno,     // 行号
    colno,      // 列号
    error,      // Error 对象（可能为 null）
  });
  return true; // 返回 true 阻止浏览器默认行为（控制台输出）
};
```

`window.onerror` 的特点：
- 能捕获**未被 try-catch 的运行时错误**
- 能捕获**语法错误**（但此时 error 对象可能为 null）
- **不能捕获**资源加载错误（img、script、link）
- **不能捕获**跨域脚本的错误（除非设置了 CORS）
- **不能捕获**Promise 异常
- 只能注册一个处理函数（后注册的会覆盖先注册的）

### 跨域脚本的错误处理

当错误发生在跨域脚本中时，浏览器出于安全考虑会隐藏错误详情：

```javascript
// 跨域脚本的错误会被"蒸馏"成这样：
window.onerror = (message, source, lineno, colno, error) => {
  // message: "Script error."
  // source: ""  （空的）
  // lineno: 0
  // colno: 0
  // error: null
  // 
  // 什么有用信息都没有
};
```

要获取跨域脚本的错误详情，需要两个条件：

```html
<!-- 1. 脚本标签设置 crossorigin 属性 -->
<script src="https://cdn.example.com/lib.js" crossorigin="anonymous"></script>

<!-- 2. CDN 服务器设置 CORS 响应头 -->
<!-- Access-Control-Allow-Origin: * -->
```

这两个条件缺一不可。很多团队在接入第三方 SDK 时遇到"Script error."就是因为没有配置 `crossorigin` 属性。

## addEventListener('error')：更灵活的替代方案

```javascript
window.addEventListener('error', (event) => {
  // event 对象包含的信息比 onerror 回调参数更丰富
  console.log({
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    type: event.type, // 'error'
  });
});
```

`addEventListener('error')` 和 `window.onerror` 的主要区别：

| 特性 | window.onerror | addEventListener('error') |
|------|---------------|--------------------------|
| 注册数量 | 只能一个 | 可以多个 |
| 资源错误 | 不能捕获 | 可以（捕获阶段） |
| 返回值 | return true 阻止默认 | event.preventDefault() |
| 使用场景 | 全局兜底 | 更灵活的错误处理 |

### 捕获资源加载错误

资源加载错误是 `window.onerror` 盲区。必须在**捕获阶段**监听：

```javascript
// useCapture = true，关键！
window.addEventListener('error', (event) => {
  // 区分资源错误和 JS 错误
  const target = event.target;
  if (target && target.tagName) {
    // 这是资源加载错误
    const resourceInfo = {
      type: 'resource-error',
      tagName: target.tagName,       // IMG, SCRIPT, LINK...
      src: target.src || target.href, // 资源URL
      outerHTML: target.outerHTML,    // 完整HTML（可能有用）
    };
    reportError(resourceInfo);
    
    // 阻止事件继续冒泡（可选）
    event.stopPropagation();
  }
}, true); // 注意这里的 true
```

为什么需要捕获阶段？因为资源加载错误不会冒泡到 window。它只在目标元素上触发，然后就被消费了。只有在捕获阶段，window 上的监听器才能拦截到它。

```html
<!-- 资源错误的事件流 -->
<!-- 捕获阶段: window → document → html → body → img  -->
<!-- 目标阶段: img（错误在这里触发）                    -->
<!-- 冒泡阶段: 不会冒泡（没有冒泡阶段）                -->
```

## unhandledrejection：Promise 异常的捕获

```javascript
window.addEventListener('unhandledrejection', (event) => {
  // event.promise: 触发 rejection 的 Promise 对象
  // event.reason: rejection 的原因（通常是 Error 对象）
  
  const error = event.reason;
  
  if (error instanceof Error) {
    reportError({
      type: 'unhandledrejection',
      message: error.message,
      stack: error.stack,
    });
  } else {
    // reason 可能不是 Error 对象
    reportError({
      type: 'unhandledrejection',
      message: String(error),
      rawReason: error,
    });
  }
  
  // 阻止浏览器默认行为（控制台输出）
  event.preventDefault();
});
```

### 常见的 Promise 异常场景

```javascript
// 场景 1：async 函数中的错误
async function loadUser() {
  const res = await fetch('/api/user');
  const data = await res.json();
  return data.name; // 如果 res 不是 200，这里可能出错
}
loadUser(); // 没有 .catch()，触发 unhandledrejection

// 场景 2：then 中的错误
fetch('/api/data')
  .then(res => res.json())
  .then(data => {
    processData(data); // 如果 processData 抛异常
  });
  // 没有 .catch()

// 场景 3：Promise 构造函数中的同步错误
new Promise(() => {
  throw new Error('sync error in promise');
});
// 触发 unhandledrejection
```

### 浏览器兼容性注意

`unhandledrejection` 事件在不同浏览器中的行为有差异：

```javascript
// Chrome/Edge：reason 可以是任何值
// Firefox：reason 通常是 Error 对象
// Safari：早期版本可能不支持

// 兼容性处理
window.addEventListener('unhandledrejection', (event) => {
  let error = event.reason;
  
  // 确保我们有一个 Error 对象
  if (!(error instanceof Error)) {
    error = new Error(
      typeof error === 'object' ? JSON.stringify(error) : String(error)
    );
  }
  
  reportError({
    type: 'unhandledrejection',
    message: error.message,
    stack: error.stack,
  });
});
```

## React ErrorBoundary：框架级错误捕获

React 16 引入了 Error Boundary 机制，专门捕获组件树中的渲染错误。

### 基础实现

```jsx
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // 更新 state，下次渲染时展示降级 UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // errorInfo.componentStack 包含组件调用栈
    this.props.onError?.(error, errorInfo);
    
    // 上报错误
    reportToMonitoring({
      error,
      componentStack: errorInfo.componentStack,
      errorBoundary: this.props.name || 'Unknown',
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }
      return <div>Something went wrong.</div>;
    }
    return this.props.children;
  }
}
```

### 使用方式

```jsx
function App() {
  return (
    <ErrorBoundary name="App" fallback={(error) => <FullPageError error={error} />}>
      <Header />
      <ErrorBoundary name="Main">
        <MainContent />
      </ErrorBoundary>
      <Footer />
    </ErrorBoundary>
  );
}
```

### ErrorBoundary 能捕获什么

```jsx
// ✅ 能捕获：子组件渲染过程中的错误
function UserProfile({ user }) {
  return <div>{user.name}</div>; // 如果 user 是 undefined，ErrorBoundary 捕获
}

// ❌ 不能捕获：事件处理器中的错误
function Button() {
  const handleClick = () => {
    throw new Error('click error'); // ErrorBoundary 捕获不到
    // 需要用 try-catch
  };
  return <button onClick={handleClick}>Click</button>;
}

// ❌ 不能捕获：异步代码中的错误
function DataLoader() {
  useEffect(() => {
    fetch('/api/data').then(res => {
      if (!res.ok) throw new Error('fetch failed'); // ErrorBoundary 捕获不到
    });
  }, []);
  return <div>Loading...</div>;
}

// ❌ 不能捕获：ErrorBoundary 自身的错误（如果在渲染时抛出）
class BadBoundary extends React.Component {
  render() {
    if (this.state.hasError) {
      throw new Error('fallback also throws'); // 无限循环
    }
    return this.props.children;
  }
}
```

### Hooks 版本的 ErrorBoundary

React 官方没有提供 Hooks 版本的 ErrorBoundary，但社区有实现：

```jsx
// 使用 react-error-boundary 库
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div role="alert">
          <p>Something went wrong:</p>
          <pre>{error.message}</pre>
          <button onClick={resetErrorBoundary}>Try again</button>
        </div>
      )}
      onError={(error, info) => {
        reportToMonitoring(error, info.componentStack);
      }}
    >
      <MyComponent />
    </ErrorBoundary>
  );
}
```

## try-catch：局部错误处理

try-catch 是最基本的错误处理方式，在监控系统中主要用于：

### 包裹不确定的代码

```javascript
// 包裹第三方库调用
function parseUserData(rawData) {
  try {
    return thirdPartyParser.parse(rawData);
  } catch (error) {
    reportError({
      type: 'third-party',
      library: 'thirdPartyParser',
      message: error.message,
      rawData: truncate(rawData, 500), // 不要上报完整数据，可能很大
    });
    return null; // 降级返回
  }
}

// 包裹 JSON 解析
function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
```

### 包裹 async/await

```javascript
async function loadOrderDetail(orderId) {
  try {
    const response = await fetch(`/api/orders/${orderId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    reportError({
      type: 'api-error',
      endpoint: `/api/orders/${orderId}`,
      message: error.message,
    });
    throw error; // 重新抛出，让上层处理 UI
  }
}
```

### try-catch 的性能考虑

```javascript
// V8 引擎的优化历史
// 早期版本：try-catch 会阻止函数优化
// 现代 V8（Node 10+, Chrome 60+）：try-catch 不再阻止优化

// 现在这样写完全没问题
function riskyOperation() {
  try {
    // 复杂逻辑
  } catch (error) {
    // 错误处理
  }
}

// 但不要在热路径中用 try-catch 包裹大量代码
// 不是因为性能，而是因为错误边界不清晰
```

## 构建完整的错误捕获层

把所有捕获点组合在一起：

```javascript
class ErrorCaptureLayer {
  constructor(options = {}) {
    this.reporter = options.reporter;
    this.setupAll();
  }

  setupAll() {
    this.captureJsErrors();
    this.capturePromiseRejections();
    this.captureResourceErrors();
    this.captureConsoleErrors();
  }

  // JavaScript 运行时错误
  captureJsErrors() {
    window.addEventListener('error', (event) => {
      // 过滤资源错误（在 captureResourceErrors 中处理）
      if (event.target?.tagName) return;
      
      this.report({
        category: 'js-error',
        message: event.message,
        filename: event.filename,
        position: `${event.lineno}:${event.colno}`,
        stack: event.error?.stack,
      });
    });
  }

  // Promise 异常
  capturePromiseRejections() {
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const isError = reason instanceof Error;
      
      this.report({
        category: 'promise-rejection',
        message: isError ? reason.message : String(reason),
        stack: isError ? reason.stack : undefined,
      });
    });
  }

  // 资源加载错误
  captureResourceErrors() {
    window.addEventListener('error', (event) => {
      const target = event.target;
      if (!target?.tagName) return;
      
      this.report({
        category: 'resource-error',
        tagName: target.tagName,
        url: target.src || target.href,
      });
    }, true);
  }

  // console.error 也捕获（有些库用 console.error 报错）
  captureConsoleErrors() {
    const originalError = console.error;
    console.error = (...args) => {
      originalError.apply(console, args);
      
      // 从参数中提取有用信息
      const error = args.find(arg => arg instanceof Error);
      this.report({
        category: 'console-error',
        message: args.map(arg => 
          arg instanceof Error ? arg.message : String(arg)
        ).join(' '),
        stack: error?.stack,
      });
    };
  }

  report(data) {
    const enriched = {
      ...data,
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent,
    };
    
    this.reporter.send(enriched);
  }
}
```

## 错误上报的数据结构

上报的数据应该包含足够的上下文用于排查：

```javascript
interface ErrorReport {
  // 基础信息
  category: 'js-error' | 'promise-rejection' | 'resource-error' | 'network-error';
  message: string;
  stack?: string;
  
  // 错误位置
  filename?: string;
  position?: string; // "lineno:colno"
  
  // 环境信息
  url: string;
  userAgent: string;
  screenResolution: string;
  networkType: string;
  
  // 用户上下文
  userId?: string;
  sessionId: string;
  
  // 业务上下文
  pageName?: string;
  featureFlags?: Record<string, boolean>;
  breadcrumbs?: Breadcrumb[]; // 用户操作路径
}

interface Breadcrumb {
  timestamp: number;
  type: 'navigation' | 'click' | 'http' | 'console';
  message: string;
  data?: Record<string, unknown>;
}
```

### 面包屑（Breadcrumbs）

面包屑记录用户在错误发生前的操作路径，对排查问题非常有用：

```javascript
class BreadcrumbCollector {
  constructor(maxBreadcrumbs = 30) {
    this.breadcrumbs = [];
    this.max = maxBreadcrumbs;
    this.setup();
  }

  add(type, message, data) {
    this.breadcrumbs.push({
      timestamp: Date.now(),
      type,
      message,
      data,
    });
    
    if (this.breadcrumbs.length > this.max) {
      this.breadcrumbs.shift();
    }
  }

  setup() {
    // 记录路由变化
    const originalPushState = history.pushState;
    history.pushState = (...args) => {
      this.add('navigation', `Route: ${args[2]}`);
      return originalPushState.apply(history, args);
    };

    // 记录点击事件
    document.addEventListener('click', (event) => {
      const target = event.target;
      const description = target.tagName + 
        (target.id ? `#${target.id}` : '') +
        (target.className ? `.${target.className.split(' ')[0]}` : '');
      this.add('click', description);
    }, true);

    // 记录网络请求
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      this.add('http', `Fetch: ${url}`);
      return originalFetch.apply(window, args);
    };
  }

  getAll() {
    return [...this.breadcrumbs];
  }
}
```

## 常见误区

### 误区一：用 try-catch 包裹所有代码

**错误理解**：为了不漏掉任何错误，把所有代码都放在 try-catch 里

**正确理解**：try-catch 应该用于"可预期的可能失败"的操作。全局错误用 `window.onerror` 和 `unhandledrejection` 捕获。到处写 try-catch 只会让代码难以阅读，而且 try-catch 内的错误被吞掉后，上层无法感知。

### 误区二：ErrorBoundary 能替代全局错误捕获

**错误理解**：用了 ErrorBoundary 就不需要 window.onerror 了

**正确理解**：ErrorBoundary 只能捕获 React 组件树的渲染错误。事件处理器、异步代码、非 React 代码的错误都需要其他捕获方式。

### 误区三：上报了错误就算完成了

**错误理解**：错误被 try-catch 捕获并上报了，任务完成

**正确理解**：上报只是第一步。还需要：Source Map 还原（下一课讲）、错误聚合去重、告警通知、错误状态管理（已确认、已修复、已忽略）、回归验证。

## 本课小结

1. **window.onerror**：全局 JS 错误捕获，但不能捕获资源错误和 Promise 异常
2. **addEventListener('error')**：更灵活，捕获阶段可以捕获资源错误
3. **unhandledrejection**：Promise 异常的唯一捕获方式
4. **ErrorBoundary**：React 渲染错误的捕获，不能捕获事件和异步错误
5. **try-catch**：局部错误处理，用于可预期的失败点
6. **面包屑**：记录用户操作路径，辅助错误排查

## 练习

### 练习一：识别错误捕获方式

以下代码中的错误分别应该用什么方式捕获？写出捕获代码。

```jsx
function OrderPage() {
  const [order, setOrder] = useState(null);
  
  // 1. 加载订单数据
  useEffect(() => {
    fetchOrder(id).then(setOrder);
  }, [id]);
  
  // 2. 渲染订单
  return (
    <div>
      <h1>{order.title}</h1>
      <button onClick={() => {
        // 3. 删除订单
        deleteOrder(order.id);
      }}>删除</button>
    </div>
  );
}
```

### 练习二：实现一个带面包屑的 ErrorBoundary

实现一个 React ErrorBoundary 组件，要求：
- 捕获子组件渲染错误
- 记录最近 10 条用户操作（点击、路由变化）
- 错误发生时，将错误信息和面包屑一起上报
- 提供"重试"按钮

## 参考答案

### 练习一

```jsx
// 1. 加载订单数据 —— async 错误 + ErrorBoundary
// fetchOrder 可能失败，需要 try-catch 或 .catch()
useEffect(() => {
  fetchOrder(id)
    .then(setOrder)
    .catch(error => {
      reportError({ type: 'api-error', endpoint: 'fetchOrder', error });
      // 设置错误状态，展示错误 UI
    });
}, [id]);

// 2. 渲染订单 —— ErrorBoundary
// order 可能是 null，需要空值保护
// 用 ErrorBoundary 包裹，或者在渲染时判断
return order ? <h1>{order.title}</h1> : <Loading />;

// 3. 删除订单 —— try-catch（事件处理器中）
onClick={async () => {
  try {
    await deleteOrder(order.id);
  } catch (error) {
    reportError({ type: 'action-error', action: 'deleteOrder', error });
    toast.error('删除失败，请重试');
  }
}}
```

完整的防护方案：

```jsx
<ErrorBoundary name="OrderPage" onError={reportError}>
  <OrderPage />
</ErrorBoundary>
```

### 练习二

```jsx
class BreadcrumbErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.breadcrumbs = [];
    this.maxBreadcrumbs = 10;
    
    // 监听点击事件
    document.addEventListener('click', (e) => {
      this.addBreadcrumb('click', e.target.tagName + (e.target.id ? `#${e.target.id}` : ''));
    }, true);
  }

  addBreadcrumb(type, message) {
    this.breadcrumbs.push({ type, message, time: Date.now() });
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    reportToMonitoring({
      error: { message: error.message, stack: error.stack },
      componentStack: errorInfo.componentStack,
      breadcrumbs: this.breadcrumbs,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <p>Something went wrong.</p>
          <button onClick={this.handleRetry}>重试</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

## 下一步

完成本课后，继续学习 [04. Source Map 管理与错误还原](./04-sourcemap-management.md)。
