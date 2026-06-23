# 09. 性能预算与持续监控 —— Performance Budget、Lighthouse CI、Web Vitals 监控

> 优化不是一次性的——没有预算和监控，性能会在不知不觉中退化

## 本课目标

- 理解性能预算的概念和设定方法
- 掌握 Lighthouse CI 的配置和集成
- 设计 Web Vitals 持续监控方案
- 建立性能优化的闭环流程

## 为什么需要性能预算

```
场景：你花了两周优化性能，Lighthouse 分数从 55 提升到 89。

三个月后：
- 新增了 3 个第三方分析脚本
- 引入了一个重量级 UI 库
- 图片没有压缩就上传了
- 新同事写了几个没有优化的组件

Lighthouse 分数悄悄降回了 62。

没有人注意到，因为没有人在监控。
```

性能预算就是"性能的及格线"。低于这条线，CI 失败，不允许合并。

## 什么是性能预算

```
性能预算是一组可量化的性能指标阈值：

资源预算：
  - JS 总体积 ≤ 300KB (gzip)
  - CSS 总体积 ≤ 60KB (gzip)
  - 图片总体积 ≤ 500KB
  - 首屏请求数 ≤ 20
  - 字体文件 ≤ 100KB

指标预算：
  - LCP ≤ 2.5s
  - INP ≤ 200ms
  - CLS ≤ 0.1
  - TTFB ≤ 800ms
  - FCP ≤ 1.8s

分数预算：
  - Lighthouse Performance ≥ 85
  - Lighthouse Accessibility ≥ 90
```

### 设定性能预算

```javascript
// .performance-budget.json
{
  "resourceSizes": [
    { "resourceType": "script", "budget": 300 },
    { "resourceType": "stylesheet", "budget": 60 },
    { "resourceType": "image", "budget": 500 },
    { "resourceType": "font", "budget": 100 },
    { "resourceType": "total", "budget": 1000 }
  ],
  "resourceCounts": [
    { "resourceType": "script", "budget": 10 },
    { "resourceType": "stylesheet", "budget": 3 },
    { "resourceType": "total", "budget": 30 }
  ],
  "timings": [
    { "metric": "first-contentful-paint", "budget": 1800 },
    { "metric": "largest-contentful-paint", "budget": 2500 },
    { "metric": "total-blocking-time", "budget": 200 },
    { "metric": "cumulative-layout-shift", "budget": 0.1 }
  ]
}
```

```
设定预算的思考框架：

1. 基于当前状态
   - 先测量当前指标
   - 设定一个合理的改善目标（如 LCP 从 4s 优化到 2.5s）

2. 基于用户期望
   - Core Web Vitals 的 Good 标准是 Google 基于用户研究设定的
   - 以此为基准设定预算

3. 基于竞品
   - 测量竞品的性能指标
   - 设定至少和竞品持平的预算

4. 基于业务影响
   - Google 的数据：LCP 每改善 100ms，转化率提升 X%
   - 根据业务价值设定优先级

预算不是一成不变的：
  - 每个季度回顾一次
  - 随着项目复杂度增长，预算可能需要调整
  - 但调整要有数据支撑，不是"太紧了就放松"
```

## Lighthouse CI

Lighthouse CI 把 Lighthouse 集成到 CI/CD 流程中，每次代码提交都自动运行性能测试。

### 安装和配置

```bash
# 安装
npm install -g @lhci/cli
npm install --save-dev @lhci/cli
```

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      // 要测试的 URL
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/products',
        'http://localhost:3000/about',
      ],
      // 测试次数（取中位数）
      numberOfRuns: 3,
      // 启动开发服务器
      startServerCommand: 'npm run dev',
      startServerReadyPattern: 'listening on',
      startServerReadyTimeout: 30000,
      // Chrome 启动参数
      settings: {
        chromeFlags: '--no-sandbox --headless',
        // 模拟移动设备
        preset: 'desktop',
      },
    },
    assert: {
      // 性能断言
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'resource-summary:script:size': ['error', { maxNumericValue: 300000 }],
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 60000 }],
      },
    },
    upload: {
      // 上传结果到 Lighthouse CI Server
      target: 'temporary-public-storage',
      // 或自建服务器
      // target: 'lhci',
      // serverBaseUrl: 'https://lhci.example.com',
    },
  },
};
```

### 集成到 CI/CD

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      
      - run: npm ci
      - run: npm run build
      
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

```
Lighthouse CI 的工作流程：

1. 开发者提交 PR
2. CI 自动构建项目
3. CI 启动本地服务器
4. Lighthouse 对每个配置的 URL 运行 3 次测试
5. 取中位数结果
6. 和配置的阈值对比
7. 如果低于阈值 → CI 失败，PR 不能合并
8. 在 PR 中评论 Lighthouse 报告链接

效果：
  - 性能退化在代码审查阶段就被发现
  - 开发者有动力在开发时就关注性能
  - 避免"优化→退化→再优化"的循环
```

## Web Vitals 持续监控

Lighthouse CI 是实验室测试（Lab Data），还需要真实用户数据（Field Data / RUM）。

### 使用 web-vitals 库采集

```javascript
// web-vitals-monitor.js
import { onLCP, onINP, onCLS, onTTFB, onFCP } from 'web-vitals';

const vitalsUrl = 'https://example.com/api/vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,     // 'good' | 'needs-improvement' | 'poor'
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    
    // 额外上下文
    page: location.pathname,
    connection: navigator.connection?.effectiveType || 'unknown',
    deviceMemory: navigator.deviceMemory || 'unknown',
    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
  });
  
  // 使用 Beacon API（页面关闭时不丢失数据）
  if (navigator.sendBeacon) {
    navigator.sendBeacon(vitalsUrl, body);
  } else {
    fetch(vitalsUrl, {
      method: 'POST',
      body,
      keepalive: true,
    });
  }
}

// 采集所有 Core Web Vitals
onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics, { reportAllChanges: true });
onTTFB(sendToAnalytics);
onFCP(sendToAnalytics);
```

### 分析和告警

```javascript
// 服务端：聚合和分析 Vitals 数据
// vitals-api.js

// P75 计算
function calculateP75(values) {
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.75) - 1;
  return sorted[index];
}

// 告警规则
const ALERT_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
};

function checkAlerts(metric, p75Value) {
  const threshold = ALERT_THRESHOLDS[metric];
  if (!threshold) return null;
  
  if (p75Value > threshold.poor) {
    return {
      level: 'critical',
      message: `${metric} P75 = ${p75Value}，超过 Poor 阈值 ${threshold.poor}`,
    };
  }
  
  if (p75Value > threshold.good) {
    return {
      level: 'warning',
      message: `${metric} P75 = ${p75Value}，超过 Good 阈值 ${threshold.good}`,
    };
  }
  
  return null;
}

// 定时任务：每小时聚合一次数据
async function aggregateAndAlert() {
  const metrics = ['LCP', 'INP', 'CLS', 'TTFB'];
  
  for (const metric of metrics) {
    const lastHourData = await getMetricData(metric, '1h');
    const p75 = calculateP75(lastHourData.map(d => d.value));
    const alert = checkAlerts(metric, p75);
    
    if (alert) {
      await sendAlert({
        ...alert,
        metric,
        p75,
        sampleSize: lastHourData.length,
      });
    }
  }
}
```

### 数据可视化

```
性能监控大盘应该包含：

1. 核心指标趋势图
   - LCP/INP/CLS 的 P75 值随时间变化
   - 按页面分组
   - 标记部署时间点（看部署是否影响性能）

2. 设备/网络分布
   - 移动端 vs 桌面端的指标差异
   - 4G vs 3G vs WiFi 的指标差异
   - 不同设备性能等级的指标差异

3. 页面级分析
   - 哪些页面性能最差
   - 哪些页面改善最多
   - 按页面类型的性能分布

4. 告警历史
   - 什么时候触发了告警
   - 告警原因是什么
   - 是否已解决
```

## 性能优化闭环

```
完整流程：

1. 设定预算
   - 基于业务目标和用户期望
   - 团队共识

2. 开发阶段
   - 开发者在本地运行 Lighthouse
   - IDE 插件实时提醒性能问题

3. PR 阶段
   - Lighthouse CI 自动测试
   - 低于预算 → CI 失败
   - Bundle size 检查

4. 部署后
   - RUM 数据采集
   - P75 监控
   - 告警

5. 定期回顾
   - 每月回顾性能趋势
   - 预算调整
   - 优化计划

循环往复，持续改进。
```

## 工具推荐

```
实验室测试（Lab Data）：
  Lighthouse           → 综合评分和优化建议
  WebPageTest          → 详细的加载瀑布图
  Chrome DevTools      → 运行时性能分析

真实用户数据（Field Data / RUM）：
  web-vitals 库        → 开源，自己采集
  Google Analytics     → 免费，自动采集 CWV
  Sentry Performance   → 错误监控 + 性能监控
  DataDog RUM          → 企业级监控

CI 集成：
  Lighthouse CI        → GitHub Actions 集成
  Bundlewatch          → Bundle 体积检查
  size-limit           → PR 中显示体积变化

告警：
  PagerDuty            → 企业级告警
  Slack 集成           → 通知到团队频道
  自建告警服务         → 灵活定制
```

## 本课小结

```
性能监控体系：

预防：
  - 性能预算 → CI 卡点
  - Bundle 体积检查
  - 代码审查中的性能关注

发现：
  - Lighthouse CI → 实验室数据
  - RUM 采集 → 真实用户数据
  - 告警 → 主动通知

分析：
  - 监控大盘 → 趋势和分布
  - 页面级分析 → 找到最差页面
  - 设备/网络分析 → 找到受影响最大的用户群

改进：
  - 优化计划 → 优先级排序
  - 效果验证 → A/B 测试
  - 预算调整 → 持续改进
```

## 练习

### 练习一：设计性能预算

你正在开发一个内容型网站（博客 + 文档），请为其设计性能预算：

1. 需要设定哪些指标的预算？
2. 每个指标的阈值应该是多少？为什么？
3. 如何在 CI 中执行这些预算？

### 练习二：搭建 Lighthouse CI

为以下项目配置 Lighthouse CI：

```json
// package.json
{
  "name": "my-ecommerce",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

要求：
1. 配置 lighthouserc.js
2. 测试首页、商品列表页、商品详情页
3. 设定性能断言
4. 集成到 GitHub Actions

---

## 参考答案

### 练习一

```json
// .performance-budget.json
{
  "resourceSizes": [
    { "resourceType": "script", "budget": 250, "unit": "KB" },
    { "resourceType": "stylesheet", "budget": 50, "unit": "KB" },
    { "resourceType": "image", "budget": 300, "unit": "KB" },
    { "resourceType": "font", "budget": 80, "unit": "KB" },
    { "resourceType": "document", "budget": 50, "unit": "KB" },
    { "resourceType": "total", "budget": 730, "unit": "KB" }
  ],
  "resourceCounts": [
    { "resourceType": "script", "budget": 8 },
    { "resourceType": "stylesheet", "budget": 2 },
    { "resourceType": "total", "budget": 25 }
  ],
  "timings": [
    { "metric": "first-contentful-paint", "budget": 1500 },
    { "metric": "largest-contentful-paint", "budget": 2000 },
    { "metric": "total-blocking-time", "budget": 150 },
    { "metric": "cumulative-layout-shift", "budget": 0.05 },
    { "metric": "time-to-first-byte", "budget": 600 }
  ]
}
```

```
预算说明：

资源预算：
  JS ≤ 250KB：博客/文档不需要大量 JS，250KB 足够包含框架和必要逻辑
  CSS ≤ 50KB：Tailwind CSS 按需生成后通常在 20-40KB
  图片 ≤ 300KB：博客图片应该压缩，文档站图片较少
  字体 ≤ 80KB：只加载 latin 字符集 + 必要的中文字重
  总计 ≤ 73KB：确保在 3G 网络下 3 秒内加载完成

指标预算：
  FCP ≤ 1.5s：内容型网站应该让用户快速看到内容
  LCP ≤ 2.0s：比 Good 标准更严格，因为内容站 LCP 通常是文本
  TBT ≤ 150ms：博客/文档交互简单，TBT 应该很低
  CLS ≤ 0.05：内容站不应该有布局跳动
  TTFB ≤ 600ms：使用 CDN + SSG/ISR，TTFB 应该很低

为什么比通用标准更严格：
  内容型网站相对简单，没有复杂交互和大量动态内容
  用户期望内容站加载更快（和电商/SaaS 相比）
  更严格的预算留出余量，避免项目增长后超标
```

### 练习二

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/products',
        'http://localhost:3000/products/1',
      ],
      numberOfRuns: 3,
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'started server',
      startServerReadyTimeout: 60000,
      settings: {
        chromeFlags: '--no-sandbox --headless',
        preset: 'mobile',  // 移动端优先
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        
        'resource-summary:script:size': ['error', { maxNumericValue: 300000 }],
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 60000 }],
        'resource-summary:total:size': ['error', { maxNumericValue: 1000000 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      
      - run: npm ci
      - run: npm run build
      
      - name: Run Lighthouse CI
        run: npx lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
      
      - name: Upload Lighthouse Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: lighthouse-report
          path: .lighthouseci/
```

```
配置说明：

1. 测试 URL：
   - 首页（/）
   - 商品列表页（/products）
   - 商品详情页（/products/1）
   - 覆盖主要页面类型

2. 移动端优先：
   - 使用 mobile preset
   - 移动端性能要求更高
   - 如果移动端达标，桌面端通常也达标

3. 断言设置：
   - Performance 分数 ≥ 85（error 级别，低于则失败）
   - Accessibility 分数 ≥ 90（warn 级别，低于则警告）
   - 每个 Core Web Vitals 指标都有具体阈值
   - 资源体积有上限

4. CI 集成：
   - PR 时自动运行
   - 推送到 main 时也运行（记录基线数据）
   - 失败时阻止合并
   - 报告上传为 artifact，方便查看
```

## 下一步

完成本课后，继续学习 [10. 阶段项目：真实项目性能审计与优化](./10-stage-project.md)。
