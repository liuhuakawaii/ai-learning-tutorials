# 06. 阶段项目：安全审计与加固

> 把前面学到的所有安全知识整合起来，完成一个完整的安全审计与加固项目

## 本课目标

- 综合运用前 5 课的安全知识
- 完成一个完整的安全审计流程
- 修复发现的安全漏洞
- 建立安全开发规范

## 项目概述

### 项目目标

完成一个完整的安全审计与加固项目，包含：
- 代码安全审计
- 依赖安全扫描
- 配置安全检查
- 敏感信息泄露检查
- 漏洞修复
- 安全规范建立

### 审计范围

1. **代码安全**：XSS、CSRF、注入漏洞
2. **依赖安全**：漏洞依赖、恶意包
3. **配置安全**：HTTP 安全头、CORS、CSP
4. **敏感信息**：硬编码密钥、敏感数据暴露
5. **认证授权**：会话管理、权限控制

## 审计流程

### 第一步：准备工作

```bash
# 1. 克隆项目
git clone https://github.com/example/project.git
cd project

# 2. 安装依赖
npm ci

# 3. 运行测试，确保项目正常
npm test
```

### 第二步：代码安全审计

#### 1. XSS 检查

```bash
# 使用 ESLint 插件检查 XSS
npm install --save-dev eslint-plugin-react-xss

# 运行检查
npm run lint
```

**检查点**：
- `innerHTML`、`outerHTML` 使用
- `dangerouslySetInnerHTML` 使用
- `v-html` 使用
- 用户输入直接渲染

#### 2. CSRF 检查

**检查点**：
- 表单提交是否包含 CSRF Token
- API 请求是否验证 CSRF Token
- Cookie 是否设置 SameSite

#### 3. 注入检查

**检查点**：
- SQL 查询是否使用参数化
- 命令执行是否验证输入
- 模板注入风险

### 第三步：依赖安全扫描

```bash
# 运行 npm audit
npm audit

# 导出报告
npm audit --json > audit-report.json

# 使用 Snyk 检查
npx snyk test

# 检查过时的依赖
npm outdated
```

**检查点**：
- 高危漏洞
- 中危漏洞
- 低危漏洞
- 过时的依赖

### 第四步：配置安全检查

#### 1. HTTP 安全头

```javascript
// 检查安全头配置
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};
```

#### 2. CORS 配置

```javascript
// 检查 CORS 配置
app.use(cors({
  origin: ['https://example.com'],
  credentials: true
}));
```

#### 3. CSP 配置

```nginx
# 检查 CSP 配置
Content-Security-Policy: 
  default-src 'none'; 
  script-src 'self'; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data: https:; 
  font-src 'self' data:; 
  connect-src 'self'; 
  frame-ancestors 'none';
```

### 第五步：敏感信息检查

```bash
# 使用 git-secrets 检查
git secrets --install
git secrets --scan

# 或使用 truffleHog
trufflehog git https://github.com/example/project.git
```

**检查点**：
- 硬编码的 API 密钥
- 硬编码的密码
- 私钥泄露
- 配置文件中的敏感信息

## 漏洞修复

### XSS 漏洞修复

```javascript
// 修复前
element.innerHTML = userInput;

// 修复后
function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, char => map[char]);
}
element.innerHTML = escapeHtml(userInput);
```

### CSRF 漏洞修复

```javascript
// 修复前
app.post('/api/transfer', (req, res) => {
  // 没有验证 CSRF Token
  transfer(req.body.to, req.body.amount);
});

// 修复后
app.post('/api/transfer', csrfProtection, (req, res) => {
  // 验证 CSRF Token
  transfer(req.body.to, req.body.amount);
});
```

### 依赖漏洞修复

```bash
# 自动修复
npm audit fix

# 手动修复（如果自动修复失败）
npm install package@latest

# 或者寻找替代包
npm uninstall vulnerable-package
npm install alternative-package
```

### 配置漏洞修复

```javascript
// 修复前
app.use(cors());  // 允许所有来源

// 修复后
app.use(cors({
  origin: ['https://example.com'],
  credentials: true
}));
```

### 敏感信息修复

```javascript
// 修复前
const API_KEY = 'sk_live_xxx';

// 修复后
const API_KEY = process.env.API_KEY;
```

## 安全规范建立

### 1. 编码规范

```markdown
# 安全编码规范

## 输入验证
- 所有用户输入必须验证
- 使用白名单验证
- 限制输入长度

## 输出编码
- HTML 输出使用 HTML 编码
- JavaScript 输出使用 JavaScript 编码
- URL 输出使用 URL 编码

## 认证授权
- 使用安全的密码存储（bcrypt）
- 实现会话超时
- 使用 HTTPS

## 错误处理
- 不要暴露敏感错误信息
- 记录错误日志
- 实现错误监控
```

### 2. 配置规范

```markdown
# 安全配置规范

## HTTP 安全头
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000
- Content-Security-Policy: 严格策略

## CORS 配置
- 限制允许的来源
- 不要使用通配符
- 启用 credentials

## Cookie 配置
- HttpOnly: true
- Secure: true
- SameSite: strict 或 lax
```

### 3. 依赖管理规范

```markdown
# 依赖管理规范

## 依赖选择
- 优先选择维护良好的包
- 检查包的下载量和社区活跃度
- 避免使用已知有漏洞的包

## 依赖更新
- 定期运行 npm audit
- 使用 Dependabot 自动更新
- 更新前测试兼容性

## 锁定文件
- 提交 package-lock.json
- 使用 npm ci 安装依赖
- 不要手动修改锁文件
```

## 审计报告模板

```markdown
# 安全审计报告

## 项目信息
- 项目名称：my-app
- 审计日期：2024-01-15
- 审计人员：security-team

## 审计范围
- 代码安全
- 依赖安全
- 配置安全
- 敏感信息

## 发现的问题

### 高危问题

#### XSS 漏洞
- 位置：src/components/Comment.jsx:15
- 描述：直接使用 dangerouslySetInnerHTML 渲染用户输入
- 修复：使用 DOMPurify 清理用户输入

#### CSRF 漏洞
- 位置：src/api/transfer.js:10
- 描述：转账接口没有验证 CSRF Token
- 修复：添加 CSRF Token 验证

### 中危问题

#### 依赖漏洞
- 包名：lodash
- 版本：4.17.15
- 漏洞：原型污染
- 修复：升级到 4.17.21

### 低危问题

#### 安全头缺失
- 缺少 X-Content-Type-Options
- 修复：添加安全头配置

## 修复计划

| 问题 | 优先级 | 负责人 | 截止日期 |
|------|--------|--------|----------|
| XSS 漏洞 | 高 | developer-a | 2024-01-16 |
| CSRF 漏洞 | 高 | developer-b | 2024-01-16 |
| 依赖漏洞 | 中 | developer-c | 2024-01-18 |
| 安全头缺失 | 低 | developer-d | 2024-01-20 |

## 结论

本次审计发现 X 个高危问题、Y 个中危问题、Z 个低危问题。
所有高危问题已修复，中危和低危问题计划在 X 天内修复。

## 建议

1. 建立定期安全审计机制
2. 使用自动化安全扫描工具
3. 加强团队安全培训
4. 建立安全响应流程
```

## 自动化安全检查

### GitHub Actions 工作流

```yaml
# .github/workflows/security.yml
name: Security Audit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'  # 每周一

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

      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Run CodeQL
        uses: github/codeql-action/analyze@v2
        with:
          languages: javascript

      - name: Check for Secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}

      - name: Create Issue on Failure
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Security Audit Failed',
              body: 'Security audit failed. Please check the CI logs.'
            })
```

### 验收标准

- [ ] 完成安全审计报告
- [ ] 修复所有高危漏洞
- [ ] 修复所有中危漏洞
- [ ] 实施必要的安全措施
- [ ] 有完善的安全文档
- [ ] 建立安全开发规范
- [ ] 配置自动化安全检查

## 下一步

恭喜你完成了前端基建与架构工程课程的所有阶段！

现在你可以：
1. 应用所学知识到实际项目中
2. 继续深入学习感兴趣的方向
3. 参与开源项目，贡献你的力量
4. 分享你的经验，帮助更多人

**推荐的下一步学习方向**：
- 深入学习 TypeScript 高级特性
- 学习 Node.js 后端开发
- 学习 DevOps 和云原生技术
- 学习性能优化和监控
- 学习微前端架构