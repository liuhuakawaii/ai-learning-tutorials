# Ingress 控制器

## 场景引入

你已经用 Service 暴露了后端 API，用 NodePort 可以从外部访问。但 NodePort 有明显的问题：端口范围有限（30000-32767）、不支持域名路由、不支持 TLS 终止。如果你有 10 个微服务，就需要 10 个不同的 NodePort，用户需要记住 10 个不同的端口号。

Ingress 是 K8s 的七层（HTTP/HTTPS）入口控制器。它让你用一个 80/443 端口，通过域名和路径将流量路由到不同的后端 Service。

## 学习目标

1. 理解 Ingress 在 K8s 网络架构中的位置
2. 掌握 Ingress 资源对象的配置
3. 学会安装和配置 Nginx Ingress Controller
4. 掌握 TLS 终止和 HTTPS 配置
5. 了解 Ingress 的高级路由规则

## Ingress 架构

```
外部流量
    │
    ▼
┌──────────────┐
│ Ingress      │ ← Ingress Controller（Nginx/Traefik/HAProxy）
│ Controller   │
└──────┬───────┘
       │  根据域名和路径路由
       │
  ┌────┴────┬──────────┐
  ▼         ▼          ▼
┌─────┐  ┌─────┐  ┌────────┐
│api  │  │web  │  │admin   │
│-svc │  │-svc │  │-svc    │
└─────┘  └─────┘  └────────┘
```

Ingress 由两部分组成：
- **Ingress 资源**：YAML 定义路由规则（域名 → Service 的映射）
- **Ingress Controller**：实际执行路由规则的程序（通常是 Nginx Pod）

## 安装 Nginx Ingress Controller

### Kind 环境安装

```bash
# Kind 使用特定的 Ingress Controller manifest
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# 等待 Ingress Controller 就绪
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

### 通用安装

```bash
# 使用 Helm 安装
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=NodePort
```

### 验证安装

```bash
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx
```

## 创建 Ingress 资源

### 基本路由

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-svc
                port:
                  number: 80
    - host: web.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web-svc
                port:
                  number: 80
```

### 路径路由

```yaml
spec:
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-svc
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web-svc
                port:
                  number: 80
```

### pathType 说明

```yaml
# Prefix：前缀匹配
path: /api
# 匹配：/api, /api/v1, /api/users
# 不匹配：/api2, /application

# Exact：精确匹配
path: /api
pathType: Exact
# 匹配：/api
# 不匹配：/api/, /api/v1

# ImplementationSpecific：由 Ingress Controller 决定
```

## TLS 终止

### 手动配置 TLS

```bash
# 1. 创建 TLS Secret
kubectl create secret tls app-tls \
  --cert=tls.crt \
  --key=tls.key
```

```yaml
# 2. 在 Ingress 中引用 TLS Secret
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress-tls
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.example.com
        - web.example.com
      secretName: app-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-svc
                port:
                  number: 80
```

### cert-manager 自动 TLS

cert-manager 可以自动从 Let's Encrypt 获取和续期证书。

```bash
# 安装 cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

```yaml
# 创建 ClusterIssuer
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
```

```yaml
# Ingress 添加注解自动获取证书
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.example.com
      secretName: api-tls    # cert-manager 自动创建这个 Secret
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-svc
                port:
                  number: 80
```

## Ingress 高级功能

### 速率限制

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/limit-rps: "10"
    nginx.ingress.kubernetes.io/limit-rpm: "100"
```

### 跨域（CORS）

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://web.example.com"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE"
```

### 重定向与重写

```yaml
metadata:
  annotations:
    # 重定向到 HTTPS
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    # 路径重写
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /api(/|$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: api-svc
                port:
                  number: 80
```

### 默认后端

当没有匹配的路由规则时，流量转发到默认后端：

```yaml
spec:
  defaultBackend:
    service:
      name: default-svc
      port:
        number: 80
```

## Ingress Controller 对比

| 特性 | Nginx Ingress | Traefik | HAProxy |
|------|--------------|---------|---------|
| 配置方式 | 注解 | CRD + 注解 | ConfigMap |
| 热更新 | 需要 reload | 自动 | 自动 |
| 性能 | 高 | 高 | 最高 |
| 学习曲线 | 低 | 中 | 中 |
| 社区活跃度 | 最高 | 高 | 中 |

## 常见误区

**误区一："创建 Ingress 就能访问了"**

Ingress 资源只是路由规则的声明，必须有 Ingress Controller 实际执行这些规则。没有 Ingress Controller，Ingress 资源不起任何作用。

**误区二："Ingress 只能用 Nginx"**

Ingress Controller 有很多选择：Nginx、Traefik、HAProxy、Envoy、Istio。`ingressClassName` 字段指定使用哪个 Controller。

**误区三："Ingress 替代了 Service"**

Ingress 工作在七层（HTTP/HTTPS），Service 工作在四层（TCP/UDP）。Ingress 在 Service 之上提供七层路由能力，两者是互补关系。

## 工程建议

1. **生产环境必须用 HTTPS**：使用 cert-manager 自动管理证书
2. **配置合理的超时和重试**：避免长请求被意外断开
3. **使用默认后端处理 404**：给用户友好的错误页面
4. **监控 Ingress Controller 的指标**：QPS、延迟、错误率
5. **Ingress 和 Service 分开管理**：不要把所有配置都放在一个 YAML 里

## 小结

- Ingress 提供七层路由、TLS 终止、域名和路径分发
- Ingress 资源 + Ingress Controller = 完整的入口方案
- cert-manager 可以自动获取和续期 TLS 证书
- 注解是配置 Nginx Ingress 高级功能的主要方式
- Ingress 和 Service 是互补关系，不是替代关系

## 练习

### 练习一：Ingress 路由实践

完成以下配置：
1. 部署两个 Deployment：`api`（http-echo，文本 "API"）和 `web`（nginx）
2. 创建对应的 Service
3. 配置 Ingress：`app.local/api` → api-svc，`app.local/` → web-svc
4. 通过 curl 验证路由规则

### 练习二：TLS 配置

使用 openssl 生成自签名证书，配置 Ingress 的 TLS 终止。

---

## 参考答案

### 练习一

**答案**：

```bash
# 1. 部署 api
kubectl create deployment api --image=hashicorp/http-echo -- \
  -text="Hello from API" -listen=:8080
kubectl expose deployment api --port=80 --target-port=8080

# 2. 部署 web
kubectl create deployment web --image=nginx:1.25
kubectl expose deployment web --port=80

# 3. 配置 Ingress
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  ingressClassName: nginx
  rules:
    - host: app.local
      http:
        paths:
          - path: /api(/|$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: api
                port:
                  number: 80
          - path: /(/|${'$'})(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: web
                port:
                  number: 80
EOF

# 4. 验证（Kind 环境）
curl -H "Host: app.local" http://localhost/api
# 返回 "Hello from API"

curl -H "Host: app.local" http://localhost/
# 返回 Nginx 默认页面
```

### 练习二

**答案**：

```bash
# 1. 生成自签名证书
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout tls.key \
  -out tls.crt \
  -subj "/CN=app.local"

# 2. 创建 TLS Secret
kubectl create secret tls app-tls --cert=tls.crt --key=tls.key

# 3. 配置 TLS Ingress
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress-tls
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.local
      secretName: app-tls
  rules:
    - host: app.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
EOF

# 4. 验证 HTTPS
curl -k -H "Host: app.local" https://localhost
# 返回 Nginx 默认页面（-k 忽略自签名证书验证）
```

**要点**：
- 自签名证书适合开发和测试，生产环境用 cert-manager + Let's Encrypt
- `-k` 参数让 curl 忽略证书验证
- TLS Secret 必须和 Ingress 在同一命名空间
