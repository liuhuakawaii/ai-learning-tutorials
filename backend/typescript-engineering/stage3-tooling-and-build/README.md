# 阶段三：工具链与构建

掌握 TypeScript 工程化的核心工具链，从编译配置到 Monorepo 架构，让你的项目具备生产级的构建能力和可维护性。

本阶段聚焦 TypeScript 项目中最重要的工程化能力：如何配置编译器让团队协作更高效，如何用高速编译工具替代缓慢的 tsc，如何用 Monorepo 管理多个关联项目，以及如何用代码生成消除重复劳动。

## 本阶段学习目标

- 深入理解 `tsconfig.json` 的各项配置，掌握路径别名、增量编译、项目引用等高级用法
- 了解 `tsc` 的性能瓶颈，学会使用 ESBuild 和 SWC 进行高速编译
- 掌握 pnpm workspace + Turborepo 的 Monorepo 架构方案
- 理解 AST 的基本概念，能使用 TypeScript Compiler API 和 ts-morph 进行代码生成
- 学会从 OpenAPI / gRPC 等协议自动生成 TypeScript 类型定义
- 完成一个完整的 Monorepo 项目搭建实战

## 课时列表

| 序号 | 文件 | 主题 | 简介 |
|------|------|------|------|
| 01 | `01-tsconfig深度配置.md` | tsconfig 深度配置 | strict mode 细粒度控制、路径别名、项目引用与增量编译 |
| 02 | `02-ESBuild与SWC.md` | ESBuild 与 SWC | 对比 tsc 的性能瓶颈，配置 ESBuild/SWC 实现毫秒级编译 |
| 03 | `03-Monorepo架构.md` | Monorepo 架构 | pnpm workspace 管理多包、Turborepo 流水线编排、Nx affected |
| 04 | `04-代码生成与AST.md` | 代码生成与 AST | TypeScript Compiler API 基础、ts-morph 实战、Schema 驱动代码生成 |
| 05 | `05-API类型生成.md` | API 类型生成 | 从 OpenAPI/gRPC 自动生成类型、保持类型同步、CI 集成校验 |
| 06 | `06-阶段实战-Monorepo搭建.md` | 阶段实战 | 使用 pnpm + Turborepo 搭建完整 Monorepo，含共享配置、类型、API 和 Web 包 |

## 本阶段项目

本阶段的实战项目是**搭建一个完整的 Monorepo 工程**，包含以下子包：

- `packages/shared-config` — 共享的 ESLint、Prettier、tsconfig 配置
- `packages/shared-types` — 全局共享的 TypeScript 类型定义
- `packages/api-client` — 基于共享类型构建的 API 客户端
- `apps/web` — 前端应用（Vue3 / React）
- `apps/api` — 后端服务（Express）

项目从第一节课开始逐步搭建，每节课增加新的工具链能力，最终在第六节课完成整合。完成本阶段后，你将拥有一个可以直接用于后续课程实战的 Monorepo 工程骨架。

## 前置知识

- TypeScript 基础语法和类型系统（阶段一、二的内容）
- Node.js 和 npm/pnpm 的基本使用
- 基本的命令行操作能力
- 了解 Git 基本操作（clone、commit、branch）

## 学习建议

1. **动手优先**：每节课的代码示例都要亲手运行一遍，不要只看不练。配置类知识尤其需要实际操作才能真正理解
2. **对比理解**：ESBuild 和 SWC 的差异要在实际项目中感受，建议在同一个项目上分别用两种工具编译，体验速度差异
3. **渐进式学习**：Monorepo 的概念较多，建议先跑通最简单的两包结构，再逐步扩展到多包
4. **查阅文档**：TypeScript 官方文档对 tsconfig 的每个选项都有详细说明，遇到不确定的配置优先查官方文档而非搜索引擎
5. **记录笔记**：每节课学完后，用自己的话总结核心要点，这比反复看教程更有效

## 推荐资源

- [TypeScript 官方文档 - tsconfig 参考](https://www.typescriptlang.org/tsconfig)
- [Turborepo 官方文档](https://turbo.build/repo/docs)
- [pnpm Workspace 文档](https://pnpm.io/workspaces)
- [ts-morph 文档](https://ts-morph.com/)
- [openapi-typescript 文档](https://openapi-ts.dev/)
- [ESBuild 文档](https://esbuild.github.io/)
- [SWC 文档](https://swc.rs/)
