# 毕业项目：企业级前端基建平台

> 综合运用所有阶段知识，搭建一个可直接用于团队的前端基础设施

## 项目目标

搭建一个完整的前端基建平台，包含：

1. **Monorepo 项目模板** —— 包含应用和组件库
2. **企业级脚手架** —— 一键创建项目、生成代码
3. **组件库基础** —— 包含 5-10 个基础组件
4. **构建配置** —— Vite/Webpack 预设
5. **代码规范** —— ESLint/Prettier/Stylelint 配置包
6. **监控 SDK** —— 错误捕获与性能采集
7. **CI/CD 配置** —— GitHub Actions 工作流

## 项目结构

```
enterprise-frontend-infra/
├── apps/
│   ├── web/                    # 主应用
│   └── docs/                   # 文档站点
├── packages/
│   ├── ui/                     # 组件库
│   ├── cli/                    # 脚手架工具
│   ├── config/                 # 配置包
│   │   ├── eslint/             # ESLint 配置
│   │   ├── prettier/           # Prettier 配置
│   │   ├── typescript/         # TypeScript 配置
│   │   └── stylelint/          # Stylelint 配置
│   ├── monitoring/             # 监控 SDK
│   └── utils/                  # 工具函数
├── scripts/                    # 构建脚本
├── .github/
│   └── workflows/              # CI/CD 配置
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## 技术栈

- **包管理**：pnpm workspace
- **构建工具**：Vite
- **组件库**：React + TypeScript
- **代码规范**：ESLint + Prettier + Stylelint
- **监控**：自研 SDK
- **CI/CD**：GitHub Actions

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装

```bash
# 克隆项目
git clone https://github.com/example/enterprise-frontend-infra.git
cd enterprise-frontend-infra

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### 使用脚手架

```bash
# 创建新项目
npx @my-org/cli create my-app

# 生成组件
npx @my-org/cli generate component Button

# 生成页面
npx @my-org/cli generate page Home
```

## 项目要求

### Monorepo 项目模板

**功能要求**：
- 支持多应用和多包
- 共享依赖和配置
- 增量构建和测试
- 统一的版本管理

**技术要求**：
- 使用 pnpm workspace
- 支持热更新
- 支持 TypeScript
- 支持路径别名

### 企业级脚手架

**功能要求**：
- `create` 命令：创建新项目
- `generate` 命令：生成组件、页面、Hook
- `add` 命令：添加插件
- `preset` 命令：管理预设

**技术要求**：
- 使用 Commander.js
- 使用 Inquirer.js
- 使用 EJS 模板
- 支持插件机制

### 组件库基础

**组件要求**：
- Button 按钮
- Input 输入框
- Modal 弹窗
- Toast 消息提示
- Tabs 标签页
- Table 表格
- Form 表单
- Select 选择器

**技术要求**：
- 使用 React + TypeScript
- 支持主题定制
- 支持国际化
- 完善的文档

### 构建配置

**配置要求**：
- Vite 预设
- Webpack 预设
- 环境变量管理
- 代理配置

**技术要求**：
- 支持开发环境
- 支持测试环境
- 支持生产环境
- 支持自定义配置

### 代码规范

**规范要求**：
- ESLint 配置
- Prettier 配置
- Stylelint 配置
- Commitlint 配置

**技术要求**：
- 可共享的配置包
- 支持覆盖默认配置
- 集成 Git Hooks

### 监控 SDK

**功能要求**：
- 错误监控
- 性能采集
- 用户行为追踪
- 上报接口

**技术要求**：
- 轻量级
- 无依赖
- 支持 SPA 和 SSR
- 支持 source map

### CI/CD 配置

**功能要求**：
- 代码质量检查
- 自动化测试
- 多环境部署
- 灰度发布

**技术要求**：
- 使用 GitHub Actions
- 支持缓存
- 支持通知
- 支持回滚

## 验收方式

```bash
cd frontend/frontend-architecture/final-project

# 验证项目结构
pnpm check

# 验证构建产物
pnpm build

# 验证测试覆盖
pnpm test

# 启动演示项目
pnpm dev
```

### 验收标准

- [ ] Monorepo 结构正确，可以正常构建
- [ ] 脚手架可以正常创建项目和生成代码
- [ ] 组件库包含所有要求的组件
- [ ] 构建配置支持多环境
- [ ] 代码规范配置完整
- [ ] 监控 SDK 可以正常工作
- [ ] CI/CD 流水线正常运行
- [ ] 有完整的文档

## 项目时间安排

### 第一周：基础搭建

- 搭建 Monorepo 结构
- 配置代码规范
- 配置构建工具
- 创建基础组件

### 第二周：功能开发

- 开发脚手架工具
- 开发监控 SDK
- 完善组件库
- 编写文档

### 第三周：测试部署

- 编写测试用例
- 配置 CI/CD
- 进行安全审计
- 完善文档

## 参考资源

- [pnpm Workspace](https://pnpm.io/workspaces)
- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)
- [Commander.js](https://github.com/tj/commander.js)
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js)
- [GitHub Actions](https://docs.github.com/en/actions)

## 常见问题

### Q: 为什么选择 pnpm 而不是 npm/yarn？

A: pnpm 有以下优势：
- 更快的安装速度
- 更少的磁盘占用
- 更好的 Monorepo 支持
- 严格的依赖管理

### Q: 如何处理组件库的样式？

A: 推荐使用 CSS-in-JS 或 CSS Modules，可以：
- 避免样式冲突
- 支持主题定制
- 支持动态样式
- 便于维护

### Q: 监控 SDK 如何保证性能？

A: 通过以下方式保证性能：
- 异步加载，不阻塞页面
- 批量上报，减少请求
- 采样上报，控制数据量
- 缓存数据，避免丢失

### Q: 如何保证代码规范的一致性？

A: 通过以下方式保证：
- 使用 ESLint + Prettier 自动格式化
- 使用 Git Hooks 在提交前检查
- 使用 CI/CD 在合并前验证
- 定期进行代码审查

## 下一步

完成本项目后，你已经完成了前端基建与架构工程课程的全部内容。你可以：

1. 将项目部署到生产环境
2. 在团队中推广使用
3. 继续迭代和完善
4. 分享你的经验

**恭喜你完成课程！**