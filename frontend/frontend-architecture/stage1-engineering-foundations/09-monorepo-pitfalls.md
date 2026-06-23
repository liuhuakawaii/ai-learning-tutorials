# 09. Monorepo 常见坑与解决方案

> 幽灵依赖、循环依赖、构建顺序，避免 Monorepo 的常见陷阱

## 本课目标

- 识别 Monorepo 的常见问题
- 掌握幽灵依赖的解决方案
- 学会处理循环依赖
- 建立 Monorepo 的最佳实践

## 幽灵依赖

### 什么是幽灵依赖

幽灵依赖是指**代码中使用了某个包，但 package.json 中没有声明依赖**。

**问题场景**：
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

#### 方案一：严格模式

```ini
# .npmrc
shamefully-hoist=false
```

**效果**：
- 禁止依赖提升
- 每个包只能访问自己声明的依赖
- 幽灵依赖会报错

#### 方案二：显式声明依赖

```json
// packages/b/package.json
{
  "dependencies": {
    "axios": "^1.0.0",
    "lodash": "^4.17.21"  // 显式声明
  }
}
```

#### 方案三：使用 pnpm 的 strict 模式

```ini
# .npmrc
shamefully-hoist=false
strict-peer-dependencies=true
```

#### 方案四：使用 ESLint 检查

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'import/no-extraneous-dependencies': ['error', {
      devDependencies: false,
      optionalDependencies: false,
      peerDependencies: false,
    }],
  },
};
```

## 循环依赖

### 什么是循环依赖

```
packages/a → packages/b → packages/a  # 循环！
```

**问题场景**：
```javascript
// packages/a/src/index.js
import { b } from '@myorg/b';

export function a() {
  return b();
}

// packages/b/src/index.js
import { a } from '@myorg/a';

export function b() {
  return a();
}
```

### 循环依赖的危害

1. **构建失败**：构建工具无法确定构建顺序
2. **运行时错误**：模块可能未完全加载
3. **代码质量**：通常意味着架构设计问题

### 检测循环依赖

#### 方案一：使用 madge

```bash
# 安装 madge
pnpm add -D madge

# 检测循环依赖
madge --circular src/index.ts
```

#### 方案二：使用 ESLint

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'import/no-cycle': ['error', { maxDepth: 1 }],
  },
};
```

#### 方案三：使用 Turborepo

```bash
# 查看依赖关系图
turbo run build --graph
```

### 解决循环依赖

#### 方案一：提取公共模块

**问题**：
```
packages/a → packages/b
packages/b → packages/a
```

**解决方案**：
```
packages/a → packages/common
packages/b → packages/common
```

**示例**：
```javascript
// packages/common/src/index.js
export function shared() {
  return 'shared';
}

// packages/a/src/index.js
import { shared } from '@myorg/common';

export function a() {
  return shared();
}

// packages/b/src/index.js
import { shared } from '@myorg/common';

export function b() {
  return shared();
}
```

#### 方案二：依赖倒置

**问题**：
```
packages/a → packages/b
packages/b → packages/a
```

**解决方案**：
```
packages/a → packages/interface
packages/b → packages/interface
```

**示例**：
```javascript
// packages/interface/src/index.js
export interface IProcessor {
  process(data: any): any;
}

// packages/a/src/index.js
import { IProcessor } from '@myorg/interface';

export class ProcessorA implements IProcessor {
  process(data: any) {
    return data;
  }
}

// packages/b/src/index.js
import { IProcessor } from '@myorg/interface';

export function useProcessor(processor: IProcessor) {
  return processor.process({});
}
```

#### 方案三：运行时依赖

**问题**：
```
packages/a → packages/b
packages/b → packages/a
```

**解决方案**：
```javascript
// packages/a/src/index.js
export function getB() {
  return require('./b');  // 运行时依赖
}
```

## 构建顺序问题

### 什么是构建顺序问题

**问题场景**：
```
packages/utils → packages/ui → apps/web
```

**构建顺序**：
1. packages/utils
2. packages/ui
3. apps/web

**问题**：
- 如何确定构建顺序？
- 如何并行构建？
- 如何处理构建失败？

### 解决构建顺序

#### 方案一：使用 Turborepo

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

**效果**：
- Turborepo 自动分析依赖关系
- 按依赖顺序构建
- 支持并行构建

#### 方案二：使用 pnpm filter

```bash
# 按依赖顺序构建
pnpm --filter @myorg/utils... run build

# 并行构建
pnpm -r --parallel run build
```

#### 方案三：手动指定构建顺序

```json
{
  "scripts": {
    "build": "pnpm --filter @myorg/utils run build && pnpm --filter @myorg/ui run build && pnpm --filter @myorg/web run build"
  }
}
```

## 依赖版本不一致

### 什么是依赖版本不一致

**问题场景**：
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
    "lodash": "^4.17.22"
  }
}
```

**问题**：
- 不同包使用不同版本
- 可能导致行为不一致
- 增加维护成本

### 解决依赖版本不一致

#### 方案一：使用 pnpm overrides

```json
// 根目录 package.json
{
  "pnpm": {
    "overrides": {
      "lodash": "^4.17.21"
    }
  }
}
```

#### 方案二：统一版本

```json
// 根目录 package.json
{
  "devDependencies": {
    "lodash": "^4.17.21"
  }
}
```

#### 方案三：使用 workspace 协议

```json
// packages/a/package.json
{
  "dependencies": {
    "@myorg/utils": "workspace:*"
  }
}
```

## 权限管理问题

### 什么是权限管理问题

**问题场景**：
- 所有开发者都可以访问所有代码
- 无法限制特定包的访问权限
- 安全风险

### 解决权限管理

#### 方案一：使用 CODEOWNERS

```
# .github/CODEOWNERS
/packages/utils/ @team-a
/packages/ui/ @team-b
/apps/web/ @team-c
```

#### 方案二：使用分支保护

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches:
      - main

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm test
```

#### 方案三：使用 npm 私有包

```json
// packages/utils/package.json
{
  "name": "@myorg/utils",
  "private": true
}
```

## 调试困难

### 什么是调试困难

**问题场景**：
- 依赖提升后，难以确定依赖来源
- 符号链接导致调试困惑
- 源码映射不准确

### 解决调试困难

#### 方案一：禁用依赖提升

```ini
# .npmrc
shamefully-hoist=false
```

#### 方案二：配置源码映射

```json
// packages/utils/package.json
{
  "scripts": {
    "build": "tsc --sourceMap"
  }
}
```

#### 方案三：使用调试工具

```bash
# 使用 Node.js 调试器
node --inspect node_modules/.bin/tsc

# 使用 VS Code 调试器
# 配置 .vscode/launch.json
```

## 实战：解决 Monorepo 问题

### 项目结构

```
my-monorepo/
├── .npmrc
├── package.json
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

```ini
# .npmrc
shamefully-hoist=false
strict-peer-dependencies=true
```

```json
// 根目录 package.json
{
  "pnpm": {
    "overrides": {
      "lodash": "^4.17.21"
    }
  }
}
```

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

### 使用示例

```bash
# 检测幽灵依赖
pnpm install

# 检测循环依赖
madge --circular src/index.ts

# 查看依赖关系图
turbo run build --graph

# 构建项目
turbo run build
```

## 最佳实践

### 1. 禁用依赖提升

```ini
# .npmrc
shamefully-hoist=false
```

### 2. 显式声明依赖

```json
{
  "dependencies": {
    "lodash": "^4.17.21"
  }
}
```

### 3. 统一依赖版本

```json
{
  "pnpm": {
    "overrides": {
      "lodash": "^4.17.21"
    }
  }
}
```

### 4. 检测循环依赖

```bash
madge --circular src/index.ts
```

### 5. 使用 Turborepo

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

## 常见问题

### Q: 如何解决幽灵依赖？

A: 配置 `shamefully-hoist=false`，显式声明所有依赖。

### Q: 如何检测循环依赖？

A: 使用 `madge --circular` 或 ESLint `import/no-cycle` 规则。

### Q: 如何解决构建顺序问题？

A: 使用 Turborepo 自动分析依赖关系，按顺序构建。

### Q: 如何统一依赖版本？

A: 使用 pnpm overrides 统一版本。

## 本课小结

本课我们掌握了 Monorepo 常见问题的解决方案：

1. **幽灵依赖**：禁用依赖提升，显式声明依赖
2. **循环依赖**：提取公共模块，依赖倒置
3. **构建顺序**：使用 Turborepo 自动分析
4. **依赖版本不一致**：使用 pnpm overrides
5. **权限管理**：使用 CODEOWNERS 和分支保护

## 练习

### 练习一：解决幽灵依赖

分析以下代码，找出幽灵依赖并解决：
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

### 练习二：解决循环依赖

分析以下代码，找出循环依赖并解决：
```javascript
// packages/a/src/index.js
import { b } from '@myorg/b';

export function a() {
  return b();
}

// packages/b/src/index.js
import { a } from '@myorg/a';

export function b() {
  return a();
}
```

## 参考答案

### 练习一

**问题**：packages/b 使用了 lodash，但没有声明依赖。

**解决方案**：
```json
// packages/b/package.json
{
  "dependencies": {
    "axios": "^1.0.0",
    "lodash": "^4.17.21"  // 显式声明
  }
}
```

### 练习二

**问题**：packages/a 和 packages/b 循环依赖。

**解决方案**：
```javascript
// packages/common/src/index.js
export function shared() {
  return 'shared';
}

// packages/a/src/index.js
import { shared } from '@myorg/common';

export function a() {
  return shared();
}

// packages/b/src/index.js
import { shared } from '@myorg/common';

export function b() {
  return shared();
}
```

## 下一步

完成本课后，继续学习 [10. 阶段项目：搭建 Monorepo 项目骨架](./10-stage-project.md)。
