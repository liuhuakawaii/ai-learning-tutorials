# 06. 用户行为追踪与埋点

> 自动埋点、手动埋点、PV/UV、点击热力图——用数据理解用户如何使用你的产品

## 本课目标

- 理解用户行为追踪的价值和核心指标（PV/UV/留存/转化）
- 掌握自动埋点和手动埋点的实现原理和适用场景
- 能设计合理的埋点方案
- 理解点击热力图的实现原理
- 处理埋点中的隐私合规问题

## 一个产品决策的困境

产品经理说："新上线的注册流程，转化率只有 15%，不知道用户卡在哪里。"

你有三条路可以走：

1. **猜**："可能是第二步的表单太长了"——然后缩短表单，转化率还是 15%
2. **问用户**：做用户访谈，但样本小，而且用户说的和做的经常不一致
3. **看数据**：发现 60% 的用户在"上传头像"这一步离开了——然后把头像改成可选项，转化率提升到 40%

第三条路依赖用户行为数据。这就是埋点的价值：**用数据代替猜测做产品决策**。

## 核心指标

### PV 和 UV

```javascript
// PV（Page View）：页面被访问的次数
// 一个用户刷新页面 3 次 = 3 个 PV

// UV（Unique Visitor）：独立访客数
// 一个用户刷新页面 3 次 = 1 个 UV

// 统计方式
// PV：每次页面加载就 +1
// UV：通常基于用户 ID 或设备 ID 去重
```

PV/UV 的采集方式：

```javascript
// 最基本的 PV 上报
function trackPageView() {
  reportEvent({
    type: 'pageview',
    url: location.href,
    path: location.pathname,
    referrer: document.referrer,
    timestamp: Date.now(),
    userId: getCurrentUserId(), // 登录用户
    sessionId: getSessionId(),  // 会话 ID
  });
}

// SPA 应用需要监听路由变化
// React Router 示例
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function PageViewTracker() {
  const location = useLocation();
  
  useEffect(() => {
    trackPageView();
  }, [location.pathname]); // 路径变化时上报
  
  return null;
}
```

### 停留时长

```javascript
class StayDurationTracker {
  constructor() {
    this.enterTime = Date.now();
    this.isVisible = true;
    
    // 页面不可见时暂停计时
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.isVisible = false;
        this.pauseTime = Date.now();
      } else {
        this.isVisible = true;
        this.enterTime += Date.now() - this.pauseTime;
      }
    });
    
    // 页面卸载时上报
    window.addEventListener('pagehide', () => this.report());
  }

  getDuration() {
    return Date.now() - this.enterTime;
  }

  report() {
    const duration = this.getDuration();
    reportEvent({
      type: 'stay_duration',
      page: location.pathname,
      duration,
      seconds: Math.round(duration / 1000),
    });
  }
}
```

### 转化漏斗

```
注册漏斗示例：

访问首页     → 10000 UV (100%)
点击注册按钮 → 3000 UV  (30%)
填写手机号   → 2500 UV  (25%)
获取验证码   → 2200 UV  (22%)
填写个人信息 → 1800 UV  (18%)
完成注册     → 1500 UV  (15%) ← 转化率

每一层的流失率：
首页→点击注册：70% 流失
点击注册→填写手机：17% 流失
填写手机→获取验证码：12% 流失
获取验证码→填写信息：18% 流失 ← 问题在这里
填写信息→完成注册：17% 流失
```

## 自动埋点

自动埋点通过全局监听器自动采集用户行为，不需要在每个交互点手动添加代码。

### 基本原理

```javascript
class AutoTracker {
  constructor(options = {}) {
    this.endpoint = options.endpoint;
    this.setupClickTracking();
    this.setupNavigationTracking();
    this.setupExposureTracking();
    this.setupScrollTracking();
  }

  // 自动追踪点击事件
  setupClickTracking() {
    document.addEventListener('click', (event) => {
      const target = event.target;
      
      // 生成元素标识
      const elementInfo = this.getElementInfo(target);
      
      this.report({
        type: 'click',
        ...elementInfo,
        page: location.pathname,
        timestamp: Date.now(),
      });
    }, true);
  }

  // 自动追踪页面跳转
  setupNavigationTracking() {
    // 监听 pushState / replaceState
    const originalPushState = history.pushState;
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.reportNavigation('pushState', args[2]);
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.reportNavigation('replaceState', args[2]);
    };

    // 监听 popstate（浏览器前进/后退）
    window.addEventListener('popstate', () => {
      this.reportNavigation('popstate');
    });
  }

  // 自动追踪元素曝光
  setupExposureTracking() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const element = entry.target;
          const trackId = element.dataset.trackExposure;
          
          if (trackId) {
            this.report({
              type: 'exposure',
              trackId,
              ...this.getElementInfo(element),
              page: location.pathname,
            });
            observer.unobserve(element); // 只上报一次
          }
        }
      }
    }, { threshold: 0.5 }); // 50% 可见时触发

    // 观察所有带 data-track-exposure 属性的元素
    document.querySelectorAll('[data-track-exposure]').forEach(el => {
      observer.observe(el);
    });
  }

  // 自动追踪滚动深度
  setupScrollTracking() {
    let maxScrollDepth = 0;
    
    const track = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const scrollPercent = Math.round((scrollTop / (docHeight - winHeight)) * 100);
      
      if (scrollPercent > maxScrollDepth) {
        maxScrollDepth = scrollPercent;
      }
    };
    
    // 节流处理
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          track();
          ticking = false;
        });
        ticking = true;
      }
    });
    
    // 页面卸载时上报最大滚动深度
    window.addEventListener('pagehide', () => {
      this.report({
        type: 'scroll_depth',
        page: location.pathname,
        maxDepth: maxScrollDepth,
      });
    });
  }

  getElementInfo(element) {
    return {
      tagName: element.tagName,
      id: element.id || undefined,
      className: element.className || undefined,
      text: this.getElementText(element),
      href: element.href || undefined,
      // 自定义埋点标识
      trackId: element.dataset.trackId || undefined,
      // CSS 选择器路径（用于定位元素）
      selector: this.getSelector(element),
    };
  }

  getElementText(element, maxLength = 50) {
    const text = element.textContent?.trim() || '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  }

  getSelector(element) {
    const parts = [];
    let current = element;
    
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

  reportNavigation(type, url) {
    this.report({
      type: 'navigation',
      method: type,
      from: location.href,
      to: url || location.href,
      page: location.pathname,
    });
  }

  report(data) {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.endpoint, JSON.stringify(data));
    } else {
      fetch(this.endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
        keepalive: true,
      });
    }
  }
}
```

### 自动埋点的 HTML 标记

```html
<!-- 使用 data 属性标记需要追踪的元素 -->
<button data-track-id="register-btn" data-track-exposure="register-banner">
  免费注册
</button>

<a href="/pricing" data-track-id="pricing-link">查看定价</a>

<div data-track-exposure="hero-section">
  <img src="/hero.jpg" alt="Hero" />
</div>
```

### 自动埋点的优势与局限

```
优势：
- 接入成本低，一次初始化覆盖全站
- 不需要开发配合，产品/运营可以自助分析
- 数据全面，不会遗漏

局限：
- 数据量大，存储和分析成本高
- 数据噪音多（误点击、自动滚动等）
- 无法采集业务语义（"用户购买了什么"）
- 元素标识不稳定（CSS 类名变化会导致数据断裂）
```

## 手动埋点

手动埋点在特定的业务节点手动添加追踪代码。

```javascript
// 业务事件追踪
class BusinessTracker {
  // 用户注册
  trackRegister(method) {
    reportEvent({
      type: 'register',
      method, // 'phone' | 'email' | 'wechat'
      timestamp: Date.now(),
    });
  }

  // 商品购买
  trackPurchase(order) {
    reportEvent({
      type: 'purchase',
      orderId: order.id,
      amount: order.totalAmount,
      currency: order.currency,
      items: order.items.map(item => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    });
  }

  // 搜索
  trackSearch(query, results) {
    reportEvent({
      type: 'search',
      query,
      resultCount: results.length,
      hasResults: results.length > 0,
    });
  }

  // 分享
  trackShare(content, channel) {
    reportEvent({
      type: 'share',
      contentId: content.id,
      contentType: content.type,
      channel, // 'wechat' | 'weibo' | 'link'
    });
  }
}
```

### 手动埋点的代码组织

```javascript
// 方式一：直接调用（最简单，但容易遗漏）
button.addEventListener('click', () => {
  tracker.trackPurchase(order);
  handlePurchase();
});

// 方式二：高阶函数封装
function withTracking(eventName, handler) {
  return function(...args) {
    tracker.track(eventName, args[0]);
    return handler.apply(this, args);
  };
}

const handlePurchase = withTracking('purchase', (order) => {
  // 业务逻辑
});

// 方式三：声明式埋点（React）
function TrackedButton({ trackId, onClick, children, ...props }) {
  const handleClick = (event) => {
    tracker.track('click', { trackId });
    onClick?.(event);
  };
  
  return <button onClick={handleClick} {...props}>{children}</button>;
}

// 使用
<TrackedButton trackId="submit-order" onClick={handleSubmit}>
  提交订单
</TrackedButton>
```

### 自动埋点 vs 手动埋点

| 维度 | 自动埋点 | 手动埋点 |
|------|---------|---------|
| 接入成本 | 低，一次初始化 | 高，每个事件单独开发 |
| 数据覆盖 | 全面，不遗漏 | 依赖开发覆盖 |
| 数据质量 | 有噪音 | 精准 |
| 业务语义 | 无 | 有 |
| 维护成本 | 低 | 高，改代码要同步改埋点 |
| 适用场景 | 页面浏览、点击热力图 | 转化漏斗、业务指标 |

**实际项目中通常是两者结合**：
- 自动埋点做基础覆盖（PV、点击、曝光、滚动）
- 手动埋点做关键业务节点（注册、购买、搜索）

## 点击热力图

热力图可视化展示用户在页面上的点击分布。

### 实现原理

```javascript
class HeatmapCollector {
  constructor() {
    this.clicks = [];
    this.setup();
  }

  setup() {
    document.addEventListener('click', (event) => {
      // 记录点击坐标（相对于视口和页面）
      this.clicks.push({
        x: event.clientX,                    // 视口 X
        y: event.clientY,                    // 视口 Y
        pageX: event.pageX,                  // 页面 X（包含滚动）
        pageY: event.pageY,                  // 页面 Y（包含滚动）
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        pageWidth: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
        target: this.getSelector(event.target),
        timestamp: Date.now(),
        page: location.pathname,
      });
    });
  }

  // 批量上报
  flush() {
    if (this.clicks.length === 0) return;
    
    const data = this.clicks.splice(0);
    navigator.sendBeacon('/api/heatmap', JSON.stringify({
      clicks: data,
      page: location.pathname,
    }));
  }
}
```

### 热力图渲染

```javascript
// 使用 canvas 渲染热力图
function renderHeatmap(canvas, clickData, pageWidth, pageHeight) {
  const ctx = canvas.getContext('2d');
  canvas.width = pageWidth;
  canvas.height = pageHeight;
  
  // 创建渐变色
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
  gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.4)');
  gradient.addColorStop(1, 'rgba(0, 0, 255, 0)');
  
  // 绘制每个点击点
  clickData.forEach(click => {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(click.pageX, click.pageY, 30, 0, Math.PI * 2);
    ctx.fill();
  });
}
```

## 埋点方案设计

### 事件数据结构

```javascript
interface TrackingEvent {
  // 事件标识
  eventType: 'pageview' | 'click' | 'exposure' | 'custom';
  eventName: string;
  
  // 用户标识
  userId?: string;
  sessionId: string;
  deviceId: string;
  
  // 页面信息
  page: string;
  pageTitle: string;
  referrer: string;
  
  // 设备信息
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  
  // 网络信息
  connectionType?: string;
  
  // 时间
  timestamp: number;
  
  // 业务数据（自定义）
  properties?: Record<string, any>;
}
```

### 上报策略

```javascript
class TrackingReporter {
  constructor() {
    this.queue = [];
    this.batchSize = 10;
    this.flushInterval = 5000;
    
    setInterval(() => this.flush(), this.flushInterval);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  track(event) {
    this.queue.push({
      ...event,
      timestamp: Date.now(),
      sessionId: this.sessionId,
    });
    
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  flush() {
    if (this.queue.length === 0) return;
    
    const events = this.queue.splice(0);
    navigator.sendBeacon('/api/track', JSON.stringify({ events }));
  }
}
```

## 隐私合规

### 数据最小化原则

```javascript
// 不要采集这些
const NEVER_COLLECT = [
  'password',
  'creditCard',
  'cvv',
  'idCard',
  'phoneNumber', // 除非明确告知用户
];

// 对输入框内容进行脱敏
function sanitizeInput(element) {
  if (element.tagName === 'INPUT') {
    const type = element.type.toLowerCase();
    if (['password', 'tel', 'number'].includes(type)) {
      return '[REDACTED]';
    }
  }
  return element.value;
}
```

### 用户同意机制

```javascript
class ConsentManager {
  constructor() {
    this.consent = this.loadConsent();
  }

  loadConsent() {
    try {
      return JSON.parse(localStorage.getItem('tracking_consent'));
    } catch {
      return null;
    }
  }

  hasConsent(type) {
    if (!this.consent) return false;
    return this.consent[type] === true;
  }

  grantConsent(types) {
    this.consent = { ...this.consent, ...types };
    localStorage.setItem('tracking_consent', JSON.stringify(this.consent));
  }

  revokeConsent() {
    this.consent = null;
    localStorage.removeItem('tracking_consent');
  }
}

// 埋点 SDK 初始化时检查同意状态
class TrackingSDK {
  constructor(consentManager) {
    this.consent = consentManager;
  }

  track(event) {
    // 功能性埋点（PV、错误）不需要同意
    if (['pageview', 'error'].includes(event.type)) {
      this.send(event);
      return;
    }
    
    // 行为埋点需要用户同意
    if (this.consent.hasConsent('analytics')) {
      this.send(event);
    }
  }
}
```

## 常见误区

### 误区一：埋点越多越好

**错误理解**：采集所有可能的数据，以后总会有用

**正确理解**：埋点有成本——开发成本、存储成本、分析成本。没有明确分析目的的埋点是浪费。应该先设计分析问题，再设计埋点方案。

### 误区二：只做自动埋点就够了

**错误理解**：自动埋点覆盖了所有交互，不需要手动埋点

**正确理解**：自动埋点只能采集"用户做了什么"，无法采集"业务结果是什么"。"用户点击了购买按钮"和"用户成功购买了商品 X，金额 99 元"是完全不同的信息。

### 误区三：埋点不需要版本管理

**错误理解**：埋点代码和业务代码一起发布就行

**正确理解**：埋点的版本管理很重要。如果埋点事件名或属性变了，分析平台上的历史数据和新数据就无法对比。需要维护埋点文档，版本化事件定义。

## 本课小结

1. **核心指标**：PV/UV、停留时长、转化漏斗、留存率
2. **自动埋点**：全局监听器自动采集，覆盖全面但有噪音
3. **手动埋点**：业务节点精准追踪，有语义但维护成本高
4. **热力图**：通过坐标数据可视化点击分布
5. **隐私合规**：数据最小化、用户同意机制、敏感数据脱敏
6. **最佳实践**：自动 + 手动结合，先设计问题再设计埋点

## 练习

### 练习一：设计埋点方案

为一个电商网站设计埋点方案，需要回答以下业务问题：
- 用户从首页到完成购买的转化率是多少？
- 哪些商品被浏览最多？哪些被加入购物车最多？
- 搜索功能的使用率和无结果率是多少？
- 用户平均停留时长是多少？

列出需要的埋点事件、属性和上报策略。

### 练习二：实现自动埋点 SDK

实现一个自动埋点 SDK，要求：
- 自动追踪页面浏览（PV）
- 自动追踪点击事件
- 自动追踪元素曝光（使用 IntersectionObserver）
- 批量上报（每 5 秒或队列满 20 条）

## 参考答案

### 练习一

```
事件列表：

1. pageview（页面浏览）
   属性：page, title, referrer
   触发：路由变化时

2. product_view（商品浏览）
   属性：product_id, product_name, price, category
   触发：商品详情页加载时

3. add_to_cart（加入购物车）
   属性：product_id, product_name, price, quantity
   触发：点击"加入购物车"按钮

4. search（搜索）
   属性：query, result_count, has_results
   触发：搜索请求返回后

5. purchase（购买）
   属性：order_id, total_amount, items[], payment_method
   触发：支付成功回调

6. stay_duration（停留时长）
   属性：page, duration_seconds
   触发：页面卸载时

上报策略：
- pageview、stay_duration：实时上报（Beacon API）
- 其他事件：批量上报（5 秒或 20 条）
- 采样率：100%（业务事件量不大，全量采集）
```

### 练习二

```javascript
class AutoTracker {
  constructor(options = {}) {
    this.endpoint = options.endpoint || '/api/track';
    this.queue = [];
    this.batchSize = options.batchSize || 20;
    this.flushInterval = options.flushInterval || 5000;
    
    this.trackPageView();
    this.trackClicks();
    this.trackExposure();
    
    setInterval(() => this.flush(), this.flushInterval);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  trackPageView() {
    this.send({
      event: 'pageview',
      page: location.pathname,
      referrer: document.referrer,
    });
  }

  trackClicks() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      this.send({
        event: 'click',
        tag: target.tagName,
        id: target.id || undefined,
        text: target.textContent?.slice(0, 50),
        page: location.pathname,
      });
    }, true);
  }

  trackExposure() {
    if (!('IntersectionObserver' in window)) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.target.dataset.expose) {
          this.send({
            event: 'exposure',
            id: entry.target.dataset.expose,
            page: location.pathname,
          });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    
    document.querySelectorAll('[data-expose]').forEach(el => {
      observer.observe(el);
    });
  }

  send(event) {
    this.queue.push({ ...event, timestamp: Date.now() });
    if (this.queue.length >= this.batchSize) this.flush();
  }

  flush() {
    if (this.queue.length === 0) return;
    const events = this.queue.splice(0);
    navigator.sendBeacon(this.endpoint, JSON.stringify({ events }));
  }
}
```

## 下一步

完成本课后，继续学习 [07. 监控数据可视化与告警](./07-monitoring-visualization-alerts.md)。
