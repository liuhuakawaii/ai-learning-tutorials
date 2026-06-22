# 云原生与 Kubernetes

> 30 课时 | 5 个阶段 | 面向有 Docker 基础的开发者

## 课程简介

本课程从容器编排的实际需求出发，系统讲解 Kubernetes 核心概念、部署策略、可观测性和云原生生态。每个阶段围绕真实工程场景展开，学完即可独立管理生产级 K8s 集群。

## 学习路线

| 阶段 | 主题 | 课时 | 状态 |
|------|------|------|------|
| Stage 1 | 容器编排基础 | 6 | ✅ 已完成 |
| Stage 2 | Kubernetes 核心 | 6 | ✅ 已完成 |
| Stage 3 | 部署策略 | 6 | ✅ 已完成 |
| Stage 4 | 可观测性与运维 | 6 | ✅ 已完成 |
| Stage 5 | 云原生生态 | 6 | ✅ 已完成 |

## 前置要求

- Docker 基础（镜像构建、容器管理、docker-compose）
- Linux 基本操作（文件管理、进程管理、网络基础）
- YAML 语法基础
- 基本的网络知识（IP、端口、DNS、HTTP）

## 课程目录

### Stage 1：容器编排基础（6 课时）

| 课时 | 标题 | 核心内容 |
|------|------|----------|
| 01 | 从 Docker 到编排 | 为什么需要编排、Docker Swarm vs K8s |
| 02 | Kubernetes 架构 | Control Plane、Node、Pod 概念 |
| 03 | kubectl 与集群操作 | kubectl 常用命令、上下文切换 |
| 04 | Pod 深入 | Pod 生命周期、Init Container、Sidecar |
| 05 | 资源管理 | Requests/Limits、QoS 等级、调度策略 |
| 06 | 阶段实战：搭建本地集群 | Kind/Minikube 搭建完整集群 |

### Stage 2：Kubernetes 核心（6 课时）

| 课时 | 标题 | 核心内容 |
|------|------|----------|
| 01 | Deployment 与 ReplicaSet | 滚动更新、回滚、HPA |
| 02 | Service 与网络 | ClusterIP/NodePort/LoadBalancer、DNS |
| 03 | Ingress 控制器 | Nginx Ingress、TLS 终止、路由规则 |
| 04 | ConfigMap 与 Secret | 配置管理、密钥注入、热更新 |
| 05 | PersistentVolume | PV/PVC、StorageClass、StatefulSet |
| 06 | 阶段实战：部署完整应用 | 部署前后端 + 数据库 |

### Stage 3：部署策略（6 课时）

| 课时 | 标题 | 核心内容 |
|------|------|----------|
| 01 | Helm 包管理 | Chart 开发、模板语法、Values |
| 02 | 蓝绿部署 | 蓝绿部署原理与实现 |
| 03 | 金丝雀发布 | 流量切分、渐进式发布 |
| 04 | GitOps 工作流 | ArgoCD/Flux、声明式部署 |
| 05 | 多环境管理 | Dev/Staging/Prod、环境隔离 |
| 06 | 阶段实战：完整 GitOps 流水线 | 端到端 GitOps |

### Stage 4：可观测性与运维（6 课时）

| 课时 | 标题 | 核心内容 |
|------|------|----------|
| 01 | Prometheus 监控 | 指标采集、PromQL、告警规则 |
| 02 | Grafana 可视化 | Dashboard 设计、数据源配置 |
| 03 | 日志体系 | EFK/Loki 栈、结构化日志 |
| 04 | 故障排查 | kubectl debug、日志分析、常见问题 |
| 05 | 安全加固 | RBAC、NetworkPolicy、Pod Security |
| 06 | 阶段实战：监控告警体系 | 搭建完整可观测性 |

### Stage 5：云原生生态（6 课时）

| 课时 | 标题 | 核心内容 |
|------|------|----------|
| 01 | Serverless on K8s | Knative、Auto-scaling to Zero |
| 02 | Service Mesh | Istio/Linkerd、流量管理 |
| 03 | K8s 上的 AI 工作负载 | GPU 调度、模型服务、KubeFlow |
| 04 | 多集群管理 | 集群联邦、跨集群部署 |
| 05 | Cost Optimization | 成本分析、Spot 实例、资源优化 |
| 06 | 阶段实战：云原生 AI 平台 | 搭建 AI 推理平台 |

## 毕业项目

搭建一个完整的云原生 AI 推理平台，包含：

- 多环境 Helm Chart 部署
- GitOps 自动化流水线
- Prometheus + Grafana 监控体系
- EFK/Loki 日志收集
- 蓝绿/金丝雀发布策略
- RBAC 与 NetworkPolicy 安全加固

详见 [项目说明](final-project/项目说明.md)。

## 学习建议

1. **动手为先**：每节课的代码示例都要在本地集群跑一遍
2. **循序渐进**：按阶段顺序学习，后续阶段依赖前面的基础
3. **记录笔记**：把遇到的问题和解决方案记录下来
4. **模拟故障**：故意制造故障再排查，是学习 K8s 最快的方式
