# 第三阶段：自托管 Runner

## 阶段目标

理解自托管 Runner 的架构、安全和弹性扩缩容机制，能部署基于 Kubernetes 的弹性 Runner 集群并优化成本。

## 课时列表

1. [自托管 Runner 架构——安装、注册、标签、分组](11-self-hosted-runner-architecture.md)
2. [Runner 安全——网络隔离、权限最小化、镜像管理](12-runner-security.md)
3. [弹性 Runner——基于 Kubernetes 的自动扩缩容（Actions Runner Controller）](13-arc-kubernetes-runners.md)
4. [Runner 成本优化——Spot 实例、缓存策略、构建合并](14-runner-cost-optimization.md)
5. [阶段实战：部署一个基于 K8s 的弹性 Runner 集群](15-stage-project-k8s-runner-cluster.md)

## 验收标准

- 能安装和配置自托管 Runner 并通过标签管理 Runner 分组
- 能说明自托管 Runner 的安全最佳实践（网络隔离、权限最小化）
- 能用 Actions Runner Controller 在 K8s 上部署弹性 Runner
- 能通过 Spot 实例和缓存策略优化 Runner 运行成本
