# 05. 微前端架构 —— qiankun/Module Federation/single-spa/iframe 方案对比

> 微前端不是银弹——它解决的是组织问题，不是技术问题。用之前先问自己：我真的需要微前端吗？

## 本课目标

- 理解微前端的适用场景和不适用场景
- 掌握四种主流微前端方案的原理和优缺点
- 学会从技术匹配度、团队能力、迁移成本、社区生态四个维度评估方案
- 为真实业务场景选择合适的微前端方案

## 什么时候需要微前端

微前端解决的核心问题是：**多个团队维护多个子系统，需要统一入口，但又要独立开发、独立部署**。

### 适合微前端的场景

```
场景 1：遗留系统渐进式迁移
  老系统是 jQuery + JSP，新功能用 React 开发。
  不能一次性重写，需要新老系统共存。

场景 2：大型平台多团队协作
  一个 SaaS 平台有 10+ 个子系统，
  每个子系统由不同团队维护，技术栈不完全统一。
  需要独立开发、独立部署，但用户需要统一入口。

场景 3：产品化需求
  需要像"插件"一样，让客户或第三方团队扩展平台功能。

场景 4：组织架构决定技术架构
  公司收购了多个产品，需要整合到一个平台中。
  每个产品的团队和技术栈都不同。
```

### 不适合微前端的场景

```
场景 1：团队规模小
  少于 20 人的团队，维护 5-10 个页面，不需要微前端。
  微前端引入的复杂度（通信、样式隔离、构建部署）
  会超过它解决的问题。

场景 2：技术栈统一
  如果所有子系统都用 React + TypeScript，
  用 Monorepo + 代码分割就够了。

场景 3：子系统之间耦合度高
  如果子系统之间需要频繁共享状态和组件，
  微前端会增加通信成本。

场景 4：只是想"代码分割"
  如果只是想把一个大的 SPA 拆分成多个 chunk，
  用路由级代码分割就够了，不需要微前端。
```

### 微前端的代价

```
1. 复杂度增加
   - 需要处理应用加载、通信、样式隔离
   - 需要协调多个团队的构建和部署流程
   - 调试变得困难（跨应用的问题定位）

2. 性能开销
   - 应用切换时需要加载和初始化子应用
   - 共享依赖的版本管理
   - 样式冲突的处理

3. 用户体验挑战
   - 应用切换时的白屏
   - 全局状态同步
   - 浏览器前进/后退的行为

4. 开发体验下降
   - 本地开发需要同时运行多个应用
   - 跨应用调试困难
   - TypeScript 类型共享需要额外配置
```

## 四种主流方案

### 方案一：qiankun

qiankun 是蚂蚁金服开源的微前端框架，基于 single-spa，但提供了更多开箱即用的功能。

```typescript
// 主应用（main app）
import { registerMicroApps, start } from 'qiankun';

registerMicroApps([
  {
    name: 'user-app',
    entry: '//localhost:8081',
    container: '#micro-container',
    activeRule: '/user',
    props: { token: getToken(), userInfo: getUserInfo() },
  },
  {
    name: 'order-app',
    entry: '//localhost:8082',
    container: '#micro-container',
    activeRule: '/order',
  },
]);

start();
```

```typescript
// 子应用（需要导出三个生命周期函数）
export async function bootstrap() {
  console.log('子应用启动');
}

export async function mount(props) {
  // props 是主应用传递的数据
  const { container, token } = props;
  ReactDOM.render(<App token={token} />, container.querySelector('#root'));
}

export async function unmount(props) {
  const { container } = props;
  ReactDOM.unmountComponentAtNode(container.querySelector('#root'));
}
```

```
qiankun 的核心原理：
1. HTML Entry：通过 fetch 子应用的 HTML，解析并执行其中的 JS
2. JS 沙箱：使用 Proxy（IE 用快照）隔离子应用的全局变量
3. CSS 隔离：scoped CSS 或 shadow DOM
4. 应用通信：基于全局状态管理（initGlobalState）

优势：
- 开箱即用，API 简单
- HTML Entry 对子应用侵入性小
- JS 沙箱和 CSS 隔离内置
- 社区成熟，文档完善
- 蚂蚁金服大规模生产验证

代价：
- JS 沙箱有性能开销（Proxy 拦截所有全局变量访问）
- CSS 隔离不够完美（scoped 可能失效）
- 子应用必须支持 UMD 导出
- 不支持 Vite（HTML Entry 的限制）
- 路由模式有限制（需要子应用支持 history 或 hash）
```

### 方案二：Module Federation

Module Federation 是 Webpack 5 内置的模块共享方案，由 Zack Jackson 提出。

```typescript
// 应用 A 的 webpack 配置
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'appA',
      filename: 'remoteEntry.js',
      exposes: {
        './Button': './src/components/Button',
        './utils': './src/utils',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
      },
    }),
  ],
};
```

```typescript
// 应用 B 使用应用 A 暴露的组件
const RemoteButton = React.lazy(() => import('appA/Button'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <RemoteButton />
    </Suspense>
  );
}
```

```
Module Federation 的核心原理：
1. 运行时共享：不是构建时复制代码，而是运行时从远程加载模块
2. 容器（Container）：每个应用都是一个容器，可以暴露和消费模块
3. 共享依赖：通过 shared 配置避免重复加载公共库
4. 动态远程：可以在运行时动态加载远程模块

优势：
- Webpack 5 原生支持，无需额外框架
- 真正的模块级共享（不是应用级）
- 支持双向共享（A 用 B 的组件，B 也用 A 的组件）
- 共享依赖机制成熟（singleton、version）
- 适合组件库共享

代价：
- 需要 Webpack 5（Vite 需要额外插件）
- 不提供 JS 沙箱和 CSS 隔离
- 需要自己处理路由和应用生命周期
- 配置相对复杂
- 版本管理困难（shared 依赖的版本冲突）
```

### 方案三：single-spa

single-spa 是最早的微前端框架之一，是一个路由协调器。

```typescript
// 主应用
import { registerApplication, start } from 'single-spa';

// 注册子应用
registerApplication({
  name: 'user-app',
  app: () => import('@myorg/user-app'),
  activeWhen: (location) => location.pathname.startsWith('/user'),
  customProps: { token: getToken() },
});

registerApplication({
  name: 'order-app',
  app: () => import('@myorg/order-app'),
  activeWhen: '/order',
});

start();
```

```typescript
// 子应用
import React from 'react';
import ReactDOM from 'react-dom';
import singleSpaReact from 'single-spa-react';

const lifecycles = singleSpaReact({
  React,
  ReactDOM,
  rootComponent: App,
  errorBoundary(err, info, props) {
    return <ErrorFallback error={err} />;
  },
});

export const { bootstrap, mount, unmount } = lifecycles;
```

```
single-spa 的核心原理：
1. 路由劫持：监听路由变化，根据 activeRule 决定加载/卸载哪个子应用
2. 生命周期：每个子应用必须导出 bootstrap、mount、unmount 三个函数
3. 应用加载：通过 SystemJS 或 import() 动态加载子应用的 JS

优势：
- 框架无关（React、Vue、Angular 都可以）
- 最早的微前端方案，社区成熟
- 灵活性高，可以自定义几乎所有行为
- 适合渐进式迁移

代价：
- 只是路由协调器，不提供沙箱和样式隔离
- 需要配合 qiankun 或自己实现沙箱
- 子应用需要适配生命周期接口
- 没有 HTML Entry，子应用需要自己处理 DOM 挂载
```

### 方案四：iframe

iframe 是最古老的"微前端"方案，也是最简单的。

```typescript
// 主应用
function MicroApp({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      style={{ width: '100%', height: '100%', border: 'none' }}
      title="micro-app"
    />
  );
}

// 使用
function App() {
  const [activeApp, setActiveApp] = useState('/user');

  return (
    <div className="layout">
      <Sidebar onNavigate={setActiveApp} />
      <main>
        <MicroApp url={activeApp} />
      </main>
    </div>
  );
}
```

```
iframe 的核心原理：
1. 浏览器原生隔离：iframe 天然提供 JS 和 CSS 隔离
2. 独立文档：每个 iframe 是一个独立的文档环境
3. 通信：通过 postMessage 进行跨 iframe 通信

优势：
- 最简单，无需任何框架
- 天然的 JS 和 CSS 隔离
- 子应用可以是任何技术栈，甚至可以是不同的域名
- 浏览器原生支持，兼容性最好

代价：
- URL 不同步（iframe 内部的路由变化不会反映到主应用 URL）
- 性能差（每个 iframe 都是一个独立的文档，内存开销大）
- 通信成本高（postMessage 是异步的，需要序列化/反序列化）
- 弹窗、下拉框无法超出 iframe 边界
- SEO 不友好
- 共享状态困难
```

## 方案对比

```
对比维度        qiankun    Module Fed    single-spa    iframe
────────────────────────────────────────────────────────────
JS 沙箱         内置        无            无            天然隔离
CSS 隔离        内置        无            无            天然隔离
HTML Entry      支持        不支持        不支持        天然支持
路由同步        自动        需自己处理    自动          不同步
共享依赖        有限        强大          手动          困难
框架无关        支持        支持          支持          完全无关
通信机制        props       模块导入      自定义        postMessage
Vite 支持       困难        原生          支持          天然支持
性能            中等        好            中等          差
学习成本        低          中等          中等          最低
社区生态        成长中      成长中        成熟          原生
生产验证        蚂蚁金服    字节跳动      广泛          广泛
```

## 选型决策框架

```
选择方案的决策树：

你的子应用技术栈是否统一？
├── 是 → 子应用都用 Webpack 5 吗？
│        ├── 是 → 考虑 Module Federation（模块级共享最好）
│        └── 否 → 考虑 qiankun（兼容性好）
│
└── 否 → 你需要 JS/CSS 隔离吗？
          ├── 是 → qiankun（内置沙箱）
          │        或 iframe（最强隔离）
          │
          └── 否 → 你需要框架无关吗？
                    ├── 是 → single-spa
                    └── 否 → qiankun 或 Module Federation
```

```
更实际的建议：

1. 如果你在做渐进式迁移（老系统 → 新系统）
   → qiankun 或 single-spa
   理由：对老系统侵入小，可以逐步替换

2. 如果你有多个 React/Vue 项目需要共享组件
   → Module Federation
   理由：模块级共享，不需要每个应用都打包一份组件库

3. 如果你需要最强的隔离（比如加载第三方不可信的应用）
   → iframe
   理由：浏览器原生隔离，最安全

4. 如果你只是想把一个大的前端项目拆分
   → 不需要微前端，用 Monorepo + 代码分割
```

## 练习

### 练习一：方案选型

以下场景应该选择哪种微前端方案？为什么？

**场景 A**：一个大型 SaaS 平台，有 8 个子系统，3 个团队维护。子系统都是 React，但版本不同（16/17/18）。需要统一入口，独立部署。

**场景 B**：一个老系统（jQuery + JSP），需要逐步迁移到 React。迁移周期 2 年，期间新老系统需要共存。

**场景 C**：一个电商平台，需要让第三方开发者在平台上开发"店铺装修"功能。第三方代码不可信。

**场景 D**：一个企业内部平台，有 5 个子系统，都是 Vue 3 + Vite。需要共享组件库和工具函数。

### 练习二：设计通信机制

主应用需要向子应用传递以下数据：
- 用户信息（登录后获取，偶尔更新）
- 主题设置（用户切换时实时生效）
- 全局通知（随时可能触发）

请为 qiankun 和 Module Federation 分别设计通信方案。

---

## 参考答案

### 练习一

**场景 A：qiankun**

理由：
- React 版本不同，需要 JS 沙箱隔离（防止全局变量冲突）
- qiankun 内置 JS 沙箱和 CSS 隔离
- HTML Entry 对子应用侵入性小，不需要大幅修改子应用
- 3 个团队维护 8 个子系统，qiankun 的简单 API 降低学习成本
- Module Federation 需要统一 Webpack 版本，React 版本不同也会有 shared 配置问题

**场景 B：qiankun 或 single-spa**

理由：
- 渐进式迁移需要对老系统侵入最小
- qiankun 的 HTML Entry 可以直接加载老系统的页面
- 老系统不需要导出生命周期函数，只需要提供一个 URL
- single-spa 也可以，但需要自己处理沙箱和样式隔离

**场景 C：iframe**

理由：
- 第三方代码不可信，需要最强的隔离
- iframe 天然隔离 JS 和 CSS，第三方代码无法影响主应用
- 安全性最高（配合 sandbox 属性可以进一步限制权限）
- 虽然 URL 不同步，但店铺装修功能通常不需要 SEO

**场景 D：Module Federation**

理由：
- 技术栈统一（Vue 3 + Vite），不需要 JS/CSS 隔离
- Module Federation 的 Vite 插件（@module-federation/vite）支持良好
- 模块级共享最适合组件库和工具函数的共享
- 不需要额外的框架，配置简单

### 练习二

**qiankun 通信方案**：

```typescript
// 主应用
import { initGlobalState } from 'qiankun';

const initialState = {
  user: null,
  theme: 'light',
  notifications: [],
};

const actions = initGlobalState(initialState);

// 监听变化
actions.onGlobalStateChange((state, prev) => {
  console.log('状态变化：', state, prev);
});

// 更新状态
actions.setGlobalState({ user: userInfo });
actions.setGlobalState({ theme: 'dark' });
actions.setGlobalState({ notifications: [...notifications, newNotification] });

// 子应用
export function mount(props) {
  props.onGlobalStateChange((state) => {
    // 更新子应用的用户信息、主题、通知
    setUser(state.user);
    setTheme(state.theme);
    setNotifications(state.notifications);
  });
}
```

**Module Federation 通信方案**：

```typescript
// 主应用暴露一个状态管理模块
// exposes: { './store': './src/store' }

// 主应用的 store（Zustand）
import { create } from 'zustand';

export const useGlobalStore = create((set) => ({
  user: null,
  theme: 'light',
  notifications: [],
  setUser: (user) => set({ user }),
  setTheme: (theme) => set({ theme }),
  addNotification: (notification) =>
    set((state) => ({ notifications: [...state.notifications, notification] })),
}));

// 子应用使用主应用的 store
const GlobalStore = React.lazy(() => import('mainApp/store'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <GlobalStore>
        {({ user, theme }) => (
          <div data-theme={theme}>
            <Header user={user} />
            <Content />
          </div>
        )}
      </GlobalStore>
    </Suspense>
  );
}
```

## 下一步

完成本课后，继续学习 [06. 微前端落地实践与踩坑](./06-micro-frontend-practice.md)。
