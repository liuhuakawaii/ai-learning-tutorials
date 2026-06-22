# AI 编程工程实战课程

> 从"会用 Copilot"到"用 AI 工程化地写代码"——系统掌握 AI 辅助开发的方法论和最佳实践

## 适合谁

- 每天用 Cursor / Copilot / Codex 但总觉得用得不够好的开发者
- 想把 AI 编程从"偶尔试试"变成"日常工作流"的工程师
- 带团队的技术负责人，想建立团队级 AI 编程规范
- 对 AI 编程工具感兴趣但不知道从哪开始的新手

## 前置要求

- **技术基础**：有 1 年以上编程经验（任何语言）
- **工具**：安装 Cursor、GitHub Copilot 或类似 AI 编程工具
- **建议**：有实际项目可以练习

## 学完能做什么

- 用 AI 高效完成代码编写、重构、测试、文档、Code Review
- 建立个人的 AI 编程工作流（不是偶尔用用，而是每天用）
- 掌握 Prompt Engineering for Code 的核心技巧
- 在团队中推广 AI 编程最佳实践
- 识别 AI 生成代码的常见陷阱并避免

## 技术栈

| 类别 | 技术 |
|------|------|
| AI 工具 | Cursor / GitHub Copilot / Claude / Codex |
| 语言 | TypeScript / Python（示例双语言） |
| 测试 | Vitest / pytest |
| 文档 | Markdown / JSDoc / docstring |
| CI/CD | GitHub Actions |
| 代码质量 | ESLint / Ruff / SonarQube |

## 学习路线

### 第 1 阶段：AI 编程基础（7 课时）

> 从" autocomplete"到"对话式编程"的认知升级

1. AI 编程工具全景 — Cursor / Copilot / Codex / Claude 的能力对比
2. 代码补全的正确姿势 — Tab 不是唯一交互，理解 AI 的预测逻辑
3. Chat 模式入门 — 用自然语言描述需求，让 AI 生成代码
4. 上下文管理 — @file、@codebase、@web 的使用时机
5. AI 生成代码的审查清单 — 不信任但验证
6. 常见误区 — 过度依赖、不看生成结果、不理解就提交
7. 阶段实战：用 AI 完成一个小功能的完整开发

### 第 2 阶段：Prompt Engineering for Code（7 课时）

> 写出让 AI 生成好代码的 Prompt

1. 代码 Prompt 的核心原则 — 具体、有约束、给示例
2. 需求描述的结构化模板 — 功能/输入/输出/约束/风格
3. 上下文 Prompt — 用已有代码引导 AI 生成一致的代码
4. 迭代式 Prompt — 不指望一次成功，学会追问和修正
5. 系统级 Prompt — 项目级的 AI 规则配置（.cursorrules、.github/copilot）
6. 多语言 Prompt — TypeScript / Python / Go 的 Prompt 差异
7. 阶段实战：为你的项目编写一套 AI 编程规范

### 第 3 阶段：AI 辅助测试与重构（7 课时）

> 用 AI 提升代码质量，而不只是写代码速度

1. AI 生成单元测试 — 从"懒得写测试"到"AI 帮我写"
2. 测试覆盖率优化 — 让 AI 找出未覆盖的边界情况
3. AI 辅助 Code Review — 让 AI 先审一遍再给人看
4. 代码重构 — 用 AI 重构遗留代码（安全地）
5. Bug 定位 — 把报错信息丢给 AI，让它帮你定位
6. 性能优化 — 让 AI 分析性能瓶颈并建议优化
7. 阶段实战：用 AI 为一个无测试项目补全测试

### 第 4 阶段：AI 编程工作流（7 课时）

> 把 AI 编程融入日常开发流程

1. 从需求到代码 — 用 AI 拆解需求、设计架构、生成代码
2. Git 工作流 — AI 生成 commit message、PR description、changelog
3. 文档自动化 — AI 生成 README、API 文档、注释
4. 调试工作流 — 错误信息 → AI 分析 → 修复建议 → 验证
5. 学习新技术 — 用 AI 学习不熟悉的框架和语言
6. 代码迁移 — 用 AI 辅助语言/框架迁移（如 JS → TS）
7. 阶段实战：用 AI 完成一个功能的完整开发周期

### 第 5 阶段：团队 AI 编程规范（6 课时）

> 从个人效率到团队效能

1. 团队 AI 编程规范设计 — 什么能用、什么不能用、怎么用
2. AI 代码审查流程 — 人机协作的 Code Review
3. 知识沉淀 — 把 AI 辅助的经验变成团队文档
4. 安全与合规 — 代码泄露、许可证、敏感信息
5. 效果度量 — 如何衡量 AI 编程的 ROI
6. 阶段实战：为团队编写一份 AI 编程规范文档

### 最终项目

详见 [final-project/项目说明.md](./final-project/项目说明.md)

选择一个真实项目，用 AI 辅助完成从需求分析到代码交付的完整流程，产出代码、测试、文档和开发日志。

## 学习建议

1. **边学边用**：每节课的内容立即在实际项目中练习
2. **不信任 AI**：始终审查生成的代码，理解后再使用
3. **建立 Prompt 库**：把好用的 Prompt 保存下来，逐步积累
4. **记录效率提升**：对比有 AI 和无 AI 的开发效率

## 参考资源

- [Cursor 文档](https://cursor.sh/docs)
- [GitHub Copilot 文档](https://docs.github.com/en/copilot)
- [Anthropic Claude 文档](https://docs.anthropic.com/)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)
