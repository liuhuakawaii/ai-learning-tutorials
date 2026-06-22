# ConfigMap 与 Secret

## 场景引入

你的应用需要数据库连接串、API 密钥、日志级别等配置。如果把这些配置硬编码到镜像里，每次改配置都要重新构建镜像。如果用环境变量写在 Deployment YAML 里，不同环境（开发、测试、生产）需要维护不同的 YAML 文件，很容易出错。

K8s 提供 ConfigMap 和 Secret 来解决配置管理问题。ConfigMap 存储非敏感配置，Secret 存储敏感信息（密码、密钥、证书）。两者都可以以环境变量或文件的形式注入到容器中。

## 学习目标

1. 理解 ConfigMap 和 Secret 的区别和使用场景
2. 掌握创建和使用 ConfigMap 的三种方式
3. 掌握 Secret 的创建和使用
4. 了解配置热更新的机制和限制
5. 学会安全管理敏感信息

## ConfigMap

### 创建 ConfigMap

```bash
# 方式一：从键值对创建
kubectl create configmap app-config \
  --from-literal=LOG_LEVEL=info \
  --from-literal=DB_HOST=mysql-service \
  --from-literal=DB_PORT=3306

# 方式二：从文件创建
kubectl create configmap app-config --from-file=config.properties

# 方式三：从目录创建（目录下每个文件成为一个键）
kubectl create configmap app-config --from-file=config/
```

### YAML 声明式创建

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: "info"
  DB_HOST: "mysql-service"
  DB_PORT: "3306"
  config.properties: |
    server.port=8080
    spring.datasource.url=jdbc:mysql://mysql-service:3306/mydb
    logging.level.root=INFO
```

### 使用 ConfigMap

**方式一：环境变量注入**

```yaml
spec:
  containers:
    - name: app
      image: my-app:1.0
      envFrom:
        - configMapRef:
            name: app-config    # 所有键都注入为环境变量
      env:
        - name: DB_HOST         # 只注入指定的键
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_HOST
```

**方式二：Volume 挂载**

```yaml
spec:
  containers:
    - name: app
      image: my-app:1.0
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
  volumes:
    - name: config-volume
      configMap:
        name: app-config
        items:
          - key: config.properties
            path: application.properties
```

## Secret

### 创建 Secret

```bash
# 方式一：从键值对创建
kubectl create secret generic db-secret \
  --from-literal=username=admin \
  --from-literal=password='S3cr3tP@ss!'

# 方式二：从文件创建
kubectl create secret generic tls-secret \
  --from-file=tls.crt \
  --from-file=tls.key

# 方式三：专用类型
kubectl create secret tls my-tls --cert=tls.crt --key=tls.key
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=user \
  --docker-password=pass
```

### YAML 声明式创建

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  username: YWRtaW4=          # base64 编码的 "admin"
  password: UzNjcjN0UEBzcyE=  # base64 编码的 "S3cr3tP@ss!"
```

```bash
# base64 编码
echo -n 'admin' | base64
# 输出：YWRtaW4=

# base64 解码
echo 'YWRtaW4=' | base64 -d
# 输出：admin
```

### 使用 Secret

**环境变量注入**：

```yaml
spec:
  containers:
    - name: app
      env:
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
```

**Volume 挂载**：

```yaml
spec:
  containers:
    - name: app
      volumeMounts:
        - name: secret-volume
          mountPath: /etc/secrets
          readOnly: true
  volumes:
    - name: secret-volume
      secret:
        secretName: db-secret
```

**拉取私有镜像**：

```yaml
spec:
  imagePullSecrets:
    - name: regcred
  containers:
    - name: app
      image: registry.example.com/my-app:1.0
```

## ConfigMap vs Secret

| 特性 | ConfigMap | Secret |
|------|-----------|--------|
| 用途 | 非敏感配置 | 敏感信息 |
| 数据格式 | 明文 | Base64 编码 |
| 大小限制 | 1MB | 1MB |
| 挂载方式 | 环境变量/Volume | 环境变量/Volume |
| 热更新 | Volume 挂载支持 | Volume 挂载支持 |

注意：Secret 的 Base64 编码**不是加密**。任何有权限读取 Secret 的人都能解码。真正的安全需要启用 etcd 加密或使用外部密钥管理（如 Vault）。

## 配置热更新

### Volume 挂载的热更新

当你更新 ConfigMap 或 Secret 后，通过 Volume 挂载的文件会自动更新（不需要重启 Pod）：

```bash
# 1. 更新 ConfigMap
kubectl edit configmap app-config
# 或
kubectl apply -f configmap.yaml

# 2. 等待 60-90 秒后（kubelet 的同步周期），Pod 中的文件会自动更新
kubectl exec -it <pod-name> -- cat /etc/config/config.properties
# 会看到新内容
```

### 环境变量不支持热更新

通过环境变量注入的配置**不会**自动更新，必须重启 Pod：

```yaml
# envFrom 和 env 注入的变量在 Pod 启动时确定
# 修改 ConfigMap 后需要重启 Pod
kubectl rollout restart deployment/my-app
```

### SubPath 不支持热更新

使用 `subPath` 挂载的文件不会自动更新：

```yaml
volumeMounts:
  - name: config-volume
    mountPath: /etc/config/app.conf
    subPath: app.conf    # 不会热更新
```

### 强制热更新的技巧

在 Deployment 的 annotation 中添加 ConfigMap 的版本，修改时触发滚动更新：

```yaml
spec:
  template:
    metadata:
      annotations:
        config-version: "v2"    # 修改这个值触发滚动更新
    spec:
      containers:
        - name: app
          envFrom:
            - configMapRef:
                name: app-config
```

## 私有镜像拉取

```yaml
# 1. 创建 Docker Registry Secret
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=myuser \
  --docker-password=mypassword

# 2. 在 Pod 中使用
spec:
  imagePullSecrets:
    - name: regcred
  containers:
    - name: app
      image: registry.example.com/my-app:1.0
```

## 常见误区

**误区一："Secret 是安全的因为它是 Base64 编码的"**

Base64 只是编码，不是加密。`echo "YWRtaW4=" | base64 -d` 就能解码。真正的安全措施是：启用 etcd 加密、使用 RBAC 限制访问、使用外部密钥管理工具（如 HashiCorp Vault）。

**误区二："ConfigMap 更新后所有 Pod 都会自动获取新配置"**

只有通过 Volume 挂载的文件会自动更新。环境变量和 subPath 挂载需要重启 Pod。

**误区三："把所有配置都放在一个 ConfigMap 里"**

应该按用途分离 ConfigMap。应用配置、Nginx 配置、日志配置应该各自独立，方便管理和更新。

## 工程建议

1. **敏感信息用 Secret，非敏感用 ConfigMap**：密码、密钥、证书用 Secret
2. **优先用 Volume 挂载而非环境变量**：支持热更新，且不会出现在 `kubectl describe` 输出中
3. **不要把 Secret 提交到 Git**：使用 sealed-secrets 或 external-secrets-operator 管理
4. **配置和镜像分离**：同一镜像通过不同的 ConfigMap 适配不同环境
5. **使用 `immutable: true`**：对于不需要更新的 ConfigMap/Secret，设置不可变可以提升性能

## 小结

- ConfigMap 存储非敏感配置，Secret 存储敏感信息
- 两种注入方式：环境变量（不支持热更新）和 Volume 挂载（支持热更新）
- Secret 的 Base64 编码不是加密，需要额外安全措施
- 私有镜像通过 imagePullSecrets 配置认证
- 配置应该与镜像分离，支持多环境部署

## 练习

### 练习一：ConfigMap 实践

创建一个包含 Nginx 配置的 ConfigMap，并挂载到 Pod 中：
1. 创建 ConfigMap 存储自定义 nginx.conf
2. 创建 Deployment 使用该 ConfigMap
3. 验证 Nginx 使用了自定义配置
4. 更新 ConfigMap，验证热更新

### 练习二：Secret 管理

完成以下 Secret 操作：
1. 创建包含数据库凭据的 Secret
2. 通过环境变量注入到 Pod
3. 验证 Pod 内可以读取到正确的值

---

## 参考答案

### 练习一

**答案**：

```yaml
# 1. 创建 Nginx 配置 ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
data:
  default.conf: |
    server {
      listen 80;
      server_name localhost;
      location / {
        return 200 'Hello from custom Nginx config!';
        add_header Content-Type text/plain;
      }
    }
---
# 2. Deployment 使用 ConfigMap
apiVersion: apps/v1
kind: Deployment
metadata:
  name: custom-nginx
spec:
  replicas: 1
  selector:
    matchLabels:
      app: custom-nginx
  template:
    metadata:
      labels:
        app: custom-nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.25
          volumeMounts:
            - name: config-volume
              mountPath: /etc/nginx/conf.d
      volumes:
        - name: config-volume
          configMap:
            name: nginx-config
```

```bash
# 3. 验证
kubectl apply -f nginx-configmap.yaml
kubectl exec -it deploy/custom-nginx -- curl localhost
# 返回 "Hello from custom Nginx config!"

# 4. 热更新
kubectl edit configmap nginx-config
# 修改返回内容为 "Updated config!"
# 等待 60-90 秒
kubectl exec -it deploy/custom-nginx -- curl localhost
# 返回 "Updated config!"
```

### 练习二

**答案**：

```bash
# 1. 创建 Secret
kubectl create secret generic db-creds \
  --from-literal=username=dbadmin \
  --from-literal=password='MyS3cretDB!'

# 2. 验证
kubectl get secret db-creds -o yaml
# data 中的值是 base64 编码的

# 3. 创建使用 Secret 的 Pod
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: secret-test
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sleep', '3600']
      env:
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-creds
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-creds
              key: password
EOF

# 4. 验证
kubectl exec -it secret-test -- env | grep DB_
# DB_USERNAME=dbadmin
# DB_PASSWORD=MyS3cretDB!

# 清理
kubectl delete pod secret-test
```

**要点**：
- Secret 的值在 Pod 内是以明文环境变量存在的
- `kubectl describe pod` 会显示环境变量名但不显示 Secret 的值
- 生产环境应考虑用 Volume 挂载而非环境变量
