# 07. 发布流程规范

> 发布流程不是"把代码推到生产环境"，而是"建立可预测、可追溯、可回滚的交付机制"

## 本课目标

- 掌握版本管理的最佳实践
- 学会编写和维护变更日志
- 理解发布检查清单的重要性
- 建立完整的发布流程规范

## 从一个真实场景说起

假设你在这样的团队工作：

1. **版本混乱**：不知道哪个版本对应哪个功能
2. **变更日志缺失**：用户不知道每个版本有什么变化
3. **发布事故频发**：发布时经常出问题
4. **回滚困难**：出问题后不知道如何回滚

发布流程规范就是解决这些问题的方案。

## 版本管理

### 语义化版本（SemVer）

```
MAJOR.MINOR.PATCH

MAJOR: 不兼容的 API 修改
MINOR: 向下兼容的功能性新增
PATCH: 向下兼容的问题修正
```

### 版本号示例

```
1.0.0  → 1.0.1  (修复 Bug)
1.0.1  → 1.1.0  (新增功能)
1.1.0  → 2.0.0  (破坏性变更)
```

### 版本管理工具

```bash
# npm version
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0

# 自定义版本
npm version 1.2.3-beta.1
```

### 自动化版本管理

```yaml
# 自动版本发布
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci

      - name: Version
        id: version
        run: |
          # 根据提交信息自动决定版本号
          if git log --oneline -1 | grep -q "BREAKING CHANGE"; then
            npm version major
          elif git log --oneline -1 | grep -q "feat:"; then
            npm version minor
          else
            npm version patch
          fi

      - name: Push
        run: |
          git push
          git push --tags
```

## 变更日志

### 变更日志格式

```markdown
# Changelog

## [1.2.0] - 2024-01-15

### Added
- 添加用户认证功能
- 添加暗黑模式支持

### Changed
- 优化首页加载速度
- 更新依赖版本

### Deprecated
- 标记旧 API 为废弃

### Removed
- 移除废弃的登录页面

### Fixed
- 修复登录表单验证问题
- 修复移动端样式问题

### Security
- 升级 lodash 到最新版本
```

### 自动生成变更日志

```javascript
// generate-changelog.js
const fs = require('fs');
const { execSync } = require('child_process');

function generateChangelog() {
  // 获取上次发布的提交
  const lastTag = execSync('git describe --tags --abbrev=0').toString().trim();
  
  // 获取提交列表
  const commits = execSync(`git log ${lastTag}..HEAD --oneline`).toString().trim();
  
  // 分类提交
  const categories = {
    Added: [],
    Changed: [],
    Fixed: [],
    Security: []
  };
  
  commits.split('\n').forEach(commit => {
    if (commit.includes('feat:')) {
      categories.Added.push(commit.replace('feat: ', ''));
    } else if (commit.includes('fix:')) {
      categories.Fixed.push(commit.replace('fix: ', ''));
    } else if (commit.includes('security:')) {
      categories.Security.push(commit.replace('security: ', ''));
    } else {
      categories.Changed.push(commit.replace('chore: ', ''));
    }
  });
  
  // 生成 Markdown
  const date = new Date().toISOString().split('T')[0];
  let changelog = `## [Unreleased] - ${date}\n\n`;
  
  Object.entries(categories).forEach(([category, items]) => {
    if (items.length > 0) {
      changelog += `### ${category}\n`;
      items.forEach(item => {
        changelog += `- ${item}\n`;
      });
      changelog += '\n';
    }
  });
  
  return changelog;
}

// 使用示例
const changelog = generateChangelog();
console.log(changelog);
```

### GitHub Actions 集成

```yaml
# 自动生成变更日志
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Generate Changelog
        id: changelog
        run: |
          CHANGELOG=$(node scripts/generate-changelog.js)
          echo "changelog<<EOF" >> $GITHUB_OUTPUT
          echo "$CHANGELOG" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Create Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          body: ${{ steps.changelog.outputs.changelog }}
          draft: false
          prerelease: false
```

## 发布检查清单

### 发布前检查清单

```markdown
# 发布前检查清单

## 代码质量
- [ ] 所有测试通过
- [ ] 代码 lint 检查通过
- [ ] TypeScript 类型检查通过
- [ ] 代码审查完成

## 功能验证
- [ ] 新功能测试通过
- [ ] 回归测试通过
- [ ] 性能测试通过
- [ ] 安全扫描通过

## 文档更新
- [ ] README 更新
- [ ] API 文档更新
- [ ] 变更日志更新
- [ ] 版本号更新

## 部署准备
- [ ] 构建产物验证
- [ ] 环境配置检查
- [ ] 数据库迁移准备
- [ ] 回滚方案准备

## 通知准备
- [ ] 团队通知
- [ ] 用户通知
- [ ] 监控配置
- [ ] 告警配置
```

### 自动化检查

```yaml
# 发布前自动检查
jobs:
  pre-release-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci

      - name: Run All Checks
        run: |
          echo "Running pre-release checks..."
          
          # 测试
          npm run test || exit 1
          echo "✓ Tests passed"
          
          # Lint
          npm run lint || exit 1
          echo "✓ Lint passed"
          
          # 类型检查
          npm run type-check || exit 1
          echo "✓ Type check passed"
          
          # 构建
          npm run build || exit 1
          echo "✓ Build passed"
          
          echo "All checks passed!"
```

## 发布流程

### 手动发布流程

```bash
# 1. 更新版本号
npm version patch

# 2. 生成变更日志
node scripts/generate-changelog.js > CHANGELOG.md

# 3. 提交变更
git add .
git commit -m "docs: update changelog"

# 4. 推送代码
git push

# 5. 创建发布
gh release create v1.0.1 --notes-file CHANGELOG.md

# 6. 发布到 npm
npm publish
```

### 自动化发布流程

```yaml
# 完整的发布工作流
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci

      - name: Run Tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Generate Changelog
        id: changelog
        run: |
          CHANGELOG=$(node scripts/generate-changelog.js)
          echo "changelog<<EOF" >> $GITHUB_OUTPUT
          echo "$CHANGELOG" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref_name }}
          release_name: Release ${{ github.ref_name }}
          body: ${{ steps.changelog.outputs.changelog }}
          draft: false
          prerelease: false

      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 发布脚本

```bash
#!/bin/bash
# release.sh

set -e

echo "Starting release process..."

# 1. 检查工作目录
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working directory is not clean"
  exit 1
fi

# 2. 拉取最新代码
echo "Pulling latest changes..."
git pull

# 3. 运行测试
echo "Running tests..."
npm test

# 4. 更新版本号
echo "Updating version..."
VERSION_TYPE=${1:-patch}
npm version $VERSION_TYPE

# 5. 生成变更日志
echo "Generating changelog..."
node scripts/generate-changelog.js > CHANGELOG.md

# 6. 提交变更
echo "Committing changes..."
git add CHANGELOG.md
git commit -m "docs: update changelog for $(git describe --tags)"

# 7. 推送代码
echo "Pushing changes..."
git push

# 8. 创建发布
echo "Creating release..."
VERSION=$(git describe --tags)
gh release create $VERSION --notes-file CHANGELOG.md

echo "Release $VERSION completed!"
```

## 发布通知

### Slack 通知

```yaml
# Slack 通知
jobs:
  notify:
    needs: release
    runs-on: ubuntu-latest
    steps:
      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          fields: repo,message,commit,author,action,eventName,ref,workflow
          text: |
            Release ${{ github.ref_name }} has been deployed!
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 邮件通知

```yaml
# 邮件通知
jobs:
  notify:
    needs: release
    runs-on: ubuntu-latest
    steps:
      - name: Send Email
        uses: dawidd6/action-send-mail@v3
        with:
          server_address: smtp.gmail.com
          server_port: 587
          username: ${{ secrets.EMAIL_USERNAME }}
          password: ${{ secrets.EMAIL_PASSWORD }}
          subject: Release ${{ github.ref_name }} - ${{ github.repository }}
          to: team@example.com
          from: ci@example.com
          body: |
            Release ${{ github.ref_name }} has been deployed!
            
            Commit: ${{ github.sha }}
            Author: ${{ github.actor }}
            
            <a href="${{ github.server_url }}/${{ github.repository }}/releases/tag/${{ github.ref_name }}">View Release</a>
```

### GitHub 状态

```yaml
# GitHub 状态
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Update Status
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.repos.createCommitStatus({
              owner: context.repo.owner,
              repo: context.repo.repo,
              sha: context.sha,
              state: context.payload.workflow_run.conclusion,
              description: 'Release completed',
              context: 'Release',
              target_url: `https://github.com/${context.repo.owner}/${context.repo.repo}/releases/tag/${context.ref_name}`
            })
```

## 发布回滚

### 回滚流程

```bash
#!/bin/bash
# rollback.sh

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./rollback.sh <version>"
  exit 1
fi

echo "Rolling back to version $VERSION..."

# 1. 切换到指定版本
git checkout $VERSION

# 2. 运行测试
npm test

# 3. 构建
npm run build

# 4. 部署
npm run deploy

# 5. 创建回滚发布
gh release create "rollback-$VERSION" \
  --notes "Rollback to version $VERSION" \
  --target $VERSION

echo "Rollback to $VERSION completed!"
```

### 自动化回滚

```yaml
# 自动化回滚
jobs:
  rollback:
    runs-on: ubuntu-latest
    inputs:
      version:
        description: 'Version to rollback to'
        required: true
    steps:
      - uses: actions/checkout@v3
        with:
          ref: ${{ github.event.inputs.version }}

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci

      - name: Run Tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy
        run: npm run deploy

      - name: Notify
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            {
              "text": "Rollback to ${{ github.event.inputs.version }} completed!"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## 发布最佳实践

### 1. 保持发布小步快跑

```yaml
# 频繁的小发布
on:
  push:
    branches: [main]

jobs:
  release:
    if: contains(github.event.head_commit.message, 'release:')
    steps:
      - name: Release
        run: npm version patch
```

### 2. 自动化一切

```yaml
# 全自动化
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm version patch
      - run: git push --follow-tags
      - run: npm publish
```

### 3. 监控发布

```yaml
# 发布监控
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: npm run deploy

      - name: Monitor
        run: |
          for i in {1..30}; do
            if ! curl -f http://app/health; then
              echo "Health check failed, rolling back..."
              npm run rollback
              exit 1
            fi
            sleep 10
          done
```

### 4. 通知团队

```yaml
# 通知
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: npm run deploy

      - name: Notify
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            {
              "text": "Release ${{ github.ref_name }} deployed!"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## 本课小结

本课我们学习了发布流程规范：

1. **版本管理**：语义化版本、自动化版本管理
2. **变更日志**：格式规范、自动生成、GitHub Actions 集成
3. **发布检查清单**：发布前检查、自动化检查
4. **发布流程**：手动发布、自动化发布、发布脚本
5. **发布通知**：Slack、邮件、GitHub 状态
6. **发布回滚**：回滚流程、自动化回滚
7. **最佳实践**：小步快跑、自动化、监控、通知

## 练习

### 练习一：制定发布流程

为你的项目制定一个完整的发布流程：
- 版本管理策略
- 变更日志规范
- 发布检查清单

### 练习二：实现自动化发布

为你的项目实现自动化发布：
- GitHub Actions 工作流
- 自动版本管理
- 自动通知

## 参考答案

### 练习一

```markdown
# 发布流程规范

## 版本管理

使用语义化版本（SemVer）：
- MAJOR: 破坏性变更
- MINOR: 新功能
- PATCH: Bug 修复

## 变更日志

格式：
- Added: 新功能
- Changed: 变更
- Deprecated: 废弃
- Removed: 移除
- Fixed: 修复
- Security: 安全

## 发布检查清单

### 代码质量
- [ ] 所有测试通过
- [ ] Lint 检查通过
- [ ] 类型检查通过

### 功能验证
- [ ] 新功能测试通过
- [ ] 回归测试通过

### 文档更新
- [ ] README 更新
- [ ] 变更日志更新
- [ ] 版本号更新

### 部署准备
- [ ] 构建产物验证
- [ ] 环境配置检查
- [ ] 回滚方案准备
```

### 练习二

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci

      - name: Run Tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Generate Changelog
        id: changelog
        run: |
          CHANGELOG=$(node scripts/generate-changelog.js)
          echo "changelog<<EOF" >> $GITHUB_OUTPUT
          echo "$CHANGELOG" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref_name }}
          release_name: Release ${{ github.ref_name }}
          body: ${{ steps.changelog.outputs.changelog }}
          draft: false
          prerelease: false

      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: |
            Release ${{ github.ref_name }} has been published!
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## 下一步

完成本课后，继续学习 [08. 阶段项目：搭建完整的 CI/CD 流水线](./08-stage-project.md)。