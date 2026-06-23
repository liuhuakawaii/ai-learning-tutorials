# 部署模式

> 部署不是"把代码扔上去"。蓝绿部署、金丝雀发布、自动回滚——这些模式让你部署更安全、出问题能快速恢复。

## 直接部署（Rolling Update）

最简单的部署方式：逐步替换旧版本的实例。

```yaml
- name: Deploy
  run: |
    kubectl set image deployment/my-app \
      app=my-registry/my-app:${{ github.sha }}
    kubectl rollout status deployment/my-app --timeout=300s
```

**优点**：简单，不需要额外基础设施。
**缺点**：回滚慢，新旧版本混在一起可能有兼容性问题。

## 蓝绿部署

同时运行两个完整环境：蓝色（当前版本）和绿色（新版本）。切换流量到绿色，如果出问题，切回蓝色。

```yaml
jobs:
  deploy-green:
    runs-on: ubuntu-latest
    environment: production-green
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to green environment
        run: |
          kubectl set image deployment/my-app-green \
            app=my-registry/my-app:${{ github.sha }}
          kubectl rollout status deployment/my-app-green --timeout=300s

      - name: Run smoke tests
        run: |
          GREEN_URL=$(kubectl get svc my-app-green -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
          curl -sf "http://$GREEN_URL/health" || exit 1

  switch-traffic:
    needs: deploy-green
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Switch traffic to green
        run: |
          kubectl patch svc my-app -p '{"spec":{"selector":{"version":"green"}}}'

      - name: Verify
        run: |
          sleep 30
          curl -sf https://example.com/health || exit 1

  rollback:
    if: failure()
    needs: switch-traffic
    runs-on: ubuntu-latest
    steps:
      - name: Switch traffic back to blue
        run: |
          kubectl patch svc my-app -p '{"spec":{"selector":{"version":"blue"}}}'
```

**优点**：回滚秒级（切回旧环境），新旧版本完全隔离。
**缺点**：需要双倍资源，数据库迁移需要兼容两个版本。

## 金丝雀发布

逐步把流量从旧版本切到新版本：5% → 25% → 50% → 100%。

```yaml
jobs:
  deploy-canary:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy canary (5% traffic)
        run: |
          kubectl apply -f - <<EOF
          apiVersion: networking.istio.io/v1beta1
          kind: VirtualService
          spec:
            http:
              - route:
                  - destination:
                      host: my-app
                      subset: stable
                    weight: 95
                  - destination:
                      host: my-app
                      subset: canary
                    weight: 5
          EOF

      - name: Monitor canary
        run: |
          sleep 300  # 等 5 分钟
          # 检查错误率
          ERROR_RATE=$(curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{version='canary',status=~'5..'}[5m])" | jq '.data.result[0].value[1]')
          if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
            echo "Error rate too high: $ERROR_RATE"
            exit 1
          fi

  promote:
    needs: deploy-canary
    runs-on: ubuntu-latest
    steps:
      - name: Promote to 100%
        run: |
          kubectl apply -f - <<EOF
          apiVersion: networking.istio.io/v1beta1
          kind: VirtualService
          spec:
            http:
              - route:
                  - destination:
                      host: my-app
                      subset: canary
                    weight: 100
          EOF
```

**优点**：风险最小，逐步验证。
**缺点**：需要流量管理工具（Istio、Linkerd、Nginx），配置复杂。

## 自动回滚

### 基于健康检查的回滚

```yaml
- name: Deploy
  id: deploy
  run: |
    kubectl set image deployment/my-app \
      app=my-registry/my-app:${{ github.sha }}
    
    # 等待部署完成
    if ! kubectl rollout status deployment/my-app --timeout=300s; then
      echo "Deployment failed, rolling back..."
      kubectl rollout undo deployment/my-app
      exit 1
    fi

- name: Post-deploy health check
  run: |
    for i in $(seq 1 10); do
      if curl -sf https://example.com/health; then
        echo "Health check passed"
        exit 0
      fi
      sleep 10
    done
    echo "Health check failed, rolling back..."
    kubectl rollout undo deployment/my-app
    exit 1
```

### 基于指标的回滚

```yaml
- name: Monitor after deploy
  run: |
    sleep 300  # 等 5 分钟
    
    # 检查错误率
    ERROR_RATE=$(curl -s "http://prometheus:9090/api/v1/query?query=rate(http_errors_total[5m])" | jq '.data.result[0].value[1]')
    
    if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
      echo "Error rate too high: $ERROR_RATE"
      kubectl rollout undo deployment/my-app
      exit 1
    fi
```

## 数据库迁移与部署

部署新版本时，数据库 schema 可能需要迁移。这是最危险的部分。

### 兼容性原则

1. **先加后删**：新版本先添加新列，旧版本还能用旧列。下个版本再删旧列
2. **向后兼容**：新代码必须能处理旧数据
3. **向前兼容**：旧代码必须能处理新数据（至少在迁移期间）

### 部署流程

```
1. 运行数据库迁移（向后兼容的迁移）
2. 部署新版本代码
3. 验证新版本正常工作
4. （下一个版本）清理旧的数据库列/表
```

```yaml
jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: ./migrate.sh up

  deploy:
    needs: migrate
    runs-on: ubuntu-latest
    steps:
      - run: kubectl set image deployment/my-app ...

  rollback:
    if: failure()
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - run: kubectl rollout undo deployment/my-app
      # 注意：不回滚数据库迁移！向后兼容的迁移不需要回滚
```

## 练习

### 练习一：设计蓝绿部署

为一个 Kubernetes 上的 Node.js 应用设计蓝绿部署流程，要求：
1. 部署新版本到绿色环境
2. 运行冒烟测试
3. 切换流量到绿色环境
4. 如果冒烟测试或流量切换后健康检查失败，自动回滚
5. 保留蓝色环境 24 小时，以便快速回滚

---

## 参考答案

```yaml
name: Blue-Green Deploy

on:
  workflow_dispatch:
  push:
    branches: [main]

env:
  APP_NAME: my-app
  REGISTRY: ghcr.io/${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ github.sha }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ env.REGISTRY }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  determine-target:
    runs-on: ubuntu-latest
    outputs:
      target: ${{ steps.determine.outputs.target }}
      current: ${{ steps.determine.outputs.current }}
    steps:
      - name: Determine which environment to deploy
        id: determine
        run: |
          CURRENT=$(kubectl get svc ${{ env.APP_NAME }} -o jsonpath='{.spec.selector.slot}' 2>/dev/null || echo "blue")
          if [ "$CURRENT" = "blue" ]; then
            echo "target=green" >> "$GITHUB_OUTPUT"
            echo "current=blue" >> "$GITHUB_OUTPUT"
          else
            echo "target=blue" >> "$GITHUB_OUTPUT"
            echo "current=green" >> "$GITHUB_OUTPUT"
          fi

  deploy-target:
    needs: [build, determine-target]
    runs-on: ubuntu-latest
    environment: production-${{ needs.determine-target.outputs.target }}
    env:
      TARGET: ${{ needs.determine-target.outputs.target }}
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to ${{ env.TARGET }}
        run: |
          kubectl set image deployment/${{ env.APP_NAME }}-${{ env.TARGET }} \
            app=${{ env.REGISTRY }}:${{ needs.build.outputs.image-tag }}
          kubectl rollout status deployment/${{ env.APP_NAME }}-${{ env.TARGET }} --timeout=300s

      - name: Smoke test
        run: |
          TARGET_IP=$(kubectl get svc ${{ env.APP_NAME }}-${{ env.TARGET }} \
            -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
          for i in $(seq 1 5); do
            if curl -sf "http://$TARGET_IP/health"; then
              echo "Smoke test passed"
              exit 0
            fi
            sleep 5
          done
          echo "Smoke test failed"
          exit 1

  switch-traffic:
    needs: [determine-target, deploy-target]
    runs-on: ubuntu-latest
    environment: production
    env:
      TARGET: ${{ needs.determine-target.outputs.target }}
    steps:
      - name: Switch traffic to ${{ env.TARGET }}
        run: |
          kubectl patch svc ${{ env.APP_NAME }} \
            -p '{"spec":{"selector":{"slot":"${{ env.TARGET }}"}}}'

      - name: Post-switch health check
        run: |
          sleep 30
          for i in $(seq 1 5); do
            if curl -sf https://example.com/health; then
              echo "Health check passed"
              exit 0
            fi
            sleep 10
          done
          echo "Health check failed"
          exit 1

  rollback:
    if: failure()
    needs: [switch-traffic, determine-target]
    runs-on: ubuntu-latest
    steps:
      - name: Rollback to ${{ needs.determine-target.outputs.current }}
        run: |
          kubectl patch svc ${{ env.APP_NAME }} \
            -p '{"spec":{"selector":{"slot":"${{ needs.determine-target.outputs.current }}"}}}'
```
