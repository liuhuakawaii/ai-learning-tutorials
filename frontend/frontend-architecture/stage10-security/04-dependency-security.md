# 04. 依赖安全与供应链攻击

> 现代前端项目 90% 的代码来自依赖，依赖安全就是项目安全的基石

## 本课目标

- 理解供应链攻击的原理和危害
- 掌握依赖安全扫描和漏洞修复
- 学会锁定文件的正确使用
- 了解恶意依赖的检测方法

## 从一个真实场景说起

假设你在维护一个开源项目，遇到了这些问题：

1. **依赖漏洞**：npm audit 报告大量漏洞
2. **恶意包**：某个依赖被发现包含恶意代码
3. **版本锁定失效**：package-lock.json 被修改
4. **供应链攻击**：上游依赖被投毒

这些问题的根源是**依赖安全管理不足**。

## 供应链攻击

### 什么是供应链攻击

供应链攻击是攻击者通过污染软件供应链（依赖包、构建工具、CI/CD）来攻击最终用户。

### 攻击方式

#### 1. 恶意包

```javascript
// 攻击者发布看似正常的包
// 例如：event-stream 恶意包事件
{
  "name": "event-stream",
  "version": "3.3.6",
  "dependencies": {
    "flatmap-stream": "0.1.1"  // 恶意依赖
  }
}
```

#### 2. 依赖混淆

```javascript
// 攻击者发布同名的公共包
// 例如：公司内部包 my-internal-package
// 攻击者在 npm 上发布同名包，版本更高
{
  "name": "my-internal-package",
  "version": "999.0.0"
}
```

#### 3. 仓库劫持

```javascript
// 攻击者接管维护者的 npm 账户
// 发布包含恶意代码的新版本
```

#### 4. 构建工具污染

```javascript
// 攻击者污染构建工具
// 例如：在 webpack 插件中注入恶意代码
```

### 著名供应链攻击事件

| 事件 | 时间 | 影响 |
|------|------|------|
| event-stream | 2018 | 恶意代码窃取比特币 |
| ua-parser-js | 2021 | 被注入加密货币挖矿代码 |
| colors.js | 2022 | 故意破坏，输出乱码 |
| node-ipc | 2022 | 破坏特定国家的文件 |

## npm audit

### 基本使用

```bash
# 检查依赖漏洞
npm audit

# 详细输出
npm audit --json

# 修复漏洞
npm audit fix

# 强制修复（可能有破坏性变更）
npm audit fix --force
```

### 输出解读

```
# npm audit report

critical: 2 High: 5 Moderate: 10 Low: 3

Package                 Severity    Dependency of
----                    --------    -------------
lodash                  critical    my-app
minimist                high        my-app
```

### 配置审计级别

```json
// package.json
{
  "scripts": {
    "audit": "npm audit --audit-level=high"
  },
  "audit-level": "high"
}
```

### CI/CD 集成

```yaml
# GitHub Actions
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      
      - name: Run Security Audit
        run: npm audit --audit-level=high
        
      - name: Run Security Audit (JSON)
        run: npm audit --json > audit-report.json
        
      - name: Upload Audit Report
        uses: actions/upload-artifact@v3
        with:
          name: audit-report
          path: audit-report.json
```

## 锁定文件

### package-lock.json 的作用

```javascript
// package.json
{
  "dependencies": {
    "lodash": "^4.17.21"
  }
}

// package-lock.json
{
  "dependencies": {
    "lodash": {
      "version": "4.17.21",
      "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
      "integrity": "sha512-..."
    }
  }
}
```

### 锁定文件的重要性

1. **确定性**：确保每次安装相同的依赖版本
2. **完整性**：通过 integrity hash 验证包内容
3. **可重现**：团队成员和 CI/CD 使用相同的依赖

### 锁定文件管理

```bash
# 生成锁文件
npm install

# 验证锁文件
npm ci

# 更新锁文件
npm update

# 检查锁文件变化
git diff package-lock.json
```

### 防止锁文件篡改

```yaml
# GitHub Actions 验证锁文件
jobs:
  verify-lock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Verify package-lock.json
        run: |
          # 验证锁文件是否与 package.json 一致
          npm ci --ignore-scripts
          
          # 检查是否有未提交的更改
          git diff --exit-code package-lock.json
```

## 依赖管理最佳实践

### 1. 最小化依赖

```json
// 不推荐：引入整个 lodash
{
  "dependencies": {
    "lodash": "^4.17.21"
  }
}

// 推荐：只引入需要的函数
{
  "dependencies": {
    "lodash.debounce": "^4.0.8"
  }
}

// 或者使用原生方法
const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};
```

### 2. 定期更新依赖

```bash
# 检查过时的依赖
npm outdated

# 更新依赖
npm update

# 更新到最新版本
npx npm-check-updates -u
npm install
```

### 3. 使用 npm ci

```bash
# CI/CD 中使用 npm ci
npm ci

# npm ci 的特点：
# - 删除 node_modules 后重新安装
# - 严格按照 package-lock.json 安装
# - 更快、更可靠
```

### 4. 依赖审计

```yaml
# 定期审计
jobs:
  audit:
    runs-on: ubuntu-latest
    schedule:
      - cron: '0 0 * * 1'  # 每周一
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      
      - name: Audit Dependencies
        run: npm audit
        
      - name: Create Issue on Failure
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Dependency Security Audit Failed',
              body: 'Weekly security audit failed. Please check the CI logs.'
            })
```

### 5. 使用私有仓库

```bash
# 配置私有仓库
npm config set @myorg:registry https://registry.npmjs.org/

# 或使用 .npmrc
# .npmrc
@myorg:registry=https://registry.npmjs.org/
```

## 恶意依赖检测

### 1. 检查包信息

```bash
# 检查包信息
npm info package-name

# 检查包下载量
npm info package-name --json | jq '.dist-tags'

# 检查包维护者
npm info package-name --json | jq '.maintainers'
```

### 2. 检查包内容

```bash
# 下载并检查包内容
npm pack package-name
tar -xzf package-name-*.tgz
ls package/
```

### 3. 使用 Snyk

```bash
# 安装 Snyk
npm install -g snyk

# 认证
snyk auth

# 检查依赖
snyk test

# 监控依赖
snyk monitor
```

### 4. 使用 Socket

```javascript
// Socket 是一个依赖安全工具
// 可以检测恶意包
// https://socket.dev/
```

## 构建安全

### 1. 验证构建产物

```javascript
// 验证构建产物的完整性
const crypto = require('crypto');
const fs = require('fs');

function verifyBuildArtifact(filePath, expectedHash) {
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  
  return hash === expectedHash;
}
```

### 2. 使用 SRI（子资源完整性）

```html
<!-- SRI 验证 -->
<script 
  src="https://cdn.example.com/script.js"
  integrity="sha384-..."
  crossorigin="anonymous">
</script>
```

```nginx
# Nginx 生成 SRI
sub_filter_types application/javascript;
sub_filter '</script>' ' integrity="sha384-..." crossorigin="anonymous"></script>';
```

### 3. 安全的 CDN 配置

```html
<!-- 使用可信的 CDN -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>

<!-- 或者使用本地文件 -->
<script src="/js/lodash.min.js"></script>
```

## 依赖安全工具

### 1. npm audit

```bash
# 基本使用
npm audit

# 修复漏洞
npm audit fix
```

### 2. Snyk

```bash
# 安装
npm install -g snyk

# 检查
snyk test

# 监控
snyk monitor
```

### 3. Dependabot

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

### 4. Socket

```bash
# 安装
npm install -g socket

# 检查
socket analyze
```

## 本课小结

本课我们学习了依赖安全与供应链攻击：

1. **供应链攻击**：恶意包、依赖混淆、仓库劫持、构建工具污染
2. **npm audit**：检查漏洞、修复漏洞、CI/CD 集成
3. **锁定文件**：package-lock.json 的重要性和管理
4. **依赖管理**：最小化依赖、定期更新、使用 npm ci、依赖审计
5. **恶意依赖检测**：检查包信息、使用安全工具
6. **构建安全**：验证构建产物、SRI、安全的 CDN 配置

## 练习

### 练习一：审计依赖安全

为你的项目进行依赖安全审计：
- 运行 npm audit
- 分析漏洞报告
- 制定修复计划

### 练习二：配置 Dependabot

为你的项目配置 Dependabot：
- 自动更新依赖
- 创建 Pull Request
- 自动合并低风险更新

## 参考答案

### 练习一

```bash
# 1. 运行审计
npm audit

# 2. 导出报告
npm audit --json > audit-report.json

# 3. 分析报告
cat audit-report.json | jq '.vulnerabilities | length'

# 4. 修复漏洞
npm audit fix

# 5. 检查剩余漏洞
npm audit

# 6. 如果有无法自动修复的漏洞
npm audit fix --force
```

### 练习二

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "security"
    commit-message:
      prefix: "deps"
    reviewers:
      - "team-security"
```

```yaml
# 自动合并低风险更新
jobs:
  dependabot:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    steps:
      - name: Dependabot metadata
        id: metadata
        uses: dependabot/fetch-metadata@v1
        with:
          github-token: "${{ secrets.GITHUB_TOKEN }}"
      
      - name: Auto-merge minor and patch updates
        if: steps.metadata.outputs.update-type == 'version-update:semver-minor' || steps.metadata.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 下一步

完成本课后，继续学习 [05. 数据隐私与合规](./05-data-privacy-compliance.md)。