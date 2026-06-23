# 08. A/B 测试与特性开关

> 特性开关设计、灰度发布、A/B 实验平台——用数据驱动产品决策，用开关控制功能发布

## 本课目标

- 理解特性开关（Feature Flag）的类型和设计模式
- 掌握灰度发布的实现方式
- 理解 A/B 测试的统计学基础和工程实现
- 能设计一个简单的特性开关系统
- 能评估 A/B 测试结果的可靠性

## 一个发布事故的教训

周五下午，你把新开发的"推荐算法 v2"部署上线。上线后一小时，数据团队发现推荐模块的点击率从 5% 掉到了 2%，用户停留时长也在下降。

紧急回滚需要重新构建、部署，至少 30 分钟。在这 30 分钟里，你损失了大量用户。

如果有特性开关，你只需要在后台把"推荐算法 v2"的开关关闭，所有用户立刻回到 v1，不需要重新部署，不需要改代码，几秒钟搞定。

这就是特性开关的核心价值：**解耦"代码部署"和"功能发布"**。

## 特性开关的类型

### 1. 发布开关（Release Toggle）

控制功能是否对用户可见。用于功能开发中的渐进式发布。

```javascript
class FeatureFlags {
  constructor(flags = {}) {
    this.flags = flags;
  }

  isEnabled(flagName) {
    return this.flags[flagName] === true;
  }
}

// 使用
const flags = new FeatureFlags({
  'new-checkout-flow': true,
  'dark-mode': false,
  'recommendation-v2': true,
});

function CheckoutPage() {
  if (flags.isEnabled('new-checkout-flow')) {
    return <NewCheckoutPage />;
  }
  return <OldCheckoutPage />;
}
```

### 2. 实验开关（Experiment Toggle）

用于 A/B 测试，将用户随机分组，展示不同版本。

```javascript
class ExperimentManager {
  constructor() {
    this.experiments = new Map();
  }

  // 注册实验
  register(experimentId, variants, weights) {
    this.experiments.set(experimentId, { variants, weights });
  }

  // 获取用户的实验分组
  getVariant(experimentId, userId) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;
    
    // 基于 userId 的哈希确保同一用户始终在同一组
    const hash = this.hash(userId + experimentId);
    const bucket = hash % 100;
    
    let cumulative = 0;
    for (let i = 0; i < experiment.variants.length; i++) {
      cumulative += experiment.weights[i];
      if (bucket < cumulative) {
        return experiment.variants[i];
      }
    }
    
    return experiment.variants[0];
  }

  hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// 使用
const experiments = new ExperimentManager();
experiments.register('checkout-button-color', ['blue', 'green', 'red'], [34, 33, 33]);

function CheckoutButton({ userId }) {
  const variant = experiments.getVariant('checkout-button-color', userId);
  return <button className={`btn-${variant}`}>提交订单</button>;
}
```

### 3. 运维开关（Ops Toggle）

用于系统降级，在故障时快速关闭非核心功能。

```javascript
const opsFlags = {
  // 第三方服务降级
  'enable-payment': true,       // 支付服务故障时关闭
  'enable-recommendation': true, // 推荐服务故障时关闭
  'enable-analytics': true,      // 分析服务故障时关闭
  
  // 功能降级
  'enable-real-time-chat': true,  // 高负载时关闭
  'enable-search-suggestion': true, // 搜索服务故障时关闭
};

function handleServiceDegradation(serviceName) {
  const flagMap = {
    payment: 'enable-payment',
    recommendation: 'enable-recommendation',
    analytics: 'enable-analytics',
  };
  
  const flag = flagMap[serviceName];
  if (flag) {
    opsFlags[flag] = false;
    console.log(`Disabled ${serviceName} via feature flag`);
  }
}
```

### 4. 权限开关（Permission Toggle）

控制特定用户或用户组的功能访问。

```javascript
class PermissionToggle {
  constructor() {
    this.rules = new Map();
  }

  // 基于用户 ID
  enableForUser(flagName, userId) {
    const rule = this.rules.get(flagName) || { type: 'user', users: new Set() };
    rule.users.add(userId);
    this.rules.set(flagName, rule);
  }

  // 基于用户组
  enableForGroup(flagName, groupId) {
    const rule = this.rules.get(flagName) || { type: 'group', groups: new Set() };
    rule.groups.add(groupId);
    this.rules.set(flagName, rule);
  }

  // 基于百分比
  enableForPercentage(flagName, percentage) {
    this.rules.set(flagName, { type: 'percentage', percentage });
  }

  isEnabled(flagName, user) {
    const rule = this.rules.get(flagName);
    if (!rule) return false;
    
    switch (rule.type) {
      case 'user':
        return rule.users.has(user.id);
      case 'group':
        return user.groups.some(g => rule.groups.has(g));
      case 'percentage':
        return this.hash(user.id + flagName) % 100 < rule.percentage;
      default:
        return false;
    }
  }

  hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
```

## 灰度发布

灰度发布是特性开关最常见的应用场景——逐步将新功能推向用户。

### 灰度策略

```
阶段 1：内部测试（1%）
  → 只有开发团队和 QA 能看到新功能
  → 验证功能是否正常工作

阶段 2：小流量（5%）
  → 随机 5% 的用户看到新功能
  → 观察错误率、性能指标

阶段 3：大流量（20%）
  → 扩大到 20% 用户
  → 观察业务指标（转化率、留存率）

阶段 4：全量（100%）
  → 所有用户看到新功能
  → 移除特性开关代码
```

```javascript
class GradualRollout {
  constructor() {
    this.stages = new Map();
  }

  setStage(flagName, percentage, criteria = {}) {
    this.stages.set(flagName, {
      percentage,
      includeUsers: criteria.includeUsers || [],
      excludeUsers: criteria.excludeUsers || [],
      includeGroups: criteria.includeGroups || [],
    });
  }

  isEnabled(flagName, user) {
    const stage = this.stages.get(flagName);
    if (!stage) return false;
    
    // 白名单用户直接通过
    if (stage.includeUsers.includes(user.id)) return true;
    
    // 黑名单用户直接拒绝
    if (stage.excludeUsers.includes(user.id)) return false;
    
    // 白名单用户组
    if (stage.includeGroups.some(g => user.groups.includes(g))) return true;
    
    // 基于百分比的灰度
    const hash = this.hash(user.id + flagName);
    return (hash % 100) < stage.percentage;
  }

  hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
```

## A/B 测试

A/B 测试是一种统计实验方法，通过对比两个或多个版本的效果来做出数据驱动的决策。

### 统计学基础

```
核心概念：

1. 原假设（H₀）：新版本和旧版本没有区别
2. 备择假设（H₁）：新版本比旧版本更好（或更差）
3. 显著性水平（α）：通常设为 0.05（5%），表示接受假阳性的概率
4. 统计功效（1-β）：通常设为 0.8（80%），表示检测到真实差异的概率
5. 最小可检测效应（MDE）：你关心的最小改进幅度

样本量计算：
  要检测 5% 的转化率提升（从 10% 到 10.5%），
  在 α=0.05、β=0.2 的条件下，
  每组需要约 30,000 个用户。
```

### 样本量计算

```javascript
// 简化的样本量计算
function calculateSampleSize(baselineRate, mde, alpha = 0.05, beta = 0.2) {
  // baselineRate: 基线转化率（如 0.1 表示 10%）
  // mde: 最小可检测效应（如 0.05 表示 5% 的相对提升）
  
  const p1 = baselineRate;
  const p2 = baselineRate * (1 + mde);
  const avgP = (p1 + p2) / 2;
  
  // Z 值查表
  const zAlpha = 1.96; // α = 0.05
  const zBeta = 0.84;  // β = 0.2
  
  const numerator = Math.pow(
    zAlpha * Math.sqrt(2 * avgP * (1 - avgP)) +
    zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)),
    2
  );
  
  const denominator = Math.pow(p2 - p1, 2);
  
  return Math.ceil(numerator / denominator);
}

// 示例：检测 5% 的转化率提升
const sampleSize = calculateSampleSize(0.10, 0.05);
console.log(`每组需要 ${sampleSize} 个用户`);
// 输出：每组需要约 30,000 个用户
```

### A/B 测试的工程实现

```javascript
class ABTestPlatform {
  constructor(options = {}) {
    this.experiments = new Map();
    this.userId = options.userId;
    this.reporter = options.reporter;
  }

  // 创建实验
  createExperiment(config) {
    this.experiments.set(config.id, {
      id: config.id,
      variants: config.variants,
      weights: config.weights || config.variants.map(() => 1 / config.variants.length),
      metric: config.metric,
      status: 'running',
      startTime: Date.now(),
    });
  }

  // 获取用户的实验分组
  getVariant(experimentId) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return null;
    }
    
    // 基于用户 ID 的确定性哈希
    const hash = this.hash(this.userId + experimentId);
    const bucket = hash % 100;
    
    let cumulative = 0;
    for (let i = 0; i < experiment.variants.length; i++) {
      cumulative += experiment.weights[i] * 100;
      if (bucket < cumulative) {
        return experiment.variants[i];
      }
    }
    
    return experiment.variants[0];
  }

  // 追踪实验指标
  trackMetric(experimentId, metricName, value) {
    const variant = this.getVariant(experimentId);
    if (!variant) return;
    
    this.reporter.send({
      type: 'experiment_metric',
      experimentId,
      variant,
      metricName,
      value,
      userId: this.userId,
      timestamp: Date.now(),
    });
  }

  hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// 使用
const abTest = new ABTestPlatform({
  userId: getCurrentUserId(),
  reporter: analyticsReporter,
});

abTest.createExperiment({
  id: 'checkout-button-color',
  variants: ['blue', 'green'],
  weights: [0.5, 0.5],
  metric: 'conversion_rate',
});

// 在组件中使用
function CheckoutButton() {
  const variant = abTest.getVariant('checkout-button-color');
  
  const handleClick = () => {
    abTest.trackMetric('checkout-button-color', 'click', 1);
    handleCheckout();
  };
  
  return (
    <button 
      className={`btn-${variant}`}
      onClick={handleClick}
    >
      提交订单
    </button>
  );
}
```

### 实验结果分析

```javascript
class ExperimentAnalyzer {
  // 计算转化率
  calculateConversionRate(experimentId, variant) {
    const data = this.getVariantData(experimentId, variant);
    const conversions = data.filter(d => d.converted).length;
    return conversions / data.length;
  }

  // 计算统计显著性（卡方检验）
  calculateSignificance(controlData, treatmentData) {
    const controlTotal = controlData.length;
    const controlConversions = controlData.filter(d => d.converted).length;
    const treatmentTotal = treatmentData.length;
    const treatmentConversions = treatmentData.filter(d => d.converted).length;
    
    const controlRate = controlConversions / controlTotal;
    const treatmentRate = treatmentConversions / treatmentTotal;
    
    // 卡方检验
    const overallRate = (controlConversions + treatmentConversions) / 
                        (controlTotal + treatmentTotal);
    
    const expectedControl = controlTotal * overallRate;
    const expectedTreatment = treatmentTotal * overallRate;
    
    const chiSquare = 
      Math.pow(controlConversions - expectedControl, 2) / expectedControl +
      Math.pow((controlTotal - controlConversions) - (controlTotal - expectedControl), 2) / (controlTotal - expectedControl) +
      Math.pow(treatmentConversions - expectedTreatment, 2) / expectedTreatment +
      Math.pow((treatmentTotal - treatmentConversions) - (treatmentTotal - expectedTreatment), 2) / (treatmentTotal - expectedTreatment);
    
    // p 值（简化计算）
    const pValue = 1 - this.chiSquareCDF(chiSquare, 1);
    
    return {
      controlRate,
      treatmentRate,
      relativeChange: (treatmentRate - controlRate) / controlRate,
      pValue,
      isSignificant: pValue < 0.05,
      sampleSize: {
        control: controlTotal,
        treatment: treatmentTotal,
      },
    };
  }

  chiSquareCDF(x, df) {
    // 简化的卡方分布 CDF
    // 实际应用中应使用统计库
    const k = df / 2;
    return 1 - Math.exp(-x / 2) * Math.pow(x / 2, k - 1) / this.gamma(k);
  }

  gamma(n) {
    if (n === 1) return 1;
    if (n === 0.5) return Math.sqrt(Math.PI);
    return (n - 1) * this.gamma(n - 1);
  }
}
```

## 特性开关的生命周期

```
创建 → 开发中测试 → 灰度发布 → 全量发布 → 清理

每个阶段都有对应的开关状态：
  dev-only: 只在开发环境生效
  canary: 小流量灰度
  ramp-up: 逐步扩大
  fully-on: 全量
  cleanup: 移除开关代码
```

### 开关清理

特性开关不应该永远存在。长期存在的开关会增加代码复杂度。

```javascript
// 不好的做法：开关代码和业务逻辑混在一起
function renderPage() {
  if (flags.isEnabled('feature-a')) {
    // 新逻辑
  } else {
    // 旧逻辑
  }
  // 更多代码...
  if (flags.isEnabled('feature-b')) {
    // 新逻辑
  } else {
    // 旧逻辑
  }
}

// 好的做法：用策略模式封装
const pageStrategies = {
  'feature-a': {
    on: () => renderNewVersion(),
    off: () => renderOldVersion(),
  },
};

function renderPage() {
  const strategy = pageStrategies['feature-a'];
  const renderer = flags.isEnabled('feature-a') ? strategy.on : strategy.off;
  return renderer();
}
```

清理流程：

```javascript
// 在代码库中搜索需要清理的开关
// 1. 找到所有已全量开启的开关
const fullyOnFlags = flags.filter(f => f.status === 'fully-on' && f.age > 30);

// 2. 移除 if-else 分支，只保留 on 分支
// 3. 移除开关注册代码
// 4. 更新文档
```

## 常见误区

### 误区一：特性开关不需要后端

**错误理解**：特性开关是前端的事，用 localStorage 存储就行

**正确理解**：本地存储的开关无法集中管理、无法灰度控制、无法远程关闭。生产环境的特性开关必须有后端支持，前端只是消费端。

### 误区二：A/B 测试的样本量够了就可以结束

**错误理解**：跑了一周，每组 1000 人，结果显著了，结束实验

**正确理解**：需要检查：是否达到了预设的样本量？是否跑满了完整的业务周期（至少一周，覆盖工作日和周末）？有没有多重比较问题（同时测了多个指标）？

### 误区三：特性开关可以替代版本控制

**错误理解**：用特性开关管理所有功能，不需要 Git 分支了

**正确理解**：特性开关解决的是"部署和发布解耦"的问题，不是代码管理问题。长期的功能开发仍然应该用分支。开关适合短期的渐进式发布，不适合长期的功能分支管理。

## 本课小结

1. **开关类型**：发布开关、实验开关、运维开关、权限开关
2. **灰度发布**：分阶段逐步推向用户，降低发布风险
3. **A/B 测试**：基于统计学的实验方法，用数据驱动决策
4. **样本量**：需要足够的样本量才能得出可靠结论
5. **开关生命周期**：创建→灰度→全量→清理，不要让开关永存

## 练习

### 练习一：设计特性开关系统

为你的项目设计一个特性开关系统，要求：
- 支持开关的开启/关闭
- 支持基于百分比的灰度
- 支持基于用户 ID 的白名单
- 开关配置可以动态更新

### 练习二：A/B 测试方案设计

你要测试一个新的注册流程是否比旧流程更好。设计一个完整的 A/B 测试方案：
- 实验假设是什么？
- 需要哪些实验分组？
- 主要指标和次要指标分别是什么？
- 需要多少样本量？
- 跑多长时间？

## 参考答案

### 练习一

```javascript
class FeatureFlagService {
  constructor(options = {}) {
    this.flags = new Map();
    this.endpoint = options.endpoint;
    this.userId = options.userId;
    this.refreshInterval = options.refreshInterval || 60000;
    
    // 定期从后端拉取最新配置
    this.refresh();
    setInterval(() => this.refresh(), this.refreshInterval);
  }

  async refresh() {
    try {
      const response = await fetch(this.endpoint);
      const flags = await response.json();
      flags.forEach(flag => this.flags.set(flag.name, flag));
    } catch (error) {
      console.warn('Failed to refresh feature flags:', error);
    }
  }

  isEnabled(flagName) {
    const flag = this.flags.get(flagName);
    if (!flag) return false;
    
    switch (flag.strategy) {
      case 'boolean':
        return flag.enabled;
        
      case 'percentage':
        return this.hash(this.userId + flagName) % 100 < flag.percentage;
        
      case 'whitelist':
        return flag.users?.includes(this.userId);
        
      case 'multi':
        // 白名单优先
        if (flag.users?.includes(this.userId)) return true;
        // 再看百分比
        return flag.enabled && 
               this.hash(this.userId + flagName) % 100 < flag.percentage;
        
      default:
        return flag.enabled;
    }
  }

  hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// 使用
const flags = new FeatureFlagService({
  endpoint: '/api/feature-flags',
  userId: getCurrentUserId(),
});

if (flags.isEnabled('new-checkout')) {
  renderNewCheckout();
} else {
  renderOldCheckout();
}
```

### 练习二

```
实验假设：
  新注册流程（减少一步验证）能提升注册完成率

实验分组：
  - 对照组（50%）：当前注册流程（3 步）
  - 实验组（50%）：新注册流程（2 步）

主要指标：
  - 注册完成率（从开始注册到注册成功）

次要指标：
  - 注册完成时长
  - 后续 7 天留存率
  - 注册后首日活跃度

样本量计算：
  基线转化率：40%
  最小可检测效应：5%（相对提升，即从 40% 提升到 42%）
  α = 0.05, β = 0.2
  
  每组需要约 15,000 个用户

实验时长：
  假设每天有 3,000 个新注册用户
  需要 15,000 × 2 / 3,000 = 10 天
  
  建议跑 14 天（2 周），覆盖完整的业务周期

注意事项：
  - 确保随机分配的均匀性（设备、地区、渠道）
  - 不要在实验期间同时进行其他可能影响注册率的变更
  - 监控实验组的错误率，如果有异常立即停止
  - 实验结束后至少观察 7 天的后续指标（留存率）
```

## 下一步

完成本课后，继续学习 [09. 监控平台选型与自建方案](./09-monitoring-platform-selection.md)。
