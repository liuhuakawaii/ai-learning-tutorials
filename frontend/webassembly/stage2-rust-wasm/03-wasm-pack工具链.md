# 03 - wasm-pack 工具链

## 场景引入

在上一课中，我们用 `#[wasm_bindgen]` 写好了 Rust 代码，但从 Rust 源码到能在浏览器中使用的 npm 包，中间需要经历编译、生成胶水代码、打包等多个步骤。手动执行这些步骤不仅繁琐，还容易出错。

`wasm-pack` 是一站式工具，一条命令就能把 Rust 代码编译成可发布的 npm 包，包含 `.wasm` 二进制、JS 胶水代码和 TypeScript 类型定义。

## 学习目标

- 掌握 wasm-pack 的安装和基本使用
- 理解 build/test/pack 三个核心命令
- 了解不同构建目标（web/nodejs/bundler）的区别
- 学会生成标准 npm 包结构并发布
- 掌握与 webpack/vite 的集成方法

## wasm-pack 安装

```bash
# macOS / Linux
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Windows（或使用 cargo）
cargo install wasm-pack

# 添加 WASM 编译目标
rustup target add wasm32-unknown-unknown

# 验证
wasm-pack --version
```

## 构建流程

### 初始化项目

```bash
cargo new --lib wasm-greeter
cd wasm-greeter
```

`Cargo.toml`：

```toml
[package]
name = "wasm-greeter"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"

[dev-dependencies]
wasm-bindgen-test = "0.3"
```

`src/lib.rs`：

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("你好, {}! 来自 Rust WASM", name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn test_greet() {
        assert_eq!(greet("世界"), "你好, 世界! 来自 Rust WASM");
    }
}
```

### wasm-pack build

```bash
# 基本构建（默认 bundler 目标）
wasm-pack build

# 指定构建目标
wasm-pack build --target web      # 浏览器直接使用
wasm-pack build --target nodejs   # Node.js 环境
wasm-pack build --target bundler  # webpack/vite（默认）

# Dev 模式（编译更快，适合开发）
wasm-pack build --dev

# 指定输出目录和包名
wasm-pack build --out-dir pkg --out-name my_wasm
```

构建产物结构：

```
pkg/
├── wasm_greeter_bg.wasm         # WASM 二进制
├── wasm_greeter_bg.wasm.d.ts    # WASM 类型声明
├── wasm_greeter.js              # JS 胶水代码
├── wasm_greeter.d.ts            # TypeScript 类型定义
└── package.json                 # npm 包配置
```

### wasm-pack test

```bash
wasm-pack test --node              # Node.js 中运行
wasm-pack test --headless --chrome # headless Chrome
wasm-pack test --headless --firefox # headless Firefox
```

### wasm-pack pack / publish

```bash
wasm-pack pack       # 生成 .tgz 压缩包
wasm-pack publish    # 发布到 npm registry
```

## 目标选择

| 目标 | 命令 | 使用方式 | 特点 |
|------|------|---------|------|
| web | `--target web` | `await init()` 后调用 | 最小 JS 胶水代码 |
| nodejs | `--target nodejs` | `require()` 同步加载 | 无需 await |
| bundler | `--target bundler` | npm 包 import | 支持 tree-shaking |

### web 目标使用示例

```javascript
import init, { greet } from './pkg/wasm_greeter.js';

async function main() {
    await init();
    console.log(greet("浏览器"));
}
main();
```

### nodejs 目标使用示例

```javascript
const { greet } = require('./pkg/wasm_greeter');
console.log(greet("Node.js"));
```

## 与 Vite 集成

Vite 对 WASM 有原生支持，集成最简单：

```bash
npm create vite@latest my-app -- --template vanilla
cd my-app
npm install
```

`vite.config.js`：

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
});
```

```javascript
// main.js
import init, { greet } from '../pkg/wasm_greeter.js';

async function main() {
    await init();
    document.querySelector('#app').innerHTML = `<h1>${greet("Vite")}</h1>`;
}
main();
```

## 与 webpack 集成

`webpack.config.js`：

```javascript
const path = require('path');

module.exports = {
    entry: './src/index.js',
    output: { path: path.resolve(__dirname, 'dist'), filename: 'bundle.js' },
    experiments: { asyncWebAssembly: true },
    mode: 'development',
};
```

## CI/CD 集成

GitHub Actions 自动化构建：

```yaml
# .github/workflows/wasm.yml
name: WASM Build
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown
      - uses: jetli/wasm-pack-action@v0.4.0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: wasm-pack build --target web
      - run: wasm-pack test --headless --chrome
      - run: wasm-pack pack
      - uses: actions/upload-artifact@v4
        with:
          name: wasm-pkg
          path: pkg/
```

## 常见误区

### 1. 混淆三种构建目标

`--target web` 的产物不能在 webpack 中直接使用（缺少 init 导出），反之亦然。始终根据运行环境选择正确目标。

### 2. 忘记添加 wasm32-unknown-unknown 目标

`wasm-pack build` 报错最常见的原因。运行 `rustup target add wasm32-unknown-unknown`。

### 3. Cargo.toml 缺少 crate-type

`[lib]` 段必须包含 `crate-type = ["cdylib"]`，否则不生成 WASM 产物。

### 4. 生产构建使用 dev 模式

`wasm-pack build --dev` 跳过优化，WASM 体积可能大 10 倍。生产构建必须用 `--release`。

## 工程建议

1. **用 `--target web` 做原型，`--target bundler` 做生产**。web 目标最简单，bundler 与前端工具链集成最好。
2. **配置 `.gitignore` 忽略 `pkg/`**。构建产物在 CI 中自动生成，不提交到版本库。
3. **版本管理**。`package.json` 版本号来自 `Cargo.toml`，发布前确保一致。
4. **wasm-opt 自动优化**。wasm-pack 在 release 模式下自动调用 `wasm-opt` 进行体积优化。

## 小结

- **wasm-pack build**：一条命令完成 Rust → WASM → npm 包
- **三种构建目标**：web（浏览器）、nodejs（服务端）、bundler（打包工具）
- **wasm-pack test**：在 Node.js 或 headless 浏览器中运行 Rust 测试
- **wasm-pack pack/publish**：打包和发布到 npm registry
- **CI/CD**：GitHub Actions 自动化构建、测试、发布

## 练习

### 练习一：创建并构建项目

创建 `string-utils` 项目，实现 `reverse(s: &str) -> String` 和 `is_palindrome(s: &str) -> bool`。用 `wasm-pack build --target web` 构建。

### 练习二：编写测试并运行

为练习一编写 `wasm-bindgen-test` 测试，覆盖正常输入、空字符串、中文字符串。用 `wasm-pack test --node` 运行。

### 练习三：集成到 Vite 项目

创建 Vite 项目，集成练习一的 WASM 模块，展示字符串反转和回文判断结果。

---

## 参考答案

### 练习一

`Cargo.toml`：

```toml
[package]
name = "string-utils"
version = "0.1.0"
edition = "2021"
[lib]
crate-type = ["cdylib", "rlib"]
[dependencies]
wasm-bindgen = "0.2"
```

`src/lib.rs`：

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn reverse(s: &str) -> String {
    s.chars().rev().collect()
}

#[wasm_bindgen]
pub fn is_palindrome(s: &str) -> bool {
    let cleaned: String = s.chars()
        .filter(|c| c.is_alphanumeric())
        .map(|c| c.to_lowercase().next().unwrap())
        .collect();
    cleaned == cleaned.chars().rev().collect::<String>()
}
```

构建：`wasm-pack build --target web`。使用 `chars()` 处理 Unicode 比字节操作更安全。

### 练习二

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn test_reverse_chinese() { assert_eq!(reverse("你好世界"), "界世好你"); }

    #[wasm_bindgen_test]
    fn test_palindrome_with_spaces() { assert!(is_palindrome("A man a plan a canal Panama")); }

    #[wasm_bindgen_test]
    fn test_palindrome_chinese() { assert!(is_palindrome("上海自来水来自海上")); }
}
```

运行：`wasm-pack test --node`。

### 练习三

```javascript
import init, { reverse, is_palindrome } from '../pkg/string_utils.js';

async function main() {
    await init();
    const tests = ['hello', 'racecar', '上海自来水来自海上'];
    document.querySelector('#app').innerHTML = `
        <table>
            ${tests.map(s => `<tr>
                <td>${s}</td>
                <td>${reverse(s)}</td>
                <td>${is_palindrome(s) ? '✅' : '❌'}</td>
            </tr>`).join('')}
        </table>`;
}
main();
```

Vite 会自动处理 WASM 加载，`npm install ../pkg` 可引入本地 WASM 包。
