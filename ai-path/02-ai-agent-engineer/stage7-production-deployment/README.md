# 阶段 7：生产部署——让系统跑在线上

## 阶段目标

完成容器化部署、CI/CD 流水线、反向代理、线上监控和运维。让你的 AI Agent 平台从 localhost 走到生产环境。

## 课时安排

| 课时 | 文件 | 主题 | 预计时间 |
|------|------|------|----------|
| 1 | [01-Docker容器化.md](./01-Docker容器化.md) | 多阶段构建、镜像优化、安全扫描、最佳实践 | 3h |
| 2 | [02-Docker-Compose编排.md](./02-Docker-Compose编排.md) | 多服务编排、开发环境一键启动、环境变量管理 | 3h |
| 3 | [03-数据库运维.md](./03-数据库运维.md) | 迁移管理、备份恢复、主从复制、连接池调优 | 3h |
| 4 | [04-CICD流水线.md](./04-CICD流水线.md) | GitHub Actions、自动测试、自动部署、环境管理 | 3h |
| 5 | [05-反向代理与HTTPS.md](./05-反向代理与HTTPS.md) | Nginx / Caddy 配置、SSL 证书、WebSocket 代理 | 2h |
| 6 | [06-线上监控与告警.md](./06-线上监控与告警.md) | Prometheus + Grafana、日志聚合、告警规则 | 3h |
| 7 | [07-阶段实战-生产级部署与上线清单.md](./07-阶段实战-生产级部署与上线清单.md) | 完整部署流程 | 4h |

## 实战任务

完成 **生产级部署**：

- 前后端 Docker 镜像构建（多阶段构建，镜像 < 200MB）
- Docker Compose 完整编排（前端、后端、数据库、Redis、Nginx）
- GitHub Actions CI/CD：代码推送 → 自动测试 → 自动部署
- Nginx 反向代理 + HTTPS + WebSocket 支持
- Prometheus + Grafana 监控看板
- 日志聚合与告警
- 上线检查清单文档

## 验收标准

- [ ] `docker compose up` 一键启动完整生产环境
- [ ] CI/CD 流水线：push 代码后自动测试、构建、部署
- [ ] HTTPS 正常工作，WebSocket 连接稳定
- [ ] Grafana 看板显示系统指标（CPU、内存、请求量、延迟）
- [ ] 告警规则配置完成，异常时能通知
- [ ] 上线检查清单覆盖安全、性能、备份、回滚等环节
