# 环境保护规则

> 代码合并到 main 就自动部署到生产？太危险了。环境保护规则让你在代码和生产之间加一道关卡：人工审批、等待时间、分支限制。

## 环境是什么

环境（Environment）是 GitHub Actions 里的一个概念，代表部署目标。它可以是：
- `development`：开发环境
- `staging`：预发布环境
- `production`：生产环境

环境的价值不在于名字，而在于关联的保护规则和 Secret。

## 创建环境

```
仓库 Settings → Environments → New environment
```

或者通过 API/Terraform 创建。

## 保护规则

### 审批（Required reviewers）

```yaml
# 环境配置
required_reviewers:
  - team-lead
  - devops-team
```

当 workflow 到达使用这个环境的 Job 时，会暂停并等待审批。审批人会在 GitHub 上收到通知。

审批配置：
- **Required reviewers**：必须审批的人或团队
- **Wait timer**：审批后的等待时间（0-43200 分钟）
- **Prevent self-review**：不允许自己审批自己的部署

### 分支限制

```
Deployment branches: Selected branches
  - main
  - release/*
```

只有指定的分支才能部署到这个环境。`feature/login` 分支的 workflow 如果尝试部署到 `production` 环境，会被跳过。

### 等待时间

```
Wait timer: 30 minutes
```

审批后还需要等待指定时间才执行。适合"给一个反悔的窗口"——审批后发现有问题，还有时间取消。

## 在 Workflow 中使用环境

```yaml
jobs:
  deploy-staging:
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh staging

  deploy-production:
    needs: deploy-staging
    environment:
      name: production
      url: https://my-app.com
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh production
```

`environment.url` 会在 GitHub UI 里显示一个链接，方便查看部署结果。

### 动态环境名

```yaml
environment:
  name: ${{ inputs.environment }}
```

配合 `workflow_dispatch`：

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]

jobs:
  deploy:
    environment: ${{ inputs.environment }}
```

## 环境与 Secret 的关系

环境级 Secret 只在使用该环境的 Job 中可用：

```yaml
jobs:
  deploy-staging:
    environment: staging  # 使用 staging 环境的 Secret
    steps:
      - run: echo "${{ secrets.DEPLOY_KEY }}"  # staging 的 key

  deploy-production:
    environment: production  # 使用 production 环境的 Secret
    steps:
      - run: echo "${{ secrets.DEPLOY_KEY }}"  # production 的 key
```

同名 Secret 在不同环境可以有不同值。这是实现"staging 和 production 用不同凭证"的标准方式。

## 典型配置模式

### 模式一：Staging 自动，Production 审批

```
环境配置：
  staging：
    保护规则：无
  production：
    保护规则：1 人审批，仅 main 分支
```

```yaml
jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/main'
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh staging

  deploy-production:
    needs: deploy-staging
    environment: production
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh production
```

Push 到 main 后，staging 自动部署，production 等待审批。

### 模式二：多阶段审批

```
环境配置：
  production：
    保护规则：
      - devops-team 审批
      - 等待 15 分钟
      - 仅 main 分支
```

流程：
1. 代码合并到 main
2. CI 通过
3. 部署到 staging
4. Staging 验证通过
5. 请求 production 部署
6. devops-team 审批
7. 等待 15 分钟
8. 部署到 production

### 模式三：PR 预览环境

```yaml
on:
  pull_request:

jobs:
  preview:
    environment:
      name: pr-${{ github.event.number }}
      url: https://pr-${{ github.event.number }}.preview.example.com
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./deploy-preview.sh
```

每个 PR 有独立的预览环境。PR 关闭后可以自动清理。

## 环境状态

GitHub 跟踪每个环境的部署状态：

```
仓库 → Environments → production → Deployments
```

可以看到：
- 谁在什么时候部署了什么
- 部署的 commit SHA
- 部署状态（成功/失败/进行中）
- 部署的 URL

### 部署状态标记

```yaml
steps:
  - name: Deploy
    id: deploy
    run: |
      ./deploy.sh
      echo "status=success" >> "$GITHUB_OUTPUT"

  - name: Mark deployment
    if: always()
    uses: actions/github-script@v7
    with:
      script: |
        const status = '${{ steps.deploy.outputs.status }}' === 'success' ? 'success' : 'failure';
        await github.rest.repos.createDeploymentStatus({
          owner: context.repo.owner,
          repo: context.repo.repo,
          deployment_id: context.payload.deployment?.id,
          state: status,
          environment_url: 'https://my-app.com'
        });
```

## 一个真实的环境保护问题

某团队配置了 production 环境审批，但审批人反映没有收到通知。

排查过程：
1. 检查环境配置——审批人设置正确
2. 检查 workflow——使用了 `environment: production`
3. 检查 GitHub 通知设置——审批人关闭了邮件通知
4. 检查 Slack 集成——没有配置

根因：GitHub 的审批通知通过以下渠道发送：
- GitHub 网站通知（铃铛图标）
- 邮件通知（如果开启了）
- GitHub Mobile 推送

如果审批人不经常看 GitHub 通知，会错过审批请求。

解决方案：
1. 配置 Slack 集成，在 Slack 频道发送审批通知
2. 使用 GitHub Teams 提醒，多人审批只要一人通过
3. 设置合理的等待时间，避免阻塞太久

## 练习

### 练习一：设计多环境部署流程

设计一个完整的多环境部署流程，要求：
1. PR 时：部署到 PR 预览环境
2. 合并到 main：自动部署到 staging
3. Staging 验证通过后：请求 production 部署
4. Production 部署需要 ops-team 审批，等待 10 分钟
5. Production 部署失败时自动回滚到上一个版本

---

## 参考答案

```yaml
name: Deploy Pipeline

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, closed]

jobs:
  # PR 预览环境
  preview:
    if: github.event_name == 'pull_request' && github.event.action != 'closed'
    environment:
      name: pr-${{ github.event.number }}
      url: https://pr-${{ github.event.number }}.preview.example.com
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./deploy-preview.sh ${{ github.event.number }}

  cleanup-preview:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    environment:
      name: pr-${{ github.event.number }}
    runs-on: ubuntu-latest
    steps:
      - run: ./cleanup-preview.sh ${{ github.event.number }}

  # Staging 部署
  deploy-staging:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment:
      name: staging
      url: https://staging.example.com
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./deploy.sh staging

  # Production 部署
  deploy-production:
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://example.com
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get current version
        id: current
        run: echo "version=$(cat VERSION)" >> "$GITHUB_OUTPUT"

      - name: Deploy
        id: deploy
        run: |
          ./deploy.sh production
          echo "status=success" >> "$GITHUB_OUTPUT"

      - name: Health check
        if: steps.deploy.outputs.status == 'success'
        run: |
          for i in $(seq 1 10); do
            if curl -sf https://example.com/health; then
              echo "Health check passed"
              exit 0
            fi
            sleep 10
          done
          echo "Health check failed"
          exit 1

      - name: Rollback on failure
        if: failure()
        run: |
          echo "Rolling back to ${{ steps.current.outputs.version }}"
          ./deploy.sh production --version ${{ steps.current.outputs.version }}
```

**环境配置**：
- `staging`：无保护规则
- `production`：需要 ops-team 审批，等待 10 分钟，仅 main 分支
