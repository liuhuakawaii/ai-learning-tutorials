# 第3课：线上 Web Vitals 采集

> **课程定位**：采集真实用户的 Core Web Vitals 数据，了解线上性能表现
> **前置知识**：了解 Core Web Vitals 指标和 web-vitals 库
> **预计时长**：35 分钟

## 场景引入

你的 Lighthouse 分数是 95 分，但用户投诉"网站很卡"。你很困惑——本地测试明明很快啊。后来发现，Lighthouse 是在模拟的 4G 网络和中端设备上跑的，但你的用户里有 30% 用的是 2G 网络、低端安卓机。Lab 数据和真实用户数据差距很大。你需要采集线上真实用户的 Core Web Vitals 数据，了解 P75 用户（而非实验室环境）的体验。

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

## 参考答案

### 练习一：基础采集

**思路**：在项目中安装 web-vitals，采集 LCP、INP、CLS 并打印到控制台。

**答案**：

```javascript
// src/vitals.js
import { onLCP, onINP, onCLS } from 'web-vitals';

function logMetric(metric) {
  console.group(`🔍 ${metric.name}`);
  console.log(`值: ${metric.value.toFixed(1)}`);
  console.log(`评级: ${metric.rating}`); // good / needs-improvement / poor
  console.log(`ID: ${metric.id}`);
  if (metric.entries.length > 0) {
    console.log('关联元素:', metric.entries[0].target);
  }
  console.groupEnd();
}

onLCP(logMetric);
onINP(logMetric);
onCLS(logMetric);
```

```markdown
浏览器控制台输出：

🔍 LCP
  值: 2450.0
  评级: good
  关联元素: <img class="hero-banner" />

🔍 CLS
  值: 0.08
  评级: good

🔍 INP（需要用户交互后才输出）
  值: 150.0
  评级: good
  关联元素: <button class="submit-btn" />
```

**要点**：
- web-vitals 体积仅 ~1.5KB，对性能几乎无影响
- INP 需要用户实际交互后才会输出
- 多次测量结果可能不同，取 P75 作为参考

### 练习二：数据发送

**思路**：创建一个 /api/vitals 端点，使用 sendBeacon 发送指标数据。

**答案**：

```javascript
// 客户端：发送指标数据
import { onLCP, onINP, onCLS } from 'web-vitals';

function sendToAnalytics(metric) {
  const data = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    page: window.location.pathname,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
    connection: navigator.connection?.effectiveType,
  };

  // 优先使用 sendBeacon，降级到 fetch keepalive
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', JSON.stringify(data));
  } else {
    fetch('/api/vitals', {
      method: 'POST',
      body: JSON.stringify(data),
      keepalive: true,
    });
  }
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
```

```javascript
// 服务端：接收和存储指标数据
// app/api/vitals/route.js (Next.js)
import { NextResponse } from 'next/server';

export async function POST(request) {
  const data = await request.json();

  // 存储到数据库
  await db.vitals.create({
    data: {
      name: data.name,
      value: data.value,
      rating: data.rating,
      page: data.page,
      userAgent: data.userAgent,
      connection: data.connection,
      timestamp: new Date(data.timestamp),
    },
  });

  return NextResponse.json({ success: true });
}
```

**要点**：
- sendBeacon 在页面关闭时也能发送数据
- keepalive: true 是 fetch 的降级方案
- 数据应该包含页面路径、设备信息、网络条件

### 练习三：构建看板

**思路**：创建一个简单的 Web Vitals 看板，展示 P75 指标和趋势图。

**答案**：

```javascript
// 看板页面：查询和展示指标数据
// app/dashboard/page.tsx
async function VitalsDashboard() {
  // 查询最近 7 天的指标数据
  const vitals = await db.vitals.findMany({
    where: {
      timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { timestamp: 'desc' },
  });

  // 计算 P75
  const lcpValues = vitals.filter(v => v.name === 'LCP').map(v => v.value).sort((a, b) => a - b);
  const inpValues = vitals.filter(v => v.name === 'INP').map(v => v.value).sort((a, b) => a - b);
  const clsValues = vitals.filter(v => v.name === 'CLS').map(v => v.value).sort((a, b) => a - b);

  const p75 = (arr) => arr[Math.floor(arr.length * 0.75)] || 0;

  return (
    <div className="dashboard">
      <h1>Web Vitals 看板</h1>
      <div className="metrics">
        <MetricCard
          name="LCP"
          value={p75(lcpValues)}
          threshold={2500}
          unit="ms"
        />
        <MetricCard
          name="INP"
          value={p75(inpValues)}
          threshold={200}
          unit="ms"
        />
        <MetricCard
          name="CLS"
          value={p75(clsValues)}
          threshold={0.1}
          unit=""
        />
      </div>
      <TrendChart data={vitals} />
    </div>
  );
}

function MetricCard({ name, value, threshold, unit }) {
  const rating = value <= threshold ? 'good' : 'needs-improvement';
  return (
    <div className={`metric-card ${rating}`}>
      <h3>{name}</h3>
      <p className="value">{value.toFixed(1)}{unit}</p>
      <p className="threshold">阈值: {threshold}{unit}</p>
    </div>
  );
}
```

**要点**：
- P75 代表 75% 用户的体验，比平均值更有参考价值
- 看板应该按页面、设备类型、网络条件分组
- 设置阈值告警，超标时通知团队

---

## 常见误区

1. **只看平均值不看分位数**：平均值会被极端值拉偏。一个 10 秒的 LCP 会把平均值拉高，但 P75（75% 用户的体验）更能反映大多数用户的真实感受。应该看 P75 甚至 P95。
2. **样本量不足就下结论**：如果每天只有 100 个用户，LCP 的波动会很大。至少需要 1000+ 样本才能得出可靠结论。小流量站点可以用 CrUX 数据（Google 聚合的 28 天数据）作为补充。
3. **用 sendBeacon 发送所有数据**：sendBeacon 适合发送关键指标（LCP、INP、CLS），但如果把所有性能数据都用 sendBeacon 发送，会产生大量请求。应该批量聚合后再发送。
4. **忽略设备和网络维度**：桌面端和移动端的性能差异巨大，WiFi 和 4G 也不同。分析数据时必须按设备类型和网络条件分组，否则会掩盖真实问题。

## 工程建议

1. **用 web-vitals 库的 onINP 回调获取交互详情**：INP 不只是一个数字，回调中的 `entry` 对象包含交互类型（click/keydown）、目标元素、处理时间分解，这些信息对定位慢交互至关重要。
2. **数据发送用 sendBeacon + keepalive fetch 降级**：sendBeacon 在页面关闭时也能发送数据，但部分浏览器不支持。用 `navigator.sendBeacon || fetch(keepalive: true)` 做降级。
3. **用 CrUX API 补充小流量站点数据**：如果自己的样本量不够，用 CrUX API 查询 Google 聚合的 28 天真实用户数据，作为自己采集数据的参考。
4. **设置阈值告警而非只看趋势**：LCP P75 > 2.5s 时发送告警到 Slack/钉钉，而不是等月度报告才发现问题。告警要分级：warning（超标 20%）和 critical（超标 50%）。

## 小结

1. **Lab vs Field**：Lab 可控但不反映真实，Field 反映真实但需要流量
2. **web-vitals 库**：采集 Core Web Vitals 的标准方式
3. **sendBeacon**：确保页面关闭时数据也能发送
4. **CrUX 数据**：Google 提供的真实用户体验数据
5. **看板和告警**：P75 指标、趋势分析、阈值告警

---

## 下一课预告

下一课将学习慢交互日志——如何追踪和分析导致 INP 差的具体交互。
