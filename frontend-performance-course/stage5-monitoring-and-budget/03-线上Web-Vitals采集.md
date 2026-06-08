# 第3课：线上 Web Vitals 采集

> **课程定位**：采集真实用户的 Core Web Vitals 数据，了解线上性能表现
> **前置知识**：了解 Core Web Vitals 指标和 web-vitals 库
> **预计时长**：35 分钟

---

## 学习目标

1. 理解 Lab 数据和 Field 数据的区别
2. 掌握使用 web-vitals 库采集线上指标
3. 学会将数据发送到分析平台
4. 了解 Google 的 CrUX 数据

---

## 一、Lab vs Field 数据

```
┌──────────────────────────────────────────────────────────────┐
│              Lab 数据 vs Field 数据                            │
├──────────────────────┬───────────────────────────────────────┤
│                      │ Lab                │ Field             │
├──────────────────────┼────────────────────┼───────────────────┤
│ 环境                 │ 可控（模拟）       │ 真实用户设备      │
│ 网络                 │ 模拟 3G/4G        │ 真实网络          │
│ 设备                 │ 模拟中端设备       │ 各种设备          │
│ 数据量               │ 单次测试           │ 大量用户样本      │
│ 指标                 │ LCP, TBT, SI       │ LCP, INP, CLS    │
│ 工具                 │ Lighthouse, WPT    │ web-vitals, CrUX  │
│ 用途                 │ 开发调试           │ 监控真实体验      │
│ 局限                 │ 不反映真实环境     │ 需要足够流量      │
└──────────────────────┴────────────────────┴───────────────────┘

两者都需要：
- Lab：开发和 CI 中发现问题
- Field：监控真实用户体验，发现 Lab 无法覆盖的问题
```

---

## 二、使用 web-vitals 库

### 2.1 安装

```bash
npm install web-vitals
```

### 2.2 基本用法

```javascript
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

// 采集 LCP
onLCP((metric) => {
  console.log('LCP:', metric.value);
  console.log('LCP 元素:', metric.entries[0]?.element);
});

// 采集 INP
onINP((metric) => {
  console.log('INP:', metric.value);
});

// 采集 CLS
onCLS((metric) => {
  console.log('CLS:', metric.value);
});

// 采集 FCP
onFCP((metric) => {
  console.log('FCP:', metric.value);
});

// 采集 TTFB
onTTFB((metric) => {
  console.log('TTFB:', metric.value);
});
```

### 2.3 完整采集方案

```javascript
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  const body = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating, // 'good', 'needs-improvement', 'poor'
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    // 附加信息
    page: window.location.pathname,
    userAgent: navigator.userAgent,
    connection: navigator.connection?.effectiveType,
    deviceMemory: navigator.deviceMemory,
  };

  // 使用 sendBeacon（页面关闭时也能发送）
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', JSON.stringify(body));
  } else {
    fetch('/api/vitals', {
      method: 'POST',
      body: JSON.stringify(body),
      keepalive: true,
    });
  }
}

// 注册所有指标
onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

---

## 三、发送到分析平台

### 3.1 Google Analytics 4

```javascript
import { onLCP, onINP, onCLS } from 'web-vitals';

function sendToGA4(metric) {
  gtag('event', metric.name, {
    event_category: 'Web Vitals',
    event_label: metric.id,
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    non_interaction: true,
  });
}

onLCP(sendToGA4);
onINP(sendToGA4);
onCLS(sendToGA4);
```

### 3.2 Sentry

```javascript
import * as Sentry from '@sentry/browser';
import { onLCP, onINP, onCLS } from 'web-vitals';

function sendToSentry(metric) {
  Sentry.metrics.distribution(metric.name, metric.value, {
    tags: {
      rating: metric.rating,
      page: window.location.pathname,
    },
  });
}

onLCP(sendToSentry);
onINP(sendToSentry);
onCLS(sendToSentry);
```

### 3.3 自建分析平台

```javascript
// 后端 API
app.post('/api/vitals', (req, res) => {
  const metric = req.body;

  // 存储到数据库
  db.insert('web_vitals', {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    page: metric.page,
    timestamp: new Date(),
    user_agent: metric.userAgent,
    connection: metric.connection,
  });

  res.status(204).end();
});
```

---

## 四、自定义指标

### 4.1 交互延迟

```javascript
// 监控特定交互的延迟
import { onINP } from 'web-vitals';

onINP((metric) => {
  const entry = metric.entries[0];
  if (entry) {
    console.log('交互类型:', entry.name); // click, keydown, etc.
    console.log('交互目标:', entry.target);
    console.log('处理时间:', entry.processingDuration);
    console.log('呈现延迟:', entry.presentationDelay);
  }
});
```

### 4.2 自定义性能标记

```javascript
// 标记自定义性能事件
performance.mark('search-start');

// 搜索完成后
performance.mark('search-end');
performance.measure('search-duration', 'search-start', 'search-end');

// 采集
const measure = performance.getEntriesByName('search-duration')[0];
console.log('搜索耗时:', measure.duration);
```

---

## 五、CrUX 数据

### 5.1 什么是 CrUX

```
┌──────────────────────────────────────────────────────────────┐
│              CrUX（Chrome User Experience Report）             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Google 提供的真实用户体验数据：                              │
│  - 来自 Chrome 用户的匿名数据                                │
│  - 覆盖 millions 个网站                                      │
│  - 包含 Core Web Vitals 指标                                 │
│  - 按 28 天滚动统计                                          │
│                                                              │
│  获取方式：                                                   │
│  - CrUX Dashboard（Looker Studio）                           │
│  - CrUX API                                                  │
│  - PageSpeed Insights                                        │
│  - CrUX BigQuery 数据集                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 使用 CrUX API

```javascript
// 查询单个页面的 CrUX 数据
async function getCrUXData(url) {
  const response = await fetch(
    `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${API_KEY}`,
    {
      method: 'POST',
      body: JSON.stringify({
        origin: url,
        metrics: [
          'largest_contentful_paint',
          'cumulative_layout_shift',
          'interaction_to_next_paint',
        ],
      }),
    }
  );

  const data = await response.json();
  return data;
}
```

### 5.3 PageSpeed Insights

```bash
# 使用 PageSpeed Insights API
curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&strategy=mobile"

# 返回的数据包含：
# - Lighthouse Lab 数据
# - CrUX Field 数据
```

---

## 六、数据分析和可视化

### 6.1 关键指标看板

```
┌──────────────────────────────────────────────────────────────┐
│              Web Vitals 看板指标                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  核心指标：                                                   │
│  - P75 LCP（75% 用户的 LCP）                                 │
│  - P75 INP（75% 用户的 INP）                                 │
│  - P75 CLS（75% 用户的 CLS）                                 │
│                                                              │
│  分布：                                                       │
│  - Good / Needs Improvement / Poor 的用户比例                │
│  - 按页面分组的指标                                          │
│  - 按设备类型分组（桌面/移动）                               │
│  - 按网络条件分组                                            │
│                                                              │
│  趋势：                                                       │
│  - 每日/每周指标变化趋势                                     │
│  - 版本发布前后的对比                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 阈值和告警

```javascript
// 阈值配置
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
};

function checkThreshold(metric) {
  const threshold = THRESHOLDS[metric.name];
  if (!threshold) return;

  if (metric.value > threshold.poor) {
    // 告警：指标进入 Poor 区间
    alertTeam({
      metric: metric.name,
      value: metric.value,
      threshold: threshold.poor,
      severity: 'critical',
    });
  } else if (metric.value > threshold.good) {
    // 告警：指标进入 Needs Improvement 区间
    alertTeam({
      metric: metric.name,
      value: metric.value,
      threshold: threshold.good,
      severity: 'warning',
    });
  }
}
```

---

## 七、检查清单

```
┌──────────────────────────────────────────────────────────────┐
│              Web Vitals 采集检查清单                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  采集                                                        │
│  □ 已安装 web-vitals 库                                      │
│  □ 采集 LCP、INP、CLS                                        │
│  □ 数据包含页面路径和设备信息                                │
│                                                              │
│  发送                                                        │
│  □ 使用 sendBeacon 确保数据不丢失                            │
│  □ 数据发送到分析平台                                        │
│  □ 有错误处理                                                │
│                                                              │
│  分析                                                        │
│  □ 有 Web Vitals 看板                                        │
│  □ 有 P75 指标统计                                           │
│  □ 有按页面/设备分组的分析                                   │
│                                                              │
│  告警                                                        │
│  □ 有指标阈值配置                                            │
│  □ 指标超标时有告警                                          │
│  □ 有告警处理流程                                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 动手练习

### 练习一：基础采集

1. 在项目中安装 web-vitals
2. 采集 LCP、INP、CLS 并打印到控制台
3. 观察不同操作下的指标值

### 练习二：数据发送

1. 创建一个 /api/vitals 端点
2. 使用 sendBeacon 发送指标数据
3. 在服务端存储和查询数据

### 练习三：构建看板

1. 创建一个简单的 Web Vitals 看板
2. 展示 P75 指标和趋势图
3. 添加阈值告警

---

## 小结

1. **Lab vs Field**：Lab 可控但不反映真实，Field 反映真实但需要流量
2. **web-vitals 库**：采集 Core Web Vitals 的标准方式
3. **sendBeacon**：确保页面关闭时数据也能发送
4. **CrUX 数据**：Google 提供的真实用户体验数据
5. **看板和告警**：P75 指标、趋势分析、阈值告警

---

## 下一课预告

下一课将学习慢交互日志——如何追踪和分析导致 INP 差的具体交互。
