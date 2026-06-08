# 第2课：在 CI 中运行 Lighthouse

> **课程定位**：将 Lighthouse 集成到 CI/CD 流程，自动化性能检查
> **前置知识**：了解 Lighthouse 和 CI/CD 基础
> **预计时长**：30 分钟

---

## 学习目标

1. 了解 Lighthouse CI 的工作原理
2. 掌握 Lighthouse CI 的配置方法
3. 学会设定 Lighthouse 预算和断言
4. 了解 Lighthouse CI 的结果展示和集成

---

## 一、为什么在 CI 中运行 Lighthouse

```
┌──────────────────────────────────────────────────────────────┐
│              为什么需要 Lighthouse CI？                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  问题：                                                       │
│  - 开发时不会每次都跑 Lighthouse                              │
│  - 性能退化往往在合并后才发现                                 │
│  - 手动检查依赖个人习惯                                       │
│                                                              │
│  解决：                                                       │
│  - 每次 PR 自动运行 Lighthouse                                │
│  - 分数低于阈值时阻止合并                                     │
│  - 生成报告，方便 review                                      │
│  - 跟踪性能趋势                                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、Lighthouse CI 配置

### 2.1 安装

```bash
npm install -g @lhci/cli
# 或
npm install --save-dev @lhci/cli
```

### 2.2 配置文件

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      // 要测试的 URL
      url: ['http://localhost:3000/', 'http://localhost:3000/about'],
      // 启动服务器的命令
      startServerCommand: 'npm run start',
      // 等待服务器启动的时间
      startServerReadyPattern: 'Listening on port',
      // 测试次数（取中位数）
      numberOfRuns: 3,
      // Chrome 启动参数
      settings: {
        chromeFlags: '--no-sandbox --headless',
      },
    },
    assert: {
      // 断言规则
      assertions: {
        // 性能分数 ≥ 90
        'categories:performance': ['error', { minScore: 0.9 }],
        // 可访问性分数 ≥ 90
        'categories:accessibility': ['error', { minScore: 0.9 }],
        // LCP ≤ 2.5s
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        // CLS ≤ 0.1
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        // TBT ≤ 200ms
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        // FCP ≤ 1.8s
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
      },
    },
    upload: {
      // 上传报告到 Lighthouse CI Server（可选）
      target: 'temporary-public-storage',
    },
  },
};
```

### 2.3 GitHub Actions 集成

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

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

      - name: Upload Lighthouse Report
        uses: actions/upload-artifact@v4
        with:
          name: lighthouse-report
          path: .lighthouseci/*.html
```

### 2.4 GitLab CI 集成

```yaml
# .gitlab-ci.yml
lighthouse:
  stage: test
  image: cypress/browsers:node-20.9.0-chrome-118.0.5993.88-1-ff-118.0.2-edge-118.0.2088.46-1
  script:
    - npm ci
    - npm run build
    - npm install -g @lhci/cli
    - lhci autorun
  artifacts:
    paths:
      - .lighthouseci/
    expire_in: 7 days
```

---

## 三、断言配置详解

### 3.1 分数断言

```javascript
assertions: {
  // 性能分数 ≥ 0.9（90 分）
  'categories:performance': ['error', { minScore: 0.9 }],

  // 可访问性分数 ≥ 0.9
  'categories:accessibility': ['warn', { minScore: 0.9 }],

  // SEO 分数 ≥ 0.9
  'categories:seo': ['warn', { minScore: 0.9 }],

  // PWA 分数 ≥ 0.5
  'categories:pwa': ['off', { minScore: 0.5 }],
}
```

### 3.2 指标断言

```javascript
assertions: {
  // LCP ≤ 2.5s
  'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],

  // FID ≤ 100ms
  'max-potential-fid': ['error', { maxNumericValue: 100 }],

  // CLS ≤ 0.1
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],

  // TBT ≤ 200ms
  'total-blocking-time': ['error', { maxNumericValue: 200 }],

  // Speed Index ≤ 3s
  'speed-index': ['warn', { maxNumericValue: 3000 }],
}
```

### 3.3 资源断言

```javascript
assertions: {
  // JS 总大小 ≤ 200KB
  'resource-summary:script:size': ['error', { maxNumericValue: 200000 }],

  // CSS 总大小 ≤ 50KB
  'resource-summary:stylesheet:size': ['error', { maxNumericValue: 50000 }],

  // 图片总大小 ≤ 200KB
  'resource-summary:image:size': ['error', { maxNumericValue: 200000 }],

  // 请求数 ≤ 20
  'resource-summary:total:count': ['warn', { maxNumericValue: 20 }],
}
```

### 3.4 审计项断言

```javascript
assertions: {
  // 图片是否有尺寸
  'unsized-images': ['error', { maxLength: 0 }],

  // 是否有未使用的 JS
  'unused-javascript': ['warn', { maxLength: 5 }],

  // 字体显示策略
  'font-display': ['error', { maxLength: 0 }],

  // 是否有 render-blocking 资源
  'render-blocking-resources': ['warn', { maxLength: 3 }],
}
```

---

## 四、高级配置

### 4.1 多页面测试

```javascript
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/about',
        'http://localhost:3000/products',
        'http://localhost:3000/blog',
      ],
      // 为不同页面设置不同断言
    },
    assert: {
      matrix: [
        {
          matchingUrlPattern: 'http://localhost:3000/$',
          assertions: {
            'categories:performance': ['error', { minScore: 0.95 }],
          },
        },
        {
          matchingUrlPattern: '.*',
          assertions: {
            'categories:performance': ['error', { minScore: 0.9 }],
          },
        },
      ],
    },
  },
};
```

### 4.2 自定义 Chrome 配置

```javascript
module.exports = {
  ci: {
    collect: {
      settings: {
        // 模拟移动设备
        preset: 'desktop',
        // 或自定义
        emulatedFormFactor: 'mobile',
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
        },
        // Chrome 启动参数
        chromeFlags: '--no-sandbox --headless --disable-gpu',
      },
    },
  },
};
```

### 4.3 持久化存储

```javascript
module.exports = {
  ci: {
    upload: {
      // 上传到 Lighthouse CI Server
      target: 'lhci',
      serverBaseUrl: 'https://your-lhci-server.com',
    },
    // 或上传到临时存储
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

---

## 五、结果展示

### 5.1 PR 评论

```yaml
# 使用 Lighthouse CI GitHub App 自动生成 PR 评论
# 安装 Lighthouse CI GitHub App 后自动工作

# 或使用第三方 Action
- name: Lighthouse Report
  uses: foo-software/lighthouse-check-action@v11
  with:
    urls: 'http://localhost:3000'
    accessToken: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

### 5.2 报告查看

```bash
# 本地查看报告
npx lhci autorun
open .lighthouseci/*.html

# 查看历史趋势
npx lhci server
```

---

## 六、检查清单

```
┌──────────────────────────────────────────────────────────────┐
│              Lighthouse CI 检查清单                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  配置                                                        │
│  □ 有 lighthouserc.js 配置文件                               │
│  □ 配置了要测试的 URL                                        │
│  □ 配置了服务器启动命令                                      │
│                                                              │
│  断言                                                        │
│  □ 有 Core Web Vitals 断言                                   │
│  □ 有性能分数断言                                            │
│  □ 有资源大小断言                                            │
│                                                              │
│  CI 集成                                                     │
│  □ PR 时自动运行 Lighthouse                                  │
│  □ 断言失败时阻止合并                                        │
│  □ 有报告可查看                                              │
│                                                              │
│  维护                                                        │
│  □ 定期审查断言是否合理                                      │
│  □ 有性能趋势跟踪                                            │
│  □ 断言失败有处理流程                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 动手练习

### 练习一：配置 Lighthouse CI

1. 为项目创建 lighthouserc.js
2. 配置性能断言
3. 本地运行 `lhci autorun` 测试

### 练习二：集成 GitHub Actions

1. 创建 lighthouse.yml 工作流
2. 配置 PR 触发
3. 测试断言失败时的行为

### 练习三：自定义断言

1. 为不同页面设置不同的性能预算
2. 添加资源大小断言
3. 测试断言的准确性

---

## 小结

1. **Lighthouse CI**：自动化性能检查，防止性能退化
2. **断言配置**：分数、指标、资源、审计项
3. **CI 集成**：GitHub Actions / GitLab CI
4. **PR 评论**：自动生成 Lighthouse 报告
5. **持续改进**：定期审查断言，跟踪性能趋势

---

## 下一课预告

下一课将学习线上 Web Vitals 采集——了解真实用户的性能体验。
