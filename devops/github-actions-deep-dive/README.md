# GitHub Actions 深度课

> CI/CD 流水线是每个项目必需的，但大多数人只会抄模板。

## 适合谁

- 用过 GitHub Actions 但不理解底层机制
- CI 跑不过时只会反复重试，不知道怎么排查
- 想从"能用"到"能设计高效的 CI/CD 流水线"

## 学完能做什么

- 设计高效的 GitHub Actions Workflow（矩阵构建、缓存、并行）
- 部署和管理自托管 Runner
- 实现可重用 Workflow 和复合 Action
- 配置 OIDC、Secrets、环境保护规则等安全机制
- 优化 CI/CD 流水线的性能和成本

## 学习路线

### 第一阶段：Workflow 基础

1. Workflow 语法深度——触发条件、Job、Step、Action 的完整语义
2. 执行环境——GitHub 托管 Runner 的系统环境、软件预装、磁盘布局
3. 上下文与表达式——github/context/env/secrets 的作用域和生命周期
4. 工件与缓存——actions/cache、actions/upload-artifact 的区别和用法
5. 阶段实战：为一个 Node.js 项目设计完整的 CI 流水线

### 第二阶段：高级 Workflow

6. 矩阵构建——多版本/多平台并行测试的策略
7. 条件执行——if 表达式、continue-on-error、fail-fast
8. 可重用 Workflow——workflow_call、输入/输出、跨仓库调用
9. 复合 Action——把多个 Step 封装成可复用的 Action
10. 阶段实战：实现一个跨仓库的可重用 CI/CD 流水线

### 第三阶段：自托管 Runner

11. 自托管 Runner 架构——安装、注册、标签、分组
12. Runner 安全——网络隔离、权限最小化、镜像管理
13. 弹性 Runner——基于 Kubernetes 的自动扩缩容（Actions Runner Controller）
14. Runner 成本优化——Spot 实例、缓存策略、构建合并
15. 阶段实战：部署一个基于 K8s 的弹性 Runner 集群

### 第四阶段：安全与性能

16. OIDC 与云服务认证——免密钥访问 AWS/GCP/Azure
17. Secret 管理——环境级 Secret、仓库级 Secret、组织级 Secret
18. 环境保护规则——审批、等待、分支限制
19. CI 性能优化——缓存命中率、并行度、Docker 层缓存
20. 阶段实战：配置一个安全的多环境部署流水线

### 第五阶段：实战模式

21. Monorepo CI——路径过滤、增量构建、Turborepo 集成
22. Docker 构建优化——BuildKit、多平台构建、镜像推送
23. 部署模式——蓝绿部署、金丝雀发布、自动回滚
24. CI 监控——构建时长趋势、失败率、缓存命中率
25. 阶段实战：为一个 Monorepo 项目设计完整的 CI/CD 方案

## 验收标准

- 能设计一个包含测试、Lint、构建、部署的完整 Workflow
- 能配置矩阵构建实现多平台/多版本测试
- 能实现可重用 Workflow 供多个仓库调用
- 能配置 OIDC 免密钥访问云服务
- 能分析并优化 CI 构建时长（缓存、并行、路径过滤）

## 参考文档

- GitHub Actions 官方文档：https://docs.github.com/en/actions
- Actions Toolkit：https://github.com/actions/toolkit
- Actions Runner Controller：https://github.com/actions/actions-runner-controller
