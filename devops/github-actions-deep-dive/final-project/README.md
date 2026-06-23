# CI/CD 流水线设计

> GitHub Actions 深入课程毕业项目：为一个真实项目设计完整的 CI/CD 流水线。

## 快速开始

```bash
cd cicd-pipeline
npm install
npm run dev          # 本地开发
npm run test         # 运行测试
npm run lint         # 代码检查
```

## 推送到 GitHub 后

1. 创建一个新仓库并推送代码
2. 在 Settings → Secrets 中配置：
   - `DOCKERHUB_USERNAME` — Docker Hub 用户名
   - `DOCKERHUB_TOKEN` — Docker Hub Access Token
   - `DEPLOY_SSH_KEY` — 部署服务器 SSH 私钥
3. 创建 PR，观察自动触发 lint 和 test
4. 合并到 main，观察自动构建和部署

## 本地检查

```bash
node scripts/check.js
```

## 项目结构

```
cicd-pipeline/
├── .github/
│   ├── workflows/
│   │   ├── lint.yml           # 代码质量
│   │   ├── test.yml           # 测试
│   │   ├── build.yml          # 构建与发布
│   │   ├── security.yml       # 安全扫描
│   │   └── deploy.yml         # 部署
│   ├── actions/
│   │   └── setup-node-cache/  # 可复用 Action
│   └── dependabot.yml
├── src/
│   ├── server/                # Express 后端
│   └── client/                # React 前端
├── Dockerfile
├── docker-compose.yml
├── scripts/
│   └── check.js
├── tests/
├── reports/
│   └── final-report.md
└── README.md
```

## 课程阶段映射

| 阶段 | 能力 | 对应文件 |
|------|------|----------|
| 阶段一 | 工作流触发与代码检查 | `.github/workflows/lint.yml` |
| 阶段二 | 测试矩阵与缓存 | `.github/workflows/test.yml` |
| 阶段三 | Docker 构建与发布 | `.github/workflows/build.yml` |
| 阶段四 | 安全扫描集成 | `.github/workflows/security.yml` |
| 阶段五 | 部署策略与环境管理 | `.github/workflows/deploy.yml` |

## 验收建议

1. 创建 PR，确认 lint 和 test 自动运行且结果正确
2. 合并 PR，确认 Docker 镜像构建并推送成功
3. 在 Security tab 查看扫描结果
4. 确认 staging 自动部署成功
5. 触发 production 部署，确认需要手动审批
