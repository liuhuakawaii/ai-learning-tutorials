# OIDC 与云服务认证

> 把 AWS Access Key 存在 GitHub Secrets 里？可以，但不安全。Key 泄露了怎么办？轮换 Key 要改多少仓库？OIDC 让 GitHub Actions 直接向云服务证明"我是谁"，不需要长期凭证。

## 为什么需要 OIDC

传统方式：

```
GitHub Secrets (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    → Workflow 读取
    → 调用 AWS API
```

问题：
- 长期凭证存在 GitHub 里，泄露风险
- Key 轮换要改所有用到它的仓库
- 无法精细控制哪些 workflow 能访问哪些资源

OIDC 方式：

```
GitHub Actions (OIDC Provider)
    → 向 AWS 请求临时凭证（STS AssumeRole）
    → 用临时凭证调用 AWS API
```

优势：
- 没有长期凭证
- 临时凭证自动过期
- 可以按仓库、分支、环境精细控制权限

## OIDC 的工作原理

```
1. Workflow 请求 OIDC Token
   ↓
2. GitHub 签发 JWT Token（包含仓库、分支、环境等信息）
   ↓
3. Workflow 用 JWT Token 向 AWS STS 请求临时凭证
   ↓
4. AWS 验证 JWT Token（检查 trust policy）
   ↓
5. AWS 返回临时 Access Key + Secret Key + Session Token
   ↓
6. Workflow 用临时凭证访问 AWS 资源
```

## 配置 AWS OIDC

### 步骤一：创建 OIDC Provider

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

`thumbprint` 是 GitHub OIDC Provider 的证书指纹。可以用以下命令获取：

```bash
openssl s_client -showcerts -servername token.actions.githubusercontent.com \
  -connect token.actions.githubusercontent.com:443 < /dev/null 2>/dev/null \
  | openssl x509 -fingerprint -noout
```

### 步骤二：创建 IAM Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:my-org/my-repo:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

`Condition` 限制了：
- 只有 `my-org/my-repo` 仓库能 assume 这个 role
- 只有 `main` 分支的 push 事件能 assume

### 步骤三：在 Workflow 中使用

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT_ID:role/GitHubActionsRole
          aws-region: us-east-1

      - name: Deploy to S3
        run: aws s3 sync dist/ s3://my-bucket/
```

`permissions.id-token: write` 是必须的——它允许 workflow 请求 OIDC token。

## 条件控制

### 按仓库

```json
"StringLike": {
  "token.actions.githubusercontent.com:sub": "repo:my-org/*"
}
```

### 按分支

```json
"StringLike": {
  "token.actions.githubusercontent.com:sub": "repo:my-org/my-repo:ref:refs/heads/main"
}
```

### 按环境

```json
"StringLike": {
  "token.actions.githubusercontent.com:sub": "repo:my-org/my-repo:environment:production"
}
```

### 按 PR（pull_request 事件）

```json
"StringLike": {
  "token.actions.githubusercontent.com:sub": "repo:my-org/my-repo:pull_request"
}
```

### 组合条件

```json
"Condition": {
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
  },
  "StringLike": {
    "token.actions.githubusercontent.com:sub": [
      "repo:my-org/my-repo:ref:refs/heads/main",
      "repo:my-org/my-repo:environment:production"
    ]
  }
}
```

## 配置 GCP OIDC

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
          service_account: github-actions@PROJECT_ID.iam.gserviceaccount.com

      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud storage cp dist/ gs://my-bucket/
```

GCP 用 Workload Identity Federation，配置步骤更多但原理相同。

## 配置 Azure OIDC

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - run: az storage blob upload ...
```

Azure 需要先在 Azure AD 中创建 App Registration 和 Federated Credential。

## 一个真实的 OIDC 问题

某团队配置了 OIDC，但 workflow 报错 `Not authorized to perform sts:AssumeRoleWithWebIdentity`。

排查过程：
1. 检查 trust policy——看起来没问题
2. 检查 OIDC Provider 的 thumbprint——匹配
3. 检查 workflow 的 `permissions`——有 `id-token: write`
4. 检查 JWT token 的 `sub` 字段——发现不对

根因：他们用的是 `pull_request` 事件，但 trust policy 只允许 `ref:refs/heads/main`。`pull_request` 的 `sub` 是 `repo:org/repo:pull_request`，不匹配。

解决方案：在 trust policy 里添加 PR 的条件，或者只在 push 事件下使用 OIDC。

## 练习

### 练习一：设计 OIDC 权限模型

为以下场景设计 AWS OIDC 配置：
1. `my-org/frontend` 仓库：只允许部署到 S3（只读 bucket）
2. `my-org/backend` 仓库：允许部署到 ECS（需要 ECS 和 ECR 权限）
3. 只有 `main` 分支和 `production` 环境能 assume 部署 role
4. PR 只能 assume 只读 role（比如读取 S3 配置）

要求：
- 写出 IAM Role 的 trust policy
- 写出 workflow 的 permissions 配置

---

## 参考答案

### IAM Trust Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "FrontendDeploy",
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:my-org/frontend:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

### Workflow 配置

```yaml
# frontend/.github/workflows/deploy.yml
name: Deploy Frontend
on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT_ID:role/FrontendDeployRole
          aws-region: us-east-1
      - run: aws s3 sync dist/ s3://frontend-bucket/
```

**要点**：
- 每个仓库对应一个 IAM Role，最小权限
- `environment: production` 配合 GitHub 环境保护规则
- PR 使用不同的 workflow，assume 只读 role
