# 01 - Rust 基础语法

## 场景引入

在 Stage 1 中，我们用 WAT 手写了 WASM 模块。手写 WAT 极其繁琐，连一个简单的数组求和都需要手动管理线性内存。我们需要一门更高级的语言来编写 WASM 模块。

为什么是 Rust？C/C++ 能编译到 WASM，但内存安全问题在 WASM 中同样存在。Go 也能编译到 WASM，但 runtime 带来额外体积开销。Rust 在编译期保证内存安全，零运行时开销，生成的 WASM 体积极小——这正是生产环境需要的。

## 学习目标

- 理解 Rust 所有权系统的设计动机和核心规则
- 掌握借用（borrowing）和生命周期（lifetime）的基本用法
- 能使用模式匹配和 Result/Option 进行错误处理
- 熟悉 Cargo 项目管理和依赖管理
- 理解 Rust 相比 C/JS 在内存安全方面的优势

## 所有权（Ownership）

Rust 的核心设计哲学：**每个值在任意时刻只有一个所有者（owner），所有者离开作用域时值被自动释放。**

```rust
fn main() {
    let s1 = String::from("hello"); // s1 是 "hello" 的所有者
    let s2 = s1;                     // 所有权转移（move）给 s2
    // println!("{}", s1);           // ❌ 编译错误：s1 已失效
    println!("{}", s2);              // ✅ s2 是当前所有者
}
```

赋值操作是**所有权转移**，不是复制引用。这避免了 double-free 问题。基本类型（i32、f64、bool）实现了 `Copy` trait，赋值时自动按位复制，不会转移所有权。

```rust
fn main() {
    let x: i32 = 42;
    let y = x;        // 复制，x 仍然有效
    println!("x={}, y={}", x, y); // ✅

    let s1 = String::from("world");
    let s2 = s1;       // 所有权转移
    // println!("{}", s1); // ❌ s1 已失效
    println!("{}", s2);    // ✅
}
```

需要显式深拷贝时使用 `clone()`，但频繁 clone 会带来性能开销。

## 借用（Borrowing）

借用让你在不转移所有权的情况下访问数据。规则：**同一时刻，要么有一个可变引用，要么有任意多个不可变引用。**

```rust
// 不可变借用：可以同时有多个
fn calculate_length(s: &String) -> usize { s.len() }

// 可变借用：同一时刻只能一个
fn add_suffix(s: &mut String) { s.push_str(" world"); }

fn main() {
    let s = String::from("hello");
    let len = calculate_length(&s);  // 不可变借用
    println!("'{}' 的长度是 {}", s, len); // ✅ s 仍然有效

    let mut s2 = String::from("hello");
    add_suffix(&mut s2);  // 可变借用
    println!("{}", s2);   // ✅ 输出 "hello world"
}
```

### 生命周期（Lifetime）

生命周期保证引用的有效性。大多数时候编译器自动推断，有时需要手动标注：

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

fn main() {
    let s1 = String::from("long string");
    let result;
    {
        let s2 = String::from("xyz");
        result = longest(s1.as_str(), s2.as_str());
        println!("较长的字符串是: {}", result); // ✅
    }
    // println!("{}", result); // ❌ s2 已释放
}
```

## 模式匹配

`match` 表达式可以解构复杂数据类型，且必须穷尽所有分支：

```rust
enum WebAssemblyValue {
    I32(i32), I64(i64), F32(f32), F64(f64),
}

fn describe_value(val: &WebAssemblyValue) -> String {
    match val {
        WebAssemblyValue::I32(n) => format!("32位整数: {}", n),
        WebAssemblyValue::I64(n) => format!("64位整数: {}", n),
        WebAssemblyValue::F32(n) => format!("32位浮点: {}", n),
        WebAssemblyValue::F64(n) => format!("64位浮点: {}", n),
    }
}
```

只关心一种情况时用 `if let` 更简洁：

```rust
let some_value: Option<i32> = Some(42);
if let Some(v) = some_value {
    println!("值是: {}", v);
}
```

## 错误处理（Result / Option）

Rust 没有异常，通过类型系统处理错误：

```rust
use std::num::ParseIntError;

fn parse_wasm_memory_size(input: &str) -> Result<usize, ParseIntError> {
    let bytes: usize = input.parse()?;  // ? 操作符传播错误
    Ok(bytes)
}

fn main() {
    match parse_wasm_memory_size("65536") {
        Ok(size) => println!("内存大小: {} 字节", size),
        Err(e) => println!("解析失败: {}", e),
    }

    let numbers = vec![1, 2, 3];
    let first = numbers.first(); // Option<&i32>
    match first {
        Some(n) => println!("第一个元素: {}", n),
        None => println!("数组为空"),
    }
}
```

自定义错误类型：

```rust
use std::fmt;

#[derive(Debug)]
enum WasmError {
    InvalidModule(String),
    MemoryOutOfBounds { address: u32, max: u32 },
}

impl fmt::Display for WasmError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            WasmError::InvalidModule(msg) => write!(f, "无效模块: {}", msg),
            WasmError::MemoryOutOfBounds { address, max } =>
                write!(f, "内存越界: 地址 {} 超出 {}", address, max),
        }
    }
}
```

## Cargo 基础

Cargo 是 Rust 的构建工具和包管理器，相当于 JS 的 npm + webpack：

```bash
cargo new wasm-lexer --lib  # 创建库项目
cargo build                  # 构建
cargo test                   # 运行测试
cargo check                  # 快速检查（不生成二进制）
cargo fmt                    # 格式化代码
cargo clippy                 # 静态分析
```

`Cargo.toml` 配置：

```toml
[package]
name = "wasm-lexer"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]  # cdylib 用于编译 WASM

[dependencies]
wasm-bindgen = "0.2"
```

## 对比 C/JS 的内存安全

| 问题 | C | JavaScript | Rust |
|------|---|-----------|------|
| 缓冲区溢出 | 运行时发生 | 不会发生 | 编译期检查 |
| 悬垂指针 | 常见 | GC 避免 | 编译期禁止 |
| 数据竞争 | 需手动加锁 | 单线程避免 | 编译期禁止 |
| 内存泄漏 | malloc/free 不配对 | GC 自动回收 | RAII 自动释放 |
| 空指针 | NULL 解引用崩溃 | undefined 运行时报错 | Option 类型编译期处理 |

## 常见误区

### 1. 试图用 clone() 绕过所有权

初学者常用 `clone()` 解决所有权问题，但失去了 Rust 的性能优势。优先使用借用（`&T` 或 `&mut T`）。

### 2. 混淆可变性和所有权

`let mut s` 修饰的是绑定，不是值本身。只有声明为 `mut` 才能创建可变引用。

### 3. 过早标注生命周期

大多数情况下编译器能自动推断生命周期，只有编译器报错时才需要手动标注。

### 4. 把 Rust 当 JS 写

Rust 有自己的思维方式——代数数据类型、trait 系统、零成本抽象。不要试图在 Rust 里模拟 JS 的动态特性。

## 工程建议

1. **先让代码编译通过，再优化性能**。初学者的首要目标是通过编译。
2. **善用 `cargo clippy`**。它能发现大量常见错误和不规范写法。
3. **测试先行**。Rust 的测试内置于 Cargo 中，先用 `cargo test` 验证逻辑。
4. **选择支持 WASM 的 crate**。不是所有 crate 都能在 `wasm32-unknown-unknown` 上编译。

## 小结

- **所有权系统**保证内存安全，无需 GC
- **借用**允许在不转移所有权的情况下访问数据
- **生命周期**确保引用在数据存活期间有效
- **模式匹配**提供强大的分支处理能力
- **Result / Option** 通过类型系统处理错误
- **Cargo** 管理项目依赖和构建流程

## 练习

### 练习一：所有权转移

编写函数 `take_ownership(s: String)` 打印字符串。在 main 中调用后尝试再次使用该 String，观察编译器错误。

### 练习二：可变借用

编写函数 `append_greeting(s: &mut String)` 追加 `", welcome to WASM!"`。在 main 中创建 String 并调用。

### 练习三：Result 错误处理

编写函数 `parse_page_count(input: &str) -> Result<u32, String>`，解析字符串为 u32，范围 1-1000。

---

## 参考答案

### 练习一

**思路**：将 String 传入函数等同于赋值，所有权转移给参数。

```rust
fn take_ownership(s: String) {
    println!("获取到字符串: {}", s);
} // s 在这里被释放

fn main() {
    let my_string = String::from("hello WASM");
    take_ownership(my_string);
    // println!("{}", my_string); // ❌ value borrowed here after move
}
```

### 练习二

**思路**：使用 `&mut String` 修改调用者的数据，不转移所有权。

```rust
fn append_greeting(s: &mut String) {
    s.push_str(", welcome to WASM!");
}

fn main() {
    let mut name = String::from("Rustacean");
    append_greeting(&mut name);
    println!("{}", name); // Rustacean, welcome to WASM!
}
```

### 练习三

**思路**：用 `parse()` 转 u32，`map_err` 转换错误信息，`?` 传播错误，再检查范围。

```rust
fn parse_page_count(input: &str) -> Result<u32, String> {
    let count: u32 = input.parse()
        .map_err(|e| format!("'{}' 不是有效数字: {}", input, e))?;

    if count < 1 || count > 1000 {
        Err(format!("页码 {} 超出范围 1-1000", count))
    } else {
        Ok(count)
    }
}

fn main() {
    println!("{:?}", parse_page_count("42"));    // Ok(42)
    println!("{:?}", parse_page_count("abc"));   // Err(...)
    println!("{:?}", parse_page_count("9999"));  // Err(...)
}
```
