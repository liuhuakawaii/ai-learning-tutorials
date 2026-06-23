# stage4：代码质量工程

> 从"靠自觉"到"靠工程"，用工具链和流程保障代码质量

## 学习目标

完成本阶段后，你将能够：
- 理解代码规范从"约定"到"工程化"的演进逻辑
- 深度配置 ESLint（flat config），开发自定义规则和插件
- 用 Prettier 统一代码风格，并与 ESLint 正确集成
- 掌握 TypeScript 严格模式的配置策略和类型守卫技巧
- 建立代码审查流程，配置 CODEOWNERS 和自动化检查
- 规范提交信息（Conventional Commits），实现自动化版本管理和 Changelog
- 进行依赖安全审计，修复漏洞，检查许可证合规性
- 搭建完整的代码质量门禁（ESLint + Prettier + Husky + lint-staged + CI）

## 前置要求

- 完成 stage1 工程化基础与 Monorepo
- 完成 stage2 组件库工程化
- 完成 stage3 构建工具链深度
- 熟悉 TypeScript 基础类型和配置
- 有使用 Git 进行团队协作的经验

## 课时列表

| 课时 | 主题 | 核心内容 |
|------|------|----------|
| 01 | 代码规范不是约束 | 从"靠自觉"到"靠工程"，理解代码规范存在的原因和工程化方案 |
| 02 | ESLint 深度配置与自定义规则 | flat config 架构、插件开发、自定义规则编写 |
| 03 | Prettier 与风格统一 | 配置选项详解、与 ESLint 集成、忽略文件策略 |
| 04 | TypeScript 严格模式与类型检查 | strict 配置、noImplicitAny、类型守卫、.d.ts 声明文件 |
| 05 | 代码审查流程与自动化 | PR Review 规范、CODEOWNERS、自动化检查流水线 |
| 06 | 提交信息规范与版本管理 | Conventional Commits、semantic-release、自动生成 Changelog |
| 07 | 依赖安全审计与漏洞修复 | npm audit、Snyk、Dependabot、许可证合规检查 |
| 08 | 阶段项目：搭建完整的代码质量门禁 | ESLint + Prettier + Husky + lint-staged + CI 集成 |

## 学习建议

1. **理解动机**：每个工具都是为了解决具体问题而存在的，先理解问题再学工具
2. **渐进式严格**：不要一开始就开启所有严格检查，先跑起来再逐步收紧
3. **团队共识**：代码规范的核心是团队达成共识，工具只是强制执行共识
4. **自动化优先**：能自动化的都自动化，把精力留给真正需要人工判断的事
5. **从小处开始**：先在一个小项目中验证质量门禁，再推广到整个 Monorepo

## 阶段项目

为 Monorepo 搭建完整的代码质量门禁：

- 配置 ESLint flat config，支持 TypeScript + React
- 集成 Prettier，消除风格冲突
- 配置 Husky + lint-staged，提交时自动检查
- 设置 GitHub Actions CI 流水线，PR 合并前自动运行检查
- 配置 CODEOWNERS，明确代码审查责任人
- 集成依赖安全审计（npm audit + Dependabot）
- 提交信息规范检查（commitlint）

**验收标准**：
- `pnpm lint` 全量检查通过，无报错
- 提交代码时自动运行 lint-staged，不合规代码无法提交
- PR 创建时 CI 自动运行，检查不通过无法合并
- `npm audit` 无高危漏洞
- 提交信息不符合规范时被 commitlint 拒绝
- 所有配置文件有清晰注释，新人能理解每项配置的作用

## 常见问题

### Q: ESLint 和 Prettier 会不会冲突？

A: 会。ESLint 的格式规则和 Prettier 的格式化逻辑可能矛盾。解决方案是用 `eslint-config-prettier` 关闭 ESLint 中所有与 Prettier 冲突的格式规则，让 ESLint 只负责代码质量，Prettier 只负责代码风格。

### Q: 代码规范会不会降低开发效率？

A: 短期会有一点摩擦，但长期来看，规范减少了代码审查中的风格争论、减少了因不一致导致的理解成本。关键是把能自动化的都自动化——不要让开发者手动调整格式。

### Q: TypeScript 严格模式要不要一开始就开？

A: 新项目建议一开始就开启 `strict: true`。已有项目可以逐步收紧：先开 `noImplicitAny`，再开 `strictNullChecks`，最后开 `strict`。一步到位开启所有严格检查，在已有项目中会产生大量需要修复的类型错误。

### Q: semantic-release 适合所有项目吗？

A: 不适合。semantic-release 适合持续发布的库和应用。对于版本发布节奏较慢、需要手动控制版本号的项目，手动管理版本可能更合适。

## 下一步

完成本阶段后，继续学习 [stage5：前端监控体系](../stage5-monitoring/README.md)。
