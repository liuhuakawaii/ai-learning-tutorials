# 02 - wasm-bindgen 入门

## 场景引入

在上一课中，我们学会了 Rust 基础语法，但有一个关键问题没解决：Rust 编译出的 WASM 模块如何与 JS 通信？如果你想在 Rust 中调用 `document.getElementById()`，或者让 JS 调用 Rust 的字符串处理函数，怎么做？

`wasm-bindgen` 就是解决这个问题的。它是 Rust ↔ JS 互操作的核心桥梁，让你在两种语言间自由传递数据和调用函数。

## 学习目标

- 理解 wasm-bindgen 的设计理念和工作原理
- 掌握 Rust ↔ JS 的类型映射规则
- 学会用 `#[wasm_bindgen]` 导出 Rust 函数到 JS
- 学会用 `extern "C"` 导入 JS 函数到 Rust
- 理解闭包支持和 JsValue/JsCast 的使用场景

## wasm-bindgen 设计理念

wasm-bindgen 的核心目标：**让 Rust 和 JS 之间的调用像调用本地函数一样自然**。它在编译时自动生成"胶水代码"（glue code），处理类型转换和内存管理。

```
Rust 源码 + #[wasm_bindgen]
    ↓
wasm-bindgen CLI 分析编译产物
    ↓
生成 .wasm 文件 + JS 胶水代码
    ↓
JS 端直接 import 使用
```

## #[wasm_bindgen] 属性

`#[wasm_bindgen]` 是过程宏，可标注在函数、结构体、枚举、impl 块上：

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("你好, {}! 欢迎来到 WASM 世界", name)
}

#[wasm_bindgen]
pub struct WasmCounter {
    count: u32,
}

#[wasm_bindgen]
impl WasmCounter {
    #[wasm_bindgen(constructor)]
    pub fn new(initial: u32) -> WasmCounter {
        WasmCounter { count: initial }
    }

    pub fn increment(&mut self) { self.count += 1; }

    pub fn get_count(&self) -> u32 { self.count }
}
```

JS 端使用：

```javascript
import init, { greet, WasmCounter } from './pkg/my_wasm.js';

async function main() {
    await init();
    console.log(greet("Rustacean"));
    const counter = new WasmCounter(0);
    counter.increment();
    console.log(counter.get_count()); // 1
}
```

### 常用属性

```rust
#[wasm_bindgen]
impl Config {
    #[wasm_bindgen(constructor)]  // JS: new Config()
    pub fn new() -> Config { /* ... */ }

    #[wasm_bindgen(getter)]       // JS: config.version
    pub fn version(&self) -> String { "1.0.0".into() }

    #[wasm_bindgen(setter)]       // JS: config.name = "xxx"
    pub fn set_name(&mut self, _name: &str) { /* ... */ }

    #[wasm_bindgen(js_name = processInput)]  // 重命名导出
    pub fn process(&self, input: &str) -> String { input.to_uppercase() }
}
```

## 类型映射

wasm-bindgen 定义了 Rust ↔ JS 的类型映射规则：

| Rust 类型 | JS 类型 | 传递方式 | 说明 |
|-----------|---------|---------|------|
| `i32`, `u32` | `number` | 值传递 | 直接通过 WASM 栈 |
| `f32`, `f64` | `number` | 值传递 | 浮点数 |
| `bool` | `boolean` | 值传递 | |
| `i64`, `u64` | `BigInt` | 需特殊处理 | JS number 只能精确表示 ±2^53 |
| `String`, `&str` | `string` | 堆传递 | 涉及线性内存分配 |
| `&[u8]`, `Vec<u8>` | `Uint8Array` | 堆传递 | 字节数组 |
| `JsValue` | `any` | 引用传递 | 通用 JS 值包装 |

## 导入 JS 函数到 Rust

用 `extern "C"` 块声明 JS 函数，编译时生成 WASM 导入：

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);

    #[wasm_bindgen(js_namespace = Math)]
    fn random() -> f64;

    #[wasm_bindgen(js_name = getCurrentTimestamp)]
    fn get_timestamp() -> f64;
}

#[wasm_bindgen]
pub fn debug_info(message: &str) {
    log(&format!("[WASM] {}", message));
    log(&format!("[WASM] 随机数: {}", random()));
}
```

### 导入 JS 类方法

```rust
#[wasm_bindgen]
extern "C" {
    type HTMLCanvasElement;

    #[wasm_bindgen(method)]
    fn getContext(this: &HTMLCanvasElement, context_type: &str) -> JsValue;

    #[wasm_bindgen(method, js_name = toDataURL)]
    fn to_data_url(this: &HTMLCanvasElement) -> String;
}
```

## 闭包支持

wasm-bindgen 允许 Rust 闭包传递给 JS 回调：

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn setup_timer() {
    let closure = Closure::wrap(Box::new(move || {
        web_sys::console::log_1(&"计时器触发！".into());
    }) as Box<dyn FnMut()>);

    web_sys::window().unwrap()
        .set_timeout_with_callback_and_timeout_and_arguments_0(
            closure.as_ref().unchecked_ref(), 1000,
        ).unwrap();

    closure.forget(); // 阻止自动释放，适用于长期回调
}
```

三种闭包模式：
- **FnMut**：可多次调用，可修改捕获的变量（最常用）
- **FnOnce**：只能调用一次，消耗捕获的值
- **Fn**：可多次调用，不可修改（最安全）

`forget()` 会泄漏内存——闭包永不释放。对于一次性回调，使用 `Closure::once`。

## JsValue 与 JsCast

`JsValue` 是 Rust 端对任意 JS 值的通用包装：

```rust
use wasm_bindgen::prelude::*;
use js_sys::Array;

#[wasm_bindgen]
pub fn inspect_value(value: &JsValue) -> String {
    if value.is_string() {
        format!("字符串: {}", value.as_string().unwrap())
    } else if value.is_number() {
        format!("数字: {}", value.as_f64().unwrap())
    } else if value.is_undefined() {
        "undefined".into()
    } else {
        "未知类型".into()
    }
}

#[wasm_bindgen]
pub fn cast_demo() {
    let arr = Array::new();
    arr.push(&JsValue::from(1));
    arr.push(&"hello".into());

    // dyn_ref 进行安全向下转型
    let js_val: JsValue = arr.into();
    if let Some(arr) = js_val.dyn_ref::<Array>() {
        web_sys::console::log_1(&format!("数组长度: {}", arr.length()).into());
    }
}
```

## 常见误区

### 1. 在循环中频繁创建 Closure

每次创建 `Closure` 都会在线性内存中分配空间。应该在循环外创建闭包，在循环内复用。

### 2. 忘记调用 init()

wasm-pack 生成的模块需要先调用 `init()` 加载 WASM 二进制。始终使用 `await init()` 确保初始化完成。

### 3. 误用 forget() 导致内存泄漏

`Closure::forget()` 让闭包永不释放。对于一次性回调用 `Closure::once`，对于事件监听器保存引用以便后续 drop。

### 4. 忽略 i64 到 BigInt 的映射

`i64`/`u64` 在 JS 端变成 `BigInt`，不能直接和 number 运算。需要 number 时在 Rust 端转成 `f64`。

## 工程建议

1. **从简单类型开始**。先用 `i32`、`f64`、`bool`、`&str` 做绑定，再处理复杂类型。
2. **使用 `wasm-bindgen-test` 做单元测试**。可在 Node.js 或 headless 浏览器中运行 Rust 测试。
3. **善用 `console_error_panic_hook`**。将 panic 信息输出到浏览器控制台。
4. **最小化跨边界调用**。Rust ↔ JS 每次调用都有类型转换开销，减少调用次数，增大单次数据量。

## 小结

- **类型映射**：Rust 和 JS 类型之间的自动转换规则
- **导出**：用 `#[wasm_bindgen]` 标注函数、结构体、impl 块
- **导入**：用 `extern "C"` 块声明 JS 函数
- **闭包**：通过 `Closure` 将 Rust 闭包传递给 JS 回调
- **JsValue / JsCast**：处理未知类型的 JS 值，安全类型转换

## 练习

### 练习一：基础绑定

编写 `calculate_fibonacci(n: u32) -> u64` 计算第 n 个斐波那契数，用 `#[wasm_bindgen]` 导出。

### 练习二：结构体导出

创建 `TextProcessor` 结构体，导出 `new`、`word_count`、`to_uppercase`、`replace` 方法。

### 练习三：JS 函数导入

导入 JS 的 `fetch` API，实现一个 HTTP GET 请求函数，返回响应文本。

---

## 参考答案

### 练习一

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn calculate_fibonacci(n: u32) -> u64 {
    if n == 0 { return 0; }
    if n == 1 { return 1; }
    let mut prev: u64 = 0;
    let mut curr: u64 = 1;
    for _ in 2..=n {
        let next = prev + curr;
        prev = curr;
        curr = next;
    }
    curr
}
```

使用 `u64` 避免溢出，JS 端会收到 BigInt。迭代方式比递归更高效。

### 练习二

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct TextProcessor { content: String }

#[wasm_bindgen]
impl TextProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(content: &str) -> TextProcessor {
        TextProcessor { content: content.to_string() }
    }
    pub fn word_count(&self) -> usize { self.content.split_whitespace().count() }
    pub fn to_uppercase(&self) -> String { self.content.to_uppercase() }
    pub fn replace(&self, from: &str, to: &str) -> String { self.content.replace(from, to) }
}
```

`#[wasm_bindgen(constructor)]` 让 JS 端用 `new TextProcessor("text")` 创建实例。

### 练习三

```rust
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use web_sys::{Request, RequestInit, RequestMode, Response};

#[wasm_bindgen]
pub async fn fetch_text(url: &str) -> Result<String, JsValue> {
    let mut opts = RequestInit::new();
    opts.method("GET");
    opts.mode(RequestMode::Cors);
    let request = Request::new_with_str_and_init(url, &opts)?;
    let window = web_sys::window().unwrap();
    let resp_value = JsFuture::from(window.fetch_with_request(&request)).await?;
    let resp: Response = resp_value.dyn_into()?;
    let text = JsFuture::from(resp.text()?).await?;
    text.as_string().ok_or_else(|| JsValue::from("响应不是有效文本"))
}
```

`wasm-bindgen-futures` 提供 `JsFuture` 将 JS Promise 转为 Rust Future。`Cargo.toml` 需添加 `web-sys` 的 `Request`、`Response`、`Window` features。
