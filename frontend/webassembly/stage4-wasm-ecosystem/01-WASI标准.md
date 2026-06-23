# WASI 标准

## WASI 是什么

WASM 最初只能在浏览器中运行。WASI（WebAssembly System Interface）让它也能在浏览器外运行——命令行工具、服务器、边缘计算。

WASI 定义了一组系统接口：文件 I/O、网络、环境变量、时钟。类似于 POSIX，但更安全——默认沙箱，需要显式授权才能访问文件系统和网络。

## 为什么需要 WASI

```
浏览器中的 WASM：通过 JavaScript API 访问浏览器能力
浏览器外的 WASM：通过 WASI 访问操作系统能力
```

没有 WASI，WASM 模块无法读写文件、无法访问网络、无法获取当前时间。

## WASI 的安全模型

```
WASM 模块
  ↓ 请求
WASI 运行时（Wasmtime / Wasmer / Node.js）
  ↓ 检查权限
操作系统
```

模块只能访问被明确授权的资源：

```bash
# 只允许读取 /data 目录
wasmtime --dir /data program.wasm

# 只允许访问特定网络
wasmtime --allow-tcp-connect example.com:80 program.wasm
```

## 在 Node.js 中运行 WASI

```javascript
import { readFile } from 'fs/promises'
import { WASI } from 'wasi'
import { argv, env } from 'process'

const wasi = new WASI({
  args: argv,
  env,
  preopens: { '/': '/' },
})

const wasm = await WebAssembly.compile(await readFile('program.wasm'))
const instance = await WebAssembly.instantiate(wasm, wasi.getImportObject())

wasi.start(instance)
```

## 在浏览器中模拟 WASI

浏览器没有真正的文件系统，但可以用内存文件系统：

```javascript
import { createFsFromVolume, Volume } from 'memfs'

const fs = createFsFromVolume(Volume.fromJSON({
  '/input.txt': 'Hello, WASI!',
}))

// 在 WASM 模块中读写这个虚拟文件系统
```

## WASI 的应用场景

1. **命令行工具**：用 Rust/C 写一次，编译为 WASM，在任何平台运行
2. **插件系统**：安全地运行用户提供的代码
3. **边缘计算**：在 CDN 节点运行 WASM 函数
4. **微服务**：轻量级、快速启动、安全隔离

## 组件模型（Component Model）

WASI 的下一代：模块可以互相组合，不同语言编写的模块可以互操作。

```
Rust 组件 ←→ JavaScript 组件 ←→ Python 组件
         ↘       ↓       ↙
         统一接口类型系统
```

这是 WASM 生态的未来方向，但目前还在标准化过程中。

## 练习

### 练习一：WASI Hello World

用 Rust 写一个读取文件内容并打印的程序，编译为 WASM，用 Node.js WASI 运行。

### 练习二：命令行工具

用 Rust 实现一个简单的 JSON 格式化工具，编译为 WASI，在命令行运行。

### 练习三：插件系统

实现一个简单的插件系统：宿主程序加载 WASM 插件，插件可以读取宿主提供的数据并返回结果。

---

## 参考答案

### 练习一

```rust
// src/main.rs
use std::fs;

fn main() {
    let content = fs::read_to_string("/input.txt").unwrap();
    println!("File content: {}", content);
}
```

```bash
cargo build --target wasm32-wasi
node --experimental-wasi-unstable-preview1 run.js
```

### 练习二

```rust
use std::io::{self, Read};
use serde_json::Value;

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let v: Value = serde_json::from_str(&input).unwrap();
    println!("{}", serde_json::to_string_pretty(&v).unwrap());
}
```

### 练习三

```javascript
// 宿主提供数据，插件处理
const instance = await WebAssembly.instantiate(wasm, {
  host: {
    get_data: () => new TextEncoder().encode('input data'),
    log_result: (ptr, len) => {
      const result = new Uint8Array(memory.buffer, ptr, len)
      console.log(new TextDecoder().decode(result))
    },
  },
})
instance.exports.process()
```
