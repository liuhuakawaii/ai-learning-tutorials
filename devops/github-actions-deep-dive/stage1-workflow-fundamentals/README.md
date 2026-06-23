# 第一阶段：Workflow 基础

## 阶段目标

掌握 GitHub Actions Workflow 的完整语法、执行环境、上下文系统和缓存机制，能为一个 Node.js 项目设计完整的 CI 流水线。

## 课时列表

1. [Workflow 语法深度——触发条件、Job、Step、Action 的完整语义](01-workflow-syntax-deep-dive.md)
2. [执行环境——GitHub 托管 Runner 的系统环境、软件预装、磁盘布局](02-runner-environment.md)
3. [上下文与表达式——github/context/env/secrets 的作用域和生命周期](03-contexts-and-expressions.md)
4. [工件与缓存——actions/cache、actions/upload-artifact 的区别和用法](04-artifacts-and-cache.md)
5. [阶段实战：为一个 Node.js 项目设计完整的 CI 流水线](05-stage-project-nodejs-ci.md)

## 验收标准

- 能编写包含触发条件、Job 依赖、Step 顺序的完整 Workflow
- 能说明 GitHub 托管 Runner 的系统环境和可用工具
- 能正确使用 github/context/env/secrets 上下文并理解作用域
- 能区分 actions/cache 和 actions/upload-artifact 的使用场景
