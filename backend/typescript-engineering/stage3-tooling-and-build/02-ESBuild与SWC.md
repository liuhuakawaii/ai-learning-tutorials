# ESBuild 与 SWC

## 场景引入

你的项目有 300 个 TypeScript 文件，每次 `tsc` 编译需要 25 秒。在开发时改一行代码要等 25 秒才能看到结果，开发体验极差。你尝试了 `tsc --incremental`，好了一些但还是要 8 秒。有没有办法把编译时间压缩到 200 毫秒以内？

## 学习目标

- 理解 `tsc` 编译慢的根本原因
- 掌握 ESBuild 的配置和使用方式
- 掌握 SWC 的配置和使用方式
- 能根据项目需求选择合适的编译工具
- 学会将快速编译工具与 tsc 类型检查组合使用

## 一、为什么 tsc 慢

`tsc` 的工作包括：解析 → 类型检查 → 转换 → 打印 → 生成声明。其中**类型检查**是最耗时的步骤，通常占 70% 以上的时间。ESBuild 和 SWC 的核心思路是：**跳过类型检查，只做语法转换**。

```bash
time npx tsc                              # ~25 秒
time npx esbuild src/**/*.ts --outdir=dist  # ~150 毫秒
time npx swc src -d dist                   # ~200 毫秒
```

这就是为什么现代前端工具链普遍采用"快速编译 + 独立类型检查"的模式。

## 二、ESBuild 配置与使用

ESBuild 是用 Go 语言编写的打包工具，编译速度极快。

```bash
pnpm add -D esbuild
```

```javascript
// esbuild.config.mjs
import { build, context } from "esbuild";

const isDev = process.env.NODE_ENV === "development";
const config = {
  entryPoints: ["src/index.ts"],
  outdir: "dist",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  sourcemap: true,
  minify: !isDev,
  splitting: true,
  alias: { "@": "./src" },
};

if (isDev) {
  const ctx = await context(config);
  await ctx.watch();
} else {
  await build(config);
}
```

ESBuild 插件系统：

```javascript
const logPlugin = {
  name: "log",
  setup(build) {
    build.onStart(() => console.log("Build started"));
    build.onEnd((result) => console.log(`Done: ${result.errors.length} errors`));
  },
};

await build({ ...config, plugins: [logPlugin] });
```

## 三、SWC 配置与使用

SWC 是用 Rust 编写的编译器，对装饰器有完整支持，适合 NestJS、TypeORM 等框架。

```bash
pnpm add -D @swc/core @swc/cli
```

```json
// .swcrc
{
  "jsc": {
    "parser": { "syntax": "typescript", "decorators": true },
    "transform": { "legacyDecorator": true, "decoratorMetadata": true },
    "target": "es2022",
    "paths": { "@/*": ["src/*"] }
  },
  "module": { "type": "es6" },
  "sourceMaps": true
}
```

```bash
npx swc src -d dist           # 编译整个目录
npx swc src -d dist --watch   # Watch 模式
```

SWC 可以正确处理装饰器语法：

```typescript
import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;
  @Column({ type: "varchar", length: 255 })
  name: string;
}
```

## 四、ESBuild vs SWC 对比

| 维度 | ESBuild | SWC | tsc |
|------|---------|-----|-----|
| 语言 | Go | Rust | TypeScript |
| 速度 | 极快（~150ms） | 极快（~200ms） | 慢（~25s） |
| 类型检查 | 不支持 | 不支持 | 支持 |
| .d.ts 生成 | 不支持 | 不支持 | 支持 |
| 装饰器 | 基础支持 | 完整支持 | 完整支持 |
| 打包能力 | 内置 | 需配合其他工具 | 无 |
| 适用场景 | 纯打包构建 | 装饰器/兼容 Babel | 类型检查 |

**选择建议**：纯前端项目 → ESBuild（Vite 默认）；NestJS/TypeORM → SWC；类型检查 → tsc（不可替代）。

## 五、快速编译 + 独立类型检查

生产环境最佳实践：**用 ESBuild/SWC 做快速编译，用 tsc 做独立类型检查**。

```json
{
  "scripts": {
    "dev": "esbuild src/index.ts --outdir=dist --watch --sourcemap",
    "build": "esbuild src/index.ts --outdir=dist --minify --sourcemap",
    "typecheck": "tsc --noEmit",
    "check": "pnpm typecheck && pnpm build"
  }
}
```

使用 tsup 封装这个模式（推荐）：

```bash
pnpm add -D tsup
```

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,       // 生成 .d.ts（内部用 tsc）
  splitting: true,
  sourcemap: true,
  clean: true,
  target: "node18",
});
```

tsup 内部使用 ESBuild 编译，但会调用 tsc 生成 .d.ts 声明文件，兼顾速度和类型完整性。

## 常见误区

1. **用 ESBuild/SWC 替代 tsc 做类型检查**：它们只做语法转换，`const x: string = 123` 在它们眼中是合法代码
2. **认为更快的工具一定更好**：ESBuild 不支持 const enum 内联、namespace 合并等特性
3. **在开发时同时跑 tsc 和 ESBuild**：开发时只用 ESBuild watch，tsc 类型检查放到 IDE 和 CI 中
4. **忽略 Source Map 配置**：不用 Source Map 的话，调试时无法定位到原始 .ts 文件

## 工程建议

1. **开发时用 ESBuild watch，CI 中用 tsc --noEmit**：兼顾开发速度和代码质量
2. **优先使用 tsup**：它封装了 ESBuild + tsc 的组合，不需要自己拼装
3. **SWC 用于装饰器场景**：NestJS、TypeORM 等框架推荐使用 SWC
4. **不要在生产构建中跳过类型检查**：CI 中必须运行 `tsc --noEmit`

## 小结

本课讲解了 tsc 编译慢的原因——类型检查是最耗时的步骤，以及如何使用 ESBuild 和 SWC 实现毫秒级编译。核心思路是"快速编译 + 独立类型检查"的分工模式。tsup 是这个模式的最佳封装方案。

## 练习

### 练习一：ESBuild 配置

为一个 Node.js 18 的 TypeScript 项目配置 ESBuild，要求：输出 ESM 格式、支持路径别名 `@/`、开发模式开启 watch 和 Source Map。

### 练习二：SWC 装饰器配置

为一个 NestJS 项目配置 SWC，要求支持 TypeScript 装饰器语法和元数据发射。

### 练习三：组合模式实践

设计一个完整的构建流程：开发时快速编译、构建时输出 ESM+CJS 双格式、CI 中做类型检查。

---

## 参考答案

### 练习一

**思路**：使用 ESBuild 的 JS API，配置 format、alias、sourcemap 和 watch。

**答案**：

```javascript
import { build, context } from "esbuild";
const isDev = process.env.NODE_ENV === "development";
const config = {
  entryPoints: ["src/index.ts"], outdir: "dist", bundle: true,
  format: "esm", platform: "node", target: "node18",
  sourcemap: isDev, minify: !isDev, alias: { "@": "./src" },
};
if (isDev) { (await context(config)).watch(); } else { await build(config); }
```

**要点**：`platform: "node"` 自动排除内置模块，watch 模式用 `context` API。

### 练习二

**思路**：在 .swcrc 中开启 decorators 和 decoratorMetadata。

**答案**：

```json
{ "jsc": { "parser": { "syntax": "typescript", "decorators": true }, "transform": { "legacyDecorator": true, "decoratorMetadata": true }, "target": "es2022" }, "module": { "type": "commonjs" } }
```

**要点**：NestJS 使用实验性装饰器语法，需要 `legacyDecorator: true`；`decoratorMetadata` 发射依赖注入所需的元数据。

### 练习三

**思路**：使用 tsup 实现双格式输出，tsc --noEmit 做类型检查。

**答案**：

```json
{ "scripts": { "dev": "tsup --watch", "build": "tsup", "typecheck": "tsc --noEmit", "check": "pnpm typecheck && pnpm build" } }
```

**要点**：tsup 的 `dts: true` 调用 tsc 生成声明文件，双格式输出让包同时支持 `require` 和 `import`，CI 中先 typecheck 再 build。
