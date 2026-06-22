# 自动化工作流：n8n + AI 驱动的企业自动化

> 面向开发者和运维人员的工作流自动化课程：从 n8n 基础、高级编排、AI 集成，到企业级部署与规模化运营。

## 适合谁

- 想用低代码工具替代重复性脚本的开发者
- 需要把多个 SaaS 工具串联起来的团队
- 想让 AI 嵌入业务流程但不想写大量胶水代码的工程师

## 学完能做什么

- 用 n8n 构建复杂业务工作流（条件分支、循环、子工作流、批处理）
- 集成 AI 能力（OpenAI/Claude 调用、RAG 流程、Agent 工作流）
- 对接 Slack/飞书、Google Workspace、数据库、文件存储、支付和 CRM
- 实施企业级自动化：版本管理、监控告警、权限审计、性能优化
- 设计高可用的 n8n 部署方案

## 技术栈

| 类别 | 技术 |
|------|------|
| 自动化平台 | n8n（主）、Zapier、Make |
| AI 集成 | OpenAI、Claude、向量数据库 |
| 消息通知 | Slack、飞书、Telegram |
| 办公套件 | Google Sheets/Docs/Calendar |
| 数据库 | PostgreSQL、MySQL、MongoDB |
| 文件存储 | S3、Google Drive、阿里云 OSS |
| 支付/CRM | Stripe、HubSpot、Salesforce |
| 部署 | Docker、PostgreSQL（n8n 数据库）、Redis（队列） |

## 贯穿项目

本课程使用 `Enterprise Automation Hub` 作为贯穿项目。它是一个完整的企业自动化平台模板：

```bash
cd workflow-automation/final-project/automation-hub
npm run check
```

包含工作流模板、监控面板、权限配置和部署脚本。

## 学习路线

### 第一阶段：n8n 基础

1. 自动化工作流思维
2. n8n 安装与配置
3. 节点与触发器
4. 数据映射与转换
5. 错误处理与重试
6. 阶段实战：客户通知自动化

### 第二阶段：高级工作流

1. 条件分支与循环
2. 子工作流
3. 数据聚合与批处理
4. Credentials 管理
5. 自定义节点开发
6. 阶段实战：订单处理系统

### 第三阶段：AI 工作流

1. AI 节点集成
2. RAG 工作流
3. Agent 工作流
4. 内容生成流水线
5. 数据标注与评估
6. 阶段实战：AI 客服自动化

### 第四阶段：集成与连接

1. Slack / 飞书集成
2. Google Workspace 集成
3. 数据库集成
4. 文件存储集成
5. 支付与 CRM 集成
6. 阶段实战：全渠道营销自动化

### 第五阶段：企业级自动化

1. 工作流版本管理
2. 监控与告警
3. 权限与审计
4. 性能优化
5. 规模化部署
6. 阶段实战：企业自动化平台

## 最终项目

**Enterprise Automation Hub：企业自动化平台模板**

功能包括：

- 多种工作流模板（通知、订单处理、AI 客服、营销）
- 监控面板与告警配置
- 团队权限与审计日志
- Docker Compose 部署方案
- 版本管理与回滚机制

详情见 [最终项目说明](final-project/项目说明.md)。

## 学习建议

1. 先在本地用 Docker 跑通 n8n，再逐步扩展集成。
2. 每节课的练习都试着用自己的业务场景替换示例。
3. AI 工作流部分建议先跑通基础 Prompt 调用，再尝试 RAG 和 Agent。
4. 企业级部分关注安全和可观测性，不要跳过。

## 参考文档

- n8n 官方文档：https://docs.n8n.io/
- n8n 社区工作流：https://n8n.io/workflows/
- OpenAI API：https://platform.openai.com/docs
- Zapier Platform：https://platform.zapier.com/
- Make（Integromat）：https://www.make.com/en/help
