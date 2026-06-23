# Secret 管理

> Secret 是 CI/CD 里最敏感的东西。存错了、传错了、泄露了，后果都不小。这一课讲清楚 GitHub 的 Secret 机制，以及怎么用才安全。

## Secret 的三个层级

### 仓库级 Secret

只在一个仓库内可用。

```
仓库 Settings → Secrets and variables → Actions → New repository secret
```

```yaml
steps:
  - run: echo "Connecting to ${{ secrets.DATABASE_URL }}"
```

### 环境级 Secret

关联到特定环境（如 staging、production），可以有额外的保护规则。

```
仓库 Settings → Environments → production → Add secret
```

```yaml
jobs:
  deploy:
    environment: production
    steps:
      - run: echo "Deploying with ${{ secrets.DEPLOY_KEY }}"
```

环境级 Secret 的关键优势：
- 可以设置审批规则（必须有人批准才能用）
- 可以限制哪些分支能访问
- 不同环境的同名 Secret 可以有不同值

### 组织级 Secret

在组织级别定义，可以共享给多个仓库。

```
组织 Settings → Secrets and variables → Actions → New organization secret
```

可以选择：
- **All repositories**：所有仓库都能用
- **Selected repositories**：只有指定仓库能用

## Secret 的使用规则

### 日志遮蔽

GitHub 会自动遮蔽日志中出现的 Secret 值。但有几个重要细节：

1. **遮蔽发生在值匹配时**：如果 Secret 的值是 `abc`，日志里出现 `abc` 会被替换为 `***`
2. **空值不遮蔽**：如果 Secret 不存在或为空，不会遮蔽
3. **部分匹配不遮蔽**：如果日志打印 `prefix-abc-suffix`，其中 `abc` 是 Secret 值，整个 `abc` 会被遮蔽
4. **换行会破坏遮蔽**：如果 Secret 值包含换行符，遮蔽可能不完整

### 不能在 `if` 里使用

```yaml
# 错误！
if: secrets.MY_SECRET != ''

# 正确：用 vars 代替
if: vars.MY_FLAG == 'true'
```

Secret 不能用于条件判断。如果需要根据某个配置决定是否执行，用 `vars`（Variables）而不是 `secrets`。

### 不能传递给可重用 Workflow（隐式）

```yaml
# 错误！被调用的 workflow 看不到调用方的 secrets
jobs:
  ci:
    uses: ./.github/workflows/reusable-ci.yml

# 正确：显式传递
jobs:
  ci:
    uses: ./.github/workflows/reusable-ci.yml
    secrets:
      deploy-key: ${{ secrets.DEPLOY_KEY }}

# 或者透传所有
jobs:
  ci:
    uses: ./.github/workflows/reusable-ci.yml
    secrets: inherit
```

## Variables（非敏感配置）

对于不需要加密的配置，用 Variables 而不是 Secrets：

```
仓库 Settings → Secrets and variables → Actions → Variables
```

```yaml
steps:
  - run: echo "Deploying to ${{ vars.DEPLOY_TARGET }}"
  - if: vars.ENABLE_CACHE == 'true'
    uses: actions/cache@v4
```

Variables 和 Secrets 的区别：
- Variables 在日志里不会被遮蔽
- Variables 可以在 `if` 表达式里使用
- Variables 有仓库级、环境级、组织级三个层级
- 适合存放非敏感配置：feature flags、环境名称、版本号等

## Secret 的最佳实践

### 最小权限原则

```yaml
# 不好：一个 Secret 包含所有权限
env:
  AWS_CREDENTIALS: ${{ secrets.AWS_MASTER_CREDENTIALS }}

# 好：每个 Job 只需要的权限
env:
  S3_ACCESS_KEY: ${{ secrets.S3_UPLOAD_KEY }}
```

### 按环境隔离

```
# staging 环境
DEPLOY_KEY = staging-key-xxx

# production 环境
DEPLOY_KEY = prod-key-yyy
```

```yaml
jobs:
  deploy-staging:
    environment: staging
    steps:
      - run: ./deploy.sh  # 使用 staging 的 DEPLOY_KEY

  deploy-production:
    environment: production
    steps:
      - run: ./deploy.sh  # 使用 production 的 DEPLOY_KEY
```

### 定期轮换

GitHub 没有内置的 Secret 轮换机制。你需要：
1. 定期更新 Secret 值
2. 确保所有用到它的地方都能正常工作
3. 用 OIDC 代替长期凭证（第 16 课）

### 避免在日志中打印

```yaml
# 不好
- run: echo "API Key: ${{ secrets.API_KEY }}"

# 好：GitHub 会自动遮蔽，但最好避免
- run: |
    curl -H "Authorization: Bearer ${{ secrets.API_KEY }}" \
      https://api.example.com
```

## 大型组织的 Secret 管理

### 按团队分组

```
组织级 Secrets：
  - TEAM_A_DOCKER_TOKEN
  - TEAM_B_DOCKER_TOKEN
  - SHARED_NPM_TOKEN
```

### 用环境代替仓库级 Secret

```
环境：
  - development：开发环境 Secret
  - staging：预发布环境 Secret
  - production：生产环境 Secret（需要审批）
```

### Secret 审计

GitHub 提供 Secret 使用情况：
- 仓库 Settings → Secrets → 查看哪些 workflow 使用了这个 Secret
- 组织 Settings → Secrets → 查看哪些仓库有访问权限

但 GitHub 不提供 Secret 的使用日志。如果需要审计，考虑：
- 用外部 Secret 管理工具（HashiCorp Vault、AWS Secrets Manager）
- 监控异常的 API 调用

## 一个真实的 Secret 问题

某团队的 npm publish 失败，错误是 `401 Unauthorized`。排查过程：

1. 检查 `NPM_TOKEN`——值是正确的
2. 检查 npm registry 配置——没问题
3. 检查 `.npmrc` 文件——没有
4. 检查 workflow 里 token 的使用方式——发现问题

问题代码：
```yaml
- run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

这段代码看起来没问题。但 `actions/setup-node` 的 `registry-url` 参数会自动创建 `.npmrc` 文件，其中使用的是 `NODE_AUTH_TOKEN` 环境变量。如果没有 `registry-url`，`.npmrc` 不会被创建，`NODE_AUTH_TOKEN` 也就没用。

修复：
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    registry-url: 'https://registry.npmjs.org'
- run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 练习

### 练习一：设计 Secret 架构

为一个有 5 个微服务的组织设计 Secret 管理方案，要求：
1. 每个服务有自己的部署凭证
2. 所有服务共享 Docker Hub 凭证
3. 生产环境部署需要人工审批
4. PR 不能访问任何部署凭证

列出需要创建的 Secret、环境和保护规则。

---

## 参考答案

**组织级 Secrets**：
| 名称 | 范围 | 用途 |
|---|---|---|
| DOCKER_HUB_TOKEN | 所有仓库 | Docker Hub 推送镜像 |

**环境配置**：

| 环境 | 保护规则 | Secrets |
|---|---|---|
| development | 无 | 各服务的 dev 部署凭证 |
| staging | 无 | 各服务的 staging 部署凭证 |
| production | 需要 1 人审批，仅 main 分支 | 各服务的 production 部署凭证 |

**仓库级配置**：

每个服务仓库创建以下环境级 Secret：
- `DEPLOY_KEY`（每个环境不同值）
- `DEPLOY_URL`（每个环境不同值）

**Workflow 示例**：

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # 触发审批
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          username: ${{ github.actor }}
          password: ${{ secrets.DOCKER_HUB_TOKEN }}
      - run: |
          ./deploy.sh \
            --key "${{ secrets.DEPLOY_KEY }}" \
            --url "${{ secrets.DEPLOY_URL }}"
```

**PR Workflow**：

```yaml
name: PR Check
on:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
      # 不引用任何环境，不访问部署凭证
```
