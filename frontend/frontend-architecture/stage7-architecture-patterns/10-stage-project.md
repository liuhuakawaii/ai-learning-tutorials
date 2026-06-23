# 10. 阶段项目：设计一个微前端架构方案 —— 从需求分析到方案落地

> 架构设计不是画大图——是把前面 9 课学到的方法，用在一个真实场景中做出可落地的决策

## 本课目标

- 综合运用本阶段所学知识，完成一个完整的架构设计
- 从需求分析出发，而不是从技术方案出发
- 产出可落地的架构方案文档
- 练习架构决策记录（ADR）的编写

## 项目背景

假设你所在团队负责一个大型 B2B SaaS 平台——"企业智能工作台"。该平台包含以下子系统：

```
子系统          功能                          负责团队      技术栈
──────────────────────────────────────────────────────────────────
主控制台        用户管理、权限管理、系统设置    基础平台组    React 18
数据分析        图表、报表、数据导出            数据团队      Vue 3
工单系统        工单列表、工单详情、消息通知    业务团队 A    React 18
运营后台        活动管理、内容管理、营销工具    业务团队 B    Vue 3
```

### 业务约束

```
1. 不同子系统由不同团队维护，需要独立开发、独立部署
2. 技术栈不完全统一（React 18 和 Vue 3 共存）
3. 用户需要在一个统一的平台中使用所有子系统
4. 平台需要支持多租户（不同企业看到的内容不同）
5. 预计一年内用户量从 1 万增长到 50 万
```

### 技术约束

```
1. 现有系统已经在运行，不能一次性重写
2. 基础平台组有 5 人，其他团队各 3-4 人
3. 团队没有微前端经验
4. 需要在 3 个月内完成第一阶段迁移
5. 现有的用户认证系统（OAuth 2.0）需要保留
```

## 项目要求

完成以下四个阶段的工作：

### 第一阶段：需求分析

**任务 1.1：梳理功能边界**

分析每个子系统的：
- 核心功能
- 用户角色
- 数据来源
- 页面数量
- 交互复杂度

**任务 1.2：分析团队协作模式**

- 各团队的开发流程是什么？
- 代码仓库是统一还是分开？
- 构建和部署流程是什么？
- 团队之间如何协作？

**任务 1.3：明确优先级**

在以下三个维度中，排出优先级：
- 性能（加载速度、交互流畅度）
- 体验（统一体感、无缝切换）
- 开发效率（独立开发、快速迭代）

### 第二阶段：方案选型

**任务 2.1：对比四种方案**

从以下维度对比 qiankun、Module Federation、single-spa、iframe：

| 维度 | qiankun | Module Federation | single-spa | iframe |
|------|---------|-------------------|------------|--------|
| 技术匹配度 | | | | |
| 团队能力 | | | | |
| 迁移成本 | | | | |
| 社区生态 | | | | |
| 长期维护 | | | | |

**任务 2.2：给出选型结论**

- 选择哪个方案？
- 为什么选择这个方案？
- 这个方案的主要风险是什么？
- 什么情况下需要重新评估？

### 第三阶段：架构设计

**任务 3.1：设计主应用与子应用的通信机制**

需要考虑：
- 用户信息如何共享？
- 主题设置如何同步？
- 权限信息如何传递？
- 通知消息如何广播？

**任务 3.2：设计共享依赖策略**

需要考虑：
- 哪些库需要共享？（React、Vue、antd、工具库）
- 如何处理版本冲突？
- 如何优化加载性能？

**任务 3.3：设计样式隔离方案**

需要考虑：
- 如何防止子应用样式互相影响？
- 如何处理 antd 等第三方库的样式？
- 如何支持暗色模式？

**任务 3.4：设计路由和导航方案**

需要考虑：
- 主应用和子应用的路由如何协调？
- 浏览器前进/后退如何处理？
- 面包屑如何生成？
- URL 如何保持同步？

**任务 3.5：设计公共上下文**

需要考虑：
- 用户信息的存储和更新
- 权限信息的传递
- 主题和语言的同步
- 错误处理和日志

### 第四阶段：落地计划

**任务 4.1：制定渐进式迁移路径**

分三个阶段：
- 第一阶段（1-2 个月）：搭建主应用骨架，接入第一个子应用
- 第二阶段（2-3 个月）：接入所有子应用，完善通信和共享机制
- 第三阶段（3-6 个月）：优化性能，完善监控，处理边界情况

**任务 4.2：设计开发和部署流程**

需要考虑：
- 本地开发如何同时运行主应用和子应用？
- CI/CD 流程如何设计？
- 版本管理和发布策略是什么？
- 回滚方案是什么？

**任务 4.3：识别风险点和应对方案**

列出可能的风险：
- 技术风险（方案不成熟、性能问题）
- 协作风险（团队沟通、接口不一致）
- 业务风险（迁移期间的功能中断）

## 参考实现

以下是一份参考实现的大纲，供你对照和思考。实际实现时，请根据你的分析做调整。

### 需求分析示例

```yaml
功能边界分析:
  主控制台:
    核心功能: 用户管理、角色权限、系统设置、租户管理
    用户角色: 超级管理员、企业管理员
    数据来源: 用户服务 API、权限服务 API
    页面数量: 约 15 个
    交互复杂度: 中等（表单为主）

  数据分析:
    核心功能: 数据看板、自定义报表、数据导出、实时数据
    用户角色: 数据分析师、业务人员
    数据来源: 数据服务 API、实时 WebSocket
    页面数量: 约 10 个
    交互复杂度: 高（图表交互、拖拽、实时更新）

  工单系统:
    核心功能: 工单列表、工单详情、工单流转、消息通知
    用户角色: 客服人员、业务人员
    数据来源: 工单服务 API、消息服务 API
    页面数量: 约 8 个
    交互复杂度: 中等（列表、表单、实时通知）

  运营后台:
    核心功能: 活动管理、内容管理、营销工具、数据统计
    用户角色: 运营人员
    数据来源: 运营服务 API
    页面数量: 约 12 个
    交互复杂度: 中等（表单、拖拽排序）

优先级排序:
  1. 体验（统一体感、无缝切换）- 用户需要在一个平台中工作
  2. 开发效率（独立开发、快速迭代）- 多团队协作
  3. 性能（加载速度）- 重要但不是首要
```

### 方案选型示例

```yaml
方案对比:
  qiankun:
    技术匹配度: 高
      - 支持 React 和 Vue 混合
      - HTML Entry 对子应用侵入性小
      - 内置 JS 沙箱和 CSS 隔离
    团队能力: 中等
      - 团队没有微前端经验，但 qiankun 文档完善
      - API 简单，学习成本低
    迁移成本: 低
      - 子应用只需导出生命周期函数
      - 不需要大幅修改现有代码
    社区生态: 好
      - 蚂蚁金服维护，生产验证
      - 中文文档完善
    长期维护: 中等
      - 依赖蚂蚁金服的维护
      - 社区活跃度一般

  Module Federation:
    技术匹配度: 中等
      - 需要统一 Webpack 版本
      - 不提供 JS 沙箱和 CSS 隔离
    团队能力: 低
      - 配置复杂，学习成本高
    迁移成本: 中等
      - 需要修改构建配置
    社区生态: 成长中
      - Webpack 5 原生支持
    长期维护: 好
      - Webpack 官方支持

选型结论: qiankun
理由:
  1. 技术栈混合（React + Vue），qiankun 支持最好
  2. 团队没有微前端经验，qiankun 学习成本最低
  3. 迁移成本最低，可以在 3 个月内完成第一阶段
  4. 内置沙箱和样式隔离，不需要额外处理

风险:
  1. qiankun 依赖蚂蚁金服的维护
  2. JS 沙箱有性能开销
  3. Vite 支持不好（但当前子系统都用 Webpack）
```

### 架构设计示例

```yaml
通信机制:
  用户信息:
    方案: 主应用通过 props 传递给子应用
    更新: 主应用监听用户信息变化，通过 setGlobalState 同步
    理由: 用户信息不频繁更新，props 传递足够

  主题设置:
    方案: CSS 变量 + CustomEvent
    实现: 主应用切换主题时，修改 CSS 变量并发送事件
    理由: CSS 变量性能好，CustomEvent 实现简单

  权限信息:
    方案: 从用户信息中派生，通过 props 传递
    理由: 权限信息不频繁更新，不需要单独的通信机制

  通知消息:
    方案: 主应用维护通知列表，通过 CustomEvent 广播
    理由: 通知是单向的（主应用 → 子应用），CustomEvent 足够

共享依赖:
  主应用提供:
    - React 18（通过 externals）
    - Vue 3（通过 externals）
    - 公共工具函数（通过 props）
    - 公共组件（通过 Module Federation 或 npm 包）

  子应用独立:
    - antd / element-plus（版本可能不同）
    - 业务组件

样式隔离:
  方案: qiankun 的 strictStyleIsolation
  补充: 子应用使用 CSS Modules
  暗色模式: CSS 变量 + data-theme 属性

路由方案:
  主应用: 负责一级路由（/console, /analytics, /ticket, /operation）
  子应用: 负责二级路由（/console/users, /console/roles）
  面包屑: 主应用生成一级，子应用生成二级
```

### 关键代码示例

以下是主应用的核心代码结构，展示如何加载子应用、管理通信和处理样式隔离。

**主应用入口**：

```typescript
// src/main.tsx
import { registerMicroApps, start, initGlobalState } from 'qiankun';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAppStore } from './stores/app';
import { useThemeMode } from './hooks/useThemeMode';
import Layout from './components/Layout';

// 初始化全局状态
const initialState = {
  user: null,
  permissions: [],
  theme: 'light',
  locale: 'zh-CN',
  notifications: [],
};

const actions = initGlobalState(initialState);

function App() {
  const { effectiveTheme } = useThemeMode();
  const user = useAppStore((state) => state.user);

  // 注册子应用
  useEffect(() => {
    registerMicroApps([
      {
        name: 'analytics-app',
        entry: process.env.NODE_ENV === 'development'
          ? '//localhost:8081'
          : '/analytics/',
        container: '#micro-container',
        activeRule: '/analytics',
        props: {
          user,
          theme: effectiveTheme,
          actions,
          getToken: () => localStorage.getItem('token'),
        },
      },
      {
        name: 'ticket-app',
        entry: process.env.NODE_ENV === 'development'
          ? '//localhost:8082'
          : '/ticket/',
        container: '#micro-container',
        activeRule: '/ticket',
        props: {
          user,
          theme: effectiveTheme,
          actions,
          getToken: () => localStorage.getItem('token'),
        },
      },
      {
        name: 'operation-app',
        entry: process.env.NODE_ENV === 'development'
          ? '//localhost:8083'
          : '/operation/',
        container: '#micro-container',
        activeRule: '/operation',
        props: {
          user,
          theme: effectiveTheme,
          actions,
          getToken: () => localStorage.getItem('token'),
        },
      },
    ]);

    start({
      sandbox: {
        strictStyleIsolation: true,
      },
      prefetch: 'all',
    });
  }, [user, effectiveTheme]);

  // 监听全局状态变化
  useEffect(() => {
    actions.onGlobalStateChange((state, prev) => {
      if (state.theme !== prev.theme) {
        document.documentElement.setAttribute('data-theme', state.theme);
      }
    });
  }, []);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: effectiveTheme === 'dark'
          ? theme.darkAlgorithm
          : theme.defaultAlgorithm,
      }}
    >
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/analytics/*" element={<div id="micro-container" />} />
            <Route path="/ticket/*" element={<div id="micro-container" />} />
            <Route path="/operation/*" element={<div id="micro-container" />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ConfigProvider>
  );
}
```

**通信机制实现**：

```typescript
// src/hooks/useMicroAppCommunication.ts
import { useEffect, useRef } from 'react';

// 主应用 → 子应用：通过 props 和 globalState
// 子应用 → 主应用：通过 props 中的回调函数
// 子应用之间：通过 CustomEvent

interface MicroAppMessage {
  type: string;
  source: string;
  target?: string;
  payload: any;
}

class MessageBus {
  private handlers = new Map<string, Set<(msg: MicroAppMessage) => void>>();

  send(target: string, message: Omit<MicroAppMessage, 'target'>) {
    window.dispatchEvent(new CustomEvent('micro-app-message', {
      detail: { ...message, target },
    }));
  }

  broadcast(message: Omit<MicroAppMessage, 'target'>) {
    window.dispatchEvent(new CustomEvent('micro-app-broadcast', {
      detail: message,
    }));
  }

  subscribe(appName: string, handler: (msg: MicroAppMessage) => void) {
    if (!this.handlers.has(appName)) {
      this.handlers.set(appName, new Set());
    }
    this.handlers.get(appName)!.add(handler);

    const messageHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.target === appName || !detail.target) {
        handler(detail);
      }
    };

    window.addEventListener('micro-app-message', messageHandler);
    window.addEventListener('micro-app-broadcast', messageHandler);

    return () => {
      this.handlers.get(appName)?.delete(handler);
      window.removeEventListener('micro-app-message', messageHandler);
      window.removeEventListener('micro-app-broadcast', messageHandler);
    };
  }
}

export const messageBus = new MessageBus();

// 子应用中使用的 Hook
export function useMicroAppMessage(
  appName: string,
  handler: (msg: MicroAppMessage) => void
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return messageBus.subscribe(appName, (msg) => handlerRef.current(msg));
  }, [appName]);
}
```

**共享依赖配置**：

```typescript
// 子应用 webpack.config.js（React 子应用）
const { name } = require('./package.json');

module.exports = {
  output: {
    library: `${name}-[name]`,
    libraryTarget: 'umd',
    jsonpFunction: `webpackJsonp_${name}`,
    publicPath: process.env.NODE_ENV === 'production'
      ? `https://cdn.example.com/${name}/`
      : '/',
  },
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
  },
  devServer: {
    port: 8081,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
};

// 子应用 webpack.config.js（Vue 子应用）
const { name } = require('./package.json');

module.exports = {
  output: {
    library: `${name}-[name]`,
    libraryTarget: 'umd',
    jsonpFunction: `webpackJsonp_${name}`,
    publicPath: process.env.NODE_ENV === 'production'
      ? `https://cdn.example.com/${name}/`
      : '/',
  },
  externals: {
    vue: 'Vue',
  },
  devServer: {
    port: 8083,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
};
```

**子应用适配（React）**：

```typescript
// 子应用 src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

let root: ReactDOM.Root | null = null;

function render(props: any) {
  const { container, user, theme, actions } = props;
  const dom = container
    ? container.querySelector('#root')
    : document.getElementById('root');

  root = ReactDOM.createRoot(dom!);
  root.render(
    <App user={user} theme={theme} actions={actions} />
  );
}

// 独立运行时
if (!window.__POWERED_BY_QIANKUN__) {
  render({});
}

// 导出生命周期
export async function bootstrap() {
  console.log('analytics app bootstrapped');
}

export async function mount(props: any) {
  render(props);
}

export async function unmount() {
  root?.unmount();
  root = null;
}
```

**子应用适配（Vue）**：

```typescript
// 子应用 src/main.ts
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

let app: ReturnType<typeof createApp> | null = null;

function render(props: any) {
  const { container, user, theme, actions } = props;
  app = createApp(App);
  app.use(router);
  app.provide('user', user);
  app.provide('theme', theme);
  app.provide('actions', actions);

  const dom = container
    ? container.querySelector('#app')
    : document.getElementById('app');
  app.mount(dom!);
}

if (!window.__POWERED_BY_QIANKUN__) {
  render({});
}

export async function bootstrap() {
  console.log('operation app bootstrapped');
}

export async function mount(props: any) {
  render(props);
}

export async function unmount() {
  app?.unmount();
  app = null;
}
```

### 落地计划详细内容

```yaml
第一阶段（第 1-2 个月）：骨架搭建
  目标: 主应用骨架完成，接入第一个子应用
  任务:
    第 1-2 周:
      - 搭建主应用项目结构
      - 集成 qiankun
      - 实现基础路由和布局
      - 实现用户认证流程
    第 3-4 周:
      - 接入第一个子应用（工单系统）
      - 实现基础通信机制
      - 处理样式隔离
      - 本地开发环境配置
    第 5-6 周:
      - 接入数据分析子应用
      - 完善通信机制（主题、通知）
      - 集成测试
    第 7-8 周:
      - 接入运营后台子应用
      - 性能优化（预加载、共享依赖）
      - 文档编写
  交付物:
    - 主应用可运行
    - 3 个子应用全部接入
    - 基础通信机制工作正常
    - 本地开发文档

第二阶段（第 2-3 个月）：完善与优化
  目标: 完善所有功能，优化性能和体验
  任务:
    - 实现完整的权限控制
    - 实现暗色模式
    - 实现国际化
    - 优化加载性能（预加载策略）
    - 完善错误处理和降级方案
    - 编写单元测试和集成测试
    - CI/CD 流程搭建
  交付物:
    - 完整的功能
    - 性能达标
    - CI/CD 流程
    - 测试覆盖

第三阶段（第 3-6 个月）：监控与迭代
  目标: 建立监控体系，持续优化
  任务:
    - 接入前端监控（错误、性能、用户行为）
    - 建立架构评审机制
    - 技术债识别和偿还
    - ADR 文档维护
    - 团队培训和知识分享
  交付物:
    - 监控体系
    - 架构评审流程
    - ADR 文档库
```

### 风险识别与应对

```yaml
技术风险:
  风险 1: qiankun 的 JS 沙箱在某些场景下失效
    概率: 中
    影响: 子应用的全局变量可能污染主应用
    应对:
      - 子应用避免使用全局变量
      - 使用 TypeScript 严格模式
      - 定期进行沙箱隔离测试

  风险 2: 子应用之间的样式冲突
    概率: 高
    影响: UI 显示异常
    应对:
      - 使用 strictStyleIsolation
      - 子应用使用 CSS Modules
      - 建立 CSS 命名规范
      - 定期进行样式冲突检测

  风险 3: 共享依赖版本冲突
    概率: 中
    影响: 运行时错误
    应对:
      - 统一 React 版本（18.x）
      - Vue 子应用不共享 React
      - 建立依赖版本管理规范

协作风险:
  风险 4: 团队对微前端理解不一致
    概率: 高
    影响: 开发效率低、代码质量参差
    应对:
      - 开展微前端培训
      - 编写详细的开发规范
      - 建立代码评审机制
      - 定期技术分享

  风险 5: 子应用接口不一致
    概率: 中
    影响: 集成困难
    应对:
      - 定义统一的通信接口规范
      - 使用 TypeScript 定义接口类型
      - 建立接口文档

业务风险:
  风险 6: 迁移期间功能中断
    概率: 低
    影响: 用户体验下降
    应对:
      - 渐进式迁移，新老系统共存
      - 灰度发布
      - 快速回滚方案
      - 充分的集成测试
```

## 交付清单

完成本项目后，你应该产出以下文档：

```
1. 需求分析文档
   - 功能边界分析
   - 团队协作模式
   - 优先级排序

2. 方案选型文档
   - 四种方案的对比表格
   - 选型结论和理由
   - 风险分析

3. 架构设计文档
   - 通信机制设计
   - 共享依赖策略
   - 样式隔离方案
   - 路由和导航方案
   - 公共上下文设计

4. 关键代码示例
   - 主应用加载子应用
   - 通信机制实现
   - 共享依赖配置

5. 落地计划
   - 分阶段实施计划
   - 开发和部署流程
   - 风险点和应对方案

6. ADR 文档
   - ADR-001：选择 qiankun 作为微前端方案
   - ADR-002：选择 CSS 变量实现主题系统
   - ADR-003：选择 props + CustomEvent 作为通信方案
```

## 自我检查清单

在提交之前，检查以下问题：

```
需求分析：
- [ ] 是否从真实需求出发，而不是从技术方案出发？
- [ ] 是否明确了每个子系统的功能边界？
- [ ] 是否考虑了团队的能力和约束？

方案选型：
- [ ] 是否对比了多种方案？
- [ ] 选型理由是否充分？
- [ ] 是否识别了主要风险？

架构设计：
- [ ] 通信机制是否覆盖了所有场景？
- [ ] 共享依赖策略是否考虑了版本冲突？
- [ ] 样式隔离方案是否可靠？
- [ ] 路由方案是否支持浏览器前进/后退？

落地计划：
- [ ] 是否是渐进式迁移，而不是一次性重写？
- [ ] 开发和部署流程是否可行？
- [ ] 是否有风险应对方案？

整体：
- [ ] 方案是否可落地（不是纸上谈兵）？
- [ ] 是否考虑了长期维护成本？
- [ ] 是否有明确的验收标准？
```

## 下一步

完成本阶段项目后，你已经掌握了前端架构设计的核心方法。

继续学习 [stage8：脚手架与项目模板](../stage8-scaffolding/README.md)，将架构决策固化到项目模板中，让团队在统一的规范下高效开发。
