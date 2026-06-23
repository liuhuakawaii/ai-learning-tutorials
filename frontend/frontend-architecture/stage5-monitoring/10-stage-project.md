# 10. 阶段项目：实现一个轻量级前端监控 SDK

> 错误捕获 + 性能采集 + 行为追踪 + 数据上报——从零构建一个生产可用的监控 SDK

## 本课目标

- 综合运用前 9 课所学，实现一个完整的前端监控 SDK
- 掌握 SDK 的架构设计和模块划分
- 实现错误捕获、性能采集、行为追踪、数据上报四大模块
- 处理边界情况：采样、离线缓存、性能影响最小化
- 提供完整的 TypeScript 类型定义和使用文档

## 项目概述

你需要从零实现一个轻量级前端监控 SDK，代号 `mini-monitor`。

### 功能要求

```
错误捕获模块：
  - JavaScript 运行时错误（window.onerror）
  - 未处理的 Promise 异常（unhandledrejection）
  - 资源加载错误（捕获阶段 error 事件）
  - 网络请求错误（fetch 拦截）
  - 自定义错误上报（手动调用）

性能采集模块：
  - Core Web Vitals（LCP、CLS、INP、TTFB、FCP）
  - Navigation Timing（页面加载瀑布图数据）
  - Resource Timing（慢资源检测）
  - Long Task（长任务监控）

行为追踪模块：
  - PV/UV 统计
  - 点击事件追踪
  - 路由变化追踪（SPA）
  - 自定义事件上报

数据上报模块：
  - 批量上报（队列 + 定时 + 队列满触发）
  - Beacon API 优先
  - 失败重试
  - 离线缓存（localStorage）
  - 采样控制
```

### 技术要求

- TypeScript 编写
- 零运行时依赖
- 体积 < 10KB（gzip 后）
- 不阻塞主线程
- 不产生未捕获异常（SDK 自身的异常不能影响业务）

## 架构设计

```
mini-monitor/
├── src/
│   ├── index.ts              # 入口，初始化和配置
│   ├── core/
│   │   ├── client.ts         # SDK 核心类
│   │   ├── config.ts         # 配置管理
│   │   └── queue.ts          # 事件队列
│   ├── collectors/
│   │   ├── error.ts          # 错误采集
│   │   ├── performance.ts    # 性能采集
│   │   └── behavior.ts       # 行为采集
│   ├── reporters/
│   │   ├── http.ts           # HTTP 上报
│   │   └── beacon.ts         # Beacon API 上报
│   ├── utils/
│   │   ├── hash.ts           # 哈希工具
│   │   ├── sampler.ts        # 采样控制
│   │   └── storage.ts        # 本地存储
│   └── types.ts              # 类型定义
├── package.json
├── tsconfig.json
└── README.md
```

## 实现步骤

### 第一步：类型定义

```typescript
// src/types.ts
export interface MonitorConfig {
  appId: string;
  endpoint: string;
  release?: string;
  environment?: 'development' | 'production';
  
  // 采样率
  errorSampleRate?: number;      // 默认 1.0
  perfSampleRate?: number;       // 默认 0.1
  behaviorSampleRate?: number;   // 默认 0.05
  
  // 上报配置
  batchSize?: number;            // 默认 10
  flushInterval?: number;        // 默认 5000ms
  maxQueueSize?: number;         // 默认 100
  
  // 功能开关
  enableError?: boolean;         // 默认 true
  enablePerformance?: boolean;   // 默认 true
  enableBehavior?: boolean;      // 默认 true
}

export type EventType = 
  | 'js-error'
  | 'promise-rejection'
  | 'resource-error'
  | 'network-error'
  | 'custom-error'
  | 'web-vital'
  | 'navigation'
  | 'resource-timing'
  | 'long-task'
  | 'pageview'
  | 'click'
  | 'route-change'
  | 'custom';

export interface MonitorEvent {
  type: EventType;
  timestamp: number;
  appId: string;
  sessionId: string;
  url: string;
  userAgent: string;
  release?: string;
  data: Record<string, any>;
}

export interface ErrorData {
  message: string;
  stack?: string;
  filename?: string;
  position?: string;
  element?: string;
}

export interface PerformanceData {
  name: string;
  value: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
}

export interface BehaviorData {
  action: string;
  target?: string;
  page: string;
  [key: string]: any;
}
```

### 第二步：事件队列

```typescript
// src/core/queue.ts
import { MonitorEvent, MonitorConfig } from '../types';

export class EventQueue {
  private queue: MonitorEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private config: MonitorConfig;
  private flushFn: (events: MonitorEvent[]) => void;

  constructor(config: MonitorConfig, flushFn: (events: MonitorEvent[]) => void) {
    this.config = config;
    this.flushFn = flushFn;
    this.startFlushTimer();
    this.setupPageHideHandler();
  }

  add(event: MonitorEvent): void {
    this.queue.push(event);
    
    if (this.queue.length >= (this.config.maxQueueSize || 100)) {
      this.flush();
    }
  }

  flush(): void {
    if (this.queue.length === 0) return;
    
    const events = this.queue.splice(0);
    this.flushFn(events);
  }

  private startFlushTimer(): void {
    const interval = this.config.flushInterval || 5000;
    this.flushTimer = setInterval(() => this.flush(), interval);
  }

  private setupPageHideHandler(): void {
    const handler = () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    };
    
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('pagehide', handler);
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}
```

### 第三步：上报器

```typescript
// src/reporters/beacon.ts
import { MonitorEvent, MonitorConfig } from '../types';
import { Storage } from '../utils/storage';

export class Reporter {
  private config: MonitorConfig;
  private storage: Storage;

  constructor(config: MonitorConfig) {
    this.config = config;
    this.storage = new Storage('monitor_pending');
  }

  send(events: MonitorEvent[]): void {
    const data = JSON.stringify({ events, appId: this.config.appId });
    
    // 优先使用 Beacon API
    if (this.sendViaBeacon(data)) {
      this.retryStored();
      return;
    }
    
    // 降级为 fetch
    this.sendViaFetch(data).catch(() => {
      // 上报失败，缓存到本地
      this.storeLocally(events);
    });
  }

  private sendViaBeacon(data: string): boolean {
    if (!navigator.sendBeacon) return false;
    
    const blob = new Blob([data], { type: 'application/json' });
    return navigator.sendBeacon(this.config.endpoint, blob);
  }

  private async sendViaFetch(data: string): Promise<void> {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data,
      keepalive: true,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  private storeLocally(events: MonitorEvent[]): void {
    try {
      const stored = this.storage.get<MonitorEvent[]>() || [];
      const merged = [...stored, ...events].slice(-50); // 最多存 50 条
      this.storage.set(merged);
    } catch {
      // localStorage 不可用，静默失败
    }
  }

  private retryStored(): void {
    try {
      const stored = this.storage.get<MonitorEvent[]>();
      if (!stored || stored.length === 0) return;
      
      this.send(stored);
      this.storage.clear();
    } catch {
      // 静默失败
    }
  }
}

// src/utils/storage.ts
export class Storage {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  get<T>(): T | null {
    try {
      const data = localStorage.getItem(this.key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  set<T>(value: T): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(value));
    } catch {
      // localStorage 满了或不可用
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      // 静默失败
    }
  }
}
```

### 第四步：错误采集器

```typescript
// src/collectors/error.ts
import { MonitorEvent, MonitorConfig, ErrorData } from '../types';

type EventCallback = (event: MonitorEvent) => void;

export class ErrorCollector {
  private config: MonitorConfig;
  private onEvent: EventCallback;
  private sessionId: string;

  constructor(config: MonitorConfig, sessionId: string, onEvent: EventCallback) {
    this.config = config;
    this.sessionId = sessionId;
    this.onEvent = onEvent;
    this.setup();
  }

  private setup(): void {
    this.captureJsErrors();
    this.capturePromiseRejections();
    this.captureResourceErrors();
    this.interceptFetch();
  }

  private captureJsErrors(): void {
    window.addEventListener('error', (event) => {
      // 过滤资源错误
      if (event.target && 'tagName' in event.target) return;
      
      this.report({
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        position: `${event.lineno}:${event.colno}`,
      }, 'js-error');
    });
  }

  private capturePromiseRejections(): void {
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const isError = reason instanceof Error;
      
      this.report({
        message: isError ? reason.message : String(reason),
        stack: isError ? reason.stack : undefined,
      }, 'promise-rejection');
    });
  }

  private captureResourceErrors(): void {
    window.addEventListener('error', (event) => {
      const target = event.target as HTMLElement;
      if (!target?.tagName) return;
      
      const tagName = target.tagName.toLowerCase();
      if (!['img', 'script', 'link', 'video', 'audio'].includes(tagName)) return;
      
      this.report({
        message: `Resource load error: ${(target as any).src || (target as any).href}`,
        element: `<${tagName}>`,
        filename: (target as any).src || (target as any).href,
      }, 'resource-error');
    }, true);
  }

  private interceptFetch(): void {
    const originalFetch = window.fetch;
    const self = this;
    
    window.fetch = async function(...args: Parameters<typeof fetch>) {
      const startTime = Date.now();
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url;
      
      try {
        const response = await originalFetch.apply(window, args);
        
        if (!response.ok) {
          self.report({
            message: `HTTP ${response.status}: ${url}`,
            stack: `at fetch (${url})`,
            filename: url,
          }, 'network-error');
        }
        
        return response;
      } catch (error) {
        const err = error as Error;
        self.report({
          message: `Network error: ${err.message}`,
          stack: err.stack,
          filename: url,
        }, 'network-error');
        throw error;
      }
    };
  }

  // 手动上报错误
  captureException(error: Error, extra?: Record<string, any>): void {
    this.report({
      message: error.message,
      stack: error.stack,
      ...extra,
    }, 'custom-error');
  }

  private report(data: ErrorData, type: string): void {
    this.onEvent({
      type: type as any,
      timestamp: Date.now(),
      appId: '',
      sessionId: this.sessionId,
      url: location.href,
      userAgent: navigator.userAgent,
      release: this.config.release,
      data,
    });
  }

  destroy(): void {
    // 实际项目中需要移除事件监听器
  }
}
```

### 第五步：性能采集器

```typescript
// src/collectors/performance.ts
import { MonitorEvent, MonitorConfig, PerformanceData } from '../types';

type EventCallback = (event: MonitorEvent) => void;

export class PerformanceCollector {
  private config: MonitorConfig;
  private onEvent: EventCallback;
  private sessionId: string;

  constructor(config: MonitorConfig, sessionId: string, onEvent: EventCallback) {
    this.config = config;
    this.sessionId = sessionId;
    this.onEvent = onEvent;
    this.setup();
  }

  private setup(): void {
    this.collectNavigationTiming();
    this.collectWebVitals();
    this.collectLongTasks();
    this.collectResourceTiming();
  }

  private collectNavigationTiming(): void {
    const observer = new PerformanceObserver((list) => {
      const nav = list.getEntries()[0] as PerformanceNavigationTiming;
      
      this.emit('navigation', {
        ttfb: nav.responseStart - nav.requestStart,
        fcp: 0, // 在 paint observer 中设置
        domParse: nav.domInteractive - nav.responseEnd,
        domReady: nav.domContentLoadedEventEnd - nav.startTime,
        load: nav.loadEventEnd - nav.startTime,
        redirect: nav.redirectEnd - nav.redirectStart,
        dns: nav.domainLookupEnd - nav.domainLookupStart,
        tcp: nav.connectEnd - nav.connectStart,
        protocol: nav.nextHopProtocol,
      });
    });
    
    observer.observe({ type: 'navigation', buffered: true });
  }

  private collectWebVitals(): void {
    // LCP
    this.observe('largest-contentful-paint', (entries) => {
      const last = entries[entries.length - 1];
      this.emit('web-vital', { name: 'LCP', value: last.startTime });
    });

    // CLS
    let clsValue = 0;
    this.observe('layout-shift', (entries) => {
      for (const entry of entries) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      this.emit('web-vital', { name: 'CLS', value: clsValue });
    });

    // FCP
    this.observe('paint', (entries) => {
      const fcp = entries.find(e => e.name === 'first-contentful-paint');
      if (fcp) {
        this.emit('web-vital', { name: 'FCP', value: fcp.startTime });
      }
    });

    // TTFB
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (nav) {
      this.emit('web-vital', {
        name: 'TTFB',
        value: nav.responseStart - nav.requestStart,
      });
    }
  }

  private collectLongTasks(): void {
    if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) return;
    
    this.observe('longtask', (entries) => {
      for (const entry of entries) {
        this.emit('long-task', {
          duration: entry.duration,
          startTime: entry.startTime,
        });
      }
    });
  }

  private collectResourceTiming(): void {
    this.observe('resource', (entries) => {
      const slowResources = entries.filter(e => e.duration > 1000);
      if (slowResources.length > 0) {
        this.emit('resource-timing', {
          resources: slowResources.map(r => ({
            name: r.name,
            type: r.initiatorType,
            duration: r.duration,
            size: (r as any).transferSize,
          })),
        });
      }
    });
  }

  private observe(type: string, callback: (entries: PerformanceEntry[]) => void): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true } as any);
    } catch {
      // 该浏览器不支持此类型的 PerformanceObserver
    }
  }

  private emit(name: string, data: Record<string, any>): void {
    this.onEvent({
      type: 'web-vital',
      timestamp: Date.now(),
      appId: '',
      sessionId: this.sessionId,
      url: location.href,
      userAgent: navigator.userAgent,
      release: this.config.release,
      data: { name, ...data },
    });
  }

  destroy(): void {
    // 实际项目中需要断开 PerformanceObserver
  }
}
```

### 第六步：行为采集器

```typescript
// src/collectors/behavior.ts
import { MonitorEvent, MonitorConfig, BehaviorData } from '../types';

type EventCallback = (event: MonitorEvent) => void;

export class BehaviorCollector {
  private config: MonitorConfig;
  private onEvent: EventCallback;
  private sessionId: string;
  private pageViewSent = false;

  constructor(config: MonitorConfig, sessionId: string, onEvent: EventCallback) {
    this.config = config;
    this.sessionId = sessionId;
    this.onEvent = onEvent;
    this.setup();
  }

  private setup(): void {
    this.trackPageView();
    this.trackClicks();
    this.trackRouteChanges();
  }

  private trackPageView(): void {
    if (this.pageViewSent) return;
    this.pageViewSent = true;
    
    this.emit('pageview', {
      page: location.pathname,
      referrer: document.referrer,
      title: document.title,
    });
  }

  private trackClicks(): void {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target) return;
      
      this.emit('click', {
        page: location.pathname,
        target: this.getElementSelector(target),
        text: this.getElementText(target),
        x: event.clientX,
        y: event.clientY,
      });
    }, true);
  }

  private trackRouteChanges(): void {
    // 监听 pushState / replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const self = this;
    
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      self.emitRouteChange('pushState');
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      self.emitRouteChange('replaceState');
    };
    
    window.addEventListener('popstate', () => {
      self.emitRouteChange('popstate');
    });
  }

  private emitRouteChange(method: string): void {
    this.emit('route-change', {
      method,
      page: location.pathname,
      referrer: document.referrer,
    });
    
    // 路由变化也记录一次 PV
    this.emit('pageview', {
      page: location.pathname,
      title: document.title,
    });
  }

  // 手动追踪自定义事件
  track(eventName: string, properties?: Record<string, any>): void {
    this.emit('custom', {
      action: eventName,
      page: location.pathname,
      ...properties,
    });
  }

  private getElementSelector(element: HTMLElement): string {
    const parts: string[] = [];
    let current: HTMLElement | null = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector = `#${current.id}`;
        parts.unshift(selector);
        break;
      }
      if (current.className) {
        selector += `.${current.className.split(' ')[0]}`;
      }
      parts.unshift(selector);
      current = current.parentElement;
    }
    
    return parts.join(' > ');
  }

  private getElementText(element: HTMLElement, maxLen = 50): string {
    const text = element.textContent?.trim() || '';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  }

  private emit(type: string, data: BehaviorData): void {
    this.onEvent({
      type: type as any,
      timestamp: Date.now(),
      appId: '',
      sessionId: this.sessionId,
      url: location.href,
      userAgent: navigator.userAgent,
      release: this.config.release,
      data,
    });
  }

  destroy(): void {
    // 实际项目中需要移除事件监听器
  }
}
```

### 第七步：核心类

```typescript
// src/core/client.ts
import { MonitorConfig, MonitorEvent } from '../types';
import { EventQueue } from './queue';
import { Reporter } from '../reporters/beacon';
import { ErrorCollector } from '../collectors/error';
import { PerformanceCollector } from '../collectors/performance';
import { BehaviorCollector } from '../collectors/behavior';
import { Sampler } from '../utils/sampler';

export class MonitorClient {
  private config: MonitorConfig;
  private queue: EventQueue;
  private reporter: Reporter;
  private sampler: Sampler;
  private sessionId: string;
  
  private errorCollector?: ErrorCollector;
  private perfCollector?: PerformanceCollector;
  private behaviorCollector?: BehaviorCollector;

  constructor(config: MonitorConfig) {
    this.config = {
      errorSampleRate: 1.0,
      perfSampleRate: 0.1,
      behaviorSampleRate: 0.05,
      batchSize: 10,
      flushInterval: 5000,
      maxQueueSize: 100,
      enableError: true,
      enablePerformance: true,
      enableBehavior: true,
      ...config,
    };
    
    this.sessionId = this.generateSessionId();
    this.sampler = new Sampler();
    this.reporter = new Reporter(this.config);
    this.queue = new EventQueue(this.config, (events) => this.reporter.send(events));
    
    this.init();
  }

  private init(): void {
    const onEvent = (event: MonitorEvent) => this.handleEvent(event);
    
    if (this.config.enableError) {
      this.errorCollector = new ErrorCollector(this.config, this.sessionId, onEvent);
    }
    
    if (this.config.enablePerformance) {
      this.perfCollector = new PerformanceCollector(this.config, this.sessionId, onEvent);
    }
    
    if (this.config.enableBehavior) {
      this.behaviorCollector = new BehaviorCollector(this.config, this.sessionId, onEvent);
    }
  }

  private handleEvent(event: MonitorEvent): void {
    // 应用采样
    const sampleRate = this.getSampleRate(event.type);
    if (!this.sampler.shouldSample(event.type, sampleRate)) return;
    
    // 补充公共字段
    event.appId = this.config.appId;
    event.sessionId = this.sessionId;
    event.release = this.config.release;
    
    // 加入队列
    this.queue.add(event);
  }

  private getSampleRate(type: string): number {
    if (type.includes('error')) return this.config.errorSampleRate!;
    if (type === 'web-vital' || type === 'navigation') return this.config.perfSampleRate!;
    return this.config.behaviorSampleRate!;
  }

  // 公开 API
  captureException(error: Error, extra?: Record<string, any>): void {
    this.errorCollector?.captureException(error, extra);
  }

  track(eventName: string, properties?: Record<string, any>): void {
    this.behaviorCollector?.track(eventName, properties);
  }

  destroy(): void {
    this.errorCollector?.destroy();
    this.perfCollector?.destroy();
    this.behaviorCollector?.destroy();
    this.queue.destroy();
  }

  private generateSessionId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
```

### 第八步：入口文件

```typescript
// src/index.ts
import { MonitorClient } from './core/client';
import { MonitorConfig } from './types';

let client: MonitorClient | null = null;

export function init(config: MonitorConfig): MonitorClient {
  if (client) {
    console.warn('Monitor already initialized');
    return client;
  }
  
  client = new MonitorClient(config);
  return client;
}

export function captureException(error: Error, extra?: Record<string, any>): void {
  client?.captureException(error, extra);
}

export function track(eventName: string, properties?: Record<string, any>): void {
  client?.track(eventName, properties);
}

export function destroy(): void {
  client?.destroy();
  client = null;
}

export type { MonitorConfig, MonitorEvent } from './types';
```

### 第九步：采样工具

```typescript
// src/utils/sampler.ts
export class Sampler {
  private decisions = new Map<string, boolean>();

  shouldSample(key: string, rate: number): boolean {
    // 确保同一事件类型的采样决策一致
    if (this.decisions.has(key)) {
      return this.decisions.get(key)!;
    }
    
    const result = Math.random() < rate;
    this.decisions.set(key, result);
    return result;
  }
}
```

## 使用文档

### 安装

```bash
npm install mini-monitor
```

### 基本使用

```typescript
import { init, captureException, track } from 'mini-monitor';

// 初始化
init({
  appId: 'your-app-id',
  endpoint: 'https://your-server.com/api/collect',
  release: process.env.GIT_COMMIT_SHA,
  environment: process.env.NODE_ENV as 'development' | 'production',
});

// 错误会自动捕获，也可以手动上报
try {
  riskyOperation();
} catch (error) {
  captureException(error, { orderId: '12345' });
}

// 追踪自定义事件
track('button_click', { buttonId: 'submit-order' });
```

### React 集成

```tsx
import { init, captureException } from 'mini-monitor';
import React from 'react';

// 初始化
init({
  appId: 'your-app-id',
  endpoint: 'https://your-server.com/api/collect',
});

// ErrorBoundary
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    captureException(error, {
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong.</div>;
    }
    return this.props.children;
  }
}
```

### 配置选项

```typescript
init({
  // 必填
  appId: 'your-app-id',
  endpoint: 'https://your-server.com/api/collect',
  
  // 可选
  release: 'v1.0.0',                    // 版本号
  environment: 'production',            // 环境
  
  // 采样率（0-1）
  errorSampleRate: 1.0,                 // 错误全量上报
  perfSampleRate: 0.1,                  // 性能 10% 采样
  behaviorSampleRate: 0.05,             // 行为 5% 采样
  
  // 上报配置
  batchSize: 10,                        // 批量上报大小
  flushInterval: 5000,                  // 上报间隔（ms）
  maxQueueSize: 100,                    // 最大队列大小
  
  // 功能开关
  enableError: true,                    // 启用错误采集
  enablePerformance: true,              // 启用性能采集
  enableBehavior: true,                 // 启用行为采集
});
```

## 测试验证

### 手动测试

```html
<!DOCTYPE html>
<html>
<head>
  <title>Mini Monitor Test</title>
</head>
<body>
  <button id="test-error">触发错误</button>
  <button id="test-track">触发自定义事件</button>
  
  <script type="module">
    import { init, captureException, track } from './dist/mini-monitor.esm.js';
    
    init({
      appId: 'test-app',
      endpoint: '/api/collect',
      enableBehavior: true,
    });
    
    // 测试 JS 错误捕获
    document.getElementById('test-error').addEventListener('click', () => {
      undefinedFunction(); // 触发 ReferenceError
    });
    
    // 测试自定义事件
    document.getElementById('test-track').addEventListener('click', () => {
      track('test_click', { buttonId: 'test-track' });
    });
    
    // 测试 Promise 异常
    Promise.reject(new Error('Test promise rejection'));
    
    // 测试手动上报
    try {
      JSON.parse('invalid json');
    } catch (error) {
      captureException(error);
    }
  </script>
</body>
</html>
```

### 验收检查清单

```
错误捕获：
  □ JS 运行时错误能被捕获
  □ Promise 异常能被捕获
  □ 资源加载错误能被捕获
  □ fetch 请求错误能被捕获
  □ 手动上报能正常工作

性能采集：
  □ LCP 数值与 Chrome DevTools 偏差 < 5%
  □ CLS 数值与 Chrome DevTools 偏差 < 5%
  □ TTFB 数值与 Chrome DevTools 偏差 < 5%
  □ Navigation Timing 数据完整

行为追踪：
  □ PV 能正常上报
  □ 点击事件能正常追踪
  □ 路由变化能正常追踪
  □ 自定义事件能正常上报

数据上报：
  □ 批量上报正常工作
  □ 页面关闭时数据不丢失（Beacon API）
  □ 离线时数据缓存到 localStorage
  □ 恢复在线后缓存数据能重新上报
  □ 采样率控制生效

SDK 质量：
  □ SDK 自身不产生未捕获异常
  □ TypeScript 类型定义完整
  □ gzip 后体积 < 10KB
  □ 不阻塞主线程
```

## 扩展方向

完成基础版本后，可以继续扩展：

1. **Source Map 上传工具**：CLI 工具，构建时上传 Source Map
2. **错误聚合**：服务端实现错误指纹和去重
3. **Session Replay**：录制用户操作回放
4. **告警集成**：对接飞书/钉钉/Slack 机器人
5. **Dashboard**：基于 Grafana 或自建的数据大盘

## 本课小结

1. **架构设计**：模块化设计，采集器、队列、上报器分离
2. **错误捕获**：覆盖 JS 错误、Promise 异常、资源错误、网络错误
3. **性能采集**：基于 PerformanceObserver 的 Web Vitals 采集
4. **行为追踪**：PV、点击、路由变化的自动追踪
5. **数据上报**：批量 + Beacon + 离线缓存 + 采样控制
6. **质量保障**：SDK 自身不能成为问题的来源

## 下一步

完成本阶段后，继续学习 [stage6：前端性能优化](../stage6-performance/README.md)。
