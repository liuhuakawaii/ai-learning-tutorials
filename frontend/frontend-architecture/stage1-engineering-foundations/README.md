# stage1：工程化基础与 Monorepo

> 从"单项目"到"多包管理"，建立工程化思维

## 学习目标

完成本阶段后，你将能够：
- 理解前端工程化的核心价值和演进路径
- 掌握 Monorepo 架构设计和核心概念
- 熟练使用 pnpm workspace 管理多包项目
- 使用 Turborepo 优化构建流程和缓存策略
- 设计包间依赖管理和版本策略
- 使用 changesets 管理版本发布
- 建立开发环境标准化和代码规范
- 配置 Git Hooks 和提交规范

## 前置要求

- 熟悉 npm/pnpm 基本使用
- 了解 Git 基本操作
- 有实际项目开发经验

## 课时列表

| 课时 | 主题 | 核心内容 |
|------|------|----------|
| 01 | 为什么需要工程化 | 从真实项目痛点说起，理解工程化的价值 |
| 02 | Monorepo 核心概念 | workspace、依赖提升、幽灵依赖 |
| 03 | pnpm workspace 深度实践 | 多包管理、依赖安装、脚本编排 |
| 04 | Turborepo 构建编排与缓存策略 | 构建顺序、增量构建、远程缓存 |
| 05 | 包间依赖管理与版本策略 | 依赖关系、版本锁定、依赖升级 |
| 06 | changesets 版本管理与发布流程 | 版本号、变更日志、自动发布 |
| 07 | 开发环境标准化 | .editorconfig、.nvmrc、engines |
| 08 | Git Hooks 与提交规范 | husky、commitlint、lint-staged |
| 09 | Monorepo 常见坑与解决方案 | 幽灵依赖、循环依赖、构建顺序 |
| 10 | 阶段项目：搭建 Monorepo 项目骨架 | 综合实践 |

## 学习建议

1. **动手实践**：每节课的示例代码都要亲手跑一遍
2. **理解原理**：不要只记配置，理解为什么这样配置
3. **对比思考**：对比 Monorepo 和多仓库的优劣
4. **记录问题**：遇到问题先记录，尝试自己解决后再看答案

## 阶段项目

搭建一个包含以下结构的 Monorepo 项目：
- `packages/ui`：组件库包
- `packages/utils`：工具函数包
- `packages/config`：配置包（ESLint、Prettier 等）
- `apps/docs`：文档站点
- `apps/playground`：演示应用

**验收标准**：
- `pnpm install` 正常安装依赖
- `pnpm build` 正常构建所有包
- `pnpm test` 正常运行测试
- `pnpm lint` 正常检查代码规范
- 包间依赖关系正确

## 常见问题

### Q: Monorepo 和多仓库哪个更好？

A: 没有绝对的好坏，取决于团队规模、项目复杂度和协作模式。Monorepo 适合需要频繁共享代码的场景，多仓库适合独立性强的项目。

### Q: pnpm 和 npm/yarn 的区别？

A: pnpm 通过硬链接和符号链接实现依赖安装，节省磁盘空间，避免幽灵依赖，安装速度更快。

### Q: Turborepo 和 Nx 哪个更好？

A: Turborepo 更轻量，适合中小型项目；Nx 功能更强大，适合大型项目。根据团队需求选择。

## 下一步

完成本阶段后，继续学习 [stage2：组件库与设计系统](../stage2-component-library/README.md)。
