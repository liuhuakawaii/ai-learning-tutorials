# 02. Monorepo 核心概念

> workspace、依赖提升、幽灵依赖，理解 Monorepo 的底层机制

## 本课目标

- 理解 Monorepo 的核心概念和优势
- 掌握 workspace 的工作原理
- 理解依赖提升和幽灵依赖问题
- 对比 Monorepo 和多仓库的优劣

## 什么是 Monorepo

Monorepo（单一仓库）是一种代码管理策略，将多个相关项目放在同一个代码仓库中。

### 传统多仓库模式

```
project-a/          # 独立仓库
  ├── package.json
  └── src/

project-b/          # 独立仓库
  ├── package.json
  └── src/

shared-utils/       # 独立仓库
  ├── package.json
  └── src/
```

**特点**：
- 每个项目独立仓库
- 通过 npm 包共享代码
- 独立的版本管理
- 独立的 CI/CD 流程

### Monorepo 模式

```
monorepo/
├── package.json
├── packages/
│   ├── ui/           # 组件库
│   │   ├── package.json
│   │   └── src/
│   ├── utils/        # 工具函数
│   │   ├── package.json
│   │   └── src/
│   └── config/       # 配置包
│       ├── package.json
│       └── src/
└── apps/
    ├── web/          # Web 应用
    │   ├── package.json
    │   └── src/
    └── mobile/       # 移动应用
        ├── package.json
        └── src/
```

**特点**：
- 所有项目在一个仓库
- 直接引用本地包
- 统一的版本管理
- 统一的 CI/CD 流程

## Monorepo 的核心优势

### 1. 代码共享更简单

**多仓库方式**：
```bash
# 修改 shared-utils
cd shared-utils
git commit -m "feat: add new util"
git push
npm publish

# 在 project-a 中使用
cd project-a
npm install shared-utils@latest
```

**Monorepo 方式**：
```bash
# 直接修改，无需发布
cd packages/utils
# 修改代码...

# 在 project-a 中直接引用
"dependencies": {
  "@myorg/utils": "workspace:*"
}
```

### 2. 原子提交

**多仓库问题**：
- 修改一个公共 API 需要同时修改多个仓库
- 无法保证多个仓库的修改同时生效
- 容易出现版本不一致

**Monorepo 优势**：
- 一次提交可以修改所有相关代码
- 保证所有修改同时生效
- 版本天然一致

### 3. 统一的工具链

**多仓库问题**：
- 每个仓库需要单独配置构建工具
- 配置不一致，维护成本高
- 工具升级需要逐个仓库修改

**Monorepo 优势**：
- 统一的构建配置
- 统一的代码规范
- 统一的测试策略
- 工具升级一次完成

### 4. 更好的代码审查

**多仓库问题**：
- 跨仓库的修改难以审查
- 难以看到全局影响
- 审查效率低

**Monorepo 优势**：
- 一个 PR 可以看到所有修改
- 容易评估全局影响
- 审查效率高

## Workspace 机制

Workspace 是 Monorepo 的核心概念，它允许多个包在同一个仓库中管理。

### pnpm workspace 配置

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### workspace 协议

```json
{
  "dependencies": {
    "@myorg/utils": "workspace:*",
    "@myorg/ui": "workspace:^1.0.0"
  }
}
```

**workspace 协议说明**：
- `workspace:*`：匹配任何版本
- `workspace:^1.0.0`：匹配 ^1.0.0 版本
- `workspace:~1.0.0`：匹配 ~1.0.0 版本

### workspace 的工作原理

1. **安装阶段**：
   - pnpm 读取 pnpm-workspace.yaml
   - 识别所有 workspace 包
   - 解析包间依赖关系
   - 创建符号链接

2. **运行阶段**：
   - 通过符号链接找到本地包
   - 直接使用本地代码
   - 无需发布到 npm

3. **构建阶段**：
   - 按依赖顺序构建
   - 支持增量构建
   - 支持并行构建

## 依赖提升

依赖提升是包管理器的优化策略，将重复的依赖提升到根目录。

### 问题场景

```
monorepo/
├── package.json
├── packages/
│   ├── a/
│   │   ├── package.json
│   │   └── node_modules/
│   │       └── lodash/        # 重复安装
│   └── b/
│       ├── package.json
│       └── node_modules/
│           └── lodash/        # 重复安装
└── node_modules/
    └── lodash/                # 提升后
```

### 依赖提升的原理

1. **分析依赖关系**：扫描所有 package.json
2. **识别重复依赖**：找出多个包都依赖的库
3. **提升到根目录**：将重复依赖安装到根 node_modules
4. **创建符号链接**：在各包中创建指向根目录的符号链接

### 依赖提升的优缺点

**优点**：
- 节省磁盘空间
- 减少安装时间
- 统一版本管理

**缺点**：
- 可能导致幽灵依赖
- 可能导致版本冲突
- 调试时可能困惑

## 幽灵依赖

幽灵依赖是 Monorepo 中最常见的问题之一。

### 什么是幽灵依赖

幽灵依赖是指**代码中使用了某个包，但 package.json 中没有声明依赖**。

```json
// packages/a/package.json
{
  "dependencies": {
    "lodash": "^4.17.21"
  }
}

// packages/b/package.json
{
  "dependencies": {
    "axios": "^1.0.0"
  }
}
```

```javascript
// packages/b/src/index.js
import _ from 'lodash';  // 幽灵依赖！
```

### 幽灵依赖的成因

1. **依赖提升**：lodash 被提升到根目录
2. **符号链接**：packages/b 可以访问根目录的 lodash
3. **package.json 未声明**：packages/b 没有声明 lodash 依赖

### 幽灵依赖的危害

1. **构建失败**：
   - 某天 lodash 被移除或版本变更
   - packages/b 的构建突然失败
   - 难以定位问题

2. **版本不一致**：
   - 不同环境可能安装不同版本
   - 导致行为不一致

3. **安全风险**：
   - 无法追踪依赖来源
   - 无法进行安全审计

### 解决幽灵依赖

**方案一：严格模式**

```json
// .npmrc
shamefully-hoist=false
strict-peer-dependencies=true
```

**方案二：显式声明依赖**

```json
// packages/b/package.json
{
  "dependencies": {
    "axios": "^1.0.0",
    "lodash": "^4.17.21"  // 显式声明
  }
}
```

**方案三：使用 pnpm 的 strict 模式**

```json
// .npmrc
shamefully-hoist=false
```

## 循环依赖

循环依赖是 Monorepo 中另一个常见问题。

### 什么是循环依赖

```
packages/a → packages/b → packages/a  # 循环！
```

### 循环依赖的危害

1. **构建失败**：构建工具无法确定构建顺序
2. **运行时错误**：模块可能未完全加载
3. **代码质量**：通常意味着架构设计问题

### 解决循环依赖

**方案一：提取公共模块**

```
packages/a → packages/common
packages/b → packages/common
```

**方案二：依赖倒置**

```
packages/a → packages/interface
packages/b → packages/interface
```

**方案三：运行时依赖**

```javascript
// packages/a/src/index.js
export function getB() {
  return require('./b');  // 运行时依赖
}
```

## Monorepo vs 多仓库

| 维度 | Monorepo | 多仓库 |
|------|----------|--------|
| 代码共享 | 直接引用，无需发布 | 需要发布 npm 包 |
| 版本管理 | 统一版本 | 独立版本 |
| 构建工具 | 统一配置 | 各自配置 |
| CI/CD | 统一流程 | 各自流程 |
| 代码审查 | 一个 PR 看全部 | 多个 PR 分散 |
| 权限管理 | 粒度粗 | 粒度细 |
| 学习成本 | 较高 | 较低 |
| 适用场景 | 中大型团队、紧密耦合项目 | 小团队、独立项目 |

## 何时选择 Monorepo

**适合 Monorepo 的场景**：
- 多个项目共享大量代码
- 需要频繁修改公共库
- 团队规模较大（10+ 人）
- 需要统一的工具链和规范
- 项目间有强依赖关系

**不适合 Monorepo 的场景**：
- 项目完全独立
- 团队规模小（< 5 人）
- 权限管理需求严格
- 仓库规模过大（> 1GB）

## 本课小结

本课我们理解了 Monorepo 的核心概念：

1. **Monorepo 是代码管理策略**，不是技术栈
2. **Workspace 是核心机制**，允许多包管理
3. **依赖提升是优化策略**，但可能导致幽灵依赖
4. **幽灵依赖是常见问题**，需要显式声明依赖
5. **Monorepo 适合中大型团队**，不适合所有场景

## 练习

### 练习一：识别幽灵依赖

分析以下 package.json，找出可能的幽灵依赖：

```json
{
  "name": "@myorg/app",
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

代码中使用了 `import _ from 'lodash'`，但 package.json 中没有声明 lodash。

### 练习二：设计 Monorepo 结构

为一个包含以下项目的团队设计 Monorepo 结构：
- 组件库（ui）
- 工具函数库（utils）
- Web 应用（web）
- 移动应用（mobile）
- 文档站点（docs）

## 参考答案

### 练习一

**幽灵依赖**：lodash

**原因**：代码中使用了 lodash，但 package.json 中没有声明

**解决方案**：
```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "lodash": "^4.17.21"
  }
}
```

### 练习二

**推荐结构**：

```
monorepo/
├── package.json
├── pnpm-workspace.yaml
├── packages/
│   ├── ui/           # 组件库
│   ├── utils/        # 工具函数
│   └── config/       # 共享配置
├── apps/
│   ├── web/          # Web 应用
│   ├── mobile/       # 移动应用
│   └── docs/         # 文档站点
└── tools/
    └── scripts/      # 构建脚本
```

**配置文件**：
```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

## 下一步

完成本课后，继续学习 [03. pnpm workspace 深度实践](./03-pnpm-workspace.md)。
