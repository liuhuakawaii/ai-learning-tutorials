# 06. 微前端落地实践与踩坑 —— 样式隔离、JS 沙箱、通信机制、共享依赖

> 选型只是开始，真正的挑战在落地——那些文档里不会告诉你的坑

## 本课目标

- 掌握微前端样式隔离的三种方案及其局限
- 理解 JS 沙箱的工作原理和边界
- 设计可靠的跨应用通信机制
- 解决共享依赖的版本冲突问题
- 处理微前端中的常见 bug 和性能问题

## 样式隔离

样式冲突是微前端中最常见的问题。子应用的 CSS 可能影响主应用或其他子应用。

### 问题复现

```css
/* 子应用 A 的样式 */
.title {
  font-size: 24px;
  color: red;
}

/* 子应用 B 的样式 */
.title {
  font-size: 16px;
  color: blue;
}

/* 如果两个子应用同时加载，.title 的样式会互相覆盖 */
```

### 方案一：CSS Modules / Scoped CSS

```typescript
// CSS Modules（推荐用于新项目）
// 子应用的样式自动添加 hash 后缀
import styles from './Title.module.css';

function Title() {
  return <h1 className={styles.title}>Hello</h1>;
}

// 编译后：
// .title_abc123 { font-size: 24px; color: red; }

// Vue 的 scoped CSS
// <style scoped>
// .title { font-size: 24px; }
// </style>
// 编译后：
// .title[data-v-7ba5bd90] { font-size: 24px; }
```

```
优势：
- 每个组件的样式天然隔离
- 不需要额外配置
- 开发体验好

局限：
- 第三方库的样式（antd、element-ui）无法隔离
- 全局样式（body、html）还是会冲突
- CSS 选择器权重问题可能仍然存在
```

### 方案二：Shadow DOM

```typescript
// Shadow DOM 提供最强的样式隔离
function ShadowContainer({ children, styles }: { children: React.ReactNode; styles: string }) {
  const shadowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shadowRef.current && !shadowRef.current.shadowRoot) {
      const shadow = shadowRef.current.attachShadow({ mode: 'open' });

      // 注入样式
      const style = document.createElement('style');
      style.textContent = styles;
      shadow.appendChild(style);

      // 渲染内容
      const container = document.createElement('div');
      shadow.appendChild(container);

      ReactDOM.createRoot(container).render(children);
    }
  }, [children, styles]);

  return <div ref={shadowRef} />;
}

// 使用
function MicroApp() {
  return (
    <ShadowContainer styles={appStyles}>
      <App />
    </ShadowContainer>
  );
}
```

```
优势：
- 最强的样式隔离（外部样式完全不影响内部）
- 内部样式也不会泄露到外部

局限：
- 弹窗、下拉框可能无法超出 Shadow DOM 边界
- 某些第三方库不兼容 Shadow DOM
- 浏览器兼容性（IE 不支持）
- 调试困难
```

### 方案三：CSS 命名空间

```css
/* 给每个子应用的样式添加命名空间前缀 */
/* 子应用 A */
.micro-app-a .title {
  font-size: 24px;
  color: red;
}

/* 子应用 B */
.micro-app-b .title {
  font-size: 16px;
  color: blue;
}
```

```typescript
// 在构建时自动添加前缀
// postcss 插件
module.exports = {
  plugins: [
    require('postcss-prefix-selector')({
      prefix: '.micro-app-user',
      transform(prefix, selector, prefixedSelector) {
        // 不给 body、html 等全局选择器加前缀
        if (['body', 'html', ':root'].includes(selector)) {
          return selector;
        }
        return prefixedSelector;
      },
    }),
  ],
};
```

```
优势：
- 实现简单，不需要框架支持
- 兼容性好
- 对第三方库样式也有效

局限：
- 需要每个子应用配置不同的前缀
- 第三方库的样式可能需要特殊处理
- 选择器权重可能变化
```

### qiankun 的样式隔离方案

```typescript
// qiankun 内置两种样式隔离模式
start({
  sandbox: {
    // 严格模式：每个子应用的样式都在独立的 scope 中
    // 使用 CSS Module 的方式，给每个选择器添加子应用的前缀
    strictStyleIsolation: true,

    // 实验模式：使用 Shadow DOM
    // experimentalStyleIsolation: true,
  },
});

// 严格模式的原理：
// 子应用的 <style> 标签会被包装在一个特定的选择器下
// 原始：.title { color: red; }
// 处理后：.micro-app-user__title { color: red; }
```

## JS 沙箱

JS 沙箱的目的是隔离子应用的全局变量，防止互相影响。

### 问题复现

```typescript
// 子应用 A 修改了全局变量
window.APP_NAME = 'App A';
window.addEventListener('resize', handlerA);

// 子应用 B 也修改了同一个全局变量
window.APP_NAME = 'App B';
window.addEventListener('resize', handlerB);

// 子应用 A 卸载后：
// window.APP_NAME 还是 'App B'
// resize 事件有两个 handler，handlerA 没有被清理
```

### Proxy 沙箱（qiankun 的默认方案）

```typescript
// qiankun 的 Proxy 沙箱原理
class ProxySandbox {
  private proxy: WindowProxy;
  private fakeWindow: Record<string, any> = {};

  constructor() {
    const rawWindow = window;
    const fakeWindow = this.fakeWindow;

    this.proxy = new Proxy(window, {
      get(target, key) {
        // 优先从 fakeWindow 读取
        if (key in fakeWindow) {
          return fakeWindow[key];
        }
        // 否则从真实 window 读取
        return target[key];
      },
      set(target, key, value) {
        // 写入到 fakeWindow，不影响真实 window
        fakeWindow[key] = value;
        return true;
      },
      has(target, key) {
        return key in fakeWindow || key in target;
      },
    });
  }
}

// 使用
const sandbox = new ProxySandbox();
const proxyWindow = sandbox.proxy;

// 子应用代码在 proxyWindow 上下文中执行
proxyWindow.APP_NAME = 'App A'; // 只写入 fakeWindow
console.log(window.APP_NAME); // undefined，真实 window 不受影响
```

### 快照沙箱（IE 兼容方案）

```typescript
// IE 不支持 Proxy，使用快照方式
class SnapshotSandbox {
  private snapshot: Record<string, any> = {};

  // 激活时：保存当前 window 的快照，恢复上次的状态
  activate() {
    this.snapshot = { ...window };
    // 恢复上次子应用修改的 window 状态
    Object.keys(this.modifyMap).forEach((key) => {
      window[key] = this.modifyMap[key];
    });
  }

  // 失活时：保存子应用修改的状态，恢复快照
  deactivate() {
    this.modifyMap = {};
    Object.keys(window).forEach((key) => {
      if (window[key] !== this.snapshot[key]) {
        this.modifyMap[key] = window[key];
        window[key] = this.snapshot[key];
      }
    });
  }
}
```

### JS 沙箱的局限

```
1. 无法隔离 DOM 事件
   - addEventListener 在 window 上的事件需要手动清理
   - 子应用卸载时需要清理所有事件监听

2. 无法隔离定时器
   - setTimeout/setInterval 需要在子应用卸载时清理
   - qiankun 会劫持这两个 API，但需要子应用配合

3. 无法隔离异步操作
   - Promise、fetch 等异步操作在沙箱外执行
   - 子应用卸载后，异步回调可能仍然执行

4. 性能开销
   - Proxy 沙箱每次访问 window 都会触发拦截
   - 在频繁操作 DOM 的场景下可能有性能影响
```

## 通信机制

微前端中的通信有多种方式，选择哪种取决于数据的特点和更新频率。

### 方案一：Props 传递

```typescript
// 最简单的通信方式：主应用通过 props 传递数据
// 主应用
registerMicroApps([
  {
    name: 'user-app',
    props: {
      userInfo: getUserInfo(),
      theme: getTheme(),
      onMessage: (msg) => console.log('收到消息：', msg),
    },
  },
]);

// 子应用
export function mount(props) {
  const { userInfo, theme, onMessage } = props;
  // 使用 props
  ReactDOM.render(<App user={userInfo} theme={theme} onMessage={onMessage} />, container);
}
```

### 方案二：全局状态管理

```typescript
// 主应用创建全局状态，子应用订阅变化
// qiankun 的 initGlobalState
import { initGlobalState } from 'qiankun';

const actions = initGlobalState({
  user: null,
  theme: 'light',
});

// 子应用
export function mount(props) {
  props.onGlobalStateChange((state, prev) => {
    // 状态变化时更新子应用
    updateAppState(state);
  });

  // 子应用也可以修改全局状态
  props.setGlobalState({ theme: 'dark' });
}
```

### 方案三：自定义事件

```typescript
// 使用浏览器原生的 CustomEvent
// 主应用
function notifyThemeChange(theme: string) {
  window.dispatchEvent(new CustomEvent('micro-app-theme-change', {
    detail: { theme },
  }));
}

// 子应用
useEffect(() => {
  const handler = (event: CustomEvent) => {
    setTheme(event.detail.theme);
  };
  window.addEventListener('micro-app-theme-change', handler);
  return () => window.removeEventListener('micro-app-theme-change', handler);
}, []);
```

### 方案四：URL 参数

```typescript
// 适合简单的数据传递，如当前选中的 ID
// 主应用
<iframe src={`/user-app?userId=${selectedUserId}&theme=dark`} />

// 子应用
const params = new URLSearchParams(window.location.search);
const userId = params.get('userId');
const theme = params.get('theme');
```

### 通信方案选择

```
通信方式      适用场景                    限制
────────────────────────────────────────────────
Props         初始化数据、回调函数        单向，子应用无法主动通知主应用
全局状态      需要双向同步的数据          需要框架支持
自定义事件    松耦合的通信                需要手动清理事件监听
URL 参数      简单的配置数据              只能传字符串，长度有限
postMessage   跨域场景                    需要序列化，异步
```

## 共享依赖

多个子应用使用相同的库（React、antd、lodash），如果不共享，每个子应用都会打包一份，浪费带宽和内存。

### 问题

```
没有共享依赖：
  子应用 A：react (40KB) + antd (300KB) + lodash (70KB)
  子应用 B：react (40KB) + antd (300KB) + lodash (70KB)
  子应用 C：react (40KB) + antd (300KB) + lodash (70KB)
  总共加载：1230KB

共享依赖后：
  公共：react (40KB) + antd (300KB) + lodash (70KB)
  子应用 A：自己的代码 (50KB)
  子应用 B：自己的代码 (80KB)
  子应用 C：自己的代码 (60KB)
  总共加载：600KB
```

### qiankun 的 externals 方案

```typescript
// 主应用加载公共库
// index.html
<script src="https://cdn.example.com/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdn.example.com/react-dom/18.2.0/umd/react-dom.production.min.js"></script>

// 子应用配置 externals
// webpack.config.js
module.exports = {
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
  },
};

// vite.config.js
export default {
  build: {
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
};
```

### Module Federation 的 shared 方案

```typescript
// Module Federation 原生支持共享依赖
new ModuleFederationPlugin({
  name: 'appA',
  shared: {
    react: {
      singleton: true,        // 只加载一个版本
      requiredVersion: '^18.0.0',
      eager: true,            // 主应用立即加载
    },
    'react-dom': {
      singleton: true,
      requiredVersion: '^18.0.0',
      eager: true,
    },
    antd: {
      singleton: true,
      requiredVersion: '^5.0.0',
    },
  },
});

// shared 的行为：
// 1. 主应用加载 React 18.2.0
// 2. 子应用 A 需要 React ^18.0.0 → 使用主应用的版本
// 3. 子应用 B 需要 React ^17.0.0 → 不兼容，加载自己的版本
// 4. singleton: true 确保只有一个版本被加载
```

### 共享依赖的版本冲突

```typescript
// 问题：不同子应用依赖不同版本的库
// 子应用 A：antd@5.0.0
// 子应用 B：antd@4.24.0

// 解决方案：
// 1. 统一版本（最简单，但需要协调各团队）
// 2. 使用 semver 范围匹配
shared: {
  antd: {
    singleton: false, // 不强制单例
    requiredVersion: '>=4.0.0',
  },
}

// 3. 按子应用分组，相同版本的子应用共享
// 主应用为每组维护不同的 shared 配置
```

## 常见踩坑

### 坑 1：子应用卸载不干净

```typescript
// 问题：子应用卸载后，事件监听、定时器、全局变量没有清理
// 导致内存泄漏和行为异常

// 解决：在 unmount 生命周期中清理
export async function unmount(props) {
  // 清理 React 树
  ReactDOM.unmountComponentAtNode(props.container.querySelector('#root'));

  // 清理全局事件
  window.removeEventListener('resize', resizeHandler);

  // 清理定时器
  clearInterval(timer);

  // 清理全局变量
  delete window.APP_NAME;
}
```

### 坑 2：子应用之间的路由冲突

```typescript
// 问题：主应用和子应用都使用 history 模式
// 主应用路由：/user/list
// 子应用路由：/list
// 子应用的 /list 会匹配到主应用的路由

// 解决：
// 1. 子应用设置路由前缀
// 子应用配置
registerMicroApps([
  {
    name: 'user-app',
    activeRule: '/user',
    // 子应用的路由需要加 /user 前缀
  },
]);

// 2. 使用 hash 路由（简单但 URL 不好看）
// 3. 在 activeRule 中使用精确匹配
```

### 坑 3：弹窗和下拉框被截断

```typescript
// 问题：子应用的弹窗、下拉框被容器的 overflow: hidden 截断

// 解决方案 1：使用 teleport/portal 将弹窗渲染到 body
// React
function Modal({ children }) {
  return ReactDOM.createPortal(
    <div className="modal-overlay">
      <div className="modal-content">{children}</div>
    </div>,
    document.body
  );
}

// Vue 3
// <Teleport to="body">
//   <div class="modal">...</div>
// </Teleport>

// 解决方案 2：修改容器的 overflow
// 根据弹窗状态动态调整容器样式
```

### 坑 4：子应用静态资源加载失败

```typescript
// 问题：子应用打包后的静态资源（图片、字体）路径错误
// 因为子应用部署在子路径下，但打包时用的是根路径

// 解决：
// webpack 配置 publicPath
module.exports = {
  output: {
    publicPath: process.env.NODE_ENV === 'production'
      ? 'https://cdn.example.com/user-app/'
      : 'http://localhost:8081/',
  },
};

// vite 配置 base
export default {
  base: process.env.NODE_ENV === 'production'
    ? 'https://cdn.example.com/user-app/'
    : 'http://localhost:8081/',
};
```

## 练习

### 练习一：样式隔离方案选择

为以下场景选择最合适的样式隔离方案：

1. 一个内部管理系统，子应用都是 React，使用 antd
2. 一个开放平台，需要加载第三方开发者的应用
3. 一个遗留系统迁移，老系统使用全局 CSS，新系统使用 CSS Modules

### 练习二：设计通信机制

设计一个跨应用的消息通知系统：
- 主应用可以向所有子应用广播通知
- 子应用可以向主应用发送通知
- 需要支持消息确认和重试
- 需要处理子应用未加载时的消息队列

---

## 参考答案

### 练习一

```
1. 内部管理系统（React + antd）
   方案：CSS 命名空间 + postcss-prefix-selector
   理由：
   - antd 的样式无法用 CSS Modules 隔离
   - 命名空间前缀可以有效隔离 antd 的全局样式
   - Shadow DOM 会导致 antd 的弹窗、下拉框无法超出边界
   - 内部系统不需要最强的隔离

2. 开放平台（第三方应用）
   方案：Shadow DOM
   理由：
   - 第三方代码不可信，需要最强的隔离
   - 防止第三方样式影响主应用
   - 配合 CSP 和 sandbox 属性进一步限制权限
   - 需要在文档中说明 Shadow DOM 的限制

3. 遗留系统迁移
   方案：qiankun 的 strictStyleIsolation
   理由：
   - 老系统的全局 CSS 需要被隔离
   - qiankun 的样式隔离对子应用侵入性小
   - 可以逐步迁移，不需要一次性改造老系统
```

### 练习二

```typescript
// 跨应用消息系统设计
class MicroAppMessageBus {
  private handlers = new Map<string, Set<Function>>();
  private pendingMessages: Array<{ target: string; message: any }> = [];
  private loadedApps = new Set<string>();

  // 注册应用加载完成
  markAppLoaded(appName: string) {
    this.loadedApps.add(appName);
    // 处理该应用的待发消息
    this.pendingMessages
      .filter(msg => msg.target === appName)
      .forEach(msg => this.send(msg.target, msg.message));
    this.pendingMessages = this.pendingMessages.filter(msg => msg.target !== appName);
  }

  // 发送消息
  send(target: string, message: any) {
    if (!this.loadedApps.has(target)) {
      // 应用未加载，加入队列
      this.pendingMessages.push({ target, message });
      return;
    }

    // 通过 CustomEvent 发送
    window.dispatchEvent(new CustomEvent('micro-app-message', {
      detail: { target, message, source: 'main' },
    }));
  }

  // 广播消息
  broadcast(message: any) {
    window.dispatchEvent(new CustomEvent('micro-app-broadcast', {
      detail: { message, source: 'main' },
    }));
  }

  // 监听消息
  on(appName: string, handler: Function) {
    if (!this.handlers.has(appName)) {
      this.handlers.set(appName, new Set());
    }
    this.handlers.get(appName)!.add(handler);

    // 监听定向消息
    const messageHandler = (event: CustomEvent) => {
      if (event.detail.target === appName) {
        handler(event.detail.message);
      }
    };
    window.addEventListener('micro-app-message', messageHandler);

    // 监听广播消息
    const broadcastHandler = (event: CustomEvent) => {
      handler(event.detail.message);
    };
    window.addEventListener('micro-app-broadcast', broadcastHandler);

    return () => {
      window.removeEventListener('micro-app-message', messageHandler);
      window.removeEventListener('micro-app-broadcast', broadcastHandler);
      this.handlers.get(appName)?.delete(handler);
    };
  }
}

// 使用
const messageBus = new MicroAppMessageBus();

// 主应用
messageBus.send('user-app', { type: 'THEME_CHANGE', payload: { theme: 'dark' } });
messageBus.broadcast({ type: 'GLOBAL_NOTIFICATION', payload: { text: '系统维护通知' } });

// 子应用
const unsubscribe = messageBus.on('user-app', (message) => {
  if (message.type === 'THEME_CHANGE') {
    setTheme(message.payload.theme);
  }
});
```

## 下一步

完成本课后，继续学习 [07. 国际化架构设计](./07-i18n.md)。
