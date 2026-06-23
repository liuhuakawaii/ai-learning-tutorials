# 08. 多包构建编排

> Turborepo 构建优化、增量构建、缓存策略——让 Monorepo 构建更快

## 本课目标

- 理解 Monorepo 构建编排的核心问题
- 掌握 Turborepo 的增量构建和缓存机制
- 学会设计合理的构建流水线

## Monorepo 构建的挑战

一个典型的 Monorepo 结构：

```
packages/
  ui/           # 依赖 utils
  utils/        # 无依赖
  config/       # 无依赖
apps/
  web/          # 依赖 ui、utils
  docs/         # 依赖 ui
```

手动构建时，你需要：
1. 先构建 `utils` 和 `config`（它们没有依赖）
2. 再构建 `ui`（它依赖 `utils`）
3. 最后构建 `web` 和 `docs`（它们依赖 `ui`）

**问题**：
- 构建顺序必须手动维护
- 每次都全量构建，即使只改了一个包
- 无法利用并行构建

## Turborepo 简介

Turborepo 是一个 Monorepo 构建工具，核心能力：
- **任务编排**：自动分析依赖关系，确定构建顺序
- **增量构建**：只构建发生变化的包
- **缓存**：缓存构建结果，避免重复工作
- **并行**：没有依赖关系的包并行构建

### 基本配置

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**关键配置**：
- `dependsOn: ["^build"]`：先构建依赖的包（`^` 表示依赖）
- `outputs`：构建产物路径，用于缓存
- `cache: false`：不缓存（dev 任务）
- `persistent: true`：长期运行的任务（dev server）

### 运行构建

```bash
# 构建所有包
turbo run build

# 只构建某个包及其依赖
turbo run build --filter=@my-lib/ui

# 构建某个包及其被依赖者
turbo run build --filter=@my-lib/ui...
```

## 依赖图与构建顺序

Turborepo 会自动分析 `package.json` 中的依赖关系，构建依赖图：

```json
// packages/ui/package.json
{
  "name": "@my-lib/ui",
  "dependencies": {
    "@my-lib/utils": "workspace:*"
  }
}
```

```
依赖图：
utils → ui → web
config → web
```

构建顺序：
```
第一轮（并行）：utils、config
第二轮：ui（依赖 utils）
第三轮：web、docs（依赖 ui）
```

### 依赖图的可视化

```bash
# 生成依赖图
turbo run build --graph

# 输出到文件
turbo run build --graph=graph.html
```

## 增量构建

### 原理

Turborepo 通过以下因素判断一个包是否需要重新构建：

1. **源文件变化**：包内的源文件是否变化
2. **依赖变化**：依赖的包是否重新构建
3. **配置变化**：turbo.json、package.json 等配置是否变化
4. **环境变量变化**：相关环境变量是否变化

```
判断流程：
  源文件 hash → 与缓存对比 → 相同则跳过 → 不同则重新构建
```

### 配置增量构建

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**",
        "tsconfig.json",
        "!src/**/*.test.*"
      ],
      "outputs": ["dist/**"]
    }
  }
}
```

**inputs**：指定哪些文件参与 hash 计算
- `src/**`：src 目录下的所有文件
- `!src/**/*.test.*`：排除测试文件（测试文件变化不需要重新构建）

### 环境变量感知

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**"],
      "outputs": ["dist/**"],
      "env": ["NODE_ENV", "API_BASE"]
    }
  }
}
```

当 `NODE_ENV` 或 `API_BASE` 变化时，会触发重新构建。

## 缓存策略

### 本地缓存

Turborepo 默认使用本地缓存，缓存目录在 `node_modules/.cache/turbo`：

```bash
# 缓存命中
turbo run build
# packages/ui:cache hit, replaying logs
# packages/utils:cache hit, replaying logs

# 缓存未命中
turbo run build
# packages/ui:cache miss, computing
# packages/utils:cache hit, replaying logs
```

### 远程缓存

团队协作时，本地缓存无法共享。远程缓存让团队成员共享构建结果：

```bash
# 登录 Vercel（Turborepo 的远程缓存服务）
npx turbo login

# 链接远程缓存
npx turbo link
```

```json
// turbo.json（不需要额外配置，Turbo 自动处理）
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

**工作流程**：

```
开发者 A 构建 ui 包 → 缓存结果上传到远程
开发者 B 构建 ui 包 → 源文件相同 → 从远程缓存下载结果
```

### 缓存失效的场景

```bash
# 1. 源文件变化
# 2. 依赖包变化
# 3. 配置文件变化（turbo.json、package.json）
# 4. 环境变量变化（如果配置了 env）
# 5. Node.js 版本变化
```

### 手动控制缓存

```bash
# 强制重新构建（忽略缓存）
turbo run build --force

# 清除缓存
turbo run build --clean

# 只构建有变化的包
turbo run build --filter=...[HEAD^1]
```

## 并行构建

Turborepo 会自动并行执行没有依赖关系的任务：

```
时间线：
  ┌─ utils ─────┐
  │              ├─ ui ─────┐
  ├─ config ────┘           ├─ web
  └─────────────────────────┘
```

`utils` 和 `config` 没有依赖关系，会并行构建。`ui` 等 `utils` 完成后才开始。

### 控制并发数

```bash
# 限制并发数（避免内存不足）
turbo run build --concurrency=4

# 限制并发百分比
turbo run build --concurrency=50%
```

## 过滤（Filter）

过滤是 Turborepo 最强大的功能之一：

```bash
# 只构建指定包
turbo run build --filter=@my-lib/ui

# 构建指定包及其依赖
turbo run build --filter=@my-lib/ui...

# 构建指定包及其被依赖者
turbo run build --filter=...@my-lib/utils

# 基于 git diff 过滤
turbo run build --filter=...[HEAD^1]

# 组合过滤
turbo run build --filter=@my-lib/ui --filter=@my-lib/utils
```

### 实际应用场景

```bash
# CI 中：只构建有变化的包
turbo run build test --filter=...[origin/main]

# 开发中：只构建当前修改的包
turbo run build --filter=@my-lib/ui

# 发布前：构建所有包
turbo run build
```

## Turborepo vs Nx

| 维度 | Turborepo | Nx |
|------|-----------|-----|
| 安装体积 | 轻量（~5 MB） | 较重（~50 MB） |
| 配置复杂度 | 简单 | 较复杂 |
| 缓存能力 | 本地 + 远程 | 本地 + 远程 + 分布式 |
| 插件生态 | 较少 | 丰富 |
| 适用场景 | 中小型 Monorepo | 大型 Monorepo |
| 学习曲线 | 低 | 中等 |

**选择建议**：
- 团队小、项目简单 → Turborepo
- 团队大、项目复杂、需要丰富的插件 → Nx

## 实战：配置多包构建流水线

### 项目结构

```
packages/
  shared/       # 公共工具
  ui/           # 组件库，依赖 shared
  hooks/        # React Hooks，依赖 shared
apps/
  web/          # Web 应用，依赖 ui、hooks
  docs/         # 文档站，依赖 ui
```

### turbo.json 配置

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "globalEnv": ["NODE_ENV"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**",
        "tsconfig.json",
        "package.json",
        "!**/*.test.*",
        "!**/*.spec.*"
      ],
      "outputs": ["dist/**"],
      "env": ["NODE_ENV"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": [
        "src/**",
        "**/*.test.*"
      ],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "inputs": [
        "src/**",
        ".eslintrc*"
      ]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**",
        "tsconfig.json"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

### CI 集成

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install dependencies
        run: pnpm install

      - name: Build and test
        run: |
          turbo run build test lint typecheck \
            --filter=...[origin/main]
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

### package.json 脚本

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean",
    "build:changed": "turbo run build --filter=...[HEAD^1]",
    "build:ui": "turbo run build --filter=@my-lib/ui..."
  }
}
```

## 常见问题排查

### 问题一：缓存没有命中

```bash
# 检查缓存状态
turbo run build --summarize

# 查看摘要
cat .turbo/runs/*.json
```

常见原因：
- 源文件变化（检查 `inputs` 配置）
- 环境变量变化（检查 `env` 配置）
- turbo.json 变化

### 问题二：构建顺序错误

```bash
# 查看依赖图
turbo run build --graph

# 检查 package.json 中的依赖声明
```

确保 `package.json` 中正确声明了 workspace 依赖：

```json
{
  "dependencies": {
    "@my-lib/utils": "workspace:*"
  }
}
```

### 问题三：构建产物不正确

```bash
# 清除缓存重新构建
turbo run build --force

# 检查 outputs 配置是否正确
```

## 常见误区

### 误区一：Turborepo 替代了 pnpm workspace

**错误理解**：有了 Turborepo 就不需要 pnpm workspace 了

**正确理解**：Turborepo 负责任务编排和缓存，pnpm workspace 负责依赖管理。两者是互补关系。

### 误区二：缓存越多越好

**错误理解**：所有任务都应该开启缓存

**正确理解**：dev 任务不应该缓存（需要实时反馈），test 任务的缓存要谨慎（测试结果可能依赖外部状态）。

### 误区三：远程缓存必须用 Vercel

**错误理解**：Turborepo 只支持 Vercel 的远程缓存

**正确理解**：Turborepo 支持自建远程缓存服务，也可以使用其他提供商（如 Turso）。

## 本课小结

1. **Monorepo 构建的核心问题**：构建顺序、增量构建、并行执行
2. **Turborepo 的核心能力**：任务编排、缓存、并行、过滤
3. **依赖图**：自动分析 package.json 依赖关系
4. **增量构建**：基于文件 hash 判断是否需要重新构建
5. **缓存策略**：本地缓存 + 远程缓存

## 练习

### 练习一：配置 Turborepo

为你的 Monorepo 项目配置 Turborepo，实现增量构建和缓存。

### 练习二：优化构建流水线

分析你的构建任务，设计合理的依赖关系和缓存策略，对比优化前后的构建时间。

## 参考答案

### 练习一

```bash
# 1. 安装 Turborepo
pnpm add turbo -Dw

# 2. 创建 turbo.json
cat > turbo.json << 'EOF'
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
EOF

# 3. 运行构建
turbo run build

# 4. 再次运行（观察缓存命中）
turbo run build
# packages/ui:cache hit
# packages/utils:cache hit
```

### 练习二

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**",
        "tsconfig.json",
        "!**/*.test.*"
      ],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**", "**/*.test.*"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "inputs": ["src/**", ".eslintrc*"]
    }
  }
}
```

```bash
# 对比优化前后
# 优化前：每次全量构建 ~60s
# 优化后：缓存命中 ~3s，增量构建 ~15s
```

## 下一步

完成本课后，继续学习 [09. 构建产物分析](./09-bundle-analysis.md)。
