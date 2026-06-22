# tsconfig 深度配置

## 场景引入

你接手了一个有 500+ 文件的 TypeScript 项目，发现每次修改一个文件，全量编译要 30 秒；import 路径全是 `../../../../components/Button` 这种相对路径；团队成员的 IDE 提示各不相同。这些问题的根源都在 `tsconfig.json` 配置不够精细。

## 学习目标

- 掌握 strict mode 各个细粒度标志的含义与取舍
- 学会配置路径别名消除相对路径地狱
- 理解项目引用（Project References）的工作原理和配置方式
- 掌握增量编译与 composite 项目的配置
- 了解 moduleResolution 各选项的差异与适用场景

## 一、Strict Mode 细粒度控制

`"strict": true` 是一个总开关，同时启用以下所有标志。大型项目迁移时，你可能需要逐个开启而不是一次性全开。

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "useUnknownInCatchVariables": true
  }
}
```

| 标志 | 作用 | 典型场景 |
|------|------|----------|
| `strictNullChecks` | null/undefined 不能赋给其他类型 | `const x: string = null` 报错 |
| `strictFunctionTypes` | 函数参数类型严格协变 | 回调函数类型不匹配时报错 |
| `strictPropertyInitialization` | 类属性必须在构造器中初始化 | 未初始化的类属性报错 |
| `noImplicitAny` | 禁止隐式 any | 未标注类型的变量报错 |
| `useUnknownInCatchVariables` | catch 中 error 类型为 unknown | `catch(e)` 中 e 是 unknown |

```typescript
// strictNullChecks 示例
function getUser(id: string): User | null {
  return database.find(id) ?? null;
}

const user = getUser("123");
// console.log(user.name); // ❌ 报错：user 可能为 null
console.log(user?.name);   // ✅ 可选链
```

**迁移策略**：从 `strictNullChecks` 和 `noImplicitAny` 开始，这两个对代码质量提升最大。

## 二、路径别名配置

路径别名可以消除深层相对路径，让 import 语句更清晰。

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"],
      "@shared/*": ["packages/shared/src/*"]
    }
  }
}
```

```typescript
// 配置前：相对路径地狱
import { Button } from "../../../../components/Button";
// 配置后：清晰的别名路径
import { Button } from "@components/Button";
```

**重要提醒**：`tsc` 编译时不会将路径别名转换为真实路径，需要配合 tsc-alias 或打包工具。TypeScript 5.x+ 推荐使用 bundler 模式：

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

## 三、项目引用与 Composite 项目

当项目规模增长到多个子包时，项目引用允许 TypeScript 只编译变更的部分。

```json
// tsconfig.json（根目录）
{
  "files": [],
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/utils" },
    { "path": "./apps/web" }
  ]
}
```

```json
// packages/shared/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  },
  "include": ["src"]
}
```

```json
// apps/web/tsconfig.json
{
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src"],
  "references": [{ "path": "../../packages/shared" }]
}
```

```bash
tsc --build          # 增量编译
tsc --build --clean  # 清除构建产物
tsc --build --watch  # watch 模式
```

`composite: true` 的要求：必须开启 `declaration: true`，rootDir 默认为 tsconfig.json 所在目录，必须显式包含文件。

## 四、增量编译与 Module Resolution

增量编译通过 `.tsbuildinfo` 文件缓存编译状态，跳过未变更文件的类型检查：

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./node_modules/.cache/.tsbuildinfo"
  }
}
```

`moduleResolution` 决定 TypeScript 如何查找 import 对应的文件：

| 策略 | 特点 | 适用场景 |
|------|------|----------|
| `node` | 经典解析，忽略 exports 字段 | 旧项目、纯 CommonJS |
| `node16` | 支持 exports，强制 .js 后缀 | Node.js 16+ ESM 项目 |
| `nodenext` | node16 超集，跟进最新规范 | Node.js 最新版 |
| `bundler` | 允许无后缀 import，支持 exports | Webpack/Vite/esbuild |

```typescript
// node16 模式：import 必须带 .js 后缀
import { helper } from "./utils.js"; // ✅
import { helper } from "./utils";    // ❌ 报错

// bundler 模式：两种写法都可以
import { helper } from "./utils";    // ✅
```

## 常见误区

1. **误以为 `strict: true` 可以一次性开启**：大项目直接开 strict 会产生上千个错误，应该逐个子选项开启
2. **路径别名配完就不管了**：路径别名只在 IDE 中生效，编译产物中还是原始路径
3. **`composite` 和 `incremental` 混为一谈**：composite 会自动开启 incremental，但 incremental 不会自动开启 composite
4. **忽略 `declarationMap`**：不开 declarationMap，从 node_modules 跳转源码时只能看到 .d.ts

## 工程建议

1. **新建项目直接开 strict**：从第一行代码就用 strict，避免后续迁移的痛苦
2. **路径别名统一用 `@/` 前缀**：业界最常见约定，新成员上手零成本
3. **Monorepo 必用项目引用**：超过 3 个子包的项目，不用项目引用会导致编译时间不可接受
4. **把 tsconfig 放进共享包**：团队内多个项目的 tsconfig 应该继承自一个共享的基础配置

## 小结

本课深入讲解了 tsconfig.json 的高级配置：strict mode 的细粒度控制让你渐进式提升类型安全，路径别名消除相对路径地狱，项目引用和增量编译大幅降低大项目的编译时间，moduleResolution 的选择决定了你的项目与生态的兼容性。

## 练习

### 练习一：Strict Mode 迁移

你有一个旧项目，目前 `"strict": false`，包含大量隐式 any 和未检查的 null。请制定一个分阶段开启 strict mode 的计划。

### 练习二：路径别名配置

为以下项目结构配置路径别名，要求支持 `@components/Button`、`@utils/format`、`@shared/types` 三种别名写法：

```
project/
├── src/
│   ├── components/
│   ├── utils/
│   └── index.ts
├── packages/
│   └── shared/
│       └── src/
│           └── types.ts
└── tsconfig.json
```

### 练习三：项目引用

给一个包含 `packages/core`、`packages/ui`、`apps/web` 的 Monorepo 配置项目引用，其中 `ui` 依赖 `core`，`web` 依赖 `ui` 和 `core`。

---

## 参考答案

### 练习一

**思路**：分三阶段迁移，每阶段开启高价值标志，修复报错后再进入下一阶段。

**答案**：第一阶段开启 `strictNullChecks` + `noImplicitAny`（收益最大），第二阶段加入 `strictFunctionTypes` + `strictBindCallApply`，第三阶段全量开启 `strict: true`。每阶段修复完所有报错后再进入下一阶段，可用 `// @ts-expect-error` 临时标注无法立即修复的地方。

### 练习二

**思路**：使用 `baseUrl` 和 `paths` 组合。

**答案**：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"],
      "@shared/*": ["packages/shared/src/*"]
    }
  }
}
```

**要点**：`baseUrl` 设为项目根目录，paths 中的 `*` 匹配任意路径片段，编译后需用 tsc-alias 替换别名。

### 练习三

**思路**：每个子包需要 `composite: true`，通过 `references` 声明依赖关系。

**答案**：

```json
// packages/core/tsconfig.json
{ "compilerOptions": { "composite": true, "outDir": "./dist", "declaration": true, "declarationMap": true }, "include": ["src"] }
// packages/ui/tsconfig.json
{ "compilerOptions": { "composite": true, "outDir": "./dist", "declaration": true, "declarationMap": true }, "include": ["src"], "references": [{ "path": "../core" }] }
// apps/web/tsconfig.json
{ "compilerOptions": { "composite": true, "outDir": "./dist" }, "include": ["src"], "references": [{ "path": "../../packages/core" }, { "path": "../../packages/ui" }] }
// 根目录 tsconfig.json
{ "files": [], "references": [{ "path": "./packages/core" }, { "path": "./packages/ui" }, { "path": "./apps/web" }] }
```

**要点**：被依赖的包必须开启 `composite: true`，根目录只声明引用顺序，使用 `tsc --build` 触发增量编译。
