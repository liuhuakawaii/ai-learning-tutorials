# Rust 基础语法

## 为什么选 Rust 做 WASM

三种写 WASM 的语言：C/C++（Emscripten）、Rust（wasm-bindgen）、AssemblyScript（类 TS）。

选 Rust 的理由：
- 内存安全，没有 C/C++ 的未定义行为
- wasm-bindgen 生态成熟，与 JS 互操作最方便
- wasm-pack 工具链好用，一键构建 + 发布 npm 包
- 社区活跃，Rust + WASM 是最热门的组合

## 最小 Rust 程序

```rust
fn main() {
    println!("Hello, world!");
}
```

```bash
rustc main.rs
./main
```

## 变量和可变性

```rust
let x = 5;         // 不可变
let mut y = 10;    // 可变
y = 15;            // OK

const MAX: i32 = 100; // 常量，必须标注类型
```

Rust 默认不可变。需要修改时必须显式 `mut`。

## 基本类型

```rust
let a: i32 = 42;        // 32 位有符号整数
let b: f64 = 3.14;      // 64 位浮点数
let c: bool = true;     // 布尔
let d: char = 'A';      // 字符（4 字节 Unicode）
let e: &str = "hello";  // 字符串切片
```

## 函数

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b  // 没有分号 = 返回值
}

fn greet(name: &str) {
    println!("Hello, {}!", name);
}
```

最后一个表达式没有分号就是返回值。

## 所有权

Rust 最独特的特性。每个值只有一个所有者，所有者离开作用域时值被释放。

```rust
let s1 = String::from("hello");
let s2 = s1;        // s1 的所有权转移给 s2
// println!("{}", s1); // 编译错误！s1 已失效
println!("{}", s2);  // OK
```

如果需要保留原值，用 `clone`：

```rust
let s1 = String::from("hello");
let s2 = s1.clone();  // 深拷贝
println!("{}", s1);    // OK
```

## 引用和借用

不转移所有权，临时借用：

```rust
fn calculate_length(s: &String) -> usize {
    s.len()
}

let s = String::from("hello");
let len = calculate_length(&s);  // 借用
println!("{} has length {}", s, len);  // s 仍然有效
```

可变引用：

```rust
fn push_world(s: &mut String) {
    s.push_str(", world!");
}

let mut s = String::from("hello");
push_world(&mut s);
println!("{}", s);  // "hello, world!"
```

同一时间只能有一个可变引用。

## 结构体

```rust
struct Rectangle {
    width: f64,
    height: f64,
}

impl Rectangle {
    fn area(&self) -> f64 {
        self.width * self.height
    }
}

let rect = Rectangle { width: 10.0, height: 5.0 };
println!("Area: {}", rect.area());
```

## 枚举和模式匹配

```rust
enum Shape {
    Circle(f64),           // 半径
    Rectangle(f64, f64),   // 宽、高
}

fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle(r) => std::f64::consts::PI * r * r,
        Shape::Rectangle(w, h) => w * h,
    }
}
```

## 错误处理

```rust
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        Err("Division by zero".to_string())
    } else {
        Ok(a / b)
    }
}

match divide(10.0, 3.0) {
    Ok(result) => println!("Result: {}", result),
    Err(e) => println!("Error: {}", e),
}
```

## Vec 和迭代器

```rust
let mut numbers = vec![1, 2, 3, 4, 5];
numbers.push(6);

let sum: i32 = numbers.iter().sum();
let doubled: Vec<i32> = numbers.iter().map(|x| x * 2).collect();
let evens: Vec<&i32> = numbers.iter().filter(|x| *x % 2 == 0).collect();
```

## 练习

### 练习一：斐波那契

实现 `fibonacci(n: u32) -> u64`，返回第 n 个斐波那契数。

### 练习二：字符串处理

实现 `count_words(s: &str) -> usize`，统计字符串中的单词数。

### 练习三：结构体

定义 `Student` 结构体，实现 `average` 方法计算平均分。

---

## 参考答案

### 练习一

```rust
fn fibonacci(n: u32) -> u64 {
    if n <= 1 { return n as u64; }
    let mut a: u64 = 0;
    let mut b: u64 = 1;
    for _ in 2..=n {
        let temp = a + b;
        a = b;
        b = temp;
    }
    b
}
```

### 练习二

```rust
fn count_words(s: &str) -> usize {
    s.split_whitespace().count()
}
```

### 练习三

```rust
struct Student {
    name: String,
    scores: Vec<f64>,
}

impl Student {
    fn average(&self) -> f64 {
        if self.scores.is_empty() { return 0.0; }
        self.scores.iter().sum::<f64>() / self.scores.len() as f64
    }
}
```
