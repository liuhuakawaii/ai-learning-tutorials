# 04. Turborepo 构建编排与缓存策略

> 构建顺序、增量构建、远程缓存，掌握 Turborepo 的核心能力

## 本课目标

- 理解 Turborepo 的核心概念和优势
- 掌握构建编排和依赖关系管理
- 学会配置本地缓存和远程缓存
- 掌握 Turborepo 的常用命令和技巧

## 为什么需要 Turborepo

### Monorepo 的构建问题

假设你有一个包含 10 个包的 Monorepo：

```bash
# 每次构建都要构建所有包
pnpm -r run build

# 即只修改了一个包，也要构建所有包
# 构建时间：5 分钟
```

**问题**：
1. **构建顺序**：包间有依赖关系，需要按顺序构建
2. **重复构建**：没有修改的包也要重新构建
3. **并行构建**：没有依赖关系的包可以并行构建
4. **缓存机制**：相同输入应该产出相同输出

### Turborepo 的解决方案

```bash
# 使用 Turborepo 构建
turbo run build

# 只构建有修改的包
turbo run build --filter=...[HEAD^1]

# 构建时间：30 秒
```

**Turborepo 的优势**：
1. **智能编排**：自动分析依赖关系，按顺序构建
2. **增量构建**：只构建有修改的包
3. **并行构建**：没有依赖关系的包并行构建
4. **缓存机制**：相同输入直接使用缓存

## Turborepo 核心概念

### 任务（Task）

任务是 Turborepo 的基本单位，对应 package.json 中的 scripts。

```json
{
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src"
  }
}
```

### 管道（Pipeline）

管道定义了任务的依赖关系和缓存策略。

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    }
  }
}
```

**配置说明**：
- `dependsOn`：任务依赖关系
  - `^build`：依赖所有包的 build 任务
  - `build`：依赖当前包的 build 任务
- `outputs`：任务输出目录，用于缓存

### 依赖关系

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

**依赖关系图**：
```
packages/utils/ build
    ↓
packages/ui/ build
    ↓
apps/web/ build
```

## 配置 Turborepo

### 安装

```bash
pnpm add -D -w turbo
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**/*.tsx", "src/**/*.ts", "test/**/*.ts", "test/**/*.tsx"]
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**配置说明**：
- `globalDependencies`：全局依赖文件，修改后所有任务缓存失效
- `pipeline`：任务配置
  - `dependsOn`：依赖关系
  - `outputs`：输出目录
  - `inputs`：输入文件（可选）
  - `cache`：是否缓存（默认 true）
  - `persistent`：是否持久化（dev 任务）

### 根目录 package.json

```json
{
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev"
  }
}
```

## 构建编排

### 依赖关系分析

Turborepo 会自动分析包间依赖关系：

```json
// packages/ui/package.json
{
  "dependencies": {
    "@myorg/utils": "workspace:*"
  }
}
```

**依赖关系**：
```
packages/utils
    ↓
packages/ui
    ↓
apps/web
```

### 构建顺序

```bash
# Turborepo 自动按依赖顺序构建
turbo run build

# 构建顺序：
# 1. packages/utils/ build
# 2. packages/ui/ build
# 3. apps/web/ build
```

### 并行构建

没有依赖关系的包可以并行构建：

```bash
# packages/a 和 packages/b 没有依赖关系
# 可以并行构建

turbo run build

# 并行构建：
# 1. packages/a/ build ┐
#                      ├─ 并行
# 2. packages/b/ build ┘
# 3. apps/web/ build
```

### 过滤器

```bash
# 只构建指定包
turbo run build --filter=@myorg/utils

# 构建指定包及其依赖
turbo run build --filter=@myorg/utils...

# 构建依赖指定包的包
turbo run build --filter=...@myorg/utils

# 构建匹配目录的包
turbo run build --filter=./packages/*

# 排除指定包
turbo run build --filter=!@myorg/docs
```

## 缓存机制

### 本地缓存

Turborepo 会自动缓存任务输出：

```bash
# 第一次构建
turbo run build
# 构建时间：2 分钟

# 第二次构建（没有修改）
turbo run build
# 构建时间：0.1 秒（使用缓存）

# 第三次构建（修改了 utils）
turbo run build
# 只重新构建 utils 及其依赖
# 构建时间：30 秒
```

### 缓存键

Turborepo 根据以下因素生成缓存键：
1. **输入文件**：源代码、配置文件等
2. **依赖版本**：package.json 中的依赖版本
3. **环境变量**：globalDependencies 中的文件
4. **任务配置**：pipeline 中的配置

### 缓存目录

```bash
# 默认缓存目录
node_modules/.cache/turbo

# 清除缓存
turbo run build --force

# 清除所有缓存
rm -rf node_modules/.cache/turbo
```

### 缓存策略

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "inputs": ["src/**/*.ts", "src/**/*.tsx"],
      "outputMode": "full"
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**/*.ts", "test/**/*.ts"],
      "outputMode": "errors-only"
    }
  }
}
```

**配置说明**：
- `inputs`：指定输入文件，默认为所有文件
- `outputMode`：输出模式
  - `full`：显示完整输出
  - `hash-only`：只显示哈希值
  - `new-only`：只显示新任务的输出
  - `errors-only`：只显示错误输出
  - `none`：不显示输出

## 远程缓存

### 为什么需要远程缓存

**本地缓存的问题**：
- 每个开发者都有自己的缓存
- CI/CD 环境没有缓存
- 无法共享缓存

**远程缓存的优势**：
- 团队共享缓存
- CI/CD 使用缓存
- 跨机器共享

### Turborepo 远程缓存

```bash
# 登录 Turborepo
turbo login

# 链接远程缓存
turbo link

# 使用远程缓存
turbo run build
```

### 自建远程缓存

可以使用 S3、Azure Blob Storage 等自建远程缓存：

```json
// turbo.json
{
  "remoteCache": {
    "provider": "s3",
    "options": {
      "bucket": "my-turbo-cache",
      "region": "us-east-1"
    }
  }
}
```

### 缓存共享

```bash
# 开发者 A 构建
turbo run build
# 缓存上传到远程

# 开发者 B 构建
turbo run build
# 从远程缓存下载

# CI/CD 构建
turbo run build
# 从远程缓存下载
```

## 实战：配置 Turborepo

### 项目结构

```
my-monorepo/
├── package.json
├── turbo.json
├── pnpm-workspace.yaml
├── packages/
│   ├── utils/
│   │   ├── package.json
│   │   └── src/
│   └── ui/
│       ├── package.json
│       └── src/
└── apps/
    └── web/
        ├── package.json
        └── src/
```

### 配置文件

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "inputs": ["src/**/*.ts", "src/**/*.tsx"],
      "outputMode": "full"
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**/*.ts", "test/**/*.ts"],
      "outputMode": "errors-only"
    },
    "lint": {
      "outputs": [],
      "outputMode": "full"
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

```json
// 根目录 package.json
{
  "name": "@myorg/monorepo",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "turbo": "^1.10.0"
  }
}
```

```json
// packages/utils/package.json
{
  "name": "@myorg/utils",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src",
    "clean": "rm -rf dist"
  }
}
```

```json
// apps/web/package.json
{
  "name": "@myorg/web",
  "version": "1.0.0",
  "dependencies": {
    "@myorg/utils": "workspace:*",
    "@myorg/ui": "workspace:*"
  },
  "scripts": {
    "build": "next build",
    "dev": "next dev",
    "test": "jest",
    "lint": "eslint src",
    "clean": "rm -rf .next"
  }
}
```

### 使用示例

```bash
# 构建所有包
turbo run build

# 只构建 utils
turbo run build --filter=@myorg/utils

# 构建 utils 及其依赖
turbo run build --filter=@myorg/utils...

# 构建依赖 utils 的包
turbo run build --filter=...@myorg/utils

# 强制重新构建（忽略缓存）
turbo run build --force

# 查看构建任务
turbo run build --dry

# 查看依赖关系图
turbo run build --graph
```

## 常见问题

### Q: Turborepo 和 Nx 哪个更好？

A: Turborepo 更轻量，适合中小型项目；Nx 功能更强大，适合大型项目。根据团队需求选择。

### Q: 如何清除缓存？

A: 使用 `turbo run build --force` 或删除 `node_modules/.cache/turbo` 目录。

### Q: 如何查看构建任务？

A: 使用 `turbo run build --dry` 查看构建任务，使用 `turbo run build --graph` 查看依赖关系图。

### Q: 如何配置远程缓存？

A: 使用 `turbo login` 和 `turbo link` 配置 Turborepo 远程缓存，或自建远程缓存。

## 本课小结

本课我们掌握了 Turborepo 的核心能力：

1. **构建编排**：自动分析依赖关系，按顺序构建
2. **增量构建**：只构建有修改的包
3. **并行构建**：没有依赖关系的包并行构建
4. **缓存机制**：本地缓存和远程缓存
5. **过滤器**：灵活的包过滤和任务过滤

## 练习

### 练习一：配置 Turborepo

为一个包含以下包的项目配置 Turborepo：
- `packages/utils`：工具函数库
- `packages/ui`：组件库
- `apps/web`：Web 应用

**要求**：
- 配置 build、test、lint 任务
- 配置正确的依赖关系
- 配置输出目录

### 练习二：优化构建流程

使用 Turborepo 的过滤器和缓存机制优化构建流程：
- 只构建修改的包
- 使用缓存加速构建
- 并行构建没有依赖关系的包

## 参考答案

### 练习一

**turbo.json 配置**：
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    }
  }
}
```

### 练习二

**优化命令**：
```bash
# 只构建修改的包
turbo run build --filter=...[HEAD^1]

# 使用缓存
turbo run build

# 并行构建
turbo run build --concurrency=100%

# 查看构建任务
turbo run build --dry
```

## 下一步

完成本课后，继续学习 [05. 包间依赖管理与版本策略](./05-dependency-management.md)。
