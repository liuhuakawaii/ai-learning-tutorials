# 第四阶段：集成与连接

## 阶段目标

掌握 n8n 与主流 SaaS 和基础设施的集成：消息平台、办公套件、数据库、文件存储、支付和 CRM 系统。

## 课时安排

1. Slack / 飞书集成（消息推送、审批流、机器人）
2. Google Workspace 集成（Sheets/Docs/Calendar 自动化）
3. 数据库集成（PostgreSQL/MySQL/MongoDB 节点）
4. 文件存储集成（S3/Google Drive/阿里云 OSS）
5. 支付与 CRM 集成（Stripe/HubSpot/Salesforce）
6. 阶段实战：全渠道营销自动化

## 阶段项目

构建一个全渠道营销自动化系统：从 Google Sheets 读取营销计划 → 生成内容 → 同步到多个渠道 → 跟踪效果 → 更新 CRM。

## 验收标准

- 至少集成 3 个外部服务
- 数据在不同系统间正确流转
- 包含错误处理和重试逻辑
- 敏感凭证通过 n8n Credentials 管理
- 营销流程端到端可执行
