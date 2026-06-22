# 第六课：阶段实战 — MVP 上线

## 场景引入

你的 MVP 已经开发完成：AI 文案生成功能正常运行，数据库记录着每一次生成，反馈组件嵌在页面底部。但你现在面对一个问题：怎么让第一批用户知道你的产品？发朋友圈？写小红书？投广告？找 KOL？

MVP 上线不是一个技术事件，而是一个市场事件。你需要的不是"部署成功"，而是"有人在用"。这一课，你会学到如何把 MVP 推向市场，获取第一批用户，并从他们的使用中获取最有价值的验证数据。

## 学习目标

1. 掌握 MVP 上线前的检查清单
2. 学会用低成本方式获取第一批用户
3. 了解上线后的关键指标监控
4. 能够根据上线数据做出"继续/调整/放弃"的决策

## 一、上线前检查清单

### 1.1 功能检查

```typescript
const launchChecklist = {
  // 核心功能
  coreFeatures: [
    { item: "AI 文案生成功能正常", test: "输入菜品信息，生成文案" },
    { item: "复制功能正常", test: "点击复制，粘贴到其他地方验证" },
    { item: "错误提示正常", test: "不填必填项，看错误提示" },
    { item: "重新生成功能正常", test: "点重新生成，看是否正常" }
  ],

  // 用户体验
  userExperience: [
    { item: "页面加载速度 < 3 秒", test: "用手机 4G 网络测试" },
    { item: "手机端显示正常", test: "用 iPhone 和 Android 各测一次" },
    { item: "文案显示完整", test: "生成长文案，看是否被截断" },
    { item: "按钮可点击", test: "所有按钮都能正常响应" }
  ],

  // 技术稳定性
  stability: [
    { item: "AI API 不会超时", test: "连续生成 10 次，看是否有失败" },
    { item: "数据库连接正常", test: "生成后查看数据库是否有记录" },
    { item: "环境变量正确", test: "检查 API Key、数据库连接等" },
    { item: "错误日志可查看", test: "故意触发错误，看日志是否记录" }
  ],

  // 法律合规
  compliance: [
    { item: "隐私政策页面", test: "有隐私政策链接" },
    { item: "用户协议", test: "有基本的用户协议" },
    { item: "内容免责", test: "声明 AI 生成内容需要用户审核" }
  ]
};
```

### 1.2 Landing Page 优化

```tsx
// 优化后的 Landing Page 关键元素
const landingPageOptimization = {
  // 价值主张要具体
  headline: {
    before: "AI 营销助手",
    after: "30 秒生成小红书爆款文案，餐饮老板都在用"
  },

  // 社会证明
  socialProof: {
    before: "无",
    after: "已有 50+ 餐饮老板使用，平均节省 2 小时/天"
  },

  // CTA 要明确
  cta: {
    before: "开始使用",
    after: "免费试用 3 次，无需注册"
  },

  // 消除顾虑
  trustSignals: [
    "无需绑定银行卡",
    "生成内容可直接使用",
    "不满意可无限重新生成"
  ]
};
```

## 二、获取第一批用户的渠道

### 2.1 免费渠道

```typescript
const acquisitionChannels = {
  // 1. 个人社交网络
  personalNetwork: {
    channels: ["朋友圈", "微信群", "即刻", "微博"],
    effort: "低",
    expectedUsers: "20-50",
    tips: "不要硬广，分享你的创业故事和产品背后的想法"
  },

  // 2. 垂直社区
  community: {
    channels: [
      "小红书（发产品介绍笔记）",
      "知乎（回答相关问题）",
      "V2EX（分享项目）",
      "Product Hunt（国际用户）",
      "独立开发者社区"
    ],
    effort: "中",
    expectedUsers: "50-200",
    tips: "提供价值，不要只发广告。先帮助别人，再介绍产品"
  },

  // 3. 内容营销
  contentMarketing: {
    channels: [
      "写博客文章（SEO）",
      "录制产品 demo 视频",
      "发小红书笔记（种草自己的产品）",
      "写 Twitter/X 帖子"
    ],
    effort: "高",
    expectedUsers: "100-500",
    tips: "内容要对目标用户有价值，不要只讲产品功能"
  },

  // 4. 合作互推
  partnerships: {
    channels: [
      "与互补产品互推",
      "找 KOL 试用",
      "加入行业社群提供免费试用"
    ],
    effort: "中",
    expectedUsers: "50-200",
    tips: "找目标用户重叠但不竞争的产品"
  }
};
```

### 2.2 低成本付费渠道

| 渠道 | 平台 | 预算 | 预期用户 | 建议 |
|------|------|------|---------|------|
| 社交广告 | 小红书/抖音/朋友圈 | ¥500-2000 | 100-500 | 先投 ¥500 测试转化率 |
| 搜索广告 | 百度/搜狗 | ¥500-1000 | 50-200 | 关键词要精准 |
| KOL/KOC | 小红书博主/公众号 | ¥500-3000/人 | 50-300/人 | 找 1-10 万粉小博主，性价比最高 |

### 2.3 获取第一批用户的实战策略

```markdown
## 第一批用户获取计划

### Week 1：个人网络 + 社区
- [ ] 发朋友圈介绍产品（附真实使用截图）
- [ ] 在 3 个目标用户微信群分享
- [ ] 在小红书发 2 篇产品介绍笔记
- [ ] 在 V2EX 发项目分享帖
- [ ] 在知乎回答 3 个相关问题
- 目标：30 个注册用户

### Week 2：内容营销 + 合作
- [ ] 写 1 篇产品背后故事的博客
- [ ] 录制 1 个 1 分钟的产品 demo 视频
- [ ] 联系 3 个餐饮行业 KOC 试用
- [ ] 加入 2 个餐饮老板社群，提供免费试用
- 目标：50 个注册用户

### Week 3：付费测试
- [ ] 小红书投 ¥500 测试广告
- [ ] 根据转化率决定是否继续投放
- 目标：100 个注册用户
```

## 三、上线后的指标监控

### 3.1 核心指标仪表盘

```typescript
interface LaunchMetrics {
  // 用户获取
  acquisition: {
    totalUsers: number;        // 总注册用户
    newUsersToday: number;     // 今日新增
    trafficSources: Record<string, number>; // 流量来源分布
  };

  // 用户激活
  activation: {
    firstGenerationRate: number;  // 注册后生成第一篇文案的比例
    avgTimeToFirstGen: number;    // 从注册到首次生成的平均时间（分钟）
  };

  // 用户留存
  retention: {
    day1Retention: number;     // 次日留存率
    day7Retention: number;     // 7 日留存率
    day30Retention: number;    // 30 日留存率
  };

  // 用户行为
  engagement: {
    avgGenerationsPerUser: number; // 每用户平均生成次数
    copyRate: number;              // 复制率
    regenerateRate: number;        // 重新生成率
  };

  // 商业指标
  business: {
    willingnessToPay: number;  // 愿意付费的用户比例
    feedbackScore: number;     // 平均反馈评分
    nps: number;               // 净推荐值
  };
}
```

### 3.2 数据收集和分析

```typescript
// src/app/api/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  // 获取核心指标
  const [
    totalUsers,
    todayGenerations,
    avgRating,
    retentionData
  ] = await Promise.all([
    sql`SELECT COUNT(DISTINCT session_id) as count FROM generations`,
    sql`SELECT COUNT(*) as count FROM generations WHERE DATE(created_at) = CURRENT_DATE`,
    sql`SELECT AVG(rating) as avg FROM feedback WHERE rating IS NOT NULL`,
    sql`
      SELECT
        DATE(created_at) as date,
        COUNT(DISTINCT session_id) as users
      FROM generations
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `
  ]);

  return NextResponse.json({
    totalUsers: totalUsers.rows[0].count,
    todayGenerations: todayGenerations.rows[0].count,
    avgRating: avgRating.rows[0].avg,
    retention: retentionData.rows
  });
}
```

### 3.3 关键指标的目标值

```typescript
const targetMetrics = {
  // 第一周目标
  week1: {
    totalUsers: 50,
    activationRate: 0.6,     // 60% 的注册用户生成了第一篇文案
    day1Retention: 0.3,      // 30% 的用户次日回访
    copyRate: 0.4,           // 40% 的生成结果被复制
    feedbackScore: 3.5       // 平均评分 3.5/5
  },

  // 第一个月目标
  month1: {
    totalUsers: 200,
    activationRate: 0.7,
    day7Retention: 0.2,      // 20% 的用户 7 天后回访
    copyRate: 0.5,
    feedbackScore: 4.0,
    willingnessToPay: 0.3    // 30% 的用户表示愿意付费
  }
};
```

## 四、上线后的用户沟通

### 4.1 欢迎邮件/消息

```typescript
// 新用户注册后的欢迎消息
const welcomeMessage = `
🎉 欢迎使用 AI 餐饮营销助手！

你已经可以免费生成 3 篇小红书文案。

快速开始：
1. 输入你的菜品名称和价格
2. 选择文案风格（推荐先试"种草"风格）
3. 点击"一键生成"

💡 小贴士：
- 写清楚菜品特色，AI 会生成更精准的文案
- 不满意可以无限重新生成
- 有问题随时加我微信：xxx

祝你用得开心！
`;
```

### 4.2 用户反馈跟进

```typescript
// 对提交反馈的用户进行跟进
const feedbackFollowUp = {
  // 正面反馈
  positive: {
    message: "感谢你的认可！你愿意把产品推荐给你的餐饮朋友吗？",
    action: "请求推荐"
  },

  // 负面反馈
  negative: {
    message: "感谢你的反馈！你提到的 [问题] 我们已经在改进了。能再给你看看新版本吗？",
    action: "解决问题后再次邀请试用"
  },

  // 建设性反馈
  constructive: {
    message: "你的建议非常好！我们计划在下周的更新中加入 [功能]。到时候第一时间通知你。",
    action: "记录需求，更新后通知"
  }
};
```

## 五、"继续/调整/放弃"决策

### 5.1 决策框架

```typescript
interface LaunchDecision {
  metrics: LaunchMetrics;
  decision: 'continue' | 'pivot' | 'abandon';
  reasoning: string;
  nextSteps: string[];
}

function makeDecision(metrics: LaunchMetrics): LaunchDecision {
  const { acquisition, activation, retention, engagement, business } = metrics;

  // 信号强：继续
  if (
    retention.day7Retention >= 0.15 &&
    engagement.copyRate >= 0.4 &&
    business.willingnessToPay >= 0.3
  ) {
    return {
      metrics,
      decision: 'continue',
      reasoning: '用户留存和付费意愿达到预期，继续优化和扩展',
      nextSteps: [
        '优化核心功能，提升文案质量',
        '增加新功能（如抖音风格）',
        '测试定价方案',
        '扩大获客渠道'
      ]
    };
  }

  // 信号中等：调整
  if (
    retention.day1Retention >= 0.2 &&
    engagement.copyRate >= 0.2
  ) {
    return {
      metrics,
      decision: 'pivot',
      reasoning: '有兴趣但留存不足，需要调整产品方向或目标用户',
      nextSteps: [
        '深度访谈流失用户，了解原因',
        '测试不同的价值主张',
        '尝试不同的目标用户群',
        '调整核心功能'
      ]
    };
  }

  // 信号弱：放弃
  return {
    metrics,
    decision: 'abandon',
    reasoning: '用户兴趣不足，继续投入的 ROI 太低',
    nextSteps: [
      '总结失败原因',
      '记录学到的经验',
      '考虑新的产品方向',
      '回到第一课重新开始'
    ]
  };
}
```

### 5.2 决策时间线

```
Day 7：初步评估
├── 有 50+ 用户 → 继续
├── 20-50 用户 → 分析原因，调整策略
└── < 20 用户 → 检查产品和渠道

Day 14：深度评估
├── 留存率 > 20% → 信号良好
├── 留存率 10-20% → 需要优化
└── 留存率 < 10% → 考虑调整方向

Day 30：关键决策
├── 有付费用户 → 继续扩展
├── 有付费意愿但没付费 → 调整定价
└── 没有付费意愿 → 认真考虑放弃
```

## 六、上线后的产品迭代节奏

### 6.1 迭代节奏

```
每周迭代节奏：

周一：回顾上周数据，确定本周重点
周二-周四：开发和测试
周五：发布更新，通知用户

每月迭代节奏：

月初：制定月度目标和关键结果
月中：中期回顾，调整策略
月末：总结月度成果，规划下月
```

### 6.2 迭代优先级

| 阶段 | 重点 |
|------|------|
| 第一个月 | 提升 AI 文案质量、优化 UI、修复 bug、添加用户最想要的功能 |
| 第二个月 | 测试定价方案、扩大获客渠道、优化转化漏斗、增加粘性功能 |
| 第三个月 | 增加新平台支持、优化 AI 成本、建立用户社群、准备规模化 |

## 七、上线实战 Checklist

### 7.1 上线当天

```markdown
## 上线日 Checklist

### 技术准备
- [ ] 所有环境变量已配置
- [ ] 数据库表已创建
- [ ] AI API Key 有效且有余额
- [ ] 域名已配置（如有）
- [ ] SSL 证书正常

### 功能验证
- [ ] 核心流程走通（输入 → 生成 → 复制）
- [ ] 错误提示显示正常
- [ ] 手机端显示正常
- [ ] 加载速度 < 3 秒

### 数据监控
- [ ] 埋点数据正常上报
- [ ] 反馈收集功能正常
- [ ] 错误日志可查看

### 市场准备
- [ ] Landing Page 已优化
- [ ] 朋友圈文案已准备
- [ ] 社区分享帖已写好
- [ ] 客服微信已设置

### 发布
- [ ] 部署到生产环境
- [ ] 自己完整测试一遍
- [ ] 分享给 3 个朋友测试
- [ ] 发布朋友圈和社区
```

### 7.2 上线后第一周

```markdown
## 第一周每日任务

### Day 1：监控和修复
- [ ] 监控服务器状态
- [ ] 修复紧急 bug
- [ ] 回复用户反馈
- [ ] 记录所有问题

### Day 2-3：收集反馈
- [ ] 联系首批用户，了解使用体验
- [ ] 收集行为数据
- [ ] 分析用户使用路径

### Day 4-5：第一轮优化
- [ ] 修复 top 3 问题
- [ ] 优化 AI Prompt（如果质量不达标）
- [ ] 发布小版本更新

### Day 6-7：评估和规划
- [ ] 汇总第一周数据
- [ ] 评估是否达到预期
- [ ] 制定第二周计划
```

## 常见误区

### 误区一：上线即完成

上线只是开始，不是结束。真正的验证在上线后才开始。不要部署完就去度假。

### 误区二：追求完美再上线

"再加一个功能"、"再修一个 bug"——这些都是不上线的借口。能用就上线，边用边改。

### 误区三：忽视早期用户

前 100 个用户是最宝贵的。他们的反馈比任何市场调研都有价值。要像对待 VIP 一样对待他们。

### 误区四：过早投入大量广告

在产品还没验证之前，不要投入大量广告费。先用免费渠道验证产品，有了正向数据后再考虑付费投放。

## 工程建议

### 1. 准备回滚方案

部署前确保可以快速回滚。如果线上出严重问题，能在 5 分钟内恢复到上一个版本。

### 2. 监控 AI API 成本

上线后密切监控 AI API 的调用量和成本。如果用户增长快，AI 成本可能会超出预期。

### 3. 建立用户沟通渠道

为早期用户建立一个专属的沟通渠道（微信群、Discord、Telegram）。这样你能快速获取反馈，用户也能感受到被重视。

### 4. 记录一切

上线后的每一天都要记录：数据、反馈、问题、决策。这些记录在以后复盘时非常有价值。

## 小结

- 上线前检查：功能、体验、稳定性、合规
- 获取第一批用户：个人网络 → 垂直社区 → 内容营销 → 付费渠道
- 核心监控指标：激活率、留存率、复制率、付费意愿
- 用数据做决策：继续 / 调整 / 放弃
- 上线只是开始，真正的验证在上线后

## 练习

1. **上线检查**：用本课的检查清单，检查你的 MVP 是否准备就绪。列出所有需要修复的问题。

2. **获客计划**：制定一个 2 周的获客计划，包括：渠道选择、内容准备、预期用户数、预算。

3. **数据监控**：在你的 MVP 中实现核心指标的监控，包括：用户数、生成次数、复制率、反馈评分。

4. **上线执行**：按照本课的步骤，把你的 MVP 部署上线，获取第一批用户，并在一周后评估结果。

---

## 参考答案

### 练习一：上线检查

**思路**：用课程中的上线检查清单逐项检查，分为功能检查、用户体验、技术稳定性、法律合规四个维度。每项都要实际测试，不能只看代码。发现问题后记录在修复清单中，优先修复阻塞上线的问题。

**答案**：

```markdown
## 上线检查报告

### 功能检查

| 检查项 | 测试方法 | 结果 | 问题描述 |
|--------|---------|------|---------|
| AI 文案生成正常 | 输入菜品信息，生成文案 | ✅/❌ | — |
| 复制功能正常 | 点击复制，粘贴验证 | ✅/❌ | — |
| 错误提示正常 | 不填必填项，看提示 | ✅/❌ | — |
| 重新生成正常 | 点重新生成 | ✅/❌ | — |
| 三种风格切换 | 分别选择三种风格 | ✅/❌ | — |

### 用户体验

| 检查项 | 测试方法 | 结果 | 问题描述 |
|--------|---------|------|---------|
| 页面加载 < 3 秒 | 手机 4G 网络测试 | ✅/❌ | — |
| 手机端显示正常 | iPhone + Android 各测一次 | ✅/❌ | — |
| 文案显示完整 | 生成长文案，看是否截断 | ✅/❌ | — |
| 按钮可点击 | 所有按钮都试一遍 | ✅/❌ | — |
| 输入框有 placeholder | 检查所有输入框 | ✅/❌ | — |

### 技术稳定性

| 检查项 | 测试方法 | 结果 | 问题描述 |
|--------|---------|------|---------|
| AI API 不超时 | 连续生成 10 次 | ✅/❌ | — |
| 数据库连接正常 | 生成后查数据库 | ✅/❌ | — |
| 环境变量正确 | 检查 API Key | ✅/❌ | — |
| 错误日志可查看 | 故意触发错误 | ✅/❌ | — |
| 错误不会暴露给用户 | 触发 500 错误 | ✅/❌ | — |

### 法律合规

| 检查项 | 测试方法 | 结果 | 问题描述 |
|--------|---------|------|---------|
| 隐私政策页面 | 有隐私政策链接 | ✅/❌ | — |
| 用户协议 | 有基本协议 | ✅/❌ | — |
| 内容免责 | 声明 AI 内容需审核 | ✅/❌ | — |

### 修复清单

| # | 问题 | 严重程度 | 状态 | 预计修复时间 |
|---|------|---------|------|------------|
| 1 | — | 阻塞/高/中/低 | 待修复 | — |
| 2 | — | — | — | — |

### 上线决策
- [ ] 所有阻塞问题已修复
- [ ] 核心流程测试通过
- [ ] 手机端测试通过
- [ ] 环境变量配置正确
- **结论：可以上线 / 需要修复后再上线**
```

**要点**：
- 每项都要实际测试，不能只看代码就标记"通过"
- 手机端测试必须做，很多用户会用手机访问
- "阻塞"级别的问题必须修复后才能上线，其他可以上线后修复
- 隐私政策和用户协议可以用模板生成，但必须有

### 练习二：获客计划

**思路**：分两个阶段制定获客计划：第一周用免费渠道（个人网络 + 社区），第二周用低成本付费渠道。每个渠道都要有具体的内容准备、预期用户数和预算。

**答案**：

```markdown
## 2 周获客计划

### Week 1：免费渠道（预算 ¥0）

| 天数 | 渠道 | 具体行动 | 内容准备 | 预期用户 |
|------|------|---------|---------|---------|
| Day 1 | 朋友圈 | 发布产品介绍 + 使用截图 | 3 张产品截图 + 一段文案 | 10-20 |
| Day 1 | 微信群 | 在 3 个餐饮行业群分享 | 一句话价值描述 + 链接 | 10-30 |
| Day 2 | 小红书 | 发布产品介绍笔记 | 标题："开了 5 年餐厅，终于不用自己写文案了" | 20-50 |
| Day 3 | V2EX | 发布独立开发者项目帖 | 项目介绍 + 技术栈 + 开发故事 | 10-30 |
| Day 4 | 知乎 | 回答 3 个餐饮营销相关问题 | 有价值的回答 + 产品提及 | 10-20 |
| Day 5-7 | 用户推荐 | 请首批用户推荐给朋友 | 推荐话术 + 免费额度奖励 | 10-20 |

**Week 1 目标：50 个注册用户**

### Week 2：低成本付费渠道（预算 ¥1000）

| 天数 | 渠道 | 具体行动 | 预算 | 预期用户 |
|------|------|---------|------|---------|
| Day 8-10 | 小红书广告 | 投放产品介绍笔记 | ¥500 | 50-100 |
| Day 11-12 | KOC 合作 | 联系 2 个小红书餐饮博主试用 | ¥300 | 30-50 |
| Day 13-14 | 社群运营 | 在餐饮老板社群提供免费试用 | ¥200 | 20-30 |

**Week 2 目标：100 个注册用户**

### 内容准备清单

| 内容 | 状态 | 说明 |
|------|------|------|
| 朋友圈文案 + 截图 | 待准备 | 真实使用截图最有说服力 |
| 小红书笔记 | 待准备 | 干货 + 产品介绍，不要纯广告 |
| V2EX 帖子 | 待准备 | 开发故事 + 技术细节 |
| 知乎回答 | 待准备 | 先提供价值，再介绍产品 |
| 推荐话术 | 待准备 | 简洁明了，一句话说清楚价值 |

### 预期总用户：150 人
### 总预算：¥1000
### 获客成本：¥6.7/人
```

**要点**：
- 第一周全部用免费渠道，验证产品后再考虑付费
- 内容要提供价值，不要纯广告
- 小红书笔记标题要有吸引力，不要写"推荐一个工具"
- 预期用户数要保守估计，实际可能是预期的 50-80%

### 练习三：数据监控

**思路**：实现核心指标的监控，包括用户数、生成次数、复制率、反馈评分。用一个简单的 Analytics API 查询数据库，返回统计数据。不需要用第三方工具，自己实现最简单。

**答案**：

```typescript
// src/app/api/analytics/route.ts - 数据监控 API
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  try {
    const [
      totalUsers,
      todayGenerations,
      copyRate,
      avgRating,
      dailyData,
    ] = await Promise.all([
      // 总用户数（按 session_id 去重）
      sql`SELECT COUNT(DISTINCT session_id) as count FROM generations`,

      // 今日生成次数
      sql`SELECT COUNT(*) as count FROM generations WHERE DATE(created_at) = CURRENT_DATE`,

      // 复制率
      sql`
        SELECT
          COALESCE(
            (SELECT COUNT(*) FROM events WHERE event_name = 'copy')::float /
            NULLIF((SELECT COUNT(*) FROM events WHERE event_name = 'generate_complete'), 0),
            0
          ) as rate
      `,

      // 平均反馈评分
      sql`SELECT AVG(rating) as avg FROM feedback WHERE rating IS NOT NULL`,

      // 每日数据（最近 7 天）
      sql`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as generations,
          COUNT(DISTINCT session_id) as users
        FROM generations
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
    ]);

    return NextResponse.json({
      summary: {
        totalUsers: totalUsers.rows[0].count,
        todayGenerations: todayGenerations.rows[0].count,
        copyRate: Math.round(copyRate.rows[0].rate * 100),
        avgRating: avgRating.rows[0].avg
          ? Number(avgRating.rows[0].avg).toFixed(1)
          : 'N/A',
      },
      daily: dailyData.rows,
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
```

```tsx
// src/app/admin/page.tsx - 简单的数据看板（给自己看）
'use client';
import { useEffect, useState } from 'react';

export default function AdminPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/analytics')
      .then((res) => res.json())
      .then(setData);
  }, []);

  if (!data) return <p>加载中...</p>;

  const { summary, daily } = data;

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">数据监控</h1>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">总用户</p>
          <p className="text-2xl font-bold">{summary.totalUsers}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">今日生成</p>
          <p className="text-2xl font-bold">{summary.todayGenerations}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">复制率</p>
          <p className="text-2xl font-bold">{summary.copyRate}%</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">平均评分</p>
          <p className="text-2xl font-bold">{summary.avgRating}</p>
        </div>
      </div>

      {/* 每日趋势 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="font-medium mb-4">最近 7 天</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th>日期</th>
              <th>生成次数</th>
              <th>用户数</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((row: any) => (
              <tr key={row.date} className="border-t">
                <td className="py-2">{row.date}</td>
                <td>{row.generations}</td>
                <td>{row.users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

**要点**：
- 核心指标只有 4 个：用户数、生成次数、复制率、反馈评分
- 数据看板给自己看就行，不需要做得很精美
- 每天看一次数据，不需要实时监控
- 如果复制率 < 40%，说明文案质量需要优化

### 练习四：上线执行

**思路**：按照课程中的上线 Checklist 逐步执行：部署 → 自测 → 分享给朋友 → 发布到社区 → 监控数据 → 收集反馈。上线后第一周每天都要看数据和反馈，及时修复问题。

**答案**：

```markdown
## 上线执行记录

### Day 0：部署上线

**部署步骤**：
1. 代码推送到 GitHub
2. 在 Vercel 导入项目
3. 配置环境变量：OPENAI_API_KEY、POSTGRES_URL
4. 点击 Deploy
5. 验证部署成功

**自测清单**：
- [ ] 核心流程：输入 → 生成 → 复制 ✅
- [ ] 错误提示：不填必填项，看提示 ✅
- [ ] 手机端：iPhone 测试 ✅
- [ ] 加载速度：4G 网络 < 3 秒 ✅

**分享给 3 个朋友测试**：
- 朋友 A：反馈 ___
- 朋友 B：反馈 ___
- 朋友 C：反馈 ___

### Day 1：发布到社区

**发布内容**：
- [ ] 朋友圈：发布产品介绍 + 使用截图
- [ ] 小红书：发布产品介绍笔记
- [ ] V2EX：发布项目分享帖

**Day 1 数据**：
- 访问量：___
- 注册用户：___
- 生成次数：___

### Day 2-3：收集反馈

**联系首批用户**：
- 联系了 ___ 个用户
- 进行了 ___ 个访谈
- 收集了 ___ 条反馈

**行为数据**：
- 复制率：___%
- 重新生成率：___%
- 平均评分：___/5

### Day 4-5：第一轮优化

**修复的问题**：
- [ ] 问题 1：___
- [ ] 问题 2：___
- [ ] 问题 3：___

**发布小版本更新**：
- 版本号：v1.0.1
- 更新内容：___

### Day 6-7：评估和规划

**第一周数据汇总**：
| 指标 | 实际值 | 目标值 | 是否达标 |
|------|--------|--------|---------|
| 总用户 | — | 50 | — |
| 生成次数 | — | — | — |
| 复制率 | — | 40% | — |
| 平均评分 | — | 3.5 | — |
| 次日留存 | — | 30% | — |

**评估结论**：
- 信号强（继续）/ 信号中（调整）/ 信号弱（放弃）

**下周计划**：
- 重点优化：___
- 新增功能：___
- 获客策略：___
```

**要点**：
- 上线不是一次性事件，而是一个持续的过程
- 第一周每天都要看数据和反馈
- 修复问题要优先级排序，先修阻塞级和高级问题
- 如果第一周数据不达标，不要慌，分析原因再调整
