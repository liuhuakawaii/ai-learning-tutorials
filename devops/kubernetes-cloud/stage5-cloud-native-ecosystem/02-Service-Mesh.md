# Service Mesh

## 场景引入

你的微服务架构已经有 20 个服务了。每个服务都需要处理：重试、超时、熔断、流量分割、mTLS 加密、分布式追踪。如果把这些逻辑写在每个服务的代码里，业务代码和基础设施代码会严重耦合。换一个语言重写服务时，这些逻辑还要重新实现。

Service Mesh（服务网格）把网络通信的通用逻辑从业务代码中抽离出来，以 Sidecar 代理的方式运行在每个 Pod 中。应用只需要关心业务逻辑，所有的网络行为都由 Mesh 控制。

## 学习目标

1. 理解 Service Mesh 的核心概念和价值
2. 了解 Istio 的架构和核心组件
3. 掌握 Istio 的流量管理能力
4. 了解 mTLS 安全通信的配置
5. 理解 Service Mesh 的适用场景

## Service Mesh 架构

```
┌──────────────────────────────────────────────┐
│                Control Plane                  │
│              (Istiod / Linkerd)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Pilot    │  │ Citadel  │  │ Galley   │  │
│  │ 配置分发 │  │ 证书管理 │  │ 配置验证 │  │
│  └──────────┘  └──────────┘  └──────────┘  │
└──────────────────────────────────────────────┘
         │              │              │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ Pod A   │    │ Pod B   │    │ Pod C   │
    │┌──────┐ │    │┌──────┐ │    │┌──────┐ │
    ││ App  │ │    ││ App  │ │    ││ App  │ │
    │└──┬───┘ │    │└──┬───┘ │    │└──┬───┘ │
    │┌──▼───┐ │    │┌──▼───┐ │    │┌──▼───┐ │
    ││Envoy │◄├────┤│Envoy │◄├────┤│Envoy │ │
    ││Proxy │ │    ││Proxy │ │    ││Proxy │ │
    │└──────┘ │    │└──────┘ │    │└──────┘ │
    └─────────┘    └─────────┘    └─────────┘
```

Sidecar 代理（通常是 Envoy）拦截 Pod 的所有入站和出站流量，执行路由、安全、可观测性策略。

## Istio 核心概念

### VirtualService

定义流量路由规则。

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: web-vs
spec:
  hosts:
    - web-svc
  http:
    - match:
        - headers:
            x-canary:
              exact: "true"
      route:
        - destination:
            host: web-svc
            subset: canary
    - route:
        - destination:
            host: web-svc
            subset: stable
```

### DestinationRule

定义服务的子集和负载均衡策略。

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: web-dr
spec:
  host: web-svc
  trafficPolicy:
    loadBalancer:
      simple: ROUND_ROBIN
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: DEFAULT
        http1MaxPendingRequests: 100
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
  subsets:
    - name: stable
      labels:
        version: v1
    - name: canary
      labels:
        version: v2
```

### Gateway

控制网格入口流量。

```yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: web-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - "app.example.com"
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: app-tls
      hosts:
        - "app.example.com"
```

## 安装 Istio

```bash
# 下载 istioctl
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH

# 安装 Istio（demo profile 包含所有组件）
istioctl install --set profile=demo -y

# 验证安装
istioctl verify-install

# 为命名空间启用 Sidecar 自动注入
kubectl label namespace default istio-injection=enabled

# 部署应用后自动注入 Envoy Sidecar
kubectl apply -f deployment.yaml
kubectl get pods
# READY 列显示 2/2（应用 + Sidecar）
```

## 流量管理

### 金丝雀发布

```yaml
# 90% 流量到 stable，10% 到 canary
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: web-vs
spec:
  hosts:
    - web-svc
  http:
    - route:
        - destination:
            host: web-svc
            subset: stable
          weight: 90
        - destination:
            host: web-svc
            subset: canary
          weight: 10
```

### 故障注入

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: web-vs
spec:
  hosts:
    - web-svc
  http:
    - fault:
        delay:
          percentage:
            value: 10
          fixedDelay: 5s
        abort:
          percentage:
            value: 5
          httpStatus: 500
      route:
        - destination:
            host: web-svc
```

### 重试和超时

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: web-vs
spec:
  hosts:
    - web-svc
  http:
    - route:
        - destination:
            host: web-svc
      timeout: 10s
      retries:
        attempts: 3
        perTryTimeout: 3s
        retryOn: 5xx,reset,connect-failure
```

## mTLS 安全通信

```yaml
# 强制 mTLS
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: default
spec:
  mtls:
    mode: STRICT
```

mTLS 模式：
- **STRICT**：只接受 mTLS 流量
- **PERMISSIVE**：同时接受 mTLS 和明文流量
- **DISABLE**：不使用 mTLS

## 可观测性

Istio 自动为所有服务通信生成指标、日志和追踪数据。

```bash
# 安装 Kiali（Istio 可视化仪表盘）
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/kiali.yaml

# 安装 Jaeger（分布式追踪）
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/jaeger.yaml

# 访问 Kiali
istioctl dashboard kiali
```

## Istio vs Linkerd

| 特性 | Istio | Linkerd |
|------|-------|---------|
| 复杂度 | 高 | 低 |
| 功能 | 非常丰富 | 基本功能 |
| 资源占用 | 较高 | 较低 |
| 学习曲线 | 陡峭 | 平缓 |
| 适用场景 | 大型企业 | 中小团队 |

## 常见误区

**误区一："所有微服务都需要 Service Mesh"**

Service Mesh 引入了额外的复杂度和资源开销。如果只有几个服务，直接在代码中处理重试和超时更简单。

**误区二："Service Mesh 可以替代 API Gateway"**

Service Mesh 主要处理服务间通信（东西向流量），API Gateway 处理外部到内部的流量（南北向流量）。两者互补。

**误区三："安装 Istio 就自动有所有功能"**

Istio 默认是透明代理，不改变流量行为。你需要通过 VirtualService、DestinationRule 等 CRD 配置具体的策略。

## 工程建议

1. **评估是否真的需要 Service Mesh**：服务数量 < 10 时可能不需要
2. **从 PERMISSIVE 模式开始**：逐步迁移到 STRICT
3. **监控 Sidecar 的资源开销**：Envoy 会消耗额外的 CPU 和内存
4. **使用 Linkerd 如果团队较小**：学习成本低、资源占用小

## 小结

- Service Mesh 把网络通信逻辑从业务代码中抽离出来
- Istio 是最流行的 Service Mesh，功能丰富但复杂度高
- 核心能力：流量管理、安全通信（mTLS）、可观测性
- VirtualService 定义路由规则，DestinationRule 定义服务子集
- 评估复杂度和收益后再决定是否使用

## 练习

### 练习一：Istio 流量管理

使用 Istio 实现金丝雀发布：90% 流量到 v1，10% 到 v2。

### 练习二：故障注入

配置 Istio 故障注入，模拟 5% 的请求返回 500 错误。

---

## 参考答案

### 练习一

**答案**：

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: web-vs
spec:
  hosts:
    - web-svc
  http:
    - route:
        - destination:
            host: web-svc
            subset: stable
          weight: 90
        - destination:
            host: web-svc
            subset: canary
          weight: 10
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: web-dr
spec:
  host: web-svc
  subsets:
    - name: stable
      labels:
        version: v1
    - name: canary
      labels:
        version: v2
```

### 练习二

**答案**：

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: web-vs
spec:
  hosts:
    - web-svc
  http:
    - fault:
        abort:
          percentage:
            value: 5
          httpStatus: 500
      route:
        - destination:
            host: web-svc
```

**要点**：
- 故障注入用于测试系统的容错能力
- 可以同时注入延迟和错误
- 建议在 staging 环境测试后再用于生产
