# 性能预算设定

> "LCP 要低于 2.5 秒"——这个目标怎么分解成可执行的任务？怎么确保团队持续达标？

## 什么是性能预算

性能预算是一组明确的、可测量的性能目标。它不是"尽量快"，而是具体的数字：

- LCP < 2.5s
- CLS < 0.1
- INP < 200ms
- 首屏 JS 总大小 < 200KB（压缩后）
- 首屏请求数 < 20

设定预算的意义：让性能成为一个可以追踪的指标，而不是"有空再优化"的事情。

## 怎么定数字

### 从 Core Web Vitals 阈值出发

Google 给出了明确的阈值：

| 指标 | 好 | 需改进 | 差 |
|------|-----|--------|-----|
| LCP | ≤ 2.5s | 2.5-4s | > 4s |
| INP | ≤ 200ms | 200-500ms | > 500ms |
| CLS | ≤ 0.1 | 0.1-0.25 | > 0.25 |

你的目标应该是"好"的范围，不是"需要改进"。

### 从当前数据出发

如果你已经有 Field Data（CrUX 或 RUM），看 p75 数值：

```
当前 p75 LCP: 3.8s
目标 p75 LCP: 2.5s
需要减少: 1.3s（34%）
```

然后分析 LCP 的构成，分解这 1.3 秒：

```
TTFB: 0.8s（可优化 0.3s —— 用 CDN）
资源加载: 1.5s（可优化 0.8s —— Code Splitting + 预加载）
渲染: 1.5s（可优化 0.2s —— 减少阻塞资源）
```

### 从资源大小出发

除了时间指标，还应该设定资源大小的预算：

```
JS 总大小: < 200KB（gzip 后）
CSS 总大小: < 50KB
图片: 每张 < 100KB，首屏 < 500KB 总计
字体: < 100KB
首屏请求总数: < 20
```

这些预算比时间指标更容易在开发过程中检查——你打包时就能看到。

## 在 CI/CD 中检查预算

把性能检查集成到 CI/CD 流程中，超标时阻止合并或发出告警。

### Lighthouse CI

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - uses: treosh/lighthouse-ci-action@v11
        with:
          configPath: ./lighthouserc.json
```

```json
// lighthouserc.json
{
  "ci": {
    "collect": {
      "staticDistDir": "./dist",
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }]
      }
    }
  }
}
```

### 资源大小检查

用 `bundlesize` 或自定义脚本检查打包产物大小：

```json
// package.json
{
  "bundlesize": [
    {
      "path": "./dist/assets/*.js",
      "maxSize": "200 kB",
      "compression": "gzip"
    },
    {
      "path": "./dist/assets/*.css",
      "maxSize": "50 kB",
      "compression": "gzip"
    }
  ]
}
```

```bash
npx bundlesize
```

## 性能预算的持续维护

设定预算只是第一步。真正难的是持续达标。

**监控**：用 RUM 工具（Sentry、Datadog）持续监控 Field Data。设定告警阈值——p75 LCP 超过 2.5s 时通知团队。

**回顾**：每个 Sprint 或每个月回顾一次性能指标。如果趋势向上（变慢），及时排查原因。

**归因**：当性能退化时，快速定位是哪次变更导致的。CI/CD 里的 Lighthouse 检查可以关联到具体的 PR。

**团队共识**：性能预算是团队共识，不是某个人的事。产品经理需要理解性能对业务指标（转化率、跳出率）的影响。

## 练习

### 练习一：为你的项目设定性能预算

根据你项目的当前状态，设定一份性能预算：

1. 用 Lighthouse 测试当前状态
2. 设定 LCP、INP、CLS 的目标值
3. 用 `bundlesize` 设定 JS/CSS 的大小预算
4. 写出达到目标需要做的 3 件优化

### 练习二：配置 Lighthouse CI

在你的项目里配置 Lighthouse CI：

1. 创建 GitHub Actions workflow
2. 配置 Lighthouse 的断言规则
3. 故意引入一个性能退化（比如 import 一个大库），验证 CI 是否能检测到

---

## 参考答案

### 练习一

预算设定应该满足：

- LCP 目标 ≤ 2.5s（如果当前 > 4s，先定 3.5s 作为阶段性目标）
- INP 目标 ≤ 200ms
- CLS 目标 ≤ 0.1
- JS 大小目标基于当前值减少 30%

关键：目标要可达成但有挑战性。太松没有意义，太远会让团队放弃。

### 练习二

Lighthouse CI 的断言规则建议：

```json
{
  "categories:performance": ["error", { "minScore": 0.85 }],
  "largest-contentful-paint": ["warn", { "maxNumericValue": 3000 }],
  "first-contentful-paint": ["warn", { "maxNumericValue": 1800 }],
  "cumulative-layout-shift": ["error", { "maxNumericValue": 0.15 }]
}
```

建议先用 `"warn"` 而不是 `"error"`，让团队适应后再升级为阻断性检查。
