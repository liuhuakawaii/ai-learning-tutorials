# 07. 监控数据可视化与告警

> Grafana、数据大盘、告警规则、OnCall——让数据真正驱动运维决策

## 本课目标

- 理解监控数据可视化的价值和设计原则
- 掌握 Grafana 的基本使用和数据源配置
- 能设计有效的数据大盘
- 掌握告警规则的设计和 OnCall 机制
- 理解从"数据"到"行动"的转化流程

## 数据不等于洞察

你已经有了错误监控、性能采集、行为追踪，数据源源不断地流入数据库。但如果你只是把数据存起来，没有人看，那和没有一样。

可视化的目标是：**把数据变成可行动的洞察**。

```
原始数据 → 聚合计算 → 可视化展示 → 趋势发现 → 告警触发 → 问题处理
```

一个好的数据大盘应该让值班工程师在 30 秒内判断：系统是否正常，有没有需要立即处理的问题。

## Grafana 入门

Grafana 是最流行的开源数据可视化平台，几乎成为监控可视化的事实标准。

### 为什么是 Grafana

- 支持多种数据源（Prometheus、Elasticsearch、ClickHouse、InfluxDB 等）
- 丰富的图表类型
- 灵活的告警规则
- 模板变量支持多维度筛选
- 开源免费，社区活跃

### 数据源配置

```yaml
# Grafana 数据源配置（provisioning）
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    
  - name: Elasticsearch
    type: elasticsearch
    access: proxy
    url: http://elasticsearch:9200
    database: frontend-logs
    jsonData:
      esVersion: "8.0.0"
      timeField: "@timestamp"
      
  - name: ClickHouse
    type: grafana-clickhouse-datasource
    jsonData:
      host: clickhouse
      port: 9000
      database: analytics
```

### 基本查询

```promql
# Prometheus 查询示例

# 过去 5 分钟的错误率
sum(rate(frontend_errors_total[5m])) / sum(rate(frontend_requests_total[5m]))

# P95 页面加载时间
histogram_quantile(0.95, sum(rate(page_load_duration_seconds_bucket[5m])) by (le))

# 按页面分组的错误数
sum by (page) (increase(frontend_errors_total[1h]))
```

```sql
-- ClickHouse 查询示例

-- 过去 1 小时的 PV
SELECT
  toStartOfMinute(timestamp) AS time,
  count() AS pv
FROM events
WHERE event_type = 'pageview'
  AND timestamp > now() - INTERVAL 1 HOUR
GROUP BY time
ORDER BY time

-- 按页面分组的平均停留时长
SELECT
  page,
  avg(duration) AS avg_duration,
  count() AS visits
FROM events
WHERE event_type = 'stay_duration'
  AND timestamp > now() - INTERVAL 1 DAY
GROUP BY page
ORDER BY avg_duration DESC
```

## 数据大盘设计

### 大盘的层次结构

```
第一层：全局概览（Overview Dashboard）
  → 系统是否健康？有没有需要立即处理的问题？
  → 关键指标：错误率、响应时间、活跃用户数、系统可用性

第二层：业务大盘（Business Dashboard）
  → 业务指标是否正常？用户行为有没有异常？
  → 关键指标：转化率、PV/UV、核心功能使用率

第三层：技术大盘（Technical Dashboard）
  → 技术细节：性能指标、资源加载、错误详情
  → 关键指标：Web Vitals、慢资源、错误分布

第四层：专项大盘（Feature Dashboard）
  → 特定功能的深度监控
  → 例如：支付流程、搜索功能、注册流程
```

### 全局概览大盘

```json
{
  "title": "Frontend Overview",
  "panels": [
    {
      "title": "Error Rate",
      "type": "stat",
      "targets": [{
        "expr": "sum(rate(frontend_errors_total[5m])) / sum(rate(frontend_requests_total[5m])) * 100"
      }],
      "thresholds": {
        "steps": [
          { "value": 0, "color": "green" },
          { "value": 1, "color": "yellow" },
          { "value": 5, "color": "red" }
        ]
      }
    },
    {
      "title": "Active Users",
      "type": "stat",
      "targets": [{
        "expr": "count(count by (session_id) (frontend_events_total))"
      }]
    },
    {
      "title": "Error Rate Trend",
      "type": "timeseries",
      "targets": [{
        "expr": "sum(rate(frontend_errors_total[5m])) by (page)",
        "legendFormat": "{{page}}"
      }]
    },
    {
      "title": "Top Errors",
      "type": "table",
      "targets": [{
        "expr": "topk(10, sum by (error_type) (increase(frontend_errors_total[1h])))"
      }]
    }
  ]
}
```

### 前端性能大盘

```json
{
  "title": "Web Performance",
  "panels": [
    {
      "title": "Core Web Vitals",
      "type": "gauge",
      "targets": [
        { "expr": "histogram_quantile(0.75, web_vitals_lcp_bucket)", "legend": "LCP (P75)" },
        { "expr": "histogram_quantile(0.75, web_vitals_inp_bucket)", "legend": "INP (P75)" },
        { "expr": "histogram_quantile(0.75, web_vitals_cls_bucket)", "legend": "CLS (P75)" }
      ]
    },
    {
      "title": "Page Load Waterfall",
      "type": "timeseries",
      "targets": [
        { "expr": "avg(page_load_ttfb)", "legend": "TTFB" },
        { "expr": "avg(page_load_fcp)", "legend": "FCP" },
        { "expr": "avg(page_load_lcp)", "legend": "LCP" },
        { "expr": "avg(page_load_load)", "legend": "Full Load" }
      ]
    },
    {
      "title": "Slow Resources",
      "type": "table",
      "targets": [{
        "query": "SELECT resource_name, avg(duration) as avg_duration, count() as count FROM resources WHERE duration > 1000 GROUP BY resource_name ORDER BY avg_duration DESC LIMIT 20"
      }]
    }
  ]
}
```

### 大盘设计原则

1. **一屏展示关键信息**：不要让用户滚动才能看到重要指标
2. **颜色编码**：绿色=正常，黄色=警告，红色=危险
3. **时间范围可选**：提供 1 小时、6 小时、24 小时、7 天的快速切换
4. **模板变量**：支持按页面、设备、地区筛选
5. **链接跳转**：从概览大盘可以直接跳转到详情大盘

## 告警规则设计

### 告警的分类

```yaml
# 级别定义
levels:
  critical:
    description: "必须立即处理，影响大量用户"
    response_time: "5 分钟"
    notification: "电话 + 短信 + IM"
    examples:
      - "错误率突增到 5% 以上"
      - "核心接口全部超时"
      - "页面完全无法访问"
  
  warning:
    description: "需要关注，可能影响部分用户"
    response_time: "30 分钟"
    notification: "IM 通知"
    examples:
      - "错误率上升到 1%"
      - "某个页面 LCP 超过 4 秒"
      - "第三方资源加载失败率上升"
  
  info:
    description: "记录即可，不影响用户"
    response_time: "工作时间处理"
    notification: "邮件或日报"
    examples:
      - "新错误类型出现"
      - "某个非核心页面性能下降"
      - "浏览器版本分布变化"
```

### Prometheus 告警规则

```yaml
# alert-rules.yml
groups:
  - name: frontend-alerts
    rules:
      # 错误率突增
      - alert: HighErrorRate
        expr: |
          sum(rate(frontend_errors_total[5m])) 
          / sum(rate(frontend_requests_total[5m])) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Frontend error rate is {{ $value | humanizePercentage }}"
          description: "Error rate has been above 5% for 2 minutes"
      
      # LCP 退化
      - alert: LCPDegraded
        expr: |
          histogram_quantile(0.75, 
            sum(rate(web_vitals_lcp_bucket[5m])) by (le)
          ) > 4
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "LCP P75 is {{ $value }}s"
      
      # 新错误类型
      - alert: NewErrorType
        expr: |
          increase(frontend_errors_total[1h]) > 0
          and frontend_errors_total offset 1h == 0
        labels:
          severity: info
        annotations:
          summary: "New error type detected: {{ $labels.error_type }}"
```

### 告警去抖和聚合

```javascript
// 告警管理器
class AlertManager {
  constructor() {
    this.activeAlerts = new Map();
    this.cooldowns = new Map();
  }

  // 处理告警
  processAlert(alert) {
    const key = this.getAlertKey(alert);
    
    // 检查冷却期
    if (this.isInCooldown(key)) {
      return; // 在冷却期内，不重复告警
    }
    
    // 检查是否已有相同告警
    if (this.activeAlerts.has(key)) {
      this.activeAlerts.get(key).count++;
      return; // 已有相同告警，增加计数
    }
    
    // 新告警
    this.activeAlerts.set(key, {
      ...alert,
      count: 1,
      firstSeen: Date.now(),
    });
    
    this.notify(alert);
    this.setCooldown(key, alert.cooldown || 300000); // 默认 5 分钟冷却
  }

  getAlertKey(alert) {
    return `${alert.name}:${alert.severity}:${JSON.stringify(alert.labels)}`;
  }

  isInCooldown(key) {
    const cooldownEnd = this.cooldowns.get(key);
    return cooldownEnd && Date.now() < cooldownEnd;
  }

  setCooldown(key, duration) {
    this.cooldowns.set(key, Date.now() + duration);
  }

  // 解决告警
  resolveAlert(alert) {
    const key = this.getAlertKey(alert);
    const existing = this.activeAlerts.get(key);
    
    if (existing) {
      this.activeAlerts.delete(key);
      this.notify({
        ...alert,
        status: 'resolved',
        duration: Date.now() - existing.firstSeen,
        totalOccurrences: existing.count,
      });
    }
  }

  notify(alert) {
    // 根据严重程度选择通知渠道
    const channels = this.getChannels(alert.severity);
    
    channels.forEach(channel => {
      switch (channel) {
        case 'phone':
          this.sendPhone(alert);
          break;
        case 'sms':
          this.sendSMS(alert);
          break;
        case 'im':
          this.sendIM(alert);
          break;
        case 'email':
          this.sendEmail(alert);
          break;
      }
    });
  }

  getChannels(severity) {
    const channelMap = {
      critical: ['phone', 'sms', 'im'],
      warning: ['im'],
      info: ['email'],
    };
    return channelMap[severity] || ['im'];
  }
}
```

## OnCall 机制

### 值班轮换

```javascript
// 值班排班系统
class OnCallSchedule {
  constructor() {
    this.schedule = [
      { engineer: 'alice', start: '2024-01-15', end: '2024-01-22' },
      { engineer: 'bob', start: '2024-01-22', end: '2024-01-29' },
      { engineer: 'charlie', start: '2024-01-29', end: '2024-02-05' },
    ];
  }

  getCurrentOnCall() {
    const now = new Date();
    return this.schedule.find(
      s => now >= new Date(s.start) && now < new Date(s.end)
    );
  }

  getContactInfo(engineer) {
    const contacts = {
      alice: { phone: '+1234567890', im: '@alice' },
      bob: { phone: '+0987654321', im: '@bob' },
      charlie: { phone: '+1122334455', im: '@charlie' },
    };
    return contacts[engineer];
  }
}
```

### 告警升级

```javascript
class AlertEscalation {
  constructor() {
    this.escalationPolicy = {
      // 第一级：IM 通知，等待 15 分钟
      level1: { notify: 'im', waitMinutes: 15 },
      // 第二级：短信通知，等待 15 分钟
      level2: { notify: 'sms', waitMinutes: 15 },
      // 第三级：电话通知
      level3: { notify: 'phone' },
    };
  }

  async escalate(alert, currentLevel = 1) {
    const policy = this.escalationPolicy[`level${currentLevel}`];
    
    if (!policy) {
      // 所有级别都通知过了，记录为未响应
      this.logUnresponsive(alert);
      return;
    }
    
    // 通知当前级别
    await this.notify(alert, policy.notify);
    
    // 等待响应
    const responded = await this.waitForResponse(alert, policy.waitMinutes);
    
    if (!responded && currentLevel < 3) {
      // 未响应，升级到下一级
      await this.escalate(alert, currentLevel + 1);
    }
  }

  async waitForResponse(alert, minutes) {
    return new Promise(resolve => {
      const timeout = setTimeout(() => resolve(false), minutes * 60 * 1000);
      
      // 监听确认事件
      this.onAcknowledge(alert.id, () => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
  }
}
```

### 值班手册（Runbook）

```markdown
# 值班手册

## 高错误率告警

### 症状
- 监控大盘显示错误率突增
- 可能伴随用户投诉

### 排查步骤
1. 查看错误详情大盘，确认错误类型
2. 检查是否是新版本发布导致（查看部署记录）
3. 检查第三方服务状态（CDN、API 网关）
4. 检查是否有大量相同的错误（可能是某个用户群体的问题）

### 处理方案
- 如果是新版本问题：回滚
- 如果是第三方服务：联系服务商，同时考虑降级方案
- 如果是特定设备/浏览器：在错误详情中确认，针对性修复

### 升级条件
- 错误率持续 15 分钟以上 > 10%
- 影响核心业务流程（支付、登录）
```

## 从数据到行动

### 日报/周报自动生成

```javascript
class ReportGenerator {
  async generateDailyReport() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const data = await this.collectMetrics(yesterday, today);
    
    return {
      date: yesterday.toISOString().split('T')[0],
      summary: {
        totalPV: data.pv,
        totalUV: data.uv,
        errorRate: data.errorRate,
        lcpP75: data.lcpP75,
        topErrors: data.topErrors.slice(0, 5),
        topSlowPages: data.topSlowPages.slice(0, 5),
      },
      trends: {
        pvChange: this.calculateChange(data.pv, data.prevPv),
        errorRateChange: this.calculateChange(data.errorRate, data.prevErrorRate),
      },
      alerts: data.alertsTriggered,
    };
  }

  calculateChange(current, previous) {
    if (previous === 0) return null;
    return ((current - previous) / previous * 100).toFixed(1) + '%';
  }
}
```

## 常见误区

### 误区一：大盘越大越好

**错误理解**：一个大盘展示所有数据，一目了然

**正确理解**：信息过载和没有信息一样糟糕。大盘应该有明确的受众和目的。值班工程师需要的是一眼看清"有没有问题"，不是在一个巨大的屏幕上找数据。

### 误区二：告警越多越安全

**错误理解**：什么都告警，确保不遗漏

**正确理解**：告警疲劳是真实存在的问题。如果每天收到 100 条告警，其中 95 条是误报或不重要，值班人员会开始忽略告警——包括那 5 条真正重要的。告警应该精准、可行动。

### 误区三：只关注技术指标

**错误理解**：监控就是看 CPU、内存、错误率

**正确理解**：技术指标是手段，业务指标才是目的。一个页面加载慢 500ms 可能不影响业务，但一个按钮点击没有响应可能直接导致订单流失。监控应该和业务目标对齐。

## 本课小结

1. **大盘设计**：分层设计（概览→业务→技术→专项），一屏关键信息
2. **Grafana**：多数据源支持、模板变量、丰富的图表类型
3. **告警规则**：分级（critical/warning/info）、去抖、上下文
4. **OnCall**：值班轮换、告警升级、值班手册
5. **从数据到行动**：日报/周报自动化，数据驱动决策

## 练习

### 练习一：设计数据大盘

为一个电商网站设计三个数据大盘：
- 全局概览大盘（值班用）
- 性能大盘（性能优化用）
- 购买流程大盘（产品用）

列出每个大盘包含的面板和查询。

### 练习二：配置告警规则

为以下场景设计告警规则（使用 PromQL 或你熟悉的查询语言）：
- 错误率突增
- LCP 退化
- 某个 API 接口错误率上升
- 用户活跃数异常下降

## 参考答案

### 练习一

```
全局概览大盘：
├── 错误率（stat，阈值：绿<1%，黄1-5%，红>5%）
├── 当前在线用户（stat）
├── LCP P75（stat，阈值：绿<2.5s，黄2.5-4s，红>4s）
├── 错误率趋势（timeseries，按页面分组）
├── 错误类型分布（pie chart）
└── 最近告警列表（table）

性能大盘：
├── Core Web Vitals 仪表盘（gauge：LCP/INP/CLS）
├── 页面加载瀑布图（timeseries：TTFB/FCP/DCL/Load）
├── 慢资源 TOP10（table）
├── 长任务统计（timeseries）
├── 资源加载时间分布（histogram）
└── 设备/浏览器维度的性能对比（bar chart）

购买流程大盘：
├── 购买漏斗（funnel：浏览→加购→下单→支付）
├── 各环节转化率（stat × 4）
├── 支付成功率（stat）
├── 订单金额趋势（timeseries）
├── 支付失败原因分布（pie chart）
└── 购买流程中的错误（table）
```

### 练习二

```yaml
# 告警规则
groups:
  - name: frontend-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(frontend_errors_total[5m])) 
          / sum(rate(frontend_requests_total[5m])) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Error rate is {{ $value | humanizePercentage }}"
      
      - alert: LCPDegraded
        expr: |
          histogram_quantile(0.75, 
            sum(rate(web_vitals_lcp_bucket[5m])) by (le)
          ) > 4
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "LCP P75 is {{ $value }}s"
      
      - alert: APIErrorRate
        expr: |
          sum by (endpoint) (
            rate(http_errors_total{endpoint=~"/api/.*"}[5m])
          ) / sum by (endpoint) (
            rate(http_requests_total{endpoint=~"/api/.*"}[5m])
          ) > 0.1
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "API {{ $labels.endpoint }} error rate is {{ $value | humanizePercentage }}"
      
      - alert: UserActivityDrop
        expr: |
          sum(rate(active_users_total[30m])) 
          < sum(rate(active_users_total[30m] offset 1h)) * 0.5
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "User activity dropped by more than 50%"
```

## 下一步

完成本课后，继续学习 [08. A/B 测试与特性开关](./08-ab-testing-feature-flags.md)。
