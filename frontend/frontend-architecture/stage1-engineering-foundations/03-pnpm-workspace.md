# 03. pnpm workspace 深度实践

> 多包管理、依赖安装、脚本编排，掌握 pnpm workspace 的核心能力

## 本课目标

- 掌握 pnpm workspace 的配置和使用
- 理解 pnpm 的依赖管理机制
- 学会使用 pnpm 管理多包项目
- 掌握 pnpm 的常用命令和技巧

## 为什么选择 pnpm

### npm 的问题

1. **依赖嵌套**：每个包都有自己的 node_modules，导致目录层级深
2. **磁盘浪费**：相同的依赖在多个项目中重复安装
3. **安装速度慢**：需要下载和解压所有依赖
4. **幽灵依赖**：依赖提升后，可以访问未声明的包

### yarn 的改进

1. **扁平化**：将依赖提升到根目录，减少嵌套
2. **缓存机制**：缓存已下载的包，减少重复下载
3. **并行安装**：同时安装多个包，提高速度

### pnpm 的优势

1. **硬链接**：通过硬链接共享依赖，节省磁盘空间
2. **符号链接**：通过符号链接创建 node_modules 结构
3. **严格模式**：默认禁止幽灵依赖
4. **速度快**：安装速度比 npm/yarn 快 2-3 倍

## pnpm 的核心机制

### 硬链接和符号链接

**硬链接**：
```
~/.pnpm-store/
  └── lodash@4.17.21/
      └── node_modules/
          └── lodash/
              └── index.js

project/
  └── node_modules/
      └── lodash/  → 硬链接到 ~/.pnpm-store/
```

**符号链接**：
```
project/
  └── node_modules/
      └── @myorg/
          └── utils/  → 符号链接到 packages/utils
```

### pnpm 的 node_modules 结构

```
node_modules/
├── .pnpm/                    # 所有依赖的硬链接
│   ├── lodash@4.17.21/
│   │   └── node_modules/
│   │       └── lodash/
│   └── react@18.2.0/
│       └── node_modules/
│           └── react/
├── lodash -> .pnpm/lodash@4.17.21/node_modules/lodash  # 符号链接
└── react -> .pnpm/react@18.2.0/node_modules/react      # 符号链接
```

## 配置 pnpm workspace

### 创建 workspace 配置

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tools/*'
```

### 根目录 package.json

```json
{
  "name": "@myorg/monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### 子包 package.json

```json
{
  "name": "@myorg/utils",
  "version": "1.0.0",
  "dependencies": {
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "@myorg/config": "workspace:*"
  }
}
```

## pnpm 常用命令

### 安装依赖

```bash
# 安装所有依赖
pnpm install

# 安装指定包到根目录
pnpm add -w lodash

# 安装指定包到指定包
pnpm --filter @myorg/utils add lodash

# 安装开发依赖
pnpm add -D -w typescript

# 安装全局依赖
pnpm add -g typescript
```

### 运行脚本

```bash
# 在所有包中运行脚本
pnpm -r run build

# 在指定包中运行脚本
pnpm --filter @myorg/utils run build

# 在匹配的包中运行脚本
pnpm --filter "./packages/*" run build

# 并行运行脚本
pnpm -r --parallel run dev
```

### 依赖管理

```bash
# 查看依赖树
pnpm list

# 查看指定包的依赖树
pnpm list --filter @myorg/utils

# 查看过时的依赖
pnpm outdated

# 更新依赖
pnpm update

# 更新指定包的依赖
pnpm update --filter @myorg/utils
```

### 包管理

```bash
# 创建新包
pnpm init

# 发布包
pnpm publish

# 发布所有包
pnpm -r publish
```

## workspace 协议

### 协议类型

```json
{
  "dependencies": {
    "@myorg/utils": "workspace:*",
    "@myorg/ui": "workspace:^1.0.0",
    "@myorg/config": "workspace:~1.0.0"
  }
}
```

**说明**：
- `workspace:*`：匹配任何版本，发布时替换为实际版本
- `workspace:^1.0.0`：匹配 ^1.0.0，发布时替换为 ^1.0.0
- `workspace:~1.0.0`：匹配 ~1.0.0，发布时替换为 ~1.0.0

### 发布时的行为

```json
// 开发时
{
  "dependencies": {
    "@myorg/utils": "workspace:*"
  }
}

// 发布后
{
  "dependencies": {
    "@myorg/utils": "1.0.0"
  }
}
```

## 依赖提升配置

### 默认行为

pnpm 默认**不提升**依赖，严格模式。

```javascript
// packages/a/src/index.js
import _ from 'lodash';  // 报错：lodash 未声明
```

### 配置提升

```ini
# .npmrc
# 不提升（默认）
shamefully-hoist=false

# 提升所有依赖
shamefully-hoist=true

# 提升指定依赖
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
```

### 推荐配置

```ini
# .npmrc
# 严格模式，禁止幽灵依赖
shamefully-hoist=false

# 允许提升的依赖
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
public-hoist-pattern[]=*jest*

# 允许安装未匹配的 peer dependencies
strict-peer-dependencies=false
```

## 脚本编排

### 基本用法

```bash
# 在所有包中运行 build
pnpm -r run build

# 在指定包中运行
pnpm --filter @myorg/utils run build

# 并行运行
pnpm -r --parallel run dev
```

### 过滤器

```bash
# 按包名过滤
pnpm --filter @myorg/utils run build

# 按目录过滤
pnpm --filter "./packages/*" run build

# 按依赖关系过滤
pnpm --filter @myorg/utils... run build

# 排除指定包
pnpm --filter "!@myorg/docs" run build
```

### 组合命令

```json
{
  "scripts": {
    "build": "pnpm -r run build",
    "build:packages": "pnpm --filter './packages/*' run build",
    "build:apps": "pnpm --filter './apps/*' run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint",
    "clean": "pnpm -r run clean"
  }
}
```

## 实战：搭建 pnpm workspace 项目

### 项目结构

```
my-monorepo/
├── package.json
├── pnpm-workspace.yaml
├── .npmrc
├── packages/
│   ├── utils/
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts
│   └── ui/
│       ├── package.json
│       └── src/
│           └── index.ts
└── apps/
    └── web/
        ├── package.json
        └── src/
            └── main.ts
```

### 配置文件

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

```ini
# .npmrc
shamefully-hoist=false
strict-peer-dependencies=false
```

```json
// 根目录 package.json
{
  "name": "@myorg/monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r run build",
    "dev": "pnpm -r --parallel run dev",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

```json
// packages/utils/package.json
{
  "name": "@myorg/utils",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

```json
// apps/web/package.json
{
  "name": "@myorg/web",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@myorg/utils": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### 使用示例

```typescript
// packages/utils/src/index.ts
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
```

```typescript
// apps/web/src/main.ts
import { add, multiply } from '@myorg/utils';

console.log(add(1, 2));      // 3
console.log(multiply(2, 3)); // 6
```

## 常见问题

### Q: pnpm 和 npm/yarn 的区别？

A: pnpm 通过硬链接和符号链接实现依赖安装，节省磁盘空间，避免幽灵依赖，安装速度更快。

### Q: 如何解决幽灵依赖？

A: 配置 `shamefully-hoist=false`，显式声明所有依赖。

### Q: 如何提升特定依赖？

A: 配置 `public-hoist-pattern[]`，例如 `public-hoist-pattern[]=*eslint*`。

### Q: 如何并行运行脚本？

A: 使用 `pnpm -r --parallel run <script>`。

## 本课小结

本课我们掌握了 pnpm workspace 的核心能力：

1. **pnpm 的优势**：硬链接、符号链接、严格模式
2. **workspace 配置**：pnpm-workspace.yaml、workspace 协议
3. **依赖管理**：安装、提升、过滤
4. **脚本编排**：并行运行、过滤器、组合命令
5. **实战搭建**：从零搭建 pnpm workspace 项目

## 练习

### 练习一：搭建 pnpm workspace 项目

搭建一个包含以下结构的 pnpm workspace 项目：
- `packages/math`：数学函数库
- `packages/string`：字符串处理库
- `apps/demo`：演示应用

**要求**：
- demo 依赖 math 和 string
- 实现 add、subtract、toUpperCase、toLowerCase 函数
- demo 中使用这些函数

### 练习二：配置脚本编排

为练习一的项目配置以下脚本：
- `pnpm build`：构建所有包
- `pnpm dev`：并行启动所有包的开发模式
- `pnpm test`：运行所有包的测试
- `pnpm lint`：检查所有包的代码规范

## 参考答案

### 练习一

**项目结构**：
```
my-monorepo/
├── package.json
├── pnpm-workspace.yaml
├── packages/
│   ├── math/
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts
│   └── string/
│       ├── package.json
│       └── src/
│           └── index.ts
└── apps/
    └── demo/
        ├── package.json
        └── src/
            └── main.ts
```

**代码实现**：
```typescript
// packages/math/src/index.ts
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}
```

```typescript
// packages/string/src/index.ts
export function toUpperCase(str: string): string {
  return str.toUpperCase();
}

export function toLowerCase(str: string): string {
  return str.toLowerCase();
}
```

```typescript
// apps/demo/src/main.ts
import { add, subtract } from '@myorg/math';
import { toUpperCase, toLowerCase } from '@myorg/string';

console.log(add(1, 2));           // 3
console.log(subtract(5, 3));      // 2
console.log(toUpperCase('hello')); // HELLO
console.log(toLowerCase('WORLD')); // world
```

### 练习二

**配置脚本**：
```json
{
  "scripts": {
    "build": "pnpm -r run build",
    "dev": "pnpm -r --parallel run dev",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint"
  }
}
```

## 下一步

完成本课后，继续学习 [04. Turborepo 构建编排与缓存策略](./04-turborepo.md)。
