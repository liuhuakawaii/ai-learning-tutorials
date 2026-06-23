# 09. 监控平台选型与自建方案

> Sentry/DataDog/自建方案对比、架构设计——为团队选择最合适的监控方案

## 本课目标

- 了解主流前端监控平台的功能、定价和适用场景
- 掌握自建监控系统的核心架构设计
- 能够根据团队规模、预算和需求选择合适的方案
- 理解自建方案的长期维护成本

## 选型的核心问题

选监控平台不是选"最好的"，而是选"最合适的"。在做决策之前，先回答这五个问题：

1. **你监控什么**？只有错误？还是错误 + 性能 + 行为？
2. **你的流量多大**？每天 1 万 PV 还是 1 亿 PV？
3. **你的预算是多少**？免费？每月几百？还是每月几万？
4. **你的团队有多少人**？有专门的 SRE/运维团队吗？
5. **数据合规要求**？数据能否出境？能否存储在第三方？

## 主流方案对比

### Sentry

**定位**：错误监控和性能监控

```
优势：
- 错误监控领域事实标准
- Source Map 还原效果好
- React/Vue 等框架深度集成
- 错误聚合、面包屑、用户上下文完善
- 开源版本可自部署

劣势：
- 行为追踪能力弱
- 不支持自定义指标
- 付费版按事件量计费，高流量成本高
- 数据分析能力有限

定价：
- 开发者版：免费，5,000 事件/月
- 团队版：$26/月，50,000 事件/月
- 商业版：$80/月起，按事件量计费
- 自部署：免费（需要自己运维）
```

典型接入方式：

```javascript
// React 项目接入 Sentry
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'https://xxx@sentry.io/xxx',
  environment: process.env.NODE_ENV,
  release: process.env.GIT_COMMIT_SHA,
  tracesSampleRate: 0.1, // 10% 性能采样
  replaysSessionSampleRate: 0.01, // 1% Session Replay
  replaysOnErrorSampleRate: 1.0, // 错误时 100% 录制
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
});

// 手动捕获错误
try {
  riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { feature: 'checkout' },
    extra: { orderId: '12345' },
  });
}
```

### DataDog

**定位**：全栈可观测性平台

```
优势：
- 覆盖前端、后端、基础设施的全栈监控
- 强大的数据分析和可视化能力
- 支持自定义指标、日志、链路
- 告警和 OnCall 集成完善
- RUM（Real User Monitoring）功能强大

劣势：
- 价格昂贵
- 配置复杂，学习曲线陡峭
- 前端 SDK 体积较大
- 最低消费门槛高

定价：
- RUM：$1.5 / 1,000 会话/月
- APM：$31 / 主机/月
- 日志管理：$0.10 / GB
- 基础设施：$15 / 主机/月
- 最低消费：$23/月起
```

### 阿里云 ARMS / 腾讯云前端监控

**定位**：国内云厂商的前端监控方案

```
优势：
- 国内访问速度快
- 中文文档和支持
- 和云厂商其他产品集成好
- 数据存储在国内，合规

劣势：
- 功能相对 Sentry 较弱
- 定制化能力有限
- 和云厂商绑定

定价：
- 按 PV 或事件量计费
- 通常有免费额度
```

### 自建方案

**定位**：完全自主可控的监控系统

```
优势：
- 数据完全自主可控
- 可以深度定制采集和分析逻辑
- 长期成本可控（不按事件量计费）
- 无供应商锁定

劣势：
- 开发和维护成本高
- 需要专门的基础设施团队
- 功能完善需要较长时间
- 缺少社区支持和最佳实践

适用场景：
- 数据合规要求严格（不能出境、不能存储在第三方）
- 需要深度定制的采集和分析逻辑
- 已有基础设施团队
- 流量极大，SaaS 成本不可接受
```

## 自建监控系统架构

自建监控系统不是"写个 SDK 上报数据"那么简单。一个完整的自建方案需要解决以下工程问题：

1. **数据采集**：SDK 如何在不影响性能的前提下采集数据
2. **数据传输**：如何保证数据在网络不稳定时不丢失
3. **数据接收**：如何处理高并发的上报请求
4. **数据存储**：如何存储海量时序数据和日志数据
5. **数据查询**：如何支持灵活的多维查询
6. **数据可视化**：如何让非技术人员也能看懂数据
7. **告警**：如何在问题发生时及时通知

每个环节都有成熟的技术选型，但把它们组装在一起需要不少工程投入。

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      浏览器端 SDK                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 错误采集  │  │ 性能采集  │  │ 行为采集  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│  ┌──────────────────────────────────────┐              │
│  │         数据处理（采样/聚合/队列）       │              │
│  └──────────────────────────────────────┘              │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP / Beacon
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    数据接收层（Collector）                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 校验     │  │ 采样     │  │ 路由     │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    消息队列（Kafka / Redis Streams）      │
└───────┬─────────────────┬──────────────────┬────────────┘
        │                 │                  │
        ▼                 ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│ 错误日志存储  │ │ 指标存储     │ │ 行为事件存储      │
│ Elasticsearch│ │ ClickHouse   │ │ ClickHouse       │
└──────┬───────┘ └──────┬───────┘ └────────┬─────────┘
       │                │                   │
       └────────────────┼───────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    查询与分析层                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 查询 API │  │ 聚合引擎  │  │ 告警引擎  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    展示层                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Grafana  │  │ 自建前端  │  │ 告警通知  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

### 数据接收层

```javascript
// Node.js 数据接收服务
const express = require('express');
const app = express();

app.post('/api/collect', express.json({ limit: '1mb' }), async (req, res) => {
  const events = req.body.events || [req.body];
  
  // 基本校验
  const validEvents = events.filter(event => {
    return event.type && event.timestamp && event.sessionId;
  });
  
  // 采样
  const sampledEvents = validEvents.filter(event => {
    if (event.type === 'error') return true; // 错误全量
    return Math.random() < 0.1; // 其他 10% 采样
  });
  
  // 写入消息队列
  for (const event of sampledEvents) {
    await kafka.produce({
      topic: `frontend-${event.type}`,
      message: JSON.stringify(event),
    });
  }
  
  res.status(204).end();
});

// Beacon API 兼容
app.post('/api/beacon', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const events = JSON.parse(req.body);
    // 处理逻辑同上
    res.status(204).end();
  } catch {
    res.status(400).end();
  }
});
```

### 数据存储层

```sql
-- ClickHouse：错误事件表
CREATE TABLE frontend_errors (
  timestamp DateTime64(3),
  session_id String,
  user_id String,
  error_type String,
  message String,
  stack String,
  page String,
  browser String,
  os String,
  device_type String,
  app_version String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, error_type)
TTL timestamp + INTERVAL 90 DAY;

-- ClickHouse：性能指标表
CREATE TABLE frontend_metrics (
  timestamp DateTime64(3),
  session_id String,
  page String,
  metric_name String,
  metric_value Float64,
  device_type String,
  connection_type String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, metric_name, page)
TTL timestamp + INTERVAL 30 DAY;

-- ClickHouse：行为事件表
CREATE TABLE frontend_events (
  timestamp DateTime64(3),
  session_id String,
  user_id String,
  event_type String,
  event_name String,
  page String,
  properties String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, event_type, event_name)
TTL timestamp + INTERVAL 90 DAY;
```

### Source Map 还原服务

```javascript
// Source Map 还原服务
const { SourceMapConsumer } = require('source-map');
const Redis = require('ioredis');

class SourceMapResolver {
  constructor() {
    this.redis = new Redis();
    this.storage = new SourceMapStorage(); // S3 或本地存储
  }

  async resolve(error) {
    const { stack, version, filename } = error;
    
    // 尝试从缓存获取 Source Map
    const cacheKey = `sourcemap:${version}:${filename}`;
    let sourceMap = await this.redis.get(cacheKey);
    
    if (!sourceMap) {
      // 从存储中获取
      sourceMap = await this.storage.get(version, filename);
      if (sourceMap) {
        await this.redis.setex(cacheKey, 3600, JSON.stringify(sourceMap));
      }
    } else {
      sourceMap = JSON.parse(sourceMap);
    }
    
    if (!sourceMap) {
      return stack; // 无法还原，返回原始堆栈
    }
    
    const consumer = await new SourceMapConsumer(sourceMap);
    const lines = stack.split('\n');
    
    const resolved = lines.map(line => {
      const match = line.match(/at\s+(?:(.+?)\s+\()?(.+):(\d+):(\d+)\)?/);
      if (!match) return line;
      
      const [, functionName, file, lineNum, colNum] = match;
      const pos = consumer.originalPositionFor({
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
      });
      
      if (pos.source) {
        return `  at ${pos.name || functionName} (${pos.source}:${pos.line}:${pos.column})`;
      }
      return line;
    });
    
    consumer.destroy();
    return resolved.join('\n');
  }
}
```

### 告警引擎

```javascript
class AlertEngine {
  constructor(options = {}) {
    this.rules = options.rules || [];
    this.notifier = options.notifier;
    this.state = new Map(); // 告警状态
  }

  async evaluate(metrics) {
    for (const rule of this.rules) {
      const result = this.evaluateRule(rule, metrics);
      const currentState = this.state.get(rule.name);
      
      if (result.triggered && !currentState?.active) {
        // 新告警
        this.state.set(rule.name, {
          active: true,
          triggeredAt: Date.now(),
          value: result.value,
        });
        
        await this.notifier.send({
          level: rule.severity,
          title: rule.name,
          message: rule.formatMessage(result.value),
          metadata: result.metadata,
        });
      } else if (!result.triggered && currentState?.active) {
        // 告警恢复
        this.state.set(rule.name, { active: false });
        
        await this.notifier.send({
          level: 'info',
          title: `${rule.name} - 已恢复`,
          message: `告警已恢复，持续时间：${Date.now() - currentState.triggeredAt}ms`,
        });
      }
    }
  }

  evaluateRule(rule, metrics) {
    try {
      const value = rule.query(metrics);
      return {
        triggered: rule.condition(value),
        value,
        metadata: rule.metadata?.(metrics),
      };
    } catch {
      return { triggered: false };
    }
  }
}
```

## 选型决策框架

### 成本对比

在做选型之前，先算一笔账。假设你的应用日活 10 万，每天产生约 500 万条监控事件。

```
Sentry 团队版：
  月费：$26/月（50,000 事件/月）
  超出部分：约 $0.0003/事件
  估算月费：$26 + (5,000,000 × 30 - 50,000) × $0.0003 ≈ $45,000/月
  （实际上 Sentry 的定价更复杂，这里简化计算）

DataDog RUM：
  月费：$1.5/1,000 会话
  假设 10 万 DAU，每天 1.5 个会话 = 15 万会话/天
  估算月费：150,000 × 30 / 1,000 × $1.5 = $6,750/月

自建方案：
  服务器成本：ClickHouse 集群 + Kafka + 接收服务 ≈ $500-2,000/月
  人力成本：初始开发 2-3 人月，持续维护 0.5 人月
  隐性成本：故障处理、功能迭代、on-call
```

这个对比说明：小流量用 SaaS，大流量自建更划算。但"划算"只是成本维度，还要考虑团队能力和业务需求。

### 决策矩阵

| 维度 | Sentry | DataDog | 云厂商 | 自建 |
|------|--------|---------|--------|------|
| 错误监控 | ★★★★★ | ★★★★ | ★★★ | ★★★ |
| 性能监控 | ★★★ | ★★★★★ | ★★★ | ★★★★ |
| 行为追踪 | ★★ | ★★★★ | ★★★ | ★★★★★ |
| 数据分析 | ★★ | ★★★★★ | ★★★ | ★★★★ |
| 接入成本 | ★★★★★ | ★★★ | ★★★★ | ★★ |
| 运维成本 | ★★★★★ | ★★★★ | ★★★★ | ★★ |
| 定制能力 | ★★ | ★★★ | ★★ | ★★★★★ |
| 数据合规 | ★★★ | ★★★ | ★★★★★ | ★★★★★ |
| 长期成本 | ★★★ | ★★ | ★★★ | ★★★★ |

```
选择 Sentry 的场景：
  ✓ 主要需求是错误监控
  ✓ 团队规模小（< 20 人）
  ✓ 预算有限
  ✓ 不需要深度定制
  ✓ 可以接受数据存储在海外

选择 DataDog 的场景：
  ✓ 需要全栈可观测性（前端 + 后端 + 基础设施）
  ✓ 预算充足
  ✓ 有专门的 SRE 团队
  ✓ 需要强大的数据分析能力
  ✓ 已经在用 DataDog 的其他产品

选择云厂商方案的场景：
  ✓ 数据必须存储在国内
  ✓ 已经在用该云厂商的其他服务
  ✓ 不需要深度定制
  ✓ 团队对云厂商生态熟悉

选择自建的场景：
  ✓ 数据合规要求极严格
  ✓ 需要深度定制采集和分析逻辑
  ✓ 流量极大（SaaS 成本不可接受）
  ✓ 有专门的基础设施团队
  ✓ 需要和内部系统深度集成
```

## 混合方案

很多团队采用混合方案：

```
错误监控：Sentry（成熟、好用）
性能监控：自建（需要定制化指标）
行为追踪：自建（需要和业务系统集成）
数据可视化：Grafana（通用、免费）
告警：自建 + 飞书/钉钉机器人
```

```javascript
// 混合方案的初始化
class MonitoringSDK {
  constructor(config) {
    // 错误监控用 Sentry
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.environment,
      release: config.release,
    });
    
    // 性能和行为用自建
    this.performance = new PerformanceMonitor({
      endpoint: config.performanceEndpoint,
      sampleRate: config.perfSampleRate,
    });
    
    this.tracker = new BehaviorTracker({
      endpoint: config.trackingEndpoint,
      sampleRate: config.trackingSampleRate,
    });
  }

  captureError(error, context) {
    // 同时上报到 Sentry 和自建平台
    Sentry.captureException(error, { extra: context });
    this.errorReporter.report(error, context);
  }
}
```

## 迁移策略

如果你已经在用某个方案，想迁移到另一个：

```
阶段 1：双写（1-2 周）
  新旧方案同时上报数据
  对比数据一致性

阶段 2：验证（1-2 周）
  新方案为主，旧方案为辅
  验证告警是否正常触发

阶段 3：切换（1 周）
  停止旧方案上报
  保留旧方案只读访问（用于历史数据查询）

阶段 4：清理
  移除旧方案的 SDK 和配置
  处理历史数据（迁移或归档）
```

## 常见误区

### 误区一：选最贵的就对了

**错误理解**：DataDog 功能最全，选它肯定没错

**正确理解**：功能多不等于适合你。如果你只需要错误监控，Sentry 免费版就够了。DataDog 的全栈能力你用不到，反而增加了配置复杂度和成本。

### 误区二：自建一定比 SaaS 便宜

**错误理解**：SaaS 按事件量计费太贵，自建服务器成本可控

**正确理解**：自建的隐性成本很高——开发时间、运维人力、故障处理、功能迭代。一个工程师一年的薪资可能够你用 Sentry 好几年。只有在流量极大或合规要求严格时，自建才划算。

### 误区三：一次选型定终身

**错误理解**：选了 Sentry 就一直用 Sentry

**正确理解**：业务在变化，团队在成长。早期用 Sentry 快速起步，后期流量大了或需求复杂了再考虑迁移。关键是保持 SDK 层的抽象，不要让业务代码直接依赖某个平台的 API。

## 本课小结

1. **Sentry**：错误监控首选，小团队友好，有开源版本
2. **DataDog**：全栈可观测性，功能强大但价格昂贵
3. **云厂商方案**：国内合规友好，和云生态集成好
4. **自建方案**：完全可控，但开发和维护成本高
5. **混合方案**：不同组件用不同方案，取长补短
6. **选型原则**：从需求出发，不要过度也不要不足

## 练习

### 练习一：选型分析

根据以下团队情况，推荐合适的监控方案：
- 团队 1：3 人创业团队，预算有限，主要需要错误监控
- 团队 2：50 人中型团队，已有后端监控，需要前端全链路
- 团队 3：金融公司，数据不能出境，有合规要求
- 团队 4：大型互联网公司，日活千万，需要深度定制

### 练习二：设计自建方案的 MVP

如果要从零开始自建前端监控系统，设计一个 MVP（最小可行产品）方案：
- 第一阶段（2 周）：实现什么功能？
- 第二阶段（2 周）：增加什么功能？
- 第三阶段（2 周）：完善什么功能？
- 技术栈选择什么？

## 参考答案

### 练习一

```
团队 1（3 人创业团队）：
  推荐：Sentry 免费版
  理由：免费额度够用，接入简单，几分钟就能用
  后续：流量增长后升级到 Sentry 付费版

团队 2（50 人中型团队）：
  推荐：Sentry + 自建性能监控
  理由：Sentry 负责错误监控，自建负责性能和行为
  备选：如果预算充足，可以用 DataDog RUM

团队 3（金融公司）：
  推荐：Sentry 自部署 或 自建方案
  理由：数据合规要求必须自部署
  注意：自部署需要运维 Sentry 的基础设施

团队 4（大型互联网公司）：
  推荐：自建方案
  理由：流量大、需要深度定制、有基础设施团队
  架构：SDK 自研 + Kafka + ClickHouse + Grafana
```

### 练习二

```
第一阶段（2 周）：错误监控 MVP
  - 浏览器 SDK：JS 错误捕获、Promise 异常捕获
  - 数据接收：简单的 HTTP 服务
  - 存储：Elasticsearch 或 ClickHouse
  - 展示：Grafana 简单面板
  - 告警：错误率超阈值发飞书/钉钉通知

第二阶段（2 周）：性能监控
  - SDK 增加：Web Vitals 采集、Navigation Timing
  - 存储增加：性能指标表
  - Grafana 增加：性能大盘

第三阶段（2 周）：完善和优化
  - SDK 增加：Source Map 上传、错误还原
  - 存储优化：数据分区、TTL 清理
  - 功能增加：错误聚合、面包屑、用户上下文
  - 告警完善：分级、升级、值班

技术栈：
  - SDK：TypeScript，< 10KB gzip
  - 接收服务：Node.js + Express
  - 消息队列：Redis Streams（初期）→ Kafka（后期）
  - 存储：ClickHouse
  - 可视化：Grafana
  - 告警：Prometheus Alertmanager + 飞书 Webhook
```

## 下一步

完成本课后，继续学习 [10. 阶段项目：实现轻量级前端监控 SDK](./10-stage-project.md)。
