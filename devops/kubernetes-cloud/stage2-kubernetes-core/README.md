# Stage 2：Kubernetes 核心

> 6 课时 | 掌握 K8s 日常工作中的核心资源对象

## 阶段概述

Stage 1 你学会了操作集群和管理 Pod。但直接管理 Pod 就像直接操作机器码——理论上可行，实践中不可行。这个阶段学习 K8s 的核心抽象层：Deployment 管理副本、Service 提供稳定入口、Ingress 处理外部路由、ConfigMap/Secret 管理配置、PersistentVolume 持久化数据。

## 学习目标

完成本阶段后，你能够：

1. 使用 Deployment 管理应用的滚动更新和回滚
2. 通过 Service 为 Pod 提供稳定的网络访问
3. 配置 Ingress 实现 HTTP 路由和 TLS 终止
4. 使用 ConfigMap 和 Secret 管理应用配置
5. 理解持久化存储的 PV/PVC 模型
6. 将一个包含前后端和数据库的完整应用部署到 K8s

## 课时列表

| 课时 | 标题 | 预计时间 |
|------|------|----------|
| 01 | Deployment 与 ReplicaSet | 50 分钟 |
| 02 | Service 与网络 | 50 分钟 |
| 03 | Ingress 控制器 | 45 分钟 |
| 04 | ConfigMap 与 Secret | 40 分钟 |
| 05 | PersistentVolume | 50 分钟 |
| 06 | 阶段实战：部署完整应用 | 60 分钟 |

## 学习建议

- 前 5 课每课对应一个核心资源对象，建议按顺序学习
- 每学完一个资源对象，立即在本地集群上创建、更新、删除它
- 第 6 课的实战会把前面所有知识串联起来
