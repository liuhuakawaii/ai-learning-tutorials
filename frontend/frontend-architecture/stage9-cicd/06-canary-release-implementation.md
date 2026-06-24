# 06. 灰度发布实现

> 灰度发布不是"把新功能推给所有用户"，而是"用最小风险验证新功能"

## 本课目标

- 理解灰度发布的原理和价值
- 掌握流量控制的实现方式
- 学会 A/B 测试和特性开关的使用
- 实现完整的灰度发布系统

## 从一个真实场景说起

假设你在维护一个日活百万的 App，遇到了这些问题：

1. **新功能风险高**：新功能上线后才发现严重 Bug
2. **用户反馈滞后**：等到用户投诉才发现问题
3. **回滚代价大**：全量回滚影响所有用户
4. **验证不充分**：测试环境无法模拟真实用户

灰度发布就是解决这些问题的方案。

## 灰度发布原理

### 核心思想

灰度发布是将新版本逐步推送给少量用户，观察没有问题后再扩大范围。

### 发布阶段

```
阶段 1: 1% 用户
    ↓ 验证通过
阶段 2: 10% 用户
    ↓ 验证通过
阶段 3: 50% 用户
    ↓ 验证通过
阶段 4: 100% 用户
```

### 关键指标

- **错误率**：新版本的错误率是否高于旧版本
- **性能**：新版本的性能是否达标
- **业务指标**：新版本是否影响转化率、留存率等

## 流量控制

### Nginx 流量分割

```nginx
# /etc/nginx/nginx.conf
http {
    upstream stable {
        server server-stable:3000;
    }

    upstream canary {
        server server-canary:3000;
    }

    # 基于 IP 的流量分割
    split_clients "${remote_addr}" $variant {
        10%    canary;
        *      stable;
    }

    server {
        listen 80;
        
        location / {
            proxy_pass http://$variant;
        }
    }
}
```

### 基于 Cookie 的流量分割

```nginx
# /etc/nginx/nginx.conf
http {
    map $cookie_canary $backend {
        default stable;
        "true"  canary;
    }

    server {
        listen 80;
        
        location / {
            proxy_pass http://$backend;
        }
    }
}
```

### 流量分割 API

```javascript
// traffic-splitter.js
const express = require('express');
const Redis = require('ioredis');
const app = express();
const redis = new Redis();

// 获取流量配置
app.get('/api/traffic-config', async (req, res) => {
  const config = await redis.get('traffic-config');
  res.json(config ? JSON.parse(config) : { canary: 0, stable: 100 });
});

// 更新流量配置
app.post('/api/traffic-config', async (req, res) => {
  const { canary, stable } = req.body;
  
  // 更新 Redis
  await redis.set('traffic-config', JSON.stringify({ canary, stable }));
  
  // 生成 Nginx 配置
  const nginxConfig = `
    split_clients "${'{remote_addr}'}" $variant {
      ${canary}%    canary;
      *      stable;
    }
  `;
  
  // 写入配置文件
  require('fs').writeFileSync('/etc/nginx/conf.d/split.conf', nginxConfig);
  
  // 重载 Nginx
  require('child_process').exec('nginx -s reload');
  
  res.json({ success: true, canary, stable });
});

// 检查用户是否在金丝雀组
app.get('/api/check-canary', (req, res) => {
  const userId = req.query.userId;
  
  // 使用用户 ID 进行一致性哈希
  const hash = userId.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  
  const config = JSON.parse(redis.get('traffic-config') || '{"canary": 0}');
  const isCanary = (hash % 100) < config.canary;
  
  res.json({ isCanary, userId });
});

app.listen(3001);
```

## A/B 测试

### 基础实现

```javascript
// ab-test.js
class ABTest {
  constructor() {
    this.experiments = new Map();
  }

  // 创建实验
  createExperiment(name, config) {
    this.experiments.set(name, {
      name,
      variants: config.variants,
      traffic: config.traffic,
      startDate: new Date(),
      endDate: config.endDate
    });
  }

  // 获取用户变体
  getVariant(userId, experimentName) {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) return null;

    // 检查实验是否在有效期内
    const now = new Date();
    if (now < experiment.startDate || now > experiment.endDate) {
      return null;
    }

    // 使用用户 ID 进行一致性哈希
    const hash = userId.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);

    // 根据流量比例分配变体
    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.traffic;
      if ((hash % 100) < cumulative) {
        return variant.name;
      }
    }

    return experiment.variants[experiment.variants.length - 1].name;
  }

  // 记录用户行为
  track(userId, experimentName, event, data) {
    // 这里可以发送到分析服务
    console.log('Track:', { userId, experimentName, event, data });
  }
}

module.exports = new ABTest();
```

### React 集成

```jsx
// ABTestProvider.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import abTest from './ab-test';

const ABTestContext = createContext();

export function ABTestProvider({ children }) {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // 生成或获取用户 ID
    let id = localStorage.getItem('ab-test-user-id');
    if (!id) {
      id = Math.random().toString(36).substr(2, 9);
      localStorage.setItem('ab-test-user-id', id);
    }
    setUserId(id);
  }, []);

  return (
    <ABTestContext.Provider value={{ userId }}>
      {children}
    </ABTestContext.Provider>
  );
}

export function useABTest(experimentName) {
  const { userId } = useContext(ABTestContext);
  const [variant, setVariant] = useState(null);

  useEffect(() => {
    if (userId) {
      const v = abTest.getVariant(userId, experimentName);
      setVariant(v);
    }
  }, [userId, experimentName]);

  return variant;
}

// 使用示例
function MyComponent() {
  const variant = useABTest('button-color-test');

  return (
    <button style={{ backgroundColor: variant === 'blue' ? 'blue' : 'red' }}>
      点击我
    </button>
  );
}
```

## 特性开关

### 基础实现

```javascript
// feature-flags.js
class FeatureFlags {
  constructor() {
    this.flags = new Map();
  }

  // 加载特性开关
  load(config) {
    this.flags = new Map(Object.entries(config));
  }

  // 检查特性是否开启
  isEnabled(flagName, userId = null) {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    // 如果是简单布尔值
    if (typeof flag === 'boolean') {
      return flag;
    }

    // 如果是配置对象
    if (flag.enabled === false) {
      return false;
    }

    // 检查用户白名单
    if (flag.whitelist && userId) {
      return flag.whitelist.includes(userId);
    }

    // 检查用户百分比
    if (flag.percentage && userId) {
      const hash = userId.split('').reduce((acc, char) => {
        return acc + char.charCodeAt(0);
      }, 0);
      return (hash % 100) < flag.percentage;
    }

    return flag.enabled !== false;
  }

  // 获取特性值
  getValue(flagName, defaultValue = null) {
    const flag = this.flags.get(flagName);
    if (!flag) return defaultValue;

    if (typeof flag === 'object' && flag.value !== undefined) {
      return flag.value;
    }

    return flag ? flag : defaultValue;
  }
}

module.exports = new FeatureFlags();
```

### React 集成

```jsx
// FeatureFlagProvider.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import featureFlags from './feature-flags';

const FeatureFlagContext = createContext();

export function FeatureFlagProvider({ children }) {
  const [flags, setFlags] = useState({});

  useEffect(() => {
    // 从服务器加载特性开关
    fetch('/api/feature-flags')
      .then(res => res.json())
      .then(data => {
        featureFlags.load(data);
        setFlags(data);
      });
  }, []);

  return (
    <FeatureFlagContext.Provider value={flags}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlag(flagName) {
  const flags = useContext(FeatureFlagContext);
  return featureFlags.isEnabled(flagName);
}

export function useFeatureValue(flagName, defaultValue) {
  const flags = useContext(FeatureFlagContext);
  return featureFlags.getValue(flagName, defaultValue);
}

// 使用示例
function MyComponent() {
  const showNewFeature = useFeatureFlag('new-feature');
  const buttonText = useFeatureValue('button-text', '点击');

  return (
    <div>
      {showNewFeature && <NewFeature />}
      <button>{buttonText}</button>
    </div>
  );
}
```

### 特性开关管理界面

```jsx
// FeatureFlagManager.jsx
import React, { useState, useEffect } from 'react';

function FeatureFlagManager() {
  const [flags, setFlags] = useState([]);
  const [editingFlag, setEditingFlag] = useState(null);

  useEffect(() => {
    fetch('/api/feature-flags')
      .then(res => res.json())
      .then(data => setFlags(Object.entries(data)));
  }, []);

  const handleToggle = async (flagName) => {
    const flag = flags.find(([name]) => name === flagName);
    if (!flag) return;

    const [name, config] = flag;
    const newConfig = {
      ...config,
      enabled: !config.enabled
    };

    await fetch(`/api/feature-flags/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });

    setFlags(flags.map(([n, c]) => 
      n === name ? [n, newConfig] : [n, c]
    ));
  };

  const handleSave = async () => {
    if (!editingFlag) return;

    const [name, config] = editingFlag;

    await fetch(`/api/feature-flags/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    setFlags(flags.map(([n, c]) => 
      n === name ? [n, config] : [n, c]
    ));
    setEditingFlag(null);
  };

  return (
    <div>
      <h2>Feature Flags</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Enabled</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {flags.map(([name, config]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={() => handleToggle(name)}
                />
              </td>
              <td>{config.description}</td>
              <td>
                <button onClick={() => setEditingFlag([name, config])}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingFlag && (
        <div className="modal">
          <h3>Edit {editingFlag[0]}</h3>
          <textarea
            value={JSON.stringify(editingFlag[1], null, 2)}
            onChange={(e) => {
              try {
                const config = JSON.parse(e.target.value);
                setEditingFlag([editingFlag[0], config]);
              } catch (err) {
                // Ignore parse errors
              }
            }}
          />
          <button onClick={handleSave}>Save</button>
          <button onClick={() => setEditingFlag(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default FeatureFlagManager;
```

## 灰度发布系统

### 发布流程

```yaml
# 灰度发布工作流
name: Canary Release

on:
  workflow_dispatch:
    inputs:
      step:
        description: 'Release step'
        required: true
        type: choice
        options:
          - 1%
          - 10%
          - 50%
          - 100%
          - rollback

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy Canary
        run: |
          # 部署金丝雀版本
          npm run build
          rsync -avz dist/ user@server-canary:/var/www/app/
      
      - name: Configure Traffic
        run: |
          STEP=${{ github.event.inputs.step }}
          
          case $STEP in
            "1%")
              TRAFFIC=1
              ;;
            "10%")
              TRAFFIC=10
              ;;
            "50%")
              TRAFFIC=50
              ;;
            "100%")
              TRAFFIC=100
              ;;
            "rollback")
              TRAFFIC=0
              ;;
          esac
          
          curl -X POST http://server-loadbalancer/api/traffic \
            -d "{\"canary\": $TRAFFIC, \"stable\": $((100 - TRAFFIC))}"
      
      - name: Monitor
        if: github.event.inputs.step != 'rollback'
        run: |
          # 监控 5 分钟
          for i in {1..10}; do
            ERROR_RATE=$(curl -s http://metrics-server/api/error-rate)
            echo "Error rate: $ERROR_RATE (check $i/10)"
            
            if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
              echo "Error rate too high, rolling back..."
              curl -X POST http://server-loadbalancer/api/traffic \
                -d '{"canary": 0, "stable": 100}'
              exit 1
            fi
            
            sleep 30
          done
```

### 监控集成

```javascript
// metrics.js
class MetricsCollector {
  constructor() {
    this.metrics = {
      errorRate: 0,
      responseTime: 0,
      throughput: 0
    };
  }

  // 收集指标
  collect(req, res, next) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const isError = res.statusCode >= 400;

      // 更新指标
      this.metrics.responseTime = 
        (this.metrics.responseTime + duration) / 2;
      
      if (isError) {
        this.metrics.errorRate = 
          (this.metrics.errorRate * 0.95) + (1 * 0.05);
      } else {
        this.metrics.errorRate = 
          (this.metrics.errorRate * 0.95) + (0 * 0.05);
      }

      // 发送到监控服务
      this.sendMetrics({
        timestamp: new Date(),
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        duration,
        isError
      });
    });

    next();
  }

  // 发送指标
  async sendMetrics(data) {
    try {
      await fetch('http://metrics-server/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (err) {
      console.error('Failed to send metrics:', err);
    }
  }

  // 获取当前指标
  getMetrics() {
    return this.metrics;
  }
}

module.exports = new MetricsCollector();
```

### 自动回滚

```javascript
// auto-rollback.js
class AutoRollback {
  constructor(config) {
    this.config = {
      errorThreshold: 0.01,
      responseTimeThreshold: 1000,
      checkInterval: 30000,
      ...config
    };
    
    this.isMonitoring = false;
  }

  // 开始监控
  startMonitoring() {
    this.isMonitoring = true;
    this.monitor();
  }

  // 停止监控
  stopMonitoring() {
    this.isMonitoring = false;
  }

  // 监控循环
  async monitor() {
    if (!this.isMonitoring) return;

    try {
      const metrics = await this.getMetrics();
      
      // 检查错误率
      if (metrics.errorRate > this.config.errorThreshold) {
        console.error('Error rate exceeded threshold:', metrics.errorRate);
        await this.rollback();
        return;
      }

      // 检查响应时间
      if (metrics.responseTime > this.config.responseTimeThreshold) {
        console.error('Response time exceeded threshold:', metrics.responseTime);
        await this.rollback();
        return;
      }

      // 继续监控
      setTimeout(() => this.monitor(), this.config.checkInterval);
    } catch (err) {
      console.error('Monitoring error:', err);
      setTimeout(() => this.monitor(), this.config.checkInterval);
    }
  }

  // 获取指标
  async getMetrics() {
    const response = await fetch('http://metrics-server/api/current-metrics');
    return response.json();
  }

  // 回滚
  async rollback() {
    console.log('Initiating rollback...');
    
    // 停止监控
    this.stopMonitoring();
    
    // 切换流量到稳定版本
    await fetch('http://server-loadbalancer/api/traffic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canary: 0, stable: 100 })
    });
    
    // 发送通知
    await this.sendNotification('Rollback triggered due to high error rate');
    
    console.log('Rollback completed');
  }

  // 发送通知
  async sendNotification(message) {
    // 发送到 Slack、邮件等
    console.log('Notification:', message);
  }
}

module.exports = AutoRollback;
```

## 灰度发布最佳实践

### 1. 设置合理的阈值

```javascript
const config = {
  // 错误率阈值
  errorThreshold: 0.01,  // 1%
  
  // 响应时间阈值
  responseTimeThreshold: 1000,  // 1 秒
  
  // CPU 使用率阈值
  cpuThreshold: 80,  // 80%
  
  // 内存使用率阈值
  memoryThreshold: 80,  // 80%
};
```

### 2. 逐步增加流量

```javascript
const steps = [
  { traffic: 1, duration: 300 },   // 1% 持续 5 分钟
  { traffic: 10, duration: 600 },  // 10% 持续 10 分钟
  { traffic: 50, duration: 600 },  // 50% 持续 10 分钟
  { traffic: 100, duration: 0 }    // 100% 完成
];
```

### 3. 监控关键指标

```javascript
const metrics = [
  'errorRate',
  'responseTime',
  'throughput',
  'cpuUsage',
  'memoryUsage',
  'businessMetrics'
];
```

### 4. 准备回滚方案

```javascript
const rollbackPlan = {
  // 自动回滚条件
  autoRollbackConditions: {
    errorRate: 0.01,
    responseTime: 1000
  },
  
  // 手动回滚按钮
  manualRollback: true,
  
  // 回滚通知
  notifications: ['slack', 'email']
};
```

## 本课小结

本课我们学习了灰度发布实现：

1. **流量控制**：Nginx 流量分割、流量 API
2. **A/B 测试**：实验创建、变体分配、行为追踪
3. **特性开关**：开关管理、React 集成、管理界面
4. **灰度发布系统**：发布流程、监控集成、自动回滚
5. **最佳实践**：阈值设置、逐步发布、监控指标、回滚方案

## 练习

### 练习一：实现 A/B 测试

为你的项目实现 A/B 测试功能：
- 实验管理
- 变体分配
- 结果追踪

### 练习二：实现特性开关

为你的项目实现特性开关系统：
- 开关配置
- React 集成
- 管理界面

## 参考答案

### 练习一

```javascript
// ab-test-manager.js
class ABTestManager {
  constructor() {
    this.experiments = new Map();
  }

  createExperiment(config) {
    const { name, variants, traffic } = config;
    
    this.experiments.set(name, {
      name,
      variants,
      traffic,
      startDate: new Date(),
      results: {}
    });
  }

  getVariant(userId, experimentName) {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) return null;

    const hash = this.hashString(userId + experimentName);
    let cumulative = 0;

    for (const variant of experiment.variants) {
      cumulative += variant.traffic;
      if ((hash % 100) < cumulative) {
        return variant.name;
      }
    }

    return experiment.variants[experiment.variants.length - 1].name;
  }

  track(userId, experimentName, event, data) {
    const variant = this.getVariant(userId, experimentName);
    if (!variant) return;

    const key = `${experimentName}:${variant}:${event}`;
    
    if (!this.experiments.get(experimentName).results[key]) {
      this.experiments.get(experimentName).results[key] = 0;
    }
    
    this.experiments.get(experimentName).results[key]++;
  }

  getResults(experimentName) {
    return this.experiments.get(experimentName)?.results || {};
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

module.exports = new ABTestManager();
```

### 练习二

```javascript
// feature-flag-manager.js
class FeatureFlagManager {
  constructor() {
    this.flags = new Map();
  }

  async loadFlags() {
    const response = await fetch('/api/feature-flags');
    const flags = await response.json();
    this.flags = new Map(Object.entries(flags));
  }

  isEnabled(flagName, context = {}) {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    // 检查是否全局禁用
    if (flag.enabled === false) return false;

    // 检查用户白名单
    if (flag.whitelist?.includes(context.userId)) {
      return true;
    }

    // 检查用户百分比
    if (flag.percentage && context.userId) {
      const hash = this.hashString(context.userId + flagName);
      return (hash % 100) < flag.percentage;
    }

    return flag.enabled !== false;
  }

  getValue(flagName, defaultValue = null) {
    const flag = this.flags.get(flagName);
    if (!flag) return defaultValue;

    if (typeof flag === 'object' && flag.value !== undefined) {
      return flag.value;
    }

    return flag ? flag : defaultValue;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

module.exports = new FeatureFlagManager();
```

## 下一步

完成本课后，继续学习 [07. 发布流程规范](./07-release-process-specification.md)。