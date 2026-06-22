# Pod 深入

## 场景引入

你在 Stage 1 前几课已经知道 Pod 是 K8s 的最小调度单元，但对 Pod 的理解还停留在"一个容器包了一层"。当你的应用遇到这些问题时，你需要更深入地理解 Pod：

- 应用启动时需要先初始化数据库 schema，但主容器不知道什么时候初始化完成
- 应用需要一个日志收集 Sidecar，它和主容器共享日志文件
- 容器频繁重启，你想知道它到底是在启动时崩溃还是运行中崩溃
- 你希望在容器启动后给它一些预热时间，不要立刻把流量导进来

这些问题的答案都藏在 Pod 的高级特性中：Init Container、Sidecar、生命周期钩子、探针。

## 学习目标

1. 理解 Pod 的完整生命周期
2. 掌握 Init Container 的使用场景和配置
3. 理解 Sidecar 模式和多容器 Pod 的设计
4. 掌握 Liveness、Readiness、Startup 三种探针
5. 了解 Pod 的生命周期钩子（postStart、preStop）

## Pod 的生命周期

Pod 的生命周期可以用以下状态来描述：

```
Pending → Running → Succeeded/Failed
              ↓
          Unknown（Node 失联）
```

**Pending**：Pod 已被 API Server 接受，但还没有运行。可能的原因：镜像正在拉取、没有合适的 Node、等待 PVC 绑定。

**Running**：Pod 已经绑定到 Node，至少有一个容器正在运行。

**Succeeded**：Pod 中所有容器都已正常退出（退出码 0），常见于 Job/CronJob。

**Failed**：Pod 中至少有一个容器以非 0 退出码退出。

**Unknown**：无法获取 Pod 状态，通常是 Node 与 Control Plane 失联。

### Pod 阶段详细流程

```yaml
# 一个 Pod 从创建到运行的完整流程
apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  # 1. Init Containers 按顺序执行，全部成功后才启动主容器
  initContainers:
    - name: wait-for-db
      image: busybox:1.36
      command: ['sh', '-c', 'until nc -z mysql-service 3306; do sleep 2; done']
    - name: init-schema
      image: my-app:1.0
      command: ['python', 'manage.py', 'migrate']

  # 2. 主容器启动
  containers:
    - name: app
      image: my-app:1.0
      # 3. 启动后执行 postStart 钩子
      lifecycle:
        postStart:
          exec:
            command: ["/bin/sh", "-c", "echo started > /tmp/started"]
        preStop:
          exec:
            command: ["/bin/sh", "-c", "nginx -s quit; while pgrep nginx; do sleep 1; done"]

      # 4. Startup Probe：确认容器已启动完成
      startupProbe:
        httpGet:
          path: /healthz
          port: 8080
        failureThreshold: 30
        periodSeconds: 10

      # 5. Liveness Probe：容器还活着吗？
      livenessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 0
        periodSeconds: 10

      # 6. Readiness Probe：容器准备好接收流量了吗？
      readinessProbe:
        httpGet:
          path: /ready
          port: 8080
        periodSeconds: 5
```

## Init Container

Init Container 在主容器之前运行，用于执行初始化任务。关键特性：

- **按顺序执行**：多个 Init Container 依次运行，前一个成功后才运行下一个
- **必须全部成功**：任何一个 Init Container 失败，Pod 就会重启
- **不接受探针**：Init Container 没有 readiness/liveness probe
- **资源独立**：Init Container 的资源请求独立于主容器

### 使用场景

**等待依赖服务就绪**：
```yaml
initContainers:
  - name: wait-for-redis
    image: busybox:1.36
    command: ['sh', '-c', 'until nc -z redis-service 6379; do echo waiting; sleep 2; done']
```

**执行数据库迁移**：
```yaml
initContainers:
  - name: db-migrate
    image: my-app:1.0
    command: ['python', 'manage.py', 'migrate']
    env:
      - name: DATABASE_URL
        valueFrom:
          secretKeyRef:
            name: db-secret
            key: url
```

**生成配置文件**：
```yaml
initContainers:
  - name: config-generator
    image: busybox:1.36
    command: ['sh', '-c', 'envsubst < /tmp/template.conf > /etc/app/config.conf']
    volumeMounts:
      - name: config-volume
        mountPath: /etc/app
```

## Sidecar 模式

Sidecar 是一种多容器 Pod 模式：一个辅助容器伴随主容器运行，为主容器提供额外能力。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-with-logging
spec:
  containers:
    # 主容器：Web 应用
    - name: web
      image: nginx:1.25
      volumeMounts:
        - name: shared-logs
          mountPath: /var/log/nginx

    # Sidecar：日志收集器
    - name: log-collector
      image: fluentd:v1.16
      volumeMounts:
        - name: shared-logs
          mountPath: /var/log/nginx
          readOnly: true

    # Sidecar：日志轮转
    - name: log-rotator
      image: busybox:1.36
      command:
        - /bin/sh
        - -c
        - |
          while true; do
            find /var/log/nginx -name "*.log" -size +100M -exec truncate -s 0 {} \;
            sleep 3600
          done
      volumeMounts:
        - name: shared-logs
          mountPath: /var/log/nginx

  volumes:
    - name: shared-logs
      emptyDir: {}
```

常见的 Sidecar 场景：
- 日志收集（Fluentd、Filebeat）
- 服务网格代理（Envoy、Istio-proxy）
- 配置热更新（config-watcher）
- 代理和网关（Nginx 反向代理）

## 探针（Probes）

K8s 提供三种探针来检测容器状态：

### Liveness Probe（存活探针）

回答的问题：**容器还活着吗？**

如果 Liveness Probe 失败，kubelet 会杀掉容器并重启它（取决于 restartPolicy）。

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 15    # 容器启动后等待 15 秒再开始探测
  periodSeconds: 10          # 每 10 秒探测一次
  timeoutSeconds: 3          # 探测超时时间
  failureThreshold: 3        # 连续失败 3 次才认为不健康
```

三种探测方式：
```yaml
# HTTP 探测
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
    httpHeaders:
      - name: X-Custom-Header
        value: liveness

# TCP 探测（适用于数据库等非 HTTP 服务）
livenessProbe:
  tcpSocket:
    port: 3306

# 命令探测
livenessProbe:
  exec:
    command:
      - cat
      - /tmp/healthy
```

### Readiness Probe（就绪探针）

回答的问题：**容器准备好接收请求了吗？**

Readiness Probe 失败时，Pod 的 IP 会从 Service 的 Endpoint 列表中移除，流量不再转发到这个 Pod。容器不会被重启。

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  periodSeconds: 5
  failureThreshold: 3
```

典型使用场景：
- 应用启动后需要加载大量缓存数据
- 应用暂时过载，需要暂停接收流量
- 依赖的外部服务暂时不可用

### Startup Probe（启动探针）

回答的问题：**容器启动完成了吗？**

Startup Probe 专门解决"慢启动"问题。在 Startup Probe 成功之前，Liveness Probe 和 Readiness Probe 不会生效。

```yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30     # 允许失败 30 次
  periodSeconds: 10        # 每 10 秒检查一次
  # 总共允许 30 × 10 = 300 秒的启动时间
```

Startup Probe 的价值：不需要为了让慢启动应用通过 Liveness 检查而设置很长的 `initialDelaySeconds`。

## 生命周期钩子

### postStart

容器创建后立即执行。注意：postStart 和容器的 ENTRYPOINT 是异步执行的，不保证 postStart 在 ENTRYPOINT 之前完成。

```yaml
lifecycle:
  postStart:
    exec:
      command: ["/bin/sh", "-c", "echo 'Container started' > /tmp/started"]
```

### preStop

容器被终止之前执行。kubelet 发送 SIGTERM 给容器之前会先执行 preStop。

```yaml
lifecycle:
  preStop:
    exec:
      command:
        - /bin/sh
        - -c
        - |
          # 优雅关闭：停止接收新请求，等待现有请求完成
          nginx -s quit
          while pgrep nginx; do sleep 1; done
```

preStop 的典型用途：
- 优雅关闭 HTTP 服务器（停止接收新连接，等待现有连接完成）
- 从注册中心注销服务
- 刷新缓冲区中的数据到磁盘

## 常见误区

**误区一："Liveness Probe 失败就会重启容器"**

Liveness Probe 连续失败 `failureThreshold` 次才会重启。默认 failureThreshold 是 3，所以不会因为一次超时就重启。

**误区二："Init Container 和 postStart 是一样的"**

Init Container 按顺序执行且必须全部成功，适合初始化任务。postStart 和主容器并行执行，不保证执行顺序，适合非关键的启动后操作。

**误区三："多容器 Pod 就是把不相关的容器放在一起"**

多容器 Pod 应该遵循"共同调度、共同生命周期"原则。容器之间应该有明确的协作关系（共享网络、共享存储、共享生命周期）。

## 工程建议

1. **所有生产 Pod 都应该配置 Readiness Probe**：避免将流量导到未准备好的容器
2. **为慢启动应用配置 Startup Probe**：而不是调大 Liveness Probe 的 initialDelaySeconds
3. **使用 preStop 实现优雅关闭**：在容器被杀之前完成清理工作
4. **Init Container 用于必须完成的初始化**：Sidecar 用于持续运行的辅助任务
5. **不要在 Liveness Probe 中检查依赖服务**：Liveness 只检查自身是否存活，依赖检查交给 Readiness

## 小结

- Pod 生命周期：Pending → Running → Succeeded/Failed
- Init Container 按顺序执行，用于初始化任务
- Sidecar 模式让辅助容器与主容器协作
- 三种探针：Startup（启动完成）、Liveness（存活）、Readiness（就绪）
- 生命周期钩子：postStart（启动后）、preStop（终止前）

## 练习

### 练习一：探针设计

为以下应用设计合适的探针方案（选择探针类型、探测方式、参数配置）：

1. 一个 Java Spring Boot 应用，启动需要 60 秒，启动后需要预热缓存
2. 一个 Redis 数据库
3. 一个 Python Flask API，依赖 PostgreSQL

### 练习二：Init Container 设计

为一个 Node.js Web 应用设计 Init Container 方案，要求：
1. 等待 PostgreSQL 就绪
2. 等待 Redis 就绪
3. 执行数据库 migration

写出完整的 Pod YAML。

---

## 参考答案

### 练习一

**思路**：根据应用特点选择探针类型和参数。

**答案**：

**1. Java Spring Boot 应用**：
```yaml
# 启动慢，需要 Startup Probe
startupProbe:
  httpGet:
    path: /actuator/health
    port: 8080
  failureThreshold: 30
  periodSeconds: 10
  # 允许 300 秒启动时间

# 启动后预热缓存，需要 Readiness Probe
readinessProbe:
  httpGet:
    path: /actuator/health/readiness
    port: 8080
  periodSeconds: 5
  failureThreshold: 3

# 存活检查
livenessProbe:
  httpGet:
    path: /actuator/health/liveness
    port: 8080
  periodSeconds: 15
  failureThreshold: 3
```

**2. Redis 数据库**：
```yaml
# TCP 探测更适合数据库
startupProbe:
  tcpSocket:
    port: 6379
  failureThreshold: 30
  periodSeconds: 5

livenessProbe:
  tcpSocket:
    port: 6379
  periodSeconds: 10

# 或者用命令探测（更精确）
livenessProbe:
  exec:
    command: ['redis-cli', 'ping']
  periodSeconds: 10
```

**3. Python Flask API**：
```yaml
startupProbe:
  httpGet:
    path: /health
    port: 5000
  failureThreshold: 30
  periodSeconds: 5

readinessProbe:
  httpGet:
    path: /ready
    port: 5000
  periodSeconds: 5
  # /ready 端点应该检查 PostgreSQL 连接

livenessProbe:
  httpGet:
    path: /health
    port: 5000
  periodSeconds: 10
  # /health 端点只检查自身，不检查数据库
```

**要点**：
- 慢启动应用用 Startup Probe，不要用大的 initialDelaySeconds
- Readiness 检查依赖，Liveness 只检查自身
- 数据库用 TCP 或命令探测，不用 HTTP

### 练习二

**思路**：三个 Init Container 按顺序执行，分别等待 PostgreSQL、Redis 和执行 migration。

**答案**：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-app
spec:
  initContainers:
    - name: wait-for-postgres
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          until nc -z postgres-service 5432; do
            echo "Waiting for PostgreSQL..."
            sleep 2
          done
          echo "PostgreSQL is ready"

    - name: wait-for-redis
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          until nc -z redis-service 6379; do
            echo "Waiting for Redis..."
            sleep 2
          done
          echo "Redis is ready"

    - name: db-migrate
      image: node:20-slim
      command: ['npx', 'prisma', 'migrate', 'deploy']
      workingDir: /app
      volumeMounts:
        - name: app-code
          mountPath: /app
      env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url

  containers:
    - name: app
      image: node:20-slim
      command: ['node', 'server.js']
      volumeMounts:
        - name: app-code
          mountPath: /app

  volumes:
    - name: app-code
      configMap:
        name: app-code
```

**要点**：
- Init Container 按顺序执行，数据库和 Redis 可以并行等待
- 使用 `nc -z` 检查端口可达性是最简单的等待方式
- Migration 必须在数据库就绪后执行，所以放在第三个
