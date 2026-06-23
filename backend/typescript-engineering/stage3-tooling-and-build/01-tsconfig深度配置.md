# tsconfig 深度配置

你接手了一个 500+ 文件的 TypeScript 项目。改一行代码，全量编译 30 秒。打开一个文件，import 路径是 `../../../../components/Button`。新同事 clone 下来，IDE 报一堆红线但代码能跑。

这三个问题的根因都是同一个东西：tsconfig.json 配置太粗。

## Strict Mode 不是一刀切

`"strict": true` 是个总开关，背后是 8 个独立标志。大项目直接开 strict 会爆上千个错误，正确的做法是逐个开。

```json
{
  "compilerOptions": {
    "strictNullChecks": true,
    "noImplicitAny": true
  }
}
```

先开这两个，收益最大。`strictNullChecks` 堵住 null 穿透，`noImplicitAny` 堵住类型体操里最常见漏洞。

```typescript
// strictNullChecks 生效后
function getUserName(id: string): string | null {
  return database.find(id)?.name ?? null
}

const name = getUserName("u_001")
// console.log(name.toUpperCase())  // ❌ name 可能为 null
console.log(name?.toUpperCase())    // ✅
```

`strictFunctionTypes` 和 `strictBindCallApply` 放第二阶段。`strictPropertyInitialization` 放第三阶段，因为它要求类属性必须在构造器里初始化，有些老代码用 `!` 断言绕过。

迁移节奏：每开一个标志，跑 `tsc --noEmit`，修完报错再开下一个。`// @ts-expect-error` 可以临时标注无法立即修的地方，但要留 TODO。

## 路径别名：消灭相对路径地狱

`../../../../components/Button` 这种路径，移动文件就全断。路径别名让 import 写成 `@components/Button`，文件位置变了只需要改 paths 配置。

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

但有个坑：`tsc` 编译时不会把 `@components/Button` 替换成真实路径。输出的 JS 里还是 `@components/Button`，运行时直接报错。

解决方案取决于你的场景：

- 用打包工具（Vite/esbuild/Webpack）→ `moduleResolution: "bundler"`，打包工具自己解析别名
- 纯 tsc 编译 → 用 `tsc-alias` 后处理
- Node.js 直接运行 → `moduleResolution: "nodenext"` + `tsconfig-paths`

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

bundler 模式是目前最省心的选择，前提是你的产物确实经过打包。

## 项目引用：500 个文件不用全编译

项目引用（Project References）让 tsc 只编译变更的子项目。原理很简单：每个子项目声明自己依赖谁，tsc 按依赖顺序增量构建。

根目录 tsconfig.json 只列引用，不包含任何文件：

```json
{
  "files": [],
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/utils" },
    { "path": "./apps/web" }
  ]
}
```

每个子项目需要 `composite: true`，它会自动开启 `incremental` 和 `declaration`：

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

`declarationMap` 不是可选的——不开它，从 node_modules 跳转源码时只能看到 `.d.ts`，看不到 `.ts` 源码。

编译命令换成 `tsc --build`：

```bash
tsc --build          # 增量编译，只处理变更
tsc --build --clean  # 清除构建产物
tsc --build --watch  # watch 模式
```

`composite` 和 `incremental` 的区别：composite 会自动开 incremental，但 incremental 不会自动开 composite。composite 还强制要求 declaration 和显式 include，用于项目引用；incremental 单纯缓存编译状态，用于单项目加速。

## moduleResolution：决定你怎么 import

这个配置决定 TypeScript 去哪里找 import 的文件。选错了，IDE 不报错但运行时炸。

| 策略 | 行为 | 适合 |
|------|------|------|
| `node` | 经典解析，忽略 package.json 的 exports 字段 | 旧项目、纯 CommonJS |
| `node16` | 支持 exports，import 必须带 `.js` 后缀 | Node.js 16+ ESM 项目 |
| `nodenext` | 跟进最新 Node.js 规范 | 最新 Node.js |
| `bundler` | 允许无后缀 import，支持 exports | Vite/esbuild/Webpack |

```typescript
// node16 模式
import { formatDate } from "./utils.js"  // ✅ 必须带 .js
import { formatDate } from "./utils"     // ❌ 报错

// bundler 模式
import { formatDate } from "./utils"     // ✅ 打包工具会处理
```

node16 要求 `.js` 后缀看起来反直觉，但这是 Node.js ESM 规范的要求——ESM 不做文件扩展名自动补全。bundler 模式之所以能省掉后缀，是因为打包工具自己做了解析，不依赖 Node.js 的模块加载器。

## 练习

### 练习一：渐进式开启 Strict

你有一个 `"strict": false` 的项目，包含大量隐式 any 和未检查的 null。写一个 tsconfig 片段，只开启 `strictNullChecks` 和 `noImplicitAny`，然后描述修复这两类报错的典型模式。

### 练习二：路径别名 + 打包工具配合

给以下项目配置路径别名 `@utils/format`，要求 Vite 开发服务器和 `tsc --noEmit` 类型检查都能正常工作：

```
project/
├── src/
│   ├── utils/
│   │   └── format.ts
│   └── app.ts          # import { formatDate } from "@utils/format"
├── tsconfig.json
└── vite.config.ts
```

### 练习三：项目引用

给一个 Monorepo 配置项目引用，其中 `packages/core` 无依赖，`packages/ui` 依赖 `core`，`apps/web` 依赖 `ui` 和 `core`。要求 `tsc --build` 能正确按依赖顺序增量编译。

---

## 参考答案

### 练习一

```json
{
  "compilerOptions": {
    "strict": false,
    "strictNullChecks": true,
    "noImplicitAny": true
  }
}
```

修复 `strictNullChecks` 报错的典型模式：用可选链 `?.`、空值合并 `??`、显式 null 检查。修复 `noImplicitAny` 的模式：给参数加类型标注、用 `unknown` 代替 `any`、为第三方库补 `@types/*`。

### 练习二

tsconfig.json 需要 `moduleResolution: "bundler"` 配合 paths。vite.config.ts 需要 `resolve.alias` 映射相同路径。两边必须同步，缺一边就会一边报错一边正常。

```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": { "@utils/*": ["src/utils/*"] }
  }
}
```

```typescript
// vite.config.ts
import { defineConfig } from "vite"
import path from "path"

export default defineConfig({
  resolve: { alias: { "@utils": path.resolve(__dirname, "src/utils") } },
})
```

### 练习三

```json
// 根目录 tsconfig.json
{
  "files": [],
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/ui" },
    { "path": "./apps/web" }
  ]
}
// packages/core/tsconfig.json
{ "compilerOptions": { "composite": true, "outDir": "./dist", "declaration": true, "declarationMap": true }, "include": ["src"] }
// packages/ui/tsconfig.json
{ "compilerOptions": { "composite": true, "outDir": "./dist", "declaration": true, "declarationMap": true }, "include": ["src"], "references": [{ "path": "../core" }] }
// apps/web/tsconfig.json
{ "compilerOptions": { "composite": true, "outDir": "./dist" }, "include": ["src"], "references": [{ "path": "../../packages/core" }, { "path": "../../packages/ui" }] }
```

根目录的 references 顺序决定了构建顺序。`tsc --build` 会先编译 core，再编译 ui（依赖 core 的产物），最后编译 web。
