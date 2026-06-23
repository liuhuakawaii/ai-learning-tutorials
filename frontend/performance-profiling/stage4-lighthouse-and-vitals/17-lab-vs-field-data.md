# Lab 数据 vs Field 数据

> Lighthouse 跑出 90 分，用户投诉还是很慢。不是 Lighthouse 在骗你——Lab 数据和 Field 数据本来就不一样。

## 两种数据的本质区别

**Lab Data（实验室数据）**：在受控环境下用工具模拟测试得到的数据。Lighthouse、WebPageTest 都属于 Lab 数据。

- 固定的设备条件（CPU、内存）
- 固定的网络条件（3G、4G、WiFi）
- 固定的地理位置
- 不代表任何特定用户

**Field Data（现场数据）**：从真实用户实际访问中采集的数据。Chrome UX Report（CrUX）、Sentry Performance、Datadog RUM 都属于 Field 数据。

- 真实的设备差异（旗舰机 vs 低端机）
- 真实的网络环境（WiFi vs 弱 4G）
- 真实的地理位置分布
- 真实的用户行为

## 为什么分数和用户体感不一致

**原因一：设备差异**

Lighthouse 默认用 4x CPU throttling 模拟中端设备。如果你的用户主要用高端设备，Lighthouse 的测试结果比实际更差。如果你的用户主要用低端设备（比如新兴市场），Lighthouse 的测试结果比实际更好。

**原因二：网络差异**

Lighthouse 的网络模拟不能反映真实的网络波动。用户可能在 WiFi 和 4G 之间切换，可能遇到网络拥塞，可能在偏远地区信号差。

**原因三：地理位置**

Lighthouse 从你本地运行，到服务器的延迟取决于你的位置。用户在全国各地甚至全球各地，到服务器的延迟差异很大。这就是 CDN 的意义。

**原因四：缓存状态**

Lighthouse 默认测试无缓存状态（首次访问）。大多数用户是回访用户，他们的体验受缓存影响很大。

**原因五：用户行为**

Lighthouse 只测页面加载。用户实际使用中的交互、滚动、路由切换——这些才是主要使用场景，Lighthouse 没有覆盖。

## Chrome UX Report（CrUX）

CrUX 是 Google 从 Chrome 用户那里采集的真实性能数据。它是 Field Data 的权威来源。

查询方式：

```tsx
// 通过 CrUX API 查询
const response = await fetch(
  'https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=API_KEY',
  {
    method: 'POST',
    body: JSON.stringify({
      origin: 'https://example.com',
      metrics: ['largest_contentful_paint', 'cumulative_layout_shift', 'first_contentful_paint'],
    }),
  }
)
```

CrUX 数据按百分位展示：p75 LCP 是 2.1s 意味着 75% 的用户的 LCP 都在 2.1s 以内。

CrUX 的数据至少有 28 天的延迟——它不是实时的。对于新网站或流量小的网站，可能没有足够的数据。

## Lab 数据的价值

Lab 数据不是没用，而是用途不同：

**Lab 数据适合**：
- 回归测试：每次部署前跑一次，确保性能没有退化
- 对比分析：A/B 两种实现方案的性能差异
- 问题定位：用 DevTools 的详细信息找到具体的问题代码
- 性能预算：设定阈值并在 CI/CD 里检查

**Field 数据适合**：
- 衡量用户体验：真实用户到底体验如何
- 趋势分析：性能是在改善还是恶化
- 地域分析：哪些地区的用户体验差
- 设备分析：哪些设备类型需要关注

## 如何同时使用两种数据

一个完整的性能监控体系应该同时包含两种数据：

```
开发阶段：Lab Data（Lighthouse + CI/CD）
  → 发现问题、防止退化

生产环境：Field Data（CrUX + RUM）
  → 衡量真实体验、发现地域/设备问题

反馈循环：Field 数据发现问题 → Lab 数据复现和定位 → 优化 → Field 数据验证改善
```

## 练习

### 练习一：对比 Lab 和 Field 数据

对你自己的项目（或一个有足够流量的网站）：

1. 本地跑一次 Lighthouse，记录 LCP 和 CLS
2. 用 PageSpeed Insights（pagespeed.web.dev）查询同一个 URL，它会同时展示 Lab Data 和 CrUX Field Data
3. 对比两组数据，分析差异的原因

### 练习二：理解数据滞后

用 CrUX API 查询一个你管理的网站（或一个知名网站），对比：

1. CrUX 的 p75 LCP 数值
2. 你本地 Lighthouse 的 LCP 数值
3. 如果有 RUM 数据（如 Sentry），再对比 RUM 的 p75 LCP

记录三组数据的差异，并分析原因。

---

## 参考答案

### 练习一

典型差异：

- Lighthouse Lab Data 的 LCP 通常比 CrUX Field Data 的 p75 LCP 更慢（因为 Lighthouse 用了 CPU throttling）
- 但如果用户的设备和网络条件比 Lighthouse 的模拟环境更差，Field Data 可能更慢
- CLS 在 Lab 和 Field 之间差异通常更大，因为它高度依赖用户的交互行为

PageSpeed Insights 的报告里，上方是 28 天的 Field Data（如果有），下方是单次的 Lab Data。两者的差距直接反映了"工具测试"和"真实体验"的差异。

### 练习二

三组数据差异的常见原因：
- **Lighthouse（Lab）**：受控环境，CPU throttled，固定网络，单次测试
- **CrUX（Field）**：28 天平均，真实设备和网络，反映中位用户体验
- **RUM（Field）**：实时数据，可能有采样偏差

如果 Lighthouse 分数高但 CrUX 分数低，说明你的测试环境比用户的真实环境好。需要关注低端设备和弱网场景。
