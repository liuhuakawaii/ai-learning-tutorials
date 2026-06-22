# AI 产品化实战

> 从想法到上线的 AI 产品全流程，串联 Agent/RAG/MCP/评估等技术。不是教你写代码，而是教你把代码变成能赚钱的产品。

## 前置要求

- **必修前置**：[01-ai-app-course](../ai-engineer-path/01-ai-app-course/)、[02-ai-agent-engineer-course](../ai-engineer-path/02-ai-agent-engineer-course/)、[03-llm-eval-course](../ai-engineer-path/03-llm-eval-course/)
- **技术基础**：熟悉 TypeScript/Python，有 Next.js 或 FastAPI 开发经验
- **建议**：有独立项目或 Side Project 经验，了解基本的产品思维

## 这门课解决什么问题

你可能已经会用 OpenAI API 搭 RAG、写 Agent、接 MCP，但这些技术能力离"能上线的产品"之间还差一整条链路：

- **发现问题**：技术不缺，缺的是找到值得解决的真实问题
- **验证需求**：写了 1000 行代码才发现没人需要
- **集成 AI**：RAG/Agent/MCP 不是堆功能，是在产品体验里找到正确的位置
- **上线变现**：域名、部署、支付、定价、合规——每一项都能卡住你
- **持续增长**：上线只是起点，用户留存、反馈闭环、迭代节奏才是长期活

这门课带你走完从"我有个想法"到"我有个能收钱的产品"的全部环节。

## 适合谁

- 学完了 AI 工程师路径 01-03，想把技术能力变现为产品
- 有技术底子但没独立做过产品，想补齐产品思维
- 想做 AI Side Project 或 AI SaaS，需要一套可复用的方法论
- 准备 AI 创业，想在动手前验证清楚需求

## 学完能做什么

- 用结构化方法发现和筛选 AI 产品机会
- 在写代码前完成需求验证和 MVP 设计
- 将 RAG/Agent/MCP/评估等技术正确集成到产品中
- 独立完成从部署到支付的上线全流程
- 建立用户增长、数据驱动迭代的长期运营能力
- 交付一个可演示、可收费的 AI 产品

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js / React / TypeScript | 全栈框架，兼顾 SSR 和 API Routes |
| 后端 | FastAPI / Python | AI 逻辑、Agent 编排、RAG Pipeline |
| 数据库 | PostgreSQL | 用户数据、产品数据、使用日志 |
| 支付 | Stripe / LemonSqueezy | 海外收款、订阅管理、发票 |
| 部署 | Vercel / Docker | 快速上线，按需扩展 |
| AI | OpenAI API / MCP / 向量数据库 | 核心 AI 能力层 |
| 监控 | PostHog / Langfuse | 产品分析 + LLM 可观测性 |

## 学习路线

| 阶段 | 主题 | 核心问题 | 课时 |
|------|------|----------|------|
| 阶段 1 | [发现机会](./stage1-find-opportunity/) | 做什么？为什么做这个？ | 8 |
| 阶段 2 | [验证与 MVP](./stage2-validate-and-mvp/) | 用户真的需要吗？最小版本长什么样？ | 8 |
| 阶段 3 | [AI 能力集成](./stage3-build-with-ai/) | RAG/Agent/MCP 怎么用对地方？ | 10 |
| 阶段 4 | [上线与变现](./stage4-ship-and-monetize/) | 怎么部署？怎么收钱？ | 8 |
| 阶段 5 | [增长与迭代](./stage5-grow-and-iterate/) | 怎么让用户留下来？怎么持续改进？ | 8 |
| - | 毕业项目 | 完整 AI 产品从 0 到 1 | 4 周 |

**总计：42 课时 + 1 个毕业项目**

## 贯穿项目

本课程以 **AI 产品从 0 到 1** 为主线贯穿。每位学员在阶段 1 选定一个真实产品方向，后续每个阶段都围绕这个产品推进，直到阶段 5 交付一个可演示、可收费的完整产品。

建议的产品方向（任选其一或自定义）：

- **AI 文档助手**：面向团队的知识库问答和文档生成工具
- **AI 写作平台**：面向创作者的长文写作、改写和 SEO 优化工具
- **AI 数据分析器**：面向非技术用户的自然语言数据查询和可视化工具
- **AI 客服 Agent**：面向电商/SaaS 的智能客服和工单处理系统
- **AI 工作流自动化**：面向运营团队的多步骤任务自动编排工具

## 学习建议

1. **先选方向，再学技术**。阶段 1 别急着写代码，先把"做什么"想清楚。
2. **验证优先于开发**。阶段 2 的核心产出是一份验证报告，不是代码。
3. **AI 是手段不是目的**。不要为了用 Agent 而用 Agent，先想清楚产品体验再选技术。
4. **每个阶段都有真实产出**。不是学完就完了，每个阶段都要产出对产品有用的成果。
5. **用 AI 辅助开发**。课程全程鼓励使用 Claude Code / Codex，这是真实工作方式。
6. **关注 trade-off**。技术选型、定价策略、功能取舍都有利弊，理解 why 比记住 how 更重要。

## 课程目录

| 阶段 | 目录 | 课时 | 状态 |
|------|------|------|------|
| 阶段 1 | [stage1-find-opportunity](./stage1-find-opportunity/) | 8 | 规划中 |
| 阶段 2 | [stage2-validate-and-mvp](./stage2-validate-and-mvp/) | 8 | 规划中 |
| 阶段 3 | [stage3-build-with-ai](./stage3-build-with-ai/) | 10 | 规划中 |
| 阶段 4 | [stage4-ship-and-monetize](./stage4-ship-and-monetize/) | 8 | 规划中 |
| 阶段 5 | [stage5-grow-and-iterate](./stage5-grow-and-iterate/) | 8 | 规划中 |
| 毕业项目 | final-project/ | 综合实战 | 规划中 |

## 参考资料

- Indie Hackers：https://www.indiehackers.com/
- Y Combinator Startup School：https://www.startupschool.org/
- Stripe 文档：https://stripe.com/docs
- LemonSqueezy 文档：https://docs.lemonsqueezy.com/
- Vercel 文档：https://vercel.com/docs
- PostHog 文档：https://posthog.com/docs
- Langfuse 文档：https://langfuse.com/docs
