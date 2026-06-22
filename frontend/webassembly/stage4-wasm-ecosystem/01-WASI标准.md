# 01 - WASI 标准：WebAssembly 的系统接口

## 场景引入

你在浏览器中运行 WASM 模块时，它被严格限制在一个沙箱里——不能读写文件、不能访问网络、不能读取环境变量。这在浏览器环境中是合理的安全策略，但如果你希望用 WASM 写一个命令行工具、一个服务端模块或一个嵌入式插件呢？

WASM 需要一种标准化的方式来与操作系统交互。早期的方案是每个运行时自己定义接口（如 Wasmer 的 WASI 实验版本），导致生态碎片化。WASI（WebAssembly System Interface）就是为了解决这个问题而诞生的——它定义了一套标准的系统调用接口，让 WASM 模块可以跨平台、跨运行时地访问底层资源。

本课将带你理解 WASI 的设计理念、能力安全模型、核心接口，以及如何用 Wasmtime 运行 WASI 应用。

## 学习目标

- 理解 WASI 的设计理念和能力模型（capability-based security）
- 掌握 WASI 的核心接口：文件系统、环境变量、命令行参数、时钟
- 了解 Preview 1 和 Preview 2 的差异及演进方向
- 能够用 Rust 编写 WASI 应用并用 Wasmtime 运行
- 理解 WASI 沙箱的实际限制和安全边界

## WASI 设计理念

### 为什么需要 WASI

WASM 的设计初衷是安全和可移植。但脱离浏览器后，程序需要与操作系统交互——读文件、访问网络、获取时间。如果每个运行时都定义自己的接口，WASM 的可移植性就被破坏了。

WASI 的目标是提供一套**标准化的系统接口**，让同一个 WASM 模块在任何支持 WASI 的运行时上都能正常工作。

### 能力模型（Capability-Based Security）

WASI 的安全模型与传统操作系统完全不同。传统模型基于身份（identity-based）：进程以某个用户身份运行，拥有该用户的所有权限。WASI 采用能力模型（capability-based）：模块只能使用被显式授予的能力。

```
传统模型：
  程序 → 以用户 "alice" 身份运行 → 可访问 /home/alice 下所有文件

WASI 模型：
  程序 → 被授予 /data/input.txt 的读取能力 → 只能读这一个文件
         没有被授予网络能力 → 无法访问网络
```

这意味着：
- **最小权限原则**：模块默认没有任何能力，必须由宿主显式授予
- **细粒度控制**：可以精确控制模块能访问哪些目录、哪些文件
- **不可逃逸**：模块无法通过任何方式获取未被授予的能力

## WASI Preview 1 vs Preview 2

WASI 经历了两个主要版本：

### Preview 1（稳定）

Preview 1 是当前广泛使用的版本，基于经典的 POSIX 风格接口：

- `fd_read` / `fd_write` — 文件描述符读写
- `fd_seek` — 文件定位
- `fd_close` — 关闭文件描述符
- `environ_get` / `environ_sizes_get` — 环境变量
- `args_get` / `args_sizes_get` — 命令行参数
- `clock_time_get` — 获取时间
- `path_open` — 打开文件路径
- `random_get` — 获取随机数

Preview 1 的核心抽象是**文件描述符（fd）**，所有资源都通过 fd 操作。

### Preview 2（演进中）

Preview 2 基于组件模型重新设计，引入了更丰富的类型系统：

- 使用 WIT（WebAssembly Interface Types）定义接口
- 从 fd 抽象迁移到**资源句柄（resource handles）**
- 支持异步 I/O
- 更细粒度的能力控制（如区分文件读取和目录读取）
- 统一了网络、文件系统、时钟等接口风格

目前 Preview 2 仍处于提案阶段，Wasmtime 已有实验性支持。生产环境建议使用 Preview 1。

## 核心接口详解

### 文件系统访问

WASI 的文件系统操作基于 `fd`（文件描述符）。模块启动时，宿主可以预先打开目录并注入 fd，模块只能在这些目录内操作。

```rust
// src/lib.rs — 读取文件内容并写入新文件
use std::fs;
use std::io::{Read, Write};

#[no_mangle]
pub extern "C" fn process_file() {
    // 读取输入文件（需要宿主预先授予 /input 目录的能力）
    let input = fs::read_to_string("/input/data.txt")
        .expect("无法读取输入文件");

    // 处理数据
    let output = input.to_uppercase();

    // 写入输出文件（需要宿主授予 /output 目录的能力）
    let mut file = fs::File::create("/output/result.txt")
        .expect("无法创建输出文件");
    file.write_all(output.as_bytes())
        .expect("写入失败");
}
```

编译为 WASI 目标：

```bash
# 添加 WASI 编译目标
rustup target add wasm32-wasi

# 编译
cargo build --target wasm32-wasi --release
```

### 环境变量和命令行参数

```rust
use std::env;

#[no_mangle]
pub extern "C" fn show_config() {
    // 读取命令行参数
    let args: Vec<String> = env::args().collect();
    println!("参数数量: {}", args.len());
    for (i, arg) in args.iter().enumerate() {
        println!("  args[{}] = {}", i, arg);
    }

    // 读取环境变量
    match env::var("APP_MODE") {
        Ok(mode) => println!("运行模式: {}", mode),
        Err(_) => println!("未设置 APP_MODE 环境变量"),
    }
}
```

### 时钟接口

```rust
use std::time::{SystemTime, UNIX_EPOCH};

#[no_mangle]
pub extern "C" fn get_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("时间获取失败")
        .as_secs()
}
```

## 用 Wasmtime 运行 WASI 应用

### 命令行运行

```bash
# 基本运行
wasmtime run --dir ./input --dir ./output target/wasm32-wasi/release/app.wasm

# 传递命令行参数
wasmtime run app.wasm -- arg1 arg2

# 设置环境变量
wasmtime run --env APP_MODE=production app.wasm

# 限制文件系统访问
wasmtime run --dir /sandbox::/real/path app.wasm
```

### Rust 嵌入 Wasmtime

```rust
// 宿主程序：嵌入 Wasmtime 运行 WASI 模块
use wasmtime::*;
use wasmtime_wasi::WasiCtxBuilder;

fn main() -> anyhow::Result<()> {
    let engine = Engine::default();
    let mut store = Store::new(
        &engine,
        WasiCtxBuilder::new()
            .inherit_stdio()           // 继承标准输入输出
            .env("APP_MODE", "host")?   // 注入环境变量
            .arg("hello")?              // 注入命令行参数
            .preopened_dir(
                std::fs::File::open("./sandbox")?,
                "/sandbox",
            )?                          // 预开目录
            .build(),
    );

    let module = Module::from_file(&engine, "guest.wasm")?;
    let instance = Instance::new(&mut store, &module, &[])?;

    // 调用导出函数
    let run = instance.get_typed_func::<(), ()>(&mut store, "run")?;
    run.call(&mut store, ())?;

    Ok(())
}
```

## 常见误区

### 误区一：WASI 等于完全的系统访问

WASI 不是给 WASM 模块完整的系统权限。它是一个**受限的接口层**，模块只能使用宿主显式授予的能力。没有授予网络能力，模块就无法进行任何网络操作。

### 误区二：Preview 2 已经可以用于生产

Preview 2 仍在提案阶段，Wasmtime 的支持是实验性的。生产环境应使用 Preview 1，Preview 2 用于了解未来方向。

### 误区三：WASI 只能在命令行使用

WASI 不仅适用于命令行工具。任何需要系统交互的 WASM 场景都可以使用 WASI，包括服务端嵌入、插件系统、边缘计算等。

### 误区四：所有运行时的 WASI 行为完全一致

虽然 WASI 是标准，但不同运行时在细节上可能有差异（如路径处理、错误码）。跨运行时部署时需要测试验证。

## 工程建议

1. **始终使用最小权限**：只授予模块必需的能力，不要为了方便授予整个根目录
2. **处理 WASI 错误码**：WASI 使用数字错误码，建议封装一层错误处理
3. **区分开发和生产配置**：开发时可以放宽权限，生产环境必须严格限制
4. **关注组件模型演进**：如果项目周期较长，可以提前了解 Preview 2 的接口变化
5. **测试跨运行时兼容性**：如果需要在多个运行时部署，用 Wasmtime 和 WasmEdge 都测试一遍

## 小结

本课介绍了 WASI 的核心概念：

- **能力模型**：模块默认无权限，宿主显式授予能力，实现最小权限原则
- **Preview 1 接口**：基于文件描述符的 fd_read/fd_write、环境变量、命令行参数、时钟
- **Preview 2 演进**：基于组件模型和 WIT，引入资源句柄和异步 I/O
- **Wasmtime**：主流的 WASI 运行时，支持命令行和嵌入式使用

WASI 是 WASM 走出浏览器的关键一步，理解它的设计理念对后续学习组件模型和插件系统至关重要。

## 练习

### 练习一：WASI 文件处理程序

编写一个 Rust 程序，编译为 WASI 目标，实现以下功能：
- 读取 `/input/numbers.txt` 中的数字（每行一个）
- 计算总和和平均值
- 将结果写入 `/output/summary.txt`

### 练习二：Wasmtime 嵌入式运行

编写一个 Rust 宿主程序，使用 Wasmtime 嵌入运行练习一的 WASI 模块：
- 预开 `/sandbox/input` 和 `/sandbox/output` 目录
- 注入环境变量 `PRECISION=2`（保留两位小数）
- 读取并打印模块的输出

### 练习三：能力限制实验

修改宿主程序，验证以下场景：
- 不授予 `/output` 目录时，模块写入文件会发生什么？
- 授予 `/sandbox/input` 但模块尝试读取 `/etc/passwd` 会怎样？

---

## 参考答案

### 练习一

**思路**：使用标准库的文件 I/O 读取数字文件，解析每行为 f64，计算后格式化输出。

**答案**：

```rust
// src/lib.rs
use std::fs;
use std::io::Write;

#[no_mangle]
pub extern "C" fn run() {
    // 读取输入文件
    let content = fs::read_to_string("/input/numbers.txt")
        .expect("无法读取 /input/numbers.txt");

    // 解析数字
    let numbers: Vec<f64> = content
        .lines()
        .filter_map(|line| line.trim().parse::<f64>().ok())
        .collect();

    if numbers.is_empty() {
        println!("未找到有效数字");
        return;
    }

    // 计算总和和平均值
    let sum: f64 = numbers.iter().sum();
    let avg = sum / numbers.len() as f64;

    // 读取精度配置
    let precision = std::env::var("PRECISION")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(2);

    // 写入结果
    let result = format!(
        "数量: {}\n总和: {:.prec$}\n平均值: {:.prec$}\n",
        numbers.len(),
        sum,
        avg,
        prec = precision
    );

    let mut file = fs::File::create("/output/summary.txt")
        .expect("无法创建输出文件");
    file.write_all(result.as_bytes()).expect("写入失败");

    println!("{}", result);
}
```

**要点**：
- 使用 `filter_map` 安全地跳过无法解析的行
- 从环境变量读取精度配置，提供默认值
- 使用 `format!` 的精度控制 `{:.prec$}`

### 练习二

**思路**：使用 `wasmtime` 和 `wasmtime-wasi` crate 创建 WASI 上下文，预开目录并注入环境变量。

**答案**：

```rust
// host/src/main.rs
use wasmtime::*;
use wasmtime_wasi::{WasiCtxBuilder, Dir};

fn main() -> anyhow::Result<()> {
    let engine = Engine::default();

    // 创建 WASI 上下文，预开目录并注入环境变量
    let input_dir = std::fs::File::open("./sandbox/input")?;
    let output_dir = std::fs::File::open("./sandbox/output")?;

    let wasi_ctx = WasiCtxBuilder::new()
        .inherit_stdio()
        .env("PRECISION", "2")?
        .preopened_dir(input_dir, "/input")?
        .preopened_dir(output_dir, "/output")?
        .build();

    let mut store = Store::new(&engine, wasi_ctx);

    // 加载并实例化模块
    let module = Module::from_file(&engine, "target/wasm32-wasi/release/processor.wasm")?;
    let instance = Instance::new(&mut store, &module, &[])?;

    // 调用 run 函数
    let run = instance.get_typed_func::<(), ()>(&mut store, "run")?;
    run.call(&mut store, ())?;

    // 读取输出文件验证结果
    let output = std::fs::read_to_string("./sandbox/output/summary.txt")?;
    println!("模块输出:\n{}", output);

    Ok(())
}
```

**要点**：
- `preopened_dir` 将宿主目录映射到模块内的路径
- 环境变量通过 `env` 方法注入，模块内通过 `std::env::var` 读取
- `inherit_stdio` 让模块的 `println!` 输出到宿主的标准输出

### 练习三

**思路**：分别测试两种权限不足的场景，观察 WASI 的错误行为。

**答案**：

```rust
// 场景一：不授予 /output 目录
// 宿主程序去掉 preopened_dir(output_dir, "/output")
// 模块尝试 fs::File::create("/output/result.txt") 会 panic:
//   "No such file or directory (os error 44)"
// WASI 错误码 44 对应 ENOTCAPABLE（能力不足）

// 场景二：模块尝试读取 /etc/passwd
// 即使授予了 /sandbox/input，模块也无法读取 /etc/passwd
// 因为 /etc 不在任何预开目录的范围内
// 错误: "No such file or directory (os error 44)"
```

**要点**：
- WASI 的 `ENOTCAPABLE` 错误码（44）表示能力不足，不是权限不足
- 模块无法"逃逸"到未被授予的目录，即使宿主进程本身有权限
- 这是能力模型的核心安全保障：模块只能看到被显式打开的文件描述符
