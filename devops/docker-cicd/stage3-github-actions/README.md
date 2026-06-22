# 第三阶段：CI/CD

## 阶段目标

用 GitHub Actions 自动执行安装、检查、测试、构建、镜像发布和部署触发。

## 课时安排

1. CI/CD 基础概念
2. workflow、job、step
3. 缓存依赖
4. lint、test、build
5. 构建 Docker 镜像
6. 推送镜像与部署触发
7. 阶段实战：自动构建发布流水线

## 阶段项目

为全栈项目建立 CI workflow，主分支合并后自动构建镜像。

## 验收标准

- PR 会自动跑检查
- main 分支构建 Docker 镜像
- 失败时能从日志定位问题
- secrets 不写入仓库

