# Monorepo 架构

## 场景引入

你的公司有 5 个 TypeScript 项目，它们共享用户类型定义、API 客户端和工具函数。目前的做法是把这些共享代码发布为 npm 包，改一行共享代码就要发一个新版本，然后 5 个项目分别升级依赖。一周下来，光是同步版本就花了一天。有没有更好的方式管理这些关联项目？

## 学习目标

- 理解 Monorepo 与 Multirepo 的取舍
- 掌握 pnpm workspace 的配置和使用
- 学会用 Turborepo 编排构建流水线
- 了解 Nx 的 affected 命令和缓存机制
- 掌握共享包的发布和版本管理策略

## 一、Monorepo 核心概念

Monorepo 将多个相关项目放在同一个 Git 仓库中管理，核心优势是**代码共享和原子提交**。

```
my-company/
├── packages/
│   ├── shared-types/      # 共享类型定义
│   ├── api-client/        # API 客户端
│   └── utils/             # 工具函数
├── apps/
│   ├── web/               # 前端应用
│   ├── admin/             # 管理后台
│   └── api/               # 后端服务
└── pnpm-workspace.yaml
```

| 维度 | Monorepo | Multirepo |
|------|----------|-----------|
| 代码共享 | 直接引用，零成本 | 发布 npm 包，有版本延迟 |
| 原子提交 | 一次提交改多个包 | 需要协调多个仓库 |
| 依赖管理 | 统一版本，避免重复 | 各自独立，可能版本冲突 |
| CI 复杂度 | 需要智能构建 | 每个仓库独立 CI |
| 适用团队 | 中小团队（<50人） | 大团队、跨组织 |

## 二、pnpm Workspace 配置

pnpm 是 Monorepo 的首选包管理器。

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"
```

```json
// apps/web/package.json
{
  "name": "@my-company/web",
  "private": true,
  "dependencies": {
    "@my-company/shared-types": "workspace:*",
    "@my-company/api-client": "workspace:*"
  }
}
```

`workspace:*` 始终使用本地版本，不会从 npm 下载。

```bash
pnpm install                          # 安装依赖，自动链接本地包
pnpm --filter @my-company/web add axios  # 给指定包添加依赖
pnpm --filter @my-company/web dev        # 运行指定包的脚本
pnpm -r run build                        # 运行所有包的 build
```

## 三、Turborepo 流水线编排

Turborepo 理解包之间的依赖关系，按正确顺序构建，并缓存构建结果。

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {},
    "test": { "dependsOn": ["build"] }
  }
}
```

`dependsOn: ["^build"]` 表示**先构建当前包的所有依赖包，再构建当前包**。

```bash
turbo build                    # 按依赖顺序构建所有包
turbo build --filter=@my-company/web  # 只构建指定包及其依赖
turbo build --dry-run          # 查看构建缓存命中情况
```

缓存机制：首次构建 ~30 秒，无变更时全部命中缓存 ~0.5 秒，修改某个包后只重建该包和依赖它的包。

## 四、Nx 的 affected 命令

Nx 的 affected 命令可以精确识别受变更影响的包。

```bash
pnpm add -D nx
nx affected --target=build       # 只对受影响的包运行 build
nx affected --target=build --dry-run  # 查看哪些包受影响
nx graph                         # 查看项目依赖图
```

| 维度 | Turborepo | Nx |
|------|-----------|-----|
| 配置复杂度 | 低（turbo.json） | 中（nx.json） |
| affected | 需配合 Git | 内置 |
| 插件生态 | 较少 | 丰富 |
| 远程缓存 | Vercel | Nx Cloud |
| 学习曲线 | 低 | 中 |
| 适用场景 | 简单 Monorepo | 大型 Monorepo |

## 五、共享包的版本管理

使用 Changesets 管理版本：

```bash
pnpm add -D @changesets/cli
pnpm changeset init        # 初始化
pnpm changeset             # 记录变更（选包 → 选版本类型 → 写说明）
pnpm changeset version     # 更新版本号
pnpm release               # 发布
```

对于 private monorepo（不发布到 npm），直接使用 `workspace:*` 引用本地包即可，版本管理不是必须的。

## 常见误区

1. **把所有东西都放进 Monorepo**：不相关的项目不需要放在一起
2. **忽略 Turborepo 缓存**：没有配置 `outputs` 字段导致缓存失效
3. **在根目录装所有依赖**：每个包应该声明自己的依赖，根目录只放工具类依赖
4. **不做 CI 优化**：Monorepo 的 CI 应该只构建受变更影响的包

## 工程建议

1. **从 pnpm + Turborepo 开始**：最简单可靠的 Monorepo 方案
2. **包命名用 scope**：`@org/package-name` 清晰且避免冲突
3. **共享配置包**：将 ESLint、Prettier、tsconfig 抽成共享包
4. **CI 中使用远程缓存**：Turborepo 支持 Vercel 远程缓存

## 小结

本课讲解了 Monorepo 的核心概念和实践方案。pnpm workspace 负责包的链接和依赖管理，Turborepo 负责构建顺序编排和缓存优化，Nx 提供更精确的 affected 分析。对于大多数项目，pnpm + Turborepo 是最平衡的选择。

## 练习

### 练习一：Workspace 配置

创建一个包含 `packages/core` 和 `apps/web` 的 pnpm workspace，其中 `web` 依赖 `core`。

### 练习二：Turborepo 配置

为上述 Monorepo 配置 Turborepo，要求：build 按依赖顺序执行、dev 不缓存、lint 可并行。

### 练习三：依赖分析

画出以下 Monorepo 的包依赖图，并说明 Turborepo 构建 `web` 时的执行顺序：

```
packages/shared-types（无依赖）
packages/api-client（依赖 shared-types）
packages/ui（依赖 shared-types）
apps/web（依赖 api-client、ui）
```

---

## 参考答案

### 练习一

**思路**：创建 pnpm-workspace.yaml，两个包通过 workspace:* 引用。

**答案**：

```yaml
# pnpm-workspace.yaml
packages: ["packages/*", "apps/*"]
```

```json
// packages/core/package.json
{ "name": "@my-org/core", "version": "0.0.0", "private": true, "main": "./src/index.ts" }
// apps/web/package.json
{ "name": "@my-org/web", "version": "0.0.0", "private": true, "dependencies": { "@my-org/core": "workspace:*" } }
```

**要点**：`workspace:*` 始终链接本地版本，`private: true` 防止意外发布。

### 练习二

**思路**：turbo.json 中 build 用 `^build` 声明依赖顺序，dev 设 `cache: false`。

**答案**：

```json
{ "tasks": { "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] }, "dev": { "cache": false, "persistent": true }, "lint": {} } }
```

**要点**：`^build` 先构建依赖包，`persistent: true` 标记 watch 模式任务，lint 无依赖可并行。

### 练习三

**思路**：画依赖图，按拓扑排序确定构建顺序。

**答案**：

```
shared-types
    ├── api-client → web
    └── ui → web
```

执行顺序：1) `shared-types:build` → 2) `api-client:build` 和 `ui:build`（并行）→ 3) `web:build`。Turborepo 自动识别可并行的任务，不相关的包可以在任何时间并行构建。
