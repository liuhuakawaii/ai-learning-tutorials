# Service 与网络

## 场景引入

你已经用 Deployment 部署了 3 个后端 Pod。但前端如何找到后端？Pod 的 IP 是临时的——重启、扩缩容、滚动更新都会导致 IP 变化。你不能把 Pod IP 硬编码到前端配置里。

Service 是 K8s 提供的服务发现和负载均衡机制。它为一组 Pod 提供一个稳定的访问入口，无论后端 Pod 怎么变化，前端只需要访问 Service 的固定地址。

## 学习目标

1. 理解 Service 解决的核心问题
2. 掌握 ClusterIP、NodePort、LoadBalancer 三种 Service 类型
3. 理解 K8s 的 DNS 服务发现机制
4. 了解 Endpoints 和 EndpointSlice
5. 掌握 Headless Service 的使用场景

## Service 基础

### 创建 Service

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-svc
spec:
  selector:
    app: backend    # 选择 label 为 app=backend 的 Pod
  ports:
    - port: 80        # Service 端口
      targetPort: 8080  # Pod 端口
      protocol: TCP
  type: ClusterIP
```

Service 通过 `selector` 匹配 Pod，自动维护后端 Pod 列表。当 Pod 创建、删除或 Readiness Probe 失败时，Service 的 Endpoint 列表会自动更新。

### 查看 Service

```bash
# 查看 Service
kubectl get svc

# 查看 Service 的 Endpoint（后端 Pod 列表）
kubectl get endpoints backend-svc

# 查看详细信息
kubectl describe svc backend-svc
```

## Service 类型

### ClusterIP（默认）

ClusterIP 只能在集群内部访问，是最常用的 Service 类型。

```yaml
spec:
  type: ClusterIP
  # clusterIP: None  # Headless Service
```

```
集群内部访问：
Pod A → backend-svc:80 → Pod B (10.96.0.5:8080)
                       → Pod C (10.96.0.6:8080)
                       → Pod D (10.96.0.7:8080)
```

### NodePort

NodePort 在每个 Node 上开放一个端口（30000-32767），外部流量通过 `<NodeIP>:<NodePort>` 访问。

```yaml
spec:
  type: NodePort
  ports:
    - port: 80
      targetPort: 8080
      nodePort: 30080    # 可选，不指定会自动分配
```

```
外部访问：
Client → Node1:30080 → backend-svc:80 → Pod B
Client → Node2:30080 → backend-svc:80 → Pod C
```

NodePort 的问题：
- 端口范围有限（30000-32767）
- 需要知道 Node 的 IP
- 不适合生产环境直接暴露服务

### LoadBalancer

LoadBalancer 通过云厂商的负载均衡器暴露服务。在本地集群（Kind/Minikube）中，LoadBalancer 通常不会自动创建外部负载均衡器。

```yaml
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 8080
```

```
云环境访问：
Client → Cloud LB (外部 IP) → Node1:NodePort → backend-svc → Pod
                              → Node2:NodePort → backend-svc → Pod
```

### ExternalName

ExternalName 将 Service 映射到外部 DNS 名称，不代理任何流量。

```yaml
spec:
  type: ExternalName
  externalName: api.example.com
```

```bash
# 集群内部访问 external-svc 会被解析到 api.example.com
curl http://external-svc
```

## K8s DNS 服务发现

K8s 集群内置 CoreDNS，为每个 Service 自动创建 DNS 记录。

### DNS 命名规则

```
# 同一命名空间内的 Service
http://<service-name>

# 跨命名空间访问
http://<service-name>.<namespace>.svc.cluster.local

# 完整域名（FQDN）
<service-name>.<namespace>.svc.cluster.local
```

```bash
# 示例：在 default 命名空间访问 production 命名空间的 backend-svc
curl http://backend-svc.production.svc.cluster.local

# 简写（同命名空间内）
curl http://backend-svc
```

### DNS 解析验证

```bash
# 在 Pod 内测试 DNS 解析
kubectl exec -it <pod-name> -- nslookup backend-svc

# 输出：
# Name:      backend-svc.default.svc.cluster.local
# Address:   10.96.0.100    ← ClusterIP
```

## Endpoints 与 EndpointSlice

### Endpoints

Endpoints 记录 Service 背后所有健康的 Pod IP 和端口。

```bash
kubectl get endpoints backend-svc

# NAME          ENDPOINTS                                      AGE
# backend-svc   10.244.0.5:8080,10.244.0.6:8080,10.244.0.7:8080   5m
```

当 Pod 的 Readiness Probe 失败时，它的 IP 会从 Endpoints 中移除，流量不再转发到这个 Pod。

### EndpointSlice

K8s 1.21+ 默认使用 EndpointSlice 代替 Endpoints，支持更大规模的后端列表。

```bash
kubectl get endpointslices -l kubernetes.io/service-name=backend-svc
```

## Headless Service

Headless Service 没有 ClusterIP，DNS 直接解析到 Pod IP。

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-headless
spec:
  clusterIP: None    # Headless
  selector:
    app: backend
  ports:
    - port: 80
      targetPort: 8080
```

```bash
# DNS 解析返回所有 Pod IP
nslookup backend-headless
# Name:      backend-headless.default.svc.cluster.local
# Address:   10.244.0.5
# Address:   10.244.0.6
# Address:   10.244.0.7
```

Headless Service 的使用场景：
- **StatefulSet**：每个 Pod 需要稳定的网络标识（如 MySQL 主从）
- **客户端负载均衡**：客户端直接连接 Pod，不经过 kube-proxy
- **服务发现**：客户端需要知道所有后端 Pod 的地址

## kube-proxy 与 Service 实现

Service 的负载均衡由 kube-proxy 实现。kube-proxy 监听 Service 和 Endpoints 的变化，更新 Node 上的网络规则。

### iptables 模式（默认）

```bash
# kube-proxy 在 iptables 中创建规则
# 每个 Service 对应一组 DNAT 规则
iptables -t nat -L KUBE-SERVICES

# 流量路径：
# Pod 访问 Service ClusterIP
# → iptables DNAT 规则匹配
# → 随机选择一个后端 Pod IP
# → 直接转发到 Pod
```

iptables 模式的特点：
- 规则数量随 Service 和 Pod 数量线性增长
- 超过几千个 Service 时性能下降
- 负载均衡是随机的，不支持权重

### IPVS 模式

```bash
# IPVS 支持更高效的负载均衡算法
# 轮询、最少连接、源地址哈希等
ipvsadm -Ln
```

IPVS 适合大规模集群（几千个 Service）。

## 网络策略基础

默认情况下，集群内所有 Pod 可以互相访问。NetworkPolicy 可以限制 Pod 的网络访问。

```yaml
# 只允许 frontend 访问 backend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - port: 8080
```

注意：NetworkPolicy 需要 CNI 插件支持（如 Calico、Cilium），Kind 默认的 kindnet 不支持。

## 常见误区

**误区一："Service 会做健康检查"**

Service 依赖 Pod 的 Readiness Probe 来判断后端是否健康。如果 Pod 没有配置 Readiness Probe，即使应用启动失败，流量也会转发过去。

**误区二："NodePort 可以直接用于生产"**

NodePort 的端口范围有限、不支持 TLS 终止、没有 WAF 和 DDoS 防护。生产环境应该用 Ingress 或 LoadBalancer。

**误区三："ClusterIP 只能用 IP 访问"**

ClusterIP 有对应的 DNS 名称，应该始终用 DNS 名称访问 Service，而不是 IP。IP 可能变化，DNS 名称是稳定的。

## 工程建议

1. **用 DNS 名称访问 Service**：`http://backend-svc` 而不是 `http://10.96.0.100`
2. **始终配置 Readiness Probe**：确保流量只转发到健康的 Pod
3. **生产环境用 Ingress 暴露服务**：不要直接用 NodePort 或 LoadBalancer
4. **Headless Service 用于 StatefulSet**：数据库、消息队列等有状态服务
5. **跨命名空间访问用 FQDN**：`svc-name.namespace.svc.cluster.local`

## 小结

- Service 为 Pod 提供稳定的访问入口和负载均衡
- ClusterIP（集群内）、NodePort（节点端口）、LoadBalancer（云 LB）
- K8s DNS 自动为 Service 创建 DNS 记录
- Headless Service 直接返回 Pod IP，适合有状态服务
- kube-proxy 通过 iptables/IPVS 实现 Service 的网络转发

## 练习

### 练习一：Service 类型实践

创建以下资源并验证访问：
1. Deployment：3 个 Nginx 副本
2. ClusterIP Service：集群内访问
3. NodePort Service：从本地机器访问

### 练习二：DNS 解析验证

在集群中创建一个调试 Pod，验证以下 DNS 解析：
1. 同命名空间的 Service DNS 名称
2. kube-system 命名空间的 Service DNS 名称
3. 完整 FQDN

---

## 参考答案

### 练习一

**答案**：

```bash
# 1. 创建 Deployment
kubectl create deployment web --image=nginx:1.25 --replicas=3

# 2. 创建 ClusterIP Service
kubectl expose deployment web --port=80 --type=ClusterIP

# 3. 在集群内验证
kubectl exec -it deploy/web -- curl http://web

# 4. 创建 NodePort Service
kubectl expose deployment web --port=80 --type=NodePort --name=web-np

# 5. 查看 NodePort
kubectl get svc web-np
# 记下 NODE_PORT（比如 31234）

# 6. 从本地访问
curl http://localhost:31234
```

### 练习二

**答案**：

```bash
# 1. 创建调试 Pod
kubectl run dns-test --image=busybox:1.36 -- sleep 3600

# 2. 等待 Pod 运行
kubectl wait --for=condition=Ready pod/dns-test

# 3. 验证同命名空间 DNS
kubectl exec -it dns-test -- nslookup web
# Name:      web.default.svc.cluster.local
# Address:   10.96.x.x

# 4. 验证 kube-system 的 DNS
kubectl exec -it dns-test -- nslookup kube-dns.kube-system
# Name:      kube-dns.kube-system.svc.cluster.local
# Address:   10.96.0.10

# 5. 验证 FQDN
kubectl exec -it dns-test -- nslookup web.default.svc.cluster.local
# 返回相同的 ClusterIP

# 6. 清理
kubectl delete pod dns-test
```

**要点**：
- 同命名空间内可以直接用 Service 名称访问
- 跨命名空间需要用 `<svc>.<namespace>` 或完整 FQDN
- kube-dns 是集群 DNS 服务的 Service 名称
