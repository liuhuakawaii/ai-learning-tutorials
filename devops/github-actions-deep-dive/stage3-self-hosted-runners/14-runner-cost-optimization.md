# Runner 成本优化

> 自托管 Runner 的成本不只是机器钱。还有维护时间、网络流量、存储、以及因配置不当导致的资源浪费。这一课讲怎么把钱花在刀刃上。

## 成本构成

### 直接成本
- **计算**：云服务器或物理机的费用
- **存储**：Runner 磁盘、缓存、Docker 镜像
- **网络**：出站流量、跨区域流量

### 隐性成本
- **维护时间**：更新 Runner、处理故障、扩容缩容
- **构建时间**：Runner 配置差导致构建慢，浪费开发者时间
- **闲置成本**：Runner 没有 Job 时仍然在消耗资源

## Spot 实例

Spot 实例（AWS 的叫法，GCP 叫 Preemptible，Azure 叫 Spot VM）价格是按需实例的 60-90% 折扣，但可能被随时回收。

### 适合 Spot 的场景

- CI 测试（中断了重跑就行）
- 开发环境构建
- 非紧急的批量任务

### 不适合 Spot 的场景

- 生产环境部署（中断会导致部署不完整）
- 长时间运行的编译任务（中断后从头开始）
- 需要稳定网络连接的任务

### 在 ARC 中使用 Spot

```yaml
apiVersion: actions.summerwind.dev/v1alpha1
kind: RunnerDeployment
metadata:
  name: spot-runner
spec:
  template:
    spec:
      nodeSelector:
        node.kubernetes.io/instance-type: c5.xlarge
      tolerations:
        - key: "spot"
          operator: "Equal"
          value: "true"
          effect: "NoSchedule"
```

配合 Karpenter 或 Cluster Autoscaler，让 Runner Pod 调度到 Spot 节点上。

### Spot 中断处理

```yaml
# 在 Job 里添加 checkpoint 机制
steps:
  - name: Save cache
    if: always()
    run: |
      # 保存中间构建结果到远程缓存
      rsync -av build/cache/ s3://my-bucket/build-cache/
```

## 缓存策略

### 本地缓存

对于持久化的 Runner（不是 ephemeral），本地缓存最高效：

```yaml
steps:
  - uses: actions/cache@v4
    with:
      path: |
        ~/.npm
        node_modules
      key: npm-${{ hashFiles('package-lock.json') }}
```

但要注意：持久化 Runner 的缓存可能过期，需要定期清理。

### 远程缓存

对于 ephemeral Runner（如 ARC Pod），本地缓存在 Pod 销毁后丢失。用远程缓存：

```yaml
# npm 远程缓存
- run: |
    npm config set cache /cache/npm
    # /cache 是挂载的 PVC 或 NFS

# Docker 层缓存
- uses: docker/build-push-action@v5
  with:
    cache-from: type=s3,region=us-east-1,bucket=my-cache
    cache-to: type=s3,region=us-east-1,bucket=my-cache,mode=max
```

### 缓存命中率监控

```yaml
- uses: actions/cache@v4
  id: cache
  with:
    path: ~/.npm
    key: npm-${{ hashFiles('package-lock.json') }}

- name: Cache status
  run: |
    if [ "${{ steps.cache.outputs.cache-hit }}" = "true" ]; then
      echo "Cache hit!"
    else
      echo "Cache miss"
    fi
```

定期统计缓存命中率，如果太低，调整 key 策略。

## 构建合并

### 问题：频繁触发

开发者快速 push 多次，每次都触发 CI，浪费资源。

### 解决方案：并发控制

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

取消旧的运行，只保留最新的。但要注意：如果旧运行已经到了部署阶段，取消可能导致部署不完整。

### 解决方案：去抖

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# 或者用路径过滤
on:
  push:
    paths:
      - 'src/**'
      - '!**/*.md'
```

只在相关文件变化时触发。

## 资源配额

### Runner 级别

```yaml
resources:
  requests:
    cpu: "1"
    memory: "2Gi"
  limits:
    cpu: "2"
    memory: "4Gi"
```

`requests` 是保证获得的资源，`limits` 是最大可用资源。设太低会导致 OOMKilled，设太高会浪费。

### 集群级别

```yaml
# LimitRange：Pod 的默认资源限制
apiVersion: v1
kind: LimitRange
metadata:
  name: runner-limits
spec:
  limits:
    - default:
        cpu: "2"
        memory: "4Gi"
      defaultRequest:
        cpu: "1"
        memory: "2Gi"
      type: Container

# ResourceQuota：命名空间的资源总量
apiVersion: v1
kind: ResourceQuota
metadata:
  name: runner-quota
spec:
  hard:
    requests.cpu: "32"
    requests.memory: "64Gi"
    limits.cpu: "64"
    limits.memory: "128Gi"
```

## 成本分析

### 计算成本

```
月成本 = Runner 数量 × 单价 × 使用小时数 × 30

示例：
- 3 台 c5.xlarge（4 核 8GB）：$0.17/小时
- 工作时间 10 小时/天
- 月成本 = 3 × $0.17 × 10 × 30 = $153

如果用 Spot（70% 折扣）：
- 月成本 = $153 × 0.3 = $46
```

### 优化检查清单

1. **用 Spot 实例**：CI 构建适合 Spot
2. **自动扩缩容**：低峰期缩容到最小
3. **缓存优化**：提高缓存命中率，减少重复下载
4. **构建合并**：`cancel-in-progress` 避免浪费
5. **路径过滤**：文档改动不触发 CI
6. **资源限制**：Pod 资源不要过度配置
7. **镜像优化**：预装常用工具，减少安装时间
8. **并行优化**：lint 和 test 并行，减少总时间

## 练习

### 练习一：成本对比

计算以下两种方案的月成本，对比差异：

**方案 A：GitHub 托管 Runner**
- 3 个仓库，每个每天 10 次构建
- 每次构建 10 分钟
- 全部用 `ubuntu-latest`（免费额度 2000 分钟/月）

**方案 B：自托管 Runner（ARC + Spot）**
- 2 台 c5.xlarge Spot 实例
- 每天运行 10 小时
- Spot 价格 $0.05/小时

---

## 参考答案

### 方案 A

```
总构建时间 = 3 × 10 × 10 = 300 分钟/天
月总时间 = 300 × 30 = 9000 分钟
免费额度 = 2000 分钟
超出 = 7000 分钟
费用 = 7000 × $0.008/分钟 = $56/月
```

### 方案 B

```
月运行时间 = 2 × 10 × 30 = 600 小时
Spot 费用 = 600 × $0.05 = $30/月
加上存储和网络（估算）：$10/月
总费用 ≈ $40/月
```

### 对比

- 方案 A：$56/月，零维护，但有分钟数限制
- 方案 B：$40/月，需要维护，但没有分钟数限制
- 如果构建量翻倍：A = $136/月，B ≈ $40/月（机器够用的话）

**结论**：构建量越大，自托管越划算。但要算上维护成本（至少 2-4 小时/月的人力）。

**额外优化**：方案 B 可以用 `minReplicas: 0`，低峰期不运行 Runner，进一步降低成本。
