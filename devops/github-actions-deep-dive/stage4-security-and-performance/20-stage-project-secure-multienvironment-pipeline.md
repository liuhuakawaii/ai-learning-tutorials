# 阶段实战：安全的多环境部署流水线

> 把 OIDC、Secret 管理、环境保护规则和性能优化组合起来，设计一个生产级的多环境部署流水线。

## 目标

一个 Node.js 应用的完整部署流水线：
1. PR 时：运行测试，部署预览环境
2. 合并到 main：自动部署到 staging
3. Staging 验证通过后：人工审批部署到 production
4. 所有云服务认证使用 OIDC，不存长期凭证
5. 生产部署失败自动回滚

## 前置准备

### AWS 资源

```
S3 Buckets:
  - my-app-staging
  - my-app-production
  - my-app-pr-preview

CloudFront Distributions:
  - staging.example.com
  - example.com
  - pr-{number}.preview.example.com
```

### GitHub 环境

```
Environments:
  - preview (无保护规则)
  - staging (无保护规则)
  - production (ops-team 审批, 仅 main 分支)
```

### OIDC 配置

```
IAM Roles:
  - GitHubActionsPreviewRole (S3 写入 preview bucket)
  - GitHubActionsStagingRole (S3 写入 staging bucket, CloudFront 失效)
  - GitHubActionsProductionRole (S3 写入 production bucket, CloudFront 失效)
```

## 完整 Workflow

```yaml
name: Deploy Pipeline

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, closed]
  workflow_dispatch:
    inputs:
      deploy-production:
        description: 'Deploy to production'
        type: boolean
        default: false

permissions:
  id-token: write
  contents: read
  pull-requests: write

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ==================== 测试阶段 ====================
  test:
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
          retention-days: 7

  # ==================== 构建阶段 ====================
  build:
    needs: test
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - id: version
        run: |
          VERSION=$(node -p "require('./package.json').version")
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"

      - run: npm run build

      - uses: actions/upload-artifact@v4
        with:
          name: build-${{ github.sha }}
          path: dist/
          retention-days: 3

  # ==================== PR 预览部署 ====================
  deploy-preview:
    needs: build
    if: github.event_name == 'pull_request' && github.event.action != 'closed'
    runs-on: ubuntu-latest
    environment:
      name: preview
      url: https://pr-${{ github.event.number }}.preview.example.com
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          name: build-${{ github.sha }}
          path: dist/

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_PREVIEW_ROLE_ARN }}
          aws-region: us-east-1

      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://my-app-pr-preview/pr-${{ github.event.number }}/ \
            --delete

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `Preview deployed: https://pr-${{ github.event.number }}.preview.example.com`
            })

  cleanup-preview:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_PREVIEW_ROLE_ARN }}
          aws-region: us-east-1

      - name: Cleanup S3
        run: |
          aws s3 rm s3://my-app-pr-preview/pr-${{ github.event.number }}/ \
            --recursive

  # ==================== Staging 部署 ====================
  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          name: build-${{ github.sha }}
          path: dist/

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_STAGING_ROLE_ARN }}
          aws-region: us-east-1

      - name: Deploy to S3
        run: aws s3 sync dist/ s3://my-app-staging/ --delete

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ vars.STAGING_CF_DIST_ID }} \
            --paths "/*"

      - name: Health check
        run: |
          for i in $(seq 1 10); do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://staging.example.com/health)
            if [ "$STATUS" = "200" ]; then
              echo "Health check passed"
              exit 0
            fi
            echo "Attempt $i: Status $STATUS"
            sleep 10
          done
          echo "Health check failed"
          exit 1

      - name: E2E tests on staging
        run: |
          STAGING_URL=https://staging.example.com npm run test:e2e

  # ==================== Production 部署 ====================
  deploy-production:
    needs: [build, deploy-staging]
    if: >-
      github.ref == 'refs/heads/main' &&
      (github.event_name == 'push' || github.event.inputs.deploy-production == 'true')
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://example.com
    steps:
      - uses: actions/checkout@v4

      - name: Get current version
        id: current
        run: |
          CURRENT=$(aws s3 cp s3://my-app-production/VERSION - 2>/dev/null || echo "none")
          echo "version=$CURRENT" >> "$GITHUB_OUTPUT"

      - uses: actions/download-artifact@v4
        with:
          name: build-${{ github.sha }}
          path: dist/

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_PRODUCTION_ROLE_ARN }}
          aws-region: us-east-1

      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://my-app-production/ --delete
          echo "${{ needs.build.outputs.version }}" | aws s3 cp - s3://my-app-production/VERSION

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ vars.PRODUCTION_CF_DIST_ID }} \
            --paths "/*"

      - name: Health check
        run: |
          for i in $(seq 1 15); do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://example.com/health)
            if [ "$STATUS" = "200" ]; then
              echo "Health check passed"
              exit 0
            fi
            echo "Attempt $i: Status $STATUS"
            sleep 10
          done
          echo "Health check failed"
          exit 1

      - name: Rollback on failure
        if: failure()
        run: |
          echo "Rolling back to ${{ steps.current.outputs.version }}"
          # 实际回滚逻辑：恢复上一个版本的 S3 内容
          # aws s3 sync s3://my-app-production-backup/${{ steps.current.outputs.version }}/ s3://my-app-production/ --delete
```

## 设计决策复盘

### 决策一：为什么用三个不同的 IAM Role？

每个环境一个 Role，权限隔离：
- Preview Role 只能写 preview bucket
- Staging Role 只能写 staging bucket
- Production Role 只能写 production bucket

即使 preview 的 token 泄露，也无法影响 production。

### 决策二：为什么 staging 部署后跑 E2E 测试？

E2E 测试在真实环境上运行，比 mock 测试更可靠。如果 E2E 失败，production 部署不会开始。

### 决策三：为什么记录当前版本？

部署失败时需要回滚。记录当前版本可以快速恢复到上一个版本。

### 决策四：为什么 health check 等 15 次？

CloudFront 缓存失效需要时间。15 次 × 10 秒 = 150 秒，足够等缓存传播。

## 练习

### 练习一：添加通知

在上面的流水线基础上，添加以下通知：
1. PR 预览部署成功：在 PR 里评论预览链接
2. Staging 部署成功：发送 Slack 通知
3. Production 部署成功/失败：发送 Slack 通知并 @ops-team

---

## 参考答案

```yaml
  # 在 deploy-preview 的最后添加
  - name: Comment PR
    uses: actions/github-script@v7
    with:
      script: |
        github.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.issue.number,
          body: `✅ Preview deployed: https://pr-${{ github.event.number }}.preview.example.com\n\nCommit: ${{ github.sha }}`
        })

  # 添加通知 Job
  notify:
    needs: [deploy-staging, deploy-production]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Determine status
        id: status
        run: |
          if [ "${{ needs.deploy-production.result }}" = "success" ]; then
            echo "message=✅ Production deployed v${{ needs.build.outputs.version }}" >> "$GITHUB_OUTPUT"
          elif [ "${{ needs.deploy-production.result }}" = "failure" ]; then
            echo "message=❌ Production deploy failed for v${{ needs.build.outputs.version }}" >> "$GITHUB_OUTPUT"
          elif [ "${{ needs.deploy-staging.result }}" = "success" ]; then
            echo "message=✅ Staging deployed v${{ needs.build.outputs.version }}, awaiting production approval" >> "$GITHUB_OUTPUT"
          else
            echo "message=ℹ️ Pipeline status: staging=${{ needs.deploy-staging.result }}, production=${{ needs.deploy-production.result }}" >> "$GITHUB_OUTPUT"
          fi

      - name: Slack notification
        if: vars.SLACK_WEBHOOK_URL != ''
        run: |
          curl -s -X POST "${{ vars.SLACK_WEBHOOK_URL }}" \
            -H 'Content-Type: application/json' \
            -d "{
              \"text\": \"${{ steps.status.outputs.message }}\",
              \"channel\": \"#deployments\"
            }"
```
