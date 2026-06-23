# 阶段实战：MVP 上线

你的 MVP 开发完成：AI 文案生成功能正常，数据库记录着每次生成，反馈组件嵌在页面底部。但问题来了——怎么让第一批用户知道你的产品？

MVP 上线不是技术事件，是市场事件。你需要的不是"部署成功"，而是"有人在用"。

## 上线前检查

上线前必须确认的几件事：

```typescript
const launchChecklist = {
  core: [
    "AI 生成功能正常（输入→输出→复制）",
    "错误提示正常（不填必填项、网络断开）",
    "加载状态正常（AI 生成需要几秒，要有 loading）",
  ],
  security: [
    "API Key 不在前端代码中",
    "用户只能看到自己的数据",
    "输入有长度限制（防滥用）",
    "输出有基本的内容过滤",
  ],
  monitoring: [
    "有错误日志（至少 console.log 级别）",
    "有用户行为埋点（注册、生成、付费）",
    "有 API 调用监控（成本、延迟、错误率）",
  ],
};
```

这些不是"锦上添花"，是"没有就不该上线"。尤其是 API Key 安全——我见过太多人把 OpenAI Key 写在前端代码里直接推到 GitHub。

## 获取第一批用户

不用投广告，不用找 KOL。第一批用户用最笨的方法获取：

**方法一：垂直社群渗透**

去目标用户聚集的地方（微信群、小红书、知乎、V2EX），用内容吸引而不是硬推。

```
不要发：我做了一个 AI 写作工具，快来用！
要发：我用 AI 帮一个餐饮老板写了 3 条小红书文案，其中一条
      获得了 500+ 赞。这是我的 prompt 思路和生成过程...
```

先展示价值，再引出产品。

**方法二：手动服务转化**

找 10 个目标用户，免费帮他们用你的 AI 生成内容。体验过的人更可能成为用户。

**方法三：产品目录提交**

提交到 Product Hunt、V2EX、少数派、Hacker News 等平台。不要期望爆发式增长，但能获得初始用户和反馈。

## 上线后监控

```typescript
// 上线后第一个 48 小时关注这些指标
const day1Metrics = {
  registration: {
    metric: "注册数",
    target: "至少 20 个",
    source: "数据库 count",
  },
  activation: {
    metric: "激活率（注册后完成第一次生成）",
    target: "> 60%",
    source: "埋点事件",
  },
  retention: {
    metric: "次日留存",
    target: "> 30%",
    source: "登录日志",
  },
  feedback: {
    metric: "用户反馈",
    target: "收集 5 条以上具体反馈",
    source: "反馈组件 + 用户访谈",
  },
};
```

激活率是最关键的指标。如果用户注册了但没有完成第一次生成，说明 onboarding 有问题。

## 根据数据做决策

上线一周后，用数据决定下一步：

```typescript
type Action = "加速开发" | "调整方向" | "暂停";

function decide(metrics: {
  registrations: number;
  activationRate: number;
  day2Retention: number;
  feedback: string[];
}): Action {
  // 注册多但激活率低 → onboarding 有问题，优化引导流程
  if (metrics.registrations > 20 && metrics.activationRate < 0.3) {
    return "调整方向"; // 优化 onboarding
  }

  // 注册少但激活率高 → 产品没问题，需要更多用户
  if (metrics.registrations < 10 && metrics.activationRate > 0.6) {
    return "加速开发"; // 加大推广力度
  }

  // 注册少且激活率低 → 方向可能有问题
  if (metrics.registrations < 10 && metrics.activationRate < 0.3) {
    return "暂停"; // 重新验证
  }

  return "加速开发";
}
```

## 练习

### 练习一：部署上线

把你的 MVP 部署到 Vercel 或 Railway。要求：
- 环境变量用平台的 secrets 管理，不在代码中硬编码
- 至少有一个错误监控（Sentry 免费版或自建日志）
- 至少有一个用户行为埋点（PostHog 免费版或自建）

记录部署过程和遇到的问题。

### 练习二：获取首批用户

用上述三种方法中的至少两种，获取 10 个以上的真实用户。记录：
- 每个渠道的投入（时间、金钱）
- 每个渠道获得的用户数
- 每个渠道的用户质量（是否目标用户、是否完成激活）

### 练习三：数据分析

上线一周后，分析数据并做出决策：
- 注册数、激活率、次日留存分别是多少？
- 用户反馈中出现最多的关键词是什么？
- 用决策框架判断：加速开发、调整方向还是暂停？

---

## 参考答案

### 练习一

部署到 Vercel 的关键步骤：

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 配置环境变量（不要写在代码里）
vercel env add OPENAI_API_KEY

# 3. 部署
vercel --prod
```

常见坑：
- 环境变量只在 server 端可用，不要用 `NEXT_PUBLIC_` 前缀暴露 API Key
- Vercel 的免费版有执行时间限制（10 秒），长时间 AI 生成需要用 streaming 或队列
- 记得在 Vercel 的 Analytics 中开启 Web Analytics

### 练习二

社群渗透的有效方式是先提供价值。在电商卖家群分享"如何用 AI 写商品文案"的教程，末尾附产品链接。比直接发广告有效 10 倍。

### 练习三

数据分析要诚实。如果数据不好，不要找借口（"投放渠道不对""用户不了解 AI"）。数据不好就是方向或执行有问题，需要调整。
